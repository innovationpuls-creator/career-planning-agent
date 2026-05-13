# 2026-05-09 P1 Adjudicator 9 态决策矩阵补全

## 概述

P1 基础功能（记忆持久化、会话恢复、会话 CRUD）已在上次完成，但 Adjudicator 的 9 态决策矩阵和冲突检测（overlay_target）是简化实现。本次补全这两个核心功能并增加测试覆盖。

## 修改文件

### 后端

| 文件 | 改动 |
|------|------|
| `backend/app/services/memory/models.py` | 新增 `DecisionType` 枚举 (`AUTO_CONFIRMED`/`PROVISIONAL_WRITE`/`REJECTED`)；新增 `ProvisionalOverlay` 模型；`MemoryMutationProposal` 新增 `risk_level`/`confidence` 字段，`new_value`/`old_value` 类型放宽为 `Any`；`AdjudicationResult` 新增 `decision_type`/`overlay_target` 字段；`ConversationSummaryV1_1` 新增 `provisional_overlays` 字段 |
| `backend/app/services/memory/adjudicator.py` | 实现 P1 §8.2 完整 9 态决策矩阵：low/medium/high risk × >=0.95 / 0.80-0.95 / <0.80 confidence → auto_confirmed / provisional_write / rejected；冲突检测：provisional 命中已有 confirmed → overlay_target=True；high risk 的 provisional → 始终 overlay_target=True |
| `backend/app/services/memory/manager.py` | `propose_and_commit()` 实现三态写入：auto_confirmed → 更新 summary 主字段、provisional_write → 写入 provisional_overlays dict、rejected → 仅写入 audit 日志；新增 `_apply_field_update()` 支持点号嵌套路径字段更新；新增 `_has_confirmed_field()` 冲突检测辅助方法 |

### 测试

| 文件 | 改动 |
|------|------|
| `backend/tests/services/memory/test_adjudicator.py` | 完全重写：14 个测试覆盖 9 态矩阵全部组合（含边界值 0.95/0.80）、冲突检测（4 个场景）、确定性验证 |
| `backend/tests/services/memory/test_memory_manager.py` | 追加 3 个三态写入集成测试（auto_confirmed→主字段 / provisional→overlay / rejected→不修改）及 mutation+journal 必写验证；新增 `TestApplyFieldUpdate` 类（4 个嵌套路径更新测试） |

## 决策矩阵实现

| risk_level | confidence | decision_type | overlay_target |
|------------|-----------|---------------|----------------|
| low | ≥ 0.95 | auto_confirmed | False |
| low | 0.80–0.95 | provisional_write | has_confirmed ? True : False |
| low | < 0.80 | rejected | — |
| medium | ≥ 0.80 | provisional_write | has_confirmed ? True : False |
| medium | < 0.80 | rejected | — |
| high | ≥ 0.80 | provisional_write | True（始终） |
| high | < 0.80 | rejected | — |

## 三态写入逻辑

| decision_type | memory_mutations | decision_journal | conversation_summaries |
|:---|:---:|:---:|:---:|
| auto_confirmed | ✓ 写入 | ✓ 写入 | ✓ 更新主字段 |
| provisional_write | ✓ 写入 (overlay_target) | ✓ 写入 | ✓ 写入 provisional_overlays 不碰主字段 |
| rejected | ✓ 写入 | ✓ 写入 | ✗ 不碰 |

## 验证结果

| 指标 | 结果 |
|------|------|
| Adjudicator 测试 | 14/14 通过 |
| MemoryManager 测试 | 19/19 通过 |
| 后端全部测试 | 291/292 通过（1 个预存失败，与本次改动无关） |
| Adjudicator 9 态矩阵 | 全部 9 种组合输出正确的 decision_type |
| 冲突检测 | provisional+confirmed→overlay / high risk→始终 overlay |
| 确定性 | 相同输入产生相同输出 |
| P1 全部验收标准 | 10/10 通过 |

## P1 验收标准核对

| # | 验收项 | 状态 |
|---|--------|------|
| 1 | 记忆持久化：同一学生两次对话间能"记得" | ✅ P1 基础完成 |
| 2 | 会话恢复：`?session_id=xxx` 恢复历史 | ✅ P1 基础完成 |
| 3 | 会话列表 | ✅ P1 基础完成 |
| 4 | 会话详情 | ✅ P1 基础完成 |
| 5 | 会话删除 | ✅ P1 基础完成 |
| 6 | 学生隔离 | ✅ P1 基础完成 |
| 7 | Adjudicator 正确性：9 种组合正确 | ✅ **本次补全** |
| 8 | 冲突检测：provisional→已 confirmed→overlay | ✅ **本次补全** |
| 9 | P0c 无回归 | ✅ |
| 10 | 新学生首次对话不报错 | ✅ P1 基础完成 |

进入 P2 的条件已全部满足。
