from __future__ import annotations

import json

from PIL import Image

from app.schemas.career_development_report import GrowthPlanLearningResourceItem
from app.services.learning_resource_logos import LearningResourceLogoResolver


def test_logo_resolver_matches_manifest_domain(tmp_path):
    logo_dir = tmp_path / "resource-logos"
    logo_dir.mkdir(parents=True)
    Image.new("RGBA", (128, 128), (12, 34, 56, 255)).save(logo_dir / "cs50.png")
    (logo_dir / "manifest.json").write_text(
        json.dumps(
            {
                "entries": [
                    {
                        "slug": "cs50",
                        "title": "CS50",
                        "domains": ["cs50.harvard.edu"],
                        "title_patterns": ["cs50"],
                        "file": "cs50.png",
                        "status": "ready",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    resolver = LearningResourceLogoResolver(static_root=tmp_path)

    enriched = resolver.enrich_resource(
        GrowthPlanLearningResourceItem(
            title="CS50",
            url="https://cs50.harvard.edu/x/",
            reason="补计算机基础",
        )
    )

    assert enriched.logo_source == "local"
    assert enriched.logo_url == "/static/resource-logos/cs50.png"
    assert enriched.logo_alt == "CS50 logo"


def test_logo_resolver_uses_fallback_when_manifest_missing(tmp_path):
    resolver = LearningResourceLogoResolver(static_root=tmp_path)

    enriched = resolver.enrich_resource(
        GrowthPlanLearningResourceItem(
            title="Unknown Learning Site",
            url="https://unknown.example/learn",
            reason="补基础",
        )
    )

    assert enriched.logo_source == "fallback"
    assert enriched.logo_url.startswith("/static/resource-logos/fallback-unknown-learning-site-")
    assert (tmp_path / enriched.logo_url.removeprefix("/static/")).is_file()


def test_logo_resolver_keeps_existing_logo(tmp_path):
    resolver = LearningResourceLogoResolver(static_root=tmp_path)
    resource = GrowthPlanLearningResourceItem(
        title="Existing",
        url="https://example.com",
        reason="已补全",
        logo_url="/static/resource-logos/existing.png",
        logo_alt="Existing logo",
        logo_source="local",
    )

    assert resolver.enrich_resource(resource) is resource
