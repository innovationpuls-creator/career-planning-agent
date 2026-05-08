# P0a 最小流式对话闭环 — 实现计划

> 日期：2026-05-08
> 基于：[AI 教练智能体系统设计](../specs/2026-05-08-coach-agent-design.md)
> 范围：仅 P0a，不做工具调用 / Memory / Coordinator / thinking / 文件上传

---

## A. 现有代码扫描结果

### A1. 后端 FastAPI Router 注册方式

`backend/app/main.py` — 每个 router 文件导出一个 `router` 对象，`main.py` 中 `import` + `app.include_router(router)`。

Router 定义模式（以 student_competency_profile 为例）：
```python
router = APIRouter(prefix="/api/student-competency-profile", tags=["student-competency-profile"])
```

**结论：新增 coach router 按相同模式即可。**

### A2. 现有流式接口

集中在两个文件：

| 文件 | 端点 | 媒体类型 |
|------|------|----------|
| `api/student_competency_profile.py:452` | `POST /api/student-competency-profile/chat/stream` | `application/x-ndjson` |
| `api/career_development_report.py:192` | `GET .../tasks/{task_id}/stream` | `application/x-ndjson` |
| `api/career_development_report.py:278` | `GET .../tasks/{task_id}/stream` | `application/x-ndjson` |
| `api/job_transfer.py:112` | `GET /tasks/{task_id}/stream` | `application/x-ndjson` |
| `api/job_transfer.py:165` | `GET /{career_id}/stream` | `application/x-ndjson` |

已有 NDJSON 辅助函数（`api/student_competency_profile.py:140-141`）：
```python
def _ndjson_line(payload: dict[str, Any]) -> bytes:
    return f"{json.dumps(payload, ensure_ascii=False)}\n".encode("utf-8")
```

**结论：复用 `_ndjson_line` 模式。所有流使用 `StreamingResponse(event_stream(), media_type="application/x-ndjson")`。**

### A3. LLM 调用封装

`backend/app/services/llm.py` — `OpenAICompatibleLLMClient` 类。

现有方法：
- `chat_completion(messages, temperature)` → `str`（非流式，收集完整响应后返回）
- `chat_completion_structured(messages, temperature, json_schema)` → `dict`（JSON mode）
- `_chat_completion_raw(messages, temperature, extra_body)` → `str`（内部实现，带重试）

**关键缺失：没有 `chat_completion_stream()` 方法。需要新增。**

LLM client 使用 `httpx.AsyncClient`，支持 `stream=True` + `response.aiter_lines()`。

### A4. 认证 / current_user 获取方式

`backend/app/api/auth_dependencies.py`：

```python
def require_authenticated_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    token = extract_bearer_token(authorization)
    return get_current_user_from_token(db, token)
```

**结论：coach 端点直接复用 `require_authenticated_user`，不需要新增认证逻辑。**

### A5. 前端 request / fetch 封装

`myapp/src/services/ant-design-pro/api.ts`：

- REST API 使用 `import { request } from '@umijs/max'`
- 流式接口使用原生 `fetch` + `ReadableStream` + `TextDecoder`，不经过 `request`
- 已有完整的 NDJSON 流式解析实现：`streamStudentCompetencyChat()`（行 836-892）和 `streamCareerDevelopmentGoalPlanTask()` — 都是 `AsyncGenerator`
- `getAccessToken()` 位于 `myapp/src/utils/authToken.ts`

**结论：P0a 前端流式调用直接复用此模式，创建 `streamCoachChat()`。**

### A6. 路由配置文件

`myapp/config/routes.ts` — 数组，每个路由对象包含 `path`, `component`, `access`, `icon`, `name` 等字段。

**结论：新增 `/coach` 路由条目。**

### A7. 样式 token / motion token 可复用位置

| 文件 | 导出 | 用途 |
|------|------|------|
| `myapp/src/styles/claude-tokens.ts` | `claudeTokens`, `claudeColors`, `claudeShadows`, `claudeRadius`, `claudeFonts`, `claudeAlpha()` | 颜色、阴影、圆角、字体 |
| `myapp/src/styles/motion.ts` | `motionTokens`, `prefersReducedMotion()` | 缓动、时长、stagger |

**结论：直接 import 使用，不新建 token。**

### A8. /coach 页面或相关目录

**不存在。** 当前 pages 目录中无 `coach/` 目录。

---

## B. P0a 最小 API 契约

### 端点

```
POST /api/coach/chat/stream
```

### 请求

```json
{
  "message": "string (max 4000 chars)",
  "clientMessageId": "string (uuid)"
}
```

- Header: `Authorization: Bearer <token>`（由 `require_authenticated_user` 强制）
- Header: `Accept: application/x-ndjson`
- Content-Type: `application/json`

**Pydantic 字段命名**：后端用 `client_message_id` + `alias="clientMessageId"` + `populate_by_name=True`，同时接受 camelCase 和 snake_case，前端直接传 `clientMessageId`。

### 响应

```
Content-Type: application/x-ndjson
```

**仅允许 3 种事件，无其他事件：**

```jsonld
{"event":"delta","delta":"你好"}
{"event":"delta","delta":"，我"}
{"event":"delta","delta":"是AI教练"}
{"event":"error","code":"LLM_UNAVAILABLE","detail":"无法连接到 LLM 服务，请稍后重试","retryable":true}
{"event":"done","data":{"stopReason":"task_complete"}}
```

### 事件定义

| 事件 | 字段 | 类型 | 说明 |
|------|------|------|------|
| `delta` | `delta` | `string` | 单个或多个 token |
| `error` | `code` | `string` | 机器可读错误码 |
| `error` | `detail` | `string` | 人类可读错误描述 |
| `error` | `retryable` | `boolean` | 是否可以重试 |
| `done` | `data.stopReason` | `string` | 固定 `"task_complete"` |

### P0a 明确不返回

- `meta` 事件
- `thinking` 事件
- `tool_call` 事件
- `tool_result` 事件
- `agent_switch` 事件
- `route` 事件

### 后端错误码

| code | 说明 | retryable |
|------|------|-----------|
| `LLM_UNAVAILABLE` | LLM 服务不可达或超时 | true |
| `LLM_RATE_LIMITED` | LLM 速率限制 | true |
| `LLM_ERROR` | LLM 返回非 200 | true |
| `VALIDATION_ERROR` | 请求体校验失败 | false |
| `AUTH_ERROR` | 认证失败（401） | false |
| `INTERNAL_ERROR` | 内部异常 | false |

---

## C. 后端文件级计划

### C1. 新增：`backend/app/api/coach.py`

**职责**：定义 `POST /api/coach/chat/stream` 端点

**内容**：

```
router = APIRouter(prefix="/api/coach", tags=["coach"])

@router.post("/chat/stream")
async def stream_coach_chat(
    body: CoachChatRequest,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    ...
```

**关键逻辑**：
1. 校验 `body.message` 非空且 ≤ 4000 字符
2. 构造 system prompt（固定，简单教练开场白）
3. 调用 `CoachStreamService.generate(body.message)`
4. 返回 `StreamingResponse(event_stream(), media_type="application/x-ndjson")`

**验收方式**：
- `pytest backend/tests/api/test_coach.py`（新增测试文件）
- curl 手动测试流式响应

### C2. 新增：`backend/app/schemas/agent.py`

**职责**：P0a 请求 Pydantic model

**内容**：

```python
from pydantic import BaseModel, ConfigDict, Field

class CoachChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message: str = Field(..., min_length=1, max_length=4000)
    client_message_id: str = Field(
        ..., min_length=1, max_length=64, alias="clientMessageId"
    )
```

**验收方式**：Pydantic 自动校验，单元测试验证边界条件

### C3. 新增：`backend/app/services/coach_stream.py`

**职责**：P0a 流式生成服务

**主要函数**：

```python
async def generate_coach_stream(
    user_message: str,
    user: User,  # 预留，P0a 仅打日志
) -> AsyncGenerator[bytes, None]:
```

**内部流程**：
1. 构造 messages: `[system_prompt, user_message]`
2. 从 settings 获取 LLM client（复用 `OpenAICompatibleLLMClient.from_settings()`）
3. 调用 `client.chat_completion_stream(messages)` → `AsyncGenerator[str, None]`
4. 对每个 delta token 调用 `_ndjson_line({"event": "delta", "delta": token})`
5. 正常结束时发送 `_ndjson_line({"event": "done", "data": {"stopReason": "task_complete"}})`
6. 异常时发送 `_ndjson_line({"event": "error", "code": "...", "detail": "...", "retryable": true/false})`

**System Prompt（P0a 最小版）**：

```
你是一个大学生职业规划 AI 教练。你的职责是帮助学生进行职业规划，
包括了解他们的专业背景、兴趣和职业目标，并提供初步建议。
请用中文回复，保持专业、友善、鼓励的态度。
```

**复用**：
- `OpenAICompatibleLLMClient.from_settings()` — 复用现有 LLM client 工厂
- `_ndjson_line()` — 从 `api/student_competency_profile.py` 提取为共享工具或内联

**验收方式**：pytest 异步测试，mock LLM client 验证事件序列

### C4. 修改：`backend/app/services/llm.py`

**职责**：新增 `chat_completion_stream()` 方法

**新增方法**：

```python
async def chat_completion_stream(
    self, messages: list[ChatMessage], *, temperature: float = 0.7
) -> AsyncGenerator[str, None]:
```

**实现要点**：
1. POST `/chat/completions` 带 `"stream": true`
2. 使用 `httpx.AsyncClient.stream("POST", ...)` 发起请求
3. 按行迭代 `response.aiter_lines()`，解析 SSE 行：
   - 跳过空行
   - 跳过不以 `data: ` 开头的行
   - `data: [DONE]` → `break`（流结束信号）
   - `data: {...}` → JSON → `choices[0].delta.content`
4. `yield` 每个 content 片段
5. 异常时 raise `LLMClientError`（由调用方 `coach_stream.py` 捕获并转为 error 事件）
6. **不在此方法内处理重试** — P0a 中 stream 失败直接报错，不做透明重试

**复用**：同一 `httpx.AsyncClient` 实例，同一 `base_url`/`api_key`/`model`

**验收方式**：pytest + httpx mock，验证 generator 输出

### C5. 修改：`backend/app/main.py`

**职责**：注册 coach router

**改动**：在现有 `app.include_router(...)` 列表末尾添加：

```python
from app.api.coach import router as coach_router
app.include_router(coach_router)
```

**验收方式**：`curl http://localhost:8000/health` 仍正常，`/api/coach/chat/stream` 返回 401（无 token）

---

## D. 前端文件级计划

### D1. 新增：`myapp/src/pages/coach/index.tsx`

**职责**：Coach 页面主组件

**关键元素**：
- 消息列表（用户消息 + AI 消息）
- 底部输入框 + Send 按钮 + Stop 按钮
- 错误提示条
- 空状态引导

**P0a 明确不做**：
- 文件上传按钮（FileUploadButton）
- 待上传文件列表（PendingUploads）
- 任何 upload 相关 UI

**使用 `createStyles` from `antd-style`**，引用 `claudeTokens` 和 `motionTokens`。

**验收方式**：页面可打开不白屏，输入消息可见，loading 状态正常

### D2. 新增：`myapp/src/pages/coach/api.ts`

**职责**：`streamCoachChat()` — 流式 API 调用

**核心函数**：

```typescript
export async function* streamCoachChat(
  body: CoachChatRequest,
  signal: AbortSignal,
): AsyncGenerator<CoachChatStreamEvent, void, void>
```

**实现**：复用 `streamStudentCompetencyChat()` 的 NDJSON 解析模式：
1. `fetch('/api/coach/chat/stream', { method: 'POST', body: JSON.stringify(body), signal, headers: { Authorization, Accept, Content-Type } })`
2. `response.body.getReader()` + `TextDecoder`
3. 按行分割 buffer，`JSON.parse` 每一行
4. `yield` 解析后的事件

**验收方式**：jest 单元测试 mock fetch

### D3. 新增：`myapp/src/pages/coach/hooks/useCoachChat.ts`

**职责**：聊天状态机 hook

**类型定义**：

```typescript
type StreamState = 'idle' | 'connecting' | 'streaming' | 'error';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'sending' | 'streaming' | 'done' | 'error' | 'aborted';
}
```

**返回值**：

```typescript
{
  messages: ChatMessage[];
  streamState: StreamState;
  errorDetail: string | null;
  sendMessage: (text: string) => void;
  abort: () => void;
}
```

**核心逻辑**：
1. `sendMessage` → 创建 user message + 空 assistant message → `streamState='connecting'`
2. 第一个 `delta` → `streamState='streaming'`，追加到 assistant content
3. 后续 `delta` → 追加到 assistant content
4. `done` → assistant status='done' → `streamState='idle'`
5. `error` → assistant status='error' → `streamState='error'` → 保存 `errorDetail`
6. `abort` → 保留已输出内容 → assistant status='aborted' → `streamState='idle'`

**验收方式**：jest 单元测试，验证状态转换

### D4. 新增：`myapp/src/pages/coach/components/StreamingText.tsx`

**职责**：渲染 AI 输出的流式文本（P0a 中直接渲染文本，不带打字机动画）

**Props**：

```typescript
interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
}
```

**验收方式**：jest snapshot 测试

### D5. 修改：`myapp/config/routes.ts`

**职责**：新增 `/coach` 路由条目

**新增**（在 `/student-competency-profile` 之后）：

```typescript
{
  path: '/coach',
  name: 'AI 教练',
  icon: 'robot',
  access: 'canUser',
  component: './coach',
  hideInMenu: true,  // 从各页面的"问教练"按钮进入，不显示在侧边栏
},
```

**注意**：`hideInMenu: true` 表示 coach 页面不显示在左侧菜单。用户通过各功能页面的"问教练"入口进入。后续 Phase 如需独立入口，改为 `false` 即可。

**验收方式**：左侧菜单出现 "AI 教练" 入口，点击可跳转

---

## E. NDJSON Parser 计划

复用 `streamStudentCompetencyChat()` 中的成熟解析逻辑，处理以下场景：

### E1. 一个 chunk 包含多行 JSON

```typescript
buffer += decoder.decode(value, { stream: true });
while (true) {
  const newlineIndex = buffer.indexOf('\n');
  if (newlineIndex < 0) break;
  const line = buffer.slice(0, newlineIndex).trim();
  buffer = buffer.slice(newlineIndex + 1);
  if (!line) continue;
  yield JSON.parse(line);
}
```

**策略**：按 `\n` 分割，逐行处理。一行 = 一个事件。

### E2. 一行 JSON 被拆成多个 chunk

**策略**：`decoder.decode(value, { stream: true })` 保留不完整的多字节序列。buffer 中只取 `\n` 之前的完整行，剩余部分留在 buffer 等待下一个 chunk。

### E3. 空行

**策略**：`if (!line) continue;` 跳过空行。

### E4. JSON parse error

**策略**：
```typescript
try { yield JSON.parse(line) } catch { console.warn('NDJSON parse error', line); continue }
```
- 不中断流
- 不丢失后续事件
- console.warn 便于调试

### E5. 网络中断

**策略**：
- `fetch` 在 `AbortError` 或网络错误时 reject
- `useCoachChat` 的 `try/catch` 捕获，设置 `streamState='error'`
- 非 AbortError 时显示 "网络连接中断，请重试"

### E6. AbortController 中断

**策略**：
- `abort()` 方法调用 `abortController.abort()`
- `fetch` 抛出 `AbortError`
- `useCoachChat` 的 `finally` 块调用 `reader.releaseLock()` 释放资源
- 已渲染的内容保留，assistant status 标记为 `'aborted'`
- `streamState` 回到 `'idle'`

---

## F. 前端状态机

### 状态定义

```
idle → connecting → streaming → idle
  ↑                     ↓
  └──────────────────────┘
                         ↓
                       error → idle (重试/新消息)
```

### 状态转换表

| 当前状态 | 事件 | 动作 | 下一状态 |
|----------|------|------|----------|
| `idle` | `sendMessage` | 创建 user msg, 创建空 assistant msg, 发起 fetch | `connecting` |
| `connecting` | 第一个 `delta` | 追加 content 到 assistant msg | `streaming` |
| `streaming` | `delta` | 追加 content 到 assistant msg | `streaming` |
| `streaming` | `done` | 标记 assistant done, 清理 reader | `idle` |
| `connecting` | `error` | 删除空 assistant msg, 显示错误 | `error` |
| `streaming` | `error` | 标记 assistant error, 清理 reader | `error` |
| `streaming` | `abort` | 标记 assistant aborted, 清理 reader | `idle` |
| `connecting` | `abort` | 删除空 assistant msg, 清理 reader | `idle` |
| `error` | `sendMessage` | 清除错误, 同 idle.sendMessage | `connecting` |

### 禁止状态

- **不要在 streaming 时允许 sendMessage**（前端按钮显示 Stop）
- **不要在 idle 时显示 loading**
- **不要在 done 后保留 loading spinner**

---

## G. P0a 验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| 1 | `/coach` 页面可以打开，不白屏 | Playwright 截图 |
| 2 | 输入消息后可以看到用户消息气泡 | Playwright 截图 |
| 3 | 后端返回 delta 时前端逐步追加文本 | Playwright 连续截图或日志 |
| 4 | done 后 Send 按钮恢复可用，无 loading | Playwright 截图 |
| 5 | 后端异常时前端显示错误提示，不白屏 | 断开 LLM 后测试 |
| 6 | AbortController 可以停止生成 | 点击 Stop 后确认不再追加文本 |
| 7 | 不出现 thinking / tool_call / tool_result 事件 | 检查后端代码和前端事件处理 |
| 8 | 不改现有 ChatStream（`/api/student-competency-profile/chat/stream`） | diff 确认 |
| 9 | 不影响现有页面（home-v2, student-competency-profile 等） | 运行现有 e2e 测试 |
| 10 | 后端 pytest 和前端 tsc 通过 | CI 命令 |

---

## H. 验收命令

### 后端

```bash
# 运行 coach 相关测试
cd backend && python -m pytest tests/api/test_coach.py -v

# 运行所有后端测试（确保无回归）
cd backend && python -m pytest -v

# 手动测试流式响应
curl -X POST http://localhost:8000/api/coach/chat/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -H "Accept: application/x-ndjson" \
  -d '{"message":"你好","clientMessageId":"test-001"}' \
  --no-buffer
```

### 前端

```bash
# TypeScript 类型检查
cd myapp && npx tsc --noEmit

# Biome lint
cd myapp && npx @biomejs/biome lint

# Jest 单元测试（coach 页面）
cd myapp && npx jest src/pages/coach --coverage

# 运行所有 Jest 测试（确保无回归）
cd myapp && npx jest

# 完整 lint 检查
cd myapp && npm run lint
```

### E2E（可选，后续 Phase）

```bash
cd myapp && npx playwright test tests/coach/
```

---

## 附录：文件清单总览

### 新增文件

| # | 文件 | 类型 |
|---|------|------|
| 1 | `backend/app/api/coach.py` | 后端 API |
| 2 | `backend/app/schemas/agent.py` | 后端 Schema |
| 3 | `backend/app/services/coach_stream.py` | 后端 Service |
| 4 | `backend/tests/api/test_coach.py` | 后端测试 |
| 5 | `myapp/src/pages/coach/index.tsx` | 前端页面 |
| 6 | `myapp/src/pages/coach/api.ts` | 前端 API |
| 7 | `myapp/src/pages/coach/hooks/useCoachChat.ts` | 前端 Hook |
| 8 | `myapp/src/pages/coach/components/StreamingText.tsx` | 前端组件 |
| 9 | `myapp/src/pages/coach/__tests__/useCoachChat.test.ts` | 前端测试 |

### 修改文件

| # | 文件 | 改动 |
|---|------|------|
| 1 | `backend/app/services/llm.py` | 新增 `chat_completion_stream()` |
| 2 | `backend/app/main.py` | 注册 coach router |
| 3 | `myapp/config/routes.ts` | 新增 `/coach` 路由 |

### 不改的文件

- `backend/app/api/student_competency_profile.py`（现有 ChatStream）
- `myapp/src/services/ant-design-pro/api.ts`（新增函数在 `coach/api.ts`）
- 所有其他 66 个 REST API
- 所有现有页面
