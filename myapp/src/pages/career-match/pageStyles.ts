import { createStyles } from 'antd-style';
import {
  claudeColors,
  claudeFonts,
} from '@/styles/claude-tokens';

export const useStyles = createStyles(({ css }) => ({
  shell: css`
    min-height: calc(100vh - 112px);
    padding: calc(var(--header-height, 56px)) 32px 40px;
    position: relative;
    overflow: hidden;
    @media (max-width: 900px) {
      padding: calc(var(--header-height, 56px)) 16px 28px;
    }
  `,
  page: css`
    width: 100%;
    max-width: 1280px;
    margin: 0 auto;
  `,
}));
