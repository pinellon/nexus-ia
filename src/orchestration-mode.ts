export type OrchestrationMode = 'single' | 'reviewed' | 'consensus';
export type CostLevel = 'low' | 'medium' | 'high';

export interface ModeDecision {
  mode: OrchestrationMode;
  reason: string;
  estimated_cost_level: CostLevel;
  agents: string[];
}

const CRITICAL_PATTERNS = [
  /segura[nç]/i,
  /autentica/i,
  /auth/i,
  /token/i,
  /secret/i,
  /refatora[çc][aã]o grande/i,
  /action-executor/i,
  /workspace-store/i,
  /server\.ts/i,
  /m[uú]ltiplos arquivos/i,
  /arquivos centrais/i,
  /permiss[aã]o/i,
  /vulnerab/i,
  /xss/i,
  /csrf/i,
  /criptograf/i,
];

const MEDIUM_PATTERNS = [
  /cri[ae] (tela|landing|dashboard|p[aá]gina)/i,
  /cri[ae] (componente)/i,
  /altera[rn]/i,
  /modifica[rn]/i,
  /corrig[ei]r? erro de build/i,
  /corrig[ei]r? (erro|falha)/i,
  /backend/i,
  /endpoint/i,
  /api/i,
  /banco de dados/i,
  /refator/i,
  /reorganiz/i,
];

const SIMPLE_PATTERNS = [
  /cri[ae] arquivo/i,
  /gera[r]? readme/i,
  /explica[r]?/i,
  /o que [eé]/i,
  /ajusta[r]? texto/i,
  /documenta/i,
  /coment[ae]/i,
  /lista[r]?/i,
  /mostra[r]?/i,
  /qual [eé]/i,
];

function matchesAny(prompt: string, patterns: RegExp[]) {
  return patterns.some((p) => p.test(prompt));
}

export function selectOrchestrationMode(prompt: string, context?: string): ModeDecision {
  const combined = `${prompt}\n${context || ''}`;

  if (matchesAny(combined, CRITICAL_PATTERNS)) {
    return {
      mode: 'consensus',
      reason: 'Tarefa envolve segurança, autenticação ou múltiplos arquivos críticos.',
      estimated_cost_level: 'high',
      agents: ['claude', 'codex', 'antygravit'],
    };
  }

  if (matchesAny(combined, MEDIUM_PATTERNS)) {
    return {
      mode: 'reviewed',
      reason: 'Tarefa de complexidade média com revisão de segurança leve.',
      estimated_cost_level: 'medium',
      agents: ['codex', 'antygravit'],
    };
  }

  if (matchesAny(combined, SIMPLE_PATTERNS)) {
    return {
      mode: 'single',
      reason: 'Tarefa simples, um agente é suficiente.',
      estimated_cost_level: 'low',
      agents: ['codex'],
    };
  }

  // Default: reviewed for unknown prompts
  return {
    mode: 'reviewed',
    reason: 'Modo padrão com revisão leve para tarefa não classificada.',
    estimated_cost_level: 'medium',
    agents: ['codex', 'antygravit'],
  };
}
