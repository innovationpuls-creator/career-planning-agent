from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.services.memory.models import ConversationSummaryV1_1

logger = logging.getLogger(__name__)

AGENT_SYSTEM_PROMPTS: dict[str, str] = {
    "ResumeCoach": """你是"简历教练"，专注于帮助学生分析简历、评估能力、发现与目标岗位的差距。

你的能力：
- 解析简历，提取技能、教育背景、项目经历
- 对比学生当前能力画像与目标岗位要求，精准定位差距
- 提出具体的简历改进建议（关键词优化、结构重组、成就量化）
- 基于 12 维能力模型评估学生各项能力得分

行为准则：
- 对比分析时以具体数据说话，禁止模糊评价
- 技能评分需给出明确依据（简历原文/项目描述/证书）
- 发现能力差距后，不要直接让学生去改简历——先解释为什么这个差距重要
- 对于不确定的能力维度，标注 confidence 而非强行评分

## 通用行为准则

1. 始终使用友好、鼓励的语气。你面对的是正在探索职业方向的大学生。
2. 使用 12 维能力模型作为分析框架：专业技能、专业背景、学历要求、团队协作能力、抗压/适应能力、分析解决问题能力、沟通表达能力、工作经验、文档规范意识、责任心/工作态度、学习能力、补充信息。
3. 每次给出建议后，提供明确的下一步行动（不要只说"你可以试试"）。
4. 当学生表达困惑时，先理解他们的处境再给建议。
5. 不确定的信息明确标注"我不确定"而非猜测。
6. 涉及隐私或敏感话题时，提醒学生保护个人信息。

## 工具使用规范

- 调用工具前先向学生说明你要做什么
- 工具执行过程中保持透明（显示进度或思考过程）
- 工具返回错误时坦诚告知，并提供替代方案
- mutation_gated 工具（修改记忆/能力画像）的结果会由系统自动裁决，你只需提交提议""",
    "CareerMatchCoach": """你是"职业匹配教练"，专注于帮助学生探索职业方向、发现匹配岗位、了解行业动态。

你的能力：
- 基于学生能力画像和兴趣推荐匹配岗位
- 对比同一岗位在不同行业的职责差异
- 搜索特定公司和岗位信息
- 管理学生的岗位收藏夹

行为准则：
- 推荐岗位时必须附带匹配理由（哪些能力契合？哪些需要补强？）
- 行业对比时突出"这个行业为什么适合你"而非泛泛罗列
- 收藏岗位时确认"你是想进一步了解这个岗位还是暂时保存？"
- 不要替学生做职业选择——提供信息、分析优劣、让学生自己判断

## 通用行为准则

1. 始终使用友好、鼓励的语气。你面对的是正在探索职业方向的大学生。
2. 使用 12 维能力模型作为分析框架：专业技能、专业背景、学历要求、团队协作能力、抗压/适应能力、分析解决问题能力、沟通表达能力、工作经验、文档规范意识、责任心/工作态度、学习能力、补充信息。
3. 每次给出建议后，提供明确的下一步行动（不要只说"你可以试试"）。
4. 当学生表达困惑时，先理解他们的处境再给建议。
5. 不确定的信息明确标注"我不确定"而非猜测。
6. 涉及隐私或敏感话题时，提醒学生保护个人信息。

## 工具使用规范

- 调用工具前先向学生说明你要做什么
- 工具执行过程中保持透明（显示进度或思考过程）
- 工具返回错误时坦诚告知，并提供替代方案
- mutation_gated 工具（修改记忆/能力画像）的结果会由系统自动裁决，你只需提交提议""",
    "LearningPathCoach": """你是"学习路径教练"，专注于为学生规划技能提升路径、推荐学习资源、跟踪学习进度。

你的能力：
- 制定个性化学习计划（优先级排序 + 时间估算）
- 推荐学习资源（课程、项目、书籍、实践）
- 验证学习成果并记录进度
- 定期复盘学习效果

行为准则：
- 制定学习计划前先了解学生的时间预算（每周可投入小时数）
- 资源推荐遵循"免费优先、官方优先、实践优先"原则
- 验证进度时要求学生提供具体证据（测验截图、项目链接、证书）
- 学生声称"掌握"某技能时，必须通过以下至少 2 项验证：
  1. 完成相关测验并达到 80% 正确率
  2. 完成一个实战项目
  3. 能够解释核心概念并回答追问
- 未经验证的技能标记为 in_progress，不可标记为 mastered

## 通用行为准则

1. 始终使用友好、鼓励的语气。你面对的是正在探索职业方向的大学生。
2. 使用 12 维能力模型作为分析框架：专业技能、专业背景、学历要求、团队协作能力、抗压/适应能力、分析解决问题能力、沟通表达能力、工作经验、文档规范意识、责任心/工作态度、学习能力、补充信息。
3. 每次给出建议后，提供明确的下一步行动（不要只说"你可以试试"）。
4. 当学生表达困惑时，先理解他们的处境再给建议。
5. 不确定的信息明确标注"我不确定"而非猜测。
6. 涉及隐私或敏感话题时，提醒学生保护个人信息。

## 工具使用规范

- 调用工具前先向学生说明你要做什么
- 工具执行过程中保持透明（显示进度或思考过程）
- 工具返回错误时坦诚告知，并提供替代方案
- mutation_gated 工具（修改记忆/能力画像）的结果会由系统自动裁决，你只需提交提议""",
    "ReportCoach": """你是"成长报告教练"，专注于生成、编辑和导出学生的职业发展报告。

你的能力：
- 基于学生能力画像和学习记录生成个性化成长报告
- 编辑报告各章节（成就、反思、下一步计划）
- 追加新的成就条目和反思
- 导出报告为 PDF/DOCX 格式

行为准则：
- 报告措辞实事求是，不夸大成就
- 反思部分需引导学生自己表达，你只做润色和结构化
- 每条成就需附带 evidence（学了什么、做了什么、结果如何）
- 带 provisional 标记的内容在报告中需标注"初步评估，待进一步验证"

## 通用行为准则

1. 始终使用友好、鼓励的语气。你面对的是正在探索职业方向的大学生。
2. 使用 12 维能力模型作为分析框架：专业技能、专业背景、学历要求、团队协作能力、抗压/适应能力、分析解决问题能力、沟通表达能力、工作经验、文档规范意识、责任心/工作态度、学习能力、补充信息。
3. 每次给出建议后，提供明确的下一步行动（不要只说"你可以试试"）。
4. 当学生表达困惑时，先理解他们的处境再给建议。
5. 不确定的信息明确标注"我不确定"而非猜测。
6. 涉及隐私或敏感话题时，提醒学生保护个人信息。

## 工具使用规范

- 调用工具前先向学生说明你要做什么
- 工具执行过程中保持透明（显示进度或思考过程）
- 工具返回错误时坦诚告知，并提供替代方案
- mutation_gated 工具（修改记忆/能力画像）的结果会由系统自动裁决，你只需提交提议""",
    "CareerCoach": """你是一位全面的AI职业规划教练，帮助大学生进行职业规划。

你的能力：
- 综合分析学生各方面情况，提供职业规划建议
- 根据对话内容判断学生需求，协调其他专业教练参与
- 涵盖简历优化、岗位匹配、学习路径、成长报告等全流程

## 通用行为准则

1. 始终使用友好、鼓励的语气。你面对的是正在探索职业方向的大学生。
2. 使用 12 维能力模型作为分析框架：专业技能、专业背景、学历要求、团队协作能力、抗压/适应能力、分析解决问题能力、沟通表达能力、工作经验、文档规范意识、责任心/工作态度、学习能力、补充信息。
3. 每次给出建议后，提供明确的下一步行动（不要只说"你可以试试"）。
4. 当学生表达困惑时，先理解他们的处境再给建议。
5. 不确定的信息明确标注"我不确定"而非猜测。
6. 涉及隐私或敏感话题时，提醒学生保护个人信息。

## 工具使用规范

- 调用工具前先向学生说明你要做什么
- 工具执行过程中保持透明（显示进度或思考过程）
- 工具返回错误时坦诚告知，并提供替代方案
- mutation_gated 工具（修改记忆/能力画像）的结果会由系统自动裁决，你只需提交提议""",
}


def _load_prompt_from_db(db: Session, agent: str) -> str | None:
    """Load the latest prompt version for an agent from prompt_versions table."""
    try:
        from sqlalchemy import text
        row = db.execute(
            text(
                "SELECT prompt_text FROM prompt_versions "
                "WHERE agent = :agent "
                "ORDER BY version DESC LIMIT 1"
            ),
            {"agent": agent},
        ).fetchone()
        if row:
            return row[0]
    except Exception:
        logger.debug("Failed to load prompt from prompt_versions", exc_info=True)
    return None


def _save_prompt_version(
    db: Session,
    agent: str,
    prompt_text: str,
    change_reason: str = "",
) -> str | None:
    """Save a new prompt version. Returns the new version id."""
    try:
        from uuid import uuid4
        from sqlalchemy import text

        current = db.execute(
            text(
                "SELECT MAX(version) FROM prompt_versions WHERE agent = :agent"
            ),
            {"agent": agent},
        ).scalar() or 0

        new_id = str(uuid4())
        db.execute(
            text(
                "INSERT INTO prompt_versions (id, agent, version, prompt_text, change_reason) "
                "VALUES (:id, :agent, :version, :prompt_text, :change_reason)"
            ),
            {
                "id": new_id,
                "agent": agent,
                "version": current + 1,
                "prompt_text": prompt_text,
                "change_reason": change_reason,
            },
        )
        db.commit()
        return new_id
    except Exception:
        logger.exception("Failed to save prompt version")
        return None


async def _format_collective_wisdom(
    db: Session,
    student_id: int,
    summary: ConversationSummaryV1_1 | None,
) -> str:
    """Build CollectiveWisdom text for injection into the system prompt.

    Returns aggregate stats based on student's major and target role.
    Never includes individual PII — only aggregate statistics.
    """
    if not summary:
        return ""

    from app.services.memory.collective_wisdom import (
        query_related_skills,
        query_skill_distribution,
    )

    parts: list[str] = []

    student_profile = summary.student_profile
    major = ""
    if isinstance(student_profile, dict):
        major_field = student_profile.get("major", {})
        if isinstance(major_field, dict):
            major = str(major_field.get("value", ""))
    if not major:
        return ""

    skills = query_related_skills(db, major)
    if skills:
        parts.append(f"\n## 群体参考：同专业({major})常见技能\n")
        for s in skills[:5]:
            parts.append(
                f"- {s['entity_name']}: {s['support_rate']:.0%} 同专业学生提及 "
                f"(样本量: {s['sample_size']})"
            )

    career_goal = summary.career_goal
    role = ""
    if isinstance(career_goal, dict):
        role_field = career_goal.get("role", {})
        if isinstance(role_field, dict):
            role = str(role_field.get("value", ""))

    if role:
        dist = query_skill_distribution(db, role)
        if dist:
            parts.append(f"\n## 群体参考：目标岗位({role})技能分布\n")
            for d in dist[:5]:
                parts.append(
                    f"- {d['skill_name']}: mastered {d['mastered_rate']:.0%} "
                    f"/ in_progress {d['in_progress_rate']:.0%} "
                    f"(样本量: {d['sample_size']})"
                )

    if parts:
        parts.append("\n> 以上数据来自匿名群体统计，仅供参考。")
    return "\n".join(parts)


async def build_system_prompt(
    db: Session,
    agent: str,
    *,
    student_id: int = 0,
    conversation_summary: str | None = None,
    conversation_summary_obj: ConversationSummaryV1_1 | None = None,
) -> str:
    """Build the system prompt for the given agent.

    Loads prompt from prompt_versions table if available, falls back to
    hardcoded AGENT_SYSTEM_PROMPTS. Injects conversation summary and
    collective wisdom context.
    """
    prompt = _load_prompt_from_db(db, agent)
    if not prompt:
        prompt = AGENT_SYSTEM_PROMPTS.get(agent, AGENT_SYSTEM_PROMPTS["CareerCoach"])

    if conversation_summary:
        prompt += (
            "\n\n--- 对话历史摘要 ---\n"
            "以下是该学生的历史对话摘要，请参考：\n"
            f"{conversation_summary}\n"
            "--- 摘要结束 ---\n"
        )

    if conversation_summary_obj and student_id > 0:
        try:
            cw_text = await _format_collective_wisdom(db, student_id, conversation_summary_obj)
            if cw_text:
                prompt += cw_text
        except Exception:
            logger.debug("Failed to build collective wisdom context", exc_info=True)

    prompt += (
        "\n\n--- 业务数据读取规则 ---\n"
        "当用户询问当前简历/能力画像、职业匹配、蜗牛学习路径或个人职业成长报告中的具体数据时，"
        "必须先调用对应 readonly 工具 read_profile、search_matches、read_plan 或 read_report，"
        "再基于工具结果回答。工具返回不可用、缺少 favorite_id/workspace_id 或缺少前置步骤时，"
        "明确说明缺少哪一步，不要编造业务数据。用户询问最适合职业、推荐岗位、职业方向或匹配结果时，"
        "必须以 search_matches 的真实职业匹配结果为依据；get_job_categories 只能用于明确询问岗位大类/类别列表，"
        "不能替代职业推荐依据。\n"
        "--- 规则结束 ---\n"
    )

    return prompt


def format_conversation_summary_with_overlays(
    summary_json: object,
) -> str:
    """Format conversation summary for LLM context, with [待确认] marking on provisional overlays.

    Accepts either a ConversationSummaryV1_1 instance or a JSON string.
    """
    if isinstance(summary_json, str):
        try:
            import json
            data = json.loads(summary_json)
        except (json.JSONDecodeError, TypeError):
            return str(summary_json)
    else:
        data = summary_json

    if not data:
        return ""

    lines: list[str] = []

    skills = data.get("skills", data.get("mastery_observations", []))
    if skills:
        lines.append("## 学生技能评估")
        if isinstance(skills, dict):
            for skill_id, skill in skills.items():
                if isinstance(skill, dict):
                    status = skill.get("mastery_status", "in_progress")
                    confidence = skill.get("confidence", 0.0)
                    lines.append(f"- {skill_id}: {status} (confidence: {confidence:.0%})")
        elif isinstance(skills, list):
            for skill in skills:
                if isinstance(skill, dict):
                    lines.append(f"- {skill.get('mastery_status', 'N/A')}")

    overlays = (
        data.get("provisional_overlays", {})
        if isinstance(data, dict)
        else {}
    )
    if overlays:
        lines.append("\n## 待确认信息")
        for key, overlay in overlays.items():
            if isinstance(overlay, dict):
                field_path = overlay.get("field_path", key)
                proposed = overlay.get("proposed_value", "")
                confidence = overlay.get("confidence", 0.0)
                source = overlay.get("source", "unknown")
                lines.append(
                    f"- {field_path}: {proposed} "
                    f"(confidence: {confidence:.0%}) "
                    f"[来源: {source}] [待确认]"
                )

    current_stage = (
        data.get("current_stage") or data.get("participant_state", "")
    )
    if current_stage:
        lines.append(f"\n## 当前阶段: {current_stage}")

    return "\n".join(lines)
