# 登录与注册

> 来源：`myapp/config/routes.ts`、`myapp/src/pages/user/layout.tsx`、`myapp/src/pages/user/components/LoginContent.tsx`、`myapp/src/pages/user/components/RegisterContent.tsx`、`backend/app/api/auth.py`、`backend/app/api/user_profile.py`、`backend/app/api/jobs.py`

## 页面

| 路由 | 组件/行为 | 权限 | 菜单状态 |
|---|---|---|---|
| `/user/login` | `./user/layout`，内部按模式展示登录或注册表单 | 公开 | `layout: false` |
| `/user/register` | 重定向到 `/user/login?mode=register` | 公开 | 不进主菜单 |
| `/user` | 重定向到 `/user/login` | 公开 | 不进主菜单 |

## 功能

### `/user/login`

- 用户名、密码登录。
- 记住登录：控制 token 持久化。
- 忘记密码：前端提示“请联系管理员重置密码”，没有后端重置接口。
- 登录成功后调用当前用户接口，并按角色跳转。
- 可切换到注册表单。

### `/user/register`

- 三步注册向导：账号、基础信息、简历图片。
- 基础信息包含姓名、学校、专业、学历、年级、目标岗位。
- 目标岗位下拉选项来自岗位名称 API。
- 简历图片上传使用 `image_files`，前端 accept 为 `.jpg,.jpeg,.png,.webp`。
- 注册成功后自动登录，再提交 onboarding 资料，最后跳转 `/home-v2`。

## 前端调用

| 前端函数 | 方法 | 路径 | 使用位置 |
|---|---|---|---|
| `login` | POST | `/api/login/account` | 登录表单、注册后自动登录 |
| `currentUser` | GET | `/api/currentUser` | 登录成功后的 `fetchUserInfo` |
| `register` | POST | `/api/register` | 注册第一阶段提交账号 |
| `getJobTitleOptions` | GET | `/api/job-postings/job-titles` | 注册目标岗位下拉 |
| `submitOnboardingProfile` | POST | `/api/user-profile/onboarding` | 注册后提交基础资料和图片 |

## 后端端点

| 方法 | 路径 | 说明 | 源码 |
|---|---|---|---|
| POST | `/api/login/account` | 用户名、密码认证，返回 JWT | `backend/app/api/auth.py` |
| GET | `/api/currentUser` | 获取当前登录用户信息 | `backend/app/api/auth.py` |
| POST | `/api/register` | 创建新用户账号 | `backend/app/api/auth.py` |
| GET | `/api/job-postings/job-titles` | 返回去重岗位名称选项 | `backend/app/api/jobs.py` |
| POST | `/api/user-profile/onboarding` | 提交/更新学生资料与附件 | `backend/app/api/user_profile.py` |

## 备注/状态

- `POST /api/login/outLogin` 已实现，并由右上角头像下拉组件使用，不属于登录页内调用。
- `/user/register` 不是独立 React 页面；当前注册入口通过登录页布局的 mode 切换实现。

