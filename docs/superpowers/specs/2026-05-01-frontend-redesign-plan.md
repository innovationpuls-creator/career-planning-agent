# 前端重设计实施计划

> 基于 `docs/superpowers/specs/2026-05-01-frontend-redesign-design.md`
> 参考：`docs/UI功能模块/README.md`（功能、路由与 API 模块索引）
> 日期：2026-05-01

---

## 全局约束

### 功能保全原则

每一阶段完成后，该页面的所有功能点必须与 `docs/UI功能模块/README.md` 及对应模块文档中列出的当前实现一致。不允许因重设计而丢失任何功能。

### API 对接原则

所有前端 API 调用必须与 `docs/UI功能模块/README.md` 及对应模块文档中记录的端点一致。重构组件时，提取的 hook 中的 API 调用路径不得改变。

### 文件规范

- 每个文件 ≤ 500 行
- 每个函数 ≤ 50 行
- 每个 hook 职责单一
- 使用 `createStyles` from `antd-style` 做组件样式，不写 `.less`/`.css` 模块
- 所有颜色引用 Claude token（通过 `createStyles` 的 `token` 参数或 CSS 变量）

---

## Phase 1: Design System Foundation

**目标**：建立 Claude 设计系统的 token 层，后续所有 Phase 的视觉基础。

### 1.1 安装依赖

```bash
cd myapp && npm install framer-motion
```

### 1.2 新建 `myapp/src/styles/motion.ts`

- 导出 `motionTokens`（easing、duration、stagger 常量）
- 导出 `prefersReducedMotion()` 工具函数

### 1.3 新建 `myapp/src/styles/claude-tokens.ts`

- 导出完整的 Claude 色板对象（Parchment、Ivory、Terracotta、Near Black、Olive Gray、Stone Gray、Border Cream、Warm Sand、Charcoal Warm、Dark Surface、Warm Silver 等）
- 导出阴影系统（Flat、Contained、Ring、Whisper、Inset）
- 导出圆角系统（SM/MD/LG/XL/XXL）
- 导出字体栈（`--font-heading`、`--font-body`）

### 1.4 修改 `myapp/config/defaultSettings.ts`

**当前状态**：蓝色 primary `#1655CC`，冷灰背景 `#F5F6F8`

**变更**：

- `colorPrimary` → `#c96442`（Terracotta）
- `colorPrimaryHover` → `#d97757`
- `colorPrimaryActive` → `#b05535`
- `colorPrimaryBg` → `#faf0eb`
- `colorText` → `#141413`
- `colorTextSecondary` → `#5e5d59`
- `colorTextTertiary` → `#87867f`
- `colorBorder` → `#f0eee6`
- `colorBgLayout` → `#f5f4ed`
- `colorBgContainer` → `#faf9f5`
- `colorSuccess` → `#4a7c3f`
- `colorError` → `#b53333`
- `fontFamily` → 系统无衬线栈
- `fontFamilyCode` 保持
- 新增 `borderRadius` 系列（4/8/12/16/32）
- 新增自定义 token 扩展：`darkSurface`、`warmSand`、`charcoalWarm`、`warmSilver`

### 1.5 重写 `myapp/src/global.less`

**当前**：~989 行，大量 `!important` 覆盖

**改为**：~400 行，策略如下：

- 保留 `:root` CSS 变量定义（更新为 Claude 色值）
- ProLayout/Menu/ProTable 覆盖保留但改为暖色调值
- 移除蓝色系的所有 `!important` 覆盖
- 保留 `.auth-root` 分屏布局结构，更新配色为 Parchment + Ivory
- 按钮全局覆盖改为 Warm Sand secondary / Terracotta primary

### 1.6 修改 `myapp/src/app.tsx`

- 在 `RunTimeLayoutConfig` 中添加 `ConfigProvider` 的 `theme` prop，注入 Claude token
- 确保 `getInitialState` 逻辑不变

### 验收标准

- `npm run tsc` 无报错
- `npm start` 启动后全局颜色为暖色调
- 登录页、首页、admin 页面均显示正确暖色调（admin 页面暂不做布局改动）

---

## Phase 2: Shared UI Component Library

**目标**：建立 Claude 风格的基础组件库，供后续所有页面使用。

### 2.1 新建 `myapp/src/components/ui/ClaudeButton.tsx`

- 4 个 variant：`warm-sand`、`terracotta`、`dark-charcoal`、`ghost`
- Props 继承 `ButtonProps` from antd，新增 `variant?: 'warm-sand' | 'terracotta' | 'dark-charcoal' | 'ghost'`
- 实现：用 `createStyles` 生成 variant 对应的样式，通过 `className` 覆盖 antd Button
- Ring shadow on hover，scale(0.98) on active
- 不对称 padding（icon 侧 8px，文字侧 12px）

### 2.2 新建 `myapp/src/components/ui/ClaudeCard.tsx`

- 3 个 elevation：`flat`、`elevated`、`ring`
- Props：`elevation?: 'flat' | 'elevated' | 'ring'`，其余继承 antd `CardProps`
- 表面 Ivory，标题 serif 字体，圆角 8px

### 2.3 新建 `myapp/src/components/ui/ClaudeTag.tsx`

- Pill 形状（border-radius 24px）
- `#faf0eb` 背景 + `#c96442` 文字
- Props：`closable?: boolean`、`onClose?: () => void`

### 2.4 新建 `myapp/src/components/ui/ClaudeInput.tsx`

- 包装 antd Input，用 `createStyles` 覆盖：圆角 12px、紧凑 padding、Focus Blue focus ring
- 支持 `Input.TextArea` 和 `Input.Password` 变体

### 2.5 新建 `myapp/src/components/ui/ClaudeSelect.tsx`

- 包装 antd Select，用 `createStyles` 覆盖样式匹配 ClaudeInput 风格

### 2.6 升级 `myapp/src/components/ui/StatCard.tsx` → `ClaudeStatCard.tsx`

**当前 API**：

```ts
interface StatCardProps {
  icon: ReactNode;
  title: string;
  value: string | number;
  trend?: { value: number; isUp: boolean };
  suffix?: string;
}
```

**变更**：

- 数值改用 serif 字体（48px STSongti SC/Georgia, weight 500）
- 趋势标签改用 warm-sand pill badge
- 背景 Ivory，边框 Border Cream

### 2.7 新建 `myapp/src/components/ui/FadeInWhenVisible.tsx`

- 基于 framer-motion `useInView`
- Props：`direction?: 'up' | 'down' | 'left' | 'right'`、`delay?: number`、`duration?: number`、`stagger?: boolean`
- 检测 `prefers-reduced-motion`，如用户偏好则直接显示

### 2.8 新建 `myapp/src/components/ui/CountUpNumber.tsx`

- Props：`target: number`、`duration?: number`、`prefix?: string`、`suffix?: string`
- 使用 framer-motion `useMotionValue` + `useTransform` 实现数字滚动
- 到达目标值后停止

### 2.9 新建 `myapp/src/components/ui/ProgressRing.tsx`

- Props：`percent: number`、`size?: number`、`strokeWidth?: number`、`color?: string`
- SVG 圆形进度条，stroke-dashoffset 动画
- 默认 terracotta 描边

### 2.10 更新 `myapp/src/components/ui/index.ts`

- 导出所有新组件
- 保留 `PageEmpty`、`PageError`、`PageLoading`、`SkeletonCard`、`RichTextEditor`
- 保留 `StatCard`（向后兼容，内部指向 ClaudeStatCard）

### 验收标准

- 所有组件可独立渲染
- `npm run tsc` 无报错
- 每个组件有对应的 `.test.tsx` 文件（基本渲染测试）

---

## Phase 3: Auth Pages（登录 + 注册）

**目标**：改造登录/注册页面为 Claude 分屏布局 + 入场动画。

### 功能保全清单

**登录页**（`docs/UI功能模块/01-auth.md`）：

- [ ] 用户名 + 密码登录
- [ ] 记住登录
- [ ] 忘记密码
- [ ] 跳转到注册页

**注册页**（`docs/UI功能模块/01-auth.md`）：

- [ ] Step 1：用户名、密码（最少 8 位）
- [ ] Step 2：姓名、学校、专业、学历、年级、目标岗位（下拉选择，数据来自 API）
- [ ] Step 3：上传简历图片（jpg/jpeg/png/webp）
- [ ] 注册完成后自动登录并跳转到 `/home-v2`

### API 端点

| 操作             | 端点                           | 方法 |
| ---------------- | ------------------------------ | ---- |
| 登录             | `/api/login/account`           | POST |
| 注册             | `/api/register`                | POST |
| 获取用户信息     | `/api/currentUser`             | GET  |
| 获取目标岗位选项 | `/api/job-postings/job-titles` | GET  |

### 3.1 改造 `myapp/src/pages/user/login/index.tsx`

**当前**：427 行，antd ProForm + `.auth-root` 分屏

**改造**：

- 保留 `.auth-root` 分屏结构
- 左半屏：Parchment 背景 + serif 标题 + Olive Gray 副标题 + terracotta 装饰 SVG
- 右半屏：Ivory 背景 + ClaudeInput 用户名/密码 + ClaudeButton terracotta "登录"
- 添加 framer-motion 入场动画（标题 fade+slide up，200ms 延迟后副标题跟入）
- API 调用保持 `/api/login/account` POST 不变
- 保留"记住登录"、"忘记密码"、"跳转注册"功能

### 3.2 改造 `myapp/src/pages/user/register/index.tsx`

**当前**：401 行，三步 Steps 组件

**改造**：

- 同登录分屏布局，左半屏品牌区一致
- 步骤指示器：用自定义 serif 数字替代 antd Steps
- 步骤切换：framer-motion `AnimatePresence` + slide 过渡
- Step 1：ClaudeInput 用户名 + 密码，密码强度条（terracotta 渐变 CSS）
- Step 2：ClaudeInput + ClaudeSelect，目标岗位下拉数据来自 `GET /api/job-postings/job-titles`
- Step 3：拖拽上传区（Ivory 背景 + dashed terracotta 边框），支持 jpg/jpeg/png/webp
- API 调用：`POST /api/register`，注册后 `POST /api/login/account` 自动登录
- 保留所有字段校验逻辑（密码最少 8 位、必填字段检查）

### 验收标准

- 登录/注册流程完整可走通
- 所有字段校验正常
- 分屏布局左右比例 40:60
- 入场动画流畅（无 jank）

---

## Phase 4: Home-v2 首页

**目标**：拆分 1,791 行单体文件为 6 个子组件 + 1 个 hook，全面重设计视觉。

### 功能保全清单

（`docs/UI功能模块/02-home-v2.md`）：

- [ ] 展示当前目标岗位、阶段（初级/进阶/高阶）、匹配百分比
- [ ] 展示下一步操作建议及 CTA 按钮
- [ ] 展示规划进度百分比、薪资参考、已匹配岗位数量
- [ ] 展示 5 步职业规划管线完成状态（完善资料 → 简历解析 → 职业匹配 → 蜗牛学习路径 → 成长报告），当前步骤可跳转
- [ ] 展示 3 阶段成长路线（含各阶段薪资范围）
- [ ] 展示个人信息（姓名、学校、专业、学历、年级、简历附件）
- [ ] 编辑资料：修改姓名、学校、专业、学历、年级、目标岗位、简历图片

### API 端点

| 操作              | 端点                                              | 方法             |
| ----------------- | ------------------------------------------------- | ---------------- |
| 获取首页数据      | `/api/home-v2`                                    | GET              |
| 获取当前用户      | `/api/currentUser`                                | GET              |
| 提交/编辑个人资料 | `/api/user-profile/onboarding`                    | POST (multipart) |
| 获取收藏列表      | `/api/career-development-report/favorites`        | GET              |
| 获取最新能力分析  | `/api/student-competency-profile/latest-analysis` | GET              |

### 4.1 新建 `myapp/src/pages/home-v2/hooks/useHomeData.ts`

- 调用 `GET /api/home-v2`、`GET /api/currentUser`、`GET /api/career-development-report/favorites`、`GET /api/student-competency-profile/latest-analysis`
- 返回：`{ homeData, currentUser, favorites, latestAnalysis, loading, refresh }`
- 处理错误状态

### 4.2 新建 `myapp/src/pages/home-v2/components/HeroSection.tsx`

- Props：`targetJob, stage, matchPercent`
- Parchment 背景渐变到 Ivory
- 左侧：serif "你的职业规划"（40px）+ 目标岗位 pill tag（ClaudeTag）
- 右侧：匹配度数字（72px serif, terracotta）+ ProgressRing
- framer-motion 入场动画序列

### 4.3 新建 `myapp/src/pages/home-v2/components/PipelineSteps.tsx`

- Props：`currentStep: number, onStepClick: (step: number) => void`
- 5 步横向时间线，每步一个 ClaudeCard
- 已完成/当前/未完成 三种状态样式
- 步骤定义：`['完善资料', '简历解析', '职业匹配', '蜗牛学习路径', '成长报告']`
- 跳转路由：`['/home-v2', '/student-competency-profile', '/career-match', '/snail-learning-path', '/personal-growth-report']`
- FadeInWhenVisible stagger 动画

### 4.4 新建 `myapp/src/pages/home-v2/components/GrowthRoadmap.tsx`

- Props：`stages: Array<{ name, salaryRange, skills }>`
- Near Black 深色区块
- 3 列 Dark Surface 卡片 + serif 标题 + Coral Accent 薪资

### 4.5 新建 `myapp/src/pages/home-v2/components/QuickStats.tsx`

- Props：`progress, salary, matchedJobs`
- 3 个 ClaudeStatCard + CountUpNumber 动画

### 4.6 新建 `myapp/src/pages/home-v2/components/ProfileCard.tsx`

- Props：`user: CurrentUser, onEdit: () => void`
- 展示姓名、学校、专业、学历、年级、简历附件
- "编辑资料" ghost 按钮
- 点击打开编辑 Modal（ClaudeInput + ClaudeSelect + 文件上传）
- 提交调用 `POST /api/user-profile/onboarding`（multipart/form-data）

### 4.7 新建 `myapp/src/pages/home-v2/components/CtaSection.tsx`

- Props：`nextAction: string, onAction: () => void`
- 展示下一步操作建议
- terracotta CTA 按钮

### 4.8 重写 `myapp/src/pages/home-v2/index.tsx`

- ~150 行，仅做数据获取（useHomeData）+ 子组件编排
- 页面布局：HeroSection → QuickStats → PipelineSteps → GrowthRoadmap → ProfileCard → CtaSection
- 每个 section 间用 FadeInWhenVisible 包裹

### 验收标准

- 所有 7 个功能点可正常工作
- 5 步管线点击可跳转到对应页面
- 编辑资料 Modal 可正常提交
- 3 阶段成长路线正确展示
- 入场动画和 scroll-triggered 动画流畅

---

## Phase 5: 简历解构页 + 独立职业匹配页

**目标**：拆分 6,086 行总计为 9 个子组件 + 3 个 hook，全面重设计。职业匹配模块保留为独立 `/career-match` 页面，不再要求回接到 `/student-competency-profile`。

### 功能保全清单

（`docs/UI功能模块/03-student-competency-profile.md`、`docs/UI功能模块/04-career-match.md`）：

**模块 1：简历解析**

- [ ] 上传简历文件（PDF/DOC/DOCX/TXT），支持拖拽
- [ ] AI 流式解析（SSE），实时进度
- [ ] 解析中支持追加文字或文件多轮对话
- [ ] Tab「能力雷达」：逐维度评分
- [ ] Tab「差距分析」：差距分析和行动建议
- [ ] Tab「关键字提取」：12 维度关键词标签编辑（增删）
- [ ] 重置解析
- [ ] 解析状态本地缓存，刷新可恢复

**模块 2：职业匹配（独立页 `/career-match`）**

- [ ] 展示当前分析对象和匹配来源
- [ ] 选择推荐目标（行业岗位/职业方向），查看匹配百分比
- [ ] Tab「能力对比」：12 维度逐维度对比
- [ ] Tab「提升建议」：优先级差距维度高亮
- [ ] Tab「最匹配工作」：匹配公司及证据卡片
- [ ] 收藏/取消收藏
- [ ] 生成计划（跳转蜗牛学习路径）

### API 端点

| 操作                 | 端点                                                          | 方法       |
| -------------------- | ------------------------------------------------------------- | ---------- |
| 获取 Dify 运行时配置 | `/api/student-competency-profile/runtime`                     | GET        |
| 获取最新 12 维度分析 | `/api/student-competency-profile/latest-analysis`             | GET        |
| 删除/重置分析        | `/api/student-competency-profile/latest-analysis`             | DELETE     |
| 流式简历解析         | `/api/student-competency-profile/chat/stream`                 | POST (SSE) |
| 加载对话画像         | `/api/student-competency-profile/conversations/{id}`          | GET        |
| 同步编辑结果         | `/api/student-competency-profile/result-sync`                 | POST       |
| 轮询状态事件         | `/api/student-competency-profile/status-events`               | GET        |
| 初始化职业匹配       | `/api/career-development-report/job-exploration-match/init`   | GET        |
| 生成匹配报告         | `/api/career-development-report/job-exploration-match/report` | POST       |
| 获取收藏列表         | `/api/career-development-report/favorites`                    | GET        |
| 添加收藏             | `/api/career-development-report/favorites`                    | POST       |
| 取消收藏             | `/api/career-development-report/favorites/{id}`               | DELETE     |
| 获取岗位名称选项     | `/api/job-postings/job-titles`                                | GET        |

### 5.1 新建 `myapp/src/pages/student-competency-profile/hooks/useResumeStream.ts`

- 封装 SSE 流式解析逻辑
- 调用 `POST /api/student-competency-profile/chat/stream`（multipart/form-data）
- 返回：`{ sendMessage, streamState, messages, reset }`
- 处理 NDJSON 解析：meta → delta → done/error 事件

### 5.2 新建 `myapp/src/pages/student-competency-profile/hooks/useCompetencyData.ts`

- 调用 `GET /api/student-competency-profile/latest-analysis`
- 调用 `DELETE /api/student-competency-profile/latest-analysis`（重置）
- 调用 `POST /api/student-competency-profile/result-sync`（同步编辑）
- 返回：`{ analysis, loading, reset, syncKeywords }`

### 5.3 新建 `myapp/src/pages/student-competency-profile/hooks/useMatchResults.ts`

- 调用 `GET /api/career-development-report/job-exploration-match/init`
- 调用 `POST /api/career-development-report/job-exploration-match/report`
- 调用收藏 API（GET/POST/DELETE `/api/career-development-report/favorites`）
- 返回：`{ matchData, favorites, toggleFavorite, generateReport, loading }`

### 5.4 新建 `myapp/src/pages/student-competency-profile/components/ResumeUploadZone.tsx`

- 拖拽上传区，Ivory 背景 + dashed terracotta 边框（2px），圆角 16px
- 支持 PDF/DOC/DOCX/TXT
- 拖入时 ring shadow + 背景 `#faf0eb`
- 文件类型标签：ClaudeTag pills
- 上传后触发 `useResumeStream.sendMessage`

### 5.5 新建 `myapp/src/pages/student-competency-profile/components/ChatStream.tsx`

- Near Black 深色背景
- AI 消息：Dark Surface 气泡 + Warm Silver 文字
- 用户消息：Warm Sand 气泡 + Charcoal Warm 文字
- 打字机效果 + terracotta 光标
- 支持追加文字输入 + 文件上传（多轮对话）
- SSE 进度条：terracotta 渐变

### 5.6 新建 `myapp/src/pages/student-competency-profile/components/RadarScorePanel.tsx`

- 封装 @ant-design/charts Radar
- Terracotta 填充（20% 透明度）+ terracotta 描边
- 坐标轴 Olive Gray，网格线 Border Cream
- 点击维度展开详情面板（slide-in from right）
- 展示 12 维度中文名 + 评分

### 5.7 新建 `myapp/src/pages/student-competency-profile/components/DimensionKeywordEditor.tsx`

- 12 维度 collapsible 分组
- 关键词用 ClaudeTag（可删除/新增）
- 新增：inline ClaudeInput
- 无关键词时 Stone Gray placeholder
- 编辑后调用 `POST /api/student-competency-profile/result-sync`

### 5.8 新建 `myapp/src/pages/student-competency-profile/components/GapAnalysisPanel.tsx`

- 差距分析 + 提升建议
- 优先级维度高亮（terracotta 左边框）
- 纯文本渲染建议内容，react-markdown 待后续 LLM 输出 markdown 格式后启用

### 5.9 新建 `myapp/src/pages/student-competency-profile/components/MatchWorkspace.tsx`

- Tab 切换：能力对比 / 提升建议 / 最匹配工作
- Tab 用 antd Tabs 深度覆盖（terracotta 底部指示条）
- 匹配百分比：大号 serif terracotta 数字 + 进度条
- 调用 `GET /api/career-development-report/job-exploration-match/init` 获取匹配数据
- 目标岗位选择：ClaudeSelect + `GET /api/job-postings/job-titles`

### 5.10 新建 `myapp/src/pages/student-competency-profile/components/CompanyMatchCards.tsx`

- 匹配公司卡片网格
- 公司名 + 匹配度 + 证据标签
- 收藏/取消收藏按钮（ClaudeButton ghost）
- 调用收藏 API

### 5.11 新建 `myapp/src/pages/student-competency-profile/components/ComparisonPanel.tsx`

- 12 维度用户画像 vs 岗位需求逐维度对比（双雷达叠加或表格）
- Props：`comparisonDimensions`, `userProfile`
- 配合 MatchWorkspace 的「能力对比」Tab 使用

### 5.12 新建 `myapp/src/pages/student-competency-profile/components/MatchActionBar.tsx`

- "收藏" warm-sand 按钮 + "生成计划" terracotta 按钮
- 生成计划跳转 `/snail-learning-path`

### 5.13 重写 `myapp/src/pages/student-competency-profile/index.tsx`

- ~230 行，状态管理 + 子组件编排
- 状态：空态/解析中/解析完成
- 本地缓存解析状态（localStorage），刷新恢复
- 不内嵌职业匹配 UI；职业匹配由 `/career-match` 独立编排 `useMatchResults` + `MatchWorkspace`

### 验收标准

- 简历上传 + SSE 流式解析正常
- 12 维度能力雷达/差距分析/关键字提取三个 Tab 正常
- 关键词编辑（Edit/Save/Cancel 按钮）后同步到后端
- `/career-match` 职业匹配三个 Tab（能力对比/提升建议/最匹配工作）正常
- `/career-match` 收藏/取消收藏正常
- `/career-match` 生成计划跳转正常
- localStorage 快照持久化正常，刷新后可恢复
- 多轮对话不破坏已有 profile 数据
- 重置后重新上传不残留旧消息

---

## Phase 6: 蜗牛学习路径页

**目标**：拆分 2,904 行为 7 个子组件 + 3 个 hook。

### 功能保全清单

（`docs/UI功能模块/05-snail-learning-path.md`）：

- [ ] 展示当前阶段、匹配度、内容完成度、练习完成度、当前模块
- [ ] 展示短期/中期/长期 3 阶段时间线，可点击切换
- [ ] 提交学习进度
- [ ] 编辑计划
- [ ] 左侧：学习模块列表，勾选完成，查看练习任务
- [ ] 右侧：学习资源卡片，标记已打卡，跳转外部链接，查看详情（为什么学、学什么、完成后能做到）
- [ ] 学习复盘 — 周检查：总结 + 文件 → AI 周报，查看历史
- [ ] 学习复盘 — 月检查：总结 + 文件 → AI 月评，查看历史

### API 端点

| 操作                 | 端点                                                                          | 方法             |
| -------------------- | ----------------------------------------------------------------------------- | ---------------- |
| 初始化工作区         | `/api/snail-learning-path/workspaces/{favorite_id}`                           | POST             |
| 初始化工作区（兼容） | `/api/career-development-report/snail-learning-path/workspaces/{favorite_id}` | POST             |
| 创建工作区           | `/api/snail-learning-path/workspaces`                                         | POST             |
| 创建复盘             | `/api/snail-learning-path/workspaces/{id}/reviews`                            | POST (multipart) |
| 获取复盘列表         | `/api/snail-learning-path/workspaces/{id}/reviews`                            | GET              |
| 获取匹配初始数据     | `/api/career-development-report/job-exploration-match/init`                   | GET              |
| 获取收藏列表         | `/api/career-development-report/favorites`                                    | GET              |

> 前端使用 `requestWith404Fallback` 先尝试 `/api/career-development-report/snail-learning-path/...`，失败后回退到 `/api/snail-learning-path/...`

### 6.1 新建 `myapp/src/pages/career-development-report/learning-path/hooks/useWorkspace.ts`

- 初始化工作区：先尝试兼容路径，失败回退
- 返回：`{ workspace, loading, error, refresh }`

### 6.2 新建 `myapp/src/pages/career-development-report/learning-path/hooks/useModuleProgress.ts`

- 模块完成状态管理
- 勾选/取消勾选操作
- 当前模块定位
- 返回：`{ modules, currentModule, toggleComplete, submitProgress }`

### 6.3 新建 `myapp/src/pages/career-development-report/learning-path/hooks/useReviews.ts`

- 调用 `POST /api/snail-learning-path/workspaces/{id}/reviews`（multipart，附证据文件）
- 调用 `GET /api/snail-learning-path/workspaces/{id}/reviews`
- 返回：`{ reviews, submitReview, loading }`

### 6.4 新建 `.../learning-path/components/PathHero.tsx`

- 横向 4 指标卡：当前阶段、匹配度 %、内容完成度、练习完成度
- 完成度用 ProgressRing 双环
- CountUpNumber 数字动画

### 6.5 新建 `.../learning-path/components/PhaseTimeline.tsx`

- 横向 3 段：短期（1-3 月）/ 中期（3-6 月）/ 长期（6-12 月）
- 当前阶段 terracotta 实心圆 + 实线，其余 Border Cream 虚线
- framer-motion `AnimatePresence` crossfade 切换

### 6.6 新建 `.../learning-path/components/ModuleList.tsx`

- Ivory ClaudeCard 内模块列表
- 已完成：terracotta 对勾 + 删除线
- 当前：ring shadow + terracotta 左边框
- 未完成：Stone Gray
- 展开练习任务 accordion 动画

### 6.7 新建 `.../learning-path/components/ResourceCards.tsx`

- 2 列 ClaudeCard 网格
- 已打卡 terracotta badge
- hover 微上移 + whisper shadow
- 点击展开 ResourceDetail

### 6.8 新建 `.../learning-path/components/ResourceDetail.tsx`

- Ant Design Drawer 深度覆盖（Ivory 背景）
- 3 section：为什么学 / 学什么 / 完成后能做到
- serif 标题 + terracotta 左边框装饰
- "跳转学习" terracotta 按钮 + "标记已打卡" warm-sand 按钮

### 6.9 新建 `.../learning-path/components/ReviewPanel.tsx`

- Segmented 切换周检查/月检查
- 输入区：ClaudeInput 多行 + 文件上传
- 提交后 AI 报告：打字机效果
- 历史报告：时间线样式（terracotta 圆点 + 连接线）

### 6.10 重写 `.../learning-path/index.tsx`

- ~150 行，数据获取 + 子组件编排
- 左右布局：ModuleList（左 40%）+ ResourceCards/ReviewPanel（右 60%）
- 顶部：PathHero + PhaseTimeline

### 验收标准

- 工作区初始化正常（兼容路径回退）
- 模块勾选/取消正常
- 资源卡片展示 + 已打卡 + 外部链接跳转正常
- 周/月复盘提交 + AI 报告生成正常
- 历史复盘列表正常
- 3 阶段时间线切换正常

---

## Phase 7: 个人职业成长报告页

**目标**：拆分为 7 个子组件，保留现有 3 个 hook 并精简。

### 功能保全清单

（`docs/UI功能模块/06-personal-growth-report.md`）：

- [ ] 生成报告（AI 生成，支持取消）
- [ ] 重新生成报告
- [ ] 查看报告前置条件
- [ ] 浏览报告各章节（自我认知、职业探索、技能差距、行动计划等）
- [ ] 编辑报告：富文本编辑器
- [ ] 恢复结构模板
- [ ] 保存报告
- [ ] 导出 Word（DOCX）
- [ ] 导出 PDF

### API 端点

| 操作             | 端点                                                             | 方法          |
| ---------------- | ---------------------------------------------------------------- | ------------- |
| 加载报告工作区   | `.../personal-growth-report/workspaces/{favorite_id}`            | GET           |
| 保存编辑后的报告 | `.../personal-growth-report/workspaces/{favorite_id}`            | PUT           |
| 重新生成报告     | `.../personal-growth-report/workspaces/{favorite_id}/regenerate` | POST          |
| 自动检测并生成   | `.../personal-growth-report/bootstrap/regenerate`                | POST          |
| 导出报告         | `.../personal-growth-report/workspaces/{favorite_id}/export`     | POST (binary) |
| 创建异步任务     | `.../personal-growth-report/tasks`                               | POST          |
| 获取任务状态     | `.../personal-growth-report/tasks/{task_id}`                     | GET           |
| 流式任务进度     | `.../personal-growth-report/tasks/{task_id}/stream`              | GET (SSE)     |
| 取消任务         | `.../personal-growth-report/tasks/{task_id}/cancel`              | POST          |
| 获取收藏列表     | `/api/career-development-report/favorites`                       | GET           |

> 以上路径前缀均为 `/api/career-development-report`

### 7.1 保留并精简 `hooks/useReportWorkspace.ts`

- 加载工作区 `GET .../workspaces/{favorite_id}`
- 保存 `PUT .../workspaces/{favorite_id}`
- 重新生成 `POST .../workspaces/{favorite_id}/regenerate`
- 恢复模板逻辑
- 目标：~250 行

### 7.2 保留并精简 `hooks/useReportTaskLifecycle.ts`

- 创建任务 `POST .../tasks`
- 获取状态 `GET .../tasks/{task_id}`
- 流式进度 `GET .../tasks/{task_id}/stream`（SSE NDJSON）
- 取消 `POST .../tasks/{task_id}/cancel`
- 目标：~200 行

### 7.3 保留 `hooks/usePrerequisites.ts`

- 检查前置条件（收藏、画像、分析是否完成）
- ~90 行

### 7.4 新建 `.../personal-growth-report/components/ReportHero.tsx`

- Parchment 背景，serif 标题 + 日期
- 右侧：导出 Word（warm-sand）+ 导出 PDF（terracotta）+ 重新生成（ghost）
- 未生成时：居中空状态 + terracotta CTA

### 7.5 新建 `.../personal-growth-report/components/GenerationProgress.tsx`

- Near Black 深色区块
- terracotta 渐变进度条 + pulse 动画
- 流式文本逐段预览（SSE delta 事件）
- "取消" ghost 按钮（Warm Silver 文字）
- 调用 `useReportTaskLifecycle` hook

### 7.6 新建 `.../personal-growth-report/components/ChapterNav.tsx`

- 固定左侧 sidebar（桌面），Ivory 背景
- 章节列表：serif 标题，当前 terracotta 左边框 + terracotta 文字
- 已编辑章节：terracotta 小圆点
- 移动端：折叠为顶部下拉 Select

### 7.7 新建 `.../personal-growth-report/components/ChapterContent.tsx`

- Ivory ClaudeCard
- Markdown 渲染（react-markdown）覆盖 Claude 排版：
  - h2/h3 serif 字体
  - 引用块 terracotta 左边框 + Parchment 背景
  - 列表 terracotta 圆点
  - 表格 Border Cream 边框 + warm-sand 表头

### 7.8 新建 `.../personal-growth-report/components/ChapterEditor.tsx`

- TipTap 富文本编辑器包装
- 工具栏 warm-sand 按钮 + ring shadow
- 编辑后调用 `PUT .../workspaces/{favorite_id}` 保存
- "恢复模板" ghost 按钮

### 7.9 新建 `.../personal-growth-report/components/ExportPanel.tsx`

- "导出 Word" warm-sand 按钮 → `POST .../workspaces/{id}/export`（body: `{ format: 'docx' }`）
- "导出 PDF" terracotta 按钮 → `POST .../workspaces/{id}/export`（body: `{ format: 'pdf' }`）
- 下载二进制文件

### 7.10 新建 `.../personal-growth-report/components/PrerequisiteCheck.tsx`

- 水平 checklist
- 已完成 terracotta 对勾，未完成 Stone Gray 圆圈
- 全部满足后 fade out

### 7.11 重写 `.../personal-growth-report/index.tsx`

- ~120 行
- 布局：PrerequisiteCheck（条件显示）→ ReportHero → 左 ChapterNav + 右 ChapterContent/ChapterEditor
- 未生成时显示 GenerationProgress 替代主内容

### 验收标准

- 报告生成 + 取消正常
- 章节浏览 + 富文本编辑 + 保存正常
- 导出 Word/PDF 下载正常
- 前置条件检查正常
- 重新生成正常

---

## Phase 8: 岗位能力图谱 + 同岗行业对比

### 功能保全清单

**岗位能力图谱**（`docs/UI功能模块/07-job-competency-graph.md`）：

- [ ] 三层交互式知识图谱（根节点 → 维度组 → 12 维度）
- [ ] 点击节点聚焦，高亮相关节点和边
- [ ] 悬停查看节点详情
- [ ] 右侧面板：描述、招聘关键词、聚合统计、覆盖度百分比
- [ ] 图谱阅读指南（可折叠）

**同岗行业对比**（`docs/UI功能模块/08-same-job-cross-industry.md`）：

- [ ] 选择岗位名称（单选）
- [ ] 选择行业（多选，根据岗位动态加载）
- [ ] 查询并展示分层对比结果（初级/中级/高级，含薪资范围和岗位详情）

### API 端点

| 操作             | 端点                                                   | 方法 |
| ---------------- | ------------------------------------------------------ | ---- |
| 获取知识图谱     | `/api/job-requirement-profile/graph`                   | GET  |
| 获取垂直对比数据 | `/api/job-requirement-profile/vertical`                | GET  |
| 获取公司详情     | `/api/job-requirement-profile/vertical/company-detail` | GET  |
| 获取岗位名称     | `/api/job-postings/job-titles`                         | GET  |
| 获取行业选项     | `/api/job-postings/industries`                         | GET  |

### 8.1 新建 `myapp/src/pages/job-requirement-profile/overview/hooks/useGraphData.ts`

- 调用 `GET /api/job-requirement-profile/graph`
- 转换 Neo4j 数据为 @antv/g6 格式
- 返回：`{ graphData, loading, selectedNode, selectNode }`

### 8.2 新建 `.../overview/components/GraphCanvas.tsx`

- @antv/g6 渲染，Parchment 画布
- 3 层节点配色：Terracotta 根节点 / Warm Sand 维度组 / Ivory+BorderCream 叶节点
- 连接线 Stone Gray，hover 变 terracotta
- 选中：ring shadow 放大 + 相关路径高亮
- 入场：从中心向外逐层扩散（stagger 200ms）

### 8.3 新建 `.../overview/components/NodeDetailPanel.tsx`

- 右侧滑入 Ivory 面板
- 节点名 serif 标题、关键词 ClaudeTag pills
- 覆盖度百分比 terracotta 大字 + 进度条
- 调用 `GET /api/job-requirement-profile/vertical/company-detail` 获取详情

### 8.4 新建 `.../overview/components/GraphLegend.tsx`

- 图例：3 种节点类型 + 连接线说明

### 8.5 新建 `.../overview/components/GraphGuide.tsx`

- 可折叠阅读指南
- Ant Design Collapse 覆盖 Claude 样式

### 8.6 重写 `.../overview/index.tsx`

- ~150 行
- 布局：GraphCanvas（全宽）+ NodeDetailPanel（右侧覆盖）

### 8.7 新建 `.../vertical/hooks/useComparisonData.ts`

- 调用 `GET /api/job-requirement-profile/vertical?jobTitle=...&industries=...`
- 调用 `GET /api/job-postings/job-titles` + `GET /api/job-postings/industries`
- 返回：`{ comparisonData, jobTitles, industries, query, loading }`

### 8.8 新建 `.../vertical/components/FilterBar.tsx`

- Parchment ClaudeCard
- ClaudeSelect 岗位单选 + 行业多选（ClaudeTag 模式）
- 查询按钮 terracotta
- 行业选项根据岗位动态加载 `GET /api/job-postings/industries?jobTitle=...`

### 8.9 新建 `.../vertical/components/TierComparison.tsx`

- 初级/中级/高级 3 tab（terracotta 底部指示条）
- 每层 ClaudeCard 含 12 维度对比条
- 不同行业用 terracotta/warm-sand/olive 区分
- FadeInWhenVisible stagger

### 8.10 新建 `.../vertical/components/ComparisonSummary.tsx`

- 3 个 ClaudeStatCard：对比行业数、维度覆盖数、最大差异维度

### 8.11 重写 `.../vertical/index.tsx`

- ~120 行
- 布局：FilterBar → ComparisonSummary → TierComparison

### 验收标准

- 知识图谱三层节点正确渲染
- 点击/悬停交互正常
- 右侧面板详情展示正常
- 同岗对比：岗位选择 → 行业动态加载 → 查询 → 分层展示正常
- 所有 API 端点正确对接

---

## Phase 9: Admin 页面 Token 同步

**目标**：仅同步颜色 token，不重设计布局。

### 功能保全清单

- [ ] 个人信息（§9）：查看/修改昵称/头像/密码
- [ ] 用户管理（§10）：列表/筛选/新增/编辑/删除/查看详情
- [ ] 岗位知识库（§11）：只读列表/筛选/查看详情
- [ ] 岗位要求对比（§12）：列表/筛选/查看详情
- [ ] 就读专业分布（§13）：统计卡片 + 饼图 + 柱状图
- [ ] 能力评估分析（§14）：统计卡片 + 雷达图 + 表格 + 堆叠柱状图
- [ ] 就业趋势洞察（§15）：统计卡片 + 柱状图 + 饼图

### 变更

- Phase 1 的 `defaultSettings.ts` 和 `global.less` 更新后，admin 页面自动获得暖色调
- 图表组件（@ant-design/charts）需在 admin 页面中覆盖配色为 Claude 暖色系
- 验证所有 admin 功能正常

### 9.1 修改 admin data-dashboard 页面图表配色

- `myapp/src/pages/admin/data-dashboard/major-distribution/index.tsx`
- `myapp/src/pages/admin/data-dashboard/competency-analysis/index.tsx`
- `myapp/src/pages/admin/data-dashboard/employment-trends/index.tsx`
- 图表颜色数组改为：`['#c96442', '#d97757', '#e8e6dc', '#87867f', '#4d4c48', '#5e5d59', '#b05535', '#faf0eb']`

### 9.2 验证 admin ProTable/ProForm 样式

- 确认暖色调 token 正确应用到表格、表单、按钮
- 如有样式遗漏，在 `global.less` 中补充覆盖

### 验收标准

- 所有 admin 页面功能正常
- 图表配色为暖色调
- 无冷蓝灰残留

---

## 跨 Phase 通用任务

### 通用动画组件

在 Phase 2 中创建的 `FadeInWhenVisible` 将被以下页面使用：

- Home-v2（PipelineSteps stagger、各 section reveal）
- 学习路径（ModuleList stagger、ResourceCards stagger）
- 同岗对比（TierComparison stagger）
- 所有页面的 section 进入动画

### 页面过渡动画

在 `myapp/src/layouts/BasicLayout.tsx` 或 `app.tsx` 中：

- 用 framer-motion `AnimatePresence` 包裹页面内容区域
- 路由切换时触发 exit/enter 动画
- 退出：fade out + translateY(-10px)，0.3s
- 进入：fade in + translateY(20px → 0)，0.4s

### 减少动画偏好

所有动画组件检测 `prefers-reduced-motion`：

- 为 `reduce` 时：仅保留 opacity 过渡，禁用位移/缩放/旋转
- 在 `FadeInWhenVisible` 中统一处理

---

## 实施顺序与依赖关系

```
Phase 1 (Design System)
    │
    ├─→ Phase 2 (UI Components)  ← 依赖 Phase 1 的 token
    │       │
    │       ├─→ Phase 3 (Auth)   ← 依赖 ClaudeButton, ClaudeInput, FadeInWhenVisible
    │       │
    │       ├─→ Phase 4 (Home)   ← 依赖 ClaudeCard, ClaudeStatCard, CountUpNumber, ProgressRing, FadeInWhenVisible
    │       │
    │       ├─→ Phase 5 (简历)   ← 依赖 ClaudeTag, ClaudeSelect, FadeInWhenVisible
    │       │
    │       ├─→ Phase 6 (学习路径) ← 依赖 ClaudeCard, ClaudeTag, ProgressRing, FadeInWhenVisible
    │       │
    │       ├─→ Phase 7 (报告)   ← 依赖 ClaudeCard, ClaudeButton
    │       │
    │       ├─→ Phase 8 (图谱+对比) ← 依赖 ClaudeCard, ClaudeSelect, ClaudeStatCard, FadeInWhenVisible
    │       │
    │       └─→ Phase 9 (Admin)  ← 仅依赖 Phase 1 token
```

Phase 4-8 之间无依赖，可并行开发。建议按 4 → 5 → 6 → 7 → 8 顺序串行，每完成一个页面即可验收。
