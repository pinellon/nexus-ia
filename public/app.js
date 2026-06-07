/* Nexus IDE — core state, API, utilities */
const state = {
  project: null,
  appRoot: null,
  activeProject: null,
  files: [],
  tree: [],
  patches: [],
  stagedFiles: [],
  agentProgress: {
    currentRunId: null,
    status: 'idle',
    events: [],
    patchIds: [],
    source: null,
    reconnectAttempts: 0,
    reconnectTimer: null,
  },
  aiConfig: null,
  localAuthToken: null,
  activeFile: null,
  activePath: null,
  openedFiles: new Map(),
  expandedDirs: new Set(['']),
  editor: null,
  monacoReady: null,
  diffEditor: null,
  diffModels: null,
  monacoDiffReady: null,
  diffSideBySide: true,
  activePatchId: null,
  activePatch: null,
  activePatchFilePath: null,
  suppressEditorChange: false,
  saveStatus: 'sem arquivo',
  cursorLine: 1,
  cursorCol: 1,
  layout: {
    sidebarWidth: 260,
    aiWidth: 360,
    bottomHeight: 220,
    aiCollapsed: false,
    bottomCollapsed: false,
    sidebarCollapsed: false,
  },
};

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function setStatus(msg) {
  const el = $('#status-msg');
  if (el) el.textContent = msg;
}

async function api(path, options = {}) {
  if (
    !state.localAuthToken &&
    String(path).startsWith('/api/') &&
    !String(path).startsWith('/api/local-auth/bootstrap')
  ) {
    await loadLocalAuthToken();
  }
  const headers = new Headers(options.headers || {});
  if (state.localAuthToken) {
    headers.set('X-Nexus-Request', 'true');
    headers.set('X-Nexus-Token', state.localAuthToken);
  }
  const requestOptions = { ...options, headers };
  let res = await fetch(path, requestOptions);
  if (res.status === 409) {
    const confirmation = await res.json().catch(() => ({}));
    if (
      confirmation?.requiresConfirmation &&
      window.confirm(confirmation.message || 'Confirmar operacao?')
    ) {
      const retryHeaders = new Headers(requestOptions.headers || {});
      retryHeaders.set('X-Nexus-Request', 'true');
      if (state.localAuthToken) retryHeaders.set('X-Nexus-Token', state.localAuthToken);
      const retryOptions = { ...requestOptions, headers: retryHeaders };
      const method = String(retryOptions.method || 'GET').toUpperCase();
      if (method === 'GET' || method === 'DELETE') {
        const url = new URL(path, window.location.origin);
        url.searchParams.set('confirm', 'true');
        res = await fetch(url.pathname + url.search, retryOptions);
      } else {
        const currentBody = retryOptions.body ? JSON.parse(retryOptions.body) : {};
        retryOptions.body = JSON.stringify({ ...currentBody, confirmed: true });
        retryHeaders.set('Content-Type', 'application/json');
        res = await fetch(path, retryOptions);
      }
    } else {
      throw new Error(confirmation?.message || 'Operacao cancelada');
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

async function loadLocalAuthToken() {
  if (state.localAuthToken) return;

  const res = await fetch('/api/local-auth/bootstrap', {
    headers: { 'X-Nexus-Request': 'bootstrap' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Falha ao inicializar token local do Nexus');
  }
  const data = await res.json();
  if (!data.localSecurity?.token) {
    throw new Error('Token local do Nexus nao foi retornado');
  }
  state.localAuthToken = data.localSecurity.token;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function basename(filePath) {
  return (
    String(filePath || '')
      .split('/')
      .pop() || filePath
  );
}

function dirname(filePath) {
  const parts = String(filePath || '').split('/');
  parts.pop();
  return parts.join('/');
}

function activeProjectRoot() {
  return (
    state.activeProject?.root || state.project?.root || state.project?.projectPath || 'workspace'
  );
}

function activeProjectName() {
  return state.activeProject?.name || state.project?.projectName || 'workspace';
}

function activeProjectAbsoluteRoot() {
  return state.activeProject?.absoluteRoot || state.project?.absoluteRoot || '';
}

function flattenTree(nodes, files = []) {
  (nodes || []).forEach((node) => {
    if (node.type === 'file') files.push(node);
    if (node.children?.length) flattenTree(node.children, files);
  });
  return files;
}

function fileIcon(node) {
  if (node.type === 'directory') return '📁';
  const ext = String(node.name || node.path || '')
    .split('.')
    .pop()
    ?.toLowerCase();
  const map = {
    ts: 'TS',
    tsx: 'TS',
    js: 'JS',
    jsx: 'JS',
    json: '{}',
    html: '◇',
    css: '#',
    md: 'M',
    py: 'Py',
  };
  return map[ext] || '·';
}

function summarizeProjectTree(nodes, depth = 0, lines = []) {
  if (lines.length >= 80) return lines;
  (nodes || []).forEach((node) => {
    if (lines.length >= 80) return;
    lines.push(`${'  '.repeat(depth)}- ${node.path}`);
    if (node.type === 'directory') summarizeProjectTree(node.children || [], depth + 1, lines);
  });
  return lines;
}

function buildIDEContext() {
  const activeDoc = state.activePath ? state.openedFiles.get(state.activePath) : null;
  let activeContent = '';
  let selection = '';

  if (activeDoc && state.editor && state.activePath === activeDoc.path) {
    activeContent = state.editor.getValue();
    const sel = state.editor.getSelection();
    if (sel && !sel.isEmpty()) {
      selection = state.editor.getModel()?.getValueInRange(sel) || '';
    }
  } else if (activeDoc) {
    activeContent = activeDoc.content;
  }

  return [
    `Projeto ativo: ${activeProjectRoot()}`,
    `Arquivo ativo: ${activeDoc?.path || 'nenhum'}`,
    `Arquivo modificado: ${activeDoc?.dirty ? 'sim' : 'nao'}`,
    `Arquivos abertos: ${Array.from(state.openedFiles.keys()).join(', ') || 'nenhum'}`,
    selection ? `Selecao atual:\n${selection.slice(0, 2000)}` : 'Selecao atual: nenhuma',
    '',
    'Conteudo atual do arquivo ativo:',
    activeContent.slice(0, 6000),
    activeContent.length > 6000 ? '\n...[conteudo truncado pela IDE]' : '',
    '',
    'Arvore resumida do projeto:',
    summarizeProjectTree(state.tree).join('\n'),
  ].join('\n');
}

function updateBreadcrumb(filePath) {
  const el = $('#editor-breadcrumb');
  if (!el) return;
  if (!filePath) {
    el.innerHTML = '<span class="breadcrumb-part">Nenhum arquivo</span>';
    return;
  }
  const parts = filePath.split('/');
  el.innerHTML = parts
    .map((part, i) => {
      const sep = i < parts.length - 1 ? '<span class="breadcrumb-sep">›</span>' : '';
      return `<span class="breadcrumb-part">${escapeHtml(part)}</span>${sep}`;
    })
    .join('');
}

function updateCursorStatus() {
  const el = $('#status-cursor');
  if (el) el.textContent = `Ln ${state.cursorLine}, Col ${state.cursorCol}`;
}

async function loadHealth() {
  await loadLocalAuthToken();
  const res = await api('/api/health');
  if (res.localSecurity?.token) {
    state.localAuthToken = res.localSecurity.token;
  }
  state.appRoot = res.appRoot || res.projectRoot || null;
  state.activeProject = res.activeProject || null;
  state.project = {
    ...(res.project || {}),
    projectName: activeProjectName(),
    projectPath: activeProjectRoot(),
    root: activeProjectRoot(),
    absoluteRoot: state.activeProject?.absoluteRoot,
  };
  const proj = $('#status-project');
  if (proj) proj.textContent = `Projeto: ${activeProjectName()}`;
  const mode = $('#status-mode');
  if (mode) mode.textContent = `IA: ${res.mode || 'Auto'}`;
  const providerLabel = $('#status-provider-label');
  if (providerLabel) {
    const provider = res.ai?.provider || res.provider || res.mode || 'auto';
    const model = res.ai?.model || res.model || '';
    providerLabel.textContent = model ? `${provider} · ${model}` : String(provider);
  }
  if (activeProjectRoot()) loadFiles(activeProjectRoot());
}

async function loadFiles(projectPath = activeProjectRoot()) {
  try {
    const [projRes, stagedRes] = await Promise.all([
      api('/api/project/tree?projectRoot=' + encodeURIComponent(projectPath)),
      api('/api/staged-files'),
    ]);
    state.tree = projRes.tree || projRes.data || [];
    state.files = flattenTree(state.tree);
    state.stagedFiles = (stagedRes.data || []).filter(
      (file) =>
        file.projectRoot === projectPath || file.projectRoot === activeProjectAbsoluteRoot(),
    );
    renderFileTree();
    if (typeof renderSearchResults === 'function') {
      const q = $('#search-input')?.value?.trim();
      if (q) renderSearchResults(q);
    }
  } catch {
    const tree = $('#fileTree');
    if (tree) tree.innerHTML = '<div class="empty-state">Falha ao ler arquivos</div>';
  }
}

async function loadIA() {
  try {
    const data = await api('/api/ai/settings');
    state.aiConfig = data;
    const mode = $('#ia-mode');
    const provider = $('#ia-provider');
    const fallback = $('#ia-fallback');
    if (mode) mode.value = data.mode || 'balanced';
    if (provider) provider.value = data.provider || 'auto';
    if (fallback) fallback.checked = data.allowPremiumFallback;

    const PROVIDERS = [
      {
        id: 'anthropic',
        name: 'Claude / Anthropic',
        keyPh: 'sk-ant-...',
        modelPh: 'claude-sonnet-4-20250514',
      },
      { id: 'openai', name: 'OpenAI', keyPh: 'sk-...', modelPh: 'gpt-4.1' },
      { id: 'gemini', name: 'Google Gemini', keyPh: 'AIza...', modelPh: 'gemini-2.5-pro' },
      { id: 'groq', name: 'Groq', keyPh: 'gsk_...', modelPh: 'llama-3.3-70b-versatile' },
      {
        id: 'openrouter',
        name: 'OpenRouter',
        keyPh: 'sk-or-...',
        modelPh: 'anthropic/claude-sonnet-4',
      },
      {
        id: 'nexuslocal',
        name: 'NexusAI local',
        keyPh: 'http://127.0.0.1:5000',
        modelPh: 'nexus-coder-tiny',
        isLocal: true,
        hint: 'python NexusAI/app.py',
      },
      {
        id: 'ollama',
        name: 'Ollama local',
        keyPh: 'http://localhost:11434',
        modelPh: 'qwen2.5-coder:7b',
        isLocal: true,
      },
    ];

    const container = $('#ia-cards-container');
    if (!container) return;
    container.innerHTML = PROVIDERS.map((p) => {
      const cfg = data.providers?.[p.id] || {};
      const st = cfg.configured ? 'ok' : 'miss';
      const stLabel = cfg.configured ? '✓ Configurado' : 'Ausente';
      const keyVal = cfg.keyPreview || cfg.baseUrl || '';
      return `
        <div class="card">
          <div class="card-title">${p.name} <span class="badge ${st}" id="badge-${p.id}">${stLabel}</span></div>
          <div class="form-group" style="margin-bottom:6px">
            <input type="text" id="key-${p.id}" placeholder="${escapeHtml(keyVal || p.keyPh)}">
            <input type="text" id="mod-${p.id}" placeholder="${p.modelPh}" value="${escapeHtml(cfg.model || p.modelPh)}" style="margin-top:6px">
          </div>
          ${p.isLocal ? `<div style="font-size:10px;color:var(--vscode-muted)">${escapeHtml(p.hint || `ollama pull ${p.modelPh}`)}</div>` : ''}
          <div style="display:flex;gap:6px;margin-top:8px">
            <button class="btn-primary" type="button" data-provider-action="save" data-provider-id="${escapeHtml(p.id)}">Salvar</button>
            <button class="btn-secondary" type="button" data-provider-action="test" data-provider-id="${escapeHtml(p.id)}">Testar</button>
            <span id="msg-${p.id}" style="font-size:11px;margin-left:auto;color:var(--vscode-muted)"></span>
          </div>
        </div>`;
    }).join('');
    bindProviderCards(container);
  } catch {
    /* ignore */
  }
}

function bindProviderCards(container) {
  container.querySelectorAll('[data-provider-action][data-provider-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.providerId;
      if (btn.dataset.providerAction === 'save') saveProv(id);
      if (btn.dataset.providerAction === 'test') testProv(id);
    });
  });
}

window.saveProv = async function saveProv(id) {
  const msg = $(`#msg-${id}`);
  const key = $(`#key-${id}`)?.value;
  const mod = $(`#mod-${id}`)?.value;
  if (msg) msg.textContent = 'Salvando...';
  try {
    const body = { providers: { [id]: { model: mod || undefined } } };
    if (id === 'ollama' || id === 'nexuslocal') body.providers[id].baseUrl = key || undefined;
    else if (key) body.providers[id].apiKey = key;
    await api('/api/ai/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (msg) msg.textContent = '✓ Salvo';
    if (key) {
      const badge = $(`#badge-${id}`);
      if (badge) {
        badge.className = 'badge ok';
        badge.textContent = '✓ Configurado';
      }
    }
  } catch {
    if (msg) msg.textContent = 'Erro';
  }
};

window.testProv = async function testProv(id) {
  const msg = $(`#msg-${id}`);
  if (msg) msg.textContent = 'Testando...';
  try {
    const res = await api('/api/ai/test-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: id }),
    });
    if (msg) {
      if (res.ok) msg.textContent = '✓ OK';
      else msg.textContent = `✗ Falhou: ${res.message || res.error || JSON.stringify(res)}`;
    }
  } catch {
    if (msg) msg.textContent = '✗ Erro';
  }
};

window.NexusIDE = {
  openFile,
  saveActiveFile,
  buildIDEContext,
  setActiveContent(content) {
    if (state.editor) state.editor.setValue(String(content || ''));
  },
  getActiveFile() {
    const doc = state.activePath ? state.openedFiles.get(state.activePath) : null;
    return doc
      ? {
          path: doc.path,
          dirty: doc.dirty,
          content: state.editor ? state.editor.getValue() : doc.content,
        }
      : null;
  },
  getOpenFiles() {
    return Array.from(state.openedFiles.values()).map((doc) => ({
      path: doc.path,
      dirty: doc.dirty,
    }));
  },
  getActiveProject() {
    return {
      name: activeProjectName(),
      root: activeProjectRoot(),
      absoluteRoot: activeProjectAbsoluteRoot(),
    };
  },
  getLocalAuthToken() {
    return state.localAuthToken;
  },
};

function activateSideView(target) {
  if (!target) return;
  if (target === 'patches') {
    if (typeof openPatchesPanel === 'function') {
      openPatchesPanel({ viewDiff: !!state.patches?.[0]?.id, patchId: state.patches?.[0]?.id });
    } else {
      showBottomPanel('patch');
      if (typeof loadPatches === 'function') loadPatches();
    }
    $all('.activity-btn[data-target]').forEach((b) =>
      b.classList.toggle('active', b.dataset.target === 'patches'),
    );
    return;
  }
  if (state.layout.sidebarCollapsed) {
    state.layout.sidebarCollapsed = false;
    applyLayoutCss();
    if (typeof saveLayoutToStorage === 'function') saveLayoutToStorage();
  }
  $all('.activity-btn[data-target]').forEach((b) => {
    if (b.dataset.target !== 'settings') {
      b.classList.toggle('active', b.dataset.target === target);
    }
  });
  $all('.side-view').forEach((v) => v.classList.remove('active'));
  const view = $(`#side-${target}`);
  if (view) view.classList.add('active');
  if (target === 'settings') loadIA();
  if (target === 'git' && typeof loadGitStatus === 'function') loadGitStatus();
}

window.activateSideView = activateSideView;

function initActivityBar() {
  $all('.activity-btn[data-target]').forEach((btn) => {
    btn.addEventListener('click', () => activateSideView(btn.dataset.target));
  });
}

function initApp() {
  initActivityBar();
  initLayout();
  initKeyboardShortcuts();
  initEditor();
  if (typeof initPreview === 'function') initPreview();
  initExplorer();
  initTerminal();
  initAiPanel();
  if (typeof EditorSelectionActions !== 'undefined') {
    EditorSelectionActions.init();
  }
  if (typeof initSearch === 'function') initSearch();
  if (typeof initCommandPalette === 'function') initCommandPalette();

  $('#btn-save-ia')?.addEventListener('click', async () => {
    try {
      const fallbackEnabled = Boolean($('#ia-fallback')?.checked);
      if (
        fallbackEnabled &&
        !window.confirm('Ativar fallback premium pode consumir creditos de API. Confirmar?')
      ) {
        return;
      }
      await api('/api/ai/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: $('#ia-mode')?.value,
          provider: $('#ia-provider')?.value,
          allowPremiumFallback: fallbackEnabled,
          requirePremiumConfirmation: true,
        }),
      });
      setStatus('Configurações de IA salvas');
    } catch (e) {
      setStatus('Erro: ' + e.message);
    }
  });

  loadHealth().then(() => {
    if (typeof loadPatches === 'function') loadPatches();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
