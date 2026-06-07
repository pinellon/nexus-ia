import type { Express } from 'express';

import { planAiEdit } from '../ai/ai-edit-planner.js';
import { listBackups, restoreBackup } from '../backup-store.js';
import { applyPendingPatchAction } from '../patches/patch-applier.js';
import {
  getAiEditHistory,
  listAiEditHistory,
  updateAiEditHistory,
} from '../patches/patch-history-store.js';
import { rejectAction } from '../pending-actions-store.js';
import { requireConfirmation } from '../local-security.js';

type ActiveProjectRootProvider = () => Promise<string>;

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function registerAiEditRoutes(app: Express, activeProjectRoot: ActiveProjectRootProvider) {
  app.post('/api/ai-edits/plan', async (req, res) => {
    try {
      const body = req.body as {
        instruction?: string;
        targetFiles?: unknown;
        selection?: {
          file?: string;
          startLine?: number;
          endLine?: number;
          content?: string;
        };
        proposedFiles?: Array<{ path?: string; content?: string }>;
        forceLocal?: boolean;
      };
      const planned = await planAiEdit({
        projectRoot: await activeProjectRoot(),
        instruction: String(body.instruction || ''),
        targetFiles: readStringArray(body.targetFiles),
        selection: body.selection?.file
          ? {
              file: body.selection.file,
              startLine: body.selection.startLine,
              endLine: body.selection.endLine,
              content: body.selection.content,
            }
          : undefined,
        proposedFiles: Array.isArray(body.proposedFiles)
          ? body.proposedFiles
              .filter(
                (file): file is { path: string; content: string } =>
                  typeof file.path === 'string' && typeof file.content === 'string',
              )
              .map((file) => ({ path: file.path, content: file.content }))
          : undefined,
        forceLocal: body.forceLocal !== false,
      });
      return res.status(201).json({
        ok: true,
        data: planned,
        editId: planned.editId,
        patch_ids: planned.files.map((file) => file.actionId),
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Falha ao planejar edicao com IA',
      });
    }
  });

  app.post('/api/ai-edits/apply', requireConfirmation, async (req, res) => {
    try {
      const editId = String(req.body?.editId || '');
      const edit = await getAiEditHistory(editId);
      if (!edit) return res.status(404).json({ ok: false, error: 'Edicao nao encontrada' });

      const applied = [];
      for (const file of edit.files) {
        applied.push(await applyPendingPatchAction(file.actionId));
      }
      const backups = await listBackups();
      const backupIds = backups
        .filter((backup) => edit.files.some((file) => file.actionId === backup.actionId))
        .map((backup) => backup.id);
      await updateAiEditHistory(edit.id, { status: 'applied', backupIds });

      return res.json({
        ok: true,
        success: true,
        editId: edit.id,
        appliedFiles: edit.files.map((file) => file.path),
        backupIds,
        data: applied,
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Falha ao aplicar edicao',
      });
    }
  });

  app.post('/api/ai-edits/reject', requireConfirmation, async (req, res) => {
    try {
      const editId = String(req.body?.editId || '');
      const edit = await getAiEditHistory(editId);
      if (!edit) return res.status(404).json({ ok: false, error: 'Edicao nao encontrada' });

      for (const file of edit.files) {
        await rejectAction(file.actionId);
      }
      await updateAiEditHistory(edit.id, { status: 'rejected' });
      return res.json({ ok: true, success: true, editId: edit.id });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Falha ao rejeitar edicao',
      });
    }
  });

  app.post('/api/ai-edits/undo', requireConfirmation, async (req, res) => {
    try {
      const editId = String(req.body?.editId || '');
      const edit = await getAiEditHistory(editId);
      if (!edit) return res.status(404).json({ ok: false, error: 'Edicao nao encontrada' });

      const backups = await listBackups();
      const restoredFiles = [];
      for (const file of edit.files) {
        const backup = backups.find((item) => item.actionId === file.actionId);
        if (!backup) continue;
        await restoreBackup(await activeProjectRoot(), backup.id);
        restoredFiles.push(file.path);
      }

      if (!restoredFiles.length) {
        throw new Error('Nenhum backup encontrado para desfazer esta edicao');
      }

      await updateAiEditHistory(edit.id, { status: 'undone' });
      return res.json({
        ok: true,
        success: true,
        editId: edit.id,
        restoredFiles,
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Falha ao desfazer edicao',
      });
    }
  });

  app.get('/api/ai-edits/history', async (_req, res) => {
    return res.json({
      ok: true,
      data: await listAiEditHistory(),
    });
  });
}
