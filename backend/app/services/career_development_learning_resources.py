from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import httpx

from app.core.config import settings
from app.schemas.career_development_report import (
    CareerDevelopmentFavoritePayload,
    GrowthPlanLearningResourceItem,
    GrowthPlanPhase,
)


TRACKING_QUERY_PARAM_PREFIXES = ("utm_",)
TRACKING_QUERY_PARAMS = {
    "feature",
    "feature_id",
    "featureid",
    "fbclid",
    "from",
    "from_source",
    "gclid",
    "igshid",
    "mc_cid",
    "mc_eid",
    "share",
    "share_channel",
    "share_medium",
    "share_source",
    "si",
    "source",
    "spm",
    "src",
    "yclid",
}


class CareerDevelopmentLearningResourceError(RuntimeError):
    pass


@dataclass(slots=True)
class DifyLearningResourceResult:
    message_id: str
    answer: str


class DifyKnowsearchClient:
    """简化版 Dify 客户端，专用于"去哪里学"场景。

    - 固定调用 /chat-messages（streaming 模式，blocking 模式在 advanced-chat 下有 bug）
    - query 格式：{canonical_job_title}：{topic}
    - 解析 Dify SSE 流中的 answer JSON：{"index": [{"url": "...", "reason": "..."}]}
    """

    def __init__(self) -> None:
        api_key = (
            settings.career_goal_knowsearch_dify_api_key
            or settings.career_goal_dify_api_key
            or settings.dify_api_key
        )
        base_url = settings.career_goal_dify_base_url or settings.dify_base_url
        timeout_seconds = float(
            settings.career_goal_dify_timeout_seconds or settings.dify_timeout_seconds
        )
        if not api_key:
            raise CareerDevelopmentLearningResourceError(
                "学习路线推荐 Dify API key 缺失，请检查 backend/.env。"
            )

        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(
                timeout=timeout_seconds,
                connect=min(timeout_seconds, 30.0),
                read=max(timeout_seconds, 600.0),
                write=min(timeout_seconds, 30.0),
                pool=min(timeout_seconds, 30.0),
            ),
            headers={"Authorization": f"Bearer {api_key}"},
            trust_env=False,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    def build_query(
        self,
        *,
        canonical_job_title: str,
        topic: str,
    ) -> str:
        """极简 query：职业 + 学习模块 topic，无其他内容。"""
        return f"{canonical_job_title}：{topic}"

    async def generate_for_module(
        self,
        *,
        canonical_job_title: str,
        topic: str,
        user: str,
    ) -> DifyLearningResourceResult:
        """对单个 learning_module 调用 Dify SSE 流，累积 answer 并返回。

        Dify advanced-chat 的 blocking 模式在 workflow 下有 bug（只返回 ping 后卡住），
        因此改用 streaming 模式并手动解析 SSE 流。
        """
        query = self.build_query(
            canonical_job_title=canonical_job_title,
            topic=topic,
        )
        payload: dict[str, Any] = {
            "query": query,
            "user": user,
            "response_mode": "streaming",
            "inputs": {},
        }

        accumulated_answer = ""
        message_id = ""

        try:
            async with self._client.stream("POST", "/chat-messages", json=payload) as response:
                if response.status_code >= 400:
                    body = await response.text()
                    raise CareerDevelopmentLearningResourceError(
                        f"Dify 学习路线推荐请求失败：HTTP {response.status_code}，响应：{body[:500]}"
                    )

                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:].strip()
                    if not data_str:
                        continue
                    try:
                        event_data: dict[str, Any] = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    event_type = str(event_data.get("event") or "")

                    # 累积 answer 片段
                    if event_type in ("message", "agent_message"):
                        chunk = str(event_data.get("answer") or "")
                        accumulated_answer += chunk

                    # 提取 message_id
                    if not message_id:
                        mid = str(event_data.get("message_id") or event_data.get("id") or "")
                        if mid:
                            message_id = mid

                    # 流结束，停止读取
                    if event_type in ("message_end", "workflow_finished"):
                        break

        except httpx.HTTPError as exc:
            raise CareerDevelopmentLearningResourceError(
                f"Dify 学习路线推荐请求失败：{exc}"
            ) from exc

        accumulated_answer = accumulated_answer.strip()
        if not accumulated_answer:
            raise CareerDevelopmentLearningResourceError(
                "Dify 已返回结果，但 answer 内容为空。"
            )

        return DifyLearningResourceResult(
            message_id=message_id or "unknown",
            answer=accumulated_answer,
        )


def _parse_index_from_answer(
    answer: str,
) -> list[dict[str, str]]:
    """从 Dify answer 中提取 {"index": [...]} JSON。"""
    text = answer.strip()
    candidates: list[str] = [text]

    # 尝试提取代码块内的 JSON
    if "```" in text:
        for segment in text.split("```"):
            cleaned = segment.strip()
            if not cleaned:
                continue
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            candidates.append(cleaned)

    # 尝试提取 {...} 或 [...]
    for start_char, end_char in [("{", "}"), ("[", "]")]:
        start = text.find(start_char)
        end = text.rfind(end_char)
        if start >= 0 and end > start:
            candidates.append(text[start : end + 1])

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except (json.JSONDecodeError, TypeError, ValueError):
            continue

        # 顶层 {"index": [...]} 或直接返回 [...]
        index: list[dict[str, str]] | None = None
        if isinstance(parsed, dict):
            raw = parsed.get("index") or parsed.get("resources") or parsed.get("data") or []
            if isinstance(raw, list):
                index = raw
        elif isinstance(parsed, list):
            index = parsed

        if index:
            return [
                {
                    "url": str(item.get("url") or item.get("link") or item.get("href") or ""),
                    "reason": str(item.get("reason") or item.get("description") or item.get("推荐理由") or ""),
                }
                for item in index
                if isinstance(item, dict) and (item.get("url") or item.get("link") or item.get("href"))
            ]

    return []


def _coerce_resource_item(raw: Any) -> GrowthPlanLearningResourceItem | None:
    if not isinstance(raw, dict):
        return None
    url = str(
        raw.get("url")
        or raw.get("link")
        or raw.get("href")
        or raw.get("website")
        or raw.get("web_url")
        or raw.get("resource_url")
        or raw.get("resource_link")
        or raw.get("推荐网址")
        or raw.get("网址")
        or raw.get("链接")
        or raw.get("网站")
        or ""
    ).strip()
    if not url:
        return None
    title = str(
        raw.get("title")
        or raw.get("name")
        or raw.get("label")
        or raw.get("标题")
        or raw.get("名称")
        or urlparse(url).netloc
        or url
    ).strip()
    reason = str(
        raw.get("reason")
        or raw.get("description")
        or raw.get("summary")
        or raw.get("reasoning")
        or raw.get("note")
        or raw.get("推荐理由")
        or raw.get("理由")
        or raw.get("说明")
        or raw.get("适用场景")
        or ""
    ).strip()
    if not reason:
        reason = "可作为当前学习主题的延伸参考资料。"
    return GrowthPlanLearningResourceItem(
        title=title,
        url=url,
        reason=reason,
    )


def parse_learning_resource_recommendations(
    answer: str,
    *,
    fallback_title: str,
) -> list[GrowthPlanLearningResourceItem]:
    """从 Dify answer 中解析学习资源 URL。

    优先从 {"index": [...]} JSON 中提取；
    JSON 解析失败则 fallback 到正则提取 markdown/bare URL。
    """
    index_items = _parse_index_from_answer(answer)
    if index_items:
        items = [_coerce_resource_item(item) for item in index_items]
        normalized = [item for item in items if item is not None]
        if normalized:
            return normalized

    # Fallback: 正则提取 markdown 链接
    resources: list[GrowthPlanLearningResourceItem] = []
    markdown_link_pattern = re.compile(r"\[(?P<title>[^\]]+)\]\((?P<url>https?://[^)\s]+)\)")
    used_urls: set[str] = set()

    for match in markdown_link_pattern.finditer(answer):
        title = match.group("title").strip() or fallback_title
        url = match.group("url").strip()
        if url in used_urls:
            continue
        line = next((raw.strip("- ").strip() for raw in answer.splitlines() if url in raw), "")
        reason = line.replace(match.group(0), "").strip("：:- ") or "可作为当前学习主题的延伸参考资料。"
        resources.append(GrowthPlanLearningResourceItem(title=title, url=url, reason=reason))
        used_urls.add(url)

    if resources:
        return resources

    # Fallback: bare URL
    bare_url_pattern = re.compile(r"https?://[^\s)\]]+")
    for raw_line in answer.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        url_match = bare_url_pattern.search(line)
        if url_match is None:
            continue
        url = url_match.group(0).strip()
        if url in used_urls:
            continue
        prefix = line[: url_match.start()].strip("：:- ")
        suffix = line[url_match.end() :].strip("：:- ")
        title = prefix or fallback_title or (urlparse(url).netloc or url)
        reason = suffix or "可作为当前学习主题的延伸参考资料。"
        resources.append(GrowthPlanLearningResourceItem(title=title, url=url, reason=reason))
        used_urls.add(url)

    return resources


def normalize_learning_resource_domain(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    parsed = urlparse(raw if "://" in raw else f"https://{raw}")
    host = (parsed.netloc or parsed.path or "").strip().lower()
    if host.startswith("www."):
        host = host[4:]
    if ":" in host:
        hostname, port = host.rsplit(":", 1)
        if port in {"80", "443"}:
            host = hostname
    return host


def normalize_learning_resource_url(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return ""
    parsed = urlparse(raw)
    host = normalize_learning_resource_domain(parsed.netloc or parsed.path)
    if not host:
        return raw.rstrip("/").lower()

    path = (parsed.path or "").rstrip("/")
    filtered_query = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if key.lower() not in TRACKING_QUERY_PARAMS
        and not any(key.lower().startswith(prefix) for prefix in TRACKING_QUERY_PARAM_PREFIXES)
    ]
    query = urlencode(filtered_query, doseq=True)
    normalized = urlunparse(("", host, path, "", query, ""))
    return normalized.lstrip("/")


def filter_learning_resource_recommendations(
    recommendations: list[GrowthPlanLearningResourceItem],
    *,
    excluded_urls: list[str] | None = None,
    excluded_domains: list[str] | None = None,
    allow_same_domain_if_empty: bool = True,
) -> list[GrowthPlanLearningResourceItem]:
    normalized_excluded_urls = {
        normalized
        for normalized in (normalize_learning_resource_url(item) for item in (excluded_urls or []))
        if normalized
    }
    normalized_excluded_domains = {
        normalized
        for normalized in (normalize_learning_resource_domain(item) for item in (excluded_domains or []))
        if normalized
    }

    filtered: list[GrowthPlanLearningResourceItem] = []
    seen_urls: set[str] = set()
    seen_domains: set[str] = set()
    url_only_candidates: list[tuple[GrowthPlanLearningResourceItem, str]] = []

    for item in recommendations:
        normalized_url = normalize_learning_resource_url(item.url)
        normalized_domain = normalize_learning_resource_domain(item.url)
        if not normalized_url or not normalized_domain:
            continue
        if normalized_url in normalized_excluded_urls:
            continue
        if normalized_domain in normalized_excluded_domains:
            continue
        if normalized_url in seen_urls:
            continue
        url_only_candidates.append((item, normalized_url))
        if normalized_domain in seen_domains:
            continue
        filtered.append(item)
        seen_urls.add(normalized_url)
        seen_domains.add(normalized_domain)

    if filtered or not allow_same_domain_if_empty:
        return filtered

    fallback_filtered: list[GrowthPlanLearningResourceItem] = []
    fallback_seen_urls: set[str] = set()
    for item, normalized_url in url_only_candidates:
        if normalized_url in fallback_seen_urls:
            continue
        fallback_filtered.append(item)
        fallback_seen_urls.add(normalized_url)

    if fallback_filtered:
        return fallback_filtered

    return filtered


async def generate_learning_resources_for_phases(
    *,
    favorite: CareerDevelopmentFavoritePayload,
    phases: list[GrowthPlanPhase],
    user_id: int,
    favorite_id: int,
) -> list[GrowthPlanPhase]:
    """为每个 learning_module 调用 Dify，填充 resource_recommendations。

    每个 learning_module 调用一次 Dify（2 topic × 3 阶段 = 6 次）。
    query 格式：{canonical_job_title}：{topic}
    Dify 返回 JSON：{"index": [{"url": "...", "reason": "..."}]}
    """
    client = DifyKnowsearchClient()
    _logger = logging.getLogger(__name__)
    try:
        updated_phases = [phase.model_copy(deep=True) for phase in phases]

        for phase in updated_phases:
            for index, module in enumerate(phase.learning_modules, start=1):
                module_id = module.module_id or f"{phase.phase_key}-module-{index}"
                module.module_id = module_id

                try:
                    result = await client.generate_for_module(
                        canonical_job_title=favorite.canonical_job_title,
                        topic=module.topic,
                        user=f"career-goal-resource-{user_id}-{favorite_id}-{module_id}",
                    )
                    _logger.info(
                        "[Dify] module=%s topic=%s answer_len=%d answer_preview=%s",
                        module_id,
                        module.topic,
                        len(result.answer),
                        result.answer[:200],
                    )
                    recommendations = parse_learning_resource_recommendations(
                        result.answer,
                        fallback_title=module.topic,
                    )
                    _logger.info(
                        "[Dify] module=%s recommendations_count=%d",
                        module_id,
                        len(recommendations),
                    )
                    if not recommendations:
                        # Dify 返回了结果但为空，不算失败；设置 idle 让前端走 fallback 静态资源
                        module.resource_recommendations = []
                        module.resource_status = "idle"
                        module.resource_error_message = "Dify 返回结果为空，已使用默认学习资源。"
                    else:
                        # 直接使用 Dify 返回的推荐，不过滤
                        module.resource_recommendations = recommendations
                        module.resource_status = "ready"
                        module.resource_error_message = ""

                except CareerDevelopmentLearningResourceError as exc:
                    module.resource_status = "failed"
                    module.resource_error_message = str(exc)

        return updated_phases
    finally:
        await client.aclose()
