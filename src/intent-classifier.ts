export type NexusIntent =
  | 'code'
  | 'debug'
  | 'architecture'
  | 'test'
  | 'security'
  | 'ui'
  | 'refactor'
  | 'research'
  | 'deploy'
  | 'performance'
  | 'documentation'
  | 'general';

export interface IntentScore {
  intent: NexusIntent;
  score: number;
}

export interface ClassificationResult {
  primary: NexusIntent;
  scores: IntentScore[];
  confidence: number;
  multiIntent: NexusIntent[];
}

const INTENT_RULES: Array<{ intent: NexusIntent; keywords: string[]; weight?: number }> = [
  {
    intent: 'debug',
    keywords: [
      'bug', 'erro', 'error', 'falha', 'stack', 'exception', 'corrige', 'conserta',
      'debug', 'crash', 'fix', 'broken', 'nao funciona', 'not working', 'undefined',
      'null', 'traceback', 'segfault', 'panic',
    ],
    weight: 1.2,
  },
  {
    intent: 'architecture',
    keywords: [
      'arquitet', 'estrutura', 'modulo', 'design pattern', 'organiza', 'service',
      'repository', 'camada', 'layer', 'microservice', 'monolito', 'pattern',
      'solid', 'clean arch', 'hexagonal', 'ddd',
    ],
  },
  {
    intent: 'test',
    keywords: [
      'test', 'teste', 'vitest', 'jest', 'playwright', 'cobertura', 'spec',
      'coverage', 'e2e', 'unit test', 'integration test', 'mock', 'stub',
      'tdd', 'assertion', 'expect',
    ],
  },
  {
    intent: 'security',
    keywords: [
      'seguranca', 'security', 'vulnerab', 'auth', 'token', 'permiss', 'xss',
      'csrf', 'injection', 'sql inject', 'sanitiz', 'encrypt', 'hash',
      'password', 'senha', 'oauth', 'jwt', 'cors', 'helmet',
    ],
    weight: 1.3,
  },
  {
    intent: 'research',
    keywords: [
      'pesquisa', 'pesquisar', 'search', 'docs', 'documentacao', 'github',
      'referencia', 'versao', 'como funciona', 'what is', 'o que e',
      'explain', 'explique', 'npm', 'package', 'biblioteca', 'library',
    ],
  },
  {
    intent: 'refactor',
    keywords: [
      'refator', 'refactor', 'cleanup', 'melhora estrutura', 'extrair', 'simplifica',
      'rename', 'renomear', 'extract', 'inline', 'mover', 'move',
      'dedup', 'dry', 'split', 'separar',
    ],
  },
  {
    intent: 'ui',
    keywords: [
      'ui', 'ux', 'layout', 'css', 'tailwind', 'componente', 'frontend',
      'monaco', 'interface', 'botao', 'button', 'modal', 'dialog',
      'responsiv', 'animacao', 'animation', 'style', 'estilo', 'dark mode',
      'tema', 'theme', 'react', 'vue', 'svelte',
    ],
  },
  {
    intent: 'code',
    keywords: [
      'cria', 'implemente', 'implementa', 'codigo', 'code', 'funcao', 'function',
      'endpoint', 'api', 'route', 'rota', 'classe', 'class', 'metodo',
      'method', 'adiciona', 'add', 'feature', 'nova funcionalidade',
    ],
  },
  {
    intent: 'deploy',
    keywords: [
      'deploy', 'publicar', 'publish', 'build', 'ci', 'cd', 'pipeline',
      'docker', 'container', 'vercel', 'netlify', 'aws', 'heroku',
      'producao', 'production', 'staging', 'release',
    ],
  },
  {
    intent: 'performance',
    keywords: [
      'performance', 'lento', 'slow', 'otimiz', 'optimiz', 'cache',
      'lazy', 'bundle', 'chunk', 'memory', 'memoria', 'leak',
      'profil', 'benchmark', 'rapido', 'fast',
    ],
  },
  {
    intent: 'documentation',
    keywords: [
      'documenta', 'readme', 'jsdoc', 'typedoc', 'comentario', 'comment',
      'swagger', 'openapi', 'changelog', 'wiki', 'guia', 'guide',
      'tutorial', 'howto',
    ],
  },
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns full classification with scores for all intents.
 */
export function classifyIntentFull(prompt: string): ClassificationResult {
  const normalized = prompt.toLowerCase();
  const scores: IntentScore[] = [];

  for (const rule of INTENT_RULES) {
    let matchCount = 0;
    const weight = rule.weight ?? 1.0;

    for (const keyword of rule.keywords) {
      if (keyword.includes(' ')) {
        if (normalized.includes(keyword)) matchCount++;
      } else {
        if (new RegExp(`\\b${escapeRegExp(keyword)}`, 'i').test(normalized)) matchCount++;
      }
    }

    const score = matchCount > 0
      ? Math.min(((matchCount / rule.keywords.length) * weight * 2), 1.0)
      : 0;

    scores.push({ intent: rule.intent, score });
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  const primary = scores[0]?.score > 0 ? scores[0].intent : 'general';
  const confidence = scores[0]?.score ?? 0;

  // Multi-intent: include intents with score > 0.15 and at least 50% of the top score
  const threshold = Math.max(0.15, confidence * 0.5);
  const multiIntent = scores
    .filter((s) => s.score >= threshold)
    .map((s) => s.intent)
    .slice(0, 3);

  return {
    primary,
    scores,
    confidence,
    multiIntent: multiIntent.length > 0 ? multiIntent : [primary],
  };
}

/**
 * Simple classification returning just the primary intent.
 * Backwards-compatible with existing code.
 */
export function classifyIntent(prompt: string): NexusIntent {
  return classifyIntentFull(prompt).primary;
}
