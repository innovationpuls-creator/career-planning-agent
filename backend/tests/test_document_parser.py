"""Tests for the document parser service."""

import io
import tempfile
from pathlib import Path

import pytest

from app.services.document_parser import DocumentParser, DocumentParserError, SUPPORTED_EXTENSIONS


class TestSupportedExtensions:
    def test_txt_is_supported(self):
        assert ".txt" in SUPPORTED_EXTENSIONS

    def test_pdf_is_supported(self):
        assert ".pdf" in SUPPORTED_EXTENSIONS

    def test_docx_is_supported(self):
        assert ".docx" in SUPPORTED_EXTENSIONS

    def test_md_is_supported(self):
        assert ".md" in SUPPORTED_EXTENSIONS

    def test_csv_is_supported(self):
        assert ".csv" in SUPPORTED_EXTENSIONS


class TestParseText:
    def test_extracts_text_from_utf8_file(self):
        content = "姓名：张三\n技能：Python、Java\n"
        buf = io.BytesIO(content.encode("utf-8"))
        result = DocumentParser.parse_text(buf)
        assert result == "姓名：张三\n技能：Python、Java\n"

    def test_extracts_text_from_file_with_bom(self):
        content = "简历信息".encode("utf-8-sig")
        buf = io.BytesIO(content)
        result = DocumentParser.parse_text(buf)
        assert "简历信息" in result

    def test_raises_error_on_empty_file(self):
        buf = io.BytesIO(b"")
        with pytest.raises(DocumentParserError, match="empty"):
            DocumentParser.parse_text(buf)


class TestParsePdf:
    def test_extracts_text_from_simple_pdf(self):
        # Minimal valid PDF with "Hello World" text
        pdf_content = (
            b"%PDF-1.4\n"
            b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
            b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]\n"
            b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
            b"4 0 obj\n<< /Length 44 >>\nstream\n"
            b"BT /F1 12 Tf 100 700 Td (Hello World) Tj ET\n"
            b"endstream\nendobj\n"
            b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
            b"xref\n"
            b"0 6\n"
            b"0000000000 65535 f \n"
            b"0000000009 00000 n \n"
            b"0000000058 00000 n \n"
            b"0000000115 00000 n \n"
            b"0000000266 00000 n \n"
            b"0000000360 00000 n \n"
            b"trailer\n<< /Size 6 /Root 1 0 R >>\n"
            b"startxref\n443\n"
            b"%%EOF\n"
        )
        buf = io.BytesIO(pdf_content)
        result = DocumentParser.parse_pdf(buf)
        assert "Hello World" in result

    def test_raises_error_on_corrupted_pdf(self):
        buf = io.BytesIO(b"not a pdf at all")
        with pytest.raises(DocumentParserError, match="Failed to parse PDF"):
            DocumentParser.parse_pdf(buf)


class TestDetectAndParse:
    def test_parses_txt_by_extension(self):
        content = "测试简历内容"
        buf = io.BytesIO(content.encode("utf-8"))
        result = DocumentParser.detect_and_parse(buf, ".txt")
        assert "测试简历内容" in result

    def test_parses_md_by_extension(self):
        content = "# 标题\n**粗体**\n- 列表项"
        buf = io.BytesIO(content.encode("utf-8"))
        result = DocumentParser.detect_and_parse(buf, ".md")
        assert "标题" in result

    def test_raises_error_for_unsupported_extension(self):
        buf = io.BytesIO(b"some content")
        with pytest.raises(DocumentParserError, match="Unsupported file extension"):
            DocumentParser.detect_and_parse(buf, ".xyz")

    def test_handles_extension_without_dot(self):
        buf = io.BytesIO(b"content")
        result = DocumentParser.detect_and_parse(buf, "txt")
        assert result == "content"

    def test_handles_uppercase_extension(self):
        buf = io.BytesIO(b"content")
        result = DocumentParser.detect_and_parse(buf, ".TXT")
        assert result == "content"

    def test_raises_error_for_nonexistent_file_path(self):
        with pytest.raises(DocumentParserError, match="not found"):
            DocumentParser.parse_file("/nonexistent/path/file.pdf")


class TestParseFile:
    def test_parses_txt_file_from_path(self):
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False, encoding="utf-8"
        ) as f:
            f.write("文件内容测试")
            tmp_path = f.name

        try:
            result = DocumentParser.parse_file(tmp_path)
            assert "文件内容测试" in result
        finally:
            Path(tmp_path).unlink(missing_ok=True)
