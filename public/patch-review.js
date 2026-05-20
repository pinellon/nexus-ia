/* global state, $, api, openTab, openFile, setStatus, detectLanguage, basename, escapeHtml, renderOpenFileTabs, renderFileTree, updateSaveStatus, toggleTerminal, logTerminal */

function riskClass(risk) {
  if (risk === "high") return "risk-high";
  if (risk === "medium") return "risk-medium";
  return "risk-low";
}

function riskBadge(risk) {
  const cls = risk === "high" ? "err" : risk === "medium" ? "warn" : "ok";
  return `<span class="badge ${cls} ${riskClass(risk)}">${escapeHtml(risk || "low")}</span>`;
}

function updatePatchTabBadge() {
  const n = state.patches?.length || 0;
  const act = $("#act-patches");
  const badge = $("#patch-tab-badge");
  if (act) act.dataset.count = String(n);
  if (badge) {
    badge.textContent = n > 0 ? String(n) : "";
    badge.style.display = n > 0 ? "inline-flex" : "none";
  }
}

function showPatchReviewEmpty(message) {
  $("#patch-review-empty").style.display = "block";
  $("#patch-review-empty").textContent = message;
  $("#patch-review-layout").style.display = "none";
}

function showPatchReviewPanel() {
  $("#patch-review-empty").style.display = "none";
  $("#patch-review-layout").style.display = "grid";
}

function disposeDiffModels() {
  if (state.diffModels) {
    state.diffModels.original?.dispose();
    state.diffModels.modified?.dispose();
    state.diffModels = null;
  }
}

function ensureMonacoDiff() {
  if (state.monacoDiffReady) return state.monacoDiffReady;
  state.monacoDiffReady = new Promise((resolve, reject) => {
    const fail = () => {
      reject(new Error("Monaco Editor n├úo carregou. Verifique internet ou use build local no pr├│ximo passo."));
    };
    if (!window.require) {
      fail();
      return;
    }
    require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs" } });
    require(["vs/editor/editor.main"], () => {
      if (!state.diffEditor) {
        state.diffEditor = monaco.editor.createDiffEditor($("#monaco-diff-editor"), {
          automaticLayout: true,
          renderSideBySide: state.diffSideBySide,
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false
        });
      }
      resolve(state.diffEditor);
    }, fail);
  });
  return state.monacoDiffReady;
}

function getPatchFileEntries(patch) {
  const files =
    Array.isArray(patch.files_changed) && patch.files_changed.length
      ? patch.files_changed
      : patch.path
        ? [patch.path]
        : [];
  return files.map((filePath) => ({
    path: filePath,
    before: patch.before ?? "",
    after: patch.after ?? patch.content ?? ""
  }));
}

function renderPatchMetadata(patch) {
  $("#patch-review-header").innerHTML = `
    <h3 class="patch-review-title">Patch ${escapeHtml(patch.type || "")} ÔÇö ${escapeHtml(patch.path || patch.files_changed?.[0] || "")}</h3>
    <div class="patch-review-meta">
      <div><span>ID</span><br><strong>${escapeHtml(patch.id)}</strong></div>
      <div><span>Agente</span><br><strong>${escapeHtml(patch.agent_id || "unknown")}</strong></div>
      <div><span>Status</span><br><strong>${escapeHtml(patch.status || "pending")}</strong></div>
      <div><span>Risco</span><br><strong>${riskBadge(patch.risk)}</strong></div>
      <div><span>Criado</span><br><strong>${escapeHtml(patch.created_at || "-")}</strong></div>
      <div><span>Motivo</span><br><strong>${escapeHtml(patch.summary || patch.goal || "-")}</strong></div>
    </div>
  `;
}

function renderPatchFileList(patch, selectedPath) {
  const files = getPatchFileEntries(patch);
  const root = $("#patch-review-files");
  if (files.length <= 1) {
    root.innerHTML = files.length
      ? `<span class="patch-file-btn active">${escapeHtml(files[0].path)}</span>`
      : "";
    return;
  }
  root.innerHTML = files
    .map(
      (file) => `
    <button type="button" class="patch-file-btn ${file.path === selectedPath ? "active" : ""}" data-patch-file="${escapeHtml(file.path)}">
      ${escapeHtml(basename(file.path))}
    </button>
  `
    )
    .join("");
  root.querySelectorAll("[data-patch-file]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activePatchFilePath = btn.dataset.patchFile;
      renderPatchFileList(patch, state.activePatchFilePath);
      showPatchDiff(patch, state.activePatchFilePath);
    });
  });
}

function renderPatchActions(patch) {
  const id = patch.id;
  $("#patch-review-actions").innerHTML = `
    <button class="btn-primary" type="button" onclick="applyPatch('${id}')">Aplicar patch</button>
    <button class="btn-ghost" type="button" style="color:var(--red)" onclick="rejectPatch('${id}')">Rejeitar patch</button>
    <button class="btn-secondary" type="button" onclick="openPatchFile('${escapeHtml(patch.path || patch.files_changed?.[0] || "")}')">Abrir arquivo</button>
    <button class="btn-secondary" type="button" onclick="copyPatchDiff()">Copiar diff</button>
    <button class="btn-secondary" type="button" onclick="togglePatchDiffLayout()">${state.diffSideBySide ? "Diff inline" : "Diff lado a lado"}</button>
    <button class="btn-secondary" type="button" onclick="runPatchCommand('typecheck')">Rodar typecheck</button>
    <button class="btn-secondary" type="button" onclick="runPatchCommand('build')">Rodar build</button>
    <button class="btn-secondary" type="button" onclick="requestAiFixFromPatch()">Corrigir erro com IA</button>
    <button class="btn-ghost" type="button" id="btn-recalc-patch" style="display:none;" onclick="recalculatePatchWithAi()">Recalcular patch com IA</button>
  `;
}

async function showPatchDiff(patch, filePath) {
  await ensureMonacoDiff();
  const entry =
    getPatchFileEntries(patch).find((file) => file.path === filePath) || getPatchFileEntries(patch)[0];
  if (!entry) return;
  const language = detectLanguage(entry.path);
  disposeDiffModels();
  const original = monaco.editor.createModel(entry.before || "", language);
  const modified = monaco.editor.createModel(entry.after || "", language);
  state.diffModels = { original, modified };
  state.diffEditor.setModel({ original, modified });
  state.diffEditor.updateOptions({ renderSideBySide: state.diffSideBySide });
  setTimeout(() => state.diffEditor.layout(), 30);
}

function hideStalePatchAlert() {
  const el = $("#patch-stale-alert");
  el.style.display = "none";
  el.textContent = "";
  const recalc = $("#btn-recalc-patch");
  if (recalc) recalc.style.display = "none";
}

function showStalePatchAlert() {
  const el = $("#patch-stale-alert");
  el.style.display = "block";
  el.textContent = "O arquivo mudou desde que este patch foi criado. Pe├ºa para a IA recalcular o patch.";
  const recalc = $("#btn-recalc-patch");
  if (recalc) recalc.style.display = "inline-flex";
}

function getDirtyPathsForPatch(patch) {
  return getPatchFileEntries(patch)
    .map((file) => file.path)
    .filter((filePath) => state.openedFiles.get(filePath)?.dirty);
}

async function syncOpenFileAfterPatch(filePath, content) {
  const doc = state.openedFiles.get(filePath);
  if (!doc) return;
  doc.content = content ?? doc.content;
  doc.savedContent = doc.content;
  doc.dirty = false;
  if (state.activePath === filePath && state.editor) {
    state.suppressEditorChange = true;
    state.editor.setValue(doc.content);
    state.suppressEditorChange = false;
    updateSaveStatus("salvo");
  }
  renderOpenFileTabs();
  renderFileTree();
}

async function loadPatches() {
  try {
    const res = await api("/api/patches/pending");
    const planPatch = (res.patches || []).find(
      (p) => p.summary === "++PLAN_PROPOSAL++" || p.reason === "++PLAN_PROPOSAL++"
    );
    state.patches = (res.patches || []).filter(
      (p) => p.summary !== "++PLAN_PROPOSAL++" && p.reason !== "++PLAN_PROPOSAL++"
    );

    if (planPatch) {
      if (window.DevMind) window.DevMind.showPlan(planPatch.action || planPatch);
      await api("/api/patches/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionIds: [planPatch.id] })
      }).catch(() => {});
    }

    updatePatchTabBadge();
    renderPatchSidebar();
    if (!state.patches.length) {
      showPatchReviewEmpty("Nenhum patch pendente. Pe├ºa ao Nexus para criar ou modificar algo.");
    } else if (state.activePatchId && !state.patches.find((p) => p.id === state.activePatchId)) {
      state.activePatchId = null;
      state.activePatch = null;
      showPatchReviewEmpty("Selecione um patch pendente na lista.");
    }
  } catch (e) {
    console.error("Falha ao ler patches", e);
  }
}

function renderPatchSidebar() {
  const list = $("#patchListSidebar");
  if (!state.patches.length) {
    list.innerHTML = '<div class="empty-state">Nenhum patch pendente.</div>';
    return;
  }
  list.innerHTML = state.patches
    .map(
      (p) => `
    <div class="patch-sidebar-card ${p.id === state.activePatchId ? "active" : ""}" onclick="viewPatch('${p.id}')">
      <div class="patch-sidebar-type">${escapeHtml(p.type)} ${riskBadge(p.risk)}</div>
      <div class="patch-sidebar-path">${escapeHtml(p.path || p.summary || "-")}</div>
    </div>
  `
    )
    .join("");
}

window.viewPatch = async function viewPatch(id) {
  showBottomPanel("patch");
  try {
    const res = await api("/api/patches/" + encodeURIComponent(id));
    const patch = res.patch || res.data;
    if (!patch) return;
    state.activePatchId = id;
    state.activePatch = patch;
    state.activePatchFilePath = patch.path || patch.files_changed?.[0] || null;
    hideStalePatchAlert();
    showPatchReviewPanel();
    renderPatchMetadata(patch);
    renderPatchFileList(patch, state.activePatchFilePath);
    renderPatchActions(patch);
    renderPatchSidebar();
    await showPatchDiff(patch, state.activePatchFilePath);
  } catch (e) {
    setStatus("Falha ao carregar patch: " + e.message);
  }
};

window.openPatchFile = function openPatchFile(filePath) {
  if (!filePath) return;
  openFile(filePath);
};

window.copyPatchDiff = function copyPatchDiff() {
  const patch = state.activePatch;
  if (!patch?.diff) {
    setStatus("Nenhum diff dispon├¡vel.");
    return;
  }
  navigator.clipboard.writeText(patch.diff);
  setStatus("Diff copiado para a ├írea de transfer├¬ncia.");
};

window.togglePatchDiffLayout = async function togglePatchDiffLayout() {
  state.diffSideBySide = !state.diffSideBySide;
  if (state.diffEditor) {
    state.diffEditor.updateOptions({ renderSideBySide: state.diffSideBySide });
    setTimeout(() => state.diffEditor.layout(), 20);
  }
  if (state.activePatch) renderPatchActions(state.activePatch);
};

window.runPatchCommand = async function runPatchCommand(commandId) {
  showBottomPanel("terminal");
  logTerminal(">> npm run " + commandId);
  try {
    const res = await api("/api/commands/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commandId })
    });
    logTerminal(res.result?.stdout || "");
    logTerminal(res.result?.stderr || "");
    if (res.result?.exitCode !== 0) {
      logTerminal("Comando falhou com c├│digo " + res.result?.exitCode);
      const btn = `<button class="btn-primary" style="margin-top:10px" onclick="requestAiFixFromPatch('Corrija o erro do ${commandId}')">Corrigir erro com IA</button>`;
      $("#terminal-output").innerHTML += "<br>" + btn + "<br>";
    } else {
      logTerminal(">> Sucesso!");
      setStatus(commandId + " conclu├¡do com sucesso.");
    }
  } catch (e) {
    logTerminal("Erro: " + e.message);
  }
};

window.requestAiFixFromPatch = function requestAiFixFromPatch(prefill) {
  const input = $("#devmindChat input");
  if (!input) return;
  input.value = prefill || "Corrija o erro encontrado apos aplicar o patch.";
  input.focus();
  $("#devmindChat form button")?.click();
};

window.recalculatePatchWithAi = function recalculatePatchWithAi() {
  const patch = state.activePatch;
  if (!patch) return;
  requestAiFixFromPatch(
    `Recalcule o patch ${patch.id} para o arquivo ${patch.path || patch.files_changed?.[0] || ""} porque o arquivo mudou desde a proposta original.`
  );
};

window.applyPatch = async function applyPatch(id) {
  const patch = state.activePatch?.id === id ? state.activePatch : state.patches.find((p) => p.id === id);
  if (!patch) return;
  const dirtyPaths = getDirtyPathsForPatch(patch);
  if (dirtyPaths.length) {
    alert(
      "Este arquivo tem altera├º├Áes manuais n├úo salvas. Salve ou descarte antes de aplicar o patch.\n\n" +
        dirtyPaths.join("\n")
    );
    return;
  }
  try {
    hideStalePatchAlert();
    const res = await api(`/api/patches/pending/${id}/apply`, { method: "POST" });
    setStatus("Patch aplicado com sucesso");
    const applied = res.patch || res.data || patch;
    const filePath = applied.path || patch.path || patch.files_changed?.[0];
    const afterContent = applied.after ?? patch.after ?? patch.content ?? "";
    if (filePath) await syncOpenFileAfterPatch(filePath, afterContent);
    state.activePatchId = null;
    state.activePatch = null;
    disposeDiffModels();
    showPatchReviewEmpty("Patch aplicado com sucesso.");
    await loadPatches();
    if (state.project) await loadFiles(state.project.projectPath);
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes("mudou desde")) showStalePatchAlert();
    setStatus("Erro ao aplicar patch: " + msg);
  }
};

window.rejectPatch = async function rejectPatch(id) {
  try {
    await api(`/api/patches/pending/${id}`, { method: "DELETE" });
    setStatus("Patch rejeitado.");
    if (state.activePatchId === id) {
      state.activePatchId = null;
      state.activePatch = null;
      disposeDiffModels();
      showPatchReviewEmpty("Patch rejeitado.");
    }
    await loadPatches();
  } catch (e) {
    setStatus("Erro ao rejeitar patch: " + e.message);
  }
};

document.addEventListener("devmind:action", (event) => {
  const detail = event.detail || {};
  if (detail.value === "patches" || detail.id === "open_patches") {
    showBottomPanel("patch");
    loadPatches();
  }
});
