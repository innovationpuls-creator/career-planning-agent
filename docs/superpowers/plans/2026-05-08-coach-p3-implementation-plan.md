# P3：前端完整体验

> 日期：2026-05-08
> 基于：[AI 教练智能体系统设计](../specs/2026-05-08-coach-agent-design.md)、[P2 可信记忆层实现计划](./2026-05-08-coach-p2-implementation-plan.md)
> 前提：P2 全部验收标准通过
> 原则：增量构建于 P0–P2 代码之上，不改已实现功能。P3 以**前端**为主，后端仅新增文件上传端点。

---

## 1. 目标

将当前最小可用对话页面升级为工业级对话 UI，对标 Claude 官网体验。

**一句话：P0–P2 能对话、能记住、能裁决，P3 让它好用、好看、可靠。**

核心差距（当前 vs P3 目标）：

| 维度 | 当前 (P0–P2) | P3 目标 |
|------|-------------|---------|
| 消息类型 | 仅 streaming text + 用户文本 | 文本 + 思考过程 + 工具调用卡片 + Agent 切换标识 + 系统消息 |
| 动画 | 无 | 10 种 framer-motion 动画（入场/状态/过渡） |
| 用户输入 | 纯文本输入 | Send/Stop 切换 + 文件上传 + 缩略图预览 |
| 错误处理 | 简单 error 提示 | GlobalErrorBar + 重试按钮 + 系统消息 |
| 历史会话 | URL session_id 恢复 | 侧边栏列表 + 新建/切换 |
| 组件结构 | 扁平的 index.tsx | 8+ 专用组件，结构化组织 |
| 事件处理 | 内联在 useCoachChat | 独立 eventReducer + 10 种事件 dispatch |

---

## 2. 非目标

- 不做 memory system 改动（P2 已冻结）
- 不做 Outbox / Dead Letter Queue / Background Worker（P5）
- 不做 CollectiveWisdom 数据填充（P5）
- 不做 L3 BERT 路由训练（P5）
- 不做真实业务工具对接（P3 不新增 mutation_gated 工具）
- 不做 tool_args 独立流式事件（保持 P0c 的 tool_call 内联 args，不拆分为 tool_call → tool_args → tool_result 三段式）
- 不做 agent_switch 后端实现（前端 AgentSwitchBadge 组件先就位，后端后续可 emit）
- thinking 事件有条件支持（LLM 返回 reasoning/thinking 内容时 emit，不返回时跳过；ThinkingBlock 组件就位）
- 不改现有 66 个 REST 端点
- 不改现有 ChatStream（简历解构页内嵌）
- 不改 P0–P2 已有功能逻辑（P3 在 Coordinator/LlmClient 中新增事件 emit 代码路径，不修改已有事件发射逻辑）
- 不引入新 UI 依赖（framer-motion 已是现有依赖）

---

## 3. 当前文件状态

### P0–P2 已存在的文件（P3 在此基础上增量构建）

```
myapp/src/pages/coach/
├── index.tsx                    # CoachChatPage — 入口页面（含消息列表 + 输入区）
├── api.ts                       # streamCoachChat() + listSessions / getSession / deleteSession
├── types.ts                     # CoachChatStreamEvent 联合类型（内联在 api.ts 或独立）
├── hooks/
│   ├── useCoachChat.ts          # 聊天状态机 hook（sendMessage/abort/streamState/messages）
│   └── useSessionRecovery.ts    # 会话恢复 hook（P1）
├── components/
│   ├── StreamingText.tsx         # 流式文本 + 闪烁光标（P0a）
│   ├── AgentBadge.tsx           # 当前 route agent 标签（P0b）
│   └── ToolCallCard.tsx         # 工具调用卡片 — spinner/check/error（P0c 基础版）
└── __tests__/
    ├── useCoachChat.test.ts
    └── useSessionRecovery.test.ts
```

### P3 新增 14 个前端文件 + 1 个后端文件 + 1 个测试文件

---

## 4. 数据库迁移

**无。** P3 不新增 DDL。

---

## 5. 后端文件级计划

### 5.1 新增文件（1 个）

| # | 文件 | 职责 |
|---|------|------|
| 1 | `backend/app/api/coach_upload.py` | `POST /api/coach/upload` — 文件上传端点，见 spec §2.8 |

### 5.2 修改文件（3 个）

| # | 文件 | 改动 |
|---|------|------|
| 1 | `backend/app/services/coach_coordinator.py` | 在 LLM 循环开始前 emit `meta` 事件（sessionId + assistantMessageId + activeAgent + createdAt） |
| 2 | `backend/app/services/llm.py` | (1) `chat_completion_stream()` 新增可选的 thinking/reasoning delta 识别：当 LLM 返回 `reasoning_content` 或 `thinking` 字段时 emit `thinking` 事件<br>(2) 新增 `desensitize()` — 对 delta/thinking 文本应用 SENSITIVE_PATTERNS 正则脱敏（身份证/手机号/邮箱），见 §5.4<br>(3) 维持 P0a 的 **Prompt Caching** 配置：`extra_headers={"anthropic-beta": "prompt-caching-2024-07-31"}` 不变；`thinking` 事件内容不加入 cache_control 段（避免缓存含思考过程） |
| 2b | `backend/app/services/coach_coordinator.py` | `run()` 中的 query_loop：delta/thinking 事件 emit 前调用 `desensitize()` 过滤 |
| 3 | `backend/app/main.py` | 注册 `coach_upload_router` |

### 5.3 上传端点设计

已在 spec 中定义完整实现，此处只列出 P3 涉及的改动要点。

```python
# backend/app/api/coach_upload.py
ALLOWED_UPLOAD_TYPES = {
    "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png", "image/jpeg",
}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB

@router.post("/upload")
async def upload_coach_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    # 类型校验 → 大小校验 → 存储至 uploads/{student_id}/{file_id} → 返回 file_id/name/type/size
```

**注意**：P3 不上病毒扫描（ClamAV 留到生产部署配置）。上传文件不需要在服务端持久化解析（解析已在简历解构流程中），P3 仅做存储与关联。

### 5.4 LLM 输出脱敏（Spec §2.8）

思维链和对话输出不应包含原始的用户敏感信息。在 `query_loop` 产出 delta/thinking 事件前执行轻量正则脱敏。

```python
# backend/app/services/llm.py

import re

SENSITIVE_PATTERNS = [
    (re.compile(r'\b\d{17}[\dXx]\b'), '[身份证号已隐藏]'),     # 身份证
    (re.compile(r'\b1[3-9]\d{9}\b'), '[手机号已隐藏]'),        # 手机号
    (re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'), '[邮箱已隐藏]'),
]

def desensitize(text: str) -> str:
    """对 LLM 输出文本应用脱敏过滤。轻量正则，不增加显著延迟（<1ms）。"""
    for pattern, replacement in SENSITIVE_PATTERNS:
        text = pattern.sub(replacement, text)
    return text
```

**调用位置**：`CoachCoordinator.run()` 中 query_loop 的 delta/thinking 事件 emit 前调用 `desensitize()`。`chat_completion_stream()` 在 yield chunk 前也调用（双重保障）。

**不脱敏的内容**：
- 工具调用参数/结果（由工具 handler 自行处理）
- 用户输入消息（由前端脱敏或由用户自行控制）
- memory mutation 的 evidence 字段（P2 已规定不得包含敏感字段）

**性能影响**：3 条正则匹配，对每条 delta chunk（通常 10-50 字符）执行 < 1ms，不影响流式体验。

---

## 6. 前端文件级计划

### 6.1 新增文件（14 个）

| # | 文件 | 职责 |
|---|------|------|
| 1 | `myapp/src/pages/coach/types.ts` | 从当前内联类型中提取：`CoachMessage`, `StreamEvent`, `ToolCallEntry`, `Attachment`, `PendingUpload`, `AgentName`, `StreamState` |
| 2 | `myapp/src/pages/coach/eventReducer.ts` | `dispatchEvent(state, event) → ChatState` — 纯函数 reducer，覆盖全部 NDJSON 事件 |
| 3 | `myapp/src/pages/coach/motion.ts` | 动画配置统一管理 — framer-motion variants + transition 常量 |
| 4 | `myapp/src/pages/coach/components/AssistantMessage.tsx` | AI 回复容器 — 组合 `StreamingText` + `ThinkingBlock` + `ToolCallCard[]` + `AgentSwitchBadge`，根据 status 显示不同状态 |
| 5 | `myapp/src/pages/coach/components/MessageBubble.tsx` | 用户消息气泡 — 文本 + 附件缩略图 + 入场动画 |
| 6 | `myapp/src/pages/coach/components/ThinkingBlock.tsx` | 思考过程块 — 可折叠展开 + 三点脉动动画 |
| 7 | `myapp/src/pages/coach/components/AgentSwitchBadge.tsx` | Agent 切换标识 — 组件先就位（后端后续 emit `agent_switch` 事件） |
| 8 | `myapp/src/pages/coach/components/SystemMessage.tsx` | 系统消息 — error / abort / retry-hint 三种变体 |
| 9 | `myapp/src/pages/coach/components/GlobalErrorBar.tsx` | 全局错误提示条 — 顶部滑入 + 自动消失 |
| 10 | `myapp/src/pages/coach/components/CoachChatHeader.tsx` | 顶部栏 — Agent 名称 + 会话标题 + 新建按钮 |
| 11 | `myapp/src/pages/coach/components/CoachChatBody.tsx` | 消息列表容器 — 虚拟滚动 + 自动滚动到底部 |
| 12 | `myapp/src/pages/coach/components/CoachChatInput.tsx` | 底部输入区 — Send/Stop 切换 + 文件上传按钮 + 附件预览 |
| 13 | `myapp/src/pages/coach/components/CoachChatSidebar.tsx` | 历史会话侧边栏 — 会话列表 + 新建/切换 |
| 14 | `myapp/src/pages/coach/components/PendingUploads.tsx` | 待发送附件预览 — 缩略图 + 上传进度 + 移除按钮 |

### 6.2 修改文件（5 个）

| # | 文件 | 改动 |
|---|------|------|
| 1 | `myapp/src/pages/coach/index.tsx` | 重构为 `CoachChatPage` 组件树：`Header + Body + Input + Sidebar + GlobalErrorBar` |
| 2 | `myapp/src/pages/coach/api.ts` | 追加 `uploadCoachFile()`；完善 `StreamEvent` 类型定义支持全部 10 种事件 |
| 3 | `myapp/src/pages/coach/hooks/useCoachChat.ts` | 追加 `retry()` / `uploadFile()` / `removeUpload()` / `loadSession()` / `newSession()`；集成 eventReducer |
| 4 | `myapp/src/pages/coach/components/StreamingText.tsx` | 增强：闪烁光标动画 + done 后光标消失 |
| 5 | `myapp/src/pages/coach/components/ToolCallCard.tsx` | 增强：anim 入场 + 成功描边动画 + 失败抖动 + 参数/结果可折叠 |

---

## 7. 组件树

```
CoachChatPage (index.tsx)
├── GlobalErrorBar                    # 顶部错误提示条
├── CoachChatSidebar                  # 历史会话侧边栏
├── CoachChatHeader                   # 顶部栏
├── CoachChatBody                     # 消息列表
│   ├── MessageBubble (user)          # 用户消息
│   ├── AssistantMessage              # AI 回复容器
│   │   ├── AgentSwitchBadge          # （可选）Agent 切换标识
│   │   ├── ThinkingBlock             # （可选）思考过程
│   │   ├── StreamingText             # 流式文本
│   │   └── ToolCallCard[]            # 工具调用卡片列表
│   ├── SystemMessage                 # 系统消息
│   └── ...more messages
└── CoachChatInput                    # 底部输入区
    ├── PendingUploads                # 待发送附件
    ├── ChatTextArea                  # 文本输入区
    ├── FileUploadButton              # 文件选择按钮
    ├── SendButton / StopButton       # 发送/停止
```

---

## 8. NDJSON 事件 → Dispatch 映射

### 8.1 事件来源说明

P0–P2 已实现 7 种事件。P3 新增 1 种后端事件（`meta`）+ 1 种条件事件（`thinking`）。`agent_switch` 仅前端组件就位。

| 事件 | 来源 | P3 状态 |
|------|------|--------|
| `delta`, `error`, `done` | P0a | 增强渲染（动画） |
| `route` | P0b | 字段不变（agent/rule/matched） |
| `tool_call`, `tool_result` | P0c | 增强渲染（动画 + 可折叠），args 内联在 tool_call 中 |
| `memory_result` | P2 | 接收但不驱动 UI 变化 |
| `meta` | **P3 新增** | Coordinator 在 LLM 循环前 emit |
| `thinking` | **P3 新增（条件）** | LLM 返回 reasoning/thinking 时 emit，不返回时无此事件 |
| `agent_switch` | 未实现 | 仅前端组件就位，后端后续 emit |

### 8.2 完整 dispatch 表

| event | dispatch 动作 | 影响组件 |
|-------|--------------|---------|
| `meta` | 设置 sessionId + 创建 AssistantMessage（id 由后端指定） | CoachChatHeader |
| `route` | 更新 activeAgent（字段：agent, rule, matched） | AgentBadge（已有） |
| `delta` | 追加 assistant 消息 content | StreamingText |
| `thinking` | 追加 assistant 消息 thinkingContent，显示 ThinkingBlock | ThinkingBlock |
| `tool_call` | 新建 ToolCallEntry（含内联 args），加入 assistant 消息 | ToolCallCard |
| `tool_result` | 更新 ToolCallEntry.status + result/error | ToolCallCard |
| `memory_result` | 可选记录（mutationId + decisionType），不驱动 UI 变化 | — |
| `error` | 标记 assistant 为 error + 追加 SystemMessage | SystemMessage + GlobalErrorBar |
| `done` | 标记 assistant 为 completed，streamState → idle | StopButton 消失 |

**注意**：P3 不发出独立的 `tool_args` 事件。P0c 在 `tool_call` 中内联 args（`toolArgs` 字段），eventReducer 在创建 ToolCallEntry 时直接从 `tool_call` 事件中取 `toolArgs`。

---

## 9. 动画系统（10 种）

基于 **framer-motion**（已是现有依赖 `framer-motion@^12.38.0`）。所有动画必须遵守 `prefersReducedMotion`。

| # | 动画 | 触发 | 实现 | 时长 |
|---|------|------|------|------|
| 1 | 流式光标闪烁 | delta 开始 | CSS `@keyframes blink` step-end infinite，done 时移除 | 1s 循环 |
| 2 | Thinking 展开 | thinking 首次 | `AnimatePresence` + height `0→auto` + opacity | 0.3s |
| 3 | Thinking 三点脉动 | thinking 持续 | 三个 `<span>` 依次 scale `1→1.3→1`，stagger 0.15s | 0.9s 循环 |
| 4 | ToolCallCard 入场 | tool_call | `motion.div` y:8→0 + opacity 0→1 | 0.3s |
| 5 | ToolCall 成功勾 | tool_result success | SVG circle 描边 + check pathLength 0→1 | 0.4s |
| 6 | ToolCall 失败抖动 | tool_result error | x: `[0, -4, 4, -4, 4, 0]` keyframes | 0.3s |
| 7 | AgentSwitchBadge | agent_switch | x: -12→0 + opacity 0→1 | 0.3s |
| 8 | UserBubble 入场 | sendMessage（本地） | x: 16→0 + opacity 0→1 | 0.25s |
| 9 | StopButton 显隐 | streamState 切换 | `AnimatePresence` fade + scale 0.8→1 | 0.15s |
| 10 | GlobalErrorBar 滑入 | 全局错误 | y: -24→0 + opacity 0→1 | 0.3s |

### 动画配置统一管理

```typescript
// myapp/src/pages/coach/motion.ts
import { type Variants } from 'framer-motion';

export const MOTION = {
  fadeInUp: { initial: { y: 8, opacity: 0 }, animate: { y: 0, opacity: 1 } },
  fadeInLeft: { initial: { x: -12, opacity: 0 }, animate: { x: 0, opacity: 1 } },
  fadeInRight: { initial: { x: 16, opacity: 0 }, animate: { x: 0, opacity: 1 } },
  slideDown: { initial: { y: -24, opacity: 0 }, animate: { y: 0, opacity: 1 } },
  scaleIn: { initial: { scale: 0.8, opacity: 0 }, animate: { scale: 1, opacity: 1 } },
  shake: { x: [0, -4, 4, -4, 4, 0] },
} satisfies Record<string, Variants>;

export const TRANSITION = {
  fast: { duration: 0.15, ease: 'easeOut' },
  normal: { duration: 0.3, ease: 'easeOut' },
};
```

---

## 10. useCoachChat 增强

### 10.1 新增方法

```typescript
interface UseCoachChatReturn {
  // P0 已有
  messages: CoachMessage[];
  streamState: 'idle' | 'connecting' | 'streaming' | 'error';
  activeAgent: AgentName | null;
  sessionId: string | null;
  sendMessage: (content: string) => Promise<void>;
  abort: () => void;

  // P1 已有
  loadSession: (sessionId: string) => Promise<void>;
  newSession: (step?: string) => void;

  // P3 新增
  retry: (failedMessageId: string) => Promise<void>;
  uploadFile: (file: File) => Promise<Attachment>;
  removeUpload: (fileId: string) => void;
  pendingUploads: PendingUpload[];
}
```

### 10.2 状态机

与 P0–P2 的 4 状态（idle/connecting/streaming/error）一致，新增 `aborting` 过渡状态和重试路径：

```
idle ──sendMessage()──▶ connecting ──meta──▶ streaming
  ▲                         │                    │
  │                         └──error────────────▶│ error
  │                                              │
  ├── streaming: abort() ──▶ aborting            │
  │    → reader.cancel()    → 追加 SystemMessage  │
  │    → streamState = idle                       │
  │                                              │
  ├── streaming: done ──▶ idle                   │
  ├── streaming: error ──▶ error                 │
  │    error: retry() ──▶ connecting             │
  └── error: newSession() ──▶ idle               │
```

`aborting` 是瞬时过渡状态，用户不可见。其作用是确保 `reader.cancel()` 完成后再将 state 切到 idle，避免残留 chunk 破坏新状态。

### 10.3 retry 实现

```typescript
async function retry(failedMessageId: string) {
  const failedMsg = state.messages.find(m => m.id === failedMessageId);
  if (!failedMsg || failedMsg.role !== 'user') return;
  const idx = state.messages.indexOf(failedMsg);
  // 删除该消息之后的消息（包括该消息和它的回复）
  setState(s => ({ ...s, messages: s.messages.slice(0, idx) }));
  await sendMessage(failedMsg.content, { attachments: failedMsg.attachments });
}
```

### 10.4 uploadFile 实现

```typescript
async function uploadFile(file: File): Promise<Attachment> {
  const tempId = buildId('upload');
  setState(s => ({ ...s, pendingUploads: [
    ...s.pendingUploads,
    { fileId: tempId, name: file.name, type: file.type, size: file.size,
      uploadState: 'uploading', progress: 0, file },
  ]}));

  try {
    const formData = new FormData(); formData.append('file', file);
    const response = await request('/api/coach/upload', {
      method: 'POST', data: formData, requestType: 'form',
      onUploadProgress: (e) => { /* 更新 progress */ },
    });
    const attachment: Attachment = {
      fileId: response.file_id, name: response.name,
      type: response.type, size: response.size,
    };
    setState(s => updatePendingUpload(s, tempId,
      pu => ({ ...pu, ...attachment, uploadState: 'ready' })));
    return attachment;
  } catch (err) {
    setState(s => updatePendingUpload(s, tempId,
      pu => ({ ...pu, uploadState: 'error', errorDetail: (err as Error).message })));
    throw err;
  }
}
```

---

## 11. 数据流

### 11.1 消息发送（完整路径）

```
用户在 CoachChatInput 中输入文本 +（可选）附件
  → sendMessage(text, attachments?)
    → 创建 UserMessage（含 clientMessageId 幂等键）
    → streamState = 'connecting'
    → fetch POST /api/coach/chat/stream
    → 建立 NDJSON ReadableStream
    → streamState = 'streaming'
    → for each line:
      → eventReducer(state, parsedEvent)
        → meta:    设置 sessionId + 创建 AssistantMessage
        → route:   更新 activeAgent（字段：agent, rule, matched）
        → delta:   追加到当前 AssistantMessage.content
        → thinking:追加到当前 AssistantMessage.thinkingContent（条件事件）
        → tool_call:  创建 ToolCallEntry（含内联 args）加入 assistant 消息
        → tool_result:更新 ToolCallEntry.status + result/error
        → memory_result:可选记录 mutationId + decisionType
        → error:  标记 current AssistantMessage.error + 插入 SystemMessage + GlobalErrorBar
        → done:   标记 current AssistantMessage.completed + streamState = idle
    → on error / abort: streamState = error / idle + SystemMessage
```

### 11.2 文件上传路径

```
用户在 CoachChatInput 选择文件
  → uploadFile(file)
    → 创建 PendingUpload（uploadState: 'uploading'）
    → POST /api/coach/upload (FormData)
    → 成功 → PendingUpload.uploadState = 'ready'（获取 fileId）
    → 失败 → PendingUpload.uploadState = 'error'
  → 用户发送消息时携带 attachments: Attachment[]
  → 后端收到后处理
```

### 11.3 会话侧边栏

```
CoachChatSidebar 挂载
  → fetch GET /api/coach/sessions → 会话列表
  → 点击会话 → loadSession(sessionId)
    → fetch GET /api/coach/sessions/:id → getSessionDetail
    → 加载 messages + summary → 替换当前对话
  → 点击"新建" → newSession() → 清除本地状态
```

---

## 12. 样式方案

沿用现有三层体系（不引入新方案）：

1. **claudeTokens** — 全局调色板/间距/圆角 token（`claude-tokens.ts`）
2. **`global.less`** — CSS custom properties 补充
3. **`createStyles` (`antd-style`)** — 每个组件的样式

### 组件样式模式

```typescript
// example: ThinkingBlock 的样式
const useStyles = createStyles(({ css, token }) => ({
  container: css`
    background: ${token.colorBgElevated};
    border-radius: ${token.borderRadius}px;
    padding: ${token.paddingSM}px;
    margin-bottom: 8px;
  `,
  dots: css`
    display: flex; gap: 4px;
    span { width: 6px; height: 6px; border-radius: 50%; background: ${token.colorTextSecondary}; }
  `,
}));
```

---

## 13. 文件清单汇总

| # | 文件 | P0a | P0b | P0c | P1 | P2 | P3 | 操作 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---:|:----:|
| **后端** | | | | | | | | |
| 1 | `api/coach_upload.py` | — | — | — | — | — | **新增** | 创建 |
| 2 | `api/coach.py` | ✓ | ✓ | ✓ | ✓ | ✓ | — | 不改 |
| 3 | `services/coach_coordinator.py` | — | — | ✓ | ✓ | ✓ | **修改** | emit meta 事件 + desensitize 调用 |
| 4 | `services/llm.py` | ✓ | — | — | — | — | **修改** | thinking delta 识别 + desensitize() |
| 5 | `main.py` | ✓ | — | — | ✓ | — | **修改** | 注册 upload router |
| **前端 — 页面** | | | | | | | | |
| 4 | `pages/coach/index.tsx` | ✓ | ✓ | ✓ | ✓ | — | **修改** | 重构组件树 |
| **前端 — 类型/事件** | | | | | | | | |
| 5 | `pages/coach/types.ts` | — | — | — | — | — | **新增** | 提取类型 |
| 6 | `pages/coach/eventReducer.ts` | — | — | — | — | — | **新增** | 10 事件 dispatch |
| 7 | `pages/coach/api.ts` | ✓ | ✓ | ✓ | ✓ | ✓ | **修改** | 追加 uploadCoachFile |
| 8 | `pages/coach/motion.ts` | — | — | — | — | — | **新增** | 动画配置 |
| **前端 — hooks** | | | | | | | | |
| 9 | `hooks/useCoachChat.ts` | ✓ | ✓ | ✓ | ✓ | ✓ | **修改** | retry/upload |
| 10 | `hooks/useSessionRecovery.ts` | — | — | — | ✓ | — | — | 不改 |
| **前端 — 组件** | | | | | | | | |
| 11 | `components/CoachChatHeader.tsx` | — | — | — | — | — | **新增** | 顶部栏 |
| 12 | `components/CoachChatBody.tsx` | — | — | — | — | — | **新增** | 消息列表 |
| 13 | `components/CoachChatInput.tsx` | — | — | — | — | — | **新增** | 输入区 |
| 14 | `components/CoachChatSidebar.tsx` | — | — | — | — | — | **新增** | 侧边栏 |
| 15 | `components/MessageBubble.tsx` | — | — | — | — | — | **新增** | 用户气泡 |
| 16 | `components/AssistantMessage.tsx` | — | — | — | — | — | **新增** | AI 回复容器 |
| 17 | `components/ThinkingBlock.tsx` | — | — | — | — | — | **新增** | 思考块 |
| 18 | `components/AgentSwitchBadge.tsx` | — | — | — | — | — | **新增** | 切换标识 |
| 19 | `components/SystemMessage.tsx` | — | — | — | — | — | **新增** | 系统消息 |
| 20 | `components/GlobalErrorBar.tsx` | — | — | — | — | — | **新增** | 全局错误 |
| 21 | `components/PendingUploads.tsx` | — | — | — | — | — | **新增** | 附件预览 |
| 22 | `components/StreamingText.tsx` | ✓ | — | — | — | — | **修改** | 光标动画 |
| 23 | `components/ToolCallCard.tsx` | — | — | ✓ | — | — | **修改** | anim + collapsible |
| 24 | `components/AgentBadge.tsx` | — | ✓ | — | — | — | — | 不改 |
| **前端 — 测试** | | | | | | | | |
| 25 | `__tests__/eventReducer.test.ts` | — | — | — | — | — | **新增** | 事件 dispatch |
| 26 | `__tests__/useCoachChat.test.ts` | ✓ | ✓ | ✓ | ✓ | ✓ | **修改** | retry/upload 路径 |
| 27 | `__tests__/useSessionRecovery.test.ts` | — | — | — | ✓ | — | — | 不改 |

**新增：** 17 文件（1 后端 + 14 前端 + 2 测试）
**修改：** 9 文件（3 后端 + 5 前端 + 1 测试）
**不改：** 3 文件（coach.py, useSessionRecovery.ts, AgentBadge.tsx）

---

## 14. 测试文件

### 14.1 LLM 脱敏单元测试

文件：`backend/tests/services/test_llm_desensitize.py`

| # | 测试 | 断言 |
|---|------|------|
| 1 | `test_desensitize_id_card` | `"身份证 110101199001011234 在这里"` → `"身份证 [身份证号已隐藏] 在这里"` |
| 2 | `test_desensitize_phone` | `"手机号 13812345678 联系"` → `"手机号 [手机号已隐藏] 联系"` |
| 3 | `test_desensitize_email` | `"邮箱 test@example.com 有效"` → `"邮箱 [邮箱已隐藏] 有效"` |
| 4 | `test_desensitize_multiple` | 同一文本含身份证+手机+邮箱 → 全部替换 |
| 5 | `test_desensitize_no_match` | 无敏感信息文本原样返回 |
| 6 | `test_desensitize_performance` | 1000 字符文本处理 < 1ms |

### 14.2 eventReducer 单元测试

文件：`myapp/src/pages/coach/__tests__/eventReducer.test.ts`

| # | 测试 | 断言 |
|---|------|------|
| 1 | `meta 事件创建 AssistantMessage` | messages.length +1，且 role == 'assistant' |
| 2 | `delta 追加到当前 assistant 消息` | 消息 content 正确追加 |
| 3 | `thinking 追加 thinkingContent` | thinkingContent 累加正确 |
| 4 | `tool_call 创建 ToolCallEntry` | toolCalls 数组新增一项 |
| 5 | `tool_result 更新对应 ToolCallEntry` | 按 toolCallId 匹配更新 status |
| 6 | `agent_switch 插入 AgentSwitchMessage` | 新消息 role == 'agent-switch' |
| 7 | `error 事件触发 error 状态` | streamState == 'error'，SystemMessage 出现 |
| 8 | `done 事件完成状态` | streamState == 'idle'，last assistant completed |
| 9 | `abort 路径` | streamState == 'idle'，SystemMessage 含中止提示 |
| 10 | `retry 清空失败消息` | 从 failedMessageId 起清空 |

### 14.3 useCoachChat 新增测试

文件：`myapp/src/pages/coach/__tests__/useCoachChat.test.ts`

| # | 测试新增 |
|---|---------|
| 1 | `retry 重新发送消息` |
| 2 | `uploadFile 添加 PendingUpload` |
| 3 | `uploadFile 成功转为 ready` |
| 4 | `uploadFile 失败转为 error` |
| 5 | `removeUpload 移除附件` |
| 6 | `sendMessage 携带 attachments` |
| 7 | `loadSession 加载历史会话` |

---

## 15. 验收标准

1. **消息完整展示**：用户消息 → AI 回复（含流式文本）→ 工具调用卡片 → 思考过程块，全部正常渲染
2. **ThinkingBlock**：AI 思考时显示可折叠的思考过程 + 三点脉动动画；结束后自动收起
3. **ToolCallCard**：调用时 spinner → 成功✓ / 失败抖动✗；参数和结果可折叠展开
4. **Stop 按钮**：streaming 时发送按钮变为停止按钮；停止后 AI 停止回复并显示"已停止生成"
5. **重试**：错误消息出现重试按钮；点击后删除失败消息重新发送
6. **文件上传**：选择文件 → 缩略图预览 → 发送带附件消息 → 附件在用户气泡中可见
7. **GlobalErrorBar**：全局错误时顶部滑入错误条；点击关闭或自动消失
8. **自滚动**：新消息出现时自动滚动到底部；向上滚动查看历史时不会自动跳转
9. **侧边栏**：显示历史会话列表；点击切换会话；新会话正常创建
10. **动画**：全部 10 种动画在正确时机触发；`prefersReducedMotion` 时不动画
11. **session 恢复**：`?session_id=xxx` 打开后历史消息完整渲染
12. **P0–P2 无回归**：stream/route/tool_call/tool_result/done/error 事件流正常，页面不白屏
13. **LLM 输出脱敏**：delta/thinking 事件中身份证号替换为 `[身份证号已隐藏]`，手机号替换为 `[手机号已隐藏]`，邮箱替换为 `[邮箱已隐藏]`；脱敏不影响流式性能（<1ms/chunk）

---

## 16. 回滚方案

### 方案 A：关闭新组件（渐进式）

```
CoachChatPage 中条件渲染，切换回旧的扁平化 index.tsx：
<ConditionalUI
  enableAnimations={false}
  enableThinking={false}
  enableSidebar={false}
  enableUpload={false}
/>
```

- 所有新组件以 feature flag 控制
- 关闭后行为退回到 P2（基本可用）
- 文件上传端点 `/api/coach/upload` 独立，不影响对话

### 方案 B：移除单个功能

```
git revert commit_file_upload
git revert commit_sidebar
```

- 恢复单个文件，不影响其他功能

### 方案 C：全量回滚

```
git revert <p3-merge-commit>
```

- 回到 P2 状态
- P0–P2 验收标准仍通过

---

## 17. 进入 P4 的条件

- [ ] 全部 13 项验收标准通过
- [ ] eventReducer 测试覆盖率 ≥ 90%
- [ ] 全部 10 种动画正常运行（手动验证 + prefersReducedMotion 验证）
- [ ] 文件上传功能完整（curl 测试后端 + 前端选择/预览/发送）
- [ ] 侧边栏会话列表/切换/新建流程正常
- [ ] P0–P2 验收标准无回归
- [ ] 前端 tsc + jest 全部绿
- [ ] UI 视觉上对标 Claude 官网（无白屏、无布局偏移、无 JavaScript 报错）

---

## 附录 A：P3 新增组件 Props 定义

```typescript
// ThinkingBlock
interface ThinkingBlockProps {
  content: string;
  isStreaming: boolean;
}

// ToolCallCard
interface ToolCallCardProps {
  toolCall: ToolCallEntry;
}

// AgentSwitchBadge
interface AgentSwitchBadgeProps {
  from: AgentName;
  to: AgentName;
  reason?: string;
}

// SystemMessage
interface SystemMessageProps {
  kind: 'info' | 'error' | 'abort' | 'retry-hint';
  content: string;
  retryable?: boolean;
  onRetry?: () => void;
}

// GlobalErrorBar
interface GlobalErrorBarProps {
  visible: boolean;
  message: string;
  onClose: () => void;
  autoHideMs?: number;      // 默认 8000ms
}

// CoachChatSidebar
interface CoachChatSidebarProps {
  open: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}
```

## 附录 B：状态对比 — P2 vs P3

| 特性 | P2 | P3 |
|------|:--:|:--:|
| 流式文本 | ✓ 基础 | ✓ 光标动画 + done 消失 |
| 路由事件 | ✓ AgentBadge | ✓ (不变) |
| 工具调用卡片 | ✓ 基础 | ✓ 入场/成功/失败动画 + 可折叠 |
| 思考过程 | ✗ | ✓ ThinkingBlock + 三点脉动 |
| Agent 切换 | ✗ | ✓ AgentSwitchBadge (组件就位) |
| 系统消息 | ✗ | ✓ error/abort/retry |
| 全局错误条 | ✗ | ✓ GlobalErrorBar |
| 侧边栏 | ✗ | ✓ CoachChatSidebar |
| 文件上传 | ✗ | ✓ 前端上传 + 后端端点 |
| 重试 | ✗ | ✓ retry() |
| 停止按钮 | ✗ | ✓ Send/Stop 切换 |
| 动画 | ✗ | ✓ 10 种 framer-motion |
| 事件处理 | 内联在 hook | ✓ 独立 reducer |
| 会话恢复 | ✓ | ✓ (不变) |
| 学生隔离 | ✓ | ✓ (不变) |
