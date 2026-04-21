"""
岗位要求图谱服务（Job Requirement Graph）

模块职责：
    将岗位要求画像构建为可交互的图谱结构，同时支持：
    ① Neo4j 图数据库存储与查询（职业图谱探索）
    ② 静态图谱元数据生成（前端雷达图驱动）

三层图谱结构：
    ProfileRoot（根节点） → DimensionGroup（分组节点 × 3）
                              → Dimension（维度节点 × 12）

三大分组（GRAPH_GROUPS）：
    ① 专业与门槛：专业技能 / 专业背景 / 学历要求 / 工作经验 / 其他特殊
    ② 协作与适应：团队协作 / 抗压适应 / 沟通表达
    ③ 成长与职业素养：文档规范 / 责任心 / 学习能力 / 分析解决问题

Neo4j 实现（Neo4jJobRequirementGraphService）：
    • reset_graph — 全量重置图谱节点与边（仅当数据签名变化时触发）
    • get_graph   — 读取当前图谱（如未同步则自动同步）
    • 图谱签名基于所有岗位画像的关键词 + 覆盖率生成（SHA-1）

适用场景：
    前端雷达图展示 / Neo4j Browser 可视化探索 / 节点展开与路径查询
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime
import hashlib
import json
from typing import Any, Protocol

from neo4j import Driver, GraphDatabase
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.job_requirement_profile import JobRequirementProfile
from app.services.job_requirement_profile import DEFAULT_KEYWORD
from app.services.job_requirement_profile_read import parse_dimension_value


GRAPH_PROJECT_KEY = "job_requirement_profile"
GRAPH_VERSION = "2.1.0"


@dataclass(frozen=True, slots=True)
class DimensionMeta:
    key: str
    title: str
    description: str
    icon: str


@dataclass(frozen=True, slots=True)
class DimensionGroupMeta:
    key: str
    title: str
    description: str
    order: int
    dimensions: tuple[DimensionMeta, ...]


GRAPH_ROOT = {
    "key": GRAPH_PROJECT_KEY,
    "title": "岗位要求画像",
    "description": "围绕岗位要求建立的一张结构化认知图谱，帮助用户从门槛、协作与成长素养三个层次理解岗位期待。",
    "icon": "profile",
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GRAPH_GROUPS：职业图谱元数据 — 12 维度按 3 大分组组织
#
# 三大分组：
#   ① 专业与门槛（professional-and-threshold）
#      — 专业技能、专业背景、学历要求、工作经验、其他/特殊要求
#      — 聚焦硬性入场门槛
#
#   ② 协作与适应（collaboration-and-adaptation）
#      — 团队协作、抗压/适应、沟通表达
#      — 聚焦软性工作能力
#
#   ③ 成长与职业素养（growth-and-professionalism）
#      — 文档规范、责任心、学习能力、分析解决问题
#      — 聚焦长期发展潜力
#
# 用途：
#   • 驱动前端雷达图渲染
#   • 为 Neo4j 图谱提供节点结构
#   • 为 Qdrant 向量分组提供维度映射
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GRAPH_GROUPS: tuple[DimensionGroupMeta, ...] = (
    DimensionGroupMeta(
        key="professional-and-threshold",
        title="专业与门槛",
        description="聚焦岗位的硬性要求，帮助我们先看清入场门槛与核心专业基础。",
        order=1,
        dimensions=(
            DimensionMeta(
                key="professional_skills",
                title="专业技能",
                description="梳理岗位最关注的技能、工具、技术栈与业务方法。",
                icon="fund-projection-screen",
            ),
            DimensionMeta(
                key="professional_background",
                title="专业背景",
                description="提炼岗位偏好的专业方向、知识背景与学科基础。",
                icon="book",
            ),
            DimensionMeta(
                key="education_requirement",
                title="学历要求",
                description="概括岗位通常期待的学历层级与基础教育门槛。",
                icon="read",
            ),
            DimensionMeta(
                key="work_experience",
                title="工作经验",
                description="识别岗位对实习、项目经历与年限要求的侧重点。",
                icon="schedule",
            ),
            DimensionMeta(
                key="other_special",
                title="其他/特殊要求",
                description="承接不适合落入其他维度、但岗位明确提出的证书、语言、班次、驻场、出差等特殊要求。",
                icon="pushpin",
            ),
        ),
    ),
    DimensionGroupMeta(
        key="collaboration-and-adaptation",
        title="协作与适应",
        description="展示岗位在团队协作、沟通表达和环境适应方面的共性期待。",
        order=2,
        dimensions=(
            DimensionMeta(
                key="teamwork",
                title="团队协作能力",
                description="帮助理解岗位在配合、协同推进和跨角色合作上的要求。",
                icon="team",
            ),
            DimensionMeta(
                key="stress_adaptability",
                title="抗压/适应能力",
                description="呈现岗位面对节奏变化、挑战环境与任务压力时的适应要求。",
                icon="thunderbolt",
            ),
            DimensionMeta(
                key="communication",
                title="沟通表达能力",
                description="说明岗位对沟通、汇报、协调与信息传递能力的关注。",
                icon="message",
            ),
        ),
    ),
    DimensionGroupMeta(
        key="growth-and-professionalism",
        title="成长与职业素养",
        description="帮助用户理解岗位长期发展更看重的习惯、态度与问题处理能力。",
        order=3,
        dimensions=(
            DimensionMeta(
                key="documentation_awareness",
                title="文档规范意识",
                description="强调岗位在记录、文档输出和流程规范方面的基础要求。",
                icon="file-text",
            ),
            DimensionMeta(
                key="responsibility",
                title="责任心/工作态度",
                description="突出岗位对认真、主动、严谨和职业态度的要求。",
                icon="safety-certificate",
            ),
            DimensionMeta(
                key="learning_ability",
                title="学习能力",
                description="帮助识别岗位对持续学习、自我更新与成长节奏的期待。",
                icon="profile",
            ),
            DimensionMeta(
                key="problem_solving",
                title="分析解决问题能力",
                description="概括岗位在定位问题、分析原因和推动解决上的能力要求。",
                icon="solution",
            ),
        ),
    ),
)


def _round_coverage(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round(numerator / denominator, 4)


def _trim_keywords(items: Counter[str], limit: int = 6) -> list[str]:
    return [keyword for keyword, _count in items.most_common(limit)]


def _build_dimension_summary(base_description: str, keywords: list[str], non_default_count: int, total_profiles: int) -> str:
    coverage_percent = int(round(_round_coverage(non_default_count, total_profiles) * 100))
    if keywords:
        return f"{base_description} 高频关键词包括：{'、'.join(keywords)}。当前覆盖 {coverage_percent}% 的岗位画像。"
    return f"{base_description} 当前暂无明确关键词，覆盖 {coverage_percent}% 的岗位画像。"


def _build_group_summary(base_description: str, keywords: list[str], active_profiles: int, total_profiles: int) -> str:
    coverage_percent = int(round(_round_coverage(active_profiles, total_profiles) * 100))
    if keywords:
        return f"{base_description} 这一分组当前更常见的关注点包括：{'、'.join(keywords)}。覆盖 {coverage_percent}% 的岗位画像。"
    return f"{base_description} 这一分组当前暂无明确关键词，覆盖 {coverage_percent}% 的岗位画像。"


def _build_root_summary(total_profiles: int, keywords: list[str]) -> str:
    if keywords:
        return (
            f"{GRAPH_ROOT['description']} 当前共聚合 {total_profiles} 份岗位画像，"
            f"高频关注点集中在：{'、'.join(keywords)}。"
        )
    return f"{GRAPH_ROOT['description']} 当前共聚合 {total_profiles} 份岗位画像。"


def build_graph_payload_from_profiles(
    profiles: list[JobRequirementProfile],
) -> tuple[dict[str, Any], str]:
    total_profiles = len(profiles)
    generated_at = datetime.now(UTC).isoformat()
    all_keywords_counter: Counter[str] = Counter()

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, str]] = []
    group_payloads: list[dict[str, Any]] = []
    dimension_payloads: list[dict[str, Any]] = []

    for group in GRAPH_GROUPS:
        group_keywords_counter: Counter[str] = Counter()
        group_active_profiles = 0

        for profile in profiles:
            has_any_dimension = False
            for dimension in group.dimensions:
                items = parse_dimension_value(getattr(profile, dimension.key))
                if any(item != DEFAULT_KEYWORD for item in items):
                    has_any_dimension = True
                    break
            if has_any_dimension:
                group_active_profiles += 1

        for dimension in group.dimensions:
            keyword_counter: Counter[str] = Counter()
            non_default_count = 0
            for profile in profiles:
                items = parse_dimension_value(getattr(profile, dimension.key))
                valid_items = [item for item in items if item != DEFAULT_KEYWORD]
                if valid_items:
                    non_default_count += 1
                    keyword_counter.update(valid_items)
                    group_keywords_counter.update(valid_items)
                    all_keywords_counter.update(valid_items)

            keywords = _trim_keywords(keyword_counter)
            dimension_payloads.append(
                {
                    "id": dimension.key,
                    "type": "Dimension",
                    "title": dimension.title,
                    "description": _build_dimension_summary(
                        dimension.description,
                        keywords,
                        non_default_count,
                        total_profiles,
                    ),
                    "icon": dimension.icon,
                    "keywords": keywords,
                    "profile_count": total_profiles,
                    "non_default_count": non_default_count,
                    "coverage_ratio": _round_coverage(non_default_count, total_profiles),
                    "group_key": group.key,
                }
            )
            edges.append(
                {
                    "source": group.key,
                    "target": dimension.key,
                    "type": "HAS_DIMENSION",
                }
            )

        group_keywords = _trim_keywords(group_keywords_counter)
        group_payloads.append(
            {
                "id": group.key,
                "type": "DimensionGroup",
                "title": group.title,
                "description": _build_group_summary(
                    group.description,
                    group_keywords,
                    group_active_profiles,
                    total_profiles,
                ),
                "icon": "apartment",
                "keywords": group_keywords,
                "profile_count": total_profiles,
                "non_default_count": group_active_profiles,
                "coverage_ratio": _round_coverage(group_active_profiles, total_profiles),
                "group_key": group.key,
            }
        )
        edges.append(
            {
                "source": GRAPH_ROOT["key"],
                "target": group.key,
                "type": "HAS_GROUP",
            }
        )

    root_keywords = _trim_keywords(all_keywords_counter)
    root_payload = {
        "id": GRAPH_ROOT["key"],
        "type": "ProfileRoot",
        "title": GRAPH_ROOT["title"],
        "description": _build_root_summary(total_profiles, root_keywords),
        "icon": GRAPH_ROOT["icon"],
        "keywords": root_keywords,
        "profile_count": total_profiles,
        "non_default_count": total_profiles,
        "coverage_ratio": 1.0 if total_profiles else 0.0,
        "group_key": None,
    }

    nodes.extend([root_payload, *group_payloads, *dimension_payloads])
    meta = {
        "total_profiles": total_profiles,
        "graph_version": GRAPH_VERSION,
        "generated_at": generated_at,
    }

    signature_source = json.dumps(
        {
            "meta": meta,
            "nodes": [
                {
                    "id": node["id"],
                    "keywords": node["keywords"],
                    "non_default_count": node["non_default_count"],
                    "coverage_ratio": node["coverage_ratio"],
                }
                for node in nodes
            ],
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    signature = hashlib.sha1(signature_source.encode("utf-8")).hexdigest()

    return {
        "nodes": nodes,
        "edges": edges,
        "meta": meta,
    }, signature


def build_static_graph_payload() -> dict[str, Any]:
    return build_graph_payload_from_profiles([])[0]


class JobRequirementGraphServiceProtocol(Protocol):
    def reset_graph(self) -> None: ...

    def get_graph(self) -> dict[str, Any]: ...

    def ensure_graph_synced(self) -> None: ...


class Neo4jJobRequirementGraphService:
    def __init__(
        self,
        *,
        uri: str,
        username: str,
        password: str,
        database: str,
    ) -> None:
        self.database = database
        self.driver: Driver = GraphDatabase.driver(uri, auth=(username, password))

    def close(self) -> None:
        self.driver.close()

    def reset_graph(self) -> None:
        payload, signature = self._build_graph_payload()
        with self.driver.session(database=self.database) as session:
            session.execute_write(self._reset_graph_tx, payload, signature)

    def ensure_graph_synced(self) -> None:
        payload, signature = self._build_graph_payload()
        with self.driver.session(database=self.database) as session:
            state = session.execute_read(self._fetch_root_state_tx)
            if (
                not state
                or state["graph_version"] != GRAPH_VERSION
                or state["profile_signature"] != signature
            ):
                session.execute_write(self._reset_graph_tx, payload, signature)

    def get_graph(self) -> dict[str, Any]:
        self.ensure_graph_synced()
        with self.driver.session(database=self.database) as session:
            nodes = session.execute_read(self._fetch_nodes_tx)
            edges = session.execute_read(self._fetch_edges_tx)
            meta = session.execute_read(self._fetch_meta_tx)
        return {
            "nodes": nodes,
            "edges": edges,
            "meta": meta,
        }

    def _build_graph_payload(self) -> tuple[dict[str, Any], str]:
        with SessionLocal() as db:
            profiles = db.scalars(select(JobRequirementProfile).order_by(JobRequirementProfile.id.asc())).all()
        return build_graph_payload_from_profiles(list(profiles))

    @staticmethod
    def _fetch_root_state_tx(tx) -> dict[str, Any] | None:
        record = tx.run(
            """
            MATCH (root:ProfileRoot {project: $project, key: $key})
            RETURN
              root.graph_version AS graph_version,
              root.profile_signature AS profile_signature
            """,
            project=GRAPH_PROJECT_KEY,
            key=GRAPH_ROOT["key"],
        ).single()
        return dict(record) if record else None

    @staticmethod
    def _reset_graph_tx(tx, payload: dict[str, Any], signature: str) -> None:
        tx.run(
            """
            MATCH (n)
            WHERE n.project = $project
            DETACH DELETE n
            """,
            project=GRAPH_PROJECT_KEY,
        )

        root = payload["nodes"][0]
        meta = payload["meta"]
        tx.run(
            """
            CREATE (:ProfileRoot {
              project: $project,
              key: $key,
              title: $title,
              description: $description,
              icon: $icon,
              keywords: $keywords,
              profile_count: $profile_count,
              non_default_count: $non_default_count,
              coverage_ratio: $coverage_ratio,
              graph_version: $graph_version,
              generated_at: $generated_at,
              profile_signature: $profile_signature,
              total_profiles: $total_profiles
            })
            """,
            project=GRAPH_PROJECT_KEY,
            key=root["id"],
            title=root["title"],
            description=root["description"],
            icon=root["icon"],
            keywords=root["keywords"],
            profile_count=root["profile_count"],
            non_default_count=root["non_default_count"],
            coverage_ratio=root["coverage_ratio"],
            graph_version=meta["graph_version"],
            generated_at=meta["generated_at"],
            profile_signature=signature,
            total_profiles=meta["total_profiles"],
        )

        for node in payload["nodes"][1:]:
            tx.run(
                """
                CREATE (node:%s {
                  project: $project,
                  key: $key,
                  title: $title,
                  description: $description,
                  icon: $icon,
                  keywords: $keywords,
                  profile_count: $profile_count,
                  non_default_count: $non_default_count,
                  coverage_ratio: $coverage_ratio,
                  group_key: $group_key
                })
                """
                % node["type"],
                project=GRAPH_PROJECT_KEY,
                key=node["id"],
                title=node["title"],
                description=node["description"],
                icon=node["icon"],
                keywords=node["keywords"],
                profile_count=node["profile_count"],
                non_default_count=node["non_default_count"],
                coverage_ratio=node["coverage_ratio"],
                group_key=node["group_key"],
            )

        for edge in payload["edges"]:
            tx.run(
                """
                MATCH (source {project: $project, key: $source})
                MATCH (target {project: $project, key: $target})
                CREATE (source)-[:%s {project: $project}]->(target)
                """
                % edge["type"],
                project=GRAPH_PROJECT_KEY,
                source=edge["source"],
                target=edge["target"],
            )

    @staticmethod
    def _fetch_nodes_tx(tx) -> list[dict[str, Any]]:
        records = tx.run(
            """
            MATCH (node)
            WHERE node.project = $project
            RETURN
              node.key AS id,
              labels(node)[0] AS type,
              node.title AS title,
              node.description AS description,
              coalesce(node.icon, '') AS icon,
              coalesce(node.keywords, []) AS keywords,
              coalesce(node.profile_count, 0) AS profile_count,
              coalesce(node.non_default_count, 0) AS non_default_count,
              coalesce(node.coverage_ratio, 0.0) AS coverage_ratio,
              node.group_key AS group_key
            ORDER BY
              CASE labels(node)[0]
                WHEN 'ProfileRoot' THEN 0
                WHEN 'DimensionGroup' THEN 1
                ELSE 2
              END,
              node.key
            """,
            project=GRAPH_PROJECT_KEY,
        )
        return [dict(record) for record in records]

    @staticmethod
    def _fetch_edges_tx(tx) -> list[dict[str, str]]:
        records = tx.run(
            """
            MATCH (source)-[rel]->(target)
            WHERE source.project = $project AND target.project = $project
            RETURN
              source.key AS source,
              target.key AS target,
              type(rel) AS type
            ORDER BY source, target
            """,
            project=GRAPH_PROJECT_KEY,
        )
        return [dict(record) for record in records]

    @staticmethod
    def _fetch_meta_tx(tx) -> dict[str, Any]:
        record = tx.run(
            """
            MATCH (root:ProfileRoot {project: $project, key: $key})
            RETURN
              coalesce(root.total_profiles, 0) AS total_profiles,
              root.graph_version AS graph_version,
              root.generated_at AS generated_at
            """,
            project=GRAPH_PROJECT_KEY,
            key=GRAPH_ROOT["key"],
        ).single()
        return dict(record) if record else {
            "total_profiles": 0,
            "graph_version": GRAPH_VERSION,
            "generated_at": datetime.now(UTC).isoformat(),
        }
