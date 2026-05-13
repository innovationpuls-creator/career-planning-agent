from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.services.tool_registry import ToolRegistry

logger = logging.getLogger(__name__)


class ToolResult:
    """Standard result structure for tool executions."""

    def __init__(
        self,
        success: bool = True,
        summary: str = "",
        detail: dict[str, Any] | None = None,
        error: str = "",
        recovery: str = "",
    ) -> None:
        self.success = success
        self.summary = summary
        self.detail = detail or {}
        self.error = error
        self.recovery = recovery


class ToolExecutor:
    """Executes tools with retry logic.

    readonly / mutation_safe: exponential backoff retry (1s -> 2s -> 4s, max 3).
    mutation_gated: no retry, submits through handler directly.
    """

    def __init__(
        self,
        registry: ToolRegistry,
        max_retries: int = 3,
        base_delay: float = 1.0,
    ) -> None:
        self.registry = registry
        self.max_retries = max_retries
        self.base_delay = base_delay

    async def execute_with_recovery(
        self,
        tool_name: str,
        args: dict[str, Any],
        context: Any = None,
    ) -> ToolResult:
        last_error: str | None = None

        for attempt in range(self.max_retries):
            try:
                tool = self.registry.get(tool_name)
                if not tool:
                    return ToolResult(
                        success=False,
                        error=f"Tool '{tool_name}' not found",
                    )

                handler = tool.handler
                if not callable(handler):
                    return ToolResult(
                        success=False,
                        error=f"Tool '{tool_name}' has no callable handler",
                    )

                if tool.classification == "mutation_gated":
                    return await self._execute_handler(handler, args, context)

                # Secondary student isolation: validate owner_check tools
                if tool.owner_check and context is not None:
                    ctx_student_id = getattr(context, "student_id", None)
                    arg_student_id = args.get("student_id")
                    if ctx_student_id and arg_student_id and str(arg_student_id) != str(ctx_student_id):
                        return ToolResult(
                            success=False,
                            error="Resource does not belong to this student",
                        )

                result = await asyncio.wait_for(
                    self._execute_handler(handler, args, context),
                    timeout=30.0,
                )
                return result

            except asyncio.TimeoutError:
                last_error = f"Tool '{tool_name}' timed out"
                logger.warning("Tool %s timed out (attempt %d/%d)",
                               tool_name, attempt + 1, self.max_retries)
            except Exception as e:
                last_error = str(e)
                logger.warning("Tool %s error (attempt %d/%d): %s",
                               tool_name, attempt + 1, self.max_retries, e)

            if attempt < self.max_retries - 1:
                delay = self.base_delay * (2 ** attempt)
                await asyncio.sleep(delay)

        return ToolResult(
            success=False,
            error=last_error or "Unknown error",
            recovery="max_retries_exceeded",
        )

    async def _execute_handler(
        self,
        handler: Any,
        args: dict[str, Any],
        context: Any,
    ) -> ToolResult:
        """Execute a handler and convert its result to ToolResult."""
        if asyncio.iscoroutinefunction(handler):
            result = await handler(args, context)
        else:
            result = handler(args, context)

        # Normalize handler results: accept ToolResult, dict, or string
        if isinstance(result, ToolResult):
            return result
        # Also accept ToolResult-like objects (duck typing from handlers.py)
        if hasattr(result, "success") and hasattr(result, "summary"):
            return ToolResult(
                success=result.success,
                summary=result.summary,
                detail=getattr(result, "detail", {}),
                error=getattr(result, "error", ""),
                recovery=getattr(result, "recovery", ""),
            )
        if isinstance(result, dict):
            success = result.get("success", True)
            if not success:
                return ToolResult(success=False, error=result.get("error", "Unknown error"))
            return ToolResult(
                success=True,
                summary=result.get("summary", str(result.get("result", ""))),
                detail=result,
            )
        return ToolResult(success=True, summary=str(result), detail={"result": result})
