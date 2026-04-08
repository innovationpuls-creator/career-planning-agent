from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def build_workspace_id() -> str:
    return str(uuid4())


class CareerDevelopmentPlanWorkspace(Base):
    __tablename__ = "career_development_plan_workspaces"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        index=True,
        default=build_workspace_id,
    )
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    favorite_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("career_development_favorite_reports.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    source_task_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("career_development_goal_plan_tasks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    generated_plan_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    current_plan_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    generated_report_markdown: Mapped[str] = mapped_column(Text, nullable=False, default="")
    edited_report_markdown: Mapped[str] = mapped_column(Text, nullable=False, default="")
    latest_integrity_check_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    latest_review_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    export_meta_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
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
