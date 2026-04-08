from sqlalchemy import Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CareerRequirementProfile(Base):
    __tablename__ = "career_requirement_profiles"
    __table_args__ = (
        UniqueConstraint("canonical_job_title", name="uq_career_requirement_profile_canonical_job_title"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    canonical_job_title: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    source_job_titles_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]", server_default="[]")
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    professional_and_threshold_coverage: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        server_default="0",
    )
    collaboration_and_adaptation_coverage: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        server_default="0",
    )
    growth_and_professionalism_coverage: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        server_default="0",
    )
    professional_skills: Mapped[str] = mapped_column(Text, nullable=False)
    professional_background: Mapped[str] = mapped_column(Text, nullable=False)
    education_requirement: Mapped[str] = mapped_column(Text, nullable=False)
    teamwork: Mapped[str] = mapped_column(Text, nullable=False)
    stress_adaptability: Mapped[str] = mapped_column(Text, nullable=False)
    communication: Mapped[str] = mapped_column(Text, nullable=False)
    work_experience: Mapped[str] = mapped_column(Text, nullable=False)
    documentation_awareness: Mapped[str] = mapped_column(Text, nullable=False)
    responsibility: Mapped[str] = mapped_column(Text, nullable=False)
    learning_ability: Mapped[str] = mapped_column(Text, nullable=False)
    problem_solving: Mapped[str] = mapped_column(Text, nullable=False)
    other_special: Mapped[str] = mapped_column(Text, nullable=False)
