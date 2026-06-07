"""Audit NexusAI instruction datasets and extract clean gold pairs.

This script does not train the model. It answers three questions:
- how much of the current corpus is generic file wrapping;
- whether cache/binary files leaked into the clean dataset;
- how many real Instruction/Response pairs are available for behavior tuning.
"""

from __future__ import annotations

import argparse
import json
import re
import time
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path


BASE_DIR = Path(__file__).parent
DEFAULT_CLEAN_DIR = BASE_DIR / "data" / "clean"
DEFAULT_CORPUS = BASE_DIR / "data" / "instruction_clean" / "tagged_corpus.txt"
DEFAULT_MANIFEST = BASE_DIR / "data" / "instruction_manifest.jsonl"
DEFAULT_FILTERED_DIR = BASE_DIR / "data" / "gold_instruction_clean"
DEFAULT_TRAIN_DIR = BASE_DIR / "data" / "gold_instruction_train"
DEFAULT_LOG_DIR = BASE_DIR / "logs"

CACHE_DIRS = {"__pycache__", ".git", "node_modules", "dist", "build", ".venv", "venv"}
BINARY_SUFFIXES = {".pyc", ".pyo", ".bin", ".exe", ".dll", ".so", ".pyd", ".dylib"}
CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")

STANDARD_PAIR_RE = re.compile(
    r"###\s*Instruction:\s*(.*?)\n\s*###\s*Response:\s*(.*?)(?=\n##\s+|\n###\s*Instruction:|\Z)",
    re.IGNORECASE | re.DOTALL,
)
GOOD_PAIR_RE = re.compile(
    r"###\s*Instruction:\s*(.*?)\n\s*###\s*Bad Response:\s*.*?\n\s*###\s*Good Response:\s*(.*?)(?=\n##\s+|\n###\s*Instruction:|\Z)",
    re.IGNORECASE | re.DOTALL,
)


@dataclass
class Pair:
    source: str
    kind: str
    instruction: str
    response: str
    issues: list[str]


def normalize(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").strip()


def looks_binary_text(text: str) -> bool:
    sample = text[:4096]
    if "\x00" in sample:
        return True
    controls = CONTROL_RE.findall(sample)
    return len(controls) > max(8, int(len(sample) * 0.01))


def path_has_cache(path: Path) -> bool:
    return any(part in CACHE_DIRS for part in path.parts)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def detect_kind(response: str) -> str:
    fence = re.search(r"```([a-zA-Z0-9_+-]+)", response)
    if fence:
        return fence.group(1).lower()
    lowered = response.lower()
    if "<!doctype html" in lowered or "<html" in lowered:
        return "html"
    if "from flask import" in lowered or "def " in lowered:
        return "python"
    if "export function" in lowered or "export default" in lowered:
        return "typescript"
    if "{" in response and "}" in response and ":" in response:
        return "json_or_code"
    return "text"


def validate_pair(instruction: str, response: str) -> list[str]:
    issues: list[str] = []
    lowered_instruction = instruction.lower()
    lowered_response = response.lower()

    if len(instruction) < 8:
        issues.append("instruction_too_short")
    if len(response) < 20:
        issues.append("response_too_short")
    if len(response) > 12_000:
        issues.append("response_too_long")
    if looks_binary_text(instruction) or looks_binary_text(response):
        issues.append("binary_or_control_chars")
    if lowered_instruction.startswith("create or edit `"):
        issues.append("generic_file_wrapping")
    for marker in ("<sample>", "</sample>", "<file ", "</file>"):
        if marker in lowered_response:
            issues.append("training_marker_leak")
            break
    if "lorem ipsum" in lowered_response:
        issues.append("placeholder_lorem")
    if "..." in response and "nao use" not in lowered_instruction and "no ellipsis" not in lowered_instruction:
        issues.append("ellipsis_placeholder")
    if lowered_response.startswith("quality:"):
        issues.append("metadata_in_response")
    return issues


def parse_manifest(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    entries: list[dict] = []
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            entries.append({"_invalid": line[:120]})
    return entries


def extract_pairs_from_text(path: Path, text: str, root: Path) -> list[Pair]:
    rel = path.relative_to(root).as_posix()
    pairs: list[Pair] = []
    seen: set[tuple[str, str]] = set()

    for source_kind, regex in (("standard", STANDARD_PAIR_RE), ("good_response", GOOD_PAIR_RE)):
        for match in regex.finditer(text):
            instruction = normalize(match.group(1))
            response = normalize(match.group(2))
            key = (instruction, response)
            if key in seen:
                continue
            seen.add(key)
            issues = validate_pair(instruction, response)
            pairs.append(
                Pair(
                    source=f"{rel}#{source_kind}",
                    kind=detect_kind(response),
                    instruction=instruction,
                    response=response,
                    issues=issues,
                )
            )

    return pairs


def extract_gold_pairs(clean_dir: Path) -> list[Pair]:
    pairs: list[Pair] = []
    for path in sorted(clean_dir.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() in BINARY_SUFFIXES or path_has_cache(path):
            continue
        text = read_text(path)
        if "### Instruction" not in text:
            continue
        if looks_binary_text(text):
            continue
        pairs.extend(extract_pairs_from_text(path, text, clean_dir))
    return pairs


def audit_clean_files(clean_dir: Path) -> dict:
    files = [path for path in clean_dir.rglob("*") if path.is_file()]
    by_ext = Counter(path.suffix.lower() or "<none>" for path in files)
    cache_files = [path for path in files if path_has_cache(path)]
    binary_suffix_files = [path for path in files if path.suffix.lower() in BINARY_SUFFIXES]
    binary_text_files = []
    for path in files:
        if path.suffix.lower() in BINARY_SUFFIXES:
            continue
        try:
            text = read_text(path)
        except OSError:
            continue
        if looks_binary_text(text):
            binary_text_files.append(path)

    return {
        "total_files": len(files),
        "by_ext": dict(by_ext.most_common()),
        "cache_files": len(cache_files),
        "binary_suffix_files": len(binary_suffix_files),
        "binary_text_files": len(binary_text_files),
        "cache_examples": [str(path) for path in cache_files[:10]],
        "binary_examples": [str(path) for path in (binary_suffix_files + binary_text_files)[:10]],
    }


def audit_corpus(corpus_path: Path) -> dict:
    if not corpus_path.is_file():
        return {"exists": False}
    text = read_text(corpus_path)
    instruction_count = text.count("### Instruction:")
    sample_count = text.count("<sample>")
    generic_count = text.count("Create or edit `")
    response_count = text.count("### Response:")
    marker_leaks = sum(text.count(marker) for marker in ("<sample>", "</sample>", "<file ", "</file>"))
    return {
        "exists": True,
        "path": str(corpus_path),
        "chars": len(text),
        "approx_tokens": len(text) // 4,
        "instruction_records": instruction_count,
        "response_records": response_count,
        "sample_records": sample_count,
        "generic_file_wrapped_records": generic_count,
        "generic_instruction_ratio": round(generic_count / max(1, instruction_count), 3),
        "training_marker_count": marker_leaks,
        "has_binary_text": looks_binary_text(text),
    }


def write_filtered_dataset(pairs: list[Pair], filtered_dir: Path, train_dir: Path) -> dict:
    filtered_dir.mkdir(parents=True, exist_ok=True)
    train_dir.mkdir(parents=True, exist_ok=True)
    output_path = train_dir / "tagged_corpus.txt"
    manifest_path = filtered_dir / "gold_manifest.jsonl"
    valid_pairs = [pair for pair in pairs if not pair.issues]

    with output_path.open("w", encoding="utf-8") as out, manifest_path.open("w", encoding="utf-8") as manifest:
        for pair in valid_pairs:
            out.write("### Instruction:\n")
            out.write(pair.instruction.strip() + "\n\n")
            out.write("### Response:\n")
            out.write(pair.response.strip() + "\n\n")
            manifest.write(json.dumps(asdict(pair), ensure_ascii=False) + "\n")

    return {
        "path": str(output_path),
        "manifest": str(manifest_path),
        "train_dir": str(train_dir),
        "valid_pairs": len(valid_pairs),
        "chars": output_path.stat().st_size if output_path.exists() else 0,
        "approx_tokens": (output_path.stat().st_size // 4) if output_path.exists() else 0,
    }


def build_report(stats: dict) -> str:
    clean = stats["clean_files"]
    corpus = stats["corpus"]
    pairs = stats["pairs"]
    filtered = stats["filtered_dataset"]
    lines = [
        "# NexusAI Instruction Dataset Audit",
        "",
        f"Generated at: {stats['created_at']}",
        "",
        "## Clean Files",
        f"- total_files: {clean['total_files']}",
        f"- cache_files: {clean['cache_files']}",
        f"- binary_suffix_files: {clean['binary_suffix_files']}",
        f"- binary_text_files: {clean['binary_text_files']}",
        f"- by_ext: `{json.dumps(clean['by_ext'], ensure_ascii=False)}`",
        "",
        "## Generated Corpus",
        f"- exists: {corpus.get('exists')}",
        f"- chars: {corpus.get('chars', 0)}",
        f"- approx_tokens: {corpus.get('approx_tokens', 0)}",
        f"- instruction_records: {corpus.get('instruction_records', 0)}",
        f"- response_records: {corpus.get('response_records', 0)}",
        f"- sample_records: {corpus.get('sample_records', 0)}",
        f"- generic_file_wrapped_records: {corpus.get('generic_file_wrapped_records', 0)}",
        f"- generic_instruction_ratio: {corpus.get('generic_instruction_ratio', 0)}",
        f"- training_marker_count: {corpus.get('training_marker_count', 0)}",
        f"- has_binary_text: {corpus.get('has_binary_text', False)}",
        "",
        "## Extracted Real Instruction Pairs",
        f"- extracted_pairs: {pairs['total']}",
        f"- valid_pairs: {pairs['valid']}",
        f"- invalid_pairs: {pairs['invalid']}",
        f"- by_kind: `{json.dumps(pairs['by_kind'], ensure_ascii=False)}`",
        f"- issue_counts: `{json.dumps(pairs['issues'], ensure_ascii=False)}`",
        "",
        "## Filtered Gold Dataset",
        f"- path: `{filtered['path']}`",
        f"- manifest: `{filtered['manifest']}`",
        f"- valid_pairs: {filtered['valid_pairs']}",
        f"- approx_tokens: {filtered['approx_tokens']}",
        "",
        "## Diagnosis",
    ]

    if clean["cache_files"] or clean["binary_suffix_files"] or clean["binary_text_files"]:
        lines.append("- Clean dataset still contains cache/binary contamination. Rebuild with dataset_cleaner.py --reset.")
    if corpus.get("generic_instruction_ratio", 0) > 0.5:
        lines.append("- Most instruction records are generic file-wrapping, not real request/answer pairs.")
    if pairs["valid"] < 200:
        lines.append("- Gold pair count is below the recommended 200-500 examples for behavior fine-tuning.")
    if not lines[-1].startswith("- "):
        lines.append("- Dataset is cleaner, but still needs more curated gold examples before training.")

    lines.extend(["", "## Recommendation", "- Do not run long training on the mixed fullstack corpus."])
    if pairs["valid"] >= 200:
        lines.append("- Minimum gold target reached. Next step is a short low-learning-rate behavior fine-tune.")
    else:
        lines.append("- Add more hand-curated gold pairs until valid_pairs >= 200.")
    lines.extend(
        [
            "- Keep the previous checkpoint as baseline until benchmark improves compile_like_rate and instruction_following.",
            "- After fine-tuning, run the full 30-prompt benchmark before accepting the checkpoint.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit NexusAI instruction dataset quality.")
    parser.add_argument("--clean_dir", type=Path, default=DEFAULT_CLEAN_DIR)
    parser.add_argument("--corpus", type=Path, default=DEFAULT_CORPUS)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--filtered_dir", type=Path, default=DEFAULT_FILTERED_DIR)
    parser.add_argument("--train_dir", type=Path, default=DEFAULT_TRAIN_DIR)
    parser.add_argument("--log_dir", type=Path, default=DEFAULT_LOG_DIR)
    args = parser.parse_args()

    clean_dir = args.clean_dir.resolve()
    corpus = args.corpus.resolve()
    filtered_dir = args.filtered_dir.resolve()
    train_dir = args.train_dir.resolve()
    log_dir = args.log_dir.resolve()
    log_dir.mkdir(parents=True, exist_ok=True)

    manifest_entries = parse_manifest(args.manifest.resolve())
    pairs = extract_gold_pairs(clean_dir)
    issue_counts = Counter(issue for pair in pairs for issue in pair.issues)
    by_kind = Counter(pair.kind for pair in pairs)
    filtered = write_filtered_dataset(pairs, filtered_dir, train_dir)

    stats = {
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "clean_files": audit_clean_files(clean_dir),
        "corpus": audit_corpus(corpus),
        "manifest": {
            "entries": len(manifest_entries),
            "quality": dict(Counter(entry.get("quality", "unknown") for entry in manifest_entries)),
            "language": dict(Counter(entry.get("language", "unknown") for entry in manifest_entries)),
        },
        "pairs": {
            "total": len(pairs),
            "valid": sum(1 for pair in pairs if not pair.issues),
            "invalid": sum(1 for pair in pairs if pair.issues),
            "by_kind": dict(by_kind),
            "issues": dict(issue_counts),
            "invalid_examples": [asdict(pair) for pair in pairs if pair.issues][:10],
        },
        "filtered_dataset": filtered,
    }

    stamp = int(time.time())
    json_path = log_dir / f"instruction_dataset_audit_{stamp}.json"
    md_path = log_dir / f"instruction_dataset_audit_{stamp}.md"
    json_path.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(build_report(stats), encoding="utf-8")

    print(f"Audit saved: {md_path}")
    print(f"JSON saved: {json_path}")
    print(f"Clean files: {stats['clean_files']['total_files']}")
    print(f"Cache/binary contamination: {stats['clean_files']['cache_files'] + stats['clean_files']['binary_suffix_files'] + stats['clean_files']['binary_text_files']}")
    print(f"Corpus generic instruction ratio: {stats['corpus'].get('generic_instruction_ratio', 0)}")
    print(f"Extracted valid gold pairs: {stats['pairs']['valid']} / {stats['pairs']['total']}")
    print(f"Filtered corpus: {filtered['path']} (~{filtered['approx_tokens']} tokens)")


if __name__ == "__main__":
    main()
