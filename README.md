# 大学生职业规划智能体

帮助大学生进行职业发展的 AI 辅助平台。

**用户界面**：登录 → 完善个人信息 → 上传简历（AI 解析为 12 维度能力画像） → 岗位匹配/收藏 → 生成蜗牛学习路径 → 生成个人职业成长报告（支持导出 DOCX/PDF） → 浏览就业信息知识库。

**管理员界面**：用户管理、岗位信息管理、岗位要求对比、上传数据（知识库导入）、数据分析仪表盘（专业分布 / 能力评估 / 就业趋势）。

---

## 快速启动

### 1. 克隆

```bash
git clone https://github.com/innovationpuls-creator/-.git
cd -
```

### 2. 初始化前端

```bash
cd myapp
npm install
npm start
```

### 3. 初始化后端

```bash
cd backend
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 9100
```

> Swagger: http://127.0.0.1:9100/docs

### 4. 初始化数据（仅首次）

```bash
cd backend
uv run python scripts/rebuild_job_transfer_v2.py --with-import
```

> 数据来源默认读取 `C:\Users\yzh\Desktop\feature_map\行业数据`，可修改 `backend/app/services/job_import.py` 中的 `DEFAULT_SOURCE_DIR`。

---

## .env 配置说明

| 变量 | 说明 |
|------|------|
| `APP_SECRET_KEY` | JWT 签名密钥（必填） |
| `SQLITE_URL` | SQLite 数据库路径（默认 `sqlite:///data/app.db`） |
| `NEO4J_URI` / `NEO4J_USERNAME` / `NEO4J_PASSWORD` | Neo4j 图数据库连接（部分功能需要） |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | 大模型接口（支持 OpenAI 兼容 API，AI 功能必填） |
| `EMBEDDING_BASE_URL` / `EMBEDDING_API_KEY` | Embedding 接口（向量检索必填） |
| `DIFY_BASE_URL` / `DIFY_API_KEY` | Dify 工作流接口（简历解析 / 职业成长报告必填） |
| `CAREER_GOAL_DIFY_API_KEY` | Dify（职业目标 + 网络搜索） |
| `CAREER_GOAL_KNOWSEARCH_DIFY_API_KEY` | Dify（知识搜索） |
| `QDRANT_PATH` | Qdrant 向量库路径（默认 `data/qdrant`） |

> 不配置 AI 相关变量可启动基础服务，但大模型、Dify 工作流、向量检索等能力不可用。

---

## 技术栈

**前端**：Ant Design Pro · Umi Max · TypeScript · @antv/g6

**后端**：FastAPI · SQLAlchemy · Pydantic v2 · Neo4j · Qdrant · SQLite · Dify · SSE 流式响应
