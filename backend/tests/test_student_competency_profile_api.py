from __future__ import annotations

import json
from dataclasses import dataclass, field

from fastapi.testclient import TestClient

from app.api.student_competency_profile import get_student_competency_latest_analysis_service
from app.main import app
from app.db.session import engine
from app.models.student_competency_profile import StudentCompetencyProfile
from app.models.student_competency_user_latest_profile import StudentCompetencyUserLatestProfile
from app.schemas.student_competency_profile import (
    JobProfile12Dimensions,
    StudentCompetencyLatestAnalysisPayload,
    StudentCompetencyNarrativePayload,
    StudentCompetencyScorePayload,
    StudentCompetencyUploadConstraint,
)
from tests.helpers import get_auth_headers


StudentCompetencyUserLatestProfile.__table__.drop(bind=engine, checkfirst=True)
StudentCompetencyProfile.__table__.drop(bind=engine, checkfirst=True)
StudentCompetencyProfile.__table__.create(bind=engine, checkfirst=True)
StudentCompetencyUserLatestProfile.__table__.create(bind=engine, checkfirst=True)

client = TestClient(app)

PROFILE_ANSWER = json.dumps(
    {
        "professional_skills": ["Python"],
        "professional_background": ["计算机相关专业"],
        "education_requirement": ["本科及以上"],
        "teamwork": ["团队协作"],
        "stress_adaptability": ["抗压能力"],
        "communication": ["沟通表达"],
        "work_experience": ["项目经历"],
        "documentation_awareness": ["文档规范"],
        "responsibility": ["责任心强"],
        "learning_ability": ["学习能力强"],
        "problem_solving": ["分析解决问题能力"],
        "other_special": ["暂无明确信息"],
    },
    ensure_ascii=False,
)


@dataclass
class FakeRuntimeConfig:
    opening_statement: str = ""
    file_upload_enabled: bool = True
    file_size_limit_mb: int | None = 15
    image_upload: StudentCompetencyUploadConstraint = field(
        default_factory=lambda: StudentCompetencyUploadConstraint(
            variable="userinput_image",
            allowed_file_types=["image"],
            allowed_file_extensions=[],
            allowed_file_upload_methods=["local_file", "remote_url"],
            max_length=3,
        )
    )
    document_upload: StudentCompetencyUploadConstraint = field(
        default_factory=lambda: StudentCompetencyUploadConstraint(
            variable="userinput_file",
            allowed_file_types=["document"],
            allowed_file_extensions=[],
            allowed_file_upload_methods=["local_file", "remote_url"],
            max_length=3,
        )
    )


class FakeDifyClient:
    def __init__(self) -> None:
        self.runtime = FakeRuntimeConfig()
        self.answer = PROFILE_ANSWER
        self.sent_messages: list[dict] = []

    async def get_runtime_config(self, *, force_refresh: bool = False) -> FakeRuntimeConfig:
        return self.runtime

    async def upload_file(self, *, file_name: str, content: bytes, content_type: str | None, user: str):
        file_type = "image" if (content_type or "").startswith("image/") else "document"
        return type(
            "UploadedFile",
            (),
            {
                "upload_file_id": f"upload-{file_name}",
                "type": file_type,
                "name": file_name,
                "to_input_payload": lambda self: {
                    "transfer_method": "local_file",
                    "upload_file_id": self.upload_file_id,
                    "type": self.type,
                },
            },
        )()

    async def send_message(
        self,
        *,
        query: str,
        user: str,
        conversation_id: str | None = None,
        image_files: list | None = None,
        document_files: list | None = None,
    ):
        self.sent_messages.append(
            {
                "query": query,
                "user": user,
                "conversation_id": conversation_id,
                "image_count": len(image_files or []),
                "document_count": len(document_files or []),
            }
        )
        return type(
            "ChatResult",
            (),
            {
                "conversation_id": conversation_id or "dify-conversation-1",
                "message_id": f"message-{len(self.sent_messages)}",
                "answer": self.answer,
            },
        )()


class FakeLatestAnalysisService:
    def __init__(self, *, available: bool = True, message: str = "分析可用") -> None:
        self.available = available
        self.message = message

    def build_analysis(
        self,
        *,
        workspace_conversation_id: str,
        profile: JobProfile12Dimensions,
    ) -> StudentCompetencyLatestAnalysisPayload:
        return StudentCompetencyLatestAnalysisPayload(
            available=self.available,
            message=self.message,
            workspace_conversation_id=workspace_conversation_id,
            profile=profile,
            score=StudentCompetencyScorePayload(completeness=75, competitiveness=70, overall=72),
            comparison_dimensions=[],
            chart_series=[],
            strength_dimensions=["professional_skills"],
            priority_gap_dimensions=["communication"],
            recommended_keywords={"communication": ["跨部门沟通"]},
            narrative=StudentCompetencyNarrativePayload(
                overall_review=self.message,
                completeness_explanation="完整度说明",
                competitiveness_explanation="竞争力说明",
                strength_highlights=["专业技能：已覆盖且位于高权重区间。"],
                priority_gap_highlights=["沟通表达：建议补充跨部门沟通。"],
            ),
        )


def _install_overrides(monkeypatch, *, analysis_service: FakeLatestAnalysisService | None = None) -> FakeDifyClient:
    fake_client = FakeDifyClient()
    monkeypatch.setattr(
        "app.api.student_competency_profile.get_competency_profile_client",
        lambda: fake_client,
    )
    app.dependency_overrides[get_student_competency_latest_analysis_service] = (
        lambda: analysis_service or FakeLatestAnalysisService()
    )
    return fake_client


def test_runtime_requires_authenticated_standard_user(monkeypatch):
    _install_overrides(monkeypatch)

    response = client.get("/api/student-competency-profile/runtime")

    assert response.status_code == 401


def test_profile_chat_persists_conversation_and_user_latest_analysis(monkeypatch):
    fake_client = _install_overrides(monkeypatch)
    headers = get_auth_headers(client, "user")

    response = client.post(
        "/api/student-competency-profile/chat",
        data={
            "workspace_conversation_id": "workspace-1",
            "prompt": "请生成画像",
        },
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["output_mode"] == "profile"
    assert payload["latest_analysis"]["available"] is True
    assert payload["profile"]["professional_skills"] == ["Python"]
    assert fake_client.sent_messages[0]["query"] == "请生成画像"

    latest_response = client.get("/api/student-competency-profile/latest-analysis", headers=headers)
    assert latest_response.status_code == 200
    latest_payload = latest_response.json()["data"]
    assert latest_payload["available"] is True
    assert latest_payload["workspace_conversation_id"] == "workspace-1"

    app.dependency_overrides.clear()


def test_chat_output_mode_chat_does_not_override_latest_analysis(monkeypatch):
    fake_client = _install_overrides(monkeypatch)
    headers = get_auth_headers(client, "user")

    first = client.post(
        "/api/student-competency-profile/chat",
        data={"workspace_conversation_id": "workspace-chat", "prompt": "生成画像"},
        headers=headers,
    )
    assert first.status_code == 200

    fake_client.answer = "建议补充量化项目成果。"

    second = client.post(
        "/api/student-competency-profile/chat",
        data={"workspace_conversation_id": "workspace-chat", "prompt": "再给我建议"},
        headers=headers,
    )
    assert second.status_code == 200
    assert second.json()["data"]["output_mode"] == "chat"
    assert second.json()["data"]["latest_analysis"] is None

    latest_response = client.get("/api/student-competency-profile/latest-analysis", headers=headers)
    assert latest_response.json()["data"]["workspace_conversation_id"] == "workspace-chat"
    assert latest_response.json()["data"]["available"] is True

    app.dependency_overrides.clear()


def test_result_sync_overrides_latest_analysis(monkeypatch):
    _install_overrides(monkeypatch)
    headers = get_auth_headers(client, "user")

    profile = JobProfile12Dimensions(
        professional_skills=["Python", "SQL"],
        professional_background=["计算机相关专业"],
        education_requirement=["本科及以上"],
        teamwork=["团队协作"],
        stress_adaptability=["抗压能力"],
        communication=["沟通表达"],
        work_experience=["项目经历"],
        documentation_awareness=["文档规范"],
        responsibility=["责任心强"],
        learning_ability=["学习能力强"],
        problem_solving=["分析解决问题能力"],
        other_special=["暂无明确信息"],
    )

    response = client.post(
        "/api/student-competency-profile/result-sync",
        json={
            "workspace_conversation_id": "workspace-sync",
            "dify_conversation_id": "dify-sync",
            "profile": profile.model_dump(),
        },
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["latest_analysis"]["available"] is True
    assert payload["profile"]["professional_skills"] == ["Python", "SQL"]

    latest_response = client.get("/api/student-competency-profile/latest-analysis", headers=headers)
    assert latest_response.json()["data"]["workspace_conversation_id"] == "workspace-sync"

    app.dependency_overrides.clear()


def test_latest_analysis_is_user_scoped_and_workspace_visibility_isolated(monkeypatch):
    _install_overrides(monkeypatch)
    user1_headers = get_auth_headers(client, "user")
    user2_headers = get_auth_headers(client, "user")

    created = client.post(
        "/api/student-competency-profile/chat",
        data={"workspace_conversation_id": "workspace-private", "prompt": "生成画像"},
        headers=user1_headers,
    )
    assert created.status_code == 200

    latest_other_user = client.get("/api/student-competency-profile/latest-analysis", headers=user2_headers)
    assert latest_other_user.status_code == 200
    assert latest_other_user.json()["data"]["available"] is False

    conversation_other_user = client.get(
        "/api/student-competency-profile/conversations/workspace-private",
        headers=user2_headers,
    )
    assert conversation_other_user.status_code == 404

    sync_other_user = client.post(
        "/api/student-competency-profile/result-sync",
        json={
            "workspace_conversation_id": "workspace-private",
            "profile": JobProfile12Dimensions().model_dump(),
        },
        headers=user2_headers,
    )
    assert sync_other_user.status_code == 404

    app.dependency_overrides.clear()


def test_delete_latest_analysis_returns_empty_state(monkeypatch):
    _install_overrides(monkeypatch)
    headers = get_auth_headers(client, "user")

    created = client.post(
        "/api/student-competency-profile/chat",
        data={"workspace_conversation_id": "workspace-delete", "prompt": "生成画像"},
        headers=headers,
    )
    assert created.status_code == 200

    deleted = client.delete("/api/student-competency-profile/latest-analysis", headers=headers)
    assert deleted.status_code == 200
    assert deleted.json()["data"]["available"] is False

    latest_response = client.get("/api/student-competency-profile/latest-analysis", headers=headers)
    assert latest_response.json()["data"]["available"] is False

    app.dependency_overrides.clear()


def test_graph_failure_does_not_break_student_profile_flow(monkeypatch):
    _install_overrides(monkeypatch, analysis_service=FakeLatestAnalysisService(available=False, message="图谱暂不可用"))
    headers = get_auth_headers(client, "user")

    response = client.post(
        "/api/student-competency-profile/chat",
        data={"workspace_conversation_id": "workspace-unavailable", "prompt": "生成画像"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["data"]["output_mode"] == "profile"
    assert response.json()["data"]["latest_analysis"]["available"] is False
    assert response.json()["data"]["latest_analysis"]["message"] == "图谱暂不可用"

    app.dependency_overrides.clear()
