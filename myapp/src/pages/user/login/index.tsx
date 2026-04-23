import { LockOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import {
  FormattedMessage,
  Helmet,
  history,
  SelectLang,
  useIntl,
  useModel,
} from '@umijs/max';
import { Alert, App, Button, Checkbox, Form, Input, Space, theme } from 'antd';
import { createStyles } from 'antd-style';
import React, { startTransition, useState } from 'react';
import { flushSync } from 'react-dom';
import { login } from '@/services/ant-design-pro/api';
import { setAccessToken } from '@/utils/authToken';
import { resolvePostLoginRedirect } from '@/utils/postLoginRedirect';
import Settings from '../../../../config/defaultSettings';

const SUCCESS_ANIMATION_DELAY_MS = 350;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useStyles = createStyles(({ token }: { token: any }) => ({
  // === 右面板（表单区）===
  rightPanel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 32px',
    background: token.colorBgBase,
    animation: `fadeInRight 0.35s ease-out 0.06s both`,
    '@keyframes fadeInRight': {
      from: { opacity: 0, transform: 'translateX(10px)' },
      to: { opacity: 1, transform: 'translateX(0)' },
    },
  },

  loginCard: {
    width: '100%',
    maxWidth: 380,
  },

  formTitle: {
    fontSize: token.fontSizeHeading1,
    fontWeight: token.fontWeightSemibold,
    color: token.colorText,
    lineHeight: 1.3,
    marginBottom: 6,
    letterSpacing: '-0.01em',
  },

  formSubtitle: {
    fontSize: token.fontSize,
    fontWeight: token.fontWeightRegular,
    color: token.colorTextSecondary,
    lineHeight: 1.6,
    marginBottom: 20,
  },

  errorAlert: {
    marginBottom: 20,
  },

  autoLoginRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  forgotLink: {
    fontSize: 13,
    color: token.colorTextSecondary,
    cursor: 'pointer',
    transition: `color ${token.motionDurationFast} ${token.motionEaseInOut}`,
    '&:hover': {
      color: token.colorPrimary,
    },
  },

  submitBtn: {
    width: '100%',
    height: 40,
    fontSize: token.fontSize,
    fontWeight: token.fontWeightMedium,
    borderRadius: token.borderRadiusLG,
  },

  registerEntry: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    fontSize: token.fontSize,
    color: token.colorTextSecondary,
    cursor: 'pointer',
    transition: `color ${token.motionDurationFast} ${token.motionEaseInOut}`,
    '&:hover': {
      color: token.colorPrimary,
    },
  },

  // Input autofill override — kills browser blue background on all states
  inputAutofill: {
    '& input': {
      backgroundColor: `${token.colorBgContainer} !important`,
      backgroundImage: 'none !important',
      WebkitBoxShadow: `0 0 0 100px ${token.colorBgContainer} inset !important`,
      '&:-webkit-autofill': {
        WebkitBoxShadow: `0 0 0 100px ${token.colorBgContainer} inset !important`,
      },
    },
  },
}));

const Lang = () => (
  <div
    style={{
      position: 'fixed',
      top: 20,
      right: 24,
      zIndex: 100,
    }}
  >
    <SelectLang />
  </div>
);

const LoginMessage: React.FC<{ content: string }> = ({ content }) => (
  <Alert message={content} type="error" showIcon />
);

const FEATURES = [
  '智能职业规划与路径推荐',
  '个性化成长报告生成',
  '岗位能力图谱与对比分析',
];

const Login: React.FC = () => {
  const [userLoginState, setUserLoginState] = useState<API.LoginResult>({});
  const [submitting, setSubmitting] = useState(false);
  const { initialState, setInitialState } = useModel('@@initialState');
  const { styles } = useStyles();
  const { message } = App.useApp();
  const intl = useIntl();
  const { token } = theme.useToken();

  const fetchUserInfo = async () => {
    const userInfo = await initialState?.fetchUserInfo?.();
    if (userInfo) {
      flushSync(() => {
        setInitialState((s) => ({
          ...s,
          currentUser: userInfo,
        }));
      });
    }
    return userInfo;
  };

  const handleSubmit = async (values: API.LoginParams) => {
    try {
      setSubmitting(true);
      const msg = await login({ ...values, type: 'account' });
      if (msg.status === 'ok' && msg.token) {
        setAccessToken(msg.token);
        const defaultLoginSuccessMessage = intl.formatMessage({
          id: 'pages.login.success',
          defaultMessage: '登录成功',
        });
        message.success(defaultLoginSuccessMessage);
        const userInfo = await fetchUserInfo();
        const urlParams = new URL(window.location.href).searchParams;
        const nextPath = resolvePostLoginRedirect(
          urlParams.get('redirect'),
          userInfo,
        );
        await new Promise((resolve) => {
          window.setTimeout(resolve, SUCCESS_ANIMATION_DELAY_MS);
        });
        startTransition(() => {
          history.push(nextPath);
        });
        return;
      }

      const nextState = {
        ...msg,
        status: msg.status || 'error',
      };
      setUserLoginState(nextState);
      if (nextState.errorMessage) {
        message.error(nextState.errorMessage);
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { detail?: string } };
        info?: { errorMessage?: string };
      };
      const backendMessage =
        err?.response?.data?.detail || err?.info?.errorMessage;
      const defaultLoginFailureMessage = intl.formatMessage({
        id: 'pages.login.failure',
        defaultMessage: '登录失败，请重试',
      });
      setUserLoginState({
        status: 'error',
        errorMessage: backendMessage || defaultLoginFailureMessage,
      });
      message.error(backendMessage || defaultLoginFailureMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const { status, errorMessage } = userLoginState;

  return (
    <>
      <Helmet>
        <title>
          {intl.formatMessage({
            id: 'menu.login',
            defaultMessage: '登录',
          })}
          {Settings.title && ` - ${Settings.title}`}
        </title>
      </Helmet>
      <Lang />
      <div className="auth-root" data-testid="login-page-shell">
        {/* 左面板：品牌区 — 使用 CSS class（global.less） */}
        <div className="auth-left">
          <div className="auth-left-top">
            <div className="auth-left-logo-area">
              <div className="auth-left-logo-icon">
                <RobotOutlined style={{ fontSize: 18, color: '#FFFFFF' }} />
              </div>
              <span className="auth-left-logo-text">CareerAgent</span>
            </div>

            <div className="auth-left-title">大学生职业规划智能体</div>
            <div className="auth-left-subtitle">你的 AI 职业导师</div>

            <div className="auth-left-divider" />

            <div className="auth-left-features">
              {FEATURES.map((f) => (
                <div key={f} className="auth-left-feature-item">
                  <div className="auth-left-feature-dot" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="auth-left-copyright">
            © {new Date().getFullYear()} CareerAgent. 保留所有权利。
          </div>

          <div className="auth-left-deco-circle" />
        </div>

        {/* 右面板：表单区 */}
        <div className="auth-right">
          <div className="auth-card" data-testid="login-form-card">
            <div className={styles.formTitle}>欢迎回来</div>
            <div className={styles.formSubtitle}>
              <FormattedMessage
                id="pages.login.subtitle"
                defaultMessage="登录以继续使用"
              />
            </div>

            {status === 'error' && (
              <div className={styles.errorAlert}>
                <LoginMessage
                  content={
                    errorMessage || '用户名或密码错误（管理员：admin / 123456）'
                  }
                />
              </div>
            )}

            <Form
              layout="vertical"
              requiredMark="optional"
              onFinish={async (values) => {
                await handleSubmit(values as API.LoginParams);
              }}
            >
              <Form.Item
                name="username"
                rules={[
                  {
                    required: true,
                    message: (
                      <FormattedMessage
                        id="pages.login.username.required"
                        defaultMessage="请输入用户名"
                      />
                    ),
                  },
                ]}
              >
                <Input
                  size="large"
                  prefix={
                    <UserOutlined style={{ color: token.colorTextTertiary }} />
                  }
                  placeholder={intl.formatMessage({
                    id: 'pages.login.username.placeholder',
                    defaultMessage: '用户名：admin 或普通用户',
                  })}
                  className={styles.inputAutofill}
                  style={{ height: 40, borderRadius: token.borderRadius }}
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[
                  {
                    required: true,
                    message: (
                      <FormattedMessage
                        id="pages.login.password.required"
                        defaultMessage="请输入密码"
                      />
                    ),
                  },
                ]}
              >
                <Input.Password
                  size="large"
                  prefix={
                    <LockOutlined style={{ color: token.colorTextTertiary }} />
                  }
                  placeholder={intl.formatMessage({
                    id: 'pages.login.password.placeholder',
                    defaultMessage: '密码：管理员为 123456',
                  })}
                  className={styles.inputAutofill}
                  style={{ height: 40, borderRadius: token.borderRadius }}
                />
              </Form.Item>

              <div className={styles.autoLoginRow}>
                <Form.Item name="autoLogin" valuePropName="checked" noStyle>
                  <Checkbox>
                    <span
                      style={{
                        fontSize: 13,
                        color: token.colorTextSecondary,
                      }}
                    >
                      <FormattedMessage
                        id="pages.login.remember"
                        defaultMessage="记住登录"
                      />
                    </span>
                  </Checkbox>
                </Form.Item>

                <span
                  className={styles.forgotLink}
                  onClick={() => {
                    message.info(
                      intl.formatMessage({
                        id: 'pages.login.forgot',
                        defaultMessage: '请联系管理员重置密码',
                      }),
                    );
                  }}
                >
                  <FormattedMessage
                    id="pages.login.forgotPassword"
                    defaultMessage="忘记密码？"
                  />
                </span>
              </div>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  loading={submitting}
                  className={styles.submitBtn}
                >
                  <FormattedMessage
                    id="pages.login.submit"
                    defaultMessage="登录"
                  />
                </Button>
              </Form.Item>
            </Form>

            <div
              className={styles.registerEntry}
              data-testid="register-account-link"
              onClick={() => {
                startTransition(() => {
                  history.push('/user/register');
                });
              }}
            >
              <FormattedMessage
                id="pages.login.noAccount"
                defaultMessage="还没有账户？"
              />
              <Space size={4} />
              <span style={{ color: token.colorPrimary, fontWeight: 500 }}>
                <FormattedMessage
                  id="pages.login.register"
                  defaultMessage="立即注册"
                />
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
