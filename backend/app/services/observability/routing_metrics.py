from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session


def get_routing_hit_rates(db: Session, start: str, end: str) -> dict:
    """Return routing hit rates by level and by agent for the given period."""
    total = db.execute(
        text(
            "SELECT COUNT(*) FROM routing_log "
            "WHERE created_at >= :start AND created_at < :end"
        ),
        {"start": start, "end": end},
    ).scalar() or 0

    by_level_rows = db.execute(
        text(
            "SELECT route_level, COUNT(*) FROM routing_log "
            "WHERE created_at >= :start AND created_at < :end "
            "GROUP BY route_level"
        ),
        {"start": start, "end": end},
    ).fetchall()

    by_level: dict[str, dict] = {
        level: {"count": 0, "percentage": 0.0}
        for level in ["L1", "L1.5", "L2", "L4"]
    }
    for row in by_level_rows:
        level, count = row[0], row[1]
        by_level[level] = {
            "count": count,
            "percentage": round(count / total * 100, 1) if total > 0 else 0.0,
        }

    by_agent_rows = db.execute(
        text(
            "SELECT matched_agent, COUNT(*) FROM routing_log "
            "WHERE created_at >= :start AND created_at < :end "
            "GROUP BY matched_agent"
        ),
        {"start": start, "end": end},
    ).fetchall()

    by_agent: dict[str, dict] = {}
    for row in by_agent_rows:
        agent, count = row[0], row[1]
        by_agent[agent] = {
            "count": count,
            "percentage": round(count / total * 100, 1) if total > 0 else 0.0,
        }

    return {
        "period": {"start": start, "end": end},
        "total_routes": total,
        "by_level": by_level,
        "by_agent": by_agent,
    }


def export_routing_logs(
    db: Session,
    start: str,
    end: str,
    min_confidence: float | None = None,
) -> dict:
    """Export routing logs for P5 BERT training data collection."""
    params: dict = {"start": start, "end": end}
    confidence_filter = ""

    if min_confidence is not None:
        confidence_filter = " AND llm_confidence >= :min_confidence"
        params["min_confidence"] = min_confidence

    total = db.execute(
        text(
            f"SELECT COUNT(*) FROM routing_log "
            f"WHERE created_at >= :start AND created_at < :end{confidence_filter}"
        ),
        params,
    ).scalar() or 0

    rows = db.execute(
        text(
            f"SELECT trace_id, route_level, message, matched_agent, matched_rule, "
            f"llm_confidence, corrected_by_user, task_success, created_at "
            f"FROM routing_log "
            f"WHERE created_at >= :start AND created_at < :end{confidence_filter} "
            f"ORDER BY created_at DESC LIMIT 1000"
        ),
        params,
    ).fetchall()

    logs = [
        {
            "trace_id": row[0],
            "route_level": row[1],
            "message": row[2],
            "matched_agent": row[3],
            "matched_rule": row[4],
            "llm_confidence": row[5],
            "corrected_by_user": bool(row[6]),
            "task_success": bool(row[7]),
            "created_at": row[8].isoformat() if hasattr(row[8], "isoformat") else str(row[8]) if row[8] else None,
        }
        for row in rows
    ]

    return {"total": total, "logs": logs}


def format_for_bert_training(
    db: Session,
    start: str,
    end: str,
    min_confidence: float = 0.80,
    output_format: str = "jsonl",
) -> str:
    """Export routing logs as BERT-tiny training data.

    Only includes rows where llm_confidence >= *min_confidence* and
    corrected_by_user is false (reliable pseudo-labels from L4).

    Args:
        db: Database session.
        start, end: ISO-format date range.
        min_confidence: Minimum L4 confidence to include (default 0.80).
        output_format: ``"jsonl"`` (default) or ``"csv"``.

    Returns:
        Formatted training data as a string.
    """
    rows = db.execute(
        text(
            "SELECT message, matched_agent, llm_confidence "
            "FROM routing_log "
            "WHERE created_at >= :start AND created_at < :end "
            "AND route_level = 'L4' "
            "AND llm_confidence >= :min_confidence "
            "AND (corrected_by_user IS NULL OR corrected_by_user = 0) "
            "ORDER BY llm_confidence DESC "
            "LIMIT 10000"
        ),
        {"start": start, "end": end, "min_confidence": min_confidence},
    ).fetchall()

    if output_format == "csv":
        header = "text,label\n"
        body = "\n".join(
            f'"{row[0].replace(chr(34), chr(34)+chr(34))}",{row[1]}'
            for row in rows
        )
        return header + body

    # JSONL
    lines = [
        f'{{"text": {__import__("json").dumps(row[0], ensure_ascii=False)}, '
        f'"label": "{row[1]}", "confidence": {row[2]}}}'
        for row in rows
    ]
    return "\n".join(lines)
