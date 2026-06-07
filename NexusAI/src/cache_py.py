import json
import os
from pathlib import Path
from typing import Any, Dict

CACHE_FILE = Path(__file__).parent.parent / "cache" / "cache.json"
CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)

def _load_cache() -> Dict[str, Any]:
    if CACHE_FILE.is_file():
        try:
            return json.load(CACHE_FILE.open("r", encoding="utf-8"))
        except Exception:
            return {}
    return {}

def _save_cache(cache: Dict[str, Any]) -> None:
    CACHE_FILE.open("w", encoding="utf-8").write(json.dumps(cache, ensure_ascii=False, indent=2))

def get(key: str) -> Any:
    return _load_cache().get(key)

def set(key: str, value: Any) -> None:
    cache = _load_cache()
    cache[key] = value
    _save_cache(cache)

def clear() -> None:
    if CACHE_FILE.is_file():
        os.remove(CACHE_FILE)
    # Also clear in-memory reference by writing empty dict
    _save_cache({})
