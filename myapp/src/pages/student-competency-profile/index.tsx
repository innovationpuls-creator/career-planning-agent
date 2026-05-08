import {
  ClaudeButton,
  FadeInWhenVisible,
  PageError,
  PageLoading,
} from "@/components/ui";
import { Space, Tabs } from "antd";
import React, { useCallback, useRef } from "react";
import { ChatStream } from "./components/ChatStream";
import { DimensionKeywordEditor } from "./components/DimensionKeywordEditor";
import { GapAnalysisPanel } from "./components/GapAnalysisPanel";
import { RadarScorePanel } from "./components/RadarScorePanel";
import { ResumeUploadZone } from "./components/ResumeUploadZone";
import { useCompetencyData } from "./hooks/useCompetencyData";
import { useResumeStream } from "./hooks/useResumeStream";
import { useStyles } from "./pageStyles";
import {
  buildConversation,
  buildDefaultProfile,
  buildId,
  DEFAULT_VALUE,
  getUploadKind,
  hasProfileResult,
  normalizeProfile,
  PROFILE_FIELDS,
  type ProfileKey,
  type ResultTabKey,
} from "./shared";
import "./tabs-global.css";

const StudentCompetencyProfilePage: React.FC = () => {
  const { styles } = useStyles();

  const competency = useCompetencyData();

  const uploadFilesRef = useRef<Record<string, File>>({});
  const sendTextRef = useRef<((text: string) => Promise<void>) | null>(null);

  const handleStreamComplete = useCallback(
    (data: {
      workspace_conversation_id?: string;
      dify_conversation_id?: string;
      last_message_id?: string;
      profile?: Record<string, string[]>;
      latest_analysis?: API.StudentCompetencyLatestAnalysisPayload;
    }) => {
      if (data.profile) {
        competency.setConversation((prev) => {
          const existing = prev.currentProfile || buildDefaultProfile();
          const incoming = normalizeProfile(data.profile);
          const merged = {} as Record<ProfileKey, string[]>;
          for (const key of PROFILE_FIELDS.map(([k]) => k)) {
            const existingKw = existing[key];
            const incomingKw = incoming[key];
            const incomingIsDefault =
              incomingKw.length === 0 ||
              (incomingKw.length === 1 && incomingKw[0] === DEFAULT_VALUE);
            merged[key] = incomingIsDefault ? existingKw : incomingKw;
          }
          return { ...prev, currentProfile: merged };
        });
      }
      if (data.latest_analysis) {
        competency.setLatestAnalysis(data.latest_analysis);
        competency.setActiveResultTab("result");
      }
      competency.setConversation((prev) => ({
        ...prev,
        id: data.workspace_conversation_id || prev.id,
        difyConversationId:
          data.dify_conversation_id || prev.difyConversationId,
        lastMessageId: data.last_message_id || prev.lastMessageId,
      }));
    },
    [competency]
  );

  const handleStreamMessagesChange = useCallback(
    (messages: import("./shared").WorkspaceMessage[]) => {
      competency.setConversation((prev) => ({
        ...prev,
        messages,
        updatedAt: new Date().toISOString(),
      }));
    },
    [competency.setConversation]
  );

  const stream = useResumeStream(
    competency.conversation,
    handleStreamComplete,
    handleStreamMessagesChange
  );

  const handleUpload = useCallback(
    (file: File) => {
      const kind = getUploadKind(file);
      if (!kind) return false;
      const uploadId = buildId("upload");
      uploadFilesRef.current[uploadId] = file;
      stream.reset();
      competency.setConversation((prev) => ({
        ...prev,
        messages: [],
      }));
      competency.setInteractionStage("workspace");
      // Auto-send the file to the backend stream
      const send = sendTextRef.current;
      if (send) {
        queueMicrotask(() => {
          send("");
        });
      }
      return true;
    },
    [competency, stream]
  );

  const handleSendText = useCallback(
    async (text: string) => {
      const effectiveId = competency.conversation.id || buildConversation().id;
      if (!competency.conversation.id) {
        competency.setConversation((prev) => ({
          ...prev,
          id: effectiveId,
        }));
      }
      const formData = new FormData();
      formData.append("prompt", text);
      formData.append("workspace_conversation_id", effectiveId);
      if (competency.conversation.difyConversationId) {
        formData.append(
          "dify_conversation_id",
          competency.conversation.difyConversationId
        );
      }
      const fileEntries = Object.entries(uploadFilesRef.current);
      fileEntries.forEach(([, file]) => {
        formData.append("document_files", file);
      });
      if (fileEntries.length > 0) {
        const meta = fileEntries.map(([, f]) => ({
          name: f.name,
          size: f.size,
          type: f.type,
        }));
        formData.append("_file_meta", JSON.stringify(meta));
      }
      uploadFilesRef.current = {};
      await stream.sendMessage(formData);
    },
    [competency.conversation, stream]
  );
  sendTextRef.current = handleSendText;

  const handleSendFile = useCallback(
    async (file: File) => {
      const kind = getUploadKind(file);
      if (!kind) return;

      const effectiveId = competency.conversation.id || buildConversation().id;
      if (!competency.conversation.id) {
        competency.setConversation((prev) => ({
          ...prev,
          id: effectiveId,
        }));
      }

      const formData = new FormData();
      formData.append("prompt", "");
      formData.append("workspace_conversation_id", effectiveId);
      if (competency.conversation.difyConversationId) {
        formData.append(
          "dify_conversation_id",
          competency.conversation.difyConversationId
        );
      }
      formData.append("document_files", file);
      formData.append(
        "_file_meta",
        JSON.stringify([
          {
            name: file.name,
            size: file.size,
            type: file.type,
          },
        ])
      );
      competency.setInteractionStage("workspace");
      await stream.sendMessage(formData);
    },
    [competency.conversation, stream]
  );

  const hasResult = hasProfileResult(
    competency.conversation.currentProfile || competency.currentProfile
  );

  if (competency.loading) return <PageLoading />;
  if (competency.error) return <PageError message={competency.error} />;

  return (
    <div className={styles.shell}>
      <div className={styles.page}>
        {!hasResult && !stream.isStreaming && (
          <FadeInWhenVisible>
            <div className={styles.uploadSection}>
              <ResumeUploadZone
                onUpload={handleUpload}
                disabled={stream.isStreaming}
              />
            </div>
          </FadeInWhenVisible>
        )}

        {(stream.messages.length > 0 ||
          competency.interactionStage === "workspace") && (
          <FadeInWhenVisible>
            <div className={styles.section}>
              <ChatStream
                messages={stream.messages}
                isStreaming={stream.isStreaming}
                onSendText={handleSendText}
                onSendFile={handleSendFile}
              />
            </div>
          </FadeInWhenVisible>
        )}

        {hasResult && (
          <FadeInWhenVisible>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: 12,
              }}
            >
              <ClaudeButton
                variant="ghost"
                onClick={async () => {
                  const shouldResetStream = await competency.reset();
                  if (shouldResetStream) stream.reset();
                }}
              >
                重新解析
              </ClaudeButton>
            </div>
            <Tabs
              className={styles.tabs}
              activeKey={competency.activeResultTab}
              onChange={(key) =>
                competency.setActiveResultTab(key as ResultTabKey)
              }
              items={[
                {
                  key: "result",
                  label: "能力雷达",
                  children: (
                    <RadarScorePanel
                      scores={competency.analysis.chart_series}
                      onDimensionClick={competency.setActiveGapKey}
                    />
                  ),
                },
                {
                  key: "advice",
                  label: "差距分析",
                  children: (
                    <GapAnalysisPanel
                      advices={competency.analysis.action_advices}
                      priorityGaps={competency.analysis.priority_gap_dimensions}
                      activeGapKey={competency.activeGapKey}
                      onGapSelect={competency.setActiveGapKey}
                    />
                  ),
                },
                {
                  key: "keyword",
                  label: "关键字提取",
                  children: (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          marginBottom: 12,
                        }}
                      >
                        {competency.isEditing ? (
                          <Space>
                            <ClaudeButton
                              variant="ghost"
                              onClick={competency.cancelEdit}
                            >
                              取消
                            </ClaudeButton>
                            <ClaudeButton
                              variant="terracotta"
                              onClick={() =>
                                competency.save(
                                  competency.conversation.id,
                                  competency.conversation.difyConversationId
                                )
                              }
                            >
                              保存
                            </ClaudeButton>
                          </Space>
                        ) : (
                          <ClaudeButton
                            variant="warm-sand"
                            onClick={competency.startEdit}
                          >
                            编辑
                          </ClaudeButton>
                        )}
                      </div>
                      <DimensionKeywordEditor
                        dimensions={competency.editorProfile}
                        tagInputs={competency.tagInputs}
                        isEditing={competency.isEditing}
                        onUpdateTagInput={competency.updateTagInput}
                        onAddTag={competency.addTag}
                        onRemoveTag={competency.removeTag}
                      />
                    </div>
                  ),
                },
              ]}
            />
          </FadeInWhenVisible>
        )}
      </div>
    </div>
  );
};

export default StudentCompetencyProfilePage;
