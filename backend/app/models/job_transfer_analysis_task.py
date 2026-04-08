from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class JobTransferAnalysisTask(Base):
    __tablename__ = "job_transfer_analysis_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    career_profile_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("career_requirement_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued", index=True)
    processed_candidates: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_candidates: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    last_event_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    error_message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cancel_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
