"""Export corrected generation failures into gold instruction examples."""

from __future__ import annotations

import argparse
import sqlite3
import time
from pathlib import Path


BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "memory" / "memory.db"
DEFAULT_OUTPUT_DIR = BASE_DIR / "data" / "raw" / "user_lessons" / "failure_gold"


def fetch_corrected_failures(limit: int = 100) -> list[dict]:
    if not DB_PATH.is_file():
        return []
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT id, prompt, bad_response, failure_type, corrected_response, task_type, created_at
            FROM failures
            WHERE corrected_response IS NOT NULL AND TRIM(corrected_response) != ''
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def render_examples(rows: list[dict]) -> str:
    lines = [
        "# Corrected Failure Gold Examples",
        "",
        "Quality: gold",
        "",
        "These examples come from real NexusAI failures corrected after validation.",
        "",
    ]
    for row in rows:
        lines.extend(
            [
                f"## Failure {row['id']} - {row.get('task_type') or 'unknown'}",
                "",
                "### Instruction:",
                row["prompt"].strip(),
                "",
                "### Bad Response:",
                "```text",
                row["bad_response"].strip(),
                "```",
                "",
                "### Failure Type:",
                row["failure_type"].strip(),
                "",
                "### Response:",
                row["corrected_response"].strip(),
                "",
            ]
        )
    return "\n".join(lines).strip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Export corrected NexusAI failures as gold dataset examples.")
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--output_dir", default=str(DEFAULT_OUTPUT_DIR))
    args = parser.parse_args()

    rows = fetch_corrected_failures(args.limit)
    if not rows:
        print("No corrected failures found. Nothing exported.")
        return

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"corrected_failures_{int(time.time())}.md"
    output_path.write_text(render_examples(rows), encoding="utf-8")
    print(f"Exported {len(rows)} corrected failures to {output_path}")


if __name__ == "__main__":
    main()
