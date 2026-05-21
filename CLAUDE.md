# CLAUDE.md

Project: College Student Career Planning Agent 所有前端展示文本使用中文
Stack: FastAPI backend + Ant Design Pro / Umi Max frontend  
Python runner: use `uv`

This file is a constraint and routing checklist for AI agents. Keep implementation details in the referenced docs.

## Operating Rules

- Do not guess. Ask before making choices that affect behavior, API contracts, data shape, or visible UI.
- Keep changes minimal and requested-scope only. Do not add features, abstractions, configurability, or adjacent refactors unless asked.
- Touch only files required by the task.
- Match existing style. Remove only imports, variables, or functions made unused by your own change.
- For bugs, reproduce or identify the cause before fixing.
- For non-trivial work, state a short plan and verification method before editing.

## Read First

Read the relevant source before implementation, then verify against code.

| Need | Source |
|---|---|
| Page features/routes | `docs/UI功能模块/README.md` |
| Page-to-backend API mapping | `docs/UI功能模块/README.md` |
| Architecture | `docs/architecture.md` |
| Database schema/models | `docs/database-schema.md` |
| Testing | `docs/testing.md` |
| Visual design reference | `docs/Design.md` |
| Runtime Ant Design tokens | `myapp/config/defaultSettings.ts` |
| Claude tokens | `myapp/src/styles/claude-tokens.ts` |
| Motion tokens | `myapp/src/styles/motion.ts` |
| Redesign specs/plans | `docs/superpowers/specs/`, `docs/superpowers/plans/` |
| Change history | `docs/changes/` |
| Deployment/env | `docs/deploy-centos.md`, `backend/.env.example` |
| Playwright screenshots | `docs/images/test/README.md` |

Never infer endpoint shapes, dimension keys, page features, or token values without checking docs and source.

## Architecture Boundaries

- Backend: `backend/app/` for FastAPI routers, settings, SQLAlchemy models, Pydantic schemas, and services.
- Frontend: `myapp/src/` for Umi pages, API services, components, and models.
- Data: SQLite, Neo4j knowledge graph, and Qdrant vector search.
- AI: OpenAI-compatible LLMs, embeddings, and Dify workflows are optional; degradation must be graceful.

## Implementation Constraints

- Styling: use `createStyles(({ css, token }) => ({ ... }))` from `antd-style`.
- Do not add new `.less` files or CSS modules except for documented Ant Design/Mako workarounds in Learned Skills.
- Colors: use `token.*` or shared token helpers. Never hardcode hex, rgb, rgba, hsl, or named colors in component files.
- SSE: backend uses `StreamingResponse` NDJSON; frontend uses `fetch` + `ReadableStream`; event order is `meta -> delta -> done / error`.
- Uploads: frontend uses `FormData`; backend uses `UploadFile` + `Form`; resume max size is 10MB; supported formats are PDF, DOC, DOCX.
- New endpoint flow: Schema -> Model -> Router -> `main.py` -> `api.ts` -> Page.

## 12-Dimension Keys

Use only these exact keys. Never invent, rename, or translate keys.

`professional_skills`, `professional_background`, `education_requirement`, `teamwork`, `stress_adaptability`, `problem_solving`, `communication`, `work_experience`, `documentation_awareness`, `responsibility`, `learning_ability`, `other_special`

## Pitfalls

- `.env` minimum required value: `APP_SECRET_KEY`.
- Admin defaults reset on every startup: `admin` / `123456` / `管理员`.
- `.umi-undefined/` is dev cache; do not commit it.
- `myapp/src/pages/table-list/` is default Umi template code; do not add features there.
- No Alembic: schema changes use raw SQL `ALTER TABLE` in `init_db()`.
- `docs/Design.md` is aesthetic reference only, not a runtime token source.

## Learned Skills

Before editing code, read the matching file under `~/.claude/skills/learned/` when a trigger applies.

| Trigger | Skill file |
|---|---|
| Tabs collapse or width jitters | `ant-tabs-equal-width-flex` |
| ProLayout overrides background | `ant-pro-layout-background-override` |
| `colorBgSpotlight` creates dark bg | `antd-colorBgSpotlight-dark-background` |
| `:global()` disappears under Mako | `antd-style-global-mako-bypass` |
| Ant Design font replacement fails | `antd-font-replacement` |
| Browser renders unexpected CSS | `playwright-css-rules-inspection` |
| Less/CSS changes not reflected | `umi-mako-css-not-updating` |
| Playwright screenshots | `playwright-screenshot-verification` |
