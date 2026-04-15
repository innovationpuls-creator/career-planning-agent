# 基于AI的大学生职业规划智能体 — 项目详细方案

---

# 第二部分：项目详细方案

## 一、系统需求详细分析

### 1.1 命题需求拆解

根据命题手册，系统需实现以下核心需求：

| 需求大类 | 具体要求 | 实现方案 |
|---------|---------|---------|
| **岗位画像构建** | ≥10个岗位画像，12维度覆盖 | LLM从职位描述中提取12维度关键词 |
| **垂直图谱** | 展示岗位晋升路径 | 按经验级别(低/中/高)组织岗位数据 |
| **换岗路径图谱** | ≥5个岗位，每岗位≥2条路径 | Qdrant向量相似度识别技能重叠岗位 |
| **学生画像** | 简历解析12维度 + 完整度/竞争力评分 | Dify工作流多模态解析 + 评分算法 |
| **人岗匹配** | 4维度多层次匹配 | 向量相似度 + 加权综合打分 |
| **职业路径规划** | 结合行业趋势 + 个人擅长方向 | Dify职业目标规划工作流 |
| **行动计划** | 短/中期个性化计划 + 评估指标 | LLM生成 + 蜗牛学习路径系统 |
| **报告导出** | 智能润色 + 手动编辑 + Word/PDF导出 | python-docx + reportlab |

---

## 二、功能模块详细设计

### 模块一：就业岗位要求画像（详细）

#### 2.1.1 数据导入流水线（5阶段）

```
Excel文件 ──→ import_job_postings.py ──→ JobPosting表
                                              │
                                              ▼
                     build_job_requirement_profiles.py
                                              │
                                              ▼
                          JobRequirementProfile表 (12维度)
                                              │
                                              ▼
                      build_career_title_aliases.py
                                              │
                                              ▼
                          CareerTitleAlias表 (标题标准化)
                                              │
                                              ▼
                      build_career_requirement_profiles.py
                                              │
                                              ▼
                         CareerRequirementProfile表 (职业聚合)
                                              │
                                              ▼
                       build_transfer_group_embeddings.py
                                              │
                                              ▼
                                    Qdrant向量数据库
```

**5阶段流水线说明：**

| 阶段 | 脚本 | LLM调用量(估算) | 说明 |
|------|------|---------------|------|
| ①导入 | `import_job_postings.py` | 0次 | Excel解析，直接入库 |
| ②岗位画像 | `build_job_requirement_profiles.py` | ~500-1000次 | 按行业×岗位×公司分组，批量提取12维度 |
| ③标题标准化 | `build_career_title_aliases.py` | ~20-50次 | 批量标准化职业标题 |
| ④职业聚合 | `build_career_requirement_profiles.py` | ~100-200次 | 按标准职业标题聚合 |
| ⑤向量入库 | `build_transfer_group_embeddings.py` | ~2000-4000次 | 生成所有画像的向量并入库Qdrant |

#### 2.1.2 12维度提取Prompt设计

```
你是一个专业的HR分析师。请从以下职位描述中提取12个维度的关键信息。

职位描述：
{job_detail}

请按以下JSON格式输出：
{
  "professional_skills": ["技能1", "技能2"],
  "professional_background": ["背景1", "背景2"],
  "education_requirement": ["学历1", "学历2"],
  "work_experience": ["经验1", "经验2"],
  "other_special": ["补充1", "补充2"],
  "teamwork": ["协作1", "协作2"],
  "stress_adaptability": ["抗压1", "抗压2"],
  "communication": ["沟通1", "沟通2"],
  "documentation_awareness": ["文档1", "文档2"],
  "responsibility": ["责任1", "责任2"],
  "learning_ability": ["学习1", "学习2"],
  "problem_solving": ["问题解决1", "问题解决2"]
}
```

#### 2.1.3 垂直岗位图谱API

```
GET /api/job-requirement-profile/vertical
Query: job_title, industry (可选)

Response:
{
  "job_title": "Java开发工程师",
  "industry": "互联网",
  "tiers": [
    {
      "level": "low",
      "label": "初级",
      "salary_range": "8-15K",
      "companies": [
        {
          "name": "某科技公司A",
          "size": "100-499人",
          "count": 5
        }
      ],
      "requirement_summary": "掌握Java基础，熟悉SpringBoot..."
    },
    // mid, high tiers...
  ]
}
```

#### 2.1.4 换岗路径图谱API

```
GET /api/job-transfer
Body: {
  "career_id": 42,  // 目标职业CareerRequirementProfile的ID
  "group_key": "professional-and-threshold",  // 可选维度组
  "top_k": 10  // 返回前N个可转换岗位
}

Response:
{
  "source_career": {
    "id": 42,
    "title": "Java开发工程师"
  },
  "transfer_paths": [
    {
      "target_career": {
        "id": 15,
        "title": "架构师"
      },
      "similarity_score": 0.85,
      "bridge_skills": ["系统设计", "分布式", "微服务"],
      "gap_skills": ["架构评审", "技术选型"],
      "path_type": "vertical"
    },
    {
      "target_career": {
        "id": 23,
        "title": "Go开发工程师"
      },
      "similarity_score": 0.72,
      "bridge_skills": ["后端开发", "数据库", "API设计"],
      "gap_skills": ["Go语言", "Gin框架"],
      "path_type": "horizontal"
    }
  ]
}
```

---

### 模块二：学生就业能力画像（详细）

#### 2.2.1 Dify简历解析工作流

```
前端 ──→ 上传文件 ──→ Dify /files/upload ──→ file_token
                                      │
                                      ▼
前端 ──→ 发送消息 ──→ Dify /chat-messages (streaming)
         (含file_token)                      │
                                              ▼
                                    Dify工作流执行
                                    (多模态LLM解析)
                                              │
                                              ▼
前端 ←── 流式响应 ←── Dify 回调(SSE)
  │         │
  │         └─→ 实时显示解析进度
  │
  └─→ 解析完成后提取JSON ──→ 保存到数据库
      ──→ 更新用户最新画像
```

#### 2.2.2 能力画像数据结构

```python
class StudentCompetencyProfile:
    user_id: int
    workspace_conversation_id: str  # 前端工作区ID
    dify_conversation_id: str  # Dify会话ID
    latest_profile_json: str  # 12维度JSON
    latest_source_text: str  # 原始LLM响应

class StudentCompetencyUserLatestProfile:
    user_id: int  # unique
    latest_profile_json: str  # 最终12维度JSON
    latest_analysis_json: str  # 对比分析结果
    completeness_score: float  # 完整度评分 (0-100)
    competitiveness_score: float  # 竞争力评分 (0-100)
```

#### 2.2.3 评分算法

**完整度评分：**
```
完整度 = (非空维度数 / 12) × 100
```

**竞争力评分（基于目标岗位对比）：**
```
竞争力 = Σ(维度匹配度 × 维度权重) / Σ维度权重 × 100

其中：
- 维度匹配度 = min(学生能力水平, 岗位要求水平) / max(学生能力水平, 岗位要求水平)
- 专业技能权重: 0.3
- 学历要求权重: 0.2
- 工作经验权重: 0.2
- 其他维度权重: 各0.033
```

---

### 模块三：职业生涯发展报告（详细）

#### 2.3.1 人岗匹配API

```
POST /api/career-development-report/job-exploration-match/report
Body: {
  "job_id": 123,
  "industry": "互联网",
  "job_title": "前端开发工程师"
}

流程:
1. 获取用户的12维度画像
2. 获取目标岗位的12维度画像
3. 构建学生向量(3个维度组)
4. 查询Qdrant获取相似岗位
5. 计算4维度匹配分
6. 生成匹配报告

Response:
{
  "overall_match": 0.73,
  "dimensions": [
    {
      "name": "基础要求",
      "score": 0.65,
      "details": [
        {
          "dimension": "education_requirement",
          "student_value": ["本科"],
          "job_value": ["本科", "硕士"],
          "gap": "建议提升学历至硕士",
          "weight": 0.2
        }
      ]
    },
    {
      "name": "职业技能",
      "score": 0.70,
      "details": [...]
    },
    {
      "name": "职业素养",
      "score": 0.80,
      "details": [...]
    },
    {
      "name": "发展潜力",
      "score": 0.78,
      "details": [...]
    }
  ],
  "top_strengths": [
    {"dimension": "teamwork", "keywords": ["团队合作", "积极主动"]}
  ],
  "top_gaps": [
    {"dimension": "professional_skills", "keywords": ["Vue", "React"]}
  ],
  "company_evidence": [
    {
      "company": "某互联网公司A",
      "matched_dimensions": ["teamwork", "communication"],
      "salary_range": "15-25K"
    }
  ]
}
```

#### 2.3.2 Dify职业目标规划工作流

```
前端 ──→ 发送规划请求 ──→ DifyCareerGoalPlanningClient
         │
         ├─ job_title: "前端开发工程师"
         ├─ industry: "互联网"
         ├─ overall_match: 0.73
         ├─ top_strength_keywords: ["团队协作", "沟通表达"]
         └─ top_gap_keywords: ["Vue", "React", "TypeScript"]

Dify ──→ 职业发展路径分析 ──→ 返回结构化JSON
            │
            ├─ career_path: [
            │     { stage: "短期", role: "前端开发", duration: "0-3月", ... },
            │     { stage: "中期", role: "高级前端", duration: "3-9月", ... },
            │     { stage: "长期", role: "前端架构师", duration: "9-24月", ... }
            │   ]
            ├─ social_demand: { ... },
            ├─ industry_trend: { ... },
            └─ correlation_analysis: { ... }
```

#### 2.3.3 蜗牛学习路径系统

"蜗牛"理念：慢即是快，稳即是进。通过分阶段、可量化、可回顾的学习计划，帮助学生稳扎稳打地提升。

**三阶段设计：**

| 阶段 | 时间范围 | 核心理念 | 资源类型 |
|------|---------|---------|---------|
| 短期 | 0-3个月 | 夯实基础 | MDN、freeCodeCamp、基础课程 |
| 中期 | 3-9个月 | 实战积累 | Frontend Mentor、Kaggle、项目实践 |
| 长期 | 9-24个月 | 深化专业 | LeetCode、Nowcoder、技术博客 |

**周/月回顾机制：**
- 每周：学生提交学习总结，系统生成周评估
- 每月：学生提交月度复盘，系统生成成长分析
- LLM驱动：基于学生输入生成个性化反馈和建议

#### 2.3.4 个人成长报告生成

```
触发条件检查：
✓ 已收藏目标岗位
✓ 已填写个人信息
✓ 已完成12维度分析
✓ 已生成学习路径

生成流程：
1. 收集上下文
   - 用户基本信息 (school, major, education_level)
   - 12维度能力画像
   - 人岗匹配报告
   - 职业目标规划
   - 蜗牛学习路径

2. 调用LLM生成报告
   prompt = f"""
   请基于以下信息，生成一份个人职业成长报告：

   用户信息：{user_info}
   能力画像：{competency_profile}
   匹配分析：{match_report}
   目标岗位：{target_job}
   学习路径：{learning_path}

   报告结构：
   1. 自我认知
   2. 职业方向分析
   3. 匹配度判断
   4. 发展建议
   5. 行动计划（分阶段）
   """

3. 返回Markdown格式报告
4. 前端支持编辑 + 导出Word/PDF
```

#### 2.3.5 报告导出

```python
# Word导出
from docx import Document
doc = Document()
doc.add_heading('个人职业成长报告', 0)
# ... 解析Markdown并写入Word

# PDF导出
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph
# ... 使用reportlab生成PDF
```

---

## 三、数据库设计

### 3.1 ER图

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────────────┐
│    User     │──────<│  StudentProfile  │>──────│ StudentCompetency   │
│             │       │                  │       │ Profile             │
└─────────────┘       └──────────────────┘       └─────────────────────┘
       │                                                 │
       │                                                 │
       ▼                                                 ▼
┌─────────────┐                                  ┌─────────────────────┐
│ CareerDev   │                                  │ StudentCompetency   │
│ Favorite    │                                  │ UserLatestProfile   │
└─────────────┘                                  └─────────────────────┘

┌─────────────┐       ┌──────────────────┐       ┌─────────────────────┐
│ JobPosting  │──────<│JobRequirement    │>──────│ CareerTitleAlias    │
│             │       │ Profile          │       │                     │
└─────────────┘       └──────────────────┘       └─────────────────────┘
                              │
                              ▼
              ┌───────────────────────────┐
              │ CareerRequirementProfile  │
              │ (按标准职业标题聚合)       │
              └───────────────────────────┘
                              │
                              ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│ JobGroupEmbedding       │  │ CareerGroupEmbedding    │
│ (Qdrant映射-单个岗位)   │  │ (Qdrant映射-职业聚合)   │
└─────────────────────────┘  └─────────────────────────┘

┌─────────────────────────────┐
│ CareerDevelopmentPlan       │
│ Workspace                   │
│ (职业规划工作区)              │
└─────────────────────────────┘
```

### 3.2 核心表结构

```sql
-- 原始岗位数据
CREATE TABLE job_postings (
    id INTEGER PRIMARY KEY,
    industry VARCHAR(100),        -- 所属行业
    job_title VARCHAR(200),        -- 职位名称
    company_name VARCHAR(200),     -- 公司名称
    address VARCHAR(200),          -- 工作地址
    salary_range VARCHAR(100),     -- 薪资范围
    company_size VARCHAR(50),      -- 公司规模
    company_type VARCHAR(50),      -- 企业性质
    job_detail TEXT,              -- 职位描述
    company_detail TEXT,           -- 公司简介
    created_at DATETIME
);

-- 12维度岗位画像
CREATE TABLE job_requirement_profiles (
    id INTEGER PRIMARY KEY,
    job_posting_id INTEGER,
    industry VARCHAR(100),
    job_title VARCHAR(200),
    canonical_job_title VARCHAR(200),  -- 标准化职业名称
    company_name VARCHAR(200),
    -- 12维度 (JSON数组字符串)
    professional_skills TEXT,
    professional_background TEXT,
    education_requirement TEXT,
    teamwork TEXT,
    stress_adaptability TEXT,
    communication TEXT,
    work_experience TEXT,
    documentation_awareness TEXT,
    responsibility TEXT,
    learning_ability TEXT,
    problem_solving TEXT,
    other_special TEXT,
    UNIQUE(industry, job_title, company_name)
);

-- 职业画像 (按标准职业标题聚合)
CREATE TABLE career_requirement_profiles (
    id INTEGER PRIMARY KEY,
    canonical_job_title VARCHAR(200) UNIQUE,
    -- 12维度
    professional_skills TEXT,
    professional_background TEXT,
    education_requirement TEXT,
    teamwork TEXT,
    stress_adaptability TEXT,
    communication TEXT,
    work_experience TEXT,
    documentation_awareness TEXT,
    responsibility TEXT,
    learning_ability TEXT,
    problem_solving TEXT,
    other_special TEXT,
    -- 覆盖率指标
    professional_and_threshold_coverage REAL,
    collaboration_and_adaptation_coverage REAL,
    growth_and_professionalism_coverage REAL,
    source_job_titles_json TEXT,
    sample_count INTEGER
);

-- 学生12维度能力画像
CREATE TABLE student_competency_profiles (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    workspace_conversation_id VARCHAR(100),
    dify_conversation_id VARCHAR(100),
    latest_profile_json TEXT,      -- 12维度JSON
    latest_source_text TEXT,
    created_at DATETIME
);

-- 学生最新画像快照
CREATE TABLE student_competency_user_latest_profiles (
    user_id INTEGER PRIMARY KEY,
    latest_profile_json TEXT,
    latest_analysis_json TEXT,
    completeness_score REAL,
    competitiveness_score REAL,
    updated_at DATETIME
);

-- 职业发展规划工作区
CREATE TABLE career_development_plan_workspaces (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    favorite_id INTEGER,           -- 关联的收藏岗位
    current_phase VARCHAR(20),     -- short_term/mid_term/long_term
    goal_plan_json TEXT,           -- 职业目标规划JSON
    updated_at DATETIME
);

-- 蜗牛学习路径回顾
CREATE TABLE snail_learning_path_reviews (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    workspace_id INTEGER,
    phase VARCHAR(20),
    review_type VARCHAR(20),       -- weekly/monthly
    content TEXT,                  -- 回顾内容
    llm_feedback TEXT,             -- LLM生成的反馈
    created_at DATETIME
);
```

---

## 四、API接口设计

### 4.1 认证相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| GET | /api/auth/currentUser | 获取当前用户 |
| POST | /api/auth/outLogin | 登出 |

### 4.2 岗位相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/job-postings | 岗位列表 |
| GET | /api/job-postings/job-titles | 岗位名称选项 |
| GET | /api/job-postings/industries | 行业选项 |
| GET | /api/job-requirement-profile/graph | 岗位能力图谱(Neo4j) |
| GET | /api/job-requirement-profile/vertical | 同岗行业对比 |
| GET | /api/job-requirement-comparisons | 岗位对比 |

### 4.3 学生画像相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/student-competency-profile/runtime | 获取Dify配置 |
| POST | /api/student-competency-profile/chat | 发送聊天消息 |
| POST | /api/student-competency-profile/chat/stream | 流式聊天(SSE) |
| POST | /api/student-competency-profile/result-sync | 同步解析结果 |
| GET | /api/student-competency-profile/latest-analysis | 获取最新分析 |

### 4.4 职业发展相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/career-development-report/job-exploration-match/init | 初始化匹配 |
| POST | /api/career-development-report/job-exploration-match/report | 生成匹配报告 |
| GET | /api/career-development-report/favorites | 收藏列表 |
| POST | /api/career-development-report/favorites | 添加收藏 |
| DELETE | /api/career-development-report/favorites/{id} | 删除收藏 |

### 4.5 学习路径相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/career-development-report/snail-learning-path/workspaces/{id} | 初始化工作区 |
| GET | /api/career-development-report/snail-learning-path/workspaces/{id}/reviews | 回顾列表 |
| POST | /api/career-development-report/snail-learning-path/workspaces/{id}/reviews | 提交回顾 |

### 4.6 职业规划相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/career-development-report/goal-setting-path-planning/tasks | 创建规划任务 |
| GET | /api/career-development-report/goal-setting-path-planning/tasks/{id}/stream | 流式获取结果(SSE) |
| GET | /api/career-development-report/goal-setting-path-planning/workspaces/{id} | 获取工作区 |
| PUT | /api/career-development-report/goal-setting-path-planning/workspaces/{id} | 更新工作区 |

### 4.7 成长报告相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/career-development-report/personal-growth-report/workspaces/{id} | 获取报告 |
| PUT | /api/career-development-report/personal-growth-report/workspaces/{id} | 更新报告 |
| POST | /api/career-development-report/personal-growth-report/workspaces/{id}/regenerate | 重新生成 |
| POST | /api/career-development-report/personal-growth-report/workspaces/{id}/export | 导出报告 |
| POST | /api/career-development-report/personal-growth-report/tasks | 创建生成任务 |
| GET | /api/career-development-report/personal-growth-report/tasks/{id}/stream | 流式获取(SSE) |

### 4.8 管理后台相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/users | 用户列表 |
| POST | /api/admin/users | 创建用户 |
| PATCH | /api/admin/users/{id} | 更新用户 |
| DELETE | /api/admin/users/{id} | 删除用户 |
| GET | /api/admin/data-dashboard/major-distribution | 专业分布数据 |
| GET | /api/admin/data-dashboard/competency-analysis | 能力分析数据 |
| GET | /api/admin/data-dashboard/employment-trends | 就业趋势数据 |

---

## 五、AI服务设计

### 5.1 LLM服务

```python
# app/services/llm.py
class OpenAICompatibleLLMClient:
    """OpenAI兼容的LLM客户端"""

    def __init__(self, base_url: str, api_key: str, model: str):
        self.base_url = base_url
        self.api_key = api_key
        self.model = model

    async def chat_completion(
        self,
        messages: List[Dict],
        temperature: float = 0.0,
        max_tokens: int = 4096
    ) -> str:
        """发送对话补全请求"""
        # 实现重试、超时、错误处理
```

**使用场景：**
- 职业标题标准化
- 岗位画像12维度提取
- 职业画像聚合
- 职业目标规划关联分析
- 个人成长报告生成
- 蜗牛学习路径周/月回顾

### 5.2 Embedding服务

```python
# app/services/embeddings.py
class OpenAICompatibleEmbeddingClient:
    """OpenAI兼容的Embedding客户端"""

    async def embed_text(self, text: str) -> List[float]:
        """单文本向量化"""

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """批量文本向量化"""
```

### 5.3 Dify服务

```python
# app/services/student_competency_profile.py
class DifyStudentCompetencyClient:
    """Dify简历解析客户端"""

    async def get_runtime_config(self) -> Dict:
        """获取Dify应用配置"""

    async def upload_file(self, file_path: str) -> str:
        """上传文件，返回file_token"""

    async def stream_chat(
        self,
        query: str,
        file_tokens: List[str] = None,
        conversation_id: str = None
    ) -> AsyncGenerator:
        """流式聊天"""
```

```python
# app/services/career_development_goal_planning.py
class DifyCareerGoalPlanningClient:
    """Dify职业目标规划客户端"""

    async def generate_career_plan(
        self,
        job_title: str,
        industry: str,
        overall_match: float,
        top_strength_keywords: List[str],
        top_gap_keywords: List[str]
    ) -> Dict:
        """生成职业发展规划"""
```

### 5.4 Qdrant向量服务

```python
# app/services/vector_store.py
class QdrantGroupedVectorStore:
    """Qdrant分组向量存储"""

    COLLECTION_JOB = "job_group_embeddings"
    COLLECTION_CAREER = "career_group_embeddings"

    # 三个维度组
    GROUP_PROFESSIONAL = "professional-and-threshold"
    GROUP_COLLABORATION = "collaboration-and-adaptation"
    GROUP_GROWTH = "growth-and-professionalism"

    async def upsert_group_embedding(
        self,
        entity_id: int,
        entity_type: str,  # "job" or "career"
        group_key: str,
        vector: List[float],
        payload: Dict
    ):
        """插入/更新向量"""

    async def query_similar_by_group(
        self,
        vector: List[float],
        group_key: str,
        top_k: int = 10,
        entity_type: str = None
    ) -> List[Dict]:
        """按维度组查询相似向量"""
```

### 5.5 Neo4j知识图谱服务

```python
# app/services/job_requirement_graph.py
class Neo4jJobRequirementGraphService:
    """Neo4j岗位知识图谱服务"""

    # 节点类型
    NODE_PROFILE_ROOT = "ProfileRoot"
    NODE_DIMENSION_GROUP = "DimensionGroup"
    NODE_DIMENSION = "Dimension"

    # 关系类型
    REL_HAS_GROUP = "HAS_GROUP"
    REL_HAS_DIMENSION = "HAS_DIMENSION"

    async def sync_from_sqlite(self):
        """从SQLite同步图谱数据"""

    async def get_graph_data(self, job_title: str = None) -> Dict:
        """获取图谱可视化数据"""
```

---

## 六、前端设计

### 6.1 页面路由

```typescript
// config/routes.ts
const routes: Route = [
  // 公开路由
  { path: '/user/login', component: 'user/login' },
  { path: '/user/register', component: 'user/register' },

  // 用户端路由 (canUser)
  { path: '/home-v2', component: 'home-v2', name: '职业规划' },
  { path: '/student-competency-profile', component: 'student-competency-profile', name: '简历解构' },
  { path: '/snail-learning-path', component: 'career-development-report/learning-path', name: '蜗牛学习路径' },
  { path: '/personal-growth-report', component: 'career-development-report/personal-growth-report', name: '个人职业成长报告' },
  { path: '/job-competency-graph', component: 'job-requirement-profile', name: '岗位能力图谱' },
  { path: '/same-job-cross-industry', component: 'job-requirement-profile/vertical', name: '同岗行业对比' },

  // 管理端路由 (canAdmin)
  { path: '/admin/job-postings', component: 'admin/job-postings' },
  { path: '/admin/job-requirement-comparisons', component: 'admin/job-requirement-comparisons' },
  { path: '/admin/user-management', component: 'admin/user-management' },
  { path: '/admin/major-distribution', component: 'admin/data-dashboard/major-distribution' },
  { path: '/admin/competency-analysis', component: 'admin/data-dashboard/competency-analysis' },
  { path: '/admin/employment-trends', component: 'admin/data-dashboard/employment-trends' },
];
```

### 6.2 核心组件

| 组件 | 文件 | 功能 |
|------|------|------|
| VerticalTierComparison | components/VerticalTierComparison | 垂直岗位三阶段对比 |
| JobMatchOutcomeBody | components/JobMatchOutcomeBody | 人岗匹配结果展示(雷达图+缺口列表) |
| ResumeParsingWorkspace | components/ResumeParsingWorkspace | 简历解析工作区 |
| ResumeComposer | components/ResumeComposer | 消息输入+文件上传 |
| ResumeResultEditor | components/ResumeResultEditor | 12维度标签编辑器 |
| ProcessTimelinePanel | components/ProcessTimelinePanel | 流式处理进度展示 |
| CompanyMatchPanel | components/CompanyMatchPanel | 公司匹配结果 |

### 6.3 状态管理

```typescript
// 全局状态 (app.tsx)
interface InitialState {
  settings: LayoutSettings;
  currentUser?: API.CurrentUser;
  fetchUserInfo?: () => Promise<API.CurrentUser>;
}

// 本地状态 (各页面hooks)
- useCareerGoalPlanningData: 管理收藏、工作区、任务状态
- useStudentCompetency: 管理简历解析对话和分析结果
- useLearningPath: 管理学习路径和工作区
```

### 6.4 流式交互实现

```typescript
// SSE流式请求示例
async function* streamChat(messages: Message[]) {
  const response = await fetch('/api/student-competency-profile/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    // 解析SSE数据
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        yield JSON.parse(line.slice(6));
      }
    }
  }
}
```

---

## 七、核心算法设计

### 7.1 人岗匹配算法

```python
def calculate_match_score(
    student_profile: Dict[str, List[str]],
    job_profile: Dict[str, List[str]],
    weights: Dict[str, float] = None
) -> MatchResult:
    """
    计算人岗匹配度
    """

    # 维度分组
    groups = {
        "基础要求": ["professional_background", "education_requirement", "work_experience", "other_special"],
        "职业技能": ["professional_skills"],
        "职业素养": ["teamwork", "stress_adaptability", "communication"],
        "发展潜力": ["documentation_awareness", "responsibility", "learning_ability", "problem_solving"],
    }

    # 默认权重
    if weights is None:
        weights = {
            "基础要求": 0.25,
            "职业技能": 0.30,
            "职业素养": 0.25,
            "发展潜力": 0.20,
        }

    group_scores = {}
    dimension_details = {}

    for group_name, dimensions in groups.items():
        score = 0.0
        details = []

        for dim in dimensions:
            student_keywords = set(student_profile.get(dim, []))
            job_keywords = set(job_profile.get(dim, []))

            if not job_keywords:
                continue

            # 计算该维度匹配度 (Jaccard + 覆盖率)
            intersection = student_keywords & job_keywords
            jaccard = len(intersection) / len(job_keywords) if job_keywords else 0

            score += jaccard
            details.append({
                "dimension": dim,
                "student_value": list(student_keywords),
                "job_value": list(job_keywords),
                "gap": list(job_keywords - student_keywords),  # 缺口关键词
                "matched": list(intersection),  # 匹配关键词
                "match_score": jaccard,
            })

        # 组内平均
        group_scores[group_name] = score / len(dimensions) if dimensions else 0
        dimension_details[group_name] = details

    # 加权综合分
    overall_score = sum(
        group_scores[group] * weights[group]
        for group in groups.keys()
    )

    return MatchResult(
        overall_score=overall_score,
        group_scores=group_scores,
        dimension_details=dimension_details,
        top_strengths=extract_strengths(dimension_details),
        top_gaps=extract_gaps(dimension_details),
    )
```

### 7.2 向量相似度匹配

```python
def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """计算余弦相似度"""
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    return dot / (norm1 * norm2) if norm1 and norm2 else 0

async def find_similar_jobs(
    student_profile: Dict[str, List[str]],
    group_key: str,
    top_k: int = 10,
) -> List[Dict]:
    """在Qdrant中查找相似岗位"""

    # 1. 构建学生画像文本
    profile_texts = []
    for dim in DIMENSION_MAPPING[group_key]:
        keywords = student_profile.get(dim, [])
        profile_texts.append(f"{DIMENSION_LABELS[dim]}: {' '.join(keywords)}")

    combined_text = " | ".join(profile_texts)

    # 2. 生成向量
    vector = await embedding_client.embed_text(combined_text)

    # 3. Qdrant相似度查询
    results = await vector_store.query_similar_by_group(
        vector=vector,
        group_key=group_key,
        top_k=top_k,
    )

    # 4. 后处理 (加权合并多组结果)
    return merge_similarity_results(results)
```

### 7.3 换岗路径规划

```python
async def plan_career_transfer(
    source_career_id: int,
    target_direction: str = None,
    max_hops: int = 3,
) -> List[TransferPath]:
    """
    规划职业转换路径
    基于技能重叠度和跳跃成本的最优路径搜索
    """

    # 1. 获取源职业画像
    source_profile = get_career_profile(source_career_id)

    # 2. 获取所有候选职业
    all_careers = get_all_career_profiles()

    # 3. 计算技能重叠度
    transfer_options = []
    for career in all_careers:
        if career.id == source_career_id:
            continue

        overlap = calculate_skill_overlap(
            source_profile, career.profile
        )

        if overlap >= OVERLAP_THRESHOLD:
            # 计算转换成本
            gap = get_skill_gap(source_profile, career.profile)

            transfer_options.append({
                "career": career,
                "overlap_score": overlap,
                "gap_skills": gap,
                "bridge_skills": get_bridge_skills(source_profile, career.profile),
            })

    # 4. 按重叠度排序
    transfer_options.sort(key=lambda x: x["overlap_score"], reverse=True)

    # 5. 构建路径 (BFS)
    paths = build_transfer_paths(
        source=source_profile,
        options=transfer_options,
        max_hops=max_hops,
        target_direction=target_direction,
    )

    return paths
```

---

## 八、系统部署

### 8.1 环境要求

| 组件 | 版本 | 说明 |
|------|------|------|
| Python | ≥3.10 | 后端运行时 |
| Node.js | ≥18 | 前端构建 |
| SQLite | 3.x | 关系型数据库 |
| Qdrant | ≥1.7 | 向量数据库 |
| Neo4j | ≥5.x | 图数据库 |

### 8.2 环境变量

```bash
# 后端 (.env)
APP_SECRET_KEY=your-secret-key-here
SQLITE_URL=sqlite:///./data/app.db

# LLM配置
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-xxx
LLM_MODEL=gpt-4o

# Embedding配置
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_API_KEY=sk-xxx

# Dify配置
DIFY_BASE_URL=https://api.dify.ai
DIFY_API_KEY=app-xxx
CAREER_GOAL_DIFY_API_KEY=app-xxx

# Neo4j配置
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=xxx

# Qdrant配置
QDRANT_PATH=./data/qdrant
```

### 8.3 部署步骤

**后端部署：**
```bash
cd backend
uv sync
uv run python scripts/rebuild_job_transfer_v2.py --with-import  # 初始化数据
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 9100
```

**前端部署：**
```bash
cd myapp
npm install
npm start  # 开发模式
npm run build  # 生产构建
```

---

## 九、质量保障

### 9.1 测试覆盖

| 测试类型 | 覆盖内容 |
|---------|---------|
| 单元测试 | API路由、服务层函数、工具函数 |
| 集成测试 | API端到端、数据库操作 |
| E2E测试 | 关键用户流程(Playwright) |

### 9.2 准确率保障

| 指标 | 目标 | 保障措施 |
|------|------|---------|
| 关键技能匹配准确率 | ≥80% | LLM提取+规则校验+人工抽检 |
| 画像关键信息准确率 | ≥90% | 抽样人工评估+反馈迭代 |
| 人岗匹配可信度 | 高 | 证据卡片+公司级原始数据支撑 |

---

## 十、第三方服务参考

| 服务 | 用途 | 官网 |
|------|------|------|
| Dify | AI工作流引擎 | https://dify.ai |
| Qdrant | 向量数据库 | https://qdrant.tech |
| Neo4j | 知识图谱 | https://neo4j.com |
| Ant Design | UI组件库 | https://ant.design |
| @antv/g6 | 图可视化 | https://g6.antv.antgroup.com |
