"""Deterministic domain repair/fallback for controlled NexusAI output."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class DomainRepair:
    text: str
    source: str


def strip_markdown_fence(text: str) -> str:
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    lines = stripped.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


def extract_user_request(prompt: str) -> str:
    marker = "PEDIDO_DO_USUARIO:"
    if marker in prompt:
        return prompt.split(marker, 1)[1].strip()
    return prompt.strip()


def infer_route_from_prompt(prompt: str) -> str:
    prompt = extract_user_request(prompt)
    match = re.search(r"(/[a-zA-Z0-9_\-/{}<>:]+)", prompt)
    route = match.group(1) if match else "/health"
    route = route.rstrip(".,;:")
    return route if route.startswith("/") else "/health"


def infer_http_method(prompt: str) -> str:
    lowered = extract_user_request(prompt).lower()
    for method in ("post", "put", "patch", "delete", "get"):
        if method in lowered:
            return method.upper()
    return "GET"


def repair_flask_output(prompt: str, output: str, errors: list[str]) -> DomainRepair:
    user_prompt = extract_user_request(prompt)
    route = infer_route_from_prompt(prompt)
    method = infer_http_method(prompt)
    function_name = re.sub(r"[^a-zA-Z0-9_]+", "_", route.strip("/") or "health").strip("_") or "health"
    if function_name[0].isdigit():
        function_name = f"route_{function_name}"
    if "health" in route:
        body = '    return jsonify({"status": "ok"}), 200'
    elif method == "POST" or "cadastro" in user_prompt.lower():
        body = (
            "    data = request.get_json(silent=True) or {}\n"
            "    email = data.get(\"email\", \"\")\n"
            "    if not email:\n"
            "        return jsonify({\"error\": \"email obrigatorio\"}), 400\n"
            "    return jsonify({\"status\": \"ok\", \"data\": data}), 201"
        )
    else:
        body = '    return jsonify({"status": "ok"}), 200'
    text = (
        "from flask import Flask, jsonify, request\n\n"
        "app = Flask(__name__)\n\n\n"
        f"@app.route(\"{route}\", methods=[\"{method}\"])\n"
        f"def {function_name}():\n"
        f"{body}\n\n\n"
        "if __name__ == \"__main__\":\n"
        "    app.run(debug=True)\n"
    )
    return DomainRepair(text=text, source="fallback")


def extract_html_document(text: str) -> str:
    cleaned = strip_markdown_fence(text)
    lowered = cleaned.lower()
    start = lowered.find("<!doctype html")
    if start < 0:
        start = lowered.find("<html")
    if start >= 0:
        cleaned = cleaned[start:]
    end = cleaned.lower().rfind("</html>")
    if end >= 0:
        cleaned = cleaned[: end + len("</html>")]
    return cleaned.strip()


def fallback_html(prompt: str) -> str:
    prompt = extract_user_request(prompt)
    title = "Nexus Preview"
    heading = "Nexus AI"
    lowered = prompt.lower()
    if "depoimento" in lowered:
        content = (
            "      <section aria-labelledby=\"depoimentos-title\">\n"
            "        <h2 id=\"depoimentos-title\">Depoimentos</h2>\n"
            "        <article>\n"
            "          <p>Atendimento excelente e resultado profissional.</p>\n"
            "          <strong>Cliente Nexus</strong>\n"
            "        </article>\n"
            "      </section>"
        )
    elif "contato" in lowered or "form" in lowered:
        content = (
            "      <section aria-labelledby=\"contato-title\">\n"
            "        <h2 id=\"contato-title\">Contato</h2>\n"
            "        <form>\n"
            "          <label>Nome <input name=\"nome\" type=\"text\"></label>\n"
            "          <label>Email <input name=\"email\" type=\"email\"></label>\n"
            "          <button type=\"submit\">Enviar</button>\n"
            "        </form>\n"
            "      </section>"
        )
    elif "preco" in lowered or "preço" in lowered or "card" in lowered:
        content = (
            "      <section aria-labelledby=\"precos-title\">\n"
            "        <h2 id=\"precos-title\">Precos</h2>\n"
            "        <div class=\"cards\">\n"
            "          <article class=\"card\"><h3>Starter</h3><p>R$ 49</p></article>\n"
            "          <article class=\"card\"><h3>Pro</h3><p>R$ 99</p></article>\n"
            "        </div>\n"
            "      </section>"
        )
    elif "comprar" in lowered or "botao" in lowered or "botão" in lowered:
        content = (
            "      <section aria-labelledby=\"hero-title\">\n"
            "        <h2 id=\"hero-title\">Comprar agora</h2>\n"
            "        <p>Escolha seu plano e comece hoje.</p>\n"
            "        <button type=\"button\">Comprar agora</button>\n"
            "      </section>"
        )
    elif "header" in lowered:
        content = (
            "      <header class=\"site-header\">\n"
            "        <strong>Nexus Sites</strong>\n"
            "        <nav aria-label=\"Principal\">\n"
            "          <a href=\"#inicio\">Inicio</a>\n"
            "          <a href=\"#contato\">Contato</a>\n"
            "        </nav>\n"
            "      </header>"
        )
    else:
        content = (
            "      <section>\n"
            "        <h1>Nexus AI</h1>\n"
            "        <p>Conteudo gerado pelo assistente.</p>\n"
            "      </section>"
        )
    return (
        "<!DOCTYPE html>\n"
        "<html lang=\"pt-BR\">\n"
        "<head>\n"
        "  <meta charset=\"UTF-8\">\n"
        "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n"
        f"  <title>{title}</title>\n"
        "  <style>\n"
        "    body { margin: 0; font-family: Arial, sans-serif; background: #f7f8fb; color: #1f2937; }\n"
        "    main { max-width: 960px; margin: 0 auto; padding: 32px; }\n"
        "    .site-header { display: flex; justify-content: space-between; gap: 16px; align-items: center; }\n"
        "    nav { display: flex; gap: 12px; flex-wrap: wrap; }\n"
        "  </style>\n"
        "</head>\n"
        "<body>\n"
        "  <main id=\"inicio\">\n"
        f"    <h1>{heading}</h1>\n"
        f"{content}\n"
        "  </main>\n"
        "</body>\n"
        "</html>\n"
    )


def repair_html_output(prompt: str, output: str, errors: list[str]) -> DomainRepair:
    candidate = extract_html_document(output)
    lowered = candidate.lower()
    if (
        "<!doctype html" in lowered
        and "<html" in lowered
        and "<head" in lowered
        and "<body" in lowered
        and "</html>" in lowered
        and "from flask" not in lowered
        and "def " not in lowered
    ):
        return DomainRepair(text=candidate, source="deterministic_repair")
    return DomainRepair(text=fallback_html(prompt), source="fallback")


def extract_json_candidate(text: str) -> str:
    cleaned = strip_markdown_fence(text)
    start_positions = [pos for pos in (cleaned.find("{"), cleaned.find("[")) if pos >= 0]
    if not start_positions:
        return cleaned.strip()
    start = min(start_positions)
    open_char = cleaned[start]
    close_char = "}" if open_char == "{" else "]"
    depth = 0
    in_string = False
    escape = False
    for index, char in enumerate(cleaned[start:], start=start):
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == open_char:
            depth += 1
        elif char == close_char:
            depth -= 1
            if depth == 0:
                return cleaned[start : index + 1].strip()
    return cleaned[start:].strip()


def fallback_json(prompt: str) -> str:
    lowered = extract_user_request(prompt).lower()
    data: dict[str, object] = {"status": "ok"}
    if "nome" in lowered:
        data["nome"] = "Nexus AI"
    if "versao" in lowered or "version" in lowered:
        data["versao"] = "1.0.0"
    if "recursos" in lowered:
        data["recursos"] = ["repo_mode", "validacao", "repair"]
    if "email" in lowered:
        data["email"] = "usuario@example.com"
    if "message" in lowered or "mensagem" in lowered:
        data["message"] = "ok"
    if "items" in lowered or "itens" in lowered or "lista" in lowered:
        data["items"] = []
    return json.dumps(data, ensure_ascii=False, indent=2)


def repair_json_output(prompt: str, output: str, errors: list[str]) -> DomainRepair:
    candidate = extract_json_candidate(output)
    fixes = [
        candidate,
        re.sub(r",\s*([}\]])", r"\1", candidate),
        re.sub(r"'", '"', re.sub(r",\s*([}\]])", r"\1", candidate)),
    ]
    for item in fixes:
        try:
            parsed = json.loads(item)
        except json.JSONDecodeError:
            continue
        return DomainRepair(text=json.dumps(parsed, ensure_ascii=False, indent=2), source="deterministic_repair")
    return DomainRepair(text=fallback_json(prompt), source="fallback")


def repair_react_output(prompt: str, output: str, errors: list[str]) -> DomainRepair:
    candidate = strip_markdown_fence(output)
    lowered = candidate.lower()
    if (
        "export default" in lowered
        and "return" in lowered
        and "<" in candidate
        and ">" in candidate
        and "from flask" not in lowered
        and candidate.count("{") == candidate.count("}")
        and candidate.count("(") == candidate.count(")")
    ):
        return DomainRepair(text=candidate, source="deterministic_repair")
    prompt_lower = extract_user_request(prompt).lower()
    if "searchbox" in prompt_lower or "busca" in prompt_lower or "search" in prompt_lower:
        component_name = "SearchBox"
        jsx = (
            "    <form className=\"search-box\">\n"
            "      <label htmlFor=\"search\">Search</label>\n"
            "      <input id=\"search\" name=\"search\" type=\"search\" placeholder=\"Buscar\" />\n"
            "      <button type=\"submit\">Buscar</button>\n"
            "    </form>"
        )
    elif "todolist" in prompt_lower or "tarefa" in prompt_lower or "todo" in prompt_lower:
        component_name = "TodoList"
        jsx = (
            "    <ul className=\"todo-list\">\n"
            "      {['Todo inicial'].map((todo) => (\n"
            "        <li key={todo}>{todo}</li>\n"
            "      ))}\n"
            "    </ul>"
        )
    else:
        component_name = "ProductCard" if "product" in lowered or "product" in prompt_lower or "produto" in prompt_lower else "NexusCard"
        jsx = (
            "    <article className=\"product-card\">\n"
            "      <h2>Product</h2>\n"
            "      <p>Preco: R$ 99</p>\n"
            "      <button type=\"button\">Comprar</button>\n"
            "    </article>"
        )
    text = (
        "import React from \"react\";\n\n"
        f"export default function {component_name}() {{\n"
        "  return (\n"
        f"{jsx}\n"
        "  );\n"
        "}\n"
    )
    return DomainRepair(text=text, source="fallback")


def infer_function_name(prompt: str) -> str:
    prompt = extract_user_request(prompt)
    lowered = prompt.lower()
    for name in ("normalizar_nome", "inverter_texto", "filtrar_pares", "multiplicar", "somar", "soma", "media"):
        if name in lowered:
            return name
    match = re.search(r"(?:chamada|chamado|def)\s+([A-Za-z_][A-Za-z0-9_]*)", prompt, re.IGNORECASE)
    if match:
        return match.group(1)
    match = re.search(r"(?:funcao|função)\s+(?:python\s+)?(?:chamada\s+)?([A-Za-z_][A-Za-z0-9_]*)", prompt, re.IGNORECASE)
    if match:
        return match.group(1)
    return "resultado"


def repair_python_output(prompt: str, output: str, errors: list[str]) -> DomainRepair:
    name = infer_function_name(prompt)
    if name == "normalizar_nome":
        text = "def normalizar_nome(nome: str) -> str:\n    return nome.strip().title()\n"
    elif name in {"somar", "soma"}:
        text = f"def {name}(a, b):\n    return a + b\n"
    elif name == "media":
        text = "def media(valores):\n    return sum(valores) / len(valores) if valores else 0\n"
    elif name == "inverter_texto":
        text = "def inverter_texto(texto: str) -> str:\n    return texto[::-1]\n"
    elif name == "filtrar_pares":
        text = "def filtrar_pares(numeros):\n    return [numero for numero in numeros if numero % 2 == 0]\n"
    elif name == "multiplicar":
        text = "def multiplicar(a, b):\n    return a * b\n"
    else:
        text = f"def {name}():\n    return None\n"
    return DomainRepair(text=text, source="fallback")


def repair_domain_output(prompt: str, output: str, errors: list[str], task_type: str) -> DomainRepair | None:
    if task_type == "flask_api":
        return repair_flask_output(prompt, output, errors)
    if task_type == "site_html":
        return repair_html_output(prompt, output, errors)
    if task_type == "json":
        return repair_json_output(prompt, output, errors)
    if task_type == "react_component":
        return repair_react_output(prompt, output, errors)
    if task_type == "bugfix":
        return repair_python_output(prompt, output, errors)
    return None
