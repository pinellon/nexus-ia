"""Run the official P0 NexusAI benchmark.

This is the fixed ruler for comparing the 9M baseline, future v2/v3 models,
tokenizers, datasets, and repair loops.
"""

from __future__ import annotations

import argparse
import json
import time
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

try:
    from .failure_classifier import classify_failure, summarize_failure_labels
    from .infer import run_generation
    from .validators.extractor import extract_code, repetition_metrics
    from .validators.flask_validator import validate_flask_code
    from .validators.json_validator import validate_json_code
    from .validators.python_validator import validate_python_code
except ImportError:  # Allows `python NexusAI/run_benchmark_100.py` during local debugging.
    from failure_classifier import classify_failure, summarize_failure_labels
    from infer import run_generation
    from validators.extractor import extract_code, repetition_metrics
    from validators.flask_validator import validate_flask_code
    from validators.json_validator import validate_json_code
    from validators.python_validator import validate_python_code


BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
DEFAULT_BENCHMARK = ROOT_DIR / "benchmarks" / "nexus_100.jsonl"
DEFAULT_EXPERIMENTS_DIR = ROOT_DIR / "experiments"

MODEL_CONFIGS = {
    "baseline_9m": BASE_DIR / "config.micro-gold-finetune.json",
    "gold_ft_9m": BASE_DIR / "config.micro-gold-finetune.json",
    "instruct_fullstack_9m": BASE_DIR / "config.micro-instruct-fullstack.infinite.json",
}

PATCH_REVIEW_SECTIONS = (
    "arquivos afetados",
    "problema",
    "risco",
    "como testar",
)


@dataclass
class CaseResult:
    id: str
    domain: str
    task_type: str
    prompt: str
    raw_output: str
    extracted_output: str
    used_code_block: bool
    validation: dict
    failure_labels: list[str]
    instruction_following: float
    repetition: dict
    generation_time_s: float


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSONL at {path}:{line_no}: {exc}") from exc
        item.setdefault("expected_terms", [])
        cases.append(item)
    return cases


def resolve_config(model: str, config: str | None) -> Path:
    if config:
        return Path(config).resolve()
    if model not in MODEL_CONFIGS:
        known = ", ".join(sorted(MODEL_CONFIGS))
        raise ValueError(f"Unknown model alias '{model}'. Known aliases: {known}. Use --config for custom path.")
    return MODEL_CONFIGS[model].resolve()


def domain_for_extraction(case: dict) -> str:
    domain = case.get("domain", "")
    task_type = case.get("task_type", "")
    if domain == "flask":
        return "flask"
    if domain in {"python", "repair"} or task_type == "repair_python":
        return "python"
    if domain == "json":
        return "json"
    if domain == "patch":
        return "patch"
    return "python"


def validate_patch_review(text: str, expected_terms: list[str]) -> dict:
    lowered = text.lower()
    errors: list[str] = []
    for section in PATCH_REVIEW_SECTIONS:
        if section not in lowered and section.replace("ç", "c") not in lowered:
            errors.append(f"missing_patch_section:{section}")
    for term in expected_terms:
        if term.lower() not in lowered:
            errors.append(f"missing_term:{term}")
    if "..." in text:
        errors.append("placeholder_or_marker:...")
    return {"valid": not errors, "errors": errors, "warnings": [], "details": {}}


def validate_case(case: dict, extracted: str) -> dict:
    task_type = case.get("task_type", "")
    expected_terms = case.get("expected_terms", [])
    if task_type == "flask":
        return validate_flask_code(
            extracted,
            expected_route=case.get("expected_route", ""),
            expected_method=case.get("expected_method", ""),
            expected_terms=expected_terms,
        ).to_dict()
    if task_type in {"python", "repair_python"}:
        return validate_python_code(
            extracted,
            expected_function=case.get("expected_function", ""),
            expected_terms=expected_terms,
        ).to_dict()
    if task_type == "json":
        return validate_json_code(extracted, expected_keys=case.get("expected_keys", [])).to_dict()
    if task_type == "patch_review":
        return validate_patch_review(extracted, expected_terms)
    return {"valid": False, "errors": ["unknown_task_type"], "warnings": [], "details": {}}


def instruction_following(case: dict, extracted: str, validation: dict) -> float:
    checks: list[bool] = []
    lowered = extracted.lower()
    for term in case.get("expected_terms", []):
        checks.append(term.lower() in lowered)
    if case.get("expected_function"):
        checks.append(case["expected_function"] in validation.get("details", {}).get("defined_names", []))
    if case.get("expected_route"):
        routes = validation.get("details", {}).get("routes", [])
        checks.append(case["expected_route"] in [route.get("route") for route in routes])
    if case.get("expected_method"):
        routes = validation.get("details", {}).get("routes", [])
        checks.append(case["expected_method"].upper() in [route.get("method") for route in routes])
    if case.get("expected_keys"):
        checks.append(validation.get("valid", False))
    if not checks:
        return 0.0
    return round(sum(1 for item in checks if item) / len(checks), 3)


def generate_for_case(case: dict, *, config_path: Path, args: argparse.Namespace) -> tuple[str, float]:
    if args.dry_run:
        return "", 0.0
    started = time.perf_counter()
    output = run_generation(
        case["prompt"],
        max_new_tokens=args.tokens,
        temperature=args.temperature,
        top_k=args.top_k,
        repetition_penalty=args.repetition_penalty,
        config_path=config_path,
        use_memory=False,
        use_instruction_template=True,
    )
    return output, round(time.perf_counter() - started, 3)


def run_case(case: dict, *, config_path: Path, args: argparse.Namespace) -> CaseResult:
    raw_output, generation_time = generate_for_case(case, config_path=config_path, args=args)
    extracted_info = extract_code(raw_output, domain=domain_for_extraction(case))
    extracted = extracted_info["code"]
    validation = validate_case(case, extracted)
    repetition = repetition_metrics(extracted)
    follow = instruction_following(case, extracted, validation)
    failures = classify_failure(case, extracted, validation, repetition)
    return CaseResult(
        id=case["id"],
        domain=case["domain"],
        task_type=case["task_type"],
        prompt=case["prompt"],
        raw_output=raw_output,
        extracted_output=extracted,
        used_code_block=bool(extracted_info["used_block"]),
        validation=validation,
        failure_labels=failures,
        instruction_following=follow,
        repetition=repetition,
        generation_time_s=generation_time,
    )


def rate(results: list[CaseResult], predicate) -> float:
    if not results:
        return 0.0
    return round(sum(1 for item in results if predicate(item)) / len(results), 3)


def aggregate(results: list[CaseResult]) -> dict:
    by_domain: dict[str, list[CaseResult]] = defaultdict(list)
    for item in results:
        by_domain[item.domain].append(item)
    labels = summarize_failure_labels([asdict(item) for item in results])
    total = len(results)
    valid_python = by_domain.get("python", [])
    valid_flask = by_domain.get("flask", [])
    return {
        "total_prompts": total,
        "valid_python_rate": rate(valid_python, lambda item: item.validation["valid"]),
        "valid_flask_rate": rate(valid_flask, lambda item: item.validation["valid"]),
        "compile_like_rate": rate(results, lambda item: item.validation["valid"]),
        "instruction_following": round(sum(item.instruction_following for item in results) / max(1, total), 3),
        "wrong_domain_rate": rate(results, lambda item: "wrong_domain" in item.failure_labels),
        "syntax_error_rate": rate(results, lambda item: "syntax_error" in item.failure_labels),
        "json_error_rate": rate(results, lambda item: "json_error" in item.failure_labels),
        "route_error_rate": rate(results, lambda item: "route_error" in item.failure_labels),
        "method_error_rate": rate(results, lambda item: "method_error" in item.failure_labels),
        "repetition_score": round(sum(item.repetition.get("score", 0.0) for item in results) / max(1, total), 3),
        "avg_generation_time": round(sum(item.generation_time_s for item in results) / max(1, total), 3),
        "failure_counts": labels,
        "by_domain": {
            domain: {
                "count": len(items),
                "valid_rate": rate(items, lambda item: item.validation["valid"]),
                "instruction_following": round(
                    sum(item.instruction_following for item in items) / max(1, len(items)),
                    3,
                ),
                "repetition_score": round(
                    sum(item.repetition.get("score", 0.0) for item in items) / max(1, len(items)),
                    3,
                ),
            }
            for domain, items in sorted(by_domain.items())
        },
    }


def write_outputs(
    *,
    experiment_dir: Path,
    payload: dict,
    results: list[CaseResult],
) -> dict:
    experiment_dir.mkdir(parents=True, exist_ok=True)
    results_path = experiment_dir / "results.json"
    failures_path = experiment_dir / "failures.jsonl"
    summary_path = experiment_dir / "summary.md"

    results_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    with failures_path.open("w", encoding="utf-8") as f:
        for item in results:
            if item.failure_labels or not item.validation["valid"]:
                f.write(json.dumps(asdict(item), ensure_ascii=False) + "\n")

    summary = payload["summary"]
    lines = [
        "# NexusAI P0 Benchmark 100",
        "",
        f"- Benchmark: `{payload['benchmark']}`",
        f"- Model: `{payload['model']}`",
        f"- Config: `{payload['config']}`",
        f"- Created at: `{payload['created_at']}`",
        "",
        "## Metrics",
        "",
    ]
    for key in (
        "total_prompts",
        "valid_python_rate",
        "valid_flask_rate",
        "compile_like_rate",
        "instruction_following",
        "wrong_domain_rate",
        "syntax_error_rate",
        "json_error_rate",
        "route_error_rate",
        "method_error_rate",
        "repetition_score",
        "avg_generation_time",
    ):
        lines.append(f"- {key}: `{summary[key]}`")
    lines.extend(["", "## By Domain", ""])
    for domain, data in summary["by_domain"].items():
        lines.append(f"- {domain}: `{data}`")
    lines.extend(["", "## Failure Counts", ""])
    for label, count in summary["failure_counts"].items():
        lines.append(f"- {label}: `{count}`")
    lines.extend(["", "## Top Failures", ""])
    for item in results[:]:
        if not item.failure_labels and item.validation["valid"]:
            continue
        lines.extend(
            [
                f"### {item.id}",
                "",
                f"- domain: `{item.domain}`",
                f"- labels: `{item.failure_labels}`",
                f"- errors: `{item.validation['errors']}`",
                "",
                "```text",
                item.extracted_output[:1200],
                "```",
                "",
            ]
        )
        if lines.count("```text") >= 8:
            break
    summary_path.write_text("\n".join(lines), encoding="utf-8")
    return {"results": str(results_path), "failures": str(failures_path), "summary": str(summary_path)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the fixed NexusAI P0 benchmark.")
    parser.add_argument("--model", default="baseline_9m")
    parser.add_argument("--config", default="")
    parser.add_argument("--benchmark", default=str(DEFAULT_BENCHMARK))
    parser.add_argument("--experiments_dir", default=str(DEFAULT_EXPERIMENTS_DIR))
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--tokens", type=int, default=180)
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--top_k", type=int, default=20)
    parser.add_argument("--repetition_penalty", type=float, default=1.25)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    benchmark_path = Path(args.benchmark).resolve()
    config_path = resolve_config(args.model, args.config or None)
    cases = load_jsonl(benchmark_path)
    if args.limit:
        cases = cases[: args.limit]

    results: list[CaseResult] = []
    for index, case in enumerate(cases, start=1):
        result = run_case(case, config_path=config_path, args=args)
        results.append(result)
        print(
            f"[{index:03d}/{len(cases):03d}] {result.id} "
            f"valid={result.validation['valid']} follow={result.instruction_following} "
            f"rep={result.repetition.get('score', 0.0)} failures={','.join(result.failure_labels) or '-'}"
        )

    timestamp = time.strftime("%Y%m%d_%H%M%S")
    experiment_dir = Path(args.experiments_dir).resolve() / f"{timestamp}_{args.model}"
    summary = aggregate(results)
    payload = {
        "benchmark": "nexus_100",
        "benchmark_path": str(benchmark_path),
        "model": args.model,
        "config": str(config_path),
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "settings": {
            "tokens": args.tokens,
            "temperature": args.temperature,
            "top_k": args.top_k,
            "repetition_penalty": args.repetition_penalty,
            "dry_run": args.dry_run,
            "limit": args.limit,
        },
        "summary": summary,
        "results": [asdict(item) for item in results],
    }
    paths = write_outputs(experiment_dir=experiment_dir, payload=payload, results=results)

    print("")
    print("Benchmark: nexus_100")
    print(f"Model: {args.model}")
    print(f"Prompts: {summary['total_prompts']}")
    print(f"Compile-like rate: {summary['compile_like_rate']}")
    print(f"Instruction following: {summary['instruction_following']}")
    print(f"Wrong domain rate: {summary['wrong_domain_rate']}")
    print(f"Syntax error rate: {summary['syntax_error_rate']}")
    print(f"Repetition score: {summary['repetition_score']}")
    print(f"Failures saved to: {paths['failures']}")
    print(f"Summary saved to: {paths['summary']}")


if __name__ == "__main__":
    main()
