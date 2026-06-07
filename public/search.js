/* Quick open / search in project files */
function initSearch() {
  const input = $('#search-input');
  const results = $('#search-results');
  if (!input || !results) return;

  let debounceTimer = null;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => renderSearchResults(input.value.trim()), 120);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      renderSearchResults('');
      return;
    }
    const first = results.querySelector('.search-result');
    if (event.key === 'Enter' && first) {
      event.preventDefault();
      first.click();
    }
  });

  renderSearchResults('');
}

function renderSearchResults(query) {
  const results = $('#search-results');
  if (!results) return;

  if (!query) {
    results.innerHTML =
      '<div class="placeholder-view">Digite para filtrar arquivos do projeto.</div>';
    results.innerHTML = results.innerHTML.replace('</div>', '</div>');
    return;
  }

  const q = query.toLowerCase();
  const matches = state.files.filter((f) => f.path?.toLowerCase().includes(q)).slice(0, 40);

  if (!matches.length) {
    results.innerHTML = '<div class="empty-state">Nenhum arquivo encontrado.</div>';
    return;
  }

  results.innerHTML = matches
    .map(
      (f) => `
    <button type="button" class="search-result" data-path="${escapeHtml(f.path)}">
      <i class="codicon codicon-file"></i>
      <span class="search-result-path">${escapeHtml(f.path)}</span>
    </button>`,
    )
    .join('');

  results.querySelectorAll('.search-result').forEach((btn) => {
    btn.addEventListener('click', () => {
      openFile(btn.dataset.path);
      if (typeof activateSideView === 'function') activateSideView('explorer');
    });
  });
}
