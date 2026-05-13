# Header Redesign — 自定义三区域 AppHeader

> 日期: 2026-05-03
> 计划来源: `docs/superpowers/plans/2026-05-03-header-redesign.md`
> 设计规格: `docs/superpowers/specs/2026-05-03-header-redesign-design.md`

---

## 概述

替换 ProLayout 默认横向 header，使用 `headerRender` prop 渲染自定义三区域 AppHeader：品牌区（左侧）、药丸导航（中部）、工具胶囊（右侧）。视觉风格为暖色高级 SaaS 感，非管理后台风格。

---

## 新建文件

### `src/components/AppHeader/index.module.less` (~190 行)

Header 全部样式。使用 Less 局部变量管理设计 token：

| 变量组 | 示例 |
|--------|------|
| Header | `@header-bg` (渐变), `@header-radius: 22px`, `@header-height: 72px` |
| Nav | `@nav-active-color: #d15d2f`, `@nav-hover-bg`, `@nav-active-bg` (渐变) |
| Utility | `@utility-bg`, `@utility-border`, `@avatar-gradient` |

特性：
- `backdrop-filter: blur(16px)` 毛玻璃效果
- Header 底部圆角 `border-radius: 0 0 22px 22px`
- 活跃导航项带底部橙色渐变指示条 (`::after`)

### `src/components/AppHeader/BrandArea.tsx` (~18 行)

品牌区域组件。Logo（36x36）+ "大学生职业规划智能体"（17px, 650）+ "AI赋能职业成长每一步"（12px, muted）。

### `src/components/AppHeader/NavList.tsx` (~40 行)

药丸导航组件。从 ProLayout 的 `menuData` prop 渲染菜单项：

| 功能 | 实现 |
|------|------|
| 数据过滤 | 过滤掉无 `name`/`path` 或 `hideInMenu` 的项 |
| 活跃检测 | `pathname === item.path \|\| pathname.startsWith(item.path + '/')` |
| 导航 | `history.push(item.path)` on click |
| 样式 | 药丸形（`border-radius: 18px`），活跃项有渐变背景 + 底部指示条 |

### `src/components/AppHeader/UtilityBar.tsx` (~65 行)

工具胶囊组件。包含：

| 元素 | 说明 |
|------|------|
| 语言切换 | 包裹 `UmiSelectLang` |
| 设置按钮 | `SettingOutlined`，预留功能 |
| 分割线 | 1x20px |
| 用户入口 | 渐变头像 + 用户名 + 下拉箭头，点击弹出 "退出登录" Dropdown |
| 加载态 | 用户数据未就绪时显示 `Spin` |

> **字体修复（E2E 验收后追加）：**
> - `.navItem` 添加 `line-height: 44px`，修复浏览器默认 56px 导致文字偏移
> - `.appHeader` 添加 `font-family: @font-body`（PingFang SC 无衬线）
> - `.brandTitle` 添加 `font-family: @font-heading`（STSongti SC 衬线）
> - 导航项与品牌文案添加 `letter-spacing: 0.01em–0.02em` 提升中文排版质感

复用现有登出逻辑：`outLogin()` → `clearAccessToken()` → redirect to `/user/login`。

### `src/components/AppHeader/index.tsx` (~18 行)

容器组件。接收 `ProLayoutProps`，三区域 flex 布局：

```
<header className={styles.appHeader}>
  <BrandArea />
  <NavList menuData={menuData} />
  <UtilityBar />
</header>
```

### 测试文件 (4 个)

| 文件 | 测试数 |
|------|--------|
| `BrandArea.test.tsx` | 3 |
| `NavList.test.tsx` | 6 |
| `UtilityBar.test.tsx` | 6 |
| `AppHeader.test.tsx` | 2 |

共 17 个测试，覆盖渲染、活跃状态检测、菜单过滤、导航点击、登出流程、加载态。

---

## 修改文件

### `src/app.tsx`

| 变更 | 说明 |
|------|------|
| 移除 | `import { AvatarDropdown, AvatarName, SelectLang }` |
| 新增 | `import AppHeader from '@/components/AppHeader'` |
| 移除 | `actionsRender: () => [<SelectLang key="SelectLang" />]` |
| 移除 | `avatarProps: { src, title, render }` |
| 移除 | `menuHeaderRender: undefined` |
| 新增 | `headerRender: (props) => <AppHeader {...props} />` |

---

## 未变更

- `config/routes.ts` — 路由不变
- `config/defaultSettings.ts` — 设计 token 不变（仅影响页面内容区）
- 所有页面组件 — 页面内容不变
- API 服务 — 无端点变更
- 数据模型 — 无结构变更
- 登录/认证流程 — 登出行为保持一致
- i18n — 菜单项名称仍本地化；品牌文案硬编码（设计决策）

---

## 验证结果

| 检查项 | 结果 |
|--------|------|
| `tsc --noEmit` | 通过，无新错误 |
| AppHeader 测试 (17 个) | 全部通过 |
| 全量测试 (410 个) | 全部通过 |
| `npm run build` | 构建成功 |
| Playwright E2E (3 个) | 全部通过 |

### E2E 验收截图

| 截图 | 说明 |
|------|------|
| `docs/images/test/Header/header-full.png` | Header 三区域布局全貌 |
| `docs/images/test/Header/header-with-page.png` | Header 与页面内容的整体上下文 |
| `docs/images/test/Header/nav-active-state.png` | 导航项活跃态特写（渐变背景 + 底部指示条） |

### 字体修复前后对比（E2E computed styles）

| 属性 | 修复前 | 修复后 |
|------|--------|--------|
| `.navItem` lineHeight | 56px（溢出 44px 按钮） | 44px（精确匹配） |
| `.brandTitle` fontFamily | 系统默认（继承） | `STSongti SC` 衬线字体 |
| `.navItem` fontFamily | 系统默认（继承） | `PingFang SC` 无衬线字体 |
| letter-spacing | `normal` | 0.01em–0.02em |

---

## 修正更新 (2026-05-04)

### 变更原因

计划执行前审查发现以下问题需要修正：
1. LESS 文件使用本地变量而非 CSS 变量，导致 token 不统一
2. UtilityBar 重新实现了登出逻辑，未复用现有 AvatarDropdown
3. NavList 的 `isActive` 对根路径 `/` 缺少精确匹配边界处理
4. 缺少 1440px / 1280px 响应式断点

### 修改文件清单

| 文件 | 操作 | 修正内容 |
|------|------|----------|
| `src/global.less` | 修改 | 新增 17 个 `--header-*` CSS 变量 |
| `src/components/AppHeader/index.module.less` | 重写 | 移除 LESS 本地变量，迁移至 CSS var；新增 1440px / 1280px 断点 |
| `src/components/AppHeader/NavList.tsx` | 修改 | `isActive` 增加 `/` 根路径精确匹配；保留 `hideInMenu` 过滤 |
| `src/components/AppHeader/UtilityBar.tsx` | 重写 | 移除 `outLogin`/`clearAccessToken` 实现，改用 `AvatarDropdown` 组件 |
| `src/components/RightContent/index.tsx` | 修改 | 新增 `AvatarDropdown` / `AvatarName` 重新导出 |

### 修正详情

#### 1. CSS 变量迁移 (`global.less`)

新增 `--header-*` 变量块（在 Chart Colors 之后）：

```css
--header-primary: #d15d2f;
--header-primary-light: #e58a5f;
--header-primary-bg: rgba(209, 93, 47, 0.07);
--header-border: rgba(188, 130, 92, 0.12);
--header-shadow: 0 10px 30px rgba(120, 80, 48, 0.06);
--header-utility-bg: rgba(255, 255, 255, 0.72);
--header-utility-border: rgba(188, 130, 92, 0.14);
--header-utility-shadow: 0 8px 22px rgba(120, 80, 48, 0.06);
--header-text-primary: rgba(30, 30, 34, 0.92);
--header-text-muted: rgba(30, 30, 34, 0.38);
--header-text-nav: rgba(40, 35, 32, 0.68);
--header-nav-hover-bg: rgba(209, 93, 47, 0.07);
--header-nav-hover-color: rgba(209, 93, 47, 0.92);
--header-nav-active-bg: linear-gradient(180deg, rgba(255, 239, 229, 0.96), rgba(255, 247, 241, 0.88));
--header-nav-active-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 8px 20px rgba(209, 93, 47, 0.12);
--header-utility-btn-hover-color: #d15d2f;
--header-utility-btn-hover-bg: rgba(209, 93, 47, 0.08);
--header-utility-divider: rgba(80, 60, 48, 0.12);
--header-avatar-gradient: linear-gradient(135deg, #e9945e, #d15d2f);
--header-indicator-gradient: linear-gradient(90deg, #e58a5f, #d15d2f);
--header-bg: linear-gradient(180deg, rgba(255, 253, 248, 0.94), rgba(255, 250, 242, 0.86));
--header-padding-h: 48px;
--header-height: 72px;
--header-height-mobile: 64px;
```

**无裸 hex**：所有颜色值已迁移为 CSS 变量，无遗留裸 hex（唯一例外：`.avatar` 中 `color: #fff` 为 Ant Design 图标默认色，非设计 token，无需提取）。

#### 2. UtilityBar 复用 AvatarDropdown

**修改前**：UtilityBar 自己实现了完整登出逻辑：
```tsx
import { outLogin } from '@/services/ant-design-pro/api';
import { clearAccessToken } from '@/utils/authToken';
// ... 重实现了 loginOut() + handleLogout()
const menuItems = [{ key: 'logout', label: '退出登录' }];
<Dropdown menu={{ items: menuItems, onClick: handleLogout }}>
```

**修改后**：直接使用 `AvatarDropdown` 组件：
```tsx
import { AvatarDropdown } from '@/components/RightContent';
// ... 无 outLogin / clearAccessToken
<AvatarDropdown>
  <div className={styles.userEntry}>
    <div className={styles.avatar}>...</div>
    <span className={styles.userName}>{currentUser.name}</span>
    <DownOutlined className={styles.dropdownArrow} />
  </div>
</AvatarDropdown>
```

`AvatarDropdown` 内部已处理 `outLogin` → `clearAccessToken` → redirect 完整链路。

#### 3. NavList Active 判断边界处理

**修改前**：
```tsx
const isActive = (itemPath) =>
  pathname === itemPath || pathname.startsWith(itemPath + '/');
```
问题：`/` 路径会错误匹配所有子路由（如 `/user/login` 也会匹配 `path='/'` 的菜单项）。

**修改后**：
```tsx
const isActive = (itemPath) => {
  if (!itemPath) return false;           // 空路径跳过
  if (itemPath === '/') return pathname === '/';  // 根路径精确匹配
  return pathname === itemPath || pathname.startsWith(itemPath + '/'); // 子路由前缀匹配
};
```

同时保留 `!item.hideInMenu` 过滤：`visibleItems` 过滤条件保持不变。

#### 4. 响应式规则

| 断点 | 规则 |
|------|------|
| `max-width: 1440px` | `.appHeader` padding: 0 24px；`.navItem` padding: 0 8px，font-size: 13px；`.brand` max-width: 280px |
| `max-width: 1280px` | `.brandSubtitle` 隐藏；`.navList` gap: 2px；`.userName` 隐藏 |
| `max-width: 767px` | 移动端布局不变（已在原文件中实现） |

### Logo 使用情况

✅ 使用项目自己的 logo：`/images/logo/brand-logo.png`（`BrandArea.tsx`），无 Ant Design 默认 logo。

### tsc 检查结果

```
src/components/AppHeader/*.tsx     ✅ 无新增错误
src/components/RightContent/index.tsx ✅ 无新增错误
```

注：项目中存在与本次修改无关的 pre-existing tsc 错误（`learning-path/` 测试文件），不计入本次修改范围。

### 验证检查清单

- [x] CSS 变量从 global.less 引用（无裸 hex）
- [x] UtilityBar 复用 AvatarDropdown
- [x] NavList `/` 根路径精确匹配
- [x] 响应式 1440px / 1280px 断点
- [x] 使用项目自定义 logo
- [x] tsc 无新增错误
