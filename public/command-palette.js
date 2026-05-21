/* Command Palette */
const COMMAND_PALETTE_ACTIONS = [
  { id: "save", label: "Salvar arquivo ativo", hint: "Ctrl+S", run: () => saveActiveFile() },
  { id: "terminal", label: "Abrir Terminal", hint: "Ctrl+`", run: () => showBottomPanel("terminal") },
  { id: "build", label: "Rodar build", hint: "npm run build", run: () => runDevCommand("build") },
  { id: "typecheck", label: "Rodar typecheck", hint: "npm run typecheck", run: () => runDevCommand("typecheck") },
  { id: "test", label: "Rodar testes", hint: "npm test", run: () => runDevCommand("test") },
  { id: "git-status", label: "Git: status", hint: "git status", run: () => runDevCommand("git-status") },
  { id: "git-diff", label: "Git: diff", hint: "git diff", run: () => runDevCommand("git-diff") },
  { id: "fix", label: "Corrigir ultimo erro com Nexus", hint: "Debug Agent", run: () => fixLastCommandWithNexus() },
  { id: "patches", label: "Abrir Patch Review", hint: "Patches", run: () => openPatchesPanel?.({ viewDiff: true }) },
  { id: "explorer", label: "Mostrar Explorer", hint: "Arquivos", run: () => activateSideView("explorer") },
  { id: "search", label: "Mostrar Busca", hint: "Arquivos", run: () => activateSideView("search") },
  { id: "git", label: "Mostrar Git", hint: "Controle de versao", run: () => activateSideView("git") },
  { id: "settings", label: "Mostrar Configuracoes", hint: "IA", run: () => activateSideView("settings") },
  { id: "chat", label: "Focar Nexus AI", hint: "Chat", run: () => $("#dm-input")?.focus() },
  { id: "clear-terminal", label: "Limpar terminal", hint: "Output", run: () => clearTerminal() }
];

function commandPaletteElements() {
  return {
    overlay: $("#command-palette-overlay"),
    input: $("#command-palette-input"),
    list: $("#command-palette-list")
  };
}

function commandPaletteMatches(action, query) {
  if (!query) return true;
  const haystack = `${action.label} ${action.hint} ${action.id}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).every((part) => haystack.includes(part));
}

function renderCommandPalette() {
  const { input, list } = commandPaletteElements();
  if (!list) return;
  const query = input?.value?.trim() || "";
  const actions = COMMAND_PALETTE_ACTIONS.filter((action) => commandPaletteMatches(action, query)).slice(0, 12);
  list.innerHTML = actions.length
    ? actions
        .map(
          (action, index) => `
            <button type="button" class="command-palette-row ${index === 0 ? "active" : ""}" data-command-id="${escapeHtml(action.id)}">
              <span>${escapeHtml(action.label)}</span>
              <small>${escapeHtml(action.hint || "")}</small>
            </button>
          `
        )
        .join("")
    : '<div class="command-palette-empty">Nenhum comando encontrado.</div>';
  list.querySelectorAll("[data-command-id]").forEach((row) => {
    row.addEventListener("click", () => runCommandPaletteAction(row.dataset.commandId));
  });
}

function openCommandPalette() {
  const { overlay, input } = commandPaletteElements();
  if (!overlay || !input) return;
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  input.value = "";
  renderCommandPalette();
  setTimeout(() => input.focus(), 0);
}

function closeCommandPalette() {
  const { overlay } = commandPaletteElements();
  if (!overlay) return;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
}

function runCommandPaletteAction(commandId) {
  const action = COMMAND_PALETTE_ACTIONS.find((item) => item.id === commandId);
  if (!action) return;
  closeCommandPalette();
  action.run();
}

function selectCommandPaletteRow(direction) {
  const rows = $all(".command-palette-row");
  if (!rows.length) return;
  const current = rows.findIndex((row) => row.classList.contains("active"));
  const next = (current + direction + rows.length) % rows.length;
  rows.forEach((row, index) => row.classList.toggle("active", index === next));
  rows[next]?.scrollIntoView({ block: "nearest" });
}

function initCommandPalette() {
  const { overlay, input } = commandPaletteElements();
  if (!overlay || !input) return;
  input.addEventListener("input", renderCommandPalette);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeCommandPalette();
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectCommandPaletteRow(1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectCommandPaletteRow(-1);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const active = $(".command-palette-row.active") || $(".command-palette-row");
      if (active) runCommandPaletteAction(active.dataset.commandId);
    }
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeCommandPalette();
  });
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "p") {
      event.preventDefault();
      openCommandPalette();
    }
  });
  window.openCommandPalette = openCommandPalette;
  window.closeCommandPalette = closeCommandPalette;
}
