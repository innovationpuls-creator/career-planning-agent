import { PlusOutlined } from '@ant-design/icons';
import { Button, Input, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { hasMeaningfulValues } from '../shared';
import type { JobProfileDimensions, ProfileKey, RuntimeField, WorkspaceStage } from '../shared';

const useStyles = createStyles(({ css, token }) => ({
  group: css`
    display: grid;
    gap: 0;
  `,
  dimensionItem: css`
    display: grid;
    gap: 8px;
    padding: 12px 0;
    border-bottom: 1px solid ${token.colorBorderSecondary};

    &:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
  `,
  title: css`
    margin: 0;
    font-size: 14px;
  `,
  tagRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  `,
  emptyText: css`
    font-size: 13px;
    color: ${token.colorTextTertiary};
  `,
  inputRow: css`
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  `,
  input: css`
    flex: 1;
    min-width: 220px;
  `,
  hint: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
}));

type Props = {
  fields: RuntimeField[];
  profile: JobProfileDimensions;
  tagInputs: Partial<Record<ProfileKey, string>>;
  mode: Extract<WorkspaceStage, 'view' | 'edit'>;
  onTagInputChange: (key: ProfileKey, value: string) => void;
  onAddTag: (key: ProfileKey) => void;
  onRemoveTag: (key: ProfileKey, tagValue: string) => void;
};

const buildTagStyle = () => ({
  background: '#e6f4ff',
  borderColor: '#91caff',
  color: '#1677ff',
});

const DimensionGroupEditor: React.FC<Props> = ({
  fields,
  profile,
  tagInputs,
  mode,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
}) => {
  const { styles } = useStyles();
  const isEditing = mode === 'edit';

  return (
    <div className={styles.group}>
      {fields.map((field) => {
        const values = profile[field.key] || [];
        const hasValues = hasMeaningfulValues(values);

        return (
          <div key={field.key} className={styles.dimensionItem}>
            <Typography.Title level={5} className={styles.title}>
              {field.title}
            </Typography.Title>

            {hasValues ? (
              <div className={styles.tagRow}>
                {values.map((value) => (
                  <Tag
                    key={`${field.key}-${value}`}
                    closable={isEditing}
                    style={{ ...buildTagStyle(), marginInlineEnd: 0, whiteSpace: 'normal', height: 'auto' }}
                    onClose={(event) => {
                      event.preventDefault();
                      if (isEditing) {
                        onRemoveTag(field.key, value);
                      }
                    }}
                  >
                    {value}
                  </Tag>
                ))}
              </div>
            ) : (
              <Typography.Text className={styles.emptyText}>暂无补充信息</Typography.Text>
            )}

            {isEditing ? (
              <>
                <div className={styles.inputRow}>
                  <Input
                    className={styles.input}
                    placeholder="添加一条补充信息"
                    value={tagInputs[field.key] || ''}
                    onChange={(event) => onTagInputChange(field.key, event.target.value)}
                    onPressEnter={() => onAddTag(field.key)}
                  />
                  <Button data-testid={`add-tag-${field.key}`} icon={<PlusOutlined />} onClick={() => onAddTag(field.key)}>
                    添加
                  </Button>
                </div>
                {!hasValues ? <Typography.Text className={styles.hint}>保存后会同步到当前解析结果</Typography.Text> : null}
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export default DimensionGroupEditor;
