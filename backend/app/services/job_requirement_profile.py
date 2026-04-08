from __future__ import annotations

import asyncio
import json
from collections.abc import Callable
from dataclasses import dataclass
import re

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.job_posting import JobPosting
from app.models.job_requirement_profile import JobRequirementProfile
from app.services.llm import ChatMessage, OpenAICompatibleLLMClient


DIMENSION_FIELDS = (
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
)
DEFAULT_KEYWORD = "无明确要求"
DEFAULT_JSON_ARRAY = json.dumps([DEFAULT_KEYWORD], ensure_ascii=False)
DETAIL_SEPARATOR = "\n\n-----\n\n"
SYSTEM_PROMPT = """你是岗位要求信息抽取器。
你只能依据提供的岗位详情文本抽取关键词或短语，不能臆造、不能补充常识。
输出必须是单个 JSON 对象，且只能包含以下 12 个键：
professional_skills
professional_background
education_requirement
teamwork
stress_adaptability
communication
work_experience
documentation_awareness
responsibility
learning_ability
problem_solving
other_special

规则：
1. 每个键的值必须是 JSON 数组，数组元素是中文关键词或短语。
2. 不要输出完整句子、不要输出解释、不要输出 Markdown。
3. 去重并移除空字符串。
4. 文本里无法明确提取时，返回 ["无明确要求"]。
5. 只返回合法 JSON。
6. responsibility 只能提取责任心、认真、严谨、主动、踏实、细心、执行力、职业操守等态度类要求，不能写岗位职责或工作内容。
7. communication 只能提取沟通、表达、协调、交流、汇报类要求。
8. teamwork 只能提取团队合作、协作、配合类要求。
9. education_requirement 只能提取学历层级要求；专业名称应放到 professional_background。
10. work_experience 只能提取工作年限、应届生、实习经历、行业经验、项目经验。
11. professional_skills 只保留技能、工具、技术栈、测试方法、业务技术知识。
12. other_special 只用于承接前 11 个维度都不适合承接、但岗位明确提出的特殊要求。
13. other_special 仅限以下几类：证书/资质、语言门槛、出差/驻场/外派、值班/轮班/夜班/特殊班次、驾照或特殊准入要求。
14. 如果内容可以放入前 11 个维度，优先放入前 11 个维度，不要放到 other_special。
15. other_special 只保留短语，不要输出完整句子；不要把岗位职责、福利待遇、普通技能、普通经验塞进 other_special。
16. 如果岗位详情文本只有占位残片、无信息残句或几乎没有可抽取内容，例如“注：”“岗位职责：”“职位描述：”“任职要求：”这类只有标题没有正文的文本，必须直接返回 12 个维度全为 ["无明确要求"]。"""

ATTITUDE_KEYWORDS = (
    "责任心",
    "认真",
    "严谨",
    "细致",
    "细心",
    "踏实",
    "主动",
    "积极",
    "敬业",
    "执行力",
    "职业操守",
    "耐心",
    "上进心",
)
COMMUNICATION_KEYWORDS = ("沟通", "表达", "协调", "交流", "汇报", "对接")
TEAMWORK_KEYWORDS = ("团队", "协作", "合作", "配合")
STRESS_KEYWORDS = ("抗压", "承压", "适应", "出差", "加班", "吃苦", "稳定性")
LEARNING_KEYWORDS = ("学习", "钻研", "自学", "成长", "上进")
PROBLEM_SOLVING_KEYWORDS = ("分析", "解决", "排查", "定位", "判断", "处理", "优化", "改进")
DOCUMENT_KEYWORDS = ("文档", "报告", "说明书", "规范", "记录", "总结")
DUTY_PREFIXES = ("负责", "参与", "完成", "推进", "制定", "确保", "协助", "支持", "跟进")
EDUCATION_PATTERNS = (
    r"(博士(?:及以上)?学历?)",
    r"(硕士(?:及以上)?学历?)",
    r"(研究生(?:及以上)?学历?)",
    r"(本科(?:及以上)?学历?)",
    r"(统招本科(?:及以上)?学历?)",
    r"(专科(?:及以上)?学历?)",
    r"(大专(?:及以上)?学历?)",
    r"(高中(?:及以上)?学历?)",
    r"(中专(?:及以上)?学历?)",
    r"([本专硕博]+科?(?:及以上)?)",
)
BACKGROUND_PATTERNS = (
    r"([^\s，。,；;:：]{1,24}(?:相关)?专业)",
    r"([^\s，。,；;:：]{1,24}背景)",
)
EXPERIENCE_PATTERNS = (
    r"(\d+\s*[-到至~]?\s*\d*\s*年(?:以上)?[^\n，。,；;]{0,12}?经验)",
    r"(\d+\s*年以上[^\n，。,；;]{0,12}?经验)",
    r"(应届(?:毕业生)?)",
    r"(实习经验)",
    r"(项目经验)",
    r"(行业经验)",
)
OTHER_SPECIAL_KEYWORDS = (
    "证书",
    "认证",
    "资格证",
    "执业资格",
    "职称",
    "软考",
    "PMP",
    "CISP",
    "教师资格",
    "CET4",
    "CET-4",
    "CET6",
    "CET-6",
    "英语",
    "日语",
    "韩语",
    "粤语",
    "普通话",
    "口语",
    "听说读写",
    "工作语言",
    "出差",
    "驻场",
    "外派",
    "值班",
    "轮班",
    "倒班",
    "夜班",
    "班次",
    "排班",
    "7x24",
    "24/7",
    "驾照",
    "驾驶证",
    "C1",
    "C2",
)
OTHER_SPECIAL_REJECT_KEYWORDS = (
    "岗位职责",
    "工作职责",
    "负责",
    "参与",
    "完成",
    "配合",
    "福利",
    "待遇",
    "薪资",
    "补贴",
)
OTHER_SPECIAL_REJECT_PREFIXES = (
    "职位福利",
    "福利",
    "岗位职责",
    "工作职责",
    "职责",
    "负责",
)
OTHER_SPECIAL_CERTIFICATE_PATTERNS = (
    r"(PMP(?:证书)?)",
    r"(软考(?:项目管理)?)",
    r"((?:HCIA|HCIP|HCIE|CCNA|CCNP|CCIE|RHCE|OCP|CKA|ACP|CISP|RCNA|RCNP)(?:/[A-Z0-9]+)*)",
    r"([A-Za-z0-9+/.-]{2,24}(?:认证|证书))",
    r"((?:教师资格|执业资格|资格证|职称证书|相关资质证书|相关学历证书|相关证书))",
)
OTHER_SPECIAL_LANGUAGE_PATTERNS = (
    r"(英语CET[- ]?[46](?:或同等及以上水平|级以上|及以上)?)",
    r"(英语(?:口语|读写|阅读|听说读写)能力)",
    r"(英语水平较高)",
    r"(英语作为工作语言)",
    r"(工作语言主要为英语)",
    r"(日语(?:基础|口语|读写|能力|学习))",
    r"(韩语(?:技术支持|口语|读写|能力)?)",
)
OTHER_SPECIAL_TRAVEL_PATTERNS = (
    r"(长期外地驻场)",
    r"(海外常驻出差)",
    r"(国内短期出差)",
    r"(省内短期出差)",
    r"(短期省内出差)",
    r"(跨省区出差)",
    r"(疆内出差)",
    r"(长期出差)",
    r"(短期出差)",
    r"(海外出差)",
    r"(省内出差)",
    r"(经常出差)",
    r"(接受出差)",
    r"(能(?:够)?适应出差)",
    r"(驻场)",
    r"(外派)",
    r"(出差)",
)
OTHER_SPECIAL_SHIFT_PATTERNS = (
    r"(排班制)",
    r"(值班)",
    r"(轮班)",
    r"(倒班)",
    r"(夜班)",
    r"(排班)",
    r"(7x24)",
    r"(24/7)",
)
OTHER_SPECIAL_LICENSE_PATTERNS = (
    r"(C1及以上驾照)",
    r"(C1驾照)",
    r"(C1或C2驾驶证)",
    r"(C2及以上驾驶证)",
    r"(有驾驶证)",
    r"(驾照)",
    r"(驾驶证)",
)


def _split_text_parts(text: str) -> list[str]:
    return [part.strip(" \t\r\n-:：;；,.，。()（）") for part in re.split(r"[\n\r]+|[；;。]|(?<=\d)[、.．)]", text) if part.strip()]


def _dedupe_keep_order(items: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for item in items:
        text = re.sub(r"\s+", " ", item).strip()
        if not text or text in seen:
            continue
        seen.add(text)
        normalized.append(text)
    return normalized


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def _fallback_matches(text: str, patterns: tuple[str, ...]) -> list[str]:
    matches: list[str] = []
    for pattern in patterns:
        matches.extend(match.group(1).strip() for match in re.finditer(pattern, text, re.IGNORECASE))
    return _dedupe_keep_order(matches)


def _fallback_keyword_lines(text: str, keywords: tuple[str, ...]) -> list[str]:
    results: list[str] = []
    for part in _split_text_parts(text):
        if _contains_any(part, keywords):
            results.append(part)
    return _dedupe_keep_order(results)


def _extract_by_patterns(text: str, patterns: tuple[str, ...]) -> list[str]:
    matches: list[str] = []
    for pattern in patterns:
        matches.extend(match.group(1).strip() for match in re.finditer(pattern, text, re.IGNORECASE))
    return _dedupe_keep_order(matches)


def _normalize_other_special_item(item: str) -> str | None:
    text = re.sub(r"\s+", " ", item).strip(" \t\r\n;；,，。")
    if not text or text == DEFAULT_KEYWORD:
        return None
    if any(text.startswith(prefix) for prefix in OTHER_SPECIAL_REJECT_PREFIXES):
        return None
    if _contains_any(text, OTHER_SPECIAL_REJECT_KEYWORDS) and len(text) > 24:
        return None
    if len(text) > 40:
        return None
    return text


def _should_skip_other_special_source(text: str) -> bool:
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return True
    if any(normalized.startswith(prefix) for prefix in OTHER_SPECIAL_REJECT_PREFIXES):
        return True
    if "福利" in normalized or "补贴" in normalized:
        return True
    if any(keyword in normalized for keyword in ("负责", "参与", "完成", "配合")):
        return True
    return False


def _dedupe_other_special_items(items: list[str]) -> list[str]:
    normalized = _dedupe_keep_order(items)
    if any("出差" in item and item != "出差" for item in normalized):
        normalized = [item for item in normalized if item != "出差"]
    if any(("驾照" in item or "驾驶证" in item) and item not in {"驾照", "驾驶证"} for item in normalized):
        normalized = [item for item in normalized if item not in {"驾照", "驾驶证"}]
    return normalized


def _clean_other_special_items(items: list[str], source_text: str) -> list[str]:
    extracted: list[str] = []

    def collect(text: str) -> None:
        if not text:
            return
        if _should_skip_other_special_source(text):
            return
        extracted.extend(_extract_by_patterns(text, OTHER_SPECIAL_CERTIFICATE_PATTERNS))
        extracted.extend(_extract_by_patterns(text, OTHER_SPECIAL_LANGUAGE_PATTERNS))
        extracted.extend(_extract_by_patterns(text, OTHER_SPECIAL_TRAVEL_PATTERNS))
        extracted.extend(_extract_by_patterns(text, OTHER_SPECIAL_SHIFT_PATTERNS))
        extracted.extend(_extract_by_patterns(text, OTHER_SPECIAL_LICENSE_PATTERNS))

    for item in _dedupe_keep_order(items):
        collect(item)

    if not extracted:
        collect(source_text)

    normalized = [
        normalized_item
        for normalized_item in (_normalize_other_special_item(item) for item in extracted)
        if normalized_item is not None
    ]
    return _dedupe_other_special_items(normalized)


def _clean_field_items(field: str, items: list[str], source_text: str) -> list[str]:
    cleaned = _dedupe_keep_order(items)

    if field == "responsibility":
        filtered = [item for item in cleaned if _contains_any(item, ATTITUDE_KEYWORDS) and not item.startswith(DUTY_PREFIXES)]
        return filtered or _fallback_keyword_lines(source_text, ATTITUDE_KEYWORDS)
    if field == "communication":
        filtered = [item for item in cleaned if _contains_any(item, COMMUNICATION_KEYWORDS)]
        return filtered or _fallback_keyword_lines(source_text, COMMUNICATION_KEYWORDS)
    if field == "teamwork":
        filtered = [item for item in cleaned if _contains_any(item, TEAMWORK_KEYWORDS)]
        return filtered or _fallback_keyword_lines(source_text, TEAMWORK_KEYWORDS)
    if field == "stress_adaptability":
        filtered = [item for item in cleaned if _contains_any(item, STRESS_KEYWORDS)]
        return filtered or _fallback_keyword_lines(source_text, STRESS_KEYWORDS)
    if field == "learning_ability":
        filtered = [item for item in cleaned if _contains_any(item, LEARNING_KEYWORDS)]
        return filtered or _fallback_keyword_lines(source_text, LEARNING_KEYWORDS)
    if field == "problem_solving":
        filtered = [item for item in cleaned if _contains_any(item, PROBLEM_SOLVING_KEYWORDS)]
        return filtered or _fallback_keyword_lines(source_text, PROBLEM_SOLVING_KEYWORDS)
    if field == "documentation_awareness":
        filtered = [item for item in cleaned if _contains_any(item, DOCUMENT_KEYWORDS)]
        return filtered or _fallback_keyword_lines(source_text, DOCUMENT_KEYWORDS)
    if field == "education_requirement":
        filtered = [item for item in cleaned if re.search(r"学历|本科|大专|专科|硕士|博士|研究生|中专|高中", item)]
        return filtered or _fallback_matches(source_text, EDUCATION_PATTERNS)
    if field == "professional_background":
        filtered = [item for item in cleaned if re.search(r"专业|背景", item)]
        return filtered or _fallback_matches(source_text, BACKGROUND_PATTERNS)
    if field == "work_experience":
        filtered = [item for item in cleaned if re.search(r"经验|应届|实习|\d+\s*年", item)]
        return filtered or _fallback_matches(source_text, EXPERIENCE_PATTERNS)
    return cleaned


def _serialize_field_items(items: list[str]) -> str:
    normalized = _dedupe_keep_order(items)
    if not normalized:
        return DEFAULT_JSON_ARRAY
    return json.dumps(normalized, ensure_ascii=False)


@dataclass(slots=True)
class BuildStats:
    total_groups: int = 0
    processed_groups: int = 0
    success_groups: int = 0
    failed_groups: int = 0
    skipped_groups: int = 0


@dataclass(slots=True)
class JobRequirementGroup:
    industry: str
    job_title: str
    company_name: str
    detail_text: str | None


@dataclass(slots=True)
class ExtractionResult:
    group: JobRequirementGroup
    payload: dict[str, str] | None
    error: Exception | None = None
    skipped: bool = False


def default_dimension_payload() -> dict[str, str]:
    return {field: DEFAULT_JSON_ARRAY for field in DIMENSION_FIELDS}


def normalize_keywords(value: object) -> str:
    if not isinstance(value, list):
        return DEFAULT_JSON_ARRAY

    normalized: list[str] = []
    seen: set[str] = set()
    for item in value:
        text = str(item).strip() if item is not None else ""
        if not text:
            continue
        if text not in seen:
            normalized.append(text)
            seen.add(text)

    if not normalized:
        return DEFAULT_JSON_ARRAY
    return json.dumps(normalized, ensure_ascii=False)


def parse_extraction_payload(content: str) -> dict[str, str]:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        return default_dimension_payload()

    if not isinstance(payload, dict):
        return default_dimension_payload()

    normalized = default_dimension_payload()
    for field in DIMENSION_FIELDS:
        normalized[field] = normalize_keywords(payload.get(field))
    return normalized


def merge_job_details(details: list[str | None]) -> str | None:
    merged: list[str] = []
    seen: set[str] = set()

    for detail in details:
        if detail is None:
            continue
        text = detail.strip()
        if not text or text in seen:
            continue
        seen.add(text)
        merged.append(text)

    if not merged:
        return None
    return DETAIL_SEPARATOR.join(merged)


def group_job_postings(db: Session) -> list[JobRequirementGroup]:
    rows = db.scalars(
        select(JobPosting).order_by(JobPosting.industry, JobPosting.job_title, JobPosting.company_name, JobPosting.id)
    ).all()

    grouped: dict[tuple[str, str, str], list[str | None]] = {}
    for row in rows:
        key = (row.industry, row.job_title, row.company_name)
        grouped.setdefault(key, []).append(row.job_detail)

    groups: list[JobRequirementGroup] = []
    for industry, job_title, company_name in sorted(grouped):
        groups.append(
            JobRequirementGroup(
                industry=industry,
                job_title=job_title,
                company_name=company_name,
                detail_text=merge_job_details(grouped[(industry, job_title, company_name)]),
            )
        )
    return groups


def build_user_prompt(group: JobRequirementGroup) -> str:
    detail_text = group.detail_text or DEFAULT_KEYWORD
    return (
        f"行业: {group.industry}\n"
        f"职位: {group.job_title}\n"
        f"公司: {group.company_name}\n"
        "岗位详情文本如下，请抽取指定 12 个维度的关键词数组：\n"
        f"{detail_text}"
    )


async def extract_dimensions_from_prompt(
    prompt: str,
    client: OpenAICompatibleLLMClient,
    *,
    source_text: str,
) -> dict[str, str]:
    content = await client.chat_completion(
        [
            ChatMessage(role="system", content=SYSTEM_PROMPT),
            ChatMessage(role="user", content=prompt),
        ],
        temperature=0.0,
    )
    payload = parse_extraction_payload(content)
    payload["other_special"] = _serialize_field_items(
        _clean_other_special_items(
            json.loads(payload["other_special"]),
            source_text,
        )
    )
    return payload


async def extract_dimensions(detail_group: JobRequirementGroup, client: OpenAICompatibleLLMClient) -> dict[str, str]:
    if not detail_group.detail_text:
        return default_dimension_payload()

    return await extract_dimensions_from_prompt(
        build_user_prompt(detail_group),
        client,
        source_text=detail_group.detail_text,
    )


async def _extract_group(
    group: JobRequirementGroup,
    client: OpenAICompatibleLLMClient,
    semaphore: asyncio.Semaphore,
) -> ExtractionResult:
    if not group.detail_text:
        return ExtractionResult(group=group, payload=default_dimension_payload(), skipped=True)

    async with semaphore:
        try:
            payload = await extract_dimensions(group, client)
        except Exception as exc:
            return ExtractionResult(group=group, payload=None, error=exc)
    return ExtractionResult(group=group, payload=payload)


async def build_job_requirement_profiles(
    db: Session,
    client: OpenAICompatibleLLMClient,
    *,
    progress: Callable[..., None] | None = None,
    max_groups: int | None = None,
) -> BuildStats:
    groups = group_job_postings(db)
    if max_groups is not None:
        groups = groups[: max(max_groups, 0)]
    stats = BuildStats(total_groups=len(groups))

    db.execute(delete(JobRequirementProfile))
    db.flush()

    semaphore = asyncio.Semaphore(client.concurrency)
    tasks = [asyncio.create_task(_extract_group(group, client, semaphore)) for group in groups]

    for completed in asyncio.as_completed(tasks):
        result = await completed
        stats.processed_groups += 1
        if progress is not None:
            progress("processing", stats, result.group)

        if result.error is not None:
            stats.failed_groups += 1
            if progress is not None:
                progress("failed", stats, result.group, result.error)
            continue

        if result.payload is None:
            stats.failed_groups += 1
            if progress is not None:
                progress("failed", stats, result.group, RuntimeError("Missing extraction payload"))
            continue

        profile = JobRequirementProfile(
            industry=result.group.industry,
            job_title=result.group.job_title,
            canonical_job_title=result.group.job_title,
            company_name=result.group.company_name,
            **result.payload,
        )
        db.add(profile)

        stats.success_groups += 1
        if progress is not None:
            progress("succeeded", stats, result.group)

    db.commit()
    return stats
