"""
学生就业能力画像服务（Student Competency Profile）

模块职责：
    基于 Dify AI 工作流，从用户上传的简历、成绩单、项目材料中提取"就业能力 12 维画像"。

12 维度定义（定义于 PROFILE_FIELD_FALLBACK_META）：
    专业技能 | 专业背景 | 学历要求 | 工作经验
    团队协作 | 抗压适应 | 沟通表达
    文档规范 | 责任心 | 学习能力 | 分析解决 | 其他特殊

核心类：
    DifyStudentCompetencyClient — 封装 Dify API（文件上传 / 流式对话 / 配置读取）
    DifyUploadedFile            — 上传文件元数据 DTO
    DifyChatResult              — 对话结果 DTO（含 conversation_id / message_id / answer）

核心函数：
    parse_profile_from_text    — 从 Dify 原始文本中提取 JSON 画像
    normalize_profile_payload   — 规范化画像数据（去重 / 过滤空值）
    serialize_profile          — 序列化画像为 JSON 字符串
    save_student_competency_profile   — 持久化画像到 SQLite
    read_student_competency_profile  — 从数据库读取并反序列化画像
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.student_competency_profile import StudentCompetencyProfile
from app.schemas.student_competency_profile import (
    DEFAULT_PROFILE_VALUE,
    JOB_PROFILE_FIELD_ORDER,
    JobProfile12Dimensions,
    StudentCompetencyProfileFieldMeta,
    StudentCompetencyUploadConstraint,
)


REPO_ROOT = Path(__file__).resolve().parents[3]
JOB_PROFILE_SCHEMA_PATH = REPO_ROOT / "docs" / "job_profile_12_dimensions.schema.json"
PROFILE_FIELD_FALLBACK_META: dict[str, dict[str, str]] = {
    "professional_skills": {
        "title": "专业技能",
        "description": "梳理学生已经具备或可展示的技能、工具、技术栈与业务方法。",
    },
    "professional_background": {
        "title": "专业背景",
        "description": "概括学生的专业方向、课程背景与知识基础。",
    },
    "education_requirement": {
        "title": "学历要求",
        "description": "描述学生当前的学历层级、学位信息与毕业阶段。",
    },
    "teamwork": {
        "title": "团队协作能力",
        "description": "总结学生在团队配合、分工协同与跨角色合作方面的表现。",
    },
    "stress_adaptability": {
        "title": "抗压/适应能力",
        "description": "说明学生面对节奏变化、多任务和压力场景时的适应情况。",
    },
    "communication": {
        "title": "沟通表达能力",
        "description": "体现学生在沟通、汇报、协调和信息传递方面的能力。",
    },
    "work_experience": {
        "title": "工作经验",
        "description": "提炼学生的项目、实习、兼职或科研实践经历。",
    },
    "documentation_awareness": {
        "title": "文档规范意识",
        "description": "体现学生在记录、文档输出、流程沉淀和规范执行方面的表现。",
    },
    "responsibility": {
        "title": "责任心/工作态度",
        "description": "反映学生在任务承接、推进闭环和职业态度方面的表现。",
    },
    "learning_ability": {
        "title": "学习能力",
        "description": "总结学生对新知识、新工具和新任务的学习与吸收能力。",
    },
    "problem_solving": {
        "title": "分析解决问题能力",
        "description": "描述学生识别问题、分析原因和推动解决的能力。",
    },
    "other_special": {
        "title": "其他/特殊要求",
        "description": "补充证书、语言、出差、班次等不适合归入其他维度的信息。",
    },
}
FALLBACK_OPENING_STATEMENT = (
    "上传简历、成绩材料、项目说明、图片或直接补充说明，系统会整理学生就业能力 12 维画像。"
    " 生成后可在右侧继续编辑并同步到后续对话上下文。"
)
DEFAULT_ANALYSIS_QUERY = "请基于上传材料或当前输入提取学生就业能力 12 维画像，并直接返回 JSON。"


class StudentCompetencyProfileError(RuntimeError):
    pass


class StudentCompetencyProfileAccessError(StudentCompetencyProfileError):
    pass


@dataclass(slots=True)
class DifyRuntimeConfig:
    opening_statement: str
    file_upload_enabled: bool
    file_size_limit_mb: int | None
    image_upload: StudentCompetencyUploadConstraint
    document_upload: StudentCompetencyUploadConstraint


@dataclass(slots=True)
class DifyUploadedFile:
    upload_file_id: str
    type: str
    name: str

    def to_input_payload(self) -> dict[str, str]:
        return {
            "transfer_method": "local_file",
            "upload_file_id": self.upload_file_id,
            "type": self.type,
        }


@dataclass(slots=True)
class DifyChatResult:
    conversation_id: str | None
    message_id: str
    answer: str


def _normalize_profile_values(values: Any) -> list[str]:
    if not isinstance(values, list):
        return DEFAULT_PROFILE_VALUE.copy()

    normalized = [
        str(item).strip()
        for item in values
        if isinstance(item, str) and item.strip()
    ]
    deduplicated = list(dict.fromkeys(normalized))
    return deduplicated or DEFAULT_PROFILE_VALUE.copy()


def normalize_profile_payload(payload: Any) -> JobProfile12Dimensions:
    raw = payload if isinstance(payload, dict) else {}
    normalized = {
        field: _normalize_profile_values(raw.get(field))
        for field in JOB_PROFILE_FIELD_ORDER
    }
    return JobProfile12Dimensions.model_validate(normalized)


def serialize_profile(profile: JobProfile12Dimensions) -> str:
    return json.dumps(profile.model_dump(), ensure_ascii=False)


def parse_profile_from_text(answer: str) -> JobProfile12Dimensions:
    text = answer.strip()
    if not text:
        raise StudentCompetencyProfileError("Dify returned an empty response.")

    candidates = [text]
    if "```" in text:
        for segment in text.split("```"):
            cleaned = segment.strip()
            if not cleaned:
                continue
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            candidates.append(cleaned)

    object_start = text.find("{")
    object_end = text.rfind("}")
    if object_start >= 0 and object_end > object_start:
        candidates.append(text[object_start : object_end + 1])

    for candidate in candidates:
        try:
            return normalize_profile_payload(json.loads(candidate))
        except (json.JSONDecodeError, TypeError, ValueError):
            continue

    raise StudentCompetencyProfileError("Dify response did not contain a valid 12-dimension JSON object.")


def try_parse_profile_from_text(answer: str) -> JobProfile12Dimensions | None:
    try:
        return parse_profile_from_text(answer)
    except StudentCompetencyProfileError:
        return None


@lru_cache(maxsize=1)
def get_profile_field_definitions() -> list[StudentCompetencyProfileFieldMeta]:
    properties: dict[str, Any] = {}
    if JOB_PROFILE_SCHEMA_PATH.exists():
        data = json.loads(JOB_PROFILE_SCHEMA_PATH.read_text(encoding="utf-8"))
        properties = data.get("properties", {})

    return [
        StudentCompetencyProfileFieldMeta(
            key=field,
            title=str(
                properties.get(field, {}).get(
                    "title",
                    PROFILE_FIELD_FALLBACK_META.get(field, {}).get("title", field),
                )
            ),
            description=str(
                properties.get(field, {}).get(
                    "description",
                    PROFILE_FIELD_FALLBACK_META.get(field, {}).get("description", ""),
                )
            ),
        )
        for field in JOB_PROFILE_FIELD_ORDER
    ]


class DifyStudentCompetencyClient:
    def __init__(self) -> None:
        if not settings.dify_api_key:
            raise StudentCompetencyProfileError("Dify API key is missing. Please check backend/.env.")

        request_timeout = float(settings.dify_timeout_seconds)
        self._client = httpx.AsyncClient(
            base_url=settings.dify_base_url.rstrip("/"),
            timeout=httpx.Timeout(
                timeout=request_timeout,
                connect=min(request_timeout, 30.0),
                read=max(request_timeout, 600.0),
                write=min(request_timeout, 30.0),
                pool=min(request_timeout, 30.0),
            ),
            headers={"Authorization": f"Bearer {settings.dify_api_key}"},
            trust_env=False,
        )
        self._runtime_config: DifyRuntimeConfig | None = None

    async def get_runtime_config(self, *, force_refresh: bool = False) -> DifyRuntimeConfig:
        if self._runtime_config is not None and not force_refresh:
            return self._runtime_config

        try:
            response = await self._client.get("/parameters")
            response.raise_for_status()
            body = response.json()
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            raise StudentCompetencyProfileError(f"Failed to load Dify runtime parameters: {exc}") from exc

        user_input_form = body.get("user_input_form") or []
        image_field = self._extract_file_constraint(user_input_form, "userinput_image", expected_type="image")
        document_field = self._extract_file_constraint(user_input_form, "userinput_file", expected_type="document")
        file_upload = body.get("file_upload") or {}

        # Dify advanced-chat may expose workflow start-node file inputs in
        # `user_input_form` even when the legacy/global `file_upload.enabled`
        # flag is false. For this integration we care about the published start
        # node variables, so the existence of both file-list inputs is the
        # authoritative signal that uploads are supported.
        file_upload_enabled = bool(image_field and document_field)

        config = DifyRuntimeConfig(
            opening_statement=str(body.get("opening_statement") or "").strip(),
            file_upload_enabled=file_upload_enabled,
            file_size_limit_mb=self._extract_file_size_limit(file_upload),
            image_upload=image_field,
            document_upload=document_field,
        )
        self._runtime_config = config
        return config

    @staticmethod
    def _extract_file_constraint(
        user_input_form: list[dict[str, Any]],
        variable_name: str,
        *,
        expected_type: str,
    ) -> StudentCompetencyUploadConstraint:
        for entry in user_input_form:
            if not isinstance(entry, dict) or len(entry) != 1:
                continue
            field_type, config = next(iter(entry.items()))
            if not isinstance(config, dict):
                continue
            if config.get("variable") != variable_name:
                continue
            allowed_types = [str(item) for item in config.get("allowed_file_types") or []]
            if field_type != "file-list":
                raise StudentCompetencyProfileError(
                    f"Dify field '{variable_name}' must be configured as file-list, got '{field_type}'."
                )
            if expected_type not in allowed_types:
                raise StudentCompetencyProfileError(
                    f"Dify field '{variable_name}' must accept '{expected_type}' files."
                )
            return StudentCompetencyUploadConstraint(
                variable=variable_name,
                allowed_file_types=allowed_types,
                allowed_file_extensions=[str(item) for item in config.get("allowed_file_extensions") or []],
                allowed_file_upload_methods=[str(item) for item in config.get("allowed_file_upload_methods") or []],
                max_length=int(config["max_length"]) if config.get("max_length") is not None else None,
            )

        raise StudentCompetencyProfileError(f"Dify field '{variable_name}' was not found in the published app.")

    @staticmethod
    def _extract_file_size_limit(file_upload: dict[str, Any]) -> int | None:
        config = file_upload.get("fileUploadConfig")
        if not isinstance(config, dict):
            return None
        raw = config.get("file_size_limit")
        try:
            return int(raw) if raw is not None else None
        except (TypeError, ValueError):
            return None

    async def upload_file(self, *, file_name: str, content: bytes, content_type: str | None, user: str) -> DifyUploadedFile:
        runtime = await self.get_runtime_config()
        if not runtime.file_upload_enabled:
            raise StudentCompetencyProfileError(
                "The current published Dify app does not expose userinput_image/userinput_file upload inputs."
            )

        try:
            response = await self._client.post(
                "/files/upload",
                data={"user": user},
                files={"file": (file_name, content, content_type or "application/octet-stream")},
            )
            response.raise_for_status()
            body = response.json()
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            raise StudentCompetencyProfileError(f"Failed to upload file to Dify: {exc}") from exc

        upload_file_id = str(body.get("id") or "").strip()
        if not upload_file_id:
            raise StudentCompetencyProfileError("Dify file upload did not return an upload file id.")

        inferred_type = "image" if (content_type or "").startswith("image/") else "document"
        return DifyUploadedFile(
            upload_file_id=upload_file_id,
            type=inferred_type,
            name=str(body.get("name") or file_name),
        )

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # send_message：核心对话发送方法
    # 功能：向 Dify AI 发送消息（支持上传文件），接收流式响应并解析结果
    # 流程：① 构建 payload（query + inputs + conversation_id）
    #       ② 使用 httpx.AsyncClient.stream 发起 SSE 流式请求
    #       ③ 根据 Content-Type 分发至阻塞解析或流式解析
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async def send_message(
        self,
        *,
        query: str,
        user: str,
        conversation_id: str | None = None,
        image_files: list[DifyUploadedFile] | None = None,
        document_files: list[DifyUploadedFile] | None = None,
    ) -> DifyChatResult:
        await self.get_runtime_config()
        inputs: dict[str, Any] = {}
        if image_files:
            inputs["userinput_image"] = [item.to_input_payload() for item in image_files]
        if document_files:
            inputs["userinput_file"] = [item.to_input_payload() for item in document_files]

        payload: dict[str, Any] = {
            "query": query.strip() or DEFAULT_ANALYSIS_QUERY,
            "user": user,
            "response_mode": "streaming",
            "inputs": inputs,
        }
        if conversation_id:
            payload["conversation_id"] = conversation_id

        try:
            async with self._client.stream("POST", "/chat-messages", json=payload) as response:
                response.raise_for_status()
                content_type = (response.headers.get("content-type") or "").lower()
                if "application/json" in content_type:
                    body = json.loads((await response.aread()).decode("utf-8"))
                    return self._parse_blocking_chat_body(body, fallback_conversation_id=conversation_id)

                result = await self._parse_streaming_chat_body(
                    response=response,
                    fallback_conversation_id=conversation_id,
                )
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            raise StudentCompetencyProfileError(f"Failed to send message to Dify: {exc}") from exc
        return result

    @staticmethod
    def _parse_blocking_chat_body(body: dict[str, Any], *, fallback_conversation_id: str | None) -> DifyChatResult:
        answer = str(body.get("answer") or "").strip()
        message_id = str(body.get("message_id") or body.get("id") or "").strip()
        if not message_id:
            raise StudentCompetencyProfileError("Dify chat response did not include a message id.")

        return DifyChatResult(
            conversation_id=str(body.get("conversation_id") or "").strip() or fallback_conversation_id,
            message_id=message_id,
            answer=answer,
        )

    @staticmethod
    async def _parse_streaming_chat_body(
        *,
        response: httpx.Response,
        fallback_conversation_id: str | None,
    ) -> DifyChatResult:
        answer_chunks: list[str] = []
        current_event: str | None = None
        conversation_id = fallback_conversation_id
        message_id = ""

        async for raw_line in response.aiter_lines():
            line = raw_line.strip()
            if not line:
                continue
            if line.startswith("event:"):
                current_event = line.split(":", 1)[1].strip()
                continue
            if not line.startswith("data:"):
                continue

            payload_text = line.split(":", 1)[1].strip()
            if not payload_text or payload_text == "[DONE]":
                continue

            body = json.loads(payload_text)
            event_name = str(body.get("event") or current_event or "").strip().lower()
            if event_name in {"ping", "workflow_started", "node_started", "node_finished", "workflow_finished"}:
                continue
            if event_name == "error":
                raise StudentCompetencyProfileError(
                    str(body.get("message") or body.get("error") or "Dify streaming returned an error.")
                )

            candidate_conversation_id = str(body.get("conversation_id") or "").strip()
            if candidate_conversation_id:
                conversation_id = candidate_conversation_id

            candidate_message_id = str(body.get("message_id") or body.get("id") or "").strip()
            if candidate_message_id:
                message_id = candidate_message_id

            if event_name in {"message", "agent_message"}:
                fragment = body.get("answer") or body.get("text") or ""
                if isinstance(fragment, str) and fragment:
                    answer_chunks.append(fragment)

            if event_name == "message_end":
                break

        answer = "".join(answer_chunks).strip()
        if not message_id:
            raise StudentCompetencyProfileError("Dify streaming chat response did not include a message id.")

        return DifyChatResult(
            conversation_id=conversation_id,
            message_id=message_id,
            answer=answer,
        )


_dify_student_competency_client: DifyStudentCompetencyClient | None = None


def get_competency_profile_client() -> DifyStudentCompetencyClient | LocalCompetencyProfileClient:
    if settings.use_local_competency_profile:
        from app.services.local_competency_profile import get_local_competency_profile_client

        return get_local_competency_profile_client()
    return get_dify_student_competency_client()


def get_dify_student_competency_client() -> DifyStudentCompetencyClient:
    global _dify_student_competency_client
    if _dify_student_competency_client is None:
        _dify_student_competency_client = DifyStudentCompetencyClient()
    return _dify_student_competency_client


def build_assistant_message(profile: JobProfile12Dimensions) -> str:
    explicit_dimensions = [
        field for field, values in profile.model_dump().items() if values != DEFAULT_PROFILE_VALUE
    ]
    return (
        f"已生成学生就业能力画像，识别出 {len(explicit_dimensions)} 个有明确信息的维度。"
        " 右侧结果区已同步，可继续编辑或追问完善。"
    )


def build_sync_query(profile: JobProfile12Dimensions) -> str:
    profile_json = serialize_profile(profile)
    return (
        "请将以下 12 维学生就业能力画像作为当前会话的最新基准，"
        "后续对话与修改都以它为准。无需重复输出完整 JSON，只需确认已同步。\n"
        f"{profile_json}"
    )


def get_student_competency_profile_record(
    db: Session,
    *,
    workspace_conversation_id: str,
    user_id: int,
) -> StudentCompetencyProfile | None:
    statement = select(StudentCompetencyProfile).where(
        StudentCompetencyProfile.workspace_conversation_id == workspace_conversation_id
    )
    record = db.scalar(statement)
    if record is None:
        return None
    if record.user_id != user_id:
        raise StudentCompetencyProfileAccessError("Conversation not found.")
    return record


def save_student_competency_profile(
    db: Session,
    *,
    user_id: int,
    workspace_conversation_id: str,
    dify_conversation_id: str | None,
    profile: JobProfile12Dimensions,
    latest_source_text: str,
    last_message_id: str,
) -> StudentCompetencyProfile:
    record = get_student_competency_profile_record(
        db,
        workspace_conversation_id=workspace_conversation_id,
        user_id=user_id,
    )
    if record is None:
        record = StudentCompetencyProfile(
            user_id=user_id,
            workspace_conversation_id=workspace_conversation_id,
            dify_conversation_id=dify_conversation_id,
            latest_profile_json=serialize_profile(profile),
            latest_source_text=latest_source_text,
            last_message_id=last_message_id,
        )
    else:
        record.dify_conversation_id = dify_conversation_id
        record.latest_profile_json = serialize_profile(profile)
        record.latest_source_text = latest_source_text
        record.last_message_id = last_message_id

    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_student_competency_profile_conversation(
    db: Session,
    *,
    user_id: int,
    workspace_conversation_id: str,
    dify_conversation_id: str | None,
    latest_source_text: str,
    last_message_id: str,
) -> StudentCompetencyProfile | None:
    record = get_student_competency_profile_record(
        db,
        workspace_conversation_id=workspace_conversation_id,
        user_id=user_id,
    )
    if record is None:
        return None

    record.dify_conversation_id = dify_conversation_id
    record.latest_source_text = latest_source_text
    record.last_message_id = last_message_id
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def read_student_competency_profile(record: StudentCompetencyProfile | None) -> JobProfile12Dimensions | None:
    if record is None:
        return None
    try:
        payload = json.loads(record.latest_profile_json)
    except json.JSONDecodeError as exc:
        raise StudentCompetencyProfileError("Stored student competency profile is invalid JSON.") from exc
    return normalize_profile_payload(payload)
