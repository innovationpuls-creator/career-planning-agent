# Coach Glass Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Coach chat interface from flat glassmorphism into a layered Glass Architecture with dark glass sidebar, light glass main panel, dynamic light orbs, and noise texture.

**Architecture:** Two-panel glass layout inside a full-viewport canvas. Dark Glass sidebar (260px, `rgba(48,48,46,0.55)`, blur 24px) on the left. Light Glass main panel (`rgba(255,255,255,0.22)`, blur 28px saturate 140%) fills remaining space. Canvas has 2-3 animated radial-gradient orbs + SVG noise overlay. All components use glass surface tokens from a shared token system.

**Tech Stack:** React + TypeScript, antd-style `createStyles`, framer-motion, existing Claude token system.

---

## Task 1: Glass Token System

**Files:**
- Modify: `myapp/src/styles/claude-tokens.ts`

- [ ] **Step 1: Add glass surface tokens and blur presets**

Add after the existing `claudeColors` block (before `claudeAlpha`):

```typescript
// ── Glass surface presets ─────────────────────────────────────

export const claudeGlass = {
  // Surface fills
  dark: 'rgba(48, 48, 46, 0.55)',
  mid: 'rgba(48, 48, 46, 0.35)',
  light: 'rgba(255, 255, 255, 0.22)',
  ghost: 'rgba(255, 255, 255, 0.12)',
  terracotta: 'rgba(201, 100, 66, 0.10)',
  input: 'rgba(255, 255, 255, 0.20)',
  bubbleAI: 'rgba(250, 249, 245, 0.45)',
  bubbleUser: 'rgba(201, 100, 66, 0.08)',
  skillPanel: 'rgba(250, 249, 245, 0.80)',
  cli: 'rgba(245, 240, 232, 0.55)',
  errorBg: 'rgba(181, 51, 51, 0.15)',
  // Borders
  borderDark: 'rgba(255, 255, 255, 0.18)',
  borderLight: 'rgba(255, 255, 255, 0.45)',
  borderGhost: 'rgba(255, 255, 255, 0.25)',
  borderInput: 'rgba(255, 255, 255, 0.40)',
  borderTerracotta: 'rgba(201, 100, 66, 0.20)',
  borderCLI: 'rgba(200, 185, 160, 0.30)',
  borderError: 'rgba(181, 51, 51, 0.30)',
  // Blur levels
  blurHeavy: 'blur(28px)',
  blurMedium: 'blur(24px)',
  blurLight: 'blur(16px)',
  blurSubtle: 'blur(12px)',
  blurMicro: 'blur(8px)',
  // Saturation boost for light glass
  saturate: 'saturate(140%)',
  // Inner glow
  innerGlow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.2)',
  // Button glow
  btnGlow: '0 4px 16px rgba(201, 100, 66, 0.35)',
} as const;

// ── Glass surface helpers ─────────────────────────────────────

export const glassSurface = (
  fill: string,
  blur: string,
  border: string,
  extra?: string,
): string =>
  [
    `background: ${fill}`,
    `backdrop-filter: ${blur}`,
    `-webkit-backdrop-filter: ${blur}`,
    `border: 1px solid ${border}`,
    extra,
  ]
    .filter(Boolean)
    .join(';');
```

Add glass to the `claudeTokens` export:

```typescript
export const claudeTokens = {
  colors: claudeColors,
  shadows: claudeShadows,
  radius: claudeRadius,
  fonts: claudeFonts,
  glass: claudeGlass,
} as const;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd myapp && npx tsc --noEmit --pretty false 2>&1 | head -20
```
Expected: No new errors from `claude-tokens.ts`.

- [ ] **Step 3: Commit**

```bash
git add myapp/src/styles/claude-tokens.ts
git commit -m "feat: add glass surface tokens and blur presets to design system"
```

---

## Task 2: Shell & Canvas Background

**Files:**
- Modify: `myapp/src/pages/coach/index.tsx`
- Modify: `myapp/src/pages/coach/motion.ts`

- [ ] **Step 1: Add orb float keyframes to motion.ts**

Append to `myapp/src/pages/coach/motion.ts`:

```typescript
import { keyframes } from 'antd-style';

export const orbFloat1 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); border-radius: 48% 52% 58% 42%; }
  33% { transform: translate(20px, -30px) scale(1.05); border-radius: 55% 45% 40% 60%; }
  66% { transform: translate(-15px, 20px) scale(0.97); border-radius: 42% 58% 50% 50%; }
`;

export const orbFloat2 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); border-radius: 52% 48% 44% 56%; }
  33% { transform: translate(-18px, 25px) scale(1.04); border-radius: 40% 60% 55% 45%; }
  66% { transform: translate(14px, -22px) scale(0.96); border-radius: 50% 50% 48% 52%; }
`;
```

- [ ] **Step 2: Rewrite index.tsx styles and shell**

In `myapp/src/pages/coach/index.tsx`, replace the `useStyles` block. The current file starts with:

```typescript
import { PageError, PageLoading } from '@/components/ui';
import { createStyles, keyframes } from 'antd-style';
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from '@umijs/max';
import { claudeColors, claudeAlpha, claudeRadius } from '@/styles/claude-tokens';
```

Change the import to also include glass tokens:

```typescript
import { PageError, PageLoading } from '@/components/ui';
import { createStyles } from 'antd-style';
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from '@umijs/max';
import { claudeColors, claudeAlpha, claudeRadius, claudeGlass } from '@/styles/claude-tokens';
import { orbFloat1, orbFloat2 } from './motion';
```

Replace the entire `useStyles` block (lines 19-124) with:

```typescript
const useStyles = createStyles(({ css }) => ({
  shell: css`
    min-height: 100vh;
    margin: -24px;
    position: relative;
    overflow: hidden;
  `,
  canvas: css`
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background: linear-gradient(
      140deg,
      #f0e9db 0%,
      #e6d9c4 30%,
      #ede4d5 60%,
      #f3ede2 100%
    );
  `,
  orb: css`
    position: absolute;
    border-radius: 50%;
    filter: blur(50px);
    pointer-events: none;
  `,
  orb1: css`
    top: -8%;
    right: -6%;
    width: 42%;
    height: 60%;
    background: radial-gradient(
      ellipse,
      ${claudeAlpha(claudeColors.terracotta, 0.28)} 0%,
      transparent 72%
    );
    animation: ${orbFloat1} 25s infinite ease-in-out;
  `,
  orb2: css`
    bottom: -10%;
    left: 20%;
    width: 38%;
    height: 50%;
    background: radial-gradient(
      ellipse,
      rgba(74, 144, 226, 0.16) 0%,
      transparent 70%
    );
    animation: ${orbFloat2} 30s infinite ease-in-out;
  `,
  orb3: css`
    top: 40%;
    left: 45%;
    width: 30%;
    height: 40%;
    background: radial-gradient(
      ellipse,
      ${claudeAlpha(claudeColors.success, 0.12)} 0%,
      transparent 70%
    );
    filter: blur(45px);
    animation: ${orbFloat2} 22s infinite ease-in-out reverse;
  `,
  noise: css`
    position: absolute;
    inset: 0;
    opacity: 0.022;
    z-index: 3;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  `,
  content: css`
    position: relative;
    z-index: 2;
    height: calc(100vh - 48px);
    padding: 10px 12px;
    display: flex;
    gap: 12px;
  `,
  sidebar: css`
    width: 260px;
    flex-shrink: 0;
    border-radius: 20px;
    background: ${claudeGlass.dark};
    backdrop-filter: ${claudeGlass.blurMedium};
    -webkit-backdrop-filter: ${claudeGlass.blurMedium};
    border: 1px solid ${claudeGlass.borderDark};
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `,
  main: css`
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    min-width: 0;
    border-radius: 22px;
    background: ${claudeGlass.light};
    backdrop-filter: ${claudeGlass.blurHeavy} ${claudeGlass.saturate};
    -webkit-backdrop-filter: ${claudeGlass.blurHeavy} ${claudeGlass.saturate};
    border: 1px solid ${claudeGlass.borderLight};
    box-shadow:
      0 12px 48px rgba(0, 0, 0, 0.04),
      ${claudeGlass.innerGlow};
    overflow: hidden;
  `,
}));
```

Replace the JSX return block (lines 225-272) with:

```tsx
return (
  <div className={styles.shell}>
    <div className={styles.canvas}>
      <div className={`${styles.orb} ${styles.orb1}`} />
      <div className={`${styles.orb} ${styles.orb2}`} />
      <div className={`${styles.orb} ${styles.orb3}`} />
      <div className={styles.noise} />
    </div>
    <div className={styles.content}>
      <div className={styles.sidebar}>
        <CoachChatSidebar
          sessions={sessions}
          activeSessionId={chat.currentSessionId}
          loading={sessionsLoading}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
        />
      </div>
      <div className={styles.main}>
        <GlobalErrorBar
          visible={chat.errorMessage !== null}
          message={chat.errorMessage || ''}
          onClose={chat.clearError}
          onRetry={() => chat.retry()}
        />
        <CoachChatHeader
          activeAgent={chat.activeAgent}
          onNewSession={handleNewSession}
        />
        <CoachChatBody
          messages={chat.messages}
          isStreaming={isBusy}
        />
        <PendingUploads
          uploads={chat.pendingUploads}
          onRemove={chat.removeUpload}
        />
        <CoachChatInput
          onSend={handleSend}
          onStop={chat.abort}
          onUpload={chat.uploadFile}
          isBusy={isBusy}
          skills={skills}
        />
      </div>
    </div>
  </div>
);
```

Remove these now-unused imports from the top:
- Remove `keyframes` from `'antd-style'` import (only `createStyles` needed)
- Remove unused style class references

- [ ] **Step 3: Verify TypeScript compiles and no runtime crash**

```bash
cd myapp && npx tsc --noEmit --pretty false 2>&1 | head -30
```
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add myapp/src/pages/coach/index.tsx myapp/src/pages/coach/motion.ts
git commit -m "feat: rewrite coach shell with glass canvas, dynamic orbs, and double-panel layout"
```

---

## Task 3: Dark Glass Sidebar

**Files:**
- Modify: `myapp/src/pages/coach/components/CoachChatSidebar.tsx`

- [ ] **Step 1: Rewrite CoachChatSidebar with Dark Glass styling**

Replace the entire file content:

```tsx
import { Button, List, Skeleton } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import React from 'react';
import { createStyles } from 'antd-style';
import { claudeColors, claudeGlass } from '@/styles/claude-tokens';
import type { CoachSession } from '../api';

const useStyles = createStyles(({ css }) => ({
  container: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    background: transparent;
  `,
  header: css`
    padding: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.10);
  `,
  newBtn: css`
    width: 100%;
    border: 1px dashed rgba(255, 255, 255, 0.20);
    background: rgba(255, 255, 255, 0.08);
    color: ${claudeColors.warmSilver};
    border-radius: 10px;
    &:hover {
      border-color: rgba(255, 255, 255, 0.35) !important;
      color: ${claudeColors.ivory} !important;
      background: rgba(255, 255, 255, 0.12) !important;
    }
  `,
  list: css`
    flex: 1;
    overflow-y: auto;
  `,
  title: css`
    color: ${claudeColors.warmSilver};
    font-size: 11px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    padding: 14px 14px 8px;
  `,
  item: css`
    cursor: pointer;
    padding: 8px 14px !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
    transition: background 0.15s;
    &:hover {
      background: rgba(255, 255, 255, 0.06) !important;
    }
  `,
  itemActive: css`
    background: rgba(201, 100, 66, 0.18) !important;
    border-left: 2px solid ${claudeColors.terracotta};
  `,
  itemTitle: css`
    color: ${claudeColors.warmSilver} !important;
    font-size: 13px !important;
  `,
  itemMeta: css`
    color: rgba(176, 174, 165, 0.6) !important;
    font-size: 11px !important;
  `,
  empty: css`
    padding: 24px;
    text-align: center;
    color: rgba(176, 174, 165, 0.5);
    font-size: 13px;
  `,
}));

interface CoachChatSidebarProps {
  sessions: CoachSession[];
  activeSessionId?: string | null;
  loading?: boolean;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}

export function CoachChatSidebar({
  sessions,
  activeSessionId,
  loading,
  onSelectSession,
  onNewSession,
}: CoachChatSidebarProps) {
  const { styles } = useStyles();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button
          className={styles.newBtn}
          icon={<PlusOutlined />}
          onClick={onNewSession}
        >
          新对话
        </Button>
      </div>

      <div className={styles.title}>Sessions</div>

      <div className={styles.list}>
        {loading ? (
          <div style={{ padding: 12 }}>
            <Skeleton
              active
              paragraph={{ rows: 3 }}
              title={false}
            />
          </div>
        ) : sessions.length === 0 ? (
          <div className={styles.empty}>尚无对话</div>
        ) : (
          <List
            size="small"
            dataSource={sessions}
            renderItem={(session) => (
              <List.Item
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`${styles.item} ${
                  session.id === activeSessionId ? styles.itemActive : ''
                }`}
              >
                <List.Item.Meta
                  title={
                    <span className={styles.itemTitle}>
                      {session.title}
                    </span>
                  }
                  description={
                    <span className={styles.itemMeta}>
                      {session.messageCount} 条消息
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd myapp && npx tsc --noEmit --pretty false 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add myapp/src/pages/coach/components/CoachChatSidebar.tsx
git commit -m "feat: rewrite sidebar with dark glass styling and terracotta active state"
```

---

## Task 4: Glass Header & Agent Badge

**Files:**
- Modify: `myapp/src/pages/coach/components/CoachChatHeader.tsx`
- Modify: `myapp/src/pages/coach/components/AgentBadge.tsx`

- [ ] **Step 1: Rewrite CoachChatHeader with Ghost Glass**

Replace `myapp/src/pages/coach/components/CoachChatHeader.tsx`:

```tsx
import { Button } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { claudeColors, claudeGlass } from '@/styles/claude-tokens';
import { AgentBadge } from './AgentBadge';

const useStyles = createStyles(({ css }) => ({
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid ${claudeGlass.borderGhost};
    background: ${claudeGlass.ghost};
    backdrop-filter: ${claudeGlass.blurLight};
    -webkit-backdrop-filter: ${claudeGlass.blurLight};
    min-height: 48px;
    flex-shrink: 0;
  `,
  left: css`
    display: flex;
    align-items: center;
    gap: 10px;
  `,
  dot: css`
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${claudeColors.terracotta};
    box-shadow: 0 0 12px ${claudeColors.terracotta}80;
  `,
  title: css`
    font-size: 13px;
    color: ${claudeColors.oliveGray};
  `,
  newBtn: css`
    border-radius: 10px;
    background: ${claudeGlass.ghost};
    backdrop-filter: ${claudeGlass.blurMicro};
    -webkit-backdrop-filter: ${claudeGlass.blurMicro};
    border: 1px solid ${claudeGlass.borderGhost};
    color: ${claudeColors.oliveGray};
    font-size: 12px;
    height: 30px;
    &:hover {
      background: rgba(255, 255, 255, 0.18) !important;
      border-color: rgba(255, 255, 255, 0.35) !important;
    }
  `,
}));

interface CoachChatHeaderProps {
  activeAgent: string | null;
  onNewSession: () => void;
}

export function CoachChatHeader({
  activeAgent,
  onNewSession,
}: CoachChatHeaderProps) {
  const { styles } = useStyles();

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <span className={styles.dot} />
        {activeAgent ? (
          <AgentBadge agent={activeAgent} />
        ) : (
          <span className={styles.title}>AI 职业规划教练</span>
        )}
      </div>
      <Button className={styles.newBtn} size="small" onClick={onNewSession}>
        新对话
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite AgentBadge with glass terracotta style**

Replace `myapp/src/pages/coach/components/AgentBadge.tsx`:

```tsx
import { createStyles } from 'antd-style';
import React from 'react';
import { claudeColors } from '@/styles/claude-tokens';

const useStyles = createStyles(({ css }) => ({
  badge: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 10px;
    background: rgba(201, 100, 66, 0.12);
    border: 1px solid rgba(201, 100, 66, 0.22);
    font-size: 12px;
    color: ${claudeColors.terracotta};
    font-weight: 500;
  `,
}));

interface AgentBadgeProps {
  agent: string;
}

export function AgentBadge({ agent }: AgentBadgeProps) {
  const { styles } = useStyles();
  return <span className={styles.badge}>{agent}</span>;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd myapp && npx tsc --noEmit --pretty false 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add myapp/src/pages/coach/components/CoachChatHeader.tsx myapp/src/pages/coach/components/AgentBadge.tsx
git commit -m "feat: rewrite header with ghost glass and terracotta glass agent badge"
```

---

## Task 5: Glass Message Components

**Files:**
- Modify: `myapp/src/pages/coach/components/MessageBubble.tsx`
- Modify: `myapp/src/pages/coach/components/AssistantMessage.tsx`
- Modify: `myapp/src/pages/coach/components/SystemMessage.tsx`

- [ ] **Step 1: Rewrite MessageBubble (user — terracotta glass)**

Replace `myapp/src/pages/coach/components/MessageBubble.tsx`:

```tsx
import React from 'react';
import { motion } from 'framer-motion';
import { createStyles } from 'antd-style';
import { Tag } from 'antd';
import { claudeColors, claudeGlass } from '@/styles/claude-tokens';
import { prefersReducedMotion } from '@/styles/motion';
import { fadeInRight, TRANSITION } from '../motion';
import type { CoachMessage } from '../types';

const useStyles = createStyles(({ css }) => ({
  row: css`
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  `,
  avatar: css`
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(250, 249, 245, 0.40);
    backdrop-filter: ${claudeGlass.blurMicro};
    -webkit-backdrop-filter: ${claudeGlass.blurMicro};
    border: 1px solid rgba(200, 185, 160, 0.35);
    color: ${claudeColors.oliveGray};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    flex-shrink: 0;
  `,
  bubble: css`
    max-width: 70%;
    padding: 10px 14px;
    border-radius: 18px 18px 6px 18px;
    background: ${claudeGlass.bubbleUser};
    backdrop-filter: ${claudeGlass.blurSubtle};
    -webkit-backdrop-filter: ${claudeGlass.blurSubtle};
    border: 1px solid ${claudeGlass.borderTerracotta};
    color: ${claudeColors.nearBlack};
    font-size: 14px;
    line-height: 1.6;
    word-break: break-word;
  `,
  fileChip: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    padding: 4px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.30);
    backdrop-filter: ${claudeGlass.blurMicro};
    border: 1px solid rgba(255, 255, 255, 0.30);
    font-size: 12px;
    color: ${claudeColors.stoneGray};
  `,
  skillTag: css`
    margin-bottom: 8px;
  `,
}));

interface MessageBubbleProps {
  message: CoachMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { styles } = useStyles();
  const reduced = prefersReducedMotion();

  return (
    <motion.div
      className={styles.row}
      initial={reduced ? { opacity: 0 } : fadeInRight.initial}
      animate={fadeInRight.animate}
      transition={TRANSITION.fast}
    >
      <div className={styles.bubble}>
        {message.selectedSkill && (
          <div className={styles.skillTag}>
            <Tag>{message.selectedSkill.label || message.selectedSkill.name}</Tag>
          </div>
        )}
        <div>{message.content}</div>
        {message.attachments && message.attachments.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {message.attachments.map((att) => (
              <span key={att.fileId} className={styles.fileChip}>
                {att.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={styles.avatar}>U</div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Rewrite AssistantMessage (AI — light glass)**

Replace `myapp/src/pages/coach/components/AssistantMessage.tsx`:

```tsx
import { createStyles } from 'antd-style';
import { motion } from 'framer-motion';
import React from 'react';
import { claudeColors, claudeGlass } from '@/styles/claude-tokens';
import { prefersReducedMotion } from '@/styles/motion';
import { fadeInUp, TRANSITION } from '../motion';
import type { CoachMessage } from '../types';
import { AgentRunTimeline } from './AgentRunTimeline';
import { StreamingText } from './StreamingText';

const useStyles = createStyles(({ css }) => ({
  row: css`
    display: flex;
    gap: 8px;
  `,
  avatar: css`
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(48, 48, 46, 0.60);
    backdrop-filter: ${claudeGlass.blurMicro};
    -webkit-backdrop-filter: ${claudeGlass.blurMicro};
    color: ${claudeColors.warmSilver};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    flex-shrink: 0;
  `,
  body: css`
    flex: 1;
    min-width: 0;
    font-size: 14px;
    line-height: 1.6;
    color: ${claudeColors.nearBlack};
    & > *:first-child { margin-top: 0; }
    & > *:last-child { margin-bottom: 0; }
  `,
  answer: css`
    padding: 10px 14px;
    background: ${claudeGlass.bubbleAI};
    backdrop-filter: ${claudeGlass.blurSubtle};
    -webkit-backdrop-filter: ${claudeGlass.blurSubtle};
    border: 1px solid ${claudeGlass.borderLight};
    border-radius: 18px 18px 18px 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    margin-top: 4px;
  `,
  errorText: css`
    color: ${claudeColors.error};
    font-size: 12px;
    margin-top: 4px;
  `,
}));

interface AssistantMessageProps {
  message: CoachMessage;
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  const { styles } = useStyles();
  const reduced = prefersReducedMotion();
  return (
    <motion.div
      className={styles.row}
      initial={reduced ? { opacity: 0 } : fadeInUp.initial}
      animate={fadeInUp.animate}
      transition={TRANSITION.normal}
    >
      <div className={styles.avatar}>AI</div>
      <div className={styles.body}>
        <AgentRunTimeline
          steps={message.runTrace}
          status={message.status}
          metrics={message.metrics}
        />
        <div className={styles.answer}>
          <StreamingText content={message.content} status={message.status} />
        </div>
        {message.error && (
          <div className={styles.errorText}>{message.error}</div>
        )}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 3: Rewrite SystemMessage (ghost glass)**

Replace `myapp/src/pages/coach/components/SystemMessage.tsx`:

```tsx
import React from 'react';
import { createStyles } from 'antd-style';
import { claudeColors, claudeGlass } from '@/styles/claude-tokens';

const useStyles = createStyles(({ css }) => ({
  row: css`
    display: flex;
    justify-content: center;
    padding: 4px 0;
  `,
  bubble: css`
    padding: 6px 14px;
    border-radius: 10px;
    background: ${claudeGlass.ghost};
    backdrop-filter: ${claudeGlass.blurMicro};
    -webkit-backdrop-filter: ${claudeGlass.blurMicro};
    border: 1px solid ${claudeGlass.borderGhost};
    font-size: 12px;
    color: ${claudeColors.stoneGray};
    text-align: center;
    max-width: 80%;
  `,
  error: css`
    background: rgba(181, 51, 51, 0.10);
    border-color: rgba(181, 51, 51, 0.25);
    color: ${claudeColors.error};
  `,
  success: css`
    background: rgba(74, 124, 63, 0.08);
    border-color: rgba(74, 124, 63, 0.20);
    color: ${claudeColors.success};
  `,
}));

interface SystemMessageProps {
  kind?: 'info' | 'error' | 'success';
  content: string;
}

export function SystemMessage({ kind = 'info', content }: SystemMessageProps) {
  const { styles } = useStyles();

  const kindClass =
    kind === 'error'
      ? styles.error
      : kind === 'success'
        ? styles.success
        : undefined;

  return (
    <div className={styles.row}>
      <div className={`${styles.bubble} ${kindClass || ''}`}>{content}</div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd myapp && npx tsc --noEmit --pretty false 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add myapp/src/pages/coach/components/MessageBubble.tsx myapp/src/pages/coach/components/AssistantMessage.tsx myapp/src/pages/coach/components/SystemMessage.tsx
git commit -m "feat: rewrite message components with glass bubble styles"
```

---

## Task 6: Glass Chat Body

**Files:**
- Modify: `myapp/src/pages/coach/components/CoachChatBody.tsx`

- [ ] **Step 1: Update CoachChatBody for transparent background**

Replace `myapp/src/pages/coach/components/CoachChatBody.tsx`. The change is minimal — replace current styles with transparent background and glass-themed empty state:

```tsx
import React, { useEffect, useRef } from 'react';
import { createStyles } from 'antd-style';
import { claudeColors } from '@/styles/claude-tokens';
import type { CoachMessage } from '../types';
import { AssistantMessage } from './AssistantMessage';
import { MessageBubble } from './MessageBubble';
import { SystemMessage } from './SystemMessage';

const useStyles = createStyles(({ css }) => ({
  container: css`
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    scroll-behavior: smooth;
    background: transparent;
  `,
  empty: css`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: ${claudeColors.stoneGray};
    font-size: 14px;
    text-align: center;
    padding: 32px;
    opacity: 0.7;
  `,
}));

interface CoachChatBodyProps {
  messages: CoachMessage[];
  isStreaming: boolean;
}

export function CoachChatBody({
  messages,
  isStreaming,
}: CoachChatBodyProps) {
  const { styles } = useStyles();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    isUserScrolledUpRef.current = !isNearBottom;
  }, [messages.length]);

  useEffect(() => {
    if (!isUserScrolledUpRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>你好！我是你的 AI 职业规划教练，有什么可以帮你的？</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} ref={containerRef}>
      {messages.map((msg) => {
        switch (msg.role) {
          case 'user':
            return <MessageBubble key={msg.id} message={msg} />;
          case 'assistant':
            return <AssistantMessage key={msg.id} message={msg} />;
          case 'system':
            return (
              <SystemMessage
                key={msg.id}
                kind="info"
                content={msg.content}
              />
            );
          default:
            return null;
        }
      })}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add myapp/src/pages/coach/components/CoachChatBody.tsx
git commit -m "feat: update chat body with transparent background for glass panel"
```

---

## Task 7: Glass Input & Skill Palette

**Files:**
- Modify: `myapp/src/pages/coach/components/CoachChatInput.tsx`

- [ ] **Step 1: Rewrite CoachChatInput with full glass styling**

Replace `myapp/src/pages/coach/components/CoachChatInput.tsx`. The logic (slash commands, palette filtering, keyboard handling) stays identical. Only the `useStyles` block and button markup change.

Keep all imports, hooks, and handlers EXACTLY as they are. Only change:

**Replace the `useStyles` block** (lines 13-85) with:

```typescript
const useStyles = createStyles(({ css, token }) => ({
  bar: css`
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid ${claudeGlass.borderGhost};
    background: transparent;
    flex-shrink: 0;
  `,
  uploadBtn: css`
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.20);
    backdrop-filter: ${claudeGlass.blurMicro};
    -webkit-backdrop-filter: ${claudeGlass.blurMicro};
    border: 1px solid ${claudeGlass.borderInput};
    color: ${claudeColors.stoneGray};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    &:hover {
      background: rgba(255, 255, 255, 0.30) !important;
    }
  `,
  inputWrap: css`
    flex: 1;
    position: relative;
    min-width: 0;
  `,
  textArea: css`
    flex: 1;
  `,
  palette: css`
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(100% + 8px);
    z-index: 10;
    max-height: 280px;
    overflow-y: auto;
    overscroll-behavior: contain;
    border-radius: 14px;
    background: ${claudeGlass.skillPanel};
    backdrop-filter: ${claudeGlass.blurMedium};
    -webkit-backdrop-filter: ${claudeGlass.blurMedium};
    border: 1px solid ${claudeGlass.borderLight};
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
    padding: 6px;
  `,
  skillItem: css`
    width: 100%;
    border: 0;
    background: transparent;
    border-radius: 8px;
    padding: 8px 10px;
    text-align: left;
    cursor: pointer;
    color: ${claudeColors.nearBlack};
    display: block;
    &:hover {
      background: rgba(201, 100, 66, 0.08);
    }
  `,
  skillItemActive: css`
    background: rgba(201, 100, 66, 0.08);
  `,
  skillHeader: css`
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: space-between;
  `,
  skillName: css`
    font-weight: 600;
  `,
  skillDesc: css`
    margin-top: 4px;
    color: ${claudeColors.stoneGray};
    font-size: 12px;
    line-height: 1.5;
  `,
  empty: css`
    padding: 10px;
    color: ${claudeColors.stoneGray};
    font-size: 12px;
  `,
  sendBtn: css`
    border-radius: 14px;
    font-weight: 500;
    background: ${claudeColors.terracotta};
    border-color: ${claudeColors.terracotta};
    color: #fff;
    box-shadow: 0 3px 14px rgba(201, 100, 66, 0.35);
    &:hover {
      background: ${claudeColors.primaryHover} !important;
      border-color: ${claudeColors.primaryHover} !important;
    }
  `,
  stopBtn: css`
    border-radius: 14px;
    background: ${claudeGlass.errorBg};
    backdrop-filter: ${claudeGlass.blurMicro};
    -webkit-backdrop-filter: ${claudeGlass.blurMicro};
    border: 1px solid ${claudeGlass.borderError};
    color: ${claudeColors.error};
    font-weight: 500;
  `,
}));
```

**Replace the upload button** (line 221-226):

```tsx
<Button
  className={styles.uploadBtn}
  disabled={isBusy}
  onClick={() => fileInputRef.current?.click()}
  icon={<UploadOutlined />}
/>
```

**Replace send button** (line 304-310):

```tsx
<Button
  className={styles.sendBtn}
  onClick={handleSend}
  disabled={!text.trim()}
>
  发送
</Button>
```

**Replace stop button** (line 291-293):

```tsx
<Button className={styles.stopBtn} onClick={onStop}>
  停止
</Button>
```

The rest of the file (imports, TextArea, palette JSX, keyboard handling) remains unchanged.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd myapp && npx tsc --noEmit --pretty false 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add myapp/src/pages/coach/components/CoachChatInput.tsx
git commit -m "feat: rewrite input bar with glass styling, glow send button, and glass skill palette"
```

---

## Task 8: Glass Overlay Components

**Files:**
- Modify: `myapp/src/pages/coach/components/GlobalErrorBar.tsx`
- Modify: `myapp/src/pages/coach/components/PendingUploads.tsx`

- [ ] **Step 1: Rewrite GlobalErrorBar as glass floating overlay**

Replace `myapp/src/pages/coach/components/GlobalErrorBar.tsx`:

```tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createStyles } from 'antd-style';
import { claudeColors, claudeGlass } from '@/styles/claude-tokens';
import { prefersReducedMotion } from '@/styles/motion';
import { slideDown, TRANSITION } from '../motion';

const useStyles = createStyles(({ css }) => ({
  shell: css`
    position: absolute;
    top: 8px;
    left: 16px;
    right: 16px;
    z-index: 5;
  `,
  bar: css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-radius: 12px;
    background: ${claudeGlass.errorBg};
    backdrop-filter: ${claudeGlass.blurLight};
    -webkit-backdrop-filter: ${claudeGlass.blurLight};
    border: 1px solid ${claudeGlass.borderError};
    font-size: 13px;
    color: ${claudeColors.error};
  `,
  msg: css`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  btn: css`
    padding: 3px 10px;
    border-radius: 8px;
    border: 1px solid rgba(181, 51, 51, 0.25);
    background: rgba(181, 51, 51, 0.08);
    color: ${claudeColors.error};
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    &:hover {
      background: rgba(181, 51, 51, 0.15);
    }
  `,
  closeBtn: css`
    background: none;
    border: none;
    color: ${claudeColors.error};
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    opacity: 0.7;
    &:hover {
      opacity: 1;
    }
  `,
}));

interface GlobalErrorBarProps {
  visible: boolean;
  message: string;
  onClose: () => void;
  onRetry: () => void;
}

export function GlobalErrorBar({
  visible,
  message,
  onClose,
  onRetry,
}: GlobalErrorBarProps) {
  const { styles } = useStyles();
  const reduced = prefersReducedMotion();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.shell}
          initial={reduced ? { opacity: 0 } : slideDown.initial}
          animate={slideDown.animate}
          exit={reduced ? { opacity: 0 } : slideDown.initial}
          transition={TRANSITION.fast}
        >
          <div className={styles.bar}>
            <span className={styles.msg}>{message}</span>
            <button className={styles.btn} onClick={onRetry}>
              重试
            </button>
            <button className={styles.closeBtn} onClick={onClose}>
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Update PendingUploads with glass style**

Replace `myapp/src/pages/coach/components/PendingUploads.tsx`:

```tsx
import React from 'react';
import { createStyles } from 'antd-style';
import { claudeColors, claudeGlass } from '@/styles/claude-tokens';

const useStyles = createStyles(({ css }) => ({
  shell: css`
    display: flex;
    gap: 8px;
    padding: 6px 16px;
    flex-wrap: wrap;
  `,
  chip: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 10px;
    background: ${claudeGlass.ghost};
    backdrop-filter: ${claudeGlass.blurMicro};
    -webkit-backdrop-filter: ${claudeGlass.blurMicro};
    border: 1px solid ${claudeGlass.borderGhost};
    font-size: 12px;
    color: ${claudeColors.stoneGray};
  `,
  removeBtn: css`
    background: none;
    border: none;
    color: ${claudeColors.stoneGray};
    cursor: pointer;
    font-size: 14px;
    padding: 0;
    line-height: 1;
    opacity: 0.6;
    &:hover {
      opacity: 1;
      color: ${claudeColors.error};
    }
  `,
}));

interface PendingUploadsProps {
  uploads: { fileId: string; name: string }[];
  onRemove: (fileId: string) => void;
}

export function PendingUploads({ uploads, onRemove }: PendingUploadsProps) {
  const { styles } = useStyles();
  if (uploads.length === 0) return null;

  return (
    <div className={styles.shell}>
      {uploads.map((u) => (
        <span key={u.fileId} className={styles.chip}>
          {u.name}
          <button className={styles.removeBtn} onClick={() => onRemove(u.fileId)}>
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd myapp && npx tsc --noEmit --pretty false 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add myapp/src/pages/coach/components/GlobalErrorBar.tsx myapp/src/pages/coach/components/PendingUploads.tsx
git commit -m "feat: rewrite error bar as glass overlay and upload chips with glass style"
```

---

## Task 9: CLI Timeline Glass Tweak

**Files:**
- Modify: `myapp/src/pages/coach/components/AgentRunTimeline.tsx`
- Modify: `myapp/src/pages/coach/components/CollapsedBar.tsx`
- Modify: `myapp/src/pages/coach/components/ExpandedLog.tsx`
- Modify: `myapp/src/pages/coach/components/StatusBar.tsx`

- [ ] **Step 1: Update AgentRunTimeline shell for glass CLI context**

In `AgentRunTimeline.tsx`, replace the `useStyles` block:

```typescript
const useStyles = createStyles(({ css }) => ({
  shell: css`
    border: 1px solid ${claudeGlass.borderCLI};
    border-radius: 12px;
    background: ${claudeGlass.cli};
    backdrop-filter: ${claudeGlass.blurSubtle};
    -webkit-backdrop-filter: ${claudeGlass.blurSubtle};
    margin-bottom: 8px;
    overflow: hidden;
  `,
}));
```

- [ ] **Step 2: Update CollapsedBar for glass background**

In `CollapsedBar.tsx`, change the background to transparent since the parent shell provides the glass surface. The current background becomes:

```css
background: transparent;
```

- [ ] **Step 3: Update ExpandedLog for glass background**

In `ExpandedLog.tsx`, change the background to transparent:

```css
background: transparent;
```

- [ ] **Step 4: Update StatusBar for glass background**

In `StatusBar.tsx`, add glass styling to the status bar:

```css
background: rgba(250, 249, 245, 0.30);
border-top: 1px solid rgba(200, 185, 160, 0.20);
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd myapp && npx tsc --noEmit --pretty false 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add myapp/src/pages/coach/components/AgentRunTimeline.tsx myapp/src/pages/coach/components/CollapsedBar.tsx myapp/src/pages/coach/components/ExpandedLog.tsx myapp/src/pages/coach/components/StatusBar.tsx
git commit -m "feat: tweak CLI timeline components for glass background context"
```

---

## Task 10: Markdown & Streaming Enhancement

**Files:**
- Modify: `myapp/src/pages/coach/components/MarkdownTable.tsx`
- Modify: `myapp/src/pages/coach/components/StreamingText.tsx`

- [ ] **Step 1: Enhance MarkdownTable with glass table styling**

Read current `MarkdownTable.tsx` and update its styles. The table component renders a `<table>` via react-markdown components. Update the wrapping style:

```typescript
const useStyles = createStyles(({ css }) => ({
  wrapper: css`
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin: 8px 0;
  `,
  table: css`
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    border: 1px solid rgba(200, 185, 160, 0.30);
    border-radius: 10px;
    overflow: hidden;
    font-size: 13px;

    th {
      background: linear-gradient(
        180deg,
        rgba(248, 244, 237, 0.70),
        rgba(240, 235, 224, 0.70)
      );
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 1px solid rgba(200, 185, 160, 0.25);
      color: ${claudeColors.oliveGray};
      font-size: 12px;
    }

    td {
      padding: 7px 12px;
      border-bottom: 1px solid rgba(200, 185, 160, 0.15);
      color: ${claudeColors.nearBlack};
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:nth-child(even) td {
      background: rgba(240, 235, 224, 0.30);
    }

    tr:last-child td {
      font-weight: 600;
      color: ${claudeColors.terracotta};
    }
  `,
}));
```

- [ ] **Step 2: Update StreamingText for glass context**

In `StreamingText.tsx`, keep all logic unchanged. Only ensure background is transparent and the cursor color uses the terracotta:

```css
cursor: css`
  display: inline-block;
  width: 2px;
  height: 1em;
  background: ${claudeColors.terracotta};
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 1s step-end infinite;
`,
```

- [ ] **Step 3: Commit**

```bash
git add myapp/src/pages/coach/components/MarkdownTable.tsx myapp/src/pages/coach/components/StreamingText.tsx
git commit -m "feat: enhance markdown table with glass styling and update streaming cursor"
```

---

## Task 11: Test Updates & Visual Verification

**Files:**
- Update: `myapp/src/pages/coach/__tests__/*.test.tsx` (snapshot-affecting tests)
- Run: E2E tests

- [ ] **Step 1: Run existing tests to find failures**

```bash
cd myapp && npx jest --testPathPattern="coach" --no-coverage 2>&1 | tail -30
```

- [ ] **Step 2: Fix any test failures**

For each failing test:
- If it's a snapshot mismatch: update snapshot with `npx jest --updateSnapshot`
- If it's a selector that changed: update the test to match the new markup
- If a component mock needs updating: adjust mock to match new props interface

- [ ] **Step 3: Verify all tests pass**

```bash
cd myapp && npx jest --testPathPattern="coach" --no-coverage 2>&1 | tail -10
```
Expected: All tests pass.

- [ ] **Step 4: Run E2E smoke test**

```bash
cd myapp && npx playwright test --grep "coach" 2>&1 | tail -20
```

- [ ] **Step 5: Visual inspection in dev server**

Start the dev server and manually verify:
- Canvas background renders with orbs and noise
- Dark Glass sidebar displays sessions
- Light Glass main panel shows messages
- Glass bubbles render correctly for AI/user/system
- CLI timeline collapses/expands
- Input bar and skill palette have glass styling

- [ ] **Step 6: Commit**

```bash
git add myapp/src/pages/coach/__tests__/
git commit -m "test: update coach component tests for glass architecture"
```

---

## Completion Checklist

- [ ] All 11 tasks committed
- [ ] `git log --oneline` shows 11 commits
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] `npx jest --testPathPattern="coach"` all tests pass
- [ ] E2E smoke tests pass
- [ ] Dev server visual inspection: glass panels, orbs, noise, bubbles all render
- [ ] No hardcoded hex/rgb values in component files (all use tokens)
