const autonomyState = {
  tasks: [],
  selectedTaskId: null,
  selectedTask: null,
  selectedStepId: null,
  audit: []
};

function autonomySetStatus(message) {
  const el = $("#autonomy-status");
  if (el) el.textContent = message;
  setStatus(message);
}

function autonomySetResult(payload) {
  const el = $("#autonomy-result");
  if (el) el.textContent = payload ? JSON.stringify(payload, null, 2) : "";
  const badge = $("#autonomy-auto-badge");
  if (badge) {
    badge.className = "badge ok";
    badge.textContent = "auto_applied:false";
  }
}

function unwrapAutonomyData(response) {
  return response?.data ?? response;
}

async function autonomyApi(path, options = {}) {
  const response = await api(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (response?.auto_applied !== false) {
    throw new Error("Resposta sem auto_applied:false");
  }
  return response;
}

function selectedAutonomyStep() {
  return (autonomyState.selectedTask?.steps || []).find((step) => step.step_id === autonomyState.selectedStepId) || null;
}

function canOperateOnStep() {
  return Boolean(autonomyState.selectedTaskId && autonomyState.selectedStepId);
}

function renderAutonomyTasks() {
  const list = $("#autonomy-task-list");
  if (!list) return;
  if (!autonomyState.tasks.length) {
    list.innerHTML = '<div class="autonomy-empty">Nenhuma task.</div>';
    return;
  }

  list.innerHTML = autonomyState.tasks.map((task) => `
    <button type="button" class="autonomy-task-row ${task.task_id === autonomyState.selectedTaskId ? "active" : ""}" data-task-id="${escapeHtml(task.task_id)}">
      <span class="autonomy-task-title">${escapeHtml(task.prompt || task.task_id)}</span>
      <span class="autonomy-pill">${escapeHtml(task.status || "unknown")}</span>
    </button>
  `).join("");

  $all(".autonomy-task-row").forEach((button) => {
    button.addEventListener("click", () => selectAutonomyTask(button.dataset.taskId));
  });
}

function renderAutonomyDetail() {
  const head = $("#autonomy-detail-head");
  const steps = $("#autonomy-step-list");
  const task = autonomyState.selectedTask;
  const currentStep = selectedAutonomyStep();
  $("#autonomy-approve")?.toggleAttribute("disabled", !canOperateOnStep());
  $("#autonomy-reject")?.toggleAttribute("disabled", !canOperateOnStep());
  $("#autonomy-request-changes")?.toggleAttribute("disabled", !canOperateOnStep());
  $("#autonomy-execute")?.toggleAttribute("disabled", !canOperateOnStep() || currentStep?.status !== "approved");
  $("#autonomy-cancel-task")?.toggleAttribute("disabled", !autonomyState.selectedTaskId);

  if (!head || !steps) return;
  if (!task) {
    head.textContent = "Nenhuma task selecionada";
    steps.innerHTML = "";
    return;
  }

  head.innerHTML = `
    <span>${escapeHtml(task.prompt || task.task_id)}</span>
    <span class="autonomy-pill">${escapeHtml(task.status || "unknown")}</span>
  `;
  steps.innerHTML = (task.steps || []).map((step) => `
    <button type="button" class="autonomy-step-row ${step.step_id === autonomyState.selectedStepId ? "active" : ""}" data-step-id="${escapeHtml(step.step_id)}">
      <span class="autonomy-step-main">
        <span>${escapeHtml(step.description)}</span>
        <small>${escapeHtml(step.action_type)} ${step.requires_approval ? "approval" : "read-only"}</small>
      </span>
      <span class="autonomy-pill">${escapeHtml(step.status)}</span>
    </button>
  `).join("");

  $all(".autonomy-step-row").forEach((button) => {
    button.addEventListener("click", () => {
      autonomyState.selectedStepId = button.dataset.stepId;
      renderAutonomyDetail();
    });
  });
}

function renderAutonomyAudit() {
  const el = $("#autonomy-audit");
  if (!el) return;
  if (!autonomyState.audit.length) {
    el.innerHTML = '<div class="autonomy-empty">Sem audit log.</div>';
    return;
  }
  el.innerHTML = autonomyState.audit.slice(-8).reverse().map((event) => `
    <div class="autonomy-audit-row">
      <span>${escapeHtml(event.event_type || event.action || "event")}</span>
      <small>${escapeHtml(event.timestamp || "")}</small>
    </div>
  `).join("");
}

async function loadAutonomyTasks() {
  try {
    const response = await autonomyApi("/api/nexus/autonomy/tasks");
    const data = unwrapAutonomyData(response);
    autonomyState.tasks = data?.tasks || [];
    if (!autonomyState.selectedTaskId && autonomyState.tasks.length) {
      autonomyState.selectedTaskId = autonomyState.tasks[0].task_id;
    }
    renderAutonomyTasks();
    if (autonomyState.selectedTaskId) {
      await selectAutonomyTask(autonomyState.selectedTaskId, { silent: true });
    }
    autonomySetStatus("Autonomia atualizada");
  } catch (error) {
    autonomySetStatus(error.message || "Falha ao listar tasks");
  }
}

async function selectAutonomyTask(taskId, options = {}) {
  if (!taskId) return;
  autonomyState.selectedTaskId = taskId;
  try {
    const response = await autonomyApi(`/api/nexus/autonomy/status/${encodeURIComponent(taskId)}`);
    autonomyState.selectedTask = unwrapAutonomyData(response);
    const steps = autonomyState.selectedTask?.steps || [];
    if (!steps.some((step) => step.step_id === autonomyState.selectedStepId)) {
      autonomyState.selectedStepId = steps.find((step) => step.mutable)?.step_id || steps[0]?.step_id || null;
    }
    await loadAutonomyAudit(taskId);
    renderAutonomyTasks();
    renderAutonomyDetail();
    if (!options.silent) autonomySetStatus("Task carregada");
  } catch (error) {
    autonomySetStatus(error.message || "Falha ao carregar task");
  }
}

async function loadAutonomyAudit(taskId = autonomyState.selectedTaskId) {
  if (!taskId) return;
  try {
    const response = await autonomyApi(`/api/nexus/autonomy/audit/${encodeURIComponent(taskId)}`);
    const data = unwrapAutonomyData(response);
    autonomyState.audit = data?.events || [];
    renderAutonomyAudit();
  } catch {
    autonomyState.audit = [];
    renderAutonomyAudit();
  }
}

async function createAutonomyPlanFromUi() {
  const task = $("#autonomy-task-input")?.value?.trim();
  if (!task) {
    autonomySetStatus("Task obrigatoria");
    return;
  }
  try {
    const response = await autonomyApi("/api/nexus/autonomy/plan", {
      method: "POST",
      body: JSON.stringify({ task, root: "." })
    });
    const data = unwrapAutonomyData(response);
    autonomySetResult(data);
    autonomyState.selectedTaskId = data.task_id;
    await loadAutonomyTasks();
  } catch (error) {
    autonomySetStatus(error.message || "Falha ao criar plano");
  }
}

async function postStepDecision(endpoint, reason = "") {
  if (!canOperateOnStep()) return;
  try {
    const response = await autonomyApi(`/api/nexus/autonomy/${endpoint}`, {
      method: "POST",
      body: JSON.stringify({
        task_id: autonomyState.selectedTaskId,
        step_id: autonomyState.selectedStepId,
        reason
      })
    });
    autonomySetResult(unwrapAutonomyData(response));
    await selectAutonomyTask(autonomyState.selectedTaskId);
  } catch (error) {
    autonomySetStatus(error.message || "Falha ao atualizar step");
  }
}

function buildExecutePayload() {
  const command = $("#autonomy-command-select")?.value || "";
  const payload = {
    task_id: autonomyState.selectedTaskId,
    step_id: autonomyState.selectedStepId,
    approved: true,
    root: ".",
    reason: "UI v0.3.3 explicit execution"
  };
  if (command) {
    payload.command = command;
    return payload;
  }
  const raw = $("#autonomy-changes-json")?.value || "";
  payload.changes = JSON.parse(raw);
  return payload;
}

async function executeAutonomyStepFromUi() {
  if (!canOperateOnStep()) return;
  try {
    const payload = buildExecutePayload();
    const response = await autonomyApi("/api/nexus/autonomy/execute", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    autonomySetResult(unwrapAutonomyData(response));
    await selectAutonomyTask(autonomyState.selectedTaskId);
  } catch (error) {
    autonomySetStatus(error.message || "Falha ao executar step");
  }
}

async function rollbackAutonomyFromUi() {
  try {
    const response = await autonomyApi("/api/nexus/autonomy/rollback", {
      method: "POST",
      body: JSON.stringify({ root: "." })
    });
    autonomySetResult(unwrapAutonomyData(response));
    if (autonomyState.selectedTaskId) await selectAutonomyTask(autonomyState.selectedTaskId);
  } catch (error) {
    autonomySetStatus(error.message || "Falha ao executar rollback");
  }
}

async function cancelAutonomyTaskFromUi() {
  if (!autonomyState.selectedTaskId) return;
  try {
    const response = await autonomyApi("/api/nexus/autonomy/cancel", {
      method: "POST",
      body: JSON.stringify({ task_id: autonomyState.selectedTaskId, reason: "UI cancel" })
    });
    autonomySetResult(unwrapAutonomyData(response));
    await selectAutonomyTask(autonomyState.selectedTaskId);
  } catch (error) {
    autonomySetStatus(error.message || "Falha ao cancelar task");
  }
}

function initAutonomyPanel() {
  if (!$("#autonomy-panel")) return;
  $("#autonomy-refresh")?.addEventListener("click", loadAutonomyTasks);
  $("#autonomy-plan")?.addEventListener("click", createAutonomyPlanFromUi);
  $("#autonomy-approve")?.addEventListener("click", () => postStepDecision("approve", "UI approval"));
  $("#autonomy-reject")?.addEventListener("click", () => postStepDecision("reject", "UI rejection"));
  $("#autonomy-request-changes")?.addEventListener("click", () => postStepDecision("request-changes", "UI requested changes"));
  $("#autonomy-execute")?.addEventListener("click", executeAutonomyStepFromUi);
  $("#autonomy-rollback")?.addEventListener("click", rollbackAutonomyFromUi);
  $("#autonomy-cancel-task")?.addEventListener("click", cancelAutonomyTaskFromUi);
  loadAutonomyTasks();
}
