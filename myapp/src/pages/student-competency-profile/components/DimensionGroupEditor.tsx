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
  tag: css`
    transition: all 0.2s ease;
    animation: tagEnter 0.2s ease;

    @keyframes tagEnter {
      from {
        opacity: 0;
        transform: scale(0.8);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `,
  tagClosing: css`
    animation: tagExit 0.2s ease forwards;

    @keyframes tagExit {
      from {
        opacity: 1;
        transform: scale(1);
      }
      to {
        opacity: 0;
        transform: scale(0.8);
      }
    }
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
    transition: border-color 0.2s ease, box-shadow 0.2s ease;

    :global(.ant-input:focus),
    :global(.ant-input-focused) {
      border-color: ${token.colorPrimary};
      box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
    }

    :hover:not(:global(.ant-input-disabled)) {
      border-color: ${token.colorPrimary};
    }
  `,
  addButton: css`
    border-radius: 6px;
    transition: all 0.2s ease;

    :hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      border-color: ${token.colorPrimary};
      color: ${token.colorPrimary};
    }

    :active {
      transform: translateY(0);
    }
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
                    className={styles.tag}
                    style={{ ...buildTagStyle(), marginInlineEnd: 0, whiteSpace: 'normal', height: 'auto' }}
                    onClose={(event) => {
                      event.preventDefault();
                      if (isEditing) {
                        // Add closing animation class
                        const target = event.currentTarget as HTMLElement;
                        target.classList.add(styles.tagClosing.replace('.', ''));
                        setTimeout(() => {
                          onRemoveTag(field.key, value);
                        }, 200);
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
                  <Button data-testid={`add-tag-${field.key}`} icon={<PlusOutlined />} className={styles.addButton} onClick={() => onAddTag(field.key)}>
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
