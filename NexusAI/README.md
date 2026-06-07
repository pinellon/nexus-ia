# NexusAI

LLM treinado do zero para geração de código Python/Flask.

## Arquitetura atual (v2)
- hidden_size: 384 | num_layers: 6 | num_heads: 6 | dim_ff: 1536
- Parâmetros: ~17M | Vocab: 16.000 tokens (BPE, code-aware)
- Tokenizer: tokenizer/v2/ (### Instruction e ### Response como tokens únicos)

## Dataset
- ~20.000 pares SFT limpos (Python/Flask)
- Cache binário mmap: data/cache/train_ids.bin (~7.7 MB)

## Como treinar
```bash
python scripts/build_cache.py        # só na primeira vez
python scripts/train_v2.py
```

## Como inferir
```bash
python scripts/infer_v2.py \
  --ckpt models/v2/nexus_v2_best.pt \
  --prompt "### Instruction:\nCrie uma API Flask.\n### Response:\n" \
  --tokens 200 --temperature 0.2 --top_k 20
```

## Métricas — último benchmark
| Métrica | Baseline | Atual |
| :--- | :--- | :--- |
| instruction_following | 0.033 | 0.090 |
| compile_like_rate | 0.400 | 0.267 |
| repetition_score | 0.683 | 0.887 |

⚠️ Treino v2 em andamento — métricas serão atualizadas após benchmark.

## Estrutura
- `data/raw/`       → datasets brutos
- `data/gold/`      → pares curados manualmente
- `data/cache/`     → cache mmap tokenizado
- `models/v1/`      → checkpoint antigo (referência)
- `models/v2/`      → checkpoint atual (em treino)
- `tokenizer/v2/`   → BPE 16k code-aware
- `scripts/`        → treino, inferência, avaliação
- `configs/`        → hiperparâmetros JSON
- `logs/`           → últimos 3 logs de treino
