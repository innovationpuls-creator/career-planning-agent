# Phase 2: Shared UI Component Library

> 日期: 2026-05-01
> 计划来源: `docs/superpowers/specs/2026-05-01-frontend-redesign-plan.md`
> 前置依赖: Phase 1 (Design System Foundation)

---

## 概述

建立 Claude 风格的基础 UI 组件库，供后续所有 Phase (3-9) 页面使用。所有组件使用 `antd-style` 的 `createStyles` 做样式，引用 Phase 1 建立的 Claude token 常量。

---

## 新增组件

### 1. ClaudeButton (`src/components/ui/ClaudeButton/index.tsx`)

4 个 variant 的按钮组件：
- `warm-sand`（默认）— Warm Sand 背景 + Near Black 文字
- `terracotta` — Terracotta 背景 + 白色文字
- `dark-charcoal` — Charcoal Warm 背景 + 白色文字
- `ghost` — 透明背景 + Olive Gray 文字，hover 时 primaryBg + terracotta

特性：
- Ring shadow on hover
- scale(0.98) on active
- 不对称 padding（8px × 12px）
- 继承 antd ButtonProps（omit `type` 和 `variant` 避免冲突）

测试：9 个用例

### 2. ClaudeCard (`src/components/ui/ClaudeCard/index.tsx`)

3 个 elevation 的卡片组件：
- `flat`（默认）— 无阴影
- `elevated` — whisper shadow
- `ring` — ring shadow

特性：
- Ivory 背景 + Border Cream 边框
- 可选 serif 字体标题
- 圆角 8px (Claude MD)

测试：7 个用例

### 3. ClaudeTag (`src/components/ui/ClaudeTag/index.tsx`)

Pill 形状标签组件：
- Border-radius 32px (Claude XXL)
- primaryBg 背景 + terracotta 文字
- 可选关闭按钮（closable + onClose）

测试：6 个用例

### 4. ClaudeInput (`src/components/ui/ClaudeInput/index.tsx`)

包装 antd Input 的输入组件，3 个导出：
- `ClaudeInput` — 标准输入框
- `ClaudeTextArea` — 多行文本
- `ClaudePassword` — 密码输入

样式覆盖：
- 圆角 12px (Claude LG)
- Border Cream 边框 + Ivory 背景
- Focus 时 terracotta 边框 + ring shadow
- Stone Gray placeholder

测试：6 个用例

### 5. ClaudeSelect (`src/components/ui/ClaudeSelect/index.tsx`)

包装 antd Select 的选择器，样式匹配 ClaudeInput 风格。

测试：3 个用例

### 6. ClaudeStatCard (`src/components/ui/ClaudeStatCard/index.tsx`)

Claude 风格的统计卡片（替代原 StatCard）：
- 数值使用 serif 字体（28px, weight 500）
- 趋势标签使用 warm-sand pill badge（primaryBg 背景 + terracotta 圆角标签）
- Ivory 背景 + Border Cream 边框

原 StatCard 通过 barrel 文件中的别名保持向后兼容：
```ts
export { ClaudeStatCard as StatCard } from './ClaudeStatCard';
```

测试：7 个用例

### 7. FadeInWhenVisible (`src/components/ui/FadeInWhenVisible/index.tsx`)

基于 framer-motion 的滚动触发动画组件：
- Props：`direction` (up/down/left/right)、`delay`、`duration`、`stagger`、`className`
- 使用 `motion.div` + `whileInView` + `viewport: { once: true }`
- 检测 `prefers-reduced-motion`，如用户偏好则直接显示（无动画）
- 使用 Phase 1 的 `motionTokens` easing 和 duration 常量

测试：5 个用例

### 8. CountUpNumber (`src/components/ui/CountUpNumber/index.tsx`)

数字滚动动画组件：
- 使用 `requestAnimationFrame` 实现数字从 0 到 target 的平滑过渡
- Props：`target`、`duration`（默认 1.5s）、`prefix`、`suffix`
- 数值使用 serif 字体（48px, weight 500）
- 大数字自动千分位格式化（`toLocaleString`）

测试：6 个用例

### 9. ProgressRing (`src/components/ui/ProgressRing/index.tsx`)

SVG 圆形进度条：
- Props：`percent`、`size`（默认 120）、`strokeWidth`（默认 8）、`color`（默认 terracotta）
- Track 圆使用 Border Cream，Progress 圆使用 terracotta
- stroke-dashoffset 动画（0.6s ease-out-expo）
- 自动 clamp percent 到 0-100
- 中心显示百分比文字

测试：7 个用例

---

## 修改文件

### `src/components/ui/index.ts`

新增 8 个组件的导出（ClaudeButton、ClaudeCard、ClaudeTag、ClaudeInput/TextArea/Password、ClaudeSelect、ClaudeStatCard、FadeInWhenVisible、CountUpNumber、ProgressRing）。

保留原 StatCard 的向后兼容别名。

### 2026-05-07 跨 Phase 动画补齐

- `FadeInWhenVisible` 补齐 `staggerIndex`、`staggerInterval`，使既有 `stagger` prop 真正参与 delay 计算。
- `prefers-reduced-motion: reduce` 时保留 opacity 过渡，禁用位移类初始/结束状态。
- 新增 `PageRouteTransition`，在业务内容区和 `layout: false` 页面提供路由 enter/exit 过渡。
- Home-v2 PipelineSteps、学习路径 ModuleList/ResourceCards、同岗对比 TierComparison 改为使用统一 stagger reveal。

---

## 测试文件

每个组件对应一个 `index.test.tsx`，共 9 个测试文件、56 个测试用例：

| 文件 | 用例数 |
|------|--------|
| ClaudeButton/index.test.tsx | 9 |
| ClaudeCard/index.test.tsx | 7 |
| ClaudeTag/index.test.tsx | 6 |
| ClaudeInput/index.test.tsx | 6 |
| ClaudeSelect/index.test.tsx | 3 |
| ClaudeStatCard/index.test.tsx | 7 |
| FadeInWhenVisible/index.test.tsx | 5 |
| CountUpNumber/index.test.tsx | 6 |
| ProgressRing/index.test.tsx | 7 |

---

## 验证结果

| 检查项 | 结果 |
|--------|------|
| `npm test` (全部) | 30/30 套件通过，220/220 用例通过 |
| `npm run tsc` | 无错误 |
| `npm run build` | 通过（15 个页面全部编译成功） |

---

## 后续依赖

Phase 2 完成后，以下 Phase 可按序执行：

- **Phase 3** (Auth) — 使用 ClaudeButton、ClaudeInput、FadeInWhenVisible
- **Phase 4** (Home) — 使用 ClaudeCard、ClaudeStatCard、CountUpNumber、ProgressRing、FadeInWhenVisible
- **Phase 5** (简历) — 使用 ClaudeTag、ClaudeSelect、FadeInWhenVisible
- **Phase 6** (学习路径) — 使用 ClaudeCard、ClaudeTag、ProgressRing、FadeInWhenVisible
- **Phase 7** (报告) — 使用 ClaudeCard、ClaudeButton
- **Phase 8** (图谱+对比) — 使用 ClaudeCard、ClaudeSelect、ClaudeStatCard、FadeInWhenVisible
- **Phase 9** (Admin) — 仅依赖 Phase 1 token（不使用 Phase 2 组件）
