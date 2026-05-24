from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.utils.datetime_utils import utc_now


class GrowthWorkbenchTask(Base):
    __tablename__ = "growth_workbench_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    favorite_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("career_development_favorite_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    queue_id: Mapped[str] = mapped_column(String(36), nullable=False, default="", index=True)
    task_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued", index=True)
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    input_snapshot_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    result_artifact_id: Mapped[str] = mapped_column(String(36), nullable=False, default="")
    cancel_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
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


class GrowthTargetDiagnosis(Base):
    __tablename__ = "growth_target_diagnoses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    favorite_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    task_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("growth_workbench_tasks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    fit_status: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    recommendation: Mapped[str] = mapped_column(String(32), nullable=False, default="keep")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    evidence_refs_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )


class GrowthGapDiagnosis(Base):
    __tablename__ = "growth_gap_diagnoses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    favorite_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    task_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("growth_workbench_tasks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    priority_dimensions_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    market_keyword_gaps_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    learning_path_suggestions_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    resume_expression_gaps_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    evidence_refs_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )


class GrowthReportVersion(Base):
    __tablename__ = "growth_report_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    favorite_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    task_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    sections_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    markdown: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source_summary_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    accepted: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    backfilled_workspace_id: Mapped[str] = mapped_column(String(36), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )


class GrowthResumeVersion(Base):
    __tablename__ = "growth_resume_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    favorite_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    task_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    suggestions_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    section_rewrites_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    resume_markdown: Mapped[str] = mapped_column(Text, nullable=False, default="")
    resume_html: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source_material_status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="missing",
    )
    source_summary_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    accepted: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
