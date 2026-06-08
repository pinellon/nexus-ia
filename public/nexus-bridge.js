let nexusAbortController = null;

function renderNexusResult(payload) {
  const output = $("#nexus-result");
  const statusLine = $("#nexus-status-line");
  if (!output || !statusLine) return;

  if (!payload) {
    output.textContent = "";
    statusLine.textContent = "";
    return;
  }

  const fields = [
    `status: ${payload.status || "unknown"}`,
    `provider: ${payload.provider_mode || "unavailable"}`,
    `origin: ${payload.final_origin || "unknown"}`,
    `auto_applied: ${payload.auto_applied === false ? "false" : "blocked"}`,
    `duration_ms: ${payload.duration_ms ?? 0}`
  ];
  statusLine.textContent = fields.join(" | ");
  output.textContent = JSON.stringify(
    {
      result: payload.result,
      metrics: payload.metrics || {},
      logs: payload.logs || [],
      errors: payload.errors || []
    },
    null,
    2
  );
}

async function loadNexusBridgeHealth() {
  const badge = $("#nexus-health-badge");
  if (!badge) return;
  try {
    const health = await api("/api/nexus/health");
    const online = health.python_available && health.nexusai_available;
    badge.className = `badge ${online ? "ok" : "warn"}`;
    badge.textContent = online ? "ready" : "limited";
  } catch {
    badge.className = "badge err";
    badge.textContent = "error";
  }
}

function buildNexusPayload() {
  const mode = $("#nexus-mode")?.value || "plan";
  return {
    mode,
    task: $("#nexus-task")?.value || "",
    suite: $("#nexus-suite")?.value || "smoke_25",
    root: ".",
    options: {
      maxTaskSeconds: 60,
      maxSuiteSeconds: 1200,
      modelTimeoutSeconds: 30,
      repairTimeoutSeconds: 20
    }
  };
}

async function runNexusBridge() {
  const runBtn = $("#nexus-run");
  const cancelBtn = $("#nexus-cancel");
  const statusLine = $("#nexus-status-line");
  if (!runBtn || !cancelBtn) return;

  nexusAbortController = new AbortController();
  runBtn.disabled = true;
  cancelBtn.disabled = false;
  if (statusLine) statusLine.textContent = "running...";
  renderNexusResult(null);

  try {
    const payload = buildNexusPayload();
    const response = await fetch("/api/nexus/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: nexusAbortController.signal
    });
    const body = await response.json().catch(() => ({
      ok: false,
      status: "error",
      errors: [response.statusText]
    }));
    renderNexusResult(body);
    setStatus(body.ok ? "Nexus Python finalizado" : "Nexus Python retornou erro");
  } catch (error) {
    const aborted = error?.name === "AbortError";
    renderNexusResult({
      ok: false,
      status: aborted ? "timeout" : "error",
      provider_mode: "unavailable",
      final_origin: null,
      auto_applied: false,
      duration_ms: 0,
      result: null,
      metrics: {},
      logs: [],
      errors: [aborted ? "Execucao cancelada pela UI" : String(error?.message || error)]
    });
  } finally {
    nexusAbortController = null;
    runBtn.disabled = false;
    cancelBtn.disabled = true;
  }
}

function initNexusBridgePanel() {
  const runBtn = $("#nexus-run");
  const cancelBtn = $("#nexus-cancel");
  const mode = $("#nexus-mode");
  const suite = $("#nexus-suite");
  const task = $("#nexus-task");
  if (!runBtn || !cancelBtn || !mode || !suite || !task) return;

  mode.addEventListener("change", () => {
    const isSuite = mode.value === "suite";
    suite.disabled = !isSuite;
    task.disabled = mode.value === "index" || isSuite;
  });
  runBtn.addEventListener("click", runNexusBridge);
  cancelBtn.addEventListener("click", () => {
    nexusAbortController?.abort();
  });
  mode.dispatchEvent(new Event("change"));
  loadNexusBridgeHealth();
}
