from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image, ImageDraw, ImageFont

from app.core.config import DATA_DIR
from app.schemas.career_development_report import (
    GrowthPlanLearningModule,
    GrowthPlanLearningResourceItem,
    GrowthPlanPhase,
)


STATIC_ROOT = DATA_DIR / "static"
RESOURCE_LOGO_DIR = STATIC_ROOT / "resource-logos"
RESOURCE_LOGO_STATIC_PREFIX = "/static/resource-logos"
MANIFEST_FILE = RESOURCE_LOGO_DIR / "manifest.json"


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip()).casefold()


def _slugify(value: str, *, fallback: str = "resource") -> str:
    normalized = _normalize_text(value)
    slug = re.sub(r"[^a-z0-9\u4e00-\u9fa5]+", "-", normalized).strip("-")
    return slug or fallback


def _hostname(url: str) -> str:
    parsed = urlparse(url if "://" in url else f"https://{url}")
    host = (parsed.hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def _domain_matches(host: str, domains: list[str]) -> bool:
    if not host:
        return False
    for domain in domains:
        normalized = _hostname(domain)
        if host == normalized or host.endswith(f".{normalized}"):
            return True
    return False


@dataclass(frozen=True)
class ResourceLogoEntry:
    slug: str
    title: str
    domains: list[str]
    title_patterns: list[str]
    file: str
    status: str = "ready"


class LearningResourceLogoResolver:
    def __init__(
        self,
        *,
        static_root: Path = STATIC_ROOT,
        static_prefix: str = "/static",
        manifest_path: Path | None = None,
    ) -> None:
        self.static_root = static_root
        self.logo_dir = static_root / "resource-logos"
        self.static_prefix = static_prefix.rstrip("/")
        self.manifest_path = manifest_path or self.logo_dir / "manifest.json"
        self._entries: list[ResourceLogoEntry] | None = None

    def enrich_phases(self, phases: list[GrowthPlanPhase]) -> list[GrowthPlanPhase]:
        updated = [phase.model_copy(deep=True) for phase in phases]
        for phase in updated:
            for module in phase.learning_modules:
                module.resource_recommendations = self.enrich_resources(module.resource_recommendations)
        return updated

    def enrich_module(self, module: GrowthPlanLearningModule) -> GrowthPlanLearningModule:
        updated = module.model_copy(deep=True)
        updated.resource_recommendations = self.enrich_resources(updated.resource_recommendations)
        return updated

    def enrich_resources(
        self,
        resources: list[GrowthPlanLearningResourceItem],
    ) -> list[GrowthPlanLearningResourceItem]:
        return [self.enrich_resource(resource) for resource in resources or []]

    def enrich_resource(self, resource: GrowthPlanLearningResourceItem) -> GrowthPlanLearningResourceItem:
        if resource.logo_url and resource.logo_source:
            return resource

        entry = self._match_entry(resource)
        if entry:
            return resource.model_copy(
                update={
                    "logo_url": f"{self.static_prefix}/resource-logos/{entry.file}",
                    "logo_alt": resource.logo_alt or f"{resource.title or entry.title} logo",
                    "logo_source": "local",
                }
            )

        fallback_file = self._ensure_fallback_logo(resource)
        return resource.model_copy(
            update={
                "logo_url": f"{self.static_prefix}/resource-logos/{fallback_file}",
                "logo_alt": resource.logo_alt or f"{resource.title or '学习资源'} logo",
                "logo_source": "fallback",
            }
        )

    def _load_entries(self) -> list[ResourceLogoEntry]:
        if self._entries is not None:
            return self._entries
        if not self.manifest_path.is_file():
            self._entries = []
            return self._entries

        try:
            payload = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            self._entries = []
            return self._entries

        raw_entries = payload.get("entries") if isinstance(payload, dict) else []
        entries: list[ResourceLogoEntry] = []
        for raw in raw_entries or []:
            if not isinstance(raw, dict):
                continue
            file_name = str(raw.get("file") or "").strip()
            status = str(raw.get("status") or "ready").strip()
            if not file_name or status != "ready":
                continue
            if not (self.logo_dir / file_name).is_file():
                continue
            entries.append(
                ResourceLogoEntry(
                    slug=str(raw.get("slug") or Path(file_name).stem),
                    title=str(raw.get("title") or ""),
                    domains=[str(item) for item in raw.get("domains") or [] if str(item).strip()],
                    title_patterns=[
                        str(item) for item in raw.get("title_patterns") or [] if str(item).strip()
                    ],
                    file=file_name,
                    status=status,
                )
            )
        self._entries = entries
        return entries

    def _match_entry(self, resource: GrowthPlanLearningResourceItem) -> ResourceLogoEntry | None:
        host = _hostname(resource.url)
        title = _normalize_text(resource.title)
        best_title_match: ResourceLogoEntry | None = None
        for entry in self._load_entries():
            if _domain_matches(host, entry.domains):
                return entry
            patterns = [_normalize_text(item) for item in entry.title_patterns or [entry.title]]
            if title and any(pattern and pattern in title for pattern in patterns):
                best_title_match = entry
        return best_title_match

    def _ensure_fallback_logo(self, resource: GrowthPlanLearningResourceItem) -> str:
        self.logo_dir.mkdir(parents=True, exist_ok=True)
        host = _hostname(resource.url)
        seed = resource.title or host or resource.url or "resource"
        digest = hashlib.sha1((resource.url or seed).encode("utf-8")).hexdigest()[:8]
        file_name = f"fallback-{_slugify(seed)}-{digest}.png"
        file_path = self.logo_dir / file_name
        if file_path.is_file():
            return file_name

        label = _fallback_label(seed, host=host)
        hue = int(hashlib.sha1(seed.encode("utf-8")).hexdigest()[:2], 16)
        bg = _palette_color(hue)
        image = Image.new("RGBA", (128, 128), bg)
        draw = ImageDraw.Draw(image)
        font = ImageFont.load_default(size=34)
        bbox = draw.textbbox((0, 0), label, font=font)
        x = (128 - (bbox[2] - bbox[0])) / 2
        y = (128 - (bbox[3] - bbox[1])) / 2 - 2
        draw.rounded_rectangle((0, 0, 127, 127), radius=28, outline=(255, 255, 255, 72), width=2)
        draw.text((x, y), label, fill=(255, 255, 255, 255), font=font)
        image.save(file_path, format="PNG", optimize=True)
        return file_name


def _fallback_label(seed: str, *, host: str = "") -> str:
    text = (seed or "R").strip()
    ascii_words = re.findall(r"[A-Za-z0-9]+", text)
    if not ascii_words and host:
        ascii_words = re.findall(r"[A-Za-z0-9]+", host)
    if ascii_words:
        if len(ascii_words) >= 2:
            return "".join(word[0] for word in ascii_words[:2]).upper()
        return ascii_words[0][:3].upper()
    return text[:2]


def _palette_color(seed: int) -> tuple[int, int, int, int]:
    palette = [
        (37, 99, 235, 255),
        (5, 150, 105, 255),
        (124, 58, 237, 255),
        (14, 116, 144, 255),
        (190, 24, 93, 255),
        (217, 119, 6, 255),
    ]
    return palette[seed % len(palette)]


def enrich_learning_resource_logos(phases: list[GrowthPlanPhase]) -> list[GrowthPlanPhase]:
    return LearningResourceLogoResolver().enrich_phases(phases)
