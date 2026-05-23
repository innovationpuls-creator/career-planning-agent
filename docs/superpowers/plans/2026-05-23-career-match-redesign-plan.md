# Career-Match 前端重写实施计划

> **For agentic workers:** 使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐步实施。步骤使用 checkbox (`- [ ]`) 语法跟踪进度。

**目标:** 将 `/career-match` 重写为独立组件树页面 —— 左侧分数导航条 + 右侧概览卡 + Tab 内容区（雷达图/差距分析/画廊）+ 右上角 AI 教练按钮 + 底部数据来源。

**架构:** 自建 `useCareerMatchData` hook 统一管理 API 调用和状态，通过 props 分发给 6 个独立子组件。所有组件使用 `createStyles` + token 化样式，不依赖 student-competency-profile。

**技术栈:** React + TypeScript + antd-style + Ant Design + @ant-design/charts (Radar)

**变更范围:**
- 创建: `myapp/src/pages/career-match/components/` (6 组件)
- 创建: `myapp/src/pages/career-match/hooks/` (1 hook)
- 重写: `myapp/src/pages/career-match/index.tsx`
- 重写: `myapp/src/pages/career-match/pageStyles.ts`
- 不改: 后端 API、路由配置、typings.d.ts

---

### 任务 1: 创建 `useCareerMatchData` hook

**文件:**
- 创建: `myapp/src/pages/career-match/hooks/useCareerMatchData.ts`

- [ ] **步骤 1: 编写 hook 实现**

```ts
import { useCallback, useEffect, useState } from 'react';
import {
  createCareerDevelopmentFavorite,
  deleteCareerDevelopmentFavorite,
  getCareerDevelopmentFavorites,
  getCareerDevelopmentMatchInit,
  getStudentCompetencyLatestAnalysis,
} from '@/services/ant-design-pro/api';
import { goToSnailLearningPath } from '@/pages/career-development-report/learning-path/learningPathUtils';

export type MatchTabKey = 'comparison' | 'advice' | 'company';

interface UseCareerMatchDataResult {
  matchData: API.CareerDevelopmentMatchInitPayload | undefined;
  competencyProfile: Record<string, string[]> | undefined;
  favorites: API.CareerDevelopmentFavoritePayload[];
  activeRecommendationId: string | undefined;
  activeRecommendation: API.CareerDevelopmentMatchReport | undefined;
  activeRecommendationFavorite: API.CareerDevelopmentFavoritePayload | undefined;
  activeTab: MatchTabKey;
  activeGapKey: string | undefined;
  favoriteSubmitting: boolean;
  loading: boolean;
  error: string | undefined;
  sourceUpdatedAt: string | undefined;
  setActiveRecommendationId: (id: string) => void;
  setActiveTab: (tab: MatchTabKey) => void;
  setActiveGapKey: (key: string | undefined) => void;
  toggleFavorite: () => Promise<void>;
  generatePlan: () => void;
}

function extractRequestError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return '未知错误';
}

const buildFavoriteTargetKey = (report: API.CareerDevelopmentMatchReport) =>
  `${report.canonical_job_title}::${report.industry || ''}`;

export function useCareerMatchData(): UseCareerMatchDataResult {
  const [matchData, setMatchData] = useState<API.CareerDevelopmentMatchInitPayload>();
  const [competencyProfile, setCompetencyProfile] = useState<Record<string, string[]>>();
  const [favorites, setFavorites] = useState<API.CareerDevelopmentFavoritePayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [activeRecommendationId, setActiveRecommendationId] = useState<string>();
  const [activeTab, setActiveTab] = useState<MatchTabKey>('comparison');
  const [activeGapKey, setActiveGapKey] = useState<string>();
  const [favoriteSubmitting, setFavoriteSubmitting] = useState(false);
  const [sourceUpdatedAt, setSourceUpdatedAt] = useState<string>();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(undefined);
      try {
        const [initRes, favRes, compRes] = await Promise.all([
          getCareerDevelopmentMatchInit({ skipErrorHandler: true }),
          getCareerDevelopmentFavorites({ skipErrorHandler: true }),
          getStudentCompetencyLatestAnalysis({ skipErrorHandler: true }),
        ]);
        if (!mounted) return;
        setMatchData(initRes.data);
        setFavorites(favRes.data || []);
        setCompetencyProfile(compRes.data.profile);
        setSourceUpdatedAt(initRes.data.source?.updated_at);
        setActiveRecommendationId((current) => {
          const recs = initRes.data.recommendations || [];
          if (recs.some((r) => r.report_id === current)) return current;
          return initRes.data.default_report_id || recs[0]?.report_id;
        });
      } catch (err: unknown) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : extractRequestError(err));
        setMatchData(undefined);
        setActiveRecommendationId(undefined);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const recommendations = matchData?.recommendations || [];
  const activeRecommendation =
    recommendations.find((r) => r.report_id === activeRecommendationId) ||
    recommendations[0];
  const activeRecommendationFavorite = activeRecommendation
    ? favorites.find(
        (f) =>
          f.report_id === activeRecommendation.report_id ||
          f.target_key === buildFavoriteTargetKey(activeRecommendation),
      )
    : undefined;

  useEffect(() => {
    if (!activeRecommendation) return;
    const nextKey =
      activeRecommendation.priority_gap_dimensions?.[0] ||
      activeRecommendation.action_advices?.[0]?.key ||
      activeRecommendation.comparison_dimensions?.[0]?.key;
    if (!nextKey) return;
    const valid = new Set([
      ...(activeRecommendation.priority_gap_dimensions || []),
      ...(activeRecommendation.action_advices || []).map((a) => a.key),
      ...(activeRecommendation.comparison_dimensions || []).map((d) => d.key),
    ]);
    setActiveGapKey((prev) => (prev && valid.has(prev) ? prev : nextKey));
  }, [activeRecommendation?.report_id]);

  const toggleFavorite = useCallback(async () => {
    if (!activeRecommendation) return;
    setFavoriteSubmitting(true);
    try {
      if (activeRecommendationFavorite) {
        await deleteCareerDevelopmentFavorite(
          activeRecommendationFavorite.favorite_id,
          { skipErrorHandler: true },
        );
        setFavorites((prev) =>
          prev.filter((f) => f.favorite_id !== activeRecommendationFavorite.favorite_id),
        );
      } else {
        const res = await createCareerDevelopmentFavorite(
          { source_kind: 'recommendation', report: activeRecommendation },
          { skipErrorHandler: true },
        );
        setFavorites((prev) => [
          ...prev.filter((f) => f.favorite_id !== res.data.favorite_id),
          res.data,
        ]);
      }
    } catch (err) {
      throw new Error(extractRequestError(err));
    } finally {
      setFavoriteSubmitting(false);
    }
  }, [activeRecommendation, activeRecommendationFavorite]);

  const generatePlan = useCallback(() => {
    if (!activeRecommendationFavorite) return;
    goToSnailLearningPath(activeRecommendationFavorite.favorite_id);
  }, [activeRecommendationFavorite]);

  return {
    matchData,
    competencyProfile,
    favorites,
    activeRecommendationId,
    activeRecommendation,
    activeRecommendationFavorite,
    activeTab,
    activeGapKey,
    favoriteSubmitting,
    loading,
    error,
    sourceUpdatedAt,
    setActiveRecommendationId,
    setActiveTab,
    setActiveGapKey,
    toggleFavorite,
    generatePlan,
  };
}
```

- [ ] **步骤 2: 验证 TypeScript 编译**

```bash
cd myapp && npx tsc --noEmit --pretty false src/pages/career-match/hooks/useCareerMatchData.ts 2>&1 | head -20
```

预期: 无类型错误

- [ ] **步骤 3: 提交**

```bash
git add myapp/src/pages/career-match/hooks/useCareerMatchData.ts
git commit -m "feat: add useCareerMatchData hook for career-match page"
```

---

### 任务 2: 创建 `ScoreNav` 组件

**文件:**
- 创建: `myapp/src/pages/career-match/components/ScoreNav.tsx`

- [ ] **步骤 1: 编写组件**

```tsx
import { createStyles } from 'antd-style';
import React from 'react';
import { claudeColors, claudeAlpha } from '@/styles/claude-tokens';

interface ScoreNavProps {
  recommendations: API.CareerDevelopmentMatchReport[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
}

const useStyles = createStyles(({ css }) => ({
  nav: css`
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 4px;
    @media (max-width: 800px) {
      flex-direction: row;
      flex-wrap: wrap;
    }
  `,
  badge: css`
    width: 52px;
    height: 52px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "STSongti SC", "SimSun", "Songti SC", "Noto Serif SC", Georgia, serif;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.25s ease;
    border: 1px solid transparent;
  `,
  badgeActive: css`
    background: ${claudeColors.terracotta};
    color: #fff;
    box-shadow: 0 4px 14px rgba(201, 100, 66, 0.3);
  `,
  badgeInactive: css`
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-color: rgba(255, 255, 255, 0.5);
    color: ${claudeColors.oliveGray};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    &:hover {
      border-color: ${claudeAlpha(claudeColors.terracotta, 0.18)};
      color: ${claudeColors.terracotta};
      box-shadow: 0 2px 12px rgba(201, 100, 66, 0.08);
    }
  `,
  more: css`
    width: 52px;
    height: 52px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    color: ${claudeColors.stoneGray};
  `,
}));

export function ScoreNav({ recommendations, activeId, onSelect }: ScoreNavProps) {
  const { styles, cx } = useStyles();
  const visible = recommendations.slice(0, 5);
  const remaining = Math.max(0, recommendations.length - 5);

  return (
    <div className={styles.nav} data-testid="score-nav">
      {visible.map((r) => {
        const isActive = r.report_id === (activeId || recommendations[0]?.report_id);
        return (
          <div
            key={r.report_id}
            className={cx(styles.badge, isActive ? styles.badgeActive : styles.badgeInactive)}
            onClick={() => onSelect(r.report_id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect(r.report_id);
            }}
          >
            {Math.round(r.overall_match)}
          </div>
        );
      })}
      {remaining > 0 && <div className={styles.more}>+{remaining}</div>}
    </div>
  );
}
```

- [ ] **步骤 2: 验证 TypeScript 编译**

```bash
cd myapp && npx tsc --noEmit --pretty false src/pages/career-match/components/ScoreNav.tsx 2>&1 | head -20
```

- [ ] **步骤 3: 提交**

```bash
git add myapp/src/pages/career-match/components/ScoreNav.tsx
git commit -m "feat: add ScoreNav component for career-match"
```

---

### 任务 3: 创建 `MatchOverviewCard` 组件

**文件:**
- 创建: `myapp/src/pages/career-match/components/MatchOverviewCard.tsx`

- [ ] **步骤 1: 编写组件**

```tsx
import { StarFilled, StarOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { ClaudeButton } from '@/components/ui';
import { claudeColors, claudeFonts } from '@/styles/claude-tokens';

interface MatchOverviewCardProps {
  report: API.CareerDevelopmentMatchReport;
  isFavorited: boolean;
  favoriteSubmitting: boolean;
  onToggleFavorite: () => void;
  onGeneratePlan: () => void;
}

const useStyles = createStyles(({ css }) => ({
  card: css`
    background: rgba(255, 255, 255, 0.45);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 16px;
    padding: 24px 28px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.04), inset 0 0 0 1px rgba(255,255,255,0.5);
    display: flex;
    align-items: center;
    gap: 24px;
    @media (max-width: 800px) {
      flex-direction: column;
      text-align: center;
    }
  `,
  ringWrap: css`flex-shrink: 0; position: relative; width: 88px; height: 88px;`,
  ringSvg: css`transform: rotate(-90deg);`,
  ringValue: css`
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  `,
  ringNum: css`
    font-family: ${claudeFonts.heading}; font-size: 26px; font-weight: 600;
    color: ${claudeColors.terracotta}; line-height: 1;
  `,
  ringUnit: css`font-size: 11px; color: ${claudeColors.stoneGray}; margin-top: 1px;`,
  info: css`flex: 1; min-width: 0;`,
  job: css`
    font-family: ${claudeFonts.heading}; font-size: 20px; font-weight: 600;
    color: ${claudeColors.nearBlack}; margin-bottom: 4px;
  `,
  meta: css`
    font-size: 13px; color: ${claudeColors.oliveGray};
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  `,
  metaDot: css`
    width: 5px; height: 5px; border-radius: 50%;
    background: ${claudeColors.terracotta}; opacity: 0.5; display: inline-block;
  `,
  actions: css`display: flex; gap: 8px; flex-shrink: 0;`,
}));

export function MatchOverviewCard({
  report, isFavorited, favoriteSubmitting, onToggleFavorite, onGeneratePlan,
}: MatchOverviewCardProps) {
  const { styles } = useStyles();
  const percent = Math.round(report.overall_match);
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (circumference * percent) / 100;

  return (
    <div className={styles.card} data-testid="match-overview-card">
      <div className={styles.ringWrap}>
        <svg className={styles.ringSvg} width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r="38" fill="none" stroke="#f0eee6" strokeWidth="8" />
          <circle cx="44" cy="44" r="38" fill="none" stroke={claudeColors.terracotta}
            strokeWidth="8" strokeDasharray={circumference}
            strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div className={styles.ringValue}>
          <span className={styles.ringNum}>{percent}</span>
          <span className={styles.ringUnit}>%</span>
        </div>
      </div>
      <div className={styles.info}>
        <div className={styles.job}>{report.canonical_job_title}</div>
        <div className={styles.meta}>
          {report.industry && (
            <span><span className={styles.metaDot}></span> {report.industry}</span>
          )}
          <span>基于 {report.comparison_dimensions?.length || 12} 维度分析</span>
        </div>
      </div>
      <div className={styles.actions}>
        <ClaudeButton
          variant={isFavorited ? 'terracotta' : 'ghost'}
          icon={isFavorited ? <StarFilled /> : <StarOutlined />}
          loading={favoriteSubmitting}
          onClick={onToggleFavorite}
        >
          {isFavorited ? '已收藏' : '收藏'}
        </ClaudeButton>
        <Tooltip title={!isFavorited ? '请先收藏该职业推荐' : undefined}>
          <ClaudeButton
            variant="terracotta"
            disabled={!isFavorited}
            onClick={onGeneratePlan}
          >
            生成学习计划
          </ClaudeButton>
        </Tooltip>
      </div>
    </div>
  );
}
```

- [ ] **步骤 2: 验证 TypeScript 编译**

```bash
cd myapp && npx tsc --noEmit --pretty false src/pages/career-match/components/MatchOverviewCard.tsx 2>&1 | head -20
```

- [ ] **步骤 3: 提交**

```bash
git add myapp/src/pages/career-match/components/MatchOverviewCard.tsx
git commit -m "feat: add MatchOverviewCard component for career-match"
```

---

### 任务 4: 创建 `RadarComparisonPanel` 组件

**文件:**
- 创建: `myapp/src/pages/career-match/components/RadarComparisonPanel.tsx`

- [ ] **步骤 1: 编写组件**

```tsx
import { Empty, Spin } from 'antd';
import { createStyles } from 'antd-style';
import React, { useMemo } from 'react';
import { Radar } from '@ant-design/charts';
import { claudeColors, claudeFonts, claudeRadius } from '@/styles/claude-tokens';
import { studentCompetencyRadarColors } from '@/styles/chart-tokens';

interface RadarComparisonPanelProps {
  chartSeries: API.StudentCompetencyChartSeriesItem[];
  dimensions: API.StudentCompetencyComparisonDimensionItem[];
  loading?: boolean;
}

const DIMENSION_SHORT: Record<string, string> = {
  professional_skills: '专业技能',
  professional_background: '专业背景',
  education_requirement: '教育要求',
  teamwork: '团队协作',
  stress_adaptability: '抗压适应',
  problem_solving: '解决问题',
  communication: '沟通表达',
  work_experience: '工作经验',
  documentation_awareness: '文档意识',
  responsibility: '责任心',
  learning_ability: '学习能力',
  other_special: '其他特长',
};

const useStyles = createStyles(({ css }) => ({
  panel: css`
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 8px;
    padding: 24px;
  `,
  title: css`
    font-family: ${claudeFonts.heading};
    font-size: 18px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
    margin-bottom: 16px;
  `,
  chartWrap: css`width: 100%; height: 320px; position: relative;`,
  legend: css`
    display: flex; flex-wrap: wrap; gap: 20px; justify-content: center;
    margin-top: 8px; font-size: 12px; color: ${claudeColors.stoneGray};
  `,
  legendItem: css`display: flex; align-items: center; gap: 6px;`,
  legendDot: css`
    width: 8px; height: 8px; border-radius: 50%;
    border: 1.5px solid ${studentCompetencyRadarColors.marketImportance};
    background: ${studentCompetencyRadarColors.marketImportance};
  `,
  scoreGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid ${claudeColors.borderCream};
  `,
  scoreItem: css`
    display: flex; flex-direction: column; gap: 6px;
    padding: 12px; background: rgba(255,255,255,0.4);
    border-radius: ${claudeRadius.md}px;
    transition: background 0.2s ease;
    &:hover { background: ${claudeColors.borderCream}; }
  `,
  scoreItemHeader: css`display: flex; align-items: center; justify-content: space-between;`,
  scoreLabel: css`font-size: 13px; font-weight: 500; color: ${claudeColors.nearBlack};`,
  scoreValue: css`font-family: ${claudeFonts.heading}; font-size: 14px; font-weight: 700;`,
  scoreBar: css`height: 4px; border-radius: 2px; background: ${claudeColors.borderCream}; overflow: hidden;`,
  scoreBarFill: css`height: 100%; border-radius: 2px; transition: width 0.6s ease;`,
  emptyWrap: css`display: flex; align-items: center; justify-content: center; min-height: 280px;`,
}));

export function RadarComparisonPanel({ chartSeries, dimensions, loading }: RadarComparisonPanelProps) {
  const { styles } = useStyles();

  const chartData = useMemo(
    () =>
      chartSeries.flatMap((item) => [
        {
          dimension: DIMENSION_SHORT[item.key] || item.title,
          key: item.key,
          value: item.market_importance,
          category: '市场重要度',
        },
        {
          dimension: DIMENSION_SHORT[item.key] || item.title,
          key: item.key,
          value: item.user_readiness,
          category: '个人准备度',
        },
      ]),
    [chartSeries],
  );

  const config = useMemo(() => ({
    data: chartData,
    xField: 'dimension',
    yField: 'value',
    colorField: 'category',
    scale: {
      y: { domain: [0, 100] },
      color: {
        range: [
          studentCompetencyRadarColors.marketImportance,
          studentCompetencyRadarColors.userReadiness,
        ],
      },
    },
    style: { lineWidth: 2 },
    area: { style: { fillOpacity: 0.2 } },
    point: { size: 3 },
    axis: {
      x: {
        labelFontSize: 11,
        labelSpacing: 6,
        labelFill: claudeColors.oliveGray,
      },
      y: {
        labelFontSize: 11,
        labelFill: claudeColors.oliveGray,
        labelFormatter: (v: number) => `${v}%`,
      },
    },
    legend: false,
    padding: [16, 16, 24, 16],
  }), [chartData]);

  if (loading) {
    return (
      <div className={styles.panel}>
        <div className={styles.emptyWrap}><Spin size="large" /></div>
      </div>
    );
  }

  if (!chartSeries.length) {
    return (
      <div className={styles.panel}>
        <div className={styles.emptyWrap}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无维度数据" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel} data-testid="radar-comparison-panel">
      <div className={styles.title}>能力雷达图</div>
      <div className={styles.chartWrap}><Radar {...config} /></div>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} /> 市场重要度
        </span>
        <span className={styles.legendItem}>
          <span
            className={styles.legendDot}
            style={{
              borderColor: studentCompetencyRadarColors.userReadiness,
              background: studentCompetencyRadarColors.userReadiness,
            }}
          />
          个人准备度
        </span>
      </div>
      <div className={styles.scoreGrid}>
        {dimensions.map((d) => {
          const value = Math.round(d.user_readiness);
          const barColor =
            value >= 70
              ? claudeColors.success
              : value >= 40
                ? claudeColors.terracotta
                : claudeColors.error;
          return (
            <div key={d.key} className={styles.scoreItem}>
              <div className={styles.scoreItemHeader}>
                <span className={styles.scoreLabel}>{d.title}</span>
                <span className={styles.scoreValue} style={{ color: barColor }}>{value}</span>
              </div>
              <div className={styles.scoreBar}>
                <div className={styles.scoreBarFill} style={{ width: `${value}%`, background: barColor }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **步骤 2: 验证 TypeScript 编译**

```bash
cd myapp && npx tsc --noEmit --pretty false src/pages/career-match/components/RadarComparisonPanel.tsx 2>&1 | head -20
```

- [ ] **步骤 3: 提交**

```bash
git add myapp/src/pages/career-match/components/RadarComparisonPanel.tsx
git commit -m "feat: add RadarComparisonPanel component for career-match"
```

---

### 任务 5: 创建 `GapAdvicePanel` 组件

**文件:**
- 创建: `myapp/src/pages/career-match/components/GapAdvicePanel.tsx`

- [ ] **步骤 1: 编写组件**

```tsx
import { WarningOutlined } from '@ant-design/icons';
import { Collapse, Typography, Spin } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { ClaudeTag } from '@/components/ui';
import { claudeColors, claudeFonts, claudeAlpha, claudeRadius } from '@/styles/claude-tokens';

const { Text } = Typography;

interface GapAdvicePanelProps {
  advices: API.StudentCompetencyActionAdviceItem[];
  priorityGaps: string[];
  activeGapKey: string | undefined;
  onGapSelect: (key: string) => void;
  loading?: boolean;
}

const useStyles = createStyles(({ css }) => ({
  panel: css`
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 8px;
    padding: 24px;
  `,
  title: css`
    font-family: ${claudeFonts.heading};
    font-size: 18px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
    margin-bottom: 16px;
  `,
  adviceTitle: css`font-size: 14px; font-weight: 600; color: ${claudeColors.nearBlack};`,
  adviceStatus: css`font-size: 12px; padding: 2px 8px; border-radius: ${claudeRadius.sm}px;`,
  statusNeeds: css`background: ${claudeAlpha(claudeColors.terracotta, 0.1)}; color: ${claudeColors.terracotta};`,
  statusOk: css`background: ${claudeAlpha(claudeColors.terracotta, 0.06)}; color: ${claudeColors.oliveGray};`,
  adviceBody: css`padding: 0 16px 16px;`,
  sectionLabel: css`
    font-size: 12px; font-weight: 600; color: ${claudeColors.oliveGray};
    text-transform: uppercase; letter-spacing: 0.04em;
    margin-bottom: 6px; margin-top: 12px;
    &:first-child { margin-top: 0; }
  `,
  bodyText: css`font-size: 13px; line-height: 1.6; color: ${claudeColors.charcoalWarm}; margin-bottom: 8px;`,
  bodyTextMuted: css`font-size: 13px; line-height: 1.6; color: ${claudeColors.stoneGray}; margin-bottom: 8px;`,
  actionList: css`
    list-style: none; padding: 0; margin: 0 0 8px;
    li {
      font-size: 13px; line-height: 1.6; color: ${claudeColors.charcoalWarm};
      padding: 2px 0 2px 16px; position: relative;
      &::before {
        content: ''; position: absolute; left: 0; top: 10px;
        width: 6px; height: 6px; border-radius: 50%;
        background: ${claudeColors.terracotta}; opacity: 0.6;
      }
    }
  `,
  keywordRow: css`display: flex; flex-wrap: wrap; gap: 6px;`,
  emptyText: css`color: ${claudeColors.stoneGray}; font-size: 14px; text-align: center; padding: 32px 0;`,
}));

function AdviceDetail({ advice }: { advice: API.StudentCompetencyActionAdviceItem }) {
  const { styles } = useStyles();
  return (
    <div className={styles.adviceBody}>
      {advice.why_it_matters && (
        <><div className={styles.sectionLabel}>重要性</div><div className={styles.bodyText}>{advice.why_it_matters}</div></>
      )}
      {advice.current_issue && (
        <><div className={styles.sectionLabel}>当前问题</div><div className={styles.bodyTextMuted}>{advice.current_issue}</div></>
      )}
      {advice.next_actions?.length > 0 && (
        <><div className={styles.sectionLabel}>下一步行动</div>
          <ul className={styles.actionList}>{advice.next_actions.map((a, i) => <li key={i}>{a}</li>)}</ul></>
      )}
      {advice.recommended_keywords?.length > 0 && (
        <><div className={styles.sectionLabel}>推荐关键词</div>
          <div className={styles.keywordRow}>{advice.recommended_keywords.map((kw) => <ClaudeTag key={kw}>{kw}</ClaudeTag>)}</div></>
      )}
    </div>
  );
}

export function GapAdvicePanel({ advices, priorityGaps, activeGapKey, onGapSelect, loading }: GapAdvicePanelProps) {
  const { styles, cx } = useStyles();
  const prioritySet = new Set(priorityGaps);

  const sorted = [...advices].sort((a, b) => {
    const aPri = prioritySet.has(a.key) ? 0 : 1;
    const bPri = prioritySet.has(b.key) ? 0 : 1;
    return aPri - bPri || b.gap - a.gap;
  });

  if (loading) {
    return (
      <div className={styles.panel} data-testid="gap-advice-panel">
        <Text className={styles.title}>差距分析与提升建议</Text>
        <div className={styles.emptyText}><Spin size="large" /></div>
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <div className={styles.panel} data-testid="gap-advice-panel">
        <Text className={styles.title}>差距分析与提升建议</Text>
        <div className={styles.emptyText}>暂无差距分析数据</div>
      </div>
    );
  }

  const items = sorted.map((advice) => {
    const isPriority = prioritySet.has(advice.key);
    return {
      key: advice.key,
      label: (
        <span className={styles.adviceTitle}>
          {isPriority && <WarningOutlined style={{ color: claudeColors.terracotta, marginRight: 6 }} />}
          {advice.title}
        </span>
      ),
      extra: (
        <span className={cx(styles.adviceStatus, advice.gap > 0 ? styles.statusNeeds : styles.statusOk)}>
          {advice.status_label || (advice.gap > 0 ? '需要补充' : '基本匹配')}
        </span>
      ),
      children: <AdviceDetail advice={advice} />,
    };
  });

  return (
    <div className={styles.panel} data-testid="gap-advice-panel">
      <Text className={styles.title}>差距分析与提升建议</Text>
      <Collapse
        accordion
        activeKey={activeGapKey}
        onChange={(key) => onGapSelect(Array.isArray(key) ? key[0] : (key as string))}
        items={items}
        expandIconPosition="end"
        style={{ background: 'transparent', border: 'none' }}
      />
    </div>
  );
}
```

- [ ] **步骤 2: 验证 TypeScript 编译**

```bash
cd myapp && npx tsc --noEmit --pretty false src/pages/career-match/components/GapAdvicePanel.tsx 2>&1 | head -20
```

- [ ] **步骤 3: 提交**

```bash
git add myapp/src/pages/career-match/components/GapAdvicePanel.tsx
git commit -m "feat: add GapAdvicePanel component for career-match"
```

---

### 任务 6: 创建 `CompanyGallery` 组件

**文件:**
- 创建: `myapp/src/pages/career-match/components/CompanyGallery.tsx`

- [ ] **步骤 1: 编写组件**

```tsx
import { BankOutlined } from '@ant-design/icons';
import { Empty } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useRef } from 'react';
import { ClaudeTag } from '@/components/ui';
import { claudeColors, claudeFonts } from '@/styles/claude-tokens';

interface CompanyGalleryProps {
  cards: API.CareerDevelopmentMatchEvidenceCard[];
}

const CARD_WIDTH = 230;
const GAP = 16;
const SPEED = 30;

const useStyles = createStyles(({ css }) => ({
  panel: css`
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 8px;
    padding: 24px;
    min-height: 200px;
  `,
  title: css`
    font-family: ${claudeFonts.heading};
    font-size: 18px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
    margin-bottom: 16px;
  `,
  viewport: css`overflow: hidden; position: relative; margin: 0 -8px; padding: 0 8px;`,
  fadeLeft: css`
    position: absolute; top: 0; bottom: 0; left: 0;
    width: 48px; pointer-events: none; z-index: 2;
    background: linear-gradient(to right, rgba(250,249,245,0.92), transparent);
  `,
  fadeRight: css`
    position: absolute; top: 0; bottom: 0; right: 0;
    width: 48px; pointer-events: none; z-index: 2;
    background: linear-gradient(to left, rgba(250,249,245,0.92), transparent);
  `,
  track: css`display: flex; gap: ${GAP}px; padding: 8px 4px 16px; will-change: transform;`,
  card: css`
    flex-shrink: 0; width: ${CARD_WIDTH}px;
    background: rgba(255,255,255,0.4);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid rgba(255,255,255,0.5);
    border-radius: 12px; padding: 18px;
    display: flex; flex-direction: column; gap: 10px;
    transition: all 0.25s ease;
    box-shadow: 0 8px 32px rgba(0,0,0,0.05), inset 0 0 0 1px rgba(255,255,255,0.4);
    &:hover {
      transform: translateY(-2px);
      border-color: ${claudeColors.terracotta};
      box-shadow: 0 8px 24px rgba(201,100,66,0.1);
    }
  `,
  cardHeader: css`display: flex; align-items: center; gap: 12px;`,
  companyIcon: css`
    display: flex; align-items: center; justify-content: center;
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(201,100,66,0.08); color: ${claudeColors.terracotta};
    font-size: 15px; flex-shrink: 0;
  `,
  companyName: css`font-family: ${claudeFonts.heading}; font-size: 15px; font-weight: 600; color: ${claudeColors.nearBlack}; line-height: 1.3;`,
  companyJob: css`font-size: 12px; color: ${claudeColors.stoneGray}; margin-top: 2px;`,
  scoreRow: css`display: flex; align-items: center; gap: 10px;`,
  miniRing: css`
    flex-shrink: 0; width: 40px; height: 40px; position: relative;
    display: flex; align-items: center; justify-content: center;
  `,
  miniRingSvg: css`transform: rotate(-90deg);`,
  miniScore: css`
    position: absolute; font-family: ${claudeFonts.heading};
    font-size: 10px; font-weight: 700; color: ${claudeColors.terracotta}; line-height: 1;
  `,
  scoreLabel: css`font-size: 12px; color: ${claudeColors.stoneGray};`,
  tagRow: css`display: flex; flex-wrap: wrap; gap: 6px;`,
  emptyWrap: css`display: flex; align-items: center; justify-content: center; min-height: 160px;`,
}));

export function CompanyGallery({ cards }: CompanyGalleryProps) {
  const { styles } = useStyles();
  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || cards.length < 3) return;
    const originals = Array.from(track.children) as HTMLElement[];
    originals.forEach((c) => track.appendChild(c.cloneNode(true)));
    const setWidth = cards.length * (CARD_WIDTH + GAP);
    let offset = 0;
    let lastTime = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      offset += SPEED * dt;
      if (offset >= setWidth) offset -= setWidth;
      track.style.transform = `translateX(${-offset}px)`;
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [cards.length]);

  if (!cards.length) {
    return (
      <div className={styles.panel}>
        <div className={styles.title}>最匹配的工作机会</div>
        <div className={styles.emptyWrap}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无匹配公司数据" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel} data-testid="company-gallery">
      <div className={styles.title}>最匹配的工作机会</div>
      <div className={styles.viewport}>
        <div className={styles.fadeLeft} />
        <div className={styles.fadeRight} />
        <div className={styles.track} ref={trackRef}>
          {cards.map((card) => {
            const score = Math.round(card.match_score);
            const circ = 2 * Math.PI * 16;
            return (
              <div key={card.profile_id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.companyIcon}><BankOutlined /></div>
                  <div>
                    <div className={styles.companyName}>{card.company_name}</div>
                    <div className={styles.companyJob}>{card.job_title}</div>
                  </div>
                </div>
                <div className={styles.scoreRow}>
                  <div className={styles.miniRing}>
                    <svg className={styles.miniRingSvg} width="40" height="40" viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r="16" fill="none" stroke="#f0eee6" strokeWidth="4" />
                      <circle cx="20" cy="20" r="16" fill="none" stroke={claudeColors.terracotta}
                        strokeWidth="4" strokeDasharray={circ}
                        strokeDashoffset={circ - (circ * score) / 100} strokeLinecap="round" />
                    </svg>
                    <span className={styles.miniScore}>{score}</span>
                  </div>
                  <span className={styles.scoreLabel}>匹配度</span>
                </div>
                <div className={styles.tagRow}>
                  {card.industry && <ClaudeTag>{card.industry}</ClaudeTag>}
                  {card.professional_threshold_dimension_count > 0 && (
                    <ClaudeTag>{card.professional_threshold_dimension_count} 个核心维度</ClaudeTag>
                  )}
                  {card.group_similarities?.slice(0, 2).map((g) => (
                    <ClaudeTag key={g.group_key}>{g.label || g.group_key}</ClaudeTag>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **步骤 2: 验证 TypeScript 编译**

```bash
cd myapp && npx tsc --noEmit --pretty false src/pages/career-match/components/CompanyGallery.tsx 2>&1 | head -20
```

- [ ] **步骤 3: 提交**

```bash
git add myapp/src/pages/career-match/components/CompanyGallery.tsx
git commit -m "feat: add CompanyGallery component for career-match"
```

---

### 任务 7: 创建 `DataSourceFooter` 组件

**文件:**
- 创建: `myapp/src/pages/career-match/components/DataSourceFooter.tsx`

- [ ] **步骤 1: 编写组件**

```tsx
import { ClockCircleOutlined } from '@ant-design/icons';
import { createStyles } from 'antd-style';
import React from 'react';
import { claudeColors } from '@/styles/claude-tokens';

interface DataSourceFooterProps {
  dimensionCount: number;
  updatedAt: string | undefined;
}

const useStyles = createStyles(({ css }) => ({
  footer: css`
    text-align: center;
    padding: 8px 0 0;
    font-size: 11px;
    color: ${claudeColors.stoneGray};
  `,
}));

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function DataSourceFooter({ dimensionCount, updatedAt }: DataSourceFooterProps) {
  const { styles } = useStyles();
  return (
    <div className={styles.footer} data-testid="datasource-footer">
      <ClockCircleOutlined style={{ marginRight: 4 }} />
      数据来源：{dimensionCount} 维度分析{updatedAt ? ` · 更新于 ${formatDate(updatedAt)}` : ''}
    </div>
  );
}
```

- [ ] **步骤 2: 验证 TypeScript 编译**

```bash
cd myapp && npx tsc --noEmit --pretty false src/pages/career-match/components/DataSourceFooter.tsx 2>&1 | head -20
```

- [ ] **步骤 3: 提交**

```bash
git add myapp/src/pages/career-match/components/DataSourceFooter.tsx
git commit -m "feat: add DataSourceFooter component for career-match"
```

---

### 任务 8: 重写 `pageStyles.ts`

**文件:**
- 修改: `myapp/src/pages/career-match/pageStyles.ts`

- [ ] **步骤 1: 替换为新的页面样式**

```ts
import { createStyles } from 'antd-style';
import { claudeColors, claudeFonts } from '@/styles/claude-tokens';

export const useStyles = createStyles(({ css }) => ({
  shell: css`
    min-height: calc(100vh - 112px);
    padding: calc(var(--header-height, 56px)) 32px 40px;
    position: relative;
    overflow: hidden;
    @media (max-width: 800px) {
      padding: calc(var(--header-height, 56px)) 16px 28px;
    }
  `,
  page: css`
    width: 100%;
    max-width: 1040px;
    margin: 0 auto;
  `,
  header: css`margin-bottom: 36px;`,
  headerLabel: css`
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${claudeColors.terracotta};
    margin-bottom: 8px;
  `,
  headerTitle: css`
    font-family: ${claudeFonts.heading};
    font-size: 32px;
    font-weight: 600;
    color: ${claudeColors.nearBlack};
    letter-spacing: -0.01em;
    line-height: 1.2;
    margin-bottom: 8px;
  `,
  headerSub: css`
    font-size: 15px;
    color: ${claudeColors.oliveGray};
    line-height: 1.6;
  `,
  coachRow: css`
    display: flex;
    justify-content: flex-end;
    margin-bottom: 8px;
  `,
  workspace: css`
    display: flex;
    gap: 20px;
    align-items: flex-start;
    @media (max-width: 800px) {
      flex-direction: column;
    }
  `,
  contentArea: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
  `,
  tabsBar: css`
    display: flex;
    gap: 0;
    border-bottom: 1px solid ${claudeColors.borderWarm};
  `,
  tab: css`
    position: relative;
    padding: 11px 24px;
    font-size: 14px;
    font-weight: 600;
    color: ${claudeColors.stoneGray};
    cursor: pointer;
    border: none;
    background: none;
    font-family: ${claudeFonts.body};
    display: flex;
    align-items: center;
    gap: 8px;
    transition: color 0.2s ease;
    &:hover { color: ${claudeColors.oliveGray}; }
  `,
  tabActive: css`
    color: ${claudeColors.terracotta};
    &::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: ${claudeColors.terracotta};
      border-radius: 1px 1px 0 0;
    }
  `,
  tabCount: css`
    font-size: 11px;
    font-weight: 600;
    padding: 1px 7px;
    border-radius: 10px;
    background: ${claudeColors.borderCream};
    color: ${claudeColors.stoneGray};
    line-height: 1.5;
  `,
  tabCountActive: css`
    background: rgba(201, 100, 66, 0.06);
    color: ${claudeColors.terracotta};
  `,
  tabPanel: css`
    animation: fadeSlideIn 0.3s ease;
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,
  loading: css`
    display: flex;
    justify-content: center;
    padding-top: 48px;
  `,
}));
```

- [ ] **步骤 2: 验证 TypeScript 编译**

```bash
cd myapp && npx tsc --noEmit --pretty false src/pages/career-match/pageStyles.ts 2>&1 | head -20
```

- [ ] **步骤 3: 提交**

```bash
git add myapp/src/pages/career-match/pageStyles.ts
git commit -m "refactor: rewrite career-match pageStyles for new layout"
```

---

### 任务 9: 重写 `index.tsx` 页面入口

**文件:**
- 修改: `myapp/src/pages/career-match/index.tsx`

- [ ] **步骤 1: 替换为新的页面组件**

```tsx
import { Spin } from 'antd';
import React from 'react';
import { AskCoachButton, FadeInWhenVisible, GlassShell, PageError } from '@/components/ui';
import { useStyles } from './pageStyles';
import { useCareerMatchData, type MatchTabKey } from './hooks/useCareerMatchData';
import { ScoreNav } from './components/ScoreNav';
import { MatchOverviewCard } from './components/MatchOverviewCard';
import { RadarComparisonPanel } from './components/RadarComparisonPanel';
import { GapAdvicePanel } from './components/GapAdvicePanel';
import { CompanyGallery } from './components/CompanyGallery';
import { DataSourceFooter } from './components/DataSourceFooter';

const CareerMatchPage: React.FC = () => {
  const { styles, cx } = useStyles();
  const data = useCareerMatchData();

  if (data.loading) {
    return (
      <GlassShell>
        <div className={styles.shell}>
          <div className={styles.page}>
            <div className={styles.loading}><Spin size="large" /></div>
          </div>
        </div>
      </GlassShell>
    );
  }

  if (data.error) {
    return (
      <GlassShell>
        <div className={styles.shell}>
          <div className={styles.page}>
            <PageError description={data.error} onRetry={() => window.location.reload()} />
          </div>
        </div>
      </GlassShell>
    );
  }

  const recommendations = data.matchData?.recommendations || [];
  const activeReport = data.activeRecommendation;
  const isFavorited = Boolean(data.activeRecommendationFavorite);
  const tabCounts = {
    comparison: activeReport?.comparison_dimensions?.length || 0,
    advice: activeReport?.action_advices?.length || 0,
    company: activeReport?.evidence_cards?.length || 0,
  };

  const tabs: { key: MatchTabKey; label: string }[] = [
    { key: 'comparison', label: '能力对比' },
    { key: 'advice', label: '提升建议' },
    { key: 'company', label: '最匹配工作' },
  ];

  return (
    <GlassShell>
      <div className={styles.shell}>
        <div className={styles.page}>
          <div className={styles.header}>
            <div className={styles.headerLabel}>Career Match</div>
            <h1 className={styles.headerTitle}>职业匹配分析</h1>
            <p className={styles.headerSub}>基于你的 12 维能力画像，匹配最适合的职业方向</p>
          </div>

          <div className={styles.coachRow}>
            <AskCoachButton
              step="match"
              context={{
                sourcePage: 'career-match',
                favoriteId: data.activeRecommendationFavorite?.favorite_id,
                reportId: activeReport?.report_id,
                recommendationId: data.activeRecommendationId,
              }}
            />
          </div>

          <FadeInWhenVisible>
            <div className={styles.workspace}>
              <ScoreNav
                recommendations={recommendations}
                activeId={data.activeRecommendationId}
                onSelect={data.setActiveRecommendationId}
              />

              <div className={styles.contentArea}>
                {activeReport && (
                  <MatchOverviewCard
                    report={activeReport}
                    isFavorited={isFavorited}
                    favoriteSubmitting={data.favoriteSubmitting}
                    onToggleFavorite={data.toggleFavorite}
                    onGeneratePlan={data.generatePlan}
                  />
                )}

                <div className={styles.tabsBar}>
                  {tabs.map((t) => (
                    <button
                      key={t.key}
                      className={cx(styles.tab, data.activeTab === t.key && styles.tabActive)}
                      onClick={() => data.setActiveTab(t.key)}
                    >
                      {t.label}
                      <span className={cx(styles.tabCount, data.activeTab === t.key && styles.tabCountActive)}>
                        {tabCounts[t.key]}
                      </span>
                    </button>
                  ))}
                </div>

                <div className={styles.tabPanel} key={data.activeTab}>
                  {data.activeTab === 'comparison' && (
                    <RadarComparisonPanel
                      chartSeries={activeReport?.chart_series || []}
                      dimensions={activeReport?.comparison_dimensions || []}
                    />
                  )}
                  {data.activeTab === 'advice' && (
                    <GapAdvicePanel
                      advices={activeReport?.action_advices || []}
                      priorityGaps={activeReport?.priority_gap_dimensions || []}
                      activeGapKey={data.activeGapKey}
                      onGapSelect={data.setActiveGapKey}
                    />
                  )}
                  {data.activeTab === 'company' && (
                    <CompanyGallery cards={activeReport?.evidence_cards || []} />
                  )}
                </div>

                <DataSourceFooter
                  dimensionCount={data.matchData?.source?.active_dimension_count || 12}
                  updatedAt={data.sourceUpdatedAt}
                />
              </div>
            </div>
          </FadeInWhenVisible>
        </div>
      </div>
    </GlassShell>
  );
};

export default CareerMatchPage;
```

- [ ] **步骤 2: 验证 TypeScript 编译**

```bash
cd myapp && npx tsc --noEmit --pretty false src/pages/career-match/index.tsx 2>&1 | head -30
```

预期: 无类型错误

- [ ] **步骤 3: 提交**

```bash
git add myapp/src/pages/career-match/index.tsx
git commit -m "refactor: rewrite career-match page with independent component tree"
```

---

### 任务 10: 验证与清理

- [ ] **步骤 1: TypeScript 全量检查**

```bash
cd myapp && npx tsc --noEmit --pretty false 2>&1 | grep -i "error" | head -20
```

预期: 无 career-match 相关新错误

- [ ] **步骤 2: 确认无 SCP 残留依赖**

```bash
grep -r "student-competency-profile" myapp/src/pages/career-match/ 2>&1
```

预期: 无输出

- [ ] **步骤 3: 启动开发服务器手动验证**

```
访问 /career-match 验证：左侧分数导航切换 / 概览卡显示 /
Tab 切换（雷达图/差距分析/画廊）/ 公司画廊匀速滚动 /
右上角 AI 教练跳转 / 收藏后生成计划按钮可用
```

- [ ] **步骤 4: 最终提交**
