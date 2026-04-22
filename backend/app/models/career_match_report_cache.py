from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CareerMatchReportCache(Base):
    """
    Cache for career development match reports keyed by report_id.
    Allows the favorites API to look up a full report from a report_id alone,
    avoiding the need to pass the entire report object in the create request.
    """

    __tablename__ = "career_match_report_caches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    report_id: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    report_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )
