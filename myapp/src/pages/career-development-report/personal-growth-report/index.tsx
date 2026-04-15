import { PageContainer } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Input,
  Progress,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  cancelPersonalGrowthReportTask,
  createPersonalGrowthReportTask,
  exportPersonalGrowthReport,
  getCareerDevelopmentPlanWorkspace,
  getHomeV2,
  getPersonalGrowthReportTask,
  getPersonalGrowthReportWorkspace,
  getStudentCompetencyLatestAnalysis,
  streamPersonalGrowthReportTask,
  updatePersonalGrowthReportWorkspace,
} from '@/services/ant-design-pro/api';
import { useCareerGoalPlanningData } from '../shared/useCareerGoalPlanningData';
import {
  clearPersonalGrowthDraft,
  clearPersonalGrowthTaskId,
  createPersonalGrowthReportTemplate,
  formatPersonalGrowthDateTime,
  parsePersonalGrowthMarkdown,
  PERSONAL_GROWTH_SECTION_META,
  PERSONAL_GROWTH_SECTION_ORDER,
  readPersonalGrowthDraft,
  readPersonalGrowthTaskId,
  savePersonalGrowthDraft,
  savePersonalGrowthTaskId,
} from './personalGrowthReportUtils';

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;

type ViewMode = 'edit' | 'preview';

type PrerequisiteItem = {
  key: string;
  label: string;
  ready: boolean;
  blocking: boolean;
  description: string;
  prompt: string;
};

const useStyles = createStyles(({ css, token }) => ({
  page: css`
    :global(.ant-pro-page-container-children-container) {
      padding: 0;
    }
    padding: 24px;
  `,
  stack: css`
    display: grid;
    gap: 16px;
  `,
  overviewGrid: css`
    display: grid;
    grid-template-columns: minmax(0, 1.8fr) 360px;
    gap: 16px;

    @media (max-width: 992px) {
      grid-template-columns: 1fr;
    }
  `,
  compactSummaryCard: css`
    display: grid;
    gap: 16px;
  `,
  compactStatusRow: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;

    @media (max-width: 768px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,
  compactStatusItem: css`
    padding: 12px 14px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorBgContainer};
  `,
  targetHero: css`
    display: grid;
    gap: 12px;
  `,
  summaryRow: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  `,
  editorCard: css`
    .ant-card-body {
      display: grid;
      gap: 16px;
    }
  `,
  fullWidthEditor: css`
    width: 100%;
  `,
  editorToolbar: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  `,
  editorShell: css`
    display: grid;
    gap: 16px;
  `,
  editorTextarea: css`
    min-height: calc(100vh - 320px) !important;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 13px;
    line-height: 1.7;
  `,
  markdownBody: css`
    min-height: calc(100vh - 320px);
    padding: 20px 24px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};

    h1,
    h2,
    h3 {
      margin-top: 0;
    }

    h2 {
      margin-top: 28px;
      padding-bottom: 8px;
      border-bottom: 1px solid ${token.colorBorderSecondary};
    }

    h3 {
      margin-top: 20px;
      color: ${token.colorTextHeading};
    }

    p,
    li {
      line-height: 1.8;
    }

    ul,
    ol {
      padding-left: 20px;
    }
  `,
  prerequisiteList: css`
    display: grid;
    gap: 12px;
  `,
  prerequisiteItem: css`
    padding: 12px 14px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorBgContainer};
  `,
  compactPrerequisiteList: css`
    display: grid;
    gap: 8px;
  `,
  compactPrerequisiteItem: css`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid ${token.colorBorderSecondary};

    &:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
  `,
  phaseList: css`
    display: grid;
    gap: 12px;
  `,
  phaseItem: css`
    padding: 12px 14px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
  `,
  drawerSection: css`
    display: grid;
    gap: 12px;
    margin-bottom: 20px;
  `,
  tagGroup: css`
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  `,
}));

const emptyLatestAnalysis: API.StudentCompetencyLatestAnalysisPayload = {
  available: false,
  message: '暂无最新 12 维解析结果。',
  comparison_dimensions: [],
  chart_series: [],
  strength_dimensions: [],
  priority_gap_dimensions: [],
  recommended_keywords: {},
  action_advices: [],
};

const downloadBlob = (blob: Blob, filename?: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'personal-growth-report';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

const getRequestErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.detail || error?.message || fallback;

const normalizeReportMarkdown = (workspace?: API.PersonalGrowthReportPayload) =>
  workspace?.edited_markdown?.trim() || workspace?.generated_markdown?.trim() || '';

const hasPersistedReportContent = (workspace?: API.PersonalGrowthReportPayload) =>
  Boolean(normalizeReportMarkdown(workspace));

const PersonalGrowthReportPage: React.FC = () => {
  const { styles } = useStyles();
  const { activeFavorite, favoritesLoading, pageError, actionError, setActionError } =
    useCareerGoalPlanningData({ workspaceMode: 'none' });

  const taskAbortRef = useRef<AbortController | null>(null);

  const [pageLoading, setPageLoading] = useState(false);
  const [homePayload, setHomePayload] = useState<API.HomeV2Payload>();
  const [latestAnalysis, setLatestAnalysis] = useState<API.StudentCompetencyLatestAnalysisPayload>(
    emptyLatestAnalysis,
  );
  const [goalWorkspace, setGoalWorkspace] = useState<API.PlanWorkspacePayload>();
  const [reportWorkspace, setReportWorkspace] = useState<API.PersonalGrowthReportPayload>();
  const [taskSnapshot, setTaskSnapshot] = useState<API.PersonalGrowthReportTaskPayload>();
  const [editorMarkdown, setEditorMarkdown] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'docx' | 'pdf'>();
  const [creatingTask, setCreatingTask] = useState(false);
  const [cancellingTask, setCancellingTask] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  const favoriteId = activeFavorite?.favorite_id;
  const savedMarkdown = useMemo(() => normalizeReportMarkdown(reportWorkspace), [reportWorkspace]);
  const hasReportContent = hasPersistedReportContent(reportWorkspace);
  const generating =
    creatingTask || taskSnapshot?.status === 'queued' || taskSnapshot?.status === 'running';

  const prerequisiteItems = useMemo<PrerequisiteItem[]>(() => {
    const profile = homePayload?.profile;
    const profileReady = Boolean(
      profile?.full_name &&
        profile?.school &&
        profile?.major &&
        profile?.education_level &&
        profile?.grade &&
        profile?.target_job_title,
    );
    const phases = goalWorkspace?.growth_plan_phases || [];
    const hasLearningPathWorkspace = phases.length > 0;

    return [
      {
        key: 'favorite',
        label: '目标岗位',
        ready: Boolean(activeFavorite),
        blocking: true,
        description: activeFavorite
          ? `${activeFavorite.canonical_job_title}${
              activeFavorite.industry ? ` / ${activeFavorite.industry}` : ''
            }`
          : '未选择职业推荐目标。',
        prompt: '请先在职业匹配结果中选择并收藏一个目标岗位。',
      },
      {
        key: 'profile',
        label: '我的资料',
        ready: profileReady,
        blocking: true,
        description: profileReady
          ? `${profile?.school} · ${profile?.major} · ${profile?.education_level}`
          : '资料未补齐。',
        prompt: '请先在首页补充姓名、学校、专业、学历、年级、目标岗位。',
      },
      {
        key: 'analysis',
        label: '12维解析',
        ready: Boolean(latestAnalysis.available && latestAnalysis.comparison_dimensions?.length),
        blocking: true,
        description:
          latestAnalysis.available && latestAnalysis.comparison_dimensions?.length
            ? `已生成 ${latestAnalysis.comparison_dimensions.length} 个维度的对标结果。`
            : latestAnalysis.message || '暂无最新解析结果。',
        prompt: '请先在"简历解析"页面完成一次最新的 12 维解析。',
      },
      {
        key: 'learning_path',
        label: '蜗牛学习路径',
        ready: true,
        blocking: false,
        description:
          hasLearningPathWorkspace
            ? `已读取到 ${phases.length} 个学习路径阶段。`
            : '当前页未读取到已保存的学习路径时，系统会在生成报告时自动补齐行动计划。',
        prompt: hasLearningPathWorkspace
          ? '已可直接用于生成行动计划。'
          : '如果你已在蜗牛学习路径页生成过内容，不会阻塞当前报告生成。',
      },
    ];
  }, [activeFavorite, goalWorkspace?.growth_plan_phases, homePayload?.profile, latestAnalysis]);

  const blockingMissingItems = prerequisiteItems.filter((item) => item.blocking && !item.ready);
  const topStrengths = (latestAnalysis.strength_dimensions || []).slice(0, 4);
  const topGaps = (latestAnalysis.priority_gap_dimensions || []).slice(0, 4);

  const stopTaskStream = () => {
    taskAbortRef.current?.abort();
    taskAbortRef.current = null;
  };

  const loadReportWorkspace = async (targetFavoriteId: number) => {
    try {
      const response = await getPersonalGrowthReportWorkspace(targetFavoriteId, {
        skipErrorHandler: true,
      });
      setReportWorkspace(response?.data);
    } catch (error: any) {
      const statusCode = error?.response?.status;
      if (statusCode === 404 || String(error?.message || '').includes('404')) {
        setReportWorkspace(undefined);
        return;
      }
      throw error;
    }
  };

  const loadGoalWorkspace = async (targetFavoriteId: number) => {
    try {
      const response = await getCareerDevelopmentPlanWorkspace(targetFavoriteId, {
        skipErrorHandler: true,
      });
      setGoalWorkspace(response?.data);
    } catch (error: any) {
      const statusCode = error?.response?.status;
      if (statusCode === 404 || String(error?.message || '').includes('404')) {
        setGoalWorkspace(undefined);
        return;
      }
      throw error;
    }
  };

  const refreshPageData = async (targetFavoriteId?: number) => {
    setPageLoading(true);
    setActionError(undefined);
    try {
      const homePromise = getHomeV2({ skipErrorHandler: true });
      const analysisPromise = getStudentCompetencyLatestAnalysis({ skipErrorHandler: true });
      const favoriteScopedPromises = targetFavoriteId
        ? Promise.all([loadGoalWorkspace(targetFavoriteId), loadReportWorkspace(targetFavoriteId)])
        : Promise.resolve();

      const [homeResponse, analysisResponse] = await Promise.all([homePromise, analysisPromise, favoriteScopedPromises]);
      setHomePayload(homeResponse?.data);
      setLatestAnalysis(analysisResponse?.data || emptyLatestAnalysis);
    } catch (error: any) {
      setActionError(getRequestErrorMessage(error, '个人职业成长报告数据加载失败。'));
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    if (!favoriteId) {
      setGoalWorkspace(undefined);
      setReportWorkspace(undefined);
      setTaskSnapshot(undefined);
      setEditorMarkdown('');
      setDirty(false);
      stopTaskStream();
      void refreshPageData(undefined);
      return;
    }
    stopTaskStream();
    void refreshPageData(favoriteId);
    return () => stopTaskStream();
  }, [favoriteId]);

  useEffect(() => {
    if (!favoriteId) return;
    const draft = readPersonalGrowthDraft(favoriteId, reportWorkspace?.workspace_id);
    const nextMarkdown =
      draft?.markdown ||
      normalizeReportMarkdown(reportWorkspace) ||
      createPersonalGrowthReportTemplate(reportWorkspace?.sections);
    setEditorMarkdown(nextMarkdown);
    setDirty(Boolean(draft?.markdown && normalizeReportMarkdown(reportWorkspace) !== draft.markdown.trim()));
    if (hasPersistedReportContent(reportWorkspace)) {
      setViewMode('preview');
    }
  }, [favoriteId, reportWorkspace?.workspace_id, reportWorkspace?.edited_markdown, reportWorkspace?.generated_markdown]);

  useEffect(() => {
    if (!favoriteId) return;
    const normalizedEditor = editorMarkdown.trim();
    const normalizedSaved = savedMarkdown.trim();
    if (!normalizedEditor || normalizedEditor === normalizedSaved) {
      clearPersonalGrowthDraft(favoriteId, reportWorkspace?.workspace_id);
      setDirty(false);
      return;
    }
    savePersonalGrowthDraft({
      favoriteId,
      workspaceId: reportWorkspace?.workspace_id,
      markdown: normalizedEditor,
      updatedAt: new Date().toISOString(),
    });
    setDirty(true);
  }, [editorMarkdown, favoriteId, reportWorkspace?.workspace_id, savedMarkdown]);

  const restoreTask = async (targetFavoriteId: number, taskId?: string) => {
    const restoredTaskId = taskId || readPersonalGrowthTaskId(targetFavoriteId);
    if (!restoredTaskId) {
      setTaskSnapshot(undefined);
      return;
    }
    try {
      const response = await getPersonalGrowthReportTask(restoredTaskId, { skipErrorHandler: true });
      const snapshot = response?.data;
      setTaskSnapshot(snapshot);
      if (!snapshot) return;
      if (snapshot.status === 'failed') {
        setActionError(snapshot.error_message || snapshot.latest_event?.status_text || '个人职业成长报告生成失败。');
        clearPersonalGrowthTaskId(targetFavoriteId);
        return;
      }
      if (snapshot.status === 'cancelled' || snapshot.status === 'completed') {
        clearPersonalGrowthTaskId(targetFavoriteId);
        return;
      }
      if (snapshot.status === 'queued' || snapshot.status === 'running') {
        savePersonalGrowthTaskId(targetFavoriteId, snapshot.task_id);
        stopTaskStream();
        const controller = new AbortController();
        taskAbortRef.current = controller;
        for await (const event of streamPersonalGrowthReportTask(snapshot.task_id, controller.signal)) {
          if (event.snapshot) {
            setTaskSnapshot(event.snapshot);
          } else {
            setTaskSnapshot((current) =>
              current
                ? {
                    ...current,
                    status: (event.status || current.status) as API.PersonalGrowthReportTaskPayload['status'],
                    progress: event.progress ?? current.progress,
                    latest_event: current.latest_event
                      ? {
                          ...current.latest_event,
                          stage: event.stage,
                          status_text: event.status_text || current.latest_event.status_text,
                          progress: event.progress ?? current.latest_event.progress,
                          created_at: event.created_at || current.latest_event.created_at,
                        }
                      : undefined,
                  }
                : current,
            );
          }

          const terminalStage = ['completed', 'task_cancelled', 'error', 'failed'].includes(event.stage);
          if (!terminalStage) continue;

          await refreshPageData(targetFavoriteId);
          if (event.stage === 'completed') {
            message.success('个人职业成长报告已生成完成。');
            clearPersonalGrowthTaskId(targetFavoriteId);
          }
          if (event.stage === 'task_cancelled') {
            message.info('已取消个人职业成长报告生成。');
            clearPersonalGrowthTaskId(targetFavoriteId);
          }
          if (event.stage === 'error' || event.stage === 'failed' || event.status === 'failed') {
            setActionError(event.status_text || '个人职业成长报告生成失败。');
            clearPersonalGrowthTaskId(targetFavoriteId);
          }
          break;
        }
      }
    } catch (error: any) {
      clearPersonalGrowthTaskId(targetFavoriteId);
      setActionError(getRequestErrorMessage(error, '个人职业成长报告任务状态恢复失败。'));
    }
  };

  useEffect(() => {
    if (!favoriteId) return;
    const activeTaskId = reportWorkspace?.active_task?.task_id;
    if (activeTaskId) {
      savePersonalGrowthTaskId(favoriteId, activeTaskId);
    }
    void restoreTask(favoriteId, activeTaskId);
  }, [favoriteId, reportWorkspace?.active_task?.task_id]);

  const handleStartAnalysis = async () => {
    if (!favoriteId) return;
    setCreatingTask(true);
    setActionError(undefined);
    try {
      const response = await createPersonalGrowthReportTask(
        { favorite_id: favoriteId, overwrite_current: hasReportContent },
        { skipErrorHandler: true },
      );
      const task = response?.data;
      if (!task?.task_id) {
        throw new Error('个人职业成长报告任务创建失败。');
      }
      savePersonalGrowthTaskId(favoriteId, task.task_id);
      setTaskSnapshot({
        task_id: task.task_id,
        favorite_id: favoriteId,
        status: task.status,
        progress: task.progress,
        overwrite_current: task.overwrite_current,
        created_at: task.started_at,
        updated_at: task.updated_at,
        latest_event: {
          stage: task.status,
          status_text: task.status_text,
          progress: task.progress,
          created_at: task.updated_at,
        },
      });
      await restoreTask(favoriteId, task.task_id);
    } catch (error: any) {
      setActionError(getRequestErrorMessage(error, '个人职业成长报告生成失败。'));
    } finally {
      setCreatingTask(false);
    }
  };

  const handleCancelTask = async () => {
    if (!taskSnapshot?.task_id) return;
    setCancellingTask(true);
    try {
      await cancelPersonalGrowthReportTask(taskSnapshot.task_id, { skipErrorHandler: true });
      if (favoriteId) {
        clearPersonalGrowthTaskId(favoriteId);
      }
      setTaskSnapshot((current) => (current ? { ...current, status: 'cancelled' } : current));
      message.info('已取消个人职业成长报告生成。');
    } catch (error: any) {
      setActionError(getRequestErrorMessage(error, '取消任务失败。'));
    } finally {
      setCancellingTask(false);
    }
  };

  const handleSave = async () => {
    if (!favoriteId) return;
    const parsed = parsePersonalGrowthMarkdown(editorMarkdown);
    if (parsed.missingSectionKeys.length === PERSONAL_GROWTH_SECTION_ORDER.length) {
      message.error('请保留 5 个二级标题后再保存。');
      return;
    }

    setSaving(true);
    setActionError(undefined);
    try {
      const response = await updatePersonalGrowthReportWorkspace(
        favoriteId,
        { sections: parsed.sections },
        { skipErrorHandler: true },
      );
      setReportWorkspace(response?.data);
      setEditorMarkdown(response?.data?.edited_markdown || parsed.normalizedMarkdown);
      clearPersonalGrowthDraft(favoriteId, response?.data?.workspace_id || reportWorkspace?.workspace_id);
      setDirty(false);
      setViewMode('preview');
      message.success('个人职业成长报告已保存。');
    } catch (error: any) {
      setActionError(getRequestErrorMessage(error, '保存个人职业成长报告失败。'));
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format: 'docx' | 'pdf') => {
    if (!favoriteId) return;
    setExportingFormat(format);
    try {
      const result = await exportPersonalGrowthReport(
        favoriteId,
        { format, force_with_issues: false },
        { skipErrorHandler: true },
      );
      downloadBlob(result.blob, result.filename);
      message.success(format === 'docx' ? '已导出 Word。' : '已导出 PDF。');
    } catch (error: any) {
      setActionError(getRequestErrorMessage(error, '导出个人职业成长报告失败。'));
    } finally {
      setExportingFormat(undefined);
    }
  };

  const profile = homePayload?.profile;
  const phases = goalWorkspace?.growth_plan_phases || [];
  const latestSavedText = formatPersonalGrowthDateTime(reportWorkspace?.last_saved_at);

  const detailDrawer = (
    <Drawer
      title="报告详情"
      placement="right"
      width={420}
      open={detailDrawerOpen}
      onClose={() => setDetailDrawerOpen(false)}
      destroyOnClose={false}
    >
      <div className={styles.drawerSection}>
        <Text strong>前置条件</Text>
        <div className={styles.prerequisiteList}>
          {prerequisiteItems.map((item) => (
            <div key={item.key} className={styles.prerequisiteItem}>
              <Flex justify="space-between" align="center">
                <Text strong>{item.label}</Text>
                <Tag color={item.ready ? 'success' : item.blocking ? 'error' : 'warning'}>
                  {item.ready ? '已就绪' : item.blocking ? '缺失' : '建议补充'}
                </Tag>
              </Flex>
              <Text>{item.description}</Text>
              {!item.ready ? <Text type="secondary">{item.prompt}</Text> : null}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.drawerSection}>
        <Text strong>我的资料</Text>
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="姓名">{profile?.full_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="学校">{profile?.school || '-'}</Descriptions.Item>
          <Descriptions.Item label="专业">{profile?.major || '-'}</Descriptions.Item>
          <Descriptions.Item label="学历">{profile?.education_level || '-'}</Descriptions.Item>
          <Descriptions.Item label="年级">{profile?.grade || '-'}</Descriptions.Item>
          <Descriptions.Item label="目标岗位">{profile?.target_job_title || '-'}</Descriptions.Item>
        </Descriptions>
      </div>

      <div className={styles.drawerSection}>
        <Text strong>12维解析摘要</Text>
        {latestAnalysis.available ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div className={styles.summaryRow}>
              <div className={styles.compactStatusItem}>
                <Statistic title="综合评分" value={Math.round(latestAnalysis.score?.overall || 0)} suffix="%" />
              </div>
              <div className={styles.compactStatusItem}>
                <Statistic title="优势维度" value={latestAnalysis.strength_dimensions?.length || 0} />
              </div>
              <div className={styles.compactStatusItem}>
                <Statistic title="优先差距" value={latestAnalysis.priority_gap_dimensions?.length || 0} />
              </div>
            </div>
            <div>
              <Text strong>优势</Text>
              <div className={styles.tagGroup}>
                {topStrengths.length ? topStrengths.map((item) => <Tag key={item}>{item}</Tag>) : <Text type="secondary">暂无</Text>}
              </div>
            </div>
            <div>
              <Text strong>优先差距</Text>
              <div className={styles.tagGroup}>
                {topGaps.length ? topGaps.map((item) => <Tag key={item} color="orange">{item}</Tag>) : <Text type="secondary">暂无</Text>}
              </div>
            </div>
          </Space>
        ) : (
          <Alert type="warning" showIcon message={latestAnalysis.message || '暂无最新解析结果。'} />
        )}
      </div>

      <div className={styles.drawerSection}>
        <Text strong>蜗牛学习路径</Text>
        {phases.length ? (
          <div className={styles.phaseList}>
            {phases.slice(0, 3).map((phase) => (
              <div key={phase.phase_key} className={styles.phaseItem}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Text strong>{phase.phase_label}</Text>
                  <Text type="secondary">{phase.time_horizon}</Text>
                  <Text>{phase.goal_statement}</Text>
                </Space>
              </div>
            ))}
          </div>
        ) : (
          <Alert
            type="info"
            showIcon
            message="当前页未读取到已保存的蜗牛学习路径。"
            description="这不会阻塞个人职业成长报告生成，系统会结合目标岗位、职业匹配结果和已有工作台内容自动补齐行动计划。"
          />
        )}
      </div>
    </Drawer>
  );

  return (
    <PageContainer className={styles.page} title={false} breadcrumbRender={false}>
      <div className={styles.stack}>
        {pageError ? <Alert type="error" showIcon message={pageError} /> : null}
        {actionError ? <Alert type="error" showIcon message={actionError} /> : null}

        {!activeFavorite && !favoritesLoading ? (
          <Card>
            <Empty description="请先在职业匹配中选择一个职业推荐目标。" />
          </Card>
        ) : (
          <>
            {!hasReportContent ? (
              <div className={styles.overviewGrid}>
                <Card loading={pageLoading}>
                  <div className={styles.targetHero}>
                    <Space wrap>
                      <Tag color="blue">目标岗位</Tag>
                      {activeFavorite?.industry ? <Tag>{activeFavorite.industry}</Tag> : null}
                      {activeFavorite?.overall_match !== undefined ? (
                        <Tag color="geekblue">匹配度 {Math.round(activeFavorite.overall_match)}%</Tag>
                      ) : null}
                    </Space>

                    <div>
                      <Title level={2} style={{ marginBottom: 8 }}>
                        {activeFavorite?.canonical_job_title || '个人职业成长报告'}
                      </Title>
                      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        系统会基于我的资料、12维解析、职业匹配差距和蜗牛学习路径生成可编辑 Markdown 报告。
                      </Paragraph>
                    </div>

                    <div className={styles.compactStatusRow}>
                      <div className={styles.compactStatusItem}>
                        <Statistic title="目标方向" value={activeFavorite?.target_title || '-'} />
                      </div>
                      <div className={styles.compactStatusItem}>
                        <Statistic title="最近保存" value={latestSavedText} />
                      </div>
                      <div className={styles.compactStatusItem}>
                        <Statistic title="生成状态" value={generating ? '生成中' : '未开始'} />
                      </div>
                      <div className={styles.compactStatusItem}>
                        <Statistic title="学习阶段" value={phases.length || 0} />
                      </div>
                    </div>

                    {blockingMissingItems.length ? (
                      <Alert
                        type="warning"
                        showIcon
                        message="开始分析前仍有必填信息缺失"
                        description={blockingMissingItems.map((item) => `${item.label}：${item.prompt}`).join('；')}
                      />
                    ) : null}

                    {generating ? (
                      <Card size="small">
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                          <Flex justify="space-between" align="center">
                            <Text strong>报告生成进度</Text>
                            <Text type="secondary">{taskSnapshot?.progress || 0}%</Text>
                          </Flex>
                          <Progress percent={taskSnapshot?.progress || 0} status="active" />
                          <Text type="secondary">
                            {taskSnapshot?.latest_event?.status_text || '正在准备个人职业成长报告。'}
                          </Text>
                          <div>
                            <Button danger onClick={() => void handleCancelTask()} loading={cancellingTask}>
                              取消生成
                            </Button>
                          </div>
                        </Space>
                      </Card>
                    ) : (
                      <Space wrap>
                        <Button type="primary" size="large" onClick={() => void handleStartAnalysis()}>
                          开始分析
                        </Button>
                        <Button onClick={() => setDetailDrawerOpen(true)}>查看详情</Button>
                      </Space>
                    )}
                  </div>
                </Card>

                <Card title="前置条件总览" loading={pageLoading} className={styles.compactSummaryCard}>
                  <div className={styles.compactPrerequisiteList}>
                    {prerequisiteItems.map((item) => (
                      <div key={item.key} className={styles.compactPrerequisiteItem}>
                        <div>
                          <Text strong>{item.label}</Text>
                          <div>
                            <Text type="secondary">{item.description}</Text>
                          </div>
                        </div>
                        <Tag color={item.ready ? 'success' : item.blocking ? 'error' : 'warning'}>
                          {item.ready ? '已就绪' : item.blocking ? '缺失' : '建议补充'}
                        </Tag>
                      </div>
                    ))}
                  </div>
                  <Button onClick={() => setDetailDrawerOpen(true)}>查看详情</Button>
                </Card>
              </div>
            ) : (
              <>
                <Card loading={pageLoading}>
                  <div className={styles.targetHero}>
                    <Flex justify="space-between" align="flex-start" gap={16} wrap="wrap">
                      <div>
                        <Space wrap>
                          <Tag color="blue">目标岗位</Tag>
                          {activeFavorite?.industry ? <Tag>{activeFavorite.industry}</Tag> : null}
                          {activeFavorite?.overall_match !== undefined ? (
                            <Tag color="geekblue">匹配度 {Math.round(activeFavorite.overall_match)}%</Tag>
                          ) : null}
                        </Space>
                        <Title level={2} style={{ margin: '8px 0 4px' }}>
                          {activeFavorite?.canonical_job_title || '个人职业成长报告'}
                        </Title>
                        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                          编辑区优先展示，详情信息已收纳到右侧抽屉。
                        </Paragraph>
                      </div>
                      <Space wrap>
                        <Button type="primary" onClick={() => void handleStartAnalysis()}>
                          重新生成报告
                        </Button>
                        <Button onClick={() => setDetailDrawerOpen(true)}>查看详情</Button>
                        <Button onClick={() => void handleExport('docx')} loading={exportingFormat === 'docx'}>
                          导出 Word
                        </Button>
                        <Button onClick={() => void handleExport('pdf')} loading={exportingFormat === 'pdf'}>
                          导出 PDF
                        </Button>
                      </Space>
                    </Flex>

                    <div className={styles.compactStatusRow}>
                      <div className={styles.compactStatusItem}>
                        <Statistic title="目标方向" value={activeFavorite?.target_title || '-'} />
                      </div>
                      <div className={styles.compactStatusItem}>
                        <Statistic title="最近保存" value={latestSavedText} />
                      </div>
                      <div className={styles.compactStatusItem}>
                        <Statistic title="生成状态" value={generating ? '生成中' : '已生成'} />
                      </div>
                      <div className={styles.compactStatusItem}>
                        <Statistic title="学习阶段" value={phases.length || 0} />
                      </div>
                    </div>

                    {generating ? (
                      <Card size="small">
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                          <Flex justify="space-between" align="center">
                            <Text strong>报告生成进度</Text>
                            <Text type="secondary">{taskSnapshot?.progress || 0}%</Text>
                          </Flex>
                          <Progress percent={taskSnapshot?.progress || 0} status="active" />
                          <Text type="secondary">
                            {taskSnapshot?.latest_event?.status_text || '正在准备个人职业成长报告。'}
                          </Text>
                          <div>
                            <Button danger onClick={() => void handleCancelTask()} loading={cancellingTask}>
                              取消生成
                            </Button>
                          </div>
                        </Space>
                      </Card>
                    ) : null}
                  </div>
                </Card>

                <Card title="报告编辑" className={`${styles.editorCard} ${styles.fullWidthEditor}`}>
                <div className={styles.editorToolbar}>
                  <Space wrap>
                    <Button type={viewMode === 'edit' ? 'primary' : 'default'} onClick={() => setViewMode('edit')}>
                      Markdown 编辑
                    </Button>
                    <Button type={viewMode === 'preview' ? 'primary' : 'default'} onClick={() => setViewMode('preview')}>
                      预览渲染
                    </Button>
                    <Button onClick={() => setEditorMarkdown(createPersonalGrowthReportTemplate(reportWorkspace?.sections))}>
                      恢复结构模板
                    </Button>
                    <Button onClick={() => setDetailDrawerOpen(true)}>查看详情</Button>
                  </Space>
                  <Space wrap>
                    <Button onClick={() => void handleExport('docx')} loading={exportingFormat === 'docx'}>
                      导出 Word
                    </Button>
                    <Button onClick={() => void handleExport('pdf')} loading={exportingFormat === 'pdf'}>
                      导出 PDF
                    </Button>
                    <Button type="primary" loading={saving} disabled={!dirty} onClick={() => void handleSave()}>
                      保存报告
                    </Button>
                  </Space>
                </div>

                <div className={styles.editorShell}>
                  {viewMode === 'edit' ? (
                    <TextArea
                      value={editorMarkdown}
                      onChange={(event) => setEditorMarkdown(event.target.value)}
                      autoSize={{ minRows: 26, maxRows: 40 }}
                      className={styles.editorTextarea}
                    />
                  ) : (
                    <div className={styles.markdownBody}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{editorMarkdown}</ReactMarkdown>
                    </div>
                  )}
                </div>
                </Card>
              </>
            )}
            {detailDrawer}
          </>
        )}
      </div>
    </PageContainer>
  );
};

export default PersonalGrowthReportPage;
