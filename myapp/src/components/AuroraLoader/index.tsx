/**
 * AuroraLoader — full-screen contour-line loading animation.
 *
 * Shown once on initial page load (SPA first visit).
 * After 1.5 s the progress bar fills → CSS fade-out (1.2 s) → unmount.
 * Uses sessionStorage so route changes within the same tab never re-trigger.
 */
import React, { useEffect, useState } from 'react';
import { claudeAlpha, claudeColors } from '@/styles/claude-tokens';
import { useStyles } from './styles';

const STORAGE_KEY = 'aurora-loader-shown';

const AuroraLoader: React.FC = () => {
  const { styles, cx } = useStyles();

  /* Already shown this session? Don't even mount. */
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !sessionStorage.getItem(STORAGE_KEY);
  });
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!visible) return;

    /* Mark as shown immediately */
    sessionStorage.setItem(STORAGE_KEY, '1');

    /* Phase 1: wait for progress bar to fill (1.5 s) */
    const fadeTimer = setTimeout(() => {
      setExiting(true);

      /* Phase 2: CSS transition completes (1.2 s) → unmount */
      const removeTimer = setTimeout(() => setVisible(false), 1200);
      return () => clearTimeout(removeTimer);
    }, 1500);

    return () => clearTimeout(fadeTimer);
  }, [visible]);

  if (!visible) return null;

  /* SVG path stroke colour derived from terracotta token */
  const strokeA = claudeAlpha(claudeColors.terracotta, 0.15);
  const strokeB = claudeAlpha(claudeColors.terracotta, 0.1);
  const strokeC = claudeAlpha(claudeColors.terracotta, 0.08);

  return (
    <div className={cx(styles.container, exiting && styles.exiting)}>
      {/* ── contour-line SVG art ──────────────────────────────── */}
      <svg
        className={styles.artLines}
        viewBox="0 0 1440 800"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0,200 Q360,150 720,300 T1440,250"
          fill="none"
          stroke={strokeA}
          strokeWidth="1.5"
        />
        <path
          d="M0,350 Q400,450 800,250 T1440,400"
          fill="none"
          stroke={strokeB}
          strokeWidth="1.5"
        />
        <path
          d="M0,500 Q300,400 750,550 T1440,450"
          fill="none"
          stroke={strokeC}
          strokeWidth="2"
        />
      </svg>

      {/* ── title + progress bar ──────────────────────────────── */}
      <div className={styles.content}>
        <div className={styles.title}>正在构建规划舞台</div>
        <div className={styles.progressBar}>
          <div className={styles.progressLine} />
        </div>
      </div>
    </div>
  );
};

export default AuroraLoader;
