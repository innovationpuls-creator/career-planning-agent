from __future__ import annotations

import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def unique_username(prefix: str = "user") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def get_admin_headers() -> dict[str, str]:
    resp = client.post(
        "/api/login/account",
        json={"username": "admin", "password": "123456", "type": "account"},
    )
    assert resp.status_code == 200
    token = resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def get_user_headers() -> dict[str, str]:
    username = unique_username("user")
    password = "strongpass123"
    client.post("/api/register", json={"username": username, "password": password})
    resp = client.post(
        "/api/login/account",
        json={"username": username, "password": password, "type": "account"},
    )
    assert resp.status_code == 200
    token = resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}


# ─── Major Distribution ───────────────────────────────────────────────────────

def test_major_distribution_returns_success():
    resp = client.get(
        "/api/admin/data-dashboard/major-distribution", headers=get_admin_headers()
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["success"] is True


def test_major_distribution_returns_required_fields():
    resp = client.get(
        "/api/admin/data-dashboard/major-distribution", headers=get_admin_headers()
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert "total_users" in payload
    assert "profiles_completed" in payload
    assert "completion_rate" in payload
    assert "major_distribution" in payload
    assert "school_distribution" in payload
    assert "education_distribution" in payload
    # arrays
    assert isinstance(payload["major_distribution"], list)
    assert isinstance(payload["school_distribution"], list)
    assert isinstance(payload["education_distribution"], list)


# ─── Competency Analysis ───────────────────────────────────────────────────────

def test_competency_analysis_returns_success():
    resp = client.get(
        "/api/admin/data-dashboard/competency-analysis", headers=get_admin_headers()
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["success"] is True


def test_competency_analysis_returns_required_fields():
    resp = client.get(
        "/api/admin/data-dashboard/competency-analysis", headers=get_admin_headers()
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert "total_assessments" in payload
    assert "average_scores" in payload
    assert "score_distribution" in payload
    assert "top_students" in payload
    assert isinstance(payload["average_scores"], dict)
    assert isinstance(payload["score_distribution"], list)
    assert isinstance(payload["top_students"], list)


# ─── Employment Trends ────────────────────────────────────────────────────────

def test_employment_trends_returns_success():
    resp = client.get(
        "/api/admin/data-dashboard/employment-trends", headers=get_admin_headers()
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["success"] is True


def test_employment_trends_returns_required_fields():
    resp = client.get(
        "/api/admin/data-dashboard/employment-trends", headers=get_admin_headers()
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert "total_jobs" in payload
    assert "total_companies" in payload
    assert "industry_distribution" in payload
    assert "job_title_distribution" in payload
    assert "salary_distribution" in payload
    assert isinstance(payload["industry_distribution"], list)
    assert isinstance(payload["job_title_distribution"], list)
    assert isinstance(payload["salary_distribution"], dict)


# ─── Auth Guard ───────────────────────────────────────────────────────────────

def test_major_distribution_without_auth_returns_401_or_403():
    resp = client.get("/api/admin/data-dashboard/major-distribution")
    assert resp.status_code in (401, 403)


def test_major_distribution_non_admin_returns_403():
    resp = client.get(
        "/api/admin/data-dashboard/major-distribution", headers=get_user_headers()
    )
    assert resp.status_code == 403


def test_competency_analysis_without_auth_returns_401_or_403():
    resp = client.get("/api/admin/data-dashboard/competency-analysis")
    assert resp.status_code in (401, 403)


def test_competency_analysis_non_admin_returns_403():
    resp = client.get(
        "/api/admin/data-dashboard/competency-analysis", headers=get_user_headers()
    )
    assert resp.status_code == 403


def test_employment_trends_without_auth_returns_401_or_403():
    resp = client.get("/api/admin/data-dashboard/employment-trends")
    assert resp.status_code in (401, 403)


def test_employment_trends_non_admin_returns_403():
    resp = client.get(
        "/api/admin/data-dashboard/employment-trends", headers=get_user_headers()
    )
    assert resp.status_code == 403
