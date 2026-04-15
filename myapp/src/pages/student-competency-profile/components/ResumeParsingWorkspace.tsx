import {
  EditOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  Button,
  Card,
  Col,
  Row,
  Segmented,
  Space,
  Tabs,
  Typography,
  type UploadProps,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useMemo } from 'react';
import LatestAnalysisSection from '../LatestAnalysisSection';
import type {
  JobProfileDimensions,
  ProfileKey,
  ResultTabKey,
  RuntimeField,
  WorkspaceConversation,
  WorkspaceStage,
  WorkspaceUpload,
  WorkspaceViewState,
} from '../shared';
import ProcessTimelinePanel from './ProcessTimelinePanel';
import ResumeComposer from './ResumeComposer';
import ResumeResultEditor from './ResumeResultEditor';

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    :global(.ant-pro-page-container-children-container) {
      padding-block: 0;
      padding-inline: 0;
    }
  `,
  shell: css`
    width: 100%;
    padding: 20px 24px 24px;
  `,
  frame: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  `,
  workspaceContainer: css`
    min-height: 600px;
    transition: opacity 0.2s ease;
  `,
  moduleSwitch: css`
    width: fit-content;

    :global(.ant-segmented-item):hover {
      color: ${token.colorPrimary};
    }

    :global(.ant-segmented-item-selected) {
      background-color: ${token.colorPrimary} !important;
    }
  `,
  pageHead: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  title: css`
    margin: 0;
  `,
  workspaceRow: css`
    align-items: stretch;
    width: 100%;
    flex-wrap: nowrap;

    @media (max-width: 1200px) {
      flex-wrap: wrap;
    }
  `,
  leftRail: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  `,
  leftSummary: css`
    flex: 0 0 auto;
  `,
  leftPrimary: css`
    flex: 0 0 auto;
  `,
  leftSecondary: css`
    flex: 0 0 auto;
  `,
  rightCard: css`
    width: 100%;
    min-width: 0;
    transition: box-shadow 0.2s ease;

    :global(.ant-card-body) {
      display: flex;
      flex-direction: column;
      gap: 0;
      padding: 12px 20px 16px;
    }
  `,
  tabs: css`
    width: 100%;
    min-width: 0;
    flex-shrink: 0;
    transition: all 0.2s ease;

    :global(.ant-tabs-nav) {
      margin-bottom: 0;
    }

    :global(.ant-tabs-tab) {
      transition: all 0.2s ease;
    }

    :global(.ant-tabs-tab:hover) {
      color: ${token.colorPrimary};
    }

    :global(.ant-tabs-tab-active) {
      color: ${token.colorPrimary};
    }
  `,
  tabPane: css`
    padding-top: 12px;
    padding-bottom: 4px;
    animation: fadeIn 0.2s ease;

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  actionButton: css`
    border-radius: 8px;
    transition: all 0.2s ease;

    :hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    :active {
      transform: translateY(0);
    }
  `,
  primaryActionButton: css`
    border-radius: 8px;
    transition: all 0.2s ease;

    :hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(22, 119, 255, 0.3);
    }

    :active {
      transform: translateY(0);
      box-shadow: none;
    }
  `,
}));

type ModuleKey = 'resume' | 'career';

type Props = {
  activeModule: ModuleKey;
  onModuleChange: (value: ModuleKey) => void;
  careerWorkspace?: React.ReactNode;
  stage: WorkspaceStage;
  viewState: WorkspaceViewState;
  conversation: WorkspaceConversation;
  runtimeFields: RuntimeField[];
  currentProfile: JobProfileDimensions;
  editorProfile: JobProfileDimensions;
  tagInputs: Partial<Record<ProfileKey, string>>;
  composerValue: string;
  composerUploads: WorkspaceUpload[];
  composerError?: string;
  submitDisabledReason?: string;
  canSubmit: boolean;
  isSubmitting: boolean;
  fileUploadEnabled: boolean;
  analysis?: API.StudentCompetencyLatestAnalysisPayload;
  analysisLoading?: boolean;
  activeResultTab: ResultTabKey;
  activeGapKey?: string;
  messagesViewportRef: React.RefObject<HTMLDivElement | null>;
  onComposerValueChange: (value: string) => void;
  onRemoveUpload: (uploadId: string) => void;
  onBeforeUpload: NonNullable<UploadProps['beforeUpload']>;
  onSubmit: () => void;
  onTagInputChange: (key: ProfileKey, value: string) => void;
  onAddTag: (key: ProfileKey) => void;
  onRemoveTag: (key: ProfileKey, value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onResetConversation: () => void;
  onResultTabChange: (key: ResultTabKey) => void;
  onActiveGapChange: (key: string) => void;
};

const ResumeParsingWorkspace: React.FC<Props> = ({
  activeModule,
  onModuleChange,
  careerWorkspace,
  stage,
  viewState,
  conversation,
  runtimeFields,
  currentProfile,
  editorProfile,
  tagInputs,
  composerValue,
  composerUploads,
  composerError,
  submitDisabledReason,
  canSubmit,
  isSubmitting,
  fileUploadEnabled,
  analysis,
  analysisLoading,
  activeResultTab,
  activeGapKey,
  messagesViewportRef,
  onComposerValueChange,
  onRemoveUpload,
  onBeforeUpload,
  onSubmit,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  onEdit,
  onSave,
  onCancelEdit,
  onResetConversation,
  onResultTabChange,
  onActiveGapChange,
}) => {
  const { styles } = useStyles();
  const editing = stage === 'edit';
  const processExpanded = viewState !== 'empty';

  const leftPrimary = processExpanded ? (
    <ProcessTimelinePanel
      stage={stage}
      viewState={viewState}
      expanded
      conversation={conversation}
      composerUploads={composerUploads}
      messagesViewportRef={messagesViewportRef}
    />
  ) : (
    <ResumeComposer
      viewState={viewState}
      expanded
      value={composerValue}
      uploads={composerUploads}
      error={composerError}
      disabled={isSubmitting}
      submitDisabledReason={submitDisabledReason}
      canSubmit={canSubmit}
      submitLabel={stage === 'empty' ? '开始解析' : '继续补充解析'}
      fileUploadEnabled={fileUploadEnabled}
      onValueChange={onComposerValueChange}
      onRemoveUpload={onRemoveUpload}
      onSubmit={onSubmit}
      onBeforeUpload={onBeforeUpload}
    />
  );

  const leftSecondary = processExpanded ? (
    <ResumeComposer
      viewState={viewState}
      value={composerValue}
      expanded={false}
      uploads={composerUploads}
      error={composerError}
      disabled={isSubmitting}
      submitDisabledReason={submitDisabledReason}
      canSubmit={canSubmit}
      submitLabel={stage === 'empty' ? '开始解析' : '继续补充解析'}
      fileUploadEnabled={fileUploadEnabled}
      onValueChange={onComposerValueChange}
      onRemoveUpload={onRemoveUpload}
      onSubmit={onSubmit}
      onBeforeUpload={onBeforeUpload}
    />
  ) : (
    <ProcessTimelinePanel
      stage={stage}
      viewState={viewState}
      expanded={false}
      conversation={conversation}
      composerUploads={composerUploads}
      messagesViewportRef={messagesViewportRef}
    />
  );

  const tabItems = useMemo(
    () => [
      {
        key: 'comparison',
        label: <span data-testid="comparison-tab-trigger">简历评分</span>,
        children: (
          <div className={styles.tabPane}>
            <LatestAnalysisSection
              analysis={analysis}
              loading={analysisLoading}
              mode="comparison"
              activeGapKey={activeGapKey}
              onOpenAdvice={(key) => {
                if (key) onActiveGapChange(key);
                onResultTabChange('advice');
              }}
              onActiveGapChange={onActiveGapChange}
            />
          </div>
        ),
      },
      {
        key: 'advice',
        label: <span data-testid="advice-tab-trigger">提升建议</span>,
        children: (
          <div className={styles.tabPane}>
            <LatestAnalysisSection
              analysis={analysis}
              loading={analysisLoading}
              mode="advice"
              activeGapKey={activeGapKey}
              onOpenAdvice={() => undefined}
              onActiveGapChange={onActiveGapChange}
            />
          </div>
        ),
      },
      {
        key: 'result',
        label: <span data-testid="result-tab-trigger">关键字提取</span>,
        children: (
          <div className={styles.tabPane}>
            <ResumeResultEditor
              mode={editing ? 'edit' : 'view'}
              runtimeFields={runtimeFields}
              currentProfile={currentProfile}
              editorProfile={editorProfile}
              tagInputs={tagInputs}
              onTagInputChange={onTagInputChange}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
            />
          </div>
        ),
      },
    ],
    [
      styles.tabPane,
      editing,
      runtimeFields,
      currentProfile,
      editorProfile,
      tagInputs,
      onTagInputChange,
      onAddTag,
      onRemoveTag,
      analysis,
      analysisLoading,
      activeGapKey,
      onActiveGapChange,
      onResultTabChange,
    ],
  );

  return (
    <PageContainer
      className={styles.container}
      title={false}
      breadcrumb={undefined}
      extra={
        activeModule === 'resume'
          ? [
              <Button
                key="reset"
                data-testid="reset-conversation-button"
                icon={<ReloadOutlined />}
                onClick={onResetConversation}
              >
                重置解析
              </Button>,
            ]
          : undefined
      }
    >
      <div className={styles.shell} data-workspace-stage={stage}>
        <div className={styles.frame}>
          <div className={styles.pageHead}>
            <Segmented
              className={styles.moduleSwitch}
              value={activeModule}
              onChange={(value) => onModuleChange(value as ModuleKey)}
              motion={{ duration: 0.2 }}
              options={[
                { label: '简历解析', value: 'resume' },
                { label: '职业匹配', value: 'career' },
              ]}
            />

            <Typography.Title level={2} className={styles.title} data-testid="resume-page-title">
              {activeModule === 'resume' ? '简历解析' : '职业匹配'}
            </Typography.Title>
          </div>

          <div className={styles.workspaceContainer}>
            {activeModule === 'career' ? (
              careerWorkspace
            ) : (
              <Row gutter={[16, 16]} className={styles.workspaceRow} wrap={false}>
                <Col xs={24} xl={undefined} flex="320px" style={{ width: '320px', maxWidth: '320px' }}>
                  <div className={styles.leftRail}>
                    <div className={styles.leftSummary}>
                      <ProcessTimelinePanel
                        stage={stage}
                        viewState={viewState}
                        expanded={false}
                        conversation={conversation}
                        composerUploads={composerUploads}
                        messagesViewportRef={messagesViewportRef}
                        summaryOnly
                      />
                    </div>
                    <div className={styles.leftPrimary}>{leftPrimary}</div>
                    <div className={styles.leftSecondary}>{leftSecondary}</div>
                  </div>
                </Col>

                <Col
                  xs={24}
                  xl={undefined}
                  flex="auto"
                  style={{
                    minWidth: 0,
                    width: 'auto',
                    maxWidth: 'none',
                    flexBasis: 0,
                  }}
                >
                  <Card
                    className={styles.rightCard}
                    extra={
                      editing ? (
                        <Space>
                          <Button data-testid="cancel-edit-button" className={styles.actionButton} onClick={onCancelEdit}>
                            取消编辑
                          </Button>
                          <Button
                            data-testid="save-result-button"
                            type="primary"
                            icon={<SaveOutlined />}
                            className={styles.primaryActionButton}
                            onClick={onSave}
                          >
                            保存结果
                          </Button>
                        </Space>
                      ) : (
                        <Button data-testid="edit-result-button" icon={<EditOutlined />} className={styles.actionButton} onClick={onEdit}>
                          编辑结果
                        </Button>
                      )
                    }
                  >
                    <Tabs
                      className={styles.tabs}
                      activeKey={activeResultTab}
                      onChange={(key) => onResultTabChange(key as ResultTabKey)}
                      animated={{ inkBar: true, tabPane: true }}
                      items={tabItems}
                    />
                  </Card>
                </Col>
              </Row>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default ResumeParsingWorkspace;
