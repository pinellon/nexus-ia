/* global state, $, setStatus, activeProjectRoot, basename */

function isHtmlPreviewPath(filePath) {
  return /\.html?$/i.test(String(filePath || ''));
}

function encodePreviewPath(filePath) {
  return String(filePath || '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function buildProjectPreviewUrl(filePath, cacheBust = true) {
  const suffix = cacheBust ? `?t=${Date.now()}` : '';
  return `/preview/project/${encodePreviewPath(filePath)}${suffix}`;
}

function isLocalPreviewUrl(url) {
  return String(url || '').startsWith('/preview/');
}

function updatePreviewPopoutState(blocked) {
  const btn = $('#btn-popout-preview');
  if (!btn) return;
  btn.classList.toggle('is-disabled', Boolean(blocked));
  btn.setAttribute('aria-disabled', blocked ? 'true' : 'false');
  btn.title = blocked
    ? 'Popout seguro indisponivel para preview local. Use o preview embutido.'
    : 'Abrir em nova aba';
}

function findProjectIndexHtml() {
  const files = state.files || [];
  return (
    files.find((file) => file.path === 'index.html')?.path ||
    files.find((file) => file.path === 'public/index.html')?.path ||
    files.find((file) => /(?:^|\/)index\.html$/i.test(file.path))?.path ||
    files.find((file) => /\.html?$/i.test(file.path))?.path ||
    null
  );
}

function injectPreviewBase(html, filePath) {
  const dir = String(filePath || '')
    .split('/')
    .slice(0, -1)
    .join('/');
  const baseHref = dir ? `/preview/project/${encodePreviewPath(dir)}/` : '/preview/project/';
  const baseTag = `<base href="${baseHref}">`;
  if (/<base\s/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  }
  return `${baseTag}\n${html}`;
}

function getActiveHtmlPreview() {
  const active = window.NexusIDE?.getActiveFile?.();
  if (active?.path && isHtmlPreviewPath(active.path)) {
    return {
      kind: 'file',
      path: active.path,
      content: active.content || '',
      dirty: Boolean(active.dirty),
    };
  }
  return null;
}

function resolvePreviewTarget(target) {
  if (typeof target === 'string' && target.trim()) {
    if (/^https?:\/\//i.test(target) || target.startsWith('/preview/')) {
      return { kind: 'url', url: target };
    }
    return { kind: 'file', path: target };
  }

  const active = getActiveHtmlPreview();
  if (active) return active;

  if (state.previewUrl) return { kind: 'url', url: state.previewUrl };

  const stagedHtml = (state.stagedFiles || []).find(
    (file) => file.run_id && /(?:^|\/)index\.html$/i.test(file.path),
  );
  if (stagedHtml?.run_id) {
    return {
      kind: 'url',
      url: `/preview/staged/${encodeURIComponent(stagedHtml.run_id)}/index.html`,
    };
  }

  const indexHtml = findProjectIndexHtml();
  return indexHtml ? { kind: 'file', path: indexHtml } : null;
}

function renderPreviewTarget(target, refresh = false) {
  const frame = $('#preview-frame');
  const title = $('#preview-title-path');
  if (!frame) return null;

  if (target.kind === 'url') {
    frame.removeAttribute('srcdoc');
    frame.src =
      refresh && target.url.startsWith('/')
        ? `${target.url}${target.url.includes('?') ? '&' : '?'}t=${Date.now()}`
        : target.url;
    if (title) title.textContent = target.url;
    state.previewUrl = target.url;
    state.previewPath = null;
    updatePreviewPopoutState(isLocalPreviewUrl(target.url));
    return target.url;
  }

  const active = getActiveHtmlPreview();
  if (active?.path === target.path && active.content) {
    frame.removeAttribute('src');
    frame.srcdoc = injectPreviewBase(active.content, active.path);
  } else {
    frame.removeAttribute('srcdoc');
    frame.src = buildProjectPreviewUrl(target.path, true);
  }

  if (title) title.textContent = target.path;
  state.previewPath = target.path;
  state.previewUrl = buildProjectPreviewUrl(target.path, false);
  updatePreviewPopoutState(true);
  return state.previewUrl;
}

function openPreviewPanel(target) {
  const resolved = resolvePreviewTarget(target);
  if (!resolved) {
    setStatus('Nenhum HTML encontrado para preview.');
    return;
  }

  const split = $('#editor-split');
  if (!split) return;
  split.classList.add('preview-open');
  const url = renderPreviewTarget(resolved);
  setTimeout(() => state.editor?.layout?.(), 40);
  setStatus('Preview aberto' + (url ? `: ${url}` : ''));
}

function closePreviewPanel() {
  $('#editor-split')?.classList.remove('preview-open');
  const frame = $('#preview-frame');
  if (frame) {
    frame.removeAttribute('src');
    frame.removeAttribute('srcdoc');
  }
  updatePreviewPopoutState(false);
  setTimeout(() => state.editor?.layout?.(), 40);
  setStatus('Preview fechado.');
}

function refreshPreviewPanel() {
  const target = state.previewPath
    ? { kind: 'file', path: state.previewPath }
    : resolvePreviewTarget(state.previewUrl);
  if (!target) {
    setStatus('Nenhum preview ativo.');
    return;
  }
  renderPreviewTarget(target, true);
  setStatus('Preview atualizado.');
}

function popoutPreview() {
  if (state.previewPath) {
    setStatus(
      'Popout seguro ainda nao esta disponivel para preview local. Use o preview embutido.',
    );
    return;
  }
  const target = resolvePreviewTarget(state.previewUrl);
  if (target?.kind === 'url') {
    if (isLocalPreviewUrl(target.url)) {
      setStatus(
        'Popout seguro ainda nao esta disponivel para preview local. Use o preview embutido.',
      );
      return;
    }
    window.open(target.url, '_blank', 'noopener,noreferrer');
  }
}

function initPreview() {
  $('#btn-refresh-preview')?.addEventListener('click', refreshPreviewPanel);
  $('#btn-popout-preview')?.addEventListener('click', popoutPreview);
  $('#btn-close-preview')?.addEventListener('click', closePreviewPanel);
}

window.openPreviewPanel = openPreviewPanel;
window.openProjectPreview = openPreviewPanel;
window.refreshPreviewPanel = refreshPreviewPanel;
window.closePreviewPanel = closePreviewPanel;
window.initPreview = initPreview;
