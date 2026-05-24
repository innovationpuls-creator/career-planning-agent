import { PageContainer } from '@ant-design/pro-components';
import { Alert, Card, Empty, message, Spin } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';
import { useMemo, useState } from 'react';
import { AskCoachButton, GlassShell } from '@/components/ui';
import { useCareerGoalPlanningData } from '../shared/useCareerGoalPlanningData';
import ChapterContent from './components/ChapterContent';
import ChapterEditor from './components/ChapterEditor';
import ChapterNav from './components/ChapterNav';
import EvidenceDock from './components/EvidenceDock';
import GenerationProgress from './components/GenerationProgress';
import MarketAlignmentPanel from './components/MarketAlignmentPanel';
import PrerequisiteCheck from './components/PrerequisiteCheck';
import ReportArtifactPanel from './components/ReportArtifactPanel';
import ReportHero from './components/ReportHero';
import ResumeArtifactPanel from './components/ResumeArtifactPanel';
import TaskOrchestrationPanel from './components/TaskOrchestrationPanel';
import WorkbenchHero from './components/WorkbenchHero';
import { useGrowthWorkbench } from './hooks/useGrowthWorkbench';
import { usePrerequisites } from './hooks/usePrerequisites';
import { useReportTaskLifecycle } from './hooks/useReportTaskLifecycle';
import { useReportWorkspace } from './hooks/useReportWorkspace';
import { useWorkbenchTaskQueue } from './hooks/useWorkbenchTaskQueue';
import {
  formatPersonalGrowthDateTime,
  hasPersistedReportContent,
  htmlToMarkdown,
  PERSONAL_GROWTH_SECTION_META,
  type PersonalGrowthSectionKey,
} from './personalGrowthReportUtils';

const useStyles = createStyles(({ css, token }) => ({
  page: css`
    padding: 0;

    :global(.ant-pro-page-container-children-container) {
      padding: 0;
    }
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
  alert: css`
    margin: 0;
    border-radius: 0;
  `,
  emptyCard: css`
    margin: ${token.marginLG}px;
    background: ${token.colorBgContainer};
    color: ${token.colorText};
  `,
  loading: css`
    min-height: 360px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
  `,
  main: css`
    display: flex;
    align-items: flex-start;
    gap: ${token.marginLG}px;
    padding: ${token.paddingLG}px;
    background: transparent;

    @media (max-width: 900px) {
      display: grid;
      padding: ${token.padding}px;
    }
  `,
  workbench: css`
    display: grid;
    gap: ${token.margin}px;
    padding: ${token.paddingLG}px ${token.paddingLG}px 0;

    @media (max-width: 900px) {
      padding: ${token.padding}px ${token.padding}px 0;
    }
  `,
  insightGrid: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 0.55fr);
    gap: ${token.margin}px;

    @media (max-width: 980px) {
      grid-template-columns: 1fr;
    }
  `,
  coachRow: css`
    display: flex;
    justify-content: flex-end;
    padding: ${token.paddingXXS}px 0;
  `,
  content: css`
    flex: 1;
    min-width: 0;
  `,
  reportColumn: css`
    flex: 1;
    min-width: 0;
  `,
  reportEditorLayout: css`
    display: flex;
    align-items: flex-start;
    gap: ${token.marginLG}px;

    @media (max-width: 900px) {
      display: grid;
    }
  `,
  resumeColumn: css`
    width: min(360px, 34vw);
    min-width: 300px;

    @media (max-width: 900px) {
      width: 100%;
      min-width: 0;
    }
  `,
}));

const PersonalGrowthReportPage: React.FC = () => {
  const { styles } = useStyles();
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
    sections,
    dirty,
    saving,
    actionError: workspaceError,
    setActionError: setWorkspaceError,
    refreshPageData,
    saveReport,
    restoreTemplate,
  } = useReportWorkspace({ favoriteId });

  const {
    workbench,
    loading: workbenchLoading,
    error: workbenchError,
    refresh: refreshWorkbench,
  } = useGrowthWorkbench({ favoriteId });

  const { prerequisiteItems, blockingMissingItems, allReady } =
    usePrerequisites({
      activeFavorite: activeFavorite ?? undefined,
      homePayload,
      latestAnalysis,
      goalWorkspace,
    });

  const hasReportContent = hasPersistedReportContent(reportWorkspace);
  const {
    previewEvents,
    generating,
    progress,
    statusText,
    cancellingTask,
    handleStartAnalysis,
    handleCancelTask,
  } = useReportTaskLifecycle({
    favoriteId,
    hasReportContent,
    workspaceId: reportWorkspace?.workspace_id,
    activeTaskId: reportWorkspace?.active_task?.task_id,
    onReportReady: async () => {
      if (favoriteId) {
        await refreshPageData(favoriteId);
      }
    },
  });

  const {
    runningTaskId,
    taskError,
    runTask,
    runFullQueue,
    skipTask,
    cancelTask,
    acceptArtifact,
  } = useWorkbenchTaskQueue({
    favoriteId,
    onRefresh: async () => {
      await refreshWorkbench();
      if (favoriteId) {
        await refreshPageData(favoriteId);
      }
    },
  });

  const [activeSectionKey, setActiveSectionKey] =
    useState<PersonalGrowthSectionKey>('self_cognition');
  const [editing, setEditing] = useState(false);

  const activeSection = useMemo(
    () => sections.find((section) => section.key === activeSectionKey) || sections[0],
    [activeSectionKey, sections],
  );

  const editedSectionKeys = useMemo(
    () =>
      sections
        .filter((section) => {
          const current = htmlToMarkdown(sectionHtmlMap[section.key] || '').trim();
          return Boolean(current && current !== (section.content || '').trim());
        })
        .map((section) => section.key),
    [sectionHtmlMap, sections],
  );

  const targetMeta = activeFavorite
    ? [
        activeFavorite.canonical_job_title,
        activeFavorite.industry,
        activeFavorite.overall_match !== undefined
          ? `匹配 ${Math.round(activeFavorite.overall_match)}%`
          : undefined,
      ]
        .filter(Boolean)
        .join(' / ')
    : undefined;

  const handleGenerate = () => {
    if (!favoriteId) return;
    if (!allReady) {
      setActionError(blockingMissingItems[0]?.prompt || '请先补齐生成报告所需条件。');
      return;
    }
    void handleStartAnalysis(setActionError);
  };

  const handleSave = async () => {
    try {
      await saveReport(sectionHtmlMap);
      setEditing(false);
      message.success('个人职业成长报告已保存。');
    } catch (error: any) {
      message.error(error?.message || '保存失败。');
    }
  };

  const currentError =
    pageError || actionError || workspaceError || workbenchError || taskError;

  return (
    <GlassShell>
      <PageContainer
        className={styles.page}
        title={false}
        breadcrumbRender={false}
      >
      <div className={styles.motionSafe}>
        {currentError ? (
          <Alert
            className={styles.alert}
            type="error"
            showIcon
            message={currentError}
          />
        ) : null}

        {!activeFavorite && !favoritesLoading ? (
          <Card className={styles.emptyCard}>
            <Empty description="请先在职业匹配中选择一个职业推荐目标。" />
          </Card>
        ) : (
          <>
            <PrerequisiteCheck items={prerequisiteItems} />
            <div className={styles.workbench}>
              <WorkbenchHero
                targetSummary={workbench?.target_summary}
                loading={workbenchLoading || Boolean(runningTaskId)}
                onRunFullQueue={() => void runFullQueue()}
                onAskCoach={() => {
                  window.location.href = `/coach?step=report&favoriteId=${favoriteId || ''}`;
                }}
              />
              <TaskOrchestrationPanel
                tasks={workbench?.task_queue || []}
                runningTaskId={runningTaskId}
                onRunTask={(taskType) => void runTask(taskType)}
                onSkipTask={(taskId) => void skipTask(taskId)}
                onCancelTask={(taskId) => void cancelTask(taskId)}
              />
              <div className={styles.insightGrid}>
                <MarketAlignmentPanel
                  targetDiagnosis={workbench?.latest_diagnoses?.target as any}
                  gapDiagnosis={workbench?.latest_diagnoses?.gap as any}
                />
                <EvidenceDock sources={workbench?.evidence_sources || []} />
              </div>
            </div>
            <div className={styles.coachRow}>
              <AskCoachButton
                step="report"
                context={{
                  sourcePage: 'personal-growth-report',
                  favoriteId,
                  workspaceId: reportWorkspace?.workspace_id,
                }}
              />
            </div>
            <ReportHero
              favoriteId={favoriteId}
              title={`${activeFavorite?.canonical_job_title || '个人'}职业成长报告`}
              subtitle="围绕自我认知、职业探索、技能差距和行动计划，沉淀一份可编辑、可导出的成长报告。"
              reportDate={formatPersonalGrowthDateTime(
                reportWorkspace?.last_saved_at || reportWorkspace?.last_generated_at,
              )}
              generated={hasReportContent}
              generating={generating}
              disabled={pageLoading || !allReady}
              targetMeta={targetMeta}
              onGenerate={handleGenerate}
              onRegenerate={handleGenerate}
              onExportError={(msg) => {
                setActionError(msg);
                setWorkspaceError(undefined);
              }}
            />

            {pageLoading ? (
              <div className={styles.loading}>
                <Spin size="large" />
              </div>
            ) : generating || !hasReportContent ? (
              generating ? (
                <div className={styles.main}>
                  <div className={styles.content}>
                    <GenerationProgress
                      progress={progress}
                      statusText={statusText}
                      previewEvents={previewEvents}
                      cancelling={cancellingTask}
                      onCancel={() => void handleCancelTask(setActionError)}
                    />
                  </div>
                </div>
              ) : null
            ) : (
              <main className={styles.main}>
                <div className={styles.reportColumn}>
                  <ReportArtifactPanel
                    versions={workbench?.report_versions || []}
                    existingWorkspace={workbench?.existing_report_workspace}
                    onAccept={(artifactId) => void acceptArtifact(artifactId)}
                  >
                    <div className={styles.reportEditorLayout}>
                      <ChapterNav
                        sections={sections}
                        activeSectionKey={activeSectionKey}
                        editedSectionKeys={editedSectionKeys}
                        onSelect={(key) => {
                          setActiveSectionKey(key);
                          setEditing(false);
                        }}
                      />
                      <div className={styles.content}>
                        {editing ? (
                          <ChapterEditor
                            title={activeSection?.title || '报告章节'}
                            content={sectionHtmlMap[activeSectionKey] || ''}
                            dirty={dirty}
                            saving={saving}
                            placeholder={
                              PERSONAL_GROWTH_SECTION_META[activeSectionKey].placeholder
                            }
                            onChange={(html) =>
                              setSectionHtmlMap((current) => ({
                                ...current,
                                [activeSectionKey]: html,
                              }))
                            }
                            onRestoreTemplate={() =>
                              restoreTemplate(activeSectionKey)
                            }
                            onSave={() => void handleSave()}
                          />
                        ) : (
                          <ChapterContent
                            section={activeSection}
                            onEdit={() => setEditing(true)}
                          />
                        )}
                      </div>
                    </div>
                  </ReportArtifactPanel>
                </div>
                <div className={styles.resumeColumn}>
                  <ResumeArtifactPanel
                    versions={workbench?.resume_versions || []}
                    onAccept={(artifactId) => void acceptArtifact(artifactId)}
                  />
                </div>
              </main>
            )}
          </>
        )}
      </div>
      </PageContainer>
    </GlassShell>
  );
};

export default PersonalGrowthReportPage;
