import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Helmet, history, Link, SelectLang, useIntl } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  Select,
  Steps,
  Typography,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { createStyles } from 'antd-style';
import React, { startTransition, useEffect, useMemo, useState } from 'react';
import {
  getJobTitleOptions,
  login,
  register,
  submitOnboardingProfile,
} from '@/services/ant-design-pro/api';
import { setAccessToken } from '@/utils/authToken';
import Settings from '../../../../config/defaultSettings';

const SUCCESS_ANIMATION_DELAY_MS = 350;

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
    background: linear-gradient(
      135deg,
      ${token.colorPrimaryBg} 0%,
      ${token.colorBgLayout} 50%,
      ${token.colorPrimaryBg} 100%
    );
    padding: 24px 16px;
  `,
  shell: css`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  `,
  card: css`
    width: min(680px, 100%);
    padding: 32px 40px;
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.10);
  `,
  logoArea: css`
    text-align: center;
    margin-bottom: 28px;
  `,
  productTitle: css`
    display: block;
    font-size: 24px;
    font-weight: 600;
    color: ${token.colorText};
    line-height: 1.3;
    margin-bottom: 8px;
  `,
  productSubtitle: css`
    display: block;
    font-size: 14px;
    font-weight: 400;
    color: ${token.colorTextSecondary};
    line-height: 1.5;
  `,
  title: css`
    margin-bottom: 24px !important;
    text-align: center;
  `,
  footer: css`
    display: flex;
    justify-content: space-between;
    margin-top: 24px;
  `,
  linkRow: css`
    margin-top: 16px;
    text-align: center;
  `,
  submitBtn: css`
    height: 40px;
    font-size: 14px;
    font-weight: 500;
  `,
}));

type RegisterStepValues = API.RegisterParams &
  API.OnboardingProfileRequest & {
    image_files?: UploadFile[];
  };

const Lang = () => {
  return (
    <div style={{ position: 'fixed', top: 16, right: 16 }}>
      <SelectLang />
    </div>
  );
};

const RegisterPage: React.FC = () => {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const intl = useIntl();
  const [form] = Form.useForm<RegisterStepValues>();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [registerState, setRegisterState] = useState<API.RegisterResult>({});
  const [jobTitleOptions, setJobTitleOptions] = useState<API.JobTitleOption[]>(
    [],
  );
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [accountCreated, setAccountCreated] = useState(false);

  useEffect(() => {
    void getJobTitleOptions({ skipErrorHandler: true })
      .then((response) => {
        setJobTitleOptions(response.data || []);
      })
      .catch(() => {
        setJobTitleOptions([]);
      });
  }, []);

  const stepItems = useMemo(
    () => [{ title: '账号' }, { title: '基础信息' }, { title: '简历图片' }],
    [],
  );

  const validateCurrentStep = async () => {
    if (currentStep === 0) {
      await form.validateFields(['username', 'password']);
      return;
    }
    if (currentStep === 1) {
      await form.validateFields([
        'full_name',
        'school',
        'major',
        'education_level',
        'grade',
        'target_job_title',
      ]);
    }
  };

  const handleSubmit = async () => {
    await form.validateFields([
      'username',
      'password',
      'full_name',
      'school',
      'major',
      'education_level',
      'grade',
      'target_job_title',
    ]);
    const values = form.getFieldsValue(true) as RegisterStepValues;
    setSubmitting(true);
    try {
      if (!accountCreated) {
        const registerResult = await register({
          username: values.username,
          password: values.password,
        });
        if (!registerResult.success) {
          setRegisterState(registerResult);
          return;
        }
        const loginResult = await login({
          username: values.username,
          password: values.password,
          type: 'account',
        });
        if (loginResult.status !== 'ok' || !loginResult.token) {
          throw new Error(loginResult.errorMessage || '登录失败');
        }
        setAccessToken(loginResult.token);
        setAccountCreated(true);
      }

      const formData = new FormData();
      formData.append('full_name', values.full_name);
      formData.append('school', values.school);
      formData.append('major', values.major);
      formData.append('education_level', values.education_level);
      formData.append('grade', values.grade);
      formData.append('target_job_title', values.target_job_title);
      fileList.forEach((file) => {
        if (file.originFileObj) {
          formData.append('image_files', file.originFileObj);
        }
      });
      await submitOnboardingProfile(formData);
      message.success('注册成功');
      await new Promise((resolve) => {
        window.setTimeout(resolve, SUCCESS_ANIMATION_DELAY_MS);
      });
      startTransition(() => {
        history.replace('/home-v2');
      });
    } catch (error: any) {
      const backendMessage =
        error?.response?.data?.detail ||
        error?.info?.errorMessage ||
        error?.message ||
        '提交失败';
      setRegisterState({
        status: 'error',
        errorMessage: backendMessage,
        success: false,
      });
      message.error(backendMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <Helmet>
        <title>
          {intl.formatMessage({
            id: 'pages.login.registerAccount',
            defaultMessage: '创建账户',
          })}
          {Settings.title && ` - ${Settings.title}`}
        </title>
      </Helmet>
      <Lang />
      <div className={styles.shell}>
        <div className={styles.card} data-testid="register-page-shell">
          <div className={styles.logoArea}>
            <span
              className={styles.productTitle}
              data-testid="register-page-title"
            >
              创建账户
            </span>
            <span className={styles.productSubtitle}>
              完成注册，开始职业规划之旅
            </span>
          </div>
          <Steps
            current={currentStep}
            items={stepItems}
            style={{ marginBottom: 24 }}
          />
          {registerState.status === 'error' ? (
            <Alert
              style={{ marginBottom: 16 }}
              type="error"
              showIcon
              message={registerState.errorMessage || '提交失败'}
            />
          ) : null}
          <Form form={form} layout="vertical" preserve>
            {currentStep === 0 ? (
              <>
                <Form.Item
                  label="用户名"
                  name="username"
                  rules={[{ required: true, message: '请输入用户名' }]}
                >
                  <Input
                    prefix={<UserOutlined />}
                    placeholder="请输入用户名"
                    autoComplete="username"
                  />
                </Form.Item>
                <Form.Item
                  label="密码"
                  name="password"
                  rules={[
                    { required: true, message: '请输入密码' },
                    { min: 8, message: '密码至少 8 位' },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="请输入密码"
                    autoComplete="new-password"
                  />
                </Form.Item>
              </>
            ) : null}

            {currentStep === 1 ? (
              <>
                <Form.Item
                  label="姓名"
                  name="full_name"
                  rules={[{ required: true, message: '请输入姓名' }]}
                >
                  <Input placeholder="请输入姓名" />
                </Form.Item>
                <Form.Item
                  label="学校"
                  name="school"
                  rules={[{ required: true, message: '请输入学校' }]}
                >
                  <Input placeholder="请输入学校" />
                </Form.Item>
                <Form.Item
                  label="专业"
                  name="major"
                  rules={[{ required: true, message: '请输入专业' }]}
                >
                  <Input placeholder="请输入专业" />
                </Form.Item>
                <Form.Item
                  label="学历"
                  name="education_level"
                  rules={[{ required: true, message: '请输入学历' }]}
                >
                  <Input placeholder="请输入学历" />
                </Form.Item>
                <Form.Item
                  label="年级"
                  name="grade"
                  rules={[{ required: true, message: '请输入年级' }]}
                >
                  <Input placeholder="请输入年级" />
                </Form.Item>
                <Form.Item
                  label="目标岗位名称"
                  name="target_job_title"
                  rules={[{ required: true, message: '请选择目标岗位名称' }]}
                >
                  <Select
                    id="target_job_title"
                    placeholder="请选择目标岗位名称"
                    options={jobTitleOptions}
                  />
                </Form.Item>
              </>
            ) : null}

            {currentStep === 2 ? (
              <Form.Item label="简历图片">
                <Upload
                  accept=".jpg,.jpeg,.png,.webp"
                  beforeUpload={() => false}
                  fileList={fileList}
                  onChange={({ fileList: nextFileList }) => {
                    setFileList(nextFileList);
                  }}
                >
                  <Button>上传图片</Button>
                </Upload>
              </Form.Item>
            ) : null}
          </Form>
          <div className={styles.footer}>
            <Button
              disabled={currentStep === 0}
              className={styles.submitBtn}
              onClick={() => setCurrentStep((step) => step - 1)}
            >
              上一步
            </Button>
            {currentStep < 2 ? (
              <Button
                type="primary"
                className={styles.submitBtn}
                onClick={async () => {
                  await validateCurrentStep();
                  setCurrentStep((step) => step + 1);
                }}
              >
                下一步
              </Button>
            ) : (
              <Button
                type="primary"
                className={styles.submitBtn}
                loading={submitting}
                onClick={() => void handleSubmit()}
              >
                完成注册
              </Button>
            )}
          </div>
          <div className={styles.linkRow}>
            <Link to="/user/login">返回登录</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
