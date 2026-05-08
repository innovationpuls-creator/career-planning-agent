import {
  ClaudeButton,
  ClaudeCard,
  ClaudeInput,
  ClaudeSelect,
} from "@/components/ui";
import {
  getJobTitleOptions,
  submitOnboardingProfile,
} from "@/services/ant-design-pro/api";
import { claudeColors, claudeFonts } from "@/styles/claude-tokens";
import {
  EditOutlined,
  PaperClipOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { Form, Modal, Upload, message } from "antd";
import { createStyles } from "antd-style";
import type { UploadFile } from "antd/es/upload/interface";
import { useCallback, useState } from "react";

interface Attachment {
  original_name: string;
  stored_name: string;
  content_type: string;
  size_bytes: number;
  file_path: string;
}

interface ProfileCardProps {
  profile: API.StudentProfilePayload;
  attachments: Attachment[];
  onSaved: () => void;
  saveProfile?: (formData: FormData) => Promise<void>;
  loadJobOptions?: () => Promise<Array<{ label: string; value: string }>>;
}

const useStyles = createStyles(({ css }) => ({
  shell: css`
    margin-bottom: 26px;
  `,
  inner: css`
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 8px 0;
  `,
  avatar: css`
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: ${claudeColors.primaryBg};
    color: ${claudeColors.terracotta};
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: ${claudeFonts.heading};
    font-size: 22px;
    font-weight: 700;
    flex-shrink: 0;
  `,
  fields: css`
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 20px;
    min-width: 0;
  `,
  field: css`
    font-size: 14px;
    color: ${claudeColors.oliveGray};
    line-height: 1.6;

    strong {
      color: ${claudeColors.nearBlack};
      font-weight: 600;
    }
  `,
  attachment: css`
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: ${claudeColors.stoneGray};
    margin-top: 6px;
  `,
  editRow: css`
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  `,
}));

const EDUCATION_OPTIONS = ["专科", "本科", "硕士", "博士"].map((v) => ({
  label: v,
  value: v,
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
].map((v) => ({ label: v, value: v }));

export function ProfileCard({
  profile,
  attachments,
  onSaved,
  saveProfile,
  loadJobOptions,
}: ProfileCardProps) {
  const { styles } = useStyles();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [jobOptions, setJobOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const initial = profile.full_name?.charAt(0) ?? "?";

  const handleOpen = useCallback(async () => {
    form.setFieldsValue(profile);
    setFileList([]);
    setOpen(true);
    const loader =
      loadJobOptions ?? (() => getJobTitleOptions().then((r) => r?.data ?? []));
    try {
      const opts = await loader();
      setJobOptions(opts);
    } catch {
      /* options are best-effort */
    }
  }, [form, profile, loadJobOptions]);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const fd = new FormData();
      Object.entries(values).forEach(([k, v]) => {
        if (v !== undefined && v !== null) fd.append(k, v as string);
      });
      fileList.forEach((file) => {
        if (file.originFileObj) {
          fd.append("image_files", file.originFileObj);
        }
      });
      const saver = saveProfile ?? submitOnboardingProfile;
      await saver(fd);
      message.success("资料已更新");
      setOpen(false);
      onSaved();
    } catch {
      /* validation or network failure */
    } finally {
      setSaving(false);
    }
  }, [fileList, form, onSaved, saveProfile]);

  return (
    <ClaudeCard elevation="elevated" className={styles.shell}>
      <div className={styles.inner}>
        <div className={styles.avatar}>{initial}</div>
        <div className={styles.fields}>
          <span className={styles.field}>
            姓名：<strong>{profile.full_name}</strong>
          </span>
          <span className={styles.field}>
            学校：<strong>{profile.school}</strong>
          </span>
          <span className={styles.field}>
            专业：<strong>{profile.major}</strong>
          </span>
          <span className={styles.field}>
            学历：<strong>{profile.education_level}</strong>
          </span>
          <span className={styles.field}>
            年级：<strong>{profile.grade}</strong>
          </span>
          <span className={styles.field}>
            目标岗位：<strong>{profile.target_job_title}</strong>
          </span>
        </div>
      </div>

      <div className={styles.attachment}>
        <PaperClipOutlined />
        {attachments.length > 0 ? `${attachments.length} 份附件` : "暂无附件"}
      </div>

      <div className={styles.editRow}>
        <ClaudeButton
          variant="ghost"
          icon={<EditOutlined />}
          onClick={handleOpen}
        >
          编辑资料
        </ClaudeButton>
      </div>

      <Modal
        title="编辑个人资料"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={profile}>
          <Form.Item name="full_name" label="姓名" rules={[{ required: true }]}>
            <ClaudeInput placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="school" label="学校" rules={[{ required: true }]}>
            <ClaudeInput placeholder="请输入学校" />
          </Form.Item>
          <Form.Item name="major" label="专业" rules={[{ required: true }]}>
            <ClaudeInput placeholder="请输入专业" />
          </Form.Item>
          <Form.Item name="education_level" label="学历">
            <ClaudeSelect options={EDUCATION_OPTIONS} placeholder="选择学历" />
          </Form.Item>
          <Form.Item name="grade" label="年级">
            <ClaudeSelect options={GRADE_OPTIONS} placeholder="选择年级" />
          </Form.Item>
          <Form.Item name="target_job_title" label="目标岗位">
            <ClaudeSelect
              showSearch
              options={jobOptions}
              placeholder="搜索或选择目标岗位"
            />
          </Form.Item>
          <Form.Item label="简历图片">
            <Upload
              accept=".jpg,.jpeg,.png,.webp"
              beforeUpload={() => false}
              fileList={fileList}
              onChange={({ fileList: nextFileList }) => {
                setFileList(nextFileList);
              }}
              showUploadList={{ showPreviewIcon: false }}
            >
              <ClaudeButton variant="warm-sand" icon={<UploadOutlined />}>
                选择新的简历图片
              </ClaudeButton>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </ClaudeCard>
  );
}
