# Coach Markdown Rendering Optimization — Implementation Plan

**Date:** 2026-05-13
**Spec:** `docs/superpowers/specs/2026-05-13-coach-markdown-optimization-design.md`
**Complexity:** LOW — 4 files, no new files, append-only backend change

## Phase 1: Backend — System Prompt Formatting Guardrails

**File:** `backend/app/services/context_builder.py`

Append a `--- 回复格式规范 ---` block in `build_system_prompt()`, after the existing `--- 业务数据读取规则 ---` and before `return`.

- Emoji ban, italic emphasis rules, paragraph structure, heading/list constraints
- Single block, applies to all 5 agents uniformly
- Append-only — no existing logic modified

## Phase 2: Frontend — StreamingText.tsx CSS Rewrite

**File:** `myapp/src/pages/coach/components/StreamingText.tsx`

Replace `markdownBody` CSS with editorial typography:
- Serif headings (Georgia/STSongti SC), weight 500, differentiated margins per level
- Body 15px / 1.75 line-height / charcoalWarm
- em → terracotta italic; strong → muted small-cap label
- blockquote → editorial pullquote (thin vertical line, no background)
- ul/ol → 8px item spacing; hr → gradient fade
- code/pre → keep existing dark surface style
- `p:first-of-type` lead style — progressive; skip if conflicts with block splitting

## Phase 3: Frontend — Table + Emoji Font

**Files:** `myapp/src/pages/coach/components/MarkdownTable.tsx`, `myapp/src/global.css`

- **MarkdownTable:** body font 14px (up from 13), header gradient refined
- **global.css:** Twemoji `@import` for emoji font stack

## Phase 4: Verification

1. Restart dev server, open coach page, test message rendering
2. Verify serif headings, italic emphasis, editorial spacing
3. Twemoji rendering on historical emoji messages
4. Backend: `build_system_prompt()` output includes format rules for all agents
5. Send emoji-prone prompt, confirm LLM output is emoji-free

## Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| `p:first-of-type` conflicts with block-split rendering | LOW | Skip if unreliable |
| LLM becomes too stiff | LOW | Rules constrain format only, not persona |
| Twemoji CDN unavailable | LOW | Fallback to system emoji fonts |
| Mako HMR misses CSS change | LOW | Restart dev server if needed |
