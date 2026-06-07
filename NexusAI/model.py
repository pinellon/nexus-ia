import torch
import torch.nn as nn
from torch.utils.checkpoint import checkpoint

class TinyTransformer(nn.Module):
    """Tiny decoder‑only transformer (~10‑50 M parameters).

    Designed for low‑VRAM environments:
    * Uses `torch.float16` (mixed precision) when a CUDA device is available.
    * Supports gradient checkpointing via `torch.utils.checkpoint`.
    * Allows CPU fallback – the model can be instantiated on CPU and later moved to GPU.
    """
    def __init__(
        self,
        vocab_size: int,
        d_model: int = 256,
        nhead: int = 4,
        num_layers: int = 4,
        dim_ff: int = 1024,
        max_seq_len: int = 1024,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.d_model = d_model
        self.max_seq_len = max_seq_len
        self.token_emb = nn.Embedding(vocab_size, d_model)
        self.pos_emb = nn.Parameter(torch.empty(1, max_seq_len, d_model))
        nn.init.normal_(self.pos_emb, std=0.02)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_ff,
            dropout=dropout,
            activation="gelu",
            batch_first=True,
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.ln_f = nn.LayerNorm(d_model)
        self.head = nn.Linear(d_model, vocab_size, bias=False)
        self.dropout = nn.Dropout(dropout)
        self._reset_parameters()
        # Enable gradient checkpointing optionally
        self.use_checkpoint = False

    def _reset_parameters(self):
        # Small init to keep variance stable
        for p in self.parameters():
            if p.dim() > 1:
                nn.init.xavier_uniform_(p)

    def forward(self, input_ids: torch.Tensor) -> torch.Tensor:
        """Forward pass.

        Args:
            input_ids: Tensor of shape (batch, seq_len) with token ids.
        Returns:
            logits of shape (batch, seq_len, vocab_size).
        """
        device = input_ids.device
        seq_len = input_ids.size(1)
        assert seq_len <= self.max_seq_len, f"Sequence length {seq_len} exceeds max {self.max_seq_len}"
        causal_mask = torch.triu(
            torch.ones(seq_len, seq_len, device=device, dtype=torch.bool),
            diagonal=1,
        )
        token_embeddings = self.token_emb(input_ids)  # (b, s, d)
        position_embeddings = self.pos_emb[:, :seq_len, :].to(device)
        x = token_embeddings + position_embeddings
        x = self.dropout(x)
        if self.use_checkpoint:
            # Apply checkpointing per layer to save memory
            for layer in self.transformer.layers:
                def layer_forward(inp, layer=layer):
                    return layer(inp, src_mask=causal_mask, is_causal=True)

                x = checkpoint(layer_forward, x, use_reentrant=False)
        else:
            x = self.transformer(x, mask=causal_mask, is_causal=True)
        x = self.ln_f(x)
        logits = self.head(x)
        return logits

    def configure_fp16(self, enabled: bool = True):
        """Enable mixed‑precision (fp16) for CUDA devices.
        The model will be cast to `torch.float16` when moved to GPU.
        """
        self.use_fp16 = enabled
        if enabled and torch.cuda.is_available():
            self.half()
        else:
            self.float()

    def enable_gradient_checkpointing(self, enable: bool = True):
        self.use_checkpoint = enable

    def count_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters() if p.requires_grad)

if __name__ == "__main__":
    # Simple sanity check
    dummy_vocab = 50000
    model = TinyTransformer(vocab_size=dummy_vocab)
    print(f"TinyTransformer parameters: {model.count_parameters():,}")
    x = torch.randint(0, dummy_vocab, (2, 128))
    out = model(x)
    print(out.shape)
