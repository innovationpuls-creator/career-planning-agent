import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getCareerDevelopmentPlanWorkspace,
  getHomeV2,
  getPersonalGrowthReportWorkspace,
  getStudentCompetencyLatestAnalysis,
  updatePersonalGrowthReportWorkspace,
} from '@/services/ant-design-pro/api';
import {
  clearPersonalGrowthDraft,
  createPersonalGrowthReportTemplate,
  htmlToMarkdown,
  markdownToHtml,
  normalizeReportMarkdown,
  PERSONAL_GROWTH_SECTION_META,
  PERSONAL_GROWTH_SECTION_ORDER,
  type PersonalGrowthSection,
  type PersonalGrowthSectionKey,
  parsePersonalGrowthMarkdown,
  readPersonalGrowthDraft,
  savePersonalGrowthDraft,
} from '../personalGrowthReportUtils';

const emptyLatestAnalysis: API.StudentCompetencyLatestAnalysisPayload = {
  available: false,
  message: '暂无最新 12 维解析结果。',
  comparison_dimensions: [],
  chart_series: [],
  strength_dimensions: [],
  priority_gap_dimensions: [],
  recommended_keywords: {},
  action_advices: [],
};

const NULL_SECTION_HTML_MAP: Record<PersonalGrowthSectionKey, string> = {
  self_cognition: '',
  career_direction_analysis: '',
  match_assessment: '',
  development_suggestions: '',
  action_plan: '',
};

const getRequestErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.detail || error?.message || fallback;

type UseReportWorkspaceOptions = {
  favoriteId?: number;
};

function buildSectionHtmlMap(
  sections?: API.PersonalGrowthReportSection[],
): Record<PersonalGrowthSectionKey, string> {
  const map = { ...NULL_SECTION_HTML_MAP };
  if (!sections?.length) return map;
  for (const s of sections) {
    const key = s.key as PersonalGrowthSectionKey;
    if (key in map) {
      map[key] = markdownToHtml(s.content || '');
    }
  }
  return map;
}

function sectionHtmlMapToMarkdown(
  htmlMap: Record<PersonalGrowthSectionKey, string>,
): string {
  const blocks: string[] = ['# 个人职业成长报告'];
  PERSONAL_GROWTH_SECTION_ORDER.forEach((key) => {
    const html = htmlMap[key]?.trim();
    if (!html) return;
    const md = htmlToMarkdown(html);
    if (!md) return;
    blocks.push(`## ${PERSONAL_GROWTH_SECTION_META[key].title}\n${md}`);
  });
  return blocks.join('\n\n').trim();
}

function sectionHtmlMapToBackendSections(
  htmlMap: Record<PersonalGrowthSectionKey, string>,
): API.PersonalGrowthReportSection[] {
  return PERSONAL_GROWTH_SECTION_ORDER.map((key) => {
    const content = htmlToMarkdown(htmlMap[key] || '');
    return {
      key,
      title: PERSONAL_GROWTH_SECTION_META[key].title,
      content,
      completed: Boolean(content.trim()),
    };
  });
}

export function useReportWorkspace({ favoriteId }: UseReportWorkspaceOptions) {
  const [pageLoading, setPageLoading] = useState(false);
  const [homePayload, setHomePayload] = useState<API.HomeV2Payload>();
  const [latestAnalysis, setLatestAnalysis] =
    useState<API.StudentCompetencyLatestAnalysisPayload>(emptyLatestAnalysis);
  const [goalWorkspace, setGoalWorkspace] =
    useState<API.PlanWorkspacePayload>();
  const [reportWorkspace, setReportWorkspace] =
    useState<API.PersonalGrowthReportPayload>();
  const [sectionHtmlMap, setSectionHtmlMap] = useState<
    Record<PersonalGrowthSectionKey, string>
  >(NULL_SECTION_HTML_MAP);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string>();
  const [actionError, setActionError] = useState<string>();

  const savedMarkdown = useMemo(
    () => normalizeReportMarkdown(reportWorkspace),
    [reportWorkspace],
  );

  const sections = useMemo<PersonalGrowthSection[]>(() => {
    const sectionsData = reportWorkspace?.sections;
    if (!sectionsData?.length) return [];
    return sectionsData as PersonalGrowthSection[];
  }, [reportWorkspace?.sections]);

  const loadWorkspace = useCallback(async (targetFavoriteId: number) => {
    try {
      const response = await getPersonalGrowthReportWorkspace(
        targetFavoriteId,
        { skipErrorHandler: true },
      );
      setReportWorkspace(response?.data);
    } catch (error: any) {
      const statusCode = error?.response?.status;
      if (statusCode === 404 || String(error?.message || '').includes('404')) {
        setReportWorkspace(undefined);
        return;
      }
      throw error;
    }
  }, []);

  const loadGoalWorkspace = useCallback(async (targetFavoriteId: number) => {
    try {
      const response = await getCareerDevelopmentPlanWorkspace(
        targetFavoriteId,
        { skipErrorHandler: true },
      );
      setGoalWorkspace(response?.data);
    } catch (error: any) {
      const statusCode = error?.response?.status;
      if (statusCode === 404 || String(error?.message || '').includes('404')) {
        setGoalWorkspace(undefined);
        return;
      }
      throw error;
    }
  }, []);

  const refreshPageData = useCallback(
    async (targetFavoriteId?: number) => {
      setPageLoading(true);
      setActionError(undefined);
      try {
        const [homeResponse, analysisResponse] = await Promise.all([
          getHomeV2({ skipErrorHandler: true }),
          getStudentCompetencyLatestAnalysis({ skipErrorHandler: true }),
          targetFavoriteId
            ? Promise.all([
                loadGoalWorkspace(targetFavoriteId),
                loadWorkspace(targetFavoriteId),
              ])
            : Promise.resolve(),
        ]);
        setHomePayload(homeResponse?.data);
        setLatestAnalysis(analysisResponse?.data || emptyLatestAnalysis);
      } catch (error: any) {
        setActionError(
          getRequestErrorMessage(error, '个人职业成长报告数据加载失败。'),
        );
      } finally {
        setPageLoading(false);
      }
    },
    [loadWorkspace, loadGoalWorkspace],
  );

  useEffect(() => {
    if (!favoriteId) {
      setGoalWorkspace(undefined);
      setReportWorkspace(undefined);
      setSectionHtmlMap(NULL_SECTION_HTML_MAP);
      setDirty(false);
      void refreshPageData(undefined);
      return;
    }
    void refreshPageData(favoriteId);
  }, [favoriteId, refreshPageData]);

  useEffect(() => {
    if (!favoriteId) return;
    const draft = readPersonalGrowthDraft(
      favoriteId,
      reportWorkspace?.workspace_id,
    );
    if (draft?.markdown) {
      const parsed = parsePersonalGrowthMarkdown(draft.markdown);
      const draftMap = { ...NULL_SECTION_HTML_MAP };
      parsed.sections.forEach((s) => {
        draftMap[s.key] = markdownToHtml(s.content);
      });
      setSectionHtmlMap(draftMap);
      setDirty(true);
      return;
    }
    const nextMap = buildSectionHtmlMap(reportWorkspace?.sections);
    setSectionHtmlMap(nextMap);
    setDirty(false);
  }, [
    favoriteId,
    reportWorkspace?.workspace_id,
    reportWorkspace?.edited_markdown,
    reportWorkspace?.generated_markdown,
  ]);

  useEffect(() => {
    if (!favoriteId) return;
    const combinedMarkdown = sectionHtmlMapToMarkdown(sectionHtmlMap);
    const normalizedSaved = savedMarkdown.trim();
    if (!combinedMarkdown || combinedMarkdown === normalizedSaved) {
      clearPersonalGrowthDraft(favoriteId, reportWorkspace?.workspace_id);
      setDirty(false);
      return;
    }
    savePersonalGrowthDraft({
      favoriteId,
      workspaceId: reportWorkspace?.workspace_id,
      markdown: combinedMarkdown,
      updatedAt: new Date().toISOString(),
    });
    setDirty(true);
  }, [
    sectionHtmlMap,
    favoriteId,
    reportWorkspace?.workspace_id,
    savedMarkdown,
  ]);

  const saveReport = useCallback(
    async (htmlMap: Record<PersonalGrowthSectionKey, string>) => {
      if (!favoriteId) return;
      const backendSections = sectionHtmlMapToBackendSections(htmlMap);
      const filledCount = backendSections.filter((s) =>
        s.content.trim(),
      ).length;
      if (filledCount === 0) {
        throw new Error('请保留 5 个二级标题后再保存。');
      }

      setSaving(true);
      setActionError(undefined);
      try {
        const response = await updatePersonalGrowthReportWorkspace(
          favoriteId,
          { sections: backendSections },
          { skipErrorHandler: true },
        );
        setReportWorkspace(response?.data);
        clearPersonalGrowthDraft(
          favoriteId,
          response?.data?.workspace_id || reportWorkspace?.workspace_id,
        );
        setDirty(false);
        return response?.data;
      } catch (error: any) {
        setActionError(
          getRequestErrorMessage(error, '保存个人职业成长报告失败。'),
        );
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [favoriteId, reportWorkspace?.workspace_id],
  );

  return {
    pageLoading,
    homePayload,
    latestAnalysis,
    goalWorkspace,
    reportWorkspace,
    sectionHtmlMap,
    setSectionHtmlMap,
    dirty,
    saving,
    pageError,
    actionError,
    setActionError,
    setPageError,
    savedMarkdown,
    sections,
    saveReport,
    refreshPageData,
    setReportWorkspace,
  };
}
