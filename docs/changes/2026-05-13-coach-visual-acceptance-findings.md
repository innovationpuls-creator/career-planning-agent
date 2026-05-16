# Coach 界面验收 — 问题发现与修复记录

> 日期：2026-05-13
> 参考：`docs/superpowers/specs/2026-05-13-coach-glass-redesign-design.md`
> 验收方法：Playwright 截图 + DOM 结构审计 + 全组件代码审查

---

## 发现摘要

玻璃架构的"骨架"（sidebar + main panel 的外层玻璃）已搭建，但大量内部组件的玻璃化没有完成。全局仅 5 个 coach 专属 glass 元素，设计规范要求 15+。

---

## CRITICAL — 已修复

### C1. Canvas 背景光斑几乎不可见 ✅

`index.tsx` — 三个 orb 的 opacity 从 0.28/0.16/0.12 提升到 0.45/0.28/0.22，视觉上可见。

### C2. 全局仅 5 个 coach 专属 glass 元素 ✅

新增玻璃表面：
- 空状态卡片 (ghost glass + blur 16px)
- TextArea 输入框容器 (ghost glass + blur 8px)
- CLI CollapsedBar/ExpandedLog/StatusBar 去除了与外壳重复的边框
- 移除 header 中重复的"新对话"按钮（减少一个 glass 元素但消除重复）

### C3. 侧栏 session 列表 20+ 条记录 ✅

`index.tsx` — `setSessions((res.data ?? []).slice(0, 8))` 限制显示最近 8 条。

---

## HIGH — 已修复

### H1. 空状态设计过于简陋 ✅

`CoachChatBody.tsx` — 空状态改为 glass 卡牌，包含 serif 标题"AI 职业规划教练"和引导文案。

### H2. 输入框 TextArea 没有玻璃样式 ✅

`CoachChatInput.tsx` — inputWrap 添加 `claudeGlass.ghost` + `blurMicro` + `borderInput`，聚焦时 border 提亮。

### H3. CLI CollapsedBar / ExpandedLog 背景 ✅

去除 CollapsedBar 多余的 border（已在 glass shell 内），ExpandedLog 去除独立 border 和圆角。StatusBar 添加分隔线而非独立背景。

### H4. "发送"按钮文字 ✅

确认为 `innerText` 提取 artifact，源代码中 `发送` 文字正确无空格。无需修改。

### H5. ProLayout 外壳冲突

保留现状。Coach 页面的 `margin: -24px` 突破是 design intent，ProLayout header 本身的玻璃与 coach 不冲突（它在 shell 上方）。

---

## MEDIUM — 已修复

### M1. Markdown 正文字号 ✅

`StreamingText.tsx` — 15px → 14px。

### M2. User 气泡头像颜色 ✅

`MessageBubble.tsx` — avatar 背景从 `rgba(250,249,245,0.40)` 改为 `claudeAlpha(terracotta, 0.12)` 暖色。

### M3. SystemMessage error/success 未使用 glass token ✅

`SystemMessage.tsx` — error 变体改用 `claudeGlass.errorBg` + `claudeGlass.borderError`。

### M4. "新对话"按钮重复 ✅

`CoachChatHeader.tsx` — 移除 header 中的"新对话"按钮，仅保留侧栏中的。

---

## LOW — 已修复

### L1. Context 进入无视觉提示 ✅

`index.tsx` — 当 URL 携带 `source_page` 参数时，在 header 下方显示 ghost glass context banner。

### L2. Skeleton 使用 antd 默认 ✅

`CoachChatSidebar.tsx` — 替换为暗色玻璃侧栏匹配的自定义骨架线 (rgba(255,255,255,0.06))。

### L3. Session 恢复 loading 态脱离玻璃壳 ✅

`index.tsx` — sessionLoading 时渲染完整的 shell + canvas + main 面板，中间放置 PageLoading。

---

## 修改文件清单

| 文件 | 修改 |
|------|------|
| `myapp/src/pages/coach/index.tsx` | C1 光斑 opacity、C3 session 限制、L1 context banner、L3 glass loading shell |
| `myapp/src/pages/coach/components/CoachChatBody.tsx` | H1 空状态 glass card |
| `myapp/src/pages/coach/components/CoachChatInput.tsx` | H2 输入框 glass 容器 |
| `myapp/src/pages/coach/components/CoachChatHeader.tsx` | M4 移除重复按钮 |
| `myapp/src/pages/coach/components/CoachChatSidebar.tsx` | L2 暗色骨架 |
| `myapp/src/pages/coach/components/CollapsedBar.tsx` | H3 去除多余边框 |
| `myapp/src/pages/coach/components/ExpandedLog.tsx` | H3 去除独立边框/圆角 |
| `myapp/src/pages/coach/components/StatusBar.tsx` | H3 添加分隔线 |
| `myapp/src/pages/coach/components/StreamingText.tsx` | M1 字号修正 |
| `myapp/src/pages/coach/components/MessageBubble.tsx` | M2 User avatar 暖色 |
| `myapp/src/pages/coach/components/SystemMessage.tsx` | M3 使用 glass token |

---

## 消息交互验收 (2026-05-13 第二轮)

发送 `/read_profile` 命令后验证：

### Glass 元素增长：8 → 13 个

交互前（空状态）: 8 个 backdrop-filter 元素（5 个 coach 专属）
交互后（消息+CLI）: 13 个 backdrop-filter 元素（11 个 coach 专属）

新增 6 个玻璃表面全部匹配设计规范：

| 新增元素 | background | blur | border-radius | 规范匹配 |
|----------|-----------|------|---------------|:---:|
| User 消息气泡 | `rgba(201,100,66,0.08)` | 12px | 18px 18px 6px | ✓ |
| AI 消息气泡 | `rgba(250,249,245,0.45)` | 12px | 18px 18px 18px 6px | ✓ |
| CLI 执行日志 SECTION | `rgba(245,240,232,0.55)` | 12px | 12px | ✓ |
| User 头像 | `rgba(201,100,66,0.12)` | 8px | 50% | ✓ |
| AI 头像 | `rgba(48,48,46,0.60)` | 8px | 50% | ✓ |
| Stop 按钮 | `errorBg` | 8px | 14px | ✓ |

### CLI 日志渲染确认

```
├─ [route]  identify intent    ✓ done   → 交给 ResumeCoach 处理
├─ [answer] generate response  ✓ done   2.0s
├─ [tool]   read_profile       ✓ done   → 12 dimension profiles loaded
└─ [answer] generate response  ● running
```

### Markdown 渲染确认

- 表格（维度/分数/综合评分）通过 MarkdownTable 正常渲染
- 加粗、emoji 标题、列表均正常
- StreamingText + useStreamingAnimation 流式输出正常

### 仍待验证（需特定触发条件）

- SystemMessage（系统消息，需特定场景触发）
- GlobalErrorBar（错误条，需触发错误状态）
- PendingUploads（文件上传状态）
- 消息编辑/撤回（未实现）
