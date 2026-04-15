import json
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.job_posting import JobPosting
from app.models.job_requirement_profile import JobRequirementProfile
from tests.helpers import get_auth_headers


def create_test_client(tmp_path: Path) -> tuple[TestClient, sessionmaker]:
    db_path = tmp_path / "comparison_api.db"
    engine = create_engine(f"sqlite:///{db_path.as_posix()}", connect_args={"check_same_thread": False})
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app), testing_session_local


def seed_data(session: Session) -> None:
    session.add_all(
        [
            JobPosting(
                industry="互联网",
                job_title="Java",
                address=None,
                salary_range=None,
                company_name="甲公司",
                company_size=None,
                company_type=None,
                job_detail="熟练使用 Java。",
                company_detail=None,
            ),
            JobPosting(
                industry="互联网",
                job_title="Java",
                address=None,
                salary_range=None,
                company_name="甲公司",
                company_size=None,
                company_type=None,
                job_detail="本科及以上学历，计算机相关专业。",
                company_detail=None,
            ),
            JobPosting(
                industry="互联网",
                job_title="前端开发",
                address=None,
                salary_range=None,
                company_name="乙公司",
                company_size=None,
                company_type=None,
                job_detail=None,
                company_detail=None,
            ),
            JobRequirementProfile(
                industry="互联网",
                job_title="Java",
                company_name="甲公司",
                professional_skills=json.dumps(["Java"], ensure_ascii=False),
                professional_background=json.dumps(["计算机相关专业"], ensure_ascii=False),
                education_requirement=json.dumps(["本科及以上学历"], ensure_ascii=False),
                teamwork=json.dumps(["无明确要求"], ensure_ascii=False),
                stress_adaptability=json.dumps(["无明确要求"], ensure_ascii=False),
                communication=json.dumps(["沟通能力"], ensure_ascii=False),
                work_experience=json.dumps(["2年以上经验"], ensure_ascii=False),
                documentation_awareness=json.dumps(["无明确要求"], ensure_ascii=False),
                responsibility=json.dumps(["责任心强"], ensure_ascii=False),
                learning_ability=json.dumps(["学习能力"], ensure_ascii=False),
                problem_solving=json.dumps(["解决问题能力"], ensure_ascii=False),
            ),
            JobRequirementProfile(
                industry="互联网",
                job_title="前端开发",
                company_name="乙公司",
                professional_skills=json.dumps(["无明确要求"], ensure_ascii=False),
                professional_background=json.dumps(["无明确要求"], ensure_ascii=False),
                education_requirement=json.dumps(["无明确要求"], ensure_ascii=False),
                teamwork=json.dumps(["无明确要求"], ensure_ascii=False),
                stress_adaptability=json.dumps(["无明确要求"], ensure_ascii=False),
                communication=json.dumps(["无明确要求"], ensure_ascii=False),
                work_experience=json.dumps(["无明确要求"], ensure_ascii=False),
                documentation_awareness=json.dumps(["无明确要求"], ensure_ascii=False),
                responsibility=json.dumps(["无明确要求"], ensure_ascii=False),
                learning_ability=json.dumps(["无明确要求"], ensure_ascii=False),
                problem_solving=json.dumps(["无明确要求"], ensure_ascii=False),
            ),
        ]
    )
    session.commit()


def test_list_job_requirement_comparisons_returns_paginated_data(tmp_path: Path):
    client, session_local = create_test_client(tmp_path)
    with session_local() as session:
        seed_data(session)

    response = client.get(
        "/api/job-requirement-comparisons",
        params={"current": 1, "pageSize": 1},
        headers=get_auth_headers(client, "admin"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["current"] == 1
    assert payload["pageSize"] == 1
    assert payload["total"] == 2
    assert len(payload["data"]) == 1
    assert "job_detail_count" in payload["data"][0]
    assert "non_default_dimension_count" in payload["data"][0]
    app.dependency_overrides.clear()


def test_list_job_requirement_comparisons_supports_filters(tmp_path: Path):
    client, session_local = create_test_client(tmp_path)
    with session_local() as session:
        seed_data(session)

    response = client.get(
        "/api/job-requirement-comparisons",
        params=[("industry", "互联网"), ("job_title", "Java"), ("company_name", "甲"), ("pageSize", "20")],
        headers=get_auth_headers(client, "admin"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["data"][0]["job_title"] == "Java"
    assert payload["data"][0]["company_name"] == "甲公司"
    assert payload["data"][0]["job_detail_count"] == 2
    assert payload["data"][0]["non_default_dimension_count"] == 8
    app.dependency_overrides.clear()


def test_get_job_requirement_comparison_returns_merged_detail_and_dimensions(tmp_path: Path):
    client, session_local = create_test_client(tmp_path)
    with session_local() as session:
        seed_data(session)

    response = client.get(
        "/api/job-requirement-comparisons/1",
        headers=get_auth_headers(client, "admin"),
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["industry"] == "互联网"
    assert payload["job_title"] == "Java"
    assert payload["company_name"] == "甲公司"
    assert payload["job_detail_count"] == 2
    assert payload["merged_job_detail"] == "熟练使用 Java。\n\n-----\n\n本科及以上学历，计算机相关专业。"
    assert payload["professional_skills"] == ["Java"]
    assert payload["education_requirement"] == ["本科及以上学历"]
    assert payload["responsibility"] == ["责任心强"]
    app.dependency_overrides.clear()


def test_job_requirement_comparisons_reject_standard_user(tmp_path: Path):
    client, session_local = create_test_client(tmp_path)
    with session_local() as session:
        seed_data(session)

    response = client.get(
        "/api/job-requirement-comparisons",
        params={"current": 1, "pageSize": 1},
        headers=get_auth_headers(client, "user"),
    )

    assert response.status_code == 403
    app.dependency_overrides.clear()


def test_get_job_requirement_comparison_allows_standard_user(tmp_path: Path):
    client, session_local = create_test_client(tmp_path)
    with session_local() as session:
        seed_data(session)

    response = client.get(
        "/api/job-requirement-comparisons/1",
        headers=get_auth_headers(client, "user"),
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["id"] == 1
    assert payload["job_title"] == "Java"
    app.dependency_overrides.clear()
