import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { registerAgentRoutes } from "./app/web/server.js";
import { selectOrchestrationMode } from "./orchestration-mode.js";
import { getProviderStatus, loadAISettings, maskApiKey, saveAISettings } from "./app/ai/ai-settings.js";
import { applyAction } from "./action-executor.js";
import { extractProposedActions } from "./action-planner.js";
import type { ActionRecord } from "./action-types.js";
import { listAllowedCommands, resolveAllowedCommand, runCommand, type AllowedCommandId } from "./command-runner.js";
import { classifyIntent } from "./intent-classifier.js";
import { getAgentStatus, orchestrate, type AgentName } from "./nexus-orchestrator.js";
import {
  approveAction,
  getPendingAction,
  listPendingActions,
  rejectAction
} from "./pending-actions-store.js";
import {
  createGitCommit,
  generateCommitMessage,
  getGitDiff,
  getGitStatus,
  readProjectSnapshot,
  scanProject
} from "./project-inspector.js";
import {
  createProjectFolder,
  deleteProjectFile,
  deleteProjectFolder,
  listProjectFiles,
  listProjectTree,
  projectFileExists,
  readProjectFile,
  renameProjectPath,
  writeProjectFile
} from "./project-file-store.js";
import { readLastCommandResult, saveLastCommandResult } from "./project-runtime-store.js";
import {
  fetchUrl,
  githubRepoSearch,
  githubSearch,
  webSearch
} from "./research-tools.js";
import {
  appendMessage,
  createSession,
  deleteSession,
  getRecentHistory,
  getSession,
  listSessions
} from "./session-store.js";
import {
  createFile,
  deleteFile,
  ensureWorkspace,
  getWorkspaceRoot,
  listFiles,
  readFile,
  writeFile
} from "./workspace-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");
const projectRoot = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4000);
const MAX_PROMPT_LENGTH = 12_000;

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDir));

function buildHistoryContext(messages: Awaited<ReturnType<typeof getRecentHistory>>) {
  if (!messages.length) {
    return "";
  }

  return messages
    .map((message) => `[${message.role.toUpperCase()}${message.intent ? ` | ${message.intent}` : ""}] ${message.content}`)
    .join("\n");
}

function formatActionForHistory(action: ActionRecord) {
  switch (action.type) {
    case "run_command":
      return `${action.type}: ${action.command}`;
    case "install_package":
      return `${action.type}: ${action.packageManager} ${action.dev ? "--save-dev " : ""}${action.packages.join(" ")}`.trim();
    default:
      return `${action.type}: ${action.path}`;
  }
}

async function writeActionHistory(sessionId: string, title: string, action: ActionRecord, extra?: string) {
  try {
    await appendMessage(sessionId, {
      role: "system",
      content: [title, formatActionForHistory(action), action.reason, extra].filter(Boolean).join("\n"),
      intent: "general"
    });
  } catch (error) {
    console.warn("[actions:history]", error instanceof Error ? error.message : "Historico de acao indisponivel");
  }
}

async function handleOrchestrate(input: {
  sessionId: string;
  prompt: string;
  context?: string;
  language?: string;
  agents?: AgentName[];
}) {
  const intent = classifyIntent(input.prompt);

  await appendMessage(input.sessionId, {
    role: "user",
    content: input.prompt,
    intent
  });

  const recentHistory = await getRecentHistory(input.sessionId, 8);
  const historyContext = buildHistoryContext(recentHistory.slice(0, -1));
  const composedContext = [
    input.context?.trim() ? `Contexto explicito do usuario:\n${input.context.trim()}` : "",
    historyContext ? `Historico recente da sessao:\n${historyContext}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await orchestrate({
    sessionId: input.sessionId,
    prompt: input.prompt,
    context: composedContext,
    language: input.language?.trim(),
    agents: input.agents
  });

  const proposedActions = await extractProposedActions({
    sessionId: input.sessionId,
    merged: result.merged,
    synthesisActions: result.synthesis.actions as never[],
    agentContents: result.proposals.map((agent) => ({
      agent: agent.agent,
      content: agent.content
    }))
  });

  await appendMessage(input.sessionId, {
    role: "assistant",
    content: result.merged,
    intent,
    agents: result.agents.map((agent) => ({
      agent: agent.agent,
      ok: agent.ok,
      latency: agent.latency,
      mode: agent.mode,
      error: agent.error
    }))
  });

  const session = await getSession(input.sessionId);
  if (!session) {
    throw new Error("Sessao nao encontrada apos a orquestracao");
  }

  return {
    sessionId: input.sessionId,
    session,
    proposedActions,
    ...result
  };
}

function parsePromptBody(req: express.Request) {
  return req.body as {
    prompt?: string;
    context?: string;
    language?: string;
    agents?: AgentName[];
  };
}

function isPatchAction(action: ActionRecord) {
  return action.type === "create_file" || action.type === "write_file" || action.type === "patch_file" || action.type === "delete_file";
}

function buildUnifiedDiff(action: ActionRecord) {
  switch (action.type) {
    case "patch_file":
      return [
        `--- a/${action.path}`,
        `+++ b/${action.path}`,
        "@@ before",
        ...action.before.split(/\r?\n/).map((line) => `-${line}`),
        "@@ after",
        ...action.after.split(/\r?\n/).map((line) => `+${line}`)
      ].join("\n");
    case "create_file":
    case "write_file":
      return [
        `--- a/${action.path}`,
        `+++ b/${action.path}`,
        "@@ content",
        ...action.content.split(/\r?\n/).map((line) => `+${line}`)
      ].join("\n");
    case "delete_file":
      return [
        `--- a/${action.path}`,
        "+++ /dev/null",
        "@@ delete",
        `- delete ${action.path}`
      ].join("\n");
    default:
      return "";
  }
}

function buildPatchPayload(action: ActionRecord) {
  const filesChanged = "path" in action ? [action.path] : [];
  return {
    id: action.id,
    run_id: action.sessionId,
    agent_id: action.sourceAgent || "unknown",
    goal: action.goal || "",
    files_changed: filesChanged,
    risk: action.riskLevel,
    status: action.status,
    summary: action.reason,
    created_at: action.createdAt,
    updated_at: action.updatedAt,
    diff: buildUnifiedDiff(action),
    before: action.type === "patch_file" ? action.before : "",
    after: action.type === "patch_file" ? action.after : "content" in action ? action.content : "",
    action
  };
}

async function executeProjectCommand(commandLike: string, root = projectRoot) {
  const resolved = resolveAllowedCommand(commandLike);
  if (!resolved) {
    throw new Error("Comando nao permitido");
  }

  const result = await runCommand(resolved.id, root);
  return saveLastCommandResult(root, {
    ok: result.exitCode === 0,
    command: result.command,
    exit_code: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    duration_ms: result.durationMs
  });
}

app.get("/api/health", async (_req, res) => {
  const project = readProjectSnapshot(".");
  res.json({
    ok: true,
    mode: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY ? "live-ready" : "mock-ready",
    agents: getAgentStatus(),
    allowedCommands: listAllowedCommands(),
    workspaceRoot: getWorkspaceRoot(),
    projectRoot,
    project,
    lastTestResult: await readLastCommandResult(".")
  });
});

registerAgentRoutes(app);

app.get("/api/project", async (_req, res) => {
  try {
    return res.json({
      ok: true,
      data: {
        ...(readProjectSnapshot(".")),
        last_test_result: await readLastCommandResult(".")
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao carregar projeto"
    });
  }
});

app.get("/api/project/scan", async (_req, res) => {
  try {
    return res.json({
      ok: true,
      data: {
        ...(await scanProject(".")),
        last_test_result: await readLastCommandResult(".")
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao analisar projeto"
    });
  }
});

app.get("/api/project/files", async (req, res) => {
  const targetRoot = String(req.query.projectRoot ?? ".");

  try {
    return res.json({
      ok: true,
      files: await listProjectFiles(targetRoot)
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao listar arquivos do projeto"
    });
  }
});

app.get("/api/project/tree", async (req, res) => {
  const targetRoot = String(req.query.projectRoot ?? ".");

  try {
    const tree = await listProjectTree(targetRoot);
    return res.json({
      ok: true,
      tree,
      data: tree
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao listar arvore do projeto"
    });
  }
});

app.get("/api/project/file", async (req, res) => {
  const targetRoot = String(req.query.projectRoot ?? ".");
  const targetPath = String(req.query.path ?? req.query.filePath ?? "");
  if (!targetPath.trim()) {
    return res.status(400).json({ ok: false, error: "path e obrigatorio" });
  }

  try {
    const file = await readProjectFile(targetRoot, targetPath);
    return res.json({
      ok: true,
      data: file,
      path: file.path,
      content: file.content
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao ler arquivo do projeto"
    });
  }
});

app.post("/api/project/file", async (req, res) => {
  const {
    projectRoot: targetRoot = ".",
    path: targetPath,
    content = ""
  } = req.body as { projectRoot?: string; path?: string; content?: string };
  if (!targetPath?.trim()) {
    return res.status(400).json({ ok: false, error: "path e obrigatorio" });
  }

  try {
    if (await projectFileExists(targetRoot, targetPath)) {
      return res.status(409).json({ ok: false, error: "Arquivo ja existe" });
    }
    const file = await writeProjectFile(targetRoot, targetPath, content);
    return res.status(201).json({
      ok: true,
      data: file,
      path: file.path,
      content: file.content
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao criar arquivo do projeto"
    });
  }
});

app.put("/api/project/file", async (req, res) => {
  const {
    projectRoot: targetRoot = ".",
    path: targetPath,
    content = ""
  } = req.body as { projectRoot?: string; path?: string; content?: string };
  if (!targetPath?.trim()) {
    return res.status(400).json({ ok: false, error: "path e obrigatorio" });
  }

  try {
    const file = await writeProjectFile(targetRoot, targetPath, content);
    return res.json({
      ok: true,
      data: file,
      path: file.path,
      content: file.content
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao salvar arquivo do projeto"
    });
  }
});

app.delete("/api/project/file", async (req, res) => {
  const targetRoot = String(req.query.projectRoot ?? ".");
  const targetPath = String(req.query.path ?? req.query.filePath ?? "");
  if (!targetPath.trim()) {
    return res.status(400).json({ ok: false, error: "path e obrigatorio" });
  }

  try {
    return res.json({
      ok: true,
      data: await deleteProjectFile(targetRoot, targetPath)
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao remover arquivo do projeto"
    });
  }
});

app.post("/api/project/folder", async (req, res) => {
  const {
    projectRoot: targetRoot = ".",
    path: targetPath
  } = req.body as { projectRoot?: string; path?: string };
  if (!targetPath?.trim()) {
    return res.status(400).json({ ok: false, error: "path e obrigatorio" });
  }

  try {
    return res.status(201).json({
      ok: true,
      data: await createProjectFolder(targetRoot, targetPath)
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao criar pasta do projeto"
    });
  }
});

app.put("/api/project/rename", async (req, res) => {
  const {
    projectRoot: targetRoot = ".",
    oldPath,
    newPath
  } = req.body as { projectRoot?: string; oldPath?: string; newPath?: string };
  if (!oldPath?.trim() || !newPath?.trim()) {
    return res.status(400).json({ ok: false, error: "oldPath e newPath sao obrigatorios" });
  }

  try {
    return res.json({
      ok: true,
      data: await renameProjectPath(targetRoot, oldPath, newPath)
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao renomear caminho do projeto"
    });
  }
});

app.delete("/api/project/folder", async (req, res) => {
  const targetRoot = String(req.query.projectRoot ?? ".");
  const targetPath = String(req.query.path ?? "");
  if (!targetPath.trim()) {
    return res.status(400).json({ ok: false, error: "path e obrigatorio" });
  }

  try {
    return res.json({
      ok: true,
      data: await deleteProjectFolder(targetRoot, targetPath)
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao remover pasta do projeto"
    });
  }
});

app.get("/api/project/git/status", (_req, res) => {
  try {
    return res.json({
      ok: true,
      data: getGitStatus(".")
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao carregar Git status"
    });
  }
});

app.post("/api/project/run-command", async (req, res) => {
  try {
    const { command, commandId } = req.body as { command?: string; commandId?: string };
    const result = await executeProjectCommand(command || commandId || "", projectRoot);
    return res.json({ ok: true, data: result });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao executar comando do projeto"
    });
  }
});

app.get("/api/sessions", async (_req, res) => {
  try {
    res.json({ sessions: await listSessions() });
  } catch (error) {
    console.error("[sessions:list]", error);
    res.status(500).json({ error: "Falha ao listar sessoes" });
  }
});

app.post("/api/sessions", async (req, res) => {
  try {
    const session = await createSession((req.body as { title?: string }).title);
    res.status(201).json({ session });
  } catch (error) {
    console.error("[sessions:create]", error);
    res.status(500).json({ error: "Falha ao criar sessao" });
  }
});

app.get("/api/sessions/:id", async (req, res) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Sessao nao encontrada" });
    }

    return res.json({ session });
  } catch (error) {
    console.error("[sessions:get]", error);
    return res.status(500).json({ error: "Falha ao carregar sessao" });
  }
});

app.delete("/api/sessions/:id", async (req, res) => {
  try {
    const deleted = await deleteSession(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Sessao nao encontrada" });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("[sessions:delete]", error);
    return res.status(500).json({ error: "Falha ao remover sessao" });
  }
});

app.post("/api/sessions/:id/orchestrate", async (req, res) => {
  const { prompt, context, language, agents } = parsePromptBody(req);

  if (!prompt?.trim()) {
    return res.status(400).json({ error: "prompt e obrigatorio" });
  }

  if (prompt.trim().length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ error: `prompt excede o limite de ${MAX_PROMPT_LENGTH} caracteres` });
  }

  try {
    const session = await getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Sessao nao encontrada" });
    }

    return res.json(
      await handleOrchestrate({
        sessionId: session.id,
        prompt: prompt.trim(),
        context,
        language,
        agents: Array.isArray(agents) ? agents : undefined
      })
    );
  } catch (error) {
    console.error("[sessions:orchestrate]", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Falha interna no orquestrador"
    });
  }
});

app.post("/api/orchestrate", async (req, res) => {
  const { prompt, context, language, agents } = parsePromptBody(req);
  const sessionId = (req.body as { sessionId?: string }).sessionId;

  if (!prompt?.trim()) {
    return res.status(400).json({ error: "prompt e obrigatorio" });
  }

  if (prompt.trim().length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ error: `prompt excede o limite de ${MAX_PROMPT_LENGTH} caracteres` });
  }

  try {
    const session = sessionId ? await getSession(sessionId) : await createSession(prompt.trim());
    if (!session) {
      return res.status(404).json({ error: "Sessao nao encontrada" });
    }

    return res.json(
      await handleOrchestrate({
        sessionId: session.id,
        prompt: prompt.trim(),
        context,
        language,
        agents: Array.isArray(agents) ? agents : undefined
      })
    );
  } catch (error) {
    console.error("[orchestrate]", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Falha interna no orquestrador"
    });
  }
});

app.get("/api/sessions/:id/actions", async (req, res) => {
  try {
    res.json({ actions: await listPendingActions(req.params.id) });
  } catch (error) {
    console.error("[actions:list-session]", error);
    res.status(500).json({ error: "Falha ao listar acoes da sessao" });
  }
});

app.post("/api/sessions/:id/actions/plan", async (req, res) => {
  const { merged, agentResults, synthesisActions } = req.body as {
    merged?: string;
    synthesisActions?: unknown[];
    agentResults?: Array<{ agent?: string; content?: string }>;
  };

  if (!merged && !Array.isArray(synthesisActions)) {
    return res.status(400).json({ error: "merged ou synthesisActions e obrigatorio" });
  }

  try {
    const session = await getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Sessao nao encontrada" });
    }

    const actions = await extractProposedActions({
      sessionId: session.id,
      merged,
      synthesisActions: Array.isArray(synthesisActions) ? (synthesisActions as never[]) : undefined,
      agentContents: Array.isArray(agentResults)
        ? agentResults
            .filter((item) => typeof item?.content === "string")
            .map((item) => ({ agent: item.agent || "unknown", content: item.content as string }))
        : undefined
    });

    return res.json({ actions });
  } catch (error) {
    console.error("[actions:plan-session]", error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Falha ao planejar acoes"
    });
  }
});

app.post("/api/actions/:id/approve", async (req, res) => {
  try {
    const action = await approveAction(req.params.id);
    if (!action) {
      return res.status(404).json({ error: "Acao nao encontrada" });
    }

    await writeActionHistory(action.sessionId, "Acao aprovada pelo usuario", action);
    return res.json({ action });
  } catch (error) {
    console.error("[actions:approve]", error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Falha ao aprovar acao"
    });
  }
});

app.post("/api/actions/:id/reject", async (req, res) => {
  try {
    const action = await rejectAction(req.params.id);
    if (!action) {
      return res.status(404).json({ error: "Acao nao encontrada" });
    }

    await writeActionHistory(action.sessionId, "Acao rejeitada pelo usuario", action);
    return res.json({ action });
  } catch (error) {
    console.error("[actions:reject-single]", error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Falha ao rejeitar acao"
    });
  }
});

app.post("/api/actions/:id/apply", async (req, res) => {
  try {
    const applied = await applyAction(req.params.id);
    await writeActionHistory(applied.action.sessionId, "Acao aplicada com confirmacao", applied.action);
    return res.json(applied);
  } catch (error) {
    console.error("[actions:apply-single]", error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Falha ao aplicar acao"
    });
  }
});

app.get("/api/patches", async (_req, res) => {
  try {
    const actions = (await listPendingActions()).filter(isPatchAction).map(buildPatchPayload);
    return res.json({
      ok: true,
      data: actions
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao listar patches"
    });
  }
});

app.get("/api/patches/pending", async (_req, res) => {
  try {
    const patches = (await listPendingActions()).filter(isPatchAction);
    return res.json({
      ok: true,
      patches
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao listar patches"
    });
  }
});

app.post("/api/patches/reject", async (req, res) => {
  const actionIds = Array.isArray(req.body?.actionIds) ? req.body.actionIds : [];

  try {
    const rejected = [];
    for (const actionId of actionIds) {
      if (typeof actionId !== "string") {
        continue;
      }
      const action = await rejectAction(actionId);
      if (action) {
        rejected.push(action);
      }
    }

    return res.json({
      ok: true,
      rejected
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao rejeitar patches"
    });
  }
});

app.post("/api/patches/pending/:patchId/apply", async (req, res) => {
  try {
    const action = await getPendingAction(req.params.patchId);
    if (!action || !isPatchAction(action)) {
      return res.status(404).json({ ok: false, error: "patch nao encontrado" });
    }

    if (action.status === "pending") {
      await approveAction(action.id);
    }

    const applied = await applyAction(action.id);
    await writeActionHistory(applied.action.sessionId, "Patch aplicado pelo usuario", applied.action);
    return res.json({
      ok: true,
      patch: applied.action,
      result: applied.result
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao aplicar patch"
    });
  }
});

app.delete("/api/patches/pending/:patchId", async (req, res) => {
  try {
    const action = await rejectAction(req.params.patchId);
    if (!action || !isPatchAction(action)) {
      return res.status(404).json({ ok: false, error: "patch nao encontrado" });
    }

    await writeActionHistory(action.sessionId, "Patch rejeitado pelo usuario", action);
    return res.json({
      ok: true,
      patch: action
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao rejeitar patch"
    });
  }
});

app.get("/api/patches/:patchId", async (req, res) => {
  try {
    const action = await getPendingAction(req.params.patchId);
    if (!action || !isPatchAction(action)) {
      return res.status(404).json({ ok: false, error: "patch nao encontrado" });
    }

    return res.json({
      ok: true,
      data: buildPatchPayload(action)
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao carregar patch"
    });
  }
});

app.post("/api/patches/:patchId/apply", async (req, res) => {
  try {
    const action = await getPendingAction(req.params.patchId);
    if (!action || !isPatchAction(action)) {
      return res.status(404).json({ ok: false, error: "patch nao encontrado" });
    }

    if (action.status === "pending") {
      await approveAction(action.id);
    }

    const applied = await applyAction(action.id);
    await writeActionHistory(applied.action.sessionId, "Patch aplicado pelo usuario", applied.action);
    return res.json({
      ok: true,
      data: {
        patch: buildPatchPayload(applied.action),
        result: applied.result
      }
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao aplicar patch"
    });
  }
});

app.post("/api/patches/:patchId/reject", async (req, res) => {
  try {
    const action = await rejectAction(req.params.patchId);
    if (!action || !isPatchAction(action)) {
      return res.status(404).json({ ok: false, error: "patch nao encontrado" });
    }

    await writeActionHistory(action.sessionId, "Patch rejeitado pelo usuario", action);
    return res.json({
      ok: true,
      data: buildPatchPayload(action)
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao rejeitar patch"
    });
  }
});

app.get("/api/actions/pending", async (req, res) => {
  try {
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
    res.json({ actions: await listPendingActions(sessionId) });
  } catch (error) {
    console.error("[actions:pending]", error);
    res.status(500).json({ error: "Falha ao listar acoes" });
  }
});

app.post("/api/actions/plan", async (req, res) => {
  const { sessionId, merged, synthesisActions, agentResults } = req.body as {
    sessionId?: string;
    merged?: string;
    synthesisActions?: unknown[];
    agentResults?: Array<{ agent?: string; content?: string }>;
  };

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId e obrigatorio" });
  }

  try {
    const actions = await extractProposedActions({
      sessionId,
      merged,
      synthesisActions: Array.isArray(synthesisActions) ? (synthesisActions as never[]) : undefined,
      agentContents: Array.isArray(agentResults)
        ? agentResults
            .filter((item) => typeof item?.content === "string")
            .map((item) => ({ agent: item.agent || "unknown", content: item.content as string }))
        : undefined
    });

    return res.json({ actions });
  } catch (error) {
    console.error("[actions:plan]", error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Falha ao planejar acoes"
    });
  }
});

app.post("/api/actions/apply", async (req, res) => {
  const { actionIds } = req.body as { actionIds?: string[] };
  if (!Array.isArray(actionIds) || !actionIds.length) {
    return res.status(400).json({ error: "actionIds e obrigatorio" });
  }

  try {
    const applied = [];
    for (const actionId of actionIds) {
      applied.push(await applyAction(actionId));
    }
    return res.json({ applied });
  } catch (error) {
    console.error("[actions:apply-batch]", error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Falha ao aplicar acoes"
    });
  }
});

app.post("/api/actions/reject", async (req, res) => {
  const { actionIds } = req.body as { actionIds?: string[] };
  if (!Array.isArray(actionIds) || !actionIds.length) {
    return res.status(400).json({ error: "actionIds e obrigatorio" });
  }

  try {
    const rejected = [];
    for (const actionId of actionIds) {
      const action = await rejectAction(actionId);
      if (action) {
        await writeActionHistory(action.sessionId, "Acao rejeitada pelo usuario", action);
        rejected.push(action);
      }
    }
    return res.json({ rejected });
  } catch (error) {
    console.error("[actions:reject-batch]", error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Falha ao rejeitar acoes"
    });
  }
});

app.post("/api/tools/web-search", async (req, res) => {
  try {
    const query = String((req.body as { query?: string }).query || "");
    res.json({ results: await webSearch(query) });
  } catch (error) {
    console.error("[tools:web-search]", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Falha na pesquisa web" });
  }
});

app.post("/api/tools/github-search", async (req, res) => {
  try {
    const { query, repo } = req.body as { query?: string; repo?: string };
    if (!query?.trim()) {
      return res.status(400).json({ error: "query e obrigatoria" });
    }

    const results = repo?.trim()
      ? await githubRepoSearch(repo.trim(), query.trim())
      : await githubSearch(query.trim());

    return res.json({ results });
  } catch (error) {
    console.error("[tools:github-search]", error);
    return res.status(400).json({ error: error instanceof Error ? error.message : "Falha na pesquisa GitHub" });
  }
});

app.post("/api/tools/fetch-url", async (req, res) => {
  try {
    const url = String((req.body as { url?: string }).url || "");
    return res.json({ result: await fetchUrl(url) });
  } catch (error) {
    console.error("[tools:fetch-url]", error);
    return res.status(400).json({ error: error instanceof Error ? error.message : "Falha ao buscar URL" });
  }
});

app.get("/api/workspace/files", async (_req, res) => {
  try {
    await ensureWorkspace();
    res.json({ root: getWorkspaceRoot(), files: await listFiles() });
  } catch (error) {
    console.error("[workspace:list]", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao listar arquivos" });
  }
});

app.get("/api/workspace/file", async (req, res) => {
  const targetPath = String(req.query.path ?? "");
  if (!targetPath.trim()) {
    return res.status(400).json({ error: "path e obrigatorio" });
  }

  try {
    res.json(await readFile(targetPath));
  } catch (error) {
    console.error("[workspace:read]", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Falha ao ler arquivo" });
  }
});

app.post("/api/workspace/file", async (req, res) => {
  const { path: targetPath, content = "" } = req.body as { path?: string; content?: string };
  if (!targetPath?.trim()) {
    return res.status(400).json({ error: "path e obrigatorio" });
  }

  try {
    res.status(201).json(await createFile(targetPath, content));
  } catch (error) {
    console.error("[workspace:create]", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Falha ao criar arquivo" });
  }
});

app.put("/api/workspace/file", async (req, res) => {
  const { path: targetPath, content = "" } = req.body as { path?: string; content?: string };
  if (!targetPath?.trim()) {
    return res.status(400).json({ error: "path e obrigatorio" });
  }

  try {
    res.json(await writeFile(targetPath, content));
  } catch (error) {
    console.error("[workspace:write]", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Falha ao salvar arquivo" });
  }
});

app.delete("/api/workspace/file", async (req, res) => {
  const targetPath = String(req.query.path ?? "");
  if (!targetPath.trim()) {
    return res.status(400).json({ error: "path e obrigatorio" });
  }

  try {
    res.json(await deleteFile(targetPath));
  } catch (error) {
    console.error("[workspace:delete]", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Falha ao remover arquivo" });
  }
});

app.post("/api/commands/run", async (req, res) => {
  const { commandId } = req.body as { commandId?: AllowedCommandId };
  if (!commandId) {
    return res.status(400).json({ error: "commandId e obrigatorio" });
  }

  try {
    return res.json(await runCommand(commandId, projectRoot));
  } catch (error) {
    console.error("[commands:run]", error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Falha ao executar comando"
    });
  }
});

app.post("/api/tests/run", async (req, res) => {
  try {
    const { command } = req.body as { command?: string };
    const result = await executeProjectCommand(command || "", projectRoot);
    return res.json({
      ok: true,
      command: result.command,
      exit_code: result.exit_code,
      stdout: result.stdout,
      stderr: result.stderr,
      duration_ms: result.duration_ms,
      created_at: result.created_at
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao rodar validacao"
    });
  }
});

app.get("/api/git/status", (_req, res) => {
  try {
    return res.json({
      ok: true,
      data: getGitStatus(".")
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao carregar Git status"
    });
  }
});

app.get("/api/git/diff", (_req, res) => {
  try {
    return res.json({
      ok: true,
      data: getGitDiff(".")
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao carregar Git diff"
    });
  }
});

app.post("/api/git/commit-message", (_req, res) => {
  try {
    return res.json({
      ok: true,
      data: {
        message: generateCommitMessage(".")
      }
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao gerar mensagem de commit"
    });
  }
});

app.post("/api/git/commit", (req, res) => {
  try {
    const { message } = req.body as { message?: string };
    return res.json({
      ok: true,
      data: createGitCommit(".", message || "")
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao criar commit"
    });
  }
});

// ── AI Settings endpoints ────────────────────────────────────────────────
app.get("/api/ai/settings", async (_req, res) => {
  try {
    const settings = await loadAISettings();
    const status = await getProviderStatus();
    return res.json({
      ok: true,
      mode: settings.mode,
      provider: settings.provider,
      premiumProvider: settings.premiumProvider,
      allowPremiumFallback: settings.allowPremiumFallback,
      requirePremiumConfirmation: settings.requirePremiumConfirmation,
      providers: status
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Falha ao carregar settings de IA" });
  }
});

app.post("/api/ai/settings", async (req, res) => {
  try {
    await saveAISettings(req.body);
    const status = await getProviderStatus();
    const settings = await loadAISettings();
    return res.json({ ok: true, mode: settings.mode, provider: settings.provider, providers: status });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Falha ao salvar settings de IA" });
  }
});

app.post("/api/ai/test-provider", async (req, res) => {
  const { provider } = req.body as { provider?: string };
  if (!provider) return res.status(400).json({ ok: false, error: "provider é obrigatório" });

  try {
    const { AIProviderRouter } = await import("./app/ai/provider-router.js");
    const router = new AIProviderRouter();
    const result = await router.routeChatRequest({
      messages: [{ role: "user", content: "Responda apenas: ok" }],
      context: "",
      goal: "Responda apenas: ok",
      allowPremium: true,
      forceLocal: provider === "ollama"
    });
    return res.json({
      ok: result.ok,
      provider: result.provider,
      model: result.model,
      message: result.ok ? "Conexão funcionando." : result.message
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Teste falhou" });
  }
});

app.post("/api/smart-orchestrate", async (req, res) => {
  const { prompt, context, language } = parsePromptBody(req);
  const { sessionId } = req.body as { sessionId?: string };

  if (!prompt?.trim()) {
    return res.status(400).json({ error: "prompt e obrigatorio" });
  }

  const decision = selectOrchestrationMode(prompt.trim(), context);

  // For high cost, just return the decision so UI can ask for confirmation
  const needsConfirm = decision.estimated_cost_level === "high";

  try {
    const session = sessionId ? await getSession(sessionId) : await createSession(prompt.trim());
    if (!session) {
      return res.status(404).json({ error: "Sessao nao encontrada" });
    }

    return res.json({
      ok: true,
      session_id: session.id,
      decision,
      needs_confirmation: needsConfirm
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha no smart orchestrate"
    });
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Nexus IDE rodando em http://localhost:${port}`);
});
