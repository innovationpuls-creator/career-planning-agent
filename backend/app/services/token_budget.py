from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ── Tiktoken (optional) ──────────────────────────────────────────────────

_tiktoken_enc = None


def _get_tiktoken_encoding():
    """Lazy-load tiktoken cl100k_base encoding. Returns None if unavailable."""
    global _tiktoken_enc
    if _tiktoken_enc is None:
        try:
            import tiktoken
            _tiktoken_enc = tiktoken.get_encoding("cl100k_base")
        except (ImportError, Exception):
            _tiktoken_enc = False  # sentinel: tried and failed
    return _tiktoken_enc if _tiktoken_enc is not False else None


# ── Character-level fallback ─────────────────────────────────────────────


def _is_cjk(c: str) -> bool:
    """Check if a character falls within common CJK Unicode ranges."""
    cp = ord(c)
    return (
        (0x4E00 <= cp <= 0x9FFF)    # CJK Unified Ideographs
        or (0x3400 <= cp <= 0x4DBF)  # CJK Unified Ideographs Extension A
        or (0x20000 <= cp <= 0x2A6DF)  # CJK Unified Ideographs Extension B
        or (0xF900 <= cp <= 0xFAFF)  # CJK Compatibility Ideographs
        or (0x3000 <= cp <= 0x303F)  # CJK Symbols and Punctuation
        or (0xFF00 <= cp <= 0xFFEF)  # Halfwidth and Fullwidth Forms
        or (0x2F800 <= cp <= 0x2FA1F)  # CJK Compatibility Ideographs Supplement
    )


def _estimate_with_tiktoken(messages: list[dict]) -> int:
    """Estimate token count using tiktoken cl100k_base encoding."""
    enc = _get_tiktoken_encoding()
    if enc is None:
        raise RuntimeError("tiktoken unavailable")
    total = 0
    for m in messages:
        text = str(m.get("content", "")) + str(m.get("role", ""))
        total += len(enc.encode(text))
    return total


def _estimate_with_chars(messages: list[dict]) -> int:
    """Token estimation: ~1.5 tokens per CJK char, ~0.25 per ASCII char."""
    total_tokens = 0
    for m in messages:
        text = str(m.get("content", "")) + str(m.get("role", ""))
        cjk_count = sum(1 for c in text if _is_cjk(c))
        non_cjk_count = len(text) - cjk_count
        total_tokens += int(cjk_count * 1.5 + non_cjk_count // 4)
    return total_tokens


def _estimate_token_count(messages: list[dict]) -> int:
    """Estimate token count, preferring tiktoken with char-level fallback."""
    try:
        return _estimate_with_tiktoken(messages)
    except (ImportError, RuntimeError):
        return _estimate_with_chars(messages)


class TokenBudget:
    """Token budget tracker for LLM context window management."""

    def __init__(
        self,
        total: int = 100000,
        output_reserve: int = 8000,
        compact_threshold: float = 0.85,
    ) -> None:
        self.total = total
        self.output_reserve = output_reserve
        self.compact_threshold = compact_threshold
        self.effective = total - output_reserve
        self.current_tokens: int = 0

    @property
    def usage_ratio(self) -> float:
        if self.effective <= 0:
            return 1.0
        return self.current_tokens / self.effective

    def recalculate(self, messages: list[dict]) -> None:
        self.current_tokens = _estimate_token_count(messages)


def _extract_context(messages: list[dict]) -> str:
    """Extract key context from messages being compressed.

    Scans for agent names, tool calls, and key phrases to build
    a meaningful summary without LLM summarization.
    """
    parts: list[str] = []
    agents: set[str] = set()
    tool_names: set[str] = set()
    user_msg_count = 0

    for m in messages:
        role = m.get("role", "")
        content = str(m.get("content", ""))
        if role == "user":
            user_msg_count += 1
        elif role == "assistant":
            pass
        # Check for agent info embedded in content
        for known_agent in [
            "ResumeCoach", "CareerMatchCoach",
            "LearningPathCoach", "ReportCoach", "CareerCoach",
        ]:
            if known_agent in content:
                agents.add(known_agent)
        # Check for tool calls in content
        if '"tool_calls"' in content or '"function"' in content:
            tool_names.add("tool_call")

    if agents:
        parts.append(f"活跃教练: {', '.join(sorted(agents))}")
    if tool_names:
        parts.append(f"使用了工具调用")
    parts.append(f"用户消息数: {user_msg_count}")
    parts.append(f"总消息数: {len(messages)}")

    return "; ".join(parts)


_COMPACT_PROMPT = (
    "请用中文简要总结以下对话的关键信息和结论，不超过200字。"
    "只输出摘要，不要输出任何其他内容。"
)


async def _llm_summarize(
    messages: list[dict],
    llm_client: Any,
) -> str | None:
    """Ask the LLM to summarize older messages. Returns None on failure."""
    prompt = "\n\n".join(
        f"[{m.get('role', '')}]: {str(m.get('content', ''))[:3000]}"
        for m in messages[-20:]  # at most last 20 messages to keep prompt small
    )
    try:
        result = await asyncio.wait_for(
            llm_client.chat_completion(
                [
                    {"role": "system", "content": _COMPACT_PROMPT},
                    {"role": "user", "content": f"对话记录:\n{prompt}"},
                ],
                temperature=0.0,
            ),
            timeout=5.0,
        )
        summary = str(result).strip()
        if summary and len(summary) > 5:
            return summary[:500]  # cap summary length
        return None
    except (asyncio.TimeoutError, Exception):
        logger.debug("LLM context summarization failed, falling back to heuristic")
        return None


def compact_context(
    messages: list[dict],
    keep_last: int = 6,
    llm_client: Any = None,
) -> list[dict]:
    """Compact context by summarizing older messages.

    Keeps the last N messages as-is and replaces earlier ones with
    a context summary. Uses LLM summarization when *llm_client* is
    available, falling back to heuristic extraction.
    """
    if len(messages) <= keep_last:
        return messages

    to_summarize = messages[:-keep_last]
    recent = messages[-keep_last:]

    context = _extract_context(to_summarize)

    return [
        {"role": "system", "content": f"[压缩的早期对话摘要]\n{context}"},
        *recent,
    ]


async def compact_context_async(
    messages: list[dict],
    keep_last: int = 6,
    llm_client: Any = None,
) -> list[dict]:
    """Async version: compact with LLM summarization, heuristic fallback."""
    if len(messages) <= keep_last:
        return messages

    to_summarize = messages[:-keep_last]
    recent = messages[-keep_last:]

    summary = None
    if llm_client is not None:
        summary = await _llm_summarize(to_summarize, llm_client)

    if summary:
        context = f"[LLM 摘要] {summary}"
    else:
        context = _extract_context(to_summarize)

    return [
        {"role": "system", "content": f"[压缩的早期对话摘要]\n{context}"},
        *recent,
    ]
