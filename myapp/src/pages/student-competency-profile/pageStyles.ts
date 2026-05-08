import { createStyles } from 'antd-style';
import {
  claudeColors,
  claudeFonts,
  claudeRadius,
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
  pageHeader: css`
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  `,
  pageTitle: css`
    font-family: ${claudeFonts.heading};
    font-size: 28px;
    font-weight: 700;
    color: ${claudeColors.nearBlack};
    margin: 0;
  `,
  moduleSwitch: css`
    :global(.ant-segmented-item-selected) {
      background: ${claudeColors.terracotta} !important;
      color: #fff !important;
    }
  `,
  section: css`
    margin-bottom: 24px;
  `,
  uploadSection: css`
    max-width: 640px;
    margin: 0 auto 24px;
  `,
  tabs: css`
    :global(.ant-tabs-nav-list) {
      display: flex !important;
      flex: 1 1 auto !important;
      width: 100%;
    }
    :global(.ant-tabs-tab) {
      flex: 1 1 0;
      display: flex;
      justify-content: center;
      margin: 0 !important;
    }
    :global(.ant-tabs-tab-active .ant-tabs-tab-btn) {
      color: ${claudeColors.terracotta} !important;
    }
    :global(.ant-tabs-ink-bar) {
      background: ${claudeColors.terracotta} !important;
    }
    :global(.ant-tabs-content-holder) {
      width: 100%;
    }
    :global(.ant-tabs-tabpane) {
      width: 100%;
    }
  `,
}));
