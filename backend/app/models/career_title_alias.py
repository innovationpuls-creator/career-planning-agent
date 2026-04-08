from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CareerTitleAlias(Base):
    __tablename__ = "career_title_aliases"
    __table_args__ = (
        UniqueConstraint("raw_job_title", name="uq_career_title_alias_raw_job_title"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    raw_job_title: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    canonical_job_title: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    alias_version: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )
