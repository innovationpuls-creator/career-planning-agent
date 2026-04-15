import { Collapse, Empty, Typography } from 'antd';
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
    padding-bottom: 6px;
  `,
  title: css`
    margin: 0;
    font-size: 17px;
  `,
  body: css`
    min-height: 0;
  `,
  collapse: css`
    background: transparent;

    :global(.ant-collapse-item) {
      border-bottom: 1px solid ${token.colorBorderSecondary};
    }

    :global(.ant-collapse-header) {
      padding-inline: 0 !important;
      padding-block: 10px !important;
    }

    :global(.ant-collapse-content-box) {
      padding-inline: 0 !important;
      padding-top: 0 !important;
      padding-bottom: 4px !important;
    }
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

    return (
      <div ref={ref} className={styles.panel} data-result-mode={mode}>
        <div className={styles.header}>
          <Typography.Title level={4} className={styles.title}>
            12维解析结果
          </Typography.Title>
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
                label: group.title,
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
