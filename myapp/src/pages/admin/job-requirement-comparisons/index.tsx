import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Card, Col, Drawer, Row, Space, Tag, Typography } from 'antd';
import React, { useRef, useState } from 'react';
import {
  getJobRequirementComparison,
  getJobRequirementComparisons,
} from '@/services/ant-design-pro/api';
import { INDUSTRY_OPTIONS, JOB_TITLE_OPTIONS } from '../job-postings/constants';

const DIMENSION_LABELS: Array<{
  key: keyof API.JobRequirementComparisonDetailItem;
  label: string;
}> = [
  { key: 'professional_skills', label: '专业技能/技术栈' },
  { key: 'professional_background', label: '专业背景' },
  { key: 'education_requirement', label: '学历要求' },
  { key: 'teamwork', label: '团队协作能力' },
  { key: 'stress_adaptability', label: '抗压/适应能力' },
  { key: 'communication', label: '沟通表达能力' },
  { key: 'work_experience', label: '工作经验' },
  { key: 'documentation_awareness', label: '文档规范意识' },
  { key: 'responsibility', label: '责任心/工作态度' },
  { key: 'learning_ability', label: '学习能力' },
  { key: 'problem_solving', label: '分析解决问题能力' },
  { key: 'other_special', label: '其他/特殊要求' },
];

const DEFAULT_VALUE = '无明确要求';

const textFallback = (value?: string | null) => value || '暂无原文';

const isDefaultDimension = (value?: string[]) =>
  !value || (value.length === 1 && value[0] === DEFAULT_VALUE);

const renderDimensionValues = (value?: string[]) => {
  if (isDefaultDimension(value)) {
    return <Typography.Text type="secondary">{DEFAULT_VALUE}</Typography.Text>;
  }

  return (
    <Space wrap size={[8, 8]}>
      {value?.map((item) => (
        <Tag color="blue" key={item}>
          {item}
        </Tag>
      ))}
    </Space>
  );
};

const JobRequirementComparisonsPage: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentDetail, setCurrentDetail] = useState<API.JobRequirementComparisonDetailItem>();

  const openDetail = async (id: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const response = await getJobRequirementComparison(id);
      setCurrentDetail(response.data);
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: ProColumns<API.JobRequirementComparisonListItem>[] = [
    {
      title: '职位',
      dataIndex: 'job_title',
      ellipsis: true,
      valueType: 'select',
      fieldProps: {
        mode: 'multiple',
        allowClear: true,
        showSearch: true,
        options: JOB_TITLE_OPTIONS,
        placeholder: '请选择职位',
      },
      render: (_, record) => (
        <Typography.Link onClick={() => void openDetail(record.id)}>
          {record.job_title}
        </Typography.Link>
      ),
    },
    {
      title: '行业',
      dataIndex: 'industry',
      ellipsis: true,
      valueType: 'select',
      fieldProps: {
        mode: 'multiple',
        allowClear: true,
        showSearch: true,
        options: INDUSTRY_OPTIONS,
        placeholder: '请选择行业',
      },
      render: (_, record) => <Tag color="blue">{record.industry}</Tag>,
    },
    {
      title: '公司',
      dataIndex: 'company_name',
      ellipsis: true,
    },
    {
      title: '原文条数',
      dataIndex: 'job_detail_count',
      search: false,
      width: 120,
      render: (_, record) => <Tag color="cyan">{record.job_detail_count} 条</Tag>,
    },
    {
      title: '已提取维度',
      dataIndex: 'non_default_dimension_count',
      search: false,
      width: 140,
      render: (_, record) => (
        <Tag color={record.non_default_dimension_count > 0 ? 'green' : 'default'}>
          {record.non_default_dimension_count}/12
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'option',
      valueType: 'option',
      search: false,
      render: (_, record) => [
        <Typography.Link key="compare" onClick={() => void openDetail(record.id)}>
          查看对比
        </Typography.Link>,
      ],
    },
  ];

  return (
    <PageContainer
      header={{
        title: '岗位画像对比',
        subTitle: '核验岗位原文与 12 维画像提取结果是否一致',
      }}
    >
      <ProTable<
        API.JobRequirementComparisonListItem,
        API.JobRequirementComparisonQueryParams
      >
        actionRef={actionRef}
        rowKey="id"
        size="middle"
        headerTitle="岗位画像对比列表"
        search={{
          labelWidth: 92,
          defaultCollapsed: false,
        }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
        }}
        columns={columns}
        request={async (params) => {
          const response = await getJobRequirementComparisons({
            current: params.current,
            pageSize: params.pageSize,
            industry: params.industry,
            job_title: params.job_title,
            company_name: params.company_name,
          });

          return {
            data: response.data || [],
            success: response.success ?? true,
            total: response.total || 0,
          };
        }}
      />

      <Drawer
        title="岗位画像对比"
        width={1200}
        open={detailOpen}
        destroyOnClose
        loading={detailLoading}
        onClose={() => {
          setDetailOpen(false);
          setCurrentDetail(undefined);
        }}
      >
        {currentDetail ? (
          <Row gutter={16}>
            <Col span={12}>
              <Card
                size="small"
                title={`${currentDetail.industry} / ${currentDetail.job_title} / ${currentDetail.company_name}`}
                extra={<Tag color="cyan">{currentDetail.job_detail_count} 条原文</Tag>}
              >
                <Typography.Title level={5}>合并后的岗位原文</Typography.Title>
                <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                  {textFallback(currentDetail.merged_job_detail)}
                </Typography.Paragraph>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title="12 维提取结果">
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  {DIMENSION_LABELS.map((dimension) => (
                    <div key={dimension.key}>
                      <Typography.Text strong>{dimension.label}</Typography.Text>
                      <div style={{ marginTop: 8 }}>
                        {renderDimensionValues(currentDetail[dimension.key] as string[])}
                      </div>
                    </div>
                  ))}
                </Space>
              </Card>
            </Col>
          </Row>
        ) : null}
      </Drawer>
    </PageContainer>
  );
};

export default JobRequirementComparisonsPage;
