import { PlusOutlined } from '@ant-design/icons';
import { Button, Input, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { hasMeaningfulValues } from '../shared';
import type { JobProfileDimensions, ProfileKey, RuntimeField, WorkspaceStage } from '../shared';

const useStyles = createStyles(({ css, token }) => ({
  group: css`
    display: grid;
    gap: 12px;
  `,
  dimensionItem: css`
    display: grid;
    grid-template-columns: minmax(150px, 0.34fr) minmax(0, 1fr);
    gap: 16px;
    align-items: flex-start;
    padding: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: ${token.colorBgContainer};
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    :hover {
      border-color: ${token.colorPrimaryBorder};
      box-shadow: 0 8px 18px rgba(22, 85, 204, 0.07);
      transform: translateY(-1px);
    }

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
      gap: 10px;
    }
  `,
  dimensionInfo: css`
    min-width: 0;
    display: grid;
    gap: 6px;
  `,
  title: css`
    margin: 0 !important;
    color: ${token.colorText};
    font-size: 15px !important;
    font-weight: 600 !important;
  `,
  description: css`
    color: ${token.colorTextSecondary};
    font-size: 12px;
    line-height: 1.6;
  `,
  dimensionContent: css`
    min-width: 0;
    display: grid;
    gap: 12px;
  `,
  tagRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  tag: css`
    margin-inline-end: 0 !important;
    max-width: 100%;
    height: auto;
    padding: 3px 12px;
    border-color: ${token.colorSuccessBorder};
    border-radius: 6px;
    background: ${token.colorSuccessBg};
    color: ${token.colorSuccess};
    white-space: normal;
    line-height: 20px;
    transition: all 0.2s ease;
    animation: tagEnter 0.2s ease;

    :hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 14px rgba(31, 142, 61, 0.12);
    }

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
    width: fit-content;
    padding: 4px 10px;
    border-radius: 6px;
    background: ${token.colorFillTertiary};
    font-size: 13px;
    color: ${token.colorTextTertiary};
  `,
  inputRow: css`
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  `,
  input: css`
    flex: 1;
    min-width: 220px;
    border-radius: 8px;
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
    border-radius: 8px;
    border-color: ${token.colorPrimaryBorder};
    color: ${token.colorPrimary};
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
            <div className={styles.dimensionInfo}>
              <Typography.Title level={5} className={styles.title}>
                {field.title}
              </Typography.Title>
              <Typography.Text className={styles.description}>{field.description}</Typography.Text>
            </div>

            <div className={styles.dimensionContent}>
              {hasValues ? (
                <div className={styles.tagRow}>
                  {values.map((value) => (
                    <Tag
                      key={`${field.key}-${value}`}
                      closable={isEditing}
                      className={styles.tag}
                      onClose={(event) => {
                        event.preventDefault();
                        if (isEditing) {
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
              ) : null}
              {isEditing && !hasValues ? (
                <Typography.Text className={styles.hint}>保存后会同步到当前解析结果</Typography.Text>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DimensionGroupEditor;
