from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import get_auth_headers


client = TestClient(app)


def test_list_job_postings_returns_paginated_data():
    response = client.get(
        "/api/job-postings",
        params={"current": 1, "pageSize": 2},
        headers=get_auth_headers(client, "admin"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["current"] == 1
    assert payload["pageSize"] == 2
    assert payload["total"] >= len(payload["data"])
    assert len(payload["data"]) <= 2


def test_list_job_postings_supports_single_value_filters():
    response = client.get(
        "/api/job-postings",
        params={"industry": "互联网", "job_title": "Java", "pageSize": 5},
        headers=get_auth_headers(client, "admin"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    for item in payload["data"]:
        assert item["industry"] == "互联网"
        assert item["job_title"] == "Java"


def test_list_job_postings_supports_multi_value_filters():
    response = client.get(
        "/api/job-postings",
        params=[
            ("industry", "计算机软件"),
            ("industry", "互联网"),
            ("job_title", "Java"),
            ("job_title", "前端开发"),
            ("pageSize", "20"),
        ],
        headers=get_auth_headers(client, "admin"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]
    for item in payload["data"]:
        assert item["industry"] in {"计算机软件", "互联网"}
        assert item["job_title"] in {"Java", "前端开发"}


def test_list_job_postings_bracket_params_are_not_supported_contract():
    admin_headers = get_auth_headers(client, "admin")
    valid_response = client.get(
        "/api/job-postings",
        params=[("job_title", "C/C++")],
        headers=admin_headers,
    )
    invalid_response = client.get(
        "/api/job-postings",
        params=[("job_title[]", "C/C++")],
        headers=admin_headers,
    )

    assert valid_response.status_code == 200
    assert invalid_response.status_code == 200
    assert valid_response.json()["total"] < invalid_response.json()["total"]


def test_list_job_postings_rejects_standard_user():
    response = client.get(
        "/api/job-postings",
        params={"current": 1, "pageSize": 2},
        headers=get_auth_headers(client, "user"),
    )

    assert response.status_code == 403
