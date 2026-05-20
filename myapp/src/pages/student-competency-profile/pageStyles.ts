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
  viewContainer: css`
    position: relative;
    z-index: 10;
    width: 100%;
    height: calc(100vh - 120px);
    perspective: 1800px;
    margin: 0 auto;
  `,
  flipper: css`
    width: 100%;
    height: 100%;
    position: relative;
    transition: transform 0.6s cubic-bezier(0.55, 0, 0.45, 1);
    transform-style: preserve-3d;
    &.flipped {
      transform: rotateY(-180deg);
    }
  `,
  viewFront: css`
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    border-radius: 24px;
    overflow: hidden;
    box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.1);
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.9);
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 40px;
  `,
  viewBack: css`
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    border-radius: 24px;
    overflow: hidden;
    box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.1);
    transform: rotateY(-180deg);
    display: flex;
    background: rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border: 1px solid rgba(255, 255, 255, 0.8);
  `,
  panelLeft: css`
    width: 30%;
    height: 100%;
    background: #18181b;
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 24px 32px;
    box-sizing: border-box;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background-image: linear-gradient(rgba(253, 251, 247, 0.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(253, 251, 247, 0.07) 1px, transparent 1px);
      background-size: 40px 40px;
      z-index: 0;
    }
  `,
  panelLeftContent: css`
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
  `,
  panelLeftHeader: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  `,
  macDots: css`
    display: flex;
    gap: 8px;
  `,
  macDot: css`
    width: 12px;
    height: 12px;
    border-radius: 50%;
    opacity: 0.8;
  `,
  resetBtn: css`
    background: transparent;
    border: none;
    color: rgba(253, 251, 247, 0.36);
    font-size: 13px;
    cursor: pointer;
    transition: color 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
    &:hover {
      color: ${claudeColors.terracotta};
    }
  `,
  panelRight: css`
    width: 70%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: rgba(253, 251, 247, 0.4);
    position: relative;
  `,
  tabsContainer: css`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `,
  tabsHeaderContent: css`
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding-right: 32px;
    position: absolute;
    right: 0;
    top: 14px;
    z-index: 10;
  `,
  tabs: css`
    height: 100%;
    :global(.ant-tabs-nav) {
      margin-bottom: 0 !important;
      padding: 0 40px;
      height: 70px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    }
    :global(.ant-tabs-nav-list) {
      display: flex !important;
      flex: 1 1 auto !important;
      height: 100%;
    }
    :global(.ant-tabs-tab) {
      padding: 0 24px !important;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${claudeColors.warmSilver};
      font-weight: 500;
      margin: 0 !important;
    }
    :global(.ant-tabs-tab-active .ant-tabs-tab-btn) {
      color: ${claudeColors.nearBlack} !important;
    }
    :global(.ant-tabs-ink-bar) {
      background: ${claudeColors.terracotta} !important;
      height: 2px !important;
      bottom: -1px !important;
    }
    :global(.ant-tabs-content-holder) {
      flex: 1;
      overflow-y: auto;
    }
    :global(.ant-tabs-tabpane) {
      padding: 40px;
    }
  `,
}));
