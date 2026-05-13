import { createStyles } from 'antd-style';
import React from 'react';
import { ClaudeTag } from '@/components/ui';
import {
  claudeAlpha,
  claudeColors,
  claudeFonts,
  claudeRadius,
} from '@/styles/claude-tokens';

interface ComparisonPanelProps {
  dimensions: API.StudentCompetencyComparisonDimensionItem[];
  userProfile?: Record<string, string[]>;
  careerTitle?: string;
}

const useStyles = createStyles(({ css }) => ({
  container: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  row: css`
    display: grid;
    grid-template-columns: 160px 1fr 1fr 80px;
    gap: 16px;
    align-items: start;
    padding: 16px;
    background: ${claudeAlpha('#ffffff', 0.4)};
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid ${claudeAlpha('#ffffff', 0.5)};
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.05), inset 0 0 0 1px ${claudeAlpha('#ffffff', 0.4)};
    border-radius: ${claudeRadius.md}px;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  `,
  dimensionTitle: css`
    font-family: ${claudeFonts.heading};
    font-size: 14px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
  `,
  columnLabel: css`
    font-size: 11px;
    color: ${claudeColors.stoneGray};
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
  `,
  tagRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    min-width: 0;
  `,
  matchBadge: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 56px;
  `,
  matchPercent: css`
    font-family: ${claudeFonts.heading};
    font-size: 18px;
    font-weight: 700;
    line-height: 1;
  `,
  matchLabel: css`
    font-size: 11px;
    color: ${claudeColors.stoneGray};
  `,
  header: css`
    margin-bottom: 16px;
  `,
  headerTitle: css`
    font-family: ${claudeFonts.heading};
    font-size: 16px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
    margin: 0 0 4px;
  `,
  headerSubtitle: css`
    font-size: 13px;
    color: ${claudeColors.stoneGray};
  `,
  empty: css`
    text-align: center;
    padding: 32px;
    color: ${claudeColors.stoneGray};
    font-size: 14px;
  `,
  matchedKeyword: css`
    border: 1px solid ${claudeColors.success};
  `,
}));

function statusColor(statusLabel: string): string {
  if (statusLabel.includes('优') || statusLabel.includes('强'))
    return claudeColors.success;
  if (statusLabel.includes('缺') || statusLabel.includes('弱'))
    return claudeColors.error;
  return claudeColors.terracotta;
}

export function ComparisonPanel({
  dimensions,
  userProfile,
  careerTitle,
}: ComparisonPanelProps) {
  const { styles } = useStyles();

  if (!dimensions.length) {
    return (
      <div className={styles.empty}>
        <div style={{ marginBottom: 8 }}>暂无对比数据</div>
        <div style={{ fontSize: 13 }}>
          完成简历解析后，系统将自动生成各维度的对比分析
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} data-testid="comparison-panel">
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          学生画像 vs {careerTitle || '目标岗位'}
        </div>
        <div className={styles.headerSubtitle}>
          以下展示你在各维度与市场需求的匹配情况
        </div>
      </div>
      {dimensions.map((dim) => {
        const userKw = userProfile?.[dim.key] || dim.user_values || [];
        const marketKw = dim.market_keywords || [];
        const matchPercent = Math.round(dim.alignment_score * 100);

        return (
          <div key={dim.key} className={styles.row}>
            <div>
              <div className={styles.dimensionTitle}>{dim.title}</div>
              <div
                style={{
                  fontSize: 12,
                  color: claudeColors.stoneGray,
                  marginTop: 4,
                }}
              >
                {dim.status_label}
              </div>
            </div>
            <div>
              <div className={styles.columnLabel}>你的关键词</div>
              <div className={styles.tagRow}>
                {userKw.length > 0 && userKw[0] !== '暂无补充信息' ? (
                  userKw.map((kw: string) => (
                    <ClaudeTag key={kw}>{kw}</ClaudeTag>
                  ))
                ) : (
                  <span style={{ fontSize: 12, color: claudeColors.stoneGray }}>
                    暂无
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className={styles.columnLabel}>市场要求</div>
              <div className={styles.tagRow}>
                {marketKw.map((kw: string) => {
                  const isMatched = dim.matched_market_keywords?.includes(kw);
                  return (
                    <ClaudeTag
                      key={kw}
                      className={isMatched ? styles.matchedKeyword : undefined}
                    >
                      {kw}
                    </ClaudeTag>
                  );
                })}
              </div>
            </div>
            <div className={styles.matchBadge}>
              <div
                className={styles.matchPercent}
                style={{ color: statusColor(dim.status_label) }}
              >
                {matchPercent}%
              </div>
              <div className={styles.matchLabel}>匹配</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
