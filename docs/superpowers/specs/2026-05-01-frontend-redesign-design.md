# 前端全面重设计方案

> 日期：2026-05-01
> 状态：待审核
> 参考：`docs/Design.md`（Claude 设计语言）、`docs/UI功能详细整理.md`、`docs/UI功能后端接口对照.md`

---

## 1. 目标

将现有 Ant Design Pro 前端全面改造为 Claude 设计语言风格，用于比赛展示。要求：

- 视觉上尽量看不出是 Ant Design
- 暖色调 parchment/terracotta 体系替换现有蓝色体系
- 大胆的入场动画和滚动触发显现，给评委视觉冲击力
- 同步重构单体大文件（>1000 行）为职责清晰的子组件（<500 行）
- 提取可复用 hooks，提升代码可维护性

---

## 2. 范围

### 8 个页面

| 序号 | 路由 | 页面 | 当前行数 |
|------|------|------|---------|
| 1 | `/user/login` | 登录 | 427 |
| 2 | `/user/register` | 注册 | 401 |
| 3 | `/home-v2` | 职业规划首页 | 1,791 |
| 4 | `/student-competency-profile` | 简历解构 | 867 + 5,219 子组件 |
| 5 | `/snail-learning-path` | 蜗牛学习路径 | 2,904 |
| 6 | `/personal-growth-report` | 个人职业成长报告 | 651 + 1,350 子组件 + 642 hooks |
| 7 | `/job-competency-graph` | 岗位能力图谱 | stub |
| 8 | `/same-job-cross-industry` | 同岗行业对比 | 202 |

### 不在范围内

- 管理员页面（`/admin/*`）：仅做 token 颜色同步，不重设计布局
- 后端 API：不改动

---

## 3. 实施策略

自底向上分层（方案 A）：

```
Phase 1: Design System Foundation
    ↓
Phase 2: Shared UI Component Library
    ↓
Phase 3: Auth Pages (login + register)
    ↓
Phase 4: Home-v2
    ↓
Phase 5: Student Competency Profile
    ↓
Phase 6: Snail Learning Path
    ↓
Phase 7: Personal Growth Report
    ↓
Phase 8: Job Competency Graph + Cross-Industry Comparison
    ↓
Phase 9: Admin Pages Token Sync
```

每一层为下一层提供基础，效率递增。

---

## 4. Phase 1 — Design System Foundation

### 4.1 颜色 Token 替换

替换 `config/defaultSettings.ts` 中所有 token：

| 角色 | 当前值 | Claude 新值 |
|------|--------|------------|
| 页面背景 | `#F5F6F8` | `#f5f4ed`（Parchment） |
| 卡片表面 | `#fff` | `#faf9f5`（Ivory） |
| Primary | `#1655CC` | `#c96442`（Terracotta） |
| Primary Hover | `#2966D4` | `#d97757`（Coral） |
| Primary Active | `#0F4299` | `#b05535` |
| Primary Bg | `#EEF3FB` | `#faf0eb` |
| 文本主色 | `#1C1C1E` | `#141413`（Near Black） |
| 文本次色 | `#5C5C5E` | `#5e5d59`（Olive Gray） |
| 文本三色 | `#98989D` | `#87867f`（Stone Gray） |
| 边框 | `#E3E3E5` | `#f0eee6`（Border Cream） |
| 布局背景 | `#F5F6F8` | `#f5f4ed`（Parchment） |
| 成功 | `#1F8E3D` | `#4a7c3f` |
| 警告 | `#B07800` | `#B07800`（保持） |
| 错误 | `#C53B37` | `#b53333` |

额外定义：

```ts
// 在 defaultSettings.ts 或 src/styles/tokens.ts 中
const claudeTokens = {
  // Dark surfaces
  darkSurface: '#30302e',
  deepDark: '#141413',
  // Text on dark
  warmSilver: '#b0aea5',
  // Borders
  borderWarm: '#e8e6dc',
  borderDark: '#30302e',
  // Rings
  ringWarm: '#d1cfc5',
  ringSubtle: '#dedc01',
  ringDeep: '#c2c0b6',
  // Warm sand (secondary button bg)
  warmSand: '#e8e6dc',
  charcoalWarm: '#4d4c48',
}
```

### 4.2 排版系统

| 层级 | 中文 | 英文 | 字重 | 行高 | 用途 |
|------|------|------|------|------|------|
| Display | STSongti SC | Georgia | 500 | 1.10 | Hero 标题（64px） |
| H1 | STSongti SC | Georgia | 500 | 1.20 | 章节标题（36px） |
| H2 | STSongti SC | Georgia | 500 | 1.30 | 卡片标题（24px） |
| H3 | STSongti SC | Georgia | 500 | 1.30 | 子标题（20px） |
| Body | 系统无衬线 | 系统无衬线 | 400 | 1.60 | 正文（16px） |
| Body-sm | 系统无衬线 | 系统无衬线 | 400 | 1.43 | 辅助文字（14px） |
| Caption | 系统无衬线 | 系统无衬线 | 400 | 1.43 | 标签/元数据（12px） |
| UI | 系统无衬线 | 系统无衬线 | 400-500 | 1.25 | 按钮/控件（14-16px） |

字体栈：

```css
--font-heading: "STSongti SC", "SimSun", "Songti SC", "Noto Serif SC", Georgia, serif;
--font-body: -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", Roboto, sans-serif;
```

### 4.3 阴影系统

| 级别 | 名称 | 值 | 用途 |
|------|------|-----|------|
| 0 | Flat | `none` | 背景层 |
| 1 | Contained | `1px solid #f0eee6` | 标准卡片边框 |
| 2 | Ring | `0px 0px 0px 1px #d1cfc5` | 交互态（hover/focus） |
| 3 | Whisper | `rgba(0,0,0,0.05) 0px 4px 24px` | 浮起卡片 |
| 4 | Inset | `inset 0px 0px 0px 1px rgba(0,0,0,0.15)` | 按下态 |

核心原则：用 ring shadow 替代 box-shadow，营造"假装是边框的阴影"。

### 4.4 圆角系统

| 级别 | 值 | 用途 |
|------|-----|------|
| SM | 4px | 内联元素 |
| MD | 8px | 按钮、标准卡片 |
| LG | 12px | 主按钮、输入框 |
| XL | 16px | 特色容器 |
| XXL | 32px | Hero 容器 |

### 4.5 全局样式重写

`src/global.less` 从 ~989 行重写为 ~400 行：

- 所有灰色值替换为暖色调（无冷蓝灰）
- 按钮覆盖：Warm Sand secondary、Terracotta primary、Dark Charcoal inverted
- ProLayout/ProTable/Menu 覆盖使用 Claude token
- 移除冗余 `!important`，优先用 Ant Design ConfigProvider token 注入
- 保留 `.auth-root` 分屏布局，更新配色

### 4.6 动画 Token

新建 `src/styles/motion.ts`：

```ts
export const motionTokens = {
  easing: {
    default: [0.16, 1, 0.3, 1],
    enter:   [0.16, 1, 0.3, 1],
    exit:    [0.7, 0, 0.3, 1],
  },
  duration: {
    fast:   0.15,
    normal: 0.3,
    slow:   0.6,
    reveal: 0.8,
  },
  stagger: {
    fast:   0.05,
    normal: 0.1,
    slow:   0.2,
  },
}
```

---

## 5. Phase 2 — Shared UI Component Library

新建/升级 `src/components/ui/`：

### ClaudeButton

替代原生 Ant Design Button。

| 变体 | 背景 | 文字 | 用途 |
|------|------|------|------|
| `warm-sand` | `#e8e6dc` | `#4d4c48` | 次要操作 |
| `terracotta` | `#c96442` | `#faf9f5` | 主 CTA |
| `dark-charcoal` | `#30302e` | `#faf9f5` | 反色强调 |
| `ghost` | transparent | `#5e5d59` | 低调操作 |

共通样式：ring shadow、不对称 padding（icon 侧 8px，文字侧 12px）、圆角 8px（主按钮 12px）、hover 时 ring 加深。

### ClaudeCard

替代原生 Ant Design Card。

| 高度 | 样式 | 用途 |
|------|------|------|
| `flat` | 无阴影，Border Cream 边框 | 信息展示 |
| `elevated` | whisper shadow | 浮起卡片 |
| `ring` | ring shadow | 交互卡片 |

共通样式：Ivory `#faf9f5` 表面、圆角 8px（特色 16px）、标题用 serif 字体。

### ClaudeInput / ClaudeSelect

替代原生 Input/Select。圆角 12px、紧凑 padding、Focus Blue `#3898ec` focus ring、Stone Gray placeholder。

### ClaudeStatCard（升级现有 StatCard）

数字用 serif（48px Georgia/STSongti SC, weight 500）、标签 Olive Gray、趋势用 warm-sand pill badge。

### ClaudeTag

Pill 形状（圆角 24px）、`#faf0eb` 背景 + `#c96442` 文字、无边框、微弱 ring shadow。

### ClaudeRadarChart / ClaudeBarChart

封装 `@ant-design/charts`，配色改为 Claude 暖色系（terracotta/warm-sand/olive/stone），坐标轴 Olive Gray，网格线 Border Cream，Tooltip Ivory 表面。

### FadeInWhenVisible

通用 scroll-triggered reveal 包装组件，基于 framer-motion `useInView`。

---

## 6. Phase 3 — Auth 页面

### 6.1 登录 `/user/login`

布局：左右分屏（现有 `.auth-root` 改造）。

**左半屏（品牌区）**：
- Parchment 背景
- Serif 标题 "大学生职业规划智能体"（48px STSongti SC, weight 500, 行高 1.10）
- Olive Gray 副标题（20px, 行高 1.60）
- 手绘风装饰插画（terracotta + 黑色线条，Claude 风格）
- Hero 入场动画：标题 fade+slide up → 副标题跟入（延迟 200ms）

**右半屏（表单区）**：
- Ivory 背景
- ClaudeInput 用户名/密码（圆角 12px）
- "记住登录" warm-toned checkbox
- Terracotta 全宽 "登录" 按钮
- "忘记密码" + "去注册" Olive Gray 文字链接（hover 变 terracotta）

### 6.2 注册 `/user/register`

同登录分屏布局，左半屏品牌区一致。

三步向导改造：
- 步骤指示器：serif 数字 ①②③，当前步 terracotta，已完成 warm-sand
- 步骤间切换：framer-motion slide 过渡（左/右滑动）
- Step 1（账号）：ClaudeInput + 密码强度条（terracotta 渐变）
- Step 2（基础信息）：ClaudeInput + ClaudeSelect
- Step 3（简历图片）：拖拽上传区（Ivory 背景 + dashed terracotta 边框，hover ring shadow）

---

## 7. Phase 4 — Home-v2 首页

### 7.1 文件拆分

```
home-v2/
├── index.tsx              (~150 行，布局编排 + 数据获取)
├── components/
│   ├── HeroSection.tsx    (~200 行)
│   ├── PipelineSteps.tsx  (~200 行)
│   ├── GrowthRoadmap.tsx  (~200 行)
│   ├── QuickStats.tsx     (~150 行)
│   ├── ProfileCard.tsx    (~200 行)
│   └── CtaSection.tsx     (~100 行)
├── hooks/
│   └── useHomeData.ts     (~100 行)
```

### 7.2 视觉设计

**HeroSection**：
- Parchment 背景渐变到 Ivory
- 左侧：serif "你的职业规划"（40px）+ 目标岗位 pill tag（terracotta 浅底）
- 右侧：匹配度数字（72px serif, terracotta）+ 圆形进度环（SVG，terracotta 描边）
- 入场：标题 fade+slide up → 数字 scale up → 进度环 stroke 动画（1.2s ease-out-expo）

**PipelineSteps**：
- 横向 5 步时间线，每步一个 ClaudeCard
- 已完成：Ivory + terracotta 对勾；当前：ring shadow + terracotta 边框；未完成：Stone Gray 虚线
- Scroll-triggered stagger fade-in（间隔 100ms）

**GrowthRoadmap**：
- 深色区块（Near Black `#141413`），形成明暗交替节奏
- 3 列卡片：Dark Surface `#30302e`、阶段名 serif（Ivory）、薪资 Coral Accent `#d97757`

**QuickStats**：
- 3 个 ClaudeStatCard：规划进度 %、薪资参考、已匹配岗位数
- 数字 CountUp 动画（0 → 目标值，0.8s）

**ProfileCard**：
- Ivory ClaudeCard，圆形头像 ring shadow 边框
- "编辑资料" ghost 按钮

---

## 8. Phase 5 — 简历解构页

### 8.1 文件拆分

```
student-competency-profile/
├── index.tsx                    (~150 行)
├── components/
│   ├── ResumeUploadZone.tsx     (~200 行)
│   ├── ChatStream.tsx           (~300 行)
│   ├── RadarScorePanel.tsx      (~200 行)
│   ├── DimensionKeywordEditor.tsx (~250 行)
│   ├── GapAnalysisPanel.tsx     (~200 行)
│   ├── MatchWorkspace.tsx       (~300 行)
│   ├── CompanyMatchCards.tsx    (~200 行)
│   └── MatchActionBar.tsx       (~100 行)
├── hooks/
│   ├── useResumeStream.ts       (~150 行)
│   ├── useCompetencyData.ts     (~100 行)
│   └── useMatchResults.ts       (~100 行)
```

### 8.2 视觉设计

**ResumeUploadZone**：大面积 Ivory 拖拽区，dashed terracotta 边框（2px），圆角 16px。拖入时 ring shadow + 背景变 `#faf0eb`。文件类型用 ClaudeTag pill badge。

**ChatStream**：深色区块背景（Near Black），AI 消息 Dark Surface + Warm Silver 文字，用户消息 Warm Sand + Charcoal Warm。打字机效果 terracotta 光标。

**RadarScorePanel**：封装 @ant-design/charts Radar。Terracotta 填充（20% 透明度）+ terracotta 描边。坐标轴 Olive Gray，网格线 Border Cream。点击维度展开详情面板（slide-in）。

**DimensionKeywordEditor**：12 维度 collapsible 分组，关键词用 ClaudeTag pill（可删除/新增），无关键词时 Stone Gray placeholder。

**MatchWorkspace**：Tab 深度覆盖（terracotta 底部指示条），匹配百分比大号 serif terracotta 数字 + 进度条。

---

## 9. Phase 6 — 蜗牛学习路径页

### 9.1 文件拆分

```
snail-learning-path/
├── index.tsx                  (~150 行)
├── components/
│   ├── PathHero.tsx           (~150 行)
│   ├── PhaseTimeline.tsx      (~200 行)
│   ├── ModuleList.tsx         (~250 行)
│   ├── ResourceCards.tsx      (~250 行)
│   ├── ResourceDetail.tsx     (~200 行)
│   ├── ReviewPanel.tsx        (~250 行)
│   └── ProgressRing.tsx       (~100 行)
├── hooks/
│   ├── useWorkspace.ts        (~120 行)
│   ├── useModuleProgress.ts   (~100 行)
│   └── useReviews.ts          (~100 行)
├── utils/
│   └── learningPathUtils.ts   (保留)
```

### 9.2 视觉设计

**PathHero**：横向 4 指标卡，完成度用双环 SVG（外环 terracotta，内环 warm-sand）。入场动画 stagger + 环形刷进度。

**PhaseTimeline**：横向 3 段（短/中/长期），当前阶段 terracotta 实心圆 + 实线，其余 Border Cream 虚线。切换时 crossfade（AnimatePresence）。

**ModuleList**：Ivory ClaudeCard 内模块列表。已完成 terracotta 对勾 + 删除线，当前 ring shadow + terracotta 左边框，未完成 Stone Gray。展开练习任务 accordion 动画。

**ResourceCards**：2 列 ClaudeCard 网格。已打卡 terracotta badge，hover 微上移 + whisper shadow。

**ResourceDetail**：Drawer 深度覆盖（Ivory 背景），3 section（为什么学/学什么/能做到）用 serif 标题 + terracotta 左边框装饰。

**ReviewPanel**：Segmented 覆盖（warm-sand 底 + terracotta 选中），AI 报告打字机效果，历史报告时间线样式（terracotta 圆点 + 连接线）。

---

## 10. Phase 7 — 个人职业成长报告页

### 10.1 文件拆分

```
personal-growth-report/
├── index.tsx                    (~120 行)
├── components/
│   ├── ReportHero.tsx           (~150 行)
│   ├── ChapterNav.tsx           (~150 行)
│   ├── ChapterContent.tsx       (~200 行)
│   ├── ChapterEditor.tsx        (~200 行)
│   ├── ExportPanel.tsx          (~100 行)
│   ├── GenerationProgress.tsx   (~150 行)
│   └── PrerequisiteCheck.tsx    (~100 行)
├── hooks/
│   ├── useReportWorkspace.ts    (保留，精简到 ~250 行)
│   ├── useReportTaskLifecycle.ts (保留，精简到 ~200 行)
│   └── usePrerequisites.ts      (保留，~90 行)
```

### 10.2 视觉设计

**ReportHero**：Parchment 背景，左侧 serif 标题（36px）+ 日期（Stone Gray），右侧导出按钮组。未生成时居中空状态 + terracotta CTA。

**GenerationProgress**：深色区块，terracotta 渐变进度条 + pulse 动画，流式文本逐段预览，"取消" ghost 按钮。

**ChapterNav**：固定左侧 sidebar（桌面），Ivory 背景，当前章节 terracotta 左边框 + terracotta 文字，已编辑章节 terracotta 小圆点标记。移动端折叠为顶部下拉。

**ChapterContent**：Ivory ClaudeCard，Markdown 渲染覆盖 Claude 排版（h2/h3 serif，引用块 terracotta 左边框，列表 terracotta 圆点，表格 Border Cream + warm-sand 表头）。编辑模式 TipTap 工具栏 warm-sand 按钮。

**PrerequisiteCheck**：水平 checklist，已完成 terracotta 对勾，未完成 Stone Gray 圆圈，全部满足后 fade out。

---

## 11. Phase 8 — 岗位能力图谱 + 同岗行业对比

### 11.1 岗位能力图谱

新建完整页面：

```
job-competency-graph/
├── index.tsx                  (~150 行)
├── components/
│   ├── GraphCanvas.tsx        (~300 行)
│   ├── GraphLegend.tsx        (~100 行)
│   ├── NodeDetailPanel.tsx    (~200 行)
│   └── GraphGuide.tsx         (~100 行)
├── hooks/
│   └── useGraphData.ts        (~100 行)
```

**GraphCanvas**：Parchment 画布。根节点 Terracotta + Ivory 文字，维度组 Warm Sand + Charcoal Warm，叶节点 Ivory + Border Cream。连接线 Stone Gray，hover 变 terracotta。选中节点 ring shadow 放大 + 相关路径高亮。入场：从中心向外逐层扩散（stagger 200ms）。

**NodeDetailPanel**：右侧滑入 Ivory 面板，节点名 serif 标题，关键词 ClaudeTag pills，覆盖度百分比 terracotta 大字 + 进度条。

### 11.2 同岗行业对比

```
same-job-cross-industry/
├── index.tsx                  (~120 行)
├── components/
│   ├── FilterBar.tsx          (~150 行)
│   ├── TierComparison.tsx     (~250 行)
│   └── ComparisonSummary.tsx  (~100 行)
├── hooks/
│   └── useComparisonData.ts   (~100 行)
```

**FilterBar**：Parchment ClaudeCard，ClaudeSelect 岗位单选 + 行业多选（ClaudeTag 模式），Terracotta 查询按钮。

**TierComparison**：初级/中级/高级 3 tab（terracotta 底部指示条），每层 ClaudeCard 含 12 维度横向对比条（terracotta/warm-sand/olive 区分行业）。Scroll-triggered stagger fade-in。

**ComparisonSummary**：3 个 ClaudeStatCard（对比行业数、维度覆盖数、最大差异维度）。

---

## 12. Phase 9 — Admin 页面 Token 同步

不做布局重设计，仅同步颜色 token：

- `defaultSettings.ts` 中 token 更新后自动生效
- `global.less` 重写后覆盖 ProTable/ProForm 等 admin 组件
- 确保 admin 页面不出现冷蓝灰

---

## 13. Motion 动画系统

### 13.1 依赖

```bash
npm install framer-motion
```

### 13.2 五类动画模式

**1. Scroll-triggered Reveal**
- `FadeInWhenVisible` 包装组件（framer-motion `useInView`）
- 默认：从下方 30px fade in，0.8s ease-out-expo
- 变体：`slideLeft`、`slideRight`、`scaleUp`
- Stagger children：列表/卡片组依次出现（间隔 0.1s）

**2. Page Transition**
- Umi layout 层添加 `AnimatePresence`
- 退出：fade out + 微上移（-10px），0.3s
- 进入：fade in + 从下移入（20px → 0），0.4s

**3. Hero Entrance**
- Home-v2 hero 区域专用
- 时序：0ms 背景 → 200ms 标题 → 400ms 副标题 → 600ms 数字+进度环 → 800ms CTA
- 进度环 SVG stroke-dashoffset 动画（1.2s）

**4. Data Visualization Animation**
- 雷达图：12 维度从中心向外依次展开（stagger 50ms）
- 柱状图：柱子从底部生长（scaleY，stagger 80ms）
- 饼图：扇区依次出现（rotate + fade）
- 数字 CountUp：0 → 目标值（0.8s ease-out）
- 进度条：宽度过渡（0.6s）

**5. Micro-interactions**
- 卡片 hover：translateY(-2px) + shadow 提升（0.15s）
- 按钮 hover：ring shadow 出现（0.15s）
- 按钮 click：scale(0.98) 回弹（0.1s）
- Tab 切换：底部指示条 spring 滑动
- Checkbox 勾选：scale 弹跳 + terracotta 填充
- 抽屉/Modal：slide in + 背景半透明

### 13.3 性能控制

- 所有 scroll 动画用 `useInView`（IntersectionObserver），不用 scroll 事件
- `will-change` 仅动画期间添加，结束后移除
- `prefers-reduced-motion` 检测：用户偏好时禁用非必要动画，仅保留 opacity 过渡
- 图表动画使用 `@ant-design/charts` 内置，不叠加 framer-motion

---

## 14. 新增依赖

| 包 | 用途 |
|----|------|
| `framer-motion` | 页面过渡、scroll reveal、微交互 |

不新增其他 UI 库。现有 antd + @ant-design/charts + @antv/g6 + @tiptap/react 已满足需求。

---

## 15. 文件变更预估

| 类型 | 操作 | 预估数量 |
|------|------|---------|
| 重写 | `global.less` | 1 文件 |
| 重写 | `defaultSettings.ts` | 1 文件 |
| 新建 | `src/styles/motion.ts` | 1 文件 |
| 新建/升级 | `src/components/ui/*` | ~8 组件 |
| 新建 | 各页面 hooks | ~15 hooks |
| 重构 | 各页面子组件拆分 | ~30+ 组件 |
| 保留不变 | 后端、admin 页面布局、API 服务 | — |
