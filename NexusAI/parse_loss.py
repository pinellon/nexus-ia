import re, sys, pandas as pd

log_path = sys.argv[1] if len(sys.argv) > 1 else "train.log"
pattern = re.compile(r"Epoch\s+(\d+).*Loss\s+([0-9.]+)")

data = {"epoch": [], "loss": []}
with open(log_path, encoding="utf-8") as f:
    for line in f:
        m = pattern.search(line)
        if m:
            data["epoch"].append(int(m.group(1)))
            data["loss"].append(float(m.group(2)))

df = pd.DataFrame(data)
epoch_loss = df.groupby("epoch")["loss"].mean().reset_index()
epoch_loss.to_csv("epoch_loss.csv", index=False)
print("Saved epoch‑wise loss to epoch_loss.csv")
