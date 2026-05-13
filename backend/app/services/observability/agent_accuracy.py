from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session


def get_agent_accuracy(db: Session, start: str, end: str) -> dict:
    """Return agent accuracy metrics based on feedback_records."""
    rows = db.execute(
        text(
            "SELECT "
            "target_type AS agent, "
            "COUNT(*) AS feedback_count, "
            "SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) AS positive, "
            "SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) AS negative, "
            "SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) AS neutral "
            "FROM feedback_records "
            "WHERE created_at >= :start AND created_at < :end "
            "GROUP BY target_type"
        ),
        {"start": start, "end": end},
    ).fetchall()

    total_feedback = sum(row[1] for row in rows)

    by_agent: dict[str, dict] = {}
    for row in rows:
        agent = row[0]
        feedback_count = row[1]
        positive = row[2]
        negative = row[3]
        neutral = row[4]

        pos_plus_neg = positive + negative

        by_agent[agent] = {
            "feedback_count": feedback_count,
            "positive": positive,
            "negative": negative,
            "neutral": neutral,
            "accuracy": round(positive / pos_plus_neg * 100, 1) if pos_plus_neg > 0 else None,
            "insufficient_data": feedback_count < 5,
        }

    return {
        "period": {"start": start, "end": end},
        "total_feedback": total_feedback,
        "by_agent": by_agent,
    }
