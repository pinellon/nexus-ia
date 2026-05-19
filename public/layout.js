/* Resizable panels and collapse */
function applyLayoutCss() {
  const root = document.documentElement;
  const L = state.layout;
  root.style.setProperty("--sidebar-width", `${L.sidebarWidth}px`);
  root.style.setProperty("--ai-width", L.aiCollapsed ? "0px" : `${L.aiWidth}px`);
  root.style.setProperty("--bottom-height", L.bottomCollapsed ? "0px" : `${L.bottomHeight}px`);

  const shell = $(".ide-shell");
  if (!shell) return;
  shell.classList.toggle("ai-collapsed", L.aiCollapsed);
  shell.classList.toggle("bottom-collapsed", L.bottomCollapsed);
}

function initResize(handle, axis, onResize) {
  let start = 0;
  let startSize = 0;

  handle.addEventListener("mousedown", (event) => {
    event.preventDefault();
    handle.classList.add("dragging");
    start = axis === "x" ? event.clientX : event.clientY;
    startSize = onResize("start");

    const onMove = (moveEvent) => {
      const current = axis === "x" ? moveEvent.clientX : moveEvent.clientY;
      onResize("move", current - start, startSize);
      applyLayoutCss();
    };

    const onUp = () => {
      handle.classList.remove("dragging");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
}

function initLayout() {
  applyLayoutCss();

  const sidebarHandle = $('.resize-v[data-resize="sidebar"]');
  if (sidebarHandle) {
    initResize(sidebarHandle, "x", (phase, delta, startSize) => {
      if (phase === "start") return state.layout.sidebarWidth;
      state.layout.sidebarWidth = Math.min(480, Math.max(160, startSize + delta));
      return state.layout.sidebarWidth;
    });
  }

  const aiHandle = $('.resize-v[data-resize="ai"]');
  if (aiHandle) {
    initResize(aiHandle, "x", (phase, delta, startSize) => {
      if (phase === "start") return state.layout.aiWidth;
      state.layout.aiWidth = Math.min(600, Math.max(280, startSize - delta));
      return state.layout.aiWidth;
    });
  }

  const bottomHandle = $('.resize-h[data-resize="bottom"]');
  if (bottomHandle) {
    initResize(bottomHandle, "y", (phase, delta, startSize) => {
      if (phase === "start") return state.layout.bottomHeight;
      state.layout.bottomHeight = Math.min(500, Math.max(100, startSize - delta));
      state.layout.bottomCollapsed = false;
      return state.layout.bottomHeight;
    });
  }

  $("#btn-toggle-ai")?.addEventListener("click", () => {
    state.layout.aiCollapsed = !state.layout.aiCollapsed;
    applyLayoutCss();
    setTimeout(() => state.editor?.layout(), 50);
    setTimeout(() => state.diffEditor?.layout(), 50);
  });

  $("#btn-expand-ai")?.addEventListener("click", () => {
    state.layout.aiCollapsed = false;
    applyLayoutCss();
    setTimeout(() => state.editor?.layout(), 50);
  });

  $("#btn-toggle-bottom")?.addEventListener("click", () => {
    state.layout.bottomCollapsed = !state.layout.bottomCollapsed;
    applyLayoutCss();
    setTimeout(() => state.editor?.layout(), 50);
  });
}

function showBottomPanel(name) {
  state.layout.bottomCollapsed = false;
  applyLayoutCss();
  $all(".panel-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.panel === name);
  });
  $all(".panel-view").forEach((view) => {
    view.classList.toggle("active", view.id === `panel-${name}`);
  });
  setTimeout(() => {
    state.editor?.layout();
    state.diffEditor?.layout();
  }, 30);
}

window.showBottomPanel = showBottomPanel;
