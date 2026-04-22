import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProDescriptions, ProTable } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import {
  Avatar,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Skeleton,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import React, { useRef, useState } from 'react';
import { createStyles } from 'antd-style';
import {
  createAdminUser,
  deleteAdminUser,
  getAdminUser,
  getAdminUsers,
  updateAdminUser,
} from '@/services/ant-design-pro/api';
import { ROLE_OPTIONS, STATUS_OPTIONS } from './constants';

type UserTableParams = {
  current?: number;
  pageSize?: number;
  username?: string;
  role?: string;
  is_active?: boolean | 'true' | 'false';
};

type UserFormValues = {
  username?: string;
  password?: string;
  display_name?: string;
  role?: string;
  is_active?: boolean;
};

const textFallback = (value?: string | null) => value || '暂无';

const formatDatetime = (value?: string | null) => {
  if (!value) {
    return '暂无';
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : value;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    const responseDetail = (error as any)?.response?.data?.detail;
    const infoMessage = (error as any)?.info?.errorMessage;
    const errorMessage = (error as any)?.message;
    return responseDetail || infoMessage || errorMessage || fallback;
  }
  return fallback;
};

const normalizeStatusFilter = (value: UserTableParams['is_active']) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return undefined;
};

const roleTag = (role?: string) => (
  <Tag color={role === 'admin' ? 'gold' : 'blue'}>
    {role === 'admin' ? '管理员' : '普通用户'}
  </Tag>
);

const statusTag = (isActive?: boolean) => (
  <Tag color={isActive ? 'success' : 'error'}>
    {isActive ? '启用' : '禁用'}
  </Tag>
);

const UserManagementPage: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRecord, setDetailRecord] = useState<API.AdminUserItem>();
  const [editingRecord, setEditingRecord] = useState<API.AdminUserItem>();
  const [createForm] = Form.useForm<UserFormValues>();
  const [editForm] = Form.useForm<UserFormValues>();

  const reloadTable = () => actionRef.current?.reload();

  const closeCreateDrawer = () => {
    setCreateOpen(false);
    createForm.resetFields();
  };

  const closeEditDrawer = () => {
    setEditOpen(false);
    setEditingRecord(undefined);
    editForm.resetFields();
  };

  const closeDetailDrawer = () => {
    setDetailOpen(false);
    setDetailRecord(undefined);
    setDetailLoading(false);
  };

  const openDetailDrawer = async (record: API.AdminUserItem) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailRecord(undefined);
    try {
      const response = await getAdminUser(record.id);
      setDetailRecord(response.data);
    } catch (error) {
      message.error(getErrorMessage(error, '获取用户详情失败'));
    } finally {
      setDetailLoading(false);
    }
  };

  const openEditDrawer = (record: API.AdminUserItem) => {
    setEditingRecord(record);
    editForm.setFieldsValue({
      display_name: record.display_name,
      role: record.role,
      is_active: record.is_active,
    });
    setEditOpen(true);
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      await createAdminUser({
        username: values.username!,
        password: values.password!,
        display_name: values.display_name,
        role: values.role || 'user',
        is_active: values.is_active !== false,
      });
      message.success('用户创建成功');
      closeCreateDrawer();
      reloadTable();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      message.error(getErrorMessage(error, '创建用户失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingRecord) {
      return;
    }

    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      await updateAdminUser({
        user_id: editingRecord.id,
        display_name: values.display_name,
        role: values.role,
        is_active: values.is_active,
      });
      message.success('用户信息更新成功');
      closeEditDrawer();
      reloadTable();
      if (detailRecord?.id === editingRecord.id) {
        await openDetailDrawer(editingRecord);
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      message.error(getErrorMessage(error, '更新用户失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (record: API.AdminUserItem) => {
    Modal.confirm({
      title: `确认删除用户「${record.username}」？`,
      content: '删除后无法恢复，请确认。',
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteAdminUser(record.id);
          message.success('用户已删除');
          if (detailRecord?.id === record.id) {
            closeDetailDrawer();
          }
          if (editingRecord?.id === record.id) {
            closeEditDrawer();
          }
          reloadTable();
        } catch (error) {
          message.error(getErrorMessage(error, '删除用户失败'));
        }
      },
    });
  };

  const columns: ProColumns<API.AdminUserItem>[] = [
    {
      title: '用户 ID',
      dataIndex: 'id',
      search: false,
      width: 88,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      ellipsis: true,
      render: (_, record) => (
        <Typography.Link onClick={() => void openDetailDrawer(record)}>
          {record.username}
        </Typography.Link>
      ),
    },
    {
      title: '昵称',
      dataIndex: 'display_name',
      search: false,
      ellipsis: true,
      renderText: (value) => textFallback(value),
    },
    {
      title: '角色',
      dataIndex: 'role',
      valueType: 'select',
      fieldProps: {
        allowClear: true,
        options: ROLE_OPTIONS,
        placeholder: '全部角色',
      },
      render: (_, record) => roleTag(record.role),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      valueType: 'select',
      fieldProps: {
        allowClear: true,
        options: STATUS_OPTIONS,
        placeholder: '全部状态',
      },
      render: (_, record) => statusTag(record.is_active),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      search: false,
      width: 180,
      renderText: (value) => formatDatetime(value),
    },
    {
      title: '最近登录',
      dataIndex: 'last_login_at',
      search: false,
      width: 180,
      renderText: (value) => formatDatetime(value),
    },
    {
      title: '操作',
      key: 'option',
      search: false,
      fixed: 'right',
      width: 164,
      render: (_, record) => (
        <Space size={12}>
          <Typography.Link onClick={() => void openDetailDrawer(record)}>
            查看
          </Typography.Link>
          <Typography.Link onClick={() => openEditDrawer(record)}>
            编辑
          </Typography.Link>
          <Typography.Link
            onClick={() => handleDelete(record)}
            type="danger"
          >
            删除
          </Typography.Link>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer
      header={{
        title: '用户管理',
        subTitle: '维护管理员与普通用户账号，支持查询、查看、新增、编辑和删除。',
      }}
    >
      <ProTable<API.AdminUserItem, UserTableParams>
        actionRef={actionRef}
        rowKey="id"
        size="middle"
        scroll={{ x: 980 }}
        headerTitle="用户列表"
        search={{ labelWidth: 92, defaultCollapsed: false }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            onClick={() => {
              createForm.resetFields();
              setCreateOpen(true);
            }}
          >
            新增用户
          </Button>,
        ]}
        columns={columns}
        request={async (params) => {
          const response = await getAdminUsers({
            page: params.current,
            page_size: params.pageSize,
            username: params.username,
            role: params.role,
            is_active: normalizeStatusFilter(params.is_active),
          });

          return {
            data: response.data || [],
            success: response.success ?? true,
            total: response.total ?? 0,
          };
        }}
      />

      <Drawer
        title="新增用户"
        width={440}
        open={createOpen}
        destroyOnClose
        onClose={closeCreateDrawer}
        extra={
          <Space>
            <Button onClick={closeCreateDrawer}>取消</Button>
            <Button type="primary" loading={submitting} onClick={handleCreate}>
              创建
            </Button>
          </Space>
        }
      >
        <Form form={createForm} layout="vertical" requiredMark="optional">
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少 3 个字符' },
            ]}
          >
            <Input placeholder="用于登录的唯一用户名" maxLength={50} />
          </Form.Item>
          <Form.Item
            name="password"
            label="初始密码"
            rules={[
              { required: true, message: '请输入初始密码' },
              { min: 6, message: '密码至少 6 个字符' },
            ]}
          >
            <Input.Password placeholder="请输入初始密码" maxLength={128} />
          </Form.Item>
          <Form.Item name="display_name" label="昵称">
            <Input placeholder="选填，默认与用户名一致" maxLength={100} />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="user">
            <Select options={ROLE_OPTIONS} placeholder="请选择角色" />
          </Form.Item>
          <Form.Item
            name="is_active"
            label="状态"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={editingRecord ? `编辑用户 · ${editingRecord.username}` : '编辑用户'}
        width={440}
        open={editOpen}
        destroyOnClose
        onClose={closeEditDrawer}
        extra={
          <Space>
            <Button onClick={closeEditDrawer}>取消</Button>
            <Button type="primary" loading={submitting} onClick={handleEdit}>
              保存
            </Button>
          </Space>
        }
      >
        <Form form={editForm} layout="vertical" requiredMark="optional">
          <Form.Item label="用户名">
            <Input value={editingRecord?.username} disabled />
          </Form.Item>
          <Form.Item label="注册时间">
            <Input value={formatDatetime(editingRecord?.created_at)} disabled />
          </Form.Item>
          <Form.Item name="display_name" label="昵称">
            <Input placeholder="请输入昵称" maxLength={100} />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select options={ROLE_OPTIONS} placeholder="请选择角色" />
          </Form.Item>
          <Form.Item name="is_active" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title="用户详情"
        width={520}
        open={detailOpen}
        destroyOnClose
        onClose={closeDetailDrawer}
        extra={
          detailRecord ? (
            <Space>
              <Button onClick={() => openEditDrawer(detailRecord)}>编辑</Button>
              <Button danger onClick={() => handleDelete(detailRecord)}>
                删除
              </Button>
            </Space>
          ) : null
        }
      >
        {detailLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : detailRecord ? (
          <Space direction="vertical" size={24} style={{ width: '100%' }}>
            <Space align="center" size={16}>
              <Avatar
                size={64}
                src={detailRecord.avatar}
                style={{ backgroundColor: 'var(--chart-blue, #4A90D9)' }}
              >
                {(detailRecord.display_name || detailRecord.username).slice(0, 1).toUpperCase()}
              </Avatar>
              <Space direction="vertical" size={4}>
                <Typography.Title level={5} style={{ margin: 0 }}>
                  {detailRecord.display_name || detailRecord.username}
                </Typography.Title>
                <Space size={8}>
                  {roleTag(detailRecord.role)}
                  {statusTag(detailRecord.is_active)}
                </Space>
              </Space>
            </Space>
            <ProDescriptions<API.AdminUserItem>
              column={1}
              dataSource={detailRecord}
              columns={[
                { title: '用户 ID', dataIndex: 'id' },
                { title: '用户名', dataIndex: 'username' },
                {
                  title: '昵称',
                  dataIndex: 'display_name',
                  renderText: (value) => textFallback(value),
                },
                {
                  title: '头像地址',
                  dataIndex: 'avatar',
                  renderText: (value) => textFallback(value),
                },
                {
                  title: '注册时间',
                  dataIndex: 'created_at',
                  renderText: (value) => formatDatetime(value),
                },
                {
                  title: '最近登录时间',
                  dataIndex: 'last_login_at',
                  renderText: (value) => formatDatetime(value),
                },
              ]}
            />
          </Space>
        ) : (
          <Empty description="未获取到用户详情" />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default UserManagementPage;
