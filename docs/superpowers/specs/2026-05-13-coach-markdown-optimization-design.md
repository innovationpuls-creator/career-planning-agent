# Coach Markdown Rendering Optimization — Design Spec

**Date:** 2026-05-13
**Status:** Approved
**Scope:** Coach chat markdown rendering (CSS) + LLM output formatting (system prompt)

## Problem

The coach interface markdown rendering has heavy "AI flavor":
- Outdated emojis (📚🎯✨🚀💡) used as heading prefixes and paragraph markers
- Bold keywords in nearly every sentence, flattening emphasis
- Flat typographic hierarchy — uniform spacing, single body size, no lead/footnote layers
- Monotonous font sizing following a basic 1.8em/1.5em/1.25em sans-serif scale

Root cause spans two layers: the backend system prompt has no formatting constraints, and the frontend CSS doesn't express the Claude editorial design system.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Typographic direction | Editorial / magazine — serif headings, generous spacing |
| Emphasis | Italic for gentle emphasis (`em`), bold reserved for structural labels only |
| Emoji policy (generation) | Ban all Unicode emojis in LLM output |
| Emoji policy (rendering) | Twemoji CSS font as defensive layer for history/system messages |
| Approach scope | CSS rewrite + system prompt guardrails (not post-processing) |

## Changes

### 1. Frontend — `StreamingText.tsx` markdownBody CSS

**Font hierarchy:**

| Element | Font | Size | Weight | Line-height |
|---------|------|------|--------|-------------|
| h1 | Georgia / STSongti SC serif | 24px | 500 | 1.2 |
| h2 | Georgia / STSongti SC serif | 20px | 500 | 1.25 |
| h3 | Georgia / STSongti SC serif | 17px | 500 | 1.3 |
| Body p | System sans-serif | 15px | 400 | 1.75 |
| Lead/intro p | System sans-serif | 16px | 400 | 1.7 |
| Footnote | System sans-serif | 13px | 400 | 1.6 |

**Heading margin differentiation (replacing uniform 24/12):**

| Element | margin-top | margin-bottom |
|---------|-----------|---------------|
| h1 | 36px | 10px |
| h2 | 32px | 8px |
| h3 | 24px | 6px |

**Inline elements:**

- `em` → `color: terracotta; font-style: italic;` (terracotta whisper — distinctive without shouting)
- `strong` → small-cap label style (`font-size: 12px; letter-spacing: 0.05em; color: charcoalWarm`), for structural labels only
- `blockquote` → editorial pullquote: thin vertical line (2px, terracotta 50% opacity), no background fill, body text at 16px serif
- `ul/ol` → item spacing 8px (up from 4px), indent 22px
- `hr` → gradient fade-out to transparent, 24px margin
- `code/pre` → keep existing dark surface style (already matches Claude design)

**Body text:** 15px / 1.75 line-height / `color: charcoalWarm` (was 14px / 1.6 / nearBlack)

Potential lead paragraph styling via `p:first-of-type` — larger (16px) and lighter color (oliveGray). This is a progressive enhancement; if the selector proves unreliable with the block-splitting logic, skip it.

### 2. Frontend — `MarkdownTable.tsx` refinement

Keep the existing glass-styled table. Minor adjustments:
- Match body font size (up from 13px to match new body)
- Adjust header bg to match the warm editorial palette

### 3. Frontend — Emoji font defensive layer

Add Twemoji CSS font to the global stylesheet (e.g., `myapp/src/global.css`):

```css
@import url('https://cdn.jsdelivr.net/npm/twemoji-colr-font@15.0.3/twemoji.css');
```

The `markdownBody` font-family stack should lead with `"Twemoji Mozilla"` for emoji codepoints, falling back to system emoji fonts. CSS-only approach — no JS parsing, zero runtime cost, no streaming flicker.

### 4. Backend — `context_builder.py` formatting guardrails

Append a formatting rules block after the existing `--- 业务数据读取规则 ---` section in `build_system_prompt()`. Same rules apply to all agents (ResumeCoach, CareerMatchCoach, LearningPathCoach, ReportCoach, CareerCoach).

**Rules:**

| Rule | Allow | Forbid |
|------|-------|--------|
| Emoji | None — no Unicode emoji anywhere | 📚🎯✨🚀💡📋🔧🤝📌⭐ and all others |
| Heading prefixes | Pure text (`## 技术能力分析`) | Emoji-prefixed headings (`## 📚 XXX`) |
| Emphasis | `_italic_` for gentle conceptual emphasis; bold only for `**标签:**` structural labels | Mid-sentence bold keyword emphasis in every paragraph |
| Paragraph structure | Lead overview → section detail → footnote close; 2-4 sentences per paragraph | Single-sentence paragraphs; paragraphs over 5 sentences |
| Lists | Unordered for parallel suggestions; ordered for steps; max ~7 items | Emoji-prefixed list items |
| Tone | Friendly, encouraging — warmth through wording, not decoration | Emoji as emotional crutches; formulaic templates |

The formatting block is appended once in `build_system_prompt()`, after the business data rules and before the return statement. It applies to all agents uniformly.

## Files Modified

| File | Change |
|------|--------|
| `myapp/src/pages/coach/components/StreamingText.tsx` | Rewrite `markdownBody` CSS — full typography, spacing, inline elements |
| `myapp/src/pages/coach/components/MarkdownTable.tsx` | Minor font/color adjustments to match editorial style |
| `myapp/src/global.css` | Add Twemoji `@import` for emoji font stack |
| `backend/app/services/context_builder.py` | Append formatting guardrails block in `build_system_prompt()` |

## What Does NOT Change

- `react-markdown` + `remarkGfm` rendering pipeline (unchanged)
- Streaming block detection logic in `useStreamingAnimation` (unchanged)
- `MessageBubble` user message styling (unchanged — user messages are plain text, not markdown)
- `SystemMessage` styling (unchanged)
- `CoachChatBody` layout/structure (unchanged beyond optional empty-state tweak)
- `MarkdownTable` glass surface approach (unchanged, minor adjustments only)
- Agent personality prompts (unchanged — formatting is orthogonal to agent persona)

## Verification

1. **Unit:** Verify `build_system_prompt()` output contains the formatting rules block for all 5 agents
2. **Visual:** Run the coach page, send a message, verify the rendered markdown follows the editorial hierarchy
3. **System prompt:** Send a request whose response would historically contain emojis (e.g., "给我几个职业建议") and verify the LLM output contains no emoji
4. **History:** Open a historical session with emoji-containing messages, verify Twemoji renders them consistently
5. **Keyboard:** Tab through coach input, verify focus ring uses the design system's Focus Blue
