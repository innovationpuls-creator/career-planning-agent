# AI 教练智能体系统设计

> 日期：2026-05-08
> 状态：设计完成，待审核
> 参考：Coordinator 架构 v4、Memory System v1.1、Agent Loop 状态机、Context Builder、Tool System、Frontend Chat UI

---

## 1. 目标

构建工业级 AI 教练智能体系统，1:1 对标 Claude Code 架构（四大约束 + 8 种设计模式），为大学生提供全流程职业规划对话体验。

---

## 2. Coordinator 架构

### 2.1 整体拓扑

```
CareerCoachAgent (Coordinator)
  ├── 工具: route, recall_memory, send_msg_to_user, emit_event, process_memory_proposal
  ├── 状态: ConversationSummary, active_sub_agent, pending_events[]
  └── 子 Agent: ResumeCoach | CareerMatchCoach | LearningPathCoach | ReportCoach
```

### 2.2 事件身份三字段拆分

| 字段 | 定义 | 说明 |
|------|------|------|
| `event_id` | UUID / snowflake | 追踪事件本身，每次生成唯一 |
| `idempotency_key` | `hash(student_id + business_object_id + event_type + business_version)` | 确定性 hash，来自业务事实，**不含 timestamp**，防重复消费 |
| `trace_id` | UUID | 一次用户请求链路的追踪 ID，串联 Coordinator → 子 Agent → 事件投递全链路 |

示例 (`skill_mastered`)：
```
event_id: "evt_abc123"
idempotency_key: hash(student_42 + skill_python + "skill_mastered" + mastery_v3)
trace_id: "trace_xyz789"
```

### 2.3 三级记忆状态

| confidence | 写入状态 | 行为 |
|------------|----------|------|
| > 0.95 | **confirmed** | 直接用于推荐/报告，可覆盖旧 confirmed |
| 0.80 ~ 0.95 | **provisional** | 低权重使用，**不覆盖** confirmed memory。报告中标注来源。提示导师复核 |
| < 0.80 | **rejected** | 不写入记忆，仅保留 MemoryMutation 审计日志。生成"建议补充证据"提示 |

关键区别：provisional ≠ 正式写入。后续 Agent 读记忆时看到 provisional 字段要降低权重。

### 2.4 风险分级（替代一刀切）

| risk_level | 规则 | 示例 |
|------------|------|------|
| **low** | 可自动 confirmed (confidence > 0.95) | "掌握 Python 基础语法" |
| **medium** | 可进 provisional，不可自动 mastered | "具备数据分析实战能力" |
| **high** | **永远不能自动 confirmed**。只能 provisional 或 human_review | "达到目标岗位要求"、"具备就业级算法工程能力" |

### 2.5 事件总线：Outbox + Dead Letter Queue

```
pending → processing → delivered
           ↘ failed_retryable (指数退避，最多 3 次)
           ↘ dead_letter (3次失败后)
```

级联白名单：`skill_mastered → [ReportCoach, ResumeCoach]`，`goal_reached → [ReportCoach]`。最多 1 层级联。

Outbox 关键字段：`id`, `event_type`, `payload_json`, `idempotency_key`, `trace_id`, `status`(pending/processing/delivered/failed_retryable/dead_letter), `attempt_count`, `next_retry_at`, `locked_at`, `locked_by`, `last_error`。

### 2.6 非打扰反馈 + 负反馈补偿

仅在关键节点收集反馈（不每轮都问）：
- 技能首次标记 mastered · 报告生成完成 · 学习路径完成一个阶段
- 岗位推荐被收藏或放弃 · 用户主动表达不满意

负反馈触发补偿动作（不只是提高阈值）：
```
学生说"我觉得还没掌握"
→ mastery_status: mastered → in_progress
→ confidence 下调
→ LearningPathCoach 重新规划补强任务
→ ReportCoach 更新报告措辞
```

### 2.7 路由分阶段实施

- **Phase 1**：L1(显式) + L1.5(用户命令) + L2(规则) + L4(LLM 兜底)，先跑通，积累路由日志
- **Phase 2**：用高质量路由日志（L4 高置信度 + 未纠正 + 任务成功）训练 L3 BERT-tiny 4 分类器

### 2.8 安全与访问控制

#### 权限模型 — 学生隔离

每个端点、每个工具执行前必须校验 `session.student_id == request.user.id`，防止跨学生数据访问或修改。

```python
# 所有 /api/coach/* 端点的通用依赖
async def verify_student_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    session = await get_session(session_id)
    if not session or session.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此会话")
    return session
```

工具执行时二级校验（`ToolExecutor.execute_with_recovery` 内建）：

```python
# 工具执行前校验
if context.student_id != tool_context.get("owner_student_id"):
    return ToolResult(success=False, error="student_id mismatch — blocked")
```

所有 `mutation_gated` 操作的 `MemoryMutationProposal.student_id` 必须等于 `context.student_id`，防止级联白名单跨学生触发。

#### 文件上传限制

| 约束 | 值 |
|------|-----|
| 最大文件大小 | 10MB |
| 允许类型 | PDF, DOC, DOCX, PNG, JPG |
| 病毒扫描 | ClamAV (可选，生产环境启用) |
| 存储路径 | `uploads/{student_id}/{file_id}` 隔离 |

```python
# backend/app/api/coach.py
ALLOWED_UPLOAD_TYPES = {
    "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png", "image/jpeg",
}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB

@router.post("/upload")
async def upload_coach_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(400, f"不支持的文件类型: {file.content_type}")
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "文件超过 10MB 限制")
    file_id = build_id("file")
    path = f"uploads/{current_user.id}/{file_id}"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(content)
    return {"file_id": file_id, "name": file.filename, "type": file.content_type, "size": len(content)}
```

#### LLM 输出安全

- **禁止记录敏感字段**：MemoryField 的 `source` 和 `evidence` 不得包含学生真实姓名、身份证号、电话号码、家庭住址。Context Builder 在注入记忆到 LLM 前做脱敏：
  ```python
  SENSITIVE_PATTERNS = [
      (r'\b\d{17}[\dXx]\b', '[身份证号已隐藏]'),   # 身份证
      (r'\b1[3-9]\d{9}\b', '[手机号已隐藏]'),      # 手机
      (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[邮箱已隐藏]'),
  ]
  ```
- **数据隔离**：Context Builder 的 `_format_collective_wisdom` 返回群体数据时必须聚合（平均值/分布），禁止泄露单个其他学生的具体信息。
- **前端渲染**：`StreamingText` 和 `MessageBubble` 的 `dangerouslySetInnerHTML`/`innerHTML` 禁止，所有内容通过 React JSX 渲染。

#### LLM 输出脱敏

思维链输出不应包含原始的用户敏感信息。后台在 `query_loop` 产出 delta/thinking 事件前可选执行脱敏过滤（轻量正则，不增加显著延迟）。

---

## 3. Memory System v1.1

### 3.1 核心 Pydantic 模型

```python
from enum import Enum
from typing import Generic, TypeVar, Any
from datetime import datetime
from pydantic import BaseModel, Field

T = TypeVar('T')

class MemoryStatus(str, Enum):
    CONFIRMED = "confirmed"
    PROVISIONAL = "provisional"
    REJECTED = "rejected"

class MasteryStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    MASTERED = "mastered"
    NEEDS_REVIEW = "needs_review"

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class DecisionType(str, Enum):
    AUTO_CONFIRMED = "auto_confirmed"
    PROVISIONAL_WRITE = "provisional_write"
    REJECTED = "rejected"

class OutboxStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    DELIVERED = "delivered"
    FAILED_RETRYABLE = "failed_retryable"
    DEAD_LETTER = "dead_letter"

class MemoryField(BaseModel, Generic[T]):
    """每个字段独立追踪 memory_status/confidence/risk_level/source"""
    value: T
    memory_status: MemoryStatus = MemoryStatus.CONFIRMED
    confidence: float = 1.0
    risk_level: RiskLevel = RiskLevel.LOW
    source: str = ""
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Default factory 修正：必须显式提供 value
# 正确用法: MemoryField[str](value="", memory_status=MemoryStatus.CONFIRMED, confidence=1.0, source="user_input")
# 错误用法: Field(default_factory=MemoryField) ← value: T 没有 default，会报错

class SkillEntryV1_1(BaseModel):
    """mastery_status（学习掌握程度）和 memory_status（记忆信任度）拆分"""
    mastery_status: MasteryStatus = MasteryStatus.IN_PROGRESS
    memory_status: MemoryStatus = MemoryStatus.CONFIRMED
    confidence: float = 1.0
    evidence_count: int = 0
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    sources: list[str] = Field(default_factory=list)

class EvidenceEntry(BaseModel):
    type: str
    source_agent: str
    confidence: float
    summary: str

class ProvisionalOverlay(BaseModel):
    """所有 provisional 候选集中在一个 dict，key 为 JSON path，不污染主字段"""
    field_path: str          # 如 "student_profile.major"
    proposed_value: Any
    confidence: float
    source: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ConversationSummaryV1_1(BaseModel):
    """硬记忆主模型 — JSON 格式存储于 SQLite"""
    schema_version: int = 2
    student_profile: dict[str, MemoryField] = Field(default_factory=dict)
    career_goal: dict[str, MemoryField] = Field(default_factory=dict)
    skills: dict[str, SkillEntryV1_1] = Field(default_factory=dict)  # keyed by skill_id
    provisional_overlays: dict[str, ProvisionalOverlay] = Field(default_factory=dict)
    evidence: list[EvidenceEntry] = Field(default_factory=list)
    current_stage: str = ""
    open_questions: list[str] = Field(default_factory=list)
    last_agent: str = ""
    next_recommended_action: str = ""

class MemoryMutationProposal(BaseModel):
    """子 Agent 提交的写入提议"""
    student_id: str
    target_table: str          # "conversation_summaries"
    target_field: str          # "skills.python.mastery_status"
    old_value: Any = None
    new_value: Any
    evidence: str
    source_agent: str
    source_idempotency_key: str
    source_event_id: str       # Coordinator 三字段之一
    trace_id: str              # 全链路追踪
    confidence: float
    risk_level: RiskLevel = RiskLevel.LOW

class MemoryMutationRecord(BaseModel):
    """写入后的审计记录"""
    id: str
    student_id: str
    source_idempotency_key: str
    source_event_id: str
    trace_id: str
    target_table: str
    target_field: str
    overlay_target: bool = False  # True = 写入 provisional_overlays 而非主字段
    old_value: Any = None
    new_value: Any
    evidence: str
    source_agent: str
    confidence: float
    decision_type: DecisionType
    rollback_of: str | None = None
    rolled_back_by: str | None = None
    rollback_reason: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DecisionJournalEntry(BaseModel):
    id: str
    student_id: str
    decision_type: str       # mastery_update | goal_update | profile_update
    proposal_json: str       # 完整 Proposal JSON
    adjudication_result: str # auto_confirmed | provisional_write | rejected
    reasoning: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CWEntity(BaseModel):
    id: str
    entity_type: str          # "skill" | "role" | "industry"
    entity_name: str
    properties: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CWRelation(BaseModel):
    id: str
    from_entity_id: str
    to_entity_id: str
    relation_type: str        # "required_by" | "related_to" | "prerequisite_of"
    properties: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class FeedbackRecord(BaseModel):
    id: str
    student_id: str
    trace_id: str | None = None
    session_id: str | None = None
    target_type: str          # "skill_mastered" | "report_generated" | "job_recommendation"
    target_id: str
    sentiment: str            # "positive" | "negative" | "neutral"
    feedback_text: str | None = None
    source: str               # "prompted" | "user_initiated"
    compensation_status: str = "none"  # "none" | "pending" | "completed"
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

### 3.2 SQLite DDL

```sql
-- 会话摘要（硬记忆主存储）
CREATE TABLE conversation_summaries (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL UNIQUE,
    summary_json TEXT NOT NULL,  -- ConversationSummaryV1_1 序列化
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 能力历史（按时间线记录每项技能的每次变更）
CREATE TABLE competency_history (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    mastery_status TEXT NOT NULL,
    memory_status TEXT NOT NULL,
    confidence REAL NOT NULL,
    evidence TEXT,
    source TEXT NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 决策日志（每次裁决的完整记录）
CREATE TABLE decision_journal (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    decision_type TEXT NOT NULL,
    proposal_json TEXT NOT NULL,
    adjudication_result TEXT NOT NULL,
    reasoning TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 记忆变更审计（不可变日志，支持回滚）
CREATE TABLE memory_mutations (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    source_idempotency_key TEXT NOT NULL,
    source_event_id TEXT,
    trace_id TEXT,
    target_table TEXT NOT NULL,
    target_field TEXT NOT NULL,
    overlay_target INTEGER NOT NULL DEFAULT 0,  -- 1 = 写入 provisional_overlays
    old_value TEXT,
    new_value TEXT,
    evidence TEXT,
    source_agent TEXT NOT NULL,
    confidence REAL NOT NULL,
    decision_type TEXT NOT NULL,  -- auto_confirmed | provisional_write | rejected
    rollback_of TEXT REFERENCES memory_mutations(id),
    rolled_back_by TEXT REFERENCES memory_mutations(id),
    rollback_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(student_id, target_table, target_field, source_idempotency_key)
);

-- 群体智慧：实体
CREATE TABLE cw_entities (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    properties_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 群体智慧：关系
CREATE TABLE cw_relations (
    id TEXT PRIMARY KEY,
    from_entity_id TEXT NOT NULL REFERENCES cw_entities(id),
    to_entity_id TEXT NOT NULL REFERENCES cw_entities(id),
    relation_type TEXT NOT NULL,
    properties_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 群体智慧：观测（独立表，E/R 二选一非空）
CREATE TABLE cw_observations (
    id TEXT PRIMARY KEY,
    entity_id TEXT REFERENCES cw_entities(id),
    relation_id TEXT REFERENCES cw_relations(id),
    observation_text TEXT NOT NULL,
    source TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    sample_size INTEGER,
    support_count INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK ((entity_id IS NULL) != (relation_id IS NULL))
);

-- 反馈记录（独立表，不嵌入 ConversationSummary JSON）
CREATE TABLE feedback_records (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    trace_id TEXT,
    session_id TEXT,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    sentiment TEXT NOT NULL,
    feedback_text TEXT,
    source TEXT NOT NULL,
    compensation_status TEXT NOT NULL DEFAULT 'none',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Outbox 事件表
CREATE TABLE outbox_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TEXT,
    locked_at TEXT,
    locked_by TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    delivered_at TEXT
);

-- 频率控制：同一 target 7 天内不重复
CREATE INDEX idx_feedback_target ON feedback_records(student_id, target_type, target_id, created_at);
-- 幂等键查询
CREATE INDEX idx_mutations_idempotency ON memory_mutations(source_idempotency_key);
```

### 3.3 核心流程

```python
class MemoryManager:
    """硬记忆 CRUD"""

    async def read_conversation_summary(self, student_id: str) -> ConversationSummaryV1_1:
        """读取学生硬记忆，不存在则返回默认空摘要"""
        row = await db.fetchone(
            "SELECT summary_json FROM conversation_summaries WHERE student_id = ?",
            (student_id,)
        )
        if row:
            return ConversationSummaryV1_1.model_validate_json(row[0])
        return ConversationSummaryV1_1()

    async def recall_memory(
        self, student_id: str, query: str, top_k: int = 5
    ) -> list[dict]:
        """软记忆：Qdrant 向量检索相似历史场景 + 取回原始片段"""
        embedding = await self.embedder.embed(query)
        hits = await self.qdrant.search(
            collection_name="student_contexts",
            query_vector=embedding,
            limit=top_k,
            filter={"student_id": student_id}
        )
        return [{"score": h.score, "fragment": h.payload["fragment"]} for h in hits]

    async def propose_memory_mutation(
        self, proposal: MemoryMutationProposal
    ) -> MemoryMutationRecord:
        """子 Agent 提交提议 → 裁决 → 写入/拒绝"""
        return await self.adjudicate(proposal)

    async def commit_memory_mutation(
        self, record: MemoryMutationRecord
    ) -> None:
        """将 confirmed/provisional mutation 写入 conversation_summaries"""
        if record.decision_type == DecisionType.REJECTED:
            return

        summary = await self.read_conversation_summary(record.student_id)

        # 存储层是 JSON 编码的，应用前还原，避免把 JSON 字符串写进字段
        value = record.new_value
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except (json.JSONDecodeError, TypeError):
                pass  # 非 JSON 字符串直接使用

        if record.overlay_target or record.decision_type == DecisionType.PROVISIONAL_WRITE:
            # provisional → 写入 provisional_overlays，不覆盖主字段
            summary.provisional_overlays[record.target_field] = ProvisionalOverlay(
                field_path=record.target_field,
                proposed_value=value,
                confidence=record.confidence,
                source=record.source_agent,
            )
        else:
            # confirmed → 写入主字段
            self._apply_field_update(summary, record.target_field, value)

        await db.execute(
            "UPDATE conversation_summaries SET summary_json = ?, updated_at = datetime('now') WHERE student_id = ?",
            (summary.model_dump_json(), record.student_id)
        )

    async def rollback_memory_mutation(
        self, mutation_id: str, reason: str
    ) -> MemoryMutationRecord:
        """回滚 = 新 mutation（非物理删除），双向链接 rollback_of + rolled_back_by"""
        original = await db.fetchone(
            "SELECT * FROM memory_mutations WHERE id = ?", (mutation_id,)
        )
        if not original:
            raise ValueError(f"Mutation {mutation_id} not found")

        # 存储层是 JSON 编码的，需还原后交换
        old_val = json.loads(original["old_value"]) if original["old_value"] else None
        new_val = json.loads(original["new_value"]) if original["new_value"] else None

        rollback = MemoryMutationRecord(
            id=build_id("mut"),
            student_id=original["student_id"],
            source_idempotency_key=f"rollback_of_{mutation_id}",
            source_event_id=original["source_event_id"],
            trace_id=original["trace_id"],
            target_table=original["target_table"],
            target_field=original["target_field"],
            old_value=json.dumps(new_val),   # 旧值 = 原 mutation 的新值
            new_value=json.dumps(old_val),   # 新值 = 原 mutation 的旧值
            evidence=f"Rollback: {reason}",
            source_agent="Coordinator",
            confidence=1.0,
            decision_type=DecisionType.AUTO_CONFIRMED,
            rollback_of=mutation_id,
            rollback_reason=reason,
        )
        await self._insert_mutation(rollback)

        # 双向链接：原 mutation.rolled_back_by = 新 mutation.id
        await db.execute(
            "UPDATE memory_mutations SET rolled_back_by = ? WHERE id = ?",
            (rollback.id, mutation_id)
        )

        # 将新值写回 conversation_summaries
        await self.commit_memory_mutation(rollback)
        return rollback

    async def record_feedback(self, feedback: FeedbackRecord) -> None:
        """记录反馈，检查是否需要触发补偿"""
        await db.execute(
            """INSERT INTO feedback_records
               (id, student_id, trace_id, session_id, target_type, target_id,
                sentiment, feedback_text, source, compensation_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (feedback.id, feedback.student_id, feedback.trace_id, feedback.session_id,
             feedback.target_type, feedback.target_id, feedback.sentiment,
             feedback.feedback_text, feedback.source, feedback.compensation_status)
        )
        if feedback.sentiment == "negative":
            await db.execute(
                "UPDATE feedback_records SET compensation_status = 'pending' WHERE id = ?",
                (feedback.id,)
            )
            # 触发补偿：见 §2.6

    def _apply_field_update(self, root: Any, field_path: str, value: Any):
        """按 JSON path 更新嵌套字段，支持 BaseModel + dict 混合路径。

        ConversationSummaryV1_1 的 student_profile/career_goal/skills 都是 dict，
        路径如 skills.skill_python.mastery_status 会穿过 dict 再进入 SkillEntryV1_1，
        getattr/setattr 无法处理 dict key。
        """
        parts = field_path.split(".")
        obj = root
        for part in parts[:-1]:
            if isinstance(obj, dict):
                obj = obj.setdefault(part, {})
            else:
                obj = getattr(obj, part)
        last = parts[-1]
        if isinstance(obj, dict):
            obj[last] = value
        else:
            setattr(obj, last, value)


async def adjudicate(proposal: MemoryMutationProposal) -> MemoryMutationRecord:
    """裁决逻辑：risk gating + confidence tiering + provisional-confirmed 冲突处理"""
    decision_type = DecisionType.REJECTED
    reasoning = ""
    record_is_overlay = False  # 初始化，冲突检测时可能设为 True

    # 1. risk gating：high risk 永远不自动 confirmed
    if proposal.risk_level == RiskLevel.HIGH:
        if proposal.confidence > 0.95:
            decision_type = DecisionType.PROVISIONAL_WRITE
            reasoning = "high risk — capped at provisional"
        elif proposal.confidence >= 0.80:
            decision_type = DecisionType.PROVISIONAL_WRITE
            reasoning = "high risk — provisional pending review"
        else:
            decision_type = DecisionType.REJECTED
            reasoning = "high risk + low confidence — rejected"
    # 2. medium risk
    elif proposal.risk_level == RiskLevel.MEDIUM:
        if proposal.confidence > 0.95:
            decision_type = DecisionType.PROVISIONAL_WRITE  # medium 不可自动 confirmed
            reasoning = "medium risk — capped at provisional"
        elif proposal.confidence >= 0.80:
            decision_type = DecisionType.PROVISIONAL_WRITE
            reasoning = "medium risk — provisional"
        else:
            decision_type = DecisionType.REJECTED
            reasoning = "medium risk + low confidence — rejected"
    # 3. low risk
    else:
        if proposal.confidence > 0.95:
            decision_type = DecisionType.AUTO_CONFIRMED
            reasoning = "low risk + high confidence — auto confirmed"
        elif proposal.confidence >= 0.80:
            decision_type = DecisionType.PROVISIONAL_WRITE
            reasoning = "low risk — provisional"
        else:
            decision_type = DecisionType.REJECTED
            reasoning = "low confidence — rejected"

    # 4. 冲突检测：provisional 不覆盖 confirmed，写入 provisional_overlays
    if decision_type == DecisionType.PROVISIONAL_WRITE:
        existing = await db.fetchone(
            """SELECT decision_type FROM memory_mutations
               WHERE student_id = ? AND target_table = ? AND target_field = ?
               ORDER BY created_at DESC LIMIT 1""",
            (proposal.student_id, proposal.target_table, proposal.target_field)
        )
        if existing and existing["decision_type"] == DecisionType.AUTO_CONFIRMED:
            reasoning += "; existing confirmed record — writing to provisional_overlays instead"
            record_is_overlay = True

    record = MemoryMutationRecord(
        id=build_id("mut"),
        student_id=proposal.student_id,
        source_idempotency_key=proposal.source_idempotency_key,
        source_event_id=proposal.source_event_id,
        trace_id=proposal.trace_id,
        target_table=proposal.target_table,
        target_field=proposal.target_field,
        overlay_target=record_is_overlay,
        old_value=json.dumps(proposal.old_value) if proposal.old_value is not None else None,
        new_value=json.dumps(proposal.new_value),  # 存储层 JSON 编码，写入时 json.loads 还原
        evidence=proposal.evidence,
        source_agent=proposal.source_agent,
        confidence=proposal.confidence,
        decision_type=decision_type,
    )

    # 写入 memory_mutations（所有决策都记录）
    await db.execute(
        """INSERT INTO memory_mutations
           (id, student_id, source_idempotency_key, source_event_id, trace_id,
            target_table, target_field, overlay_target,
            old_value, new_value, evidence, source_agent, confidence, decision_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (record.id, record.student_id, record.source_idempotency_key,
         record.source_event_id, record.trace_id,
         record.target_table, record.target_field, record.overlay_target,
         record.old_value, record.new_value, record.evidence, record.source_agent,
         record.confidence, record.decision_type)
    )

    # 写入 decision_journal（所有决策都记录）
    await db.execute(
        """INSERT INTO decision_journal
           (id, student_id, decision_type, proposal_json, adjudication_result, reasoning)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (build_id("dec"), proposal.student_id, "mastery_update",
         proposal.model_dump_json(), decision_type, reasoning)
    )

    # rejected: 不写入 conversation_summaries，不 emit 事件
    # confirmed → 写主字段
    # provisional → 写 provisional_overlays
    if decision_type != DecisionType.REJECTED:
        await memory_manager.commit_memory_mutation(record)

    return record


# 频率控制：同一 target 7 天内不重复，每会话最多 2 个活跃反馈提示
async def should_prompt_feedback(student_id: str, target_type: str, target_id: str, session_id: str) -> bool:
    recent = await db.fetchone(
        """SELECT COUNT(*) FROM feedback_records
           WHERE student_id = ? AND target_type = ? AND target_id = ?
           AND created_at > datetime('now', '-7 days')""",
        (student_id, target_type, target_id)
    )
    if recent and recent[0] > 0:
        return False
    session_count = await db.fetchone(
        """SELECT COUNT(*) FROM feedback_records
           WHERE session_id = ? AND source = 'prompted'""",
        (session_id,)
    )
    if session_count and session_count[0] >= 2:
        return False
    return True
```

### 3.4 v1 → v1.1 关键修正清单

| # | 修正项 | v1 问题 | v1.1 方案 |
|---|--------|---------|----------|
| 1 | status 拆分 | 单一 `status` 字段混用 | `mastery_status` + `memory_status` 分离 |
| 2 | skills 容器 | `list[SkillEntry]` 无法 JSON path 更新 | `dict[str, SkillEntryV1_1]` keyed by skill_id |
| 3 | 共享字段 | 单一 confidence/status/source per 对象 | `MemoryField[T]` per-field wrapper |
| 4 | source_event_id | 被误用为幂等键 | 三字段拆分: event_id / idempotency_key / trace_id |
| 5 | 回滚链接 | 单向 `rolled_back_by` | 双向 `rollback_of` + `rolled_back_by` |
| 6 | rejected 隔离 | 不明确 rejected 后不做什么 | 明确：只写 memory_mutations + decision_journal，不碰业务表，不 emit 事件 |
| 7 | 反馈记录 | 嵌入 ConversationSummary JSON | 独立 `feedback_records` 表 |
| 8 | 观测存储 | JSON 数组嵌在 cw_entities/relations | 独立 `cw_observations` 表 |
| 9 | MemoryField 默认值 | `Field(default_factory=MemoryField)` 报错 | `MemoryField[str](value="", memory_status=CONFIRMED, confidence=1.0, source="user_input")` |
| 10 | provisional 隔离 | `field_provisional` 后缀污染 JSON | 集中 `provisional_overlays` dict keyed by JSON path |
| 11 | 幂等键 UNIQUE | 单 `UNIQUE(source_idempotency_key)` 阻止同事件更新多字段 | 复合 `UNIQUE(student_id, target_table, target_field, source_idempotency_key)` |
| 12 | 回滚双向链路 | 单向 `rollback_of`，缺 `rolled_back_by` | 双向：新 mutation.rollback_of + 原 mutation.rolled_back_by |
| 13 | 审计链不完整 | 缺 `trace_id` / `source_event_id` | `memory_mutations` 补全三字段：event_id / idempotency_key / trace_id |
| 14 | provisional vs confirmed 冲突 | 已有 confirmed 时直接 REJECTED | 改为写入 `provisional_overlays`，不拒绝 |
| 15 | _apply_field_update | 只用 getattr/setattr，dict 路径报错 | 支持 BaseModel + dict 混合路径 |
| 16 | commit new_value 双重编码 | json.dumps 后直接写字段 | commit 时 json.loads 还原 |

---

## 4. Agent Loop 状态机

### 4.1 核心类

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import AsyncGenerator

class StopReason(str, Enum):
    TASK_COMPLETE = "task_complete"
    MAX_ITERATIONS = "max_iterations"
    TOOL_ERROR = "tool_error"
    USER_ABORT = "user_abort"
    LLM_ERROR = "llm_error"
    CONTEXT_OVERFLOW = "context_overflow"

class LoopState(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    COMPACTING = "compacting"
    TERMINATING = "terminating"
    ERROR = "error"

@dataclass
class LoopContext:
    """一次 query_loop 的完整上下文"""
    trace_id: str                   # 全链路追踪 ID (UUID)
    student_id: str
    session_id: str
    messages: list[dict]            # 完整对话历史
    active_agent: str               # 当前子 Agent
    conversation_summary: ConversationSummaryV1_1
    tools: list[dict]               # 当前 Agent 可用工具 (JSON Schema)
    token_budget: "TokenBudget"
    abort_signal: Any = None        # ASGI request.is_disconnected 引用

@dataclass
class LoopResult:
    stop_reason: StopReason
    total_tokens: int
    tool_calls: int
    duration_ms: int
    final_state: LoopState
```

### 4.2 query_loop — 5 阶段 AsyncGenerator

```python
async def query_loop(
    context: LoopContext,
    llm_client: "LLMClient",
    tool_executor: "ToolExecutor",
) -> AsyncGenerator[StreamEvent, None]:
    """
    主对话循环。每个 yield 对应前端一条 NDJSON。
    5 阶段：预取 → 压缩检查 → 终止检查 → LLM + 工具 → 清理
    """
    state = LoopState.RUNNING
    iteration = 0
    max_iterations = 20

    while state == LoopState.RUNNING and iteration < max_iterations:
        iteration += 1

        # ── Phase 2: 压缩检查 ──
        if context.token_budget.usage_ratio > 0.85:
            state = LoopState.COMPACTING
            yield StreamEvent(event="thinking", delta="对话较长，正在整理上下文...")
            context.messages = await compact_context(context.messages, keep_last=6)
            context.token_budget.recalculate(context.messages)
            state = LoopState.RUNNING

        # ── Phase 3: 终止检查 ──
        if context.abort_signal and await context.abort_signal():
            yield StreamEvent(event="error", code="USER_ABORT", detail="用户中止")
            yield StreamEvent(event="done", data={"stop_reason": StopReason.USER_ABORT})
            return

        # ── Phase 4: LLM 流式调用 ──
        tool_calls_buffer: list[dict] = []
        current_tool_call: dict | None = None
        assistant_text = ""  # 累积完整 AI 回复文本

        async for chunk in llm_client.stream_chat(
            messages=context.messages,
            system_prompt=build_system_prompt(context),
            tools=context.tools,
        ):
            if context.abort_signal and await context.abort_signal():
                break

            match chunk.type:
                case "text_delta":
                    assistant_text += chunk.text
                    yield StreamEvent(event="delta", delta=chunk.text)
                case "thinking_delta":
                    yield StreamEvent(event="thinking", delta=chunk.text)
                case "tool_call_start":
                    current_tool_call = {
                        "id": chunk.tool_call_id,
                        "name": chunk.tool_name,
                        "args": "",
                    }
                    yield StreamEvent(
                        event="tool_call",
                        toolCallId=chunk.tool_call_id,
                        toolName=chunk.tool_name,
                        displayName=TOOL_DISPLAY_NAMES.get(chunk.tool_name, chunk.tool_name),
                    )
                case "tool_call_args":
                    if current_tool_call:
                        current_tool_call["args"] += chunk.args_delta
                        yield StreamEvent(
                            event="tool_args",
                            toolCallId=current_tool_call["id"],
                            args=None,  # 增量传输，前端累积
                        )
                case "tool_call_end":
                    if current_tool_call:
                        try:
                            current_tool_call["parsed_args"] = json.loads(current_tool_call["args"])
                        except json.JSONDecodeError:
                            current_tool_call["parsed_args"] = {}
                        tool_calls_buffer.append(current_tool_call)
                        current_tool_call = None
                case "message_stop":
                    pass

        # ── 工具执行 ──
        if tool_calls_buffer:
            # 1. 先保存 assistant 消息（含 tool_calls）
            context.messages.append({
                "role": "assistant",
                "content": assistant_text or None,
                "tool_calls": [
                    {"id": tc["id"], "type": "function",
                     "function": {"name": tc["name"], "arguments": tc["args"]}}
                    for tc in tool_calls_buffer
                ],
            })
            # 2. 执行工具并注入结果
            for tc in tool_calls_buffer:
                result = await tool_executor.execute_with_recovery(
                    tool_name=tc["name"],
                    args=tc["parsed_args"],
                    context=context,
                )
                yield StreamEvent(
                    event="tool_result",
                    toolCallId=tc["id"],
                    result={"summary": result.summary} if result.success else None,
                    error=result.error if not result.success else None,
                )
                context.messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result.summary if result.success else f"Error: {result.error}",
                })

            # 继续循环，让 LLM 处理工具结果
            continue

        # ── 无工具调用 → 对话结束 ──
        if assistant_text:
            context.messages.append({
                "role": "assistant",
                "content": assistant_text,
            })
        state = LoopState.TERMINATING
        break

    # ── Phase 5: 清理 ──
    yield StreamEvent(
        event="done",
        data={
            "stop_reason": StopReason.TASK_COMPLETE if iteration < max_iterations else StopReason.MAX_ITERATIONS,
        },
    )
```

### 4.3 QueryEngine.submit_message

```python
class QueryEngine:
    def __init__(self, memory_manager, tool_registry, tool_executor, llm_client, context_builder):
        self.memory_manager = memory_manager
        self.tool_registry = tool_registry
        self.tool_executor = tool_executor
        self.llm_client = llm_client
        self.context_builder = context_builder

    async def submit_message(
        self,
        student_id: str,
        session_id: str | None,
        message: str,
        pipeline_stage: str | None = None,
        attachments: list[dict] | None = None,
    ) -> AsyncGenerator[StreamEvent, None]:
        trace_id = build_id("trace")  # 本次请求链路 ID

        # 1. 加载或创建会话
        if session_id:
            session = await self.load_session(session_id)
        else:
            session = await self.create_session(student_id, pipeline_stage)

        # 2. 加载记忆
        summary = await self.memory_manager.read_conversation_summary(student_id)
        soft_memories = await self.memory_manager.recall_memory(student_id, message, top_k=3)

        # 3. 路由决策
        active_agent = await self.route(student_id, message, pipeline_stage, summary)

        # 4. 构建上下文
        system_prompt, tools, messages = await self.context_builder.build(
            student_id=student_id,
            active_agent=active_agent,
            summary=summary,
            soft_memories=soft_memories,
            pipeline_stage=pipeline_stage,
            conversation_history=session.messages,
        )

        # 5. 发送路由事件（让前端立即更新 activeAgent）
        yield StreamEvent(
            event="route",
            agent=active_agent,
            fromAgent=None,
            reason=pipeline_stage if pipeline_stage else "LLM 意图路由",
        )

        # 6. 发送 meta 事件（会话初始化）
        assistant_msg_id = build_id("msg")
        yield StreamEvent(
            event="meta",
            sessionId=session.id,
            assistantMessageId=assistant_msg_id,
            activeAgent=active_agent,
            createdAt=datetime.utcnow().timestamp(),
        )

        # 7. 执行 Agent Loop
        context = LoopContext(
            trace_id=trace_id,
            student_id=student_id,
            session_id=session.id,
            messages=messages,
            active_agent=active_agent,
            conversation_summary=summary,
            tools=tools,
            token_budget=TokenBudget(),
        )
        async for event in query_loop(context, self.llm_client, self.tool_executor):
            yield event

        # 8. 持久化 transcript
        await self.save_transcript(session.id, student_id, context.messages)

        # 9. 更新 ConversationSummary
        await self.update_conversation_summary(student_id, context)

    async def route(self, student_id, message, pipeline_stage, summary):
        """L1 → L1.5 → L2 → L4 四级路由"""
        # L1: 显式路由 (管线入口)
        stage_to_agent = {
            "resume": "ResumeCoach", "match": "CareerMatchCoach",
            "learning": "LearningPathCoach", "report": "ReportCoach",
        }
        if pipeline_stage and pipeline_stage in stage_to_agent:
            return stage_to_agent[pipeline_stage]

        # L1.5: 用户显式声明
        for cmd, agent in [("/resume", "ResumeCoach"), ("/match", "CareerMatchCoach"),
                           ("/learn", "LearningPathCoach"), ("/report", "ReportCoach")]:
            if message.strip().startswith(cmd):
                return agent

        # L2: 规则匹配 (关键词正则)
        rules = {
            "ResumeCoach": ["简历", "面试", "技能", "能力"],
            "CareerMatchCoach": ["岗位", "匹配", "行业", "公司"],
            "LearningPathCoach": ["学习", "课程", "路径", "进度"],
            "ReportCoach": ["报告", "导出", "成长"],
        }
        for agent, keywords in rules.items():
            if any(kw in message for kw in keywords):
                return agent

        # L4: LLM 意图识别 (300ms 超时，fallback 到 L2 首个命中)
        try:
            result = await asyncio.wait_for(
                self.llm_client.classify_intent(message, list(rules.keys())),
                timeout=0.3,
            )
            return result
        except asyncio.TimeoutError:
            return "ResumeCoach"  # 默认 fallback
```

### 4.4 ToolExecutor — 带恢复的执行器

```python
class ToolExecutor:
    def __init__(self, tool_registry: "ToolRegistry"):
        self.registry = tool_registry
        self.max_retries = 3
        self.base_delay = 1.0  # 秒

    async def execute_with_recovery(
        self, tool_name: str, args: dict, context: LoopContext
    ) -> "ToolResult":
        last_error = None
        for attempt in range(self.max_retries):
            try:
                tool = self.registry.get(tool_name)
                if not tool:
                    return ToolResult(success=False, error=f"Tool '{tool_name}' not found")

                # mutation_gated 检查
                if tool.classification == "mutation_gated":
                    return await self._execute_mutation_gated(tool, args, context)

                # 普通执行
                result = await asyncio.wait_for(
                    tool.execute(args, context),
                    timeout=30.0,  # 30s 硬超时
                )
                return result

            except asyncio.TimeoutError:
                last_error = f"Tool '{tool_name}' timed out"
                delay = self.base_delay * (2 ** attempt)
                await asyncio.sleep(delay)
            except Exception as e:
                last_error = str(e)
                if attempt < self.max_retries - 1:
                    delay = self.base_delay * (2 ** attempt)
                    await asyncio.sleep(delay)

        return ToolResult(success=False, error=last_error, recovery="max_retries_exceeded")

    async def _execute_mutation_gated(
        self, tool: "Tool", args: dict, context: LoopContext
    ) -> "ToolResult":
        """mutation_gated 工具：propose → adjudicate → commit"""
        proposal = await tool.evaluate_and_propose(args, context)
        record = await memory_manager.propose_memory_mutation(proposal)

        if record.decision_type == DecisionType.REJECTED:
            return ToolResult(
                success=False,
                error=f"Memory mutation rejected: insufficient evidence (confidence={proposal.confidence})",
            )

        return ToolResult(
            success=True,
            summary=f"{'Confirmed' if record.decision_type == DecisionType.AUTO_CONFIRMED else 'Provisionally recorded'}",
            detail={"mutation_id": record.id, "decision_type": record.decision_type},
        )
```

### 4.5 6 种恢复路径

| # | 场景 | 恢复策略 | 实现 |
|---|------|---------|------|
| 1 | 工具执行失败 | 指数退避重试，最多 3 次 | `execute_with_recovery` 内建 |
| 2 | 工具返回错误 | 将错误注入 LLM 上下文，让模型决定替代方案 | tool_result error → LLM 看到 error 后自行决策 |
| 3 | 上下文超限 (85%+) | compact_context，保留最后 6 条消息，旧消息 LLM 摘要 | Phase 2 |
| 4 | LLM API 超时 | 重试最多 2 次，仍失败 → graceful degradation | `llm_client.stream_chat` 内建 |
| 5 | 工具不存在 | fallback 到替代工具或告知用户 | ToolRegistry.get() → None 分支 |
| 6 | 连续 3 次失败 | 降级为友好提示，记录 dead_letter | `max_retries_exceeded` recovery 标记 |

### 4.6 NDJSON 流协议

所有流式端点使用 `application/x-ndjson`，每行一个 JSON 对象。

**字段命名统一为 camelCase**（后端输出即前端 TypeScript 类型，不做 DTO 转换）：

| event | 字段 (camelCase) | 说明 |
|-------|------|------|
| `meta` | `sessionId, assistantMessageId, activeAgent?, createdAt` | 会话初始化 |
| `route` | `agent, fromAgent?, reason?` | 路由决策结果 |
| `delta` | `delta` | 流式文本增量 |
| `thinking` | `delta` | 思考过程增量 |
| `tool_call` | `toolCallId, toolName, displayName` | 工具调用开始 |
| `tool_args` | `toolCallId, args?` | 工具参数 (增量或全量) |
| `tool_result` | `toolCallId, result?, error?` | 工具执行结果 |
| `agent_switch` | `from, to, reason?` | 子 Agent 切换 |
| `error` | `code, detail, retryable?` | 错误事件 |
| `done` | `data?` | 流结束 |

### 4.7 StreamEvent 模型与后端端点

```python
# backend/app/schemas/agent.py
from pydantic import BaseModel
from typing import Optional, Any

class StreamEvent(BaseModel):
    """NDJSON 流事件 — 全字段 camelCase，与前端 TypeScript 类型一一对应"""
    event: str  # meta | route | delta | thinking | tool_call | tool_args | tool_result | agent_switch | error | done

    # meta 事件
    sessionId: Optional[str] = None
    assistantMessageId: Optional[str] = None
    activeAgent: Optional[str] = None
    createdAt: Optional[float] = None

    # route / agent_switch
    agent: Optional[str] = None
    fromAgent: Optional[str] = None
    to: Optional[str] = None
    reason: Optional[str] = None

    # delta / thinking
    delta: Optional[str] = None

    # tool_call / tool_args / tool_result
    toolCallId: Optional[str] = None
    toolName: Optional[str] = None
    displayName: Optional[str] = None
    args: Optional[dict] = None
    result: Optional[dict] = None
    error: Optional[str] = None

    # error
    code: Optional[str] = None
    detail: Optional[str] = None
    retryable: Optional[bool] = None

    # done
    data: Optional[dict] = None


# backend/app/api/coach.py
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/coach")

@router.post("/chat/stream")
async def coach_chat_stream(
    request: Request,
    body: CoachChatRequest,
):
    """主对话流端点"""
    query_engine = get_query_engine()

    async def event_generator():
        async for event in query_engine.submit_message(
            student_id=request.user.student_id,
            session_id=body.session_id,
            message=body.content,
            pipeline_stage=body.pipeline_stage,
            attachments=body.attachments,
        ):
            if await request.is_disconnected():
                break
            yield event.model_dump_json() + "\n"

    return StreamingResponse(
        event_generator(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
```

---

## 5. Context Builder

### 5.1 架构

```
System Prompt =
  STATIC_SEGMENT (per agent, ~3000 tokens, cache_control: ephemeral)
  + COMMON_STATIC_SUFFIX (共享规则, ~500 tokens, cache_control: ephemeral)
  + __CONTEXT_DYNAMIC_BOUNDARY__
  + dynamic_segment (硬记忆 + 软记忆 + 群体智慧 + 会话上下文 + 活跃工具)
```

### 5.2 ContextBuilder 实现

```python
class ContextBuilder:
    # 每个子 Agent 的静态 Persona
    STATIC_SEGMENTS = {
        "ResumeCoach": """
你是"简历教练"，专注于帮助学生分析简历、评估能力、发现与目标岗位的差距。

你的能力：
- 解析简历，提取技能、教育背景、项目经历
- 对比学生当前能力画像与目标岗位要求，精准定位差距
- 提出具体的简历改进建议（关键词优化、结构重组、成就量化）
- 基于 12 维能力模型评估学生各项能力得分

行为准则：
- 对比分析时以具体数据说话，禁止模糊评价
- 技能评分需给出明确依据（简历原文/项目描述/证书）
- 发现能力差距后，不要直接让学生去改简历──先解释为什么这个差距重要
- 对于不确定的能力维度，标注 confidence 而非强行评分
""",
        "CareerMatchCoach": """
你是"职业匹配教练"，专注于帮助学生探索职业方向、发现匹配岗位、了解行业动态。

你的能力：
- 基于学生能力画像和兴趣推荐匹配岗位
- 对比同一岗位在不同行业的职责差异
- 搜索特定公司和岗位信息
- 管理学生的岗位收藏夹

行为准则：
- 推荐岗位时必须附带匹配理由（哪些能力契合？哪些需要补强？）
- 行业对比时突出"这个行业为什么适合你"而非泛泛罗列
- 收藏岗位时确认"你是想进一步了解这个岗位还是暂时保存？"
- 不要替学生做职业选择──提供信息、分析优劣、让学生自己判断
""",
        "LearningPathCoach": """
你是"学习路径教练"，专注于为学生规划技能提升路径、推荐学习资源、跟踪学习进度。

你的能力：
- 制定个性化学习计划（优先级排序 + 时间估算）
- 推荐学习资源（课程、项目、书籍、实践）
- 验证学习成果并记录进度
- 定期复盘学习效果

行为准则：
- 制定学习计划前先了解学生的时间预算（每周可投入小时数）
- 资源推荐遵循"免费优先、官方优先、实践优先"原则
- 验证进度时要求学生提供具体证据（测验截图、项目链接、证书）
- 学生声称"掌握"某技能时，必须通过以下至少 2 项验证：
  1. 完成相关测验并达到 80% 正确率
  2. 完成一个实战项目
  3. 能够解释核心概念并回答追问
- 未经验证的技能标记为 in_progress，不可标记为 mastered
""",
        "ReportCoach": """
你是"成长报告教练"，专注于生成、编辑和导出学生的职业发展报告。

你的能力：
- 基于学生能力画像和学习记录生成个性化成长报告
- 编辑报告各章节（成就、反思、下一步计划）
- 追加新的成就条目和反思
- 导出报告为 PDF/DOCX 格式

行为准则：
- 报告措辞实事求是，不夸大成就
- 反思部分需引导学生自己表达，你只做润色和结构化
- 每条成就需附带 evidence（学了什么、做了什么、结果如何）
- 带 provisional 标记的内容在报告中需标注"初步评估，待进一步验证"
""",
    }

    COMMON_STATIC_SUFFIX = """
## 通用行为准则

1. 始终使用友好、鼓励的语气。你面对的是正在探索职业方向的大学生。
2. 使用 12 维能力模型作为分析框架：专业技能、专业背景、学历要求、团队协作能力、抗压/适应能力、分析解决问题能力、沟通表达能力、工作经验、文档规范意识、责任心/工作态度、学习能力、补充信息。
3. 每次给出建议后，提供明确的下一步行动（不要只说"你可以试试"）。
4. 当学生表达困惑时，先理解他们的处境再给建议。
5. 不确定的信息明确标注"我不确定"而非猜测。
6. 涉及隐私或敏感话题时，提醒学生保护个人信息。

## 工具使用规范

- 调用工具前先向学生说明你要做什么
- 工具执行过程中保持透明（显示进度或思考过程）
- 工具返回错误时坦诚告知，并提供替代方案
- mutation_gated 工具（修改记忆/能力画像）的结果会由系统自动裁决，你只需提交提议
"""

    async def build(
        self,
        student_id: str,
        active_agent: str,
        summary: ConversationSummaryV1_1,
        soft_memories: list[dict],
        pipeline_stage: str | None,
        conversation_history: list[dict],
    ) -> tuple[str, list[dict], list[dict]]:
        """返回 (system_prompt, tools_json_schema, messages)"""

        static = self.STATIC_SEGMENTS.get(active_agent, "")
        system_prompt = (
            static
            + self.COMMON_STATIC_SUFFIX
            + "\n\n__CONTEXT_DYNAMIC_BOUNDARY__\n\n"
            + self._format_hard_memory(summary)
            + self._format_soft_memories(soft_memories)
            + self._format_collective_wisdom(student_id, summary)
            + self._format_session_context(pipeline_stage)
        )

        tools = self.tool_registry.get_for_agent(active_agent)

        messages = [
            {"role": "system", "content": system_prompt},
            *conversation_history,
        ]

        return system_prompt, tools, messages

    def _format_hard_memory(self, summary: ConversationSummaryV1_1) -> str:
        """将 ConversationSummary 格式化为 Markdown 注入上下文"""
        parts = ["## 学生档案\n"]
        parts.append(f"- 姓名: {summary.student_profile.get('name', MemoryField(value='未知')).value}")
        parts.append(f"- 专业: {summary.student_profile.get('major', MemoryField(value='未知')).value}")
        parts.append(f"- 年级: {summary.student_profile.get('grade', MemoryField(value='未知')).value}")
        parts.append(f"- 目标岗位: {summary.career_goal.get('role', MemoryField(value='未设定')).value}")

        parts.append("\n## 技能评估\n")
        for skill_id, skill in summary.skills.items():
            status_icon = {"mastered": "✓", "in_progress": "○", "needs_review": "?"}
            prov_tag = " [待复核]" if skill.memory_status == MemoryStatus.PROVISIONAL else ""
            parts.append(
                f"- {status_icon.get(skill.mastery_status, '?')} {skill_id}: "
                f"{skill.mastery_status} (confidence: {skill.confidence:.0%})"
                f"{prov_tag}"
            )

        # provisional overlays 提示
        if summary.provisional_overlays:
            parts.append("\n## 待确认信息\n")
            for path, overlay in summary.provisional_overlays.items():
                parts.append(f"- {path}: {overlay.proposed_value} (confidence: {overlay.confidence:.0%}) [来源: {overlay.source}]")

        parts.append(f"\n## 当前阶段: {summary.current_stage}")
        if summary.open_questions:
            parts.append(f"\n## 待解决问题:\n" + "\n".join(f"- {q}" for q in summary.open_questions))
        parts.append(f"\n## 推荐下一步: {summary.next_recommended_action}")

        return "\n".join(parts)

    def _format_soft_memories(self, soft_memories: list[dict]) -> str:
        if not soft_memories:
            return ""
        parts = ["\n## 相关历史场景\n"]
        for i, mem in enumerate(soft_memories):
            parts.append(f"### 相关场景 {i+1} (相似度: {mem['score']:.2f})\n{mem['fragment']}\n")
        return "\n".join(parts)

    def _format_collective_wisdom(self, student_id: str, summary: ConversationSummaryV1_1) -> str:
        """从群体智慧中提取相关参考信息（标注来源和样本量）"""
        # 查询同专业/同目标岗位学生的学习路径
        # 返回格式：标注 sample_size、support_count、"仅供参考"
        return ""

    def _format_session_context(self, pipeline_stage: str | None) -> str:
        if not pipeline_stage:
            return ""
        stage_labels = {
            "resume": "简历解构阶段",
            "match": "职业匹配阶段",
            "learning": "学习路径阶段",
            "report": "成长报告阶段",
        }
        return f"\n## 当前管线阶段: {stage_labels.get(pipeline_stage, pipeline_stage)}\n"
```

### 5.3 Token 预算管理

```python
class TokenBudget:
    def __init__(self, total: int = 100000, output_reserve: int = 8000, compact_threshold: float = 0.85):
        self.total = total
        self.output_reserve = output_reserve
        self.compact_threshold = compact_threshold
        self.effective = total - output_reserve  # 92K

    @property
    def usage_ratio(self) -> float:
        return self.current_tokens / self.effective

    def recalculate(self, messages: list[dict]):
        self.current_tokens = estimate_token_count(messages)


async def compact_context(messages: list[dict], keep_last: int = 6) -> list[dict]:
    """上下文压缩：保留最后 N 条消息，旧消息用 LLM 摘要替代"""
    if len(messages) <= keep_last:
        return messages
    to_summarize = messages[:-keep_last]
    recent = messages[-keep_last:]
    summary = await llm_client.summarize(to_summarize, max_tokens=2000)
    return [
        {"role": "system", "content": f"[之前的对话摘要]\n{summary}"},
        *recent,
    ]
```

### 5.4 LLM Client

```python
class LLMClient:
    async def stream_chat(
        self, messages: list[dict], system_prompt: str, tools: list[dict]
    ) -> AsyncGenerator[LLMChunk, None]:
        """流式调用 LLM，带 Prompt Cache"""
        response = await self.client.chat.completions.create(
            model="claude-sonnet-4-6",
            messages=messages,
            tools=tools,
            max_tokens=8000,
            stream=True,
            extra_headers={
                "anthropic-beta": "prompt-caching-2024-07-31",
            },
        )
        async for chunk in response:
            yield self._parse_chunk(chunk)
```

---

## 6. Tool System

### 6.1 完整工具列表及端点映射

| Agent | 工具名 | 中文名 | 分类 | 端点 |
|-------|--------|--------|------|------|
| **ResumeCoach** | `parse_resume` | 解析简历 | readonly | `POST /api/student-competency-profile/chat/stream` |
| | `read_profile` | 读取能力画像 | readonly | `GET /api/student-competency-profile/runtime` |
| | `analyze_gap_between_resume_and_target` | 简历目标差距分析 | readonly | `POST /api/career-development-report/personal-growth-report` |
| | `suggest_keyword` | 建议关键词 | readonly | `GET /api/student-competency-profile/latest-analysis` |
| **CareerMatchCoach** | `search_matches` | 搜索匹配岗位 | readonly | `GET /api/job-exploration-match` |
| | `compare_industries` | 同岗行业对比 | readonly | `GET /api/job-requirement-profile/vertical` |
| | `search_company` | 搜索公司 | readonly | `GET /api/jobs` |
| | `save_to_shortlist` | 收藏到入围名单 | mutation_safe | `POST /api/career-development/favorites` |
| | `read_job_graph` | 读取岗位能力图谱 | readonly | `GET /api/job-requirement-profile/overview` |
| **LearningPathCoach** | `read_plan` | 读取学习计划 | readonly | `GET /api/career-development-report/learning-path` |
| | `suggest_resources` | 推荐学习资源 | readonly | `POST /api/career-development-report/goal-setting-path-planning` |
| | `verify_and_record_progress` | 验证记录进度 | **mutation_gated** | Memory System |
| | `create_review` | 创建复盘 | mutation_safe | `POST /api/snail-learning-path/reviews` |
| **ReportCoach** | `read_report` | 读取报告草稿 | readonly | `GET /api/career-development-report/personal-growth-report` |
| | `generate_report` | 生成报告 | mutation_safe | `POST /api/career-development-report/personal-growth-report/tasks` |
| | `update_section` | 编辑报告章节 | mutation_safe | `PUT /api/career-development-report/personal-growth-report` |
| | `append_achievement` | 追加成就 | **mutation_gated** | Memory System |
| | `update_reflection` | 更新反思 | **mutation_gated** | Memory System |
| | `export_report` | 导出报告 | readonly | `GET /api/career-development-report/personal-growth-report/export` |
| **Shared** | `switch_agent` | 切换子 Agent | Coordinator 内部 | - |
| | `recall_memory` | 搜索记忆 | readonly | Qdrant + SQLite |
| | `get_home_summary` | 获取首页摘要 | readonly | `GET /api/home-v2` |

### 6.2 Tool 与 ToolRegistry

```python
from dataclasses import dataclass
from typing import Callable, Literal

ToolClassification = Literal["readonly", "mutation_safe", "mutation_gated"]

@dataclass
class Tool:
    name: str
    display_name: str
    description: str
    parameters: dict              # JSON Schema
    classification: ToolClassification
    handler: Callable             # async (args, context) → ToolResult
    agent: str                    # 所属 Agent
    endpoint: str | None = None   # 映射的 REST 端点

class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool):
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def get_for_agent(self, agent: str) -> list[dict]:
        """返回某 Agent 的所有工具 JSON Schema"""
        return [
            {
                "name": t.name,
                "description": t.description,
                "input_schema": {
                    "type": "object",
                    "properties": t.parameters,
                    "required": list(t.parameters.keys()),
                },
            }
            for t in self._tools.values()
            if t.agent == agent or t.agent == "Shared"
        ]
```

### 6.3 readonly_api_handler 工厂

```python
async def readonly_api_handler(endpoint: str, method: str, args: dict, context: LoopContext) -> ToolResult:
    """通用 readonly API 调用工厂，消除样板代码"""
    try:
        if method == "GET":
            response = await api_request(endpoint, params=args, headers=auth_header(context))
        else:
            response = await api_request(endpoint, json=args, headers=auth_header(context))
        return ToolResult(success=True, summary=format_api_response(response), detail=response)
    except Exception as e:
        return ToolResult(success=False, error=str(e))
```

### 6.4 mutation_gated 示例：verify_and_record_progress

```python
async def verify_and_record_progress_handler(args: dict, context: LoopContext) -> ToolResult:
    """完整的 mutation_gated 流程：
    evidence evaluation → confidence calculation → risk determination → propose → adjudicate → result
    """
    skill_id = args["skill_id"]
    evidence = args["evidence"]

    # 1. 证据评估
    evidence_score = evaluate_evidence(evidence)  # 0.0 ~ 1.0
    if evidence_score < 0.5:
        return ToolResult(
            success=False,
            error=f"证据不足 (score={evidence_score:.0%})，需要至少 2 项验证来源",
        )

    # 2. 置信度计算
    confidence = calculate_confidence(evidence, context)

    # 3. 风险判定
    risk_level = determine_risk(skill_id)

    # 4. 生成提议
    proposal = MemoryMutationProposal(
        student_id=context.student_id,
        target_table="conversation_summaries",
        target_field=f"skills.{skill_id}.mastery_status",
        old_value=get_current_mastery(context.conversation_summary, skill_id),
        new_value="mastered",
        evidence=json.dumps(evidence),
        source_agent=context.active_agent,
        source_idempotency_key=hash_idempotency_key(
            context.student_id, skill_id, "skill_mastered", "v3"
        ),
        source_event_id=build_id("evt"),
        trace_id=context.trace_id,
        confidence=confidence,
        risk_level=risk_level,
    )

    # 5. 提交裁决
    record = await memory_manager.propose_memory_mutation(proposal)

    if record.decision_type == DecisionType.REJECTED:
        return ToolResult(
            success=False,
            error=f"技能掌握验证未通过：confidence={confidence:.0%}，需补充证据",
        )

    # 6. 成功 → emit 级联事件
    if record.decision_type == DecisionType.AUTO_CONFIRMED:
        await outbox_emitter.emit_event(
            event_type="skill_mastered",
            payload={"skill_id": skill_id, "student_id": context.student_id},
            idempotency_key=proposal.source_idempotency_key,
            trace_id=context.trace_id,
        )

    return ToolResult(
        success=True,
        summary=f"技能 '{skill_id}' 已标记为 {record.decision_type}",
        detail={"mutation_id": record.id, "confidence": confidence},
    )


def evaluate_evidence(evidence: list[dict]) -> float:
    """证据质量评分"""
    if not evidence:
        return 0.0
    weights = {"quiz": 0.3, "project": 0.4, "certificate": 0.2, "self_report": 0.1}
    score = 0.0
    for e in evidence:
        score += weights.get(e.get("type", "self_report"), 0.05)
    return min(score, 1.0)


def determine_risk(skill_id: str) -> RiskLevel:
    """风险分级"""
    high_risk_skills = {"algorithm_engineering", "system_design", "full_stack_development"}
    medium_risk_skills = {"data_analysis", "project_management", "team_leadership"}
    if skill_id in high_risk_skills:
        return RiskLevel.HIGH
    if skill_id in medium_risk_skills:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW
```

---

## 7. 前端 Chat UI

### 7.1 路由

```typescript
// myapp/config/routes.ts 新增
{ path: '/coach', name: 'AI 教练', component: './coach',
  access: 'canUser', hideInMenu: true }
```

| 来源页面 | "问教练"按钮跳转 |
|---------|-----------------|
| 简历解构 `/student-competency-profile` | `/coach?step=resume` |
| 职业匹配 `/career-match` | `/coach?step=match` |
| 学习路径 `/snail-learning-path` | `/coach?step=learning` |
| 成长报告 `/personal-growth-report` | `/coach?step=report` |

`/coach?session_id=xxx` 恢复历史会话。`step` 和 `session_id` 互斥，`session_id` 优先。

### 7.2 组件树

```
CoachChatPage
├── CoachChatHeader          # Agent 名称 · 会话标题 · 新建/历史按钮
├── CoachChatBody            # 消息列表
│   ├── MessageBubble        # 用户消息 (含 attachments 缩略图)
│   ├── AssistantMessage     # AI 回复容器
│   │   ├── StreamingText    # 流式文本 + 闪烁光标
│   │   ├── ThinkingBlock    # 思考过程 (可折叠 + 三点脉动)
│   │   ├── ToolCallCard     # 工具调用 (spinner → ✓/✗)
│   │   │   ├── ToolCallHeader  # 工具名 + 状态图标
│   │   │   ├── ToolCallArgs    # 参数 JSON (可折叠)
│   │   │   └── ToolCallResult  # 结果摘要 (可折叠)
│   │   └── AgentSwitchBadge # Agent 切换标识
│   ├── SystemMessage        # 系统消息 (错误/中断/重试提示)
│   └── RetryButton          # 错误重试
├── CoachChatInput           # 底部输入区
│   ├── PendingUploads       # 待发送附件缩略图
│   ├── ChatTextArea         # autoResize 文本输入
│   ├── FileUploadButton     # 文件选择
│   ├── StopButton           # 停止生成 (streaming 时替换 Send)
│   └── SendButton
├── GlobalErrorBar           # 全局错误提示条
└── CoachChatSidebar         # 历史会话列表
    └── SessionListItem       # 会话标题 + 时间 + 最后一条消息摘要
```

### 7.3 TypeScript 类型

```typescript
type AgentName = 'ResumeCoach' | 'CareerMatchCoach' | 'LearningPathCoach' | 'ReportCoach';

type CoachMessage = UserMessage | AssistantMessage | SystemMessage | AgentSwitchMessage;

interface UserMessage {
  id: string; role: 'user'; content: string;
  clientMessageId: string;          // UUID v7，重试幂等键
  attachments?: Attachment[];
  createdAt: number; retryCount: number;
}

interface AssistantMessage {
  id: string; role: 'assistant'; content: string;
  thinkingContent?: string;
  toolCalls: ToolCallEntry[];
  activeAgent?: AgentName;
  status: 'streaming' | 'completed' | 'error' | 'aborted';
  errorDetail?: string; createdAt: number;
}

interface SystemMessage {
  id: string; role: 'system';
  kind: 'info' | 'error' | 'abort' | 'retry-hint';
  content: string; retryable?: boolean;
  failedMessageId?: string; createdAt: number;
}

interface AgentSwitchMessage {
  id: string; role: 'agent-switch';
  from: AgentName; to: AgentName; reason?: string; createdAt: number;
}

interface ToolCallEntry {
  id: string; toolName: string; displayName: string;
  args?: Record<string, unknown>;
  result?: { summary: string; detail?: Record<string, unknown> };
  error?: string;
  status: 'executing' | 'success' | 'error';
  startedAt: number; completedAt?: number;
}

interface Attachment { fileId: string; name: string; type: string; size: number; }

interface PendingUpload extends Attachment {
  uploadState: 'uploading' | 'ready' | 'error';
  progress?: number; errorDetail?: string; file: File;
}

type StreamEvent =
  | { event: 'meta'; sessionId: string; assistantMessageId: string; activeAgent?: AgentName; createdAt: number }
  | { event: 'route'; agent: AgentName; fromAgent?: AgentName; reason?: string }
  | { event: 'delta'; delta: string }
  | { event: 'thinking'; delta: string }
  | { event: 'tool_call'; toolCallId: string; toolName: string; displayName: string }
  | { event: 'tool_args'; toolCallId: string; args: Record<string, unknown> }
  | { event: 'tool_result'; toolCallId: string; result?: { summary: string; detail?: Record<string, unknown> }; error?: string }
  | { event: 'agent_switch'; from: AgentName; to: AgentName; reason?: string }
  | { event: 'error'; code: string; detail: string; retryable?: boolean }
  | { event: 'done'; data?: Record<string, unknown> };
```

### 7.4 useCoachChat Hook

```typescript
function useCoachChat(options?: {
  initialStep?: string;
  initialSessionId?: string;
}): {
  messages: CoachMessage[];
  streamState: 'idle' | 'connecting' | 'streaming' | 'error';
  activeAgent: AgentName | null;
  pendingUploads: PendingUpload[];
  sessionId: string | null;
  sendMessage: (content: string, opts?: { attachments?: Attachment[] }) => Promise<void>;
  abort: () => void;
  retry: (failedMessageId: string) => Promise<void>;
  uploadFile: (file: File) => Promise<Attachment>;
  removeUpload: (fileId: string) => void;
  loadSession: (sessionId: string) => Promise<void>;
  newSession: (step?: string) => void;
};
```

#### 状态机

```
idle ──sendMessage()──▶ connecting ──meta──▶ streaming
  ▲                         │                    │
  │                         └──error────────────▶│ error
  │                                              │
  ├── streaming: abort() ──▶ aborting            │
  │    → reader.cancel()    → 追加 SystemMessage  │
  │    → streamState = idle                       │
  │                                              │
  ├── streaming: done ──▶ idle                   │
  └── streaming: error ──▶ error ──retry()──▶ connecting
```

#### sendMessage 实现

```typescript
async function sendMessage(content: string, opts?: { attachments?: Attachment[] }) {
  const clientMsgId = crypto.randomUUID();
  const userMsg: UserMessage = {
    id: buildId('msg'), role: 'user', content,
    clientMessageId: clientMsgId, attachments: opts?.attachments,
    createdAt: Date.now(), retryCount: 0,
  };
  setState(s => ({ ...s, messages: [...s.messages, userMsg], streamState: 'connecting' }));

  const controller = new AbortController();
  abortControllerRef.current = controller;

  try {
    const stream = streamCoachChat({
      message: content, clientMessageId: clientMsgId,
      sessionId: state.sessionId,
      pipelineStage: activeAgentToStage(state.activeAgent),
      attachments: opts?.attachments,
    }, controller.signal);

    for await (const event of stream) {
      if (controller.signal.aborted) break;
      setState(s => dispatchEvent(s, event));
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      setState(s => ({
        ...s, streamState: 'idle',
        messages: [...s.messages, abortSystemMsg(), markLastAssistantAborted(s)],
      }));
    } else {
      setState(s => dispatchEvent(s, {
        event: 'error', code: 'NETWORK_ERROR',
        detail: (err as Error).message, retryable: true,
      }));
    }
  } finally { abortControllerRef.current = null; }
}
```

#### abort + retry

```typescript
function abort() {
  abortControllerRef.current?.abort();
  // finally 块自动处理状态重置
}

async function retry(failedMessageId: string) {
  const failedMsg = state.messages.find(m => m.id === failedMessageId);
  if (!failedMsg || failedMsg.role !== 'user') return;
  const idx = state.messages.indexOf(failedMsg);
  setState(s => ({ ...s, messages: s.messages.slice(0, idx) }));
  await sendMessage(failedMsg.content, { attachments: failedMsg.attachments });
}
```

#### uploadFile

```typescript
async function uploadFile(file: File): Promise<Attachment> {
  const tempId = buildId('upload');
  const pending: PendingUpload = {
    fileId: tempId, name: file.name, type: file.type,
    size: file.size, uploadState: 'uploading', progress: 0, file,
  };
  setState(s => ({ ...s, pendingUploads: [...s.pendingUploads, pending] }));

  try {
    const formData = new FormData(); formData.append('file', file);
    const response = await request<API.CoachUploadResult>('/api/coach/upload', {
      method: 'POST', data: formData, requestType: 'form',
      onUploadProgress: (e) => {
        setState(s => updateUpload(s, tempId,
          u => ({ ...u, progress: Math.round((e.loaded / e.total) * 100) })));
      },
    });
    const attachment: Attachment = {
      fileId: response.file_id, name: response.name,
      type: response.type, size: response.size,
    };
    setState(s => updateUpload(s, tempId, u => ({ ...u, ...attachment, uploadState: 'ready' })));
    return attachment;
  } catch (err) {
    setState(s => updateUpload(s, tempId,
      u => ({ ...u, uploadState: 'error', errorDetail: (err as Error).message })));
    throw err;
  }
}
```

### 7.5 事件分发 Reducer

```typescript
function dispatchEvent(state: ChatState, event: StreamEvent): ChatState {
  switch (event.event) {
    case 'meta':
      return { ...state, sessionId: event.sessionId,
        messages: [...state.messages, newAssistantMsg(event.assistantMessageId, event.activeAgent)] };
    case 'route':
      return { ...state, activeAgent: event.agent,
        messages: event.fromAgent ? [...state.messages, agentSwitchMsg(event)] : state.messages };
    case 'delta':
      return appendToLastAssistant(state, msg => ({ ...msg, content: msg.content + event.delta }));
    case 'thinking':
      return appendToLastAssistant(state, msg =>
        ({ ...msg, thinkingContent: (msg.thinkingContent ?? '') + event.delta }));
    case 'tool_call':
      return appendToLastAssistant(state, msg =>
        ({ ...msg, toolCalls: [...msg.toolCalls, newToolCall(event)] }));
    case 'tool_args':
      return updateToolCall(state, event.toolCallId, tc => ({ ...tc, args: event.args }));
    case 'tool_result':
      return updateToolCall(state, event.toolCallId, tc =>
        ({ ...tc, status: event.error ? 'error' : 'success', error: event.error,
           result: event.result, completedAt: Date.now() }));
    case 'agent_switch':
      return { ...state, activeAgent: event.to,
        messages: [...state.messages, agentSwitchMsg(event)] };
    case 'error':
      return { ...state, streamState: 'error',
        messages: [...markLastAssistantError(state, event), ...state.messages, systemErrorMsg(event)] };
    case 'done':
      return { ...state, streamState: 'idle',
        messages: markLastAssistantComplete(state) };
  }
}
```

### 7.6 NDJSON 事件 → UI 映射

| event | dispatch | UI 效果 |
|-------|----------|---------|
| `meta` | 设置 sessionId, messageId | Header 显示会话标题 |
| `route` | 更新 activeAgent | AgentSwitchBadge 入场动画 |
| `delta` | 追加 content | 逐 token 打字机效果 |
| `thinking` | 追加 thinkingContent | ThinkingBlock 展开 + 闪烁光标 |
| `tool_call` | 创建 toolCall | ToolCallCard 滑入 (spinner) |
| `tool_args` | 更新 toolCall.args | 参数 JSON 逐行展示 |
| `tool_result` | 更新 toolCall.result | spinner → ✓/✗ |
| `agent_switch` | 插入 badge | 淡入 + 平移 |
| `error` | 标记消息 error | 气泡变红 + 重试按钮 + 全局提示 |
| `done` | streamState=idle | 停止按钮消失 |

### 7.7 动画系统

基于 `framer-motion@^12.38.0` + `motionTokens`，全部遵守 `prefersReducedMotion`：

| 动画 | 触发事件 | 实现 | 时长 |
|------|---------|------|------|
| 流式光标闪烁 | delta | CSS `@keyframes blink` step-end infinite | 1s循环 |
| Thinking 展开 | thinking (首次) | `AnimatePresence` + height 0→auto + opacity | 0.3s |
| Thinking 三点脉动 | thinking (持续) | 三个 `<span>` 依次 scale 1→1.3→1，stagger 0.15s | 0.9s |
| ToolCallCard 入场 | tool_call | `motion.div` y:8→0 + opacity 0→1 | 0.3s |
| ToolCall 完成勾 | tool_result (success) | SVG circle + check pathLength 描边 0→1 | 0.4s |
| ToolCall 失败抖动 | tool_result (error) | x: [0, -4, 4, -4, 4, 0] keyframes | 0.3s |
| AgentSwitchBadge | agent_switch | x: -12→0 + opacity 0→1 | 0.3s |
| UserBubble 入场 | sendMessage (本地) | x: 16→0 + opacity 0→1 | 0.25s |
| StopButton 显隐 | streamState 变化 | `AnimatePresence` fade + scale 0.8→1 | 0.15s |
| GlobalErrorBar 滑入 | 全局错误 | y: -24→0 + opacity 0→1 | 0.3s |

### 7.8 样式方案

沿用现有三层体系：`claudeTokens` + CSS custom properties (`global.less`) + `createStyles` per component。不引入新依赖。

### 7.9 API Service 层

```typescript
// myapp/src/pages/coach/api.ts

// NDJSON 流式消费 — 复用现有 fetch + ReadableStream + TextDecoder 模式
export async function* streamCoachChat(
  params: { message, clientMessageId, sessionId?, pipelineStage?, attachments? },
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const token = await getAccessToken();
  const response = await fetch('/api/coach/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Accept': 'application/x-ndjson' },
    body: JSON.stringify({ content: params.message, client_message_id: params.clientMessageId, session_id: params.sessionId, pipeline_stage: params.pipelineStage, attachments: params.attachments }),
    signal,
  });
  if (!response.ok) throw new Error(await tryGetErrorDetail(response));
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No readable stream');
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        yield JSON.parse(trimmed) as StreamEvent;
      }
    }
    if (buffer.trim()) yield JSON.parse(buffer.trim()) as StreamEvent;
  } finally { reader.releaseLock(); }
}

// 文件上传
export async function uploadCoachFile(file: File, onProgress?: (e) => void): Promise<CoachUploadResult> {
  const formData = new FormData(); formData.append('file', file);
  return request<CoachUploadResult>('/api/coach/upload', { method: 'POST', data: formData, requestType: 'form', onUploadProgress: onProgress });
}

// 会话管理
export async function listCoachSessions(): Promise<CoachSessionSummary[]> { ... }
export async function getCoachSession(sessionId: string): Promise<CoachSessionDetail> { ... }
export async function deleteCoachSession(sessionId: string): Promise<void> { ... }

// DTO → 前端模型转换
function loadMessagesFromDTO(dtos: CoachMessageDTO[]): CoachMessage[] { ... }
```

---

## 8. 后端新增端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/coach/chat/stream` | POST | 主对话流端点 (NDJSON) |
| `/api/coach/upload` | POST | 文件上传，返回 file_id |
| `/api/coach/sessions` | GET | 当前用户会话列表 |
| `/api/coach/sessions/:id` | GET | 会话详情 (含消息历史) |
| `/api/coach/sessions/:id` | DELETE | 删除会话 |

---

## 9. 完整文件结构

### 后端 (16 文件)

```
backend/app/
├── api/coach.py                    # POST /api/coach/chat/stream StreamingResponse
├── services/
│   ├── agent_loop.py               # query_loop() AsyncGenerator, LoopContext, LoopState, StopReason
│   ├── query_engine.py             # QueryEngine.submit_message() + route()
│   ├── tool_executor.py            # ToolExecutor + execute_with_recovery()
│   ├── context_builder.py          # ContextBuilder.build() + 4 agent personas
│   ├── token_budget.py             # TokenBudget + compact_context()
│   ├── llm_client.py               # stream_llm() with cache_control ephemeral
│   ├── memory/
│   │   ├── manager.py              # MemoryManager: CRUD + propose + commit + recall
│   │   ├── adjudicator.py          # adjudicate() 裁决逻辑
│   │   ├── rollback.py             # rollback_memory_mutation()
│   │   └── collective_wisdom.py    # CW 查询与写入
│   └── outbox/
│       ├── emitter.py              # emit_event() → outbox_events 表
│       └── worker.py               # Background worker 拉取 pending → 投递
├── schemas/
│   ├── memory.py                   # 全部 Pydantic 模型 + 枚举
│   └── agent.py                    # StreamEvent, CoachChatRequest/Response
└── models/
    └── coach.py                    # SQLAlchemy: conversation_summaries, memory_mutations, decision_journal, cw_entities, cw_relations, cw_observations, feedback_records, outbox_events
```

### 前端 (19 文件)

```
myapp/src/pages/coach/
├── index.tsx                    # CoachChatPage 路由入口
├── types.ts                     # CoachMessage, StreamEvent, ToolCallEntry, etc.
├── eventReducer.ts              # dispatchEvent() + helpers
├── eventReducer.test.ts
├── api.ts                       # streamCoachChat, uploadCoachFile, sessions CRUD
├── hooks/
│   ├── useCoachChat.ts          # 主 hook (sendMessage, abort, retry, uploadFile, loadSession)
│   └── useCoachChat.test.ts
└── components/
    ├── CoachChatHeader.tsx       # Agent 名称 · 会话标题 · 新建/历史
    ├── CoachChatBody.tsx         # 消息列表 + 虚拟滚动
    ├── CoachChatInput.tsx        # Send/Stop 切换 + 文件上传 + 输入区
    ├── CoachChatSidebar.tsx      # 历史会话列表
    ├── MessageBubble.tsx         # 用户消息气泡
    ├── AssistantMessage.tsx      # AI 回复容器 (组合 StreamingText, ThinkingBlock, ToolCallCard, AgentSwitchBadge)
    ├── StreamingText.tsx         # 流式文本 + 闪烁光标
    ├── ThinkingBlock.tsx         # 思考过程 (可折叠 + 三点动画)
    ├── ToolCallCard.tsx          # 工具调用卡片 (spinner/check/error)
    ├── AgentSwitchBadge.tsx      # Agent 切换标识
    ├── SystemMessage.tsx         # 系统消息 (error/abort/retry)
    ├── GlobalErrorBar.tsx        # 全局错误提示条
    └── PendingUploads.tsx        # 待发送附件缩略图列表
```

---

## 10. 实施阶段

### P0a — 最简回路（无工具、无记忆、无路由）

**目标**：跑通 `/api/coach/chat/stream` → NDJSON → 前端渲染的完整管道，不依赖任何现有 API。

- `coach.py` 端点：接收 POST，返回 `StreamingResponse(media_type="application/x-ndjson")`
- `LLMClient.stream_chat()`：调用 LLM，yield `text_delta` → 转换为 `delta` StreamEvent
- `StreamEvent` Pydantic 模型（全字段 camelCase）
- 前端 `streamCoachChat()` + `useCoachChat` + `ChatCoachBody` + `StreamingText`
- 硬编码 system prompt（不含记忆注入）
- 仅 `delta`、`done`、`error` 三种事件
- 无工具调用、无路由、无记忆系统
- **验收标准**：`/coach` 发送任意消息，收到 LLM 流式回复，页面不白屏

### P0b — 路由 + 最小 Context Builder

**目标**：对话能根据入口场景正确路由到子 Agent。

- `QueryEngine.route()`：L1(显式 `?step=`) + L2(关键词规则) + L4 fallback
- `ContextBuilder`：4 个 Agent Persona 静态段 + `COMMON_STATIC_SUFFIX` + `__CONTEXT_DYNAMIC_BOUNDARY__`
- 前端 `CoachChatHeader` 显示 `activeAgent` 名称
- `route` 事件收发验证
- **验收标准**：`/coach?step=resume` 激活 ResumeCoach 并显示其 persona，`/coach?step=learning` 激活 LearningPathCoach

### P0c — 首个 readonly 工具

**目标**：验证工具调用 → 结果返回的完整链路（1 个 mock 工具即可）。

- `ToolRegistry` + `Tool` 类定义
- `ToolExecutor.execute_with_recovery()` — 仅处理 `readonly` 分类
- 前端 `ToolCallCard` 组件（spinner → check/fail + 参数/结果可折叠）
- `tool_call`、`tool_args`、`tool_result` 三个事件收发验证
- mock 工具：`read_profile`（返回硬编码能力画像 JSON）
- **验收标准**：发送"读取我的能力画像"，前端展示 ToolCallCard 卡片 + 工具返回数据

### P1 — 记忆系统

- Memory System 全部 8 张 SQLite 表创建
- MemoryManager CRUD + Adjudicator 裁决逻辑
- propose → adjudicate → commit 完整链路
- ConversationSummary 持久化与恢复
- 前端会话恢复 (`/coach?session_id=xxx`)
- **验收标准**: 学生关闭页面重新打开，对话历史和能力画像完整恢复

### P2 — 工具集成 + 事件总线

- 全部 22 个工具与现有 API 对接
- mutation_gated 工具 (`verify_and_record_progress`, `append_achievement`, `update_reflection`) 走完整裁决流程
- Outbox 事件表 + Background Worker
- 级联白名单执行: `skill_mastered → [ReportCoach, ResumeCoach]`
- **验收标准**: LearningPathCoach 判定掌握后，ReportCoach 自动更新报告

### P3 — 前端完整体验

- ThinkingBlock + ToolCallCard + AgentSwitchBadge 组件
- 全部 10 种动画接入 (framer-motion + prefersReducedMotion)
- 中断/重试/文件上传功能
- GlobalErrorBar + CoachChatSidebar 历史列表
- **验收标准**: 对话体验对标 Claude 官网

### P4 — 可靠性与可观测性

- Dead Letter Queue 监控
- 路由命中率仪表盘 (L1/L1.5/L2/L4 各层命中占比)
- Agent 准确率追踪 (反馈闭环)
- 回滚功能端到端测试
- memory_mutations 审计链完整性验证

### P5 — 群体智慧 + 自举训练

- CollectiveWisdom E→R→O 数据填充
- 路由日志收集 → L3 BERT-tiny 4 分类器微调
- Prompt 基于反馈数据持续优化
- 5 个缺失后端端点补全 (goal-setting-path-planning 相关)

---

## 11. 与现有系统共存

- **ChatStream** (简历解构页内嵌) 保持不变，继续服务简历分析场景
- **Coach Chat** 是独立全屏对话页 (`/coach`)，服务通用 AI 教练场景
- 两者共享底层 NDJSON 流式模式，事件协议不同
- 现有 66 个 REST 端点不做任何改动
- 后端新增 5 个端点独立于现有路由注册
- 现有前端组件 (ClaudeButton, ClaudeInput, ClaudeCard 等) 复用于 Chat UI

---

## 12. 测试策略

### 12.1 测试分层

```
E2E (Playwright)              ←  完整对话流程, ~20 cases
  ├── 集成测试 (pytest+httpx)  ←  端点+工具+记忆, ~60 cases
  │     └── 单元测试 (pytest)  ←  纯逻辑, ~120 cases
  └── LLM 输出验证 (deepeval)  ←  关键场景断言, ~15 cases
```

| 层级 | 框架 | 覆盖目标 | 关注点 |
|------|------|---------|--------|
| 单元测试 | pytest | 裁决逻辑、路由分类、Token 计算、Outbox 幂等、Context Builder 格式化 | 纯函数无副作用 |
| 集成测试 | pytest + httpx | `/api/coach/chat/stream` 端到端、22 工具与现有 API mock 交互、记忆 CRUD 链路、事件 emit-outbox-deliver | 组件间契约 |
| E2E 测试 | Playwright | 前端完整对话 (流式渲染、中断、重试、文件上传、会话恢复) | 真实用户路径 |
| LLM 验证 | deepeval | 关键场景下 Agent 工具调用是否正确、输出是否合规 | LLM 行为断言 |
| 性能测试 | locust / k6 | 50 并发对话、内存泄漏检查、outbox 积压监控 | 系统容量 |

### 12.2 单元测试用例 (关键场景)

```python
# tests/test_adjudicator.py

def test_low_risk_high_confidence_auto_confirmed():
    """低风险 + 高置信度 → 自动 confirmed"""
    proposal = MemoryMutationProposal(
        student_id="stu_1", target_table="conversation_summaries",
        target_field="skills.python.mastery_status",
        old_value="in_progress", new_value="mastered",
        evidence="quiz_90 + project_github",
        source_agent="LearningPathCoach",
        source_idempotency_key="hash_xxx",
        source_event_id="evt_001", trace_id="trace_001",
        confidence=0.97, risk_level=RiskLevel.LOW,
    )
    record = await adjudicate(proposal)
    assert record.decision_type == DecisionType.AUTO_CONFIRMED


def test_high_risk_high_confidence_capped_at_provisional():
    """高风险即使高置信也 capped 为 provisional"""
    proposal = MemoryMutationProposal(
        student_id="stu_1", target_table="conversation_summaries",
        target_field="skills.algorithm_engineering.mastery_status",
        old_value="in_progress", new_value="mastered",
        evidence="passed_leetcode_hard",
        source_agent="LearningPathCoach",
        source_idempotency_key="hash_yyy",
        source_event_id="evt_002", trace_id="trace_002",
        confidence=0.98, risk_level=RiskLevel.HIGH,
    )
    record = await adjudicate(proposal)
    assert record.decision_type == DecisionType.PROVISIONAL_WRITE


def test_low_confidence_rejected():
    """置信度 < 0.80 → 拒绝"""
    proposal = MemoryMutationProposal(
        student_id="stu_1", target_table="conversation_summaries",
        target_field="skills.python.mastery_status",
        old_value="in_progress", new_value="mastered",
        evidence="self_reported",
        source_agent="LearningPathCoach",
        source_idempotency_key="hash_zzz",
        source_event_id="evt_003", trace_id="trace_003",
        confidence=0.60, risk_level=RiskLevel.LOW,
    )
    record = await adjudicate(proposal)
    assert record.decision_type == DecisionType.REJECTED


def test_provisional_blocked_by_confirmed_writes_overlay():
    """已有 confirmed 记录 → provisional 写入 overlay 而非拒绝"""
    # setup: 预先插入一条 confirmed mutation
    proposal = MemoryMutationProposal(
        student_id="stu_1", target_table="conversation_summaries",
        target_field="skills.python.mastery_status",
        old_value="in_progress", new_value="mastered",
        evidence="new_evidence",
        source_agent="LearningPathCoach",
        source_idempotency_key="hash_new",
        source_event_id="evt_004", trace_id="trace_004",
        confidence=0.83, risk_level=RiskLevel.MEDIUM,
    )
    record = await adjudicate(proposal)
    assert record.decision_type == DecisionType.PROVISIONAL_WRITE
    assert record.overlay_target is True


def test_apply_field_update_mixed_dict_model():
    """_apply_field_update 支持 dict + BaseModel 混合路径"""
    summary = ConversationSummaryV1_1()
    skill = SkillEntryV1_1(mastery_status=MasteryStatus.IN_PROGRESS)
    summary.skills["python"] = skill

    # 路径穿过 dict("skills") → BaseModel("python")
    memory_manager._apply_field_update(summary, "skills.python.mastery_status", "mastered")
    assert summary.skills["python"].mastery_status == "mastered"


def test_idempotency_key_hash_deterministic():
    """幂等键相同输入产生相同 hash"""
    k1 = hash_idempotency_key("stu_1", "skills.python", "skill_mastered", "v3")
    k2 = hash_idempotency_key("stu_1", "skills.python", "skill_mastered", "v3")
    assert k1 == k2

# tests/test_route.py
def test_l1_explicit_route():
    engine = QueryEngine(...)
    assert engine.route(..., pipeline_stage="resume") == "ResumeCoach"

def test_l2_keyword_route():
    assert engine.route(..., message="帮我分析一下我的简历") == "ResumeCoach"

def test_l4_fallback_on_unknown():
    assert engine.route(..., message="今天天气怎么样") == "ResumeCoach"  # fallback

# tests/test_context_builder.py
def test_static_segment_cached():
    """静态 persona segment 不带入动态上下文"""
    builder = ContextBuilder()
    prompt = builder.STATIC_SEGMENTS["ResumeCoach"]
    assert "__CONTEXT_DYNAMIC_BOUNDARY__" not in prompt

def test_hard_memory_formatting():
    """硬记忆格式化包含 mastery_status 和 provisional 标记"""
    summary = ConversationSummaryV1_1()
    summary.skills["python"] = SkillEntryV1_1(
        mastery_status=MasteryStatus.MASTERED,
        memory_status=MemoryStatus.PROVISIONAL,
        confidence=0.85,
    )
    output = builder._format_hard_memory(summary)
    assert "mastered" in output
    assert "待复核" in output

# tests/test_outbox.py
def test_outbox_idempotency():
    """相同 idempotency_key 不重复投递"""
    await emitter.emit_event("skill_mastered", payload, key="k1", trace_id="t1")
    await emitter.emit_event("skill_mastered", payload, key="k1", trace_id="t1")
    records = await db.fetchall("SELECT * FROM outbox_events WHERE idempotency_key = 'k1'")
    assert len(records) == 1

def test_outbox_dead_letter_after_3_retries():
    """3 次重试失败后进入 dead_letter"""
    # 模拟投递失败 3 次
    for _ in range(3):
        await worker.process_one(event_id)
    event = await db.fetchone("SELECT status FROM outbox_events WHERE id = ?", (event_id,))
    assert event["status"] == "dead_letter"
```

### 12.3 集成测试用例

```python
# tests/test_coach_stream.py

@pytest.mark.integration
async def test_coach_chat_stream_resume_flow(client, mock_llm):
    """端到端：学生发送简历分析请求 → 收到 NDJSON 流式回复"""
    async with client.stream("POST", "/api/coach/chat/stream", json={
        "content": "帮我分析简历中的 Python 技能",
        "client_message_id": "msg_001",
        "pipeline_stage": "resume",
    }) as response:
        assert response.status_code == 200
        events = []
        async for line in response.aiter_lines():
            events.append(json.loads(line))

    event_types = [e["event"] for e in events]
    assert event_types[0] == "route"
    assert event_types[1] == "meta"
    assert "delta" in event_types
    assert event_types[-1] == "done"


@pytest.mark.integration
async def test_session_recovery_loads_history(client, db):
    """会话恢复：关闭页面重开 → 历史消息完整加载"""
    session = await create_test_session(db, student_id="stu_1")
    detail = await client.get(f"/api/coach/sessions/{session.id}")
    assert detail.status_code == 200
    data = detail.json()["data"]
    assert data["id"] == session.id
    assert len(data["messages"]) > 0


@pytest.mark.integration
async def test_upload_file_type_rejected(client):
    """上传非允许类型 → 400"""
    resp = await client.post("/api/coach/upload",
        files={"file": ("virus.exe", b"malware", "application/x-msdownload")})
    assert resp.status_code == 400


@pytest.mark.integration
async def test_student_isolation(client):
    """学生 A 不能访问学生 B 的会话"""
    session_b = await create_test_session(db, student_id="stu_B")
    resp = await client.get(f"/api/coach/sessions/{session_b.id}",
        headers=make_auth_header(student_id="stu_A"))
    assert resp.status_code == 403


@pytest.mark.integration
async def test_mutation_gated_skill_mastered_flow(client, db, mock_llm):
    """完整 mutation_gated 流程：验证技能 → 写入记忆 → 级联事件"""
    # mock LLM 返回 tool_call: verify_and_record_progress
    mock_llm.set_response(tool_calls=[{
        "name": "verify_and_record_progress",
        "arguments": {"skill_id": "python", "evidence": [
            {"type": "quiz", "score": 0.9},
            {"type": "project", "url": "github.com/stu/repo"},
        ]},
    }])
    async with client.stream("POST", "/api/coach/chat/stream", ...) as response:
        events = [json.loads(line) async for line in response.aiter_lines()]

    tool_result = next(e for e in events if e["event"] == "tool_result")
    assert tool_result["result"] is not None  # auto_confirmed

    # 验证记忆已写入
    mutations = await db.fetchall(
        "SELECT * FROM memory_mutations WHERE student_id = 'stu_1' AND target_field = 'skills.python.mastery_status'")
    assert len(mutations) == 1
    assert mutations[0]["decision_type"] == "auto_confirmed"

    # 验证 outbox 事件已 emit
    events = await db.fetchall(
        "SELECT * FROM outbox_events WHERE idempotency_key = ?",
        (hash_idempotency_key("stu_1", "python", "skill_mastered", "v3"),))
    assert len(events) == 1
```

### 12.4 E2E 测试 (Playwright)

```typescript
// e2e/coach-chat.spec.ts

test('完整对话流程：发送消息 → 流式渲染 → 工具调用卡片 → 停止', async ({ page }) => {
  await page.goto('/coach?step=resume');
  await expect(page.getByText('简历教练')).toBeVisible();

  // 发送消息
  await page.getByRole('textbox').fill('帮我分析 Python 能力');
  await page.getByRole('button', { name: '发送' }).click();

  // 观察流式文本渲染 (至少出现内容)
  await expect(page.locator('[data-testid="streaming-text"]')).toBeVisible({ timeout: 10000 });

  // 等待完成
  await expect(page.getByRole('button', { name: '发送' })).toBeVisible({ timeout: 30000 });
});

test('中断生成', async ({ page }) => {
  await page.goto('/coach');
  await page.getByRole('textbox').fill('写一份详细的成长报告');
  await page.getByRole('button', { name: '发送' }).click();

  // 停止按钮出现
  await page.getByRole('button', { name: '停止' }).click();

  // 系统消息出现
  await expect(page.getByText('已停止生成')).toBeVisible();
  // 发送按钮恢复
  await expect(page.getByRole('button', { name: '发送' })).toBeVisible();
});

test('错误重试', async ({ page }) => {
  // 模拟网络错误
  await page.route('/api/coach/chat/stream', route => route.abort());

  await page.goto('/coach');
  await page.getByRole('textbox').fill('测试');
  await page.getByRole('button', { name: '发送' }).click();

  await expect(page.getByText('重试')).toBeVisible();
  await page.getByRole('button', { name: '重试' }).click();
  // 恢复后正常发送
});

test('文件上传 + 附件缩略图', async ({ page }) => {
  await page.goto('/coach');
  await page.setInputFiles('[data-testid="file-upload"]', 'fixtures/resume.pdf');
  await expect(page.getByText('resume.pdf')).toBeVisible();  // 缩略图
  // 发送带附件的消息
  await page.getByRole('textbox').fill('分析这份简历');
  await page.getByRole('button', { name: '发送' }).click();
});

test('会话恢复', async ({ page }) => {
  // 先创建会话
  await page.goto('/coach?step=resume');
  await page.getByRole('textbox').fill('第一条消息');
  await page.getByRole('button', { name: '发送' }).click();
  await page.waitForSelector('[data-testid="streaming-text"]');

  // 获取 session_id 后通过 URL 恢复
  const sessionId = await page.evaluate(() => localStorage.getItem('coach_session_id'));
  await page.goto(`/coach?session_id=${sessionId}`);
  await expect(page.getByText('第一条消息')).toBeVisible();
});
```

### 12.5 LLM 输出验证

```python
# tests/test_llm_output.py
from deepeval import assert_test
from deepeval.metrics import ToolCorrectnessMetric, AnswerRelevancyMetric

def test_resume_coach_calls_parse_resume():
    """简历分析场景应调用 parse_resume 工具"""
    result = run_agent_scenario(
        agent="ResumeCoach",
        user_message="帮我分析我上传的简历",
        attachments=[{"file_id": "f_001", "name": "resume.pdf"}],
    )
    tool_correctness = ToolCorrectnessMetric()
    assert_test(result, [tool_correctness])  # 期望调用 parse_resume


def test_learning_path_coach_requests_evidence():
    """学生声称掌握技能时，LearningPathCoach 必须要求证据"""
    result = run_agent_scenario(
        agent="LearningPathCoach",
        user_message="我已经完全掌握 Python 了",
    )
    assert "测验" in result.final_response or "项目" in result.final_response
    assert "证据" in result.final_response or "验证" in result.final_response


def test_output_no_pii():
    """输出不含敏感信息"""
    result = run_agent_scenario(
        agent="ResumeCoach",
        user_message="我的手机号是 13812345678，帮我分析",
    )
    for event in result.stream_events:
        if event["event"] == "delta":
            assert "138" not in event["delta"]
```

### 12.6 性能测试

```python
# tests/test_performance.py
import asyncio
import pytest

@pytest.mark.performance
async def test_50_concurrent_sessions():
    """50 并发对话不崩溃，P95 首 token 延迟 < 5s"""
    async def one_session(i):
        async with client.stream("POST", "/api/coach/chat/stream", json={
            "content": f"测试消息 {i}",
            "client_message_id": f"perf_{i}",
        }) as resp:
            first_event_time = time.time()
            async for line in resp.aiter_lines():
                if '"event":"delta"' in line:
                    break
            return time.time() - first_event_time

    tasks = [one_session(i) for i in range(50)]
    latencies = await asyncio.gather(*tasks, return_exceptions=True)
    p95 = sorted(latencies)[int(len(latencies) * 0.95)]
    assert p95 < 5.0, f"P95 首 token 延迟 {p95}s > 5s"

@pytest.mark.performance
async def test_outbox_no_backlog():
    """事件投递不积压：pending 事件数 < 100"""
    # 模拟 100 个事件 emit
    for i in range(100):
        await emitter.emit_event("test_event", {}, key=f"perf_{i}", trace_id=f"t_{i}")
    # worker 跑一轮
    await worker.process_batch(batch_size=50)
    pending = await db.fetchval("SELECT COUNT(*) FROM outbox_events WHERE status = 'pending'")
    assert pending < 100
```

### 12.7 CI 门禁

| 检查 | 命令 | 阻断条件 |
|------|------|---------|
| 单元测试 | `pytest tests/ -k "not integration and not e2e and not performance"` | 失败 |
| 覆盖率 | `pytest --cov=backend/app/services --cov-report=term-missing` | < 80% |
| 集成测试 | `pytest tests/ -k "integration"` | 失败 |
| 类型检查 | `mypy backend/app/` | 错误 |
| E2E | `playwright test` | 失败 (仅 main 分支阻断) |
| 性能 | `pytest tests/ -k "performance"` | 回归 > 20% 退化 (告警不阻断) |
