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
    lastAction: null
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

    return prompts[actionType] || null;
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

    // Attach event listeners
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
  function handleActionClick(actionId) {
    const context = getEditorSelectionContext();
    if (!context) {
      console.warn("No selection context available");
      return;
    }

    const actionInfo = ACTION_TYPES[actionId];
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

    // Update bar when selection changes
    editor.onDidChangeCursorSelection?.((e) => {
      renderSelectionBar();
    });

    // Hide bar when editor loses focus
    editor.onDidBlurEditorText?.(() => {
      hideSelectionBar();
    });

    // Show bar when editor gains focus if there's a selection
    editor.onDidFocusEditorText?.(() => {
      renderSelectionBar();
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
     * Get action types
     */
    getActionTypes: () => ({ ...ACTION_TYPES }),

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
        initSelectionMonitoring();
      }
    });
  } else if (global.state && global.state.editor) {
    initSelectionMonitoring();
  }

})(window);
