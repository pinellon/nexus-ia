"""Build premium instruction/response examples for NexusAI."""

from __future__ import annotations

from pathlib import Path
from textwrap import dedent


BASE_DIR = Path(__file__).parent
OUT_DIR = BASE_DIR / "data" / "raw" / "user_lessons" / "premium_instruction_pairs"


PAIRS = [
    (
        "site_personal_trainer.md",
        "Crie um site profissional para uma personal trainer com hero, planos, depoimentos e botao WhatsApp.",
        r"""
        Vou criar três arquivos completos: `public/index.html`, `public/styles.css` e `public/app.js`.

        ```html
        <!doctype html>
        <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Marina Forte - Personal Trainer</title>
          <link rel="stylesheet" href="styles.css">
          <script src="app.js" defer></script>
        </head>
        <body>
          <header class="topbar">
            <a class="brand" href="#">Marina Forte</a>
            <nav aria-label="Principal">
              <a href="#planos">Planos</a>
              <a href="#resultados">Resultados</a>
              <a href="#contato">Contato</a>
            </nav>
          </header>
          <main>
            <section class="hero">
              <div>
                <p class="eyebrow">Treino personalizado em São Paulo</p>
                <h1>Condicionamento físico com plano claro e acompanhamento real.</h1>
                <p class="lead">Treinos presenciais e online para força, emagrecimento e rotina sustentável.</p>
                <div class="actions">
                  <a class="button" href="https://wa.me/5511999999999">Agendar avaliação</a>
                  <a class="button button--ghost" href="#planos">Ver planos</a>
                </div>
              </div>
              <aside class="hero-panel">
                <strong>+320</strong>
                <span>alunos acompanhados com evolução mensurável</span>
              </aside>
            </section>
            <section id="planos" class="cards">
              <article><h2>Online</h2><p>Plano mensal, vídeos e check-in semanal.</p><strong>R$ 219/mês</strong></article>
              <article><h2>Presencial</h2><p>Treinos 2x por semana com ajustes ao vivo.</p><strong>R$ 690/mês</strong></article>
              <article><h2>Performance</h2><p>Periodização para corrida, força e provas.</p><strong>sob consulta</strong></article>
            </section>
            <section id="resultados" class="proof">
              <h2>Resultados sem promessa vazia</h2>
              <blockquote>Em 12 semanas voltei a treinar sem dor e ganhei consistência.</blockquote>
              <blockquote>O plano encaixou na minha agenda e finalmente consegui evoluir carga.</blockquote>
            </section>
            <section id="contato" class="cta">
              <h2>Comece com uma avaliação</h2>
              <p>Envie seu objetivo, rotina e histórico de treino para receber uma proposta.</p>
              <a class="button" href="https://wa.me/5511999999999">Falar no WhatsApp</a>
            </section>
          </main>
        </body>
        </html>
        ```

        ```css
        :root { font-family: Inter, system-ui, sans-serif; color: #172033; background: #f6f8fb; }
        * { box-sizing: border-box; }
        body { margin: 0; }
        .topbar { min-height: 72px; display: flex; align-items: center; justify-content: space-between; padding: 0 5vw; background: white; border-bottom: 1px solid #dde3ee; }
        .brand { font-size: 22px; font-weight: 900; text-decoration: none; color: #172033; }
        nav { display: flex; gap: 18px; }
        nav a { color: #667085; font-weight: 700; text-decoration: none; }
        main { padding: 48px 5vw 72px; }
        .hero { min-height: 520px; display: grid; grid-template-columns: 1.2fr .8fr; gap: 28px; align-items: center; }
        .eyebrow { color: #dc2626; font-weight: 900; text-transform: uppercase; font-size: 13px; }
        h1 { font-size: clamp(40px, 7vw, 76px); line-height: .96; margin: 12px 0 18px; }
        .lead { font-size: 20px; color: #667085; line-height: 1.65; max-width: 680px; }
        .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 28px; }
        .button { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; padding: 0 18px; border-radius: 6px; background: #dc2626; color: white; font-weight: 800; text-decoration: none; border: 1px solid #dc2626; }
        .button--ghost { background: transparent; color: #991b1b; }
        .hero-panel, .cards article, .proof, .cta { background: white; border: 1px solid #dde3ee; border-radius: 8px; padding: 24px; }
        .hero-panel strong { display: block; font-size: 60px; }
        .hero-panel span, .cards p, .cta p { color: #667085; line-height: 1.6; }
        .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 42px 0; }
        .proof { display: grid; gap: 14px; margin-bottom: 24px; }
        .cta { text-align: center; }
        @media (max-width: 820px) { .topbar, nav { align-items: flex-start; flex-direction: column; } .hero, .cards { grid-template-columns: 1fr; } }
        ```

        ```javascript
        document.querySelectorAll('a[href^="#"]').forEach((link) => {
          link.addEventListener("click", (event) => {
            const target = document.querySelector(link.getAttribute("href"));
            if (!target) return;
            event.preventDefault();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        });
        ```
        """,
    ),
    (
        "flask_jwt_api.md",
        "Crie uma API Flask com cadastro, login JWT simples e rota protegida /api/v1/me.",
        r"""
        Vou criar uma API Flask pequena com validação, senha com hash e token assinado.

        ```python
        from __future__ import annotations

        import base64
        import hashlib
        import hmac
        import json
        import secrets
        from datetime import datetime, timedelta
        from functools import wraps

        from flask import Flask, g, jsonify, request


        app = Flask(__name__)
        JWT_SECRET = secrets.token_hex(32)
        USERS: dict[str, dict] = {}


        def error(message: str, status: int = 400):
            return jsonify({"error": message}), status


        def password_hash(password: str) -> str:
            salt = secrets.token_hex(16)
            digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000)
            return f"{salt}:{digest.hex()}"


        def verify_password(password: str, stored: str) -> bool:
            try:
                salt, digest = stored.split(":", 1)
                candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000)
                return hmac.compare_digest(candidate.hex(), digest)
            except ValueError:
                return False


        def b64(data: bytes) -> str:
            return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


        def create_token(payload: dict) -> str:
            header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
            body_data = dict(payload)
            body_data["exp"] = (datetime.utcnow() + timedelta(hours=12)).timestamp()
            body = b64(json.dumps(body_data).encode())
            signature = hmac.new(JWT_SECRET.encode(), f"{header}.{body}".encode(), hashlib.sha256).hexdigest()
            return f"{header}.{body}.{b64(signature.encode())}"


        def verify_token(token: str) -> dict | None:
            try:
                header, body, signature = token.split(".")
                expected = hmac.new(JWT_SECRET.encode(), f"{header}.{body}".encode(), hashlib.sha256).hexdigest()
                if not hmac.compare_digest(b64(expected.encode()), signature):
                    return None
                payload = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
                if payload["exp"] < datetime.utcnow().timestamp():
                    return None
                return payload
            except Exception:
                return None


        def require_auth(fn):
            @wraps(fn)
            def wrapper(*args, **kwargs):
                auth = request.headers.get("Authorization", "")
                if not auth.startswith("Bearer "):
                    return error("missing bearer token", 401)
                payload = verify_token(auth.removeprefix("Bearer ").strip())
                if not payload or payload["email"] not in USERS:
                    return error("invalid token", 401)
                g.user = USERS[payload["email"]]
                return fn(*args, **kwargs)
            return wrapper


        @app.post("/api/v1/register")
        def register():
            data = request.get_json(silent=True) or {}
            email = str(data.get("email", "")).strip().lower()
            password = str(data.get("password", ""))
            name = str(data.get("name", "")).strip()
            if "@" not in email:
                return error("valid email is required")
            if len(password) < 8:
                return error("password must have at least 8 characters")
            if email in USERS:
                return error("email already registered", 409)
            USERS[email] = {"email": email, "name": name or email.split("@")[0], "password_hash": password_hash(password)}
            return jsonify({"email": email, "name": USERS[email]["name"]}), 201


        @app.post("/api/v1/login")
        def login():
            data = request.get_json(silent=True) or {}
            email = str(data.get("email", "")).strip().lower()
            password = str(data.get("password", ""))
            user = USERS.get(email)
            if not user or not verify_password(password, user["password_hash"]):
                return error("invalid credentials", 401)
            return jsonify({"access_token": create_token({"email": email})})


        @app.get("/api/v1/me")
        @require_auth
        def me():
            return jsonify({"email": g.user["email"], "name": g.user["name"]})
        ```
        """,
    ),
    (
        "electron_secure_app.md",
        "Crie a base de um app Electron seguro com main, preload e renderer.",
        r"""
        Vou separar responsabilidades entre processo principal, preload e renderer.

        ```typescript
        // main.ts
        import { app, BrowserWindow, ipcMain, shell } from "electron";
        import path from "node:path";

        function createWindow() {
          const win = new BrowserWindow({
            width: 1100,
            height: 720,
            minWidth: 900,
            minHeight: 560,
            webPreferences: {
              preload: path.join(__dirname, "preload.js"),
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
            },
          });

          win.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: "deny" };
          });

          win.loadFile(path.join(__dirname, "index.html"));
        }

        ipcMain.handle("app:version", () => app.getVersion());

        app.whenReady().then(createWindow);
        app.on("window-all-closed", () => {
          if (process.platform !== "darwin") app.quit();
        });
        ```

        ```typescript
        // preload.ts
        import { contextBridge, ipcRenderer } from "electron";

        contextBridge.exposeInMainWorld("nexus", {
          version: () => ipcRenderer.invoke("app:version"),
        });
        ```

        ```typescript
        // renderer.ts
        declare global {
          interface Window {
            nexus: {
              version(): Promise<string>;
            };
          }
        }

        const versionEl = document.querySelector("#version");
        window.nexus.version().then((version) => {
          if (versionEl) versionEl.textContent = version;
        });
        ```
        """,
    ),
    (
        "react_search_component.md",
        "Crie um componente React com busca, estado vazio e lista filtrada.",
        r"""
        ```tsx
        import { useMemo, useState } from "react";

        type Customer = {
          id: string;
          name: string;
          company: string;
          status: "active" | "trial" | "blocked";
        };

        const customers: Customer[] = [
          { id: "1", name: "Ana Ribeiro", company: "Orion Labs", status: "active" },
          { id: "2", name: "Carlos Lima", company: "Atlas Studio", status: "trial" },
          { id: "3", name: "Joana Costa", company: "Aurora Foods", status: "blocked" },
        ];

        export function CustomerSearch() {
          const [query, setQuery] = useState("");

          const filtered = useMemo(() => {
            const term = query.trim().toLowerCase();
            if (!term) return customers;
            return customers.filter((customer) =>
              [customer.name, customer.company, customer.status].some((value) =>
                value.toLowerCase().includes(term),
              ),
            );
          }, [query]);

          return (
            <section className="customer-search" aria-labelledby="customer-search-title">
              <header>
                <div>
                  <p className="eyebrow">Clientes</p>
                  <h2 id="customer-search-title">Carteira ativa</h2>
                </div>
                <label>
                  <span>Buscar</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Nome, empresa ou status"
                  />
                </label>
              </header>

              {filtered.length === 0 ? (
                <p className="empty">Nenhum cliente encontrado para sua busca.</p>
              ) : (
                <ul>
                  {filtered.map((customer) => (
                    <li key={customer.id}>
                      <strong>{customer.name}</strong>
                      <span>{customer.company}</span>
                      <em data-status={customer.status}>{customer.status}</em>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        }
        ```
        """,
    ),
    (
        "bugfix_python.md",
        "Corrija uma função Python que quebra quando recebe lista vazia.",
        r"""
        O problema é dividir pela quantidade de itens sem validar lista vazia. A correção é retornar `0.0` quando não houver valores.

        ```python
        def average(values: list[float]) -> float:
            if not values:
                return 0.0
            return sum(values) / len(values)
        ```

        Teste mínimo:

        ```python
        def test_average_empty_list():
            assert average([]) == 0.0


        def test_average_values():
            assert average([10, 20, 30]) == 20.0
        ```
        """,
    ),
    (
        "patch_response.md",
        "Explique uma alteração como patch revisável.",
        r"""
        Eu criaria um patch pequeno e revisável, limitado ao arquivo afetado.

        ```diff
        diff --git a/src/validator.ts b/src/validator.ts
        --- a/src/validator.ts
        +++ b/src/validator.ts
        @@
        -export function isValidEmail(value: string) {
        -  return value.includes("@");
        -}
        +export function isValidEmail(value: string) {
        +  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
        +}
        ```

        Motivo:

        - rejeita strings sem domínio;
        - remove espaços antes da validação;
        - mantém a função pequena;
        - evita alterar código não relacionado.
        """,
    ),
]


def write_pair(filename: str, instruction: str, response: str) -> None:
    path = OUT_DIR / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    content = f"### Instruction:\n{instruction.strip()}\n\n### Response:\n{dedent(response).strip()}\n"
    path.write_text(content + "\n", encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename, instruction, response in PAIRS:
        write_pair(filename, instruction, response)
    print(f"Premium instruction pairs built: {len(PAIRS)} files in {OUT_DIR}")


if __name__ == "__main__":
    main()
