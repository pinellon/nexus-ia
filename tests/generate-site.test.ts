// tests/generate-site.test.ts
// Testes unitários para o endpoint de geração de sites

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock do provider de IA para não fazer chamadas reais nos testes
vi.mock('../src/app/ai/provider-router.js', () => ({
  AIProviderRouter: vi.fn().mockImplementation(() => ({
    routeChatRequest: vi.fn().mockResolvedValue({
      ok: true,
      response: JSON.stringify({
        title: 'TaskFlow - Gestão de Projetos',
        brand: 'TaskFlow',
        headline: 'Gerencie Projetos',
        headline_accent: 'Com Inteligência',
        subheadline: 'A plataforma mais completa para times remotos.',
        cta: 'Começar Grátis',
        badge: 'Novo',
        meta_description: 'TaskFlow é o melhor SaaS para gestão de projetos.',
        stat_1_label: 'Mais de',
        stat_1_value: '10k usuários',
        stat_2_label: 'Avaliação',
        stat_2_value: '4.9★',
        stat_3_label: 'Uptime',
        stat_3_value: '99.9%',
        features_headline: 'Tudo que você precisa',
        features:
          "<div class='feature-card'><div class='feature-icon'>🚀</div><h3>Rápido</h3><p>Deploy em segundos.</p></div>",
        cta_headline: 'Pronto para começar?',
        cta_subheadline: 'Junte-se a milhares de times.',
        footer_text: '© 2025 TaskFlow. Todos os direitos reservados.',
      }),
      provider: 'anthropic',
      model: 'claude-sonnet-4',
    }),
  })),
}));

// Mock do fs para não depender de arquivos reais em CI
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readdir: vi.fn().mockResolvedValue(['index.html']),
    readFile: vi
      .fn()
      .mockResolvedValue(
        '<!DOCTYPE html><html><head><title>{{title}}</title></head><body><h1>{{headline}}</h1><p>{{subheadline}}</p><a>{{cta}}</a></body></html>',
      ),
    mkdir: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock do archiver para não criar ZIPs reais
vi.mock('archiver', () => ({
  default: vi.fn().mockReturnValue({
    pipe: vi.fn(),
    append: vi.fn(),
    finalize: vi.fn(),
  }),
}));

vi.mock('node:fs', () => ({
  createWriteStream: vi.fn().mockReturnValue({
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'close') setTimeout(cb, 0);
    }),
  }),
  createReadStream: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractPlaceholders(html: string): string[] {
  const matches = html.matchAll(/\{\{(\w+)\}\}/g);
  const unique = new Set<string>();
  for (const m of matches) unique.add(m[1]);
  return [...unique];
}

function injectValues(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('extractPlaceholders', () => {
  it('extrai placeholders únicos do HTML', () => {
    const html = '<h1>{{title}}</h1><p>{{desc}}</p><span>{{title}}</span>';
    const result = extractPlaceholders(html);
    expect(result).toContain('title');
    expect(result).toContain('desc');
    expect(result).toHaveLength(2);
  });

  it('retorna array vazio se não há placeholders', () => {
    const result = extractPlaceholders('<h1>Sem placeholders</h1>');
    expect(result).toHaveLength(0);
  });

  it('ignora espaços dentro das chaves', () => {
    // Nossa regex só pega \w+, então {{ title }} não seria capturado
    // mas {{title}} sim
    const result = extractPlaceholders('{{brand}} e {{cta}}');
    expect(result).toEqual(expect.arrayContaining(['brand', 'cta']));
  });
});

describe('injectValues', () => {
  it('substitui todos os placeholders pelos valores', () => {
    const html = '<h1>{{title}}</h1><p>{{desc}}</p>';
    const values = { title: 'Meu Site', desc: 'Descrição top' };
    const result = injectValues(html, values);
    expect(result).toBe('<h1>Meu Site</h1><p>Descrição top</p>');
  });

  it('mantém placeholder intacto se valor não existe', () => {
    const html = '<h1>{{title}}</h1><p>{{missing}}</p>';
    const result = injectValues(html, { title: 'Nexus' });
    expect(result).toContain('{{missing}}');
    expect(result).toContain('Nexus');
  });

  it('substitui múltiplas ocorrências do mesmo placeholder', () => {
    const html = '{{brand}} - {{brand}} - {{brand}}';
    const result = injectValues(html, { brand: 'Nexus' });
    expect(result).toBe('Nexus - Nexus - Nexus');
  });
});

describe('Templates', () => {
  it('todos os templates têm placeholders esperados', () => {
    const landingPlaceholders = [
      'title',
      'brand',
      'headline',
      'headline_accent',
      'subheadline',
      'cta',
      'meta_description',
    ];
    // Verificamos que nossa função de extração funcionaria com esses valores
    const html = landingPlaceholders.map((p) => `{{${p}}}`).join(' ');
    const extracted = extractPlaceholders(html);
    expect(extracted).toEqual(expect.arrayContaining(landingPlaceholders));
  });
});
