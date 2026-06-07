"""Build a targeted study pack for NexusAI.

The goal is to add high-signal examples for the behaviors we want:
complete websites, professional UI, safe desktop apps, Flask APIs, and
request-to-code answer patterns.
"""

from __future__ import annotations

from pathlib import Path
from textwrap import dedent


BASE_DIR = Path(__file__).parent
OUT_DIR = BASE_DIR / "data" / "raw" / "user_lessons" / "pro_quality_curriculum"


FILES = {
    "README_CURRICULUM.md": r"""
        # NexusAI Professional Code Curriculum

        This study pack teaches NexusAI to produce complete, inspectable, professional code.

        Core behavior:

        - If the user asks for a site, create the actual first screen, not a marketing explanation.
        - If the user asks for an app, create files that can run, including state, empty states, and errors.
        - Prefer clear structure over clever tricks.
        - Do not mix React JSX into plain HTML.
        - Do not leak training markers such as `<sample>` or `</sample>`.
        - Do not repeat the user's prompt as the answer.
        - Use real content tailored to the business.
        - For desktop apps, use secure Electron defaults.
        - For APIs, validate input and return consistent JSON errors.

        Desired answer shape:

        ```text
        I will create:
        - public/index.html
        - public/styles.css
        - public/app.js

        Here are the files.
        ```

        Then provide complete files.
    """,
    "instruction_pairs/site_confeitaria_answer.md": r"""
        # Instruction Pair: Professional Bakery Website

        USER_REQUEST:
        Crie um site profissional para uma confeitaria artesanal com hero, menu, depoimentos e botao WhatsApp.

        ASSISTANT_SHOULD_CREATE:
        - public/index.html
        - public/styles.css
        - public/app.js

        QUALITY_RULES:
        - Use semantic HTML.
        - Include hero, product menu, proof/testimonials, location, CTA, footer.
        - Use real copy about cakes, sweets, delivery, and custom orders.
        - Use responsive layout.
        - Use WhatsApp CTA.
        - Do not include placeholder lorem ipsum.

        EXPECTED_INDEX_HTML:
        ```html
        <!doctype html>
        <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Atelie Dona Nuvem - Confeitaria Artesanal</title>
          <link rel="stylesheet" href="styles.css">
          <script src="app.js" defer></script>
        </head>
        <body>
          <header class="site-header">
            <a class="brand" href="#top">Atelie Dona Nuvem</a>
            <nav aria-label="Principal">
              <a href="#menu">Menu</a>
              <a href="#depoimentos">Depoimentos</a>
              <a href="#encomendas">Encomendas</a>
            </nav>
          </header>

          <main id="top">
            <section class="hero">
              <div class="hero__content">
                <p class="eyebrow">Bolos sob encomenda em ate 48h</p>
                <h1>Confeitaria artesanal para celebrar com acabamento premium.</h1>
                <p>
                  Bolos, doces finos e kits festa preparados com massa fresca,
                  recheios generosos e decoracao alinhada ao seu evento.
                </p>
                <div class="hero__actions">
                  <a class="button button--primary" href="https://wa.me/5511999999999">Pedir pelo WhatsApp</a>
                  <a class="button" href="#menu">Ver sabores</a>
                </div>
              </div>
              <figure class="hero__image">
                <img src="assets/bakery-hero.webp" alt="Bolo artesanal decorado com frutas">
              </figure>
            </section>

            <section class="metrics" aria-label="Indicadores">
              <article><strong>4.9/5</strong><span>Avaliacao media</span></article>
              <article><strong>820+</strong><span>Pedidos entregues</span></article>
              <article><strong>24h</strong><span>Resposta para orcamento</span></article>
            </section>

            <section id="menu" class="section">
              <div class="section__header">
                <p class="eyebrow">Mais pedidos</p>
                <h2>Menu com sabores que vendem bem</h2>
              </div>
              <div class="cards">
                <article class="card">
                  <h3>Bolo Ninho com Morango</h3>
                  <p>Massa branca, creme de Ninho e morangos frescos.</p>
                  <strong>a partir de R$ 129</strong>
                </article>
                <article class="card">
                  <h3>Chocolate Belga</h3>
                  <p>Massa de cacau, brigadeiro belga e ganache brilhante.</p>
                  <strong>a partir de R$ 149</strong>
                </article>
                <article class="card">
                  <h3>Kit Festa</h3>
                  <p>Doces, mini tortas e bolo combinando para ate 20 pessoas.</p>
                  <strong>a partir de R$ 219</strong>
                </article>
              </div>
            </section>

            <section id="depoimentos" class="section section--soft">
              <div class="section__header">
                <p class="eyebrow">Clientes reais</p>
                <h2>Entrega bonita, sabor consistente</h2>
              </div>
              <div class="quotes">
                <blockquote>O bolo chegou intacto, lindo e com recheio perfeito. Virou nosso fornecedor fixo.</blockquote>
                <blockquote>Atendimento rapido, sugestoes boas e acabamento melhor que a referencia.</blockquote>
              </div>
            </section>

            <section id="encomendas" class="cta">
              <h2>Quer reservar sua data?</h2>
              <p>Envie data, quantidade de convidados e referencias visuais para receber um orcamento.</p>
              <a class="button button--primary" href="https://wa.me/5511999999999">Falar no WhatsApp</a>
            </section>
          </main>

          <footer>
            <span>Atelie Dona Nuvem</span>
            <span>Retirada em Sao Paulo - entregas sob consulta</span>
          </footer>
        </body>
        </html>
        ```
    """,
    "websites/coworking_site/index.html": r"""
        <!doctype html>
        <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Nodo Coworking - Escritórios Flexíveis</title>
          <link rel="stylesheet" href="styles.css">
          <script src="app.js" defer></script>
        </head>
        <body>
          <header class="topbar">
            <a class="brand" href="#">Nodo</a>
            <nav aria-label="Principal">
              <a href="#planos">Planos</a>
              <a href="#estrutura">Estrutura</a>
              <a href="#contato">Contato</a>
            </nav>
            <a class="button button--small" href="#contato">Agendar visita</a>
          </header>

          <main>
            <section class="hero">
              <div>
                <p class="eyebrow">Coworking para times enxutos</p>
                <h1>Salas prontas, contrato flexível e infraestrutura cuidada.</h1>
                <p class="lead">
                  Trabalhe em um espaço profissional com internet redundante, salas de reunião,
                  endereço comercial e recepção para seus clientes.
                </p>
                <div class="actions">
                  <a class="button" href="#planos">Ver planos</a>
                  <a class="button button--ghost" href="#estrutura">Conhecer estrutura</a>
                </div>
              </div>
              <aside class="hero-card" aria-label="Resumo">
                <strong>R$ 39/dia</strong>
                <span>day pass com café, internet e cabine de foco</span>
              </aside>
            </section>

            <section id="planos" class="section">
              <div class="section-title">
                <p class="eyebrow">Planos</p>
                <h2>Escolha conforme a rotina do seu time</h2>
              </div>
              <div class="cards">
                <article class="card">
                  <h3>Day Pass</h3>
                  <p>Ideal para visitas pontuais e reuniões presenciais.</p>
                  <strong>R$ 39</strong>
                </article>
                <article class="card card--featured">
                  <h3>Mesa Fixa</h3>
                  <p>Estação dedicada, armário e acesso estendido.</p>
                  <strong>R$ 690/mês</strong>
                </article>
                <article class="card">
                  <h3>Sala Privativa</h3>
                  <p>Ambiente fechado para times de 3 a 12 pessoas.</p>
                  <strong>sob consulta</strong>
                </article>
              </div>
            </section>

            <section id="estrutura" class="features">
              <article><span>01</span><h3>Internet redundante</h3><p>Duas operadoras e rede cabeada nas salas.</p></article>
              <article><span>02</span><h3>Recepção</h3><p>Atendimento para clientes, entregas e visitantes.</p></article>
              <article><span>03</span><h3>Reuniões</h3><p>Salas equipadas com TV, quadro e reserva online.</p></article>
            </section>

            <section id="contato" class="contact">
              <div>
                <p class="eyebrow">Agenda</p>
                <h2>Marque uma visita guiada</h2>
                <p>Retornamos em até uma hora útil com horários disponíveis.</p>
              </div>
              <form>
                <label>Nome<input name="name" required></label>
                <label>Email<input name="email" type="email" required></label>
                <label>Interesse<select name="plan"><option>Day Pass</option><option>Mesa Fixa</option><option>Sala Privativa</option></select></label>
                <button class="button" type="submit">Solicitar contato</button>
              </form>
            </section>
          </main>
        </body>
        </html>
    """,
    "websites/coworking_site/styles.css": r"""
        :root {
          --bg: #f5f7fb;
          --text: #172033;
          --muted: #667085;
          --panel: #ffffff;
          --line: #d9dee8;
          --brand: #0f766e;
          --brand-dark: #115e59;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        * { box-sizing: border-box; }
        body { margin: 0; background: var(--bg); color: var(--text); }
        a { color: inherit; }

        .topbar {
          min-height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 0 5vw;
          background: rgba(255,255,255,.92);
          border-bottom: 1px solid var(--line);
          position: sticky;
          top: 0;
          backdrop-filter: blur(14px);
          z-index: 10;
        }

        .brand { font-weight: 900; font-size: 24px; text-decoration: none; }
        nav { display: flex; gap: 18px; flex-wrap: wrap; }
        nav a { color: var(--muted); font-weight: 700; text-decoration: none; }
        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 18px;
          border-radius: 6px;
          background: var(--brand);
          color: white;
          border: 1px solid var(--brand);
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
        }
        .button--ghost { background: transparent; color: var(--brand-dark); }
        .button--small { min-height: 38px; }

        main { padding: 42px 5vw 72px; }
        .hero {
          min-height: 520px;
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(280px, .6fr);
          gap: 30px;
          align-items: center;
        }
        .eyebrow { color: var(--brand-dark); font-weight: 900; text-transform: uppercase; font-size: 13px; }
        h1 { font-size: clamp(42px, 7vw, 76px); line-height: .96; margin: 12px 0 18px; max-width: 900px; }
        .lead { color: var(--muted); font-size: 19px; line-height: 1.7; max-width: 720px; }
        .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 26px; }
        .hero-card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 28px;
          display: grid;
          gap: 10px;
          box-shadow: 0 18px 60px rgba(15, 23, 42, .08);
        }
        .hero-card strong { font-size: 44px; }
        .hero-card span { color: var(--muted); line-height: 1.5; }
        .section { padding: 52px 0; }
        .section-title { max-width: 720px; margin-bottom: 22px; }
        h2 { font-size: clamp(28px, 4vw, 44px); line-height: 1.08; margin: 0; }
        .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 22px;
        }
        .card--featured { border-color: var(--brand); box-shadow: 0 16px 50px rgba(15,118,110,.12); }
        .card h3 { margin: 0 0 10px; }
        .card p { color: var(--muted); line-height: 1.6; }
        .card strong { font-size: 24px; }
        .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 28px 0; }
        .features article, .contact {
          background: #101828;
          color: white;
          border-radius: 8px;
          padding: 24px;
        }
        .features span { color: #5eead4; font-weight: 900; }
        .features p { color: #cbd5e1; line-height: 1.6; }
        .contact { margin-top: 42px; display: grid; grid-template-columns: .8fr 1fr; gap: 24px; }
        form { display: grid; gap: 12px; }
        label { display: grid; gap: 6px; font-weight: 700; }
        input, select { width: 100%; min-height: 42px; border-radius: 6px; border: 1px solid #475467; padding: 0 12px; }

        @media (max-width: 860px) {
          .topbar { align-items: flex-start; flex-direction: column; padding: 16px 5vw; }
          .hero, .cards, .features, .contact { grid-template-columns: 1fr; }
          h1 { font-size: 42px; }
        }
    """,
    "websites/coworking_site/app.js": r"""
        const form = document.querySelector("form");

        form?.addEventListener("submit", (event) => {
          event.preventDefault();
          const data = new FormData(form);
          const name = String(data.get("name") || "").trim();
          const email = String(data.get("email") || "").trim();

          if (!name || !email.includes("@")) {
            alert("Preencha nome e email valido para solicitar contato.");
            return;
          }

          alert(`Obrigado, ${name}. A equipe Nodo vai retornar no email ${email}.`);
          form.reset();
        });
    """,
    "backend/flask_tasks_api.py": r"""
        from __future__ import annotations

        from dataclasses import asdict, dataclass
        from datetime import datetime
        from uuid import uuid4

        from flask import Flask, jsonify, request


        app = Flask(__name__)


        @dataclass
        class Task:
            id: str
            title: str
            status: str
            priority: str
            created_at: str


        TASKS: dict[str, Task] = {}
        VALID_STATUSES = {"todo", "doing", "done"}
        VALID_PRIORITIES = {"low", "medium", "high"}


        def error(message: str, status: int = 400):
            return jsonify({"error": message}), status


        def parse_json_body():
            if not request.is_json:
                return None, error("Content-Type must be application/json", 415)
            data = request.get_json(silent=True)
            if not isinstance(data, dict):
                return None, error("Invalid JSON body")
            return data, None


        @app.post("/api/v1/tasks")
        def create_task():
            data, err = parse_json_body()
            if err:
                return err

            title = str(data.get("title", "")).strip()
            status = str(data.get("status", "todo")).strip()
            priority = str(data.get("priority", "medium")).strip()

            if len(title) < 3:
                return error("title must have at least 3 characters")
            if status not in VALID_STATUSES:
                return error(f"status must be one of: {', '.join(sorted(VALID_STATUSES))}")
            if priority not in VALID_PRIORITIES:
                return error(f"priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}")

            task = Task(
                id=str(uuid4()),
                title=title,
                status=status,
                priority=priority,
                created_at=datetime.utcnow().isoformat() + "Z",
            )
            TASKS[task.id] = task
            return jsonify(asdict(task)), 201


        @app.get("/api/v1/tasks")
        def list_tasks():
            status = request.args.get("status")
            tasks = list(TASKS.values())
            if status:
                tasks = [task for task in tasks if task.status == status]
            return jsonify({"items": [asdict(task) for task in tasks], "total": len(tasks)})


        @app.patch("/api/v1/tasks/<task_id>")
        def update_task(task_id: str):
            task = TASKS.get(task_id)
            if not task:
                return error("task not found", 404)

            data, err = parse_json_body()
            if err:
                return err

            if "title" in data:
                title = str(data["title"]).strip()
                if len(title) < 3:
                    return error("title must have at least 3 characters")
                task.title = title

            if "status" in data:
                status = str(data["status"]).strip()
                if status not in VALID_STATUSES:
                    return error("invalid status")
                task.status = status

            if "priority" in data:
                priority = str(data["priority"]).strip()
                if priority not in VALID_PRIORITIES:
                    return error("invalid priority")
                task.priority = priority

            return jsonify(asdict(task))


        if __name__ == "__main__":
            app.run(host="127.0.0.1", port=8080, debug=True)
    """,
    "backend/test_flask_tasks_api.py": r"""
        from flask_tasks_api import app


        def test_create_task_requires_json():
            client = app.test_client()
            response = client.post("/api/v1/tasks", data="title=x")
            assert response.status_code == 415


        def test_create_task_validates_title():
            client = app.test_client()
            response = client.post("/api/v1/tasks", json={"title": ""})
            assert response.status_code == 400
            assert response.get_json()["error"] == "title must have at least 3 characters"


        def test_create_and_list_task():
            client = app.test_client()
            created = client.post("/api/v1/tasks", json={"title": "Build landing page", "priority": "high"})
            assert created.status_code == 201
            task = created.get_json()
            assert task["title"] == "Build landing page"

            listed = client.get("/api/v1/tasks")
            assert listed.status_code == 200
            assert listed.get_json()["total"] >= 1
    """,
    "react/task_board_component.tsx": r"""
        import { useMemo, useState } from "react";

        type Status = "todo" | "doing" | "done";

        type Task = {
          id: string;
          title: string;
          owner: string;
          status: Status;
          priority: "low" | "medium" | "high";
        };

        const initialTasks: Task[] = [
          { id: "1", title: "Criar hero da landing page", owner: "Nicolas", status: "doing", priority: "high" },
          { id: "2", title: "Validar formulario de contato", owner: "NexusAI", status: "todo", priority: "medium" },
          { id: "3", title: "Publicar preview", owner: "Nicolas", status: "done", priority: "low" },
        ];

        const columns: { id: Status; title: string }[] = [
          { id: "todo", title: "A fazer" },
          { id: "doing", title: "Em andamento" },
          { id: "done", title: "Concluido" },
        ];

        export function TaskBoard() {
          const [tasks, setTasks] = useState(initialTasks);
          const [query, setQuery] = useState("");

          const filteredTasks = useMemo(() => {
            const term = query.trim().toLowerCase();
            if (!term) return tasks;
            return tasks.filter((task) =>
              [task.title, task.owner, task.priority].some((value) => value.toLowerCase().includes(term)),
            );
          }, [query, tasks]);

          function moveTask(taskId: string, status: Status) {
            setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status } : task)));
          }

          return (
            <section className="task-board" aria-labelledby="task-board-title">
              <header className="task-board__header">
                <div>
                  <p className="eyebrow">Operacao</p>
                  <h2 id="task-board-title">Quadro de entregas</h2>
                </div>
                <label>
                  <span>Buscar tarefa</span>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, dono ou prioridade" />
                </label>
              </header>

              <div className="task-board__columns">
                {columns.map((column) => {
                  const columnTasks = filteredTasks.filter((task) => task.status === column.id);
                  return (
                    <article className="task-column" key={column.id}>
                      <h3>{column.title}</h3>
                      {columnTasks.length === 0 ? (
                        <p className="empty">Nenhuma tarefa nesta coluna.</p>
                      ) : (
                        columnTasks.map((task) => (
                          <div className="task-card" data-priority={task.priority} key={task.id}>
                            <strong>{task.title}</strong>
                            <span>{task.owner}</span>
                            <div className="task-card__actions">
                              {columns.map((target) => (
                                <button key={target.id} type="button" onClick={() => moveTask(task.id, target.id)}>
                                  {target.title}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        }
    """,
    "electron/secure_preload.ts": r"""
        import { contextBridge, ipcRenderer } from "electron";

        type NoteInput = {
          id?: string;
          title: string;
          body: string;
        };

        const api = {
          listNotes: () => ipcRenderer.invoke("notes:list"),
          saveNote: (note: NoteInput) => ipcRenderer.invoke("notes:save", note),
          deleteNote: (id: string) => ipcRenderer.invoke("notes:delete", id),
        };

        contextBridge.exposeInMainWorld("nexusNotes", api);

        export type NexusNotesApi = typeof api;
    """,
    "electron/renderer_notes_app.ts": r"""
        type Note = {
          id: string;
          title: string;
          body: string;
          updatedAt: string;
        };

        declare global {
          interface Window {
            nexusNotes: {
              listNotes(): Promise<Note[]>;
              saveNote(note: Partial<Note>): Promise<Note>;
              deleteNote(id: string): Promise<{ deleted: boolean }>;
            };
          }
        }

        const list = document.querySelector<HTMLDivElement>("#notes-list");
        const form = document.querySelector<HTMLFormElement>("#note-form");
        const titleInput = document.querySelector<HTMLInputElement>("#title");
        const bodyInput = document.querySelector<HTMLTextAreaElement>("#body");

        async function renderNotes() {
          if (!list) return;
          const notes = await window.nexusNotes.listNotes();
          list.innerHTML = "";

          if (notes.length === 0) {
            list.innerHTML = `<p class="empty">Nenhuma nota criada ainda.</p>`;
            return;
          }

          for (const note of notes) {
            const card = document.createElement("article");
            card.className = "note-card";
            card.innerHTML = `
              <h3></h3>
              <p></p>
              <button type="button">Excluir</button>
            `;
            card.querySelector("h3")!.textContent = note.title;
            card.querySelector("p")!.textContent = note.body;
            card.querySelector("button")!.addEventListener("click", async () => {
              await window.nexusNotes.deleteNote(note.id);
              await renderNotes();
            });
            list.appendChild(card);
          }
        }

        form?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const title = titleInput?.value.trim() || "";
          const body = bodyInput?.value.trim() || "";

          if (title.length < 3) {
            alert("Informe um titulo com pelo menos 3 caracteres.");
            return;
          }

          await window.nexusNotes.saveNote({ title, body });
          form.reset();
          await renderNotes();
        });

        renderNotes();
    """,
    "quality/anti_patterns.md": r"""
        # Anti-patterns NexusAI must avoid

        Bad answer:

        ```html
        Crie um site para uma confeitaria...
        <article><h3>Massa cacaption></figcaveludada
        </sample>
        ```

        Why it is bad:

        - repeats the prompt;
        - leaks training tags;
        - broken HTML;
        - random words;
        - mixed incomplete tags.

        Good answer:

        ```html
        <!doctype html>
        <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Confeitaria Dona Nuvem</title>
        </head>
        <body>
          <main>
            <section class="hero">
              <h1>Bolos artesanais para festas memoraveis</h1>
              <a href="https://wa.me/5511999999999">Pedir pelo WhatsApp</a>
            </section>
          </main>
        </body>
        </html>
        ```

        The model should prefer complete syntax and fewer features over broken ambitious output.
    """,
}


def write_file(relative_path: str, content: str) -> None:
    path = OUT_DIR / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(dedent(content).strip() + "\n", encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for relative_path, content in FILES.items():
        write_file(relative_path, content)
    print(f"Professional curriculum built: {len(FILES)} files in {OUT_DIR}")


if __name__ == "__main__":
    main()
