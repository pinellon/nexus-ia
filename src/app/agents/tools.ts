import { randomUUID } from 'node:crypto';

import { createPendingAction } from '../../pending-actions-store.js';
import {
  listProjectFiles,
  listProjectTree,
  readProjectFile,
  resolveProjectPath,
} from '../../project-file-store.js';
import { resolveAllowedCommand, runCommand as runAllowedCommand } from '../../command-runner.js';
import type { ActionDraft } from '../../action-types.js';
import type {
  AgentArtifact,
  AgentDefinition,
  AgentRun,
  ToolCall,
  ToolName,
  ToolResult,
} from './models.js';
import { ArtifactStore } from './artifacts.js';
import { ProjectHistoryManager } from './history.js';
import { redactSensitiveText, sanitizeArtifactPreview, truncateText } from './utils.js';

interface CommandOutcome {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface ToolExecutionContext {
  agent: AgentDefinition;
  run: AgentRun;
  artifactStore: ArtifactStore;
  history: ProjectHistoryManager;
}

type ToolExecutor = (
  input: Record<string, unknown>,
  context: ToolExecutionContext,
) => Promise<ToolResult>;

const DANGEROUS_COMMAND_PATTERN =
  /\b(rm|rmdir|del|format|shutdown|reboot|mkfs|curl|wget|scp|powershell\s+-enc)\b/i;
const SHELL_METACHAR_PATTERN = /[|&<>]/;
const MAX_SEARCH_FILE_BYTES = 256 * 1024;
const MAX_SEARCH_RESULTS = 30;

function nowIso() {
  return new Date().toISOString();
}

function stringifyTree(nodes: Awaited<ReturnType<typeof listProjectTree>>, depth = 0): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    const prefix = `${'  '.repeat(depth)}- `;
    if (node.type === 'directory') {
      lines.push(`${prefix}${node.name}/`);
      lines.push(...stringifyTree(node.children ?? [], depth + 1));
      continue;
    }
    lines.push(`${prefix}${node.path}`);
  }
  return lines;
}

function buildPatchText(targetPath: string, before: string, after: string) {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  return [
    `--- a/${targetPath}`,
    `+++ b/${targetPath}`,
    '@@ before',
    ...beforeLines.map((line) => `-${line}`),
    '@@ after',
    ...afterLines.map((line) => `+${line}`),
  ].join('\n');
}

async function runToolCommand(projectRoot: string, label: string) {
  const selected = resolveAllowedCommand(label);
  if (!selected) {
    throw new Error('Comando nao permitido');
  }

  const outcome = await runAllowedCommand(selected.id, projectRoot);
  return {
    command: outcome.command,
    exitCode: outcome.exitCode,
    stdout: truncateText(redactSensitiveText(outcome.stdout), 16_000),
    stderr: truncateText(redactSensitiveText(outcome.stderr), 16_000),
    durationMs: outcome.durationMs,
  };
}

async function saveArtifact(
  context: ToolExecutionContext,
  input: {
    type: AgentArtifact['type'];
    title: string;
    summary: string;
    content: string | object;
    metadata?: Record<string, unknown>;
    actionId?: string;
  },
) {
  const artifact = await context.artifactStore.saveArtifact({
    runId: context.run.id,
    projectId: context.run.projectId,
    ...input,
  });
  await context.history.add_artifact(context.run.projectId, artifact);
  return artifact;
}

async function createPatchAction(context: ToolExecutionContext, action: Record<string, unknown>) {
  return createPendingAction(context.run.id, {
    ...(action as ActionDraft),
    sessionId: context.run.id,
    goal: context.run.userGoal,
  } as ActionDraft);
}

async function executeReadProjectTree(
  _input: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const tree = await listProjectTree(context.run.projectRoot);
  const body = stringifyTree(tree).join('\n') || '- Projeto vazio';
  const artifact = await saveArtifact(context, {
    type: 'file_summary',
    title: 'Project tree',
    summary: 'Resumo da arvore segura do projeto',
    content: body,
    metadata: {
      projectRoot: context.run.projectRoot,
    },
  });

  return {
    ok: true,
    toolName: 'read_project_tree',
    summary: 'Arvore do projeto carregada',
    data: {
      entries: body.split('\n').length,
    },
    artifactIds: [artifact.id],
  };
}

async function executeReadFile(
  input: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const targetPath = String(input.path || '');
  if (!targetPath.trim()) {
    throw new Error('path e obrigatorio');
  }

  const file = await readProjectFile(context.run.projectRoot, targetPath);
  return {
    ok: true,
    toolName: 'read_file',
    summary: `Arquivo ${file.path} lido`,
    data: {
      path: file.path,
      preview: sanitizeArtifactPreview(file.content, 700),
    },
  };
}

async function executeSearchFiles(
  input: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const query = String(input.query || '').trim();
  if (!query) {
    throw new Error('query e obrigatoria');
  }

  const loweredQuery = query.toLowerCase();
  const files = await listProjectFiles(context.run.projectRoot);
  const results: Array<{ path: string; line: number; text: string; score: number }> = [];

  for (const file of files) {
    if (results.length >= MAX_SEARCH_RESULTS * 3) {
      break;
    }
    if (file.size > MAX_SEARCH_FILE_BYTES) {
      continue;
    }

    try {
      const content = (await readProjectFile(context.run.projectRoot, file.path)).content;
      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const column = line.toLowerCase().indexOf(loweredQuery);
        if (column >= 0) {
          const basenameScore = file.name.toLowerCase().includes(loweredQuery) ? 0 : 20;
          results.push({
            path: file.path,
            line: index + 1,
            text: truncateText(redactSensitiveText(line), 220),
            score: basenameScore + index + Math.min(column, 80) / 100,
          });
        }
        if (results.length >= MAX_SEARCH_RESULTS * 3) {
          break;
        }
      }
    } catch {
      continue;
    }
  }

  const rankedResults = results
    .sort((left, right) => left.score - right.score || left.path.localeCompare(right.path))
    .slice(0, MAX_SEARCH_RESULTS);

  const artifact = await saveArtifact(context, {
    type: 'file_summary',
    title: `Search: ${query}`,
    summary: `${rankedResults.length} correspondencias encontradas`,
    content: rankedResults.length
      ? rankedResults.map((item) => `- ${item.path}:${item.line} ${item.text}`).join('\n')
      : 'Nenhuma correspondencia encontrada',
    metadata: { query, matches: rankedResults.length },
  });

  return {
    ok: true,
    toolName: 'search_files',
    summary: `${rankedResults.length} correspondencias encontradas para "${query}"`,
    data: {
      matches: rankedResults,
    },
    artifactIds: [artifact.id],
  };
}

async function executeProposePatch(
  input: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const targetPath = String(input.path || '').trim();
  const updatedContent = typeof input.updatedContent === 'string' ? input.updatedContent : '';
  const reason = String(input.reason || 'Patch proposto pelo agente').trim();

  if (!targetPath || !updatedContent) {
    throw new Error('path e updatedContent sao obrigatorios');
  }

  let before = '';
  try {
    before = (await readProjectFile(context.run.projectRoot, targetPath)).content;
  } catch {
    before = '';
  }

  resolveProjectPath(context.run.projectRoot, targetPath);
  const patchText = buildPatchText(targetPath, before, updatedContent);

  const action =
    before.length > 0
      ? await createPatchAction(context, {
          type: 'patch_file',
          path: targetPath,
          before,
          after: updatedContent,
          reason,
          riskLevel: context.agent.riskLevel,
          requiresConfirmation: true,
          sourceAgent: context.agent.id,
          projectRoot: context.run.projectRoot,
        })
      : await createPatchAction(context, {
          type: 'create_file',
          path: targetPath,
          content: updatedContent,
          reason,
          riskLevel: context.agent.riskLevel,
          requiresConfirmation: true,
          sourceAgent: context.agent.id,
          projectRoot: context.run.projectRoot,
        });

  const patchArtifact = await saveArtifact(context, {
    type: 'patch',
    title: `Patch proposal for ${targetPath}`,
    summary: reason,
    content: patchText,
    metadata: {
      path: targetPath,
      beforeLength: before.length,
      afterLength: updatedContent.length,
    },
    actionId: action.id,
  });

  const diffArtifact = await saveArtifact(context, {
    type: 'diff',
    title: `Diff preview for ${targetPath}`,
    summary: 'Diff revisavel antes de aplicar o patch',
    content: patchText,
    metadata: { path: targetPath },
    actionId: action.id,
  });

  return {
    ok: true,
    toolName: 'propose_patch',
    summary: `Patch preparado para ${targetPath} e enviado ao Patch Review`,
    data: {
      path: targetPath,
      actionId: action.id,
    },
    requiresApproval: true,
    actionIds: [action.id],
    artifactIds: [patchArtifact.id, diffArtifact.id],
  };
}

async function executeRunTerminalCommand(
  input: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const requested = String(input.command || '').trim();
  if (!requested) {
    throw new Error('command e obrigatorio');
  }

  if (
    DANGEROUS_COMMAND_PATTERN.test(requested) ||
    SHELL_METACHAR_PATTERN.test(requested) ||
    !resolveAllowedCommand(requested)
  ) {
    return {
      ok: false,
      toolName: 'run_terminal_command',
      summary: `Comando requer confirmacao manual: ${requested}`,
      requiresApproval: true,
      error: 'Comando fora da whitelist segura',
    };
  }

  const outcome = await runToolCommand(context.run.projectRoot, requested);
  const artifact = await saveArtifact(context, {
    type: 'terminal_output',
    title: `Terminal: ${requested}`,
    summary: `Comando finalizado com exit code ${outcome.exitCode}`,
    content: `> ${outcome.command}\n\nSTDOUT:\n${outcome.stdout || '(vazio)'}\n\nSTDERR:\n${outcome.stderr || '(vazio)'}`,
    metadata: {
      exitCode: outcome.exitCode,
      durationMs: outcome.durationMs,
    },
  });

  return {
    ok: outcome.exitCode === 0,
    toolName: 'run_terminal_command',
    summary: `Comando ${requested} executado com exit code ${outcome.exitCode}`,
    data: outcome as unknown as Record<string, unknown>,
    error: outcome.exitCode === 0 ? undefined : outcome.stderr || 'Comando falhou',
    artifactIds: [artifact.id],
  };
}

async function executeRunTests(
  _input: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const terminal = await executeRunTerminalCommand({ command: 'npm test' }, context);
  const artifact = await saveArtifact(context, {
    type: 'test_result',
    title: 'Test run',
    summary: terminal.summary,
    content: {
      ok: terminal.ok,
      data: terminal.data,
      error: terminal.error,
    },
  });

  return {
    ...terminal,
    toolName: 'run_tests',
    summary: terminal.summary,
    artifactIds: [...(terminal.artifactIds ?? []), artifact.id],
  };
}

async function executeRunBuild(
  _input: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const terminal = await executeRunTerminalCommand({ command: 'npm run build' }, context);
  return {
    ...terminal,
    toolName: 'run_build',
  };
}

async function executeGitStatus(
  _input: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  return executeRunTerminalCommand({ command: 'git status' }, context).then((result) => ({
    ...result,
    toolName: 'git_status',
  }));
}

async function executeGitDiff(
  _input: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  return executeRunTerminalCommand({ command: 'git diff' }, context).then((result) => ({
    ...result,
    toolName: 'git_diff',
  }));
}

async function executeGenerateReadme(
  _input: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const files = await listProjectFiles(context.run.projectRoot);
  const packageJson = files.find((file) => file.path === 'package.json');
  const readmePath = files.find((file) => file.path.toLowerCase() === 'readme.md');
  const packageSummary = packageJson
    ? sanitizeArtifactPreview(
        (await readProjectFile(context.run.projectRoot, packageJson.path)).content,
        1_200,
      )
    : 'package.json nao encontrado';

  const treeSummary =
    files
      .slice(0, 18)
      .map((file) => `- ${file.path}`)
      .join('\n') || '- Projeto vazio';
  const draft = `# ${context.run.projectId}

## Objetivo
${context.run.userGoal}

## Visao rapida
- Projeto analisado em \`${context.run.projectRoot}\`
- Agente: ${context.agent.name}
- Ferramenta de docs do Nexus gerou este rascunho revisavel

## Estrutura principal
${treeSummary}

## Scripts ou metadados detectados
\`\`\`json
${packageSummary}
\`\`\`

## Como contribuir
1. Revise o Patch Review antes de aplicar mudancas.
2. Rode build e testes pelos comandos controlados.
3. Atualize esta documentacao junto com o comportamento do sistema.

## Limites atuais
- O draft foi gerado por heuristica local.
- Ajustes de tom e detalhes tecnicos devem ser revisados antes de aplicar.
`;

  const artifact = await saveArtifact(context, {
    type: 'docs_update',
    title: 'README draft',
    summary: 'Rascunho inicial de documentacao',
    content: draft,
    metadata: {
      currentReadme: Boolean(readmePath),
    },
  });

  return {
    ok: true,
    toolName: 'generate_readme',
    summary: 'Rascunho de README gerado',
    data: {
      readmePath: 'docs/drafts/readme-draft.md',
      content: draft,
    },
    artifactIds: [artifact.id],
  };
}

function extractFirstErrorLocation(raw: string) {
  const patterns = [
    /([A-Za-z]:[\\/][^\s:]+?\.(?:ts|tsx|js|jsx|py|css|html|json)):(\d+):(\d+)/,
    /([^\s:]+?\.(?:ts|tsx|js|jsx|py|css|html|json)):(\d+):(\d+)/,
    /([A-Za-z]:[\\/][^\s:(]+?\.(?:ts|tsx|js|jsx|py|css|html|json))\((\d+),(\d+)\)/,
    /([^\s:(]+?\.(?:ts|tsx|js|jsx|py|css|html|json))\((\d+),(\d+)\)/,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) {
      return {
        path: match[1].replace(/\\/g, '/'),
        line: Number(match[2]),
        column: Number(match[3]),
      };
    }
  }

  return null;
}

async function executeAnalyzeError(
  input: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const raw = redactSensitiveText(String(input.error || input.stderr || '').trim());
  if (!raw) {
    throw new Error('error ou stderr e obrigatorio');
  }

  const hints: string[] = [];
  const lowered = raw.toLowerCase();
  const location = extractFirstErrorLocation(raw);
  if (lowered.includes('cannot find module') || lowered.includes('module not found')) {
    hints.push('Verifique imports, aliases e dependencias nao instaladas.');
  }
  if (lowered.includes('ts') || lowered.includes('typescript') || lowered.includes('type')) {
    hints.push('Rodar typecheck pode isolar erros de tipagem antes do build completo.');
  }
  if (lowered.includes('eslint')) {
    hints.push('Separar falhas de lint das falhas de compilacao ajuda a priorizar a correcao.');
  }
  if (lowered.includes('permission') || lowered.includes('eacces')) {
    hints.push(
      'Ha sinais de permissao insuficiente; evitar retries automaticos e revisar ambiente.',
    );
  }

  const checklist = [
    location
      ? `Abrir ${location.path}:${location.line} e validar a linha indicada.`
      : 'Localizar o primeiro arquivo relevante no stack trace.',
    'Confirmar a menor mudanca necessaria antes de propor patch.',
    'Rodar build/typecheck/testes apos aplicar a correcao.',
  ];
  const suggestedTool = location ? 'read_file' : 'search_files';
  const summary = hints.length
    ? hints.join(' ')
    : 'Erro sem heuristica especifica; revisar stack trace e arquivo de origem.';
  const artifact = await saveArtifact(context, {
    type: 'file_summary',
    title: 'Error analysis',
    summary: 'Analise heuristica do erro capturado',
    content: [
      `Erro:\n${truncateText(raw, 4_000)}`,
      `\nLocal relevante:\n${location ? `${location.path}:${location.line}${location.column ? `:${location.column}` : ''}` : 'Nao identificado'}`,
      `\nHipoteses:\n- ${hints.join('\n- ') || 'Revisar manualmente o stack trace.'}`,
      `\nChecklist:\n- ${checklist.join('\n- ')}`,
      `\nProxima tool sugerida: ${suggestedTool}`,
    ].join('\n'),
  });

  return {
    ok: true,
    toolName: 'analyze_error',
    summary,
    data: {
      hints,
      excerpt: truncateText(raw, 1_200),
      location,
      checklist,
      suggestedTool,
    },
    artifactIds: [artifact.id],
  };
}

export class ToolRegistry {
  private readonly tools = new Map<ToolName, ToolExecutor>();

  constructor() {
    this.tools.set('read_project_tree', executeReadProjectTree);
    this.tools.set('read_file', executeReadFile);
    this.tools.set('search_files', executeSearchFiles);
    this.tools.set('propose_patch', executeProposePatch);
    this.tools.set('run_terminal_command', executeRunTerminalCommand);
    this.tools.set('git_status', executeGitStatus);
    this.tools.set('git_diff', executeGitDiff);
    this.tools.set('run_tests', executeRunTests);
    this.tools.set('run_build', executeRunBuild);
    this.tools.set('generate_readme', executeGenerateReadme);
    this.tools.set('analyze_error', executeAnalyzeError);
  }

  list() {
    return Array.from(this.tools.keys());
  }

  has(toolName: ToolName) {
    return this.tools.has(toolName);
  }

  async execute(toolName: ToolName, input: Record<string, unknown>, context: ToolExecutionContext) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool nao registrada: ${toolName}`);
    }

    if (!context.agent.allowedTools.includes(toolName)) {
      throw new Error(`Tool ${toolName} nao permitida para ${context.agent.id}`);
    }

    return tool(input, context);
  }

  createToolCall(toolName: ToolName, input: Record<string, unknown>): ToolCall {
    return {
      id: randomUUID(),
      toolName,
      input,
      startedAt: nowIso(),
      status: 'started',
    };
  }
}

export const toolRegistry = new ToolRegistry();
