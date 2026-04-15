import {
  Alert,
  Button,
  Card,
  Checkbox,
  Collapse,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Progress,
  Result,
  Skeleton,
  Space,
  Spin,
  Steps,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { ArrowLeftOutlined, CheckCircleFilled, UploadOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createSnailLearningPathReview,
  generateSnailLearningPath,
  listSnailLearningPathReviews,
} from '@/services/ant-design-pro/api';
import {
  PHASE_LABELS,
  REVIEW_UPLOAD_ACCEPT,
  buildSnailReviewFormData,
  buildWorkspaceStorageKey,
  getActionTaskDescription,
  getActionTaskTitle,
  getCheckedResourceUrlsForPhase,
  getCompletedModuleIds,
  getCurrentPhaseKey,
  getModuleCompletionStatus,
  getModuleDisplayDescription,
  getModuleDisplayTitle,
  getModuleResources,
  getOverallProgress,
  getPhaseProgress,
  getResourceCompletionId,
  loadCompletedResources,
  loadPendingReport,
  saveCompletedModules,
  saveCompletedResources,
  type LearningPathPhaseKey,
} from './learningPathUtils';

const { Title, Text } = Typography;
const { TextArea } = Input;

type ReviewFormValues = { summary: string };

const MONTHLY_RECOMMENDATION_LABELS: Record<API.SnailMonthlyReviewReport['recommendation'], string> = {
  continue: '继续当前阶段',
  strengthen: '先补强',
  advance: '准备进入下一阶段',
};

const useStyles = createStyles(({ css, token }) => ({
  page: css`
    max-width: 1120px;
    margin: 0 auto;
  `,
  introCard: css`
    margin-bottom: 16px;
  `,
  introHeader: css`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
  `,
  summaryRow: css`
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) repeat(2, minmax(180px, 0.85fr));
    gap: 12px;
    margin-top: 16px;
    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    } else {
      setLoading(false);
    }
  `,
  summaryPrimary: css`
    border-color: ${token.colorPrimaryBorder};
    background: ${token.colorPrimaryBg};
  `,
  summaryLead: css`
    display: grid;
    gap: 10px;
  `,
  summaryStageMeta: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  `,
  summaryNextModule: css`
    display: grid;
    gap: 6px;
  `,
  metricValue: css`
    margin: 8px 0 10px;
    line-height: 1;
  `,
  phaseMotion: css`
    animation: phaseFadeIn 180ms ease-out;
    @keyframes phaseFadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  currentPhaseCard: css`
    border-color: ${token.colorPrimaryBorder};
    box-shadow: 0 0 0 2px ${token.colorPrimaryBg};
  `,
  section: css`
    margin-bottom: 20px;
  `,
  routeList: css`
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    overflow: hidden;
  `,
  routeItem: css`
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    &:last-child {
      border-bottom: none;
    }
  `,
  routeItemCurrent: css`
    background: ${token.colorPrimaryBg};
  `,
  routeItemMeta: css`
    display: grid;
    gap: 6px;
    min-width: 0;
  `,
  routeItemHead: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  `,
  routeItemDesc: css`
    color: ${token.colorTextSecondary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  routeItemStats: css`
    display: grid;
    justify-items: end;
    gap: 6px;
    min-width: 88px;
  `,
  resourceModule: css`
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    padding: 14px 16px;
  `,
  resourceRow: css`
    display: flex;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    @media (max-width: 768px) {
      flex-direction: column;
    }
  `,
  resourceMeta: css`
    display: grid;
    gap: 4px;
  `,
  compactPhaseRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 12px;
  `,
  compactPhaseTag: css`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid ${token.colorSuccessBorder};
    background: ${token.colorSuccessBg};
    color: ${token.colorSuccessText};
  `,
  reviewBox: css`
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    padding: 16px;
    background: #fff;
  `,
  phaseCardTitle: css`
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  `,
  phaseCardTitleText: css`
    margin: 0;
  `,
}));

const LearningPathPage: React.FC = () => {
  const { styles, cx } = useStyles();
  const [loading, setLoading] = useState(() => !!loadPendingReport());
  const [loadError, setLoadError] = useState<string>();
  const [workspace, setWorkspace] = useState<API.PlanWorkspacePayload>();
  const [report, setReport] = useState<API.CareerDevelopmentMatchReport | null>(() => loadPendingReport());
  const [resourceCompletedSet, setResourceCompletedSet] = useState<Set<string>>(new Set());
  const [activePhaseKey, setActivePhaseKey] = useState<LearningPathPhaseKey>();
  const [reviewHistory, setReviewHistory] = useState<API.SnailLearningPathReviewPayload[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [submittingReviewType, setSubmittingReviewType] = useState<'weekly' | 'monthly'>();
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const [activeReviewTab, setActiveReviewTab] = useState<'weekly' | 'monthly'>('weekly');
  const [weeklyFileList, setWeeklyFileList] = useState<UploadFile[]>([]);
  const [monthlyFileList, setMonthlyFileList] = useState<UploadFile[]>([]);
  const [weeklyForm] = Form.useForm<ReviewFormValues>();
  const [monthlyForm] = Form.useForm<ReviewFormValues>();
  const learningRouteRef = useRef<HTMLDivElement | null>(null);
  // Track the last report_id to detect when user navigates from resume parsing with a new report
  const lastReportIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentReport = loadPendingReport();
    setReport(currentReport);

    if (!currentReport) {
      setLoadError('缺少职业匹配结果。');
      setWorkspace(undefined);
      setLoading(false);
      lastReportIdRef.current = undefined;
      return;
    }

    // report_id changed → user came from resume parsing with a new report; reload workspace
    if (lastReportIdRef.current !== currentReport.report_id) {
      lastReportIdRef.current = currentReport.report_id;
      setWorkspace(undefined); // clear stale workspace before showing loading
      setLoading(true);
      setLoadError(undefined);
      generateSnailLearningPath(currentReport, { skipErrorHandler: true })
        .then((response) => setWorkspace(response?.data))
        .catch((error: any) => setLoadError(error?.message || '学习路径加载失败。'))
        .finally(() => setLoading(false));
    }
    // If report_id unchanged, keep current workspace state (e.g. client-side nav back without new report)
  }, []);

  const storageKey = useMemo(() => buildWorkspaceStorageKey(workspace, report), [workspace, report]);
  useEffect(() => {
    setResourceCompletedSet(loadCompletedResources(storageKey));
  }, [storageKey]);

  const phases = workspace?.growth_plan_phases || [];
  const completedSet = useMemo(() => getCompletedModuleIds(phases, resourceCompletedSet), [phases, resourceCompletedSet]);
  const overallProgress = useMemo(() => getOverallProgress(phases, completedSet), [phases, completedSet]);
  const currentPhaseKey = useMemo(() => getCurrentPhaseKey(phases, completedSet), [phases, completedSet]);
  const currentPhaseIndex = useMemo(() => phases.findIndex((item) => item.phase_key === currentPhaseKey), [phases, currentPhaseKey]);

  useEffect(() => {
    if (!phases.length) return;
    setActivePhaseKey((previous) => {
      if (previous && phases.some((item) => item.phase_key === previous)) return previous;
      return currentPhaseKey;
    });
  }, [phases, currentPhaseKey]);

  const activePhase = useMemo(
    () => phases.find((item) => item.phase_key === activePhaseKey) || phases[currentPhaseIndex] || phases[0],
    [activePhaseKey, currentPhaseIndex, phases],
  );
  const nextModule = useMemo(
    () => activePhase?.learning_modules.find((module) => !completedSet.has(module.module_id)),
    [activePhase, completedSet],
  );
  const activePhaseProgress = useMemo(
    () => (activePhase ? getPhaseProgress(activePhase, completedSet) : { total: 0, completed: 0, percent: 0 }),
    [activePhase, completedSet],
  );
  const checkedResourceUrls = useMemo(
    () => getCheckedResourceUrlsForPhase(activePhase, resourceCompletedSet),
    [activePhase, resourceCompletedSet],
  );
  const completedPhasesBeforeActive = useMemo(() => {
    if (!activePhase) return [];
    const activeIndex = phases.findIndex((item) => item.phase_key === activePhase.phase_key);
    return phases.slice(0, activeIndex).filter((phase) => {
      const progress = getPhaseProgress(phase, completedSet);
      return progress.total > 0 && progress.completed === progress.total;
    });
  }, [activePhase, completedSet, phases]);

  useEffect(() => {
    if (!workspace?.workspace_id || !activePhase?.phase_key) return;
    setReviewLoading(true);
    listSnailLearningPathReviews(
      workspace.workspace_id,
      { phase_key: activePhase.phase_key },
      { skipErrorHandler: true },
    )
      .then((response) => setReviewHistory(response?.data || []))
      .catch(() => setReviewHistory([]))
      .finally(() => setReviewLoading(false));
  }, [workspace?.workspace_id, activePhase?.phase_key]);

  const latestWeeklyReview = reviewHistory.find((item) => item.review_type === 'weekly');
  const latestMonthlyReview = reviewHistory.find((item) => item.review_type === 'monthly');

  const handleContinue = () => {
    learningRouteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePhaseChange = (nextIndex: number) => {
    const phase = phases[nextIndex];
    if (!phase) return;
    setActivePhaseKey(phase.phase_key);
    setReviewDrawerOpen(false);
  };

  const handleToggleResource = (
    phaseKey: LearningPathPhaseKey,
    moduleId: string,
    resource: ReturnType<typeof getModuleResources>[number],
    index: number,
    checked: boolean,
  ) => {
    const resourceId = getResourceCompletionId(phaseKey, moduleId, resource, index);
    setResourceCompletedSet((previous) => {
      const next = new Set(previous);
      if (checked) next.add(resourceId);
      else next.delete(resourceId);
      saveCompletedResources(storageKey, next);
      saveCompletedModules(storageKey, getCompletedModuleIds(phases, next));
      return next;
    });
  };

  const uploadProps = (
    fileList: UploadFile[],
    setter: React.Dispatch<React.SetStateAction<UploadFile[]>>,
  ): UploadProps => ({
    accept: REVIEW_UPLOAD_ACCEPT,
    beforeUpload: () => false,
    multiple: true,
    fileList,
    onChange: ({ fileList: next }) => setter(next),
  });

  const nativeFiles = (fileList: UploadFile[]) =>
    fileList.map((item) => item.originFileObj).filter((item): item is File => item instanceof File);

  const submitReview = async (reviewType: 'weekly' | 'monthly') => {
    if (!workspace?.workspace_id || !activePhase || !report) return;
    const form = reviewType === 'weekly' ? weeklyForm : monthlyForm;
    const fileList = reviewType === 'weekly' ? weeklyFileList : monthlyFileList;
    try {
      const values = await form.validateFields();
      const formData = buildSnailReviewFormData({
        reviewType,
        phase: activePhase,
        checkedResourceUrls,
        userPrompt: values.summary,
        report,
        progress: activePhaseProgress,
        files: nativeFiles(fileList),
      });
      setSubmittingReviewType(reviewType);
      const response = await createSnailLearningPathReview(workspace.workspace_id, formData, { skipErrorHandler: true });
      if (!response?.data) throw new Error('未收到检查结果。');
      setReviewHistory((current) => [response.data, ...current.filter((item) => item.review_id !== response.data.review_id)]);
      form.resetFields();
      if (reviewType === 'weekly') setWeeklyFileList([]);
      else setMonthlyFileList([]);
      message.success(reviewType === 'weekly' ? '周检查已生成。' : '月评已生成。');
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '检查生成失败。');
    } finally {
      setSubmittingReviewType(undefined);
    }
  };

  const pickSummaryLine = (text?: string) =>
    (text || '')
      .split(/[。！？!?]/)[0]
      .replace(/\s+/g, ' ')
      .trim();

  const limitKeywords = (items?: string[], count = 3) => (items || []).filter(Boolean).slice(0, count);

  const renderWeeklyReport = (record?: API.SnailLearningPathReviewPayload) => {
    const reportData = record?.weekly_report;
    if (!reportData) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前阶段还没有周检查结果" />;
    const doneKeywords = limitKeywords(reportData.focus_keywords.length ? reportData.focus_keywords : reportData.progress_keywords);
    const goalKeywords = limitKeywords(reportData.gap_keywords, 2);
    const actionKeywords = limitKeywords(reportData.action_keywords);
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert type="info" showIcon message={pickSummaryLine(reportData.headline) || '这周有推进，继续当前节奏。'} />
        <Card size="small" title="这周做了什么">
          {doneKeywords.length ? (
            <Space wrap style={{ marginBottom: 8 }}>
              {doneKeywords.map((item) => (
                <Tag color="blue" key={item}>{item}</Tag>
              ))}
            </Space>
          ) : null}
          <Text>{pickSummaryLine(reportData.progress_assessment) || '这周有学习记录。'}</Text>
        </Card>
        <Card size="small" title="离目标还有多远">
          {goalKeywords.length ? (
            <Space wrap style={{ marginBottom: 8 }}>
              {goalKeywords.map((item) => (
                <Tag color="gold" key={item}>{item}</Tag>
              ))}
            </Space>
          ) : null}
          <Text>{pickSummaryLine(reportData.goal_gap_summary) || '还需要继续推进。'}</Text>
        </Card>
        <Card size="small" title="下周做什么">
          {actionKeywords.length ? (
            <Space wrap style={{ marginBottom: 8 }}>
              {actionKeywords.map((item) => (
                <Tag color="green" key={item}>{item}</Tag>
              ))}
            </Space>
          ) : null}
          <Text>{pickSummaryLine(reportData.next_action) || '继续当前阶段任务。'}</Text>
        </Card>
        <Collapse
          size="small"
          items={[
            {
              key: 'weekly-detail',
              label: '查看详细分析',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Card size="small" title="详细结论">
                    <Text>{reportData.progress_assessment}</Text>
                  </Card>
                  {reportData.highlights.length ? (
                    <Card size="small" title="本周有效学习点">
                      <List size="small" dataSource={reportData.highlights} renderItem={(item) => <List.Item>{item}</List.Item>} />
                    </Card>
                  ) : null}
                  {reportData.blockers.length ? (
                    <Card size="small" title="当前阻碍">
                      <List size="small" dataSource={reportData.blockers} renderItem={(item) => <List.Item>{item}</List.Item>} />
                    </Card>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </Space>
    );
  };

  const renderMonthlyReport = (record?: API.SnailLearningPathReviewPayload) => {
    const reportData = record?.monthly_report;
    if (!reportData) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前阶段还没有月评结果" />;
    const monthKeywords = limitKeywords(reportData.focus_keywords.length ? reportData.focus_keywords : reportData.progress_keywords);
    const goalKeywords = limitKeywords(reportData.gap_keywords, 2);
    const nextActions = reportData.next_actions.filter(Boolean).slice(0, 3);
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type={reportData.recommendation === 'advance' ? 'success' : 'info'}
          showIcon
          message={pickSummaryLine(reportData.headline) || '本月有推进，继续当前阶段。'}
        />
        <Card size="small" title="本月完成了什么">
          {monthKeywords.length ? (
            <Space wrap style={{ marginBottom: 8 }}>
              {monthKeywords.map((item) => (
                <Tag color="blue" key={item}>{item}</Tag>
              ))}
            </Space>
          ) : null}
          <Text>{pickSummaryLine(reportData.monthly_summary) || '本月有持续学习。'}</Text>
        </Card>
        <Card size="small" title="现在在哪个阶段">
          <Space wrap style={{ marginBottom: 8 }}>
            <Tag color="processing">{activePhase?.phase_label || PHASE_LABELS[currentPhaseKey]}</Tag>
            <Tag color={reportData.recommendation === 'advance' ? 'success' : 'default'}>
              {MONTHLY_RECOMMENDATION_LABELS[reportData.recommendation]}
            </Tag>
            {goalKeywords.map((item) => (
              <Tag color="gold" key={item}>{item}</Tag>
            ))}
          </Space>
          {reportData.progress_keywords.length ? (
            <Space wrap style={{ marginBottom: 8 }}>
              {reportData.progress_keywords.map((item) => (
                <Tag key={item}>{item}</Tag>
              ))}
            </Space>
          ) : null}
          <Text>{pickSummaryLine(reportData.phase_progress_summary) || '继续当前阶段。'}</Text>
        </Card>
        <Card size="small" title="下月重点做什么">
          {reportData.action_keywords.length ? (
            <Space wrap style={{ marginBottom: 8 }}>
              {limitKeywords(reportData.action_keywords).map((item) => (
                <Tag color="green" key={item}>{item}</Tag>
              ))}
            </Space>
          ) : null}
          {nextActions.length ? (
            <List size="small" dataSource={nextActions} renderItem={(item) => <List.Item>{item}</List.Item>} />
          ) : (
            <Text>{pickSummaryLine(reportData.gap_assessment) || '继续推进当前模块。'}</Text>
          )}
        </Card>
        <Collapse
          size="small"
          items={[
            {
              key: 'monthly-detail',
              label: '查看详细分析',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Card size="small" title="阶段差距">
                    <Text>{reportData.gap_assessment}</Text>
                  </Card>
                  {reportData.focus_points.length ? (
                    <Card size="small" title="本月重点">
                      <List size="small" dataSource={reportData.focus_points} renderItem={(item) => <List.Item>{item}</List.Item>} />
                    </Card>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </Space>
    );
  };

  const renderReviewPane = (reviewType: 'weekly' | 'monthly') => {
    const isWeekly = reviewType === 'weekly';
    const form = isWeekly ? weeklyForm : monthlyForm;
    const fileList = isWeekly ? weeklyFileList : monthlyFileList;
    const historyList = reviewHistory.filter((item) => item.review_type === reviewType);
    const latest = isWeekly ? latestWeeklyReview : latestMonthlyReview;
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type={checkedResourceUrls.length ? 'info' : 'warning'}
          showIcon
          message={isWeekly ? '填写本周学习总结并生成周检查' : '填写本月学习总结并生成月评'}
          description={
            checkedResourceUrls.length
              ? '本次分析会使用当前阶段已打勾的网站、你的总结以及上传材料。'
              : '当前阶段还没有已打勾网站。你仍可先填写学习总结并上传文档材料。'
          }
        />
        <div className={styles.reviewBox}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Text type="secondary">本次将用于分析的网站</Text>
              <div style={{ marginTop: 8 }}>
                {checkedResourceUrls.length ? (
                  <Space wrap>
                    {checkedResourceUrls.map((url) => (
                      <Tag key={url}>{url}</Tag>
                    ))}
                  </Space>
                ) : (
                  <Text type="secondary">当前阶段暂无已打勾网站</Text>
                )}
              </div>
            </div>
            <Form form={form} layout="vertical">
              <Form.Item
                label={isWeekly ? '请输入你本周学到了什么内容' : '请输入你本月学到了什么内容'}
                name="summary"
                rules={[{ required: true, message: isWeekly ? '请填写本周学习总结' : '请填写本月学习总结' }]}
              >
                <TextArea autoSize={{ minRows: 4, maxRows: 8 }} />
              </Form.Item>
            </Form>
            <Upload {...uploadProps(fileList, isWeekly ? setWeeklyFileList : setMonthlyFileList)}>
              <Button icon={<UploadOutlined />}>上传学习材料</Button>
            </Upload>
            <Text type="secondary">
              支持 txt / md / docx / json / csv / html / 代码文件，系统会抽取可读文本后参与分析。
            </Text>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <Text type="secondary">
                当前阶段：{activePhase?.phase_label || (activePhase ? PHASE_LABELS[activePhase.phase_key] : '')}
              </Text>
              <Button type="primary" loading={submittingReviewType === reviewType} onClick={() => void submitReview(reviewType)}>
                {isWeekly ? '生成周检查' : '生成月评'}
              </Button>
            </div>
          </Space>
        </div>
        <Card size="small" title={isWeekly ? '最新周检查' : '最新月评'}>
          {reviewLoading ? <Spin /> : isWeekly ? renderWeeklyReport(latest) : renderMonthlyReport(latest)}
        </Card>
        <Card size="small" title={isWeekly ? `周检查历史（${historyList.length}）` : `月评历史（${historyList.length}）`}>
          {reviewLoading ? (
            <Spin />
          ) : !historyList.length ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史记录" />
          ) : isWeekly ? (
            <List
              dataSource={historyList}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                      <Text strong>{new Date(item.created_at).toLocaleString('zh-CN')}</Text>
                      <Tag color="blue">周检查</Tag>
                    </Space>
                    <Text>{item.weekly_report?.headline || '周检查'}</Text>
                    <Text type="secondary">{item.weekly_report?.next_action || '暂无后续建议'}</Text>
                  </Space>
                </List.Item>
              )}
            />
          ) : (
            <Collapse
              items={historyList.map((item) => ({
                key: `${item.review_id}`,
                label: (
                  <Space wrap>
                    <Text strong>{new Date(item.created_at).toLocaleString('zh-CN')}</Text>
                    <Tag color="processing">
                      {item.monthly_report ? MONTHLY_RECOMMENDATION_LABELS[item.monthly_report.recommendation] : '月评'}
                    </Tag>
                  </Space>
                ),
                children: renderMonthlyReport(item),
              }))}
            />
          )}
        </Card>
      </Space>
    );
  };

  const openReviewDrawer = (reviewType: 'weekly' | 'monthly' = 'weekly') => {
    setActiveReviewTab(reviewType);
    setReviewDrawerOpen(true);
  };

  if (loadError || !report) {
    return (
      <PageContainer title={false}>
        <div className={styles.page}>
          <Result
            status="info"
            title="蜗牛学习路径"
            subTitle={loadError || '暂无可用结果。'}
            extra={<Button type="primary" onClick={() => history.push('/student-competency-profile')}>返回职业匹配</Button>}
          />
        </div>
      </PageContainer>
    );
  }
  if (loading) {
    return (
      <PageContainer title={false}>
        <div className={styles.page} data-testid="learning-path-skeleton">
          <Card className={styles.introCard}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div className={styles.introHeader}>
                <div style={{ minWidth: 280 }}>
                  <Skeleton.Button active size="small" style={{ width: 140, marginBottom: 12 }} />
                  <Skeleton.Input active style={{ width: 260, height: 32 }} />
                </div>
                <Space direction="vertical" size={8} align="end">
                  <Skeleton.Button active size="small" style={{ width: 96 }} />
                  <Skeleton.Button active size="small" style={{ width: 128 }} />
                </Space>
              </div>
              <div className={styles.summaryRow}>
                {[0, 1, 2].map((item) => (
                  <Card key={item}>
                    <Skeleton active paragraph={{ rows: 2 }} title={false} />
                  </Card>
                ))}
              </div>
            </Space>
          </Card>
          <Card className={styles.section}>
            <Skeleton active title paragraph={{ rows: 1 }} />
          </Card>
          <Card className={styles.currentPhaseCard}>
            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              <Skeleton active paragraph={{ rows: 2 }} />
              <div>
                <Title level={5}>去哪里学</Title>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {[0, 1].map((item) => (
                    <div key={item} className={styles.resourceModule}>
                      <Skeleton active paragraph={{ rows: 3 }} />
                    </div>
                  ))}
                </Space>
              </div>
            </Space>
          </Card>
        </div>
      </PageContainer>
    );
  }
  if (!workspace || !activePhase) {
    return <PageContainer title={false}><div className={styles.page}><Empty description="暂无学习路径" /></div></PageContainer>;
  }

  const activeIndex = phases.findIndex((item) => item.phase_key === activePhase.phase_key);
  const activeStatus =
    activePhaseProgress.total > 0 && activePhaseProgress.completed === activePhaseProgress.total
      ? '已完成'
      : activePhase.phase_key === currentPhaseKey
        ? '进行中'
        : '查看中';

  return (
    <PageContainer title={false}>
      <div className={styles.page}>
        <Card className={styles.introCard}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div className={styles.introHeader}>
              <div>
                <Space wrap size={12}>
                  <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => history.push('/student-competency-profile')}>
                    返回职业匹配
                  </Button>
                  <Tag color="processing">{report.target_title}</Tag>
                  {report.industry ? <Tag>{report.industry}</Tag> : null}
                </Space>
                <Title level={3} style={{ margin: '8px 0 0' }}>蜗牛学习路径</Title>
              </div>
              <Space direction="vertical" size={8} align="end">
                <Text type="secondary">匹配度 {Math.round(report.overall_match)}%</Text>
              </Space>
            </div>
            <div className={styles.summaryRow}>
              <Card size="small" className={styles.summaryPrimary}>
                <div className={styles.summaryLead}>
                  <div className={styles.summaryStageMeta}>
                    <Text type="secondary">阶段</Text>
                    <Tag color="blue">{activePhase.time_horizon}</Tag>
                  </div>
                  <Title level={2} className={styles.phaseCardTitleText}>
                    {activePhase.phase_label || PHASE_LABELS[activePhase.phase_key]}
                  </Title>
                  <div className={styles.summaryNextModule}>
                    <Text type="secondary">当前模块</Text>
                    <Text strong>{nextModule ? getModuleDisplayTitle(nextModule) : '已完成'}</Text>
                  </div>
                  <Button type="primary" onClick={handleContinue}>继续学习</Button>
                </div>
              </Card>
              <Card size="small">
                <Text type="secondary">整体进度</Text>
                <Title level={3} className={styles.metricValue}>{overallProgress.percent}%</Title>
                <Progress percent={overallProgress.percent} showInfo={false} />
              </Card>
              <Card size="small">
                <Text type="secondary">当前阶段进度</Text>
                <Title level={3} className={styles.metricValue}>{activePhaseProgress.completed}/{activePhaseProgress.total}</Title>
                <Progress percent={activePhaseProgress.percent} showInfo={false} />
              </Card>
            </div>
          </Space>
        </Card>

        <Card
          title="路径总览"
          style={{ marginBottom: 16 }}
          extra={
            <Button type="primary" onClick={() => openReviewDrawer('weekly')}>
              周检查 / 月检查
            </Button>
          }
        >
          <Steps
            type="navigation"
            current={Math.max(activeIndex, 0)}
            onChange={handlePhaseChange}
            items={phases.map((phase) => {
              const progress = getPhaseProgress(phase, completedSet);
              return {
                title: phase.phase_label || PHASE_LABELS[phase.phase_key],
                description:
                  progress.total > 0 && progress.completed === progress.total
                    ? '已完成'
                    : phase.time_horizon,
                status:
                  progress.total > 0 && progress.completed === progress.total
                    ? 'finish'
                    : phase.phase_key === activePhase.phase_key || phase.phase_key === currentPhaseKey
                      ? 'process'
                      : 'wait',
              };
            })}
          />
        </Card>

        {completedPhasesBeforeActive.length ? (
          <div className={styles.compactPhaseRow}>
            {completedPhasesBeforeActive.map((phase) => (
              <div key={phase.phase_key} className={styles.compactPhaseTag}>
                <CheckCircleFilled />
                <span>已完成 {phase.phase_label || PHASE_LABELS[phase.phase_key]} 计划</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className={styles.phaseMotion}>
          <Card
            className={styles.currentPhaseCard}
            title={
              <div className={styles.phaseCardTitle}>
                <Title level={2} className={styles.phaseCardTitleText}>
                  {activePhase.phase_label || PHASE_LABELS[activePhase.phase_key]}
                </Title>
                <Tag>{activePhase.time_horizon}</Tag>
              </div>
            }
            extra={<Tag color={activeStatus === '已完成阶段' ? 'success' : 'blue'}>{activeStatus}</Tag>}
          >

            <div className={styles.section}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Title level={5} style={{ margin: 0 }}>阶段进度</Title>
                <Text type="secondary">{activePhaseProgress.completed}/{activePhaseProgress.total}</Text>
              </Space>
              <Progress percent={activePhaseProgress.percent} />
            </div>

            <div className={styles.section} ref={learningRouteRef}>
              <Title level={5}>学习模块</Title>
              {activePhase.learning_modules.length ? (
                <div className={styles.routeList}>
                  {activePhase.learning_modules.map((module) => {
                    const moduleStatus = getModuleCompletionStatus(activePhase.phase_key, module, resourceCompletedSet);
                    const isCurrentModule = !moduleStatus.done && nextModule?.module_id === module.module_id;
                    const moduleStateLabel = moduleStatus.done ? '已完成' : isCurrentModule ? '进行中' : '未开始';
                    const moduleStateColor = moduleStatus.done ? 'success' : isCurrentModule ? 'processing' : 'default';
                    return (
                      <div
                        key={module.module_id}
                        className={cx(styles.routeItem, isCurrentModule && styles.routeItemCurrent)}
                      >
                        <div className={styles.routeItemMeta}>
                          <div className={styles.routeItemHead}>
                            <Text strong>{getModuleDisplayTitle(module)}</Text>
                            <Tag color={moduleStateColor}>{moduleStateLabel}</Tag>
                          </div>
                          <div className={styles.routeItemDesc}>{getModuleDisplayDescription(module)}</div>
                        </div>
                        <div className={styles.routeItemStats}>
                          <Text strong>{moduleStatus.completed}/{moduleStatus.total}</Text>
                          <Text type="secondary">进度</Text>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无学习模块" />
              )}
            </div>

            <div className={styles.section}>
              <Title level={5}>去哪里学</Title>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {activePhase.learning_modules.length ? activePhase.learning_modules.map((module) => {
                  const resources = getModuleResources(module, activePhase.phase_key, { allowFallback: false });
                  return (
                    <div key={module.module_id} className={styles.resourceModule}>
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <div>
                          <Text strong>{getModuleDisplayTitle(module)}</Text>
                        </div>
                        {resources.length ? (
                          <List
                          dataSource={resources}
                          renderItem={(resource, index) => {
                            const resourceId = getResourceCompletionId(activePhase.phase_key, module.module_id, resource, index);
                            const checked = resourceCompletedSet.has(resourceId);
                            return (
                              <List.Item>
                                <div className={styles.resourceRow}>
                                  <div className={styles.resourceMeta}>
                                    <Text strong>{resource.title}</Text>
                                    <Text type="secondary">学什么：{resource.learnWhat}</Text>
                                    <Text type="secondary">为什么学：{resource.whyLearn}</Text>
                                    <Text type="secondary">完成标准：{resource.doneWhen}</Text>
                                  </div>
                                  <Space direction="vertical" size={8} align="end">
                                    <Checkbox
                                      checked={checked}
                                      onChange={(event) =>
                                        handleToggleResource(activePhase.phase_key, module.module_id, resource, index, event.target.checked)
                                      }
                                    >
                                      已打卡
                                    </Checkbox>
                                    <Button type="link" href={resource.url} target="_blank">去学习</Button>
                                  </Space>
                                </div>
                              </List.Item>
                            );
                          }}
                          />
                        ) : (
                          <div data-testid={`resource-empty-${module.module_id}`}>
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description={
                                module.resource_status === 'failed'
                                  ? module.resource_error_message || '暂未生成可用学习资源'
                                  : '暂未生成可用学习资源'
                              }
                            />
                          </div>
                        )}
                      </Space>
                    </div>
                  );
                }) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无学习资源" />}
              </Space>
            </div>

            <div className={styles.section}>
              <Title level={5}>动手任务</Title>
              <List
                size="small"
                dataSource={activePhase.practice_actions}
                locale={{ emptyText: '暂无动手任务' }}
                renderItem={(action) => (
                  <List.Item>
                    <Space direction="vertical" size={4}>
                      <Text strong>{getActionTaskTitle(action)}</Text>
                      <Text type="secondary">{getActionTaskDescription(action)}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </div>

          </Card>
        </div>

        <Drawer
          title="周检查 / 月检查"
          placement="right"
          width={520}
          open={reviewDrawerOpen}
          onClose={() => setReviewDrawerOpen(false)}
          destroyOnClose={false}
        >
          <Tabs
            activeKey={activeReviewTab}
            onChange={(key) => setActiveReviewTab(key as 'weekly' | 'monthly')}
            items={[
              { key: 'weekly', label: '周检查', children: renderReviewPane('weekly') },
              { key: 'monthly', label: '月检查', children: renderReviewPane('monthly') },
            ]}
          />
        </Drawer>
      </div>
    </PageContainer>
  );
};

export default LearningPathPage;
