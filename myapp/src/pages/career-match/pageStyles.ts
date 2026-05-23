import { createStyles } from 'antd-style';
import { claudeColors, claudeFonts } from '@/styles/claude-tokens';

export const useStyles = createStyles(({ css }) => ({
  shell: css`
    min-height: calc(100vh - 112px);
    padding: calc(var(--header-height, 56px)) 32px 40px;
    position: relative;
    overflow: hidden;
    @media (max-width: 800px) {
      padding: calc(var(--header-height, 56px)) 16px 28px;
    }
  `,
  page: css`
    width: 100%;
    max-width: 1040px;
    margin: 0 auto;
  `,
  header: css`
    margin-bottom: 36px;
  `,
  headerLabel: css`
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${claudeColors.terracotta};
    margin-bottom: 8px;
  `,
  headerTitle: css`
    font-family: ${claudeFonts.heading};
    font-size: 32px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
    letter-spacing: -0.01em;
    line-height: 1.2;
    margin-bottom: 8px;
  `,
  headerSub: css`
    font-size: 15px;
    color: ${claudeColors.oliveGray};
    line-height: 1.6;
  `,
  coachRow: css`
    display: flex;
    justify-content: flex-end;
    margin-bottom: 8px;
  `,
  workspace: css`
    display: flex;
    gap: 20px;
    align-items: flex-start;
    @media (max-width: 800px) {
      flex-direction: column;
    }
  `,
  contentArea: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
  `,
  tabsBar: css`
    display: flex;
    gap: 0;
    border-bottom: 1px solid ${claudeColors.borderWarm};
  `,
  tab: css`
    position: relative;
    padding: 11px 24px;
    font-size: 14px;
    font-weight: 600;
    color: ${claudeColors.stoneGray};
    cursor: pointer;
    border: none;
    background: none;
    font-family: ${claudeFonts.body};
    display: flex;
    align-items: center;
    gap: 8px;
    transition: color 0.2s ease;
    &:hover {
      color: ${claudeColors.oliveGray};
    }
  `,
  tabActive: css`
    color: ${claudeColors.terracotta};
    &::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: ${claudeColors.terracotta};
      border-radius: 1px 1px 0 0;
    }
  `,
  tabCount: css`
    font-size: 11px;
    font-weight: 600;
    padding: 1px 7px;
    border-radius: 10px;
    background: ${claudeColors.borderCream};
    color: ${claudeColors.stoneGray};
    line-height: 1.5;
  `,
  tabCountActive: css`
    background: rgba(201, 100, 66, 0.06);
    color: ${claudeColors.terracotta};
  `,
  tabPanel: css`
    animation: fadeSlideIn 0.3s ease;
    @keyframes fadeSlideIn {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  loading: css`
    display: flex;
    justify-content: center;
    padding-top: 48px;
  `,
}));
