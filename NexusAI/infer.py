"""Inference script for Nexus Coder Tiny."""

import argparse
import json
import re
import sys
from pathlib import Path

import torch
import torch.nn.functional as F
from tokenizers import Tokenizer
from tokenizers.decoders import ByteLevel

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.append(str(Path(__file__).parent))
from model import TinyTransformer
from memory_store import add_interaction, augment_prompt, resolve_memory_path, seed_default_memories


CODE_BLOCK_RE = re.compile(r"```(?:[A-Za-z0-9_+-]+)?[ \t]*\r?\n(.*?)```", re.DOTALL)


def load_config(config_path: Path):
    with config_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def resolve_path(base_dir: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else base_dir / path


def clean_text(text: str) -> str:
    """Remove control tokens and ByteLevel marker artifacts."""
    for token in ["<bos>", "<eos>", "<pad>", "<unk>", "<|endoftext|>"]:
        text = text.replace(token, "")
    text = text.replace("Ä ", " ")
    text = text.replace("ÄŠ", "\n")
    lines = [line.rstrip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line.strip())


def extract_code_block(text: str) -> str:
    """Extract the first fenced code block when a caller needs code-only output."""
    blocks = [block.strip() for block in CODE_BLOCK_RE.findall(text) if block.strip()]
    return blocks[0] if blocks else text.strip()


def apply_few_shot_template(prompt: str) -> str:
    template = (
        "def add(a, b):\n"
        "    return a + b\n"
        "\n"
        "def subtract(a, b):\n"
        "    return a - b\n"
        "\n"
    )
    return template + prompt


def apply_instruction_template(prompt: str) -> str:
    return f"### Instruction:\n{prompt.strip()}\n\n### Response:\n"


def strip_few_shot_prefix(output_text: str) -> str:
    prefix = apply_few_shot_template("")
    text = output_text
    if text.startswith("<bos>"):
        text = text[len("<bos>") :]
    text = text.lstrip("Ä  ")
    return text[len(prefix) :] if text.startswith(prefix) else output_text


def strip_training_markers(text: str) -> str:
    """Remove leaked dataset boundary markers from generated output."""
    markers = ["</sample>", "<sample>", "</file>", "### Instruction:", "### Response:"]
    cut_at = len(text)
    for marker in markers:
        pos = text.find(marker)
        if pos >= 0:
            cut_at = min(cut_at, pos)
    return text[:cut_at]


def get_latest_checkpoint(model_dir: Path):
    ckpts = sorted(model_dir.glob("*.pt"), key=lambda p: p.stat().st_mtime, reverse=True)
    return ckpts[0] if ckpts else None


def load_runtime(config_path: Path):
    config_path = config_path.resolve()
    cfg = load_config(config_path)
    config_dir = config_path.parent
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    token_path = resolve_path(config_dir, cfg["paths"]["token_dir"]) / "tokenizer.json"
    model_dir = resolve_path(config_dir, cfg["paths"]["model_dir"])
    if not token_path.is_file():
        raise FileNotFoundError(f"Tokenizer not found: {token_path}")

    tokenizer = Tokenizer.from_file(str(token_path))
    tokenizer.decoder = ByteLevel()

    best_path = model_dir / "nexus_model_best.pt"
    ckpt_path = best_path if best_path.is_file() else get_latest_checkpoint(model_dir)
    if not ckpt_path:
        raise FileNotFoundError(f"No model checkpoint found in {model_dir}")
    ckpt = torch.load(str(ckpt_path), map_location=device)

    model_cfg = cfg["model"]
    model = TinyTransformer(
        vocab_size=int(model_cfg["vocab_size"]),
        d_model=int(model_cfg.get("hidden_size", 256)),
        nhead=int(model_cfg.get("num_heads", 4)),
        num_layers=int(model_cfg.get("num_layers", 4)),
        dim_ff=int(model_cfg.get("dim_ff", int(model_cfg.get("hidden_size", 256)) * 4)),
        max_seq_len=int(model_cfg.get("max_seq_len", 1024)),
    ).to(device)
    model.load_state_dict(ckpt["model_state_dict"], strict=False)
    model.eval()
    if device.type == "cuda":
        model.half()

    return cfg, tokenizer, model, device, ckpt_path


def sample_next_token(
    logits: torch.Tensor,
    generated: list[int],
    repetition_penalty: float,
    temperature: float,
    top_k: int,
) -> torch.Tensor:
    next_token_logits = logits.clone()

    if repetition_penalty != 1.0:
        for token_id in set(generated):
            val = next_token_logits[token_id].item()
            if val > 0:
                next_token_logits[token_id] /= repetition_penalty
            else:
                next_token_logits[token_id] *= repetition_penalty

    temp = max(float(temperature), 1e-5)
    probs = F.softmax(next_token_logits / temp, dim=-1)
    k = min(max(int(top_k), 1), next_token_logits.size(-1))
    top_probs, top_idx = torch.topk(probs, k)
    top_probs = top_probs / top_probs.sum()
    return top_idx[torch.multinomial(top_probs, 1)]


def generate_text(
    prompt: str,
    *,
    max_new_tokens: int = 100,
    repetition_penalty: float = 1.2,
    use_few_shot: bool = False,
    temperature: float = 0.2,
    top_k: int = 20,
    config_path: Path | None = None,
    use_memory: bool = True,
    use_instruction_template: bool = True,
    extract_code: bool = False,
) -> str:
    if config_path is None:
        config_path = Path(__file__).with_name("config.json")

    original_prompt = prompt
    cfg, tokenizer, model, device, _ckpt_path = load_runtime(config_path)
    memory_path = resolve_memory_path(cfg, Path(config_path).resolve().parent)
    if use_memory:
        seed_default_memories(memory_path)
        prompt = augment_prompt(prompt, db_path=memory_path)
    max_seq_len = int(cfg["model"].get("max_seq_len", 1024))
    prompt_text = apply_instruction_template(prompt) if use_instruction_template else prompt
    prompt_text = apply_few_shot_template(prompt_text) if use_few_shot else prompt_text

    input_ids = tokenizer.encode(prompt_text).ids
    if len(input_ids) > max_seq_len:
        input_ids = input_ids[-max_seq_len:]

    prompt_token_count = len(input_ids)
    generated = input_ids.copy()
    consecutive_newlines = 0
    eos_ids = [
        token_id
        for token_id in (tokenizer.token_to_id("<eos>"), tokenizer.token_to_id("<|endoftext|>"))
        if token_id is not None
    ]

    with torch.no_grad():
        for _ in range(max_new_tokens):
            context_ids = generated[-max_seq_len:]
            input_tensor = torch.tensor([context_ids], dtype=torch.long, device=device)
            logits = model(input_tensor)
            next_token = sample_next_token(
                logits[0, -1, :],
                generated,
                repetition_penalty,
                temperature,
                top_k,
            )
            next_id = int(next_token.item())

            if next_id in eos_ids:
                break

            decoded_tok = tokenizer.decode([next_id])
            if decoded_tok and decoded_tok.replace("\r", "").replace("\n", "") == "" and "\n" in decoded_tok:
                consecutive_newlines += 1
            else:
                consecutive_newlines = 0
            if consecutive_newlines >= 3:
                break

            generated.append(next_id)

    output_text = tokenizer.decode(generated[prompt_token_count:], skip_special_tokens=False)
    if use_few_shot:
        output_text = strip_few_shot_prefix(output_text)
    cleaned = clean_text(strip_training_markers(output_text))
    if extract_code:
        cleaned = extract_code_block(cleaned)
    if use_memory:
        add_interaction("user", original_prompt, db_path=memory_path)
        add_interaction("assistant", cleaned, db_path=memory_path)
    return cleaned


def run_generation(
    prompt: str,
    max_new_tokens: int = 100,
    repetition_penalty: float = 1.2,
    use_few_shot: bool = False,
    temperature: float = 0.2,
    top_k: int = 20,
    config_path: str | Path | None = None,
    use_memory: bool = True,
    use_instruction_template: bool = True,
    extract_code: bool = False,
) -> str:
    """Generate code for the Flask API."""
    return generate_text(
        prompt,
        max_new_tokens=max_new_tokens,
        repetition_penalty=repetition_penalty,
        use_few_shot=use_few_shot,
        temperature=temperature,
        top_k=top_k,
        config_path=Path(config_path) if config_path else None,
        use_memory=use_memory,
        use_instruction_template=use_instruction_template,
        extract_code=extract_code,
    )


def main():
    parser = argparse.ArgumentParser(description="Run inference with Nexus Coder Tiny")
    parser.add_argument("-p", "--prompt", type=str, required=True, help="Input prompt for code generation")
    parser.add_argument("-n", "--max_new_tokens", type=int, default=100, help="Maximum tokens to generate")
    parser.add_argument("-r", "--repetition_penalty", type=float, default=1.2, help="Repetition penalty")
    parser.add_argument("-f", "--few_shot", action="store_true", help="Use few-shot prompt wrapper")
    parser.add_argument("-t", "--temperature", type=float, default=0.2, help="Sampling temperature")
    parser.add_argument("-k", "--top_k", type=int, default=20, help="Top-k sampling")
    parser.add_argument("--config", type=str, default=str(Path(__file__).with_name("config.json")))
    parser.add_argument("--no_memory", action="store_true", help="Disable memory context injection")
    parser.add_argument("--raw_prompt", action="store_true", help="Disable Instruction/Response prompt template")
    parser.add_argument("--extract_code", action="store_true", help="Return only the first fenced code block")
    args = parser.parse_args()

    text = generate_text(
        args.prompt,
        max_new_tokens=args.max_new_tokens,
        repetition_penalty=args.repetition_penalty,
        use_few_shot=args.few_shot,
        temperature=args.temperature,
        top_k=args.top_k,
        config_path=Path(args.config),
        use_memory=not args.no_memory,
        use_instruction_template=not args.raw_prompt,
        extract_code=args.extract_code,
    )
    print("--- Generated code ---")
    print(text)


if __name__ == "__main__":
    main()
