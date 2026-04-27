import {
  ArrowLeftOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  EditOutlined,
  FileDoneOutlined,
  FlagOutlined,
  InfoCircleOutlined,
  RocketOutlined,
  SendOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Collapse,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  message,
  Progress,
  Result,
  Skeleton,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createSnailLearningPathReview,
  getCareerDevelopmentFavorites,
  getCareerDevelopmentPlanWorkspace,
  getHomeV2,
  getStudentCompetencyLatestAnalysis,
  initializeSnailLearningPathWorkspace,
  listSnailLearningPathReviews,
} from '@/services/ant-design-pro/api';
import {
  buildSnailReviewFormData,
  buildWorkspaceStorageKey,
  getActionTaskDescription,
  getActionTaskTitle,
  getCheckedResourceUrlsForPhase,
  getCompletedModuleIds,
  getCurrentPhaseKey,
  getModuleCompletionStatus,
  getModuleDisplayDescription,
  getModuleDisplayTitle,
  getModuleResources,
  getPhaseProgress,
  getResourceCompletionId,
  type LearningPathPhaseKey,
  loadActivePhaseKey,
  loadCompletedResources,
  loadFavoriteId,
  PHASE_LABELS,
  REVIEW_UPLOAD_ACCEPT,
  saveActivePhaseKey,
  saveCompletedModules,
  saveCompletedResources,
  saveFavoriteId,
} from './learningPathUtils';

const { Title, Text } = Typography;
const { TextArea } = Input;

type ReviewFormValues = { summary: string };
type PreparationState = {
  hasFavorite: boolean;
  hasProfile: boolean;
  hasLatestAnalysis: boolean;
  hasWorkspace: boolean;
};
type LearningResource = ReturnType<typeof getModuleResources>[number];
type ActiveResourceDetail = {
  phaseKey: LearningPathPhaseKey;
  moduleId: string;
  moduleTitle: string;
  resource: LearningResource;
  resourceIndex: number;
};

const MONTHLY_RECOMMENDATION_LABELS: Record<
  API.SnailMonthlyReviewReport['recommendation'],
  string
> = {
  continue: '继续当前阶段',
  strengthen: '先补强',
  advance: '准备进入下一阶段',
};

const METRIC_COUNT = 5;

const getResourceLogoFallbackText = (title: string) => {
  const words = title.match(/[A-Za-z0-9]+/g);
  if (words?.length) {
    return words.length > 1
      ? words
          .slice(0, 2)
          .map((word) => word[0])
          .join('')
          .toUpperCase()
      : words[0].slice(0, 3).toUpperCase();
  }
  return title.trim().slice(0, 2) || '学';
};

const getPhaseVisualIcon = (phaseKey: LearningPathPhaseKey) => {
  if (phaseKey === 'short_term') return <BookOutlined />;
  if (phaseKey === 'mid_term') return <TrophyOutlined />;
  return <RocketOutlined />;
};

const useStyles = createStyles(({ css, token }) => ({
  page: css`
    position: relative;
    isolation: isolate;
    max-width: 1200px;
    min-height: calc(100vh - 72px);
    margin: 0 auto;
    padding: 24px 24px 160px;
    background: transparent;
    &::before {
      content: '';
      position: absolute;
      z-index: -1;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 100vw;
      transform: translateX(-50%);
      background:
        radial-gradient(circle at 12% 0, color-mix(in srgb, ${token.colorPrimaryBg} 72%, transparent) 0, transparent 320px),
        linear-gradient(
          180deg,
          color-mix(in srgb, ${token.colorPrimaryBg} 60%, ${token.colorBgLayout} 40%) 0,
          color-mix(in srgb, ${token.colorBgLayout} 72%, ${token.colorBgContainer} 28%) 420px,
          ${token.colorBgLayout} 100%
        );
    }
    @media (max-width: 768px) {
      padding: 14px 12px 128px;
    }
  `,
  statusStrip: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 18px;
    margin-bottom: 16px;
    padding: 14px 18px;
    border: 1px solid color-mix(in srgb, ${token.colorBorderSecondary} 66%, ${token.colorPrimaryBg} 34%);
    border-radius: 18px;
    background: color-mix(in srgb, ${token.colorBgContainer} 88%, ${token.colorPrimaryBg} 12%);
    box-shadow: 0 10px 30px color-mix(in srgb, ${token.colorPrimary} 6%, transparent);
    backdrop-filter: blur(12px);
    @media (max-width: 860px) {
      grid-template-columns: 1fr;
    }
  `,
  statusItems: css`
    display: flex;
    align-items: center;
    gap: 8px 16px;
    flex-wrap: wrap;
    min-width: 0;
  `,
  statusItem: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: ${token.colorTextSecondary};
    font-size: 12px;
    white-space: nowrap;
  `,
  statusItemReady: css`
    color: ${token.colorTextSecondary};
  `,
  statusDot: css`
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: ${token.colorTextQuaternary};
  `,
  statusDotReady: css`
    background: ${token.colorSuccess};
  `,
  topStatusPrimary: css`
    display: grid;
    grid-template-columns: 54px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    min-width: 0;
  `,
  statusRing: css`
    width: 54px;
    height: 54px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: ${token.colorBgContainer};
    box-shadow: inset 0 0 0 1px ${token.colorBorderSecondary};
  `,
  statusTitleLine: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    min-width: 0;
  `,
  statusTitle: css`
    font-family: var(--font-heading, "Noto Serif SC", "Songti SC", serif);
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: ${token.colorText};
  `,
  statusTargetCard: css`
    display: grid;
    grid-template-columns: minmax(220px, 1fr) auto;
    align-items: center;
    gap: 16px;
    padding: 10px 12px 10px 16px;
    border-radius: 14px;
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    @media (max-width: 640px) {
      grid-template-columns: 1fr;
    }
  `,
  statusActionGroup: css`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  `,
  heroPanel: css`
    position: relative;
    margin-bottom: 16px;
    padding: 30px 30px 24px;
    border: 1px solid color-mix(in srgb, ${token.colorPrimaryBorder} 44%, ${token.colorBorderSecondary} 56%);
    border-radius: 22px;
    background:
      radial-gradient(circle at 92% 18%, color-mix(in srgb, ${token.colorSuccessBg} 70%, transparent) 0, transparent 230px),
      linear-gradient(
        135deg,
        color-mix(in srgb, ${token.colorPrimaryBg} 70%, ${token.colorBgContainer} 30%),
        ${token.colorBgContainer} 45%,
        color-mix(in srgb, ${token.colorInfoBg} 28%, ${token.colorBgContainer} 72%)
      );
    box-shadow: 0 18px 44px color-mix(in srgb, ${token.colorPrimary} 10%, transparent);
    &::before {
      content: '';
      position: absolute;
      top: 22px;
      bottom: 22px;
      left: 0;
      width: 4px;
      border-radius: 0 999px 999px 0;
      background: ${token.colorPrimary};
    }
  `,
  heroTop: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
    gap: 24px;
    align-items: start;
    @media (max-width: 860px) {
      grid-template-columns: 1fr;
    }
  `,
  heroMeta: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  `,
  heroTitle: css`
    font-family: var(--font-heading, "Noto Serif SC", "Songti SC", serif);
    font-weight: 900;
    letter-spacing: 0.02em;
    line-height: 1.12;
    margin: 0;
    font-size: clamp(36px, 4.8vw, 48px);
  `,
  heroSubtitle: css`
    display: block;
    max-width: 620px;
    margin-top: 12px;
    color: ${token.colorTextSecondary};
    font-size: 17px;
    line-height: 1.75;
  `,
  heroGoalPanel: css`
    display: grid;
    gap: 14px;
    padding: 18px;
    border-radius: 18px;
    background: color-mix(in srgb, ${token.colorBgContainer} 88%, ${token.colorPrimaryBg} 12%);
    border: 1px solid color-mix(in srgb, ${token.colorPrimaryBorder} 36%, ${token.colorBorderSecondary} 64%);
    box-shadow: 0 12px 30px color-mix(in srgb, ${token.colorPrimary} 7%, transparent);
  `,
  heroGoalLine: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
  `,
  heroActions: css`
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  `,
  metricGrid: css`
    display: grid;
    grid-template-columns: minmax(240px, 1.2fr) repeat(4, minmax(140px, 0.8fr));
    gap: 12px;
    margin-top: 24px;
    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  `,
  metricCell: css`
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    min-width: 0;
    padding: 14px;
    border-radius: 16px;
    border: 1px solid color-mix(in srgb, ${token.colorBorderSecondary} 80%, ${token.colorPrimaryBg} 20%);
    background: color-mix(in srgb, ${token.colorBgContainer} 92%, ${token.colorPrimaryBg} 8%);
  `,
  metricCellPrimary: css`
    background: color-mix(in srgb, ${token.colorPrimaryBg} 42%, ${token.colorBgContainer} 58%);
    border-color: ${token.colorPrimaryBorder};
  `,
  metricIcon: css`
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
  `,
  metricValue: css`
    margin: 0;
    line-height: 1;
    font-family: var(--font-heading);
    font-weight: 700;
    letter-spacing: 0.04em;
  `,
  compactProgress: css`
    margin-top: 2px;
  `,
  phaseTimeline: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
    margin-bottom: 18px;
    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  `,
  phaseNode: css`
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 76px;
    gap: 12px;
    min-height: 142px;
    padding: 18px;
    cursor: pointer;
    text-align: left;
    border: 1px solid color-mix(in srgb, ${token.colorBorderSecondary} 82%, ${token.colorPrimaryBg} 18%);
    border-radius: 18px;
    background: ${token.colorBgContainer};
    transition:
      background var(--motion-fast, 0.15s) var(--ease-standard, ease),
      border-color var(--motion-fast, 0.15s) var(--ease-standard, ease),
      box-shadow var(--motion-fast, 0.15s) var(--ease-standard, ease),
      transform var(--motion-fast, 0.15s) var(--ease-standard, ease);
    &:hover {
      transform: translateY(-1px);
      border-color: ${token.colorBorder};
      box-shadow: ${token.boxShadowTertiary};
    }
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 16px;
      right: 16px;
      height: 4px;
      border-radius: 0 0 999px 999px;
      background: ${token.colorPrimary};
      opacity: 0.72;
    }
    @media (max-width: 900px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  phaseNodeActive: css`
    border-color: ${token.colorPrimaryBorder};
    box-shadow:
      0 0 0 2px ${token.colorPrimaryBg},
      0 12px 28px color-mix(in srgb, ${token.colorPrimary} 10%, transparent);
    transition:
      background var(--motion-fast, 0.15s) var(--ease-standard, ease),
      border-color var(--motion-fast, 0.15s) var(--ease-standard, ease),
      box-shadow var(--motion-fast, 0.15s) var(--ease-standard, ease),
      transform var(--motion-fast, 0.15s) var(--ease-standard, ease);
  `,
  phaseNodeShort: css`
    background: linear-gradient(135deg, color-mix(in srgb, ${token.colorSuccessBg} 34%, ${token.colorBgContainer} 66%), ${token.colorBgContainer});
    &::before {
      background: ${token.colorSuccess};
    }
  `,
  phaseNodeMid: css`
    background: linear-gradient(135deg, color-mix(in srgb, ${token.colorPrimaryBg} 36%, ${token.colorBgContainer} 64%), ${token.colorBgContainer});
    &::before {
      background: ${token.colorPrimary};
    }
  `,
  phaseNodeLong: css`
    background: linear-gradient(135deg, color-mix(in srgb, ${token.colorPrimaryBg} 20%, ${token.colorErrorBg} 16%), ${token.colorBgContainer});
    &::before {
      background: color-mix(in srgb, ${token.colorPrimary} 64%, ${token.colorError} 36%);
    }
  `,
  phaseNodeContent: css`
    display: grid;
    gap: 10px;
    min-width: 0;
  `,
  phaseNodeHead: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  `,
  phaseIndex: css`
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: 1px solid ${token.colorBorderSecondary};
    font-size: 12px;
    font-weight: 600;
    color: ${token.colorText};
    background: ${token.colorBgContainer};
  `,
  phaseIndexActive: css`
    border-color: ${token.colorPrimary};
    color: ${token.colorBgContainer};
    background: ${token.colorPrimary};
  `,
  phaseNodeTitle: css`
    display: grid;
    gap: 4px;
    min-width: 0;
  `,
  phaseNodeFooter: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: ${token.colorTextSecondary};
    font-size: 12px;
  `,
  phaseVisual: css`
    align-self: center;
    justify-self: end;
    width: 70px;
    height: 70px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 22px;
    color: ${token.colorPrimary};
    background:
      linear-gradient(145deg, ${token.colorBgContainer}, color-mix(in srgb, ${token.colorPrimaryBg} 54%, ${token.colorBgContainer} 46%));
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, ${token.colorPrimaryBorder} 42%, transparent),
      0 12px 26px color-mix(in srgb, ${token.colorPrimary} 10%, transparent);
    font-size: 32px;
    @media (max-width: 900px) {
      display: none;
    }
  `,
  phaseMotion: css`
    will-change: opacity, transform;
  `,
  phaseWorkspaceEnter: css`
    animation: phaseWorkspaceEnter 400ms cubic-bezier(0.22, 1, 0.36, 1) both;
    @keyframes phaseWorkspaceEnter {
      from {
        opacity: 0;
        transform: translateY(16px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  phaseWorkspaceLeave: css`
    animation: phaseWorkspaceLeave 200ms ease-in both;
    @keyframes phaseWorkspaceLeave {
      from {
        opacity: 1;
        transform: translateY(0);
      }
      to {
        opacity: 0;
        transform: translateY(-8px);
      }
    }
  `,
  moduleItemMotion: css`
    animation: moduleItemIn 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: calc(var(--module-index, 0) * 60ms);
    @keyframes moduleItemIn {
      from {
        opacity: 0;
        transform: translateX(-8px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  `,
  resourceItemMotion: css`
    animation: resourceItemIn 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: calc(var(--resource-index, 0) * 60ms);
    @keyframes resourceItemIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  workspaceShell: css`
    overflow: hidden;
    border: 1px solid color-mix(in srgb, ${token.colorBorderSecondary} 82%, ${token.colorPrimaryBg} 18%);
    border-radius: 22px;
    background: ${token.colorBgContainer};
    box-shadow: 0 18px 44px color-mix(in srgb, ${token.colorText} 7%, transparent);
  `,
  workspaceHeader: css`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
    padding: 22px 26px 18px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    background:
      linear-gradient(
        90deg,
        color-mix(in srgb, ${token.colorPrimaryBg} 34%, ${token.colorBgContainer} 66%),
        ${token.colorBgContainer} 56%
      );
  `,
  reviewToolbar: css`
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  `,
  workspaceBody: css`
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.25fr);
    gap: 1px;
    background: color-mix(in srgb, ${token.colorBorderSecondary} 72%, ${token.colorPrimaryBg} 28%);
    @media (max-width: 960px) {
      grid-template-columns: 1fr;
    }
  `,
  workspacePane: css`
    min-width: 0;
    padding: 22px 26px;
    background: ${token.colorBgContainer};
  `,
  workspacePaneMuted: css`
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, ${token.colorBgLayout} 44%, ${token.colorBgContainer} 56%),
        ${token.colorBgContainer} 48%
      );
  `,
  section: css`
    margin-bottom: 24px;
    &:last-child {
      margin-bottom: 0;
    }
  `,
  sectionHeader: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  `,
  moduleRail: css`
    position: relative;
    display: grid;
    gap: 12px;
    &::before {
      content: '';
      position: absolute;
      left: 13px;
      top: 18px;
      bottom: 18px;
      width: 1px;
      background: ${token.colorBorderSecondary};
    }
  `,
  moduleStep: css`
    position: relative;
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    gap: 12px;
    width: 100%;
    padding: 14px 12px 14px 0;
    cursor: pointer;
    text-align: left;
    border: 1px solid transparent;
    border-radius: 14px;
    background: color-mix(in srgb, ${token.colorBgContainer} 84%, ${token.colorPrimaryBg} 16%);
    transition:
      background-color var(--motion-fast, 0.15s) var(--ease-standard, ease),
      border-color var(--motion-fast, 0.15s) var(--ease-standard, ease),
      box-shadow var(--motion-fast, 0.15s) var(--ease-standard, ease),
      transform var(--motion-fast, 0.15s) var(--ease-standard, ease);
    &:hover {
      background: ${token.colorBgContainer};
      border-color: ${token.colorPrimaryBorder};
      box-shadow: inset 3px 0 0 ${token.colorPrimaryBorder};
      transform: translateY(-1px);
    }
    &:focus-visible {
      outline: 2px solid ${token.colorPrimaryBorder};
      outline-offset: 2px;
    }
  `,
  moduleStepSelected: css`
    background: ${token.colorBgContainer};
    border-color: ${token.colorPrimaryBorder};
    box-shadow:
      inset 3px 0 0 ${token.colorPrimary},
      0 10px 22px color-mix(in srgb, ${token.colorPrimary} 9%, transparent);
  `,
  moduleDot: css`
    position: relative;
    z-index: 1;
    width: 27px;
    height: 27px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: 1px solid ${token.colorBorderSecondary};
    color: ${token.colorText};
    background: ${token.colorBgContainer};
    font-size: 11px;
    font-weight: 600;
  `,
  moduleDotCurrent: css`
    border-color: ${token.colorPrimaryBorder};
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
  `,
  moduleDotDone: css`
    border-color: ${token.colorSuccess};
    color: ${token.colorBgContainer};
    background: ${token.colorSuccess};
  `,
  moduleMeta: css`
    display: grid;
    gap: 6px;
    min-width: 0;
  `,
  moduleHead: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  `,
  clampText: css`
    color: ${token.colorTextSecondary};
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `,
  moduleStats: css`
    display: grid;
    justify-items: end;
    gap: 6px;
    min-width: 64px;
    color: ${token.colorTextSecondary};
    font-size: 12px;
  `,
  phaseGoalBox: css`
    display: grid;
    gap: 8px;
    margin-top: 16px;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid ${token.colorBorderSecondary};
    background: color-mix(in srgb, ${token.colorBgContainer} 72%, ${token.colorPrimaryBg} 28%);
  `,
  resourceGroup: css`
    display: grid;
    gap: 12px;
    padding: 16px 0 0;
    animation: resourceFadeIn 180ms var(--ease-standard, ease);
    @keyframes resourceFadeIn {
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
  resourceLine: css`
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) auto;
    gap: 14px;
    align-items: center;
    padding: 14px;
    border-radius: 16px;
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    box-shadow: 0 8px 20px color-mix(in srgb, ${token.colorText} 4%, transparent);
    transition:
      border-color var(--motion-fast, 0.15s) var(--ease-standard, ease),
      box-shadow var(--motion-fast, 0.15s) var(--ease-standard, ease),
      transform var(--motion-fast, 0.15s) var(--ease-standard, ease);
    &:hover {
      border-color: color-mix(in srgb, ${token.colorPrimaryBorder} 54%, ${token.colorBorderSecondary} 46%);
      box-shadow:
        inset 3px 0 0 ${token.colorPrimaryBorder},
        0 14px 28px color-mix(in srgb, ${token.colorPrimary} 8%, transparent);
      transform: translateY(-2px) scale(1.01);
    }
    @media (max-width: 768px) {
      grid-template-columns: 40px minmax(0, 1fr);
    }
  `,
  resourceLogo: css`
    position: relative;
    width: 40px;
    height: 40px;
    overflow: hidden;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, ${token.colorBorderSecondary} 70%, ${token.colorPrimaryBg} 30%);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, ${token.colorPrimaryBg} 74%, ${token.colorBgContainer} 26%),
      ${token.colorBgContainer}
    );
    box-shadow: 0 6px 16px color-mix(in srgb, ${token.colorPrimary} 8%, transparent);
    flex: none;
    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: ${token.colorBgContainer};
    }
    span {
      position: absolute;
      inset: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: ${token.colorPrimary};
      font-size: 12px;
      font-weight: 700;
      line-height: 1;
    }
  `,
  resourceMeta: css`
    display: grid;
    gap: 4px;
    min-width: 0;
  `,
  resourceActions: css`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    min-width: 160px;
    padding-left: 8px;
    @media (max-width: 768px) {
      grid-column: 2;
      justify-content: flex-start;
      padding-left: 0;
    }
  `,
  resourceDetailButton: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
  `,
  resourceDrawerTitle: css`
    display: grid;
    gap: 4px;
    min-width: 0;
  `,
  resourceDrawerHeader: css`
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    gap: 14px;
    align-items: center;
    padding: 2px 0 18px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
  `,
  resourceDrawerActions: css`
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 2px;
  `,
  drawerClosing: css`
    animation: resourceDrawerSlideOut 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
    @keyframes resourceDrawerSlideOut {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(24px);
      }
    }
  `,
  resourceDrawerLogo: css`
    width: 52px;
    height: 52px;
    border-radius: 14px;
  `,
  resourceDetailPanel: css`
    display: grid;
    gap: 10px;
    margin-top: 18px;
    animation: resourceExpandFadeIn var(--motion-duration-normal, 0.25s) var(--ease-out, ease);
    @keyframes resourceExpandFadeIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  resourceDetailRow: css`
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid ${token.colorBorderSecondary};
    background: color-mix(in srgb, ${token.colorBgContainer} 82%, ${token.colorPrimaryBg} 18%);
  `,
  resourceDetailIcon: css`
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-size: 14px;
  `,
  resourceDetailContent: css`
    flex: 1;
    min-width: 0;
  `,
  resourceDetailLabel: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    margin-bottom: 4px;
  `,
  resourceDetailText: css`
    font-size: 14px;
    color: ${token.colorText};
    line-height: 1.5;
  `,
  taskLine: css`
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr);
    gap: 12px;
    padding: 14px;
    margin-bottom: 10px;
    border-radius: 14px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorBgContainer};
  `,
  taskIndex: css`
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: 1px solid ${token.colorBorderSecondary};
    color: ${token.colorText};
    background: ${token.colorBgContainer};
    font-size: 12px;
    font-weight: 600;
  `,
  taskIndexPrimary: css`
    border-color: ${token.colorPrimaryBorder};
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
  `,
  reviewBox: css`
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    padding: 16px;
    background: ${token.colorBgContainer};
  `,
  phaseCardTitle: css`
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  `,
  phaseCardTitleText: css`
    font-family: var(--font-heading);
    font-weight: 700;
    letter-spacing: 0.04em;
    margin: 0;
  `,
  reviewMetaBlock: css`
    margin-top: 8px;
  `,
  reviewActions: css`
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  `,
  motionSafe: css`
    @media (prefers-reduced-motion: reduce) {
      &,
      * {
        animation: none !important;
        transition-duration: 1ms !important;
      }
    }
  `,
  pageEnterItem: css`
    will-change: opacity, transform;
    animation: pageEnterItemFade 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--page-stagger, 0ms);
    @keyframes pageEnterItemFade {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
}));

const LearningPathPage: React.FC = () => {
  const { styles, cx } = useStyles();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [workspace, setWorkspace] = useState<API.PlanWorkspacePayload>();
  const [preparation, setPreparation] = useState<PreparationState>({
    hasFavorite: false,
    hasProfile: false,
    hasLatestAnalysis: false,
    hasWorkspace: false,
  });
  const [resourceCompletedSet, setResourceCompletedSet] = useState<Set<string>>(
    new Set(),
  );
  const [activePhaseKey, setActivePhaseKey] = useState<LearningPathPhaseKey>();
  const [phaseMotionState, setPhaseMotionState] = useState<
    'idle' | 'leaving' | 'entering'
  >('idle');
  const [selectedModuleId, setSelectedModuleId] = useState<string>();
  const [reviewHistory, setReviewHistory] = useState<
    API.SnailLearningPathReviewPayload[]
  >([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [submittingReviewType, setSubmittingReviewType] = useState<
    'weekly' | 'monthly'
  >();
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const [activeReviewTab, setActiveReviewTab] = useState<'weekly' | 'monthly'>(
    'weekly',
  );
  const [activeResourceDetail, setActiveResourceDetail] =
    useState<ActiveResourceDetail>();
  const [resourceDrawerOpen, setResourceDrawerOpen] = useState(false);
  const [resourceDrawerClosing, setResourceDrawerClosing] = useState(false);
  const [weeklyFileList, setWeeklyFileList] = useState<UploadFile[]>([]);
  const [monthlyFileList, setMonthlyFileList] = useState<UploadFile[]>([]);
  const [weeklyForm] = Form.useForm<ReviewFormValues>();
  const [monthlyForm] = Form.useForm<ReviewFormValues>();
  const learningRouteRef = useRef<HTMLDivElement | null>(null);
  const phaseMotionTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const favoriteId = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const favoriteIdValue = Number(searchParams.get('favorite_id'));
    if (Number.isInteger(favoriteIdValue) && favoriteIdValue > 0)
      return favoriteIdValue;
    // URL 无参数时，fallback 到 localStorage（tab 切换后 URL 可能丢失参数）
    return loadFavoriteId();
  }, []);

  const clearPhaseMotionTimers = () => {
    for (const timer of phaseMotionTimersRef.current) {
      clearTimeout(timer);
    }
    phaseMotionTimersRef.current = [];
  };

  useEffect(
    () => () => {
      clearPhaseMotionTimers();
    },
    [],
  );

  // 每次有有效 favoriteId 时同步到 localStorage
  useEffect(() => {
    if (favoriteId) saveFavoriteId(favoriteId);
  }, [favoriteId]);
  const report = useMemo(() => {
    const snapshot = workspace?.favorite?.report_snapshot;
    if (!snapshot || typeof snapshot !== 'object') return null;
    const s = snapshot as API.CareerDevelopmentMatchReport;
    // 关键字段全部为空时视为数据缺失，由 error state 统一处理
    if (
      !s.report_id &&
      !s.target_title &&
      (!s.comparison_dimensions || s.comparison_dimensions.length === 0)
    ) {
      return null;
    }
    return s;
  }, [workspace]);

  useEffect(() => {
    const loadWorkspace = async () => {
      setLoading(true);
      setLoadError(undefined);
      try {
        const [homeRes, analysisRes, favoritesRes] = await Promise.all([
          getHomeV2({ skipErrorHandler: true }),
          getStudentCompetencyLatestAnalysis({ skipErrorHandler: true }),
          getCareerDevelopmentFavorites({ skipErrorHandler: true }),
        ]);
        const favorites = favoritesRes?.data || [];
        const matchedFavorite = favoriteId
          ? favorites.find((item) => item.favorite_id === favoriteId)
          : undefined;
        const nextPreparation: PreparationState = {
          hasFavorite: favoriteId
            ? Boolean(matchedFavorite)
            : favorites.length > 0,
          hasProfile: Boolean(
            homeRes?.data?.onboarding_completed && homeRes.data.profile,
          ),
          hasLatestAnalysis: Boolean(analysisRes?.data?.available),
          hasWorkspace: false,
        };
        setPreparation(nextPreparation);

        if (!favoriteId) {
          setWorkspace(undefined);
          setLoadError(
            '请先在"职业匹配"中选择并收藏目标岗位，再进入蜗牛学习路径。',
          );
          return;
        }
        if (!matchedFavorite) {
          setWorkspace(undefined);
          setLoadError(
            '当前目标岗位不存在或不属于当前账号，请先在"职业匹配"中重新收藏目标岗位。',
          );
          return;
        }
        if (!nextPreparation.hasProfile) {
          setWorkspace(undefined);
          setLoadError('请先前往"首页"补充我的资料，再生成蜗牛学习路径。');
          return;
        }
        if (!nextPreparation.hasLatestAnalysis) {
          setWorkspace(undefined);
          setLoadError(
            '请先前往"简历解析"完成 12 维解析，再生成蜗牛学习路径。',
          );
          return;
        }

        try {
          const response = await getCareerDevelopmentPlanWorkspace(favoriteId, {
            skipErrorHandler: true,
          });
          if (response?.data) {
            setWorkspace(response.data);
            setPreparation((current) => ({ ...current, hasWorkspace: true }));
            return;
          }
        } catch (error: any) {
          const statusCode = error?.response?.status;
          if (
            statusCode !== 404 &&
            !String(error?.message || '').includes('404')
          ) {
            throw error;
          }
        }

        const created = await initializeSnailLearningPathWorkspace(favoriteId, {
          skipErrorHandler: true,
        });
        setWorkspace(created?.data);
        setPreparation((current) => ({
          ...current,
          hasWorkspace: Boolean(created?.data),
        }));
      } catch (error: any) {
        setWorkspace(undefined);
        setLoadError(error?.message || '加载蜗牛学习路径失败。');
      }
    };

    void loadWorkspace().finally(() => setLoading(false));
  }, [favoriteId]);

  const storageKey = useMemo(
    () => buildWorkspaceStorageKey(workspace, report),
    [workspace, report],
  );
  useEffect(() => {
    setResourceCompletedSet(loadCompletedResources(storageKey));
  }, [storageKey]);

  const phases = workspace?.growth_plan_phases || [];
  const completedSet = useMemo(
    () => getCompletedModuleIds(phases, resourceCompletedSet),
    [phases, resourceCompletedSet],
  );
  const currentPhaseKey = useMemo(
    () => getCurrentPhaseKey(phases, completedSet),
    [phases, completedSet],
  );
  const currentPhaseIndex = useMemo(
    () => phases.findIndex((item) => item.phase_key === currentPhaseKey),
    [phases, currentPhaseKey],
  );

  // 恢复 activePhaseKey：每次 workspace 加载完成后，从 localStorage 恢复用户上次选中的阶段
  useEffect(() => {
    if (!workspace || !phases.length) return;
    setActivePhaseKey((previous) => {
      if (previous && phases.some((item) => item.phase_key === previous))
        return previous;
      const saved = loadActivePhaseKey(storageKey);
      if (saved && phases.some((item) => item.phase_key === saved)) {
        return saved;
      }
      return currentPhaseKey;
    });
  }, [workspace, phases, currentPhaseKey, storageKey]);

  const activePhase = useMemo(
    () =>
      phases.find((item) => item.phase_key === activePhaseKey) ||
      phases[currentPhaseIndex] ||
      phases[0],
    [activePhaseKey, currentPhaseIndex, phases],
  );
  const nextModule = useMemo(
    () =>
      activePhase?.learning_modules.find(
        (module) => !completedSet.has(module.module_id),
      ),
    [activePhase, completedSet],
  );
  useEffect(() => {
    if (!activePhase?.learning_modules.length) {
      setSelectedModuleId(undefined);
      return;
    }
    setSelectedModuleId((previous) => {
      if (
        previous &&
        activePhase.learning_modules.some(
          (module) => module.module_id === previous,
        )
      ) {
        return previous;
      }
      return nextModule?.module_id || activePhase.learning_modules[0].module_id;
    });
  }, [activePhase, nextModule]);
  const selectedModule = useMemo(
    () =>
      activePhase?.learning_modules.find(
        (module) => module.module_id === selectedModuleId,
      ) ||
      nextModule ||
      activePhase?.learning_modules[0],
    [activePhase, nextModule, selectedModuleId],
  );
  const selectedModuleResources = useMemo(
    () =>
      selectedModule && activePhase
        ? getModuleResources(selectedModule, activePhase.phase_key, {
            allowFallback: false,
          })
        : [],
    [activePhase, selectedModule],
  );
  const activePhaseProgress = useMemo(
    () =>
      activePhase
        ? getPhaseProgress(activePhase, completedSet)
        : { total: 0, completed: 0, percent: 0 },
    [activePhase, completedSet],
  );
  const checkedResourceUrls = useMemo(
    () => getCheckedResourceUrlsForPhase(activePhase, resourceCompletedSet),
    [activePhase, resourceCompletedSet],
  );
  useEffect(() => {
    if (!workspace?.workspace_id || !activePhase?.phase_key) return;
    setReviewLoading(true);
    listSnailLearningPathReviews(
      workspace.workspace_id,
      { phase_key: activePhase.phase_key },
      { skipErrorHandler: true },
    )
      .then((response) => setReviewHistory(response?.data || []))
      .catch(() => setReviewHistory([]))
      .finally(() => setReviewLoading(false));
  }, [workspace?.workspace_id, activePhase?.phase_key]);

  const latestWeeklyReview = reviewHistory.find(
    (item) => item.review_type === 'weekly',
  );
  const latestMonthlyReview = reviewHistory.find(
    (item) => item.review_type === 'monthly',
  );

  const handleContinue = () => {
    learningRouteRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const handlePhaseChange = (nextIndex: number) => {
    const phase = phases[nextIndex];
    if (!phase) return;
    if (phaseMotionState === 'leaving') return;
    if (phase.phase_key === activePhase?.phase_key) return;

    clearPhaseMotionTimers();
    const prefersReducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (prefersReducedMotion) {
      setActivePhaseKey(phase.phase_key);
      saveActivePhaseKey(storageKey, phase.phase_key);
      setReviewDrawerOpen(false);
      setResourceDrawerOpen(false);
      setActiveResourceDetail(undefined);
      return;
    }

    setPhaseMotionState('leaving');
    phaseMotionTimersRef.current = [
      setTimeout(() => {
        setActivePhaseKey(phase.phase_key);
        saveActivePhaseKey(storageKey, phase.phase_key);
        setPhaseMotionState('entering');
      }, 200),
      setTimeout(() => {
        setPhaseMotionState('idle');
      }, 620),
    ];
    setReviewDrawerOpen(false);
    setResourceDrawerOpen(false);
    setActiveResourceDetail(undefined);
  };

  const handleToggleResource = (
    phaseKey: LearningPathPhaseKey,
    moduleId: string,
    resource: ReturnType<typeof getModuleResources>[number],
    index: number,
    checked: boolean,
  ) => {
    const resourceId = getResourceCompletionId(
      phaseKey,
      moduleId,
      resource,
      index,
    );
    setResourceCompletedSet((previous) => {
      const next = new Set(previous);
      if (checked) next.add(resourceId);
      else next.delete(resourceId);
      saveCompletedResources(storageKey, next);
      saveCompletedModules(storageKey, getCompletedModuleIds(phases, next));
      return next;
    });
  };

  const handleToggleModuleResources = (
    phaseKey: LearningPathPhaseKey,
    module: API.GrowthPlanLearningModule,
    checked: boolean,
  ) => {
    const resources = getModuleResources(module, phaseKey, {
      allowFallback: false,
    });
    if (!resources.length) return;
    setResourceCompletedSet((previous) => {
      const next = new Set(previous);
      resources.forEach((resource, index) => {
        const resourceId = getResourceCompletionId(
          phaseKey,
          module.module_id,
          resource,
          index,
        );
        if (checked) next.add(resourceId);
        else next.delete(resourceId);
      });
      saveCompletedResources(storageKey, next);
      saveCompletedModules(storageKey, getCompletedModuleIds(phases, next));
      return next;
    });
  };

  const openResourceDetail = (
    phaseKey: LearningPathPhaseKey,
    module: API.GrowthPlanLearningModule,
    resource: LearningResource,
    resourceIndex: number,
  ) => {
    setActiveResourceDetail({
      phaseKey,
      moduleId: module.module_id,
      moduleTitle: getModuleDisplayTitle(module),
      resource,
      resourceIndex,
    });
    setResourceDrawerOpen(true);
  };

  const handleResourceDrawerClose = () => {
    setResourceDrawerClosing(true);
    setResourceDrawerOpen(false);
  };

  const handleResourceDrawerAfterOpenChange = (open: boolean) => {
    if (open) {
      setResourceDrawerClosing(false);
    } else {
      setResourceDrawerClosing(false);
      setActiveResourceDetail(undefined);
    }
  };

  const uploadProps = (
    fileList: UploadFile[],
    setter: React.Dispatch<React.SetStateAction<UploadFile[]>>,
  ): UploadProps => ({
    accept: REVIEW_UPLOAD_ACCEPT,
    beforeUpload: () => false,
    multiple: true,
    fileList,
    onChange: ({ fileList: next }) => setter(next),
  });

  const nativeFiles = (fileList: UploadFile[]) =>
    fileList
      .map((item) => item.originFileObj)
      .filter(Boolean)
      .map((item) => item as File);

  const submitReview = async (reviewType: 'weekly' | 'monthly') => {
    if (!workspace?.workspace_id || !activePhase || !report) return;
    const form = reviewType === 'weekly' ? weeklyForm : monthlyForm;
    const fileList = reviewType === 'weekly' ? weeklyFileList : monthlyFileList;
    try {
      const values = await form.validateFields();
      const formData = buildSnailReviewFormData({
        reviewType,
        phase: activePhase,
        checkedResourceUrls,
        userPrompt: values.summary,
        report,
        progress: activePhaseProgress,
        files: nativeFiles(fileList),
      });
      setSubmittingReviewType(reviewType);
      const response = await createSnailLearningPathReview(
        workspace.workspace_id,
        formData,
        { skipErrorHandler: true },
      );
      if (!response?.data) throw new Error('未收到检查结果。');
      setReviewHistory((current) => [
        response.data,
        ...current.filter((item) => item.review_id !== response.data.review_id),
      ]);
      form.resetFields();
      if (reviewType === 'weekly') setWeeklyFileList([]);
      else setMonthlyFileList([]);
      message.success(
        reviewType === 'weekly' ? '周检查已生成。' : '月评已生成。',
      );
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '检查生成失败。');
    } finally {
      setSubmittingReviewType(undefined);
    }
  };

  const pickSummaryLine = (text?: string) =>
    (text || '')
      .split(/[。！？!?]/)[0]
      .replace(/\s+/g, ' ')
      .trim();

  const limitKeywords = (items?: string[], count = 3) =>
    (items || []).filter(Boolean).slice(0, count);

  const renderWeeklyReport = (record?: API.SnailLearningPathReviewPayload) => {
    const reportData = record?.weekly_report;
    if (!reportData)
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="当前阶段还没有周检查结果"
        />
      );
    const doneKeywords = limitKeywords(
      reportData.focus_keywords.length
        ? reportData.focus_keywords
        : reportData.progress_keywords,
    );
    const goalKeywords = limitKeywords(reportData.gap_keywords, 2);
    const actionKeywords = limitKeywords(reportData.action_keywords);
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message={
            pickSummaryLine(reportData.headline) || '这周有推进，继续当前节奏。'
          }
        />
        <Card size="small" title="这周做了什么">
          {doneKeywords.length ? (
            <Space wrap style={{ marginBottom: 8 }}>
              {doneKeywords.map((item) => (
                <Tag color="blue" key={item}>
                  {item}
                </Tag>
              ))}
            </Space>
          ) : null}
          <Text>
            {pickSummaryLine(reportData.progress_assessment) ||
              '这周有学习记录。'}
          </Text>
        </Card>
        <Card size="small" title="离目标还有多远">
          {goalKeywords.length ? (
            <Space wrap style={{ marginBottom: 8 }}>
              {goalKeywords.map((item) => (
                <Tag color="gold" key={item}>
                  {item}
                </Tag>
              ))}
            </Space>
          ) : null}
          <Text>
            {pickSummaryLine(reportData.goal_gap_summary) || '还需要继续推进。'}
          </Text>
        </Card>
        <Card size="small" title="下周做什么">
          {actionKeywords.length ? (
            <Space wrap style={{ marginBottom: 8 }}>
              {actionKeywords.map((item) => (
                <Tag color="green" key={item}>
                  {item}
                </Tag>
              ))}
            </Space>
          ) : null}
          <Text>
            {pickSummaryLine(reportData.next_action) || '继续当前阶段任务。'}
          </Text>
        </Card>
        <Collapse
          size="small"
          items={[
            {
              key: 'weekly-detail',
              label: '查看详细分析',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Card size="small" title="详细结论">
                    <Text>{reportData.progress_assessment}</Text>
                  </Card>
                  {reportData.highlights.length ? (
                    <Card size="small" title="本周有效学习点">
                      <List
                        size="small"
                        dataSource={reportData.highlights}
                        renderItem={(item) => <List.Item>{item}</List.Item>}
                      />
                    </Card>
                  ) : null}
                  {reportData.blockers.length ? (
                    <Card size="small" title="当前阻碍">
                      <List
                        size="small"
                        dataSource={reportData.blockers}
                        renderItem={(item) => <List.Item>{item}</List.Item>}
                      />
                    </Card>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </Space>
    );
  };

  const renderMonthlyReport = (record?: API.SnailLearningPathReviewPayload) => {
    const reportData = record?.monthly_report;
    if (!reportData)
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="当前阶段还没有月评结果"
        />
      );
    const monthKeywords = limitKeywords(
      reportData.focus_keywords.length
        ? reportData.focus_keywords
        : reportData.progress_keywords,
    );
    const goalKeywords = limitKeywords(reportData.gap_keywords, 2);
    const nextActions = reportData.next_actions.filter(Boolean).slice(0, 3);
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type={reportData.recommendation === 'advance' ? 'success' : 'info'}
          showIcon
          message={
            pickSummaryLine(reportData.headline) || '本月有推进，继续当前阶段。'
          }
        />
        <Card size="small" title="本月完成了什么">
          {monthKeywords.length ? (
            <Space wrap style={{ marginBottom: 8 }}>
              {monthKeywords.map((item) => (
                <Tag color="blue" key={item}>
                  {item}
                </Tag>
              ))}
            </Space>
          ) : null}
          <Text>
            {pickSummaryLine(reportData.monthly_summary) || '本月有持续学习。'}
          </Text>
        </Card>
        <Card size="small" title="现在在哪个阶段">
          <Space wrap style={{ marginBottom: 8 }}>
            <Tag color="processing">
              {activePhase?.phase_label || PHASE_LABELS[currentPhaseKey]}
            </Tag>
            <Tag
              color={
                reportData.recommendation === 'advance' ? 'success' : 'default'
              }
            >
              {MONTHLY_RECOMMENDATION_LABELS[reportData.recommendation]}
            </Tag>
            {goalKeywords.map((item) => (
              <Tag color="gold" key={item}>
                {item}
              </Tag>
            ))}
          </Space>
          {reportData.progress_keywords.length ? (
            <Space wrap style={{ marginBottom: 8 }}>
              {reportData.progress_keywords.map((item) => (
                <Tag key={item}>{item}</Tag>
              ))}
            </Space>
          ) : null}
          <Text>
            {pickSummaryLine(reportData.phase_progress_summary) ||
              '继续当前阶段。'}
          </Text>
        </Card>
        <Card size="small" title="下月重点做什么">
          {reportData.action_keywords.length ? (
            <Space wrap style={{ marginBottom: 8 }}>
              {limitKeywords(reportData.action_keywords).map((item) => (
                <Tag color="green" key={item}>
                  {item}
                </Tag>
              ))}
            </Space>
          ) : null}
          {nextActions.length ? (
            <List
              size="small"
              dataSource={nextActions}
              renderItem={(item) => <List.Item>{item}</List.Item>}
            />
          ) : (
            <Text>
              {pickSummaryLine(reportData.gap_assessment) ||
                '继续推进当前模块。'}
            </Text>
          )}
        </Card>
        <Collapse
          size="small"
          items={[
            {
              key: 'monthly-detail',
              label: '查看详细分析',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Card size="small" title="阶段差距">
                    <Text>{reportData.gap_assessment}</Text>
                  </Card>
                  {reportData.focus_points.length ? (
                    <Card size="small" title="本月重点">
                      <List
                        size="small"
                        dataSource={reportData.focus_points}
                        renderItem={(item) => <List.Item>{item}</List.Item>}
                      />
                    </Card>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </Space>
    );
  };

  const renderReviewPane = (reviewType: 'weekly' | 'monthly') => {
    const isWeekly = reviewType === 'weekly';
    const form = isWeekly ? weeklyForm : monthlyForm;
    const fileList = isWeekly ? weeklyFileList : monthlyFileList;
    const historyList = reviewHistory.filter(
      (item) => item.review_type === reviewType,
    );
    const latest = isWeekly ? latestWeeklyReview : latestMonthlyReview;
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type={checkedResourceUrls.length ? 'info' : 'warning'}
          showIcon
          message={
            isWeekly
              ? '填写本周学习总结并生成周检查'
              : '填写本月学习总结并生成月评'
          }
          description={
            checkedResourceUrls.length
              ? '本次分析会使用当前阶段已打勾的网站、你的总结以及上传材料。'
              : '当前阶段还没有已打勾网站。你仍可先填写学习总结并上传文档材料。'
          }
        />
        <div className={styles.reviewBox}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Text type="secondary">本次将用于分析的网站</Text>
              <div className={styles.reviewMetaBlock}>
                {checkedResourceUrls.length ? (
                  <Space wrap>
                    {checkedResourceUrls.map((url) => (
                      <Tag key={url}>{url}</Tag>
                    ))}
                  </Space>
                ) : (
                  <Text type="secondary">当前阶段暂无已打勾网站</Text>
                )}
              </div>
            </div>
            <Form form={form} layout="vertical">
              <Form.Item
                label={
                  isWeekly
                    ? '请输入你本周学到了什么内容'
                    : '请输入你本月学到了什么内容'
                }
                name="summary"
                rules={[
                  {
                    required: true,
                    message: isWeekly
                      ? '请填写本周学习总结'
                      : '请填写本月学习总结',
                  },
                ]}
              >
                <TextArea autoSize={{ minRows: 4, maxRows: 8 }} />
              </Form.Item>
            </Form>
            <Upload
              {...uploadProps(
                fileList,
                isWeekly ? setWeeklyFileList : setMonthlyFileList,
              )}
            >
              <Button icon={<UploadOutlined />}>上传学习材料</Button>
            </Upload>
            <Text type="secondary">
              支持 txt / md / docx / json / csv / html /
              代码文件，系统会抽取可读文本后参与分析。
            </Text>
            <div className={styles.reviewActions}>
              <Text type="secondary">
                当前阶段：
                {activePhase?.phase_label ||
                  (activePhase ? PHASE_LABELS[activePhase.phase_key] : '')}
              </Text>
              <Button
                type="primary"
                loading={submittingReviewType === reviewType}
                onClick={() => void submitReview(reviewType)}
              >
                {isWeekly ? '生成周检查' : '生成月评'}
              </Button>
            </div>
          </Space>
        </div>
        <Card size="small" title={isWeekly ? '最新周检查' : '最新月评'}>
          {reviewLoading ? (
            <Spin />
          ) : isWeekly ? (
            renderWeeklyReport(latest)
          ) : (
            renderMonthlyReport(latest)
          )}
        </Card>
        <Card
          size="small"
          title={
            isWeekly
              ? `周检查历史(${historyList.length})`
              : `月评历史(${historyList.length})`
          }
        >
          {reviewLoading ? (
            <Spin />
          ) : !historyList.length ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无历史记录"
            />
          ) : isWeekly ? (
            <List
              dataSource={historyList}
              renderItem={(item) => (
                <List.Item>
                  <Space
                    direction="vertical"
                    size={4}
                    style={{ width: '100%' }}
                  >
                    <Space
                      wrap
                      style={{ justifyContent: 'space-between', width: '100%' }}
                    >
                      <Text strong>
                        {new Date(item.created_at).toLocaleString('zh-CN')}
                      </Text>
                      <Tag color="blue">周检查</Tag>
                    </Space>
                    <Text>{item.weekly_report?.headline || '周检查'}</Text>
                    <Text type="secondary">
                      {item.weekly_report?.next_action || '暂无后续建议'}
                    </Text>
                  </Space>
                </List.Item>
              )}
            />
          ) : (
            <Collapse
              items={historyList.map((item) => ({
                key: `${item.review_id}`,
                label: (
                  <Space wrap>
                    <Text strong>
                      {new Date(item.created_at).toLocaleString('zh-CN')}
                    </Text>
                    <Tag color="processing">
                      {item.monthly_report
                        ? MONTHLY_RECOMMENDATION_LABELS[
                            item.monthly_report.recommendation
                          ]
                        : '月评'}
                    </Tag>
                  </Space>
                ),
                children: renderMonthlyReport(item),
              }))}
            />
          )}
        </Card>
      </Space>
    );
  };

  const renderResourceDetailDrawer = () => {
    if (!activeResourceDetail) return null;
    const { phaseKey, moduleId, moduleTitle, resource, resourceIndex } =
      activeResourceDetail;
    const resourceId = getResourceCompletionId(
      phaseKey,
      moduleId,
      resource,
      resourceIndex,
    );
    const checked = resourceCompletedSet.has(resourceId);
    const detailRows = [
      {
        key: 'whyLearn',
        label: '为什么学这条资源？',
        text: resource.whyLearn,
        icon: <ThunderboltOutlined />,
      },
      {
        key: 'learnWhat',
        label: '学习内容',
        text: resource.learnWhat,
        icon: <BookOutlined />,
      },
      {
        key: 'doneWhen',
        label: '完成后你能做到',
        text: resource.doneWhen,
        icon: <FileDoneOutlined />,
      },
    ].filter((item) => item.text);

    return (
      <Drawer
        title={
          <div className={styles.resourceDrawerTitle}>
            <Text strong>{resource.title}</Text>
            <Text type="secondary">{moduleTitle}</Text>
          </div>
        }
        placement="right"
        width={460}
        open={resourceDrawerOpen}
        onClose={handleResourceDrawerClose}
        afterOpenChange={handleResourceDrawerAfterOpenChange}
        destroyOnClose
      >
        <div
          data-testid="resource-detail-drawer"
          className={resourceDrawerClosing ? styles.drawerClosing : undefined}
        >
          <div className={styles.resourceDrawerHeader}>
            <div
              className={cx(styles.resourceLogo, styles.resourceDrawerLogo)}
              aria-hidden={!resource.logoUrl}
            >
              <span>{getResourceLogoFallbackText(resource.title)}</span>
              {resource.logoUrl ? (
                <img
                  src={resource.logoUrl}
                  alt={resource.logoAlt || `${resource.title} logo`}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
            </div>
            <div className={styles.resourceMeta}>
              <Text strong>{resource.title}</Text>
              <Text type="secondary">{resource.url}</Text>
            </div>
            <div className={styles.resourceDrawerActions}>
              <Tag color={checked ? 'success' : 'default'}>
                {checked ? '已完成' : '未完成'}
              </Tag>
              <Checkbox
                checked={checked}
                onChange={(event) =>
                  handleToggleResource(
                    phaseKey,
                    moduleId,
                    resource,
                    resourceIndex,
                    event.target.checked,
                  )
                }
              >
                已打卡
              </Checkbox>
              <Button
                type="primary"
                href={resource.url}
                target="_blank"
              >
                去学习
              </Button>
            </div>
          </div>

          <div className={styles.resourceDetailPanel}>
            {detailRows.length ? (
              detailRows.map((item) => (
                <div key={item.key} className={styles.resourceDetailRow}>
                  <span className={styles.resourceDetailIcon}>
                    {item.icon}
                  </span>
                  <div className={styles.resourceDetailContent}>
                    <div className={styles.resourceDetailLabel}>
                      {item.label}
                    </div>
                    <div className={styles.resourceDetailText}>
                      {item.text}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无资源详情"
              />
            )}
          </div>
        </div>
      </Drawer>
    );
  };

  const openReviewDrawer = (reviewType: 'weekly' | 'monthly' = 'weekly') => {
    setActiveReviewTab(reviewType);
    setReviewDrawerOpen(true);
  };

  const preparationItems = [
    {
      key: 'favorite',
      label: '已选择并收藏目标岗位',
      ready: preparation.hasFavorite,
      description: preparation.hasFavorite
        ? '当前目标岗位已绑定到本次学习路径。'
        : '请先前往"职业匹配"选择推荐岗位并完成收藏。',
    },
    {
      key: 'profile',
      label: '已完善我的资料',
      ready: preparation.hasProfile,
      description: preparation.hasProfile
        ? '我的资料已补充完成。'
        : '请先前往"首页"完善姓名、学校、专业、学历、年级和目标岗位。',
    },
    {
      key: 'analysis',
      label: '已生成 12 维解析',
      ready: preparation.hasLatestAnalysis,
      description: preparation.hasLatestAnalysis
        ? '已读取最新的 12 维解析结果。'
        : '请先前往"简历解析"完成 12 维解析。',
    },
    {
      key: 'workspace',
      label: '已生成蜗牛学习路径工作台',
      ready: preparation.hasWorkspace,
      description: preparation.hasWorkspace
        ? '当前目标岗位已生成专属学习路径工作台。'
        : '满足前置条件后，系统会自动初始化蜗牛学习路径工作台。',
    },
  ];
  const primaryGuidancePath = !preparation.hasFavorite
    ? '/student-competency-profile'
    : !preparation.hasProfile
      ? '/'
      : '/student-competency-profile';
  const primaryGuidanceText = !preparation.hasFavorite
    ? '前往职业匹配'
    : !preparation.hasProfile
      ? '前往首页'
      : '前往简历解析';
  const preparationCard = (
    <div className={styles.statusStrip}>
      <div className={styles.statusItems}>
        {preparationItems.map((item) => (
          <span
            key={item.key}
            className={cx(
              styles.statusItem,
              item.ready && styles.statusItemReady,
            )}
            title={item.description}
          >
            <span
              className={cx(
                styles.statusDot,
                item.ready && styles.statusDotReady,
              )}
            />
            {item.label}
          </span>
        ))}
      </div>
      {!preparationItems.every((item) => item.ready) ? (
        <Button
          type="link"
          size="small"
          onClick={() => history.push(primaryGuidancePath)}
        >
          {primaryGuidanceText}
        </Button>
      ) : (
        <Tag color="success">准备完成</Tag>
      )}
    </div>
  );

  if (loading) {
    return (
      <PageContainer title={false}>
        <div className={styles.page} data-testid="learning-path-skeleton">
          <div className={styles.statusStrip}>
            <Skeleton.Button
              active
              size="small"
              style={{ width: 560, maxWidth: '100%' }}
            />
            <Skeleton.Button active size="small" style={{ width: 88 }} />
          </div>
          <div className={styles.heroPanel}>
            <div className={styles.heroTop}>
              <div>
                <Skeleton.Button
                  active
                  size="small"
                  style={{ width: 160, marginBottom: 12 }}
                />
                <Skeleton.Input active style={{ width: 280, height: 32 }} />
              </div>
              <Skeleton.Button active size="small" style={{ width: 136 }} />
            </div>
            <div className={styles.metricGrid}>
              {[...Array(METRIC_COUNT).keys()].map((item) => (
                <div key={item} className={styles.metricCell}>
                  <Skeleton active paragraph={{ rows: 1 }} title={false} />
                </div>
              ))}
            </div>
          </div>
          <div className={styles.phaseTimeline}>
            {[0, 1, 2].map((item) => (
              <div key={item} className={styles.phaseNode}>
                <Skeleton active paragraph={{ rows: 2 }} title={false} />
              </div>
            ))}
          </div>
          <div className={styles.workspaceShell}>
            <div className={styles.workspaceHeader}>
              <Skeleton active paragraph={{ rows: 1 }} />
            </div>
            <div className={styles.workspaceBody}>
              <div className={styles.workspacePane}>
                <Skeleton active paragraph={{ rows: 5 }} />
              </div>
              <div className={styles.workspacePane}>
                <Skeleton active paragraph={{ rows: 7 }} />
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (loadError || !favoriteId || !report) {
    return (
      <PageContainer title={false}>
        <div className={styles.page}>
          {preparationCard}
          <Result
            status="info"
            title="蜗牛学习路径"
            subTitle={
              loadError ||
              (!favoriteId
                ? '请先在"职业匹配"中选择并收藏目标岗位，再进入蜗牛学习路径。'
                : !report
                  ? '报告数据缺失，请重新在"职业匹配"中收藏目标岗位。'
                  : '当前还不能生成学习路径，请先完成上面的前置条件。')
            }
            extra={
              <Space wrap>
                <Button
                  type="primary"
                  onClick={() => history.push(primaryGuidancePath)}
                >
                  {primaryGuidanceText}
                </Button>
                <Button
                  onClick={() => history.push('/student-competency-profile')}
                >
                  返回职业匹配
                </Button>
              </Space>
            }
          />
        </div>
      </PageContainer>
    );
  }

  if (!workspace || !activePhase) {
    return (
      <PageContainer title={false}>
        <div className={styles.page}>
          <Empty description="暂无学习路径" />
        </div>
      </PageContainer>
    );
  }

  const activeStatus =
    activePhaseProgress.total > 0 &&
    activePhaseProgress.completed === activePhaseProgress.total
      ? '已完成'
      : activePhase.phase_key === currentPhaseKey
        ? '进行中'
        : '查看中';
  const activeStageTitle =
    activePhase.phase_label || PHASE_LABELS[activePhase.phase_key];
  const activePhaseCompletionPercent = activePhaseProgress.percent;
  const matchPercent = Math.round(report.overall_match);
  const topStatusBar = (
    <div
      className={cx(styles.pageEnterItem)}
      style={{ '--page-stagger': '0ms' } as React.CSSProperties}
    >
      <div className={styles.statusStrip}>
        <div className={styles.topStatusPrimary}>
          <span
            className={styles.statusRing}
            role="img"
            aria-label={`当前阶段完成度 ${activePhaseCompletionPercent}%`}
          >
            <Progress
              type="circle"
              size={44}
              percent={activePhaseCompletionPercent}
              strokeWidth={10}
            />
          </span>
          <div>
            <div className={styles.statusTitleLine}>
              <span className={styles.statusTitle}>
                {activeStageTitle} · {activePhase.time_horizon}
              </span>
              <Tag color={activeStatus === '已完成' ? 'success' : 'processing'}>
                {activeStatus}
              </Tag>
            </div>
            <div className={styles.statusItems}>
              {preparationItems.map((item) => (
                <span
                  key={item.key}
                  className={cx(
                    styles.statusItem,
                    item.ready && styles.statusItemReady,
                  )}
                  title={item.description}
                >
                  <span
                    className={cx(
                      styles.statusDot,
                      item.ready && styles.statusDotReady,
                    )}
                  />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.statusTargetCard}>
          <div>
            <Text type="secondary">专注职业目标</Text>
            <div>
              <Text strong>
                当前目标为{report.target_title}，推进基础知识学习。
              </Text>
            </div>
          </div>
          <div className={styles.statusActionGroup}>
            <Button
              icon={<SendOutlined />}
              onClick={() => openReviewDrawer('weekly')}
            >
              提交学习进度
            </Button>
            <Button
              icon={<EditOutlined />}
              onClick={() =>
                history.push(
                  `/personal-growth-report?favorite_id=${favoriteId}`,
                )
              }
            >
              编辑计划
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <PageContainer title={false}>
      <div className={cx(styles.page, styles.motionSafe)}>
        <div
          className={cx(styles.pageEnterItem)}
          style={{ '--page-stagger': '0ms' } as React.CSSProperties}
        >
          {topStatusBar}
        </div>
        <div
          className={cx(styles.pageEnterItem)}
          style={{ '--page-stagger': '70ms' } as React.CSSProperties}
        >
          <div className={styles.heroPanel}>
            <div className={styles.heroTop}>
              <div>
                <div className={styles.heroMeta}>
                  <Button
                    type="text"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => history.push('/student-competency-profile')}
                  >
                    返回职业匹配
                  </Button>
                  <Tag color="processing">{report.target_title}</Tag>
                  {report.industry ? <Tag>{report.industry}</Tag> : null}
                </div>
                <Title level={2} className={styles.heroTitle}>
                  蜗牛学习路径
                </Title>
                <Text className={styles.heroSubtitle}>
                  根据你的职业目标和学习进度，蜗牛帮助你规划合理的学习路径，逐步完成能力提升。
                </Text>
              </div>
              <div className={styles.heroGoalPanel}>
                <div className={styles.heroGoalLine}>
                  <Text type="secondary">当前目标</Text>
                  <Tag color="blue">{report.target_title}</Tag>
                </div>
                <div className={styles.heroGoalLine}>
                  <Text type="secondary">当前阶段</Text>
                  <Text strong>
                    {activeStageTitle}（{activePhase.time_horizon}）
                  </Text>
                </div>
                <div>
                  <div className={styles.heroGoalLine}>
                    <Text type="secondary">目标完成度</Text>
                    <Text strong>{activePhaseCompletionPercent}%</Text>
                  </div>
                  <Progress
                    percent={activePhaseCompletionPercent}
                    showInfo={false}
                  />
                </div>
                <div className={styles.heroActions}>
                  <Button onClick={() => openReviewDrawer('weekly')}>
                    提交进度
                  </Button>
                  <Button type="primary" onClick={handleContinue}>
                    继续学习
                  </Button>
                </div>
              </div>
            </div>
            <div className={styles.metricGrid}>
              <div className={cx(styles.metricCell, styles.metricCellPrimary)}>
                <span className={styles.metricIcon}>
                  <CalendarOutlined />
                </span>
                <div>
                  <Text type="secondary">当前阶段</Text>
                  <Title level={3} className={styles.metricValue}>
                    {activeStageTitle}
                  </Title>
                  <Text type="secondary">{activePhase.time_horizon}</Text>
                </div>
              </div>
              <div className={styles.metricCell}>
                <span className={styles.metricIcon}>
                  <FlagOutlined />
                </span>
                <div>
                  <Text type="secondary">匹配度</Text>
                  <Title level={3} className={styles.metricValue}>
                    {matchPercent}%
                  </Title>
                  <Progress
	                    className={styles.compactProgress}
	                    percent={matchPercent}
	                    showInfo={false}
	                  />
                </div>
              </div>
              <div className={styles.metricCell}>
                <span className={styles.metricIcon}>
                  <FileDoneOutlined />
                </span>
                <div>
                  <Text type="secondary">内容完成度</Text>
                  <Title level={3} className={styles.metricValue}>
                    {Math.round(
                      workspace?.metric_snapshot?.learning_completion_rate ?? 0,
                    )}
                    %
                  </Title>
                  <Progress
                    className={styles.compactProgress}
                    percent={Math.round(
                      workspace?.metric_snapshot?.learning_completion_rate ?? 0,
                    )}
                    showInfo={false}
                  />
                </div>
              </div>
              <div className={styles.metricCell}>
                <span className={styles.metricIcon}>
                  <ThunderboltOutlined />
                </span>
                <div>
                  <Text type="secondary">实践完成度</Text>
                  <Title level={3} className={styles.metricValue}>
                    {Math.round(
                      workspace?.metric_snapshot?.practice_completion_rate ?? 0,
                    )}
                    %
                  </Title>
                  <Progress
                    className={styles.compactProgress}
                    percent={Math.round(
                      workspace?.metric_snapshot?.practice_completion_rate ?? 0,
                    )}
                    showInfo={false}
                  />
                </div>
              </div>
              <div className={styles.metricCell}>
                <span className={styles.metricIcon}>
                  <BookOutlined />
                </span>
                <div>
                  <Text type="secondary">当前模块</Text>
                  <div>
                    <Text strong>
                      {nextModule
                        ? getModuleDisplayTitle(nextModule)
                        : '已完成'}
                    </Text>
                  </div>
                  <Text type="secondary">
                    {activePhaseProgress.completed}/{activePhaseProgress.total}{' '}
                    个模块
                  </Text>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={cx(styles.pageEnterItem)}
          style={{ '--page-stagger': '140ms' } as React.CSSProperties}
        >
          <div className={styles.phaseTimeline}>
            {phases.map((phase, index) => {
              const progress = getPhaseProgress(phase, completedSet);
              const isActive = phase.phase_key === activePhase.phase_key;
              const isDone =
                progress.total > 0 && progress.completed === progress.total;
              const isCurrent = phase.phase_key === currentPhaseKey;
              const stateText = isDone
                ? '已完成'
                : isCurrent
                  ? '进行中'
                  : '未开始';
              return (
                <button
                  key={phase.phase_key}
                  type="button"
                  className={cx(
                    styles.phaseNode,
                    phase.phase_key === 'short_term' && styles.phaseNodeShort,
                    phase.phase_key === 'mid_term' && styles.phaseNodeMid,
                    phase.phase_key === 'long_term' && styles.phaseNodeLong,
                    isActive && styles.phaseNodeActive,
                  )}
                  onClick={() => handlePhaseChange(index)}
                >
                  <div className={styles.phaseNodeContent}>
                    <div className={styles.phaseNodeHead}>
                      <span
                        className={cx(
                          styles.phaseIndex,
                          isActive && styles.phaseIndexActive,
                        )}
                      >
                        {isDone ? <CheckCircleFilled /> : index + 1}
                      </span>
                      <Tag
                        color={
                          isDone
                            ? 'success'
                            : isCurrent
                              ? 'processing'
                              : 'default'
                        }
                      >
                        {stateText}
                      </Tag>
                    </div>
                    <div className={styles.phaseNodeTitle}>
                      <Text strong>
                        {phase.phase_label || PHASE_LABELS[phase.phase_key]}
                      </Text>
                      <Text type="secondary">{phase.time_horizon}</Text>
                    </div>
                    <Progress
                      percent={progress.percent}
                      showInfo={false}
                      size="small"
                    />
                    <div className={styles.phaseNodeFooter}>
                      <span>
                        {progress.completed}/{progress.total} 模块
                      </span>
                      <span>{progress.percent}%</span>
                    </div>
                  </div>
                  <div className={styles.phaseVisual}>
                    {getPhaseVisualIcon(phase.phase_key)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className={cx(styles.pageEnterItem)}
        style={{ '--page-stagger': '210ms' } as React.CSSProperties}
      >
        <div
          className={cx(
            styles.phaseMotion,
            phaseMotionState === 'leaving'
              ? styles.phaseWorkspaceLeave
              : styles.phaseWorkspaceEnter,
          )}
          key={activePhase.phase_key}
        >
          <div className={styles.workspaceShell}>
            <div className={styles.workspaceHeader}>
              <div className={styles.phaseCardTitle}>
                <Title level={2} className={styles.phaseCardTitleText}>
                  {activePhase.phase_label ||
                    PHASE_LABELS[activePhase.phase_key]}
                </Title>
                <Tag>{activePhase.time_horizon}</Tag>
                <Tag color={activeStatus === '已完成' ? 'success' : 'blue'}>
                  {activeStatus}
                </Tag>
              </div>
              <div className={styles.reviewToolbar}>
                <Button onClick={() => openReviewDrawer('weekly')}>
                  提交周检查
                </Button>
                <Button onClick={() => openReviewDrawer('monthly')}>
                  提交月评
                </Button>
              </div>
            </div>
            <div className={styles.workspaceBody}>
              <div
                className={cx(styles.workspacePane, styles.workspacePaneMuted)}
                ref={learningRouteRef}
              >
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <Title level={5} className={styles.phaseCardTitleText}>
                      学习模块
                    </Title>
                    <Text type="secondary">
                      {activePhaseProgress.completed}/
                      {activePhaseProgress.total}
                    </Text>
                  </div>
                  <Progress percent={activePhaseProgress.percent} />
                  <div className={styles.phaseGoalBox}>
                    <Text strong>本阶段目标</Text>
                    <Text className={styles.clampText}>
                      {activePhase.goal_statement ||
                        '完成当前阶段学习模块，沉淀可复用的学习证据。'}
                    </Text>
                  </div>
                </div>
                <div className={styles.section}>
                  {activePhase.learning_modules.length ? (
                    <div className={styles.moduleRail}>
                      {activePhase.learning_modules.map((module, index) => {
                        const moduleStatus = getModuleCompletionStatus(
                          activePhase.phase_key,
                          module,
                          resourceCompletedSet,
                        );
                        const isCurrentModule =
                          !moduleStatus.done &&
                          nextModule?.module_id === module.module_id;
                        const moduleStateLabel = moduleStatus.done
                          ? '已完成'
                          : isCurrentModule
                            ? '进行中'
                            : '未开始';
                        const moduleStateColor = moduleStatus.done
                          ? 'success'
                          : isCurrentModule
                            ? 'processing'
                            : 'default';
                        const isSelectedModule =
                          selectedModule?.module_id === module.module_id;
                        return (
                          <button
                            key={module.module_id}
                            type="button"
                            className={cx(
                              styles.moduleStep,
                              styles.moduleItemMotion,
                              isSelectedModule && styles.moduleStepSelected,
                            )}
                            style={
                              {
                                '--module-index': index,
                              } as React.CSSProperties
                            }
                            aria-pressed={isSelectedModule}
                            onClick={() =>
                              setSelectedModuleId(module.module_id)
                            }
                          >
                            <span
                              className={cx(
                                styles.moduleDot,
                                moduleStatus.done && styles.moduleDotDone,
                                isCurrentModule && styles.moduleDotCurrent,
                              )}
                            >
                              {moduleStatus.done ? (
                                <CheckCircleFilled />
                              ) : (
                                index + 1
                              )}
                            </span>
                            <div className={styles.moduleMeta}>
                              <div className={styles.moduleHead}>
                                <Text strong>
                                  {getModuleDisplayTitle(module)}
                                </Text>
                                <Tag color={moduleStateColor}>
                                  {moduleStateLabel}
                                </Tag>
                              </div>
                              <Text className={styles.clampText}>
                                {getModuleDisplayDescription(module)}
                              </Text>
                            </div>
                            <div className={styles.moduleStats}>
                              <Checkbox
                                checked={moduleStatus.done}
                                indeterminate={
                                  moduleStatus.completed > 0 &&
                                  !moduleStatus.done
                                }
                                disabled={!moduleStatus.total}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) =>
                                  handleToggleModuleResources(
                                    activePhase.phase_key,
                                    module,
                                    event.target.checked,
                                  )
                                }
                              />
                              <Text strong>
                                {moduleStatus.completed}/{moduleStatus.total}
                              </Text>
                              <span>资源</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="暂无学习模块"
                    />
                  )}
                </div>

                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <Title level={5} className={styles.phaseCardTitleText}>
                      动手任务
                    </Title>
                  </div>
                  {activePhase.practice_actions.length ? (
                    activePhase.practice_actions.map((action, index) => (
                      <div
                        key={`${action.action_type}-${action.title}`}
                        className={cx(styles.taskLine, styles.moduleItemMotion)}
                        style={
                          {
                            '--module-index':
                              activePhase.learning_modules.length + index,
                          } as React.CSSProperties
                        }
                      >
                        <span
                          className={cx(
                            styles.taskIndex,
                            index === 0 && styles.taskIndexPrimary,
                          )}
                        >
                          {index + 1}
                        </span>
                        <div className={styles.moduleMeta}>
                          <Text strong>{getActionTaskTitle(action)}</Text>
                          <Text className={styles.clampText}>
                            {getActionTaskDescription(action)}
                          </Text>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="暂无动手任务"
                    />
                  )}
                </div>
              </div>

              <div className={styles.workspacePane}>
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <Title level={5} className={styles.phaseCardTitleText}>
                      去哪里学
                    </Title>
                    <Text type="secondary">打卡后用于周/月复盘</Text>
                  </div>
                  {selectedModule ? (
                    <div
                      key={selectedModule.module_id}
                      className={styles.resourceGroup}
                    >
                      <Text strong>
                        {getModuleDisplayTitle(selectedModule)}
                      </Text>
                      {selectedModuleResources.length ? (
                        selectedModuleResources.map((resource, index) => {
                          const resourceId = getResourceCompletionId(
                            activePhase.phase_key,
                            selectedModule.module_id,
                            resource,
                            index,
                          );
                          const checked = resourceCompletedSet.has(resourceId);

                          return (
                            <div
                              key={resourceId}
                              className={cx(
                                styles.resourceLine,
                                styles.resourceItemMotion,
                              )}
                              style={
                                {
                                  '--resource-index': index,
                                } as React.CSSProperties
                              }
                            >
                              <div
                                className={styles.resourceLogo}
                                aria-hidden={!resource.logoUrl}
                              >
                                <span>
                                  {getResourceLogoFallbackText(resource.title)}
                                </span>
                                {resource.logoUrl ? (
                                  <img
                                    src={resource.logoUrl}
                                    alt={
                                      resource.logoAlt ||
                                      `${resource.title} logo`
                                    }
                                    loading="lazy"
                                    onError={(event) => {
                                      event.currentTarget.style.display =
                                        'none';
                                    }}
                                  />
                                ) : null}
                              </div>
                              <div className={styles.resourceMeta}>
                                <Text strong>{resource.title}</Text>
                                <Text className={styles.clampText}>
                                  学什么：{resource.learnWhat}
                                </Text>
                                <Text
                                  type="secondary"
                                  className={styles.clampText}
                                >
                                  完成标准：{resource.doneWhen}
                                </Text>
                              </div>
                              <div className={styles.resourceActions}>
                                <Tag color={checked ? 'success' : 'default'}>
                                  {checked ? '已完成' : '未完成'}
                                </Tag>
                                <Checkbox
                                  checked={checked}
                                  onChange={(event) =>
                                    handleToggleResource(
                                      activePhase.phase_key,
                                      selectedModule.module_id,
                                      resource,
                                      index,
                                      event.target.checked,
                                    )
                                  }
                                >
                                  已打卡
                                </Checkbox>
                                <Button
                                  type="primary"
                                  size="small"
                                  href={resource.url}
                                  target="_blank"
                                >
                                  去学习
                                </Button>
                                <Button
                                  size="small"
                                  icon={<InfoCircleOutlined />}
                                  data-testid="resource-detail-trigger"
                                  className={styles.resourceDetailButton}
                                  onClick={() =>
                                    openResourceDetail(
                                      activePhase.phase_key,
                                      selectedModule,
                                      resource,
                                      index,
                                    )
                                  }
                                >
                                  详情
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div
                          data-testid={`resource-empty-${selectedModule.module_id}`}
                        >
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={
                              selectedModule.resource_status === 'failed'
                                ? selectedModule.resource_error_message ||
                                  '暂未生成可用学习资源'
                                : '暂未生成可用学习资源'
                            }
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="暂无学习资源"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <Drawer
          title="周检查 / 月检查"
          placement="right"
          width={520}
          open={reviewDrawerOpen}
          onClose={() => setReviewDrawerOpen(false)}
          destroyOnClose={false}
        >
          <Tabs
            activeKey={activeReviewTab}
            onChange={(key) => setActiveReviewTab(key as 'weekly' | 'monthly')}
            items={[
              {
                key: 'weekly',
                label: '周检查',
                children: renderReviewPane('weekly'),
              },
              {
                key: 'monthly',
                label: '月检查',
                children: renderReviewPane('monthly'),
              },
            ]}
          />
        </Drawer>
        {renderResourceDetailDrawer()}
      </div>
    </PageContainer>
  );
};

export default LearningPathPage;
