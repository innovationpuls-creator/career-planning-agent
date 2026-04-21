"""
蜗牛学习路径复盘服务（Snail Learning Path Review）

模块职责：
    为用户在蜗牛学习路径中提交的周/月复盘提供 AI 评估，
    判定当前阶段完成进度，给出下周/下月行动建议。

两种复盘模式：
    周检查（weekly）：
        输出：进度评估 / 阶段目标差距 / 有效学习点 / 阻碍 / 下周建议
    月评（monthly）：
        输出：月度总结 / 阶段进度 / 差距判断 / 阶段建议（continue/strengthen/advance）

文件支持：
    支持从上传材料中提取文本（txt / md / json / csv / docx 等），
    作为上下文注入 LLM prompt，避免用户重复输入。

核心流程：
    ① 收集上传文件并提取文本摘要
    ② 根据复盘类型构建对应 system/user prompt
    ③ 调用本地 LLM（temperature=0.2）生成 JSON 结构化报告
    ④ 持久化复盘记录到 SQLite
"""

from __future__ import annotations

import json
import re
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.models.snail_learning_path_review import SnailLearningPathReview
from app.schemas.career_development_report import CareerDevelopmentFavoritePayload
from app.schemas.snail_learning_path import (
    SnailLearningPathReviewCreateRequest,
    SnailLearningPathReviewPayload,
    SnailMonthlyReviewReport,
    SnailUploadedFileSummary,
    SnailWeeklyReviewReport,
)
from app.services.career_development_plan_workspace import build_growth_plan_phases
from app.services.llm import ChatMessage, LLMClientError, OpenAICompatibleLLMClient

TEXT_UPLOAD_SUFFIXES = {
    ".txt",
    ".md",
    ".markdown",
    ".json",
    ".csv",
    ".xml",
    ".html",
    ".htm",
    ".py",
    ".js",
    ".ts",
}


def _json_dumps(value: object) -> str:
    return json.dumps(value, ensure_ascii=False)


def _json_loads(raw: str, fallback: object) -> object:
    try:
        return json.loads(raw or "")
    except Exception:
        return fallback


def _safe_filename(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", name or "upload.bin").strip("._") or "upload.bin"


def _strip_markup(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text or "")).strip()


def _extract_upload_text(*, file_name: str, content_type: str, content: bytes) -> str:
    suffix = Path(file_name).suffix.lower()
    if suffix in TEXT_UPLOAD_SUFFIXES:
        return content.decode("utf-8", errors="ignore").strip()[:4000]
    if suffix == ".docx":
        try:
            with ZipFile(BytesIO(content)) as archive:
                xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")
                return _strip_markup(xml)[:4000]
        except Exception:
            return ""
    if content_type.startswith("text/"):
        return content.decode("utf-8", errors="ignore").strip()[:4000]
    return ""


def _extract_json_candidate(text: str) -> dict[str, object] | None:
    raw = (text or "").strip()
    if not raw:
        return None
    candidates = [raw]
    if "```" in raw:
        for segment in raw.split("```"):
            cleaned = segment.strip()
            if not cleaned:
                continue
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            candidates.append(cleaned)
    if "{" in raw and "}" in raw:
        candidates.append(raw[raw.find("{") : raw.rfind("}") + 1])

    for candidate in candidates:
        try:
            payload = json.loads(candidate)
        except Exception:
            continue
        if isinstance(payload, dict):
            return payload
    return None


def _build_favorite_from_report(report) -> CareerDevelopmentFavoritePayload:
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    return CareerDevelopmentFavoritePayload(
        favorite_id=1,
        target_key=f"{report.canonical_job_title}::{report.industry or ''}",
        source_kind="custom",
        report_id=report.report_id,
        target_scope=report.target_scope,
        target_title=report.target_title,
        canonical_job_title=report.canonical_job_title,
        representative_job_title=report.representative_job_title,
        industry=report.industry,
        overall_match=report.overall_match,
        report_snapshot=report,
        created_at=now,
        updated_at=now,
    )


def _build_phase_context(body: SnailLearningPathReviewCreateRequest):
    favorite = _build_favorite_from_report(body.report_snapshot)
    phases = build_growth_plan_phases(favorite)
    phase = next((item for item in phases if item.phase_key == body.phase_key), None)
    if phase is None:
        raise ValueError("当前阶段不存在。")
    return favorite, phase


async def _collect_upload_summaries(uploads: list[UploadFile]) -> list[SnailUploadedFileSummary]:
    summaries: list[SnailUploadedFileSummary] = []
    for upload in uploads:
        file_name = _safe_filename(upload.filename or "upload.bin")
        content_type = upload.content_type or "application/octet-stream"
        content = await upload.read()
        text_excerpt = _extract_upload_text(file_name=file_name, content_type=content_type, content=content)
        summaries.append(
            SnailUploadedFileSummary(
                file_name=upload.filename or file_name,
                content_type=content_type,
                text_excerpt=text_excerpt,
            )
        )
    return summaries


def _format_upload_context(uploaded_files: list[SnailUploadedFileSummary]) -> str:
    if not uploaded_files:
        return "无上传材料。"
    return "\n".join(
        [
            f"- 文件名：{item.file_name}\n  内容类型：{item.content_type}\n  摘要：{item.text_excerpt or '无可提取文本，仅记录了文件元数据。'}"
            for item in uploaded_files
        ]
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# _build_weekly_messages：周检查 Prompt 构建
#
# 系统 Prompt 角色设定：
#   "学习路径周检查助手" — 简洁、克制、可执行的周检查
#
# User Prompt 注入内容（从用户上下文提取）：
#   • 目标岗位 & 当前阶段
#   • 阶段目标（goal_statement）
#   • 当前模块完成进度（completed/total & percent）
#   • 用户已打勾的学习资源 URL 列表
#   • 用户本周自填总结（user_prompt）
#   • 上传材料摘要（支持 txt/md/json/docx 等格式提取）
#
# 输出 JSON Schema：
#   headline / focus_keywords / progress_assessment / progress_keywords /
#   goal_gap_summary / gap_keywords / highlights / blockers /
#   next_action / action_keywords
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _build_weekly_messages(
    *,
    body: SnailLearningPathReviewCreateRequest,
    favorite: CareerDevelopmentFavoritePayload,
    phase,
    uploaded_files: list[SnailUploadedFileSummary],
) -> list[ChatMessage]:
    return [
        ChatMessage(
            role="system",
            content=(
                "你是学习路径周检查助手。"
                "请根据给定的目标岗位、当前阶段、用户本周总结、已打勾学习网址和上传材料摘要，"
                "输出一份简洁、克制、可执行的周检查结果。"
                "不要编造用户未提供的事实。"
                '输出必须是 JSON，格式为：'
                '{"headline":"",'
                '"focus_keywords":[""],'
                '"progress_assessment":"",'
                '"progress_keywords":[""],'
                '"goal_gap_summary":"",'
                '"gap_keywords":[""],'
                '"highlights":[""],'
                '"blockers":[""],'
                '"next_action":"",'
                '"action_keywords":[""]}'
            ),
        ),
        ChatMessage(
            role="user",
            content=(
                f"目标岗位：{favorite.canonical_job_title}\n"
                f"当前阶段：{phase.phase_label}（{phase.time_horizon}）\n"
                f"阶段目标：{phase.goal_statement}\n"
                f"当前阶段进度：{body.completed_module_count}/{body.total_module_count}（{body.phase_progress_percent}%）\n"
                f"当前阶段已打勾网址：{body.checked_resource_urls or ['无']}\n"
                f"用户本周总结：{body.user_prompt.strip()}\n"
                f"上传材料：\n{_format_upload_context(uploaded_files)}\n"
                "请给出：当前推进判断、距离阶段目标的简要结论、有效学习点、阻碍、下周建议。"
            ),
        ),
    ]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# _build_monthly_messages：月评 Prompt 构建
#
# 与周检查的差异：
#   • 角色升级为"学习路径月评助手" — 结构化月评视角
#   • 输出 JSON 新增 recommendation 字段（三选一）：
#       continue  — 继续维持当前阶段
#       strengthen — 补强后进入下一阶段
#       advance   — 可以直接进入下一阶段
#   • 输出新增：monthly_summary（月度总结）、phase_progress_summary（阶段进度）
#
# 适用场景：用户每月提交复盘时调用，生成月度评估报告
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _build_monthly_messages(
    *,
    body: SnailLearningPathReviewCreateRequest,
    favorite: CareerDevelopmentFavoritePayload,
    phase,
    uploaded_files: list[SnailUploadedFileSummary],
) -> list[ChatMessage]:
    return [
        ChatMessage(
            role="system",
            content=(
                "你是学习路径月评助手。"
                "请根据给定的目标岗位、当前阶段、用户本月总结、已打勾学习网址和上传材料摘要，"
                "输出一份结构化月评。"
                "不要编造用户未提供的事实。"
                '输出必须是 JSON，格式为：'
                '{"headline":"",'
                '"focus_keywords":[""],'
                '"monthly_summary":"",'
                '"phase_progress_summary":"",'
                '"progress_keywords":[""],'
                '"gap_assessment":"",'
                '"gap_keywords":[""],'
                '"recommendation":"continue|strengthen|advance",'
                '"focus_points":[""],'
                '"next_actions":[""],'
                '"action_keywords":[""]}'
            ),
        ),
        ChatMessage(
            role="user",
            content=(
                f"目标岗位：{favorite.canonical_job_title}\n"
                f"当前阶段：{phase.phase_label}（{phase.time_horizon}）\n"
                f"阶段目标：{phase.goal_statement}\n"
                f"当前阶段进度：{body.completed_module_count}/{body.total_module_count}（{body.phase_progress_percent}%）\n"
                f"当前阶段已打勾网址：{body.checked_resource_urls or ['无']}\n"
                f"用户本月总结：{body.user_prompt.strip()}\n"
                f"上传材料：\n{_format_upload_context(uploaded_files)}\n"
                "请给出：本月总结、当前阶段完成情况、差距判断、维持/补强/进入下一阶段建议、下月动作。"
            ),
        ),
    ]


async def _generate_review_report(
    *,
    body: SnailLearningPathReviewCreateRequest,
    favorite: CareerDevelopmentFavoritePayload,
    phase,
    uploaded_files: list[SnailUploadedFileSummary],
) -> tuple[SnailWeeklyReviewReport | None, SnailMonthlyReviewReport | None]:
    client = OpenAICompatibleLLMClient.from_settings()
    try:
        messages = (
            _build_weekly_messages(body=body, favorite=favorite, phase=phase, uploaded_files=uploaded_files)
            if body.review_type == "weekly"
            else _build_monthly_messages(body=body, favorite=favorite, phase=phase, uploaded_files=uploaded_files)
        )
        content = await client.chat_completion(messages, temperature=0.2)
    finally:
        await client.aclose()

    payload = _extract_json_candidate(content)
    if payload is None:
        raise LLMClientError("LLM response did not contain valid JSON.")

    if body.review_type == "weekly":
        return (
            SnailWeeklyReviewReport(
                headline=str(payload.get("headline") or "本周继续推进当前阶段"),
                focus_keywords=[str(item).strip() for item in payload.get("focus_keywords") or [] if str(item).strip()],
                progress_assessment=str(payload.get("progress_assessment") or ""),
                progress_keywords=[str(item).strip() for item in payload.get("progress_keywords") or [] if str(item).strip()],
                goal_gap_summary=str(payload.get("goal_gap_summary") or ""),
                gap_keywords=[str(item).strip() for item in payload.get("gap_keywords") or [] if str(item).strip()],
                highlights=[str(item).strip() for item in payload.get("highlights") or [] if str(item).strip()],
                blockers=[str(item).strip() for item in payload.get("blockers") or [] if str(item).strip()],
                next_action=str(payload.get("next_action") or ""),
                action_keywords=[str(item).strip() for item in payload.get("action_keywords") or [] if str(item).strip()],
            ),
            None,
        )

    recommendation = str(payload.get("recommendation") or "continue").strip().lower()
    if recommendation not in {"continue", "strengthen", "advance"}:
        recommendation = "continue"
    return (
        None,
            SnailMonthlyReviewReport(
                headline=str(payload.get("headline") or "本月继续围绕当前阶段推进"),
                focus_keywords=[str(item).strip() for item in payload.get("focus_keywords") or [] if str(item).strip()],
                monthly_summary=str(payload.get("monthly_summary") or ""),
                phase_progress_summary=str(payload.get("phase_progress_summary") or ""),
                progress_keywords=[str(item).strip() for item in payload.get("progress_keywords") or [] if str(item).strip()],
                gap_assessment=str(payload.get("gap_assessment") or ""),
                gap_keywords=[str(item).strip() for item in payload.get("gap_keywords") or [] if str(item).strip()],
                recommendation=recommendation,  # type: ignore[arg-type]
                focus_points=[str(item).strip() for item in payload.get("focus_points") or [] if str(item).strip()],
                next_actions=[str(item).strip() for item in payload.get("next_actions") or [] if str(item).strip()],
                action_keywords=[str(item).strip() for item in payload.get("action_keywords") or [] if str(item).strip()],
            ),
        )


def _serialize_review_row(row: SnailLearningPathReview) -> SnailLearningPathReviewPayload:
    checked_resource_urls = _json_loads(row.checked_resource_urls_json, [])
    uploaded_files = _json_loads(row.uploaded_files_json, [])
    llm_report = _json_loads(row.llm_report_json, {})

    weekly_report = None
    monthly_report = None
    if row.review_type == "weekly":
        weekly_report = SnailWeeklyReviewReport.model_validate(llm_report)
    else:
        monthly_report = SnailMonthlyReviewReport.model_validate(llm_report)

    return SnailLearningPathReviewPayload(
        review_id=row.id,
        workspace_id=row.workspace_id,
        review_type=row.review_type,
        phase_key=row.phase_key,
        checked_resource_urls=checked_resource_urls if isinstance(checked_resource_urls, list) else [],
        uploaded_files=[SnailUploadedFileSummary.model_validate(item) for item in uploaded_files if isinstance(item, dict)],
        user_prompt=row.user_prompt,
        weekly_report=weekly_report,
        monthly_report=monthly_report,
        created_at=row.created_at,
    )


async def create_snail_learning_path_review(
    db: Session,
    *,
    user_id: int,
    workspace_id: str,
    body: SnailLearningPathReviewCreateRequest,
    uploads: list[UploadFile],
) -> SnailLearningPathReviewPayload:
    favorite, phase = _build_phase_context(body)
    uploaded_files = await _collect_upload_summaries(uploads)
    weekly_report, monthly_report = await _generate_review_report(
        body=body,
        favorite=favorite,
        phase=phase,
        uploaded_files=uploaded_files,
    )

    llm_report_json = (
        weekly_report.model_dump(mode="json") if weekly_report is not None else monthly_report.model_dump(mode="json")
    )
    row = SnailLearningPathReview(
        workspace_id=workspace_id,
        user_id=user_id,
        phase_key=body.phase_key,
        review_type=body.review_type,
        checked_resource_urls_json=_json_dumps(body.checked_resource_urls),
        user_prompt=body.user_prompt,
        uploaded_files_json=_json_dumps([item.model_dump(mode="json") for item in uploaded_files]),
        llm_report_json=_json_dumps(llm_report_json),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_review_row(row)


def list_snail_learning_path_reviews(
    db: Session,
    *,
    user_id: int,
    workspace_id: str,
    phase_key: str | None = None,
    review_type: str | None = None,
) -> list[SnailLearningPathReviewPayload]:
    query = db.query(SnailLearningPathReview).filter(
        SnailLearningPathReview.user_id == user_id,
        SnailLearningPathReview.workspace_id == workspace_id,
    )
    if phase_key:
        query = query.filter(SnailLearningPathReview.phase_key == phase_key)
    if review_type:
        query = query.filter(SnailLearningPathReview.review_type == review_type)
    rows = query.order_by(SnailLearningPathReview.created_at.desc()).all()
    return [_serialize_review_row(row) for row in rows]
