import { history } from '@umijs/max';

export const SNAIL_REPORT_KEY = 'snail_pending_report';
const COMPLETION_STORAGE_PREFIX = 'snail_completion_workspace_';
const RESOURCE_STORAGE_PREFIX = 'snail_resource_workspace_';
const ACTIVE_PHASE_STORAGE_PREFIX = 'snail_active_phase_workspace_';
const FAVORITE_ID_STORAGE_KEY = 'snail_favorite_id';

export type LearningPathPhaseKey = 'short_term' | 'mid_term' | 'long_term';

export type WeeklyReviewRecord = {
  id: string;
  type: 'weekly';
  created_at: string;
  has_progress: boolean;
  focus_module_id?: string;
  focus_module_title?: string;
  has_blocker: boolean;
  next_focus: string;
};

export type MonthlyReviewRecord = {
  id: string;
  type: 'monthly';
  created_at: string;
  completed_module_count: number;
  progress_delta: number;
  conclusion: 'continue' | 'strengthen' | 'advance';
  summary: string;
};

export type ReviewStore = {
  weekly: WeeklyReviewRecord[];
  monthly: MonthlyReviewRecord[];
};

export type ResourceCompletionStore = string[];

export type LearningResourceCard = {
  title: string;
  url: string;
  learnWhat: string;
  whyLearn: string;
  doneWhen: string;
  logoUrl?: string;
  logoAlt?: string;
  logoSource?: 'local' | 'fallback';
};

export const REVIEW_UPLOAD_ACCEPT =
  '.txt,.md,.markdown,.docx,.json,.csv,.xml,.html,.htm,.py,.js,.ts';

export const PHASE_LABELS: Record<LearningPathPhaseKey, string> = {
  short_term: '短期',
  mid_term: '中期',
  long_term: '长期',
};

const canUseStorage = () =>
  typeof window !== 'undefined' &&
  typeof window.localStorage !== 'undefined' &&
  typeof window.sessionStorage !== 'undefined';

export const goToSnailLearningPath = (favoriteId: number) => {
  history.push(`/snail-learning-path?favorite_id=${favoriteId}`);
};

export const buildWorkspaceStorageKey = (
  workspace?: API.PlanWorkspacePayload,
  report?: API.CareerDevelopmentMatchReport | null,
) => {
  if (workspace?.favorite?.report_id)
    return `report:${workspace.favorite.report_id}`;
  if (report?.report_id) return `report:${report.report_id}`;
  if (workspace?.favorite?.target_key)
    return `target:${workspace.favorite.target_key}`;
  if (workspace?.workspace_id) return workspace.workspace_id;
  return 'default';
};

export const loadCompletedModules = (storageKey: string): Set<string> => {
  if (!canUseStorage()) return new Set();
  try {
    const raw = window.localStorage.getItem(
      `${COMPLETION_STORAGE_PREFIX}${storageKey}`,
    );
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
};

export const saveCompletedModules = (
  storageKey: string,
  modules: Set<string>,
) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    `${COMPLETION_STORAGE_PREFIX}${storageKey}`,
    JSON.stringify(Array.from(modules)),
  );
};

export const loadCompletedResources = (storageKey: string): Set<string> => {
  if (!canUseStorage()) return new Set();
  try {
    const raw = window.localStorage.getItem(
      `${RESOURCE_STORAGE_PREFIX}${storageKey}`,
    );
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as ResourceCompletionStore);
  } catch {
    return new Set();
  }
};

export const saveCompletedResources = (
  storageKey: string,
  resources: Set<string>,
) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    `${RESOURCE_STORAGE_PREFIX}${storageKey}`,
    JSON.stringify(Array.from(resources)),
  );
};

export const loadActivePhaseKey = (
  storageKey: string,
): LearningPathPhaseKey | undefined => {
  if (!canUseStorage()) return undefined;
  try {
    return window.localStorage.getItem(
      `${ACTIVE_PHASE_STORAGE_PREFIX}${storageKey}`,
    ) as LearningPathPhaseKey | undefined;
  } catch {
    return undefined;
  }
};

export const saveActivePhaseKey = (
  storageKey: string,
  phaseKey: LearningPathPhaseKey,
) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    `${ACTIVE_PHASE_STORAGE_PREFIX}${storageKey}`,
    phaseKey,
  );
};

export const loadFavoriteId = (): number | undefined => {
  if (!canUseStorage()) return undefined;
  try {
    const raw = window.localStorage.getItem(FAVORITE_ID_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'number' && parsed > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export const saveFavoriteId = (favoriteId: number) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    FAVORITE_ID_STORAGE_KEY,
    JSON.stringify(favoriteId),
  );
};

export const getModuleDisplayTitle = (module: API.GrowthPlanLearningModule) =>
  module.topic.replace(/模块|能力提升|学习主题/g, '').trim() || module.topic;

export const getModuleDisplayDescription = (
  module: API.GrowthPlanLearningModule,
) => {
  const text = module.learning_content?.trim();
  if (!text) return '完成当前模块。';
  return text
    .replace(/围绕/g, '')
    .replace(/优先/g, '')
    .replace(/补齐/g, '完成')
    .replace(/形成/g, '产出')
    .replace(/整理成可复用/g, '整理出')
    .replace(/将/g, '')
    .replace(/推进到/g, '做到')
    .split(/[。；]/)[0]
    .trim();
};

export const getActionTaskTitle = (action: API.GrowthPlanPracticeAction) =>
  (action.title || action.description || '完成一个小任务')
    .replace(/实践动作|行动方案|行动项/g, '')
    .trim();

export const getActionTaskDescription = (
  action: API.GrowthPlanPracticeAction,
) => {
  const text = (action.description || action.title || '').trim();
  if (!text) return '做完后留下一份能展示的结果。';
  return text
    .replace(/围绕/g, '')
    .replace(/优先/g, '')
    .replace(/推进/g, '完成')
    .replace(/完成稳定的能力迁移或职位升级/g, '把这一步做实')
    .trim();
};

export const getModuleResources = (
  module: API.GrowthPlanLearningModule,
  _phaseKey?: LearningPathPhaseKey,
  _options?: {
    allowFallback?: boolean;
  },
): LearningResourceCard[] => {
  if (module.resource_recommendations?.length) {
    return module.resource_recommendations.map((item) => ({
      title: item.title || item.url,
      url: item.url,
      learnWhat: item.step_label || item.reason || '先学这个模块最核心的内容。',
      whyLearn: item.why_first || '这一步能帮你继续往下走。',
      doneWhen: item.expected_output || '能把学到的内容真正用出来。',
      logoUrl: item.logo_url,
      logoAlt: item.logo_alt,
      logoSource: item.logo_source || undefined,
    }));
  }

  if (
    module.resource_status === 'ready' ||
    module.resource_status === 'failed'
  ) {
    return [];
  }
  return [];
};

export const getResourceCompletionId = (
  phaseKey: LearningPathPhaseKey,
  moduleId: string,
  resource: LearningResourceCard,
  index: number,
) => `${phaseKey}::${moduleId}::${index}::${resource.url || resource.title}`;

export const getModuleCompletionStatus = (
  phaseKey: LearningPathPhaseKey,
  module: API.GrowthPlanLearningModule,
  resourceCompletedSet: Set<string>,
) => {
  const resources = getModuleResources(module, phaseKey, {
    allowFallback: false,
  });
  const total = resources.length;
  const completed = resources.filter((resource, index) =>
    resourceCompletedSet.has(
      getResourceCompletionId(phaseKey, module.module_id, resource, index),
    ),
  ).length;

  return {
    total,
    completed,
    done: total > 0 && completed === total,
  };
};

export const getCheckedResourceUrlsForPhase = (
  phase: API.GrowthPlanPhase | undefined,
  resourceCompletedSet: Set<string>,
) => {
  if (!phase) return [];
  const urls = phase.learning_modules.flatMap((module) =>
    getModuleResources(module, phase.phase_key, { allowFallback: false })
      .filter((resource, index) =>
        resourceCompletedSet.has(
          getResourceCompletionId(
            phase.phase_key,
            module.module_id,
            resource,
            index,
          ),
        ),
      )
      .map((resource) => resource.url),
  );
  return Array.from(new Set(urls.filter(Boolean)));
};

export const buildSnailReviewFormData = ({
  reviewType,
  phase,
  checkedResourceUrls,
  userPrompt,
  report,
  progress,
  files,
}: {
  reviewType: 'weekly' | 'monthly';
  phase: API.GrowthPlanPhase;
  checkedResourceUrls: string[];
  userPrompt: string;
  report: API.CareerDevelopmentMatchReport;
  progress: { completed: number; total: number; percent: number };
  files: File[];
}) => {
  const formData = new FormData();
  formData.append('review_type', reviewType);
  formData.append('phase_key', phase.phase_key);
  formData.append('checked_resource_urls', JSON.stringify(checkedResourceUrls));
  formData.append('user_prompt', userPrompt.trim());
  formData.append('report_snapshot', JSON.stringify(report));
  formData.append('completed_module_count', `${progress.completed}`);
  formData.append('total_module_count', `${progress.total}`);
  formData.append('phase_progress_percent', `${progress.percent}`);
  files.forEach((file) => {
    formData.append('files', file);
  });
  return formData;
};

export const getCompletedModuleIds = (
  phases: API.GrowthPlanPhase[],
  resourceCompletedSet: Set<string>,
) => {
  const completedModules = new Set<string>();

  phases.forEach((phase) => {
    phase.learning_modules.forEach((module) => {
      const status = getModuleCompletionStatus(
        phase.phase_key,
        module,
        resourceCompletedSet,
      );
      if (status.done) {
        completedModules.add(module.module_id);
      }
    });
  });

  return completedModules;
};

export const getPhaseProgress = (
  phase: API.GrowthPlanPhase,
  completedSet: Set<string>,
) => {
  const total = phase.learning_modules.length;
  const completed = phase.learning_modules.filter((item) =>
    completedSet.has(item.module_id),
  ).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percent };
};

export const getCurrentPhaseKey = (
  phases: API.GrowthPlanPhase[],
  completedSet: Set<string>,
): LearningPathPhaseKey => {
  for (const phase of phases) {
    const { total, completed } = getPhaseProgress(phase, completedSet);
    if (completed < total || total === 0) {
      return phase.phase_key;
    }
  }
  return phases[phases.length - 1]?.phase_key || 'short_term';
};
