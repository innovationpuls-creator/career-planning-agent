from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CareerDevelopmentPersonalGrowthReportTask(Base):
    __tablename__ = "career_development_personal_growth_report_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    favorite_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("career_development_favorite_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued", index=True)
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    overwrite_current: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    result_workspace_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("career_development_plan_workspaces.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    result_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
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
