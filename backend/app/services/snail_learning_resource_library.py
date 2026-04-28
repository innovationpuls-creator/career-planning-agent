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
    "Java",
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
    "professional_skills": {
        "short_term": [
            {"title": "MDN Learn", "url": "https://developer.mozilla.org/zh-CN/docs/Learn", "reason": "内容体系完整，适合系统补齐通用技术基础。"},
            {"title": "Microsoft Learn", "url": "https://learn.microsoft.com/zh-cn/training/", "reason": "模块化路径清晰，适合按主题逐步推进专业技能。"},
            {"title": "freeCodeCamp", "url": "https://www.freecodecamp.org/learn/", "reason": "练习驱动强，适合边学边做形成可见输出。"},
            {"title": "Coursera", "url": "https://www.coursera.org/", "reason": "课程体系完整，适合用结构化课程搭建知识框架。"},
            {"title": "edX", "url": "https://www.edx.org/learn", "reason": "高校课程资源丰富，适合打牢理论基础。"},
            {"title": "Codecademy", "url": "https://www.codecademy.com/catalog", "reason": "交互式学习体验好，适合快速建立动手感。"},
        ],
        "mid_term": [
            {"title": "GitHub Trending", "url": "https://github.com/trending", "reason": "跟踪热门开源项目，适合通过阅读源码和参与协作提升实战技能。"},
            {"title": "LeetCode 中等题库", "url": "https://leetcode.cn/problemset/all/?difficulty=MEDIUM", "reason": "中等难度题目训练，适合将基础知识转化为解题和编码能力。"},
            {"title": "Stack Overflow", "url": "https://stackoverflow.com/", "reason": "真实开发问题汇集，适合培养排查问题和阅读他人代码的能力。"},
            {"title": "Exercism", "url": "https://exercism.org/", "reason": "持续练习与 mentor 反馈结合，适合把知识内化成可复用的编码习惯。"},
            {"title": "Frontend Mentor", "url": "https://www.frontendmentor.io/", "reason": "接近业务场景的前端任务，适合通过真实项目需求提升动手能力。"},
            {"title": "Devpost", "url": "https://devpost.com/", "reason": "黑客松项目展示平台，适合通过项目实战积累可展示的作品。"},
        ],
        "long_term": [
            {"title": "System Design Primer", "url": "https://github.com/donnemartin/system-design-primer", "reason": "系统设计知识体系完整，适合进阶理解大型软件架构设计。"},
            {"title": "The Architecture of Open Source Applications", "url": "https://aosabook.org/", "reason": "深入解析知名开源软件架构，适合学习优秀工程决策与设计模式。"},
            {"title": "Designing Data-Intensive Applications", "url": "https://dataintensive.net/", "reason": "数据系统经典著作，适合深入理解分布式系统核心原理。"},
            {"title": "Papers We Love", "url": "https://paperswelove.org/", "reason": "计算机经典论文社区，适合通过原理论文深化对技术本质的理解。"},
            {"title": "Pluralsight", "url": "https://www.pluralsight.com/", "reason": "进阶技术课程平台，覆盖架构、性能优化等高级专题。"},
            {"title": "Awesome Lists", "url": "https://github.com/sindresorhus/awesome", "reason": "精选技术资源汇总，适合持续发现和跟踪前沿技术方向。"},
        ],
    },
    "professional_background": {
        "short_term": [
            {"title": "CS50", "url": "https://cs50.harvard.edu/x/", "reason": "覆盖计算机基础核心概念，适合补专业底座。"},
            {"title": "OSSU Computer Science", "url": "https://github.com/ossu/computer-science", "reason": "开源课程路线清晰，适合系统补齐专业背景。"},
            {"title": "Teach Yourself CS", "url": "https://teachyourselfcs.com/", "reason": "聚焦长期有价值的基础能力，适合建立学科框架。"},
            {"title": "MIT OpenCourseWare", "url": "https://ocw.mit.edu/", "reason": "课程权威，适合补计算机相关核心理论。"},
            {"title": "学堂在线", "url": "https://www.xuetangx.com/", "reason": "中文高校课程资源丰富，适合快速补专业课认知。"},
            {"title": "中国大学MOOC", "url": "https://www.icourse163.org/", "reason": "国内课程覆盖广，适合用中文内容补专业基础。"},
        ],
        "mid_term": [
            {"title": "Coursera 专项课程", "url": "https://www.coursera.org/specializations", "reason": "按领域组织的系列课程，适合系统深化特定专业方向。"},
            {"title": "Udacity Nanodegree", "url": "https://www.udacity.com/", "reason": "项目驱动的纳米学位，适合通过实战项目补强专业经历。"},
            {"title": "掘金小册", "url": "https://juejin.cn/books", "reason": "中文技术深度文章集合，适合结合实践理解专业知识。"},
            {"title": "Bilibili 编程教程", "url": "https://www.bilibili.com/", "reason": "大量中文编程实战视频，适合通过案例学习巩固专业认知。"},
            {"title": "Linux 基础教程", "url": "https://www.linuxjourney.com/", "reason": "交互式 Linux 学习，适合补齐操作系统与命令行基础实践。"},
            {"title": "SQLZoo", "url": "https://sqlzoo.net/", "reason": "在线 SQL 练习平台，适合通过实操补齐数据库专业知识。"},
        ],
        "long_term": [
            {"title": "Computer Systems: A Programmer's Perspective", "url": "https://csapp.cs.cmu.edu/", "reason": "深入了解计算机系统经典教材，适合从程序员视角深挖底层。"},
            {"title": "Structure and Interpretation of Computer Programs", "url": "https://mitpress.mit.edu/sicp/", "reason": "编程思想奠基之作，适合建立对计算本质的深刻理解。"},
            {"title": "The Art of Computer Programming", "url": "https://www-cs-faculty.stanford.edu/~knuth/taocp/", "reason": "算法与程序设计圣经，适合追求极致的专业素养。"},
            {"title": "Coursera 数学专项", "url": "https://www.coursera.org/browse/mathematics", "reason": "进阶数学课程，适合深度学习、图形学等前沿领域需要的高等数学基础。"},
            {"title": "ArXiv", "url": "https://arxiv.org/", "reason": "学术预印本平台，适合跟踪计算机科学前沿研究成果。"},
            {"title": "Google Scholar", "url": "https://scholar.google.com/", "reason": "学术文献搜索引擎，适合检索和跟踪专业领域的顶级论文。"},
        ],
    },
    "education_requirement": {
        "short_term": [
            {"title": "国家高等教育智慧教育平台", "url": "https://www.smartedu.cn/higherEducation", "reason": "正规高校课程集中，适合对齐教育要求中的基础课程。"},
            {"title": "中国大学MOOC", "url": "https://www.icourse163.org/", "reason": "课程门类丰富，适合补齐学历背景对应的核心课程。"},
            {"title": "学堂在线", "url": "https://www.xuetangx.com/", "reason": "中文课程友好，适合快速补足理论短板。"},
            {"title": "Coursera", "url": "https://www.coursera.org/", "reason": "可按专业方向选择系统课程，适合搭建完整认知。"},
            {"title": "edX", "url": "https://www.edx.org/learn", "reason": "海外高校课程丰富，适合补权威学术背景内容。"},
            {"title": "MIT OpenCourseWare", "url": "https://ocw.mit.edu/", "reason": "适合补教育要求中常见的数学与计算机基础课程。"},
        ],
        "mid_term": [
            {"title": "高等数学（同济版）习题精讲", "url": "https://www.bilibili.com/video/BV1Eb411u7Fw", "reason": "高数经典教材配套讲解，适合巩固教育要求中的数学基础。"},
            {"title": "浙江大学 数据结构", "url": "https://www.icourse163.org/course/ZJU-93001", "reason": "国内顶级数据结构课程，适合系统补足计算机专业核心课。"},
            {"title": "Stanford Online", "url": "https://online.stanford.edu/", "reason": "斯坦福在线课程，适合用海外名校标准补齐教育背景差距。"},
            {"title": "Harvard Extension School", "url": "https://extension.harvard.edu/", "reason": "哈佛大学延伸教育学院，适合获取受认可的高等教育学分课程。"},
            {"title": "可汗学院 计算机编程", "url": "https://www.khanacademy.org/computing", "reason": "循序渐进的编程与算法课程，适合补足计算机基础教育短板。"},
            {"title": "Crash Course Computer Science", "url": "https://www.youtube.com/playlist?list=PL8dPuuaLjXtNlUrzyH5r6jN9ulIgZBpdo", "reason": "计算机科学速成课，适合快速建立系统化的学科认知框架。"},
        ],
        "long_term": [
            {"title": "Coursera 深度学习专项", "url": "https://www.coursera.org/specializations/deep-learning", "reason": "AI 领域权威课程序列，适合研究生层次的教育深化。"},
            {"title": "edX 计算机科学硕士课程", "url": "https://www.edx.org/masters/computer-science", "reason": "在线硕士级别课程，适合对标更高学历要求的专业训练。"},
            {"title": "公开课：编译原理", "url": "https://www.bilibili.com/video/BV1pW411a7Ez", "reason": "编译原理经典课程，适合深入理解计算机语言底层实现。"},
            {"title": "公开课：操作系统", "url": "https://www.bilibili.com/video/BV1dW411u7bB", "reason": "操作系统经典课程，适合补齐核心计算机系统教育内容。"},
            {"title": "NPTEL 计算机课程", "url": "https://nptel.ac.in/", "reason": "印度理工学院的免费高质量课程，适合拓展教育覆盖面和深度。"},
            {"title": "Open Yale Courses", "url": "https://oyc.yale.edu/", "reason": "耶鲁大学公开课程，适合用顶尖教育资源补齐学术理论深度。"},
        ],
    },
    "teamwork": {
        "short_term": [
            {"title": "Atlassian Team Playbook", "url": "https://www.atlassian.com/team-playbook", "reason": "协作方法模板清晰，适合快速建立团队协作习惯。"},
            {"title": "GitHub Skills", "url": "https://skills.github.com/", "reason": "适合通过协作式练习理解分支、评审和协同流程。"},
            {"title": "GitLab Docs", "url": "https://docs.gitlab.com/", "reason": "适合理解真实团队中的协作与交付流程。"},
            {"title": "Scrum Guides", "url": "https://scrumguides.org/", "reason": "有助于建立对敏捷协作和团队节奏的基本认知。"},
            {"title": "Miro Academy", "url": "https://miro.com/academy/", "reason": "适合学习远程协作、讨论和共创的实践方法。"},
            {"title": "Coursera Teamwork Courses", "url": "https://www.coursera.org/search?query=teamwork", "reason": "适合用系统课程补齐团队合作中的软技能短板。"},
        ],
        "mid_term": [
            {"title": "Git 协作工作流", "url": "https://www.atlassian.com/git/tutorials/comparing-workflows", "reason": "深入理解 Git 协作模式，适合在实际项目中规范团队协作流程。"},
            {"title": "Code Review 最佳实践", "url": "https://google.github.io/eng-practices/review/", "reason": "Google 的代码审查规范，适合建立高效的团队评审文化。"},
            {"title": "如何参与开源项目", "url": "https://opensource.guide/how-to-contribute/", "reason": "开源贡献指南，适合通过真实开源项目锻炼跨团队协作。"},
            {"title": "Confluence 协作指南", "url": "https://www.atlassian.com/software/confluence/guides", "reason": "团队知识库实践指南，适合建立文档共享和团队协作规范。"},
            {"title": "Slack 工作方法", "url": "https://slack.com/intl/zh-cn/help", "reason": "即时协作工具最佳实践，适合提升远程沟通与团队协调效率。"},
            {"title": "Notion 团队模板", "url": "https://www.notion.so/templates/team", "reason": "项目管理与协作模板库，适合建立团队任务跟踪和信息同步机制。"},
        ],
        "long_term": [
            {"title": "The Five Dysfunctions of a Team", "url": "https://www.tablegroup.com/books/dysfunctions/", "reason": "团队协作经典管理书籍，适合深入理解团队问题与改进方法。"},
            {"title": "Crucial Conversations", "url": "https://www.crucialconversations.com/", "reason": "高难度沟通方法论，适合处理团队冲突和关键对话场景。"},
            {"title": "Manager Tools Podcast", "url": "https://www.manager-tools.com/", "reason": "团队管理实战播客，适合提升带领团队和管理协作的能力。"},
            {"title": "文化地图", "url": "https://erinmeyer.com/books/the-culture-map/", "reason": "跨文化协作经典，适合理解多元团队中的协作差异与融合。"},
            {"title": "Team Topologies", "url": "https://teamtopologies.com/", "reason": "团队拓扑学组织方法，适合设计高效的技术团队结构和协作边界。"},
            {"title": "Google re:Work", "url": "https://rework.withgoogle.com/", "reason": "Google 团队效能研究，适合用数据驱动的方法优化团队协作。"},
        ],
    },
    "stress_adaptability": {
        "short_term": [
            {"title": "Mind Tools", "url": "https://www.mindtools.com/", "reason": "提供可操作的时间管理与压力应对方法。"},
            {"title": "Coursera Resilience", "url": "https://www.coursera.org/search?query=resilience", "reason": "适合系统学习抗压与恢复能力相关方法。"},
            {"title": "edX Wellbeing", "url": "https://www.edx.org/learn/well-being", "reason": "适合建立长期稳定的学习与工作节奏。"},
            {"title": "WHO Mental Health", "url": "https://www.who.int/health-topics/mental-health", "reason": "内容权威，适合建立对压力管理的正确认知。"},
            {"title": "NHS Stress", "url": "https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/stress/", "reason": "给出具体自助策略，适合日常执行和复盘。"},
            {"title": "APA Stress Management", "url": "https://www.apa.org/topics/stress", "reason": "适合理解压力来源并建立更稳定的应对框架。"},
        ],
        "mid_term": [
            {"title": "正念冥想入门", "url": "https://www.headspace.com/", "reason": "科学冥想练习平台，适合通过正念训练提升工作专注力和情绪调节能力。"},
            {"title": "番茄工作法", "url": "https://todoist.com/productivity/methods/pomodoro-technique", "reason": "时间分块管理法，适合在高强度工作中保持稳定产出节奏。"},
            {"title": "睡眠改善指南", "url": "https://www.sleepfoundation.org/", "reason": "睡眠科学指南，适合通过改善睡眠质量增强抗压恢复能力。"},
            {"title": "Coursera 工作与生活平衡", "url": "https://www.coursera.org/learn/work-life-balance", "reason": "聚焦工作与生活平衡的实用课程，适合在高强度工作中保持可持续状态。"},
            {"title": "Getting Things Done 方法论", "url": "https://todoist.com/productivity/methods/getting-things-done", "reason": "GTD 任务管理系统，适合建立高效的任务清零和执行习惯。"},
            {"title": "TED 压力管理演讲", "url": "https://www.ted.com/topics/stress", "reason": "TED 演讲汇集，适合从不同视角理解压力并找到适合自己的应对策略。"},
        ],
        "long_term": [
            {"title": "哈佛幸福课", "url": "https://www.edx.org/course/the-science-of-well-being", "reason": "耶鲁大学幸福科学课程，适合从心理学角度建立长期心理韧性。"},
            {"title": "原子习惯", "url": "https://jamesclear.com/atomic-habits", "reason": "习惯养成经典方法论，适合通过微习惯建立长期稳定的工作和学习模式。"},
            {"title": "心流：最优体验心理学", "url": "https://book.douban.com/subject/1055719/", "reason": "心流理论奠基之作，适合理解如何在高压工作中达到最佳表现状态。"},
            {"title": "Leading Under Pressure", "url": "https://hbr.org/2010/01/leading-under-pressure", "reason": "哈佛商业评论压力领导力专题，适合在管理岗位上应对持续压力。"},
            {"title": "韧性：不确定时代的精进法则", "url": "https://book.douban.com/subject/35288713/", "reason": "系统阐述心理韧性的培养方法，适合建立长期稳定的逆境应对框架。"},
            {"title": "Inside the Mind of a Master Procrastinator", "url": "https://www.ted.com/talks/tim_urban_inside_the_mind_of_a_master_procrastinator", "reason": "拖延症心理深度剖析，适合从认知层面理解并克服拖延行为。"},
        ],
    },
    "communication": {
        "short_term": [
            {"title": "Toastmasters", "url": "https://www.toastmasters.org/", "reason": "适合训练表达、结构化汇报和即兴沟通能力。"},
            {"title": "TED", "url": "https://www.ted.com/", "reason": "有助于观察优秀表达者如何组织观点与叙事。"},
            {"title": "Coursera Communication", "url": "https://www.coursera.org/search?query=communication", "reason": "适合系统补齐沟通表达与职场协作技能。"},
            {"title": "Harvard Business Review", "url": "https://hbr.org/topic/communication", "reason": "适合理解真实工作场景中的沟通问题与案例。"},
            {"title": "Mind Tools Communication", "url": "https://www.mindtools.com/pages/main/newMN_CDV.htm", "reason": "方法短平快，适合立即在学习和协作中应用。"},
            {"title": "Grammarly Blog", "url": "https://www.grammarly.com/blog/", "reason": "适合补齐书面表达、邮件与文案沟通习惯。"},
        ],
        "mid_term": [
            {"title": "技术博客写作指南", "url": "https://www.freecodecamp.org/news/how-to-write-a-technical-blog/", "reason": "技术写作方法论，适合通过写博客系统训练技术表达能力。"},
            {"title": "API 文档最佳实践", "url": "https://idratherbewriting.com/learnapidoc/", "reason": "API 文档写作专业指南，适合在工作中输出高质量的技术文档。"},
            {"title": "演讲与演示技巧", "url": "https://www.coursera.org/learn/speaking-and-presenting", "reason": "专业演讲课程，适合在周会评审等场景中进行有效的技术汇报。"},
            {"title": "非暴力沟通", "url": "https://www.cnvc.org/", "reason": "高效沟通方法论，适合在团队协作中减少误解和冲突。"},
            {"title": "金字塔原理", "url": "https://book.douban.com/subject/1020644/", "reason": "结构化思考和表达经典，适合训练逻辑清晰的汇报和文档写作。"},
            {"title": "知乎 职场沟通", "url": "https://www.zhihu.com/topic/19552241", "reason": "真实的职场沟通经验分享，适合从实际案例中学习沟通技巧。"},
        ],
        "long_term": [
            {"title": "谈判力", "url": "https://book.douban.com/subject/25885703/", "reason": "经典谈判书籍，适合在跨部门协调和资源争取中提升谈判能力。"},
            {"title": "跨文化沟通", "url": "https://www.coursera.org/learn/cross-cultural-communication", "reason": "国际化团队沟通课程，适合在多文化环境中高效协作。"},
            {"title": "影响力", "url": "https://book.douban.com/subject/26930585/", "reason": "社会心理学经典，适合理解说服力原理并在工作中有效应用。"},
            {"title": "HBR 沟通专题", "url": "https://hbr.org/topic/communications", "reason": "哈佛商业评论沟通深度文章，适合用管理视角提升沟通策略。"},
            {"title": "讲故事的力量", "url": "https://www.ted.com/talks/nancy_duarte_the_secret_structure_of_great_talks", "reason": "TED 演讲结构解析，适合学习如何用故事框架进行有力表达。"},
            {"title": "媒商", "url": "https://book.douban.com/subject/27049912/", "reason": "媒体素养与公共表达指南，适合在公开场合和专业场景中有力发声。"},
        ],
    },
    "work_experience": {
        "short_term": [
            {"title": "GitHub", "url": "https://github.com/", "reason": "适合沉淀项目经历、代码证据和协作记录。"},
            {"title": "Kaggle", "url": "https://www.kaggle.com/learn", "reason": "适合通过真实题目或项目形成可展示实践经历。"},
            {"title": "Frontend Mentor", "url": "https://www.frontendmentor.io/", "reason": "适合通过接近业务场景的任务形成作品证据。"},
            {"title": "Exercism", "url": "https://exercism.org/", "reason": "适合持续练习并积累可复盘的实操记录。"},
            {"title": "Devpost", "url": "https://devpost.com/", "reason": "适合通过项目、挑战赛和作品页补齐实践经历。"},
            {"title": "Gitee", "url": "https://gitee.com/", "reason": "适合沉淀中文项目仓库与协作履历。"},
        ],
        "mid_term": [
            {"title": "实习僧", "url": "https://www.shixiseng.com/", "reason": "实习招聘平台，适合寻找真实工作机会来积累岗位经验。"},
            {"title": "牛客网 项目实战", "url": "https://www.nowcoder.com/", "reason": "提供了大量项目案例和笔面试经验，适合通过模拟项目补齐经历。"},
            {"title": "Upwork", "url": "https://www.upwork.com/", "reason": "全球自由职业平台，适合通过接真实项目积累可量化的工作经验。"},
            {"title": "个人作品集搭建指南", "url": "https://www.freecodecamp.org/news/how-to-build-a-portfolio-website/", "reason": "作品集搭建教程，适合系统整理和展示个人项目经历。"},
            {"title": "Open Source Contribution Guide", "url": "https://github.com/firstcontributions/first-contributions", "reason": "初次开源贡献指南，适合通过参与开源项目丰富实操履历。"},
            {"title": "菜鸟教程 项目大全", "url": "https://www.runoob.com/w3cnote_project/", "reason": "中文项目案例集合，适合快速找到适合自己水平的练手项目。"},
        ],
        "long_term": [
            {"title": "LinkedIn 个人品牌", "url": "https://www.linkedin.com/learning/", "reason": "职业社交平台和品牌建设课程，适合用专业履历吸引长期机会。"},
            {"title": "Stack Overflow Careers", "url": "https://stackoverflow.com/jobs", "reason": "技术招聘平台，适合通过社区声誉和贡献记录获取高阶工作机会。"},
            {"title": "CTO 成长之路", "url": "https://github.com/kon9chunkit/GitHub-Chinese-Top-Charts", "reason": "技术管理进阶资源，适合从独立贡献者向技术领导角色成长。"},
            {"title": "The Staff Engineer Path", "url": "https://staffeng.com/", "reason": "资深工程师成长指南，适合理解高阶技术角色的责任与影响力。"},
            {"title": "Levels.fyi", "url": "https://www.levels.fyi/", "reason": "技术职级对标平台，适合了解不同阶段工作经验的行业标准。"},
            {"title": "TechLead 技术管理博客", "url": "https://www.techlead.com/", "reason": "技术领导力实务参考，适合在管理岗位上持续积累领导经验。"},
        ],
    },
    "documentation_awareness": {
        "short_term": [
            {"title": "Google Technical Writing", "url": "https://developers.google.com/tech-writing", "reason": "适合系统建立技术写作与文档表达规范。"},
            {"title": "Write the Docs", "url": "https://www.writethedocs.org/", "reason": "社区资料丰富，适合理解文档工作的真实标准。"},
            {"title": "Diataxis", "url": "https://diataxis.fr/", "reason": "适合建立文档分类、结构和写作目标意识。"},
            {"title": "Microsoft Style Guide", "url": "https://learn.microsoft.com/style-guide/welcome/", "reason": "适合参考成熟团队的文档风格规范。"},
            {"title": "GitHub Docs", "url": "https://docs.github.com/", "reason": "适合理解优秀产品文档的信息组织方式。"},
            {"title": "Read the Docs", "url": "https://docs.readthedocs.io/", "reason": "适合补齐文档发布、维护和版本意识。"},
        ],
        "mid_term": [
            {"title": "Swagger/OpenAPI 规范", "url": "https://swagger.io/docs/", "reason": "API 文档国际标准，适合在工作中编写规范可维护的接口文档。"},
            {"title": "JSDoc / TypeDoc 实践", "url": "https://typedoc.org/", "reason": "代码文档生成工具，适合给项目代码添加规范的注释和文档。"},
            {"title": "Sphinx 文档框架", "url": "https://www.sphinx-doc.org/", "reason": "Python 项目文档生成框架，适合为技术项目构建结构化文档体系。"},
            {"title": "中文技术文档规范", "url": "https://github.com/ruanyf/document-style-guide", "reason": "中文技术写作风格指南，适合书写高质量的中文项目文档。"},
            {"title": "Markdown 高级用法", "url": "https://www.markdownguide.org/", "reason": "Markdown 完整指南，适合掌握文档格式化的各种实用技巧。"},
            {"title": "技术演讲 PPT 设计指南", "url": "https://speaking.io/", "reason": "技术演讲与幻灯片设计指南，适合制作清晰有力的技术分享材料。"},
        ],
        "long_term": [
            {"title": "信息架构", "url": "https://book.douban.com/subject/26396670/", "reason": "信息架构经典著作，适合从顶层设计文档体系和信息组织方式。"},
            {"title": "技术传播", "url": "https://www.techwhirl.com/", "reason": "技术传播行业资源，适合深入理解文档在产品生态中的战略价值。"},
            {"title": "DITA 标准", "url": "https://www.oxygenxml.com/dita/", "reason": "Darwin 信息类型架构标准，适合企业级文档体系的结构化设计。"},
            {"title": "API 文档策略", "url": "https://idratherbewriting.com/learnapidoc/docapis.html", "reason": "API 文档策略深度指南，适合从产品层面规划文档体系。"},
            {"title": "Doctave", "url": "https://doctave.com/", "reason": "现代文档平台实践，适合构建可搜索、可维护的团队知识库。"},
            {"title": "文档驱动开发", "url": "https://www.documentation-driven-development.com/", "reason": "文档驱动开发方法论，适合将文档写作融入日常研发流程。"},
        ],
    },
    "responsibility": {
        "short_term": [
            {"title": "PMI Project Management Basics", "url": "https://www.pmi.org/learning/library", "reason": "适合理解责任边界、交付意识和项目承诺。"},
            {"title": "Atlassian Work Life", "url": "https://www.atlassian.com/blog", "reason": "适合理解执行、推进和责任分工的真实工作实践。"},
            {"title": "Asana Academy", "url": "https://academy.asana.com/", "reason": "适合学习任务推进、跟进与结果负责的方法。"},
            {"title": "Mind Tools Time Management", "url": "https://www.mindtools.com/pages/main/newMN_HTE.htm", "reason": "适合补齐时间管理和执行承诺的基础能力。"},
            {"title": "Scrum Guides", "url": "https://scrumguides.org/", "reason": "有助于建立在团队中承担角色责任的意识。"},
            {"title": "Coursera Project Management", "url": "https://www.coursera.org/search?query=project%20management", "reason": "适合把责任感落到真实的计划、推进和交付动作上。"},
        ],
        "mid_term": [
            {"title": "Trello 看板管理", "url": "https://trello.com/guide", "reason": "看板任务管理工具指南，适合通过可视化方式跟进任务进度和交付。"},
            {"title": "OKR 目标管理", "url": "https://www.whatmatters.com/", "reason": "OKR 方法论官方资源，适合建立目标导向的责任意识和工作方法。"},
            {"title": "Jira 敏捷项目管理", "url": "https://www.atlassian.com/software/jira/guides", "reason": "Jira 使用指南，适合在真实团队中跟进任务和追踪交付进度。"},
            {"title": "复盘方法论", "url": "https://www.atlassian.com/team-playbook/plays/retrospective", "reason": "团队复盘实践指南，适合通过定期回顾提升团队交付责任感。"},
            {"title": "PDCA 循环", "url": "https://asq.org/quality-resources/pdca-cycle", "reason": "计划-执行-检查-改进循环，适合建立持续负责任的工作习惯。"},
            {"title": "职场进阶：执行力提升", "url": "https://www.zhihu.com/column/c_1302890728049328128", "reason": "中文职场执行力经验分享，适合在实际工作中培养靠谱的职业态度。"},
        ],
        "long_term": [
            {"title": "授权与信任", "url": "https://hbr.org/2000/02/the-ways-chief-executives-lead", "reason": "哈佛商业评论领导力文章，适合理解在管理岗位上如何平衡授权与责任。"},
            {"title": "极端 Ownership", "url": "https://book.douban.com/subject/27073632/", "reason": "海豹突击队领导力原则，适合建立极致的个人与团队责任文化。"},
            {"title": "Drive: 驱动力", "url": "https://book.douban.com/subject/4846828/", "reason": "内在驱动力经典研究，适合理解责任心和主动性的心理机制。"},
            {"title": "工程管理: 从项目到团队", "url": "https://www.oreilly.com/library/view/engineering-management/9781492061191/", "reason": "工程管理实战指南，适合在技术管理岗位上建立负责任的团队文化。"},
            {"title": "责任病毒", "url": "https://book.douban.com/subject/30405983/", "reason": "组织心理学经典，适合理解责任分配失败的原因并建立健康的责任机制。"},
            {"title": "高效能人士的七个习惯", "url": "https://book.douban.com/subject/1048007/", "reason": "个人效能经典，适合从主动积极开始培养全面的责任感和职业素养。"},
        ],
    },
    "learning_ability": {
        "short_term": [
            {"title": "Learning How to Learn", "url": "https://www.coursera.org/learn/learning-how-to-learn", "reason": "适合系统建立高效学习方法和复盘节奏。"},
            {"title": "Khan Academy", "url": "https://www.khanacademy.org/", "reason": "适合补基础并建立循序渐进的学习体验。"},
            {"title": "MIT OpenCourseWare", "url": "https://ocw.mit.edu/", "reason": "适合训练自主规划和深度学习能力。"},
            {"title": "Coursera Learning", "url": "https://www.coursera.org/", "reason": "适合用结构化课程持续推进学习能力建设。"},
            {"title": "edX Learning", "url": "https://www.edx.org/learn", "reason": "适合拓展学术型学习资源与长期积累能力。"},
            {"title": "Anki", "url": "https://apps.ankiweb.net/", "reason": "适合把知识点转成可复习、可长期记忆的学习系统。"},
        ],
        "mid_term": [
            {"title": "费曼学习法实践", "url": "https://fs.blog/feynman-technique/", "reason": "费曼技巧系统指南，适合通过教学输出和简化概念来加深理解。"},
            {"title": "刻意练习", "url": "https://book.douban.com/subject/26895997/", "reason": "刻意练习方法论，适合建立有目标、有反馈的技能训练体系。"},
            {"title": "学 Silver Bullet", "url": "https://www.scotthyoung.com/blog/", "reason": "Scott Young 学习策略博客，适合借鉴高效学习者的方法论和技巧。"},
            {"title": "Obsidian 笔记法", "url": "https://obsidian.md/", "reason": "双向链接笔记工具，适合搭建个人知识管理系统并提升学习效率。"},
            {"title": "阅读方法论", "url": "https://www.coursera.org/learn/learning-to-learn", "reason": "深度阅读与理解策略，适合提升技术书籍和文档的阅读吸收效率。"},
            {"title": "程序员学习路线图", "url": "https://roadmap.sh/", "reason": "技术方向学习路线图集合，适合按图索骥制定系统的技能学习计划。"},
        ],
        "long_term": [
            {"title": "元学习", "url": "https://book.douban.com/subject/34442264/", "reason": "关于学习本身的学习，适合从认知科学角度全面升级学习能力。"},
            {"title": "How to Read a Book", "url": "https://book.douban.com/subject/1452614/", "reason": "阅读方法论经典，适合系统提升深度阅读和理解复杂技术文本的能力。"},
            {"title": "卡片笔记写作法", "url": "https://book.douban.com/subject/35503571/", "reason": "Zettelkasten 笔记系统，适合建立长期积累和知识互联的学习体系。"},
            {"title": "教是最好的学", "url": "https://www.coursera.org/learn/teaching", "reason": "教学相长课程，适合通过输出倒逼输入和构建完整的知识框架。"},
            {"title": "TED 学习科学", "url": "https://www.ted.com/playlists/401/learning_science", "reason": "学习科学 TED 合集，适合从脑科学角度理解高效学习的神经机制。"},
            {"title": "Complice 目标追踪", "url": "https://complice.co/", "reason": "目标追踪与反思工具，适合通过定期复盘来优化学习策略和进度。"},
        ],
    },
    "problem_solving": {
        "short_term": [
            {"title": "LeetCode", "url": "https://leetcode.cn/", "reason": "适合训练分析问题、拆解思路和验证解法的能力。"},
            {"title": "HackerRank", "url": "https://www.hackerrank.com/", "reason": "适合在题目场景中训练结构化解题思维。"},
            {"title": "Exercism", "url": "https://exercism.org/", "reason": "适合通过持续小练习建立问题定位和修正能力。"},
            {"title": "Project Euler", "url": "https://projecteuler.net/", "reason": "适合训练抽象建模与多步推理。"},
            {"title": "Kaggle", "url": "https://www.kaggle.com/", "reason": "适合在真实数据或案例中训练问题分析能力。"},
            {"title": "GeeksforGeeks", "url": "https://www.geeksforgeeks.org/", "reason": "适合查询常见问题思路并补齐知识盲点。"},
        ],
        "mid_term": [
            {"title": "Debugging 技巧", "url": "https://developer.mozilla.org/en-US/docs/Learn/Tools_and_testing/Cross_browser_testing/Debugging", "reason": "系统化调试指南，适合掌握定位和修复复杂问题的系统方法。"},
            {"title": "根因分析 RCA", "url": "https://asq.org/quality-resources/root-cause-analysis", "reason": "根因分析方法论，适合在线上事故排查中系统定位问题根源。"},
            {"title": "Stack Overflow 高效搜索指南", "url": "https://stackoverflow.com/help/searching", "reason": "高级搜索技巧指南，适合快速从海量信息中找到问题解决方案。"},
            {"title": "Google 高级搜索技巧", "url": "https://www.google.com/search/howsearchworks/", "reason": "Google 搜索技巧指南，适合用精准的关键词搜索快速定位技术答案。"},
            {"title": "第一性原理思考", "url": "https://fs.blog/first-principles/", "reason": "第一性原理思维方法，适合从事物本质出发解决复杂技术问题。"},
            {"title": "A/B 测试方法论", "url": "https://cxl.com/blog/ab-testing-guide/", "reason": "A/B 测试系统指南，适合用实验方法验证问题和解决方案的有效性。"},
        ],
        "long_term": [
            {"title": "算法导论", "url": "https://book.douban.com/subject/1885170/", "reason": "算法领域标准教材，适合深入理解算法设计与分析的数学基础。"},
            {"title": "编程珠玑", "url": "https://book.douban.com/subject/3227098/", "reason": "编程问题求解经典，适合学习将复杂问题转化为优雅算法的方法。"},
            {"title": "像程序员一样思考", "url": "https://book.douban.com/subject/26880762/", "reason": "编程思维方式培养，适合建立从问题到解法的高效思维链路。"},
            {"title": "Coursera 计算理论", "url": "https://www.coursera.org/learn/computability", "reason": "计算理论入门课程，适合理解问题可解性和复杂度的深层理论。"},
            {"title": "MIT 6.006 算法导论", "url": "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/", "reason": "MIT 算法经典课程，适合系统掌握高效算法的设计与分析。"},
            {"title": "Competitive Programming", "url": "https://cp-algorithms.com/", "reason": "竞赛编程算法百科，适合通过高难度题目进一步提升解题速度和思维深度。"},
        ],
    },
    "other_special": {
        "short_term": [
            {"title": "LinkedIn Learning", "url": "https://www.linkedin.com/learning/", "reason": "适合补齐岗位拓展能力和职业化专项技能。"},
            {"title": "Udemy", "url": "https://www.udemy.com/", "reason": "课程覆盖广，适合按专项短板快速补位。"},
            {"title": "Google Developers", "url": "https://developers.google.com/learn", "reason": "适合围绕专项主题快速建立实践认知。"},
            {"title": "AWS Skill Builder", "url": "https://explore.skillbuilder.aws/", "reason": "适合补云、工程化或平台类专项能力。"},
            {"title": "Bilibili 学习区", "url": "https://www.bilibili.com/", "reason": "适合快速了解专项主题并补充中文案例理解。"},
            {"title": "InfoQ", "url": "https://www.infoq.cn/", "reason": "适合跟进工程实践、架构和行业专项动态。"},
        ],
        "mid_term": [
            {"title": "LPI Linux 认证", "url": "https://www.lpi.org/", "reason": "Linux 专业认证，适合补足服务器运维和系统管理专项资质。"},
            {"title": "Kubernetes 官方教程", "url": "https://kubernetes.io/docs/tutorials/", "reason": "K8s 官方入门实践，适合掌握容器编排和云原生部署技能。"},
            {"title": "Docker 实战指南", "url": "https://docs.docker.com/get-started/", "reason": "Docker 官方实践教程，适合通过动手操作掌握容器化技术。"},
            {"title": "PMP 项目管理认证", "url": "https://www.pmi.org/certifications/project-management-pmp", "reason": "项目管理权威认证，适合补足证书类特殊准入要求和项目管理技能。"},
            {"title": "Oracle 数据库认证", "url": "https://education.oracle.com/", "reason": "Oracle 官方认证路径，适合需要数据库专项证书的岗位要求。"},
            {"title": "雅思/托福备考资源", "url": "https://www.britishcouncil.org/exam/ielts", "reason": "英语能力测试官方备考资源，适合补足语言能力和证书类要求。"},
        ],
        "long_term": [
            {"title": "CISSP 信息安全认证", "url": "https://www.isc2.org/Certifications/CISSP", "reason": "信息安全顶级认证，适合信息安全专项岗位的长期资质积累。"},
            {"title": "TOGAF 企业架构", "url": "https://www.opengroup.org/certifications/togaf", "reason": "企业架构标准框架，适合架构师岗位的体系化认证和知识储备。"},
            {"title": "AWS 解决方案架构师认证", "url": "https://aws.amazon.com/certification/certified-solutions-architect-professional/", "reason": "AWS 高级认证路径，适合云架构专项能力的权威背书。"},
            {"title": "软考高级 系统架构设计师", "url": "https://www.ruankao.org.cn/", "reason": "国内软考高级职称考试，适合国内岗位的职称和特殊准入要求。"},
            {"title": "Google Cloud 认证", "url": "https://cloud.google.com/learn/certification", "reason": "GCP 专业认证路径，适合需要多云平台能力的特殊岗位要求。"},
            {"title": "CFA / 金融证书", "url": "https://www.cfainstitute.org/", "reason": "金融领域权威认证，适合金融科技或需要金融背景的跨领域岗位。"},
        ],
    },
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", "", (value or "").strip()).casefold()


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
    expected = len(build_seed_resource_rows())
    actual = db.execute(select(SnailLearningResourceLibrary)).scalars().all()
    if len(actual) == expected:
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


def build_seed_resource_rows() -> list[dict[str, str | int]]:
    rows: list[dict[str, str | int]] = []
    for canonical_job_title in SUPPORTED_JOB_TITLES:
        for dimension_key in JOB_PROFILE_FIELD_ORDER:
            label = DIMENSION_LABELS[dimension_key]
            phase_templates = DIMENSION_RESOURCE_TEMPLATES[dimension_key]
            for phase_key in SUPPORTED_PHASE_KEYS:
                templates = phase_templates[phase_key]
                if len(templates) != 6:
                    raise ValueError(f"Dimension {dimension_key} / {phase_key} must define exactly 6 resource templates.")
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
