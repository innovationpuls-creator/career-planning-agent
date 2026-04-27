# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

大学生职业规划智能体 — an AI-assisted platform for university students' career development.

- **User flow**: Login → complete profile → upload resume (AI parses into 12-dimension competency profile) → job matching/favorites → generate snail learning path → generate career growth report (export DOCX/PDF) → browse job knowledge base.
- **Admin flow**: User management, job management, job requirement comparison, data import, analytics dashboard.

## Dev Commands

### Frontend (`myapp/`)
```bash
cd myapp
npm install
npm start              # dev server (MOCK=none, no backend)
npm run start:dev      # same as above
npm run start:mock     # dev with local mock data
npm run lint           # biome lint + tsc
npm run tsc            # type-check only
npm run test           # jest (all tests)
npm run test -- --testPathPattern="ResumeParsing"  # single test file
npm run build          # production build
```

### Backend (`backend/`)
```bash
cd backend
cp .env.example .env   # fill in APP_SECRET_KEY and AI credentials
uv sync                # install dependencies (run once after clone and on dependency changes)
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 9100   # dev server
uv run pytest           # run all tests
uv run pytest tests/test_auth.py::test_name  # single test
```

### Data Initialization (first-time only)
```bash
cd backend
uv run python scripts/rebuild_job_transfer_v2.py --with-import
# Default data source: C:\Users\yzh\Desktop\feature_map\行业数据
# Override: edit DEFAULT_SOURCE_DIR in app/services/job_import.py
```

## Documentation

- `docs/api-contract.md` — **Complete frontend-backend API reference.** All endpoints, request/response shapes, SSE streaming formats, and 12-dimension enum keys. **Always check here before modifying or adding API endpoints.**
- `docs/DESIGN_SYSTEM_SPEC.md` — Frontend design tokens and component patterns.
- `docs/frontend-rewrite-plan.md` — In-progress frontend rewrite plan.

## Important Notes

**`.umi-undefined/`** — Umi dev-mode generated cache. It is in `.gitignore`; do not commit it.

**Frontend dev server** (`npm start`) runs on port 8000 and proxies API calls to backend on port 9100 via `myapp/config/proxy.ts`.

**AI features are optional** — the app starts with reduced functionality if AI credentials (LLM, Dify, Embedding) are not configured in `.env`.

### Backend — FastAPI + layered services

```
backend/app/
├── api/          # FastAPI routers (one file per resource)
├── core/         # Pydantic Settings from env vars
├── db/           # SQLAlchemy Base + session
├── models/       # ORM models
├── schemas/      # Pydantic request/response DTOs
└── services/     # Business logic (LLM, embeddings, vector store, Dify, etc.)
```

**Database**: SQLite (data/app.db) for structured data; Neo4j for job requirement knowledge graph; Qdrant for vector similarity search.

**AI integration**: OpenAI-compatible LLM (`services/llm.py`), Embedding service (`services/embeddings.py`), Dify workflows for resume parsing and report generation.

**Key data models**: User, JobPosting, JobRequirementProfile (12-dimension), CareerRequirementProfile (aggregated), CareerTitleAlias, StudentCompetencyProfile (12-dim parsed from resume), SnailLearningResourceLibrary, CareerDevelopmentPlanWorkspace, JobTransferAnalysisTask.

**Startup behavior** (`app/main.py`): `init_db()` runs in a FastAPI lifespan context. It:
1. Auto-starts Neo4j via `brew services run neo4j` (if not already running) and Qdrant from `backend/qdrant-bin/qdrant` (if binary exists)
2. Creates/drops SQLite tables via raw SQL ALTER TABLE (no Alembic — schema changes are managed in code)
3. Seeds admin user and learning resource library
4. Syncs the job requirement knowledge graph to Neo4j

Both Neo4j (if started by the backend) and Qdrant are stopped automatically on shutdown via the lifespan context manager.

**API conventions**: Most endpoints return Pydantic-validated JSON directly. Long-running operations (resume parsing, report generation, goal planning) use SSE streaming responses (`StreamingResponse`).

### Frontend — Ant Design Pro (Umi Max) + TypeScript

```
myapp/src/
├── pages/          # Route pages
│   ├── Admin/      # Admin dashboard, user management, job management, data dashboard
│   ├── career-development-report/
│   ├── home-v2/
│   ├── job-requirement-profile/
│   ├── student-competency-profile/
│   └── user/
├── services/       # API client (umi-request based)
├── components/
└── models/         # Umi dva models
```

## Configuration

Backend `.env` is required. Minimum working config:
```
APP_SECRET_KEY=<any long random string>
```

AI features (LLM, Dify, Embeddings, Qdrant) are optional — the app starts with reduced functionality if not set. See `.env.example` for all variables.

## Adding a New API Endpoint

1. Define Pydantic schema in `backend/app/schemas/`
2. Add SQLAlchemy model if needed in `backend/app/models/`
3. Create router in `backend/app/api/`
4. Register router in `backend/app/main.py`
5. Add frontend service method in `myapp/src/services/`
6. Add page/component in `myapp/src/pages/`
