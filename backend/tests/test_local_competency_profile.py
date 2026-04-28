"""Tests for the local competency profile extraction service."""

from __future__ import annotations

import json

import pytest

from app.services.local_competency_profile import (
    PROFILE_EXTRACTION_SYSTEM_PROMPT,
    TWELVE_DIMENSION_JSON_SCHEMA,
    IntentClassifier,
    analyze_intent,
    build_profile_extraction_messages,
    extract_profile_from_text,
    normalize_profile_from_llm,
)


class TestProfileExtractionPrompt:
    """The system prompt and schema should match the Dify YAML definitions."""

    def test_system_prompt_contains_key_rules(self):
        assert "12 个维度" in PROFILE_EXTRACTION_SYSTEM_PROMPT
        assert "other_special" in PROFILE_EXTRACTION_SYSTEM_PROMPT
        assert "标准 JSON" in PROFILE_EXTRACTION_SYSTEM_PROMPT

    def test_system_prompt_requires_array_values(self):
        assert "每个字段的值必须是数组" in PROFILE_EXTRACTION_SYSTEM_PROMPT

    def test_system_prompt_forbids_fabrication(self):
        assert "不得编造" in PROFILE_EXTRACTION_SYSTEM_PROMPT

    def test_schema_has_all_12_dimensions(self):
        props = TWELVE_DIMENSION_JSON_SCHEMA["properties"]
        expected = {
            "professional_skills", "professional_background", "education_requirement",
            "teamwork", "stress_adaptability", "communication",
            "work_experience", "documentation_awareness", "responsibility",
            "learning_ability", "problem_solving", "other_special",
        }
        assert set(props.keys()) == expected

    def test_schema_all_dimensions_required(self):
        required = set(TWELVE_DIMENSION_JSON_SCHEMA["required"])
        assert required == set(TWELVE_DIMENSION_JSON_SCHEMA["properties"].keys())

    def test_each_dimension_is_string_array(self):
        for key, prop in TWELVE_DIMENSION_JSON_SCHEMA["properties"].items():
            assert prop["type"] == "array"
            assert prop["items"]["type"] == "string"

    def test_schema_name_is_job_profile_12_dimensions(self):
        assert TWELVE_DIMENSION_JSON_SCHEMA["title"] == "JobProfile12Dimensions"


class TestBuildProfileExtractionMessages:
    def test_includes_system_prompt(self):
        messages = build_profile_extraction_messages(content="some text")
        assert messages[0].role == "system"
        assert PROFILE_EXTRACTION_SYSTEM_PROMPT in messages[0].content

    def test_includes_user_content_with_text(self):
        messages = build_profile_extraction_messages(content="Java Spring Boot 2年经验")
        user_msg = messages[-1]
        assert user_msg.role == "user"
        assert "Java Spring Boot 2年经验" in user_msg.content

    def test_includes_combined_text_when_both_provided(self):
        messages = build_profile_extraction_messages(
            content="user query", document_text="document text"
        )
        combined = messages[-1].content
        assert "document text" in combined
        assert "user query" in combined


class TestExtractProfileFromText:
    def test_parses_standard_json_response(self):
        raw = json.dumps({
            "professional_skills": ["Python", "Django"],
            "professional_background": ["计算机相关专业"],
            "education_requirement": ["本科及以上"],
            "teamwork": ["团队协作"],
            "stress_adaptability": ["抗压能力"],
            "communication": ["沟通能力"],
            "work_experience": ["2年以上"],
            "documentation_awareness": ["文档规范"],
            "responsibility": ["责任心强"],
            "learning_ability": ["学习能力强"],
            "problem_solving": ["分析解决问题"],
            "other_special": ["英语CET4"],
        }, ensure_ascii=False)
        result = extract_profile_from_text(raw)
        assert result["professional_skills"] == ["Python", "Django"]
        assert result["education_requirement"] == ["本科及以上"]

    def test_handles_markdown_code_block(self):
        raw = "```json\n{\"professional_skills\": [\"Python\"], \"professional_background\": [\"计算机\"], \"education_requirement\": [\"本科\"], \"teamwork\": [\"协作\"], \"stress_adaptability\": [\"抗压\"], \"communication\": [\"沟通\"], \"work_experience\": [\"经验\"], \"documentation_awareness\": [\"文档\"], \"responsibility\": [\"责任心\"], \"learning_ability\": [\"学习\"], \"problem_solving\": [\"分析\"], \"other_special\": [\"证书\"]}\n```"
        result = extract_profile_from_text(raw)
        assert result["professional_skills"] == ["Python"]

    def test_normalizes_incomplete_profile(self):
        raw = json.dumps({
            "professional_skills": ["Python"],
        }, ensure_ascii=False)
        result = extract_profile_from_text(raw)
        assert result["professional_skills"] == ["Python"]
        assert result["education_requirement"] == ["暂无补充信息"]

    def test_deduplicates_values(self):
        raw = json.dumps({
            "professional_skills": ["Python", "Python", "Java"],
            "professional_background": ["计算机"],
            "education_requirement": ["本科"],
            "teamwork": ["协作"],
            "stress_adaptability": ["抗压"],
            "communication": ["沟通"],
            "work_experience": ["经验"],
            "documentation_awareness": ["文档"],
            "responsibility": ["责任心"],
            "learning_ability": ["学习"],
            "problem_solving": ["分析"],
            "other_special": ["证书"],
        }, ensure_ascii=False)
        result = extract_profile_from_text(raw)
        assert result["professional_skills"] == ["Python", "Java"]

    def test_raises_on_empty_response(self):
        with pytest.raises(ValueError, match="empty"):
            extract_profile_from_text("")

    def test_raises_on_invalid_json(self):
        with pytest.raises(ValueError, match="JSON"):
            extract_profile_from_text("not json at all")


class TestNormalizeProfileFromLlm:
    def test_fills_missing_dimensions_with_default(self):
        profile = normalize_profile_from_llm({"professional_skills": ["Go"]})
        assert profile["professional_skills"] == ["Go"]
        assert profile["education_requirement"] == ["暂无补充信息"]

    def test_removes_whitespace_from_values(self):
        profile = normalize_profile_from_llm({
            "professional_skills": ["  Python  ", "  Java  "],
            "professional_background": ["计算机"],
            "education_requirement": ["本科"],
            "teamwork": ["协作"],
            "stress_adaptability": ["抗压"],
            "communication": ["沟通"],
            "work_experience": ["经验"],
            "documentation_awareness": ["文档"],
            "responsibility": ["责任心"],
            "learning_ability": ["学习"],
            "problem_solving": ["分析"],
            "other_special": ["证书"],
        })
        assert profile["professional_skills"] == ["Python", "Java"]

    def test_handles_none_values(self):
        profile = normalize_profile_from_llm({
            "professional_skills": None,
            "professional_background": ["计算机"],
            "education_requirement": ["本科"],
            "teamwork": ["协作"],
            "stress_adaptability": ["抗压"],
            "communication": ["沟通"],
            "work_experience": ["经验"],
            "documentation_awareness": ["文档"],
            "responsibility": ["责任心"],
            "learning_ability": ["学习"],
            "problem_solving": ["分析"],
            "other_special": ["证书"],
        })
        assert profile["professional_skills"] == ["暂无补充信息"]


class TestIntentClassifier:
    def test_matches_keywords_for_create(self):
        prompts = [
            "请分析这份简历",
            "帮我提取画像",
            "创建12维画像",
            "解析这份材料",
        ]
        for prompt in prompts:
            assert analyze_intent(prompt) == IntentClassifier.CREATE_PROFILE

    def test_matches_keywords_for_modify(self):
        prompts = [
            "把专业技能改成Python",
            "在经验里添加3年Java",
            "修改学历要求",
            "更新学习能力字段",
        ]
        for prompt in prompts:
            assert analyze_intent(prompt) == IntentClassifier.MODIFY_PROFILE

    def test_matches_keywords_for_qa(self):
        prompts = [
            "这个岗位适合我吗",
            "我的优势是什么",
            "有什么建议",
            "如何提升",
            "我该怎么准备面试",
        ]
        for prompt in prompts:
            assert analyze_intent(prompt) == IntentClassifier.QA

    def test_defaults_to_create_when_files_uploaded(self):
        result = analyze_intent("", has_files=True)
        assert result == IntentClassifier.CREATE_PROFILE

    def test_defaults_to_create_with_empty_prompt(self):
        result = analyze_intent("")
        assert result == IntentClassifier.CREATE_PROFILE

    def test_determine_with_llm_fallback_creates_classifier_messages(self):
        messages = IntentClassifier.build_classifier_messages("请帮我提取12维画像")
        assert len(messages) == 2
        assert messages[0].role == "system"
        assert "分类" in messages[0].content
        assert messages[1].role == "user"
        assert "12维画像" in messages[1].content
