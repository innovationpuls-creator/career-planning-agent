from io import BytesIO
import json
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.session import SessionLocal, engine
from app.main import app
from app.models.career_development_favorite_report import CareerDevelopmentFavoriteReport
from app.models.career_development_plan_workspace import CareerDevelopmentPlanWorkspace
from app.models.job_posting import JobPosting
from app.models.student_competency_user_latest_profile import StudentCompetencyUserLatestProfile
from app.models.user import User

from .helpers import get_auth_headers, unique_username


client = TestClient(app)
UTC = timezone.utc

CareerDevelopmentFavoriteReport.__table__.create(bind=engine, checkfirst=True)
CareerDevelopmentPlanWorkspace.__table__.create(bind=engine, checkfirst=True)
StudentCompetencyUserLatestProfile.__table__.create(bind=engine, checkfirst=True)


def _seed_job_posting(job_title: str = "Java") -> None:
    with SessionLocal() as db:
        exists = db.query(JobPosting).filter(JobPosting.job_title == job_title).first()
        if exists:
            return
        db.add_all(
            [
                JobPosting(
                    industry="互联网",
                    job_title=job_title,
                    company_name="甲公司",
                    salary_range="1.5-2.5万·13薪",
                    address="上海",
                    company_size="500-999人",
                    company_type="民营公司",
                ),
                JobPosting(
                    industry="计算机软件",
                    job_title=job_title,
                    company_name="乙公司",
                    salary_range="9000-18000元",
                    address="苏州",
                    company_size="100-499人",
                    company_type="上市公司",
                ),
            ]
        )
        db.commit()


def _register_and_login() -> tuple[dict[str, str], int]:
    username = unique_username("home-v2")
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


def _seed_latest_analysis(user_id: int) -> None:
    with SessionLocal() as db:
        db.add(
            StudentCompetencyUserLatestProfile(
                user_id=user_id,
                latest_workspace_conversation_id="home-v2-analysis",
                latest_profile_json=json.dumps({"communication": ["项目沟通"]}, ensure_ascii=False),
                latest_analysis_json=json.dumps(
                    {
                        "available": True,
                        "comparison_dimensions": [],
                        "chart_series": [],
                        "strength_dimensions": [],
                        "priority_gap_dimensions": [],
                        "action_advices": [],
                    },
                    ensure_ascii=False,
                ),
            )
        )
        db.commit()


def _seed_favorite_and_workspace(
    user_id: int,
    *,
    with_workspace: bool = False,
    with_growth_report: bool = False,
) -> int:
    with SessionLocal() as db:
        favorite = CareerDevelopmentFavoriteReport(
            user_id=user_id,
            source_kind="recommendation",
            report_id="career:java-dev",
            target_scope="career",
            target_title="Java 开发",
            canonical_job_title="Java 开发",
            normalized_canonical_job_title="java 开发",
            representative_job_title="Java 开发工程师",
            industry="互联网",
            normalized_industry="互联网",
            overall_match=86,
            report_snapshot_json="{}",
        )
        db.add(favorite)
        db.commit()
        db.refresh(favorite)
        favorite_id = favorite.id
        if with_workspace:
            workspace = CareerDevelopmentPlanWorkspace(
                user_id=user_id,
                favorite_id=favorite_id,
                generated_plan_json="{}",
                current_plan_json="{}",
                personal_growth_report_last_generated_at=datetime.now(UTC)
                if with_growth_report
                else None,
                personal_growth_report_current_payload_json=json.dumps(
                    {"sections": [{"key": "self_cognition"}]},
                    ensure_ascii=False,
                )
                if with_growth_report
                else "{}",
            )
            db.add(workspace)
            db.commit()
        return favorite_id


def test_user_profile_onboarding_and_home_v2_flow():
    _seed_job_posting()
    headers = get_auth_headers(client, role="user")

    response = client.post(
        "/api/user-profile/onboarding",
        headers=headers,
        data={
            "full_name": "张三",
            "school": "测试大学",
            "major": "计算机科学",
            "education_level": "本科",
            "grade": "大三",
            "target_job_title": "Java",
        },
        files=[("image_files", ("resume.png", BytesIO(b"fake-image").read(), "image/png"))],
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["onboarding_completed"] is True
    assert payload["current_stage"] == "low"
    assert payload["profile"]["full_name"] == "张三"
    assert payload["vertical_profile"]["job_title"] == "Java"
    assert payload["attachments"][0]["original_name"] == "resume.png"

    home_response = client.get("/api/home-v2", headers=headers)
    assert home_response.status_code == 200
    home_payload = home_response.json()["data"]
    assert home_payload["onboarding_completed"] is True
    assert home_payload["current_stage"] == "low"
    assert home_payload["profile"]["target_job_title"] == "Java"
    assert home_payload["vertical_profile"]["tiered_comparison"]["tiers"][0]["level"] == "高级"
    assert home_payload["planning_progress"]["completion_percent"] == 20
    assert home_payload["planning_progress"]["next_action"]["button_text"] == "去解析简历"
    assert [item["status"] for item in home_payload["planning_progress"]["steps"]][:2] == [
        "done",
        "current",
    ]


def test_home_v2_planning_progress_without_profile():
    headers = get_auth_headers(client, role="user")

    response = client.get("/api/home-v2", headers=headers)

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["onboarding_completed"] is False
    assert payload["planning_progress"]["completion_percent"] == 0
    assert payload["planning_progress"]["steps"][0]["status"] == "current"
    assert payload["planning_progress"]["next_action"]["button_text"] == "完善资料"


def test_home_v2_planning_progress_with_analysis_favorite_workspace_and_report():
    _seed_job_posting()
    headers, user_id = _register_and_login()
    onboarding = client.post(
        "/api/user-profile/onboarding",
        headers=headers,
        data={
            "full_name": "赵六",
            "school": "测试大学",
            "major": "软件工程",
            "education_level": "本科",
            "grade": "大三",
            "target_job_title": "Java",
        },
    )
    assert onboarding.status_code == 200
    _seed_latest_analysis(user_id)
    favorite_id = _seed_favorite_and_workspace(
        user_id,
        with_workspace=True,
        with_growth_report=True,
    )

    response = client.get("/api/home-v2", headers=headers)

    assert response.status_code == 200
    payload = response.json()["data"]["planning_progress"]
    assert payload["completion_percent"] == 100
    assert payload["active_target"]["favorite_id"] == favorite_id
    assert payload["active_target"]["overall_match"] == 86
    assert all(item["status"] == "done" for item in payload["steps"])
    assert payload["next_action"]["button_text"] == "继续学习"
    assert payload["next_action"]["href"] == f"/snail-learning-path?favorite_id={favorite_id}"


def test_user_profile_onboarding_rejects_non_image_upload():
    headers = get_auth_headers(client, role="user")

    response = client.post(
        "/api/user-profile/onboarding",
        headers=headers,
        data={
            "full_name": "李四",
            "school": "测试大学",
            "major": "软件工程",
            "education_level": "本科",
            "grade": "大四",
            "target_job_title": "Java",
        },
        files=[("image_files", ("resume.pdf", BytesIO(b"fake-pdf").read(), "application/pdf"))],
    )

    assert response.status_code == 400
    assert "must be a jpg, jpeg, png, or webp image" in response.json()["detail"]


def test_user_profile_onboarding_preserves_existing_attachments_when_editing_without_new_files():
    _seed_job_posting()
    headers = get_auth_headers(client, role="user")

    first_response = client.post(
        "/api/user-profile/onboarding",
        headers=headers,
        data={
            "full_name": "王五",
            "school": "测试大学",
            "major": "软件工程",
            "education_level": "本科",
            "grade": "大三",
            "target_job_title": "Java",
        },
        files=[("image_files", ("resume.png", BytesIO(b"fake-image").read(), "image/png"))],
    )
    assert first_response.status_code == 200
    assert len(first_response.json()["data"]["attachments"]) == 1

    second_response = client.post(
        "/api/user-profile/onboarding",
        headers=headers,
        data={
            "full_name": "王五",
            "school": "测试大学",
            "major": "软件工程",
            "education_level": "本科",
            "grade": "大四",
            "target_job_title": "Java",
        },
    )

    assert second_response.status_code == 200
    payload = second_response.json()["data"]
    assert payload["profile"]["grade"] == "大四"
    assert len(payload["attachments"]) == 1
    assert payload["attachments"][0]["original_name"] == "resume.png"
