import { describe, expect, it } from 'vitest';

import { extractProposedActions } from '../src/action-planner.js';

describe('action planner', () => {
  it('repairs simple trailing commas in fenced JSON action payloads', async () => {
    const actions = await extractProposedActions({
      sessionId: 'session-1',
      persist: false,
      merged: `\`\`\`json
{
  "actions": [
    {
      "type": "create_file",
      "path": "docs/example.md",
      "content": "hello",
      "reason": "create docs",
    },
  ],
}
\`\`\``,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: 'create_file',
      path: 'docs/example.md',
      content: 'hello',
    });
  });

  it('rejects fragile patch_file actions with tiny before content', async () => {
    const actions = await extractProposedActions({
      sessionId: 'session-1',
      persist: false,
      synthesisActions: [
        {
          type: 'patch_file',
          path: 'src/file.ts',
          before: 'x',
          after: 'updated content',
          reason: 'fragile patch',
        },
      ],
    });

    expect(actions).toEqual([]);
  });

  it('dedupes equivalent file writes with canonical content keys', async () => {
    const actions = await extractProposedActions({
      sessionId: 'session-1',
      persist: false,
      synthesisActions: [
        {
          type: 'create_file',
          path: 'src/app.ts',
          content: 'export const value = 1;',
          reason: 'first reason',
        },
        {
          type: 'create_file',
          path: 'src/app.ts',
          content: 'export const value = 1;',
          reason: 'second reason',
        },
      ],
    });

    expect(actions).toHaveLength(1);
  });
});
