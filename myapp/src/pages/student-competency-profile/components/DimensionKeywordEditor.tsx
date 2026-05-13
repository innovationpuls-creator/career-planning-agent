import { PlusOutlined } from '@ant-design/icons';
import { Collapse, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useCallback } from 'react';
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
  PROFILE_GROUPS,
  type ProfileKey,
} from '../shared';

const { Text } = Typography;

interface DimensionKeywordEditorProps {
  dimensions: JobProfileDimensions;
  tagInputs: Partial<Record<ProfileKey, string>>;
  isEditing: boolean;
  onUpdateTagInput: (key: ProfileKey, value: string) => void;
  onAddTag: (key: ProfileKey) => void;
  onRemoveTag: (key: ProfileKey, value: string) => void;
}

const FIELD_MAP = new Map(
  PROFILE_FIELDS.map(([key, title, desc]) => [key, { title, desc }]),
);

const useStyles = createStyles(({ css }) => ({
  container: css`
    background: ${claudeAlpha('#ffffff', 0.4)};
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid ${claudeAlpha('#ffffff', 0.5)};
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.05), inset 0 0 0 1px ${claudeAlpha('#ffffff', 0.4)};
    border-radius: ${claudeRadius.md}px;
    padding: 24px;
    width: 100%;
  `,
  title: css`
    font-family: ${claudeFonts.heading};
    font-size: 18px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
    margin: 0 0 16px;
  `,
  collapse: css`
    background: transparent !important;
    border: none !important;

    :global(.ant-collapse-item) {
      border: 1px solid ${claudeAlpha('#ffffff', 0.6)} !important;
      border-radius: ${claudeRadius.md}px !important;
      margin-bottom: 8px !important;
      overflow: hidden;
      background: ${claudeAlpha('#ffffff', 0.4)};
    }

    :global(.ant-collapse-header) {
      font-family: ${claudeFonts.heading} !important;
      font-weight: 600 !important;
      color: ${claudeColors.nearBlack} !important;
      padding: 14px 16px !important;
    }

    :global(.ant-collapse-content) {
      border-top: 1px solid ${claudeAlpha('#ffffff', 0.6)} !important;
      background: transparent;
    }

    :global(.ant-collapse-content-box) {
      padding: 12px 16px !important;
    }
  `,
  groupMeta: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  groupCount: css`
    font-size: 12px;
    color: ${claudeColors.stoneGray};
    font-weight: 400;
  `,
  dimensionSection: css`
    margin-bottom: 12px;

    &:last-child {
      margin-bottom: 0;
    }
  `,
  dimensionLabel: css`
    font-size: 13px;
    font-weight: 600;
    color: ${claudeColors.charcoalWarm};
    margin-bottom: 6px;
  `,
  dimensionDesc: css`
    font-size: 11px;
    color: ${claudeColors.stoneGray};
    margin-bottom: 8px;
  `,
  tagRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 28px;
    align-items: center;
    min-width: 0;
  `,
  emptyText: css`
    font-size: 13px;
    color: ${claudeColors.stoneGray};
    font-style: italic;
  `,
  addRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
    align-items: center;
  `,
}));

function DimensionTags({
  profileKey,
  values,
  tagInput,
  isEditing,
  onUpdateTagInput,
  onAddTag,
  onRemoveTag,
}: {
  profileKey: ProfileKey;
  values: string[];
  tagInput: string;
  isEditing: boolean;
  onUpdateTagInput: (key: ProfileKey, value: string) => void;
  onAddTag: (key: ProfileKey) => void;
  onRemoveTag: (key: ProfileKey, value: string) => void;
}) {
  const { styles } = useStyles();
  const meta = FIELD_MAP.get(profileKey);
  const hasValues = hasMeaningfulValues(values);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onAddTag(profileKey);
      }
    },
    [profileKey, onAddTag],
  );

  return (
    <div className={styles.dimensionSection}>
      <div className={styles.dimensionLabel}>{meta?.title || profileKey}</div>
      <div className={styles.dimensionDesc}>{meta?.desc}</div>
      <div className={styles.tagRow}>
        {!hasValues && <span className={styles.emptyText}>暂无关键词</span>}
        {values.map((value) =>
          value === DEFAULT_VALUE ? null : (
            <ClaudeTag
              key={value}
              closable={isEditing}
              onClose={() => onRemoveTag(profileKey, value)}
            >
              {value}
            </ClaudeTag>
          ),
        )}
      </div>
      {isEditing && (
        <div className={styles.addRow}>
          <ClaudeInput
            size="small"
            placeholder="输入关键词..."
            value={tagInput}
            onChange={(e) =>
              onUpdateTagInput(profileKey, (e.target as HTMLInputElement).value)
            }
            onKeyDown={handleKeyDown}
            style={{ maxWidth: 200 }}
          />
          <button
            type="button"
            onClick={() => onAddTag(profileKey)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 12px',
              borderRadius: 32,
              background: claudeColors.primaryBg,
              color: claudeColors.terracotta,
              fontSize: 13,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <PlusOutlined style={{ fontSize: 10 }} /> 添加
          </button>
        </div>
      )}
    </div>
  );
}

export function DimensionKeywordEditor({
  dimensions,
  tagInputs,
  isEditing,
  onUpdateTagInput,
  onAddTag,
  onRemoveTag,
}: DimensionKeywordEditorProps) {
  const { styles } = useStyles();

  const collapseItems = PROFILE_GROUPS.map((group) => {
    const activeCount = group.dimensionKeys.filter((key) =>
      hasMeaningfulValues(dimensions[key as ProfileKey]),
    ).length;

    return {
      key: group.key,
      label: (
        <span className={styles.groupMeta}>
          {group.title}
          <span className={styles.groupCount}>
            {activeCount}/{group.dimensionKeys.length} 已填充
          </span>
        </span>
      ),
      children: (
        <div>
          {group.dimensionKeys.map((key) => (
            <DimensionTags
              key={key}
              profileKey={key as ProfileKey}
              values={dimensions[key as ProfileKey] || []}
              tagInput={tagInputs[key as ProfileKey] || ''}
              isEditing={isEditing}
              onUpdateTagInput={onUpdateTagInput}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
            />
          ))}
        </div>
      ),
    };
  });

  return (
    <div className={styles.container} data-testid="dimension-keyword-editor">
      <Text className={styles.title}>12 维度关键词</Text>
      <Collapse
        className={styles.collapse}
        defaultActiveKey={PROFILE_GROUPS.map((g) => g.key)}
        items={collapseItems}
      />
    </div>
  );
}
