from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_standard_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.student_competency_profile import (
    StudentCompetencyChatPayload,
    StudentCompetencyChatResponse,
    StudentCompetencyConversationPayload,
    StudentCompetencyConversationResponse,
    StudentCompetencyLatestAnalysisResponse,
    StudentCompetencyResultSyncPayload,
    StudentCompetencyResultSyncRequest,
    StudentCompetencyResultSyncResponse,
    StudentCompetencyRuntimePayload,
    StudentCompetencyRuntimeResponse,
    StudentCompetencyStatusEventItem,
    StudentCompetencyStatusEventListResponse,
    StudentCompetencyStatusEventResponse,
)
from app.services.student_competency_latest_analysis import (
    StudentCompetencyLatestAnalysisService,
    build_student_competency_latest_analysis_service,
    delete_student_competency_latest_profile,
    get_student_competency_latest_profile_record,
    read_student_competency_latest_analysis,
    save_student_competency_latest_profile,
)
from app.services.student_competency_profile import (
    FALLBACK_OPENING_STATEMENT,
    StudentCompetencyProfileAccessError,
    StudentCompetencyProfileError,
    build_assistant_message,
    build_sync_query,
    get_competency_profile_client,
    get_profile_field_definitions,
    get_student_competency_profile_record,
    read_student_competency_profile,
    save_student_competency_profile,
    try_parse_profile_from_text,
    update_student_competency_profile_conversation,
)
from app.services.student_competency_status_store import student_competency_status_store


router = APIRouter(prefix="/api/student-competency-profile", tags=["student-competency-profile"])

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
DOCUMENT_EXTENSIONS = {
    ".txt",
    ".markdown",
    ".xlsx",
    ".pptx",
    ".csv",
    ".md",
    ".ppt",
    ".xml",
    ".eml",
    ".pdf",
    ".mdx",
    ".epub",
    ".msg",
    ".xls",
    ".docx",
    ".properties",
    ".doc",
    ".html",
    ".htm",
}


def get_student_competency_latest_analysis_service() -> StudentCompetencyLatestAnalysisService:
    return build_student_competency_latest_analysis_service()


def _pick_first_non_empty(*values: Any) -> Any:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
        if value is not None and not isinstance(value, str):
            return value
    return None


def _normalize_progress(raw: Any) -> int | None:
    if raw in (None, ""):
        return None
    try:
        progress = int(raw)
    except (TypeError, ValueError):
        return None
    return min(100, max(0, progress))


def _to_schema_item(event: Any) -> StudentCompetencyStatusEventItem:
    return StudentCompetencyStatusEventItem(
        event_id=event.event_id,
        conversation_id=event.conversation_id,
        status_text=event.status_text,
        stage=event.stage,
        progress=event.progress,
        source=event.source,
        details=event.details,
        created_at=event.created_at,
    )


def _append_status(
    conversation_id: str,
    *,
    status_text: str,
    stage: str | None = None,
    progress: int | None = None,
    details: dict[str, Any] | None = None,
) -> Any:
    return student_competency_status_store.append(
        conversation_id=conversation_id,
        status_text=status_text,
        stage=stage,
        progress=progress,
        source="backend",
        details=details,
    )


def _ndjson_line(payload: dict[str, Any]) -> bytes:
    return f"{json.dumps(payload, ensure_ascii=False)}\n".encode("utf-8")


def _event_created_at_iso(event: Any) -> str:
    created_at = getattr(event, "created_at", None)
    if isinstance(created_at, datetime):
        return created_at.isoformat()
    return datetime.now(timezone.utc).isoformat()


def _stream_status_event(assistant_message_id: str, event: Any) -> bytes:
    return _ndjson_line(
        {
            "event": "delta",
            "assistant_message_id": assistant_message_id,
            "delta": getattr(event, "status_text", ""),
            "stage": getattr(event, "stage", None),
            "progress": getattr(event, "progress", None),
            "created_at": _event_created_at_iso(event),
        }
    )


def _guess_upload_kind(upload: UploadFile) -> str:
    content_type = (upload.content_type or "").lower()
    extension = Path(upload.filename or "").suffix.lower()
    if content_type.startswith("image/") or extension in IMAGE_EXTENSIONS:
        return "image"
    if extension in DOCUMENT_EXTENSIONS:
        return "document"
    return "unknown"


def _validate_upload_group(
    uploads: list[UploadFile],
    *,
    expected_kind: str,
    variable_name: str,
) -> None:
    for upload in uploads:
        kind = _guess_upload_kind(upload)
        if kind != expected_kind:
            raise HTTPException(
                status_code=400,
                detail=f"File '{upload.filename}' does not match Dify field '{variable_name}'.",
            )


def _require_prompt_or_files(prompt: str, *, image_files: list[UploadFile], document_files: list[UploadFile]) -> None:
    if prompt.strip() or image_files or document_files:
        return
    raise HTTPException(status_code=400, detail="prompt or files are required")


async def _get_runtime_payload() -> StudentCompetencyRuntimePayload:
    client = get_competency_profile_client()
    runtime = await client.get_runtime_config()
    return StudentCompetencyRuntimePayload(
        opening_statement=runtime.opening_statement,
        fallback_opening_statement=FALLBACK_OPENING_STATEMENT,
        file_upload_enabled=runtime.file_upload_enabled,
        file_size_limit_mb=runtime.file_size_limit_mb,
        image_upload=runtime.image_upload,
        document_upload=runtime.document_upload,
        fields=get_profile_field_definitions(),
    )


def _assert_workspace_visible(
    *,
    db: Session,
    current_user: User,
    workspace_conversation_id: str,
) -> None:
    get_student_competency_profile_record(
        db,
        workspace_conversation_id=workspace_conversation_id,
        user_id=current_user.id,
    )


def _build_chat_payload(
    *,
    db: Session,
    current_user: User,
    workspace_conversation_id: str,
    result: Any,
    analysis_service: StudentCompetencyLatestAnalysisService,
) -> StudentCompetencyChatPayload:
    profile = try_parse_profile_from_text(result.answer)
    if profile is None:
        record = update_student_competency_profile_conversation(
            db,
            user_id=current_user.id,
            workspace_conversation_id=workspace_conversation_id,
            dify_conversation_id=result.conversation_id,
            latest_source_text=result.answer,
            last_message_id=result.message_id,
        )
        return StudentCompetencyChatPayload(
            workspace_conversation_id=workspace_conversation_id,
            dify_conversation_id=(record.dify_conversation_id if record else result.conversation_id),
            last_message_id=(record.last_message_id if record else result.message_id),
            assistant_message=str(result.answer or "").strip() or "已收到回复。",
            output_mode="chat",
            profile=None,
            latest_analysis=None,
        )

    record = save_student_competency_profile(
        db,
        user_id=current_user.id,
        workspace_conversation_id=workspace_conversation_id,
        dify_conversation_id=result.conversation_id,
        profile=profile,
        latest_source_text=result.answer,
        last_message_id=result.message_id,
    )
    latest_analysis = analysis_service.build_analysis(
        workspace_conversation_id=workspace_conversation_id,
        profile=profile,
    )
    save_student_competency_latest_profile(
        db,
        user_id=current_user.id,
        workspace_conversation_id=workspace_conversation_id,
        profile=profile,
        analysis=latest_analysis,
    )
    return StudentCompetencyChatPayload(
        workspace_conversation_id=workspace_conversation_id,
        dify_conversation_id=record.dify_conversation_id,
        last_message_id=record.last_message_id,
        assistant_message=build_assistant_message(profile),
        output_mode="profile",
        profile=profile,
        latest_analysis=latest_analysis,
    )


@router.get("/runtime", response_model=StudentCompetencyRuntimeResponse)
async def get_student_competency_runtime(
    _: User = Depends(require_standard_user),
) -> StudentCompetencyRuntimeResponse:
    payload = await _get_runtime_payload()
    return StudentCompetencyRuntimeResponse(data=payload)


@router.get("/latest-analysis", response_model=StudentCompetencyLatestAnalysisResponse)
def get_student_competency_latest_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> StudentCompetencyLatestAnalysisResponse:
    record = get_student_competency_latest_profile_record(db, user_id=current_user.id)
    return StudentCompetencyLatestAnalysisResponse(
        data=read_student_competency_latest_analysis(record)
    )


@router.delete("/latest-analysis", response_model=StudentCompetencyLatestAnalysisResponse)
def delete_student_competency_latest_analysis_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> StudentCompetencyLatestAnalysisResponse:
    delete_student_competency_latest_profile(db, user_id=current_user.id)
    return StudentCompetencyLatestAnalysisResponse(
        data=read_student_competency_latest_analysis(None)
    )


@router.post("/chat", response_model=StudentCompetencyChatResponse)
async def create_student_competency_chat(
    workspace_conversation_id: str = Form(..., min_length=1),
    prompt: str = Form(default=""),
    dify_conversation_id: str | None = Form(default=None),
    image_files: list[UploadFile] | None = File(default=None),
    document_files: list[UploadFile] | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
    analysis_service: StudentCompetencyLatestAnalysisService = Depends(
        get_student_competency_latest_analysis_service
    ),
) -> StudentCompetencyChatResponse:
    image_uploads = image_files or []
    document_uploads = document_files or []
    _require_prompt_or_files(prompt, image_files=image_uploads, document_files=document_uploads)

    try:
        _assert_workspace_visible(
            db=db,
            current_user=current_user,
            workspace_conversation_id=workspace_conversation_id,
        )
        runtime_payload = await _get_runtime_payload()
        _validate_upload_group(image_uploads, expected_kind="image", variable_name="userinput_image")
        _validate_upload_group(document_uploads, expected_kind="document", variable_name="userinput_file")

        if runtime_payload.image_upload.max_length is not None and len(image_uploads) > runtime_payload.image_upload.max_length:
            raise HTTPException(
                status_code=400,
                detail=f"userinput_image supports up to {runtime_payload.image_upload.max_length} files.",
            )
        if (
            runtime_payload.document_upload.max_length is not None
            and len(document_uploads) > runtime_payload.document_upload.max_length
        ):
            raise HTTPException(
                status_code=400,
                detail=f"userinput_file supports up to {runtime_payload.document_upload.max_length} files.",
            )

        _append_status(
            workspace_conversation_id,
            status_text="已开始准备学生就业能力画像请求。",
            stage="prepare",
            progress=5,
        )
        client = get_competency_profile_client()

        uploaded_images = []
        for upload in image_uploads:
            _append_status(
                workspace_conversation_id,
                status_text=f"正在上传图片：{upload.filename}",
                stage="upload-image",
                progress=15,
            )
            content = await upload.read()
            uploaded = await client.upload_file(
                file_name=upload.filename or "upload.bin",
                content=content,
                content_type=upload.content_type,
                user=workspace_conversation_id,
            )
            uploaded_images.append(uploaded)
            _append_status(
                workspace_conversation_id,
                status_text=f"图片上传完成：{upload.filename}",
                stage="upload-image",
                progress=25,
            )

        uploaded_documents = []
        for upload in document_uploads:
            _append_status(
                workspace_conversation_id,
                status_text=f"正在上传文档：{upload.filename}",
                stage="upload-document",
                progress=35,
            )
            content = await upload.read()
            uploaded = await client.upload_file(
                file_name=upload.filename or "upload.bin",
                content=content,
                content_type=upload.content_type,
                user=workspace_conversation_id,
            )
            uploaded_documents.append(uploaded)
            _append_status(
                workspace_conversation_id,
                status_text=f"文档上传完成：{upload.filename}",
                stage="upload-document",
                progress=45,
            )

        _append_status(workspace_conversation_id, status_text="Dify 正在分析材料", stage="analyze", progress=60)
        result = await client.send_message(
            query=prompt,
            user=workspace_conversation_id,
            conversation_id=dify_conversation_id,
            image_files=uploaded_images,
            document_files=uploaded_documents,
        )
        payload = _build_chat_payload(
            db=db,
            current_user=current_user,
            workspace_conversation_id=workspace_conversation_id,
            result=result,
            analysis_service=analysis_service,
        )
        _append_status(
            workspace_conversation_id,
            status_text="已生成最新 12 维画像" if payload.output_mode == "profile" else "已收到对话回复",
            stage="complete",
            progress=100,
        )
    except StudentCompetencyProfileAccessError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HTTPException:
        _append_status(workspace_conversation_id, status_text="请求校验失败", stage="error", progress=100)
        raise
    except StudentCompetencyProfileError as exc:
        _append_status(
            workspace_conversation_id,
            status_text=f"画像生成失败：{exc}",
            stage="error",
            progress=100,
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return StudentCompetencyChatResponse(data=payload)


@router.post("/chat/stream")
async def stream_student_competency_chat(
    workspace_conversation_id: str = Form(..., min_length=1),
    prompt: str = Form(default=""),
    dify_conversation_id: str | None = Form(default=None),
    image_files: list[UploadFile] | None = File(default=None),
    document_files: list[UploadFile] | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
    analysis_service: StudentCompetencyLatestAnalysisService = Depends(
        get_student_competency_latest_analysis_service
    ),
) -> StreamingResponse:
    image_uploads = image_files or []
    document_uploads = document_files or []
    _require_prompt_or_files(prompt, image_files=image_uploads, document_files=document_uploads)
    assistant_message_id = f"assistant_{uuid4().hex}"

    async def event_stream():
        yield _ndjson_line(
            {
                "event": "meta",
                "workspace_conversation_id": workspace_conversation_id,
                "assistant_message_id": assistant_message_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

        try:
            _assert_workspace_visible(
                db=db,
                current_user=current_user,
                workspace_conversation_id=workspace_conversation_id,
            )
            runtime_payload = await _get_runtime_payload()
            _validate_upload_group(image_uploads, expected_kind="image", variable_name="userinput_image")
            _validate_upload_group(document_uploads, expected_kind="document", variable_name="userinput_file")

            if runtime_payload.image_upload.max_length is not None and len(image_uploads) > runtime_payload.image_upload.max_length:
                raise HTTPException(
                    status_code=400,
                    detail=f"userinput_image supports up to {runtime_payload.image_upload.max_length} files.",
                )
            if (
                runtime_payload.document_upload.max_length is not None
                and len(document_uploads) > runtime_payload.document_upload.max_length
            ):
                raise HTTPException(
                    status_code=400,
                    detail=f"userinput_file supports up to {runtime_payload.document_upload.max_length} files.",
                )

            status_event = _append_status(
                workspace_conversation_id,
                status_text="已开始准备学生就业能力画像请求。",
                stage="prepare",
                progress=5,
            )
            yield _stream_status_event(assistant_message_id, status_event)

            client = get_competency_profile_client()
            uploaded_images = []
            for upload in image_uploads:
                status_event = _append_status(
                    workspace_conversation_id,
                    status_text=f"正在上传图片：{upload.filename}",
                    stage="upload-image",
                    progress=15,
                )
                yield _stream_status_event(assistant_message_id, status_event)
                content = await upload.read()
                uploaded = await client.upload_file(
                    file_name=upload.filename or "upload.bin",
                    content=content,
                    content_type=upload.content_type,
                    user=workspace_conversation_id,
                )
                uploaded_images.append(uploaded)
                status_event = _append_status(
                    workspace_conversation_id,
                    status_text=f"图片上传完成：{upload.filename}",
                    stage="upload-image",
                    progress=25,
                )
                yield _stream_status_event(assistant_message_id, status_event)

            uploaded_documents = []
            for upload in document_uploads:
                status_event = _append_status(
                    workspace_conversation_id,
                    status_text=f"正在上传文档：{upload.filename}",
                    stage="upload-document",
                    progress=35,
                )
                yield _stream_status_event(assistant_message_id, status_event)
                content = await upload.read()
                uploaded = await client.upload_file(
                    file_name=upload.filename or "upload.bin",
                    content=content,
                    content_type=upload.content_type,
                    user=workspace_conversation_id,
                )
                uploaded_documents.append(uploaded)
                status_event = _append_status(
                    workspace_conversation_id,
                    status_text=f"文档上传完成：{upload.filename}",
                    stage="upload-document",
                    progress=45,
                )
                yield _stream_status_event(assistant_message_id, status_event)

            status_event = _append_status(
                workspace_conversation_id,
                status_text="Dify 正在分析材料",
                stage="analyze",
                progress=60,
            )
            yield _stream_status_event(assistant_message_id, status_event)

            result = await client.send_message(
                query=prompt,
                user=workspace_conversation_id,
                conversation_id=dify_conversation_id,
                image_files=uploaded_images,
                document_files=uploaded_documents,
            )
            payload = _build_chat_payload(
                db=db,
                current_user=current_user,
                workspace_conversation_id=workspace_conversation_id,
                result=result,
                analysis_service=analysis_service,
            )
            status_event = _append_status(
                workspace_conversation_id,
                status_text="已生成最新 12 维画像" if payload.output_mode == "profile" else "已收到对话回复",
                stage="complete",
                progress=100,
            )
            yield _stream_status_event(assistant_message_id, status_event)
            yield _ndjson_line(
                {
                    "event": "done",
                    "assistant_message_id": assistant_message_id,
                    "data": payload.model_dump(mode="json"),
                }
            )
        except StudentCompetencyProfileAccessError as exc:
            yield _ndjson_line(
                {
                    "event": "error",
                    "assistant_message_id": assistant_message_id,
                    "detail": str(exc),
                }
            )
        except HTTPException as exc:
            status_event = _append_status(
                workspace_conversation_id,
                status_text="请求校验失败",
                stage="error",
                progress=100,
            )
            yield _stream_status_event(assistant_message_id, status_event)
            yield _ndjson_line(
                {
                    "event": "error",
                    "assistant_message_id": assistant_message_id,
                    "detail": str(exc.detail),
                }
            )
        except StudentCompetencyProfileError as exc:
            status_event = _append_status(
                workspace_conversation_id,
                status_text=f"画像生成失败：{exc}",
                stage="error",
                progress=100,
            )
            yield _stream_status_event(assistant_message_id, status_event)
            yield _ndjson_line(
                {
                    "event": "error",
                    "assistant_message_id": assistant_message_id,
                    "detail": str(exc),
                }
            )
        except Exception:
            status_event = _append_status(
                workspace_conversation_id,
                status_text="系统内部异常，请稍后重试",
                stage="error",
                progress=100,
            )
            yield _stream_status_event(assistant_message_id, status_event)
            yield _ndjson_line(
                {
                    "event": "error",
                    "assistant_message_id": assistant_message_id,
                    "detail": "系统内部异常，请稍后重试。",
                }
            )

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@router.get("/conversations/{workspace_conversation_id}", response_model=StudentCompetencyConversationResponse)
def get_student_competency_conversation(
    workspace_conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
) -> StudentCompetencyConversationResponse:
    try:
        record = get_student_competency_profile_record(
            db,
            workspace_conversation_id=workspace_conversation_id,
            user_id=current_user.id,
        )
    except StudentCompetencyProfileAccessError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return StudentCompetencyConversationResponse(
        data=StudentCompetencyConversationPayload(
            workspace_conversation_id=workspace_conversation_id,
            dify_conversation_id=record.dify_conversation_id if record else None,
            last_message_id=record.last_message_id if record else "",
            profile=read_student_competency_profile(record),
            updated_at=record.updated_at if record else None,
        )
    )


@router.post("/result-sync", response_model=StudentCompetencyResultSyncResponse)
async def sync_student_competency_result(
    payload: StudentCompetencyResultSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_standard_user),
    analysis_service: StudentCompetencyLatestAnalysisService = Depends(
        get_student_competency_latest_analysis_service
    ),
) -> StudentCompetencyResultSyncResponse:
    workspace_conversation_id = payload.workspace_conversation_id.strip()
    try:
        existing_record = get_student_competency_profile_record(
            db,
            workspace_conversation_id=workspace_conversation_id,
            user_id=current_user.id,
        )
        effective_conversation_id = payload.dify_conversation_id or (
            existing_record.dify_conversation_id if existing_record else None
        )

        _append_status(
            workspace_conversation_id,
            status_text="正在同步右侧编辑结果到云端",
            stage="sync",
            progress=70,
        )
        client = get_competency_profile_client()
        sync_result = await client.send_message(
            query=build_sync_query(payload.profile),
            user=workspace_conversation_id,
            conversation_id=effective_conversation_id,
        )
        record = save_student_competency_profile(
            db,
            user_id=current_user.id,
            workspace_conversation_id=workspace_conversation_id,
            dify_conversation_id=sync_result.conversation_id,
            profile=payload.profile,
            latest_source_text=sync_result.answer,
            last_message_id=sync_result.message_id,
        )
        latest_analysis = analysis_service.build_analysis(
            workspace_conversation_id=workspace_conversation_id,
            profile=payload.profile,
        )
        save_student_competency_latest_profile(
            db,
            user_id=current_user.id,
            workspace_conversation_id=workspace_conversation_id,
            profile=payload.profile,
            analysis=latest_analysis,
        )
        _append_status(workspace_conversation_id, status_text="右侧 12 维结果已同步到云端", stage="sync", progress=100)
    except StudentCompetencyProfileAccessError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except StudentCompetencyProfileError as exc:
        _append_status(
            workspace_conversation_id,
            status_text=f"结果同步失败：{exc}",
            stage="error",
            progress=100,
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return StudentCompetencyResultSyncResponse(
        data=StudentCompetencyResultSyncPayload(
            workspace_conversation_id=workspace_conversation_id,
            dify_conversation_id=record.dify_conversation_id,
            last_message_id=record.last_message_id,
            assistant_message="已保存并同步最新 12 维画像到云端，后续对话将以此结果为准。",
            profile=payload.profile,
            latest_analysis=latest_analysis,
        )
    )


@router.post("/status-events", response_model=StudentCompetencyStatusEventResponse)
async def create_student_competency_status_event(
    request: Request,
    conversation_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    staus: str | None = Query(default=None),
    stage: str | None = Query(default=None),
    progress: int | None = Query(default=None, ge=0, le=100),
) -> StudentCompetencyStatusEventResponse:
    try:
        body = await request.json()
        if not isinstance(body, dict):
            body = {}
    except Exception:
        body = {}

    normalized_conversation_id = _pick_first_non_empty(
        body.get("conversation_id"),
        body.get("conversationId"),
        conversation_id,
    )
    if not normalized_conversation_id:
        raise HTTPException(status_code=400, detail="conversation_id is required")

    status_text = _pick_first_non_empty(
        body.get("status_text"),
        body.get("status"),
        body.get("staus"),
        body.get("message"),
        body.get("content"),
        status,
        staus,
    )
    if not status_text:
        raise HTTPException(status_code=400, detail="status_text is required")

    normalized_stage = _pick_first_non_empty(body.get("stage"), body.get("event"), body.get("type"), stage)
    normalized_progress = _normalize_progress(_pick_first_non_empty(body.get("progress"), progress))
    normalized_source = _pick_first_non_empty(body.get("source"), "external")
    details = body.get("details")
    if details is not None and not isinstance(details, dict):
        details = {"raw": details}

    event = student_competency_status_store.append(
        conversation_id=normalized_conversation_id,
        status_text=status_text,
        stage=normalized_stage,
        progress=normalized_progress,
        source=normalized_source,
        details=details,
    )
    return StudentCompetencyStatusEventResponse(data=_to_schema_item(event))


@router.get("/status-events", response_model=StudentCompetencyStatusEventListResponse)
def list_student_competency_status_events(
    conversation_id: str,
    after_id: int | None = Query(default=None, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> StudentCompetencyStatusEventListResponse:
    events = student_competency_status_store.list(
        conversation_id=conversation_id,
        after_id=after_id,
        limit=limit,
    )
    items = [_to_schema_item(event) for event in events]
    return StudentCompetencyStatusEventListResponse(data=items, total=len(items))
