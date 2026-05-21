# 简历解构

> 来源：`myapp/config/routes.ts`、`myapp/src/pages/student-competency-profile/**`、`myapp/src/services/ant-design-pro/api.ts`、`backend/app/api/student_competency_profile.py`

## 页面

| 路由 | 组件 | 权限 | 菜单状态 |
|---|---|---|---|
| `/student-competency-profile` | `./student-competency-profile` | `canUser` | 可见 |

## 功能

- 上传简历或补充材料并触发流式解析。
- 支持多轮追加文本或文件。
- 解析过程显示 NDJSON 进度事件。
- 展示能力雷达、差距分析、关键字提取三个结果 Tab。
- 关键字提取 Tab 支持编辑 12 维关键词并保存。
- 支持重新解析，清空最新分析与本地缓存。
- 本地缓存会保存会话、结果 Tab、活跃差距维度等状态。
- 可从结果区域跳转 AI 教练，携带 `step=resume` 和来源页面上下文。

## 前端调用

| 前端函数 | 方法 | 路径 | 用途 |
|---|---|---|---|
| `getStudentCompetencyLatestAnalysis` | GET | `/api/student-competency-profile/latest-analysis` | 页面初始化获取最新分析 |
| `getStudentCompetencyConversation` | GET | `/api/student-competency-profile/conversations/{workspaceConversationId}` | 有最新会话时恢复对话元数据 |
| `streamStudentCompetencyChat` | POST | `/api/student-competency-profile/chat/stream` | 流式解析简历/材料 |
| `syncStudentCompetencyResult` | POST | `/api/student-competency-profile/result-sync` | 保存编辑后的 12 维关键词 |
| `deleteStudentCompetencyLatestAnalysis` | DELETE | `/api/student-competency-profile/latest-analysis` | 重新解析时删除最新分析 |

## 后端端点

| 方法 | 路径 | 说明 | 源码 |
|---|---|---|---|
| GET | `/api/student-competency-profile/latest-analysis` | 最新能力分析 | `backend/app/api/student_competency_profile.py` |
| DELETE | `/api/student-competency-profile/latest-analysis` | 删除最新能力分析 | `backend/app/api/student_competency_profile.py` |
| POST | `/api/student-competency-profile/chat/stream` | NDJSON 流式解析 | `backend/app/api/student_competency_profile.py` |
| GET | `/api/student-competency-profile/conversations/{workspace_conversation_id}` | 会话画像数据 | `backend/app/api/student_competency_profile.py` |
| POST | `/api/student-competency-profile/result-sync` | 同步编辑结果 | `backend/app/api/student_competency_profile.py` |

## 后端已实现但页面当前未调用

| 方法 | 路径 | 状态 |
|---|---|---|
| GET | `/api/student-competency-profile/runtime` | `api.ts` 已封装，当前页面未调用 |
| POST | `/api/student-competency-profile/chat` | 非流式接口，`api.ts` 已封装，当前页面未调用 |
| GET | `/api/student-competency-profile/status-events` | `api.ts` 已封装，当前页面未调用 |
| POST | `/api/student-competency-profile/status-events` | 后端 webhook/外部状态写入能力，前端未调用 |

## 备注/状态

- 实际流式格式为 `application/x-ndjson`，事件顺序为 `meta -> delta* -> done/error`。
- 前后端可识别的上传扩展名覆盖文档、图片及部分办公格式；前端展示标签为 PDF、DOC、DOCX、TXT、JPG、PNG，但共享 accept 列表更宽。
- 12 维 key 必须使用 AGENTS.md 中定义的英文 key。

