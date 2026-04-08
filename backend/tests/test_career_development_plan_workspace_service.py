from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from zipfile import ZipFile

from app.schemas.career_development_report import (
    CareerDevelopmentFavoritePayload,
    CareerDevelopmentGoalCorrelationAnalysis,
    CareerDevelopmentGoalInsightCard,
    CareerDevelopmentGoalPlanResultPayload,
    CareerDevelopmentGoalStrengthDirectionItem,
    CareerDevelopmentMatchReport,
    GrowthPlanLearningModule,
    GrowthPlanLearningResourceItem,
    GrowthPlanMilestone,
    GrowthPlanPhase,
)
from app.schemas.student_competency_profile import StudentCompetencyComparisonDimensionItem
from app.services.career_development_goal_planning import build_comprehensive_report_markdown_content
from app.services.career_development_plan_workspace import (
    build_generated_report_markdown,
    build_integrity_check,
    build_workspace_overview,
    calculate_metric_snapshot,
    export_docx_bytes,
    export_markdown_bytes,
    export_pdf_bytes,
    hydrate_phase_relationships,
    normalize_goal_plan_result,
    polish_markdown,
)

UTC = timezone.utc


def comparison_item(key: str, title: str, *, gap: float, readiness: float) -> StudentCompetencyComparisonDimensionItem:
    return StudentCompetencyComparisonDimensionItem(
        key=key,
        title=title,
        user_values=[f"{title} 证据"],
        market_keywords=[f"{title} 关键词"],
        market_weight=1.0,
        normalized_weight=1.0,
        market_target=100,
        user_readiness=readiness,
        gap=gap,
        presence=1,
        richness=1.0,
        status_label="待补强" if gap > 0 else "匹配",
        matched_market_keywords=[],
        missing_market_keywords=[f"{title} 缺口"] if gap > 0 else [],
        coverage_score=1.0,
        alignment_score=1.0,
    )


def build_report(*, communication_gap: float, teamwork_gap: float) -> CareerDevelopmentMatchReport:
    return CareerDevelopmentMatchReport(
        report_id="career:frontend",
        target_scope="career",
        target_title="前端工程师",
        canonical_job_title="前端工程师",
        representative_job_title="前端开发",
        industry="互联网",
        overall_match=76.66,
        strength_dimension_count=1,
        priority_gap_dimension_count=2,
        comparison_dimensions=[
            comparison_item("communication", "沟通表达", gap=communication_gap, readiness=100 - communication_gap),
            comparison_item("teamwork", "团队协作", gap=teamwork_gap, readiness=100 - teamwork_gap),
        ],
        strength_dimensions=["communication"],
        priority_gap_dimensions=["communication", "teamwork"],
    )


def build_favorite(report: CareerDevelopmentMatchReport) -> CareerDevelopmentFavoritePayload:
    now = datetime(2026, 3, 29, tzinfo=UTC)
    return CareerDevelopmentFavoritePayload(
        favorite_id=1,
        target_key="frontend::",
        source_kind="recommendation",
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


def build_result_payload(favorite: CareerDevelopmentFavoritePayload) -> CareerDevelopmentGoalPlanResultPayload:
    insight = CareerDevelopmentGoalInsightCard(summary="说明", highlights=["证据"])
    return CareerDevelopmentGoalPlanResultPayload(
        favorite=favorite,
        trend_markdown="## 趋势\n- 企业更看重工程化能力",
        trend_section_markdown="## 趋势依据\n- 企业更看重工程化能力",
        path_section_markdown="## 原始路径依据\n- 前端工程师 -> 高级前端工程师",
        correlation_analysis=CareerDevelopmentGoalCorrelationAnalysis(
            foundation=insight,
            gaps=insight,
            path_impact=insight,
        ),
        comprehensive_report_markdown="## 结论\n继续围绕目标岗位形成证据沉淀。",
    )


def phase_with_two_milestones() -> GrowthPlanPhase:
    return GrowthPlanPhase(
        phase_key="short_term",
        phase_label="短期计划",
        time_horizon="0-3 个月",
        goal_statement="补基础并形成第一份证据。",
        why_now="当前阶段先补短板。",
        learning_modules=[],
        practice_actions=[],
        deliverables=["作品 A", "作品 B"],
        entry_gate=["已收藏目标"],
        exit_gate=["完成学习里程碑"],
        milestones=[
            GrowthPlanMilestone(
                milestone_id="m1",
                title="完成学习里程碑",
                category="learning",
                status="completed",
                planned_date=datetime(2026, 4, 1, tzinfo=UTC),
                completed_at=datetime(2026, 4, 2, tzinfo=UTC),
                evidence_note="课程笔记与总结",
            ),
            GrowthPlanMilestone(
                milestone_id="m2",
                title="完成实践里程碑",
                category="practice",
                status="pending",
                planned_date=datetime(2026, 4, 10, tzinfo=UTC),
            ),
        ],
        risk_alerts=["不要只停留在阅读阶段。"],
    )


def test_normalize_goal_plan_result_outputs_fixed_three_phases_and_overview():
    favorite = build_favorite(build_report(communication_gap=40, teamwork_gap=20))
    normalized = normalize_goal_plan_result(build_result_payload(favorite))

    assert [phase.phase_key for phase in normalized.growth_plan_phases] == [
        "short_term",
        "mid_term",
        "long_term",
    ]
    assert "评估周期" in normalized.generated_report_markdown
    assert "指标" in normalized.generated_report_markdown

    overview = build_workspace_overview(normalized.growth_plan_phases)
    assert overview.current_phase_key == "short_term"
    assert overview.next_milestone_title
    assert all(module.module_id for phase in normalized.growth_plan_phases for module in phase.learning_modules)
    assert all(
        milestone.related_learning_module_id
        for phase in normalized.growth_plan_phases
        for milestone in phase.milestones
        if milestone.category == "learning"
    )


def test_metric_snapshot_uses_expected_formula_and_updates_overview():
    baseline_favorite = build_favorite(build_report(communication_gap=40, teamwork_gap=20))
    current_favorite = build_favorite(build_report(communication_gap=20, teamwork_gap=10))
    phases = [phase_with_two_milestones()]

    snapshot = calculate_metric_snapshot(
        phases,
        baseline_report=baseline_favorite,
        current_report=current_favorite,
        latest_profile_refreshed_at=datetime(2026, 3, 28, tzinfo=UTC),
    )

    assert snapshot.learning_completion_rate == 100.0
    assert snapshot.practice_completion_rate == 0.0
    assert snapshot.evidence_count == 1
    assert snapshot.gap_closure_index == 50.0
    assert snapshot.readiness_index == 50.0
    assert snapshot.uses_latest_profile is True

    overview = build_workspace_overview(phases, metric_snapshot=snapshot)
    assert overview.current_phase_key == "short_term"
    assert overview.readiness_index == 50.0


def test_integrity_check_and_polish_guardrails_work():
    check = build_integrity_check("# 报告\n## 短期计划")

    assert check.blocking_count >= 1
    assert any(issue.severity == "blocking" for issue in check.issues)

    polished, notice = polish_markdown("重复\n重复\n", mode="concise")
    assert polished == "重复"
    assert "不补造" in notice


def test_export_helpers_return_expected_file_headers():
    markdown = "# 成长路径工作台\n这里是正文。"

    assert export_markdown_bytes(markdown) == markdown.encode("utf-8")

    docx_bytes = export_docx_bytes(markdown)
    with ZipFile(BytesIO(docx_bytes)) as archive:
        assert "[Content_Types].xml" in archive.namelist()
        assert "word/document.xml" in archive.namelist()

    pdf_bytes = export_pdf_bytes(markdown)
    assert pdf_bytes.startswith(b"%PDF-1.4")


def test_generated_markdown_includes_learning_resource_links():
    favorite = build_favorite(build_report(communication_gap=40, teamwork_gap=20))
    phase = phase_with_two_milestones()
    phase.learning_modules = [
        GrowthPlanLearningModule(
            module_id="short-term-module-1",
            topic="前端基础",
            learning_content="补齐 JavaScript 与浏览器基础。",
            suggested_resource_types=["课程"],
            resource_recommendations=[
                GrowthPlanLearningResourceItem(
                    title="MDN Web Docs",
                    url="https://developer.mozilla.org/",
                    reason="适合作为浏览器 API 与前端基础知识的权威资料。",
                )
            ],
            resource_status="ready",
        )
    ]
    hydrate_phase_relationships([phase])

    review_framework = normalize_goal_plan_result(build_result_payload(favorite)).review_framework
    assert review_framework is not None
    markdown = build_generated_report_markdown(
        favorite,
        growth_plan_phases=[phase],
        review_framework=review_framework,
        comprehensive_report_markdown="## 结论\n继续推进。",
        trend_section_markdown="## 趋势依据\n- 需要工程化能力",
        path_section_markdown="## 原始路径依据\n- 补基础再做项目",
    )

    assert "推荐学习路线" in markdown
    assert "https://developer.mozilla.org/" in markdown


def test_comprehensive_report_is_built_without_llm_and_without_mojibake():
    insight = CareerDevelopmentGoalInsightCard(
        summary="当前基础已经能够支撑前端工程师起步阶段。",
        highlights=["HTML/CSS 基础较完整", "已有前端小型项目证据"],
    )
    markdown = build_comprehensive_report_markdown_content(
        trend_section_markdown="## 趋势依据\n前端岗位继续强调工程化、组件化与文档协作能力。",
        path_section_markdown="## 职业发展路径\n前端工程师 -> 资深前端工程师 -> 前端负责人",
        correlation_analysis=CareerDevelopmentGoalCorrelationAnalysis(
            foundation=insight,
            gaps=CareerDevelopmentGoalInsightCard(
                summary="工程化稳定性与复杂场景分析能力仍需补强。",
                highlights=["TypeScript 工程规范不足", "复杂问题拆解经验偏少"],
            ),
            path_impact=CareerDevelopmentGoalInsightCard(
                summary="当前路径成立，但推进速度会受到工程化短板影响。",
                highlights=["先补工程化再做可展示项目", "避免只停留在基础知识学习"],
            ),
        ),
        strength_directions=[
            CareerDevelopmentGoalStrengthDirectionItem(
                title="文档与规范意识",
                summary="能支撑起步阶段的团队协作要求。",
                supporting_dimensions=["沟通表达"],
                matched_keywords=["文档", "规范"],
                evidence_companies=["示例公司"],
                supporting_metrics=["岗位匹配度 76.66%"],
                reasoning="已有文档整理和表达基础，适合作为前端工程师起步阶段的支撑证据。",
            )
        ],
    )

    assert markdown.startswith("# 综合报告")
    assert "## 当前发展路径判断" in markdown
    assert "## 为什么这条路径成立" in markdown
    assert "## 需要重点关注的路径阻力" in markdown
    assert "浣犳" not in markdown
    assert "?/p>" not in markdown


def test_normalize_goal_plan_result_repairs_mojibake_comprehensive_report():
    favorite = build_favorite(build_report(communication_gap=40, teamwork_gap=20))
    result = build_result_payload(favorite).model_copy(
        update={
            "comprehensive_report_markdown": "浣犳槸鑱屼笟璺緞缁煎悎鎶ュ憡鍔╂墜",
            "generated_report_markdown": "",
        }
    )

    normalized = normalize_goal_plan_result(result)

    assert normalized.comprehensive_report_markdown.startswith("# 综合报告")
    assert "浣犳" not in normalized.comprehensive_report_markdown
    assert "## 结论" in normalized.comprehensive_report_markdown
