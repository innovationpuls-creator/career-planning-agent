from __future__ import annotations

import json
from datetime import datetime, timezone
from io import BytesIO

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.session import SessionLocal, engine
from app.main import app
from app.models.career_development_favorite_report import CareerDevelopmentFavoriteReport
from app.models.career_development_plan_workspace import CareerDevelopmentPlanWorkspace
from app.models.student_competency_user_latest_profile import StudentCompetencyUserLatestProfile
from app.models.student_profile import StudentProfile
from app.models.user import User
from app.schemas.career_development_report import (
    CareerDevelopmentMatchGroupSummary,
    CareerDevelopmentMatchReport,
)
from app.schemas.student_competency_profile import StudentCompetencyComparisonDimensionItem
from app.services import snail_learning_path_review as review_service
from tests.helpers import unique_username


CareerDevelopmentFavoriteReport.__table__.create(bind=engine, checkfirst=True)
CareerDevelopmentPlanWorkspace.__table__.create(bind=engine, checkfirst=True)
StudentCompetencyUserLatestProfile.__table__.create(bind=engine, checkfirst=True)
StudentProfile.__table__.create(bind=engine, checkfirst=True)

client = TestClient(app)
UTC = timezone.utc


class FakeLLMClient:
    async def chat_completion(self, messages, *, temperature=0.0):
        del messages, temperature
        return json.dumps(
            {
                "headline": "??????",
                "focus_keywords": ["??", "React"],
                "progress_assessment": "????????????",
                "progress_keywords": ["???"],
                "goal_gap_summary": "???????????",
                "gap_keywords": ["????"],
                "highlights": ["?? React ????"],
                "blockers": [],
                "next_action": "???????????",
                "action_keywords": ["????"],
            },
            ensure_ascii=False,
        )

    async def aclose(self):
        return None


def _register_and_login() -> tuple[dict[str, str], int]:
    username = unique_username("snail-path")
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
                full_name="????",
                school="????",
                major="????",
                education_level="??",
                grade="??",
                target_job_title="?????",
                current_stage="low",
            )
        )
        db.commit()


def _seed_latest_competency_analysis(user_id: int) -> None:
    comparison = StudentCompetencyComparisonDimensionItem(
        key="communication",
        title="????",
        user_values=["??????????"],
        market_keywords=["?????", "????"],
        market_weight=0.8,
        normalized_weight=0.8,
        market_target=78,
        user_readiness=62,
        gap=16,
        presence=1,
        richness=0.7,
        status_label="???",
        matched_market_keywords=["????"],
        missing_market_keywords=["?????"],
        coverage_score=0.65,
        alignment_score=0.6,
    )
    with SessionLocal() as db:
        db.add(
            StudentCompetencyUserLatestProfile(
                user_id=user_id,
                latest_workspace_conversation_id="conv-1",
                latest_profile_json=json.dumps({"communication": ["??????????"]}, ensure_ascii=False),
                latest_analysis_json=json.dumps(
                    {
                        "available": True,
                        "message": "????",
                        "workspace_conversation_id": "conv-1",
                        "profile": {"communication": ["??????????"]},
                        "comparison_dimensions": [comparison.model_dump(mode="json")],
                        "chart_series": [],
                        "strength_dimensions": ["communication"],
                        "priority_gap_dimensions": ["communication"],
                        "recommended_keywords": {},
                        "action_advices": [],
                    },
                    ensure_ascii=False,
                ),
            )
        )
        db.commit()


def _seed_favorite(user_id: int) -> int:
    report = CareerDevelopmentMatchReport(
        report_id="career:frontend",
        target_scope="career",
        target_title="?????",
        canonical_job_title="?????",
        representative_job_title="????",
        industry="???",
        overall_match=82,
        strength_dimension_count=1,
        priority_gap_dimension_count=1,
        group_summaries=[
            CareerDevelopmentMatchGroupSummary(
                group_key="execution",
                label="?????",
                match_score=82,
                target_requirement=88,
                gap=6,
                status_label="???",
                dimension_keys=["communication"],
            )
        ],
        comparison_dimensions=[
            StudentCompetencyComparisonDimensionItem(
                key="communication",
                title="????",
                user_values=["??????????"],
                market_keywords=["?????", "????"],
                market_weight=0.8,
                normalized_weight=0.8,
                market_target=78,
                user_readiness=62,
                gap=16,
                presence=1,
                richness=0.7,
                status_label="???",
                matched_market_keywords=["????"],
                missing_market_keywords=["?????"],
                coverage_score=0.65,
                alignment_score=0.6,
            )
        ],
        priority_gap_dimensions=["communication"],
        action_advices=[],
    )
    with SessionLocal() as db:
        favorite = CareerDevelopmentFavoriteReport(
            user_id=user_id,
            source_kind="recommendation",
            report_id=report.report_id,
            target_scope=report.target_scope,
            target_title=report.target_title,
            canonical_job_title=report.canonical_job_title,
            normalized_canonical_job_title=report.canonical_job_title,
            representative_job_title=report.representative_job_title,
            industry=report.industry,
            normalized_industry=report.industry or "",
            overall_match=report.overall_match,
            report_snapshot_json=json.dumps(report.model_dump(mode="json"), ensure_ascii=False),
        )
        db.add(favorite)
        db.commit()
        db.refresh(favorite)
        return favorite.id


def test_snail_learning_path_initialize_requires_authentication():
    response = client.post("/api/snail-learning-path/workspaces/1")
    assert response.status_code == 401


def test_snail_learning_path_legacy_transient_endpoint_is_rejected():
    headers, _ = _register_and_login()
    response = client.post("/api/snail-learning-path/workspaces", headers=headers, json={})
    assert response.status_code == 400
    assert "favorite_id" in response.json()["detail"]


def test_snail_learning_path_initialize_requires_profile():
    headers, user_id = _register_and_login()
    favorite_id = _seed_favorite(user_id)

    response = client.post(f"/api/snail-learning-path/workspaces/{favorite_id}", headers=headers)

    assert response.status_code == 400
    assert "我的资料" in response.json()["detail"]


def test_snail_learning_path_initialize_requires_latest_analysis():
    headers, user_id = _register_and_login()
    _seed_student_profile(user_id)
    favorite_id = _seed_favorite(user_id)

    response = client.post(f"/api/snail-learning-path/workspaces/{favorite_id}", headers=headers)

    assert response.status_code == 400
    assert "12 维解析" in response.json()["detail"]


def test_snail_learning_path_initialize_blocks_cross_user_access():
    owner_headers, owner_id = _register_and_login()
    _seed_student_profile(owner_id)
    _seed_latest_competency_analysis(owner_id)
    favorite_id = _seed_favorite(owner_id)

    other_headers, _ = _register_and_login()
    response = client.post(f"/api/snail-learning-path/workspaces/{favorite_id}", headers=other_headers)

    assert response.status_code == 404
    assert "不属于当前登录用户" in response.json()["detail"]

    owner_response = client.post(f"/api/snail-learning-path/workspaces/{favorite_id}", headers=owner_headers)
    assert owner_response.status_code == 200


def test_initialize_and_review_snail_learning_path(monkeypatch):
    monkeypatch.setattr(
        review_service.OpenAICompatibleLLMClient,
        "from_settings",
        classmethod(lambda cls: FakeLLMClient()),
    )

    headers, user_id = _register_and_login()
    _seed_student_profile(user_id)
    _seed_latest_competency_analysis(user_id)
    favorite_id = _seed_favorite(user_id)

    workspace_response = client.post(
        f"/api/snail-learning-path/workspaces/{favorite_id}",
        headers=headers,
    )
    assert workspace_response.status_code == 200
    workspace = workspace_response.json()["data"]
    assert workspace["favorite"]["favorite_id"] == favorite_id
    assert workspace["growth_plan_phases"]

    workspace_id = workspace["workspace_id"]
    report_snapshot = workspace["favorite"]["report_snapshot"]
    review_response = client.post(
        f"/api/snail-learning-path/workspaces/{workspace_id}/reviews",
        headers=headers,
        data={
            "review_type": "weekly",
            "phase_key": "short_term",
            "checked_resource_urls": json.dumps(["https://react.dev/learn"], ensure_ascii=False),
            "user_prompt": "????? React ?????",
            "report_snapshot": json.dumps(report_snapshot, ensure_ascii=False),
            "completed_module_count": "1",
            "total_module_count": "2",
            "phase_progress_percent": "50",
        },
        files=[("files", ("notes.md", BytesIO(b"# notes\\nreact").read(), "text/markdown"))],
    )
    assert review_response.status_code == 200
    assert review_response.json()["data"]["review_type"] == "weekly"

    list_response = client.get(
        f"/api/snail-learning-path/workspaces/{workspace_id}/reviews",
        headers=headers,
        params={"phase_key": "short_term"},
    )
    assert list_response.status_code == 200
    assert len(list_response.json()["data"]) == 1
