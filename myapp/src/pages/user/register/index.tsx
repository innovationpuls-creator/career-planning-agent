import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { FormattedMessage, Helmet, Link, SelectLang, history, useIntl } from '@umijs/max';
import { Alert, App } from 'antd';
import { createStyles } from 'antd-style';
import React, { startTransition, useState } from 'react';
import { register } from '@/services/ant-design-pro/api';
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
    registerForm: {
      '& .ant-pro-form-login-header': {
        justifyContent: 'center',
      },
      '& .ant-pro-form-login-title': {
        marginInlineStart: 0,
      },
    },
  };
});

type RegisterFormValues = API.RegisterParams;

const Lang = () => {
  const { styles } = useStyles();

  return (
    <div className={styles.lang} data-lang>
      {SelectLang && <SelectLang />}
    </div>
  );
};

const RegisterMessage: React.FC<{
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

const RegisterPage: React.FC = () => {
  const [registerState, setRegisterState] = useState<API.RegisterResult>({});
  const { styles } = useStyles();
  const { message } = App.useApp();
  const intl = useIntl();
  const registerTitle = (
    <span
      data-testid="register-page-title"
      style={{
        display: 'inline-block',
        transform: 'translateY(calc(50vh - 250px))',
      }}
    >
      创建账户
    </span>
  );

  const handleSubmit = async (values: RegisterFormValues) => {
    try {
      const result = await register(values);
      if (result.success) {
        message.success('Account created successfully.');
        await new Promise((resolve) => {
          window.setTimeout(resolve, SUCCESS_ANIMATION_DELAY_MS);
        });
        startTransition(() => {
          history.replace('/user/login');
        });
        return;
      }

      setRegisterState(result);
      if (result.errorMessage) {
        message.error(result.errorMessage);
      }
    } catch (error: any) {
      const backendMessage =
        error?.response?.data?.detail || error?.info?.errorMessage || 'Account creation failed.';
      setRegisterState({
        status: 'error',
        errorMessage: backendMessage,
        success: false,
      });
      message.error(backendMessage);
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
      <div
        data-testid="register-page-shell"
        style={{
          flex: '1',
        }}
      >
        <LoginForm<RegisterFormValues>
          className={styles.registerForm}
          containerStyle={{
            position: 'relative',
          }}
          contentStyle={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            minWidth: 320,
            maxWidth: '75vw',
          }}
          title={registerTitle}
          submitter={{
            searchConfig: {
              submitText: '创建账户',
            },
          }}
          onFinish={async (values) => {
            await handleSubmit(values);
          }}
        >
          {registerState.status === 'error' && (
            <RegisterMessage
              content={registerState.errorMessage || 'Account creation failed.'}
            />
          )}
          <ProFormText
            name="username"
            fieldProps={{
              size: 'large',
              prefix: <UserOutlined />,
            }}
            placeholder="Choose a username"
            rules={[
              {
                required: true,
                message: 'Please enter a username.',
              },
            ]}
          />
          <ProFormText.Password
            name="password"
            fieldProps={{
              size: 'large',
              prefix: <LockOutlined />,
            }}
            placeholder="Create a password"
            rules={[
              {
                required: true,
                message: 'Please enter a password.',
              },
              {
                min: 8,
                message: 'Password must be at least 8 characters.',
              },
            ]}
          />
          <div
            style={{
              marginBottom: 24,
              textAlign: 'right',
            }}
          >
            <Link to="/user/login">
              <FormattedMessage
                id="menu.login"
                defaultMessage="Back to Login"
              />
            </Link>
          </div>
        </LoginForm>
      </div>
    </div>
  );
};

export default RegisterPage;
