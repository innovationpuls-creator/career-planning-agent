# P1：记忆系统 + 会话恢复

> 日期：2026-05-08
> 基于：[AI 教练智能体系统设计](../specs/2026-05-08-coach-agent-design.md)、[P0 三阶段实现计划](./2026-05-08-coach-p0-implementation-plan.md)
> 前提：P0c 全部验收标准通过
> 原则：增量构建于 P0c 代码之上，不做 P0 功能的回归改动。

---

## 1. 目标

1. **Memory System**：创建核心 SQLite 表 + MemoryManager CRUD + Adjudicator 裁决逻辑，实现 propose→adjudicate→commit 完整链路
2. **ConversationSummary 持久化**：每轮对话后保存学生能力画像，下次加载时恢复
3. **会话持久化**：保存完整对话 transcript 到 `coach_messages` 表
4. **Session CRUD 端点**：提供列表/详情/删除 API
5. **前端会话恢复**：关闭页面后通过 URL `?session_id=xxx` 恢复历史消息和记忆

**验收终极标准**：学生关闭页面，重新打开 `/coach?session_id=xxx`，对话历史完整恢复，AI 能从 ConversationSummary 中"记得"之前收集到的学生信息。

---

## 2. 非目标

- 不做 Outbox 事件总线、Dead Letter Queue（P2）
- 不做 mutation_gated 工具接入（P2 首个工具 `verify_and_record_progress`）
- 不做 competency_history 时间线写入逻辑（P2，由 mutation_gated 工具首次写入时触发）
- 不做 feedback_records 写入逻辑（P4 补充 `record_feedback()` 服务，P1 仅创建表结构）
- 不做 Qdrant 向量记忆召回（P2/P5）
- 不做记忆回滚（P4）
- 不做 Collective Wisdom 表 cw_entities/relations/observations（P5）
- 不做 ThinkingBlock 动画、侧边栏、文件上传（P3）
- 不改现有 66 个 REST 端点
- 不改现有 ChatStream（简历解构页内嵌）

---

## 3. 架构变更

### 3.1 新增组件

```
POST /api/coach/chat/stream  ← P0c 已有
  └── CoachCoordinator.run()
        ├── load session transcript (P1 新增)
        ├── load ConversationSummary → ContextBuilder (P1 新增)
        ├── LLM loop (P0c 已有)
        └── save ConversationSummary + save transcript (P1 新增)

GET  /api/coach/sessions        ← P1 新增
GET  /api/coach/sessions/:id   ← P1 新增
DELETE /api/coach/sessions/:id ← P1 新增
```

### 3.2 记忆系统数据流

```
MemoryManager
  ├── read_conversation_summary(student_id) → ConversationSummaryV1_1
  │     └── 从 conversation_summaries 表读取 JSON
  │
  ├── persist_conversation_summary(student_id, summary) → None
  │     └── UPSERT 到 conversation_summaries 表
  │
  └── propose_memory_mutation(proposal) → MemoryMutationRecord
        └── adjudicate() → decision_journal 写入 → commit_memory_mutation()
              ├── confirmed → 更新 conversation_summaries 主字段
              ├── provisional → 写入 provisional_overlays
              └── rejected → 仅写 memory_mutations + decision_journal
```

### 3.3 会话存储

```
coach_sessions 表           coach_messages 表
┌──────────────────┐       ┌──────────────────────┐
│ id (PK)          │←──┐  │ id (PK)              │
│ student_id       │   └──│ session_id (FK)      │
│ title            │      │ role (user/assistant) │
│ active_agent     │      │ content              │
│ pipeline_stage   │      │ client_message_id    │
│ message_count    │      │ active_agent         │
│ created_at       │      │ tool_calls_json      │
│ updated_at       │      │ created_at           │
└──────────────────┘      └──────────────────────┘
```

---

## 4. 数据库迁移

### 4.1 新增 7 张 SQLite 表

按项目现有模式：在 `backend/app/models/coach.py` 中定义 SQLAlchemy ORM 模型，在 `init_db()` 的 model 元组中引用以触发 `Base.metadata.create_all`。

#### 表 A：`conversation_summaries`

```sql
CREATE TABLE conversation_summaries (
    student_id TEXT PRIMARY KEY,
    summary_json TEXT NOT NULL,        -- ConversationSummaryV1_1.model_dump_json()
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### 表 B：`coach_sessions`

```sql
CREATE TABLE coach_sessions (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '新对话',
    active_agent TEXT,
    pipeline_stage TEXT,
    message_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_student ON coach_sessions(student_id, updated_at);
```

#### 表 C：`coach_messages`

```sql
CREATE TABLE coach_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES coach_sessions(id),
    role TEXT NOT NULL,                -- 'user' | 'assistant' | 'system'
    content TEXT NOT NULL,
    client_message_id TEXT,
    active_agent TEXT,
    tool_calls_json TEXT,              -- assistant 消息的工具调用序列化 JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_messages_session ON coach_messages(session_id, created_at);
```

#### 表 D：`memory_mutations`

```sql
CREATE TABLE memory_mutations (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    source_idempotency_key TEXT NOT NULL,
    source_event_id TEXT,
    trace_id TEXT,
    target_table TEXT NOT NULL,
    target_field TEXT NOT NULL,
    overlay_target INTEGER NOT NULL DEFAULT 0,
    old_value TEXT,
    new_value TEXT,
    evidence TEXT,
    source_agent TEXT NOT NULL,
    confidence REAL NOT NULL,
    decision_type TEXT NOT NULL,        -- auto_confirmed | provisional_write | rejected
    rollback_of TEXT REFERENCES memory_mutations(id),
    rolled_back_by TEXT REFERENCES memory_mutations(id),
    rollback_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(student_id, target_table, target_field, source_idempotency_key)
);
CREATE INDEX idx_mutations_student ON memory_mutations(student_id);
CREATE INDEX idx_mutations_idempotency ON memory_mutations(source_idempotency_key);
```

#### 表 E：`decision_journal`

```sql
CREATE TABLE decision_journal (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    decision_type TEXT NOT NULL,
    proposal_json TEXT NOT NULL,
    adjudication_result TEXT NOT NULL,
    reasoning TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_journal_student ON decision_journal(student_id);
```

#### 表 F：`competency_history`

```sql
CREATE TABLE competency_history (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    mastery_status TEXT NOT NULL,
    memory_status TEXT NOT NULL,
    confidence REAL NOT NULL,
    evidence TEXT,
    source TEXT NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_comp_history_student ON competency_history(student_id, skill_id);
CREATE INDEX idx_comp_history_time ON competency_history(recorded_at);
```

用途：按时间线记录每项技能的每次变更，支持技能成长轨迹可视化。每次 mutation_gated 工具提交的技能变更（confirm/provisional）均追加一条记录。

#### 表 G：`feedback_records`

```sql
CREATE TABLE feedback_records (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    trace_id TEXT,
    session_id TEXT,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    sentiment TEXT NOT NULL,
    feedback_text TEXT,
    source TEXT NOT NULL,
    compensation_status TEXT NOT NULL DEFAULT 'none',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_feedback_student ON feedback_records(student_id);
CREATE INDEX idx_feedback_target ON feedback_records(student_id, target_type, target_id, created_at);
```

用途：独立存储用户反馈，不嵌入 ConversationSummary JSON。P4 基于此表计算 Agent 准确率。

### 4.2 回滚迁移

从 `init_db()` 的 model 元组中移除 7 个 model 引用，删除 `models/coach.py`，手动 `DROP TABLE` 回退。

---

## 5. 新增文件

### 后端（10 文件）

| # | 文件 | 职责 |
|---|------|------|
| 1 | `backend/app/api/coach_deps.py` | **P1 新增** — `verify_student_session()` FastAPI 公共 Depends：校验 `session.student_id == current_user.id`，所有 `/api/coach/*` 端点共享 |
| 2 | `backend/app/models/coach.py` | 7 个 SQLAlchemy ORM 模型 |
| 3 | `backend/app/services/memory/__init__.py` | 空包初始化 |
| 4 | `backend/app/services/memory/models.py` | Pydantic 模型 + 枚举 |
| 5 | `backend/app/services/memory/manager.py` | MemoryManager 类 |
| 6 | `backend/app/services/memory/adjudicator.py` | `adjudicate()` 纯函数 |
| 7 | `backend/app/api/coach_sessions.py` | 3 个 REST 端点（依赖 `verify_student_session`） |
| 8 | `backend/tests/services/memory/test_adjudicator.py` | Adjudicator 单元测试 |
| 9 | `backend/tests/services/memory/test_memory_manager.py` | MemoryManager 集成测试 |
| 10 | `backend/tests/api/test_coach_sessions.py` | 会话 CRUD 集成测试 |

### 前端（3 文件）

| # | 文件 | 职责 |
|---|------|------|
| 1 | `myapp/src/pages/coach/api.ts` | 追加：`listSessions()`, `getSession()`, `deleteSession()` |
| 2 | `myapp/src/pages/coach/hooks/useSessionRecovery.ts` | 加载历史消息并初始化 chat state |

**`useSessionRecovery` 接口：**

```typescript
interface UseSessionRecoveryResult {
  isLoading: boolean;
  recoveredMessages: ChatMessage[] | null;  // null = 无会话需要恢复
  sessionId: string | null;
  error: string | null;
}

function useSessionRecovery(sessionId?: string): UseSessionRecoveryResult
```

**与 `useCoachChat` 的集成点**：`useCoachChat` 新增 `initialMessages?: ChatMessage[]` 参数。`index.tsx` 从 URL 读取 `?session_id=`，传入 `useSessionRecovery` 获取 `recoveredMessages`，再传入 `useCoachChat({ initialMessages: recoveredMessages })`。
| 3 | `myapp/src/pages/coach/__tests__/useSessionRecovery.test.ts` | 会话恢复 hook 单元测试 |

---

## 6. 修改文件

### 后端（5 文件）

| # | 文件 | 改动 |
|---|------|------|
| 1 | `backend/app/main.py` | `init_db()` 引用 7 个新 model；注册 `coach_sessions_router` |
| 2 | `backend/app/services/coach_coordinator.py` | 新增 `_load_memory`/`_save_memory`/`_save_transcript` 步骤；引用 MemoryManager |
| 3 | `backend/app/services/context_builder.py` | `build()` 接收可选 `conversation_summary` 参数；`_format_hard_memory()` 将 summary 格式化为 Markdown 注入 system prompt |
| 4 | `backend/app/api/coach.py` | 初始化 MemoryManager 实例并传入 CoachCoordinator |
| 5 | `backend/app/schemas/agent.py` | 新增 `CoachSessionSummary`/`CoachSessionDetail` Pydantic 模型 |

### 前端（3 文件）

| # | 文件 | 改动 |
|---|------|------|
| 1 | `myapp/src/pages/coach/index.tsx` | 页面加载时检查 `?session_id=` URL 参数；调用 `useSessionRecovery()` 恢复会话；渲染历史消息 |
| 2 | `myapp/src/pages/coach/hooks/useCoachChat.ts` | `sendMessage()` 成功后更新会话 ID；`newSession()` 清除历史 |
| 3 | `myapp/src/pages/coach/api.ts` | 追加会话 CRUD 函数 |

---

## 7. API 契约变更

### 7.1 新增 3 个 REST 端点

```
GET /api/coach/sessions
Authorization: Bearer <token>
---
响应 200:
{
  "data": [
    {
      "id": "session_xxx",
      "title": "简历分析对话",
      "activeAgent": "ResumeCoach",
      "messageCount": 5,
      "createdAt": 1715123456,
      "updatedAt": 1715123556
    }
  ]
}
```

```
GET /api/coach/sessions/:id
Authorization: Bearer <token>
---
响应 200:
{
  "data": {
    "id": "session_xxx",
    "title": "简历分析对话",
    "activeAgent": "ResumeCoach",
    "pipelineStage": "resume",
    "messageCount": 5,
    "messages": [
      {
        "id": "msg_001",
        "role": "user",
        "content": "帮我分析简历",
        "clientMessageId": "cm_001",
        "activeAgent": null,
        "toolCalls": null,
        "createdAt": 1715123456
      },
      {
        "id": "msg_002",
        "role": "assistant",
        "content": "好的，我来分析你的简历...",
        "activeAgent": "ResumeCoach",
        "toolCalls": [],
        "createdAt": 1715123460
      }
    ],
    "summary": {
      "skills": {},
      "currentStage": "resume"
    },
    "createdAt": 1715123450,
    "updatedAt": 1715123556
  }
}
```

```
DELETE /api/coach/sessions/:id
Authorization: Bearer <token>
---
响应 204 No Content
```

### 7.2 错误响应

```json
{ "error": { "code": "SESSION_NOT_FOUND", "detail": "会话不存在或已删除" } }
```

错误码：`SESSION_NOT_FOUND` (404)、`SESSION_ACCESS_DENIED` (403)

### 7.3 学生隔离

所有 session 端点校验 `session.student_id == current_user.id`。查询时加 `WHERE student_id = ?` 过滤。

#### verify_student_session 共享依赖

```python
# backend/app/api/coach_deps.py

async def verify_student_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncConnection = Depends(get_db),
):
    """FastAPI 公共 Depends：所有 /api/coach/* 端点共享"""
    row = await db.fetchone(
        "SELECT student_id FROM coach_sessions WHERE id = ?",
        (session_id,)
    )
    if not row:
        raise HTTPException(status_code=404, detail="会话不存在")
    if row["student_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此会话")
    return row
```

所有后续新增的 `/api/coach/*` 端点（session CRUD、upload、memory management 等）统一使用该依赖，不重复编写校验逻辑。

```python
# coach_sessions.py 使用示例
@router.get("/coach/sessions/{session_id}")
async def get_session(
    session_id: str,
    session=Depends(verify_student_session),
    db=Depends(get_db),
):
    """会话详情 — 已在 verify_student_session 中完成了 student_id 校验"""
    ...
```

### 7.4 P0c NDJSON 事件不变

P1 不新增 NDJSON 事件类型。

---

## 8. 实现详情

### 8.1 MemoryManager

```python
class MemoryManager:
    async def read_conversation_summary(self, student_id: str) -> ConversationSummaryV1_1:
        """读取学生 ConversationSummary，不存在时返回默认空摘要"""
        row = await db.fetchone(
            "SELECT summary_json FROM conversation_summaries WHERE student_id = ?",
            (student_id,)
        )
        if row:
            return ConversationSummaryV1_1.model_validate_json(row[0])
        return ConversationSummaryV1_1()

    async def persist_conversation_summary(
        self, student_id: str, summary: ConversationSummaryV1_1
    ) -> None:
        """UPSERT"""
        await db.execute(
            """INSERT INTO conversation_summaries (student_id, summary_json)
               VALUES (?, ?)
               ON CONFLICT(student_id) DO UPDATE SET
                 summary_json = excluded.summary_json,
                 updated_at = datetime('now')""",
            (student_id, summary.model_dump_json())
        )

    async def propose_memory_mutation(
        self, proposal: MemoryMutationProposal
    ) -> MemoryMutationRecord:
        """propose → adjudicate → commit"""
        record = await adjudicate(proposal)
        if record.decision_type != DecisionType.REJECTED:
            await self._commit_mutation(record)
        return record

    async def _commit_mutation(self, record: MemoryMutationRecord) -> None:
        """confirmed → 主字段更新, provisional → provisional_overlays"""
        summary = await self.read_conversation_summary(record.student_id)
        if record.overlay_target:
            # 使用复合 key 避免同一字段被多个 agent 的 provisional 写入互相覆盖
            overlay_key = f"{record.target_field}::{record.source_agent}"
            summary.provisional_overlays[overlay_key] = ProvisionalOverlay(
                field_path=record.target_field,
                proposed_value=json.loads(record.new_value),
                confidence=record.confidence,
                source=record.source_agent,
            )
        else:
            self._apply_field_update(summary, record.target_field,
                                      json.loads(record.new_value))
        await self.persist_conversation_summary(record.student_id, summary)
```

### 8.2 Adjudicator（纯函数）

9 种裁决结果：

| risk_level | confidence | decision_type | 说明 |
|------------|-----------|---------------|------|
| low | ≥ 0.95 | auto_confirmed | 直接写入主字段 |
| low | 0.80–0.95 | provisional_write | 写入 provisional_overlays |
| low | < 0.80 | rejected | |
| medium | ≥ 0.95 | provisional_write | capped |
| medium | 0.80–0.95 | provisional_write | |
| medium | < 0.80 | rejected | |
| high | ≥ 0.95 | provisional_write | capped |
| high | 0.80–0.95 | provisional_write | |
| high | < 0.80 | rejected | |

额外：provisional 覆盖已有 confirmed 记录时 → overlay_target = True。

### 8.3 CoachCoordinator 集成

```python
class CoachCoordinator:
    async def run(self, ...) -> AsyncGenerator:
        # 加载 ConversationSummary（P1 新增）
        summary = await self.memory_manager.read_conversation_summary(student_id)

        # 加载会话历史（P1 新增）
        self._load_session_messages(context)

        # ContextBuilder 注入记忆
        system_prompt = self.context_builder.build(
            conversation_summary=summary,  # P1 新增参数
            ...
        )

        # LLM 循环（P0c 已有）
        ...

        # 保存 ConversationSummary（P1 新增）
        summary.current_stage = context.active_agent
        await self.memory_manager.persist_conversation_summary(student_id, summary)

        # 保存 transcript（P1 新增）
        await self._save_transcript(context)
```

### 8.4 ContextBuilder 增强

`build()` 接收可选 `conversation_summary` 参数。存在时在 system prompt 末尾注入：

```
## 学生档案
- 姓名: 张三
- 专业: 计算机科学
- 技能: Python(mastered), Java(in_progress)

## 当前阶段: resume
```

### 8.5 会话存储逻辑

每次 `POST /api/coach/chat/stream` 完成后：
1. 用户消息插入 `coach_messages`（role=user）
2. assistant 回复插入 `coach_messages`（role=assistant, tool_calls_json）
3. 更新 `coach_sessions.message_count`
4. 首次消息时自动生成会话标题（取前 20 字）

---

## 9. 测试文件

### 9.1 Adjudicator 单元测试（`test_adjudicator.py`）

| 测试 | 断言 |
|------|------|
| `test_low_risk_high_confidence_auto_confirmed` | decision_type == AUTO_CONFIRMED |
| `test_low_risk_medium_confidence_provisional` | decision_type == PROVISIONAL_WRITE |
| `test_low_risk_low_confidence_rejected` | decision_type == REJECTED |
| `test_high_risk_capped_at_provisional` | decision_type == PROVISIONAL_WRITE |
| `test_medium_risk_capped_at_provisional` | decision_type == PROVISIONAL_WRITE |
| `test_provisional_blocked_by_confirmed_writes_overlay` | overlay_target == True |
| `test_apply_field_update_mixed_path` | 正确更新嵌套字段 |

### 9.2 MemoryManager 集成测试（`test_memory_manager.py`）

| 测试 | 场景 |
|------|------|
| `test_read_default_when_empty` | 无记录返回空默认值 |
| `test_roundtrip_persist_and_read` | 写入→读取一致性 |
| `test_mutation_auto_confirmed_flow` | propose→commit 链路 |

### 9.3 会话 CRUD 集成测试（`test_coach_sessions.py`）

| 测试 | 场景 |
|------|------|
| `test_list_sessions` | 返回当前学生会话列表 |
| `test_get_session_detail` | 返回会话+消息 |
| `test_get_session_not_found` | 404 |
| `test_delete_session` | 204 |
| `test_student_isolation` | A 不能访问 B 的会话 → 403 |

### 9.4 前端测试（`useSessionRecovery.test.ts`）

| 测试 | 场景 |
|------|------|
| `loads_session_messages_on_mount` | sessionId 存在时加载消息 |
| `new_session_when_no_session_id` | 空白会话 |
| `handles_session_load_error` | 错误处理 |

---

## 10. 验收标准

1. **记忆持久化**：同一学生两次对话间 AI 能"记得"之前的信息（专业、年级等）
2. **会话恢复**：`/coach?session_id=xxx` 打开，历史消息完整渲染，可继续对话
3. **会话列表**：`GET /api/coach/sessions` 返回该学生最近的会话列表
4. **会话详情**：`GET /api/coach/sessions/:id` 返回会话信息和消息数组
5. **会话删除**：删除后 404，列表不再显示
6. **学生隔离**：学生 A 看不到学生 B 的会话
7. **Adjudicator 正确性**：全部 9 种组合输出正确的 decision_type
8. **冲突检测**：provisional 覆盖已 confirmed 时写入 overlay 而非拒绝
9. **P0c 无回归**：delta/route/tool_call/tool_result/done/error 事件流正常
10. **新学生首次对话不报错**：ConversationSummary 返回空默认值

---

## 11. 验收命令

```bash
# Adjudicator
cd backend && python -m pytest tests/services/memory/test_adjudicator.py -v

# MemoryManager
cd backend && python -m pytest tests/services/memory/test_memory_manager.py -v

# 会话 CRUD
cd backend && python -m pytest tests/api/test_coach_sessions.py -v

# P0 回归
cd backend && python -m pytest tests/api/test_coach.py -v

# 前端
cd myapp && npx tsc --noEmit
cd myapp && npx jest src/pages/coach --coverage

# 人工验证
# 1. /coach?step=resume 发送"我是计算机专业大三学生"
# 2. 刷新页面发送"你还记得我的专业吗？" → AI 应提及计算机专业
# 3. /coach?session_id=<ID> → 历史消息可见
```

---

## 12. 回滚方案

- 从 `init_db()` 移除 5 个 model 引用，删除 `models/coach.py`
- 取消注册 `coach_sessions_router`，删除 `services/memory/`
- 前端删除 `useSessionRecovery.ts`，移除 session_id 加载逻辑
- MemoryManager 返回空默认值，系统退化为 P0c 行为

---

## 13. 进入 P2 的条件

- [ ] 全部 10 项验收标准通过
- [ ] Adjudicator 测试覆盖率 ≥ 90%
- [ ] P0c 验收标准无回归
- [ ] 前端 tsc + jest 全部绿
- [ ] 手动验证：多轮对话后刷新 → 历史消息和记忆恢复

---

## 14. 文件变更对照

| 文件 | P0a | P0b | P0c | P1 | 类型 |
|------|:---:|:---:|:---:|:---:|------|
| `models/coach.py` | — | — | — | 新增 | Model |
| `services/memory/__init__.py` | — | — | — | 新增 | Pkg |
| `services/memory/models.py` | — | — | — | 新增 | Schema |
| `services/memory/manager.py` | — | — | — | 新增 | Service |
| `services/memory/adjudicator.py` | — | — | — | 新增 | Service |
| `api/coach_sessions.py` | — | — | — | 新增 | API |
| `tests/services/memory/test_adjudicator.py` | — | — | — | 新增 | Test |
| `tests/services/memory/test_memory_manager.py` | — | — | — | 新增 | Test |
| `tests/api/test_coach_sessions.py` | — | — | — | 新增 | Test |
| `pages/coach/hooks/useSessionRecovery.ts` | — | — | — | 新增 | Hook |
| `pages/coach/__tests__/useSessionRecovery.test.ts` | — | — | — | 新增 | Test |
| `api/coach.py` | 新增 | 修改 | 修改 | 修改 | API |
| `schemas/agent.py` | 新增 | 修改 | 修改 | 修改 | Schema |
| `services/coach_coordinator.py` | — | — | 新增 | 修改 | Service |
| `services/context_builder.py` | — | 新增 | — | 修改 | Service |
| `main.py` | 修改 | — | — | 修改 | Config |
| `pages/coach/index.tsx` | 新增 | 修改 | 修改 | 修改 | Page |
| `pages/coach/api.ts` | 新增 | 修改 | 修改 | 修改 | API |
| `hooks/useCoachChat.ts` | 新增 | 修改 | 修改 | 修改 | Hook |

---

## 15. 风险与应对

| 风险 | 应对 |
|------|------|
| ConversationSummary JSON 结构跨版本不兼容 | `conversation_summaries.schema_version` 字段已存在，后续 Phase 按版本号走迁移逻辑 |
| 并发写入覆盖记忆 | UNIQUE 约束防重复，P2 完善幂等 |
| 大量消息撑爆 coach_messages | 单会话上限 200 条，超限压缩旧消息 |
| session_id 泄漏导致跨学生访问 | 后端强制校验 student_id |
