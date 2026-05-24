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
