const MAX_FETCH_CHARS = 12_000;
const MAX_RESULTS = 5;

export interface ResearchResult {
  title: string;
  url: string;
  snippet: string;
  source: "web" | "github" | "fetch";
}

function ensureSafeHttpUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("URL invalida");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Apenas URLs http/https sao permitidas");
  }

  const hostname = url.hostname.toLowerCase();
  const blockedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (blockedHosts.has(hostname)) {
    throw new Error("URLs locais nao sao permitidas");
  }

  if (
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    throw new Error("Acesso a rede privada nao permitido");
  }

  return url;
}

function trimText(value: string, max = MAX_FETCH_CHARS) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function buildGitHubHeaders() {
  return {
    "User-Agent": "Nexus-IA",
    Accept: "application/vnd.github+json",
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
  };
}

export async function webSearch(query: string): Promise<ResearchResult[]> {
  if (!query.trim()) {
    throw new Error("query e obrigatoria");
  }

  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      "User-Agent": "Nexus-IA"
    }
  });

  if (!response.ok) {
    throw new Error(`Falha na pesquisa web: ${response.status}`);
  }

  const html = await response.text();
  const matches = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];

  return matches.slice(0, MAX_RESULTS).map((match) => ({
    title: trimText(stripHtml(match[2]), 180),
    url: match[1],
    snippet: "Resultado obtido pela camada de pesquisa web do Nexus.",
    source: "web" as const
  }));
}

export async function githubSearch(query: string): Promise<ResearchResult[]> {
  if (!query.trim()) {
    throw new Error("query e obrigatoria");
  }

  const response = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${MAX_RESULTS}`,
    { headers: buildGitHubHeaders() }
  );

  if (!response.ok) {
    throw new Error(`Falha na pesquisa GitHub: ${response.status}`);
  }

  const data = (await response.json()) as {
    items?: Array<{ full_name?: string; html_url?: string; description?: string }>;
  };

  return (data.items ?? []).map((item) => ({
    title: item.full_name || "Repositorio",
    url: item.html_url || "https://github.com",
    snippet: trimText(item.description || "Repositorio encontrado via GitHub Search.", 220),
    source: "github" as const
  }));
}

export async function githubRepoSearch(repo: string, query: string): Promise<ResearchResult[]> {
  if (!repo.trim() || !query.trim()) {
    throw new Error("repo e query sao obrigatorios");
  }

  const response = await fetch(
    `https://api.github.com/search/code?q=${encodeURIComponent(`${query} repo:${repo}`)}&per_page=${MAX_RESULTS}`,
    { headers: buildGitHubHeaders() }
  );

  if (!response.ok) {
    throw new Error(`Falha na pesquisa de codigo GitHub: ${response.status}`);
  }

  const data = (await response.json()) as {
    items?: Array<{ html_url?: string; path?: string; repository?: { full_name?: string } }>;
  };

  return (data.items ?? []).map((item) => ({
    title: `${item.repository?.full_name || repo} :: ${item.path || "arquivo"}`,
    url: item.html_url || `https://github.com/${repo}`,
    snippet: "Arquivo encontrado na pesquisa de codigo do GitHub.",
    source: "github" as const
  }));
}

export async function fetchUrl(url: string): Promise<ResearchResult> {
  const safeUrl = ensureSafeHttpUrl(url);
  const response = await fetch(safeUrl, {
    headers: {
      "User-Agent": "Nexus-IA"
    }
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar URL: ${response.status}`);
  }

  const raw = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("html") ? stripHtml(raw) : raw;

  return {
    title: safeUrl.href,
    url: safeUrl.href,
    snippet: trimText(body),
    source: "fetch"
  };
}

export async function fetchGitHubFile(url: string): Promise<ResearchResult> {
  const safeUrl = ensureSafeHttpUrl(url);
  if (safeUrl.hostname !== "github.com" && safeUrl.hostname !== "raw.githubusercontent.com") {
    throw new Error("Apenas arquivos do GitHub sao suportados nesta ferramenta");
  }

  const rawUrl = safeUrl.hostname === "raw.githubusercontent.com"
    ? safeUrl.href
    : safeUrl.href.replace("github.com/", "raw.githubusercontent.com/").replace("/blob/", "/");

  return fetchUrl(rawUrl);
}
