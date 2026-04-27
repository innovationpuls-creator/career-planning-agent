import { PageContainer } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Card,
  Empty,
  message,
  Progress,
  Tag,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';
import { useMemo, useState } from 'react';
import { exportPersonalGrowthReport } from '@/services/ant-design-pro/api';
import { useCareerGoalPlanningData } from '../shared/useCareerGoalPlanningData';
import ReportDetailDrawer from './components/ReportDetailDrawer';
import ReportEmptyState from './components/ReportEmptyState';
import ReportSidebar from './components/ReportSidebar';
import SectionEditor from './components/SectionEditor';
import { usePrerequisites } from './hooks/usePrerequisites';
import { useReportTaskLifecycle } from './hooks/useReportTaskLifecycle';
import { useReportWorkspace } from './hooks/useReportWorkspace';
import {
  createPersonalGrowthReportTemplate,
  formatPersonalGrowthDateTime,
  hasPersistedReportContent,
  markdownToHtml,
  PERSONAL_GROWTH_SECTION_ORDER,
  type PersonalGrowthSectionKey,
  parsePersonalGrowthMarkdown,
} from './personalGrowthReportUtils';

const { Text } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  page: css`
    :global(.ant-pro-page-container-children-container) {
      padding: 0;
    }
    padding: 0;
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

  /* ── Status Bar (deep blue gradient, echoes auth page) ── */

  statusBar: css`
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 32px;
    background: linear-gradient(160deg, #0F2060 0%, #1A3A8F 50%, #0F4299 100%);
    flex-wrap: wrap;

    @media (max-width: 768px) {
      padding: 16px 20px;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
  `,

  statusBarLeft: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  `,

  statusBarTitleRow: css`
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  `,

  statusBarTitle: css`
    font-family: var(--font-heading);
    font-size: 22px;
    font-weight: var(--font-weight-display, 900);
    letter-spacing: 0.06em;
    color: #ffffff;
    margin: 0;
    line-height: 1.2;
  `,

  statusBarTag: css`
    font-family: var(--font-body);
    font-size: 11px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.75);
  `,

  statusBarSubtitle: css`
    font-family: var(--font-body);
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
    line-height: 1.4;
  `,

  statusMetrics: css`
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    margin-top: 4px;

    @media (max-width: 768px) {
      gap: 12px;
    }
  `,

  statusMetric: css`
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-body);
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;

    span:last-child {
      color: rgba(255, 255, 255, 0.8);
      font-weight: 500;
    }
  `,

  statusBarRight: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;

    @media (max-width: 768px) {
      width: 100%;
      justify-content: flex-end;
    }
  `,

  ghostBtn: css`
    color: rgba(255, 255, 255, 0.7) !important;
    border-color: rgba(255, 255, 255, 0.2) !important;
    background: transparent !important;
    font-family: var(--font-body) !important;

    &:hover {
      color: #ffffff !important;
      border-color: rgba(255, 255, 255, 0.4) !important;
      background: rgba(255, 255, 255, 0.08) !important;
    }
  `,

  ghostPrimaryBtn: css`
    color: #0F2060 !important;
    background: #ffffff !important;
    border-color: #ffffff !important;
    font-family: var(--font-body) !important;
    font-weight: 500 !important;

    &:hover {
      background: rgba(255, 255, 255, 0.9) !important;
      border-color: rgba(255, 255, 255, 0.9) !important;
    }
  `,

  /* ── Generating progress (inside status bar area) ── */

  generatingBanner: css`
    padding: 24px 32px;
    background: ${token.colorBgLayout};
    border-bottom: 1px solid ${token.colorBorderSecondary};

    @media (max-width: 768px) {
      padding: 16px 20px;
    }
  `,

  generatingContent: css`
    display: flex;
    align-items: center;
    gap: 20px;
    max-width: 600px;

    @media (max-width: 768px) {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
  `,

  /* ── Main layout ── */

  layout: css`
    display: flex;
    gap: 24px;
    align-items: flex-start;
    padding: 24px;
    background: ${token.colorBgLayout};

    @media (max-width: 900px) {
      flex-direction: column;
      padding: 16px;
    }
  `,

  content: css`
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 0;
  `,

  /* ── Glass bottom action bar ── */

  glassBar: css`
    position: sticky;
    bottom: 16px;
    z-index: 10;
    margin: 0 24px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 12px 20px;
    background: rgba(255, 255, 255, 0.78);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: ${token.borderRadiusLG}px;
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);

    @media (max-width: 768px) {
      margin: 0 12px 12px;
      padding: 10px 16px;
      border-radius: ${token.borderRadiusLG}px;
      bottom: 12px;
    }
  `,

  glassBarLeft: css`
    display: flex;
    align-items: center;
    gap: 12px;
  `,

  glassBarRight: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  subtleBtn: css`
    color: ${token.colorTextTertiary} !important;
    font-family: var(--font-body) !important;
    font-size: 13px !important;

    &:hover {
      color: ${token.colorText} !important;
    }
  `,

  saveBtn: css`
    font-family: var(--font-body) !important;
    font-weight: 500 !important;
  `,

  /* ── Drawer ── */

  emptyCard: css`
    margin: 24px;
    border-radius: ${token.borderRadiusLG}px;

    @media (max-width: 768px) {
      margin: 16px;
    }
  `,

  /* ── Pulse animation for save button ── */

  pulse: css`
    @keyframes pgSavePulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(22, 85, 204, 0.4); }
      50% { box-shadow: 0 0 0 6px rgba(22, 85, 204, 0); }
    }

    animation: pgSavePulse 2s ease-in-out infinite;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `,
}));

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

const PersonalGrowthReportPage: React.FC = () => {
  const { styles, cx } = useStyles();
  const {
    activeFavorite,
    favoritesLoading,
    pageError,
    actionError,
    setActionError,
  } = useCareerGoalPlanningData({ workspaceMode: 'none' });

  const favoriteId = activeFavorite?.favorite_id;

  const {
    pageLoading,
    homePayload,
    latestAnalysis,
    goalWorkspace,
    reportWorkspace,
    sectionHtmlMap,
    setSectionHtmlMap,
    dirty,
    saving,
    saveReport,
    refreshPageData,
  } = useReportWorkspace({ favoriteId });

  const { prerequisiteItems, blockingMissingItems } = usePrerequisites({
    activeFavorite: activeFavorite ?? undefined,
    homePayload,
    latestAnalysis,
    goalWorkspace,
  });

  const hasReportContent = hasPersistedReportContent(reportWorkspace);

  const {
    taskSnapshot,
    creatingTask,
    cancellingTask,
    generating,
    handleStartAnalysis,
    handleCancelTask,
  } = useReportTaskLifecycle({
    favoriteId,
    hasReportContent,
    workspaceId: reportWorkspace?.workspace_id,
    activeTaskId: reportWorkspace?.active_task?.task_id,
    onReportReady: () => refreshPageData(favoriteId!),
  });

  const [exportingFormat, setExportingFormat] = useState<'docx' | 'pdf'>();
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [activeSectionKey, setActiveSectionKey] =
    useState<PersonalGrowthSectionKey>('self_cognition');

  const sections = useMemo(() => {
    const raw = reportWorkspace?.sections || [];
    return PERSONAL_GROWTH_SECTION_ORDER.map((key) => {
      const match = raw.find((s) => s.key === key);
      return {
        key,
        title: match?.title || key,
        content: match?.content || '',
        completed: Boolean(match?.content?.trim()),
      };
    });
  }, [reportWorkspace?.sections]);

  const handleSave = async () => {
    try {
      await saveReport(sectionHtmlMap);
      message.success('个人职业成长报告已保存。');
    } catch (e: any) {
      message.error(e?.message || '保存失败。');
    }
  };

  const handleExport = async (format: 'docx' | 'pdf') => {
    if (!favoriteId) return;
    setExportingFormat(format);
    try {
      const result = await exportPersonalGrowthReport(favoriteId, {
        format,
        force_with_issues: false,
      });
      downloadBlob(result.blob, result.filename);
      message.success(format === 'docx' ? '已导出 Word。' : '已导出 PDF。');
    } catch (error: any) {
      setActionError(getRequestErrorMessage(error, '导出失败。'));
    } finally {
      setExportingFormat(undefined);
    }
  };

  const profile = homePayload?.profile;
  const phases = goalWorkspace?.growth_plan_phases || [];
  const latestSavedText = formatPersonalGrowthDateTime(
    reportWorkspace?.last_saved_at,
  );

  return (
    <PageContainer
      className={styles.page}
      title={false}
      breadcrumbRender={false}
    >
      <div className={cx(styles.motionSafe)}>
        {pageError ? (
          <Alert
            type="error"
            showIcon
            message={pageError}
            style={{ marginBottom: 0 }}
          />
        ) : null}
        {actionError ? (
          <Alert
            type="error"
            showIcon
            message={actionError}
            style={{ marginBottom: 0 }}
          />
        ) : null}

        {!activeFavorite && !favoritesLoading ? (
          <Card className={styles.emptyCard}>
            <Empty description="请先在职业匹配中选择一个职业推荐目标。" />
          </Card>
        ) : !hasReportContent ? (
          <ReportEmptyState
            activeFavorite={activeFavorite ?? undefined}
            prerequisites={prerequisiteItems}
            blockingCount={blockingMissingItems.length}
            generating={generating}
            taskProgress={taskSnapshot?.progress || 0}
            taskStatusText={
              taskSnapshot?.latest_event?.status_text || '正在准备...'
            }
            onCreateTask={() => void handleStartAnalysis(setActionError)}
            onViewDetails={() => setDetailDrawerOpen(true)}
            onCancelTask={() => void handleCancelTask(setActionError)}
            cancellingTask={cancellingTask}
            loading={pageLoading}
          />
        ) : (
          <>
            {/* ── Status Bar ── */}
            <div className={styles.statusBar}>
              <div className={styles.statusBarLeft}>
                <div className={styles.statusBarTitleRow}>
                  <div className={styles.statusBarTitle}>
                    {activeFavorite?.canonical_job_title || '个人职业成长报告'}
                  </div>
                  {activeFavorite?.industry ? (
                    <Tag className={styles.statusBarTag}>
                      {activeFavorite.industry}
                    </Tag>
                  ) : null}
                  {activeFavorite?.overall_match !== undefined ? (
                    <Tag className={styles.statusBarTag}>
                      匹配 {Math.round(activeFavorite.overall_match)}%
                    </Tag>
                  ) : null}
                </div>
                <div className={styles.statusBarSubtitle}>
                  点击左侧章节切换编辑，使用上方工具栏设置格式
                </div>
                <div className={styles.statusMetrics}>
                  <span className={styles.statusMetric}>
                    目标方向<span>{activeFavorite?.target_title || '-'}</span>
                  </span>
                  <span className={styles.statusMetric}>
                    最近保存<span>{latestSavedText}</span>
                  </span>
                  <span className={styles.statusMetric}>
                    学习阶段<span>{phases.length || 0}</span>
                  </span>
                  <span className={styles.statusMetric}>
                    状态
                    <span
                      style={{
                        color: generating ? 'rgba(255,255,255,0.9)' : undefined,
                      }}
                    >
                      {generating ? '生成中' : '已生成'}
                    </span>
                  </span>
                </div>
              </div>

              <div className={styles.statusBarRight}>
                <Button
                  className={styles.ghostBtn}
                  onClick={() => setDetailDrawerOpen(true)}
                >
                  查看详情
                </Button>
                <Button
                  className={styles.ghostPrimaryBtn}
                  onClick={() => void handleStartAnalysis(setActionError)}
                >
                  重新生成报告
                </Button>
              </div>
            </div>

            {/* ── Generating progress ── */}
            {generating ? (
              <div className={styles.generatingBanner}>
                <div className={styles.generatingContent}>
                  <Progress
                    percent={taskSnapshot?.progress || 0}
                    status="active"
                    style={{ flex: 1, margin: 0 }}
                  />
                  <Text
                    type="secondary"
                    style={{ fontSize: 13, whiteSpace: 'nowrap' }}
                  >
                    {taskSnapshot?.latest_event?.status_text || '正在准备...'}
                  </Text>
                  <Button
                    danger
                    size="small"
                    onClick={() => void handleCancelTask(setActionError)}
                    loading={cancellingTask}
                  >
                    取消生成
                  </Button>
                </div>
              </div>
            ) : null}

            {/* ── Main Layout: Sidebar + Editor ── */}
            <div className={styles.layout}>
              <ReportSidebar
                sections={sections}
                activeSectionKey={activeSectionKey}
                onSelect={setActiveSectionKey}
              />
              <div className={styles.content}>
                {sections
                  .filter((s) => s.key === activeSectionKey)
                  .map((section) => (
                    <SectionEditor
                      key={section.key}
                      title={section.title}
                      content={sectionHtmlMap[section.key] || ''}
                      onChange={(html) => {
                        setSectionHtmlMap((prev) => ({
                          ...prev,
                          [section.key]: html,
                        }));
                      }}
                      dirty={dirty}
                      placeholder={`请输入${section.title}内容...`}
                    />
                  ))}
              </div>
            </div>

            {/* ── Glass Bottom Bar ── */}
            <div className={styles.glassBar}>
              <div className={styles.glassBarLeft}>
                <Button
                  className={styles.subtleBtn}
                  type="text"
                  onClick={() => {
                    const template = createPersonalGrowthReportTemplate(
                      reportWorkspace?.sections,
                    );
                    const parsed = parsePersonalGrowthMarkdown(template);
                    const map: Record<PersonalGrowthSectionKey, string> = {
                      ...sectionHtmlMap,
                    };
                    parsed.sections.forEach((s) => {
                      map[s.key] = markdownToHtml(s.content);
                    });
                    setSectionHtmlMap(map);
                  }}
                >
                  恢复结构模板
                </Button>
                {dirty ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    有未保存的更改
                  </Text>
                ) : null}
              </div>
              <div className={styles.glassBarRight}>
                <Button
                  onClick={() => void handleExport('docx')}
                  loading={exportingFormat === 'docx'}
                >
                  导出 Word
                </Button>
                <Button
                  onClick={() => void handleExport('pdf')}
                  loading={exportingFormat === 'pdf'}
                >
                  导出 PDF
                </Button>
                <Button
                  type="primary"
                  className={cx(
                    styles.saveBtn,
                    dirty ? styles.pulse : undefined,
                  )}
                  loading={saving}
                  disabled={!dirty}
                  onClick={() => void handleSave()}
                >
                  保存报告
                </Button>
              </div>
            </div>
          </>
        )}

        <ReportDetailDrawer
          open={detailDrawerOpen}
          onClose={() => setDetailDrawerOpen(false)}
          prerequisiteItems={prerequisiteItems}
          profile={profile}
        />
      </div>
    </PageContainer>
  );
};

export default PersonalGrowthReportPage;
