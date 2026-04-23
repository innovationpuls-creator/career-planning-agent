import { Collapse, Empty, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useMemo } from 'react';
import DimensionGroupEditor from './DimensionGroupEditor';
import { PROFILE_GROUPS, hasMeaningfulValues, hasProfileResult } from '../shared';
import type { JobProfileDimensions, ProfileKey, RuntimeField, WorkspaceStage } from '../shared';

const useStyles = createStyles(({ css, token }) => ({
  panel: css`
    display: flex;
    flex-direction: column;
    min-height: 0;
  `,
  header: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    margin-bottom: 16px;
  `,
  title: css`
    margin: 0 !important;
    color: ${token.colorText};
    font-size: 17px !important;
    font-weight: 600 !important;
  `,
  subtitle: css`
    display: block;
    margin-top: 6px;
    color: ${token.colorTextSecondary};
    font-size: 13px;
  `,
  modeTag: css`
    margin-inline-end: 0 !important;
    border-radius: 6px;
  `,
  body: css`
    min-height: 0;
  `,
  collapse: css`
    display: grid;
    gap: 12px;
    background: transparent;

    :global(.ant-collapse-item) {
      overflow: hidden;
      border: 1px solid ${token.colorBorderSecondary} !important;
      border-radius: 12px !important;
      background: ${token.colorBgContainer};
      box-shadow: 0 8px 18px rgba(15, 35, 70, 0.03);
    }

    :global(.ant-collapse-header) {
      align-items: center !important;
      padding: 16px 18px !important;
      border-radius: 12px !important;
      transition: background-color 0.2s ease;
    }

    :global(.ant-collapse-header:hover) {
      background: ${token.colorPrimaryBg};
    }

    :global(.ant-collapse-content-box) {
      padding: 0 18px 18px !important;
    }

    :global(.ant-collapse-content) {
      border-top: 1px solid ${token.colorBorderSecondary} !important;
    }
  `,
  groupLabel: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
    width: 100%;
  `,
  groupName: css`
    color: ${token.colorText};
    font-weight: 600;
  `,
  groupMeta: css`
    flex: 0 0 auto;
    color: ${token.colorTextSecondary};
    font-size: 13px;
  `,
  footer: css`
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid ${token.colorBorderSecondary};
  `,
  footerText: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  emptyHint: css`
    padding: 8px 0 0;
  `,
}));

type Props = {
  mode: Extract<WorkspaceStage, 'view' | 'edit'>;
  runtimeFields: RuntimeField[];
  currentProfile: JobProfileDimensions;
  editorProfile?: JobProfileDimensions;
  tagInputs: Partial<Record<ProfileKey, string>>;
  onTagInputChange: (key: ProfileKey, value: string) => void;
  onAddTag: (key: ProfileKey) => void;
  onRemoveTag: (key: ProfileKey, tagValue: string) => void;
};

const isMissingDimension = (profile: JobProfileDimensions | undefined, key: ProfileKey) => {
  const values = profile?.[key];
  return !hasMeaningfulValues(values);
};

const ResumeResultEditor = React.forwardRef<HTMLDivElement, Props>(
  ({ mode, runtimeFields, currentProfile, editorProfile, tagInputs, onTagInputChange, onAddTag, onRemoveTag }, ref) => {
    const { styles } = useStyles();
    const displayProfile = mode === 'edit' ? editorProfile || currentProfile : currentProfile;
    const hasResult = hasProfileResult(displayProfile);

    const fieldMap = useMemo(
      () =>
        Object.fromEntries(runtimeFields.map((field) => [field.key, field])) as Record<
          ProfileKey,
          RuntimeField
        >,
      [runtimeFields],
    );

    const activeKey = useMemo(() => {
      const coreGroup = PROFILE_GROUPS.find((group) => group.key === 'core');
      if (coreGroup) return coreGroup.key;

      const fallbackGroup =
        PROFILE_GROUPS.find((group) =>
          group.dimensionKeys.some((key) => isMissingDimension(displayProfile, key as ProfileKey)),
        ) || PROFILE_GROUPS[0];

      return fallbackGroup.key;
    }, [displayProfile]);

    const getGroupFilledCount = (dimensionKeys: readonly string[]) =>
      dimensionKeys.filter((key) => hasMeaningfulValues(displayProfile[key as ProfileKey])).length;

    return (
      <div ref={ref} className={styles.panel} data-result-mode={mode}>
        <div className={styles.header}>
          <div>
            <Typography.Title level={4} className={styles.title}>
              12维解析结果
            </Typography.Title>
            <Typography.Text className={styles.subtitle}>
              按能力分组查看已提取关键词，编辑后保存会同步到当前解析结果
            </Typography.Text>
          </div>
          <Tag color={mode === 'edit' ? 'processing' : 'success'} className={styles.modeTag}>
            {mode === 'edit' ? '编辑中' : '已生成'}
          </Tag>
        </div>

        <div className={styles.body}>
          {hasResult ? (
            <Collapse
              accordion
              className={styles.collapse}
              bordered={false}
              defaultActiveKey={activeKey}
              items={PROFILE_GROUPS.map((group) => ({
                key: group.key,
                label: (
                  <div className={styles.groupLabel}>
                    <span className={styles.groupName}>{group.title}</span>
                    <span className={styles.groupMeta}>
                      {getGroupFilledCount(group.dimensionKeys)} / {group.dimensionKeys.length} 项已提取
                    </span>
                  </div>
                ),
                children: (
                  <DimensionGroupEditor
                    fields={group.dimensionKeys.map((key) => fieldMap[key as ProfileKey]).filter(Boolean)}
                    profile={displayProfile}
                    tagInputs={tagInputs}
                    mode={mode}
                    onTagInputChange={onTagInputChange}
                    onAddTag={onAddTag}
                    onRemoveTag={onRemoveTag}
                  />
                ),
              }))}
            />
          ) : (
            <div className={styles.emptyHint}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无解析结果" />
            </div>
          )}
        </div>

        {mode === 'edit' ? (
          <div className={styles.footer}>
            <Typography.Text className={styles.footerText}>编辑后保存会覆盖当前解析结果</Typography.Text>
          </div>
        ) : null}
      </div>
    );
  },
);

ResumeResultEditor.displayName = 'ResumeResultEditor';

export default ResumeResultEditor;
