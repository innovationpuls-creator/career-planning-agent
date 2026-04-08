from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CareerDevelopmentFavoriteReport(Base):
    __tablename__ = "career_development_favorite_reports"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "normalized_canonical_job_title",
            "normalized_industry",
            name="uq_career_development_favorite_target",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    source_kind: Mapped[str] = mapped_column(String(32), nullable=False, default="recommendation")
    report_id: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    target_scope: Mapped[str] = mapped_column(String(32), nullable=False, default="career")
    target_title: Mapped[str] = mapped_column(String(128), nullable=False)
    canonical_job_title: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    normalized_canonical_job_title: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    representative_job_title: Mapped[str | None] = mapped_column(String(128), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    normalized_industry: Mapped[str] = mapped_column(String(128), nullable=False, default="", index=True)
    overall_match: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    report_snapshot_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
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
