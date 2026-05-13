# 系统架构

> 最后更新：2026-05-08

---

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | UmiJS 4 (Ant Design Pro) + React 18 | TypeScript, antd-style, framer-motion |
| 后端 | FastAPI (Python 3) | 异步 REST + SSE 流式 |
| 关系数据库 | SQLite (SQLAlchemy ORM) | 18 个模型，启动时自动建表 |
| 图数据库 | Neo4j | 岗位能力知识图谱 |
| 向量数据库 | Qdrant | 岗位/职业匹配相似度搜索 |
| AI | OpenAI 兼容 API + Dify | LLM 调用、Embedding、工作流 |
| 部署 | Docker Compose + Nginx | CentOS 生产环境 |

---

## 系统组件图

```
┌─────────────────────────────────────────────────────────┐
│                     Nginx (反向代理)                      │
│               port 80/443 → frontend :9100               │
│              /api/* → backend :9000                      │
└──────────────────┬──────────────────────────────────────┘
                   │
    ┌──────────────┴──────────────┐
    │                             │
    ▼                             ▼
┌───────────────┐        ┌────────────────┐
│   Frontend    │        │    Backend     │
│   UmiJS :9100 │───────▶│  FastAPI :9000 │
│               │  REST  │                │
│  React 18     │  +SSE  │  12 Routers    │
│  antd-style   │        │  55 Endpoints  │
│  framer-motion│        │  30 Services   │
└───────────────┘        └──────┬─────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
        ┌──────────┐    ┌──────────┐     ┌──────────┐
        │  SQLite  │    │  Neo4j   │     │  Qdrant  │
        │ (主数据)  │    │ (知识图谱)│     │ (向量搜索)│
        └──────────┘    └──────────┘     └──────────┘
              │
              ▼
        ┌──────────┐    ┌──────────┐
        │  Dify    │    │ OpenAI   │
        │ (工作流)  │    │ 兼容 API │
        └──────────┘    └──────────┘
```

---

## 数据流

### 用户简历分析流程

```
用户上传简历 → SSE 流式解析 → 12 维度能力画像
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              能力雷达图      差距分析面板    关键字编辑器
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                             向量相似度匹配
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              职业匹配推荐    公司匹配卡片    收藏目标岗位
                    │
                    ▼
            蜗牛学习路径 (分阶段学习计划)
                    │
                    ▼
            个人职业成长报告 (AI 生成 + 导出)
```

### 岗位知识图谱构建

```
爬虫/导入岗位数据 → JobPosting (SQLite)
                        │
                        ▼
              LLM 提取 12 维度需求
                        │
                        ▼
              JobRequirementProfile (SQLite)
                        │
                        ▼
              向量化 Embedding → Qdrant
                        │
                        ▼
              Neo4j 图节点 + 关系
                        │
                        ▼
              前端交互式知识图谱
```

---

## 路由架构

### 前端路由 (UmiJS)

```
/ (公开)
├── /user/login          — 登录
├── /user/register       — 注册
├── /home-v2             — 职业规划首页
├── /student-competency-profile — 简历解构
├── /career-match        — 职业匹配
├── /snail-learning-path — 蜗牛学习路径
├── /personal-growth-report — 个人职业成长报告
├── /job-competency-graph   — 岗位能力图谱
├── /same-job-cross-industry — 同岗行业对比
└── /admin/*             — 管理后台 (7 页面)
```

### 后端路由 (FastAPI)

| 路由文件 | 前缀 | 端点数 |
|---|---|---|
| `auth.py` | `/api` | 4 |
| `user_profile.py` | `/api` | 2 |
| `student_competency_profile.py` | `/api/student-competency-profile` | 9 |
| `career_development_report.py` | (无前缀) | 16 |
| `snail_learning_path.py` | (无前缀) | 8 (含兼容路径) |
| `job_requirement_graph.py` | `/api/job-requirement-profile` | 1 |
| `job_requirement_vertical.py` | `/api/job-requirement-profile` | 2 |
| `job_transfer.py` | `/api/job-transfer` | 8 |
| `job_requirement_comparisons.py` | `/api/job-requirement-comparisons` | 2 |
| `jobs.py` | `/api/job-postings` | 3 |
| `admin_users.py` | `/api/admin` | 7 |
| `admin_data_dashboard.py` | `/api/admin/data-dashboard` | 3 |

---

## 认证与授权

- **JWT Bearer Token** — 所有 API 认证
- **角色**：`admin` / `user`
- **依赖注入**：
  - `require_authenticated_user` — 任何有效令牌
  - `require_admin_user` — 仅管理员
  - `require_standard_user` — 仅普通用户
- 管理员账号在启动时自动创建 (`admin` / `123456`)

---

## 关键设计决策

1. **SQLite 而非 PostgreSQL** — 单文件部署，无需独立数据库服务，满足大学场景
2. **无 Alembic 迁移** — 启动时通过 `ALTER TABLE` 动态修改 schema，适配快速迭代
3. **SSE NDJSON (非 WebSocket)** — 流式 AI 响应使用 `application/x-ndjson`，简单可靠
4. **双路径兼容** — snail-learning-path 端点同时注册在新旧路径下，保持向后兼容
5. **Dify 可选降级** — 简历解析优先使用 Dify 工作流，配置 `use_local_competency_profile` 可降级到本地 LLM
6. **文件 < 800 行** — 前端页面组件强制拆分，最大文件不超过 800 行
