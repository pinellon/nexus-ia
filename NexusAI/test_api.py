import sys
import json
import requests

API_URL = "http://127.0.0.1:5000/generate"

# Example prompt – you can change this to any function you want the model to generate
PROMPT = "def init_db_and_routes():"
MAX_TOKENS = 150

payload = {
    "prompt": PROMPT,
    "max_new_tokens": MAX_TOKENS,
}

try:
    response = requests.post(API_URL, json=payload, timeout=30)
    response.raise_for_status()
    data = response.json()
    generated_code = data.get("generated_code")
    if generated_code:
        print("--- Generated code ---")
        # Safely print Unicode on Windows consoles
        try:
            print(generated_code)
        except UnicodeEncodeError:
            sys.stdout.buffer.write(generated_code.encode('utf-8', errors='ignore') + b"\n")
    else:
        print("No code returned. Response:")
        print(json.dumps(data, indent=2))
except requests.exceptions.RequestException as e:
    print(f"Error communicating with API: {e}")
