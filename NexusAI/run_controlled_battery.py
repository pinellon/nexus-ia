"""Run real-world controlled generation tests and classify failures."""

from __future__ import annotations

import argparse
import json
import time
from collections import Counter
from pathlib import Path

from controlled_generate import controlled_generate
from task_router import classify_task


BASE_DIR = Path(__file__).parent
LOG_DIR = BASE_DIR / "logs"


def classify_failure(result: dict, expected_task_type: str) -> list[str]:
    labels: list[str] = []
    response = result.get("response", "")
    lowered = response.lower()

    if result.get("task_type") != expected_task_type:
        labels.append("wrong_task_route")
    if not result.get("valid"):
        labels.append("validator_failed")
    if result.get("errors"):
        labels.extend(f"validation:{error}" for error in result["errors"])
    if "<sample>" in lowered or "</sample>" in lowered or "</file>" in lowered:
        labels.append("dataset_leak")
    if "### instruction" in lowered or "### response" in lowered:
        labels.append("template_leak")
    if len(response.strip()) < 40:
        labels.append("too_short")
    if "..." in response:
        labels.append("placeholder_ellipsis")
    if expected_task_type == "site_html" and "```" in response:
        labels.append("markdown_when_html_expected")
    return labels


def write_markdown(output_md: Path, payload: dict) -> None:
    lines = [
        "# NexusAI Controlled Production Battery",
        "",
        f"Generated at: {payload['generated_at']}",
        f"Config: `{payload['config']}`",
        f"Cases: `{len(payload['cases'])}`",
        "",
        "## Summary",
        "",
    ]
    for key, value in payload["summary"].items():
        lines.append(f"- {key}: `{value}`")
    lines.extend(["", "## Failure Types", ""])
    for label, count in sorted(payload["failure_counts"].items(), key=lambda item: (-item[1], item[0])):
        lines.append(f"- {label}: `{count}`")
    lines.extend(["", "## Cases", ""])
    for case in payload["cases"]:
        lines.extend(
            [
                f"### {case['id']}",
                "",
                f"- Expected: `{case['expected_task_type']}`",
                f"- Routed: `{case['task_type']}`",
                f"- Valid: `{case['valid']}`",
                f"- Failures: `{case['failure_labels']}`",
                "",
                "```text",
                case["prompt"],
                "```",
                "",
                "```text",
                case["response"][:2000],
                "```",
                "",
            ]
        )
    output_md.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run NexusAI controlled production test battery.")
    parser.add_argument("--prompts", default=str(BASE_DIR / "production_test_prompts.json"))
    parser.add_argument("--config", default=str(BASE_DIR / "config.micro-instruct-fullstack.behavior.json"))
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--retries", type=int, default=1)
    parser.add_argument("--no_memory", action="store_true")
    parser.add_argument("--dry_run", action="store_true", help="Only test routing without loading the model.")
    args = parser.parse_args()

    prompts = json.loads(Path(args.prompts).read_text(encoding="utf-8"))
    if args.limit > 0:
        prompts = prompts[: args.limit]

    cases = []
    failure_counts = Counter()
    valid_count = 0
    route_ok_count = 0
    first_pass_valid_count = 0
    repair_success_count = 0
    repaired_case_count = 0

    for item in prompts:
        expected_task_type = item.get("expected_task_type") or classify_task(item["prompt"])
        if args.dry_run:
            routed_task_type = item.get("task_type") or classify_task(item["prompt"])
            result = {
                "task_type": routed_task_type,
                "valid": routed_task_type == expected_task_type,
                "errors": [] if routed_task_type == expected_task_type else ["wrong route"],
                "warnings": [],
                "response": "",
            }
        else:
            result = controlled_generate(
                item["prompt"],
                config=args.config,
                task_type=item.get("task_type"),
                max_retries=args.retries,
                use_memory=not args.no_memory,
            )
        if args.dry_run:
            failure_labels = [] if result["task_type"] == expected_task_type else ["wrong_task_route"]
        else:
            failure_labels = classify_failure(result, expected_task_type)
        failure_counts.update(failure_labels)
        valid_count += int(bool(result["valid"]))
        route_ok_count += int(result["task_type"] == expected_task_type)
        attempts = result.get("attempts") or []
        first_pass_valid = bool(
            attempts
            and attempts[0].get("validation", {}).get("valid")
        )
        repair_success = bool(attempts and not first_pass_valid and result["valid"])
        first_pass_valid_count += int(first_pass_valid)
        repair_success_count += int(repair_success)
        repaired_case_count += int(bool(attempts and not first_pass_valid))
        cases.append(
            {
                "id": item["id"],
                "category": item.get("category", ""),
                "prompt": item["prompt"],
                "expected_task_type": expected_task_type,
                "task_type": result["task_type"],
                "valid": result["valid"],
                "errors": result["errors"],
                "warnings": result["warnings"],
                "failure_labels": failure_labels,
                "first_pass_valid": first_pass_valid,
                "repair_success": repair_success,
                "attempt_count": len(attempts),
                "response": result["response"],
            }
        )

    payload = {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "config": args.config,
        "summary": {
            "valid_count": valid_count,
            "route_ok_count": route_ok_count,
            "invalid_count": len(cases) - valid_count,
            "route_error_count": len(cases) - route_ok_count,
            "first_pass_valid_rate": round(first_pass_valid_count / max(1, len(cases)), 3),
            "repair_success_rate": round(repair_success_count / max(1, repaired_case_count), 3),
            "final_valid_rate": round(valid_count / max(1, len(cases)), 3),
        },
        "failure_counts": dict(failure_counts),
        "cases": cases,
    }

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    stamp = int(time.time())
    output_json = LOG_DIR / f"controlled_battery_{stamp}.json"
    output_md = LOG_DIR / f"controlled_battery_{stamp}.md"
    output_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_markdown(output_md, payload)
    print(f"JSON: {output_json}")
    print(f"Report: {output_md}")


if __name__ == "__main__":
    main()
