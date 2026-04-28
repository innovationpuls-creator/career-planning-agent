# CentOS 部署指南

> 适用版本：CentOS 7 / 8 / 9（Rocky Linux / AlmaLinux 兼容）
> 
> 提供两种部署方式：
> - **方案 A（推荐）**：Docker Compose — 一键部署，环境隔离，维护简单
> - **方案 B**：裸机部署 — 传统 systemd 服务管理，适合无 Docker 环境

---

## 方案 A（推荐）：Docker Compose 部署

使用 Docker Compose 一键启动所有服务（Nginx + 前端 + 后端 FastAPI + Neo4j + Qdrant）。

### 架构

```
Nginx (port 80)
├── / → 前端静态文件（内置）
├── /api/ → proxy_pass → backend:9100 (FastAPI)
└── /static/ → proxy_pass → backend:9100

backend:9100 ──→ neo4j:7687 (Bolt)
             ──→ qdrant:6333 (HTTP)
```

### 前置条件

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | bash
sudo systemctl enable --now docker

# 安装 Docker Compose v2（通常已随 Docker 安装）
docker compose version
```

### 一键部署

```bash
# 1. 克隆代码
git clone <your-repo-url> /opt/career-planning-agent
cd /opt/career-planning-agent

# 2. 配置环境变量
cp deploy/.env.example .env
# 编辑 .env：
#   - APP_SECRET_KEY: openssl rand -hex 32 生成
#   - APP_DOMAIN: 服务器 IP 或域名
#   - NEO4J_PASSWORD: 设置一个强密码

# 3. 一键构建并启动
bash deploy/start.sh
```

> 首次启动需要下载基础镜像（约 10 分钟，取决于网络），后续启动仅需数秒。

### 验证部署

```bash
# 检查所有容器状态
docker compose ps

# 查看日志
docker compose logs -f --tail=50

# 测试后端健康
curl http://localhost/api/

# 访问前端
curl http://localhost/
```

### 日常维护

```bash
# 查看日志
docker compose logs -f          # 所有服务
docker compose logs backend     # 仅后端
docker compose logs neo4j       # 仅 Neo4j

# 重启
docker compose restart

# 更新代码后重新构建
git pull
docker compose up -d --build

# 停止
docker compose down

# 停止并删除所有数据（⚠️ 谨慎）
docker compose down -v
```

### 备份数据

```bash
# 备份 SQLite + Qdrant + Neo4j 数据卷
docker run --rm -v career_planning_agent_backend_data:/data \
  -v /backup:/backup alpine \
  tar -czf /backup/data-$(date +%Y%m%d).tar.gz -C /data .
```

### 注意事项

- **HTTPS**: 生产环境建议在前置使用 Caddy 或 Traefik 自动管理 Let's Encrypt 证书
- **内存**: Neo4j + Qdrant 推荐至少 4GB 可用内存
- **Neo4j 密码**: 首次部署后可通过 Neo4j Browser (`http://<IP>:7474`) 修改
- **CORS**: 如使用自定义域名，需在 `.env` 中设置 `APP_DOMAIN`

---

## 方案 B：裸机部署

---

## 目录

1. [系统准备](#1-系统准备)
2. [安装运行时](#2-安装运行时)
3. [安装 Neo4j](#3-安装-neo4j)
4. [安装 Qdrant](#4-安装-qdrant)
5. [克隆项目 & 配置](#5-克隆项目--配置)
6. [初始化后端](#6-初始化后端)
7. [初始化前端](#7-初始化前端)
8. [配置 Nginx 反向代理](#8-配置-nginx-反向代理)
9. [配置 systemd 服务](#9-配置-systemd-服务)
10. [导入初始数据](#10-导入初始数据)
11. [验证部署](#11-验证部署)
12. [日常维护](#12-日常维护)

---

## 1. 系统准备

```bash
# 更新系统
sudo yum update -y

# 基础依赖
sudo yum install -y epel-release
sudo yum install -y git curl wget tar gzip make gcc gcc-c++

# 如有 firewalld，确保已安装并运行
sudo yum install -y firewalld
sudo systemctl enable --now firewalld
```

---

## 2. 安装运行时

### 2.1 安装 uv（Python 包管理器）

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
# 重新登录终端，或 source 环境变量
source ~/.bashrc
uv --version
```

### 2.2 安装 Python 3.13（通过 uv）

CentOS 默认 Python 版本较低，使用 uv 管理独立版本：

```bash
uv python install 3.13
uv python list           # 确认 3.13 已安装
```

### 2.3 安装 Node.js 20 LTS

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
node --version    # 确认 v20.x
npm --version
```

---

## 3. 安装 Neo4j

Neo4j 官方提供 RPM 包（仅 Enterprise），Community 版需手动安装。

### 3.1 下载并解压

```bash
cd /opt
# 以 Neo4j 5 Community 为例
# 实际版本号请参考 https://neo4j.com/download-center/
sudo wget https://dist.neo4j.org/neo4j-community-5.26.5-unix.tar.gz
sudo tar -xzf neo4j-community-5.26.5-unix.tar.gz
sudo mv neo4j-community-5.26.5 neo4j
sudo rm -f neo4j-community-5.26.5-unix.tar.gz
```

### 3.2 创建运行用户

```bash
sudo useradd -r -s /sbin/nologin neo4j
sudo chown -R neo4j:neo4j /opt/neo4j
```

### 3.3 配置 Neo4j

```bash
sudo tee -a /opt/neo4j/conf/neo4j.conf << 'EOF'

# 允许远程连接（如本机部署可跳过）
server.default_listen_address=0.0.0.0
# 内存配置（根据服务器内存调整）
server.memory.heap.initial_size=512m
server.memory.heap.max_size=1g
server.memory.pagecache.size=512m
EOF
```

### 3.4 配置 systemd 服务

```bash
sudo tee /etc/systemd/system/neo4j.service << 'EOF'
[Unit]
Description=Neo4j Graph Database
After=network.target

[Service]
Type=forking
User=neo4j
Group=neo4j
ExecStart=/opt/neo4j/bin/neo4j start
ExecStop=/opt/neo4j/bin/neo4j stop
ExecReload=/opt/neo4j/bin/neo4j restart
PIDFile=/opt/neo4j/run/neo4j.pid
LimitNOFILE=60000

[Install]
WantedBy=multi-user.target
EOF
```

### 3.5 启动 Neo4j

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now neo4j

# 查看启动日志
sudo journalctl -u neo4j -f --no-pager
```

### 3.6 设置密码

```bash
# 默认密码 neo4j，首次访问会要求修改
# 使用 curl 修改密码（替换 your_password 为你的密码）
curl -H "Content-Type: application/json" \
  -d '{"password":"your_password"}' \
  -u neo4j:neo4j \
  http://localhost:7474/user/neo4j/password

# 验证连接
curl -u neo4j:your_password http://localhost:7474/
```

> 记下修改后的密码，后续需填入 `.env` 的 `NEO4J_PASSWORD`。

### 3.7 防火墙放行

```bash
sudo firewall-cmd --add-port=7474/tcp --permanent   # HTTP Browser
sudo firewall-cmd --add-port=7687/tcp --permanent   # Bolt 协议
sudo firewall-cmd --reload
```

---

## 4. 安装 Qdrant

CentOS 上推荐使用 Docker 运行 Qdrant。如无 Docker，也可直接下载二进制。

### 4.1 方式 A：Docker

```bash
# 安装 Docker
sudo yum install -y yum-utils device-mapper-persistent-data lvm2
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl enable --now docker

# 拉取并运行 Qdrant
sudo mkdir -p /opt/qdrant_storage
sudo docker run -d --name qdrant \
  --restart always \
  -p 6333:6333 -p 6334:6334 \
  -v /opt/qdrant_storage:/qdrant/storage \
  qdrant/qdrant

# 验证
curl http://localhost:6333/healthz
```

### 4.2 方式 B：直接运行二进制

```bash
cd /opt
# 从 GitHub 下载对应架构的二进制
# https://github.com/qdrant/qdrant/releases
sudo wget https://github.com/qdrant/qdrant/releases/latest/download/qdrant-x86_64-unknown-linux-gnu.tar.gz
sudo tar -xzf qdrant-x86_64-unknown-linux-gnu.tar.gz
sudo mv qdrant-x86_64-unknown-linux-gnu qdrant
sudo rm -f qdrant-x86_64-unknown-linux-gnu.tar.gz

# 创建数据目录
sudo mkdir -p /opt/qdrant/storage
sudo mkdir -p /opt/qdrant/config

# 配置文件
sudo tee /opt/qdrant/config/config.yaml << 'EOF'
service:
  host: 0.0.0.0
  http_port: 6333
  grpc_port: 6334
storage:
  storage_path: /opt/qdrant/storage
EOF
```

#### 4.2.1 配置 systemd 服务

```bash
sudo tee /etc/systemd/system/qdrant.service << 'EOF'
[Unit]
Description=Qdrant Vector Search Engine
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/qdrant
ExecStart=/opt/qdrant/qdrant --config-path /opt/qdrant/config/config.yaml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now qdrant
```

### 4.3 防火墙放行

```bash
sudo firewall-cmd --add-port=6333/tcp --permanent
sudo firewall-cmd --add-port=6334/tcp --permanent
sudo firewall-cmd --reload
```

---

## 5. 克隆项目 & 配置

### 5.1 克隆代码

```bash
cd /opt
sudo git clone https://github.com/innovationpuls-creator/career-planning-agent.git
sudo chown -R $(whoami):$(whoami) /opt/career-planning-agent
cd /opt/career-planning-agent
```

### 5.2 配置环境变量

```bash
cd backend
cp .env.example .env
vi .env
```

至少需要修改以下字段：

```ini
# 后端安全 — 任意长随机字符串
APP_SECRET_KEY=your-random-secret-here

# Neo4j 连接信息（使用第 3 步设定的密码）
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
NEO4J_DATABASE=neo4j

# Qdrant（默认配置无需修改）
QDRANT_PATH=/opt/career-planning-agent/backend/data/qdrant
```

> AI 功能（简历解析、报告生成、岗位匹配）需额外配置 LLM / Dify / Embedding 凭据，否则启动后仅可使用基础功能。

---

## 6. 初始化后端

### 6.1 安装 Python 依赖

```bash
cd /opt/career-planning-agent/backend
uv sync
```

### 6.2 处理 brew 自动启动问题

> **重要**：后端的 `app/main.py` 中 `_ensure_neo4j_running()` 使用 `brew services` 检测并启动 Neo4j，这在 CentOS 上不可用。
>
> 方案：修改 `main.py`，让后端跳过自动服务管理，依赖手动启动的 systemd 服务。

编辑 `backend/app/main.py`，找到 `_ensure_neo4j_running` 和 `_ensure_qdrant_running` 的定义位置（约第 266 行），替换为以下内容：

```python
import os

def _is_neo4j_running() -> bool:
    import socket
    try:
        with socket.create_connection(("127.0.0.1", 7687), timeout=2):
            return True
    except OSError:
        return False

def _is_qdrant_running() -> bool:
    import urllib.request
    try:
        resp = urllib.request.urlopen("http://127.0.0.1:6333/healthz", timeout=2)
        return resp.status == 200
    except Exception:
        return False

_neo4j_started_by_backend: bool = False

def _ensure_neo4j_running() -> None:
    if _is_neo4j_running():
        return
    global _neo4j_started_by_backend
    print("[neo4j] NOT running — start it manually: sudo systemctl start neo4j", flush=True)

def _ensure_qdrant_running() -> None:
    if _is_qdrant_running():
        return
    print("[qdrant] NOT running — start it manually: sudo systemctl start qdrant", flush=True)

def _stop_neo4j() -> None:
    pass

def _stop_qdrant() -> None:
    pass
```

> 也可在 `main.py` 搜索 `_ensure_neo4j_running` 和 `_ensure_qdrant_running` 的**调用位置**，将其包裹在 `try/except` 中 — 这样即使自动启动失败也不会阻断后续流程。

### 6.3 启动后端

```bash
cd /opt/career-planning-agent/backend

# 先确认 Neo4j 和 Qdrant 已运行
sudo systemctl status neo4j
curl http://localhost:6333/healthz

# 启动后端（开发调试用）
uv run uvicorn app.main:app --host 0.0.0.0 --port 9100

# 首次启动会自动：
#   - 创建 data/app.db（SQLite）
#   - 创建所有数据库表
#   - 同步岗位知识图谱到 Neo4j
#   - 种子管理员账号（admin / admin123）
```

确认启动成功后按 `Ctrl+C` 停止。后续通过 systemd 管理。

---

## 7. 初始化前端

```bash
cd /opt/career-planning-agent/myapp
npm install

# 构建生产环境静态文件
npm run build
# 构建产物在 myapp/dist/ 目录
```

---

## 8. 配置 Nginx 反向代理

### 8.1 安装 Nginx

```bash
sudo yum install -y nginx
sudo systemctl enable --now nginx
```

### 8.2 配置站点

```bash
sudo tee /etc/nginx/conf.d/career-planning.conf << 'EOF'
server {
    listen 80 default_server;
    server_name _;

    # 前端静态文件
    root /opt/career-planning-agent/myapp/dist;
    index index.html;

    # gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:9100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;

        # SSE 流式支持
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
    }

    # Swagger / OpenAPI
    location /docs {
        proxy_pass http://127.0.0.1:9100/docs;
        proxy_set_header Host $host;
    }
    location /openapi.json {
        proxy_pass http://127.0.0.1:9100/openapi.json;
        proxy_set_header Host $host;
    }

    # SPA 路由 — 所有非文件请求返回 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF
```

### 8.3 防火墙放行

```bash
sudo firewall-cmd --add-service=http --permanent
sudo firewall-cmd --add-service=https --permanent
sudo firewall-cmd --reload
```

### 8.4 测试并重载 Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

> 如需 HTTPS，可使用 certbot + Let's Encrypt：
> ```bash
> sudo yum install -y certbot python3-certbot-nginx
> sudo certbot --nginx -d your-domain.com
> ```

---

## 9. 配置 systemd 服务

### 9.1 后端 API 服务

```bash
sudo tee /etc/systemd/system/career-api.service << 'EOF'
[Unit]
Description=Career Planning API (FastAPI)
After=network.target neo4j.service qdrant.service
Wants=neo4j.service qdrant.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/career-planning-agent/backend
Environment=PATH=/root/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin
ExecStart=/root/.local/bin/uv run uvicorn app.main:app --host 0.0.0.0 --port 9100
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

> 注意：`/root/.local/bin/uv` 是 uv 默认安装路径。如使用普通用户部署，改为对应的 home 路径。

### 9.2 启用服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now career-api

# 查看日志
sudo journalctl -u career-api -f --no-pager
```

---

## 10. 导入初始数据

首次部署需要导入行业数据，否则岗位匹配和知识图谱功能不可用。

```bash
cd /opt/career-planning-agent/backend

# 默认数据源路径为 Windows 路径，需使用 --data-source-dir 指定实际目录
# 将行业数据文件夹上传至服务器后执行：
uv run python scripts/rebuild_job_transfer_v2.py --with-import \
  --data-source-dir /path/to/行业数据
```

---

## 11. 验证部署

| 检查项 | 命令 / URL | 预期结果 |
|--------|------------|----------|
| Neo4j | `curl http://localhost:7474` | 返回 JSON，含 `"neo4j_version"` |
| Qdrant | `curl http://localhost:6333/healthz` | 返回 `OK` |
| 后端 API | `curl http://localhost:9100/docs` | 返回 Swagger HTML |
| 前端页面 | `curl http://localhost/` | 返回 index.html |
| 管理员登录 | 浏览器访问 http://服务器IP/ → admin / admin123 | 能进入管理后台 |

---

## 12. 日常维护

### 查看日志

```bash
sudo journalctl -u career-api -f --no-pager
sudo journalctl -u neo4j -f --no-pager
sudo journalctl -u qdrant -f --no-pager
```

### 重启服务

```bash
sudo systemctl restart career-api
sudo systemctl restart neo4j
sudo systemctl restart qdrant
```

### 更新代码

```bash
cd /opt/career-planning-agent
git pull

# 更新后端依赖
cd backend && uv sync

# 重建前端
cd ../myapp && npm install && npm run build

# 重启 API
sudo systemctl restart career-api
```

### 备份数据

```bash
# SQLite 数据库
cp /opt/career-planning-agent/backend/data/app.db /backup/app.db.$(date +%Y%m%d)

# Qdrant 向量数据
tar -czf /backup/qdrant.$(date +%Y%m%d).tar.gz /opt/qdrant_storage/

# Neo4j 图数据
tar -czf /backup/neo4j.$(date +%Y%m%d).tar.gz /opt/neo4j/data/
```

### 重置数据

```bash
# 停止服务
sudo systemctl stop career-api neo4j qdrant

# 清除 SQLite
rm -f /opt/career-planning-agent/backend/data/app.db

# 清除 Neo4j（谨慎）
rm -rf /opt/neo4j/data/databases/neo4j

# 清除 Qdrant（谨慎）
rm -rf /opt/qdrant_storage/*

# 重新启动 — 后端会自动重建空数据库
sudo systemctl start neo4j qdrant
sleep 10
sudo systemctl start career-api
```

---

## 附：推荐生产环境架构

```
                        ┌──────────────┐
                        │   Nginx :80  │
                        │  (反代 + 静态) │
                        └──────┬───────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                 │
        ┌─────▼─────┐   ┌─────▼─────┐   ┌──────▼──────┐
        │  FastAPI   │   │  Neo4j    │   │   Qdrant    │
        │  :9100     │   │  :7687    │   │   :6333     │
        └─────┬─────┘   └───────────┘   └─────────────┘
              │
        ┌─────▼─────┐
        │  SQLite    │
        │  app.db    │
        └───────────┘
```

- **Nginx** 处理 HTTP、HTTPS、静态文件、API 反代
- **后端** 1 个实例（SQLite 不支持多副本）
- **Neo4j** + **Qdrant** 作为独立 systemd 服务
- 所有组件均配置为开机自启
