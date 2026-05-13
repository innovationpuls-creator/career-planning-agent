from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session


def get_dlq_summary(db: Session) -> dict:
    """Return DLQ summary: total dead_letter count, by event_type, trend."""
    now = datetime.now(timezone.utc)
    last_24h = (now - timedelta(hours=24)).isoformat()
    last_7d = (now - timedelta(days=7)).isoformat()

    total = db.execute(
        text("SELECT COUNT(*) FROM outbox_events WHERE status = 'dead_letter'")
    ).scalar() or 0

    by_type_rows = db.execute(
        text(
            "SELECT event_type, COUNT(*) FROM outbox_events "
            "WHERE status = 'dead_letter' GROUP BY event_type"
        )
    ).fetchall()
    by_event_type = {row[0]: row[1] for row in by_type_rows}

    last_24h_count = db.execute(
        text(
            "SELECT COUNT(*) FROM outbox_events "
            "WHERE status = 'dead_letter' AND created_at >= :since"
        ),
        {"since": last_24h},
    ).scalar() or 0

    last_7d_count = db.execute(
        text(
            "SELECT COUNT(*) FROM outbox_events "
            "WHERE status = 'dead_letter' AND created_at >= :since"
        ),
        {"since": last_7d},
    ).scalar() or 0

    oldest = db.execute(
        text(
            "SELECT created_at FROM outbox_events "
            "WHERE status = 'dead_letter' ORDER BY created_at ASC LIMIT 1"
        )
    ).scalar()

    oldest_str = oldest.isoformat() if hasattr(oldest, "isoformat") else str(oldest) if oldest else None

    return {
        "total": total,
        "by_event_type": by_event_type,
        "trend": {"last_24h": last_24h_count, "last_7d": last_7d_count},
        "oldest_unresolved": oldest_str,
    }


def get_dlq_detail(
    db: Session,
    *,
    event_type: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """Return paginated dead_letter event details."""
    params: dict = {}

    if event_type:
        where_clause = "AND event_type = :event_type"
        params["event_type"] = event_type
    else:
        where_clause = ""

    total = db.execute(
        text(
            f"SELECT COUNT(*) FROM outbox_events "
            f"WHERE status = 'dead_letter' {where_clause}"
        ),
        params,
    ).scalar() or 0

    offset = (page - 1) * page_size
    params["limit"] = page_size
    params["offset"] = offset

    rows = db.execute(
        text(
            f"SELECT id, event_type, payload_json, trace_id, last_error, "
            f"attempt_count, created_at "
            f"FROM outbox_events "
            f"WHERE status = 'dead_letter' {where_clause} "
            f"ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        ),
        params,
    ).fetchall()

    items = [
        {
            "id": row[0],
            "event_type": row[1],
            "payload_json": row[2],
            "trace_id": row[3],
            "last_error": row[4],
            "attempt_count": row[5],
            "created_at": row[6].isoformat() if hasattr(row[6], "isoformat") else str(row[6]) if row[6] else None,
        }
        for row in rows
    ]

    return {"total": total, "items": items, "page": page, "page_size": page_size}
