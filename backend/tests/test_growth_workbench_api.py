from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import inspect, select

from app.db.session import SessionLocal, engine
from app.main import app
from app.models.career_development_favorite_report import CareerDevelopmentFavoriteReport
from app.models.career_development_personal_growth_report_task import (
    CareerDevelopmentPersonalGrowthReportTask,
)
from app.models.career_development_plan_workspace import CareerDevelopmentPlanWorkspace
from app.models.growth_workbench import (
    GrowthGapDiagnosis,
    GrowthReportVersion,
    GrowthResumeVersion,
    GrowthTargetDiagnosis,
    GrowthWorkbenchTask,
)
from app.models.student_competency_user_latest_profile import StudentCompetencyUserLatestProfile
from app.models.student_profile import StudentProfile
from app.models.student_profile_attachment import StudentProfileAttachment
from app.models.user import User
from app.schemas.growth_workbench import (
    GrowthWorkbenchAggregatePayload,
    GrowthWorkbenchTaskCreateRequest,
)
from app.services.growth_workbench import build_growth_workbench_payload
from tests.helpers import unique_username

CareerDevelopmentFavoriteReport.__table__.create(bind=engine, checkfirst=True)
CareerDevelopmentPersonalGrowthReportTask.__table__.create(bind=engine, checkfirst=True)
CareerDevelopmentPlanWorkspace.__table__.create(bind=engine, checkfirst=True)
GrowthWorkbenchTask.__table__.create(bind=engine, checkfirst=True)
GrowthTargetDiagnosis.__table__.create(bind=engine, checkfirst=True)
GrowthGapDiagnosis.__table__.create(bind=engine, checkfirst=True)
GrowthReportVersion.__table__.create(bind=engine, checkfirst=True)
GrowthResumeVersion.__table__.create(bind=engine, checkfirst=True)
StudentCompetencyUserLatestProfile.__table__.create(bind=engine, checkfirst=True)
StudentProfile.__table__.create(bind=engine, checkfirst=True)
StudentProfileAttachment.__table__.create(bind=engine, checkfirst=True)
User.__table__.create(bind=engine, checkfirst=True)

client = TestClient(app)
UTC = timezone.utc


def _register_and_login() -> tuple[dict[str, str], int]:
    username = unique_username("growth-workbench")
    password = "strongpass123"
    register = client.post("/api/register", json={"username": username, "password": password})
    assert register.status_code == 200
    login = client.post(
        "/api/login/account",
        json={"username": username, "password": password, "type": "account"},
    )
    assert login.status_code == 200
    token = login.json()["token"]
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        assert user is not None
        return {"Authorization": f"Bearer {token}"}, user.id


def _seed_student_profile(user_id: int) -> None:
    with SessionLocal() as db:
        db.add(
            StudentProfile(
                user_id=user_id,
                full_name="测试同学",
                school="示例大学",
                major="软件工程",
                education_level="本科",
                grade="大三",
                target_job_title="前端工程师",
                current_stage="low",
            )
        )
        db.commit()


def _seed_latest_competency_analysis(user_id: int) -> None:
    with SessionLocal() as db:
        db.add(
            StudentCompetencyUserLatestProfile(
                user_id=user_id,
                latest_workspace_conversation_id="growth-workbench-analysis",
                latest_profile_json=json.dumps(
                    {"communication": ["可以清晰描述项目职责"]},
                    ensure_ascii=False,
                ),
                latest_analysis_json=json.dumps(
                    {
                        "available": True,
                        "message": "画像可用",
                        "workspace_conversation_id": "growth-workbench-analysis",
                        "profile": {"communication": ["可以清晰描述项目职责"]},
                        "comparison_dimensions": [
                            {
                                "key": "communication",
                                "title": "沟通表达",
                                "user_values": ["可以清晰描述项目职责"],
                                "market_keywords": ["跨团队协作", "需求澄清"],
                                "market_weight": 0.8,
                                "normalized_weight": 0.8,
                                "market_target": 78,
                                "user_readiness": 62,
                                "gap": 16,
                                "presence": 1,
                                "richness": 0.7,
                                "status_label": "需补强",
                                "matched_market_keywords": ["需求澄清"],
                                "missing_market_keywords": ["跨团队协作"],
                                "coverage_score": 0.65,
                                "alignment_score": 0.6,
                            }
                        ],
                        "chart_series": [],
                        "strength_dimensions": ["communication"],
                        "priority_gap_dimensions": ["teamwork"],
                        "recommended_keywords": {},
                        "action_advices": [],
                    },
                    ensure_ascii=False,
                ),
            )
        )
        db.commit()


def _seed_favorite_and_workspace(user_id: int) -> int:
    with SessionLocal() as db:
        favorite = CareerDevelopmentFavoriteReport(
            user_id=user_id,
            source_kind="recommendation",
            report_id="career:frontend",
            target_scope="career",
            target_title="前端工程师",
            canonical_job_title="前端工程师",
            normalized_canonical_job_title="前端工程师",
            representative_job_title="前端开发",
            industry="互联网",
            normalized_industry="互联网",
            overall_match=80.0,
            report_snapshot_json=json.dumps(
                {
                    "report_id": "career:frontend",
                    "target_scope": "career",
                    "target_title": "前端工程师",
                    "canonical_job_title": "前端工程师",
                    "representative_job_title": "前端开发",
                    "industry": "互联网",
                    "overall_match": 80.0,
                    "strength_dimension_count": 1,
                    "priority_gap_dimension_count": 1,
                    "group_summaries": [],
                    "comparison_dimensions": [],
                    "priority_gap_dimensions": ["communication"],
                    "action_advices": [],
                },
                ensure_ascii=False,
            ),
        )
        db.add(favorite)
        db.commit()
        db.refresh(favorite)
        favorite_id = favorite.id
        workspace = CareerDevelopmentPlanWorkspace(
            user_id=user_id,
            favorite_id=favorite_id,
            generated_plan_json=json.dumps({"growth_plan_phases": []}, ensure_ascii=False),
            current_plan_json=json.dumps({"growth_plan_phases": []}, ensure_ascii=False),
            personal_growth_report_edited_markdown="## 自我认知\n具备基础开发能力。",
            personal_growth_report_current_payload_json=json.dumps(
                {
                    "sections": [
                        {
                            "key": "self_cognition",
                            "title": "自我认知",
                            "content": "具备基础开发能力。",
                            "completed": True,
                        }
                    ]
                },
                ensure_ascii=False,
            ),
            personal_growth_report_last_generated_at=datetime.now(UTC),
        )
        db.add(workspace)
        db.commit()
        return favorite_id


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


def test_growth_workbench_aggregate_includes_evidence_sources():
    headers, user_id = _register_and_login()
    del headers
    _seed_student_profile(user_id)
    _seed_latest_competency_analysis(user_id)
    favorite_id = _seed_favorite_and_workspace(user_id)

    with SessionLocal() as db:
        payload = build_growth_workbench_payload(db, user_id=user_id, favorite_id=favorite_id)

    evidence_keys = {item.key for item in payload.evidence_sources}
    assert payload.target_summary["favorite_id"] == favorite_id
    assert "profile" in evidence_keys
    assert "competency" in evidence_keys
    assert "learning_path" in evidence_keys
    assert "report" in evidence_keys
