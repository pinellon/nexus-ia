import { mkdir, writeFile as writeFsFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ActionRecord } from "./action-types.js";
import { installPackages, runCommand } from "./command-runner.js";
import {
  getPendingAction,
  markActionApplied,
  markActionFailed
} from "./pending-actions-store.js";
import {
  deleteProjectFile,
  projectFileExists,
  readProjectFile,
  writeProjectFile
} from "./project-file-store.js";
import { createFile, deleteFile, fileExists, readFile, writeFile } from "./workspace-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const dataRoot = process.env.NEXUS_DATA_DIR ? path.resolve(process.env.NEXUS_DATA_DIR) : path.resolve(__dirname, "../data");
const backupsRoot = path.resolve(dataRoot, "backups");

function normalizeForDiffCheck(value: string) {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

export async function applyAction(actionId: string) {
  const action = await getPendingAction(actionId);
  if (!action) {
    throw new Error(`Acao nao encontrada: ${actionId}`);
  }

  if (action.status !== "approved") {
    throw new Error("A acao precisa ser aprovada antes de ser aplicada");
  }

  try {
    const result = await executeAction(action, actionId);
    const appliedAction = await markActionApplied(actionId);
    return { action: appliedAction ?? action, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao aplicar acao";
    await markActionFailed(actionId, message);
    throw error;
  }
}

async function createBackup(actionId: string, filePath: string, content: string) {
  const backupPath = path.join(backupsRoot, actionId, `${filePath}.bak`);
  await mkdir(path.dirname(backupPath), { recursive: true });
  await writeFsFile(backupPath, content, "utf8");
  return backupPath;
}

async function executeAction(action: ActionRecord, actionId: string) {
  const commandRoot = action.projectRoot ?? projectRoot;

  switch (action.type) {
    case "run_command":
      return runCommand(action.commandId, commandRoot);
    case "install_package":
      return installPackages(commandRoot, action.packageManager, action.packages, action.dev);
    case "create_file":
      if (action.projectRoot) {
        const exists = await projectFileExists(action.projectRoot, action.path);
        const backupPath = exists
          ? await createBackup(actionId, action.path, (await readProjectFile(action.projectRoot, action.path)).content)
          : null;
        const saved = await writeProjectFile(action.projectRoot, action.path, action.content);
        return { ...saved, backupPath };
      }
      return createFile(action.path, action.content);
    case "write_file":
      if (action.projectRoot) {
        const exists = await projectFileExists(action.projectRoot, action.path);
        const backupPath = exists
          ? await createBackup(actionId, action.path, (await readProjectFile(action.projectRoot, action.path)).content)
          : null;
        const saved = await writeProjectFile(action.projectRoot, action.path, action.content);
        return { ...saved, backupPath };
      }
      return writeFile(action.path, action.content);
    case "patch_file": {
      const exists = action.projectRoot
        ? await projectFileExists(action.projectRoot, action.path)
        : await fileExists(action.path);
      const currentContent = exists
        ? action.projectRoot
          ? (await readProjectFile(action.projectRoot, action.path)).content
          : (await readFile(action.path)).content
        : "";

      if (
        exists &&
        normalizeForDiffCheck(currentContent) !== normalizeForDiffCheck(action.before)
      ) {
        throw new Error(`O arquivo ${action.path} mudou desde a proposta. Revise o diff antes de aplicar.`);
      }

      const backupPath = exists ? await createBackup(actionId, action.path, currentContent) : null;
      const saved = action.projectRoot
        ? await writeProjectFile(action.projectRoot, action.path, action.after)
        : await writeFile(action.path, action.after);
      return {
        ...saved,
        before: currentContent,
        after: action.after,
        backupPath
      };
    }
    case "delete_file":
      if (action.projectRoot) {
        const currentContent = (await readProjectFile(action.projectRoot, action.path)).content;
        const backupPath = await createBackup(actionId, action.path, currentContent);
        const deleted = await deleteProjectFile(action.projectRoot, action.path);
        return { ...deleted, backupPath };
      }
      return deleteFile(action.path);
    case "open_file":
      if (action.projectRoot) {
        return readProjectFile(action.projectRoot, action.path);
      }
      return readFile(action.path);
    default:
      throw new Error("Tipo de acao nao suportado");
  }
}
