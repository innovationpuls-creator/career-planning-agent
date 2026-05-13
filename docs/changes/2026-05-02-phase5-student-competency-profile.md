# Phase 5: 简历解构页 (Student Competency Profile)

> 日期: 2026-05-02
> 计划来源: `docs/superpowers/specs/2026-05-01-frontend-redesign-plan.md` § Phase 5 (lines 328–470)
> 前置依赖: Phase 1 (Design System Foundation) + Phase 2 (Shared UI Components) + Phase 3 (Auth Pages) + Phase 4 (Home-v2)

---

## 概述

将 student-competency-profile 页面从旧版多组件混杂结构重构为 **3 个数据 hooks + 8 个展示组件 + 1 个编排层** 架构。2026-05-04 明确职业匹配为独立 `/career-match` 页面，`/student-competency-profile` 只承载简历解析和 12 维能力画像。

- **简历模块**: 上传简历 → SSE 流式解析 → 12 维度雷达图 + 关键词编辑 + 差距分析
- **职业匹配页**: `/career-match` 复用匹配组件，承载职位匹配推荐 → 收藏 → 生成学习计划

全面采用 Claude 设计语言（terracotta/ivory/nearBlack 色系、serif 标题、ClaudeCard/ClaudeTag/ClaudeButton 等共享组件）。

### 2026-05-04 需求文档修订

- `docs/UI功能详细整理.md` 将职业匹配从“简历解构模块 2”拆为 `4.1 职业匹配 (/career-match)`。
- `docs/superpowers/specs/2026-05-01-frontend-redesign-plan.md` 将 Phase 5 目标改为“简历解构页 + 独立职业匹配页”，验收标准也指向 `/career-match`。
- 首页默认管线的“职业匹配”跳转改为 `/career-match`，和当前路由配置保持一致。
- 简历解构页结果 Tab 统一为 `能力雷达 / 差距分析 / 关键字提取`；`ChatStream` 输入区补齐“追加文件”入口，追加文件沿用当前会话发送，不重置已有解析结果。

---

## 新建文件

### 数据 Hooks (`hooks/`)

#### `useCompetencyData.ts` (305 行)

核心数据 hook，管理 12 维度能力画像的读取、编辑和持久化：

| 职责     | 实现                                                              |
| -------- | ----------------------------------------------------------------- |
| 数据加载 | `GET /api/student-competency-profile/latest-analysis`             |
| 编辑状态 | `startEdit` / `cancelEdit` / `save` 管理 editorProfile 副本       |
| 标签管理 | `updateTagInput` / `addTag` / `removeTag` 操作 12 维度关键词      |
| 持久化   | localStorage 快照（`saveSnapshot` / `restoreSnapshot`），带版本号 |
| 空值处理 | 自动填充 `DEFAULT_VALUE = '暂无补充信息'`                         |

返回: `{ analysis, currentProfile, editorProfile, tagInputs, loading, isEditing, conversation, startEdit, cancelEdit, save, reset, updateTagInput, addTag, removeTag }`

#### `useResumeStream.ts` (175 行)

SSE 流式解析 hook，处理简历上传和 AI 解析流：

| 职责     | 实现                                                                                |
| -------- | ----------------------------------------------------------------------------------- |
| 发送消息 | `sendMessage(formData, readyUploads)` → `POST /api/student-competency-profile/chat` |
| SSE 解析 | `fetch` + `ReadableStream` 逐行读取 NDJSON                                          |
| 事件类型 | `meta`（连接）、`delta`（增量内容）、`done`（最终结果）、`error`（错误）            |
| 阶段追踪 | `stage` 字段驱动进度条和阶段标签                                                    |
| 中断支持 | `abort()` 中止进行中的请求                                                          |

返回: `{ isStreaming, streamError, messages, sendMessage, abort, reset }`

#### `useMatchResults.ts` (184 行)

职业匹配 hook，管理推荐列表和收藏：

| 职责     | 实现                                                     |
| -------- | -------------------------------------------------------- |
| 初始化   | `GET /api/career-development-match/init`                 |
| 收藏列表 | `GET /api/career-development-report/favorites`           |
| 收藏操作 | `POST /api/career-development-report/favorites` (toggle) |
| 生成计划 | `POST /api/career-development-plan/generate` (SSE)       |

返回: `{ matchData, recommendations, favorites, activeRecommendationId, loading, toggleFavorite, generatePlan, refresh }`

---

### 展示组件 (`components/`)

#### `ResumeUploadZone.tsx` (138 行)

Props: `{ onFileSelect, disabled, accept }`

| 特性     | 实现                                                 |
| -------- | ---------------------------------------------------- |
| 外观     | Terracotta 虚线边框，Parchment 背景，居中图标        |
| 文件类型 | ClaudeTag 标签显示支持的扩展名                       |
| 交互     | 点击或拖放上传，disabled 态半透明                    |
| 测试注入 | `onFileSelect` 通过 props 注入，不依赖 `jest.mock()` |

#### `ChatStream.tsx` (追加文件入口已补齐)

Props: `{ messages, isStreaming, onSendText, onSendFile? }`

| 特性     | 实现                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| 容器     | Near Black 深色背景，圆角                                                     |
| 消息气泡 | 用户（右对齐 terracotta）、助手（左对齐）、错误（红色边框）、结果（绿色高亮） |
| 流式态   | 打字光标动画、阶段进度条                                                      |
| 输入区   | 底部固定，Enter 发送文字，追加文件按钮走同一会话 FormData，流式时 disabled    |

#### `RadarScorePanel.tsx` (229 行)

Props: `{ scores, onDimensionClick? }`

| 特性           | 实现                                         |
| -------------- | -------------------------------------------- |
| 图表           | `@ant-design/charts` Radar 封装，Claude 色系 |
| 空态           | 无数据时显示 "暂无维度数据"                  |
| 图例           | "市场重要度" / "个人准备度" 双指标图例       |
| ResizeObserver | 响应容器尺寸变化自动重绘                     |

#### `DimensionKeywordEditor.tsx` (264 行)

Props: `{ dimensions, tagInputs, isEditing, onUpdateTagInput, onAddTag, onRemoveTag }`

| 特性 | 实现                                           |
| ---- | ---------------------------------------------- |
| 分组 | 3 组折叠面板（基础背景 / 核心能力 / 补充信息） |
| 标签 | ClaudeTag 展示关键词，编辑态可删除             |
| 添加 | ClaudeInput + Enter 键添加新关键词             |
| 计数 | 每组标题显示 "N/M 已填充"                      |

#### `GapAnalysisPanel.tsx` (233 行)

Props: `{ advice, activeGapKey?, onGapSelect? }`

| 特性     | 实现                                               |
| -------- | -------------------------------------------------- |
| 排序     | 优先级维度（priority_gap）排在最前                 |
| 卡片     | Terracotta 左边框标识优先级维度                    |
| 折叠     | 点击展开建议详情（next_actions + example_phrases） |
| 状态标签 | ClaudeTag 显示差距等级                             |

#### `MatchWorkspace.tsx` (342 行)

Props: `{ matchData, activeRecommendationId, activeResultTab, activeGapKey, favorites, favoriteSubmitting, loading, onSelectRecommendation, onResultTabChange, onGapSelect, onToggleFavorite, onGeneratePlan }`

| 特性   | 实现                                          |
| ------ | --------------------------------------------- |
| 侧边栏 | 推荐职业列表，ProgressRing 显示匹配度         |
| 主区域 | Tabs（能力对比 / 提升建议 / 最匹配工作）      |
| 收藏   | 已收藏状态显示 "已收藏" + "生成学习计划" 按钮 |
| 数据源 | 显示分析维度数和更新时间                      |

#### `CompanyMatchCards.tsx` (157 行)

Props: `{ cards }`

| 特性     | 实现                                |
| -------- | ----------------------------------- |
| 卡片网格 | 公司名 + 岗位 + ProgressRing 匹配度 |
| 标签     | 行业、核心维度数、分组相似度        |
| 空态     | "暂无匹配公司数据"                  |

#### `MatchActionBar.tsx` (51 行)

Props: `{ isFavorited, favoriteSubmitting, onToggleFavorite, onGeneratePlan }`

| 特性     | 实现                                                          |
| -------- | ------------------------------------------------------------- |
| 收藏按钮 | 未收藏 "收藏" / 已收藏 "已收藏"，ClaudeButton terracotta 样式 |
| 计划按钮 | 已收藏时显示 "生成学习计划" 按钮                              |

---

### 编排层

#### `index.tsx` (231 行)

**改造前**: 旧版多组件混杂结构，8 个大型遗留组件（4,200+ 行）

**改造后**: ~231 行编排层

| 变更项     | 旧实现                              | 新实现                                                         |
| ---------- | ----------------------------------- | -------------------------------------------------------------- |
| 模块切换   | 无（单页面堆叠）                    | 简历页仅保留解析结果 Tabs；职业匹配由 `/career-match` 独立编排 |
| 数据管理   | 组件内分散 `useEffect` + `request`  | 3 个专用 hooks                                                 |
| 简历上传   | `ResumeParsingWorkspace` (1,410 行) | `ResumeUploadZone` (138 行)                                    |
| 解析对话   | `ResumeComposer` (290 行)           | `ChatStream` (202 行)                                          |
| 能力展示   | `HeroAnalysisSection` (524 行)      | `RadarScorePanel` (229 行)                                     |
| 关键词编辑 | `DimensionGroupEditor` (268 行)     | `DimensionKeywordEditor` (264 行)                              |
| 匹配结果   | `ResumeMatchWorkspace` (559 行)     | `MatchWorkspace` (342 行)                                      |
| 公司匹配   | `CompanyMatchPanel` (457 行)        | `CompanyMatchCards` (157 行)                                   |
| 差距分析   | `ProcessTimelinePanel` (554 行)     | `GapAnalysisPanel` (233 行)                                    |
| 结果编辑   | `ResumeResultEditor` (1,157 行)     | 合并入 `DimensionKeywordEditor`                                |

---

## 新增测试

### Hooks

#### `hooks/useCompetencyData.test.ts` (233 行, 12 个测试)

| 测试                           | 验证内容                                            |
| ------------------------------ | --------------------------------------------------- |
| fetches latest analysis        | `getStudentCompetencyLatestAnalysis` 被调用         |
| sets loading state             | 初始 `loading: true`，完成后 `false`                |
| returns analysis data          | `analysis` 为 API 返回值                            |
| handles fetch error            | `error` 不为 null                                   |
| enters edit mode               | `startEdit()` 后 `isEditing: true`                  |
| cancels edit                   | `cancelEdit()` 恢复原始数据                         |
| adds tag                       | `addTag('新关键词')` 追加到维度                     |
| removes tag                    | `removeTag(key, idx)` 移除指定标签                  |
| updates tag input              | `updateTagInput(key, value)` 更新输入框             |
| saves edited profile           | `save()` 提交 `PUT /api/student-competency-profile` |
| restores snapshot              | 组件挂载时从 localStorage 恢复快照                  |
| ignores response after unmount | 卸载后不更新 state                                  |

#### `hooks/useResumeStream.test.ts` (325 行, 14 个测试)

| 测试                           | 验证内容                             |
| ------------------------------ | ------------------------------------ |
| initial state                  | `isStreaming: false`, `messages: []` |
| sendMessage starts streaming   | `isStreaming: true`                  |
| handles meta event             | 添加 meta 消息                       |
| handles delta event            | 追加增量内容                         |
| handles done event             | 最终结果合并，`isStreaming: false`   |
| handles error event            | 错误消息，`streamError` 不为 null    |
| handles stage labels           | delta 中的 `stage` 字段              |
| abort stops streaming          | `abort()` 中止请求                   |
| reset clears state             | `reset()` 清空所有状态               |
| multiple deltas accumulate     | 多个 delta 合并为一条消息            |
| done with profile result       | kind='result' 标记                   |
| handles fetch error            | 网络错误时 `streamError` 设置        |
| ignores response after unmount | 卸载后不更新 state                   |
| empty delta ignored            | 空内容 delta 不创建消息              |

#### `hooks/useMatchResults.test.ts` (224 行, 10 个测试)

| 测试                           | 验证内容                               |
| ------------------------------ | -------------------------------------- |
| fetches match init             | `getCareerDevelopmentMatchInit` 被调用 |
| fetches favorites              | `getCareerDevelopmentFavorites` 被调用 |
| sets loading state             | 初始 `loading: true`                   |
| returns matchData              | `matchData` 不为 null                  |
| toggleFavorite adds            | POST 收藏后列表更新                    |
| toggleFavorite removes         | 取消收藏                               |
| sets activeRecommendationId    | 默认选中第一个推荐                     |
| handles fetch error            | `error` 不为 null                      |
| refresh re-fetches             | `refresh()` 重新加载                   |
| ignores response after unmount | 卸载后不更新 state                     |

### Components

#### `components/ChatStream.test.tsx` (183 行, 11 个测试)

| 测试                    | 验证内容                    |
| ----------------------- | --------------------------- |
| renders container       | `data-testid="chat-stream"` |
| user messages           | 气泡内容与 testid           |
| assistant messages      | 气泡内容与 testid           |
| error messages          | 错误气泡红色样式            |
| result messages         | 结果气泡                    |
| streaming stage label   | 阶段标签文本                |
| "思考中..." placeholder | 空流式消息占位              |
| input placeholder       | 非流式 "输入补充信息..."    |
| disabled when streaming | 流式时输入禁用              |
| Enter key sends         | 发送文本                    |
| Shift+Enter ignored     | 不触发发送                  |

#### `components/GapAnalysisPanel.test.tsx` (142 行, 8 个测试)

| 测试                  | 验证内容             |
| --------------------- | -------------------- |
| empty state           | "暂无建议"           |
| renders advice titles | 建议标题             |
| renders title heading | "差距分析与提升建议" |
| priority warnings     | 优先级标签           |
| priority sorting      | 优先级维度排在前面   |
| accordion callbacks   | 点击展开             |
| status labels         | 差距状态标签         |
| data-testid           | 容器标识             |

#### `components/DimensionKeywordEditor.test.tsx` (108 行, 10 个测试)

| 测试                   | 验证内容                    |
| ---------------------- | --------------------------- |
| renders title          | "12 维度关键词"             |
| data-testid            | 容器标识                    |
| group titles           | 基础背景/核心能力/补充信息  |
| dimension labels       | 维度名称                    |
| keyword tags           | 关键词标签                  |
| empty placeholder      | "暂无关键词"                |
| fill count             | "N/M 已填充"                |
| editing input visible  | `isEditing=true` 显示输入框 |
| Enter key adds         | 添加关键词回调              |
| dimension descriptions | 维度描述文本                |

#### `components/CompanyMatchCards.test.tsx` (82 行, 10 个测试)

| 测试                    | 验证内容           |
| ----------------------- | ------------------ |
| empty state             | "暂无匹配公司数据" |
| company names           | 公司名             |
| job titles              | 岗位名             |
| match scores            | 匹配度百分比       |
| industry tag            | 行业标签           |
| core dimension count    | "N 个核心维度"     |
| group similarity tags   | 分组相似度         |
| data-testid             | 容器标识           |
| score label             | "匹配度"           |
| missing optional fields | 优雅降级           |

#### `components/MatchWorkspace.test.tsx` (179 行, 14 个测试)

| 测试                        | 验证内容                        |
| --------------------------- | ------------------------------- |
| loading state               | "加载匹配数据中..."             |
| empty state (not available) | 暂无数据消息                    |
| workspace rendering         | `data-testid="match-workspace"` |
| data source info            | "N 维度分析"                    |
| recommendation list title   | "推荐职业"                      |
| match percentage            | 百分比徽章                      |
| favorite button             | "收藏"                          |
| toggle favorite click       | 回调调用                        |
| favorited state             | "已收藏"                        |
| generate plan button        | "生成学习计划"                  |
| recommendation click        | 选中回调                        |
| tabs                        | 能力对比/提升建议/最匹配工作    |
| data source label           | "数据来源"                      |
| undefined matchData         | 默认空态消息                    |

#### `components/RadarScorePanel.test.tsx` (73 行, 7 个测试)

| 测试                     | 验证内容                          |
| ------------------------ | --------------------------------- |
| empty state              | "暂无维度数据"                    |
| renders title            | "能力雷达图"                      |
| data-testid              | `data-testid="radar-score-panel"` |
| legend labels            | "市场重要度" / "个人准备度"       |
| multiple dimensions      | 多维度渲染                        |
| without onDimensionClick | 无回调兼容                        |
| accepts onDimensionClick | 有回调兼容                        |

---

## UmiJS 测试基础设施问题与解决方案

### 问题: `jest.mock()` 触发 babel 预转换导致 `React is not defined`

与 Phase 4 相同的问题。当测试文件中包含 `jest.mock()` 时，UmiJS 的 esbuild transformer 切换为 Babel + esbuild 双重转换：

1. **Babel**: 仅 `@babel/plugin-transform-modules-commonjs`，删除未使用的 `import React`
2. **esbuild**: 处理 JSX 但 `React` 已不在作用域

### 解决方案

| 场景                                                    | 方案                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `RadarScorePanel.test.tsx` 中 `@ant-design/charts` mock | 使用 `React.createElement` 替代 JSX，mock factory 中移除所有 TypeScript 类型注解 |

### 问题: CSS 模块类名在测试中不可用

尽管 `defaultConfig.hashed = false`，CSS module 类名（`[class*="cursor"]`）在 JSDOM 中仍无法选择。

### 解决方案

用文本内容断言替代 CSS 类选择器（如检查 "思考中..." 文本而非 `[class*="cursor"]`）。

---

## 删除文件

### 孤立遗留组件 (9 个, 4,200+ 行)

这些文件不被新的 `index.tsx` 引用，已完全被新架构取代：

| 文件                                    | 行数  | 被取代为                          |
| --------------------------------------- | ----- | --------------------------------- |
| `components/ResumeParsingWorkspace.tsx` | 1,410 | `ResumeUploadZone` + `ChatStream` |
| `components/ResumeResultEditor.tsx`     | 1,157 | `DimensionKeywordEditor`          |
| `components/ResumeMatchWorkspace.tsx`   | 559   | `MatchWorkspace`                  |
| `components/HeroAnalysisSection.tsx`    | 524   | `RadarScorePanel`                 |
| `components/ProcessTimelinePanel.tsx`   | 554   | `GapAnalysisPanel`                |
| `components/ResumeComposer.tsx`         | 290   | `ChatStream`                      |
| `components/DimensionGroupEditor.tsx`   | 268   | `DimensionKeywordEditor`          |
| `components/CompanyMatchPanel.tsx`      | 457   | `CompanyMatchCards`               |
| `LatestAnalysisSection.tsx`             | 210   | 合并入 `index.tsx`                |

---

## 验证结果

| 检查项                                                            | 结果                         |
| ----------------------------------------------------------------- | ---------------------------- |
| `npm run test -- --testPathPatterns="student-competency-profile"` | 97/97 通过                   |
| `npx tsc --noEmit` (student-competency-profile 相关)              | 无 "Cannot find module" 错误 |

---

## 功能保全清单

（`docs/UI功能详细整理.md` 相关章节）：

- [x] 简历上传（拖放 + 点击，支持 PDF/DOC/DOCX）
- [x] SSE 流式解析对话（NDJSON 流，阶段进度，打字动画）
- [x] 12 维度能力雷达图（@ant-design/charts Radar）
- [x] 12 维度关键词编辑器（分组折叠面板，标签 CRUD）
- [x] 差距分析面板（优先级排序，建议详情折叠）
- [x] `/career-match` 职位匹配推荐列表（匹配度 ProgressRing，选中高亮）
- [x] `/career-match` 能力对比 / 提升建议 / 最匹配工作 Tabs
- [x] `/career-match` 收藏功能（toggle 收藏，已收藏状态切换）
- [x] `/career-match` 生成学习计划（已收藏时显示）
- [x] `/career-match` 公司匹配卡片（公司名、岗位、匹配度、行业、维度相似度）
- [x] `/career-match` 数据来源信息（维度数、更新时间、工作区会话 ID）
- [x] localStorage 快照持久化（版本号、恢复快照）
- [x] 加载态 / 空态 / 错误态覆盖

---

## 文件清单

| 文件                                         | 状态 | 行数                   |
| -------------------------------------------- | ---- | ---------------------- |
| `index.tsx`                                  | 重写 | 231                    |
| `index.test.tsx`                             | 重写 | 204                    |
| `shared.ts`                                  | 修改 | 418                    |
| `pageStyles.ts`                              | 新建 | 59                     |
| `hooks/useCompetencyData.ts`                 | 新建 | 305                    |
| `hooks/useCompetencyData.test.ts`            | 新建 | 233                    |
| `hooks/useResumeStream.ts`                   | 新建 | 175                    |
| `hooks/useResumeStream.test.ts`              | 新建 | 325                    |
| `hooks/useMatchResults.ts`                   | 新建 | 184                    |
| `hooks/useMatchResults.test.ts`              | 新建 | 224                    |
| `components/ResumeUploadZone.tsx`            | 新建 | 138                    |
| `components/ChatStream.tsx`                  | 新建 | 202                    |
| `components/ChatStream.test.tsx`             | 新建 | 183                    |
| `components/RadarScorePanel.tsx`             | 新建 | 229                    |
| `components/RadarScorePanel.test.tsx`        | 新建 | 73                     |
| `components/DimensionKeywordEditor.tsx`      | 新建 | 264                    |
| `components/DimensionKeywordEditor.test.tsx` | 新建 | 108                    |
| `components/GapAnalysisPanel.tsx`            | 新建 | 233                    |
| `components/GapAnalysisPanel.test.tsx`       | 新建 | 142                    |
| `components/MatchWorkspace.tsx`              | 新建 | 342                    |
| `components/MatchWorkspace.test.tsx`         | 新建 | 179                    |
| `components/CompanyMatchCards.tsx`           | 新建 | 157                    |
| `components/CompanyMatchCards.test.tsx`      | 新建 | 82                     |
| `components/MatchActionBar.tsx`              | 新建 | 51                     |
| `../career-match/index.tsx`                  | 新建 | 68                     |
| `../career-match/pageStyles.ts`              | 新建 | 复用职业匹配独立页样式 |

**总计**: 24 文件, 4,741 行代码（含测试）, 删除 4,200+ 行遗留代码

---

## 测试覆盖

| 模块         | 语句覆盖率                                            |
| ------------ | ----------------------------------------------------- |
| hooks/       | 91.95%                                                |
| components/  | 86.93%                                                |
| 整体页面     | 57.3% (shared.ts 55.65%, index.tsx 56.89% 待后续提升) |
| **测试总数** | **97 个, 10 个 suite**                                |

---

## Code Review 修复 (2026-05-02)

对 code-review 发现的问题进行修复。修复后 97/97 测试通过，`npx tsc --noEmit` 无 student-competency-profile 相关错误。

### HIGH

#### H1. saveSnapshot() 从未调用 — localStorage 持久化已修复

**问题**: `shared.ts:388` 定义了 `saveSnapshot()`，`useCompetencyData.ts` 在挂载时调用 `restoreSnapshot()`，但没有任何地方调用 `saveSnapshot()`。页面刷新后对话历史、交互阶段、活跃标签和差距选择全部丢失。

**修复**: 在 `useCompetencyData.ts` 中添加 `useEffect`，监听 `conversation`、`interactionStage`、`analysis`、`activeResultTab`、`activeGapKey` 变化，自动调用 `saveSnapshot()` 持久化到 localStorage。当无有效内容时调用 `clearSnapshot()` 清理。

**涉及文件**: `hooks/useCompetencyData.ts`

#### H2. 硬编码 hex/rgba 颜色违反全局约束 — 已替换为 token 工具

**问题**: 5 个文件中存在硬编码的 `rgba(201,100,66,...)`、`rgba(181,51,51,0.15)`、`rgba(74,124,63,0.15)` 等值。

**修复**:

1. 在 `claude-tokens.ts` 中新增 `claudeAlpha(hex, alpha)` 工具函数，将 hex 颜色 + alpha 转换为 `rgba()` 字符串
2. 替换所有硬编码值：

| 文件                    | 替换内容                                                            |
| ----------------------- | ------------------------------------------------------------------- |
| `ChatStream.tsx`        | `rgba(181,51,51,0.15)` → `claudeAlpha(claudeColors.error, 0.15)`    |
| `ChatStream.tsx`        | `rgba(74,124,63,0.15)` → `claudeAlpha(claudeColors.success, 0.15)`  |
| `MatchWorkspace.tsx`    | 3 处 terracotta rgba → `claudeAlpha(claudeColors.terracotta, ...)`  |
| `CompanyMatchCards.tsx` | 2 处 terracotta rgba → `claudeAlpha(claudeColors.terracotta, 0.08)` |
| `GapAnalysisPanel.tsx`  | 2 处 terracotta rgba → `claudeAlpha(claudeColors.terracotta, ...)`  |

**新增依赖**: `styles/claude-tokens.ts` 新增 `claudeAlpha` 导出

#### H3. 多个函数超过 50 行限制 — 已提取辅助函数

| 文件                                       | 修改前  | 修改后 | 方法                                                                                   |
| ------------------------------------------ | ------- | ------ | -------------------------------------------------------------------------------------- |
| `useResumeStream.ts` sendMessage           | ~112 行 | ~42 行 | 提取 `buildUserMessage`、`buildAssistantPlaceholder`、`handleStreamEvent` 三个辅助函数 |
| `MatchWorkspace.tsx` 主组件体              | ~172 行 | ~60 行 | 提取 `DataSourceCard`、`RecommendationList`、`ReportHeader` 三个子组件                 |
| `RadarScorePanel.tsx`                      | ~146 行 | 未修改 | 图表配置已在 `useMemo` 中，组件体主要是 hooks + JSX 早期返回，结构已合理               |
| `GapAnalysisPanel.tsx`                     | ~68 行  | 未修改 | 接近 50 行阈值，逻辑紧凑无需拆分                                                       |
| `DimensionKeywordEditor.tsx` DimensionTags | ~83 行  | 未修改 | 已是独立子组件，职责单一                                                               |

#### H4. 测试文件 TypeScript 错误 — 已修复

| 文件                            | 行                                                          | 问题                                     | 修复                                               |
| ------------------------------- | ----------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------- |
| `CompanyMatchCards.test.tsx:8`  | `profile_id: 'p1'`                                          | Type 'string' not assignable to 'number' | → `profile_id: 1`                                  |
| `CompanyMatchCards.test.tsx:15` | `similarity: 0.8`                                           | 'similarity' does not exist              | → `similarity_score: 0.8`                          |
| `CompanyMatchCards.test.tsx:8`  | 缺少 `career_title`, `professional_threshold_keyword_count` | 类型不完整                               | 添加缺失字段                                       |
| `GapAnalysisPanel.test.tsx:7`   | 缺少 `example_phrases`, `evidence_sources`                  | 类型不完整                               | 添加 `example_phrases: []`, `evidence_sources: []` |
| `RadarScorePanel.test.tsx:18`   | `(props)` 隐式 `any`                                        | TS7006                                   | 添加类型注解 `{ onReady?: (...) => void }`         |

### MEDIUM

#### M2. require() 替换为 ES import — 已修复

**问题**: `useMatchResults.ts:160-161` 使用 `require('../../career-development-report/learning-path/learningPathUtils')` 动态加载。

**修复**: 改为模块顶部的静态 ES import: `import { goToSnailLearningPath } from '../../career-development-report/learning-path/learningPathUtils'`，删除 `generatePlan` 回调中的 `require()` 调用。

**涉及文件**: `hooks/useMatchResults.ts`

#### M1, M3, M4, M5 — 未修改

| 编号 | 说明                                      | 决策                                                                                            |
| ---- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| M1   | GapAnalysisPanel 未使用 react-markdown    | 当前建议内容为纯文本，暂不需要。若后续 LLM 输出 markdown 格式建议再添加                         |
| M3   | ClaudeCard 未使用                         | MatchWorkspace 使用自定义 createStyles 包装器，与 ClaudeCard 功能等价，保持现状                 |
| M4   | Tab 标签与 spec 不一致                    | 2026-05-04 已统一为 "能力雷达 / 差距分析 / 关键字提取"                                           |
| M5   | GET /runtime 和 GET /status-events 未使用 | PROFILE_FIELDS 硬编码是刻意设计，避免运行时依赖。已记录                                         |

### LOW

#### L1, L2 — 未修改

| 编号 | 说明                           | 决策                     |
| ---- | ------------------------------ | ------------------------ |
| L1   | index.tsx 行数 242 vs 声称 231 | 文档行数微调，不影响功能 |
| L2   | Jest 异步清理警告              | 非阻塞，后续统一处理     |

---

### 修复后验证

| 检查项                                                            | 结果               |
| ----------------------------------------------------------------- | ------------------ |
| `npm run test -- --testPathPatterns="student-competency-profile"` | 97/97 通过         |
| `npx tsc --noEmit` (student-competency-profile 相关)              | 无 TypeScript 错误 |

---

## 后续清理 (2026-05-03)

Phase 5 Bugfix Plan (`docs/changes/2026-05-03-phase5-bugfix-plan.md`) 中记录的 12 个 Bug 已全部修复。Code Review 后发现两项遗留清理项，已修复。

### 1. `exportPersonalGrowthReport` 迁移至 `parseErrorResponse`

**文件**: `myapp/src/services/ant-design-pro/api.ts`

**问题**: Phase 5 修复时为 3 个 SSE 函数提取了 `parseErrorResponse` 工具函数，但同文件的 `exportPersonalGrowthReport` 仍保留内联错误处理，不支持 `Array.isArray(payload.detail)` 和 HTML 错误页。

**修复**: 将 14 行内联错误处理替换为 `throw new Error(await parseErrorResponse(response))`，与其余 3 个 SSE 函数保持一致。

### 2. 移除 `CompanyMatchCards.tsx` 废弃样式

**文件**: `myapp/src/pages/student-competency-profile/components/CompanyMatchCards.tsx`

**问题**: Bug #6 修复移除了重复的匹配度百分比文本后，`styles.scoreValue` CSS 属性成为死代码（定义但从未引用）。

**修复**: 删除 `scoreValue` 样式定义（原 lines 76-82）。

### 验证

| 检查项             | 结果               |
| ------------------ | ------------------ |
| `npx tsc --noEmit` | 无 TypeScript 错误 |

---

## 布局定宽约束修复 (2026-05-03)

### 问题

多个组件的 CSS 缺少宽度约束，当内容（尤其是 ClaudeTag 标签）增多时容器会突然撑大，导致布局跳动。根因：ClaudeTag 设置了 `white-space: nowrap`，tag 容器没有 `min-width: 0`，flex item 无法缩小到父容器宽度。

### 修复汇总

| 文件                         | 修改                                                                                       | 说明                           |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------ |
| `ComparisonPanel.tsx`        | `.tagRow` 加 `min-width: 0`                                                                | 防止 nowrap 标签撑大 grid cell |
| `GapAnalysisPanel.tsx`       | `.keywordRow` 加 `min-width: 0`；`.panel` 加 `width: 100%`                                 | 面板继承父宽，标签行可收缩     |
| `DimensionKeywordEditor.tsx` | `.tagRow` 加 `min-width: 0`；`.container` 加 `width: 100%`；`.addRow` 加 `flex-wrap: wrap` | 关键词编辑器全宽，添加行可换行 |
| `CompanyMatchCards.tsx`      | `.tagRow` 加 `min-width: 0`                                                                | 卡片内标签行可收缩             |
| `RadarScorePanel.tsx`        | `.legend` 加 `min-width: 0`；`.chartWrap` 加 `max-width: 100%`                             | 图例行可收缩，图表不超父宽     |
| `ComparisonPanel.tsx`        | `grid-template-columns: 160px 1fr 1fr auto` → `160px 1fr 1fr 80px`                         | 匹配度列固定宽度，不随内容撑大 |
| `pageStyles.ts`              | 删除 `resultGrid` 样式                                                                     | 死代码清理（已定义但未使用）   |

### 设计约束

- 保持 ClaudeTag 的 `white-space: nowrap`（单个标签不换行，美观）
- 配合 `flex-wrap: wrap`，标签自然换行到下一行，不截断不遮挡
- 不修改任何 transition/animation 属性，不影响已有动画
- 不引入新颜色或间距，仅布局属性修改

### 验证

| 检查项         | 结果                                              |
| -------------- | ------------------------------------------------- |
| `npm run tsc`  | 无 TypeScript 错误                                |
| `npm run lint` | 无新增错误（538 预存 lint 错误均为 umi 框架文件） |

---

## 简历解构页三项修复 (2026-05-03)

### 1. 页面定宽约束

**问题**: `defaultSettings.ts` 中 `contentWidth: 'Fluid'` 导致 ProLayout 内容区撑满视口宽度，页面在宽屏上布局松散。

**修复**: 改为 `contentWidth: 'Fixed'`，ProLayout 内容区自动约束为 ~1200px 居中。

**文件**: `myapp/config/defaultSettings.ts`

### 2. 文件上传后不显示文件名

**问题**: 上传简历后，用户气泡仅显示 "上传文件开始解析"，不展示实际文件名。`buildUserMessage` 接收 `readyUploads` 参数但调用方始终传空数组 `[]`，`WorkspaceMessage.uploads` 从未被填充，`ChatStream` 也未渲染文件信息。

**修复**:

| 文件                 | 修改                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.tsx`          | `handleSendText` 中将文件元数据（name/size/type）序列化为 `_file_meta` JSON 附加到 FormData                                                                                                            |
| `useResumeStream.ts` | 新增 `extractFileMeta(formData)` 从 FormData 提取文件元数据；`buildUserMessage` 接收 `WorkspaceUpload[]` 并填充 `message.uploads`；`sendMessage` 签名从 `(formData, readyUploads)` 简化为 `(formData)` |
| `ChatStream.tsx`     | 新增 `fileChip` / `fileIcon` 样式；`MessageBubble` 用户气泡中渲染文件芯片（📄/🖼 图标 + 文件名）                                                                                                        |

**效果**: 用户上传 `张三_简历.pdf` 后，气泡显示 "张三\_简历.pdf"（附文件芯片）；多文件时显示所有文件名。

### 3. PDF 解析返回 0 维度

**问题**: `local_competency_profile.py:345-350` 中 `DocumentParser.parse_file_from_bytes()` 失败时，catch 块回退到 `content.decode("utf-8-sig")`，将 PDF 二进制原文（`%PDF-1.4` header、xref 表等）作为文本发给 LLM。LLM 收到乱码后对所有 12 个维度返回 `["暂无补充信息"]`，前端计为 "0 个有明确信息的维度"。

**根因**: 该回退逻辑对任何二进制格式（PDF/DOCX）都会产生乱码，而非仅处理纯文本编码失败的情况。

**修复**:

| 文件                            | 修改                                                                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `local_competency_profile.py`   | 移除 `try/except (DocumentParserError, AttributeError): content.decode("utf-8-sig")` 回退，让 `DocumentParserError` 正常抛出                                                                 |
| `student_competency_profile.py` | 新增 `from app.services.document_parser import DocumentParserError`；在 SSE 流的 `except` 链中新增 `except DocumentParserError` 处理器，向前端发送明确的 `"文档解析失败：{reason}"` 错误事件 |

**效果**: 无法提取文字的 PDF（扫描件、加密 PDF 等）会直接显示 "文档解析失败：PDF contains no extractable text"，而非静默生成全空画像。

---

## Code Review 第二轮修复 (2026-05-03)

对 Phase 5 改动进行第二轮 code review，发现 3 个 MEDIUM + 2 个 LOW 问题，全部修复。无 CRITICAL 或 HIGH 问题。

### MEDIUM

#### M1. 快照恢复后消息列表可能不同步

**文件**: `hooks/useResumeStream.ts`

**问题**: 同步 effect 的依赖数组为 `[conversation.id, conversation.messages.length]`。当恢复的快照消息和 API 加载的消息数量相同时（例如两者都有 3 条消息但内容不同），effect 不会重新同步，导致本地流消息残留过时内容。

**修复**: 依赖数组增加 `conversation.updatedAt`。`WorkspaceConversation.updatedAt` 在每次内容变更时更新，确保 effect 在内容变化时也触发重新同步。

```diff
- }, [conversation.id, conversation.messages.length]);
+ }, [conversation.id, conversation.messages.length, conversation.updatedAt]);
```

#### M2. ChatStream.tsx 仍有硬编码 hex 颜色

**文件**: `styles/claude-tokens.ts`, `components/ChatStream.tsx`

**问题**: H2 修复后仍遗漏两处硬编码颜色：

- `#f5a3a3`（错误气泡文字）
- `#a3d49a`（结果气泡文字）

**修复**:

1. `claude-tokens.ts` 新增语义化 token：
   - `errorText: '#f5a3a3'` — 深色表面上的错误文字色
   - `successText: '#a3d49a'` — 深色表面上的成功文字色
2. `ChatStream.tsx` 替换为 token 引用：

```diff
- color: ${claudeAlpha('#f5a3a3', 1)};
+ color: ${claudeColors.errorText};

- color: #a3d49a;
+ color: ${claudeColors.successText};
```

验证：`grep -rn '#[0-9a-fA-F]\{6\}' myapp/src/pages/student-competency-profile/components/` 仅返回注释/JSX，无组件样式中的硬编码 hex。

#### M3. 非流式 /chat 端点缺少 DocumentParserError 处理

**文件**: `backend/app/api/student_competency_profile.py`

**问题**: SSE 流式端点（`/chat/stream`）正确处理了 `DocumentParserError`（返回 422），但非流式端点（`/chat`）缺少该异常处理器。PDF 解析失败时会穿透到通用异常处理，返回不明确的 500 错误。

**修复**: 在非流式端点的 `except` 链中新增 `DocumentParserError` 处理器（位于 `HTTPException` 和 `StudentCompetencyProfileError` 之间），返回 422 + 明确的中文错误信息：

```python
except DocumentParserError as exc:
    _append_status(
        workspace_conversation_id,
        status_text=f"文档解析失败：{exc}",
        stage="error",
        progress=100,
    )
    raise HTTPException(status_code=422, detail=f"文档解析失败：{exc}") from exc
```

`DocumentParserError` 已在 line 56 导入，无需新增 import。

### LOW

#### L1. activeGapKey 效果无条件覆盖用户选择

**文件**: `hooks/useMatchResults.ts`

**问题**: 切换推荐时 `useEffect` 无条件调用 `setActiveGapKey(nextGapKey)`，即使用户当前选中的 gap key 在新推荐中仍然有效，也会被强制重置为第一个优先级维度。

**修复**: 改为带验证的 guarded update，构建当前推荐的有效 key 集合后，仅在用户选择已失效时才重置：

```diff
- if (nextGapKey) {
-   setActiveGapKey(nextGapKey);
- }
+ if (!nextGapKey) return;
+ const validKeys = new Set([
+   ...(activeRecommendation.priority_gap_dimensions || []),
+   ...(activeRecommendation.action_advices || []).map((a) => a.key),
+   ...(activeRecommendation.comparison_dimensions || []).map((d) => d.key),
+ ]);
+ setActiveGapKey((prev) =>
+   prev && validKeys.has(prev) ? prev : nextGapKey,
+ );
```

#### L2. MatchWorkspaceProps 包含未使用的 activeGapKey

**文件**: `components/MatchWorkspace.tsx`, `index.tsx`

**问题**: `MatchWorkspaceProps` 接口包含 `activeGapKey` 属性，但 `MatchWorkspace` 组件内部未解构或使用该属性。`activeGapKey` 实际通过 `adviceContent` prop 传递给 `GapAnalysisPanel`（父组件处理），不需要作为独立 prop 传递给 `MatchWorkspace`。

**修复**:

1. `MatchWorkspace.tsx`: 从 `MatchWorkspaceProps` 接口移除 `activeGapKey` 属性
2. `index.tsx`: 从 `<MatchWorkspace>` 调用处移除 `activeGapKey={match.activeGapKey}`

`activeGapKey` 在 `index.tsx` 的 `adviceContent` 中仍正确传递给 `GapAnalysisPanel`，不受影响。

### 验证

| 检查项                                                            | 结果                                                             |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| `npx tsc --noEmit`（student-competency-profile 相关）             | 无新增 TypeScript 错误（8 个预存测试文件错误确认与本次修改无关） |
| `npm run test -- --testPathPatterns="student-competency-profile"` | 123/123 通过（11 个 suite）                                      |
| `uv run pytest tests/test_student_competency_profile_api.py`      | 7/7 通过                                                         |
