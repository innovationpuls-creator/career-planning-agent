from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SnailLearningPathReview(Base):
    __tablename__ = "snail_learning_path_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    workspace_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    phase_key: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    review_type: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    checked_resource_urls_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    user_prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    uploaded_files_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    llm_report_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
