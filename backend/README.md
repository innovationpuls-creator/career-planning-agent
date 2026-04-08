# Backend README

`backend/` 是 `Career Planning Agent` 的 FastAPI 后端。

如果你是第一次接触这个仓库，建议先阅读根目录的 [README.md](C:/Users/yzh/Desktop/feature_map_text/README.md)。根 README 提供完整的新手启动流程，这里只补充后端相关说明。

## 本目录包含什么

- `app/`：应用主代码，包含 API、配置、数据库模型、业务服务。
- `scripts/`：数据导入、画像构建、索引构建和重建脚本。
- `tests/`：后端测试。
- `uv.lock`：后端锁文件。

## 快速启动

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 9100
```

启动后可访问：

- Swagger: `http://127.0.0.1:9100/docs`
- Health: `http://127.0.0.1:9100/health`

## 环境变量

真实 `.env` 不会提交到仓库。请先复制示例文件：

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS / Linux:

```bash
cp .env.example .env
```

示例模板见 [backend/.env.example](C:/Users/yzh/Desktop/feature_map_text/backend/.env.example)。

至少建议优先检查：

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

## 数据初始化

首次导入和构建数据时，按顺序执行：

```bash
cd backend
uv sync
uv run python scripts/import_job_postings.py
uv run python scripts/build_job_requirement_profiles.py
uv run python scripts/build_career_title_aliases.py
uv run python scripts/build_career_requirement_profiles.py
uv run python scripts/build_transfer_group_embeddings.py
```

如果需要一键重建：

```bash
cd backend
uv run python scripts/rebuild_job_transfer_v2.py --with-import
```

注意：

- `scripts/import_job_postings.py` 默认依赖本地原始 Excel 数据目录。
- 仓库不会提交 `data/` 目录下的 SQLite 数据库和 Qdrant 索引。

## 测试

```bash
cd backend
uv run pytest
```
