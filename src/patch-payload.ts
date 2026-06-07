import type { ActionRecord } from './action-types.js';
import { projectFileExists, readProjectFile } from './project-file-store.js';
import { hashFileContent } from './file-content-hash.js';

export function isPatchAction(action: ActionRecord) {
  return (
    action.type === 'create_file' ||
    action.type === 'write_file' ||
    action.type === 'patch_file' ||
    action.type === 'delete_file'
  );
}

export function buildUnifiedDiff(before: string, after: string, filePath: string) {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  return [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    '@@',
    ...beforeLines.map((line) => `-${line}`),
    ...afterLines.map((line) => `+${line}`),
  ].join('\n');
}

export async function resolvePatchSides(action: ActionRecord) {
  const projectRoot = action.projectRoot ?? '.';
  const filePath = 'path' in action ? action.path : '';

  switch (action.type) {
    case 'create_file':
      return { path: filePath, before: '', after: action.content };
    case 'write_file': {
      let before = '';
      if (filePath) {
        try {
          if (await projectFileExists(projectRoot, filePath)) {
            before = (await readProjectFile(projectRoot, filePath)).content;
          }
        } catch {
          before = '';
        }
      }
      return { path: filePath, before, after: action.content };
    }
    case 'patch_file':
      return { path: filePath, before: action.before, after: action.after };
    case 'delete_file': {
      let before = '';
      if (filePath) {
        try {
          if (await projectFileExists(projectRoot, filePath)) {
            before = (await readProjectFile(projectRoot, filePath)).content;
          }
        } catch {
          before = '';
        }
      }
      return { path: filePath, before, after: '' };
    }
    default:
      return { path: filePath, before: '', after: '' };
  }
}

export async function buildPatchPayload(action: ActionRecord) {
  const { path: filePath, before, after } = await resolvePatchSides(action);
  const filesChanged = filePath ? [filePath] : [];

  return {
    id: action.id,
    type: action.type,
    path: filePath,
    run_id: action.sessionId,
    agent_id: action.sourceAgent || 'unknown',
    goal: action.goal || '',
    files_changed: filesChanged,
    risk: action.riskLevel,
    status: action.status,
    summary: action.reason,
    created_at: action.createdAt,
    updated_at: action.updatedAt,
    diff: buildUnifiedDiff(before, after, filePath || 'file'),
    before,
    after,
    expected_hash:
      action.type === 'write_file' ? action.expectedHash || hashFileContent(before) : undefined,
    content: action.type === 'create_file' || action.type === 'write_file' ? action.content : after,
    action,
  };
}
