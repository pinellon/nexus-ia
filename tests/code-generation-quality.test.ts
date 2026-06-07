import { describe, expect, it } from 'vitest';

import {
  buildProfessionalFallbackContent,
  defaultPathForAgent,
  PROFESSIONAL_CODE_STANDARDS,
} from '../src/app/agents/code-generation.js';
import { agentRegistry } from '../src/app/agents/registry.js';

describe('professional code generation baseline', () => {
  it('defines explicit professional quality standards for generated code', () => {
    expect(PROFESSIONAL_CODE_STANDARDS.join('\n')).toContain('codigo completo');
    expect(PROFESSIONAL_CODE_STANDARDS.join('\n')).toContain('placeholders');
    expect(PROFESSIONAL_CODE_STANDARDS.join('\n')).toContain('acessibilidade');
    expect(PROFESSIONAL_CODE_STANDARDS.join('\n')).toContain('seguranca');
  });

  it('generates a professional HTML fallback instead of a bare draft', () => {
    const html = buildProfessionalFallbackContent({
      goal: 'Crie uma landing page profissional para o Nexus Codex',
      targetPath: 'index.html',
      projectRoot: 'workspace',
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('aria-label');
    expect(html).toContain('features');
    expect(html).toContain('menu-grid');
    expect(html).toContain('testimonials');
    expect(html).toContain('<img');
    expect(html.length).toBeGreaterThan(6_000);
    expect(html.toLowerCase()).not.toContain('lorem');
  });

  it('generates contextual landing copy for cafeteria prompts', () => {
    const html = buildProfessionalFallbackContent({
      goal: 'Crie um site profissional para uma cafeteria moderna, com hero, cardapio e contato',
      targetPath: 'public/index.html',
      projectRoot: 'workspace',
    });

    expect(html).toContain('Cafeteria Aurora');
    expect(html).toContain('Cardapio');
    expect(html).toContain('baristas');
    expect(html).toContain('Reservar mesa');
    expect(html).not.toContain('Nexus Codex');
  });

  it('generates a bakery landing page with product image, menu, testimonials, and WhatsApp CTA', () => {
    const html = buildProfessionalFallbackContent({
      goal: 'Crie um site profissional para uma confeitaria artesanal de bolos',
      targetPath: 'public/index.html',
      projectRoot: 'workspace',
    });

    expect(html).toContain('Atelie Dona Nuvem');
    expect(html).toContain('assets/bakery-hero.webp');
    expect(html).toContain('Chocolate belga');
    expect(html).toContain('Ninho com morango');
    expect(html).toContain('Depoimentos');
    expect(html).toContain('https://wa.me/');
    expect(html).not.toContain('Landing gerada localmente');
    expect(html).not.toContain('Patch Review');
  });

  it('keeps site and UI generation on frontend files in Express projects', () => {
    const expressStack = { name: 'Express/Node', defaultPath: 'src/server.ts' };

    expect(defaultPathForAgent('site_builder_agent', expressStack)).toBe('public/index.html');
    expect(defaultPathForAgent('ui_agent', expressStack)).toBe('public/index.html');
    expect(defaultPathForAgent('backend_agent', expressStack)).toBe('src/server.ts');
  });

  it('generates documentation fallback with review checklist', () => {
    const markdown = buildProfessionalFallbackContent({
      goal: 'Documente o fluxo de patches',
      targetPath: 'docs/patches.md',
      projectRoot: 'workspace',
    });

    expect(markdown).toContain('## Objetivo');
    expect(markdown).toContain('## Checklist de qualidade');
    expect(markdown).toContain('Patch Review');
  });

  it('adds the senior quality directive to code-producing agents', () => {
    const builder = agentRegistry.get('site_builder_agent');
    const backend = agentRegistry.get('backend_agent');

    expect(builder?.systemPrompt).toContain('nivel senior');
    expect(builder?.systemPrompt).toContain('sem placeholders pobres');
    expect(backend?.systemPrompt).toContain('tratamento de erro');
    expect(backend?.systemPrompt).toContain('Patch Review');
  });
});
