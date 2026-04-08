from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Literal
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.schemas.career_development_report import (
    CareerDevelopmentFavoritePayload,
    GrowthPlanLearningModule,
    GrowthPlanLearningResourceItem,
    GrowthPlanPhase,
)


RouteMode = Literal["workflow", "chat"]


class CareerDevelopmentLearningResourceError(RuntimeError):
    pass


@dataclass(slots=True)
class DifyLearningResourceRuntimeConfig:
    input_variables: list[str]
    app_mode: str | None = None


@dataclass(slots=True)
class DifyLearningResourceResult:
    message_id: str
    answer: str


class DifyCareerLearningResourceClient:
    def __init__(self) -> None:
        api_key = (
            settings.career_goal_knowsearch_dify_api_key
            or settings.career_goal_dify_api_key
            or settings.dify_api_key
        )
        base_url = settings.career_goal_dify_base_url or settings.dify_base_url
        timeout_seconds = float(settings.career_goal_dify_timeout_seconds or settings.dify_timeout_seconds)
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
        )
        self._runtime_config: DifyLearningResourceRuntimeConfig | None = None

    async def aclose(self) -> None:
        await self._client.aclose()

    async def get_runtime_config(self, *, force_refresh: bool = False) -> DifyLearningResourceRuntimeConfig:
        if self._runtime_config is not None and not force_refresh:
            return self._runtime_config

        try:
            response = await self._client.get("/parameters")
            response.raise_for_status()
            body = response.json()
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            raise CareerDevelopmentLearningResourceError(
                f"加载学习路线推荐 Dify 参数失败：{exc}"
            ) from exc

        input_variables: list[str] = []
        for entry in body.get("user_input_form") or []:
            if not isinstance(entry, dict) or len(entry) != 1:
                continue
            _, config = next(iter(entry.items()))
            if not isinstance(config, dict):
                continue
            variable_name = str(config.get("variable") or "").strip()
            if variable_name:
                input_variables.append(variable_name)

        self._runtime_config = DifyLearningResourceRuntimeConfig(
            input_variables=list(dict.fromkeys(input_variables)),
            app_mode=str(body.get("app_mode") or "").strip().lower() or None,
        )
        return self._runtime_config

    async def generate_learning_resources(
        self,
        *,
        favorite: CareerDevelopmentFavoritePayload,
        phase: GrowthPlanPhase,
        module: GrowthPlanLearningModule,
        user: str,
    ) -> DifyLearningResourceResult:
        runtime = await self.get_runtime_config()
        inputs = self._build_inputs(
            favorite=favorite,
            phase=phase,
            module=module,
            input_variables=runtime.input_variables,
        )
        query = self._build_query(favorite=favorite, phase=phase, module=module)

        errors: list[str] = []
        for mode in self._candidate_modes(runtime.app_mode):
            try:
                return await self._request_generation(
                    mode=mode,
                    inputs=inputs,
                    query=query,
                    user=user,
                )
            except CareerDevelopmentLearningResourceError as exc:
                if self._is_route_mismatch(exc):
                    errors.append(str(exc))
                    continue
                raise

        detail = "；".join(errors) if errors else "未找到可用的 Dify 应用路由。"
        raise CareerDevelopmentLearningResourceError(
            f"学习路线推荐失败：{detail}"
        )

    @staticmethod
    def _candidate_modes(app_mode: str | None) -> list[RouteMode]:
        if app_mode and "chat" in app_mode:
            return ["chat", "workflow"]
        if app_mode and "workflow" in app_mode:
            return ["workflow", "chat"]
        return ["workflow", "chat"]

    async def _request_generation(
        self,
        *,
        mode: RouteMode,
        inputs: dict[str, str],
        query: str,
        user: str,
    ) -> DifyLearningResourceResult:
        path = "/workflows/run" if mode == "workflow" else "/chat-messages"
        payload: dict[str, Any] = {
            "inputs": inputs,
            "user": user,
            "response_mode": "streaming",
        }
        if mode == "chat":
            payload["query"] = query

        try:
            async with self._client.stream("POST", path, json=payload) as response:
                if response.is_error:
                    detail = (await response.aread()).decode("utf-8", errors="ignore").strip()
                    raise CareerDevelopmentLearningResourceError(
                        f"Dify 学习路线推荐失败：HTTP {response.status_code}"
                        + (f"，响应为：{detail[:500]}" if detail else "")
                    )
                content_type = (response.headers.get("content-type") or "").lower()
                if "application/json" in content_type:
                    body = json.loads((await response.aread()).decode("utf-8"))
                    return (
                        self._parse_workflow_blocking_body(body)
                        if mode == "workflow"
                        else self._parse_chat_blocking_body(body)
                    )
                return (
                    await self._parse_workflow_stream_body(response)
                    if mode == "workflow"
                    else await self._parse_chat_stream_body(response)
                )
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            raise CareerDevelopmentLearningResourceError(
                f"Dify 学习路线推荐失败：{exc}"
            ) from exc

    @staticmethod
    def _is_route_mismatch(error: CareerDevelopmentLearningResourceError) -> bool:
        message = str(error).lower()
        return any(
            marker in message
            for marker in (
                "not_workflow_app",
                "not_chat_app",
                "not_chatflow_app",
                "not_completion_app",
                "right api route",
            )
        )

    @classmethod
    def _build_inputs(
        cls,
        *,
        favorite: CareerDevelopmentFavoritePayload,
        phase: GrowthPlanPhase,
        module: GrowthPlanLearningModule,
        input_variables: list[str],
    ) -> dict[str, str]:
        report = favorite.report_snapshot
        report_summary = (
            f"目标岗位：{favorite.canonical_job_title}\n"
            f"参考方向：{favorite.target_title}\n"
            f"行业：{favorite.industry or '不限'}\n"
            f"当前总体匹配度：{favorite.overall_match:.2f}%\n"
            f"优先补强项：{'、'.join(report.priority_gap_dimensions[:3]) or '待识别'}\n"
            f"当前阶段：{phase.phase_label}（{phase.time_horizon}）\n"
            f"学习主题：{module.topic}\n"
            f"学习内容：{module.learning_content}"
        )
        candidate_values = {
            "topic": module.topic,
            "learning_content": module.learning_content,
            "phase_label": phase.phase_label,
            "career_title": favorite.canonical_job_title,
            "job_title": favorite.representative_job_title or favorite.target_title,
            "favorite_summary": report_summary,
            "query": cls._build_query(favorite=favorite, phase=phase, module=module),
        }
        if not input_variables:
            return candidate_values

        inputs: dict[str, str] = {}
        for variable_name in input_variables:
            normalized = re.sub(r"[\s_-]+", "", variable_name).lower()
            if any(keyword in normalized for keyword in ("topic", "module", "主题", "模块")):
                inputs[variable_name] = candidate_values["topic"]
            elif any(keyword in normalized for keyword in ("content", "learning", "study", "学习")):
                inputs[variable_name] = candidate_values["learning_content"]
            elif any(keyword in normalized for keyword in ("phase", "stage", "阶段")):
                inputs[variable_name] = candidate_values["phase_label"]
            elif any(keyword in normalized for keyword in ("career", "岗位", "职业")):
                inputs[variable_name] = candidate_values["career_title"]
            elif any(keyword in normalized for keyword in ("job", "position", "target", "目标")):
                inputs[variable_name] = candidate_values["job_title"]
            elif any(keyword in normalized for keyword in ("summary", "report", "overview", "概述", "摘要")):
                inputs[variable_name] = candidate_values["favorite_summary"]
            else:
                inputs[variable_name] = candidate_values["query"]
        return inputs

    @staticmethod
    def _build_query(
        *,
        favorite: CareerDevelopmentFavoritePayload,
        phase: GrowthPlanPhase,
        module: GrowthPlanLearningModule,
    ) -> str:
        return (
            "请根据以下成长路径规划学习模块，推荐 2-4 个合适的中文或英文学习网址，并说明推荐理由。"
            "优先选择官方文档、优质课程、体系化教程或高质量实战资料。"
            "如果可以，请尽量返回 JSON，格式为 resources: [{title, url, reason}]。\n"
            f"- 目标岗位：{favorite.canonical_job_title}\n"
            f"- 参考方向：{favorite.target_title}\n"
            f"- 当前阶段：{phase.phase_label}（{phase.time_horizon}）\n"
            f"- 学习主题：{module.topic}\n"
            f"- 学习内容：{module.learning_content}\n"
        )

    @classmethod
    def _parse_workflow_blocking_body(cls, body: dict[str, Any]) -> DifyLearningResourceResult:
        payload = body.get("data") if isinstance(body.get("data"), dict) else body
        outputs = cls._extract_outputs(payload)
        answer = cls._extract_text_from_outputs(outputs) or str(payload.get("answer") or "").strip()
        message_id = cls._extract_run_id(payload, body)
        if not message_id:
            raise CareerDevelopmentLearningResourceError("Dify workflow 返回中缺少任务标识。")
        if not answer:
            raise CareerDevelopmentLearningResourceError("Dify workflow 已返回结果，但没有解析到可展示内容。")
        return DifyLearningResourceResult(message_id=message_id, answer=answer)

    @staticmethod
    def _parse_chat_blocking_body(body: dict[str, Any]) -> DifyLearningResourceResult:
        answer = str(body.get("answer") or "").strip()
        message_id = str(body.get("message_id") or body.get("id") or "").strip()
        if not message_id:
            raise CareerDevelopmentLearningResourceError("Dify 对话返回中缺少消息标识。")
        if not answer:
            raise CareerDevelopmentLearningResourceError("Dify 对话已返回结果，但没有解析到可展示内容。")
        return DifyLearningResourceResult(message_id=message_id, answer=answer)

    @classmethod
    async def _parse_workflow_stream_body(cls, response: httpx.Response) -> DifyLearningResourceResult:
        answer_chunks: list[str] = []
        current_event: str | None = None
        message_id = ""
        final_outputs: dict[str, Any] = {}

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
            if event_name == "ping":
                continue
            if event_name == "error":
                raise CareerDevelopmentLearningResourceError(
                    str(body.get("message") or body.get("error") or "Dify workflow 返回错误。")
                )

            message_id = message_id or cls._extract_run_id(body.get("data"), body) or ""
            if event_name in {"message", "agent_message"}:
                fragment = body.get("answer") or body.get("text") or ""
                if isinstance(fragment, str) and fragment:
                    answer_chunks.append(fragment)
                continue
            if event_name == "text_chunk":
                fragment = body.get("text")
                if not isinstance(fragment, str):
                    data = body.get("data") if isinstance(body.get("data"), dict) else {}
                    fragment = data.get("text") or data.get("chunk") or data.get("answer") or ""
                if isinstance(fragment, str) and fragment:
                    answer_chunks.append(fragment)
                continue
            if event_name == "workflow_finished":
                final_outputs = cls._extract_outputs(body.get("data"))
                break

        answer = "".join(answer_chunks).strip() or cls._extract_text_from_outputs(final_outputs)
        if not message_id:
            raise CareerDevelopmentLearningResourceError("Dify workflow 流式响应缺少任务标识。")
        if not answer:
            raise CareerDevelopmentLearningResourceError("Dify workflow 已完成，但没有解析到内容。")
        return DifyLearningResourceResult(message_id=message_id, answer=answer)

    @staticmethod
    async def _parse_chat_stream_body(response: httpx.Response) -> DifyLearningResourceResult:
        answer_chunks: list[str] = []
        current_event: str | None = None
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
                raise CareerDevelopmentLearningResourceError(
                    str(body.get("message") or body.get("error") or "Dify 对话返回错误。")
                )

            candidate_message_id = str(body.get("message_id") or body.get("id") or "").strip()
            if candidate_message_id:
                message_id = candidate_message_id

            if event_name in {"message", "agent_message"}:
                fragment = body.get("answer") or body.get("text") or ""
                if isinstance(fragment, str) and fragment:
                    answer_chunks.append(fragment)
                continue
            if event_name == "message_end":
                break

        answer = "".join(answer_chunks).strip()
        if not message_id:
            raise CareerDevelopmentLearningResourceError("Dify 对话流式响应缺少消息标识。")
        if not answer:
            raise CareerDevelopmentLearningResourceError("Dify 对话已完成，但没有解析到内容。")
        return DifyLearningResourceResult(message_id=message_id, answer=answer)

    @staticmethod
    def _extract_run_id(payload: Any, fallback: Any = None) -> str | None:
        candidates: list[Any] = []
        if isinstance(payload, dict):
            candidates.extend(
                [payload.get("workflow_run_id"), payload.get("task_id"), payload.get("message_id"), payload.get("id")]
            )
        if isinstance(fallback, dict):
            candidates.extend(
                [fallback.get("workflow_run_id"), fallback.get("task_id"), fallback.get("message_id"), fallback.get("id")]
            )
        for candidate in candidates:
            text = str(candidate or "").strip()
            if text:
                return text
        return None

    @staticmethod
    def _extract_outputs(payload: Any) -> dict[str, Any]:
        if not isinstance(payload, dict):
            return {}
        outputs = payload.get("outputs")
        return outputs if isinstance(outputs, dict) else {}

    @classmethod
    def _extract_text_from_outputs(cls, outputs: dict[str, Any]) -> str:
        if not outputs:
            return ""
        for key in (
            "resources",
            "recommendations",
            "items",
            "data",
            "answer",
            "text",
            "result",
            "output",
            "content",
        ):
            text = cls._stringify_output_value(outputs.get(key))
            if text:
                return text
        fragments = [cls._stringify_output_value(value) for value in outputs.values()]
        return "\n".join(fragment for fragment in fragments if fragment).strip()

    @staticmethod
    def _stringify_output_value(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, (list, dict)):
            return json.dumps(value, ensure_ascii=False)
        return str(value).strip()


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
    step_label = str(raw.get("step_label") or raw.get("step") or raw.get("姝ラ鏍囩") or "").strip()
    why_first = str(raw.get("why_first") or raw.get("涓轰粈涔堝厛瀛?") or "").strip()
    expected_output = str(raw.get("expected_output") or raw.get("瀛︿範浜у嚭") or "").strip()
    return GrowthPlanLearningResourceItem(
        title=title,
        url=url,
        reason=reason,
        step_label=step_label,
        why_first=why_first,
        expected_output=expected_output,
    )


def _looks_like_resource_collection(raw: Any) -> bool:
    if not isinstance(raw, list) or not raw:
        return False
    return any(
        isinstance(item, dict)
        and any(
            key in item
            for key in (
                "url",
                "link",
                "href",
                "website",
                "web_url",
                "resource_url",
                "resource_link",
                "推荐网址",
                "网址",
                "链接",
                "网站",
            )
        )
        for item in raw
    )


def _find_resource_collections(raw: Any) -> list[list[dict[str, Any]]]:
    collections: list[list[dict[str, Any]]] = []
    if _looks_like_resource_collection(raw):
        collections.append([item for item in raw if isinstance(item, dict)])
        return collections
    if isinstance(raw, dict):
        for value in raw.values():
            collections.extend(_find_resource_collections(value))
    elif isinstance(raw, list):
        for value in raw:
            collections.extend(_find_resource_collections(value))
    return collections


def _extract_json_candidate(answer: str) -> Any | None:
    text = answer.strip()
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
    list_start = text.find("[")
    list_end = text.rfind("]")
    if list_start >= 0 and list_end > list_start:
        candidates.append(text[list_start : list_end + 1])

    for candidate in candidates:
        try:
            return json.loads(candidate)
        except (json.JSONDecodeError, TypeError, ValueError):
            continue
    return None


def parse_learning_resource_recommendations(
    answer: str,
    *,
    fallback_title: str,
) -> list[GrowthPlanLearningResourceItem]:
    payload = _extract_json_candidate(answer)
    if payload is not None:
        for collection in _find_resource_collections(payload):
            items = [_coerce_resource_item(item) for item in collection]
            normalized = [item for item in items if item is not None]
            if normalized:
                return normalized
        if isinstance(payload, dict):
            item = _coerce_resource_item(payload)
            if item is not None:
                return [item]
        if isinstance(payload, list):
            items = [_coerce_resource_item(item) for item in payload]
            normalized = [item for item in items if item is not None]
            if normalized:
                return normalized

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


async def generate_learning_resources_for_phases(
    *,
    favorite: CareerDevelopmentFavoritePayload,
    phases: list[GrowthPlanPhase],
    user_id: int,
    favorite_id: int,
) -> list[GrowthPlanPhase]:
    client = DifyCareerLearningResourceClient()
    try:
      updated_phases = [phase.model_copy(deep=True) for phase in phases]
      for phase in updated_phases:
          for index, module in enumerate(phase.learning_modules, start=1):
              module_id = module.module_id or f"{phase.phase_key}-module-{index}"
              module.module_id = module_id
              try:
                  result = await client.generate_learning_resources(
                      favorite=favorite,
                      phase=phase,
                      module=module,
                      user=f"career-goal-resource-{user_id}-{favorite_id}-{module_id}",
                  )
                  recommendations = parse_learning_resource_recommendations(
                      result.answer,
                      fallback_title=module.topic,
                  )
                  if not recommendations:
                      raise CareerDevelopmentLearningResourceError(
                          "未能从 Dify 返回中解析出有效学习路线链接。"
                      )
                  module.resource_recommendations = recommendations
                  module.resource_status = "ready"
                  module.resource_error_message = ""
              except CareerDevelopmentLearningResourceError as exc:
                  module.resource_status = "failed"
                  module.resource_error_message = str(exc)
      return updated_phases
    finally:
      await client.aclose()
