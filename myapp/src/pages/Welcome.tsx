import {
  FileTextOutlined,
  ProfileOutlined,
  RightOutlined,
  SolutionOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import { Button, Card, Col, Result, Row, Space, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';

const FEATURE_CARDS = [
  {
    key: 'job-requirement-profile',
    title: '构建就业岗位要求画像',
    description: '聚合岗位能力、职责与任职条件，帮助我们更快明确目标岗位的核心要求。',
    icon: ProfileOutlined,
    path: '/job-requirement-profile/overview',
    accent: '#1677ff',
  },
  {
    key: 'student-competency-profile',
    title: '构建学生就业能力画像',
    description: '当前仅保留页面占位，原有就业能力画像对话与生成能力已移除。',
    icon: SolutionOutlined,
    path: '/student-competency-profile',
    accent: '#13a8a8',
  },
  {
    key: 'career-development-report',
    title: '构建学生职业生涯发展报告',
    description: '沉淀阶段性分析结果与成长建议，帮助我们持续追踪职业规划与行动方向。',
    icon: FileTextOutlined,
    path: '/career-development-report',
    accent: '#7a4df5',
  },
] as const;

const useStyles = createStyles(({ css, token }) => {
  return {
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
        radial-gradient(circle at top left, rgba(22, 119, 255, 0.12), transparent 32%),
        linear-gradient(180deg, #f7faff 0%, #ffffff 42%, #f5f8ff 100%);

      @media (max-width: 768px) {
        padding: 16px;
      }
    `,
    hero: css`
      position: relative;
      overflow: hidden;
      margin-bottom: 24px;
      padding: 32px;
      border: 1px solid rgba(22, 119, 255, 0.12);
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 20px 60px rgba(31, 56, 88, 0.08);

      &::after {
        content: '';
        position: absolute;
        inset: auto -80px -120px auto;
        width: 260px;
        height: 260px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(22, 119, 255, 0.16), transparent 68%);
        pointer-events: none;
      }

      @media (max-width: 768px) {
        padding: 24px;
      }
    `,
    eyebrow: css`
      display: inline-flex;
      align-items: center;
      margin-bottom: 16px;
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
      max-width: 720px;
      margin: 0;
      color: rgba(18, 49, 77, 0.78);
      font-size: 16px;
      line-height: 1.8;
    `,
    sectionTitle: css`
      margin: 0 0 8px;
      color: #12314d;
      font-size: 22px;
    `,
    sectionText: css`
      margin: 0 0 24px;
      color: rgba(18, 49, 77, 0.7);
      font-size: 15px;
      line-height: 1.7;
    `,
    featureCol: css`
      display: flex;
    `,
    featureCard: css`
      width: 100%;
      height: 100%;
      border: 1px solid rgba(18, 49, 77, 0.08);
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 14px 36px rgba(31, 56, 88, 0.08);
      transition:
        transform 220ms ease,
        box-shadow 220ms ease,
        border-color 220ms ease;

      :global(.ant-card-body) {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 24px;
      }

      &:hover {
        transform: translateY(-6px);
        box-shadow: 0 24px 48px rgba(31, 56, 88, 0.14);
      }
    `,
    featureTop: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    `,
    featureIconWrap: css`
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 18px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
    `,
    featureTitle: css`
      margin: 0 0 12px;
      color: #12314d;
      font-size: 20px;
      line-height: 1.4;
    `,
    featureText: css`
      flex: 1;
      margin: 0 0 24px;
      color: rgba(18, 49, 77, 0.7);
      font-size: 15px;
      line-height: 1.8;
    `,
    actionButton: css`
      width: fit-content;
      padding-inline: 18px;
      border-radius: 999px;
      font-weight: 600;
    `,
  };
});

const Welcome: React.FC = () => {
  const { styles, cx } = useStyles();
  const { initialState } = useModel('@@initialState');
  const isUser = initialState?.currentUser?.access === 'user';

  return (
    <PageContainer
      className={styles.pageContainer}
      title={false}
      breadcrumbRender={false}
    >
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.eyebrow}>首页导航</div>
          <Typography.Title level={1} className={styles.heroTitle}>
            从清晰入口开始，逐步完成职业规划分析
          </Typography.Title>
          <Typography.Paragraph className={styles.heroText}>
            这里集中提供岗位画像、能力画像与职业发展报告 3 个核心入口，帮助我们按照统一节奏完成信息整理、能力分析与成长判断。
          </Typography.Paragraph>
        </section>

        <section>
          <Typography.Title level={2} className={styles.sectionTitle}>
            核心功能导航
          </Typography.Title>
          {isUser ? (
            <>
              <Typography.Paragraph className={styles.sectionText}>
                选择需要进入的模块，先完成当前阶段任务；每个功能页都已预留独立空间，方便后续继续扩展。
              </Typography.Paragraph>

              <Row gutter={[24, 24]}>
                {FEATURE_CARDS.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Col
                      xs={24}
                      md={12}
                      xl={8}
                      key={item.key}
                      className={styles.featureCol}
                    >
                      <Card
                        hoverable
                        className={cx(styles.featureCard)}
                        style={{ borderColor: `${item.accent}22` }}
                      >
                        <div className={styles.featureTop}>
                          <div
                            className={styles.featureIconWrap}
                            style={{
                              background: `linear-gradient(135deg, ${item.accent}, ${item.accent}bb)`,
                            }}
                          >
                            <Icon style={{ fontSize: 28, color: '#fff' }} />
                          </div>
                        </div>

                        <Space direction="vertical" size={0}>
                          <Typography.Title
                            level={3}
                            className={styles.featureTitle}
                          >
                            {item.title}
                          </Typography.Title>
                          <Typography.Paragraph className={styles.featureText}>
                            {item.description}
                          </Typography.Paragraph>
                        </Space>

                        <Button
                          type="primary"
                          className={styles.actionButton}
                          icon={<RightOutlined />}
                          onClick={() => {
                            history.push(item.path);
                          }}
                        >
                          进入功能
                        </Button>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </>
          ) : (
            <Card>
              <Result
                status="403"
                title="当前角色没有学生端模块权限"
                subTitle="这 3 个功能入口仅对普通用户开放；如果你是管理员，请使用管理端相关页面。"
                extra={
                  <Button
                    type="primary"
                    onClick={() => {
                      history.push('/admin/job-postings');
                    }}
                  >
                    前往岗位数据
                  </Button>
                }
              />
            </Card>
          )}
        </section>
      </div>
    </PageContainer>
  );
};

export default Welcome;
