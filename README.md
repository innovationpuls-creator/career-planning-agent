<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="myapp/public/logo.svg">
  <img src="myapp/public/logo.svg" width="80" alt="Logo">
</picture>

<h1>大学生职业规划智能体</h1>

<p>AI 驱动的大学生职业发展平台 — 简历解构 · 岗位匹配 · 学习规划 · 成长报告</p>

<p>
  <a href="https://github.com/innovationpuls-creator/career-planning-agent/stargazers"><img src="https://img.shields.io/github/stars/innovationpuls-creator/career-planning-agent?style=for-the-badge&logo=github" alt="stars"></a>
  <a href="https://github.com/innovationpuls-creator/career-planning-agent/network"><img src="https://img.shields.io/github/forks/innovationpuls-creator/career-planning-agent?style=for-the-badge&logo=github" alt="forks"></a>
  <a href="https://github.com/innovationpuls-creator/career-planning-agent/issues"><img src="https://img.shields.io/github/issues/innovationpuls-creator/career-planning-agent?style=for-the-badge&logo=github" alt="issues"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/innovationpuls-creator/career-planning-agent?style=for-the-badge" alt="license"></a>
  <a href="https://github.com/innovationpuls-creator/career-planning-agent/commits/main"><img src="https://img.shields.io/github/last-commit/innovationpuls-creator/career-planning-agent?style=for-the-badge" alt="last commit"></a>
  <a href="https://github.com/innovationpuls-creator/career-planning-agent"><img src="https://img.shields.io/github/repo-size/innovationpuls-creator/career-planning-agent?style=for-the-badge" alt="repo size"></a>
</p>

<!-- TODO: add deployment URL when available -->
<p>
  <a href="#">Live Demo</a> &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="#-quick-start">Quick Start</a> &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="./docs/api-contract.md">Docs</a> &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="https://github.com/innovationpuls-creator/career-planning-agent/issues">Report Bug</a>
</p>

</div>

---

##  Preview

<p align="center">
  <img src="docs/images/preview-home.png" width="32%" alt="首页" />
  <img src="docs/images/preview-profile.png" width="32%" alt="能力画像" />
  <img src="docs/images/preview-report.png" width="32%" alt="成长报告" />
</p>

---

##  Core Workflow

```mermaid
graph LR
    A[📄 上传简历] --> B[🧠 AI 解析<br/>12 维度能力画像]
    B --> C[🎯 岗位匹配<br/>+ 行业对比]
    C --> D[🐌 蜗牛学习路径]
    D --> E[📊 职业成长报告]
    E --> F[📦 导出 DOCX / PDF]

    style A fill:#EEF3FB,stroke:#1655CC
    style B fill:#EDF7F0,stroke:#1F8E3D
    style C fill:#FDF6E3,stroke:#B07800
    style D fill:#EEF3FB,stroke:#1655CC
    style E fill:#EDF7F0,stroke:#1F8E3D
    style F fill:#FAFAFA,stroke:#98989D
```

---

##  Feature Cards

<table align="center">
  <tr>
    <td align="center" width="33%">
      <strong>📄 简历解构</strong><br/>
      <sub>上传简历 → AI 自动解析为 12 维度能力画像，支持流式对话修改</sub>
    </td>
    <td align="center" width="33%">
      <strong>🗺️ 岗位能力图谱</strong><br/>
      <sub>Neo4j 知识图谱可视化展示岗位能力要求，可交互探索</sub>
    </td>
    <td align="center" width="33%">
      <strong>🏢 同岗行业对比</strong><br/>
      <sub>同一岗位跨行业、跨公司的薪资与要求横向对比</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <strong>🎯 岗位智能匹配</strong><br/>
      <sub>基于向量相似度的个人能力 × 岗位要求匹配，支持收藏</sub>
    </td>
    <td align="center" width="33%">
      <strong>🐌 蜗牛学习路径</strong><br/>
      <sub>三阶段（短/中/长期）成长规划 + 周/月复盘 + 里程碑追踪</sub>
    </td>
    <td align="center" width="33%">
      <strong>📊 职业成长报告</strong><br/>
      <sub>AI 生成个性化报告，富文本编辑，导出 MD / DOCX / PDF</sub>
    </td>
  </tr>
</table>

---

##  Tech Stack

**Frontend**
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript)
![Ant Design](https://img.shields.io/badge/Ant_Design-5.25-1655CC?style=flat-square&logo=antdesign)
![Umi Max](https://img.shields.io/badge/Umi_Max-4.3-1677FF?style=flat-square)
![AntV G6](https://img.shields.io/badge/AntV_G6-5.0-2966D4?style=flat-square)
![TipTap](https://img.shields.io/badge/TipTap-3.22-333?style=flat-square)

**Backend**
![FastAPI](https://img.shields.io/badge/FastAPI-0.116-009688?style=flat-square&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=flat-square&logo=python)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00?style=flat-square)
![Pydantic](https://img.shields.io/badge/Pydantic-v2-E92063?style=flat-square&logo=pydantic)
![Dify](https://img.shields.io/badge/Dify-AI_Workflow-6C54FE?style=flat-square)

**Data**
![Neo4j](https://img.shields.io/badge/Neo4j-Graph-4581C3?style=flat-square&logo=neo4j)
![Qdrant](https://img.shields.io/badge/Qdrant-Vector-FF7F00?style=flat-square)
![SQLite](https://img.shields.io/badge/SQLite-lightweight-003B57?style=flat-square&logo=sqlite)

---

##  Quick Start

选择适合你的部署方式：

---

###  Option 1: Docker Compose（推荐）

一行命令启动所有服务，无需手动安装数据库和运行时环境。详情见 Docker 部署指南：

> [**📘 CentOS / Linux Docker 部署指南**](docs/deploy-centos.md)
>
> 适用 CentOS 7/8/9、Rocky Linux、AlmaLinux。macOS / Windows 用户安装 Docker Desktop 后同样适用，仅容器加速步骤可跳过。

快速上手：

```bash
git clone https://github.com/innovationpuls-creator/career-planning-agent.git
cd career-planning-agent
cp deploy/.env.example .env
docker compose up -d
docker compose exec -e PYTHONPATH=/app backend \
  python scripts/rebuild_job_transfer_v2.py --with-import --yes
# 访问 http://localhost （默认账号 admin / admin123）
```

---

###  Option 2: 源码部署（macOS / Windows）

适合本地开发、二次开发或调试的场景，需自行安装依赖。

####  macOS

##### 1. 安装基础工具

```bash
# Homebrew（如未安装）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Python 3.13
brew install python@3.13

# uv 包管理器
brew install uv

# Node.js 18+
brew install node@18
```

##### 2. 安装 Neo4j（图数据库）

```bash
brew install neo4j
brew services start neo4j
# 浏览器打开 http://localhost:7474，首次登录改密码
# 默认用户名/密码 neo4j/neo4j
```

##### 3. 安装 Qdrant（向量数据库）

项目自带 macOS ARM64 二进制，后端启动时会自动拉起，无需额外操作。

##### 4. 配置环境变量

```bash
cd backend
cp .env.example .env
# 编辑 .env，至少填写:
#   APP_SECRET_KEY=任意长随机字符串
#   NEO4J_PASSWORD=你在步骤 2 中设置的密码
```

##### 5. 启动后端

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 9100
# 首次启动会自动创建数据库和表、同步知识图谱、种子管理员账号
```

##### 6. 启动前端

```bash
cd myapp
npm install
npm start                               # → http://localhost:8000
```

##### 7. 导入初始数据

```bash
cd backend
uv run python scripts/rebuild_job_transfer_v2.py --with-import \
  --data-source-dir /path/to/行业数据
```

---

####  Windows

##### 1. 安装基础工具

```powershell
# Python 3.13
# 下载 https://www.python.org/downloads/ → 安装时勾选 "Add to PATH"

# uv 包管理器
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# Node.js 18+
# 下载 https://nodejs.org/ → LTS 版本安装
```

##### 2. 安装 Neo4j（图数据库）

1. 下载 **Neo4j Community Edition**：https://neo4j.com/download-center/
2. 选择 **Windows** 版本 → 运行安装程序
3. 以管理员身份打开 PowerShell：

```powershell
# 注册为 Windows 服务
& "C:\Program Files\Neo4j\bin\neo4j.ps1" install-service
& "C:\Program Files\Neo4j\bin\neo4j.ps1" start
```

4. 浏览器打开 `http://localhost:7474`，改密码后同步到 `.env`

##### 3. 安装 Qdrant（向量数据库）

推荐使用 Docker Desktop：

```powershell
docker pull qdrant/qdrant
docker run -d --name qdrant `
  -p 6333:6333 -p 6334:6334 `
  qdrant/qdrant
```

##### 4. 配置环境变量

```powershell
cd backend
copy .env.example .env
# 编辑 .env，至少填写 APP_SECRET_KEY 和 NEO4J_PASSWORD
```

##### 5. 启动后端

```powershell
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 9100
```

##### 6. 启动前端

```powershell
cd myapp
npm install
npm start                               # → http://localhost:8000
```

##### 7. 导入初始数据

```powershell
cd backend
uv run python scripts/rebuild_job_transfer_v2.py --with-import
```

---

###  验证是否成功

| 检查项 | 地址 | 说明 |
|--------|------|------|
| 前端页面 | `http://localhost:8000`（源码）或 `http://localhost`（Docker） | 能看到登录页 |
| 后端 API | `http://localhost:9100/docs`（源码）或 `http://localhost/api/docs`（Docker） | Swagger 文档 |
| Neo4j | `http://localhost:7474` | Browser 可登录查询 |
| Qdrant | `http://localhost:6333/healthz` | 返回 `OK` |
| 管理员登录 | 前端使用 admin / admin123 | 能进入管理后台 |

---

###  常见问题

**Q: 启动后端时提示 "Neo4j is not running"？**  
A: macOS 执行 `brew services list | grep neo4j`，Windows 检查 Windows 服务管理器。Docker 方式无需担心。

**Q: Qdrant 端口 6333 被占用？**  
A: 检查已有进程并关闭，或修改 `.env` 中 Qdrant 配置的端口。

**Q: Docker 方式如何更新代码？**  
A: `git pull && docker compose up -d --build backend`

**Q: SQLite 文件在哪？**  
A: `backend/data/app.db`，首次启动后端时自动创建。删除此文件可重置所有数据。

**Q: 不需要默认种子数据？**  
A: 可以跳过数据导入步骤。岗位匹配和知识图谱功能将不可用，但简历解析、学习路径等基础功能仍可正常使用。

---

##  Project Structure

```
career-planning-agent/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routers
│   │   ├── services/     # LLM, embedding, Dify, vector store
│   │   ├── models/       # SQLAlchemy ORM
│   │   └── schemas/      # Pydantic DTOs
│   └── tests/
├── myapp/
│   ├── src/
│   │   ├── pages/        # Route pages
│   │   ├── services/     # API client
│   │   └── components/   # Shared UI
│   └── config/
└── docs/
    ├── api-contract.md
    └── DESIGN_SYSTEM_SPEC.md
```

---

<details>
<summary>📋 环境变量说明</summary>

| 变量 | 说明 | 必填 |
|------|------|------|
| `APP_SECRET_KEY` | JWT 签名密钥 | ✅ |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | 大模型接口 | AI 功能 |
| `DIFY_BASE_URL` / `DIFY_API_KEY` | Dify 工作流 | 简历解析 / 报告生成 |
| `EMBEDDING_BASE_URL` / `EMBEDDING_API_KEY` | 向量嵌入 | 岗位匹配 |
| `NEO4J_URI` / `NEO4J_USERNAME` / `NEO4J_PASSWORD` | 图数据库 | 知识图谱 |
| `QDRANT_PATH` | 向量库路径 | 相似度搜索 |

完整配置见 `backend/.env.example`。
</details>

<details>
<summary>🗺️ Roadmap</summary>

- [x] 12 维度简历 AI 解析
- [x] 岗位知识图谱（Neo4j + G6 可视化）
- [x] 同岗行业纵向对比
- [x] 岗位向量匹配 + 收藏
- [x] 蜗牛学习路径三阶段规划
- [x] 个人职业成长报告（AI 生成 + 导出 DOCX/PDF）
- [x] 管理后台（用户管理 / 数据看板）
- [ ] 移动端适配
- [ ] 岗位投递追踪
- [ ] 导师 / 辅导员视角

</details>

<details>
<summary>📖 API 文档</summary>

所有接口规范见 [`docs/api-contract.md`](./docs/api-contract.md)，按页面分组，包含请求/响应示例、SSE 流格式和错误码约定。

后端启动后 Swagger UI：`http://127.0.0.1:9100/docs`。
</details>

---

<div align="center">
  <sub>Licensed under <a href="./LICENSE">Apache 2.0</a></sub>
</div>
