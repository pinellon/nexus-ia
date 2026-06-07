/* Git status sidebar */
async function loadGitStatus() {
  const panel = $('#git-status-panel');
  if (!panel) return;
  panel.innerHTML = '<div class="placeholder-view">Carregando...</div>';

  try {
    const res = await api('/api/git/status');
    const data = res.data || res;
    const branch = data.branch || '-';
    const changedCount = data.changedFiles ?? 0;
    const lines = Array.isArray(data.statusLines) ? data.statusLines : [];

    const rows = lines.length
      ? lines.slice(0, 60).map((line) => {
          const trimmed = String(line).trim();
          const status = trimmed.charAt(0) || '?';
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
        <span class="git-changed-count">${changedCount} alteracao(oes)</span>
        <button type="button" class="btn-ghost btn-sm" id="btn-refresh-git"><i class="codicon codicon-refresh"></i> Atualizar</button>
      </div>
      <div class="git-file-list">${
        rows.length ? rows.join('') : '<div class="placeholder-view">Working tree limpo.</div>'
      }</div>
      <div class="git-commit-box">
        <button type="button" class="btn-secondary btn-sm" id="btn-git-diff">Ver diff</button>
        <button type="button" class="btn-secondary btn-sm" id="btn-generate-commit">Gerar mensagem</button>
        <textarea id="git-commit-message" class="git-commit-input" placeholder="Mensagem de commit..." ${changedCount ? '' : 'disabled'}></textarea>
        <button type="button" class="btn-primary btn-sm" id="btn-create-commit" ${changedCount ? '' : 'disabled'}>Criar commit</button>
        <div class="git-commit-status" id="git-commit-status"></div>
      </div>
    `;

    $('#btn-refresh-git')?.addEventListener('click', loadGitStatus);
    $('#btn-git-diff')?.addEventListener('click', showGitDiffInOutput);
    $('#btn-generate-commit')?.addEventListener('click', generateGitCommitMessage);
    $('#btn-create-commit')?.addEventListener('click', createGitCommitFromUi);
  } catch {
    panel.innerHTML = '<div class="empty-state">Git indisponivel neste projeto.</div>';
  }
}

async function showGitDiffInOutput() {
  try {
    const res = await api('/api/git/diff');
    showBottomPanel('output');
    const output = $('#output-body');
    if (output) output.textContent = res.data?.diff || 'Sem diff.';
  } catch (error) {
    setStatus('Falha ao carregar diff: ' + error.message);
  }
}

async function generateGitCommitMessage() {
  const status = $('#git-commit-status');
  const input = $('#git-commit-message');
  if (status) status.textContent = 'Gerando...';
  try {
    const res = await api('/api/git/commit-message', { method: 'POST' });
    if (input) input.value = res.data?.message || '';
    if (status) status.textContent = 'Mensagem sugerida. Revise antes de commitar.';
  } catch (error) {
    if (status) status.textContent = error.message;
  }
}

async function createGitCommitFromUi() {
  const input = $('#git-commit-message');
  const status = $('#git-commit-status');
  const message = input?.value?.trim();
  if (!message) {
    if (status) status.textContent = 'Informe uma mensagem de commit.';
    return;
  }
  if (!confirm(`Criar commit com a mensagem abaixo?\n\n${message}`)) {
    return;
  }
  try {
    const res = await api('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (status) status.textContent = 'Commit criado: ' + (res.data?.output || message);
    setStatus('Commit criado com sucesso.');
    await loadGitStatus();
  } catch (error) {
    if (status) status.textContent = error.message;
    setStatus('Falha ao criar commit: ' + error.message);
  }
}
