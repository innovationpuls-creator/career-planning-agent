from __future__ import annotations

import pytest

from app.services.context_builder import (
    AGENT_SYSTEM_PROMPTS,
    build_system_prompt,
    format_conversation_summary_with_overlays,
)
from app.services.memory.models import ConversationSummaryV1_1


class TestFormatConversationSummary:
    def test_empty_summary_returns_empty(self):
        result = format_conversation_summary_with_overlays(None)
        assert result == ""

    def test_skills_rendered(self):
        summary = ConversationSummaryV1_1(
            skills={"python": {"mastery_status": "mastered", "confidence": 0.9}}
        )
        json_str = summary.model_dump_json()
        result = format_conversation_summary_with_overlays(json_str)
        assert "python" in result
        assert "mastered" in result

    def test_provisional_overlays_marked(self):
        summary = ConversationSummaryV1_1(
            provisional_overlays={
                "test_key": {
                    "field_path": "skills.python",
                    "proposed_value": "mastered",
                    "confidence": 0.7,
                    "source": "coach",
                }
            }
        )
        json_str = summary.model_dump_json()
        result = format_conversation_summary_with_overlays(json_str)
        assert "待确认" in result
        assert "skills.python" in result


class TestBuildSystemPrompt:
    @pytest.mark.asyncio
    async def test_resume_coach_prompt_non_empty(self):
        prompt = await build_system_prompt(None, "ResumeCoach")
        assert len(prompt) > 50
        assert "简历" in prompt

    @pytest.mark.asyncio
    async def test_career_match_coach_prompt_non_empty(self):
        prompt = await build_system_prompt(None, "CareerMatchCoach")
        assert len(prompt) > 50
        assert "匹配" in prompt

    @pytest.mark.asyncio
    async def test_learning_path_coach_prompt_non_empty(self):
        prompt = await build_system_prompt(None, "LearningPathCoach")
        assert len(prompt) > 50
        assert "学习" in prompt

    @pytest.mark.asyncio
    async def test_unknown_agent_falls_back_to_default(self):
        prompt = await build_system_prompt(None, "UnknownAgent")
        assert len(prompt) > 50
        assert "职业规划" in prompt

    @pytest.mark.asyncio
    async def test_conversation_summary_injected_when_provided(self):
        prompt = await build_system_prompt(
            None, "CareerCoach", conversation_summary='{"key_topics":["简历"]}'
        )
        assert "对话历史摘要" in prompt
        assert "key_topics" in prompt

    @pytest.mark.asyncio
    async def test_conversation_summary_skipped_when_none(self):
        prompt = await build_system_prompt(None, "CareerCoach")
        assert "对话历史摘要" not in prompt

    @pytest.mark.asyncio
    async def test_cw_not_injected_without_db(self):
        """Without DB, CW should be skipped silently (no crash)."""
        prompt = await build_system_prompt(
            None, "CareerCoach", student_id=1,
            conversation_summary_obj=ConversationSummaryV1_1(
                student_profile={"major": {"value": "计算机科学与技术"}}
            ),
        )
        assert len(prompt) > 50

    def test_agent_system_prompts_dict_intact(self):
        for agent in ["ResumeCoach", "CareerMatchCoach", "LearningPathCoach", "ReportCoach", "CareerCoach"]:
            assert agent in AGENT_SYSTEM_PROMPTS
            assert len(AGENT_SYSTEM_PROMPTS[agent]) > 50
