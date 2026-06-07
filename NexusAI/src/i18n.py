# Updated i18n module with proper function name
import json
import urllib.request
from typing import Dict

def _load_config() -> Dict:
    import pathlib, json
    cfg_path = pathlib.Path(__file__).parent.parent / "config.json"
    with cfg_path.open("r", encoding="utf-8") as f:
        return json.load(f)

_CFG = _load_config()
_API_URL = _CFG.get("translation", {}).get("api_url", "https://libretranslate.de/translate")
_SUPPORTED = set(_CFG.get("translation", {}).get("supported_languages", []))

def translate_text(text: str, target: str = "en") -> str:
    """Translate *text* to *target* language using LibreTranslate.
    Returns original text if target not supported or on error.
    """
    if target not in _SUPPORTED:
        return text
    payload = json.dumps({
        "q": text,
        "source": "auto",
        "target": target,
        "format": "text"
    }).encode("utf-8")
    try:
        req = urllib.request.Request(_API_URL, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_data = json.load(resp)
            return resp_data.get("translatedText", text)
    except Exception:
        return text
