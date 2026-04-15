import { Upload, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ResumeMatchWorkspace from './components/ResumeMatchWorkspace';
import { goToSnailLearningPath } from '../career-development-report/learning-path/learningPathUtils';
import ResumeParsingWorkspace from './components/ResumeParsingWorkspace';
import {
  createCareerDevelopmentFavorite,
  deleteCareerDevelopmentFavorite,
  deleteStudentCompetencyLatestAnalysis,
  getCareerDevelopmentFavorites,
  getCareerDevelopmentMatchInit,
  getStudentCompetencyConversation,
  getStudentCompetencyLatestAnalysis,
  getStudentCompetencyRuntime,
  streamStudentCompetencyChat,
  syncStudentCompetencyResult,
} from '@/services/ant-design-pro/api';
import {
  DEFAULT_VALUE,
  DEFAULT_TITLE,
  appendStreamLine,
  buildConversation,
  buildDefaultProfile,
  buildId,
  cloneProfile,
  emptyLatestAnalysis,
  extractRequestError,
  getUploadKind,
  hasMeaningfulValues,
  hasProfileResult,
  normalizeProfile,
  toRuntimeFields,
  type JobProfileDimensions,
  type ProfileKey,
  type ResultTabKey,
  type RuntimeConfig,
  type WorkspaceConversation,
  type WorkspaceMessage,
  type WorkspaceUpload,
  type WorkspaceViewState,
} from './shared';

type ModuleKey = 'resume' | 'career';

const buildFavoriteTargetKey = (report: API.CareerDevelopmentMatchReport) =>
  `${report.canonical_job_title}::${report.industry || ''}`;

const StudentCompetencyProfilePage: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ModuleKey>('resume');
  const [conversation, setConversation] = useState<WorkspaceConversation>(buildConversation());
  const [composerValue, setComposerValue] = useState('');
  const [composerUploads, setComposerUploads] = useState<WorkspaceUpload[]>([]);
  const [composerError, setComposerError] = useState<string>();
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editorProfile, setEditorProfile] = useState<JobProfileDimensions>(buildDefaultProfile());
  const [tagInputs, setTagInputs] = useState<Partial<Record<ProfileKey, string>>>({});
  const [latestAnalysis, setLatestAnalysis] = useState<API.StudentCompetencyLatestAnalysisPayload>(() =>
    emptyLatestAnalysis(),
  );
  const [isLoadingLatestAnalysis, setIsLoadingLatestAnalysis] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState<ResultTabKey>('comparison');
  const [activeGapKey, setActiveGapKey] = useState<string>();

  const [careerMatchInit, setCareerMatchInit] = useState<API.CareerDevelopmentMatchInitPayload>();
  const [careerMatchLoading, setCareerMatchLoading] = useState(false);
  const [careerMatchError, setCareerMatchError] = useState<string>();
  const [careerFavorites, setCareerFavorites] = useState<API.CareerDevelopmentFavoritePayload[]>([]);
  const [activeRecommendationId, setActiveRecommendationId] = useState<string>();
  const [activeResultTabCareer, setActiveResultTabCareer] = useState<'comparison' | 'advice' | 'company'>('comparison');
  const [careerFavoriteSubmitting, setCareerFavoriteSubmitting] = useState(false);

  const uploadFilesRef = useRef<Record<string, File>>({});
  const streamControllerRef = useRef<AbortController | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const defaultProfileRef = useRef<JobProfileDimensions>(buildDefaultProfile());

  const currentProfile = conversation.currentProfile || defaultProfileRef.current;
  const readyUploads = composerUploads.filter((item) => item.status === 'ready');
  const canSubmit = !isSubmitting && (composerValue.trim().length > 0 || readyUploads.length > 0);
  const submitDisabledReason = !composerValue.trim() && readyUploads.length === 0 ? '请先上传文件或补充描述' : undefined;
  const runtimeFields = toRuntimeFields(runtimeConfig);

  const workspaceStage = isEditing ? 'edit' : hasProfileResult(currentProfile) ? 'view' : 'empty';
  const workspaceViewState: WorkspaceViewState = isEditing
    ? 'edit'
    : isSubmitting
      ? 'parsing'
      : hasProfileResult(currentProfile)
        ? 'completed'
        : 'empty';

  const recommendations = careerMatchInit?.recommendations || [];
  const activeRecommendation =
    recommendations.find((item) => item.report_id === activeRecommendationId) || recommendations[0];
  const activeRecommendationFavorite = activeRecommendation
    ? careerFavorites.find(
        (item) =>
          item.report_id === activeRecommendation.report_id ||
          item.target_key === buildFavoriteTargetKey(activeRecommendation),
      )
    : undefined;

  const loadCareerMatchData = useCallback(async () => {
    setCareerMatchLoading(true);
    setCareerMatchError(undefined);
    try {
      const [initRes, favoriteRes] = await Promise.all([
        getCareerDevelopmentMatchInit({ skipErrorHandler: true }),
        getCareerDevelopmentFavorites({ skipErrorHandler: true }),
      ]);
      setCareerMatchInit(initRes.data);
      setCareerFavorites(favoriteRes.data || []);
      setActiveRecommendationId((current) => {
        const nextRecommendations = initRes.data.recommendations || [];
        const stillExists = nextRecommendations.some((item) => item.report_id === current);
        if (stillExists) return current;
        return initRes.data.default_report_id || nextRecommendations[0]?.report_id;
      });
    } catch (err) {
      setCareerMatchError(extractRequestError(err));
      setCareerMatchInit(undefined);
      setActiveRecommendationId(undefined);
    } finally {
      setCareerMatchLoading(false);
    }
  }, []);

  useEffect(() => {
    getStudentCompetencyRuntime({ skipErrorHandler: true })
      .then((res) => setRuntimeConfig(res.data))
      .catch((err) => {
        message.error(`加载运行配置失败：${extractRequestError(err)}`);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadLatest = async () => {
      setIsLoadingLatestAnalysis(true);
      try {
        const res = await getStudentCompetencyLatestAnalysis({ skipErrorHandler: true });
        if (cancelled) return;
        setLatestAnalysis(res.data);

        if (res.data.available && res.data.workspace_conversation_id) {
          const conversationId = res.data.workspace_conversation_id;
          setConversation((current) => ({
            ...current,
            id: conversationId,
            title: DEFAULT_TITLE,
            updatedAt: res.data.updated_at || new Date().toISOString(),
            currentProfile: normalizeProfile(res.data.profile),
          }));

          try {
            const conversationRes = await getStudentCompetencyConversation(conversationId, { skipErrorHandler: true });
            if (cancelled) return;
            setConversation((current) => ({
              ...current,
              id: conversationId,
              difyConversationId: conversationRes.data.dify_conversation_id,
              lastMessageId: conversationRes.data.last_message_id,
              currentProfile: normalizeProfile(conversationRes.data.profile),
              updatedAt: conversationRes.data.updated_at || current.updatedAt,
            }));
          } catch {}
        }
      } catch (err) {
        if (!cancelled) {
          setLatestAnalysis(emptyLatestAnalysis(`加载最新结果失败：${extractRequestError(err)}`));
        }
      } finally {
        if (!cancelled) setIsLoadingLatestAnalysis(false);
      }
    };

    void loadLatest();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await loadCareerMatchData();
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [loadCareerMatchData]);

  useEffect(() => {
    setEditorProfile(cloneProfile(currentProfile));
    setTagInputs({});
  }, [currentProfile]);

  useEffect(() => {
    const nextGapKey =
      latestAnalysis.priority_gap_dimensions?.[0] ||
      latestAnalysis.action_advices?.[0]?.key ||
      latestAnalysis.comparison_dimensions?.[0]?.key;
    if (nextGapKey) {
      setActiveGapKey((current) => current || nextGapKey);
    }
  }, [latestAnalysis]);

  useEffect(() => {
    if (!activeRecommendation) return;
    const nextGapKey =
      activeRecommendation.priority_gap_dimensions?.[0] ||
      activeRecommendation.action_advices?.[0]?.key ||
      activeRecommendation.comparison_dimensions?.[0]?.key;
    if (nextGapKey) {
      setActiveGapKey(nextGapKey);
    }
  }, [activeRecommendation?.report_id]);

  useEffect(() => () => {
    streamControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [conversation.messages]);

  const updateConversationMessage = (messageId: string, updater: (message: WorkspaceMessage) => WorkspaceMessage) => {
    setConversation((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      messages: current.messages.map((messageItem) => (messageItem.id === messageId ? updater(messageItem) : messageItem)),
    }));
  };

  const handleQueueUpload = (file: File) => {
    setComposerError(undefined);
    const kind = getUploadKind(file);
    if (!kind) {
      setComposerError('不支持的文件类型');
      return Upload.LIST_IGNORE;
    }

    const maxLength = kind === 'image' ? runtimeConfig?.image_upload.max_length ?? 3 : runtimeConfig?.document_upload.max_length ?? 3;
    const readyCount = composerUploads.filter((item) => item.kind === kind && item.status === 'ready').length;
    if (readyCount >= maxLength) {
      setComposerError(`${kind === 'image' ? '图片' : '文档'}最多上传 ${maxLength} 个`);
      return Upload.LIST_IGNORE;
    }

    const uploadId = buildId('upload');
    uploadFilesRef.current[uploadId] = file;
    setComposerUploads((current) => [
      {
        id: uploadId,
        name: file.name,
        size: file.size,
        type: file.type,
        kind,
        status: 'ready',
        createdAt: new Date().toISOString(),
        file,
      },
      ...current,
    ]);
    return Upload.LIST_IGNORE;
  };

  const handleRemoveUpload = (uploadId: string) => {
    delete uploadFilesRef.current[uploadId];
    setComposerUploads((current) => current.filter((item) => item.id !== uploadId));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const prompt = composerValue.trim();
    const workspaceConversationId = conversation.id || buildId('conversation');
    const createdAt = new Date().toISOString();
    const userMessageId = buildId('user');
    const userMessage: WorkspaceMessage = {
      id: userMessageId,
      role: 'user',
      kind: 'chat',
      content: prompt || readyUploads.map((item) => item.name).join('、') || '上传文件开始解析',
      createdAt,
      status: 'completed',
      uploads: readyUploads,
    };

    setConversation((current) => ({
      ...current,
      id: workspaceConversationId,
      updatedAt: createdAt,
      messages: [...current.messages, userMessage],
    }));
    setIsSubmitting(true);
    setComposerError(undefined);

    const formData = new FormData();
    formData.append('workspace_conversation_id', workspaceConversationId);
    formData.append('prompt', prompt);
    if (conversation.difyConversationId) {
      formData.append('dify_conversation_id', conversation.difyConversationId);
    }
    readyUploads.forEach((item) => {
      const file = uploadFilesRef.current[item.id];
      if (!file) return;
      if (item.kind === 'image') {
        formData.append('image_files', file);
      } else {
        formData.append('document_files', file);
      }
    });

    const controller = new AbortController();
    streamControllerRef.current = controller;
    const assistantMessageId = buildId('assistant');

    setConversation((current) => ({
      ...current,
      messages: [
        ...current.messages,
        {
          id: assistantMessageId,
          role: 'assistant',
          kind: 'status',
          content: '',
          createdAt: new Date().toISOString(),
          status: 'streaming',
          stage: 'prepare',
          progress: 0,
        },
      ],
    }));

    try {
      for await (const event of streamStudentCompetencyChat(formData, controller.signal)) {
        if (event.event === 'meta') {
          updateConversationMessage(assistantMessageId, (messageItem) => ({
            ...messageItem,
            id: event.assistant_message_id,
            createdAt: event.created_at,
          }));
        }

        if (event.event === 'delta') {
          updateConversationMessage(event.assistant_message_id, (messageItem) => ({
            ...messageItem,
            kind: 'status',
            status: 'streaming',
            content: appendStreamLine(messageItem.content, event.delta),
            stage: event.stage,
            progress: event.progress,
            createdAt: event.created_at,
          }));
        }

        if (event.event === 'done') {
          const resultPayload = event.data;
          const updatedProfile = resultPayload.profile ? normalizeProfile(resultPayload.profile) : undefined;
          updateConversationMessage(event.assistant_message_id, (messageItem) => ({
            ...messageItem,
            status: 'completed',
            content: resultPayload.assistant_message,
          }));

          setConversation((current) => {
            const resultMessages =
              resultPayload.output_mode === 'profile'
                ? [
                    ...current.messages,
                    {
                      id: buildId('result'),
                      role: 'assistant',
                      kind: 'result',
                      content: resultPayload.assistant_message,
                      createdAt: new Date().toISOString(),
                      status: 'completed',
                      assetName: `简历解析结果-${Date.now()}.json`,
                    } as WorkspaceMessage,
                  ]
                : current.messages;

            return {
              ...current,
              id: resultPayload.workspace_conversation_id,
              difyConversationId: resultPayload.dify_conversation_id,
              lastMessageId: resultPayload.last_message_id,
              currentProfile: updatedProfile || current.currentProfile,
              updatedAt: new Date().toISOString(),
              messages: resultMessages,
            };
          });

          if (resultPayload.output_mode === 'profile' && resultPayload.latest_analysis) {
            setLatestAnalysis(resultPayload.latest_analysis);
            setActiveResultTab('result');
            setActiveGapKey(
              resultPayload.latest_analysis.priority_gap_dimensions?.[0] ||
                resultPayload.latest_analysis.action_advices?.[0]?.key,
            );
            void loadCareerMatchData();
          }
        }

        if (event.event === 'error') {
          updateConversationMessage(event.assistant_message_id, (messageItem) => ({
            ...messageItem,
            status: 'error',
            content: event.detail,
          }));
          throw new Error(event.detail);
        }
      }

      setComposerValue('');
      readyUploads.forEach((item) => {
        delete uploadFilesRef.current[item.id];
      });
      setComposerUploads([]);
    } catch (err) {
      const detail = extractRequestError(err);
      setComposerError(detail);
      message.error(`解析失败：${detail}`);
      setConversation((current) => ({
        ...current,
        updatedAt: new Date().toISOString(),
        messages: current.messages.map((messageItem) =>
          messageItem.id === assistantMessageId || (messageItem.kind === 'status' && messageItem.status === 'streaming')
            ? { ...messageItem, status: 'error', content: detail, stage: 'error' }
            : messageItem,
        ),
      }));
    } finally {
      setIsSubmitting(false);
      streamControllerRef.current = null;
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setActiveResultTab('result');
  };

  const handleCancelEdit = () => {
    setEditorProfile(cloneProfile(currentProfile));
    setTagInputs({});
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editorProfile) return;
    setIsSavingProfile(true);
    try {
      const res = await syncStudentCompetencyResult(
        {
          workspace_conversation_id: conversation.id,
          dify_conversation_id: conversation.difyConversationId,
          profile: editorProfile,
        },
        { skipErrorHandler: true },
      );

      setConversation((current) => ({
        ...current,
        id: res.data.workspace_conversation_id,
        difyConversationId: res.data.dify_conversation_id,
        lastMessageId: res.data.last_message_id,
        currentProfile: normalizeProfile(res.data.profile),
        updatedAt: new Date().toISOString(),
      }));
      if (res.data.latest_analysis) {
        setLatestAnalysis(res.data.latest_analysis);
      }
      void loadCareerMatchData();
      setIsEditing(false);
      message.success('结果已保存');
    } catch (err) {
      message.error(`保存失败：${extractRequestError(err)}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleResetConversation = async () => {
    try {
      await deleteStudentCompetencyLatestAnalysis({ skipErrorHandler: true });
    } catch {}

    streamControllerRef.current?.abort();
    uploadFilesRef.current = {};
    setConversation(buildConversation());
    setComposerValue('');
    setComposerUploads([]);
    setComposerError(undefined);
    setLatestAnalysis(emptyLatestAnalysis());
    setEditorProfile(buildDefaultProfile());
    setTagInputs({});
    setIsEditing(false);
    setActiveResultTab('comparison');
    setActiveGapKey(undefined);
    setCareerMatchInit(undefined);
    setActiveRecommendationId(undefined);
    void loadCareerMatchData();
    message.success('已重置解析');
  };

  const handleTagInputChange = (key: ProfileKey, value: string) => {
    setTagInputs((current) => ({ ...current, [key]: value }));
  };

  const handleAddTag = (key: ProfileKey) => {
    const rawValue = (tagInputs[key] || '').trim();
    if (!rawValue) return;
    setEditorProfile((current) => {
      const next = cloneProfile(current);
      const values = next[key].filter((item) => hasMeaningfulValues([item]));
      if (!values.includes(rawValue)) {
        next[key] = [...values, rawValue];
      }
      return next;
    });
    setTagInputs((current) => ({ ...current, [key]: '' }));
  };

  const handleRemoveTag = (key: ProfileKey, value: string) => {
    setEditorProfile((current) => {
      const next = cloneProfile(current);
      const values = next[key].filter((item) => item !== value);
      next[key] = values.length ? values : [DEFAULT_VALUE];
      return next;
    });
  };

  const handleToggleCareerFavorite = async () => {
    if (!activeRecommendation) return;
    setCareerFavoriteSubmitting(true);
    try {
      if (activeRecommendationFavorite) {
        await deleteCareerDevelopmentFavorite(activeRecommendationFavorite.favorite_id, { skipErrorHandler: true });
        setCareerFavorites((current) => current.filter((item) => item.favorite_id !== activeRecommendationFavorite.favorite_id));
        message.success('已取消收藏');
      } else {
        const res = await createCareerDevelopmentFavorite(
          {
            source_kind: 'recommendation',
            report: activeRecommendation,
          },
          { skipErrorHandler: true },
        );
        setCareerFavorites((current) => {
          const next = current.filter((item) => item.favorite_id !== res.data.favorite_id);
          return [...next, res.data];
        });
        message.success('已收藏结果');
      }
    } catch (err) {
      message.error(`操作失败：${extractRequestError(err)}`);
    } finally {
      setCareerFavoriteSubmitting(false);
    }
  };

  const handleGenerateCareerPlan = () => {
    if (!activeRecommendation) return;
    goToSnailLearningPath(activeRecommendation);
  };

  const careerWorkspace = (
    <ResumeMatchWorkspace
      sourceLabel={
        conversation.messages.find((item) => item.kind === 'result')?.assetName ||
        (hasProfileResult(currentProfile) ? '简历解析结果' : '当前12维画像')
      }
      sourceUpdatedAt={careerMatchInit?.source?.updated_at}
      activeDimensionCount={careerMatchInit?.source?.active_dimension_count}
      recommendations={recommendations}
      loading={careerMatchLoading}
      error={careerMatchError}
      available={careerMatchInit?.available}
      activeRecommendationId={activeRecommendationId}
      activeResultTab={activeResultTabCareer}
      activeGapKey={activeGapKey}
      favorite={activeRecommendationFavorite}
      favoriteSubmitting={careerFavoriteSubmitting}
      onRecommendationChange={setActiveRecommendationId}
      onResultTabChange={setActiveResultTabCareer}
      onActiveGapChange={setActiveGapKey}
      onToggleFavorite={handleToggleCareerFavorite}
      onGeneratePlan={handleGenerateCareerPlan}
    />
  );

  return (
    <ResumeParsingWorkspace
      activeModule={activeModule}
      onModuleChange={setActiveModule}
      careerWorkspace={careerWorkspace}
      stage={workspaceStage}
      viewState={workspaceViewState}
      conversation={conversation}
      runtimeFields={runtimeFields}
      currentProfile={currentProfile}
      editorProfile={editorProfile}
      tagInputs={tagInputs}
      composerValue={composerValue}
      composerUploads={composerUploads}
      composerError={composerError}
      submitDisabledReason={submitDisabledReason}
      canSubmit={canSubmit}
      isSubmitting={isSubmitting || isSavingProfile}
      fileUploadEnabled={runtimeConfig?.file_upload_enabled ?? true}
      analysis={latestAnalysis}
      analysisLoading={isLoadingLatestAnalysis}
      activeResultTab={activeResultTab}
      activeGapKey={activeGapKey}
      messagesViewportRef={messagesViewportRef}
      onComposerValueChange={setComposerValue}
      onRemoveUpload={handleRemoveUpload}
      onBeforeUpload={handleQueueUpload}
      onSubmit={handleSubmit}
      onTagInputChange={handleTagInputChange}
      onAddTag={handleAddTag}
      onRemoveTag={handleRemoveTag}
      onEdit={handleEdit}
      onSave={handleSave}
      onCancelEdit={handleCancelEdit}
      onResetConversation={handleResetConversation}
      onResultTabChange={setActiveResultTab}
      onActiveGapChange={setActiveGapKey}
    />
  );
};

export default StudentCompetencyProfilePage;
