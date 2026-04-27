import type { UploadProps } from 'antd';

export const STORAGE_KEY = 'feature_map_student_profile_workspace_v9';
export const SNAPSHOT_VERSION = 9;
export const DEFAULT_TITLE = '简历解析';
export const DEFAULT_VALUE = '暂无补充信息';

export const ACCEPTED_EXTENSIONS = [
  '.markdown',
  '.xlsx',
  '.pptx',
  '.txt',
  '.csv',
  '.md',
  '.ppt',
  '.xml',
  '.eml',
  '.pdf',
  '.mdx',
  '.epub',
  '.msg',
  '.xls',
  '.docx',
  '.properties',
  '.doc',
  '.html',
  '.htm',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
] as const;

export const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
]);

export const PROFILE_FIELDS = [
  ['professional_skills', '专业技能', '与岗位直接相关的工具、语言、技术能力。'],
  [
    'professional_background',
    '专业背景',
    '专业方向、研究主题、岗位相关课程或背景信息。',
  ],
  ['education_requirement', '学历要求', '学历层次、专业匹配度及教育背景要求。'],
  ['teamwork', '团队协作能力', '与团队合作、配合、跨角色协作相关的能力。'],
  [
    'stress_adaptability',
    '抗压/适应能力',
    '面对变化、压力、节奏要求时的适应与稳定性。',
  ],
  ['communication', '沟通表达能力', '口头、书面、跨角色沟通和信息传达能力。'],
  ['work_experience', '工作经验', '实习、项目、兼职、实践或岗位相关经历。'],
  [
    'documentation_awareness',
    '文档规范意识',
    '文档整理、记录、规范表达和交付意识。',
  ],
  ['responsibility', '责任心/工作态度', '主动性、执行力、稳定性和结果意识。'],
  ['learning_ability', '学习能力', '快速学习、主动补齐、持续成长的能力。'],
  [
    'problem_solving',
    '分析解决问题能力',
    '发现问题、拆解问题、推动解决的能力。',
  ],
  ['other_special', '补充信息', '证书、作品、竞赛、开源或其他有价值补充。'],
] as const;

export const PROFILE_GROUPS = [
  {
    key: 'background',
    title: '基础背景',
    dimensionKeys: [
      'professional_background',
      'education_requirement',
      'work_experience',
    ],
  },
  {
    key: 'core',
    title: '核心能力',
    dimensionKeys: [
      'professional_skills',
      'learning_ability',
      'teamwork',
      'communication',
      'responsibility',
      'problem_solving',
      'stress_adaptability',
    ],
  },
  {
    key: 'supplementary',
    title: '补充信息',
    dimensionKeys: ['documentation_awareness', 'other_special'],
  },
] as const;

export const STAGE_LABEL_MAP: Record<string, string> = {
  prepare: '准备解析',
  'upload-image': '上传图片',
  'upload-document': '上传文档',
  analyze: '解析过程',
  complete: '生成结果',
  sync: '同步结果',
  error: '解析失败',
};

export type ProfileKey = (typeof PROFILE_FIELDS)[number][0];
export type UploadKind = 'image' | 'document';
export type UploadStatus = 'ready' | 'submitted' | 'error';
export type MessageStatus = 'completed' | 'streaming' | 'error';
export type MessageKind = 'chat' | 'status' | 'result';
export type WorkspaceStage = 'empty' | 'view' | 'edit';
export type WorkspaceViewState = 'empty' | 'parsing' | 'completed' | 'edit';
export type ResultTabKey = 'result' | 'comparison' | 'advice';
export type JobProfileDimensions = Record<ProfileKey, string[]>;

export type RuntimeField = {
  key: ProfileKey;
  title: string;
  description: string;
};

export type RuntimeConfig = {
  opening_statement: string;
  fallback_opening_statement: string;
  file_upload_enabled: boolean;
  file_size_limit_mb?: number;
  image_upload: { max_length?: number };
  document_upload: { max_length?: number };
  fields: Array<{ key: string; title: string; description: string }>;
};

export type WorkspaceUpload = {
  id: string;
  name: string;
  size: number;
  type: string;
  kind: UploadKind;
  status: UploadStatus;
  createdAt: string;
  file?: File;
  error?: string;
  requiresReupload?: boolean;
};

export type WorkspaceMessage = {
  id: string;
  role: 'user' | 'assistant';
  kind: MessageKind;
  content: string;
  createdAt: string;
  status: MessageStatus;
  uploads?: WorkspaceUpload[];
  stage?: string;
  progress?: number;
  assetName?: string;
};

export type WorkspaceConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: WorkspaceMessage[];
  difyConversationId?: string;
  lastMessageId?: string;
  currentProfile?: JobProfileDimensions;
};

let fallbackIdCounter = 0;

export const buildId = (prefix: string) => {
  const randomId = globalThis.crypto?.randomUUID?.().slice(0, 8);
  if (randomId) return `${prefix}_${randomId}`;

  fallbackIdCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${fallbackIdCounter.toString(36)}`;
};

export const formatTimestamp = (iso?: string) => {
  if (!iso) return '--';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
};

export const getExtension = (fileName: string) =>
  fileName.lastIndexOf('.') >= 0
    ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
    : '';

export const getUploadKind = (file: File): UploadKind | undefined => {
  const extension = getExtension(file.name);
  if (IMAGE_EXTENSIONS.has(extension) || file.type.startsWith('image/'))
    return 'image';
  if (ACCEPTED_EXTENSIONS.some((item) => item === extension)) return 'document';
  return undefined;
};

export const buildDefaultProfile = (): JobProfileDimensions =>
  Object.fromEntries(
    PROFILE_FIELDS.map(([key]) => [key, [DEFAULT_VALUE]]),
  ) as JobProfileDimensions;

export const normalizeProfile = (
  profile?: Record<string, string[]>,
): JobProfileDimensions =>
  Object.fromEntries(
    PROFILE_FIELDS.map(([key]) => {
      const values = Array.isArray(profile?.[key])
        ? Array.from(
            new Set(
              profile[key]
                .map((item) => item.trim())
                .filter(Boolean)
                .map((item) => (item === '未补充信息' ? DEFAULT_VALUE : item)),
            ),
          )
        : [];
      return [key, values.length ? values : [DEFAULT_VALUE]];
    }),
  ) as JobProfileDimensions;

export const cloneProfile = (
  profile: JobProfileDimensions,
): JobProfileDimensions => normalizeProfile(profile);

export const buildConversation = (
  conversationId?: string,
): WorkspaceConversation => {
  const now = new Date().toISOString();
  return {
    id: conversationId || buildId('conversation'),
    title: DEFAULT_TITLE,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
};

export const hasMeaningfulValues = (values?: string[]) =>
  !!values?.some((value) => value.trim() && value.trim() !== DEFAULT_VALUE);

export const hasProfileResult = (profile?: JobProfileDimensions) =>
  !!profile &&
  Object.values(profile).some((values) => hasMeaningfulValues(values));

export const appendStreamLine = (content: string, nextLine: string) => {
  const line = nextLine.trim();
  if (!line) return content;
  const lines = content
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
  if (lines[lines.length - 1] === line) return content;
  return [...lines, line].join('\n');
};

const PROCESS_COPY_BY_STAGE: Record<string, string> = {
  prepare: '已上传文件并开始解析',
  'upload-image': '正在上传图片',
  'upload-document': '正在上传文档',
  analyze: '正在提取关键信息',
  complete: '已生成解析结果',
  sync: '已同步解析结果',
  error: '解析失败',
};

export const normalizeProcessContent = (
  stage?: string,
  content?: string,
  status?: MessageStatus,
) => {
  if (status === 'error') {
    const lastLine = content
      ?.split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
      .at(-1);
    return lastLine || '解析失败';
  }

  if (stage && PROCESS_COPY_BY_STAGE[stage]) {
    return PROCESS_COPY_BY_STAGE[stage];
  }

  if (content?.trim()) {
    return content.trim();
  }

  return '处理中';
};

export const extractRequestError = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: { detail?: string } }).data;
    if (data?.detail) return data.detail;
  }
  if (typeof error === 'object' && error && 'info' in error) {
    const info = (error as { info?: { message?: string } }).info;
    if (info?.message) return info.message;
  }
  return '请求失败';
};

export const emptyLatestAnalysis = (
  message = '上传简历或补充描述后开始解析',
): API.StudentCompetencyLatestAnalysisPayload => ({
  available: false,
  message,
  comparison_dimensions: [],
  chart_series: [],
  strength_dimensions: [],
  priority_gap_dimensions: [],
  recommended_keywords: {},
  action_advices: [],
});

export const toRuntimeFields = (runtime?: RuntimeConfig): RuntimeField[] => {
  const runtimeFieldMap = new Map(
    (runtime?.fields || []).map((field) => [field.key, field]),
  );

  return PROFILE_FIELDS.map(([key, title, description]) => ({
    key,
    title: runtimeFieldMap.get(key)?.title || title,
    description: runtimeFieldMap.get(key)?.description || description,
  }));
};

export const buildUploadButtonProps = (
  beforeUpload: NonNullable<UploadProps['beforeUpload']>,
  disabled: boolean,
): UploadProps => ({
  beforeUpload,
  disabled,
  showUploadList: false,
  accept: ACCEPTED_EXTENSIONS.join(','),
  multiple: true,
});
