from __future__ import annotations

import json
import logging
import re
from collections.abc import AsyncGenerator
from io import BytesIO
from pathlib import Path
from uuid import uuid4
from zipfile import ZipFile

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_authenticated_user
from app.api.coach_upload import get_uploaded_coach_file_path
from app.db.session import get_db
from app.models.user import User
from app.schemas.agent import CoachAttachment, CoachChatRequest, CoachSkillsResponse
from app.services.coach_coordinator import CoachCoordinator
from app.services.coach_router import route_message
from app.services.coach_skills import (
    build_selected_skill_prompt,
    get_enabled_coach_skill,
    list_enabled_coach_skills,
    message_has_evidence,
    selected_skill_has_context,
    selected_skill_needs_context,
    selected_skill_needs_evidence,
    skill_to_payload,
)
from app.services.context_builder import build_system_prompt
from app.core.config import settings
from app.services.embeddings import OpenAICompatibleEmbeddingClient
from app.services.llm import LLMClientError, OpenAICompatibleLLMClient
from app.services.memory.manager import MemoryManager
from app.services.memory.proposal_handler import handle_memory_proposal
from app.services.outbox.emitter import OutboxEmitter
from app.services.tool_registry import Tool, ToolRegistry, register_all_tools
from app.services.tools.executor import ToolExecutor
from app.services.tools.mock_job_categories import register_get_job_categories

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coach", tags=["coach"])

# Module-level ToolRegistry with P0c mock tool + P2 mutation_gated tool
_tool_registry = ToolRegistry()
register_get_job_categories(_tool_registry)
_tool_registry.register_tool(Tool(
    name="process_memory_proposal",
    display_name="提交记忆变更提议",
    description="向记忆系统提交一个变更提议，裁决后将自动写入或拒绝。不能用于直接修改 ConversationSummary。",
    parameters={
        "targetField": {
            "type": "string",
            "description": "目标字段路径，如 skills.python.mastery_status",
        },
        "newValue": {
            "type": "string",
            "description": "新值（JSON 编码的字符串，如 mastered）",
        },
        "evidence": {
            "type": "string",
            "description": "佐证证据描述",
        },
        "confidence": {
            "type": "number",
            "minimum": 0.0,
            "maximum": 1.0,
            "description": "置信度",
        },
        "riskLevel": {
            "type": "string",
            "enum": ["low", "medium", "high"],
            "description": "变更风险等级：low(自动确认)/medium(provisional)/high(永远不自动确认)",
        },
    },
    classification="mutation_gated",
    agent="Shared",
    handler=lambda args, ctx=None: {
        "delegated": True,
        "target_field": args.get("targetField", ""),
    },
))
# P2b: register all 22 tools
register_all_tools(_tool_registry)

_ATTACHMENT_TEXT_LIMIT = 4000


def _resolve_selected_skill(
    body: CoachChatRequest,
) -> tuple[dict[str, object] | None, bool, str]:
    if not body.selected_skill:
        return None, True, ""
    selected_skill = get_enabled_coach_skill(body.selected_skill.name)
    if selected_skill is None or body.selected_skill.source != "slash_command":
        raise HTTPException(status_code=400, detail="INVALID_SELECTED_SKILL")
    evidence_ready = (
        not selected_skill_needs_evidence(selected_skill.name)
        or message_has_evidence(body.message)
    )
    page_context = (
        body.page_context.model_dump(by_alias=True)
        if body.page_context
        else None
    )
    context_ready = selected_skill_has_context(selected_skill.name, page_context)
    ready = evidence_ready and context_ready
    payload: dict[str, object] = {
        "name": selected_skill.name,
        "source": body.selected_skill.source,
        "label": selected_skill.label,
        "classification": selected_skill.classification,
        "requiresEvidence": selected_skill.requires_evidence,
        "requiresContext": selected_skill_needs_context(selected_skill.name),
        "evidenceReady": evidence_ready,
        "contextReady": context_ready,
    }
    return (
        payload,
        ready,
        build_selected_skill_prompt(
            payload,
            evidence_ready=evidence_ready,
            context_ready=context_ready,
        ),
    )


@router.get("/skills", response_model=CoachSkillsResponse)
async def list_coach_skills(
    current_user: User = Depends(require_authenticated_user),
):
    """Return slash-command skills that are safe to expose in the coach input."""
    _ = current_user
    return {"data": [skill_to_payload(skill) for skill in list_enabled_coach_skills()]}


def _strip_markup(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text or "")).strip()


def _extract_attachment_text(path: Path, content_type: str) -> str:
    suffix = path.suffix.lower()
    contents = path.read_bytes()
    if suffix in {".txt", ".md", ".csv"} or content_type.startswith("text/"):
        return contents.decode("utf-8", errors="ignore").strip()[:_ATTACHMENT_TEXT_LIMIT]
    if suffix == ".pdf":
        try:
            from pypdf import PdfReader  # type: ignore[import-untyped]

            reader = PdfReader(BytesIO(contents))
            pages = [
                (page.extract_text() or "").strip()
                for page in reader.pages
            ]
            return "\n".join(page for page in pages if page)[:_ATTACHMENT_TEXT_LIMIT]
        except Exception:
            logger.exception("Failed to extract coach PDF attachment text")
            return ""
    if suffix == ".docx":
        try:
            with ZipFile(BytesIO(contents)) as archive:
                xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")
            return _strip_markup(xml)[:_ATTACHMENT_TEXT_LIMIT]
        except Exception:
            logger.exception("Failed to extract coach DOCX attachment text")
            return ""
    return ""


def _prepare_attachments(
    student_id: int,
    attachments: list[CoachAttachment],
) -> tuple[list[dict[str, object]], str | None]:
    attachment_payload: list[dict[str, object]] = []
    context_parts: list[str] = []

    for attachment in attachments:
        path = get_uploaded_coach_file_path(student_id, attachment.file_id)
        if path is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ATTACHMENT_NOT_FOUND",
            )

        payload = attachment.model_dump(by_alias=True)
        attachment_payload.append(payload)

        extracted_text = _extract_attachment_text(path, attachment.type)
        if extracted_text:
            context_parts.append(f"### {attachment.name}\n{extracted_text}")
        else:
            context_parts.append(
                f"### {attachment.name}\n[附件类型: {attachment.type}; 未提取文本]"
            )

    if not context_parts:
        return attachment_payload, None
    return attachment_payload, "## 本轮上传附件\n" + "\n\n".join(context_parts)


async def _stream_with_coordinator(
    llm_client: OpenAICompatibleLLMClient,
    body: CoachChatRequest,
    db: Session,
    current_user: User,
    attachment_payload: list[dict[str, object]] | None = None,
    attachment_context: str | None = None,
    selected_skill_payload: dict[str, object] | None = None,
    selected_skill_ready: bool = True,
    selected_skill_prompt: str = "",
) -> AsyncGenerator[bytes, None]:
    """Yield run-oriented NDJSON events for the coach agent."""
    trace_id = f"trace_{uuid4().hex[:12]}"
    decision = await route_message(
        body.message, pipeline_stage=body.pipeline_stage, llm_client=llm_client
    )
    memory_manager = MemoryManager(db)

    # Resolve or create session
    session_id = body.session_id
    if session_id:
        session = memory_manager.get_session(session_id, current_user.id)
        if not session:
            raise HTTPException(status_code=404, detail="SESSION_NOT_FOUND")
    else:
        session_id = str(uuid4())

    # Ensure session exists
    session = memory_manager.get_or_create_session(
        student_id=current_user.id,
        session_id=session_id,
        title=body.message[:50],
    )

    attachments_json = (
        json.dumps(attachment_payload, ensure_ascii=False)
        if attachment_payload
        else None
    )

    # Load conversation summary and inject into system prompt
    summary = memory_manager.get_conversation_summary(current_user.id)
    summary_json_str = summary.model_dump_json() if summary else None
    system_prompt = await build_system_prompt(
        db,
        decision.agent,
        student_id=current_user.id,
        conversation_summary=summary_json_str,
        conversation_summary_obj=summary,
    )
    if selected_skill_prompt:
        system_prompt = f"{system_prompt}\n\n{selected_skill_prompt}"

    # Build reason string for the route event
    if decision.rule in ("L1.5", "L2") and decision.matched:
        route_reason = f"{decision.rule}: {decision.matched}"
    else:
        route_reason = decision.rule

    # P4: write routing_log for observability; do not expose a separate route_log event.
    route_log_id = f"rlog_{uuid4().hex[:12]}"
    from app.models.coach import RoutingLog

    routing_log = RoutingLog(
        id=route_log_id,
        student_id=current_user.id,
        session_id=session_id,
        trace_id=trace_id,
        message=body.message[:200],
        route_level=decision.rule,
        matched_agent=decision.agent,
        matched_rule=decision.matched or decision.rule,
        llm_confidence=decision.confidence if decision.rule == "L4" else None,
        llm_latency_ms=decision.latency_ms if decision.rule == "L4" else None,
    )
    db.add(routing_log)
    db.commit()

    outbox_emitter = OutboxEmitter(db=db)
    tool_executor = ToolExecutor(registry=_tool_registry)

    # Create embedding client for recall_memory tool (P2 Qdrant pipeline)
    embedding_client = None
    try:
        embedding_client = OpenAICompatibleEmbeddingClient.from_settings()
    except Exception:
        logger.debug("Embedding client unavailable, recall_memory will fall back")

    coordinator = CoachCoordinator(
        llm_client,
        _tool_registry,
        memory_manager=memory_manager,
        student_id=current_user.id,
        session_id=session.id,
        agent=decision.agent,
        db=db,
        outbox_emitter=outbox_emitter,
        tool_executor=tool_executor,
        embedding_client=embedding_client,
        qdrant_path=settings.qdrant_path,
    )
    async for chunk in coordinator.run(
        system_prompt, body.message, agent=decision.agent,
        client_message_id=body.client_message_id,
        attachments_json=attachments_json,
        attachment_context=attachment_context,
        page_context=(
            body.page_context.model_dump(by_alias=True)
            if body.page_context
            else None
        ),
        selected_skill=selected_skill_payload,
        selected_skill_ready=selected_skill_ready,
        route_rule=decision.rule,
        route_matched=decision.matched or route_reason,
        title=body.message[:50],
    ):
        yield chunk

    # P1: persist coordinator metadata after chat completes
    memory_manager.save_coordinator_metadata(current_user.id, current_stage=decision.agent)


@router.post("/chat/stream")
async def stream_coach_chat(
    body: CoachChatRequest,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """Stream coach chat response as NDJSON events.

    Events (flat camelCase):
      {"event":"run_start","sessionId":"...","assistantMessageId":"...","activeAgent":"..."}
      {"event":"step","stepId":"...","kind":"tool","status":"running","title":"..."}
      {"event":"answer_delta","delta":"..."}
      {"event":"run_done","stopReason":"task_complete","sessionId":"...","metrics":{...}}
      {"event":"run_error","code":"...","message":"...","retryable":true}
    """
    try:
        llm_client = OpenAICompatibleLLMClient.from_settings()
    except LLMClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )

    attachment_payload, attachment_context = _prepare_attachments(
        current_user.id,
        body.attachments,
    )
    selected_skill_payload, selected_skill_ready, selected_skill_prompt = (
        _resolve_selected_skill(body)
    )
    stream = _stream_with_coordinator(
        llm_client,
        body,
        db,
        current_user,
        attachment_payload=attachment_payload,
        attachment_context=attachment_context,
        selected_skill_payload=selected_skill_payload,
        selected_skill_ready=selected_skill_ready,
        selected_skill_prompt=selected_skill_prompt,
    )

    return StreamingResponse(
        stream,
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
