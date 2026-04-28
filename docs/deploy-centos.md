# CentOS 部署指南（Docker Compose）

> 不需要懂 Docker 原理，照着敲就行。
> 适用 CentOS 7/8/9，Rocky Linux、AlmaLinux 也通用。

---

## 一、准备工作

### 你需要什么

- 一台 CentOS 服务器（最低 4GB 内存）
- root 权限或 sudo 权限
- 能联网

### 安装 Docker

```bash
# 一键安装 Docker（复制整行，粘贴回车）
curl -fsSL https://get.docker.com | bash

# 启动 Docker 并设置开机自启
sudo systemctl enable --now docker

# 验证安装成功（应该显示版本号）
docker --version
docker compose version
```

> 如果上面两条命令都显示了版本号，说明 Docker 安装成功，继续下一步。

---

## 二、获取项目代码

```bash
# 把项目下载到 /opt 目录下
cd /opt
sudo git clone <你的仓库地址> career-planning-agent

# 把目录权限给你自己（不然后面操作要一直 sudo）
sudo chown -R $(whoami):$(whoami) /opt/career-planning-agent

# 进入项目目录
cd /opt/career-planning-agent
```

> 如果没有 git，先装：`sudo yum install -y git`

---

## 三、配置环境变量

### 关键说明（必看）

项目根目录有一个 `docker-compose.yml` 文件。  
Docker Compose 启动时会自动读取**和它同目录**的 `.env` 文件，  
把里面的变量传给各个容器。

**不要搞错位置** — `.env` 必须和 `docker-compose.yml` 在同一个目录（项目根目录），不是放在 `backend/` 里面！

### 操作步骤

```bash
# 复制模板文件，生成你自己的配置
cp deploy/.env.example .env

# 用 vim 编辑（不会 vim 可以用下面这个命令）
vi .env
```

> 不会用 vim？运行 `vi .env` 后，按 `i` 进入编辑模式，改完按 `Esc`，输入 `:wq` 回车保存。

### 必填字段

`.env` 文件中至少修改以下 3 项：

```ini
# 1. 安全密钥（必须改！）
# 用下面命令生成：openssl rand -hex 32
APP_SECRET_KEY=换成32位以上的随机字符串

# 2. 服务器地址（你的 CentOS 的 IP 或域名）
# 例子：APP_DOMAIN=123.45.67.89  或  APP_DOMAIN=example.com
APP_DOMAIN=你的服务器IP

# 3. Neo4j 数据库密码（必须改！）
NEO4J_PASSWORD=设置一个复杂密码
```

### 可选：AI 功能配置

不加也能启动系统，但**简历解析、岗位智能匹配、职业报告生成**这些核心功能不可用。

本系统需要两类 AI 服务：

#### ① 大语言模型（LLM）— 用来理解文字、生成内容

负责简历智能解析、岗位需求分析、职业建议生成等任务。  
可以用任何兼容 OpenAI API 的服务商：

| 服务商 | API 地址 | 推荐模型 | 获取 Key |
|--------|----------|----------|----------|
| **DeepSeek**（推荐，便宜） | `https://api.deepseek.com/v1` | `deepseek-chat` | platform.deepseek.com 注册 |
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o-mini` | platform.openai.com |
| **阿里通义千问** | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` | dashscope.aliyun.com |
| **硅基流动**（免费额度） | `https://api.siliconflow.cn/v1` | `Qwen/Qwen2.5-7B-Instruct` | cloud.siliconflow.cn |

在 `.env` 里加（以 DeepSeek 为例）：

```ini
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-粘贴你复制的API密钥
LLM_MODEL=deepseek-v4-flash
```

#### ② 向量化模型（Embedding）— 用来计算相似度

负责把文字转换成向量，用于岗位匹配、相似度计算。  
需要和 LLM 配套配置。

| 服务商 | API 地址 | 推荐模型 |
|--------|----------|----------|
| **阿里百炼**（推荐，便宜） | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `text-embedding-v2` |
| **OpenAI** | `https://api.openai.com/v1` | `text-embedding-3-small` |
| **硅基流动** | `https://api.siliconflow.cn/v1` | `BAAI/bge-m3` |

在 `.env` 里加（以阿里百炼为例）：

```ini
EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EMBEDDING_API_KEY=sk-粘贴你的阿里云API密钥
EMBEDDING_MODEL=text-embedding-v2
```

> **注**：阿里百炼的 API Key 和 DeepSeek 的不通用，需要分别去各自平台注册获取。
> Key 以 `sk-` 开头，复制粘贴就行，不需要引号。

#### 完整示例：同时配好 LLM + Embedding

```ini
# ---- LLM（用 DeepSeek）----
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-d73cbab54e424838917311156dfdf8b1
LLM_MODEL=deepseek-chat

# ---- Embedding（用阿里百炼）----
EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EMBEDDING_API_KEY=sk-d8a21995db35488c8a6b9c2ba9b6f036
EMBEDDING_MODEL=text-embedding-v2
```

改完后保存。如果你还没启动过服务，继续往下看。

---

## 四、配置国内镜像加速（重要）

> 如果你在国外服务器部署，跳过这一步。
> 国内访问 Docker Hub 非常慢（几 KB/s），必须配镜像加速。

### 在 CentOS 上配置 Docker 镜像源

```bash
# 创建 Docker 配置目录（如果不存在）
sudo mkdir -p /etc/docker

# 写入镜像加速地址
sudo tee /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ]
}
EOF

# 重启 Docker 使配置生效
sudo systemctl restart docker
```

> 以上两个镜像已经过实际测试验证，可稳定拉取本项目的所有镜像。

---

## 五、启动所有服务

```bash
# 一键启动（第一次会下载镜像，总共约 1.2GB，配置镜像后几分钟就能下完）
docker compose up -d

# 查看启动状态（全部显示 healthy 或 running 才算成功）
docker compose ps
```

### 正常状态应该是这样的

```
NAME                STATUS
career-nginx        Up 1 minute
career-backend      Up 1 minute (healthy)
career-qdrant       Up 1 minute (healthy)
career-neo4j        Up 2 minutes (healthy)
```

如果某个容器不是 healthy，看后面的「常见问题」。

### 验证部署

```bash
# 测试 API 是否正常
curl http://localhost/api/health

# 应该显示：{"status":"ok"}
```

---

## 六、导入初始数据

这一步把行业岗位数据导入数据库，否则系统里没有岗位信息。

```bash
# 1. 先重建 backend 容器（挂载数据和脚本目录）
docker compose up -d --force-recreate backend

# 2. 等几秒等后端启动好，然后运行导入脚本
docker compose exec -e PYTHONPATH=/app backend python scripts/rebuild_job_transfer_v2.py --with-import --yes
```

> 注意：
> - 命令中的 `--yes` 是跳过确认提示，直接执行
> - `-e PYTHONPATH=/app` 是告诉 Python 去哪找代码文件
> - 如果用 `uv run python` 会报 `uv: not found`，因为容器里没有 uv 命令

### 导入完成后你会看到

```
[1/6] import_job_postings           ✅ DONE
[2/6] reset_job_transfer_v2_schema  ✅ DONE
[3/6] build_job_requirement_profiles ✅ DONE（如果没有配 LLM 会跳过）
...
[group-embed] completed batch 351/352 for job vectors (written=2811/2811)
[group-embed] completed batch 4/4 for career vectors (written=3/27)
[group-embed] completed batch 3/4 for career vectors (written=11/27)
[group-embed] completed batch 1/4 for career vectors (written=19/27)
[group-embed] completed batch 2/4 for career vectors (written=27/27)
[group-embed] done jobs=2811 careers=27
[pipeline] DONE build_transfer_group_embeddings elapsed=25.36s
[pipeline] rebuild completed
[pipeline] summary import_job_postings elapsed=0.69s
[pipeline] summary reset_job_transfer_v2_schema elapsed=0.69s
[pipeline] summary build_job_requirement_profiles elapsed=664.73s
[pipeline] summary build_career_title_aliases elapsed=15.65s
[pipeline] summary build_career_requirement_profiles elapsed=261.57s
[pipeline] summary build_transfer_group_embeddings elapsed=25.36s
[pipeline] total_elapsed=968.68s
```

---

## 七、初始化蜗牛学习路径资源库

系统启动时自动写入基础学习推荐（所有岗位 × 12 维度的通用模板）。如果需要更贴合具体岗位的 LLM 推荐，执行：

```bash
# 生成全部岗位 × 全部维度的 LLM 推荐（替代通用模板）
docker compose exec -e PYTHONPATH=/app backend python scripts/generate_missing_learning_resources.py
```

> 说明：
> - 这个脚本调用 LLM 生成「Java」「前端工程师」等岗位专用的学习资源，替代通用模板
> - 不加参数生成**全部**岗位 × 全部维度
> - 脚本会对每个维度只调用一次 LLM，一次性输出三个阶段的推荐，从源头避免短/中/长期内容重复
> - 不配 LLM 也能用，通用模板已经够基础功能运行
> - 如果以后新增了岗位名（修改 `SUPPORTED_JOB_TITLES`），重启容器后种子数据自动重建，再跑一遍这个脚本生成新岗位的 LLM 推荐即可

### 脚本参数

```bash
# 只看当前状态，不执行生成
docker compose exec -e PYTHONPATH=/app backend python scripts/generate_missing_learning_resources.py --check-only

# 强制重新生成（覆盖已有数据）
docker compose exec -e PYTHONPATH=/app backend python scripts/generate_missing_learning_resources.py --force

# 只生成某个岗位的某个维度（如 Java 的专业技能）
docker compose exec -e PYTHONPATH=/app backend \
  python scripts/generate_missing_learning_resources.py \
  --job-title "Java" --dimension professional_skills

# 先生成通用模板再跑 LLM 推荐
docker compose exec -e PYTHONPATH=/app backend \
  python scripts/generate_missing_learning_resources.py --rebuild-first

# 加快速度（并发 12 个 LLM 调用，默认 6）
docker compose exec -e PYTHONPATH=/app backend \
  python scripts/generate_missing_learning_resources.py --force --max-concurrent 12

# 完整参数说明
docker compose exec -e PYTHONPATH=/app backend \
  python scripts/generate_missing_learning_resources.py --help
```

| 参数 | 说明 |
|------|------|
| `--job-title` | 指定岗位（如 `"Java"`），省略则生成全部 |
| `--dimension` | 指定维度 key（如 `professional_skills`），省略则生成全部 |
| `--force` | 强制重新生成，覆盖已有数据 |
| `--check-only` | 只检查状态，不生成（配合 `--job-title --dimension` 可查看具体数据） |
| `--rebuild-first` | 先生成通用模板，再跑 LLM 推荐 |
| `--max-concurrent` | 并发 LLM 调用数（默认 6，网络好可调高到 12-15） |
| `--max-retries` | 失败重试次数（默认 2） |

### 常见问题：蜗牛学习路径报「资源数量为 0」

**原因**：workspace 在旧数据（没有该岗位）时已初始化，存了错误快照。  
**解决**：重新初始化 workspace：

```bash
docker exec -e PYTHONPATH=/app career-backend python -c "
from app.db.session import SessionLocal
from app.services.career_development_plan_workspace import initialize_plan_workspace
db = SessionLocal()
# 替换为你的 user_id 和 favorite_id（可在 URL 或数据库里查到）
initialize_plan_workspace(db, user_id=1, favorite_id=1)
db.close()
print('Workspace re-initialized OK')
"
```

或者在页面上删除旧的蜗牛学习路径，重新生成。

如果三个阶段的推荐内容完全一样，说明用了旧版本的生成结果，重新跑 `generate_missing_learning_resources.py` 即可生成按「短期=入门 / 中期=实战 / 长期=进阶」区分的内容。

---

## 八、访问系统

| 功能 | 地址 |
|------|------|
| **前端页面** | `http://你的服务器IP` |
| 后端健康检查 | `http://你的服务器IP/api/health` |
| Neo4j 管理界面 | `http://你的服务器IP:7474`（用户名 neo4j，密码你设的） |

> 如果浏览器访问不了，可能是防火墙没放行：
> ```bash
> sudo firewall-cmd --add-service=http --permanent
> sudo firewall-cmd --reload
> ```

登录账号：`admin` / `admin123`（首次部署自动创建）

---

## 九、日常维护

```bash
# 查看所有服务的日志
docker compose logs -f

# 只看后端的日志
docker compose logs -f backend

# 重启所有服务
docker compose restart

# 更新代码后重新构建
git pull
docker compose up -d --build

# 停止所有服务（数据不丢失）
docker compose down

# 停止并删除所有数据（⚠️ 数据库也没了）
docker compose down -v
```

---

## 十、备份数据

```bash
docker run --rm -v career_planning_agent_backend_data:/data \
  -v /backup:/backup alpine \
  tar -czf /backup/data-$(date +%Y%m%d).tar.gz -C /data .
```

---

## 常见问题（遇到再看）

### Q1：Qdrant 容器一直是 unhealthy

**原因**：Qdrant 的镜像没有 curl、wget 这些命令，普通健康检查用不了。  
**解决**：docker-compose.yml 里已经改好了，用端口检查代替。不用你管。

### Q2：容器启动后 /api/health 返回 404

**原因**：nginx 配置中的 API 路由规则不匹配。  
**解决**：当前配置已正确处理。如果你改了 nginx.conf，需要：

```bash
docker compose build --no-cache nginx
docker compose up -d --force-recreate nginx
```

> 注意：修改 nginx.conf 后要用 `--no-cache` 强制重构建，否则可能还在用旧配置。

### Q3：数据导入时报 `docker: not found` 或 `uv: not found`

**原因**：你进入了容器内部（提示符变成 `#`），但 `docker` 和 `uv` 是宿主机和构建阶段的命令，容器里没有。

**正确操作**：不是在容器里执行，而是在**宿主机**上执行：

```bash
# ✅ 正确（在宿主机执行）
docker compose exec -e PYTHONPATH=/app backend python scripts/rebuild_job_transfer_v2.py --with-import --yes

# ❌ 错误（先进了容器再执行）
# 不要 docker compose exec backend 进去后，再敲 python xxx.py
```

如果已经进了容器，按 `Ctrl+D` 或输入 `exit` 退出来。

### Q4：数据导入时报 `No module named 'app'`

**原因**：Python 找不到项目代码。在容器里运行时需要指定路径。  
**解决**：加上 `-e PYTHONPATH=/app`：

```bash
docker compose exec -e PYTHONPATH=/app backend python scripts/rebuild_job_transfer_v2.py --with-import --yes
```

### Q5：数据导入时报 `Source directory does not exist: /行业数据`

**原因**：容器里没有 `行业数据` 这个目录。  
**解决**：

```bash
# 重建 backend 容器，挂载行业数据目录
docker compose up -d --force-recreate backend
```

### Q6：构建时卡在 npm install 很久

**原因**：国内网络访问 npm 官方源慢。  
**解决**：`deploy/Dockerfile.nginx` 里已配置了淘宝 npm 镜像，如果还是慢，检查网络。

### Q7：docker pull 下载镜像很慢

**原因**：国内访问 Docker Hub 慢。  
**解决**：配置国内镜像加速：

```bash
sudo tee /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ]
}
EOF
sudo systemctl restart docker
```

### Q8：修改了 .env 但容器不生效

**原因**：docker compose 只在启动/重启容器时读取 `.env`。  
**解决**：修改 `.env` 后需要重启服务：

```bash
docker compose up -d backend
```

不需要重建镜像，只重启容器就行。

### Q9：运行时报 `LLM configuration is incomplete`

**原因**：`.env` 里有 LLM 配置，但 docker compose 读的是**根目录**的 `.env`，`backend/.env` 里的配置不会被读到。

**解决**：把 LLM 配置加到根目录的 `.env`（和 `docker-compose.yml` 同一级），不要只放 `backend/.env`。

根目录 `.env` 应该包含：

```ini
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-你的key
LLM_MODEL=deepseek-chat
```

### Q10：服务器内存不足怎么办？

**要求**：至少 4GB 可用内存。  
**检查内存**：

```bash
free -h
```

如果内存不够，Neo4j 会频繁崩溃。减少 Neo4j 内存使用：

```bash
# 在 docker-compose.yml 的 neo4j 环境变量中减少内存
NEO4J_dbms_memory_heap_max__size: 512M
NEO4J_dbms_memory_pagecache_size: 256M
```

---

## 附：项目文件结构说明

```
/opt/career-planning-agent/
├── .env                    ← 你配的（和 docker-compose.yml 同级）
├── docker-compose.yml      ← 编排所有容器
├── deploy/
│   ├── .env.example        ← 环境变量模板（拷成 .env 用）
│   ├── nginx.conf          ← Nginx 配置
│   └── Dockerfile.nginx    ← Nginx 镜像构建
├── backend/
│   ├── .env                ← 本地开发用的，Docker 部署不用
│   ├── Dockerfile
│   ├── app/                ← 后端代码
│   └── scripts/            ← 数据导入脚本
├── 行业数据/               ← Excel 岗位数据（导入要用）
└── myapp/                  ← 前端代码
```
