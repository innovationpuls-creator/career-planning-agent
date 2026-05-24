from __future__ import annotations

from sqlalchemy import inspect

from app.db.session import engine
from app.models.growth_workbench import (
    GrowthGapDiagnosis,
    GrowthReportVersion,
    GrowthResumeVersion,
    GrowthTargetDiagnosis,
    GrowthWorkbenchTask,
)
from app.schemas.growth_workbench import (
    GrowthWorkbenchAggregatePayload,
    GrowthWorkbenchTaskCreateRequest,
)


def test_growth_workbench_tables_exist():
    GrowthWorkbenchTask.__table__.create(bind=engine, checkfirst=True)
    GrowthTargetDiagnosis.__table__.create(bind=engine, checkfirst=True)
    GrowthGapDiagnosis.__table__.create(bind=engine, checkfirst=True)
    GrowthReportVersion.__table__.create(bind=engine, checkfirst=True)
    GrowthResumeVersion.__table__.create(bind=engine, checkfirst=True)

    tables = set(inspect(engine).get_table_names())

    assert "growth_workbench_tasks" in tables
    assert "growth_target_diagnoses" in tables
    assert "growth_gap_diagnoses" in tables
    assert "growth_report_versions" in tables
    assert "growth_resume_versions" in tables


def test_growth_workbench_schema_accepts_full_queue_request():
    body = GrowthWorkbenchTaskCreateRequest(
        favorite_id=1,
        task_type="full_queue",
        run_mode="full_queue",
    )

    assert body.favorite_id == 1
    assert body.task_type == "full_queue"
    assert body.run_mode == "full_queue"


def test_growth_workbench_aggregate_schema_has_required_sections():
    payload = GrowthWorkbenchAggregatePayload(
        target_summary={"favorite_id": 1, "title": "前端工程师"},
        prerequisites=[],
        task_queue=[],
        latest_diagnoses={},
        report_versions=[],
        resume_versions=[],
        evidence_sources=[],
        existing_report_workspace=None,
    )

    assert payload.target_summary["title"] == "前端工程师"
    assert payload.report_versions == []
