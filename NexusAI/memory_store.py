"""Persistent memory for NexusAI.

This module stores fast-changing project/user context outside the model weights.
Training changes the .pt checkpoint; memory.db stores facts the assistant should
recall before generating an answer.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


BASE_DIR = Path(__file__).parent
DEFAULT_DB_PATH = BASE_DIR / "memory" / "memory.db"


@dataclass(frozen=True)
class Memory:
    id: int
    kind: str
    key: str
    value: str
    tags: tuple[str, ...]
    importance: int
    source: str
    created_at: str
    updated_at: str
    hits: int


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def normalize_tag(tag: str) -> str:
    return re.sub(r"[^a-z0-9_-]+", "-", tag.lower()).strip("-")


def parse_tags(value: str | Iterable[str] | None) -> tuple[str, ...]:
    if value is None:
        return ()
    if isinstance(value, str):
        raw_tags = re.split(r"[,;\s]+", value)
    else:
        raw_tags = list(value)
    return tuple(tag for tag in (normalize_tag(str(item)) for item in raw_tags) if tag)


def connect(db_path: str | Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def resolve_memory_path(config: dict, config_dir: Path) -> Path:
    value = config.get("paths", {}).get("memory_file")
    if not value:
        return DEFAULT_DB_PATH
    path = Path(value)
    return path if path.is_absolute() else config_dir / path


def ensure_db(db_path: str | Path = DEFAULT_DB_PATH) -> None:
    with connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                tags TEXT NOT NULL DEFAULT '[]',
                importance INTEGER NOT NULL DEFAULT 3,
                source TEXT NOT NULL DEFAULT 'manual',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                hits INTEGER NOT NULL DEFAULT 0,
                UNIQUE(kind, key)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_memories_kind ON memories(kind)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance)")
        conn.commit()


def row_to_memory(row: sqlite3.Row) -> Memory:
    return Memory(
        id=int(row["id"]),
        kind=str(row["kind"]),
        key=str(row["key"]),
        value=str(row["value"]),
        tags=tuple(json.loads(row["tags"] or "[]")),
        importance=int(row["importance"]),
        source=str(row["source"]),
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
        hits=int(row["hits"]),
    )


def add_memory(
    kind: str,
    key: str,
    value: str,
    *,
    tags: str | Iterable[str] | None = None,
    importance: int = 3,
    source: str = "manual",
    db_path: str | Path = DEFAULT_DB_PATH,
) -> Memory:
    """Insert or update one memory fact."""
    ensure_db(db_path)
    kind = kind.strip().lower()
    key = key.strip()
    value = value.strip()
    if not kind or not key or not value:
        raise ValueError("kind, key, and value are required")
    importance = min(max(int(importance), 1), 5)
    tag_json = json.dumps(parse_tags(tags), ensure_ascii=True)
    now = utc_now()

    with connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO memories (kind, key, value, tags, importance, source, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(kind, key) DO UPDATE SET
                value=excluded.value,
                tags=excluded.tags,
                importance=excluded.importance,
                source=excluded.source,
                updated_at=excluded.updated_at
            """,
            (kind, key, value, tag_json, importance, source, now, now),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM memories WHERE kind = ? AND key = ?",
            (kind, key),
        ).fetchone()
    return row_to_memory(row)


def add_interaction(
    role: str,
    content: str,
    *,
    db_path: str | Path = DEFAULT_DB_PATH,
) -> None:
    ensure_db(db_path)
    with connect(db_path) as conn:
        conn.execute(
            "INSERT INTO interactions (role, content, created_at) VALUES (?, ?, ?)",
            (role.strip().lower(), content.strip(), utc_now()),
        )
        conn.commit()


def recent_interactions(limit: int = 6, *, db_path: str | Path = DEFAULT_DB_PATH) -> list[tuple[str, str]]:
    ensure_db(db_path)
    with connect(db_path) as conn:
        rows = conn.execute(
            "SELECT role, content FROM interactions ORDER BY id DESC LIMIT ?",
            (int(limit),),
        ).fetchall()
    return [(str(row["role"]), str(row["content"])) for row in reversed(rows)]


def tokenize_query(query: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-zA-Z0-9_/-]{3,}", query.lower())
        if token not in {"para", "com", "uma", "the", "and", "que", "por", "from"}
    }


def memory_score(memory: Memory, query_tokens: set[str]) -> int:
    haystack = " ".join([memory.kind, memory.key, memory.value, " ".join(memory.tags)]).lower()
    token_hits = sum(1 for token in query_tokens if token in haystack)
    tag_hits = sum(2 for tag in memory.tags if tag in query_tokens)
    return token_hits + tag_hits + memory.importance


def search_memories(
    query: str,
    *,
    limit: int = 8,
    db_path: str | Path = DEFAULT_DB_PATH,
) -> list[Memory]:
    ensure_db(db_path)
    query_tokens = tokenize_query(query)
    with connect(db_path) as conn:
        rows = conn.execute("SELECT * FROM memories ORDER BY importance DESC, updated_at DESC").fetchall()

    scored = [
        (memory_score(row_to_memory(row), query_tokens), row_to_memory(row))
        for row in rows
    ]
    selected = [memory for score, memory in sorted(scored, key=lambda item: item[0], reverse=True) if score > 0]
    selected = selected[: max(1, int(limit))]

    if selected:
        with connect(db_path) as conn:
            conn.executemany(
                "UPDATE memories SET hits = hits + 1 WHERE id = ?",
                [(memory.id,) for memory in selected],
            )
            conn.commit()
    return selected


def build_memory_context(
    query: str,
    *,
    max_items: int = 8,
    include_recent: bool = True,
    db_path: str | Path = DEFAULT_DB_PATH,
) -> str:
    memories = search_memories(query, limit=max_items, db_path=db_path)
    recent = recent_interactions(4, db_path=db_path) if include_recent else []
    lines: list[str] = []

    if memories:
        lines.append("[NexusAI memory]")
        for memory in memories:
            tag_text = f" tags={','.join(memory.tags)}" if memory.tags else ""
            lines.append(f"- {memory.kind}:{memory.key}{tag_text}: {memory.value}")

    if recent:
        lines.append("[Recent interaction]")
        for role, content in recent:
            compact = " ".join(content.split())
            lines.append(f"- {role}: {compact[:240]}")

    if not lines:
        return ""
    return "\n".join(lines)


def augment_prompt(prompt: str, *, db_path: str | Path = DEFAULT_DB_PATH) -> str:
    context = build_memory_context(prompt, db_path=db_path)
    if not context:
        return prompt
    return f"{context}\n\n[User request]\n{prompt}"


def seed_default_memories(db_path: str | Path = DEFAULT_DB_PATH) -> None:
    defaults = [
        (
            "preference",
            "language",
            "The user usually communicates in Portuguese. Prefer Portuguese explanations unless code or APIs require English.",
            "user style portuguese",
            5,
        ),
        (
            "preference",
            "code_generation",
            "When asked to build, create complete usable files instead of only giving ideas.",
            "coding output quality",
            5,
        ),
        (
            "project",
            "nexusai_goal",
            "NexusAI is a local coding assistant being trained for professional websites, fullstack apps, Flask APIs, React, Electron, and project-aware coding.",
            "nexusai project goal fullstack",
            5,
        ),
        (
            "quality_rule",
            "website_output",
            "Professional website output should include semantic HTML, responsive CSS, real domain copy, CTA, visual hierarchy, and no lorem ipsum.",
            "website html css quality",
            5,
        ),
        (
            "quality_rule",
            "desktop_security",
            "Electron apps should use contextIsolation true, nodeIntegration false, preload APIs, and avoid exposing shell execution to the renderer.",
            "electron desktop security",
            5,
        ),
        (
            "lesson",
            "current_training",
            "The current instruct fullstack model stores learned weights in model_instruct_fullstack/nexus_model_best.pt; memory.db stores fast project facts outside the weights.",
            "training memory checkpoint",
            4,
        ),
    ]
    for kind, key, value, tags, importance in defaults:
        add_memory(kind, key, value, tags=tags, importance=importance, source="seed", db_path=db_path)


def print_memories(memories: list[Memory]) -> None:
    for memory in memories:
        tags = f" [{', '.join(memory.tags)}]" if memory.tags else ""
        print(f"#{memory.id} {memory.kind}:{memory.key}{tags} importance={memory.importance}")
        print(f"  {memory.value}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage NexusAI memory.db")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init", help="Create tables and seed default memories")

    add = sub.add_parser("add", help="Add or update a memory")
    add.add_argument("--kind", required=True)
    add.add_argument("--key", required=True)
    add.add_argument("--value", required=True)
    add.add_argument("--tags", default="")
    add.add_argument("--importance", type=int, default=3)
    add.add_argument("--source", default="manual")

    search = sub.add_parser("search", help="Search relevant memories")
    search.add_argument("query")
    search.add_argument("--limit", type=int, default=8)

    context = sub.add_parser("context", help="Print prompt memory context")
    context.add_argument("query")
    context.add_argument("--limit", type=int, default=8)

    args = parser.parse_args()
    db_path = Path(args.db)

    if args.command == "init":
        ensure_db(db_path)
        seed_default_memories(db_path)
        print(f"Memory initialized at {db_path}")
    elif args.command == "add":
        memory = add_memory(
            args.kind,
            args.key,
            args.value,
            tags=args.tags,
            importance=args.importance,
            source=args.source,
            db_path=db_path,
        )
        print_memories([memory])
    elif args.command == "search":
        print_memories(search_memories(args.query, limit=args.limit, db_path=db_path))
    elif args.command == "context":
        print(build_memory_context(args.query, max_items=args.limit, db_path=db_path))


if __name__ == "__main__":
    main()
