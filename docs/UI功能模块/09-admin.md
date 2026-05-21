# 管理端

> 来源：`myapp/config/routes.ts`、`myapp/src/pages/admin/**`、`backend/app/api/admin_users.py`、`backend/app/api/jobs.py`、`backend/app/api/job_requirement_comparisons.py`、`backend/app/api/admin_data_dashboard.py`

## 页面

| 路由 | 组件/行为 | 权限 | 菜单状态 |
|---|---|---|---|
| `/admin` | 重定向到 `/admin/job-postings` | `canAdmin` | 管理员分组 |
| `/admin/profile` | `./admin/profile` | `canAdmin` | `hideInMenu: true` |
| `/admin/user-management` | `./admin/user-management` | `canAdmin` | 可见 |
| `/admin/job-postings` | `./admin/job-postings` | `canAdmin` | 可见 |
| `/admin/job-requirement-comparisons` | `./admin/job-requirement-comparisons` | `canAdmin` | 可见 |
| `/admin/upload-data` | 重定向到 `/admin/job-postings` | `canAdmin` | `hideInMenu: true` |
| `/admin/major-distribution` | `./admin/data-dashboard/major-distribution` | `canAdmin` | 可见 |
| `/admin/competency-analysis` | `./admin/data-dashboard/competency-analysis` | `canAdmin` | 可见 |
| `/admin/employment-trends` | `./admin/data-dashboard/employment-trends` | `canAdmin` | 可见 |

## 功能

### `/admin/profile`

- 查看用户名、角色、创建时间。
- 修改昵称、头像 URL。
- 修改密码。
- 保存资料后同步全局当前用户昵称和头像。

### `/admin/user-management`

- 用户列表分页，每页默认 20 条，支持切换 page size。
- 按用户名、角色、状态筛选。
- 新增用户：用户名、初始密码、昵称、角色、状态。
- 编辑用户：昵称、角色、状态；用户名和注册时间只读。
- 查看用户详情。
- 删除用户，带二次确认。

### `/admin/job-postings`

- 只读岗位列表，分页默认 20 条。
- 按岗位名称、行业、公司名称、工作地点、关键词筛选。
- 查看岗位详情：基础字段、岗位描述、公司介绍。
- 页面明确提示新增、编辑、删除、批量导入尚未开放。

### `/admin/job-requirement-comparisons`

- 岗位要求对比列表，分页默认 20 条。
- 按职位、行业、公司筛选。
- 查看原文条数、已提取维度数。
- 查看详情：左侧合并岗位原文，右侧 12 维提取结果。

### `/admin/major-distribution`

- 统计卡片：总用户数、已完善画像数、画像完善率。
- 专业分布饼图。
- 学历层次分布饼图。
- 学校分布 TOP 20 柱状图。

### `/admin/competency-analysis`

- 统计卡片：已完成评估人数、覆盖维度数、排行榜展示人数。
- 12 维能力雷达图。
- TOP 10 学生能力排名。
- 各维度得分分布堆叠柱状图。

### `/admin/employment-trends`

- 统计卡片：总岗位数、公司总数、有薪资标注岗位数。
- 行业岗位分布柱状图。
- 热门岗位 TOP 20 柱状图。
- 薪资区间分布饼图与柱状图。

## 前端调用

| 页面 | 前端函数 |
|---|---|
| `/admin/profile` | `getAdminProfile`、`updateAdminProfile` |
| `/admin/user-management` | `getAdminUsers`、`getAdminUser`、`createAdminUser`、`updateAdminUser`、`deleteAdminUser` |
| `/admin/job-postings` | `getJobPostings` |
| `/admin/job-requirement-comparisons` | `getJobRequirementComparisons`、`getJobRequirementComparison` |
| `/admin/major-distribution` | `getMajorDistribution` |
| `/admin/competency-analysis` | `getCompetencyAnalysis` |
| `/admin/employment-trends` | `getEmploymentTrends` |

## 后端端点

| 方法 | 路径 | 说明 | 源码 |
|---|---|---|---|
| GET | `/api/admin/profile` | 管理员个人信息 | `backend/app/api/admin_users.py` |
| PATCH | `/api/admin/profile` | 修改昵称、头像、密码 | `backend/app/api/admin_users.py` |
| GET | `/api/admin/users` | 用户列表 | `backend/app/api/admin_users.py` |
| POST | `/api/admin/users` | 新增用户 | `backend/app/api/admin_users.py` |
| GET | `/api/admin/users/{user_id}` | 用户详情 | `backend/app/api/admin_users.py` |
| PATCH | `/api/admin/users/{user_id}` | 修改用户 | `backend/app/api/admin_users.py` |
| DELETE | `/api/admin/users/{user_id}` | 删除用户 | `backend/app/api/admin_users.py` |
| GET | `/api/job-postings` | 岗位列表 | `backend/app/api/jobs.py` |
| GET | `/api/job-requirement-comparisons` | 岗位要求对比列表 | `backend/app/api/job_requirement_comparisons.py` |
| GET | `/api/job-requirement-comparisons/{profile_id}` | 岗位要求对比详情 | `backend/app/api/job_requirement_comparisons.py` |
| GET | `/api/admin/data-dashboard/major-distribution` | 就读专业分布统计 | `backend/app/api/admin_data_dashboard.py` |
| GET | `/api/admin/data-dashboard/competency-analysis` | 能力评估分析统计 | `backend/app/api/admin_data_dashboard.py` |
| GET | `/api/admin/data-dashboard/employment-trends` | 就业趋势洞察统计 | `backend/app/api/admin_data_dashboard.py` |

## 备注/状态

- 管理端路由继承 `/admin` 的 `canAdmin` 权限。
- `/admin/upload-data` 目前只是隐藏重定向路由，没有独立上传页面。

