from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal


SkillSource = Literal["slash_command"]


@dataclass(frozen=True)
class CoachSkill:
    name: str
    label: str
    description: str
    agent: str
    classification: str
    enabled: bool = True
    requires_evidence: bool = False


COACH_SKILLS: tuple[CoachSkill, ...] = (
    CoachSkill(
        name="read_profile",
        label="读取能力画像",
        description="读取最新 12 维能力画像、差距维度和推荐关键词。",
        agent="ResumeCoach",
        classification="readonly",
    ),
    CoachSkill(
        name="search_matches",
        label="搜索匹配岗位",
        description="读取职业匹配推荐、当前推荐目标和收藏状态。",
        agent="CareerMatchCoach",
        classification="readonly",
    ),
    CoachSkill(
        name="read_plan",
        label="读取学习计划",
        description="读取当前蜗牛学习路径、阶段计划和周/月复盘。",
        agent="LearningPathCoach",
        classification="readonly",
    ),
    CoachSkill(
        name="read_report",
        label="读取成长报告",
        description="读取个人职业成长报告章节、保存时间和生成状态。",
        agent="ReportCoach",
        classification="readonly",
    ),
    CoachSkill(
        name="recall_memory",
        label="搜索记忆",
        description="搜索历史对话和长期记忆中的相关信息。",
        agent="Shared",
        classification="readonly",
    ),
    CoachSkill(
        name="get_home_summary",
        label="获取首页摘要",
        description="获取学生首页概览，用于快速了解当前进度。",
        agent="Shared",
        classification="readonly",
    ),
    CoachSkill(
        name="verify_and_record_progress",
        label="验证学习进度",
        description="根据测验、项目、证书等证据判断是否可以记录技能掌握进度。",
        agent="LearningPathCoach",
        classification="mutation_gated",
        requires_evidence=True,
    ),
    CoachSkill(
        name="generate_report",
        label="生成成长报告",
        description="在当前目标和报告上下文可用时生成个人职业成长报告。",
        agent="ReportCoach",
        classification="mutation_safe",
    ),
    CoachSkill(
        name="append_achievement",
        label="追加成就",
        description="在证据充分时向成长报告追加成就记录。",
        agent="ReportCoach",
        classification="mutation_gated",
        requires_evidence=True,
    ),
    CoachSkill(
        name="update_reflection",
        label="更新反思",
        description="在内容明确时更新成长报告中的反思记录。",
        agent="ReportCoach",
        classification="mutation_gated",
        requires_evidence=True,
    ),
    CoachSkill(
        name="resume",
        label="切换到简历教练",
        description="切换到简历教练并读取最新12维能力画像。",
        agent="ResumeCoach",
        classification="readonly",
    ),
    CoachSkill(
        name="match",
        label="切换到岗位匹配教练",
        description="切换到岗位匹配教练并搜索最新匹配推荐。",
        agent="CareerMatchCoach",
        classification="readonly",
    ),
    CoachSkill(
        name="learn",
        label="切换到学习路径教练",
        description="切换到学习路径教练并读取当前学习计划。",
        agent="LearningPathCoach",
        classification="readonly",
    ),
    CoachSkill(
        name="report",
        label="切换到成长报告教练",
        description="切换到成长报告教练并读取最新报告章节。",
        agent="ReportCoach",
        classification="readonly",
    ),
)

HIDDEN_COACH_SKILLS = {
    "save_to_shortlist",
    "create_review",
    "update_section",
}

EVIDENCE_REQUIRED_SKILLS = {
    "verify_and_record_progress",
    "append_achievement",
    "update_reflection",
}

CONTEXT_REQUIRED_SKILLS = {
    "generate_report",
    "append_achievement",
    "update_reflection",
}

SKILL_TO_TOOL: dict[str, str] = {
    "read_profile": "read_profile",
    "search_matches": "search_matches",
    "read_plan": "read_plan",
    "read_report": "read_report",
    "recall_memory": "recall_memory",
    "get_home_summary": "get_home_summary",
    "verify_and_record_progress": "verify_and_record_progress",
    "generate_report": "generate_report",
    "append_achievement": "append_achievement",
    "update_reflection": "update_reflection",
}

ROUTE_COMMAND_AGENT: dict[str, str] = {
    "resume": "ResumeCoach",
    "match": "CareerMatchCoach",
    "learn": "LearningPathCoach",
    "report": "ReportCoach",
}

ROUTE_COMMAND_DEFAULT_TOOL: dict[str, str] = {
    "resume": "read_profile",
    "match": "search_matches",
    "learn": "read_plan",
    "report": "read_report",
}


def get_skill_tool_name(skill_name: str) -> str | None:
    return SKILL_TO_TOOL.get(skill_name)


def is_route_command(skill_name: str) -> bool:
    return skill_name in ROUTE_COMMAND_AGENT


def get_route_command_agent(skill_name: str) -> str | None:
    return ROUTE_COMMAND_AGENT.get(skill_name)


def get_route_command_default_tool(skill_name: str) -> str | None:
    return ROUTE_COMMAND_DEFAULT_TOOL.get(skill_name)


EVIDENCE_KEYWORDS = (
    "http://",
    "https://",
    "github",
    "gitlab",
    "项目",
    "作品",
    "测验",
    "测试",
    "分数",
    "成绩",
    "证书",
    "截图",
    "链接",
    "通过率",
    "正确率",
    "完成了",
    "交付",
)


def list_enabled_coach_skills() -> list[CoachSkill]:
    return [skill for skill in COACH_SKILLS if skill.enabled]


def get_enabled_coach_skill(name: str) -> CoachSkill | None:
    for skill in COACH_SKILLS:
        if skill.name == name and skill.enabled:
            return skill
    return None


def skill_to_payload(skill: CoachSkill) -> dict[str, Any]:
    return {
        "name": skill.name,
        "label": skill.label,
        "description": skill.description,
        "agent": skill.agent,
        "classification": skill.classification,
        "enabled": skill.enabled,
        "requiresEvidence": skill.requires_evidence,
    }


def selected_skill_needs_evidence(name: str) -> bool:
    return name in EVIDENCE_REQUIRED_SKILLS


def message_has_evidence(text: str) -> bool:
    normalized = text.lower()
    return any(keyword in normalized for keyword in EVIDENCE_KEYWORDS)


def selected_skill_needs_context(name: str) -> bool:
    return name in CONTEXT_REQUIRED_SKILLS


def selected_skill_has_context(
    name: str,
    page_context: dict[str, Any] | None,
) -> bool:
    if not selected_skill_needs_context(name):
        return True
    if not page_context:
        return False
    if name == "generate_report":
        return bool(page_context.get("favoriteId") or page_context.get("favorite_id"))
    return bool(
        page_context.get("favoriteId")
        or page_context.get("favorite_id")
        or page_context.get("reportId")
        or page_context.get("report_id")
    )


def build_selected_skill_prompt(
    selected_skill: dict[str, Any] | None,
    *,
    evidence_ready: bool = True,
    context_ready: bool = True,
) -> str:
    if not selected_skill:
        return ""

    name = str(selected_skill.get("name") or "")
    skill = get_enabled_coach_skill(name)
    if not skill:
        return ""

    lines = [
        "## 本轮用户显式选择的教练能力",
        f"- skill: {skill.name}",
        f"- 中文名: {skill.label}",
        f"- 类型: {skill.classification}",
        f"- 所属教练: {skill.agent}",
        "- 处理规则: 用户通过斜杠命令明确选择了该能力。请优先围绕该能力处理；如果缺少必要参数或业务上下文，先说明缺少什么，不要编造成功。",
    ]
    if skill.classification == "readonly":
        lines.append("- 只读规则: 对应只读工具的结果已预加载到本轮消息中（见系统预执行结果），请直接使用该数据用中文回答，不要再调用该工具。")
    elif not context_ready:
        lines.extend([
            "- 写入规则: 当前缺少目标或报告上下文，本轮不要调用写入或受控写入工具。",
            "- 回答格式: 明确说明没有修改数据；提示用户先从对应目标、学习路径或成长报告页面进入教练。",
        ])
    elif not evidence_ready:
        lines.extend([
            "- 写入规则: 当前证据不足，本轮不要调用写入或受控写入工具。",
            "- 回答格式: 明确说明没有修改数据；列出缺少的证据；给出下一步测试或材料要求。",
        ])
    else:
        lines.extend([
            "- 写入规则: 写入前必须先检查当前业务上下文和证据是否足够；不足时不要写入。",
            "- 失败格式: 明确说明没有修改数据；列出缺少的证据；给出下一步测试或材料要求。",
        ])
    return "\n".join(lines)
