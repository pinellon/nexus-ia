/* global state, $, api, openFile, setStatus, detectLanguage, basename, escapeHtml, renderOpenFileTabs, renderFileTree, updateSaveStatus, logTerminal, showBottomPanel */

function riskClass(risk) {
  if (risk === 'high') return 'risk-high';
  if (risk === 'medium') return 'risk-medium';
  return 'risk-low';
}

function riskBadge(risk) {
  const safeRisk = risk || 'low';
  const cls = safeRisk === 'high' ? 'err' : safeRisk === 'medium' ? 'warn' : 'ok';
  return `<span class="badge ${cls} ${riskClass(safeRisk)}">${escapeHtml(safeRisk)}</span>`;
}

function patchPrimaryPath(patch) {
  return patch.path || patch.files_changed?.[0] || '';
}

function patchDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getChatInput() {
  return $('#dm-input') || $('#devmindChat textarea') || $('#devmindChat input');
}

function getChatSendButton() {
  return $('#dm-send') || $("#devmindChat button[type='submit']") || $('#devmindChat form button');
}

function updatePatchTabBadge() {
  const n = state.patches?.length || 0;
  const act = $('#act-patches');
  const badge = $('#patch-tab-badge');
  if (act) act.dataset.count = String(n);
  if (badge) {
    badge.textContent = n > 0 ? String(n) : '';
    badge.style.display = n > 0 ? 'inline-flex' : 'none';
  }
}

function showPatchReviewEmpty(message) {
  $('#patch-review-empty').style.display = 'block';
  $('#patch-review-empty').textContent = message;
  $('#patch-review-layout').style.display = 'none';
}

function showPatchReviewPanel() {
  $('#patch-review-empty').style.display = 'none';
  $('#patch-review-layout').style.display = 'flex';
  layoutDiffEditor();
}

function disposeDiffModels() {
  if (state.diffModels) {
    state.diffModels.original?.dispose();
    state.diffModels.modified?.dispose();
    state.diffModels = null;
  }
}

function createDiffEditorInstance() {
  if (state.diffEditor) return state.diffEditor;
  const host = $('#monaco-diff-editor');
  if (!host) throw new Error('Area de diff nao encontrada no painel Patch Review.');
  state.diffEditor = monaco.editor.createDiffEditor(host, {
    automaticLayout: true,
    renderSideBySide: state.diffSideBySide,
    readOnly: true,
    minimap: { enabled: false },
    fontSize: 13,
    scrollBeyondLastLine: false,
    theme: 'vs-dark',
  });
  if (!state.diffResizeObserver && typeof ResizeObserver !== 'undefined') {
    const shell = host.closest('.monaco-diff-shell');
    if (shell) {
      state.diffResizeObserver = new ResizeObserver(() => state.diffEditor?.layout());
      state.diffResizeObserver.observe(shell);
    }
  }
  return state.diffEditor;
}

function ensureMonacoDiff() {
  if (state.monacoDiffReady) return state.monacoDiffReady;
  state.monacoDiffReady = new Promise((resolve, reject) => {
    const fail = () => {
      reject(
        new Error(
          'Monaco Editor nao carregou. Verifique internet ou use build local no proximo passo.',
        ),
      );
    };
    const done = () => {
      try {
        resolve(createDiffEditorInstance());
      } catch (error) {
        reject(error);
      }
    };
    if (typeof monaco !== 'undefined' && monaco.editor?.createDiffEditor) {
      done();
      return;
    }
    if (state.monacoReady) {
      state.monacoReady.then(done).catch(fail);
      return;
    }
    if (!window.require) {
      fail();
      return;
    }
    require.config({
      paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs' },
    });
    require(['vs/editor/editor.main'], done, fail);
  });
  return state.monacoDiffReady;
}

function ensurePatchPanelHeight() {
  const min = Math.min(
    Math.max(460, Math.floor(window.innerHeight * 0.58)),
    Math.max(360, window.innerHeight - 96),
  );
  if (state.layout.bottomCollapsed) state.layout.bottomCollapsed = false;
  if ((state.layout.bottomHeight || 0) < min) {
    state.layout.bottomHeight = min;
    if (typeof applyLayoutCss === 'function') applyLayoutCss();
    if (typeof saveLayoutToStorage === 'function') saveLayoutToStorage();
  }
}

function layoutDiffEditor() {
  if (!state.diffEditor) return;
  setTimeout(() => state.diffEditor.layout(), 40);
  setTimeout(() => state.diffEditor.layout(), 180);
}

async function openPatchesPanel(options = {}) {
  const { patchId, viewDiff = false } = options;
  ensurePatchPanelHeight();
  showBottomPanel('patch');
  await loadPatches();
  const targetId = patchId || (viewDiff && state.patches[0]?.id) || null;
  if (targetId) await viewPatch(targetId);
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
    before: patch.before ?? '',
    after: patch.after ?? patch.content ?? '',
  }));
}

function buildTextualDiffFallback(patch) {
  const filePath = patchPrimaryPath(patch) || 'patch';
  const before = patch.before ?? '';
  const after = patch.after ?? patch.content ?? '';
  return [
    `--- before/${filePath}`,
    `+++ after/${filePath}`,
    '',
    '=== BEFORE ===',
    before || '(empty)',
    '',
    '=== AFTER ===',
    after || '(empty)',
  ].join('\n');
}

function renderPatchMetadata(patch) {
  const id = patch.id;
  const primaryPath = patchPrimaryPath(patch);
  $('#patch-review-header').innerHTML = `
    <div class="patch-review-title-row">
      <h3 class="patch-review-title">Patch ${escapeHtml(patch.type || '')} - ${escapeHtml(primaryPath)}</h3>
      <div class="patch-review-primary-actions">
        <button class="btn-primary btn-sm" type="button" data-apply-patch="${escapeHtml(id)}">Aplicar</button>
        <button class="btn-secondary btn-sm" type="button" data-open-patch-file="${escapeHtml(primaryPath)}">Abrir</button>
        <button class="btn-ghost btn-sm" type="button" style="color:var(--red)" data-reject-patch="${escapeHtml(id)}">Rejeitar</button>
      </div>
    </div>
    <div class="patch-review-meta">
      <div><span>ID</span><br><strong>${escapeHtml(patch.id)}</strong></div>
      <div><span>Agente</span><br><strong>${escapeHtml(patch.agent_id || 'unknown')}</strong></div>
      <div><span>Status</span><br><strong>${escapeHtml(patch.status || 'pending')}</strong></div>
      <div><span>Risco</span><br><strong>${riskBadge(patch.risk)}</strong></div>
      <div><span>Criado</span><br><strong>${escapeHtml(patchDate(patch.created_at))}</strong></div>
      <div><span>Motivo</span><br><strong>${escapeHtml(patch.summary || patch.goal || '-')}</strong></div>
    </div>
  `;
  bindPatchActionButtons($('#patch-review-header'));
}

function renderPatchFileList(patch, selectedPath) {
  const files = getPatchFileEntries(patch);
  const root = $('#patch-review-files');
  if (files.length <= 1) {
    root.innerHTML = files.length
      ? `<span class="patch-file-btn active">${escapeHtml(files[0].path)}</span>`
      : '';
    return;
  }
  root.innerHTML = files
    .map(
      (file) => `
    <button type="button" class="patch-file-btn ${file.path === selectedPath ? 'active' : ''}" data-patch-file="${escapeHtml(file.path)}">
      ${escapeHtml(basename(file.path))}
    </button>
  `,
    )
    .join('');
  root.querySelectorAll('[data-patch-file]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activePatchFilePath = btn.dataset.patchFile;
      renderPatchFileList(patch, state.activePatchFilePath);
      showPatchDiff(patch, state.activePatchFilePath);
    });
  });
}

function renderPatchActions(patch) {
  const id = patch.id;
  $('#patch-review-actions').innerHTML = `
    <button class="btn-primary patch-apply-main" type="button" data-apply-patch="${escapeHtml(id)}">Aplicar patch</button>
    <button class="btn-ghost" type="button" style="color:var(--red)" data-reject-patch="${escapeHtml(id)}">Rejeitar patch</button>
    <button class="btn-secondary" type="button" data-open-patch-file="${escapeHtml(patchPrimaryPath(patch))}">Abrir arquivo</button>
    <button class="btn-secondary" type="button" data-patch-command="copy-diff">Copiar diff textual</button>
    <button class="btn-secondary" type="button" data-patch-command="toggle-diff">${state.diffSideBySide ? 'Diff inline' : 'Diff lado a lado'}</button>
    <button class="btn-secondary" type="button" data-run-patch-command="typecheck">Rodar typecheck</button>
    <button class="btn-secondary" type="button" data-run-patch-command="build">Rodar build</button>
    <button class="btn-secondary" type="button" data-patch-command="ai-fix">Corrigir erro com IA</button>
    <button class="btn-ghost" type="button" id="btn-recalc-patch" style="display:none;" data-patch-command="recalculate">Recalcular patch com IA</button>
  `;
  bindPatchActionButtons($('#patch-review-actions'));
}

function renderPostApplyActions(filePath) {
  const target = $('#patch-review-actions');
  if (!target) return;
  target.innerHTML = `
    <button class="btn-primary" type="button" data-dev-command="typecheck">Rodar typecheck</button>
    <button class="btn-secondary" type="button" data-dev-command="build">Rodar build</button>
    <button class="btn-secondary" type="button" data-patch-command="show-backups">Ver backups</button>
    <button class="btn-secondary" type="button" data-side-view="git">Gerar commit</button>
    ${filePath && filePath.endsWith('.html') ? `<button class="btn-secondary" type="button" data-open-preview="${escapeHtml(filePath)}">Abrir preview</button>` : ''}
  `;
  bindPatchActionButtons(target);
}

function bindPatchActionButtons(root) {
  if (!root) return;
  root.querySelectorAll('[data-apply-patch]').forEach((btn) => {
    btn.addEventListener('click', () => applyPatch(btn.dataset.applyPatch));
  });
  root.querySelectorAll('[data-reject-patch]').forEach((btn) => {
    btn.addEventListener('click', () => rejectPatch(btn.dataset.rejectPatch));
  });
  root.querySelectorAll('[data-open-patch-file]').forEach((btn) => {
    btn.addEventListener('click', () => openPatchFile(btn.dataset.openPatchFile));
  });
  root.querySelectorAll('[data-run-patch-command]').forEach((btn) => {
    btn.addEventListener('click', () => runPatchCommand(btn.dataset.runPatchCommand));
  });
  root.querySelectorAll('[data-dev-command]').forEach((btn) => {
    btn.addEventListener('click', () => runDevCommand(btn.dataset.devCommand));
  });
  root.querySelectorAll('[data-side-view]').forEach((btn) => {
    btn.addEventListener('click', () => activateSideView(btn.dataset.sideView));
  });
  root.querySelectorAll('[data-open-preview]').forEach((btn) => {
    btn.addEventListener('click', () => openProjectPreview(btn.dataset.openPreview));
  });
  root.querySelectorAll('[data-patch-command]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const command = btn.dataset.patchCommand;
      if (command === 'copy-diff') copyPatchDiff();
      if (command === 'toggle-diff') togglePatchDiffLayout();
      if (command === 'ai-fix') requestAiFixFromPatch();
      if (command === 'recalculate') recalculatePatchWithAi();
      if (command === 'show-backups') showBackups();
    });
  });
}

function showPatchAppliedState(filePath) {
  $('#patch-review-empty').style.display = 'none';
  $('#patch-review-layout').style.display = 'flex';
  $('#patch-review-header').innerHTML = `
    <h3 class="patch-review-title">Patch aplicado com sucesso</h3>
    <div class="patch-review-meta">
      <div><span>Arquivo</span><br><strong>${escapeHtml(filePath || '-')}</strong></div>
      <div><span>Proximo passo</span><br><strong>Rodar validacao ou gerar commit</strong></div>
    </div>
  `;
  $('#patch-review-files').innerHTML = '';
  $('#patch-stale-alert').style.display = 'none';
  disposeDiffModels();
  renderPostApplyActions(filePath);
}

async function showPatchDiff(patch, filePath) {
  await ensureMonacoDiff();
  const entry =
    getPatchFileEntries(patch).find((file) => file.path === filePath) ||
    getPatchFileEntries(patch)[0];
  if (!entry) return;
  const language = detectLanguage(entry.path);
  disposeDiffModels();
  const original = monaco.editor.createModel(entry.before || '', language);
  const modified = monaco.editor.createModel(entry.after || '', language);
  state.diffModels = { original, modified };
  state.diffEditor.setModel({ original, modified });
  state.diffEditor.updateOptions({ renderSideBySide: state.diffSideBySide });
  layoutDiffEditor();
}

function hideStalePatchAlert() {
  const el = $('#patch-stale-alert');
  el.style.display = 'none';
  el.textContent = '';
  const recalc = $('#btn-recalc-patch');
  if (recalc) recalc.style.display = 'none';
}

function showStalePatchAlert() {
  const el = $('#patch-stale-alert');
  el.style.display = 'block';
  el.textContent =
    'O arquivo mudou desde que este patch foi criado. Peca para a IA recalcular o patch.';
  const recalc = $('#btn-recalc-patch');
  if (recalc) recalc.style.display = 'inline-flex';
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
    updateSaveStatus('salvo');
  }
  renderOpenFileTabs();
  renderFileTree();
}

async function loadPatches() {
  try {
    const res = await api('/api/patches/pending');
    const planPatch = (res.patches || []).find(
      (p) => p.summary === '++PLAN_PROPOSAL++' || p.reason === '++PLAN_PROPOSAL++',
    );
    state.patches = (res.patches || []).filter(
      (p) => p.summary !== '++PLAN_PROPOSAL++' && p.reason !== '++PLAN_PROPOSAL++',
    );

    if (planPatch) {
      if (window.DevMind) window.DevMind.showPlan(planPatch.action || planPatch);
      await api('/api/patches/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionIds: [planPatch.id] }),
      }).catch(() => {});
    }

    updatePatchTabBadge();
    renderPatchSidebar();
    if (!state.patches.length) {
      showPatchReviewEmpty('Nenhum patch pendente. Peca ao Nexus para criar ou modificar algo.');
    } else if (state.activePatchId && !state.patches.find((p) => p.id === state.activePatchId)) {
      state.activePatchId = null;
      state.activePatch = null;
      showPatchReviewEmpty('Selecione um patch pendente na lista.');
    }
  } catch (e) {
    console.error('Falha ao ler patches', e);
  }
}

function renderPatchSidebar() {
  const list = $('#patchListSidebar');
  if (!state.patches.length) {
    list.innerHTML =
      '<div class="empty-state">Nenhum patch pendente. Peca ao Nexus para criar ou modificar algo.</div>';
    return;
  }
  list.innerHTML = state.patches
    .map((p) => {
      const filePath = patchPrimaryPath(p);
      return `
        <article class="patch-sidebar-card ${p.id === state.activePatchId ? 'active' : ''}" data-patch-card="${escapeHtml(p.id)}" tabindex="0" role="button">
          <div class="patch-sidebar-card-head">
            <span class="patch-sidebar-id">${escapeHtml(p.id)}</span>
            ${riskBadge(p.risk)}
          </div>
          <div class="patch-sidebar-path">${escapeHtml(filePath || '-')}</div>
          <div class="patch-sidebar-meta">
            <span>Agente: ${escapeHtml(p.agent_id || 'unknown')}</span>
            <span>Status: ${escapeHtml(p.status || 'pending')}</span>
            <span>Data: ${escapeHtml(patchDate(p.created_at))}</span>
          </div>
          <p class="patch-sidebar-summary">${escapeHtml(p.summary || p.goal || '-')}</p>
          <div class="patch-sidebar-actions">
            <button type="button" class="btn-primary btn-sm" data-apply-patch="${escapeHtml(p.id)}">Aplicar</button>
            <button type="button" class="btn-secondary btn-sm" data-view-patch="${escapeHtml(p.id)}">Diff</button>
          </div>
        </article>
      `;
    })
    .join('');
  list.querySelectorAll('[data-apply-patch]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      applyPatch(btn.dataset.applyPatch);
    });
  });
  list.querySelectorAll('[data-view-patch]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      viewPatch(btn.dataset.viewPatch);
    });
  });
  list.querySelectorAll('[data-patch-card]').forEach((card) => {
    card.addEventListener('click', () => viewPatch(card.dataset.patchCard));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        viewPatch(card.dataset.patchCard);
      }
    });
  });
}

window.viewPatch = async function viewPatch(id) {
  ensurePatchPanelHeight();
  showBottomPanel('patch');
  try {
    const res = await api('/api/patches/' + encodeURIComponent(id));
    const patch = res.patch || res.data;
    if (!patch) return;
    state.activePatchId = id;
    state.activePatch = patch;
    state.activePatchFilePath = patchPrimaryPath(patch) || null;
    hideStalePatchAlert();
    showPatchReviewPanel();
    renderPatchMetadata(patch);
    renderPatchFileList(patch, state.activePatchFilePath);
    renderPatchActions(patch);
    renderPatchSidebar();
    await showPatchDiff(patch, state.activePatchFilePath);
  } catch (e) {
    setStatus('Falha ao carregar patch: ' + e.message);
  }
};

window.openPatchFile = function openPatchFile(filePath) {
  if (!filePath) return;
  openFile(filePath);
};

window.copyPatchDiff = function copyPatchDiff() {
  const patch = state.activePatch;
  if (!patch) {
    setStatus('Nenhum patch selecionado.');
    return;
  }
  const diffText = patch.diff?.trim() ? patch.diff : buildTextualDiffFallback(patch);
  navigator.clipboard.writeText(diffText);
  setStatus('Diff copiado para a area de transferencia.');
};

window.showBackups = async function showBackups() {
  try {
    const res = await api('/api/backups');
    const backups = res.data || [];
    if (!backups.length) {
      setStatus('Nenhum backup disponivel.');
      return;
    }
    const first = backups[0];
    if (!window.confirm(`Restaurar backup mais recente de ${first.path}?`)) return;
    await api(`/api/backups/${encodeURIComponent(first.id)}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true }),
    });
    setStatus('Backup restaurado: ' + first.path);
    await loadFiles(activeProjectRoot());
    if (state.activePath === first.path) openFile(first.path);
  } catch (error) {
    setStatus('Falha ao restaurar backup: ' + error.message);
  }
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
  if (typeof runDevCommand === 'function') return runDevCommand(commandId);
  setStatus('Executor de comandos indisponivel.');
};

window.requestAiFixFromPatch = function requestAiFixFromPatch(prefill) {
  const input = getChatInput();
  if (!input) return;
  input.value = prefill || 'Corrija o erro encontrado apos aplicar o patch.';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  getChatSendButton()?.click();
};

window.recalculatePatchWithAi = function recalculatePatchWithAi() {
  const patch = state.activePatch;
  if (!patch) return;
  requestAiFixFromPatch(
    `Recalcule o patch ${patch.id} para o arquivo ${patchPrimaryPath(patch)} porque o arquivo mudou desde a proposta original.`,
  );
};

window.applyPatch = async function applyPatch(id) {
  const patch =
    state.activePatch?.id === id ? state.activePatch : state.patches.find((p) => p.id === id);
  if (!patch) return;
  const dirtyPaths = getDirtyPathsForPatch(patch);
  if (dirtyPaths.length) {
    alert(
      'Este arquivo tem alteracoes manuais nao salvas. Salve ou descarte antes de aplicar o patch.\n\n' +
        dirtyPaths.join('\n'),
    );
    return;
  }
  try {
    hideStalePatchAlert();
    const res = await api(`/api/patches/pending/${id}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedHash: patch.expected_hash }),
    });
    setStatus('Patch aplicado com sucesso');
    const applied = res.patch || res.data?.patch || res.data || patch;
    const filePath = applied.path || patchPrimaryPath(patch);
    const afterContent = applied.after ?? patch.after ?? patch.content ?? '';
    if (filePath) await syncOpenFileAfterPatch(filePath, afterContent);
    state.activePatchId = null;
    state.activePatch = null;
    showPatchAppliedState(filePath);
    await loadPatches();
    if (state.project) await loadFiles(activeProjectRoot());
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('mudou desde')) showStalePatchAlert();
    setStatus('Erro ao aplicar patch: ' + msg);
  }
};

window.openProjectPreview = function openProjectPreview(filePath) {
  if (!filePath) return;
  if (typeof openPreviewPanel === 'function') {
    openPreviewPanel(filePath);
    return;
  }
  if (filePath === 'public/index.html' || filePath.endsWith('/index.html')) {
    window.open(
      `/api/project/file?projectRoot=${encodeURIComponent(activeProjectRoot())}&path=${encodeURIComponent(filePath)}`,
      '_blank',
      'noopener,noreferrer',
    );
    return;
  }
  window.open(
    `/api/project/file?projectRoot=${encodeURIComponent(activeProjectRoot())}&path=${encodeURIComponent(filePath)}`,
    '_blank',
    'noopener,noreferrer',
  );
};

window.rejectPatch = async function rejectPatch(id) {
  try {
    await api(`/api/patches/pending/${id}`, { method: 'DELETE' });
    setStatus('Patch rejeitado.');
    if (state.activePatchId === id) {
      state.activePatchId = null;
      state.activePatch = null;
      disposeDiffModels();
      showPatchReviewEmpty('Patch rejeitado.');
    }
    await loadPatches();
  } catch (e) {
    setStatus('Erro ao rejeitar patch: ' + e.message);
  }
};

window.openPatchesPanel = openPatchesPanel;

document.addEventListener('devmind:action', (event) => {
  const detail = event.detail || {};
  if (
    detail.value === 'patches' ||
    detail.id === 'open_patches' ||
    detail.id === 'view_patch_diff'
  ) {
    const patchId = detail.patchId || detail.patchIds?.[0];
    const viewDiff = detail.id === 'view_patch_diff' || detail.openDiff === true;
    openPatchesPanel({ patchId, viewDiff: viewDiff || !!patchId });
  }
  if (detail.type === 'preview' || detail.id === 'open_preview') {
    const url = detail.value || detail.url;
    if (url) {
      if (String(url).startsWith('/preview/')) {
        setStatus('Popout seguro ainda nao esta disponivel para preview local. Use o preview embutido.');
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  }
});
