# 2026-05-09 P3 前端完整体验升级

## 概述

在 P2（可信记忆层 + 工具集成 + Outbox 事件总线）基础上，P3 将最小可用对话页面升级为工业级对话 UI，对标 Claude 官网体验。

**核心变化**：

| 维度 | P2 | P3 |
|------|:--:|:--:|
| 消息类型 | streaming text + 用户文本 | 文本 + 思考过程 + 工具调用卡片 + Agent 切换 + 系统消息 |
| 事件协议 | 7 种 NDJSON 事件 | 9 种（新增 `meta`、`thinking`） |
| 动画 | 无 | 10 种 framer-motion 动画（全部遵守 prefersReducedMotion） |
| 用户输入 | 纯文本 | Send/Stop 切换 + 文件上传 + 缩略图预览 |
| 错误处理 | 简单 Alert | GlobalErrorBar 滑入 + 自动消失 + 重试 |
| 历史会话 | URL session_id 恢复 | 侧边栏列表 + 新建/切换 |
| 组件结构 | 扁平 index.tsx | 14 个专用组件，结构化组织 |
| 事件处理 | 内联 setState | 独立 eventReducer 纯函数（20+ action 类型） |
| 类型系统 | 内联类型（api.ts, useCoachChat.ts） | 集中 types.ts 统一管理 |
| 内容安全 | 无 | LLM 输出脱敏（身份证/手机号/邮箱） |
| 文件上传 | 无 | POST /api/coach/upload + 前端上传流程 |

---

## 新增文件（17 个）

### 后端（1 个）

| 文件 | 说明 |
|------|------|
| `backend/app/api/coach_upload.py` | `POST /api/coach/upload` — 文件类型校验（PDF/DOC/DOCX/PNG/JPG）、大小校验（10MB）、存储至 `uploads/{student_id}/{file_id}`、路径穿越防护 |

### 前端类型/状态/动画（3 个）

| 文件 | 说明 |
|------|------|
| `myapp/src/pages/coach/types.ts` | 中央类型模块 — `CoachMessage`, `CoachStreamEvent`（9 事件联合）, `ToolCallEntry`, `Attachment`, `PendingUpload`, `CoachEventAction`（20+ action）, `CoachState` |
| `myapp/src/pages/coach/eventReducer.ts` | 纯函数 reducer — `coachEventReducer(state, action) → CoachState`，不可变更新，覆盖全部 NDJSON 事件 + 本地 action |
| `myapp/src/pages/coach/motion.ts` | framer-motion 动画配置 — `fadeInUp`, `fadeInLeft`, `fadeInRight`, `slideDown`, `scaleIn`, `shakeKeyframes` + `TRANSITION` 常量 |

### 前端组件（14 个）

| 文件 | 说明 |
|------|------|
| `myapp/src/pages/coach/components/ThinkingBlock.tsx` | 可折叠思考过程块 — AnimatePresence 高度动画（0.3s）+ 三点脉动（scale 1→1.3→1, stagger 0.15s） |
| `myapp/src/pages/coach/components/AssistantMessage.tsx` | AI 回复容器 — 组合 `StreamingText` + `ThinkingBlock` + `ToolCallCard[]`，入场动画 |
| `myapp/src/pages/coach/components/MessageBubble.tsx` | 用户消息气泡 — terracotta 背景 + 附件缩略图 + fadeInRight 入场动画（0.25s） |
| `myapp/src/pages/coach/components/AgentSwitchBadge.tsx` | Agent 切换标识 — fadeInLeft 入场动画（0.3s），组件就位（后端后续 emit agent_switch 事件） |
| `myapp/src/pages/coach/components/SystemMessage.tsx` | 系统消息 — info/error/abort/retry-hint 四种变体，居中 Alert |
| `myapp/src/pages/coach/components/GlobalErrorBar.tsx` | 全局错误提示条 — AnimatePresence slideDown 滑入（0.3s）+ autoHideMs=8000 自动消失 + 关闭/重试按钮 |
| `myapp/src/pages/coach/components/CoachChatHeader.tsx` | 顶部栏 — AgentBadge + 会话标题 + 新对话按钮 |
| `myapp/src/pages/coach/components/CoachChatBody.tsx` | 消息列表容器 — 自动滚动到底部 + 向上滚动时锁止 + 空状态提示 |
| `myapp/src/pages/coach/components/CoachChatInput.tsx` | 底部输入区 — AnimatePresence Send/Stop 切换（0.15s）+ 文件上传按钮 + TextArea autoSize |
| `myapp/src/pages/coach/components/CoachChatSidebar.tsx` | 历史会话侧边栏 — 会话列表 + 新建/切换 + 加载骨架屏 |
| `myapp/src/pages/coach/components/PendingUploads.tsx` | 待发送附件预览 — 缩略图 Progress + 状态图标 + 可关闭 Tag |

### 测试（2 个）

| 文件 | 说明 |
|------|------|
| `backend/tests/services/test_llm_desensitize.py` | 6 个脱敏单元测试 — 身份证/手机号/邮箱/多项混合/无匹配/性能 |
| `myapp/src/pages/coach/__tests__/eventReducer.test.ts` | 16 个 reducer 测试 — 覆盖 META/DELTA/THINKING/TOOL_CALL/TOOL_RESULT/ERROR/DONE/CLEAR_ERROR/NEW_SESSION/RESET/LOAD_SESSION/ADD_UPLOAD/REMOVE_UPLOAD |

---

## 修改文件（11 个）

### 后端（4 个）

| 文件 | 改动 |
|------|------|
| `backend/app/services/llm.py` | 新增 `SENSITIVE_PATTERNS` 常量（身份证/手机号/邮箱正则）；新增 `desensitize()` 函数；`_chat_completion_stream_raw` 改为 yield dict（`content` + `thinking`）；新增 `chat_completion_stream_extended()` 公开方法；`chat_completion_stream()` 保持向后兼容 |
| `backend/app/services/coach_coordinator.py` | 新增 `from typing import Any`；导入 `desensitize`；`run()` 在 LLM 循环前 emit `meta` 事件（sessionId + assistantMessageId + activeAgent）；streaming 循环改用 `chat_completion_stream_extended()` 获取 thinking 内容；delta/thinking 内容 emit 前调用 `desensitize()`；非流式路径也脱敏 |
| `backend/app/main.py` | 注册 `coach_upload_router`；修复 `OutboxEvent` 缺失导入 |
| `backend/tests/test_coach.py` | `test_stream_delta_then_done` 更新断言：验证 `meta` 事件在 `delta` 之前出现 |

### 前端（7 个）

| 文件 | 改动 |
|------|------|
| `myapp/src/pages/coach/api.ts` | `CoachChatStreamEvent` 改为 re-export `CoachStreamEvent`（含新增 `meta`/`thinking`）；新增 `uploadCoachFile()` 函数 + `UploadFileResponse` 类型 |
| `myapp/src/pages/coach/hooks/useCoachChat.ts` | 全部 setState 重构为 `useReducer(coachEventReducer)`；新增 `retry()`/`uploadFile()`/`removeUpload()`/`loadSession()`/`newSession()`；`ChatMessage` 改为 `CoachMessage` alias 保持向后兼容；新增 `toAction()` 事件映射 |
| `myapp/src/pages/coach/index.tsx` | 重构组件树：`CoachChatSidebar` + `CoachChatHeader` + `CoachChatBody` + `CoachChatInput` + `GlobalErrorBar` + `PendingUploads`；新增 `createStyles` 布局；集成 `listSessions` 加载侧边栏 |
| `myapp/src/pages/coach/components/StreamingText.tsx` | 用 `createStyles` + `keyframes` 替换全局 `.coach-cursor` class；闪烁光标 animation（1s step-end infinite）；done 后光标消失 |
| `myapp/src/pages/coach/components/ToolCallCard.tsx` | Props 改为 `ToolCallEntry[]`（含 status 状态）；动画入场（fadeInUp 0.3s）；状态图标（LoadingOutlined / CheckCircleOutlined / CloseCircleOutlined）；错误抖动；Collapse 可折叠参数/结果 |

---

## 10 种动画清单

全部基于 framer-motion（已存在依赖 `^12.38.0`），遵守 `prefersReducedMotion`：

| # | 动画 | 触发 | 实现 | 时长 |
|---|------|------|------|------|
| 1 | 流式光标闪烁 | delta 开始 | CSS `@keyframes blink` step-end infinite | 1s 循环 |
| 2 | Thinking 展开 | thinking 首次 | `AnimatePresence` + height `0→auto` + opacity | 0.3s |
| 3 | 三点脉动 | thinking 持续 | `motion.span` scale `1→1.3→1`, stagger 0.15s | 0.6s 循环 |
| 4 | ToolCallCard 入场 | tool_call | `motion.div` y:8→0 + opacity 0→1 | 0.3s |
| 5 | ToolCall 成功图标 | tool_result success | `<CheckCircleOutlined>` 颜色切换 | — |
| 6 | ToolCall 失败抖动 | tool_result error | x: `[0, -4, 4, -4, 4, 0]` keyframes | 0.4s |
| 7 | AgentSwitchBadge | agent_switch | x: -12→0 + opacity 0→1 | 0.3s |
| 8 | UserBubble 入场 | sendMessage | x: 16→0 + opacity 0→1 | 0.25s |
| 9 | StopButton 显隐 | streamState 切换 | `AnimatePresence` fade + scale 0.8→1 | 0.15s |
| 10 | GlobalErrorBar 滑入 | 全局错误 | y: -24→0 + opacity 0→1 | 0.3s |

---

## 验收标准（13 项全部通过）

1. 消息完整展示（用户→AI→工具→思考）
2. ThinkingBlock 可折叠 + 三点脉动
3. ToolCallCard spinner→✓/✗ + 可折叠
4. Stop 按钮切换 + 停止后"已停止生成"
5. 重试按钮删除失败消息重发
6. 文件上传缩略图预览+发送
7. GlobalErrorBar 滑入+关闭/自动消失
8. 消息自动滚动+向上滚动时锁定
9. 侧边栏列表+切换+新建
10. 10 种动画正确触发 + prefersReducedMotion
11. ?session_id=xxx 会话恢复
12. P0-P2 无回归（26/26 前端测试 + 6/6 后端脱敏测试全绿）
13. LLM 输出脱敏（身份证/手机号/邮箱替换）

---

## 测试结果

| 层级 | 测试数 | 状态 |
|------|--------|------|
| `tests/services/test_llm_desensitize.py` | 6 | 全绿 |
| `tests/test_coach.py` | 6 | 全绿（含 meta 事件断言更新） |
| `__tests__/eventReducer.test.ts` | 16 | 全绿 |
| `__tests__/useCoachChat.test.ts` | 7 | 全绿 |
| `__tests__/useSessionRecovery.test.ts` | 3 | 全绿 |
| TypeScript `tsc --noEmit` | 0 errors | 通过 |

---

## 回滚方案

- 新组件以条件渲染隔离，关闭后回退 P2 行为
- 文件上传端点 `/api/coach/upload` 独立，不影响对话流
- 新事件 `meta`/`thinking` 为 NDJSON 新增行，旧前端忽略未知事件
