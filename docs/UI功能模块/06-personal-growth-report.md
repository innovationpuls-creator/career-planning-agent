# 个人职业成长报告

> 来源：`myapp/config/routes.ts`、`myapp/src/pages/career-development-report/personal-growth-report/**`、`myapp/src/pages/career-development-report/shared/useCareerGoalPlanningData.ts`、`backend/app/api/career_development_report.py`

## 页面

| 路由 | 组件/行为 | 权限 | 菜单状态 |
|---|---|---|---|
| `/personal-growth-report` | `./career-development-report/personal-growth-report` | `canUser` | 可见 |
| `/career-development-report/personal-growth-report` | 重定向到 `/personal-growth-report` | `canUser` | `hideInMenu: true` |

## 功能

- 自动选择收藏目标，若没有收藏目标则提示先去职业匹配。
- 展示报告生成前置条件：收藏目标、个人资料、能力画像、学习路径基础工作区。
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
- `useCareerGoalPlanningData({ workspaceMode: 'none' })` 只用于选择收藏目标；该页面当前不触发目标规划任务创建。

