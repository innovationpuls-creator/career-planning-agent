from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CareerDevelopmentPlanReview(Base):
    __tablename__ = "career_development_plan_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    workspace_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("career_development_plan_workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    favorite_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("career_development_favorite_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    review_type: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    snapshot_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
