/* Nexus Codex — DevMind v2
   Lógica de chat simplificada com orchestration mode selector.
   Não expõe nomes de agentes, fases ou JSON interno ao usuário. */
(function (global) {
  "use strict";

  // ── Mapeamento de status amigável ──────────────────────────────────────────
  const FRIENDLY_STATUS = {
    started:   "Analisando projeto...",
    planning:  "Planejando solução...",
    running:   "Gerando patch...",
    reviewing: "Revisando segurança...",
    done:      "Patch pronto para revisão.",
    failed:    "Algo falhou. Veja os detalhes.",
    cancelled: "Operação cancelada."
  };

  const COST_LABEL = { low: "Análise simples", medium: "Análise padrão", high: "Análise avançada" };
  const COST_ICON  = { low: "⚡", medium: "⚙️", high: "🔬" };

  const SUGGESTIONS = [
    "Analisar projeto", "Criar componente", "Corrigir erro",
    "Criar landing page", "Gerar README", "Ver patches"
  ];

  // ── Estado interno ─────────────────────────────────────────────────────────
  const state = {
    history: [],
    busy: false,
    pendingConfirm: null, // { prompt, context, sessionId, decision }
    maxHistory: 24,
    apiBase: "",
    onAction: null,
    onSuccess: null,
    onError: null,
    getContext: null
  };

  // ── Utilidades ─────────────────────────────────────────────────────────────
  function esc(v) {
    return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
  }

  function md(text) {
    let h = esc(text || "");
    h = h.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_,l,c) => `<pre><code>${esc(c.trim())}</code></pre>`);
    h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
    h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    h = h.replace(/\n/g, "<br>");
    return h;
  }

  function dispatch(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
    if (typeof state.onAction === "function") state.onAction(name, detail);
  }

  function scrollBottom() {
    const el = document.getElementById("dm-body");
    if (el) el.scrollTop = el.scrollHeight;
  }

  function trimHistory() {
    if (state.history.length > state.maxHistory)
      state.history = state.history.slice(-state.maxHistory);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function renderProgress(status) {
    return `<div class="dm-progress">
      <span class="dm-spinner"></span>
      <span>${esc(FRIENDLY_STATUS[status] || status)}</span>
    </div>`;
  }

  function renderPatchRow(patchIds, paths) {
    if (!patchIds?.length) return "";
    const count = patchIds.length;
    const firstId = esc(patchIds[0]);
    const pathHint = paths?.length ? esc(paths[0]) : "arquivo do projeto";
    const more = paths?.length > 1 ? ` (+${paths.length - 1})` : "";
    return `<div class="dm-patch-banner" role="alert">
      <span class="dm-patch-banner-icon" aria-hidden="true">!</span>
      <div class="dm-patch-banner-body">
        <strong>${count} patch${count > 1 ? "es" : ""} pronto${count > 1 ? "s" : ""} — revisar e aplicar</strong>
        <p>O Nexus gerou codigo em <code>${pathHint}</code>${more}. Abra <strong>Patch Review</strong> (painel inferior) para ver a prévia antes/depois — nada vai para o disco até você aplicar.</p>
      </div>
      <div class="dm-patch-banner-actions">
        <button type="button" class="dm-btn dm-btn-accent" data-dm-action="open_patches" data-dm-type="view" data-dm-value="patches" data-dm-patch-id="${firstId}">Abrir Patch Review</button>
        <button type="button" class="dm-btn dm-btn-ghost" data-dm-action="view_patch_diff" data-dm-type="view" data-dm-value="patches" data-dm-patch-id="${firstId}">Ver prévia do diff</button>
      </div>
    </div>`;
  }

  function renderPreviewRow(url) {
    if (!url) return "";
    return `<div class="dm-patch-notice">
      <span>Preview pronto para conferir a mudanca visual.</span>
      <button type="button" class="dm-btn dm-btn-accent" data-dm-action="open_preview" data-dm-type="preview" data-dm-value="${esc(url)}">Abrir preview</button>
    </div>`;
  }

  function renderPendingPatchSticky() {
    const last = [...state.history].reverse().find((m) => m.role === "assistant" && m.patchIds?.length);
    if (!last?.patchIds?.length) return "";
    return renderPatchRow(last.patchIds, last.patchPaths);
  }

  function renderTechDetails(data) {
    if (!data) return "";
    const lines = [];
    if (data.agent_id)   lines.push(`Especialista: ${data.agent_id}`);
    if (data.run_id)     lines.push(`Run: ${data.run_id}`);
    if (data.ai?.provider) lines.push(`Motor: ${data.ai.provider}${data.ai.model ? " / " + data.ai.model : ""}`);
    if (data.decision)   lines.push(`Modo: ${data.decision.mode} — ${data.decision.reason}`);
    if (!lines.length) return "";
    return `<details class="dm-tech-details">
      <summary>Ver detalhes técnicos</summary>
      <pre>${esc(lines.join("\n"))}</pre>
    </details>`;
  }

  function renderConfirmBox(decision) {
    return `<div class="dm-confirm-box" id="dm-confirm-box">
      <div class="dm-confirm-title">${COST_ICON.high} Análise avançada necessária</div>
      <div class="dm-confirm-desc">${esc(decision.reason)}<br>Isso usará múltiplos agentes e pode levar mais tempo.</div>
      <div class="dm-confirm-actions">
        <button class="dm-btn dm-btn-accent"  id="dm-confirm-yes">Usar análise avançada</button>
        <button class="dm-btn"                id="dm-confirm-eco">Modo econômico</button>
        <button class="dm-btn dm-btn-danger"  id="dm-confirm-no">Cancelar</button>
      </div>
    </div>`;
  }

  function renderPlanBox(planData) {
    return `<div class="dm-confirm-box" style="border-left: 4px solid var(--yellow); background: rgba(255,193,7,0.05); margin-top: 10px;">
      <div class="dm-confirm-title" style="color: var(--yellow)">📋 Plano de Criação Proposto</div>
      <div class="dm-confirm-desc" style="white-space: pre-wrap; font-family: monospace; font-size:12px; margin-top:10px; text-align: left; background:#111418; padding:8px; border-radius:4px; border:1px solid #2d3748;">${esc(planData.plan)}</div>
      <div class="dm-confirm-actions" style="margin-top:12px;">
        <button class="dm-btn dm-btn-accent" onclick="confirmPlan('${esc(planData.goal)}')">Gerar agora</button>
        <button class="dm-btn" style="color:var(--yellow)" onclick="adjustPlan()">Ajustar plano</button>
        <button class="dm-btn dm-btn-danger" onclick="cancelPlan()">Cancelar</button>
      </div>
    </div>`;
  }

  window.confirmPlan = (goal) => {
    const input = document.getElementById("dm-input");
    if (input) {
      input.value = `++CONFIRM_PLAN++ ${goal}`;
      document.getElementById("dm-send").click();
    }
  };
  window.adjustPlan = () => {
    const input = document.getElementById("dm-input");
    if (input) {
      input.value = "Ajuste o plano: ";
      input.focus();
    }
  };
  window.cancelPlan = () => {
    const body = document.getElementById("dm-body");
    state.history.push({ role: "system", content: "Plano de criação cancelado." });
    renderMessages();
  };

  function renderMessages() {
    const body = document.getElementById("dm-body");
    if (!body) return;

    if (!state.history.length) {
      body.innerHTML = `<div class="dm-empty">
        O Nexus está pronto para analisar o projeto e criar patches revisáveis.
      </div>`;
      return;
    }

    body.innerHTML = state.history.map(msg => {
      const roleLabel = msg.role === "user" ? "Você" : "Nexus";
      const extra = [];
      if (msg.progress) extra.push(renderProgress(msg.progress));
      if (msg.patchIds) extra.push(renderPatchRow(msg.patchIds, msg.patchPaths));
      if (msg.previewUrl) extra.push(renderPreviewRow(msg.previewUrl));
      if (msg.confirmDecision) extra.push(renderConfirmBox(msg.confirmDecision));
      if (msg.techData)  extra.push(renderTechDetails(msg.techData));
      if (msg.planProposal) extra.push(renderPlanBox(msg.planProposal));

      const avatar = msg.role === "user" ? "U" : "N";
      return `<article class="dm-msg dm-msg-${esc(msg.role)}">
        <div class="dm-avatar ${esc(msg.role)}">${avatar}</div>
        <div class="dm-msg-wrap">
          <div class="dm-msg-role">${roleLabel}</div>
          <div class="dm-msg-body">${md(msg.content)}</div>
          ${extra.join("")}
        </div>
      </article>`;
    }).join("");

    // Bind confirm buttons
    const btnYes = document.getElementById("dm-confirm-yes");
    const btnEco = document.getElementById("dm-confirm-eco");
    const btnNo  = document.getElementById("dm-confirm-no");
    if (btnYes) btnYes.addEventListener("click", () => resolveConfirm("advanced"));
    if (btnEco) btnEco.addEventListener("click", () => resolveConfirm("eco"));
    if (btnNo)  btnNo.addEventListener("click",  () => resolveConfirm("cancel"));

    // Bind inline patch/action buttons
    body.querySelectorAll("[data-dm-action]").forEach(node => {
      node.addEventListener("click", () => {
        const patchId = node.getAttribute("data-dm-patch-id");
        dispatch("devmind:action", {
          id:    node.getAttribute("data-dm-action"),
          type:  node.getAttribute("data-dm-type"),
          value: node.getAttribute("data-dm-value"),
          patchId: patchId || undefined,
          openDiff: node.getAttribute("data-dm-action") === "view_patch_diff"
        });
      });
    });

    scrollBottom();
  }

  function setBusy(v) {
    state.busy = v;
    const send  = document.getElementById("dm-send");
    const input = document.getElementById("dm-input");
    const dot   = document.getElementById("dm-status-dot");
    if (send)  send.disabled = v;
    if (input) input.disabled = v;
    if (dot)   dot.className = "dm-dot" + (v ? " dm-dot-busy" : " dm-dot-ok");
  }

  // ── Fluxo principal de envio ───────────────────────────────────────────────
  async function sendText(text) {
    const content = String(text || "").trim();
    if (!content || state.busy) return;

    state.history.push({ role: "user", content });
    trimHistory();
    renderMessages();
    setBusy(true);

    try {
      // 1. Pedir decisão de modo
      const modeRes = await fetch(`${state.apiBase}/api/smart-orchestrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: content })
      });
      const modeData = await modeRes.json();

      if (!modeRes.ok || !modeData.ok) throw new Error(modeData.error || "Falha ao classificar tarefa");

      const decision = modeData.decision;
      const sessionId = modeData.session_id;

      // 2. Custo alto → perguntar antes
      if (modeData.needs_confirmation) {
        state.pendingConfirm = { prompt: content, sessionId, decision };
        state.history.push({
          role: "assistant",
          content: "Identifiquei que essa tarefa pode usar análise avançada com múltiplos agentes.",
          confirmDecision: decision
        });
        trimHistory();
        renderMessages();
        setBusy(false);
        return;
      }

      await executeWithDecision(content, sessionId, decision);
    } catch (err) {
      state.history.push({ role: "system", content: err.message || "Falha ao contatar Nexus." });
      renderMessages();
    } finally {
      setBusy(false);
    }
  }

  async function resolveConfirm(choice) {
    const pending = state.pendingConfirm;
    if (!pending) return;
    state.pendingConfirm = null;

    // Remove confirm box from last message
    const last = state.history[state.history.length - 1];
    if (last?.confirmDecision) delete last.confirmDecision;

    if (choice === "cancel") {
      state.history.push({ role: "system", content: "Operação cancelada." });
      renderMessages();
      return;
    }

    setBusy(true);
    try {
      let decision = pending.decision;
      if (choice === "eco") {
        decision = { ...decision, mode: "single", estimated_cost_level: "low", agents: ["codex"],
          reason: "Modo econômico selecionado pelo usuário." };
      }
      await executeWithDecision(pending.prompt, pending.sessionId, decision);
    } catch (err) {
      state.history.push({ role: "system", content: err.message || "Falha." });
      renderMessages();
    } finally {
      setBusy(false);
    }
  }

  async function executeWithDecision(prompt, sessionId, decision) {
    // Mostrar progresso amigável
    const progressMsg = {
      role: "assistant",
      content: friendlyIntroFor(decision),
      progress: "planning"
    };
    state.history.push(progressMsg);
    trimHistory();
    renderMessages();

    // Chamar code-chat (que internamente aciona agentes especializados)
    const res = await fetch(`${state.apiBase}/api/code-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: buildSystemPrompt(decision) },
          { role: "user",   content: prompt }
        ],
        streaming: false,
        allow_premium: decision.estimated_cost_level === "high",
        force_local:   decision.estimated_cost_level === "low",
        project_context: typeof state.getContext === "function" ? state.getContext() : ""
      })
    });

    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.error || "Falha no Nexus");

    // Atualizar msg de progresso com resultado final
    const idx = state.history.indexOf(progressMsg);
    const summary = buildFriendlySummary(data);
    state.history[idx] = {
      role: "assistant",
      content: summary,
      patchIds: data.patch_ids?.length ? data.patch_ids : null,
      patchPaths: data.patch_paths?.length ? data.patch_paths : null,
      previewUrl: data.preview_url || null,
      techData: data
    };

    trimHistory();
    renderMessages();

    if (typeof state.onSuccess === "function") state.onSuccess(data);
    dispatch("devmind:result", data);
  }

  function friendlyIntroFor(decision) {
    const icons = { single: "⚡", reviewed: "⚙️", consensus: "🔬" };
    const labels = {
      single:    "Vou analisar o projeto e preparar uma proposta.",
      reviewed:  "Vou analisar o projeto e revisar antes de propor.",
      consensus: "Vou executar uma análise aprofundada do projeto."
    };
    return `${icons[decision.mode] || "⚙️"} ${labels[decision.mode] || "Analisando..."}`;
  }

  function buildFriendlySummary(data) {
    if (data.agent_id === "site_builder_agent") {
      return "Criei o site gerado no modo Live Builder. Revise o código no editor e o preview ao lado. Você pode aplicá-lo quando estiver pronto.";
    }
    const patches = data.patch_ids?.length || 0;
    if (patches > 0) {
      return `Patch pronto para revisão. ${patches} arquivo(s) serão alterados.\nRevise o diff antes de aplicar — um backup será criado automaticamente.`;
    }
    return data.message || "Análise concluída.";
  }

  function buildSystemPrompt(decision) {
    return [
      "Você é o Nexus, um assistente avançado de programação.",
      "Se o usuário pedir a criação de um site ou aplicativo, gere o código completo.",
      "Nunca aplique mudanças diretamente. O Nexus usa 'staged files' e 'patches'.",
      `Modo atual: ${decision.mode}. Agentes: ${decision.agents.join(", ")}.`,
      "Quando modificar arquivos, gere ações estruturadas em JSON dentro de bloco markdown json."
    ].join("\n");
  }

  // ── Inicialização do DOM ────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("devmind-v2-styles")) return;
    const s = document.createElement("style");
    s.id = "devmind-v2-styles";
    s.textContent = `
#dm-root { height:100%; min-height:400px; display:grid; grid-template-rows:auto minmax(0,1fr) auto;
  border:1px solid var(--line); border-radius:8px; background:var(--surface); overflow:hidden; }
.dm-head { display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:12px 14px; border-bottom:1px solid var(--line); }
.dm-head-left { display:flex; align-items:center; gap:8px; }
.dm-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.dm-dot-ok   { background:#65d48a; }
.dm-dot-busy { background:#f3c969; animation:dm-pulse 1s infinite; }
@keyframes dm-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
.dm-title { font-size:13px; font-weight:700; }
.dm-muted  { color:var(--muted); font-size:11px; }
.dm-head-right { display:flex; gap:6px; }
.dm-body { min-height:0; overflow-y:auto; padding:14px; display:grid; align-content:start; gap:10px; background:#0d1014; }
.dm-empty { border:1px dashed var(--line); border-radius:8px; padding:14px; color:var(--muted); font-size:13px; }
.dm-msg { border:1px solid var(--line); border-radius:8px; padding:11px 13px; background:var(--surface); max-width:90%; }
.dm-msg-user { justify-self:end; background:#13201f; border-color:rgba(86,214,201,.35); }
.dm-msg-assistant, .dm-msg-system { justify-self:start; }
.dm-msg-role { color:var(--muted); font-size:11px; margin-bottom:5px; font-weight:600; }
.dm-msg-body { font-size:14px; line-height:1.55; }
.dm-msg-body pre { overflow:auto; padding:10px; border-radius:6px; background:#080a0d; border:1px solid var(--line); margin:6px 0; }
.dm-msg-body code { font-family:var(--mono); font-size:12px; }
.dm-progress { display:flex; align-items:center; gap:8px; margin-top:8px;
  color:var(--muted); font-size:12px; }
.dm-spinner { width:12px; height:12px; border:2px solid var(--line); border-top-color:var(--accent);
  border-radius:50%; animation:dm-spin .7s linear infinite; }
@keyframes dm-spin { to{transform:rotate(360deg)} }
.dm-patch-banner{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:10px 14px 14px;padding:12px 14px;border:1px solid rgba(245,158,11,.45);border-radius:10px;background:rgba(245,158,11,.12)}
.dm-patch-banner-icon{width:28px;height:28px;border-radius:8px;background:#f59e0b;color:#000;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.dm-patch-banner-body{flex:1;min-width:180px}
.dm-patch-banner-body strong{display:block;font-size:13px;color:#eae8e0;margin-bottom:4px}
.dm-patch-banner-body p{margin:0;font-size:12px;color:#9e9c96;line-height:1.45}
.dm-patch-banner-body code{font-family:var(--mono);font-size:11px;color:#f59e0b}
.dm-patch-banner-actions{display:flex;gap:8px;flex-shrink:0}
.dm-patch-notice { display:flex; align-items:center; justify-content:space-between; gap:10px;
  margin-top:8px; padding:9px 11px; border:1px solid rgba(86,214,201,.3); border-radius:6px;
  background:#0d201f; font-size:13px; }
.dm-confirm-box { margin-top:10px; border:1px solid rgba(243,201,105,.3); border-radius:8px;
  padding:14px; background:#1a1a0e; }
.dm-confirm-title { font-weight:700; font-size:14px; margin-bottom:6px; }
.dm-confirm-desc { color:var(--muted); font-size:13px; line-height:1.5; margin-bottom:12px; }
.dm-confirm-actions { display:flex; gap:8px; flex-wrap:wrap; }
.dm-tech-details { margin-top:8px; font-size:12px; color:var(--muted); }
.dm-tech-details summary { cursor:pointer; user-select:none; }
.dm-tech-details pre { margin-top:6px; padding:8px; background:#080a0d; border-radius:6px;
  border:1px solid var(--line); white-space:pre-wrap; }
.dm-composer { padding:12px 14px; border-top:1px solid var(--line); display:grid; gap:8px; }
.dm-suggestions { display:flex; gap:6px; flex-wrap:wrap; }
.dm-input-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; }
.dm-input { min-height:76px; resize:vertical; border:1px solid var(--line-strong); border-radius:7px;
  background:#0d1014; color:var(--text); padding:11px 12px; font:inherit; outline:none; }
.dm-input:focus { border-color:var(--accent); box-shadow:0 0 0 2px rgba(86,214,201,.12); }
.dm-btn { min-height:32px; padding:6px 11px; border:1px solid var(--line);
  border-radius:6px; background:var(--surface-2); color:var(--text);
  font:inherit; font-size:12px; font-weight:600; cursor:pointer; }
.dm-btn:disabled { opacity:.5; cursor:wait; }
.dm-btn-accent { border-color:rgba(86,214,201,.45); background:var(--accent); color:#06100f; }
.dm-btn-danger { border-color:rgba(255,107,107,.4); background:rgba(255,107,107,.12); color:#ffd1d1; }
.dm-btn-ghost  { background:transparent; }
`;
    document.head.appendChild(s);
  }

  function renderShell(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div id="dm-root">
      <header class="dm-head">
        <div class="dm-head-left">
          <span class="dm-dot dm-dot-ok" id="dm-status-dot"></span>
          <span class="dm-title">Nexus</span>
          <span class="dm-muted">Assistente de código</span>
        </div>
        <div class="dm-head-right">
          <button class="dm-btn dm-btn-ghost" id="dm-clear">Limpar</button>
        </div>
      </header>
      <section class="dm-body" id="dm-body"></section>
      <footer class="dm-composer">
        <div class="dm-suggestions">
          ${SUGGESTIONS.map(s => `<button class="dm-btn dm-btn-ghost" data-suggest="${esc(s)}">${esc(s)}</button>`).join("")}
        </div>
        <div class="dm-input-row">
          <textarea class="dm-input" id="dm-input" placeholder="Crie, corrija ou melhore algo no projeto..."></textarea>
          <button class="dm-btn dm-btn-accent" id="dm-send">Enviar</button>
        </div>
      </footer>
    </div>`;

    renderMessages();

    document.getElementById("dm-send").addEventListener("click", () => {
      const inp = document.getElementById("dm-input");
      const val = inp.value; inp.value = ""; sendText(val);
    });

    document.getElementById("dm-input").addEventListener("keydown", e => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        const val = e.currentTarget.value; e.currentTarget.value = ""; sendText(val);
      }
    });

    document.getElementById("dm-clear").addEventListener("click", () => {
      state.history = []; renderMessages();
    });

    el.querySelectorAll("[data-suggest]").forEach(btn => {
      btn.addEventListener("click", () => {
        const v = btn.getAttribute("data-suggest");
        if (v === "Ver patches") { dispatch("devmind:action", { id:"open_patches", type:"view", value:"patches" }); return; }
        sendText(v);
      });
    });
  }

  // ── API pública ────────────────────────────────────────────────────────────
  const DevMind = {
    init(options = {}) {
      state.apiBase    = options.apiBase    || "";
      state.maxHistory = options.maxHistory || 24;
      state.onAction   = options.onAction   || null;
      state.onSuccess  = options.onSuccess  || null;
      state.onError    = options.onError    || null;
      state.getContext = options.getContext || null;
      injectStyles();
      renderShell(options.containerId || "chat");
      return DevMind;
    },
    sendText,
    showPlan(planPatch) {
      const lastUserMsg = state.history.filter(m => m.role === "user" && !m.content.includes("++CONFIRM_PLAN++")).pop();
      const goal = lastUserMsg ? lastUserMsg.content : "site";
      
      state.history.push({
        role: "assistant",
        content: "Aqui está o plano para a criação:",
        planProposal: {
          plan: planPatch.content,
          goal: goal,
          patchId: planPatch.id
        }
      });
      renderMessages();
    },
    clear() { state.history = []; renderMessages(); },
    getHistory() { return state.history.slice(); }
  };

  global.DevMind = DevMind;
})(window);
