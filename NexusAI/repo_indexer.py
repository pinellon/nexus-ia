"""Project indexing for NexusAI repo mode."""

from __future__ import annotations

import argparse
import json
import time
from dataclasses import dataclass
from pathlib import Path


IGNORED_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".nexus",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".venv",
    "venv",
    "env",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "reports",
    "logs",
    "previews",
    "experiments",
    "caches",
    "cache",
    ".tmp-preview",
    ".tmp-tests",
    ".next",
    ".vite",
}

IGNORED_PATH_PREFIXES = {
    "data/raw",
    "data/clean",
    "data/sources",
    "data/cache",
    "nexusai/data/raw",
    "nexusai/data/clean",
    "nexusai/data/sources",
    "nexusai/data/cache",
    "frontend",
    "claude ia",
    "workspace",
    "nexusai/_archive",
    "nexusai/.tmp_user_zip_files",
}

IMPORTANT_NAMES = {
    "package.json",
    "requirements.txt",
    "pyproject.toml",
    "setup.py",
    "app.py",
    "main.py",
    "server.py",
    "index.html",
    "vite.config.js",
    "vite.config.ts",
    "tsconfig.json",
    "electron.vite.config.ts",
}

TEXT_EXTENSIONS = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".html",
    ".css",
    ".json",
    ".md",
    ".toml",
    ".txt",
    ".yml",
    ".yaml",
    ".ini",
    ".cfg",
}


@dataclass
class FileInfo:
    path: str
    size: int
    ext: str
    important: bool
    extension: str
    size_bytes: int
    probable_type: str
    summary: str


def resolve_project_dir(project_dir: str | Path) -> Path:
    root = Path(project_dir).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise ValueError(f"Project directory not found: {root}")
    return root


def is_ignored(path: Path, root: Path) -> bool:
    try:
        rel_parts = path.relative_to(root).parts
    except ValueError:
        return True
    rel_posix = path.relative_to(root).as_posix().lower()
    return any(part in IGNORED_DIRS for part in rel_parts) or any(
        rel_posix == prefix or rel_posix.startswith(f"{prefix}/") or rel_posix.startswith(prefix)
        for prefix in IGNORED_PATH_PREFIXES
    )


def looks_binary(path: Path, sample_size: int = 2048) -> bool:
    try:
        sample = path.read_bytes()[:sample_size]
    except OSError:
        return True
    return b"\x00" in sample


def probable_type(path: Path) -> str:
    name = path.name.lower()
    suffix = path.suffix.lower()
    if suffix == ".py":
        return "python"
    if suffix in {".ts", ".tsx"}:
        return "typescript"
    if suffix in {".js", ".jsx"}:
        return "javascript"
    if suffix == ".json":
        return "json"
    if suffix == ".md":
        return "markdown"
    if suffix in {".yml", ".yaml", ".toml", ".ini", ".cfg"} or name in IMPORTANT_NAMES:
        return "config"
    if suffix in {".html", ".css"}:
        return "web"
    return "text"


def summarize_file(path: Path) -> str:
    ptype = probable_type(path)
    name = path.name
    if name in IMPORTANT_NAMES:
        return f"Important {ptype} file `{name}`."
    if "test" in path.as_posix().lower() or "spec" in path.as_posix().lower():
        return f"{ptype} test-related file."
    return f"{ptype} source file."


def iter_project_files(root: Path, max_files: int = 1200) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*"):
        if len(files) >= max_files:
            break
        if is_ignored(path, root) or not path.is_file():
            continue
        if path.suffix.lower() not in TEXT_EXTENSIONS and path.name not in IMPORTANT_NAMES:
            continue
        try:
            if path.stat().st_size > 400_000:
                continue
        except OSError:
            continue
        if looks_binary(path):
            continue
        files.append(path)
    return files


def read_small_text(path: Path, limit: int = 20_000) -> str:
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""
    return text[:limit]


def detect_stack(root: Path, files: list[Path]) -> list[str]:
    names = {path.name.lower() for path in files}
    suffixes = {path.suffix.lower() for path in files}
    stack: set[str] = set()

    package_json = root / "package.json"
    package_text = read_small_text(package_json).lower() if package_json.is_file() else ""
    requirements = read_small_text(root / "requirements.txt").lower()
    pyproject = read_small_text(root / "pyproject.toml").lower()

    if ".py" in suffixes or "requirements.txt" in names or "pyproject.toml" in names:
        stack.add("python")
    if "flask" in requirements or "flask" in pyproject or any(path.name == "app.py" for path in files):
        stack.add("flask")
    if "package.json" in names or {".js", ".jsx", ".ts", ".tsx"} & suffixes:
        stack.add("node")
    if "react" in package_text or ".jsx" in suffixes or ".tsx" in suffixes:
        stack.add("react")
    if "electron" in package_text or any("electron" in path.name.lower() for path in files):
        stack.add("electron")
    if ".html" in suffixes or ".css" in suffixes:
        stack.add("web")
    if "sqlite" in requirements or "sqlite" in pyproject:
        stack.add("sqlite")
    return sorted(stack)


def detect_entrypoints(root: Path, files: list[Path], stack: list[str]) -> dict[str, str]:
    rels = {path.relative_to(root).as_posix(): path for path in files}
    entrypoints: dict[str, str] = {}
    for candidate in ("app.py", "main.py", "server.py"):
        if candidate in rels:
            entrypoints["backend"] = candidate
            break
    for candidate in ("index.html", "public/index.html", "src/index.html"):
        if candidate in rels:
            entrypoints["frontend"] = candidate
            break
    for candidate in ("src/main.ts", "src/main.js", "main.ts", "main.js"):
        if candidate in rels and "electron" in stack:
            entrypoints["electron_main"] = candidate
            break
    for candidate in ("src/App.tsx", "src/App.jsx", "src/App.js", "src/App.ts"):
        if candidate in rels:
            entrypoints["react_app"] = candidate
            break
    return entrypoints


def important_files(root: Path, files: list[Path], entrypoints: dict[str, str]) -> list[str]:
    scored: list[tuple[int, str]] = []
    entry_values = set(entrypoints.values())
    for path in files:
        rel = path.relative_to(root).as_posix()
        score = 0
        if path.name in IMPORTANT_NAMES:
            score += 5
        if rel in entry_values:
            score += 10
        if path.suffix.lower() in {".py", ".tsx", ".ts", ".jsx", ".js", ".html", ".css"}:
            score += 1
        if score:
            scored.append((score, rel))
    return [rel for _, rel in sorted(scored, key=lambda item: (-item[0], item[1]))[:40]]


def write_default_docs(nexus_dir: Path, project_name: str, stack: list[str]) -> None:
    decisions = nexus_dir / "decisions.md"
    if not decisions.exists():
        decisions.write_text(
            "\n".join(
                [
                    "# NexusAI Project Decisions",
                    "",
                    f"## {time.strftime('%Y-%m-%d')}",
                    f"- Project indexed as `{project_name}`.",
                    f"- Detected stack: {', '.join(stack) if stack else 'unknown'}.",
                    "- NexusAI must not add dependencies without explicit approval.",
                    "- NexusAI should prefer small reviewable patches.",
                    "",
                ]
            ),
            encoding="utf-8",
        )

    style = nexus_dir / "style_guide.md"
    if not style.exists():
        style.write_text(
            "\n".join(
                [
                    "# NexusAI Style Guide",
                    "",
                    "- Keep comments short and useful.",
                    "- Match the existing file style before introducing a new pattern.",
                    "- Prefer clear names over clever abbreviations.",
                    "- Return errors as structured JSON in APIs when the project already does that.",
                    "- For Electron, require contextIsolation=true and nodeIntegration=false.",
                    "- Ask before adding new packages.",
                    "",
                ]
            ),
            encoding="utf-8",
        )


def build_project_index(project_dir: str | Path, *, max_files: int = 1200) -> dict:
    root = resolve_project_dir(project_dir)
    files = iter_project_files(root, max_files=max_files)
    stack = detect_stack(root, files)
    entrypoints = detect_entrypoints(root, files, stack)
    important = important_files(root, files, entrypoints)
    nexus_dir = root / ".nexus"
    nexus_dir.mkdir(exist_ok=True)
    write_default_docs(nexus_dir, root.name, stack)

    file_infos = []
    for path in files:
        stat = path.stat()
        rel = path.relative_to(root).as_posix()
        file_infos.append(
            FileInfo(
                path=rel,
                size=stat.st_size,
                ext=path.suffix.lower(),
                important=rel in important,
                extension=path.suffix.lower(),
                size_bytes=stat.st_size,
                probable_type=probable_type(path),
                summary=summarize_file(path),
            ).__dict__
        )

    index = {
        "project_name": root.name,
        "project_dir": str(root),
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "stack": stack,
        "entrypoints": entrypoints,
        "important_files": important,
        "ignored_dirs": sorted(IGNORED_DIRS),
        "file_count": len(file_infos),
        "files": file_infos,
    }
    (nexus_dir / "project_index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    return index


def main() -> None:
    parser = argparse.ArgumentParser(description="Index a project for NexusAI repo mode.")
    parser.add_argument("project_dir", nargs="?", default=".")
    parser.add_argument("--max_files", type=int, default=1200)
    args = parser.parse_args()
    index = build_project_index(args.project_dir, max_files=args.max_files)
    print(json.dumps({k: index[k] for k in ("project_name", "stack", "entrypoints", "important_files", "file_count")}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
