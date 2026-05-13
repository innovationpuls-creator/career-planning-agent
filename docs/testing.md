# 测试策略

> 最后更新：2026-05-08

---

## 测试工具

| 端 | 框架 | 说明 |
|---|---|---|
| 后端 | pytest | 单元测试 + 集成测试 |
| 前端 | Jest + React Testing Library | 组件单元测试，与页面文件同目录 |
| E2E | Playwright | 关键流程端到端测试 + 视觉回归截图 |

---

## 后端测试

### 运行

```bash
cd backend
pytest                              # 运行所有测试
pytest tests/ -v                    # 详细输出
pytest tests/ --cov=app --cov-report=term-missing  # 覆盖率
```

### 测试文件位置

```
backend/tests/
├── test_document_parser.py
├── test_embeddings.py
├── test_job_transfer.py
├── test_learning_resource_logos.py
├── ...
```

---

## 前端测试

### 运行

```bash
cd myapp
npx jest                           # 运行所有测试
npx jest --coverage                # 覆盖率报告
npx jest path/to/file.test.tsx     # 单个测试文件
```

### 测试组织

测试文件与页面/组件/工具函数同目录，使用 `.test.ts` 或 `.test.tsx` 后缀：

```
myapp/src/pages/home-v2/
├── index.tsx
├── index.test.tsx
├── components/
│   ├── HeroSection.tsx
│   ├── HeroSection.test.tsx
│   ├── PipelineSteps.tsx
│   └── PipelineSteps.test.tsx
└── hooks/
    ├── useHomeData.ts
    └── useHomeData.test.ts
```

### 覆盖率目标

- 工具函数和 hooks：≥ 80%
- UI 组件：重点在交互逻辑，视觉回归由 Playwright 补充
- 页面级组件：冒烟测试（基本渲染不出错）

---

## E2E 测试 (Playwright)

### 视觉回归截图

截图脚本位于 `docs/images/test/`：

```bash
# 完整页面截图
cd docs/images/test
node screenshot.js --full-only

# 分区域截图
node screenshot.js --sections
```

### 截图阶段

| 阶段 | 覆盖页面 |
|---|---|
| Phase 1 | 登录、首页、学生画像、管理员页面（9 张） |
| Phase 2 | UI 组件库（10 张） |
| Phase 3 | 登录/注册（8 张） |
| Phase 4 | 首页 v2（5 张） |
| Phase 5 | 简历解析 + 职业匹配（12 张） |
| Phase 6 | 学习路径（1 张） |
| BackgroundFix | 背景修复回归（9 张） |
| Header | 导航栏（3 张） |

截图文件存放在对应阶段目录下，文件名描述截图场景。

### 关键用户流程

1. 注册 → 登录 → 首页
2. 上传简历 → SSE 解析 → 查看能力画像 → 编辑关键字
3. 职业匹配 → 查看对比 → 收藏岗位
4. 收藏 → 初始化学习路径 → 提交复盘
5. 生成成长报告 → 编辑 → 导出

---

## CI 注意事项

- 前端测试不依赖后端运行（mock API 调用）
- 后端测试使用 SQLite 内存数据库
- Playwright E2E 测试需先启动前后端服务
