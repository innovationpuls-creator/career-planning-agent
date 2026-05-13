from __future__ import annotations

import json
import logging
import time
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

from app.services.llm import ChatMessage, OpenAICompatibleLLMClient, desensitize
from app.services.memory.manager import MemoryManager
from app.services.memory.proposal_handler import handle_memory_proposal
from app.services.outbox.emitter import OutboxEmitter
from app.services.token_budget import TokenBudget, compact_context_async
from app.services.tools.executor import ToolExecutor
from app.services.tool_registry import ToolRegistry, ToolRegistryError

logger = logging.getLogger(__name__)

_MAX_TURNS = 5  # prevent infinite tool-call loops

_CAREER_RECOMMENDATION_KEYWORDS = (
    "适合",
    "推荐",
    "匹配",
    "最匹配",
    "什么职业",
    "什么岗位",
    "职业方向",
    "做什么",
)

_CATEGORY_LISTING_KEYWORDS = (
    "岗位大类",
    "岗位类别",
    "职业大类",
    "职业类别",
    "分类",
    "类别",
    "有哪些岗位",
    "岗位列表",
)


class CoachCoordinator:
    """Manages the tool-call loop during coach chat streaming.

    Uses a single streaming LLM call per turn. Tool calls are accumulated
    from the stream, executed, and their results fed back to the LLM.
    Loops until the model responds with text only (no tool calls) or
    max turns is reached.
    """

    def __init__(
        self,
        llm_client: OpenAICompatibleLLMClient,
        tool_registry: ToolRegistry,
        *,
        memory_manager: MemoryManager | None = None,
        student_id: int = 0,
        session_id: str = "",
        agent: str = "",
        db: Session | None = None,
        outbox_emitter: OutboxEmitter | None = None,
        tool_executor: ToolExecutor | None = None,
        embedding_client: Any = None,
        qdrant_path: str = "",
    ) -> None:
        self._llm = llm_client
        self._tool_registry = tool_registry
        self._memory_manager = memory_manager
        self._student_id = student_id
        self._session_id = session_id
        self._agent = agent
        self._db = db
        self._trace_id = f"trace_{uuid4().hex[:12]}"
        self._token_budget = TokenBudget()
        self._outbox_emitter = outbox_emitter
        self._tool_executor = tool_executor
        self._embedding_client = embedding_client
        self._qdrant_path = qdrant_path

    # ── Public entry point ──────────────────────────────────────────────

    async def run(
        self,
        system_prompt: str,
        user_message: str,
        *,
        agent: str | None = None,
        client_message_id: str | None = None,
        attachments_json: str | None = None,
        attachment_context: str | None = None,
        page_context: dict[str, Any] | None = None,
        selected_skill: dict[str, Any] | None = None,
        selected_skill_ready: bool = True,
        route_rule: str | None = None,
        route_matched: str | None = None,
        title: str | None = None,
    ) -> AsyncGenerator[bytes, None]:
        """Execute coach chat and emit the run-oriented NDJSON protocol."""
        agent = agent or self._agent
        assistant_msg_id = f"assistant-{uuid4().hex[:12]}"
        run_trace: list[dict[str, Any]] = []
        metrics = {"steps": 0, "tools": 0, "memories": 0}
        active_answer_step_id: str | None = None

        # ── Build message list ──────────────────────────────────────
        messages: list[ChatMessage] = [
            ChatMessage(role="system", content=system_prompt, cache_control=True),
        ]

        if self._memory_manager and self._session_id:
            try:
                history = self._memory_manager.get_messages(self._session_id)
                for msg in history:
                    messages.append(ChatMessage(role=msg.role, content=msg.content))
            except Exception:
                logger.exception("Failed to load session history for LLM context")

        # Desensitize user input before sending to LLM (C4 fix)
        llm_user_message = user_message
        if attachment_context:
            llm_user_message = f"{user_message}\n\n{attachment_context}"
        if page_context:
            llm_user_message = (
                f"{llm_user_message}\n\n"
                f"## 当前页面上下文\n{json.dumps(page_context, ensure_ascii=False)}"
            )
        if selected_skill:
            llm_user_message = (
                f"{llm_user_message}\n\n"
                f"## 用户选择的教练能力\n"
                f"{json.dumps(selected_skill, ensure_ascii=False)}"
            )
        safe_user_message = desensitize(llm_user_message)
        messages.append(ChatMessage(role="user", content=safe_user_message))

        # Persist user message (original text, not desensitized)
        if self._memory_manager:
            try:
                self._memory_manager.add_message(
                    session_id=self._session_id,
                    role="user",
                    content=user_message,
                    client_message_id=client_message_id,
                    active_agent=agent,
                attachments_json=attachments_json,
                page_context=page_context,
            )
                if agent:
                    self._memory_manager.update_session_agent(self._session_id, agent)
            except Exception:
                logger.exception("Failed to persist user message")

        # ── Run start event ────────────────────────────────────────
        yield self._emit({
            "event": "run_start",
            "sessionId": self._session_id,
            "assistantMessageId": assistant_msg_id,
            "activeAgent": agent,
            "title": title or user_message[:50] or "新对话",
        })
        route_step = self._make_step(
            step_id="route",
            kind="route",
            status="success",
            title="识别任务意图",
            summary=f"交给 {agent or '职业规划教练'} 处理",
            detail={
                "routeLevel": route_rule or "",
                "matchedRule": route_matched or route_rule or "",
            },
            agent=agent,
        )
        self._record_step(run_trace, route_step)
        metrics["steps"] += 1
        yield self._emit(route_step)

        blocked_skill = self._blocked_selected_skill(
            selected_skill,
            selected_skill_ready,
        )
        blocked_tools = {blocked_skill} if blocked_skill else set()
        if blocked_skill:
            check_step = self._make_step(
                step_id=f"skill-check-{blocked_skill}",
                kind="memory",
                status="skipped",
                title="检查写入证据",
                summary="证据不足，本轮不会修改数据。",
                detail={
                    "selectedSkill": blocked_skill,
                    "missing": "需要测验、项目、证书、链接、截图或可验证成果等证据。",
                },
                agent=agent,
            )
            self._record_step(run_trace, check_step)
            metrics["steps"] += 1
            yield self._emit(check_step)

        # ── Token budget check ──────────────────────────────────────
        messages, compacted = await self._check_token_budget(messages)
        if compacted:
            context_step = self._make_step(
                step_id="context-compaction",
                kind="context",
                status="success",
                title="整理上下文",
                summary="对话较长，已压缩早期上下文。",
            )
            self._record_step(run_trace, context_step)
            metrics["steps"] += 1
            yield self._emit(context_step)

        tool_schemas = self._get_tool_schemas_for_turn(
            agent,
            user_message,
            selected_skill=selected_skill,
            selected_skill_ready=selected_skill_ready,
        )
        assistant_text_parts: list[str] = []
        all_tool_calls_json: list[dict] = []

        # ── Streaming loop (max _MAX_TURNS) ─────────────────────────
        for turn in range(_MAX_TURNS):
            turn_text = ""
            turn_thinking = ""
            tool_calls_acc: dict[int, dict] = {}
            active_answer_step_id = f"answer-{turn + 1}"
            answer_started_at = time.monotonic()
            answer_step = self._make_step(
                step_id=active_answer_step_id,
                kind="answer",
                status="running",
                title="生成答复",
                summary="正在组织回复内容。",
                agent=agent,
            )
            self._record_step(run_trace, answer_step)
            metrics["steps"] += 1
            yield self._emit(answer_step)

            try:
                async for chunk in self._llm._chat_completion_stream_raw(
                    messages, tools=tool_schemas, temperature=0.0
                ):
                    # ── Thinking ────────────────────────────────
                    thinking = chunk.get("thinking")
                    if thinking:
                        turn_thinking += thinking

                    # ── Text delta ──────────────────────────────
                    content = chunk.get("content")
                    if content:
                        turn_text += content
                        assistant_text_parts.append(content)
                        yield self._emit(
                            {"event": "answer_delta", "delta": desensitize(content)}
                        )

                    # ── Tool call start ─────────────────────────
                    tc_start = chunk.get("tool_call_start")
                    if tc_start:
                        idx = tc_start["index"]
                        tool_calls_acc[idx] = {
                            "id": tc_start["id"],
                            "name": tc_start["name"],
                            "args": "",
                        }
                        tool_obj = self._tool_registry.get(tc_start["name"])
                        if active_answer_step_id:
                            answer_step = self._make_step(
                                step_id=active_answer_step_id,
                                kind="answer",
                                status="success",
                                title="生成答复",
                                summary="需要先调用工具补充资料。",
                                duration_ms=self._elapsed_ms(answer_started_at),
                                agent=agent,
                            )
                            self._record_step(run_trace, answer_step)
                            yield self._emit(answer_step)
                            active_answer_step_id = None
                        tool_step = self._make_step(
                            step_id=f"tool-{tc_start['id']}",
                            kind="tool",
                            status="running",
                            title=f"调用工具：{tool_obj.display_name if tool_obj else tc_start['name']}",
                            summary="正在执行工具。",
                            agent=agent,
                            tool_name=tc_start["name"],
                            related_tool_call_id=tc_start["id"],
                        )
                        self._record_step(run_trace, tool_step)
                        metrics["steps"] += 1
                        metrics["tools"] += 1
                        yield self._emit(tool_step)

                    # ── Tool call args ──────────────────────────
                    tc_args = chunk.get("tool_call_args")
                    if tc_args:
                        idx = tc_args["index"]
                        if idx in tool_calls_acc:
                            tool_calls_acc[idx]["args"] += tc_args["args"]

            except Exception as exc:
                logger.exception("Coach coordinator LLM stream failed (turn %d)", turn)
                visible_message = (
                    "资料已查询完成，但回答生成失败，请重试。"
                    if all_tool_calls_json
                    else "回答生成失败，请重试。"
                )
                if active_answer_step_id:
                    answer_step = self._make_step(
                        step_id=active_answer_step_id,
                        kind="answer",
                        status="error",
                        title="生成答复",
                        summary=visible_message,
                        duration_ms=self._elapsed_ms(answer_started_at),
                        agent=agent,
                    )
                    self._record_step(run_trace, answer_step)
                    yield self._emit(answer_step)
                yield self._emit({
                    "event": "run_error",
                    "code": "STREAM_ERROR",
                    "message": visible_message,
                    "retryable": True,
                    "failedStepId": active_answer_step_id,
                })
                self._persist(assistant_text_parts, agent, all_tool_calls_json or None, run_trace)
                return

            # ── No tool calls → model is done ──────────────────────
            if not tool_calls_acc:
                if active_answer_step_id:
                    answer_step = self._make_step(
                        step_id=active_answer_step_id,
                        kind="answer",
                        status="success",
                        title="生成答复",
                        summary="答复已生成。",
                        duration_ms=self._elapsed_ms(answer_started_at),
                        agent=agent,
                    )
                    self._record_step(run_trace, answer_step)
                    yield self._emit(answer_step)
                break

            # ── Build tool_calls list and append assistant message ─
            turn_tool_calls = self._build_tool_calls_json(tool_calls_acc)
            all_tool_calls_json.extend(turn_tool_calls)

            messages.append(ChatMessage(
                role="assistant",
                content=turn_text or None,
                tool_calls=turn_tool_calls,
                reasoning_content=turn_thinking or None,
            ))

            # ── Execute each tool and inject results ───────────────
            for tc in turn_tool_calls:
                tool_name = tc["function"]["name"]
                tool_call_id = tc["id"]

                try:
                    tool_args = json.loads(tc["function"]["arguments"])
                except json.JSONDecodeError:
                    tool_args = {}

                # Inject student_id — the LLM cannot know the real user ID
                if "student_id" in tool_args and self._student_id:
                    tool_args["student_id"] = str(self._student_id)

                result = await self._execute_tool(
                    tool_name=tool_name,
                    tool_args=tool_args,
                    tool_call_id=tool_call_id,
                    agent=agent,
                    page_context=page_context,
                ) if tool_name not in blocked_tools else {
                    "success": False,
                    "accepted": False,
                    "summary": "证据不足，本轮没有修改数据。",
                    "error": "缺少可验证证据，不能执行写入类教练能力。",
                    "detail": {
                        "missing": "请补充测验、项目、证书、链接、截图或可验证成果。",
                    },
                }
                # Tag accepted status for cascade gating (mutation_gated tools only)
                tc["_accepted"] = result.get("accepted", False)

                if result.get("error") and not result.get("success", True):
                    step_status = "error"
                    step_summary = desensitize(result["error"])
                else:
                    step_status = "success"
                    step_summary = desensitize(result.get("summary", "")) or "工具执行完成。"
                tool_obj = self._tool_registry.get(tool_name)
                tool_step = self._make_step(
                    step_id=f"tool-{tool_call_id}",
                    kind="tool",
                    status=step_status,
                    title=f"调用工具：{tool_obj.display_name if tool_obj else tool_name}",
                    summary=step_summary,
                    detail={
                        "args": self._summarize_mapping(tool_args),
                        "result": self._summarize_mapping(result),
                    },
                    agent=agent,
                    tool_name=tool_name,
                    related_tool_call_id=tool_call_id,
                )
                self._record_step(run_trace, tool_step)
                yield self._emit(tool_step)

                # Represent mutation_gated outcomes as memory run steps.
                if result.get("accepted") is not None:
                    mr_summary = result.get("summary", "")
                    memory_step = self._make_step(
                        step_id=f"memory-{result.get('mutation_id') or tool_call_id}",
                        kind="memory",
                        status="success" if result.get("accepted") else "skipped",
                        title="更新学习记忆",
                        summary=mr_summary or (
                            "记忆已确认" if result.get("accepted") else "记忆变更未通过"
                        ),
                        detail={
                            "decisionType": result.get("decision_type", ""),
                            "targetField": tool_args.get("targetField", tool_args.get("target_field", "")),
                            "confidence": float(tool_args.get("confidence", 0.0)),
                        },
                        agent=agent,
                    )
                    self._record_step(run_trace, memory_step)
                    metrics["steps"] += 1
                    metrics["memories"] += 1
                    yield self._emit(memory_step)

                # Represent switch_agent outcomes as agent-switch run steps.
                if tool_name == "switch_agent":
                    previous_agent = agent
                    target_agent = tool_args.get("target", "")
                    if target_agent and target_agent != previous_agent:
                        agent = target_agent
                        switch_step = self._make_step(
                            step_id=f"agent-switch-{tool_call_id}",
                            kind="agent_switch",
                            status="success",
                            title=f"切换到 {target_agent}",
                            summary=tool_args.get("reason", "") or "已切换负责的子教练。",
                            detail={"from": previous_agent, "to": target_agent},
                            agent=target_agent,
                        )
                        self._record_step(run_trace, switch_step)
                        metrics["steps"] += 1
                        yield self._emit(switch_step)

                # Inject tool result into messages for the next LLM turn
                messages.append(ChatMessage(
                    role="tool",
                    content=self._build_tool_llm_content(result),
                    tool_call_id=tool_call_id,
                ))

            # ── Token budget check between turns ───────────────────
            messages, compacted = await self._check_token_budget(messages)
            if compacted:
                context_step = self._make_step(
                    step_id=f"context-compaction-{turn + 1}",
                    kind="context",
                    status="success",
                    title="整理上下文",
                    summary="对话较长，已压缩早期上下文。",
                )
                self._record_step(run_trace, context_step)
                metrics["steps"] += 1
                yield self._emit(context_step)

        # ── Done ──────────────────────────────────────────────────────
        yield self._emit({
            "event": "run_done",
            "stopReason": "task_complete",
            "sessionId": self._session_id,
            "metrics": metrics,
        })

        self._persist(assistant_text_parts, agent, all_tool_calls_json or None, run_trace)
        self._maybe_save_metadata(agent)
        self._maybe_cascade_events(all_tool_calls_json)

    # ── Tool execution ─────────────────────────────────────────────────

    async def _execute_tool(
        self,
        tool_name: str,
        tool_args: dict[str, Any],
        tool_call_id: str,
        agent: str | None,
        page_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute a single tool, routing mutation_gated through proposal_handler."""
        tool_obj = self._tool_registry.get(tool_name)
        is_mutation_gated = (
            tool_obj is not None and tool_obj.classification == "mutation_gated"
        )

        if is_mutation_gated and self._memory_manager and self._db is not None:
            return self._handle_mutation_gated_tool(
                tool_name=tool_name,
                tool_args=tool_args,
                tool_call_id=tool_call_id,
            )

        if self._tool_executor:
            # Build context with optional recall_memory dependencies
            ctx_attrs: dict[str, Any] = {
                "student_id": self._student_id,
                "trace_id": self._trace_id,
                "active_agent": agent,
                "page_context": page_context or {},
                "pageContext": page_context or {},
            }
            if self._embedding_client and self._qdrant_path:
                ctx_attrs["embedding_client"] = self._embedding_client
                ctx_attrs["qdrant_search_fn"] = self._make_qdrant_search()
            executor_result = await self._tool_executor.execute_with_recovery(
                tool_name=tool_name,
                args=tool_args,
                context=type("_Ctx", (), ctx_attrs)(),
            )
            if executor_result.success:
                return {
                    "success": True,
                    "summary": executor_result.summary,
                    "detail": executor_result.detail,
                }
            return {
                "success": False,
                "summary": executor_result.summary,
                "detail": executor_result.detail,
                "error": executor_result.error,
                "recovery": executor_result.recovery,
            }

        try:
            result = self._tool_registry.execute(tool_name, tool_args)
            return result
        except ToolRegistryError as exc:
            return {"success": False, "error": str(exc)}

    def _get_tool_schemas_for_turn(
        self,
        agent: str | None,
        user_message: str,
        *,
        selected_skill: dict[str, Any] | None = None,
        selected_skill_ready: bool = True,
    ) -> list[dict[str, Any]]:
        """Keep career recommendations on real match data, not category mocks."""
        schemas = self._tool_registry.get_schema_for_llm(agent)
        blocked_skill = self._blocked_selected_skill(
            selected_skill,
            selected_skill_ready,
        )
        if blocked_skill:
            schemas = [
                schema for schema in schemas
                if schema.get("function", {}).get("name") != blocked_skill
            ]
        if not _requires_real_match_data(agent, user_message):
            return schemas
        return [
            schema for schema in schemas
            if schema.get("function", {}).get("name") != "get_job_categories"
        ]

    @staticmethod
    def _blocked_selected_skill(
        selected_skill: dict[str, Any] | None,
        selected_skill_ready: bool,
    ) -> str:
        if not selected_skill:
            return ""
        name = str(selected_skill.get("name") or "")
        if selected_skill.get("classification") != "readonly" and not selected_skill_ready:
            return name
        return ""

    def _handle_mutation_gated_tool(
        self,
        tool_name: str,
        tool_args: dict[str, Any],
        tool_call_id: str,
    ) -> dict[str, Any]:
        """Execute a mutation_gated tool through the proposal_handler chain."""
        if not self._memory_manager or self._db is None:
            return {"error": "MemoryManager or DB not available for mutation_gated tool"}

        try:
            result = handle_memory_proposal(
                db=self._db,
                memory_manager=self._memory_manager,
                student_id=self._student_id,
                target_field=tool_args.get("targetField", tool_args.get("target_field", "")),
                new_value=tool_args.get("newValue", tool_args.get("new_value", "")),
                evidence=tool_args.get("evidence", ""),
                confidence=float(tool_args.get("confidence", 0.0)),
                risk_level=tool_args.get("riskLevel", tool_args.get("risk_level", "low")),
                source_agent=self._agent or tool_name,
                trace_id=self._trace_id,
            )
            return {
                "accepted": result.accepted,
                "decision_type": result.decision_type,
                "mutation_id": result.mutation_id,
                "summary": getattr(result, "summary", "") or (
                    "accepted" if result.accepted
                    else f"rejected: {result.adjudication.reasoning}"
                ),
            }
        except Exception as exc:
            logger.exception("mutation_gated tool %s failed", tool_name)
            return {"error": str(exc)}

    # ── Helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _build_tool_calls_json(tool_calls_acc: dict[int, dict]) -> list[dict]:
        """Convert accumulated tool call fragments to full tool_calls JSON."""
        result: list[dict] = []
        for idx in sorted(tool_calls_acc.keys()):
            tc = tool_calls_acc[idx]
            result.append({
                "id": tc["id"],
                "type": "function",
                "function": {"name": tc["name"], "arguments": tc["args"]},
            })
        return result

    async def _check_token_budget(
        self, messages: list[ChatMessage]
    ) -> tuple[list[ChatMessage], bool]:
        """Check and compact if over threshold.

        Returns (messages, was_compacted). Caller is responsible for
        yielding the "compacting" thinking event when was_compacted is True.
        """
        self._token_budget.recalculate(
            [{"role": m.role, "content": m.content or ""} for m in messages]
        )
        if self._token_budget.usage_ratio <= 0.85:
            return messages, False

        keep_start = self._find_safe_compaction_boundary(messages, keep_last=6)
        older_messages = messages[:keep_start]
        recent_messages = messages[keep_start:]

        compacted = await compact_context_async(
            [{"role": m.role, "content": m.content or ""} for m in older_messages],
            keep_last=1,
            llm_client=self._llm,
        )
        summary = compacted[0]["content"] if compacted else "[压缩的早期对话摘要]"
        return ([ChatMessage(role="system", content=summary), *recent_messages], True)

    @staticmethod
    def _find_safe_compaction_boundary(
        messages: list[ChatMessage],
        keep_last: int,
    ) -> int:
        """Return a split point that never leaves orphan tool messages."""
        if len(messages) <= keep_last:
            return 0
        start = max(len(messages) - keep_last, 0)
        while start > 0 and messages[start].role == "tool":
            start -= 1
        return start

    @staticmethod
    def _build_tool_llm_content(result: dict[str, Any]) -> str:
        payload: dict[str, Any] = {
            "success": result.get("success", True),
            "summary": result.get("summary", ""),
        }
        if result.get("error"):
            payload["error"] = result.get("error")
        if result.get("recovery"):
            payload["recovery"] = result.get("recovery")
        detail = result.get("detail")
        if detail:
            payload["detail"] = CoachCoordinator._bounded_json(detail)
        return json.dumps(payload, ensure_ascii=False)

    @staticmethod
    def _bounded_json(value: Any, limit: int = 4000) -> Any:
        text = json.dumps(value, ensure_ascii=False, default=str)
        if len(text) <= limit:
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return text
        return text[:limit] + "...[truncated]"

    def _make_qdrant_search(self) -> Any:
        """Create a qdrant_search_fn closure for recall_memory tool."""
        qdrant_path = self._qdrant_path

        async def _search(
            embedder: Any,
            student_id: int,
            query: str,
            top_k: int = 5,
        ) -> list[dict[str, Any]]:
            from app.services.student_context_store import search_fragments
            return await search_fragments(
                path=qdrant_path,
                embedder=embedder,
                student_id=student_id,
                query=query,
                top_k=top_k,
            )

        return _search

    @staticmethod
    def _emit(data: dict[str, object]) -> bytes:
        """Serialize a single NDJSON event line."""
        return json.dumps(data, ensure_ascii=False).encode("utf-8") + b"\n"

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(UTC).isoformat()

    @staticmethod
    def _elapsed_ms(started_at: float) -> int:
        return max(0, int((time.monotonic() - started_at) * 1000))

    @classmethod
    def _make_step(
        cls,
        *,
        step_id: str,
        kind: str,
        status: str,
        title: str,
        summary: str | None = None,
        detail: dict[str, Any] | None = None,
        agent: str | None = None,
        tool_name: str | None = None,
        related_tool_call_id: str | None = None,
        duration_ms: int | None = None,
    ) -> dict[str, Any]:
        step: dict[str, Any] = {
            "event": "step",
            "stepId": step_id,
            "kind": kind,
            "status": status,
            "title": title,
            "summary": summary or "",
            "updatedAt": cls._now_iso(),
        }
        if status == "running":
            step["startedAt"] = cls._now_iso()
        else:
            step["completedAt"] = cls._now_iso()
        if detail:
            step["detail"] = detail
        if agent:
            step["agent"] = agent
        if tool_name:
            step["toolName"] = tool_name
        if related_tool_call_id:
            step["relatedToolCallId"] = related_tool_call_id
        if duration_ms is not None:
            step["durationMs"] = duration_ms
        return step

    @staticmethod
    def _record_step(run_trace: list[dict[str, Any]], step: dict[str, Any]) -> None:
        stored = {k: v for k, v in step.items() if k != "event"}
        for idx, existing in enumerate(run_trace):
            if existing.get("stepId") == stored.get("stepId"):
                run_trace[idx] = {**existing, **stored}
                return
        run_trace.append(stored)

    @classmethod
    def _summarize_mapping(cls, value: Any, limit: int = 1200) -> Any:
        bounded = cls._bounded_json(value, limit=limit)
        if isinstance(bounded, dict):
            return {
                key: bounded[key]
                for key in sorted(bounded.keys())
                if key not in {"student_id", "studentId"}
            }
        return bounded

    def _persist(
        self,
        content_parts: list[str],
        agent: str | None,
        tool_calls_json: list[dict] | None,
        run_trace: list[dict[str, Any]],
    ) -> None:
        """Save assistant message and update session metadata."""
        if not self._memory_manager:
            return
        try:
            self._memory_manager.add_message(
                session_id=self._session_id,
                role="assistant",
                content=desensitize("".join(content_parts) or ""),
                active_agent=agent,
                tool_calls_json=None,
                run_trace_json=json.dumps(run_trace, ensure_ascii=False)
                if run_trace
                else None,
            )
            self._memory_manager.increment_message_count(self._session_id)
        except Exception:
            logger.exception("Failed to persist assistant message")

    def _maybe_save_metadata(self, agent: str | None) -> None:
        if not self._memory_manager:
            return
        try:
            self._memory_manager.save_coordinator_metadata(
                self._student_id,
                current_stage=agent or "",
                last_agent=agent or "",
            )
        except Exception:
            logger.exception("Failed to save coordinator metadata")

    def _maybe_cascade_events(self, tool_calls_json: list[dict]) -> None:
        if not self._outbox_emitter or not tool_calls_json:
            return
        for tc in tool_calls_json:
            try:
                tc_name = tc.get("function", {}).get("name", "")
                # Only cascade for mutation_gated tools that were actually accepted
                accepted = tc.get("_accepted", False)
                if accepted and tc_name in (
                    "verify_and_record_progress",
                    "append_achievement",
                    "update_reflection",
                ):
                    self._outbox_emitter.emit_event(
                        event_type="skill_mastered",
                        payload={
                            "student_id": self._student_id,
                            "tool_name": tc_name,
                        },
                        idempotency_key=f"{self._student_id}_{tc_name}_{self._trace_id}",
                        trace_id=self._trace_id,
                    )
            except Exception:
                logger.exception(
                    "Failed to emit cascade event for %s",
                    tc.get("function", {}).get("name", ""),
                )


def _requires_real_match_data(agent: str | None, user_message: str) -> bool:
    """Detect recommendation intents where static category listing is insufficient."""
    if agent not in {"CareerMatchCoach", "CareerCoach"}:
        return False
    text = user_message.strip()
    if not text:
        return False
    if any(keyword in text for keyword in _CATEGORY_LISTING_KEYWORDS):
        return False
    return any(keyword in text for keyword in _CAREER_RECOMMENDATION_KEYWORDS)
