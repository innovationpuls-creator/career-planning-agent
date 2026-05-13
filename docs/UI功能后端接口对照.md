# UI 功能后端接口对照

> 根据 `docs/UI功能详细整理.md` 的页面划分，列出每个页面调用的后端 API 端点。
> 最后更新：2026-05-08

---

## 路由挂载总览

| 路由变量 | 来源文件 | 前缀 |
|---|---|---|
| `auth_router` | `backend/app/api/auth.py` | `/api` |
| `user_profile_router` | `backend/app/api/user_profile.py` | `/api` |
| `student_competency_profile_router` | `backend/app/api/student_competency_profile.py` | `/api/student-competency-profile` |
| `snail_learning_path_router` | `backend/app/api/snail_learning_path.py` | *(无前缀，路径写在装饰器中)* |
| `career_development_report_router` | `backend/app/api/career_development_report.py` | *(无前缀，路径写在装饰器中)* |
| `job_requirement_graph_router` | `backend/app/api/job_requirement_graph.py` | `/api/job-requirement-profile` |
| `job_requirement_vertical_router` | `backend/app/api/job_requirement_vertical.py` | `/api/job-requirement-profile` |
| `job_requirement_comparisons_router` | `backend/app/api/job_requirement_comparisons.py` | `/api/job-requirement-comparisons` |
| `job_transfer_router` | `backend/app/api/job_transfer.py` | `/api/job-transfer` |
| `jobs_router` | `backend/app/api/jobs.py` | `/api/job-postings` |
| `admin_users_router` | `backend/app/api/admin_users.py` | `/api/admin` |
| `admin_data_dashboard_router` | `backend/app/api/admin_data_dashboard.py` | `/api/admin/data-dashboard` |
| `coach_router` | `backend/app/api/coach.py` | `/api/coach` |

另有独立端点：`GET /health`（`main.py`）

---

## 1. 登录页面 (`/user/login`)

| 端点 | 方法 | 类型 | 说明 |
|---|---|---|---|
| `/api/login/account` | POST | REST | 用户名+密码认证，返回 JWT |
| `/api/currentUser` | GET | REST | 获取当前登录用户信息 |

后端源码：`backend/app/api/auth.py`

---

## 2. 注册页面 (`/user/register`)

| 端点 | 方法 | 类型 | 说明 |
|---|---|---|---|
| `/api/register` | POST | REST | 创建新用户账号 |
| `/api/login/account` | POST | REST | 注册成功后自动登录 |
| `/api/currentUser` | GET | REST | 登录后获取用户信息 |

后端源码：`backend/app/api/auth.py`

---

## 3. 职业规划首页 (`/home-v2`)

| 端点 | 方法 | 类型 | 说明 |
|---|---|---|---|
| `/api/home-v2` | GET | REST | 获取首页数据：目标岗位、阶段、匹配度、管线状态 |
| `/api/user-profile/onboarding` | POST | REST (multipart) | 提交/编辑个人资料（姓名、学校、专业、学历、年级、目标岗位、简历图片） |
| `/api/currentUser` | GET | REST | 加载当前用户信息 |
| `/api/career-development-report/favorites` | GET | REST | 获取已收藏的目标岗位列表（管线展示用） |
| `/api/student-competency-profile/latest-analysis` | GET | REST | 获取最新能力分析（匹配度展示用） |

后端源码：`backend/app/api/user_profile.py`、`backend/app/api/career_development_report.py`、`backend/app/api/student_competency_profile.py`

---

## 4. 简历解构 (`/student-competency-profile`)

| 端点 | 方法 | 类型 | 说明 |
|---|---|---|---|
| `/api/student-competency-profile/runtime` | GET | REST | 获取 Dify 运行时配置（文件上传限制、开场白、字段定义） |
| `/api/student-competency-profile/latest-analysis` | GET | REST | 获取最新 12 维度分析及评分 |
| `/api/student-competency-profile/latest-analysis` | DELETE | REST | 重置/删除最新分析 |
| `/api/student-competency-profile/chat` | POST | REST (multipart) | 发送消息到 Dify 进行简历解析（非流式） |
| `/api/student-competency-profile/chat/stream` | POST | SSE (NDJSON) | 流式简历解析进度 |
| `/api/student-competency-profile/conversations/{id}` | GET | REST | 加载特定对话的画像数据 |
| `/api/student-competency-profile/result-sync` | POST | REST | 将编辑后的 12 维度结果同步回 Dify |
| `/api/student-competency-profile/status-events` | GET | REST | 轮询状态事件（进度追踪） |
| `/api/student-competency-profile/status-events` | POST | REST | 创建外部状态事件（Dify webhook） |
| `/api/career-development-report/job-exploration-match/init` | GET | REST | 初始化职业匹配（向量相似度） |
| `/api/career-development-report/job-exploration-match/report` | POST | REST | 生成自定义岗位匹配报告 |
| `/api/career-development-report/favorites` | GET | REST | 列出已收藏的目标 |
| `/api/career-development-report/favorites` | POST | REST | 添加收藏 |
| `/api/career-development-report/favorites/{id}` | DELETE | REST | 取消收藏 |
| `/api/job-postings/job-titles` | GET | REST | 获取岗位名称选项（匹配 UI 下拉用） |

后端源码：`backend/app/api/student_competency_profile.py`、`backend/app/api/career_development_report.py`、`backend/app/api/jobs.py`

---

## 5. 蜗牛学习路径 (`/snail-learning-path`)

| 端点 | 方法 | 类型 | 说明 |
|---|---|---|---|
| `/api/snail-learning-path/workspaces/{favorite_id}` | POST | REST | 从收藏的目标初始化蜗牛学习路径工作区 |
| `/api/career-development-report/snail-learning-path/workspaces/{favorite_id}` | POST | REST | 同上（兼容路径） |
| `/api/snail-learning-path/workspaces` | POST | REST | 创建工作区（无 favorite_id） |
| `/api/career-development-report/snail-learning-path/workspaces` | POST | REST | 同上（兼容路径） |
| `/api/snail-learning-path/workspaces/{id}/reviews` | POST | REST (multipart) | 创建周/月复盘（附证据文件） |
| `/api/career-development-report/snail-learning-path/workspaces/{id}/reviews` | POST | REST (multipart) | 同上（兼容路径） |
| `/api/snail-learning-path/workspaces/{id}/reviews` | GET | REST | 获取复盘列表 |
| `/api/career-development-report/snail-learning-path/workspaces/{id}/reviews` | GET | REST | 同上（兼容路径） |
| `/api/career-development-report/job-exploration-match/init` | GET | REST | 获取匹配初始数据 |
| `/api/career-development-report/favorites` | GET | REST | 获取收藏列表 |

> 前端使用 `requestWith404Fallback` 辅助函数，先尝试 `/api/career-development-report/snail-learning-path/...`，失败后回退到 `/api/snail-learning-path/...`。两条路径在后端指向同一处理器。

后端源码：`backend/app/api/snail_learning_path.py`

---

## 6. 个人职业成长报告 (`/personal-growth-report`)

| 端点 | 方法 | 类型 | 说明 |
|---|---|---|---|
| `.../personal-growth-report/workspaces/{favorite_id}` | GET | REST | 加载已有的成长报告工作区 |
| `.../personal-growth-report/workspaces/{favorite_id}` | PUT | REST | 保存编辑后的报告章节 |
| `.../personal-growth-report/workspaces/{favorite_id}/regenerate` | POST | REST | 通过 LLM 重新生成报告 |
| `.../personal-growth-report/bootstrap/regenerate` | POST | REST | 自动检测最新收藏并生成报告 |
| `.../personal-growth-report/workspaces/{favorite_id}/export` | POST | REST (二进制) | 导出报告为 DOCX 或 PDF |
| `.../personal-growth-report/tasks` | POST | REST | 创建异步报告生成任务 |
| `.../personal-growth-report/tasks/{task_id}` | GET | REST | 获取任务快照/状态 |
| `.../personal-growth-report/tasks/{task_id}/stream` | GET | SSE (NDJSON) | 流式任务进度事件 |
| `.../personal-growth-report/tasks/{task_id}/cancel` | POST | REST | 取消运行中的任务 |
| `/api/career-development-report/favorites` | GET | REST | 获取收藏列表 |

> 以上路径前缀均为 `/api/career-development-report`

后端源码：`backend/app/api/career_development_report.py`

---

## 7. 岗位能力图谱 (`/job-competency-graph`)

| 端点 | 方法 | 类型 | 说明 |
|---|---|---|---|
| `/api/job-requirement-profile/graph` | GET | REST | 从 Neo4j 获取三层知识图谱（职业 → 岗位 → 公司节点，12 维度需求边） |

后端源码：`backend/app/api/job_requirement_graph.py`

---

## 8. 同岗行业对比 (`/same-job-cross-industry`)

| 端点 | 方法 | 类型 | 说明 |
|---|---|---|---|
| `/api/job-requirement-profile/vertical` | GET | REST | 获取指定岗位的跨行业垂直对比数据 |
| `/api/job-requirement-profile/vertical/company-detail` | GET | REST | 获取特定公司级别的详情 |
| `/api/job-postings/job-titles` | GET | REST | 获取可用岗位名称选项 |
| `/api/job-postings/industries` | GET | REST | 根据所选岗位获取行业选项 |

后端源码：`backend/app/api/job_requirement_vertical.py`、`backend/app/api/jobs.py`

---

## 9. 岗位转换 (API only, 无前端页面)

> 岗位转换（Job Transfer）后端共有 8 个端点，当前无独立前端页面。仅 `getJobTransferOptions` 在 `api.ts` 中有定义但未被任何页面调用。

| 端点 | 方法 | 类型 | 说明 |
|---|---|---|---|
| `/api/job-transfer/options` | GET | REST | 获取可转换的岗位选项 |
| `/api/job-transfer/source/{career_id}` | GET | REST | 获取源岗位数据 |
| `/api/job-transfer/{career_id}` | GET | REST | 获取岗位转换画像 |
| `/api/job-transfer/{career_id}/stream` | GET | SSE | 流式岗位转换分析 |
| `/api/job-transfer/tasks` | POST | REST | 创建转换分析任务 |
| `/api/job-transfer/tasks/{task_id}` | GET | REST | 获取任务快照/状态 |
| `/api/job-transfer/tasks/{task_id}/stream` | GET | SSE | 流式任务进度 |
| `/api/job-transfer/tasks/{task_id}/cancel` | POST | REST | 取消任务 |

后端源码：`backend/app/api/job_transfer.py`

---

## 10. 管理员 — 个人信息 (`/admin/profile`)

| 端点 | 方法 | 类型 | 说明 |
|---|---|---|---|
| `/api/admin/profile` | GET | REST | 获取管理员个人信息 |
| `/api/admin/profile` | PATCH | REST | 修改昵称、头像、密码 |

后端源码：`backend/app/api/admin_users.py`

---

## 11. 管理员 — 用户管理 (`/admin/user-management`)

| 端点 | 方法 | 类型 | 说明 |
|---|---|---|---|
| `/api/admin/users` | GET | REST | 用户列表（分页，支持筛选） |
| `/api/admin/users` | POST | REST | 新增用户 |
| `/api/admin/users/{user_id}` | GET | REST | 获取单个用户详情 |
| `/api/admin/users/{user_id}` | PATCH | REST | 修改用户（昵称、角色、状态） |
| `/api/admin/users/{user_id}` | DELETE | REST | 删除用户（204） |

后端源码：`backend/app/api/admin_users.py`

---

## 12. 管理员 — 岗位知识库 (`/admin/job-postings`)

| 端点 | 方法 | 类型 | 说明 |
|---|---|---|---|
| `/api/job-postings` | GET | REST | 只读岗位列表（分页，多条件筛选） |
| `/api/job-postings/job-titles` | GET | REST | 获取去重岗位名称选项 |
| `/api/job-postings/industries` | GET | REST | 获取去重行业选项 |

后端源码：`backend/app/api/jobs.py`

---

## 13. 管理员 — 岗位要求对比 (`/admin/job-requirement-comparisons`)

| 端点 | 方法 | 类型 | 说明 |
|---|---|---|---|
| `/api/job-requirement-comparisons` | GET | REST | 岗位列表（分页，支持筛选） |
| `/api/job-requirement-comparisons/{profile_id}` | GET | REST | 查看详情：12 维度提取结果 + 合并原始文本 |

后端源码：`backend/app/api/job_requirement_comparisons.py`

---

## 14. 管理员 — 就读专业分布 (`/admin/major-distribution`)

| 端点 | 方法 | 类型 | 说明 |
|---|---|---|---|
| `/api/admin/data-dashboard/major-distribution` | GET | REST | 统计数据：总用户数、完成率、专业分布、学校分布 TOP 20、学历分布 |

后端源码：`backend/app/api/admin_data_dashboard.py`

---

## 15. 管理员 — 能力评估分析 (`/admin/competency-analysis`)

| 端点 | 方法 | 类型 | 说明 |
|---|---|---|---|
| `/api/admin/data-dashboard/competency-analysis` | GET | REST | 统计数据：总评估数、12 维度平均分、得分分布（高/中/低）、TOP 10 学生 |

后端源码：`backend/app/api/admin_data_dashboard.py`

---

## 16. 管理员 — 就业趋势洞察 (`/admin/employment-trends`)

| 端点 | 方法 | 类型 | 说明 |
|---|---|---|---|
| `/api/admin/data-dashboard/employment-trends` | GET | REST | 统计数据：总岗位数、总公司数、行业分布、热门岗位 TOP 20、薪资分布（4 档） |

后端源码：`backend/app/api/admin_data_dashboard.py`

---

## 17. AI 教练助手 (`/coach`)

前端路由：`/coach`，hideInMenu，通过直接链接或程序化跳转访问。

| 端点 | 方法 | 类型 | 说明 |
|---|---|---|---|
| `/api/coach/chat/stream` | POST | SSE (NDJSON) | 流式教练对话，返回 run_start/step/answer_delta/run_done/run_error 运行态事件 |
| `/api/coach/upload` | POST | REST | 上传简历文件（PDF/DOC/DOCX，最大 10MB） |
| `/api/coach/sessions` | GET | REST | 获取当前学生的会话列表 |
| `/api/coach/sessions/{id}` | GET | REST | 获取单个会话详情与历史消息 |
| `/api/coach/sessions/{id}` | DELETE | REST | 删除会话 |

后端源码：`backend/app/api/coach.py`

---

## SSE 流式端点汇总

| 端点 | 路由文件 | 用途 |
|---|---|---|
| `POST /api/student-competency-profile/chat/stream` | `student_competency_profile.py` | 简历解析进度流 |
| `POST /api/coach/chat/stream` | `coach.py` | 教练对话流（NDJSON） |
| `GET .../goal-setting-path-planning/tasks/{task_id}/stream` | `career_development_report.py` | 目标规划任务进度流 |
| `GET .../personal-growth-report/tasks/{task_id}/stream` | `career_development_report.py` | 成长报告生成进度流 |
| `GET /api/job-transfer/{career_id}/stream` | `job_transfer.py` | 岗位转换分析流 |
| `GET /api/job-transfer/tasks/{task_id}/stream` | `job_transfer.py` | 岗位转换任务进度流 |

> 所有 SSE 端点均使用 `application/x-ndjson`（换行分隔 JSON），而非 `text/event-stream` 格式。

---

## 发现：前端已定义但后端未实现的端点

前端 API 服务文件 (`myapp/src/services/ant-design-pro/api.ts`) 定义了以下函数，但在后端路由中**找不到对应实现**，调用会返回 404：

| 前端函数 | 端点 | 状态 |
|---|---|---|
| `createCareerDevelopmentGoalPlanTask` | `POST .../goal-setting-path-planning/tasks` | **后端缺失** |
| `getCareerDevelopmentGoalPlanTask` | `GET .../goal-setting-path-planning/tasks/{taskId}` | **后端缺失** |
| `updateCareerDevelopmentPlanWorkspace` | `PUT .../goal-setting-path-planning/workspaces/{favoriteId}` | **后端缺失** |
| `polishCareerDevelopmentPlanWorkspace` | `POST .../workspaces/{favoriteId}/polish` | **后端缺失** |
| `generateCareerDevelopmentPlanLearningResources` | `POST .../workspaces/{favoriteId}/learning-resources` | **后端缺失** |

共 5 个缺失端点，均属于 `goal-setting-path-planning`（目标设定路径规划）模块。

> **已解决**：`GET .../workspaces/{favoriteId}` 已于后端实现（`career_development_report.py:166`）。
> **已从前端移除**：`submitMilestone`、`integrityCheck`、`createReview`、`export` 四个端点已从前端 `api.ts` 中移除，不再需要后端对应实现。

---

## 后端端点完整清单（共 71 个路由）

| # | 方法 | 完整路径 | 路由文件 |
|---|---|---|---|
| 1 | GET | `/health` | `main.py` |
| 2 | POST | `/api/register` | `auth.py` |
| 3 | POST | `/api/login/account` | `auth.py` |
| 4 | GET | `/api/currentUser` | `auth.py` |
| 5 | POST | `/api/login/outLogin` | `auth.py` |
| 6 | POST | `/api/user-profile/onboarding` | `user_profile.py` |
| 7 | GET | `/api/home-v2` | `user_profile.py` |
| 8 | GET | `/api/student-competency-profile/runtime` | `student_competency_profile.py` |
| 9 | GET | `/api/student-competency-profile/latest-analysis` | `student_competency_profile.py` |
| 10 | DELETE | `/api/student-competency-profile/latest-analysis` | `student_competency_profile.py` |
| 11 | POST | `/api/student-competency-profile/chat` | `student_competency_profile.py` |
| 12 | POST | `/api/student-competency-profile/chat/stream` | `student_competency_profile.py` |
| 13 | GET | `/api/student-competency-profile/conversations/{id}` | `student_competency_profile.py` |
| 14 | POST | `/api/student-competency-profile/result-sync` | `student_competency_profile.py` |
| 15 | POST | `/api/student-competency-profile/status-events` | `student_competency_profile.py` |
| 16 | GET | `/api/student-competency-profile/status-events` | `student_competency_profile.py` |
| 17 | POST | `/api/snail-learning-path/workspaces/{favorite_id}` | `snail_learning_path.py` |
| 18 | POST | `/api/career-development-report/snail-learning-path/workspaces/{favorite_id}` | `snail_learning_path.py` |
| 19 | POST | `/api/snail-learning-path/workspaces` | `snail_learning_path.py` |
| 20 | POST | `/api/career-development-report/snail-learning-path/workspaces` | `snail_learning_path.py` |
| 21 | POST | `/api/snail-learning-path/workspaces/{id}/reviews` | `snail_learning_path.py` |
| 22 | POST | `/api/career-development-report/snail-learning-path/workspaces/{id}/reviews` | `snail_learning_path.py` |
| 23 | GET | `/api/snail-learning-path/workspaces/{id}/reviews` | `snail_learning_path.py` |
| 24 | GET | `/api/career-development-report/snail-learning-path/workspaces/{id}/reviews` | `snail_learning_path.py` |
| 25 | GET | `/api/career-development-report/job-exploration-match/init` | `career_development_report.py` |
| 26 | POST | `/api/career-development-report/job-exploration-match/report` | `career_development_report.py` |
| 27 | GET | `/api/career-development-report/favorites` | `career_development_report.py` |
| 28 | POST | `/api/career-development-report/favorites` | `career_development_report.py` |
| 29 | DELETE | `/api/career-development-report/favorites/{id}` | `career_development_report.py` |
| 30 | GET | `/api/career-development-report/goal-setting-path-planning/workspaces/{id}` | `career_development_report.py` |
| 31 | GET | `/api/career-development-report/goal-setting-path-planning/tasks/{id}/stream` | `career_development_report.py` |
| 32 | POST | `/api/career-development-report/personal-growth-report/tasks` | `career_development_report.py` |
| 33 | GET | `/api/career-development-report/personal-growth-report/tasks/{id}` | `career_development_report.py` |
| 34 | GET | `/api/career-development-report/personal-growth-report/tasks/{id}/stream` | `career_development_report.py` |
| 35 | POST | `/api/career-development-report/personal-growth-report/tasks/{id}/cancel` | `career_development_report.py` |
| 36 | GET | `/api/career-development-report/personal-growth-report/workspaces/{id}` | `career_development_report.py` |
| 37 | PUT | `/api/career-development-report/personal-growth-report/workspaces/{id}` | `career_development_report.py` |
| 38 | POST | `/api/career-development-report/personal-growth-report/workspaces/{id}/regenerate` | `career_development_report.py` |
| 39 | POST | `/api/career-development-report/personal-growth-report/bootstrap/regenerate` | `career_development_report.py` |
| 40 | POST | `/api/career-development-report/personal-growth-report/workspaces/{id}/export` | `career_development_report.py` |
| 41 | GET | `/api/job-requirement-profile/graph` | `job_requirement_graph.py` |
| 42 | GET | `/api/job-requirement-profile/vertical` | `job_requirement_vertical.py` |
| 43 | GET | `/api/job-requirement-profile/vertical/company-detail` | `job_requirement_vertical.py` |
| 44 | GET | `/api/job-requirement-comparisons` | `job_requirement_comparisons.py` |
| 45 | GET | `/api/job-requirement-comparisons/{id}` | `job_requirement_comparisons.py` |
| 46 | GET | `/api/job-transfer/options` | `job_transfer.py` |
| 47 | GET | `/api/job-transfer/source/{id}` | `job_transfer.py` |
| 48 | GET | `/api/job-transfer/{id}` | `job_transfer.py` |
| 49 | GET | `/api/job-transfer/{id}/stream` | `job_transfer.py` |
| 50 | POST | `/api/job-transfer/tasks` | `job_transfer.py` |
| 51 | GET | `/api/job-transfer/tasks/{id}` | `job_transfer.py` |
| 52 | POST | `/api/job-transfer/tasks/{id}/cancel` | `job_transfer.py` |
| 53 | GET | `/api/job-transfer/tasks/{id}/stream` | `job_transfer.py` |
| 54 | GET | `/api/job-postings` | `jobs.py` |
| 55 | GET | `/api/job-postings/job-titles` | `jobs.py` |
| 56 | GET | `/api/job-postings/industries` | `jobs.py` |
| 57 | GET | `/api/admin/users` | `admin_users.py` |
| 58 | POST | `/api/admin/users` | `admin_users.py` |
| 59 | GET | `/api/admin/users/{id}` | `admin_users.py` |
| 60 | DELETE | `/api/admin/users/{id}` | `admin_users.py` |
| 61 | PATCH | `/api/admin/users/{id}` | `admin_users.py` |
| 62 | GET | `/api/admin/profile` | `admin_users.py` |
| 63 | PATCH | `/api/admin/profile` | `admin_users.py` |
| 64 | GET | `/api/admin/data-dashboard/major-distribution` | `admin_data_dashboard.py` |
| 65 | GET | `/api/admin/data-dashboard/competency-analysis` | `admin_data_dashboard.py` |
| 66 | GET | `/api/admin/data-dashboard/employment-trends` | `admin_data_dashboard.py` |
| 67 | POST | `/api/coach/chat/stream` | `coach.py` |
| 68 | POST | `/api/coach/upload` | `coach_upload.py` |
| 69 | GET | `/api/coach/sessions` | `coach_sessions.py` |
| 70 | GET | `/api/coach/sessions/{id}` | `coach_sessions.py` |
| 71 | DELETE | `/api/coach/sessions/{id}` | `coach_sessions.py` |
