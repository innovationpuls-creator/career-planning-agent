# Career-Match 前端重写设计

> 日期：2026-05-23
> 状态：设计完成
> 决策过程：与用户逐项确认 9 个设计决策，每项均有 HTML mockup 验证
> 参考：`docs/Design.md`、`docs/Design-patterns.md`、`docs/UI功能模块/04-career-match.md`

---

## 1. 目标

将 `/career-match` 从 student-competency-profile 组件的薄封装层，重写为拥有独立组件树和视觉辨识度的完整页面。

- 信息架构从"原始数据倾泻"转为"结论优先，逐层钻取"
- 图表化、分析导向，减少对用户的原始数据倾泻
- 融合 HomeV2（暖纸色调、带状节奏）和 SCP（双面板、Tabs）的视觉语言
- 保持 `docs/UI功能模块/04-career-match.md` 全部功能不删减

---

## 2. 页面布局

```
┌──────────────────────────────────────────────────────┐
│  [CAREER MATCH]                           [问AI教练] │
│  职业匹配分析                                         │
│                                                       │
│  ┌──┐ ┌────────────────────────────────────────────┐ │
│  │87│ │  87%  前端工程师                            │ │
│  │  │ │  互联网·技术              ★已收藏 [→生成]  │ │
│  │72│ └────────────────────────────────────────────┘ │
│  │  │                                                │
│  │68│  能力对比(12) │ 提升建议(3) │ 最匹配工作(5)    │
│  │  │ ─────────────────────────────────────────────── │
│  │61│ ┌────────────────────────────────────────────┐ │
│  │  │ │          能力雷达图 / 差距分析 / 画廊      │ │
│  │54│ │                                            │ │
│  │  │ └────────────────────────────────────────────┘ │
│  │+2│                                                │
│  └──┘  数据来源：12维度分析 · 更新于 2026年5月23日   │
└──────────────────────────────────────────────────────┘
```

- **左侧**：ScoreNav，纵向分数导航条，宽度 52px+间隙
- **右上**：AskCoachButton 固定右上角
- **右侧上部**：MatchOverviewCard 概览卡
- **右侧中部**：Tabs（能力对比/提升建议/最匹配工作）
- **面板下部**：DataSourceFooter 元信息

---

## 3. 组件树

```
myapp/src/pages/career-match/
├── index.tsx                    # 页面入口，FadeInWhenVisible + GlassShell
├── pageStyles.ts                # 页面级 createStyles
├── components/
│   ├── ScoreNav.tsx             # 左侧分数导航条
│   ├── MatchOverviewCard.tsx    # 概览卡（环形图+岗位+按钮）
│   ├── RadarComparisonPanel.tsx # Tab1: SVG雷达+维度卡片网格
│   ├── GapAdvicePanel.tsx       # Tab2: 手风琴差距分析
│   ├── CompanyGallery.tsx       # Tab3: CSS匀速横向画廊
│   └── DataSourceFooter.tsx     # 底部数据来源小字
└── hooks/
    └── useCareerMatchData.ts    # 统一数据管理 hook
```

所有组件互相独立，不依赖 student-competency-profile。

---

## 4. 各组件规格

### 4.1 ScoreNav

- 纵向排列分数 badge（52×52，圆角 14px）
- 激活态：terracotta 填充 + 白字 + 投影
- 非激活态：玻璃 bg + oliveGray 数字
- hover：terracotta border + 微投影
- 末尾 +2 为不可点击的灰色更多指示
- 点击切换 → 更新 MatchOverviewCard 和 Tabs 内容

### 4.2 MatchOverviewCard

- 玻璃卡片（rgba(255,255,255,0.45) + blur 24px）
- 左侧：环形进度图（88×88 SVG，terracotta 描边，背景 #f0eee6）
- 中部：岗位名（serif 20px）+ 行业/维度数元信息
- 右侧：收藏按钮（ghost） + 生成学习计划按钮（terracotta primary）
- 计划按钮仅收藏后可用（disabled + tooltip 提示"请先收藏"）

### 4.3 RadarComparisonPanel

参考 RadarScorePanel 结构：
- 标题"能力雷达图"（serif 18px）
- SVG 雷达图（12 轴，双系列填充）
  - 市场重要度：fill rgba(23,131,255,0.08) / stroke #1783FF
  - 个人准备度：fill rgba(0,201,201,0.10) / stroke #00C9C9
- 图例行（市场重要度/个人准备度）
- 下方评分卡片网格（auto-fill, minmax 180px）
  - 维度名 + 分值（绿色≥70 / terracotta 40-69 / 红色<40）
  - 4px 彩色进度条

### 4.4 GapAdvicePanel

参考 GapAnalysisPanel 结构：
- 标题"差距分析与提升建议"（serif 18px）
- 手风琴列表（无外部容器，纯透明背景）
- 每项 header：WarningOutlined（优先项）+ 维度名 + 状态标签 + 展开箭头
  - 状态标签：需要补充（terracotta bg）/ 基本匹配（oliveGray bg）
- 展开 body：重要性 → 当前问题 → 下一步行动（圆点列表）→ 推荐关键词（标签行）
- 按优先级排序（priorityGaps 优先，再按 gap 值降序）

### 4.5 CompanyGallery

- 标题"最匹配的工作机会"
- 横向滚动画廊（CSS translateX + requestAnimationFrame 时间插值）
- 速度 30px/s，匀速线性，无缝循环（克隆卡片）
- 卡片（230×auto，玻璃 bg）：公司图标（圆形容器 terracotta 8% bg）+ 公司名 + 岗位 + 迷你环形图（40×40）+ 标签行
- 左右渐变 fade 遮罩（48px，ivory → transparent）
- hover 暂停动画，卡片 lift + terracotta border

### 4.6 DataSourceFooter

- Tab 面板区最下方
- 居中 11px stoneGray 小字
- 时钟图标 + "数据来源：12 维度分析 · 更新于 YYYY年M月D日"

---

## 5. 数据流

```
useCareerMatchData (hook)
  ├─ GET /api/career-development-report/job-exploration-match/init
  ├─ GET /api/career-development-report/favorites
  ├─ GET /api/student-competency-profile/latest-analysis
  ├─ POST /api/career-development-report/favorites
  └─ DELETE /api/career-development-report/favorites/{id}

  state:
    matchData, activeRecommendationId, activeTab,
    favorites, favoriteSubmitting, loading, error,
    competencyProfile

  → index.tsx 通过 props 分发给各子组件
```

---

## 6. 视觉约束

- 全部使用 `createStyles` + token 化样式
- 颜色引用 `claudeColors` / `claudeAlpha` / `claudeGlass` / `chart-tokens`
- 字体：标题 serif（headingFont），正文 bodyFont
- 动效：页面入口 FadeInWhenVisible，Tab 切换 CSS animation（0.3s ease fadeIn + translateY 6px）
- 画廊动画：time-based interpolation，dt cap 0.1s 防跳帧
- 响应式：≤800px 时 Nav 变横向，卡片竖排

---

## 7. 功能保留清单

与 `docs/UI功能模块/04-career-match.md` 对照：

- [x] 独立页面展示职业匹配结果
- [x] 加载 12 维能力画像
- [x] 初始化推荐列表与默认目标
- [x] 切换推荐目标，查看匹配百分比
- [x] Tab「能力对比」：学生 vs 目标维度对比
- [x] Tab「提升建议」：优先级差距 + 行动建议
- [x] Tab「最匹配工作」：公司/证据卡片
- [x] 收藏/取消收藏
- [x] 生成计划（仅已收藏时可用，跳转 snail-learning-path）
- [x] 跳转 AI 教练（step=match 上下文）
