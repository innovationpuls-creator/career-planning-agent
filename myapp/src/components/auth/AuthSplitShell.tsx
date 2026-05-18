import type { ReactNode } from 'react';
import { createStyles } from 'antd-style';
import { AuthArtConsole } from './AuthArtConsole';
import { AuthRightSurface } from './AuthRightSurface';
import { AUTH_LAYOUT } from './constants';
import type { AuthExperienceVariant, AuthTabKey } from './types';

export interface AuthSplitShellProps {
  variant: AuthExperienceVariant;
  children: ReactNode;
  onTabChange?: (target: AuthTabKey) => void;
}

const useStyles = createStyles(({ css }) => ({
  shell: css`
    display: grid;
    grid-template-columns: ${AUTH_LAYOUT.desktopLeftPercent}fr
      ${AUTH_LAYOUT.desktopRightPercent}fr;
    min-height: 100vh;
    overflow: hidden;

    @media (max-width: ${AUTH_LAYOUT.mobileBreakpoint}px) {
      display: flex;
      flex-direction: column;
      overflow: visible;
    }
  `,
}));

export function AuthSplitShell({ variant, children }: AuthSplitShellProps) {
  const { styles } = useStyles();

  return (
    <div className={styles.shell} data-testid={`${variant}-page-shell`}>
      <AuthArtConsole variant={variant} />
      <AuthRightSurface>{children}</AuthRightSurface>
    </div>
  );
}
