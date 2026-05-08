# P2：Memory System v1.1 接入

> 日期：2026-05-08
> 基于：[AI 教练智能体系统设计](../specs/2026-05-08-coach-agent-design.md)、[P0 三阶段实现计划](./2026-05-08-coach-p0-implementation-plan.md)、[P1 会话持久化实现计划](./2026-05-08-coach-p1-implementation-plan.md)
> 前提：P0c + P1 全部验收标准通过
> 原则：增量构建于 P1 代码之上，不改 P0/P1 已实现功能

---

## 1. 目标

在 P1 的会话持久化和基础 MemoryManager 之上，实现**可信记忆层**——让子 Agent（LLM）只能通过 ToolRegistry 的 mutation_gated 工具提交记忆变更提议，由 Adjudicator 裁决后决定是否写入 ConversationSummary。

**一句话：P1 能存能读，P2 让它可信。**

核心变化：

| P1 (基础版) | P2 (可信版) |
|-------------|-------------|
| CoachCoordinator 可直接调用 `persist_conversation_summary()` | Coordinator 只能保存系统元数据（current_stage等），用户数据变更必须走工具提议 |
| MemoryManager.write 无 trace 约束 | 所有 mutation 记录必须带 trace_id / source_event_id / source_idempotency_key |
| provisional 概念定义但无实战验证 | provisional 写入 provisional_overlays，不覆盖 confirmed |
| rollback 接口占位 | rollback 通过新增 mutation 实现，双向链式链接 |
| 无 memory mutation NDJSON 事件 | NDJSON 新增 `memory_result` 事件，前端可展示裁定结果 |

---

## 2. 非目标

- 不接真实业务工具（22 个工具中的 readonly/mutation_safe 工具是 P3 范围）
- 不接 mutation_gated 工具 `verify_and_record_progress`、`append_achievement`、`update_reflection`（P3 真实工具对接时接入）
- 不做 Outbox worker（P5）
- 不做 Dead Letter Queue（P5）
- 不做反馈闭环自动补偿（P5）
- 不做 CollectiveWisdom 数据填充（P5）
- 不做 L3 路由训练（P5）
- 不重写 P0/P1
- 不改现有 ChatStream（简历解构页内嵌）
- 不改现有 66 个 REST API
- 不新增 SQLite 表（P1 已创建 5 张，P2 复用）

---

## 3. 数据库迁移

**无新增表。** P1 已创建以下 5 张表，P2 正式启用其中未使用的字段：

### 3.1 已有表字段启用

**表 `memory_mutations`**
- `trace_id` — P2 强制非空（应用层校验，DDL 不改）
- `overlay_target` — 正式使用（P1 未使用）
- `rollback_of` / `rolled_back_by` — 正式使用（双向链接）
- `UNIQUE(student_id, target_table, target_field, source_idempotency_key)` — 正式启用幂等保障

**表 `conversation_summaries`**
- `schema_version` — 升级到 2（P1 为 1），标记 overlay 数据存在
- `summary_json` 中 `provisional_overlays` — 正式写入

**表 `decision_journal`**
- 保持 P1 DDL 不变，P2 开始有稳定写入

### 3.2 回滚迁移

无 DDL 回滚需求（P2 未改 DDL）。

---

## 4. 后端文件级计划

### 4.1 新增文件（5 个）

| # | 文件 | 职责 |
|---|------|------|
| 1 | `backend/app/services/memory/rollback.py` | `create_rollback_mutation()` — 创建回滚 mutation（非物理删除），双向链接 |
| 2 | `backend/app/services/memory/proposal_handler.py` | `handle_memory_proposal()` — Tool 执行器调用的入口函数，组装 MemoryMutationProposal → 调 adjudicate → 返回结果 |
| 3 | `backend/tests/services/memory/test_rollback.py` | rollback 单元测试 |
| 4 | `backend/tests/services/memory/test_proposal_handler.py` | proposal 全流程集成测试 |
| 5 | `backend/tests/api/test_coach_memory_mutation.py` | 通过 `/api/coach/chat/stream` 验证 mutation 事件序列 |

### 4.2 修改文件（7 个）

| # | 文件 | 改动 |
|---|------|------|
| 1 | `backend/app/services/memory/manager.py` | (1) `persist_conversation_summary()` 改为 internal（前缀 `_`）<br>(2) 新增 `save_coordinator_metadata()` — 仅允许更新 `current_stage` / `last_agent` / `next_recommended_action`<br>(3) propose / commit 路径增加 trace_id 非空校验<br>(4) `_commit_mutation()` 激活 overlay 写入路径；新增公开 `commit_mutation()` 供 rollback 模块调用 |
| 2 | `backend/app/services/memory/adjudicator.py` | (1) 激活 overlay_target 冲突检测逻辑（已有 confirmed 记录时设 True）<br>(2) 增加 `with_trace_id(trace_id)` 上下文管理器 |
| 3 | `backend/app/services/tool_registry.py` | 新增 mutation_gated 分类支持；注册 `process_memory_proposal` tool |
| 4 | `backend/app/services/coach_coordinator.py` | (1) 循环结束后移除 `persist_conversation_summary()`<br>(2) 改为调用 `save_coordinator_metadata()`<br>(3) tool_call 处理逻辑增加 mutation_gated 分支<br>(4) 传递 trace_id 到 tool 执行上下文 |
| 5 | `backend/app/services/context_builder.py` | `_format_hard_memory()` 激活 provisional_overlays 渲染（带"待确认"标记） |
| 6 | `backend/app/schemas/agent.py` | `StreamEvent` 新增 `memory_result` 事件字段 |
| 7 | `backend/app/api/coach.py` | 初始化时将 `process_memory_proposal` tool 注册到 ToolRegistry；传递 trace_id |

---

## 5. 前端文件级计划

**P2 仅调整类型定义，不新增 UI 组件**。mutation_gated 工具的调用走已有的 `tool_call` / `tool_result` NDJSON 事件流，ToolCallCard（P0c 已实现）即可展示。

| # | 文件 | 改动 |
|---|------|------|
| 1 | `myapp/src/pages/coach/api.ts` | `StreamEvent` 联合类型新增 `{ event: 'memory_result'; mutationId: string; decisionType: string; targetField: string; confidence: number; summary: string; adjudicationReasoning: string }` |
| 2 | `myapp/src/pages/coach/hooks/useCoachChat.ts` | 可选处理 `memory_result` 事件（设置 memory mutation 状态），不处理不影响现有功能 |

**明确：无新增 UI 组件、无新增页面、无新增路由。**

---

## 6. API 契约变化

### 6.1 NDJSON 新增事件

新增 `memory_result` 事件（在 `tool_result` 之后、下一条 `delta` 或 `tool_call` 之前）：

```json
{
  "event": "memory_result",
  "mutationId": "mut_abc123",
  "decisionType": "auto_confirmed",
  "targetField": "skills.python.mastery_status",
  "confidence": 0.97,
  "summary": "记忆已确认：skills.python.mastery_status → mastered",
  "adjudicationReasoning": "low risk + high confidence — auto confirmed"
}
```

字段说明：

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | string | 固定 `"memory_result"` |
| `mutationId` | string | 本次 mutation 记录 ID |
| `decisionType` | string | `auto_confirmed` / `provisional_write` / `rejected` |
| `targetField` | string | 目标字段路径 |
| `confidence` | float | 置信度 |
| `summary` | string | 面向前端可读摘要 |
| `adjudicationReasoning` | string | 裁决理由（可选，调试用） |

### 6.2 完整事件序列（带 memory mutation）

```
route → tool_call → tool_result → memory_result → delta → ... → done
```

### 6.3 REST 端点变更

**无**。P1 的 3 个 session 端点不变，不新增 REST 端点。

---

## 7. Memory 写入流程

### 7.1 可信写入（推荐——子 Agent 提议）

```
用户："我已经掌握了 Python 基础语法"
  → LLM 决定调用 process_memory_proposal 工具
  → ToolRegistry.execute(tool_name, tool_args)
    → proposal_handler.handle_memory_proposal(args, context)
      → 组装 MemoryMutationProposal（student_id/trace_id 从 context 注入）
      → memory_manager.propose_memory_mutation(proposal)
        → adjudicate()
          → 返回 decision_type + reasoning
          → 写入 memory_mutations + decision_journal
          → 非 rejected 则 commit_memory_mutation()
      → 返回 ToolResult
  → yield tool_result NDJSON 事件
  → yield memory_result NDJSON 事件
```

### 7.2 系统元数据自动更新（仅 Coordinator 可做）

```
对话结束后
  → memory_manager.save_coordinator_metadata(student_id, {
      current_stage: active_agent,
      last_agent: agent_name,
      next_recommended_action: "...",
    })
  → 直接 UPDATE conversation_summaries（set json_set(summary_json, '$.current_stage', ...)）
  → 不走 mutation，因为这些字段不涉及用户画像可信度
```

### 7.3 禁止路径

```python
# ❌ 禁止 — P1 有，P2 移除
await memory_manager.persist_conversation_summary(student_id, summary)

# ✅ 允许 — 只更新元数据
await memory_manager.save_coordinator_metadata(student_id, metadata)

# ✅ 允许 — 读取记忆
summary = await memory_manager.read_conversation_summary(student_id)
```

---

## 8. propose → adjudicate → commit 流程

### 8.1 Adjudicator 裁决矩阵

| risk_level | confidence | decision_type | overlay_target | 说明 |
|------------|-----------|---------------|----------------|------|
| low | ≥ 0.95 | AUTO_CONFIRMED | False | 直接写入主字段 |
| low | 0.80–0.95 | PROVISIONAL_WRITE | 冲突检测 | 如已有 confirmed 则 overlay |
| low | < 0.80 | REJECTED | — | 仅写 audit + journal |
| medium | ≥ 0.95 | PROVISIONAL_WRITE | 冲突检测 | medium capped，最高 provisional |
| medium | 0.80–0.95 | PROVISIONAL_WRITE | 冲突检测 | |
| medium | < 0.80 | REJECTED | — | |
| high | ≥ 0.95 | PROVISIONAL_WRITE | 始终 overlay | high 永远不能 auto confirmed |
| high | 0.80–0.95 | PROVISIONAL_WRITE | 始终 overlay | |
| high | < 0.80 | REJECTED | — | |

**冲突检测覆盖额外逻辑：**
- provisional 提议命中已有 confirmed 记录 → overlay_target = True（写入 provisional_overlays，不覆盖主字段）
- provisional 提议命中已有 provisional 记录 → 覆盖（以新为准，在 overlay dict 中覆盖 key）
- high risk 的所有 provisional 结果 → 始终设 overlay_target = True（双重保护）

### 8.2 三态写入规则

| 状态 | memory_mutations | decision_journal | conversation_summaries |
|------|:---:|:---:|:---:|
| auto_confirmed | ✓ 写入 | ✓ 写入 | ✓ 写主字段 |
| provisional_write | ✓ 写入 | ✓ 写入 | ✓ 写 overlay（不覆盖主字段） |
| rejected | ✓ 写入 | ✓ 写入 | ✗ 不碰 |

### 8.3 trace_id 约束

- 每个 `MemoryMutationProposal` 必须包含 `trace_id`
- `trace_id` 由 `CoachCoordinator.run()` 在请求开始时生成
- mutation 链（propose → adjudicate → commit）全程携带同一 `trace_id`
- rollback mutation 继承原始 mutation 的 `trace_id`

---

## 9. confirmed / provisional / rejected 状态规则

### confirmed
- **写哪里**：`conversation_summaries` 主字段（student_profile / skills / career_goal）
- **Context Builder 输出**：不带特殊标记
- **覆盖规则**：新 confirmed 直接覆盖旧 confirmed（按 field_path + student_id）
- **恢复规则**：rollback 后恢复为 rollback mutation 设定的值

### provisional
- **写哪里**：`conversation_summaries.provisional_overlays` dict，key 格式 `"{field_path}::{source_agent}"`
- **Context Builder 输出**：带 `[待确认]` 标记，提示读者此信息未经最终确认
- **覆盖规则**：同一 field_path + agent 覆盖；不同 agent 共存
- **与 confirmed 冲突**：不覆盖主字段，写入 overlay；保留 confirmed 值在主字段

### rejected
- **写哪里**：仅 `memory_mutations` + `decision_journal`
- **Context Builder 输出**：不注入任何上下文
- **审计价值**：记录 agent 试图写入被拒绝的记录，后续可用 P5 分析

---

## 10. rollback 规则

### 原则
- **永不物理删除**。回滚通过新增 mutation 实现。
- 双向链接：新 mutation.`rollback_of` = 原 mutation.id；原 mutation.`rolled_back_by` = 新 mutation.id。
- rollback mutation 的 `decision_type` 始终为 `AUTO_CONFIRMED`。

### 流程

```python
async def create_rollback_mutation(
    original_mutation_id: str,
    reason: str,
    requested_by: str,
) -> MemoryMutationRecord:
    # 1. 读取原 mutation 记录
    original = await db.fetchone(
        "SELECT * FROM memory_mutations WHERE id = ?",
        (original_mutation_id,)
    )
    if not original:
        raise ValueError(f"Mutation {original_mutation_id} not found")

    # 2. 创建回滚 mutation（new_value / old_value 交换）
    rollback = MemoryMutationRecord(
        id=build_id("mut"),
        student_id=original["student_id"],
        source_idempotency_key=f"rollback_of_{original_mutation_id}",
        source_event_id=original["source_event_id"],
        trace_id=original["trace_id"],
        target_table=original["target_table"],
        target_field=original["target_field"],
        old_value=original["new_value"],   # 旧值 = 原 mutation 的新值
        new_value=original["old_value"],   # 新值 = 原 mutation 的旧值
        evidence=f"Rollback: {reason}",
        source_agent=requested_by,
        confidence=1.0,
        decision_type=DecisionType.AUTO_CONFIRMED,
        rollback_of=original_mutation_id,
        rollback_reason=reason,
    )

    # 3. 写入 memory_mutations
    await _insert_mutation(rollback)

    # 4. 更新原 mutation.rolled_back_by
    await db.execute(
        "UPDATE memory_mutations SET rolled_back_by = ? WHERE id = ?",
        (rollback.id, original_mutation_id)
    )

    # 5. commit 到 conversation_summaries（走公开方法，不跨模块调私有方法）
    await memory_manager.commit_mutation(rollback)

    return rollback
```

### 回滚后的影响
- 原 mutation 仍存在于 `memory_mutations` 表，`rolled_back_by` 指向回滚 mutation
- `conversation_summaries` 中该 field_path 值恢复为 rollback 设定的值
- 若原 mutation 是 provisional（写入 overlay 的），rollback 清除该 overlay key

### 谁可以发起 rollback
- P2 阶段：仅通过 API 手动触发（调试/管理），不自动 rollback
- 未来（P4+）：补偿流程中发现错误时自动 rollback

### rollback 的 rollback
- 可以对 rollback mutation 再次 rollback，这是恢复数据的合法方式
- 每次 rollback 生成新 mutation，不修改已有记录

---

## 11. 与 P1 transcript 的关系

### 不变的部分

对话完成后仍然写入 `coach_messages` 表（与 P1 完全一致）：
- 用户消息（role=user）→ `coach_messages`
- assistant 回复 + tool_calls_json → `coach_messages`
- 更新 `coach_sessions.message_count`

### P2 改变的部分

对话完成后**不再**调用 `persist_conversation_summary()` 全量覆写：
- 改为调用 `save_coordinator_metadata()`（仅 `current_stage` / `last_agent`）
- 用户数据变更在对话过程中通过 mutation_gated 工具实时更新（adjudicate → commit）

### 各层职责

| 层 | 表 | 写入时机 | 写入者 |
|----|-----|---------|--------|
| Transcript | `coach_messages` | 对话结束后 | Coordinator（不变） |
| Session | `coach_sessions` | 对话结束后 | Coordinator（不变） |
| Coordinator Metadata | `conversation_summaries`（scurrent_stage 等） | 对话结束后 | `save_coordinator_metadata()`（P2 新增） |
| Hard Memory | `conversation_summaries`（skills 等） | 对话中（工具调用时） | Adjudicator commit（P2 可信路径） |
| Audit | `memory_mutations` | 每次 adjudicate | Adjudicator（P2 正式启用） |
| Audit | `decision_journal` | 每次 adjudicate | Adjudicator（P2 正式启用） |

---

## 12. 测试文件

### 12.1 Rollback 单元测试

文件：`backend/tests/services/memory/test_rollback.py`

| 测试 | 断言 |
|------|------|
| `test_rollback_creates_new_mutation` | rollback 后 `memory_mutations` 增加一条记录 |
| `test_rollback_bidirectional_link` | `rollback_of` 和 `rolled_back_by` 双向正确 |
| `test_rollback_restores_old_value` | rollback 后 `conversation_summaries` 该字段值恢复 |
| `test_rollback_nonexistent_mutation_raises` | 不存在的 mutation_id 抛 ValueError |
| `test_rollback_provisional_clears_overlay` | provisional overlay 回滚后 cleared |
| `test_rollback_does_not_delete_original` | 原 mutation 记录仍存在 |
| `test_double_rollback_recovers_and_new_mutations` | rollback 的 rollback 生成两条新记录 |

### 12.2 Proposal Handler 集成测试

文件：`backend/tests/services/memory/test_proposal_handler.py`

| 测试 | 场景 |
|------|------|
| `test_handle_mutation_gated_tool_flow` | mock tool 调用 → proposal → adjudicate → tool_result |
| `test_handle_auto_confirmed_emits_memory_result` | auto_confirmed 后 NDJSON 含 memory_result 事件 |
| `test_handle_rejected_does_not_write_summary` | rejected 后 conversation_summaries 不变 |
| `test_trace_id_propagates_through_mutation_chain` | trace_id 从 proposal 到 commit 一致 |
| `test_provisional_overlay_writes_correctly` | provisional 写入 overlay dict |
| `test_high_risk_overlay_always` | high risk 即使高置信度也写入 overlay |

### 12.3 端到端测试（通过 stream 端点）

文件：`backend/tests/api/test_coach_memory_mutation.py`

| 测试 | 场景 |
|------|------|
| `test_stream_contains_memory_result_event` | mock LLM 触发 process_memory_proposal → 流中包含 memory_result 事件 |
| `test_memory_result_after_tool_result_order` | memory_result 在 tool_result 之后、delta 之前 |
| `test_coordinator_no_longer_persists_all_fields` | 对话后直接修改 conversation_summaries 其他字段不应生效 |
| `test_auto_confirmed_mutation_appears_in_summary` | auto_confirmed 后对话完成 → conversation_summaries 包含变更 |

### 12.4 修改已有的测试

| 文件 | 改动 |
|------|------|
| `tests/services/memory/test_adjudicator.py` | 追加：overlay_target 实战验证（已有 confirmed 记录的情况）、high risk 强制 overlay |
| `tests/services/memory/test_memory_manager.py` | 追加：`save_coordinator_metadata` 测试；移除 `persist_conversation_summary` 外部调用测试 |

---

## 13. 验收标准

1. **可信写入生效**：LLM 调用 `process_memory_proposal` 后，`memory_mutations` + `decision_journal` 各有 1 条新记录
2. **auto_confirmed 写入主字段**：low risk + confidence ≥ 0.95 → `conversation_summaries` 对应字段更新
3. **provisional 写入 overlay**：medium risk + confidence 0.85 → `summary_json` 中 `provisional_overlays` 出现新条目，主字段不变
4. **rejected 不动业务表**：confidence < 0.80 → `conversation_summaries` 完全不变，仅有 audit 日志
5. **high risk 永远不 auto**：high risk + confidence 0.98 → 仍为 provisional_write，且 overlay_target = True
6. **冲突检测**：已有 confirmed 记录 → 新 provisional 写入 overlay（不拒绝、不覆盖）
7. **memory_result 事件**：流式响应中包含 `memory_result` NDJSON 事件
8. **Coordinator 不再直接写用户记忆**：对话完成后，student_profile/skills/career_goal 未变化（除非通过工具调用变更）
9. **Coordinator 元数据更新**：`current_stage` / `last_agent` 正确更新
10. **trace_id 完整链路**：所有 mutation 记录携带同一 trace_id（从 propose 到 commit 到 rollback）
11. **rollback 正确**：rollback 后字段值恢复为回滚前的值，双向链接完整
12. **P0a + P0b + P0c + P1 无回归**：delta/route/tool_call/tool_result/done/error 事件流正常，会话恢复功能正常，基础流式对话不白屏

---

## 14. 回滚方案

### 方案 A：移除 memory_result 事件（最低影响）

```
git revert commit_added_memory_result_event
```

- 注释 `proposal_handler.py` 中 yield `memory_result` 事件的行
- 前端 `api.ts` 中移除 `memory_result` 类型定义
- 工具调用走回 P0c 的标准 tool_call/tool_result

### 方案 B：关闭 mutation_gated 路径（回到 P1 行为）

```
1. 从 tool_registry.py 取消注册 process_memory_proposal tool
2. coach_coordinator.py 恢复 P1 的 persist_conversation_summary() 调用
3. 保护性删除：services/memory/proposal_handler.py、rollback.py
4. manager.py 恢复 persist_conversation_summary() 为 public
```

- 退回后系统行为与 P1 一致
- `memory_mutations` / `decision_journal` 表空跑但无害

### 方案 C：全量回滚（极端）

```
git revert <p2-merge-commit>
```

---

## 15. 进入 P3 的条件

- [ ] 全部 12 项验收标准通过
- [ ] Adjudicator 测试覆盖率 ≥ 90%（含 overlay_target 分支）
- [ ] Rollback 测试覆盖率 ≥ 85%
- [ ] P0c + P1 验收标准无回归
- [ ] 手动 curl 验证：memory_result 事件出现在 NDJSON 流中
- [ ] 手动 curl 验证：auto_confirmed 后 conversation_summaries 有变更
- [ ] 手动 curl 验证：rejected 后 conversation_summaries 不变
- [ ] rollback 手动验证：触发 rollback → conversation_summaries 恢复旧值

---

## 附录 A：P2 变更文件清单

| 文件 | P1 状态 | P2 状态 | 操作 |
|------|:-------:|:-------:|:----:|
| `services/memory/rollback.py` | — | 新增 | 创建 |
| `services/memory/proposal_handler.py` | — | 新增 | 创建 |
| `services/memory/manager.py` | ✓ | 修改 | persist 改 internal + save_coordinator_metadata |
| `services/memory/adjudicator.py` | ✓ | 修改 | 激活 overlay_target + trace_id |
| `services/tool_registry.py` | ✓ | 修改 | mutation_gated 分类 + process_memory_proposal |
| `services/coach_coordinator.py` | ✓ | 修改 | 移除 persist，改 save_coordinator_metadata |
| `services/context_builder.py` | ✓ | 修改 | 激活 overlay 渲染 |
| `schemas/agent.py` | ✓ | 修改 | StreamEvent memory_result 字段 |
| `api/coach.py` | ✓ | 修改 | 注册 tool + 传递 trace_id |
| `tests/.../test_rollback.py` | — | 新增 | 7 用例 |
| `tests/.../test_proposal_handler.py` | — | 新增 | 6 用例 |
| `tests/api/test_coach_memory_mutation.py` | — | 新增 | 4 用例 |
| `tests/.../test_adjudicator.py` | ✓ | 修改 | 追加 overlay 用例 |
| `tests/.../test_memory_manager.py` | ✓ | 修改 | 追加 coordination_metadata 用例 |
| `pages/coach/api.ts` | ✓ | 修改 | StreamEvent 类型追加 |
| `pages/coach/hooks/useCoachChat.ts` | ✓ | 修改 | 可选 memory_result 处理 |

## 附录 B：`process_memory_proposal` Tool 定义

```python
TOOL_DEFINITION = {
    "name": "process_memory_proposal",
    "displayName": "提交记忆变更提议",
    "description": "向记忆系统提交一个变更提议，裁决后将自动写入或拒绝。不能用于直接修改 ConversationSummary。",
    "classification": "mutation_gated",
    "parameters": {
        "targetField": {
            "type": "string",
            "description": "目标字段路径，如 skills.python.mastery_status"
        },
        "newValue": {
            "type": "string",
            "description": "新值（JSON 编码的字符串，如 \"mastered\"）"
        },
        "evidence": {
            "type": "string",
            "description": "佐证证据描述"
        },
        "confidence": {
            "type": "number",
            "minimum": 0.0,
            "maximum": 1.0,
            "description": "置信度"
        },
        "riskLevel": {
            "type": "string",
            "enum": ["low", "medium", "high"],
            "description": "变更风险等级：low(自动确认)/medium(provisional)/high(永远不自动确认)"
        }
    },
    "required": ["targetField", "newValue", "evidence", "confidence", "riskLevel"]
}
```

**注意**：`displayName` 和 `classification` 是 ToolRegistry 内部元数据，调用 `ToolRegistry.get_schema()` 发送给 LLM 时需剥离这两个字段，只保留 `name`、`description`、`parameters`。

**运行时注入字段**（LLM 不需要提供）：
- `student_id` — 从 `LoopContext.student_id` 自动注入
- `trace_id` — 从 `LoopContext.trace_id` 自动注入
- `source_agent` — 从 `LoopContext.active_agent` 自动注入
- `source_idempotency_key` — 后端自动生成 `hash(student_id + target_field + event_type + version)`
- `source_event_id` — 后端自动生成 UUID
- `target_table` — 固定 `"conversation_summaries"`
- `old_value` — 后端自动读取当前值

## 附录 C：P1→P2 关键行为变化清单

| # | 行为 | P1 | P2 | 改哪个文件 |
|---|------|-----|-----|-----------|
| 1 | 对话结束后保存记忆 | Coordinator 全量 persist | Coordinator 只写 metadata | `coach_coordinator.py` |
| 2 | LLM 更新技能/档案 | 不能（无 memory 工具） | 通过 process_memory_proposal 工具 | `tool_registry.py`, `proposal_handler.py` |
| 3 | overlay_target | 字段存在但未使用 | provisional 冲突时设为 True | `adjudicator.py` |
| 4 | trace_id 校验 | 无 | propose 时校验非空 | `manager.py` |
| 5 | rollback | 接口占位 | 完整双向链接实现 | `rollback.py` |
| 6 | memory_result 事件 | 不存在 | NDJSON 新增 | `schemas/agent.py` |
| 7 | provisional_overlays 渲染 | 被注释或未实现 | 激活 | `context_builder.py` |
| 8 | process_memory_proposal tool | 不存在 | 注册为 mutation_gated | `api/coach.py` |
