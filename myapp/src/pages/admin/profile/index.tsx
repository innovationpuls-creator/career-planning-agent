import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import {
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  message,
  Row,
  Space,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import {
  getAdminProfile,
  updateAdminProfile,
} from '@/services/ant-design-pro/api';

const { Password } = Input;

type ProfileFormValues = {
  username?: string;
  display_name?: string;
  role?: string;
  avatar?: string;
  created_at?: string;
};

type PasswordFormValues = {
  password?: string;
  confirmPassword?: string;
};

const formatDatetime = (value?: string) => {
  if (!value) {
    return '暂无';
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : value;
};

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

const AdminProfilePage: React.FC = () => {
  const [profileForm] = Form.useForm<ProfileFormValues>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const [initialLoading, setInitialLoading] = useState(true);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [profile, setProfile] = useState<API.AdminUserItem>();
  const avatarUrl = Form.useWatch('avatar', profileForm);
  const { setInitialState } = useModel('@@initialState');

  useEffect(() => {
    getAdminProfile()
      .then((res) => {
        if (!res.data) {
          return;
        }

        setProfile(res.data);
        profileForm.setFieldsValue({
          username: res.data.username,
          display_name: res.data.display_name,
          role: res.data.role === 'admin' ? '管理员' : '普通用户',
          avatar: res.data.avatar,
          created_at: formatDatetime(res.data.created_at),
        });
      })
      .catch((error) => {
        message.error(getErrorMessage(error, '获取个人信息失败'));
      })
      .finally(() => {
        setInitialLoading(false);
      });
  }, [profileForm]);

  const syncGlobalUser = (record: API.AdminUserItem) => {
    setInitialState((state) => ({
      ...state,
      currentUser: state?.currentUser
        ? {
            ...state.currentUser,
            name: record.display_name,
            avatar: record.avatar,
          }
        : state?.currentUser,
    }));
  };

  const handleProfileSubmit = async (values: ProfileFormValues) => {
    setProfileSubmitting(true);
    try {
      const response = await updateAdminProfile({
        display_name: values.display_name,
        avatar: values.avatar || undefined,
      });
      if (response.data) {
        setProfile(response.data);
        profileForm.setFieldsValue({
          username: response.data.username,
          display_name: response.data.display_name,
          role: response.data.role === 'admin' ? '管理员' : '普通用户',
          avatar: response.data.avatar,
          created_at: formatDatetime(response.data.created_at),
        });
        syncGlobalUser(response.data);
      }
      message.success('个人信息更新成功');
    } catch (error) {
      message.error(getErrorMessage(error, '更新个人信息失败'));
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (values: PasswordFormValues) => {
    if (!values.password) {
      return;
    }

    setPasswordSubmitting(true);
    try {
      await updateAdminProfile({ password: values.password });
      message.success('密码更新成功');
      passwordForm.resetFields();
    } catch (error) {
      message.error(getErrorMessage(error, '更新密码失败'));
    } finally {
      setPasswordSubmitting(false);
    }
  };

  return (
    <PageContainer
      header={{
        title: '个人信息',
        subTitle: '维护管理员昵称、头像地址和登录密码。',
      }}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="基础资料" loading={initialLoading}>
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              <Space align="center" size={16}>
                <Avatar
                  size={72}
                  src={avatarUrl || profile?.avatar}
                  style={{ backgroundColor: '#1677ff' }}
                >
                  {(
                    profileForm.getFieldValue('display_name') ||
                    profile?.username ||
                    'A'
                  )
                    .slice(0, 1)
                    .toUpperCase()}
                </Avatar>
                <Space direction="vertical" size={4}>
                  <Typography.Title
                    level={5}
                    className="heading-3"
                    style={{ margin: 0 }}
                  >
                    {profileForm.getFieldValue('display_name') ||
                      profile?.username ||
                      '管理员'}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    当前仓库暂无头像上传接口，请先使用公开可访问的图片 URL。
                  </Typography.Text>
                </Space>
              </Space>

              <Divider style={{ margin: 0 }} />

              <Form
                form={profileForm}
                layout="vertical"
                onFinish={handleProfileSubmit}
                initialValues={{
                  display_name: '',
                  username: '',
                  role: '',
                  avatar: '',
                }}
              >
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item label="用户名" name="username">
                      <Input disabled />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="角色" name="role">
                      <Input disabled />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="昵称"
                      name="display_name"
                      rules={[{ required: true, message: '请输入昵称' }]}
                    >
                      <Input placeholder="请输入昵称" maxLength={128} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="创建时间" name="created_at">
                      <Input disabled />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label="头像 URL"
                  name="avatar"
                  rules={[
                    {
                      type: 'url',
                      warningOnly: true,
                      message: '建议填写完整的图片 URL',
                    },
                  ]}
                >
                  <Input placeholder="https://example.com/avatar.png" />
                </Form.Item>

                <Form.Item style={{ marginBottom: 0 }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={profileSubmitting}
                  >
                    保存资料
                  </Button>
                </Form.Item>
              </Form>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="修改密码" loading={initialLoading}>
            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handlePasswordSubmit}
            >
              <Form.Item
                label="新密码"
                name="password"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 8, message: '密码至少 8 个字符' },
                  { max: 128, message: '密码最多 128 个字符' },
                ]}
              >
                <Password placeholder="请输入新密码" />
              </Form.Item>

              <Form.Item
                label="确认新密码"
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请再次输入新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
              >
                <Password placeholder="请再次输入新密码" />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                loading={passwordSubmitting}
              >
                更新密码
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default AdminProfilePage;
