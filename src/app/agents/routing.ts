/** Agent routing and task classification for Nexus Codex */

export function suggestAgentId(goal: string): string {
  const lowered = goal.toLowerCase();

  if (
    /(erro|build|typecheck|teste|debug|falha)/.test(lowered) &&
    /(corrig|corrij|fix|resolver|consert)/.test(lowered) &&
    !/(criar|crie|gerar|gere|novo|nova|site|app|landing|componente|página|pagina|tela)/.test(
      lowered,
    )
  ) {
    return 'debug_agent';
  }

  if (
    /(readme|docs|documenta|changelog|markdown)/.test(lowered) &&
    !/(site|app|landing|criar|crie|componente|página|pagina|tela|interface)/.test(lowered)
  ) {
    return 'docs_agent';
  }

  if (/(seguran|token|secret|vulner|senha|password)/.test(lowered)) {
    return 'security_agent';
  }

  if (
    /(testar|testes|vitest|jest|coverage)/.test(lowered) &&
    !/(criar|crie|site|app)/.test(lowered)
  ) {
    return 'test_agent';
  }

  if (
    /(site|landing|dashboard|preview|app\b|aplicativo|página|pagina|tela|componente|interface|frontend|web\b|html|react|next|vue|svelte|ui\b|home\b|layout|responsiv|visual|página inicial)/.test(
      lowered,
    )
  ) {
    return 'site_builder_agent';
  }

  if (/(api|backend|endpoint|auth|banco|persist|servidor|rota\b|express)/.test(lowered)) {
    return 'backend_agent';
  }

  if (/(refactor|arquitetura|organiza|reorganiz|limp)/.test(lowered)) {
    return 'refactor_agent';
  }

  return 'site_builder_agent';
}

export function isCodeCreationGoal(goal: string): boolean {
  const normalized = goal.replace('++CONFIRM_PLAN++', '').trim().toLowerCase();
  if (!normalized) return false;

  if (
    /(apenas docs|somente readme|só documenta|only docs|documenta[çc][aã]o|readme)/.test(
      normalized,
    ) &&
    !/(site|app|landing|componente|página|pagina|tela|interface|html)/.test(normalized)
  ) {
    return false;
  }

  if (extractRequestedFilePath(goal)) {
    return true;
  }

  return /(criar|crie|gerar|gere|fazer|faça|implement|implementa|montar|desenvolv|construir|construa|adicion|adicione|melhor|melhore|atualiz|atualize|refator|refatore|corrig|corrija|fix|landing|site|app|página|pagina|tela|componente|interface|dashboard|layout|formul|botão|botao|menu|navbar|hero|section|página inicial)/.test(
    normalized,
  );
}

export function shouldRequirePlan(goal: string): boolean {
  const normalized = goal.replace('++CONFIRM_PLAN++', '').trim().toLowerCase();
  if (!normalized) return false;

  return /(site inteiro|app completo|aplicativo completo|dashboard completo|sistema completo|plataforma completa|múltiplos arquivos|multiplos arquivos|vários arquivos|varios arquivos|full stack|fullstack|refatora[çc][aã]o grande|migrar projeto|do zero completo)/.test(
    normalized,
  );
}

export function extractRequestedFilePath(goal: string) {
  const patterns = [
    /(?:crie|criar|create|gere|gerar|editar|edit|modificar|modify|atualizar|atualize|update)\s+(?:o\s+|a\s+|um\s+|uma\s+)?(?:arquivo\s+)?[`"']?([a-z0-9_./-]+\.[a-z0-9]+)[`"']?/i,
    /(?:atualizar|atualize|editar|edit|modificar|modify|update)\s+[`"']?([a-z0-9_./-]+\.[a-z0-9]+)[`"']?/i,
    /(?:em|no|na|em)\s+[`"']?([a-z0-9_./-]+\.[a-z0-9]+)[`"']?/i,
    /[`"']([a-z0-9_./-]+\.[a-z0-9]+)[`"']/i,
  ];

  for (const pattern of patterns) {
    const match = goal.match(pattern);
    const candidate = match?.[1]?.replace(/^\.?\//, '');
    if (candidate && !candidate.includes('..')) {
      return candidate;
    }
  }

  return null;
}
