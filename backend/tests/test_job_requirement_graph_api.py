import json

from fastapi.testclient import TestClient

from app.api.job_requirement_graph import get_job_requirement_graph_service
from app.main import app
from app.models.job_requirement_profile import JobRequirementProfile
from app.services.job_requirement_graph import (
    build_graph_payload_from_profiles,
    build_static_graph_payload,
)
from tests.helpers import get_auth_headers


class FakeJobRequirementGraphService:
    def __init__(self) -> None:
        self.payload = build_static_graph_payload()

    def get_graph(self) -> dict[str, object]:
        return self.payload


def test_get_job_requirement_graph_returns_expected_nodes_edges_and_meta():
    app.dependency_overrides[get_job_requirement_graph_service] = FakeJobRequirementGraphService
    client = TestClient(app)

    response = client.get(
        "/api/job-requirement-profile/graph",
        headers=get_auth_headers(client, "user"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert len(payload["data"]["nodes"]) == 16
    assert len(payload["data"]["edges"]) == 15
    assert payload["data"]["nodes"][0]["title"] == "岗位要求画像"
    assert any(node["title"] == "专业与门槛" for node in payload["data"]["nodes"])
    assert any(node["title"] == "分析解决问题能力" for node in payload["data"]["nodes"])
    assert any(edge["type"] == "HAS_GROUP" for edge in payload["data"]["edges"])
    assert any(edge["type"] == "HAS_DIMENSION" for edge in payload["data"]["edges"])
    assert payload["data"]["meta"]["graph_version"] == "2.1.0"

    app.dependency_overrides.clear()


def test_get_job_requirement_graph_rejects_admin():
    app.dependency_overrides[get_job_requirement_graph_service] = FakeJobRequirementGraphService
    client = TestClient(app)

    response = client.get(
        "/api/job-requirement-profile/graph",
        headers=get_auth_headers(client, "admin"),
    )

    assert response.status_code == 403
    app.dependency_overrides.clear()


def test_build_graph_payload_from_profiles_aggregates_keywords_and_coverage():
    profiles = [
      JobRequirementProfile(
          industry="互联网",
          job_title="Java",
          company_name="甲公司",
          professional_skills=json.dumps(["Java", "Spring"], ensure_ascii=False),
          professional_background=json.dumps(["计算机相关专业"], ensure_ascii=False),
          education_requirement=json.dumps(["本科及以上"], ensure_ascii=False),
          teamwork=json.dumps(["团队协作"], ensure_ascii=False),
          stress_adaptability=json.dumps(["抗压能力"], ensure_ascii=False),
          communication=json.dumps(["沟通表达"], ensure_ascii=False),
          work_experience=json.dumps(["3年以上经验"], ensure_ascii=False),
          documentation_awareness=json.dumps(["文档规范"], ensure_ascii=False),
          responsibility=json.dumps(["责任心强"], ensure_ascii=False),
          learning_ability=json.dumps(["学习能力"], ensure_ascii=False),
          problem_solving=json.dumps(["问题定位"], ensure_ascii=False),
      ),
      JobRequirementProfile(
          industry="互联网",
          job_title="前端开发",
          company_name="乙公司",
          professional_skills=json.dumps(["JavaScript", "Java"], ensure_ascii=False),
          professional_background=json.dumps(["无明确要求"], ensure_ascii=False),
          education_requirement=json.dumps(["本科及以上"], ensure_ascii=False),
          teamwork=json.dumps(["团队协作"], ensure_ascii=False),
          stress_adaptability=json.dumps(["无明确要求"], ensure_ascii=False),
          communication=json.dumps(["沟通表达"], ensure_ascii=False),
          work_experience=json.dumps(["项目经验"], ensure_ascii=False),
          documentation_awareness=json.dumps(["无明确要求"], ensure_ascii=False),
          responsibility=json.dumps(["主动负责"], ensure_ascii=False),
          learning_ability=json.dumps(["快速学习"], ensure_ascii=False),
          problem_solving=json.dumps(["问题定位"], ensure_ascii=False),
      ),
    ]

    payload, signature = build_graph_payload_from_profiles(profiles)

    assert signature
    assert payload["meta"]["total_profiles"] == 2

    professional_skills = next(
        node for node in payload["nodes"] if node["id"] == "professional_skills"
    )
    assert professional_skills["keywords"][:2] == ["Java", "Spring"]
    assert professional_skills["profile_count"] == 2
    assert professional_skills["non_default_count"] == 2
    assert professional_skills["coverage_ratio"] == 1.0

    professional_background = next(
        node for node in payload["nodes"] if node["id"] == "professional_background"
    )
    assert professional_background["non_default_count"] == 1
    assert professional_background["coverage_ratio"] == 0.5

    root_node = payload["nodes"][0]
    assert root_node["title"] == "岗位要求画像"
    assert root_node["keywords"][0] == "Java"
