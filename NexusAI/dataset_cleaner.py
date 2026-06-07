import argparse
import hashlib
import shutil
import re
from pathlib import Path

RAW_DIR = Path(__file__).parent / 'data' / 'raw'
CLEAN_DIR = Path(__file__).parent / 'data' / 'clean'

ALLOWED_EXTENSIONS = {
    ".css",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".py",
    ".ts",
    ".tsx",
    ".txt",
}

BINARY_EXTENSIONS = {
    ".bin",
    ".dll",
    ".dylib",
    ".exe",
    ".pyd",
    ".pyc",
    ".pyo",
    ".so",
}

SKIP_DIRS = {
    "__pycache__",
    ".git",
    ".hg",
    ".svn",
    "node_modules",
    "dist",
    "build",
    ".venv",
    "venv",
}

# Regex patterns for secrets (simple heuristics)
SECRET_PATTERNS = [
    r'(?i)api[_-]?key\s*[=:]\s*["\']?[A-Za-z0-9\-_/]{20,}["\']?',
    r'(?i)access[_-]?token\s*[=:]\s*["\']?[A-Za-z0-9\-_/]{20,}["\']?',
    r'(?i)secret\s*[=:]\s*["\']?[A-Za-z0-9\-_/]{20,}["\']?',
]

CONTROL_BYTES = set(range(0, 9)) | {11, 12} | set(range(14, 32))

def is_secret(line: str) -> bool:
    return any(re.search(pat, line) for pat in SECRET_PATTERNS)

def has_skipped_part(path: Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)

def looks_binary(src_path: Path) -> bool:
    try:
        chunk = src_path.read_bytes()[:4096]
    except OSError:
        return True
    if b"\x00" in chunk:
        return True
    if not chunk:
        return False
    controls = sum(1 for byte in chunk if byte in CONTROL_BYTES)
    return controls / max(1, len(chunk)) > 0.02

def file_fingerprint(src_path: Path) -> tuple[int, str]:
    digest = hashlib.sha256()
    with src_path.open('rb') as f:
        while chunk := f.read(1024 * 1024):
            digest.update(chunk)
    return src_path.stat().st_size, digest.hexdigest()

def clean_file(src_path: Path, dest_path: Path) -> bool:
    """Return True if file was kept, False if discarded."""
    try:
        suffix = src_path.suffix.lower()
        if suffix in BINARY_EXTENSIONS:
            return False
        if suffix not in ALLOWED_EXTENSIONS:
            return False
        if has_skipped_part(src_path):
            return False
        # Skip empty files
        if src_path.stat().st_size == 0:
            return False
        # Skip huge files (>5 MB)
        if src_path.stat().st_size > 5 * 1024 * 1024:
            return False
        if looks_binary(src_path):
            return False
        # Read lines and filter out secrets
        with src_path.open('r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        if not lines:
            return False
        # Remove lines containing secrets
        cleaned = [ln for ln in lines if not is_secret(ln)]
        # If too much was removed, discard file
        if len(cleaned) < 0.5 * len(lines):
            return False
        # Write cleaned content
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        with dest_path.open('w', encoding='utf-8') as out:
            out.writelines(cleaned)
        return True
    except Exception as e:
        print(f"Error cleaning {src_path}: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Clean raw code files for NexusAI training.')
    parser.add_argument('--raw_dir', type=Path, default=RAW_DIR, help='Directory with raw training files')
    parser.add_argument('--clean_dir', type=Path, default=CLEAN_DIR, help='Directory for cleaned files')
    parser.add_argument('--reset', action='store_true', help='Remove clean_dir before rebuilding it')
    args = parser.parse_args()

    raw_dir = args.raw_dir.resolve()
    clean_dir = args.clean_dir.resolve()
    if args.reset and clean_dir.exists():
        shutil.rmtree(clean_dir)
    clean_dir.mkdir(parents=True, exist_ok=True)

    # Gather all files under RAW_DIR (recursively)
    all_files = [
        p for p in raw_dir.rglob('*')
        if (
            p.is_file()
            and p.suffix.lower() in ALLOWED_EXTENSIONS
            and p.suffix.lower() not in BINARY_EXTENSIONS
            and not has_skipped_part(p)
        )
    ]
    seen_hashes = set()
    kept = 0
    for src in all_files:
        try:
            file_hash = file_fingerprint(src)
            if file_hash in seen_hashes:
                continue
            seen_hashes.add(file_hash)
            rel = src.relative_to(raw_dir)
            dest = clean_dir / rel
            if clean_file(src, dest):
                kept += 1
        except Exception as e:
            print(f"Skipping {src}: {e}")
    print(f"Cleaned dataset: kept {kept} files out of {len(all_files)}")

if __name__ == '__main__':
    main()
