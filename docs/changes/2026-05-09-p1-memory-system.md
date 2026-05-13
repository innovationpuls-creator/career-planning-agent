# 2026-05-09 P1 记忆系统与会话持久化

## 概述

在 P0（流式对话 + 路由 + ToolRegistry）基础上，P1 增加了记忆系统、会话持久化和前端会话恢复能力。

## 新增文件

### 后端模型

| 文件 | 说明 |
|------|------|
| `backend/app/models/coach.py` | 7 个 SQLAlchemy ORM 模型：`ConversationSummary`, `CoachSession`, `CoachMessage`, `MemoryMutation`, `DecisionJournal`, `CompetencyHistory`, `FeedbackRecord` |

### 记忆服务

| 文件 | 说明 |
|------|------|
| `backend/app/services/memory/__init__.py` | 包初始化 |
| `backend/app/services/memory/models.py` | Pydantic 模型：`ConversationSummaryV1_1`, `MemoryMutationProposal`, `AdjudicationResult`, `SessionResponse`, `MessageResponse`, `SessionDetailResponse` |
| `backend/app/services/memory/adjudicator.py` | `adjudicate()` 纯函数——裁决记忆变更提案 |
| `backend/app/services/memory/manager.py` | `MemoryManager` 类——会话 CRUD、消息持久化、对话摘要读写、提案裁决-提交 |

### 后端 API

| 文件 | 说明 |
|------|------|
| `backend/app/api/coach_deps.py` | `verify_student_session()` FastAPI 公共依赖，校验会话所有权 |
| `backend/app/api/coach_sessions.py` | 3 个 REST 端点：`GET/POST/DELETE /api/coach/sessions` |

### 后端测试

| 文件 | 说明 |
|------|------|
| `backend/tests/services/memory/test_adjudicator.py` | 5 个裁决器单元测试 |
| `backend/tests/services/memory/test_memory_manager.py` | 13 个 MemoryManager 集成测试（内存 SQLite） |
| `backend/tests/api/test_coach_sessions.py` | 5 个会话 CRUD 集成测试（含全流程：发消息→创建会话→列表→详情→删除） |

### 前端

| 文件 | 说明 |
|------|------|
| `myapp/src/pages/coach/hooks/useSessionRecovery.ts` | 从 URL `?session_id=` 加载历史会话的 hook |
| `myapp/src/pages/coach/__tests__/useSessionRecovery.test.ts` | 3 个会话恢复 hook 测试 |

## 修改文件

### 后端

| 文件 | 改动 |
|------|------|
| `backend/app/models/__init__.py` | 导入 7 个 coach 模型并加入 `__all__` |
| `backend/app/main.py` | `init_db()` 模型元组加入 7 个模型；注册 `coach_sessions_router` |
| `backend/app/schemas/agent.py` | `CoachChatRequest` 新增 `session_id` 字段；新增 4 个会话响应模型 |
| `backend/app/services/context_builder.py` | `build_system_prompt()` 新增可选 `conversation_summary` 参数，注入对话历史摘要 |
| `backend/app/services/coach_coordinator.py` | 构造函数新增 `memory_manager`/`student_id`/`session_id` 参数；`run()` 中持久化用户消息和助手回复；`done` 事件携带 `session_id` |
| `backend/app/api/coach.py` | 集成 MemoryManager（会话创建/恢复、摘要加载、对话摘要持久化）；依赖 `get_db` |
| `backend/tests/test_coach.py` | `done` 事件断言新增 `session_id` 字段检查 |
| `backend/tests/services/test_context_builder.py` | 新增 2 个对话摘要注入测试 |

### 前端

| 文件 | 改动 |
|------|------|
| `myapp/src/pages/coach/api.ts` | `CoachChatStreamEvent` 新增 `session_id`；`streamCoachChat` 新增 `sessionId` 参数；新增 3 个会话 CRUD 函数和类型 |
| `myapp/src/pages/coach/hooks/useCoachChat.ts` | 新增 `UseCoachChatOptions`；支持 `initialMessages` 和 `initialSessionId`；`sendMessage` 传递 `sessionId`；`done` 事件更新 URL 的 `?session_id=` |
| `myapp/src/pages/coach/index.tsx` | 集成 `useSessionRecovery`；加载时显示 Spin；错误时显示 Alert |

## 数据库变更

新增 7 张 SQLite 表（通过 `Base.metadata.create_all` 自动创建）：

| 表 | PK | 用途 |
|------|------|------|
| `coach_sessions` | `id: String(36) UUID` | 会话元信息（标题、活跃 agent、消息计数） |
| `coach_messages` | `id: Integer auto` | 会话消息（role/content/agent/tool_calls_json） |
| `conversation_summaries` | `student_id: Integer` | 学生对话摘要 JSON |
| `memory_mutations` | `id: Integer auto` | 记忆变更提案与裁决记录 |
| `decision_journal` | `id: Integer auto` | 裁决日志 |
| `competency_history` | `id: Integer auto` | 技能成长时间线 |
| `feedback_records` | `id: Integer auto` | 用户反馈记录 |

## 验证结果

| 指标 | 结果 |
|------|------|
| 后端全部测试 | 276/277 通过（1 个预存失败） |
| 教练相关测试 | 57/57 通过 |
| 前端 TypeScript | 编译通过 |
| 前端测试 | 10/10 通过 |
| 无回归 | P0 P0a/P0b/P0c 全部验收标准仍通过 |

## 已知问题

- `competency_history` 和 `feedback_records` 表已创建，但写入逻辑在后续 Phase（P2/P4）中实现
- Prompt caching 未实现（原因：LLM 后端为 OpenAI 兼容 API，不支持 Anthropic 的 `anthropic-beta` header）
