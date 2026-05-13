# Header Redesign Implementation Plan

> **状态：** 已执行（2026-05-04）
> **计划来源:** `docs/superpowers/plans/2026-05-03-header-redesign.md`
> **设计规格:** `docs/superpowers/specs/2026-05-03-header-redesign-design.md`
> **变更日志:** `docs/changes/2026-05-03-header-redesign.md`

## 执行前修正（2026-05-04）

计划执行前审查发现以下问题并已修正：

| 问题 | 修正 |
|------|------|
| LESS 文件使用本地变量而非 CSS 变量 | 迁移至 `global.less` 的 `--header-*` CSS 变量 |
| UtilityBar 重实现了登出逻辑 | 改用 `AvatarDropdown` 组件复用 |
| NavList `isActive` 对 `/` 根路径无精确匹配 | 增加边界判断 |
| 缺少 1440px / 1280px 响应式断点 | 新增两个媒体查询 |
| `RightContent` 未导出 `AvatarDropdown` | 在 `index.tsx` 添加重新导出 |
| BrandArea 未使用 Ant Design 默认 logo | ✅ 已使用项目 logo `/images/logo/brand-logo.png` |

---

## 文件结构（已修正）

| 文件 | 操作 | 说明 |
|------|------|------|
| `myapp/src/global.less` | **修改** | 新增 `--header-*` CSS 变量块 |
| `myapp/src/components/AppHeader/index.module.less` | **重写** | 迁移至 CSS var；移除 LESS 本地变量；新增 1440px / 1280px 断点 |
| `myapp/src/components/AppHeader/NavList.tsx` | **修改** | `isActive` 增加 `/` 精确匹配边界处理 |
| `myapp/src/components/AppHeader/UtilityBar.tsx` | **重写** | 改用 `AvatarDropdown`；移除本地登出逻辑 |
| `myapp/src/components/RightContent/index.tsx` | **修改** | 导出 `AvatarDropdown` / `AvatarName` |
| `myapp/src/components/AppHeader/BrandArea.tsx` | 无变更 | 使用项目 logo `/images/logo/brand-logo.png` |
| `myapp/src/app.tsx` | 无需修改 | headerRender 已配置 |

---

### 任务 1：添加 CSS 变量到 global.less

✅ 已执行。变量块已添加到 `global.less` 的 `:root` 中，17 个 `--header-*` 变量。

### 任务 2：重写 index.module.less

✅ 已执行。关键变更：
- 移除全部 LESS 本地变量（`@header-bg`、`@nav-active-color` 等）
- 全部颜色/阴影改用 `var(--header-*)` 引用 global.less
- 新增 `@media (max-width: 1440px)`：压缩 padding 和 navItem
- 新增 `@media (max-width: 1280px)`：隐藏 brandSubtitle、减少 nav gap、隐藏 userName
- 保留 `@media (max-width: 767px)` 移动端布局

### 任务 3：修复 NavList isActive 边界处理

✅ 已执行。修正前/后对比：

```tsx
// ❌ 修正前
const isActive = (itemPath) =>
  pathname === itemPath || pathname.startsWith(itemPath + '/');

// ✅ 修正后
const isActive = (itemPath) => {
  if (!itemPath) return false;                          // 空路径跳过
  if (itemPath === '/') return pathname === '/';        // 根路径精确匹配
  return pathname === itemPath || pathname.startsWith(itemPath + '/'); // 子路由
};
```

### 任务 4：UtilityBar 复用 AvatarDropdown

✅ 已执行。关键变更：
- 移除 `outLogin`、`clearAccessToken`、`flushSync` 导入
- 移除本地 `loginOut()` / `handleLogout()` 实现
- 导入 `AvatarDropdown` from `@/components/RightContent`
- 用 `<AvatarDropdown>` 包裹用户入口视觉元素
- `AvatarDropdown` 内部处理完整登出链路

### 任务 5：RightContent 导出 AvatarDropdown

✅ 已执行。`RightContent/index.tsx` 新增：
```tsx
export { AvatarDropdown, AvatarName } from './AvatarDropdown';
```

---

### Task 1: Create Stylesheet

**Files:**
- Create: `myapp/src/components/AppHeader/index.module.less`

- [ ] **Step 1: Create the less file with all header styles**

```less
// ── Local variables ──────────────────────────────────────
@header-bg: linear-gradient(180deg, rgba(255, 253, 248, 0.94), rgba(255, 250, 242, 0.86));
@header-border: rgba(188, 130, 92, 0.12);
@header-shadow: 0 10px 30px rgba(120, 80, 48, 0.06);
@header-radius: 22px;
@header-height: 72px;
@header-padding-h: 48px;

@text-primary: rgba(30, 30, 34, 0.92);
@text-muted: rgba(30, 30, 34, 0.38);
@text-nav: rgba(40, 35, 32, 0.68);

@nav-hover-bg: rgba(209, 93, 47, 0.07);
@nav-hover-color: rgba(209, 93, 47, 0.92);
@nav-active-color: #d15d2f;
@nav-active-bg: linear-gradient(180deg, rgba(255, 239, 229, 0.96), rgba(255, 247, 241, 0.88));
@nav-active-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 8px 20px rgba(209, 93, 47, 0.12);

@utility-bg: rgba(255, 255, 255, 0.72);
@utility-border: rgba(188, 130, 92, 0.14);
@utility-shadow: 0 8px 22px rgba(120, 80, 48, 0.06);
@utility-btn-hover-color: #d15d2f;
@utility-btn-hover-bg: rgba(209, 93, 47, 0.08);
@utility-divider: rgba(80, 60, 48, 0.12);

@avatar-gradient: linear-gradient(135deg, #e9945e, #d15d2f);
@indicator-gradient: linear-gradient(90deg, #e58a5f, #d15d2f);

// ── Header container ─────────────────────────────────────
.appHeader {
  height: @header-height;
  padding: 0 @header-padding-h;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: @header-bg;
  border-bottom: 1px solid @header-border;
  box-shadow: @header-shadow;
  border-radius: 0 0 @header-radius @header-radius;
  backdrop-filter: blur(16px);
}

// ── Brand area (left) ────────────────────────────────────
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 260px;
}

.logo {
  width: 36px;
  height: 36px;
}

.brandText {
  display: flex;
  flex-direction: column;
}

.brandTitle {
  font-size: 17px;
  font-weight: 650;
  color: @text-primary;
  line-height: 1.2;
}

.brandSubtitle {
  margin-top: 3px;
  font-size: 12px;
  color: @text-muted;
}

// ── Nav list (center) ────────────────────────────────────
.navList {
  display: flex;
  align-items: center;
  gap: 12px;
}

.navItem {
  position: relative;
  height: 44px;
  padding: 0 18px;
  border-radius: 18px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: @text-nav;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: transparent;
  transition: all 0.22s ease;

  &:hover {
    color: @nav-hover-color;
    background: @nav-hover-bg;
  }
}

.navItemActive {
  color: @nav-active-color;
  font-weight: 650;
  background: @nav-active-bg;
  box-shadow: @nav-active-shadow;

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: 6px;
    width: 32px;
    height: 2px;
    border-radius: 999px;
    transform: translateX(-50%);
    background: @indicator-gradient;
  }
}

// ── Utility bar (right) ──────────────────────────────────
.utilityBar {
  height: 44px;
  padding: 0 8px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: @utility-bg;
  border: 1px solid @utility-border;
  box-shadow: @utility-shadow;
}

.utilityButton {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(40, 35, 32, 0.58);
  cursor: pointer;
  border: none;
  background: transparent;
  transition: all 0.2s ease;

  &:hover {
    color: @utility-btn-hover-color;
    background: @utility-btn-hover-bg;
  }
}

.utilityDivider {
  width: 1px;
  height: 20px;
  background: @utility-divider;
  margin: 0 4px;
}

.userEntry {
  height: 34px;
  padding: 0 10px 0 4px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: @utility-btn-hover-bg;
  }
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: @avatar-gradient;
}

.userName {
  font-size: 12px;
  color: rgba(40, 35, 32, 0.68);
}

.dropdownArrow {
  font-size: 10px;
  color: rgba(40, 35, 32, 0.45);
}
```

- [ ] **Step 2: Verify the file was created**

Run: `ls myapp/src/components/AppHeader/index.module.less`
Expected: file exists

---

### Task 2: Create BrandArea Component

**Files:**
- Create: `myapp/src/components/AppHeader/BrandArea.tsx`

- [ ] **Step 1: Write the BrandArea component**

```tsx
import React from 'react';
import styles from './index.module.less';

const LOGO_URL =
  'https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg';

const BrandArea: React.FC = () => {
  return (
    <div className={styles.brand}>
      <img src={LOGO_URL} alt="logo" className={styles.logo} />
      <div className={styles.brandText}>
        <span className={styles.brandTitle}>大学生职业规划智能体</span>
        <span className={styles.brandSubtitle}>AI赋能职业成长每一步</span>
      </div>
    </div>
  );
};

export default BrandArea;
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd myapp && npx tsc --noEmit --pretty false 2>&1 | grep BrandArea || echo "No errors in BrandArea"`
Expected: No errors related to BrandArea

---

### Task 3: Create NavList Component

**Files:**
- Create: `myapp/src/components/AppHeader/NavList.tsx`

- [ ] **Step 1: Write the NavList component**

```tsx
import React from 'react';
import { useLocation, history } from '@umijs/max';
import type { MenuDataItem } from '@ant-design/pro-components';
import styles from './index.module.less';

interface NavListProps {
  menuData: MenuDataItem[];
}

const NavList: React.FC<NavListProps> = ({ menuData }) => {
  const { pathname } = useLocation();

  // Filter to top-level items with names (hide parent-only containers)
  const visibleItems = menuData.filter(
    (item) => item.name && item.path && !item.hideInMenu,
  );

  const isActive = (itemPath: string) =>
    pathname === itemPath || pathname.startsWith(itemPath + '/');

  const handleClick = (path: string) => {
    history.push(path);
  };

  return (
    <nav className={styles.navList}>
      {visibleItems.map((item) => {
        const active = isActive(item.path!);
        return (
          <button
            key={item.path}
            type="button"
            className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
            onClick={() => handleClick(item.path!)}
          >
            {item.icon}
            <span>{item.name}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default NavList;
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd myapp && npx tsc --noEmit --pretty false 2>&1 | grep NavList || echo "No errors in NavList"`
Expected: No errors related to NavList

---

### Task 4: Create UtilityBar Component

**Files:**
- Create: `myapp/src/components/AppHeader/UtilityBar.tsx`

- [ ] **Step 1: Write the UtilityBar component**

```tsx
import { DownOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { history, SelectLang as UmiSelectLang, useModel } from '@umijs/max';
import { Dropdown, Spin } from 'antd';
import React from 'react';
import { flushSync } from 'react-dom';
import { outLogin } from '@/services/ant-design-pro/api';
import { clearAccessToken } from '@/utils/authToken';
import styles from './index.module.less';

const UtilityBar: React.FC = () => {
  const { initialState, setInitialState } = useModel('@@initialState');
  const { currentUser } = initialState || {};

  const loginOut = async () => {
    await outLogin();
    clearAccessToken();
    if (window.location.pathname !== '/user/login') {
      history.replace('/user/login');
    }
  };

  const handleLogout = () => {
    flushSync(() => {
      setInitialState((s) => ({ ...s, currentUser: undefined }));
    });
    void loginOut();
  };

  const menuItems = [
    {
      key: 'logout',
      label: '退出登录',
    },
  ];

  if (!initialState || !currentUser?.name) {
    return (
      <div className={styles.utilityBar}>
        <Spin size="small" />
      </div>
    );
  }

  return (
    <div className={styles.utilityBar}>
      {/* Language switcher */}
      <div className={styles.utilityButton}>
        <UmiSelectLang style={{ fontSize: 14, color: 'inherit' }} />
      </div>

      {/* Settings button */}
      <button type="button" className={styles.utilityButton}>
        <SettingOutlined />
      </button>

      {/* Divider */}
      <div className={styles.utilityDivider} />

      {/* User entry */}
      <Dropdown
        menu={{ items: menuItems, onClick: handleLogout }}
        trigger={['click']}
      >
        <div className={styles.userEntry}>
          <div className={styles.avatar}>
            <UserOutlined style={{ fontSize: 14 }} />
          </div>
          <span className={styles.userName}>{currentUser.name}</span>
          <DownOutlined className={styles.dropdownArrow} />
        </div>
      </Dropdown>
    </div>
  );
};

export default UtilityBar;
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd myapp && npx tsc --noEmit --pretty false 2>&1 | grep UtilityBar || echo "No errors in UtilityBar"`
Expected: No errors related to UtilityBar

---

### Task 5: Create AppHeader Container

**Files:**
- Create: `myapp/src/components/AppHeader/index.tsx`

- [ ] **Step 1: Write the AppHeader component**

```tsx
import React from 'react';
import type { ProLayoutProps } from '@ant-design/pro-components';
import BrandArea from './BrandArea';
import NavList from './NavList';
import UtilityBar from './UtilityBar';
import styles from './index.module.less';

const AppHeader: React.FC<ProLayoutProps> = (props) => {
  const { menuData = [] } = props;

  return (
    <header className={styles.appHeader}>
      <BrandArea />
      <NavList menuData={menuData} />
      <UtilityBar />
    </header>
  );
};

export default AppHeader;
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd myapp && npx tsc --noEmit --pretty false 2>&1 | grep AppHeader || echo "No errors in AppHeader"`
Expected: No errors related to AppHeader

---

### Task 6: Integrate with app.tsx

**Files:**
- Modify: `myapp/src/app.tsx`

- [ ] **Step 1: Add AppHeader import**

Add at the top of `src/app.tsx`, after existing imports:

```tsx
import AppHeader from '@/components/AppHeader';
```

- [ ] **Step 2: Replace header configuration in layout return**

In the `layout` export function, make these changes:

**Remove** these three properties from the returned object:
```tsx
actionsRender: () => [<SelectLang key="SelectLang" />],
```
```tsx
avatarProps: {
  src: initialState?.currentUser?.avatar,
  title: <AvatarName />,
  render: (_, avatarChildren) => {
    return <AvatarDropdown menu>{avatarChildren}</AvatarDropdown>;
  },
},
```
```tsx
menuHeaderRender: undefined,
```

**Add** this property:
```tsx
headerRender: (props) => <AppHeader {...props} />,
```

The final return object should look like:

```tsx
return {
  headerRender: (props) => <AppHeader {...props} />,
  waterMarkProps: shouldShowWatermark
    ? {
        content: initialState?.currentUser?.name,
      }
    : undefined,
  footerRender: false,
  onPageChange: () => {
    if (
      !initialState?.currentUser &&
      !publicPaths.includes(location.pathname)
    ) {
      history.replace(loginPath);
    }
  },
  unAccessible: (/* ...unchanged... */),
  bgLayoutImgList: [],
  links: [],
  childrenRender: (children) => {
    /* ...unchanged... */
  },
  menu: {
    defaultOpenAll: false,
  },
  ...initialState?.settings,
};
```

- [ ] **Step 3: Clean up unused imports**

If `SelectLang`, `AvatarDropdown`, and `AvatarName` are no longer used in `app.tsx`, remove them from the import:

```tsx
// Before:
import { AvatarDropdown, AvatarName, SelectLang } from '@/components';

// After: (remove entirely if unused elsewhere in the file)
```

- [ ] **Step 4: Verify TypeScript**

Run: `cd myapp && npx tsc --noEmit --pretty false 2>&1 | head -20`
Expected: No new errors

---

### Task 7: Verify and Test

- [ ] **Step 1: Run TypeScript check**

Run: `cd myapp && npx tsc --noEmit`
Expected: Exit code 0, no errors

- [ ] **Step 2: Start dev server and visually verify**

Run: `cd myapp && npm start`
Expected: Dev server starts on port 8000

Manually verify in browser:
1. Header shows three-zone layout (brand + nav + utility)
2. Brand area: logo + "大学生职业规划智能体" + "AI赋能职业成长每一步"
3. Navigation: pill-style items, active item has orange pill highlight + bottom indicator
4. Clicking nav items navigates correctly
5. Right capsule: language button, settings gear, divider, avatar circle, username, dropdown arrow
6. Clicking avatar area shows "退出登录" dropdown
7. Logout works correctly
8. Header has warm background, bottom border-radius, subtle shadow
9. Page content below header renders normally

- [ ] **Step 3: Run existing tests**

Run: `cd myapp && npm test -- --watchAll=false 2>&1 | tail -20`
Expected: No new test failures (existing tests should pass; header has no test-breaking changes)

- [ ] **Step 4: Run production build**

Run: `cd myapp && npm run build 2>&1 | tail -20`
Expected: Build completes or progresses past the header-related compilation without errors

- [ ] **Step 5: Commit**

```bash
git add myapp/src/components/AppHeader/ myapp/src/app.tsx
git commit -m "feat: replace ProLayout header with custom three-zone AppHeader"
```
