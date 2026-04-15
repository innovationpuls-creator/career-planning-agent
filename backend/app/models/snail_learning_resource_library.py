from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SnailLearningResourceLibrary(Base):
    __tablename__ = "snail_learning_resource_library"
    __table_args__ = (
        UniqueConstraint(
            "canonical_job_title",
            "dimension_key",
            "phase_key",
            "rank",
            name="uq_snail_learning_resource_slot",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    canonical_job_title: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    dimension_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    phase_key: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    site_title: Mapped[str] = mapped_column(String(255), nullable=False)
    site_url: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
