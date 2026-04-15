import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import {
  FormattedMessage,
  Helmet,
  SelectLang,
  history,
  useIntl,
  useModel,
} from '@umijs/max';
import { Alert, App } from 'antd';
import { createStyles } from 'antd-style';
import React, { startTransition, useState } from 'react';
import { flushSync } from 'react-dom';
import { login } from '@/services/ant-design-pro/api';
import { setAccessToken } from '@/utils/authToken';
import { resolvePostLoginRedirect } from '@/utils/postLoginRedirect';
import Settings from '../../../../config/defaultSettings';

const SUCCESS_ANIMATION_DELAY_MS = 350;

const useStyles = createStyles(({ token }) => {
  return {
    lang: {
      width: 42,
      height: 42,
      lineHeight: '42px',
      position: 'fixed',
      right: 16,
      borderRadius: token.borderRadius,
      ':hover': {
        backgroundColor: token.colorBgTextHover,
      },
    },
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'auto',
      backgroundImage:
        "url('https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/V-_oS6r-i7wAAAAAAAAAAAAAFl94AQBr')",
      backgroundSize: '100% 100%',
    },
    loginForm: {
      '& .ant-pro-form-login-header': {
        justifyContent: 'center',
      },
      '& .ant-pro-form-login-title': {
        marginInlineStart: 0,
      },
    },
  };
});

const Lang = () => {
  const { styles } = useStyles();

  return (
    <div className={styles.lang} data-lang>
      {SelectLang && <SelectLang />}
    </div>
  );
};

const LoginMessage: React.FC<{
  content: string;
}> = ({ content }) => {
  return (
    <Alert
      style={{
        marginBottom: 24,
      }}
      message={content}
      type="error"
      showIcon
    />
  );
};

const Login: React.FC = () => {
  const [userLoginState, setUserLoginState] = useState<API.LoginResult>({});
  const { initialState, setInitialState } = useModel('@@initialState');
  const { styles } = useStyles();
  const { message } = App.useApp();
  const intl = useIntl();
  const loginTitle = (
    <span
      data-testid="login-page-title"
      style={{
        display: 'inline-block',
        transform: 'translateY(calc(50vh - 250px))',
      }}
    >
      大学生职业规划智能体
    </span>
  );

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
    }
  };

  const { status, errorMessage } = userLoginState;

  return (
    <div className={styles.container}>
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
      <div
        data-testid="login-page-shell"
        style={{
          flex: '1',
        }}
      >
        <LoginForm
          className={styles.loginForm}
          containerStyle={{
            position: 'relative',
          }}
          contentStyle={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            minWidth: 280,
            maxWidth: '75vw',
          }}
          title={loginTitle}
          onFinish={async (values) => {
            await handleSubmit(values as API.LoginParams);
          }}
        >
          {status === 'error' && (
            <LoginMessage
              content={errorMessage || '用户名或密码错误（管理员：admin / 123456）'}
            />
          )}
          <ProFormText
            name="username"
            fieldProps={{
              size: 'large',
              prefix: <UserOutlined />,
            }}
            placeholder="用户名：admin 或普通用户"
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
          />
          <ProFormText.Password
            name="password"
            fieldProps={{
              size: 'large',
              prefix: <LockOutlined />,
            }}
            placeholder="密码：管理员为 123456"
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
          />
          <div
            style={{
              marginBottom: 24,
              textAlign: 'right',
            }}
          >
            <a
              data-testid="register-account-link"
              href="/user/register"
              onClick={(event) => {
                event.preventDefault();
                startTransition(() => {
                  history.push('/user/register');
                });
              }}
            >
              创建账户
            </a>
          </div>
        </LoginForm>
      </div>
    </div>
  );
};

export default Login;
