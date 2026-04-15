import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Col, DatePicker, Divider, Drawer, Form, Input, message, Modal, Row, Select, Space, Switch, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { createAdminUser, deleteAdminUser, getAdminUsers, updateAdminUser } from '@/services/ant-design-pro/api';
import { ROLE_OPTIONS, STATUS_OPTIONS } from './constants';

const textFallback = (value?: string) => value || '暂无';

interface UserFormValues {
  username?: string;
  password?: string;
  display_name?: string;
  role?: string;
  is_active?: boolean;
}

const UserManagementPage: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [currentRow, setCurrentRow] = useState<API.AdminUserItem>();
  const [createForm] = Form.useForm<UserFormValues>();
  const [editForm] = Form.useForm<UserFormValues>();
  const [submitting, setSubmitting] = useState(false);

  // Open create drawer
  const handleOpenCreate = () => {
    createForm.resetFields();
    setCreateOpen(true);
  };

  // Submit create user
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
      setCreateOpen(false);
      actionRef.current?.reload();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return; // form validation error
      message.error('创建用户失败');
    } finally {
      setSubmitting(false);
    }
  };

  // Open edit drawer
  const handleOpenEdit = (record: API.AdminUserItem) => {
    setCurrentRow(record);
    editForm.setFieldsValue({
      display_name: record.display_name,
      role: record.role,
      is_active: record.is_active,
    });
    setEditOpen(true);
  };

  // Submit edit user
  const handleEdit = async () => {
    if (!currentRow) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      await updateAdminUser({
        user_id: currentRow.id,
        display_name: values.display_name,
        role: values.role,
        is_active: values.is_active,
      });
      message.success('用户信息更新成功');
      setEditOpen(false);
      actionRef.current?.reload();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('更新用户失败');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete user
  const handleDelete = (record: API.AdminUserItem) => {
    Modal.confirm({
      title: `确认删除用户「${record.username}」？`,
      content: '删除后无法恢复，请确认。',
      okText: '确认删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteAdminUser(record.id);
          message.success('用户已删除');
          actionRef.current?.reload();
        } catch {
          message.error('删除用户失败');
        }
      },
    });
  };

  const columns: ProColumns<API.AdminUserItem>[] = [
    {
      title: '用户ID',
      dataIndex: 'id',
      search: false,
      width: 80,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      ellipsis: true,
    },
    {
      title: '昵称',
      dataIndex: 'display_name',
      ellipsis: true,
      search: false,
    },
    {
      title: '角色',
      dataIndex: 'role',
      ellipsis: true,
      valueType: 'select',
      fieldProps: {
        mode: 'multiple',
        allowClear: true,
        showSearch: true,
        options: ROLE_OPTIONS,
      },
      render: (_, record) => (
        <Tag color={record.role === 'admin' ? 'gold' : 'blue'}>
          {record.role === 'admin' ? '管理员' : '普通用户'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      ellipsis: true,
      valueType: 'select',
      fieldProps: {
        mode: 'multiple',
        allowClear: true,
        options: STATUS_OPTIONS,
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'error'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      search: false,
      valueType: 'dateTime',
      width: 180,
    },
    {
      title: '最近登录',
      dataIndex: 'last_login_at',
      search: false,
      valueType: 'dateTime',
      width: 180,
      render: (_, record) => textFallback(record.last_login_at),
    },
    {
      title: '操作',
      key: 'option',
      fixed: 'right',
      width: 140,
      search: false,
      render: (_, record) => (
        <Space split={<Divider type="vertical" />}>
          <a onClick={() => handleOpenEdit(record)}>编辑</a>
          <a onClick={() => handleDelete(record)} style={{ color: '#ff4d4f' }}>
            删除
          </a>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.AdminUserItem, API.AdminUserQueryParams>
        actionRef={actionRef}
        rowKey="id"
        size="middle"
        headerTitle="用户列表"
        search={{ labelWidth: 92, defaultCollapsed: false }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        toolBarRender={() => [
          <Button type="primary" key="create" onClick={handleOpenCreate}>
            新增用户
          </Button>,
        ]}
        columns={columns}
        request={async (params) => {
          const response = await getAdminUsers({
            current: params.current,
            pageSize: params.pageSize,
            username: params.username,
            role: params.role,
            is_active: params.is_active,
          });
          return {
            data: response.data || [],
            success: response.success ?? true,
            total: response.total ?? 0,
          };
        }}
      />

      {/* 新增用户抽屉 */}
      <Drawer
        title="新增用户"
        width={480}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        footer={
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setCreateOpen(false)}>取消</Button>
            <Button type="primary" loading={submitting} onClick={handleCreate}>
              确认创建
            </Button>
          </Space>
        }
      >
        <Form form={createForm} layout="vertical" requiredMark="optional">
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }, { min: 3, message: '用户名至少3个字符' }]}
          >
            <Input placeholder="用于登录的唯一用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少6个字符' }]}
          >
            <Input.Password placeholder="初始密码" />
          </Form.Item>
          <Form.Item name="display_name" label="昵称">
            <Input placeholder="用户昵称（选填）" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="user">
            <Select options={ROLE_OPTIONS} placeholder="选择用户角色" />
          </Form.Item>
          <Form.Item name="is_active" label="状态" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 编辑用户抽屉 */}
      <Drawer
        title={`编辑用户 — ${currentRow?.username}`}
        width={480}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        footer={
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setEditOpen(false)}>取消</Button>
            <Button type="primary" loading={submitting} onClick={handleEdit}>
              保存修改
            </Button>
          </Space>
        }
      >
        <Form form={editForm} layout="vertical" requiredMark="optional">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="用户名">
                <Input value={currentRow?.username} disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="注册时间">
                <Input value={currentRow?.created_at ? textFallback(currentRow.created_at) : '暂无'} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="display_name" label="昵称">
            <Input placeholder="用户昵称" />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select options={ROLE_OPTIONS} placeholder="选择用户角色" />
          </Form.Item>
          <Form.Item name="is_active" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Drawer>
    </PageContainer>
  );
};

export default UserManagementPage;
