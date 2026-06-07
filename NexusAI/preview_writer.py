"""Write validated HTML previews for NexusAI generated sites."""

from __future__ import annotations

import re
import time
from pathlib import Path

from validators import validate_html


BASE_DIR = Path(__file__).parent
PREVIEW_DIR = BASE_DIR / "previews"


def safe_slug(text: str, fallback: str = "site") -> str:
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", text.strip().lower()).strip("-")
    return (slug or fallback)[:48]


def write_html_preview(html: str, *, name: str = "site") -> dict:
    validation = validate_html(html)
    if not validation.valid:
        return {
            "created": False,
            "errors": validation.errors,
            "warnings": validation.warnings,
            "path": "",
        }

    folder = PREVIEW_DIR / f"{int(time.time())}_{safe_slug(name)}"
    folder.mkdir(parents=True, exist_ok=True)
    index_path = folder / "index.html"
    index_path.write_text(html, encoding="utf-8")
    return {
        "created": True,
        "errors": [],
        "warnings": validation.warnings,
        "path": str(index_path),
        "folder": str(folder),
    }
