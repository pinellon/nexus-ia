"""Build a curated fullstack/desktop corpus for NexusAI."""

import argparse
import hashlib
import json
import re
from pathlib import Path


DEFAULT_EXTENSIONS = {
    ".html",
    ".css",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".json",
    ".md",
}

EXCLUDED_DIRS = {
    ".git",
    ".github",
    ".next",
    ".nuxt",
    ".svelte-kit",
    "build",
    "coverage",
    "dist",
    "logs",
    "node_modules",
    "out",
    "target",
    "tmp",
    "vendor",
}

EXCLUDED_NAMES = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "tsconfig.tsbuildinfo",
}

QUALITY_MARKERS = (
    "aria-",
    "className",
    "const ",
    "function ",
    "interface ",
    "export ",
    "import ",
    "<section",
    "<main",
    "@media",
    "display:",
    "grid",
    "flex",
    "app.whenReady",
    "BrowserWindow",
)

SECRET_MARKERS = (
    "api_key",
    "apikey",
    "access_token",
    "auth_token",
    "client_secret",
    "private_key",
    "secret_key",
)


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()


def safe_name(value: str) -> str:
    return "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in value)


def should_skip_path(path: Path, include_tests: bool) -> bool:
    parts = {part.lower() for part in path.parts}
    if parts & EXCLUDED_DIRS:
        return True
    if path.name.lower() in EXCLUDED_NAMES:
        return True
    if not include_tests and (parts & {"test", "tests", "__tests__", "fixtures"}):
        return True
    return False


def looks_minified(text: str) -> bool:
    lines = text.splitlines()
    if not lines:
        return True
    longest = max(len(line) for line in lines)
    avg = sum(len(line) for line in lines) / len(lines)
    return longest > 600 or (len(lines) < 8 and avg > 220)


def has_secret_marker(text: str) -> bool:
    lowered = text.lower()
    return any(marker in lowered and "=" in lowered for marker in SECRET_MARKERS)


def is_quality_candidate(text: str, min_quality_markers: int) -> bool:
    lowered = text.lower()
    count = sum(1 for marker in QUALITY_MARKERS if marker.lower() in lowered)
    return count >= min_quality_markers


def read_quality_file(
    path: Path,
    *,
    min_chars: int,
    max_bytes: int,
    max_line_length: int,
    min_quality_markers: int,
) -> tuple[bool, str, str]:
    size = path.stat().st_size
    if size == 0:
        return False, "empty", ""
    if size > max_bytes:
        return False, "too_large", ""

    text = path.read_text(encoding="utf-8", errors="ignore").lstrip("\ufeff")
    if len(text.strip()) < min_chars:
        return False, "too_short", ""
    if any(len(line) > max_line_length for line in text.splitlines()):
        return False, "long_line", ""
    if looks_minified(text):
        return False, "minified", ""
    if has_secret_marker(text):
        return False, "secret_marker", ""
    if min_quality_markers and not is_quality_candidate(text, min_quality_markers):
        return False, "low_signal", ""
    if path.suffix.lower() == ".json":
        try:
            json.loads(text)
        except json.JSONDecodeError:
            return False, "invalid_json", ""
    return True, "kept", text


def copy_file(src: Path, root: Path, raw_dir: Path, namespace: str, text: str) -> Path:
    rel = src.relative_to(root)
    dest = raw_dir / "fullstack" / namespace / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(text, encoding="utf-8")
    return dest


def build_from_roots(args) -> dict:
    raw_dir = args.raw_dir.resolve()
    manifest_path = args.manifest.resolve()
    raw_dir.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    extensions = {ext if ext.startswith(".") else f".{ext}" for ext in args.extension}
    seen = set()
    stats = {"kept": 0, "skipped": 0, "chars": 0}

    with manifest_path.open("w", encoding="utf-8") as manifest:
        for root_input in args.source_root:
            root = root_input.resolve()
            if not root.exists():
                print(f"[WARN] missing source root: {root}")
                continue
            namespace = safe_name(root.name or "workspace")
            for src in sorted(root.rglob("*")):
                if not src.is_file():
                    continue
                rel = src.relative_to(root)
                if should_skip_path(rel, args.include_tests):
                    stats["skipped"] += 1
                    continue
                if src.suffix.lower() not in extensions:
                    stats["skipped"] += 1
                    continue

                ok, reason, text = read_quality_file(
                    src,
                    min_chars=args.min_chars,
                    max_bytes=args.max_bytes,
                    max_line_length=args.max_line_length,
                    min_quality_markers=args.min_quality_markers,
                )
                if not ok:
                    stats["skipped"] += 1
                    continue

                digest = content_hash(text)
                if digest in seen:
                    stats["skipped"] += 1
                    continue
                seen.add(digest)

                dest = copy_file(src, root, raw_dir, namespace, text)
                manifest.write(
                    json.dumps(
                        {
                            "source_root": str(root),
                            "source_path": str(rel).replace("\\", "/"),
                            "raw_path": str(dest),
                            "chars": len(text),
                            "sha256": digest,
                            "status": reason,
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
                stats["kept"] += 1
                stats["chars"] += len(text)

                if args.max_files and stats["kept"] >= args.max_files:
                    return stats
    return stats


def parse_args():
    base_dir = Path(__file__).parent
    repo_root = base_dir.parent
    parser = argparse.ArgumentParser(description="Build a curated fullstack/desktop corpus.")
    parser.add_argument(
        "--source_root",
        type=Path,
        action="append",
        default=None,
        help="Root to scan. Repeat to add more roots.",
    )
    parser.add_argument("--raw_dir", type=Path, default=base_dir / "data" / "raw")
    parser.add_argument("--manifest", type=Path, default=base_dir / "data" / "fullstack_manifest.jsonl")
    parser.add_argument("--extension", action="append", default=sorted(DEFAULT_EXTENSIONS))
    parser.add_argument("--include_tests", action="store_true")
    parser.add_argument("--min_chars", type=int, default=180)
    parser.add_argument("--max_bytes", type=int, default=90_000)
    parser.add_argument("--max_line_length", type=int, default=220)
    parser.add_argument("--min_quality_markers", type=int, default=1)
    parser.add_argument("--max_files", type=int, default=0)
    args = parser.parse_args()
    args.source_root = args.source_root or [
        repo_root / "public",
        repo_root / "src",
        repo_root / "electron",
    ]
    return args


def main():
    args = parse_args()
    stats = build_from_roots(args)
    print(
        "Fullstack corpus built: "
        f"{stats['kept']} files kept, {stats['skipped']} skipped, "
        f"{stats['chars']} chars, ~{stats['chars'] // 4} tokens."
    )


if __name__ == "__main__":
    main()
