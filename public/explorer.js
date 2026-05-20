/* File tree explorer */
function fileCodicon(node, isExpanded) {
  if (node.type === "directory") {
    return isExpanded ? "codicon-folder-opened" : "codicon-folder";
  }
  const ext = String(node.name || node.path || "")
    .split(".")
    .pop()
    ?.toLowerCase();
  const map = {
    ts: "codicon-file-code",
    tsx: "codicon-file-code",
    js: "codicon-file-code",
    jsx: "codicon-file-code",
    json: "codicon-json",
    html: "codicon-file-code",
    css: "codicon-file-code",
    md: "codicon-markdown",
    py: "codicon-file-code"
  };
  return map[ext] || "codicon-file";
}

function isPathInsideFolder(filePath, folderPath) {
  return filePath === folderPath || filePath.startsWith(folderPath + "/");
}

function renderFileTree() {
  const tree = $("#fileTree");
  if (!tree) return;
  tree.innerHTML = "";
  if (!state.tree.length && !state.stagedFiles?.length) {
    tree.innerHTML = '<div class="empty-state">Nenhum arquivo</div>';
    return;
  }

  (state.stagedFiles || []).forEach((f) => {
    const div = document.createElement("div");
    div.className = "tree-row";
    div.innerHTML = `<span class="tree-icon"><i class="codicon codicon-diff"></i></span><span class="tree-label">${escapeHtml(f.path)}</span><span class="badge ok">Staged</span>`;
    div.onclick = () => {
      $all(".tree-row").forEach((el) => el.classList.remove("active"));
      div.classList.add("active");
      openFile(f.path, f);
    };
    tree.appendChild(div);
  });

  function renderNode(node, depth) {
    const div = document.createElement("div");
    const isFolder = node.type === "directory";
    const isExpanded = state.expandedDirs.has(node.path || "");
    div.className = `tree-row ${isFolder ? "folder" : "file"} ${state.activePath === node.path ? "active" : ""}`;
    div.style.paddingLeft = `${4 + depth * 14}px`;
    const dirtyMark = state.openedFiles.get(node.path)?.dirty ? " •" : "";
    div.innerHTML = `
      <span class="tree-icon">${isFolder ? (isExpanded ? "▾" : "▸") : fileIcon(node)}</span>
      <span class="tree-label">${escapeHtml(node.name || node.path)}${dirtyMark}</span>
      <span class="tree-actions">
        <button type="button" class="tree-action" data-action="rename" title="Renomear"><i class="codicon codicon-edit"></i></button>
        <button type="button" class="tree-action" data-action="delete" title="Deletar"><i class="codicon codicon-trash"></i></button>
      </span>`;
    div.onclick = () => {
      $all(".tree-row").forEach((el) => el.classList.remove("active"));
      div.classList.add("active");
      if (isFolder) {
        if (isExpanded) state.expandedDirs.delete(node.path);
        else state.expandedDirs.add(node.path);
        renderFileTree();
        return;
      }
      openFile(node.path);
    };
    div.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (btn.dataset.action === "rename") renameTreePath(node.path);
        if (btn.dataset.action === "delete") deleteTreePath(node.path, node.type);
      });
    });
    tree.appendChild(div);
    if (isFolder && isExpanded) (node.children || []).forEach((child) => renderNode(child, depth + 1));
  }

  (state.tree || []).forEach((node) => renderNode(node, 0));
}

async function createProjectFile() {
  const filePath = prompt("Novo arquivo (ex: src/example.ts):");
  if (!filePath) return;
  try {
    await api("/api/project/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectRoot: state.project?.projectPath || ".", path: filePath, content: "" })
    });
    state.expandedDirs.add(dirname(filePath));
    await loadFiles(state.project.projectPath);
    await openFile(filePath);
    setStatus("Arquivo criado: " + filePath);
  } catch (error) {
    alert("Erro: " + error.message);
  }
}

async function createProjectFolderFromPrompt() {
  const folderPath = prompt("Nova pasta (ex: src/components):");
  if (!folderPath) return;
  try {
    await api("/api/project/folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectRoot: state.project?.projectPath || ".", path: folderPath })
    });
    state.expandedDirs.add(dirname(folderPath));
    await loadFiles(state.project.projectPath);
    setStatus("Pasta criada: " + folderPath);
  } catch (error) {
    alert("Erro: " + error.message);
  }
}

async function renameTreePath(oldPath) {
  const newPath = prompt("Novo caminho:", oldPath);
  if (!newPath || newPath === oldPath) return;
  try {
    await api("/api/project/rename", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectRoot: state.project?.projectPath || ".", oldPath, newPath })
    });
    const renamedEntries = [];
    state.openedFiles.forEach((doc, filePath) => {
      if (filePath === oldPath || isPathInsideFolder(filePath, oldPath)) {
        renamedEntries.push([filePath, filePath === oldPath ? newPath : newPath + filePath.slice(oldPath.length)]);
      }
    });
    renamedEntries.forEach(([from, to]) => {
      const doc = state.openedFiles.get(from);
      if (!doc) return;
      state.openedFiles.delete(from);
      doc.path = to;
      doc.language = detectLanguage(to);
      state.openedFiles.set(to, doc);
      if (state.activePath === from) state.activePath = to;
    });
    if (state.activePath) setActiveDocument(state.activePath);
    await loadFiles(state.project.projectPath);
    renderOpenFileTabs();
    setStatus("Renomeado: " + newPath);
  } catch (error) {
    alert("Erro: " + error.message);
  }
}

async function deleteTreePath(targetPath, type) {
  const label = type === "directory" ? "pasta" : "arquivo";
  if (type === "directory") {
    const dirtyChildren = Array.from(state.openedFiles.values())
      .filter((doc) => isPathInsideFolder(doc.path, targetPath) && doc.dirty)
      .map((doc) => doc.path);
    if (dirtyChildren.length) {
      if (
        !confirm(
          `A pasta contém arquivos modificados:\n\n${dirtyChildren.join("\n")}\n\nDeletar mesmo assim?`
        )
      )
        return;
    }
  }
  if (!confirm(`Deletar ${label} ${targetPath}?`)) return;
  try {
    const endpoint = type === "directory" ? "/api/project/folder" : "/api/project/file";
    const confirmQuery = type === "directory" ? "&confirm=true" : "";
    await api(
      `${endpoint}?projectRoot=${encodeURIComponent(state.project?.projectPath || ".")}&path=${encodeURIComponent(targetPath)}${confirmQuery}`,
      { method: "DELETE" }
    );
    if (type === "directory") {
      Array.from(state.openedFiles.keys()).forEach((filePath) => {
        if (isPathInsideFolder(filePath, targetPath)) state.openedFiles.delete(filePath);
      });
      if (state.activePath && isPathInsideFolder(state.activePath, targetPath)) clearEditorIfNoActiveFile();
    } else if (state.openedFiles.has(targetPath)) {
      state.openedFiles.delete(targetPath);
      if (state.activePath === targetPath) clearEditorIfNoActiveFile();
    }
    await loadFiles(state.project.projectPath);
    renderOpenFileTabs();
    setStatus(`${label} deletado`);
  } catch (error) {
    alert("Erro: " + error.message);
  }
}

function initExplorer() {
  $("#btn-refresh-tree")?.addEventListener("click", () => state.project && loadFiles(state.project.projectPath));
  $("#btn-new-file")?.addEventListener("click", createProjectFile);
  $("#btn-new-folder")?.addEventListener("click", createProjectFolderFromPrompt);
}
