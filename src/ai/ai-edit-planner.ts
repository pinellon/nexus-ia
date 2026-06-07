import { createPendingAction } from '../pending-actions-store.js';
import { buildUnifiedDiff } from '../patch-payload.js';
import { readProjectFile } from '../project-file-store.js';
import { LocalCodexAgent } from './local-codex-agent.js';
import {
  validateEditFile,
  mergeRiskLevels,
  type ValidatedEditFile,
} from '../patches/patch-validator.js';
import { createAiEditHistory } from '../patches/patch-history-store.js';

export interface AiEditSelection {
  file: string;
  startLine?: number;
  endLine?: number;
  content?: string;
}

export interface PlanAiEditInput {
  projectRoot: string;
  instruction: string;
  targetFiles: string[];
  selection?: AiEditSelection;
  proposedFiles?: Array<{ path: string; content: string }>;
  forceLocal?: boolean;
  source?: 'ai' | 'fallback' | 'test';
}

export interface PlannedAiEdit {
  editId: string;
  summary: string;
  files: Array<{
    path: string;
    actionId: string;
    diff: string;
    before: string;
    after: string;
  }>;
  riskLevel: 'low' | 'medium' | 'high';
  requiresConfirmation: true;
}

function uniquePaths(paths: string[]) {
  return Array.from(new Set(paths.map((item) => item.trim()).filter(Boolean)));
}

function applyFallbackInstruction(
  content: string,
  instruction: string,
  selection?: AiEditSelection,
) {
  const marker = `// Nexus AI edit: ${instruction.trim().slice(0, 120)}`;
  if (selection?.startLine && selection.endLine) {
    const lines = content.split(/\r?\n/);
    const start = Math.max(0, selection.startLine - 1);
    const end = Math.max(start, selection.endLine);
    lines.splice(start, end - start, marker, ...lines.slice(start, end));
    return lines.join('\n');
  }
  return content.endsWith('\n') ? `${content}${marker}\n` : `${content}\n${marker}\n`;
}

async function readContextFiles(input: PlanAiEditInput) {
  const files = [];
  for (const filePath of uniquePaths(input.targetFiles)) {
    const file = await readProjectFile(input.projectRoot, filePath);
    files.push({
      path: file.path,
      content: file.content,
    });
  }
  return files;
}

async function generateProposedFiles(input: PlanAiEditInput) {
  if (input.proposedFiles?.length) {
    return {
      summary: `Edicao proposta: ${input.instruction}`,
      files: input.proposedFiles,
      source: input.source || ('test' as const),
    };
  }

  try {
    const agent = new LocalCodexAgent();
    const result = await agent.runTask({
      instruction: input.instruction,
      contextFiles: await readContextFiles(input),
      selection: input.selection,
      forceLocal: input.forceLocal,
    });
    return {
      summary: result.summary,
      files: result.files,
      source: 'ai' as const,
    };
  } catch {
    // Keep the editing flow usable when Ollama is offline or returns invalid JSON.
  }

  const fallbackFiles = [];
  for (const filePath of uniquePaths(input.targetFiles)) {
    const file = await readProjectFile(input.projectRoot, filePath);
    fallbackFiles.push({
      path: file.path,
      content: applyFallbackInstruction(
        file.content,
        input.instruction,
        input.selection?.file === file.path ? input.selection : undefined,
      ),
    });
  }
  return {
    summary: 'Rascunho local criado porque nenhum provider de IA respondeu.',
    files: fallbackFiles,
    source: 'fallback' as const,
  };
}

export async function planAiEdit(input: PlanAiEditInput): Promise<PlannedAiEdit> {
  const instruction = input.instruction.trim();
  if (!instruction) {
    throw new Error('instruction e obrigatorio');
  }

  const targetFiles = uniquePaths([
    ...input.targetFiles,
    ...(input.selection?.file ? [input.selection.file] : []),
  ]);
  if (!targetFiles.length) {
    throw new Error('targetFiles e obrigatorio');
  }

  const generated = await generateProposedFiles({ ...input, instruction, targetFiles });
  const validatedFiles: ValidatedEditFile[] = [];
  for (const file of generated.files) {
    validatedFiles.push(
      await validateEditFile({
        projectRoot: input.projectRoot,
        path: file.path,
        after: file.content,
        instruction,
      }),
    );
  }

  const riskLevel = mergeRiskLevels(validatedFiles.map((file) => file.riskLevel));
  const actionFiles = [];

  for (const file of validatedFiles) {
    const action = await createPendingAction(`ai-edit:${Date.now()}`, {
      type: 'patch_file',
      sessionId: `ai-edit:${Date.now()}`,
      projectRoot: input.projectRoot,
      path: file.path,
      before: file.before,
      after: file.after,
      reason: generated.summary,
      goal: instruction,
      riskLevel,
      requiresConfirmation: true,
      sourceAgent: 'ai_code_apply',
    });
    actionFiles.push({
      path: file.path,
      actionId: action.id,
      diff: buildUnifiedDiff(file.before, file.after, file.path),
      before: file.before,
      after: file.after,
    });
  }

  const history = await createAiEditHistory({
    instruction,
    summary: generated.summary,
    projectRoot: input.projectRoot,
    riskLevel,
    files: actionFiles.map((file) => ({
      path: file.path,
      actionId: file.actionId,
      diff: file.diff,
    })),
    source: generated.source,
  });

  return {
    editId: history.id,
    summary: history.summary,
    files: actionFiles,
    riskLevel,
    requiresConfirmation: true,
  };
}
