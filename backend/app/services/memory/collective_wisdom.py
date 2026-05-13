from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def query_related_skills(db: Session, major: str, limit: int = 5) -> list[dict]:
    """Return skills commonly associated with a major, with support rates from observations.

    Three-table join: cw_entities (major) → cw_relations (required_by) →
    cw_entities (skill) ← cw_observations (support_count/sample_size).
    """
    rows = db.execute(
        text(
            "SELECT se.entity_name, "
            "  COALESCE(o.support_count, 0) AS support_count, "
            "  COALESCE(o.sample_size, 0) AS sample_size "
            "FROM cw_entities me "
            "JOIN cw_relations r ON r.from_entity_id = me.id "
            "JOIN cw_entities se ON se.id = r.to_entity_id "
            "LEFT JOIN cw_observations o ON o.entity_id = se.id "
            "  AND o.observation_type = :obs_type "
            "WHERE me.entity_type = 'major' "
            "  AND me.entity_name = :major "
            "  AND r.relation_type = 'required_by' "
            "  AND se.entity_type = 'skill' "
            "ORDER BY o.support_count DESC "
            "LIMIT :limit"
        ),
        {
            "major": major,
            "obs_type": _student_mention_obs_type(major),
            "limit": limit,
        },
    ).fetchall()

    results: list[dict] = []
    for row in rows:
        support = int(row[1])
        sample = int(row[2])
        results.append({
            "entity_name": row[0],
            "support_count": support,
            "sample_size": sample,
            "support_rate": round(support / sample, 3) if sample > 0 else 0.0,
        })
    return results


def query_skill_distribution(db: Session, role: str, limit: int = 5) -> list[dict]:
    """Return skill mastery distribution for a given role.

    Joins cw_entities (role) → cw_relations (required_by) → cw_entities (skill),
    then pulls mastery/in_progress rates from cw_observations.
    """
    rows = db.execute(
        text(
            "SELECT se.entity_name, se.id AS skill_id "
            "FROM cw_entities re "
            "JOIN cw_relations r ON r.from_entity_id = re.id "
            "JOIN cw_entities se ON se.id = r.to_entity_id "
            "WHERE re.entity_type = 'role' "
            "  AND re.entity_name = :role "
            "  AND r.relation_type = 'required_by' "
            "  AND se.entity_type = 'skill' "
            "LIMIT :limit"
        ),
        {"role": role, "limit": limit},
    ).fetchall()

    if not rows:
        return []

    skill_ids = [row[1] for row in rows]
    placeholders = ",".join(f":sid{i}" for i in range(len(skill_ids)))

    mastery_rows = db.execute(
        text(
            f"SELECT entity_id, support_count, sample_size, observation_type "
            f"FROM cw_observations "
            f"WHERE entity_id IN ({placeholders}) "
            f"  AND observation_type LIKE :obs_prefix"
        ),
        {
            **{f"sid{i}": sid for i, sid in enumerate(skill_ids)},
            "obs_prefix": "mastery_rate:%",
        },
    ).fetchall()

    mastery_by_skill: dict[str, dict] = {}
    for row in mastery_rows:
        sid = row[0]
        if sid not in mastery_by_skill:
            mastery_by_skill[sid] = {"mastered_count": 0, "mastered_sample": 0,
                                       "in_progress_count": 0, "in_progress_sample": 0}
        obs_type = row[3]
        if obs_type.startswith("mastery_rate:"):
            mastery_by_skill[sid]["mastered_count"] = int(row[1])
            mastery_by_skill[sid]["mastered_sample"] = int(row[2])
        elif obs_type.startswith("in_progress_rate:"):
            mastery_by_skill[sid]["in_progress_count"] = int(row[1])
            mastery_by_skill[sid]["in_progress_sample"] = int(row[2])

    results: list[dict] = []
    for row in rows:
        skill_name = row[0]
        sid = row[1]
        obs = mastery_by_skill.get(sid, {})
        mc = obs.get("mastered_count", 0)
        ms = obs.get("mastered_sample", 0)
        ic = obs.get("in_progress_count", 0)
        iss = obs.get("in_progress_sample", 0)
        total_sample = max(ms, iss)
        results.append({
            "skill_name": skill_name,
            "mastered_rate": round(mc / ms, 3) if ms > 0 else 0.0,
            "in_progress_rate": round(ic / iss, 3) if iss > 0 else 0.0,
            "sample_size": total_sample,
        })
    return results


def record_cw_observation(
    db: Session,
    entity_id: str,
    observation_type: str,
    source: str = "runtime",
) -> None:
    """Increment or create an observation record. Idempotent per (entity_id, observation_type)."""
    existing = db.execute(
        text(
            "SELECT id, support_count, sample_size FROM cw_observations "
            "WHERE entity_id = :entity_id AND observation_type = :obs_type "
            "LIMIT 1"
        ),
        {"entity_id": entity_id, "obs_type": observation_type},
    ).fetchone()

    if existing:
        db.execute(
            text(
                "UPDATE cw_observations SET support_count = support_count + 1, "
                "sample_size = sample_size + 1, source = :source "
                "WHERE id = :obs_id"
            ),
            {"source": source, "obs_id": existing[0]},
        )
    else:
        from datetime import datetime, timezone
        from uuid import uuid4
        db.execute(
            text(
                "INSERT INTO cw_observations (id, entity_id, observation_type, "
                "support_count, sample_size, source, created_at) "
                "VALUES (:id, :entity_id, :obs_type, 1, 1, :source, :created_at)"
            ),
            {
                "id": f"cw_obs_{uuid4().hex[:12]}",
                "entity_id": entity_id,
                "obs_type": observation_type,
                "source": source,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )
    db.commit()


def seed_cw_data(db: Session) -> dict:
    """Execute seed SQL if cw_entities is empty. Returns seeding status."""
    count = db.execute(text("SELECT COUNT(*) FROM cw_entities")).scalar() or 0
    if count > 0:
        return {"seeded": False, "message": f"cw_entities already has {count} rows"}

    seed_path = Path(__file__).resolve().parents[2] / "migrations" / "seed_cw_data.sql"
    if not seed_path.is_file():
        logger.warning("seed_cw_data.sql not found at %s", seed_path)
        return {"seeded": False, "message": "seed file not found"}

    sql = seed_path.read_text(encoding="utf-8")
    # Use raw DBAPI connection for multi-statement SQL (INSERT OR IGNORE blocks)
    raw_conn = db.connection().connection
    raw_conn.executescript(sql)
    db.commit()

    entity_count = db.execute(text("SELECT COUNT(*) FROM cw_entities")).scalar() or 0
    rel_count = db.execute(text("SELECT COUNT(*) FROM cw_relations")).scalar() or 0
    obs_count = db.execute(text("SELECT COUNT(*) FROM cw_observations")).scalar() or 0

    logger.info("CW seed data loaded: %s entities, %s relations, %s observations",
                entity_count, rel_count, obs_count)
    return {
        "seeded": True,
        "entities": entity_count,
        "relations": rel_count,
        "observations": obs_count,
    }


def list_cw_entities(db: Session, entity_type: str | None = None,
                     page: int = 1, page_size: int = 20) -> dict:
    """Paginated listing of CW entities, optionally filtered by type."""
    params: dict = {}
    type_clause = ""
    if entity_type:
        type_clause = "WHERE entity_type = :entity_type"
        params["entity_type"] = entity_type

    total = db.execute(
        text(f"SELECT COUNT(*) FROM cw_entities {type_clause}"), params
    ).scalar() or 0

    rows = db.execute(
        text(
            f"SELECT id, entity_type, entity_name, properties_json "
            f"FROM cw_entities {type_clause} "
            f"ORDER BY entity_type, entity_name "
            f"LIMIT :limit OFFSET :offset"
        ),
        {**params, "limit": page_size, "offset": (page - 1) * page_size},
    ).fetchall()

    items = [
        {"id": r[0], "entity_type": r[1], "entity_name": r[2], "properties_json": r[3]}
        for r in rows
    ]
    return {"total": total, "page": page, "page_size": page_size, "items": items}


def list_cw_relations(db: Session, page: int = 1, page_size: int = 50) -> dict:
    total = db.execute(text("SELECT COUNT(*) FROM cw_relations")).scalar() or 0
    rows = db.execute(
        text(
            "SELECT id, from_entity_id, to_entity_id, relation_type "
            "FROM cw_relations ORDER BY relation_type, id "
            "LIMIT :limit OFFSET :offset"
        ),
        {"limit": page_size, "offset": (page - 1) * page_size},
    ).fetchall()

    items = [
        {"id": r[0], "from_entity_id": r[1], "to_entity_id": r[2], "relation_type": r[3]}
        for r in rows
    ]
    return {"total": total, "page": page, "page_size": page_size, "items": items}


def list_cw_observations(db: Session, entity_id: str | None = None,
                         page: int = 1, page_size: int = 50) -> dict:
    params: dict = {}
    where = ""
    if entity_id:
        where = "WHERE entity_id = :entity_id"
        params["entity_id"] = entity_id

    total = db.execute(
        text(f"SELECT COUNT(*) FROM cw_observations {where}"), params
    ).scalar() or 0

    rows = db.execute(
        text(
            f"SELECT id, entity_id, observation_type, support_count, sample_size, source "
            f"FROM cw_observations {where} "
            f"ORDER BY entity_id, observation_type "
            f"LIMIT :limit OFFSET :offset"
        ),
        {**params, "limit": page_size, "offset": (page - 1) * page_size},
    ).fetchall()

    items = [
        {"id": r[0], "entity_id": r[1], "observation_type": r[2],
         "support_count": r[3], "sample_size": r[4], "source": r[5]}
        for r in rows
    ]
    return {"total": total, "page": page, "page_size": page_size, "items": items}


def _student_mention_obs_type(major: str) -> str:
    """Build observation_type key for student mentions of a major."""
    parts = major.split()
    key = "_".join(parts).lower()
    return f"student_mention:{key}"
