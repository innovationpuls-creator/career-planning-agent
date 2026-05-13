# P2b：全套工具集成 + 事件总线

> 日期：2026-05-08
> 基于：[AI 教练智能体系统设计](../specs/2026-05-08-coach-agent-design.md)、[P2 可信记忆层实现计划](./2026-05-08-coach-p2-implementation-plan.md)
> 前提：P2 全部验收标准通过
> 原则：增量构建于 P0–P2 代码之上，不改已实现功能。P2b 补齐 spec P2 中工具对接和事件总线部分。

---

## 1. 目标

将 P2 的可信记忆层扩展为完整的工具集成层：注册全部 22 个工具、对接现有 REST API、引入 Outbox 事件总线 + Background Worker + 级联白名单。

**一句话：P2 让记忆可信，P2b 让工具可用、事件可达。**

核心变化：

| P2 (可信记忆) | P2b (工具集成+事件总线) |
|-------------|---------------------|
| 仅 `process_memory_proposal` 一个 mutation_gated 工具 | 22 个工具全部注册可用（14 readonly + 4 mutation_safe + 3 mutation_gated + 1 internal） |
| 无真实 API 对接 | 18 个工具对接现有 REST 端点 |
| 无 Outbox | `outbox_events` 表 + OutboxEmitter + BackgroundWorker |
| 无级联事件 | `skill_mastered → [ReportCoach, ResumeCoach]` + `goal_reached → [ReportCoach]` |
| ToolRegistry 仅有 classification 概念 | classification 驱动不同执行路径（readonly/safe/gated） |

---

## 2. 非目标

- 不做 Dead Letter Queue 监控（P4）
- 不做路由命中率仪表盘（P4）
- 不做 Agent 准确率追踪（P4）
- 不做回滚端到端测试（P4）
- 不做 CollectiveWisdom 数据填充（P5）
- 不做 L3 BERT 路由训练（P5）
- 不做 Prompt 优化（P5）
- 不做 5 个缺失端点补全（P5）
- 不做 feedback_records 表（P2 已存在 DDL，P2b 不启用）
- 不做 competency_history 时间线（P2 已处理）
- 不改 P0–P2 已有功能逻辑
- 不改现有 66 个 REST 端点（工具是对它们的封装调用，不修改端点本身）
- 不修改 Adjudicator 裁决逻辑（P2 已冻结）

---

## 3. 数据库迁移

### 3.1 新增 1 张表

**表 F：`outbox_events`**

```sql
CREATE TABLE outbox_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',   -- pending | processing | delivered | failed_retryable | dead_letter
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TEXT,
    locked_at TEXT,
    locked_by TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    delivered_at TEXT
);
CREATE INDEX idx_outbox_status ON outbox_events(status, next_retry_at);
CREATE UNIQUE INDEX idx_outbox_idempotency ON outbox_events(idempotency_key);
```

状态机：`pending → processing → delivered`（成功）或 `pending → processing → failed_retryable → pending`（重试）或 `failed_retryable → dead_letter`（3 次失败后）。

### 3.2 已有表复用

| 表 | P2 状态 | P2b 变化 |
|----|:-------:|---------|
| `conversation_summaries` | 读写 | 不变 |
| `coach_sessions` | 读写 | 不变 |
| `coach_messages` | 读写 | 不变 |
| `memory_mutations` | 读写 | `verify_and_record_progress` 等新工具写入 |
| `decision_journal` | 读写 | 同上 |

### 3.3 回滚迁移

从 `init_db()` model 元组中移除 `OutboxEvent` model，手动 `DROP TABLE outbox_events`。

---

## 4. 后端文件级计划

### 4.1 新增文件（5 个）

| # | 文件 | 职责 |
|---|------|------|
| 1 | `backend/app/services/outbox/__init__.py` | 空包初始化 |
| 2 | `backend/app/services/outbox/emitter.py` | `OutboxEmitter.emit_event()` — 幂等写入 `outbox_events` 表；`CASCADE_WHITELIST` 常量定义 |
| 3 | `backend/app/services/outbox/worker.py` | `BackgroundWorker` — 轮询 pending 事件 → 投递到目标 Agent → 更新状态（指数退避，最多 3 次） |
| 4 | `backend/app/services/tools/executor.py` | `ToolExecutor` — `execute_with_recovery()` 含指数退避重试（3 次），区分 readonly/safe/gated 执行路径 |
| 5 | `backend/app/services/tools/handlers.py` | 全部 22 个工具的 handler 函数 + `readonly_api_handler` 工厂 |

### 4.2 修改文件（5 个）

| # | 文件 | 改动 |
|---|------|------|
| 1 | `backend/app/services/tool_registry.py` | 新增 `register_all_tools()` — 批量注册 22 个工具；Tool 类增加 `endpoint`/`method` 字段 |
| 2 | `backend/app/services/coach_coordinator.py` | `run()` 结束时调用 `outbox_emitter.emit_event()` 触发热事件（如果本轮产生了 mutation_gated success） |
| 3 | `backend/app/models/coach.py` | 新增 `OutboxEvent` SQLAlchemy ORM 模型 |
| 4 | `backend/app/api/coach.py` | 初始化时调用 `register_all_tools()`；注入 OutboxEmitter 和 BackgroundWorker |
| 5 | `backend/app/main.py` | `init_db()` 引用 `OutboxEvent` model；启动 BackgroundWorker（asyncio background task） |

---

## 5. 前端文件级计划

**P2b 不改前端。** 22 个工具全部通过已有 `tool_call` / `tool_result` NDJSON 事件流呈现，ToolCallCard（P0c）即可展示。`memory_result` 事件（P2）覆盖 mutation_gated 工具的结果通知。

---

## 6. API 契约变化

### 6.1 NDJSON 事件

无新增事件类型。工具调用走已有 `tool_call → tool_result`，mutation_gated 工具额外产生 `memory_result`（P2 已定义）。

### 6.2 REST 端点

无新增 REST 端点。

---

## 7. 22 工具完整注册表

### 7.1 工具分类与执行路径

```
readonly         → readonly_api_handler(endpoint, method, args, context)
                    → 调用现有 REST API → 返回 ToolResult(summary + detail)

mutation_safe    → 专用 handler(args, context)
                    → 调用现有 POST/PUT API → 返回 ToolResult

mutation_gated   → handler(args, context)
                    → propose → adjudicate → commit（P2 已有链路）
                    → 成功时 emit 级联事件
```

### 7.2 ResumeCoach（4 工具）

| 工具名 | 中文名 | 分类 | 端点 | method |
|--------|--------|------|------|--------|
| `parse_resume` | 解析简历 | readonly | `/api/student-competency-profile/chat/stream` | POST |
| `read_profile` | 读取能力画像 | readonly | `/api/student-competency-profile/runtime` | GET |
| `analyze_gap` | 简历目标差距分析 | readonly | `/api/career-development-report/personal-growth-report` | POST |
| `suggest_keyword` | 建议关键词 | readonly | `/api/student-competency-profile/latest-analysis` | GET |

### 7.3 CareerMatchCoach（5 工具）

| 工具名 | 中文名 | 分类 | 端点 | method |
|--------|--------|------|------|--------|
| `search_matches` | 搜索匹配岗位 | readonly | `/api/job-exploration-match` | GET |
| `compare_industries` | 同岗行业对比 | readonly | `/api/job-requirement-profile/vertical` | GET |
| `search_company` | 搜索公司 | readonly | `/api/jobs` | GET |
| `save_to_shortlist` | 收藏到入围名单 | mutation_safe | `/api/career-development/favorites` | POST |
| `read_job_graph` | 读取岗位能力图谱 | readonly | `/api/job-requirement-profile/overview` | GET |

### 7.4 LearningPathCoach（4 工具）

| 工具名 | 中文名 | 分类 | 端点 | method |
|--------|--------|------|------|--------|
| `read_plan` | 读取学习计划 | readonly | `/api/career-development-report/learning-path` | GET |
| `suggest_resources` | 推荐学习资源 | readonly | `/api/career-development-report/goal-setting-path-planning` | POST |
| `verify_and_record_progress` | 验证记录进度 | **mutation_gated** | Memory System | — |
| `create_review` | 创建复盘 | mutation_safe | `/api/snail-learning-path/reviews` | POST |

### 7.5 ReportCoach（6 工具）

| 工具名 | 中文名 | 分类 | 端点 | method |
|--------|--------|------|------|--------|
| `read_report` | 读取报告草稿 | readonly | `/api/career-development-report/personal-growth-report` | GET |
| `generate_report` | 生成报告 | mutation_safe | `/api/career-development-report/personal-growth-report/tasks` | POST |
| `update_section` | 编辑报告章节 | mutation_safe | `/api/career-development-report/personal-growth-report` | PUT |
| `append_achievement` | 追加成就 | **mutation_gated** | Memory System | — |
| `update_reflection` | 更新反思 | **mutation_gated** | Memory System | — |
| `export_report` | 导出报告 | readonly | `/api/career-development-report/personal-growth-report/export` | GET |

### 7.6 Shared（3 工具）

| 工具名 | 中文名 | 分类 | 端点 | method |
|--------|--------|------|------|--------|
| `switch_agent` | 切换子 Agent | Coordinator 内部 | — | — |
| `recall_memory` | 搜索记忆 | readonly | Qdrant + SQLite | — |
| `get_home_summary` | 获取首页摘要 | readonly | `/api/home-v2` | GET |

---

## 8. `readonly_api_handler` 工厂

消除 14 个 readonly 工具的样板代码。所有 readonly 工具共享同一个工厂函数：

```python
# backend/app/services/tools/handlers.py

async def readonly_api_handler(
    endpoint: str,
    method: str,          # "GET" | "POST"
    args: dict,
    context: "LoopContext",
) -> ToolResult:
    """通用 readonly API 调用工厂。
    
    调用现有 REST 端点，将响应格式化为 ToolResult。
    不修改任何数据，仅读取。
    """
    try:
        headers = _auth_header(context)
        if method == "GET":
            response = await api_request(endpoint, params=args, headers=headers)
        else:
            response = await api_request(endpoint, json=args, headers=headers)
        return ToolResult(
            success=True,
            summary=format_api_response(response),
            detail=response,
        )
    except Exception as e:
        return ToolResult(success=False, error=str(e))
```

14 个 readonly 工具注册示例：

```python
registry.register(Tool(
    name="read_profile",
    display_name="读取能力画像",
    description="读取学生的 12 维能力画像，包括各维度得分和 evidence",
    parameters={"student_id": {"type": "string"}},
    classification="readonly",
    handler=functools.partial(
        readonly_api_handler,
        endpoint="/api/student-competency-profile/runtime",
        method="GET",
    ),
    agent="ResumeCoach",
))
```

---

## 9. ToolExecutor 重试机制（Spec §4.5）

### 9.1 目标

所有工具执行统一经过 `ToolExecutor.execute_with_recovery()`，内建指数退避重试：readonly/safe 工具最多 3 次重试，mutation_gated 工具不重试（由 Adjudicator 裁决替代重试）。

### 9.2 ToolExecutor 实现

```python
# backend/app/services/tools/executor.py

class ToolExecutor:
    def __init__(self, registry, memory_manager, max_retries=3):
        self.registry = registry
        self.memory_manager = memory_manager
        self.max_retries = max_retries
        self.base_delay = 1.0  # 秒

    async def execute_with_recovery(
        self, tool_name: str, args: dict, context: "LoopContext"
    ) -> ToolResult:
        last_error = None
        for attempt in range(self.max_retries):
            try:
                tool = self.registry.get(tool_name)
                if not tool:
                    return ToolResult(success=False, error=f"Tool '{tool_name}' not found")

                # mutation_gated → 不走重试（Adjudicator 裁决替代）
                if tool.classification == "mutation_gated":
                    return await self._execute_mutation_gated(tool, args, context)

                # readonly / mutation_safe → 普通执行 + 超时保护
                result = await asyncio.wait_for(
                    tool.execute(args, context),
                    timeout=30.0,  # 30s 硬超时
                )
                return result

            except asyncio.TimeoutError:
                last_error = f"Tool '{tool_name}' timed out"
            except Exception as e:
                last_error = str(e)

            if attempt < self.max_retries - 1:
                delay = self.base_delay * (2 ** attempt)  # 1s → 2s → 4s
                await asyncio.sleep(delay)

        return ToolResult(
            success=False,
            error=last_error,
            recovery="max_retries_exceeded",
        )

    async def _execute_mutation_gated(
        self, tool: "Tool", args: dict, context: "LoopContext"
    ) -> ToolResult:
        """mutation_gated 工具：propose → adjudicate → commit（不重试）"""
        proposal = await tool.evaluate_and_propose(args, context)
        record = await self.memory_manager.propose_memory_mutation(proposal)

        if record.decision_type == DecisionType.REJECTED:
            return ToolResult(
                success=False,
                error=f"Memory mutation rejected: insufficient evidence",
            )

        return ToolResult(
            success=True,
            summary=f"Memory mutation {record.decision_type}",
            detail={"mutation_id": record.id, "decision_type": record.decision_type},
        )
```

### 9.3 重试策略

| 工具分类 | 重试次数 | 退避策略 | 超时 | 失败处理 |
|---------|:-------:|---------|:----:|---------|
| readonly | 3 | 指数退避 1s→2s→4s | 30s | 返回 ToolResult(success=False, recovery="max_retries_exceeded") |
| mutation_safe | 3 | 同上 | 30s | 同上 |
| mutation_gated | 0 | 不重试 | — | Adjudicator 裁决替代（rejected 直接返回失败） |

### 9.4 Coordinator 集成

`CoachCoordinator` 的 tool_call 处理路径改为通过 `ToolExecutor.execute_with_recovery()` 执行：

```python
# coach_coordinator.py — tool_call 处理
result = await self.tool_executor.execute_with_recovery(
    tool_name=tool_call.name,
    args=tool_call.args,
    context=loop_context,
)
```

取代 P0c 的直接 `tool.execute()` 调用。重试对 LLM 透明——LLM 只看到最终的 `tool_result`（成功或失败）。

---

## 10. 3 个 mutation_gated 工具

### 10.1 `process_memory_proposal`（P2 已有）

P2 已注册。P2b 无变化。仍为 general-purpose memory mutation 工具。

### 10.2 `verify_and_record_progress`（P2b 新增）

```python
async def handle_verify_and_record_progress(args: dict, context: LoopContext) -> ToolResult:
    skill_id = args["skill_id"]
    evidence = args["evidence"]  # list[dict]: [{"type": "quiz", "score": 0.85}, ...]

    # 1. 证据评分（不同类型不同权重）
    evidence_score = evaluate_evidence(evidence)
    if evidence_score < 0.5:
        return ToolResult(success=False, error="证据不足，需要至少 2 项验证来源")

    # 2. 置信度计算（基于证据强度 + 历史一致性）
    confidence = calculate_confidence(evidence, context)

    # 3. 风险判定
    risk_level = determine_risk(skill_id)

    # 4. 提交裁决（走 P2 的 propose → adjudicate → commit 链路）
    proposal = MemoryMutationProposal(
        student_id=context.student_id,
        target_table="conversation_summaries",
        target_field=f"skills.{skill_id}.mastery_status",
        old_value=get_current_mastery(context.conversation_summary, skill_id),
        new_value="mastered",
        evidence=json.dumps(evidence),
        source_agent=context.active_agent,
        source_idempotency_key=hash_idempotency_key(
            context.student_id, skill_id, "skill_mastered", "v3"
        ),
        source_event_id=build_id("evt"),
        trace_id=context.trace_id,
        confidence=confidence,
        risk_level=risk_level,
    )
    record = await memory_manager.propose_memory_mutation(proposal)

    if record.decision_type == DecisionType.REJECTED:
        return ToolResult(
            success=False,
            error=f"技能掌握验证未通过：confidence={confidence:.0%}",
        )

    # 5. 成功 → emit 级联事件
    if record.decision_type == DecisionType.AUTO_CONFIRMED:
        await outbox_emitter.emit_event(
            event_type="skill_mastered",
            payload={"skill_id": skill_id, "student_id": context.student_id},
            idempotency_key=proposal.source_idempotency_key,
            trace_id=context.trace_id,
        )

    return ToolResult(
        success=True,
        summary=f"技能 '{skill_id}' 已标记为 {record.decision_type}",
        detail={"mutation_id": record.id, "confidence": confidence},
    )
```

### 10.3 `append_achievement`（P2b 新增）

```python
async def handle_append_achievement(args: dict, context: LoopContext) -> ToolResult:
    """追加成就条目。走 mutation_gated 流程。"""
    achievement = args["achievement"]  # {title, description, evidence, date}
    target_field = f"achievements.{build_id('ach')}"
    return await _mutation_gated_flow(target_field, achievement, "medium", context)
```

### 10.4 `update_reflection`（P2b 新增）

```python
async def handle_update_reflection(args: dict, context: LoopContext) -> ToolResult:
    """更新反思内容。走 mutation_gated 流程。"""
    reflection = args["reflection"]
    target_field = f"reflections.{args['reflection_id']}"
    return await _mutation_gated_flow(target_field, reflection, "low", context)
```

---

## 11. Outbox 事件总线

### 11.1 OutboxEmitter

```python
class OutboxEmitter:
    """幂等写入 outbox_events 表。"""

    async def emit_event(
        self,
        event_type: str,
        payload: dict,
        idempotency_key: str,
        trace_id: str,
    ) -> str:
        """写入一条 pending 事件。幂等：同 idempotency_key 重复调用不重复插入。"""
        event_id = build_id("evt")
        try:
            await db.execute(
                """INSERT INTO outbox_events
                   (id, event_type, payload_json, idempotency_key, trace_id)
                   VALUES (?, ?, ?, ?, ?)""",
                (event_id, event_type, json.dumps(payload), idempotency_key, trace_id)
            )
        except IntegrityError:
            row = await db.fetchone(
                "SELECT id FROM outbox_events WHERE idempotency_key = ?",
                (idempotency_key,)
            )
            return row["id"]
        return event_id
```

### 11.2 级联白名单

```python
CASCADE_WHITELIST = {
    "skill_mastered": ["ReportCoach", "ResumeCoach"],
    "goal_reached": ["ReportCoach"],
}
```

投递规则：
- `skill_mastered` → ReportCoach 更新报告 + ResumeCoach 更新简历建议
- `goal_reached` → 仅 ReportCoach 更新
- 级联仅 1 层（不递归触发）
- 投递方式：将事件追加到目标学生的 `conversation_summaries.pending_events`，对应 Agent 下一轮对话的 system prompt 中可见

### 11.3 BackgroundWorker

```python
class BackgroundWorker:
    """后台轮询 outbox_events，投递 pending 事件。

    - 轮询间隔：5 秒
    - 每次取 batch_size=20 条 pending 事件
    - 锁定机制：UPDATE status='processing', locked_at=now(), locked_by=worker_id
    - 指数退避：1min → 5min → 15min（最多 3 次）
    - 3 次失败后 → dead_letter
    """

    async def run(self):
        while True:
            try:
                await self.process_batch(batch_size=20)
            except Exception as e:
                logger.error(f"BackgroundWorker error: {e}")
            await asyncio.sleep(5)

    async def process_batch(self, batch_size: int):
        rows = await db.fetchall(
            """SELECT * FROM outbox_events
               WHERE status IN ('pending', 'failed_retryable')
                 AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
               ORDER BY created_at
               LIMIT ?""",
            (batch_size,)
        )
        for row in rows:
            await self.process_one(row)

    async def process_one(self, row: dict):
        # 1. 锁定
        await db.execute(
            """UPDATE outbox_events
               SET status='processing', locked_at=datetime('now'), locked_by=?
               WHERE id=? AND status IN ('pending', 'failed_retryable')""",
            (self.worker_id, row["id"])
        )
        # 2. 投递
        try:
            await self.deliver(row)
            await db.execute(
                """UPDATE outbox_events
                   SET status='delivered', delivered_at=datetime('now'),
                       updated_at=datetime('now')
                   WHERE id=?""",
                (row["id"],)
            )
        except Exception as e:
            attempts = row["attempt_count"] + 1
            if attempts >= 3:
                await db.execute(
                    """UPDATE outbox_events
                       SET status='dead_letter', last_error=?,
                           updated_at=datetime('now')
                       WHERE id=?""",
                    (str(e), row["id"])
                )
            else:
                delay_minutes = [1, 5, 15][attempts - 1]
                await db.execute(
                    """UPDATE outbox_events
                       SET status='failed_retryable', attempt_count=?,
                           next_retry_at=datetime('now', '+' || ? || ' minutes'),
                           last_error=?, updated_at=datetime('now')
                       WHERE id=?""",
                    (attempts, delay_minutes, str(e), row["id"])
                )

    async def deliver(self, row: dict):
        """投递事件到目标 Agent。

        将事件追加到 conversation_summaries.pending_events，
        对应 Agent 在下一轮对话的 system prompt 中看到此事件。
        """
        event_type = row["event_type"]
        payload = json.loads(row["payload_json"])
        target_agents = CASCADE_WHITELIST.get(event_type, [])

        for agent_name in target_agents:
            student_id = payload["student_id"]
            await db.execute(
                """UPDATE conversation_summaries
                   SET summary_json = json_set(
                     summary_json,
                     '$.pending_events[' ||
                       COALESCE(json_array_length(summary_json->'$.pending_events'), 0) ||
                       ']',
                     ?
                   ),
                   updated_at = datetime('now')
                   WHERE student_id = ?""",
                (json.dumps({
                    "event_type": event_type,
                    "payload": payload,
                    "target_agent": agent_name,
                    "delivered_at": datetime.utcnow().isoformat(),
                }), student_id)
            )
```

### 11.4 启动与关闭

```python
# backend/app/main.py — lifespan

@asynccontextmanager
async def lifespan(app: FastAPI):
    worker = BackgroundWorker(worker_id=os.getpid())
    worker_task = asyncio.create_task(worker.run())
    app.state.outbox_worker = worker_task

    yield

    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
```

---

## 12. mutation_gated 工具执行路径

与 P2 的 `process_memory_proposal` 共用同一条链路：

```
LLM 调用工具（如 verify_and_record_progress）
  → ToolRegistry.execute("verify_and_record_progress", args, context)
    → handler: evidence evaluation → confidence → risk → propose
      → MemoryManager.propose_memory_mutation(proposal)
        → adjudicate()（P2 已有）
          → 写入 memory_mutations + decision_journal
          → 非 rejected → commit_memory_mutation()
      → 返回 ToolResult(success=True/False)
    → 如果 auto_confirmed → outbox_emitter.emit_event("skill_mastered", ...)
  → yield tool_result NDJSON
  → yield memory_result NDJSON（P2 已有）
  → BackgroundWorker 拉取事件 → 投递到目标 Agent
```

与非 gated 工具的关键区别：handler **自行**调用 `propose → adjudicate → commit`，不通过 `process_memory_proposal` 二次中转。这避免了 LLM → tool1 → LLM → process_memory_proposal → LLM 的多跳延迟。

---

## 13. 测试文件

### 13.1 Tool 注册测试

文件：`backend/tests/services/tools/test_tool_handlers.py`

| # | 测试 | 断言 |
|---|------|------|
| 1 | `test_all_22_tools_registered` | `ToolRegistry.list_all()` 返回 22 项 |
| 2 | `test_readonly_handler_get` | GET 端点调用成功，返回 ToolResult(success=True) |
| 3 | `test_readonly_handler_post` | POST 端点调用成功 |
| 4 | `test_readonly_handler_api_error` | 端点返回 500 → ToolResult(success=False, error=...) |
| 5 | `test_mutation_safe_create_shortlist` | `save_to_shortlist` POST 成功 |
| 6 | `test_mutation_gated_verify_progress` | `verify_and_record_progress` 走完整 propose→adjudicate→commit 链路 |
| 7 | `test_switch_agent_returns_success` | `switch_agent` 返回目标 agent 名称 |
| 8 | `test_recall_memory_readonly` | `recall_memory` 调用 Qdrant 返回结果 |
| 9 | `test_tool_not_found` | 不存在的工具名 → 抛 ValueError |
| 10 | `test_student_isolation_in_tool_context` | 跨 student_id 调用被拒绝 |

### 13.2 ToolExecutor 重试测试

文件：`backend/tests/services/tools/test_tool_executor.py`

| # | 测试 | 断言 |
|---|------|------|
| 1 | `test_readonly_retry_on_timeout` | 首次超时 → 重试 → 第 2 次成功，返回 ToolResult(success=True) |
| 2 | `test_readonly_max_retries_exceeded` | 3 次全超时 → ToolResult(success=False, recovery="max_retries_exceeded") |
| 3 | `test_mutation_safe_retry_on_error` | API 500 → 重试成功 |
| 4 | `test_mutation_gated_no_retry` | mutation_gated 工具失败不重试，直接返回 rejected |
| 5 | `test_exponential_backoff_timing` | 重试间隔 1s → 2s → 4s |
| 6 | `test_tool_not_found_no_retry` | 不存在的工具名 → 立即返回错误，不重试 |

### 13.3 Outbox 测试

文件：`backend/tests/services/outbox/test_outbox.py`

| # | 测试 | 断言 |
|---|------|------|
| 1 | `test_emit_event_creates_pending` | `outbox_events` 新增 1 条 status='pending' |
| 2 | `test_emit_event_idempotent` | 同 key 两次 emit → 仅 1 条记录 |
| 3 | `test_worker_processes_pending` | worker 处理后 status='delivered' |
| 4 | `test_worker_retry_backoff` | 投递失败 → status='failed_retryable' + next_retry_at 正确 |
| 5 | `test_worker_dead_letter_after_3_retries` | 3 次失败 → status='dead_letter' |
| 6 | `test_cascade_whitelist_delivery` | `skill_mastered` 事件 → conversation_summaries 中 ReportCoach 和 ResumeCoach 各有 1 条 pending_event |
| 7 | `test_cascade_goal_reached` | `goal_reached` → 仅 ReportCoach 收到 |
| 8 | `test_worker_locks_events` | 同一事件不被两个 worker 同时处理 |

### 13.4 修改已有测试

| 文件 | 改动 |
|------|------|
| `tests/services/test_tool_registry.py` | 追加：classification 字段验证、`get_for_agent()` 按 agent 筛选 |
| `tests/api/test_coach.py` | 追加：mock LLM 触发 readonly 工具 → 验证 tool_call/tool_result 事件中 toolName 正确 |

---

## 14. 验收标准

1. **22 工具全注册**：`ToolRegistry.list_all()` 返回 22 项，`get_for_agent("ResumeCoach")` 返回 4+3 项
2. **readonly 工具可用**：`read_profile` → 调用现有 `/api/student-competency-profile/runtime` → 返回 ToolResult(success=True)
3. **mutation_safe 工具可用**：`save_to_shortlist` → POST `/api/career-development/favorites` → 收藏成功
4. **mutation_gated 工具完整链路**：`verify_and_record_progress` → evidence evaluation → propose → adjudicate → commit → memory_result 事件
5. **级联事件发射**：skill_mastered auto_confirmed → `outbox_events` 有 1 条 pending 记录
6. **级联白名单正确**：`skill_mastered` → 仅 ReportCoach + ResumeCoach 收到；`goal_reached` → 仅 ReportCoach 收到
7. **Outbox 幂等**：同 idempotency_key 重复 emit → 仅 1 条记录
8. **Worker 正确投递**：pending 事件被 worker 拉取 → status='delivered' → conversation_summaries 中目标 Agent 有 pending_event
9. **Outbox 重试机制**：投递失败 → failed_retryable → 指数退避重试 → 3 次后 dead_letter
10. **工具执行重试**：readonly/safe 工具超时或 API 错误 → 指数退避重试（1s→2s→4s，最多 3 次）→ 3 次后返回 ToolResult(success=False, recovery="max_retries_exceeded")；mutation_gated 不重试
11. **Agent 工具隔离**：ResumeCoach 只能看到自己的 4 个工具，看不到 CareerMatchCoach 的工具（Shared 工具所有 Agent 可见）
12. **P0–P2 无回归**：delta/route/tool_call/tool_result/memory_result/done/error 事件流正常，记忆裁决链路正常
13. **现有 API 不受影响**：工具调用不修改现有 66 个 REST 端点的行为

---

## 15. 回滚方案

### 方案 A：关闭事件总线（最小影响）

```
1. main.py 中注释 BackgroundWorker 启动代码
2. coach_coordinator.py 中注释 emit_event() 调用
3. outbox_events 表保留但无新写入
```

- 工具仍可正常调用，mutation_gated 仍工作，仅级联通知不投递
- 不影响对话功能

### 方案 B：移除新增工具

```
1. tool_registry.py 中 register_all_tools() 只保留 process_memory_proposal（P2 已有）
2. 删除 services/tools/handlers.py
3. 删除 services/outbox/
4. coach_coordinator.py 回退 outbox 相关改动
```

- 退回到 P2 的工具集（仅 process_memory_proposal）
- P0–P2 验收标准仍通过

### 方案 C：全量回滚

```
git revert <p2b-merge-commit>
```

---

## 16. 进入 P3 的条件

- [ ] 全部 13 项验收标准通过
- [ ] Tool handler 测试覆盖率 ≥ 85%
- [ ] ToolExecutor 重试测试覆盖率 ≥ 85%
- [ ] Outbox 测试覆盖率 ≥ 85%
- [ ] P0–P2 验收标准无回归
- [ ] 手动 curl 验证：`verify_and_record_progress` 工具调用 → memory_mutations + decision_journal 写入 + outbox_events 写入
- [ ] 手动验证：BackgroundWorker 正常处理 pending 事件 → delivered
- [ ] Agent 工具隔离手动验证：ResumeCoach 对话中 LLM 不会看到 CareerMatchCoach 专属工具

---

## 附录 A：文件清单汇总

| # | 文件 | P0a | P0b | P0c | P1 | P2 | P2b | 操作 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---:|:----:|
| **后端 — 新增** | | | | | | | | |
| 1 | `services/outbox/__init__.py` | — | — | — | — | — | **新增** | 创建 |
| 2 | `services/outbox/emitter.py` | — | — | — | — | — | **新增** | 创建 |
| 3 | `services/outbox/worker.py` | — | — | — | — | — | **新增** | 创建 |
| 4 | `services/tools/executor.py` | — | — | — | — | — | **新增** | 创建 |
| 5 | `services/tools/handlers.py` | — | — | — | — | — | **新增** | 创建 |
| 6 | `tests/services/tools/test_tool_executor.py` | — | — | — | — | — | **新增** | 创建 |
| 7 | `tests/services/tools/test_tool_handlers.py` | — | — | — | — | — | **新增** | 创建 |
| 8 | `tests/services/outbox/test_outbox.py` | — | — | — | — | — | **新增** | 创建 |
| **后端 — 修改** | | | | | | | | |
| 9 | `services/tool_registry.py` | — | — | ✓ | — | ✓ | **修改** | register_all_tools() + Tool 字段 |
| 10 | `services/coach_coordinator.py` | — | — | ✓ | ✓ | ✓ | **修改** | 触发热事件 + ToolExecutor 集成 |
| 11 | `models/coach.py` | — | — | — | ✓ | — | **修改** | OutboxEvent ORM |
| 12 | `api/coach.py` | ✓ | ✓ | ✓ | ✓ | ✓ | **修改** | 初始化注入 |
| 13 | `main.py` | ✓ | — | — | ✓ | — | **修改** | lifespan + worker 启动 |
| **后端 — 测试修改** | | | | | | | | |
| 14 | `tests/services/test_tool_registry.py` | — | — | ✓ | — | — | **修改** | classification + get_for_agent |
| 15 | `tests/api/test_coach.py` | ✓ | ✓ | ✓ | — | — | **修改** | 工具调用事件验证 |

**新增：** 8 文件（5 服务 + 3 测试）
**修改：** 7 文件（5 服务 + 2 测试）
**不改（前端）：** 全部前端文件

---

## 附录 B：P2 → P2b 关键行为变化

| # | 行为 | P2 | P2b | 改哪个文件 |
|---|------|-----|-----|-----------|
| 1 | 工具数量 | 1（process_memory_proposal） | 22（全部注册） | `tool_registry.py`, `handlers.py` |
| 2 | readonly 工具 | 无 | 14 个工厂化 handler | `handlers.py` |
| 3 | mutation_gated 工具 | 仅 process_memory_proposal | +verify_and_record_progress, append_achievement, update_reflection | `handlers.py` |
| 4 | 级联事件 | 无 | skill_mastered/goal_reached → target agents | `emitter.py`, `coach_coordinator.py` |
| 5 | Outbox 表 | 不存在 | 创建 + 写入 | `emitter.py`, `models/coach.py` |
| 6 | BackgroundWorker | 不存在 | asyncio 后台轮询投递 | `worker.py`, `main.py` |
| 7 | Agent 工具隔离 | 无（所有工具全局可见） | get_for_agent() 按 agent 筛选 | `tool_registry.py` |
| 8 | 工具执行重试 | 无 | ToolExecutor.execute_with_recovery() 指数退避 3 次 | `executor.py`, `coach_coordinator.py` |

## 附录 C：事件总线状态流转

```
emitter.emit_event()
  → INSERT INTO outbox_events (status='pending')
  → BackgroundWorker.poll()
    → SELECT WHERE status IN ('pending', 'failed_retryable') AND next_retry_at <= now()
    → UPDATE status='processing', locked_at=now()
    → deliver(event) → target agents
      → 成功: UPDATE status='delivered', delivered_at=now()
      → 失败:
          attempt_count < 3:
            UPDATE status='failed_retryable',
                   next_retry_at=now()+backoff(attempt_count),
                   last_error=...
          attempt_count >= 3:
            UPDATE status='dead_letter', last_error=...
```
