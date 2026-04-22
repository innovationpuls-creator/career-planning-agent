import { LockOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import {
  FormattedMessage,
  Helmet,
  history,
  SelectLang,
  useIntl,
  useModel,
} from '@umijs/max';
import { Alert, App, Button, Checkbox, Form, Input, theme } from 'antd';
import { createStyles } from 'antd-style';
import React, { startTransition, useState } from 'react';
import { flushSync } from 'react-dom';
import { login } from '@/services/ant-design-pro/api';
import { setAccessToken } from '@/utils/authToken';
import { resolvePostLoginRedirect } from '@/utils/postLoginRedirect';
import Settings from '../../../../config/defaultSettings';

const SUCCESS_ANIMATION_DELAY_MS = 350;

const useStyles = createStyles(({ token }) => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: `linear-gradient(135deg, ${token.colorPrimaryBg} 0%, ${token.colorBgLayout} 50%, ${token.colorPrimaryBg} 100%)`,
    // 让背景延伸到 header 背后，内容视觉上在 header 下方
    marginTop: -56,
    padding: '56px 16px 24px',
    boxSizing: 'border-box',
    position: 'relative',
    zIndex: 1,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: 'rgba(255, 255, 255, 0.96)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.10)',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 2,
  },
  cardInner: {
    padding: '32px 40px 28px',
  },
  logoArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 28,
  },
  logoIconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 12,
    background: token.colorPrimaryBg,
    marginBottom: 16,
  },
  productTitle: {
    display: 'block',
    fontSize: 24,
    fontWeight: 600,
    color: token.colorText,
    lineHeight: 1.3,
    marginBottom: 6,
    letterSpacing: '-0.01em',
  },
  productSubtitle: {
    display: 'block',
    fontSize: 14,
    fontWeight: 400,
    color: token.colorTextSecondary,
    lineHeight: 1.5,
  },
  errorAlert: {
    marginBottom: 20,
  },
  forgotRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: token.margin,
    marginTop: -4,
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
    fontSize: 14,
    fontWeight: 500,
  },
  registerLink: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    fontSize: 14,
    color: token.colorTextSecondary,
    cursor: 'pointer',
    transition: `color ${token.motionDurationFast} ${token.motionEaseInOut}`,
    '&:hover': {
      color: token.colorPrimary,
    },
  },
  registerLinkInner: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
}));

const Lang = () => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 1000,
      }}
    >
      <SelectLang />
    </div>
  );
};

const LoginMessage: React.FC<{
  content: string;
}> = ({ content }) => {
  return <Alert message={content} type="error" showIcon />;
};

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
    } catch (error: any) {
      const backendMessage =
        error?.response?.data?.detail || error?.info?.errorMessage;
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
      <div className={styles.container}>
        <div className={styles.card} data-testid="login-page-shell">
          {/* Logo 区 */}
          <div className={styles.logoArea}>
            <div className={styles.logoIconWrap}>
              <RobotOutlined
                style={{ fontSize: 24, color: token.colorPrimary }}
              />
            </div>
            <span
              className={styles.productTitle}
              data-testid="login-page-title"
            >
              大学生职业规划智能体
            </span>
            <span className={styles.productSubtitle}>
              <FormattedMessage
                id="pages.login.subtitle"
                defaultMessage="登录以继续使用"
              />
            </span>
          </div>

          {/* 错误提示 */}
          {status === 'error' && (
            <div className={styles.errorAlert}>
              <LoginMessage
                content={
                  errorMessage || '用户名或密码错误（管理员：admin / 123456）'
                }
              />
            </div>
          )}

          {/* 表单区 */}
          <div className={styles.cardInner}>
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
                />
              </Form.Item>

              <Form.Item name="autoLogin" valuePropName="checked" noStyle>
                <Checkbox>
                  <span
                    style={{ fontSize: 13, color: token.colorTextSecondary }}
                  >
                    <FormattedMessage
                      id="pages.login.remember"
                      defaultMessage="记住登录"
                    />
                  </span>
                </Checkbox>
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  loading={submitting}
                >
                  <FormattedMessage
                    id="pages.login.submit"
                    defaultMessage="登录"
                  />
                </Button>
              </Form.Item>
            </Form>

            {/* 忘记密码 */}
            <div className={styles.forgotRow}>
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

            {/* 注册入口 */}
            <div className={styles.registerLink}>
              <span
                className={styles.registerLinkInner}
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
                <span style={{ color: token.colorPrimary, fontWeight: 500 }}>
                  <FormattedMessage
                    id="pages.login.register"
                    defaultMessage="立即注册"
                  />
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
