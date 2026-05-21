# 岗位能力图谱

> 来源：`myapp/config/routes.ts`、`myapp/src/pages/job-requirement-profile/overview/**`、`backend/app/api/job_requirement_graph.py`、`backend/app/api/job_requirement_vertical.py`

## 页面

| 路由 | 组件 | 权限 | 菜单状态 |
|---|---|---|---|
| `/job-competency-graph` | `./job-requirement-profile/overview` | `canUser` | 可见 |

## 功能

- 展示三层岗位要求画像图谱：根节点、维度组、12 维度节点。
- 点击节点聚焦并高亮相关节点与边。
- 右侧详情面板展示节点描述、招聘关键词、画像数量、非默认数量、覆盖度百分比。
- 若节点带有公司详情查询条件，详情面板加载代表招聘样本。
- 展示图例和图谱阅读指南。

## 前端调用

| 前端函数 | 方法 | 路径 | 用途 |
|---|---|---|---|
| `getJobRequirementProfileGraph` | GET | `/api/job-requirement-profile/graph` | 获取图谱节点与边 |
| `getVerticalJobProfileCompanyDetail` | GET | `/api/job-requirement-profile/vertical/company-detail` | 获取代表招聘样本 |

## 后端端点

| 方法 | 路径 | 说明 | 源码 |
|---|---|---|---|
| GET | `/api/job-requirement-profile/graph` | 从 Neo4j 读取岗位要求画像图谱 | `backend/app/api/job_requirement_graph.py` |
| GET | `/api/job-requirement-profile/vertical/company-detail` | 读取公司级岗位详情 | `backend/app/api/job_requirement_vertical.py` |

## 备注/状态

- 图谱服务依赖 Neo4j；后端不可用时返回 503，前端显示加载失败。
- 图谱结构由 `backend/app/services/job_requirement_graph.py` 中的 `GRAPH_GROUPS` 定义。

