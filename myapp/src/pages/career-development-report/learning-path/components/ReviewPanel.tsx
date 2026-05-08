import { UploadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Empty,
  Input,
  List,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { createStyles } from 'antd-style';
import React, { useEffect, useState } from 'react';

const { Text } = Typography;
const { TextArea } = Input;

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    padding: 8px 0;
  `,
  reviewBox: css`
    background: ${token.colorBgLayout};
    border-radius: ${token.borderRadiusLG}px;
    padding: 16px;
  `,
  reviewMetaBlock: css`
    margin-top: 6px;
    padding: 8px;
    background: ${token.colorBgContainer};
    border-radius: ${token.borderRadiusSM}px;
    min-height: 36px;
  `,
  reviewActions: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  `,
}));

interface ReviewPanelProps {
  workspaceId: string;
  activePhase: API.GrowthPlanPhase;
  checkedResourceUrls: string[];
  report: API.CareerDevelopmentMatchReport;
  progress: { completed: number; total: number; percent: number };
  reviews: API.SnailLearningPathReviewPayload[];
  loading: boolean;
  submittingType?: 'weekly' | 'monthly';
  activeReviewType?: 'weekly' | 'monthly';
  onActiveReviewTypeChange?: (reviewType: 'weekly' | 'monthly') => void;
  onSubmitReview: (input: {
    reviewType: 'weekly' | 'monthly';
    summary: string;
    files: File[];
  }) => Promise<void> | void;
}

const MONTHLY_RECOMMENDATION_LABELS: Record<
  API.SnailMonthlyReviewReport['recommendation'],
  string
> = {
  continue: '继续当前路径',
  strengthen: '加强薄弱环节',
  advance: '进入下一阶段',
};

function buildUploadProps(
  fileList: UploadFile[],
  setFileList: (list: UploadFile[]) => void,
): UploadProps {
  return {
    fileList,
    beforeUpload: (file) => {
      setFileList([...fileList, file as unknown as UploadFile]);
      return false;
    },
    onRemove: () => {
      setFileList([]);
    },
    maxCount: 5,
    multiple: true,
    onChange: ({ fileList: next }) => setFileList(next),
  };
}

function nativeFiles(fileList: UploadFile[]): File[] {
  return fileList
    .map((item) => item.originFileObj ?? (item as unknown as File))
    .filter((item): item is File => item instanceof File);
}

function renderReport(
  record: API.SnailLearningPathReviewPayload,
  isWeekly: boolean,
) {
  if (isWeekly) {
    const r = record.weekly_report;
    if (!r) return null;
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message={r.headline || '这周有推进，继续当前节奏。'}
        />
        <Text>{r.progress_assessment || '这周有学习记录。'}</Text>
        {r.next_action && <Text type="secondary">下一步：{r.next_action}</Text>}
      </Space>
    );
  }

  const r = record.monthly_report;
  if (!r) return null;
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message={
          r.recommendation
            ? MONTHLY_RECOMMENDATION_LABELS[r.recommendation]
            : '本月总结'
        }
      />
      <Text>{r.monthly_summary || '本月有学习记录。'}</Text>
    </Space>
  );
}

export function ReviewPanel({
  activePhase,
  checkedResourceUrls,
  reviews,
  loading,
  submittingType,
  activeReviewType,
  onActiveReviewTypeChange,
  onSubmitReview,
}: ReviewPanelProps) {
  const { styles } = useStyles();
  const [internalActiveTab, setInternalActiveTab] = useState<
    'weekly' | 'monthly'
  >('weekly');
  const [summary, setSummary] = useState('');
  const [weeklyFileList, setWeeklyFileList] = useState<UploadFile[]>([]);
  const [monthlyFileList, setMonthlyFileList] = useState<UploadFile[]>([]);

  const activeTab = activeReviewType ?? internalActiveTab;
  const isWeekly = activeTab === 'weekly';
  const historyList = reviews.filter((r) => r.review_type === activeTab);
  const latest = historyList[0];

  const currentFileList = isWeekly ? weeklyFileList : monthlyFileList;
  const setCurrentFileList = isWeekly ? setWeeklyFileList : setMonthlyFileList;
  const latestTitle = isWeekly ? '最新周检查' : '最新月评';
  const historyTitle = isWeekly
    ? `周检查历史(${historyList.length})`
    : `月评历史(${historyList.length})`;

  useEffect(() => {
    setSummary('');
  }, [activeTab]);

  const handleTabChange = (nextTab: 'weekly' | 'monthly') => {
    if (!activeReviewType) {
      setInternalActiveTab(nextTab);
    }
    onActiveReviewTypeChange?.(nextTab);
  };

  const handleSubmit = async () => {
    if (!summary.trim()) return;
    await onSubmitReview({
      reviewType: activeTab,
      summary,
      files: nativeFiles(currentFileList),
    });
    setSummary('');
    if (isWeekly) setWeeklyFileList([]);
    else setMonthlyFileList([]);
  };

  return (
    <div className={styles.root}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Segmented
          value={activeTab}
          onChange={(value) => {
            handleTabChange(value as 'weekly' | 'monthly');
          }}
          options={[
            { label: '周检查', value: 'weekly' },
            { label: '月检查', value: 'monthly' },
          ]}
        />
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
              <div className={styles.reviewMetaBlock}>
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

            <TextArea
              placeholder={isWeekly ? '本周学到了什么？' : '本月学到了什么？'}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              autoSize={{ minRows: 4, maxRows: 8 }}
            />

            <Upload {...buildUploadProps(currentFileList, setCurrentFileList)}>
              <Button icon={<UploadOutlined />}>上传学习材料</Button>
            </Upload>
            <Text type="secondary" style={{ fontSize: 12 }}>
              支持 txt / md / docx / json / csv / html / 代码文件
            </Text>

            <div className={styles.reviewActions}>
              <Text type="secondary">当前阶段：{activePhase.phase_label}</Text>
              <Button
                type="primary"
                loading={submittingType === activeTab}
                onClick={() => void handleSubmit()}
                disabled={!summary.trim()}
              >
                {isWeekly ? '生成周检查' : '生成月评'}
              </Button>
            </div>
          </Space>
        </div>
        <Card size="small" title={latestTitle}>
          {loading ? (
            <Spin />
          ) : latest ? (
            renderReport(latest, isWeekly)
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={isWeekly ? '当前阶段还没有周检查结果' : '当前阶段还没有月评结果'}
            />
          )}
        </Card>
        <Card size="small" title={historyTitle}>
          {loading ? (
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
                      <Text strong>
                        {new Date(item.created_at).toLocaleString('zh-CN')}
                      </Text>
                      <Tag color="blue">周检查</Tag>
                    </Space>
                    <Text>{item.weekly_report?.headline || '周检查'}</Text>
                    <Text type="secondary">
                      {item.weekly_report?.next_action || '暂无后续建议'}
                    </Text>
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
                    <Text strong>
                      {new Date(item.created_at).toLocaleString('zh-CN')}
                    </Text>
                    <Tag color="processing">
                      {item.monthly_report
                        ? MONTHLY_RECOMMENDATION_LABELS[
                            item.monthly_report.recommendation
                          ]
                        : '月评'}
                    </Tag>
                  </Space>
                ),
                children: renderReport(item, false),
              }))}
            />
          )}
        </Card>
      </Space>
    </div>
  );
}
