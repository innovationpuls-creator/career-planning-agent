import { createStyles } from 'antd-style';
import {
  AUTH_ART_COPY,
  AUTH_RADIUS,
  AUTH_SURFACE_COLORS,
} from './constants';
import {
  LOGIN_TOOL_LOG_ITEMS,
  REGISTER_TOOL_LOG_ITEMS,
} from './coachToolLogData';
import type { AuthExperienceVariant } from './types';
import { useAuthToolLog } from './useAuthToolLog';

const useStyles = createStyles(({ css, token }) => ({
  shell: css`
    position: relative;
    min-height: 100vh;
    padding: 48px 64px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    background: ${AUTH_SURFACE_COLORS.terminal};

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      opacity: 0.08;
      pointer-events: none;
      background-image:
        linear-gradient(
          ${token.colorBorderSecondary} 1px,
          ${AUTH_SURFACE_COLORS.clear} 1px
        ),
        linear-gradient(
          90deg,
          ${token.colorBorderSecondary} 1px,
          ${AUTH_SURFACE_COLORS.clear} 1px
        );
      background-size: 40px 40px;
    }
  `,
  content: css`
    position: relative;
    z-index: 1;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  `,
  dots: css`
    display: flex;
    gap: 8px;
  `,
  dot: css`
    width: 12px;
    height: 12px;
    border-radius: 50%;
    opacity: 0.75;
  `,
  art: css`
    text-align: center;
    margin-top: -10vh;
  `,
  artRegister: css`
    text-align: left;
    padding-left: 20px;
  `,
  tag: css`
    font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif;
    font-weight: 500;
    font-size: 12px;
    color: ${token.colorPrimary};
    letter-spacing: 8px;
    margin-bottom: 28px;
  `,
  title: css`
    white-space: pre-line;
    font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif;
    font-weight: 300;
    font-size: 36px;
    color: ${AUTH_SURFACE_COLORS.paperWhite};
    letter-spacing: 16px;
    line-height: 1.5;
    margin: 0 0 24px;
  `,
  subtitle: css`
    font-size: 13px;
    color: ${token.colorTextQuaternary};
    letter-spacing: 4px;
  `,
  log: css`
    font-family: ${token.fontFamilyCode};
    font-size: 12px;
    color: ${token.colorTextQuaternary};
    line-height: 2.2;
    border-radius: ${AUTH_RADIUS.terminal}px;
  `,
  row: css`
    display: flex;
    justify-content: space-between;
    gap: 40px;
  `,
  stale: css`
    opacity: 0.45;
  `,
  running: css`
    color: ${token.colorPrimary};
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
        <div className={cx(styles.art, variant === 'register' && styles.artRegister)}>
          <div className={styles.tag}>{copy.tag}</div>
          <h2 className={styles.title}>{copy.title}</h2>
          <div className={styles.subtitle}>{copy.subtitle}</div>
        </div>
        <div className={styles.log} data-testid="auth-console-log">
          {lines.map((line, index) => (
            <div
              key={line.id}
              className={cx(styles.row, line.stale && styles.stale)}
            >
              <span>
                {index === lines.length - 1 ? '└─' : '├─'} [tool]{' '}
                {line.toolName} // {line.displayName}
              </span>
              <span className={line.status === 'running' ? styles.running : undefined}>
                {line.status === 'running' ? '●' : '✓'} {line.durationText}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
