/* Bottom panel: terminal, output, problems */
function logTerminal(msg) {
  const out = $('#terminal-output');
  if (!out) return;
  out.textContent += msg + '\n';
  out.scrollTop = out.scrollHeight;
  const output = $('#output-body');
  if (output) {
    output.textContent += msg + '\n';
    output.scrollTop = output.scrollHeight;
  }
}

const COMMAND_LABELS = {
  build: 'npm run build',
  typecheck: 'npm run typecheck',
  test: 'npm test',
  'git-status': 'git status',
  'git-diff': 'git diff',
  'node-version': 'node --version',
  'npm-version': 'npm --version',
};

const TERMINAL_HISTORY_KEY = 'nexus-terminal-history';

function loadTerminalHistory() {
  try {
    return JSON.parse(localStorage.getItem(TERMINAL_HISTORY_KEY) || '[]')
      .filter(Boolean)
      .slice(-30);
  } catch {
    return [];
  }
}

function saveTerminalHistory(history) {
  localStorage.setItem(TERMINAL_HISTORY_KEY, JSON.stringify(history.slice(-30)));
}

function normalizeCommandResult(result, fallbackCommand) {
  return {
    command: result.command || fallbackCommand,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exit_code: result.exit_code ?? result.exitCode ?? 1,
    duration_ms: result.duration_ms ?? result.durationMs ?? 0,
    created_at: result.created_at || new Date().toISOString(),
  };
}

function setTerminalRunning(running) {
  const input = $('#terminal-command-input');
  const run = $('#btn-terminal-run');
  if (input) input.disabled = running;
  if (run) {
    run.disabled = running;
    run.textContent = running ? 'Executando...' : 'Executar';
  }
}

function clearTerminal() {
  const out = $('#terminal-output');
  if (out) out.textContent = '';
  const output = $('#output-body');
  if (output) output.textContent = '';
}

function parseProblemsFromCommand(result) {
  const text = [result.stderr, result.stdout].filter(Boolean).join('\n');
  const problems = [];
  const patterns = [
    /(?:^|\n)([A-Za-z0-9_./\\-]+\.(?:ts|tsx|js|jsx|json|css|html|md|py))\((\d+),(\d+)\):\s*(error|warning)?\s*([^:\n]*)?:?\s*([^\n]*)/g,
    /(?:^|\n)([A-Za-z0-9_./\\-]+\.(?:ts|tsx|js|jsx|json|css|html|md|py)):(\d+):(\d+)[:\s]+([^\n]*)/g,
    /(?:^|\n)([A-Za-z0-9_./\\-]+\.(?:ts|tsx|js|jsx|json|css|html|md|py)):(\d+)[:\s]+([^\n]*)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) {
      const hasColumn = match.length >= 6;
      const filePath = String(match[1] || '')
        .replace(/\\/g, '/')
        .replace(/^\.?\//, '');
      const line = Number(match[2] || 1);
      const column = hasColumn ? Number(match[3] || 1) : 1;
      const message = (hasColumn ? [match[4], match[5], match[6]] : [match[3]])
        .filter(Boolean)
        .join(' ')
        .trim();
      if (
        !problems.some(
          (item) => item.filePath === filePath && item.line === line && item.column === column,
        )
      ) {
        problems.push({
          filePath,
          line,
          column,
          message: message || 'Problema detectado pelo comando',
          severity: /warn/i.test(message) ? 'warning' : 'error',
        });
      }
    }
  }

  return problems.slice(0, 50);
}

function renderProblemsFromCommand(result) {
  const body = $('#problems-body');
  if (!body) return;
  if (!result || result.exit_code === 0 || result.exitCode === 0) {
    body.innerHTML = '<div class="empty-state">Nenhum problema reportado.</div>';
    return;
  }
  const command = result.command || 'validacao';
  const output = [result.stderr, result.stdout].filter(Boolean).join('\n').slice(0, 6000);
  const problems = parseProblemsFromCommand(result);
  body.innerHTML = `
    <div class="problem-card">
      <div class="problem-title">Falha em ${escapeHtml(command)}</div>
      <div class="problem-meta">Exit code: ${escapeHtml(result.exit_code ?? result.exitCode ?? '-')}</div>
      ${
        problems.length
          ? `<div class="problem-list">
              ${problems
                .map(
                  (problem, index) => `
                    <button type="button" class="problem-row ${problem.severity}" data-problem-index="${index}">
                      <span class="problem-file">${escapeHtml(problem.filePath)}:${problem.line}:${problem.column}</span>
                      <span class="problem-message">${escapeHtml(problem.message)}</span>
                    </button>
                  `,
                )
                .join('')}
            </div>`
          : ''
      }
      <pre>${escapeHtml(output || 'Sem output.')}</pre>
      <button type="button" class="btn-primary btn-sm" id="btn-fix-last-command">Corrigir com Nexus</button>
    </div>
  `;
  state.lastProblems = problems;
  body.querySelectorAll('[data-problem-index]').forEach((row) => {
    row.addEventListener('click', () => {
      const problem = problems[Number(row.dataset.problemIndex)];
      if (!problem) return;
      openFile(problem.filePath, null, { line: problem.line, column: problem.column });
    });
  });
  $('#btn-fix-last-command')?.addEventListener('click', () => fixLastCommandWithNexus());
}

async function runDevCommand(commandIdOrCommand) {
  const command = COMMAND_LABELS[commandIdOrCommand] || commandIdOrCommand;
  showBottomPanel('terminal');
  setTerminalRunning(true);
  logTerminal(`>> ${command}`);
  setStatus(`Executando ${command}...`);
  try {
    const res = await api('/api/tests/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    const result = normalizeCommandResult(res.data || res, command);
    state.lastCommandResult = result;
    logTerminal(result.stdout || '');
    logTerminal(result.stderr || '');
    if (result.exit_code !== 0) {
      logTerminal(`>> Falhou com exit code ${result.exit_code}`);
      setStatus(`${command} falhou. Use Corrigir com Nexus.`);
      renderProblemsFromCommand(result);
      showBottomPanel('problems');
    } else {
      logTerminal('>> Sucesso!');
      setStatus(`${command} concluido com sucesso.`);
      renderProblemsFromCommand(result);
    }
    return result;
  } catch (error) {
    const failed = {
      command,
      exit_code: 1,
      stdout: '',
      stderr: error.message || String(error),
    };
    state.lastCommandResult = failed;
    logTerminal('Erro: ' + failed.stderr);
    renderProblemsFromCommand(failed);
    showBottomPanel('problems');
    return failed;
  } finally {
    setTerminalRunning(false);
    const input = $('#terminal-command-input');
    if (input) input.focus();
  }
}

async function fixLastCommandWithNexus(extraPrompt) {
  const result = state.lastCommandResult;
  if (!result) {
    setStatus('Nenhum erro recente para corrigir.');
    return;
  }

  const activeFile = window.NexusIDE?.getActiveFile?.();
  try {
    const res = await api('/api/dev/fix-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: result.command,
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exit_code,
        active_file: activeFile?.path || '',
        context: [extraPrompt || '', typeof buildIDEContext === 'function' ? buildIDEContext() : '']
          .filter(Boolean)
          .join('\n\n'),
      }),
    });
    setStatus('Debug Agent iniciado para corrigir o erro.');
    showBottomPanel('output');
    if (res.run_id && typeof startAgentProgress === 'function') {
      startAgentProgress(res.run_id);
    }
  } catch (error) {
    setStatus('Falha ao iniciar Debug Agent: ' + error.message);
  }
}

function toggleBottomPanel() {
  state.layout.bottomCollapsed = !state.layout.bottomCollapsed;
  applyLayoutCss();
  if (typeof saveLayoutToStorage === 'function') saveLayoutToStorage();
  setTimeout(() => state.editor?.layout(), 50);
}

function initTerminal() {
  state.terminalHistory = loadTerminalHistory();
  state.terminalHistoryIndex = state.terminalHistory.length;

  $all('.panel-tab').forEach((tab) => {
    tab.addEventListener('click', () => showBottomPanel(tab.dataset.panel));
  });

  $('#status-terminal')?.addEventListener('click', toggleBottomPanel);
  $('#btn-clear-terminal')?.addEventListener('click', clearTerminal);
  $('#btn-run-typecheck')?.addEventListener('click', () => runDevCommand('typecheck'));
  $('#btn-run-build')?.addEventListener('click', () => runDevCommand('build'));
  $('#btn-run-test')?.addEventListener('click', () => runDevCommand('test'));
  $('#btn-run-git-status')?.addEventListener('click', () => runDevCommand('git-status'));
  $('#btn-run-git-diff')?.addEventListener('click', () => runDevCommand('git-diff'));

  $('#terminal-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $('#terminal-command-input');
    const command = input?.value?.trim();
    if (!command) return;
    state.terminalHistory = [
      ...(state.terminalHistory || []).filter((item) => item !== command),
      command,
    ].slice(-30);
    state.terminalHistoryIndex = state.terminalHistory.length;
    saveTerminalHistory(state.terminalHistory);
    input.value = '';
    runDevCommand(command);
  });

  $('#terminal-command-input')?.addEventListener('keydown', (event) => {
    if (!state.terminalHistory?.length) return;
    const input = event.currentTarget;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      state.terminalHistoryIndex = Math.max(
        0,
        (state.terminalHistoryIndex ?? state.terminalHistory.length) - 1,
      );
      input.value = state.terminalHistory[state.terminalHistoryIndex] || '';
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      state.terminalHistoryIndex = Math.min(
        state.terminalHistory.length,
        (state.terminalHistoryIndex ?? state.terminalHistory.length) + 1,
      );
      input.value = state.terminalHistory[state.terminalHistoryIndex] || '';
    }
  });

  window.toggleTerminal = () => {
    if (state.layout.bottomCollapsed) {
      showBottomPanel('terminal');
    } else {
      toggleBottomPanel();
    }
  };
  window.clearTerminal = clearTerminal;
  window.logTerminal = logTerminal;
  window.runDevCommand = runDevCommand;
  window.fixLastCommandWithNexus = fixLastCommandWithNexus;
}
