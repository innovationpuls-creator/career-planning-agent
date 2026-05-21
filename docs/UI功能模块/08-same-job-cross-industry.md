# 同岗行业对比

> 来源：`myapp/config/routes.ts`、`myapp/src/pages/job-requirement-profile/vertical/**`、`myapp/src/components/VerticalTierComparison/**`、`backend/app/api/job_requirement_vertical.py`、`backend/app/api/jobs.py`

## 页面

| 路由 | 组件 | 权限 | 菜单状态 |
|---|---|---|---|
| `/same-job-cross-industry` | `./job-requirement-profile/vertical` | `canUser` | 可见 |

## 功能

- 加载岗位名称选项。
- 选择岗位名称后动态加载行业选项。
- 支持多选行业并查询对比结果。
- 展示查询摘要。
- 按初级、中级、高级分层展示薪资范围、公司样本与 12 维度覆盖差异。
- 分层详情中可继续读取公司级岗位详情。

## 前端调用

| 前端函数 | 方法 | 路径 | 用途 |
|---|---|---|---|
| `getJobTitleOptions` | GET | `/api/job-postings/job-titles` | 岗位名称下拉 |
| `getIndustryOptionsByJobTitle` | GET | `/api/job-postings/industries` | 岗位对应行业选项 |
| `getVerticalJobProfile` | GET | `/api/job-requirement-profile/vertical` | 跨行业分层对比 |
| `getVerticalJobProfileCompanyDetail` | GET | `/api/job-requirement-profile/vertical/company-detail` | 公司级详情 |

## 后端端点

| 方法 | 路径 | 说明 | 源码 |
|---|---|---|---|
| GET | `/api/job-postings/job-titles` | 岗位名称选项 | `backend/app/api/jobs.py` |
| GET | `/api/job-postings/industries` | 行业选项 | `backend/app/api/jobs.py` |
| GET | `/api/job-requirement-profile/vertical` | 同岗跨行业对比数据 | `backend/app/api/job_requirement_vertical.py` |
| GET | `/api/job-requirement-profile/vertical/company-detail` | 公司级详情 | `backend/app/api/job_requirement_vertical.py` |

## 备注/状态

- 该页面只读，不保存用户选择。
- 行业选项依赖已选岗位；未选择岗位时不会发起对比查询。

