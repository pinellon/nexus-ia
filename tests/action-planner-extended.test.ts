import { describe, expect, it } from 'vitest';

import { extractProposedActions } from '../src/action-planner.js';

describe('action planner — extended cases', () => {
  // ── JSON Repair ──────────────────────────────────────────────────────────────

  it('repairs JSON with BOM character before the array', async () => {
    const bomJson = '\uFEFF{"type":"create_file","path":"src/bom.ts","content":"x","reason":"bom test"}';
    const actions = await extractProposedActions({
      sessionId: 'ses-bom',
      persist: false,
      merged: bomJson,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: 'create_file', path: 'src/bom.ts' });
  });

  it('parses multiple fenced JSON blocks and collects all actions', async () => {
    const merged = `
Some text before

\`\`\`json
{"type":"create_file","path":"src/a.ts","content":"a","reason":"first"}
\`\`\`

More text

\`\`\`json
{"type":"create_file","path":"src/b.ts","content":"b","reason":"second"}
\`\`\`
    `;
    const actions = await extractProposedActions({ sessionId: 'ses-multi', persist: false, merged });
    expect(actions.length).toBeGreaterThanOrEqual(2);
  });

  // ── Validation Rejections ─────────────────────────────────────────────────────

  it('rejects action with missing reason field', async () => {
    const actions = await extractProposedActions({
      sessionId: 'ses-no-reason',
      persist: false,
      synthesisActions: [
        {
          type: 'create_file',
          path: 'src/file.ts',
          content: 'hello',
          // no reason
        },
      ],
    });
    expect(actions).toEqual([]);
  });

  it('rejects action with empty reason string', async () => {
    const actions = await extractProposedActions({
      sessionId: 'ses-empty-reason',
      persist: false,
      synthesisActions: [
        {
          type: 'create_file',
          path: 'src/file.ts',
          content: 'hello',
          reason: '   ',
        },
      ],
    });
    expect(actions).toEqual([]);
  });

  it('rejects action with unknown type', async () => {
    const actions = await extractProposedActions({
      sessionId: 'ses-bad-type',
      persist: false,
      synthesisActions: [
        {
          type: 'execute_arbitrary',
          path: 'src/file.ts',
          reason: 'trying to run something dangerous',
        },
      ],
    });
    expect(actions).toEqual([]);
  });

  it('rejects action where requiresConfirmation is explicitly false', async () => {
    const actions = await extractProposedActions({
      sessionId: 'ses-no-confirm',
      persist: false,
      synthesisActions: [
        {
          type: 'create_file',
          path: 'src/file.ts',
          content: 'hello',
          reason: 'should be rejected because no confirmation required',
          requiresConfirmation: false,
        },
      ],
    });
    expect(actions).toEqual([]);
  });

  // ── patch_file boundary ───────────────────────────────────────────────────────

  it('rejects patch_file when before is exactly at minimum length (too short)', async () => {
    // MIN_PATCH_BEFORE_CHARS = 8, so 7 chars should be rejected
    const actions = await extractProposedActions({
      sessionId: 'ses-short-patch',
      persist: false,
      synthesisActions: [
        {
          type: 'patch_file',
          path: 'src/file.ts',
          before: '1234567', // 7 chars — below minimum
          after: 'replaced',
          reason: 'short before patch',
        },
      ],
    });
    expect(actions).toEqual([]);
  });

  it('accepts patch_file when before is exactly at minimum length (8 chars)', async () => {
    const actions = await extractProposedActions({
      sessionId: 'ses-min-patch',
      persist: false,
      synthesisActions: [
        {
          type: 'patch_file',
          path: 'src/file.ts',
          before: '12345678', // exactly 8 chars — at minimum
          after: 'replaced',
          reason: 'minimum before patch',
        },
      ],
    });
    expect(actions).toHaveLength(1);
  });

  it('accepts patch_file with original/updated aliases', async () => {
    const actions = await extractProposedActions({
      sessionId: 'ses-aliases',
      persist: false,
      synthesisActions: [
        {
          type: 'patch_file',
          path: 'src/file.ts',
          original: 'original content here',
          updated: 'updated content here',
          reason: 'using alias fields',
        },
      ],
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: 'patch_file' });
  });

  // ── Dedupe ────────────────────────────────────────────────────────────────────

  it('dedupes run_command actions with the same commandId', async () => {
    const actions = await extractProposedActions({
      sessionId: 'ses-dedup-cmd',
      persist: false,
      synthesisActions: [
        { type: 'run_command', commandId: 'build', reason: 'first build trigger' },
        { type: 'run_command', commandId: 'build', reason: 'second build trigger' },
        { type: 'run_command', command: 'npm run build', reason: 'third, using label' },
      ],
    });

    // All three resolve to the same commandId, so only 1 should survive dedup
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: 'run_command', commandId: 'build' });
  });

  it('dedupes install_package actions with same packages in different order', async () => {
    const actions = await extractProposedActions({
      sessionId: 'ses-dedup-pkg',
      persist: false,
      synthesisActions: [
        {
          type: 'install_package',
          packageManager: 'npm',
          packages: ['lodash', 'zod'],
          dev: false,
          reason: 'install libs',
        },
        {
          type: 'install_package',
          packageManager: 'npm',
          packages: ['zod', 'lodash'], // same packages, different order
          dev: false,
          reason: 'install libs again',
        },
      ],
    });

    expect(actions).toHaveLength(1);
  });

  it('does NOT dedupe install_package when dev flag differs', async () => {
    const actions = await extractProposedActions({
      sessionId: 'ses-no-dedup-dev',
      persist: false,
      synthesisActions: [
        {
          type: 'install_package',
          packageManager: 'npm',
          packages: ['lodash'],
          dev: false,
          reason: 'prod install',
        },
        {
          type: 'install_package',
          packageManager: 'npm',
          packages: ['lodash'],
          dev: true,
          reason: 'dev install',
        },
      ],
    });

    expect(actions).toHaveLength(2);
  });

  // ── agentContents parsing ─────────────────────────────────────────────────────

  it('extracts actions from agentContents with source agent label', async () => {
    const actions = await extractProposedActions({
      sessionId: 'ses-agents',
      persist: false,
      agentContents: [
        {
          agent: 'planner',
          content: `\`\`\`json
{"type":"create_file","path":"src/new.ts","content":"// new","reason":"from planner agent"}
\`\`\``,
        },
      ],
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: 'create_file', sourceAgent: 'planner' });
  });
});
