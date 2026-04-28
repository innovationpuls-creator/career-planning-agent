"""Document text extraction service.

Extracts plain text from uploaded resume files (PDF, DOCX, TXT, MD, CSV, etc.)
to feed into the LLM-based competency profile extraction pipeline.
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import BinaryIO


SUPPORTED_EXTENSIONS: set[str] = {
    ".txt", ".md", ".csv",
    ".pdf",
    ".docx",
}


class DocumentParserError(RuntimeError):
    pass


class DocumentParser:
    """Static methods for extracting text from various document formats."""

    @staticmethod
    def parse_text(stream: BinaryIO) -> str:
        raw = stream.read()
        if not raw:
            raise DocumentParserError("File is empty")
        return raw.decode("utf-8-sig")

    @staticmethod
    def parse_pdf(stream: BinaryIO) -> str:
        try:
            from pypdf import PdfReader  # type: ignore[import-untyped]

            reader = PdfReader(stream)
            pages: list[str] = []
            for page in reader.pages:
                text = (page.extract_text() or "").strip()
                if text:
                    pages.append(text)
            if not pages:
                raise DocumentParserError("PDF contains no extractable text")
            return "\n".join(pages)
        except DocumentParserError:
            raise
        except Exception as exc:
            raise DocumentParserError(f"Failed to parse PDF: {exc}") from exc

    @staticmethod
    def detect_and_parse(stream: BinaryIO, extension: str) -> str:
        ext = extension.lower()
        if not ext.startswith("."):
            ext = f".{ext}"

        if ext not in SUPPORTED_EXTENSIONS:
            raise DocumentParserError(f"Unsupported file extension: {extension}")

        if ext == ".pdf":
            return DocumentParser.parse_pdf(stream)
        return DocumentParser.parse_text(stream)

    @staticmethod
    def parse_file(path: str | Path) -> str:
        path_obj = Path(path)
        if not path_obj.exists():
            raise DocumentParserError(f"File not found: {path}")
        extension = path_obj.suffix
        with path_obj.open("rb") as f:
            return DocumentParser.detect_and_parse(f, extension)

    @staticmethod
    def parse_file_from_bytes(content: bytes, file_name: str, content_type: str | None = None) -> str:
        """Parse a document from raw bytes, inferring format from file name."""
        del content_type
        ext = Path(file_name).suffix or ".txt"
        stream = io.BytesIO(content)
        return DocumentParser.detect_and_parse(stream, ext)
