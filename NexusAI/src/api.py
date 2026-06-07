from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pathlib import Path
import json

# Local imports (adjust sys.path if needed)
import sys
from fastapi.middleware.cors import CORSMiddleware
sys.path.append(str(Path(__file__).parent))
from infer import generate_text
from cache_py import get, set, clear
from context import add_message, get_recent
from i18n import translate_text

app = FastAPI(title="NexusAI Chat API", version="0.1.0")

# Enable CORS for any origin (development mode)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    prompt: str
    language: str = "en"  # "en" or "pt"
    max_new_tokens: int = 100
    temperature: float = 0.2
    top_k: int = 20
    repetition_penalty: float = 1.2
    use_few_shot: bool = False

class ChatResponse(BaseModel):
    response: str
    cached: bool = False

@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    # Prepare cache key based on prompt and parameters
    cache_key = json.dumps({
        "prompt": request.prompt,
        "lang": request.language,
        "max_new_tokens": request.max_new_tokens,
        "temperature": request.temperature,
        "top_k": request.top_k,
        "repetition_penalty": request.repetition_penalty,
        "use_few_shot": request.use_few_shot,
    }, sort_keys=True)

    cached_val = get(cache_key)
    if cached_val:
        return ChatResponse(response=cached_val, cached=True)

    # Translate prompt if needed (assuming model works best in English)
    if request.language != "en":
        prompt_en = translate_text(request.prompt, target="en")
    else:
        prompt_en = request.prompt

    # Add recent context (last 5 messages) to prompt
    recent = get_recent(5)
    if recent:
        context_str = "\n".join([f"{role}: {msg}" for role, msg in recent])
        prompt_en = context_str + "\n" + prompt_en

    # Generate response in English
    raw_response = generate_text(
        prompt_en,
        max_new_tokens=request.max_new_tokens,
        temperature=request.temperature,
        top_k=request.top_k,
        repetition_penalty=request.repetition_penalty,
        use_few_shot=request.use_few_shot,
    )

    # Translate back if needed
    if request.language != "en":
        final_response = translate_text(raw_response, target=request.language)
    else:
        final_response = raw_response

    # Store in cache
    set(cache_key, final_response)
    # Store messages in context
    add_message("user", request.prompt)
    add_message("assistant", final_response)

    return ChatResponse(response=final_response, cached=False)

@app.post("/cache/clear")
def clear_cache_endpoint():
    clear()
    return {"status": "cache cleared"}
