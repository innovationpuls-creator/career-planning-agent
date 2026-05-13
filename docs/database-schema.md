# 数据库模型

> 最后更新：2026-05-12
> 数据库：SQLite，通过 SQLAlchemy ORM 管理
> 迁移方式：启动时 `init_db()` 中通过 `ALTER TABLE` 动态修改

---

## 模型关系图

```
User (用户)
├── StudentProfile (学生资料)          1:1
├── StudentProfileAttachment (简历附件) 1:N
├── StudentCompetencyProfile (能力画像) 1:N
├── StudentCompetencyUserLatestProfile  1:1
├── CareerDevelopmentFavoriteReport     1:N
│   └── CareerDevelopmentPlanWorkspace  1:1
│       └── CareerDevelopmentGoalPlanningTask  1:N
│       └── SnailLearningPathReview           1:N
└── CareerDevelopmentPersonalGrowthReportTask 1:N

JobPosting (岗位发布)
├── JobRequirementProfile (岗位要求画像) 1:1
├── CareerRequirementProfile (职业要求画像) 1:1
└── JobTransferAnalysisTask (岗位转换任务) 1:N

JobGroupEmbedding (岗位组向量)      — Qdrant
CareerGroupEmbedding (职业组向量)   — Qdrant
SnailLearningResourceLibrary (学习资源库)
CareerTitleAlias (岗位名称别名)
```

---

## 核心模型详情

### 用户与认证

**`User`** (`users`)
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID | 主键 |
| `username` | String(64) | 唯一，登录用 |
| `display_name` | String(128) | 显示昵称 |
| `hashed_password` | String(256) | bcrypt 哈希 |
| `role` | String(16) | `admin` / `user` |
| `avatar` | String(512) | 头像 URL |
| `status` | String(16) | `active` / `inactive` |
| `last_login_at` | DateTime | 最后登录时间 |
| `created_at` | DateTime | 注册时间 |

**`StudentProfile`** (`student_profiles`)
| 字段 | 类型 | 说明 |
|---|---|---|
| `user_id` | UUID FK | 关联 User |
| `name` | String(64) | 真实姓名 |
| `school` | String(128) | 学校 |
| `major` | String(128) | 专业 |
| `education` | String(32) | 学历 |
| `grade` | String(32) | 年级 |
| `target_job_title` | String(128) | 目标岗位 |

### 简历与能力画像

**`StudentProfileAttachment`** (`student_profile_attachments`)
| 字段 | 类型 | 说明 |
|---|---|---|
| `user_id` | UUID FK | 关联 User |
| `file_name` | String(256) | 原始文件名 |
| `file_path` | String(512) | 存储路径 |
| `file_size` | Integer | 字节数 |
| `content_type` | String(64) | MIME 类型 |

**`StudentCompetencyProfile`** (`student_competency_profiles`)
| 字段 | 类型 | 说明 |
|---|---|---|
| `user_id` | UUID FK | 关联 User |
| `dify_conversation_id` | String(64) | Dify 对话 ID |
| `workspace_conversation_id` | UUID | 工作区对话分组 |
| `output_mode` | String(16) | `profile` / `chat` |
| `profile` | JSON | 12 维度关键词 |
| `latest_analysis` | JSON | 最新分析结果 |

**`StudentCompetencyUserLatestProfile`** — 用户最新画像缓存（1:1 User）

### 职业匹配与发展

**`CareerDevelopmentFavoriteReport`** (`career_development_favorite_reports`)
| 字段 | 类型 | 说明 |
|---|---|---|
| `user_id` | UUID FK | 关联 User |
| `career_recommendation_id` | String(64) | 推荐 ID |
| `career_title` | String(256) | 职业名称 |
| `industry` | String(128) | 行业 |
| `match_score` | Float | 匹配度 (0-100) |
| `company_name` | String(256) | 公司名称 |
| `company_evidence` | JSON | 匹配证据 |

**`CareerDevelopmentPlanWorkspace`** (`career_development_plan_workspaces`)
| 字段 | 类型 | 说明 |
|---|---|---|
| `favorite_id` | UUID FK | 关联 FavoriteReport |
| `phase` | String(16) | 阶段：初级/进阶/高阶 |
| `plan_content` | JSON | 规划内容（章节） |
| `status` | String(16) | 状态：draft/generating/ready |

**`CareerDevelopmentGoalPlanningTask`** — 目标规划异步任务（SSE 进度流）

**`CareerDevelopmentPersonalGrowthReportTask`** — 成长报告异步任务（SSE 进度流）

### AI 教练会话

**`CoachSession`** (`coach_sessions`)
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String(36) | 会话 ID |
| `student_id` | Integer | 学生用户 ID |
| `title` | String(255) | 会话标题 |
| `active_agent` | String(64) | 当前子教练 |
| `pipeline_stage` | String(32) | 来源阶段 |
| `message_count` | Integer | 消息数量 |

**`CoachMessage`** (`coach_messages`)
| 字段 | 类型 | 说明 |
|---|---|---|
| `session_id` | String(36) FK | 关联 CoachSession |
| `role` | String(16) | `user` / `assistant` |
| `content` | Text | 消息正文 |
| `client_message_id` | String(64) | 前端消息 ID |
| `active_agent` | String(64) | 消息对应子教练 |
| `attachments_json` | Text | 用户消息附件元数据 |
| `run_trace_json` | Text | assistant 消息的摘要级运行轨迹 |

### 岗位市场数据

**`JobPosting`** (`job_postings`)
| 字段 | 类型 | 说明 |
|---|---|---|
| `job_title` | String(256) | 岗位名称 |
| `industry` | String(128) | 行业 |
| `company_name` | String(256) | 公司名称 |
| `location` | String(256) | 工作地点 |
| `salary_range` | String(64) | 薪资范围 |
| `description` | Text | 岗位描述（富文本） |
| `company_intro` | Text | 公司介绍 |

**`JobRequirementProfile`** (`job_requirement_profiles`)
| 字段 | 类型 | 说明 |
|---|---|---|
| `job_posting_id` | UUID FK | 关联 JobPosting |
| `canonical_job_title` | String(256) | 标准化岗位名称 |
| `professional_skills` ~ `other_special` | JSON (12 字段) | 12 维度需求提取结果 |

**`CareerRequirementProfile`** — 职业级别聚合需求画像

**`CareerTitleAlias`** — 岗位名称别名映射

### 图与向量

**`JobGroupEmbedding`** — Qdrant 岗位组向量缓存
**`CareerGroupEmbedding`** — Qdrant 职业组向量缓存

### 岗位转换

**`JobTransferAnalysisTask`** (`job_transfer_analysis_tasks`)
| 字段 | 类型 | 说明 |
|---|---|---|
| `user_id` | UUID FK | 关联 User |
| `source_career_id` | UUID FK | 源职业 |
| `target_career_id` | UUID FK | 目标职业 |
| `status` | String(16) | queued/running/completed/failed |
| `result` | JSON | 分析结果 |

### 学习路径

**`SnailLearningResourceLibrary`** — 学习资源种子数据（模块、资源、链接）
**`SnailLearningPathReview`** (`snail_learning_path_reviews`)
| 字段 | 类型 | 说明 |
|---|---|---|
| `workspace_id` | UUID FK | 关联 PlanWorkspace |
| `review_type` | String(8) | `weekly` / `monthly` |
| `summary` | Text | 用户总结 |
| `ai_report` | Text | AI 生成评估 |
| `attachment_path` | String(512) | 证据文件路径 |

---

## 12 维度字段

所有画像表（StudentCompetencyProfile、JobRequirementProfile、CareerRequirementProfile）共享以下 12 个维度的 JSON 字段：

| key | 中文名 |
|---|---|
| `professional_skills` | 专业技能 |
| `professional_background` | 专业背景 |
| `education_requirement` | 学历要求 |
| `teamwork` | 团队协作能力 |
| `stress_adaptability` | 抗压/适应能力 |
| `problem_solving` | 分析解决问题能力 |
| `communication` | 沟通表达能力 |
| `work_experience` | 工作经验 |
| `documentation_awareness` | 文档规范意识 |
| `responsibility` | 责任心/工作态度 |
| `learning_ability` | 学习能力 |
| `other_special` | 补充信息 |

每个维度存储为 `JSON` 类型的字符串数组（关键词列表）。
