/* Resizable panels and collapse */
const LAYOUT_STORAGE_KEY = 'nexus-ide-layout-v1';

function loadLayoutFromStorage() {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    Object.assign(state.layout, saved);
  } catch {
    /* ignore */
  }
}

function saveLayoutToStorage() {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state.layout));
  } catch {
    /* ignore */
  }
}

function applyLayoutCss() {
  const root = document.documentElement;
  const L = state.layout;
  root.style.setProperty('--sidebar-width', `${L.sidebarWidth}px`);
  root.style.setProperty('--ai-width', L.aiCollapsed ? '0px' : `${L.aiWidth}px`);
  root.style.setProperty('--bottom-height', L.bottomCollapsed ? '0px' : `${L.bottomHeight}px`);

  const shell = $('.ide-shell');
  if (!shell) return;
  shell.classList.toggle('ai-collapsed', L.aiCollapsed);
  shell.classList.toggle('bottom-collapsed', L.bottomCollapsed);
  shell.classList.toggle('sidebar-collapsed', !!L.sidebarCollapsed);
}

function toggleSidebar() {
  state.layout.sidebarCollapsed = !state.layout.sidebarCollapsed;
  applyLayoutCss();
  saveLayoutToStorage();
  setTimeout(() => state.editor?.layout(), 50);
}

window.toggleSidebar = toggleSidebar;

function initResize(handle, axis, onResize) {
  let start = 0;
  let startSize = 0;

  handle.addEventListener('mousedown', (event) => {
    event.preventDefault();
    handle.classList.add('dragging');
    start = axis === 'x' ? event.clientX : event.clientY;
    startSize = onResize('start');

    const onMove = (moveEvent) => {
      const current = axis === 'x' ? moveEvent.clientX : moveEvent.clientY;
      onResize('move', current - start, startSize);
      applyLayoutCss();
    };

    const onUp = () => {
      handle.classList.remove('dragging');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      saveLayoutToStorage();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

function initLayout() {
  loadLayoutFromStorage();
  applyLayoutCss();

  $('#btn-collapse-sidebar')?.addEventListener('click', toggleSidebar);

  const sidebarHandle = $('.resize-v[data-resize="sidebar"]');
  if (sidebarHandle) {
    initResize(sidebarHandle, 'x', (phase, delta, startSize) => {
      if (phase === 'start') return state.layout.sidebarWidth;
      state.layout.sidebarWidth = Math.min(480, Math.max(160, startSize + delta));
      return state.layout.sidebarWidth;
    });
  }

  const aiHandle = $('.resize-v[data-resize="ai"]');
  if (aiHandle) {
    initResize(aiHandle, 'x', (phase, delta, startSize) => {
      if (phase === 'start') return state.layout.aiWidth;
      state.layout.aiWidth = Math.min(600, Math.max(280, startSize - delta));
      return state.layout.aiWidth;
    });
  }

  const bottomHandle = $('.resize-h[data-resize="bottom"]');
  if (bottomHandle) {
    initResize(bottomHandle, 'y', (phase, delta, startSize) => {
      if (phase === 'start') return state.layout.bottomHeight;
      state.layout.bottomHeight = Math.min(500, Math.max(100, startSize - delta));
      state.layout.bottomCollapsed = false;
      return state.layout.bottomHeight;
    });
  }

  $('#btn-toggle-ai')?.addEventListener('click', () => {
    state.layout.aiCollapsed = !state.layout.aiCollapsed;
    applyLayoutCss();
    saveLayoutToStorage();
    setTimeout(() => state.editor?.layout(), 50);
    setTimeout(() => state.diffEditor?.layout(), 50);
  });

  $('#btn-expand-ai')?.addEventListener('click', () => {
    state.layout.aiCollapsed = false;
    applyLayoutCss();
    saveLayoutToStorage();
    setTimeout(() => state.editor?.layout(), 50);
  });

  $('#btn-toggle-bottom')?.addEventListener('click', () => {
    state.layout.bottomCollapsed = !state.layout.bottomCollapsed;
    applyLayoutCss();
    saveLayoutToStorage();
    setTimeout(() => state.editor?.layout(), 50);
  });
}

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    const mod = event.ctrlKey || event.metaKey;
    if (!mod) return;
    const key = event.key.toLowerCase();

    if (key === 'b' && !event.shiftKey) {
      event.preventDefault();
      toggleSidebar();
      return;
    }
    if (key === '`') {
      event.preventDefault();
      if (typeof window.toggleTerminal === 'function') window.toggleTerminal();
      return;
    }
    if (event.shiftKey && key === 'e') {
      event.preventDefault();
      if (typeof activateSideView === 'function') activateSideView('explorer');
      return;
    }
    if (event.shiftKey && key === 'f') {
      event.preventDefault();
      if (typeof activateSideView === 'function') activateSideView('search');
      $('#search-input')?.focus();
      return;
    }
    if (key === 'p') {
      event.preventDefault();
      if (typeof activateSideView === 'function') activateSideView('search');
      const input = $('#search-input');
      if (input) {
        input.focus();
        input.select();
      }
    }
  });
}

function showBottomPanel(name) {
  state.layout.bottomCollapsed = false;
  if (name === 'patch' && typeof ensurePatchPanelHeight === 'function') {
    ensurePatchPanelHeight();
  }
  applyLayoutCss();
  saveLayoutToStorage();
  $all('.panel-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.panel === name);
  });
  $all('.panel-view').forEach((view) => {
    view.classList.toggle('active', view.id === `panel-${name}`);
  });
  const toolbar = $('.panel-toolbar');
  if (toolbar) toolbar.classList.toggle('hidden', name !== 'terminal');
  setTimeout(() => {
    state.editor?.layout();
    state.diffEditor?.layout();
  }, 30);
}

window.showBottomPanel = showBottomPanel;
