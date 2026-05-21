# API-only 与未对齐项

> 来源：`backend/app/api/job_transfer.py`、`backend/app/api/goal_setting.py`、`backend/app/api/career_development_report.py`、`myapp/src/services/ant-design-pro/api.ts`

## 岗位转换 API

当前无独立前端页面。全局 `api.ts` 也没有封装岗位转换接口。

| 方法 | 路径 | 类型 | 说明 | 源码 |
|---|---|---|---|---|
| GET | `/api/job-transfer/options` | REST | 获取可转换岗位选项 | `backend/app/api/job_transfer.py` |
| GET | `/api/job-transfer/source/{career_id}` | REST | 获取源岗位数据 | `backend/app/api/job_transfer.py` |
| GET | `/api/job-transfer/{career_id}` | REST | 获取岗位转换画像 | `backend/app/api/job_transfer.py` |
| GET | `/api/job-transfer/{career_id}/stream` | NDJSON | 流式岗位转换分析 | `backend/app/api/job_transfer.py` |
| POST | `/api/job-transfer/tasks` | REST | 创建转换分析任务 | `backend/app/api/job_transfer.py` |
| GET | `/api/job-transfer/tasks/{task_id}` | REST | 获取任务快照/状态 | `backend/app/api/job_transfer.py` |
| POST | `/api/job-transfer/tasks/{task_id}/cancel` | REST | 取消任务 | `backend/app/api/job_transfer.py` |
| GET | `/api/job-transfer/tasks/{task_id}/stream` | NDJSON | 流式任务进度 | `backend/app/api/job_transfer.py` |

## 目标设定路径规划 API

`goal_setting.py` 已挂载以下同步接口，当前没有独立前端页面；主要供工具或后续页面使用。

| 方法 | 路径 | 说明 | 源码 |
|---|---|---|---|
| POST | `/api/career-development-report/goal-setting-path-planning` | 创建同步目标规划记录 | `backend/app/api/goal_setting.py` |
| PUT | `/api/career-development-report/goal-setting-path-planning/{plan_id}` | 修改目标规划记录 | `backend/app/api/goal_setting.py` |
| GET | `/api/career-development-report/goal-setting-path-planning/{plan_id}/progress` | 获取规划进度 | `backend/app/api/goal_setting.py` |
| POST | `/api/career-development-report/goal-setting-path-planning/{plan_id}/progress` | 更新规划进度 | `backend/app/api/goal_setting.py` |
| GET | `/api/career-development-report/learning-path/{plan_id}` | 读取学习计划详情 | `backend/app/api/goal_setting.py` |

`career_development_report.py` 还实现了：

| 方法 | 路径 | 说明 | 源码 |
|---|---|---|---|
| GET | `/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}` | 读取收藏目标对应工作区 | `backend/app/api/career_development_report.py` |
| GET | `/api/career-development-report/goal-setting-path-planning/tasks/{task_id}/stream` | 目标规划任务进度流 | `backend/app/api/career_development_report.py` |

## 前端已定义但后端未实现

以下函数在 `myapp/src/services/ant-design-pro/api.ts` 中存在，但当前后端路由中没有对应方法端点。

| 前端函数 | 方法 | 路径 | 状态 |
|---|---|---|---|
| `createCareerDevelopmentGoalPlanTask` | POST | `/api/career-development-report/goal-setting-path-planning/tasks` | 后端缺失 |
| `getCareerDevelopmentGoalPlanTask` | GET | `/api/career-development-report/goal-setting-path-planning/tasks/{taskId}` | 后端缺失 |
| `updateCareerDevelopmentPlanWorkspace` | PUT | `/api/career-development-report/goal-setting-path-planning/workspaces/{favoriteId}` | 后端缺失 |
| `polishCareerDevelopmentPlanWorkspace` | POST | `/api/career-development-report/goal-setting-path-planning/workspaces/{favoriteId}/polish` | 后端缺失 |
| `generateCareerDevelopmentPlanLearningResources` | POST | `/api/career-development-report/goal-setting-path-planning/workspaces/{favoriteId}/learning-resources` | 后端缺失 |

## 前端已定义但页面当前未调用

这些不是缺失端点，只是当前页面没有实际调用。

| 前端函数 | 路径 | 后端状态 |
|---|---|---|
| `outLogin` | `/api/login/outLogin` | 已实现；由头像下拉组件调用 |
| `bootstrapPersonalGrowthReport` | `/api/career-development-report/personal-growth-report/bootstrap/regenerate` | 已实现 |
| `getStudentCompetencyRuntime` | `/api/student-competency-profile/runtime` | 已实现 |
| `createStudentCompetencyChat` | `/api/student-competency-profile/chat` | 已实现 |
| `getStudentCompetencyStatusEvents` | `/api/student-competency-profile/status-events` | 已实现 |

## 健康检查与静态资源

| 方法/挂载 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 健康检查 |
| mount | `/static` | 静态文件挂载，不计入方法型 API 端点总数 |

