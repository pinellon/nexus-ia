"""Generate the first curated gold batch for NexusAI.

The source of truth for training is the Markdown file because the current
auditor extracts real Instruction/Response pairs from Markdown lessons. A JSONL
copy is also emitted with the same schema used by gold_manifest.jsonl.
"""

from __future__ import annotations

import ast
import json
from pathlib import Path


BASE_DIR = Path(__file__).parent
RAW_DIR = BASE_DIR / "data" / "raw" / "user_lessons" / "premium_instruction_pairs"
OUT_MD = RAW_DIR / "gold_batch_001_python_flask.md"
OUT_JSONL = RAW_DIR / "gold_batch_001_python_flask.jsonl"


def code_block(language: str, code: str) -> str:
    return f"```{language}\n{code.strip()}\n```"


PYTHON_SNIPPETS = [
    (
        "Crie uma funcao Python somar(a, b) que retorna a soma. Responda somente com codigo.",
        """
def somar(a, b):
    return a + b
""",
    ),
    (
        "Crie uma funcao Python subtrair(a, b) que retorna a diferenca. Responda somente com codigo.",
        """
def subtrair(a, b):
    return a - b
""",
    ),
    (
        "Crie uma funcao Python multiplicar(a, b) que retorna o produto. Responda somente com codigo.",
        """
def multiplicar(a, b):
    return a * b
""",
    ),
    (
        "Crie uma funcao Python dividir_seguro(a, b) que levanta ValueError se b for zero.",
        """
def dividir_seguro(a, b):
    if b == 0:
        raise ValueError("b nao pode ser zero")
    return a / b
""",
    ),
    (
        "Crie uma funcao Python media(values) que retorna 0.0 para lista vazia.",
        """
def media(values):
    if not values:
        return 0.0
    return sum(values) / len(values)
""",
    ),
    (
        "Crie uma funcao Python maior_numero(values) que retorna None para lista vazia.",
        """
def maior_numero(values):
    if not values:
        return None
    return max(values)
""",
    ),
    (
        "Crie uma funcao Python menor_numero(values) que retorna None para lista vazia.",
        """
def menor_numero(values):
    if not values:
        return None
    return min(values)
""",
    ),
    (
        "Crie uma funcao Python normalizar_email(email) que remove espacos e converte para minusculo.",
        """
def normalizar_email(email):
    return email.strip().lower()
""",
    ),
    (
        "Crie uma funcao Python nome_completo(primeiro, ultimo) que remove espacos extras.",
        """
def nome_completo(primeiro, ultimo):
    return f"{primeiro.strip()} {ultimo.strip()}".strip()
""",
    ),
    (
        "Crie uma funcao Python contar_palavras(texto) que conte palavras separadas por espaco.",
        """
def contar_palavras(texto):
    palavras = texto.split()
    return len(palavras)
""",
    ),
    (
        "Crie uma funcao Python extrair_digitos(texto) que retorna apenas numeros.",
        """
def extrair_digitos(texto):
    return "".join(char for char in texto if char.isdigit())
""",
    ),
    (
        "Crie uma funcao Python validar_email_simples(email) sem usar bibliotecas externas.",
        """
def validar_email_simples(email):
    email = email.strip()
    if "@" not in email:
        return False
    local, domain = email.rsplit("@", 1)
    return bool(local) and "." in domain and not domain.startswith(".") and not domain.endswith(".")
""",
    ),
    (
        "Crie uma funcao Python mascarar_cpf(cpf) que retorna ***.***.***-XX.",
        """
def mascarar_cpf(cpf):
    digits = "".join(char for char in cpf if char.isdigit())
    if len(digits) != 11:
        raise ValueError("cpf deve ter 11 digitos")
    return f"***.***.***-{digits[-2:]}"
""",
    ),
    (
        "Crie uma funcao Python formatar_telefone(digits) para 10 ou 11 digitos.",
        """
def formatar_telefone(digits):
    value = "".join(char for char in digits if char.isdigit())
    if len(value) == 10:
        return f"({value[:2]}) {value[2:6]}-{value[6:]}"
    if len(value) == 11:
        return f"({value[:2]}) {value[2:7]}-{value[7:]}"
    raise ValueError("telefone deve ter 10 ou 11 digitos")
""",
    ),
    (
        "Crie uma funcao Python slugify(texto) simples usando apenas stdlib.",
        """
import re
import unicodedata


def slugify(texto):
    normalized = unicodedata.normalize("NFKD", texto)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    lowered = ascii_text.lower()
    return re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")
""",
    ),
    (
        "Crie uma funcao Python unico_preservando_ordem(values).",
        """
def unico_preservando_ordem(values):
    seen = set()
    result = []
    for value in values:
        if value not in seen:
            seen.add(value)
            result.append(value)
    return result
""",
    ),
    (
        "Crie uma funcao Python chunk_list(values, size) que divide uma lista em blocos.",
        """
def chunk_list(values, size):
    if size <= 0:
        raise ValueError("size deve ser maior que zero")
    return [values[index:index + size] for index in range(0, len(values), size)]
""",
    ),
    (
        "Crie uma funcao Python flatten(listas) que achata uma lista de listas.",
        """
def flatten(listas):
    result = []
    for items in listas:
        result.extend(items)
    return result
""",
    ),
    (
        "Crie uma funcao Python clamp(value, minimum, maximum).",
        """
def clamp(value, minimum, maximum):
    if minimum > maximum:
        raise ValueError("minimum nao pode ser maior que maximum")
    return max(minimum, min(value, maximum))
""",
    ),
    (
        "Crie uma funcao Python parse_int(value, default=0) que nunca levanta excecao.",
        """
def parse_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
""",
    ),
    (
        "Crie uma funcao Python calcular_desconto(preco, percentual).",
        """
def calcular_desconto(preco, percentual):
    if percentual < 0 or percentual > 100:
        raise ValueError("percentual deve estar entre 0 e 100")
    return preco - (preco * percentual / 100)
""",
    ),
    (
        "Crie uma funcao Python formatar_moeda(valor) para reais.",
        """
def formatar_moeda(valor):
    formatted = f"{valor:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    return f"R$ {formatted}"
""",
    ),
    (
        "Crie uma funcao Python remover_none(data) que remove chaves com valor None.",
        """
def remover_none(data):
    return {key: value for key, value in data.items() if value is not None}
""",
    ),
    (
        "Crie uma funcao Python inverter_dict(data) que inverte chave e valor.",
        """
def inverter_dict(data):
    return {value: key for key, value in data.items()}
""",
    ),
    (
        "Crie uma funcao Python filtrar_ativos(users) para lista de dicts.",
        """
def filtrar_ativos(users):
    return [user for user in users if user.get("active") is True]
""",
    ),
    (
        "Crie uma funcao Python agrupar_por_status(tasks).",
        """
def agrupar_por_status(tasks):
    grouped = {}
    for task in tasks:
        status = task.get("status", "unknown")
        grouped.setdefault(status, []).append(task)
    return grouped
""",
    ),
    (
        "Crie uma funcao Python encontrar_por_id(items, item_id).",
        """
def encontrar_por_id(items, item_id):
    for item in items:
        if item.get("id") == item_id:
            return item
    return None
""",
    ),
    (
        "Crie uma funcao Python paginar(items, page, per_page).",
        """
def paginar(items, page, per_page):
    if page < 1:
        page = 1
    if per_page < 1:
        per_page = 10
    start = (page - 1) * per_page
    end = start + per_page
    return items[start:end]
""",
    ),
    (
        "Crie uma funcao Python ordenar_por_nome(items).",
        """
def ordenar_por_nome(items):
    return sorted(items, key=lambda item: item.get("nome", "").lower())
""",
    ),
    (
        "Crie uma funcao Python calcular_total_pedido(items).",
        """
def calcular_total_pedido(items):
    total = 0.0
    for item in items:
        total += float(item.get("preco", 0)) * int(item.get("quantidade", 1))
    return total
""",
    ),
    (
        "Crie uma funcao Python aplicar_taxa(valor, taxa_percentual).",
        """
def aplicar_taxa(valor, taxa_percentual):
    return valor + (valor * taxa_percentual / 100)
""",
    ),
    (
        "Crie uma funcao Python parse_tags(texto) que separa tags por virgula.",
        """
def parse_tags(texto):
    tags = []
    for part in texto.split(","):
        tag = part.strip().lower()
        if tag:
            tags.append(tag)
    return tags
""",
    ),
    (
        "Crie uma funcao Python sanitizar_nome_arquivo(nome).",
        """
import re


def sanitizar_nome_arquivo(nome):
    clean = re.sub(r"[^a-zA-Z0-9._-]+", "_", nome.strip())
    return clean.strip("._") or "arquivo"
""",
    ),
    (
        "Crie uma funcao Python calcular_imc(peso, altura).",
        """
def calcular_imc(peso, altura):
    if altura <= 0:
        raise ValueError("altura deve ser maior que zero")
    return peso / (altura ** 2)
""",
    ),
    (
        "Crie uma funcao Python top_n(values, n) que retorna os maiores valores.",
        """
def top_n(values, n):
    if n <= 0:
        return []
    return sorted(values, reverse=True)[:n]
""",
    ),
    (
        "Crie uma classe Python Counter simples com increment e value.",
        """
class Counter:
    def __init__(self):
        self._value = 0

    def increment(self, amount=1):
        self._value += amount
        return self._value

    @property
    def value(self):
        return self._value
""",
    ),
    (
        "Crie uma dataclass Python Produto com metodo subtotal.",
        """
from dataclasses import dataclass


@dataclass
class Produto:
    nome: str
    preco: float
    quantidade: int = 1

    def subtotal(self):
        return self.preco * self.quantidade
""",
    ),
    (
        "Crie uma funcao Python validar_senha(senha) que exige 8 caracteres e numero.",
        """
def validar_senha(senha):
    if len(senha) < 8:
        return False
    return any(char.isdigit() for char in senha)
""",
    ),
    (
        "Crie uma funcao Python resumir_texto(texto, limite=80).",
        """
def resumir_texto(texto, limite=80):
    texto = texto.strip()
    if len(texto) <= limite:
        return texto
    suffix = " [cortado]"
    return texto[: limite - len(suffix)].rstrip() + suffix
""",
    ),
    (
        "Crie uma funcao Python contar_por_categoria(items).",
        """
def contar_por_categoria(items):
    counts = {}
    for item in items:
        category = item.get("categoria", "sem_categoria")
        counts[category] = counts.get(category, 0) + 1
    return counts
""",
    ),
    (
        "Crie uma funcao Python mesclar_defaults(data, defaults).",
        """
def mesclar_defaults(data, defaults):
    merged = dict(defaults)
    merged.update(data)
    return merged
""",
    ),
    (
        "Crie uma funcao Python trocar_extensao(path, nova_extensao).",
        """
from pathlib import Path


def trocar_extensao(path, nova_extensao):
    ext = nova_extensao if nova_extensao.startswith(".") else f".{nova_extensao}"
    return str(Path(path).with_suffix(ext))
""",
    ),
    (
        "Crie uma funcao Python ler_json_seguro(texto) que retorna dict vazio se falhar.",
        """
import json


def ler_json_seguro(texto):
    try:
        data = json.loads(texto)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}
""",
    ),
    (
        "Crie uma funcao Python gerar_slug_unico(titulo, existentes).",
        """
def gerar_slug_unico(titulo, existentes):
    base = titulo.strip().lower().replace(" ", "-")
    slug = base
    counter = 2
    while slug in existentes:
        slug = f"{base}-{counter}"
        counter += 1
    return slug
""",
    ),
    (
        "Crie uma funcao Python status_http_ok(status_code).",
        """
def status_http_ok(status_code):
    return 200 <= int(status_code) < 300
""",
    ),
    (
        "Crie uma funcao Python converter_boolean(value).",
        """
def converter_boolean(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "sim", "yes", "on"}
    return bool(value)
""",
    ),
    (
        "Crie uma funcao Python remover_duplicados_por_id(items).",
        """
def remover_duplicados_por_id(items):
    seen = set()
    result = []
    for item in items:
        item_id = item.get("id")
        if item_id not in seen:
            seen.add(item_id)
            result.append(item)
    return result
""",
    ),
    (
        "Crie uma funcao Python validar_payload_obrigatorio(data, campos).",
        """
def validar_payload_obrigatorio(data, campos):
    missing = []
    for campo in campos:
        if data.get(campo) in (None, ""):
            missing.append(campo)
    return missing
""",
    ),
    (
        "Crie uma funcao Python calcular_progresso(concluidas, total).",
        """
def calcular_progresso(concluidas, total):
    if total <= 0:
        return 0.0
    return round((concluidas / total) * 100, 2)
""",
    ),
    (
        "Crie uma funcao Python compactar_espacos(texto).",
        """
def compactar_espacos(texto):
    return " ".join(texto.split())
""",
    ),
    (
        "Crie uma funcao Python mapear_ids(items).",
        """
def mapear_ids(items):
    return {item["id"]: item for item in items if "id" in item}
""",
    ),
    (
        "Crie uma funcao Python dentro_do_intervalo(value, start, end).",
        """
def dentro_do_intervalo(value, start, end):
    return start <= value <= end
""",
    ),
    (
        "Crie uma funcao Python gerar_iniciais(nome).",
        """
def gerar_iniciais(nome):
    parts = [part for part in nome.split() if part]
    return "".join(part[0].upper() for part in parts[:2])
""",
    ),
    (
        "Crie uma funcao Python somar_por_chave(items, chave).",
        """
def somar_por_chave(items, chave):
    total = 0
    for item in items:
        total += item.get(chave, 0)
    return total
""",
    ),
    (
        "Crie uma funcao Python dividir_em_linhas(texto).",
        """
def dividir_em_linhas(texto):
    return [line.strip() for line in texto.splitlines() if line.strip()]
""",
    ),
    (
        "Crie uma funcao Python tem_extensao_permitida(nome, permitidas).",
        """
from pathlib import Path


def tem_extensao_permitida(nome, permitidas):
    return Path(nome).suffix.lower() in {ext.lower() for ext in permitidas}
""",
    ),
    (
        "Crie uma funcao Python calcular_pontos(task).",
        """
def calcular_pontos(task):
    priority = task.get("priority", "medium")
    mapping = {"low": 1, "medium": 3, "high": 5, "critical": 8}
    return mapping.get(priority, 3)
""",
    ),
    (
        "Crie uma funcao Python normalizar_status(status).",
        """
def normalizar_status(status):
    value = status.strip().lower().replace(" ", "_")
    allowed = {"todo", "in_progress", "review", "done"}
    return value if value in allowed else "todo"
""",
    ),
    (
        "Crie uma funcao Python safe_divide_many(values, divisor).",
        """
def safe_divide_many(values, divisor):
    if divisor == 0:
        raise ValueError("divisor nao pode ser zero")
    return [value / divisor for value in values]
""",
    ),
    (
        "Crie uma funcao Python buscar_por_email(users, email).",
        """
def buscar_por_email(users, email):
    target = email.strip().lower()
    for user in users:
        if user.get("email", "").strip().lower() == target:
            return user
    return None
""",
    ),
    (
        "Crie uma funcao Python calcular_media_por_chave(items, chave).",
        """
def calcular_media_por_chave(items, chave):
    values = [item.get(chave, 0) for item in items]
    if not values:
        return 0.0
    return sum(values) / len(values)
""",
    ),
    (
        "Crie uma funcao Python validar_intervalo_data(inicio, fim).",
        """
def validar_intervalo_data(inicio, fim):
    if inicio is None or fim is None:
        return False
    return inicio <= fim
""",
    ),
    (
        "Crie uma funcao Python limitar_texto_por_palavras(texto, limite).",
        """
def limitar_texto_por_palavras(texto, limite):
    if limite <= 0:
        return ""
    palavras = texto.split()
    return " ".join(palavras[:limite])
""",
    ),
]


FLASK_SNIPPETS = [
    (
        "Crie uma API Flask minima com rota GET /health. Responda somente com codigo.",
        """
from flask import Flask, jsonify

app = Flask(__name__)


@app.get("/health")
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    app.run(debug=True)
""",
    ),
    (
        "Crie uma API Flask com rota GET /api/v1/ping que retorna pong.",
        """
from flask import Flask, jsonify

app = Flask(__name__)


@app.get("/api/v1/ping")
def ping():
    return jsonify({"message": "pong"}), 200


if __name__ == "__main__":
    app.run(debug=True)
""",
    ),
    (
        "Crie uma rota Flask POST /api/v1/customers que valida nome e email.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)
customers = []


@app.post("/api/v1/customers")
def create_customer():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()

    if not name or "@" not in email:
        return jsonify({"error": "name and valid email are required"}), 400

    customer = {"id": len(customers) + 1, "name": name, "email": email}
    customers.append(customer)
    return jsonify(customer), 201
""",
    ),
    (
        "Crie uma rota Flask GET /api/v1/customers que lista clientes em memoria.",
        """
from flask import Flask, jsonify

app = Flask(__name__)
customers = [
    {"id": 1, "name": "Ana", "email": "ana@example.com"},
    {"id": 2, "name": "Bruno", "email": "bruno@example.com"},
]


@app.get("/api/v1/customers")
def list_customers():
    return jsonify({"items": customers, "total": len(customers)}), 200
""",
    ),
    (
        "Crie uma rota Flask GET /api/v1/customers/<int:customer_id>.",
        """
from flask import Flask, jsonify

app = Flask(__name__)
customers = [{"id": 1, "name": "Ana"}]


@app.get("/api/v1/customers/<int:customer_id>")
def get_customer(customer_id):
    for customer in customers:
        if customer["id"] == customer_id:
            return jsonify(customer), 200
    return jsonify({"error": "customer not found"}), 404
""",
    ),
    (
        "Crie uma rota Flask PATCH /api/v1/tasks/<int:task_id> para alterar status.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)
tasks = [{"id": 1, "title": "Deploy", "status": "todo"}]


@app.patch("/api/v1/tasks/<int:task_id>")
def update_task_status(task_id):
    data = request.get_json(silent=True) or {}
    status = str(data.get("status", "")).strip()
    if status not in {"todo", "in_progress", "done"}:
        return jsonify({"error": "invalid status"}), 400

    for task in tasks:
        if task["id"] == task_id:
            task["status"] = status
            return jsonify(task), 200
    return jsonify({"error": "task not found"}), 404
""",
    ),
    (
        "Crie uma rota Flask DELETE /api/v1/tasks/<int:task_id>.",
        """
from flask import Flask, jsonify

app = Flask(__name__)
tasks = [{"id": 1, "title": "Deploy"}]


@app.delete("/api/v1/tasks/<int:task_id>")
def delete_task(task_id):
    for index, task in enumerate(tasks):
        if task["id"] == task_id:
            removed = tasks.pop(index)
            return jsonify({"deleted": removed["id"]}), 200
    return jsonify({"error": "task not found"}), 404
""",
    ),
    (
        "Crie uma rota Flask GET /api/v1/products com filtro q por query string.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)
products = [
    {"id": 1, "name": "Notebook"},
    {"id": 2, "name": "Mouse"},
]


@app.get("/api/v1/products")
def list_products():
    query = request.args.get("q", "").strip().lower()
    result = products
    if query:
        result = [product for product in products if query in product["name"].lower()]
    return jsonify({"items": result, "total": len(result)}), 200
""",
    ),
    (
        "Crie uma rota Flask POST /api/v1/login com validacao simples.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)


@app.post("/api/v1/login")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if email != "admin@example.com" or password != "secret123":
        return jsonify({"error": "invalid credentials"}), 401

    return jsonify({"token": "dev-token", "user": {"email": email}}), 200
""",
    ),
    (
        "Crie uma rota Flask POST /api/v1/echo que exige JSON.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)


@app.post("/api/v1/echo")
def echo():
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json"}), 415
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "invalid json"}), 400
    return jsonify({"received": data}), 200
""",
    ),
    (
        "Crie uma rota Flask GET /api/v1/tasks com paginacao page e per_page.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)
tasks = [{"id": index, "title": f"Task {index}"} for index in range(1, 26)]


@app.get("/api/v1/tasks")
def list_tasks():
    page = max(1, request.args.get("page", 1, type=int))
    per_page = max(1, request.args.get("per_page", 10, type=int))
    start = (page - 1) * per_page
    end = start + per_page
    return jsonify({"items": tasks[start:end], "total": len(tasks), "page": page}), 200
""",
    ),
    (
        "Crie uma rota Flask POST /api/v1/notes que valida titulo.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)
notes = []


@app.post("/api/v1/notes")
def create_note():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    body = str(data.get("body", "")).strip()
    if len(title) < 3:
        return jsonify({"error": "title must have at least 3 characters"}), 400
    note = {"id": len(notes) + 1, "title": title, "body": body}
    notes.append(note)
    return jsonify(note), 201
""",
    ),
    (
        "Crie uma rota Flask GET /api/v1/stats que retorna metricas simples.",
        """
from flask import Flask, jsonify

app = Flask(__name__)
tasks = [{"status": "done"}, {"status": "todo"}, {"status": "done"}]


@app.get("/api/v1/stats")
def stats():
    done = sum(1 for task in tasks if task["status"] == "done")
    return jsonify({"total": len(tasks), "done": done, "open": len(tasks) - done}), 200
""",
    ),
    (
        "Crie uma rota Flask POST /api/v1/contact que valida nome, email e mensagem.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)


@app.post("/api/v1/contact")
def contact():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip()
    message = str(data.get("message", "")).strip()

    if not name or "@" not in email or len(message) < 10:
        return jsonify({"error": "name, valid email and message are required"}), 400

    return jsonify({"status": "received"}), 201
""",
    ),
    (
        "Crie uma rota Flask GET /api/v1/config que retorna configuracao publica.",
        """
from flask import Flask, jsonify

app = Flask(__name__)


@app.get("/api/v1/config")
def public_config():
    return jsonify({"app_name": "NexusAI", "environment": "development"}), 200
""",
    ),
    (
        "Crie uma rota Flask POST /api/v1/orders que calcula total.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)


@app.post("/api/v1/orders")
def create_order():
    data = request.get_json(silent=True) or {}
    items = data.get("items", [])
    if not isinstance(items, list) or not items:
        return jsonify({"error": "items must be a non-empty list"}), 400

    total = 0.0
    for item in items:
        total += float(item.get("price", 0)) * int(item.get("quantity", 1))

    return jsonify({"total": round(total, 2)}), 201
""",
    ),
    (
        "Crie uma rota Flask POST /api/v1/tags que normaliza lista de tags.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)


@app.post("/api/v1/tags")
def normalize_tags():
    data = request.get_json(silent=True) or {}
    tags = data.get("tags", [])
    if not isinstance(tags, list):
        return jsonify({"error": "tags must be a list"}), 400
    clean = sorted({str(tag).strip().lower() for tag in tags if str(tag).strip()})
    return jsonify({"tags": clean}), 200
""",
    ),
    (
        "Crie uma rota Flask POST /api/v1/password/check que valida forca minima.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)


@app.post("/api/v1/password/check")
def check_password():
    data = request.get_json(silent=True) or {}
    password = str(data.get("password", ""))
    ok = len(password) >= 8 and any(char.isdigit() for char in password)
    return jsonify({"valid": ok}), 200
""",
    ),
    (
        "Crie uma rota Flask GET /api/v1/users/<int:user_id>/profile.",
        """
from flask import Flask, jsonify

app = Flask(__name__)
users = [{"id": 1, "name": "Ana", "role": "admin"}]


@app.get("/api/v1/users/<int:user_id>/profile")
def user_profile(user_id):
    for user in users:
        if user["id"] == user_id:
            return jsonify(user), 200
    return jsonify({"error": "user not found"}), 404
""",
    ),
    (
        "Crie uma rota Flask GET /api/v1/search que exige parametro q.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)


@app.get("/api/v1/search")
def search():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "q is required"}), 400
    return jsonify({"query": query, "items": []}), 200
""",
    ),
    (
        "Crie uma rota Flask POST /api/v1/files/metadata que valida nome e tamanho.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)


@app.post("/api/v1/files/metadata")
def file_metadata():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    size = int(data.get("size", 0))
    if not name or size <= 0:
        return jsonify({"error": "valid name and size are required"}), 400
    return jsonify({"name": name, "size": size}), 201
""",
    ),
    (
        "Crie uma rota Flask GET /api/v1/ready que retorna ready true.",
        """
from flask import Flask, jsonify

app = Flask(__name__)


@app.get("/api/v1/ready")
def ready():
    return jsonify({"ready": True}), 200
""",
    ),
    (
        "Crie uma rota Flask POST /api/v1/feedback que valida nota de 1 a 5.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)


@app.post("/api/v1/feedback")
def feedback():
    data = request.get_json(silent=True) or {}
    rating = int(data.get("rating", 0))
    comment = str(data.get("comment", "")).strip()
    if rating < 1 or rating > 5:
        return jsonify({"error": "rating must be between 1 and 5"}), 400
    return jsonify({"rating": rating, "comment": comment}), 201
""",
    ),
    (
        "Crie uma rota Flask POST /api/v1/newsletter para cadastrar email.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)
subscribers = set()


@app.post("/api/v1/newsletter")
def subscribe():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    if "@" not in email:
        return jsonify({"error": "valid email is required"}), 400
    subscribers.add(email)
    return jsonify({"email": email, "subscribed": True}), 201
""",
    ),
    (
        "Crie uma rota Flask GET /api/v1/inventory/low-stock.",
        """
from flask import Flask, jsonify

app = Flask(__name__)
inventory = [
    {"sku": "A1", "name": "Teclado", "quantity": 2},
    {"sku": "B2", "name": "Mouse", "quantity": 12},
]


@app.get("/api/v1/inventory/low-stock")
def low_stock():
    items = [item for item in inventory if item["quantity"] <= 5]
    return jsonify({"items": items, "total": len(items)}), 200
""",
    ),
    (
        "Crie uma rota Flask PATCH /api/v1/settings/theme.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)
settings = {"theme": "light"}


@app.patch("/api/v1/settings/theme")
def update_theme():
    data = request.get_json(silent=True) or {}
    theme = str(data.get("theme", "")).strip()
    if theme not in {"light", "dark"}:
        return jsonify({"error": "theme must be light or dark"}), 400
    settings["theme"] = theme
    return jsonify(settings), 200
""",
    ),
    (
        "Crie uma rota Flask GET /api/v1/audit que retorna eventos recentes.",
        """
from flask import Flask, jsonify

app = Flask(__name__)
audit_events = [
    {"id": 1, "event": "login"},
    {"id": 2, "event": "task.created"},
]


@app.get("/api/v1/audit")
def audit():
    return jsonify({"items": audit_events[-10:], "total": len(audit_events)}), 200
""",
    ),
    (
        "Crie uma rota Flask POST /api/v1/math/sum que soma numeros enviados em JSON.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)


@app.post("/api/v1/math/sum")
def sum_numbers():
    data = request.get_json(silent=True) or {}
    numbers = data.get("numbers", [])
    if not isinstance(numbers, list):
        return jsonify({"error": "numbers must be a list"}), 400
    total = sum(float(number) for number in numbers)
    return jsonify({"total": total}), 200
""",
    ),
    (
        "Crie uma rota Flask POST /api/v1/webhook/test que valida secret.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)
WEBHOOK_SECRET = "dev-secret"


@app.post("/api/v1/webhook/test")
def webhook_test():
    secret = request.headers.get("X-Webhook-Secret", "")
    if secret != WEBHOOK_SECRET:
        return jsonify({"error": "invalid secret"}), 403
    payload = request.get_json(silent=True) or {}
    return jsonify({"received": payload}), 200
""",
    ),
    (
        "Crie uma rota Flask GET /api/v1/projects/<int:project_id>/tasks.",
        """
from flask import Flask, jsonify

app = Flask(__name__)
tasks = [
    {"id": 1, "project_id": 10, "title": "Setup"},
    {"id": 2, "project_id": 20, "title": "Deploy"},
]


@app.get("/api/v1/projects/<int:project_id>/tasks")
def project_tasks(project_id):
    items = [task for task in tasks if task["project_id"] == project_id]
    return jsonify({"items": items, "total": len(items)}), 200
""",
    ),
    (
        "Crie uma rota Flask GET /api/v1/time que retorna timestamp ISO.",
        """
from datetime import datetime, timezone
from flask import Flask, jsonify

app = Flask(__name__)


@app.get("/api/v1/time")
def current_time():
    return jsonify({"timestamp": datetime.now(timezone.utc).isoformat()}), 200
""",
    ),
    (
        "Crie uma rota Flask POST /api/v1/validate/email que retorna valid boolean.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)


@app.post("/api/v1/validate/email")
def validate_email():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip()
    valid = "@" in email and "." in email.rsplit("@", 1)[-1]
    return jsonify({"valid": valid}), 200
""",
    ),
    (
        "Crie uma rota Flask GET /api/v1/version que retorna versao da API.",
        """
from flask import Flask, jsonify

app = Flask(__name__)


@app.get("/api/v1/version")
def version():
    return jsonify({"version": "1.0.0"}), 200
""",
    ),
    (
        "Crie uma rota Flask GET /api/v1/tasks/done que lista tarefas concluidas.",
        """
from flask import Flask, jsonify

app = Flask(__name__)
tasks = [
    {"id": 1, "title": "Setup", "status": "done"},
    {"id": 2, "title": "Deploy", "status": "todo"},
]


@app.get("/api/v1/tasks/done")
def done_tasks():
    items = [task for task in tasks if task["status"] == "done"]
    return jsonify({"items": items, "total": len(items)}), 200
""",
    ),
    (
        "Crie uma rota Flask POST /api/v1/uppercase que converte texto para maiusculo.",
        """
from flask import Flask, jsonify, request

app = Flask(__name__)


@app.post("/api/v1/uppercase")
def uppercase():
    data = request.get_json(silent=True) or {}
    text = str(data.get("text", ""))
    return jsonify({"text": text.upper()}), 200
""",
    ),
    (
        "Crie uma rota Flask GET /api/v1/products/<int:product_id>/price.",
        """
from flask import Flask, jsonify

app = Flask(__name__)
products = [{"id": 1, "name": "Plano Pro", "price": 49.9}]


@app.get("/api/v1/products/<int:product_id>/price")
def product_price(product_id):
    for product in products:
        if product["id"] == product_id:
            return jsonify({"price": product["price"]}), 200
    return jsonify({"error": "product not found"}), 404
""",
    ),
    (
        "Crie uma rota Flask POST /api/v1/session/logout que retorna sucesso.",
        """
from flask import Flask, jsonify

app = Flask(__name__)


@app.post("/api/v1/session/logout")
def logout():
    return jsonify({"ok": True, "message": "logged out"}), 200
""",
    ),
]


def build_pairs() -> list[dict]:
    pairs = []
    for index, (instruction, code) in enumerate(PYTHON_SNIPPETS, start=1):
        pairs.append(
            {
                "source": f"gold_batch_001_python_flask.md#python-{index:03d}",
                "kind": "python",
                "instruction": instruction.strip(),
                "response": code_block("python", code),
                "issues": [],
            }
        )
    for index, (instruction, code) in enumerate(FLASK_SNIPPETS, start=1):
        pairs.append(
            {
                "source": f"gold_batch_001_python_flask.md#flask-{index:03d}",
                "kind": "python",
                "instruction": instruction.strip(),
                "response": code_block("python", code),
                "issues": [],
            }
        )
    return pairs


def extract_code(response: str) -> str:
    if response.startswith("```python\n") and response.endswith("\n```"):
        return response[len("```python\n") : -len("\n```")]
    raise ValueError("response is not a python code fence")


def validate_pairs(pairs: list[dict]) -> None:
    seen = set()
    for pair in pairs:
        key = pair["instruction"]
        if key in seen:
            raise ValueError(f"duplicate instruction: {key}")
        seen.add(key)
        if pair["issues"]:
            raise ValueError(f"pair has issues: {pair['source']}")
        code = extract_code(pair["response"])
        ast.parse(code)
        if "..." in code:
            raise ValueError(f"ellipsis found in {pair['source']}")
        if "<sample>" in code or "</sample>" in code:
            raise ValueError(f"training marker found in {pair['source']}")


def write_markdown(pairs: list[dict]) -> None:
    lines = [
        "quality: gold",
        "",
        "# Gold Batch 001 - Python and Flask",
        "",
        "Curated short Instruction/Response pairs for behavior fine-tuning.",
        "",
    ]
    for index, pair in enumerate(pairs, start=1):
        lines.extend(
            [
                f"## Pair {index:03d}",
                "",
                "### Instruction:",
                pair["instruction"],
                "",
                "### Response:",
                pair["response"],
                "",
            ]
        )
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")


def write_jsonl(pairs: list[dict]) -> None:
    with OUT_JSONL.open("w", encoding="utf-8") as f:
        for pair in pairs:
            f.write(json.dumps(pair, ensure_ascii=False) + "\n")


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    pairs = build_pairs()
    validate_pairs(pairs)
    write_markdown(pairs)
    write_jsonl(pairs)
    print(f"Generated {len(pairs)} pairs")
    print(f"Markdown: {OUT_MD}")
    print(f"JSONL: {OUT_JSONL}")


if __name__ == "__main__":
    main()
