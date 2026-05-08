import { message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getCareerDevelopmentPlanWorkspace,
  getHomeV2,
  getPersonalGrowthReportWorkspace,
  getStudentCompetencyLatestAnalysis,
  regeneratePersonalGrowthReport,
  updatePersonalGrowthReportWorkspace,
} from '@/services/ant-design-pro/api';
import {
  clearPersonalGrowthDraft,
  createPersonalGrowthSectionTemplate,
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

const emptyHtmlMap: Record<PersonalGrowthSectionKey, string> = {
  self_cognition: '',
  career_direction_analysis: '',
  match_assessment: '',
  development_suggestions: '',
  action_plan: '',
};

const getRequestErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.detail || error?.message || fallback;

const isNotFoundError = (error: any) =>
  error?.response?.status === 404 || String(error?.message || '').includes('404');

const normalizeSections = (
  sections?: API.PersonalGrowthReportSection[],
): PersonalGrowthSection[] => {
  const byKey = new Map((sections || []).map((section) => [section.key, section]));
  return PERSONAL_GROWTH_SECTION_ORDER.map((key) => {
    const section = byKey.get(key);
    const content = section?.content || '';
    return {
      key,
      title: section?.title || PERSONAL_GROWTH_SECTION_META[key].title,
      content,
      completed: Boolean(content.trim()),
    };
  });
};

const sectionsToHtmlMap = (
  sections?: API.PersonalGrowthReportSection[],
): Record<PersonalGrowthSectionKey, string> => {
  const map = { ...emptyHtmlMap };
  normalizeSections(sections).forEach((section) => {
    map[section.key] = markdownToHtml(section.content || '');
  });
  return map;
};

const htmlMapToMarkdown = (htmlMap: Record<PersonalGrowthSectionKey, string>) => {
  const blocks = ['# 个人职业成长报告'];
  PERSONAL_GROWTH_SECTION_ORDER.forEach((key) => {
    const markdown = htmlToMarkdown(htmlMap[key] || '').trim();
    if (markdown) {
      blocks.push(`## ${PERSONAL_GROWTH_SECTION_META[key].title}\n${markdown}`);
    }
  });
  return blocks.join('\n\n').trim();
};

const htmlMapToBackendSections = (
  htmlMap: Record<PersonalGrowthSectionKey, string>,
): API.PersonalGrowthReportSection[] =>
  PERSONAL_GROWTH_SECTION_ORDER.map((key) => {
    const content = htmlToMarkdown(htmlMap[key] || '');
    return {
      key,
      title: PERSONAL_GROWTH_SECTION_META[key].title,
      content,
      completed: Boolean(content.trim()),
    };
  });

type UseReportWorkspaceOptions = {
  favoriteId?: number;
};

export function useReportWorkspace({ favoriteId }: UseReportWorkspaceOptions) {
  const [pageLoading, setPageLoading] = useState(false);
  const [homePayload, setHomePayload] = useState<API.HomeV2Payload>();
  const [latestAnalysis, setLatestAnalysis] =
    useState<API.StudentCompetencyLatestAnalysisPayload>(emptyLatestAnalysis);
  const [goalWorkspace, setGoalWorkspace] =
    useState<API.PlanWorkspacePayload>();
  const [reportWorkspace, setReportWorkspace] =
    useState<API.PersonalGrowthReportPayload>();
  const [sectionHtmlMap, setSectionHtmlMap] =
    useState<Record<PersonalGrowthSectionKey, string>>(emptyHtmlMap);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [actionError, setActionError] = useState<string>();

  const savedMarkdown = useMemo(
    () => normalizeReportMarkdown(reportWorkspace),
    [reportWorkspace],
  );

  const sections = useMemo(
    () => normalizeSections(reportWorkspace?.sections),
    [reportWorkspace?.sections],
  );

  const loadReportWorkspace = useCallback(async (targetFavoriteId: number) => {
    try {
      const response = await getPersonalGrowthReportWorkspace(
        targetFavoriteId,
        { skipErrorHandler: true },
      );
      setReportWorkspace(response?.data);
    } catch (error: any) {
      if (isNotFoundError(error)) {
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
      if (isNotFoundError(error)) {
        setGoalWorkspace(undefined);
        return;
      }
      throw error;
    }
  }, []);

  const refreshPageData = useCallback(
    async (targetFavoriteId = favoriteId) => {
      setPageLoading(true);
      setActionError(undefined);
      try {
        const requests: Promise<unknown>[] = [
          getHomeV2({ skipErrorHandler: true }).then((response) =>
            setHomePayload(response?.data),
          ),
          getStudentCompetencyLatestAnalysis({ skipErrorHandler: true }).then(
            (response) => setLatestAnalysis(response?.data || emptyLatestAnalysis),
          ),
        ];
        if (targetFavoriteId) {
          requests.push(loadGoalWorkspace(targetFavoriteId));
          requests.push(loadReportWorkspace(targetFavoriteId));
        } else {
          setGoalWorkspace(undefined);
          setReportWorkspace(undefined);
        }
        await Promise.all(requests);
      } catch (error: any) {
        setActionError(
          getRequestErrorMessage(error, '个人职业成长报告数据加载失败。'),
        );
      } finally {
        setPageLoading(false);
      }
    },
    [favoriteId, loadGoalWorkspace, loadReportWorkspace],
  );

  useEffect(() => {
    void refreshPageData(favoriteId);
  }, [favoriteId, refreshPageData]);

  useEffect(() => {
    if (!favoriteId) {
      setSectionHtmlMap(emptyHtmlMap);
      setDirty(false);
      return;
    }

    const draft = readPersonalGrowthDraft(
      favoriteId,
      reportWorkspace?.workspace_id,
    );
    if (draft?.markdown) {
      const draftMap = { ...emptyHtmlMap };
      parsePersonalGrowthMarkdown(draft.markdown).sections.forEach((section) => {
        draftMap[section.key] = markdownToHtml(section.content);
      });
      setSectionHtmlMap(draftMap);
      setDirty(true);
      return;
    }

    setSectionHtmlMap(sectionsToHtmlMap(reportWorkspace?.sections));
    setDirty(false);
  }, [
    favoriteId,
    reportWorkspace?.edited_markdown,
    reportWorkspace?.generated_markdown,
    reportWorkspace?.sections,
    reportWorkspace?.workspace_id,
  ]);

  useEffect(() => {
    if (!favoriteId) return;
    const draftMarkdown = htmlMapToMarkdown(sectionHtmlMap);
    if (!draftMarkdown || draftMarkdown === savedMarkdown.trim()) {
      clearPersonalGrowthDraft(favoriteId, reportWorkspace?.workspace_id);
      setDirty(false);
      return;
    }
    savePersonalGrowthDraft({
      favoriteId,
      workspaceId: reportWorkspace?.workspace_id,
      markdown: draftMarkdown,
      updatedAt: new Date().toISOString(),
    });
    setDirty(true);
  }, [favoriteId, reportWorkspace?.workspace_id, savedMarkdown, sectionHtmlMap]);

  const saveReport = useCallback(
    async (htmlMap = sectionHtmlMap) => {
      if (!favoriteId) return undefined;
      const nextSections = htmlMapToBackendSections(htmlMap);
      if (!nextSections.some((section) => section.content.trim())) {
        throw new Error('请保留报告章节内容后再保存。');
      }

      setSaving(true);
      setActionError(undefined);
      try {
        const response = await updatePersonalGrowthReportWorkspace(
          favoriteId,
          { sections: nextSections },
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
    [favoriteId, reportWorkspace?.workspace_id, sectionHtmlMap],
  );

  const restoreTemplate = useCallback((sectionKey?: PersonalGrowthSectionKey) => {
    if (!sectionKey) {
      setSectionHtmlMap((current) => {
        const nextMap = { ...current };
        PERSONAL_GROWTH_SECTION_ORDER.forEach((key) => {
          nextMap[key] = markdownToHtml(createPersonalGrowthSectionTemplate(key));
        });
        return nextMap;
      });
      message.info('已恢复报告结构模板。');
      return;
    }

    setSectionHtmlMap((current) => ({
      ...current,
      [sectionKey]: markdownToHtml(createPersonalGrowthSectionTemplate(sectionKey)),
    }));
    message.info('已恢复报告结构模板。');
  }, []);

  const regenerateReport = useCallback(async () => {
    if (!favoriteId) return undefined;
    setRegenerating(true);
    setActionError(undefined);
    try {
      clearPersonalGrowthDraft(favoriteId, reportWorkspace?.workspace_id);
      const response = await regeneratePersonalGrowthReport(
        favoriteId,
        { overwrite_current: true },
        { skipErrorHandler: true },
      );
      setReportWorkspace(response?.data);
      return response?.data;
    } catch (error: any) {
      setActionError(
        getRequestErrorMessage(error, '重新生成个人职业成长报告失败。'),
      );
      throw error;
    } finally {
      setRegenerating(false);
    }
  }, [favoriteId, reportWorkspace?.workspace_id]);

  return {
    pageLoading,
    homePayload,
    latestAnalysis,
    goalWorkspace,
    reportWorkspace,
    setReportWorkspace,
    sectionHtmlMap,
    setSectionHtmlMap,
    sections,
    dirty,
    saving,
    regenerating,
    actionError,
    setActionError,
    savedMarkdown,
    refreshPageData,
    saveReport,
    restoreTemplate,
    regenerateReport,
  };
}
