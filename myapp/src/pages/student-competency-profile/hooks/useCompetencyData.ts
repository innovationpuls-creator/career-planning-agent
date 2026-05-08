import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteStudentCompetencyLatestAnalysis,
  getStudentCompetencyConversation,
  getStudentCompetencyLatestAnalysis,
  syncStudentCompetencyResult,
} from '@/services/ant-design-pro/api';
import {
  buildDefaultProfile,
  clearSnapshot,
  cloneProfile,
  DEFAULT_TITLE,
  DEFAULT_VALUE,
  emptyLatestAnalysis,
  extractRequestError,
  hasMeaningfulValues,
  hasProfileResult,
  type InteractionStage,
  type JobProfileDimensions,
  normalizeProfile,
  type ProfileKey,
  type ResultTabKey,
  restoreSnapshot,
  SNAPSHOT_VERSION,
  saveSnapshot,
  stripFilesFromConversation,
  type WorkspaceConversation,
} from '../shared';

interface UseCompetencyDataResult {
  analysis: API.StudentCompetencyLatestAnalysisPayload;
  currentProfile: JobProfileDimensions;
  editorProfile: JobProfileDimensions;
  tagInputs: Partial<Record<ProfileKey, string>>;
  loading: boolean;
  isEditing: boolean;
  isSaving: boolean;
  error: string | null;
  conversation: WorkspaceConversation;
  interactionStage: InteractionStage;
  activeResultTab: ResultTabKey;
  activeGapKey: string | undefined;
  startEdit: () => void;
  cancelEdit: () => void;
  save: (
    conversationId: string,
    difyConversationId: string | undefined,
  ) => Promise<void>;
  reset: () => Promise<boolean>;
  updateTagInput: (key: ProfileKey, value: string) => void;
  addTag: (key: ProfileKey) => void;
  removeTag: (key: ProfileKey, value: string) => void;
  setActiveResultTab: (tab: ResultTabKey) => void;
  setActiveGapKey: (key: string | undefined) => void;
  setInteractionStage: (stage: InteractionStage) => void;
  setConversation: React.Dispatch<React.SetStateAction<WorkspaceConversation>>;
  setLatestAnalysis: React.Dispatch<
    React.SetStateAction<API.StudentCompetencyLatestAnalysisPayload>
  >;
}

export function useCompetencyData(): UseCompetencyDataResult {
  const defaultProfileRef = useRef<JobProfileDimensions>(buildDefaultProfile());
  const [analysis, setAnalysis] =
    useState<API.StudentCompetencyLatestAnalysisPayload>(() =>
      emptyLatestAnalysis(),
    );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<WorkspaceConversation>(
    () => {
      const snapshot = restoreSnapshot();
      return (
        snapshot?.conversation || {
          id: '',
          title: DEFAULT_TITLE,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
        }
      );
    },
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editorProfile, setEditorProfile] = useState<JobProfileDimensions>(
    buildDefaultProfile(),
  );
  const [tagInputs, setTagInputs] = useState<
    Partial<Record<ProfileKey, string>>
  >({});
  const [interactionStage, setInteractionStage] = useState<InteractionStage>(
    () => {
      const snapshot = restoreSnapshot();
      return (snapshot?.interactionStage as InteractionStage) || 'empty';
    },
  );
  const [activeResultTab, setActiveResultTab] = useState<ResultTabKey>(() => {
    const snapshot = restoreSnapshot();
    return snapshot?.activeResultTab || 'result';
  });
  const [activeGapKey, setActiveGapKey] = useState<string | undefined>(() => {
    const snapshot = restoreSnapshot();
    return snapshot?.activeGapKey;
  });

  const currentProfile =
    conversation.currentProfile || defaultProfileRef.current;

  useEffect(() => {
    let mounted = true;

    const snapshot = restoreSnapshot();
    if (snapshot?.latestAnalysis) {
      setAnalysis(snapshot.latestAnalysis);
    }

    const loadLatest = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getStudentCompetencyLatestAnalysis({
          skipErrorHandler: true,
        });
        if (!mounted) return;
        setAnalysis(res.data);

        if (res.data.available && res.data.workspace_conversation_id) {
          setInteractionStage('workspace');
          const conversationId = res.data.workspace_conversation_id;
          setConversation((prev) => ({
            ...prev,
            id: conversationId,
            title: DEFAULT_TITLE,
            updatedAt: res.data.updated_at || new Date().toISOString(),
            currentProfile: normalizeProfile(res.data.profile),
          }));

          try {
            const convRes = await getStudentCompetencyConversation(
              conversationId,
              { skipErrorHandler: true },
            );
            if (!mounted) return;
            setConversation((prev) => ({
              ...prev,
              id: conversationId,
              difyConversationId: convRes.data.dify_conversation_id,
              lastMessageId: convRes.data.last_message_id,
              currentProfile: normalizeProfile(convRes.data.profile),
              updatedAt: convRes.data.updated_at || prev.updatedAt,
            }));
          } catch (convErr) {
            if (mounted) {
              console.warn(
                'Failed to load student competency conversation',
                convErr,
              );
            }
          }
        }
      } catch (err: unknown) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : extractRequestError(err));
        setAnalysis(
          emptyLatestAnalysis(`加载最新结果失败：${extractRequestError(err)}`),
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadLatest();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setEditorProfile(cloneProfile(currentProfile));
    setTagInputs({});
  }, [currentProfile]);

  useEffect(() => {
    const nextGapKey =
      analysis.priority_gap_dimensions?.[0] ||
      analysis.action_advices?.[0]?.key ||
      analysis.comparison_dimensions?.[0]?.key;
    if (nextGapKey) {
      setActiveGapKey((current) => current || nextGapKey);
    }
  }, [analysis]);

  useEffect(() => {
    const hasContent =
      conversation.messages.length > 0 ||
      hasProfileResult(conversation.currentProfile) ||
      analysis.available;
    if (!hasContent) {
      clearSnapshot();
      return;
    }
    saveSnapshot({
      version: SNAPSHOT_VERSION,
      conversation: stripFilesFromConversation(conversation),
      interactionStage,
      latestAnalysis: analysis,
      activeResultTab,
      activeGapKey,
      savedAt: new Date().toISOString(),
    });
  }, [conversation, interactionStage, analysis, activeResultTab, activeGapKey]);

  const startEdit = useCallback(() => {
    setIsEditing(true);
    setActiveResultTab('result');
  }, []);

  const cancelEdit = useCallback(() => {
    setEditorProfile(cloneProfile(currentProfile));
    setTagInputs({});
    setIsEditing(false);
  }, [currentProfile]);

  const save = useCallback(
    async (conversationId: string, difyConversationId: string | undefined) => {
      setIsSaving(true);
      try {
        const res = await syncStudentCompetencyResult(
          {
            workspace_conversation_id: conversationId,
            dify_conversation_id: difyConversationId,
            profile: editorProfile,
          },
          { skipErrorHandler: true },
        );

        setConversation((prev) => ({
          ...prev,
          id: res.data.workspace_conversation_id,
          difyConversationId: res.data.dify_conversation_id,
          lastMessageId: res.data.last_message_id,
          currentProfile: normalizeProfile(res.data.profile),
          updatedAt: new Date().toISOString(),
        }));
        if (res.data.latest_analysis) {
          setAnalysis(res.data.latest_analysis);
        }
        setIsEditing(false);
      } catch (err) {
        throw new Error(extractRequestError(err));
      } finally {
        setIsSaving(false);
      }
    },
    [editorProfile],
  );

  const reset = useCallback(async () => {
    // Clear localStorage FIRST to prevent the saveSnapshot effect from re-persisting stale data
    clearSnapshot();

    try {
      await deleteStudentCompetencyLatestAnalysis({ skipErrorHandler: true });
    } catch (err) {
      console.warn('Failed to delete latest student competency analysis', err);
    }
    setAnalysis(emptyLatestAnalysis());
    setEditorProfile(buildDefaultProfile());
    setTagInputs({});
    setIsEditing(false);
    setActiveResultTab('result');
    setActiveGapKey(undefined);
    setConversation({
      id: '',
      title: DEFAULT_TITLE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    });
    setInteractionStage('empty');
    return true;
  }, []);

  const updateTagInput = useCallback((key: ProfileKey, value: string) => {
    setTagInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const addTag = useCallback(
    (key: ProfileKey) => {
      const rawValue = (tagInputs[key] || '').trim();
      if (!rawValue) return;
      setEditorProfile((prev) => {
        const next = cloneProfile(prev);
        const values = next[key].filter((item) => hasMeaningfulValues([item]));
        if (!values.includes(rawValue)) {
          next[key] = [...values, rawValue];
        }
        return next;
      });
      setTagInputs((prev) => ({ ...prev, [key]: '' }));
    },
    [tagInputs],
  );

  const removeTag = useCallback((key: ProfileKey, value: string) => {
    setEditorProfile((prev) => {
      const next = cloneProfile(prev);
      const values = next[key].filter((item) => item !== value);
      next[key] = values.length ? values : [DEFAULT_VALUE];
      return next;
    });
  }, []);

  return {
    analysis,
    currentProfile,
    editorProfile,
    tagInputs,
    loading,
    isEditing,
    isSaving,
    error,
    conversation,
    interactionStage,
    activeResultTab,
    activeGapKey,
    startEdit,
    cancelEdit,
    save,
    reset,
    updateTagInput,
    addTag,
    removeTag,
    setActiveResultTab,
    setActiveGapKey,
    setInteractionStage,
    setConversation,
    setLatestAnalysis: setAnalysis,
  };
}
