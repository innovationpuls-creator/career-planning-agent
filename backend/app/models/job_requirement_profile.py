from sqlalchemy import Integer, Text, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class JobRequirementProfile(Base):
    __tablename__ = "job_requirement_profiles"
    __table_args__ = (
        UniqueConstraint("industry", "job_title", "company_name", name="uq_job_requirement_profile_group"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    industry: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    job_title: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    canonical_job_title: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
        default="",
        server_default="",
    )
    company_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
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
    other_special: Mapped[str] = mapped_column(Text, nullable=False, default='["无明确要求"]', server_default='["无明确要求"]')
