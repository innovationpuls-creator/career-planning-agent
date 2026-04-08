import asyncio
import json

from app.services.career_transfer_profiles import build_career_title_alias_mapping


class FakeAliasLLMClient:
    def __init__(self, *, concurrency: int = 3) -> None:
        self.concurrency = concurrency
        self.batch_inputs: list[list[str]] = []
        self._active_calls = 0
        self.max_active_calls = 0

    async def chat_completion(self, messages: list[object], *, temperature: float = 0.0) -> str:
        del temperature
        prompt = messages[1].content
        titles = [line[2:] for line in prompt.splitlines() if line.startswith("- ")]
        self.batch_inputs.append(titles)
        self._active_calls += 1
        self.max_active_calls = max(self.max_active_calls, self._active_calls)
        await asyncio.sleep(0.01)
        self._active_calls -= 1
        return json.dumps(
            [
                {
                    "raw_job_title": title,
                    "canonical_job_title": f"{title}-canonical",
                }
                for title in titles
            ],
            ensure_ascii=False,
        )


def test_build_career_title_alias_mapping_batches_titles_and_limits_concurrency():
    client = FakeAliasLLMClient(concurrency=4)

    mapping = asyncio.run(
        build_career_title_alias_mapping(
            [
                "backend engineer",
                "frontend engineer",
                "qa engineer",
                "data analyst",
                "product manager",
            ],
            client,
            batch_size=2,
            concurrency=2,
        )
    )

    assert client.batch_inputs == [
        ["backend engineer", "frontend engineer"],
        ["qa engineer", "data analyst"],
        ["product manager"],
    ]
    assert client.max_active_calls <= 2
    assert mapping == {
        "backend engineer": "backend engineer-canonical",
        "frontend engineer": "frontend engineer-canonical",
        "qa engineer": "qa engineer-canonical",
        "data analyst": "data analyst-canonical",
        "product manager": "product manager-canonical",
    }
