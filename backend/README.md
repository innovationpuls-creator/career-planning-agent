# Backend README

`backend/` 是大学生职业规划智能体的 FastAPI 后端。

## 快速启动

```bash
cd backend
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 9100
```

启动后：
- Swagger: http://127.0.0.1:9100/docs
- Health: http://127.0.0.1:9100/health

## .env 配置

| 变量 | 说明 | 必填 |
|------|------|------|
| `APP_SECRET_KEY` | JWT 签名密钥 | 是 |
| `SQLITE_URL` | SQLite 数据库路径 | 否（默认 `sqlite:///data/app.db`） |
| `NEO4J_URI` / `NEO4J_USERNAME` / `NEO4J_PASSWORD` | Neo4j 图数据库连接 | 部分功能需要 |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | 大模型接口（OpenAI 兼容） | AI 功能必填 |
| `EMBEDDING_BASE_URL` / `EMBEDDING_API_KEY` | Embedding 接口 | 向量检索必填 |
| `DIFY_BASE_URL` / `DIFY_API_KEY` | Dify 工作流接口 | 简历解析 / 职业成长报告必填 |
| `CAREER_GOAL_DIFY_API_KEY` | 职业目标 Dify（含网络搜索） | 职业规划必填 |
| `CAREER_GOAL_KNOWSEARCH_DIFY_API_KEY` | 知识搜索 Dify | 职业规划必填 |
| `QDRANT_PATH` | Qdrant 向量库路径 | 向量检索必填 |

> 不配置 AI 相关变量可启动基础服务（账号、岗位 CRUD），但大模型、Dify、向量检索不可用。

## 数据初始化（仅首次）

### 一键重建

```bash
uv run python scripts/rebuild_job_transfer_v2.py --with-import
```

### 手动按序执行

```bash
uv run python scripts/import_job_postings.py            # 从 Excel 导入岗位数据
uv run python scripts/build_job_requirement_profiles.py  # 用 LLM 从岗位描述提取 12 维度画像
uv run python scripts/build_career_title_aliases.py      # 用 LLM 将原始岗位名归一化为标准职业名
uv run python scripts/build_career_requirement_profiles.py # 按标准职业名聚合岗位画像
uv run python scripts/build_transfer_group_embeddings.py  # 生成向量并写入 Qdrant
```

> 导入脚本默认读取 `C:\Users\yzh\Desktop\feature_map\行业数据`，修改 `app/services/job_import.py` 中的 `DEFAULT_SOURCE_DIR` 可切换数据目录。

## 目录结构

```
backend/
├── app/
│   ├── api/                    # FastAPI 路由处理器（每资源一个文件）
│   │   ├── auth.py             # 注册 / 登录 / 当前用户
│   │   ├── jobs.py             # 岗位信息查询
│   │   ├── job_transfer.py     # 职业路径分析（含 SSE 流式）
│   │   ├── job_requirement_graph.py    # 岗位要求知识图谱（Neo4j）
│   │   ├── job_requirement_vertical.py # 垂直岗位画像（按行业/职能分层）
│   │   ├── job_requirement_comparisons.py # 岗位要求对比
│   │   ├── student_competency_profile.py # 学生 12 维度能力画像（Dify）
│   │   ├── snail_learning_path.py        # 蜗牛学习路径
│   │   ├── career_development_report.py  # 职业发展报告 / 收藏 / 成长报告
│   │   ├── user_profile.py      # 用户信息 / 引导表单
│   │   ├── admin_users.py       # 用户管理（管理员）
│   │   └── admin_data_dashboard.py # 数据仪表盘（管理员）
│   ├── core/
│   │   └── config.py            # Pydantic Settings，所有环境变量映射
│   ├── db/
│   │   ├── base.py              # SQLAlchemy Base
│   │   └── session.py           # 数据库会话管理
│   ├── models/                  # SQLAlchemy ORM 模型
│   ├── schemas/                 # Pydantic 请求/响应 DTO
│   └── services/                # 业务逻辑层
│       ├── llm.py               # OpenAI 兼容 LLM 客户端
│       ├── embeddings.py        # Embedding 服务
│       ├── vector_store.py      # Qdrant 向量库封装
│       ├── job_import.py        # Excel 岗位数据导入
│       ├── job_requirement_profile.py   # 岗位画像构建
│       ├── job_transfer.py / job_transfer_task_manager.py # 职业路径分析
│       ├── student_competency_profile.py # Dify 简历解析
│       ├── career_development_*.py      # 职业发展、学习资源、成长报告
│       └── snail_learning_resource_library.py # 蜗牛学习资源库
├── scripts/                     # 数据初始化脚本
│   ├── import_job_postings.py
│   ├── build_job_requirement_profiles.py
│   ├── build_career_title_aliases.py
│   ├── build_career_requirement_profiles.py
│   ├── build_transfer_group_embeddings.py
│   ├── rebuild_job_transfer_v2.py     # 一键重建
│   └── rebuild_snail_learning_resource_library.py
├── tests/                      # pytest 测试
├── .env.example                 # 环境变量模板
└── pyproject.toml              # uv 项目配置
```

## API 概览

| 前缀 | 功能 |
|------|------|
| `/api/auth` | 注册、登录、当前用户 |
| `/api/job-postings` | 岗位信息查询 |
| `/api/job-transfer` | 职业路径分析（SSE 流式） |
| `/api/job-requirement-profile/graph` | 岗位要求知识图谱 |
| `/api/job-requirement-profile/vertical` | 垂直岗位画像 |
| `/api/job-requirement-comparisons` | 岗位要求对比 |
| `/api/student-competency-profile` | 学生 12 维度能力画像 |
| `/api/snail-learning-path` | 蜗牛学习路径 |
| `/api/career-development-report` | 职业匹配、收藏、成长报告 |
| `/api/user-profile` | 用户信息、引导表单 |
| `/api/admin` | 用户管理（管理员） |
| `/api/admin/data-dashboard` | 数据仪表盘（管理员） |

## 核心数据模型

| 模型 | 说明 |
|------|------|
| `User` | 用户（admin/user 角色） |
| `JobPosting` | 岗位信息（行业、职能、地点、薪资、公司） |
| `JobRequirementProfile` | 单条岗位的 12 维度要求画像 |
| `CareerRequirementProfile` | 按标准职业名聚合的要求画像 |
| `CareerTitleAlias` | 原始岗位名 → 标准职业名映射 |
| `JobGroupEmbedding` | Qdrant 岗位向量映射 |
| `CareerGroupEmbedding` | Qdrant 职业向量映射 |
| `StudentProfile` | 学生个人信息（学校、专业、目标岗位等） |
| `StudentCompetencyProfile` | 学生的 12 维度能力画像（含 Dify 会话） |
| `StudentCompetencyUserLatestProfile` | 每个学生的最新能力画像快照 |
| `CareerDevelopmentFavoriteReport` | 收藏的职业匹配报告 |
| `CareerDevelopmentPlanWorkspace` | 学习计划工作区 |
| `CareerDevelopmentPersonalGrowthReportTask` | 成长报告生成任务（异步） |
| `SnailLearningResourceLibrary` | 蜗牛学习资源库（岗位×维度×阶段） |
| `SnailLearningPathReview` | 学习阶段评审记录 |
| `JobTransferAnalysisTask` | 职业路径分析任务（异步） |

## 测试

```bash
uv run pytest
```
