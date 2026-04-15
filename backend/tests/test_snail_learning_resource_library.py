from datetime import datetime, timezone

from app.schemas.career_development_report import CareerDevelopmentFavoritePayload, CareerDevelopmentMatchReport
from app.services.snail_learning_resource_library import (
    build_seed_resource_rows,
    resolve_module_dimension_key,
)


def _favorite() -> CareerDevelopmentFavoritePayload:
    report = CareerDevelopmentMatchReport.model_validate(
        {
            "report_id": "career:frontend",
            "target_scope": "career",
            "target_title": "前端工程师",
            "canonical_job_title": "前端工程师",
            "representative_job_title": "前端开发",
            "industry": "互联网",
            "overall_match": 82,
            "strength_dimension_count": 1,
            "priority_gap_dimension_count": 2,
            "group_summaries": [],
            "comparison_dimensions": [
                {
                    "key": "documentation_awareness",
                    "title": "文档规范意识",
                    "user_values": [],
                    "market_keywords": [],
                    "market_weight": 1.0,
                    "normalized_weight": 0.1,
                    "market_target": 80.0,
                    "user_readiness": 60.0,
                    "gap": 20.0,
                    "presence": 1,
                    "richness": 0.8,
                    "status_label": "有差距",
                    "matched_market_keywords": [],
                    "missing_market_keywords": [],
                    "coverage_score": 0.7,
                    "alignment_score": 0.7,
                },
                {
                    "key": "professional_background",
                    "title": "专业背景",
                    "user_values": [],
                    "market_keywords": [],
                    "market_weight": 1.0,
                    "normalized_weight": 0.1,
                    "market_target": 80.0,
                    "user_readiness": 60.0,
                    "gap": 20.0,
                    "presence": 1,
                    "richness": 0.8,
                    "status_label": "有差距",
                    "matched_market_keywords": [],
                    "missing_market_keywords": [],
                    "coverage_score": 0.7,
                    "alignment_score": 0.7,
                },
            ],
            "chart_series": [],
            "strength_dimensions": [],
            "priority_gap_dimensions": ["documentation_awareness", "professional_background"],
            "action_advices": [],
            "evidence_cards": [],
            "narrative": {
                "overall_review": "",
                "completeness_explanation": "",
                "competitiveness_explanation": "",
                "strength_highlights": [],
                "priority_gap_highlights": [],
            },
        }
    )
    now = datetime.now(timezone.utc)
    return CareerDevelopmentFavoritePayload(
        favorite_id=1,
        target_key="前端工程师::互联网",
        source_kind="custom",
        report_id=report.report_id,
        target_scope=report.target_scope,
        target_title=report.target_title,
        canonical_job_title=report.canonical_job_title,
        representative_job_title=report.representative_job_title,
        industry=report.industry,
        overall_match=report.overall_match,
        report_snapshot=report,
        created_at=now,
        updated_at=now,
    )


def test_build_seed_resource_rows_creates_full_library():
    rows = build_seed_resource_rows()
    assert len(rows) == 1080
    assert rows[0]["canonical_job_title"] == "前端工程师"
    assert rows[0]["dimension_key"] == "professional_skills"
    assert rows[0]["phase_key"] == "short_term"
    assert rows[0]["rank"] == 1


def test_resolve_module_dimension_key_matches_comparison_title():
    favorite = _favorite()

    assert resolve_module_dimension_key(favorite, module_topic="文档规范意识") == "documentation_awareness"
    assert resolve_module_dimension_key(favorite, module_topic="专业背景") == "professional_background"
    assert resolve_module_dimension_key(favorite, module_topic="未知模块") is None
