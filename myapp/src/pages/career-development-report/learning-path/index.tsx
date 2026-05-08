import { FadeInWhenVisible } from '@/components/ui/FadeInWhenVisible';
import { PageContainer, ProCard } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Alert, Button, Result, Skeleton, Space } from 'antd';
import { createStyles } from 'antd-style';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ModuleList } from './components/ModuleList';
import { PathHero } from './components/PathHero';
import { PhaseTimeline } from './components/PhaseTimeline';
import { ResourceCards } from './components/ResourceCards';
import { ResourceDetail } from './components/ResourceDetail';
import { ReviewPanel } from './components/ReviewPanel';
import { useModuleProgress } from './hooks/useModuleProgress';
import { useReviews } from './hooks/useReviews';
import { useWorkspace } from './hooks/useWorkspace';
import {
  PHASE_LABELS,
  buildWorkspaceStorageKey,
  getCheckedResourceUrlsForPhase,
  getCompletedModuleIds,
  getCurrentPhaseKey,
  getModuleDisplayTitle,
  getModuleResources,
  getPhaseProgress,
  getResourceCompletionId,
  loadActivePhaseKey,
  loadFavoriteId,
  saveActivePhaseKey,
  saveFavoriteId,
} from './learningPathUtils';
import type {
  LearningPathPhaseKey,
  LearningResourceCard,
} from './learningPathUtils';

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
  workspaceHeader: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
    padding: 14px 18px;
    border: 1px solid color-mix(in srgb, ${token.colorBorderSecondary} 66%, ${token.colorPrimaryBg} 34%);
    border-radius: 18px;
    background: color-mix(in srgb, ${token.colorBgContainer} 88%, ${token.colorPrimaryBg} 12%);
    box-shadow: 0 10px 30px color-mix(in srgb, ${token.colorPrimary} 6%, transparent);
    @media (max-width: 860px) {
      grid-template-columns: 1fr;
    }
  `,
  workspaceTitleLine: css`
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    min-width: 0;
  `,
  workspaceTitle: css`
    font-family: var(--font-heading, "Noto Serif SC", "Songti SC", serif);
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: ${token.colorText};
  `,
  workspaceSubtitle: css`
    font-size: 13px;
    color: ${token.colorTextTertiary};
  `,
  mainLayout: css`
    display: grid;
    grid-template-columns: minmax(260px, 0.4fr) minmax(0, 0.6fr);
    gap: 20px;
    align-items: start;
    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,
  leftPanel: css`
    position: sticky;
    top: 88px;
    background: ${token.colorBgContainer};
    border-radius: 18px;
    border: 1px solid ${token.colorBorderSecondary};
    padding: 16px;
    box-shadow: 0 4px 16px color-mix(in srgb, ${token.colorPrimary} 5%, transparent);
    @media (max-width: 900px) {
      position: static;
    }
  `,
  rightPanel: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
  `,
  sectionHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  `,
  sectionTitle: css`
    font-family: var(--font-heading, "Noto Serif SC", "Songti SC", serif);
    font-size: 16px;
    font-weight: 700;
    color: ${token.colorText};
    margin: 0;
  `,
}));

const makeFallbackPhase = () =>
  ({
    phase_key: 'short_term',
    phase_label: '',
    time_horizon: '',
    goal_statement: '',
    why_now: '',
    learning_modules: [],
    practice_actions: [],
    deliverables: [],
    entry_gate: [],
    exit_gate: [],
    milestones: [],
    risk_alerts: [],
  }) as API.GrowthPlanPhase;

const makeFallbackReport = () =>
  ({
    report_id: '',
    target_title: '',
    overall_match: 0,
    comparison_dimensions: [],
    chart_series: [],
    strength_dimensions: [],
    priority_gap_dimensions: [],
    action_advices: [],
    evidence_cards: [],
    narrative: {
      overall_review: '',
      completeness_explanation: '',
      competitiveness_explanation: '',
      strength_highlights: [],
      priority_gap_highlights: [],
    },
  }) as unknown as API.CareerDevelopmentMatchReport;

const LearningPathPage: React.FC = () => {
  const { styles } = useStyles();
  const favoriteId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get('favorite_id'));
    if (Number.isInteger(id) && id > 0) return id;
    return loadFavoriteId();
  }, []);

  const { workspace, loading, error, preparation, refresh } = useWorkspace(
    favoriteId ?? 0,
  );
  const [activePhaseKey, setActivePhaseKey] = useState<LearningPathPhaseKey>();
  const [activeReviewType, setActiveReviewType] = useState<'weekly' | 'monthly'>(
    'weekly',
  );
  const phaseMotionStateRef = useRef<'idle' | 'leaving' | 'entering'>('idle');
  const phaseTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reviewSectionRef = useRef<HTMLDivElement>(null);
  const phases = workspace?.growth_plan_phases || [];
  const report = workspace?.favorite?.report_snapshot as
    | API.CareerDevelopmentMatchReport
    | null;

  const storageKey = useMemo(
    () => buildWorkspaceStorageKey(workspace, report),
    [workspace, report],
  );

  useEffect(() => {
    if (favoriteId) saveFavoriteId(favoriteId);
  }, [favoriteId]);

  const progressPhaseKey = activePhaseKey ?? phases[0]?.phase_key ?? '';
  const {
    modules,
    currentModule,
    selectedModuleId,
    setSelectedModuleId,
    resourceCompletedSet,
    toggleResourceComplete,
    toggleModuleComplete,
  } = useModuleProgress(phases, progressPhaseKey, storageKey);

  const completedModuleIds = useMemo(
    () => getCompletedModuleIds(phases, resourceCompletedSet),
    [phases, resourceCompletedSet],
  );
  const currentPhaseKey = useMemo(
    () => getCurrentPhaseKey(phases, completedModuleIds) ?? phases[0]?.phase_key,
    [phases, completedModuleIds],
  );

  useEffect(() => {
    if (!workspace || !phases.length) return;
    setActivePhaseKey((prev) => {
      if (prev && phases.some((p) => p.phase_key === prev)) return prev;
      const saved = loadActivePhaseKey(storageKey);
      if (saved && phases.some((p) => p.phase_key === saved)) return saved;
      return currentPhaseKey;
    });
  }, [workspace, phases, currentPhaseKey, storageKey]);

  useEffect(
    () => () => {
      for (const timer of phaseTimersRef.current) clearTimeout(timer);
    },
    [],
  );

  const activePhaseIndex = useMemo(
    () =>
      phases.findIndex(
        (phase) => phase.phase_key === (activePhaseKey ?? currentPhaseKey),
      ),
    [phases, activePhaseKey, currentPhaseKey],
  );
  const activePhase = phases[activePhaseIndex] ?? phases[0];
  const activePhaseKeyValue = activePhaseKey ?? currentPhaseKey ?? '';
  const activePhaseProgress = useMemo(
    () =>
      activePhase
        ? getPhaseProgress(activePhase, completedModuleIds)
        : { total: 0, completed: 0, percent: 0 },
    [activePhase, completedModuleIds],
  );
  const checkedResourceUrls = useMemo(
    () => getCheckedResourceUrlsForPhase(activePhase, resourceCompletedSet),
    [activePhase, resourceCompletedSet],
  );

  const {
    reviews,
    loading: reviewLoading,
    submittingType,
    submitReview,
  } = useReviews({
    workspaceId: workspace?.workspace_id ?? '',
    activePhase: activePhase ?? makeFallbackPhase(),
    checkedResourceUrls,
    report: report ?? makeFallbackReport(),
    progress: activePhaseProgress,
  });

  const [activeResourceIndex, setActiveResourceIndex] = useState<number>();
  const [resourceDrawerOpen, setResourceDrawerOpen] = useState(false);
  const selectedModule =
    activePhase?.learning_modules.find(
      (module) => module.module_id === selectedModuleId,
    ) ?? (currentModule as API.GrowthPlanLearningModule | undefined);
  const selectedResources = useMemo<LearningResourceCard[]>(() => {
    if (!activePhase || !selectedModule) return [];
    return getModuleResources(selectedModule, activePhase.phase_key, {
      allowFallback: false,
    });
  }, [activePhase, selectedModule]);
  const activeResource =
    activeResourceIndex != null ? selectedResources[activeResourceIndex] : null;

  const handleResourceCheckToggle = useCallback(
    (index: number, checked: boolean) => {
      const resource = selectedResources[index];
      if (!resource || !activePhase || !selectedModule) return;
      toggleResourceComplete({
        phaseKey: activePhase.phase_key,
        moduleId: selectedModule.module_id,
        resource,
        resourceIndex: index,
        checked,
      });
    },
    [selectedResources, activePhase, selectedModule, toggleResourceComplete],
  );

  const handleResourceDetail = useCallback((index: number) => {
    setActiveResourceIndex(index);
    setResourceDrawerOpen(true);
  }, []);

  const handleReviewShortcut = useCallback((reviewType: 'weekly' | 'monthly') => {
    setActiveReviewType(reviewType);
    reviewSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  const handleEditPlan = useCallback(() => {
    if (!favoriteId) return;
    history.push(`/personal-growth-report?favorite_id=${favoriteId}`);
  }, [favoriteId]);

  const handlePhaseChange = useCallback(
    (nextIndex: number) => {
      const nextPhase = phases[nextIndex];
      if (!nextPhase || nextPhase.phase_key === activePhase?.phase_key) return;
      if (phaseMotionStateRef.current === 'leaving') return;
      for (const timer of phaseTimersRef.current) clearTimeout(timer);
      phaseTimersRef.current = [];

      const prefersReduced = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      const commitPhase = () => {
        setActivePhaseKey(nextPhase.phase_key);
        saveActivePhaseKey(storageKey, nextPhase.phase_key);
        setActiveResourceIndex(undefined);
        setResourceDrawerOpen(false);
      };

      if (prefersReduced) {
        commitPhase();
        return;
      }

      phaseMotionStateRef.current = 'leaving';
      phaseTimersRef.current = [
        setTimeout(() => {
          commitPhase();
          phaseMotionStateRef.current = 'entering';
        }, 200),
        setTimeout(() => {
          phaseMotionStateRef.current = 'idle';
        }, 620),
      ];
    },
    [phases, activePhase, storageKey],
  );

  const showGuidance =
    !favoriteId ||
    !preparation.hasProfile ||
    !preparation.hasLatestAnalysis ||
    !preparation.hasFavorite;

  if (loading) {
    return (
      <PageContainer>
        <div data-testid="learning-path-skeleton">
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      </PageContainer>
    );
  }

  if (error || showGuidance) {
    const messages: string[] = [];
    if (!favoriteId) {
      messages.push('请先在"职业匹配"中选择并收藏目标岗位，再进入蜗牛学习路径。');
    }
    if (!preparation.hasFavorite) {
      messages.push('当前目标岗位不存在或不属于当前账号，请先在"职业匹配"中重新收藏目标岗位。');
    }
    if (!preparation.hasProfile) {
      messages.push('请先前往"首页"补充我的资料，再生成蜗牛学习路径。');
    }
    if (!preparation.hasLatestAnalysis) {
      messages.push('请先前往"简历解析"完成 12 维解析，再生成蜗牛学习路径。');
    }

    return (
      <PageContainer>
        <Result
          status="warning"
          title="无法加载学习路径"
          subTitle={messages[0] ?? error}
          extra={
            <Space>
              <Button onClick={() => history.push('/home-v2')}>返回首页</Button>
              <Button
                type="primary"
                onClick={() => history.push('/student-competency-profile')}
              >
                前往简历解析
              </Button>
            </Space>
          }
        >
          {messages.length > 1 && (
            <div>
              {messages.map((msg) => (
                <Alert
                  key={msg}
                  message={msg}
                  type="warning"
                  showIcon
                  style={{ marginBottom: 8, textAlign: 'left' }}
                />
              ))}
            </div>
          )}
        </Result>
      </PageContainer>
    );
  }

  const reportSnapshot = report;
  const matchPercent =
    workspace?.favorite?.overall_match ?? reportSnapshot?.overall_match ?? 0;
  const currentPhaseLabel =
    activePhase?.phase_label ?? PHASE_LABELS[currentPhaseKey ?? ''];
  const heroCurrentModule =
    modules.find((module) => module.module_id === currentModule?.module_id) ??
    modules.find((module) => !module.status.done) ??
    modules[0];
  const practicePercent =
    modules.length > 0
      ? Math.round(
          (modules.filter((module) => module.status.done).length /
            Math.max(modules.length, 1)) *
            100,
        )
      : 0;
  const moduleTitle = selectedModule ? getModuleDisplayTitle(selectedModule) : '';
  const resourceCompletionId =
    activeResource && activePhase && selectedModule
      ? getResourceCompletionId(
          activePhase.phase_key,
          selectedModule.module_id,
          activeResource,
          activeResourceIndex ?? 0,
        )
      : null;
  const activeResourceChecked = resourceCompletionId
    ? resourceCompletedSet.has(resourceCompletionId)
    : false;

  return (
    <PageContainer>
      <div className={styles.page}>
        <FadeInWhenVisible>
          <div className={styles.workspaceHeader}>
            <div className={styles.workspaceTitleLine}>
              <span className={styles.workspaceTitle}>蜗牛学习路径</span>
              <span className={styles.workspaceSubtitle}>
                {workspace?.favorite?.target_title ?? reportSnapshot?.target_title}
              </span>
            </div>
            <Space wrap>
              <Button onClick={refresh}>刷新</Button>
              <Button type="primary" onClick={() => handleReviewShortcut('weekly')}>
                周检查
              </Button>
              <Button onClick={() => handleReviewShortcut('monthly')}>
                月检查
              </Button>
              <Button type="default" onClick={handleEditPlan}>
                编辑计划
              </Button>
            </Space>
          </div>
        </FadeInWhenVisible>

        <FadeInWhenVisible delay={0.1}>
          <ProCard style={{ marginBottom: 16 }}>
            <PathHero
              currentPhaseLabel={currentPhaseLabel}
              timeHorizon={activePhase?.time_horizon ?? ''}
              matchPercent={matchPercent}
              contentCompletion={activePhaseProgress.percent}
              practiceCompletion={practicePercent}
              currentModuleName={heroCurrentModule?.topic ?? ''}
              moduleCount={{
                completed: activePhaseProgress.completed,
                total: activePhaseProgress.total,
              }}
            />
            {phases.length > 0 && (
              <PhaseTimeline
                phases={phases}
                activePhaseKey={activePhaseKeyValue}
                completedModuleIds={completedModuleIds}
                onPhaseChange={handlePhaseChange}
              />
            )}
          </ProCard>
        </FadeInWhenVisible>

        <div className={styles.mainLayout}>
          <FadeInWhenVisible delay={0.15}>
            <div className={styles.leftPanel}>
              <ModuleList
                modules={modules}
                selectedModuleId={selectedModule?.module_id}
                onModuleSelect={setSelectedModuleId}
                onModuleComplete={toggleModuleComplete}
                practiceActions={activePhase?.practice_actions}
              />
            </div>
          </FadeInWhenVisible>

          <div className={styles.rightPanel}>
            <FadeInWhenVisible delay={0.2}>
              <ProCard>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>学习资源</h3>
                </div>
                <ResourceCards
                  phaseKey={activePhase?.phase_key ?? 'short_term'}
                  moduleId={selectedModule?.module_id ?? ''}
                  resources={selectedResources}
                  completedResourceIds={resourceCompletedSet}
                  onResourceCheck={handleResourceCheckToggle}
                  onResourceDetail={handleResourceDetail}
                  onResourceOpen={(resource) => {
                    if (resource.url) {
                      window.open(resource.url, '_blank', 'noopener,noreferrer');
                    }
                  }}
                />
              </ProCard>
            </FadeInWhenVisible>

            <FadeInWhenVisible delay={0.25}>
              <ProCard>
                <div ref={reviewSectionRef} data-testid="learning-review-section">
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>学习复盘</h3>
                  </div>
                  <ReviewPanel
                    workspaceId={workspace?.workspace_id ?? ''}
                    activePhase={activePhase ?? makeFallbackPhase()}
                    checkedResourceUrls={checkedResourceUrls}
                    report={reportSnapshot ?? makeFallbackReport()}
                    progress={activePhaseProgress}
                    reviews={reviews}
                    loading={reviewLoading}
                    submittingType={submittingType}
                    activeReviewType={activeReviewType}
                    onActiveReviewTypeChange={setActiveReviewType}
                    onSubmitReview={submitReview}
                  />
                </div>
              </ProCard>
            </FadeInWhenVisible>
          </div>
        </div>

        <ResourceDetail
          resource={
            activeResource ?? {
              title: '',
              url: '',
              learnWhat: '',
              whyLearn: '',
              doneWhen: '',
            }
          }
          moduleTitle={moduleTitle}
          checked={activeResourceChecked}
          open={resourceDrawerOpen}
          onClose={() => {
            setResourceDrawerOpen(false);
            setActiveResourceIndex(undefined);
          }}
          onCheckToggle={() => {
            if (activeResourceIndex == null || !activeResource) return;
            handleResourceCheckToggle(activeResourceIndex, !activeResourceChecked);
          }}
        />
      </div>
    </PageContainer>
  );
};

export default LearningPathPage;
