import { createHash } from 'node:crypto';

export function hashFileContent(content: string) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function isExpectedFileHash(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}
