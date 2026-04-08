from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class StudentCompetencyProfile(Base):
    __tablename__ = "student_competency_profiles"
    __table_args__ = (
        UniqueConstraint(
            "workspace_conversation_id",
            name="uq_student_competency_profile_workspace_conversation",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    workspace_conversation_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    dify_conversation_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    latest_profile_json: Mapped[str] = mapped_column(Text, nullable=False)
    latest_source_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    last_message_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
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
