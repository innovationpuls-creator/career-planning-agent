from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import get_auth_headers


client = TestClient(app)


def test_get_job_title_options_returns_unique_values():
    response = client.get(
        "/api/job-postings/job-titles",
        headers=get_auth_headers(client, "user"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]
    values = [item["value"] for item in payload["data"]]
    assert len(values) == len(set(values))
    assert "Java" in values


def test_get_industry_options_only_returns_values_for_selected_job_title():
    response = client.get(
        "/api/job-postings/industries",
        params={"job_title": "Java"},
        headers=get_auth_headers(client, "user"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]
    values = [item["value"] for item in payload["data"]]
    assert "互联网" in values


def test_get_vertical_job_profile_defaults_to_all_available_industries():
    response = client.get(
        "/api/job-requirement-profile/vertical",
        params={"job_title": "Java"},
        headers=get_auth_headers(client, "user"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["job_title"] == "Java"
    assert payload["data"]["selected_industries"]
    assert payload["data"]["selected_industries"] == payload["data"]["available_industries"]
    assert payload["data"]["title"].startswith("Java")
    first_company = payload["data"]["groups"][0]["companies"][0]
    assert "addresses" in first_company
    assert "company_sizes" in first_company
    assert "company_types" in first_company


def test_get_vertical_job_profile_filters_by_selected_industries():
    response = client.get(
        "/api/job-requirement-profile/vertical",
        params=[("job_title", "Java"), ("industry", "互联网")],
        headers=get_auth_headers(client, "user"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["selected_industries"] == ["互联网"]
    assert all(group["industry"] == "互联网" for group in payload["data"]["groups"])


def test_get_vertical_job_profile_limits_companies_per_industry():
    response = client.get(
        "/api/job-requirement-profile/vertical",
        params={"job_title": "测试工程师"},
        headers=get_auth_headers(client, "user"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["groups"]
    assert all(len(group["companies"]) <= 10 for group in payload["data"]["groups"])


def test_get_vertical_job_profile_company_detail_returns_aggregated_detail():
    user_headers = get_auth_headers(client, "user")
    vertical_response = client.get(
        "/api/job-requirement-profile/vertical",
        params={"job_title": "Java"},
        headers=user_headers,
    )
    vertical_payload = vertical_response.json()["data"]
    first_group = next((group for group in vertical_payload["groups"] if group["companies"]), None)
    assert first_group is not None
    first_company = first_group["companies"][0]["company_name"]

    response = client.get(
        "/api/job-requirement-profile/vertical/company-detail",
        params={
            "job_title": "Java",
            "industry": first_group["industry"],
            "company_name": first_company,
        },
        headers=user_headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["summary"]["job_title"] == "Java"
    assert payload["data"]["summary"]["industry"] == first_group["industry"]
    assert payload["data"]["summary"]["company_name"] == first_company
    assert payload["data"]["summary"]["posting_count"] >= 1
    assert isinstance(payload["data"]["summary"]["salary_ranges"], list)
    assert len(payload["data"]["postings"]) == payload["data"]["summary"]["posting_count"]


def test_get_vertical_job_profile_company_detail_does_not_mix_other_scopes():
    response = client.get(
        "/api/job-requirement-profile/vertical/company-detail",
        params={
            "job_title": "Java",
            "industry": "互联网",
            "company_name": "字节跳动",
        },
        headers=get_auth_headers(client, "user"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["summary"]["job_title"] == "Java"
    assert payload["data"]["summary"]["industry"] == "互联网"
    assert payload["data"]["summary"]["company_name"] == "字节跳动"
    assert all(item["job_title"] == "Java" for item in payload["data"]["postings"])
    assert all(item["industry"] == "互联网" for item in payload["data"]["postings"])
    assert all(item["company_name"] == "字节跳动" for item in payload["data"]["postings"])


def test_vertical_endpoints_reject_admin():
    admin_headers = get_auth_headers(client, "admin")
    title_response = client.get("/api/job-postings/job-titles", headers=admin_headers)
    graph_response = client.get(
        "/api/job-requirement-profile/vertical",
        params={"job_title": "Java"},
        headers=admin_headers,
    )

    assert title_response.status_code == 403
    assert graph_response.status_code == 403
