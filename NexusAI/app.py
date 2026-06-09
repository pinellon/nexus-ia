from flask import Flask, request, jsonify
import os
from pathlib import Path
from controlled_generate import controlled_generate
from failure_ranking import top_failures
from nexus_commands import run_internal_command
from patch_manager import apply_file_changes, rollback_last
from repo_indexer import build_project_index
from repo_mode import build_repo_context, run_repo_task
from task_metrics import replay_session, task_success_summary
from test_runner import run_project_tests
import autonomy_controller as _ac
import json

app = Flask(__name__)

BASE_DIR = Path(__file__).parent
INSTRUCT_CONFIG = BASE_DIR / 'config.micro-instruct-fullstack.json'
DEFAULT_CONFIG = BASE_DIR / 'config.micro-fullstack.json'
PYTHON_CONFIG = BASE_DIR / 'config.micro-python.json'
FALLBACK_CONFIG = BASE_DIR / 'config.json'

# JSON schema for /generate payload
GENERATE_SCHEMA = {
    "type": "object",
    "properties": {
        "prompt": {"type": "string", "minLength": 1},
        "max_new_tokens": {"type": "integer", "minimum": 1},
        "repetition_penalty": {"type": "number", "minimum": 0},
        "few_shot": {"type": "boolean"},
        "temperature": {"type": "number", "minimum": 0},
        "top_k": {"type": "integer", "minimum": 1},
        "use_memory": {"type": "boolean"},
    },
    "required": ["prompt"],
    "additionalProperties": False,
}

CONTROLLED_GENERATE_SCHEMA = {
    "type": "object",
    "properties": {
        "prompt": {"type": "string", "minLength": 1},
        "task_type": {
            "type": "string",
            "enum": [
                "site_html",
                "flask_api",
                "react_component",
                "electron_app",
                "patch_review",
                "bugfix",
                "explain_error",
                "project_question",
            ],
        },
        "retries": {"type": "integer", "minimum": 0, "maximum": 2},
        "use_memory": {"type": "boolean"},
        "save_preview": {"type": "boolean"},
    },
    "required": ["prompt"],
    "additionalProperties": False,
}

REPO_INDEX_SCHEMA = {
    "type": "object",
    "properties": {
        "project_dir": {"type": "string", "minLength": 1},
    },
    "required": ["project_dir"],
    "additionalProperties": False,
}

REPO_CONTEXT_SCHEMA = {
    "type": "object",
    "properties": {
        "project_dir": {"type": "string", "minLength": 1},
        "prompt": {"type": "string", "minLength": 1},
        "limit": {"type": "integer", "minimum": 1, "maximum": 20},
    },
    "required": ["project_dir", "prompt"],
    "additionalProperties": False,
}

REPO_TASK_SCHEMA = {
    "type": "object",
    "properties": {
        "project_dir": {"type": "string", "minLength": 1},
        "prompt": {"type": "string", "minLength": 1},
        "retries": {"type": "integer", "minimum": 0, "maximum": 2},
        "use_memory": {"type": "boolean"},
    },
    "required": ["project_dir", "prompt"],
    "additionalProperties": False,
}

COMMAND_SCHEMA = {
    "type": "object",
    "properties": {
        "project_dir": {"type": "string", "minLength": 1},
        "command": {"type": "string", "minLength": 1},
    },
    "required": ["project_dir", "command"],
    "additionalProperties": False,
}

def validate_payload(data, schema):
    if not isinstance(data, dict):
        return 'body must be a JSON object'

    required = schema.get('required', [])
    for key in required:
        if key not in data:
            return f"'{key}' is a required property"

    allowed = set(schema.get('properties', {}))
    if schema.get('additionalProperties') is False:
        extra = sorted(set(data) - allowed)
        if extra:
            return f"additional properties are not allowed: {', '.join(extra)}"

    for key, value in data.items():
        rules = schema.get('properties', {}).get(key, {})
        expected = rules.get('type')
        if expected == 'string' and not isinstance(value, str):
            return f"'{key}' must be a string"
        if expected == 'integer' and not isinstance(value, int):
            return f"'{key}' must be an integer"
        if expected == 'number' and not isinstance(value, (int, float)):
            return f"'{key}' must be a number"
        if expected == 'boolean' and not isinstance(value, bool):
            return f"'{key}' must be a boolean"
        if expected == 'string' and 'minLength' in rules and len(value) < rules['minLength']:
            return f"'{key}' is too short"
        if expected in {'integer', 'number'} and 'minimum' in rules and value < rules['minimum']:
            return f"'{key}' must be >= {rules['minimum']}"
        if expected in {'integer', 'number'} and 'maximum' in rules and value > rules['maximum']:
            return f"'{key}' must be <= {rules['maximum']}"
        if 'enum' in rules and value not in rules['enum']:
            return f"'{key}' must be one of: {', '.join(rules['enum'])}"
    return None

def has_checkpoint(config_path: Path) -> bool:
    if config_path == INSTRUCT_CONFIG:
        return (BASE_DIR / 'model_instruct_fullstack' / 'nexus_model_best.pt').is_file()
    if config_path == DEFAULT_CONFIG:
        return (BASE_DIR / 'model_fullstack' / 'nexus_model_best.pt').is_file()
    if config_path == PYTHON_CONFIG:
        return (BASE_DIR / 'model_micro' / 'nexus_model_best.pt').is_file()
    return (BASE_DIR / 'model' / 'nexus_model_best.pt').is_file()

def generation_config_path() -> Path:
    configured = os.environ.get('NEXUS_AI_CONFIG')
    if configured:
        return Path(configured)
    if INSTRUCT_CONFIG.is_file() and has_checkpoint(INSTRUCT_CONFIG):
        return INSTRUCT_CONFIG
    if DEFAULT_CONFIG.is_file() and has_checkpoint(DEFAULT_CONFIG):
        return DEFAULT_CONFIG
    if PYTHON_CONFIG.is_file() and has_checkpoint(PYTHON_CONFIG):
        return PYTHON_CONFIG
    return FALLBACK_CONFIG

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'ok': True, 'model': 'nexus-coder-tiny', 'config': str(generation_config_path())})

@app.route('/generate', methods=['POST'])
def generate_code():
    data = request.get_json(force=True)
    error = validate_payload(data, GENERATE_SCHEMA)
    if error:
        return jsonify({'error': f'Invalid request: {error}'}), 400

    prompt = data['prompt']
    max_new_tokens = int(data.get('max_new_tokens', 100))
    repetition_penalty = float(data.get('repetition_penalty', 1.2))
    use_few_shot = bool(data.get('few_shot', True))
    temperature = float(data.get('temperature', 0.2))
    top_k = int(data.get('top_k', 20))
    use_memory = bool(data.get('use_memory', True))

    # Keep the heavy model stack out of controlled unit tests until /generate is called.
    import infer

    generated = infer.run_generation(
        prompt=prompt,
        max_new_tokens=max_new_tokens,
        repetition_penalty=repetition_penalty,
        use_few_shot=use_few_shot,
        temperature=temperature,
        top_k=top_k,
        config_path=generation_config_path(),
        use_memory=use_memory,
    )
    return jsonify({
        'generated_code': generated,
        'memory_used': use_memory,
        'config': str(generation_config_path()),
    })

@app.route('/generate-controlled', methods=['POST'])
def generate_controlled_code():
    data = request.get_json(force=True)
    error = validate_payload(data, CONTROLLED_GENERATE_SCHEMA)
    if error:
        return jsonify({'error': f'Invalid request: {error}'}), 400

    result = controlled_generate(
        prompt=data['prompt'],
        config=generation_config_path(),
        task_type=data.get('task_type'),
        max_retries=int(data.get('retries', 1)),
        use_memory=bool(data.get('use_memory', True)),
        save_preview=bool(data.get('save_preview', False)),
    )
    result['memory_used'] = bool(data.get('use_memory', True))
    result['config'] = str(generation_config_path())
    return jsonify(result)

@app.route('/repo/index', methods=['POST'])
def repo_index():
    data = request.get_json(force=True)
    error = validate_payload(data, REPO_INDEX_SCHEMA)
    if error:
        return jsonify({'error': f'Invalid request: {error}'}), 400
    try:
        return jsonify(build_project_index(data['project_dir']))
    except Exception as exc:
        return jsonify({'error': str(exc)}), 400

@app.route('/repo/context', methods=['POST'])
def repo_context():
    data = request.get_json(force=True)
    error = validate_payload(data, REPO_CONTEXT_SCHEMA)
    if error:
        return jsonify({'error': f'Invalid request: {error}'}), 400
    try:
        return jsonify(build_repo_context(data['project_dir'], data['prompt'], limit=int(data.get('limit', 8))))
    except Exception as exc:
        return jsonify({'error': str(exc)}), 400

@app.route('/repo/task', methods=['POST'])
def repo_task():
    data = request.get_json(force=True)
    error = validate_payload(data, REPO_TASK_SCHEMA)
    if error:
        return jsonify({'error': f'Invalid request: {error}'}), 400
    try:
        return jsonify(
            run_repo_task(
                data['project_dir'],
                data['prompt'],
                config=generation_config_path(),
                retries=int(data.get('retries', 1)),
                use_memory=bool(data.get('use_memory', True)),
            )
        )
    except Exception as exc:
        return jsonify({'error': str(exc)}), 400

@app.route('/repo/test', methods=['POST'])
def repo_test():
    data = request.get_json(force=True)
    error = validate_payload(data, REPO_INDEX_SCHEMA)
    if error:
        return jsonify({'error': f'Invalid request: {error}'}), 400
    try:
        return jsonify(run_project_tests(data['project_dir']))
    except Exception as exc:
        return jsonify({'error': str(exc)}), 400

@app.route('/repo/apply', methods=['POST'])
def repo_apply():
    data = request.get_json(force=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid request: body must be a JSON object'}), 400
    if not data.get('approved'):
        return jsonify({'error': 'Patch application requires approved=true'}), 403
    project_dir = data.get('project_dir')
    changes = data.get('changes')
    if not isinstance(project_dir, str) or not project_dir.strip():
        return jsonify({'error': 'Invalid request: project_dir is required'}), 400
    if not isinstance(changes, list) or not changes:
        return jsonify({'error': 'Invalid request: changes must be a non-empty list'}), 400
    for item in changes:
        if not isinstance(item, dict) or not isinstance(item.get('path'), str) or 'content' not in item:
            return jsonify({'error': 'Invalid request: each change needs path and content'}), 400
    try:
        return jsonify(
            apply_file_changes(
                project_dir,
                changes,
                reason=str(data.get('reason', '')),
                allow_dependencies=bool(data.get('allow_dependencies', False)),
            )
        )
    except Exception as exc:
        return jsonify({'error': str(exc)}), 400

@app.route('/repo/rollback', methods=['POST'])
def repo_rollback():
    data = request.get_json(force=True)
    error = validate_payload(data, REPO_INDEX_SCHEMA)
    if error:
        return jsonify({'error': f'Invalid request: {error}'}), 400
    try:
        return jsonify(rollback_last(data['project_dir']))
    except Exception as exc:
        return jsonify({'error': str(exc)}), 400

@app.route('/repo/autonomy/execute', methods=['POST'])
def repo_autonomy_execute():
    data = request.get_json(force=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid request: body must be a JSON object'}), 400
    if data.get('approved') is not True:
        return jsonify({'error': 'Autonomy execution requires approved=true'}), 403

    project_dir = data.get('project_dir')
    task_id = data.get('task_id')
    step_id = data.get('step_id')
    if not isinstance(project_dir, str) or not project_dir.strip():
        return jsonify({'error': 'Invalid request: project_dir is required'}), 400
    if not isinstance(task_id, str) or not task_id.strip():
        return jsonify({'error': 'Invalid request: task_id is required'}), 400
    if not isinstance(step_id, str) or not step_id.strip():
        return jsonify({'error': 'Invalid request: step_id is required'}), 400

    selected = sum([
        isinstance(data.get('changes'), list),
        isinstance(data.get('command'), str),
        data.get('rollback') is True,
    ])
    if selected != 1:
        return jsonify({'error': 'choose exactly one of changes, command or rollback=true'}), 400
    if 'changes' in data:
        changes = data.get('changes')
        if not isinstance(changes, list) or not changes:
            return jsonify({'error': 'Invalid request: changes must be a non-empty list'}), 400
        for item in changes:
            if not isinstance(item, dict) or not isinstance(item.get('path'), str) or 'content' not in item:
                return jsonify({'error': 'Invalid request: each change needs path and content'}), 400

    payload = {}
    for key in ('changes', 'command', 'rollback', 'allow_dependencies', 'allow_install', 'verify_command'):
        if key in data:
            payload[key] = data[key]
    result = _ac.execute_approved_step(
        task_id,
        step_id,
        root=project_dir,
        payload=payload,
        reason=data.get('reason') if isinstance(data.get('reason'), str) else None,
    )
    if result.get('blocked') and 'approval' in str(result.get('error', '')).lower():
        return jsonify(result), 403
    if not result.get('ok') and result.get('error'):
        return jsonify(result), 400
    return jsonify(result)

@app.route('/command', methods=['POST'])
def internal_command():
    data = request.get_json(force=True)
    error = validate_payload(data, COMMAND_SCHEMA)
    if error:
        return jsonify({'error': f'Invalid request: {error}'}), 400
    try:
        return jsonify(run_internal_command(data['command'], project_dir=data['project_dir'], config=generation_config_path()))
    except Exception as exc:
        return jsonify({'error': str(exc)}), 400

@app.route('/metrics/tasks', methods=['GET'])
def metrics_tasks():
    return jsonify(task_success_summary())

@app.route('/replay/<int:session_id>', methods=['GET'])
def replay_task_session(session_id: int):
    payload = replay_session(session_id)
    if not payload:
        return jsonify({'error': 'session not found'}), 404
    return jsonify(payload)

@app.route('/failures/ranking', methods=['GET'])
def failures_ranking():
    return jsonify({'items': top_failures()})

# Serve static OpenAPI spec
@app.route('/openapi.json', methods=['GET'])
def openapi_spec():
    # The spec file is generated alongside the app.
    spec_path = BASE_DIR / 'openapi.json'
    if spec_path.is_file():
        with open(spec_path, 'r', encoding='utf-8') as f:
            return jsonify(json.loads(f.read()))
    return jsonify({}), 404

if __name__ == '__main__':
    # Run on all interfaces, port 5000
    app.run(host='0.0.0.0', port=5000, debug=False)
