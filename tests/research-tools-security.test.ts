import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (hostname: string) => [
    {
      address: hostname === 'private.example' ? '127.0.0.1' : '203.0.113.10',
      family: 4,
    },
  ]),
}));

import { ensureSafeHttpUrl, fetchUrl } from '../src/research-tools.js';

describe('research tools security', () => {
  const originalAllowlist = process.env.NEXUS_FETCH_URL_ALLOWLIST;

  function restoreAllowlist() {
    if (typeof originalAllowlist === 'string') {
      process.env.NEXUS_FETCH_URL_ALLOWLIST = originalAllowlist;
    } else {
      delete process.env.NEXUS_FETCH_URL_ALLOWLIST;
    }
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    restoreAllowlist();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreAllowlist();
  });

  it.each([
    'https://localhost:4000',
    'https://127.0.0.1:4000',
    'https://0.0.0.0',
    'https://10.0.0.5',
    'https://172.16.0.1',
    'https://192.168.1.1',
    'https://169.254.169.254/latest/meta-data',
    'https://100.64.0.1',
    'https://[::1]/',
    'https://[fd00::1]/',
    'https://example.local',
  ])('blocks SSRF target %s', async (url) => {
    await expect(fetchUrl(url)).rejects.toThrow(/locais|privada/);
  });

  it('rejects non-https protocols', async () => {
    await expect(fetchUrl('file:///etc/passwd')).rejects.toThrow('Apenas URLs https');
    await expect(fetchUrl('http://example.com')).rejects.toThrow('Apenas URLs https');
  });

  it('rejects public domains outside the fetch-url allowlist before fetching', async () => {
    await expect(fetchUrl('https://example.com')).rejects.toThrow(
      'Dominio nao permitido para fetch-url',
    );
  });

  it('allows explicitly supported HTTPS research hosts', () => {
    expect(ensureSafeHttpUrl('https://github.com/openai/openai-node').hostname).toBe('github.com');
  });

  it('blocks hostnames that resolve to private IPs', async () => {
    process.env.NEXUS_FETCH_URL_ALLOWLIST = 'private.example';

    await expect(fetchUrl('https://private.example/docs')).rejects.toThrow(
      'Resolucao DNS aponta para rede privada',
    );
  });

  it('blocks redirects to private network targets', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', {
        status: 302,
        headers: {
          location: 'https://127.0.0.1/admin',
        },
      }),
    );

    await expect(fetchUrl('https://github.com/safe')).rejects.toThrow(
      /locais|privada/,
    );
  });

  it('rejects unsafe content types', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('not an image, but declared as one', {
        status: 200,
        headers: {
          'content-type': 'image/png',
        },
      }),
    );

    await expect(fetchUrl('https://github.com/file.png')).rejects.toThrow(
      'Content-Type nao permitido',
    );
  });

  it('rejects oversized responses before reading the body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('too large', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
          'content-length': String(512 * 1024 + 1),
        },
      }),
    );

    await expect(fetchUrl('https://github.com/large.txt')).rejects.toThrow(
      'Resposta excede o limite',
    );
  });
});
