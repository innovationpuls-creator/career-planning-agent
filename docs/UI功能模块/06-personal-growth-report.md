# 个人职业成长报告

> 来源：`myapp/config/routes.ts`、`myapp/src/pages/career-development-report/personal-growth-report/**`、`myapp/src/pages/career-development-report/shared/useCareerGoalPlanningData.ts`、`backend/app/api/career_development_report.py`、`backend/app/api/growth_workbench.py`

## 页面

| 路由 | 组件/行为 | 权限 | 菜单状态 |
|---|---|---|---|
| `/personal-growth-report` | `./career-development-report/personal-growth-report` | `canUser` | 可见 |
| `/career-development-report/personal-growth-report` | 重定向到 `/personal-growth-report` | `canUser` | `hideInMenu: true` |

## 功能

- 自动选择收藏目标，若没有收藏目标则提示先去职业匹配。
- 展示报告生成前置条件：收藏目标、个人资料、能力画像、学习路径基础工作区。
- 综合工作台总览：展示当前收藏目标、行业、匹配度、目标适配状态和关键风险。
- 任务编排：支持目标校验、差距诊断、报告改写、简历草稿任务；可一键运行完整队列，也可单独运行、重跑、跳过、取消。
- 独立产物：保存目标诊断、差距诊断、报告版本和简历版本。
- 产物回填：诊断类自动保存；报告和简历正文必须用户确认后接受。
- 证据区：汇总画像、岗位、行业、学习路径、简历材料和报告来源。
- 生成个人职业成长报告，支持异步任务进度流与取消。
- 查看报告章节。
- 编辑单个章节并保存。
- 恢复当前章节结构模板。
- 导出报告为 DOCX 或 PDF。
- 可跳转 AI 教练，携带 `step=report`、`favoriteId`、`workspaceId`。

## 前端调用

| 前端函数 | 方法 | 路径 | 用途 |
|---|---|---|---|
| `getCareerDevelopmentFavorites` | GET | `/api/career-development-report/favorites` | 选择当前收藏目标 |
| `getHomeV2` | GET | `/api/home-v2` | 前置资料状态 |
| `getStudentCompetencyLatestAnalysis` | GET | `/api/student-competency-profile/latest-analysis` | 前置画像状态 |
| `getCareerDevelopmentPlanWorkspace` | GET | `/api/career-development-report/goal-setting-path-planning/workspaces/{favoriteId}` | 前置学习路径/目标规划工作区 |
| `getGrowthWorkbench` | GET | `/api/career-development-report/personal-growth-workbench/{favoriteId}` | 读取综合工作台 |
| `createGrowthWorkbenchTask` | POST | `/api/career-development-report/personal-growth-workbench/tasks` | 创建单任务或完整队列 |
| `getGrowthWorkbenchTask` | GET | `/api/career-development-report/personal-growth-workbench/tasks/{taskId}` | 读取任务状态 |
| `streamGrowthWorkbenchTask` | GET | `/api/career-development-report/personal-growth-workbench/tasks/{taskId}/stream` | 订阅任务进度 NDJSON |
| `skipGrowthWorkbenchTask` | POST | `/api/career-development-report/personal-growth-workbench/tasks/{taskId}/skip` | 跳过任务 |
| `cancelGrowthWorkbenchTask` | POST | `/api/career-development-report/personal-growth-workbench/tasks/{taskId}/cancel` | 取消任务 |
| `acceptGrowthWorkbenchArtifact` | POST | `/api/career-development-report/personal-growth-workbench/artifacts/{artifactId}/accept` | 接受产物 |
| `getPersonalGrowthReportWorkspace` | GET | `/api/career-development-report/personal-growth-report/workspaces/{favoriteId}` | 读取报告工作区 |
| `createPersonalGrowthReportTask` | POST | `/api/career-development-report/personal-growth-report/tasks` | 创建异步生成任务 |
| `getPersonalGrowthReportTask` | GET | `/api/career-development-report/personal-growth-report/tasks/{taskId}` | 恢复任务状态 |
| `streamPersonalGrowthReportTask` | GET | `/api/career-development-report/personal-growth-report/tasks/{taskId}/stream` | 订阅任务进度 NDJSON |
| `cancelPersonalGrowthReportTask` | POST | `/api/career-development-report/personal-growth-report/tasks/{taskId}/cancel` | 取消任务 |
| `updatePersonalGrowthReportWorkspace` | PUT | `/api/career-development-report/personal-growth-report/workspaces/{favoriteId}` | 保存章节 |
| `exportPersonalGrowthReport` | POST | `/api/career-development-report/personal-growth-report/workspaces/{favoriteId}/export` | 导出 DOCX/PDF |

## 后端端点

| 方法 | 路径 | 说明 | 源码 |
|---|---|---|---|
| GET | `/api/career-development-report/favorites` | 收藏目标列表 | `backend/app/api/career_development_report.py` |
| GET | `/api/home-v2` | 首页资料与阶段聚合数据 | `backend/app/api/user_profile.py` |
| GET | `/api/student-competency-profile/latest-analysis` | 最新能力分析 | `backend/app/api/student_competency_profile.py` |
| GET | `/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}` | 读取基础工作区 | `backend/app/api/career_development_report.py` |
| GET | `/api/career-development-report/personal-growth-workbench/{favorite_id}` | 读取综合工作台 | `backend/app/api/growth_workbench.py` |
| POST | `/api/career-development-report/personal-growth-workbench/tasks` | 创建目标校验/差距诊断/报告改写/简历草稿任务 | `backend/app/api/growth_workbench.py` |
| GET | `/api/career-development-report/personal-growth-workbench/tasks/{task_id}` | 获取工作台任务状态 | `backend/app/api/growth_workbench.py` |
| GET | `/api/career-development-report/personal-growth-workbench/tasks/{task_id}/stream` | 工作台任务进度 NDJSON | `backend/app/api/growth_workbench.py` |
| POST | `/api/career-development-report/personal-growth-workbench/tasks/{task_id}/skip` | 跳过工作台任务 | `backend/app/api/growth_workbench.py` |
| POST | `/api/career-development-report/personal-growth-workbench/tasks/{task_id}/cancel` | 取消工作台任务 | `backend/app/api/growth_workbench.py` |
| POST | `/api/career-development-report/personal-growth-workbench/artifacts/{artifact_id}/accept` | 接受报告或简历产物 | `backend/app/api/growth_workbench.py` |
| GET | `/api/career-development-report/personal-growth-report/workspaces/{favorite_id}` | 读取报告工作区 | `backend/app/api/career_development_report.py` |
| PUT | `/api/career-development-report/personal-growth-report/workspaces/{favorite_id}` | 保存报告章节 | `backend/app/api/career_development_report.py` |
| POST | `/api/career-development-report/personal-growth-report/tasks` | 创建报告生成任务 | `backend/app/api/career_development_report.py` |
| GET | `/api/career-development-report/personal-growth-report/tasks/{task_id}` | 获取任务状态 | `backend/app/api/career_development_report.py` |
| GET | `/api/career-development-report/personal-growth-report/tasks/{task_id}/stream` | 任务进度 NDJSON | `backend/app/api/career_development_report.py` |
| POST | `/api/career-development-report/personal-growth-report/tasks/{task_id}/cancel` | 取消任务 | `backend/app/api/career_development_report.py` |
| POST | `/api/career-development-report/personal-growth-report/workspaces/{favorite_id}/export` | 导出报告 | `backend/app/api/career_development_report.py` |

## 后端已实现但页面当前未触发

| 方法 | 路径 | 状态 |
|---|---|---|
| POST | `/api/career-development-report/personal-growth-report/workspaces/{favorite_id}/regenerate` | `api.ts` 已封装为 `regeneratePersonalGrowthReport`，当前页面生成入口改走异步 task |
| POST | `/api/career-development-report/personal-growth-report/bootstrap/regenerate` | `api.ts` 已封装为 `bootstrapPersonalGrowthReport`，当前页面未调用 |

## 备注/状态

- 报告任务流格式为 `application/x-ndjson`。
- 工作台任务流格式为 `application/x-ndjson`。
- `useCareerGoalPlanningData({ workspaceMode: 'none' })` 只用于选择收藏目标；该页面当前不触发目标规划任务创建。
