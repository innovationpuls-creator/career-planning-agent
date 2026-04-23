import {
  CheckCircleFilled,
  ClockCircleFilled,
  ExclamationCircleFilled,
  FileSearchOutlined,
  FileTextOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Drawer, Progress, Space, Steps, Tag, Timeline, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useMemo, useState } from 'react';
import { STAGE_LABEL_MAP, formatTimestamp, normalizeProcessContent } from '../shared';
import type {
  WorkspaceConversation,
  WorkspaceMessage,
  WorkspaceStage,
  WorkspaceUpload,
  WorkspaceViewState,
} from '../shared';

const useStyles = createStyles(({ css, token }) => ({
  panel: css`
    display: grid;
    gap: 16px;
    min-height: 0;
  `,
  summaryCard: css`
    min-height: 104px;
    padding: 18px 20px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: ${token.colorBgContainer};
    box-shadow: 0 6px 18px rgba(15, 35, 70, 0.035);
  `,
  summaryHead: css`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
  `,
  summaryTitle: css`
    margin: 0;
    color: ${token.colorText};
    font-size: 17px !important;
    font-weight: 600 !important;
  `,
  summaryMain: css`
    min-width: 0;
  `,
  summaryFile: css`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 15px;
    color: ${token.colorTextSecondary};
  `,
  summaryIcon: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    border-radius: 8px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-size: 17px;
  `,
  summaryProgress: css`
    margin-top: 8px;
  `,
  processCard: css`
    padding: 18px 20px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: ${token.colorBgContainer};
    box-shadow: 0 6px 18px rgba(15, 35, 70, 0.035);
  `,
  processHint: css`
    padding: 14px 16px;
    border: 1px dashed ${token.colorBorder};
    border-radius: 12px;
    background: ${token.colorFillTertiary};
  `,
  sectionTitle: css`
    margin: 0 0 14px;
    color: ${token.colorText};
    font-size: 17px !important;
    font-weight: 600 !important;
  `,
  detailToggle: css`
    margin-top: 6px;
  `,
  detailViewport: css`
    max-height: calc(100vh - 180px);
    overflow-y: auto;
    padding-right: 4px;
  `,
  timeline: css`
    :global(.ant-timeline-item-tail) {
      inset-inline-start: 7px;
      border-inline-start-color: ${token.colorBorderSecondary};
    }

    :global(.ant-timeline-item-head) {
      inset-inline-start: 0;
      background: transparent;
      border: 0;
    }

    :global(.ant-timeline-item-content) {
      inset-inline-start: 26px;
    }
  `,
  steps: css`
    :global(.ant-steps-item-title) {
      color: ${token.colorText};
      font-weight: 500;
    }

    :global(.ant-steps-item-description) {
      color: ${token.colorTextSecondary};
    }

    :global(.ant-steps-item-tail::after) {
      background-color: ${token.colorPrimaryBorder} !important;
    }
  `,
  timelineItem: css`
    display: grid;
    gap: 8px;
    padding-bottom: 14px;
  `,
  timelineHead: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  `,
  timelineBody: css`
    padding: 10px 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 10px;
    background: ${token.colorBgContainer};
  `,
  timelineUser: css`
    background: ${token.colorFillAlter};
  `,
  timelineSystem: css`
    background: ${token.colorFillQuaternary};
    border-color: transparent;
  `,
}));

type Props = {
  stage: WorkspaceStage;
  viewState: WorkspaceViewState;
  expanded?: boolean;
  summaryOnly?: boolean;
  conversation: WorkspaceConversation;
  composerUploads: WorkspaceUpload[];
  messagesViewportRef: React.RefObject<HTMLDivElement | null>;
};

type StepStatus = 'wait' | 'process' | 'finish' | 'error';

const getMessageTone = (message: WorkspaceMessage) => {
  if (message.role === 'user') return 'user';
  if (message.kind === 'result' || message.assetName) return 'result';
  return 'system';
};

const buildStepDescription = (time?: string, output?: string) => (
  <div style={{ display: 'grid', gap: 4, paddingTop: 2 }}>
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      {time ? formatTimestamp(time) : '--'}
    </Typography.Text>
    <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{output || '待处理'}</Typography.Text>
  </div>
);

const ProcessTimelinePanel: React.FC<Props> = ({
  stage,
  viewState,
  expanded = true,
  summaryOnly = false,
  conversation,
  composerUploads,
  messagesViewportRef,
}) => {
  const { styles, cx } = useStyles();
  const [detailOpen, setDetailOpen] = useState(false);
  const compact = !expanded;

  const latestUpload = useMemo(() => {
    if (composerUploads.length) return composerUploads[0];
    const uploads = [...conversation.messages].reverse().flatMap((message) => message.uploads || []);
    return uploads[0];
  }, [composerUploads, conversation.messages]);

  const latestUserMessage = useMemo(
    () => [...conversation.messages].reverse().find((message) => message.role === 'user'),
    [conversation.messages],
  );

  const latestStatusMessage = useMemo(
    () => [...conversation.messages].reverse().find((message) => message.kind === 'status'),
    [conversation.messages],
  );

  const latestResultMessage = useMemo(
    () => [...conversation.messages].reverse().find((message) => message.kind === 'result' || !!message.assetName),
    [conversation.messages],
  );

  const progress =
    latestStatusMessage?.progress ?? (conversation.currentProfile ? 100 : latestUpload ? 10 : 0);

  const supplementStatus: StepStatus = latestUserMessage ? 'finish' : latestUpload ? 'process' : 'wait';
  const processStatus: StepStatus =
    latestStatusMessage?.status === 'error'
      ? 'error'
      : latestStatusMessage?.status === 'streaming'
        ? 'process'
        : latestStatusMessage
          ? 'finish'
          : 'wait';
  const resultStatus: StepStatus =
    latestResultMessage || conversation.currentProfile
      ? 'finish'
      : latestStatusMessage?.status === 'error'
        ? 'wait'
        : latestStatusMessage
          ? 'process'
          : 'wait';

  const hasMessages = conversation.messages.length > 0;
  const showSteps = viewState !== 'empty';

  const stepsCard = (
    <div className={styles.processCard}>
      <Typography.Title level={5} className={styles.sectionTitle}>
        {compact ? '过程概览' : '过程记录'}
      </Typography.Title>

      {showSteps ? (
        <Steps
          className={styles.steps}
          direction="vertical"
          size="small"
          current={
            resultStatus === 'finish'
              ? 2
              : processStatus === 'process' || processStatus === 'finish'
                ? 1
                : supplementStatus === 'finish' || supplementStatus === 'process'
                  ? 0
                  : -1
          }
          items={[
            {
              title: '补充描述',
              status: supplementStatus,
              description: buildStepDescription(
                latestUserMessage?.createdAt || latestUpload?.createdAt,
                latestUserMessage?.content || latestUpload?.name || '已准备好解析输入',
              ),
            },
            {
              title: '解析过程',
              status: processStatus,
              description: buildStepDescription(
                latestStatusMessage?.createdAt,
                latestStatusMessage
                  ? normalizeProcessContent(
                      latestStatusMessage.stage,
                      latestStatusMessage.content,
                      latestStatusMessage.status,
                    )
                  : compact
                    ? '等待开始解析'
                    : '上传后开始提取简历信息',
              ),
            },
            {
              title: '生成结果',
              status: resultStatus,
              description: buildStepDescription(
                latestResultMessage?.createdAt || conversation.updatedAt,
                latestResultMessage?.assetName || (conversation.currentProfile ? '已完成结果输出' : '等待生成结果'),
              ),
            },
          ]}
        />
      ) : (
        <div className={styles.processHint}>
          <Typography.Text type="secondary">开始解析后显示过程记录</Typography.Text>
        </div>
      )}

      {hasMessages && !summaryOnly ? (
        <>
          <div className={styles.detailToggle}>
            <Button type="link" icon={<FileSearchOutlined />} onClick={() => setDetailOpen(true)}>
              查看过程明细
            </Button>
          </div>

          <Drawer title="过程明细" open={detailOpen} width={520} onClose={() => setDetailOpen(false)} destroyOnClose>
            <div ref={messagesViewportRef} className={styles.detailViewport}>
              <Timeline
                className={styles.timeline}
                items={conversation.messages.map((message) => {
                  const tone = getMessageTone(message);
                  const stageLabel = message.stage ? STAGE_LABEL_MAP[message.stage] || message.stage : undefined;
                  const dot =
                    message.role === 'user' ? (
                      <UserOutlined style={{ color: '#8c8c8c' }} />
                    ) : message.status === 'error' ? (
                      <ExclamationCircleFilled style={{ color: '#ff4d4f' }} />
                    ) : message.status === 'streaming' ? (
                      <ClockCircleFilled style={{ color: '#1677ff' }} />
                    ) : (
                      <CheckCircleFilled style={{ color: tone === 'result' ? '#52c41a' : '#8c8c8c' }} />
                    );

                  const normalizedContent =
                    tone === 'system'
                      ? normalizeProcessContent(message.stage, message.content, message.status)
                      : message.content;

                  return {
                    key: message.id,
                    dot,
                    children: (
                      <div className={styles.timelineItem}>
                        <div className={styles.timelineHead}>
                          <Space size={[8, 8]} wrap>
                            <Typography.Text strong>
                              {message.role === 'user' ? '补充描述' : tone === 'result' ? '生成结果' : '过程记录'}
                            </Typography.Text>
                            {stageLabel && tone === 'system' ? <Tag>{stageLabel}</Tag> : null}
                          </Space>
                          <Typography.Text type="secondary">{formatTimestamp(message.createdAt)}</Typography.Text>
                        </div>
                        <div
                          className={cx(
                            styles.timelineBody,
                            tone === 'user' ? styles.timelineUser : undefined,
                            tone === 'system' ? styles.timelineSystem : undefined,
                          )}
                        >
                          {tone === 'result' ? (
                            <div className={styles.summaryFile}>
                              <FileTextOutlined style={{ color: '#1677ff' }} />
                              <Typography.Text>{message.assetName || '解析结果'}</Typography.Text>
                            </div>
                          ) : (
                            <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                              {normalizedContent}
                            </Typography.Paragraph>
                          )}
                        </div>
                      </div>
                    ),
                  };
                })}
              />
            </div>
          </Drawer>
        </>
      ) : null}
    </div>
  );

  if (summaryOnly) {
    const hasCompletedProfile = !!conversation.currentProfile;
    const statusTag =
      latestStatusMessage?.status === 'error'
        ? '失败'
        : stage === 'edit'
          ? '编辑中'
          : latestResultMessage || hasCompletedProfile
            ? '已完成'
            : latestStatusMessage?.status === 'streaming'
              ? '解析中'
              : '待解析';
    const statusColor =
      latestStatusMessage?.status === 'error'
        ? 'error'
        : stage === 'edit'
          ? 'processing'
          : latestResultMessage || hasCompletedProfile
            ? 'success'
            : latestStatusMessage?.status === 'streaming'
              ? 'processing'
              : 'default';

    return (
      <div className={styles.panel}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryHead}>
            <div className={styles.summaryMain}>
              <Typography.Title level={5} className={styles.summaryTitle}>
                当前解析对象
              </Typography.Title>
              {latestResultMessage ? (
                <div className={styles.summaryFile}>
                  <span className={styles.summaryIcon}>
                    <FileTextOutlined />
                  </span>
                  <Typography.Text>{latestResultMessage.assetName}</Typography.Text>
                </div>
              ) : hasCompletedProfile ? (
                <div className={styles.summaryFile}>
                  <span className={styles.summaryIcon}>
                    <FileTextOutlined />
                  </span>
                  <Typography.Text>简历解析结果</Typography.Text>
                </div>
              ) : latestUpload ? (
                <div className={styles.summaryFile}>
                  <span className={styles.summaryIcon}>
                    <FileTextOutlined />
                  </span>
                  <Typography.Text>{latestUpload.name}</Typography.Text>
                </div>
              ) : (
                <div className={styles.summaryFile}>
                  <span className={styles.summaryIcon}>
                    <FileTextOutlined />
                  </span>
                  <Typography.Text type="secondary">暂无上传文件</Typography.Text>
                </div>
              )}
            </div>
            <Tag color={statusColor}>{statusTag}</Tag>
          </div>
          {viewState === 'parsing' ? (
            <Progress
              percent={progress}
              size="small"
              showInfo={false}
              status={latestStatusMessage?.status === 'error' ? 'exception' : 'active'}
              className={styles.summaryProgress}
            />
          ) : null}
        </div>
      </div>
    );
  }

  return <div className={styles.panel}>{stepsCard}</div>;
};

export default ProcessTimelinePanel;
