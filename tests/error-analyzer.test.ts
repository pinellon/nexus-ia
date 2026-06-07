import { describe, expect, it } from 'vitest';

import { analyzeErrorOutput, formatErrorSummary } from '../src/error-analyzer.js';

describe('error-analyzer', () => {
  // ── Empty / clean output ──────────────────────────────────────────────────────

  it('returns empty array for empty stderr and stdout', () => {
    expect(analyzeErrorOutput('', '')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(analyzeErrorOutput('   \n  \t  ', '')).toEqual([]);
  });

  it('returns empty array for successful build output with no errors', () => {
    const stdout = 'Build succeeded.\n3 files emitted.';
    expect(analyzeErrorOutput('', stdout)).toEqual([]);
  });

  // ── TypeScript errors ─────────────────────────────────────────────────────────

  it('extracts TypeScript error with file, line and column', () => {
    const stderr = `src/server.ts(42,10): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.`;
    const result = analyzeErrorOutput(stderr);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      file: 'src/server.ts',
      line: 42,
      column: 10,
      kind: 'typescript',
    });
    expect(result[0].message).toContain('TS2345');
    expect(result[0].suggestedTool).toContain('src/server.ts');
  });

  it('extracts multiple TypeScript errors from the same stderr', () => {
    const stderr = [
      `src/foo.ts(1,5): error TS2304: Cannot find name 'bar'.`,
      `src/baz.ts(10,3): error TS2322: Type 'string' is not assignable to type 'number'.`,
    ].join('\n');

    const result = analyzeErrorOutput(stderr);
    expect(result).toHaveLength(2);
    expect(result[0].file).toBe('src/foo.ts');
    expect(result[1].file).toBe('src/baz.ts');
  });

  it('deduplicates identical TypeScript errors', () => {
    const line = `src/foo.ts(1,5): error TS2304: Cannot find name 'bar'.`;
    const stderr = `${line}\n${line}\n${line}`;
    const result = analyzeErrorOutput(stderr);
    expect(result).toHaveLength(1);
  });

  it('suggests typecheck tool for TypeScript errors', () => {
    const stderr = `src/index.ts(5,1): error TS2580: Cannot find name 'process'.`;
    const result = analyzeErrorOutput(stderr);
    expect(result[0].suggestedTool).toContain('typecheck');
  });

  // ── Node.js errors ────────────────────────────────────────────────────────────

  it('extracts Node.js stack trace file and line', () => {
    const stderr = [
      'Error: Something went wrong',
      '    at Object.<anonymous> (src/handler.js:55:12)',
      '    at Module._compile (node:internal/modules/cjs/loader:1364:14)',
    ].join('\n');

    const result = analyzeErrorOutput(stderr);
    // Should find src/handler.js but skip the internal node: path
    const handlerError = result.find((e) => e.file.includes('handler.js'));
    expect(handlerError).toBeDefined();
    expect(handlerError?.line).toBe(55);
    expect(handlerError?.column).toBe(12);
    expect(handlerError?.kind).toBe('node');
  });

  it('skips node_modules entries in Node.js stack traces', () => {
    const stderr = [
      'Error: boom',
      '    at something (node_modules/express/lib/router/index.js:10:5)',
      '    at myFunc (src/app.ts:22:3)',
    ].join('\n');

    const result = analyzeErrorOutput(stderr);
    const expressEntry = result.find((e) => e.file.includes('node_modules'));
    expect(expressEntry).toBeUndefined();

    const appEntry = result.find((e) => e.file.includes('app'));
    expect(appEntry).toBeDefined();
  });

  it('extracts Cannot find module error and suggests install', () => {
    const stderr = `Error: Cannot find module './utils'\nRequire stack:\n  - src/index.js`;
    const result = analyzeErrorOutput(stderr);

    expect(result).toHaveLength(1);
    expect(result[0].message).toContain('./utils');
    expect(result[0].kind).toBe('node');
    expect(result[0].suggestedTool).toContain('install');
  });

  // ── npm errors ────────────────────────────────────────────────────────────────

  it('extracts npm ERR! lines and suggests run install', () => {
    const stderr = [
      'npm ERR! code ENOENT',
      'npm ERR! syscall open',
      'npm ERR! path /some/package.json',
    ].join('\n');

    const result = analyzeErrorOutput(stderr);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('npm');
    expect(result[0].message).toContain('ENOENT');
    expect(result[0].suggestedTool).toContain('install');
  });

  // ── formatErrorSummary ────────────────────────────────────────────────────────

  it('formats empty result with "Nenhum erro detectado" message', () => {
    expect(formatErrorSummary([])).toBe('Nenhum erro detectado.');
  });

  it('formats TypeScript error with file:line:col prefix and suggestion', () => {
    const errors = analyzeErrorOutput(
      `src/app.ts(10,5): error TS2345: Argument type mismatch.`,
    );
    const summary = formatErrorSummary(errors);
    expect(summary).toContain('[TYPESCRIPT]');
    expect(summary).toContain('src/app.ts:10:5');
    expect(summary).toContain('→');
  });

  it('formats error without line as file only', () => {
    const errors = analyzeErrorOutput(
      `npm ERR! code ENOENT\nnpm ERR! path /no/package.json`,
    );
    const summary = formatErrorSummary(errors);
    expect(summary).toContain('[NPM]');
  });
});
