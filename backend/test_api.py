#!/usr/bin/env python
"""测试完整的 API 端点（带登录）"""
import httpx
import json
import asyncio

PAYLOAD = {
    "report": {
        "report_id": "career:frontend",
        "target_scope": "career",
        "target_title": "前端工程师",
        "canonical_job_title": "前端工程师",
        "representative_job_title": "前端开发",
        "industry": "互联网",
        "overall_match": 82,
        "strength_dimension_count": 1,
        "priority_gap_dimension_count": 2,
        "group_summaries": [],
        "comparison_dimensions": [
            {
                "key": "communication",
                "title": "沟通表达",
                "user_values": ["口头表达一般", "书面沟通尚可"],
                "market_keywords": ["沟通表达", "协作", "跨团队"],
                "market_weight": 1.0,
                "normalized_weight": 1.0,
                "market_target": 100,
                "user_readiness": 60,
                "gap": 40,
                "presence": 1,
                "richness": 1.0,
                "status_label": "待补强",
                "matched_market_keywords": [],
                "missing_market_keywords": ["沟通表达", "协作能力"],
                "coverage_score": 1.0,
                "alignment_score": 1.0
            },
            {
                "key": "teamwork",
                "title": "团队协作",
                "user_values": ["有协作经验"],
                "market_keywords": ["团队协作", "git协作", "code review"],
                "market_weight": 1.0,
                "normalized_weight": 1.0,
                "market_target": 100,
                "user_readiness": 80,
                "gap": 20,
                "presence": 1,
                "richness": 1.0,
                "status_label": "待补强",
                "matched_market_keywords": [],
                "missing_market_keywords": ["git协作", "code review"],
                "coverage_score": 1.0,
                "alignment_score": 1.0
            }
        ],
        "chart_series": [],
        "strength_dimensions": ["teamwork"],
        "priority_gap_dimensions": ["communication", "teamwork"],
        "action_advices": [],
        "evidence_cards": [],
        "narrative": {
            "overall_review": "",
            "completeness_explanation": "",
            "competitiveness_explanation": "",
            "strength_highlights": [],
            "priority_gap_highlights": []
        }
    }
}

async def main():
    async with httpx.AsyncClient(timeout=300.0) as client:
        # Step 1: Login
        print("1. 登录...")
        login_resp = await client.post(
            "http://127.0.0.1:9200/api/login/account",
            json={"username": "123", "password": "12345678"},
        )
        print(f"   登录状态: {login_resp.status_code}")
        if login_resp.status_code != 200:
            print(f"   登录失败: {login_resp.text[:200]}")
            return

        login_data = login_resp.json()
        token = login_data.get("data", {}).get("token") or login_data.get("token")
        print(f"   Token: {str(token)[:30]}...")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        }

        # Step 2: 调用蜗牛学习路径 API
        print("\n2. 调用蜗牛学习路径 API（将进行 6 次 Dify 调用）...")
        resp = await client.post(
            "http://127.0.0.1:9200/api/snail-learning-path/workspaces",
            json=PAYLOAD,
            headers=headers,
        )
        print(f"   状态: {resp.status_code}")

        if resp.status_code == 200:
            data = resp.json()
            phases = data.get("data", {}).get("phases", [])
            print(f"\n   共 {len(phases)} 个阶段：")
            total_resources = 0
            for p in phases:
                print(f"\n   阶段: {p.get('phase_key')}")
                for m in p.get("learning_modules", []):
                    status = m.get("resource_status", "unknown")
                    recs = m.get("resource_recommendations", [])
                    total_resources += len(recs)
                    print(f"     模块: {m.get('topic')}")
                    print(f"       status: {status}")
                    if status == "ready":
                        for r in recs[:2]:
                            print(f"       - {r.get('title')}: {r.get('url')[:60]}")
                    elif status == "failed":
                        print(f"       错误: {m.get('resource_error_message', '')[:100]}")
            print(f"\n   总计资源: {total_resources}")
        else:
            print(f"   错误响应: {resp.text[:500]}")

asyncio.run(main())
