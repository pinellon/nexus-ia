import sqlite3
from pathlib import Path
from typing import List, Tuple

DB_PATH = Path(__file__).parent.parent / "memory" / "memory.db"

def _ensure_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    conn.close()

def add_message(role: str, content: str) -> None:
    """Insert a new message into the conversation history.

    Args:
        role: "user" or "assistant"
        content: Text of the message
    """
    _ensure_db()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO messages (role, content) VALUES (?, ?)",
        (role, content),
    )
    conn.commit()
    conn.close()

def get_recent(n: int = 5) -> List[Tuple[str, str]]:
    """Return the last *n* messages as a list of (role, content) tuples.
    Ordered from oldest to newest.
    """
    _ensure_db()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT role, content FROM messages ORDER BY id DESC LIMIT ?", (n,)
    )
    rows = cur.fetchall()
    conn.close()
    # Reverse to chronological order
    return [(role, content) for role, content in reversed(rows)]
