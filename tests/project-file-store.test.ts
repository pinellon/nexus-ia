import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  createProjectFolder,
  deleteProjectFile,
  deleteProjectFolder,
  readProjectFile,
  renameProjectPath,
  writeProjectFile,
} from '../src/project-file-store.js';

const projectRoot = '.tmp-tests/project-file-store';
const absoluteProjectRoot = path.resolve(process.cwd(), projectRoot);

describe('project-file-store', () => {
  beforeEach(async () => {
    await rm(absoluteProjectRoot, { recursive: true, force: true });
    await mkdir(absoluteProjectRoot, { recursive: true });
  });

  it('creates and reads an allowed file', async () => {
    await writeProjectFile(projectRoot, 'src/example.ts', 'export const ok = true;\n');
    await expect(readProjectFile(projectRoot, 'src/example.ts')).resolves.toMatchObject({
      path: 'src/example.ts',
      content: 'export const ok = true;\n',
    });
  });

  it.each([
    ['../outside.txt'],
    ['.env'],
    ['.env.local'],
    ['cert.pem'],
    ['secret.key'],
    ['id_rsa'],
    ['node_modules/pkg/index.js'],
    ['.git/config'],
    ['%2e%2e%2foutside.txt'],
    ['docs/%2e%2e/secret.txt'],
    ['src/%00.txt'],
    ['C:/Windows/System32/drivers/etc/hosts'],
  ])('blocks unsafe path %s', async (targetPath) => {
    await expect(writeProjectFile(projectRoot, targetPath, 'blocked')).rejects.toThrow();
  });

  it('renames a file without overwriting an existing destination', async () => {
    await writeProjectFile(projectRoot, 'src/old.ts', 'old');
    await writeProjectFile(projectRoot, 'src/existing.ts', 'existing');

    await expect(renameProjectPath(projectRoot, 'src/old.ts', 'src/new.ts')).resolves.toMatchObject(
      {
        oldPath: 'src/old.ts',
        newPath: 'src/new.ts',
      },
    );
    await expect(readProjectFile(projectRoot, 'src/new.ts')).resolves.toMatchObject({
      content: 'old',
    });

    await expect(renameProjectPath(projectRoot, 'src/new.ts', 'src/existing.ts')).rejects.toThrow(
      'Destino ja existe',
    );
  });

  it('deletes files and folders', async () => {
    await writeProjectFile(projectRoot, 'docs/remove.md', 'temporary');
    await expect(deleteProjectFile(projectRoot, 'docs/remove.md')).resolves.toMatchObject({
      path: 'docs/remove.md',
    });

    await createProjectFolder(projectRoot, 'docs/empty-folder');
    await expect(deleteProjectFolder(projectRoot, 'docs/empty-folder')).resolves.toMatchObject({
      path: 'docs/empty-folder',
    });
  });
});
