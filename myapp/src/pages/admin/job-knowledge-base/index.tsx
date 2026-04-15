import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
  Button,
  Card,
  message,
  Modal,
  Progress,
  Space,
  Upload,
  UploadProps,
} from 'antd';
import { InboxOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import React, { useRef, useState } from 'react';
import {
  COMPANY_SIZE_OPTIONS,
  COMPANY_TYPE_OPTIONS,
  INDUSTRY_OPTIONS,
  JOB_TITLE_OPTIONS,
} from './constants';

interface ImportResult {
  success_count: number;
  fail_count: number;
  errors: string[];
}

interface JobPostingFormData {
  industry: string;
  job_title: string;
  company_name: string;
  address?: string;
  salary_range?: string;
  company_size?: string;
  company_type?: string;
  job_detail?: string;
  company_detail?: string;
}

const JobKnowledgeBasePage: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // 表格列定义（岗位列表）
  const columns: ProColumns<Record<string, unknown>>[] = [
    {
      title: '岗位名称',
      dataIndex: 'job_title',
      search: false,
      ellipsis: true,
    },
    {
      title: '所属行业',
      dataIndex: 'industry',
      search: false,
      ellipsis: true,
    },
    {
      title: '公司名称',
      dataIndex: 'company_name',
      search: false,
      ellipsis: true,
    },
    {
      title: '地址',
      dataIndex: 'address',
      search: false,
      ellipsis: true,
    },
    {
      title: '薪资范围',
      dataIndex: 'salary_range',
      search: false,
      ellipsis: true,
    },
  ];

  // 处理 Excel 导入
  const handleImport = async (file: File) => {
    setImporting(true);
    setImportProgress(0);
    setImportResult(null);

    const interval = setInterval(() => {
      setImportProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return prev;
        }
        return prev + 5;
      });
    }, 200);

    try {
      // TODO: 调用后端接口上传文件
      // const formData = new FormData();
      // formData.append('file', file);
      // const response = await fetch('/api/admin/job-postings/import', {
      //   method: 'POST',
      //   body: formData,
      // });
      // const result = await response.json();

      setImportProgress(100);
      setImportResult({
        success_count: Math.floor(Math.random() * 50) + 10,
        fail_count: Math.floor(Math.random() * 5),
        errors: [],
      });
      message.success('导入完成');
      actionRef.current?.reload();
    } catch {
      message.error('导入失败，请重试');
    } finally {
      clearInterval(interval);
      setImporting(false);
    }

    return false;
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.xlsx,.xls,.csv',
    beforeUpload: handleImport,
    showUploadList: false,
  };

  // 处理单条新增
  const handleAdd = async (values: JobPostingFormData) => {
    setAddLoading(true);
    try {
      // TODO: 调用后端接口新增岗位
      // const response = await fetch('/api/admin/job-postings', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(values),
      // });
      // if (!response.ok) throw new Error();
      message.success('新增成功');
      setAddModalOpen(false);
      actionRef.current?.reload();
    } catch {
      message.error('新增失败，请重试');
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <>
      <ProTable<Record<string, unknown>, Record<string, unknown>>
        actionRef={actionRef}
        rowKey="id"
        size="middle"
        headerTitle={
          <Space size="large">
            <span>岗位知识库</span>
          </Space>
        }
        toolBarRender={() => [
          <Button
            key="import"
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => setImportModalOpen(true)}
          >
            导入表格
          </Button>,
          <Button
            key="add"
            type="default"
            icon={<PlusOutlined />}
            onClick={() => setAddModalOpen(true)}
          >
            单条插入
          </Button>,
        ]}
        search={false}
        columns={columns}
        request={async () => {
          // TODO: 替换为岗位列表接口 GET /api/admin/job-postings
          return { data: [], success: true, total: 0 };
        }}
      />

      {/* 导入弹窗 */}
      <Modal
      title="导入岗位表格"
      open={importModalOpen}
      onCancel={() => {
        if (!importing) {
          setImportModalOpen(false);
          setImportProgress(0);
          setImportResult(null);
        }
      }}
      footer={null}
      width={480}
      destroyOnClose
    >
      <Space direction="vertical" size="large" style={{ width: '100%', paddingTop: 16 }}>
        {!importResult && (
          <Upload.Dragger {...uploadProps} style={{ width: '100%' }}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽上传 Excel/CSV 文件</p>
            <p className="ant-upload-hint">
              支持 .xlsx、.xls、.csv 格式，建议单次导入不超过 5000 条
            </p>
          </Upload.Dragger>
        )}

        {importing && (
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <p>正在导入数据，请稍候...</p>
            <Progress percent={importProgress} status="active" />
          </Space>
        )}

        {importResult && (
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <p style={{ fontWeight: 600 }}>导入完成</p>
            <p>
              成功导入：
              <strong style={{ color: '#52c41a' }}>{importResult.success_count} 条</strong>
            </p>
            {importResult.fail_count > 0 && (
              <p>
                导入失败：
                <strong style={{ color: '#ff4d4f' }}>{importResult.fail_count} 条</strong>
              </p>
            )}
            {importResult.errors.length > 0 && (
              <div
                style={{
                  maxHeight: 120,
                  overflow: 'auto',
                  background: '#f5f5f5',
                  padding: 8,
                  borderRadius: 4,
                }}
              >
                {importResult.errors.map((err, i) => (
                  <p key={i} style={{ margin: 0, fontSize: 12, color: '#ff4d4f' }}>
                    {err}
                  </p>
                ))}
              </div>
            )}
          </Space>
        )}
      </Space>
    </Modal>

    {/* 单条插入弹窗 */}
    <Modal
      title="单条插入岗位"
      open={addModalOpen}
      onCancel={() => setAddModalOpen(false)}
      footer={null}
      width={600}
      destroyOnClose
    >
      <JobPostingForm onSubmit={handleAdd} onCancel={() => setAddModalOpen(false)} loading={addLoading} />
    </Modal>
    </>
  );
};

// 岗位表单组件
interface JobPostingFormProps {
  onSubmit: (values: JobPostingFormData) => void;
  onCancel: () => void;
  loading: boolean;
}

const JobPostingForm: React.FC<JobPostingFormProps> = ({ onSubmit, onCancel, loading }) => {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        onSubmit({
          industry: formData.get('industry') as string,
          job_title: formData.get('job_title') as string,
          company_name: formData.get('company_name') as string,
          address: formData.get('address') as string || undefined,
          salary_range: formData.get('salary_range') as string || undefined,
          company_size: formData.get('company_size') as string || undefined,
          company_type: formData.get('company_type') as string || undefined,
          job_detail: formData.get('job_detail') as string || undefined,
          company_detail: formData.get('company_detail') as string || undefined,
        });
      }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space size="middle" style={{ width: '100%' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 4, color: '#666' }}>岗位名称 *</label>
            <select
              name="job_title"
              required
              style={{ width: '100%', height: 32, borderRadius: 6, border: '1px solid #d9d9d9', padding: '0 12px' }}
            >
              <option value="">请选择岗位名称</option>
              {JOB_TITLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 4, color: '#666' }}>所属行业 *</label>
            <select
              name="industry"
              required
              style={{ width: '100%', height: 32, borderRadius: 6, border: '1px solid #d9d9d9', padding: '0 12px' }}
            >
              <option value="">请选择所属行业</option>
              {INDUSTRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </Space>

        <div>
          <label style={{ display: 'block', marginBottom: 4, color: '#666' }}>公司名称 *</label>
          <input
            name="company_name"
            required
            placeholder="请输入公司名称"
            style={{ width: '100%', height: 32, borderRadius: 6, border: '1px solid #d9d9d9', padding: '0 12px' }}
          />
        </div>

        <Space size="middle" style={{ width: '100%' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 4, color: '#666' }}>公司规模</label>
            <select
              name="company_size"
              style={{ width: '100%', height: 32, borderRadius: 6, border: '1px solid #d9d9d9', padding: '0 12px' }}
            >
              <option value="">请选择公司规模</option>
              {COMPANY_SIZE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 4, color: '#666' }}>公司类型</label>
            <select
              name="company_type"
              style={{ width: '100%', height: 32, borderRadius: 6, border: '1px solid #d9d9d9', padding: '0 12px' }}
            >
              <option value="">请选择公司类型</option>
              {COMPANY_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </Space>

        <Space size="middle" style={{ width: '100%' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 4, color: '#666' }}>工作地址</label>
            <input
              name="address"
              placeholder="请输入工作地址"
              style={{ width: '100%', height: 32, borderRadius: 6, border: '1px solid #d9d9d9', padding: '0 12px' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 4, color: '#666' }}>薪资范围</label>
            <input
              name="salary_range"
              placeholder="如：15k-25k"
              style={{ width: '100%', height: 32, borderRadius: 6, border: '1px solid #d9d9d9', padding: '0 12px' }}
            />
          </div>
        </Space>

        <div>
          <label style={{ display: 'block', marginBottom: 4, color: '#666' }}>岗位描述</label>
          <textarea
            name="job_detail"
            rows={3}
            placeholder="请输入岗位描述"
            style={{ width: '100%', borderRadius: 6, border: '1px solid #d9d9d9', padding: '8px 12px', resize: 'vertical' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 4, color: '#666' }}>公司介绍</label>
          <textarea
            name="company_detail"
            rows={3}
            placeholder="请输入公司介绍"
            style={{ width: '100%', borderRadius: 6, border: '1px solid #d9d9d9', padding: '8px 12px', resize: 'vertical' }}
          />
        </div>

        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            提交
          </Button>
        </Space>
      </Space>
    </form>
  );
};

export default JobKnowledgeBasePage;
