import { listAllowedCommands, resolveAllowedCommand } from './command-runner.js';
import type { ActionDraft, ActionRecord, ActionRiskLevel, ActionType } from './action-types.js';
import { createPendingActions } from './pending-actions-store.js';
import { resolveWorkspacePath } from './workspace-store.js';
import { createHash } from 'node:crypto';

interface ActionCandidate {
  type?: unknown;
  path?: unknown;
  content?: unknown;
  before?: unknown;
  after?: unknown;
  original?: unknown;
  updated?: unknown;
  reason?: unknown;
  command?: unknown;
  commandId?: unknown;
  riskLevel?: unknown;
  requiresConfirmation?: unknown;
  packageManager?: unknown;
  packages?: unknown;
  dev?: unknown;
}

interface ExtractInput {
  sessionId: string;
  merged?: string;
  synthesisActions?: ActionCandidate[];
  agentContents?: Array<{ agent: string; content: string }>;
  persist?: boolean;
}

const ACTION_TYPES: ActionType[] = [
  'create_file',
  'write_file',
  'patch_file',
  'delete_file',
  'run_command',
  'install_package',
  'open_file',
];

const SAFE_PACKAGE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i;
const MIN_PATCH_BEFORE_CHARS = 8;

function clampText(value: string, max = 200_000) {
  return value.length > max ? value.slice(0, max) : value;
}

function normalizeRiskLevel(value: unknown): ActionRiskLevel {
  if (value === 'medium' || value === 'high') {
    return value;
  }

  return 'low';
}

function extractFencedJsonBlocks(text: string) {
  const matches = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)];
  return matches.map((match) => match[1].trim()).filter(Boolean);
}

function extractLooseJsonBlocks(text: string) {
  const blocks: string[] = [];
  let depth = 0;
  let start = -1;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '{') {
      if (depth === 0) {
        start = index;
      }
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        blocks.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return blocks;
}

function repairJsonBlock(block: string) {
  return block.replace(/^\uFEFF/, '').replace(/,\s*([}\]])/g, '$1');
}

function parseJsonBlock(block: string) {
  try {
    return JSON.parse(block);
  } catch {
    const repaired = repairJsonBlock(block);
    if (repaired === block) {
      throw new Error('JSON invalido');
    }
    return JSON.parse(repaired);
  }
}

function parseJsonCandidates(text: string): ActionCandidate[] {
  const rawBlocks = [...extractFencedJsonBlocks(text), ...extractLooseJsonBlocks(text)];
  const candidates: ActionCandidate[] = [];

  for (const block of rawBlocks) {
    try {
      const parsed = parseJsonBlock(block);
      if (Array.isArray(parsed)) {
        candidates.push(...parsed.filter((item) => item && typeof item === 'object'));
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray((parsed as { actions?: unknown }).actions)) {
          candidates.push(
            ...((parsed as { actions: unknown[] }).actions.filter(
              (item) => item && typeof item === 'object',
            ) as ActionCandidate[]),
          );
        } else {
          candidates.push(parsed as ActionCandidate);
        }
      }
    } catch {
      continue;
    }
  }

  return candidates;
}

function buildBaseDraft(sessionId: string, candidate: ActionCandidate, sourceAgent?: string) {
  if (typeof candidate.type !== 'string' || typeof candidate.reason !== 'string') {
    return null;
  }

  const type = candidate.type.trim() as ActionType;
  if (!ACTION_TYPES.includes(type)) {
    return null;
  }

  const reason = candidate.reason.trim();
  if (!reason) {
    return null;
  }

  const requiresConfirmation = candidate.requiresConfirmation === false ? false : true;
  if (!requiresConfirmation) {
    return null;
  }

  return {
    sessionId,
    type,
    reason,
    riskLevel: normalizeRiskLevel(candidate.riskLevel),
    requiresConfirmation: true as const,
    sourceAgent,
  };
}

function validatePath(candidatePath: unknown) {
  if (typeof candidatePath !== 'string') {
    return null;
  }

  return resolveWorkspacePath(candidatePath).normalized;
}

function validatePackages(value: unknown) {
  if (!Array.isArray(value) || !value.length) {
    return null;
  }

  const packages = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!packages.length || packages.some((item) => !SAFE_PACKAGE_NAME.test(item))) {
    return null;
  }

  return packages;
}

function validateCandidate(
  sessionId: string,
  candidate: ActionCandidate,
  sourceAgent?: string,
): ActionDraft | null {
  const base = buildBaseDraft(sessionId, candidate, sourceAgent);
  if (!base) {
    return null;
  }

  switch (base.type) {
    case 'run_command': {
      const resolved = resolveAllowedCommand(candidate.commandId ?? candidate.command);
      if (!resolved) {
        return null;
      }

      return {
        ...base,
        type: 'run_command',
        commandId: resolved.id,
        command: resolved.label,
      };
    }
    case 'install_package': {
      const packages = validatePackages(candidate.packages);
      if (!packages) {
        return null;
      }

      const packageManager = candidate.packageManager === 'npm' ? 'npm' : null;
      if (!packageManager) {
        return null;
      }

      return {
        ...base,
        type: 'install_package',
        packageManager,
        packages,
        dev: Boolean(candidate.dev),
      };
    }
    case 'create_file':
    case 'write_file': {
      const safePath = validatePath(candidate.path);
      if (!safePath || typeof candidate.content !== 'string') {
        return null;
      }

      return {
        ...base,
        type: base.type,
        path: safePath,
        content: clampText(candidate.content),
      };
    }
    case 'patch_file': {
      const safePath = validatePath(candidate.path);
      const before = typeof candidate.before === 'string' ? candidate.before : candidate.original;
      const after = typeof candidate.after === 'string' ? candidate.after : candidate.updated;

      if (!safePath || typeof before !== 'string' || typeof after !== 'string') {
        return null;
      }

      if (before.trim().length < MIN_PATCH_BEFORE_CHARS) {
        return null;
      }

      return {
        ...base,
        type: 'patch_file',
        path: safePath,
        before: clampText(before),
        after: clampText(after),
      };
    }
    case 'delete_file':
    case 'open_file': {
      const safePath = validatePath(candidate.path);
      if (!safePath) {
        return null;
      }

      return {
        ...base,
        type: base.type,
        path: safePath,
      };
    }
    default:
      return null;
  }
}

function dedupeActions(actions: ActionDraft[]) {
  const seen = new Set<string>();
  const deduped: ActionDraft[] = [];

  for (const action of actions) {
    const key = canonicalActionKey(action);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(action);
  }

  return deduped;
}

function hashValue(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(value ?? ''))
    .digest('hex')
    .slice(0, 16);
}

function canonicalActionKey(action: ActionDraft) {
  const pathPart = 'path' in action ? action.path : '';

  switch (action.type) {
    case 'create_file':
    case 'write_file':
      return [action.type, pathPart, hashValue(action.content)].join(':');
    case 'patch_file':
      return [action.type, pathPart, hashValue(action.before), hashValue(action.after)].join(':');
    case 'delete_file':
    case 'open_file':
      return [action.type, pathPart].join(':');
    case 'run_command':
      return [action.type, action.commandId].join(':');
    case 'install_package':
      return [
        action.type,
        action.packageManager,
        action.dev ? 'dev' : 'prod',
        hashValue([...action.packages].sort()),
      ].join(':');
    default:
      return hashValue(action);
  }
}

function collectCandidates(input: ExtractInput) {
  const candidates: Array<{ sourceAgent?: string; candidate: ActionCandidate }> = [];

  for (const candidate of input.synthesisActions ?? []) {
    candidates.push({ sourceAgent: 'synthesis', candidate });
  }

  for (const source of input.agentContents ?? []) {
    for (const candidate of parseJsonCandidates(source.content)) {
      candidates.push({ sourceAgent: source.agent, candidate });
    }
  }

  if (input.merged) {
    for (const candidate of parseJsonCandidates(input.merged)) {
      candidates.push({ sourceAgent: 'merged', candidate });
    }
  }

  return candidates;
}

export async function extractProposedActions(input: ExtractInput): Promise<ActionRecord[]> {
  const drafts = collectCandidates(input)
    .map(({ candidate, sourceAgent }) => validateCandidate(input.sessionId, candidate, sourceAgent))
    .filter((action): action is ActionDraft => Boolean(action));

  const deduped = dedupeActions(drafts);
  if (!deduped.length) {
    return [];
  }

  if (input.persist === false) {
    return deduped.map((action, index) => ({
      ...action,
      id: `preview-${index + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'pending',
    })) as ActionRecord[];
  }

  return createPendingActions(input.sessionId, deduped);
}

export function describeAllowedCommands() {
  return listAllowedCommands();
}
