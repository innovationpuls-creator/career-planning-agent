from __future__ import annotations

import asyncio

from app.services.coach_router import route_message


class FakeLLMClient:
    async def chat_completion_json(self, messages, *, temperature=0.0):
        return {"agent": "ResumeCoach", "confidence": 0.91}


class TestRouteMessage:
    def _route(self, text: str):
        return asyncio.run(route_message(text))

    def test_l1_5_resume_command(self):
        decision = self._route("/resume 帮我修改简历")
        assert decision.agent == "ResumeCoach"
        assert decision.rule == "L1.5"
        assert decision.matched == "/resume"

    def test_l1_5_match_command(self):
        decision = self._route("/match")
        assert decision.agent == "CareerMatchCoach"
        assert decision.rule == "L1.5"

    def test_l1_5_learn_command(self):
        decision = self._route("/learn 前端开发")
        assert decision.agent == "LearningPathCoach"

    def test_l1_5_report_command(self):
        decision = self._route("/report")
        assert decision.agent == "ReportCoach"

    def test_l2_keyword_resume(self):
        decision = self._route("帮我改简历")
        assert decision.agent == "ResumeCoach"
        assert decision.rule == "L2"
        assert decision.matched == "简历"

    def test_l2_keyword_match(self):
        decision = self._route("有什么岗位适合我")
        assert decision.agent == "CareerMatchCoach"
        assert decision.matched == "岗位"

    def test_l2_keyword_learn(self):
        decision = self._route("我想学习Python")
        assert decision.agent == "LearningPathCoach"

    def test_l2_keyword_report(self):
        decision = self._route("分析一下我的进展")
        assert decision.agent == "ReportCoach"

    def test_empty_message_falls_to_l4(self):
        decision = self._route("")
        assert decision.agent == "CareerCoach"
        assert decision.rule == "L4"

    def test_punctuation_only_falls_to_l4(self):
        decision = self._route("！？。。。")
        assert decision.agent == "CareerCoach"
        assert decision.rule == "L4"

    def test_l1_5_takes_precedence_over_l2(self):
        decision = self._route("/learn 简历优化")
        assert decision.agent == "LearningPathCoach"
        assert decision.rule == "L1.5"

    def test_l4_uses_plain_json_completion(self):
        decision = asyncio.run(
            route_message("Can you help me?", llm_client=FakeLLMClient())
        )
        assert decision.agent == "ResumeCoach"
        assert decision.rule == "L4"
        assert decision.confidence == 0.91
