import { PlusOutlined } from '@ant-design/icons';
import { Modal } from 'antd';
import { createStyles } from 'antd-style';
import React, { useCallback, useState } from 'react';
import { ClaudeInput, ClaudeTag } from '@/components/ui';
import {
  claudeAlpha,
  claudeColors,
  claudeFonts,
  claudeRadius,
} from '@/styles/claude-tokens';
import {
  DEFAULT_VALUE,
  hasMeaningfulValues,
  type JobProfileDimensions,
  PROFILE_FIELDS,
  type ProfileKey,
} from '../shared';

interface DimensionKeywordEditorProps {
  dimensions: JobProfileDimensions;
  tagInputs: Partial<Record<ProfileKey, string>>;
  isEditing: boolean;
  onUpdateTagInput: (key: ProfileKey, value: string) => void;
  onAddTag: (key: ProfileKey) => void;
  onRemoveTag: (key: ProfileKey, value: string) => void;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onSaveEdit?: () => void;
}

const FIELD_MAP = new Map(
  PROFILE_FIELDS.map(([key, title, desc]) => [key, { title, desc }]),
);

const useStyles = createStyles(({ css }) => ({
  panel: css`
    background: ${claudeAlpha('#ffffff', 0.4)};
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid ${claudeAlpha('#ffffff', 0.5)};
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.05), inset 0 0 0 1px ${claudeAlpha('#ffffff', 0.4)};
    border-radius: ${claudeRadius.md}px;
    padding: 24px;
  `,
  header: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    color: ${claudeColors.warmSilver};
    font-size: 14px;
  `,
  keywordGrid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
    @media (max-width: 1024px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    @media (max-width: 640px) {
      grid-template-columns: 1fr;
    }
  `,
  dimensionCard: css`
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(0, 0, 0, 0.05);
    border-radius: 12px;
    padding: 20px;
    transition: all 0.2s ease;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
    display: flex;
    flex-direction: column;
    &:hover {
      transform: translateY(-2px);
      border-color: ${claudeAlpha(claudeColors.terracotta, 0.3)};
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
    }
  `,
  dimHeader: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
  `,
  dimTitle: css`
    font-family: ${claudeFonts.heading};
    font-size: 17px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
    letter-spacing: 0.02em;
  `,
  tagsWrapper: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  tag: css`
    background: ${claudeColors.ivory};
    border: 1px solid ${claudeColors.borderWarm};
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 13px;
    color: ${claudeColors.oliveGray};
    transition: all 0.2s ease;
  `,
  emptyText: css`
    font-size: 13px;
    color: ${claudeColors.stoneGray};
    font-style: normal;
    background: rgba(0, 0, 0, 0.02);
    border: 1px dashed ${claudeColors.borderCream};
    padding: 4px 10px;
    border-radius: 6px;
    width: 100%;
    text-align: center;
  `,
  modalTitle: css`
    font-size: 20px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
    margin: 0 0 24px 0;
  `,
  addRow: css`
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  `,
  saveBtn: css`
    width: 100%;
    background: ${claudeColors.nearBlack};
    color: #fff;
    border: none;
    padding: 14px;
    border-radius: 10px;
    font-size: 16px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.2s;
    margin-top: 24px;
    &:hover {
      background: #3f3f46;
    }
  `,
  editableTags: css`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 24px;
  `,
}));

export function DimensionKeywordEditor({
  dimensions,
  tagInputs,
  isEditing,
  onUpdateTagInput,
  onAddTag,
  onRemoveTag,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
}: DimensionKeywordEditorProps) {
  const { styles } = useStyles();
  const [activeKey, setActiveKey] = useState<ProfileKey | null>(null);

  const handleCardClick = (key: ProfileKey) => {
    onStartEdit?.();
    setActiveKey(key);
  };

  const handleModalClose = () => {
    onCancelEdit?.();
    setActiveKey(null);
  };

  const handleModalSave = () => {
    onSaveEdit?.();
    setActiveKey(null);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && activeKey) {
        e.preventDefault();
        onAddTag(activeKey);
      }
    },
    [activeKey, onAddTag]
  );

  return (
    <div data-testid="dimension-keyword-editor" className={styles.panel}>
      <div className={styles.header}>
        <span>点击卡片以集中编辑该维度的关键字标签</span>
      </div>
      <div className={styles.keywordGrid}>
        {PROFILE_FIELDS.map(([key]) => {
          const profileKey = key as ProfileKey;
          const meta = FIELD_MAP.get(profileKey);
          const values = dimensions[profileKey] || [];
          const displayValues = values.filter((v) => v !== DEFAULT_VALUE);
          const hasValues = displayValues.length > 0;

          return (
            <div
              key={profileKey}
              className={styles.dimensionCard}
              onClick={() => handleCardClick(profileKey)}
            >
              <div className={styles.dimHeader}>
                <span className={styles.dimTitle}>
                  {meta?.title || profileKey}
                </span>
              </div>
              <div className={styles.tagsWrapper}>
                {!hasValues && (
                  <span className={styles.emptyText}>暂无关键词</span>
                )}
                {displayValues.map((value) => (
                  <span key={value} className={styles.tag}>
                    {value}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={!!activeKey}
        onCancel={handleModalClose}
        footer={null}
        width={500}
        centered
        destroyOnClose
        styles={{
          content: {
            borderRadius: 20,
            padding: 32,
            background: claudeColors.ivory,
          }
        }}
        closeIcon={
          <span style={{ fontSize: 24, color: claudeColors.warmSilver }}>×</span>
        }
      >
        {activeKey && (
          <div>
            <h2 className={styles.modalTitle}>
              {FIELD_MAP.get(activeKey)?.title || activeKey}
            </h2>
            <div className={styles.editableTags}>
              {(dimensions[activeKey] || [])
                .filter((v) => v !== DEFAULT_VALUE)
                .map((value) => (
                  <ClaudeTag
                    key={value}
                    closable
                    onClose={() => onRemoveTag(activeKey, value)}
                  >
                    {value}
                  </ClaudeTag>
                ))}
            </div>
            <div className={styles.addRow}>
              <ClaudeInput
                placeholder="输入关键词并回车..."
                value={tagInputs[activeKey] || ''}
                onChange={(e) =>
                  onUpdateTagInput(activeKey, (e.target as HTMLInputElement).value)
                }
                onKeyDown={handleKeyDown}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => onAddTag(activeKey)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '0 16px',
                  borderRadius: 8,
                  background: claudeColors.primaryBg,
                  color: claudeColors.terracotta,
                  fontSize: 14,
                  fontWeight: 500,
                  border: `1px solid ${claudeAlpha(claudeColors.terracotta, 0.2)}`,
                  cursor: 'pointer',
                }}
              >
                <PlusOutlined style={{ fontSize: 12 }} /> 添加
              </button>
            </div>
            <button
              className={styles.saveBtn}
              onClick={handleModalSave}
              type="button"
            >
              保存修改
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
