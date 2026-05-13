# Phase 3: Auth Pages (登录 + 注册)

> 日期: 2026-05-02
> 计划来源: `docs/superpowers/specs/2026-05-01-frontend-redesign-plan.md`
> 前置依赖: Phase 1 (Design System Foundation) + Phase 2 (Shared UI Components)
> 修订: 第二轮 code review 修复（2026-05-02）

---

## 概述

将登录/注册页面改造为 Claude 分屏布局，使用 Phase 2 的组件库替换原生 antd 表单组件，新增密码强度指示器和自定义步骤指示器。第二轮修复补全了 framer-motion 入场动画并消除了代码重复。

### 2026-05-04 功能保全补修

- `记住登录` 从纯 UI 勾选补为实际存储策略：勾选时 token 写入 `localStorage`，不勾选时写入 `sessionStorage`，登出/401 清理两处存储。
- 注册 Step 2 的 `学历`、`年级` 改为下拉选择，和 `目标岗位` 一起满足基础信息下拉要求。
- 注册 Step 3 改为 `Upload.Dragger` 拖拽上传区，继续限制 `jpg/jpeg/png/webp` 简历图片。

---

## 修改文件

### `src/components/ui/BrandPanel/index.tsx`（新增）

从登录/注册页提取的共享品牌左面板组件。导出 `BrandPanel` 组件和 `BRAND_FEATURES` 常量。包含 Logo、serif 标题、特性列表、版权信息和装饰圆。

### `src/pages/user/auth-test-utils.ts`（新增）

共享测试工具文件。导出 mock 函数（`mockedLogin` 等）、`localStorageMock`、`createMockLocation` 和 `resetAllMocks()`。

### `src/pages/user/login/index.tsx`

**改造前**: 427 行，使用 antd `Input`/`Input.Password`/`Button`

**改造后**: ~340 行

| 变更项                  | 旧实现                                    | 新实现                                                     |
| ----------------------- | ----------------------------------------- | ---------------------------------------------------------- |
| 用户名输入              | antd `Input`                              | `ClaudeInput` from `@/components/ui`                       |
| 密码输入                | antd `Input.Password`                     | `ClaudePassword` from `@/components/ui`                    |
| 登录按钮                | antd `Button` type="primary"              | `ClaudeButton` variant="terracotta"                        |
| 品牌标题                | CSS class `.auth-left-title`              | 新增 `claudeFonts.heading` serif 字体栈                    |
| 忘记密码链接            | 无 data-testid                            | 新增 `data-testid="forgot-password-link"`                  |
| Input autofill override | `createStyles` 内手动覆盖 WebkitBoxShadow | 移除（由 ClaudeInput 内部处理）                            |
| 左面板                  | 内联 JSX + FEATURES 常量                  | `<BrandPanel />` 组件                                      |
| 入场动画                | 无                                        | framer-motion fade+slide up（标题 0ms，副标题 200ms 延迟） |

**保留不变**: `.auth-root`/`.auth-left`/`.auth-right` 分屏布局结构、API 调用 (`/api/login/account`)、记住登录、忘记密码、跳转注册、成功后跳转逻辑、Helmet title。

### `src/pages/user/register/index.tsx`

**改造前**: 401 行，居中卡片布局 + antd `Steps`/`Input`/`Select`/`Button`/`Upload`

**改造后**: ~360 行

| 变更项       | 旧实现               | 新实现                                                                       |
| ------------ | -------------------- | ---------------------------------------------------------------------------- |
| 布局         | 居中卡片（无分屏）   | `.auth-root`/`.auth-left`/`.auth-right` 分屏（与登录一致）                   |
| 步骤指示器   | antd `Steps` 组件    | 自定义 serif 数字圆圈 + `data-testid="step-indicator"`                       |
| 表单输入     | antd `Input`         | `ClaudeInput` / `ClaudePassword` / `ClaudeSelect`                            |
| 操作按钮     | antd `Button`        | `ClaudeButton` (terracotta / ghost)                                          |
| 密码强度     | 无                   | 新增密码强度条 + 标签，`data-testid="password-strength"`                     |
| 简历上传     | 基础 antd `Upload`   | Terracotta dashed 边框上传区 + `data-testid="resume-upload-zone"`            |
| 品牌左面板   | 无                   | `<BrandPanel />` 组件（与登录共享）                                          |
| 步骤切换动画 | 无                   | framer-motion `AnimatePresence mode="wait"` + slide（x: 24 → 0 / exit: -24） |
| 错误处理类型 | `catch (error: any)` | `catch (error: unknown)` + 安全收窄                                          |

**保留不变**: 三步表单逻辑、字段校验（密码 >= 8 位、必填检查）、API 调用（`/api/register` -> `/api/login/account` -> `/api/user-profile/onboarding`）、目标岗位下拉数据来自 `GET /api/job-postings/job-titles`、注册成功后自动登录并跳转 `/home-v2`。

**2026-05-04 补充**: Step 2 的学历/年级也使用下拉控件；Step 3 使用拖拽上传区，支持拖放或点击选择图片。

---

## 新增测试

### `src/pages/user/login/login.test.tsx`

**改造前**: 5 个测试（混合登录+注册）

**改造后**: 8 个测试（仅登录页）

| 测试                | 验证内容                                        |
| ------------------- | ----------------------------------------------- |
| split-screen layout | `.auth-root` 包含 `.auth-left` 和 `.auth-right` |
| serif title         | "大学生职业规划智能体" 存在且字体为 serif       |
| product features    | 三个特性文案正确渲染                            |
| form fields         | `#username`、`#password` 输入框存在             |
| register link       | 点击跳转 `/user/register`                       |
| admin redirect      | admin 登录后跳转 `/admin/job-postings`          |
| user redirect       | 普通用户登录后跳转 `/home-v2`                   |
| remember & forgot   | checkbox 和忘记密码链接存在                     |

### `src/pages/user/register/register.test.tsx`（新增）

10 个测试，从原 `login.test.tsx` 中拆分并扩展。mock 函数从 `../auth-test-utils` 导入：

| 测试                | 验证内容                                           |
| ------------------- | -------------------------------------------------- |
| split-screen layout | `.auth-root` 分屏结构                              |
| serif title         | 品牌标题 serif 字体                                |
| step indicator      | `data-testid="step-indicator"` 含数字 1/2/3 和标签 |
| step 1 fields       | 用户名 + 密码输入框                                |
| password strength   | 输入密码后 `data-testid="password-strength"` 可见  |
| step navigation     | 步骤间前进/后退 + 上一步按钮                       |
| step 2 fields       | 姓名/学校/专业/学历/年级/目标岗位                  |
| step 3 upload       | `data-testid="resume-upload-zone"` + 完成注册按钮  |
| full flow           | 完整注册 -> API 调用 -> 跳转 `/home-v2`            |
| back to login       | "返回登录" 链接存在                                |

---

## 验证结果

| 检查项                  | 结果                          |
| ----------------------- | ----------------------------- |
| `npm test` (pages/user) | 18/18 通过                    |
| `npm run tsc`           | 无错误                        |
| `npm run build`         | 通过（20 个页面全部编译成功） |

---

## 功能保全清单

**登录页**（`docs/UI功能详细整理.md` section 1）：

- [x] 用户名 + 密码登录
- [x] 记住登录
- [x] 忘记密码
- [x] 跳转到注册页

**注册页**（`docs/UI功能详细整理.md` section 2）：

- [x] Step 1：用户名、密码（最少 8 位）
- [x] Step 2：姓名、学校、专业、学历、年级、目标岗位（下拉选择，数据来自 API）
- [x] Step 3：上传简历图片（jpg/jpeg/png/webp）
- [x] 注册完成后自动登录并跳转到 `/home-v2`

---

## Code Review 修复（第二轮）

### HIGH #1: 补全 framer-motion 入场动画（Spec §3.1, §3.2）

**问题**: 登录/注册页面均未使用 framer-motion，入场动画和步骤切换动画缺失。

**修复**:

| 页面           | 动画要求                | 实现方式                                                                             |
| -------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| 登录页标题     | fade + slide up         | `motion.div` with `initial: { opacity: 0, y: 16 }` → `animate: { opacity: 1, y: 0 }` |
| 登录页副标题   | 200ms 延迟后跟入        | 同上，`transition.delay: 0.2`                                                        |
| 注册页步骤切换 | AnimatePresence + slide | `AnimatePresence mode="wait"` + `motion.div` with `x: 24` → `x: 0` / exit `x: -24`   |

两处均检测 `prefers-reduced-motion`：用户开启时直接渲染无动画的 `div`，跳过所有 motion 属性。

### MEDIUM #2: `catch (error: any)` → `catch (error: unknown)`

**文件**: `register/index.tsx:278`

**修复**: 改为 `catch (error: unknown)` 并通过 `as` 断言安全收窄，与 login 页保持一致。

### MEDIUM #3: 提取共享 BrandPanel 组件

**问题**: 登录页有 `FEATURES` 常量，注册页内联相同数组。整个左面板 JSX 在两个文件间复制粘贴。

**修复**:

- 新建 `src/components/ui/BrandPanel/index.tsx`，导出 `BrandPanel` 组件和 `BRAND_FEATURES` 常量
- 登录/注册页均改为 `<BrandPanel />`，移除各自内联的品牌面板代码
- 登录页删除 `FEATURES` 常量和 `brandTitle` style

### MEDIUM #4: 统一 data-testid 命名

**修复**: 注册页 auth-card 的 data-testid 从 `register-page-title` 改为 `register-form-card`，与登录页 `login-form-card` 命名模式一致。

### LOW #5: 硬编码 `#FFFFFF`

**状态**: 保留。`#FFFFFF` 用于 terracotta 背景上的白色图标，视觉意图明确。已统一到 `BrandPanel` 组件中，单一维护点。

### LOW #6: 提取共享测试工具

**修复**: 新建 `src/pages/user/auth-test-utils.ts`，导出：

- `mockedLogin`, `mockedCurrentUser`, `mockedRegister`, `mockedSubmitOnboardingProfile`, `mockedGetJobTitleOptions`
- `localStorageMock`, `createMockLocation`
- `resetAllMocks()`

两个测试文件均改为从 `../auth-test-utils` 导入共享 mock 函数和工具，`jest.mock()` 调用保留在各测试文件内（因 sandbox 作用域限制）。

### 新增文件

| 文件                                     | 用途                     |
| ---------------------------------------- | ------------------------ |
| `src/components/ui/BrandPanel/index.tsx` | 共享品牌左面板组件       |
| `src/pages/user/auth-test-utils.ts`      | 共享测试 mock 函数和工具 |

### 验证结果

| 检查项                                     | 结果       |
| ------------------------------------------ | ---------- |
| `npm run tsc`                              | 无错误     |
| `npx jest --testPathPatterns="pages/user"` | 18/18 通过 |

---

## 视觉验收结果（2026-05-02）

**验收方式**: Playwright MCP 浏览器交互 + 截图
**验收环境**: 前端 localhost:8000, 后端 localhost:9100
**截图目录**: `docs/images/test/Phase3/`

### 截图清单

| 文件                                          | 内容                         |
| --------------------------------------------- | ---------------------------- |
| `phase3-login-full-page.png`                  | 登录页全页截图               |
| `phase3-login-brand-panel.png`                | 登录页左侧品牌面板           |
| `phase3-login-form.png`                       | 登录页右侧表单区域           |
| `phase3-register-step1-full.png`              | 注册页 Step 1 全页           |
| `phase3-register-step1-password-strength.png` | 注册页 Step 1 密码强度展示   |
| `phase3-register-step2-full.png`              | 注册页 Step 2 全页（空表单） |
| `phase3-register-step2-filled.png`            | 注册页 Step 2 填写后         |
| `phase3-register-step3-full.png`              | 注册页 Step 3 全页           |

### 验收标准逐项检查

| 检查项                         | 结果    | 说明                                                      |
| ------------------------------ | ------- | --------------------------------------------------------- |
| 分屏布局（左右结构）           | ✅ PASS | 登录/注册均采用 `.auth-root` 分屏布局                     |
| 分屏比例 ~40:60                | ✅ PASS | 左侧品牌面板约占 40%，右侧表单约占 60%                    |
| 左半屏 Parchment 背景          | ✅ PASS | 品牌面板为暖色调 Parchment 背景                           |
| 左半屏 serif 标题              | ✅ PASS | "大学生职业规划智能体" 使用 serif 字体                    |
| 左半屏 Olive Gray 副标题       | ✅ PASS | "你的 AI 职业导师" 副标题存在                             |
| 左半屏 terracotta 装饰圆       | ✅ PASS | 品牌面板右下角可见 terracotta 装饰圆                      |
| 左半屏特性列表（3 项）         | ✅ PASS | 三个特性文案（智能职业规划、成长报告、能力图谱）正确显示  |
| 左半屏版权信息                 | ✅ PASS | "© 2026 CareerAgent. 保留所有权利。"                      |
| 右半屏 ClaudeInput 用户名      | ✅ PASS | 用户名输入框带 user 图标                                  |
| 右半屏 ClaudePassword 密码     | ✅ PASS | 密码输入框带 lock 图标 + 眼睛可见/隐藏切换                |
| ClaudeButton terracotta "登录" | ✅ PASS | 登录按钮为 terracotta 色                                  |
| "记住登录" checkbox            | ✅ PASS | 存在且可勾选                                              |
| "忘记密码？" 链接              | ✅ PASS | 存在                                                      |
| "还没有账户？立即注册" 链接    | ✅ PASS | 存在，可跳转注册页                                        |
| 注册页 Step 1: 用户名+密码     | ✅ PASS | 用户名和密码输入框均存在                                  |
| 注册页 Step 1: 密码强度条      | ✅ PASS | 输入密码后显示密码强度指示器                              |
| 注册页步骤指示器（1/2/3）      | ✅ PASS | 自定义 serif 数字圆圈，已完成步骤显示 ✓                   |
| 注册页 Step 2: 姓名/学校/专业  | ✅ PASS | 三个输入框均存在                                          |
| 注册页 Step 2: 学历/年级       | ✅ PASS | 两个输入框均存在                                          |
| 注册页 Step 2: 目标岗位下拉    | ✅ PASS | ClaudeSelect 下拉，数据来自 API（C/C++、Java、Python 等） |
| 注册页 Step 3: 简历上传区      | ✅ PASS | 上传区存在，支持 JPG/JPEG/PNG/WEBP                        |
| 注册页 Step 3: "完成注册" 按钮 | ✅ PASS | 按钮存在                                                  |
| 注册页 "返回登录" 链接         | ✅ PASS | 两个页面均有返回登录链接                                  |
| "上一步"/"下一步" 按钮         | ✅ PASS | Step 1 "上一步" disabled，Step 2/3 可用                   |
| 步骤间导航                     | ✅ PASS | 通过填写 Step 1 → Step 2 → Step 3 验证，步骤切换正常      |
| 品牌面板登录/注册一致          | ✅ PASS | 登录和注册页使用相同的 `<BrandPanel />` 组件              |

### 注意事项

- **CJK 字体**: Playwright MCP 浏览器环境缺少中文字体，截图中中文显示为方块。页面标题栏（`登录 - 大学生职业规划智能体`）和 accessibility snapshot 均确认中文内容正确渲染。此为测试环境限制，非 UI 问题。
- **React Intl 警告**: 登录页有 6 个 `[React Intl] Missing message` 警告（`pages.login.subtitle`、`pages.login.remember` 等）。这是预存问题（组件使用硬编码中文字符串而非 intl key），不是 Phase 3 引入的回归。
- **入场动画**: 无法通过静态截图验证 framer-motion 入场动画。需通过浏览器实际访问确认动画流畅性。

### 验收结论

**✅ PASS** — Phase 3: Auth Pages 所有可视化验收项通过。登录/注册分屏布局、品牌面板、表单组件、步骤导航、密码强度指示器、目标岗位下拉、简历上传区均按 spec 实现。功能保全清单完整保留。
