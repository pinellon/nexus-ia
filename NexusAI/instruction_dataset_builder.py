"""Build a tagged training corpus with file/language and instruction boundaries."""

import argparse
import json
from pathlib import Path


EXT_TO_LANGUAGE = {
    ".py": "python",
    ".html": "html",
    ".css": "css",
    ".js": "javascript",
    ".jsx": "jsx",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".json": "json",
    ".md": "markdown",
}

QUALITY_PROFILES = {
    "balanced": {
        "weights": {"gold": 5, "silver": 2, "bronze": 1},
        "include_tagged_files": True,
    },
    "behavior": {
        "weights": {"gold": 12, "silver": 3, "bronze": 0},
        "include_tagged_files": False,
    },
}


def language_for(path: Path) -> str:
    return EXT_TO_LANGUAGE.get(path.suffix.lower(), "text")


def normalize_content(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    return text


def quality_for(path: Path, content: str) -> str:
    lowered = content[:300].lower()
    parts = {part.lower() for part in path.parts}
    if "quality: gold" in lowered or "premium_instruction_pairs" in parts or "negative_examples" in parts:
        return "gold"
    if "quality: silver" in lowered or "pro_quality_curriculum" in parts or "user_lessons" in parts:
        return "silver"
    return "bronze"


def build_record(path: Path, source_root: Path) -> str:
    rel = path.relative_to(source_root).as_posix()
    language = language_for(path)
    content = normalize_content(path.read_text(encoding="utf-8", errors="ignore"))
    return "\n".join(
        [
            "<sample>",
            f"<file path=\"{rel}\" language=\"{language}\">",
            content,
            "</file>",
            "</sample>",
            "",
        ]
    )


def build_instruction_record(path: Path, source_root: Path) -> str:
    rel = path.relative_to(source_root).as_posix()
    language = language_for(path)
    content = normalize_content(path.read_text(encoding="utf-8", errors="ignore"))
    return "\n".join(
        [
            "### Instruction:",
            f"Create or edit `{rel}` as a high-quality {language} file.",
            "",
            "### Response:",
            f"```{language}",
            content,
            "```",
            "",
        ]
    )


def build_instruction_dataset(clean_dir: Path, output_dir: Path, manifest_path: Path, profile: str = "balanced") -> dict:
    clean_dir = clean_dir.resolve()
    output_dir = output_dir.resolve()
    manifest_path = manifest_path.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    if profile not in QUALITY_PROFILES:
        raise ValueError(f"Unknown profile {profile!r}. Options: {', '.join(QUALITY_PROFILES)}")
    profile_cfg = QUALITY_PROFILES[profile]
    weights = profile_cfg["weights"]
    include_tagged_files = bool(profile_cfg["include_tagged_files"])

    output_path = output_dir / "tagged_corpus.txt"
    files = sorted(path for path in clean_dir.rglob("*") if path.is_file())
    stats = {"files": 0, "skipped": 0, "chars": 0, "output_path": str(output_path), "profile": profile}

    with output_path.open("w", encoding="utf-8") as out, manifest_path.open("w", encoding="utf-8") as manifest:
        for path in files:
            text = normalize_content(path.read_text(encoding="utf-8", errors="ignore"))
            if not text:
                continue
            quality = quality_for(path, text)
            weight = int(weights[quality])
            if weight <= 0 and not include_tagged_files:
                stats["skipped"] += 1
                continue
            tagged_record = build_record(path, clean_dir)
            instruction_record = build_instruction_record(path, clean_dir)
            if include_tagged_files:
                out.write(tagged_record)
            for _ in range(weight):
                out.write(instruction_record)
            stats["files"] += 1
            stats["chars"] += (len(tagged_record) if include_tagged_files else 0) + (len(instruction_record) * weight)
            manifest.write(
                json.dumps(
                    {
                        "path": path.relative_to(clean_dir).as_posix(),
                        "language": language_for(path),
                        "quality": quality,
                        "weight": weight,
                        "chars": len(text),
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
    return stats


def main():
    base_dir = Path(__file__).parent
    parser = argparse.ArgumentParser(description="Build tagged file/language training corpus.")
    parser.add_argument("--clean_dir", type=Path, default=base_dir / "data" / "clean")
    parser.add_argument("--output_dir", type=Path, default=base_dir / "data" / "instruction_clean")
    parser.add_argument("--manifest", type=Path, default=base_dir / "data" / "instruction_manifest.jsonl")
    parser.add_argument("--profile", choices=sorted(QUALITY_PROFILES), default="balanced")
    args = parser.parse_args()

    stats = build_instruction_dataset(args.clean_dir, args.output_dir, args.manifest, profile=args.profile)
    print(
        "Instruction dataset built: "
        f"{stats['files']} files, {stats['skipped']} skipped, {stats['chars']} chars, "
        f"~{stats['chars'] // 4} tokens, profile={stats['profile']}."
    )
    print(f"Output: {stats['output_path']}")


if __name__ == "__main__":
    main()
