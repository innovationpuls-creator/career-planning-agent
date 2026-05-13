# P0 三阶段实现计划

> 日期：2026-05-08
> 基于：[AI 教练智能体系统设计](../specs/2026-05-08-coach-agent-design.md)
> 原则：每阶段独立可交付、可回滚。后一阶段基于前一阶段的代码增量构建。

---

## 事件格式规范（P0a–P0c 统一）

所有 NDJSON 事件采用 **flat camelCase**，不使用嵌套 `data` 对象。

| 事件 | 字段 |
|------|------|
| `delta` | `event`, `delta` |
| `error` | `event`, `code`, `detail`, `retryable` |
| `done` | `event`, `stopReason` |
| `route` | `event`, `agent`, `rule`, `matched?` |
| `tool_call` | `event`, `toolCallId`, `toolName`, `toolArgs` |
| `tool_result` | `event`, `toolCallId`, `toolName`, `result` |

**禁止：** 嵌套 `data: {}` 对象、snake_case key。

---

# P0a：最小流式对话闭环

## 目标

用户在 `/coach` 页面输入消息 → 前端 POST `/api/coach/chat/stream` → 后端返回 NDJSON 流 → 前端逐 token 渲染 → done 结束 → 页面不白屏。

## 非目标

不做工具调用、ToolRegistry、Memory、ConversationSummary、Qdrant、Coordinator 路由、L4 LLM 路由、thinking、tool_args、agent_switch、文件上传、历史侧边栏、Outbox。不改现有 ChatStream 和 66 个 REST API。不引入新中间件。

## 新增文件

| # | 文件 | 职责 |
|---|------|------|
| 1 | `backend/app/api/coach.py` | `POST /api/coach/chat/stream` 端点 |
| 2 | `backend/app/schemas/agent.py` | `CoachChatRequest` Pydantic model（`client_message_id` + `alias="clientMessageId"` + `populate_by_name=True`） |
| 3 | `backend/app/services/coach_stream.py` | `generate_coach_stream()` — 调用 LLM stream，生成 NDJSON 事件 |
| 4 | `backend/tests/api/test_coach.py` | 后端流式端点测试 |
| 5 | `myapp/src/pages/coach/index.tsx` | Coach 页面主组件（消息列表 + 输入区 + 错误提示） |
| 6 | `myapp/src/pages/coach/api.ts` | `streamCoachChat()` AsyncGenerator |
| 7 | `myapp/src/pages/coach/hooks/useCoachChat.ts` | 聊天状态机 hook（idle/connecting/streaming/error） |
| 8 | `myapp/src/pages/coach/components/StreamingText.tsx` | 流式文本渲染组件 |
| 9 | `myapp/src/pages/coach/__tests__/useCoachChat.test.ts` | 前端状态机测试 |

## 修改文件

| # | 文件 | 改动 |
|---|------|------|
| 1 | `backend/app/services/llm.py` | 新增 `chat_completion_stream()` — httpx stream POST，解析 SSE（跳过空行/非 data: 行，遇 `data: [DONE]` break），yield content 片段。**Prompt Caching**：Stream 调用时设 `extra_headers={"anthropic-beta": "prompt-caching-2024-07-31"}`；Context Builder 静态段（agent persona + 通用后缀）末尾追加 `\n{"cache_control": {"type": "ephemeral"}}\n` |
| 2 | `backend/app/main.py` | 注册 coach router |
| 3 | `myapp/config/routes.ts` | 新增 `/coach` 路由（`hideInMenu: true`） |

## 数据库迁移

无。

## API 契约

```
POST /api/coach/chat/stream
Content-Type: application/json
Accept: application/x-ndjson
Authorization: Bearer <token>

请求：{"message": "string", "clientMessageId": "string"}

响应（仅 3 种事件，统一 flat camelCase）：
{"event":"delta","delta":"..."}
{"event":"error","code":"...","detail":"...","retryable":true}
{"event":"done","stopReason":"task_complete"}
```

## 测试文件

| # | 文件 | 内容 |
|---|------|------|
| 1 | `backend/tests/api/test_coach.py` | mock LLM stream → 验证 NDJSON 事件序列；验证 401；验证空 message 被拒 |
| 2 | `myapp/src/pages/coach/__tests__/useCoachChat.test.ts` | 状态转换覆盖（idle→connecting→streaming→idle；error 路径；abort 路径） |

## 验收标准

1. `/coach` 页面可打开不白屏
2. 输入消息后用户消息可见
3. delta 时前端逐步追加文本
4. done 后 Send 按钮恢复
5. 后端异常时显示错误不白屏
6. AbortController 可停止生成
7. 不出现 thinking / tool_call / tool_result 事件
8. 不改现有 ChatStream
9. 不影响现有页面
10. 后端 pytest + 前端 tsc 通过

## 验收命令

```bash
# 后端
cd backend && python -m pytest tests/api/test_coach.py -v
# 手动
curl -X POST http://localhost:8000/api/coach/chat/stream \
  -H "Authorization: Bearer <token>" -H "Accept: application/x-ndjson" \
  -H "Content-Type: application/json" \
  -d '{"message":"你好","clientMessageId":"test-001"}' --no-buffer

# 前端
cd myapp && npx tsc --noEmit && npx @biomejs/biome lint
cd myapp && npx jest src/pages/coach --coverage
```

## 回滚方案

- 从 `main.py` 移除 `app.include_router(coach_router)` 一行
- 从 `routes.ts` 移除 `/coach` 路由条目
- 删除 `api/coach.py`、`services/coach_stream.py`、`schemas/agent.py`、`pages/coach/`
- LLM client 的 `chat_completion_stream()` 方法保留无害（无调用方）

## 进入 P0b 的条件

- [ ] 全部 10 项验收标准通过
- [ ] 后端 pytest 全部绿
- [ ] 前端 tsc + biome lint + jest 全部绿
- [ ] 手动 curl 流式响应正常

---

# P0b：路由 + Context Builder 最小版

## 目标

在 P0a 流式对话基础上加入**路由事件**和**静态上下文构建**，使后端能在回复第一条 delta 之前告知前端当前活跃的 sub-agent，并基于用户消息和规则选择不同的 system prompt。

## 非目标

不做 L4 LLM 路由、不做 Memory System 动态召回、不做 ConversationSummary、不做 confidence scoring、不做 sub-agent 切换（agent_switch）、不做 BERT 分类器训练。

## 路由设计

### L1：显式命令路由

用户以 `/` 开头时直接路由到对应 agent：

| 命令 | agent | system prompt 主题 |
|------|-------|-------------------|
| `/resume` | ResumeCoach | 简历分析与优化 |
| `/match` | CareerMatchCoach | 岗位匹配与推荐 |
| `/learn` | LearningPathCoach | 学习路径规划 |
| `/report` | ReportCoach | 职业成长报告 |

### L2：关键词规则路由

无 L1 匹配时，对用户消息做关键词匹配：

| 关键词 | agent |
|--------|-------|
| 简历、修改、优化、经历、项目、实习 | ResumeCoach |
| 岗位、匹配、推荐、适合、做什么、转行 | CareerMatchCoach |
| 学习、课程、技能、提升、考证、培训 | LearningPathCoach |
| 报告、进展、总结、评估、分析 | ReportCoach |
| 默认（无匹配） | CareerCoach（通用） |

### Route 事件

在所有 delta 之前发送一次 route 事件：

```json
{"event":"route","agent":"CareerMatchCoach","rule":"L2_keyword","matched":"岗位匹配"}
```

字段（全部 flat，与 delta/error/done 统一）：
- `agent`: 当前活跃 agent 名称
- `rule`: 路由规则来源（`L1_command` / `L2_keyword` / `L0_default`）
- `matched`（仅 L1/L2）: 匹配到的命令或关键词

## 新增文件

| # | 文件 | 职责 |
|---|------|------|
| 1 | `backend/app/services/coach_router.py` | `route_message(text) → RouteDecision` — L1/L2 路由逻辑 |
| 2 | `backend/app/services/context_builder.py` | `build_system_prompt(agent, user) → str` — 静态 prompt 模板 |
| 3 | `backend/tests/services/test_coach_router.py` | 路由逻辑单元测试 |
| 4 | `backend/tests/services/test_context_builder.py` | Context Builder 单元测试 |
| 5 | `myapp/src/pages/coach/components/AgentBadge.tsx` | 显示当前活跃 agent 名称的小标签 |

## 修改文件

| # | 文件 | 改动 |
|---|------|------|
| 1 | `backend/app/api/coach.py` | `stream_coach_chat` 调用 `route_message()` → 发送 route 事件 → `build_system_prompt()` 构造 messages |
| 2 | `backend/app/services/coach_stream.py` | `generate_coach_stream()` 接受 `system_prompt` 参数替代硬编码 prompt |
| 3 | `backend/app/schemas/agent.py` | 新增 `RouteDecision` dataclass 和 `CoachStreamEvent` 联合类型 |
| 4 | `myapp/src/pages/coach/api.ts` | `CoachChatStreamEvent` 联合类型新增 `route` 事件 |
| 5 | `myapp/src/pages/coach/hooks/useCoachChat.ts` | 处理 `route` 事件 → 设置 `activeAgent` 状态 |
| 6 | `myapp/src/pages/coach/index.tsx` | 渲染 `AgentBadge` |

## 数据库迁移

无。

## API 契约变更

新增 `route` 事件（在第一个 `delta` 之前发送）：

```json
{"event":"route","agent":"CareerMatchCoach","rule":"L2_keyword","matched":"岗位匹配"}
```

完整事件类型（4 种）：
```
route → delta → ... → delta → done
route → delta → ... → error
```

## 测试文件

| # | 文件 | 内容 |
|---|------|------|
| 1 | `backend/tests/services/test_coach_router.py` | L1 命令匹配（`/resume` → ResumeCoach）、L2 关键词匹配、L0 默认回落、边界（空消息、纯标点） |
| 2 | `backend/tests/services/test_context_builder.py` | 每个 agent 返回非空 prompt、prompt 包含 agent 名称和中文指令 |
| 3 | `backend/tests/api/test_coach.py` | 追加：验证 route 事件在 delta 之前、验证 L1/L2 路由正确 |

## 验收标准

1. L1 `/resume` 等命令返回正确 agent 的 route 事件
2. L2 关键词 "帮我改简历" 路由到 ResumeCoach
3. 无匹配时回落 CareerCoach
4. route 事件在第一个 delta 之前到达前端
5. 前端 AgentBadge 显示正确 agent 名称
6. 不同 agent 使用不同的 system prompt（可通过 LLM 回复风格验证）
7. P0a 全部验收标准仍通过（无回归）

## 回滚方案

- `coach_router.py` 和 `context_builder.py` 可替换为硬编码默认值
- 在 `stream_coach_chat` 中注释掉 `route_message()` 调用，改用常量 RouteDecision
- route 事件在前端是可选的，不处理不影响渲染

## 进入 P0c 的条件

- [ ] 全部 7 项验收标准通过
- [ ] 路由测试覆盖率 ≥ 80%
- [ ] P0a 验收标准无回归

---

# P0c：最小 ToolRegistry + 1 个 readonly mock tool

## 目标

在 P0b 基础上加入工具调用闭环：LLM 可以请求调用工具 → 后端执行 → 返回 tool_result → LLM 继续生成回复。仅实现 1 个只读 mock tool，验证 tool_call/tool_result 事件流和 Coordinator 循环。

## 非目标

不做真实业务 API 接入、不做工具权限校验、不做工具调用审计、不做并行工具调用、不做 tool_call 超时处理（P0c 中 mock tool 同步返回）、不做 Memory write tool、不做多工具编排。

## 架构

```
用户消息
  → CoachCoordinator.run()
    → build_system_prompt()
    → LLM chat_completion_stream()
      → 如果 LLM 返回 tool_call：
        → 发送 tool_call 事件给前端
        → ToolRegistry.execute(tool_name, tool_args)
        → 发送 tool_result 事件给前端
        → 将 tool_result 追加到 messages
        → 继续调用 LLM（带 tool_result context）
      → 如果 LLM 返回普通 content：
        → 发送 delta 事件
    → done
```

### ToolRegistry

```python
class ToolRegistry:
    """P0c: 内存字典，1 个 mock tool"""
    _tools: dict[str, Callable]

    def register(self, name: str, description: str, parameters: dict, handler: Callable): ...
    def get_schema(self) -> list[dict]: ...  # 转为 OpenAI function calling 格式
    def execute(self, name: str, args: dict) -> dict: ...
```

### Mock Tool：`get_job_categories`

```python
TOOL_SCHEMA = {
    "name": "get_job_categories",
    "description": "获取当前可查询的岗位大类列表",
    "parameters": {
        "type": "object",
        "properties": {
            "industry": {
                "type": "string",
                "description": "行业筛选，如 互联网、金融、制造业，留空返回全部"
            }
        },
        "required": []
    }
}

def handle_get_job_categories(args: dict) -> dict:
    industry = args.get("industry", "")
    all_categories = [
        {"name": "软件开发", "industry": "互联网"},
        {"name": "数据分析", "industry": "互联网"},
        {"name": "产品经理", "industry": "互联网"},
        {"name": "投资分析", "industry": "金融"},
        {"name": "风险管理", "industry": "金融"},
        {"name": "生产管理", "industry": "制造业"},
    ]
    if industry:
        return {"categories": [c for c in all_categories if c["industry"] == industry]}
    return {"categories": all_categories}
```

## 新增文件

| # | 文件 | 职责 |
|---|------|------|
| 1 | `backend/app/services/tool_registry.py` | `ToolRegistry` 类 — 注册、schema 生成、执行 |
| 2 | `backend/app/services/tools/mock_job_categories.py` | `get_job_categories` tool 定义 + handler |
| 3 | `backend/app/services/coach_coordinator.py` | `CoachCoordinator` — tool_call 循环逻辑 |
| 4 | `backend/tests/services/test_tool_registry.py` | ToolRegistry 单元测试 |
| 5 | `backend/tests/services/test_coach_coordinator.py` | Coordinator 循环测试（mock LLM） |
| 6 | `myapp/src/pages/coach/components/ToolCallCard.tsx` | tool_call/tool_result 展示卡片 |

## 修改文件

| # | 文件 | 改动 |
|---|------|------|
| 1 | `backend/app/services/coach_stream.py` | `generate_coach_stream()` → 改为调用 `CoachCoordinator.run()` |
| 2 | `backend/app/api/coach.py` | 初始化 ToolRegistry，传入 Coordinator |
| 3 | `backend/app/schemas/agent.py` | 新增 `tool_call` / `tool_result` 事件类型 |
| 4 | `myapp/src/pages/coach/api.ts` | `CoachChatStreamEvent` 联合类型新增 `tool_call` / `tool_result` |
| 5 | `myapp/src/pages/coach/hooks/useCoachChat.ts` | 处理 tool_call / tool_result 事件，维护 `toolCalls` 状态 |
| 6 | `myapp/src/pages/coach/index.tsx` | 渲染 `ToolCallCard` |

## 数据库迁移

无。

## API 契约变更

新增 2 种事件：

```json
{"event":"tool_call","toolCallId":"call_1","toolName":"get_job_categories","toolArgs":{"industry":"互联网"}}
{"event":"tool_result","toolCallId":"call_1","toolName":"get_job_categories","result":{"categories":[{"name":"软件开发","industry":"互联网"},{"name":"数据分析","industry":"互联网"},{"name":"产品经理","industry":"互联网"}]}}
```

完整事件类型（6 种）：
```
route → tool_call → tool_result → delta → ... → done
```

其中 `tool_call` 和 `tool_result` 交替出现，可能多轮。

## 测试文件

| # | 文件 | 内容 |
|---|------|------|
| 1 | `backend/tests/services/test_tool_registry.py` | 注册/查询/执行；重复注册抛异常；执行不存在的 tool 抛异常 |
| 2 | `backend/tests/services/test_coach_coordinator.py` | mock LLM 返回 tool_call → 验证 tool_result 追加入 messages → 验证继续调用 LLM → 验证最终 done |
| 3 | `backend/tests/api/test_coach.py` | 追加：验证 tool_call → tool_result → delta 事件序列 |

## 验收标准

1. LLM 请求 `get_job_categories` 时后端正确执行并返回 tool_result
2. tool_call 和 tool_result 事件出现在 NDJSON 流中，tool_call 在前
3. 前端 `ToolCallCard` 正确展示 tool 名称和结果
4. Coordinator 在收到 tool_result 后继续调用 LLM 生成最终回复
5. mock tool 按 `industry` 参数正确筛选
6. 不存在的 tool 名称返回 error 事件而非崩溃
7. P0a + P0b 全部验收标准仍通过（无回归）

## 回滚方案

- 从 `coach_stream.py` 中移除 Coordinator 调用，恢复直接 LLM 调用
- 删除 `tool_registry.py`、`tools/`、`coach_coordinator.py`
- 前端忽略 tool_call / tool_result 事件不影响渲染（联合类型中有即可，不处理只是不展示卡片）
- ToolCallCard 渲染条件为 `if (event.event === 'tool_call')`，不满足不渲染

## 进入后续 Phase（P1）的条件

- [ ] 全部 7 项验收标准通过
- [ ] ToolRegistry 测试覆盖率 ≥ 80%
- [ ] Coordinator 循环测试覆盖率 ≥ 80%
- [ ] P0a + P0b 验收标准无回归
- [ ] 确认 tool_call/tool_result 事件在前端的展示体验可接受

---

# 附录：三阶段文件清单汇总

| 文件 | P0a | P0b | P0c | 类型 |
|------|:--:|:--:|:--:|------|
| `backend/app/api/coach.py` | 新增 | 修改 | 修改 | API |
| `backend/app/schemas/agent.py` | 新增 | 修改 | 修改 | Schema |
| `backend/app/services/llm.py` | 修改 | — | — | LLM |
| `backend/app/services/coach_stream.py` | 新增 | 修改 | 修改 | Service |
| `backend/app/services/coach_router.py` | — | 新增 | — | Service |
| `backend/app/services/context_builder.py` | — | 新增 | — | Service |
| `backend/app/services/tool_registry.py` | — | — | 新增 | Service |
| `backend/app/services/tools/mock_job_categories.py` | — | — | 新增 | Tool |
| `backend/app/services/coach_coordinator.py` | — | — | 新增 | Service |
| `backend/app/main.py` | 修改 | — | — | Config |
| `backend/tests/api/test_coach.py` | 新增 | 修改 | 修改 | Test |
| `backend/tests/services/test_coach_router.py` | — | 新增 | — | Test |
| `backend/tests/services/test_context_builder.py` | — | 新增 | — | Test |
| `backend/tests/services/test_tool_registry.py` | — | — | 新增 | Test |
| `backend/tests/services/test_coach_coordinator.py` | — | — | 新增 | Test |
| `myapp/config/routes.ts` | 修改 | — | — | Config |
| `myapp/src/pages/coach/index.tsx` | 新增 | 修改 | 修改 | Page |
| `myapp/src/pages/coach/api.ts` | 新增 | 修改 | 修改 | API |
| `myapp/src/pages/coach/hooks/useCoachChat.ts` | 新增 | 修改 | 修改 | Hook |
| `myapp/src/pages/coach/components/StreamingText.tsx` | 新增 | — | — | Component |
| `myapp/src/pages/coach/components/AgentBadge.tsx` | — | 新增 | — | Component |
| `myapp/src/pages/coach/components/ToolCallCard.tsx` | — | — | 新增 | Component |
| `myapp/src/pages/coach/__tests__/useCoachChat.test.ts` | 新增 | 修改 | 修改 | Test |

## 事件类型演进

| 事件 | P0a | P0b | P0c |
|------|:--:|:--:|:--:|
| `delta` | ✓ | ✓ | ✓ |
| `error` | ✓ | ✓ | ✓ |
| `done` | ✓ | ✓ | ✓ |
| `route` | — | ✓ | ✓ |
| `tool_call` | — | — | ✓ |
| `tool_result` | — | — | ✓ |
