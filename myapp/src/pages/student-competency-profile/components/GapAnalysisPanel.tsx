import { WarningOutlined } from '@ant-design/icons';
import { Collapse, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { ClaudeTag } from '@/components/ui';
import {
  claudeAlpha,
  claudeColors,
  claudeFonts,
  claudeRadius,
} from '@/styles/claude-tokens';

const { Text } = Typography;

interface GapAnalysisPanelProps {
  advices: API.StudentCompetencyActionAdviceItem[];
  priorityGaps: string[];
  activeGapKey: string | undefined;
  onGapSelect: (key: string) => void;
}

const useStyles = createStyles(({ css }) => ({
  panel: css`
    background: ${claudeColors.ivory};
    border-radius: ${claudeRadius.xl}px;
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
  emptyText: css`
    color: ${claudeColors.stoneGray};
    font-size: 14px;
    text-align: center;
    padding: 32px 0;
  `,
  adviceBody: css`
    padding: 0 16px 16px;
  `,
  sectionLabel: css`
    font-size: 12px;
    font-weight: 600;
    color: ${claudeColors.oliveGray};
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
    margin-top: 12px;

    &:first-child {
      margin-top: 0;
    }
  `,
  whyText: css`
    font-size: 13px;
    line-height: 1.6;
    color: ${claudeColors.charcoalWarm};
    margin-bottom: 8px;
  `,
  issueText: css`
    font-size: 13px;
    line-height: 1.6;
    color: ${claudeColors.stoneGray};
    margin-bottom: 8px;
  `,
  actionList: css`
    list-style: none;
    padding: 0;
    margin: 0 0 8px;
  `,
  actionItem: css`
    font-size: 13px;
    line-height: 1.6;
    color: ${claudeColors.charcoalWarm};
    padding: 2px 0;
    padding-left: 16px;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 10px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${claudeColors.terracotta};
      opacity: 0.6;
    }
  `,
  keywordRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
  `,
  adviceTitle: css`
    font-size: 14px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
  `,
  adviceStatus: css`
    font-size: 12px;
    padding: 2px 8px;
    border-radius: ${claudeRadius.sm}px;
  `,
  statusNeeds: css`
    background: ${claudeAlpha(claudeColors.terracotta, 0.1)};
    color: ${claudeColors.terracotta};
  `,
  statusWeak: css`
    background: ${claudeAlpha(claudeColors.terracotta, 0.06)};
    color: ${claudeColors.oliveGray};
  `,
}));

function AdviceDetail({
  advice,
}: {
  advice: API.StudentCompetencyActionAdviceItem;
}) {
  const { styles } = useStyles();

  return (
    <div className={styles.adviceBody}>
      {advice.why_it_matters && (
        <>
          <div className={styles.sectionLabel}>重要性</div>
          <div className={styles.whyText}>{advice.why_it_matters}</div>
        </>
      )}
      {advice.current_issue && (
        <>
          <div className={styles.sectionLabel}>当前问题</div>
          <div className={styles.issueText}>{advice.current_issue}</div>
        </>
      )}
      {advice.next_actions?.length > 0 && (
        <>
          <div className={styles.sectionLabel}>下一步行动</div>
          <ul className={styles.actionList}>
            {advice.next_actions.map((action, i) => (
              <li key={i} className={styles.actionItem}>
                {action}
              </li>
            ))}
          </ul>
        </>
      )}
      {advice.recommended_keywords?.length > 0 && (
        <>
          <div className={styles.sectionLabel}>推荐关键词</div>
          <div className={styles.keywordRow}>
            {advice.recommended_keywords.map((kw) => (
              <ClaudeTag key={kw}>{kw}</ClaudeTag>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function GapAnalysisPanel({
  advices,
  priorityGaps,
  activeGapKey,
  onGapSelect,
}: GapAnalysisPanelProps) {
  const { styles, cx } = useStyles();

  const prioritySet = new Set(priorityGaps);
  const sorted = [...advices].sort((a, b) => {
    const aPri = prioritySet.has(a.key) ? 0 : 1;
    const bPri = prioritySet.has(b.key) ? 0 : 1;
    return aPri - bPri || b.gap - a.gap;
  });

  if (!sorted.length) {
    return (
      <div className={styles.panel}>
        <Text className={styles.title}>差距分析与提升建议</Text>
        <div className={styles.emptyText}>暂无差距分析数据</div>
      </div>
    );
  }

  const collapseItems = sorted.map((advice) => {
    const isPriority = prioritySet.has(advice.key);

    return {
      key: advice.key,
      label: (
        <span className={styles.adviceTitle}>
          {isPriority && (
            <WarningOutlined
              style={{ color: claudeColors.terracotta, marginRight: 6 }}
            />
          )}
          {advice.title}
        </span>
      ),
      extra: (
        <span
          className={cx(
            styles.adviceStatus,
            advice.gap > 0 ? styles.statusNeeds : styles.statusWeak,
          )}
        >
          {advice.status_label || (advice.gap > 0 ? '需要补充' : '基本匹配')}
        </span>
      ),
      children: <AdviceDetail advice={advice} />,
    };
  });

  return (
    <div className={styles.panel} data-testid="gap-analysis-panel">
      <Text className={styles.title}>差距分析与提升建议</Text>
      <Collapse
        accordion
        activeKey={activeGapKey}
        onChange={(key) =>
          onGapSelect(Array.isArray(key) ? key[0] : (key as string))
        }
        items={collapseItems}
        expandIconPosition="end"
        style={{ background: 'transparent', border: 'none' }}
      />
    </div>
  );
}
