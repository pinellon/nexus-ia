# infer_v2.py
import torch
import argparse
from pathlib import Path
from tokenizers import ByteLevelBPETokenizer
from train_v2 import NexusV2  # importa a classe do script de treino


def gerar(prompt, model, tokenizer, device, max_tokens=150, temperature=0.2, top_k=20):
    model.eval()
    enc = tokenizer.encode(prompt)
    ids = torch.tensor([enc.ids], dtype=torch.long).to(device)
    eos_id = tokenizer.token_to_id("<EOS>")

    with torch.no_grad():
        for _ in range(max_tokens):
            logits = model(ids)[:, -1, :]
            logits = logits / temperature

            # Top-k sampling
            topk_vals, topk_idx = torch.topk(logits, top_k)
            probs = torch.softmax(topk_vals, dim=-1)
            next_id = topk_idx[0, torch.multinomial(probs[0], 1)]

            ids = torch.cat([ids, next_id.unsqueeze(0).unsqueeze(0)], dim=1)

            if next_id.item() == eos_id:
                break

    tokens = ids[0].tolist()
    return tokenizer.decode(tokens[len(enc.ids):])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Inferencia NexusV2")
    parser.add_argument("--ckpt",        default="models/v2/nexus_v2_best.pt")
    parser.add_argument("--prompt",      default="### Instruction:\nCrie uma função Python que soma dois números.\n### Response:\n")
    parser.add_argument("--tokens",      type=int,   default=150)
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--top_k",       type=int,   default=20)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    ckpt = torch.load(args.ckpt, map_location=device, weights_only=False)
    cfg  = ckpt["cfg"]

    tok = ByteLevelBPETokenizer(
        f"{cfg['tokenizer_path']}/vocab.json",
        f"{cfg['tokenizer_path']}/merges.txt",
    )

    model = NexusV2(tok.get_vocab_size(), cfg).to(device)
    model.load_state_dict(ckpt["model_state"])
    print(f"Checkpoint: epoch {ckpt.get('epoch', '?')} | loss {ckpt.get('loss', '?'):.4f}")
    print(f"Prompt: {args.prompt!r}")
    print("-" * 60)

    resultado = gerar(
        args.prompt, model, tok, device,
        args.tokens, args.temperature, args.top_k
    )
    print(resultado)
