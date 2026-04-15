from io import BytesIO

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.job_posting import JobPosting

from .helpers import get_auth_headers


client = TestClient(app)


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
