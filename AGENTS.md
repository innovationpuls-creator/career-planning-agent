# AGENTS.md

Project: 大学生职业规划智能体  
Stack: FastAPI backend + Ant Design Pro / Umi Max frontend.

This file is for routing and constraints only. Do not duplicate full specs here.

---

## Behavior Rules

- Do not guess. If a choice affects behavior, API contracts, data shape, or visible UI, ask first.
- Keep changes minimal. Do not add features, abstractions, or configurability unless requested.
- Touch only files required by the task. Do not refactor adjacent code unless asked.
- Match existing style. Clean only imports, variables, or functions made unused by your own change.
- For bugs, reproduce or identify the cause before fixing.
- For non-trivial work, state a short plan and verification method before editing.

---

## Documentation Map

Read the relevant doc before implementation.

| Need | Read |
|---|---|
| Page features and routes | `docs/UI功能详细整理.md` |
| Page → backend API mapping | `docs/UI功能后端接口对照.md` |
| Visual design language | `docs/Design.md` |
| Runtime Ant Design tokens | `myapp/config/defaultSettings.ts` |
| Claude tokens | `myapp/src/styles/claude-tokens.ts` |
| Motion tokens | `myapp/src/styles/motion.ts` |
| Redesign specs/plans | `docs/superpowers/specs/`, `docs/superpowers/plans/` |
| Change history | `docs/changes/` |
| Deployment/env | `docs/deploy-centos.md`, `backend/.env.example` |
| Playwright screenshots | `docs/images/test/README.md` |

Do not guess endpoint shapes, dimension keys, page features, or token values. Read docs, then verify source.

---

## Architecture

Backend: `backend/app/` — FastAPI routers, settings, SQLAlchemy models, Pydantic schemas, services.  
Frontend: `myapp/src/` — Umi route pages, API services, components, models.  
Data: SQLite + Neo4j knowledge graph + Qdrant vector search.  
AI: OpenAI-compatible LLM, embeddings, and Dify workflows are optional; app should degrade gracefully.

---

## Conventions

Styling: use `createStyles(({ css, token }) => ({ ... }))` from `antd-style`. Do not create `.less` or CSS modules for new components, except documented Ant Design/Mako workarounds from Learned Skills.

Colors: use `token.*` or shared token helpers. Never hardcode hex, rgb, rgba, hsl, or named colors in component files.

SSE: backend uses `StreamingResponse` NDJSON; frontend uses `fetch` + `ReadableStream`. Event order: `meta → delta → done / error`.

Uploads: frontend uses `FormData`; backend uses `UploadFile` + `Form`. Resume max size: 10MB. Supported: PDF, DOC, DOCX.

New endpoint flow: Schema → Model → Router → `main.py` → `api.ts` → Page.

---

## 12-Dimension Keys

Always use these exact keys. Never invent dimension names.

| key | 中文 |
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

---

## Pitfalls

- `.env`: minimum required value is `APP_SECRET_KEY`.
- Admin defaults: `admin` / `123456` / `管理员`; resets every startup.
- `.umi-undefined/`: dev cache; do not commit.
- `myapp/src/pages/table-list/`: default Umi template; do not add features.
- No Alembic: schema changes use raw SQL `ALTER TABLE` in `init_db()`.
- `docs/Design.md`: aesthetic reference only, not runtime token source.

---

## Learned Skills

Stored in `~/.claude/skills/learned/`. When a trigger matches, read the skill file before editing code.

| Trigger | Skill file |
|---|---|
| Tabs collapse or width jitters | `ant-tabs-equal-width-flex` |
| ProLayout overrides background | `ant-pro-layout-background-override` |
| `colorBgSpotlight` creates dark bg | `antd-colorBgSpotlight-dark-background` |
| `:global()` disappears under Mako | `antd-style-global-mako-bypass` |
| antd font replacement fails | `antd-font-replacement` |
| Browser renders unexpected CSS | `playwright-css-rules-inspection` |
| Less/CSS changes not reflected | `umi-mako-css-not-updating` |
| Playwright screenshots | `playwright-screenshot-verification` |