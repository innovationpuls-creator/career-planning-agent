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
import GenerationProgress from './components/GenerationProgress';
import PrerequisiteCheck from './components/PrerequisiteCheck';
import ReportHero from './components/ReportHero';
import { usePrerequisites } from './hooks/usePrerequisites';
import { useReportTaskLifecycle } from './hooks/useReportTaskLifecycle';
import { useReportWorkspace } from './hooks/useReportWorkspace';
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
  content: css`
    flex: 1;
    min-width: 0;
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

  const currentError = pageError || actionError || workspaceError;

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
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 0 4px' }}>
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
                      onRestoreTemplate={() => restoreTemplate(activeSectionKey)}
                      onSave={() => void handleSave()}
                    />
                  ) : (
                    <ChapterContent
                      section={activeSection}
                      onEdit={() => setEditing(true)}
                    />
                  )}
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
