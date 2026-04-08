from sqlalchemy import Integer, Text, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class JobPosting(Base):
    __tablename__ = "job_postings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    industry: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    job_title: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    salary_range: Mapped[str | None] = mapped_column(String(128), nullable=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    company_size: Mapped[str | None] = mapped_column(String(128), nullable=True)
    company_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    job_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    company_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
