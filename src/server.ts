import express from 'express';
import path from 'node:path';
import { readFile as readFsFile, stat as statFs } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { registerAgentRoutes } from './app/web/server.js';
import { registerGenerateSiteRoutes } from './routes/generate-site.js';
import {
  assertPatchActionInsideActiveProject,
  ensureActiveProject,
  getActiveProject,
  getAppRoot,
  resolveProjectRootForRequest,
  setActiveProjectRoot,
} from './active-project.js';
import { selectOrchestrationMode } from './orchestration-mode.js';
import {
  getProviderStatus,
  loadAISettings,
  maskApiKey,
  saveAISettings,
  type ProviderName,
} from './app/ai/ai-settings.js';
import { applyAction } from './action-executor.js';
import { extractProposedActions } from './action-planner.js';
import type { ActionRecord } from './action-types.js';
import {
  listAllowedCommands,
  resolveAllowedCommand,
  runCommand,
  type AllowedCommandId,
} from './command-runner.js';
import { classifyIntent } from './intent-classifier.js';
import { getAgentStatus, orchestrate, type AgentName } from './nexus-orchestrator.js';
import {
  approveAction,
  getPendingAction,
  listPendingActions,
  rejectAction,
  setActionExpectedHash,
} from './pending-actions-store.js';
import {
  createGitCommit,
  createGitBranch,
  generateCommitMessage,
  getGitDiff,
  getGitFileDiff,
  getGitStatus,
  readProjectSnapshot,
  scanProject,
  stageGitFiles,
  unstageGitFiles,
} from './project-inspector.js';
import {
  createProjectFolder,
  deleteProjectFile,
  deleteProjectFolder,
  listProjectFiles,
  listProjectTree,
  projectFileExists,
  readProjectFile,
  renameProjectPath,
  resolveProjectPath,
  writeProjectFile,
} from './project-file-store.js';
import { readLastCommandResult, saveLastCommandResult } from './project-runtime-store.js';
import { fetchUrl, githubRepoSearch, githubSearch, webSearch } from './research-tools.js';
import { buildPatchPayload, isPatchAction } from './patch-payload.js';
import { listBackups, previewBackupRestore, restoreBackup } from './backup-store.js';
import { aiRateLimiter, commandRateLimiter, generalWriteRateLimiter } from './rate-limit.js';
import { setPreviewSecurityHeaders } from './preview-security.js';
import {
  appendMessage,
  createSession,
  deleteSession,
  getRecentHistory,
  getSession,
  listSessions,
} from './session-store.js';
import {
  createFile,
  deleteFile,
  ensureWorkspace,
  getWorkspaceRoot,
  listFiles,
  readFile,
  writeFile,
} from './workspace-store.js';
import {
  buildLocalSecurityPayload,
  configureLocalCors,
  isAllowedOrigin,
  requireConfirmation,
  requireLocalTrust,
} from './local-security.js';
import { registerAiEditRoutes } from './routes/ai-edits.js';
import { updateAiEditHistoryByAction } from './patches/patch-history-store.js';
import { isExpectedFileHash } from './file-content-hash.js';

const projectRoot = getAppRoot();
const publicDir = path.resolve(projectRoot, 'public');
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '127.0.0.1';
const MAX_PROMPT_LENGTH = 12_000;

const app = express();

app.use(configureLocalCors);
app.use((_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'none'",
      "script-src 'self' https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
      "connect-src 'self'",
      "font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com",
      "img-src 'self' data:",
      "worker-src 'self' blob:",
      "frame-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(requireLocalTrust);
app.use(express.static(publicDir));

function buildHistoryContext(messages: Awaited<ReturnType<typeof getRecentHistory>>) {
  if (!messages.length) {
    return '';
  }

  return messages
    .map(
      (message) =>
        `[${message.role.toUpperCase()}${message.intent ? ` | ${message.intent}` : ''}] ${message.content}`,
    )
    .join('\n');
}

function formatActionForHistory(action: ActionRecord) {
  switch (action.type) {
    case 'run_command':
      return `${action.type}: ${action.command}`;
    case 'install_package':
      return `${action.type}: ${action.packageManager} ${action.dev ? '--save-dev ' : ''}${action.packages.join(' ')}`.trim();
    default:
      return `${action.type}: ${action.path}`;
  }
}

async function writeActionHistory(
  sessionId: string,
  title: string,
  action: ActionRecord,
  extra?: string,
) {
  try {
    await appendMessage(sessionId, {
      role: 'system',
      content: [title, formatActionForHistory(action), action.reason, extra]
        .filter(Boolean)
        .join('\n'),
      intent: 'general',
    });
  } catch (error) {
    console.warn(
      '[actions:history]',
      error instanceof Error ? error.message : 'Historico de acao indisponivel',
    );
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
    role: 'user',
    content: input.prompt,
    intent,
  });

  const recentHistory = await getRecentHistory(input.sessionId, 8);
  const historyContext = buildHistoryContext(recentHistory.slice(0, -1));
  const composedContext = [
    input.context?.trim() ? `Contexto explicito do usuario:\n${input.context.trim()}` : '',
    historyContext ? `Historico recente da sessao:\n${historyContext}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const result = await orchestrate({
    sessionId: input.sessionId,
    prompt: input.prompt,
    context: composedContext,
    language: input.language?.trim(),
    agents: input.agents,
  });

  const proposedActions = await extractProposedActions({
    sessionId: input.sessionId,
    merged: result.merged,
    synthesisActions: result.synthesis.actions as never[],
    agentContents: result.proposals.map((agent) => ({
      agent: agent.agent,
      content: agent.content,
    })),
  });

  await appendMessage(input.sessionId, {
    role: 'assistant',
    content: result.merged,
    intent,
    agents: result.agents.map((agent) => ({
      agent: agent.agent,
      ok: agent.ok,
      latency: agent.latency,
      mode: agent.mode,
      error: agent.error,
    })),
  });

  const session = await getSession(input.sessionId);
  if (!session) {
    throw new Error('Sessao nao encontrada apos a orquestracao');
  }

  return {
    sessionId: input.sessionId,
    session,
    proposedActions,
    ...result,
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

async function activeProjectInput() {
  return (await ensureActiveProject()).root;
}

async function activeProjectAbsoluteRoot() {
  return (await ensureActiveProject()).absoluteRoot;
}

function readRequestedProjectRoot(value: unknown) {
  return resolveProjectRootForRequest(value);
}

function assertSafePatchApply(action: ActionRecord) {
  if (isPatchAction(action)) {
    assertPatchActionInsideActiveProject(action);
  }
}

function isSafePatchForActiveProject(action: ActionRecord) {
  try {
    assertSafePatchApply(action);
    return true;
  } catch {
    return false;
  }
}

async function bindReviewedHash(action: ActionRecord, value: unknown) {
  if (action.type !== 'write_file' || !isExpectedFileHash(value)) {
    return action;
  }

  return (await setActionExpectedHash(action.id, value)) ?? action;
}

async function executeProjectCommand(commandLike: string, root = projectRoot, timeoutMs?: number) {
  const resolved = resolveAllowedCommand(commandLike);
  if (!resolved) {
    throw new Error('Comando nao permitido');
  }

  const result = await runCommand(resolved.id, root, { timeoutMs });
  return saveLastCommandResult(root, {
    ok: result.exitCode === 0,
    command: result.command,
    exit_code: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    duration_ms: result.durationMs,
  });
}

async function markAiEditActionStatus(actionId: string, status: 'applied' | 'rejected') {
  const backups = status === 'applied' ? await listBackups().catch(() => []) : [];
  const backupIds = backups
    .filter((backup) => backup.actionId === actionId)
    .map((backup) => backup.id);
  await updateAiEditHistoryByAction(actionId, {
    status,
    ...(backupIds.length ? { backupIds } : {}),
  }).catch(() => null);
}

function hasTrustedBootstrapSource(req: express.Request) {
  const referer = req.headers.referer;
  if (referer && (referer.includes('/preview/project/') || referer.includes('/preview/staged/'))) {
    return false;
  }
  return isAllowedOrigin(req.headers.origin) && isAllowedOrigin(referer);
}

app.get('/api/local-auth/bootstrap', (req, res) => {
  // The UI needs one same-origin bootstrap before protected API calls can send the local token.
  // Workspace previews are additionally sandboxed with `connect-src 'none'`, so they cannot use this route.
  if (req.header('X-Nexus-Request') !== 'bootstrap' || !hasTrustedBootstrapSource(req)) {
    return res.status(403).json({ ok: false, error: 'Bootstrap local do Nexus nao confiavel' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    ok: true,
    localSecurity: buildLocalSecurityPayload(),
  });
});

app.get('/api/health', async (_req, res) => {
  const activeProject = await ensureActiveProject();
  const project = readProjectSnapshot(activeProject.root);
  res.json({
    ok: true,
    mode: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY ? 'live-ready' : 'mock-ready',
    agents: getAgentStatus(),
    allowedCommands: listAllowedCommands(),
    workspaceRoot: getWorkspaceRoot(),
    appRoot: getAppRoot(),
    projectRoot,
    activeProject,
    project,
    lastTestResult: await readLastCommandResult(activeProject.root),
    localSecurity: {
      csrfHeader: 'X-Nexus-Request',
      tokenHeader: 'X-Nexus-Token',
      bootstrap: '/api/local-auth/bootstrap',
    },
  });
});

registerAgentRoutes(app);
registerGenerateSiteRoutes(app);
registerAiEditRoutes(app, activeProjectInput);

const PREVIEW_MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function previewMimeType(filePath: string) {
  return PREVIEW_MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

app.get(/^\/preview\/project\/(.+)$/, async (req, res) => {
  try {
    const requestedPath = decodeURIComponent(req.params[0] || '');
    const activeProject = await ensureActiveProject();
    const target = resolveProjectPath(activeProject.root, requestedPath);
    const info = await statFs(target.absolutePath);
    if (!info.isFile()) {
      return res.status(404).send('Preview indisponivel: arquivo nao encontrado.');
    }

    res.setHeader('Content-Type', previewMimeType(target.normalized));
    setPreviewSecurityHeaders(res);
    return res.send(await readFsFile(target.absolutePath));
  } catch (error) {
    return res.status(404).send(error instanceof Error ? error.message : 'Preview indisponivel.');
  }
});

app.get('/api/project/current', async (_req, res) => {
  try {
    return res.json({
      ok: true,
      project: await ensureActiveProject(),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao carregar projeto ativo',
    });
  }
});

app.post('/api/project/current', generalWriteRateLimiter, async (req, res) => {
  try {
    const project = await setActiveProjectRoot((req.body as { root?: unknown }).root);
    return res.json({
      ok: true,
      project,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao selecionar projeto ativo',
    });
  }
});

app.get('/api/project', async (_req, res) => {
  try {
    const activeProject = await ensureActiveProject();
    return res.json({
      ok: true,
      data: {
        ...readProjectSnapshot(activeProject.root),
        activeProject,
        last_test_result: await readLastCommandResult(activeProject.root),
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao carregar projeto',
    });
  }
});

app.get('/api/project/scan', async (_req, res) => {
  try {
    const activeProject = await ensureActiveProject();
    return res.json({
      ok: true,
      data: {
        ...(await scanProject(activeProject.root)),
        activeProject,
        last_test_result: await readLastCommandResult(activeProject.root),
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao analisar projeto',
    });
  }
});

app.get('/api/project/files', async (req, res) => {
  try {
    const targetRoot = readRequestedProjectRoot(req.query.projectRoot);
    return res.json({
      ok: true,
      files: await listProjectFiles(targetRoot),
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao listar arquivos do projeto',
    });
  }
});

app.get('/api/project/tree', async (req, res) => {
  try {
    const targetRoot = readRequestedProjectRoot(req.query.projectRoot);
    const tree = await listProjectTree(targetRoot);
    return res.json({
      ok: true,
      tree,
      data: tree,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao listar arvore do projeto',
    });
  }
});

app.get('/api/project/file', async (req, res) => {
  const targetPath = String(req.query.path ?? req.query.filePath ?? '');
  if (!targetPath.trim()) {
    return res.status(400).json({ ok: false, error: 'path e obrigatorio' });
  }

  try {
    const targetRoot = readRequestedProjectRoot(req.query.projectRoot);
    const file = await readProjectFile(targetRoot, targetPath);
    return res.json({
      ok: true,
      data: file,
      path: file.path,
      content: file.content,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao ler arquivo do projeto',
    });
  }
});

app.post('/api/project/file', generalWriteRateLimiter, async (req, res) => {
  const {
    projectRoot,
    path: targetPath,
    content = '',
  } = req.body as { projectRoot?: string; path?: string; content?: string };
  if (!targetPath?.trim()) {
    return res.status(400).json({ ok: false, error: 'path e obrigatorio' });
  }

  try {
    const targetRoot = readRequestedProjectRoot(projectRoot);
    if (await projectFileExists(targetRoot, targetPath)) {
      return res.status(409).json({ ok: false, error: 'Arquivo ja existe' });
    }
    const file = await writeProjectFile(targetRoot, targetPath, content);
    return res.status(201).json({
      ok: true,
      data: file,
      path: file.path,
      content: file.content,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao criar arquivo do projeto',
    });
  }
});

app.put('/api/project/file', generalWriteRateLimiter, async (req, res) => {
  const {
    projectRoot,
    path: targetPath,
    content = '',
  } = req.body as { projectRoot?: string; path?: string; content?: string };
  if (!targetPath?.trim()) {
    return res.status(400).json({ ok: false, error: 'path e obrigatorio' });
  }

  try {
    const targetRoot = readRequestedProjectRoot(projectRoot);
    const file = await writeProjectFile(targetRoot, targetPath, content);
    return res.json({
      ok: true,
      data: file,
      path: file.path,
      content: file.content,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao salvar arquivo do projeto',
    });
  }
});

app.delete('/api/project/file', requireConfirmation, async (req, res) => {
  const targetPath = String(req.query.path ?? req.query.filePath ?? '');
  if (!targetPath.trim()) {
    return res.status(400).json({ ok: false, error: 'path e obrigatorio' });
  }

  try {
    const targetRoot = readRequestedProjectRoot(req.query.projectRoot);
    return res.json({
      ok: true,
      data: await deleteProjectFile(targetRoot, targetPath),
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao remover arquivo do projeto',
    });
  }
});

app.post('/api/project/folder', async (req, res) => {
  const { projectRoot, path: targetPath } = req.body as { projectRoot?: string; path?: string };
  if (!targetPath?.trim()) {
    return res.status(400).json({ ok: false, error: 'path e obrigatorio' });
  }

  try {
    const targetRoot = readRequestedProjectRoot(projectRoot);
    return res.status(201).json({
      ok: true,
      data: await createProjectFolder(targetRoot, targetPath),
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao criar pasta do projeto',
    });
  }
});

app.put('/api/project/rename', async (req, res) => {
  const { projectRoot, oldPath, newPath } = req.body as {
    projectRoot?: string;
    oldPath?: string;
    newPath?: string;
  };
  if (!oldPath?.trim() || !newPath?.trim()) {
    return res.status(400).json({ ok: false, error: 'oldPath e newPath sao obrigatorios' });
  }

  try {
    const targetRoot = readRequestedProjectRoot(projectRoot);
    return res.json({
      ok: true,
      data: await renameProjectPath(targetRoot, oldPath, newPath),
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao renomear caminho do projeto',
    });
  }
});

app.delete('/api/project/folder', requireConfirmation, async (req, res) => {
  const targetPath = String(req.query.path ?? '');
  const confirmed = String(req.query.confirm ?? '');
  if (!targetPath.trim()) {
    return res.status(400).json({ ok: false, error: 'path e obrigatorio' });
  }
  if (confirmed !== 'true') {
    return res.status(400).json({
      ok: false,
      error: 'confirm=true e obrigatorio para deletar pasta',
    });
  }

  try {
    const targetRoot = readRequestedProjectRoot(req.query.projectRoot);
    return res.json({
      ok: true,
      data: await deleteProjectFolder(targetRoot, targetPath),
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao remover pasta do projeto',
    });
  }
});

app.get('/api/project/git/status', async (_req, res) => {
  try {
    const root = await activeProjectInput();
    return res.json({
      ok: true,
      data: getGitStatus(root),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao carregar Git status',
    });
  }
});

app.post('/api/project/run-command', commandRateLimiter, requireConfirmation, async (req, res) => {
  try {
    const { command, commandId, timeoutMs } = req.body as {
      command?: string;
      commandId?: string;
      timeoutMs?: number;
    };
    const result = await executeProjectCommand(
      command || commandId || '',
      await activeProjectAbsoluteRoot(),
      timeoutMs,
    );
    return res.json({ ok: true, data: result });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao executar comando do projeto',
    });
  }
});

app.get('/api/sessions', async (_req, res) => {
  try {
    res.json({ sessions: await listSessions() });
  } catch (error) {
    console.error('[sessions:list]', error);
    res.status(500).json({ error: 'Falha ao listar sessoes' });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const session = await createSession((req.body as { title?: string }).title);
    res.status(201).json({ session });
  } catch (error) {
    console.error('[sessions:create]', error);
    res.status(500).json({ error: 'Falha ao criar sessao' });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Sessao nao encontrada' });
    }

    return res.json({ session });
  } catch (error) {
    console.error('[sessions:get]', error);
    return res.status(500).json({ error: 'Falha ao carregar sessao' });
  }
});

app.delete('/api/sessions/:id', requireConfirmation, async (req, res) => {
  try {
    const deleted = await deleteSession(String(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: 'Sessao nao encontrada' });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('[sessions:delete]', error);
    return res.status(500).json({ error: 'Falha ao remover sessao' });
  }
});

app.post('/api/sessions/:id/orchestrate', aiRateLimiter, async (req, res) => {
  const { prompt, context, language, agents } = parsePromptBody(req);

  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'prompt e obrigatorio' });
  }

  if (prompt.trim().length > MAX_PROMPT_LENGTH) {
    return res
      .status(400)
      .json({ error: `prompt excede o limite de ${MAX_PROMPT_LENGTH} caracteres` });
  }

  try {
    const session = await getSession(String(req.params.id));
    if (!session) {
      return res.status(404).json({ error: 'Sessao nao encontrada' });
    }

    return res.json(
      await handleOrchestrate({
        sessionId: session.id,
        prompt: prompt.trim(),
        context,
        language,
        agents: Array.isArray(agents) ? agents : undefined,
      }),
    );
  } catch (error) {
    console.error('[sessions:orchestrate]', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha interna no orquestrador',
    });
  }
});

app.post('/api/orchestrate', aiRateLimiter, async (req, res) => {
  const { prompt, context, language, agents } = parsePromptBody(req);
  const sessionId = (req.body as { sessionId?: string }).sessionId;

  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'prompt e obrigatorio' });
  }

  if (prompt.trim().length > MAX_PROMPT_LENGTH) {
    return res
      .status(400)
      .json({ error: `prompt excede o limite de ${MAX_PROMPT_LENGTH} caracteres` });
  }

  try {
    const session = sessionId ? await getSession(sessionId) : await createSession(prompt.trim());
    if (!session) {
      return res.status(404).json({ error: 'Sessao nao encontrada' });
    }

    return res.json(
      await handleOrchestrate({
        sessionId: session.id,
        prompt: prompt.trim(),
        context,
        language,
        agents: Array.isArray(agents) ? agents : undefined,
      }),
    );
  } catch (error) {
    console.error('[orchestrate]', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Falha interna no orquestrador',
    });
  }
});

app.get('/api/sessions/:id/actions', async (req, res) => {
  try {
    res.json({ actions: await listPendingActions(req.params.id) });
  } catch (error) {
    console.error('[actions:list-session]', error);
    res.status(500).json({ error: 'Falha ao listar acoes da sessao' });
  }
});

app.post('/api/sessions/:id/actions/plan', async (req, res) => {
  const { merged, agentResults, synthesisActions } = req.body as {
    merged?: string;
    synthesisActions?: unknown[];
    agentResults?: Array<{ agent?: string; content?: string }>;
  };

  if (!merged && !Array.isArray(synthesisActions)) {
    return res.status(400).json({ error: 'merged ou synthesisActions e obrigatorio' });
  }

  try {
    const session = await getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Sessao nao encontrada' });
    }

    const actions = await extractProposedActions({
      sessionId: session.id,
      merged,
      synthesisActions: Array.isArray(synthesisActions) ? (synthesisActions as never[]) : undefined,
      agentContents: Array.isArray(agentResults)
        ? agentResults
            .filter((item) => typeof item?.content === 'string')
            .map((item) => ({ agent: item.agent || 'unknown', content: item.content as string }))
        : undefined,
    });

    return res.json({ actions });
  } catch (error) {
    console.error('[actions:plan-session]', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Falha ao planejar acoes',
    });
  }
});

app.post('/api/actions/:id/approve', async (req, res) => {
  try {
    const existing = await getPendingAction(req.params.id);
    if (existing) {
      await bindReviewedHash(existing, req.body?.expectedHash ?? req.body?.expected_hash);
    }
    const action = await approveAction(req.params.id);
    if (!action) {
      return res.status(404).json({ error: 'Acao nao encontrada' });
    }

    await writeActionHistory(action.sessionId, 'Acao aprovada pelo usuario', action);
    return res.json({ action });
  } catch (error) {
    console.error('[actions:approve]', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Falha ao aprovar acao',
    });
  }
});

app.post('/api/actions/:id/reject', async (req, res) => {
  try {
    const action = await rejectAction(req.params.id);
    if (!action) {
      return res.status(404).json({ error: 'Acao nao encontrada' });
    }

    await writeActionHistory(action.sessionId, 'Acao rejeitada pelo usuario', action);
    await markAiEditActionStatus(action.id, 'rejected');
    return res.json({ action });
  } catch (error) {
    console.error('[actions:reject-single]', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Falha ao rejeitar acao',
    });
  }
});

app.post('/api/actions/:id/apply', requireConfirmation, async (req, res) => {
  try {
    let action = await getPendingAction(String(req.params.id));
    if (action) {
      assertSafePatchApply(action);
      action = await bindReviewedHash(action, req.body?.expectedHash ?? req.body?.expected_hash);
    }
    const applied = await applyAction(String(req.params.id));
    await writeActionHistory(
      applied.action.sessionId,
      'Acao aplicada com confirmacao',
      applied.action,
    );
    await markAiEditActionStatus(applied.action.id, 'applied');
    return res.json(applied);
  } catch (error) {
    console.error('[actions:apply-single]', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Falha ao aplicar acao',
    });
  }
});

app.get('/api/patches', async (_req, res) => {
  try {
    const pending = (await listPendingActions()).filter(
      (action) => isPatchAction(action) && isSafePatchForActiveProject(action),
    );
    const actions = await Promise.all(pending.map((action) => buildPatchPayload(action)));
    return res.json({
      ok: true,
      data: actions,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao listar patches',
    });
  }
});

app.get('/api/patches/pending', async (_req, res) => {
  try {
    const pending = (await listPendingActions()).filter(
      (action) =>
        isPatchAction(action) &&
        isSafePatchForActiveProject(action) &&
        (action.status === 'pending' || action.status === 'approved'),
    );
    const patches = await Promise.all(pending.map((action) => buildPatchPayload(action)));
    return res.json({
      ok: true,
      patches,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao listar patches',
    });
  }
});

app.post('/api/patches/reject', requireConfirmation, async (req, res) => {
  const actionIds = Array.isArray(req.body?.actionIds) ? req.body.actionIds : [];

  try {
    const rejected = [];
    for (const actionId of actionIds) {
      if (typeof actionId !== 'string') {
        continue;
      }
      const action = await rejectAction(actionId);
      if (action) {
        await markAiEditActionStatus(action.id, 'rejected');
        rejected.push(action);
      }
    }

    return res.json({
      ok: true,
      rejected,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao rejeitar patches',
    });
  }
});

app.post('/api/patches/pending/:patchId/apply', requireConfirmation, async (req, res) => {
  try {
    let action = await getPendingAction(String(req.params.patchId));
    if (!action || !isPatchAction(action)) {
      return res.status(404).json({ ok: false, error: 'patch nao encontrado' });
    }

    assertSafePatchApply(action);
    action = await bindReviewedHash(action, req.body?.expectedHash ?? req.body?.expected_hash);

    if (action.status === 'pending') {
      await approveAction(action.id);
    }

    const applied = await applyAction(action.id);
    await writeActionHistory(
      applied.action.sessionId,
      'Patch aplicado pelo usuario',
      applied.action,
    );
    await markAiEditActionStatus(applied.action.id, 'applied');
    const patch = await buildPatchPayload(applied.action);
    return res.json({
      ok: true,
      patch,
      data: patch,
      result: applied.result,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao aplicar patch',
    });
  }
});

app.delete('/api/patches/pending/:patchId', requireConfirmation, async (req, res) => {
  try {
    const action = await rejectAction(String(req.params.patchId));
    if (!action || !isPatchAction(action)) {
      return res.status(404).json({ ok: false, error: 'patch nao encontrado' });
    }

    await writeActionHistory(action.sessionId, 'Patch rejeitado pelo usuario', action);
    await markAiEditActionStatus(action.id, 'rejected');
    return res.json({
      ok: true,
      patch: action,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao rejeitar patch',
    });
  }
});

app.get('/api/patches/:patchId', async (req, res) => {
  try {
    const action = await getPendingAction(req.params.patchId);
    if (!action || !isPatchAction(action)) {
      return res.status(404).json({ ok: false, error: 'patch nao encontrado' });
    }

    assertSafePatchApply(action);

    const patch = await buildPatchPayload(action);
    return res.json({
      ok: true,
      patch,
      data: patch,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao carregar patch',
    });
  }
});

app.get('/api/backups', async (_req, res) => {
  try {
    return res.json({
      ok: true,
      data: await listBackups(),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao listar backups',
    });
  }
});

app.get('/api/backups/:id', async (req, res) => {
  try {
    const preview = await previewBackupRestore(await activeProjectInput(), req.params.id);
    return res.json({
      ok: true,
      data: preview,
    });
  } catch (error) {
    return res.status(404).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Backup nao encontrado',
    });
  }
});

app.post('/api/backups/:id/restore', requireConfirmation, async (req, res) => {
  try {
    const restored = await restoreBackup(await activeProjectInput(), String(req.params.id));
    return res.json({
      ok: true,
      data: restored,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao restaurar backup',
    });
  }
});

app.post('/api/patches/:patchId/apply', requireConfirmation, async (req, res) => {
  try {
    let action = await getPendingAction(String(req.params.patchId));
    if (!action || !isPatchAction(action)) {
      return res.status(404).json({ ok: false, error: 'patch nao encontrado' });
    }

    assertSafePatchApply(action);
    action = await bindReviewedHash(action, req.body?.expectedHash ?? req.body?.expected_hash);

    if (action.status === 'pending') {
      await approveAction(action.id);
    }

    const applied = await applyAction(action.id);
    await writeActionHistory(
      applied.action.sessionId,
      'Patch aplicado pelo usuario',
      applied.action,
    );
    await markAiEditActionStatus(applied.action.id, 'applied');
    const patch = await buildPatchPayload(applied.action);
    return res.json({
      ok: true,
      patch,
      data: {
        patch,
        result: applied.result,
      },
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao aplicar patch',
    });
  }
});

app.post('/api/patches/:patchId/reject', requireConfirmation, async (req, res) => {
  try {
    const action = await rejectAction(String(req.params.patchId));
    if (!action || !isPatchAction(action)) {
      return res.status(404).json({ ok: false, error: 'patch nao encontrado' });
    }

    await writeActionHistory(action.sessionId, 'Patch rejeitado pelo usuario', action);
    await markAiEditActionStatus(action.id, 'rejected');
    const patch = await buildPatchPayload(action);
    return res.json({
      ok: true,
      patch,
      data: patch,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao rejeitar patch',
    });
  }
});

app.get('/api/actions/pending', async (req, res) => {
  try {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    res.json({ actions: await listPendingActions(sessionId) });
  } catch (error) {
    console.error('[actions:pending]', error);
    res.status(500).json({ error: 'Falha ao listar acoes' });
  }
});

app.post('/api/actions/plan', async (req, res) => {
  const { sessionId, merged, synthesisActions, agentResults } = req.body as {
    sessionId?: string;
    merged?: string;
    synthesisActions?: unknown[];
    agentResults?: Array<{ agent?: string; content?: string }>;
  };

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId e obrigatorio' });
  }

  try {
    const actions = await extractProposedActions({
      sessionId,
      merged,
      synthesisActions: Array.isArray(synthesisActions) ? (synthesisActions as never[]) : undefined,
      agentContents: Array.isArray(agentResults)
        ? agentResults
            .filter((item) => typeof item?.content === 'string')
            .map((item) => ({ agent: item.agent || 'unknown', content: item.content as string }))
        : undefined,
    });

    return res.json({ actions });
  } catch (error) {
    console.error('[actions:plan]', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Falha ao planejar acoes',
    });
  }
});

app.post('/api/actions/apply', requireConfirmation, async (req, res) => {
  const { actionIds } = req.body as { actionIds?: string[] };
  if (!Array.isArray(actionIds) || !actionIds.length) {
    return res.status(400).json({ error: 'actionIds e obrigatorio' });
  }

  try {
    const applied = [];
    for (const actionId of actionIds) {
      const action = await getPendingAction(actionId);
      if (action) {
        assertSafePatchApply(action);
      }
      const appliedAction = await applyAction(actionId);
      await markAiEditActionStatus(appliedAction.action.id, 'applied');
      applied.push(appliedAction);
    }
    return res.json({ applied });
  } catch (error) {
    console.error('[actions:apply-batch]', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Falha ao aplicar acoes',
    });
  }
});

app.post('/api/actions/reject', requireConfirmation, async (req, res) => {
  const { actionIds } = req.body as { actionIds?: string[] };
  if (!Array.isArray(actionIds) || !actionIds.length) {
    return res.status(400).json({ error: 'actionIds e obrigatorio' });
  }

  try {
    const rejected = [];
    for (const actionId of actionIds) {
      const action = await rejectAction(actionId);
      if (action) {
        await writeActionHistory(action.sessionId, 'Acao rejeitada pelo usuario', action);
        await markAiEditActionStatus(action.id, 'rejected');
        rejected.push(action);
      }
    }
    return res.json({ rejected });
  } catch (error) {
    console.error('[actions:reject-batch]', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Falha ao rejeitar acoes',
    });
  }
});

app.post('/api/tools/web-search', aiRateLimiter, async (req, res) => {
  try {
    const query = String((req.body as { query?: string }).query || '');
    res.json({ results: await webSearch(query) });
  } catch (error) {
    console.error('[tools:web-search]', error);
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : 'Falha na pesquisa web' });
  }
});

app.post('/api/tools/github-search', aiRateLimiter, async (req, res) => {
  try {
    const { query, repo } = req.body as { query?: string; repo?: string };
    if (!query?.trim()) {
      return res.status(400).json({ error: 'query e obrigatoria' });
    }

    const results = repo?.trim()
      ? await githubRepoSearch(repo.trim(), query.trim())
      : await githubSearch(query.trim());

    return res.json({ results });
  } catch (error) {
    console.error('[tools:github-search]', error);
    return res
      .status(400)
      .json({ error: error instanceof Error ? error.message : 'Falha na pesquisa GitHub' });
  }
});

app.post('/api/tools/fetch-url', aiRateLimiter, async (req, res) => {
  try {
    const url = String((req.body as { url?: string }).url || '');
    return res.json({ result: await fetchUrl(url) });
  } catch (error) {
    console.error('[tools:fetch-url]', error);
    return res
      .status(400)
      .json({ error: error instanceof Error ? error.message : 'Falha ao buscar URL' });
  }
});

app.get('/api/workspace/files', async (_req, res) => {
  try {
    await ensureWorkspace();
    res.json({ root: getWorkspaceRoot(), files: await listFiles() });
  } catch (error) {
    console.error('[workspace:list]', error);
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Falha ao listar arquivos' });
  }
});

app.get('/api/workspace/file', async (req, res) => {
  const targetPath = String(req.query.path ?? '');
  if (!targetPath.trim()) {
    return res.status(400).json({ error: 'path e obrigatorio' });
  }

  try {
    res.json(await readFile(targetPath));
  } catch (error) {
    console.error('[workspace:read]', error);
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : 'Falha ao ler arquivo' });
  }
});

app.post('/api/workspace/file', generalWriteRateLimiter, async (req, res) => {
  const { path: targetPath, content = '' } = req.body as { path?: string; content?: string };
  if (!targetPath?.trim()) {
    return res.status(400).json({ error: 'path e obrigatorio' });
  }

  try {
    res.status(201).json(await createFile(targetPath, content));
  } catch (error) {
    console.error('[workspace:create]', error);
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : 'Falha ao criar arquivo' });
  }
});

app.put('/api/workspace/file', generalWriteRateLimiter, async (req, res) => {
  const { path: targetPath, content = '' } = req.body as { path?: string; content?: string };
  if (!targetPath?.trim()) {
    return res.status(400).json({ error: 'path e obrigatorio' });
  }

  try {
    res.json(await writeFile(targetPath, content));
  } catch (error) {
    console.error('[workspace:write]', error);
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : 'Falha ao salvar arquivo' });
  }
});

app.delete('/api/workspace/file', requireConfirmation, async (req, res) => {
  const targetPath = String(req.query.path ?? '');
  if (!targetPath.trim()) {
    return res.status(400).json({ error: 'path e obrigatorio' });
  }

  try {
    res.json(await deleteFile(targetPath));
  } catch (error) {
    console.error('[workspace:delete]', error);
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : 'Falha ao remover arquivo' });
  }
});

app.post('/api/commands/run', commandRateLimiter, requireConfirmation, async (req, res) => {
  const { commandId, timeoutMs } = req.body as { commandId?: AllowedCommandId; timeoutMs?: number };
  if (!commandId) {
    return res.status(400).json({ error: 'commandId e obrigatorio' });
  }

  try {
    return res.json(await runCommand(commandId, await activeProjectAbsoluteRoot(), { timeoutMs }));
  } catch (error) {
    console.error('[commands:run]', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Falha ao executar comando',
    });
  }
});

app.post('/api/tests/run', commandRateLimiter, requireConfirmation, async (req, res) => {
  try {
    const { command, timeoutMs } = req.body as { command?: string; timeoutMs?: number };
    const result = await executeProjectCommand(
      command || '',
      await activeProjectAbsoluteRoot(),
      timeoutMs,
    );
    return res.json({
      ok: true,
      command: result.command,
      exit_code: result.exit_code,
      stdout: result.stdout,
      stderr: result.stderr,
      duration_ms: result.duration_ms,
      created_at: result.created_at,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao rodar validacao',
    });
  }
});

app.post('/api/dev/fix-command', aiRateLimiter, async (req, res) => {
  try {
    const {
      command = '',
      stdout = '',
      stderr = '',
      exit_code,
      active_file = '',
      context = '',
    } = req.body as {
      command?: string;
      stdout?: string;
      stderr?: string;
      exit_code?: number;
      active_file?: string;
      context?: string;
    };

    const goal = [
      `Corrija o erro do comando: ${command || 'validacao'}.`,
      typeof exit_code === 'number' ? `Exit code: ${exit_code}` : '',
      active_file ? `Arquivo ativo: ${active_file}` : '',
      stdout ? `STDOUT:\n${String(stdout).slice(0, 6_000)}` : '',
      stderr ? `STDERR:\n${String(stderr).slice(0, 6_000)}` : '',
      context ? `Contexto da IDE:\n${String(context).slice(0, 4_000)}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const run = await import('./app/agents/runner.js').then(({ agentRunner }) =>
      agentRunner.run_agent('debug_agent', goal, getActiveProject().root),
    );

    return res.status(202).json({
      ok: true,
      run_id: run.id,
      agent_id: 'debug_agent',
      status: 'started',
      message: 'Debug Agent iniciado com o erro do comando.',
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao iniciar correcao com Nexus',
    });
  }
});

app.get('/api/git/status', async (_req, res) => {
  try {
    const root = await activeProjectInput();
    return res.json({
      ok: true,
      data: getGitStatus(root),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao carregar Git status',
    });
  }
});

app.get('/api/git/diff', async (_req, res) => {
  try {
    const root = await activeProjectInput();
    return res.json({
      ok: true,
      data: getGitDiff(root),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao carregar Git diff',
    });
  }
});

app.get('/api/git/diff/file', async (req, res) => {
  try {
    const root = await activeProjectInput();
    const file = String(req.query.path || '');
    return res.json({
      ok: true,
      data: getGitFileDiff(root, file),
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao carregar diff do arquivo',
    });
  }
});

app.post('/api/git/stage', requireConfirmation, async (req, res) => {
  try {
    const { files } = req.body as { files?: string[] };
    const root = await activeProjectInput();
    return res.json({
      ok: true,
      data: stageGitFiles(root, Array.isArray(files) ? files : []),
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao preparar arquivos',
    });
  }
});

app.post('/api/git/unstage', requireConfirmation, async (req, res) => {
  try {
    const { files } = req.body as { files?: string[] };
    const root = await activeProjectInput();
    return res.json({
      ok: true,
      data: unstageGitFiles(root, Array.isArray(files) ? files : []),
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao remover arquivos do stage',
    });
  }
});

app.post('/api/git/branch', requireConfirmation, async (req, res) => {
  try {
    const { branch } = req.body as { branch?: string };
    const root = await activeProjectInput();
    return res.json({
      ok: true,
      data: createGitBranch(root, branch || ''),
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao criar branch',
    });
  }
});

app.post('/api/git/commit-message', async (_req, res) => {
  try {
    const root = await activeProjectInput();
    return res.json({
      ok: true,
      data: {
        message: generateCommitMessage(root),
      },
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao gerar mensagem de commit',
    });
  }
});

app.post('/api/git/commit', requireConfirmation, async (req, res) => {
  try {
    const { message } = req.body as { message?: string };
    const root = await activeProjectInput();
    return res.json({
      ok: true,
      data: createGitCommit(root, message || ''),
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha ao criar commit',
    });
  }
});

// ── AI Settings endpoints ────────────────────────────────────────────────
app.get('/api/ai/settings', async (_req, res) => {
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
      providers: status,
    });
  } catch (err) {
    return res
      .status(500)
      .json({
        ok: false,
        error: err instanceof Error ? err.message : 'Falha ao carregar settings de IA',
      });
  }
});

app.post('/api/ai/settings', async (req, res) => {
  try {
    await saveAISettings(req.body);
    const status = await getProviderStatus();
    const settings = await loadAISettings();
    return res.json({
      ok: true,
      mode: settings.mode,
      provider: settings.provider,
      providers: status,
    });
  } catch (err) {
    return res
      .status(400)
      .json({
        ok: false,
        error: err instanceof Error ? err.message : 'Falha ao salvar settings de IA',
      });
  }
});

app.post('/api/ai/test-provider', aiRateLimiter, async (req, res) => {
  const provider = String(req.body?.provider ?? '').trim();
  const allowedProviders = [
    'anthropic',
    'openai',
    'gemini',
    'groq',
    'openrouter',
    'ollama',
    'nexuslocal',
  ] as const;
  if (!allowedProviders.includes(provider as (typeof allowedProviders)[number])) {
    return res.status(400).json({ ok: false, error: 'provider inválido' });
  }

  try {
    const { AIProviderRouter } = await import('./app/ai/provider-router.js');
    const router = new AIProviderRouter();
    const result = await router.routeChatRequest({
      messages: [{ role: 'user', content: 'Responda apenas: ok' }],
      context: '',
      goal: 'Responda apenas: ok',
      allowPremium: true,
      forceProvider: provider as ProviderName,
      forceLocal: provider === 'ollama' || provider === 'nexuslocal',
    });
    return res.json({
      ok: result.ok,
      provider: result.provider,
      model: result.model,
      message: result.ok ? 'Conexão funcionando.' : result.message,
    });
  } catch (err) {
    return res
      .status(400)
      .json({ ok: false, error: err instanceof Error ? err.message : 'Teste falhou' });
  }
});

app.post('/api/smart-orchestrate', aiRateLimiter, async (req, res) => {
  const { prompt, context, language } = parsePromptBody(req);
  const { sessionId } = req.body as { sessionId?: string };

  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'prompt e obrigatorio' });
  }

  const decision = selectOrchestrationMode(prompt.trim(), context);

  // For high cost, just return the decision so UI can ask for confirmation
  const needsConfirm = decision.estimated_cost_level === 'high';

  try {
    const session = sessionId ? await getSession(sessionId) : await createSession(prompt.trim());
    if (!session) {
      return res.status(404).json({ error: 'Sessao nao encontrada' });
    }

    return res.json({
      ok: true,
      session_id: session.id,
      decision,
      needs_confirmation: needsConfirm,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha no smart orchestrate',
    });
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Error handling middleware
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Unhandled Server Error]', err);
  res.status(500).json({
    ok: false,
    error: err instanceof Error ? err.message : 'Erro interno do servidor',
  });
});

export { app };

async function validateAnthropicModel() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  if (!apiKey) return;

  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });
    if (!res.ok) {
      console.warn(
        `[Startup] Alerta: Não foi possível validar o modelo Anthropic. API retornou status ${res.status}`,
      );
      return;
    }
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const models = data.data || [];
    const exists = models.some((m) => m.id === model);
    if (!exists) {
      console.warn(
        `[Startup] AVISO: O modelo Anthropic configurado "${model}" não foi encontrado na lista de modelos disponíveis na API.`,
      );
    } else {
      console.log(`[Startup] Modelo Anthropic "${model}" validado com sucesso.`);
    }
  } catch (err) {
    console.warn(
      '[Startup] Alerta: Falha ao validar modelo Anthropic na API:',
      err instanceof Error ? err.message : err,
    );
  }
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  app.listen(port, host, () => {
    console.log(`Nexus IDE rodando em http://${host}:${port}`);
    validateAnthropicModel().catch((err) => {
      console.warn('[Startup] Falha silenciosa na inicializacao da validacao:', err);
    });
  });
}
