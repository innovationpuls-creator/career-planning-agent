# AI 教练

> 来源：`myapp/config/routes.ts`、`myapp/src/pages/coach/**`、`myapp/src/components/ui/AskCoachButton.tsx`、`backend/app/api/coach*.py`、`backend/app/services/coach*.py`、`backend/app/services/memory/**`、`backend/app/services/observability/**`、`backend/app/services/tool_registry.py`

## 页面

| 路由 | 组件 | 权限 | 菜单状态 |
|---|---|---|---|
| `/coach` | `./coach` | `canUser` | `hideInMenu: true` |

## 功能

- 流式对话界面，响应格式为 NDJSON。
- 支持会话侧边栏、创建新会话、点击恢复历史会话。
- URL 支持 `session_id` 恢复会话。
- 从业务页面进入时携带 `step`、`source_page`、`favorite_id`、`workspace_id`、`report_id`、`recommendation_id`。
- 输入框支持斜杠能力列表。
- 支持上传附件，上传完成后作为下一轮消息附件。
- 支持停止生成、错误提示、重试。
- 展示 agent 运行轨迹，包括路由、上下文、工具、记忆、agent 切换、回答生成。

## 前端调用

`/coach` 使用页面本地 `myapp/src/pages/coach/api.ts`，不是公共 `myapp/src/services/ant-design-pro/api.ts`。

| 前端函数 | 方法 | 路径 | 用途 |
|---|---|---|---|
| `streamCoachChat` | POST | `/api/coach/chat/stream` | 流式对话 |
| `getCoachSkills` | GET | `/api/coach/skills` | 获取斜杠能力列表 |
| `listSessions` | GET | `/api/coach/sessions?limit&offset` | 会话侧边栏 |
| `getSession` | GET | `/api/coach/sessions/{sessionId}` | 会话恢复/切换 |
| `uploadCoachFile` | POST | `/api/coach/upload` | 附件上传 |

`deleteSession` 已在页面本地 `api.ts` 封装，对应 `DELETE /api/coach/sessions/{sessionId}`，但当前页面没有调用删除会话功能。

## 用户侧后端端点

| 方法 | 路径 | 说明 | 源码 |
|---|---|---|---|
| GET | `/api/coach/skills` | 获取可暴露给输入框的 coach skills | `backend/app/api/coach.py` |
| POST | `/api/coach/chat/stream` | 流式教练对话 | `backend/app/api/coach.py` |
| POST | `/api/coach/upload` | 上传附件，最大 10MB | `backend/app/api/coach_upload.py` |
| GET | `/api/coach/sessions` | 当前用户会话列表 | `backend/app/api/coach_sessions.py` |
| GET | `/api/coach/sessions/{session_id}` | 会话详情、消息、summary | `backend/app/api/coach_sessions.py` |
| DELETE | `/api/coach/sessions/{session_id}` | 删除当前用户会话 | `backend/app/api/coach_sessions.py` |

## 管理/观测后端端点

当前前端没有管理页面调用这些接口，但后端已挂载。

| 方法 | 路径 | 权限 | 说明 | 源码 |
|---|---|---|---|---|
| POST | `/api/coach/memory/mutations/{mutation_id}/rollback` | 管理员 | 回滚 memory mutation | `backend/app/api/coach_memory.py` |
| GET | `/api/coach/memory/mutations/{mutation_id}` | 管理员 | 获取单条 memory mutation | `backend/app/api/coach_memory.py` |
| GET | `/api/coach/memory/mutations` | 管理员 | mutation 列表，可按 student_id 过滤 | `backend/app/api/coach_memory.py` |
| POST | `/api/coach/cw/seed` | 管理员 | 初始化 Collective Wisdom 种子数据 | `backend/app/api/coach_cw.py` |
| GET | `/api/coach/cw/entities` | 管理员 | CW 实体分页 | `backend/app/api/coach_cw.py` |
| GET | `/api/coach/cw/relations` | 管理员 | CW 关系分页 | `backend/app/api/coach_cw.py` |
| GET | `/api/coach/cw/observations` | 管理员 | CW 观察分页 | `backend/app/api/coach_cw.py` |
| GET | `/api/coach/observability/dlq` | 管理员 | dead-letter 总览 | `backend/app/api/coach_observability.py` |
| GET | `/api/coach/observability/dlq/detail` | 管理员 | dead-letter 明细 | `backend/app/api/coach_observability.py` |
| GET | `/api/coach/observability/routing/hit-rates` | 管理员 | 路由命中率 | `backend/app/api/coach_observability.py` |
| GET | `/api/coach/observability/routing/logs` | 管理员 | 路由日志导出 | `backend/app/api/coach_observability.py` |
| GET | `/api/coach/observability/agent-accuracy` | 管理员 | agent 准确率 | `backend/app/api/coach_observability.py` |
| GET | `/api/coach/observability/prompt-versions` | 管理员 | prompt 版本列表 | `backend/app/api/coach_observability.py` |
| GET | `/api/coach/observability/prompt-versions/{agent}/current` | 管理员 | 指定 agent 当前 prompt | `backend/app/api/coach_observability.py` |

## 流式事件

| 事件 | 说明 |
|---|---|
| `run_start` | 开始一次运行，返回 `sessionId`、`assistantMessageId`、`activeAgent` |
| `step` | 运行轨迹步骤，`kind` 可为 `route`、`context`、`tool`、`memory`、`agent_switch`、`answer` |
| `answer_delta` | 回复增量文本 |
| `run_done` | 运行完成，返回 stop reason、session id、metrics |
| `run_error` | 运行失败，返回错误码、消息、是否可重试 |

## 后端子模块

| 模块 | 职责 |
|---|---|
| `backend/app/api/coach.py` | 技能列表、流式对话入口、附件上下文解析、selected skill 校验 |
| `backend/app/api/coach_upload.py` | 附件上传与存储 |
| `backend/app/api/coach_sessions.py` | 会话列表、详情、删除 |
| `backend/app/api/coach_memory.py` | 管理员 memory mutation 查询与回滚 |
| `backend/app/api/coach_cw.py` | Collective Wisdom 种子、实体、关系、观察查询 |
| `backend/app/api/coach_observability.py` | DLQ、路由指标、agent 准确率、prompt 版本 |
| `backend/app/services/coach_router.py` | L1/L1.5/L2/L3/L4 路由决策 |
| `backend/app/services/coach_coordinator.py` | agent 流式主循环、工具调用、记忆裁决、会话持久化 |
| `backend/app/services/coach_skills.py` | 斜杠能力元数据、证据和上下文 gating |
| `backend/app/services/tool_registry.py` | 22 个 coach 工具注册 |
| `backend/app/services/memory/**` | 会话摘要、记忆 mutation、裁决、回滚、CW |
| `backend/app/services/observability/**` | 路由、DLQ、准确率统计 |

## Coach 工具

| Agent | 工具 |
|---|---|
| `ResumeCoach` | `parse_resume`、`read_profile`、`analyze_gap`、`suggest_keyword` |
| `CareerMatchCoach` | `search_matches`、`compare_industries`、`search_company`、`save_to_shortlist`、`read_job_graph` |
| `LearningPathCoach` | `read_plan`、`suggest_resources`、`verify_and_record_progress`、`create_review` |
| `ReportCoach` | `read_report`、`generate_report`、`update_section`、`append_achievement`、`update_reflection`、`export_report` |
| `Shared` | `switch_agent`、`recall_memory`、`get_home_summary`、`process_memory_proposal` |

## 备注/状态

- `POST /api/coach/chat/stream` 返回 `application/x-ndjson`，不是 `text/event-stream`。
- 上传后端实际允许 PDF、DOC、DOCX、PNG、JPEG、CSV、Markdown、TXT，最大 10MB；错误信息里只列了 PDF/DOC/DOCX/PNG/JPG。
- `memory`、`cw`、`observability` 接口是管理员权限，当前没有前端管理页面。

