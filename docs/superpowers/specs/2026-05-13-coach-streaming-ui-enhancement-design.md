# Coach Streaming UI Enhancement Design

> 日期：2026-05-13
> 状态：设计完成，待审核
> 参考：`docs/superpowers/specs/2026-05-08-coach-agent-design.md`、`myapp/src/pages/coach/`

---

## 1. 目标

优化 AI 教练对话页面的实时生成体验，解决三个问题：

1. **原始 JSON 数据泄露** — AgentRunTimeline 的 "raw detail" 按钮直接向用户展示内部工具调用参数/结果
2. **流式输出动画单调** — 当前仅有闪烁光标，缺乏视觉反馈层次
3. **Markdown 渲染平淡** — 表格等结构化内容未做视觉优化

---

## 2. AgentRunTimeline → CLI-Style Execution Log

### 2.1 行为

- **流式传输时**：自动展开，实时显示步骤树
- **`run_done` 事件后 2s**：自动折叠为单行摘要栏
- **用户可手动**：点击展开/折叠，不影响自动行为
- **移除 raw detail**：不再暴露任何 JSON 数据。步骤摘要（summary 字段）已足够说明做了什么

### 2.2 视觉风格

融入现有暖色毛玻璃主题，不是深色终端：

```
折叠态（单行）：
┌──────────────────────────────────────────────────────────┐
│ ✓ ResumeCoach · 4 steps · 1 tool · 21s        ▸ expand  │
└──────────────────────────────────────────────────────────┘

展开态（步骤树）：
┌──────────────────────────────────────────────────────────┐
│ ├─ [route]  identify intent                    ✓ done    │
│ │  → routed to ResumeCoach                               │
│ ├─ [tool]   read_profile                       ✓ done    │
│ │  loaded 12 dimension profiles                           │
│ ├─ [answer] generate response                  ✓ done 3s │
│ └─ [answer] generate response                  ● run  5s │
├──────────────────────────────────────────────────────────┤
│ ● generating response...                           5s     │
└──────────────────────────────────────────────────────────┘
```

关键样式参数：
- 背景：`rgba(245,240,232,0.72)` + `backdrop-filter: blur(12px)`
- 边框：`1px solid rgba(200,185,160,0.35)`
- 字体：`SF Mono / Monaco / Menlo / monospace`，12px
- 状态色：成功 `#6b8e23` / 运行中 `#d4785c` / 错误 `#cb4646`
- 圆角：8px，融入 claudeRadius 体系

### 2.3 步骤标签英文化

所有步骤标题改为英文，匹配 CLI 风格：

| 当前（中文） | → 英文 |
|---|---|
| `识别任务意图` | `identify intent` |
| `生成答复` | `generate response` |
| `调用工具：xxx` | `xxx`（直接显示工具名） |
| `整理上下文` | `compact context` |
| `切换到 XxxCoach` | `switch → XxxCoach` |
| `检查写入证据` | `check evidence` |
| `更新学习记忆` | `update memory` |

**实现方式**：前端映射表（`kind` + `toolName` → label），不动后端。后端 SSE 事件保持不变。

### 2.4 组件拆分

```
AgentRunTimeline.tsx       → 重构为 CLI 风格，移除 raw detail
  ├── CollapsedBar.tsx      → 折叠态单行
  ├── ExpandedLog.tsx       → 展开态步骤树
  └── StatusBar.tsx         → 底部实时状态行
```

---

## 3. Streaming Animation — Hybrid Approach

### 3.1 策略

| 内容类型 | 动画策略 | 原因 |
|---|---|---|
| 段落文本 (`<p>`) | 逐词淡入（word-by-word fade-in） | 打字机感，视觉反馈强 |
| 表格 (`<table>`) | 骨架屏 → 内容替换 | 结构先行，避免表格逐行出现的抖动 |
| 标题 (`<h1>`-`<h4>`) | 骨架屏 → 内容替换 | 标题通常后跟大块内容，先占位 |
| 分割线 (`<hr>`) | 直接渲染，无动画 | 纯装饰 |
| 代码块 (`<pre>`) | 骨架屏 → 内容替换 | 大块代码逐字出现太慢 |
| 列表 (`<ul>/<ol>`) | 逐项淡入 | 每项作为一个整体 |

### 3.2 逐词淡入动画

```css
@keyframes wordFadeIn {
  from { opacity: 0; transform: translateY(5px); filter: blur(1.5px); }
  to   { opacity: 1; transform: translateY(0); filter: blur(0); }
}
```

- 每个词间隔：~15-25ms（可配置）
- 仅对新增的词做动画，已渲染的词不重复触发
- 使用 `will-change: transform, opacity` 且在动画结束后移除

### 3.3 块级骨架屏

```css
.skeleton-block {
  border-radius: 6px;
  background: linear-gradient(90deg, #f0ebe0 25%, #e8e0d5 50%, #f0ebe0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- 骨架屏高度：表格 140px、标题 24px、段落 50px
- 骨架屏出现 350ms 后替换为真实内容
- 如果内容在 350ms 内到达，直接渲染，跳过骨架屏

### 3.4 性能约束

- **渲染节流**：流式内容每 ~80ms 批量渲染一次，不做逐字符 re-render
- **React.memo**：表格、代码块等昂贵组件包裹 `React.memo`
- **增量渲染**：仅对 `content` 的增量部分做动画，不重渲染已完成的文本
- **无额外库**：纯 CSS 动画 + 轻量 JS 调度，不引入 `react-spring` 等

---

## 4. Markdown 渲染增强

### 4.1 表格 CSS 增强

纯 CSS，通过自定义 `react-markdown` components 实现，无额外 DOM 节点：

- 圆角边框 + `border-collapse: separate`
- 渐变表头 `linear-gradient(180deg, #f8f4ed, #f0ebe0)`
- 斑马纹行（`:nth-child(even)`）
- 最后一行的关键数值加大字号、加主题色
- 响应式：`overflow-x: auto` 带 `-webkit-overflow-scrolling: touch`

### 4.2 其他元素

- 引用块 `<blockquote>`：保持现有 terracotta 左边框风格
- 代码块 `<pre>`：保持现有深色表面风格
- 链接 `<a>`：保持现有 terracotta 色，加 `target="_blank"`

---

## 5. 影响范围

### 5.1 前端（myapp/src/pages/coach/）

| 文件 | 变更 |
|---|---|
| `components/AgentRunTimeline.tsx` | **重写**：CLI 风格，折叠/展开行为，移除 raw detail，英文化标签 |
| `components/StreamingText.tsx` | **重写**：逐词淡入 + 块级骨架屏 + 渲染节流 |
| `components/AssistantMessage.tsx` | 小改：适配新 StreamingText props |
| `components/CoachChatBody.tsx` | 不改 |
| `types.ts` | 小改：可能需要新增 streaming config 类型 |

新增文件：
| `components/CollapsedBar.tsx` | CLI 折叠态单行 |
| `components/ExpandedLog.tsx` | CLI 展开态步骤树 |
| `components/StatusBar.tsx` | 底部实时状态行 |
| `components/MarkdownTable.tsx` | 增强表格组件 |
| `hooks/useStreamingAnimation.ts` | 流式动画调度 hook |

### 5.2 后端

**不改**。SSE 事件协议不变，步骤标签英文化在前端映射。

---

## 6. 测试策略

### 6.1 组件测试

- `AgentRunTimeline`：折叠/展开状态机，步骤树渲染，无 raw detail 按钮
- `StreamingText`：逐词动画调度，骨架屏出现/替换时机
- `MarkdownTable`：各种表格形态渲染

### 6.2 E2E 测试

- 发送消息 → 验证 CLI log 自动展开
- 等待完成 → 验证 CLI log 2s 后自动折叠
- 验证无 JSON 原始数据泄露
- 验证流式内容动画流畅（无 jank）

### 6.3 性能测试

- 长文本流式输出（>5000 字）时内存和帧率
- 含多表格的 markdown 渲染时间

---

## 7. 未决事项

- 折叠延迟 2s 是否合适？可在实现中调为可配置常量
- 步骤标签英文映射表是否需要覆盖所有 22 个 P2b 工具？首版覆盖当前已有的 4 种 step kind + 常用工具即可
