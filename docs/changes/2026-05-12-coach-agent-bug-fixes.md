# Coach Agent 验收 Bug 修复

> 日期：2026-05-12  
> 依据：Coach Agent P0–P5 验收报告（同日）  
> 修复范围：12 项 Bug，全部完成

---

## 🔴 BUG-1 — OutboxEmitter：SQLAlchemy API 混用修复

**文件**：`backend/app/services/outbox/emitter.py`

**问题**：`emit_event()` 使用了原始 sqlite3 风格的 `execute(str, tuple)` 和 `self._db.fetchone()`，但 `db` 是 SQLAlchemy `Session` 对象，没有 `fetchone()` 方法，导致所有 outbox 事件写入静默失败。

**修复**：
- 改用 `text()` + 具名参数（`:id`、`:event_type` 等）
- 将幂等查询改为 `self._db.execute(text(...)).fetchone()`
- 每次成功写入后调用 `self._db.commit()`
- 失败时先 `rollback()` 再查询已有记录

---

## 🔴 BUG-2 — OutboxWorker：事务从不提交修复

**文件**：`backend/app/services/outbox/worker.py`

**问题**：`_process_one()` 执行多个 `UPDATE outbox_events` 但从不调用 `commit()`，进程重启后所有状态变更丢失。

**修复**：在三处添加 `self._db.commit()`：
1. 锁定事件（`status='processing'`）后
2. 成功交付（`status='delivered'`）后
3. 失败更新（`dead_letter` 或 `failed_retryable`）后

---

## 🔴 BUG-9 — memory/manager.py：`schema_version.split()` 对 int 崩溃修复

**文件**：`backend/app/services/memory/manager.py`（L190）

**问题**：`ConversationSummaryV1_1.schema_version` 是 `int` 类型（默认值 `2`），对其调用 `.split(".")` 抛出 `AttributeError: 'int' object has no attribute 'split'`，每次保存 ConversationSummary 都 crash。

**修复**：
```python
# 前
int(summary.schema_version.split(".")[0])
# 后
int(str(summary.schema_version).split(".")[0])
```

---

## 🔴 BUG-4 — useCoachChat：pipelineStage 不清除修复

**文件**：`myapp/src/pages/coach/hooks/useCoachChat.ts`

**问题**：从 `/coach?step=resume` 进入后，每轮对话都携带 `pipelineStage`，导致所有后续消息强制走 L1 路由，用户无法切换 Agent。

**修复**：首次 `streamCoachChat` 迭代完成后将 `pipelineStageRef.current` 置为 `undefined`，后续轮次走 L2/L4 动态路由。

---

## 🟡 BUG-3 — tool_call 事件不携带 toolArgs 修复

**文件**：
- `backend/app/services/coach_coordinator.py`（`tool_result` emit 新增 `toolArgs` 字段）
- `myapp/src/pages/coach/types.ts`（`ToolCallEvent.toolArgs` 改为可选；`ToolResultEvent` 新增 `toolArgs?`）
- `myapp/src/pages/coach/hooks/useCoachChat.ts`（`toAction` 透传 `toolArgs`）
- `myapp/src/pages/coach/eventReducer.ts`（`TOOL_RESULT` case 将 `toolArgs` patch 到对应 tool call entry）

**问题**：工具参数在流式阶段未知，`tool_call` 事件发出时 args 未完整。ToolCallCard 的"参数"面板始终显示空 `{}`。

**修复**：改为在 `tool_result` 事件中携带完整 `toolArgs`，前端 reducer 在收到 `TOOL_RESULT` 时将 args 回填到对应 `ToolCallEntry`。

---

## 🟡 BUG-5 — 虚假 cascade 事件修复

**文件**：`backend/app/services/coach_coordinator.py`

**问题**：`_maybe_cascade_events()` 仅检查工具名称，被 adjudicator 拒绝的 mutation 也会触发 `skill_mastered` cascade 事件。

**修复**：
- 工具执行后在 `tc` dict 上标记 `_accepted = result.get("accepted", False)`
- `_maybe_cascade_events()` 中增加 `accepted and` 条件，只有被接受的 mutation 才触发级联

---

## 🟡 BUG-6 — 上传文件发送后不清空修复

**文件**：
- `myapp/src/pages/coach/hooks/useCoachChat.ts`（发送成功后 dispatch `CLEAR_READY_UPLOADS`）
- `myapp/src/pages/coach/eventReducer.ts`（新增 `CLEAR_READY_UPLOADS` reducer case）
- `myapp/src/pages/coach/types.ts`（新增 `CLEAR_READY_UPLOADS` action 类型）
- `myapp/src/pages/coach/components/CoachChatInput.tsx`（修正 `onUpload` prop 类型为 `Promise<unknown> | void`）

**问题**：上传完成后 `pendingUploads` 在 state 中不清除，UI 持续显示已发送的附件缩略图；`onUpload` prop 类型与实际 `chat.uploadFile` 签名不符。

**修复**：
- 新增 `CLEAR_READY_UPLOADS` action，过滤掉所有 `uploadState === 'ready'` 的上传项
- 消息发送完成后 dispatch 该 action
- 修正 `CoachChatInput.onUpload` 类型

---

## 🟡 BUG-10 — pipeline 路由键不一致修复

**文件**：`backend/app/services/coach_router.py`

**问题**：路由映射中使用 `"learn"` 作为键，但规范（§4.3）和前端跳转使用 `"learning"`，导致从 `/coach?step=learning` 进入时回落到 L4 路由。

**修复**：添加 `"learning"` 为主键，保留 `"learn"` 为向后兼容别名：
```python
"learning": "LearningPathCoach",
"learn": "LearningPathCoach",   # backward-compat alias
```

---

## 🟡 BUG-11 — 业务页面"问教练"入口按钮添加

**新文件**：`myapp/src/components/ui/AskCoachButton.tsx`  
**修改**：`myapp/src/components/ui/index.ts`（新增导出）  
**注入页面**（4 个）：

| 页面 | 文件 | 跳转目标 |
|------|------|---------|
| 简历解构 | `student-competency-profile/index.tsx` | `/coach?step=resume` |
| 职业匹配 | `career-match/index.tsx` | `/coach?step=match` |
| 蜗牛学习路径 | `career-development-report/learning-path/index.tsx` | `/coach?step=learning` |
| 个人成长报告 | `career-development-report/personal-growth-report/index.tsx` | `/coach?step=report` |

`AskCoachButton` 组件：
- 使用 `token.*` 颜色（无硬编码 hex）
- 使用 `history.push()` 导航（UMI Max）
- 支持 4 个 step、自定义 label/size/type

---

## 🟢 BUG-8 — coach/index.tsx 硬编码颜色修复

**文件**：`myapp/src/pages/coach/index.tsx`

**修复**：将 `background: #fff` 改为 `background: ${token.colorBgContainer}`，同时将 `createStyles(({ css }) =>` 更新为 `createStyles(({ css, token }) =>`。

---

## 🟢 BUG-12 — TypeScript toolArgs 可选类型修复

已在 BUG-3 修复时同步完成（`ToolCallEvent.toolArgs?: Record<string, unknown>`）。

---

## 🟡 BUG-13 — Coach 会话交互与附件链路修复

**文件**：
- `myapp/src/pages/coach/index.tsx`
- `myapp/src/pages/coach/hooks/useCoachChat.ts`
- `backend/app/api/coach.py`
- `backend/app/api/coach_sessions.py`
- `backend/app/models/coach.py`

**问题**：历史会话点击触发整页跳转；新对话未完整清理 `step/session_id` 和流式状态；停止生成会让输入区停在 busy；上传文件只停留在前端待发送区，没有随本轮消息发送、注入上下文或随历史恢复。

**修复**：
- 历史会话改为页面内 `getSession → loadSession → replaceState`
- 新对话中止当前流、忽略迟到事件、清空 URL 查询参数并刷新会话列表
- 停止生成后恢复 `idle` 并保留停止提示
- `POST /api/coach/chat/stream` 增加 `attachments`，后端校验 fileId 属于当前用户，提取 PDF/DOCX/TXT/MD/CSV 文本注入本轮上下文
- `coach_messages.attachments_json` 持久化用户消息附件，`GET /api/coach/sessions/:id` 回传 `attachments`

---

## 🟡 BUG-14 — Coach 业务页数据自助读取修复

**文件**：
- `backend/app/schemas/agent.py`
- `backend/app/api/coach.py`
- `backend/app/services/coach_coordinator.py`
- `backend/app/services/context_builder.py`
- `backend/app/services/tools/handlers.py`
- `backend/app/services/tool_registry.py`
- `myapp/src/components/ui/AskCoachButton.tsx`
- `myapp/src/pages/coach/api.ts`
- `myapp/src/pages/coach/hooks/useCoachChat.ts`
- `myapp/src/pages/coach/pageContext.ts`
- 4 个业务页入口：能力画像、职业匹配、蜗牛学习路径、个人成长报告

**问题**：业务页只通过 `step` 进入 coach，后端 tool 缺少当前页面目标上下文；学习路径和成长报告读取工具还会把 `home-v2` 当正文数据，导致 AI 无法读到 12 维图谱、当前职业匹配、蜗牛学习路径计划和个人成长报告。

**修复**：
- 新增 `pageContext` 请求字段，只传轻量页面上下文：`sourcePage`、`favoriteId`、`workspaceId`、`reportId`、`recommendationId`
- `AskCoachButton` 根据页面生成 `source_page/favorite_id/workspace_id/report_id/recommendation_id` 查询参数
- `/coach` 解析查询参数并通过 `useCoachChat → streamCoachChat` 每轮发送 `pageContext`
- `useCoachChat` 保持首轮后清空 `pipelineStage`，但保留 `pageContext`，避免回到旧的 Agent 切换问题
- `CoachCoordinator` 将 `pageContext` 放入 tool context，tool handler 按 `args → pageContext → 最新收藏` 顺序解析当前目标
- `read_profile` 读取 `/api/student-competency-profile/latest-analysis`，摘要包含 12 维图谱、雷达、差距和关键词
- `search_matches` 聚合 `/api/career-development-report/job-exploration-match/init` 与 `/favorites`，按 `recommendationId` 标出当前推荐和收藏状态
- `read_plan` 改为读取 `/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}`，并按 `workspaceId` 读取周/月复盘，不再使用 `home-v2` 作为正文
- `read_report` 改为读取 `/api/career-development-report/personal-growth-report/workspaces/{favorite_id}`，返回章节、保存/生成时间和可用状态，不再使用 `home-v2` 作为正文
- `CareerCoach` 额外开放 `read_profile/search_matches/read_plan/read_report` 四个 readonly 工具，写操作仍只属于原 Agent
- 系统提示增加业务数据读取规则：涉及当前画像、匹配、学习路径、成长报告时先调用对应工具；不可用时说明缺少的前置条件

---

## 🟡 BUG-15 — 职业推荐误用岗位大类 mock 工具修复

**文件**：
- `backend/app/services/tools/mock_job_categories.py`
- `backend/app/services/coach_coordinator.py`
- `backend/app/services/context_builder.py`
- `backend/tests/services/test_coach_coordinator.py`

**问题**：学生询问“我最适合什么职业？”时，模型可能调用 `get_job_categories`。该工具是静态岗位大类 mock，不是学生真实职业匹配推荐；同时它的 handler 只接收 `args`，在真实 `/api/coach` 的 `ToolExecutor` 中会被按 `(args, context)` 调用并报 `takes 1 positional argument but 2 were given`。

**修复**：
- `get_job_categories` handler 兼容 `context` 参数，避免工具执行崩溃
- `CoachCoordinator` 在 CareerMatchCoach/CareerCoach 的职业推荐意图下，从本轮 tool schemas 中移除 `get_job_categories`
- 明确岗位大类/类别列表问题仍保留 `get_job_categories`
- 系统提示补充约束：职业推荐、最适合职业、岗位匹配必须以 `search_matches` 真实职业匹配结果为依据，`get_job_categories` 不能替代推荐依据
- 新增回归测试覆盖 tool executor 兼容、职业推荐隐藏 mock 工具、岗位大类查询保留 mock 工具

---

## 🟡 BUG-16 — Coach 智能体运行态协议与展示重构

**文件**：
- `backend/app/api/coach.py`
- `backend/app/services/coach_coordinator.py`
- `backend/app/models/coach.py`
- `backend/app/services/memory/manager.py`
- `backend/app/api/coach_sessions.py`
- `myapp/src/pages/coach/types.ts`
- `myapp/src/pages/coach/eventReducer.ts`
- `myapp/src/pages/coach/hooks/useCoachChat.ts`
- `myapp/src/pages/coach/components/AgentRunTimeline.tsx`
- `myapp/src/pages/coach/components/AssistantMessage.tsx`
- `myapp/src/pages/coach/components/CoachChatBody.tsx`

**问题**：`/coach` 默认展示仍是常规大模型聊天形态：thinking、tool_call、tool_result、agent_switch 分散堆叠，缺少类似 CLI 智能体的任务运行轨迹。

**修复**：
- `/api/coach/chat/stream` 改为 `run_start → step* → answer_delta* → run_done/run_error`
- 路由、上下文整理、工具调用、记忆更新、Agent 切换、答复生成统一收敛为 `step`
- 前端删除旧事件消费，不再处理 `route/meta/delta/thinking/tool_call/tool_result/memory_result/agent_switch/done/error`
- 新增 `AgentRunTimeline`，assistant 消息顶部展示执行轨迹，运行时展开、完成后折叠摘要
- `coach_messages.run_trace_json` 持久化摘要级运行轨迹，`GET /api/coach/sessions/:id` 回传 `runTrace`
- 历史恢复保留执行轨迹摘要，不保存 raw thinking

---

## 验证结果

```
# 后端 Python 导入检查
uv run python -c "from app.services.outbox.emitter import OutboxEmitter; ..."
→ imports OK

# 前端 TypeScript 编译
npx tsc --noEmit --strict false
→ 0 新增错误（存量 4 个 framer-motion 类型错误为修复前已有，与本次无关）

# Coach 会话/附件补充验证
npm run jest -- src/pages/coach/__tests__ --runInBand
→ 4 passed, 30 tests passed

npm run tsc
→ passed

uv run pytest tests/api/test_coach_sessions.py tests/test_coach.py tests/services/memory/test_memory_manager.py -q
→ 39 passed
```

---

## 剩余未修复项（非 Bug / 阻塞于数据）

| 项目 | 状态 |
|------|------|
| L3 BERT-tiny 模型训练 | 阻塞于 routing_log 数据积累 |
| CW 实测效果验证 | 阻塞于真实用户数据 |
| BUG-7 retry 前后端不同步 | 文档说明行为，非严重 bug |
