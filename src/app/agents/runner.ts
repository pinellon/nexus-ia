import { randomUUID } from 'node:crypto';

import {
  projectFileExists,
  readProjectFile,
  resolveProjectRoot,
} from '../../project-file-store.js';
import type {
  AgentArtifact,
  AgentDefinition,
  AgentEvent,
  AgentRun,
  AgentRunStatus,
  AgentStep,
  ToolName,
  ToolResult,
} from './models.js';
import { agentRegistry } from './registry.js';
import { ArtifactStore } from './artifacts.js';
import { ProjectHistoryManager } from './history.js';
import { toolRegistry } from './tools.js';
import { nowIso } from './utils.js';
import { AIProviderRouter } from '../ai/provider-router.js';
import {
  buildProfessionalFallbackContent,
  defaultPathForAgent,
  detectProjectStack,
  generateCodeWithLLM,
  languageForPath,
} from './code-generation.js';
import { extractRequestedFilePath, isCodeCreationGoal, shouldRequirePlan } from './routing.js';
import { agentRunStore } from '../runs/run-store.js';
import { runEventBus } from '../runs/run-event-bus.js';
import { addStagedFile } from '../web/staged-files.js';

function matchGoal(goal: string, terms: string[]) {
  const lowered = goal.toLowerCase();
  return terms.some((term) => lowered.includes(term));
}

function buildRequestedFileContent(run: AgentRun, targetPath: string) {
  return buildProfessionalFallbackContent({
    goal: run.userGoal,
    targetPath,
    projectRoot: run.projectRoot,
    agentId: run.agentId,
  });
}

const GENERATED_README_DRAFT_PATH = 'docs/drafts/readme-draft.md';

function getGeneratedDocsDraftPath(data: unknown) {
  if (
    data &&
    typeof data === 'object' &&
    'readmePath' in data &&
    typeof (data as { readmePath?: unknown }).readmePath === 'string'
  ) {
    return (data as { readmePath: string }).readmePath;
  }
  return GENERATED_README_DRAFT_PATH;
}

function createPlanMarkdown(agent: AgentDefinition, run: AgentRun, historySummary?: string | null) {
  const planItems = [
    `1. Mapear o projeto em \`${run.projectRoot}\` com ferramentas permitidas do ${agent.name}.`,
    '2. Coletar sinais objetivos do objetivo pedido pelo usuario.',
    '3. Gerar artefatos revisaveis sem aplicar mudancas automaticamente.',
    '4. Se houver patch, enviar para Patch Review com aprovacao explicita.',
  ];

  return `# Plano do agente

- Agente: ${agent.name}
- Objetivo: ${run.userGoal}
- Risco: ${agent.riskLevel}
- Ferramentas permitidas: ${agent.allowedTools.join(', ')}

## Passos
${planItems.join('\n')}

${historySummary ? `## Contexto recente do projeto\n${historySummary}\n` : ''}
`;
}

export class AgentRunner {
  private readonly artifactStore = new ArtifactStore();
  private readonly history = new ProjectHistoryManager();
  private readonly runStore = agentRunStore;
  private readonly runs = new Map<string, AgentRun>();
  private readonly events = new Map<string, AgentEvent[]>();
  private readonly artifacts = new Map<string, AgentArtifact[]>();
  private readonly ready: Promise<void>;

  constructor() {
    this.ready = this.restorePersistedRuns().catch((error) => {
      console.warn(
        '[runs:boot]',
        error instanceof Error ? error.message : 'Falha ao restaurar runs',
      );
    });
  }

  private async restorePersistedRuns() {
    await this.runStore.markInterruptedRunsOnBoot();
    const restored = await this.runStore.loadRunSnapshots();
    for (const run of restored.runs) {
      if (this.runs.has(run.id)) {
        continue;
      }
      this.runs.set(run.id, run);
      this.events.set(run.id, restored.events.get(run.id) ?? []);
      this.artifacts.set(run.id, await this.artifactStore.listArtifacts(run.projectId, run.id));
    }
  }

  async run_agent(agentId: string, userGoal: string, projectRoot: string): Promise<AgentRun> {
    await this.ready;
    const agent = agentRegistry.get(agentId);
    if (!agent) {
      throw new Error(`Agente nao encontrado: ${agentId}`);
    }

    const normalizedGoal = String(userGoal || '').trim();
    if (!normalizedGoal) {
      throw new Error('goal e obrigatorio');
    }

    const resolved = resolveProjectRoot(projectRoot);
    const runId = randomUUID();
    const run: AgentRun = {
      id: runId,
      agentId: agent.id,
      userGoal: normalizedGoal,
      projectRoot: resolved.absoluteRoot,
      projectId: resolved.projectId,
      status: 'started',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      currentMessage: 'Run criada',
      cancelRequested: false,
      steps: [],
    };

    this.runs.set(runId, run);
    this.events.set(runId, []);
    this.artifacts.set(runId, []);
    await this.runStore.recordRunStarted(run);
    await this.emitEvent(
      run,
      'started',
      `Agente ${agent.name} iniciado para ${resolved.absoluteRoot}`,
    );
    await this.history.add_message(run.projectId, 'user', normalizedGoal, {
      agentId: agent.id,
      runId,
    });

    void this.executeRun(agent, run).catch(async (error) => {
      if (run.status === 'cancelled') {
        return;
      }
      await this.failRun(run, error instanceof Error ? error.message : 'Falha ao executar agente');
    });

    return run;
  }

  getRun(runId: string) {
    return this.runs.get(runId) ?? null;
  }

  listRuns(filter?: { status?: AgentRunStatus; agentId?: string }) {
    return Array.from(this.runs.values())
      .filter((run) => !filter?.status || run.status === filter.status)
      .filter((run) => !filter?.agentId || run.agentId === filter.agentId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  getEvents(runId: string) {
    return this.events.get(runId) ?? [];
  }

  getArtifacts(runId: string) {
    return this.artifacts.get(runId) ?? [];
  }

  async cancelRun(runId: string) {
    const run = this.getRun(runId);
    if (!run) {
      return null;
    }

    run.cancelRequested = true;
    run.updatedAt = nowIso();
    run.currentMessage = 'Cancelamento solicitado';

    if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
      return run;
    }

    run.status = 'cancelled';
    await this.runStore.recordRunStatus(run.id, run.status);
    await this.emitEvent(run, 'cancelled', 'Execucao cancelada pelo usuario', 'warning');
    await this.history.add_message(run.projectId, 'system', `Run ${run.id} cancelada`, {
      runId: run.id,
    });
    return run;
  }

  private async executeRun(agent: AgentDefinition, run: AgentRun) {
    await this.updateRun(run, 'planning', 'Montando plano do agente');
    await this.emitEvent(run, 'planning', 'Agente elaborando plano inicial');

    const historySummary = await this.history.summarize_if_needed(run.projectId);
    const planArtifact = await this.recordArtifact(run, {
      type: 'plan',
      title: `${agent.name} plan`,
      summary: 'Plano inicial do agente',
      content: createPlanMarkdown(agent, run, historySummary?.summary ?? null),
    });

    this.pushStep(run, {
      title: 'Plano criado',
      kind: 'plan',
      status: 'completed',
      startedAt: planArtifact.createdAt,
      completedAt: planArtifact.createdAt,
      artifactId: planArtifact.id,
    });

    await this.updateRun(run, 'running', 'Executando ferramentas');
    await this.emitEvent(run, 'running', 'Executando tarefa');
    const approvalRequested = await this.executeScenario(agent, run);

    if (run.cancelRequested || run.status === 'cancelled') {
      return;
    }

    if (approvalRequested) {
      run.status = 'needs_approval';
      run.updatedAt = nowIso();
      run.currentMessage = 'Artefatos e patches aguardando revisao do usuario';
      await this.runStore.recordRunStatus(run.id, run.status);
      if (!this.events.get(run.id)?.some((event) => event.type === 'needs_approval')) {
        await this.emitEvent(run, 'needs_approval', 'Aguardando revisao do usuario', 'warning');
      }
      return;
    }

    run.status = 'completed';
    run.updatedAt = nowIso();
    run.currentMessage = 'Execucao concluida';
    await this.runStore.recordRunStatus(run.id, run.status);
    await this.emitEvent(run, 'completed', 'Agente concluiu a execucao');
    await this.history.add_message(
      run.projectId,
      'assistant',
      `Run ${run.id} concluida pelo agente ${agent.id}`,
      {
        runId: run.id,
      },
    );
  }

  private async executeScenario(agent: AgentDefinition, run: AgentRun) {
    await this.runTool(agent, run, 'read_project_tree', {});

    switch (agent.id) {
      case 'docs_agent':
        return this.executeDocsScenario(agent, run);
      case 'security_agent':
        return this.executeSecurityScenario(agent, run);
      case 'test_agent':
        return this.executeTestScenario(agent, run);
      case 'debug_agent':
        return this.executeDebugScenario(agent, run);
      case 'site_builder_agent':
        return this.executeSiteBuilderScenario(agent, run);
      case 'backend_agent':
      case 'ui_agent':
      case 'refactor_agent':
        return this.executeCodeAgentScenario(agent, run);
      default:
        return isCodeCreationGoal(run.userGoal)
          ? this.executeCodeAgentScenario(agent, run)
          : this.executeGeneralScenario(agent, run);
    }
  }

  private async executeCodeAgentScenario(agent: AgentDefinition, run: AgentRun): Promise<boolean> {
    if (!isCodeCreationGoal(run.userGoal)) {
      return this.executeGeneralScenario(agent, run);
    }

    if (run.userGoal.includes('++CONFIRM_PLAN++')) {
      return this.executeCodegenFlow(
        agent,
        run,
        run.userGoal.replace('++CONFIRM_PLAN++', '').trim(),
      );
    }

    if (shouldRequirePlan(run.userGoal)) {
      return this.proposePlanPatch(agent, run, run.userGoal);
    }

    return this.executeCodegenFlow(agent, run, run.userGoal);
  }

  private async proposePlanPatch(
    agent: AgentDefinition,
    run: AgentRun,
    goal: string,
  ): Promise<boolean> {
    await this.emitEvent(run, 'planning', 'Gerando plano de execucao...');
    const planRouter = new AIProviderRouter();
    const planRes = await planRouter.routeChatRequest({
      messages: [
        {
          role: 'user',
          content: `Crie um plano curto (max 6 linhas) para: "${goal}". Liste arquivos e estilo visual.`,
        },
      ],
      context: 'Planejador Nexus Codex',
      goal,
    });

    await this.runTool(agent, run, 'propose_patch', {
      path: 'Plano de Criacao',
      updatedContent: planRes.response || 'Plano indisponivel.',
      reason: '++PLAN_PROPOSAL++',
    });
    return true;
  }

  private async executeCodegenFlow(
    agent: AgentDefinition,
    run: AgentRun,
    goal: string,
  ): Promise<boolean> {
    await this.emitEvent(run, 'planning', 'Gerando codigo com IA...');

    let path: string;
    let content: string;
    let stack: Awaited<ReturnType<typeof detectProjectStack>>;
    let provider = 'fallback';
    let model: string | null = null;

    try {
      const generated = await generateCodeWithLLM({ agent, run, goal });
      path = generated.path;
      content = generated.content;
      stack = generated.stack;
      provider = generated.provider;
      model = generated.model;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stack = await detectProjectStack(run.projectRoot);
      path = extractRequestedFilePath(goal) || defaultPathForAgent(agent.id, stack);
      content = buildRequestedFileContent(run, path);
      try {
        const baselineContent = (await projectFileExists(run.projectRoot, path))
          ? (await readProjectFile(run.projectRoot, path)).content
          : null;
        await addStagedFile({
          projectRoot: run.projectRoot,
          path,
          language: languageForPath(path),
          content,
          baselineContent,
          source: agent.id,
          run_id: run.id,
        });
      } catch (stageError) {
        await this.emitEvent(
          run,
          'tool_result',
          `Fallback gerado, mas o preview staged nao foi salvo: ${stageError instanceof Error ? stageError.message : String(stageError)}`,
          'warning',
        );
      }
      await this.emitEvent(
        run,
        'tool_result',
        `IA indisponivel (${message.slice(0, 160)}). Foi criado um fallback local contextual para revisao. Para resultado mais inteligente, inicie Ollama/NexusAI local ou configure um provider em Configuracoes > IA.`,
        'warning',
      );
    }
    const fileExt = path.split('.').pop() || '';

    await this.emitEvent(run, 'file_created', `Arquivo em staging: ${path}`, 'info', {
      path,
      provider,
      model,
    });

    if (fileExt === 'html') {
      await this.emitEvent(run, 'preview_ready', `Preview disponivel para ${path}`, 'info', {
        path,
        url: `/preview/staged/${run.id}/index.html`,
      });
    }

    const patchResult = await this.runTool(agent, run, 'propose_patch', {
      path,
      updatedContent: content,
      reason: `Codigo gerado por ${agent.name} (${stack.name}) para: ${goal}`,
    });

    return Boolean(patchResult.requiresApproval);
  }

  private async executeDocsScenario(agent: AgentDefinition, run: AgentRun) {
    const requestedFilePath = extractRequestedFilePath(run.userGoal);
    if (requestedFilePath) {
      const patchResult = await this.runTool(agent, run, 'propose_patch', {
        path: requestedFilePath,
        updatedContent: buildRequestedFileContent(run, requestedFilePath),
        reason: `Arquivo de documentacao solicitado pelo usuario via ${agent.name}`,
      });
      return Boolean(patchResult.requiresApproval);
    }

    const generated = await this.runTool(agent, run, 'generate_readme', {});
    const content = typeof generated.data?.content === 'string' ? generated.data.content : '';
    if (!content) {
      return false;
    }

    const patchResult = await this.runTool(agent, run, 'propose_patch', {
      path: getGeneratedDocsDraftPath(generated.data),
      updatedContent: content,
      reason: `Rascunho de documentacao proposto a partir do objetivo: ${run.userGoal}`,
    });

    return Boolean(patchResult.requiresApproval);
  }

  private async executeSecurityScenario(agent: AgentDefinition, run: AgentRun) {
    const queries = ['process.env', 'eval(', 'innerHTML', 'child_process', 'exec('];
    const findings: string[] = [];

    for (const query of queries) {
      const result = await this.runTool(agent, run, 'search_files', { query });
      const matches = Array.isArray(result.data?.matches) ? result.data.matches : [];
      if (matches.length) {
        findings.push(`- ${query}: ${matches.length} ocorrencia(s)`);
      }
    }

    await this.recordArtifact(run, {
      type: 'security_report',
      title: 'Security review',
      summary: findings.length
        ? 'Sinais que merecem revisao manual'
        : 'Nenhum sinal heuristico encontrado',
      content: findings.length
        ? findings.join('\n')
        : 'Nenhum padrao heuristico suspeito encontrado nesta rodada.',
    });
    return false;
  }

  private async executeTestScenario(agent: AgentDefinition, run: AgentRun) {
    const testResult = await this.runTool(agent, run, 'run_tests', {});
    if (!testResult.ok && testResult.error) {
      await this.runTool(agent, run, 'analyze_error', { error: testResult.error });
    }

    if (matchGoal(run.userGoal, ['build', 'compil', 'bundle', 'tsc'])) {
      const buildResult = await this.runTool(agent, run, 'run_build', {});
      if (!buildResult.ok && buildResult.error) {
        await this.runTool(agent, run, 'analyze_error', { error: buildResult.error });
      }
    }

    return false;
  }

  private async executeDebugScenario(agent: AgentDefinition, run: AgentRun) {
    const prefersBuild = matchGoal(run.userGoal, ['build', 'compil', 'bundle', 'typecheck', 'tsc']);
    const primary = await this.runTool(agent, run, prefersBuild ? 'run_build' : 'run_tests', {});

    if (primary.error) {
      await this.runTool(agent, run, 'analyze_error', { error: primary.error });
    }

    if (matchGoal(run.userGoal, ['readme', 'docs'])) {
      const readme = await this.runTool(agent, run, 'generate_readme', {});
      if (typeof readme.data?.content === 'string') {
        const patchResult = await this.runTool(agent, run, 'propose_patch', {
          path: getGeneratedDocsDraftPath(readme.data),
          updatedContent: readme.data.content,
          reason:
            'Rascunho de documentacao proposto pelo debug agent para documentar correcao ou contexto',
        });
        return Boolean(patchResult.requiresApproval);
      }
    }

    return false;
  }

  private async executeGeneralScenario(agent: AgentDefinition, run: AgentRun): Promise<boolean> {
    const requestedFilePath = extractRequestedFilePath(run.userGoal);
    if (requestedFilePath) {
      return this.executeCodegenFlow(agent, run, run.userGoal);
    }

    if (matchGoal(run.userGoal, ['readme', 'docs', 'document'])) {
      const generated = await this.runTool(agent, run, 'generate_readme', {});
      const content = typeof generated.data?.content === 'string' ? generated.data.content : '';
      if (content) {
        const patchResult = await this.runTool(agent, run, 'propose_patch', {
          path: getGeneratedDocsDraftPath(generated.data),
          updatedContent: content,
          reason: `Draft de documentacao proposto por ${agent.name}`,
        });
        return Boolean(patchResult.requiresApproval);
      }
    }

    const keyword = run.userGoal
      .split(/\s+/)
      .map((part) => part.replace(/[^\p{L}\p{N}_-]/gu, ''))
      .find((part) => part.length >= 4);
    if (keyword) {
      await this.runTool(agent, run, 'search_files', { query: keyword });
    }

    if (matchGoal(run.userGoal, ['build', 'typecheck'])) {
      await this.runTool(agent, run, 'run_build', {});
    }

    return false;
  }

  private async executeSiteBuilderScenario(agent: AgentDefinition, run: AgentRun) {
    return this.executeCodeAgentScenario(agent, run);
  }

  private async runTool(
    agent: AgentDefinition,
    run: AgentRun,
    toolName: ToolName,
    input: Record<string, unknown>,
  ) {
    this.ensureNotCancelled(run);
    if (toolName === 'read_project_tree') {
      await this.emitEvent(run, 'reading_project', 'Lendo a estrutura real do projeto');
    }
    const toolCall = toolRegistry.createToolCall(toolName, input);
    this.pushStep(run, {
      title: `Tool: ${toolName}`,
      kind: 'tool',
      status: 'running',
      startedAt: toolCall.startedAt,
      toolCallId: toolCall.id,
      detail: JSON.stringify(input),
    });

    await this.emitEvent(run, 'tool_call', `Executando ${toolName}`, 'info', {
      toolCallId: toolCall.id,
      input,
    });

    try {
      const result = await toolRegistry.execute(toolName, input, {
        agent,
        run,
        artifactStore: this.artifactStore,
        history: this.history,
      });

      if (result.artifactIds?.length) {
        const storedArtifacts = await this.artifactStore.listArtifacts(run.projectId, run.id);
        const runArtifacts = this.artifacts.get(run.id) ?? [];
        const knownIds = new Set(runArtifacts.map((item) => item.id));
        for (const artifact of storedArtifacts) {
          if (!knownIds.has(artifact.id)) {
            runArtifacts.unshift(artifact);
            knownIds.add(artifact.id);
          }
        }
        this.artifacts.set(run.id, runArtifacts);
      }

      toolCall.status = result.requiresApproval
        ? 'needs_approval'
        : result.ok
          ? 'completed'
          : 'failed';
      toolCall.completedAt = nowIso();
      toolCall.summary = result.summary;
      this.completeStep(
        run,
        toolCall.id,
        result.requiresApproval ? 'completed' : result.ok ? 'completed' : 'failed',
        result.summary,
      );

      await this.emitEvent(run, 'tool_result', result.summary, result.ok ? 'info' : 'warning', {
        toolCallId: toolCall.id,
        tool: toolName,
        ok: result.ok,
      });

      for (const artifactId of result.artifactIds ?? []) {
        const artifact = this.artifacts.get(run.id)?.find((item) => item.id === artifactId);
        if (artifact) {
          await this.emitEvent(
            run,
            'artifact_created',
            `${artifact.type}: ${artifact.title}`,
            'info',
            {
              artifactId: artifact.id,
              type: artifact.type,
            },
          );
        }
      }

      if (result.requiresApproval) {
        if (toolName === 'propose_patch') {
          await this.emitEvent(run, 'patch_created', `Patch criado e pronto para revisao`, 'info', {
            actionIds: result.actionIds ?? [],
          });
        }
        await this.emitEvent(
          run,
          'needs_approval',
          `A revisao do usuario e necessaria apos ${toolName}`,
          'warning',
          {
            toolCallId: toolCall.id,
            actionIds: result.actionIds ?? [],
          },
        );
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao executar tool';
      this.completeStep(run, toolCall.id, 'failed', message);
      await this.emitEvent(run, 'tool_result', message, 'error', {
        toolCallId: toolCall.id,
        tool: toolName,
        ok: false,
      });
      throw error;
    }
  }

  private ensureNotCancelled(run: AgentRun) {
    if (run.cancelRequested || run.status === 'cancelled') {
      throw new Error('Execucao cancelada');
    }
  }

  private async recordArtifact(
    run: AgentRun,
    input: {
      type: AgentArtifact['type'];
      title: string;
      summary: string;
      content: string | object;
      metadata?: Record<string, unknown>;
      actionId?: string;
    },
  ) {
    const artifact = await this.artifactStore.saveArtifact({
      runId: run.id,
      projectId: run.projectId,
      ...input,
    });
    await this.history.add_artifact(run.projectId, artifact);
    const current = this.artifacts.get(run.id) ?? [];
    current.unshift(artifact);
    this.artifacts.set(run.id, current);
    return artifact;
  }

  private async emitEvent(
    run: AgentRun,
    type: AgentEvent['type'],
    message: string,
    level: AgentEvent['level'] = 'info',
    payload?: Record<string, unknown>,
  ) {
    const event: AgentEvent = {
      id: randomUUID(),
      runId: run.id,
      type,
      createdAt: nowIso(),
      message,
      level,
      payload,
    };

    const events = this.events.get(run.id) ?? [];
    events.push(event);
    this.events.set(run.id, events);
    run.updatedAt = event.createdAt;
    run.currentMessage = message;
    await this.runStore.recordRunEvent(event);
    runEventBus.publish(run.id, event);
    return event;
  }

  private pushStep(run: AgentRun, step: Omit<AgentStep, 'id'>) {
    run.steps.push({
      id: randomUUID(),
      ...step,
    });
    run.updatedAt = nowIso();
  }

  private completeStep(
    run: AgentRun,
    toolCallId: string,
    status: AgentStep['status'],
    detail: string,
  ) {
    const step = [...run.steps].reverse().find((item) => item.toolCallId === toolCallId);
    if (!step) {
      return;
    }

    step.status = status;
    step.detail = detail;
    step.completedAt = nowIso();
    run.updatedAt = step.completedAt;
  }

  private async updateRun(run: AgentRun, status: AgentRunStatus, message: string) {
    run.status = status;
    run.updatedAt = nowIso();
    run.currentMessage = message;
    await this.runStore.recordRunStatus(run.id, status);
    await this.history.add_message(run.projectId, 'system', `${run.id}: ${message}`, {
      status,
      runId: run.id,
    });
  }

  private async failRun(run: AgentRun, message: string) {
    run.status = run.status === 'cancelled' ? 'cancelled' : 'failed';
    run.updatedAt = nowIso();
    run.currentMessage = message;
    await this.runStore.recordRunStatus(run.id, run.status);
    await this.emitEvent(run, 'failed', message, 'error');
    await this.history.add_message(run.projectId, 'system', `${run.id}: ${message}`, {
      status: run.status,
    });
  }
}

export const agentRunner = new AgentRunner();
