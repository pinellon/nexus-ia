import type { Express, Response } from "express";

import { ContextBuilder, type CodeChatMessage } from "../ai/context-builder.js";
import { AIProviderRouter } from "../ai/provider-router.js";
import { agentRegistry } from "../agents/registry.js";
import { agentRunner } from "../agents/runner.js";
import type { AgentEvent, AgentRunStatus } from "../agents/models.js";
import { runEventBus } from "../runs/run-event-bus.js";
import { addStagedFile, applyStagedFile, clearStagedFiles, getStagedFile, listStagedFiles, removeStagedFile } from "./staged-files.js";
import { aiRateLimiter } from "../../rate-limit.js";
import { suggestAgentId } from "../agents/routing.js";

const contextBuilder = new ContextBuilder();
const finalEventTypes = new Set(["completed", "failed", "cancelled", "interrupted", "needs_approval"]);

function readLatestUserMessage(messages: unknown) {
  if (!Array.isArray(messages)) {
    return "";
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index] as { role?: unknown; content?: unknown };
    if (item?.role === "user" && typeof item.content === "string") {
      return item.content.trim();
    }
  }

  return "";
}

function normalizeMessages(messages: unknown): CodeChatMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((item): item is { role: string; content: string } => {
      const candidate = item as { role?: unknown; content?: unknown };
      return (
        typeof candidate.content === "string" &&
        (candidate.role === "system" || candidate.role === "user" || candidate.role === "assistant")
      );
    })
    .map((item) => ({
      role: item.role as CodeChatMessage["role"],
      content: item.content
    }));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSettledRun(runId: string) {
  const activeStatuses = new Set<AgentRunStatus>(["started", "planning", "running"]);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const run = agentRunner.getRun(runId);
    if (!run || !activeStatuses.has(run.status)) {
      return run;
    }
    await wait(100);
  }

  return agentRunner.getRun(runId);
}

function collectPatchPaths(runId: string) {
  const paths = new Set<string>();
  for (const artifact of agentRunner.getArtifacts(runId)) {
    const path = artifact.metadata?.path;
    if (typeof path === "string" && path.trim()) {
      paths.add(path);
    }
    if (artifact.title?.includes(" for ")) {
      const fromTitle = artifact.title.split(" for ").pop()?.trim();
      if (fromTitle) paths.add(fromTitle);
    }
  }
  return Array.from(paths);
}

function collectPatchIds(runId: string) {
  const patchIds = new Set<string>();

  for (const artifact of agentRunner.getArtifacts(runId)) {
    if (artifact.actionId) {
      patchIds.add(artifact.actionId);
    }
  }

  for (const event of agentRunner.getEvents(runId)) {
    const actionIds = event.payload?.actionIds;
    if (Array.isArray(actionIds)) {
      for (const actionId of actionIds) {
        if (typeof actionId === "string") {
          patchIds.add(actionId);
        }
      }
    }
  }

  return Array.from(patchIds);
}

function collectPreviewUrl(runId: string) {
  for (const event of agentRunner.getEvents(runId).slice().reverse()) {
    if (event.type === "preview_ready" && typeof event.payload?.url === "string") {
      return event.payload.url;
    }
  }
  return null;
}

function buildNextActions(patchIds: string[]) {
  return [
    ...(patchIds.length
      ? [{ id: "open_patches", label: "Abrir Patch Review", type: "view", value: "patches" }]
      : []),
    { id: "run_build", label: "Rodar build", type: "command", value: "npm run build" },
    { id: "open_project", label: "Abrir projeto", type: "view", value: "project" },
    { id: "open_artifacts", label: "Ver artefatos", type: "view", value: "agents" }
  ];
}

function writeSseEvent(res: Response, eventName: string, data: unknown) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function serializeAgentEvent(event: AgentEvent) {
  return {
    runId: event.runId,
    type: event.type,
    message: event.message,
    level: event.level,
    createdAt: event.createdAt,
    payload: event.payload ?? {}
  };
}

function isFinalAgentEvent(event: AgentEvent) {
  return finalEventTypes.has(event.type);
}

export function registerAgentRoutes(app: Express) {
  app.get("/api/ai/status", async (_req, res) => {
    try {
      const router = new AIProviderRouter();
      return res.json({
        ok: true,
        data: await router.getStatus()
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao carregar status de IA"
      });
    }
  });

  app.post("/api/code-chat", aiRateLimiter, async (req, res) => {
    const { messages, streaming, allow_premium, force_local, project_context } = req.body as {
      messages?: unknown;
      streaming?: boolean;
      allow_premium?: boolean;
      force_local?: boolean;
      project_context?: unknown;
    };
    const normalizedMessages = normalizeMessages(messages);
    const goal = readLatestUserMessage(normalizedMessages);

    if (!goal) {
      return res.status(400).json({ ok: false, error: "messages precisa conter uma mensagem de usuario" });
    }

    try {
      const context = await contextBuilder.buildContext({
        messages: normalizedMessages,
        projectRoot: ".",
        extraContext: typeof project_context === "string" ? project_context : ""
      });
      const uiContext = typeof project_context === "string" ? project_context.slice(0, 10_000) : "";
      const routedContext = uiContext
        ? `${context.content}\n\nContexto atual da IDE:\n${uiContext}`
        : context.content;
      const aiRouter = new AIProviderRouter();
      const aiDecision = await aiRouter.routeChatRequest({
        messages: normalizedMessages,
        context: routedContext,
        goal,
        allowPremium: Boolean(allow_premium),
        forceLocal: Boolean(force_local)
      });

      if (aiDecision.requires_premium_confirmation) {
        return res.json({
          ok: true,
          message: aiDecision.message,
          executed: false,
          streaming: Boolean(streaming),
          run_id: null,
          agent_id: null,
          status: "needs_premium_confirmation",
          patch_ids: [],
          artifacts: [],
          next_actions: [
            { id: "use_premium", label: "Usar premium", type: "premium", value: "allow" },
            { id: "try_local", label: "Tentar local", type: "premium", value: "local" },
            { id: "cancel_premium", label: "Cancelar", type: "premium", value: "cancel" }
          ],
          ai: {
            mode: aiDecision.mode,
            provider: aiDecision.provider,
            model: aiDecision.model,
            task_type: aiDecision.task_type,
            requires_premium_confirmation: true
          },
          context: {
            project_id: context.projectId,
            selected_files: context.selectedFiles,
            input_tokens_estimate: context.inputTokensEstimate
          }
        });
      }

      const agentId = suggestAgentId(goal);
      const agentGoal = uiContext ? `${goal}\n\nContexto atual da IDE:\n${uiContext}` : goal;
      const run = await agentRunner.run_agent(agentId, agentGoal, ".");
      const settledRun = await waitForSettledRun(run.id);
      const artifacts = agentRunner.getArtifacts(run.id);
      const patchIds = collectPatchIds(run.id);
      const patchPaths = collectPatchPaths(run.id);
      const previewUrl = collectPreviewUrl(run.id);
      const agentMessage = patchIds.length
        ? "Criei uma execucao de agente e preparei patch para revisao."
        : "Criei uma execucao de agente para analisar o pedido.";
      const providerNote = aiDecision.warning
        ? `\n\nNota de IA: ${aiDecision.message}`
        : aiDecision.response
          ? `\n\nMotor ${aiDecision.provider}: ${aiDecision.response.slice(0, 700)}`
          : "";

      return res.status(202).json({
        ok: true,
        message: `${agentMessage}${providerNote}`,
        executed: false,
        streaming: Boolean(streaming),
        run_id: run.id,
        agent_id: agentId,
        status: settledRun?.status ?? run.status,
        patch_ids: patchIds,
        patch_paths: patchPaths,
        preview_url: previewUrl,
        artifacts: artifacts.map((artifact) => ({
          id: artifact.id,
          type: artifact.type,
          title: artifact.title,
          summary: artifact.summary,
          action_id: artifact.actionId ?? null
        })),
        next_actions: buildNextActions(patchIds)
          .concat(previewUrl ? [{ id: "open_preview", label: "Abrir preview", type: "preview", value: previewUrl }] : [])
          .concat(aiDecision.warning ? [{ id: "open_ai_settings", label: "Configurar IA", type: "view", value: "settings" }] : []),
        ai: {
          mode: aiDecision.mode,
          provider: aiDecision.provider,
          model: aiDecision.model,
          task_type: aiDecision.task_type,
          requires_premium_confirmation: false,
          warning: aiDecision.warning,
          usage: aiDecision.usage
        },
        context: {
          project_id: context.projectId,
          selected_files: context.selectedFiles,
          input_tokens_estimate: context.inputTokensEstimate
        }
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao executar Code Chat"
      });
    }
  });

  app.get("/api/staged-files", async (req, res) => {
    return res.json({ ok: true, data: await listStagedFiles() });
  });

  app.get("/api/staged-files/:id", async (req, res) => {
    const file = await getStagedFile(req.params.id);
    if (!file) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, data: file });
  });

  app.post("/api/staged-files/:id/apply", async (req, res) => {
    try {
      const file = await applyStagedFile(".", req.params.id);
      return res.json({ ok: true, data: file });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/staged-files/:id/reject", async (req, res) => {
    await removeStagedFile(req.params.id);
    return res.json({ ok: true });
  });

  app.post("/api/staged-files/:id/restore", async (req, res) => {
    try {
      const file = await getStagedFile(req.params.id);
      if (!file) return res.status(404).json({ ok: false, error: "Not found" });
      const { version_id } = req.body as { version_id?: string };
      const version = file.versions.find(v => v.version_id === version_id);
      if (!version) return res.status(404).json({ ok: false, error: "Version not found" });
      
      const updated = await addStagedFile({
        path: file.path,
        language: file.language,
        content: version.content,
        source: file.source,
        run_id: file.run_id
      });
      return res.json({ ok: true, data: updated });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/staged-files/clear", async (req, res) => {
    await clearStagedFiles();
    return res.json({ ok: true });
  });

  app.get("/preview/staged/:runId/index.html", async (req, res) => {
    const list = await listStagedFiles();
    const files = list.filter(f => f.run_id === req.params.runId && f.path.endsWith("index.html"));
    if (!files.length) return res.status(404).send("Preview indisponivel ou arquivo nao gerado ainda.");
    res.setHeader("Content-Type", "text/html");
    return res.send(files[0].content);
  });

  app.get("/api/agents", (_req, res) => {
    res.json({
      ok: true,
      data: agentRegistry.list()
    });
  });

  app.post("/api/agents/run", aiRateLimiter, async (req, res) => {
    const { agent_id, goal, project_root } = req.body as {
      agent_id?: string;
      goal?: string;
      project_root?: string;
    };

    if (!goal?.trim()) {
      return res.status(400).json({ ok: false, error: "goal e obrigatorio" });
    }

    try {
      const selectedAgentId = agent_id?.trim() || suggestAgentId(goal.trim());
      const run = await agentRunner.run_agent(selectedAgentId, goal.trim(), project_root?.trim() || ".");
      return res.status(202).json({
        ok: true,
        run_id: run.id,
        agent_id: selectedAgentId,
        status: "started"
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao iniciar agente"
      });
    }
  });

  app.get("/api/agents/runs/:runId", (req, res) => {
    const run = agentRunner.getRun(req.params.runId);
    if (!run) {
      return res.status(404).json({ ok: false, error: "run nao encontrada" });
    }

    return res.json({
      ok: true,
      data: run
    });
  });

  app.post("/api/agents/runs/:runId/cancel", async (req, res) => {
    const run = await agentRunner.cancelRun(req.params.runId);
    if (!run) {
      return res.status(404).json({ ok: false, error: "run nao encontrada" });
    }

    return res.json({
      ok: true,
      data: {
        run_id: run.id,
        status: run.status
      }
    });
  });

  app.get("/api/agents/runs/:runId/events", (req, res) => {
    const run = agentRunner.getRun(req.params.runId);
    if (!run) {
      return res.status(404).json({ ok: false, error: "run nao encontrada" });
    }

    return res.json({
      ok: true,
      data: agentRunner.getEvents(req.params.runId)
    });
  });

  app.get("/api/agents/runs/:runId/events/stream", (req, res) => {
    const runId = req.params.runId;
    const run = agentRunner.getRun(runId);
    if (!run) {
      return res.status(404).json({ ok: false, error: "run nao encontrada" });
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders?.();

    let closed = false;
    let unsubscribe = () => {};
    let heartbeat: ReturnType<typeof setInterval>;

    const close = () => {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
      res.end();
    };

    const listener = (event: AgentEvent) => {
      if (closed) return;
      writeSseEvent(res, "agent_event", serializeAgentEvent(event));
      if (isFinalAgentEvent(event)) {
        close();
      }
    };

    unsubscribe = runEventBus.subscribe(runId, listener);
    heartbeat = setInterval(() => {
      if (!closed) {
        writeSseEvent(res, "heartbeat", {
          runId,
          createdAt: new Date().toISOString()
        });
      }
    }, 15_000);

    req.on("close", close);

    for (const event of agentRunner.getEvents(runId)) {
      listener(event);
      if (closed) return;
    }

    if (finalEventTypes.has(run.status)) {
      close();
    }
  });

  app.get("/api/agents/runs/:runId/artifacts", (req, res) => {
    const run = agentRunner.getRun(req.params.runId);
    if (!run) {
      return res.status(404).json({ ok: false, error: "run nao encontrada" });
    }

    return res.json({
      ok: true,
      data: agentRunner.getArtifacts(req.params.runId)
    });
  });
}
