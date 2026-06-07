import type { ActionRiskLevel } from '../action-types.js';
import { readProjectFile, resolveProjectPath } from '../project-file-store.js';

const HIGH_RISK_PATTERNS = [
  /\bdelete\b/i,
  /\brm\s+-rf\b/i,
  /process\.env/i,
  /child_process/i,
  /\beval\s*\(/i,
  /innerHTML/i,
];

const MEDIUM_RISK_PATTERNS = [
  /\bauth/i,
  /\btoken/i,
  /\bpassword/i,
  /\bsecret/i,
  /\bapi\s*key/i,
  /\bendpoint/i,
  /\broute/i,
];

export interface ValidatedEditFile {
  path: string;
  before: string;
  after: string;
  riskLevel: ActionRiskLevel;
}

function classifyRisk(input: {
  path: string;
  instruction: string;
  before: string;
  after: string;
}): ActionRiskLevel {
  const combined = [input.path, input.instruction, input.before, input.after].join('\n');
  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(combined))) {
    return 'high';
  }
  if (MEDIUM_RISK_PATTERNS.some((pattern) => pattern.test(combined))) {
    return 'medium';
  }
  return 'low';
}

export async function validateEditFile(input: {
  projectRoot: string;
  path: string;
  after: string;
  instruction: string;
}): Promise<ValidatedEditFile> {
  const resolved = resolveProjectPath(input.projectRoot, input.path);
  const current = await readProjectFile(input.projectRoot, resolved.normalized);
  const after = String(input.after ?? '');

  if (!after.trim()) {
    throw new Error('A proposta de edicao nao pode ficar vazia');
  }

  return {
    path: resolved.normalized,
    before: current.content,
    after,
    riskLevel: classifyRisk({
      path: resolved.normalized,
      instruction: input.instruction,
      before: current.content,
      after,
    }),
  };
}

export function mergeRiskLevels(levels: ActionRiskLevel[]): ActionRiskLevel {
  if (levels.includes('high')) return 'high';
  if (levels.includes('medium')) return 'medium';
  return 'low';
}
