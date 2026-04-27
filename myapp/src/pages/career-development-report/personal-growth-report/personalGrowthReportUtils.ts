import TurndownService from 'turndown';
import { marked } from 'marked';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  hr: '---',
});

// Strikethrough: <s>, <del>, <strike> → ~~text~~
turndownService.addRule('strikethrough', {
  filter: ['s', 'del', 'strike'],
  replacement: (content) => `~~${content}~~`,
});

// Underline: no standard markdown — keep as passthrough <u> HTML
turndownService.addRule('underline', {
  filter: ['u'],
  replacement: (content) => `<u>${content}</u>`,
});

// GFM tables: <table> → pipe table
turndownService.addRule('table', {
  filter: 'table',
  replacement: (_content, node) => {
    const el = node as HTMLElement;
    const rows: string[] = [];

    el.querySelectorAll('tr').forEach((tr, rowIdx) => {
      const cells: string[] = [];
      tr.querySelectorAll('th, td').forEach((cell) => {
        cells.push((cell.textContent || '').trim());
      });
      if (!cells.length) return;
      rows.push('| ' + cells.join(' | ') + ' |');
      // Header separator after thead row
      if (rowIdx === 0 && tr.closest('thead')) {
        rows.push('| ' + cells.map(() => '---').join(' | ') + ' |');
      }
    });

    return rows.length ? '\n' + rows.join('\n') + '\n' : '';
  },
});

const TASK_CHECKED_TOKEN = 'CHECKED';
const TASK_UNCHECKED_TOKEN = 'UNCHECKED';

// Pre-process TipTap task-list HTML so turndown doesn't escape the [x]/[ ] markers
function preprocessTaskLists(html: string): string {
  return html.replace(
    /<li\s+data-type="taskItem"\s+data-checked="([^"]*)"\s*>/g,
    (_m, checked) =>
      `<li>${checked === 'true' ? TASK_CHECKED_TOKEN : TASK_UNCHECKED_TOKEN}`,
  );
}

// Post-process: replace placeholder tokens and collapse extra whitespace
function postprocessMarkdown(markdown: string): string {
  return markdown
    .replace(new RegExp(TASK_CHECKED_TOKEN, 'g'), '[x] ')
    .replace(new RegExp(TASK_UNCHECKED_TOKEN, 'g'), '[ ] ')
    .replace(/^(-) {2,}/gm, '$1 ');
}

export const htmlToMarkdown = (html: string): string => {
  const trimmed = html.trim();
  if (!trimmed) return '';
  const preprocessed = preprocessTaskLists(trimmed);
  const rawMarkdown = turndownService.turndown(preprocessed);
  return postprocessMarkdown(rawMarkdown);
};

export const markdownToHtml = (markdown: string): string => {
  const trimmed = markdown.trim();
  if (!trimmed) return '';
  return marked.parse(trimmed, { async: false }) as string;
};

export type PersonalGrowthSectionKey =
  | 'self_cognition'
  | 'career_direction_analysis'
  | 'match_assessment'
  | 'development_suggestions'
  | 'action_plan';

export type PersonalGrowthSection = {
  key: PersonalGrowthSectionKey;
  title: string;
  content: string;
  completed: boolean;
};

export type PhasePlanContent = {
  shortTerm: string;
  midTerm: string;
  longTerm: string;
};

export type PersonalGrowthReportDraft = {
  favoriteId: number;
  workspaceId?: string;
  markdown: string;
  updatedAt: string;
};

export const PERSONAL_GROWTH_DRAFT_STORAGE_PREFIX =
  'feature_map_personal_growth_report_draft_';
export const PERSONAL_GROWTH_TASK_STORAGE_PREFIX =
  'feature_map_personal_growth_report_task_';

export const PERSONAL_GROWTH_SECTION_ORDER: PersonalGrowthSectionKey[] = [
  'self_cognition',
  'career_direction_analysis',
  'match_assessment',
  'development_suggestions',
  'action_plan',
];

export const PERSONAL_GROWTH_SECTION_META: Record<
  PersonalGrowthSectionKey,
  { title: string; placeholder: string; keywords: string[] }
> = {
  self_cognition: {
    title: '自我认知',
    placeholder: '围绕兴趣、优势、性格、能力特点展开。',
    keywords: ['自我认知', '兴趣', '优势', '性格', '能力特点', '我的优势'],
  },
  career_direction_analysis: {
    title: '职业方向分析',
    placeholder: '说明适合的行业、岗位类型和发展方向。',
    keywords: [
      '职业方向分析',
      '职业方向',
      '行业方向',
      '岗位类型',
      '发展方向',
      '目标定位',
    ],
  },
  match_assessment: {
    title: '匹配度判断',
    placeholder: '说明自己和目标方向哪里匹配、哪里不足。',
    keywords: ['匹配度判断', '匹配情况', '差距分析', '职业匹配', '当前短板'],
  },
  development_suggestions: {
    title: '发展建议',
    placeholder: '说明重点提升项以及补短板方法。',
    keywords: ['发展建议', '提升建议', '补短板建议', '学习重点', '重点提升'],
  },
  action_plan: {
    title: '行动计划',
    placeholder: '请保留短期、中期、长期三个三级标题，并填写具体行动。',
    keywords: ['行动计划', '短期行动', '中期行动', '长期行动', '阶段计划'],
  },
};

const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';
const DEFAULT_REPORT_TITLE = '# 个人职业成长报告';

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const normalizeText = (value?: string) => (value || '').trim();

const normalizeHeading = (value: string) =>
  value.replace(/\s+/g, '').toLowerCase();

const buildSection = (
  key: PersonalGrowthSectionKey,
  content = '',
): PersonalGrowthSection => {
  const normalized = normalizeText(content);
  return {
    key,
    title: PERSONAL_GROWTH_SECTION_META[key].title,
    content: normalized,
    completed: Boolean(normalized),
  };
};

const findSectionKeyByHeading = (
  heading: string,
): PersonalGrowthSectionKey | undefined => {
  const normalizedHeading = normalizeHeading(heading);
  return PERSONAL_GROWTH_SECTION_ORDER.find((key) =>
    PERSONAL_GROWTH_SECTION_META[key].keywords.some((keyword) =>
      normalizedHeading.includes(normalizeHeading(keyword)),
    ),
  );
};

const stripCodeFence = (markdown: string) => {
  const text = normalizeText(markdown);
  if (!text.startsWith('```')) return text;
  const lines = text.split('\n');
  if (lines.length >= 2 && lines.at(-1)?.trim() === '```') {
    return lines.slice(1, -1).join('\n').trim();
  }
  return text;
};

export const normalizePersonalGrowthSections = (
  sections?: API.PersonalGrowthReportSection[],
): PersonalGrowthSection[] => {
  const sectionMap = new Map(
    (sections || [])
      .filter((section): section is API.PersonalGrowthReportSection =>
        Boolean(section?.key),
      )
      .map((section) => [section.key as PersonalGrowthSectionKey, section]),
  );

  return PERSONAL_GROWTH_SECTION_ORDER.map((key) =>
    buildSection(key, sectionMap.get(key)?.content || ''),
  );
};

export const buildMarkdownFromSections = (
  sections: PersonalGrowthSection[],
) => {
  const ordered = normalizePersonalGrowthSections(sections);
  const blocks = [DEFAULT_REPORT_TITLE];
  ordered.forEach((section) => {
    const content =
      section.content || PERSONAL_GROWTH_SECTION_META[section.key].placeholder;
    blocks.push(`## ${section.title}\n${content}`);
  });
  return blocks.join('\n\n').trim();
};

export const parsePersonalGrowthMarkdown = (markdown: string) => {
  const cleanedMarkdown = stripCodeFence(markdown);
  const sectionMap = new Map<PersonalGrowthSectionKey, string>();
  const matches = cleanedMarkdown.matchAll(
    /(?:^|\n)##\s+([^\n]+)\n([\s\S]*?)(?=\n##\s+|$)/g,
  );

  for (const match of matches) {
    const heading = match[1] || '';
    const content = normalizeText(match[2] || '');
    const key = findSectionKeyByHeading(heading);
    if (key && !sectionMap.has(key)) {
      sectionMap.set(key, content);
    }
  }

  const sections = PERSONAL_GROWTH_SECTION_ORDER.map((key) =>
    buildSection(key, sectionMap.get(key) || ''),
  );
  const missingSectionKeys = sections
    .filter((section) => !section.completed)
    .map((section) => section.key);

  return {
    sections,
    missingSectionKeys,
    normalizedMarkdown: buildMarkdownFromSections(sections),
  };
};

export const createPersonalGrowthReportTemplate = (
  sections?: API.PersonalGrowthReportSection[],
) => {
  const normalizedSections = normalizePersonalGrowthSections(sections);
  const actionPlanContent =
    normalizedSections.find((section) => section.key === 'action_plan')
      ?.content ||
    [
      '### 短期行动（0-3个月）',
      '- ',
      '',
      '### 中期行动（3-9个月）',
      '- ',
      '',
      '### 长期行动（9-24个月）',
      '- ',
    ]
      .join('\n')
      .trim();

  return buildMarkdownFromSections([
    buildSection(
      'self_cognition',
      normalizedSections.find((section) => section.key === 'self_cognition')
        ?.content || '请结合兴趣、优势、性格和能力特点整理。',
    ),
    buildSection(
      'career_direction_analysis',
      normalizedSections.find(
        (section) => section.key === 'career_direction_analysis',
      )?.content || '请说明适合的行业、岗位类型和发展方向。',
    ),
    buildSection(
      'match_assessment',
      normalizedSections.find((section) => section.key === 'match_assessment')
        ?.content || '请说明当前匹配项、关键差距和不足。',
    ),
    buildSection(
      'development_suggestions',
      normalizedSections.find(
        (section) => section.key === 'development_suggestions',
      )?.content || '请说明重点提升项、补短板策略和具体建议。',
    ),
    buildSection('action_plan', actionPlanContent),
  ]);
};

const parseUtcLikeDate = (value?: string) => {
  if (!value) return undefined;
  const normalized = /(?:z|[+-]\d{2}:\d{2})$/i.test(value.trim())
    ? value.trim()
    : `${value.trim()}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const formatInTimeZone = (
  value: string | undefined,
  options: Intl.DateTimeFormatOptions,
  fallback: string,
) => {
  const date = parseUtcLikeDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: SHANGHAI_TIME_ZONE,
    hour12: false,
    ...options,
  })
    .format(date)
    .replace(/\//g, '-');
};

export const formatPersonalGrowthDateTime = (value?: string) =>
  formatInTimeZone(
    value,
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    },
    '待更新',
  );

export const hasAnySectionContent = (sections: PersonalGrowthSection[]) =>
  sections.some((section) => Boolean(normalizeText(section.content)));

export const getSectionDraftStorageKey = (
  favoriteId: number,
  workspaceId?: string,
) =>
  `${PERSONAL_GROWTH_DRAFT_STORAGE_PREFIX}${favoriteId}_${workspaceId || 'pending'}`;

export const readPersonalGrowthDraft = (
  favoriteId?: number,
  workspaceId?: string,
): PersonalGrowthReportDraft | undefined => {
  if (!canUseStorage() || !favoriteId) return undefined;
  try {
    const raw = window.localStorage.getItem(
      getSectionDraftStorageKey(favoriteId, workspaceId),
    );
    if (!raw) return undefined;
    return JSON.parse(raw) as PersonalGrowthReportDraft;
  } catch {
    return undefined;
  }
};

export const savePersonalGrowthDraft = (draft: PersonalGrowthReportDraft) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    getSectionDraftStorageKey(draft.favoriteId, draft.workspaceId),
    JSON.stringify(draft),
  );
};

export const clearPersonalGrowthDraft = (
  favoriteId?: number,
  workspaceId?: string,
) => {
  if (!canUseStorage() || !favoriteId) return;
  window.localStorage.removeItem(
    getSectionDraftStorageKey(favoriteId, workspaceId),
  );
};

export const getPersonalGrowthTaskStorageKey = (favoriteId: number) =>
  `${PERSONAL_GROWTH_TASK_STORAGE_PREFIX}${favoriteId}`;

export const savePersonalGrowthTaskId = (
  favoriteId: number,
  taskId: string,
) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    getPersonalGrowthTaskStorageKey(favoriteId),
    taskId,
  );
};

export const readPersonalGrowthTaskId = (favoriteId?: number) => {
  if (!canUseStorage() || !favoriteId) return undefined;
  return (
    window.localStorage.getItem(getPersonalGrowthTaskStorageKey(favoriteId)) ||
    undefined
  );
};

export const clearPersonalGrowthTaskId = (favoriteId?: number) => {
  if (!canUseStorage() || !favoriteId) return;
  window.localStorage.removeItem(getPersonalGrowthTaskStorageKey(favoriteId));
};

export const normalizeReportMarkdown = (
  workspace?: API.PersonalGrowthReportPayload,
) =>
  workspace?.edited_markdown?.trim() ||
  workspace?.generated_markdown?.trim() ||
  '';

export const hasPersistedReportContent = (
  workspace?: API.PersonalGrowthReportPayload,
) => Boolean(normalizeReportMarkdown(workspace));
