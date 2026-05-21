# 职业匹配

> 来源：`myapp/config/routes.ts`、`myapp/src/pages/career-match/**`、`myapp/src/pages/student-competency-profile/hooks/useMatchResults.ts`、`backend/app/api/career_development_report.py`

## 页面

| 路由 | 组件 | 权限 | 菜单状态 |
|---|---|---|---|
| `/career-match` | `./career-match` | `canUser` | 可见 |

## 功能

- 作为独立页面展示职业匹配结果，不再归属于简历解构页。
- 加载最新 12 维能力画像，用于学生画像展示。
- 初始化职业匹配推荐列表与默认推荐目标。
- 切换推荐目标，查看匹配百分比。
- Tab「能力对比」：学生画像与目标岗位维度对比。
- Tab「提升建议」：优先级差距维度和行动建议。
- Tab「最匹配工作」：公司/证据卡片。
- 收藏或取消收藏匹配结果。
- 生成计划：仅当当前推荐已收藏时跳转 `/snail-learning-path?favorite_id=...`。
- 可跳转 AI 教练，携带 `step=match`、`favoriteId`、`reportId`、`recommendationId`。

## 前端调用

| 前端函数 | 方法 | 路径 | 用途 |
|---|---|---|---|
| `getStudentCompetencyLatestAnalysis` | GET | `/api/student-competency-profile/latest-analysis` | 加载学生能力画像 |
| `getStudentCompetencyConversation` | GET | `/api/student-competency-profile/conversations/{workspaceConversationId}` | 有最新会话时恢复画像元数据 |
| `getCareerDevelopmentMatchInit` | GET | `/api/career-development-report/job-exploration-match/init` | 获取推荐匹配初始数据 |
| `getCareerDevelopmentFavorites` | GET | `/api/career-development-report/favorites` | 获取已收藏目标 |
| `createCareerDevelopmentFavorite` | POST | `/api/career-development-report/favorites` | 收藏推荐目标 |
| `deleteCareerDevelopmentFavorite` | DELETE | `/api/career-development-report/favorites/{favoriteId}` | 取消收藏 |

## 后端端点

| 方法 | 路径 | 说明 | 源码 |
|---|---|---|---|
| GET | `/api/student-competency-profile/latest-analysis` | 最新能力分析 | `backend/app/api/student_competency_profile.py` |
| GET | `/api/student-competency-profile/conversations/{workspace_conversation_id}` | 会话画像数据 | `backend/app/api/student_competency_profile.py` |
| GET | `/api/career-development-report/job-exploration-match/init` | 职业匹配初始化 | `backend/app/api/career_development_report.py` |
| GET | `/api/career-development-report/favorites` | 收藏列表 | `backend/app/api/career_development_report.py` |
| POST | `/api/career-development-report/favorites` | 新增/更新收藏 | `backend/app/api/career_development_report.py` |
| DELETE | `/api/career-development-report/favorites/{favorite_id}` | 删除收藏 | `backend/app/api/career_development_report.py` |

## 备注/状态

- `POST /api/career-development-report/job-exploration-match/report` 已实现，用于自定义岗位匹配报告；当前 `/career-match` 页面未直接调用。
- 生成计划本身不创建后端任务，只通过收藏目标 ID 跳转到蜗牛学习路径页面。

