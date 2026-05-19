/*
Script para gerar o novo index.html com interface VS Code + Lovable.
Isso recriará o arquivo sem risco de expirar tokens na resposta direta.
*/
const fs = require('fs');
const path = require('path');

const css = `
*, *::before, *::after { box-sizing: border-box; }
:root {
  --bg: #0b0d10; --surface: #111418; --surface-2: #171b20; --surface-3: #20262d;
  --line: #2a3038; --line-strong: #3a4652; --text: #eef3f7; --muted: #9aa7b2;
  --soft: #c7d0d8; --accent: #56d6c9; --green: #65d48a; --red: #ff6b6b; --yellow: #f3c969;
  --font: "Geist", sans-serif; --mono: "Geist Mono", monospace;
}
body { margin: 0; min-height: 100vh; background: var(--bg); color: var(--text); font-family: var(--font); overflow: hidden; }
button, input, textarea, select { font: inherit; outline: none; }
button { border: 0; cursor: pointer; }
code, pre { font-family: var(--mono); }
/* Layout Principal - 4 painéis */
.app-container { display: grid; grid-template-columns: 50px 220px 1fr 300px; grid-template-rows: 1fr 30px; height: 100vh; }
/* Activity Bar */
.activity-bar { background: #080a0d; border-right: 1px solid var(--line); display: flex; flex-direction: column; align-items: center; padding-top: 10px; gap: 15px; }
.activity-btn { width: 36px; height: 36px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: var(--muted); background: transparent; transition: 0.2s; position: relative; }
.activity-btn:hover { color: var(--text); background: var(--surface-2); }
.activity-btn.active { color: var(--accent); border-left: 2px solid var(--accent); border-radius: 0 6px 6px 0; }
.activity-btn[title="Patches"]::after { content: attr(data-count); position: absolute; top: -2px; right: -2px; background: var(--accent); color: #000; font-size: 9px; font-weight: bold; width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; opacity: 0; }
.activity-btn[data-count]:not([data-count="0"]):not([data-count=""])::after { opacity: 1; }
/* Sidebar (Explorer/Settings) */
.sidebar-panel { background: var(--surface); border-right: 1px solid var(--line); display: flex; flex-direction: column; overflow: hidden; }
.sidebar-header { padding: 12px 14px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--muted); letter-spacing: 0.5px; border-bottom: 1px solid var(--line); }
.sidebar-content { flex: 1; overflow-y: auto; padding: 10px; }
/* Views de sidebar */
.side-view { display: none; flex-direction: column; height: 100%; }
.side-view.active { display: flex; }
/* Explorer File Tree */
.file-tree { display: flex; flex-direction: column; gap: 2px; }
.file-item { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 4px; font-size: 12px; color: var(--soft); cursor: pointer; user-select: none; }
.file-item:hover { background: var(--surface-2); color: var(--text); }
.file-item.active { background: rgba(86, 214, 201, 0.1); color: var(--accent); }
.file-item.changed { color: var(--yellow); }
/* Center Editor */
.editor-panel { display: flex; flex-direction: column; background: var(--bg); min-width: 0; }
.editor-tabs { display: flex; background: var(--surface); border-bottom: 1px solid var(--line); overflow-x: auto; }
.editor-tab { padding: 10px 16px; font-size: 13px; color: var(--muted); border-right: 1px solid var(--line); background: transparent; display: flex; align-items: center; gap: 6px; }
.editor-tab.active { background: var(--bg); color: var(--text); border-top: 2px solid var(--accent); }
.editor-tab:hover:not(.active) { background: var(--surface-2); color: var(--text); }
.editor-content { flex: 1; position: relative; overflow: hidden; }
.tab-view { position: absolute; inset: 0; display: none; overflow: auto; padding: 20px; }
.tab-view.active { display: block; }
#view-chat { padding: 0; display: none; flex-direction: column; height: 100%; }
#view-chat.active { display: flex; }
/* DevMind Chat Container */
#devmindChat { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
/* Right Preview */
.preview-panel { background: var(--surface); border-left: 1px solid var(--line); display: flex; flex-direction: column; }
.preview-header { padding: 8px 12px; border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 8px; background: var(--surface-2); }
.preview-url { flex: 1; padding: 6px 10px; background: #0d1014; border: 1px solid var(--line); border-radius: 4px; color: var(--muted); font-size: 11px; }
.preview-btn { padding: 6px; background: transparent; color: var(--muted); border-radius: 4px; }
.preview-btn:hover { background: var(--surface-3); color: var(--text); }
.preview-content { flex: 1; background: #fff; display: flex; align-items: center; justify-content: center; }
.preview-empty { color: #888; font-size: 13px; text-align: center; padding: 20px; }
iframe#previewFrame { width: 100%; height: 100%; border: none; background: #fff; display: none; }
/* Bottom Status Bar */
.status-bar { grid-column: 1 / -1; background: var(--accent); color: #000; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; font-size: 11px; font-weight: 600; }
.status-left, .status-right { display: flex; align-items: center; gap: 12px; }
.status-item { display: flex; align-items: center; gap: 4px; cursor: pointer; }
/* Form Elements & Cards (Settings/IA) */
.form-group { margin-bottom: 15px; }
.form-group label { display: block; font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; margin-bottom: 6px; }
.form-group input, .form-group select { width: 100%; padding: 8px 10px; background: #0d1014; border: 1px solid var(--line); border-radius: 4px; color: var(--text); font-size: 13px; }
.form-group input:focus, .form-group select:focus { border-color: var(--accent); }
.form-group.checkbox { flex-direction: row; align-items: center; display: flex; gap: 8px; }
.form-group.checkbox input { width: auto; }
.form-group.checkbox label { text-transform: none; margin: 0; font-size: 13px; color: var(--soft); }
.btn-primary { background: var(--accent); color: #000; padding: 8px 14px; border-radius: 4px; font-weight: 600; font-size: 12px; }
.btn-secondary { background: var(--surface-3); color: var(--text); padding: 8px 14px; border-radius: 4px; font-weight: 600; font-size: 12px; border: 1px solid var(--line); }
.btn-ghost { background: transparent; color: var(--muted); padding: 6px 10px; border-radius: 4px; font-size: 12px; }
.btn-ghost:hover { background: var(--surface-2); color: var(--text); }
.card { border: 1px solid var(--line); border-radius: 6px; padding: 14px; margin-bottom: 12px; background: var(--bg); }
.card-title { font-size: 13px; font-weight: 600; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
.badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
.badge.ok { background: rgba(101,212,138,0.15); color: var(--green); border: 1px solid rgba(101,212,138,0.3); }
.badge.warn { background: rgba(243,201,105,0.15); color: var(--yellow); border: 1px solid rgba(243,201,105,0.3); }
.badge.err { background: rgba(255,107,107,0.15); color: var(--red); border: 1px solid rgba(255,107,107,0.3); }
.empty-state { padding: 30px; text-align: center; color: var(--muted); font-size: 13px; border: 1px dashed var(--line); border-radius: 8px; }
/* Code block */
pre.code-view { margin: 0; font-size: 13px; line-height: 1.5; color: #dbe7ef; font-family: var(--mono); white-space: pre-wrap; }
/* Terminal Panel (Bottom overlay) */
.terminal-overlay { position: fixed; bottom: 30px; left: 270px; right: 300px; height: 250px; background: #0d1014; border-top: 1px solid var(--line); border-left: 1px solid var(--line); border-right: 1px solid var(--line); border-radius: 8px 8px 0 0; display: none; flex-direction: column; z-index: 50; }
.terminal-overlay.open { display: flex; }
.terminal-header { padding: 8px 12px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 600; color: var(--muted); background: var(--surface); }
.terminal-body { flex: 1; padding: 10px; overflow-y: auto; font-family: var(--mono); font-size: 12px; color: #dbe7ef; line-height: 1.4; white-space: pre-wrap; }
`;

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nexus Codex</title>
  <style>${css}</style>
</head>
<body>
  <div class="app-container">
    <!-- Activity Bar -->
    <div class="activity-bar">
      <button class="activity-btn active" data-target="explorer" title="Explorer">📂</button>
      <button class="activity-btn" data-target="patches" title="Patches" id="act-patches">📋</button>
      <button class="activity-btn" data-target="settings" title="Configurações">⚙️</button>
      <button class="activity-btn" data-target="ia" title="IA">🧠</button>
    </div>

    <!-- Sidebar Panels -->
    <div class="sidebar-panel">
      <!-- Explorer -->
      <div class="side-view active" id="side-explorer">
        <div class="sidebar-header">Explorer</div>
        <div class="sidebar-content file-tree" id="fileTree">
          <div style="color:var(--muted);font-size:12px;padding:10px;">Carregando arquivos...</div>
        </div>
      </div>
      
      <!-- Patches -->
      <div class="side-view" id="side-patches">
        <div class="sidebar-header" style="display:flex;justify-content:space-between;">
          <span>Patches Pendentes</span>
          <button class="btn-ghost" onclick="loadPatches()" style="padding:0">🔄</button>
        </div>
        <div class="sidebar-content" id="patchListSidebar">
          <div class="empty-state">Nenhum patch pendente.</div>
        </div>
      </div>

      <!-- Settings -->
      <div class="side-view" id="side-settings">
        <div class="sidebar-header">Projeto e Básicos</div>
        <div class="sidebar-content">
          <div class="form-group">
            <label>Projeto Padrão</label>
            <input type="text" id="set-project-path" placeholder="Caminho do projeto...">
          </div>
          <div class="form-group checkbox">
            <input type="checkbox" id="set-confirm-danger" checked>
            <label>Confirmar comandos perigosos</label>
          </div>
          <button class="btn-primary" style="width:100%">Salvar Configurações</button>
        </div>
      </div>

      <!-- IA Settings -->
      <div class="side-view" id="side-ia">
        <div class="sidebar-header">Configuração de IA</div>
        <div class="sidebar-content">
          <div class="form-group">
            <label>Modo de Uso</label>
            <select id="ia-mode">
              <option value="economy">Econômico (Local)</option>
              <option value="balanced">Balanceado (Auto)</option>
              <option value="premium">Premium (Cloud)</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div class="form-group">
            <label>Provider Principal</label>
            <select id="ia-provider">
              <option value="auto">Automático</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="anthropic">Claude / Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="groq">Groq</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </div>
          <div class="form-group checkbox">
            <input type="checkbox" id="ia-fallback">
            <label>Fallback Premium Automático</label>
          </div>
          <button class="btn-primary" id="btn-save-ia" style="width:100%;margin-bottom:15px;">Salvar IA Global</button>
          
          <div id="ia-cards-container"></div>
        </div>
      </div>
    </div>

    <!-- Center Panel -->
    <div class="editor-panel">
      <div class="editor-tabs">
        <button class="editor-tab active" data-tab="chat">💬 Chat (Nexus)</button>
        <button class="editor-tab" data-tab="code">📄 Código</button>
        <button class="editor-tab" data-tab="diff">⚖️ Diff / Patch</button>
        <button class="editor-tab" data-tab="artifacts">📦 Artefatos</button>
      </div>
      <div class="editor-content">
        <!-- Chat Tab -->
        <div class="tab-view active" id="view-chat">
          <div id="devmindChat"></div>
        </div>
        
        <!-- Code Tab -->
        <div class="tab-view" id="view-code">
          <h3 id="code-filename" style="margin-top:0;font-size:14px;color:var(--soft);">Selecione um arquivo no Explorer</h3>
          <pre class="code-view" id="code-content"></pre>
        </div>
        
        <!-- Diff Tab -->
        <div class="tab-view" id="view-diff">
          <div id="diff-content">
            <div class="empty-state">Selecione um patch pendente para revisar.</div>
          </div>
        </div>

        <!-- Artifacts Tab -->
        <div class="tab-view" id="view-artifacts">
          <div class="empty-state">Nenhum artefato gerado na sessão atual.</div>
        </div>
      </div>
    </div>

    <!-- Right Panel (Preview) -->
    <div class="preview-panel">
      <div class="preview-header">
        <span style="font-size:14px">🌐</span>
        <input type="text" class="preview-url" id="preview-url" value="http://localhost:3000" placeholder="URL de preview">
        <button class="preview-btn" id="btn-refresh-preview" title="Atualizar">🔄</button>
        <button class="preview-btn" id="btn-open-preview" title="Abrir aba">↗️</button>
      </div>
      <div class="preview-content">
        <div class="preview-empty" id="preview-placeholder">Preview inativo.<br><br>Se o projeto estiver rodando, digite a URL acima e atualize.</div>
        <iframe id="previewFrame"></iframe>
      </div>
    </div>

    <!-- Terminal Overlay -->
    <div class="terminal-overlay" id="terminal-overlay">
      <div class="terminal-header">
        <span>Terminal / Output</span>
        <div>
          <button class="btn-ghost" onclick="clearTerminal()">Limpar</button>
          <button class="btn-ghost" onclick="toggleTerminal()">Fechar</button>
        </div>
      </div>
      <div class="terminal-body" id="terminal-output">Aguardando comandos...</div>
    </div>

    <!-- Status Bar -->
    <div class="status-bar">
      <div class="status-left">
        <span class="status-item" id="status-mode">🤖 Modo: Carregando</span>
        <span class="status-item" id="status-project">📂 Projeto: -</span>
      </div>
      <div class="status-right">
        <span class="status-item" onclick="toggleTerminal()">Terminal ⌨️</span>
        <span class="status-item" id="status-msg">Pronto</span>
      </div>
    </div>
  </div>

  <script src="/devmind.js"></script>
  <script>
    // App State
    const state = {
      project: null,
      files: [],
      patches: [],
      aiConfig: null,
      activeFile: null
    };

    function $(selector) { return document.querySelector(selector); }
    function $all(selector) { return Array.from(document.querySelectorAll(selector)); }
    function setStatus(msg) { $('#status-msg').textContent = msg; }

    // API Helpers
    async function api(path, options = {}) {
      try {
        const res = await fetch(path, options);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || res.statusText);
        }
        return await res.json();
      } catch (err) {
        console.error(err);
        setStatus("Erro: " + err.message);
        throw err;
      }
    }

    // Navigation
    $all('.activity-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $all('.activity-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $all('.side-view').forEach(v => v.classList.remove('active'));
        $('#side-' + btn.dataset.target).classList.add('active');
        if (btn.dataset.target === 'ia') loadIA();
      });
    });

    $all('.editor-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        $all('.editor-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $all('.tab-view').forEach(v => v.classList.remove('active'));
        $('#view-' + btn.dataset.tab).classList.add('active');
      });
    });

    function openTab(tabName) {
      const tab = $('.editor-tab[data-tab="' + tabName + '"]');
      if(tab) tab.click();
    }

    // Terminal
    function toggleTerminal() { $('#terminal-overlay').classList.toggle('open'); }
    function clearTerminal() { $('#terminal-output').innerHTML = ''; }
    function logTerminal(msg) { 
      const out = $('#terminal-output');
      out.innerHTML += msg + '\\n';
      out.scrollTop = out.scrollHeight;
    }

    // Load Project & Files
    async function loadHealth() {
      const res = await api('/api/health');
      state.project = res.project;
      $('#status-project').textContent = '📂 Projeto: ' + (res.project?.projectName || 'Nenhum');
      $('#status-mode').textContent = '🤖 IA: ' + (res.mode || 'Auto');
      if (res.project?.projectPath) {
        loadFiles(res.project.projectPath);
      }
    }

    async function loadFiles(projectPath) {
      try {
        const res = await api('/api/project/files?projectRoot=' + encodeURIComponent(projectPath));
        state.files = res.files || [];
        renderFileTree();
      } catch(e) {
        $('#fileTree').innerHTML = '<div class="empty-state">Falha ao ler arquivos</div>';
      }
    }

    function renderFileTree() {
      const tree = $('#fileTree');
      tree.innerHTML = '';
      if(!state.files.length) {
        tree.innerHTML = '<div class="empty-state">Nenhum arquivo encontrado</div>';
        return;
      }
      
      state.files.forEach(f => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.textContent = f.path;
        div.onclick = () => {
          $all('.file-item').forEach(el => el.classList.remove('active'));
          div.classList.add('active');
          openFile(f.path);
        };
        tree.appendChild(div);
      });
    }

    async function openFile(filePath) {
      if(!state.project) return;
      openTab('code');
      $('#code-filename').textContent = 'Carregando ' + filePath + '...';
      $('#code-content').textContent = '';
      
      try {
        const res = await api('/api/project/file?projectRoot=' + encodeURIComponent(state.project.projectPath) + '&filePath=' + encodeURIComponent(filePath));
        $('#code-filename').textContent = filePath;
        $('#code-content').textContent = res.content;
      } catch(e) {
        $('#code-content').textContent = 'Falha ao carregar conteúdo: ' + e.message;
      }
    }

    // DevMind Init
    if (window.DevMind) {
      window.DevMind.init({
        apiBase: '',
        containerId: 'devmindChat',
        onSuccess: (data) => {
          if (data.patch_ids && data.patch_ids.length > 0) {
            loadPatches();
            setTimeout(() => {
              $('.activity-btn[data-target="patches"]').click();
              openTab('diff');
            }, 500);
          }
        }
      });
    }

    // Patches
    async function loadPatches() {
      try {
        const res = await api('/api/patches/pending');
        state.patches = res.patches || [];
        $('#act-patches').dataset.count = state.patches.length;
        renderPatchSidebar();
      } catch(e) {
        console.error("Falha ao ler patches", e);
      }
    }

    function renderPatchSidebar() {
      const list = $('#patchListSidebar');
      if(!state.patches.length) {
        list.innerHTML = '<div class="empty-state">Nenhum patch.</div>';
        $('#diff-content').innerHTML = '<div class="empty-state">Selecione um patch.</div>';
        return;
      }
      list.innerHTML = state.patches.map(p => \`
        <div class="card" style="cursor:pointer;padding:10px;" onclick="viewPatch('\${p.id}')">
          <div style="font-weight:bold;font-size:12px;margin-bottom:4px;">\${p.type}</div>
          <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\${p.path || p.reason}</div>
        </div>
      \`).join('');
    }

    window.viewPatch = async function(id) {
      openTab('diff');
      const patch = state.patches.find(p => p.id === id);
      if(!patch) return;
      
      let html = \`
        <div style="margin-bottom:15px;display:flex;justify-content:space-between;">
          <h3 style="margin:0">Patch: \${patch.type}</h3>
          <div>
            <button class="btn-primary" onclick="applyPatch('\${id}')">Aplicar</button>
            <button class="btn-ghost" style="color:var(--red)" onclick="rejectPatch('\${id}')">Rejeitar</button>
          </div>
        </div>
        <div style="font-size:13px;margin-bottom:10px;">Arquivo: \${patch.path || '-'}</div>
      \`;

      if (patch.type === 'create_file' || patch.type === 'write_file') {
        html += \`<pre class="code-view" style="background:#13201f;padding:10px;border-radius:6px;border:1px solid var(--green)">\${escapeHtml(patch.content || '')}</pre>\`;
      } else if (patch.type === 'patch_file') {
        html += \`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div><div style="font-size:11px;color:var(--red);margin-bottom:5px">Antes</div>
            <pre class="code-view" style="background:#201313;padding:10px;border-radius:6px;border:1px solid var(--red);opacity:0.8">\${escapeHtml(patch.before || '')}</pre>
          </div>
          <div><div style="font-size:11px;color:var(--green);margin-bottom:5px">Depois</div>
            <pre class="code-view" style="background:#13201f;padding:10px;border-radius:6px;border:1px solid var(--green)">\${escapeHtml(patch.after || '')}</pre>
          </div>
        </div>\`;
      } else {
        html += \`<pre class="code-view">\${JSON.stringify(patch, null, 2)}</pre>\`;
      }

      $('#diff-content').innerHTML = html;
    };

    window.applyPatch = async function(id) {
      try {
        await api(\`/api/patches/pending/\${id}/apply\`, { method: 'POST' });
        setStatus("Patch aplicado com sucesso!");
        $('#diff-content').innerHTML = '<div class="empty-state">Patch aplicado.</div>';
        loadPatches();
        if (state.project) loadFiles(state.project.projectPath);
      } catch(e) {}
    };

    window.rejectPatch = async function(id) {
      try {
        await api(\`/api/patches/pending/\${id}\`, { method: 'DELETE' });
        setStatus("Patch rejeitado.");
        $('#diff-content').innerHTML = '<div class="empty-state">Patch rejeitado.</div>';
        loadPatches();
      } catch(e) {}
    };

    function escapeHtml(s) {
      return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // Preview
    $('#btn-refresh-preview').addEventListener('click', () => {
      const frame = $('#previewFrame');
      const ph = $('#preview-placeholder');
      const url = $('#preview-url').value;
      if (url) {
        ph.style.display = 'none';
        frame.style.display = 'block';
        frame.src = url;
      }
    });

    $('#btn-open-preview').addEventListener('click', () => {
      const url = $('#preview-url').value;
      if (url) window.open(url, '_blank');
    });

    // IA Settings
    async function loadIA() {
      try {
        const data = await api('/api/ai/settings');
        state.aiConfig = data;
        $('#ia-mode').value = data.mode || 'balanced';
        $('#ia-provider').value = data.provider || 'auto';
        $('#ia-fallback').checked = data.allowPremiumFallback;

        const PROVIDERS = [
          { id:"anthropic",  name:"Claude / Anthropic",  keyLabel:"API Key",   keyPh:"sk-ant-...",    modelPh:"claude-sonnet-4-20250514" },
          { id:"openai",     name:"OpenAI",              keyLabel:"API Key",   keyPh:"sk-...",         modelPh:"gpt-4.1" },
          { id:"gemini",     name:"Google Gemini",       keyLabel:"API Key",   keyPh:"AIza...",        modelPh:"gemini-2.5-pro" },
          { id:"groq",       name:"Groq",               keyLabel:"API Key",   keyPh:"gsk_...",        modelPh:"llama-3.3-70b-versatile" },
          { id:"openrouter", name:"OpenRouter",          keyLabel:"API Key",   keyPh:"sk-or-...",      modelPh:"anthropic/claude-sonnet-4" },
          { id:"ollama",     name:"Ollama local",        keyLabel:"Base URL",  keyPh:"http://localhost:11434", modelPh:"qwen2.5-coder:7b", isLocal:true }
        ];

        $('#ia-cards-container').innerHTML = PROVIDERS.map(p => {
          const cfg = data.providers?.[p.id] || {};
          const st = cfg.configured ? "ok" : "miss";
          const stLabel = cfg.configured ? "✓ Configurado" : "Ausente";
          const keyVal = cfg.keyPreview || cfg.baseUrl || "";
          return \`
          <div class="card" style="padding:12px;">
            <div class="card-title">\${p.name} <span class="badge \${st}" id="badge-\${p.id}">\${stLabel}</span></div>
            <div class="form-group" style="margin-bottom:8px">
              <input type="text" id="key-\${p.id}" placeholder="\${keyVal || p.keyPh}" style="margin-bottom:6px">
              <input type="text" id="mod-\${p.id}" placeholder="\${p.modelPh}" value="\${cfg.model || p.modelPh}">
            </div>
            \${p.isLocal ? \`<div style="font-size:10px;color:var(--muted);margin-bottom:8px">Rode: ollama pull \${p.modelPh}</div>\` : ""}
            <div style="display:flex;gap:6px">
              <button class="btn-primary" onclick="saveProv('\${p.id}')">Salvar</button>
              <button class="btn-secondary" onclick="testProv('\${p.id}')">Testar</button>
              <span id="msg-\${p.id}" style="font-size:11px;margin-left:auto;align-self:center;color:var(--muted)"></span>
            </div>
          </div>\`;
        }).join('');

      } catch(e) {}
    }

    $('#btn-save-ia').addEventListener('click', async () => {
      try {
        await api('/api/ai/settings', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            mode: $('#ia-mode').value,
            provider: $('#ia-provider').value,
            allowPremiumFallback: $('#ia-fallback').checked
          })
        });
        setStatus("Configurações de IA salvas!");
      } catch(e) {}
    });

    window.saveProv = async function(id) {
      const msg = $(\`#msg-\${id}\`);
      const key = $(\`#key-\${id}\`).value;
      const mod = $(\`#mod-\${id}\`).value;
      msg.textContent = "Salvando...";
      try {
        const body = { providers: { [id]: { model: mod || undefined } } };
        if (id === 'ollama') body.providers[id].baseUrl = key || undefined;
        else if (key) body.providers[id].apiKey = key;
        
        await api('/api/ai/settings', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
        msg.textContent = "✓ Salvo";
        if(key) { $(\`#badge-\${id}\`).className = "badge ok"; $(\`#badge-\${id}\`).textContent = "✓ Configurado"; }
      } catch(e) { msg.textContent = "Erro"; }
    };

    window.testProv = async function(id) {
      const msg = $(\`#msg-\${id}\`);
      msg.textContent = "Testando...";
      try {
        const res = await api('/api/ai/test-provider', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ provider: id }) });
        msg.textContent = res.ok ? "✓ OK" : "✗ Falhou";
      } catch(e) { msg.textContent = "✗ Erro"; }
    };

    // Boot
    loadHealth();
    loadPatches();

  </script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, '../public/index.html'), html);
console.log('index.html gerado com sucesso!');
