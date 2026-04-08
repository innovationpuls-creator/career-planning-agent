import {
  BarChartOutlined,
  DatabaseOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  PageContainer,
  ProDescriptions,
  type ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import { Graph } from '@antv/g6';
import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
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
  getIndustryOptionsByJobTitle,
  getJobTitleOptions,
  getVerticalJobProfile,
  getVerticalJobProfileCompanyDetail,
} from '@/services/ant-design-pro/api';

type FormValues = {
  job_title?: string;
  industry?: string[];
};

type GraphSelection =
  | { nodeType: 'root'; title: string }
  | { nodeType: 'industry'; title: string; group: API.VerticalJobProfileGroup }
  | {
      nodeType: 'company';
      title: string;
      group: API.VerticalJobProfileGroup;
      company: API.VerticalJobProfileCompany;
      companyIndex: number;
    };

type PersistedVerticalGraphState = {
  formValues?: FormValues;
  result?: API.VerticalJobProfilePayload;
  activeNodeId?: string;
};

type RankingItem = API.VerticalJobProfileCompany & {
  widthRatio: number;
};

type LabelPlacement = 'top' | 'bottom' | 'left' | 'right';
type VerticalGraphNodeType = 'root' | 'industry' | 'company';

type VerticalGraphLayoutNode = {
  id: string;
  data: {
    title: string;
    subtitle?: string;
    nodeType: VerticalGraphNodeType;
    emphasis: boolean;
    labelPlacement: LabelPlacement;
    labelOffset: number;
    labelMaxWidth: number;
  };
  style: {
    x: number;
    y: number;
  };
};

type VerticalGraphData = {
  nodes: VerticalGraphLayoutNode[];
  edges: Array<{
    id: string;
    source: string;
    target: string;
    data: {
      active: boolean;
    };
  }>;
};

const STORAGE_KEY = 'feature_map_vertical_graph_state';

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readPersistedState = (): PersistedVerticalGraphState => {
  if (!canUseStorage()) {
    return {};
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as PersistedVerticalGraphState;
  } catch (_error) {
    return {};
  }
};

const writePersistedState = (state: PersistedVerticalGraphState) => {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const clearPersistedState = () => {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
};

const readQueryPreset = (): FormValues => {
  if (typeof window === 'undefined') {
    return {};
  }
  const params = new URLSearchParams(window.location.search);
  const jobTitle = params.get('job_title')?.trim();
  const industries = Array.from(
    new Set(
      params
        .getAll('industry')
        .flatMap((item) => item.split(','))
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
  return {
    job_title: jobTitle || undefined,
    industry: industries,
  };
};

const appendPresetJobTitleOption = (
  options: API.JobTitleOption[],
  presetJobTitle?: string,
): API.JobTitleOption[] => {
  if (!presetJobTitle || options.some((option) => option.value === presetJobTitle)) {
    return options;
  }
  return [{ label: presetJobTitle, value: presetJobTitle }, ...options];
};

const textFallback = (value?: string | null, fallback = '暂无信息') => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

const formatSalaryRange = (value?: string | null) => textFallback(value, '面议');

const formatEquivalentSalary = (value?: number | null) => {
  if (!value || value <= 0) {
    return '面议';
  }
  if (value >= 10000) {
    const amount = value / 10000;
    return `${amount.toFixed(amount >= 10 ? 0 : 1)} 万/月`;
  }
  return `${Math.round(value).toLocaleString('zh-CN')} 元/月`;
};

const shortenGraphLabel = (value?: string | null, maxLength = 10) => {
  const text = value?.trim();
  if (!text) {
    return '暂无信息';
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

const buildRankingItems = (companies: API.VerticalJobProfileCompany[]): RankingItem[] => {
  const maxValue = Math.max(...companies.map((item) => item.salary_sort_value || 0), 0);
  return companies.map((item) => ({
    ...item,
    widthRatio:
      maxValue > 0 && item.salary_sort_value
        ? Math.max(0.18, item.salary_sort_value / maxValue)
        : 0.18,
  }));
};

const buildCompanyOverviewBadges = (company: API.VerticalJobProfileCompany) => {
  const badgeItems = [
    company.addresses?.length ? `地址：${company.addresses.join(' / ')}` : undefined,
    company.company_sizes?.length ? `规模：${company.company_sizes.join(' / ')}` : undefined,
    company.company_types?.length ? `类型：${company.company_types.join(' / ')}` : undefined,
  ];
  return badgeItems.filter((item): item is string => !!item);
};

const buildIndustryNodeId = (industry: string) => `industry:${industry}`;
const buildCompanyNodeId = (industry: string, companyName: string, companyIndex: number) =>
  `company:${industry}:${companyIndex}:${companyName}`;

const getVerticalRelatedIds = (nodeId: string, edges: Array<{ source: string; target: string }>) => {
  const relatedIds = new Set<string>([nodeId]);
  edges.forEach((edge) => {
    if (edge.source === nodeId) relatedIds.add(edge.target);
    if (edge.target === nodeId) relatedIds.add(edge.source);
  });
  return relatedIds;
};

const getOutwardLabelPlacement = (
  x: number,
  y: number,
  centerX: number,
  centerY: number,
): LabelPlacement => {
  const dx = x - centerX;
  const dy = y - centerY;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'bottom' : 'top';
};

const buildVerticalGraphData = (
  payload: API.VerticalJobProfilePayload,
  width: number,
  height: number,
  activeNodeId?: string,
): VerticalGraphData => {
  const centerX = width / 2;
  const centerY = height * 0.7;
  const industryRadius = Math.min(width, height) * 0.3;
  const companyRadius = Math.min(width, height) * 0.49;
  const rootId = `job:${payload.job_title}`;
  const rawEdges: Array<{ source: string; target: string }> = [];

  payload.groups.forEach((group) => {
    const industryId = buildIndustryNodeId(group.industry);
    rawEdges.push({ source: rootId, target: industryId });
    group.companies.forEach((company, companyIndex) => {
      rawEdges.push({
        source: industryId,
        target: buildCompanyNodeId(group.industry, company.company_name, companyIndex),
      });
    });
  });

  const highlightedIds = activeNodeId ? getVerticalRelatedIds(activeNodeId, rawEdges) : new Set<string>();
  const activeEdgeIds = new Set<string>();

  if (activeNodeId) {
    rawEdges.forEach((edge) => {
      if (highlightedIds.has(edge.source) && highlightedIds.has(edge.target)) {
        activeEdgeIds.add(`${edge.source}-${edge.target}`);
      }
    });
  }

  const nodes: VerticalGraphLayoutNode[] = [
    {
      id: rootId,
      data: {
        title: payload.job_title,
        subtitle: '岗位中心',
        nodeType: 'root',
        emphasis: activeNodeId === rootId,
        labelPlacement: 'bottom',
        labelOffset: 24,
        labelMaxWidth: 160,
      },
      style: { x: centerX, y: centerY },
    },
  ];

  payload.groups.forEach((group, groupIndex) => {
    const angle = (-Math.PI / 2) + (groupIndex * (Math.PI * 2)) / Math.max(payload.groups.length, 1);
    const industryX = centerX + Math.cos(angle) * industryRadius;
    const industryY = centerY + Math.sin(angle) * industryRadius;
    const industryId = buildIndustryNodeId(group.industry);

    nodes.push({
      id: industryId,
      data: {
        title: group.industry,
        subtitle: `${group.companies.length} 家公司`,
        nodeType: 'industry',
        emphasis: activeNodeId === industryId,
        labelPlacement: getOutwardLabelPlacement(industryX, industryY, centerX, centerY),
        labelOffset: 22,
        labelMaxWidth: 124,
      },
      style: { x: industryX, y: industryY },
    });

    const rankingItems = buildRankingItems(group.companies);
    const spread =
      rankingItems.length > 1 ? Math.min((Math.PI * 3) / 5, 0.34 * rankingItems.length) : 0;
    const startAngle = angle - spread / 2;

    rankingItems.forEach((company, companyIndex) => {
      const companyAngle =
        rankingItems.length > 1
          ? startAngle + (spread / (rankingItems.length - 1)) * companyIndex
          : angle;
      const companyX = centerX + Math.cos(companyAngle) * companyRadius;
      const companyY = centerY + Math.sin(companyAngle) * companyRadius;
      const companyId = buildCompanyNodeId(group.industry, company.company_name, companyIndex);

      nodes.push({
        id: companyId,
        data: {
          title: shortenGraphLabel(company.company_name),
          subtitle: formatEquivalentSalary(company.salary_sort_value),
          nodeType: 'company',
          emphasis: activeNodeId === companyId,
          labelPlacement: getOutwardLabelPlacement(companyX, companyY, centerX, centerY),
          labelOffset: 18,
          labelMaxWidth: 96,
        },
        style: { x: companyX, y: companyY },
      });
    });
  });

  return {
    nodes,
    edges: rawEdges.map((edge) => ({
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      data: {
        active: !activeNodeId || activeEdgeIds.has(`${edge.source}-${edge.target}`),
      },
    })),
  };
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
      radial-gradient(circle at top left, rgba(22, 119, 255, 0.08), transparent 24%),
      linear-gradient(180deg, #f7fbff 0%, #ffffff 42%, #f4f8ff 100%);

    @media (max-width: 768px) {
      padding: 16px;
    }
  `,
  heroCard: css`
    margin-bottom: 24px;
    border: 1px solid rgba(22, 119, 255, 0.1);
    border-radius: 24px;
    box-shadow: 0 18px 40px rgba(31, 56, 88, 0.08);

    :global(.ant-card-body) {
      padding: 28px;
    }
  `,
  eyebrow: css`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
    padding: 6px 12px;
    color: ${token.colorPrimary};
    font-size: 13px;
    font-weight: 600;
    border-radius: 999px;
    background: rgba(22, 119, 255, 0.08);
  `,
  heroTitle: css`
    margin: 0 0 10px;
    color: #12314d;
  `,
  heroText: css`
    max-width: 920px;
    margin: 0 0 16px;
    color: rgba(18, 49, 77, 0.72);
    line-height: 1.85;
  `,
  filterCard: css`
    margin-bottom: 24px;
    border-radius: 20px;
    box-shadow: 0 16px 36px rgba(31, 56, 88, 0.08);
  `,
  summaryCard: css`
    margin-bottom: 24px;
    border-radius: 20px;
    box-shadow: 0 16px 36px rgba(31, 56, 88, 0.08);
  `,
  graphCard: css`
    border-radius: 24px;
    box-shadow: 0 18px 40px rgba(31, 56, 88, 0.08);

    :global(.ant-card-body) {
      padding: 24px;
    }
  `,
  graphHeader: css`
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 18px;
  `,
  graphLead: css`
    margin: 8px 0 0;
    color: rgba(18, 49, 77, 0.72);
    line-height: 1.8;
  `,
  graphWrap: css`
    width: 100%;
    min-height: 920px;
    border-radius: 24px;
    border: 1px solid rgba(22, 119, 255, 0.1);
    background:
      radial-gradient(circle at center, rgba(22, 119, 255, 0.06), transparent 42%),
      linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    overflow: hidden;
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
    margin-top: 18px;
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
  statHint: css`
    margin-top: 8px;
    color: rgba(18, 49, 77, 0.62);
    font-size: 12px;
    line-height: 1.7;
  `,
  supplementalTitle: css`
    margin: 28px 0 16px;
    color: #12314d;
  `,
  industryGrid: css`
    display: grid;
    gap: 20px;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
  `,
  industryCard: css`
    height: 100%;
    border-radius: 20px;
    box-shadow: 0 16px 36px rgba(31, 56, 88, 0.08);

    :global(.ant-card-body) {
      padding: 22px;
    }
  `,
  rankingList: css`
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));

    @media (max-width: 992px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 640px) {
      grid-template-columns: 1fr;
    }
  `,
  rankingRow: css`
    display: block;
    width: 100%;
    padding: 14px 16px;
    border: 1px solid rgba(18, 49, 77, 0.08);
    border-radius: 18px;
    background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
    text-align: left;
    appearance: none;
    font: inherit;
    cursor: pointer;
    transition:
      transform 180ms ease,
      box-shadow 180ms ease,
      border-color 180ms ease;

    &:hover {
      transform: translateY(-4px);
      border-color: rgba(22, 119, 255, 0.26);
      box-shadow: 0 16px 30px rgba(31, 56, 88, 0.12);
    }
  `,
  companyHead: css`
    display: flex;
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;
  `,
  companyMain: css`
    min-width: 0;
    flex: 1;
  `,
  companyTitleRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  `,
  companyTitle: css`
    display: block;
    color: #12314d;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.5;
    word-break: break-word;
  `,
  companySubtitle: css`
    display: block;
    margin-top: 4px;
    color: rgba(18, 49, 77, 0.58);
    font-size: 12px;
    line-height: 1.6;
  `,
  overviewBadges: css`
    display: inline-flex;
    flex-wrap: wrap;
    gap: 6px;
  `,
  overviewBadge: css`
    margin-inline-end: 0 !important;
    color: #255070;
    background: rgba(22, 119, 255, 0.08);
    border-color: rgba(22, 119, 255, 0.14);
  `,
  amountBox: css`
    flex-shrink: 0;
    text-align: right;
  `,
  amountText: css`
    display: block;
    color: #1677ff;
    font-size: 18px;
    font-weight: 700;
    line-height: 1.2;
  `,
  amountHint: css`
    display: block;
    margin-top: 4px;
    color: rgba(18, 49, 77, 0.58);
    font-size: 12px;
  `,
  track: css`
    position: relative;
    height: 10px;
    margin-top: 12px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(22, 119, 255, 0.12);
  `,
  fill: css`
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 999px;
    background: linear-gradient(90deg, #93c5fd 0%, #1677ff 100%);
    transition: width 220ms ease;
  `,
  footerNote: css`
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 10px;
    color: rgba(18, 49, 77, 0.58);
    font-size: 12px;
    line-height: 1.7;

    @media (max-width: 768px) {
      flex-direction: column;
    }
  `,
  emptyCard: css`
    border-radius: 20px;
    box-shadow: 0 16px 36px rgba(31, 56, 88, 0.08);

    :global(.ant-card-body) {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 220px;
    }
  `,
  drawerBody: css`
    display: grid;
    gap: 16px;
  `,
  drawerCard: css`
    border-radius: 20px;
    box-shadow: 0 12px 28px rgba(31, 56, 88, 0.08);

    :global(.ant-card-body) {
      padding: 20px;
    }
  `,
  drawerSectionTitle: css`
    margin: 0 0 12px;
    color: #12314d;
  `,
  drawerText: css`
    margin: 0;
    color: rgba(18, 49, 77, 0.76);
    line-height: 1.85;
    white-space: pre-wrap;
  `,
  postingCard: css`
    border: 1px solid rgba(18, 49, 77, 0.08);
    border-radius: 16px;
    padding: 16px;
    background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  `,
  postingMeta: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  `,
}));

const VerticalJobProfilePage: React.FC = () => {
  const { styles } = useStyles();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const persistedStateRef = useRef<PersistedVerticalGraphState>(readPersistedState());
  const queryPresetRef = useRef<FormValues>(readQueryPreset());
  const restoredJobTitleRef = useRef(false);
  const restoredIndustryRef = useRef(false);
  const [form] = Form.useForm<FormValues>();
  const [jobTitleOptions, setJobTitleOptions] = useState<API.JobTitleOption[]>([]);
  const [industryOptions, setIndustryOptions] = useState<API.IndustryOption[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [industryLoading, setIndustryLoading] = useState(false);
  const [resultLoading, setResultLoading] = useState(false);
  const [pageError, setPageError] = useState<string>();
  const [resultError, setResultError] = useState<string>();
  const [result, setResult] = useState<API.VerticalJobProfilePayload | undefined>(
    queryPresetRef.current.job_title ? undefined : persistedStateRef.current.result,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string>();
  const [currentDetail, setCurrentDetail] =
    useState<API.VerticalJobProfileCompanyDetailPayload>();
  const [presetNotice, setPresetNotice] = useState<string>();
  const [activeNodeId, setActiveNodeId] = useState<string | undefined>(
    queryPresetRef.current.job_title ? undefined : persistedStateRef.current.activeNodeId,
  );

  const queryPreset = queryPresetRef.current;
  const queryPresetJobTitleMatched = !!(
    queryPreset.job_title && jobTitleOptions.some((option) => option.value === queryPreset.job_title)
  );
  const displayedJobTitleOptions = useMemo(
    () => appendPresetJobTitleOption(jobTitleOptions, queryPreset.job_title),
    [jobTitleOptions, queryPreset.job_title],
  );
  const selectedJobTitle = Form.useWatch('job_title', form);

  const persistState = (partial: Partial<PersistedVerticalGraphState>) => {
    persistedStateRef.current = {
      ...persistedStateRef.current,
      ...partial,
    };
    writePersistedState(persistedStateRef.current);
  };

  useEffect(() => {
    let mounted = true;

    void getJobTitleOptions()
      .then(async (response) => {
        if (!mounted) return;
        setJobTitleOptions(response.data || []);
        const presetForm = queryPreset.job_title ? queryPreset : persistedStateRef.current.formValues;
        if (!presetForm?.job_title) return;

        if (!queryPreset.job_title && persistedStateRef.current.result) {
          setIndustryOptions(
            persistedStateRef.current.result.available_industries.map((item) => ({
              label: item,
              value: item,
            })),
          );
          return;
        }

        if (presetForm.job_title) {
          const industryResponse = await getIndustryOptionsByJobTitle(presetForm.job_title);
          if (mounted) setIndustryOptions(industryResponse.data || []);
        }
      })
      .catch(() => {
        if (mounted) setPageError('岗位标题选项加载失败，请确认后端服务已经启动。');
      })
      .finally(() => {
        if (mounted) setInitialLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [form]);

  useEffect(() => {
    const presetForm = queryPreset.job_title ? queryPreset : persistedStateRef.current.formValues;
    if (restoredJobTitleRef.current || !presetForm?.job_title || jobTitleOptions.length === 0) {
      return;
    }

    form.setFieldValue('job_title', presetForm.job_title);
    restoredJobTitleRef.current = true;
    if (queryPreset.job_title) {
      setPresetNotice(
        queryPresetJobTitleMatched
          ? undefined
          : '已带入目标岗位，但当前岗位库中暂无完全匹配项，请确认岗位名称。',
      );
      persistState({
        formValues: {
          job_title: presetForm.job_title,
          industry: [],
        },
        result: undefined,
        activeNodeId: undefined,
      });
    }
  }, [form, jobTitleOptions.length, queryPreset.job_title, queryPresetJobTitleMatched]);

  useEffect(() => {
    const presetForm = queryPreset.job_title ? queryPreset : persistedStateRef.current.formValues;
    if (restoredIndustryRef.current || !presetForm || initialLoading) {
      return;
    }

    const nextIndustries = queryPreset.job_title
      ? (presetForm.industry || []).filter((item) => industryOptions.some((option) => option.value === item))
      : (presetForm.industry || []);

    form.setFieldValue('industry', nextIndustries);
    restoredIndustryRef.current = true;

    if (queryPreset.job_title) {
      setPresetNotice((current) => {
        if (current) return current;
        if ((presetForm.industry || []).length > 0 && nextIndustries.length === 0) {
          return '已带入岗位，行业范围未命中当前岗位可选项。';
        }
        return undefined;
      });
      persistState({
        formValues: {
          job_title: presetForm.job_title,
          industry: nextIndustries,
        },
        result: undefined,
        activeNodeId: undefined,
      });
    }
  }, [form, industryOptions, initialLoading, queryPreset.job_title]);

  useEffect(() => {
    if (!result || !activeNodeId) return;
    persistState({
      formValues: form.getFieldsValue(),
      result,
      activeNodeId,
    });
  }, [activeNodeId, form, result]);

  const activeSelection = useMemo<GraphSelection | undefined>(() => {
    if (!result || !activeNodeId) return undefined;

    if (activeNodeId === `job:${result.job_title}`) {
      return { nodeType: 'root', title: result.job_title };
    }

    if (activeNodeId.startsWith('industry:')) {
      const industry = activeNodeId.replace('industry:', '');
      const group = result.groups.find((item) => item.industry === industry);
      return group ? { nodeType: 'industry', title: group.industry, group } : undefined;
    }

    if (activeNodeId.startsWith('company:')) {
      const [, industry, companyIndexText, ...companyNameParts] = activeNodeId.split(':');
      const companyIndex = Number(companyIndexText);
      const companyName = companyNameParts.join(':');
      const group = result.groups.find((item) => item.industry === industry);
      const company =
        group && !Number.isNaN(companyIndex)
          ? group.companies[companyIndex]
          : group?.companies.find((item) => item.company_name === companyName);

      return group && company
        ? {
            nodeType: 'company',
            title: company.company_name,
            group,
            company,
            companyIndex: Number.isNaN(companyIndex) ? 0 : companyIndex,
          }
        : undefined;
    }

    return undefined;
  }, [activeNodeId, result]);

  const closeDetailDrawer = () => {
    setDetailOpen(false);
    setDetailLoading(false);
    setDetailError(undefined);
    setCurrentDetail(undefined);
  };

  const handleJobTitleChange = async (jobTitle?: string) => {
    form.setFieldValue('industry', []);
    setIndustryOptions([]);
    setPresetNotice(undefined);
    setResult(undefined);
    setResultError(undefined);
    setActiveNodeId(undefined);
    closeDetailDrawer();
    persistState({
      formValues: {
        job_title: jobTitle,
        industry: [],
      },
      result: undefined,
      activeNodeId: undefined,
    });

    if (!jobTitle) return;

    setIndustryLoading(true);
    try {
      const response = await getIndustryOptionsByJobTitle(jobTitle);
      setIndustryOptions(response.data || []);
    } catch (_error) {
      setResultError('行业选项加载失败，请稍后重试。');
    } finally {
      setIndustryLoading(false);
    }
  };

  const handleReset = () => {
    form.resetFields();
    setIndustryOptions([]);
    setPresetNotice(undefined);
    setResult(undefined);
    setResultError(undefined);
    setActiveNodeId(undefined);
    closeDetailDrawer();
    clearPersistedState();
    persistedStateRef.current = {};
  };

  const handleSearch = async () => {
    const values = await form.validateFields();
    const jobTitle = values.job_title;
    if (!jobTitle) {
      return;
    }
    setResultLoading(true);
    setResultError(undefined);
    closeDetailDrawer();

    try {
      const response = await getVerticalJobProfile({
        job_title: jobTitle,
        industry: values.industry,
      });

      setResult(response.data);
      setIndustryOptions(
        response.data.available_industries.map((item) => ({
          label: item,
          value: item,
        })),
      );
      form.setFieldValue('industry', response.data.selected_industries);

      const nextNodeId = `job:${response.data.job_title}`;
      setActiveNodeId(nextNodeId);
      persistState({
        formValues: {
          job_title: response.data.job_title,
          industry: response.data.selected_industries,
        },
        result: response.data,
        activeNodeId: nextNodeId,
      });
    } catch (_error) {
      setResult(undefined);
      setActiveNodeId(undefined);
      setResultError('垂直岗位图谱加载失败，请稍后重试。');
    } finally {
      setResultLoading(false);
    }
  };

  const handleOpenCompanyDetail = async (
    industry: string,
    companyName: string,
    companyIndex = 0,
  ) => {
    if (!result?.job_title) return;

    const nextNodeId = buildCompanyNodeId(industry, companyName, companyIndex);
    setActiveNodeId(nextNodeId);
    persistState({ activeNodeId: nextNodeId });
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(undefined);
    setCurrentDetail(undefined);

    try {
      const response = await getVerticalJobProfileCompanyDetail({
        job_title: result.job_title,
        industry,
        company_name: companyName,
      });
      setCurrentDetail(response.data);
    } catch (_error) {
      setDetailError('公司详情加载失败，请稍后重试。');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!containerRef.current || !result) return undefined;

    const container = containerRef.current;
    const width = container.clientWidth || 980;
    const height = 920;
    const data = buildVerticalGraphData(result, width, height, activeNodeId);

    if (graphRef.current) {
      graphRef.current.setData(data);
      void graphRef.current.draw();
      return undefined;
    }

    const graph = new Graph({
      container,
      width,
      height,
      autoFit: 'view',
      data,
      animation: false,
      behaviors: [{ type: 'hover-activate', degree: 0, state: 'active', animation: false }],
      node: {
        type: 'circle',
        style: {
          size: (datum: any) => {
            if (datum.data.nodeType === 'root') return datum.data.emphasis ? 112 : 104;
            if (datum.data.nodeType === 'industry') return datum.data.emphasis ? 74 : 68;
            return datum.data.emphasis ? 48 : 42;
          },
          fill: (datum: any) => {
            if (datum.data.nodeType === 'root') return '#e6f4ff';
            if (datum.data.nodeType === 'industry') return '#f0f7ff';
            return '#ffffff';
          },
          stroke: (datum: any) => {
            if (datum.data.nodeType === 'root') return '#1677ff';
            if (datum.data.nodeType === 'industry') return '#69b1ff';
            return '#b7d7ff';
          },
          lineWidth: (datum: any) => {
            if (datum.data.emphasis) return 5;
            if (datum.data.nodeType === 'root') return 4;
            if (datum.data.nodeType === 'industry') return 3;
            return 2;
          },
          shadowColor: 'rgba(22, 119, 255, 0.18)',
          shadowBlur: (datum: any) => {
            if (datum.data.emphasis) return 24;
            if (datum.data.nodeType === 'root') return 18;
            if (datum.data.nodeType === 'industry') return 12;
            return 6;
          },
          labelText: (datum: any) => datum.data.title,
          labelPlacement: (datum: any) => datum.data.labelPlacement,
          labelMaxWidth: (datum: any) => datum.data.labelMaxWidth,
          labelWordWrap: true,
          labelWordWrapWidth: (datum: any) => datum.data.labelMaxWidth,
          labelOffsetX: (datum: any) =>
            datum.data.labelPlacement === 'left'
              ? -datum.data.labelOffset
              : datum.data.labelPlacement === 'right'
                ? datum.data.labelOffset
                : 0,
          labelOffsetY: (datum: any) =>
            datum.data.labelPlacement === 'top'
              ? -datum.data.labelOffset
              : datum.data.labelPlacement === 'bottom'
                ? datum.data.labelOffset
                : 0,
          labelBackground: true,
          labelBackgroundFill: 'rgba(255,255,255,0.95)',
          labelBackgroundRadius: 8,
          labelPadding: [6, 10],
          labelFill: '#12314d',
          labelFontSize: (datum: any) => {
            if (datum.data.nodeType === 'root') return 18;
            if (datum.data.nodeType === 'industry') return 15;
            return 12;
          },
          labelFontWeight: (datum: any) => (datum.data.nodeType === 'company' ? 600 : 700),
          labelTextAlign: (datum: any) => {
            if (datum.data.labelPlacement === 'left') return 'right';
            if (datum.data.labelPlacement === 'right') return 'left';
            return 'center';
          },
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
          lineWidth: (datum: any) => (datum.data.active ? 2.6 : 1.3),
          strokeOpacity: (datum: any) => (datum.data.active ? 0.95 : 0.72),
          endArrow: true,
          endArrowFill: (datum: any) => (datum.data.active ? '#69b1ff' : '#d6e4ff'),
        },
      },
    });

    graph.on('node:click', (event: any) => {
      const eventNodeId = event?.target?.id as string | undefined;
      if (!eventNodeId) return;

      if (eventNodeId.startsWith('company:')) {
        const [, industry, companyIndexText, ...companyNameParts] = eventNodeId.split(':');
        void handleOpenCompanyDetail(
          industry,
          companyNameParts.join(':'),
          Number.isNaN(Number(companyIndexText)) ? 0 : Number(companyIndexText),
        );
        return;
      }

      setActiveNodeId(eventNodeId);
      persistState({ activeNodeId: eventNodeId });
    });
    graph.on('node:mouseenter', () => {
      container.style.cursor = 'pointer';
    });
    graph.on('node:mouseleave', () => {
      container.style.cursor = 'default';
    });

    void graph.render();
    graphRef.current = graph;

    return () => {
      container.style.cursor = 'default';
      graph.destroy();
      graphRef.current = null;
    };
  }, [activeNodeId, result]);

  const overviewColumns = useMemo<
    ProDescriptionsItemProps<{
      addresses: string;
      company_sizes: string;
      company_types: string;
    }>[]
  >(
    () => [
      { title: '办公地点', dataIndex: 'addresses' },
      { title: '公司规模', dataIndex: 'company_sizes' },
      { title: '公司类型', dataIndex: 'company_types' },
    ],
    [],
  );

  const selectionDescription = useMemo(() => {
    if (!result) return '';
    if (!activeSelection || activeSelection.nodeType === 'root') {
      return `当前岗位为 ${result.job_title}，共覆盖 ${result.meta.total_industries} 个行业和 ${result.meta.total_companies} 家代表公司。`;
    }
    if (activeSelection.nodeType === 'industry') {
      return `${activeSelection.group.industry} 当前纳入 ${activeSelection.group.companies.length} 家代表公司，图谱中的公司节点已按薪资强弱展开。`;
    }
    return `${activeSelection.group.industry} 行业中的代表公司，当前薪资等效上限为 ${formatEquivalentSalary(
      activeSelection.company.salary_sort_value,
    )}。`;
  }, [activeSelection, result]);

  const renderGraph = () => {
    if (!result) return null;
    return <div ref={containerRef} className={styles.graphWrap} data-testid="vertical-graph-stage" />;
  };

  const renderIndustryCard = (group: API.VerticalJobProfileGroup) => {
    const rankingItems = buildRankingItems(group.companies);

    return (
      <Card className={styles.industryCard} key={group.industry} title={group.industry}>
        {rankingItems.length ? (
          <div className={styles.rankingList}>
            {rankingItems.map((item, index) => (
              <button
                key={buildCompanyNodeId(group.industry, item.company_name, index)}
                type="button"
                className={styles.rankingRow}
                aria-label={item.company_name}
                onClick={() => void handleOpenCompanyDetail(group.industry, item.company_name, index)}
              >
                <div className={styles.companyHead}>
                  <div className={styles.companyMain}>
                    <div className={styles.companyTitleRow}>
                      <Typography.Text className={styles.companyTitle}>
                        #{index + 1} {item.company_name}
                      </Typography.Text>
                      <div className={styles.overviewBadges}>
                        {buildCompanyOverviewBadges(item).map((badge) => (
                          <Tag className={styles.overviewBadge} key={`${item.company_name}-${badge}`}>
                            {badge}
                          </Tag>
                        ))}
                      </div>
                    </div>
                    <Typography.Text className={styles.companySubtitle}>
                      {textFallback(item.salary_sort_label, '薪资口径缺失')}
                    </Typography.Text>
                  </div>
                  <div className={styles.amountBox}>
                    <Typography.Text className={styles.amountText}>
                      {formatEquivalentSalary(item.salary_sort_value)}
                    </Typography.Text>
                    <Typography.Text className={styles.amountHint}>
                      {formatSalaryRange(item.salary_range)}
                    </Typography.Text>
                  </div>
                </div>
                <div className={styles.track}>
                  <div className={styles.fill} style={{ width: `${item.widthRatio * 100}%` }} />
                </div>
                <div className={styles.footerNote}>
                  <span>原始薪资区间：{formatSalaryRange(item.salary_range)}</span>
                  <span>排序值：{formatEquivalentSalary(item.salary_sort_value)}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前行业下暂无可展示公司" />
        )}
      </Card>
    );
  };

  return (
    <PageContainer className={styles.pageContainer} title={false} breadcrumbRender={false}>
      <div className={styles.shell}>
        <Card className={styles.heroCard}>
          <div className={styles.eyebrow}>
            <BarChartOutlined />
            垂直岗位图谱
          </div>
          <Typography.Title level={2} className={styles.heroTitle}>
            同一岗位在不同行业中的工资垂直对比图谱
          </Typography.Title>
          <Typography.Paragraph className={styles.heroText}>
            这版图谱优先服务阅读和点击操作。你可以先查看行业补充明细，再在下方图谱中理解岗位、行业和公司样本之间的关系。
          </Typography.Paragraph>
          <Space wrap size={[8, 8]}>
            <Tag color="blue">固定分层阅读</Tag>
            <Tag color="cyan">行业分区清晰</Tag>
            <Tag color="processing">自动记忆状态</Tag>
          </Space>
        </Card>

        <Card className={styles.filterCard}>
          {pageError ? (
            <Alert type="error" showIcon message="页面初始化失败" description={pageError} />
          ) : initialLoading ? (
            <Spin />
          ) : (
            <Form<FormValues> form={form} layout="vertical">
              <Row gutter={[16, 8]}>
                <Col xs={24} md={10}>
                  <Form.Item
                    label="岗位名称"
                    name="job_title"
                    rules={[{ required: true, message: '请先选择岗位名称' }]}
                  >
                    <Select
                      id="job_title"
                      allowClear
                      showSearch
                      placeholder="请选择唯一岗位"
                      options={displayedJobTitleOptions}
                      optionFilterProp="label"
                      onChange={(value) => void handleJobTitleChange(value)}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={10}>
                  <Form.Item label="行业范围" name="industry">
                    <Select
                      id="industry"
                      mode="multiple"
                      allowClear
                      showSearch
                      disabled={!selectedJobTitle}
                      loading={industryLoading}
                      placeholder={selectedJobTitle ? '可多选行业' : '请先选择岗位'}
                      options={industryOptions}
                      optionFilterProp="label"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={4}>
                  <Form.Item label="操作">
                    <Space wrap>
                      <Button
                        type="primary"
                        icon={<SearchOutlined />}
                        disabled={!selectedJobTitle}
                        loading={resultLoading}
                        onClick={() => void handleSearch()}
                      >
                        查询
                      </Button>
                      <Button icon={<ReloadOutlined />} onClick={handleReset}>
                        重置
                      </Button>
                    </Space>
                  </Form.Item>
                </Col>
              </Row>
              {presetNotice ? (
                <Alert
                  style={{ marginTop: 8 }}
                  type="warning"
                  showIcon
                  message={presetNotice}
                />
              ) : null}
            </Form>
          )}
        </Card>

        {resultError ? (
          <Alert
            style={{ marginBottom: 24 }}
            type="error"
            showIcon
            message="图谱查询失败"
            description={resultError}
          />
        ) : null}

        {resultLoading ? (
          <Card className={styles.emptyCard}>
            <Spin size="large" />
          </Card>
        ) : result ? (
          <>
            <Card className={styles.summaryCard}>
              <Typography.Title level={3} className={styles.panelTitle}>
                {activeSelection?.title || result.job_title}
              </Typography.Title>
              <Typography.Paragraph className={styles.panelText}>
                {selectionDescription}
              </Typography.Paragraph>

              <Row gutter={[20, 20]}>
                <Col xs={24} lg={8}>
                  <div className={styles.panelSection} style={{ marginTop: 0 }}>
                    <Typography.Text className={styles.panelLabel}>
                      <InfoCircleOutlined />
                      当前筛选
                    </Typography.Text>
                    <Space wrap size={[8, 8]}>
                      {result.selected_industries.map((item) => (
                        <Tag key={item} color="blue">
                          {item}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                </Col>
                <Col xs={24} lg={8}>
                  <div className={styles.panelSection} style={{ marginTop: 0 }}>
                    <Typography.Text className={styles.panelLabel}>
                      <InfoCircleOutlined />
                      数据摘要
                    </Typography.Text>
                    <Typography.Paragraph className={styles.helperText}>
                      公司排序基于月薪等效上限。页面会保留本次查询结果和当前选中状态，切换回来仍可继续阅读。
                    </Typography.Paragraph>
                    <Row gutter={[12, 12]}>
                      <Col span={12}>
                        <Statistic title="行业数量" value={result.meta.total_industries} />
                        <div className={styles.statHint}>与当前筛选行业一致。</div>
                      </Col>
                      <Col span={12}>
                        <Statistic title="公司数量" value={result.meta.total_companies} />
                        <div className={styles.statHint}>每个行业最多展示薪资更高的前 10 家公司。</div>
                      </Col>
                    </Row>
                  </div>
                </Col>
                <Col xs={24} lg={8}>
                  <div className={styles.panelSection} style={{ marginTop: 0 }}>
                    <Typography.Text className={styles.panelLabel}>
                      <InfoCircleOutlined />
                      选中说明
                    </Typography.Text>
                    {activeSelection?.nodeType === 'company' ? (
                      <>
                        <Typography.Paragraph className={styles.helperText}>
                          薪资等效：{formatEquivalentSalary(activeSelection.company.salary_sort_value)}
                        </Typography.Paragraph>
                        <Typography.Paragraph className={styles.helperText}>
                          原始薪资区间：{formatSalaryRange(activeSelection.company.salary_range)}
                        </Typography.Paragraph>
                      </>
                    ) : activeSelection?.nodeType === 'industry' ? (
                      <Typography.Paragraph className={styles.helperText}>
                        当前行业下共 {activeSelection.group.companies.length} 家代表公司，图谱中的公司节点已放大间距，便于继续点击查看详情。
                      </Typography.Paragraph>
                    ) : (
                      <Typography.Paragraph className={styles.helperText}>
                        建议先看下面的行业补充明细，再用图谱理解岗位、行业、公司之间的整体关系。
                      </Typography.Paragraph>
                    )}
                  </div>
                </Col>
              </Row>
            </Card>

            <Typography.Title level={4} className={styles.supplementalTitle}>
              行业补充明细
            </Typography.Title>

            <div className={styles.industryGrid}>
              {result.groups.map((group) => renderIndustryCard(group))}
            </div>

            <Card className={styles.graphCard} style={{ marginTop: 28 }}>
              <div className={styles.graphHeader}>
                <div>
                  <Typography.Title level={3} style={{ margin: 0, color: '#12314d' }}>
                    {result.title}
                  </Typography.Title>
                  <Typography.Paragraph className={styles.graphLead}>
                    图谱放在下方展示。公司名称在图中会自动缩短显示，完整名称以选中卡片和详情抽屉为准。
                  </Typography.Paragraph>
                </div>
                <Space wrap size={[8, 8]}>
                  <Tag color="blue">{result.meta.total_industries} 个行业</Tag>
                  <Tag color="cyan">{result.meta.total_companies} 家公司</Tag>
                  <Tag color="processing">更宽松的点击区</Tag>
                </Space>
              </div>
              {renderGraph()}
            </Card>
          </>
        ) : (
          <Card className={styles.emptyCard}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" size={4}>
                  <Typography.Text strong>先选择岗位，再开始查询</Typography.Text>
                  <Typography.Text type="secondary">
                    查询后会展示一张适合阅读、支持点击查看详情、并会自动记忆状态的垂直岗位图谱。
                  </Typography.Text>
                </Space>
              }
            >
              <DatabaseOutlined style={{ fontSize: 24, color: '#1677ff' }} />
            </Empty>
          </Card>
        )}
      </div>

      <Drawer
        title={currentDetail?.summary.company_name || '公司详情'}
        width={640}
        open={detailOpen}
        onClose={closeDetailDrawer}
        destroyOnHidden={false}
      >
        <div className={styles.drawerBody}>
          {detailLoading ? (
            <Spin />
          ) : detailError ? (
            <Alert type="error" showIcon message="详情加载失败" description={detailError} />
          ) : currentDetail ? (
            <>
              <Card className={styles.drawerCard}>
                <Typography.Title level={4} className={styles.drawerSectionTitle}>
                  概览信息
                </Typography.Title>
                <ProDescriptions
                  column={1}
                  dataSource={{
                    addresses: currentDetail.overview.addresses.join('、') || '暂无信息',
                    company_sizes: currentDetail.overview.company_sizes.join('、') || '暂无信息',
                    company_types: currentDetail.overview.company_types.join('、') || '暂无信息',
                  }}
                  columns={overviewColumns}
                />
                <Space wrap size={[8, 8]}>
                  <Tag color="blue">{currentDetail.summary.industry}</Tag>
                  <Tag color="cyan">{currentDetail.summary.posting_count} 条原始记录</Tag>
                  {currentDetail.summary.salary_ranges.map((item) => (
                    <Tag key={item}>{item}</Tag>
                  ))}
                </Space>
              </Card>

              <Card className={styles.drawerCard}>
                <Typography.Title level={4} className={styles.drawerSectionTitle}>
                  原始记录列表 ({currentDetail.postings.length})
                </Typography.Title>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {currentDetail.postings.map((posting) => (
                    <div className={styles.postingCard} key={posting.id}>
                      <Typography.Title level={5} style={{ margin: 0, color: '#12314d' }}>
                        {posting.job_title}
                      </Typography.Title>
                      <Typography.Paragraph className={styles.drawerText} style={{ marginTop: 12 }}>
                        {textFallback(posting.job_detail)}
                      </Typography.Paragraph>
                      <Typography.Paragraph className={styles.drawerText} style={{ marginTop: 12 }}>
                        {textFallback(posting.company_detail)}
                      </Typography.Paragraph>
                      <div className={styles.postingMeta}>
                        <Tag>{formatSalaryRange(posting.salary_range)}</Tag>
                        <Tag>{textFallback(posting.address)}</Tag>
                        <Tag>{textFallback(posting.company_size)}</Tag>
                        <Tag>{textFallback(posting.company_type)}</Tag>
                      </div>
                    </div>
                  ))}
                </Space>
              </Card>
            </>
          ) : (
            <Empty description="请选择公司查看原始招聘记录" />
          )}
        </div>
      </Drawer>
    </PageContainer>
  );
};

export default VerticalJobProfilePage;
