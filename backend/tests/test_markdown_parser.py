"""
Tests for markdown parser enhancements: inline strikethrough, links, task lists,
blockquotes, code blocks, horizontal rules, and GFM tables in DOCX/PDF export.
"""

import pytest
from app.services.career_development_plan_workspace import (
    MarkdownRun,
    MarkdownBlock,
    _parse_inline_markdown,
    _parse_markdown_blocks,
    _docx_document_xml,
    export_docx_bytes,
    export_pdf_bytes,
)


# ── Inline Parsing ──

class TestParseInlineMarkdown:
    def test_bold(self):
        runs = _parse_inline_markdown("这是 **加粗** 文本")
        assert any(r.bold and "加粗" in r.text for r in runs)

    def test_italic(self):
        runs = _parse_inline_markdown("这是 *斜体* 文本")
        assert any(r.italic and "斜体" in r.text for r in runs)

    def test_code(self):
        runs = _parse_inline_markdown("变量 `const x = 1` 示例")
        assert any(r.code and "const x = 1" in r.text for r in runs)

    def test_strikethrough(self):
        runs = _parse_inline_markdown("这是 ~~删除~~ 文本")
        assert any(getattr(r, 'strikethrough', False) and "删除" in r.text for r in runs), (
            f"Expected strikethrough run, got: {runs}"
        )

    def test_link(self):
        runs = _parse_inline_markdown("请查看 [链接](https://example.com) 详情")
        assert any(getattr(r, 'link_url', None) == 'https://example.com' for r in runs), (
            f"Expected link run, got: {runs}"
        )

    def test_mixed_bold_italic_strikethrough(self):
        runs = _parse_inline_markdown("**粗** *斜* ~~删~~")
        has_bold = any(r.bold for r in runs)
        has_italic = any(r.italic for r in runs)
        has_strike = any(getattr(r, 'strikethrough', False) for r in runs)
        assert has_bold, f"Expected bold, got: {runs}"
        assert has_italic, f"Expected italic, got: {runs}"
        assert has_strike, f"Expected strikethrough, got: {runs}"


# ── Block Parsing ──

class TestParseMarkdownBlocks:
    def test_heading_levels(self):
        md = "# 标题一\n\n## 标题二\n\n### 标题三"
        blocks = _parse_markdown_blocks(md)
        kinds = [b.kind for b in blocks]
        assert "title" in kinds
        assert "heading2" in kinds
        assert "heading3" in kinds

    def test_task_list_checked_and_unchecked(self):
        md = "- [x] 已完成\n- [ ] 待办\n- [x] 也完成"
        blocks = _parse_markdown_blocks(md)
        task_blocks = [b for b in blocks if b.kind == "task_item"]
        assert len(task_blocks) == 3, f"Expected 3 task items, got: {blocks}"
        assert task_blocks[0].checked is True
        assert task_blocks[1].checked is False
        assert task_blocks[2].checked is True

    def test_blockquote(self):
        md = "> 这是一段引用"
        blocks = _parse_markdown_blocks(md)
        assert any(b.kind == "blockquote" for b in blocks), (
            f"Expected blockquote, got: {blocks}"
        )

    def test_code_block_fenced(self):
        md = "```\nfunction hello() {\n  return 'world';\n}\n```"
        blocks = _parse_markdown_blocks(md)
        code_blocks = [b for b in blocks if b.kind == "code_block"]
        assert len(code_blocks) >= 1, f"Expected code block, got: {blocks}"
        if code_blocks:
            assert "function hello()" in code_blocks[0].runs[0].text

    def test_horizontal_rule(self):
        md = "上面内容\n\n---\n\n下面内容"
        blocks = _parse_markdown_blocks(md)
        assert any(b.kind == "horizontal_rule" for b in blocks), (
            f"Expected horizontal_rule, got: {blocks}"
        )

    def test_table_gfm(self):
        md = (
            "| 姓名 | 年龄 | 城市 |\n"
            "| --- | --- | --- |\n"
            "| 张三 | 25 | 北京 |\n"
            "| 李四 | 30 | 上海 |"
        )
        blocks = _parse_markdown_blocks(md)
        tables = [b for b in blocks if b.kind == "table"]
        assert len(tables) >= 1, f"Expected table, got: {blocks}"
        if tables:
            header = tables[0].table_header
            rows = tables[0].table_rows
            assert header == ["姓名", "年龄", "城市"], f"Header: {header}"
            assert rows[0] == ["张三", "25", "北京"], f"Row 0: {rows[0]}"
            assert rows[1] == ["李四", "30", "上海"], f"Row 1: {rows[1]}"

    def test_paragraph_preserves_regular_text(self):
        md = "这是一段普通文本。"
        blocks = _parse_markdown_blocks(md)
        assert any(b.kind == "paragraph" for b in blocks)

    def test_empty_input(self):
        blocks = _parse_markdown_blocks("")
        assert len(blocks) == 0


# ── DOCX XML Rendering ──

class TestDocxDocumentXml:
    def test_strikethrough_does_not_leak_raw_markers(self):
        xml = _docx_document_xml("这是 ~~删除~~ 文本")
        assert "~~删除~~" not in xml
        assert "删除" in xml

    def test_link_renders_as_hyperlink(self):
        xml = _docx_document_xml("查看 [链接](https://example.com)")
        assert "https://example.com" not in xml or 'hyperlink' in xml.lower()

    def test_task_list_renders_checkbox(self):
        xml = _docx_document_xml("- [x] 已完成\n- [ ] 待办")
        assert "已完成" in xml
        assert "待办" in xml
        # Checkbox should not appear as raw markdown
        assert "[x]" not in xml
        assert "[ ]" not in xml

    def test_blockquote_renders_indented(self):
        xml = _docx_document_xml("> 引用文字")
        assert "引用文字" in xml
        assert "> 引用文字" not in xml

    def test_code_block_renders_monospaced(self):
        xml = _docx_document_xml("```\ncode\n```")
        assert "code" in xml
        assert "```" not in xml

    def test_horizontal_rule_renders_separator(self):
        xml = _docx_document_xml("上面\n\n---\n\n下面")
        assert "上面" in xml
        assert "下面" in xml
        assert "---" not in xml

    def test_table_renders_as_ooxml_table(self):
        xml = _docx_document_xml(
            "| A | B |\n| --- | --- |\n| 1 | 2 |"
        )
        assert "A" in xml
        assert "1" in xml
        assert "2" in xml
        # Should use w:tbl (table) element
        assert "w:tbl" in xml or "Table" in xml


# ── End-to-end export ──

class TestExportWithRichFormats:
    def test_docx_export_with_all_formats_produces_valid_zip(self):
        """Verify that rich markdown exports to valid DOCX without errors."""
        from zipfile import ZipFile
        from io import BytesIO

        md = (
            "# 个人职业成长报告\n\n"
            "## 自我认知\n"
            "具备 **基础能力** 和 *学习意愿*，还有 ~~顾虑~~。\n\n"
            "详见 [参考链接](https://example.com)\n\n"
            "## 行动计划\n"
            "- [x] 已完成项目\n"
            "- [ ] 待办事项\n\n"
            "## 引用\n"
            "> 学而不思则罔\n\n"
            "## 代码示例\n"
            "```\nconst x = 1;\n```\n\n"
            "---\n\n"
            "## 数据表\n"
            "| 指标 | 数值 |\n"
            "| --- | --- |\n"
            "| 完成率 | 85% |\n"
            "| 覆盖率 | 90% |"
        )

        content = export_docx_bytes(md)
        assert len(content) > 1000

        with ZipFile(BytesIO(content)) as archive:
            names = archive.namelist()
            assert "word/document.xml" in names
            document_xml = archive.read("word/document.xml").decode("utf-8")

        # Verify content preservation
        assert "基础能力" in document_xml
        assert "学习意愿" in document_xml
        assert "已完成项目" in document_xml
        assert "待办事项" in document_xml
        assert "学而不思则罔" in document_xml
        assert "const x = 1" in document_xml
        assert "完成率" in document_xml
        assert "90%" in document_xml

        # Verify no raw markdown leaks
        for marker in ["**", "~~", "[x]", "[ ]", "```", "---", "[参考链接]"]:
            assert marker not in document_xml, f"Raw markdown '{marker}' leaked into DOCX"
        # Blockquote: verify content is rendered without raw "> " prefix
        assert "> 学而不思则罔" not in document_xml

    def test_pdf_export_with_rich_formats_produces_valid_pdf(self):
        """Verify that rich markdown exports to valid PDF without errors."""
        from unittest.mock import patch

        md = (
            "# 个人职业成长报告\n\n"
            "## 自我认知\n"
            "具备 **基础能力** 和 *学习意愿*。\n\n"
            "- [x] 已完成\n"
            "- [ ] 待办\n\n"
            "> 引用文字\n\n"
            "| A | B |\n"
            "| --- | --- |\n"
            "| 1 | 2 |"
        )

        with patch(
            "app.services.career_development_plan_workspace._ensure_pdf_font_registered",
            return_value="Helvetica",
        ):
            content = export_pdf_bytes(md)
        assert content.startswith(b"%PDF")
        assert len(content) > 1000
