import { FadeInWhenVisible, PageError } from "@/components/ui";
import {
  getOrderedTiers,
  getStageKeyByLevel,
  getTierSalarySummary,
} from "@/components/VerticalTierComparison";
import { PageContainer } from "@ant-design/pro-components";
import { history } from "@umijs/max";
import { Spin } from "antd";
import { createStyles } from "antd-style";
import { useMemo } from "react";
import { CtaSection } from "./components/CtaSection";
import { GrowthRoadmap } from "./components/GrowthRoadmap";
import { HeroSection } from "./components/HeroSection";
import { PipelineSteps } from "./components/PipelineSteps";
import { ProfileCard } from "./components/ProfileCard";
import { QuickStats } from "./components/QuickStats";
import { useHomeData } from "./hooks/useHomeData";

const STAGE_ORDER: Array<"low" | "middle" | "high"> = ["low", "middle", "high"];
const HOME_STAGE_LABELS: Record<string, string> = {
  low: "初级阶段",
  middle: "进阶阶段",
  high: "高阶阶段",
};

const FALLBACK_STEPS: API.HomeV2ProgressStep[] = [
  {
    key: "profile",
    label: "完善资料",
    status: "current",
    description: "补齐姓名、学校、专业、学历、年级和目标岗位。",
    href: "/",
  },
  {
    key: "analysis",
    label: "简历解析",
    status: "todo",
    description: "完成 12 维能力画像。",
    href: "/student-competency-profile",
  },
  {
    key: "favorite",
    label: "职业匹配",
    status: "todo",
    description: "选择并收藏目标岗位。",
    href: "/career-match",
  },
  {
    key: "learning_path",
    label: "蜗牛学习路径",
    status: "todo",
    description: "生成阶段学习路径。",
    href: "/snail-learning-path",
  },
  {
    key: "growth_report",
    label: "成长报告",
    status: "todo",
    description: "生成个人职业成长报告。",
    href: "/personal-growth-report",
  },
];

const FALLBACK_NEXT_ACTION: API.HomeV2NextAction = {
  label: "完善个人资料",
  description: "先设置目标岗位，首页会据此生成职业阶段与薪资参考。",
  href: "/",
  button_text: "完善资料",
};

const useStyles = createStyles(({ css }) => ({
  pageContainer: css`
    :global(.ant-pro-page-container-children-container) {
      padding-inline: 0;
      padding-block: 0;
    }
  `,
  shell: css`
    min-height: calc(100vh - 112px);
    padding: calc(var(--header-height, 56px)) 32px 40px;
    position: relative;
    overflow: hidden;
    @media (max-width: 900px) {
      padding: calc(var(--header-height, 56px)) 16px 28px;
    }
  `,
  content: css`
    width: min(100%, 1360px);
    margin: 0 auto;
    position: relative;
    z-index: 1;
  `,
  loading: css`
    display: flex;
    justify-content: center;
    padding-top: 48px;
  `,
}));

export default function HomeV2Page() {
  const { styles } = useStyles();
  const { homeData, favorites, loading, error, refresh } = useHomeData();

  const progress = homeData?.planning_progress;
  const profile = homeData?.profile;
  const attachments = homeData?.attachments ?? [];
  const vertical = homeData?.vertical_profile;

  const steps = progress?.steps ?? FALLBACK_STEPS;
  const nextAction = progress?.next_action ?? FALLBACK_NEXT_ACTION;
  const completedCount = steps.filter((s) => s.status === "done").length;
  const hasTarget = Boolean(profile?.target_job_title);

  const targetJob = profile?.target_job_title ?? "完善资料";
  const stage =
    HOME_STAGE_LABELS[homeData?.current_stage ?? "low"] ?? "初级阶段";
  const matchPercent = progress?.active_target?.overall_match ?? 0;
  const completionPercent = progress?.completion_percent ?? 0;

  const growthStages = useMemo(() => {
    if (!vertical?.tiered_comparison?.tiers) {
      return STAGE_ORDER.map((key) => ({
        name: HOME_STAGE_LABELS[key],
        salaryRange: "—",
      }));
    }
    const ordered = getOrderedTiers(vertical.tiered_comparison.tiers);
    return ordered.map((tier) => {
      const key = getStageKeyByLevel(tier.level);
      const salary = getTierSalarySummary(tier);
      return {
        name: HOME_STAGE_LABELS[key] ?? tier.level,
        salaryRange: salary ?? "—",
      };
    });
  }, [vertical]);

  const currentStageIndex = useMemo(() => {
    const currentKey = homeData?.current_stage ?? "low";
    return STAGE_ORDER.indexOf(currentKey as "low" | "middle" | "high");
  }, [homeData?.current_stage]);

  const salaryRef = useMemo(() => {
    if (!vertical?.tiered_comparison?.tiers) return "—";
    const ordered = getOrderedTiers(vertical.tiered_comparison.tiers);
    const current = ordered[currentStageIndex];
    return current ? getTierSalarySummary(current) ?? "—" : "—";
  }, [vertical, currentStageIndex]);

  const matchedJobs = favorites.length || (progress?.active_target ? 1 : 0);

  if (loading) {
    return (
      <PageContainer
        className={styles.pageContainer}
        title={false}
        pageHeaderRender={false}
      >
        <div className={styles.shell}>
          <div className={styles.loading}>
            <Spin size="large" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer
        className={styles.pageContainer}
        title={false}
        pageHeaderRender={false}
      >
        <div className={styles.shell}>
          <PageError description={error} onRetry={refresh} />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      className={styles.pageContainer}
      title={false}
      pageHeaderRender={false}
    >
      <div className={styles.shell}>
        <div className={styles.content}>
          <FadeInWhenVisible>
            <HeroSection
              targetJob={targetJob}
              stage={stage}
              matchPercent={matchPercent}
              completionPercent={completionPercent}
              nextActionLabel={nextAction.label}
              nextActionDescription={nextAction.description}
              onAction={() => history.push(nextAction.href)}
              hasTarget={hasTarget}
            />
          </FadeInWhenVisible>

          <FadeInWhenVisible>
            <QuickStats
              progress={completionPercent}
              salary={salaryRef}
              matchedJobs={matchedJobs}
            />
          </FadeInWhenVisible>

          <FadeInWhenVisible>
            <PipelineSteps
              steps={steps}
              completedCount={completedCount}
              nextActionLabel={nextAction.button_text}
              onStepClick={(href) => history.push(href)}
            />
          </FadeInWhenVisible>

          {hasTarget && (
            <FadeInWhenVisible>
              <GrowthRoadmap
                stages={growthStages}
                currentStageIndex={currentStageIndex}
              />
            </FadeInWhenVisible>
          )}

          {profile && (
            <FadeInWhenVisible>
              <ProfileCard
                profile={profile}
                attachments={attachments}
                onSaved={refresh}
              />
            </FadeInWhenVisible>
          )}

          <FadeInWhenVisible>
            <CtaSection
              nextActionLabel={nextAction.label}
              nextActionDescription={nextAction.description}
              nextActionButtonText={nextAction.button_text}
              onAction={() => history.push(nextAction.href)}
            />
          </FadeInWhenVisible>
        </div>
      </div>
    </PageContainer>
  );
}
