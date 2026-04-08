from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.career_development_favorite_report import CareerDevelopmentFavoriteReport
from app.schemas.career_development_report import (
    CareerDevelopmentFavoritePayload,
    CareerDevelopmentGoalCorrelationAnalysis,
    CareerDevelopmentGoalInsightCard,
    CareerDevelopmentGoalPathStage,
    CareerDevelopmentGoalPlanResultPayload,
    CareerDevelopmentGoalStrengthDirectionItem,
    CareerDevelopmentMatchReport,
)
from app.services.llm import ChatMessage, LLMClientError, OpenAICompatibleLLMClient


class CareerDevelopmentGoalPlanningError(RuntimeError):
    pass


StageHook = Callable[[str], Awaitable[None]]


@dataclass(slots=True)
class DifyGoalPlanningResult:
    conversation_id: str | None
    message_id: str
    answer: str


@dataclass(slots=True)
class DifyGoalPlanningRuntimeConfig:
    input_variables: list[str]


@dataclass(slots=True)
class MarkdownHeading:
    line_index: int
    level: int
    title: str


@dataclass(slots=True)
class ExtractedPathStage:
    title: str
    summary: str


CORRELATION_ANALYSIS_SYSTEM_PROMPT = """
浣犳槸鑱屼笟鍙戝睍璺緞鍒嗘瀽鍔╂墜銆備綘鍙兘浣跨敤鐢ㄦ埛鎻愪緵鐨勬潗鏂欒繘琛屽垎鏋愶紝缁濆涓嶈兘琛ュ厖鏈彁渚涚殑琛屼笟浜嬪疄銆佸矖浣嶄簨瀹炴垨涓汉缁忓巻銆?浣犲繀椤诲彧杈撳嚭 JSON锛屼笉瑕佽緭鍑?Markdown锛屼笉瑕佽緭鍑鸿В閲婃€у墠缂€锛屼笉瑕佽緭鍑轰唬鐮佸潡銆?JSON 蹇呴』涓ユ牸鍖呭惈浠ヤ笅缁撴瀯锛?{
  "foundation": {"summary": "string", "highlights": ["string"]},
  "gaps": {"summary": "string", "highlights": ["string"]},
  "path_impact": {"summary": "string", "highlights": ["string"]}
}
瑕佹眰锛?1. foundation 鍙啓褰撳墠宸叉湁鍩虹锛屽繀椤诲紩鐢ㄦ湰鍦板尮閰嶆姤鍛婁腑鐨勫鍚堝害銆佷紭鍔跨淮搴︺€佸懡涓叧閿瘝鎴栬瘉鎹牱鏈€?2. gaps 鍙啓褰撳墠鍏抽敭宸窛锛屽繀椤诲紩鐢ㄦ湰鍦板尮閰嶆姤鍛婁腑鐨勫樊璺濈淮搴︺€佺己澶卞叧閿瘝鎴栦綆濂戝悎鏁版嵁銆?3. path_impact 鍙啓杩欎簺鍩虹涓庡樊璺濆鈥滆亴涓氬彂灞曡矾寰勬帹杩涒€濈殑褰卞搷锛屽繀椤诲悓鏃剁粨鍚堣秼鍔跨珷鑺傚拰璺緞绔犺妭銆?4. 涓嶅厑璁歌緭鍑鸿鍔ㄥ缓璁紝涓嶅厑璁哥紪閫犳柊鐨勮亴涓氶樁娈碉紝涓嶅厑璁镐娇鐢ㄢ€滃彲鑳解€濃€滃ぇ姒傗€濃€滄帹娴嬧€濈瓑鐚滄祴鎬ц〃杩般€?""".strip()
CORRELATION_ANALYSIS_USER_TEMPLATE = """
璇峰熀浜庝互涓嬫潗鏂欙紝杈撳嚭鈥滃叧鑱旀€у垎鏋愨€?JSON銆?
涓€銆丏ify 涓绘枃妗ｆ潗鏂?銆愮ぞ浼氶渶姹備笌琛屼笟鍙戝睍瓒嬪娍銆?{trend_section}

銆愯亴涓氬彂灞曡矾寰勩€?{path_section}

浜屻€佹湰鍦拌亴涓氭帰绱笌宀椾綅鍖归厤鎶ュ憡鏁版嵁
{report_context}

璇蜂弗鏍煎洿缁曗€滃綋鍓嶈亴涓氬彂灞曡矾寰勨€濆洖绛旓紝鍙兘浣跨敤浠ヤ笂鏉愭枡銆?""".strip()
STRENGTH_DIRECTION_SYSTEM_PROMPT = """
浣犳槸鑱屼笟璺緞鏀拺璇佹嵁鍒嗘瀽鍔╂墜銆備綘鍙兘浣跨敤鐢ㄦ埛鎻愪緵鐨勬潗鏂欒繘琛屽垎鏋愶紝缁濆涓嶈兘琛ュ厖鏈彁渚涚殑琛屼笟浜嬪疄銆佸矖浣嶄簨瀹炴垨涓汉缁忓巻銆?浣犲繀椤诲彧杈撳嚭 JSON 鏁扮粍锛屼笉瑕佽緭鍑?Markdown锛屼笉瑕佽緭鍑鸿В閲婃€у墠缂€锛屼笉瑕佽緭鍑轰唬鐮佸潡銆?鏁扮粍涓瘡涓€椤归兘蹇呴』鍖呭惈浠ヤ笅瀛楁锛?{
  "title": "string",
  "summary": "string",
  "supporting_dimensions": ["string"],
  "matched_keywords": ["string"],
  "evidence_companies": ["string"],
  "supporting_metrics": ["string"],
  "reasoning": "string"
}
瑕佹眰锛?1. 杩欎簺鍐呭鏄€滀负浠€涔堝綋鍓嶇敾鍍忚兘鏀拺鑱屼笟鍙戝睍璺緞涓殑鏌愪竴姝モ€濓紝涓嶆槸娉涙硾鑰岃皥鐨勪釜浜轰紭鐐广€?2. supporting_dimensions 蹇呴』鏉ヨ嚜鏈湴鍖归厤鎶ュ憡宸叉湁缁村害鍚嶇О銆?3. matched_keywords 蹇呴』鏉ヨ嚜鍛戒腑鍏抽敭璇嶏紝涓嶅厑璁哥紪閫犮€?4. evidence_companies 蹇呴』鏉ヨ嚜鎺ㄨ崘宀椾綅淇℃伅閲岀殑鍏徃鍚嶏紝娌℃湁灏辫繑鍥炵┖鏁扮粍銆?5. supporting_metrics 蹇呴』鍐欐竻妤氭暟鍊间緷鎹紝渚嬪濂戝悎搴︺€佸樊璺濄€佸懡涓叧閿瘝鏁伴噺銆佹牱鏈尮閰嶅害銆?6. reasoning 鍙В閲婅瘉鎹负浠€涔堟垚绔嬶紝涓嶈緭鍑鸿鍔ㄥ缓璁€?7. 鏈€澶氳繑鍥?4 鏉★紝鑷冲皯杩斿洖 2 鏉°€?""".strip()
STRENGTH_DIRECTION_USER_TEMPLATE = """
璇峰熀浜庝互涓嬫潗鏂欙紝杈撳嚭鈥滆矾寰勬敮鎾戣瘉鎹€?JSON 鏁扮粍銆?
涓€銆丏ify 涓绘枃妗ｆ潗鏂?銆愮ぞ浼氶渶姹備笌琛屼笟鍙戝睍瓒嬪娍銆?{trend_section}

銆愯亴涓氬彂灞曡矾寰勩€?{path_section}

浜屻€佹湰鍦拌亴涓氭帰绱笌宀椾綅鍖归厤鎶ュ憡鏁版嵁
{report_context}

璇峰皢杈撳嚭閲嶇偣鏀惧湪鈥滃摢浜涘凡鏈変紭鍔胯兘鏀拺褰撳墠鑱屼笟璺緞涓殑闃舵鎺ㄨ繘鈥濓紝鍙兘浣跨敤浠ヤ笂鏉愭枡銆?""".strip()
COMPREHENSIVE_REPORT_SYSTEM_PROMPT = """
浣犳槸鑱屼笟璺緞缁煎悎鎶ュ憡鍔╂墜銆備綘鍙兘浣跨敤鐢ㄦ埛鎻愪緵鐨勬潗鏂欒繘琛岀患鍚堝垎鏋愶紝缁濆涓嶈兘琛ュ厖鏈彁渚涚殑琛屼笟浜嬪疄銆佸矖浣嶄簨瀹炴垨涓汉缁忓巻銆?浣犲繀椤诲彧杈撳嚭 Markdown锛屼笉瑕佽緭鍑?JSON锛屼笉瑕佽緭鍑轰唬鐮佸潡銆?Markdown 蹇呴』涓ユ牸鍖呭惈浠ヤ笅鏍囬缁撴瀯锛?# 缁煎悎鎶ュ憡
## 褰撳墠鍙戝睍璺緞鍒ゆ柇
## 涓轰粈涔堣繖鏉¤矾寰勬垚绔?## 闇€瑕侀噸鐐瑰叧娉ㄧ殑璺緞闃诲姏
## 缁撹
瑕佹眰锛?1. 浠?Dify 鎻愪緵鐨勮秼鍔跨珷鑺傚拰鑱屼笟鍙戝睍璺緞绔犺妭涓轰富楠ㄦ灦銆?2. 灏嗏€滃叧鑱旀€у垎鏋愨€濆拰鈥滆矾寰勬敮鎾戣瘉鎹€濅綔涓轰釜鎬у寲瑙ｉ噴琛ュ厖銆?3. 缁撹蹇呴』鍥寸粫鈥滃綋鍓嶅垎鏋愮洰鏍囩殑鍙戝睍璺緞鈥濆睍寮€锛岃€屼笉鏄硾鍖栨€荤粨銆?4. 涓嶅厑璁哥紪閫犳柊鐨勮亴涓氶樁娈碉紝涓嶅厑璁歌緭鍑洪樁娈佃鍔ㄥ缓璁€?""".strip()
COMPREHENSIVE_REPORT_USER_TEMPLATE = """
璇峰熀浜庝互涓嬫潗鏂欙紝杈撳嚭鏈€缁堢患鍚堟姤鍛?Markdown銆?
銆愮ぞ浼氶渶姹備笌琛屼笟鍙戝睍瓒嬪娍銆?{trend_section}

銆愯亴涓氬彂灞曡矾寰勩€?{path_section}

銆愬叧鑱旀€у垎鏋?JSON銆?{correlation_analysis}

銆愯矾寰勬敮鎾戣瘉鎹?JSON銆?{strength_directions}

璇蜂弗鏍奸伒瀹堢粰瀹氭爣棰樼粨鏋勶紝涓嶈澧炲姞棰濆澶ф爣棰橈紝涓嶈杈撳嚭 JSON銆?""".strip()

# Re-declare prompt templates with clean UTF-8 text to avoid persisting mojibake into generated content.
CORRELATION_ANALYSIS_SYSTEM_PROMPT = """
你是一名职业目标关联性分析助手。你只能使用用户提供的材料进行分析，不能补造行业事实、岗位事实或个人经历。
请只输出 JSON，不要输出 Markdown、解释性前缀或代码块。JSON 必须严格包含以下结构：
{
  "foundation": {"summary": "string", "highlights": ["string"]},
  "gaps": {"summary": "string", "highlights": ["string"]},
  "path_impact": {"summary": "string", "highlights": ["string"]}
}
要求：
1. foundation 只写当前已具备的基础与优势，必须引用本地匹配报告中的契合度、优势维度、命中关键词或样本证据。
2. gaps 只写当前关键差距，必须引用本地匹配报告中的差距维度、缺失关键词或低契合数据。
3. path_impact 只写这些基础与差距对当前职业发展路径推进的影响，并结合趋势材料和路径材料。
4. 不允许输出行动建议，不允许编造新的职业阶段，不允许使用猜测性表述。
""".strip()
CORRELATION_ANALYSIS_USER_TEMPLATE = """
请基于以下材料，输出“关联性分析”JSON。
一、Dify 主文档材料
【社会需求与行业发展趋势】
{trend_section}

【职业发展路径】
{path_section}

二、本地职业探索与岗位匹配报告数据
{report_context}

请严格围绕“当前职业发展路径”回答，只能使用以上材料。
""".strip()
STRENGTH_DIRECTION_SYSTEM_PROMPT = """
你是一名职业路径支撑证据分析助手。你只能使用用户提供的材料进行分析，不能补造行业事实、岗位事实或个人经历。
请只输出 JSON 数组，不要输出 Markdown、解释性前缀或代码块。数组中每一项都必须包含以下字段：
{
  "title": "string",
  "summary": "string",
  "supporting_dimensions": ["string"],
  "matched_keywords": ["string"],
  "evidence_companies": ["string"],
  "supporting_metrics": ["string"],
  "reasoning": "string"
}
要求：
1. 这些内容要回答“为什么当前画像能支撑职业发展路径中的某一步”，不是泛泛而谈的个人优点。
2. supporting_dimensions 必须来自本地匹配报告已有维度名称。
3. matched_keywords 必须来自命中关键词，不允许编造。
4. evidence_companies 必须来自推荐岗位信息里的公司名，没有就返回空数组。
5. supporting_metrics 必须写清楚数值依据，例如契合度、差距、命中关键词数量、样本匹配度。
6. reasoning 只解释证据为什么成立，不输出行动建议。
7. 最多返回 4 条，至少返回 2 条。
""".strip()
STRENGTH_DIRECTION_USER_TEMPLATE = """
请基于以下材料，输出“路径支撑证据”JSON 数组。
一、Dify 主文档材料
【社会需求与行业发展趋势】
{trend_section}

【职业发展路径】
{path_section}

二、本地职业探索与岗位匹配报告数据
{report_context}

请将输出重点放在“哪些已有优势能够支撑当前职业路径中的阶段推进”，只能使用以上材料。
""".strip()
PATH_SECTION_KEYWORDS = ["职业发展路径", "职业路径", "发展路径", "路径规划"]
GENERIC_PATH_HEADING_KEYWORDS = [
    "职业发展路径",
    "职业路径",
    "发展路径",
    "路径规划",
    "典型晋升路径",
    "为什么这条路径成立",
    "为什么适合",
    "面临的挑战",
    "当前差距",
    "路径判断",
    "社会需求",
    "行业发展趋势",
    "综合报告",
    "结论",
]
PATH_ROLE_HINTS = ["工程师", "开发", "负责人", "专家", "架构师", "经理", "总监", "lead", "leader", "cto", "vp"]


def _normalize_target_value(value: str | None) -> str:
    return "".join(str(value or "").strip().lower().split())


def build_favorite_target_key(canonical_job_title: str, industry: str | None) -> str:
    return f"{_normalize_target_value(canonical_job_title)}::{_normalize_target_value(industry)}"


def serialize_report_snapshot(report: CareerDevelopmentMatchReport) -> str:
    return json.dumps(report.model_dump(mode="json"), ensure_ascii=False)


def deserialize_report_snapshot(raw: str) -> CareerDevelopmentMatchReport:
    return CareerDevelopmentMatchReport.model_validate(json.loads(raw))


def get_favorite_report_record(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
) -> CareerDevelopmentFavoriteReport | None:
    statement = select(CareerDevelopmentFavoriteReport).where(
        CareerDevelopmentFavoriteReport.id == favorite_id,
        CareerDevelopmentFavoriteReport.user_id == user_id,
    )
    return db.scalar(statement)


def list_favorite_report_records(db: Session, *, user_id: int) -> list[CareerDevelopmentFavoriteReport]:
    statement = (
        select(CareerDevelopmentFavoriteReport)
        .where(CareerDevelopmentFavoriteReport.user_id == user_id)
        .order_by(CareerDevelopmentFavoriteReport.updated_at.desc(), CareerDevelopmentFavoriteReport.id.desc())
    )
    return list(db.scalars(statement).all())


def read_favorite_report_payload(record: CareerDevelopmentFavoriteReport) -> CareerDevelopmentFavoritePayload:
    return CareerDevelopmentFavoritePayload(
        favorite_id=record.id,
        target_key=build_favorite_target_key(record.canonical_job_title, record.industry),
        source_kind=record.source_kind,
        report_id=record.report_id,
        target_scope=record.target_scope,
        target_title=record.target_title,
        canonical_job_title=record.canonical_job_title,
        representative_job_title=record.representative_job_title,
        industry=record.industry,
        overall_match=round(float(record.overall_match or 0.0), 2),
        report_snapshot=deserialize_report_snapshot(record.report_snapshot_json),
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def list_favorite_report_payloads(db: Session, *, user_id: int) -> list[CareerDevelopmentFavoritePayload]:
    return [read_favorite_report_payload(item) for item in list_favorite_report_records(db, user_id=user_id)]


def upsert_favorite_report(
    db: Session,
    *,
    user_id: int,
    source_kind: str,
    report: CareerDevelopmentMatchReport,
) -> CareerDevelopmentFavoritePayload:
    normalized_job_title = _normalize_target_value(report.canonical_job_title)
    normalized_industry = _normalize_target_value(report.industry)
    existing = db.scalar(
        select(CareerDevelopmentFavoriteReport).where(
            CareerDevelopmentFavoriteReport.user_id == user_id,
            CareerDevelopmentFavoriteReport.normalized_canonical_job_title == normalized_job_title,
            CareerDevelopmentFavoriteReport.normalized_industry == normalized_industry,
        ),
    )
    if existing is None:
        existing = CareerDevelopmentFavoriteReport(
            user_id=user_id,
            normalized_canonical_job_title=normalized_job_title,
            normalized_industry=normalized_industry,
        )

    existing.source_kind = source_kind
    existing.report_id = report.report_id
    existing.target_scope = report.target_scope
    existing.target_title = report.target_title
    existing.canonical_job_title = report.canonical_job_title
    existing.representative_job_title = report.representative_job_title
    existing.industry = report.industry
    existing.overall_match = report.overall_match
    existing.report_snapshot_json = serialize_report_snapshot(report)
    db.add(existing)
    db.commit()
    db.refresh(existing)
    return read_favorite_report_payload(existing)


def delete_favorite_report(db: Session, *, user_id: int, favorite_id: int) -> bool:
    record = get_favorite_report_record(db, user_id=user_id, favorite_id=favorite_id)
    if record is None:
        return False
    db.delete(record)
    db.commit()
    return True


class DifyCareerGoalPlanningClient:
    def __init__(self) -> None:
        api_key = settings.career_goal_dify_api_key or settings.dify_api_key
        base_url = settings.career_goal_dify_base_url or settings.dify_base_url
        timeout_seconds = float(settings.career_goal_dify_timeout_seconds or settings.dify_timeout_seconds)
        if not api_key:
            raise CareerDevelopmentGoalPlanningError("职业路径规划 Dify API key 缺失，请检查 backend/.env。")

        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(
                timeout=timeout_seconds,
                connect=min(timeout_seconds, 30.0),
                read=max(timeout_seconds, 600.0),
                write=min(timeout_seconds, 30.0),
                pool=min(timeout_seconds, 30.0),
            ),
            headers={"Authorization": f"Bearer {api_key}"},
        )
        self._runtime_config: DifyGoalPlanningRuntimeConfig | None = None

    async def aclose(self) -> None:
        await self._client.aclose()

    async def get_runtime_config(self, *, force_refresh: bool = False) -> DifyGoalPlanningRuntimeConfig:
        if self._runtime_config is not None and not force_refresh:
            return self._runtime_config

        try:
            response = await self._client.get("/parameters")
            response.raise_for_status()
            body = response.json()
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            raise CareerDevelopmentGoalPlanningError(f"加载职业路径规划 Dify 参数失败：{exc}") from exc

        input_variables: list[str] = []
        for entry in body.get("user_input_form") or []:
            if not isinstance(entry, dict) or len(entry) != 1:
                continue
            _, config = next(iter(entry.items()))
            if not isinstance(config, dict):
                continue
            variable_name = str(config.get("variable") or "").strip()
            if variable_name:
                input_variables.append(variable_name)

        self._runtime_config = DifyGoalPlanningRuntimeConfig(input_variables=list(dict.fromkeys(input_variables)))
        return self._runtime_config

    async def generate_trend_markdown(
        self,
        *,
        favorite: CareerDevelopmentFavoritePayload,
        user: str,
    ) -> DifyGoalPlanningResult:
        runtime = await self.get_runtime_config()
        payload = {
            "inputs": self._build_inputs(favorite=favorite, input_variables=runtime.input_variables),
            "user": user,
            "response_mode": "streaming",
        }
        try:
            async with self._client.stream("POST", "/workflows/run", json=payload) as response:
                if response.is_error:
                    detail = (await response.aread()).decode("utf-8", errors="ignore").strip()
                    raise CareerDevelopmentGoalPlanningError(
                        f"Dify 趋势分析失败：HTTP {response.status_code}"
                        + (f"，响应为：{detail[:500]}" if detail else ""),
                    )
                content_type = (response.headers.get("content-type") or "").lower()
                if "application/json" in content_type:
                    return self._parse_blocking_body(json.loads((await response.aread()).decode("utf-8")))
                return await self._parse_stream_body(response)
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            raise CareerDevelopmentGoalPlanningError(f"Dify 趋势分析失败：{exc}") from exc

    @staticmethod
    def _build_query(favorite: CareerDevelopmentFavoritePayload) -> str:
        report = favorite.report_snapshot
        strengths = "、".join(_pick_strength_titles(report)[:4]) or "待识别"
        gaps = "、".join(_pick_gap_titles(report)[:3]) or "待识别"
        industry_text = favorite.industry or "请从职业整体市场视角分析，不限定单一行业。"
        return (
            "请围绕以下职业目标输出一份中文 Markdown 报告，只输出 Markdown，不要输出 JSON。\n"
            f"- 目标职业：{favorite.canonical_job_title}\n"
            f"- 参考职位：{favorite.representative_job_title or favorite.target_title}\n"
            f"- 行业范围：{industry_text}\n"
            f"- 当前总体契合度：{favorite.overall_match:.2f}%\n"
            f"- 当前优势方向：{strengths}\n"
            f"- 当前优先补强方向：{gaps}\n"
            "请至少覆盖以下内容：\n"
            "## 社会需求与行业发展趋势\n"
            "- 社会需求分析\n"
            "- 行业发展趋势\n"
            "## 职业发展路径\n"
            "- 岗位成长阶段\n"
            "- 各阶段关注重点\n"
        )

    @classmethod
    def _build_inputs(
        cls,
        *,
        favorite: CareerDevelopmentFavoritePayload,
        input_variables: list[str],
    ) -> dict[str, Any]:
        report = favorite.report_snapshot
        group_summary = "；".join(
            (
                f"{item.label}契合度 {item.match_score:.2f}%"
                f"（目标要求 {item.target_requirement:.2f}%，差距 {item.gap:.2f}%）"
            )
            for item in report.group_summaries
        )
        report_summary = (
            f"目标职业：{favorite.canonical_job_title}\n"
            f"参考职位：{favorite.representative_job_title or favorite.target_title}\n"
            f"行业范围：{favorite.industry or '整体职业趋势'}\n"
            f"总体契合度：{favorite.overall_match:.2f}%\n"
            f"三大维摘要：{group_summary or '暂无三大维摘要'}\n"
            f"优势维度：{'、'.join(_pick_strength_titles(report)[:4]) or '待识别'}\n"
            f"优先补强维度：{'、'.join(_pick_gap_titles(report)[:3]) or '待识别'}"
        )
        candidate_values: dict[str, str] = {
            "career_title": favorite.canonical_job_title,
            "job_title": favorite.representative_job_title or favorite.target_title,
            "industry": favorite.industry or "整体职业趋势",
            "report_summary": report_summary,
            "query": cls._build_query(favorite),
        }
        if not input_variables:
            return candidate_values

        inputs: dict[str, str] = {}
        for variable_name in input_variables:
            normalized = re.sub(r"[\s_-]+", "", variable_name).lower()
            if any(keyword in normalized for keyword in ("career", "canonical", "鑱屼笟")):
                inputs[variable_name] = candidate_values["career_title"]
            elif any(keyword in normalized for keyword in ("job", "position", "宀椾綅", "鑱屼綅")):
                inputs[variable_name] = candidate_values["job_title"]
            elif any(keyword in normalized for keyword in ("industry", "琛屼笟")):
                inputs[variable_name] = candidate_values["industry"]
            elif any(keyword in normalized for keyword in ("summary", "report", "鎶ュ憡", "鎽樿")):
                inputs[variable_name] = candidate_values["report_summary"]
            else:
                inputs[variable_name] = candidate_values["query"]
        return inputs

    @classmethod
    def _parse_blocking_body(cls, body: dict[str, Any]) -> DifyGoalPlanningResult:
        payload = body.get("data") if isinstance(body.get("data"), dict) else body
        outputs = cls._extract_outputs(payload)
        answer = cls._extract_text_from_outputs(outputs) or str(payload.get("answer") or "").strip()
        message_id = cls._extract_run_id(payload, body)
        if not message_id:
            raise CareerDevelopmentGoalPlanningError("Dify workflow 返回中缺少任务标识。")
        if not answer:
            raise CareerDevelopmentGoalPlanningError("Dify workflow 已返回结果，但没有解析到可展示的 markdown 内容。")
        return DifyGoalPlanningResult(
            conversation_id=cls._extract_conversation_id(payload, body),
            message_id=message_id,
            answer=answer,
        )

    @classmethod
    async def _parse_stream_body(cls, response: httpx.Response) -> DifyGoalPlanningResult:
        answer_chunks: list[str] = []
        current_event: str | None = None
        conversation_id: str | None = None
        message_id = ""
        final_outputs: dict[str, Any] = {}

        async for raw_line in response.aiter_lines():
            line = raw_line.strip()
            if not line:
                continue
            if line.startswith("event:"):
                current_event = line.split(":", 1)[1].strip()
                continue
            if not line.startswith("data:"):
                continue

            payload_text = line.split(":", 1)[1].strip()
            if not payload_text or payload_text == "[DONE]":
                continue

            body = json.loads(payload_text)
            event_name = str(body.get("event") or current_event or "").strip().lower()
            if event_name == "ping":
                continue
            if event_name == "error":
                raise CareerDevelopmentGoalPlanningError(str(body.get("message") or body.get("error") or "Dify workflow 返回错误。"))



            message_id = message_id or cls._extract_run_id(body.get("data"), body) or ""
            conversation_id = conversation_id or cls._extract_conversation_id(body.get("data"), body)
            if event_name in {"message", "agent_message"}:
                fragment = body.get("answer") or body.get("text") or ""
                if isinstance(fragment, str) and fragment:
                    answer_chunks.append(fragment)
                continue
            if event_name == "text_chunk":
                fragment = body.get("text")
                if not isinstance(fragment, str):
                    data = body.get("data") if isinstance(body.get("data"), dict) else {}
                    fragment = data.get("text") or data.get("chunk") or data.get("answer") or ""
                if isinstance(fragment, str) and fragment:
                    answer_chunks.append(fragment)
                continue
            if event_name == "workflow_finished":
                final_outputs = cls._extract_outputs(body.get("data"))
                break

        answer = "".join(answer_chunks).strip() or cls._extract_text_from_outputs(final_outputs)
        if not message_id:
            raise CareerDevelopmentGoalPlanningError("Dify workflow 流式响应缺少任务标识。")
        if not answer:
            raise CareerDevelopmentGoalPlanningError("Dify workflow 已完成，但没有解析到 markdown 内容。")
        return DifyGoalPlanningResult(
            conversation_id=conversation_id,
            message_id=message_id,
            answer=answer,
        )

    @staticmethod
    def _extract_run_id(payload: Any, fallback: Any = None) -> str | None:
        candidates: list[Any] = []
        if isinstance(payload, dict):
            candidates.extend(
                [payload.get("workflow_run_id"), payload.get("task_id"), payload.get("message_id"), payload.get("id")],
            )
        if isinstance(fallback, dict):
            candidates.extend(
                [fallback.get("workflow_run_id"), fallback.get("task_id"), fallback.get("message_id"), fallback.get("id")],
            )
        for candidate in candidates:
            text = str(candidate or "").strip()
            if text:
                return text
        return None

    @staticmethod
    def _extract_conversation_id(payload: Any, fallback: Any = None) -> str | None:
        candidates: list[Any] = []
        if isinstance(payload, dict):
            candidates.append(payload.get("conversation_id"))
        if isinstance(fallback, dict):
            candidates.append(fallback.get("conversation_id"))
        for candidate in candidates:
            text = str(candidate or "").strip()
            if text:
                return text
        return None

    @staticmethod
    def _extract_outputs(payload: Any) -> dict[str, Any]:
        if not isinstance(payload, dict):
            return {}
        outputs = payload.get("outputs")
        return outputs if isinstance(outputs, dict) else {}

    @classmethod
    def _extract_text_from_outputs(cls, outputs: dict[str, Any]) -> str:
        if not outputs:
            return ""
        for key in ("markdown", "answer", "text", "result", "report", "output", "content"):
            text = cls._stringify_output_value(outputs.get(key))
            if text:
                return text
        fragments = [cls._stringify_output_value(value) for value in outputs.values()]
        return "\n\n".join(fragment for fragment in fragments if fragment)

    @classmethod
    def _stringify_output_value(cls, value: Any) -> str:
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, (int, float)):
            return str(value)
        if isinstance(value, list):
            return "\n".join(fragment for fragment in (cls._stringify_output_value(item) for item in value) if fragment)
        if isinstance(value, dict):
            for key in ("markdown", "answer", "text", "result", "content", "summary"):
                text = cls._stringify_output_value(value.get(key))
                if text:
                    return text
            return "\n".join(
                fragment for fragment in (cls._stringify_output_value(item) for item in value.values()) if fragment
            )
        return ""


def _pick_strength_titles(report: CareerDevelopmentMatchReport) -> list[str]:
    dimension_by_key = {item.key: item for item in report.comparison_dimensions}
    titles = [dimension_by_key[key].title for key in report.strength_dimensions if key in dimension_by_key]
    if titles:
        return titles[:4]
    return [item.title for item in sorted(report.comparison_dimensions, key=lambda row: -row.user_readiness)[:4]]


def _pick_gap_titles(report: CareerDevelopmentMatchReport) -> list[str]:
    dimension_by_key = {item.key: item for item in report.comparison_dimensions}
    titles = [dimension_by_key[key].title for key in report.priority_gap_dimensions if key in dimension_by_key]
    if titles:
        return titles[:4]
    return [item.title for item in sorted(report.comparison_dimensions, key=lambda row: -row.gap)[:4]]


def _clean_markdown_title(title: str) -> str:
    text = re.sub(r"^#+\s*", "", title).strip()
    text = re.sub(r"^\d+(?:\.\d+)*(?:[.)、])?\s*", "", text)
    return text.strip()


def _normalize_markdown_title(title: str) -> str:
    return re.sub(r"\s+", "", _clean_markdown_title(title)).lower()


def _parse_markdown_headings(markdown: str) -> list[MarkdownHeading]:
    headings: list[MarkdownHeading] = []
    lines = markdown.splitlines()
    for index, raw_line in enumerate(lines):
        line = raw_line.strip()
        if not line:
            continue
        hash_match = re.match(r"^(#{1,6})\s+(.+)$", line)
        if hash_match:
            headings.append(
                MarkdownHeading(
                    line_index=index,
                    level=len(hash_match.group(1)),
                    title=_clean_markdown_title(hash_match.group(2)),
                ),
            )
            continue
        number_match = re.match(r"^(\d+(?:\.\d+)*)(?:[.)、])\s+(.+)$", line)
        if number_match and len(number_match.group(2).strip()) <= 80:
            headings.append(
                MarkdownHeading(
                    line_index=index,
                    level=min(number_match.group(1).count(".") + 2, 6),
                    title=_clean_markdown_title(number_match.group(2)),
                ),
            )
    return headings


def _extract_section_markdown(markdown: str, keywords: list[str]) -> str:
    lines = markdown.splitlines()
    headings = _parse_markdown_headings(markdown)
    matched_sections: list[str] = []
    normalized_keywords = [_normalize_markdown_title(keyword) for keyword in keywords]
    for index, heading in enumerate(headings):
        normalized_title = _normalize_markdown_title(heading.title)
        if not any(keyword in normalized_title for keyword in normalized_keywords):
            continue
        end_line = len(lines)
        for next_heading in headings[index + 1 :]:
            if next_heading.level <= heading.level:
                end_line = next_heading.line_index
                break
        section_text = "\n".join(lines[heading.line_index:end_line]).strip()
        if section_text:
            matched_sections.append(section_text)
    return "\n\n".join(dict.fromkeys(matched_sections)).strip()


def _build_report_context(favorite: CareerDevelopmentFavoritePayload) -> dict[str, Any]:
    report = favorite.report_snapshot
    return {
        "target": {
            "target_title": favorite.target_title,
            "canonical_job_title": favorite.canonical_job_title,
            "representative_job_title": favorite.representative_job_title,
            "industry": favorite.industry,
            "overall_match": favorite.overall_match,
            "source_kind": favorite.source_kind,
        },
        "group_summaries": [
            {
                "label": item.label,
                "match_score": item.match_score,
                "target_requirement": item.target_requirement,
                "gap": item.gap,
                "status_label": item.status_label,
            }
            for item in report.group_summaries
        ],
        "comparison_dimensions": [
            {
                "title": item.title,
                "user_readiness": item.user_readiness,
                "market_target": item.market_target,
                "gap": item.gap,
                "status_label": item.status_label,
                "matched_market_keywords": item.matched_market_keywords[:8],
                "missing_market_keywords": item.missing_market_keywords[:8],
            }
            for item in report.comparison_dimensions
        ],
        "strength_dimensions": _pick_strength_titles(report),
        "priority_gap_dimensions": _pick_gap_titles(report),
        "evidence_cards": [
            {
                "career_title": item.career_title,
                "job_title": item.job_title,
                "company_name": item.company_name,
                "industry": item.industry,
                "match_score": item.match_score,
                "group_similarities": [
                    {"label": score.label, "similarity_score": score.similarity_score}
                    for score in item.group_similarities
                ],
            }
            for item in report.evidence_cards
        ],
        "narrative": report.narrative.model_dump(mode="json") if report.narrative else {},
    }


def _extract_json_payload(text: str) -> dict[str, Any] | list[Any]:
    raw = text.strip()
    candidates = [raw]
    if "```" in raw:
        for segment in raw.split("```"):
            cleaned = segment.strip()
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            if cleaned:
                candidates.append(cleaned)

    object_start = raw.find("{")
    object_end = raw.rfind("}")
    if object_start >= 0 and object_end > object_start:
        candidates.append(raw[object_start : object_end + 1])

    array_start = raw.find("[")
    array_end = raw.rfind("]")
    if array_start >= 0 and array_end > array_start:
        candidates.append(raw[array_start : array_end + 1])

    for candidate in candidates:
        try:
            payload = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, (dict, list)):
            return payload
    raise CareerDevelopmentGoalPlanningError("LLM 返回结果不是有效的 JSON。")


def _coerce_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        result: list[str] = []
        for item in value:
            text = str(item or "").strip()
            if text:
                result.append(text)
        return result
    text = str(value).strip()
    if not text:
        return []
    parts = [item.strip() for item in re.split(r"(?:\r?\n|[；;]+)", text) if item.strip()]
    return parts or [text]


def _normalize_insight_card_payload(payload: Any, fallback_summary: str = "") -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {"summary": fallback_summary, "highlights": []}
    return {
        "summary": str(payload.get("summary") or fallback_summary).strip(),
        "highlights": _coerce_string_list(
            payload.get("highlights") or payload.get("items") or payload.get("evidence"),
        ),
    }


def _normalize_correlation_payload(payload: dict[str, Any]) -> dict[str, Any]:
    if {"foundation", "gaps", "path_impact"} <= set(payload.keys()):
        return {
            "foundation": _normalize_insight_card_payload(payload.get("foundation")),
            "gaps": _normalize_insight_card_payload(payload.get("gaps")),
            "path_impact": _normalize_insight_card_payload(payload.get("path_impact")),
        }

    foundation_summary = str(payload.get("summary") or "").strip()
    foundation_items = _coerce_string_list(payload.get("trend_alignment")) + _coerce_string_list(
        payload.get("match_evidence"),
    )
    gap_items = _coerce_string_list(payload.get("gap_risks"))
    return {
        "foundation": {"summary": foundation_summary, "highlights": foundation_items[:4]},
        "gaps": {"summary": gap_items[0] if gap_items else "当前尚未识别到关键差距。", "highlights": gap_items[:4]},
        "path_impact": {
            "summary": foundation_summary or "当前暂无可解析的路径推进影响说明。",
            "highlights": (foundation_items[:2] + gap_items[:2])[:4],
        },
    }


def _normalize_strength_direction_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": str(payload.get("title") or "").strip(),
        "summary": str(payload.get("summary") or "").strip(),
        "supporting_dimensions": _coerce_string_list(payload.get("supporting_dimensions")),
        "matched_keywords": _coerce_string_list(payload.get("matched_keywords")),
        "evidence_companies": _coerce_string_list(payload.get("evidence_companies")),
        "supporting_metrics": _coerce_string_list(payload.get("supporting_metrics")),
        "reasoning": str(payload.get("reasoning") or "").strip(),
    }


async def _call_llm_json(
    llm_client: OpenAICompatibleLLMClient,
    *,
    system_prompt: str,
    user_prompt: str,
) -> dict[str, Any] | list[Any]:
    try:
        content = await llm_client.chat_completion(
            [
                ChatMessage(role="system", content=system_prompt),
                ChatMessage(role="user", content=user_prompt),
            ],
            temperature=0.0,
        )
    except LLMClientError as exc:
        raise CareerDevelopmentGoalPlanningError(f"LLM 分析失败：{exc}") from exc
    return _extract_json_payload(content)


async def _build_correlation_analysis(
    llm_client: OpenAICompatibleLLMClient,
    *,
    favorite: CareerDevelopmentFavoritePayload,
    trend_section_markdown: str,
    path_section_markdown: str,
) -> CareerDevelopmentGoalCorrelationAnalysis:
    path_reference_markdown = path_section_markdown or trend_section_markdown
    payload = await _call_llm_json(
        llm_client,
        system_prompt=CORRELATION_ANALYSIS_SYSTEM_PROMPT,
        user_prompt=CORRELATION_ANALYSIS_USER_TEMPLATE.format(
            trend_section=trend_section_markdown or "暂无可用趋势章节。",
            path_section=path_reference_markdown or "暂无可用职业发展路径章节。",
            report_context=json.dumps(_build_report_context(favorite), ensure_ascii=False, indent=2),
        ),
    )
    if not isinstance(payload, dict):
        raise CareerDevelopmentGoalPlanningError("LLM 返回的关联性分析不是 JSON 对象。")
    return CareerDevelopmentGoalCorrelationAnalysis.model_validate(_normalize_correlation_payload(payload))


async def _build_strength_directions(
    llm_client: OpenAICompatibleLLMClient,
    *,
    favorite: CareerDevelopmentFavoritePayload,
    trend_section_markdown: str,
    path_section_markdown: str,
) -> list[CareerDevelopmentGoalStrengthDirectionItem]:
    path_reference_markdown = path_section_markdown or trend_section_markdown
    payload = await _call_llm_json(
        llm_client,
        system_prompt=STRENGTH_DIRECTION_SYSTEM_PROMPT,
        user_prompt=STRENGTH_DIRECTION_USER_TEMPLATE.format(
            trend_section=trend_section_markdown or "暂无可用趋势章节。",
            path_section=path_reference_markdown or "暂无可用职业发展路径章节。",
            report_context=json.dumps(_build_report_context(favorite), ensure_ascii=False, indent=2),
        ),
    )
    if not isinstance(payload, list):
        raise CareerDevelopmentGoalPlanningError("LLM 返回的路径支撑证据不是 JSON 数组。")
    normalized_items: list[CareerDevelopmentGoalStrengthDirectionItem] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        normalized = CareerDevelopmentGoalStrengthDirectionItem.model_validate(
            _normalize_strength_direction_payload(item),
        )
        if normalized.title and normalized.summary:
            normalized_items.append(normalized)
    if not normalized_items:
        raise CareerDevelopmentGoalPlanningError("LLM 返回的路径支撑证据缺少有效条目。")
    return normalized_items


def _find_section_heading(markdown: str, keywords: list[str]) -> tuple[list[str], MarkdownHeading | None, list[MarkdownHeading]]:
    lines = markdown.splitlines()
    headings = _parse_markdown_headings(markdown)
    normalized_keywords = [_normalize_markdown_title(keyword) for keyword in keywords]
    matched_heading: MarkdownHeading | None = None
    for heading in headings:
        normalized_title = _normalize_markdown_title(heading.title)
        if any(keyword in normalized_title for keyword in normalized_keywords):
            matched_heading = heading
            break
    return lines, matched_heading, headings


def _normalize_sentence(text: str, max_length: int = 54) -> str:
    compact = re.sub(r"\s+", " ", text).strip("；;，,。 ")
    if len(compact) <= max_length:
        return compact
    primary = re.split(r"[；;。]", compact)[0].strip()
    if primary and len(primary) <= max_length:
        return primary
    return f"{compact[: max_length - 1].rstrip()}…"


def _is_generic_path_heading(title: str) -> bool:
    normalized = _normalize_markdown_title(title)
    return any(keyword in normalized for keyword in map(_normalize_markdown_title, GENERIC_PATH_HEADING_KEYWORDS))


def _looks_like_role_title(title: str) -> bool:
    normalized = _normalize_markdown_title(title)
    return any(hint in normalized for hint in PATH_ROLE_HINTS)


def _clean_path_segment(segment: str) -> str:
    text = _clean_markdown_title(segment)
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = text.split("（")[0].strip() if text.count("->") == 0 else text
    if any(separator in text for separator in ["：", ":"]):
        parts = re.split(r"[：:]", text)
        tail = parts[-1].strip()
        head = parts[0].strip()
        if tail and (_is_generic_path_heading(head) or not _looks_like_role_title(head)):
            text = tail
    text = re.sub(r"[；;，,。]+$", "", text).strip()
    return text


def _default_stage_summary(title: str, index: int, total: int) -> str:
    if index == 1:
        return f"原始路径章节把“{title}”识别为当前主路径的起点阶段。"
    if index == 2:
        return f"原始路径章节把“{title}”识别为当前主路径的下一阶段门槛。"
    if index == total:
        return f"原始路径章节把“{title}”识别为这条主路径的长期方向。"
    return f"原始路径章节把“{title}”识别为主路径中的中间进阶节点。"


def _extract_inline_path_stages(path_lines: list[str], fallback_title: str) -> list[ExtractedPathStage]:
    target_normalized = _normalize_markdown_title(fallback_title)
    candidates: list[list[str]] = []
    for raw_line in path_lines:
        line = raw_line.strip()
        if not line or not re.search(r"(->|→|=>|＞|➜|⟶)", line):
            continue
        parts = re.split(r"\s*(?:->|→|=>|＞|➜|⟶)\s*", line)
        cleaned = [
            _clean_path_segment(part)
            for part in parts
        ]
        cleaned = [item for item in cleaned if item and not _is_generic_path_heading(item)]
        cleaned = list(dict.fromkeys(cleaned))
        if len(cleaned) >= 2:
            candidates.append(cleaned)

    if not candidates:
        return []

    def _score(candidate: list[str]) -> tuple[int, int]:
        contains_target = any(target_normalized and target_normalized in _normalize_markdown_title(item) for item in candidate)
        role_hits = sum(1 for item in candidate if _looks_like_role_title(item))
        return (1 if contains_target else 0, len(candidate) + role_hits)

    best = max(candidates, key=_score)
    total = len(best)
    return [
        ExtractedPathStage(title=item, summary=_default_stage_summary(item, index, total))
        for index, item in enumerate(best, start=1)
    ]


def _section_lines(markdown: str, keywords: list[str]) -> list[str]:
    lines, matched_heading, headings = _find_section_heading(markdown, keywords)
    if matched_heading is None:
        return lines
    end_line = len(lines)
    for next_heading in headings:
        if next_heading.line_index <= matched_heading.line_index:
            continue
        if next_heading.level <= matched_heading.level:
            end_line = next_heading.line_index
            break
    return lines[matched_heading.line_index:end_line]


def _summarize_stage_body(lines: list[str]) -> str:
    paragraphs: list[str] = []
    bullets: list[str] = []
    for raw_line in lines:
        line = raw_line.strip()
        if not line or re.match(r"^(#{1,6}|\d+(?:\.\d+)*[.)、])\s+", line):
            continue
        if line.startswith("- ") or line.startswith("* "):
            bullets.append(_clean_markdown_title(line[2:].strip()))
            continue
        paragraphs.append(line)
    if paragraphs:
        return re.sub(r"\s+", " ", " ".join(paragraphs))[:220]
    if bullets:
        return "；".join(bullets[:3])
    return "原始路径章节未提供该阶段摘要，建议展开下方依据区查看原文。"


def _extract_stage_entries(path_section_markdown: str, fallback_title: str) -> list[ExtractedPathStage]:
    if not path_section_markdown.strip():
        return [ExtractedPathStage(title=fallback_title, summary="当前仅识别到收藏目标，原始路径章节暂未提供更多阶段。")]

    lines = _section_lines(path_section_markdown, PATH_SECTION_KEYWORDS)
    inline_stages = _extract_inline_path_stages(lines, fallback_title)
    if inline_stages:
        return inline_stages
    section_text = "\n".join(lines).strip()
    headings = _parse_markdown_headings(section_text)

    if len(headings) > 1:
        section_lines = section_text.splitlines()
        stages: list[ExtractedPathStage] = []
        root_heading = headings[0]
        child_headings = [
            item
            for item in headings[1:]
            if item.level > root_heading.level
            and not _is_generic_path_heading(item.title)
            and _looks_like_role_title(item.title)
        ]
        for index, heading in enumerate(child_headings):
            end_line = len(section_lines)
            for next_heading in child_headings[index + 1 :]:
                if next_heading.level <= heading.level:
                    end_line = next_heading.line_index
                    break
            body_lines = section_lines[heading.line_index + 1 : end_line]
            stages.append(ExtractedPathStage(title=heading.title, summary=_summarize_stage_body(body_lines)))
        if stages:
            return stages

    ordered_items: list[str] = []
    for raw_line in lines:
        line = raw_line.strip()
        number_match = re.match(r"^\d+(?:\.\d+)*(?:[.)、])\s+(.+)$", line)
        if number_match:
            ordered_items.append(_clean_markdown_title(number_match.group(1)))
    if ordered_items:
        return [
            ExtractedPathStage(
                title=item,
                summary="原始路径章节以阶段列表给出了该节点，建议结合下方依据区查看完整说明。",
            )
            for item in ordered_items
        ]

    compact_text = re.sub(r"\s+", " ", section_text)
    if "->" in compact_text or "→" in compact_text:
        raw_segments = re.split(r"\s*(?:->|→|=>|＞)\s*", compact_text)
        segments = [_clean_markdown_title(segment) for segment in raw_segments if _clean_markdown_title(segment)]
        if len(segments) >= 2:
            return [
                ExtractedPathStage(
                    title=item,
                    summary="原始路径章节以串联路径形式提到了该节点，建议结合下方依据区查看完整说明。",
                )
                for item in segments[:5]
            ]

    summary = _summarize_stage_body(lines[1:]) if len(lines) > 1 else "原始路径章节暂未提供更多阶段。"
    return [ExtractedPathStage(title=fallback_title, summary=summary)]


def _stage_label(step: int, total: int) -> str:
    if step == 1:
        return "当前阶段"
    if step == 2:
        return "下一阶段"
    if step == total:
        return "长期方向"
    return "进阶阶段"


def _build_supporting_pool(
    favorite: CareerDevelopmentFavoritePayload,
    strength_directions: list[CareerDevelopmentGoalStrengthDirectionItem],
    correlation_analysis: CareerDevelopmentGoalCorrelationAnalysis,
) -> list[str]:
    report = favorite.report_snapshot
    items: list[str] = []
    for direction in strength_directions:
        metric_text = f" · {direction.supporting_metrics[0]}" if direction.supporting_metrics else ""
        items.append(_normalize_sentence(f"{direction.title}：{direction.summary}{metric_text}", 44))
    for group in sorted(report.group_summaries, key=lambda row: (-row.match_score, row.gap))[:3]:
        items.append(f"{group.label}契合 {group.match_score:.0f}% · {group.status_label}")
    for card in report.evidence_cards[:2]:
        items.append(f"{card.job_title}@{card.company_name} · 匹配 {card.match_score:.0f}%")
    items.extend(_normalize_sentence(item, 40) for item in correlation_analysis.foundation.highlights[:2])
    return list(dict.fromkeys(item for item in items if item))


def _build_gap_pool(
    favorite: CareerDevelopmentFavoritePayload,
    correlation_analysis: CareerDevelopmentGoalCorrelationAnalysis,
) -> list[str]:
    report = favorite.report_snapshot
    items: list[str] = []
    items.extend(_normalize_sentence(item, 42) for item in correlation_analysis.gaps.highlights[:3])
    items.extend(_normalize_sentence(item, 42) for item in correlation_analysis.path_impact.highlights[:2])
    for dimension in sorted(report.comparison_dimensions, key=lambda row: -row.gap)[:3]:
        items.append(f"{dimension.title}差距 {dimension.gap:.0f}% · 当前{dimension.user_readiness:.0f}%")
    return list(dict.fromkeys(item for item in items if item))


def _rotate_pick(pool: list[str], start: int, size: int) -> list[str]:
    if not pool:
        return []
    result: list[str] = []
    for offset in range(min(size, len(pool))):
        result.append(pool[(start + offset) % len(pool)])
    return list(dict.fromkeys(result))


def _build_focus_tag_pool(favorite: CareerDevelopmentFavoritePayload) -> list[str]:
    report = favorite.report_snapshot
    tags: list[str] = []
    for group in sorted(report.group_summaries, key=lambda row: (-row.target_requirement, row.gap))[:3]:
        if group.label:
            tags.append(group.label)
    for dimension in sorted(report.comparison_dimensions, key=lambda row: (-row.market_target, row.gap))[:4]:
        if dimension.title:
            tags.append(dimension.title)
    for card in report.evidence_cards[:2]:
        if card.job_title:
            tags.append(card.job_title)
    return list(dict.fromkeys(item.strip() for item in tags if item and item.strip()))


def _build_focus_tags(
    favorite: CareerDevelopmentFavoritePayload,
    *,
    index: int,
    total: int,
    focus_tag_pool: list[str],
) -> list[str]:
    report = favorite.report_snapshot
    strength_titles = [
        dimension.title
        for dimension in sorted(report.comparison_dimensions, key=lambda row: (-row.user_readiness, row.gap))[:3]
        if dimension.title
    ]
    gap_titles = [
        dimension.title
        for dimension in sorted(report.comparison_dimensions, key=lambda row: -row.gap)[:3]
        if dimension.title
    ]

    if index == 1:
        base = strength_titles or focus_tag_pool
    elif index == 2:
        base = gap_titles + focus_tag_pool
    elif index == total:
        base = focus_tag_pool + gap_titles
    else:
        base = focus_tag_pool + strength_titles
    return list(dict.fromkeys(item for item in base if item))[:3]


def _build_readiness_label(index: int, total: int, gap_notes: list[str]) -> str:
    if index == 1:
        return "已具备基础"
    if index == 2:
        return "需补关键门槛" if gap_notes else "可开始过渡"
    if index == total:
        return "适合作为中长期方向"
    return "需逐步进阶"


def _build_path_stages(
    favorite: CareerDevelopmentFavoritePayload,
    *,
    path_section_markdown: str,
    strength_directions: list[CareerDevelopmentGoalStrengthDirectionItem],
    correlation_analysis: CareerDevelopmentGoalCorrelationAnalysis,
) -> list[CareerDevelopmentGoalPathStage]:
    extracted = _extract_stage_entries(path_section_markdown, favorite.canonical_job_title)
    support_pool = _build_supporting_pool(favorite, strength_directions, correlation_analysis)
    gap_pool = _build_gap_pool(favorite, correlation_analysis)
    focus_tag_pool = _build_focus_tag_pool(favorite)
    total = len(extracted)
    path_stages: list[CareerDevelopmentGoalPathStage] = []
    for index, item in enumerate(extracted, start=1):
        gap_notes = _rotate_pick(gap_pool, start=max(index - 1, 0), size=2)
        path_stages.append(
            CareerDevelopmentGoalPathStage(
                step=index,
                title=item.title,
                stage_label=_stage_label(index, total),
                path_summary=item.summary,
                focus_tags=_build_focus_tags(
                    favorite,
                    index=index,
                    total=total,
                    focus_tag_pool=focus_tag_pool,
                ),
                readiness_label=_build_readiness_label(index, total, gap_notes),
                supporting_evidence=_rotate_pick(support_pool, start=index - 1, size=3),
                gap_notes=gap_notes,
            )
        )
    return path_stages


def _compact_markdown(markdown: str, *, max_lines: int = 10, max_chars: int = 420) -> str:
    cleaned_lines = [line.strip() for line in markdown.splitlines() if line.strip()]
    if not cleaned_lines:
        return "暂无可用依据。"
    excerpt = "\n".join(cleaned_lines[:max_lines]).strip()
    if len(excerpt) > max_chars:
        excerpt = excerpt[: max_chars - 1].rstrip() + "…"
    return excerpt


def _format_highlights(card: CareerDevelopmentGoalInsightCard) -> str:
    highlights = [item.strip() for item in card.highlights if item and item.strip()]
    if not highlights:
        return "- 暂无补充高亮。"
    return "\n".join(f"- {item}" for item in highlights[:4])


def _format_strength_direction_items(
    strength_directions: list[CareerDevelopmentGoalStrengthDirectionItem],
) -> str:
    if not strength_directions:
        return "- 暂无额外支撑证据。"

    sections: list[str] = []
    for item in strength_directions[:3]:
        evidence_parts: list[str] = []
        if item.supporting_dimensions:
            evidence_parts.append(f"支撑维度：{'、'.join(item.supporting_dimensions[:3])}")
        if item.matched_keywords:
            evidence_parts.append(f"命中关键词：{'、'.join(item.matched_keywords[:4])}")
        if item.supporting_metrics:
            evidence_parts.append(f"关键指标：{'、'.join(item.supporting_metrics[:3])}")
        evidence_text = "；".join(evidence_parts)
        sections.append(
            "\n".join(
                [
                    f"- {item.title}：{item.summary}",
                    f"  依据：{item.reasoning}" + (f"；{evidence_text}" if evidence_text else ""),
                ]
            )
        )
    return "\n".join(sections)


def build_comprehensive_report_markdown_content(
    *,
    trend_section_markdown: str,
    path_section_markdown: str,
    correlation_analysis: CareerDevelopmentGoalCorrelationAnalysis,
    strength_directions: list[CareerDevelopmentGoalStrengthDirectionItem],
) -> str:
    path_reference_markdown = path_section_markdown or trend_section_markdown
    path_excerpt = _compact_markdown(path_reference_markdown, max_lines=8, max_chars=380)
    trend_excerpt = _compact_markdown(trend_section_markdown, max_lines=8, max_chars=380)
    foundation_summary = correlation_analysis.foundation.summary.strip() or "当前已有基础可支撑起步阶段推进。"
    gap_summary = correlation_analysis.gaps.summary.strip() or "仍需补齐关键短板，避免影响路径推进。"
    path_impact_summary = correlation_analysis.path_impact.summary.strip() or "当前基础与差距会直接影响这条路径的推进节奏。"

    conclusion_parts = [path_impact_summary]
    if correlation_analysis.foundation.highlights:
        conclusion_parts.append(f"可优先延续：{'、'.join(correlation_analysis.foundation.highlights[:2])}")
    if correlation_analysis.gaps.highlights:
        conclusion_parts.append(f"需要重点关注：{'、'.join(correlation_analysis.gaps.highlights[:2])}")

    return "\n\n".join(
        [
            "# 综合报告",
            "## 当前发展路径判断\n"
            f"{path_impact_summary}\n\n"
            "当前可参考的路径依据如下：\n"
            f"{path_excerpt}",
            "## 为什么这条路径成立\n"
            f"{foundation_summary}\n\n"
            "趋势依据摘要：\n"
            f"{trend_excerpt}\n\n"
            "已有支撑点：\n"
            f"{_format_highlights(correlation_analysis.foundation)}\n\n"
            "路径支撑证据：\n"
            f"{_format_strength_direction_items(strength_directions)}",
            "## 需要重点关注的路径阻力\n"
            f"{gap_summary}\n\n"
            "当前差距对路径推进的影响：\n"
            f"{_format_highlights(correlation_analysis.path_impact)}\n\n"
            "优先补强点：\n"
            f"{_format_highlights(correlation_analysis.gaps)}",
            "## 结论\n" + "；".join(part for part in conclusion_parts if part).strip("；"),
        ]
    ).strip()


async def _build_comprehensive_report_markdown(
    llm_client: OpenAICompatibleLLMClient,
    *,
    trend_section_markdown: str,
    path_section_markdown: str,
    correlation_analysis: CareerDevelopmentGoalCorrelationAnalysis,
    strength_directions: list[CareerDevelopmentGoalStrengthDirectionItem],
) -> str:
    del llm_client
    return build_comprehensive_report_markdown_content(
        trend_section_markdown=trend_section_markdown,
        path_section_markdown=path_section_markdown,
        correlation_analysis=correlation_analysis,
        strength_directions=strength_directions,
    )


async def _emit_stage(stage_hook: StageHook | None, stage: str) -> None:
    if stage_hook is not None:
        await stage_hook(stage)


async def build_goal_plan_result(
    db: Session,
    *,
    user_id: int,
    favorite_id: int,
    stage_hook: StageHook | None = None,
) -> tuple[CareerDevelopmentGoalPlanResultPayload, str | None]:
    favorite_record = get_favorite_report_record(db, user_id=user_id, favorite_id=favorite_id)
    if favorite_record is None:
        raise CareerDevelopmentGoalPlanningError("收藏目标不存在或无权访问。")

    favorite = read_favorite_report_payload(favorite_record)
    dify_client = DifyCareerGoalPlanningClient()
    llm_client = OpenAICompatibleLLMClient.from_settings()
    try:
        dify_result = await dify_client.generate_trend_markdown(
            favorite=favorite,
            user=f"career-goal-{user_id}-{favorite.favorite_id}",
        )
        trend_section_markdown = dify_result.answer
        path_source_markdown = (
            _extract_section_markdown(dify_result.answer, PATH_SECTION_KEYWORDS)
            or dify_result.answer
        )
        path_section_markdown = ""

        await _emit_stage(stage_hook, "dify_complete")
        await _emit_stage(stage_hook, "correlation")
        correlation_analysis = await _build_correlation_analysis(
            llm_client,
            favorite=favorite,
            trend_section_markdown=trend_section_markdown,
            path_section_markdown=path_source_markdown,
        )

        await _emit_stage(stage_hook, "strengths")
        strength_directions = await _build_strength_directions(
            llm_client,
            favorite=favorite,
            trend_section_markdown=trend_section_markdown,
            path_section_markdown=path_source_markdown,
        )

        await _emit_stage(stage_hook, "comprehensive")
        comprehensive_report_markdown = await _build_comprehensive_report_markdown(
            llm_client,
            trend_section_markdown=trend_section_markdown,
            path_section_markdown=path_source_markdown,
            correlation_analysis=correlation_analysis,
            strength_directions=strength_directions,
        )

        return (
            CareerDevelopmentGoalPlanResultPayload(
                favorite=favorite,
                trend_markdown=dify_result.answer,
                trend_section_markdown=trend_section_markdown,
                path_section_markdown=path_section_markdown,
                correlation_analysis=correlation_analysis,
                strength_directions=strength_directions,
                path_stages=_build_path_stages(
                    favorite,
                    path_section_markdown=path_source_markdown,
                    strength_directions=strength_directions,
                    correlation_analysis=correlation_analysis,
                ),
                comprehensive_report_markdown=comprehensive_report_markdown,
                path_nodes=[],
                stage_recommendations=[],
            ),
            dify_result.conversation_id,
        )
    finally:
        await dify_client.aclose()
        await llm_client.aclose()
