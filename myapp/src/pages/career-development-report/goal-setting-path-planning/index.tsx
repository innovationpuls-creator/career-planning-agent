import {
  DeleteOutlined,
  FileSearchOutlined,
  FlagOutlined,
  NodeIndexOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Empty,
  Progress,
  Space,
  Tag,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  buildGoalGraphPaths,
  formatGoalPlanDateTime,
  useCareerGoalPlanningData,
} from '../shared/useCareerGoalPlanningData';

const { Paragraph, Text, Title } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  page: css`
    :global(.ant-pro-page-container-children-container) {
      padding: 0;
    }
    min-height: calc(100vh - 112px);
    padding: 24px;
    background:
      radial-gradient(circle at top left, rgba(22, 119, 255, 0.1), transparent 28%),
      linear-gradient(180deg, #f7fbff 0%, #ffffff 46%, #f3f8ff 100%);
  `,
  hero: css`
    margin-bottom: 24px;
    padding: 28px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.94);
    border: 1px solid rgba(22, 119, 255, 0.12);
    box-shadow: 0 16px 42px rgba(31, 56, 88, 0.08);
  `,
  eyebrow: css`
    display: inline-flex;
    gap: 8px;
    margin-bottom: 14px;
    padding: 6px 12px;
    border-radius: 999px;
    color: ${token.colorPrimary};
    background: rgba(22, 119, 255, 0.08);
    font-weight: 600;
    font-size: 13px;
  `,
  layout: css`
    display: grid;
    grid-template-columns: 320px minmax(0, 1fr);
    gap: 20px;
    align-items: start;
    @media (max-width: 1080px) {
      grid-template-columns: 1fr;
    }
  `,
  stack: css`
    display: grid;
    gap: 20px;
  `,
  card: css`
    border-radius: 24px;
    box-shadow: 0 16px 36px rgba(31, 56, 88, 0.08);
    :global(.ant-card-body) {
      padding: 20px;
    }
  `,
  favoriteList: css`
    display: grid;
    gap: 12px;
  `,
  favorite: css`
    padding: 16px;
    border-radius: 18px;
    background: #fff;
    border: 1px solid rgba(22, 119, 255, 0.08);
    cursor: pointer;
  `,
  favoriteActive: css`
    border-color: rgba(22, 119, 255, 0.42);
    background: linear-gradient(180deg, #f8fbff 0%, #fff 100%);
  `,
  preview: css`
    min-height: 280px;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(22, 119, 255, 0.12);
    background: #fff;
    overflow: auto;
    p,
    li {
      line-height: 1.9;
    }
    ul,
    ol {
      padding-left: 22px;
    }
  `,
  reportHeader: css`
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    flex-wrap: wrap;
  `,
}));

const JobGoalSettingPathPlanningPage: React.FC = () => {
  const { styles, cx } = useStyles();
  const {
    favorites,
    favoritesLoading,
    pageError,
    activeFavorite,
    favoriteForView,
    selectedFavoriteId,
    setSelectedFavoriteId,
    taskSnapshot,
    workspace,
    actionError,
    setActionError,
    deletingFavoriteId,
    loadFavorites,
    startAnalysis,
    removeFavorite,
  } = useCareerGoalPlanningData();

  const graphPaths = useMemo(() => buildGoalGraphPaths(favoriteForView), [favoriteForView]);
  const reportResult = taskSnapshot?.result;
  const reportSections = [
    {
      key: 'report',
      label: '综合报告',
      content: reportResult?.comprehensive_report_markdown || workspace?.generated_report_markdown,
    },
    {
      key: 'trend',
      label: '趋势依据',
      content: reportResult?.trend_section_markdown || reportResult?.trend_markdown,
    },
  ].filter((item) => item.content);

  return (
    <PageContainer title={false}>
      <div className={styles.page}>
        <div className={styles.hero}>
          <div className={styles.eyebrow}>
            <FlagOutlined />
            职业目标分析报告
          </div>
          <Title level={2} style={{ marginBottom: 12 }}>
            先完成目标分析，再进入成长路径规划
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            这一页负责收藏目标、异步生成、趋势分析、综合报告和图谱证据链。成长路径规划页只展示生成完成后的短中长期计划、进度跟踪和导出。
          </Paragraph>
        </div>

        <div className={styles.layout}>
          <div className={styles.stack}>
            <Card
              className={styles.card}
              title="已收藏目标"
              extra={
                <Button
                  size="small"
                  type="link"
                  onClick={() => void loadFavorites()}
                  loading={favoritesLoading}
                >
                  刷新
                </Button>
              }
            >
              {pageError ? (
                <Alert type="error" showIcon message={pageError} style={{ marginBottom: 16 }} />
              ) : null}
              {favorites.length ? (
                <div className={styles.favoriteList}>
                  {favorites.map((favorite) => (
                    <div
                      key={favorite.favorite_id}
                      className={cx(
                        styles.favorite,
                        selectedFavoriteId === favorite.favorite_id && styles.favoriteActive,
                      )}
                      onClick={() => setSelectedFavoriteId(favorite.favorite_id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedFavoriteId(favorite.favorite_id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <Space wrap style={{ justifyContent: 'space-between' }}>
                          <Text strong>{favorite.target_title}</Text>
                          <Tag color="blue">{favorite.overall_match.toFixed(0)}%</Tag>
                        </Space>
                        <Space wrap>
                          <Tag>{favorite.target_scope === 'industry' ? '行业方向' : '岗位方向'}</Tag>
                          {favorite.industry ? <Tag>{favorite.industry}</Tag> : null}
                        </Space>
                        <Text type="secondary">{favorite.canonical_job_title}</Text>
                        <Space wrap style={{ justifyContent: 'space-between' }}>
                          <Text type="secondary">收藏于 {formatGoalPlanDateTime(favorite.created_at)}</Text>
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            loading={deletingFavoriteId === favorite.favorite_id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void removeFavorite(favorite);
                            }}
                          />
                        </Space>
                      </Space>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  description="还没有收藏目标，先从岗位匹配页收藏一个目标。"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </Card>
          </div>

          <div className={styles.stack}>
            {actionError ? (
              <Alert
                closable
                type="error"
                showIcon
                message={actionError}
                onClose={() => setActionError(undefined)}
              />
            ) : null}

            <Card
              className={styles.card}
              title="报告生成与分析"
              extra={
                <Space wrap>
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => void startAnalysis()}
                    disabled={!activeFavorite}
                  >
                    {reportResult ? '重新生成分析报告' : '开始生成分析报告'}
                  </Button>
                  {workspace ? (
                    <Button
                      icon={<FileSearchOutlined />}
                      onClick={() => history.push('/career-development-report/growth-path-planning')}
                    >
                      进入成长路径规划
                    </Button>
                  ) : null}
                </Space>
              }
            >
              {activeFavorite ? (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space wrap>
                    <Tag color="blue">{activeFavorite.target_title}</Tag>
                    <Tag>{activeFavorite.canonical_job_title}</Tag>
                    {activeFavorite.industry ? <Tag>{activeFavorite.industry}</Tag> : null}
                    {workspace ? <Tag color="success">成长路径规划已生成</Tag> : null}
                  </Space>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    点击生成后会实时刷新任务进度，并在任务完成后同步产出职业目标分析报告和成长路径规划工作台。
                  </Paragraph>
                </Space>
              ) : (
                <Empty description="请选择左侧收藏目标。" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>

            {taskSnapshot ? (
              <Card className={styles.card} title="任务进度">
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Progress
                    percent={taskSnapshot.progress}
                    status={taskSnapshot.status === 'failed' ? 'exception' : 'active'}
                  />
                  <Space wrap>
                    <Tag color="blue">任务状态：{taskSnapshot.status}</Tag>
                    {taskSnapshot.latest_event?.status_text ? (
                      <Tag>{taskSnapshot.latest_event.status_text}</Tag>
                    ) : null}
                    <Tag>更新时间：{formatGoalPlanDateTime(taskSnapshot.updated_at)}</Tag>
                  </Space>
                  {taskSnapshot.error_message ? (
                    <Alert type="error" showIcon message={taskSnapshot.error_message} />
                  ) : null}
                </Space>
              </Card>
            ) : null}

            {reportSections.length ? (
              <Card
                className={styles.card}
                title="职业目标分析报告"
                extra={
                  <Space wrap>
                    <Button icon={<NodeIndexOutlined />} onClick={() => history.push(graphPaths.vertical)}>
                      查看垂直岗位图谱
                    </Button>
                    <Button icon={<SwapOutlined />} onClick={() => history.push(graphPaths.transfer)}>
                      查看换岗路径图谱
                    </Button>
                    {workspace ? (
                      <Button
                        icon={<FileSearchOutlined />}
                        onClick={() => history.push('/career-development-report/growth-path-planning')}
                      >
                        进入成长路径规划
                      </Button>
                    ) : null}
                  </Space>
                }
              >
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div className={styles.reportHeader}>
                    <div>
                      <Title level={4} style={{ marginBottom: 8 }}>
                        {favoriteForView?.target_title || '当前目标'}
                      </Title>
                      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        这里保留趋势依据和综合分析结论，作为后续成长路径规划的证据链。
                      </Paragraph>
                    </div>
                    <Space wrap>
                      {favoriteForView?.overall_match !== undefined ? (
                        <Tag color="blue">匹配度 {favoriteForView.overall_match.toFixed(2)}%</Tag>
                      ) : null}
                      {workspace ? <Tag color="success">规划页已可用</Tag> : null}
                    </Space>
                  </div>
                  <Collapse
                    defaultActiveKey={['report', 'trend']}
                    items={reportSections.map((item) => ({
                      key: item.key,
                      label: item.label,
                      children: (
                        <div className={styles.preview}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {item.content || ''}
                          </ReactMarkdown>
                        </div>
                      ),
                    }))}
                  />
                </Space>
              </Card>
            ) : (
              <Card className={styles.card}>
                <Empty
                  description={
                    workspace
                      ? '当前已有成长路径规划工作台，但还没有可直接展示的分析报告结果。你可以重新生成一次分析报告，或直接进入成长路径规划。'
                      : '还没有生成分析报告。'
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Space wrap>
                    <Button
                      type="primary"
                      icon={<ReloadOutlined />}
                      onClick={() => void startAnalysis()}
                      disabled={!activeFavorite}
                    >
                      生成分析报告
                    </Button>
                    {workspace ? (
                      <Button
                        icon={<FileSearchOutlined />}
                        onClick={() => history.push('/career-development-report/growth-path-planning')}
                      >
                        进入成长路径规划
                      </Button>
                    ) : null}
                  </Space>
                </Empty>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default JobGoalSettingPathPlanningPage;
