import {
  EditOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Drawer,
  Empty,
  Grid,
  Input,
  Layout,
  Progress,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message as antdMessage,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import LatestAnalysisSection from './LatestAnalysisSection';
import {
  deleteStudentCompetencyLatestAnalysis,
  getStudentCompetencyConversation,
  getStudentCompetencyLatestAnalysis,
  getStudentCompetencyRuntime,
  streamStudentCompetencyChat,
  syncStudentCompetencyResult,
} from '@/services/ant-design-pro/api';

const { Content, Sider } = Layout;
const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const STORAGE_KEY = 'feature_map_student_profile_workspace_v4';
const DEFAULT_TITLE = '学生就业能力画像';
const DEFAULT_VALUE = '暂无明确信息';
const ACCEPTED_EXTENSIONS = [
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
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);
const PROFILE_FIELDS = [
  ['professional_skills', '专业技能/技术栈', '具体技能、工具、技术栈、方法、平台、软件或专业操作能力。'],
  ['professional_background', '专业背景', '专业、学科、知识背景或岗位偏好的教育方向。'],
  ['education_requirement', '学历要求', '学历层级、学位门槛或基础教育门槛。'],
  ['teamwork', '团队协作能力', '团队合作、跨团队配合、协同推进相关要求或表现。'],
  ['stress_adaptability', '抗压/适应能力', '压力承受、节奏适应、多任务适配或变化环境适应能力。'],
  ['communication', '沟通表达能力', '沟通、表达、汇报、协调、对接相关要求或表现。'],
  ['work_experience', '工作经验', '年限要求、实习经历、项目经历、行业经验或岗位经历。'],
  ['documentation_awareness', '文档规范意识', '文档编写、报告输出、记录沉淀、流程规范等相关能力或要求。'],
  ['responsibility', '责任心/工作态度', '责任心、认真、严谨、主动、踏实、执行力等态度要求或表现。'],
  ['learning_ability', '学习能力', '持续学习、自我更新、快速上手新知识或成长潜力。'],
  ['problem_solving', '分析解决问题能力', '定位问题、分析原因、提出方案、推动解决、优化改进。'],
  ['other_special', '其他/特殊要求', '仅承接前 11 个维度都不适合的证书、语言、出差/驻场、班次、驾照等。'],
] as const;
const STAGE_LABEL_MAP: Record<string, string> = {
  prepare: '准备中',
  'upload-image': '上传图片',
  'upload-document': '上传文档',
  analyze: '分析材料',
  complete: '生成完成',
  sync: '同步结果',
  error: '处理失败',
};

type ProfileKey = (typeof PROFILE_FIELDS)[number][0];
type UploadKind = 'image' | 'document';
type UploadStatus = 'ready' | 'error';
type MessageStatus = 'completed' | 'streaming' | 'error';
type MessageKind = 'chat' | 'status';
type JobProfileDimensions = Record<ProfileKey, string[]>;
type RuntimeConfig = {
  opening_statement: string;
  fallback_opening_statement: string;
  file_upload_enabled: boolean;
  file_size_limit_mb?: number;
  image_upload: { max_length?: number };
  document_upload: { max_length?: number };
  fields: Array<{ key: string; title: string; description: string }>;
};
type WorkspaceUpload = {
  id: string;
  name: string;
  size: number;
  type: string;
  kind: UploadKind;
  status: UploadStatus;
  createdAt: string;
  error?: string;
  requiresReupload?: boolean;
};
type WorkspaceMessage = {
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
type WorkspaceConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: WorkspaceMessage[];
  difyConversationId?: string;
  lastMessageId?: string;
  currentProfile?: JobProfileDimensions;
};
type WorkspaceSnapshot = {
  version: 4;
  conversation: WorkspaceConversation;
  composerUploads: WorkspaceUpload[];
  panelOpen: boolean;
};

const buildId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const formatTimestamp = (iso: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
const getExtension = (fileName: string) =>
  fileName.lastIndexOf('.') >= 0 ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : '';
const getUploadKind = (file: File): UploadKind | undefined => {
  const extension = getExtension(file.name);
  if (IMAGE_EXTENSIONS.has(extension) || file.type.startsWith('image/')) return 'image';
  if (ACCEPTED_EXTENSIONS.some((item) => item === extension)) return 'document';
  return undefined;
};
const buildDefaultProfile = (): JobProfileDimensions =>
  Object.fromEntries(PROFILE_FIELDS.map(([key]) => [key, [DEFAULT_VALUE]])) as JobProfileDimensions;
const normalizeProfile = (profile?: Record<string, string[]>): JobProfileDimensions =>
  Object.fromEntries(
    PROFILE_FIELDS.map(([key]) => {
      const values = Array.isArray(profile?.[key])
        ? Array.from(
            new Set(
              profile[key]
                .map((item) => item.trim())
                .filter(Boolean)
                .map((item) => (item === '无明确要求' ? DEFAULT_VALUE : item)),
            ),
          )
        : [];
      return [key, values.length ? values : [DEFAULT_VALUE]];
    }),
  ) as JobProfileDimensions;
const cloneProfile = (profile: JobProfileDimensions): JobProfileDimensions => normalizeProfile(profile);
const buildConversation = (conversationId?: string): WorkspaceConversation => {
  const now = new Date().toISOString();
  return {
    id: conversationId || buildId('conversation'),
    title: DEFAULT_TITLE,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
};
const normalizeRestoredUploads = (uploads: WorkspaceUpload[] = []) =>
  uploads.map((upload) => ({
    ...upload,
    status: 'error' as UploadStatus,
    error: '页面刷新后需要重新上传原始文件。',
    requiresReupload: true,
  }));
const loadWorkspace = (): WorkspaceSnapshot => {
  const conversation = buildConversation();
  if (typeof window === 'undefined') {
    return { version: 4, conversation, composerUploads: [], panelOpen: false };
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { version: 4, conversation, composerUploads: [], panelOpen: false };
  }
  try {
    const parsed = JSON.parse(raw) as WorkspaceSnapshot;
    if (parsed.version !== 4 || !parsed.conversation?.id) throw new Error('invalid');
    return {
      ...parsed,
      composerUploads: normalizeRestoredUploads(parsed.composerUploads),
      conversation: {
        ...parsed.conversation,
        currentProfile: parsed.conversation.currentProfile
          ? normalizeProfile(parsed.conversation.currentProfile)
          : undefined,
        messages: parsed.conversation.messages.map((item) => ({
          ...item,
          uploads: normalizeRestoredUploads(item.uploads),
        })),
      },
    };
  } catch {
    return { version: 4, conversation, composerUploads: [], panelOpen: false };
  }
};
const appendStreamLine = (content: string, nextLine: string) => {
  const line = nextLine.trim();
  if (!line) return content;
  const lines = content.split('\n').map((item) => item.trim()).filter(Boolean);
  if (lines[lines.length - 1] === line) return content;
  return [...lines, line].join('\n');
};
const buildSummary = (profile: JobProfileDimensions) =>
  `已生成学生就业能力画像，识别出 ${
    PROFILE_FIELDS.filter(([key]) => JSON.stringify(profile[key]) !== JSON.stringify([DEFAULT_VALUE])).length
  } 个有明确信息的维度。右侧结果区已同步，可继续编辑或追问完善。`;
const extractRequestError = (error: any) =>
  error?.response?.data?.detail || error?.message || '请求失败，请稍后重试。';
const emptyLatestAnalysis = (message?: string): API.StudentCompetencyLatestAnalysisPayload => ({
  available: false,
  message: message || '暂无最新画像分析。',
  comparison_dimensions: [],
  chart_series: [],
  strength_dimensions: [],
  priority_gap_dimensions: [],
  recommended_keywords: {},
  action_advices: [],
});

const StudentCompetencyProfilePage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isDesktop = screens.md ?? true;
  const initialWorkspace = useMemo(loadWorkspace, []);
  const [conversation, setConversation] = useState<WorkspaceConversation>(initialWorkspace.conversation);
  const [composerValue, setComposerValue] = useState('');
  const [composerUploads, setComposerUploads] = useState<WorkspaceUpload[]>(initialWorkspace.composerUploads);
  const [composerError, setComposerError] = useState<string>();
  const [panelOpen, setPanelOpen] = useState(initialWorkspace.panelOpen);
  const [assetDrawerOpen, setAssetDrawerOpen] = useState(false);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>();
  const [runtimeError, setRuntimeError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isResettingConversation, setIsResettingConversation] = useState(false);
  const [isLoadingLatestAnalysis, setIsLoadingLatestAnalysis] = useState(false);
  const [editorProfile, setEditorProfile] = useState<JobProfileDimensions>();
  const [tagInputs, setTagInputs] = useState<Partial<Record<ProfileKey, string>>>({});
  const [latestAnalysis, setLatestAnalysis] = useState<API.StudentCompetencyLatestAnalysisPayload>();
  const uploadFilesRef = useRef<Record<string, File>>({});
  const streamControllerRef = useRef<AbortController | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);

  const openingStatement =
    runtimeConfig?.opening_statement?.trim() ||
    runtimeConfig?.fallback_opening_statement ||
    '支持上传图片、文档或直接补充说明，在生成后于右侧 12 维结果区继续编辑与同步。';
  const runtimeFields =
    runtimeConfig?.fields?.length
      ? runtimeConfig.fields
      : PROFILE_FIELDS.map(([key, title, description]) => ({ key, title, description }));
  const readyUploads = composerUploads.filter((item) => item.status === 'ready');
  const canSubmit =
    !isSubmitting && !isResettingConversation && (composerValue.trim().length > 0 || readyUploads.length > 0);
  const currentProfile = conversation.currentProfile || buildDefaultProfile();
  const editorDirty = !!editorProfile && JSON.stringify(editorProfile) !== JSON.stringify(currentProfile);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 4, conversation, composerUploads, panelOpen } satisfies WorkspaceSnapshot),
    );
  }, [composerUploads, conversation, panelOpen]);

  useEffect(() => {
    const loadRuntime = async () => {
      try {
        const response = await getStudentCompetencyRuntime();
        setRuntimeConfig(response.data);
        setRuntimeError(undefined);
      } catch (error) {
        setRuntimeError(`Dify 运行时配置读取失败：${extractRequestError(error)}`);
      }
    };
    void loadRuntime();
  }, []);

  const resetWorkspaceState = (nextConversationId?: string) => {
    streamControllerRef.current?.abort();
    streamControllerRef.current = null;
    setIsSubmitting(false);
    setComposerValue('');
    setComposerError(undefined);
    setComposerUploads([]);
    uploadFilesRef.current = {};
    setConversation(buildConversation(nextConversationId));
    setEditorProfile(undefined);
    setTagInputs({});
    setPanelOpen(false);
    setAssetDrawerOpen(false);
  };

  const hydrateConversationFromServer = async (
    workspaceConversationId: string,
    fallbackProfile?: Record<string, string[]>,
    fallbackUpdatedAt?: string,
  ) => {
    try {
      const response = await getStudentCompetencyConversation(workspaceConversationId, {
        skipErrorHandler: true,
      });
      setConversation((current) => {
        if (current.id !== workspaceConversationId) return current;
        return {
          ...current,
          currentProfile: response.data.profile
            ? normalizeProfile(response.data.profile)
            : fallbackProfile
              ? normalizeProfile(fallbackProfile)
              : current.currentProfile,
          difyConversationId: response.data.dify_conversation_id || current.difyConversationId,
          lastMessageId: response.data.last_message_id || current.lastMessageId,
          updatedAt: response.data.updated_at || fallbackUpdatedAt || current.updatedAt,
        };
      });
    } catch {
      if (!fallbackProfile) return;
      setConversation((current) =>
        current.id !== workspaceConversationId
          ? current
          : {
              ...current,
              currentProfile: normalizeProfile(fallbackProfile),
              updatedAt: fallbackUpdatedAt || current.updatedAt,
            },
      );
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadLatestAnalysis = async () => {
      setIsLoadingLatestAnalysis(true);
      try {
        const response = await getStudentCompetencyLatestAnalysis({ skipErrorHandler: true });
        if (cancelled) return;
        const analysis = response.data;
        setLatestAnalysis(analysis);
        if (!analysis.available || !analysis.workspace_conversation_id) return;
        if (analysis.workspace_conversation_id !== conversation.id) {
          resetWorkspaceState(analysis.workspace_conversation_id);
          setPanelOpen(true);
        }
        await hydrateConversationFromServer(
          analysis.workspace_conversation_id,
          analysis.profile,
          analysis.updated_at,
        );
      } catch (error) {
        if (!cancelled) {
          setLatestAnalysis(emptyLatestAnalysis(`最新分析读取失败：${extractRequestError(error)}`));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLatestAnalysis(false);
        }
      }
    };
    void loadLatestAnalysis();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void hydrateConversationFromServer(conversation.id);
  }, [conversation.id]);

  useEffect(() => {
    if (!conversation.currentProfile) {
      setEditorProfile(undefined);
      setTagInputs({});
      return;
    }
    setEditorProfile(cloneProfile(conversation.currentProfile));
    setTagInputs({});
  }, [conversation.currentProfile]);

  useEffect(
    () => () => {
      streamControllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [conversation.messages, composerUploads.length]);

  const handleQueueUpload = (file: File) => {
    setComposerError(undefined);
    const kind = getUploadKind(file);
    if (!kind) {
      setComposerUploads((current) => [
        {
          id: buildId('upload'),
          name: file.name,
          size: file.size,
          type: file.type,
          kind: 'document',
          status: 'error',
          createdAt: new Date().toISOString(),
          error: '文件类型不在当前工作流支持范围内。',
        },
        ...current,
      ]);
      return Upload.LIST_IGNORE;
    }
    const maxLength =
      kind === 'image'
        ? runtimeConfig?.image_upload.max_length ?? 3
        : runtimeConfig?.document_upload.max_length ?? 3;
    const sameKindCount = composerUploads.filter(
      (item) => item.kind === kind && item.status === 'ready',
    ).length;
    if (sameKindCount >= maxLength) {
      setComposerUploads((current) => [
        {
          id: buildId('upload'),
          name: file.name,
          size: file.size,
          type: file.type,
          kind,
          status: 'error',
          createdAt: new Date().toISOString(),
          error: `${kind === 'image' ? '图片' : '文档'}最多上传 ${maxLength} 个。`,
        },
        ...current,
      ]);
      return Upload.LIST_IGNORE;
    }
    const sizeLimitMb = runtimeConfig?.file_size_limit_mb ?? 15;
    if (file.size > sizeLimitMb * 1024 * 1024) {
      setComposerUploads((current) => [
        {
          id: buildId('upload'),
          name: file.name,
          size: file.size,
          type: file.type,
          kind,
          status: 'error',
          createdAt: new Date().toISOString(),
          error: `文件大小超过 ${sizeLimitMb}MB。`,
        },
        ...current,
      ]);
      return Upload.LIST_IGNORE;
    }
    const uploadId = buildId('upload');
    uploadFilesRef.current[uploadId] = file;
    setComposerUploads((current) => [
      {
        id: uploadId,
        name: file.name,
        size: file.size,
        type: file.type,
        kind,
        status: 'ready',
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    return Upload.LIST_IGNORE;
  };

  const removeUpload = (uploadId: string) => {
    delete uploadFilesRef.current[uploadId];
    setComposerUploads((current) => current.filter((item) => item.id !== uploadId));
  };

  const replaceMessage = (
    current: WorkspaceConversation,
    messageId: string,
    updater: (message: WorkspaceMessage) => WorkspaceMessage,
  ): WorkspaceConversation => ({
    ...current,
    messages: current.messages.map((item) => (item.id === messageId ? updater(item) : item)),
  });

  const handleSend = async () => {
    const prompt = composerValue.trim();
    if (!prompt && readyUploads.length === 0) {
      setComposerError('请先输入需求说明，或上传至少一个待分析文件。');
      return;
    }

    setComposerError(undefined);
    const now = new Date().toISOString();
    const queuedUploads = [...readyUploads];
    const queuedFiles = Object.fromEntries(
      queuedUploads
        .map((item) => [item.id, uploadFilesRef.current[item.id]])
        .filter((entry): entry is [string, File] => !!entry[1]),
    );
    const userMessage: WorkspaceMessage = {
      id: buildId('user'),
      role: 'user',
      kind: 'chat',
      content: prompt || '上传文件并生成画像',
      createdAt: now,
      status: 'completed',
      uploads: queuedUploads,
    };
    const statusMessageId = buildId('assistant');
    const statusMessage: WorkspaceMessage = {
      id: statusMessageId,
      role: 'assistant',
      kind: 'status',
      content: '正在建立实时连接...',
      createdAt: now,
      status: 'streaming',
      stage: 'prepare',
      progress: 0,
    };

    setConversation((current) => ({
      ...current,
      title:
        current.messages.length > 0
          ? current.title
          : prompt || queuedUploads[0]?.name || current.title || DEFAULT_TITLE,
      updatedAt: now,
      messages: [...current.messages, userMessage, statusMessage],
    }));
    setComposerValue('');
    setComposerUploads((current) => current.filter((item) => item.status !== 'ready'));
    queuedUploads.forEach((item) => {
      delete uploadFilesRef.current[item.id];
    });

    const formData = new FormData();
    formData.append('workspace_conversation_id', conversation.id);
    formData.append('prompt', prompt);
    if (conversation.difyConversationId) {
      formData.append('dify_conversation_id', conversation.difyConversationId);
    }
    queuedUploads.forEach((item) => {
      const file = queuedFiles[item.id];
      if (!file) return;
      formData.append(item.kind === 'image' ? 'image_files' : 'document_files', file);
    });

    const controller = new AbortController();
    streamControllerRef.current = controller;
    setIsSubmitting(true);

    try {
      for await (const event of streamStudentCompetencyChat(formData, controller.signal)) {
        if (event.event === 'meta') {
          setConversation((current) => ({ ...current, updatedAt: event.created_at }));
          continue;
        }

        if (event.event === 'delta') {
          setConversation((current) =>
            replaceMessage(current, statusMessageId, (message) => ({
              ...message,
              status: 'streaming',
              content: appendStreamLine(message.content, event.delta),
              stage: event.stage || message.stage,
              progress: event.progress ?? message.progress,
            })),
          );
          continue;
        }

        if (event.event === 'done') {
          const createdAt = new Date().toISOString();
          setConversation((current) => {
            const withCompletedStatus = replaceMessage(current, statusMessageId, (message) => ({
              ...message,
              status: 'completed',
              stage: 'complete',
              progress: 100,
            }));

            if (event.data.output_mode === 'profile' && event.data.profile) {
              const profile = normalizeProfile(event.data.profile);
              const assetName = `学生就业能力画像-${Date.now()}.json`;
              setPanelOpen(true);
              setEditorProfile(cloneProfile(profile));
              if (event.data.latest_analysis) {
                setLatestAnalysis(event.data.latest_analysis);
              }
              return {
                ...withCompletedStatus,
                difyConversationId: event.data.dify_conversation_id || withCompletedStatus.difyConversationId,
                lastMessageId: event.data.last_message_id || withCompletedStatus.lastMessageId,
                updatedAt: createdAt,
                currentProfile: profile,
                messages: [
                  ...withCompletedStatus.messages,
                  {
                    id: buildId('assistant-summary'),
                    role: 'assistant',
                    kind: 'chat',
                    status: 'completed',
                    createdAt,
                    content: event.data.assistant_message || buildSummary(profile),
                    assetName,
                  },
                ],
              };
            }

            return {
              ...withCompletedStatus,
              difyConversationId: event.data.dify_conversation_id || withCompletedStatus.difyConversationId,
              lastMessageId: event.data.last_message_id || withCompletedStatus.lastMessageId,
              updatedAt: createdAt,
              messages: [
                ...withCompletedStatus.messages,
                {
                  id: buildId('assistant-chat'),
                  role: 'assistant',
                  kind: 'chat',
                  status: 'completed',
                  createdAt,
                  content: event.data.assistant_message,
                },
              ],
            };
          });
          continue;
        }

        if (event.event === 'error') {
          setConversation((current) =>
            replaceMessage(current, statusMessageId, (message) => ({
              ...message,
              status: 'error',
              stage: 'error',
              progress: 100,
              content: appendStreamLine(message.content, `处理失败：${event.detail}`),
            })),
          );
          antdMessage.error(event.detail);
        }
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        const detail = extractRequestError(error);
        setConversation((current) =>
          replaceMessage(current, statusMessageId, (message) => ({
            ...message,
            status: 'error',
            stage: 'error',
            progress: 100,
            content: appendStreamLine(message.content, `处理失败：${detail}`),
          })),
        );
        antdMessage.error(detail);
      }
    } finally {
      streamControllerRef.current = null;
      setIsSubmitting(false);
    }
  };

  const handleResetConversation = async () => {
    setIsResettingConversation(true);
    try {
      await deleteStudentCompetencyLatestAnalysis();
      setLatestAnalysis(emptyLatestAnalysis());
      resetWorkspaceState();
    } catch (error) {
      antdMessage.error(extractRequestError(error));
    } finally {
      setIsResettingConversation(false);
    }
  };

  const handleAddTag = (key: ProfileKey) => {
    const rawValue = tagInputs[key]?.trim();
    if (!rawValue || !editorProfile) return;
    setEditorProfile((current) => {
      if (!current) return current;
      const nextValues = current[key].filter((item) => item !== DEFAULT_VALUE);
      return {
        ...current,
        [key]: Array.from(new Set([...nextValues, rawValue])),
      };
    });
    setTagInputs((current) => ({ ...current, [key]: '' }));
  };

  const handleRemoveTag = (key: ProfileKey, tagValue: string) => {
    setEditorProfile((current) => {
      if (!current) return current;
      const nextValues = current[key].filter((item) => item !== tagValue);
      return {
        ...current,
        [key]: nextValues.length ? nextValues : [DEFAULT_VALUE],
      };
    });
  };

  const handleResetEditor = () => {
    setEditorProfile(cloneProfile(currentProfile));
    setTagInputs({});
  };

  const handleSaveProfile = async () => {
    if (!editorProfile) return;
    setIsSavingProfile(true);
    const syncingMessageId = buildId('sync');
    const syncingNow = new Date().toISOString();
    setConversation((current) => ({
      ...current,
      updatedAt: syncingNow,
      messages: [
        ...current.messages,
        {
          id: syncingMessageId,
          role: 'assistant',
          kind: 'status',
          content: '正在同步右侧 12 维结果...',
          createdAt: syncingNow,
          status: 'streaming',
          stage: 'sync',
          progress: 70,
        },
      ],
    }));

    try {
      const response = await syncStudentCompetencyResult({
        workspace_conversation_id: conversation.id,
        dify_conversation_id: conversation.difyConversationId,
        profile: editorProfile,
      });
      const nextProfile = normalizeProfile(response.data.profile);
      if (response.data.latest_analysis) {
        setLatestAnalysis(response.data.latest_analysis);
      }
      setConversation((current) => {
        const withCompletedStatus = replaceMessage(current, syncingMessageId, (message) => ({
          ...message,
          status: 'completed',
          stage: 'sync',
          progress: 100,
          content: appendStreamLine(message.content, '右侧 12 维结果已同步到云端'),
        }));
        return {
          ...withCompletedStatus,
          currentProfile: nextProfile,
          difyConversationId: response.data.dify_conversation_id || withCompletedStatus.difyConversationId,
          lastMessageId: response.data.last_message_id || withCompletedStatus.lastMessageId,
          updatedAt: new Date().toISOString(),
          messages: [
            ...withCompletedStatus.messages,
            {
              id: buildId('assistant-sync'),
              role: 'assistant',
              kind: 'chat',
              status: 'completed',
              createdAt: new Date().toISOString(),
              content: response.data.assistant_message || '已同步最新画像到云端。',
            },
          ],
        };
      });
      setEditorProfile(cloneProfile(nextProfile));
      antdMessage.success('已保存并同步到云端');
    } catch (error) {
      const detail = extractRequestError(error);
      setConversation((current) =>
        replaceMessage(current, syncingMessageId, (message) => ({
          ...message,
          status: 'error',
          stage: 'error',
          progress: 100,
          content: appendStreamLine(message.content, `同步失败：${detail}`),
        })),
      );
      antdMessage.error(detail);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const editorColumns = useMemo<ColumnsType<{ key: ProfileKey; title: string; description: string }>>(
    () => [
      {
        title: '维度',
        dataIndex: 'title',
        key: 'title',
        width: 152,
        render: (_, record) => (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Text strong>{record.title}</Text>
            <Text
              type="secondary"
              style={{ fontSize: 12, wordBreak: 'break-word', overflowWrap: 'anywhere' }}
            >
              {record.description}
            </Text>
          </Space>
        ),
      },
      {
        title: '当前值',
        key: 'values',
        render: (_, record) => {
          const values = editorProfile?.[record.key] || [DEFAULT_VALUE];
          return (
            <Space direction="vertical" size={10} style={{ width: '100%', minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  width: '100%',
                  minWidth: 0,
                }}
              >
                {values.map((value) => (
                  <Tag
                    key={`${record.key}-${value}`}
                    closable={value !== DEFAULT_VALUE}
                    style={{
                      marginInlineEnd: 0,
                      maxWidth: '100%',
                      whiteSpace: 'normal',
                      height: 'auto',
                      lineHeight: '20px',
                      paddingBlock: 2,
                    }}
                    onClose={(event) => {
                      event.preventDefault();
                      handleRemoveTag(record.key, value);
                    }}
                  >
                    <span style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{value}</span>
                  </Tag>
                ))}
              </div>
              <Space.Compact style={{ width: '100%' }}>
                <Input style={{ minWidth: 0 }}
                  placeholder="输入关键词后回车或点击添加"
                  value={tagInputs[record.key] || ''}
                  onChange={(event) =>
                    setTagInputs((current) => ({ ...current, [record.key]: event.target.value }))
                  }
                  onPressEnter={() => handleAddTag(record.key)}
                />
                <Button onClick={() => handleAddTag(record.key)}>添加</Button>
              </Space.Compact>
            </Space>
          );
        },
      },
    ],
    [editorProfile, tagInputs],
  );

  const renderMessageCard = (messageItem: WorkspaceMessage) => {
    const isUser = messageItem.role === 'user';
    const stageLabel = messageItem.stage ? STAGE_LABEL_MAP[messageItem.stage] || messageItem.stage : undefined;
    return (
      <div
        key={messageItem.id}
        style={{
          border: '1px solid #f0f0f0',
          borderRadius: 12,
          background: isUser ? '#f6ffed' : '#ffffff',
        }}
      >
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Space size={8} wrap>
              <Text strong>{isUser ? '我' : '能力画像助手'}</Text>
              {!isUser && messageItem.kind === 'status' ? <Tag color="blue">实时反馈</Tag> : null}
              {messageItem.kind === 'status' ? (
                <Tag
                  color={
                    messageItem.status === 'error'
                      ? 'error'
                      : messageItem.status === 'streaming'
                        ? 'processing'
                        : 'default'
                  }
                >
                  {messageItem.status === 'error'
                    ? '处理失败'
                    : messageItem.status === 'streaming'
                      ? '生成中'
                      : '生成完成'}
                </Tag>
              ) : null}
              {stageLabel ? <Tag>{stageLabel}</Tag> : null}
            </Space>
            <Text type="secondary">{formatTimestamp(messageItem.createdAt)}</Text>
          </div>

          {messageItem.kind === 'status' ? (
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Progress
                percent={messageItem.progress ?? 0}
                size="small"
                status={
                  messageItem.status === 'error'
                    ? 'exception'
                    : messageItem.status === 'completed'
                      ? 'success'
                      : 'active'
                }
              />
              <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{messageItem.content}</Paragraph>
            </Space>
          ) : (
            <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{messageItem.content}</Paragraph>
          )}

          {messageItem.uploads?.length ? (
            <div style={{ marginTop: 10 }}>
              <Space wrap>
                {messageItem.uploads.map((upload) => (
                  <Tag key={upload.id}>
                    {upload.kind === 'image' ? '图片' : '文档'} · {upload.name}
                  </Tag>
                ))}
              </Space>
            </div>
          ) : null}

          {messageItem.assetName ? (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 10,
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  background: '#fafafa',
                }}
              >
                <Space align="center">
                  <FileTextOutlined />
                  <div>
                    <Text strong>{messageItem.assetName}</Text>
                    <br />
                    <Text type="secondary">点击后在右侧编辑并同步 12 维结果</Text>
                  </div>
                </Space>
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => (isDesktop ? setPanelOpen(true) : setAssetDrawerOpen(true))}
                >
                  编辑结果
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const resultPanel = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Title level={5} style={{ margin: 0 }}>
            {conversation.title}
          </Title>
          <Space size={8}>
            <Tag>{conversation.messages.length} 条消息</Tag>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleResetConversation}
              disabled={isSubmitting || isResettingConversation}
              loading={isResettingConversation}
            >
              重置对话
            </Button>
            {isDesktop ? (
              <Button icon={<EditOutlined />} onClick={() => setPanelOpen((current) => !current)}>
                {panelOpen ? '收起结果区' : '展开结果区'}
              </Button>
            ) : null}
          </Space>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Title level={5} style={{ marginTop: 0 }}>
              12 维结果编辑区
            </Title>
            <Text type="secondary">支持直接编辑标签，保存后会同步到云端，并作为后续对话的最新结果。</Text>
          </div>
          <Table
            rowKey="key"
            pagination={false}
            dataSource={runtimeFields.map((field) => ({
              key: field.key as ProfileKey,
              title: field.title,
              description: field.description,
            }))}
            columns={editorColumns}
            size="small"
            tableLayout="fixed"
            style={{ width: '100%' }}
          />
        </Space>
      </div>
      <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={isSavingProfile}
            disabled={!editorDirty || isResettingConversation}
            onClick={handleSaveProfile}
          >
            保存同步
          </Button>
          <Button disabled={!editorDirty} onClick={handleResetEditor}>
            重置为当前已保存结果
          </Button>
        </Space>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Layout
        style={{
          height: isDesktop ? 720 : 'auto',
          minHeight: isDesktop ? 720 : 680,
          background: 'transparent',
          gap: 16,
        }}
      >
        <Content
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            background: '#fafafa',
            padding: 16,
            borderRadius: 18,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {conversation.title}
              </Title>
              <Text type="secondary">围绕学生材料与追问内容，持续生成并维护 12 维就业能力画像。</Text>
            </div>
            <Space wrap>
              <Tag>{conversation.messages.length} 条消息</Tag>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleResetConversation}
                disabled={isSubmitting || isResettingConversation}
                loading={isResettingConversation}
              >
                重置对话
              </Button>
              <Button
                icon={<EditOutlined />}
                onClick={() => (isDesktop ? setPanelOpen((current) => !current) : setAssetDrawerOpen(true))}
              >
                {isDesktop ? (panelOpen ? '收起结果区' : '展开结果区') : '查看结果区'}
              </Button>
            </Space>
          </div>

          {runtimeError ? (
            <Alert
              type="error"
              showIcon
              message="Dify 运行时配置读取失败"
              description={runtimeError}
              style={{ marginBottom: 12 }}
            />
          ) : null}

          <div ref={messagesViewportRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
            {conversation.messages.length === 0 ? (
              <div
                style={{
                  minHeight: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px 0',
                }}
              >
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Space direction="vertical" size={8}>
                      <Title level={2} style={{ marginBottom: 0 }}>
                        请上传简历、图片或补充说明，生成学生就业能力画像
                      </Title>
                      <Text type="secondary" style={{ fontSize: 16 }}>
                        {openingStatement}
                      </Text>
                    </Space>
                  }
                />
              </div>
            ) : (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                {conversation.messages.map(renderMessageCard)}
              </Space>
            )}
          </div>

          <div
            style={{
              flexShrink: 0,
              marginTop: 16,
              border: '1px solid #f0f0f0',
              borderRadius: 18,
              background: '#fff',
              padding: 16,
            }}
          >
            <TextArea
              placeholder="输入你想让系统整理的学生就业能力画像需求，或先上传待分析文件。"
              autoSize={{ minRows: 3, maxRows: 6 }}
              value={composerValue}
              onChange={(event) => setComposerValue(event.target.value)}
              disabled={isSubmitting || isResettingConversation}
            />

            {composerUploads.length ? (
              <div style={{ marginTop: 12 }}>
                <Space wrap>
                  {composerUploads.map((upload) => (
                    <Tag
                      key={upload.id}
                      color={upload.status === 'error' ? 'error' : upload.kind === 'image' ? 'blue' : 'default'}
                      closable
                      onClose={(event) => {
                        event.preventDefault();
                        removeUpload(upload.id);
                      }}
                    >
                      {upload.kind === 'image' ? '图片' : '文档'} · {upload.name}
                      {upload.error ? ` · ${upload.error}` : ''}
                    </Tag>
                  ))}
                </Space>
              </div>
            ) : null}

            {composerError ? (
              <Text type="danger" style={{ display: 'block', marginTop: 12 }}>
                {composerError}
              </Text>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, gap: 12, flexWrap: 'wrap' }}>
              <Upload
                accept={ACCEPTED_EXTENSIONS.join(',')}
                multiple
                showUploadList={false}
                beforeUpload={handleQueueUpload}
                disabled={isSubmitting || isResettingConversation || runtimeConfig?.file_upload_enabled === false}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 36,
                    paddingInline: 14,
                    borderRadius: 999,
                    background: '#262626',
                    color: '#fff',
                    cursor: isSubmitting || isResettingConversation ? 'not-allowed' : 'pointer',
                  }}
                >
                  <UploadOutlined />
                  上传文件
                </span>
              </Upload>
              <Button type="primary" loading={isSubmitting} disabled={!canSubmit} onClick={handleSend}>
                生成画像
              </Button>
            </div>
          </div>
        </Content>

        {isDesktop && panelOpen ? (
          <Sider width={560} theme="light" style={{ borderRadius: 18, overflow: 'hidden', background: '#fff' }}>
            {resultPanel}
          </Sider>
        ) : null}

        {!isDesktop ? (
          <Drawer
            title="12 维结果编辑区"
            placement="right"
            width="100%"
            open={assetDrawerOpen}
            onClose={() => setAssetDrawerOpen(false)}
            destroyOnClose={false}
          >
            {resultPanel}
          </Drawer>
        ) : null}
      </Layout>

      <LatestAnalysisSection analysis={latestAnalysis} loading={isLoadingLatestAnalysis} />
    </div>
  );
};

export default StudentCompetencyProfilePage;

