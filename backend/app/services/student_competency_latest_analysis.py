from __future__ import annotations

import json
import math
from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.student_competency_user_latest_profile import StudentCompetencyUserLatestProfile
from app.schemas.student_competency_profile import (
    JOB_PROFILE_FIELD_ORDER,
    LEGACY_EMPTY_PROFILE_VALUES,
    JobProfile12Dimensions,
    StudentCompetencyActionAdviceItem,
    StudentCompetencyChartSeriesItem,
    StudentCompetencyComparisonDimensionItem,
    StudentCompetencyLatestAnalysisPayload,
    StudentCompetencyNarrativePayload,
    StudentCompetencyScorePayload,
)
from app.services.job_requirement_graph import GRAPH_GROUPS, Neo4jJobRequirementGraphService


DIMENSION_TITLE_MAP = {
    dimension.key: dimension.title
    for group in GRAPH_GROUPS
    for dimension in group.dimensions
}

STATUS_LABEL_MISSING = "明显缺失"
STATUS_LABEL_WEAK = "信息偏弱"
STATUS_LABEL_BASELINE = "基础覆盖"
STATUS_LABEL_STRONG = "较强匹配"

ACTION_PLAYBOOK: dict[str, dict[str, list[str] | str]] = {
    "professional_skills": {
        "why": "岗位总览里，这一维度通常决定你能否被快速识别为可上手人选。",
        "sources": ["课程项目", "实习任务", "个人作品", "竞赛项目"],
        "actions": ["技术栈", "具体功能", "结果证据"],
        "phrases": ["{kw1} 功能开发", "{kw1} 问题排查", "{kw1} + {kw2} 实战"],
    },
    "professional_background": {
        "why": "岗位会用专业背景判断你的知识起点和培养方向是否匹配。",
        "sources": ["专业名称", "主修课程", "研究方向", "辅修经历"],
        "actions": ["专业背景", "课程支撑", "岗位关联"],
        "phrases": ["{kw1} 相关背景", "{kw1} 课程基础", "{kw1} 方向积累"],
    },
    "education_requirement": {
        "why": "学历要求通常是岗位筛选前置条件，表达不清会直接影响通过率。",
        "sources": ["学历信息", "学位信息", "在读阶段", "毕业时间"],
        "actions": ["学历层级", "学位信息", "毕业时间"],
        "phrases": ["本科在读", "本科及以上", "预计 {kw1} 毕业"],
    },
    "teamwork": {
        "why": "多数岗位关注你是否能在团队协作中稳定交付，而不只是独立完成任务。",
        "sources": ["团队项目", "社团协作", "跨组任务", "课程分工"],
        "actions": ["协作场景", "承担角色", "协作结果"],
        "phrases": ["团队协作推进", "跨角色配合", "协同完成交付"],
    },
    "stress_adaptability": {
        "why": "节奏变化、任务切换和压力承受能力会影响岗位适配的稳定性。",
        "sources": ["高峰期任务", "多任务并行", "紧急排期", "活动执行"],
        "actions": ["压力场景", "应对方式", "稳定结果"],
        "phrases": ["多任务并行", "高压节奏适应", "紧急任务响应"],
    },
    "communication": {
        "why": "沟通表达直接影响需求理解、协作推进和结果同步，是高频软技能维度。",
        "sources": ["跨部门协作", "汇报场景", "客户沟通", "项目对接"],
        "actions": ["沟通对象", "输出物", "推动结果"],
        "phrases": ["跨部门沟通协调", "需求澄清与同步", "汇报反馈闭环"],
    },
    "work_experience": {
        "why": "项目、实习或岗位经历是最容易建立可信度的核心证据之一。",
        "sources": ["实习经历", "项目经历", "兼职经历", "科研任务"],
        "actions": ["经历名称", "承担职责", "结果表现"],
        "phrases": ["项目经验", "实习经历", "负责 {kw1} 任务"],
    },
    "documentation_awareness": {
        "why": "岗位常用文档意识判断你的交付规范性和沉淀能力。",
        "sources": ["需求文档", "测试文档", "项目报告", "操作手册"],
        "actions": ["文档类型", "使用场景", "维护行为"],
        "phrases": ["文档整理输出", "报告撰写", "规范记录沉淀"],
    },
    "responsibility": {
        "why": "责任心和工作态度决定你能否稳定接住任务并持续推进。",
        "sources": ["独立负责任务", "值班安排", "长期项目", "活动执行"],
        "actions": ["承担事项", "推进过程", "结果闭环"],
        "phrases": ["主动跟进任务", "按时完成交付", "结果负责意识"],
    },
    "learning_ability": {
        "why": "学习能力决定你面对新工具、新业务和新流程时的成长速度。",
        "sources": ["自学记录", "新技术上手", "课程拓展", "项目迭代"],
        "actions": ["学习对象", "上手方式", "应用结果"],
        "phrases": ["快速学习上手", "持续自我更新", "新知识迁移应用"],
    },
    "problem_solving": {
        "why": "岗位会关注你是否能发现问题、定位原因并推动解决。",
        "sources": ["故障排查", "项目优化", "竞赛复盘", "流程改进"],
        "actions": ["问题定位", "解决动作", "优化结果"],
        "phrases": ["问题定位分析", "推动问题解决", "优化改进闭环"],
    },
    "other_special": {
        "why": "特殊要求通常影响岗位准入和工作安排，表达清晰能减少筛选损耗。",
        "sources": ["证书信息", "语言能力", "出差驻场", "驾照班次"],
        "actions": ["准入条件", "证书语言", "工作安排"],
        "phrases": ["相关证书", "语言能力", "接受出差驻场"],
    },
}


def serialize_analysis(payload: StudentCompetencyLatestAnalysisPayload) -> str:
    return json.dumps(payload.model_dump(mode="json"), ensure_ascii=False)


def serialize_profile(profile: JobProfile12Dimensions) -> str:
    return json.dumps(profile.model_dump(), ensure_ascii=False)


def _round_score(value: float) -> int:
    return max(0, min(100, round(value)))


def _round_metric(value: float) -> float:
    return round(value, 2)


def _effective_values(values: list[str]) -> list[str]:
    return [value for value in values if value.strip() and value.strip() not in LEGACY_EMPTY_PROFILE_VALUES]


def _normalize_token(value: str) -> str:
    return "".join(value.lower().split())


def _keyword_matches(user_value: str, market_keyword: str) -> bool:
    normalized_user = _normalize_token(user_value)
    normalized_market = _normalize_token(market_keyword)
    if not normalized_user or not normalized_market:
        return False
    return (
        normalized_user == normalized_market
        or normalized_user in normalized_market
        or normalized_market in normalized_user
    )


def _match_market_keywords(user_values: list[str], market_keywords: list[str]) -> tuple[list[str], list[str]]:
    matched: list[str] = []
    for keyword in market_keywords:
        if any(_keyword_matches(user_value, keyword) for user_value in user_values):
            matched.append(keyword)
    matched_set = set(matched)
    missing = [keyword for keyword in market_keywords if keyword not in matched_set]
    return matched, missing


def _coverage_score(value_count: int) -> float:
    if value_count <= 0:
        return 0.0
    if value_count == 1:
        return 0.4
    if value_count == 2:
        return 0.75
    return 1.0


def _alignment_score(match_count: int) -> float:
    if match_count <= 0:
        return 0.0
    if match_count == 1:
        return 0.5
    return 1.0


def _status_label(user_readiness: float) -> str:
    if user_readiness < 25:
        return STATUS_LABEL_MISSING
    if user_readiness < 55:
        return STATUS_LABEL_WEAK
    if user_readiness < 80:
        return STATUS_LABEL_BASELINE
    return STATUS_LABEL_STRONG


def _top_half_keys(items: list[StudentCompetencyComparisonDimensionItem]) -> list[str]:
    ranked = sorted(
        items,
        key=lambda item: (-item.market_weight, JOB_PROFILE_FIELD_ORDER.index(item.key)),
    )
    limit = max(1, math.ceil(len(ranked) / 2))
    return [item.key for item in ranked[:limit]]


def _recommend_keywords(
    comparison_items: list[StudentCompetencyComparisonDimensionItem],
    keys: list[str],
) -> dict[str, list[str]]:
    items_by_key = {item.key: item for item in comparison_items}
    recommendations: dict[str, list[str]] = {}
    for key in keys:
        item = items_by_key.get(key)
        if item is None:
            continue
        recommendations[key] = item.missing_market_keywords[:3]
    return recommendations


def _importance_phrase(market_target: float) -> str:
    if market_target >= 85:
        return "属于岗位高关注维度"
    if market_target >= 65:
        return "属于岗位重点关注维度"
    return "属于岗位常见关注维度"


def _build_current_issue(item: StudentCompetencyComparisonDimensionItem) -> str:
    if not item.user_values:
        return "当前缺少直接关键词、可证明经历，以及与市场高频词对齐的表达。"
    if len(item.user_values) == 1:
        return "当前仅有 1 个关键词，信息过少，缺少场景、动作或结果，也尚未形成高频词组合。"
    if not item.matched_market_keywords:
        return "当前已有内容，但与市场常见表达未对齐，建议补充更贴近岗位语言的关键词组合。"
    return "当前已有基础信息，但关键词数量或市场对齐度仍偏弱，建议继续补充场景和结果证据。"


def _pick_example_phrases(
    *,
    key: str,
    recommended_keywords: list[str],
) -> list[str]:
    playbook = ACTION_PLAYBOOK.get(key, {})
    templates = list(playbook.get("phrases", []))
    kw1 = recommended_keywords[0] if recommended_keywords else DIMENSION_TITLE_MAP.get(key, key)
    kw2 = recommended_keywords[1] if len(recommended_keywords) > 1 else kw1
    phrases = []
    for template in templates:
        phrases.append(template.format(kw1=kw1, kw2=kw2))
    return phrases[:3]


def _build_action_advices(
    comparison_items: list[StudentCompetencyComparisonDimensionItem],
    priority_gap_keys: list[str],
    recommended_keywords: dict[str, list[str]],
) -> list[StudentCompetencyActionAdviceItem]:
    items_by_key = {item.key: item for item in comparison_items}
    advices: list[StudentCompetencyActionAdviceItem] = []

    for key in priority_gap_keys[:3]:
        item = items_by_key.get(key)
        if item is None:
            continue
        playbook = ACTION_PLAYBOOK.get(key, {})
        sources = list(playbook.get("sources", []))[:3]
        actions = list(playbook.get("actions", []))[:3]
        suggested_keywords = recommended_keywords.get(key) or item.missing_market_keywords[:3]
        focus_text = " / ".join(actions) if actions else item.title
        first_source = sources[0] if sources else "现有经历"
        second_source = sources[1] if len(sources) > 1 else first_source
        keyword_text = "、".join(suggested_keywords[:2]) if suggested_keywords else "岗位高频表达"

        next_actions = [
            f"先从 {first_source} 里梳理与 {item.title} 相关的具体经历。",
            f"再补充 {focus_text}，优先带上 {keyword_text} 这类高频词组合。",
            f"最后补上结果证据，如产出物、协作对象、完成结果或量化指标。",
        ]

        why_template = str(playbook.get("why") or f"{item.title} 会影响岗位适配判断。")
        why_it_matters = f"{_importance_phrase(item.market_target)}，{why_template}"

        if second_source and second_source not in sources:
            sources.append(second_source)

        advices.append(
            StudentCompetencyActionAdviceItem(
                key=item.key,
                title=item.title,
                status_label=item.status_label,
                gap=_round_metric(item.gap),
                why_it_matters=why_it_matters,
                current_issue=_build_current_issue(item),
                next_actions=next_actions[:3],
                example_phrases=_pick_example_phrases(key=item.key, recommended_keywords=suggested_keywords),
                evidence_sources=sources[:3],
                recommended_keywords=suggested_keywords[:3],
            )
        )

    return advices


def _build_narrative(
    *,
    score: StudentCompetencyScorePayload,
    comparison_items: list[StudentCompetencyComparisonDimensionItem],
    strength_keys: list[str],
    priority_gap_keys: list[str],
    action_advices: list[StudentCompetencyActionAdviceItem],
) -> StudentCompetencyNarrativePayload:
    items_by_key = {item.key: item for item in comparison_items}

    overall_review = (
        f"当前画像完整度 {score.completeness} 分，竞争力 {score.competitiveness} 分，综合评分 {score.overall} 分。"
        "本轮评分已按更严格规则收紧，只有覆盖足够具体且与市场高频表达对齐，分数才会明显提升。"
    )
    completeness_explanation = (
        "完整度更强调覆盖深度：只有 1 个关键词只算初步覆盖，2 个关键词才进入中段，至少 3 个具体关键词才会拿到该维度的完整覆盖分。"
    )
    competitiveness_explanation = (
        "竞争力同时看覆盖深度和市场对齐度：仅有自定义表达但对不上岗位高频词，分数仍会被压低；至少出现 1 到 2 个对齐关键词，竞争力才会往上走。"
    )

    strength_highlights = [
        f"{items_by_key[key].title}：当前达到 {items_by_key[key].status_label}，且位于岗位高关注区间。"
        for key in strength_keys
        if key in items_by_key
    ][:3]

    priority_gap_highlights = [
        f"{advice.title}：{advice.current_issue} 优先从 {', '.join(advice.evidence_sources[:2])} 提取素材。"
        for advice in action_advices[:3]
    ]

    return StudentCompetencyNarrativePayload(
        overall_review=overall_review,
        completeness_explanation=completeness_explanation,
        competitiveness_explanation=competitiveness_explanation,
        strength_highlights=strength_highlights,
        priority_gap_highlights=priority_gap_highlights,
    )


@dataclass(slots=True)
class StudentCompetencyLatestAnalysisService:
    graph_service_factory: Callable[[], object]

    def build_analysis(
        self,
        *,
        workspace_conversation_id: str,
        profile: JobProfile12Dimensions,
    ) -> StudentCompetencyLatestAnalysisPayload:
        service = self.graph_service_factory()
        try:
            graph_payload = service.get_graph()
        except Exception as exc:
            return StudentCompetencyLatestAnalysisPayload(
                available=False,
                message=f"岗位总览基准暂不可用：{exc}",
                workspace_conversation_id=workspace_conversation_id,
                profile=profile,
            )
        finally:
            close = getattr(service, "close", None)
            if callable(close):
                close()

        dimension_nodes = [
            node for node in graph_payload.get("nodes", [])
            if node.get("type") == "Dimension" and node.get("id") in JOB_PROFILE_FIELD_ORDER
        ]
        if len(dimension_nodes) != len(JOB_PROFILE_FIELD_ORDER):
            return StudentCompetencyLatestAnalysisPayload(
                available=False,
                message="岗位总览基准缺少完整的 12 维数据。",
                workspace_conversation_id=workspace_conversation_id,
                profile=profile,
            )

        dimension_nodes_by_key = {node["id"]: node for node in dimension_nodes}
        market_weights = [float(dimension_nodes_by_key[key].get("coverage_ratio") or 0.0) for key in JOB_PROFILE_FIELD_ORDER]
        total_market_weight = sum(market_weights)
        max_market_weight = max(market_weights) if market_weights else 0.0
        if total_market_weight <= 0 or max_market_weight <= 0:
            return StudentCompetencyLatestAnalysisPayload(
                available=False,
                message="岗位总览基准暂无有效权重数据。",
                workspace_conversation_id=workspace_conversation_id,
                profile=profile,
            )

        comparison_items: list[StudentCompetencyComparisonDimensionItem] = []
        chart_series: list[StudentCompetencyChartSeriesItem] = []
        weighted_completeness = 0.0
        weighted_competitiveness = 0.0

        for key in JOB_PROFILE_FIELD_ORDER:
            node = dimension_nodes_by_key[key]
            raw_values = getattr(profile, key)
            user_values = _effective_values(raw_values)
            presence = 1 if user_values else 0
            richness = min(len(user_values) / 3, 1)
            coverage_score = _coverage_score(len(user_values))
            matched_market_keywords, missing_market_keywords = _match_market_keywords(
                user_values,
                list(node.get("keywords") or []),
            )
            alignment_score = _alignment_score(len(matched_market_keywords))
            market_weight = float(node.get("coverage_ratio") or 0.0)
            normalized_weight = market_weight / total_market_weight
            user_readiness = 100 * (0.1 * presence + 0.5 * coverage_score + 0.4 * alignment_score)
            market_target = 100 * market_weight / max_market_weight
            gap = market_target - user_readiness

            weighted_completeness += normalized_weight * coverage_score
            weighted_competitiveness += normalized_weight * (user_readiness / 100)

            comparison_items.append(
                StudentCompetencyComparisonDimensionItem(
                    key=key,
                    title=DIMENSION_TITLE_MAP.get(key, key),
                    user_values=user_values,
                    market_keywords=list(node.get("keywords") or []),
                    market_weight=_round_metric(market_weight),
                    normalized_weight=_round_metric(normalized_weight),
                    market_target=_round_metric(market_target),
                    user_readiness=_round_metric(user_readiness),
                    gap=_round_metric(gap),
                    presence=presence,
                    richness=_round_metric(richness),
                    status_label=_status_label(user_readiness),
                    matched_market_keywords=matched_market_keywords,
                    missing_market_keywords=missing_market_keywords,
                    coverage_score=_round_metric(coverage_score),
                    alignment_score=_round_metric(alignment_score),
                )
            )
            chart_series.append(
                StudentCompetencyChartSeriesItem(
                    key=key,
                    title=DIMENSION_TITLE_MAP.get(key, key),
                    market_importance=_round_metric(market_target),
                    user_readiness=_round_metric(user_readiness),
                )
            )

        completeness = _round_score(100 * weighted_completeness)
        competitiveness = _round_score(100 * weighted_competitiveness)
        score = StudentCompetencyScorePayload(
            completeness=completeness,
            competitiveness=competitiveness,
            overall=_round_score(0.35 * completeness + 0.65 * competitiveness),
        )

        top_half_keys = set(_top_half_keys(comparison_items))
        strength_keys = [
            item.key
            for item in sorted(
                comparison_items,
                key=lambda item: (-item.market_weight, -item.user_readiness, item.gap),
            )
            if item.key in top_half_keys and item.user_readiness >= 55
        ][:3]
        priority_gap_keys = [
            item.key
            for item in sorted(comparison_items, key=lambda item: item.gap, reverse=True)
            if item.key in top_half_keys and item.gap > 0
        ][:3]
        if not priority_gap_keys:
            priority_gap_keys = [
                item.key
                for item in sorted(comparison_items, key=lambda item: item.gap, reverse=True)
                if item.gap > 0
            ][:3]

        recommended_keywords = _recommend_keywords(comparison_items, priority_gap_keys)
        action_advices = _build_action_advices(
            comparison_items,
            priority_gap_keys,
            recommended_keywords,
        )
        narrative = _build_narrative(
            score=score,
            comparison_items=comparison_items,
            strength_keys=strength_keys,
            priority_gap_keys=priority_gap_keys,
            action_advices=action_advices,
        )

        return StudentCompetencyLatestAnalysisPayload(
            available=True,
            message=narrative.overall_review,
            workspace_conversation_id=workspace_conversation_id,
            profile=profile,
            score=score,
            comparison_dimensions=sorted(comparison_items, key=lambda item: item.gap, reverse=True),
            chart_series=chart_series,
            strength_dimensions=strength_keys,
            priority_gap_dimensions=priority_gap_keys,
            recommended_keywords=recommended_keywords,
            action_advices=action_advices,
            narrative=narrative,
        )


def build_student_competency_latest_analysis_service() -> StudentCompetencyLatestAnalysisService:
    return StudentCompetencyLatestAnalysisService(
        graph_service_factory=lambda: Neo4jJobRequirementGraphService(
            uri=settings.neo4j_uri,
            username=settings.neo4j_username,
            password=settings.neo4j_password,
            database=settings.neo4j_database,
        )
    )


def get_student_competency_latest_profile_record(
    db: Session,
    *,
    user_id: int,
) -> StudentCompetencyUserLatestProfile | None:
    statement = select(StudentCompetencyUserLatestProfile).where(
        StudentCompetencyUserLatestProfile.user_id == user_id
    )
    return db.scalar(statement)


def save_student_competency_latest_profile(
    db: Session,
    *,
    user_id: int,
    workspace_conversation_id: str,
    profile: JobProfile12Dimensions,
    analysis: StudentCompetencyLatestAnalysisPayload,
) -> StudentCompetencyUserLatestProfile:
    record = get_student_competency_latest_profile_record(db, user_id=user_id)
    if record is None:
        record = StudentCompetencyUserLatestProfile(
            user_id=user_id,
            latest_workspace_conversation_id=workspace_conversation_id,
            latest_profile_json=serialize_profile(profile),
            latest_analysis_json=serialize_analysis(analysis),
        )
    else:
        record.latest_workspace_conversation_id = workspace_conversation_id
        record.latest_profile_json = serialize_profile(profile)
        record.latest_analysis_json = serialize_analysis(analysis)

    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def delete_student_competency_latest_profile(
    db: Session,
    *,
    user_id: int,
) -> None:
    record = get_student_competency_latest_profile_record(db, user_id=user_id)
    if record is None:
        return
    db.delete(record)
    db.commit()


def read_student_competency_latest_analysis(
    record: StudentCompetencyUserLatestProfile | None,
) -> StudentCompetencyLatestAnalysisPayload:
    if record is None:
        return StudentCompetencyLatestAnalysisPayload(
            available=False,
            message="暂无最新画像分析。",
        )
    try:
        payload = json.loads(record.latest_analysis_json)
        analysis = StudentCompetencyLatestAnalysisPayload.model_validate(payload)
    except (json.JSONDecodeError, TypeError, ValueError):
        return StudentCompetencyLatestAnalysisPayload(
            available=False,
            message="最新画像分析数据损坏，请重新生成学生画像。",
        )
    return analysis.model_copy(update={"updated_at": record.updated_at})
