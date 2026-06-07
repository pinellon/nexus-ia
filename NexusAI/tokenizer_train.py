"""Train a ByteLevel BPE tokenizer for Nexus Coder Tiny."""

import argparse
import json
from pathlib import Path

from tokenizers import Tokenizer, models, pre_tokenizers, processors, trainers


def load_config(config_path: Path) -> dict:
    with config_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def resolve_path(base_dir: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else base_dir / path


def main():
    default_config = Path(__file__).with_name("config.json")
    parser = argparse.ArgumentParser(description="Train a ByteLevel BPE tokenizer for Nexus Coder Tiny.")
    parser.add_argument("--config", type=str, default=str(default_config), help="Path to config.json")
    args = parser.parse_args()

    config_path = Path(args.config).resolve()
    cfg = load_config(config_path)
    clean_dir = resolve_path(config_path.parent, cfg["paths"]["clean_data"]).resolve()
    token_dir = resolve_path(config_path.parent, cfg["paths"]["token_dir"]).resolve()
    token_dir.mkdir(parents=True, exist_ok=True)
    output_path = token_dir / "tokenizer.json"

    corpus_files = [str(p) for p in clean_dir.rglob("*") if p.is_file()]
    if not corpus_files:
        raise FileNotFoundError(f"No training files found in {clean_dir}")
    print(f"[INFO] Found {len(corpus_files)} files for tokenizer training.")

    tokenizer = Tokenizer(models.BPE(unk_token="<unk>"))
    tokenizer.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)

    custom_special_path = config_path.parent / "special_tokens.txt"
    custom_tokens = []
    if custom_special_path.is_file():
        with custom_special_path.open("r", encoding="utf-8") as f:
            custom_tokens = [line.strip() for line in f if line.strip()]

    base_special = ["<pad>", "<unk>", "<bos>", "<eos>"]
    all_special = list(dict.fromkeys(base_special + custom_tokens))
    trainer = trainers.BpeTrainer(
        vocab_size=int(cfg["model"]["vocab_size"]),
        min_frequency=2,
        special_tokens=all_special,
    )
    tokenizer.train(files=corpus_files, trainer=trainer)

    tokenizer.post_processor = processors.TemplateProcessing(
        single="<bos> $A <eos>",
        pair="<bos> $A <eos> $B:1 <eos>",
        special_tokens=[
            ("<bos>", tokenizer.token_to_id("<bos>")),
            ("<eos>", tokenizer.token_to_id("<eos>")),
        ],
    )

    tokenizer.save(str(output_path))
    print(f"[INFO] Tokenizer saved to {output_path}")


if __name__ == "__main__":
    main()
