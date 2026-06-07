"""Create a compact NexusAI training bundle for Colab/Kaggle."""

import argparse
import zipfile
from pathlib import Path


DEFAULT_EXCLUDE_DIRS = {
    "__pycache__",
    ".git",
    ".ipynb_checkpoints",
    "logs",
    "model",
    "model_micro",
    "data/sources",
}

DEFAULT_EXCLUDE_SUFFIXES = {
    ".pyc",
    ".pyo",
    ".pt",
    ".ckpt",
    ".zip",
}


def normalized_rel(path: Path, base: Path) -> str:
    return path.relative_to(base).as_posix()


def should_exclude(path: Path, base: Path) -> bool:
    rel = normalized_rel(path, base)
    parts = set(rel.split("/"))
    if any(excluded in rel for excluded in DEFAULT_EXCLUDE_DIRS):
        return True
    if parts & DEFAULT_EXCLUDE_DIRS:
        return True
    return path.suffix.lower() in DEFAULT_EXCLUDE_SUFFIXES


def create_bundle(source_dir: Path, output_path: Path) -> tuple[int, int]:
    source_dir = source_dir.resolve()
    output_path = output_path.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    file_count = 0
    byte_count = 0
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(source_dir.rglob("*")):
            if path.resolve() == output_path:
                continue
            if not path.is_file() or should_exclude(path, source_dir):
                continue
            arcname = f"NexusAI/{normalized_rel(path, source_dir)}"
            archive.write(path, arcname)
            file_count += 1
            byte_count += path.stat().st_size

    return file_count, byte_count


def main():
    base_dir = Path(__file__).parent
    parser = argparse.ArgumentParser(description="Export NexusAI as a compact cloud training zip.")
    parser.add_argument("--source", type=Path, default=base_dir, help="NexusAI source directory")
    parser.add_argument("--output", type=Path, default=base_dir.parent / "nexusai-cloud-bundle.zip")
    args = parser.parse_args()

    files, bytes_written = create_bundle(args.source, args.output)
    mb = bytes_written / (1024 * 1024)
    print(f"Created {args.output.resolve()}")
    print(f"Included {files} files, {mb:.2f} MB before zip compression.")


if __name__ == "__main__":
    main()
