/* Bottom panel: terminal, output, problems */
function logTerminal(msg) {
  const out = $("#terminal-output");
  if (!out) return;
  out.textContent += msg + "\n";
  out.scrollTop = out.scrollHeight;
  const output = $("#output-body");
  if (output) {
    output.textContent += msg + "\n";
    output.scrollTop = output.scrollHeight;
  }
}

function clearTerminal() {
  const out = $("#terminal-output");
  if (out) out.textContent = "";
  const output = $("#output-body");
  if (output) output.textContent = "";
}

function toggleBottomPanel() {
  state.layout.bottomCollapsed = !state.layout.bottomCollapsed;
  applyLayoutCss();
  setTimeout(() => state.editor?.layout(), 50);
}

function initTerminal() {
  $all(".panel-tab").forEach((tab) => {
    tab.addEventListener("click", () => showBottomPanel(tab.dataset.panel));
  });

  $("#status-terminal")?.addEventListener("click", toggleBottomPanel);
  $("#btn-clear-terminal")?.addEventListener("click", clearTerminal);

  window.toggleTerminal = () => {
    if (state.layout.bottomCollapsed) {
      showBottomPanel("terminal");
    } else {
      toggleBottomPanel();
    }
  };
  window.clearTerminal = clearTerminal;
  window.logTerminal = logTerminal;
}
