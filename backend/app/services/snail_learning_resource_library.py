from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.snail_learning_resource_library import SnailLearningResourceLibrary
from app.schemas.career_development_report import (
    CareerDevelopmentFavoritePayload,
    GrowthPlanLearningResourceItem,
    GrowthPlanPhase,
)
from app.schemas.student_competency_profile import JOB_PROFILE_FIELD_ORDER


SUPPORTED_JOB_TITLES = [
    "前端工程师",
    "实施工程师",
    "技术支持工程师",
    "测试工程师",
    "软件工程师",
]
SUPPORTED_PHASE_KEYS = ["short_term", "mid_term", "long_term"]
PHASE_REASON_SUFFIX = {
    "short_term": "适合当前阶段先补基础，帮你尽快建立可执行的入门框架。",
    "mid_term": "适合当前阶段把知识转成项目、协作或真实任务中的可用方法。",
    "long_term": "适合当前阶段持续深化，帮助你把这项能力沉淀成长期竞争力。",
}
DIMENSION_LABELS = {
    "professional_skills": "专业技能",
    "professional_background": "专业背景",
    "education_requirement": "教育要求",
    "teamwork": "团队协作",
    "stress_adaptability": "抗压适应",
    "communication": "沟通表达",
    "work_experience": "工作经验",
    "documentation_awareness": "文档规范意识",
    "responsibility": "责任心",
    "learning_ability": "学习能力",
    "problem_solving": "问题解决",
    "other_special": "其他专项能力",
}
DIMENSION_RESOURCE_TEMPLATES = {
    "professional_skills": [
        {
            "title": "MDN Learn",
            "url": "https://developer.mozilla.org/zh-CN/docs/Learn",
            "reason": "内容体系完整，适合系统补齐通用技术基础。",
        },
        {
            "title": "Microsoft Learn",
            "url": "https://learn.microsoft.com/zh-cn/training/",
            "reason": "模块化路径清晰，适合按主题逐步推进专业技能。",
        },
        {
            "title": "freeCodeCamp",
            "url": "https://www.freecodecamp.org/learn/",
            "reason": "练习驱动强，适合边学边做形成可见输出。",
        },
        {
            "title": "Coursera",
            "url": "https://www.coursera.org/",
            "reason": "课程体系完整，适合用结构化课程搭建知识框架。",
        },
        {
            "title": "edX",
            "url": "https://www.edx.org/learn",
            "reason": "高校课程资源丰富，适合打牢理论基础。",
        },
        {
            "title": "Codecademy",
            "url": "https://www.codecademy.com/catalog",
            "reason": "交互式学习体验好，适合快速建立动手感。",
        },
    ],
    "professional_background": [
        {
            "title": "CS50",
            "url": "https://cs50.harvard.edu/x/",
            "reason": "覆盖计算机基础核心概念，适合补专业底座。",
        },
        {
            "title": "OSSU Computer Science",
            "url": "https://github.com/ossu/computer-science",
            "reason": "开源课程路线清晰，适合系统补齐专业背景。",
        },
        {
            "title": "Teach Yourself CS",
            "url": "https://teachyourselfcs.com/",
            "reason": "聚焦长期有价值的基础能力，适合建立学科框架。",
        },
        {
            "title": "MIT OpenCourseWare",
            "url": "https://ocw.mit.edu/",
            "reason": "课程权威，适合补计算机相关核心理论。",
        },
        {
            "title": "学堂在线",
            "url": "https://www.xuetangx.com/",
            "reason": "中文高校课程资源丰富，适合快速补专业课认知。",
        },
        {
            "title": "中国大学MOOC",
            "url": "https://www.icourse163.org/",
            "reason": "国内课程覆盖广，适合用中文内容补专业基础。",
        },
    ],
    "education_requirement": [
        {
            "title": "国家高等教育智慧教育平台",
            "url": "https://www.smartedu.cn/higherEducation",
            "reason": "正规高校课程集中，适合对齐教育要求中的基础课程。",
        },
        {
            "title": "中国大学MOOC",
            "url": "https://www.icourse163.org/",
            "reason": "课程门类丰富，适合补齐学历背景对应的核心课程。",
        },
        {
            "title": "学堂在线",
            "url": "https://www.xuetangx.com/",
            "reason": "中文课程友好，适合快速补足理论短板。",
        },
        {
            "title": "Coursera",
            "url": "https://www.coursera.org/",
            "reason": "可按专业方向选择系统课程，适合搭建完整认知。",
        },
        {
            "title": "edX",
            "url": "https://www.edx.org/learn",
            "reason": "海外高校课程丰富，适合补权威学术背景内容。",
        },
        {
            "title": "MIT OpenCourseWare",
            "url": "https://ocw.mit.edu/",
            "reason": "适合补教育要求中常见的数学与计算机基础课程。",
        },
    ],
    "teamwork": [
        {
            "title": "Atlassian Team Playbook",
            "url": "https://www.atlassian.com/team-playbook",
            "reason": "协作方法模板清晰，适合快速建立团队协作习惯。",
        },
        {
            "title": "GitHub Skills",
            "url": "https://skills.github.com/",
            "reason": "适合通过协作式练习理解分支、评审和协同流程。",
        },
        {
            "title": "GitLab Docs",
            "url": "https://docs.gitlab.com/",
            "reason": "适合理解真实团队中的协作与交付流程。",
        },
        {
            "title": "Scrum Guides",
            "url": "https://scrumguides.org/",
            "reason": "有助于建立对敏捷协作和团队节奏的基本认知。",
        },
        {
            "title": "Miro Academy",
            "url": "https://miro.com/academy/",
            "reason": "适合学习远程协作、讨论和共创的实践方法。",
        },
        {
            "title": "Coursera Teamwork Courses",
            "url": "https://www.coursera.org/search?query=teamwork",
            "reason": "适合用系统课程补齐团队合作中的软技能短板。",
        },
    ],
    "stress_adaptability": [
        {
            "title": "Mind Tools",
            "url": "https://www.mindtools.com/",
            "reason": "提供可操作的时间管理与压力应对方法。",
        },
        {
            "title": "Coursera Resilience",
            "url": "https://www.coursera.org/search?query=resilience",
            "reason": "适合系统学习抗压与恢复能力相关方法。",
        },
        {
            "title": "edX Wellbeing",
            "url": "https://www.edx.org/learn/well-being",
            "reason": "适合建立长期稳定的学习与工作节奏。",
        },
        {
            "title": "WHO Mental Health",
            "url": "https://www.who.int/health-topics/mental-health",
            "reason": "内容权威，适合建立对压力管理的正确认知。",
        },
        {
            "title": "NHS Stress",
            "url": "https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/stress/",
            "reason": "给出具体自助策略，适合日常执行和复盘。",
        },
        {
            "title": "APA Stress Management",
            "url": "https://www.apa.org/topics/stress",
            "reason": "适合理解压力来源并建立更稳定的应对框架。",
        },
    ],
    "communication": [
        {
            "title": "Toastmasters",
            "url": "https://www.toastmasters.org/",
            "reason": "适合训练表达、结构化汇报和即兴沟通能力。",
        },
        {
            "title": "TED",
            "url": "https://www.ted.com/",
            "reason": "有助于观察优秀表达者如何组织观点与叙事。",
        },
        {
            "title": "Coursera Communication",
            "url": "https://www.coursera.org/search?query=communication",
            "reason": "适合系统补齐沟通表达与职场协作技能。",
        },
        {
            "title": "Harvard Business Review",
            "url": "https://hbr.org/topic/communication",
            "reason": "适合理解真实工作场景中的沟通问题与案例。",
        },
        {
            "title": "Mind Tools Communication",
            "url": "https://www.mindtools.com/pages/main/newMN_CDV.htm",
            "reason": "方法短平快，适合立即在学习和协作中应用。",
        },
        {
            "title": "Grammarly Blog",
            "url": "https://www.grammarly.com/blog/",
            "reason": "适合补齐书面表达、邮件与文案沟通习惯。",
        },
    ],
    "work_experience": [
        {
            "title": "GitHub",
            "url": "https://github.com/",
            "reason": "适合沉淀项目经历、代码证据和协作记录。",
        },
        {
            "title": "Kaggle",
            "url": "https://www.kaggle.com/learn",
            "reason": "适合通过真实题目或项目形成可展示实践经历。",
        },
        {
            "title": "Frontend Mentor",
            "url": "https://www.frontendmentor.io/",
            "reason": "适合通过接近业务场景的任务形成作品证据。",
        },
        {
            "title": "Exercism",
            "url": "https://exercism.org/",
            "reason": "适合持续练习并积累可复盘的实操记录。",
        },
        {
            "title": "Devpost",
            "url": "https://devpost.com/",
            "reason": "适合通过项目、挑战赛和作品页补齐实践经历。",
        },
        {
            "title": "Gitee",
            "url": "https://gitee.com/",
            "reason": "适合沉淀中文项目仓库与协作履历。",
        },
    ],
    "documentation_awareness": [
        {
            "title": "Google Technical Writing",
            "url": "https://developers.google.com/tech-writing",
            "reason": "适合系统建立技术写作与文档表达规范。",
        },
        {
            "title": "Write the Docs",
            "url": "https://www.writethedocs.org/",
            "reason": "社区资料丰富，适合理解文档工作的真实标准。",
        },
        {
            "title": "Diataxis",
            "url": "https://diataxis.fr/",
            "reason": "适合建立文档分类、结构和写作目标意识。",
        },
        {
            "title": "Microsoft Style Guide",
            "url": "https://learn.microsoft.com/style-guide/welcome/",
            "reason": "适合参考成熟团队的文档风格规范。",
        },
        {
            "title": "GitHub Docs",
            "url": "https://docs.github.com/",
            "reason": "适合理解优秀产品文档的信息组织方式。",
        },
        {
            "title": "Read the Docs",
            "url": "https://docs.readthedocs.io/",
            "reason": "适合补齐文档发布、维护和版本意识。",
        },
    ],
    "responsibility": [
        {
            "title": "PMI Project Management Basics",
            "url": "https://www.pmi.org/learning/library",
            "reason": "适合理解责任边界、交付意识和项目承诺。",
        },
        {
            "title": "Atlassian Work Life",
            "url": "https://www.atlassian.com/blog",
            "reason": "适合理解执行、推进和责任分工的真实工作实践。",
        },
        {
            "title": "Asana Academy",
            "url": "https://academy.asana.com/",
            "reason": "适合学习任务推进、跟进与结果负责的方法。",
        },
        {
            "title": "Mind Tools Time Management",
            "url": "https://www.mindtools.com/pages/main/newMN_HTE.htm",
            "reason": "适合补齐时间管理和执行承诺的基础能力。",
        },
        {
            "title": "Scrum Guides",
            "url": "https://scrumguides.org/",
            "reason": "有助于建立在团队中承担角色责任的意识。",
        },
        {
            "title": "Coursera Project Management",
            "url": "https://www.coursera.org/search?query=project%20management",
            "reason": "适合把责任感落到真实的计划、推进和交付动作上。",
        },
    ],
    "learning_ability": [
        {
            "title": "Learning How to Learn",
            "url": "https://www.coursera.org/learn/learning-how-to-learn",
            "reason": "适合系统建立高效学习方法和复盘节奏。",
        },
        {
            "title": "Khan Academy",
            "url": "https://www.khanacademy.org/",
            "reason": "适合补基础并建立循序渐进的学习体验。",
        },
        {
            "title": "MIT OpenCourseWare",
            "url": "https://ocw.mit.edu/",
            "reason": "适合训练自主规划和深度学习能力。",
        },
        {
            "title": "Coursera Learning",
            "url": "https://www.coursera.org/",
            "reason": "适合用结构化课程持续推进学习能力建设。",
        },
        {
            "title": "edX Learning",
            "url": "https://www.edx.org/learn",
            "reason": "适合拓展学术型学习资源与长期积累能力。",
        },
        {
            "title": "Anki",
            "url": "https://apps.ankiweb.net/",
            "reason": "适合把知识点转成可复习、可长期记忆的学习系统。",
        },
    ],
    "problem_solving": [
        {
            "title": "LeetCode",
            "url": "https://leetcode.cn/",
            "reason": "适合训练分析问题、拆解思路和验证解法的能力。",
        },
        {
            "title": "HackerRank",
            "url": "https://www.hackerrank.com/",
            "reason": "适合在题目场景中训练结构化解题思维。",
        },
        {
            "title": "Exercism",
            "url": "https://exercism.org/",
            "reason": "适合通过持续小练习建立问题定位和修正能力。",
        },
        {
            "title": "Project Euler",
            "url": "https://projecteuler.net/",
            "reason": "适合训练抽象建模与多步推理。",
        },
        {
            "title": "Kaggle",
            "url": "https://www.kaggle.com/",
            "reason": "适合在真实数据或案例中训练问题分析能力。",
        },
        {
            "title": "GeeksforGeeks",
            "url": "https://www.geeksforgeeks.org/",
            "reason": "适合查询常见问题思路并补齐知识盲点。",
        },
    ],
    "other_special": [
        {
            "title": "LinkedIn Learning",
            "url": "https://www.linkedin.com/learning/",
            "reason": "适合补齐岗位拓展能力和职业化专项技能。",
        },
        {
            "title": "Udemy",
            "url": "https://www.udemy.com/",
            "reason": "课程覆盖广，适合按专项短板快速补位。",
        },
        {
            "title": "Google Developers",
            "url": "https://developers.google.com/learn",
            "reason": "适合围绕专项主题快速建立实践认知。",
        },
        {
            "title": "AWS Skill Builder",
            "url": "https://explore.skillbuilder.aws/",
            "reason": "适合补云、工程化或平台类专项能力。",
        },
        {
            "title": "Bilibili 学习区",
            "url": "https://www.bilibili.com/",
            "reason": "适合快速了解专项主题并补充中文案例理解。",
        },
        {
            "title": "InfoQ",
            "url": "https://www.infoq.cn/",
            "reason": "适合跟进工程实践、架构和行业专项动态。",
        },
    ],
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", "", (value or "").strip()).casefold()


def build_seed_resource_rows() -> list[dict[str, str | int]]:
    rows: list[dict[str, str | int]] = []
    for canonical_job_title in SUPPORTED_JOB_TITLES:
        for dimension_key in JOB_PROFILE_FIELD_ORDER:
            label = DIMENSION_LABELS[dimension_key]
            templates = DIMENSION_RESOURCE_TEMPLATES[dimension_key]
            if len(templates) != 6:
                raise ValueError(f"Dimension {dimension_key} must define exactly 6 resource templates.")
            for phase_key in SUPPORTED_PHASE_KEYS:
                phase_suffix = PHASE_REASON_SUFFIX[phase_key]
                for rank, template in enumerate(templates, start=1):
                    rows.append(
                        {
                            "canonical_job_title": canonical_job_title,
                            "dimension_key": dimension_key,
                            "phase_key": phase_key,
                            "rank": rank,
                            "site_title": template["title"],
                            "site_url": template["url"],
                            "reason": (
                                f"{template['reason']} 这条资源围绕「{canonical_job_title}」的「{label}」能力设计，"
                                f"{phase_suffix}"
                            ),
                        }
                    )
    return rows


def rebuild_learning_resource_library(db: Session) -> int:
    rows = build_seed_resource_rows()
    now = _now()
    db.execute(delete(SnailLearningResourceLibrary))
    db.add_all(
        [
            SnailLearningResourceLibrary(
                canonical_job_title=str(row["canonical_job_title"]),
                dimension_key=str(row["dimension_key"]),
                phase_key=str(row["phase_key"]),
                rank=int(row["rank"]),
                site_title=str(row["site_title"]),
                site_url=str(row["site_url"]),
                reason=str(row["reason"]),
                created_at=now,
                updated_at=now,
            )
            for row in rows
        ]
    )
    db.commit()
    return len(rows)


def ensure_learning_resource_library_seeded(db: Session) -> int:
    existing = db.scalar(select(SnailLearningResourceLibrary.id).limit(1))
    if existing is not None:
        return 0
    return rebuild_learning_resource_library(db)


def get_learning_resources(
    db: Session,
    *,
    canonical_job_title: str,
    dimension_key: str,
    phase_key: str,
) -> list[SnailLearningResourceLibrary]:
    return db.scalars(
        select(SnailLearningResourceLibrary)
        .where(
            SnailLearningResourceLibrary.canonical_job_title == canonical_job_title,
            SnailLearningResourceLibrary.dimension_key == dimension_key,
            SnailLearningResourceLibrary.phase_key == phase_key,
        )
        .order_by(SnailLearningResourceLibrary.rank.asc(), SnailLearningResourceLibrary.id.asc())
    ).all()


def resolve_module_dimension_key(
    favorite: CareerDevelopmentFavoritePayload,
    *,
    module_topic: str,
) -> str | None:
    normalized_topic = _normalize_text(module_topic)
    if not normalized_topic:
        return None

    rows = list(favorite.report_snapshot.comparison_dimensions or [])
    title_map = {_normalize_text(item.title): item.key for item in rows if item.title}
    key_map = {_normalize_text(item.key): item.key for item in rows if item.key}

    if normalized_topic in title_map and title_map[normalized_topic] in JOB_PROFILE_FIELD_ORDER:
        return title_map[normalized_topic]
    if normalized_topic in key_map and key_map[normalized_topic] in JOB_PROFILE_FIELD_ORDER:
        return key_map[normalized_topic]

    priority_keys = [key for key in favorite.report_snapshot.priority_gap_dimensions or [] if key in key_map.values()]
    priority_title_map = {
        _normalize_text(item.title): item.key
        for item in rows
        if item.key in priority_keys and item.title
    }
    if normalized_topic in priority_title_map and priority_title_map[normalized_topic] in JOB_PROFILE_FIELD_ORDER:
        return priority_title_map[normalized_topic]
    return None


def attach_prebuilt_learning_resources(
    db: Session,
    *,
    favorite: CareerDevelopmentFavoritePayload,
    phases: list[GrowthPlanPhase],
) -> list[GrowthPlanPhase]:
    updated_phases = [phase.model_copy(deep=True) for phase in phases]
    for phase in updated_phases:
        for module in phase.learning_modules:
            dimension_key = resolve_module_dimension_key(favorite, module_topic=module.topic)
            if not dimension_key:
                module.resource_recommendations = []
                module.resource_status = "failed"
                module.resource_error_message = f"未找到模块「{module.topic}」对应的标准维度。"
                continue

            resources = get_learning_resources(
                db,
                canonical_job_title=favorite.canonical_job_title,
                dimension_key=dimension_key,
                phase_key=phase.phase_key,
            )
            if len(resources) != 6:
                module.resource_recommendations = []
                module.resource_status = "failed"
                module.resource_error_message = (
                    f"资源库中「{favorite.canonical_job_title} / {dimension_key} / {phase.phase_key}」"
                    f"的资源数量为 {len(resources)}，期望为 6。"
                )
                continue

            module.resource_recommendations = [
                GrowthPlanLearningResourceItem(
                    title=item.site_title,
                    url=item.site_url,
                    reason=item.reason,
                )
                for item in resources
            ]
            module.resource_status = "ready"
            module.resource_error_message = ""

    return updated_phases
