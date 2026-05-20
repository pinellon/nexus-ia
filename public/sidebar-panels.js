/* Git status sidebar */
async function loadGitStatus() {
  const panel = $("#git-status-panel");
  if (!panel) return;
  panel.innerHTML = '<div class="placeholder-view">Carregando...</div>';

  try {
    const res = await api("/api/git/status");
    const data = res.data || res;
    const branch = data.branch || "—";
    const changedCount = data.changedFiles ?? 0;
    const lines = Array.isArray(data.statusLines) ? data.statusLines : [];

    const rows = lines.length
      ? lines.slice(0, 60).map((line) => {
          const trimmed = String(line).trim();
          const status = trimmed.charAt(0) || "?";
          const filePath = trimmed.slice(1).trim() || trimmed;
          return `<div class="git-file-row">
            <span class="git-status-mark">${escapeHtml(status)}</span>
            <span class="git-file-path">${escapeHtml(filePath)}</span>
          </div>`;
        })
      : [];

    panel.innerHTML = `
      <div class="git-summary">
        <div class="git-branch"><i class="codicon codicon-source-control"></i> ${escapeHtml(branch)}</div>
        <span class="git-changed-count">${changedCount} alteração(ões)</span>
        <button type="button" class="btn-ghost btn-sm" id="btn-refresh-git"><i class="codicon codicon-refresh"></i> Atualizar</button>
      </div>
      <div class="git-file-list">${
        rows.length ? rows.join("") : '<div class="placeholder-view">Working tree limpo.</div>'
      }</div>
    `;

    $("#btn-refresh-git")?.addEventListener("click", loadGitStatus);
  } catch {
    panel.innerHTML = '<div class="empty-state">Git indisponível neste projeto.</div>';
  }
}
