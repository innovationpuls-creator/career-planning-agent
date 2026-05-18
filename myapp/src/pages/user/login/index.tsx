import { LockOutlined, UserOutlined } from '@ant-design/icons';
import {
  FormattedMessage,
  Helmet,
  history,
  SelectLang,
  useIntl,
  useModel,
} from '@umijs/max';
import { App, Checkbox, Form, Space, theme } from 'antd';
import { createStyles } from 'antd-style';
import React, { startTransition, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  AuthGlassCard,
  AuthSplitShell,
  useAuthMorphTransition,
} from '@/components/auth';
import { ClaudeButton, ClaudeInput, ClaudePassword } from '@/components/ui';
import { login } from '@/services/ant-design-pro/api';
import { setAccessToken } from '@/utils/authToken';
import { resolvePostLoginRedirect } from '@/utils/postLoginRedirect';
import Settings from '../../../../config/defaultSettings';

const SUCCESS_ANIMATION_DELAY_MS = 350;

const useStyles = createStyles(({ token }: { token: any }) => ({
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
    transition: 'color 0.15s ease',
    '&:hover': {
      color: token.colorPrimary,
    },
  },

  registerEntry: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    fontSize: token.fontSize,
    color: token.colorTextSecondary,
    cursor: 'pointer',
    transition: 'color 0.15s ease',
    '&:hover': {
      color: token.colorPrimary,
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

/** Lightweight state hook — encapsulates all login form logic. */
function useLoginState() {
  const [userLoginState, setUserLoginState] = useState<API.LoginResult>({});
  const [submitting, setSubmitting] = useState(false);
  const { initialState, setInitialState } = useModel('@@initialState');
  const { message } = App.useApp();
  const intl = useIntl();
  const themeToken = theme.useToken();

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
        setAccessToken(msg.token, values.autoLogin !== false);
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

  return {
    submitting,
    userLoginState,
    handleSubmit,
    message,
    intl,
    token: themeToken.token,
  } as const;
}

const Login: React.FC = () => {
  const { submitting, userLoginState, handleSubmit, message, intl, token } =
    useLoginState();
  const { styles } = useStyles();
  const { status, errorMessage } = userLoginState;
  const morph = useAuthMorphTransition('login');
  const goRegister = () => {
    morph.startRouteMorph('register', () => {
      startTransition(() => {
        history.push('/user/register');
      });
    });
  };

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
      <AuthSplitShell variant="login">
        <AuthGlassCard
          variant="login"
          title="欢迎回来"
          subtitle={intl.formatMessage({
            id: 'pages.login.subtitle',
            defaultMessage: '登录以继续使用',
          })}
          errorMessage={
            status === 'error'
              ? errorMessage || '用户名或密码错误（管理员：admin / 123456）'
              : undefined
          }
          morphing={morph.isMorphing}
          onTabChange={(target) => {
            if (target === 'register') goRegister();
          }}
        >
          <div data-testid="login-form-card">
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
                <ClaudeInput
                  id="username"
                  size="large"
                  prefix={
                    <UserOutlined style={{ color: token.colorTextTertiary }} />
                  }
                  placeholder={intl.formatMessage({
                    id: 'pages.login.username.placeholder',
                    defaultMessage: '用户名：admin 或普通用户',
                  })}
                  style={{ height: 40 }}
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
                <ClaudePassword
                  id="password"
                  size="large"
                  prefix={
                    <LockOutlined style={{ color: token.colorTextTertiary }} />
                  }
                  placeholder={intl.formatMessage({
                    id: 'pages.login.password.placeholder',
                    defaultMessage: '密码：管理员为 123456',
                  })}
                  style={{ height: 40 }}
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
                  data-testid="forgot-password-link"
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
                <ClaudeButton
                  variant="terracotta"
                  htmlType="submit"
                  size="large"
                  block
                  loading={submitting}
                  style={{ height: 40 }}
                >
                  <FormattedMessage
                    id="pages.login.submit"
                    defaultMessage="登录"
                  />
                </ClaudeButton>
              </Form.Item>
            </Form>

            <div
              className={styles.registerEntry}
              data-testid="register-account-link"
              onClick={goRegister}
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
        </AuthGlassCard>
      </AuthSplitShell>
    </>
  );
};

export default Login;
