"""Local competency profile extraction service.

Replaces the Dify workflow for 12-dimension profile extraction.
Orchestrates: document parsing → intent classification → LLM extraction → normalization.
"""

from __future__ import annotations

import json
from enum import Enum
from typing import Any
from uuid import uuid4

from app.services.document_parser import DocumentParser, DocumentParserError
from app.services.llm import ChatMessage, LLMClientError, OpenAICompatibleLLMClient
from app.services.student_competency_profile import (
    DifyChatResult,
    DifyRuntimeConfig,
    DifyUploadedFile,
    StudentCompetencyUploadConstraint,
)


TWELVE_DIMENSION_KEYS: list[str] = [
    "professional_skills",
    "professional_background",
    "education_requirement",
    "teamwork",
    "stress_adaptability",
    "communication",
    "work_experience",
    "documentation_awareness",
    "responsibility",
    "learning_ability",
    "problem_solving",
    "other_special",
]

DEFAULT_PROFILE_VALUE = "暂无补充信息"

# Extracted from the Dify "12维度提取.yml" workflow — the system prompt for
# the "生成12维信息" LLM nodes. All extraction rules preserved verbatim.
PROFILE_EXTRACTION_SYSTEM_PROMPT = """你是一名"12维结构化画像抽取助手"。你的任务是：基于用户提供的文本内容，提取并输出固定的 12 个维度的结构化 JSON 数据。

你需要基于输入的岗位文本，按固定的 12 个维度进行归类分析，并输出 JSON。

## 输出要求

1. 每个字段的值必须是数组。
2. 只输出**关键词或短语**，不输出完整句子。
3. 不得编造输入文本中不存在的信息。
4. 无明确信息时输出 `["暂无补充信息"]`。
5. `other_special` 只允许承接以下内容：**证书、语言、出差/驻场、班次、驾照、特殊准入**。
6. 若内容能放入前 11 个维度，优先放入前 11 个维度，不得滥用 `other_special`。
7. 输出必须为**标准 JSON**，不得附加解释、备注、标题或代码块。

## 关键信息抽取规则

### 一、禁止过度拆分

- 不要把一个完整能力短语拆成过多孤立词。
- 优先保留输入中的原始短语、并列短语、固定搭配、技术组合。
- 例如：
  - "轮播图开发" 不要只写成 "轮播"
  - "异步请求处理" 不要只写成 "异步"
  - "搜索筛选功能" 不要拆成 "搜索""筛选"
  - "列表展示与数据渲染" 不要拆成 "列表展示""数据渲染" 两个孤立碎片，除非原文明确并列要求
  - "Flex / Grid 布局" 可保留为一个短语或两个完整短语，但不要只保留 "Flex""Grid"

### 二、优先输出更完整、更可理解的短语

- 若原文是零散标签、逗号分隔、斜杠分隔、换行分隔的词组，需要结合上下文合并为更自然的能力表达。
- 合并原则：
  - 技术名词 + 动作/场景 → 完整短语
  - 工具/技术 + 功能对象 → 完整短语
  - 相邻并列且语义相关 → 可合并成一个更自然短语

### 三、保持原意，不做扩写推断

- 只允许做**轻度规范化表达**，让短语更完整易懂。
- 不得引申出原文没有明确表达的经验、能力、学历、行业背景等。

### 五、去重与规范化

- 同义或高度重复项合并后保留一个更自然的表达。
- 输出短语尽量控制在 **2~10 个字或 1 个完整技术短语**，保证简洁且可读。

### 六、标签场景兼容规则

- 当输入内容为标签流、关键词堆叠、后台勾选项时，应优先恢复为招聘语境下可独立理解的技能短语，而不是逐字切分。"""

TWELVE_DIMENSION_JSON_SCHEMA: dict[str, Any] = {
    "title": "JobProfile12Dimensions",
    "type": "object",
    "description": "用于岗位要求画像或学生能力画像的 12 维结构化输出。",
    "additionalProperties": False,
    "properties": {
        "professional_skills": {
            "type": "array", "items": {"type": "string"}, "minItems": 1, "uniqueItems": True,
            "title": "专业技能/技术栈",
            "description": "具体技能、工具、技术栈、方法、平台、软件或专业操作能力。",
        },
        "professional_background": {
            "type": "array", "items": {"type": "string"}, "minItems": 1, "uniqueItems": True,
            "title": "专业背景",
            "description": "专业、学科、知识背景或岗位偏好的教育方向。",
        },
        "education_requirement": {
            "type": "array", "items": {"type": "string"}, "minItems": 1, "uniqueItems": True,
            "title": "学历要求",
            "description": "学历层级、学位门槛或基础教育门槛。",
        },
        "teamwork": {
            "type": "array", "items": {"type": "string"}, "minItems": 1, "uniqueItems": True,
            "title": "团队协作能力",
            "description": "团队合作、跨团队配合、协同推进相关要求或表现。",
        },
        "stress_adaptability": {
            "type": "array", "items": {"type": "string"}, "minItems": 1, "uniqueItems": True,
            "title": "抗压/适应能力",
            "description": "压力承受、节奏适应、多任务适配或变化环境适应能力。",
        },
        "communication": {
            "type": "array", "items": {"type": "string"}, "minItems": 1, "uniqueItems": True,
            "title": "沟通表达能力",
            "description": "沟通、表达、汇报、协调、对接相关要求或表现。",
        },
        "work_experience": {
            "type": "array", "items": {"type": "string"}, "minItems": 1, "uniqueItems": True,
            "title": "工作经验",
            "description": "年限要求、实习经历、项目经历、行业经历或岗位经历。",
        },
        "documentation_awareness": {
            "type": "array", "items": {"type": "string"}, "minItems": 1, "uniqueItems": True,
            "title": "文档规范意识",
            "description": "文档编写、报告输出、记录沉淀、流程规范等相关能力或要求。",
        },
        "responsibility": {
            "type": "array", "items": {"type": "string"}, "minItems": 1, "uniqueItems": True,
            "title": "责任心/工作态度",
            "description": "责任心、认真、严谨、主动、踏实、细致、执行力、职业操守等态度要求或表现。",
        },
        "learning_ability": {
            "type": "array", "items": {"type": "string"}, "minItems": 1, "uniqueItems": True,
            "title": "学习能力",
            "description": "持续学习、自我更新、快速上手新知识或成长潜力。",
        },
        "problem_solving": {
            "type": "array", "items": {"type": "string"}, "minItems": 1, "uniqueItems": True,
            "title": "分析解决问题能力",
            "description": "定位问题、分析原因、排查故障、提出方案、推动解决、优化改进。",
        },
        "other_special": {
            "type": "array", "items": {"type": "string"}, "minItems": 1, "uniqueItems": True,
            "title": "其他/特殊要求",
            "description": "仅承接前 11 个维度都不适合承接的特殊门槛，如证书、语言、出差/驻场、班次、驾照或特殊准入要求。",
        },
    },
    "required": TWELVE_DIMENSION_KEYS,
}


class IntentClassifier(str, Enum):
    CREATE_PROFILE = "create_profile"
    MODIFY_PROFILE = "modify_profile"
    QA = "qa"

    _CREATE_KEYWORDS = {
        "分析", "解析", "提取", "创建", "生成", "建立", "画像",
        "12维", "十二维", "简历", "材料", "文档", "文件",
    }
    _MODIFY_KEYWORDS = {
        "修改", "改成", "更改", "更新", "添加", "增加", "加入",
        "补充", "删除", "移除", "去掉", "替换",
    }
    _QA_KEYWORDS = {
        "适合", "建议", "提升", "优势", "劣势", "不足",
        "面试", "准备", "如何", "怎样", "怎么", "什么",
        "为什么", "推荐", "规划", "方向",
    }

    @classmethod
    def build_classifier_messages(cls, prompt: str) -> list[ChatMessage]:
        return [
            ChatMessage(
                role="system",
                content=(
                    "你是一个意图分类器。请将用户输入分类为以下三类之一：\n"
                    f"1. {cls.CREATE_PROFILE.value} — 用户要求创建或提取12维画像\n"
                    f"2. {cls.MODIFY_PROFILE.value} — 用户要求修改已有的12维画像\n"
                    f"3. {cls.QA.value} — 用户提出咨询问题或询问建议\n"
                    "只输出分类名称，不要输出其他内容。"
                ),
            ),
            ChatMessage(role="user", content=prompt),
        ]


def analyze_intent(prompt: str, *, has_files: bool = False) -> IntentClassifier:
    """Keyword-based intent classification.

    Falls back to CREATE_PROFILE when there are uploaded files or when
    the prompt is empty. For ambiguous queries, the caller can use the
    LLM-based classifier via ``build_classifier_messages()`` instead.
    """
    text = prompt.strip().lower()
    if not text:
        return IntentClassifier.CREATE_PROFILE
    if has_files:
        return IntentClassifier.CREATE_PROFILE

    create_score = sum(1 for kw in IntentClassifier._CREATE_KEYWORDS if kw in text)
    modify_score = sum(1 for kw in IntentClassifier._MODIFY_KEYWORDS if kw in text)
    qa_score = sum(1 for kw in IntentClassifier._QA_KEYWORDS if kw in text)

    if modify_score > create_score and modify_score >= qa_score:
        return IntentClassifier.MODIFY_PROFILE
    if qa_score > create_score and qa_score > modify_score:
        return IntentClassifier.QA
    return IntentClassifier.CREATE_PROFILE


def build_profile_extraction_messages(
    content: str,
    *,
    document_text: str | None = None,
) -> list[ChatMessage]:
    """Build the message list for the 12-dimension extraction LLM call."""
    combined_parts: list[str] = []
    if document_text:
        combined_parts.append(document_text)
    combined_parts.append(content)
    combined_text = "\n\n".join(combined_parts)

    return [
        ChatMessage(role="system", content=PROFILE_EXTRACTION_SYSTEM_PROMPT),
        ChatMessage(role="user", content=combined_text),
    ]


def _strip_code_fence(text: str) -> str:
    """Remove markdown code fences if present."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        cleaned: list[str] = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("```"):
                continue
            cleaned.append(line)
        result = "\n".join(cleaned).strip()
        if result:
            return result
    return text


def extract_profile_from_text(raw_text: str) -> dict[str, list[str]]:
    """Parse the LLM response text into a normalized 12-dimension profile dict."""
    text = raw_text.strip()
    if not text:
        raise ValueError("LLM response is empty")

    text = _strip_code_fence(text)

    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Failed to parse LLM response as JSON: {exc}") from exc

    if not isinstance(data, dict):
        raise ValueError(f"LLM response is not a JSON object: {type(data).__name__}")

    return normalize_profile_from_llm(data)


def normalize_profile_from_llm(raw: dict[str, Any]) -> dict[str, list[str]]:
    """Normalize the LLM response to ensure all 12 dimensions exist.

    Strips whitespace from values, removes duplicates, and fills
    missing dimensions with the default value.
    """
    result: dict[str, list[str]] = {}
    for key in TWELVE_DIMENSION_KEYS:
        values = raw.get(key)
        if not isinstance(values, list):
            result[key] = [DEFAULT_PROFILE_VALUE]
        else:
            cleaned = [
                str(item).strip()
                for item in values
                if isinstance(item, str) and item.strip()
            ]
            result[key] = list(dict.fromkeys(cleaned)) or [DEFAULT_PROFILE_VALUE]
    return result


class LocalCompetencyProfileClient:
    """Local implementation replacing DifyStudentCompetencyClient.

    Parses uploaded documents locally via ``DocumentParser``, classifies
    user intent, then calls the local LLM for 12-dimension extraction
    (or modification / Q&A). Returns the same DTO types as the Dify
    client so the API layer can swap implementations transparently.
    """

    def __init__(self) -> None:
        self._llm_client = OpenAICompatibleLLMClient.from_settings()
        self._extracted_texts: dict[str, str] = {}

    async def aclose(self) -> None:
        await self._llm_client.aclose()

    async def get_runtime_config(self, *, force_refresh: bool = False) -> DifyRuntimeConfig:
        del force_refresh
        return DifyRuntimeConfig(
            opening_statement="",
            file_upload_enabled=True,
            file_size_limit_mb=None,
            image_upload=StudentCompetencyUploadConstraint(
                variable="userinput_image",
                allowed_file_types=["image"],
                allowed_file_extensions=[".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
                allowed_file_upload_methods=["local_file"],
                max_length=3,
            ),
            document_upload=StudentCompetencyUploadConstraint(
                variable="userinput_file",
                allowed_file_types=["document"],
                allowed_file_extensions=[".txt", ".md", ".csv", ".pdf", ".docx"],
                allowed_file_upload_methods=["local_file"],
                max_length=3,
            ),
        )

    async def upload_file(
        self,
        *,
        file_name: str,
        content: bytes,
        content_type: str | None,
        user: str,
    ) -> DifyUploadedFile:
        del user
        upload_id = uuid4().hex

        import io
        try:
            parsed = DocumentParser.parse_file_from_bytes(
                content, file_name, content_type
            )
        except (DocumentParserError, AttributeError):
            parsed = content.decode("utf-8-sig")

        self._extracted_texts[upload_id] = parsed

        inferred_type = "image" if (content_type or "").startswith("image/") else "document"
        return DifyUploadedFile(
            upload_file_id=upload_id,
            type=inferred_type,
            name=file_name,
        )

    async def send_message(
        self,
        *,
        query: str,
        user: str,
        conversation_id: str | None = None,
        image_files: list[DifyUploadedFile] | None = None,
        document_files: list[DifyUploadedFile] | None = None,
        document_texts: list[str] | None = None,
    ) -> DifyChatResult:
        del user
        conv_id = conversation_id or uuid4().hex
        msg_id = uuid4().hex

        all_doc_texts: list[str] = list(document_texts or [])
        if document_files:
            for f in document_files:
                text = self._extracted_texts.pop(f.upload_file_id, None)
                if text:
                    all_doc_texts.append(text)

        intent = analyze_intent(query, has_files=bool(all_doc_texts))
        combined_doc_text = "\n\n".join(all_doc_texts) if all_doc_texts else None

        if intent == IntentClassifier.CREATE_PROFILE:
            messages = build_profile_extraction_messages(
                content=query,
                document_text=combined_doc_text,
            )
            answer = await self._llm_client.chat_completion_structured(
                messages,
                temperature=0.3,
                json_schema=TWELVE_DIMENSION_JSON_SCHEMA,
            )
        elif intent == IntentClassifier.MODIFY_PROFILE:
            messages = [
                ChatMessage(
                    role="system",
                    content=(
                        "你是一个12维画像修改助手。基于用户的要求修改现有的12维JSON数据。"
                        "输出必须为标准JSON，包含全部12个维度。"
                    ),
                ),
                ChatMessage(role="user", content=query),
            ]
            answer = await self._llm_client.chat_completion_structured(
                messages,
                temperature=0.3,
                json_schema=TWELVE_DIMENSION_JSON_SCHEMA,
            )
        else:
            messages = [
                ChatMessage(
                    role="system",
                    content=(
                        "你是职业规划大师，负责分析12维画像数据，"
                        "根据内容解决用户的问题并提供合理的解决方案，结果保证200字以内。"
                    ),
                ),
                ChatMessage(role="user", content=query),
            ]
            answer_text = await self._llm_client.chat_completion(
                messages, temperature=0.7
            )
            return DifyChatResult(
                conversation_id=conv_id,
                message_id=msg_id,
                answer=answer_text,
            )

        if isinstance(answer, dict):
            answer_json = json.dumps(answer, ensure_ascii=False)
        else:
            answer_json = str(answer)

        return DifyChatResult(
            conversation_id=conv_id,
            message_id=msg_id,
            answer=answer_json,
        )


_local_client: LocalCompetencyProfileClient | None = None


def get_local_competency_profile_client() -> LocalCompetencyProfileClient:
    global _local_client
    if _local_client is None:
        _local_client = LocalCompetencyProfileClient()
    return _local_client
