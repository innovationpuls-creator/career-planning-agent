import { useMemo } from 'react';

export type PrerequisiteItem = {
  key: string;
  label: string;
  ready: boolean;
  blocking: boolean;
  description: string;
  prompt: string;
};

type UsePrerequisitesOptions = {
  activeFavorite?: API.CareerDevelopmentFavoritePayload;
  homePayload?: API.HomeV2Payload;
  latestAnalysis?: API.StudentCompetencyLatestAnalysisPayload;
  goalWorkspace?: API.PlanWorkspacePayload;
};

export function usePrerequisites({
  activeFavorite,
  homePayload,
  latestAnalysis,
  goalWorkspace,
}: UsePrerequisitesOptions) {
  const prerequisiteItems = useMemo<PrerequisiteItem[]>(() => {
    const profile = homePayload?.profile;
    const profileReady = Boolean(
      profile?.full_name &&
        profile?.school &&
        profile?.major &&
        profile?.education_level &&
        profile?.grade &&
        profile?.target_job_title,
    );
    const phases = goalWorkspace?.growth_plan_phases || [];
    const hasLearningPathWorkspace = phases.length > 0;

    return [
      {
        key: 'favorite',
        label: '目标岗位',
        ready: Boolean(activeFavorite),
        blocking: true,
        description: activeFavorite
          ? `${activeFavorite.canonical_job_title}${activeFavorite.industry ? ` / ${activeFavorite.industry}` : ''}`
          : '未选择职业推荐目标。',
        prompt: '请先在职业匹配结果中选择并收藏一个目标岗位。',
      },
      {
        key: 'profile',
        label: '我的资料',
        ready: profileReady,
        blocking: true,
        description: profileReady
          ? `${profile?.school} · ${profile?.major} · ${profile?.education_level}`
          : '资料未补齐。',
        prompt: '请先在首页补充姓名、学校、专业、学历、年级、目标岗位。',
      },
      {
        key: 'analysis',
        label: '12维解析',
        ready: Boolean(latestAnalysis?.available && latestAnalysis?.comparison_dimensions?.length),
        blocking: true,
        description:
          latestAnalysis?.available && latestAnalysis?.comparison_dimensions?.length
            ? `已生成 ${latestAnalysis.comparison_dimensions.length} 个维度的对标结果。`
            : latestAnalysis?.message || '暂无最新解析结果。',
        prompt: '请先在"简历解析"页面完成一次最新的 12 维解析。',
      },
      {
        key: 'learning_path',
        label: '蜗牛学习路径',
        ready: true,
        blocking: false,
        description: hasLearningPathWorkspace
          ? `已读取到 ${phases.length} 个学习路径阶段。`
          : '系统会在生成报告时自动补齐行动计划。',
        prompt: hasLearningPathWorkspace
          ? '已可直接用于生成行动计划。'
          : '如果你已在蜗牛学习路径页生成过内容，不会阻塞当前报告生成。',
      },
    ];
  }, [activeFavorite, goalWorkspace?.growth_plan_phases, homePayload?.profile, latestAnalysis]);

  const blockingMissingItems = prerequisiteItems.filter((item) => item.blocking && !item.ready);

  return {
    prerequisiteItems,
    blockingMissingItems,
    allReady: blockingMissingItems.length === 0,
  };
}
