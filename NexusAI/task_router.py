"""Task routing for controlled NexusAI generation."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TaskRoute:
    task_type: str
    prompt_prefix: str
    output_rules: tuple[str, ...]
    max_new_tokens: int = 220


ROUTES = {
    "site_html": TaskRoute(
        task_type="site_html",
        prompt_prefix=(
            "Você é o NexusAI em modo produção controlada para sites. "
            "Gere HTML completo e profissional. Não repita o pedido."
        ),
        output_rules=(
            "Se o usuário pedir HTML puro, retorne apenas o arquivo HTML.",
            "Inclua <!doctype html>, <html>, <head>, <body> e </html>.",
            "Não inclua <sample>, </sample> ou marcadores de treino.",
            "Não misture Python, Flask, React ou TypeScript no HTML.",
        ),
        max_new_tokens=320,
    ),
    "flask_api": TaskRoute(
        task_type="flask_api",
        prompt_prefix=(
            "Você é o NexusAI em modo produção controlada para Flask. "
            "Gere código Python completo, validável e sem placeholders."
        ),
        output_rules=(
            "Inclua imports do Flask.",
            "Inclua app = Flask(__name__).",
            "Inclua rotas completas e respostas JSON.",
            "Inclua if __name__ == \"__main__\" quando for um arquivo executável.",
            "Não misture HTML ou TypeScript.",
        ),
        max_new_tokens=320,
    ),
    "react_component": TaskRoute(
        task_type="react_component",
        prompt_prefix=(
            "Você é o NexusAI em modo produção controlada para React. "
            "Gere um componente React/TSX pequeno, completo e coerente."
        ),
        output_rules=(
            "Inclua imports necessários.",
            "Use estado e tipos quando fizer sentido.",
            "Inclua estado vazio quando houver lista.",
            "Não misture Flask ou HTML puro fora do JSX.",
        ),
        max_new_tokens=300,
    ),
    "electron_app": TaskRoute(
        task_type="electron_app",
        prompt_prefix=(
            "Você é o NexusAI em modo produção controlada para Electron. "
            "Use padrões seguros de desktop app."
        ),
        output_rules=(
            "contextIsolation deve ser true.",
            "nodeIntegration deve ser false.",
            "Use preload separado.",
            "Não exponha execução arbitrária de shell ao renderer.",
        ),
        max_new_tokens=320,
    ),
    "patch_review": TaskRoute(
        task_type="patch_review",
        prompt_prefix=(
            "Você é o NexusAI em modo patch review. "
            "Responda com arquivos afetados, problema, patch proposto, risco e como testar."
        ),
        output_rules=(
            "Não invente conteúdo de arquivo não fornecido.",
            "Se faltar contexto, peça o arquivo necessário.",
            "Inclua diff quando houver before/after suficiente.",
        ),
        max_new_tokens=260,
    ),
    "json": TaskRoute(
        task_type="json",
        prompt_prefix=(
            "Voce e o NexusAI em modo JSON estrito. "
            "Responda somente com JSON valido."
        ),
        output_rules=(
            "Retorne apenas JSON valido, sem Markdown.",
            "Use aspas duplas em chaves e strings.",
            "Nao inclua comentarios, explicacao ou texto fora do JSON.",
            "Nao misture Python, HTML, Flask ou TypeScript.",
        ),
        max_new_tokens=180,
    ),
    "bugfix": TaskRoute(
        task_type="bugfix",
        prompt_prefix=(
            "Você é o NexusAI em modo correção de bug. "
            "Explique o problema em uma frase e forneça a correção mínima."
        ),
        output_rules=(
            "Não faça refatoração não solicitada.",
            "Inclua teste mínimo quando couber.",
            "Se faltar código, peça o trecho necessário.",
        ),
        max_new_tokens=240,
    ),
    "explain_error": TaskRoute(
        task_type="explain_error",
        prompt_prefix=(
            "Você é o NexusAI em modo explicação curta de erro. "
            "Responda em português, direto e prático."
        ),
        output_rules=(
            "Explique a causa provável.",
            "Mostre uma correção curta.",
            "Não gere projeto inteiro.",
        ),
        max_new_tokens=180,
    ),
    "project_question": TaskRoute(
        task_type="project_question",
        prompt_prefix=(
            "Você é o NexusAI em modo pergunta de projeto. "
            "Use memória e contexto quando disponíveis."
        ),
        output_rules=(
            "Se não souber, diga que precisa ler os arquivos.",
            "Não invente estado do projeto.",
        ),
        max_new_tokens=200,
    ),
}


def classify_task(prompt: str) -> str:
    text = prompt.lower()
    if "json" in text:
        return "json"
    if "explique" in text or "porque" in text or "por que" in text:
        return "explain_error"
    if any(term in text for term in ("html", "landing", "site", "página", "pagina", "barbearia", "confeitaria")):
        return "site_html"
    if "flask" in text or "api" in text or "/health" in text or "rota" in text:
        return "flask_api"
    if "electron" in text or "desktop" in text:
        return "electron_app"
    if "react" in text or "componente" in text or "tsx" in text:
        return "react_component"
    if "patch" in text or "diff" in text or "revisável" in text or "revisavel" in text:
        return "patch_review"
    if "corrig" in text or "bug" in text or "erro" in text and "explique" not in text:
        return "bugfix"
    return "project_question"


def build_controlled_prompt(prompt: str, task_type: str | None = None) -> tuple[str, TaskRoute]:
    route = ROUTES[task_type or classify_task(prompt)]
    rules = "\n".join(f"- {rule}" for rule in route.output_rules)
    controlled = (
        f"{route.prompt_prefix}\n\n"
        f"REGRAS DE SAÍDA:\n{rules}\n\n"
        f"PEDIDO DO USUÁRIO:\n{prompt.strip()}"
    )
    return controlled, route
