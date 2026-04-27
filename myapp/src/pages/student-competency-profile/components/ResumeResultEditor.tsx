import {
  BankOutlined,
  BookOutlined,
  BulbOutlined,
  CheckCircleFilled,
  CodeOutlined,
  DownOutlined,
  FileDoneOutlined,
  FolderOpenOutlined,
  IdcardOutlined,
  MessageOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  StarOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Button, Empty, Input, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useMemo, useState } from 'react';
import type {
  JobProfileDimensions,
  ProfileKey,
  RuntimeField,
  WorkspaceStage,
} from '../shared';
import {
  DEFAULT_VALUE,
  hasMeaningfulValues,
  hasProfileResult,
  PROFILE_GROUPS,
} from '../shared';

type GroupKey = (typeof PROFILE_GROUPS)[number]['key'];

const GROUP_META: Record<
  GroupKey,
  {
    description: string;
    icon: React.ReactNode;
    tone: 'blue' | 'purple' | 'cyan';
  }
> = {
  background: {
    description: '个人基本信息、教育背景、实习与项目经历',
    icon: <IdcardOutlined />,
    tone: 'blue',
  },
  core: {
    description: '关键能力、协作方式与解决问题能力',
    icon: <StarOutlined />,
    tone: 'purple',
  },
  supplementary: {
    description: '证书、荣誉、兴趣特长、自我评价等',
    icon: <FolderOpenOutlined />,
    tone: 'cyan',
  },
};

const DIMENSION_ICONS: Record<ProfileKey, React.ReactNode> = {
  professional_skills: <CodeOutlined />,
  professional_background: <BankOutlined />,
  education_requirement: <BookOutlined />,
  teamwork: <TeamOutlined />,
  stress_adaptability: <ThunderboltOutlined />,
  communication: <MessageOutlined />,
  work_experience: <FileDoneOutlined />,
  documentation_awareness: <FileDoneOutlined />,
  responsibility: <SafetyCertificateOutlined />,
  learning_ability: <BookOutlined />,
  problem_solving: <BulbOutlined />,
  other_special: <FolderOpenOutlined />,
};

const PREVIEW_COUNT = 4;

const useStyles = createStyles(({ css, token }) => ({
  panel: css`
    display: flex;
    flex-direction: column;
    min-height: 0;
  `,
  motionSafe: css`
    @media (prefers-reduced-motion: reduce) {
      &,
      * {
        animation: none !important;
        transition-duration: 1ms !important;
      }
    }
  `,
  header: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;
  `,
  title: css`
    margin: 0 !important;
    color: ${token.colorText};
    font-size: 20px !important;
    font-weight: 700 !important;
    font-family: var(--font-heading);
    letter-spacing: 0.02em;
  `,
  subtitle: css`
    display: block;
    margin-top: 6px;
    color: ${token.colorTextSecondary};
    font-size: 13px;
  `,
  modeTag: css`
    flex: 0 0 auto;
    margin-inline-end: 0 !important;
    border-radius: 999px;
    padding-inline: 10px;
  `,
  body: css`
    display: grid;
    gap: 16px;
    min-height: 0;
  `,
  summaryGrid: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;

    @media (max-width: 1080px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 640px) {
      grid-template-columns: 1fr;
    }
  `,
  summaryCard: css`
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr);
    align-items: center;
    min-height: 88px;
    gap: 12px;
    padding: 14px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: ${token.colorBgContainer};
    box-shadow: 0 10px 24px rgba(15, 35, 70, 0.04);
    transition:
      border-color 220ms ease,
      box-shadow 220ms ease,
      transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
    animation: keywordItemIn 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--keyword-stagger, 0ms);

    &:hover {
      border-color: color-mix(in srgb, ${token.colorPrimaryBorder} 74%, ${token.colorBorderSecondary} 26%);
      box-shadow: 0 16px 32px rgba(15, 35, 70, 0.075);
      transform: translateY(-2px);
    }

    &:hover .keyword-summary-icon {
      transform: scale(1.06);
    }
  `,
  summaryIcon: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 999px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-size: 17px;
    transition:
      background 220ms ease,
      color 220ms ease,
      transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
  `,
  summaryIconGreen: css`
    background: ${token.colorSuccessBg};
    color: ${token.colorSuccess};
  `,
  summaryIconPurple: css`
    background: color-mix(in srgb, ${token.purple1} 72%, #ffffff 28%);
    color: ${token.purple6};
  `,
  summaryValue: css`
    display: block;
    color: ${token.colorText};
    font-size: 22px;
    font-weight: 750;
    line-height: 1.1;
  `,
  summaryLabel: css`
    display: block;
    margin-top: 5px;
    color: ${token.colorTextSecondary};
    font-size: 12px;
  `,
  groups: css`
    display: grid;
    gap: 14px;
  `,
  groupPanel: css`
    overflow: hidden;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 14px;
    background: ${token.colorBgContainer};
    box-shadow: 0 10px 24px rgba(15, 35, 70, 0.035);
    transition:
      border-color 220ms ease,
      box-shadow 220ms ease,
      transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
    animation: keywordItemIn 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--keyword-stagger, 0ms);

    &:hover {
      border-color: color-mix(in srgb, ${token.colorPrimaryBorder} 64%, ${token.colorBorderSecondary} 36%);
      box-shadow: 0 16px 34px rgba(15, 35, 70, 0.065);
      transform: translateY(-1px);
    }
  `,
  groupPanelOpen: css`
    border-color: color-mix(in srgb, ${token.colorPrimaryBorder} 52%, ${token.colorBorderSecondary} 48%);
    box-shadow: 0 18px 38px rgba(15, 35, 70, 0.07);
  `,
  groupHeader: css`
    width: 100%;
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      background 220ms ease,
      box-shadow 220ms ease;

    &:hover {
      background: ${token.colorFillQuaternary};
    }

    &:hover .keyword-group-icon {
      transform: scale(1.06);
    }

    &:focus-visible {
      outline: 2px solid ${token.colorPrimaryBorder};
      outline-offset: -2px;
    }

    @media (max-width: 720px) {
      grid-template-columns: 42px minmax(0, 1fr) auto;
    }
  `,
  groupIcon: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 999px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-size: 18px;
    transition:
      background 220ms ease,
      color 220ms ease,
      transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
  `,
  tonePurple: css`
    background: color-mix(in srgb, ${token.purple1} 72%, #ffffff 28%);
    color: ${token.purple6};
  `,
  toneCyan: css`
    background: color-mix(in srgb, ${token.cyan1} 72%, #ffffff 28%);
    color: ${token.cyan6};
  `,
  groupTitle: css`
    display: block;
    color: ${token.colorText};
    font-size: 15px;
    font-weight: 700;
    line-height: 1.35;
  `,
  groupDescription: css`
    display: block;
    margin-top: 3px;
    overflow: hidden;
    color: ${token.colorTextSecondary};
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  groupPreview: css`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    min-width: 0;
    max-width: 300px;

    @media (max-width: 720px) {
      display: none;
    }
  `,
  groupCount: css`
    color: ${token.colorTextSecondary};
    font-size: 12px;
    white-space: nowrap;
  `,
  chevron: css`
    color: ${token.colorTextTertiary};
    font-size: 12px;
    transition:
      color 220ms ease,
      transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
  `,
  chevronOpen: css`
    transform: rotate(180deg);
    color: ${token.colorPrimary};
  `,
  groupBody: css`
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    transform: translateY(-6px);
    transition:
      grid-template-rows 360ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 260ms ease,
      transform 360ms cubic-bezier(0.22, 1, 0.36, 1);
  `,
  groupBodyOpen: css`
    grid-template-rows: 1fr;
    opacity: 1;
    transform: translateY(0);
  `,
  groupBodyInner: css`
    min-height: 0;
    overflow: hidden;
    padding: 0 16px;
    transition: padding 360ms cubic-bezier(0.22, 1, 0.36, 1);
  `,
  groupBodyInnerOpen: css`
    padding-bottom: 16px;
  `,
  dimensionGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    @media (max-width: 980px) {
      grid-template-columns: 1fr;
    }
  `,
  dimensionCard: css`
    display: grid;
    gap: 12px;
    min-width: 0;
    padding: 15px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
    transition:
      border-color 180ms ease,
      box-shadow 180ms ease,
      transform 180ms ease,
      background 180ms ease;
    animation: keywordItemIn 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--keyword-stagger, 0ms);

    &:hover {
      border-color: ${token.colorPrimaryBorder};
      box-shadow: 0 12px 24px rgba(22, 85, 204, 0.08);
      transform: translateY(-2px);
    }

    &:hover .keyword-dimension-icon {
      transform: scale(1.08);
    }
  `,
  dimensionCardExpanded: css`
    border-color: color-mix(in srgb, ${token.colorPrimaryBorder} 70%, ${token.colorSuccessBorder} 30%);
    background:
      linear-gradient(180deg, rgba(22, 119, 255, 0.035) 0%, transparent 34%),
      linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
    box-shadow: 0 14px 30px rgba(22, 85, 204, 0.09);
  `,
  dimensionMain: css`
    width: 100%;
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid ${token.colorPrimaryBorder};
      outline-offset: 4px;
      border-radius: 10px;
    }
  `,
  dimensionIcon: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 999px;
    background: ${token.colorSuccessBg};
    color: ${token.colorSuccess};
    font-size: 16px;
    transition:
      background 220ms ease,
      color 220ms ease,
      transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
  `,
  dimensionTitle: css`
    display: block;
    overflow: hidden;
    color: ${token.colorText};
    font-size: 14px;
    font-weight: 700;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  dimensionDescription: css`
    display: block;
    margin-top: 3px;
    overflow: hidden;
    color: ${token.colorTextSecondary};
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  dimensionCount: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: ${token.colorTextSecondary};
    font-size: 12px;
    white-space: nowrap;
  `,
  tagRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    max-height: 64px;
    overflow: hidden;
    transition:
      max-height 320ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 220ms ease;
  `,
  tagRowExpanded: css`
    max-height: none;
  `,
  keywordTag: css`
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    min-height: 26px;
    margin-inline-end: 0 !important;
    padding: 2px 10px;
    border-color: ${token.colorSuccessBorder};
    border-radius: 999px;
    background: ${token.colorSuccessBg};
    color: ${token.colorSuccessText};
    font-size: 12px;
    line-height: 20px;
    white-space: normal;
    transition:
      border-color 180ms ease,
      box-shadow 180ms ease,
      transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
      background 180ms ease;

    &:hover {
      border-color: color-mix(in srgb, ${token.colorSuccessBorder} 70%, ${token.colorSuccess} 30%);
      box-shadow: 0 6px 14px rgba(31, 142, 61, 0.12);
      transform: translateY(-1px);
    }
  `,
  moreTag: css`
    border-color: ${token.colorBorderSecondary};
    background: ${token.colorFillQuaternary};
    color: ${token.colorTextSecondary};
  `,
  emptyText: css`
    width: fit-content;
    padding: 5px 10px;
    border-radius: 999px;
    background: ${token.colorFillTertiary};
    color: ${token.colorTextTertiary};
    font-size: 12px;
  `,
  expandedArea: css`
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    transform: translateY(-6px) scale(0.99);
    transition:
      grid-template-rows 320ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 220ms ease,
      transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
  `,
  expandedAreaOpen: css`
    grid-template-rows: 1fr;
    opacity: 1;
    transform: translateY(0) scale(1);
  `,
  expandedAreaInner: css`
    display: grid;
    gap: 12px;
    min-height: 0;
    overflow: hidden;
    padding-top: 0;
    border-top: 1px solid transparent;
    transition:
      padding-top 320ms cubic-bezier(0.22, 1, 0.36, 1),
      border-color 220ms ease;
  `,
  expandedAreaInnerOpen: css`
    padding-top: 12px;
    border-top-color: ${token.colorBorderSecondary};
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
    transition:
      border-color 180ms ease,
      box-shadow 180ms ease;

    &:hover,
    &:focus {
      border-color: ${token.colorPrimary};
      box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.08);
    }
  `,
  addButton: css`
    border-radius: 8px;
    border-color: ${token.colorPrimaryBorder};
    color: ${token.colorPrimary};
    transition:
      border-color 180ms ease,
      box-shadow 180ms ease,
      transform 180ms cubic-bezier(0.22, 1, 0.36, 1);

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 18px rgba(22, 119, 255, 0.12);
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
    padding: 18px 0 6px;
    border: 1px dashed ${token.colorBorderSecondary};
    border-radius: 14px;
    background: ${token.colorFillQuaternary};
  `,

  '@keyframes keywordItemIn': {
    from: {
      opacity: 0,
      transform: 'translateY(12px)',
    },
    to: {
      opacity: 1,
      transform: 'translateY(0)',
    },
  },

  '@keyframes keywordRevealIn': {
    from: {
      opacity: 0,
      clipPath: 'inset(0 0 100% 0 round 12px)',
      transform: 'translateY(-6px) scale(0.985)',
    },
    to: {
      opacity: 1,
      clipPath: 'inset(0 0 0 0 round 12px)',
      transform: 'translateY(0)',
    },
  },
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

type KeywordStats = {
  filledDimensions: number;
  totalKeywords: number;
  coverageLabel: string;
  coverageDescription: string;
};

const getMeaningfulValues = (values?: string[]) =>
  (values || []).filter((value) => {
    const trimmed = value.trim();
    return trimmed && trimmed !== DEFAULT_VALUE && trimmed !== '未补充信息';
  });

const getToneClass = (
  styles: ReturnType<typeof useStyles>['styles'],
  tone: (typeof GROUP_META)[GroupKey]['tone'],
) => {
  if (tone === 'purple') return styles.tonePurple;
  if (tone === 'cyan') return styles.toneCyan;
  return undefined;
};

const stopCardEvent = (event: React.SyntheticEvent) => {
  event.stopPropagation();
};

type KeywordTagPreviewProps = {
  values: string[];
  expanded?: boolean;
  limit?: number;
  closable?: boolean;
  className?: string;
  styles: ReturnType<typeof useStyles>['styles'];
  onRemove?: (value: string) => void;
};

const KeywordTagPreview: React.FC<KeywordTagPreviewProps> = ({
  values,
  expanded = false,
  limit = PREVIEW_COUNT,
  closable = false,
  className,
  styles,
  onRemove,
}) => {
  if (!values.length) {
    return <span className={styles.emptyText}>暂无关键词</span>;
  }

  const visibleValues = expanded ? values : values.slice(0, limit);
  const hiddenCount = expanded ? 0 : Math.max(values.length - visibleValues.length, 0);

  return (
    <div
      className={`${styles.tagRow} ${expanded ? styles.tagRowExpanded : ''} ${
        className || ''
      }`}
      onClick={stopCardEvent}
    >
      {visibleValues.map((value) => (
        <Tag
          key={value}
          closable={closable}
          className={styles.keywordTag}
          onClose={(event) => {
            event.preventDefault();
            onRemove?.(value);
          }}
        >
          {value}
        </Tag>
      ))}
      {hiddenCount > 0 ? (
        <Tag className={`${styles.keywordTag} ${styles.moreTag}`}>
          + {hiddenCount}
        </Tag>
      ) : null}
    </div>
  );
};

type KeywordSummaryCardsProps = {
  stats: KeywordStats;
  styles: ReturnType<typeof useStyles>['styles'];
};

const KeywordSummaryCards: React.FC<KeywordSummaryCardsProps> = ({
  stats,
  styles,
}) => {
  const items = [
    {
      key: 'dimensions',
      icon: <IdcardOutlined />,
      value: stats.filledDimensions,
      label: '维度已整理',
      iconClassName: styles.summaryIcon,
    },
    {
      key: 'keywords',
      icon: <CheckCircleFilled />,
      value: stats.totalKeywords,
      label: '个关键词',
      iconClassName: `${styles.summaryIcon} ${styles.summaryIconGreen}`,
    },
    {
      key: 'coverage',
      icon: <StarOutlined />,
      value: stats.coverageLabel,
      label: stats.coverageDescription,
      iconClassName: `${styles.summaryIcon} ${styles.summaryIconPurple}`,
    },
    {
      key: 'status',
      icon: <FileDoneOutlined />,
      value: '已生成',
      label: '关键词提取完成',
      iconClassName: `${styles.summaryIcon} ${styles.summaryIconGreen}`,
    },
  ];

  return (
    <div className={styles.summaryGrid}>
      {items.map((item, index) => (
        <div
          key={item.label}
          data-testid={`keyword-summary-${item.key}`}
          className={styles.summaryCard}
          style={{ '--keyword-stagger': `${index * 60}ms` } as React.CSSProperties}
        >
          <span className={`${item.iconClassName} keyword-summary-icon`}>
            {item.icon}
          </span>
          <div>
            <span className={styles.summaryValue}>{item.value}</span>
            <span className={styles.summaryLabel}>{item.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

type KeywordDimensionCardProps = {
  field: RuntimeField;
  values: string[];
  mode: Extract<WorkspaceStage, 'view' | 'edit'>;
  expanded: boolean;
  stagger: number;
  tagInput?: string;
  styles: ReturnType<typeof useStyles>['styles'];
  onToggle: () => void;
  onTagInputChange: (key: ProfileKey, value: string) => void;
  onAddTag: (key: ProfileKey) => void;
  onRemoveTag: (key: ProfileKey, tagValue: string) => void;
};

const KeywordDimensionCard: React.FC<KeywordDimensionCardProps> = ({
  field,
  values,
  mode,
  expanded,
  stagger,
  tagInput,
  styles,
  onToggle,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
}) => {
  const isEditing = mode === 'edit';
  const countLabel = `${values.length} 项关键词`;

  return (
    <div
      className={`${styles.dimensionCard} ${
        expanded ? styles.dimensionCardExpanded : ''
      }`}
      style={{ '--keyword-stagger': `${stagger}ms` } as React.CSSProperties}
    >
      <button
        type="button"
        data-testid={`keyword-dimension-${field.key}`}
        className={styles.dimensionMain}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className={`${styles.dimensionIcon} keyword-dimension-icon`}>
          {DIMENSION_ICONS[field.key]}
        </span>
        <div>
          <span className={styles.dimensionTitle}>{field.title}</span>
          <span className={styles.dimensionDescription}>
            {field.description}
          </span>
        </div>
        <span className={styles.dimensionCount}>
          {countLabel}
          <DownOutlined
            className={`${styles.chevron} ${
              expanded ? styles.chevronOpen : ''
            }`}
          />
        </span>
      </button>

      <KeywordTagPreview values={values} styles={styles} />

      <div
        className={`${styles.expandedArea} ${
          expanded ? styles.expandedAreaOpen : ''
        }`}
        aria-hidden={!expanded}
        onClick={stopCardEvent}
      >
        <div
          className={`${styles.expandedAreaInner} ${
            expanded ? styles.expandedAreaInnerOpen : ''
          }`}
        >
          {expanded ? (
            <>
              <KeywordTagPreview
                values={values}
                expanded
                closable={isEditing}
                styles={styles}
                onRemove={(value) => onRemoveTag(field.key, value)}
              />

              {isEditing ? (
                <div className={styles.inputRow}>
                  <Input
                    className={styles.input}
                    placeholder="添加一条关键词"
                    value={tagInput || ''}
                    onChange={(event) =>
                      onTagInputChange(field.key, event.target.value)
                    }
                    onPressEnter={() => onAddTag(field.key)}
                  />
                  <Button
                    data-testid={`add-tag-${field.key}`}
                    icon={<PlusOutlined />}
                    className={styles.addButton}
                    onClick={() => onAddTag(field.key)}
                  >
                    添加
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

type KeywordDimensionGroupProps = {
  group: (typeof PROFILE_GROUPS)[number];
  fields: RuntimeField[];
  profile: JobProfileDimensions;
  mode: Extract<WorkspaceStage, 'view' | 'edit'>;
  expanded: boolean;
  expandedDimensions: Set<ProfileKey>;
  tagInputs: Partial<Record<ProfileKey, string>>;
  groupIndex: number;
  styles: ReturnType<typeof useStyles>['styles'];
  onToggleGroup: (key: GroupKey) => void;
  onToggleDimension: (key: ProfileKey) => void;
  onTagInputChange: (key: ProfileKey, value: string) => void;
  onAddTag: (key: ProfileKey) => void;
  onRemoveTag: (key: ProfileKey, tagValue: string) => void;
};

const KeywordDimensionGroup: React.FC<KeywordDimensionGroupProps> = ({
  group,
  fields,
  profile,
  mode,
  expanded,
  expandedDimensions,
  tagInputs,
  groupIndex,
  styles,
  onToggleGroup,
  onToggleDimension,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
}) => {
  const meta = GROUP_META[group.key];
  const groupValues = fields.flatMap((field) =>
    getMeaningfulValues(profile[field.key]),
  );
  const filledCount = fields.filter((field) =>
    hasMeaningfulValues(profile[field.key]),
  ).length;

  return (
    <section
      className={`${styles.groupPanel} ${expanded ? styles.groupPanelOpen : ''}`}
      style={
        { '--keyword-stagger': `${240 + groupIndex * 70}ms` } as React.CSSProperties
      }
    >
      <button
        type="button"
        data-testid={`keyword-group-${group.key}`}
        className={styles.groupHeader}
        aria-expanded={expanded}
        onClick={() => onToggleGroup(group.key)}
      >
        <span
          className={`${styles.groupIcon} ${getToneClass(styles, meta.tone) || ''} keyword-group-icon`}
        >
          {meta.icon}
        </span>
        <span>
          <span className={styles.groupTitle}>{group.title}</span>
          <span className={styles.groupDescription}>{meta.description}</span>
        </span>
        <span className={styles.groupPreview}>
          <KeywordTagPreview
            values={groupValues}
            limit={group.key === 'supplementary' ? 2 : 3}
            styles={styles}
          />
        </span>
        <span className={styles.groupCount}>
          {filledCount} / {fields.length} 项
          <DownOutlined
            className={`${styles.chevron} ${
              expanded ? styles.chevronOpen : ''
            }`}
          />
        </span>
      </button>

      <div
        className={`${styles.groupBody} ${expanded ? styles.groupBodyOpen : ''}`}
        aria-hidden={!expanded}
      >
        <div
          className={`${styles.groupBodyInner} ${
            expanded ? styles.groupBodyInnerOpen : ''
          }`}
        >
          <div className={styles.dimensionGrid}>
            {fields.map((field, index) => (
              <KeywordDimensionCard
                key={field.key}
                field={field}
                values={getMeaningfulValues(profile[field.key])}
                mode={mode}
                expanded={expandedDimensions.has(field.key)}
                stagger={index * 60}
                tagInput={tagInputs[field.key]}
                styles={styles}
                onToggle={() => onToggleDimension(field.key)}
                onTagInputChange={onTagInputChange}
                onAddTag={onAddTag}
                onRemoveTag={onRemoveTag}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const ResumeResultEditor = React.forwardRef<HTMLDivElement, Props>(
  (
    {
      mode,
      runtimeFields,
      currentProfile,
      editorProfile,
      tagInputs,
      onTagInputChange,
      onAddTag,
      onRemoveTag,
    },
    ref,
  ) => {
    const { styles, cx } = useStyles();
    const displayProfile =
      mode === 'edit' ? editorProfile || currentProfile : currentProfile;
    const hasResult = hasProfileResult(displayProfile);
    const [expandedGroups, setExpandedGroups] = useState<GroupKey[]>(['core']);
    const [expandedDimensions, setExpandedDimensions] = useState<
      Set<ProfileKey>
    >(new Set());

    const fieldMap = useMemo(
      () =>
        Object.fromEntries(
          runtimeFields.map((field) => [field.key, field]),
        ) as Record<ProfileKey, RuntimeField>,
      [runtimeFields],
    );

    const stats = useMemo<KeywordStats>(() => {
      const fields = runtimeFields.filter((field) => fieldMap[field.key]);
      const filledDimensions = fields.filter((field) =>
        hasMeaningfulValues(displayProfile[field.key]),
      ).length;
      const totalKeywords = fields.reduce(
        (sum, field) =>
          sum + getMeaningfulValues(displayProfile[field.key]).length,
        0,
      );
      const coverageLabel =
        filledDimensions >= 10
          ? '覆盖度高'
          : filledDimensions >= 6
            ? '覆盖良好'
            : '待补充';

      return {
        filledDimensions,
        totalKeywords,
        coverageLabel,
        coverageDescription:
          filledDimensions >= 10
            ? '简历信息覆盖全面'
            : filledDimensions >= 6
              ? '主要信息已提取'
              : '部分维度仍可补充',
      };
    }, [displayProfile, fieldMap, runtimeFields]);

    const toggleGroup = (key: GroupKey) => {
      setExpandedGroups((current) =>
        current.includes(key)
          ? current.filter((item) => item !== key)
          : [...current, key],
      );
    };

    const toggleDimension = (key: ProfileKey) => {
      setExpandedDimensions((current) => {
        const next = new Set(current);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    };

    return (
      <div
        ref={ref}
        className={cx(styles.panel, styles.motionSafe)}
        data-result-mode={mode}
      >
        <div className={styles.header}>
          <div>
            <Typography.Title level={4} className={styles.title}>
              12维解析结果
            </Typography.Title>
            <Typography.Text className={styles.subtitle}>
              已从简历中提取关键能力、背景与补充信息
            </Typography.Text>
          </div>
          <Tag
            color={mode === 'edit' ? 'processing' : 'success'}
            className={styles.modeTag}
          >
            {mode === 'edit' ? '编辑中' : '已生成'}
          </Tag>
        </div>

        <div className={styles.body}>
          {hasResult ? (
            <>
              <KeywordSummaryCards stats={stats} styles={styles} />

              <div className={styles.groups}>
                {PROFILE_GROUPS.map((group, groupIndex) => {
                  const fields = group.dimensionKeys
                    .map((key) => fieldMap[key as ProfileKey])
                    .filter(Boolean);

                  return (
                    <KeywordDimensionGroup
                      key={group.key}
                      group={group}
                      fields={fields}
                      profile={displayProfile}
                      mode={mode}
                      expanded={expandedGroups.includes(group.key)}
                      expandedDimensions={expandedDimensions}
                      tagInputs={tagInputs}
                      groupIndex={groupIndex}
                      styles={styles}
                      onToggleGroup={toggleGroup}
                      onToggleDimension={toggleDimension}
                      onTagInputChange={onTagInputChange}
                      onAddTag={onAddTag}
                      onRemoveTag={onRemoveTag}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <div className={styles.emptyHint}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无解析结果"
              />
            </div>
          )}
        </div>

        {mode === 'edit' ? (
          <div className={styles.footer}>
            <Typography.Text className={styles.footerText}>
              编辑后保存会覆盖当前解析结果
            </Typography.Text>
          </div>
        ) : null}
      </div>
    );
  },
);

ResumeResultEditor.displayName = 'ResumeResultEditor';

export default ResumeResultEditor;
