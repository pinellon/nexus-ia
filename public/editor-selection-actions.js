/**
 * Editor Selection Actions
 * 
 * Provides AI-powered quick actions for selected code in Monaco Editor.
 * Actions: Explain, Refactor, Fix, Generate Tests, Transform to Function, 
 * Optimize Performance, Review Security
 */

(function (global) {
  "use strict";

  // ── Configuration ──────────────────────────────────────────────────────────
  const ACTION_TYPES = {
    explain: {
      label: "Explicar seleção",
      icon: "codicon-comment-discussion",
      description: "Explicar o que faz este código",
      requiresSave: false,
      generatesPatch: false
    },
    refactor: {
      label: "Refatorar seleção",
      icon: "codicon-edit",
      description: "Melhorar código mantendo compatibilidade",
      requiresSave: true,
      generatesPatch: true
    },
    fix: {
      label: "Corrigir seleção",
      icon: "codicon-bug",
      description: "Corrigir erros ou problemas",
      requiresSave: true,
      generatesPatch: true
    },
    tests: {
      label: "Gerar testes",
      icon: "codicon-flask",
      description: "Gerar testes unitários",
      requiresSave: true,
      generatesPatch: true
    },
    transform_function: {
      label: "Transformar em função",
      icon: "codicon-symbol-function",
      description: "Extrair em uma função nomeada",
      requiresSave: true,
      generatesPatch: true
    },
    optimize: {
      label: "Otimizar performance",
      icon: "codicon-zap",
      description: "Melhorar performance",
      requiresSave: true,
      generatesPatch: true
    },
    security: {
      label: "Revisar segurança",
      icon: "codicon-shield",
      description: "Identificar problemas de segurança",
      requiresSave: true,
      generatesPatch: true
    }
  };

  const MAX_FILE_CONTENT_LENGTH = 8000;
  const MAX_SELECTION_LENGTH = 4000;
  const SENSITIVE_PATTERNS = /\b(password|token|api[_-]?key|secret|credential|env|apikey|private[_-]?key)\b/i;

  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    selectionBar: null,
    currentSelection: null,
    lastAction: null,
    history: [], // recent selection actions
    analytics: {}, // action counts
    favorites: [],
    undoStack: [],
    customActions: []
  };

  const PERSIST_KEYS = {
    HISTORY: "esa_history_v1",
    ANALYTICS: "esa_analytics_v1",
    FAVORITES: "esa_favorites_v1",
    UNDO: "esa_undo_v1",
    CUSTOM: "esa_custom_actions_v1"
  };

  // ── Utilities ──────────────────────────────────────────────────────────────
  function esc(v) {
    return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  function detectLanguageFromPath(filePath) {
    const ext = String(filePath || "").toLowerCase().split(".").pop();
    return (
      {
        ts: "typescript",
        tsx: "typescript",
        js: "javascript",
        jsx: "javascript",
        json: "json",
        html: "html",
        css: "css",
        md: "markdown",
        py: "python",
        go: "go",
        rb: "ruby",
        java: "java",
        cs: "csharp",
        cpp: "cpp",
        c: "c",
        php: "php",
        swift: "swift",
        kt: "kotlin",
        rs: "rust",
        sh: "bash",
        sql: "sql"
      }[ext] || "plaintext"
    );
  }

  function isSensitiveFile(filePath) {
    const name = String(filePath || "").toLowerCase();
    return /\.env|secrets?|credentials?|config|key|certificate|\.pem|\.key/.test(name);
  }

  function isSensitiveContent(content) {
    return SENSITIVE_PATTERNS.test(content);
  }

  function canPerformAction(action, activeDoc) {
    if (!activeDoc) return false;
    if (isSensitiveFile(activeDoc.path)) return false;
    if (action.requiresSave && activeDoc.dirty) return false;
    return true;
  }

  function getBlockingReason(action, activeDoc) {
    if (isSensitiveFile(activeDoc?.path)) {
      return "Arquivo sensível (.env, secrets, etc.)";
    }
    if (action.requiresSave && activeDoc?.dirty) {
      return "Arquivo tem alterações não salvas. Salve antes de pedir ação com patch.";
    }
    return null;
  }

  // ── Persistence & Helpers ─────────────────────────────────────────────────
  function saveToStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.debug("Could not save to storage", key, err.message);
    }
  }

  function loadFromStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function initPersistentState() {
    // History (recent selections)
    state.history = loadFromStorage(PERSIST_KEYS.HISTORY, []);
    // Analytics
    state.analytics = loadFromStorage(PERSIST_KEYS.ANALYTICS, {});
    // Favorites
    const fav = loadFromStorage(PERSIST_KEYS.FAVORITES, []);
    state.favorites = Array.isArray(fav) ? fav : [];
    // Custom actions
    const ca = loadFromStorage(PERSIST_KEYS.CUSTOM, []);
    state.customActions = Array.isArray(ca) ? ca : [];
    // Undo stack
    state.undoStack = loadFromStorage(PERSIST_KEYS.UNDO, []);
  }

  const ACTION_ORDER = [
    "explain",
    "refactor",
    "fix",
    "tests",
    "transform_function",
    "optimize",
    "security"
  ];

  function getActionIdByIndex(n) {
    return ACTION_ORDER[n - 1] || null;
  }

  function initKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Ignore when typing into input/textarea
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;

      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;

      // Ctrl+1..7 map to actions
      if (/^[1-7]$/.test(e.key)) {
        const idx = parseInt(e.key, 10);
        const actionId = getActionIdByIndex(idx);
        if (actionId) {
          const context = getEditorSelectionContext();
          const info = ACTION_TYPES[actionId];
          const activeDoc = global.state?.openedFiles?.get(global.state.activePath);
          if (!context) return;
          if (!canPerformAction(info, activeDoc)) {
            const reason = getBlockingReason(info, activeDoc);
            alert(reason || "Ação não disponível");
            return;
          }
          e.preventDefault();
          handleActionClick(actionId);
        }
      }
    });
  }

  function addToHistory(selectionContext, actionId) {
    try {
      const item = {
        actionId,
        filePath: selectionContext.filePath,
        language: selectionContext.language,
        lines: `${selectionContext.startLine}-${selectionContext.endLine}`,
        snippet: selectionContext.selectedText.slice(0, 300),
        timestamp: Date.now()
      };

      state.history.unshift(item);
      if (state.history.length > 50) state.history.length = 50;
      saveToStorage(PERSIST_KEYS.HISTORY, state.history);
    } catch (err) {
      console.debug("addToHistory error", err.message);
    }
  }

  function recordAnalytics(actionId) {
    state.analytics[actionId] = (state.analytics[actionId] || 0) + 1;
    saveToStorage(PERSIST_KEYS.ANALYTICS, state.analytics);
  }

  function undoLast() {
    if (!state.undoStack || state.undoStack.length === 0) {
      alert("Nenhuma alteração para desfazer");
      return;
    }
    const last = state.undoStack.pop();
    saveToStorage(PERSIST_KEYS.UNDO, state.undoStack);

    // Restore in editor if matching file is open
    const activeDoc = global.state?.openedFiles?.get(global.state.activePath);
    if (activeDoc && activeDoc.path === last.filePath && global.state.editor) {
      try {
        global.state.editor.setValue(last.prevContent || "");
        alert("Alteração desfeita (conteúdo restaurado)");
      } catch (err) {
        console.debug("undo apply error", err.message);
      }
    } else {
      alert("Arquivo para desfazer não está aberto no editor");
    }
  }

  function createModal(title, bodyHtml, buttons = []) {
    const overlay = document.createElement("div");
    overlay.className = "esa-modal-overlay";
    overlay.innerHTML = `
      <div class="esa-modal">
        <div class="esa-modal-header"><strong>${esc(title)}</strong><button class="esa-modal-close" aria-label="Fechar">×</button></div>
        <div class="esa-modal-body">${bodyHtml}</div>
        <div class="esa-modal-actions"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector(".esa-modal-close").addEventListener("click", () => overlay.remove());
    const actionsEl = overlay.querySelector(".esa-modal-actions");
    buttons.forEach((b) => {
      const btn = document.createElement("button");
      btn.className = b.className || "btn-primary";
      btn.textContent = b.label;
      btn.addEventListener("click", () => {
        try { b.onClick(); } catch (err) { console.debug("modal button error", err.message); }
        overlay.remove();
      });
      actionsEl.appendChild(btn);
    });

    return overlay;
  }

  function showHistoryModal() {
    const rows = state.history.map((h) => {
      const t = new Date(h.timestamp).toLocaleString();
      const label = ACTION_TYPES[h.actionId]?.label || h.actionId;
      return `<div class="card"><div style="display:flex;justify-content:space-between;"><strong>${esc(label)}</strong><span style="color:var(--vscode-muted);font-size:11px">${esc(h.filePath)}:${esc(h.lines)}</span></div><pre class="code-view">${esc(h.snippet)}</pre><div style="font-size:11px;color:var(--vscode-muted);margin-top:6px">${t}</div></div>`;
    }).join("");

    createModal("Histórico de ações", rows || '<div class="empty-state">Nenhuma ação ainda</div>', []);
  }

  function showAnalyticsModal() {
    const rows = Object.entries(state.analytics).map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:6px 0"><div>${esc(ACTION_TYPES[k]?.label||k)}</div><div style="font-weight:700">${v}</div></div>`).join("");
    createModal("Estatísticas de uso", rows || '<div class="empty-state">Sem dados</div>', []);
  }

  function confirmPatchAction(actionId, selectionContext, actionInfo) {
    return new Promise((resolve) => {
      if (!actionInfo.generatesPatch) return resolve(true);
      const body = `<div><p>Esta ação pode gerar um patch que modifica arquivos. Deseja continuar?</p><div style=\"margin-top:8px;max-height:220px;overflow:auto;border:1px solid var(--vscode-border-subtle);padding:8px;background:var(--vscode-bg);\"><pre class=\"code-view\">${esc(selectionContext.selectedText)}</pre></div></div>`;
      createModal(`Confirmar: ${actionInfo.label}`, body, [
        { label: "Cancelar", className: "btn-secondary", onClick: () => resolve(false) },
        { label: "Continuar", className: "btn-primary", onClick: () => resolve(true) }
      ]);
    });
  }

  function toggleFavorite(actionId) {
    const idx = state.favorites.indexOf(actionId);
    if (idx === -1) {
      state.favorites.unshift(actionId);
    } else {
      state.favorites.splice(idx, 1);
    }
    saveToStorage(PERSIST_KEYS.FAVORITES, state.favorites);
    renderSelectionBar();
  }

  function showReorderModal() {
    if (!Array.isArray(state.favorites) || state.favorites.length === 0) {
      createModal('Reordenar Favoritos', '<div class="empty-state">Nenhuma ação favoritada</div>', []);
      return;
    }

    const overlay = createModal('Reordenar Favoritos', '', [
      { label: 'Salvar', className: 'btn-primary', onClick: () => {
          const rows = overlay.querySelectorAll('.esa-reorder-row');
          const newOrder = Array.from(rows).map(r => r.dataset.action);
          state.favorites = newOrder;
          saveToStorage(PERSIST_KEYS.FAVORITES, state.favorites);
          renderSelectionBar();
        } },
      { label: 'Fechar', className: 'btn-secondary', onClick: () => {} }
    ]);

    function renderBody() {
      const bodyHtml = state.favorites.map((aid) => {
        const label = ACTION_TYPES[aid]?.label || aid;
        return `<div class="esa-reorder-row" data-action="${esc(aid)}" style="display:flex;align-items:center;justify-content:space-between;padding:6px 0"><div style="display:flex;align-items:center;gap:8px"><span style="cursor:grab">⋮</span><strong>${esc(label)}</strong></div><div><button class="esa-up btn-ghost" data-action="${esc(aid)}">▲</button><button class="esa-down btn-ghost" data-action="${esc(aid)}">▼</button><button class="esa-remove btn-ghost" data-action="${esc(aid)}">Remover</button></div></div>`;
      }).join('');
      overlay.querySelector('.esa-modal-body').innerHTML = bodyHtml;

      overlay.querySelectorAll('.esa-up').forEach(btn => btn.addEventListener('click', (e) => {
        e.preventDefault();
        const aid = btn.dataset.action;
        const i = state.favorites.indexOf(aid);
        if (i > 0) { state.favorites.splice(i, 1); state.favorites.splice(i - 1, 0, aid); }
        renderBody();
      }));

      overlay.querySelectorAll('.esa-down').forEach(btn => btn.addEventListener('click', (e) => {
        e.preventDefault();
        const aid = btn.dataset.action;
        const i = state.favorites.indexOf(aid);
        if (i >= 0 && i < state.favorites.length - 1) { state.favorites.splice(i, 1); state.favorites.splice(i + 1, 0, aid); }
        renderBody();
      }));

      overlay.querySelectorAll('.esa-remove').forEach(btn => btn.addEventListener('click', (e) => {
        e.preventDefault();
        const aid = btn.dataset.action;
        const i = state.favorites.indexOf(aid);
        if (i >= 0) { state.favorites.splice(i, 1); }
        renderBody();
      }));
    }

    renderBody();
  }

  // Custom actions helpers
  function findCustomAction(id) {
    if (!Array.isArray(state.customActions)) return null;
    return state.customActions.find((a) => a.id === id) || null;
  }

  function getAllActionIds() {
    const builtIn = Object.keys(ACTION_TYPES);
    const custom = Array.isArray(state.customActions) ? state.customActions.map(a => a.id) : [];
    return [...builtIn, ...custom];
  }

  function getActionInfoById(id) {
    if (ACTION_TYPES[id]) return { ...ACTION_TYPES[id], _builtin: true };
    const c = findCustomAction(id);
    if (c) return { label: c.label || c.id, icon: c.icon || 'codicon-star', description: c.description || '', requiresSave: !!c.requiresSave, generatesPatch: !!c.generatesPatch, promptTemplate: c.promptTemplate, _builtin: false };
    return null;
  }

  function interpolateTemplate(template, context) {
    if (!template) return null;
    return String(template).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) => {
      switch (key) {
        case 'selectedText': return context.selectedText || '';
        case 'filePath': return context.filePath || '';
        case 'language': return context.language || '';
        case 'startLine': return context.startLine || '';
        case 'endLine': return context.endLine || '';
        case 'fullFileContent': return context.fullFileContent || '';
        default: return '';
      }
    });
  }

  function showCustomActionsModal() {
    const rows = (state.customActions || []).map((a) => {
      return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div><strong>${esc(a.label)}</strong><div style="font-size:11px;color:var(--vscode-muted)">${esc(a.description||'')}</div></div><div><button class="esa-edit-custom btn-ghost" data-id="${esc(a.id)}">Editar</button><button class="esa-delete-custom btn-ghost" data-id="${esc(a.id)}">Deletar</button></div></div><pre class="code-view" style="margin-top:8px">${esc(a.promptTemplate||'')}</pre></div>`;
    }).join('');

    const overlay = createModal('Ações customizadas', rows || '<div class="empty-state">Nenhuma ação customizada</div>', [
      { label: 'Adicionar', className: 'btn-primary', onClick: () => { showEditCustomModal(); } },
      { label: 'Fechar', className: 'btn-secondary', onClick: () => {} }
    ]);

    overlay.querySelectorAll('.esa-edit-custom').forEach(btn => btn.addEventListener('click', (e) => {
      const id = btn.dataset.id; const c = findCustomAction(id); if (c) showEditCustomModal(c);
    }));
    overlay.querySelectorAll('.esa-delete-custom').forEach(btn => btn.addEventListener('click', (e) => {
      const id = btn.dataset.id; state.customActions = (state.customActions || []).filter(x => x.id !== id); saveToStorage(PERSIST_KEYS.CUSTOM, state.customActions); renderSelectionBar(); overlay.remove(); showCustomActionsModal();
    }));
  }

  function showEditCustomModal(existing) {
    const item = existing ? { ...existing } : { id: `custom_${Date.now()}`, label: '', icon: 'codicon-star', description: '', promptTemplate: '', requiresSave: false, generatesPatch: false };
    const body = `
      <div class="form-group"><label>Label</label><input id="esa-custom-label" value="${esc(item.label)}" /></div>
      <div class="form-group"><label>Description</label><input id="esa-custom-desc" value="${esc(item.description)}" /></div>
      <div class="form-group"><label>Prompt template</label><textarea id="esa-custom-prompt" rows="6">${esc(item.promptTemplate)}</textarea><div style="font-size:11px;color:var(--vscode-muted);margin-top:6px">Use placeholders: {{selectedText}}, {{filePath}}, {{language}}, {{startLine}}, {{endLine}}, {{fullFileContent}}</div></div>
      <div class="form-group checkbox"><input type="checkbox" id="esa-custom-requires-save" ${item.requiresSave ? 'checked' : ''} /><label for="esa-custom-requires-save">Requer salvar arquivo antes</label></div>
      <div class="form-group checkbox"><input type="checkbox" id="esa-custom-generates-patch" ${item.generatesPatch ? 'checked' : ''} /><label for="esa-custom-generates-patch">Gera patch</label></div>
    `;

    const overlay = createModal(existing ? 'Editar ação customizada' : 'Nova ação customizada', body, [
      { label: 'Salvar', className: 'btn-primary', onClick: () => {
          const label = overlay.querySelector('#esa-custom-label').value.trim();
          const desc = overlay.querySelector('#esa-custom-desc').value.trim();
          const prompt = overlay.querySelector('#esa-custom-prompt').value;
          const requiresSave = !!overlay.querySelector('#esa-custom-requires-save').checked;
          const generatesPatch = !!overlay.querySelector('#esa-custom-generates-patch').checked;
          if (!label) { alert('Label é obrigatório'); return; }
          const newItem = { id: item.id, label, description: desc, promptTemplate: prompt, requiresSave, generatesPatch };
          // replace or add
          state.customActions = (state.customActions || []).filter(x => x.id !== newItem.id);
          state.customActions.unshift(newItem);
          saveToStorage(PERSIST_KEYS.CUSTOM, state.customActions);
          renderSelectionBar();
        } },
      { label: 'Cancelar', className: 'btn-secondary', onClick: () => {} }
    ]);
  }

  // Debounced render to avoid flicker while selecting
  function debouncedRenderSelectionBar(delay = 180) {
    try {
      if (state.selectionDebounceTimer) clearTimeout(state.selectionDebounceTimer);
      state.selectionDebounceTimer = setTimeout(() => {
        renderSelectionBar();
      }, delay);
    } catch (err) { console.debug('debounce error', err.message); }
  }

  // ── Get Selection Context ──────────────────────────────────────────────────
  function getEditorSelectionContext() {
    const activeDoc = global.state?.activePath ? global.state.openedFiles?.get(global.state.activePath) : null;
    
    if (!activeDoc || !global.state?.editor) {
      return null;
    }

    const editor = global.state.editor;
    const sel = editor.getSelection?.();
    
    if (!sel || sel.isEmpty?.()) {
      return null;
    }

    const selectedText = editor.getModel?.()?.getValueInRange?.(sel) || "";
    const filePath = activeDoc.path;
    const language = activeDoc.language || detectLanguageFromPath(filePath);
    const fullContent = editor.getValue?.() || activeDoc.content || "";
    
    return {
      filePath,
      language,
      selectedText: selectedText.slice(0, MAX_SELECTION_LENGTH),
      startLine: sel.startLineNumber,
      endLine: sel.endLineNumber,
      fullFileContent: fullContent.slice(0, MAX_FILE_CONTENT_LENGTH),
      dirty: activeDoc.dirty,
      selectedTextTruncated: selectedText.length > MAX_SELECTION_LENGTH,
      fileTruncated: fullContent.length > MAX_FILE_CONTENT_LENGTH
    };
  }

  // ── Action Prompts ────────────────────────────────────────────────────────
  function buildActionPrompt(actionType, selectionContext) {
    if (!selectionContext) return null;

    const { selectedText, filePath, language, startLine, endLine } = selectionContext;
    const lineInfo = `linhas ${startLine}-${endLine}`;

    const prompts = {
      explain: `Explique o que faz este código no arquivo ${filePath} (${language}, ${lineInfo}):

\`\`\`${language}
${selectedText}
\`\`\`

Forneça uma explicação clara e concisa. Inclua:
- O que o código faz
- Padrões ou técnicas usadas
- Possíveis melhorias`,

      refactor: `Refatore este código do arquivo ${filePath} (${language}, ${lineInfo}) para melhorar legibilidade, performance ou manutenibilidade:

\`\`\`${language}
${selectedText}
\`\`\`

Requisitos:
- Mantenha a compatibilidade com o resto do arquivo
- Se alterar código, gere um patch revisável
- Não aplique nada automaticamente
- Explique cada mudança`,

      fix: `Identifique e corrija problemas neste código do arquivo ${filePath} (${language}, ${lineInfo}):

\`\`\`${language}
${selectedText}
\`\`\`

Procure por:
- Bugs ou erros lógicos
- Problemas de tipos
- Edge cases não tratados
- Padrões ruins

Se encontrar problemas, gere um patch revisável.`,

      tests: `Gere testes unitários para este código do arquivo ${filePath} (${language}, ${lineInfo}):

\`\`\`${language}
${selectedText}
\`\`\`

Crie testes que:
- Cubram casos normais
- Testem edge cases
- Validem comportamento esperado
- Usem a mesma linguagem (${language})

Gere um patch com arquivo de teste ou função de teste.`,

      transform_function: `Extraia este código do arquivo ${filePath} (${language}, ${lineInfo}) em uma função nomeada bem estruturada:

\`\`\`${language}
${selectedText}
\`\`\`

A função deve:
- Ter nome descritivo
- Receber parâmetros necessários
- Retornar valores úteis
- Incluir documentação/tipos

Gere um patch com a nova função.`,

      optimize: `Otimize este código para melhor performance no arquivo ${filePath} (${language}, ${lineInfo}):

\`\`\`${language}
${selectedText}
\`\`\`

Analise:
- Complexidade de tempo/espaço
- Loops ineficientes
- Alocações desnecessárias
- Chamadas redundantes

Se encontrar otimizações, gere um patch com melhorias.`,

      security: `Analise este código para problemas de segurança no arquivo ${filePath} (${language}, ${lineInfo}):

\`\`\`${language}
${selectedText}
\`\`\`

Procure por:
- Injeção (SQL, XSS, etc.)
- Autenticação/autorização fraca
- Dados sensíveis expostos
- Desserialização insegura
- Validação inadequada
- Criptografia fraca

Reporte problemas e sugira patches se aplicável.`
    };
    if (prompts[actionType]) return prompts[actionType];

    // Check custom actions
    const custom = findCustomAction(actionType);
    if (custom && custom.promptTemplate) {
      // Interpolate template
      return interpolateTemplate(custom.promptTemplate, selectionContext);
    }

    return null;
  }

  // ── Selection Bar UI ───────────────────────────────────────────────────────
  function createSelectionBar() {
    const container = document.createElement("div");
    container.id = "editor-selection-bar";
    container.className = "editor-selection-bar";
    container.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      z-index: 1000;
      background: var(--vscode-editor-background, #1e1e1e);
      border: 1px solid var(--vscode-editorWidget-border, #333);
      border-radius: 4px;
      padding: 4px;
      display: flex;
      gap: 4px;
      max-width: 100%;
      overflow-x: auto;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `;

    state.selectionBar = container;
    return container;
  }

  function renderSelectionBar() {
    const context = getEditorSelectionContext();
    
    // Hide bar if no selection
    if (!context) {
      if (state.selectionBar) {
        state.selectionBar.style.display = "none";
      }
      return;
    }

    const bar = state.selectionBar || createSelectionBar();
    const activeDoc = global.state?.openedFiles?.get(global.state.activePath);

    // Show bar and populate with action buttons
    bar.style.display = "flex";
    bar.innerHTML = Object.entries(ACTION_TYPES)
      .map(([actionId, actionInfo]) => {
        const canDo = canPerformAction(actionInfo, activeDoc);
        const blockingReason = getBlockingReason(actionInfo, activeDoc);
        const disabled = !canDo;
        const title = blockingReason || actionInfo.description;
        const ariaDisabled = disabled ? "true" : "false";

        return `
          <button 
            type="button"
            class="editor-selection-action-btn${disabled ? ' disabled' : ''}"
            data-action="${esc(actionId)}"
            title="${esc(title)}"
            aria-disabled="${ariaDisabled}"
            style="
              padding: 6px 10px;
              border: 1px solid var(--vscode-button-border, transparent);
              background: var(--vscode-button-background, #007acc);
              color: var(--vscode-button-foreground, white);
              border-radius: 3px;
              cursor: ${disabled ? 'not-allowed' : 'pointer'};
              opacity: ${disabled ? 0.5 : 1};
              font-size: 12px;
              white-space: nowrap;
              display: flex;
              align-items: center;
              gap: 4px;
            "
            ${disabled ? 'disabled' : ''}
          >
            <i class="codicon ${esc(actionInfo.icon)}" style="font-size: 14px;"></i>
            <span>${esc(actionInfo.label)}</span>
          </button>
        `;
      })
      .join("");

    // Reorder actions: favorited actions first (preserve user order) and include custom actions
    const builtInIds = Object.keys(ACTION_TYPES);
    const customIds = Array.isArray(state.customActions) ? state.customActions.map(a => a.id) : [];
    const allIds = [...builtInIds, ...customIds];
    const favoriteIds = Array.isArray(state.favorites) ? state.favorites.filter(id => allIds.includes(id)) : [];
    const remainingIds = allIds.filter(id => !favoriteIds.includes(id));
    const orderedIds = [...favoriteIds, ...remainingIds];

    bar.innerHTML = orderedIds.map((actionId) => {
      const isCustom = customIds.includes(actionId);
      const actionInfo = isCustom ? findCustomAction(actionId) : ACTION_TYPES[actionId];
      const canDo = canPerformAction(actionInfo, activeDoc);
      const blockingReason = getBlockingReason(actionInfo, activeDoc);
      const disabled = !canDo;
      const title = blockingReason || (actionInfo && actionInfo.description) || '';
      const ariaDisabled = disabled ? "true" : "false";
      const isFav = favoriteIds.includes(actionId);
      const icon = (isCustom ? (actionInfo.icon || 'codicon-star') : actionInfo.icon) || '';
      const label = isCustom ? (actionInfo.label || actionId) : actionInfo.label;

      return `
        <div class="esa-action-wrap" style="display:inline-flex;align-items:center;gap:6px">
          <button 
            type="button"
            class="editor-selection-action-btn${disabled ? ' disabled' : ''}"
            data-action="${esc(actionId)}"
            title="${esc(title)}"
            aria-disabled="${ariaDisabled}"
            style="padding:6px 10px;border:1px solid var(--vscode-button-border, transparent);background:var(--vscode-button-background, #007acc);color:var(--vscode-button-foreground, white);border-radius:3px;cursor:${disabled ? 'not-allowed' : 'pointer'};opacity:${disabled ? 0.5 : 1};font-size:12px;white-space:nowrap;display:flex;align-items:center;gap:4px;"
            ${disabled ? 'disabled' : ''}
          >
            <i class="codicon ${esc(icon)}" style="font-size:14px;"></i>
            <span>${esc(label)}</span>
          </button>
          <button class="esa-fav-toggle" data-fav="${esc(actionId)}" title="${isFav ? 'Remover favorito' : 'Favoritar'}" style="background:transparent;border:none;color:var(--vscode-yellow);font-size:14px;cursor:pointer;padding:2px 6px">${isFav ? '★' : '☆'}</button>
        </div>
      `;
    }).join("");

    // Attach event listeners for action buttons
    bar.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const actionId = btn.dataset.action;
        if (btn.disabled || btn.hasAttribute('aria-disabled')) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        handleActionClick(actionId);
      });
    });

    // Favorite toggle handlers (prevent triggering action click)
    bar.querySelectorAll('.esa-fav-toggle').forEach((fbtn) => {
      fbtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const aid = fbtn.dataset.fav;
        toggleFavorite(aid);
      });
    });

    // Add utility buttons: history, analytics, undo
    const extras = document.createElement('div');
    extras.style.cssText = 'display:flex;align-items:center;gap:6px;padding-left:8px;border-left:1px solid rgba(255,255,255,0.03);margin-left:8px';
    extras.innerHTML = `
      <button id="esa-history-btn" class="btn-ghost" title="Histórico">Histórico</button>
      <button id="esa-analytics-btn" class="btn-ghost" title="Estatísticas">Estatísticas</button>
      <button id="esa-custom-btn" class="btn-ghost" title="Ações customizadas">Ações</button>
      <button id="esa-reorder-btn" class="btn-ghost" title="Reordenar favoritos">Reordenar</button>
      <button id="esa-undo-btn" class="btn-ghost" title="Desfazer última alteração">Desfazer</button>
    `;

    // Remove previous extras if present
    const existingExtras = bar.querySelector('.esa-extras');
    if (existingExtras) existingExtras.remove();
    extras.className = 'esa-extras';
    bar.appendChild(extras);

    // Wire extra buttons
    const histBtn = bar.querySelector('#esa-history-btn');
    const statsBtn = bar.querySelector('#esa-analytics-btn');
    const undoBtn = bar.querySelector('#esa-undo-btn');
    if (histBtn) histBtn.addEventListener('click', (e) => { e.preventDefault(); showHistoryModal(); });
    if (statsBtn) statsBtn.addEventListener('click', (e) => { e.preventDefault(); showAnalyticsModal(); });
    const customBtn = bar.querySelector('#esa-custom-btn');
    if (customBtn) customBtn.addEventListener('click', (e) => { e.preventDefault(); showCustomActionsModal(); });
    const reorderBtn = bar.querySelector('#esa-reorder-btn');
    if (reorderBtn) reorderBtn.addEventListener('click', (e) => { e.preventDefault(); showReorderModal(); });
    if (undoBtn) undoBtn.addEventListener('click', (e) => { e.preventDefault(); undoLast(); });

    // Attach to editor container if not already attached
    const editorContainer = document.getElementById("monaco-editor");
    if (editorContainer && !bar.parentElement) {
      const wrapper = editorContainer.parentElement;
      if (wrapper) {
        wrapper.style.position = "relative";
        wrapper.appendChild(bar);
      }
    }
  }

  function hideSelectionBar() {
    if (state.selectionBar) {
      state.selectionBar.style.display = "none";
    }
  }

  // ── Action Handler ────────────────────────────────────────────────────────
  async function handleActionClick(actionId) {
    const context = getEditorSelectionContext();
    if (!context) {
      console.warn("No selection context available");
      return;
    }

    const actionInfo = getActionInfoById(actionId);
    if (!actionInfo) {
      console.warn("Unknown action:", actionId);
      return;
    }

    const activeDoc = global.state?.openedFiles?.get(global.state.activePath);
    if (!canPerformAction(actionInfo, activeDoc)) {
      const reason = getBlockingReason(actionInfo, activeDoc);
      alert(reason || "Esta ação não pode ser realizada agora");
      return;
    }

    // Confirm for patch-generating actions
    const ok = await confirmPatchAction(actionId, context, actionInfo);
    if (!ok) return;

    // Record history and analytics
    try { addToHistory(context, actionId); } catch (err) { console.debug(err); }
    try { recordAnalytics(actionId); } catch (err) { console.debug(err); }

    // Save undo snapshot for patch actions
    try {
      if (actionInfo.generatesPatch && global.state?.editor) {
        const prev = global.state.editor.getValue?.() || "";
        state.undoStack.push({ filePath: context.filePath, prevContent: prev });
        if (state.undoStack.length > 20) state.undoStack.shift();
        saveToStorage(PERSIST_KEYS.UNDO, state.undoStack);
      }
    } catch (err) { console.debug("undo save error", err.message); }

    state.lastAction = {
      type: actionId,
      context,
      timestamp: Date.now()
    };

    sendActionToAI(actionId, context, actionInfo);
  }

  function sendActionToAI(actionId, selectionContext, actionInfo) {
    const prompt = buildActionPrompt(actionId, selectionContext);
    if (!prompt) {
      console.error("Could not build prompt for action:", actionId);
      return;
    }

    // Get AI panel input
    const chatInput = document.getElementById("dm-input") || 
                      document.querySelector("#devmindChat textarea") ||
                      document.querySelector("#devmindChat input");

    if (!chatInput) {
      alert("Painel de IA não encontrado. Abra o painel Nexus AI primeiro.");
      return;
    }

    // Set the prompt and metadata
    chatInput.value = prompt;
    
    // Build complete selection context for pendingContext
    const contextInfo = [
      `Arquivo: ${selectionContext.filePath}`,
      `Linguagem: ${selectionContext.language}`,
      `Linhas: ${selectionContext.startLine}-${selectionContext.endLine}`,
      `Trecho selecionado (${selectionContext.selectedText.length} chars${selectionContext.selectedTextTruncated ? ', truncado' : ''}):`,
      '```' + selectionContext.language,
      selectionContext.selectedText,
      '```',
      `Arquivo completo (${selectionContext.fullFileContent.length} chars${selectionContext.fileTruncated ? ', truncado' : ''}):`
    ].join('\n');
    
    chatInput.dataset.pendingContext = contextInfo;
    chatInput.dataset.selectionAction = actionId;
    chatInput.dataset.selectionContext = JSON.stringify({
      filePath: selectionContext.filePath,
      language: selectionContext.language,
      selectedText: selectionContext.selectedText,
      startLine: selectionContext.startLine,
      endLine: selectionContext.endLine,
      fullFileContent: selectionContext.fullFileContent,
      dirty: selectionContext.dirty,
      selectedTextTruncated: selectionContext.selectedTextTruncated,
      fileTruncated: selectionContext.fileTruncated
    });

    // Focus and trigger input event
    chatInput.focus();
    chatInput.dispatchEvent(new Event("input", { bubbles: true }));

    // Show status message
    if (typeof setStatus === "function") {
      setStatus(`Enviando "${actionInfo.label}" para IA...`);
    }

    // Open AI panel if collapsed
    const expandBtn = document.getElementById("btn-expand-ai");
    const aiPanel = document.getElementById("ai-panel");
    const aiPanelCollapsed = document.getElementById("ai-panel-collapsed");
    
    if (expandBtn && aiPanelCollapsed && aiPanelCollapsed.style.display !== "none") {
      // Panel is collapsed, expand it
      expandBtn.click();
    }
    
    // Ensure panel is visible and focused
    if (aiPanel) {
      aiPanel.style.display = "flex";
    }
  }

  // ── Monitor Editor Changes ────────────────────────────────────────────────
  function initSelectionMonitoring() {
    // Monitor Monaco Editor for selection changes
    if (!global.state?.editor) {
      // Retry if editor not ready
      setTimeout(initSelectionMonitoring, 500);
      return;
    }

    const editor = global.state.editor;

    // Update bar when selection changes (debounced)
    editor.onDidChangeCursorSelection?.((e) => {
      debouncedRenderSelectionBar();
    });

    // Hide bar when editor loses focus
    editor.onDidBlurEditorText?.(() => {
      hideSelectionBar();
    });

    // Show bar when editor gains focus if there's a selection
    editor.onDidFocusEditorText?.(() => {
      debouncedRenderSelectionBar();
    });

    // Listen to Monaco Editor context menu (if API available)
    setupContextMenuIntegration();

    console.log("Editor selection monitoring initialized");
  }

  // ── Context Menu Integration ──────────────────────────────────────────────
  function setupContextMenuIntegration() {
    // Monaco context menu actions
    if (typeof global.registerEditorAction !== "function") {
      return;
    }

    // Register Nexus actions as Monaco actions (if available)
    // This is optional and depends on Monaco API availability
    try {
      if (window.monaco?.editor?.registerAction) {
        Object.entries(ACTION_TYPES).forEach(([actionId, actionInfo]) => {
          window.monaco.editor.registerAction({
            id: `nexus.editor.${actionId}`,
            label: `Nexus: ${actionInfo.label}`,
            contextMenuGroupId: "9_cutcopypaste",
            keybindings: [],
            run: () => handleActionClick(actionId)
          });
        });
        // Register custom actions as well
        (state.customActions || []).forEach((c) => {
          window.monaco.editor.registerAction({
            id: `nexus.editor.${c.id}`,
            label: `Nexus: ${c.label}`,
            contextMenuGroupId: "9_cutcopypaste",
            keybindings: [],
            run: () => handleActionClick(c.id)
          });
        });
      }
    } catch (err) {
      console.debug("Monaco context menu integration not available:", err.message);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  global.EditorSelectionActions = {
    /**
     * Get current editor selection context
     * @returns {Object|null} Selection context or null if no selection
     */
    getEditorSelectionContext,

    /**
     * Perform action on current selection
     * @param {string} actionId - Action type ID
     */
    performAction: handleActionClick,

    /**
     * Initialize monitoring of editor selections
     */
    init: initSelectionMonitoring,

    /**
     * Update selection bar UI
     */
    update: renderSelectionBar,

    /**
     * Hide selection bar
     */
    hide: hideSelectionBar,

    /**
     * Get action types (including custom actions)
     */
    getActionTypes: () => {
      const merged = { ...ACTION_TYPES };
      (state.customActions || []).forEach((c) => {
        merged[c.id] = { label: c.label, icon: c.icon, description: c.description, requiresSave: !!c.requiresSave, generatesPatch: !!c.generatesPatch };
      });
      return merged;
    },

    /**
     * Build action prompt
     * @param {string} actionType
     * @param {Object} context
     */
    buildPrompt: buildActionPrompt
  };

  // Auto-init on document ready if global state exists
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (global.state && global.state.editor) {
        initPersistentState();
        initKeyboardShortcuts();
        initSelectionMonitoring();
      } else {
        // still initialize persistent bits
        initPersistentState();
        initKeyboardShortcuts();
      }
    });
  } else if (global.state && global.state.editor) {
    initPersistentState();
    initKeyboardShortcuts();
    initSelectionMonitoring();
  }

})(window);
