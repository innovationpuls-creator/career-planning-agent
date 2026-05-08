import { CheckCircleFilled, RightOutlined } from '@ant-design/icons';
import { Checkbox, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { FadeInWhenVisible } from '@/components/ui/FadeInWhenVisible';

const { Text } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    padding: 8px 0;
  `,
  moduleItem: css`
    position: relative;
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    gap: 12px;
    width: 100%;
    padding: 14px 12px 14px 0;
    cursor: pointer;
    text-align: left;
    border: 1px solid transparent;
    border-radius: 14px;
    background: color-mix(in srgb, ${token.colorBgContainer} 84%, ${token.colorPrimaryBg} 16%);
    transition:
      background-color ${token.motionDurationFast},
      border-color ${token.motionDurationFast},
      box-shadow ${token.motionDurationFast},
      transform ${token.motionDurationFast};
    &:hover {
      background: ${token.colorBgContainer};
      border-color: ${token.colorPrimaryBorder};
      box-shadow: inset 3px 0 0 ${token.colorPrimaryBorder};
      transform: translateY(-1px);
    }
    &:focus-visible {
      outline: 2px solid ${token.colorPrimaryBorder};
      outline-offset: 2px;
    }
  `,
  selectedItem: css`
    background: ${token.colorBgContainer};
    border-color: ${token.colorPrimaryBorder};
    box-shadow:
      inset 3px 0 0 ${token.colorPrimary},
      0 10px 22px color-mix(in srgb, ${token.colorPrimary} 9%, transparent);
  `,
  doneItem: css`
    opacity: 0.65;
  `,
  moduleIcon: css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 27px;
    height: 27px;
    border-radius: 999px;
    border: 1px solid ${token.colorBorderSecondary};
    color: ${token.colorText};
    background: ${token.colorBgContainer};
    font-size: 11px;
    font-weight: 600;
    flex-shrink: 0;
  `,
  currentIcon: css`
    border-color: ${token.colorPrimaryBorder};
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
  `,
  doneIcon: css`
    border-color: ${token.colorSuccess};
    color: ${token.colorBgContainer};
    background: ${token.colorSuccess};
  `,
  moduleContent: css`
    display: grid;
    gap: 4px;
    min-width: 0;
  `,
  moduleTitle: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  `,
  doneTitle: css`
    color: ${token.colorTextTertiary};
    text-decoration: line-through;
  `,
  resourceCheckbox: css`
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  `,
  progressBadge: css`
    font-size: 12px;
    color: ${token.colorTextSecondary};
    white-space: nowrap;
  `,
  practiceSection: css`
    padding: 8px 0 0 42px;
    border-top: 1px solid ${token.colorBorderSecondary};
    margin-top: 8px;
  `,
  practiceTitle: css`
    font-size: 12px;
    color: ${token.colorTextSecondary};
    margin-bottom: 4px;
  `,
  practiceItem: css`
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    margin-bottom: 4px;
  `,
}));

interface ModuleListProps {
  modules: Array<{
    module_id: string;
    topic: string;
    learning_content?: string;
    resource_recommendations?: any[];
    resource_status?: string;
    resource_error_message?: string;
    status: { total: number; completed: number; done: boolean };
  }>;
  selectedModuleId?: string;
  onModuleSelect: (moduleId: string) => void;
  onModuleComplete: (moduleId: string, checked: boolean) => void;
  practiceActions?: API.GrowthPlanPracticeAction[];
}

export function ModuleList({
  modules,
  selectedModuleId,
  onModuleSelect,
  onModuleComplete,
  practiceActions,
}: ModuleListProps) {
  const { styles } = useStyles();

  return (
    <div className={styles.root}>
      <Text strong style={{ fontSize: 14 }}>
        学习模块
      </Text>
      {modules.length === 0 ? (
        <Text
          type="secondary"
          style={{ marginTop: 8, display: 'block' }}
        >
          暂无学习模块
        </Text>
      ) : (
        modules.map((module, index) => {
          const isSelected = module.module_id === selectedModuleId;
          const isDone = module.status.done;
          const resourceCount = module.resource_recommendations?.length || 0;

          return (
            <FadeInWhenVisible
              key={module.module_id}
              stagger
              staggerIndex={index}
              staggerInterval={0.06}
            >
              <button
                type="button"
                className={[
                  styles.moduleItem,
                  isSelected ? styles.selectedItem : '',
                  isDone && !isSelected ? styles.doneItem : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onModuleSelect(module.module_id)}
                aria-pressed={isSelected}
              >
                <div
                  className={[
                    styles.moduleIcon,
                    isDone ? styles.doneIcon : '',
                    !isDone && isSelected ? styles.currentIcon : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {isDone ? (
                    <CheckCircleFilled />
                  ) : (
                    <RightOutlined style={{ fontSize: 10 }} />
                  )}
                </div>
                <div className={styles.moduleContent}>
                  <div className={styles.moduleTitle}>
                    <Text
                      strong={isSelected || !isDone}
                      className={isDone ? styles.doneTitle : undefined}
                    >
                      {module.topic}
                    </Text>
                  </div>
                  <div className={styles.resourceCheckbox}>
                    <Checkbox
                      checked={isDone}
                      indeterminate={
                        module.status.completed > 0 && !module.status.done
                      }
                      disabled={!module.status.total}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        onModuleComplete(module.module_id, e.target.checked)
                      }
                      aria-label="标记完成"
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {module.status.completed}/{module.status.total} 资源
                    </Text>
                  </div>
                </div>
                <div className={styles.progressBadge}>
                  {isDone ? '已完成' : `${resourceCount} 项`}
                </div>
              </button>

              {practiceActions && practiceActions.length > 0 && isSelected && (
                <div className={styles.practiceSection}>
                  <Text className={styles.practiceTitle}>动手任务</Text>
                  {practiceActions.map((action) => (
                    <div
                      key={`${action.action_type}-${action.title || action.description}`}
                      className={styles.practiceItem}
                    >
                      <Text type="secondary">·</Text>
                      <Text>{action.title || action.description}</Text>
                    </div>
                  ))}
                </div>
              )}
            </FadeInWhenVisible>
          );
        })
      )}
    </div>
  );
}
