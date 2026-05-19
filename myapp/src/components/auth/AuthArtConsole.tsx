import { createStyles } from 'antd-style';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LOGIN_TOOL_LOG_ITEMS,
  REGISTER_TOOL_LOG_ITEMS,
} from './coachToolLogData';
import {
  AUTH_ART_COPY,
  AUTH_LAYOUT,
  AUTH_RADIUS,
  AUTH_SURFACE_COLORS,
} from './constants';
import type { AuthExperienceVariant } from './types';
import { useAuthToolLog } from './useAuthToolLog';

const useStyles = createStyles(({ css, token }) => ({
  shell: css`
    position: relative;
    min-height: 100vh;
    padding: 24px 32px;
    overflow: hidden;
    background: ${AUTH_SURFACE_COLORS.terminal};

    @media (max-width: ${AUTH_LAYOUT.mobileBreakpoint}px) {
      flex: 0 0 auto;
      min-height: 620px;
      padding: 24px 28px;
    }

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background-image:
        linear-gradient(
          ${AUTH_SURFACE_COLORS.terminalGrid} 1px,
          ${AUTH_SURFACE_COLORS.clear} 1px
        ),
        linear-gradient(
          90deg,
          ${AUTH_SURFACE_COLORS.terminalGrid} 1px,
          ${AUTH_SURFACE_COLORS.clear} 1px
        );
      background-size: 40px 40px;
    }
  `,
  content: css`
    position: relative;
    z-index: 1;
    height: calc(100vh - 48px);
    min-height: 572px;

    @media (max-width: ${AUTH_LAYOUT.mobileBreakpoint}px) {
      height: 572px;
    }
  `,
  dots: css`
    display: flex;
    gap: 8px;
    margin-bottom: 48px;
  `,
  dot: css`
    width: 12px;
    height: 12px;
    border-radius: 50%;
    opacity: 0.75;
  `,
  art: css`
    text-align: left;
    max-width: 680px;
  `,
  artRegister: css`
    text-align: left;
  `,
  tag: css`
    font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif;
    font-weight: 500;
    font-size: 11px;
    color: ${AUTH_SURFACE_COLORS.terracotta};
    letter-spacing: 4px;
    margin-bottom: 16px;
  `,
  title: css`
    white-space: pre-line;
    font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif;
    font-weight: 300;
    font-size: 24px;
    color: ${AUTH_SURFACE_COLORS.terminalArt};
    letter-spacing: 8px;
    line-height: 1.35;
    margin: 0 0 12px;

    @media (max-width: ${AUTH_LAYOUT.mobileBreakpoint}px) {
      white-space: normal;
      font-size: 22px;
      letter-spacing: 6px;
    }
  `,
  subtitle: css`
    font-size: 11px;
    color: ${AUTH_SURFACE_COLORS.terminalSubtitle};
    letter-spacing: 1.5px;
  `,
  log: css`
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: clamp(190px, 28vh, 260px);
    overflow: hidden;
    font-family: ${token.fontFamilyCode};
    font-size: 12px;
    color: ${AUTH_SURFACE_COLORS.consoleText};
    line-height: 2.2;
    border-radius: ${AUTH_RADIUS.terminal}px;
    mask-image: linear-gradient(to bottom, black 0 78%, transparent 100%);

    @media (max-width: ${AUTH_LAYOUT.mobileBreakpoint}px) {
      height: 210px;
    }
  `,
  row: css`
    display: flex;
    justify-content: space-between;
    gap: 22px;
    white-space: nowrap;
    transition:
      opacity 0.35s ease,
      transform 0.35s ease;

    > span:first-child {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    > span:last-child {
      flex: 0 0 auto;
    }
  `,
  stale: css`
    opacity: 0.42;
  `,
  hot: css`
    color: ${AUTH_SURFACE_COLORS.consoleHotText};
  `,
  running: css`
    color: ${AUTH_SURFACE_COLORS.terracotta};
  `,
  success: css`
    color: ${AUTH_SURFACE_COLORS.consoleSuccess};
  `,
}));

export function AuthArtConsole({
  variant,
}: {
  variant: AuthExperienceVariant;
}) {
  const { styles, cx } = useStyles();
  const copy = AUTH_ART_COPY[variant];
  const lines = useAuthToolLog(
    variant === 'login' ? LOGIN_TOOL_LOG_ITEMS : REGISTER_TOOL_LOG_ITEMS,
  );

  return (
    <aside className={styles.shell} data-testid="auth-art-console">
      <div className={styles.content}>
        <div className={styles.dots}>
          <span
            className={styles.dot}
            style={{ background: AUTH_SURFACE_COLORS.macClose }}
          />
          <span
            className={styles.dot}
            style={{ background: AUTH_SURFACE_COLORS.macMinimize }}
          />
          <span
            className={styles.dot}
            style={{ background: AUTH_SURFACE_COLORS.macMaximize }}
          />
        </div>
        <div
          className={cx(
            styles.art,
            variant === 'register' && styles.artRegister,
          )}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={variant}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: [0.55, 0, 0.45, 1] }}
            >
              <div className={styles.tag}>{copy.tag}</div>
              <h2 className={styles.title}>{copy.title}</h2>
              <div className={styles.subtitle}>{copy.subtitle}</div>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className={styles.log} data-testid="auth-console-log">
          {lines.map((line, index) => (
            <div
              key={line.id}
              className={cx(
                styles.row,
                !line.stale && styles.hot,
                line.stale && styles.stale,
              )}
            >
              <span>
                {index === lines.length - 1 ? '└─' : '├─'} [tool]{' '}
                {line.toolName}
                {' // '}
                {line.displayName}
              </span>
              <span
                className={
                  line.status === 'running' ? styles.running : styles.success
                }
              >
                {line.status === 'running' ? '●' : '✓'} {line.durationText}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
