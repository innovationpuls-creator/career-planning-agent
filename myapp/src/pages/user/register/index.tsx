import {
  ClaudeButton,
  ClaudeInput,
  ClaudePassword,
  ClaudeSelect,
} from "@/components/ui";
import { BrandPanel } from "@/components/ui/BrandPanel";
import {
  getJobTitleOptions,
  login,
  register,
  submitOnboardingProfile,
} from "@/services/ant-design-pro/api";
import {
  claudeColors,
  claudeFonts,
  claudeRadius,
} from "@/styles/claude-tokens";
import { motionTokens, prefersReducedMotion } from "@/styles/motion";
import { setAccessToken } from "@/utils/authToken";
import { InboxOutlined, LockOutlined, UserOutlined } from "@ant-design/icons";
import { Helmet, history, SelectLang, useIntl } from "@umijs/max";
import { Alert, App, Form, Upload } from "antd";
import { createStyles } from "antd-style";
import type { UploadFile } from "antd/es/upload/interface";
import { AnimatePresence, motion } from "framer-motion";
import React, { startTransition, useEffect, useState } from "react";
import Settings from "../../../../config/defaultSettings";

const SUCCESS_ANIMATION_DELAY_MS = 350;
const STEPS = ["账号", "基础信息", "简历图片"] as const;
const EDUCATION_OPTIONS = ["专科", "本科", "硕士", "博士"].map((value) => ({
  label: value,
  value,
}));
const GRADE_OPTIONS = [
  "大一",
  "大二",
  "大三",
  "大四",
  "研一",
  "研二",
  "研三",
  "已毕业",
].map((value) => ({ label: value, value }));

const useStyles = createStyles(({ css, token }) => ({
  formTitle: css`
    font-size: ${token.fontSizeHeading2}px;
    font-weight: 600;
    color: ${token.colorText};
    text-align: center;
    margin-bottom: 4px;
  `,
  formSubtitle: css`
    font-size: ${token.fontSize}px;
    color: ${token.colorTextSecondary};
    text-align: center;
    margin-bottom: 24px;
  `,
  stepIndicator: css`
    display: flex;
    justify-content: center;
    gap: 32px;
    margin-bottom: 28px;
  `,
  stepItem: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  `,
  stepNumber: css`
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: ${claudeFonts.heading};
    font-size: 16px;
    font-weight: 500;
    border: 1.5px solid ${claudeColors.borderCream};
    color: ${claudeColors.stoneGray};
    background: ${claudeColors.ivory};
    transition: all 0.3s ease;
  `,
  stepNumberActive: css`
    border-color: ${claudeColors.terracotta};
    color: ${claudeColors.terracotta};
    background: ${claudeColors.primaryBg};
  `,
  stepNumberDone: css`
    border-color: ${claudeColors.terracotta};
    color: ${token.colorWhite};
    background: ${claudeColors.terracotta};
  `,
  stepLabel: css`
    font-size: 12px;
    color: ${claudeColors.stoneGray};
    white-space: nowrap;
  `,
  stepLabelActive: css`
    color: ${claudeColors.nearBlack};
    font-weight: 500;
  `,
  strengthBar: css`
    height: 4px;
    border-radius: 2px;
    margin-top: 6px;
    margin-bottom: 4px;
    background: ${claudeColors.borderCream};
    overflow: hidden;
  `,
  strengthFill: css`
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease, background 0.3s ease;
  `,
  strengthLabel: css`
    font-size: 12px;
    color: ${claudeColors.stoneGray};
    margin-bottom: 8px;
  `,
  uploadZone: css`
    border: 2px dashed ${claudeColors.terracotta};
    border-radius: ${claudeRadius.xl}px;
    background: ${claudeColors.ivory};
    padding: 32px 24px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: ${claudeColors.primaryBg};
      border-color: ${claudeColors.primaryHover};
    }
  `,
  uploadHint: css`
    font-size: 13px;
    color: ${claudeColors.stoneGray};
    margin-top: 8px;
  `,
  footer: css`
    display: flex;
    justify-content: space-between;
    margin-top: 24px;
  `,
  linkRow: css`
    margin-top: 16px;
    text-align: center;
    font-size: ${token.fontSize}px;
    color: ${token.colorTextSecondary};
    cursor: pointer;
    transition: color 0.15s ease;

    &:hover {
      color: ${token.colorPrimary};
    }
  `,
}));

type RegisterStepValues = API.RegisterParams &
  API.OnboardingProfileRequest & {
    image_files?: UploadFile[];
  };

const Lang = () => (
  <div style={{ position: "fixed", top: 16, right: 16 }}>
    <SelectLang />
  </div>
);

function getPasswordStrength(password: string): {
  level: number;
  label: string;
  color: string;
} {
  if (!password)
    return { level: 0, label: "", color: claudeColors.borderCream };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 25, label: "弱", color: claudeColors.error };
  if (score === 2)
    return { level: 50, label: "一般", color: claudeColors.warning };
  if (score === 3)
    return { level: 75, label: "强", color: claudeColors.success };
  return { level: 100, label: "非常强", color: claudeColors.success };
}

const RegisterPage: React.FC = () => {
  const { styles, cx } = useStyles();
  const { message } = App.useApp();
  const intl = useIntl();
  const [form] = Form.useForm<RegisterStepValues>();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [registerState, setRegisterState] = useState<API.RegisterResult>({});
  const [jobTitleOptions, setJobTitleOptions] = useState<API.JobTitleOption[]>(
    []
  );
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [accountCreated, setAccountCreated] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");

  useEffect(() => {
    void getJobTitleOptions({ skipErrorHandler: true })
      .then((response) => {
        setJobTitleOptions(response.data || []);
      })
      .catch(() => {
        setJobTitleOptions([]);
      });
  }, []);

  const validateCurrentStep = async () => {
    if (currentStep === 0) {
      await form.validateFields(["username", "password"]);
      return;
    }
    if (currentStep === 1) {
      await form.validateFields([
        "full_name",
        "school",
        "major",
        "education_level",
        "grade",
        "target_job_title",
      ]);
    }
  };

  const handleSubmit = async () => {
    await form.validateFields([
      "username",
      "password",
      "full_name",
      "school",
      "major",
      "education_level",
      "grade",
      "target_job_title",
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
          type: "account",
        });
        if (loginResult.status !== "ok" || !loginResult.token) {
          throw new Error(loginResult.errorMessage || "登录失败");
        }
        setAccessToken(loginResult.token);
        setAccountCreated(true);
      }

      const formData = new FormData();
      formData.append("full_name", values.full_name ?? "");
      formData.append("school", values.school ?? "");
      formData.append("major", values.major ?? "");
      formData.append("education_level", values.education_level ?? "");
      formData.append("grade", values.grade ?? "");
      formData.append("target_job_title", values.target_job_title ?? "");
      fileList.forEach((file) => {
        if (file.originFileObj) {
          formData.append("image_files", file.originFileObj);
        }
      });
      await submitOnboardingProfile(formData);
      message.success("注册成功");
      await new Promise((resolve) => {
        window.setTimeout(resolve, SUCCESS_ANIMATION_DELAY_MS);
      });
      startTransition(() => {
        history.replace("/home-v2");
      });
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { detail?: string } };
        info?: { errorMessage?: string };
        message?: string;
      };
      const backendMessage =
        err?.response?.data?.detail ||
        err?.info?.errorMessage ||
        err?.message ||
        "提交失败";
      setRegisterState({
        status: "error",
        errorMessage: backendMessage,
        success: false,
      });
      message.error(backendMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const strength = getPasswordStrength(passwordValue);
  const reducedMotion = prefersReducedMotion();

  const stepVariants = reducedMotion
    ? { initial: {}, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -24 },
      };

  return (
    <>
      <Helmet>
        <title>
          {intl.formatMessage({
            id: "pages.login.registerAccount",
            defaultMessage: "创建账户",
          })}
          {Settings.title && ` - ${Settings.title}`}
        </title>
      </Helmet>
      <Lang />
      <div className="auth-root" data-testid="register-page-shell">
        <BrandPanel />

        {/* Right panel: form area */}
        <div className="auth-right">
          <div className="auth-card" data-testid="register-form-card">
            <div className={styles.formTitle}>创建账户</div>
            <div className={styles.formSubtitle}>
              完成注册，开始职业规划之旅
            </div>

            {/* Custom step indicator */}
            <div className={styles.stepIndicator} data-testid="step-indicator">
              {STEPS.map((label, index) => (
                <div key={label} className={styles.stepItem}>
                  <div
                    className={cx(
                      styles.stepNumber,
                      index === currentStep && styles.stepNumberActive,
                      index < currentStep && styles.stepNumberDone
                    )}
                  >
                    {index < currentStep ? "✓" : index + 1}
                  </div>
                  <span
                    className={cx(
                      styles.stepLabel,
                      index === currentStep && styles.stepLabelActive
                    )}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {registerState.status === "error" && (
              <Alert
                style={{ marginBottom: 16 }}
                type="error"
                showIcon
                message={registerState.errorMessage || "提交失败"}
              />
            )}

            <Form form={form} layout="vertical">
              <AnimatePresence mode="wait" initial={false}>
                {currentStep === 0 && (
                  <motion.div
                    key="step-0"
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{
                      duration: motionTokens.duration.normal,
                      ease: motionTokens.easing.enter,
                    }}
                  >
                    <Form.Item
                      label="用户名"
                      name="username"
                      rules={[{ required: true, message: "请输入用户名" }]}
                    >
                      <ClaudeInput
                        prefix={<UserOutlined />}
                        placeholder="请输入用户名"
                        autoComplete="username"
                      />
                    </Form.Item>
                    <Form.Item
                      label="密码"
                      name="password"
                      rules={[
                        { required: true, message: "请输入密码" },
                        { min: 8, message: "密码至少 8 位" },
                      ]}
                    >
                      <ClaudePassword
                        prefix={<LockOutlined />}
                        placeholder="请输入密码"
                        autoComplete="new-password"
                        onChange={(e) => setPasswordValue(e.target.value)}
                      />
                    </Form.Item>
                    {passwordValue && (
                      <div data-testid="password-strength">
                        <div className={styles.strengthBar}>
                          <div
                            className={styles.strengthFill}
                            style={{
                              width: `${strength.level}%`,
                              background: strength.color,
                            }}
                          />
                        </div>
                        <div className={styles.strengthLabel}>
                          密码强度：{strength.label}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {currentStep === 1 && (
                  <motion.div
                    key="step-1"
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{
                      duration: motionTokens.duration.normal,
                      ease: motionTokens.easing.enter,
                    }}
                  >
                    <Form.Item
                      label="姓名"
                      name="full_name"
                      rules={[{ required: true, message: "请输入姓名" }]}
                    >
                      <ClaudeInput placeholder="请输入姓名" />
                    </Form.Item>
                    <Form.Item
                      label="学校"
                      name="school"
                      rules={[{ required: true, message: "请输入学校" }]}
                    >
                      <ClaudeInput placeholder="请输入学校" />
                    </Form.Item>
                    <Form.Item
                      label="专业"
                      name="major"
                      rules={[{ required: true, message: "请输入专业" }]}
                    >
                      <ClaudeInput placeholder="请输入专业" />
                    </Form.Item>
                    <Form.Item
                      label="学历"
                      name="education_level"
                      rules={[{ required: true, message: "请选择学历" }]}
                    >
                      <ClaudeSelect
                        id="education_level"
                        placeholder="请选择学历"
                        options={EDUCATION_OPTIONS}
                        style={{ width: "100%" }}
                      />
                    </Form.Item>
                    <Form.Item
                      label="年级"
                      name="grade"
                      rules={[{ required: true, message: "请选择年级" }]}
                    >
                      <ClaudeSelect
                        id="grade"
                        placeholder="请选择年级"
                        options={GRADE_OPTIONS}
                        style={{ width: "100%" }}
                      />
                    </Form.Item>
                    <Form.Item
                      label="目标岗位名称"
                      name="target_job_title"
                      rules={[
                        { required: true, message: "请选择目标岗位名称" },
                      ]}
                    >
                      <ClaudeSelect
                        id="target_job_title"
                        placeholder="请选择目标岗位名称"
                        options={jobTitleOptions}
                        style={{ width: "100%" }}
                      />
                    </Form.Item>
                  </motion.div>
                )}

                {currentStep === 2 && (
                  <motion.div
                    key="step-2"
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{
                      duration: motionTokens.duration.normal,
                      ease: motionTokens.easing.enter,
                    }}
                  >
                    <Form.Item label="简历图片">
                      <div data-testid="resume-upload-zone">
                        <Upload.Dragger
                          className={styles.uploadZone}
                          accept=".jpg,.jpeg,.png,.webp"
                          beforeUpload={() => false}
                          fileList={fileList}
                          onChange={({ fileList: nextFileList }) => {
                            setFileList(nextFileList);
                          }}
                          showUploadList={{ showPreviewIcon: false }}
                          multiple
                        >
                          <InboxOutlined style={{ fontSize: 32 }} />
                          <div className={styles.uploadHint}>
                            将简历图片拖到这里，或点击选择图片
                          </div>
                        </Upload.Dragger>
                        <div className={styles.uploadHint}>
                          支持 JPG / JPEG / PNG / WEBP 格式
                        </div>
                      </div>
                    </Form.Item>
                  </motion.div>
                )}
              </AnimatePresence>
            </Form>

            <div className={styles.footer}>
              <ClaudeButton
                variant="ghost"
                disabled={currentStep === 0}
                onClick={() => setCurrentStep((step) => step - 1)}
              >
                上一步
              </ClaudeButton>
              {currentStep < 2 ? (
                <ClaudeButton
                  variant="terracotta"
                  onClick={async () => {
                    await validateCurrentStep();
                    setCurrentStep((step) => step + 1);
                  }}
                >
                  下一步
                </ClaudeButton>
              ) : (
                <ClaudeButton
                  variant="terracotta"
                  loading={submitting}
                  onClick={() => void handleSubmit()}
                >
                  完成注册
                </ClaudeButton>
              )}
            </div>

            <div
              className={styles.linkRow}
              onClick={() => {
                startTransition(() => {
                  history.push("/user/login");
                });
              }}
            >
              返回登录
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RegisterPage;
