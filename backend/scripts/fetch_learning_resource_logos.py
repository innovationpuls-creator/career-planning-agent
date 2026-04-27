from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from PIL import Image, UnidentifiedImageError

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if BACKEND_ROOT.as_posix() not in sys.path:
    sys.path.insert(0, BACKEND_ROOT.as_posix())

from app.services.learning_resource_logos import RESOURCE_LOGO_DIR  # noqa: E402


USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
MAX_BYTES = 4 * 1024 * 1024
TARGET_SIZE = 128


@dataclass(frozen=True)
class LogoTarget:
    slug: str
    title: str
    url: str
    domains: list[str]
    title_patterns: list[str] = field(default_factory=list)
    manual_urls: list[str] = field(default_factory=list)


@dataclass
class IconCandidate:
    url: str
    score: int
    source: str
    declared_size: int = 0


class IconHTMLParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__()
        self.base_url = base_url
        self.candidates: list[IconCandidate] = []
        self.manifest_urls: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): (value or "") for key, value in attrs}
        if tag.lower() == "link":
            rel = values.get("rel", "").casefold()
            href = values.get("href", "").strip()
            if not href:
                return
            href = urljoin(self.base_url, href)
            size = _parse_declared_size(values.get("sizes", ""))
            if "manifest" in rel:
                self.manifest_urls.append(href)
            if "apple-touch-icon" in rel:
                self.candidates.append(IconCandidate(href, 900 + size, "apple-touch-icon", size))
            elif "icon" in rel or "shortcut icon" in rel:
                self.candidates.append(IconCandidate(href, 650 + size, "icon", size))
        elif tag.lower() == "meta":
            prop = (values.get("property") or values.get("name") or "").casefold()
            content = values.get("content", "").strip()
            if content and prop in {"og:image", "twitter:image"}:
                self.candidates.append(
                    IconCandidate(urljoin(self.base_url, content), 240, prop, 0)
                )


TARGETS: list[LogoTarget] = [
    LogoTarget("cs50", "CS50", "https://cs50.harvard.edu/x/", ["cs50.harvard.edu"], ["cs50"]),
    LogoTarget(
        "ossu",
        "OSSU Computer Science",
        "https://github.com/ossu/computer-science",
        ["github.com"],
        ["ossu", "ossu computer science"],
    ),
    LogoTarget(
        "teach-yourself-cs",
        "Teach Yourself CS",
        "https://teachyourselfcs.com/",
        ["teachyourselfcs.com"],
        ["teach yourself cs", "teachyourselfcs"],
    ),
    LogoTarget("mit-ocw", "MIT OpenCourseWare", "https://ocw.mit.edu/", ["ocw.mit.edu"], ["mit opencourseware", "mit ocw"]),
    LogoTarget("xuetangx", "学堂在线", "https://www.xuetangx.com/", ["xuetangx.com"], ["学堂在线"]),
    LogoTarget("icourse163", "中国大学MOOC", "https://www.icourse163.org/", ["icourse163.org"], ["中国大学mooc"]),
    LogoTarget("smartedu", "国家智慧教育平台", "https://www.smartedu.cn/higherEducation", ["smartedu.cn"], ["国家智慧教育"]),
    LogoTarget("github", "GitHub", "https://github.com/", ["github.com"], ["github"]),
    LogoTarget(
        "kaggle",
        "Kaggle",
        "https://www.kaggle.com/",
        ["kaggle.com"],
        ["kaggle"],
        [
            "https://www.kaggle.com/static/images/logos/kaggle-logo-transparent-300.png",
            "https://www.kaggle.com/static/images/logos/kaggle-logo-opengraph-square.png",
        ],
    ),
    LogoTarget("frontend-mentor", "Frontend Mentor", "https://www.frontendmentor.io/", ["frontendmentor.io"], ["frontend mentor"]),
    LogoTarget("exercism", "Exercism", "https://exercism.org/", ["exercism.org"], ["exercism"]),
    LogoTarget(
        "devpost",
        "Devpost",
        "https://devpost.com/",
        ["devpost.com"],
        ["devpost"],
        ["https://icons.iconarchive.com/icons/simpleicons-team/simple/128/devpost-icon.png"],
    ),
    LogoTarget("gitee", "Gitee", "https://gitee.com/", ["gitee.com"], ["gitee"]),
    LogoTarget("coursera", "Coursera", "https://www.coursera.org/", ["coursera.org"], ["coursera"]),
    LogoTarget("edx", "edX", "https://www.edx.org/", ["edx.org"], ["edx"]),
    LogoTarget("freecodecamp", "freeCodeCamp", "https://www.freecodecamp.org/", ["freecodecamp.org"], ["freecodecamp", "free code camp"]),
    LogoTarget("mdn", "MDN Web Docs", "https://developer.mozilla.org/", ["developer.mozilla.org"], ["mdn"]),
    LogoTarget("microsoft-learn", "Microsoft Learn", "https://learn.microsoft.com/", ["learn.microsoft.com", "microsoft.com"], ["microsoft learn"]),
    LogoTarget("codecademy", "Codecademy", "https://www.codecademy.com/", ["codecademy.com"], ["codecademy"]),
    LogoTarget("leetcode", "LeetCode", "https://leetcode.cn/", ["leetcode.cn", "leetcode.com"], ["leetcode"]),
    LogoTarget("nowcoder", "Nowcoder", "https://www.nowcoder.com/", ["nowcoder.com"], ["nowcoder", "牛客"]),
    LogoTarget("hackerrank", "HackerRank", "https://www.hackerrank.com/", ["hackerrank.com"], ["hackerrank"]),
    LogoTarget("geeksforgeeks", "GeeksforGeeks", "https://www.geeksforgeeks.org/", ["geeksforgeeks.org"], ["geeksforgeeks"]),
    LogoTarget("bilibili", "Bilibili", "https://www.bilibili.com/", ["bilibili.com"], ["bilibili", "b 站"]),
    LogoTarget("zhihu", "知乎", "https://www.zhihu.com/", ["zhihu.com"], ["知乎", "zhihu"]),
    LogoTarget("juejin", "掘金", "https://juejin.cn/", ["juejin.cn"], ["掘金", "juejin"]),
    LogoTarget(
        "infoq",
        "InfoQ",
        "https://www.infoq.cn/",
        ["infoq.cn", "infoq.com"],
        ["infoq"],
        [
            "https://static001.infoq.cn/static/infoq/www/img/share-default-5tgbiuhgfefgujjhg.png",
            "https://cdn.infoq.com/statics_s1_20260421232814/apple-touch-icon.png",
        ],
    ),
    LogoTarget(
        "udemy",
        "Udemy",
        "https://www.udemy.com/",
        ["udemy.com"],
        ["udemy"],
        ["https://www.udemy.com/staticx/udemy/images/v8/favicon-32x32.png"],
    ),
    LogoTarget("linkedin-learning", "LinkedIn Learning", "https://www.linkedin.com/learning/", ["linkedin.com"], ["linkedin learning"]),
    LogoTarget("toastmasters", "Toastmasters", "https://www.toastmasters.org/", ["toastmasters.org"], ["toastmasters"]),
    LogoTarget("ted", "TED", "https://www.ted.com/", ["ted.com"], ["ted"]),
    LogoTarget("grammarly", "Grammarly", "https://www.grammarly.com/", ["grammarly.com"], ["grammarly"]),
    LogoTarget("atlassian", "Atlassian", "https://www.atlassian.com/", ["atlassian.com"], ["atlassian"]),
    LogoTarget("gitlab", "GitLab", "https://about.gitlab.com/", ["gitlab.com"], ["gitlab"]),
    LogoTarget("miro", "Miro", "https://miro.com/", ["miro.com"], ["miro"]),
    LogoTarget(
        "asana",
        "Asana",
        "https://asana.com/",
        ["asana.com"],
        ["asana"],
        [
            "https://brand.asana.biz/image/upload/f_auto:image,fl_preserve_transparency/v1696462483/asana_favicon_180x180.png",
            "https://d1gwm4cf8hecp4.cloudfront.net/images/favicons/apple-touch-icon.png",
        ],
    ),
]


def _parse_declared_size(value: str) -> int:
    sizes = [int(match) for match in re.findall(r"(\d+)x\d+", value or "")]
    return max(sizes) if sizes else 0


def _default_candidates(url: str) -> list[IconCandidate]:
    parsed = urlparse(url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    return [
        IconCandidate(urljoin(origin, "/apple-touch-icon.png"), 820, "default-apple", 180),
        IconCandidate(urljoin(origin, "/apple-touch-icon-precomposed.png"), 810, "default-apple", 180),
        IconCandidate(urljoin(origin, "/favicon-192x192.png"), 760, "default-favicon", 192),
        IconCandidate(urljoin(origin, "/favicon-96x96.png"), 720, "default-favicon", 96),
        IconCandidate(urljoin(origin, "/favicon-32x32.png"), 520, "default-favicon", 32),
        IconCandidate(urljoin(origin, "/favicon.ico"), 420, "default-favicon", 0),
    ]


def _dedupe_candidates(candidates: list[IconCandidate]) -> list[IconCandidate]:
    by_url: dict[str, IconCandidate] = {}
    for item in candidates:
        if item.url.lower().endswith(".svg"):
            continue
        previous = by_url.get(item.url)
        if previous is None or item.score > previous.score:
            by_url[item.url] = item
    return sorted(by_url.values(), key=lambda item: item.score, reverse=True)


def _manifest_candidates(client: httpx.Client, manifest_url: str) -> list[IconCandidate]:
    try:
        response = client.get(manifest_url)
        response.raise_for_status()
        payload = response.json()
    except Exception:
        return []
    icons = payload.get("icons") if isinstance(payload, dict) else []
    candidates: list[IconCandidate] = []
    for icon in icons or []:
        if not isinstance(icon, dict):
            continue
        src = str(icon.get("src") or "").strip()
        if not src:
            continue
        size = _parse_declared_size(str(icon.get("sizes") or ""))
        candidates.append(IconCandidate(urljoin(manifest_url, src), 860 + size, "manifest", size))
    return candidates


def _collect_candidates(client: httpx.Client, target: LogoTarget) -> list[IconCandidate]:
    candidates = [
        IconCandidate(url, 980 - index, "manual", 0)
        for index, url in enumerate(target.manual_urls)
    ]
    candidates.extend(_default_candidates(target.url))
    try:
        response = client.get(target.url)
        response.raise_for_status()
    except Exception:
        return _dedupe_candidates(candidates)

    parser = IconHTMLParser(str(response.url))
    parser.feed(response.text[:250_000])
    candidates.extend(parser.candidates)
    for manifest_url in parser.manifest_urls[:3]:
        candidates.extend(_manifest_candidates(client, manifest_url))
    return _dedupe_candidates(candidates)


def _download_candidate(client: httpx.Client, candidate: IconCandidate) -> bytes | None:
    try:
        response = client.get(candidate.url)
        response.raise_for_status()
    except Exception:
        return None

    content_type = response.headers.get("content-type", "").casefold()
    if "image" not in content_type and not candidate.url.lower().endswith((".ico", ".png", ".jpg", ".jpeg", ".webp")):
        return None
    content = response.content
    if not content or len(content) > MAX_BYTES:
        return None
    return content


def _convert_logo(content: bytes, output_path: Path) -> tuple[int, int] | None:
    try:
        with Image.open(BytesIO(content)) as image:
            image.seek(0)
            image = image.convert("RGBA")
            width, height = image.size
            if width < 32 or height < 32:
                return None
            canvas = Image.new("RGBA", (TARGET_SIZE, TARGET_SIZE), (255, 255, 255, 0))
            image.thumbnail((TARGET_SIZE, TARGET_SIZE), Image.Resampling.LANCZOS)
            x = (TARGET_SIZE - image.width) // 2
            y = (TARGET_SIZE - image.height) // 2
            canvas.alpha_composite(image, (x, y))
            canvas.save(output_path, "PNG", optimize=True)
            return width, height
    except (OSError, UnidentifiedImageError, EOFError):
        return None


def _fetch_target(client: httpx.Client, target: LogoTarget, *, force: bool) -> dict[str, Any]:
    output_file = f"{target.slug}.png"
    output_path = RESOURCE_LOGO_DIR / output_file
    if output_path.is_file() and not force:
        return _manifest_entry(target, output_file, status="ready", source_url="", source="cached")

    for candidate in _collect_candidates(client, target)[:16]:
        content = _download_candidate(client, candidate)
        if not content:
            continue
        size = _convert_logo(content, output_path)
        if not size:
            continue
        return _manifest_entry(
            target,
            output_file,
            status="ready",
            source_url=candidate.url,
            source=candidate.source,
            width=size[0],
            height=size[1],
        )

    return _manifest_entry(target, output_file, status="failed", source_url="", source="none")


def _manifest_entry(
    target: LogoTarget,
    file_name: str,
    *,
    status: str,
    source_url: str,
    source: str,
    width: int = 0,
    height: int = 0,
) -> dict[str, Any]:
    return {
        "slug": target.slug,
        "title": target.title,
        "domains": target.domains,
        "title_patterns": target.title_patterns or [target.title],
        "file": file_name,
        "status": status,
        "source": source,
        "source_url": source_url,
        "width": width,
        "height": height,
    }


def _load_existing_manifest(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"version": 1, "entries": []}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"version": 1, "entries": []}


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch high-quality local logos for learning resources.")
    parser.add_argument("--force", action="store_true", help="Re-download existing logo files.")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of targets for a smoke run.")
    parser.add_argument("--site", action="append", default=[], help="Fetch only matching slug/title. Repeatable.")
    args = parser.parse_args()

    RESOURCE_LOGO_DIR.mkdir(parents=True, exist_ok=True)
    manifest_path = RESOURCE_LOGO_DIR / "manifest.json"
    selected = TARGETS
    if args.site:
        needles = {item.casefold() for item in args.site}
        selected = [
            target
            for target in selected
            if target.slug.casefold() in needles or target.title.casefold() in needles
        ]
    if args.limit and args.limit > 0:
        selected = selected[: args.limit]

    manifest = _load_existing_manifest(manifest_path)
    existing = {
        str(item.get("slug")): item
        for item in manifest.get("entries", [])
        if isinstance(item, dict) and item.get("slug")
    }

    with httpx.Client(
        timeout=httpx.Timeout(10.0, connect=5.0),
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,image/*,*/*;q=0.8"},
    ) as client:
        for target in selected:
            entry = _fetch_target(client, target, force=args.force)
            existing[target.slug] = entry
            status = entry["status"]
            source = entry.get("source_url") or entry.get("source")
            print(f"{target.slug}: {status} {source}")

    ordered_slugs = [target.slug for target in TARGETS if target.slug in existing]
    extra_slugs = sorted(slug for slug in existing if slug not in ordered_slugs)
    manifest = {
        "version": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "entries": [existing[slug] for slug in [*ordered_slugs, *extra_slugs]],
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {manifest_path}")


if __name__ == "__main__":
    main()
