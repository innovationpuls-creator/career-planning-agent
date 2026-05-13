# Phase 1: Design System Foundation

> 日期: 2026-05-01
> 计划来源: `docs/superpowers/specs/2026-05-01-frontend-redesign-plan.md`

---

## 概述

将前端设计系统从蓝色冷色调（`#1655CC`）全面切换为 Claude 暖色调体系（Terracotta `#c96442` / Parchment `#f5f4ed` / Ivory `#faf9f5`），建立后续所有 Phase 的视觉基础。

---

## 新增文件

### `myapp/src/styles/motion.ts`

运动系统 token，供所有动画组件使用。

- `motionTokens.easing` — 三条 ease-out-expo 曲线（default / enter / exit）
- `motionTokens.duration` — 四级时长：fast(0.15s) / normal(0.3s) / slow(0.6s) / reveal(0.8s)
- `motionTokens.stagger` — 三级交错：fast(0.05s) / normal(0.1s) / slow(0.2s)
- `prefersReducedMotion()` — 检测用户 `prefers-reduced-motion: reduce` 偏好，SSR 安全

### `myapp/src/styles/claude-tokens.ts`

Claude 设计系统常量中心，所有颜色/阴影/圆角/字体栈的单一来源。

- `claudeColors` — 完整色板（Parchment、Ivory、Terracotta、Near Black、Olive Gray、Stone Gray、Border Cream、Warm Sand、Charcoal Warm、Dark Surface、Warm Silver 等）
- `claudeShadows` — 五级阴影：flat / contained / ring / whisper / inset
- `claudeRadius` — 五级圆角：SM(4) / MD(8) / LG(12) / XL(16) / XXL(32)
- `claudeFonts` — 标题衬线栈（STSongti SC → Georgia → serif）+ 正文无衬线栈
- `ringSubtle: '#dedc01'` — 经核实设计规范 §4.1 确认为有意设定的高亮色，已添加行内注释说明

### `myapp/src/styles/motion.test.ts`

8 个测试用例，验证 motion token 形状、排序、`prefersReducedMotion()` 三种场景。

### `myapp/src/styles/claude-tokens.test.ts`

11 个测试用例，验证颜色值、阴影定义、圆角排序、字体栈内容、组合导出结构。

---

## 修改文件

### `myapp/config/defaultSettings.ts`

**变更**: 全部颜色 token 从蓝色系切换为 Claude 暖色系，引用 `claudeColors` / `claudeRadius` 常量。

| Token | 旧值 | 新值 |
|-------|------|------|
| `colorPrimary` | `#1655CC` | `#c96442` (Terracotta) |
| `colorPrimaryHover` | `#2966D4` | `#d97757` (Coral) |
| `colorPrimaryActive` | `#0F4299` | `#b05535` |
| `colorPrimaryBg` | `#EEF3FB` | `#faf0eb` |
| `colorText` | `#1C1C1E` | `#141413` (Near Black) |
| `colorTextSecondary` | `#5C5C5E` | `#5e5d59` (Olive Gray) |
| `colorTextTertiary` | `#98989D` | `#87867f` (Stone Gray) |
| `colorBorder` | `#E3E3E5` | `#f0eee6` (Border Cream) |
| `colorBgLayout` | `#F5F6F8` | `#f5f4ed` (Parchment) |
| `colorBgContainer` | `#FFFFFF` | `#faf9f5` (Ivory) |
| `colorSuccess` | `#1F8E3D` | `#4a7c3f` |
| `colorError` | `#C53B37` | `#b53333` |
| `colorInfo` | `#1655CC` | `#c96442` |
| 菜单选中色 | `#1655CC` | `#c96442` |
| Auth 渐变 | 蓝色系 `#0F2060→#0F4299` | Parchment 暖色 `#f5f4ed→#e8e6dc` |
| 圆角 `borderRadius` | `6` | `8` (Claude MD) |
| 阴影 `boxShadow` | `0 2px 8px rgba(0,0,0,0.08)` | `rgba(0,0,0,0.05) 0px 4px 24px` |

### `myapp/src/global.less`

**变更**: 从 988 行精简为 793 行，策略：

1. **CSS 变量全面更新** — `:root` 中所有 `--color-*`、`--shadow-*`、`--chart-*` 变量替换为 Claude 暖色值
2. **Auth 分屏布局** — 左半屏渐变从蓝色改为 Parchment 暖色渐变，装饰元素改用 Terracotta
3. **Autofill 覆盖** — 背景色从 `#ffffff` 改为 `var(--color-bg-container)` (Ivory)
4. **图表色板** — 从蓝色系改为 Terracotta / Warm Sand / Olive / Stone 暖色组
5. **导航/表格/筛选区** — 移除硬编码蓝色值，统一通过 CSS 变量引用
6. **保留** — 结构性覆盖（导航栏高度、表格行高、搜索区域布局）、字体强制 serif 覆盖、响应式规则

### `myapp/src/app.tsx`

**变更**（Code Review 收尾，对应计划 §1.6）：

- 新增 `ConfigProvider` import（from `antd`）和 `claudeColors`/`claudeRadius`/`claudeFonts` import（from `./styles/claude-tokens`）
- 在 `layout.childrenRender` 中用 `<ConfigProvider theme={{ token: {...} }}>` 包裹 `children` + `SettingDrawer`
- 注入的 token 覆盖：`colorPrimary`、`colorPrimaryHover`、`colorPrimaryActive`、`colorPrimaryBg`、`colorText`、`colorTextSecondary`、`colorTextTertiary`、`colorBorder`、`colorBgLayout`、`colorBgContainer`、`colorSuccess`、`colorError`、`borderRadius`、`fontFamily`
- 效果：Modal、Tooltip、Popover、message 等 ProLayout 范围外的 antd 浮层组件现在也使用 Claude 暖色调

**后续修复**（Code Review 收尾）：

- 新增 `--color-bg-overlay`（parchment 80% 透明度）和 `--color-charcoal-warm`（`#4d4c48`）两个 CSS 变量
- Auth 区域（`.auth-root`、`.auth-left-*`、`.auth-right`）中约 10 处硬编码 hex 值替换为 `var(...)` 引用
- Autofill 覆盖中的 `#faf9f5` 和 `#141413` 替换为 CSS 变量
- 保留 3 处不可变量化值：渐变（`linear-gradient`）、两个 rgba 透明度变体

---

## 依赖变更

```bash
npm install framer-motion   # 新增，用于 Phase 2+ 的页面过渡、scroll reveal、微交互
```

---

## 验证结果

| 检查项 | 结果 |
|--------|------|
| `npm run build` | 通过（20 个页面全部编译成功） |
| 测试 (`npm test src/styles/`) | 19/19 通过 |
| `npm run tsc` | 仅有预先存在的 Umi 类型定义警告，无新增错误 |
| Code Review 收尾修复 | 全部完成（ringSubtle 注释、ConfigProvider 注入、global.less 变量化） |

---

## 受影响页面

`defaultSettings.ts` 的 token 变更通过 ProLayout 的 `token` 机制自动级联到所有页面：

- 登录/注册页 → 暖色渐变左半屏 + Ivory 右半屏
- 首页 (home-v2) → Parchment/Ivory 底色
- 简历解析页 → 暖色调底色
- 蜗牛学习路径 → 暖色调底色
- 个人成长报告 → 暖色调底色
- 岗位图谱/对比 → 暖色调底色
- Admin 页面 → 表格/表单/菜单自动获得暖色调

`app.tsx` 的 `ConfigProvider` 确保 ProLayout 范围外的 antd 组件也使用暖色调：

- Modal / Drawer → 暖色背景 + 标题文字
- Tooltip / Popover → 暖色气泡
- message / notification → 暖色提示

---

## 后续依赖

Phase 1 完成后，以下 Phase 可按序执行：

- **Phase 2** (Shared UI Components) — 依赖本 Phase 的 token
- **Phase 3–9** — 均依赖 Phase 1 的 token + Phase 2 的组件
