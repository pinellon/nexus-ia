"""Build a Python-only raw corpus from small, high-quality repositories."""

import argparse
import ast
import hashlib
import json
import shutil
import subprocess
from pathlib import Path


DEFAULT_REPOS = [
    "https://github.com/pallets/flask.git",
    "https://github.com/pallets/click.git",
    "https://github.com/psf/requests.git",
    "https://github.com/pallets/werkzeug.git",
]

EXCLUDED_DIRS = {
    ".git",
    ".github",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".tox",
    ".venv",
    "__pycache__",
    "build",
    "dist",
    "docs",
    "site-packages",
}

EXCLUDED_FILE_PARTS = {
    "test",
    "tests",
    "testing",
    "benchmark",
    "benchmarks",
    "example",
    "examples",
}

SECRET_MARKERS = (
    "api_key",
    "apikey",
    "access_token",
    "auth_token",
    "client_secret",
    "private_key",
    "secret_key",
)


def repo_slug(repo_url: str) -> str:
    slug = repo_url.rstrip("/").removesuffix(".git").split("/")[-1]
    return "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in slug)


def run_git(args: list[str], cwd: Path | None = None) -> str:
    proc = subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return proc.stdout.strip()


def ensure_repo(repo_url: str, sources_dir: Path, refresh: bool) -> Path:
    target = sources_dir / repo_slug(repo_url)
    if target.exists() and refresh:
        shutil.rmtree(target)
    if not target.exists():
        run_git(["clone", "--depth", "1", repo_url, str(target)])
    return target


def should_skip_path(path: Path, include_tests: bool) -> bool:
    parts = {part.lower() for part in path.parts}
    if parts & EXCLUDED_DIRS:
        return True
    if not include_tests and parts & EXCLUDED_FILE_PARTS:
        return True
    return False


def looks_like_secret_line(line: str) -> bool:
    lowered = line.lower()
    return any(marker in lowered and "=" in lowered for marker in SECRET_MARKERS)


def file_quality_ok(
    path: Path,
    *,
    min_chars: int,
    max_bytes: int,
    max_line_length: int,
    require_ast: bool,
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
    if any(looks_like_secret_line(line) for line in text.splitlines()):
        return False, "secret_marker", ""
    if require_ast:
        try:
            ast.parse(text)
        except SyntaxError:
            return False, "syntax_error", ""
    return True, "kept", text


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()


def copy_corpus_file(src: Path, repo_root: Path, repo_name: str, raw_dir: Path, text: str) -> Path:
    rel = src.relative_to(repo_root)
    dest = raw_dir / repo_name / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(text, encoding="utf-8")
    return dest


def build_corpus(args) -> dict:
    sources_dir = args.sources_dir.resolve()
    raw_dir = args.raw_dir.resolve()
    manifest_path = args.manifest.resolve()
    sources_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)

    seen_hashes = set()
    stats = {"repos": 0, "kept": 0, "skipped": 0, "chars": 0}

    with manifest_path.open("w", encoding="utf-8") as manifest:
        for repo_url in args.repo:
            repo_root = ensure_repo(repo_url, sources_dir, args.refresh)
            repo_name = repo_slug(repo_url)
            commit = run_git(["rev-parse", "HEAD"], cwd=repo_root)
            stats["repos"] += 1

            for src in sorted(repo_root.rglob("*.py")):
                rel = src.relative_to(repo_root)
                if should_skip_path(rel, args.include_tests):
                    stats["skipped"] += 1
                    continue

                ok, reason, text = file_quality_ok(
                    src,
                    min_chars=args.min_chars,
                    max_bytes=args.max_bytes,
                    max_line_length=args.max_line_length,
                    require_ast=not args.no_ast_check,
                )
                if not ok:
                    stats["skipped"] += 1
                    continue

                digest = content_hash(text)
                if digest in seen_hashes:
                    stats["skipped"] += 1
                    continue
                seen_hashes.add(digest)

                dest = copy_corpus_file(src, repo_root, repo_name, raw_dir, text)
                record = {
                    "repo": repo_url,
                    "commit": commit,
                    "source_path": str(rel).replace("\\", "/"),
                    "raw_path": str(dest),
                    "chars": len(text),
                    "sha256": digest,
                    "status": reason,
                }
                manifest.write(json.dumps(record, ensure_ascii=False) + "\n")
                stats["kept"] += 1
                stats["chars"] += len(text)

                if args.max_files and stats["kept"] >= args.max_files:
                    return stats

    return stats


def parse_args():
    base_dir = Path(__file__).parent
    parser = argparse.ArgumentParser(description="Build a curated Python corpus for NexusAI.")
    parser.add_argument("--repo", action="append", default=None, help="Git repository URL. Repeat to add more.")
    parser.add_argument("--sources_dir", type=Path, default=base_dir / "data" / "sources")
    parser.add_argument("--raw_dir", type=Path, default=base_dir / "data" / "raw")
    parser.add_argument("--manifest", type=Path, default=base_dir / "data" / "corpus_manifest.jsonl")
    parser.add_argument("--refresh", action="store_true", help="Delete and reclone source repositories.")
    parser.add_argument("--include_tests", action="store_true", help="Keep test/example files too.")
    parser.add_argument("--no_ast_check", action="store_true", help="Do not require files to parse as Python.")
    parser.add_argument("--min_chars", type=int, default=300)
    parser.add_argument("--max_bytes", type=int, default=80_000)
    parser.add_argument("--max_line_length", type=int, default=160)
    parser.add_argument("--max_files", type=int, default=0, help="Stop after N kept files. 0 means unlimited.")
    args = parser.parse_args()
    args.repo = args.repo or DEFAULT_REPOS
    return args


def main():
    args = parse_args()
    stats = build_corpus(args)
    approx_tokens = stats["chars"] // 4
    print(
        "Corpus built: "
        f"{stats['kept']} files kept, {stats['skipped']} skipped, "
        f"{stats['chars']} chars, ~{approx_tokens} tokens."
    )


if __name__ == "__main__":
    main()
