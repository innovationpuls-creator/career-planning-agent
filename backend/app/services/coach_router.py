from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.llm import OpenAICompatibleLLMClient

logger = logging.getLogger(__name__)

L1_COMMANDS: dict[str, str] = {
    "/resume": "ResumeCoach",
    "/match": "CareerMatchCoach",
    "/learn": "LearningPathCoach",
    "/report": "ReportCoach",
}

PIPELINE_STAGE_MAP: dict[str, str] = {
    "resume": "ResumeCoach",
    "match": "CareerMatchCoach",
    "learning": "LearningPathCoach",
    "learn": "LearningPathCoach",   # backward-compat alias
    "report": "ReportCoach",
}

L2_KEYWORDS: list[tuple[list[str], str]] = [
    (["简历", "修改", "优化", "经历", "项目", "实习"], "ResumeCoach"),
    (["岗位", "匹配", "推荐", "适合", "做什么", "转行"], "CareerMatchCoach"),
    (["学习", "课程", "技能", "提升", "考证", "培训"], "LearningPathCoach"),
    (["报告", "进展", "总结", "评估", "分析"], "ReportCoach"),
]


@dataclass
class RouteDecision:
    agent: str
    rule: str
    matched: str = ""
    confidence: float = 0.0
    latency_ms: int = 0


async def route_message(
    text: str,
    *,
    pipeline_stage: str | None = None,
    llm_client: OpenAICompatibleLLMClient | None = None,
) -> RouteDecision:
    """Route a user message to the appropriate agent.

    L1: explicit pipeline stage (e.g. ?step=resume)
    L1.5: user command (e.g. /resume)
    L2: keyword matching
    L3: BERT-tiny local classifier (P5, <10ms, zero API cost)
    L4: LLM intent fallback (default to CareerCoach)
    """
    stripped = text.strip()

    # L1: explicit pipeline stage routing
    if pipeline_stage and pipeline_stage in PIPELINE_STAGE_MAP:
        agent = PIPELINE_STAGE_MAP[pipeline_stage]
        return RouteDecision(agent=agent, rule="L1", matched=f"step:{pipeline_stage}")

    if not stripped:
        return RouteDecision(agent="CareerCoach", rule="L4")

    # L1.5: command routing
    for cmd, agent in L1_COMMANDS.items():
        if stripped.startswith(cmd):
            if len(stripped) == len(cmd) or stripped[len(cmd)] in (" ", "\t"):
                return RouteDecision(agent=agent, rule="L1.5", matched=cmd)

    # L2: keyword routing
    for keywords, agent in L2_KEYWORDS:
        for keyword in keywords:
            if keyword in stripped:
                return RouteDecision(agent=agent, rule="L2", matched=keyword)

    # L3: BERT-tiny local classifier
    try:
        from app.services.l3_router import L3Router, L3_LABELS
        l3 = _get_l3_router()
        l3_agent, l3_confidence = l3.classify(stripped)
        if l3_agent in L3_LABELS and l3_confidence >= 0.80:
            return RouteDecision(agent=l3_agent, rule="L3", matched=f"bert:{l3_agent}")
    except Exception:
        pass

    # L4: LLM intent fallback
    if llm_client:
        try:
            return await _l4_llm_classify(stripped, llm_client)
        except Exception:
            logger.warning("L4 LLM classification failed, falling back to CareerCoach", exc_info=True)
    return RouteDecision(agent="CareerCoach", rule="L4")


async def _l4_llm_classify(
    text: str,
    llm_client: OpenAICompatibleLLMClient,
) -> RouteDecision:
    """Classify user intent via LLM for routing to the best-fit agent."""
    from app.services.llm import ChatMessage

    t0 = time.perf_counter()

    valid_agents = list(L1_COMMANDS.values())
    prompt = (
        "You are a routing classifier. Given a user message in Chinese, "
        "classify which career coach agent should respond.\n\n"
        f"Agents: {', '.join(valid_agents)}, CareerCoach\n"
        "- ResumeCoach: resume analysis, skill gaps, career planning\n"
        "- CareerMatchCoach: job matching, career exploration, industry comparison\n"
        "- LearningPathCoach: learning plans, skill building, course recommendations\n"
        "- ReportCoach: progress reports, achievement summaries, competency analysis\n"
        "- CareerCoach: general questions, chitchat, or unclear intent\n\n"
        "Return JSON: {\"agent\": \"<chosen>\", \"confidence\": 0.0-1.0}\n"
        "If unsure, return {\"agent\": \"CareerCoach\", \"confidence\": 0.0}."
    )

    response = await llm_client.chat_completion_json(
        messages=[
            ChatMessage(role="system", content=prompt),
            ChatMessage(role="user", content=text),
        ],
        temperature=0.0,
    )

    latency_ms = int((time.perf_counter() - t0) * 1000)

    agent = response.get("agent", "CareerCoach")
    confidence = float(response.get("confidence", 0.0))

    if agent not in valid_agents and agent != "CareerCoach":
        agent = "CareerCoach"

    return RouteDecision(
        agent=agent,
        rule="L4",
        matched=f"llm:{agent}",
        confidence=confidence,
        latency_ms=latency_ms,
    )


_l3_router_cache: "L3Router | None" = None


def _get_l3_router() -> "L3Router":
    global _l3_router_cache
    if _l3_router_cache is None:
        from app.services.l3_router import L3Router
        _l3_router_cache = L3Router()
    return _l3_router_cache
