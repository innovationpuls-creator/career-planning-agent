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
import { Drawer, Tag, Typography } from 'antd';
import React, { useRef, useState } from 'react';
import { getJobPostings } from '@/services/ant-design-pro/api';
import { INDUSTRY_OPTIONS, JOB_TITLE_OPTIONS } from './constants';

const textFallback = (value?: string) => value || '暂无';

const JobPostingsPage: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [currentRow, setCurrentRow] = useState<API.JobPostingItem>();

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
        <Typography.Link
          onClick={() => {
            setCurrentRow(record);
            setDetailOpen(true);
          }}
        >
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
      title: '地址',
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
        <Typography.Link
          key="detail"
          onClick={() => {
            setCurrentRow(record);
            setDetailOpen(true);
          }}
        >
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
      title: '地址',
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
        title: '岗位数据',
        subTitle: '支持分页筛选与完整详情查看',
      }}
    >
      <ProTable<API.JobPostingItem, API.JobPostingQueryParams>
        actionRef={actionRef}
        rowKey="id"
        size="middle"
        headerTitle="完整岗位数据"
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
        }}
      />

      <Drawer
        title="岗位详情"
        width={720}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setCurrentRow(undefined);
        }}
      >
        {currentRow ? (
          <>
            <ProDescriptions<API.JobPostingItem>
              column={2}
              dataSource={currentRow}
              columns={detailColumns}
            />
            <Typography.Title level={5}>岗位详情</Typography.Title>
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
              {textFallback(currentRow.job_detail)}
            </Typography.Paragraph>
            <Typography.Title level={5}>公司详情</Typography.Title>
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
              {textFallback(currentRow.company_detail)}
            </Typography.Paragraph>
          </>
        ) : null}
      </Drawer>
    </PageContainer>
  );
};

export default JobPostingsPage;
