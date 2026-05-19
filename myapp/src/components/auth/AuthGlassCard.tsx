import { Alert } from 'antd';
import { createStyles } from 'antd-style';
import { motion } from 'framer-motion';
import { type ReactNode, useEffect, useRef } from 'react';
import { authMorphTransition, authMorphVariants } from './authMotion';
import { AUTH_MORPH, AUTH_RADIUS, AUTH_SURFACE_COLORS } from './constants';
import type { AuthExperienceVariant, AuthTabKey } from './types';

export interface AuthGlassCardProps {
  variant: AuthExperienceVariant;
  title: string;
  subtitle: string;
  children: ReactNode;
  onTabChange: (target: AuthTabKey) => void;
  errorMessage?: string;
  morphing?: boolean;
  morphVariant?: AuthExperienceVariant;
}

const useStyles = createStyles(({ css, token }) => ({
  card: css`
    position: relative;
    overflow: hidden;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    --auth-card-mouse-x: calc(var(--auth-mouse-x) - var(--auth-card-left, 0px));
    --auth-card-mouse-y: calc(var(--auth-mouse-y) - var(--auth-card-top, 0px));
    padding: 52px 48px;
    border-radius: ${AUTH_RADIUS.glassCard}px;
    background: ${AUTH_SURFACE_COLORS.glassFill};
    border: 1px solid ${AUTH_SURFACE_COLORS.glassBorder};
    box-shadow: ${token.boxShadowSecondary};
    backdrop-filter: blur(30px) saturate(145%);
    -webkit-backdrop-filter: blur(30px) saturate(145%);

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      padding: 1px;
      pointer-events: none;
      opacity: var(--auth-spotlight-opacity);
      transition: opacity 260ms ease;
      background: radial-gradient(
        260px circle at var(--auth-card-mouse-x) var(--auth-card-mouse-y),
        ${AUTH_SURFACE_COLORS.glassHighlight},
        ${AUTH_SURFACE_COLORS.clear} 64%
      );
      mask:
        linear-gradient(${AUTH_SURFACE_COLORS.paperWhite} 0 0) content-box,
        linear-gradient(${AUTH_SURFACE_COLORS.paperWhite} 0 0);
      mask-composite: exclude;
      -webkit-mask:
        linear-gradient(${AUTH_SURFACE_COLORS.paperWhite} 0 0) content-box,
        linear-gradient(${AUTH_SURFACE_COLORS.paperWhite} 0 0);
      -webkit-mask-composite: xor;
    }

    &::after {
      content: '';
      position: absolute;
      width: 420px;
      height: 420px;
      left: calc(var(--auth-card-mouse-x) - 210px);
      top: calc(var(--auth-card-mouse-y) - 210px);
      border-radius: 50%;
      pointer-events: none;
      opacity: calc(var(--auth-spotlight-opacity) * 0.72);
      background: radial-gradient(
        circle,
        ${AUTH_SURFACE_COLORS.spotlightSoft},
        ${AUTH_SURFACE_COLORS.clear} 62%
      );
      filter: blur(22px);
      transition: opacity 260ms ease;
    }
  `,
  inner: css`
    position: relative;
    z-index: 1;
  `,
  header: css`
    margin-bottom: 28px;
  `,
  title: css`
    margin: 0 0 8px;
    font-size: 26px;
    font-weight: 500;
    color: ${token.colorText};
  `,
  subtitle: css`
    margin: 0;
    font-size: 13px;
    color: ${token.colorTextTertiary};
  `,
  tabs: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    padding: 6px;
    margin-bottom: 28px;
    border-radius: ${AUTH_RADIUS.control}px;
    background: ${token.colorFillQuaternary};
  `,
  tab: css`
    height: 40px;
    border: 0;
    border-radius: ${AUTH_RADIUS.control - 4}px;
    background: ${AUTH_SURFACE_COLORS.clear};
    color: ${token.colorTextTertiary};
    cursor: pointer;
    font: inherit;
  `,
  activeTab: css`
    color: ${token.colorText};
    background: ${token.colorBgContainer};
    box-shadow: ${token.boxShadowTertiary};
  `,
  errorSlot: css`
    min-height: 40px;
    margin-bottom: 12px;
  `,
  content: css`
    position: relative;
  `,
}));

export function AuthGlassCard({
  variant,
  title,
  subtitle,
  children,
  onTabChange,
  errorMessage,
  morphing,
  morphVariant,
}: AuthGlassCardProps) {
  const { styles, cx } = useStyles();
  const cardRef = useRef<HTMLElement | null>(null);
  const visualVariant = morphVariant ?? variant;

  useEffect(() => {
    const card = cardRef.current;
    const surface = card?.closest<HTMLElement>(
      '[data-testid="auth-right-surface"]',
    );
    if (!card || !surface) return undefined;

    const syncCardOffset = () => {
      const cardRect = card.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      card.style.setProperty(
        '--auth-card-left',
        `${cardRect.left - surfaceRect.left}px`,
      );
      card.style.setProperty(
        '--auth-card-top',
        `${cardRect.top - surfaceRect.top}px`,
      );
    };

    syncCardOffset();
    window.addEventListener('resize', syncCardOffset);

    const resizeObserver = new ResizeObserver(syncCardOffset);
    resizeObserver.observe(card);
    resizeObserver.observe(surface);

    return () => {
      window.removeEventListener('resize', syncCardOffset);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <motion.section
      ref={cardRef}
      className={styles.card}
      data-testid="auth-glass-card"
      data-variant={variant}
      data-morphing={morphing ? 'true' : 'false'}
      data-visual-variant={visualVariant}
      animate={authMorphVariants[visualVariant]}
      transition={authMorphTransition}
      aria-busy={morphing}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </header>
        <div className={styles.tabs} role="tablist" aria-label="认证方式">
          {(['login', 'register'] as AuthTabKey[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={variant === key}
              className={cx(styles.tab, variant === key && styles.activeTab)}
              data-testid={`auth-tab-${key}`}
              onClick={() => onTabChange(key)}
              disabled={morphing || variant === key}
            >
              {key === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>
        <div className={styles.errorSlot} data-testid="auth-error-slot">
          {errorMessage ? (
            <Alert type="error" showIcon message={errorMessage} />
          ) : null}
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </motion.section>
  );
}
