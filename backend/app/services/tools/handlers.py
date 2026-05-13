"""22 tool handlers for the CareerCoach agent system.

P2b: All 22 tools registered with ToolRegistry via register_all_tools().
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any, Callable

import httpx
from jose import jwt

from app.core.config import settings

logger = logging.getLogger(__name__)


from app.services.tools.executor import ToolResult

# ── Readonly API Handler Factory ─────────────────────────────────────────────

def _auth_header(context: Any) -> dict[str, str]:
    """Generate an auth token for internal API calls using the app secret."""
    student_id = getattr(context, "student_id", None) if context is not None else None
    sub = str(student_id) if student_id and student_id != 0 else "1"
    token = jwt.encode(
        {"sub": sub, "exp": int(time.time()) + 300},
        settings.secret_key,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


async def _default_http_client(
    endpoint: str,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
    headers: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Real HTTP client that calls the backend's own REST API."""
    backend_url = f"http://127.0.0.1:9100{endpoint}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        req_headers = {**(headers or {})}
        if json_body is not None:
            resp = await client.post(backend_url, json=json_body, headers=req_headers)
        else:
            resp = await client.get(backend_url, params=params, headers=req_headers)
        body = resp.text
        if resp.is_error:
            return {"status": "error", "http_status": resp.status_code, "detail": body[:500]}
        content_type = resp.headers.get("content-type", "")
        if "application/x-ndjson" in content_type or "text/event-stream" in content_type:
            lines = body.strip().split("\n")
            return {"status": "ok", "stream": True, "event_count": len(lines)}
        try:
            return json.loads(body) if body else {"status": "ok", "body": ""}
        except json.JSONDecodeError:
            return {"status": "ok", "raw": body[:500]}


async def readonly_api_handler(
    endpoint: str,
    method: str,
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    """Generic readonly API call factory.

    Calls existing REST endpoints and formats response as ToolResult.
    Auto-injects student_id from context when available.
    """
    # Inject student_id from context — the LLM cannot know the real user ID
    if context is not None:
        ctx_student_id = getattr(context, "student_id", None)
        if ctx_student_id and ctx_student_id != 0:
            llm_student_id = args.get("student_id")
            if llm_student_id and str(llm_student_id) != str(ctx_student_id):
                logger.warning(
                    "LLM provided student_id=%s differs from context student_id=%s; "
                    "using context value", llm_student_id, ctx_student_id
                )
            args = {**args, "student_id": str(ctx_student_id)}

    client = http_client or _default_http_client
    try:
        headers = _auth_header(context)
        if method == "GET":
            try:
                response = await client(endpoint, params=args, headers=headers)
            except TypeError as exc:
                if "params" not in str(exc):
                    raise
                response = await client(endpoint, json=args, headers=headers)
        else:
            try:
                response = await client(endpoint, json_body=args, headers=headers)
            except TypeError as exc:
                if "json_body" not in str(exc):
                    raise
                response = await client(endpoint, json=args, headers=headers)
        return ToolResult(
            success=True,
            summary=_format_api_response(response),
            detail=response,
        )
    except Exception as e:
        return ToolResult(success=False, error=str(e))


def _format_api_response(response: dict[str, Any]) -> str:
    if isinstance(response, dict):
        return json.dumps(response, ensure_ascii=False)[:200]
    return str(response)[:200]


def _page_context(context: Any) -> dict[str, Any]:
    raw = None
    if context is not None:
        raw = getattr(context, "page_context", None) or getattr(context, "pageContext", None)
    if isinstance(raw, dict):
        return raw
    return {}


def _first_value(source: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = source.get(key)
        if value not in (None, ""):
            return value
    return None


def _coerce_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _context_value(args: dict[str, Any], context: Any, *keys: str) -> Any:
    value = _first_value(args, *keys)
    if value not in (None, ""):
        return value
    return _first_value(_page_context(context), *keys)


def _resolve_favorite_id(args: dict[str, Any], context: Any) -> int | None:
    return _coerce_int(_context_value(args, context, "favorite_id", "favoriteId"))


def _resolve_workspace_id(args: dict[str, Any], context: Any) -> str:
    value = _context_value(args, context, "workspace_id", "workspaceId")
    return str(value).strip() if value not in (None, "") else ""


def _extract_data(response: Any) -> Any:
    if isinstance(response, dict) and "data" in response:
        return response["data"]
    return response


def _list_count(response: Any) -> int:
    data = _extract_data(response)
    return len(data) if isinstance(data, list) else 0


def _is_http_error(response: Any) -> bool:
    return isinstance(response, dict) and response.get("status") == "error"


async def _client_get(
    client: Callable,
    endpoint: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, Any] | None = None,
) -> dict[str, Any]:
    try:
        return await client(endpoint, params=params or {}, headers=headers or {})
    except TypeError as exc:
        if "params" not in str(exc):
            raise
        return await client(endpoint, json=params or {}, headers=headers or {})


async def _latest_favorite(
    client: Callable,
    headers: dict[str, Any],
) -> dict[str, Any] | None:
    try:
        response = await _client_get(
            client,
            "/api/career-development-report/favorites",
            headers=headers,
        )
    except Exception:
        return None
    data = _extract_data(response)
    if isinstance(data, list) and data:
        first = data[0]
        return first if isinstance(first, dict) else None
    return None


async def _resolve_favorite_id_with_fallback(
    args: dict[str, Any],
    context: Any,
    client: Callable,
    headers: dict[str, Any],
) -> int | None:
    favorite_id = _resolve_favorite_id(args, context)
    if favorite_id is not None:
        return favorite_id
    favorite = await _latest_favorite(client, headers)
    return _coerce_int(favorite.get("favorite_id") if favorite else None)


def _profile_summary(analysis: Any) -> dict[str, Any]:
    data = _extract_data(analysis)
    if not isinstance(data, dict):
        return {"available": False, "message": "能力画像数据格式异常"}
    return {
        "available": data.get("available", False),
        "workspace_conversation_id": data.get("workspace_conversation_id"),
        "dimension_count": len(data.get("comparison_dimensions") or []),
        "radar_count": len(data.get("chart_series") or []),
        "priority_gap_dimensions": data.get("priority_gap_dimensions") or [],
        "strength_dimensions": data.get("strength_dimensions") or [],
        "recommended_keyword_dimensions": sorted((data.get("recommended_keywords") or {}).keys()),
        "message": data.get("message"),
    }


def _select_match_report(match_payload: Any, recommendation_id: str) -> dict[str, Any] | None:
    data = _extract_data(match_payload)
    if not isinstance(data, dict):
        return None
    recommendations = data.get("recommendations") or []
    if not isinstance(recommendations, list) or not recommendations:
        return None
    if recommendation_id:
        for item in recommendations:
            if isinstance(item, dict) and item.get("report_id") == recommendation_id:
                return item
    default_report_id = data.get("default_report_id")
    for item in recommendations:
        if isinstance(item, dict) and item.get("report_id") == default_report_id:
            return item
    return recommendations[0] if isinstance(recommendations[0], dict) else None


def _favorite_for_report(favorites_payload: Any, report: dict[str, Any] | None) -> dict[str, Any] | None:
    if not report:
        return None
    data = _extract_data(favorites_payload)
    if not isinstance(data, list):
        return None
    target_key = f"{report.get('canonical_job_title', '')}::{report.get('industry') or ''}"
    for item in data:
        if not isinstance(item, dict):
            continue
        if item.get("report_id") == report.get("report_id") or item.get("target_key") == target_key:
            return item
    return None


# ── ResumeCoach Tools (4 readonly) ───────────────────────────────────────

async def handle_parse_resume(
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    client = http_client or _default_http_client
    headers = _auth_header(context)
    # Query both data sources: home-v2 (basic profile + attachments) and
    # latest-analysis (12-dimension competency profile)
    try:
        home = await client("/api/home-v2", params=args, headers=headers)
    except Exception:
        home = {"status": "error", "detail": "home-v2 unavailable"}
    try:
        analysis = await client(
            "/api/student-competency-profile/latest-analysis",
            params=args, headers=headers,
        )
    except Exception:
        analysis = {"status": "error", "detail": "latest-analysis unavailable"}

    merged = {
        "home": home,
        "latest_analysis": analysis,
    }
    return ToolResult(
        success=True,
        summary=_format_api_response({
            "basic_profile": home.get("data", home),
            "competency_analysis": analysis.get("data", analysis),
        }),
        detail=merged,
    )


async def handle_read_profile(
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    client = http_client or _default_http_client
    headers = _auth_header(context)
    try:
        analysis = await _client_get(
            client,
            "/api/student-competency-profile/latest-analysis",
            params=args, headers=headers,
        )
    except Exception as exc:
        return ToolResult(success=False, error=f"能力画像读取失败：{exc}")

    summary = _profile_summary(analysis)
    return ToolResult(
        success=True,
        summary=_format_api_response({"competency_profile": summary}),
        detail={"latest_analysis": analysis, "summary": summary},
    )


async def handle_analyze_gap(
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    return await readonly_api_handler(
        "/api/career-development-report/personal-growth-report", "POST",
        args, context, http_client,
    )


async def handle_suggest_keyword(
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    return await readonly_api_handler(
        "/api/student-competency-profile/latest-analysis", "GET",
        args, context, http_client,
    )


# ── CareerMatchCoach Tools ──────────────────────────────────────────────

async def handle_search_matches(
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    client = http_client or _default_http_client
    headers = _auth_header(context)
    recommendation_id = str(
        _context_value(args, context, "recommendation_id", "recommendationId", "report_id", "reportId") or ""
    ).strip()
    try:
        init_payload = await _client_get(
            client,
            "/api/career-development-report/job-exploration-match/init",
            params=args,
            headers=headers,
        )
    except Exception as exc:
        return ToolResult(success=False, error=f"职业匹配数据读取失败：{exc}")
    try:
        favorites = await _client_get(
            client,
            "/api/career-development-report/favorites",
            headers=headers,
        )
    except Exception:
        favorites = {"status": "error", "detail": "favorites unavailable"}

    active_report = _select_match_report(init_payload, recommendation_id)
    active_favorite = _favorite_for_report(favorites, active_report)
    data = _extract_data(init_payload)
    recommendations = data.get("recommendations", []) if isinstance(data, dict) else []
    summary = {
        "available": data.get("available") if isinstance(data, dict) else False,
        "recommendation_count": len(recommendations) if isinstance(recommendations, list) else 0,
        "current_report_id": active_report.get("report_id") if active_report else None,
        "current_target": active_report.get("target_title") if active_report else None,
        "current_match": active_report.get("overall_match") if active_report else None,
        "current_is_favorite": active_favorite is not None,
        "favorite_id": active_favorite.get("favorite_id") if active_favorite else None,
    }
    return ToolResult(
        success=True,
        summary=_format_api_response({"career_match": summary}),
        detail={
            "match_init": init_payload,
            "favorites": favorites,
            "active_report": active_report,
            "active_favorite": active_favorite,
            "summary": summary,
        },
    )


async def handle_compare_industries(
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    return await readonly_api_handler(
        "/api/job-requirement-profile/vertical", "GET", args, context, http_client,
    )


async def handle_search_company(
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    return await readonly_api_handler(
        "/api/job-postings", "GET", args, context, http_client,
    )


async def handle_save_to_shortlist(
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    return await readonly_api_handler(
        "/api/career-development-report/favorites", "POST",
        args, context, http_client,
    )


async def handle_read_job_graph(
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    return await readonly_api_handler(
        "/api/job-requirement-profile/graph", "GET",
        args, context, http_client,
    )


# ── LearningPathCoach Tools ─────────────────────────────────────────────

async def handle_read_plan(
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    client = http_client or _default_http_client
    headers = _auth_header(context)
    favorite_id = await _resolve_favorite_id_with_fallback(args, context, client, headers)
    if favorite_id is None:
        return ToolResult(
            success=True,
            summary="缺少 favorite_id，无法读取当前蜗牛学习路径。",
            detail={"available": False, "reason": "missing_favorite_id"},
        )

    endpoint = f"/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}"
    try:
        workspace = await _client_get(client, endpoint, params={}, headers=headers)
    except Exception as exc:
        return ToolResult(success=False, error=f"学习路径工作区读取失败：{exc}")
    if _is_http_error(workspace):
        return ToolResult(
            success=True,
            summary="当前目标尚未生成蜗牛学习路径工作区。",
            detail={"available": False, "favorite_id": favorite_id, "workspace": workspace},
        )

    workspace_data = _extract_data(workspace)
    workspace_id = _resolve_workspace_id(args, context)
    if not workspace_id and isinstance(workspace_data, dict):
        workspace_id = str(workspace_data.get("workspace_id") or "")

    reviews: dict[str, Any] = {}
    if workspace_id:
        for review_type in ("weekly", "monthly"):
            try:
                reviews[review_type] = await _client_get(
                    client,
                    f"/api/career-development-report/snail-learning-path/workspaces/{workspace_id}/reviews",
                    params={"review_type": review_type},
                    headers=headers,
                )
            except Exception as exc:
                reviews[review_type] = {"status": "error", "detail": str(exc)}

    phases = []
    if isinstance(workspace_data, dict):
        phases = workspace_data.get("growth_plan_phases") or workspace_data.get("phases") or []
    overview = workspace_data.get("workspace_overview", {}) if isinstance(workspace_data, dict) else {}
    favorite = workspace_data.get("favorite", {}) if isinstance(workspace_data, dict) else {}
    summary = {
        "available": True,
        "favorite_id": favorite_id,
        "workspace_id": workspace_id or None,
        "target": favorite.get("target_title") or favorite.get("canonical_job_title"),
        "current_phase": overview.get("current_phase_label") or overview.get("current_phase_key"),
        "phase_count": len(phases) if isinstance(phases, list) else 0,
        "weekly_review_count": _list_count(reviews.get("weekly", {})),
        "monthly_review_count": _list_count(reviews.get("monthly", {})),
    }
    return ToolResult(
        success=True,
        summary=_format_api_response({"learning_plan": summary}),
        detail={"workspace": workspace, "reviews": reviews, "summary": summary},
    )


async def handle_suggest_resources(
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    return await handle_read_plan(args, context, http_client)


def evaluate_evidence(evidence: list[dict[str, Any]]) -> float:
    if not evidence:
        return 0.0
    weights = {"quiz": 0.3, "project": 0.4, "certificate": 0.2, "self_report": 0.1}
    score = 0.0
    for e in evidence:
        e_type = e.get("type", "self_report")
        score += weights.get(e_type, 0.05)
    return min(score, 1.0)


def determine_risk(skill_id: str) -> str:
    high_risk = {"algorithm_engineering", "system_design", "full_stack_development"}
    medium_risk = {"data_analysis", "project_management", "team_leadership"}
    if skill_id in high_risk:
        return "high"
    if skill_id in medium_risk:
        return "medium"
    return "low"


async def handle_verify_and_record_progress(
    args: dict[str, Any],
    context: Any = None,
    propose_fn: Callable | None = None,
) -> ToolResult:
    """验证记录进度 (mutation_gated)."""
    skill_id = args.get("skill_id", "")
    evidence = args.get("evidence", [])

    evidence_score = evaluate_evidence(evidence)
    if evidence_score < 0.5:
        return ToolResult(
            success=False,
            error=f"证据不足 (score={evidence_score:.0%})，需要至少 2 项验证来源",
        )

    confidence = evidence_score

    if propose_fn:
        result = await propose_fn(args, context)
        dt = result.get("decision_type", "auto_confirmed")
        return ToolResult(
            success=dt != "rejected",
            summary=f"技能 '{skill_id}' {dt}",
            detail={"decision_type": dt, "mutation_id": result.get("mutation_id", "")},
        )

    return ToolResult(
        success=True,
        summary=f"技能 '{skill_id}' 验证已提交 (confidence={confidence:.0%})",
        detail={"confidence": confidence},
    )


async def handle_append_achievement(
    args: dict[str, Any],
    context: Any = None,
    propose_fn: Callable | None = None,
) -> ToolResult:
    """追加成就 (mutation_gated)."""
    achievement = args.get("achievement", {})
    title = achievement.get("title", "")
    if not title:
        return ToolResult(success=False, error="成就标题不能为空")

    if propose_fn:
        result = await propose_fn(args, context)
        dt = result.get("decision_type", "auto_confirmed")
        return ToolResult(
            success=dt != "rejected",
            summary=f"成就 '{title}' {dt}",
            detail={"decision_type": dt},
        )

    return ToolResult(
        success=True,
        summary=f"成就已追加: {title}",
        detail={"title": title},
    )


async def handle_update_reflection(
    args: dict[str, Any],
    context: Any = None,
    propose_fn: Callable | None = None,
) -> ToolResult:
    """更新反思 (mutation_gated)."""
    reflection = args.get("reflection", "")
    reflection_id = args.get("reflection_id", "")
    if not reflection:
        return ToolResult(success=False, error="反思内容不能为空")

    if propose_fn:
        result = await propose_fn(args, context)
        dt = result.get("decision_type", "auto_confirmed")
        return ToolResult(
            success=dt != "rejected",
            summary=f"反思已更新: {dt}",
            detail={"decision_type": dt},
        )

    return ToolResult(
        success=True,
        summary="反思已更新",
        detail={"reflection_id": reflection_id},
    )


async def handle_create_review(
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    return await readonly_api_handler(
        "/api/snail-learning-path/workspaces", "POST",
        args, context, http_client,
    )


# ── ReportCoach Tools ────────────────────────────────────────────────────

async def handle_read_report(
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    client = http_client or _default_http_client
    headers = _auth_header(context)
    favorite_id = await _resolve_favorite_id_with_fallback(args, context, client, headers)
    if favorite_id is None:
        return ToolResult(
            success=True,
            summary="缺少 favorite_id，无法读取当前个人职业成长报告。",
            detail={"available": False, "reason": "missing_favorite_id"},
        )

    endpoint = f"/api/career-development-report/personal-growth-report/workspaces/{favorite_id}"
    try:
        report = await _client_get(client, endpoint, params={}, headers=headers)
    except Exception as exc:
        return ToolResult(success=False, error=f"成长报告读取失败：{exc}")
    if _is_http_error(report):
        return ToolResult(
            success=True,
            summary="当前目标尚未生成个人职业成长报告。",
            detail={"available": False, "favorite_id": favorite_id, "report": report},
        )

    data = _extract_data(report)
    sections = data.get("sections", []) if isinstance(data, dict) else []
    favorite = data.get("favorite", {}) if isinstance(data, dict) else {}
    summary = {
        "available": True,
        "favorite_id": favorite_id,
        "workspace_id": data.get("workspace_id") if isinstance(data, dict) else None,
        "target": favorite.get("target_title") or favorite.get("canonical_job_title"),
        "section_count": len(sections) if isinstance(sections, list) else 0,
        "completed_sections": [
            item.get("title") or item.get("key")
            for item in sections
            if isinstance(item, dict) and item.get("completed")
        ],
        "last_saved_at": data.get("last_saved_at") if isinstance(data, dict) else None,
        "last_generated_at": data.get("last_generated_at") if isinstance(data, dict) else None,
    }
    return ToolResult(
        success=True,
        summary=_format_api_response({"personal_growth_report": summary}),
        detail={"report": report, "summary": summary},
    )


async def handle_generate_report(
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    return await readonly_api_handler(
        "/api/career-development-report/personal-growth-report/tasks", "POST",
        args, context, http_client,
    )


async def handle_update_section(
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    return await readonly_api_handler(
        "/api/career-development-report/personal-growth-report/workspaces/current", "PUT",
        args, context, http_client,
    )


async def handle_export_report(
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    return await readonly_api_handler(
        "/api/career-development-report/personal-growth-report/workspaces/current/export", "GET",
        args, context, http_client,
    )


# ── Shared Tools ────────────────────────────────────────────────────────

def handle_switch_agent(
    args: dict[str, Any],
    context: Any = None,
) -> ToolResult:
    target = args.get("target", "")
    reason = args.get("reason", "")
    return ToolResult(
        success=True,
        summary=f"切换到 {target}: {reason}" if reason else f"切换到 {target}",
        detail={"target_agent": target, "reason": reason},
    )


async def handle_recall_memory(
    args: dict[str, Any],
    context: Any = None,
    recall_fn: Callable | None = None,
) -> ToolResult:
    query = args.get("query", "")
    top_k = args.get("top_k", 5)

    # Prefer Qdrant + embedding pipeline via context (P2 recall_memory wiring)
    embedding_client = getattr(context, "embedding_client", None) if context is not None else None
    qdrant_search_fn = getattr(context, "qdrant_search_fn", None) if context is not None else None

    if embedding_client and qdrant_search_fn:
        try:
            results = await qdrant_search_fn(
                embedder=embedding_client,
                student_id=getattr(context, "student_id", 0),
                query=query,
                top_k=top_k,
            )
            if results:
                return ToolResult(
                    success=True,
                    summary=f"找到 {len(results)} 条相关记忆",
                    detail={"results": results},
                )
        except Exception:
            logger.exception("recall_memory via Qdrant failed, falling back")

    # Fallback to injected recall_fn
    if recall_fn:
        results = await recall_fn(query, top_k)
        return ToolResult(
            success=True,
            summary=f"找到 {len(results)} 条相关记忆",
            detail={"results": results},
        )

    return ToolResult(
        success=True,
        summary=f"记忆搜索: {query}",
        detail={"results": []},
    )


async def handle_get_home_summary(
    args: dict[str, Any],
    context: Any = None,
    http_client: Callable | None = None,
) -> ToolResult:
    return await readonly_api_handler(
        "/api/home-v2", "GET", args, context, http_client,
    )
