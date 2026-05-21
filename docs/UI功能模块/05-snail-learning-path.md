# 蜗牛学习路径

> 来源：`myapp/config/routes.ts`、`myapp/src/pages/career-development-report/learning-path/**`、`backend/app/api/snail_learning_path.py`、`backend/app/api/career_development_report.py`

## 页面

| 路由 | 组件 | 权限 | 菜单状态 |
|---|---|---|---|
| `/snail-learning-path` | `./career-development-report/learning-path` | `canUser` | 可见 |

## 功能

- 通过 `favorite_id` 加载或初始化学习路径工作区。
- 前置检查：收藏目标、个人资料、最新 12 维分析、工作区。
- 展示当前阶段、匹配度、内容完成度、练习完成度、当前模块。
- 展示短期、中期、长期 3 个阶段时间线。
- 左侧浏览学习模块、查看练习任务、勾选模块完成。
- 右侧展示学习资源卡片，支持打卡、打开外部链接、查看资源详情。
- 周检查与月检查：提交总结和附件，由后端生成复盘结果。
- 查看当前阶段历史复盘。
- 可跳转 AI 教练，携带 `step=learning`、`favoriteId`、`workspaceId`。

## 前端调用

| 前端函数 | 方法 | 路径 | 用途 |
|---|---|---|---|
| `getHomeV2` | GET | `/api/home-v2` | 前置资料状态 |
| `getStudentCompetencyLatestAnalysis` | GET | `/api/student-competency-profile/latest-analysis` | 前置画像状态 |
| `getCareerDevelopmentFavorites` | GET | `/api/career-development-report/favorites` | 收藏目标校验 |
| `getCareerDevelopmentPlanWorkspace` | GET | `/api/career-development-report/goal-setting-path-planning/workspaces/{favoriteId}` | 读取已有工作区 |
| `initializeSnailLearningPathWorkspace` | POST | `/api/career-development-report/snail-learning-path/workspaces/{favoriteId}` | 初始化工作区，404 回退到 `/api/snail-learning-path/...` |
| `listSnailLearningPathReviews` | GET | `/api/career-development-report/snail-learning-path/workspaces/{workspaceId}/reviews` | 获取复盘列表，404 回退到 `/api/snail-learning-path/...` |
| `createSnailLearningPathReview` | POST | `/api/career-development-report/snail-learning-path/workspaces/{workspaceId}/reviews` | 创建周/月复盘，404 回退到 `/api/snail-learning-path/...` |

## 后端端点

| 方法 | 路径 | 说明 | 源码 |
|---|---|---|---|
| GET | `/api/home-v2` | 首页资料与阶段聚合数据 | `backend/app/api/user_profile.py` |
| GET | `/api/student-competency-profile/latest-analysis` | 最新能力分析 | `backend/app/api/student_competency_profile.py` |
| GET | `/api/career-development-report/favorites` | 收藏目标列表 | `backend/app/api/career_development_report.py` |
| GET | `/api/career-development-report/goal-setting-path-planning/workspaces/{favorite_id}` | 读取学习路径/目标规划工作区 | `backend/app/api/career_development_report.py` |
| POST | `/api/career-development-report/snail-learning-path/workspaces/{favorite_id}` | 初始化工作区 | `backend/app/api/snail_learning_path.py` |
| POST | `/api/snail-learning-path/workspaces/{favorite_id}` | 初始化工作区兼容路径 | `backend/app/api/snail_learning_path.py` |
| GET | `/api/career-development-report/snail-learning-path/workspaces/{workspace_id}/reviews` | 复盘列表 | `backend/app/api/snail_learning_path.py` |
| GET | `/api/snail-learning-path/workspaces/{workspace_id}/reviews` | 复盘列表兼容路径 | `backend/app/api/snail_learning_path.py` |
| POST | `/api/career-development-report/snail-learning-path/workspaces/{workspace_id}/reviews` | 创建复盘 | `backend/app/api/snail_learning_path.py` |
| POST | `/api/snail-learning-path/workspaces/{workspace_id}/reviews` | 创建复盘兼容路径 | `backend/app/api/snail_learning_path.py` |

## 备注/状态

- 前端使用 `requestWith404Fallback`，优先访问 `/api/career-development-report/snail-learning-path/...`，404 后回退到 `/api/snail-learning-path/...`。
- `POST /api/career-development-report/snail-learning-path/workspaces` 与 `POST /api/snail-learning-path/workspaces` 已实现，但当前用于拒绝无 `favorite_id` 的临时生成请求。

