#!/usr/bin/env python
"""直接测试 DifyKnowsearchClient 的 streaming 实现"""
import asyncio
import sys
sys.path.insert(0, ".")

from app.services.career_development_learning_resources import DifyKnowsearchClient

async def main():
    client = DifyKnowsearchClient()
    try:
        print("调用 Dify...")
        result = await client.generate_for_module(
            canonical_job_title="前端工程师",
            topic="文档规范意识",
            user="test-user-1",
        )
        print(f"成功! message_id={result.message_id}")
        print(f"answer: {result.answer[:500]}")
    except Exception as e:
        print(f"错误: {e}")
    finally:
        await client.aclose()

asyncio.run(main())
