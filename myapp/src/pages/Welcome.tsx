import {
  FileTextOutlined,
  ProfileOutlined,
  SolutionOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import { Button, Card, Col, Result, Row, Typography } from 'antd';
import React from 'react';

const FEATURE_CARDS = [
  {
    key: 'job-requirement-profile',
    title: '就业信息知识库',
    description: '查看岗位要求图谱与行业岗位画像。',
    icon: <ProfileOutlined />,
    path: '/job-requirement-profile/overview',
  },
  {
    key: 'student-competency-profile',
    title: '简历解析',
    description: '上传简历或补充说明，持续生成、编辑并同步 12 维解析结果。',
    icon: <SolutionOutlined />,
    path: '/student-competency-profile',
  },
  {
    key: 'career-development-report',
    title: '构建学生职业生涯发展报告',
    description: '查看职业目标分析、成长路径规划与相关建议。',
    icon: <FileTextOutlined />,
    path: '/career-development-report',
  },
] as const;

const Welcome: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const isUser = initialState?.currentUser?.access === 'user';

  return (
    <PageContainer title={false} breadcrumbRender={false}>
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        首页
      </Typography.Title>

      {isUser ? (
        <Row gutter={[16, 16]}>
          {FEATURE_CARDS.map((item) => (
            <Col xs={24} md={12} xl={8} key={item.key}>
              <Card
                hoverable
                actions={[
                  <Button type="link" key="enter" onClick={() => history.push(item.path)}>
                    进入模块
                  </Button>,
                ]}
              >
                <Card.Meta
                  avatar={item.icon}
                  title={item.title}
                  description={item.description}
                />
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Card>
          <Result
            status="403"
            title="当前账号无学生端访问权限"
            subTitle="请切换到学生账号后再进入职业规划相关模块。"
            extra={
              <Button
                type="primary"
                onClick={() => {
                  history.push('/admin/job-postings');
                }}
              >
                前往管理端
              </Button>
            }
          />
        </Card>
      )}
    </PageContainer>
  );
};

export default Welcome;
