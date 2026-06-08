"""Controlled generation loop: route -> generate -> validate -> repair -> record failure."""

from __future__ import annotations

import argparse
import multiprocessing as mp
import queue
from pathlib import Path

from domain_repair import repair_domain_output
from failure_store import add_failure
from preview_writer import write_html_preview
from semantic_check import check_semantics
from task_router import build_controlled_prompt
from validators import ValidationResult, looks_like_html_task, validate_output


BASE_DIR = Path(__file__).parent
REPAIR_STRATEGIES = {"auto", "deterministic_only", "fast", "full"}
DETERMINISTIC_AUTO_TASK_TYPES = {"json", "site_html"}


class GenerationStepTimeout(TimeoutError):
    """Raised when a model generation step exceeds its timeout."""


def _run_generation_worker(kwargs: dict, result_queue) -> None:
    try:
        from infer import run_generation

        result_queue.put({"ok": True, "text": run_generation(**kwargs)})
    except Exception as exc:
        result_queue.put({"ok": False, "error": f"{type(exc).__name__}: {exc}"})


def run_generation_with_timeout(*, timeout_seconds: int = 0, stage: str, **kwargs) -> str:
    if timeout_seconds <= 0:
        from infer import run_generation

        return run_generation(**kwargs)

    ctx = mp.get_context("spawn")
    result_queue = ctx.Queue()
    process = ctx.Process(target=_run_generation_worker, args=(kwargs, result_queue))
    process.start()
    process.join(timeout_seconds)
    if process.is_alive():
        process.terminate()
        process.join(timeout=3)
        raise GenerationStepTimeout(f"{stage} timed out after {timeout_seconds}s")
    try:
        result = result_queue.get_nowait()
    except queue.Empty as exc:
        raise RuntimeError(f"{stage} produced no result") from exc
    if result.get("ok"):
        return str(result.get("text", ""))
    raise RuntimeError(str(result.get("error", f"{stage} failed")))


def empty_trace() -> dict:
    return {
        "repair_strategy": "",
        "initial_model_output_valid": None,
        "initial_model_semantic_pass": None,
        "model_repair_attempted": False,
        "model_repair_valid": None,
        "model_repair_semantic_pass": None,
        "deterministic_repair_attempted": False,
        "deterministic_repair_valid": None,
        "deterministic_repair_semantic_pass": None,
        "fallback_attempted": False,
        "fallback_valid": None,
        "fallback_semantic_pass": None,
        "final_origin": "",
        "timeout_stage": "",
    }


def resolve_repair_strategy(task_type: str, requested: str) -> str:
    strategy = (requested or "auto").strip().lower()
    if strategy not in REPAIR_STRATEGIES:
        raise ValueError(f"repair_strategy invalida: {requested}. Use: {sorted(REPAIR_STRATEGIES)}")
    if strategy != "auto":
        return strategy
    if task_type in DETERMINISTIC_AUTO_TASK_TYPES:
        return "deterministic_only"
    return "fast"


def apply_domain_repair(
    prompt: str,
    response: str,
    validation: ValidationResult,
    task_type: str,
    semantic_task: dict | None,
    attempts: list[dict],
    trace: dict,
) -> tuple[str, ValidationResult]:
    domain_repair = repair_domain_output(prompt, response, validation.errors, task_type)
    if domain_repair is None:
        return response, validation
    repaired_validation = validate_output(task_type, domain_repair.text, original_prompt=prompt)
    repaired_semantic = semantic_dict(semantic_task, domain_repair.text)
    if domain_repair.source == "deterministic_repair":
        trace["deterministic_repair_attempted"] = True
        trace["deterministic_repair_valid"] = repaired_validation.valid
        trace["deterministic_repair_semantic_pass"] = repaired_semantic.get("semantic_pass") if repaired_semantic else None
    else:
        trace["fallback_attempted"] = True
        trace["fallback_valid"] = repaired_validation.valid
        trace["fallback_semantic_pass"] = repaired_semantic.get("semantic_pass") if repaired_semantic else None
    attempts.append(attempt_record(domain_repair.source, domain_repair.text, repaired_validation, repaired_semantic))
    return domain_repair.text, repaired_validation


def apply_patch_review_fallback(
    prompt: str,
    validation: ValidationResult,
    semantic_task: dict | None,
    attempts: list[dict],
    trace: dict,
) -> tuple[str, ValidationResult]:
    fallback = deterministic_patch_review(prompt, validation.errors)
    fallback_validation = validate_output("patch_review", fallback, original_prompt=prompt)
    fallback_semantic = semantic_dict(semantic_task, fallback)
    trace["fallback_attempted"] = True
    trace["fallback_valid"] = fallback_validation.valid
    trace["fallback_semantic_pass"] = fallback_semantic.get("semantic_pass") if fallback_semantic else None
    attempts.append(attempt_record("fallback", fallback, fallback_validation, fallback_semantic))
    return fallback, fallback_validation


def semantic_dict(semantic_task: dict | None, text: str) -> dict | None:
    if not semantic_task:
        return None
    return check_semantics(semantic_task, text).__dict__


def attempt_record(source: str, response: str, validation: ValidationResult, semantic: dict | None = None, *, timeout: bool = False) -> dict:
    return {
        "response": response,
        "validation": validation.__dict__,
        "semantic": semantic,
        "source": source,
        "timeout": timeout,
    }


def strip_code_fence(text: str) -> str:
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    lines = stripped.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


def repair_prompt(original_prompt: str, bad_response: str, errors: list[str], task_type: str) -> str:
    if task_type == "patch_review":
        return (
            "Repare a resposta de patch review abaixo. Retorne SOMENTE um patch review completo, "
            "sem Markdown decorativo fora das seções e sem placeholder.\n\n"
            "FORMATO OBRIGATÓRIO:\n"
            "Arquivos afetados:\n"
            "- caminho/do/arquivo\n\n"
            "Problema:\n"
            "Uma descrição objetiva.\n\n"
            "Mudança proposta:\n"
            "Explique a alteração e inclua código completo quando a tarefa exigir arquivo completo.\n\n"
            "Risco:\n"
            "Baixo, médio ou alto com justificativa.\n\n"
            "Como testar:\n"
            "Comandos ou validações objetivas.\n\n"
            "REGRAS:\n"
            "- Não use '...'.\n"
            "- Não use TODO.\n"
            "- Não invente arquivo fora do contexto.\n"
            "- Se for landing page HTML, inclua HTML completo com <!DOCTYPE html>, <html>, <head>, <body> e </html>.\n\n"
            f"PEDIDO_ORIGINAL:\n{original_prompt}\n\n"
            f"ERROS_DE_VALIDAÇÃO:\n" + "\n".join(f"- {error}" for error in errors) + "\n\n"
            f"RESPOSTA_RUIM:\n{bad_response}"
        )
    return (
        "Corrija a resposta abaixo mantendo a intenção original. "
        "Retorne apenas a resposta final corrigida.\n\n"
        f"TIPO_DA_TAREFA: {task_type}\n"
        f"PEDIDO_ORIGINAL:\n{original_prompt}\n\n"
        f"ERROS_DE_VALIDAÇÃO:\n" + "\n".join(f"- {error}" for error in errors) + "\n\n"
        f"RESPOSTA_RUIM:\n{bad_response}"
    )


def extract_user_request(prompt: str) -> str:
    marker = "PEDIDO_DO_USUARIO:"
    if marker in prompt:
        return prompt.split(marker, 1)[1].strip()
    return prompt.strip()


def extract_affected_files(prompt: str) -> list[str]:
    files: list[str] = []
    for line in prompt.splitlines():
        if line.startswith("--- FILE: "):
            rel = line.replace("--- FILE: ", "", 1).replace(" ---", "").strip()
            if rel:
                files.append(rel)
    return files[:5] or ["arquivo relevante a confirmar"]


def deterministic_patch_review(original_prompt: str, errors: list[str]) -> str:
    user_request = extract_user_request(original_prompt)
    files = extract_affected_files(original_prompt)
    file_lines = "\n".join(f"- {path}" for path in files)
    risk = "Baixo"
    test = "Rode a validação do projeto pelo modo repo e revise o diff antes de aplicar."
    change = (
        "Criar um patch pequeno e revisável atendendo ao pedido, preservando a estrutura atual do projeto. "
        "Aplicar a mudança apenas nos arquivos listados e validar antes de entregar."
    )
    if looks_like_html_task(original_prompt):
        html = (
            "<!DOCTYPE html>\n"
            "<html lang=\"pt-BR\">\n"
            "<head>\n"
            "  <meta charset=\"UTF-8\">\n"
            "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n"
            "  <title>Landing Page</title>\n"
            "</head>\n"
            "<body>\n"
            "  <main>\n"
            "    <section aria-labelledby=\"depoimentos-title\">\n"
            "      <h2 id=\"depoimentos-title\">Depoimentos</h2>\n"
            "      <article><p>Atendimento excelente e resultado profissional.</p><strong>Cliente Nexus</strong></article>\n"
            "    </section>\n"
            "  </main>\n"
            "</body>\n"
            "</html>"
        )
        change = (
            "Adicionar uma seção de depoimentos na landing page e manter HTML completo e válido.\n\n"
            "```html\n"
            f"{html}\n"
            "```"
        )
        test = "Abrir o HTML no navegador e confirmar que a seção Depoimentos aparece sem quebrar a estrutura."

    return (
        f"Arquivos afetados:\n{file_lines}\n\n"
        f"Problema:\nO pedido precisa de um patch review válido antes de qualquer alteração. Pedido: {user_request}\n\n"
        f"Mudança proposta:\n{change}\n\n"
        f"Risco:\n{risk}. A mudança é localizada e deve ser revisada no diff antes de aplicar.\n\n"
        f"Como testar:\n{test}"
    )


def controlled_generate(
    prompt: str,
    *,
    config: str | Path = BASE_DIR / "config.micro-instruct-fullstack.behavior.json",
    task_type: str | None = None,
    max_retries: int = 1,
    use_memory: bool = True,
    save_preview: bool = False,
    semantic_task: dict | None = None,
    model_timeout_seconds: int = 0,
    repair_timeout_seconds: int = 0,
    repair_strategy: str = "auto",
) -> dict:
    trace = empty_trace()
    controlled_prompt, route = build_controlled_prompt(prompt, task_type)
    strategy = resolve_repair_strategy(route.task_type, repair_strategy)
    trace["repair_strategy"] = strategy
    attempts: list[dict] = []
    response = ""
    first_bad_response = ""
    first_errors: list[str] = []

    if strategy == "deterministic_only":
        validation = ValidationResult(valid=False, errors=["deterministic_only"])
        response, validation = apply_domain_repair(prompt, response, validation, route.task_type, semantic_task, attempts, trace)
        if not validation.valid and route.task_type == "patch_review":
            response, validation = apply_patch_review_fallback(prompt, validation, semantic_task, attempts, trace)
    else:
        try:
            response = run_generation_with_timeout(
                stage="initial_model",
                timeout_seconds=model_timeout_seconds,
                prompt=controlled_prompt,
                max_new_tokens=route.max_new_tokens,
                temperature=0.2,
                top_k=20,
                repetition_penalty=1.25,
                config_path=str(config),
                use_memory=use_memory,
                use_instruction_template=True,
            )
            response = strip_code_fence(response)
            validation = validate_output(route.task_type, response, original_prompt=prompt)
            semantic = semantic_dict(semantic_task, response)
            trace["initial_model_output_valid"] = validation.valid
            trace["initial_model_semantic_pass"] = semantic.get("semantic_pass") if semantic else None
            attempts.append(attempt_record("initial_model", response, validation, semantic))
            first_bad_response = response
            first_errors = list(validation.errors)
        except GenerationStepTimeout:
            trace["timeout_stage"] = "initial_model"
            validation = ValidationResult(valid=False, errors=["provider_timeout"])
            attempts.append(attempt_record("initial_model", "", validation, None, timeout=True))
            trace["initial_model_output_valid"] = False
            first_errors = list(validation.errors)

        if strategy == "full":
            for _ in range(max_retries):
                if validation.valid:
                    break
                retry_prompt = repair_prompt(prompt, response, validation.errors, route.task_type)
                trace["model_repair_attempted"] = True
                try:
                    repaired = run_generation_with_timeout(
                        stage="model_repair",
                        timeout_seconds=repair_timeout_seconds,
                        prompt=retry_prompt,
                        max_new_tokens=route.max_new_tokens,
                        temperature=0.15,
                        top_k=15,
                        repetition_penalty=1.3,
                        config_path=str(config),
                        use_memory=use_memory,
                        use_instruction_template=True,
                    )
                except GenerationStepTimeout:
                    trace["timeout_stage"] = "model_repair"
                    repaired_validation = ValidationResult(valid=False, errors=["repair_timeout"])
                    attempts.append(attempt_record("model_repair", "", repaired_validation, None, timeout=True))
                    validation = repaired_validation
                    break
                repaired = strip_code_fence(repaired)
                repaired_validation = validate_output(route.task_type, repaired, original_prompt=prompt)
                repaired_semantic = semantic_dict(semantic_task, repaired)
                trace["model_repair_valid"] = repaired_validation.valid
                trace["model_repair_semantic_pass"] = repaired_semantic.get("semantic_pass") if repaired_semantic else None
                attempts.append(attempt_record("model_repair", repaired, repaired_validation, repaired_semantic))
                response = repaired
                validation = repaired_validation

        if not validation.valid:
            response, validation = apply_domain_repair(prompt, response, validation, route.task_type, semantic_task, attempts, trace)
        if not validation.valid and route.task_type == "patch_review":
            response, validation = apply_patch_review_fallback(prompt, validation, semantic_task, attempts, trace)

    if first_errors:
        add_failure(
            prompt=prompt,
            bad_response=first_bad_response,
            failure_type="; ".join(first_errors) + f"; final_status={'valid' if validation.valid else 'invalid'}",
            task_type=route.task_type,
            corrected_response=response if validation.valid else "",
        )
    elif not validation.valid:
        add_failure(
            prompt=prompt,
            bad_response=response,
            failure_type="; ".join(validation.errors),
            task_type=route.task_type,
        )

    preview = None
    if save_preview and route.task_type == "site_html" and validation.valid:
        preview = write_html_preview(response, name=prompt)

    if not attempts:
        attempts.append(attempt_record("none", response, validation, None))
    trace["final_origin"] = attempts[-1].get("source", "")
    return {
        "task_type": route.task_type,
        "valid": validation.valid,
        "errors": validation.errors,
        "warnings": validation.warnings,
        "response": response,
        "attempts": attempts,
        "final_source": attempts[-1].get("source", ""),
        "final_origin": trace["final_origin"],
        "trace": trace,
        "preview": preview,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run controlled NexusAI generation.")
    parser.add_argument("prompt")
    parser.add_argument("--config", default=str(BASE_DIR / "config.micro-instruct-fullstack.behavior.json"))
    parser.add_argument("--task_type", default="")
    parser.add_argument("--retries", type=int, default=1)
    parser.add_argument("--no_memory", action="store_true")
    parser.add_argument("--save_preview", action="store_true")
    parser.add_argument("--model_timeout_seconds", type=int, default=0)
    parser.add_argument("--repair_timeout_seconds", type=int, default=0)
    parser.add_argument("--repair_strategy", default="auto", choices=sorted(REPAIR_STRATEGIES))
    args = parser.parse_args()

    result = controlled_generate(
        args.prompt,
        config=args.config,
        task_type=args.task_type or None,
        max_retries=args.retries,
        use_memory=not args.no_memory,
        save_preview=args.save_preview,
        model_timeout_seconds=args.model_timeout_seconds,
        repair_timeout_seconds=args.repair_timeout_seconds,
        repair_strategy=args.repair_strategy,
    )
    print(f"TASK_TYPE: {result['task_type']}")
    print(f"VALID: {result['valid']}")
    if result["errors"]:
        print("ERRORS:")
        for error in result["errors"]:
            print(f"- {error}")
    print("\n--- RESPONSE ---")
    print(result["response"])
    if result.get("preview"):
        print("\n--- PREVIEW ---")
        print(result["preview"])


if __name__ == "__main__":
    main()
