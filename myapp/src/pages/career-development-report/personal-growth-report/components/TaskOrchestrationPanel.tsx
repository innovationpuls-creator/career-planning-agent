import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FieldTimeOutlined,
  PlayCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { Button, Progress, Space, Tag } from 'antd';
import { createStyles } from 'antd-style';
import * as React from 'react';

type TaskOrchestrationPanelProps = {
  tasks: API.GrowthWorkbenchTaskPayload[];
  runningTaskId?: string;
  onRunTask: (taskType: API.GrowthWorkbenchTaskType) => void;
  onSkipTask: (taskId: string) => void;
  onCancelTask: (taskId: string) => void;
};

const taskActions: Array<{
  type: API.GrowthWorkbenchTaskType;
  label: string;
  hint: string;
}> = [
  { type: 'target_validation', label: '目标校验', hint: '目标与证据' },
  { type: 'gap_diagnosis', label: '差距诊断', hint: '能力与市场' },
  { type: 'report_rewrite', label: '报告改写', hint: '回填报告' },
  { type: 'resume_draft', label: '简历草稿', hint: '生成简历' },
];

const statusLabels: Record<API.GrowthWorkbenchTaskStatus, string> = {
  queued: '待运行',
  running: '运行中',
  completed: '已完成',
  skipped: '已跳过',
  blocked: '需补充',
  failed: '失败',
  cancelled: '已取消',
};

const statusIcons: Partial<
  Record<API.GrowthWorkbenchTaskStatus, React.ReactNode>
> = {
  completed: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  cancelled: <StopOutlined />,
  running: <FieldTimeOutlined />,
};

const useStyles = createStyles(({ css, token }) => ({
  grid: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: ${token.margin}px;

    @media (max-width: 1120px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 680px) {
      grid-template-columns: 1fr;
    }
  `,
  item: css`
    min-width: 0;
    display: grid;
    gap: ${token.marginSM}px;
    padding: ${token.padding}px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  titleRow: css`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: ${token.marginSM}px;
  `,
  titleButton: css`
    height: auto !important;
    min-width: 0;
    padding: 0 !important;
    color: ${token.colorText} !important;
    font-weight: 600;
    text-align: left;
  `,
  hint: css`
    margin: ${token.marginXXS}px 0 0;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
  status: css`
    display: inline-flex;
    align-items: center;
    gap: ${token.marginXXS}px;
  `,
  statusText: css`
    min-height: 20px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));

const TaskOrchestrationPanel: React.FC<TaskOrchestrationPanelProps> = ({
  tasks,
  runningTaskId,
  onRunTask,
  onSkipTask,
  onCancelTask,
}) => {
  const { styles } = useStyles();
  const latestByType = new Map(tasks.map((task) => [task.task_type, task]));

  return (
    <section className={styles.grid} data-testid="task-orchestration-panel">
      {taskActions.map((action) => {
        const task = latestByType.get(action.type);
        const isRunning =
          runningTaskId === task?.task_id || task?.status === 'running';
        const status = task?.status || 'queued';

        return (
          <article className={styles.item} key={action.type}>
            <div className={styles.titleRow}>
              <div>
                <Button
                  className={styles.titleButton}
                  type="link"
                  onClick={() => onRunTask(action.type)}
                >
                  {action.label}
                </Button>
                <p className={styles.hint}>{action.hint}</p>
              </div>
              <Tag>
                <span className={styles.status}>
                  {statusIcons[status]}
                  {statusLabels[status]}
                </span>
              </Tag>
            </div>
            <Progress
              percent={task?.progress || 0}
              size="small"
              showInfo={false}
            />
            <div className={styles.statusText}>
              {task?.status_text || '等待操作'}
            </div>
            <Space wrap>
              <Button
                size="small"
                icon={<PlayCircleOutlined />}
                loading={isRunning}
                onClick={() => onRunTask(action.type)}
              >
                {task ? '重跑' : '运行'}
              </Button>
              {task ? (
                <Button
                  size="small"
                  autoInsertSpace={false}
                  onClick={() => onSkipTask(task.task_id)}
                >
                  跳过
                </Button>
              ) : null}
              {task?.can_cancel ? (
                <Button
                  size="small"
                  danger
                  icon={<StopOutlined />}
                  autoInsertSpace={false}
                  onClick={() => onCancelTask(task.task_id)}
                >
                  取消
                </Button>
              ) : null}
            </Space>
          </article>
        );
      })}
    </section>
  );
};

export default TaskOrchestrationPanel;
