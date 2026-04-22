import { PageContainer } from '@ant-design/pro-components';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Steps,
  Typography,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useState } from 'react';
import {
  getOrderedTiers,
  getStageKeyByLevel,
  getTierSalarySummary,
  STAGE_TO_LEVEL,
} from '@/components/VerticalTierComparison';
import {
  getHomeV2,
  getJobTitleOptions,
  submitOnboardingProfile,
} from '@/services/ant-design-pro/api';

const STAGE_ORDER: Array<'low' | 'middle' | 'high'> = ['low', 'middle', 'high'];

const useStyles = createStyles(({ css, token }) => ({
  pageContainer: css`
    :global(.ant-pro-page-container-children-container) {
      padding-inline: 0;
      padding-block: 0;
    }
  `,
  shell: css`
    min-height: calc(100vh - 112px);
    padding: 24px;
    background: ${token.colorBgLayout};
  `,
  content: css`
    max-width: 960px;
    margin: 0 auto;
    padding: 8px 0 40px;
  `,
  header: css`
    margin-bottom: 8px;
  `,
  section: css`
    padding: 24px 0;
  `,
  sectionHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  `,
  sectionTitle: css`
    margin: 0;
  `,
  sectionDivider: css`
    margin: 0;
    border-block-start: 1px solid ${token.colorBorder};
  `,
  loading: css`
    display: flex;
    justify-content: center;
    padding-top: 48px;
  `,
  summaryBlock: css`
    display: grid;
    gap: 8px;
  `,
  summaryLabel: css`
    color: ${token.colorTextSecondary};
    font-size: 12px;
    line-height: 1.5;
  `,
  summaryValue: css`
    margin: 0 0 20px;
  `,
  metrics: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;

    @media (max-width: 720px) {
      grid-template-columns: 1fr;
      gap: 16px;
    }
  `,
  metricBlock: css`
    display: grid;
    gap: 6px;
    min-width: 0;
  `,
  metricLabel: css`
    color: ${token.colorTextSecondary};
    font-size: 12px;
    line-height: 1.5;
  `,
  metricValue: css`
    font-size: 22px;
    font-weight: 600;
    line-height: 1.3;
  `,
  currentStageValue: css`
    color: ${token.colorPrimary};
  `,
  pathWrap: css`
    display: grid;
    gap: 16px;
    max-width: 560px;
  `,
  profileWrap: css`
    max-width: 720px;
  `,
  profileDescriptions: css`
    :global(.ant-descriptions-view) {
      max-width: 720px;
    }

    :global(.ant-descriptions-item-label) {
      color: ${token.colorTextSecondary};
      font-size: 12px;
      width: 88px;
    }

    :global(.ant-descriptions-item-content) {
      font-weight: 600;
    }
  `,
  attachmentList: css`
    margin-top: 8px;
    color: ${token.colorTextSecondary};
  `,
}));

type ProfileFormValues = API.OnboardingProfileRequest & {
  image_files?: UploadFile[];
};

const PROFILE_FIELDS: Array<{
  key: keyof API.StudentProfilePayload;
  label: string;
}> = [
  { key: 'school', label: '学校' },
  { key: 'grade', label: '年级' },
  { key: 'major', label: '专业' },
  { key: 'education_level', label: '学历' },
  { key: 'target_job_title', label: '目标岗位' },
];

const HomeV2Page: React.FC = () => {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [form] = Form.useForm<ProfileFormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<API.HomeV2Payload>();
  const [jobTitleOptions, setJobTitleOptions] = useState<API.JobTitleOption[]>(
    [],
  );
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);

  const loadHome = async () => {
    const response = await getHomeV2();
    setPayload(response.data);
  };

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getHomeV2(),
      getJobTitleOptions({ skipErrorHandler: true }).catch(() => ({
        data: [],
      })),
    ])
      .then(([homeResponse, jobTitleResponse]) => {
        if (!mounted) {
          return;
        }
        setPayload(homeResponse.data);
        setJobTitleOptions(jobTitleResponse.data || []);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (profileDrawerOpen) {
      form.setFieldsValue((payload?.profile || {}) as ProfileFormValues);
    }
  }, [form, payload?.profile, profileDrawerOpen]);

  const orderedTiers = useMemo(
    () =>
      getOrderedTiers(
        payload?.vertical_profile?.tiered_comparison?.tiers || [],
      ),
    [payload?.vertical_profile?.tiered_comparison?.tiers],
  );

  const currentStageKey = payload?.current_stage || 'low';
  const currentStageLabel = STAGE_TO_LEVEL[currentStageKey] || '低级';
  const currentTier =
    orderedTiers.find(
      (tier) => getStageKeyByLevel(tier.level) === currentStageKey,
    ) || orderedTiers[0];
  const salaryReference = currentTier ? getTierSalarySummary(currentTier) : '-';
  const matchedCount = currentTier?.items.length || 0;

  const pathItems = useMemo(
    () =>
      STAGE_ORDER.map((stageKey) => {
        const tier = orderedTiers.find(
          (item) => getStageKeyByLevel(item.level) === stageKey,
        );
        return {
          title: STAGE_TO_LEVEL[stageKey],
          description: `薪资范围：${tier ? getTierSalarySummary(tier) : '-'}`,
        };
      }),
    [orderedTiers],
  );

  const handleProfileSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const body = new FormData();
      body.append('full_name', values.full_name);
      body.append('school', values.school);
      body.append('major', values.major);
      body.append('education_level', values.education_level);
      body.append('grade', values.grade);
      body.append('target_job_title', values.target_job_title);
      fileList.forEach((file) => {
        if (file.originFileObj) {
          body.append('image_files', file.originFileObj);
        }
      });
      await submitOnboardingProfile(body);
      await loadHome();
      setProfileDrawerOpen(false);
      setFileList([]);
      message.success('资料已更新');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer
      className={styles.pageContainer}
      title={false}
      breadcrumbRender={false}
    >
      <div className={styles.shell}>
        <div className={styles.content}>
          <div className={styles.header}>
            <Typography.Title level={2} style={{ marginBottom: 0 }}>
              职业规划
            </Typography.Title>
          </div>

          {loading ? (
            <div className={styles.loading}>
              <Spin />
            </div>
          ) : (
            <>
              <Divider className={styles.sectionDivider} />
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <Typography.Title level={4} className={styles.sectionTitle}>
                    当前状态
                  </Typography.Title>
                  <Button
                    type="primary"
                    onClick={() => setProfileDrawerOpen(true)}
                  >
                    完善个人信息
                  </Button>
                </div>
                <div className={styles.summaryBlock}>
                  <div className={styles.summaryLabel}>目标岗位</div>
                  <Typography.Title level={3} className={styles.summaryValue}>
                    {payload?.profile?.target_job_title || '-'}
                  </Typography.Title>
                </div>
                <div className={styles.metrics}>
                  <div className={styles.metricBlock}>
                    <div className={styles.metricLabel}>当前阶段</div>
                    <div
                      className={`${styles.metricValue} ${styles.currentStageValue}`}
                    >
                      {currentStageLabel}
                    </div>
                  </div>
                  <div className={styles.metricBlock}>
                    <div className={styles.metricLabel}>薪资范围</div>
                    <div className={styles.metricValue}>{salaryReference}</div>
                  </div>
                  <div className={styles.metricBlock}>
                    <div className={styles.metricLabel}>已匹配岗位数</div>
                    <div className={styles.metricValue}>{matchedCount} 个</div>
                  </div>
                </div>
              </section>

              <Divider className={styles.sectionDivider} />
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <Typography.Title level={4} className={styles.sectionTitle}>
                    成长路径
                  </Typography.Title>
                </div>
                <div className={styles.pathWrap}>
                  <Steps
                    direction="vertical"
                    current={STAGE_ORDER.indexOf(currentStageKey)}
                    items={pathItems}
                  />
                  <Alert
                    type="info"
                    showIcon
                    message={`当前处于${currentStageLabel}阶段`}
                  />
                </div>
              </section>

              <Divider className={styles.sectionDivider} />
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <Typography.Title level={4} className={styles.sectionTitle}>
                    我的资料
                  </Typography.Title>
                  <Button
                    type="link"
                    onClick={() => setProfileDrawerOpen(true)}
                  >
                    编辑资料
                  </Button>
                </div>
                <div className={styles.profileWrap}>
                  <Descriptions
                    column={{ xs: 1, md: 2 }}
                    size="small"
                    className={styles.profileDescriptions}
                  >
                    {PROFILE_FIELDS.map((field) => (
                      <Descriptions.Item key={field.key} label={field.label}>
                        {payload?.profile?.[field.key] || '-'}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <Drawer
        title="完善个人信息"
        open={profileDrawerOpen}
        onClose={() => {
          setProfileDrawerOpen(false);
          setFileList([]);
          form.setFieldsValue((payload?.profile || {}) as ProfileFormValues);
        }}
        width={520}
        extra={
          <Space>
            <Button onClick={() => setProfileDrawerOpen(false)}>取消</Button>
            <Button
              type="primary"
              loading={saving}
              onClick={() => void handleProfileSave()}
            >
              保存
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="姓名"
            name="full_name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="学校"
            name="school"
            rules={[{ required: true, message: '请输入学校' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="专业"
            name="major"
            rules={[{ required: true, message: '请输入专业' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="学历"
            name="education_level"
            rules={[{ required: true, message: '请输入学历' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="年级"
            name="grade"
            rules={[{ required: true, message: '请输入年级' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="目标岗位"
            name="target_job_title"
            rules={[{ required: true, message: '请选择目标岗位' }]}
          >
            <Select options={jobTitleOptions} placeholder="请选择目标岗位" />
          </Form.Item>
          <Form.Item label="简历图片">
            <Upload
              accept=".jpg,.jpeg,.png,.webp"
              beforeUpload={() => false}
              fileList={fileList}
              onChange={({ fileList: nextFileList }) =>
                setFileList(nextFileList)
              }
            >
              <Button>上传图片</Button>
            </Upload>
            {payload?.attachments?.length ? (
              <div className={styles.attachmentList}>
                当前附件：
                {payload.attachments
                  .map((item) => item.original_name)
                  .join('，')}
              </div>
            ) : null}
          </Form.Item>
        </Form>
      </Drawer>
    </PageContainer>
  );
};

export default HomeV2Page;
