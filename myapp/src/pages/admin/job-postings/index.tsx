import type {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import {
  PageContainer,
  ProDescriptions,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, Drawer, Empty, message, Space, Tag, Typography } from 'antd';
import React, { useRef, useState } from 'react';
import { getJobPostings } from '@/services/ant-design-pro/api';
import { INDUSTRY_OPTIONS, JOB_TITLE_OPTIONS } from './constants';

const textFallback = (value?: string | null) => value || '暂无';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    return (
      (error as any)?.response?.data?.detail ||
      (error as any)?.info?.errorMessage ||
      (error as any)?.message ||
      fallback
    );
  }
  return fallback;
};

const JobPostingsPage: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [currentRow, setCurrentRow] = useState<API.JobPostingItem>();

  const openDetail = (record: API.JobPostingItem) => {
    setCurrentRow(record);
    setDetailOpen(true);
  };

  const columns: ProColumns<API.JobPostingItem>[] = [
    {
      title: '岗位名称',
      dataIndex: 'job_title',
      ellipsis: true,
      valueType: 'select',
      fieldProps: {
        mode: 'multiple',
        allowClear: true,
        showSearch: true,
        options: JOB_TITLE_OPTIONS,
        placeholder: '请选择岗位名称',
      },
      render: (_, record) => (
        <Typography.Link onClick={() => openDetail(record)}>
          {record.job_title}
        </Typography.Link>
      ),
    },
    {
      title: '所属行业',
      dataIndex: 'industry',
      ellipsis: true,
      valueType: 'select',
      fieldProps: {
        mode: 'multiple',
        allowClear: true,
        showSearch: true,
        options: INDUSTRY_OPTIONS,
        placeholder: '请选择所属行业',
      },
      render: (_, record) => <Tag color="blue">{record.industry}</Tag>,
    },
    {
      title: '公司名称',
      dataIndex: 'company_name',
      ellipsis: true,
    },
    {
      title: '工作地点',
      dataIndex: 'address',
      ellipsis: true,
      renderText: (value) => textFallback(value),
    },
    {
      title: '薪资范围',
      dataIndex: 'salary_range',
      search: false,
      renderText: (value) => textFallback(value),
    },
    {
      title: '公司规模',
      dataIndex: 'company_size',
      search: false,
      renderText: (value) => textFallback(value),
    },
    {
      title: '公司类型',
      dataIndex: 'company_type',
      search: false,
      renderText: (value) => textFallback(value),
    },
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
    },
    {
      title: '操作',
      key: 'option',
      valueType: 'option',
      search: false,
      render: (_, record) => [
        <Typography.Link key="detail" onClick={() => openDetail(record)}>
          查看详情
        </Typography.Link>,
      ],
    },
  ];

  const detailColumns: ProDescriptionsItemProps<API.JobPostingItem>[] = [
    { title: '岗位名称', dataIndex: 'job_title' },
    { title: '所属行业', dataIndex: 'industry' },
    { title: '公司名称', dataIndex: 'company_name' },
    {
      title: '工作地点',
      dataIndex: 'address',
      renderText: (value) => textFallback(value),
    },
    {
      title: '薪资范围',
      dataIndex: 'salary_range',
      renderText: (value) => textFallback(value),
    },
    {
      title: '公司规模',
      dataIndex: 'company_size',
      renderText: (value) => textFallback(value),
    },
    {
      title: '公司类型',
      dataIndex: 'company_type',
      renderText: (value) => textFallback(value),
    },
  ];

  return (
    <PageContainer
      header={{
        title: '岗位知识库',
        subTitle: '集中查看岗位台账、支持筛选和详情浏览。',
      }}
    >
      <Space direction="vertical" size={16} style={{ display: 'flex' }}>
        <Alert
          showIcon
          type="info"
          message="当前页面为只读数据台账"
          description="新增、编辑、删除和批量导入能力待后端管理接口支持后开放，本阶段仅提供真实数据查询与详情查看。"
        />

        <ProTable<API.JobPostingItem, API.JobPostingQueryParams>
          actionRef={actionRef}
          rowKey="id"
          size="middle"
          scroll={{ x: 1120 }}
          headerTitle="岗位列表"
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
            try {
              const response = await getJobPostings({
                current: params.current,
                pageSize: params.pageSize,
                industry: params.industry,
                job_title: params.job_title,
                company_name: params.company_name,
                address: params.address,
                keyword: params.keyword,
              });

              return {
                data: response.data || [],
                success: response.success ?? true,
                total: response.total || 0,
              };
            } catch (error) {
              message.error(getErrorMessage(error, '获取岗位数据失败'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
        />
      </Space>

      <Drawer
        title="岗位详情"
        width={720}
        open={detailOpen}
        destroyOnClose
        onClose={() => {
          setDetailOpen(false);
          setCurrentRow(undefined);
        }}
      >
        {currentRow ? (
          <Space direction="vertical" size={24} style={{ width: '100%' }}>
            <ProDescriptions<API.JobPostingItem>
              column={2}
              dataSource={currentRow}
              columns={detailColumns}
            />
            <div>
              <Typography.Title level={5} className="heading-3">
                岗位描述
              </Typography.Title>
              <Typography.Paragraph
                style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}
              >
                {textFallback(currentRow.job_detail)}
              </Typography.Paragraph>
            </div>
            <div>
              <Typography.Title level={5} className="heading-3">
                公司介绍
              </Typography.Title>
              <Typography.Paragraph
                style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}
              >
                {textFallback(currentRow.company_detail)}
              </Typography.Paragraph>
            </div>
          </Space>
        ) : (
          <Empty description="未获取到岗位详情" />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default JobPostingsPage;
