from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CareerGroupEmbedding(Base):
    __tablename__ = "career_group_embeddings"
    __table_args__ = (
        UniqueConstraint("career_id", "group_key", name="uq_career_group_embedding_career_group"),
        UniqueConstraint("vector_id", name="uq_career_group_embedding_vector"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    career_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("career_requirement_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    group_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    vector_id: Mapped[str] = mapped_column(String(128), nullable=False)
    source_signature: Mapped[str] = mapped_column(String(64), nullable=False)
    vector_version: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )
