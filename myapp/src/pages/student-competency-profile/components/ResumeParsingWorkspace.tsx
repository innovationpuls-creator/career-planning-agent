import {
  CloudUploadOutlined,
  EditOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  Button,
  Card,
  Col,
  Row,
  Segmented,
  Skeleton,
  Space,
  Tabs,
  Typography,
  Upload,
  type UploadProps,
} from 'antd';
import { createStyles } from 'antd-style';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import LatestAnalysisSection from '../LatestAnalysisSection';
import { buildUploadButtonProps } from '../shared';
import type {
  JobProfileDimensions,
  ProfileKey,
  ResultTabKey,
  RuntimeField,
  WorkspaceConversation,
  WorkspaceStage,
  WorkspaceUpload,
  WorkspaceViewState,
} from '../shared';
import ProcessTimelinePanel from './ProcessTimelinePanel';
import ResumeComposer from './ResumeComposer';
import ResumeResultEditor from './ResumeResultEditor';

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    :global(.ant-pro-page-container-children-container) {
      padding-block: 0;
      padding-inline: 0;
    }
  `,
  shell: css`
    width: 100%;
    padding: 8px 10px 18px;
    background: ${token.colorBgBase};
  `,
  frame: css`
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: calc(100vh - 26px);
    overflow: hidden;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: ${token.colorBgContainer};
    box-shadow: 0 8px 28px rgba(15, 35, 70, 0.04);
  `,
  frameEmpty: css`
    background:
      radial-gradient(circle at 50% 40%, rgba(22, 119, 255, 0.08), transparent 34%),
      linear-gradient(180deg, #fbfdff 0%, #f6faff 56%, #ffffff 100%);
  `,
  topBar: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 62px;
    padding: 0 22px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
  `,
  workspaceContainer: css`
    position: relative;
    min-height: 600px;
    transition: opacity 0.25s ease, transform 0.25s ease;
    padding: 0 22px 24px;
  `,
  emptyStage: css`
    min-height: calc(100vh - 96px);
    padding: 0;
  `,
  emptyCanvas: css`
    position: relative;
    display: grid;
    place-items: center;
    min-height: calc(100vh - 98px);
    overflow: hidden;
    padding: 48px 24px 72px;

    &::before {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(22, 119, 255, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(22, 119, 255, 0.035) 1px, transparent 1px);
      background-size: 44px 44px;
      mask-image: radial-gradient(circle at center, black 0%, transparent 70%);
      opacity: 0.38;
      content: '';
    }

    &::after {
      position: absolute;
      top: 13%;
      right: 12%;
      width: 360px;
      height: 360px;
      border: 1px solid rgba(22, 119, 255, 0.12);
      border-radius: 50%;
      box-shadow: inset 0 0 72px rgba(22, 119, 255, 0.045);
      opacity: 0.72;
      content: '';
    }
  `,
  emptyArc: css`
    position: absolute;
    bottom: 10%;
    left: 12%;
    width: 420px;
    height: 220px;
    border: 1px solid rgba(22, 119, 255, 0.1);
    border-right: 0;
    border-bottom: 0;
    border-radius: 999px 0 0 0;
    opacity: 0.7;
    pointer-events: none;
  `,
  emptyUploadCard: css`
    position: relative;
    z-index: 1;
    width: min(520px, 100%);
    border: 1px solid rgba(145, 183, 232, 0.55);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow:
      0 32px 80px rgba(21, 62, 118, 0.12),
      0 1px 0 rgba(255, 255, 255, 0.82) inset;
    backdrop-filter: blur(14px);
    transition:
      transform 360ms cubic-bezier(0.22, 1, 0.36, 1),
      border-color 220ms ease,
      box-shadow 220ms ease;

    :global(.ant-upload) {
      display: block;
      padding: 44px 44px 34px !important;
      border: 0 !important;
      background: transparent !important;
    }

    &:hover {
      border-color: rgba(22, 119, 255, 0.42);
      box-shadow:
        0 38px 94px rgba(21, 62, 118, 0.16),
        0 1px 0 rgba(255, 255, 255, 0.86) inset;
      transform: translateY(-2px);
    }
  `,
  emptyUploadIcon: css`
    position: relative;
    display: inline-grid;
    place-items: center;
    width: 74px;
    height: 86px;
    margin-bottom: 22px;
    border: 1px solid rgba(22, 119, 255, 0.15);
    border-radius: 18px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(237, 247, 255, 0.92)),
      ${token.colorBgContainer};
    color: ${token.colorPrimary};
    font-size: 30px;
    box-shadow: 0 18px 42px rgba(22, 119, 255, 0.12);

    &::before {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 14px;
      height: 14px;
      border-top: 2px solid rgba(22, 119, 255, 0.32);
      border-right: 2px solid rgba(22, 119, 255, 0.32);
      border-radius: 2px;
      content: '';
    }
  `,
  emptyUploadTitle: css`
    margin: 0 0 10px !important;
    color: ${token.colorText};
    font-size: 24px !important;
    font-weight: 700 !important;
    line-height: 1.25 !important;
    font-family: var(--font-heading);
    letter-spacing: 0;
  `,
  emptyUploadDescription: css`
    display: block;
    max-width: 360px;
    margin: 0 auto 24px;
    color: ${token.colorTextSecondary};
    font-size: 14px;
    line-height: 1.8;
  `,
  emptyUploadButton: css`
    min-width: 156px;
    height: 42px;
    border-radius: 10px;
    font-weight: 600;
    box-shadow: 0 12px 26px rgba(22, 119, 255, 0.22);
  `,
  emptyUploadMeta: css`
    display: flex;
    justify-content: center;
    gap: 14px;
    margin-top: 20px;
    flex-wrap: wrap;
    color: ${token.colorTextTertiary};
    font-size: 12px;
  `,
  emptyMetaItem: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
  `,
  workspaceScaffold: css`
    position: relative;
    transition:
      opacity 520ms cubic-bezier(0.22, 1, 0.36, 1),
      transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
  `,
  workspaceScaffoldSoft: css`
    opacity: 0.34;
    transform: translateY(18px) scale(0.985);
  `,
  workspaceScaffoldReady: css`
    opacity: 1;
    transform: translateY(0) scale(1);
  `,
  workspaceItem: css`
    animation: resumeWorkspaceItemIn 460ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--resume-stagger, 0ms);

    @keyframes resumeWorkspaceItemIn {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  transformOverlay: css`
    position: fixed;
    inset: 0;
    z-index: 1000;
    pointer-events: none;
  `,
  cloneCard: css`
    position: fixed;
    top: var(--flip-top, 0px);
    left: var(--flip-left, 0px);
    width: var(--flip-width, 420px);
    height: var(--flip-height, 280px);
    display: grid;
    place-items: center;
    border: 1px solid rgba(145, 183, 232, 0.55);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 28px 70px rgba(21, 62, 118, 0.15);
    overflow: hidden;
    transform-origin: top left;

    @keyframes resumeUploadCloneFly {
      0% {
        opacity: 1;
        transform: translate3d(0, 0, 0) scale(1);
      }
      18% {
        transform: translate3d(0, -4px, 0) scale(1.02);
      }
      100% {
        opacity: 0.08;
        transform: translate3d(var(--flip-x, 0px), var(--flip-y, 0px), 0)
          scale(var(--flip-scale-x, 0.72), var(--flip-scale-y, 0.72));
      }
    }
  `,
  cloneCardUploading: css`
    opacity: 1;
    transform: translate3d(0, -4px, 0) scale(1.02);
    transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
  `,
  cloneCardTransforming: css`
    animation: resumeUploadCloneFly 780ms cubic-bezier(0.22, 1, 0.36, 1) both;
  `,
  cloneCardInner: css`
    display: grid;
    place-items: center;
    gap: 12px;
    padding: 26px;
    text-align: center;
  `,
  cloneIcon: css`
    display: inline-grid;
    place-items: center;
    width: 56px;
    height: 64px;
    border-radius: 14px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-size: 24px;
  `,
  floatingFileCard: css`
    position: fixed;
    top: calc(var(--flip-top, 0px) + var(--flip-height, 280px) * 0.5 - 36px);
    left: calc(var(--flip-left, 0px) + var(--flip-width, 420px) * 0.5 - 112px);
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    width: 224px;
    min-height: 72px;
    padding: 12px;
    border: 1px solid rgba(22, 119, 255, 0.16);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 24px 54px rgba(21, 62, 118, 0.16);

    @keyframes resumeFileCardFly {
      0% {
        opacity: 1;
        transform: translate3d(0, 0, 0) scale(1);
      }
      100% {
        opacity: 0.2;
        transform: translate3d(
            calc(var(--flip-x, 0px) * 0.94),
            calc(var(--flip-y, 0px) * 0.92),
            0
          )
          scale(0.86);
      }
    }

    @keyframes resumeFileCardAppear {
      0% {
        opacity: 0;
        transform: translate3d(0, 14px, 0) scale(0.9);
      }
      100% {
        opacity: 1;
        transform: translate3d(0, 0, 0) scale(1);
      }
    }
  `,
  floatingFileCardUploading: css`
    animation: resumeFileCardAppear 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
  `,
  floatingFileCardTransforming: css`
    animation: resumeFileCardFly 780ms cubic-bezier(0.22, 1, 0.36, 1) both;
  `,
  floatingFileIcon: css`
    display: inline-grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 11px;
    background: ${token.colorSuccessBg};
    color: ${token.colorSuccess};
    font-size: 18px;
  `,
  fileName: css`
    display: block;
    max-width: 150px;
    overflow: hidden;
    color: ${token.colorText};
    font-size: 13px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  fileMeta: css`
    color: ${token.colorTextTertiary};
    font-size: 12px;
  `,
  preflightCard: css`
    min-height: 420px;
    padding: 24px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background:
      linear-gradient(180deg, rgba(247, 251, 255, 0.92), rgba(255, 255, 255, 0.98)),
      ${token.colorBgContainer};
  `,
  preflightHead: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
  `,
  preflightTitle: css`
    margin: 0 0 6px !important;
    font-size: 18px !important;
    font-weight: 700 !important;
    font-family: var(--font-heading);
  `,
  preflightBody: css`
    display: grid;
    gap: 18px;
  `,
  skeletonBlock: css`
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    padding: 18px;
    background: ${token.colorBgContainer};
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
  workspaceLeaving: css`
    opacity: 0;
    transform: translateY(6px);
  `,
  workspaceEntering: css`
    opacity: 1;
    transform: translateY(0);
  `,
  moduleSwitch: css`
    width: fit-content;
    background: transparent;

    :global(.ant-segmented-group) {
      gap: 24px;
    }

    :global(.ant-segmented-thumb) {
      display: none !important;
    }

    :global(.ant-segmented-item) {
      position: relative;
      min-width: 68px;
      border-radius: 0;
      color: ${token.colorTextSecondary};
      font-weight: 500;
    }

    :global(.ant-segmented-item-label) {
      min-height: 38px;
      padding: 6px 14px;
      border-radius: 6px;
      line-height: 1;
      transition: all 0.2s ease;
    }

    :global(.ant-segmented-item:hover) {
      color: ${token.colorPrimary};
    }

    :global(.ant-segmented-item-selected) {
      background: transparent !important;
      box-shadow: none !important;
      color: ${token.colorPrimary};
      font-weight: 600;
    }

    :global(.ant-segmented-item-selected)::after {
      display: none;
    }
  `,
  activeTabBadge: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    border-radius: 6px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-weight: 600;
    font-size: 14px;
    border: 1.5px solid ${token.colorPrimary};
    box-shadow: 0 0 0 3px ${token.colorPrimaryBg}, 0 2px 8px rgba(22, 85, 204, 0.18);
    transition: all 0.2s ease;
    white-space: nowrap;
  `,
  inactiveTabLabel: css`
    display: inline-flex;
    align-items: center;
    padding: 5px 12px;
    border-radius: 6px;
    white-space: nowrap;
    color: ${token.colorTextSecondary};
    font-weight: 500;
    font-size: 14px;
    transition: color 0.2s ease;

    :global(.ant-segmented-item:hover) & {
      color: ${token.colorPrimary};
    }
  `,
  pageHead: css`
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 110px;
    padding: 22px 26px 18px;
    overflow: hidden;

    &::before {
      position: absolute;
      top: 14px;
      right: -32px;
      width: 390px;
      height: 170px;
      border-radius: 999px 0 0 999px;
      background: linear-gradient(135deg, ${token.colorPrimaryBg}, transparent 72%);
      opacity: 0.72;
      content: '';
    }

    &::after {
      position: absolute;
      right: 54px;
      bottom: -72px;
      width: 300px;
      height: 180px;
      border: 1px solid ${token.colorPrimaryBorder};
      border-radius: 50%;
      opacity: 0.34;
      content: '';
    }
  `,
  title: css`
    position: relative;
    z-index: 1;
    margin: 0;
    padding-left: 18px;
    color: ${token.colorText};
    font-size: 28px !important;
    font-weight: 700 !important;
    line-height: 1.2 !important;
    font-family: var(--font-heading);
    letter-spacing: 0.04em;

    &::before {
      position: absolute;
      top: 6px;
      bottom: 5px;
      left: 0;
      width: 4px;
      border-radius: 999px;
      background: ${token.colorPrimary};
      content: '';
    }
  `,
  subtitle: css`
    position: relative;
    z-index: 1;
    margin-left: 18px;
    color: ${token.colorTextSecondary};
    font-size: 14px;
  `,
  workspaceRow: css`
    align-items: stretch;
    width: 100%;
    flex-wrap: nowrap;

    @media (max-width: 1200px) {
      flex-wrap: wrap;
    }
  `,
  leftRail: css`
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
  `,
  leftSummary: css`
    flex: 0 0 auto;
  `,
  leftPrimary: css`
    flex: 0 0 auto;
  `,
  leftSecondary: css`
    flex: 0 0 auto;
  `,
  rightCard: css`
    width: 100%;
    min-width: 0;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    transition: box-shadow 0.2s ease;
    box-shadow: 0 8px 22px rgba(15, 35, 70, 0.045);

    :global(.ant-card-body) {
      display: flex;
      flex-direction: column;
      gap: 0;
      padding: 16px 24px 22px;
    }
  `,
  tabs: css`
    width: 100%;
    min-width: 0;
    flex-shrink: 0;
    transition: all 0.2s ease;

    :global(.ant-tabs-nav) {
      margin-bottom: 0;
      border-bottom: 1px solid ${token.colorBorderSecondary};
      min-height: 44px;
    }

    :global(.ant-tabs-tab) {
      padding: 0 0 12px;
      font-size: 15px;
      font-weight: 500;
    }

    :global(.ant-tabs-extra-content) {
      padding-bottom: 10px;
    }

    :global(.ant-tabs-tab) {
      transition: all 0.2s ease;
    }

    :global(.ant-tabs-tab:hover) {
      color: ${token.colorPrimary};
    }

    :global(.ant-tabs-tab-active) {
      color: ${token.colorPrimary};
    }
  `,
  tabPane: css`
    padding-top: 18px;
    padding-bottom: 4px;
    animation: fadeIn 0.2s ease;

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  actionButton: css`
    border-radius: 8px;
    border-color: ${token.colorPrimaryBorder};
    color: ${token.colorPrimary};
    transition: all 0.2s ease;

    :hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(22, 85, 204, 0.14);
    }

    :active {
      transform: translateY(0);
    }
  `,
  primaryActionButton: css`
    border-radius: 8px;
    transition: all 0.2s ease;

    :hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(22, 119, 255, 0.3);
    }

    :active {
      transform: translateY(0);
      box-shadow: none;
    }
  `,
  topActionButton: css`
    min-width: 124px;
    height: 38px;
    border-radius: 8px;
    border-color: ${token.colorPrimaryBorder};
    color: ${token.colorPrimary};
    font-weight: 500;
  `,
  topActionButtonHidden: css`
    visibility: hidden;
  `,
}));

const formatFileSize = (size?: number) => {
  if (!size) return '--';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

type ModuleKey = 'resume' | 'career';
type InteractionStage = 'empty' | 'uploading' | 'transforming' | 'workspace';

type Props = {
  activeModule: ModuleKey;
  onModuleChange: (value: ModuleKey) => void;
  careerWorkspace?: React.ReactNode;
  interactionStage: InteractionStage;
  stage: WorkspaceStage;
  viewState: WorkspaceViewState;
  conversation: WorkspaceConversation;
  runtimeFields: RuntimeField[];
  currentProfile: JobProfileDimensions;
  editorProfile: JobProfileDimensions;
  tagInputs: Partial<Record<ProfileKey, string>>;
  composerValue: string;
  composerUploads: WorkspaceUpload[];
  composerError?: string;
  submitDisabledReason?: string;
  canSubmit: boolean;
  isSubmitting: boolean;
  fileUploadEnabled: boolean;
  analysis?: API.StudentCompetencyLatestAnalysisPayload;
  analysisLoading?: boolean;
  activeResultTab: ResultTabKey;
  activeGapKey?: string;
  messagesViewportRef: React.RefObject<HTMLDivElement | null>;
  onComposerValueChange: (value: string) => void;
  onRemoveUpload: (uploadId: string) => void;
  onBeforeUpload: NonNullable<UploadProps['beforeUpload']>;
  onSubmit: () => void;
  onTagInputChange: (key: ProfileKey, value: string) => void;
  onAddTag: (key: ProfileKey) => void;
  onRemoveTag: (key: ProfileKey, value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onResetConversation: () => void;
  onResultTabChange: (key: ResultTabKey) => void;
  onActiveGapChange: (key: string) => void;
};

const ResumeParsingWorkspace: React.FC<Props> = ({
  activeModule,
  onModuleChange,
  careerWorkspace,
  interactionStage,
  stage,
  viewState,
  conversation,
  runtimeFields,
  currentProfile,
  editorProfile,
  tagInputs,
  composerValue,
  composerUploads,
  composerError,
  submitDisabledReason,
  canSubmit,
  isSubmitting,
  fileUploadEnabled,
  analysis,
  analysisLoading,
  activeResultTab,
  activeGapKey,
  messagesViewportRef,
  onComposerValueChange,
  onRemoveUpload,
  onBeforeUpload,
  onSubmit,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  onEdit,
  onSave,
  onCancelEdit,
  onResetConversation,
  onResultTabChange,
  onActiveGapChange,
}) => {
  const { styles, cx } = useStyles();
  const editing = stage === 'edit';
  const workspaceActive =
    activeModule === 'resume' &&
    (viewState !== 'empty' || interactionStage !== 'empty');
  const showEmptyCanvas =
    activeModule === 'resume' &&
    viewState === 'empty' &&
    interactionStage === 'empty';
  const processExpanded = workspaceActive;
  const latestUpload = useMemo(() => {
    if (composerUploads.length) return composerUploads[0];
    const uploads = [...conversation.messages]
      .reverse()
      .flatMap((message) => message.uploads || []);
    return uploads[0];
  }, [composerUploads, conversation.messages]);
  const panelViewState: WorkspaceViewState =
    workspaceActive && viewState === 'empty' ? 'parsing' : viewState;
  const uploadProps = buildUploadButtonProps(
    onBeforeUpload,
    isSubmitting || !fileUploadEnabled,
  );
  const [moduleTransition, setModuleTransition] = useState<
    'idle' | 'leaving' | 'entering'
  >('idle');
  const [displayedModule, setDisplayedModule] = useState(activeModule);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heroCardRef = useRef<HTMLDivElement | null>(null);
  const targetCardRef = useRef<HTMLDivElement | null>(null);
  const heroRectRef = useRef<DOMRect | null>(null);
  const frameRef = useRef<number | null>(null);
  const [flipStyle, setFlipStyle] = useState<React.CSSProperties>();

  const rememberHeroRect = useCallback(() => {
    if (!heroCardRef.current) return;
    heroRectRef.current = heroCardRef.current.getBoundingClientRect();
  }, []);

  const calculateFlip = useCallback(() => {
    const from = heroRectRef.current;
    const to = targetCardRef.current?.getBoundingClientRect();
    if (!from || !to) return;

    const scaleX = Math.max(0.42, Math.min(0.82, to.width / from.width));
    const scaleY = Math.max(0.28, Math.min(0.62, to.height / from.height));
    setFlipStyle({
      '--flip-top': `${from.top}px`,
      '--flip-left': `${from.left}px`,
      '--flip-width': `${from.width}px`,
      '--flip-height': `${from.height}px`,
      '--flip-x': `${to.left - from.left}px`,
      '--flip-y': `${to.top - from.top}px`,
      '--flip-scale-x': `${scaleX}`,
      '--flip-scale-y': `${scaleY}`,
    } as React.CSSProperties);
  }, []);

  useEffect(() => {
    return () => {
      if (transitionRef.current) clearTimeout(transitionRef.current);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (showEmptyCanvas) {
      frameRef.current = requestAnimationFrame(rememberHeroRect);
      return;
    }

    if (interactionStage === 'uploading' || interactionStage === 'transforming') {
      frameRef.current = requestAnimationFrame(calculateFlip);
    }
  }, [calculateFlip, interactionStage, rememberHeroRect, showEmptyCanvas]);

  const handleModuleChange = useCallback(
    (newModule: ModuleKey) => {
      if (newModule === activeModule || moduleTransition !== 'idle') return;

      setModuleTransition('leaving');

      transitionRef.current = setTimeout(() => {
        setDisplayedModule(newModule);
        onModuleChange(newModule);
        setModuleTransition('entering');

        transitionRef.current = setTimeout(() => {
          setModuleTransition('idle');
        }, 250);
      }, 250);
    },
    [activeModule, moduleTransition, onModuleChange],
  );

  useEffect(() => {
    if (activeModule !== displayedModule && moduleTransition === 'idle') {
      setDisplayedModule(activeModule);
    }
  }, [activeModule]);
  const resultActions = editing ? (
    <Space>
      <Button
        data-testid="cancel-edit-button"
        className={styles.actionButton}
        onClick={onCancelEdit}
      >
        取消编辑
      </Button>
      <Button
        data-testid="save-result-button"
        type="primary"
        icon={<SaveOutlined />}
        className={styles.primaryActionButton}
        onClick={onSave}
      >
        保存结果
      </Button>
    </Space>
  ) : (
    <Button
      data-testid="edit-result-button"
      icon={<EditOutlined />}
      className={styles.actionButton}
      onClick={onEdit}
    >
      编辑结果
    </Button>
  );

  const leftPrimary = processExpanded ? (
    <ProcessTimelinePanel
      stage={stage}
      viewState={panelViewState}
      expanded
      conversation={conversation}
      composerUploads={composerUploads}
      messagesViewportRef={messagesViewportRef}
    />
  ) : (
    <ResumeComposer
      viewState={panelViewState}
      expanded
      value={composerValue}
      uploads={composerUploads}
      error={composerError}
      disabled={isSubmitting}
      submitDisabledReason={submitDisabledReason}
      canSubmit={canSubmit}
      submitLabel={stage === 'empty' ? '开始解析' : '继续补充解析'}
      fileUploadEnabled={fileUploadEnabled}
      onValueChange={onComposerValueChange}
      onRemoveUpload={onRemoveUpload}
      onSubmit={onSubmit}
      onBeforeUpload={onBeforeUpload}
    />
  );

  const leftSecondary = processExpanded ? (
    <ResumeComposer
      viewState={panelViewState}
      value={composerValue}
      expanded={false}
      uploads={composerUploads}
      error={composerError}
      disabled={isSubmitting}
      submitDisabledReason={submitDisabledReason}
      canSubmit={canSubmit}
      submitLabel={stage === 'empty' ? '开始解析' : '继续补充解析'}
      fileUploadEnabled={fileUploadEnabled}
      onValueChange={onComposerValueChange}
      onRemoveUpload={onRemoveUpload}
      onSubmit={onSubmit}
      onBeforeUpload={onBeforeUpload}
    />
  ) : (
    <ProcessTimelinePanel
      stage={stage}
      viewState={panelViewState}
      expanded={false}
      conversation={conversation}
      composerUploads={composerUploads}
      messagesViewportRef={messagesViewportRef}
    />
  );

  const tabItems = useMemo(
    () => [
      {
        key: 'comparison',
        label: <span data-testid="comparison-tab-trigger">简历评分</span>,
        children: (
          <div className={styles.tabPane}>
            <LatestAnalysisSection
              analysis={analysis}
              loading={analysisLoading}
              mode="comparison"
              activeGapKey={activeGapKey}
              onOpenAdvice={(key) => {
                if (key) onActiveGapChange(key);
                onResultTabChange('advice');
              }}
              onActiveGapChange={onActiveGapChange}
            />
          </div>
        ),
      },
      {
        key: 'advice',
        label: <span data-testid="advice-tab-trigger">提升建议</span>,
        children: (
          <div className={styles.tabPane}>
            <LatestAnalysisSection
              analysis={analysis}
              loading={analysisLoading}
              mode="advice"
              activeGapKey={activeGapKey}
              onOpenAdvice={() => undefined}
              onActiveGapChange={onActiveGapChange}
            />
          </div>
        ),
      },
      {
        key: 'result',
        label: <span data-testid="result-tab-trigger">关键字提取</span>,
        children: (
          <div className={styles.tabPane}>
            <ResumeResultEditor
              mode={editing ? 'edit' : 'view'}
              runtimeFields={runtimeFields}
              currentProfile={currentProfile}
              editorProfile={editorProfile}
              tagInputs={tagInputs}
              onTagInputChange={onTagInputChange}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
            />
          </div>
        ),
      },
    ],
    [
      styles.tabPane,
      editing,
      runtimeFields,
      currentProfile,
      editorProfile,
      tagInputs,
      onTagInputChange,
      onAddTag,
      onRemoveTag,
      analysis,
      analysisLoading,
      activeGapKey,
      onActiveGapChange,
      onResultTabChange,
    ],
  );

  const workspaceShell = (
    <Card className={styles.rightCard}>
      <div className={styles.preflightCard}>
        <div className={styles.preflightHead}>
          <div>
            <Typography.Title level={4} className={styles.preflightTitle}>
              {viewState === 'parsing' ? '正在解析简历' : '解析工作区已准备'}
            </Typography.Title>
            <Typography.Text type="secondary">
              {viewState === 'parsing'
                ? 'AI 正在提取关键信息，完成后将展示评分、建议与关键词。'
                : '文件已进入当前解析对象，补充描述后即可开始解析。'}
            </Typography.Text>
          </div>
          {latestUpload ? (
            <Typography.Text type="secondary">
              {formatFileSize(latestUpload.size)}
            </Typography.Text>
          ) : null}
        </div>
        <div className={styles.preflightBody}>
          <div className={styles.skeletonBlock}>
            <Skeleton active paragraph={{ rows: 2 }} title={{ width: '32%' }} />
          </div>
          <Row gutter={[18, 18]}>
            <Col xs={24} lg={12}>
              <div className={styles.skeletonBlock}>
                <Skeleton
                  active
                  paragraph={{ rows: 6 }}
                  title={{ width: '42%' }}
                />
              </div>
            </Col>
            <Col xs={24} lg={12}>
              <div className={styles.skeletonBlock}>
                <Skeleton
                  active
                  paragraph={{ rows: 6 }}
                  title={{ width: '48%' }}
                />
              </div>
            </Col>
          </Row>
        </div>
      </div>
    </Card>
  );

  const resultWorkspace = (
    <Card className={styles.rightCard}>
      <Tabs
        className={styles.tabs}
        activeKey={activeResultTab}
        onChange={(key) => onResultTabChange(key as ResultTabKey)}
        animated={{ inkBar: true, tabPane: true }}
        tabBarExtraContent={resultActions}
        items={tabItems}
      />
    </Card>
  );

  const renderRightWorkspace = () =>
    viewState === 'completed' || viewState === 'edit'
      ? resultWorkspace
      : workspaceShell;

  const shouldRenderOverlay =
    displayedModule === 'resume' &&
    !!flipStyle &&
    !!latestUpload &&
    (interactionStage === 'uploading' || interactionStage === 'transforming');

  const uploadCardContent = (
    <>
      <span className={styles.emptyUploadIcon}>
        <FileTextOutlined />
      </span>
      <Typography.Title level={3} className={styles.emptyUploadTitle}>
        上传简历，开始解析
      </Typography.Title>
      <Typography.Text className={styles.emptyUploadDescription}>
        AI 将自动提取关键信息，生成能力画像与优化建议
      </Typography.Text>
      <Button
        type="primary"
        size="large"
        icon={<CloudUploadOutlined />}
        className={styles.emptyUploadButton}
        disabled={isSubmitting || !fileUploadEnabled}
      >
        上传简历
      </Button>
      <div className={styles.emptyUploadMeta}>
        <span className={styles.emptyMetaItem}>
          <SafetyCertificateOutlined />
          支持 PDF / DOC / DOCX / TXT
        </span>
        <span className={styles.emptyMetaItem}>
          <LockOutlined />
          数据仅用于解析与分析
        </span>
      </div>
    </>
  );

  return (
    <PageContainer
      className={styles.container}
      title={false}
      breadcrumb={undefined}
    >
      <div
        className={cx(styles.shell, styles.motionSafe)}
        data-workspace-stage={stage}
      >
        <div
          className={cx(styles.frame, showEmptyCanvas ? styles.frameEmpty : '')}
        >
          <div className={styles.topBar}>
            <Segmented
              className={styles.moduleSwitch}
              value={activeModule}
              onChange={(value) => handleModuleChange(value as ModuleKey)}
              options={[
                {
                  label: (
                    <span
                      data-tab-indicator
                      className={
                        activeModule === 'resume'
                          ? styles.activeTabBadge
                          : styles.inactiveTabLabel
                      }
                    >
                      简历解析
                    </span>
                  ),
                  value: 'resume',
                },
                {
                  label: (
                    <span
                      data-tab-indicator
                      className={
                        activeModule === 'career'
                          ? styles.activeTabBadge
                          : styles.inactiveTabLabel
                      }
                    >
                      职业匹配
                    </span>
                  ),
                  value: 'career',
                },
              ]}
            />
            {activeModule === 'resume' ? (
              <Button
                data-testid="reset-conversation-button"
                icon={<ReloadOutlined />}
                className={styles.topActionButton}
                onClick={onResetConversation}
              >
                重置解析
              </Button>
            ) : (
              <span className={styles.topActionButtonHidden} />
            )}
          </div>

          {!showEmptyCanvas ? (
            <div className={styles.pageHead}>
              <Typography.Title
                level={2}
                className={styles.title}
                data-testid="resume-page-title"
              >
                {displayedModule === 'resume' ? '简历解析' : '职业匹配'}
              </Typography.Title>
              <Typography.Text className={styles.subtitle}>
                {displayedModule === 'resume'
                  ? '基于 AI 算法深度解析简历，定位优势与不足，提供针对性优化建议'
                  : '基于你的简历能力，智能推荐匹配职业并分析差距'}
              </Typography.Text>
            </div>
          ) : null}

          <div
            className={`${styles.workspaceContainer} ${
              showEmptyCanvas ? styles.emptyStage : ''
            } ${
              moduleTransition === 'leaving'
                ? styles.workspaceLeaving
                : moduleTransition === 'entering'
                  ? styles.workspaceEntering
                  : ''
            }`}
            data-workspace-container
          >
            {showEmptyCanvas ? (
              <div className={styles.emptyCanvas}>
                <span className={styles.emptyArc} />
                <div ref={heroCardRef} className={styles.emptyUploadCard}>
                  <Upload.Dragger {...uploadProps}>
                    {uploadCardContent}
                  </Upload.Dragger>
                </div>
              </div>
            ) : displayedModule === 'career' ? (
              careerWorkspace
            ) : (
              <Row
                gutter={[20, 20]}
                className={cx(
                  styles.workspaceRow,
                  styles.workspaceScaffold,
                  interactionStage === 'uploading' ||
                    interactionStage === 'transforming'
                    ? styles.workspaceScaffoldSoft
                    : styles.workspaceScaffoldReady,
                )}
                wrap={false}
                data-interaction-stage={interactionStage}
              >
                <Col
                  xs={24}
                  xl={undefined}
                  flex="312px"
                  style={{ width: '312px', maxWidth: '312px' }}
                >
                  <div className={styles.leftRail}>
                    <div
                      ref={targetCardRef}
                      className={cx(styles.leftSummary, styles.workspaceItem)}
                      style={
                        {
                          '--resume-stagger': '0ms',
                        } as React.CSSProperties
                      }
                    >
                      <ProcessTimelinePanel
                        stage={stage}
                        viewState={panelViewState}
                        expanded={false}
                        conversation={conversation}
                        composerUploads={composerUploads}
                        messagesViewportRef={messagesViewportRef}
                        summaryOnly
                      />
                    </div>
                    <div
                      className={cx(styles.leftPrimary, styles.workspaceItem)}
                      style={
                        {
                          '--resume-stagger': '70ms',
                        } as React.CSSProperties
                      }
                    >
                      {leftPrimary}
                    </div>
                    <div
                      className={cx(styles.leftSecondary, styles.workspaceItem)}
                      style={
                        {
                          '--resume-stagger': '140ms',
                        } as React.CSSProperties
                      }
                    >
                      {leftSecondary}
                    </div>
                  </div>
                </Col>

                <Col
                  xs={24}
                  xl={undefined}
                  flex="auto"
                  style={{
                    minWidth: 0,
                    width: 'auto',
                    maxWidth: 'none',
                    flexBasis: 0,
                  }}
                >
                  <div
                    className={styles.workspaceItem}
                    style={
                      {
                        '--resume-stagger': '220ms',
                      } as React.CSSProperties
                    }
                  >
                    {renderRightWorkspace()}
                  </div>
                </Col>
              </Row>
            )}
          </div>
          {shouldRenderOverlay ? (
            <div className={styles.transformOverlay} style={flipStyle}>
              <div
                className={cx(
                  styles.cloneCard,
                  interactionStage === 'transforming'
                    ? styles.cloneCardTransforming
                    : styles.cloneCardUploading,
                )}
              >
                <div className={styles.cloneCardInner}>
                  <span className={styles.cloneIcon}>
                    <FileTextOutlined />
                  </span>
                  <Typography.Text strong>上传简历，开始解析</Typography.Text>
                </div>
              </div>
              <div
                className={cx(
                  styles.floatingFileCard,
                  interactionStage === 'transforming'
                    ? styles.floatingFileCardTransforming
                    : styles.floatingFileCardUploading,
                )}
              >
                <span className={styles.floatingFileIcon}>
                  <FileDoneOutlined />
                </span>
                <div>
                  <Typography.Text className={styles.fileName}>
                    {latestUpload.name}
                  </Typography.Text>
                  <Typography.Text className={styles.fileMeta}>
                    {formatFileSize(latestUpload.size)} · 已准备
                  </Typography.Text>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </PageContainer>
  );
};

export default ResumeParsingWorkspace;
