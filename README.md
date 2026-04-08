# Career Planning Agent

`Career Planning Agent` 是一个前后端分离的职业规划辅助项目：

- `backend/`：基于 FastAPI 的后端服务，负责账号、岗位数据导入、能力画像、职业发展报告等接口。
- `myapp/`：基于 Ant Design Pro / Umi Max 的前端应用，负责页面展示与交互。

本仓库只保留可复现项目所需的代码、锁文件和文档，不提交真实 `.env`、本地数据库、向量索引、`node_modules`、`dist` 等运行产物。

## 目录结构

```text
feature_map_text/
|- backend/   # FastAPI backend
|- myapp/     # Ant Design Pro frontend
|- README.md
```

## 环境要求

### 后端

- Python 3.11 及以上
- [uv](https://docs.astral.sh/uv/)
- Neo4j（如需岗位图谱同步能力）

### 前端

- Node.js 20 及以上
- npm

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/innovationpuls-creator/-.git career-planning-agent
cd career-planning-agent
```

### 2. 准备后端环境变量

先复制示例配置：

Windows PowerShell:

```powershell
Copy-Item backend\.env.example backend\.env
```

macOS / Linux:

```bash
cp backend/.env.example backend/.env
```

复制后请至少检查这些变量：

- `SQLITE_URL`
- `NEO4J_URI`
- `NEO4J_USERNAME`
- `NEO4J_PASSWORD`
- `NEO4J_DATABASE`
- `DIFY_BASE_URL`
- `DIFY_API_KEY`
- `LLM_BASE_URL`
- `LLM_API_KEY`
- `EMBEDDING_BASE_URL`
- `EMBEDDING_API_KEY`

说明：

- 账号登录、基础接口、本地 SQLite 和 Qdrant 路径可以用示例值启动。
- 未配置 LLM / Embedding / Dify 相关变量时，依赖这些外部 AI 能力的功能可能不可用，或在调用时失败。
- 如本机没有 Neo4j，可先保留默认值；后端启动时会跳过图谱同步，但相关图谱能力不可用。

## 首次启动

首次启动通常分成 2 步：初始化后端数据，再启动前后端服务。

### 1. 安装后端依赖

```bash
cd backend
uv sync
```

### 2. 准备原始 Excel 数据

本仓库默认不提交原始业务数据。导入脚本 `backend/scripts/import_job_postings.py` 当前使用代码中的默认目录：

```text
C:\Users\yzh\Desktop\feature_map\行业数据
```

如果你要执行导入，请任选一种方式：

1. 在本机准备好该目录下的 Excel 数据。
2. 按你的实际数据位置修改 [job_import.py](C:/Users/yzh/Desktop/feature_map_text/backend/app/services/job_import.py) 里的 `DEFAULT_SOURCE_DIR`。

### 3. 初始化数据库与索引

在仓库根目录或 `backend/` 目录中按顺序执行：

```bash
cd backend
uv run python scripts/import_job_postings.py
uv run python scripts/build_job_requirement_profiles.py
uv run python scripts/build_career_title_aliases.py
uv run python scripts/build_career_requirement_profiles.py
uv run python scripts/build_transfer_group_embeddings.py
```

如果你已经准备好数据，并且希望一键重建完整流程，可以使用：

```bash
cd backend
uv run python scripts/rebuild_job_transfer_v2.py --with-import
```

## 日常启动

如果本地数据库和索引已经初始化过，日常开发只需要启动服务。

### 启动后端

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 9100
```

启动后可访问：

- Swagger: `http://127.0.0.1:9100/docs`
- Health: `http://127.0.0.1:9100/health`

### 启动前端

```bash
cd myapp
npm install
npm start
```

前端本地开发会把 `/api/*` 代理到 `http://127.0.0.1:9100`。

## 测试与检查

### 后端

```bash
cd backend
uv run pytest
```

### 前端

```bash
cd myapp
npm test -- --runInBand
```

## 常见问题

### 为什么仓库里没有 `.env`？

真实 `.env` 可能包含密钥和本机路径，因此不会提交。请从 `backend/.env.example` 复制生成。

### 为什么仓库里没有 `backend/data/` 和 `行业数据/`？

- `backend/data/` 是本地运行生成的数据库和 Qdrant 索引，属于运行产物。
- `行业数据/` 是原始业务数据，不随代码仓库发布。

### 不配置 AI 服务能启动吗？

通常可以启动基础服务，但涉及外部大模型、Embedding、Dify 工作流的接口可能不可用。建议先完成基础启动，再逐步补齐第三方配置。

## 子模块说明

- 后端说明见 [backend/README.md](C:/Users/yzh/Desktop/feature_map_text/backend/README.md)
- 前端说明见 [myapp/README.md](C:/Users/yzh/Desktop/feature_map_text/myapp/README.md)
