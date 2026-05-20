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

const COMMAND_LABELS = {
  build: "npm run build",
  typecheck: "npm run typecheck",
  test: "npm test"
};

function clearTerminal() {
  const out = $("#terminal-output");
  if (out) out.textContent = "";
  const output = $("#output-body");
  if (output) output.textContent = "";
}

function renderProblemsFromCommand(result) {
  const body = $("#problems-body");
  if (!body) return;
  if (!result || result.exit_code === 0 || result.exitCode === 0) {
    body.innerHTML = '<div class="empty-state">Nenhum problema reportado.</div>';
    return;
  }
  const command = result.command || "validacao";
  const output = [result.stderr, result.stdout].filter(Boolean).join("\n").slice(0, 6000);
  body.innerHTML = `
    <div class="problem-card">
      <div class="problem-title">Falha em ${escapeHtml(command)}</div>
      <div class="problem-meta">Exit code: ${escapeHtml(result.exit_code ?? result.exitCode ?? "-")}</div>
      <pre>${escapeHtml(output || "Sem output.")}</pre>
      <button type="button" class="btn-primary btn-sm" id="btn-fix-last-command">Corrigir com Nexus</button>
    </div>
  `;
  $("#btn-fix-last-command")?.addEventListener("click", () => fixLastCommandWithNexus());
}

async function runDevCommand(commandId) {
  const command = COMMAND_LABELS[commandId] || commandId;
  showBottomPanel("terminal");
  logTerminal(`>> ${command}`);
  setStatus(`Executando ${command}...`);
  try {
    const res = await api("/api/tests/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command })
    });
    const result = res.data || res;
    state.lastCommandResult = result;
    logTerminal(result.stdout || "");
    logTerminal(result.stderr || "");
    if (result.exit_code !== 0) {
      logTerminal(`>> Falhou com exit code ${result.exit_code}`);
      setStatus(`${command} falhou. Use Corrigir com Nexus.`);
      renderProblemsFromCommand(result);
      showBottomPanel("problems");
    } else {
      logTerminal(">> Sucesso!");
      setStatus(`${command} concluido com sucesso.`);
      renderProblemsFromCommand(result);
    }
    return result;
  } catch (error) {
    const failed = {
      command,
      exit_code: 1,
      stdout: "",
      stderr: error.message || String(error)
    };
    state.lastCommandResult = failed;
    logTerminal("Erro: " + failed.stderr);
    renderProblemsFromCommand(failed);
    showBottomPanel("problems");
    return failed;
  }
}

async function fixLastCommandWithNexus(extraPrompt) {
  const result = state.lastCommandResult;
  if (!result) {
    setStatus("Nenhum erro recente para corrigir.");
    return;
  }

  const activeFile = window.NexusIDE?.getActiveFile?.();
  try {
    const res = await api("/api/dev/fix-command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: result.command,
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exit_code,
        active_file: activeFile?.path || "",
        context: [extraPrompt || "", typeof buildIDEContext === "function" ? buildIDEContext() : ""].filter(Boolean).join("\n\n")
      })
    });
    setStatus("Debug Agent iniciado para corrigir o erro.");
    showBottomPanel("output");
    if (res.run_id && typeof startAgentProgress === "function") {
      startAgentProgress(res.run_id);
    }
  } catch (error) {
    setStatus("Falha ao iniciar Debug Agent: " + error.message);
  }
}

function toggleBottomPanel() {
  state.layout.bottomCollapsed = !state.layout.bottomCollapsed;
  applyLayoutCss();
  if (typeof saveLayoutToStorage === "function") saveLayoutToStorage();
  setTimeout(() => state.editor?.layout(), 50);
}

function initTerminal() {
  $all(".panel-tab").forEach((tab) => {
    tab.addEventListener("click", () => showBottomPanel(tab.dataset.panel));
  });

  $("#status-terminal")?.addEventListener("click", toggleBottomPanel);
  $("#btn-clear-terminal")?.addEventListener("click", clearTerminal);
  $("#btn-run-typecheck")?.addEventListener("click", () => runDevCommand("typecheck"));
  $("#btn-run-build")?.addEventListener("click", () => runDevCommand("build"));

  window.toggleTerminal = () => {
    if (state.layout.bottomCollapsed) {
      showBottomPanel("terminal");
    } else {
      toggleBottomPanel();
    }
  };
  window.clearTerminal = clearTerminal;
  window.logTerminal = logTerminal;
  window.runDevCommand = runDevCommand;
  window.fixLastCommandWithNexus = fixLastCommandWithNexus;
}
