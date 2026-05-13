# 2026-05-09 P2 可信记忆层 + P2b 全套工具集成与事件总线

## 概述

在 P1（记忆系统 + 会话持久化）基础上，P2 实现**可信记忆层**——子 Agent 只能通过 ToolRegistry 的 mutation_gated 工具提交记忆变更提议，由 Adjudicator 裁决后决定是否写入 ConversationSummary。P2b 补齐全部 22 个工具对接、ToolExecutor 重试机制和 Outbox 事件总线。

**核心变化**：

| P1 (基础版) | P2 (可信版) | P2b (工具集成+事件总线) |
|-------------|-------------|---------------------|
| Coordinator 可直接 `persist_conversation_summary()` | Coordinator 只能保存系统元数据；用户数据变更必须走工具提议 | 所有突变仍通过 Adjudicator，新增级联事件 |
| 仅 `get_job_categories` 一个 mock readonly 工具 | 仅 `process_memory_proposal` 一个 mutation_gated 工具 | **22 个工具全部注册可用**（14 readonly + 4 mutation_safe + 3 mutation_gated + 1 内部） |
| 无 trace 约束 | 所有 mutation 必须带 trace_id | trace_id 贯穿 ToolExecutor |
| provisional 概念定义但无实战 | provisional 写入 provisional_overlays，不覆盖 confirmed | 同 P2 |
| rollback 接口占位 | 完整双向链式链接 rollback | 同 P2 |
| 无 memory_result 事件 | NDJSON 新增 `memory_result` 事件 | 同 P2 |
| 无 Outbox | 无 Outbox | `outbox_events` 表 + OutboxEmitter + BackgroundWorker |
| 无级联事件 | 无级联事件 | `skill_mastered → [ReportCoach, ResumeCoach]` |

---

## 新增文件（13 个）

### P2 核心：记忆系统 v1.1（5 个）

| 文件 | 说明 |
|------|------|
| `backend/app/services/memory/rollback.py` | `create_rollback_mutation()` — 创建回滚 mutation（非物理删除），双向链接 `rollback_of` + `rolled_back_by` |
| `backend/app/services/memory/proposal_handler.py` | `handle_memory_proposal()` — Tool 执行器入口，组装 MemoryMutationProposal → 调 adjudicate → 返回结果 |
| `backend/tests/services/memory/test_rollback.py` | 7 个 rollback 单元测试 |
| `backend/tests/services/memory/test_proposal_handler.py` | 6 个 proposal 全流程集成测试 |
| `backend/tests/api/test_coach_memory_mutation.py` | 通过 `/api/coach/chat/stream` 验证 mutation 事件序列 |

### P2 TokenBudget（1 个）

| 文件 | 说明 |
|------|------|
| `backend/app/services/token_budget.py` | `TokenBudget` 类 + `compact_context()` 上下文压缩 |

### P2 测试（1 个）

| 文件 | 说明 |
|------|------|
| `backend/tests/services/test_token_budget.py` | 5 个 TokenBudget 单元测试 |

### P2b Outbox 事件总线（3 个）

| 文件 | 说明 |
|------|------|
| `backend/app/services/outbox/__init__.py` | 包初始化 |
| `backend/app/services/outbox/emitter.py` | `OutboxEmitter.emit_event()` — 幂等写入 `outbox_events` 表；`CASCADE_WHITELIST` 常量（`skill_mastered → ReportCoach/ResumeCoach`, `goal_reached → ReportCoach`） |
| `backend/app/services/outbox/worker.py` | `BackgroundWorker` — 轮询 pending 事件 → 锁定投递 → 更新状态（指数退避 1min→5min→15min，最多 3 次 → dead_letter） |

### P2b ToolExecutor + 全量 Handler（2 个）

| 文件 | 说明 |
|------|------|
| `backend/app/services/tools/executor.py` | `ToolExecutor` — `execute_with_recovery()` 含指数退避重试（readonly/safe 3 次，mutation_gated 不重试，30s 硬超时） |
| `backend/app/services/tools/handlers.py` | 全部 22 个工具 handler 函数 + `readonly_api_handler` 工厂 |

### P2b 测试（3 个）

| 文件 | 说明 |
|------|------|
| `backend/tests/services/tools/test_tool_executor.py` | 6 个 ToolExecutor 测试（重试/退避/gated 不重试/工具不存在/超时） |
| `backend/tests/services/tools/test_tool_handlers.py` | 28 个 handler 测试（readonly 工厂、22 个工具各自边界、mutation_gated 证据判断） |
| `backend/tests/services/outbox/test_outbox.py` | 8 个 Outbox 测试（幂等写入、worker 投递、重试、dead_letter、锁定机制） |

---

## 修改文件（14 个）

### P2 记忆系统修改（7 个）

| 文件 | 改动 |
|------|------|
| `backend/app/services/memory/manager.py` | `persist_conversation_summary()` 改为 internal（前缀 `_`）；新增 `save_coordinator_metadata()`；propose/commit 路径增加 trace_id 非空校验；`_commit_mutation()` 激活 overlay 写入和 competency_history 写入；新增公开 `commit_mutation()` 供 rollback 调用 |
| `backend/app/services/memory/adjudicator.py` | 实现完整 9 态决策矩阵（low/medium/high risk × confidence）；overlay_target 冲突检测；`with_trace_id()` 上下文管理器 |
| `backend/app/services/tool_registry.py` | 新增 `Tool` dataclass（classification/agent/display_name/endpoint/method）；`register_tool()`/`get()`/`list_all()`/`get_schema_for_llm()`/`get_for_agent()`；`register_all_tools()` 批量注册 |
| `backend/app/services/coach_coordinator.py` | 构造函数新增 `outbox_emitter`/`tool_executor` 参数；`run()` 中 mutation_gated 走完整 propose→adjudicate→commit 链路；注入 trace_id；对话结束后改为 `save_coordinator_metadata()` 而非全量 persist；Token Budget 集成；P2b cascade 事件发射 |
| `backend/app/services/context_builder.py` | `_format_hard_memory()` 激活 provisional_overlays 渲染（带"待确认"标记）；`format_conversation_summary_with_overlays()` 函数 |
| `backend/app/schemas/agent.py` | 新增 `MemoryResultEvent` Pydantic 模型 |
| `backend/app/api/coach.py` | 注册 `process_memory_proposal` tool（mutation_gated）；P2b 调用 `register_all_tools()` 注册 22 个工具；注入 `OutboxEmitter`/`ToolExecutor` 到 Coordinator |

### P2b Outbox + 模型修改（3 个）

| 文件 | 改动 |
|------|------|
| `backend/app/models/coach.py` | 新增 `OutboxEvent` ORM 模型 |
| `backend/app/main.py` | `init_db()` 模型元组加入 `OutboxEvent`；lifespan 启动 `BackgroundWorker`（5s 轮询间隔） |
| `backend/app/models/__init__.py` | 导入 coach 相关模型 |

### P2 已有测试修改（4 个）

| 文件 | 改动 |
|------|------|
| `backend/tests/services/memory/test_adjudicator.py` | 完全重写：14 个测试覆盖 9 态矩阵全部组合 + 冲突检测（4 场景）+ 确定性验证 |
| `backend/tests/services/memory/test_memory_manager.py` | 追加 6 个测试（coordinator_metadata、competency_history 写入、三态写入） |
| `backend/tests/services/test_tool_registry.py` | 5 个基础注册/执行测试 |
| `backend/tests/services/test_coach_coordinator.py` | 5 个端到端协调器测试 |

### 前端修改（2 个）

| 文件 | 改动 |
|------|------|
| `myapp/src/pages/coach/api.ts` | `StreamEvent` 联合类型新增 `memory_result` 事件 |
| `myapp/src/pages/coach/hooks/useCoachChat.ts` | 可选处理 `memory_result` 事件 |

---

## 数据库变更

### P2：无新增表（复用 P1 7 张表）

| 表 | P2 变化 |
|----|---------|
| `memory_mutations` | trace_id 强制非空（应用层）；overlay_target 正式使用；rollback_of / rolled_back_by 正式使用；UNIQUE 幂等键正式启用 |
| `conversation_summaries` | schema_version 升级到 2；`provisional_overlays` 正式写入 |
| `decision_journal` | 开始稳定写入 |

### P2b：新增 1 张表 — `outbox_events`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PK | 事件 ID（格式 `evt_<hex>`） |
| `event_type` | TEXT | 事件类型 |
| `payload_json` | TEXT | 事件载荷 |
| `idempotency_key` | TEXT UNIQUE | 幂等键 |
| `trace_id` | TEXT | 全链路追踪 ID |
| `status` | TEXT | `pending` / `processing` / `delivered` / `failed_retryable` / `dead_letter` |
| `attempt_count` | INTEGER | 重试次数 |
| `next_retry_at` | TEXT | 下次重试时间 |
| `locked_at` / `locked_by` | TEXT | 悲观锁 |
| `last_error` | TEXT | 最后错误信息 |
| `delivered_at` | TEXT | 投递完成时间 |

状态机：`pending → processing → delivered`（成功）或 `pending → processing → failed_retryable → pending`（重试）或 `failed_retryable → dead_letter`（3 次失败后）。

---

## 22 工具注册表

| Agent | 工具名 | 中文名 | 分类 | 端点 |
|-------|--------|--------|------|------|
| **ResumeCoach** | `parse_resume` | 解析简历 | readonly | `POST /api/student-competency-profile/chat/stream` |
| | `read_profile` | 读取能力画像 | readonly | `GET /api/student-competency-profile/runtime` |
| | `analyze_gap` | 简历目标差距分析 | readonly | `POST /api/career-development-report/personal-growth-report` |
| | `suggest_keyword` | 建议关键词 | readonly | `GET /api/student-competency-profile/latest-analysis` |
| **CareerMatchCoach** | `search_matches` | 搜索匹配岗位 | readonly | `GET /api/job-exploration-match` |
| | `compare_industries` | 同岗行业对比 | readonly | `GET /api/job-requirement-profile/vertical` |
| | `search_company` | 搜索公司 | readonly | `GET /api/jobs` |
| | `save_to_shortlist` | 收藏到入围名单 | **mutation_safe** | `POST /api/career-development/favorites` |
| | `read_job_graph` | 读取岗位能力图谱 | readonly | `GET /api/job-requirement-profile/overview` |
| **LearningPathCoach** | `read_plan` | 读取学习计划 | readonly | `GET /api/career-development-report/learning-path` |
| | `suggest_resources` | 推荐学习资源 | readonly | `POST /api/career-development-report/goal-setting-path-planning` |
| | `verify_and_record_progress` | 验证记录进度 | **mutation_gated** | Memory System |
| | `create_review` | 创建复盘 | mutation_safe | `POST /api/snail-learning-path/reviews` |
| **ReportCoach** | `read_report` | 读取报告草稿 | readonly | `GET /api/career-development-report/personal-growth-report` |
| | `generate_report` | 生成报告 | mutation_safe | `POST /api/career-development-report/personal-growth-report/tasks` |
| | `update_section` | 编辑报告章节 | mutation_safe | `PUT /api/career-development-report/personal-growth-report` |
| | `append_achievement` | 追加成就 | **mutation_gated** | Memory System |
| | `update_reflection` | 更新反思 | **mutation_gated** | Memory System |
| | `export_report` | 导出报告 | readonly | `GET /api/career-development-report/personal-growth-report/export` |
| **Shared** | `switch_agent` | 切换子 Agent | 内部 | — |
| | `recall_memory` | 搜索记忆 | readonly | Qdrant + SQLite |
| | `get_home_summary` | 获取首页摘要 | readonly | `GET /api/home-v2` |

**执行路径**：
- `readonly` → `readonly_api_handler(endpoint, method, args, context)` → 调用现有 REST API → `ToolResult(summary + detail)`
- `mutation_safe` → 专用 handler → 调用现有 POST/PUT API → `ToolResult`
- `mutation_gated` → handler（evidence evaluation → confidence → risk → propose）→ Adjudicator → commit → 级联事件

---

## 重试策略

| 分类 | 重试次数 | 退避策略 | 超时 | 失败处理 |
|------|:--------:|---------|:----:|---------|
| readonly | 3 | 指数退避 1s→2s→4s | 30s | `ToolResult(success=False, recovery="max_retries_exceeded")` |
| mutation_safe | 3 | 同上 | 30s | 同上 |
| mutation_gated | 0 | 不重试 | — | Adjudicator 裁决替代 |

---

## 级联事件总线

```
emitter.emit_event()
  → INSERT INTO outbox_events (status='pending')
  → BackgroundWorker.poll()
    → SELECT WHERE status IN ('pending', 'failed_retryable') AND next_retry_at <= now()
    → UPDATE status='processing', locked_at=now()
    → deliver(event) → conversation_summaries.pending_events
      → 成功: UPDATE status='delivered'
      → 失败:
          attempt_count < 3: UPDATE status='failed_retryable', next_retry_at=now()+backoff
          attempt_count >= 3: UPDATE status='dead_letter', last_error=...
```

级联白名单：`skill_mastered → [ReportCoach, ResumeCoach]`，`goal_reached → [ReportCoach]`。最多 1 层级联。

---

## API 契约变化

### NDJSON 新增事件 — `memory_result`

```
route → meta → (tool_call → tool_result → memory_result)* → delta → ... → done
```

```json
{
  "event": "memory_result",
  "mutationId": "mut_abc123",
  "decisionType": "auto_confirmed",
  "targetField": "skills.python.mastery_status",
  "confidence": 0.97,
  "summary": "记忆已确认：skills.python.mastery_status -> mastered",
  "adjudicationReasoning": "low risk + high confidence — auto confirmed"
}
```

P2b 不新增事件类型。

---

## Adjudicator 裁决矩阵

| risk_level | confidence | decision_type | overlay_target | 说明 |
|------------|-----------|---------------|----------------|------|
| low | ≥ 0.95 | AUTO_CONFIRMED | False | 直接写入主字段 |
| low | 0.80–0.95 | PROVISIONAL_WRITE | 冲突检测 | 已有 confirmed 则 overlay |
| low | < 0.80 | REJECTED | — | 仅写 audit + journal |
| medium | ≥ 0.80 | PROVISIONAL_WRITE | 冲突检测 | medium capped，最高 provisional |
| medium | < 0.80 | REJECTED | — | |
| high | ≥ 0.80 | PROVISIONAL_WRITE | 始终 True | high 永远不能 auto confirmed |
| high | < 0.80 | REJECTED | — | |

三态写入：

| 状态 | memory_mutations | decision_journal | conversation_summaries |
|------|:---:|:---:|:---:|
| auto_confirmed | ✓ | ✓ | ✓ 写主字段 |
| provisional_write | ✓ | ✓ | ✓ 写 overlay（不覆盖主字段） |
| rejected | ✓ | ✓ | ✗ 不碰 |

---

## 测试结果

| 指标 | 结果 |
|------|------|
| P2 + P2b 全部测试 | **133/133 通过** |
| Outbox 测试（8） | ✅ 幂等写入/worker 投递/重试/dead_letter/锁定 |
| ToolExecutor 测试（6） | ✅ 重试/退避/gated 不重试/工具不存在/超时 |
| ToolHandler 测试（28） | ✅ readonly 工厂/22 工具/mutation_gated 证据判断 |
| Adjudicator 测试（14） | ✅ 9 态矩阵/冲突检测/确定性 |
| MemoryManager 测试（19） | ✅ CRUD/三态写入/competency_history |
| Rollback 测试（7）+ Proposal 测试（6） | ✅ 双向链接/值恢复/overlay 清除 |
| TokenBudget 测试（5） | ✅ 阈值/压缩/保留最后 N 条 |
| CoachCoordinator 测试（5） | ✅ delta/tool_call/错误处理/消息加载 |
| ToolRegistry 测试（5） | ✅ 注册/执行/重复/不存在/空 |
| 会话 CRUD API 测试（5） | ✅ |
| **零回归** | P0/P1 全部验收标准仍通过 |

---

## 进入 P3 的条件

- [x] 全部 13 项 P2b 验收标准通过
- [x] Tool handler 测试覆盖率 ≥ 85%
- [x] ToolExecutor 重试测试覆盖率 ≥ 85%
- [x] Outbox 测试覆盖率 ≥ 85%
- [x] P0–P2 验收标准无回归
- [x] P2 全部 14 项验收标准通过
- [x] Adjudicator 测试覆盖率 ≥ 90%
- [x] Rollback 测试覆盖率 ≥ 85%
