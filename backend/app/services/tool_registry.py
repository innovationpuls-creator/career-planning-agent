from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

CAREER_COACH_READONLY_TOOLS = {
    "read_profile",
    "search_matches",
    "read_plan",
    "read_report",
}


class ToolRegistryError(RuntimeError):
    pass


@dataclass
class Tool:
    """Structured tool definition for P2+ ToolRegistry."""

    name: str
    description: str
    parameters: dict[str, Any]
    handler: Callable[[dict[str, Any]], dict[str, Any]] | Callable[..., Any]
    classification: str = "readonly"  # readonly | mutation_safe | mutation_gated
    agent: str = ""
    display_name: str = ""
    endpoint: str | None = None   # P2b: mapped REST endpoint
    method: str | None = None     # P2b: HTTP method (GET/POST/PUT)
    owner_check: bool = False     # validate args.student_id matches context.student_id


class ToolRegistry:
    """Tool registry for coach agent.

    P0c: simple dict-based registry with backward-compatible register().
    P2:  adds Tool dataclass, classification, agent filtering.
    """

    def __init__(self) -> None:
        self._tools: dict[str, dict[str, Any]] = {}
        self._tool_objects: dict[str, Tool] = {}

    # ── Backward-compatible P0c interface ──────────────────────────────

    def register(
        self,
        name: str,
        description: str,
        parameters: dict[str, Any],
        handler: Callable[[dict[str, Any]], dict[str, Any]],
    ) -> None:
        """P0c-compatible registration. Creates a Tool with readonly classification."""
        if name in self._tools:
            raise ToolRegistryError(f"Tool '{name}' is already registered")
        self._tools[name] = {
            "description": description,
            "parameters": parameters,
            "handler": handler,
        }
        self._tool_objects[name] = Tool(
            name=name,
            description=description,
            parameters=parameters,
            handler=handler,
            classification="readonly",
        )

    @staticmethod
    def _normalize_parameters(params: dict[str, Any]) -> dict[str, Any]:
        """Ensure parameters dict follows JSON Schema object format.

        Converts flat ``{"key": {"type": "..."}}`` into
        ``{"type": "object", "properties": {...}, "required": [...]}``.
        """
        if params.get("type") == "object" and "properties" in params:
            return params
        # Heuristic: if top-level keys look like property definitions, wrap them
        if all(isinstance(v, dict) and "type" in v for v in params.values()):
            props = {}
            required: list[str] = []
            for key, schema in params.items():
                props[key] = schema
                if not schema.get("optional"):
                    required.append(key)
            return {"type": "object", "properties": props, "required": required}
        # Already has type but no properties — assume it's valid
        if "type" in params:
            return params
        # Wrap bare params in object
        return {"type": "object", "properties": params}

    def get_schema(self) -> list[dict[str, Any]]:
        """Return tool schemas in OpenAI function-calling format (P0c compatible)."""
        result: list[dict[str, Any]] = []
        for name, tool in self._tools.items():
            result.append({
                "type": "function",
                "function": {
                    "name": name,
                    "description": tool["description"],
                    "parameters": self._normalize_parameters(tool["parameters"]),
                },
            })
        return result

    def execute(self, name: str, args: dict[str, Any]) -> dict[str, Any]:
        tool = self._tools.get(name)
        if tool is None:
            raise ToolRegistryError(f"Tool '{name}' not found")
        return tool["handler"](args)

    # ── P2 interface ───────────────────────────────────────────────────

    def register_tool(self, tool: Tool) -> None:
        """Register a structured Tool with classification and agent metadata."""
        if tool.name in self._tools:
            raise ToolRegistryError(f"Tool '{tool.name}' is already registered")
        tool_dict: dict[str, Any] = {
            "description": tool.description,
            "parameters": tool.parameters,
            "handler": tool.handler,
            "classification": tool.classification,
            "agent": tool.agent,
            "display_name": tool.display_name,
        }
        self._tools[tool.name] = tool_dict
        self._tool_objects[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        """Return the Tool object for the given name, or None."""
        return self._tool_objects.get(name)

    def list_all(self) -> list[Tool]:
        """Return all registered tools."""
        return list(self._tool_objects.values())

    def get_schema_for_llm(
        self, agent: str | None = None
    ) -> list[dict[str, Any]]:
        """Return schemas filtered by agent, with internal metadata stripped."""
        result: list[dict[str, Any]] = []
        for tool in self._tool_objects.values():
            career_coach_context_tool = (
                agent == "CareerCoach"
                and tool.name in CAREER_COACH_READONLY_TOOLS
                and tool.classification == "readonly"
            )
            if (
                agent
                and tool.agent
                and tool.agent != agent
                and tool.agent != "Shared"
                and not career_coach_context_tool
            ):
                continue
            result.append({
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": self._normalize_parameters(tool.parameters),
                },
            })
        return result

    def get_for_agent(self, agent: str) -> list[Tool]:
        """Return tools available to a specific agent (including Shared)."""
        return [
            t for t in self._tool_objects.values()
            if (
                not t.agent
                or t.agent == agent
                or t.agent == "Shared"
                or (
                    agent == "CareerCoach"
                    and t.name in CAREER_COACH_READONLY_TOOLS
                    and t.classification == "readonly"
                )
            )
        ]


def register_all_tools(registry: ToolRegistry) -> None:
    """Register all 22 tools (P2b complete tool set).

    Must be called once at startup, after process_memory_proposal registration.
    """
    from app.services.tools.handlers import (
        handle_analyze_gap,
        handle_append_achievement,
        handle_compare_industries,
        handle_create_review,
        handle_export_report,
        handle_generate_report,
        handle_get_home_summary,
        handle_parse_resume,
        handle_read_job_graph,
        handle_read_plan,
        handle_read_profile,
        handle_read_report,
        handle_recall_memory,
        handle_save_to_shortlist,
        handle_search_company,
        handle_search_matches,
        handle_suggest_keyword,
        handle_suggest_resources,
        handle_switch_agent,
        handle_update_reflection,
        handle_update_section,
        handle_verify_and_record_progress,
    )

    tools: list[Tool] = [
        # ResumeCoach (4 readonly)
        Tool(name="parse_resume", display_name="查看简历解析结果",
             description="查看学生已上传简历的解析结果，包括12维能力画像的各维度得分和evidence。如果学生还没上传简历，会返回空。",
             parameters={"student_id": {"type": "string"}},
             classification="readonly", handler=handle_parse_resume,
             agent="ResumeCoach",
             endpoint="/api/student-competency-profile/latest-analysis", method="GET"),
        Tool(name="read_profile", display_name="读取能力画像",
             description="按当前页面上下文读取学生最新12维能力画像、雷达图、差距维度和推荐关键词。回答简历/画像问题前应先调用。",
             parameters={"student_id": {"type": "string"}},
             classification="readonly", handler=handle_read_profile,
             agent="ResumeCoach",
             endpoint="/api/student-competency-profile/latest-analysis", method="GET"),
        Tool(name="analyze_gap", display_name="简历目标差距分析",
             description="分析当前简历与目标岗位之间的能力差距",
             parameters={"student_id": {"type": "string"}, "target_job": {"type": "string"}},
             classification="readonly", handler=handle_analyze_gap,
             agent="ResumeCoach",
             endpoint="/api/career-development-report/personal-growth-report", method="POST"),
        Tool(name="suggest_keyword", display_name="建议关键词",
             description="根据学生画像推荐简历关键词优化建议",
             parameters={"student_id": {"type": "string"}},
             classification="readonly", handler=handle_suggest_keyword,
             agent="ResumeCoach",
             endpoint="/api/student-competency-profile/latest-analysis", method="GET"),
        # CareerMatchCoach (5: 4 readonly + 1 mutation_safe)
        Tool(name="search_matches", display_name="搜索匹配岗位",
             description="读取职业匹配推荐、当前推荐目标和收藏状态。回答职业匹配/推荐岗位问题前应先调用。",
             parameters={
                 "student_id": {"type": "string"},
                 "limit": {"type": "integer"},
                 "recommendationId": {"type": "string", "optional": True},
             },
             classification="readonly", handler=handle_search_matches,
             agent="CareerMatchCoach",
             endpoint="/api/career-development-report/job-exploration-match/init", method="GET"),
        Tool(name="compare_industries", display_name="同岗行业对比",
             description="对比同一岗位在不同行业中的薪资、要求和发展前景",
             parameters={"job_title": {"type": "string"}},
             classification="readonly", handler=handle_compare_industries,
             agent="CareerMatchCoach",
             endpoint="/api/job-requirement-profile/vertical", method="GET"),
        Tool(name="search_company", display_name="搜索公司",
             description="搜索特定公司的基本信息和招聘岗位",
             parameters={"company": {"type": "string"}, "limit": {"type": "integer"}},
             classification="readonly", handler=handle_search_company,
             agent="CareerMatchCoach",
             endpoint="/api/job-postings", method="GET"),
        Tool(name="save_to_shortlist", display_name="收藏到入围名单",
             description="将感兴趣的岗位保存到收藏夹",
             parameters={"job_id": {"type": "string"}, "note": {"type": "string"}},
             classification="mutation_safe", handler=handle_save_to_shortlist,
             agent="CareerMatchCoach",
             endpoint="/api/career-development-report/favorites", method="POST"),
        Tool(name="read_job_graph", display_name="读取岗位能力图谱",
             description="读取岗位的能力需求图谱，了解各能力的权重关系",
             parameters={"job_id": {"type": "string"}},
             classification="readonly", handler=handle_read_job_graph,
             agent="CareerMatchCoach",
             endpoint="/api/job-requirement-profile/graph", method="GET"),
        # LearningPathCoach (4: 2 readonly + 1 mutation_gated + 1 mutation_safe)
        Tool(name="read_plan", display_name="读取学习计划",
             description="按当前页面上下文读取蜗牛学习路径工作区、阶段计划和周/月复盘。回答学习路径问题前应先调用。",
             parameters={
                 "student_id": {"type": "string"},
                 "favoriteId": {"type": "integer", "optional": True},
                 "workspaceId": {"type": "string", "optional": True},
             },
             classification="readonly", handler=handle_read_plan,
             agent="LearningPathCoach",
             endpoint="/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}", method="GET"),
        Tool(name="suggest_resources", display_name="推荐学习资源",
             description="根据学习目标推荐课程、项目、书籍等学习资源",
             parameters={
                 "goal": {"type": "string"},
                 "skill": {"type": "string"},
                 "favoriteId": {"type": "integer", "optional": True},
             },
             classification="readonly", handler=handle_suggest_resources,
             agent="LearningPathCoach",
             endpoint="/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}", method="GET"),
        Tool(name="verify_and_record_progress", display_name="验证记录进度",
             description="验证学习成果并记录进度。需要提供至少 2 项验证来源（测验成绩、项目链接等）",
             parameters={
                 "skill_id": {"type": "string", "description": "技能ID"},
                 "evidence": {"type": "array", "description": "验证证据列表"},
             },
             classification="mutation_gated", handler=handle_verify_and_record_progress,
             agent="LearningPathCoach",
             endpoint="", method=""),
        Tool(name="create_review", display_name="创建复盘",
             description="创建学习复盘记录，总结学习效果",
             parameters={"content": {"type": "string"}, "rating": {"type": "integer"}},
             classification="mutation_safe", handler=handle_create_review,
             agent="LearningPathCoach",
             endpoint="/api/snail-learning-path/workspaces", method="POST"),
        # ReportCoach (6: 3 readonly + 1 mutation_safe + 2 mutation_gated)
        Tool(name="read_report", display_name="读取报告草稿",
             description="按当前页面上下文读取个人职业成长报告章节、保存时间和生成状态。回答成长报告问题前应先调用。",
             parameters={
                 "student_id": {"type": "string"},
                 "favoriteId": {"type": "integer", "optional": True},
             },
             classification="readonly", handler=handle_read_report,
             agent="ReportCoach",
             endpoint="/api/career-development-report/personal-growth-report/workspaces/{favorite_id}", method="GET"),
        Tool(name="generate_report", display_name="生成报告",
             description="生成职业发展成长报告",
             parameters={"student_id": {"type": "string"}},
             classification="mutation_safe", handler=handle_generate_report,
             agent="ReportCoach",
             endpoint="/api/career-development-report/personal-growth-report/tasks", method="POST"),
        Tool(name="update_section", display_name="编辑报告章节",
             description="编辑成长报告中的特定章节内容",
             parameters={"section": {"type": "string"}, "content": {"type": "string"}},
             classification="mutation_safe", handler=handle_update_section,
             agent="ReportCoach",
             endpoint="/api/career-development-report/personal-growth-report/workspaces/current", method="PUT"),
        Tool(name="append_achievement", display_name="追加成就",
             description="向成长报告追加新的成就条目",
             parameters={"achievement": {"type": "object"}},
             classification="mutation_gated", handler=handle_append_achievement,
             agent="ReportCoach",
             endpoint="", method=""),
        Tool(name="update_reflection", display_name="更新反思",
             description="更新成长报告中的反思内容",
             parameters={"reflection": {"type": "string"}, "reflection_id": {"type": "string"}},
             classification="mutation_gated", handler=handle_update_reflection,
             agent="ReportCoach",
             endpoint="", method=""),
        Tool(name="export_report", display_name="导出报告",
             description="导出成长报告为 PDF/DOCX 格式",
             parameters={"student_id": {"type": "string"}, "format": {"type": "string"}},
             classification="readonly", handler=handle_export_report,
             agent="ReportCoach",
             endpoint="/api/career-development-report/personal-growth-report/workspaces/current/export", method="GET"),
        # Shared (3)
        Tool(name="switch_agent", display_name="切换子 Agent",
             description="切换到另一个子 Agent（如从简历教练切换到职业匹配教练）",
             parameters={"target": {"type": "string"}, "reason": {"type": "string"}},
             classification="readonly", handler=handle_switch_agent,
             agent="Shared",
             endpoint="", method=""),
        Tool(name="recall_memory", display_name="搜索记忆",
             description="搜索对话历史中的相关记忆片段",
             parameters={"query": {"type": "string"}, "top_k": {"type": "integer"}},
             classification="readonly", handler=handle_recall_memory,
             agent="Shared",
             endpoint="", method=""),
        Tool(name="get_home_summary", display_name="获取首页摘要",
             description="获取学生首页的概览摘要信息",
             parameters={"student_id": {"type": "string"}},
             classification="readonly", handler=handle_get_home_summary,
             agent="Shared",
             endpoint="/api/home-v2", method="GET"),
        # P2 existing: process_memory_proposal (already registered)
    ]

    for tool in tools:
        try:
            registry.register_tool(tool)
        except ToolRegistryError:
            pass  # Already registered (e.g. switch_agent)
