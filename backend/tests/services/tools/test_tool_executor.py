from __future__ import annotations

import asyncio

import pytest

from app.services.tools.executor import ToolExecutor
from app.services.tool_registry import Tool, ToolRegistry


class TestToolExecutor:
    """P2b §9 ToolExecutor tests — retry, backoff, mutation_gated bypass."""

    def test_readonly_retry_on_timeout(self):
        """readonly tool: first call times out, retry succeeds."""
        call_count = 0

        async def failing_then_ok(args, ctx=None):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise asyncio.TimeoutError("timeout")
            return {"result": "ok", "attempt": call_count}

        registry = ToolRegistry()
        tool = Tool(name="timeout_tool", description="Test timeout",
                     parameters={}, classification="readonly",
                     handler=failing_then_ok, agent="TestAgent")
        registry.register_tool(tool)
        executor = ToolExecutor(registry=registry)

        result = asyncio.run(executor.execute_with_recovery("timeout_tool", {}, None))

        assert result.success is True
        assert result.detail.get("result") == "ok"

    def test_readonly_max_retries_exceeded(self):
        """readonly tool: 3 timeouts -> recovery='max_retries_exceeded'."""
        async def always_timeout(args, ctx=None):
            raise asyncio.TimeoutError("always timeout")

        registry = ToolRegistry()
        tool = Tool(name="always_timeout", description="Test always timeout",
                     parameters={}, classification="readonly",
                     handler=always_timeout, agent="TestAgent")
        registry.register_tool(tool)
        executor = ToolExecutor(registry=registry, max_retries=3)

        result = asyncio.run(executor.execute_with_recovery("always_timeout", {}, None))

        assert result.success is False
        assert result.recovery == "max_retries_exceeded"

    def test_mutation_safe_retry_on_error(self):
        """mutation_safe tool: API error retries and succeeds."""
        call_count = 0

        async def error_then_ok(args, ctx=None):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("API 500 error")
            return {"result": "saved"}

        registry = ToolRegistry()
        tool = Tool(name="safe_tool", description="Test safe",
                     parameters={}, classification="mutation_safe",
                     handler=error_then_ok, agent="TestAgent")
        registry.register_tool(tool)
        executor = ToolExecutor(registry=registry)

        result = asyncio.run(executor.execute_with_recovery("safe_tool", {}, None))

        assert result.success is True
        assert call_count == 2

    def test_mutation_gated_no_retry(self):
        """mutation_gated tool: not retried, calls handler once."""
        call_count = 0

        async def gated_handler(args, ctx=None):
            nonlocal call_count
            call_count += 1
            return {"result": "proposed", "decision_type": "auto_confirmed"}

        registry = ToolRegistry()
        gated = Tool(name="verify_progress", display_name="验证进度",
                      description="Verify learning progress",
                      parameters={}, classification="mutation_gated",
                      handler=gated_handler, agent="LearningPathCoach")
        registry.register_tool(gated)
        executor = ToolExecutor(registry=registry)

        result = asyncio.run(executor.execute_with_recovery("verify_progress", {}, None))

        assert result.success is True
        assert call_count == 1

    def test_tool_not_found_no_retry(self):
        """Nonexistent tool: immediately returns error, no retry."""
        registry = ToolRegistry()
        executor = ToolExecutor(registry=registry)

        result = asyncio.run(executor.execute_with_recovery("nonexistent", {}, None))

        assert result.success is False
        assert "not found" in result.error

    def test_tool_executor_timeout_30s(self):
        """ToolExecutor uses 30s hard timeout for readonly/safe tools."""
        async def slow_handler(args, ctx=None):
            await asyncio.sleep(100)

        registry = ToolRegistry()
        tool = Tool(name="slow_tool", description="Test slow",
                     parameters={}, classification="readonly",
                     handler=slow_handler, agent="TestAgent")
        registry.register_tool(tool)
        executor = ToolExecutor(registry=registry, max_retries=1)

        result = asyncio.run(executor.execute_with_recovery("slow_tool", {}, None))

        assert result.success is False
        assert "timed out" in result.error.lower() or "timeout" in result.error.lower()
