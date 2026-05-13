from __future__ import annotations

from typing import Any

TOOL_SCHEMA: dict[str, Any] = {
    "name": "get_job_categories",
    "description": "获取当前可查询的岗位大类列表",
    "parameters": {
        "type": "object",
        "properties": {
            "industry": {
                "type": "string",
                "description": "行业筛选，如 互联网、金融、制造业，留空返回全部",
            }
        },
        "required": [],
    },
}

ALL_CATEGORIES = [
    {"name": "软件开发", "industry": "互联网"},
    {"name": "数据分析", "industry": "互联网"},
    {"name": "产品经理", "industry": "互联网"},
    {"name": "投资分析", "industry": "金融"},
    {"name": "风险管理", "industry": "金融"},
    {"name": "生产管理", "industry": "制造业"},
]


def handle_get_job_categories(
    args: dict[str, Any],
    context: Any = None,
) -> dict[str, Any]:
    del context
    industry = args.get("industry", "")
    if industry:
        return {"categories": [c for c in ALL_CATEGORIES if c["industry"] == industry]}
    return {"categories": ALL_CATEGORIES}


def register_get_job_categories(registry: Any) -> None:
    from app.services.tool_registry import ToolRegistry

    if not isinstance(registry, ToolRegistry):
        raise TypeError("Expected a ToolRegistry instance")
    registry.register(
        name=TOOL_SCHEMA["name"],
        description=TOOL_SCHEMA["description"],
        parameters=TOOL_SCHEMA["parameters"],
        handler=handle_get_job_categories,
    )
