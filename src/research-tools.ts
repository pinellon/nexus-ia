import net from 'node:net';
import { lookup } from 'node:dns/promises';
import { readdir, readFile as readFsFile, stat } from 'node:fs/promises';
import path from 'node:path';

const MAX_FETCH_CHARS = 12_000;
const MAX_FETCH_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const MAX_RESULTS = 5;
const MAX_FILE_SEARCH_RESULTS = 10;
const MAX_FILE_SIZE_BYTES = 512 * 1024;
const MIN_SEARCH_SCORE = 0.1;
const RESEARCH_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 5 * 60_000; // 5 minutes

// Simple TTL cache for research results
const researchCache = new Map<string, { data: ResearchResult[]; ts: number }>();

function getCached(key: string): ResearchResult[] | null {
  const entry = researchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    researchCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: ResearchResult[]): void {
  // Limit cache size to prevent memory issues
  if (researchCache.size > 100) {
    const firstKey = researchCache.keys().next().value;
    if (firstKey) researchCache.delete(firstKey);
  }
  researchCache.set(key, { data, ts: Date.now() });
}

const DEFAULT_FETCH_URL_ALLOWLIST = new Set([
  'github.com',
  'raw.githubusercontent.com',
  'docs.python.org',
  'developer.mozilla.org',
  'npmjs.com',
  'www.npmjs.com',
]);

const BLOCKED_HOSTNAMES = new Set(['metadata.google.internal']);
const ALLOWED_CONTENT_TYPE_PREFIXES = [
  'text/',
  'application/json',
  'application/javascript',
  'application/x-javascript',
  'application/xml',
  'application/xhtml+xml',
];

/** Extensions that are noisy or binary — skipped during project file search. */
const NOISY_EXTENSIONS = new Set([
  '.lock',
  '.min.js',
  '.min.css',
  '.map',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.zip',
  '.tar',
  '.gz',
  '.bin',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.pdf',
]);

/** Directories to skip during project file search. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.tmp-tests', '.tmp-preview', 'build']);

export interface ResearchResult {
  title: string;
  url: string;
  snippet: string;
  source: 'web' | 'github' | 'fetch' | 'project';
}

function allowedFetchHosts() {
  const configured = process.env.NEXUS_FETCH_URL_ALLOWLIST;
  if (!configured) {
    return DEFAULT_FETCH_URL_ALLOWLIST;
  }

  return new Set(
    configured
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isAllowedFetchHost(hostname: string) {
  return allowedFetchHosts().has(hostname);
}

export function ensureSafeHttpUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('URL invalida');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Apenas URLs https sao permitidas');
  }

  const hostname = url.hostname.toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(hostname) && !hostname.includes(':')) {
    throw new Error('Hostname invalido');
  }

  const normalizedHost = hostname.replace(/^\[|\]$/g, '');
  if (
    normalizedHost === 'localhost' ||
    normalizedHost.endsWith('.localhost') ||
    normalizedHost.endsWith('.local') ||
    BLOCKED_HOSTNAMES.has(normalizedHost)
  ) {
    throw new Error('URLs locais nao sao permitidas');
  }

  if (isBlockedIpAddress(normalizedHost)) {
    throw new Error('Acesso a rede privada nao permitido');
  }

  if (!isAllowedFetchHost(normalizedHost)) {
    throw new Error('Dominio nao permitido para fetch-url');
  }

  return url;
}

function isAllowedContentType(contentType: string) {
  if (!contentType) {
    return true;
  }
  const normalized = contentType.split(';', 1)[0].trim().toLowerCase();
  return ALLOWED_CONTENT_TYPE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

async function assertPublicDnsTarget(url: URL) {
  if (net.isIP(url.hostname)) {
    return;
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length) {
    throw new Error('Host sem endereco DNS resolvido');
  }

  for (const address of addresses) {
    if (isBlockedIpAddress(address.address)) {
      throw new Error('Resolucao DNS aponta para rede privada');
    }
  }
}

async function readLimitedResponseText(response: Response) {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_FETCH_BYTES) {
    throw new Error('Resposta excede o limite permitido');
  }

  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_FETCH_BYTES) {
      throw new Error('Resposta excede o limite permitido');
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    total += value.byteLength;
    if (total > MAX_FETCH_BYTES) {
      await reader.cancel();
      throw new Error('Resposta excede o limite permitido');
    }
    chunks.push(value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function fetchSafeUrl(url: URL, redirectsLeft = MAX_REDIRECTS): Promise<Response> {
  await assertPublicDnsTarget(url);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Nexus-IA',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(RESEARCH_TIMEOUT_MS),
  });

  if (response.status >= 300 && response.status < 400) {
    if (redirectsLeft <= 0) {
      throw new Error('Limite de redirects excedido');
    }
    const location = response.headers.get('location');
    if (!location) {
      throw new Error('Redirect sem Location');
    }
    const nextUrl = ensureSafeHttpUrl(new URL(location, url).href);
    return fetchSafeUrl(nextUrl, redirectsLeft - 1);
  }

  return response;
}

function isBlockedIpAddress(hostname: string) {
  const ipVersion = net.isIP(hostname);
  if (!ipVersion) {
    return false;
  }

  if (ipVersion === 6) {
    const normalized = hostname.toLowerCase();
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('::ffff:127.') ||
      normalized.startsWith('::ffff:10.') ||
      normalized.startsWith('::ffff:192.168.') ||
      /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(normalized)
    );
  }

  const parts = hostname.split('.').map((part) => Number(part));
  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127) ||
    first >= 224
  );
}

function trimText(value: string, max = MAX_FETCH_CHARS) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function buildGitHubHeaders() {
  return {
    'User-Agent': 'Nexus-IA',
    Accept: 'application/vnd.github+json',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  };
}

export async function webSearch(query: string): Promise<ResearchResult[]> {
  if (!query.trim()) {
    throw new Error('query e obrigatoria');
  }

  const cacheKey = `web:${query}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'Nexus-IA',
    },
    signal: AbortSignal.timeout(RESEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Falha na pesquisa web: ${response.status}`);
  }

  const html = await response.text();
  const matches = [
    ...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi),
  ];

  const webResults = matches.slice(0, MAX_RESULTS).map((match) => ({
    title: trimText(stripHtml(match[2]), 180),
    url: match[1],
    snippet: 'Resultado obtido pela camada de pesquisa web do Nexus.',
    source: 'web' as const,
  }));
  setCache(cacheKey, webResults);
  return webResults;
}

export async function githubSearch(query: string): Promise<ResearchResult[]> {
  if (!query.trim()) {
    throw new Error('query e obrigatoria');
  }

  const cacheKey = `gh:${query}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${MAX_RESULTS}`,
    { headers: buildGitHubHeaders(), signal: AbortSignal.timeout(RESEARCH_TIMEOUT_MS) },
  );

  if (!response.ok) {
    throw new Error(`Falha na pesquisa GitHub: ${response.status}`);
  }

  const data = (await response.json()) as {
    items?: Array<{ full_name?: string; html_url?: string; description?: string }>;
  };

  const ghResults = (data.items ?? []).map((item) => ({
    title: item.full_name || 'Repositorio',
    url: item.html_url || 'https://github.com',
    snippet: trimText(item.description || 'Repositorio encontrado via GitHub Search.', 220),
    source: 'github' as const,
  }));
  setCache(cacheKey, ghResults);
  return ghResults;
}

export async function githubRepoSearch(repo: string, query: string): Promise<ResearchResult[]> {
  if (!repo.trim() || !query.trim()) {
    throw new Error('repo e query sao obrigatorios');
  }

  const response = await fetch(
    `https://api.github.com/search/code?q=${encodeURIComponent(`${query} repo:${repo}`)}&per_page=${MAX_RESULTS}`,
    { headers: buildGitHubHeaders(), signal: AbortSignal.timeout(RESEARCH_TIMEOUT_MS) },
  );

  if (!response.ok) {
    throw new Error(`Falha na pesquisa de codigo GitHub: ${response.status}`);
  }

  const data = (await response.json()) as {
    items?: Array<{ html_url?: string; path?: string; repository?: { full_name?: string } }>;
  };

  return (data.items ?? []).map((item) => ({
    title: `${item.repository?.full_name || repo} :: ${item.path || 'arquivo'}`,
    url: item.html_url || `https://github.com/${repo}`,
    snippet: 'Arquivo encontrado na pesquisa de codigo do GitHub.',
    source: 'github' as const,
  }));
}

export async function fetchUrl(url: string): Promise<ResearchResult> {
  const safeUrl = ensureSafeHttpUrl(url);
  const response = await fetchSafeUrl(safeUrl);

  if (!response.ok) {
    throw new Error(`Falha ao buscar URL: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!isAllowedContentType(contentType)) {
    throw new Error('Content-Type nao permitido para fetch-url');
  }
  const raw = await readLimitedResponseText(response);
  const body = contentType.includes('html') ? stripHtml(raw) : raw;

  return {
    title: safeUrl.href,
    url: safeUrl.href,
    snippet: trimText(body),
    source: 'fetch',
  };
}

export async function fetchGitHubFile(url: string): Promise<ResearchResult> {
  const safeUrl = ensureSafeHttpUrl(url);
  if (safeUrl.hostname !== 'github.com' && safeUrl.hostname !== 'raw.githubusercontent.com') {
    throw new Error('Apenas arquivos do GitHub sao suportados nesta ferramenta');
  }

  const rawUrl =
    safeUrl.hostname === 'raw.githubusercontent.com'
      ? safeUrl.href
      : safeUrl.href.replace('github.com/', 'raw.githubusercontent.com/').replace('/blob/', '/');

  return fetchUrl(rawUrl);
}

interface ScoredFile {
  relativePath: string;
  score: number;
  snippet: string;
}

function scoreMatch(query: string, relativePath: string, content: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerPath = relativePath.toLowerCase();
  const basename = path.basename(lowerPath);

  let score = 0;

  // Highest weight: filename match
  if (basename.includes(lowerQuery)) {
    score += 1.0;
  }

  // Medium weight: directory/path match
  if (lowerPath.includes(lowerQuery)) {
    score += 0.6;
  }

  // Lower weight: content match (count occurrences, cap at 5)
  const lowerContent = content.toLowerCase();
  let pos = 0;
  let occurrences = 0;
  while (occurrences < 5) {
    const idx = lowerContent.indexOf(lowerQuery, pos);
    if (idx === -1) break;
    occurrences++;
    pos = idx + 1;
  }
  score += occurrences * 0.3;

  return score;
}

function extractSnippet(content: string, query: string, maxLength = 200): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerContent.indexOf(lowerQuery);

  if (idx === -1) {
    return content.slice(0, maxLength).trim();
  }

  const start = Math.max(0, idx - 60);
  const end = Math.min(content.length, idx + query.length + 140);
  const snippet = content.slice(start, end).replace(/\s+/g, ' ').trim();
  return start > 0 ? `...${snippet}` : snippet;
}

async function collectSearchFiles(
  dir: string,
  baseDir: string,
  results: Array<{ absolutePath: string; relativePath: string }>,
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await collectSearchFiles(path.join(dir, entry.name), baseDir, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (NOISY_EXTENSIONS.has(ext)) continue;
      const absolutePath = path.join(dir, entry.name);
      results.push({
        absolutePath,
        relativePath: path.relative(baseDir, absolutePath).replace(/\\/g, '/'),
      });
    }
  }
}

/**
 * Searches project files for a query string, scoring results by relevance.
 *
 * @param query - The search query.
 * @param projectRoot - Absolute path to the project root directory.
 * @returns Top-scored matching files with snippets.
 */
export async function searchProjectFiles(
  query: string,
  projectRoot: string,
): Promise<ResearchResult[]> {
  if (!query.trim()) {
    throw new Error('query e obrigatoria');
  }

  const files: Array<{ absolutePath: string; relativePath: string }> = [];
  await collectSearchFiles(projectRoot, projectRoot, files);

  const scored: ScoredFile[] = [];

  for (const file of files) {
    let fileInfo;
    try {
      fileInfo = await stat(file.absolutePath);
    } catch {
      continue;
    }

    if (fileInfo.size > MAX_FILE_SIZE_BYTES) {
      continue;
    }

    let content = '';
    try {
      content = await readFsFile(file.absolutePath, 'utf8');
    } catch {
      continue;
    }

    const score = scoreMatch(query, file.relativePath, content);
    if (score < MIN_SEARCH_SCORE) continue;

    scored.push({
      relativePath: file.relativePath,
      score,
      snippet: extractSnippet(content, query),
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_FILE_SEARCH_RESULTS)
    .map((item) => ({
      title: path.basename(item.relativePath),
      url: item.relativePath,
      snippet: item.snippet,
      source: 'project' as const,
    }));
}
