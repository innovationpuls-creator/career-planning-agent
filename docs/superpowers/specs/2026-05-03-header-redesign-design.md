# Header Redesign — Design Spec

**Date:** 2026-05-03
**Scope:** Top navigation bar / header only. No changes to page content, APIs, routes, or data structures.

## 1. Goal

Replace the default ProLayout horizontal header with a custom three-zone header: brand area (left), pill-style navigation (center), utility capsule (right). Visual style targets a warm, premium SaaS feel — not an admin console.

## 2. Architecture

### Approach

Use ProLayout's `headerRender` prop to fully replace the header. ProLayout continues to manage `fixedHeader` positioning, content area rendering, and route-based menu data generation.

### Component Tree

```
ProLayout (layout="top", fixedHeader)
  headerRender → <AppHeader>
    ├─ BrandArea      logo + title + subtitle
    ├─ NavList        custom pill navigation from menuData
    └─ UtilityBar     language + settings + avatar capsule
  children → page content (unchanged)
```

### New Files

| File | Purpose |
|------|---------|
| `src/components/AppHeader/index.tsx` | Container: three-zone flex layout |
| `src/components/AppHeader/BrandArea.tsx` | Logo + "大学生职业规划智能体" + "AI赋能职业成长每一步" |
| `src/components/AppHeader/NavList.tsx` | Pill-style menu items with active state |
| `src/components/AppHeader/UtilityBar.tsx` | Language, settings, avatar capsule |
| `src/components/AppHeader/index.module.less` | All header styles (from css.md reference) |

### Modified Files

| File | Change |
|------|--------|
| `src/app.tsx` | Add `headerRender: (props) => <AppHeader {...props} />`, remove `actionsRender`, `avatarProps`, `menuHeaderRender` |

### Unchanged Files

`config/defaultSettings.ts`, `config/routes.ts`, all page components, API services, data models, route definitions.

## 3. Data Flow

`headerRender` receives `ProLayoutProps` from ProLayout. Key props consumed:

| Prop | Usage |
|------|-------|
| `menuData` | Menu tree (filtered by `hideInMenu`, localized via i18n) |
| `location` | Current route location |

`AppHeader` additionally uses:
- `useLocation()` from `@umijs/max` — current pathname for active menu detection
- `history.push(path)` from `@umijs/max` — menu item click navigation
- `useModel('@@initialState')` — current user info (name, avatar) for utility bar

## 4. Brand Area (Left)

```
[Logo 36x36]  大学生职业规划智能体   ← 17px, weight 650, rgba(30,30,34,0.92)
               AI赋能职业成长每一步   ← 12px, rgba(30,30,34,0.38)
```

- Container: `display: flex; align-items: center; gap: 12px; min-width: 260px`
- Logo: reuse URL from `defaultSettings.ts` (current CDN SVG)
- Text is hardcoded (brand name, not i18n content)

## 5. Navigation Area (Center)

### Menu Items

Data from `props.menuData` (ProLayout-generated from `routes.ts`). Each item has `name` (localized), `path`, and `icon` (ReactNode).

Visible items for regular users:

| Path | Name | Icon |
|------|------|------|
| `/home-v2` | 职业规划 | HomeOutlined |
| `/student-competency-profile` | 简历解构 | DashboardOutlined |
| `/snail-learning-path` | 蜗牛学习路径 | ApartmentOutlined |
| `/personal-growth-report` | 个人职业成长报告 | FileTextOutlined |
| `/job-competency-graph` | 岗位能力图谱 | ProfileOutlined |
| `/same-job-cross-industry` | 同岗行业对比 | ProfileOutlined |

### Active State Detection

```ts
const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
```

Exact match first, prefix match as fallback for child routes.

### Item Specs

| Property | Default | Hover | Active |
|----------|---------|-------|--------|
| Height | 44px | — | — |
| Padding | 0 18px | — | — |
| Border-radius | 18px | — | — |
| Background | transparent | rgba(209,93,47,0.07) | linear-gradient(180deg, rgba(255,239,229,0.96), rgba(255,247,241,0.88)) |
| Text color | rgba(40,35,32,0.68) | rgba(209,93,47,0.92) | #d15d2f |
| Font-weight | 500 | 500 | 650 |
| Font-size | 15px | — | — |
| Icon color | same as text | same as text | same as text |
| Box-shadow | none | none | inset 0 1px 0 rgba(255,255,255,0.8), 0 8px 20px rgba(209,93,47,0.12) |
| Bottom indicator | none | none | ::after 32px wide, 2px tall, centered, orange gradient |

- Gap between items: 12px
- Navigation: `history.push(item.path)` on click
- `display: inline-flex; align-items: center; gap: 8px` per item

## 6. Utility Bar (Right)

### Outer Capsule

| Property | Value |
|----------|-------|
| Height | 44px |
| Border-radius | 999px |
| Background | rgba(255,255,255,0.72) |
| Border | 1px solid rgba(188,130,92,0.14) |
| Box-shadow | 0 8px 22px rgba(120,80,48,0.06) |
| Padding | 0 8px |
| Layout | flex, align-items: center, gap: 6px |

### Children

| Element | Size | Behavior |
|---------|------|----------|
| Language button (文A) | 34x34px circle | Hover: color #d15d2f, bg rgba(209,93,47,0.08) |
| Settings button (⚙) | 34x34px circle | Same hover |
| Divider | 1x20px, rgba(80,60,48,0.12) | Static |
| User avatar | 30x30px circle | Gradient bg: linear-gradient(135deg, #e9945e, #d15d2f), white icon |
| Username | 12px, rgba(40,35,32,0.68) | From `initialState.currentUser.name` |
| Dropdown arrow | 12px, same color as username | — |

### Interactions

- Avatar + username + arrow: single clickable area, opens Ant Design `Dropdown` with "退出登录" menu item
- Reuses existing logout logic: `outLogin()` → clear token → redirect to `/user/login`
- Language switcher: wraps existing `SelectLang` component inside capsule button
- Settings button: display-only, no action (reserved for future)

## 7. CSS Strategy

### File

`src/components/AppHeader/index.module.less` — all header styles in one file.

### Design Token Handling

Header styles are self-contained in the less file with local variables. Not importing from `claude-tokens.ts` because:
- css.md colors use precise rgba values from visual tuning, not matching hex tokens exactly
- Header is a visually independent module, decoupled from page-body token system

### Local Variables (top of less file)

```less
@header-bg: linear-gradient(180deg, rgba(255,253,248,0.94), rgba(255,250,242,0.86));
@header-border: rgba(188,130,92,0.12);
@header-shadow: 0 10px 30px rgba(120,80,48,0.06);
@header-radius: 22px;
@header-height: 72px;
@header-padding: 48px;

@nav-active-color: #d15d2f;
@nav-active-bg: linear-gradient(180deg, rgba(255,239,229,0.96), rgba(255,247,241,0.88));
@nav-hover-bg: rgba(209,93,47,0.07);

@utility-bg: rgba(255,255,255,0.72);
@utility-border: rgba(188,130,92,0.14);
@utility-shadow: 0 8px 22px rgba(120,80,48,0.06);
```

### Glass Effect

`backdrop-filter: blur(16px)` on the header container.

### No ProLayout Style Conflicts

Because `headerRender` fully replaces the header, there is no collision with ProLayout internal styles. No `:global()` overrides needed.

### Responsive

Not in scope for this iteration. Desktop-only single breakpoint.

## 8. What Is NOT Changed

- Routes (`config/routes.ts`) — no changes
- Design tokens (`config/defaultSettings.ts`) — no changes; tokens continue to apply to page body
- Page content — all pages render identically below the header
- API calls — no endpoint changes
- Data structures — no model/schema changes
- Login/auth flow — logout behavior preserved
- i18n — menu item names still localized; brand text hardcoded (intentional)

## 9. Acceptance Criteria

1. Header has three-zone layout: brand + nav + utility
2. Active menu shows pill-shaped highlight (not underline)
3. Right side is a single capsule (not scattered icons)
4. Brand area shows title + subtitle
5. All visual details are light: thin border, subtle shadow, gentle hover
6. `npx tsc --noEmit` passes with no new errors
7. All existing menu items navigate correctly
8. Active menu item highlights based on current route
9. No changes to routes, APIs, or page content
