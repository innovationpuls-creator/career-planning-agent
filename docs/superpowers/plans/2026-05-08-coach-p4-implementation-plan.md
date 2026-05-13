# P4：可靠性与可观测性

> 日期：2026-05-08
> 基于：[AI 教练智能体系统设计](../specs/2026-05-08-coach-agent-design.md)、[P3 前端完整体验计划](./2026-05-08-coach-p3-implementation-plan.md)
> 前提：P3 全部验收标准通过
> 原则：增量构建于 P0–P3 代码之上，不改已实现功能。P4 以**可观测性 + 测试加固**为主，不新增用户可见功能。

---

## 1. 目标

在 P0–P3 的所有功能之上，建立可观测性体系和测试安全网，确保系统运行可监控、可诊断、可追溯。

**一句话：P0–P3 能用、好看，P4 让它不掉线、能排查。**

核心差距（当前 vs P4 目标）：

| 维度 | 当前 (P0–P3) | P4 目标 |
|------|-------------|---------|
| Dead Letter Queue | `outbox_events` 表存在，DLQ 状态无监控 | DLQ 监控端点 + 告警基础 |
| 路由可观测 | 路由结果存于 conversation，无各层命中统计 | 路由命中率按 L1/L1.5/L2/L4 追踪 |
| Agent 准确率 | `feedback_records` 表写入但无分析 | Agent 维度准确率报告 API |
| 回滚验证 | rollback 单元测试覆盖 | 完整回滚 E2E 测试（API 级别） |
| 审计链完整性 | `memory_mutations` 表有 FK 约束但无验证 | 自动化审计链完整性测试（每条 mutation 的 trace_id/rollback 链可验证） |

---

## 2. 非目标

- 不新增用户可见的 Chat UI 功能（P3 已冻结）
- 不做 AgentSwitchBadge 后端 emit（延后至 P5）
- 不修改 P2b 已有的 BackgroundWorker（P2b 已实现 5s 轮询/行锁/指数退避/dead_letter，本阶段仅读取 `outbox_events` 表中 `status='dead_letter'` 的数据做监控）
- 不做 CollectiveWisdom 数据填充（P5）
- 不做 L3 BERT 路由训练（P5）
- 不做 Prompt 优化（P5）
- 不做 5 个缺失后端端点（P5）
- 不上 ClamAV 病毒扫描（生产部署配置）
- 不上 Prometheus/Grafana 集成（基础设施层面）
- 不改现有 66 个 REST 端点
- 不改 P0–P3 已有功能逻辑

---

## 3. 数据库迁移

### 3.1 新增表

**`routing_log`** — 每次路由决策的记录，用于命中率仪表盘和 P5 L3 训练数据：

```sql
CREATE TABLE routing_log (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    session_id TEXT,
    trace_id TEXT NOT NULL,
    message TEXT NOT NULL,
    route_level TEXT NOT NULL,           -- 'L1' | 'L1.5' | 'L2' | 'L4'（命名升级，见下文）
    matched_agent TEXT NOT NULL,
    matched_rule TEXT,
    llm_latency_ms INTEGER,
    llm_confidence REAL,
    corrected_by_user INTEGER DEFAULT 0, -- 0/1，P5 训练数据筛选用
    task_success INTEGER DEFAULT 0,      -- 0/1，P5 训练数据筛选用
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_routing_log_student ON routing_log(student_id, created_at);
CREATE INDEX idx_routing_log_trace ON routing_log(trace_id);
CREATE INDEX idx_routing_log_level ON routing_log(route_level, created_at);
```

#### 路由层级命名升级（P0b → P4）

P0b 使用 3 层命名：`L1`（命令 `/resume`）、`L2`（关键词）、`L0`（默认）。本阶段升级为 Spec 定义的标准 4 层命名：

| P0b 命名 | P4/Spec 命名 | 含义 |
|----------|-------------|------|
| — | `L1` | pipeline stage 显式路由（`?step=resume` → ResumeCoach） |
| `L1` | `L1.5` | 用户命令路由（`/resume` → ResumeCoach） |
| `L2` | `L2` | 关键词规则路由 |
| `L0` | `L4` | LLM 意图识别兜底 |

P0b 的 `coach_router.py` 中 `route_message()` 返回的 `rule` 字段值（`L1_command` / `L2_keyword` / `L0_default`）需同步更新为 `L1.5` / `L2` / `L4`。

### 3.2 无 DDL 变更的现有表

| 表 | P4 使用方式 |
|----|-----------|
| `outbox_events` | 查询 `status = 'dead_letter'` 做 DLQ 监控 |
| `feedback_records` | 按 `target_type` 分组做 Agent 准确率分析 |
| `memory_mutations` | 审计链完整性验证（trace_id 非空、rollback 双向链接） |

### 3.3 回滚迁移

```sql
DROP TABLE IF EXISTS routing_log;
```

---

## 4. 后端文件级计划

### 4.1 新增文件（6 个）

| # | 文件 | 职责 |
|---|------|------|
| 1 | `backend/app/services/observability/dlq_monitor.py` | DLQ 监控：`get_dlq_summary()` 返回 dead_letter 总数/趋势/top 错误；`get_dlq_detail()` 分页列表 |
| 2 | `backend/app/services/observability/routing_metrics.py` | 路由命中率：`get_routing_hit_rates(start, end)` 按层分组；`export_routing_logs(start, end, min_confidence)` 导出高质量日志（供 P5） |
| 3 | `backend/app/services/observability/agent_accuracy.py` | Agent 准确率：`get_agent_accuracy(start, end)` 基于 `feedback_records` 汇总各 Agent 准确率 |
| 4 | `backend/app/services/feedback/service.py` | 反馈记录服务：P2b 已定义 `FeedbackRecord` 模型和表，P4 补充 `record_feedback()` 写入逻辑、`should_prompt_feedback()` 频率控制及补偿引擎集成 |
| 5 | `backend/app/services/feedback/compensation_engine.py` | **补偿引擎** — 负反馈触发动作：还原 mastery_status → 更新 pending_events → 通知 LearningPathCoach/ReportCoach |
| 6 | `backend/app/api/coach_observability.py` | 5 个可观测性端点（见 §6.1） |
| 7 | `backend/app/api/coach_memory.py` | 3 个 Memory Mutation 管理端点（见附录 B：rollback 触发、mutation 详情、mutation 历史列表） |

### 4.2 修改文件（5 个）

| # | 文件 | 改动 |
|---|------|------|
| 1 | `backend/app/services/coach_coordinator.py` | `route()` 每次决策后写入 `routing_log`；对话完成后检测用户是否纠正路由 |
| 2 | `backend/app/services/feedback/service.py` | 实现 `record_feedback()` — 写入时关联对应 `trace_id` 的 `routing_log`，更新 `task_success` |
| 3 | `backend/app/schemas/agent.py` | `StreamEvent` 模型新增 `route_log` 事件字段（P4 新增可选事件） |
| 4 | `backend/app/main.py` | 注册 `coach_observability_router` 和 `coach_memory_router` |
| 5 | `myapp/src/pages/coach/types.ts` | `StreamEvent` 联合类型追加 `route_log` 事件（可选，不影响现有功能） |

### 4.3 Coordinator 路由日志注入

> **依赖确认**：`self.current_session_id` 由 P1 的 `CoachCoordinator` 在 `run()` 开始时设置（来自 `LoopContext.session_id`）。如属性名不同，以 P1–P3 实际实现为准。

```python
# backend/app/services/coach_coordinator.py — route() 方法追加
# 每次路由决策后写入 routing_log

import time

async def route(self, student_id, message, pipeline_stage, summary) -> str:
    start_time = time.monotonic()
    route_level = "L1"
    matched_agent = ""
    matched_rule = ""
    llm_latency_ms = 0
    llm_confidence = None

    # L1: 显式路由
    if pipeline_stage and pipeline_stage in stage_to_agent:
        matched_agent = stage_to_agent[pipeline_stage]
        matched_rule = pipeline_stage
        route_level = "L1"

    # L1.5: 用户命令
    elif cmd := self._detect_command(message):
        matched_agent = cmd_to_agent[cmd]
        matched_rule = cmd
        route_level = "L1.5"

    # L2: 关键词规则
    elif matched := self._match_keyword(message):
        matched_agent, matched_rule = matched
        route_level = "L2"

    # L4: LLM 兜底
    else:
        route_level = "L4"
        llm_start = time.monotonic()
        try:
            result = await asyncio.wait_for(
                self.llm_client.classify_intent(message, list(rules.keys())),
                timeout=0.3,
            )
            matched_agent = result.agent
            llm_confidence = result.confidence
            matched_rule = "llm_classify"
        except asyncio.TimeoutError:
            matched_agent = "ResumeCoach"
            matched_rule = "llm_timeout_fallback"
            llm_confidence = 0.0
        llm_latency_ms = int((time.monotonic() - llm_start) * 1000)

    # 写入路由日志
    await db.execute(
        """INSERT INTO routing_log
           (id, student_id, session_id, trace_id, message, route_level,
            matched_agent, matched_rule, llm_latency_ms, llm_confidence)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (build_id("rlog"), student_id, self.current_session_id, self.trace_id,
         message[:200], route_level, matched_agent, matched_rule,
         llm_latency_ms, llm_confidence)
    )

    return matched_agent

### 4.4 补偿引擎实现

**目的**：当收到负反馈时自动执行以下补偿链：

```
receive_negative_feedback("我觉得还没掌握 Python")
  → compensation_engine.compensate(feedback_record)
    → 1. 创建 rollback mutation：mastery_status: mastered → in_progress
    → 2. confidence 下调 0.2（或到 0.0）
    → 3. 写入 outbox_events：event_type="compensation_needed"
    → 4. BackgroundWorker 投递到 LearningPathCoach（重新规划补强任务）
    → 5. BackgroundWorker 投递到 ReportCoach（更新报告措辞）
```

```python
# backend/app/services/feedback/compensation_engine.py

class CompensationEngine:
    def __init__(self, memory_manager, outbox_emitter):
        self.memory_manager = memory_manager
        self.outbox_emitter = outbox_emitter

    async def compensate(self, feedback: FeedbackRecord) -> None:
        """根据负反馈类型执行补偿动作"""
        if feedback.sentiment != "negative":
            return

        if feedback.target_type == "skill_mastered":
            await self._compensate_skill_mastered(feedback)
        elif feedback.target_type == "report_generated":
            await self._compensate_report(feedback)

    async def _compensate_skill_mastered(self, feedback: FeedbackRecord) -> None:
        """技能掌握被质疑 → 还原为 in_progress + 通知 coach"""
        skill_id = feedback.target_id

        # 1. 查找最近的 skill_mastered mutation
        mutation = await db.fetchone(
            """SELECT id, old_value, new_value FROM memory_mutations
               WHERE student_id = ? AND target_field = ?
                 AND decision_type IN ('auto_confirmed', 'provisional_write')
               ORDER BY created_at DESC LIMIT 1""",
            (feedback.student_id, f"skills.{skill_id}.mastery_status")
        )
        if not mutation or mutation["new_value"] != '"mastered"':
            return

        # 2. rollback 还原
        rollback = await memory_manager.create_rollback_mutation(
            original_mutation_id=mutation["id"],
            reason=f"Negative feedback compensation: {feedback.feedback_text}",
            requested_by="CompensationEngine",
        )

        # 3. confidence 下调
        await db.execute(
            """UPDATE conversation_summaries
               SET summary_json = json_set(summary_json,
                   '$.skills.?, confidence',
                   max(0.0, json_extract(summary_json, '$.skills.?.confidence') - 0.2))
               WHERE student_id = ?""",
            (skill_id, skill_id, feedback.student_id)
        )

        # 4. 发射补偿事件
        await self.outbox_emitter.emit_event(
            event_type="compensation_needed",
            payload={
                "skill_id": skill_id,
                "student_id": feedback.student_id,
                "feedback_text": feedback.feedback_text,
                "rollback_id": rollback.id,
            },
            idempotency_key=hash_idempotency_key(
                feedback.student_id, skill_id, "compensation_needed", "v1"
            ),
            trace_id=feedback.trace_id or "",
        )

    async def _compensate_report(self, feedback: FeedbackRecord) -> None:
        """报告生成负反馈 → 标记报告需重新生成"""
        await self.outbox_emitter.emit_event(
            event_type="report_regeneration_needed",
            payload={
                "student_id": feedback.student_id,
                "report_id": feedback.target_id,
                "feedback_text": feedback.feedback_text,
            },
            idempotency_key=hash_idempotency_key(
                feedback.student_id, feedback.target_id, "report_regeneration_needed", "v1"
            ),
            trace_id=feedback.trace_id or "",
        )
```

**级联白名单补充**：

```python
CASCADE_WHITELIST = {
    "skill_mastered": ["ReportCoach", "ResumeCoach"],
    "goal_reached": ["ReportCoach"],
    "compensation_needed": ["LearningPathCoach"],        # P4 新增
    "report_regeneration_needed": ["ReportCoach"],       # P4 新增
}
```

**集成点**：`record_feedback()` 写入后检测 `sentiment == "negative"`，调用 `compensation_engine.compensate(feedback)`。

```python
async def record_feedback(feedback: FeedbackRecord) -> None:
    await db.execute("""INSERT INTO feedback_records ...""", ...)

    if feedback.sentiment == "negative":
        await db.execute(
            "UPDATE feedback_records SET compensation_status = 'pending' WHERE id = ?",
            (feedback.id,)
        )
        # 🔁 P4 新增：触发补偿
        await compensation_engine.compensate(feedback)
```

### 4.5 反馈频率控制

**目的**：在关键节点才提示反馈，避免每次对话都打扰用户。仅 5 个关键节点触发：技能首次标记 mastered、报告生成完成、学习路径阶段完成、岗位推荐被收藏/放弃、用户主动表达不满意。

```python
# backend/app/services/feedback/service.py

async def should_prompt_feedback(
    student_id: str, target_type: str, target_id: str, session_id: str
) -> bool:
    """频率控制：同一 target 7 天内不重复，每会话最多 2 个活跃反馈提示"""
    recent = await db.fetchone(
        """SELECT COUNT(*) FROM feedback_records
           WHERE student_id = ? AND target_type = ? AND target_id = ?
           AND created_at > datetime('now', '-7 days')""",
        (student_id, target_type, target_id)
    )
    if recent and recent[0] > 0:
        return False

    session_count = await db.fetchone(
        """SELECT COUNT(*) FROM feedback_records
           WHERE session_id = ? AND source = 'prompted'""",
        (session_id,)
    )
    if session_count and session_count[0] >= 2:
        return False

    return True
```

**调用方**：`CoachCoordinator` 在对话结束前检测是否属于 5 种反馈场景 → 调用 `should_prompt_feedback()` → 返回 True 时追加系统提示消息。

---

**P4 不新增面向终端用户的 UI 组件。** 可观测性端点仅在 API 层面暴露，供管理员调试或后续构建管理面板。

| # | 文件 | 改动 |
|---|------|------|
| 1 | `myapp/src/pages/coach/types.ts` | `StreamEvent` 联合类型追加：`{ event: 'route_log'; routeLevel: string; matchedAgent: string; matchedRule: string }` |

---

## 6. API 契约变化

### 6.1 新增可观测性端点

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/coach/observability/dlq` | GET | DLQ 摘要（总数、趋势、top 错误类型） | admin |
| `/api/coach/observability/dlq/detail` | GET | DLQ 详情（分页 + 按事件类型筛选） | admin |
| `/api/coach/observability/routing/hit-rates` | GET | 路由命中率（L1/L1.5/L2/L4 各层占比 + 趋势） | admin |
| `/api/coach/observability/routing/logs` | GET | 路由日志导出（供 P5 BERT 训练数据采集） | admin |
| `/api/coach/observability/agent-accuracy` | GET | Agent 准确率（各 Agent 准确率 + 反馈数 + 趋势） | admin |

### 6.2 DLQ 监控端点响应

```json
// GET /api/coach/observability/dlq
{
  "total": 12,
  "by_event_type": {"skill_mastered": 5, "goal_reached": 4, "test_event": 3},
  "trend": {"last_24h": 3, "last_7d": 12},
  "oldest_unresolved": "2026-05-07T10:00:00Z"
}
```

### 6.3 路由命中率端点响应

```json
// GET /api/coach/observability/routing/hit-rates
{
  "period": {"start": "2026-05-01", "end": "2026-05-08"},
  "total_routes": 1523,
  "by_level": {
    "L1":  {"count": 342,  "percentage": 22.5},
    "L1.5": {"count": 89,   "percentage": 5.8},
    "L2":  {"count": 871,  "percentage": 57.2},
    "L4":  {"count": 221,  "percentage": 14.5}
  },
  "by_agent": {
    "ResumeCoach":       {"count": 512, "percentage": 33.6},
    "CareerMatchCoach":  {"count": 289, "percentage": 19.0},
    "LearningPathCoach": {"count": 421, "percentage": 27.6},
    "ReportCoach":       {"count": 301, "percentage": 19.8}
  }
}
```

### 6.4 Agent 准确率端点响应

```json
// GET /api/coach/observability/agent-accuracy
{
  "period": {"start": "2026-05-01", "end": "2026-05-08"},
  "total_feedback": 89,
  "by_agent": {
    "ResumeCoach": {
      "feedback_count": 28, "positive": 22, "negative": 4, "neutral": 2,
      "accuracy": 78.6
    }
  }
}
```

### 6.5 路由日志导出端点响应

```json
// GET /api/coach/observability/routing/logs?start=...&end=...&min_confidence=0.8
{
  "total": 156,
  "logs": [
    {
      "trace_id": "trace_abc",
      "route_level": "L4",
      "message": "帮我匹配适合我的岗位",
      "matched_agent": "CareerMatchCoach",
      "llm_confidence": 0.87,
      "corrected_by_user": false,
      "task_success": true,
      "created_at": "2026-05-08T10:00:00Z"
    }
  ]
}
```

### 6.6 NDJSON 新增可选事件（P4 新增，不在原 Spec 事件列表中）

> **注意**：`route_log` 事件为 P4 可观测性阶段新增，用于前端实时展示路由决策信息。不影响现有事件流，不处理的前端可安全忽略。

```json
{
  "event": "route_log",
  "routeLevel": "L2",
  "matchedAgent": "ResumeCoach",
  "matchedRule": "简历"
}
```

---

## 7. Dead Letter Queue 监控设计

### 7.1 数据来源

`outbox_events` 表中 `status = 'dead_letter'` 的记录。

### 7.2 监控指标

| 指标 | 查询 |
|------|------|
| DLQ 总数 | `SELECT COUNT(*) FROM outbox_events WHERE status = 'dead_letter'` |
| 按事件类型 | `SELECT event_type, COUNT(*) ... GROUP BY event_type` |
| 最新事件 | `SELECT * ... ORDER BY created_at DESC LIMIT 20` |
| 趋势 | `SELECT date(created_at), COUNT(*) ... GROUP BY date(created_at)` |

### 7.3 无自动告警

P4 仅提供监控 API 端点。实际告警集成（邮件/钉钉/企业微信）属于生产部署配置，不在本项目范围内。

---

## 8. Agent 准确率追踪设计

### 8.1 数据来源

`feedback_records` 表，`target_type` 记录 Agent 名称：

```sql
SELECT
    target_type AS agent,
    COUNT(*) AS feedback_count,
    SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) AS positive,
    SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) AS negative,
    SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) AS neutral
FROM feedback_records
WHERE created_at BETWEEN ? AND ?
GROUP BY target_type;
```

### 8.2 准确率计算

```
accuracy = positive / (positive + negative) * 100
```

- 仅 `positive` 和 `negative` 计入分母，`neutral` 仅展示
- 反馈数 < 5 的 Agent 标记 `insufficient_data`，不计算准确率

---

## 9. 测试文件

### 9.1 回滚 E2E 测试

文件：`backend/tests/api/test_coach_rollback_e2e.py`

| # | 测试 | 场景 |
|---|------|------|
| 1 | `test_rollback_through_api_full_flow` | 创建 mutation → 调用 rollback → 验证 summary 字段恢复 |
| 2 | `test_rollback_preserves_subsequent_mutations` | 回滚不丢失其他字段的 mutation |
| 3 | `test_rollback_provisional_clears_overlay` | provisional overlay 回滚后 cleared |
| 4 | `test_rollback_nonexistent_id` | 不存在的 mutation_id → 404 |
| 5 | `test_rollback_already_rolled_back` | 已回滚的 mutation 再回滚产生新记录 |
| 6 | `test_concurrent_rollback_safety` | 并发 rollback 请求不产生竞态 |

需要新增内部 rollback API 端点 `POST /api/coach/memory/mutations/{id}/rollback`。

### 9.2 审计链完整性测试

文件：`backend/tests/services/memory/test_audit_chain.py`

| # | 测试 | 断言 |
|---|------|------|
| 1 | `test_all_mutations_have_trace_id` | `trace_id NOT NULL` |
| 2 | `test_rollback_chain_bidirectional` | `rollback_of` / `rolled_back_by` 双向一致 |
| 3 | `test_rollback_chain_no_dangling` | 引用的 mutation_id 必须存在 |
| 4 | `test_rolled_back_by_links_valid` | 反向链接完整 |
| 5 | `test_idempotency_key_uniqueness` | UNIQUE 约束未被违反 |
| 6 | `test_decision_journal_consistency` | `proposal_json` 可反序列化 |
| 7 | `test_mutation_created_at_chronological` | 时间线正确 |

### 9.3 DLQ + 路由 + 准确率测试

| 文件 | 测试数 |
|------|--------|
| `tests/services/observability/test_dlq_monitor.py` | 3 |
| `tests/services/observability/test_routing_metrics.py` | 3 |
| `tests/services/observability/test_agent_accuracy.py` | 3 |

### 9.4 LLM 输出验证测试（deepeval）

基于 `deepeval` 框架，对关键场景下的 LLM 输出做结构化验证：

文件：`backend/tests/test_llm_output.py`

```python
# 依赖：pip install deepeval
from deepeval import assert_test
from deepeval.metrics import ToolCorrectnessMetric, AnswerRelevancyMetric

def test_resume_coach_calls_parse_resume():
    """简历分析场景应调用 parse_resume 工具"""
    result = run_agent_scenario(
        agent="ResumeCoach",
        user_message="帮我分析我上传的简历",
        attachments=[{"file_id": "f_001", "name": "resume.pdf"}],
    )
    tool_correctness = ToolCorrectnessMetric()
    assert_test(result, [tool_correctness])

def test_learning_path_coach_requests_evidence():
    """学生声称掌握技能时，必须要求证据"""
    result = run_agent_scenario(
        agent="LearningPathCoach",
        user_message="我已经完全掌握 Python 了",
    )
    assert "测验" in result.final_response or "项目" in result.final_response
    assert "证据" in result.final_response or "验证" in result.final_response

def test_output_no_pii():
    """delta 输出不含敏感信息（脱敏验证）"""
    result = run_agent_scenario(
        agent="ResumeCoach",
        user_message="我的手机号是 13812345678，帮我分析",
    )
    for event in result.stream_events:
        if event["event"] == "delta":
            assert "138" not in event["delta"]
```

| # | 测试 | 断言 |
|---|------|------|
| 1 | `test_resume_coach_calls_parse_resume` | 工具调用正确 |
| 2 | `test_learning_path_coach_requests_evidence` | 回复含证据要求 |
| 3 | `test_output_no_pii` | delta 不含手机号 |
| 4 | `test_output_no_id_card` | delta 不含身份证号 |
| 5 | `test_career_match_coach_compares_industries` | 行业对比工具调用正确 |
| 6 | `test_report_coach_generates_report` | 报告生成流程完整 |

### 9.5 性能测试

端点级别性能验证，确保 P95 首 token 延迟和 outbox 处理能力达标。

文件：`backend/tests/test_performance.py`

| # | 测试 | 目标 | 工具 |
|---|------|------|------|
| 1 | `test_50_concurrent_sessions` | 50 并发对话不崩溃，P95 首 token < 5s | `asyncio.gather` + httpx |
| 2 | `test_outbox_no_backlog` | 100 事件并发后 pending < 50 | 批量 emit + worker 处理 |
| 3 | `test_outbox_worker_throughput` | worker 每分钟处理至少 60 条事件 | 计时 + 计数 |
| 4 | `test_memory_mutation_latency` | adjudicate 全链路 < 100ms | time.monotonic |
| 5 | `test_route_l4_llm_latency` | L4 LLM 路由 < 500ms（含 fallback） | `asyncio.wait_for` |

---

## 10. 验收标准

1. **DLQ 监控端点可用**：`GET /api/coach/observability/dlq` 返回正确统计
2. **路由日志写入**：每次对话后 `routing_log` 有记录，route_level 正确
3. **路由命中率端点正确**：各层占比之和 100%，Agent 分布合理
4. **Agent 准确率报告可用**：基于反馈数据的计算正确
5. **回滚 E2E 全部通过**：6 场景全部覆盖
6. **审计链完整性测试全部通过**：7 项验证全部通过
7. **路由日志导出可用**：格式满足 P5 L3 训练需求
8. **P0–P3 无回归**
9. **deepeval LLM 验证测试通过**：6 场景全部覆盖
10. **性能测试基准达标**：50 并发 P95 首 token < 5s，adjudicate < 100ms

---

## 11. CI 门禁

| 检查 | 命令 | 阻断条件 |
|------|------|---------|
| 单元测试 | `pytest tests/ -k "not integration and not e2e and not performance"` | ❌ 失败 |
| 覆盖率 | `pytest --cov=backend/app/services --cov-report=term-missing` | ❌ < 80% |
| 集成测试 | `pytest tests/ -k "integration"` | ❌ 失败 |
| 类型检查 | `mypy backend/app/` | ❌ 错误 |
| E2E | `playwright test` | ❌ 失败（仅 main 分支阻断） |
| 性能 | `pytest tests/ -k "performance"` | ⚠️ 回归 > 20% 退化（告警不阻断） |
| LLM 输出验证 | `pytest tests/test_llm_output.py` | ❌ 失败（仅 CI 执行，非本地强制） |

**CI 配置文件**（需新建）：

```
.github/workflows/coach-ci.yml
  - trigger: push to feature-agentic, PR to main
  - steps: install → mypy → pytest (unit + integration) → coverage → playwright → deepeval (optional)
```

配置文件不在本 plan 的实现范围。实际 CI 配置由 DevOps 在部署时根据上表创建。

---

## 11. 回滚方案

### 方案 A：移除可观测性端点

```
coach_observability.py 注释所有端点 → main.py 移除 router → coordinator.py 注释日志写入
```

`routing_log` 表空跑但无害。

### 方案 B：关闭路由日志写入

feature flag 包裹，暂停写入，数据不丢。

### 方案 C：全量回滚

```
git revert <p4-merge-commit>
```

---

## 12. 进入 P5 的条件

- [ ] 全部 10 项验收标准通过
- [ ] 回滚 E2E 6 场景全部通过
- [ ] 审计链完整性 7 项测试全部通过
- [ ] 可观测性 3 端点+3 测试通过
- [ ] deepeval LLM 验证 6 测试全部通过
- [ ] 性能测试基准达标
- [ ] CI 门禁配置完成
- [ ] `routing_log` 表至少有 50+ 条测试数据
- [ ] P0–P3 验收标准无回归

---

## 附录 A：P4 变更文件清单

| 文件 | P3 状态 | P4 状态 | 操作 |
|------|:-------:|:-------:|:----:|
| `services/observability/dlq_monitor.py` | — | 新增 | 创建 |
| `services/observability/routing_metrics.py` | — | 新增 | 创建 |
| `services/observability/agent_accuracy.py` | — | 新增 | 创建 |
| `services/feedback/service.py` | — | 新增 | 创建（P2b 仅有模型/表，P4 补全写逻辑 + 频率控制） |
| `services/feedback/compensation_engine.py` | — | 新增 | 创建（负反馈补偿链） |
| `api/coach_observability.py` | — | 新增 | 创建 |
| `api/coach_memory.py` | — | 新增 | 创建（3 个 rollback/mutation 管理端点） |
| `services/coach_coordinator.py` | ✓ | 修改 | 追加路由日志写入 |
| `schemas/agent.py` | ✓ | 修改 | StreamEvent 模型新增 route_log 可选字段 |
| `main.py` | ✓ | 修改 | 注册 observability + memory router |
| `pages/coach/types.ts` | ✓ | 修改 | 追加 route_log 类型 |
| `tests/api/test_coach_rollback_e2e.py` | — | 新增 | 6 用例 |
| `tests/services/memory/test_audit_chain.py` | — | 新增 | 7 用例 |
| `tests/services/observability/test_dlq_monitor.py` | — | 新增 | 3 用例 |
| `tests/services/observability/test_routing_metrics.py` | — | 新增 | 3 用例 |
| `tests/services/observability/test_agent_accuracy.py` | — | 新增 | 3 用例 |
| `tests/test_llm_output.py` | — | 新增 | 6 用例（deepeval） |
| `tests/test_performance.py` | — | 新增 | 5 用例 |
| `.github/workflows/coach-ci.yml` | — | 新增 | CI 配置文件（参考 §11） |

**新增：** 13 文件（7 后端 + 6 测试 + 1 CI 配置）
**修改：** 4 文件（3 后端 + 1 前端）

## 附录 B：内部 Rollback API

| 端点 | 方法 | 说明 |
|------|------|------|
| `POST /api/coach/memory/mutations/{id}/rollback` | POST | 触发回滚，返回新 mutation ID |
| `GET /api/coach/memory/mutations/{id}` | GET | mutation 详情 |
| `GET /api/coach/memory/mutations` | GET | 按学生列 mutation 历史 |
