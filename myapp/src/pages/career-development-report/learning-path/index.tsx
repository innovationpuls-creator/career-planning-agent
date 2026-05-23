import { PageContainer } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Alert, Button, Result, Space } from 'antd';
import { createStyles } from 'antd-style';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { GlassShell } from '@/components/ui';
import { claudeAlpha, claudeColors, claudeRadius } from '@/styles/claude-tokens';
import { LearningContextStrip } from './components/LearningContextStrip';
import { LearningResourceFocus } from './components/LearningResourceFocus';
import { LearningTopTools } from './components/LearningTopTools';
import { LearningWorkspaceSplit } from './components/LearningWorkspaceSplit';
import { PhaseOrbitPanel } from './components/PhaseOrbitPanel';
import { ResourceDetail } from './components/ResourceDetail';
import { ReviewWorkspacePanel } from './components/ReviewWorkspacePanel';
import { useModuleProgress } from './hooks/useModuleProgress';
import { useReviews } from './hooks/useReviews';
import { useWorkspace } from './hooks/useWorkspace';
import type {
  LearningPathPhaseKey,
  LearningResourceCard,
} from './learningPathUtils';
import {
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
  PHASE_LABELS,
  saveActivePhaseKey,
  saveFavoriteId,
} from './learningPathUtils';

const useStyles = createStyles(({ css }) => ({
  page: css`
    position: relative;
    isolation: isolate;
    width: min(100%, 1360px);
    min-height: calc(100vh - 72px);
    margin: 0 auto;
    padding: 24px 24px 96px;
    background: transparent;

    @media (max-width: 768px) {
      padding: 14px 12px 72px;
    }
  `,
  workbench: css`
    display: grid;
    grid-template-columns: minmax(280px, 0.34fr) minmax(0, 0.66fr);
    gap: 18px;
    align-items: start;

    @media (max-width: 1024px) {
      grid-template-columns: 1fr;
    }
  `,
  workspace: css`
    display: grid;
    gap: 14px;
  `,
  skeletonShell: css`
    display: grid;
    grid-template-columns: minmax(280px, 0.34fr) minmax(0, 0.66fr);
    gap: 18px;
    padding: 24px;

    @media (max-width: 1024px) {
      grid-template-columns: 1fr;
    }
  `,
  orbitSkeleton: css`
    min-height: 560px;
    border-radius: ${claudeRadius.xl}px;
    background: ${claudeAlpha(claudeColors.nearBlack, 0.86)};
  `,
  resourceSkeleton: css`
    min-height: 340px;
    border-radius: ${claudeRadius.xl}px;
    background: ${claudeAlpha(claudeColors.ivory, 0.72)};
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
  const [activeReviewType, setActiveReviewType] = useState<
    'weekly' | 'monthly'
  >('weekly');
  const [reviewWorkspaceOpen, setReviewWorkspaceOpen] = useState(false);
  const phaseMotionStateRef = useRef<'idle' | 'leaving' | 'entering'>('idle');
  const phaseTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const phases = workspace?.growth_plan_phases || [];
  const report = workspace?.favorite
    ?.report_snapshot as API.CareerDevelopmentMatchReport | null;

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
  } = useModuleProgress(phases, progressPhaseKey, storageKey);

  const completedModuleIds = useMemo(
    () => getCompletedModuleIds(phases, resourceCompletedSet),
    [phases, resourceCompletedSet],
  );
  const currentPhaseKey = useMemo(
    () =>
      getCurrentPhaseKey(phases, completedModuleIds) ?? phases[0]?.phase_key,
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

  const handleOpenReview = useCallback((reviewType: 'weekly' | 'monthly') => {
    setActiveReviewType(reviewType);
    setReviewWorkspaceOpen(true);
  }, []);

  const handleCloseReview = useCallback(() => {
    setReviewWorkspaceOpen(false);
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
      <PageContainer title={false} pageHeaderRender={false} style={{ margin: -24 }}>
        <GlassShell>
          <div
            className={styles.skeletonShell}
            data-testid="learning-path-skeleton"
          >
            <div
              className={styles.orbitSkeleton}
              data-testid="learning-path-orbit-skeleton"
            />
            <div
              className={styles.resourceSkeleton}
              data-testid="learning-path-resource-skeleton"
            />
          </div>
        </GlassShell>
      </PageContainer>
    );
  }

  if (error || showGuidance) {
    const messages: string[] = [];
    if (!favoriteId) {
      messages.push(
        '请先在"职业匹配"中选择并收藏目标岗位，再进入蜗牛学习路径。',
      );
    }
    if (!preparation.hasFavorite) {
      messages.push(
        '当前目标岗位不存在或不属于当前账号，请先在"职业匹配"中重新收藏目标岗位。',
      );
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
  const moduleTitle = selectedModule
    ? getModuleDisplayTitle(selectedModule)
    : '';
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
    <PageContainer title={false} pageHeaderRender={false} style={{ margin: -24 }}>
      <GlassShell>
        <div className={styles.page}>
          <LearningTopTools
            favoriteId={favoriteId}
            workspaceId={workspace?.workspace_id}
            activeReviewType={activeReviewType}
            reviewOpen={reviewWorkspaceOpen}
            onRefresh={refresh}
            onOpenReview={handleOpenReview}
            onEditPlan={handleEditPlan}
          />

          <div className={styles.workbench}>
            <PhaseOrbitPanel
              phases={phases}
              activePhaseKey={activePhaseKeyValue}
              completedModuleIds={completedModuleIds}
              onPhaseChange={handlePhaseChange}
            />

            <div className={styles.workspace}>
              <LearningContextStrip
                targetTitle={
                  workspace?.favorite?.target_title ??
                  reportSnapshot?.target_title
                }
                phaseLabel={currentPhaseLabel}
                timeHorizon={activePhase?.time_horizon ?? ''}
                matchPercent={matchPercent}
                phaseProgress={activePhaseProgress}
                modules={modules}
                selectedModuleId={selectedModule?.module_id}
                onModuleSelect={setSelectedModuleId}
              />

              <LearningWorkspaceSplit
                reviewOpen={reviewWorkspaceOpen}
                resourceContent={
                  <LearningResourceFocus
                    phaseKey={activePhase?.phase_key ?? 'short_term'}
                    moduleId={selectedModule?.module_id ?? ''}
                    resources={selectedResources}
                    completedResourceIds={resourceCompletedSet}
                    compact={reviewWorkspaceOpen}
                    onResourceCheck={handleResourceCheckToggle}
                    onResourceDetail={handleResourceDetail}
                    onResourceOpen={(resource) => {
                      if (resource.url) {
                        window.open(
                          resource.url,
                          '_blank',
                          'noopener,noreferrer',
                        );
                      }
                    }}
                  />
                }
                reviewContent={
                  <ReviewWorkspacePanel
                    activeReviewType={activeReviewType}
                    onActiveReviewTypeChange={setActiveReviewType}
                    activePhase={activePhase ?? makeFallbackPhase()}
                    checkedResourceUrls={checkedResourceUrls}
                    reviews={reviews}
                    loading={reviewLoading}
                    submittingType={submittingType}
                    onSubmitReview={submitReview}
                    onClose={handleCloseReview}
                  />
                }
              />
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
              handleResourceCheckToggle(
                activeResourceIndex,
                !activeResourceChecked,
              );
            }}
          />
        </div>
      </GlassShell>
    </PageContainer>
  );
};

export default LearningPathPage;
