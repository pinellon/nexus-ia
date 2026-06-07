"""Import curated Nexus Sites gold batch 004 into the NexusAI raw lessons."""

from __future__ import annotations

import argparse
import ast
import json
from html.parser import HTMLParser
from pathlib import Path


BASE_DIR = Path(__file__).parent
DEFAULT_SOURCE = Path.home() / "Downloads" / "gold_batch_004_nexus_sites.jsonl"
RAW_DIR = BASE_DIR / "data" / "raw" / "user_lessons" / "premium_instruction_pairs"
OUT_JSONL = RAW_DIR / "gold_batch_004_nexus_sites.jsonl"
OUT_MD = RAW_DIR / "gold_batch_004_nexus_sites.md"


class TagCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.tags: set[str] = set()

    def handle_starttag(self, tag: str, attrs) -> None:
        self.tags.add(tag.lower())


def sanitize_response(response: str) -> str:
    return (
        response.replace("Descri\u00e7\u00e3o do neg\u00f3cio...", "Descri\u00e7\u00e3o do neg\u00f3cio")
        .replace(
            "Descri\u00c3\u00a7\u00c3\u00a3o do neg\u00c3\u00b3cio...",
            "Descri\u00c3\u00a7\u00c3\u00a3o do neg\u00c3\u00b3cio",
        )
    )


def load_pairs(path: Path) -> list[dict]:
    pairs: list[dict] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        item = json.loads(line)
        item["response"] = sanitize_response(str(item.get("response", "")))
        item.setdefault("issues", [])
        item.setdefault("source", f"gold_batch_004#line_{line_no}")
        pairs.append(item)
    return pairs


def validate_html(response: str, source: str) -> None:
    lowered = response.lower()
    if "<!doctype html" not in lowered:
        raise ValueError(f"{source}: missing doctype")
    parser = TagCollector()
    parser.feed(response)
    for tag in ("html", "head", "body"):
        if tag not in parser.tags:
            raise ValueError(f"{source}: missing <{tag}>")
    if "..." in response:
        raise ValueError(f"{source}: ellipsis placeholder found")


def validate_pair(pair: dict) -> None:
    source = str(pair.get("source", "unknown"))
    instruction = str(pair.get("instruction", "")).strip()
    response = str(pair.get("response", "")).strip()
    kind = str(pair.get("kind", "")).strip().lower()

    if len(instruction) < 12:
        raise ValueError(f"{source}: instruction too short")
    if len(response) < 80:
        raise ValueError(f"{source}: response too short")
    if pair.get("issues"):
        raise ValueError(f"{source}: pair has issues: {pair['issues']}")
    if any(marker in response.lower() for marker in ("<sample>", "</sample>", "<file ", "</file>")):
        raise ValueError(f"{source}: training marker found")

    if kind == "html":
        validate_html(response, source)
    elif kind == "python":
        ast.parse(response)
    elif kind == "text":
        if "README" not in instruction.upper() and "README" not in response.upper():
            raise ValueError(f"{source}: text pair is not README-like")
    else:
        raise ValueError(f"{source}: unsupported kind {kind}")


def validate_pairs(pairs: list[dict]) -> None:
    seen = set()
    for pair in pairs:
        key = (pair.get("instruction"), pair.get("response"))
        if key in seen:
            raise ValueError(f"duplicate pair: {pair.get('source')}")
        seen.add(key)
        validate_pair(pair)


def write_jsonl(pairs: list[dict]) -> None:
    with OUT_JSONL.open("w", encoding="utf-8") as f:
        for pair in pairs:
            f.write(json.dumps(pair, ensure_ascii=False) + "\n")


def write_markdown(pairs: list[dict]) -> None:
    lines = [
        "quality: gold",
        "",
        "# Gold Batch 004 - Nexus Sites",
        "",
        "Curated product-specific cases for Nexus Sites generation.",
        "",
    ]
    for index, pair in enumerate(pairs, start=1):
        lines.extend(
            [
                f"## Pair {index:03d} - {pair.get('source', 'unknown')}",
                "",
                "### Instruction:",
                str(pair["instruction"]).strip(),
                "",
                "### Response:",
                str(pair["response"]).strip(),
                "",
            ]
        )
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Nexus Sites gold batch 004.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    pairs = load_pairs(args.source)
    validate_pairs(pairs)
    write_jsonl(pairs)
    write_markdown(pairs)
    print(f"Imported {len(pairs)} pairs")
    print(f"JSONL: {OUT_JSONL}")
    print(f"Markdown: {OUT_MD}")


if __name__ == "__main__":
    main()
