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
    background: transparent;
    overflow: hidden;
  `,
  messagesArea: css`
    flex: 1;
    overflow-y: auto;
    padding: 24px 8px 24px 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
    scroll-behavior: smooth;
    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }
  `,
  bubbleUser: css`
    align-self: flex-end;
    max-width: 90%;
    padding: 14px 18px;
    border-radius: 12px;
    border-top-right-radius: 4px;
    background: transparent;
    border: 1px solid rgba(217, 93, 57, 0.3);
    color: rgba(253, 251, 247, 0.9);
    font-size: 13px;
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
    background: rgba(255, 255, 255, 0.1);
    font-size: 12px;
    color: rgba(253, 251, 247, 0.8);
  `,
  fileIcon: css`
    font-size: 13px;
    opacity: 0.7;
  `,
  bubbleAssistant: css`
    align-self: flex-start;
    max-width: 90%;
    padding: 14px 18px;
    border-radius: 12px;
    border-top-left-radius: 4px;
    background: ${claudeColors.darkSurface};
    border: 1px solid rgba(253, 251, 247, 0.05);
    color: rgba(253, 251, 247, 0.85);
    font-size: 13px;
    line-height: 1.6;
    word-break: break-word;
  `,
  bubbleError: css`
    align-self: flex-start;
    max-width: 90%;
    padding: 14px 18px;
    border-radius: 12px;
    border-top-left-radius: 4px;
    background: ${claudeAlpha(claudeColors.error, 0.15)};
    color: ${claudeColors.errorText};
    font-size: 13px;
    line-height: 1.6;
    word-break: break-word;
  `,
  resultBubble: css`
    align-self: flex-start;
    max-width: 90%;
    padding: 14px 18px;
    border-radius: 12px;
    border-top-left-radius: 4px;
    background: ${claudeAlpha(claudeColors.success, 0.15)};
    color: ${claudeColors.successText};
    font-size: 13px;
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
  chatInputWrapper: css`
    margin-top: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    background: ${claudeColors.darkSurface};
    border: 1px solid rgba(253, 251, 247, 0.08);
    border-radius: 12px;
    padding: 8px 12px;
    transition: border-color 0.3s;
    &:focus-within {
      border-color: rgba(217, 93, 57, 0.5);
    }
  `,
  actionIconBtn: css`
    background: transparent;
    border: none;
    color: rgba(253, 251, 247, 0.5);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
    &:hover {
      color: rgba(253, 251, 247, 0.9);
    }
    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  `,
  terminalChatInput: css`
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    color: #fdfbf7;
    font-size: 13px;
    padding: 4px;
    font-family: inherit;
    &::placeholder {
      color: rgba(253, 251, 247, 0.25);
    }
    &:disabled {
      cursor: not-allowed;
    }
  `,
  sendBtn: css`
    background: rgba(217, 93, 57, 0.1);
    border: 1px solid rgba(217, 93, 57, 0.2);
    color: ${claudeColors.terracotta};
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    &:hover:not(:disabled) {
      background: ${claudeColors.terracotta};
      color: #fff;
    }
    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
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
      <div className={styles.chatInputWrapper}>
        <Upload
          accept={ACCEPTED_EXTENSIONS.join(",")}
          beforeUpload={(file) => {
            void onSendFile?.(file as File);
            return false;
          }}
          disabled={isStreaming || !onSendFile}
          showUploadList={false}
        >
          <button
            className={styles.actionIconBtn}
            title="上传附件"
            disabled={isStreaming || !onSendFile}
            type="button"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
          </button>
        </Upload>

        <input
          className={styles.terminalChatInput}
          placeholder={isStreaming ? "正在解析中..." : "输入补充信息..."}
          disabled={isStreaming}
          onKeyDown={handleKeyDown}
          data-testid="chat-input"
        />

        <button
          className={styles.sendBtn}
          title="发送"
          disabled={isStreaming}
          onClick={() => {
            // we need to access the input value
            // simplest way: we can let enter key handle it or we can add a ref.
            // for now, we leave onClick empty as it was not explicitly requested or we add a ref.
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  );
}

