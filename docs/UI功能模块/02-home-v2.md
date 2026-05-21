# 职业规划首页

> 来源：`myapp/config/routes.ts`、`myapp/src/pages/home-v2/**`、`backend/app/api/user_profile.py`、`backend/app/api/career_development_report.py`、`backend/app/api/student_competency_profile.py`、`backend/app/api/jobs.py`

## 页面

| 路由 | 组件 | 权限 | 菜单状态 |
|---|---|---|---|
| `/home-v2` | `./home-v2` | `canUser` | 可见 |

## 功能

- 展示当前目标岗位、阶段标签、匹配度。
- 展示下一步操作建议与 CTA。
- 展示规划完成度、薪资参考、已匹配岗位数量。
- 展示 5 步职业规划管线：完善资料、简历解析、职业匹配、蜗牛学习路径、成长报告。
- 展示 3 阶段成长路线与薪资范围。
- 展示个人资料与附件数量。
- 编辑个人资料：姓名、学校、专业、学历、年级、目标岗位、图片附件。

## 前端调用

| 前端函数 | 方法 | 路径 | 用途 |
|---|---|---|---|
| `getHomeV2` | GET | `/api/home-v2` | 首页主体数据 |
| `currentUser` | GET | `/api/currentUser` | 当前用户信息 |
| `getCareerDevelopmentFavorites` | GET | `/api/career-development-report/favorites` | 已收藏目标数量与管线状态 |
| `getStudentCompetencyLatestAnalysis` | GET | `/api/student-competency-profile/latest-analysis` | 最新能力画像状态 |
| `getJobTitleOptions` | GET | `/api/job-postings/job-titles` | 编辑资料目标岗位选项 |
| `submitOnboardingProfile` | POST | `/api/user-profile/onboarding` | 保存个人资料 |

## 后端端点

| 方法 | 路径 | 说明 | 源码 |
|---|---|---|---|
| GET | `/api/home-v2` | 返回首页聚合数据 | `backend/app/api/user_profile.py` |
| GET | `/api/currentUser` | 返回当前用户信息 | `backend/app/api/auth.py` |
| GET | `/api/career-development-report/favorites` | 返回收藏目标列表 | `backend/app/api/career_development_report.py` |
| GET | `/api/student-competency-profile/latest-analysis` | 返回最新 12 维分析 | `backend/app/api/student_competency_profile.py` |
| GET | `/api/job-postings/job-titles` | 返回岗位名称选项 | `backend/app/api/jobs.py` |
| POST | `/api/user-profile/onboarding` | 保存个人资料与附件 | `backend/app/api/user_profile.py` |

## 备注/状态

- 首页依赖多个接口并行加载；`/api/home-v2` 失败会进入页面错误态，其余辅助接口失败时以空数据降级。
- 编辑资料附件字段仍使用后端 `image_files`。

