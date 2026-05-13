from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.services.coach_coordinator import CoachCoordinator
from app.services.llm import ChatMessage, OpenAICompatibleLLMClient
from app.services.memory.manager import MemoryManager
from app.services.token_budget import TokenBudget
from app.services.tools.executor import ToolExecutor, ToolResult
from app.services.tools.mock_job_categories import register_get_job_categories
from app.services.tool_registry import Tool, ToolRegistry, register_all_tools


def _make_llm_client() -> OpenAICompatibleLLMClient:
    return OpenAICompatibleLLMClient(
        base_url="https://example.com",
        api_key="test-key",
        model="test-model",
        timeout_seconds=30,
        max_retries=0,
        concurrency=5,
    )


def _make_tool_registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(
        name="get_job_categories",
        description="Get job categories",
        parameters={
            "type": "object",
            "properties": {
                "industry": {"type": "string", "description": "industry filter"}
            },
            "required": [],
        },
        handler=lambda args: {
            "categories": [
                {"name": "软件开发", "industry": "互联网"},
            ]
        },
    )
    return registry


async def _yield_content(text: str):
    """Async generator that yields a single content delta."""
    yield {"content": text}


async def _yield_tool_call(tool_name: str, tool_id: str, args_json: str):
    """Async generator that yields tool_call_start + tool_call_args."""
    yield {"tool_call_start": {"index": 0, "id": tool_id, "name": tool_name}}
    yield {"tool_call_args": {"index": 0, "args": args_json}}


async def _yield_resume_overview_tools_then_answer():
    tools = [
        ("parse_resume", "call_resume", '{"student_id": "42"}'),
        ("get_home_summary", "call_home", '{"student_id": "42"}'),
        ("read_profile", "call_profile", '{"student_id": "42"}'),
    ]
    for index, (name, tool_id, args_json) in enumerate(tools):
        yield {"tool_call_start": {"index": index, "id": tool_id, "name": name}}
        yield {"tool_call_args": {"index": index, "args": args_json}}


def _patch_stream(llm, generators: list):
    """Patch _chat_completion_stream_raw to return async generators in sequence.

    Each call to the method consumes the next generator from the list.
    Captures call arguments in call_args_list for inspection.
    """
    call_args_list: list = []

    async def _mock_stream(*args, **kwargs):
        call_args_list.append((args, kwargs))
        idx = len(call_args_list) - 1
        if idx >= len(generators):
            async for _ in _yield_content(""):
                pass
            return
        async for chunk in generators[idx]:
            yield chunk

    _mock_stream.call_args_list = call_args_list
    llm._chat_completion_stream_raw = _mock_stream


class TestCoachCoordinator:
    def _run(
        self,
        coordinator: CoachCoordinator,
        system_prompt: str,
        user_message: str,
        **kwargs,
    ) -> list[dict]:
        """Run coordinator synchronously and return parsed events."""
        chunks: list[bytes] = []

        async def _collect():
            async for chunk in coordinator.run(system_prompt, user_message, **kwargs):
                chunks.append(chunk)

        asyncio.run(_collect())
        raw = b"".join(chunks)
        lines = [l for l in raw.decode("utf-8").split("\n") if l.strip()]
        return [json.loads(l) for l in lines]

    def test_no_tool_call_returns_answer_delta_and_run_done(self):
        llm = _make_llm_client()
        registry = _make_tool_registry()
        coordinator = CoachCoordinator(llm, registry)

        _patch_stream(llm, [_yield_content("你好，我是教练")])

        events = self._run(coordinator, "system prompt", "你好")
        assert events[0]["event"] == "run_start"
        assert events[1]["event"] == "step"
        assert events[1]["kind"] == "route"
        answer = next(e for e in events if e["event"] == "answer_delta")
        assert answer["delta"] == "你好，我是教练"
        assert events[-1]["event"] == "run_done"

    def test_tool_call_triggers_step_and_answer_delta(self):
        llm = _make_llm_client()
        registry = _make_tool_registry()
        coordinator = CoachCoordinator(llm, registry)

        _patch_stream(llm, [
            _yield_tool_call("get_job_categories", "call_1", '{"industry": "互联网"}'),
            _yield_content("根据你的需求"),
        ])

        events = self._run(coordinator, "system prompt", "推荐岗位")
        assert events[0]["event"] == "run_start"
        tool_steps = [
            e for e in events
            if e["event"] == "step"
            and e["kind"] == "tool"
            and e.get("toolName") == "get_job_categories"
        ]
        assert tool_steps[0]["status"] == "running"
        assert tool_steps[-1]["status"] == "success"
        assert any(e["event"] == "answer_delta" for e in events)
        assert events[-1]["event"] == "run_done"

    def test_page_context_is_available_to_tool_executor(self):
        llm = _make_llm_client()
        registry = ToolRegistry()

        async def read_plan_handler(args, context):
            return ToolResult(
                success=True,
                summary=f"favorite={context.page_context.get('favoriteId')}",
                detail={"page_context": context.page_context},
            )

        registry.register_tool(Tool(
            name="read_plan",
            description="Read learning plan",
            parameters={"type": "object", "properties": {}},
            handler=read_plan_handler,
            classification="readonly",
            agent="LearningPathCoach",
            display_name="读取学习计划",
        ))
        coordinator = CoachCoordinator(
            llm,
            registry,
            student_id=42,
            agent="CareerCoach",
            tool_executor=ToolExecutor(registry=registry),
        )

        _patch_stream(llm, [
            _yield_tool_call("read_plan", "call_plan", "{}"),
            _yield_content("已读取当前学习路径。"),
        ])

        events = self._run(
            coordinator,
            "system",
            "看看当前学习路径",
            page_context={
                "sourcePage": "snail-learning-path",
                "favoriteId": 77,
                "workspaceId": "ws-77",
            },
        )
        tool_step = next(
            e for e in events
            if e["event"] == "step"
            and e["kind"] == "tool"
            and e["status"] == "success"
        )
        assert tool_step["summary"] == "favorite=77"

    def test_career_coach_schema_includes_readonly_business_tools_only(self):
        registry = ToolRegistry()
        register_all_tools(registry)

        tool_names = {
            item["function"]["name"]
            for item in registry.get_schema_for_llm("CareerCoach")
        }

        assert {"read_profile", "search_matches", "read_plan", "read_report"} <= tool_names
        assert "save_to_shortlist" not in tool_names
        assert "generate_report" not in tool_names
        assert "update_section" not in tool_names

    def test_mock_job_categories_runs_through_tool_executor(self):
        registry = ToolRegistry()
        register_get_job_categories(registry)

        result = asyncio.run(
            ToolExecutor(registry=registry, max_retries=1, base_delay=0).execute_with_recovery(
                "get_job_categories",
                {"industry": "互联网"},
                context=object(),
            )
        )

        assert result.success is True
        assert result.detail["categories"] == [
            {"name": "软件开发", "industry": "互联网"},
            {"name": "数据分析", "industry": "互联网"},
            {"name": "产品经理", "industry": "互联网"},
        ]

    def test_career_recommendation_hides_mock_category_tool(self):
        llm = _make_llm_client()
        registry = ToolRegistry()
        register_get_job_categories(registry)

        async def search_matches_handler(args, context):
            return ToolResult(success=True, summary="读取职业匹配推荐")

        registry.register_tool(Tool(
            name="search_matches",
            description="读取职业匹配推荐、当前推荐目标和收藏状态。",
            parameters={"type": "object", "properties": {}},
            handler=search_matches_handler,
            classification="readonly",
            agent="CareerMatchCoach",
        ))
        coordinator = CoachCoordinator(llm, registry, agent="CareerMatchCoach")

        _patch_stream(llm, [_yield_content("我会先读取职业匹配结果。")])
        self._run(
            coordinator,
            "system",
            "那我最适合什么职业？",
            agent="CareerMatchCoach",
        )

        tools = llm._chat_completion_stream_raw.call_args_list[0][1]["tools"]
        tool_names = {item["function"]["name"] for item in tools}
        assert "search_matches" in tool_names
        assert "get_job_categories" not in tool_names

    def test_category_listing_keeps_mock_category_tool(self):
        llm = _make_llm_client()
        registry = ToolRegistry()
        register_get_job_categories(registry)
        coordinator = CoachCoordinator(llm, registry, agent="CareerMatchCoach")

        _patch_stream(llm, [_yield_content("可以查看岗位大类。")])
        self._run(
            coordinator,
            "system",
            "互联网有哪些岗位大类？",
            agent="CareerMatchCoach",
        )

        tools = llm._chat_completion_stream_raw.call_args_list[0][1]["tools"]
        tool_names = {item["function"]["name"] for item in tools}
        assert "get_job_categories" in tool_names

    def test_unknown_tool_returns_error_in_result(self):
        llm = _make_llm_client()
        registry = _make_tool_registry()
        coordinator = CoachCoordinator(llm, registry)

        _patch_stream(llm, [
            _yield_tool_call("nonexistent_tool", "call_bad", "{}"),
            _yield_content("抱歉"),
        ])

        events = self._run(coordinator, "system", "test")
        assert events[0]["event"] == "run_start"
        tool_step = next(
            e for e in events
            if e["event"] == "step"
            and e["kind"] == "tool"
            and e.get("toolName") == "nonexistent_tool"
            and e["status"] == "error"
        )
        assert "not found" in tool_step["summary"]

    def test_resume_overview_tools_can_finish_with_answer(self):
        llm = _make_llm_client()
        registry = _make_tool_registry()
        registry.register(
            name="parse_resume",
            description="Parse resume",
            parameters={"student_id": {"type": "string"}},
            handler=lambda args: {
                "success": True,
                "summary": "姓名 yyy，专业 软件工程，目标 前端",
                "detail": {"profile": {"major": "软件工程", "target": "前端"}},
            },
        )
        registry.register(
            name="get_home_summary",
            description="Get home summary",
            parameters={"student_id": {"type": "string"}},
            handler=lambda args: {"success": True, "summary": "本科大三"},
        )
        registry.register(
            name="read_profile",
            description="Read profile",
            parameters={"student_id": {"type": "string"}},
            handler=lambda args: {"success": True, "summary": "能力画像已生成"},
        )
        coordinator = CoachCoordinator(llm, registry, student_id=42)

        _patch_stream(llm, [
            _yield_resume_overview_tools_then_answer(),
            _yield_content("你的简历里记录了软件工程和前端目标。"),
        ])

        events = self._run(coordinator, "system", "我的简历有什么内容？")
        tool_steps = [
            e for e in events
            if e["event"] == "step"
            and e["kind"] == "tool"
            and e["status"] == "success"
        ]
        assert [e["toolName"] for e in tool_steps] == [
            "parse_resume",
            "get_home_summary",
            "read_profile",
        ]
        answer = next(e for e in events if e["event"] == "answer_delta")
        assert "前端" in answer["delta"]
        assert events[-1]["event"] == "run_done"

    def test_tool_success_then_second_llm_failure_returns_error_only(self):
        llm = _make_llm_client()
        registry = _make_tool_registry()
        coordinator = CoachCoordinator(llm, registry)

        async def _error_stream(*args, **kwargs):
            raise RuntimeError("second turn failed")
            yield

        _patch_stream(llm, [
            _yield_tool_call("get_job_categories", "call_1", '{"industry": "互联网"}'),
            _error_stream(),
        ])

        events = self._run(coordinator, "system", "推荐岗位")
        assert any(e["event"] == "step" and e.get("kind") == "tool" for e in events)
        assert events[-1]["event"] == "run_error"
        assert events[-1]["message"] == "资料已查询完成，但回答生成失败，请重试。"
        assert not any(
            e.get("event") == "answer_delta" and e.get("delta")
            for e in events
            if events.index(e) > 2
        )

    def test_tool_result_llm_content_is_bounded(self):
        large_detail = {"items": ["x" * 100 for _ in range(100)]}
        content = CoachCoordinator._build_tool_llm_content({
            "success": True,
            "summary": "ok",
            "detail": large_detail,
        })
        assert len(content) < 4300
        assert "[truncated]" in content

    def test_compaction_preserves_recent_tool_call_protocol(self):
        class SummaryLLM:
            async def chat_completion(self, messages, *, temperature=0.0):
                return "早期对话摘要"

        llm = _make_llm_client()
        registry = _make_tool_registry()
        coordinator = CoachCoordinator(llm, registry)
        coordinator._llm = SummaryLLM()
        coordinator._token_budget = TokenBudget(total=20, output_reserve=1)
        messages = [
            ChatMessage(role="system", content="system " * 20),
            ChatMessage(role="user", content="old " * 20),
            ChatMessage(
                role="assistant",
                tool_calls=[
                    {"id": "call_1", "type": "function", "function": {"name": "a", "arguments": "{}"}},
                    {"id": "call_2", "type": "function", "function": {"name": "b", "arguments": "{}"}},
                ],
            ),
            ChatMessage(role="tool", content="{}", tool_call_id="call_1"),
            ChatMessage(role="tool", content="{}", tool_call_id="call_2"),
            ChatMessage(role="user", content="new"),
            ChatMessage(role="assistant", content="reply"),
            ChatMessage(role="user", content="again"),
        ]

        compacted, was_compacted = asyncio.run(coordinator._check_token_budget(messages))

        assert was_compacted is True
        assert compacted[1].role == "assistant"
        assert compacted[1].tool_calls is not None
        assert compacted[2].tool_call_id == "call_1"
        assert compacted[3].tool_call_id == "call_2"

    def test_loads_session_history_into_llm_context(self):
        """Coordinator loads existing session messages so LLM sees conversation history."""
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
        try:
            mm = MemoryManager(db)
            session = mm.get_or_create_session(student_id=42, title="历史对话")
            mm.add_message(session.id, "user", "我上次问过的问题", client_message_id="old_1")
            mm.add_message(
                session.id, "assistant", "上次的回复", active_agent="CareerCoach"
            )
            mm.increment_message_count(session.id)

            llm = _make_llm_client()
            registry = _make_tool_registry()
            coordinator = CoachCoordinator(
                llm, registry,
                memory_manager=mm,
                student_id=42,
                session_id=session.id,
            )

            _patch_stream(llm, [_yield_content("新回复")])

            events = self._run(coordinator, "system prompt", "新消息")

            # Verify LLM received history in messages
            call_args = llm._chat_completion_stream_raw.call_args_list
            messages = call_args[0][0][0]
            assert len(messages) >= 3, f"Expected >=3 messages, got {len(messages)}"
            contents = [m.content for m in messages]
            assert "我上次问过的问题" in contents, "Session history not passed to LLM"
            assert "上次的回复" in contents
            assert "新消息" in contents
            assert len(events) >= 2
            assert events[-1]["event"] == "run_done"
        finally:
            db.close()
            Base.metadata.drop_all(bind=engine)
            engine.dispose()

    def test_first_llm_call_error_yields_error_event(self):
        llm = _make_llm_client()
        registry = _make_tool_registry()
        coordinator = CoachCoordinator(llm, registry)

        async def _error_stream(*args, **kwargs):
            raise RuntimeError("API failure")
            yield

        llm._chat_completion_stream_raw = _error_stream

        events = self._run(coordinator, "system", "test")
        assert events[0]["event"] == "run_start"
        assert events[-1]["event"] == "run_error"
        assert events[-1]["code"] == "STREAM_ERROR"

    def test_agent_switch_event_emitted(self):
        """Verify agent_switch event is emitted when switch_agent tool is called."""
        llm = _make_llm_client()
        registry = _make_tool_registry()
        registry.register(
            name="switch_agent",
            description="Switch to another agent",
            parameters={
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "target agent"},
                    "reason": {"type": "string", "description": "reason for switch"},
                },
                "required": ["target"],
            },
            handler=lambda args: {
                "success": True,
                "summary": f"Switched to {args.get('target', '')}",
                "detail": {"target_agent": args.get("target", "")},
            },
        )
        coordinator = CoachCoordinator(llm, registry, agent="ResumeCoach")

        _patch_stream(llm, [
            _yield_tool_call(
                "switch_agent", "call_switch",
                '{"target": "CareerMatchCoach", "reason": "user wants job matching"}',
            ),
            _yield_content("已切换到岗位匹配教练"),
        ])

        events = self._run(coordinator, "system prompt", "帮我找岗位")

        agent_switch_steps = [
            e for e in events
            if e["event"] == "step" and e["kind"] == "agent_switch"
        ]
        assert len(agent_switch_steps) == 1
        assert agent_switch_steps[0]["detail"]["from"] == "ResumeCoach"
        assert agent_switch_steps[0]["detail"]["to"] == "CareerMatchCoach"
        assert agent_switch_steps[0]["summary"] == "user wants job matching"

    def test_agent_switch_updates_active_agent(self):
        """Verify delta is emitted with new agent's response after switch_agent."""
        llm = _make_llm_client()
        registry = _make_tool_registry()
        registry.register(
            name="switch_agent",
            description="Switch to another agent",
            parameters={
                "type": "object",
                "properties": {
                    "target": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["target"],
            },
            handler=lambda args: {
                "success": True,
                "summary": f"Switched to {args.get('target', '')}",
            },
        )
        coordinator = CoachCoordinator(llm, registry, agent="CareerCoach")

        _patch_stream(llm, [
            _yield_tool_call(
                "switch_agent", "call_s1",
                '{"target": "LearningPathCoach", "reason": ""}',
            ),
            _yield_content("学习路径建议如下"),
        ])

        events = self._run(coordinator, "system prompt", "帮我规划学习")

        assert events[0]["event"] == "run_start"
        assert any(e["event"] == "step" and e["kind"] == "tool" for e in events)
        assert any(e["event"] == "step" and e["kind"] == "agent_switch" for e in events)
        answer = next(e for e in events if e["event"] == "answer_delta")
        assert answer["delta"] == "学习路径建议如下"
        assert events[-1]["event"] == "run_done"
