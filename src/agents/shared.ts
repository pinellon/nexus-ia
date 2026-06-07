import type { AgentInput, AgentName } from './types.js';

export function isEnabledEnv(value: string | undefined, fallback: boolean) {
  if (value == null || value === '') {
    return fallback;
  }

  return value.toLowerCase() === 'true';
}

function phaseInstructions(phase: AgentInput['phase']): string {
  switch (phase) {
    case 'planning':
      return [
        'FASE: PLANEJAMENTO.',
        'Entregue um plano claro e acionavel contendo:',
        '- Arquivos que serao afetados e por que.',
        '- Dependencias entre alteracoes.',
        '- Riscos identificados e mitigacoes.',
        '- Estimativa de complexidade (baixa/media/alta).',
        'Nao gere codigo nesta fase, apenas o plano.',
      ].join('\n');
    case 'proposal':
      return [
        'FASE: PROPOSTA.',
        'Entregue implementacao concreta e revisavel:',
        '- Codigo completo (sem placeholders tipo "// implemente aqui").',
        '- Acoes estruturadas em JSON dentro de blocos ```json quando alterar arquivos.',
        '- Cada acao deve ter: type, path, content/before/after, reason, riskLevel.',
        '- Priorize patches pequenos, testaveis e reversiveis.',
        '- Inclua comandos de validacao (typecheck, build, test) como acoes run_command.',
      ].join('\n');
    case 'review':
      return [
        'FASE: REVISAO CRUZADA.',
        'Revise as propostas dos outros agentes com foco em:',
        '- Seguranca: XSS, SSRF, injection, path traversal, segredos expostos.',
        '- Corretude: edge cases, null/undefined, race conditions, tipagem.',
        '- Regressao: mudancas que podem quebrar funcionalidades existentes.',
        '- Performance: loops desnecessarios, queries N+1, memory leaks.',
        '- Testabilidade: a mudanca pode ser validada automaticamente?',
        'Se encontrar problemas, sugira a correcao especifica.',
      ].join('\n');
    default:
      return '';
  }
}

export function buildBaseAgentPrompt(agent: AgentName, role: string, input: AgentInput) {
  return [
    'Voce esta dentro do Nexus IA, um aplicativo IDE assistido por multiplos agentes.',
    'O usuario coda manualmente e voce ajuda.',
    'Voce nao aplica alteracoes diretamente.',
    'Voce deve propor mudancas seguras, funcionais e testaveis.',
    'Quando sugerir alterar arquivos, entregue acoes estruturadas.',
    'Sempre explique riscos, dependencias e como testar.',
    '',
    phaseInstructions(input.phase),
    '',
    `Agente atual: ${agent}.`,
    `Responsabilidade principal: ${role}.`,
    `Intencao detectada: ${input.intent}.`,
    input.language ? `Linguagem principal: ${input.language}.` : '',
    input.context ? `Contexto do projeto:\n${input.context}` : '',
    input.researchSummary ? `Pesquisa disponivel:\n${input.researchSummary}` : '',
    input.otherAgentSummaries?.length
      ? `Outros agentes disseram:\n${input.otherAgentSummaries
          .map((entry) => `- ${entry.agent}: ${entry.content}`)
          .join('\n')}`
      : '',
    `Pedido do usuario:\n${input.prompt}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildMockAgentResponse(agent: AgentName, role: string, input: AgentInput) {
  const isNoProvider = !process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY;

  if (isNoProvider) {
    return [
      `[${agent.toUpperCase()}] Modo offline — nenhuma API key configurada.`,
      '',
      'Para ativar respostas inteligentes:',
      '1. Defina ANTHROPIC_API_KEY ou OPENAI_API_KEY no .env',
      '2. Ou inicie Ollama local (ollama serve) e configure em Configuracoes > IA',
      '3. Reinicie o servidor Nexus apos salvar',
      '',
      `Fase: ${input.phase} | Intencao: ${input.intent} | Papel: ${role}`,
    ].join('\n');
  }

  const base = [
    `Diagnostico (${agent}):`,
    `- Fase: ${input.phase}.`,
    `- Intencao: ${input.intent}.`,
    `- Papel: ${role}.`,
    '- O Nexus deve propor alteracoes com confirmacao humana antes de aplicar.',
    '- Preferir mudancas pequenas, reversiveis e testaveis.',
  ];

  if (input.phase === 'planning') {
    return `${base.join('\n')}\n- Plano: revisar arquivos afetados, preparar diff e validar com build/typecheck.`;
  }

  if (input.phase === 'review') {
    return `${base.join('\n')}\n- Revisao cruzada: conferir riscos, regressao, seguranca e compatibilidade com o workspace.`;
  }

  const actionHint =
    agent === 'codex' && input.context?.includes('Arquivo aberto:')
      ? [
          '',
          'Acao estruturada sugerida:',
          '```json',
          JSON.stringify(
            {
              type: 'patch_file',
              path: input.context.match(/Arquivo aberto:\s*([^\n\r]+)/i)?.[1] || 'src/example.ts',
              before: input.context.split('Conteudo atual do editor:')[1]?.trim() || '',
              after: `${input.context.split('Conteudo atual do editor:')[1]?.trim() || ''}\n// Review this Nexus proposal before applying.\n`,
              reason: 'Aplicar uma melhoria pequena e revisavel no arquivo atual',
              riskLevel: 'low',
              requiresConfirmation: true,
            },
            null,
            2,
          ),
          '```',
        ].join('\n')
      : '';

  return `${base.join('\n')}\n- Proposta: gerar acoes estruturadas, listar arquivos afetados e sugerir comandos de validacao.${actionHint}`;
}
