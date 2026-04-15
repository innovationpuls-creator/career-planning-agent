from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class StudentProfile(Base):
    __tablename__ = "student_profiles"
    __table_args__ = (UniqueConstraint("user_id", name="uq_student_profiles_user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(128), nullable=False)
    school: Mapped[str] = mapped_column(String(255), nullable=False)
    major: Mapped[str] = mapped_column(String(255), nullable=False)
    education_level: Mapped[str] = mapped_column(String(64), nullable=False)
    grade: Mapped[str] = mapped_column(String(64), nullable=False)
    target_job_title: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    current_stage: Mapped[str] = mapped_column(String(16), nullable=False, default="low", server_default="low")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )
