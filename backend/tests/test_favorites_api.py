from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.session import SessionLocal, engine
from app.main import app
from app.models.career_development_favorite_report import CareerDevelopmentFavoriteReport
from app.models.student_competency_user_latest_profile import StudentCompetencyUserLatestProfile
from app.models.student_profile import StudentProfile
from app.models.user import User
from app.schemas.career_development_report import (
    CareerDevelopmentMatchGroupSummary,
    CareerDevelopmentMatchReport,
)
from app.schemas.student_competency_profile import StudentCompetencyComparisonDimensionItem
from tests.helpers import unique_username


CareerDevelopmentFavoriteReport.__table__.create(bind=engine, checkfirst=True)
StudentCompetencyUserLatestProfile.__table__.create(bind=engine, checkfirst=True)
StudentProfile.__table__.create(bind=engine, checkfirst=True)

client = TestClient(app)


def _register_and_login() -> tuple[dict[str, str], int]:
    username = unique_username("fav-api")
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


def _seed_profile_and_analysis(user_id: int) -> None:
    with SessionLocal() as db:
        db.add(
            StudentProfile(
                user_id=user_id,
                full_name="张三",
                school="清华大学",
                major="计算机",
                education_level="本科",
                grade="大三",
                target_job_title="后端开发",
                current_stage="low",
            )
        )
        db.commit()

    with SessionLocal() as db:
        db.add(
            StudentCompetencyUserLatestProfile(
                user_id=user_id,
                latest_workspace_conversation_id="conv-1",
                latest_profile_json='{"communication": ["团队协作"]}',
                latest_analysis_json='{"available": true, "comparison_dimensions": [], "chart_series": [], "strength_dimensions": [], "priority_gap_dimensions": [], "action_advices": []}',
            )
        )
        db.commit()


def _seed_report_cache(user_id: int, report_id: str) -> None:
    """Seed a match report into the cache so it can be looked up by report_id."""
    from app.models.career_match_report_cache import CareerMatchReportCache
    import json

    CareerMatchReportCache.__table__.create(bind=engine, checkfirst=True)

    report = CareerDevelopmentMatchReport(
        report_id=report_id,
        target_scope="career",
        target_title="后端开发工程师",
        canonical_job_title="后端开发工程师",
        representative_job_title="后端开发",
        industry="互联网",
        overall_match=82,
        strength_dimension_count=1,
        priority_gap_dimension_count=1,
        group_summaries=[
            CareerDevelopmentMatchGroupSummary(
                group_key="execution",
                label="执行力",
                match_score=82,
                target_requirement=88,
                gap=6,
                status_label="中等差距",
                dimension_keys=["communication"],
            )
        ],
        comparison_dimensions=[
            StudentCompetencyComparisonDimensionItem(
                key="communication",
                title="沟通能力",
                user_values=["团队协作"],
                market_keywords=["跨团队沟通", "文档撰写"],
                market_weight=0.8,
                normalized_weight=0.8,
                market_target=78,
                user_readiness=62,
                gap=16,
                presence=1,
                richness=0.7,
                status_label="中等差距",
                matched_market_keywords=["团队协作"],
                missing_market_keywords=["跨团队沟通"],
                coverage_score=0.65,
                alignment_score=0.6,
            )
        ],
        priority_gap_dimensions=["communication"],
        action_advices=[],
    )
    with SessionLocal() as db:
        db.add(
            CareerMatchReportCache(
                user_id=user_id,
                report_id=report_id,
                report_json=json.dumps(report.model_dump(mode="json"), ensure_ascii=False),
            )
        )
        db.commit()


# ─────────────────────────────────────────────────────────────
# Tests: Create favorite with report_id (simplified API)
# ─────────────────────────────────────────────────────────────


def test_create_favorite_with_report_id_only():
    """收藏创建接口支持只传 report_id，后端自动从缓存查找完整数据。"""
    from uuid import uuid4

    headers, user_id = _register_and_login()
    _seed_profile_and_analysis(user_id)

    report_id = f"career:backend-dev-{uuid4()}"
    _seed_report_cache(user_id, report_id)

    response = client.post(
        "/api/career-development-report/favorites",
        headers=headers,
        json={
            "source_kind": "recommendation",
            "report_id": report_id,
        },
    )
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.json()}"
    data = response.json()["data"]
    assert data["report_id"] == report_id
    assert data["target_title"] == "后端开发工程师"
    assert data["overall_match"] == 82
    # report_snapshot should be populated from cache
    assert data["report_snapshot"]["report_id"] == report_id


def test_create_favorite_with_full_report_still_works():
    """保留完整 report 对象的创建方式，确保向后兼容。"""
    headers, user_id = _register_and_login()
    _seed_profile_and_analysis(user_id)

    report = CareerDevelopmentMatchReport(
        report_id="career:frontend-legacy",
        target_scope="career",
        target_title="前端工程师",
        canonical_job_title="前端工程师",
        representative_job_title="前端",
        industry="互联网",
        overall_match=75,
        strength_dimension_count=0,
        priority_gap_dimension_count=2,
        comparison_dimensions=[
            StudentCompetencyComparisonDimensionItem(
                key="communication",
                title="沟通能力",
                user_values=["团队协作"],
                market_keywords=["跨团队沟通"],
                market_weight=0.8,
                normalized_weight=0.8,
                market_target=78,
                user_readiness=62,
                gap=16,
                presence=1,
                richness=0.7,
                status_label="中等差距",
                matched_market_keywords=["团队协作"],
                missing_market_keywords=["跨团队沟通"],
                coverage_score=0.65,
                alignment_score=0.6,
            )
        ],
        priority_gap_dimensions=["communication"],
        action_advices=[],
    )

    response = client.post(
        "/api/career-development-report/favorites",
        headers=headers,
        json={
            "source_kind": "recommendation",
            "report": report.model_dump(mode="json"),
        },
    )
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.json()}"
    data = response.json()["data"]
    assert data["report_id"] == "career:frontend-legacy"
    assert data["target_title"] == "前端工程师"


def test_create_favorite_requires_report_id_or_report():
    """既不传 report_id 也不传 report 时，应返回 422 验证错误。"""
    headers, user_id = _register_and_login()
    _seed_profile_and_analysis(user_id)

    response = client.post(
        "/api/career-development-report/favorites",
        headers=headers,
        json={"source_kind": "recommendation"},
    )
    assert response.status_code == 422, f"Expected 422, got {response.status_code}"


def test_create_favorite_report_id_not_found():
    """传了 report_id 但缓存中不存在时，应返回 404。"""
    headers, user_id = _register_and_login()
    _seed_profile_and_analysis(user_id)

    response = client.post(
        "/api/career-development-report/favorites",
        headers=headers,
        json={
            "source_kind": "recommendation",
            "report_id": "career:nonexistent-12345",
        },
    )
    assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.json()}"
