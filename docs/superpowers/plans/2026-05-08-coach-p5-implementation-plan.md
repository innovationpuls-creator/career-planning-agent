# P5：群体智慧 + 自举训练

> 日期：2026-05-08
> 基于：[AI 教练智能体系统设计](../specs/2026-05-08-coach-agent-design.md)、[P4 可靠性与可观测性计划](./2026-05-08-coach-p4-implementation-plan.md)
> 前提：P4 全部验收标准通过
> 原则：增量构建于 P0–P4 代码之上，不改已实现功能。P5 为教练系统的**最后一期计划**，完成后 P0–P5 全面交付。

---

## 1. 目标

在 P0–P4 的可运行、可观测系统之上，注入**群体智慧**和**自举能力**——让系统从自己的运行数据中学习，不再完全依赖人工调参。

**一句话：P0–P4 能跑能看，P5 让它自己变聪明。**

核心变化（当前 vs P5 目标）：

| 维度 | 当前 (P0–P4) | P5 目标 |
|------|-------------|---------|
| CollectiveWisdom | `cw_entities`/`cw_relations`/`cw_observations` 表存在但数据为空 | 填充真实群体数据，`_format_collective_wisdom()` 返回有价值的参考信息 |
| 路由 L4 | 每次调用 LLM 做意图识别（300ms 超时 + 延迟+成本） | BERT-tiny 4 分类器取代 L4 LLM 调用，<10ms 推理，零 API 成本 |
| 系统 Prompt | 静态写入代码，修改需要手动编辑重启 | 基于反馈数据驱动 Prompt 迭代 |
| 工具端点映射 | 17 个工具有端点映射，部分 REST 端点尚未实现 | 5 个缺失端点补全，工具全覆盖 |
| Agent 切换事件 | 前端 `AgentSwitchBadge` 组件就位但后端不 emit | Coordinator 在子 Agent 切换时 emit `agent_switch` NDJSON 事件（P3 已定义类型） |

---

## 2. 非目标

- 不新增 Chat UI 功能（P3 已冻结）
- 不改 P0–P4 已有功能逻辑
- 不改现有 66 个 REST 端点（只新增不修改）
- 不替换 Coordinator 整体架构
- 不做分布式 BERT 训练 pipeline（本地脚本训练 + 模型文件 commit 到 repo）
- 不做 Prompt A/B 测试平台（仅提供分析和版本记录）
- 不做 L3 模型在线更新部署（训练脚本离线运行，产出模型文件手动部署）

---

## 3. 数据库迁移

### 3.1 新增表（P5 新增基础设施，不在原 Spec DDL 中）

> **注意**：`prompt_versions` 和 `training_datasets` 为 P5 阶段新增的运维/训练辅助表，原 Spec §3.2 定义的 8 张表已在 P1–P2b 全部创建。

**`prompt_versions`** — 系统 Prompt 版本管理和变更记录：

```sql
CREATE TABLE prompt_versions (
    id TEXT PRIMARY KEY,
    agent TEXT NOT NULL,
    version INTEGER NOT NULL,
    prompt_text TEXT NOT NULL,
    change_reason TEXT,
    feedback_lifted INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(agent, version)
);
```

**`training_datasets`** — 路由训练数据集版本管理：

```sql
CREATE TABLE training_datasets (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    source_table TEXT NOT NULL,
    filter_criteria TEXT NOT NULL,
    total_samples INTEGER NOT NULL,
    label_distribution TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 3.2 CollectiveWisdom 种子数据

P5 首次运行时通过迁移脚本填充 CW 初始数据：

```sql
-- 实体示例（约 50 个）
INSERT INTO cw_entities (id, entity_type, entity_name, properties_json) VALUES
  ('cw_skill_python', 'skill', 'Python', '{"category": "programming_language", "difficulty": "beginner"}'),
  ('cw_skill_sql', 'skill', 'SQL', '{"category": "database", "difficulty": "beginner"}'),
  ('cw_skill_machine_learning', 'skill', '机器学习', '{"category": "ai", "difficulty": "advanced"}'),
  ('cw_role_data_analyst', 'role', '数据分析师', '{"industry": "互联网", "avg_salary": "15-25K"}'),
  ('cw_role_backend_engineer', 'role', '后端开发工程师', '{"industry": "互联网", "avg_salary": "20-35K"}'),
  ('cw_industry_internet', 'industry', '互联网/IT', '{"growth_rate": "high"}');
```

种子数据来源：公开岗位描述提取的常见技能、教育部专业目录与职业映射、P0–P3 匿名化标签（无学生信息）。

### 3.3 conversation_summaries 新增字段

无 DDL 变更。`summary_json` 中 `ConversationSummaryV1_1` 新增 `prompt_versions` 字段：

```python
class ConversationSummaryV1_1(BaseModel):
    # ... 已有字段不变 ...
    prompt_versions: dict[str, int] = Field(default_factory=dict)
```

### 3.4 回滚迁移

```sql
DROP TABLE IF EXISTS prompt_versions;
DROP TABLE IF EXISTS training_datasets;
```

---

## 4. CollectiveWisdom 数据填充

### 4.1 数据填充方式

**途径 A：种子数据（首次运行）**
- 文件 `backend/app/migrations/seed_cw_data.sql`，包含约 50 实体 + 120 关系 + 150 观测
- 仅在 `cw_entities` 表为空时执行（幂等）

**途径 B：运行时积累**
- `ContextBuilder._format_collective_wisdom()` 被调用时，若产生新有效信息，以低置信度写入 `cw_observations`

### 4.2 新增后端文件

| # | 文件 | 职责 |
|---|------|------|
| 1 | `backend/app/services/memory/collective_wisdom.py` | `query_cw()` 查询聚合数据；`record_cw_observation()` 运行时写入观测 |
| 2 | `backend/app/api/coach_cw.py` | CW 管理端点（管理员用） |
| 3 | `backend/app/migrations/seed_cw_data.sql` | 约 50 实体 + 120 关系 + 150 观测的种子数据 |

### 4.3 修改文件

| # | 文件 | 改动 |
|---|------|------|
| 1 | `backend/app/services/context_builder.py` | `_format_collective_wisdom()` 从空返回改为真实查询；`build()` 改为 `async def` |
| 2 | `backend/app/services/coach_coordinator.py` | 子 Agent 切换时 emit `agent_switch` NDJSON 事件（P4 延后至 P5），字段 `{ from, to, reason }` 对齐 Spec §4.6 |

### 4.4 CollectiveWisdom 上下文输出格式

> **连锁改动**：`_format_collective_wisdom` 改为 `async def` 后，`ContextBuilder.build()` 也需改为 `async def`，所有调用方（`QueryEngine.submit_message()` → `context_builder.build()`）需加 `await`。

**CW 查询逻辑**：`query_related_skills(major)` 通过 3 表联查实现 — 从 `cw_entities` 找同专业实体 → `cw_relations` 找 `required_by` 关系 → `cw_entities` 找关联技能 → `cw_observations` 获取 `support_count` 和 `sample_size`。`support_rate = support_count / sample_size`。

```python
async def _format_collective_wisdom(self, student_id, summary) -> str:
    parts = []
    major = summary.student_profile.get("major", MemoryField(value="")).value
    if major:
        skills = await collective_wisdom.query_related_skills(major)
        if skills:
            parts.append(f"\n## 群体参考：同专业({major})常见技能\n")
            for s in skills[:5]:
                parts.append(f"- {s['entity_name']}: {s['support_rate']:.0%} 同专业学生提及 (样本量: {s['sample_size']})")

    role = summary.career_goal.get("role", MemoryField(value="")).value
    if role:
        dist = await collective_wisdom.query_skill_distribution(role)
        if dist:
            parts.append(f"\n## 群体参考：目标岗位({role})技能分布\n")
            for d in dist[:5]:
                parts.append(f"- {d['skill_name']}: mastered {d['mastered_rate']:.0%} / in_progress {d['in_progress_rate']:.0%} (样本量: {d['sample_size']})")

    if parts:
        parts.append("\n> 以上数据来自匿名群体统计，仅供参考。")
    return "\n".join(parts)
```

---

## 5. L3 BERT-tiny 4 分类器微调

### 5.1 流程

```
P4 routing_log 积累
  → 筛选：L4 + confidence>=0.80 + 未纠正 + 任务成功
  → 导出 JSONL 训练集
  → scripts/train_l3_classifier.py
    → 加载 google/bert-tiny-uncased
    → tokenize + 4 分类训练 (≤10 epochs)
    → 评估（目标 acc ≥ 85%）
    → 导出至 models/l3_router/
  → 后端 restart 加载模型
  → route() L4 先用 L3 推理：≥0.80 直接路由，<0.80 fallback LLM
```

### 5.2 新增文件

| # | 文件 | 职责 |
|---|------|------|
| 1 | `scripts/train_l3_classifier.py` | BERT-tiny 微调脚本 |
| 2 | `scripts/requirements-l3.txt` | 训练依赖：transformers, torch, datasets, sklearn |
| 3 | `models/l3_router/` | 训练产出目录（模型 + tokenizer + config）|
| 4 | `backend/app/services/l3_router.py` | L3 推理服务：`classify(message) → (agent, confidence)` |

### 5.3 修改文件

| # | 文件 | 改动 |
|---|------|------|
| 1 | `backend/app/services/coach_coordinator.py` | `route()` L4 分支：先尝试 L3，置信度 ≥ 0.80 直接使用，否则 fallback LLM |

### 5.4 L3 路由决策逻辑

```python
class L3Router:
    def __init__(self, model_path: str):
        self.model = self._load_model(model_path)
        self.labels = ["ResumeCoach", "CareerMatchCoach", "LearningPathCoach", "ReportCoach"]

    async def classify(self, message: str) -> tuple[str, float]:
        if not self.model:
            return ("", 0.0)
        inputs = self.tokenizer(message, return_tensors="pt", truncation=True, max_length=64)
        with torch.no_grad():
            logits = self.model(**inputs).logits
        probs = torch.softmax(logits, dim=-1)
        max_prob, max_idx = torch.max(probs, dim=-1)
        return (self.labels[max_idx], max_prob.item())
```

### 5.5 L3 不替换 L4 的条件

- 模型文件不存在或加载失败 → 静默 fallback L4 LLM
- 置信度 < 0.80 → 走 L4 LLM
- `L3_ROUTER_ENABLED=false` → 完全使用 L4 LLM

---

## 6. Prompt 优化

### 6.1 方法

基于 P3–P4 积累的 `feedback_records` 数据，分析各 Agent 常见失败模式，针对性优化 System Prompt。

**工作流程：**

1. 运行 `scripts/analyze_prompt_feedback.py` → 生成每个 Agent 的反馈热力图
2. 人工审查关键问题 → 修改 Prompt
3. 新版本写入 `prompt_versions` 表
4. 后台重启后加载新版 Prompt
5. 3 天后再次分析 → 对比反馈率变化

### 6.2 新增文件

| # | 文件 | 职责 |
|---|------|------|
| 1 | `scripts/analyze_prompt_feedback.py` | 读取 `feedback_records` → 分析负面模式 → 输出改进建议 |

### 6.3 修改文件

| # | 文件 | 改动 |
|---|------|------|
| 1 | `backend/app/services/context_builder.py` | `STATIC_SEGMENTS` 改为从 `prompt_versions` 表加载，保留硬编码默认值作 fallback。**注意**：Spec §5.1 的 `cache_control: ephemeral` prompt caching 策略依赖静态内容不变。DB 加载后，首次 prompt 仍需包含完整文本（与硬编码相同），caching 行为不变。仅当 prompt 版本升级时缓存失效一次，与手动重启无本质差异。 |
| 2 | `backend/app/api/coach_observability.py` | 新增 `GET /api/coach/observability/prompt-versions` |

---

## 7. 5 个缺失端点补全

### 7.1 已明确的端点

从 Spec §6.1 工具表可确定以下端点分属两个功能域：

**goal-setting-path-planning（目标设定）**：

| # | 端点 | 方法 | 说明 | 对应工具 |
|---|------|------|------|---------|
| 1 | `/api/career-development-report/goal-setting-path-planning` | POST | 目标设定与路径规划 | `suggest_resources` |
| 2 | `/api/career-development-report/goal-setting-path-planning/{id}` | PUT | 更新路径规划 | — |
| 3 | `/api/career-development-report/goal-setting-path-planning/{id}/progress` | GET | 获取规划进度 | — |
| 4 | `/api/career-development-report/goal-setting-path-planning/{id}/progress` | POST | 更新规划进度 | `verify_and_record_progress` |

**learning-path（学习路径）**：

| # | 端点 | 方法 | 说明 | 对应工具 |
|---|------|------|------|---------|
| 5 | `/api/career-development-report/learning-path/{id}` | GET | 获取学习计划详情 | `read_plan` |

> **注意**：`read_plan` 在 Spec §6.1 中映射为 `GET /api/career-development-report/learning-path`，与 goal-setting-path-planning 是**不同前缀**。P5 不将它们强行合并。

### 7.2 新增文件

| # | 文件 | 职责 |
|---|------|------|
| 1 | `backend/app/api/goal_setting.py` | 5 个 goal-setting-path-planning 相关端点 |

### 7.3 修改文件

| # | 文件 | 改动 |
|---|------|------|
| 1 | `backend/app/main.py` | 注册 `goal_setting_router` |

---

## 8. 前端文件级计划

**P5 不新增前端 UI 组件。**

| # | 文件 | 改动 |
|---|------|------|
| 1 | `myapp/src/pages/coach/api.ts` | 可选追加 5 个新端点的服务函数 |

---

## 9. API 契约变化

### 9.1 CW 管理端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `POST /api/coach/cw/seed` | POST | 触发种子数据加载（幂等） |
| `GET /api/coach/cw/entities` | GET | 列实体（分页） |
| `GET /api/coach/cw/relations` | GET | 列关系 |
| `GET /api/coach/cw/observations` | GET | 列观测 |

### 9.2 目标设定端点

| 端点 | 方法 | 请求体 | 响应 |
|------|------|--------|------|
| `POST /api/career-development-report/goal-setting-path-planning` | POST | `{ student_id, goal, current_skills }` | `{ plan_id, steps[] }` |
| `PUT /api/career-development-report/goal-setting-path-planning/{id}` | PUT | `{ goal?, steps[]? }` | `{ updated }` |
| `GET /api/career-development-report/goal-setting-path-planning/{id}/progress` | GET | — | `{ plan_id, completed, total, percentage }` |
| `POST /api/career-development-report/goal-setting-path-planning/{id}/progress` | POST | `{ skill_id, mastery_status }` | `{ updated_progress }` |
| `GET /api/career-development-report/learning-path/{id}` | GET | — | `{ id, goal, steps[], progress }` (`read_plan` 对应端点) |

### 9.3 Prompt 版本端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `GET /api/coach/observability/prompt-versions` | GET | 列 Prompt 版本历史 |
| `GET /api/coach/observability/prompt-versions/{agent}/current` | GET | 当前活跃版本 |

---

## 10. 测试文件

### 10.1 CollectiveWisdom 测试

文件：`backend/tests/services/memory/test_collective_wisdom.py`

| # | 测试 |
|---|------|
| 1 | `test_seed_cw_data_loads_idempotently` |
| 2 | `test_query_related_skills_by_major` |
| 3 | `test_query_skill_distribution_by_role` |
| 4 | `test_format_collective_wisdom_returns_content` |
| 5 | `test_cw_observation_isolation` |
| 6 | `test_cw_output_no_pii` — CW 返回内容不得包含个体学生信息（姓名/学号/手机号），仅允许聚合统计数据 |

### 10.2 L3 路由测试

文件：`backend/tests/services/test_l3_router.py`

| # | 测试 |
|---|------|
| 1 | `test_l3_classifier_returns_valid_agent` |
| 2 | `test_l3_confidence_in_0_1` |
| 3 | `test_l3_fallback_when_model_missing` |
| 4 | `test_l3_low_confidence_falls_through` |
| 5 | `test_l3_inference_speed_under_10ms` |

### 10.3 端点测试

文件：`backend/tests/api/test_goal_setting.py`

| # | 测试 |
|---|------|
| 1 | `test_create_goal_plan` |
| 2 | `test_get_goal_plan_detail` |
| 3 | `test_update_goal_plan` |
| 4 | `test_get_progress` |
| 5 | `test_update_progress` |

---

## 11. 验收标准

1. **CW 种子数据加载**：首次运行 `cw_entities` 有 50+ 实体、`cw_relations` 有 120+ 关系
2. **CW 上下文注入**：`_format_collective_wisdom()` 返回含 sample_size 的非空内容
3. **CW 数据不泄露 PII**：输出为聚合统计（`test_cw_output_no_pii` 通过）
4. **L3 训练脚本可运行**：端到端成功
5. **L3 路由准确率 ≥ 85%**：在保留测试集上评估
6. **L3 推理 < 10ms**：快于 L4 LLM（300ms+）
7. **L3 fallback 正确**：低置信度/模型不存在时静默走 LLM
8. **Prompt 版本记录**：`prompt_versions` 表有记录
9. **5 个目标设定端点全部可调用**：POST/GET/PUT 工作正常
10. **Agent 切换事件 emit**：子 Agent 切换时 NDJSON 流包含 `agent_switch` 事件，前端 `AgentSwitchBadge` 可正常渲染
11. **P0–P4 无回归**

---

## 12. 回滚方案

### 方案 A：关闭 L3 路由

```
L3_ROUTER_ENABLED=false
```
路由退回到 P4 L4 LLM 行为。

### 方案 B：关闭 CollectiveWisdom

```
context_builder.py 中 _format_collective_wisdom() 返回空字符串
```

### 方案 C：移除 5 个端点

```
main.py 中移除 goal_setting_router 注册
```

### 方案 D：全量回滚

```
git revert <p5-merge-commit>
```

---

## 13. 系统最终状态

| 阶段 | 核心交付 |
|------|---------|
| P0a | 最小流式对话闭环 |
| P0b | 路由 + 最小 Context Builder |
| P0c | 首个 readonly 工具 |
| P1 | 会话持久化 + 记忆系统基础 |
| P2 | 可信记忆层 + 22 工具集成（Adjudicator + mutation_gated + Outbox + 级联白名单） |
| P2b | 全量工具对接 + Outbox 事件总线 + BackgroundWorker + 级联投递 |
| P3 | 前端完整体验（10 动画 + 文件上传 + 侧边栏） |
| P4 | 可观测性（DLQ + 路由命中率 + 准确率 + 审计链） |
| P5 | 群体智慧 + L3 自举 + Prompt 优化 + 端点补全 + Agent 切换事件 |

**P5 完成后，AI 教练智能体系统设计文档中的所有功能全部实现。**

---

## 附录 A：P5 变更文件清单

| 文件 | P4 状态 | P5 状态 | 操作 |
|------|:-------:|:-------:|:----:|
| `services/memory/collective_wisdom.py` | — | 新增 | 创建 |
| `services/context_builder.py` | ✓ | 修改 | 激活 CW（async）+ 从 prompt_versions 表加载 |
| `services/l3_router.py` | — | 新增 | 创建 |
| `services/coach_coordinator.py` | ✓ | 修改 | L4 分支插入 L3；子 Agent 切换时 emit `agent_switch` 事件 |
| `api/coach_cw.py` | — | 新增 | 创建 |
| `api/goal_setting.py` | — | 新增 | 创建 |
| `api/coach_observability.py` | ✓ | 修改 | 追加 prompt-versions 端点 |
| `main.py` | ✓ | 修改 | 注册新 router |
| `migrations/seed_cw_data.sql` | — | 新增 | 创建 |
| `scripts/train_l3_classifier.py` | — | 新增 | 创建 |
| `scripts/requirements-l3.txt` | — | 新增 | 创建 |
| `scripts/analyze_prompt_feedback.py` | — | 新增 | 创建 |
| `models/l3_router/` | — | 新增 | 训练产出 |
| `pages/coach/api.ts` | ✓ | 修改 | 可选追加端点 |
| `tests/services/memory/test_collective_wisdom.py` | — | 新增 | 6 用例 |
| `tests/services/test_l3_router.py` | — | 新增 | 5 用例 |
| `tests/api/test_goal_setting.py` | — | 新增 | 5 用例 |

**新增：** 10 文件（4 后端 + 3 测试 + 3 脚本/迁移/模型目录）
**修改：** 5 文件

## 附录 B：P0–P5 整体统计

| 维度 | 总计 |
|------|:----:|
| 后端新增文件 | 30+ |
| 前端新增文件 | 23+ |
| 测试新增文件 | 22+ |
| SQLite 表 | 11 张（Spec 8 + P2b outbox_events + P4 routing_log + P5 prompt_versions/training_datasets） |
| REST 端点新增 | ~15 个 |
| 实施阶段 | 9 阶段 (P0a/P0b/P0c + P1/P2/P2b/P3/P4/P5) |
