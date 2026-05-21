# UI 功能模块索引

> 最后更新：2026-05-21  
> 口径：以当前前后端源码实际实现为准。路由来自 `myapp/config/routes.ts`，前端调用来自 `myapp/src/pages/**` 与 `myapp/src/services/ant-design-pro/api.ts`，后端端点来自 `backend/app/main.py` 与 `backend/app/api/**/*.py`。

## 模块文件

| 模块 | 文件 | 说明 |
|---|---|---|
| 登录与注册 | [01-auth.md](./01-auth.md) | `/user/login` 与 `/user/register` |
| 职业规划首页 | [02-home-v2.md](./02-home-v2.md) | `/home-v2` |
| 简历解构 | [03-student-competency-profile.md](./03-student-competency-profile.md) | `/student-competency-profile` |
| 职业匹配 | [04-career-match.md](./04-career-match.md) | `/career-match` |
| 蜗牛学习路径 | [05-snail-learning-path.md](./05-snail-learning-path.md) | `/snail-learning-path` |
| 个人职业成长报告 | [06-personal-growth-report.md](./06-personal-growth-report.md) | `/personal-growth-report` |
| 岗位能力图谱 | [07-job-competency-graph.md](./07-job-competency-graph.md) | `/job-competency-graph` |
| 同岗行业对比 | [08-same-job-cross-industry.md](./08-same-job-cross-industry.md) | `/same-job-cross-industry` |
| 管理端 | [09-admin.md](./09-admin.md) | `/admin/**` |
| AI 教练 | [10-coach.md](./10-coach.md) | `/coach` 与 `/api/coach/**` |
| API-only 与未对齐项 | [11-api-only.md](./11-api-only.md) | 当前无独立页面或前后端未对齐的接口 |

## 文档结构

每个模块按同一结构维护：

- 页面：实际路由、组件、权限与菜单状态。
- 功能：页面当前可见或可触发的功能。
- 前端调用：页面实际使用的 API 函数。
- 后端端点：对应的后端方法与路径。
- 备注/状态：源码发现的限制、兼容路径、未调用接口或缺失实现。

