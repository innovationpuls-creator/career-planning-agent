import {
  CloseCircleOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  PartitionOutlined,
  ReloadOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Graph } from '@antv/g6';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelJobTransferTask,
  createJobTransferTask,
  getJobTransferOptions,
  getJobTransferSource,
  getJobTransferTaskSnapshot,
} from '@/services/ant-design-pro/api';
import { getAccessToken } from '@/utils/authToken';

const TASK_STORAGE_KEY = 'feature_map_job_transfer_task';
const GROUP_ORDER = [
  { key: 'professional-and-threshold', label: '专业与门槛' },
  { key: 'collaboration-and-adaptation', label: '协作与适应' },
  { key: 'growth-and-professionalism', label: '成长与职业素养' },
];

const SOURCE_SUMMARY_GROUPS = [
  {
    key: 'professional-and-threshold',
    label: '专业与门槛',
    dimensions: [
      'professional_skills',
      'professional_background',
      'education_requirement',
      'work_experience',
      'other_special',
    ],
  },
  {
    key: 'collaboration-and-adaptation',
    label: '协作与适应',
    dimensions: ['teamwork', 'stress_adaptability', 'communication'],
  },
  {
    key: 'growth-and-professionalism',
    label: '成长与职业素养',
    dimensions: ['documentation_awareness', 'responsibility', 'learning_ability', 'problem_solving'],
  },
] as const;

const SOURCE_DIMENSION_LABELS = {
  professional_skills: '专业技能',
  professional_background: '专业背景',
  education_requirement: '学历要求',
  teamwork: '团队协作',
  stress_adaptability: '抗压与适应',
  communication: '沟通表达',
  work_experience: '工作经验',
  documentation_awareness: '文档规范',
  responsibility: '责任意识',
  learning_ability: '学习能力',
  problem_solving: '问题解决',
  other_special: '其他/特殊要求',
} as const;

type SourceDimensionKey = keyof typeof SOURCE_DIMENSION_LABELS;

const EMPTY_KEYWORD = '无明确要求';

type PersistedTransferState = {
  taskId?: string;
  selectedCareerId?: number;
  activeTargetId?: number;
};

const readQueryPresetJobTitle = () => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const value = new URLSearchParams(window.location.search).get('job_title')?.trim();
  return value || undefined;
};

type TransferGraphData = {
  nodes: Array<{
    id: string;
    data: {
      nodeType: 'source' | 'target';
      title: string;
      subtitle?: string;
      score?: number;
      emphasis: boolean;
    };
    style: {
      x: number;
      y: number;
    };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    data: {
      active: boolean;
      score: number;
    };
  }>;
};

const useStyles = createStyles(({ css, token }) => ({
  pageContainer: css`
    :global(.ant-pro-page-container-children-container) {
      padding-inline: 0;
      padding-block: 0;
    }
  `,
  shell: css`
    min-height: calc(100vh - 112px);
    padding: 24px;
    background:
      radial-gradient(circle at top left, rgba(22, 119, 255, 0.12), transparent 28%),
      linear-gradient(180deg, #f7fbff 0%, #ffffff 46%, #f3f8ff 100%);

    @media (max-width: 768px) {
      padding: 16px;
    }
  `,
  hero: css`
    margin-bottom: 24px;
    padding: 28px;
    border: 1px solid rgba(22, 119, 255, 0.12);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 16px 42px rgba(31, 56, 88, 0.08);
  `,
  eyebrow: css`
    display: inline-flex;
    align-items: center;
    margin-bottom: 14px;
    padding: 6px 12px;
    color: ${token.colorPrimary};
    font-size: 13px;
    font-weight: 600;
    border-radius: 999px;
    background: rgba(22, 119, 255, 0.08);
  `,
  heroTitle: css`
    margin: 0 0 12px;
    color: #12314d;
    font-size: clamp(28px, 4vw, 40px);
    line-height: 1.2;
  `,
  heroText: css`
    max-width: 820px;
    margin: 0;
    color: rgba(18, 49, 77, 0.72);
    line-height: 1.8;
  `,
  sectionCard: css`
    height: 100%;
    border: 1px solid rgba(18, 49, 77, 0.08);
    border-radius: 24px;
    box-shadow: 0 18px 40px rgba(31, 56, 88, 0.08);

    :global(.ant-card-body) {
      padding: 24px;
    }
  `,
  filterRow: css`
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1fr) auto auto;

    @media (max-width: 960px) {
      grid-template-columns: 1fr;
    }
  `,
  sourceIntro: css`
    padding: 16px 18px;
    border: 1px solid rgba(18, 49, 77, 0.08);
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(22, 119, 255, 0.06) 0%, rgba(255, 255, 255, 0.94) 100%);
  `,
  sourceSummaryGrid: css`
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(3, minmax(0, 1fr));

    @media (max-width: 960px) {
      grid-template-columns: 1fr;
    }
  `,
  sourceSummaryCard: css`
    height: 100%;
    padding: 16px;
    border: 1px solid rgba(18, 49, 77, 0.08);
    border-radius: 18px;
    background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  `,
  sourceMetrics: css`
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(3, minmax(0, 1fr));

    @media (max-width: 960px) {
      grid-template-columns: 1fr;
    }
  `,
  sourceDimensionGrid: css`
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(2, minmax(0, 1fr));

    @media (max-width: 960px) {
      grid-template-columns: 1fr;
    }
  `,
  sourceDimensionCard: css`
    padding: 14px 16px;
    border: 1px solid rgba(18, 49, 77, 0.08);
    border-radius: 16px;
    background: #fff;
  `,
  graphHeader: css`
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 18px;
  `,
  graphStage: css`
    width: 100%;
    min-height: 560px;
    border-radius: 24px;
    background:
      radial-gradient(circle at center, rgba(22, 119, 255, 0.06), transparent 42%),
      linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    border: 1px solid rgba(22, 119, 255, 0.1);
    overflow: hidden;

    @media (max-width: 992px) {
      min-height: 500px;
    }
  `,
  infoPanel: css`
    height: 100%;
    border-radius: 20px;
    background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);

    :global(.ant-card-body) {
      padding: 20px 22px;
    }
  `,
  panelTitle: css`
    margin: 0 0 8px;
    color: #12314d;
  `,
  panelText: css`
    margin: 0;
    color: rgba(18, 49, 77, 0.72);
    line-height: 1.8;
  `,
  panelSection: css`
    margin-top: 20px;
  `,
  panelLabel: css`
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
    color: #12314d;
    font-weight: 600;
  `,
  helperText: css`
    margin: 0 0 12px;
    color: rgba(18, 49, 77, 0.64);
    font-size: 13px;
    line-height: 1.7;
  `,
  metricHint: css`
    color: rgba(18, 49, 77, 0.62);
    font-size: 12px;
  `,
  comparisonSummaryGrid: css`
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(2, minmax(0, 1fr));

    @media (max-width: 992px) {
      grid-template-columns: 1fr;
    }
  `,
  comparisonSummaryCard: css`
    display: block;
    width: 100%;
    padding: 14px;
    border: 1px solid rgba(18, 49, 77, 0.08);
    border-radius: 18px;
    background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    text-align: left;
    appearance: none;
    font: inherit;
    cursor: pointer;
    transition:
      transform 180ms ease,
      box-shadow 180ms ease,
      border-color 180ms ease;

    &:hover {
      transform: translateY(-3px);
      border-color: rgba(22, 119, 255, 0.24);
      box-shadow: 0 14px 28px rgba(31, 56, 88, 0.1);
    }
  `,
  comparisonSummaryHeader: css`
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  `,
  comparisonSummaryMeta: css`
    color: rgba(18, 49, 77, 0.58);
    font-size: 12px;
  `,
  comparisonBlock: css`
    padding: 12px 14px;
    border: 1px solid rgba(18, 49, 77, 0.08);
    border-radius: 18px;
    background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  `,
  dimensionList: css`
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(2, minmax(0, 1fr));

    @media (max-width: 992px) {
      grid-template-columns: 1fr;
    }
  `,
  dimensionRow: css`
    display: grid;
    gap: 8px;
    padding: 12px;
    border-radius: 16px;
    background: rgba(245, 249, 255, 0.92);
    border: 1px solid rgba(18, 49, 77, 0.06);
  `,
  dimensionLabel: css`
    color: #12314d;
    font-weight: 600;
  `,
  dimensionSection: css`
    display: grid;
    gap: 6px;
  `,
  comparisonBackButton: css`
    padding-inline: 0;
  `,
}));

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const isAbortError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';

const getErrorStatusCode = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const maybeStatusCode = (error as any)?.response?.status ?? (error as any)?.info?.response?.status;
  return typeof maybeStatusCode === 'number' ? maybeStatusCode : undefined;
};

const readPersistedState = (): PersistedTransferState => {
  if (!canUseStorage()) {
    return {};
  }
  const raw = window.localStorage.getItem(TASK_STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as PersistedTransferState;
  } catch (_error) {
    return {};
  }
};

const writePersistedState = (state: PersistedTransferState) => {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(state));
};

const renderTagList = (items?: string[], emptyText = '暂无明确要求', limit?: number) => {
  const visibleItems = typeof limit === 'number' ? (items || []).slice(0, limit) : items;
  if (!visibleItems || visibleItems.length === 0) {
    return <Typography.Text type="secondary">{emptyText}</Typography.Text>;
  }
  return (
    <Space wrap size={[6, 6]}>
      {visibleItems.map((item) => (
        <Tag color="blue" key={item}>
          {item}
        </Tag>
      ))}
    </Space>
  );
};

const getEffectiveValues = (items?: string[]) =>
  Array.from(new Set((items || []).filter((item) => item && item !== EMPTY_KEYWORD)));

const getSourceDimensionValues = (
  source: API.JobTransferSourceSnapshot,
  dimension: SourceDimensionKey,
) => getEffectiveValues(source[dimension]);

const getSourceGroupKeywords = (
  source: API.JobTransferSourceSnapshot,
  dimensions: readonly SourceDimensionKey[],
  limit = 6,
) => {
  const merged = dimensions.flatMap((dimension) => getSourceDimensionValues(source, dimension));
  return Array.from(new Set(merged)).slice(0, limit);
};

const buildSourceIntro = (source: API.JobTransferSourceSnapshot) => {
  const titleNames = source.source_job_titles.join('、');
  const sourceCountText =
    source.source_job_titles.length > 1
      ? `这份画像来自 ${titleNames} 等 ${source.source_job_titles.length} 个原始职位标题`
      : `这份画像来自 ${titleNames} 这一原始职位标题`;
  return `${sourceCountText}，共聚合 ${source.sample_count} 条岗位样本。系统会把它们归并为“${source.job_title}”，因为这些标题在核心技能、专业背景、经验门槛和协作要求上高度重合，属于同一职业方向的不同写法或细分岗位。`;
};

const buildProgressText = (event?: Record<string, any>, status?: string) => {
  if (status === 'cancelled') {
    return '分析已取消，当前保留已生成的候选结果。';
  }
  if (!event) {
    return undefined;
  }
  switch (event.stage) {
    case 'task_created':
      return '已创建换岗路径分析任务，正在准备召回候选岗位。';
    case 'task_restored':
      return '已恢复最近一次换岗路径分析任务。';
    case 'retrieval_started':
      return '正在读取源职业的三大类向量。';
    case 'group_retrieved':
      return `已完成 ${event.processed_candidates ?? 0}/${event.total_candidates ?? 0} 个分组召回，当前累计 ${event.merged_candidate_count ?? 0} 个候选岗位。`;
    case 'candidate_ranked':
      return `正在汇总候选岗位 ${event.processed_candidates ?? 0}/${event.total_candidates ?? 0}。`;
    case 'completed':
      return `分析完成，共合并 ${event.snapshot?.payload?.meta?.merged_candidate_count ?? 0} 个候选岗位。`;
    case 'error':
      return event.detail || '换岗路径分析失败';
    default:
      return undefined;
  }
};

const isRunningStatus = (status?: string) => status === 'queued' || status === 'running';

const buildTransferGraphData = (
  payload: API.JobTransferPayload,
  width: number,
  height: number,
  activeTargetId?: number,
): TransferGraphData => {
  const centerX = width / 2;
  const centerY = height / 2;
  const sourceId = `source:${payload.source.career_id}`;
  const nodes: TransferGraphData['nodes'] = [
    {
      id: sourceId,
      data: {
        nodeType: 'source',
        title: payload.source.job_title,
        subtitle: `${payload.source.sample_count} 条样本`,
        emphasis: !activeTargetId,
      },
      style: { x: centerX, y: centerY },
    },
  ];
  const edges: TransferGraphData['edges'] = [];
  const radius = Math.min(width, height) * 0.32;

  payload.targets.forEach((target, index) => {
    const angle = (-Math.PI / 2) + ((Math.PI * 2) / Math.max(payload.targets.length, 1)) * index;
    const id = `target:${target.profile_id}`;
    nodes.push({
      id,
      data: {
        nodeType: 'target',
        title: target.job_title,
        subtitle: `${target.industry} / ${target.company_name}`,
        score: target.weighted_similarity_score,
        emphasis: target.profile_id === activeTargetId,
      },
      style: {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      },
    });
    edges.push({
      id: `${sourceId}-${id}`,
      source: sourceId,
      target: id,
      data: {
        active: !activeTargetId || target.profile_id === activeTargetId,
        score: target.weighted_similarity_score,
      },
    });
  });

  return { nodes, edges };
};

const safelyDestroyGraph = (graph?: Graph | null) => {
  if (!graph) {
    return;
  }
  try {
    graph.destroy();
  } catch (_error) {
    // Ignore G6 internal destroy errors to keep the page recoverable.
  }
};

const TransferJobProfilePage: React.FC = () => {
  const { styles } = useStyles();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const persistedStateRef = useRef<PersistedTransferState>(readPersistedState());
  const queryPresetJobTitleRef = useRef<string | undefined>(readQueryPresetJobTitle());
  const streamAbortRef = useRef<AbortController | null>(null);
  const initialRestoreTaskIdRef = useRef<string | undefined>(
    queryPresetJobTitleRef.current ? undefined : persistedStateRef.current.taskId,
  );

  const [options, setOptions] = useState<API.JobTransferOptionItem[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingResult, setLoadingResult] = useState(false);
  const [restoringTask, setRestoringTask] = useState(false);
  const [error, setError] = useState<string>();
  const [prefillNotice, setPrefillNotice] = useState<string>();
  const [selectedCareerId, setSelectedCareerId] = useState<number | undefined>(
    queryPresetJobTitleRef.current ? undefined : persistedStateRef.current.selectedCareerId,
  );
  const [taskId, setTaskId] = useState<string | undefined>(
    queryPresetJobTitleRef.current ? undefined : persistedStateRef.current.taskId,
  );
  const [taskStatus, setTaskStatus] = useState<string>();
  const [payload, setPayload] = useState<API.JobTransferPayload>();
  const [progressEvent, setProgressEvent] = useState<Record<string, any>>();
  const [sourceSnapshot, setSourceSnapshot] = useState<API.JobTransferSourceSnapshot>();
  const [loadingSource, setLoadingSource] = useState(false);
  const [sourceError, setSourceError] = useState<string>();
  const [showSourceDetails, setShowSourceDetails] = useState(false);
  const [activeGroupKey, setActiveGroupKey] = useState<string>();
  const [activeTargetId, setActiveTargetId] = useState<number | undefined>(
    queryPresetJobTitleRef.current ? undefined : persistedStateRef.current.activeTargetId,
  );

  const syncPersistedState = (partial: Partial<PersistedTransferState>) => {
    persistedStateRef.current = {
      ...persistedStateRef.current,
      ...partial,
    };
    writePersistedState(persistedStateRef.current);
  };

  const clearPersistedTaskState = () => {
    persistedStateRef.current = {
      ...persistedStateRef.current,
      taskId: undefined,
      activeTargetId: undefined,
    };
    writePersistedState(persistedStateRef.current);
    setTaskId(undefined);
    setTaskStatus(undefined);
    setPayload(undefined);
    setProgressEvent(undefined);
    setActiveTargetId(undefined);
    setActiveGroupKey(undefined);
  };

  const stopStream = () => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
  };

  const clearCurrentAnalysis = () => {
    stopStream();
    setTaskId(undefined);
    setTaskStatus(undefined);
    setPayload(undefined);
    setProgressEvent(undefined);
    setActiveTargetId(undefined);
    setActiveGroupKey(undefined);
    syncPersistedState({
      taskId: undefined,
      activeTargetId: undefined,
    });
  };

  const hydrateFromSnapshot = (snapshot: API.JobTransferTaskSnapshot) => {
    setTaskId(snapshot.task_id);
    setTaskStatus(snapshot.status);
    setPayload(snapshot.payload);
    setProgressEvent(snapshot.latest_event);
    if (snapshot.payload?.source) {
      setSourceSnapshot(snapshot.payload.source);
      setSourceError(undefined);
    }
    const nextActiveTargetId =
      persistedStateRef.current.activeTargetId &&
      snapshot.payload?.targets.some((item) => item.profile_id === persistedStateRef.current.activeTargetId)
        ? persistedStateRef.current.activeTargetId
        : snapshot.payload?.targets[0]?.profile_id;
    setActiveTargetId(nextActiveTargetId);
    syncPersistedState({
      taskId: snapshot.task_id,
      activeTargetId: nextActiveTargetId,
    });
  };

  const subscribeTaskStream = async (nextTaskId: string) => {
    stopStream();
    const controller = new AbortController();
    streamAbortRef.current = controller;
    const token = getAccessToken();
    const response = await fetch(`/api/job-transfer/tasks/${nextTaskId}/stream`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/x-ndjson',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok || !response.body) {
      throw new Error(`Response status:${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        const event = JSON.parse(trimmed);
        setProgressEvent(event);
        if (event.snapshot) {
          hydrateFromSnapshot(event.snapshot);
        }
        if (event.stage === 'error') {
          throw new Error(event.detail || '换岗路径查询失败');
        }
      }
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoadingOptions(true);
      setError(undefined);
      try {
        const response = await getJobTransferOptions();
        const items = response.data.items || [];
        setOptions(items);
        if (queryPresetJobTitleRef.current) {
          const matched = items.find(
            (item) =>
              item.job_title.trim() === queryPresetJobTitleRef.current ||
              item.label.trim() === queryPresetJobTitleRef.current,
          );
          setTaskId(undefined);
          setTaskStatus(undefined);
          setPayload(undefined);
          setProgressEvent(undefined);
          setActiveTargetId(undefined);
          if (matched) {
            setSelectedCareerId(matched.career_id);
            syncPersistedState({
              selectedCareerId: matched.career_id,
              taskId: undefined,
              activeTargetId: undefined,
            });
            setPrefillNotice(`已按“${queryPresetJobTitleRef.current}”预填标准职业，你可以确认后再开始分析。`);
          } else {
            syncPersistedState({
              selectedCareerId: undefined,
              taskId: undefined,
              activeTargetId: undefined,
            });
            setPrefillNotice(`未找到与“${queryPresetJobTitleRef.current}”完全匹配的标准职业，请手动选择。`);
          }
        }
      } catch (requestError) {
        if (!isAbortError(requestError)) {
          setError((requestError as Error).message || '换岗路径选项加载失败');
        }
      } finally {
        setLoadingOptions(false);
      }
    };
    void load();
    return () => {
      stopStream();
      safelyDestroyGraph(graphRef.current);
      graphRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (loadingOptions || !initialRestoreTaskIdRef.current || taskId !== initialRestoreTaskIdRef.current) {
      return;
    }
    initialRestoreTaskIdRef.current = undefined;
    const restore = async () => {
      setRestoringTask(true);
      try {
        const response = await getJobTransferTaskSnapshot(taskId);
        hydrateFromSnapshot(response.data);
        if (isRunningStatus(response.data.status)) {
          setLoadingResult(true);
          await subscribeTaskStream(taskId);
        }
      } catch (requestError) {
        if (getErrorStatusCode(requestError) === 404) {
          clearPersistedTaskState();
          return;
        }
        setError((requestError as Error).message || '换岗路径恢复失败');
      } finally {
        setLoadingResult(false);
        setRestoringTask(false);
      }
    };
    void restore();
  }, [loadingOptions, taskId]);

  useEffect(() => {
    if (!selectedCareerId) {
      setSourceSnapshot(undefined);
      setSourceError(undefined);
      setLoadingSource(false);
      setShowSourceDetails(false);
      return;
    }

    let active = true;
    setLoadingSource(true);
    setSourceError(undefined);
    setShowSourceDetails(false);

    void getJobTransferSource(selectedCareerId)
      .then((response) => {
        if (!active) {
          return;
        }
        setSourceSnapshot(response.data);
      })
      .catch((requestError) => {
        if (!active || isAbortError(requestError)) {
          return;
        }
        setSourceSnapshot(undefined);
        setSourceError((requestError as Error).message || '源职业画像加载失败');
      })
      .finally(() => {
        if (active) {
          setLoadingSource(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedCareerId]);

  const selectedSource = useMemo(
    () => options.find((item) => item.career_id === selectedCareerId),
    [options, selectedCareerId],
  );

  const currentSourceSnapshot = useMemo(
    () =>
      payload?.source && payload.source.career_id === selectedCareerId ? payload.source : sourceSnapshot,
    [payload, selectedCareerId, sourceSnapshot],
  );

  const activeComparison = useMemo(
    () => payload?.comparisons.find((item) => item.target_profile_id === activeTargetId),
    [activeTargetId, payload],
  );

  const activeTarget = useMemo(
    () => payload?.targets.find((item) => item.profile_id === activeTargetId),
    [activeTargetId, payload],
  );

  const groupedRows = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({
        ...group,
        rows: activeComparison?.rows.filter((row) => row.group_key === group.key) || [],
      })).filter((group) => group.rows.length > 0),
    [activeComparison],
  );

  const activeGroup = useMemo(
    () => groupedRows.find((group) => group.key === activeGroupKey),
    [activeGroupKey, groupedRows],
  );

  useEffect(() => {
    setActiveGroupKey(undefined);
  }, [activeComparison?.target_profile_id]);

  const progressPercent =
    progressEvent?.total_candidates && progressEvent?.processed_candidates
      ? Math.min(100, Math.round((progressEvent.processed_candidates / progressEvent.total_candidates) * 100))
      : undefined;

  const renderComparisonRows = (
    rows: API.JobTransferComparisonRow[],
    previewLimit?: number,
  ) => (
    <div className={styles.dimensionList}>
      {rows.map((row) => (
        <div className={styles.dimensionRow} key={row.key}>
          <Typography.Text className={styles.dimensionLabel}>{row.label}</Typography.Text>
          <div className={styles.dimensionSection}>
            <Typography.Text type="secondary">源职业共相</Typography.Text>
            {renderTagList(row.source_values, '暂无明确要求', previewLimit)}
          </div>
          <div className={styles.dimensionSection}>
            <Typography.Text type="secondary">目标岗位画像</Typography.Text>
            {renderTagList(row.target_values, '暂无明确要求', previewLimit)}
          </div>
        </div>
      ))}
    </div>
  );

  const handleQuery = async () => {
    if (!selectedSource) {
      return;
    }
    setLoadingResult(true);
    setError(undefined);
    setTaskStatus('queued');
    setPayload(undefined);
    setProgressEvent(undefined);
    setActiveTargetId(undefined);
    syncPersistedState({
      selectedCareerId,
      activeTargetId: undefined,
    });

    try {
      const created = await createJobTransferTask(selectedSource.career_id);
      const nextTaskId = created.data.task_id;
      setTaskId(nextTaskId);
      initialRestoreTaskIdRef.current = undefined;
      syncPersistedState({
        taskId: nextTaskId,
        selectedCareerId,
      });
      await subscribeTaskStream(nextTaskId);
    } catch (requestError) {
      setPayload(undefined);
      setTaskStatus(undefined);
      setError((requestError as Error).message || '换岗路径查询失败');
    } finally {
      setLoadingResult(false);
    }
  };

  const handleCancel = async () => {
    if (!taskId || !isRunningStatus(taskStatus)) {
      return;
    }
    stopStream();
    try {
      const response = await cancelJobTransferTask(taskId);
      hydrateFromSnapshot(response.data);
      setTaskStatus(response.data.status);
    } catch (requestError) {
      setError((requestError as Error).message || '取消分析失败');
    } finally {
      setLoadingResult(false);
    }
  };

  useEffect(() => {
    if (!containerRef.current || !payload || !payload.targets.length) {
      return undefined;
    }

    const width = containerRef.current.clientWidth || 960;
    const height = width < 900 ? 500 : 620;
    const graphData = buildTransferGraphData(payload, width, height, activeTargetId);

    if (graphRef.current) {
      graphRef.current.setData(graphData);
      void graphRef.current.draw();
      return undefined;
    }

    const graph = new Graph({
      container: containerRef.current,
      width,
      height,
      autoFit: 'view',
      data: graphData,
      animation: false,
      behaviors: [{ type: 'hover-activate', degree: 0, state: 'active', animation: false }],
      node: {
        type: 'circle',
        style: {
          size: (datum: any) => {
            if (datum.data.nodeType === 'source') {
              return 132;
            }
            const base = 72 + Math.round((datum.data.score || 0) * 28);
            return datum.data.emphasis ? base + 8 : base;
          },
          fill: (datum: any) => (datum.data.nodeType === 'source' ? '#e6f4ff' : '#ffffff'),
          stroke: (datum: any) => {
            if (datum.data.nodeType === 'source') return '#1677ff';
            return datum.data.emphasis ? '#1677ff' : '#91caff';
          },
          lineWidth: (datum: any) => (datum.data.emphasis ? 5 : 3),
          shadowColor: 'rgba(22, 119, 255, 0.18)',
          shadowBlur: (datum: any) => (datum.data.emphasis ? 24 : 12),
          labelText: (datum: any) => datum.data.title,
          labelPlacement: 'bottom',
          labelOffsetY: 14,
          labelBackground: true,
          labelBackgroundFill: 'rgba(255,255,255,0.96)',
          labelBackgroundRadius: 8,
          labelPadding: [6, 10],
          labelMaxWidth: 150,
          labelWordWrap: true,
          labelWordWrapWidth: 150,
          labelFill: '#12314d',
          labelFontSize: (datum: any) => (datum.data.nodeType === 'source' ? 18 : 14),
          labelFontWeight: (datum: any) => (datum.data.nodeType === 'source' ? 700 : 600),
        },
        state: {
          active: {
            halo: true,
            haloLineWidth: 14,
            haloStroke: '#69b1ff',
            haloStrokeOpacity: 0.24,
            shadowBlur: 22,
            shadowColor: 'rgba(22, 119, 255, 0.24)',
            lineWidth: 4,
          },
        },
      },
      edge: {
        type: 'line',
        style: {
          stroke: (datum: any) => (datum.data.active ? '#69b1ff' : '#d6e4ff'),
          lineWidth: (datum: any) => 2 + datum.data.score * 4,
          strokeOpacity: (datum: any) => (datum.data.active ? 0.95 : 0.72),
          endArrow: true,
          endArrowFill: (datum: any) => (datum.data.active ? '#69b1ff' : '#d6e4ff'),
        },
      },
    });

    graph.on('node:click', (event: any) => {
      const nodeId = event?.target?.id as string | undefined;
      if (!nodeId || !nodeId.startsWith('target:')) {
        return;
      }
      const nextTargetId = Number(nodeId.replace('target:', ''));
      setActiveTargetId(nextTargetId);
      syncPersistedState({ activeTargetId: nextTargetId });
    });
    graph.on('node:mouseenter', (event: any) => {
      const nodeId = event?.target?.id as string | undefined;
      containerRef.current?.style.setProperty('cursor', nodeId?.startsWith('target:') ? 'pointer' : 'default');
    });
    graph.on('node:mouseleave', () => {
      containerRef.current?.style.setProperty('cursor', 'default');
    });

    void graph.render();
    graphRef.current = graph;

    return () => {
      if (containerRef.current) {
        containerRef.current.style.cursor = 'default';
      }
      safelyDestroyGraph(graph);
      graphRef.current = null;
    };
  }, [activeTargetId, payload]);

  return (
    <PageContainer className={styles.pageContainer} title={false} breadcrumb={undefined}>
      <div className={styles.shell}>
        <div className={styles.hero}>
          <div className={styles.eyebrow}>
            <SwapOutlined style={{ marginRight: 8 }} />
            换岗路径图谱
          </div>
          <h1 className={styles.heroTitle}>从职业共相出发，找到最接近的下一步路径</h1>
          <p className={styles.heroText}>
            现在的分析入口不再依赖公司与行业，而是先从标准职业的 12 维共相出发，再把最接近的目标岗位组织成一张路径图谱，帮助你先看方向，再看解释。
          </p>
        </div>

        {error ? (
          <Alert
            closable
            showIcon
            type="error"
            message="换岗路径加载失败"
            description={error}
            style={{ marginBottom: 16 }}
            onClose={() => setError(undefined)}
          />
        ) : null}

        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Card className={styles.sectionCard} title="选择标准职业">
              {loadingOptions ? (
                <Spin />
              ) : (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div className={styles.filterRow}>
                    <Select
                      id="career_id"
                      showSearch
                      placeholder="请选择标准职业"
                      options={options.map((item) => ({
                        label: item.label,
                        value: item.career_id,
                      }))}
                      value={selectedCareerId}
                      onChange={(value) => {
                        const nextValue = value ? Number(value) : undefined;
                        const shouldResetAnalysis = nextValue !== selectedCareerId;
                        setPrefillNotice(undefined);
                        setSelectedCareerId(nextValue);
                        if (shouldResetAnalysis) {
                          clearCurrentAnalysis();
                        }
                        syncPersistedState({ selectedCareerId: nextValue });
                      }}
                    />
                    <Button
                      type="primary"
                      icon={<ReloadOutlined />}
                      disabled={!selectedSource}
                      loading={loadingResult}
                      onClick={() => void handleQuery()}
                    >
                      查询路径
                    </Button>
                    <Button
                      danger
                      icon={<CloseCircleOutlined />}
                      disabled={!taskId || !isRunningStatus(taskStatus)}
                      onClick={() => void handleCancel()}
                    >
                      取消分析
                    </Button>
                  </div>
                  <Typography.Text type="secondary">
                    只需选择标准职业，系统会自动读取对应职业画像并完成候选路径分析。
                  </Typography.Text>
                  {prefillNotice ? <Alert showIcon type="info" message={prefillNotice} /> : null}
                  {(loadingResult || restoringTask || taskStatus) && progressEvent ? (
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <Typography.Text>{buildProgressText(progressEvent, taskStatus)}</Typography.Text>
                      {progressPercent ? <Progress percent={progressPercent} size="small" /> : null}
                    </Space>
                  ) : null}
                  {taskStatus === 'cancelled' ? (
                    <Alert showIcon type="warning" message="分析已取消，可继续查看当前已生成内容。" />
                  ) : null}
                </Space>
              )}
            </Card>
          </Col>

          <Col xs={24}>
            <Card className={styles.sectionCard} title="源职业画像摘要">
              {!selectedCareerId ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="先选择标准职业，系统会自动展示对应的源职业画像摘要。" />
              ) : loadingSource && !currentSourceSnapshot ? (
                <Spin />
              ) : sourceError ? (
                <Alert showIcon type="warning" message={sourceError} />
              ) : currentSourceSnapshot ? (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div className={styles.sourceIntro} data-testid="source-profile-card">
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <Space wrap>
                        <Tag color="blue">{currentSourceSnapshot.job_title}</Tag>
                        <Tag color="cyan">来源职位 {currentSourceSnapshot.source_job_titles.length} 个</Tag>
                        <Tag color="geekblue">样本 {currentSourceSnapshot.sample_count} 条</Tag>
                      </Space>
                      <Typography.Text>{buildSourceIntro(currentSourceSnapshot)}</Typography.Text>
                    </Space>
                  </div>

                  <div className={styles.sourceMetrics}>
                    <Statistic title="来源职位标题数" value={currentSourceSnapshot.source_job_titles.length} suffix="个" />
                    <Statistic title="聚合岗位样本" value={currentSourceSnapshot.sample_count} suffix="条" />
                    <Statistic
                      title="已激活分组"
                      value={currentSourceSnapshot.group_weights.filter((item) => item.weight > 0).length}
                      suffix="组"
                    />
                  </div>

                  <div className={styles.sourceSummaryGrid}>
                    {SOURCE_SUMMARY_GROUPS.map((group) => {
                      const weightItem = currentSourceSnapshot.group_weights.find((item) => item.group_key === group.key);
                      const keywords = getSourceGroupKeywords(currentSourceSnapshot, group.dimensions);
                      return (
                        <div className={styles.sourceSummaryCard} key={group.key}>
                          <Space direction="vertical" size={10} style={{ width: '100%' }}>
                            <Space wrap>
                              <Typography.Text strong>{group.label}</Typography.Text>
                              {weightItem ? (
                                <Tag color="processing">
                                  权重 {(weightItem.weight * 100).toFixed(1)}% / 覆盖 {(weightItem.coverage_ratio * 100).toFixed(1)}%
                                </Tag>
                              ) : null}
                            </Space>
                            {keywords.length > 0 ? renderTagList(keywords, '暂无明确要求') : renderTagList([], '暂无明确要求')}
                          </Space>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    type="link"
                    style={{ paddingInline: 0, width: 'fit-content' }}
                    data-testid="source-profile-toggle"
                    onClick={() => setShowSourceDetails((value) => !value)}
                  >
                    {showSourceDetails ? '收起 12 维职业画像' : '展开 12 维职业画像'}
                  </Button>

                  {showSourceDetails ? (
                    <div className={styles.sourceDimensionGrid} data-testid="source-profile-details">
                      {(Object.entries(SOURCE_DIMENSION_LABELS) as [SourceDimensionKey, string][]).map(
                        ([dimension, label]) => (
                        <div className={styles.sourceDimensionCard} key={dimension}>
                          <Space direction="vertical" size={8} style={{ width: '100%' }}>
                            <Typography.Text strong>{label}</Typography.Text>
                            {renderTagList(getSourceDimensionValues(currentSourceSnapshot, dimension))}
                          </Space>
                        </div>
                      ),
                      )}
                    </div>
                  ) : null}
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前标准职业暂无可展示的职业画像摘要。" />
              )}
            </Card>
          </Col>

          <Col xs={24}>
            <Card className={styles.sectionCard}>
              <div className={styles.graphHeader}>
                <div>
                  <Typography.Title level={3} style={{ margin: 0, color: '#12314d' }}>
                    Top 路径图谱
                  </Typography.Title>
                  <Typography.Paragraph style={{ margin: '8px 0 0', color: 'rgba(18, 49, 77, 0.72)', lineHeight: 1.8 }}>
                    用一张图先看源职业与推荐路径的距离，再在右侧查看当前选中路径的相似度摘要和 12 维对比。
                  </Typography.Paragraph>
                </div>
                <Space wrap>
                  <Tag color="blue">最终路径 {payload?.targets.length || 0} 条</Tag>
                  <Tag color="cyan">点击节点切换解释层</Tag>
                </Space>
              </div>

              {!payload && !loadingResult && !restoringTask ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="先选择标准职业，再开始查询。" />
              ) : payload && payload.targets.length === 0 && !isRunningStatus(taskStatus) ? (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Statistic title="最终路径数" value={0} suffix="条" />
                  <Alert showIcon type="warning" message="当前没有找到可展示的换岗路径。" />
                </Space>
              ) : (
                <Row gutter={[20, 20]}>
                  <Col xs={24} xl={13}>
                    {payload?.targets.length ? (
                      <div className={styles.graphStage} data-testid="transfer-graph-stage">
                        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
                      </div>
                    ) : (
                      <div className={styles.graphStage}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
                          <Spin size="large" />
                        </div>
                      </div>
                    )}
                  </Col>
                  <Col xs={24} xl={11}>
                    <Card className={styles.infoPanel}>
                      {!payload || !activeComparison || !activeTarget ? (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={
                            isRunningStatus(taskStatus)
                              ? buildProgressText(progressEvent, taskStatus) || '正在生成 12 维对比表'
                              : taskStatus === 'cancelled'
                                ? '分析已取消，可继续查看已生成结果'
                                : '查询后将显示当前路径详情'
                          }
                        />
                      ) : (
                        <Space direction="vertical" size={18} style={{ width: '100%' }}>
                          <div>
                            <Typography.Title level={3} className={styles.panelTitle}>
                              {activeTarget.job_title}
                            </Typography.Title>
                            <Typography.Paragraph className={styles.panelText}>
                              {activeTarget.industry} / {activeTarget.company_name}
                            </Typography.Paragraph>
                          </div>

                          <div className={styles.panelSection} style={{ marginTop: 0 }}>
                            <Typography.Text className={styles.panelLabel}>
                              <InfoCircleOutlined />
                              路径摘要
                            </Typography.Text>
                            <Typography.Paragraph className={styles.helperText}>
                              当前「{currentSourceSnapshot?.job_title || selectedSource?.job_title || '源标准职业'}」标准职业与对应职业的加权相似度为 {(activeComparison.weighted_similarity_score * 100).toFixed(1)}%
                            </Typography.Paragraph>
                            <Row gutter={[12, 12]}>
                              <Col span={12}>
                                <Statistic title="加权相似度" value={(activeComparison.weighted_similarity_score * 100).toFixed(1)} suffix="%" />
                              </Col>
                              <Col span={12}>
                                <Statistic title="专业门槛维度" value={activeTarget.professional_threshold_dimension_count} suffix="项" />
                              </Col>
                            </Row>
                            <div style={{ marginTop: 12 }}>
                              <Typography.Text className={styles.metricHint}>
                                专业与门槛关键词数：{activeTarget.professional_threshold_keyword_count}
                              </Typography.Text>
                            </div>
                          </div>

                          <div className={styles.panelSection}>
                            <Typography.Text className={styles.panelLabel}>
                              <PartitionOutlined />
                              分组相似度
                            </Typography.Text>
                            <Space wrap>
                              {activeTarget.group_similarities.map((group) => (
                                <Tag key={`${activeTarget.profile_id}-${group.group_key}`} color="blue">
                                  {group.label} {(group.similarity_score * 100).toFixed(1)}%
                                </Tag>
                              ))}
                            </Space>
                          </div>

                          <div className={styles.panelSection}>
                            <Typography.Text className={styles.panelLabel}>
                              <InfoCircleOutlined />
                              12 维对比表
                            </Typography.Text>
                            <Typography.Paragraph className={styles.helperText}>
                              {activeGroup
                                ? '当前为二级完整视图，展示所选大维度下全部小维度与完整词条。'
                                : '一级页先展示三大维度摘要，每个小维度默认预览 2 条词条，点击大维度卡片后查看该维度完整信息。'}
                            </Typography.Paragraph>
                            {activeGroup ? (
                              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                <Button
                                  type="link"
                                  icon={<LeftOutlined />}
                                  className={styles.comparisonBackButton}
                                  onClick={() => setActiveGroupKey(undefined)}
                                >
                                  返回一级摘要
                                </Button>
                                <div className={styles.comparisonBlock}>
                                  <Typography.Title level={5} style={{ marginTop: 0 }}>
                                    {activeGroup.label}
                                  </Typography.Title>
                                  {renderComparisonRows(activeGroup.rows)}
                                </div>
                              </Space>
                            ) : (
                              <div className={styles.comparisonSummaryGrid}>
                                {groupedRows.map((group) => (
                                  <button
                                    key={group.key}
                                    type="button"
                                    className={styles.comparisonSummaryCard}
                                    onClick={() => setActiveGroupKey(group.key)}
                                  >
                                    <div className={styles.comparisonSummaryHeader}>
                                      <Typography.Title level={5} style={{ margin: 0 }}>
                                        {group.label}
                                      </Typography.Title>
                                      <Typography.Text className={styles.comparisonSummaryMeta}>
                                        {group.rows.length} 个小维度
                                      </Typography.Text>
                                    </div>
                                    {renderComparisonRows(group.rows, 2)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </Space>
                      )}
                    </Card>
                  </Col>
                </Row>
              )}
            </Card>
          </Col>
        </Row>
      </div>
    </PageContainer>
  );
};

export default TransferJobProfilePage;
