export type NexusIntent =
  | "code"
  | "debug"
  | "architecture"
  | "test"
  | "security"
  | "ui"
  | "refactor"
  | "research"
  | "general";

const INTENT_RULES: Array<{ intent: NexusIntent; keywords: string[] }> = [
  {
    intent: "debug",
    keywords: ["bug", "erro", "falha", "stack", "exception", "corrige", "conserta", "debug"]
  },
  {
    intent: "architecture",
    keywords: ["arquitet", "estrutura", "modulo", "design", "organiza", "service", "repository", "camada"]
  },
  {
    intent: "test",
    keywords: ["test", "teste", "vitest", "jest", "playwright", "cobertura", "spec"]
  },
  {
    intent: "security",
    keywords: ["seguranca", "security", "vulnerab", "auth", "token", "permiss", "xss", "csrf"]
  },
  {
    intent: "research",
    keywords: ["pesquisa", "pesquisar", "search", "docs", "documentacao", "github", "referencia", "versao"]
  },
  {
    intent: "refactor",
    keywords: ["refator", "refactor", "cleanup", "melhora estrutura", "extrair", "simplifica"]
  },
  {
    intent: "ui",
    keywords: ["ui", "ux", "layout", "css", "tailwind", "componente", "frontend", "monaco", "interface"]
  },
  {
    intent: "code",
    keywords: ["cria", "implemente", "implementa", "codigo", "refatora", "refatore", "função", "funcao", "endpoint", "api"]
  }
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function classifyIntent(prompt: string): NexusIntent {
  const normalized = prompt.toLowerCase();

  for (const rule of INTENT_RULES) {
    if (
      rule.keywords.some((keyword) => {
        if (keyword.includes(" ")) {
          return normalized.includes(keyword);
        }

        return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(normalized);
      })
    ) {
      return rule.intent;
    }
  }

  return "general";
}
