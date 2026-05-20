/* Monaco editor, tabs, save */
function detectLanguage(filePath) {
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
      py: "python"
    }[ext] || "plaintext"
  );
}

function ensureMonaco() {
  if (state.monacoReady) return state.monacoReady;
  state.monacoReady = new Promise((resolve, reject) => {
    const fail = () => {
      const message = "Monaco Editor não carregou. Verifique internet ou use build local no próximo passo.";
      updateSaveStatus("erro");
      reject(new Error(message));
    };
    if (!window.require) {
      fail();
      return;
    }
    require.config({
      paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs" }
    });
    require(["vs/editor/editor.main"], () => {
      state.editor = monaco.editor.create($("#monaco-editor"), {
        value: "",
        language: "plaintext",
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: true },
        fontSize: 13,
        fontFamily: "Cascadia Code, Consolas, monospace",
        wordWrap: "off",
        scrollBeyondLastLine: false,
        renderLineHighlight: "all",
        padding: { top: 8 }
      });
      state.editor.onDidChangeModelContent(() => {
        if (state.suppressEditorChange || !state.activePath) return;
        const doc = state.openedFiles.get(state.activePath);
        if (!doc) return;
        doc.content = state.editor.getValue();
        doc.dirty = doc.content !== doc.savedContent;
        updateSaveStatus(doc.dirty ? "modificado" : "salvo");
        renderOpenFileTabs();
        renderFileTree();
      });
      state.editor.onDidChangeCursorPosition((e) => {
        state.cursorLine = e.position.lineNumber;
        state.cursorCol = e.position.column;
        updateCursorStatus();
      });
      resolve(state.editor);
    }, fail);
  });
  return state.monacoReady;
}

function updateEditorWelcome() {
  const welcome = $("#editor-welcome");
  if (!welcome) return;
  const show = !state.activePath && state.openedFiles.size === 0;
  welcome.classList.toggle("hidden", !show);
}

function updateSaveStatus(status) {
  state.saveStatus = status;
  const el = $("#editor-save-status");
  if (!el) return;
  el.textContent = status;
  el.className = "save-status";
  if (status === "modificado") el.classList.add("modified");
  if (status === "salvo") el.classList.add("saved");
  if (status === "erro") el.classList.add("error");
}

async function openDocument(filePath, content, options = {}) {
  await ensureMonaco();
  const existing = state.openedFiles.get(filePath);
  if (existing) {
    setActiveDocument(filePath);
    return existing;
  }
  const doc = {
    path: filePath,
    content,
    savedContent: content,
    language: detectLanguage(filePath),
    dirty: false,
    stagedFile: options.stagedFile || null
  };
  state.openedFiles.set(filePath, doc);
  setActiveDocument(filePath);
  return doc;
}

function setActiveDocument(filePath) {
  const doc = state.openedFiles.get(filePath);
  if (!doc || !state.editor) return;
  state.activePath = filePath;
  state.activeFile = doc;
  state.suppressEditorChange = true;
  monaco.editor.setModelLanguage(state.editor.getModel(), doc.language);
  state.editor.setValue(doc.content || "");
  state.suppressEditorChange = false;
  updateBreadcrumb(filePath);
  updateSaveStatus(doc.dirty ? "modificado" : "salvo");
  renderOpenFileTabs();
  renderFileTree();
  updateEditorWelcome();
  setTimeout(() => state.editor.layout(), 20);
}

function renderOpenFileTabs() {
  const root = $("#openFileTabs");
  if (!root) return;
  if (!state.openedFiles.size) {
    root.innerHTML = "";
    updateEditorWelcome();
    return;
  }
  root.innerHTML = Array.from(state.openedFiles.values())
    .map(
      (doc) => `
    <button type="button" class="file-tab ${doc.path === state.activePath ? "active" : ""} ${doc.dirty ? "dirty" : ""}" data-open-path="${escapeHtml(doc.path)}">
      <span class="file-tab-name">${escapeHtml(basename(doc.path))}</span>
      <span class="file-tab-close" data-close-path="${escapeHtml(doc.path)}">×</span>
    </button>`
    )
    .join("");
  root.querySelectorAll("[data-open-path]").forEach((tab) => {
    tab.addEventListener("click", () => setActiveDocument(tab.dataset.openPath));
    tab.addEventListener("auxclick", (event) => {
      if (event.button === 1) {
        event.preventDefault();
        closeFileTab(tab.dataset.openPath);
      }
    });
  });
  root.querySelectorAll("[data-close-path]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      closeFileTab(btn.dataset.closePath);
    });
  });
}

function closeFileTab(filePath) {
  const doc = state.openedFiles.get(filePath);
  if (!doc) return;
  if (doc.dirty && !confirm(`O arquivo ${filePath} foi modificado. Fechar sem salvar?`)) return;
  state.openedFiles.delete(filePath);
  if (state.activePath === filePath) {
    const next = Array.from(state.openedFiles.keys())[0];
    if (next) setActiveDocument(next);
    else clearEditorIfNoActiveFile();
  } else {
    renderOpenFileTabs();
    renderFileTree();
  }
}

function clearEditorIfNoActiveFile() {
  state.activePath = null;
  state.activeFile = null;
  if (state.editor) state.editor.setValue("");
  updateBreadcrumb(null);
  updateSaveStatus("sem arquivo");
  renderOpenFileTabs();
  renderFileTree();
  updateEditorWelcome();
}

async function saveActiveFile() {
  const doc = state.openedFiles.get(state.activePath);
  if (!doc) return;
  if (doc.stagedFile) {
    setStatus("Arquivos staged devem ser aplicados pelo Patch Review.");
    showBottomPanel("patch");
    return;
  }
  try {
    updateSaveStatus("salvando");
    const content = state.editor ? state.editor.getValue() : doc.content;
    const res = await api("/api/project/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectRoot: state.project?.projectPath || ".",
        path: doc.path,
        content
      })
    });
    doc.content = content;
    doc.savedContent = res.data?.content ?? content;
    doc.dirty = false;
    updateSaveStatus("salvo");
    setStatus("Arquivo salvo: " + doc.path);
    renderOpenFileTabs();
    renderFileTree();
  } catch (error) {
    updateSaveStatus("erro");
    setStatus("Erro ao salvar: " + error.message);
  }
}

async function openFile(filePath, stagedFile = null) {
  if (!state.project && !stagedFile) return;
  try {
    if (stagedFile) {
      const res = await api("/api/staged-files/" + stagedFile.id);
      const sf = res.data;
      await openDocument(filePath, sf.content, { stagedFile: sf });
      return;
    }
    const res = await api(
      "/api/project/file?projectRoot=" +
        encodeURIComponent(state.project.projectPath) +
        "&filePath=" +
        encodeURIComponent(filePath)
    );
    await openDocument(filePath, res.content || res.data?.content || "");
  } catch (e) {
    setStatus("Falha ao carregar: " + e.message);
  }
}

function initEditor() {
  updateEditorWelcome();
  $("#btn-save-file")?.addEventListener("click", saveActiveFile);
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveActiveFile();
    }
  });
}
