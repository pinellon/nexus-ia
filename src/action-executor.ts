import { mkdir, writeFile as writeFsFile } from 'node:fs/promises';
import path from 'node:path';

import type { ActionRecord } from './action-types.js';
import { installPackages, runCommand } from './command-runner.js';
import { getPendingAction, markActionApplied, markActionFailed } from './pending-actions-store.js';
import {
  deleteProjectFile,
  fileHashMatches,
  projectFileExists,
  readProjectFile,
  writeProjectFile,
} from './project-file-store.js';
import { createFile, deleteFile, fileExists, readFile, writeFile } from './workspace-store.js';
import { resolveNexusDataPath } from './nexus-data-dir.js';
import { hashFileContent } from './file-content-hash.js';

const projectRoot = process.env.NEXUS_APP_ROOT || process.cwd();
const backupsRoot = resolveNexusDataPath('backups');

function normalizeForDiffCheck(value: string) {
  return value.replace(/\r\n/g, '\n').trimEnd();
}

export async function applyAction(actionId: string) {
  const action = await getPendingAction(actionId);
  if (!action) {
    throw new Error(`Acao nao encontrada: ${actionId}`);
  }

  if (action.status !== 'approved') {
    throw new Error('A acao precisa ser aprovada antes de ser aplicada');
  }

  try {
    const result = await executeAction(action, actionId);
    const appliedAction = await markActionApplied(actionId);
    return { action: appliedAction ?? action, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao aplicar acao';
    await markActionFailed(actionId, message);
    throw error;
  }
}

async function createBackup(actionId: string, filePath: string, content: string) {
  const safeActionId = actionId.replace(/[^a-zA-Z0-9._-]/g, '_');
  const backupDir = path.resolve(backupsRoot, safeActionId);

  // Ensure backupDir is still inside backupsRoot after sanitization
  const relativeDir = path.relative(backupsRoot, backupDir);
  if (relativeDir.startsWith('..') || path.isAbsolute(relativeDir)) {
    throw new Error('Caminho de backup invalido: actionId escapa do diretorio de backups');
  }

  const backupPath = path.resolve(backupDir, `${filePath}.bak`);

  // Ensure the resolved backup path stays inside backupDir
  const relativePath = path.relative(backupDir, backupPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Caminho de backup invalido: filePath escapa do diretorio do action');
  }

  await mkdir(path.dirname(backupPath), { recursive: true });
  await writeFsFile(backupPath, content, 'utf8');
  return backupPath;
}

async function executeAction(action: ActionRecord, actionId: string) {
  const commandRoot = action.projectRoot ?? projectRoot;

  switch (action.type) {
    case 'run_command':
      return runCommand(action.commandId, commandRoot, { runId: actionId });
    case 'install_package':
      return installPackages(commandRoot, action.packageManager, action.packages, action.dev, {
        runId: actionId,
      });
    case 'create_file':
      if (action.projectRoot) {
        const exists = await projectFileExists(action.projectRoot, action.path);
        const backupPath = exists
          ? await createBackup(
              actionId,
              action.path,
              (await readProjectFile(action.projectRoot, action.path)).content,
            )
          : null;
        const saved = await writeProjectFile(action.projectRoot, action.path, action.content);
        return { ...saved, backupPath };
      }
      return createFile(action.path, action.content);
    case 'write_file':
      if (!action.expectedHash) {
        throw new Error('expectedHash e obrigatorio para aplicar write_file com seguranca');
      }
      if (action.projectRoot) {
        const exists = await projectFileExists(action.projectRoot, action.path);
        const currentContent = exists
          ? (await readProjectFile(action.projectRoot, action.path)).content
          : '';
        if (!fileHashMatches(currentContent, action.expectedHash)) {
          throw new Error(
            `O arquivo ${action.path} mudou desde a proposta. Revise o diff antes de aplicar.`,
          );
        }
        const backupPath = exists
          ? await createBackup(actionId, action.path, currentContent)
          : null;
        const saved = await writeProjectFile(action.projectRoot, action.path, action.content);
        return { ...saved, backupPath };
      }
      {
        const exists = await fileExists(action.path);
        const currentContent = exists ? (await readFile(action.path)).content : '';
        if (hashFileContent(currentContent) !== action.expectedHash) {
          throw new Error(
            `O arquivo ${action.path} mudou desde a proposta. Revise o diff antes de aplicar.`,
          );
        }
      }
      return writeFile(action.path, action.content);
    case 'patch_file': {
      const exists = action.projectRoot
        ? await projectFileExists(action.projectRoot, action.path)
        : await fileExists(action.path);
      const currentContent = exists
        ? action.projectRoot
          ? (await readProjectFile(action.projectRoot, action.path)).content
          : (await readFile(action.path)).content
        : '';

      if (
        exists &&
        normalizeForDiffCheck(currentContent) !== normalizeForDiffCheck(action.before)
      ) {
        throw new Error(
          `O arquivo ${action.path} mudou desde a proposta. Revise o diff antes de aplicar.`,
        );
      }

      const backupPath = exists ? await createBackup(actionId, action.path, currentContent) : null;
      const saved = action.projectRoot
        ? await writeProjectFile(action.projectRoot, action.path, action.after)
        : await writeFile(action.path, action.after);
      return {
        ...saved,
        before: currentContent,
        after: action.after,
        backupPath,
      };
    }
    case 'delete_file':
      if (action.projectRoot) {
        const currentContent = (await readProjectFile(action.projectRoot, action.path)).content;
        const backupPath = await createBackup(actionId, action.path, currentContent);
        const deleted = await deleteProjectFile(action.projectRoot, action.path);
        return { ...deleted, backupPath };
      }
      return deleteFile(action.path);
    case 'open_file':
      if (action.projectRoot) {
        return readProjectFile(action.projectRoot, action.path);
      }
      return readFile(action.path);
    default:
      throw new Error('Tipo de acao nao suportado');
  }
}
