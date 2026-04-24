import { history } from '@umijs/max';

export const SNAIL_REPORT_KEY = 'snail_pending_report';
const COMPLETION_STORAGE_PREFIX = 'snail_completion_workspace_';
const REVIEW_STORAGE_PREFIX = 'snail_review_workspace_';
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
};

export const REVIEW_UPLOAD_ACCEPT =
  '.txt,.md,.markdown,.docx,.json,.csv,.xml,.html,.htm,.py,.js,.ts';

export const PHASE_LABELS: Record<LearningPathPhaseKey, string> = {
  short_term: '短期',
  mid_term: '中期',
  long_term: '长期',
};

type ResourceEntry = {
  keywords: string[];
  items: LearningResourceCard[];
};

const PHASE_SPECIFIC_RESOURCES: Record<LearningPathPhaseKey, ResourceEntry[]> = {
  short_term: [
    {
      keywords: ['前端', 'react', 'vue', 'javascript', 'typescript', 'web'],
      items: [
        {
          title: 'MDN Web Docs',
          url: 'https://developer.mozilla.org/',
          learnWhat: '先学组件、状态和常用 API。',
          whyLearn: '基础更完整，做项目更顺手。',
          doneWhen: '能独立写出一个完整页面。',
        },
        {
          title: 'freeCodeCamp',
          url: 'https://www.freecodecamp.org/',
          learnWhat: '跟着练习做页面和交互。',
          whyLearn: '边学边做，更容易记住。',
          doneWhen: '能完成 1 个小项目练习。',
        },
        {
          title: 'TypeScript Handbook',
          url: 'https://www.typescriptlang.org/docs/',
          learnWhat: '学常用类型、接口和函数写法。',
          whyLearn: '岗位里很常见，早点学更省力。',
          doneWhen: '能给组件 props 和接口加上类型。',
        },
      ],
    },
    {
      keywords: ['数据', 'python', '分析', 'sql', '算法'],
      items: [
        {
          title: 'Kaggle Learn',
          url: 'https://www.kaggle.com/learn',
          learnWhat: '学数据清洗、分析和简单建模。',
          whyLearn: '课程短，适合快速起步。',
          doneWhen: '能跑通 1 个完整练习。',
        },
        {
          title: 'SQLBolt',
          url: 'https://sqlbolt.com/',
          learnWhat: '学查询、筛选、排序和联表。',
          whyLearn: '很多岗位都会直接用到。',
          doneWhen: '能独立写常见 SQL。',
        },
        {
          title: 'Python 官方教程',
          url: 'https://docs.python.org/3/tutorial/',
          learnWhat: '学语法、函数和常见数据结构。',
          whyLearn: '语言基础更稳，后续更好展开。',
          doneWhen: '能写出简单分析脚本。',
        },
      ],
    },
    {
      keywords: ['沟通', '表达', '协作', '汇报'],
      items: [
        {
          title: 'Coursera Communication',
          url: 'https://www.coursera.org/',
          learnWhat: '学汇报结构、沟通顺序和表达重点。',
          whyLearn: '这块补上后，简历和面试都会更顺。',
          doneWhen: '能讲清楚 1 个项目过程。',
        },
        {
          title: 'TED',
          url: 'https://www.ted.com/',
          learnWhat: '看别人怎么讲重点和故事线。',
          whyLearn: '先有感觉，再自己练会更快。',
          doneWhen: '能整理出自己的表达提纲。',
        },
        {
          title: 'Toastmasters',
          url: 'https://www.toastmasters.org/',
          learnWhat: '做公开表达和即时反馈练习。',
          whyLearn: '有人听你讲，提升更快。',
          doneWhen: '能完成 1 次完整表达练习。',
        },
      ],
    },
  ],
  mid_term: [
    {
      keywords: ['前端', 'react', 'vue', 'javascript', 'typescript', 'web'],
      items: [
        {
          title: 'Frontend Mentor',
          url: 'https://www.frontendmentor.io/',
          learnWhat: '照真实题做完整页面和交互。',
          whyLearn: '题目接近真实工作，作品可展示。',
          doneWhen: '能完成 1 个可放到简历的作品。',
        },
        {
          title: '极客时间',
          url: 'https://time.geekbang.org/',
          learnWhat: '找目标方向的实战专栏课。',
          whyLearn: '内容深入，适合做项目时参考。',
          doneWhen: '能写出 1 篇项目复盘笔记。',
        },
        {
          title: 'Udemy',
          url: 'https://www.udemy.com/',
          learnWhat: '找完整的实战项目课程。',
          whyLearn: '课程结构完整，适合系统提升。',
          doneWhen: '能独立完成课程实战项目。',
        },
      ],
    },
    {
      keywords: ['数据', 'python', '分析', 'sql', '算法'],
      items: [
        {
          title: 'Kaggle 竞赛',
          url: 'https://www.kaggle.com/competitions',
          learnWhat: '找入门级竞赛练手。',
          whyLearn: '真实数据，作品可展示。',
          doneWhen: '能完成 1 个竞赛并写复盘。',
        },
        {
          title: 'DataCamp',
          url: 'https://www.datacamp.com/',
          learnWhat: '做数据分析全流程项目。',
          whyLearn: '课程贴近实战，做完有产出。',
          doneWhen: '能完成 1 个可展示的分析报告。',
        },
        {
          title: '实验楼',
          url: 'https://www.shiyanlou.com/',
          learnWhat: '跟着做项目实验。',
          whyLearn: '边做边学，有反馈。',
          doneWhen: '能独立完成 1 个实验项目。',
        },
      ],
    },
    {
      keywords: ['沟通', '表达', '协作', '汇报'],
      items: [
        {
          title: '得到',
          url: 'https://www.dedao.cn/',
          learnWhat: '找职场沟通和汇报课程。',
          whyLearn: '适合实际工作场景。',
          doneWhen: '能在周会上做 1 次结构化汇报。',
        },
        {
          title: '知乎',
          url: 'https://www.zhihu.com/',
          learnWhat: '看实际工作场景的沟通案例。',
          whyLearn: '真实经验比理论更有用。',
          doneWhen: '能整理出 3 个可用的沟通模板。',
        },
        {
          title: 'B 站（职场区）',
          url: 'https://www.bilibili.com/',
          learnWhat: '找职场沟通和汇报案例。',
          whyLearn: '视频直观，容易理解。',
          doneWhen: '能对着案例模仿练习 1 次。',
        },
      ],
    },
  ],
  long_term: [
    {
      keywords: ['前端', 'react', 'vue', 'javascript', 'typescript', 'web'],
      items: [
        {
          title: 'LeetCode',
          url: 'https://leetcode.cn/',
          learnWhat: '刷目标岗位高频算法题。',
          whyLearn: '面试必考，决定通过率。',
          doneWhen: '能熟练写出 20 道高频题。',
        },
        {
          title: '牛客网',
          url: 'https://www.nowcoder.com/',
          learnWhat: '刷真题、看面经、模拟面试。',
          whyLearn: '覆盖多家公司真题，作品可展示。',
          doneWhen: '能完成 3 套真题并复盘。',
        },
        {
          title: '掘金',
          url: 'https://juejin.cn/',
          learnWhat: '看高级工程师的技术文章。',
          whyLearn: '了解高级岗位要求，明确升级路径。',
          doneWhen: '能写出 1 篇自己的技术总结。',
        },
      ],
    },
    {
      keywords: ['数据', 'python', '分析', 'sql', '算法'],
      items: [
        {
          title: 'LeetCode 刷题',
          url: 'https://leetcode.cn/',
          learnWhat: '刷 SQL 和算法面试题。',
          whyLearn: '面试必考，高频题要熟练。',
          doneWhen: '能快速写出 LeetCode 中等难度 SQL。',
        },
        {
          title: '牛客网',
          url: 'https://www.nowcoder.com/',
          learnWhat: '做数据分析岗位真题和模拟面试。',
          whyLearn: '覆盖多家公司真题，面试有底。',
          doneWhen: '能完成 3 套真题并复盘。',
        },
        {
          title: '知乎',
          url: 'https://www.zhihu.com/',
          learnWhat: '看行业分析和面试经验分享。',
          whyLearn: '了解目标岗位真实要求。',
          doneWhen: '能整理出目标岗位面试清单。',
        },
      ],
    },
    {
      keywords: ['沟通', '表达', '协作', '汇报'],
      items: [
        {
          title: '领英学习（LinkedIn Learning）',
          url: 'https://www.linkedin.com/learning/',
          learnWhat: '学职业规划和面试沟通技巧。',
          whyLearn: '覆盖从求职到晋升的完整路径。',
          doneWhen: '能写出完整的面试准备清单。',
        },
        {
          title: '牛客网',
          url: 'https://www.nowcoder.com/',
          learnWhat: '看真实面试经验分享。',
          whyLearn: '了解面试中考官真正关注什么。',
          doneWhen: '能模拟 1 次完整面试表达。',
        },
        {
          title: '得到',
          url: 'https://www.dedao.cn/',
          learnWhat: '学商业思维和职场进阶课。',
          whyLearn: '长期竞争力需要商业认知。',
          doneWhen: '能说出 3 个对目标岗位有价值的认知。',
        },
      ],
    },
  ],
};

const GENERAL_RESOURCES: LearningResourceCard[] = [
  {
    title: 'Coursera',
    url: 'https://www.coursera.org/',
    learnWhat: '先找和当前模块最接近的入门课。',
    whyLearn: '课程完整，适合补基础。',
    doneWhen: '完成 1 门基础课的核心内容。',
  },
  {
    title: 'edX',
    url: 'https://www.edx.org/',
    learnWhat: '找目标岗位相关课程。',
    whyLearn: '覆盖范围广，方便查漏补缺。',
    doneWhen: '能总结出 3 个关键知识点。',
  },
  {
    title: 'YouTube',
    url: 'https://www.youtube.com/',
    learnWhat: '先看 2 到 3 个短视频了解主题。',
    whyLearn: '上手快，适合先建立感觉。',
    doneWhen: '能说清这个模块在做什么。',
  },
];

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
  if (workspace?.favorite?.report_id) return `report:${workspace.favorite.report_id}`;
  if (report?.report_id) return `report:${report.report_id}`;
  if (workspace?.favorite?.target_key) return `target:${workspace.favorite.target_key}`;
  if (workspace?.workspace_id) return workspace.workspace_id;
  return 'default';
};

export const loadCompletedModules = (storageKey: string): Set<string> => {
  if (!canUseStorage()) return new Set();
  try {
    const raw = window.localStorage.getItem(`${COMPLETION_STORAGE_PREFIX}${storageKey}`);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
};

export const saveCompletedModules = (storageKey: string, modules: Set<string>) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    `${COMPLETION_STORAGE_PREFIX}${storageKey}`,
    JSON.stringify(Array.from(modules)),
  );
};

export const loadCompletedResources = (storageKey: string): Set<string> => {
  if (!canUseStorage()) return new Set();
  try {
    const raw = window.localStorage.getItem(`${RESOURCE_STORAGE_PREFIX}${storageKey}`);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as ResourceCompletionStore);
  } catch {
    return new Set();
  }
};

export const saveCompletedResources = (storageKey: string, resources: Set<string>) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    `${RESOURCE_STORAGE_PREFIX}${storageKey}`,
    JSON.stringify(Array.from(resources)),
  );
};



export const loadActivePhaseKey = (storageKey: string): LearningPathPhaseKey | undefined => {
  if (!canUseStorage()) return undefined;
  try {
    return window.localStorage.getItem(`${ACTIVE_PHASE_STORAGE_PREFIX}${storageKey}`) as LearningPathPhaseKey | undefined;
  } catch {
    return undefined;
  }
};

export const saveActivePhaseKey = (storageKey: string, phaseKey: LearningPathPhaseKey) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(`${ACTIVE_PHASE_STORAGE_PREFIX}${storageKey}`, phaseKey);
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
  window.localStorage.setItem(FAVORITE_ID_STORAGE_KEY, JSON.stringify(favoriteId));
};

export const getModuleDisplayTitle = (module: API.GrowthPlanLearningModule) =>
  module.topic.replace(/模块|能力提升|学习主题/g, '').trim() || module.topic;

export const getModuleDisplayDescription = (module: API.GrowthPlanLearningModule) => {
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

export const getActionTaskDescription = (action: API.GrowthPlanPracticeAction) => {
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
    }));
  }

  if (module.resource_status === 'ready' || module.resource_status === 'failed') {
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
  const resources = getModuleResources(module, phaseKey, { allowFallback: false });
  const total = resources.length;
  const completed = resources.filter((resource, index) =>
    resourceCompletedSet.has(getResourceCompletionId(phaseKey, module.module_id, resource, index)),
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
        resourceCompletedSet.has(getResourceCompletionId(phase.phase_key, module.module_id, resource, index)),
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
      const status = getModuleCompletionStatus(phase.phase_key, module, resourceCompletedSet);
      if (status.done) {
        completedModules.add(module.module_id);
      }
    });
  });

  return completedModules;
};

export const getPhaseProgress = (phase: API.GrowthPlanPhase, completedSet: Set<string>) => {
  const total = phase.learning_modules.length;
  const completed = phase.learning_modules.filter((item) => completedSet.has(item.module_id)).length;
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

export const getOverallProgress = (phases: API.GrowthPlanPhase[], completedSet: Set<string>) => {
  const totals = phases.reduce(
    (acc, phase) => {
      const progress = getPhaseProgress(phase, completedSet);
      return {
        total: acc.total + progress.total,
        completed: acc.completed + progress.completed,
      };
    },
    { total: 0, completed: 0 },
  );

  return {
    ...totals,
    percent: totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0,
  };
};

