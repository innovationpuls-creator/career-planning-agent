# Frontend Redesign: Claude Design Language

**Date**: 2026-05-01
**Status**: Draft

## Summary

Complete frontend redesign adopting the Claude (Anthropic) design system. Replace the current blue-based Ant Design Pro interface with a warm, editorial, serif-driven aesthetic. Replace the tech stack (UmiJS + Ant Design) with Vite + React Router + Radix UI + Tailwind CSS.

## Goals

- Fully adopt Claude design language: warm parchment canvas, terracotta accents, serif headlines, editorial spacing
- Redesign all pages: student (6), admin (6), auth (2)
- Replace framework: UmiJS + Ant Design → Vite + React Router + Radix UI + Tailwind CSS
- Replace API layer: umi-request → TanStack Query + hand-written fetcher
- Fresh rewrite: delete old `myapp/`, build new `frontend/` from scratch

## Design Decisions

### Color System

All colors use warm-toned neutrals. Every gray has a yellow-brown undertone. No cool blue-grays.

| Token | Value | Role |
|-------|-------|------|
| `--color-brand` | `#c96442` | Terracotta — primary CTA |
| `--color-brand-hover` | `#b5583a` | Brand hover state |
| `--color-brand-light` | `#d97757` | Coral — secondary accent |
| `--color-bg-page` | `#f5f4ed` | Parchment — page background |
| `--color-bg-card` | `#faf9f5` | Ivory — card surface |
| `--color-bg-sand` | `#e8e6dc` | Warm Sand — secondary button |
| `--color-bg-dark` | `#30302e` | Dark Surface — dark containers |
| `--color-bg-deep` | `#141413` | Deep Dark — dark sections |
| `--color-text-primary` | `#141413` | Primary text (warm black) |
| `--color-text-secondary` | `#5e5d59` | Olive Gray — secondary text |
| `--color-text-tertiary` | `#87867f` | Stone Gray — tertiary text |
| `--color-text-inverse` | `#faf9f5` | Text on dark backgrounds |
| `--color-text-on-dark` | `#b0aea5` | Warm Silver — text on dark |
| `--color-border` | `#f0eee6` | Border Cream — standard border |
| `--color-border-strong` | `#e8e6dc` | Border Warm — prominent border |
| `--color-border-dark` | `#30302e` | Border on dark surfaces |
| `--color-error` | `#b53333` | Error (warm red) |
| `--color-success` | `#2d8a4e` | Success (warm green) |
| `--color-warning` | `#b07800` | Warning (warm amber) |
| `--color-focus` | `#3898ec` | Focus ring (only cool color) |

### Typography

Songti SC (serif) used extensively — headings, buttons, navigation, card titles, labels, form labels. System sans-serif only for long body text and form input content.

**Font stacks**:
- `--font-heading`: `'Songti SC', 'STSongti SC', 'Noto Serif SC', 'SimSun', Georgia, serif`
- `--font-body`: `'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', system-ui, sans-serif`
- `--font-code`: `'JetBrains Mono', 'Fira Code', monospace`

**Type scale**:

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|------|------|------|--------|-------------|----------------|
| Display/Hero | Serif | clamp(2.5rem, 5vw, 3.25rem) | 500 | 1.05 | -0.02em |
| Section Heading | Serif | clamp(1.8rem, 3vw, 2rem) | 500 | 1.15 | normal |
| Sub-heading | Serif | 1.5rem | 500 | 1.20 | normal |
| Card Title | Serif | 1.25rem | 500 | 1.20 | normal |
| Body Large | Sans | 1.25rem | 400 | 1.60 | normal |
| Body | Sans | 1rem | 400 | 1.60 | normal |
| Caption | Sans | 0.875rem | 400 | 1.43 | normal |
| Overline | Serif | 0.625rem | 400 | 1.60 | 0.12em-0.2em |
| Code | Mono | 0.9375rem | 400 | 1.60 | -0.02em |

**Key principles**:
- Serif single weight: 500 for all serif text (no bold)
- Body line-height: 1.60 (generous, book-like reading)
- Hero letter-spacing: -0.02em (tighter for impact)
- Overline: uppercase + wide letter-spacing (editorial feel)

### Spacing & Radius

**Spacing**: 4px base unit. Scale: 4, 8, 12, 16, 24, 32, 48, 64.

**Border radius** — differentiated by layer, not uniform:

| Layer | Radius | Use |
|-------|--------|-----|
| Outer container | 20px | Page sections, major wrappers |
| Dark cards | 14px | Feature cards on dark backgrounds |
| Light cards | 10px | Cards on light backgrounds |
| Buttons | 6-8px | All button variants |
| Inputs | 12px | Form inputs |
| Small elements | 6px | Badges, tags |

### Shadow System

Ring-based shadows instead of traditional drop shadows.

```css
--shadow-ring: 0 0 0 1px var(--color-border);
--shadow-ring-hover: 0 0 0 1px #d1cfc5;
--shadow-whisper: 0 4px 24px rgba(0,0,0,0.05);
```

### Dark/Light Section Alternation

Pages alternate between Parchment (`#f5f4ed`) and Near Black (`#141413`) sections, creating chapter-like reading rhythm. Dark sections include grain texture overlay for depth.

## Component Design

### Buttons

| Variant | Background | Text | Border | Use |
|---------|-----------|------|--------|-----|
| Brand | `#c96442` | `#faf9f5` | none | Primary CTA |
| Warm Sand | `#e8e6dc` | `#4d4c48` | none | Secondary actions |
| Dark | `#30302e` | `#faf9f5` | none | Buttons on dark sections |
| White | `#ffffff` | `#141413` | `1px solid #f0eee6` | Elevated on light |
| Ghost | transparent | `#5e5d59` | `1px solid #e8e6dc` | Lowest emphasis |

All buttons: Songti SC serif, 6-8px radius, ring shadow on hover.

### Cards

- **Standard**: Ivory bg + Border Cream + 10px radius
- **Elevated**: Standard + whisper shadow + 10px radius
- **Dark**: Near Black bg + Dark Surface border + 14px radius + grain overlay
- **Feature accent**: Left accent bar (3px terracotta or charcoal) instead of full border

### Navigation

- Parchment/Ivory background + Border Cream bottom
- Songti SC serif for all nav items
- Active item: terracotta bottom indicator (2px)
- Default items: Olive Gray text
- Avatar: Warm Sand circle

### Forms

- Label: Songti SC serif, 14px, weight 500
- Input: Ivory bg + Border Cream + 12px radius
- Body font for input text (sans-serif for readability)
- Helper text: Stone Gray, 12px
- Focus: Focus Blue ring (only cool color in system)

### Tables (Admin)

- Header: Parchment bg + Border Warm bottom
- Rows: Ivory bg + Border Cream bottom
- Text: system sans-serif (data readability)
- Status badges: Songti SC serif

## Page Layouts

### Student Layout

- Fixed top nav (56px), Parchment background
- Content max-width: 1200px, centered
- Supports dark/light section alternation
- Nav items: 首页, 简历解析, 学习路径, 成长报告, 岗位图谱, 行业对比

### Admin Layout

- Fixed top nav + left sidebar (200px)
- Sidebar: Warm Sand background
- Active sidebar item: Parchment bg + terracotta right border
- Content: Parchment background

### Login Page

- 40/60 split: left brand panel (Near Black + gradient) + right form panel (Ivory)
- Left: large serif headline, terracotta accent, brand icon
- Right: form inputs + Brand CTA button

### Home Page (Magazine Editorial)

- **Hero**: 52px serif headline with -0.02em letter-spacing, terracotta overline, constrained subtitle width
- **Feature grid**: Asymmetric (1.2fr + 0.8fr), dark feature card spanning 2 rows, right cards with accent bars
- **Stats**: Inline within dark feature card (not separate section)
- **Decorative**: Large faded numbers ("12", "01"), grain texture overlay
- **Bottom ribbon**: Dark stats bar with inline metrics

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Build | Vite 6 |
| Framework | React 19 + TypeScript 5 |
| Routing | React Router v7 (data router) |
| UI Primitives | Radix UI (Dialog, Select, Popover, Tabs, etc.) |
| Styling | Tailwind CSS v4 + CSS custom properties |
| Data Fetching | TanStack Query v5 |
| Global State | Zustand (minimal, for auth/UI state) |
| Charts | ECharts (radar charts, visualizations) |
| Rich Text | TipTap (report editor) |

## Project Structure

```
frontend/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── public/
│   └── fonts/              # Noto Serif SC, Noto Sans SC woff2
├── src/
│   ├── main.tsx
│   ├── app.tsx             # Router + providers
│   ├── routes.tsx
│   ├── tokens/             # Design tokens (colors, typography, spacing, shadows)
│   ├── styles/
│   │   ├── globals.css     # Tailwind directives + CSS variables
│   │   └── fonts.css       # @font-face definitions
│   ├── components/
│   │   ├── ui/             # Base UI primitives (Button, Card, Input, Select, Table, Badge, Avatar, Dialog, Drawer, Toast, Skeleton, EmptyState)
│   │   ├── layout/         # AppShell, TopNav, Sidebar, PageHeader
│   │   └── domain/         # RadarChart, DimensionCard, ProgressTimeline, etc.
│   ├── pages/
│   │   ├── auth/           # Login, Register
│   │   ├── student/        # Home, ResumeDeconstruction, LearningPath, GrowthReport, JobCompetencyGraph, CrossIndustry
│   │   └── admin/          # JobPostings, UserManagement, JobComparisons, KnowledgeBase, Dashboard, Profile
│   ├── hooks/              # useAuth, useSSE, etc.
│   ├── lib/                # api.ts (fetcher + TanStack Query), auth.ts, sse.ts
│   └── types/              # competency.ts, api.ts, etc.
```

## Routes

```typescript
const routes = [
  { path: '/login', element: <Login />, layout: false },
  { path: '/register', element: <Register />, layout: false },

  // Student
  {
    element: <StudentLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/resume', element: <ResumeDeconstruction /> },
      { path: '/learning-path', element: <LearningPath /> },
      { path: '/growth-report', element: <GrowthReport /> },
      { path: '/job-graph', element: <JobCompetencyGraph /> },
      { path: '/cross-industry', element: <CrossIndustry /> },
    ],
  },

  // Admin
  {
    element: <AdminLayout />,
    children: [
      { path: '/admin/jobs', element: <JobPostings /> },
      { path: '/admin/users', element: <UserManagement /> },
      { path: '/admin/comparisons', element: <JobComparisons /> },
      { path: '/admin/knowledge', element: <KnowledgeBase /> },
      { path: '/admin/dashboard', element: <Dashboard /> },
      { path: '/admin/profile', element: <Profile /> },
    ],
  },

  { path: '*', element: <NotFound /> },
];
```

## API Integration

### Fetcher

```typescript
const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:9100';

async function fetcher<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${BASE_URL}${url}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}
```

### SSE Streaming

Supports NDJSON streaming for: resume parsing chat, report generation, goal planning, job transfer analysis.

```typescript
export function createSSEStream<T>(url: string, body: unknown): ReadableStream<T> {
  // POST to endpoint, read NDJSON lines from response body
  // Parse each line as JSON, emit to stream consumer
}
```

### TanStack Query Hooks

Each API module gets a hooks file:
- `useResumeParsing()` — mutation for file upload
- `useJobPostings(params)` — paginated query
- `useGrowthReport()` — query + SSE streaming
- `useLearningPath()` — query for learning resources

## Implementation Phases

| Phase | Content | Est. Days |
|-------|---------|-----------|
| P0: Infrastructure | Vite project, Tailwind + Radix config, design tokens, font loading, router, TanStack Query, auth | 2-3 |
| P1: Design System | Button, Card, Input, Select, Table, Badge, Dialog, Drawer, Toast, Skeleton, EmptyState, AppShell, TopNav, Sidebar, PageHeader | 3-4 |
| P2: Core Pages | Login/Register, Home (magazine editorial), Resume Deconstruction | 3-4 |
| P3: Learning & Reports | Learning Path, Growth Report | 2-3 |
| P4: Job & Comparison | Job Competency Graph, Cross-Industry Comparison | 2-3 |
| P5: Admin | Job Postings, User Management, Comparisons, Knowledge Base, Dashboard | 3-4 |
| P6: Polish | Responsive adaptation, dark/light section alternation, animations, testing, cleanup | 2-3 |

**Total**: ~17-24 days

## Do's and Don'ts

### Do
- Use Parchment (`#f5f4ed`) as primary page background
- Use Songti SC serif extensively (headings, buttons, nav, labels, card titles)
- Use Terracotta (`#c96442`) only for primary CTAs and brand moments
- Differentiate border radius by layer (20px/14px/10px/8px/6px)
- Use ring shadows for interactive states
- Use grain texture on dark sections for depth
- Use large faded decorative numbers for editorial feel
- Maintain 1.60 body line-height for book-like reading

### Don't
- Don't use cool blue-grays anywhere
- Don't use uniform border radius across all elements
- Don't use traditional drop shadows
- Don't use pure white (`#ffffff`) as page background
- Don't use sans-serif for headings or UI labels
- Don't reduce body line-height below 1.40
- Don't use generic card grid layouts without hierarchy
- Don't create template-looking UI (flat, uniform, no visual tension)
