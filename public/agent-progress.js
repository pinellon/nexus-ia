/* Agent run progress via SSE */
const AGENT_PROGRESS_LABELS = {
  started: "Agente iniciado",
  planning: "Planejando solucao",
  running: "Executando tarefa",
  reading_project: "Analisando projeto",
  tool_call: "Usando ferramenta",
  tool_result: "Ferramenta concluida",
  artifact_created: "Artefato criado",
  patch_created: "Patch proposto",
  file_created: "Arquivo gerado",
  preview_ready: "Preview pronto",
  needs_approval: "Aguardando revisao",
  completed: "Concluido",
  failed: "Falhou",
  cancelled: "Cancelado",
  interrupted: "Interrompido"
};

const AGENT_FINAL_EVENTS = new Set(["completed", "failed", "cancelled", "interrupted", "needs_approval"]);

function friendlyAgentEventLabel(type) {
  return AGENT_PROGRESS_LABELS[type] || type || "Evento";
}

function agentEventClass(event) {
  if (event.level === "error" || event.type === "failed") return "error";
  if (event.level === "warning" || event.type === "needs_approval" || event.type === "interrupted") return "warning";
  if (event.type === "completed") return "success";
  return "info";
}

function formatAgentEventTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString();
  } catch {
    return value;
  }
}

function collectPatchIdsFromEvent(event) {
  const actionIds = event?.payload?.actionIds;
  if (!Array.isArray(actionIds)) return [];
  return actionIds.filter((actionId) => typeof actionId === "string");
}

function mergeAgentPatchIds(ids) {
  const current = new Set(state.agentProgress.patchIds || []);
  for (const id of ids || []) {
    if (typeof id === "string") current.add(id);
  }
  state.agentProgress.patchIds = Array.from(current);
}

function renderAgentProgress() {
  const root = $("#output-body");
  if (!root) return;
  const progress = state.agentProgress;
  const events = progress.events || [];
  const latest = events[events.length - 1];
  const status = latest ? friendlyAgentEventLabel(latest.type) : "Aguardando eventos do agente";
  const isRunning = latest
    ? !AGENT_FINAL_EVENTS.has(latest.type)
    : ["running", "connected", "reconnecting"].includes(progress.status);
  const patchCount = progress.patchIds?.length || 0;

  root.innerHTML = `
    <section class="agent-progress">
      <header class="agent-progress-header">
        <div>
          <div class="agent-progress-kicker">Execucao de agente</div>
          <h3>${escapeHtml(status)}</h3>
          <p>${escapeHtml(progress.currentRunId || "sem run")}</p>
        </div>
        <div class="agent-progress-status ${isRunning ? "running" : agentEventClass(latest || {})}">
          ${isRunning ? '<span class="agent-progress-spinner"></span>' : ""}
          ${escapeHtml(progress.status === "connected" ? "conectado" : progress.status)}
        </div>
      </header>
      ${
        patchCount
          ? `<div class="agent-progress-patches">
              <span>${patchCount} patch(es) aguardando revisao.</span>
              <button type="button" class="btn-primary btn-sm" id="agent-progress-open-patches">Abrir Patch Review</button>
            </div>`
          : ""
      }
      <ol class="agent-progress-timeline">
        ${
          events.length
            ? events
                .map((event) => {
                  const details = event.payload && Object.keys(event.payload).length
                    ? `<details><summary>Detalhes tecnicos</summary><pre>${escapeHtml(JSON.stringify(event.payload, null, 2))}</pre></details>`
                    : "";
                  return `
                    <li class="agent-progress-event ${agentEventClass(event)}">
                      <span class="agent-progress-dot"></span>
                      <div class="agent-progress-event-body">
                        <div class="agent-progress-event-head">
                          <strong>${escapeHtml(friendlyAgentEventLabel(event.type))}</strong>
                          <time>${escapeHtml(formatAgentEventTime(event.createdAt))}</time>
                        </div>
                        <p>${escapeHtml(event.message || friendlyAgentEventLabel(event.type))}</p>
                        ${details}
                      </div>
                    </li>
                  `;
                })
                .join("")
            : '<li class="agent-progress-empty">Conectando ao progresso do agente...</li>'
        }
      </ol>
    </section>
  `;

  $("#agent-progress-open-patches")?.addEventListener("click", () => {
    showBottomPanel("patch");
    if (typeof loadPatches === "function") loadPatches();
  });
  root.scrollTop = root.scrollHeight;
}

function stopAgentProgress() {
  if (state.agentProgress.source) {
    state.agentProgress.source.close();
    state.agentProgress.source = null;
  }
  if (state.agentProgress.reconnectTimer) {
    clearTimeout(state.agentProgress.reconnectTimer);
    state.agentProgress.reconnectTimer = null;
  }
}

function finishAgentProgress(event) {
  state.agentProgress.status = event.type;
  stopAgentProgress();
  renderAgentProgress();

  if (state.agentProgress.patchIds.length && typeof loadPatches === "function") {
    loadPatches();
    if (event.type === "needs_approval") {
      showBottomPanel("patch");
    }
  }
}

function connectAgentProgress(runId) {
  stopAgentProgress();

  const progress = state.agentProgress;
  progress.currentRunId = runId;
  progress.status = "running";
  progress.events = [];
  progress.patchIds = [];
  progress.reconnectAttempts = 0;

  showBottomPanel("output");
  renderAgentProgress();

  const open = () => {
    const source = new EventSource(`/api/agents/runs/${encodeURIComponent(runId)}/events/stream`);
    progress.source = source;
    progress.status = "connected";
    renderAgentProgress();

    source.addEventListener("agent_event", (message) => {
      const event = JSON.parse(message.data);
      progress.events.push(event);
      mergeAgentPatchIds(collectPatchIdsFromEvent(event));
      progress.status = AGENT_FINAL_EVENTS.has(event.type) ? event.type : "running";
      renderAgentProgress();

      if (AGENT_FINAL_EVENTS.has(event.type)) {
        finishAgentProgress(event);
      }
    });

    source.addEventListener("heartbeat", () => {
      progress.status = "connected";
    });

    source.onerror = () => {
      source.close();
      if (!progress.currentRunId || progress.currentRunId !== runId) return;
      const latest = progress.events[progress.events.length - 1];
      if (latest && AGENT_FINAL_EVENTS.has(latest.type)) return;
      if (progress.reconnectAttempts >= 3) {
        progress.status = "interrupted";
        renderAgentProgress();
        return;
      }
      progress.status = "reconnecting";
      progress.reconnectAttempts += 1;
      renderAgentProgress();
      progress.reconnectTimer = setTimeout(open, 1200 * progress.reconnectAttempts);
    };
  };

  open();
}

window.startAgentProgress = connectAgentProgress;
window.stopAgentProgress = stopAgentProgress;
window.mergeAgentPatchIds = mergeAgentPatchIds;
