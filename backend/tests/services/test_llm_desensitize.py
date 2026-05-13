"""Tests for LLM output desensitization."""

import time

from app.services.llm import SENSITIVE_PATTERNS, desensitize


def test_desensitize_id_card():
    """身份证号应被替换。"""
    text = "身份证 110101199001011234 在这里"
    result = desensitize(text)
    assert "110101199001011234" not in result
    assert "[身份证号已隐藏]" in result


def test_desensitize_phone():
    """手机号应被替换。"""
    text = "手机号 13812345678 联系"
    result = desensitize(text)
    assert "13812345678" not in result
    assert "[手机号已隐藏]" in result


def test_desensitize_email():
    """邮箱应被替换。"""
    text = "邮箱 test@example.com 有效"
    result = desensitize(text)
    assert "test@example.com" not in result
    assert "[邮箱已隐藏]" in result


def test_desensitize_multiple():
    """同一文本含身份证+手机+邮箱，应全部替换。"""
    text = "身份证 110101199001011234，手机 13812345678，邮箱 test@example.com"
    result = desensitize(text)
    assert "110101199001011234" not in result
    assert "13812345678" not in result
    assert "test@example.com" not in result
    assert "[身份证号已隐藏]" in result
    assert "[手机号已隐藏]" in result
    assert "[邮箱已隐藏]" in result


def test_desensitize_no_match():
    """无敏感信息文本应原样返回。"""
    text = "你好，今天天气不错。"
    result = desensitize(text)
    assert result == text


def test_desensitize_performance():
    """1000 字符文本处理应 < 1ms。"""
    text = "测试文本 " * 200  # ~1000 chars
    start = time.perf_counter()
    for _ in range(100):
        desensitize(text)
    elapsed = (time.perf_counter() - start) / 100
    assert elapsed < 0.001, f"Average desensitize time {elapsed*1000:.2f}ms exceeds 1ms"
