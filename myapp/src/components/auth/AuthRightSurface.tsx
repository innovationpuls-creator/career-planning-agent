import type { ReactNode } from 'react';
import { useRef } from 'react';
import { createStyles } from 'antd-style';
import { AUTH_LAYOUT, AUTH_SURFACE_COLORS } from './constants';
import { useAuthRightSpotlight } from './useAuthRightSpotlight';

const useStyles = createStyles(({ css }) => ({
  surface: css`
    --auth-mouse-x: 50%;
    --auth-mouse-y: 50%;
    --auth-spotlight-opacity: 0;
    position: relative;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: linear-gradient(
      135deg,
      ${AUTH_SURFACE_COLORS.paperWhite},
      ${AUTH_SURFACE_COLORS.warmPaper}
    );

    @media (max-width: ${AUTH_LAYOUT.mobileBreakpoint}px) {
      flex: 0 0 auto;
      min-height: 100svh;
      align-items: flex-start;
      padding: 32px 0;
    }
  `,
  blobs: css`
    position: absolute;
    inset: 0;
    pointer-events: none;

    &::before,
    &::after {
      content: '';
      position: absolute;
      border-radius: 999px;
      filter: blur(90px);
      animation: authBlobDrift 11s infinite ease-in-out;
    }

    &::before {
      width: 58%;
      height: 48%;
      top: -14%;
      right: -16%;
      background: radial-gradient(
        circle,
        ${AUTH_SURFACE_COLORS.terracotta},
        ${AUTH_SURFACE_COLORS.clear} 68%
      );
    }

    &::after {
      width: 54%;
      height: 44%;
      bottom: -14%;
      left: -18%;
      background: radial-gradient(
        circle,
        ${AUTH_SURFACE_COLORS.warmGold},
        ${AUTH_SURFACE_COLORS.clear} 70%
      );
      animation-duration: 14s;
    }

    @keyframes authBlobDrift {
      0%,
      100% {
        transform: translate3d(0, 0, 0) scale(1);
      }
      45% {
        transform: translate3d(-8%, 10%, 0) scale(1.12);
      }
      72% {
        transform: translate3d(7%, -6%, 0) scale(0.94);
      }
    }
  `,
  spotlight: css`
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: var(--auth-spotlight-opacity);
    transition: opacity 260ms ease;
    background: radial-gradient(
      circle at var(--auth-mouse-x) var(--auth-mouse-y),
      ${AUTH_SURFACE_COLORS.spotlightCore} 0,
      ${AUTH_SURFACE_COLORS.spotlightSoft} 18%,
      ${AUTH_SURFACE_COLORS.clear} 48%
    );
  `,
  content: css`
    position: relative;
    z-index: 1;
    width: min(100%, 520px);
    padding: 32px;

    @media (max-width: ${AUTH_LAYOUT.mobileBreakpoint}px) {
      width: 100%;
      padding: 20px;
    }
  `,
}));

export function AuthRightSurface({ children }: { children: ReactNode }) {
  const { styles } = useStyles();
  const ref = useRef<HTMLElement | null>(null);
  useAuthRightSpotlight(ref);

  return (
    <section
      ref={ref}
      className={styles.surface}
      data-testid="auth-right-surface"
      data-blob-placement="right"
    >
      <div
        className={styles.blobs}
        data-testid="auth-blob-layer"
        data-layer="right-warm-ambient"
      />
      <div
        className={styles.spotlight}
        data-testid="auth-spotlight-layer"
        data-layer="right-spotlight"
      />
      <div className={styles.content}>{children}</div>
    </section>
  );
}
