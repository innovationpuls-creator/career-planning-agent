from app.services.token_budget import TokenBudget, compact_context


class TestTokenBudget:
    def test_usage_ratio_below_threshold(self):
        budget = TokenBudget(total=100000, output_reserve=8000)
        budget.current_tokens = 10000
        assert budget.usage_ratio < budget.compact_threshold

    def test_usage_ratio_above_threshold(self):
        budget = TokenBudget(total=100000, output_reserve=8000)
        budget.current_tokens = 85000
        assert budget.usage_ratio > budget.compact_threshold

    def test_compact_preserves_last_n_messages(self):
        messages = [
            {"role": "user", "content": f"message {i}"} for i in range(10)
        ]
        result = compact_context(messages, keep_last=6)
        assert len(result) == 7  # 1 summary + 6 recent

    def test_compact_short_history_noop(self):
        messages = [
            {"role": "user", "content": f"message {i}"} for i in range(4)
        ]
        result = compact_context(messages, keep_last=6)
        assert len(result) == 4

    def test_recalculate_updates_token_count(self):
        budget = TokenBudget()
        messages = [
            {"role": "user", "content": "Hello world"},
        ]
        budget.recalculate(messages)
        assert budget.current_tokens > 0
