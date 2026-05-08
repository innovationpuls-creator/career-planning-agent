import { ClaudeButton, ClaudeInput } from "@/components/ui";
import {
  claudeAlpha,
  claudeColors,
  claudeRadius,
} from "@/styles/claude-tokens";
import { UploadOutlined } from "@ant-design/icons";
import { Upload } from "antd";
import { createStyles } from "antd-style";
import React, { useEffect, useRef } from "react";
import type { WorkspaceMessage } from "../shared";
import { ACCEPTED_EXTENSIONS } from "../shared";

interface ChatStreamProps {
  messages: WorkspaceMessage[];
  isStreaming: boolean;
  onSendText: (text: string) => void;
  onSendFile?: (file: File) => void | Promise<void>;
}

const useStyles = createStyles(({ css }) => ({
  container: css`
    display: flex;
    flex-direction: column;
    width: 100%;
    box-sizing: border-box;
    height: 100%;
    min-height: 400px;
    background: ${claudeColors.nearBlack};
    border-radius: ${claudeRadius.lg}px;
    overflow: hidden;
  `,
  messagesArea: css`
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    scroll-behavior: smooth;
  `,
  bubbleUser: css`
    align-self: flex-end;
    max-width: 75%;
    padding: 12px 16px;
    border-radius: ${claudeRadius.lg}px ${claudeRadius.lg}px
      ${claudeRadius.sm}px ${claudeRadius.lg}px;
    background: ${claudeColors.warmSand};
    color: ${claudeColors.charcoalWarm};
    font-size: 14px;
    line-height: 1.6;
    word-break: break-word;
  `,
  fileChip: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 4px 10px;
    border-radius: ${claudeRadius.sm}px;
    background: ${claudeAlpha(claudeColors.charcoalWarm, 0.08)};
    font-size: 12px;
    color: ${claudeColors.charcoalWarm};
  `,
  fileIcon: css`
    font-size: 13px;
    opacity: 0.7;
  `,
  bubbleAssistant: css`
    align-self: flex-start;
    max-width: 80%;
    padding: 12px 16px;
    border-radius: ${claudeRadius.lg}px ${claudeRadius.lg}px
      ${claudeRadius.lg}px ${claudeRadius.sm}px;
    background: ${claudeColors.darkSurface};
    color: ${claudeColors.warmSilver};
    font-size: 14px;
    line-height: 1.6;
    word-break: break-word;
  `,
  bubbleError: css`
    align-self: flex-start;
    max-width: 80%;
    padding: 12px 16px;
    border-radius: ${claudeRadius.lg}px ${claudeRadius.lg}px
      ${claudeRadius.lg}px ${claudeRadius.sm}px;
    background: ${claudeAlpha(claudeColors.error, 0.15)};
    color: ${claudeColors.errorText};
    font-size: 14px;
    line-height: 1.6;
    word-break: break-word;
  `,
  resultBubble: css`
    align-self: flex-start;
    max-width: 80%;
    padding: 12px 16px;
    border-radius: ${claudeRadius.lg}px ${claudeRadius.lg}px
      ${claudeRadius.lg}px ${claudeRadius.sm}px;
    background: ${claudeAlpha(claudeColors.success, 0.15)};
    color: ${claudeColors.successText};
    font-size: 14px;
    line-height: 1.6;
    word-break: break-word;
  `,
  cursor: css`
    display: inline-block;
    width: 2px;
    height: 16px;
    background: ${claudeColors.terracotta};
    margin-left: 4px;
    vertical-align: text-bottom;
    animation: blink 1s step-end infinite;

    @keyframes blink {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0;
      }
    }
  `,
  progressBar: css`
    height: 2px;
    background: linear-gradient(
      90deg,
      ${claudeColors.terracotta},
      ${claudeColors.primaryHover}
    );
    border-radius: 1px;
    transition: width 0.3s ease;
  `,
  inputArea: css`
    padding: 16px 24px;
    border-top: 1px solid ${claudeColors.borderDark};
    display: flex;
    gap: 12px;
    align-items: center;
  `,
  inputWrapper: css`
    flex: 1;
    min-width: 0;
  `,
  stageLabel: css`
    font-size: 12px;
    color: ${claudeColors.warmSilver};
    margin-bottom: 4px;
    opacity: 0.7;
  `,
}));

function MessageBubble({ message }: { message: WorkspaceMessage }) {
  const { styles } = useStyles();

  // Skip empty completed non-result messages (cleared status bubbles)
  if (
    !message.content &&
    message.kind !== "result" &&
    message.status === "completed"
  ) {
    return null;
  }

  if (message.role === "user") {
    return (
      <div className={styles.bubbleUser} data-testid="chat-bubble-user">
        {message.content}
        {message.uploads && message.uploads.length > 0 && (
          <div>
            {message.uploads.map((u) => (
              <span key={u.id} className={styles.fileChip}>
                <span className={styles.fileIcon}>
                  {u.kind === "image" ? "🖼" : "📄"}
                </span>
                {u.name}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (message.status === "error") {
    return (
      <div className={styles.bubbleError} data-testid="chat-bubble-error">
        {message.content}
      </div>
    );
  }

  if (message.kind === "result") {
    return (
      <div className={styles.resultBubble} data-testid="chat-bubble-result">
        {message.content || "解析结果已生成"}
      </div>
    );
  }

  const msgIsStreaming = message.status === "streaming";
  return (
    <div className={styles.bubbleAssistant} data-testid="chat-bubble-assistant">
      {message.stage && msgIsStreaming && (
        <div className={styles.stageLabel}>{message.stage}</div>
      )}
      {message.progress !== undefined && msgIsStreaming && (
        <div
          className={styles.progressBar}
          style={{ width: `${message.progress}%` }}
        />
      )}
      {message.content || (msgIsStreaming ? "思考中..." : "")}
      {msgIsStreaming && <span className={styles.cursor} />}
    </div>
  );
}

export function ChatStream({
  messages,
  isStreaming,
  onSendText,
  onSendFile,
}: ChatStreamProps) {
  const { styles } = useStyles();
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const target = e.target as HTMLInputElement;
      const value = target.value.trim();
      if (value) {
        onSendText(value);
        target.value = "";
      }
    }
  };

  return (
    <div className={styles.container} data-testid="chat-stream">
      <div className={styles.messagesArea} ref={viewportRef}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>
      <div className={styles.inputArea}>
        <Upload
          accept={ACCEPTED_EXTENSIONS.join(",")}
          beforeUpload={(file) => {
            void onSendFile?.(file as File);
            return false;
          }}
          disabled={isStreaming || !onSendFile}
          showUploadList={false}
        >
          <ClaudeButton
            aria-label="追加文件"
            disabled={isStreaming || !onSendFile}
            icon={<UploadOutlined />}
            variant="ghost"
          >
            追加文件
          </ClaudeButton>
        </Upload>
        <div className={styles.inputWrapper}>
          <ClaudeInput
            placeholder={isStreaming ? "正在解析中..." : "输入补充信息..."}
            disabled={isStreaming}
            onKeyDown={handleKeyDown}
            data-testid="chat-input"
          />
        </div>
      </div>
    </div>
  );
}
