import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  FileSearchOutlined,
  FlagOutlined,
  LinkOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  SaveOutlined,
  SwapOutlined,
  ArrowRightOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Empty,
  Grid,
  Input,
  Modal,
  Progress,
  Space,
  Statistic,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  createCareerDevelopmentGoalPlanTask,
  deleteCareerDevelopmentFavorite,
  createCareerDevelopmentPlanWorkspaceReview,
  exportCareerDevelopmentPlanWorkspace,
  getCareerDevelopmentFavorites,
  getCareerDevelopmentGoalPlanTask,
  getCareerDevelopmentPlanWorkspace,
  integrityCheckCareerDevelopmentPlanWorkspace,
  polishCareerDevelopmentPlanWorkspace,
  submitCareerDevelopmentPlanMilestone,
  streamCareerDevelopmentGoalPlanTask,
  updateCareerDevelopmentPlanWorkspace,
} from '@/services/ant-design-pro/api';
import {
  buildGoalGraphPaths,
  formatGoalPlanDate,
  formatGoalPlanDateTime,
  useCareerGoalPlanningData,
} from '../shared/useCareerGoalPlanningData';

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;

const DRAFT_PREFIX = 'feature_map_career_goal_workspace_draft_';

const PRACTICE_TYPE_LABELS: Record<API.GrowthPlanPracticeAction['action_type'], string> = {
  project: '项目',
  internship: '实习',
  competition: '竞赛',
  open_source: '开源',
  certificate: '证书',
  job_search_action: '求职动作',
};

const PRIORITY_LABELS: Record<'high' | 'medium' | 'low', string> = {
  high: '高优先级',
  medium: '中优先级',
  low: '低优先级',
};

const MILESTONE_STATUS_OPTIONS: Array<{
  label: string;
  value: API.GrowthPlanMilestone['status'];
}> = [
  { label: '待开始', value: 'pending' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
  { label: '已阻塞', value: 'blocked' },
];

const REVIEW_CHANGE_GROUPS = [
  { key: 'keep_items', title: '保留项', color: 'processing' as const },
  { key: 'deprioritized_items', title: '下调项', color: 'warning' as const },
  { key: 'new_items', title: '新增项', color: 'success' as const },
] as const;

const useStyles = createStyles(({ css, token }) => ({
  page: css`
    :global(.ant-pro-page-container-children-container) {
      padding: 0;
    }
    min-height: calc(100vh - 112px);
    padding: 24px;
    background:
      radial-gradient(circle at top left, rgba(22, 119, 255, 0.08), transparent 28%),
      linear-gradient(180deg, #f7fbff 0%, #ffffff 42%, #f3f8ff 100%);
  `,
  hero: css`
    margin-bottom: 24px;
    padding: 28px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.94);
    border: 1px solid rgba(22, 119, 255, 0.12);
    box-shadow: 0 16px 42px rgba(31, 56, 88, 0.08);
  `,
  eyebrow: css`
    display: inline-flex;
    gap: 8px;
    margin-bottom: 14px;
    padding: 6px 12px;
    border-radius: 999px;
    color: ${token.colorPrimary};
    background: rgba(22, 119, 255, 0.08);
    font-weight: 600;
    font-size: 13px;
  `,
  layout: css`
    display: grid;
    gap: 20px;
    align-items: start;
  `,
  stack: css`
    display: grid;
    gap: 20px;
  `,
  compactFavoritesCard: css`
    :global(.ant-card-body) {
      padding-top: 16px;
      padding-bottom: 16px;
    }
  `,
  compactFavoritesBody: css`
    display: grid;
    gap: 14px;
  `,
  card: css`
    border-radius: 24px;
    box-shadow: 0 16px 36px rgba(31, 56, 88, 0.08);
    :global(.ant-card-body) {
      padding: 20px;
    }
  `,
  favoriteList: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  `,
  favorite: css`
    min-width: 0;
    padding: 16px;
    border-radius: 18px;
    background: #fff;
    border: 1px solid rgba(22, 119, 255, 0.08);
    cursor: pointer;
    transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
    &:hover {
      border-color: rgba(22, 119, 255, 0.28);
      transform: translateY(-1px);
    }
  `,
  favoriteActive: css`
    border-color: rgba(22, 119, 255, 0.42);
    background: linear-gradient(180deg, #f8fbff 0%, #fff 100%);
    box-shadow: 0 10px 20px rgba(22, 119, 255, 0.08);
  `,
  favoriteMetaRow: css`
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  `,
  currentFavoriteCard: css`
    padding: 16px 18px;
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(247, 251, 255, 0.96) 0%, #ffffff 100%);
    border: 1px solid rgba(22, 119, 255, 0.12);
  `,
  sourceCard: css`
    border-style: dashed;
    background: rgba(255, 255, 255, 0.88);
  `,
  heroActions: css`
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    flex-wrap: wrap;
  `,
  metrics: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    @media (max-width: 1100px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    @media (max-width: 640px) {
      grid-template-columns: 1fr;
    }
  `,
  metric: css`
    padding: 16px;
    border-radius: 18px;
    background: #fafcff;
    border: 1px solid rgba(22, 119, 255, 0.1);
  `,
  reviewGrid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    @media (max-width: 960px) {
      grid-template-columns: 1fr;
    }
  `,
  reviewCard: css`
    padding: 16px;
    border-radius: 18px;
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.06);
  `,
  phaseRail: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,
  phaseNode: css`
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(15, 23, 42, 0.08);
    background: #fff;
    cursor: pointer;
  `,
  phaseNodeActive: css`
    border-color: rgba(22, 119, 255, 0.48);
    background: linear-gradient(180deg, #f7fbff 0%, #ffffff 100%);
  `,
  collapse: css`
    :global(.ant-collapse) {
      background: transparent;
      border: none;
    }
  `,
  split: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    @media (max-width: 960px) {
      grid-template-columns: 1fr;
    }
  `,
  detailSection: css`
    padding: 16px;
    border-radius: 18px;
    background: #fafcff;
    border: 1px solid rgba(22, 119, 255, 0.08);
  `,
  actionGrid: css`
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.9fr);
    gap: 16px;
    @media (max-width: 1080px) {
      grid-template-columns: 1fr;
    }
  `,
  actionHeroCard: css`
    padding: 18px;
    border-radius: 20px;
    background: linear-gradient(180deg, #f6ffed 0%, #ffffff 100%);
    border: 1px solid rgba(82, 196, 26, 0.18);
  `,
  actionSidebarCard: css`
    padding: 18px;
    border-radius: 20px;
    background: #fafcff;
    border: 1px solid rgba(22, 119, 255, 0.1);
  `,
  stepListGrid: css`
    display: grid;
    gap: 12px;
  `,
  stepPill: css`
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid rgba(15, 23, 42, 0.08);
    background: rgba(255, 255, 255, 0.96);
    cursor: pointer;
  `,
  stepPillActive: css`
    border-color: rgba(22, 119, 255, 0.48);
    box-shadow: inset 0 0 0 1px rgba(22, 119, 255, 0.2);
    background: linear-gradient(180deg, #f7fbff 0%, #ffffff 100%);
  `,
  stepPanel: css`
    padding: 18px;
    border-radius: 20px;
    background: #fff;
    border: 1px solid rgba(22, 119, 255, 0.12);
  `,
  flowTrack: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    align-items: center;
    @media (max-width: 960px) {
      grid-template-columns: 1fr;
    }
  `,
  flowNode: css`
    position: relative;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(15, 23, 42, 0.08);
    background: #fff;
    cursor: pointer;
  `,
  flowNodeActive: css`
    border-color: rgba(22, 119, 255, 0.48);
    background: linear-gradient(180deg, #f7fbff 0%, #ffffff 100%);
    box-shadow: 0 12px 24px rgba(22, 119, 255, 0.08);
  `,
  flowSummaryCard: css`
    padding: 18px;
    border-radius: 18px;
    background: #fafcff;
    border: 1px solid rgba(22, 119, 255, 0.08);
  `,
  uploadHint: css`
    padding: 12px 14px;
    border-radius: 14px;
    background: #fafcff;
    border: 1px dashed rgba(22, 119, 255, 0.22);
  `,
  fileList: css`
    display: grid;
    gap: 8px;
  `,
  actionList: css`
    display: grid;
    gap: 10px;
  `,
  actionItem: css`
    padding: 12px 14px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid rgba(15, 23, 42, 0.06);
  `,
  milestoneCard: css`
    padding: 14px 16px;
    border-radius: 16px;
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.08);
    width: 100%;
  `,
  routeList: css`
    display: grid;
    gap: 10px;
    margin-top: 12px;
  `,
  routeCard: css`
    padding: 14px 16px;
    border-radius: 16px;
    background: #fff;
    border: 1px solid rgba(22, 119, 255, 0.08);
  `,
  phaseSummaryList: css`
    display: grid;
    gap: 6px;
  `,
  preview: css`
    min-height: 520px;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(22, 119, 255, 0.12);
    background: #fff;
    overflow: auto;
  `,
  editor: css`
    min-height: 520px !important;
    border-radius: 18px !important;
    resize: vertical;
  `,
  issueList: css`
    display: grid;
    gap: 12px;
  `,
  issueCard: css`
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid rgba(15, 23, 42, 0.08);
    background: #fff;
  `,
  auditWorkspace: css`
    display: grid;
    grid-template-columns: minmax(320px, 0.82fr) minmax(0, 1.35fr);
    gap: 16px;
    align-items: start;
    @media (max-width: 1100px) {
      grid-template-columns: 1fr;
    }
  `,
  auditSidebar: css`
    display: grid;
    gap: 16px;
    position: sticky;
    top: 12px;
    @media (max-width: 1100px) {
      position: static;
    }
  `,
  auditPanel: css`
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(22, 119, 255, 0.1);
    background: #fafcff;
  `,
  auditSummaryGrid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  `,
  auditSummaryCard: css`
    padding: 12px;
    border-radius: 14px;
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.06);
  `,
  statusStack: css`
    display: grid;
    gap: 8px;
  `,
  editorSurface: css`
    display: grid;
    gap: 16px;
  `,
  editorHeader: css`
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    flex-wrap: wrap;
  `,
  sectionCard: css`
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid rgba(15, 23, 42, 0.08);
    background: #fff;
  `,
  sectionIssueList: css`
    display: grid;
    gap: 8px;
    margin-top: 10px;
  `,
  metaList: css`
    display: grid;
    gap: 8px;
  `,
  toolbarBlock: css`
    display: grid;
    gap: 12px;
  `,
}));

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const draftKey = (workspaceId?: string) => `${DRAFT_PREFIX}${workspaceId || 'pending'}`;

const readDraft = (workspaceId?: string) =>
  canUseStorage() && workspaceId
    ? window.localStorage.getItem(draftKey(workspaceId)) || undefined
    : undefined;

const saveDraft = (workspaceId: string | undefined, markdown: string) => {
  if (canUseStorage() && workspaceId) {
    window.localStorage.setItem(draftKey(workspaceId), markdown);
  }
};

const clearDraft = (workspaceId?: string) => {
  if (canUseStorage() && workspaceId) {
    window.localStorage.removeItem(draftKey(workspaceId));
  }
};

const formatDate = (value?: string) => formatGoalPlanDate(value);

const formatDateTime = (value?: string) => formatGoalPlanDateTime(value);

const phasePercent = (phase?: API.GrowthPlanPhase) => {
  const total = phase?.milestone_summary?.total_count || 0;
  return total
    ? Math.round(((phase?.milestone_summary?.completed_count || 0) / total) * 100)
      : 0;
};

const getPhasePrimaryMilestone = (phase?: API.GrowthPlanPhase) =>
  phase?.milestones.find((item) => item.status !== 'completed') || phase?.milestones[0];

const buildResourceMeta = (
  module: API.GrowthPlanLearningModule,
  resource: API.GrowthPlanLearningResourceItem,
  index: number,
  phase: API.GrowthPlanPhase,
  milestone?: API.GrowthPlanMilestone,
) => {
  const expectedOutput =
    phase.deliverables[0]
      ? `完成后至少补充与「${phase.deliverables[0]}」相关的学习笔记、练习记录或阶段说明。`
      : `完成后补充与「${module.topic}」相关的学习笔记、练习仓库或阶段说明。`;
  return {
    stepLabel: `第 ${index + 1} 步`,
    whyFirst:
      index === 0
        ? `先用这条资料补齐「${module.topic}」的关键基础，直接支撑当前里程碑推进。`
        : `在完成前一步后，用这条资料补充案例、规范或实战表达，避免只停留在概念层。`,
    expectedOutput:
      milestone?.title
        ? `${expectedOutput} 当前优先目标是「${milestone.title}」。`
        : expectedOutput,
    actionLabel: resource.url ? `打开${`第 ${index + 1} 步资源`}` : '查看详情',
  };
};

const getPhaseSummaryItems = (phase: API.GrowthPlanPhase) => [
  {
    label: '关键学习点',
    value: phase.learning_modules[0]?.topic || '待补齐学习主题',
  },
  {
    label: '关键实践任务',
    value: phase.practice_actions[0]?.title || '待补齐实践任务',
  },
  {
    label: '阶段成果物',
    value: phase.deliverables[0] || '待补齐阶段成果物',
  },
];

const summarizePhaseDraft = (
  phase: API.GrowthPlanPhase,
): API.GrowthPlanMilestoneSummary => ({
  completed_count: phase.milestones.filter((item) => item.status === 'completed').length,
  total_count: phase.milestones.length,
  blocked_count: phase.milestones.filter((item) => item.status === 'blocked').length,
});

const downloadBlob = (blob: Blob, filename?: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'career-development-plan';
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

const issueColor = (severity: API.IntegrityIssue['severity']) => {
  if (severity === 'blocking') return 'error';
  if (severity === 'warning') return 'warning';
  return 'processing';
};

const issueLabel = (severity: API.IntegrityIssue['severity']) => {
  if (severity === 'blocking') return '阻塞项';
  if (severity === 'warning') return '警告项';
  return '建议项';
};

const SECTION_ORDER = [
  'target_overview',
  'short_term',
  'mid_term',
  'long_term',
  'learning',
  'practice',
  'milestones',
  'review',
  'metrics',
  'conclusion',
] as const;

const SECTION_META: Record<
  string,
  { label: string; heading: string; template: string }
> = {
  target_overview: {
    label: '目标概述',
    heading: '## 目标概述',
    template: ['## 目标概述', '- 目标岗位：', '- 参考方向：', '- 当前岗位匹配度：'].join('\n'),
  },
  short_term: {
    label: '短期计划',
    heading: '## 短期计划（0-3 个月）',
    template: ['## 短期计划（0-3 个月）', '### 阶段目标', '', '### 学习内容', '', '### 里程碑'].join('\n'),
  },
  mid_term: {
    label: '中期计划',
    heading: '## 中期计划（3-9 个月）',
    template: ['## 中期计划（3-9 个月）', '### 阶段目标', '', '### 学习内容', '', '### 里程碑'].join('\n'),
  },
  long_term: {
    label: '长期计划',
    heading: '## 长期计划（9-24 个月）',
    template: ['## 长期计划（9-24 个月）', '### 阶段目标', '', '### 学习内容', '', '### 里程碑'].join('\n'),
  },
  learning: {
    label: '学习内容',
    heading: '## 学习内容',
    template: ['## 学习内容', '- 当前阶段重点：', '- 推荐学习路线：', '- 学习输出：'].join('\n'),
  },
  practice: {
    label: '实践安排',
    heading: '## 实践安排',
    template: ['## 实践安排', '- 当前实践动作：', '- 本周推进：', '- 成果沉淀：'].join('\n'),
  },
  milestones: {
    label: '里程碑',
    heading: '## 里程碑',
    template: ['## 里程碑', '- 第 1 步：', '- 第 2 步：', '- 第 3 步：'].join('\n'),
  },
  review: {
    label: '评估周期',
    heading: '## 评估周期',
    template: ['## 评估周期', '- 周检：', '- 月评：', '- 调整原则：'].join('\n'),
  },
  metrics: {
    label: '指标',
    heading: '## 指标',
    template: ['## 指标', '- 学习完成率：', '- 实践完成率：', '- 证据沉淀数：', '- 就绪指数：'].join('\n'),
  },
  conclusion: {
    label: '结论',
    heading: '## 结论',
    template: ['## 结论', '- 当前阶段判断：', '- 下一步建议：'].join('\n'),
  },
};

type GroupedIntegrityIssue = {
  sectionKey: string;
  label: string;
  severity: API.IntegrityIssue['severity'];
  anchor?: string;
  issues: API.IntegrityIssue[];
};

const severityWeight: Record<API.IntegrityIssue['severity'], number> = {
  blocking: 3,
  warning: 2,
  suggestion: 1,
};

const parseTimestamp = (value?: string) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isIntegrityResultStale = (
  workspace?: API.PlanWorkspacePayload,
  dirty?: boolean,
) => {
  if (!workspace?.latest_integrity_check) return false;
  if (dirty) return true;
  return parseTimestamp(workspace.updated_at) > parseTimestamp(workspace.latest_integrity_check.checked_at);
};

const findHeadingIndex = (markdown: string, heading: string) => {
  if (!heading) return -1;
  return markdown.indexOf(heading);
};

const groupIntegrityIssues = (issues?: API.IntegrityIssue[]): GroupedIntegrityIssue[] => {
  const groups = new Map<string, GroupedIntegrityIssue>();
  (issues || []).forEach((issue) => {
    const key = issue.section_key || 'conclusion';
    const meta = SECTION_META[key] || {
      label: issue.section_key || '未分类章节',
      heading: issue.anchor || '',
      template: `## ${issue.section_key || '未分类章节'}`,
    };
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        sectionKey: key,
        label: meta.label,
        severity: issue.severity,
        anchor: issue.anchor || meta.heading,
        issues: [issue],
      });
      return;
    }
    existing.issues.push(issue);
    if (severityWeight[issue.severity] > severityWeight[existing.severity]) {
      existing.severity = issue.severity;
    }
    existing.anchor = existing.anchor || issue.anchor || meta.heading;
  });

  return Array.from(groups.values()).sort((left, right) => {
    const leftIndex = SECTION_ORDER.indexOf(left.sectionKey as (typeof SECTION_ORDER)[number]);
    const rightIndex = SECTION_ORDER.indexOf(right.sectionKey as (typeof SECTION_ORDER)[number]);
    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
  });
};

const stepStatusMeta = (
  status: API.GrowthPlanCurrentLearningStep['status'],
): { label: string; color: string } => {
  if (status === 'passed') return { label: '已达标', color: 'success' };
  if (status === 'needs_more_evidence') return { label: '需补充', color: 'warning' };
  if (status === 'submitted') return { label: '待评估', color: 'processing' };
  return { label: '未开始', color: 'default' };
};

const JobGoalSettingPathPlanningPage: React.FC = () => {
  const { styles, cx } = useStyles();
  const screens = Grid.useBreakpoint();
  const isDesktop = screens.lg ?? true;
  const [phaseDrafts, setPhaseDrafts] = useState<API.GrowthPlanPhase[]>([]);
  const [editorMarkdown, setEditorMarkdown] = useState('');
  const [workspaceDirty, setWorkspaceDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [reviewing, setReviewing] = useState<'weekly' | 'monthly'>();
  const [exporting, setExporting] = useState<'md' | 'docx' | 'pdf'>();
  const [polishingMode, setPolishingMode] = useState<
    'formal' | 'concise' | 'mentor_facing'
  >();
  const [polishPreview, setPolishPreview] = useState<API.PlanWorkspacePolishPayload>();
  const [activePhaseKey, setActivePhaseKey] = useState<string>();
  const [activeStepId, setActiveStepId] = useState<string>();
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFiles, setSubmissionFiles] = useState<any[]>([]);
  const [submittingMilestoneId, setSubmittingMilestoneId] = useState<string>();
  const [expandedRouteModules, setExpandedRouteModules] = useState<Record<string, boolean>>({});
  const editorRef = useRef<any>(null);
  const {
    favorites,
    favoritesLoading,
    pageError,
    activeFavorite,
    favoriteForView,
    selectedFavoriteId,
    setSelectedFavoriteId,
    taskSnapshot,
    workspace,
    setWorkspace,
    actionError,
    setActionError,
    deletingFavoriteId,
    loadFavorites,
    loadWorkspace,
    startAnalysis,
    removeFavorite,
  } = useCareerGoalPlanningData();
  const [, setFavorites] = useState<API.CareerDevelopmentFavoritePayload[]>([]);
  const [, setPageError] = useState<string>();
  const [, setFavoritesLoading] = useState(false);
  const [, setDeletingFavoriteId] = useState<number>();
  const [taskIdsByFavorite, setTaskIdsByFavorite] = useState<Record<string, string>>({});
  const [, setTaskSnapshot] = useState<API.CareerDevelopmentGoalPlanTaskPayload>();
  const abortRef = useRef<AbortController | null>(null);
  const hydrateWorkspace = (payload?: API.PlanWorkspacePayload) => {
    setWorkspace(payload);
  };
  const graphPaths = useMemo(() => buildGoalGraphPaths(favoriteForView), [favoriteForView]);
  const currentPhaseKey =
    workspace?.workspace_overview.current_phase_key || phaseDrafts[0]?.phase_key;
  const currentPhase = useMemo(
    () =>
      phaseDrafts.find((item) => item.phase_key === currentPhaseKey) || phaseDrafts[0],
    [currentPhaseKey, phaseDrafts],
  );
  const currentLearningSteps = workspace?.current_learning_steps || [];
  const selectedLearningStep =
    currentLearningSteps.find((item) => item.milestone_id === activeStepId) || currentLearningSteps[0];
  const selectedFlowPhase =
    workspace?.phase_flow_summary.find((item) => item.phase_key === activePhaseKey) ||
    workspace?.phase_flow_summary[0];
  const primaryMilestone = useMemo(() => getPhasePrimaryMilestone(currentPhase), [currentPhase]);
  const primaryLearningModule = useMemo(
    () =>
      currentPhase?.learning_modules.find(
        (item) => item.module_id === primaryMilestone?.related_learning_module_id,
      ) || currentPhase?.learning_modules[0],
    [currentPhase, primaryMilestone],
  );
  const primaryPracticeAction = useMemo(() => currentPhase?.practice_actions[0], [currentPhase]);
  const allPhasesCompleted = useMemo(
    () =>
      phaseDrafts.length > 0 &&
      phaseDrafts.every((phase) => {
        const total = phase.milestone_summary?.total_count || phase.milestones.length;
        return total > 0 && (phase.milestone_summary?.completed_count || 0) === total;
      }),
    [phaseDrafts],
  );
  const integrityCheck = workspace?.latest_integrity_check;
  const compatibilityResult = !workspace ? taskSnapshot?.result : undefined;
  const reviewChangeItems = useMemo(
    () => ({
      keep_items: workspace?.latest_review?.keep_items || [],
      deprioritized_items: workspace?.latest_review?.deprioritized_items || [],
      new_items: workspace?.latest_review?.new_items || [],
    }),
    [workspace?.latest_review],
  );
  const reviewChangeTotal =
    reviewChangeItems.keep_items.length +
    reviewChangeItems.deprioritized_items.length +
    reviewChangeItems.new_items.length;
  const groupedIntegrityIssues = useMemo(
    () => groupIntegrityIssues(integrityCheck?.issues),
    [integrityCheck?.issues],
  );
  const integrityResultStale = useMemo(
    () => isIntegrityResultStale(workspace, workspaceDirty),
    [workspace, workspaceDirty],
  );

  useEffect(() => {
    if (workspace?.workspace_id) {
      saveDraft(workspace.workspace_id, editorMarkdown);
    }
  }, [workspace?.workspace_id, editorMarkdown]);

  useEffect(() => {
    if (!workspace) {
      setPhaseDrafts([]);
      setEditorMarkdown('');
      setWorkspaceDirty(false);
      setPolishPreview(undefined);
      setActivePhaseKey(undefined);
      setExpandedRouteModules({});
      return;
    }
    setPhaseDrafts(workspace.growth_plan_phases || []);
    setEditorMarkdown(readDraft(workspace.workspace_id) ?? workspace.edited_report_markdown ?? '');
    setWorkspaceDirty(false);
    setPolishPreview(undefined);
    setActivePhaseKey(currentPhaseKey);
    setActiveStepId(workspace.current_learning_steps?.[0]?.milestone_id);
    setSubmissionText(workspace.current_learning_steps?.[0]?.summary_text || '');
    setSubmissionFiles([]);
    setExpandedRouteModules({});
  }, [currentPhaseKey, workspace?.workspace_id, workspace?.edited_report_markdown, workspace?.updated_at]);

  useEffect(() => {
    if (!selectedLearningStep) {
      setSubmissionText('');
      setSubmissionFiles([]);
      return;
    }
    setSubmissionText(selectedLearningStep.summary_text || '');
    setSubmissionFiles([]);
  }, [selectedLearningStep?.milestone_id]);

  const loadFavoritesLegacy = async () => {};

  const loadWorkspaceLegacy = async (_favoriteId: number) => {};

  useEffect(() => {
    void loadFavorites();
  }, []);

  useEffect(() => {
    void loadWorkspaceLegacy(activeFavorite?.favorite_id || 0);
  }, [activeFavorite?.favorite_id, taskIdsByFavorite]);

  const handleStartAnalysis = async () => {
    history.push('/career-development-report/goal-setting-path-planning');
  };

  const handleMilestoneChange = (
    phaseKey: API.GrowthPlanPhase['phase_key'],
    milestoneId: string,
    patch: Partial<API.GrowthPlanMilestone>,
  ) => {
    setPhaseDrafts((current) =>
      current.map((phase) => {
        if (phase.phase_key !== phaseKey) return phase;
        const nextPhase = {
          ...phase,
          milestones: phase.milestones.map((item) =>
            item.milestone_id === milestoneId
              ? {
                  ...item,
                  ...patch,
                  completed_at: patch.status
                    ? patch.status === 'completed'
                      ? new Date().toISOString()
                      : undefined
                    : item.completed_at,
                }
              : item,
          ),
        };
        return {
          ...nextPhase,
          milestone_summary: summarizePhaseDraft(nextPhase),
        };
      }),
    );
    setWorkspaceDirty(true);
  };

  const focusEditorAt = (anchor?: string) => {
    const textarea = editorRef.current?.resizableTextArea?.textArea as HTMLTextAreaElement | undefined;
    if (!textarea) return;
    const index = anchor ? findHeadingIndex(editorMarkdown, anchor) : -1;
    const cursor = index >= 0 ? index : editorMarkdown.length;
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
      if (cursor > 0 && textarea.value.length > 0) {
        textarea.scrollTop = (cursor / textarea.value.length) * textarea.scrollHeight;
      }
    }, 0);
  };

  const insertSectionSkeleton = (sectionKey: string) => {
    const meta = SECTION_META[sectionKey];
    if (!meta) return;
    if (findHeadingIndex(editorMarkdown, meta.heading) >= 0) {
      focusEditorAt(meta.heading);
      message.info(`「${meta.label}」章节已存在，已定位到该位置。`);
      return;
    }

    let nextMarkdown = editorMarkdown || '# 学生成长路径工作台报告';
    let insertAt = nextMarkdown.length;
    const currentOrderIndex = SECTION_ORDER.indexOf(sectionKey as any);
    SECTION_ORDER.slice(currentOrderIndex + 1).some((key) => {
      const nextMeta = SECTION_META[key];
      if (!nextMeta) return false;
      const index = findHeadingIndex(nextMarkdown, nextMeta.heading);
      if (index >= 0) {
        insertAt = index;
        return true;
      }
      return false;
    });
    if (insertAt === nextMarkdown.length && nextMarkdown.startsWith('# ')) {
      const headingEnd = nextMarkdown.indexOf('\n');
      if (sectionKey === 'target_overview') {
        insertAt = headingEnd >= 0 ? headingEnd : nextMarkdown.length;
      }
    }

    const prefix = nextMarkdown.slice(0, insertAt).trimEnd();
    const suffix = nextMarkdown.slice(insertAt).trimStart();
    const merged = [prefix, meta.template, suffix].filter(Boolean).join('\n\n');
    setEditorMarkdown(merged);
    setWorkspaceDirty(true);
    setPolishPreview(undefined);
    focusEditorAt(meta.heading);
    message.success(`已插入「${meta.label}」章节骨架。`);
  };

  const jumpToRepairSection = (sectionKey: string, anchor?: string) => {
    const meta = SECTION_META[sectionKey];
    const heading = anchor || meta?.heading;
    if (heading && findHeadingIndex(editorMarkdown, heading) >= 0) {
      focusEditorAt(heading);
      return;
    }
    insertSectionSkeleton(sectionKey);
  };

  const handleSaveWorkspace = async (): Promise<API.PlanWorkspacePayload | undefined> => {
    if (!selectedFavoriteId || !workspace) return undefined;
    setSaving(true);
    setActionError(undefined);
    try {
      const response = await updateCareerDevelopmentPlanWorkspace(
        selectedFavoriteId,
        {
          edited_report_markdown: editorMarkdown,
          growth_plan_phases: phaseDrafts,
        },
        { skipErrorHandler: true },
      );
      setWorkspace(response?.data);
      clearDraft(response?.data?.workspace_id);
      message.success('已保存并同步成长路径规划。');
      return response?.data;
    } catch (error: any) {
      setActionError(error?.message || '保存同步失败。');
      return undefined;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitCurrentStep = async () => {
    if (!selectedFavoriteId || !selectedLearningStep) return;
    setSubmittingMilestoneId(selectedLearningStep.milestone_id);
    setActionError(undefined);
    try {
      const formData = new FormData();
      formData.append('summary_text', submissionText);
      submissionFiles.forEach((item) => {
        if (item.originFileObj) {
          formData.append('files', item.originFileObj);
        }
      });
      const response = await submitCareerDevelopmentPlanMilestone(
        selectedFavoriteId,
        selectedLearningStep.milestone_id,
        formData,
        { skipErrorHandler: true },
      );
      setWorkspace(response.data);
      setSubmissionFiles([]);
      const nextStep =
        response.data.current_learning_steps.find((item) => item.status !== 'passed') ||
        response.data.current_learning_steps[0];
      setActiveStepId(nextStep?.milestone_id);
      setSubmissionText(nextStep?.summary_text || '');
      message.success('已提交学习步骤，系统已完成达标判断。');
    } catch (error: any) {
      setActionError(error?.message || '学习步骤提交失败。');
    } finally {
      setSubmittingMilestoneId(undefined);
    }
  };

  const handleRunReview = async (reviewType: 'weekly' | 'monthly') => {
    if (!selectedFavoriteId || !workspace) return;
    setReviewing(reviewType);
    setActionError(undefined);
    try {
      if (workspaceDirty) {
        const saved = await handleSaveWorkspace();
        if (!saved) return;
      }
      await createCareerDevelopmentPlanWorkspaceReview(
        selectedFavoriteId,
        { review_type: reviewType },
        { skipErrorHandler: true },
      );
      await loadWorkspace(selectedFavoriteId);
      message.success(reviewType === 'monthly' ? '月评已完成。' : '周检已完成。');
    } catch (error: any) {
      setActionError(error?.message || '周期评估失败。');
    } finally {
      setReviewing(undefined);
    }
  };

  const handleRunIntegrityCheck = async (showSuccessMessage = true): Promise<API.IntegrityCheckPayload | undefined> => {
    if (!selectedFavoriteId || !workspace) return;
    setChecking(true);
    setActionError(undefined);
    try {
      const response = await integrityCheckCareerDevelopmentPlanWorkspace(
        selectedFavoriteId,
        { markdown: editorMarkdown },
        { skipErrorHandler: true },
      );
      setWorkspace((current) =>
        current
          ? {
              ...current,
              latest_integrity_check: response.data,
            }
          : current,
      );
      if (showSuccessMessage) {
        message.success('完整性检查已更新。');
      }
      return response.data;
    } catch (error: any) {
      setActionError(error?.message || '完整性检查失败。');
      return undefined;
    } finally {
      setChecking(false);
    }
  };

  const handlePolish = async (mode: 'formal' | 'concise' | 'mentor_facing') => {
    if (!selectedFavoriteId || !workspace) return;
    setPolishingMode(mode);
    setActionError(undefined);
    try {
      const response = await polishCareerDevelopmentPlanWorkspace(
        selectedFavoriteId,
        { markdown: editorMarkdown, mode },
        { skipErrorHandler: true },
      );
      setPolishPreview(response.data);
    } catch (error: any) {
      setActionError(error?.message || 'AI 润色失败。');
    } finally {
      setPolishingMode(undefined);
    }
  };

  const handleApplyPolish = () => {
    if (!polishPreview) return;
    setEditorMarkdown(polishPreview.polished_markdown);
    setWorkspaceDirty(true);
    setPolishPreview(undefined);
    message.success('润色候选稿已写回编辑器，建议重新检查完整性。');
  };

  const confirmForceExport = async (
    issues: GroupedIntegrityIssue[],
    blockingCount: number,
    format: 'docx' | 'pdf',
  ) =>
    new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: `当前存在 ${blockingCount} 个阻塞项，仍要导出 ${format.toUpperCase()} 吗？`,
        content: (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Text>这是带阻塞项的草稿导出，可能影响最终交付质量。</Text>
            <div className={styles.metaList}>
              {issues.map((group) => (
                <Text key={group.sectionKey} type="secondary">
                  {group.label}：{group.issues.length} 个问题
                </Text>
              ))}
            </div>
          </Space>
        ),
        okText: '仍然导出',
        cancelText: '返回修复',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

  const handleExport = async (format: 'md' | 'docx' | 'pdf') => {
    if (!selectedFavoriteId || !workspace) return;
    setExporting(format);
    setActionError(undefined);
    try {
      let activeWorkspace = workspace;
      if (workspaceDirty) {
        const saved = await handleSaveWorkspace();
        if (!saved) return;
        activeWorkspace = saved;
      }
      let latestIntegrity = activeWorkspace.latest_integrity_check;
      const needIntegrityRefresh =
        format !== 'md' && (!latestIntegrity || isIntegrityResultStale(activeWorkspace, false));
      if (needIntegrityRefresh) {
        latestIntegrity = await handleRunIntegrityCheck(false);
        if (!latestIntegrity) return;
        activeWorkspace = {
          ...activeWorkspace,
          latest_integrity_check: latestIntegrity,
        };
      }

      let forceWithIssues = false;
      if (
        format !== 'md' &&
        (latestIntegrity?.blocking_count || 0) > 0
      ) {
        const confirmed = await confirmForceExport(
          groupIntegrityIssues(latestIntegrity?.issues),
          latestIntegrity?.blocking_count || 0,
          format,
        );
        if (!confirmed) return;
        forceWithIssues = true;
      }

      const result = await exportCareerDevelopmentPlanWorkspace(selectedFavoriteId, {
        format,
        force_with_issues: forceWithIssues,
      });
      downloadBlob(result.blob, result.filename);
      await loadWorkspace(selectedFavoriteId);
    } catch (error: any) {
      setActionError(error?.message || '导出失败。');
    } finally {
      setExporting(undefined);
    }
  };

  const handleDeleteFavorite = async (favorite: API.CareerDevelopmentFavoritePayload) => {
    await removeFavorite(favorite);
  };

  const renderReviewGroup = (
    groupKey: (typeof REVIEW_CHANGE_GROUPS)[number]['key'],
    title: string,
    color: 'processing' | 'warning' | 'success',
  ) => {
    const items = workspace?.latest_review?.[groupKey] || [];
    return (
      <div className={styles.reviewCard}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <Tag color={color}>{title}</Tag>
            <Text type="secondary">{items.length} 项</Text>
          </Space>
          {items.length ? (
            items.map((item) => (
              <div key={`${groupKey}-${item.title}-${item.next_action}`}>
                <Text strong>{item.title}</Text>
                <Paragraph type="secondary" style={{ marginBottom: 4, marginTop: 6 }}>
                  {item.reason}
                </Paragraph>
                <Text type="secondary">下月动作：{item.next_action}</Text>
              </div>
            ))
          ) : (
            <Text type="secondary">当前没有需要重点展示的变化项。</Text>
          )}
        </Space>
      </div>
    );
  };

  const renderWorkspaceDashboard = () => {
    if (!workspace) return null;
    const currentAction = workspace.current_action_summary;
    const phaseFlow = workspace.phase_flow_summary || [];
    const activeFlowItem =
      phaseFlow.find((item) => item.phase_key === (activePhaseKey || workspace.workspace_overview.current_phase_key)) ||
      phaseFlow[0];
    const currentStepStatus = selectedLearningStep ? stepStatusMeta(selectedLearningStep.status) : null;
    return (
      <>
        <Card
          className={styles.card}
          title="成长路径规划"
          extra={
            <Space wrap>
              <Button onClick={() => handleRunReview('weekly')} loading={reviewing === 'weekly'}>
                运行周检
              </Button>
              <Button
                type="primary"
                onClick={() => handleRunReview('monthly')}
                loading={reviewing === 'monthly'}
              >
                运行月评
              </Button>
            </Space>
          }
        >
          <Space direction="vertical" size={18} style={{ width: '100%' }}>
            <Alert
              type="success"
              showIcon
              message={`当前阶段：${workspace.workspace_overview.current_phase_label}`}
              description={`下一步先完成「${workspace.workspace_overview.next_milestone_title}」，下次建议月评时间为 ${formatDate(workspace.workspace_overview.next_review_at)}。`}
            />
            <Space wrap>
              <Tag color="processing">当前阶段：{workspace.workspace_overview.current_phase_label}</Tag>
              <Tag color="blue">下次月评：{formatDate(workspace.workspace_overview.next_review_at)}</Tag>
              <Tag color={workspace.metric_snapshot.uses_latest_profile ? 'success' : 'warning'}>
                {workspace.metric_snapshot.uses_latest_profile
                  ? '差距指标已按最新画像刷新'
                  : '差距指标未按最新画像刷新'}
              </Tag>
              {!workspace.metric_snapshot.uses_latest_profile ? (
                <Button type="link" style={{ paddingInline: 0 }} onClick={() => history.push('/student-competency-profile')}>
                  去刷新学生画像
                </Button>
              ) : null}
            </Space>
            <div className={styles.actionGrid}>
              <div className={styles.actionHeroCard}>
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <Space wrap>
                    <Tag color="green">本周下一步</Tag>
                    <Tag color="blue">{currentAction.current_phase_label}</Tag>
                  </Space>
                  <Title level={4} style={{ margin: 0 }}>
                    {currentAction.headline || '当前阶段待补齐执行步骤'}
                  </Title>
                  <Text type="secondary">
                    {currentAction.support_text || '先完成当前步骤，再进入下一个阶段动作。'}
                  </Text>
                  <div className={styles.stepListGrid}>
                    {currentLearningSteps.map((step) => {
                      const meta = stepStatusMeta(step.status);
                      return (
                        <div
                          key={step.milestone_id}
                          className={cx(
                            styles.stepPill,
                            activeStepId === step.milestone_id && styles.stepPillActive,
                          )}
                          onClick={() => setActiveStepId(step.milestone_id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setActiveStepId(step.milestone_id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <Space direction="vertical" size={8} style={{ width: '100%' }}>
                            <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                              <Tag color="blue">第 {step.step_index} 步</Tag>
                              <Tag color={meta.color}>{meta.label}</Tag>
                            </Space>
                            <Text strong>{step.title}</Text>
                            <Text type="secondary">{step.objective}</Text>
                            {step.resource ? (
                              <Text type="secondary">学习网站：{step.resource.title}</Text>
                            ) : (
                              <Text type="secondary">学习网站待补齐</Text>
                            )}
                          </Space>
                        </div>
                      );
                    })}
                  </div>
                </Space>
              </div>
              <div className={styles.actionSidebarCard}>
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <Space wrap>
                    <Tag color="blue">步骤执行台</Tag>
                    {currentStepStatus ? <Tag color={currentStepStatus.color}>{currentStepStatus.label}</Tag> : null}
                  </Space>
                  {selectedLearningStep ? (
                    <>
                      <Text strong>{selectedLearningStep.title}</Text>
                      <Text type="secondary">{selectedLearningStep.objective}</Text>
                      {selectedLearningStep.resource ? (
                        <div className={styles.stepPanel}>
                          <Space direction="vertical" size={10} style={{ width: '100%' }}>
                            <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                              <Space wrap>
                                <Tag color="blue">{selectedLearningStep.resource.step_label || `第 ${selectedLearningStep.step_index} 步`}</Tag>
                                <Text strong>{selectedLearningStep.resource.title}</Text>
                              </Space>
                              <Button
                                type="link"
                                icon={<LinkOutlined />}
                                href={selectedLearningStep.resource.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                打开链接
                              </Button>
                            </Space>
                            <Text type="secondary">{selectedLearningStep.resource.reason}</Text>
                            <Text type="secondary">为什么先学：{selectedLearningStep.resource.why_first}</Text>
                            <Text type="secondary">学完产出：{selectedLearningStep.resource.expected_output}</Text>
                          </Space>
                        </div>
                      ) : null}
                      <div className={styles.uploadHint}>
                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                          <Text strong>上传学习内容与小结</Text>
                          <Text type="secondary">
                            上传学习笔记、练习结果或课程截图，并补充你的学习小结。系统会判断你是否已经完成该网站对应的基础学习。
                          </Text>
                        </Space>
                      </div>
                      <Upload
                        multiple
                        beforeUpload={() => false}
                        fileList={submissionFiles}
                        onChange={({ fileList }) => setSubmissionFiles(fileList)}
                      >
                        <Button icon={<UploadOutlined />}>选择学习材料</Button>
                      </Upload>
                      {submissionFiles.length ? (
                        <div className={styles.fileList}>
                          {submissionFiles.map((file) => (
                            <Text key={file.uid} type="secondary">
                              {file.name}
                            </Text>
                          ))}
                        </div>
                      ) : null}
                      <TextArea
                        value={submissionText}
                        onChange={(event) => setSubmissionText(event.target.value)}
                        placeholder="补充你学了什么、记住了什么、产出了什么。"
                        autoSize={{ minRows: 4, maxRows: 7 }}
                      />
                      <Button
                        type="primary"
                        onClick={() => void handleSubmitCurrentStep()}
                        loading={submittingMilestoneId === selectedLearningStep.milestone_id}
                      >
                        提交并判断是否达标
                      </Button>
                      {selectedLearningStep.latest_assessment ? (
                        <Alert
                          type={selectedLearningStep.latest_assessment.result === 'passed' ? 'success' : 'warning'}
                          showIcon
                          message={selectedLearningStep.latest_assessment.summary}
                          description={
                            <Space direction="vertical" size={8}>
                              {selectedLearningStep.latest_assessment.missing_points.length ? (
                                <Text>
                                  待补充：{selectedLearningStep.latest_assessment.missing_points.join('；')}
                                </Text>
                              ) : null}
                              {selectedLearningStep.latest_assessment.next_action ? (
                                <Text type="secondary">
                                  下一步建议：{selectedLearningStep.latest_assessment.next_action}
                                </Text>
                              ) : null}
                            </Space>
                          }
                        />
                      ) : (
                        <Alert
                          type="info"
                          showIcon
                          message={currentAction.audit_summary || '提交后系统会判断你是否达到当前步骤的基础通过线。'}
                        />
                      )}
                    </>
                  ) : (
                    <Alert
                      type="info"
                      showIcon
                      message="当前阶段还没有可执行的学习步骤"
                      description="请先在职业目标分析报告页完成生成，或重新进入当前目标的成长路径规划工作台。"
                    />
                  )}
                </Space>
              </div>
            </div>
            <div className={styles.metrics}>
              <div className={styles.metric}>
                <Statistic
                  title="学习完成率"
                  value={workspace.metric_snapshot.learning_completion_rate}
                  precision={0}
                  suffix="%"
                />
                <Text type="secondary">已完成学习里程碑 / 学习里程碑总数</Text>
              </div>
              <div className={styles.metric}>
                <Statistic
                  title="实践完成率"
                  value={workspace.metric_snapshot.practice_completion_rate}
                  precision={0}
                  suffix="%"
                />
                <Text type="secondary">项目、实习、竞赛等实践动作推进情况</Text>
              </div>
              <div className={styles.metric}>
                <Statistic title="证据沉淀数" value={workspace.metric_snapshot.evidence_count} />
                <Text type="secondary">已沉淀的成果物、作品、证据说明数量</Text>
              </div>
              <div className={styles.metric}>
                <Statistic
                  title="就绪指数"
                  value={workspace.metric_snapshot.readiness_index}
                  precision={0}
                  suffix="%"
                />
                <Text type="secondary">40% 里程碑 + 30% 证据沉淀 + 30% 差距改善</Text>
              </div>
            </div>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Text strong>三阶段线性流程图</Text>
              <div className={styles.flowTrack}>
                {phaseFlow.map((phase, index) => (
                  <div
                    key={phase.phase_key}
                    className={cx(
                      styles.flowNode,
                      activePhaseKey === phase.phase_key && styles.flowNodeActive,
                    )}
                    onClick={() => setActivePhaseKey(phase.phase_key)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setActivePhaseKey(phase.phase_key);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <Space wrap>
                        <Tag color="blue">{index === 0 ? '短期计划' : index === 1 ? '中期计划' : '长期计划'}</Tag>
                        <Tag>{phase.time_horizon}</Tag>
                        <Tag color={phase.status === 'current' ? 'processing' : phase.status === 'completed' ? 'success' : 'default'}>
                          {phase.status === 'current' ? '当前阶段' : phase.status === 'completed' ? '已完成' : '下一阶段'}
                        </Tag>
                      </Space>
                      <Text strong>{phase.phase_label}</Text>
                      <Text type="secondary">{phase.summary}</Text>
                      <Text type="secondary">{phase.next_hint}</Text>
                      <Progress percent={phase.progress_percent} size="small" />
                      {index < phaseFlow.length - 1 ? (
                        <Space align="center">
                          <ArrowRightOutlined />
                          <Text type="secondary">进入下一个阶段</Text>
                        </Space>
                      ) : null}
                    </Space>
                  </div>
                ))}
              </div>
              {activeFlowItem ? (
                <div className={styles.flowSummaryCard}>
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Space wrap>
                      <Tag color={activeFlowItem.status === 'current' ? 'processing' : activeFlowItem.status === 'completed' ? 'success' : 'default'}>
                        {activeFlowItem.phase_label}
                      </Tag>
                      <Tag>{activeFlowItem.time_horizon}</Tag>
                    </Space>
                    <Text strong>{activeFlowItem.summary}</Text>
                    <Text type="secondary">
                      {activeFlowItem.status === 'current'
                        ? `当前需要完成：${activeFlowItem.next_hint}`
                        : activeFlowItem.status === 'upcoming'
                          ? `下一个阶段先做：${activeFlowItem.next_hint}`
                          : `该阶段已完成，核心结果：${activeFlowItem.next_hint}`}
                    </Text>
                  </Space>
                </div>
              ) : null}
            </Space>
            {workspace.latest_review ? (
              reviewChangeTotal > 0 ? (
                <div className={styles.reviewGrid}>
                  {REVIEW_CHANGE_GROUPS.map((group) => (
                    <React.Fragment key={group.key}>
                      {renderReviewGroup(group.key, group.title, group.color)}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <Alert
                  type="info"
                  showIcon
                  message="本月暂无重点变化"
                  description={
                    workspace.latest_review.adjustment_summary || '当前继续按原计划推进。'
                  }
                />
              )
            ) : null}
          </Space>
        </Card>
        <Card
          className={styles.card}
          title="编辑、检查与导出"
          extra={
            <Space wrap>
              <Button
                icon={<SaveOutlined />}
                type="primary"
                loading={saving}
                disabled={!workspaceDirty}
                onClick={() => void handleSaveWorkspace()}
              >
                保存同步
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setEditorMarkdown(workspace.generated_report_markdown);
                  setWorkspaceDirty(true);
                  setPolishPreview(undefined);
                  message.info('已恢复到系统生成版本，记得保存同步。');
                }}
              >
                重置为系统生成版本
              </Button>
            </Space>
          }
        >
          <div className={styles.auditWorkspace}>
            <div className={styles.auditSidebar}>
              <div className={styles.auditPanel}>
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Text strong>审计摘要</Text>
                    <Button
                      icon={<FileSearchOutlined />}
                      onClick={() => void handleRunIntegrityCheck()}
                      loading={checking}
                    >
                      运行完整性检查
                    </Button>
                  </Space>
                  <div className={styles.auditSummaryGrid}>
                    <div className={styles.auditSummaryCard}>
                      <Statistic
                        title="阻塞项"
                        value={integrityCheck?.blocking_count || 0}
                        valueStyle={{ color: '#ff4d4f' }}
                      />
                    </div>
                    <div className={styles.auditSummaryCard}>
                      <Statistic
                        title="警告项"
                        value={integrityCheck?.warning_count || 0}
                        valueStyle={{ color: '#faad14' }}
                      />
                    </div>
                    <div className={styles.auditSummaryCard}>
                      <Statistic
                        title="建议项"
                        value={integrityCheck?.suggestion_count || 0}
                        valueStyle={{ color: '#1677ff' }}
                      />
                    </div>
                  </div>
                  <div className={styles.statusStack}>
                    <Alert
                      type={
                        integrityCheck
                          ? (integrityCheck.blocking_count || 0) > 0
                            ? 'warning'
                            : 'success'
                          : 'info'
                      }
                      showIcon
                      message={
                        integrityCheck
                          ? integrityCheck.summary
                          : '还没有完整性检查结果，建议先运行一次检查。'
                      }
                    />
                    {workspaceDirty ? (
                      <Alert type="warning" showIcon message="存在未保存修改" />
                    ) : null}
                    {workspaceDirty ? (
                      <Alert type="info" showIcon message="本地草稿已暂存到 localStorage" />
                    ) : null}
                    {integrityResultStale ? (
                      <Alert type="warning" showIcon message="检查结果已过期，请重新运行完整性检查" />
                    ) : null}
                  </div>
                </Space>
              </div>

              <div className={styles.auditPanel}>
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <Text strong>章节修复清单</Text>
                  {groupedIntegrityIssues.length ? (
                    groupedIntegrityIssues.map((group) => {
                      const meta = SECTION_META[group.sectionKey];
                      const heading = group.anchor || meta?.heading;
                      const exists = heading ? findHeadingIndex(editorMarkdown, heading) >= 0 : false;
                      return (
                        <div key={group.sectionKey} className={styles.sectionCard}>
                          <Space direction="vertical" size={10} style={{ width: '100%' }}>
                            <Space wrap>
                              <Tag color={issueColor(group.severity)}>{issueLabel(group.severity)}</Tag>
                              <Tag>{group.label}</Tag>
                              <Text type="secondary">{group.issues.length} 个问题</Text>
                            </Space>
                            <Text strong>{group.issues[0]?.message || `${group.label}需要补充内容`}</Text>
                            {group.issues[0]?.suggested_fix ? (
                              <Text type="secondary">建议修复：{group.issues[0].suggested_fix}</Text>
                            ) : null}
                            <Space wrap>
                              <Button
                                type="primary"
                                size="small"
                                onClick={() => jumpToRepairSection(group.sectionKey, heading)}
                              >
                                去修复
                              </Button>
                              {!exists ? (
                                <Button
                                  size="small"
                                  onClick={() => insertSectionSkeleton(group.sectionKey)}
                                >
                                  插入章节骨架
                                </Button>
                              ) : null}
                            </Space>
                            <Collapse
                              size="small"
                              items={[
                                {
                                  key: `${group.sectionKey}-details`,
                                  label: '展开查看详情',
                                  children: (
                                    <div className={styles.sectionIssueList}>
                                      {group.issues.map((issue) => (
                                        <div key={`${group.sectionKey}-${issue.message}`} className={styles.issueCard}>
                                          <Space direction="vertical" size={6} style={{ width: '100%' }}>
                                            <Space wrap>
                                              <Tag color={issueColor(issue.severity)}>
                                                {issueLabel(issue.severity)}
                                              </Tag>
                                              {issue.phase_key ? <Tag>{issue.phase_key}</Tag> : null}
                                              {issue.anchor ? <Tag>定位：{issue.anchor}</Tag> : null}
                                            </Space>
                                            <Text strong>{issue.message}</Text>
                                            {issue.suggested_fix ? (
                                              <Text type="secondary">{issue.suggested_fix}</Text>
                                            ) : null}
                                          </Space>
                                        </div>
                                      ))}
                                    </div>
                                  ),
                                },
                              ]}
                            />
                          </Space>
                        </div>
                      );
                    })
                  ) : (
                    <Empty description="运行完整性检查后，这里会显示章节级修复清单。" />
                  )}
                </Space>
              </div>

              <div className={styles.auditPanel}>
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <Text strong>导出</Text>
                  <Space wrap>
                    <Button
                      icon={<ExportOutlined />}
                      onClick={() => void handleExport('md')}
                      loading={exporting === 'md'}
                    >
                      导出 Markdown
                    </Button>
                    <Button
                      icon={<ExportOutlined />}
                      onClick={() => void handleExport('docx')}
                      loading={exporting === 'docx'}
                    >
                      导出 DOCX
                    </Button>
                    <Button
                      icon={<ExportOutlined />}
                      onClick={() => void handleExport('pdf')}
                      loading={exporting === 'pdf'}
                    >
                      导出 PDF
                    </Button>
                  </Space>
                  <div className={styles.metaList}>
                    <Text type="secondary">最近保存：{formatDateTime(workspace.updated_at)}</Text>
                    <Text type="secondary">
                      最近导出：
                      {workspace.export_meta.last_exported_at
                        ? `${workspace.export_meta.last_exported_format?.toUpperCase()} · ${formatDateTime(workspace.export_meta.last_exported_at)}`
                        : ' 暂无导出记录'}
                    </Text>
                    {workspace.export_meta.last_exported_at ? (
                      <Text type="secondary">
                        导出状态：
                        {workspace.export_meta.last_exported_with_issues
                          ? ` 带 ${workspace.export_meta.last_exported_blocking_count || 0} 个阻塞项导出`
                          : ' 正常导出'}
                      </Text>
                    ) : null}
                  </div>
                  <Alert
                    type="info"
                    showIcon
                    message="DOCX/PDF 在有阻塞项时会弹出确认层，你可以选择返回修复或继续导出草稿。"
                  />
                </Space>
              </div>
            </div>

            <div className={styles.editorSurface}>
              <div className={styles.editorHeader}>
                <div>
                  <Title level={4} style={{ marginBottom: 4 }}>
                    全文编辑与预览
                  </Title>
                  <Text type="secondary">
                    Markdown 仍是唯一编辑源，右侧实时预览会随编辑同步更新。
                  </Text>
                </div>
                <Space wrap>
                  <Button
                    onClick={() => handlePolish('formal')}
                    loading={polishingMode === 'formal'}
                  >
                    正式报告
                  </Button>
                  <Button
                    onClick={() => handlePolish('concise')}
                    loading={polishingMode === 'concise'}
                  >
                    精简表达
                  </Button>
                  <Button
                    onClick={() => handlePolish('mentor_facing')}
                    loading={polishingMode === 'mentor_facing'}
                  >
                    面向导师
                  </Button>
                </Space>
              </div>

              {polishPreview ? (
                <Alert
                  type="warning"
                  showIcon
                  message="润色候选稿已生成"
                  description={
                    <Space direction="vertical" size={12}>
                      <Text>{polishPreview.fact_guard_notice}</Text>
                      <Space wrap>
                        <Button type="primary" icon={<EditOutlined />} onClick={handleApplyPolish}>
                          应用到编辑器
                        </Button>
                        <Button onClick={() => setPolishPreview(undefined)}>保留当前版本</Button>
                      </Space>
                    </Space>
                  }
                />
              ) : null}

              <div className={styles.split}>
                <TextArea
                  ref={editorRef}
                  className={styles.editor}
                  value={editorMarkdown}
                  onChange={(event) => {
                    setEditorMarkdown(event.target.value);
                    setWorkspaceDirty(true);
                  }}
                  placeholder="在这里编辑成长路径规划 Markdown。"
                />
                <div className={styles.preview}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {polishPreview?.polished_markdown || editorMarkdown || '暂无预览内容。'}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </>
    );
  };

  const renderCompatibilityState = () => {
    if (!activeFavorite) {
      return (
        <Card className={styles.card}>
          <Empty description="请选择左侧收藏目标。" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => history.push('/career-development-report/goal-setting-path-planning')}
            >
              前往职业目标分析报告
            </Button>
          </Empty>
        </Card>
      );
    }

    if (taskSnapshot && taskSnapshot.status !== 'completed') {
      return (
        <Card className={styles.card} title="成长路径规划暂未就绪">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type={taskSnapshot.status === 'failed' ? 'error' : 'info'}
              showIcon
              message={
                taskSnapshot.status === 'failed'
                  ? '生成任务失败，请重新发起成长路径规划生成。'
                  : '当前目标的生成任务仍在进行中，完成后会自动补齐短中长期计划和学习路线。'
              }
              description={taskSnapshot.error_message || '你可以留在当前页等待任务完成。'}
            />
            <Progress
              percent={taskSnapshot.progress}
              status={taskSnapshot.status === 'failed' ? 'exception' : 'active'}
            />
            <Space wrap>
              <Tag color="blue">任务状态：{taskSnapshot.status}</Tag>
              {taskSnapshot.latest_event?.status_text ? (
                <Tag>{taskSnapshot.latest_event.status_text}</Tag>
              ) : null}
              <Tag>更新时间：{formatDateTime(taskSnapshot.updated_at)}</Tag>
            </Space>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => void startAnalysis()}
            >
              {taskSnapshot.status === 'failed' ? '重新生成成长路径规划' : '重新发起生成'}
            </Button>
          </Space>
        </Card>
      );
    }

    if (compatibilityResult) {
      return (
        <Card
          className={styles.card}
          title="暂未生成成长路径规划工作台"
          extra={
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => void startAnalysis()}
            >
              生成成长路径规划
            </Button>
          }
        >
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type="warning"
              showIcon
              message="当前目标已有分析结果，但还没有新的成长路径规划工作台。"
              description="点击生成后，会自动补齐短中长期计划、学习路线与进度工作台。"
            />
            <Space wrap>
              <Button icon={<NodeIndexOutlined />} onClick={() => history.push(graphPaths.vertical)}>
                查看垂直岗位图谱
              </Button>
              <Button icon={<SwapOutlined />} onClick={() => history.push(graphPaths.transfer)}>
                查看换岗路径图谱
              </Button>
            </Space>
            <Collapse
              items={[
                {
                  key: 'trend',
                  label: '趋势依据',
                  children: (
                    <div className={styles.preview}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {compatibilityResult.trend_section_markdown || compatibilityResult.trend_markdown}
                      </ReactMarkdown>
                    </div>
                  ),
                },
              ]}
            />
          </Space>
        </Card>
      );
    }

    return (
      <Card className={styles.card}>
        <Empty
          description="当前目标还没有成长路径规划工作台，点击后才会开始生成，不会自动初始化。"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => void startAnalysis()}
          >
            生成成长路径规划
          </Button>
        </Empty>
      </Card>
    );
  };

  return (
    <PageContainer title={false}>
      <div className={styles.page}>
        <div className={styles.hero}>
          <div className={styles.eyebrow}>
            <FlagOutlined />
            成长路径规划
          </div>
          <div className={styles.heroActions}>
            <div>
              <Title level={3} style={{ marginBottom: 8 }}>
                先看当前阶段，再开始本周最优先任务
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                这里不会自动初始化工作台。点击生成后，会一次性产出短中长期计划、学习路线和进度工作台。
              </Paragraph>
            </div>
            <Space wrap>
              <Tag color="processing" icon={<ClockCircleOutlined />}>
                周检：只更新状态与阻塞项
              </Tag>
              <Tag color="blue" icon={<CheckCircleOutlined />}>
                月评：重算差距并输出调整建议
              </Tag>
            </Space>
          </div>
        </div>
        <div className={styles.layout}>
          <Card
            className={cx(styles.card, styles.compactFavoritesCard)}
            title="已收藏目标"
            extra={
              <Button
                size="small"
                type="link"
                onClick={() => void loadFavorites()}
                loading={favoritesLoading}
              >
                刷新
              </Button>
            }
          >
            <div className={styles.compactFavoritesBody}>
              {pageError ? (
                <Alert type="error" showIcon message={pageError} />
              ) : null}
              {activeFavorite ? (
                <div className={styles.currentFavoriteCard}>
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <div className={styles.favoriteMetaRow}>
                      <Space wrap>
                        <Text strong>{activeFavorite.target_title}</Text>
                        <Tag color="blue">{activeFavorite.overall_match.toFixed(0)}%</Tag>
                        <Tag>{activeFavorite.target_scope === 'industry' ? '行业方向' : '岗位方向'}</Tag>
                        {activeFavorite.industry ? <Tag>{activeFavorite.industry}</Tag> : null}
                      </Space>
                      <Space wrap>
                        {workspace ? <Tag color="success">工作台已生成</Tag> : null}
                        {workspaceDirty ? <Tag color="warning">存在未保存修改</Tag> : null}
                      </Space>
                    </div>
                    <div className={styles.favoriteMetaRow}>
                      <Text type="secondary">{activeFavorite.canonical_job_title}</Text>
                      <Text type="secondary">收藏于 {formatDateTime(activeFavorite.created_at)}</Text>
                    </div>
                  </Space>
                </div>
              ) : null}
              {favorites.length ? (
                <div className={styles.favoriteList}>
                  {favorites.map((favorite) => (
                    <div
                      key={favorite.favorite_id}
                      className={cx(
                        styles.favorite,
                        selectedFavoriteId === favorite.favorite_id && styles.favoriteActive,
                      )}
                      onClick={() => setSelectedFavoriteId(favorite.favorite_id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedFavoriteId(favorite.favorite_id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <div className={styles.favoriteMetaRow}>
                          <Text strong>{favorite.target_title}</Text>
                          <Tag color="blue">{favorite.overall_match.toFixed(0)}%</Tag>
                        </div>
                        <Space wrap>
                          <Tag>{favorite.target_scope === 'industry' ? '行业方向' : '岗位方向'}</Tag>
                          {favorite.industry ? <Tag>{favorite.industry}</Tag> : null}
                        </Space>
                        <Text type="secondary">{favorite.canonical_job_title}</Text>
                        <div className={styles.favoriteMetaRow}>
                          <Text type="secondary">收藏于 {formatDateTime(favorite.created_at)}</Text>
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            loading={deletingFavoriteId === favorite.favorite_id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void removeFavorite(favorite);
                            }}
                          />
                        </div>
                      </Space>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  description="还没有收藏目标，先从岗位匹配报告里收藏一个目标。"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </div>
          </Card>

          <div className={styles.stack}>
            {actionError ? (
              <Alert
                closable
                type="error"
                showIcon
                message={actionError}
                onClose={() => setActionError(undefined)}
              />
            ) : null}

            {taskSnapshot && !workspace ? (
              <Card className={styles.card} title="分析进度参考">
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Progress
                    percent={taskSnapshot.progress}
                    status={taskSnapshot.status === 'failed' ? 'exception' : 'active'}
                  />
                  <Space wrap>
                    <Tag color="blue">任务状态：{taskSnapshot.status}</Tag>
                    {taskSnapshot.latest_event?.status_text ? (
                      <Tag>{taskSnapshot.latest_event.status_text}</Tag>
                    ) : null}
                    <Tag>更新时间：{formatDateTime(taskSnapshot.updated_at)}</Tag>
                  </Space>
                  {taskSnapshot.error_message ? (
                    <Alert type="error" showIcon message={taskSnapshot.error_message} />
                  ) : null}
                </Space>
              </Card>
            ) : null}

            {workspace ? renderWorkspaceDashboard() : renderCompatibilityState()}

            <Card
              className={cx(styles.card, styles.sourceCard)}
              title="规划来源"
              extra={
                <Button
                  icon={<FileSearchOutlined />}
                  onClick={() => history.push('/career-development-report/goal-setting-path-planning')}
                >
                  查看职业目标分析报告
                </Button>
              }
            >
              {activeFavorite ? (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <Space wrap>
                    <Tag color="blue">{activeFavorite.target_title}</Tag>
                    <Tag>{activeFavorite.canonical_job_title}</Tag>
                    {activeFavorite.industry ? <Tag>{activeFavorite.industry}</Tag> : null}
                  </Space>
                  <Text type="secondary">
                    这里保留的是来源说明。生成与分析在“职业目标分析报告”页完成，当前页面聚焦成长路径规划、周检月评和导出。
                  </Text>
                </Space>
              ) : (
                <Empty description="请选择左侧收藏目标。" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default JobGoalSettingPathPlanningPage;
