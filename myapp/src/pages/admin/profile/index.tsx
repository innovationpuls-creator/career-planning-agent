import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Col, Form, Input, message, Row, Space, Upload } from 'antd';
import { UploadOutlined, UserOutlined } from '@ant-design/icons';
import React, { useEffect, useState } from 'react';
import { getAdminProfile, updateAdminProfile } from '@/services/ant-design-pro/api';

const { Password } = Input;

const AdminProfilePage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    getAdminProfile()
      .then((res) => {
        if (res.success && res.data) {
          form.setFieldsValue({
            username: res.data.username,
            display_name: res.data.display_name,
            role: res.data.role === 'admin' ? '管理员' : '普通用户',
          });
        }
      })
      .catch(() => {
        message.error('获取个人信息失败');
      })
      .finally(() => {
        setInitialLoading(false);
      });
  }, [form]);

  const handleSubmit = async (values: {
    display_name?: string;
    avatar?: string;
    password?: string;
  }) => {
    setLoading(true);
    try {
      await updateAdminProfile(values);
      message.success('个人信息更新成功');
      form.resetFields(['password']);
    } catch {
      message.error('更新失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <Row gutter={24}>
        <Col span={12}>
          <Card title="基本信息" loading={initialLoading}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{ display_name: '', username: '', role: '' }}
            >
              <Form.Item label="用户名" name="username">
                <Input disabled prefix={<UserOutlined />} />
              </Form.Item>

              <Form.Item
                label="昵称"
                name="display_name"
                rules={[{ required: true, message: '请输入昵称' }]}
              >
                <Input placeholder="请输入昵称" maxLength={128} />
              </Form.Item>

              <Form.Item label="角色" name="role">
                <Input disabled />
              </Form.Item>

              <Form.Item label="头像" name="avatar" valuePropName="avatar">
                <Upload
                  maxCount={1}
                  listType="picture-card"
                  beforeUpload={() => {
                    // TODO: 实现头像上传
                    message.info('头像上传功能待接入');
                    return false;
                  }}
                >
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 8 }}>上传</div>
                  </div>
                </Upload>
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    保存修改
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="修改密码">
            <Form layout="vertical" onFinish={handleSubmit}>
              <Form.Item
                label="新密码"
                name="password"
                rules={[
                  { min: 8, message: '密码至少8个字符' },
                  { max: 128, message: '密码最多128个字符' },
                ]}
              >
                <Password placeholder="请输入新密码（留空则不修改）" />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  修改密码
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default AdminProfilePage;
