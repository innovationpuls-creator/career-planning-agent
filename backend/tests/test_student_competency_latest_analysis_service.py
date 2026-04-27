from __future__ import annotations

from app.schemas.student_competency_profile import JobProfile12Dimensions
from app.services.student_competency_latest_analysis import StudentCompetencyLatestAnalysisService


class FakeGraphService:
    def get_graph(self) -> dict[str, object]:
        nodes = []
        for key in [
            "professional_skills",
            "professional_background",
            "education_requirement",
            "teamwork",
            "stress_adaptability",
            "communication",
            "work_experience",
            "documentation_awareness",
            "responsibility",
            "learning_ability",
            "problem_solving",
            "other_special",
        ]:
            nodes.append(
                {
                    "id": key,
                    "type": "Dimension",
                    "keywords": [f"{key} alpha", f"{key} beta", f"{key} gamma"],
                    "coverage_ratio": 1.0,
                }
            )
        return {"nodes": nodes, "edges": [], "meta": {}}


def test_latest_analysis_service_uses_stricter_scoring_and_action_advice():
    service = StudentCompetencyLatestAnalysisService(graph_service_factory=lambda: FakeGraphService())
    profile = JobProfile12Dimensions(
        professional_skills=["暂无明确信息"],
        professional_background=["custom background"],
        education_requirement=["education_requirement alpha"],
        teamwork=["teamwork alpha", "custom teamwork"],
        stress_adaptability=["stress_adaptability alpha", "stress_adaptability beta", "custom stress"],
        communication=["暂无明确信息"],
        work_experience=["custom experience"],
        documentation_awareness=["暂无明确信息"],
        responsibility=["responsibility alpha"],
        learning_ability=["暂无明确信息"],
        problem_solving=["problem_solving alpha", "problem_solving beta"],
        other_special=["暂无明确信息"],
    )

    payload = service.build_analysis(
        workspace_conversation_id="workspace-analysis",
        profile=profile,
    )

    assert payload.available is True
    assert payload.workspace_conversation_id == "workspace-analysis"
    assert payload.score is not None
    assert payload.score.completeness == 51
    assert payload.score.competitiveness == 47
    assert payload.score.overall == 48

    items = {item.key: item for item in payload.comparison_dimensions}
    assert items["professional_skills"].user_readiness == 30.0
    assert items["professional_skills"].status_label == "信息偏弱"
    assert items["professional_background"].user_readiness == 30.0
    assert items["education_requirement"].user_readiness == 50.0
    assert items["teamwork"].user_readiness == 67.5
    assert items["stress_adaptability"].user_readiness == 100.0
    assert items["problem_solving"].user_readiness == 87.5

    assert payload.priority_gap_dimensions == [
        "professional_skills",
        "professional_background",
        "communication",
    ]
    assert payload.recommended_keywords["professional_skills"][:2] == [
        "professional_skills alpha",
        "professional_skills beta",
    ]
    assert payload.action_advices[0].key == "professional_skills"
    assert "信息过少" in payload.action_advices[0].current_issue
    assert len(payload.action_advices[0].next_actions) == 3
    assert len(payload.action_advices[0].example_phrases) == 3
    assert len(payload.action_advices[0].evidence_sources) >= 2
