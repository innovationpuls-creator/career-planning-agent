import {
  FileSearchOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history } from '@umijs/max';
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
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import MatchReportView from './components/MatchReportView';
import {
  createCareerDevelopmentFavorite,
  createCareerDevelopmentMatchReport,
  deleteCareerDevelopmentFavorite,
  getCareerDevelopmentFavorites,
  getCareerDevelopmentMatchInit,
  getIndustryOptionsByJobTitle,
  getJobTitleOptions,
  getVerticalJobProfileCompanyDetail,
} from '@/services/ant-design-pro/api';

const STORAGE_KEY = 'feature_map_career_development_job_match_v1';

type PersistedState = {
  jobTitle?: string;
  industries?: string[];
  activeIndustry?: string;
  activeRecommendationId?: string;
};

type SubmittedQuery = {
  jobTitle: string;
  industries: string[];
};

type GraphNodeType = 'root' | 'industry' | 'company';
type LabelPlacement = 'top' | 'bottom' | 'left' | 'right';

type VerticalGraphLayoutNode = {
  id: string;
  data: {
    title: string;
    subtitle?: string;
    nodeType: GraphNodeType;
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
      radial-gradient(circle at top left, rgba(22, 119, 255, 0.1), transparent 28%),
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
    gap: 8px;
    margin-bottom: 14px;
    padding: 6px 12px;
    color: ${token.colorPrimary};
    font-size: 13px;
    font-weight: 600;
    border-radius: 999px;
    background: rgba(22, 119, 255, 0.08);
  `,
  sectionCard: css`
    border-radius: 24px;
    box-shadow: 0 16px 36px rgba(31, 56, 88, 0.08);

    :global(.ant-card-body) {
      padding: 24px;
    }
  `,
  graphStage: css`
    width: 100%;
    min-height: 560px;
    border-radius: 24px;
    border: 1px solid rgba(22, 119, 255, 0.1);
    background:
      radial-gradient(circle at center, rgba(22, 119, 255, 0.06), transparent 42%),
      linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    overflow: hidden;

    @media (max-width: 992px) {
      min-height: 460px;
    }
  `,
  graphLead: css`
    margin: 8px 0 0;
    color: rgba(18, 49, 77, 0.72);
    line-height: 1.8;
  `,
}));

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readPersistedState = (): PersistedState => {
  if (!canUseStorage()) return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as PersistedState;
  } catch {
    return {};
  }
};

const writePersistedState = (state: PersistedState) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const buildIndustryNodeId = (industry: string) => `industry:${industry}`;
const buildCompanyNodeId = (industry: string, companyName: string, companyIndex: number) =>
  `company:${industry}:${companyIndex}:${companyName}`;

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

const formatEquivalentSalary = (value?: number | null) => {
  if (!value || value <= 0) return '薪资待补充';
  if (value >= 10000) {
    const amount = value / 10000;
    return `${amount.toFixed(amount >= 10 ? 0 : 1)} 万/月`;
  }
  return `${Math.round(value).toLocaleString('zh-CN')} 元/月`;
};

const shortenGraphLabel = (value?: string | null, maxLength = 10) => {
  const text = value?.trim();
  if (!text) return '待补充';
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

const sameStringArray = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
};

const normalizeFavoriteValue = (value?: string) => (value || '').toLowerCase().replace(/\s+/g, '').trim();

const buildFavoriteTargetKey = (canonicalJobTitle: string, industry?: string) =>
  `${normalizeFavoriteValue(canonicalJobTitle)}::${normalizeFavoriteValue(industry)}`;

const buildVerticalGraphData = (
  payload: API.VerticalJobProfilePayload,
  width: number,
  height: number,
  activeNodeId?: string,
): VerticalGraphData => {
  const centerX = width / 2;
  const centerY = height * 0.68;
  const industryRadius = Math.min(width, height) * 0.28;
  const companyRadius = Math.min(width, height) * 0.44;
  const rootId = `job:${payload.job_title}`;
  const nodes: VerticalGraphLayoutNode[] = [
    {
      id: rootId,
      data: {
        title: payload.job_title,
        subtitle: '目标岗位',
        nodeType: 'root',
        emphasis: activeNodeId === rootId,
        labelPlacement: 'bottom',
        labelOffset: 24,
        labelMaxWidth: 160,
      },
      style: { x: centerX, y: centerY },
    },
  ];
  const edges: VerticalGraphData['edges'] = [];

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
    edges.push({
      id: `${rootId}-${industryId}`,
      source: rootId,
      target: industryId,
      data: { active: !activeNodeId || activeNodeId === industryId || activeNodeId === rootId },
    });

    const spread =
      group.companies.length > 1 ? Math.min((Math.PI * 3) / 5, 0.34 * group.companies.length) : 0;
    const startAngle = angle - spread / 2;
    group.companies.forEach((company, companyIndex) => {
      const companyAngle =
        group.companies.length > 1
          ? startAngle + (spread / (group.companies.length - 1)) * companyIndex
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
      edges.push({
        id: `${industryId}-${companyId}`,
        source: industryId,
        target: companyId,
        data: { active: !activeNodeId || activeNodeId === companyId || activeNodeId === industryId },
      });
    });
  });

  return { nodes, edges };
};

const JobExplorationMatchPage: React.FC = () => {
  const { styles } = useStyles();
  const persistedStateRef = useRef<PersistedState>(readPersistedState());
  const previousJobTitleRef = useRef<string | undefined>(undefined);
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const [selectorForm] = Form.useForm<{ job_title?: string; industries?: string[] }>();
  const [jobOptions, setJobOptions] = useState<API.JobTitleOption[]>([]);
  const [industryOptions, setIndustryOptions] = useState<API.IndustryOption[]>([]);
  const [initLoading, setInitLoading] = useState(true);
  const [initError, setInitError] = useState<string>();
  const [initPayload, setInitPayload] = useState<API.CareerDevelopmentMatchInitPayload>();
  const [activeRecommendationId, setActiveRecommendationId] = useState<string | undefined>(
    persistedStateRef.current.activeRecommendationId,
  );
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string>();
  const [customPayload, setCustomPayload] = useState<API.CareerDevelopmentMatchCustomPayload>();
  const [submittedQuery, setSubmittedQuery] = useState<SubmittedQuery>();
  const [industryLoading, setIndustryLoading] = useState(false);
  const [favorites, setFavorites] = useState<API.CareerDevelopmentFavoritePayload[]>([]);
  const [favoriteSubmittingKey, setFavoriteSubmittingKey] = useState<string>();
  const [activeIndustry, setActiveIndustry] = useState<string | undefined>(
    persistedStateRef.current.activeIndustry,
  );
  const [activeGraphNodeId, setActiveGraphNodeId] = useState<string>();
  const [companyDetailOpen, setCompanyDetailOpen] = useState(false);
  const [companyDetailLoading, setCompanyDetailLoading] = useState(false);
  const [companyDetailError, setCompanyDetailError] = useState<string>();
  const [companyDetail, setCompanyDetail] = useState<API.VerticalJobProfileCompanyDetailPayload>();

  const selectedJobTitle = Form.useWatch('job_title', selectorForm);
  const selectedIndustries = Form.useWatch('industries', selectorForm) || [];
  const canSubmitCustomSearch = Boolean(selectedJobTitle && selectedIndustries.length);

  const recommendationItems = initPayload?.recommendations || [];
  const activeRecommendation =
    recommendationItems.find((item) => item.report_id === activeRecommendationId) || recommendationItems[0];
  const customReports = customPayload?.reports || [];
  const activeIndustryReport =
    customReports.find((item) => item.industry === activeIndustry)?.report || customReports[0]?.report;
  const hasPendingSearchChanges = useMemo(() => {
    if (!customPayload || !submittedQuery || !selectedJobTitle) return false;
    return (
      submittedQuery.jobTitle !== selectedJobTitle ||
      !sameStringArray(submittedQuery.industries, selectedIndustries)
    );
  }, [customPayload, selectedIndustries, selectedJobTitle, submittedQuery]);
  const favoritesByKey = useMemo(
    () =>
      Object.fromEntries(
        favorites.map((item) => [buildFavoriteTargetKey(item.canonical_job_title, item.industry), item] as const),
      ),
    [favorites],
  );

  const persistState = (partial: Partial<PersistedState>) => {
    persistedStateRef.current = { ...persistedStateRef.current, ...partial };
    writePersistedState(persistedStateRef.current);
  };

  const loadInit = async () => {
    setInitLoading(true);
    try {
      const [initResponse, jobResponse, favoriteResponse] = await Promise.all([
        getCareerDevelopmentMatchInit({ skipErrorHandler: true }),
        getJobTitleOptions({ skipErrorHandler: true }),
        getCareerDevelopmentFavorites({ skipErrorHandler: true }),
      ]);
      setInitPayload(initResponse.data);
      setJobOptions(jobResponse.data || []);
      setFavorites(favoriteResponse.data || []);
      setActiveRecommendationId(
        persistedStateRef.current.activeRecommendationId || initResponse.data.default_report_id,
      );
      setInitError(undefined);
    } catch (error: any) {
      setInitError(error?.response?.data?.detail || error?.message || '初始化加载失败，请稍后重试。');
    } finally {
      setInitLoading(false);
    }
  };

  const loadFavorites = async () => {
    try {
      const response = await getCareerDevelopmentFavorites({ skipErrorHandler: true });
      setFavorites(response.data || []);
    } catch {}
  };

  const loadIndustryOptions = async (jobTitle: string) => {
    setIndustryLoading(true);
    try {
      const response = await getIndustryOptionsByJobTitle(jobTitle, { skipErrorHandler: true });
      setIndustryOptions(response.data || []);
    } catch {
      setIndustryOptions([]);
    } finally {
      setIndustryLoading(false);
    }
  };

  const loadCompanyDetail = async (params: {
    jobTitle: string;
    industry: string;
    companyName: string;
  }) => {
    setCompanyDetailOpen(true);
    setCompanyDetailLoading(true);
    setCompanyDetailError(undefined);
    try {
      const response = await getVerticalJobProfileCompanyDetail(
        {
          job_title: params.jobTitle,
          industry: params.industry,
          company_name: params.companyName,
        },
        { skipErrorHandler: true },
      );
      setCompanyDetail(response.data);
    } catch (error: any) {
      setCompanyDetail(undefined);
      setCompanyDetailError(error?.response?.data?.detail || error?.message || '公司详情加载失败。');
    } finally {
      setCompanyDetailLoading(false);
    }
  };

  const loadCustomReport = async (jobTitle: string, industries: string[]) => {
    if (!jobTitle || industries.length === 0) return;
    setCustomLoading(true);
    try {
      const response = await createCareerDevelopmentMatchReport(
        {
          job_title: jobTitle,
          industries,
        },
        { skipErrorHandler: true },
      );
      setCustomPayload(response.data);
      setSubmittedQuery({ jobTitle, industries });
      const preferredIndustry = persistedStateRef.current.activeIndustry;
      const nextIndustry = response.data.reports.some((item) => item.industry === preferredIndustry)
        ? preferredIndustry
        : response.data.reports[0]?.industry;
      setActiveIndustry(nextIndustry);
      setActiveGraphNodeId(`job:${response.data.graph_payload?.job_title || jobTitle}`);
      setCustomError(undefined);
    } catch (error: any) {
      setCustomPayload(undefined);
      setCustomError(error?.response?.data?.detail || error?.message || '自定义目标报告生成失败。');
    } finally {
      setCustomLoading(false);
    }
  };

  const handleToggleFavorite = async (
    report: API.CareerDevelopmentMatchReport,
    sourceKind: 'recommendation' | 'custom',
    favorite?: API.CareerDevelopmentFavoritePayload,
  ) => {
    const targetKey = buildFavoriteTargetKey(report.canonical_job_title, report.industry);
    setFavoriteSubmittingKey(targetKey);
    try {
      if (favorite) {
        await deleteCareerDevelopmentFavorite(favorite.favorite_id, { skipErrorHandler: true });
        setFavorites((current) => current.filter((item) => item.favorite_id !== favorite.favorite_id));
        return;
      }
      const response = await createCareerDevelopmentFavorite(
        {
          source_kind: sourceKind,
          report,
        },
        { skipErrorHandler: true },
      );
      setFavorites((current) => {
        const next = current.filter((item) => item.target_key !== response.data.target_key);
        return [response.data, ...next];
      });
    } catch {
      await loadFavorites();
    } finally {
      setFavoriteSubmittingKey(undefined);
    }
  };

  useEffect(() => {
    void loadInit();
  }, []);

  useEffect(() => {
    const restoredJobTitle = persistedStateRef.current.jobTitle;
    if (!restoredJobTitle || jobOptions.length === 0) return;
    const exists = jobOptions.some((item) => item.value === restoredJobTitle);
    if (!exists) return;
    selectorForm.setFieldsValue({
      job_title: restoredJobTitle,
      industries: persistedStateRef.current.industries || [],
    });
  }, [jobOptions, selectorForm]);

  useEffect(() => {
    const previousJobTitle = previousJobTitleRef.current;
    if (!selectedJobTitle) {
      setIndustryOptions([]);
      previousJobTitleRef.current = undefined;
      persistState({ jobTitle: undefined, industries: [] });
      return;
    }
    if (previousJobTitle && previousJobTitle !== selectedJobTitle) {
      selectorForm.setFieldValue('industries', []);
      persistState({ jobTitle: selectedJobTitle, industries: [] });
    } else {
      persistState({ jobTitle: selectedJobTitle, industries: selectedIndustries });
    }
    previousJobTitleRef.current = selectedJobTitle;
    void loadIndustryOptions(selectedJobTitle);
  }, [selectedJobTitle, selectorForm]);

  useEffect(() => {
    persistState({ industries: selectedIndustries, activeIndustry });
  }, [activeIndustry, selectedIndustries]);

  useEffect(() => {
    persistState({ activeRecommendationId });
  }, [activeRecommendationId]);

  useEffect(() => {
    const payload = customPayload?.graph_payload;
    const container = graphContainerRef.current;
    if (!payload || !container) return;

    const width = container.clientWidth || 960;
    const height = 560;
    const data = buildVerticalGraphData(payload, width, height, activeGraphNodeId);
    const graph = new Graph({
      container,
      width,
      height,
      autoFit: 'view',
      data,
      behaviors: [{ type: 'hover-activate', degree: 0, state: 'active', animation: false }],
      node: {
        type: 'circle',
        style: {
          size: (datum: any) => {
            if (datum.data.nodeType === 'root') return 76;
            if (datum.data.nodeType === 'industry') return 48;
            return 28;
          },
          fill: (datum: any) => {
            if (datum.data.nodeType === 'root') return '#1677ff';
            if (datum.data.nodeType === 'industry') return '#91caff';
            return '#d6e4ff';
          },
          stroke: (datum: any) => (datum.data.emphasis ? '#0958d9' : '#69b1ff'),
          lineWidth: (datum: any) => (datum.data.emphasis ? 3 : 2),
          labelText: (datum: any) => `${datum.data.title}\n${datum.data.subtitle || ''}`,
          labelPlacement: (datum: any) => datum.data.labelPlacement,
          labelOffsetY: (datum: any) => datum.data.labelOffset,
          labelMaxWidth: (datum: any) => datum.data.labelMaxWidth,
          labelFontSize: (datum: any) => (datum.data.nodeType === 'company' ? 11 : 13),
          labelFill: '#12314d',
          cursor: 'pointer',
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
      const nodeId = event?.target?.id as string | undefined;
      if (!nodeId) return;
      if (nodeId.startsWith('industry:')) {
        const industry = nodeId.replace('industry:', '');
        setActiveIndustry(industry);
        setActiveGraphNodeId(nodeId);
        return;
      }
      if (nodeId.startsWith('company:')) {
        const [, industry, companyIndexText, ...companyParts] = nodeId.split(':');
        const companyName = companyParts.join(':');
        setActiveGraphNodeId(nodeId);
        void loadCompanyDetail({
          jobTitle: payload.job_title,
          industry,
          companyName,
        });
        return;
      }
      setActiveGraphNodeId(nodeId);
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
  }, [activeGraphNodeId, customPayload?.graph_payload]);

  const recommendationTabs = recommendationItems.map((item) => ({
    key: item.report_id,
    label: item.target_title,
    children: (
      <MatchReportView
        report={item}
        favorite={favoritesByKey[buildFavoriteTargetKey(item.canonical_job_title, item.industry)]}
        favoriteSubmitting={
          favoriteSubmittingKey === buildFavoriteTargetKey(item.canonical_job_title, item.industry)
        }
        favoriteSourceKind="recommendation"
        onToggleFavorite={(report, favorite) =>
          void handleToggleFavorite(report, 'recommendation', favorite)
        }
        onOpenCompanyDetail={({ jobTitle, industry, companyName }) =>
          void loadCompanyDetail({ jobTitle, industry, companyName })
        }
      />
    ),
  }));

  const industryTabs = customReports.map((item) => ({
    key: item.industry,
    label: item.industry,
    children: (
      <MatchReportView
        report={item.report}
        favorite={favoritesByKey[buildFavoriteTargetKey(item.report.canonical_job_title, item.report.industry)]}
        favoriteSubmitting={
          favoriteSubmittingKey ===
          buildFavoriteTargetKey(item.report.canonical_job_title, item.report.industry)
        }
        favoriteSourceKind="custom"
        onToggleFavorite={(report, favorite) => void handleToggleFavorite(report, 'custom', favorite)}
        onOpenCompanyDetail={({ jobTitle, industry, companyName }) =>
          void loadCompanyDetail({ jobTitle, industry, companyName })
        }
      />
    ),
  }));

  return (
    <PageContainer className={styles.pageContainer} title={false} breadcrumb={undefined}>
      <div className={styles.shell}>
        <div className={styles.hero}>
          <div className={styles.eyebrow}>
            <FileSearchOutlined />
            职业探索与岗位匹配
          </div>
          <Typography.Title level={2} style={{ marginTop: 0, marginBottom: 10, color: '#12314d' }}>
            先看最契合的职业目标，再沿着岗位与行业图谱继续细化目标
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0, color: 'rgba(18, 49, 77, 0.72)', lineHeight: 1.8 }}>
            页面会先基于最近一次已保存的学生 12 维画像，自动给出 1 主 1 备 的目标报告；你也可以在下方继续选择岗位和行业，实时生成新的匹配报告。
          </Typography.Paragraph>
        </div>

        <Card
          className={styles.sectionCard}
          title="自动推荐报告"
          extra={
            <Button icon={<ReloadOutlined />} onClick={() => void loadInit()} loading={initLoading}>
              刷新推荐
            </Button>
          }
        >
          {initError ? (
            <Alert showIcon type="error" message={initError} />
          ) : initLoading ? (
            <Spin />
          ) : !initPayload?.available || !recommendationItems.length ? (
            <Empty
              description={initPayload?.message || '暂无可展示的自动推荐报告'}
            >
              <Button type="primary" onClick={() => history.push('/student-competency-profile')}>
                去生成学生画像
              </Button>
            </Empty>
          ) : (
            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              <Space wrap>
                <Tag color="blue">默认主报告</Tag>
                <Tag color="cyan">1 主 1 备</Tag>
                <Tag color="processing">
                  已识别 {initPayload.source?.active_dimension_count || 0} 个有效维度
                </Tag>
              </Space>
              <Tabs
                activeKey={activeRecommendation?.report_id}
                onChange={(value) => setActiveRecommendationId(value)}
                items={recommendationTabs}
              />
            </Space>
          )}
        </Card>

        <Card className={styles.sectionCard} style={{ marginTop: 24 }}>
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <Typography.Title level={3} style={{ margin: 0, color: '#12314d' }}>
                  自定义搜索
                </Typography.Title>
                <Typography.Paragraph className={styles.graphLead}>
                  请选择你感兴趣的职业、行业，系统会帮你匹配契合度。
                </Typography.Paragraph>
              </div>
              <Space wrap>
                <Tag color="blue">{customPayload?.reports.length || 0} 个行业报告</Tag>
                <Tag color="cyan">辅助图谱</Tag>
              </Space>
            </div>

            <Form<{ job_title?: string; industries?: string[] }> form={selectorForm} layout="vertical">
              <Row gutter={[16, 8]}>
                <Col xs={24} md={10}>
                  <Form.Item
                    label="目标岗位"
                    name="job_title"
                    rules={[{ required: true, message: '请先选择目标岗位' }]}
                  >
                    <Select
                      id="job_title"
                      showSearch
                      allowClear
                      placeholder="请选择唯一岗位"
                      options={jobOptions}
                      optionFilterProp="label"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={10}>
                  <Form.Item label="行业范围" name="industries">
                    <Select
                      id="industries"
                      mode="multiple"
                      allowClear
                      showSearch
                      loading={industryLoading}
                      disabled={!selectedJobTitle}
                      placeholder={selectedJobTitle ? '可多选行业' : '请先选择岗位'}
                      options={industryOptions}
                      optionFilterProp="label"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={4}>
                  <Form.Item label="操作">
                    <Button
                      type="primary"
                      icon={<SearchOutlined />}
                      disabled={!canSubmitCustomSearch}
                      loading={customLoading}
                      onClick={() => {
                        if (!selectedJobTitle || !selectedIndustries.length) return;
                        void loadCustomReport(selectedJobTitle, selectedIndustries);
                      }}
                    >
                      立即更新
                    </Button>
                  </Form.Item>
                </Col>
              </Row>
            </Form>

            {customError ? <Alert showIcon type="error" message={customError} /> : null}
            {hasPendingSearchChanges ? (
              <Alert
                showIcon
                type="info"
                message="条件已变更，点击立即更新后刷新结果。"
              />
            ) : null}

            {industryTabs.length ? (
              <Tabs
                activeKey={activeIndustryReport?.industry || activeIndustry}
                onChange={(value) => {
                  setActiveIndustry(value);
                  setActiveGraphNodeId(buildIndustryNodeId(value));
                }}
                items={industryTabs}
              />
            ) : null}

            <div>
              {!customPayload?.graph_payload && !customLoading ? (
                <Card style={{ borderRadius: 20 }}>
                  <Empty description="请选择感兴趣的职业和行业后，点击立即更新查看匹配结果。" />
                </Card>
              ) : (
                <Card
                  title="图谱辅助浏览"
                  style={{ borderRadius: 20 }}
                  styles={{ body: { padding: 20 } }}
                >
                  <Typography.Paragraph style={{ color: 'rgba(18, 49, 77, 0.72)', marginTop: 0 }}>
                    图谱用于辅助浏览行业和公司分布。点击行业节点可切换行业报告，点击公司节点可查看招聘与公司详情。
                  </Typography.Paragraph>
                  <div className={styles.graphStage}>
                    {customLoading && !customPayload?.graph_payload ? (
                      <div
                        style={{
                          minHeight: 560,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Spin size="large" />
                      </div>
                    ) : (
                      <div
                        ref={graphContainerRef}
                        style={{ width: '100%', height: 560 }}
                        data-testid="career-report-graph"
                      />
                    )}
                  </div>
                </Card>
              )}
            </div>
          </Space>
        </Card>
      </div>

      <Drawer
        title={companyDetail?.summary.company_name || '公司详情'}
        width={680}
        open={companyDetailOpen}
        destroyOnHidden={false}
        onClose={() => {
          setCompanyDetailOpen(false);
          setCompanyDetail(undefined);
          setCompanyDetailError(undefined);
        }}
      >
        {companyDetailLoading ? (
          <Spin />
        ) : companyDetailError ? (
          <Alert showIcon type="error" message={companyDetailError} />
        ) : companyDetail ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card style={{ borderRadius: 18 }}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Space wrap>
                  <Tag color="blue">{companyDetail.summary.industry}</Tag>
                  <Tag>{companyDetail.summary.job_title}</Tag>
                  <Tag color="cyan">{companyDetail.summary.posting_count} 条原始记录</Tag>
                </Space>
                <Space wrap>
                  {companyDetail.overview.addresses.map((item) => (
                    <Tag key={`address-${item}`}>{item}</Tag>
                  ))}
                  {companyDetail.overview.company_sizes.map((item) => (
                    <Tag key={`size-${item}`}>{item}</Tag>
                  ))}
                  {companyDetail.overview.company_types.map((item) => (
                    <Tag key={`type-${item}`}>{item}</Tag>
                  ))}
                </Space>
              </Space>
            </Card>

            {companyDetail.postings.map((posting) => (
              <Card key={posting.id} style={{ borderRadius: 18 }}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space wrap>
                    <Typography.Text strong>{posting.job_title}</Typography.Text>
                    {posting.salary_range ? <Tag>{posting.salary_range}</Tag> : null}
                    {posting.address ? <Tag>{posting.address}</Tag> : null}
                  </Space>
                  <div>
                    <Typography.Text strong>招聘信息</Typography.Text>
                    <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
                      {posting.job_detail || '暂无招聘信息'}
                    </Typography.Paragraph>
                  </div>
                  <div>
                    <Typography.Text strong>公司信息</Typography.Text>
                    <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginTop: 8, marginBottom: 0 }}>
                      {posting.company_detail || '暂无公司信息'}
                    </Typography.Paragraph>
                  </div>
                </Space>
              </Card>
            ))}
          </Space>
        ) : (
          <Empty description="请选择公司查看招聘与公司详情" />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default JobExplorationMatchPage;
