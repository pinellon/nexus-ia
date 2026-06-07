# Cloud Training

Use this flow to train NexusAI Micro-Python on Colab or Kaggle, then bring the checkpoint back to the local Nexus app.

## 1. Create the bundle locally

From the repository root:

```powershell
python NexusAI\export_for_cloud.py
```

Upload this file to Colab/Kaggle:

```text
nexusai-cloud-bundle.zip
```

## 2. Prepare Colab

In a Colab notebook:

```python
from google.colab import files
uploaded = files.upload()
```

Upload `nexusai-cloud-bundle.zip`, then run:

```python
!unzip -q nexusai-cloud-bundle.zip
%cd NexusAI
!pip install -r requirements.txt
```

Check GPU:

```python
import torch
print(torch.__version__)
print(torch.cuda.is_available())
print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU")
```

## 3. Train

Short smoke run:

```python
!python cloud_train.py --epochs 1 --max_steps 20 --log_interval 1
```

Full first run:

```python
!python cloud_train.py --epochs 40 --log_interval 10
```

If the loss is still falling cleanly at epoch 40, continue:

```python
!python train.py --config config.micro-python.json --resume --epochs 80 --log_interval 10
```

## 4. Download the checkpoint

```python
from google.colab import files
files.download("model_micro/nexus_model_best.pt")
```

Copy the downloaded file back to:

```text
NexusAI/model_fullstack/nexus_model_best.pt
```

## 5. Use it locally in Nexus

Start the Python API:

```powershell
python NexusAI\app.py
```

In the Nexus app:

- open Settings > IA;
- choose `NexusAI local`;
- base URL: `http://127.0.0.1:5000`;
- click Test.

## Notes

- The cloud bundle excludes old checkpoints, logs, `__pycache__`, and cloned source repositories.
- The API defaults to `config.micro-python.json`.
- If generation is repetitive after training, try `temperature=0.3` and `top_k=40` in the provider/API settings later.
