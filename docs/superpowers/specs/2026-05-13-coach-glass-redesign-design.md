# Coach Glass Architecture 重设计

> 日期：2026-05-13
> 状态：设计完成，待审核
> 方向：Deep Glass → Radical Level 3 → Glass Architecture (方案 B)
> 参考：`docs/Design.md`、`docs/superpowers/specs/2026-05-13-coach-streaming-ui-enhancement-design.md`

---

## 1. 目标

将 Coach 界面从当前"扁平毛玻璃聊天"升级为**深度玻璃建筑**风格：

- 暗玻璃侧栏 + 亮玻璃主面板的双层结构
- 动态光斑背景 + 噪点纹理
- 消息气泡、Agent 执行日志、Markdown 渲染全部融入玻璃语言
- 保留现有组件结构和 SSE 流式核心，不改后端

---

## 2. 视觉系统

### 2.1 扩展色彩系统

在现有 `claude-tokens.ts` 基础上新增 6 个玻璃透明色阶：

```
现有色板（保留）：
  Parchment #f5f4ed    Ivory #faf9f5    Terracotta #c96442
  Near Black #141413    Olive Gray #5e5d59    Dark Surface #30302e

新增 — 玻璃表面色阶：
  Dark Glass:    rgba(48,48,46,0.55)
  Mid Glass:     rgba(48,48,46,0.35)
  Light Glass:   rgba(255,255,255,0.22)
  Ghost Glass:   rgba(255,255,255,0.12)
  Terracotta Glass: rgba(201,100,66,0.10)
  Glass Border:  rgba(255,255,255,0.50)
```

### 2.2 玻璃层次系统

4 层深度，从底到顶：

```
① Canvas 背景 + 动态光斑    z-index: 0
② Dark Glass 侧栏           z-index: 2  blur(24px)
③ Light Glass 主面板         z-index: 2  blur(28px) saturate(140%)
④ Ghost Glass 浮动元素       z-index: 3+ blur(20px)
```

Light Glass 主面板增加内发光：`inset 0 0 0 1px rgba(255,255,255,0.2)`

### 2.3 圆角系统

| 用途 | 值 |
|------|-----|
| 控件 (按钮、标签) | 10px |
| 卡片 (气泡、面板) | 16-18px |
| 侧栏 | 20px |
| 主面板 | 22px |

### 2.4 字体层次

- Serif 标题：Georgia / Songti SC，28px / 500
- Sans 子标题：-apple-system，17px / 600
- Sans 正文：14px / 400，line-height 1.6
- Mono CLI 日志：SF Mono / Monaco，12px

### 参考：视觉系统 Mockup

```
Canvas 背景（渐变 + 光斑 + 噪点）
├── Dark Glass 侧栏  rgba(48,48,46,0.55) blur(24px)  border-radius: 20px
│   ├── SESSIONS 标签
│   ├── 会话列表
│   └── + 新对话
│
├── Light Glass 主面板  rgba(255,255,255,0.22) blur(28px) saturate(140%)
│   ├── 顶栏 (Ghost Glass 内层)
│   ├── 消息区 flex:1
│   │   ├── AI 消息气泡 (亮玻璃)
│   │   ├── 用户消息气泡 (陶土玻璃)
│   │   └── 系统消息 (幽灵玻璃)
│   ├── GlobalErrorBar (悬浮)
│   ├── PendingUploads
│   └── 输入栏 (Glass)
│
└── 背景光斑 (2-3 个 radial-gradient, CSS 动画漂浮)
```

---

## 3. 布局架构

### 3.1 全局布局

- 页面容器：`100vw × 100vh`，`margin: -24px` 突破 ProLayout
- Canvas 背景：固定定位 `position: fixed; inset: 0; z-index: 0`
- 光斑：2-3 个大 `radial-gradient`，`blur(50px)`，CSS 动画漂浮 20-30s
- 噪点纹理：SVG `feTurbulence`，`opacity: 0.022`

### 3.2 侧栏 (Dark Glass)

| 属性 | 值 |
|------|-----|
| 宽度 | 260px 固定 |
| 位置 | left: 12px, top: 10px, bottom: 10px |
| 表面 | `rgba(48,48,46,0.55)` + `blur(24px)` |
| 边框 | `1px solid rgba(255,255,255,0.18)` |
| 圆角 | 20px |

### 3.3 主面板 (Light Glass)

| 属性 | 值 |
|------|-----|
| 位置 | 侧栏右侧 12px gap，右 12px |
| 表面 | `rgba(255,255,255,0.22)` + `blur(28px) saturate(140%)` |
| 边框 | `1px solid rgba(255,255,255,0.45)` |
| 内发光 | `inset 0 0 0 1px rgba(255,255,255,0.2)` |
| 圆角 | 22px |

### 3.4 组件区域 (z-index 层级)

| 组件 | z-index | 位置 |
|------|---------|------|
| Canvas 背景 + 光斑 | 0 | fixed, inset: 0 |
| Dark Glass 侧栏 | 2 | 左侧 |
| Light Glass 主面板 | 2 | 右侧 |
| GlobalErrorBar | 5 | 主面板顶部悬浮 |
| CoachChatHeader | auto | 主面板顶栏内 |
| CoachChatBody | auto | flex: 1, overflow-y: auto |
| PendingUploads | auto | Body 底部 |
| CoachChatInput | auto | 主面板底部 |
| 技能浮层 | 10 | 输入框上方 |
| 会话 Overlay (如有) | 15 | 浮动 |

---

## 4. 组件设计

### 4.1 消息气泡

三种气泡融入玻璃语言：

**AI 气泡（亮玻璃）**：
```css
background: rgba(250,249,245,0.45);
backdrop-filter: blur(14px);
border: 1px solid rgba(255,255,255,0.45);
border-radius: 18px 18px 18px 6px;
box-shadow: 0 2px 8px rgba(0,0,0,0.03);
```

**用户气泡（陶土玻璃）**：
```css
background: rgba(201,100,66,0.08);
backdrop-filter: blur(14px);
border: 1px solid rgba(201,100,66,0.2);
border-radius: 18px 18px 6px 18px;
```

**系统消息（幽灵玻璃）**：
```css
background: rgba(255,255,255,0.12);
backdrop-filter: blur(8px);
border: 1px solid rgba(255,255,255,0.25);
border-radius: 10px;
text-align: center;
```

### 4.2 Agent 执行日志 (CLI)

融入暖色玻璃的 CLI 风格，折叠态 + 展开态：

**折叠态**：
```
┌──────────────────────────────────────────────────────────┐
│ ✓ ResumeCoach · 4 steps · 1 tool · 2.1s        ▸ expand │
└──────────────────────────────────────────────────────────┘
```

**展开态**：
```
┌──────────────────────────────────────────────────────────┐
│ ├─ [route]  identify intent                    ✓ done    │
│ │  → routed to ResumeCoach                               │
│ ├─ [tool]   read_profile                       ✓ done    │
│ │  loaded 12 dimension profiles                           │
│ ├─ [answer] generate response                  ✓ 1.8s    │
│ └─ [answer] generate response                  ● running │
├──────────────────────────────────────────────────────────┤
│ ● generating response...                                  │
└──────────────────────────────────────────────────────────┘
```

关键样式：
- 背景：`rgba(245,240,232,0.55)` + `blur(12px)`
- 边框：`1px solid rgba(200,185,160,0.3)`
- 字体：`SF Mono / Monaco / Menlo`，11-12px
- 状态色：成功 `#6b8e23` / 运行中 `#d4785c` / 错误 `#cb4646`
- 英文标签（前端映射表，不动后端）
- 无 raw detail 按钮

### 4.3 Markdown 渲染

**表格**：
- `border-collapse: separate` + 圆角边框
- 渐变表头：`linear-gradient(180deg, rgba(248,244,237,0.7), rgba(240,235,224,0.7))`
- 斑马纹：`:nth-child(even)` 底色
- 末行关键数值：加粗 + `color: #c96442`

**代码块**：
```css
background: rgba(48,48,46,0.7);
backdrop-filter: blur(10px);
border: 1px solid rgba(255,255,255,0.12);
border-radius: 10px;
```

**引用块**：
```css
border-left: 3px solid #c96442;
background: rgba(201,100,66,0.06);
border-radius: 0 8px 8px 0;
```

### 4.4 输入控件

- 输入栏：`rgba(255,255,255,0.2)` + `blur(20px)`，18px 圆角
- 发送按钮：Terracotta 实色 + `box-shadow: 0 3px 14px rgba(201,100,66,0.35)` 发光
- 停止按钮：`rgba(181,51,51,0.15)` 玻璃 + `blur(10px)`
- 上传按钮：圆形 Ghost Glass 按钮
- 技能面板：`rgba(250,249,245,0.8)` + `blur(24px)` 浮层

### 4.5 Glass 顶栏

```css
background: rgba(255,255,255,0.12);
backdrop-filter: blur(16px);
border-bottom: 1px solid rgba(255,255,255,0.25);
```

Agent 标识：陶土玻璃标签，发光圆点指示器

---

## 5. 动效设计

| 动效 | 实现 |
|------|------|
| 消息入场 | 保留 framer-motion fadeInUp (AI) / fadeInRight (用户) |
| 流式文字 | 逐词淡入 (blur 1.5px→0, y 5px→0). 块级骨架屏 shimmer. 渲染节流 80ms |
| 光斑动画 | CSS keyframes 变形漂浮，20-30s 周期，ease-in-out |
| CLI 折叠 | AnimatePresence + height auto. 流式自动展开，done 后 2s 自动折叠 |
| 技能面板 | scaleIn + fade，玻璃浮层 |
| 按钮切换 | AnimatePresence mode="wait" scaleIn |

---

## 6. 实现范围

### 6.1 修改文件

| 文件 | 变更 |
|------|------|
| `myapp/src/styles/claude-tokens.ts` | 新增玻璃色阶常量 |
| `myapp/src/pages/coach/index.tsx` | 重写背景、布局、玻璃面板 |
| `myapp/src/pages/coach/components/CoachChatSidebar.tsx` | 重写：Dark Glass 风格 |
| `myapp/src/pages/coach/components/CoachChatHeader.tsx` | 重写：Ghost Glass 顶栏 |
| `myapp/src/pages/coach/components/CoachChatBody.tsx` | 微调：透明背景 |
| `myapp/src/pages/coach/components/MessageBubble.tsx` | 重写：陶土玻璃气泡 |
| `myapp/src/pages/coach/components/AssistantMessage.tsx` | 重写：亮玻璃气泡 |
| `myapp/src/pages/coach/components/SystemMessage.tsx` | 重写：幽灵玻璃 |
| `myapp/src/pages/coach/components/CoachChatInput.tsx` | 重写：全玻璃输入 + 技能浮层 |
| `myapp/src/pages/coach/components/StreamingText.tsx` | 保留现有逻辑，样式微调 |
| `myapp/src/pages/coach/components/MarkdownTable.tsx` | 增强表格玻璃风格 |
| `myapp/src/pages/coach/components/AgentRunTimeline.tsx` | 保留 CLI 风格，微调配色 |
| `myapp/src/pages/coach/components/CollapsedBar.tsx` | 微调：玻璃底色 |
| `myapp/src/pages/coach/components/ExpandedLog.tsx` | 微调：玻璃底色 |
| `myapp/src/pages/coach/components/StatusBar.tsx` | 微调：玻璃底色 |
| `myapp/src/pages/coach/components/GlobalErrorBar.tsx` | 重写：玻璃浮层 |
| `myapp/src/pages/coach/components/PendingUploads.tsx` | 微调：玻璃风格 |
| `myapp/src/pages/coach/motion.ts` | 保留现有动画定义 |

### 6.2 不改文件

- `myapp/src/pages/coach/hooks/` — 逻辑不变
- `myapp/src/pages/coach/api.ts` — API 不变
- `myapp/src/pages/coach/types.ts` — 类型不变
- `myapp/src/pages/coach/eventReducer.ts` — 不变
- 所有后端文件

---

## 7. 测试策略

### 7.1 组件测试
- 各组件渲染快照更新
- Glass 样式正确应用
- CLI 折叠/展开状态机

### 7.2 E2E 测试
- 发送消息 → 验证 UI 正常渲染
- 流式输出 → 验证动画不阻塞
- 会话切换 → 验证侧栏交互
- 暗/亮玻璃面板在不同视口下表现

### 7.3 视觉验证
- Playwright 截图对比
- 光斑动画不导致 layout shift
- 玻璃模糊在 Chrome/Safari 下一致

---

## 8. 设计参考截图

以下为确认过的视觉方向 mockup（来自 brainstorming 过程）：

- **视觉方向选择**：`.superpowers/brainstorm/28739-1778657275/content/03-visual-compare.html` — 方案 B (Deep Glass)
- **大胆级别**：`.superpowers/brainstorm/28739-1778657275/content/05-boldness-levels.html` — Level 3 (Radical Glass)
- **实现方案**：`.superpowers/brainstorm/28739-1778657275/content/06-approaches.html` — 方案 B (Glass Architecture)
- **视觉系统**：`.superpowers/brainstorm/28739-1778657275/content/07-visual-system.html`
- **布局架构**：`.superpowers/brainstorm/28739-1778657275/content/08-layout.html`
- **组件设计**：`.superpowers/brainstorm/28739-1778657275/content/09-components.html`
