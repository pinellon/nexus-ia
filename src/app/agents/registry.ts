import type { AgentDefinition } from "./models.js";

const DEFAULT_AGENTS: AgentDefinition[] = [
  {
    id: "ui_agent",
    name: "UI Agent",
    description: "Analisa interfaces, estrutura frontend e experiencia de uso para propor melhorias revisaveis.",
    systemPrompt:
      "Voce e um agente de frontend do Nexus Codex. Trabalhe com analise de layout, componentes, estado de UI e patches revisaveis. Nunca aplique mudancas automaticamente.",
    allowedTools: ["read_project_tree", "read_file", "search_files", "propose_patch", "generate_readme"],
    riskLevel: "medium"
  },
  {
    id: "backend_agent",
    name: "Backend Agent",
    description: "Mapeia rotas, servicos e contratos para propor mudancas seguras no backend.",
    systemPrompt:
      "Voce e um agente de backend do Nexus Codex. Foque em APIs, seguranca, validacao e compatibilidade. Produza artefatos e patches revisaveis.",
    allowedTools: ["read_project_tree", "read_file", "search_files", "propose_patch", "run_build"],
    riskLevel: "medium"
  },
  {
    id: "debug_agent",
    name: "Debug Agent",
    description: "Investiga erros de build, testes e problemas recorrentes com trilha de eventos clara.",
    systemPrompt:
      "Voce e um agente de debugging do Nexus Codex. Investigue sinais do projeto, rode validacoes seguras e gere diagnosticos objetivos sem aplicar alteracoes.",
    allowedTools: ["read_project_tree", "read_file", "search_files", "run_build", "run_tests", "analyze_error", "propose_patch"],
    riskLevel: "medium"
  },
  {
    id: "test_agent",
    name: "Test Agent",
    description: "Executa verificacoes seguras de build e testes e resume o estado de qualidade do projeto.",
    systemPrompt:
      "Voce e um agente de testes do Nexus Codex. Roda comandos seguros, resume falhas e sugere proximos passos sem alterar o codigo automaticamente.",
    allowedTools: ["read_project_tree", "run_tests", "run_build", "analyze_error"],
    riskLevel: "low"
  },
  {
    id: "security_agent",
    name: "Security Agent",
    description: "Procura sinais de risco, segredos e padroes inseguros em arquivos de codigo.",
    systemPrompt:
      "Voce e um agente de seguranca do Nexus Codex. Procure indicios de vulnerabilidade, segredos e execucoes perigosas. Responda com artefatos de revisao.",
    allowedTools: ["read_project_tree", "search_files", "read_file", "analyze_error"],
    riskLevel: "high"
  },
  {
    id: "docs_agent",
    name: "Docs Agent",
    description: "Entende a estrutura do projeto e prepara rascunhos de README e atualizacoes de documentacao.",
    systemPrompt:
      "Voce e um agente de documentacao do Nexus Codex. Gere drafts claros, estruturados e aplicaveis via Patch Review, sem escrita direta.",
    allowedTools: ["read_project_tree", "read_file", "generate_readme", "propose_patch"],
    riskLevel: "low"
  },
  {
    id: "refactor_agent",
    name: "Refactor Agent",
    description: "Mapeia areas de refatoracao e propõe caminhos de reorganizacao com cautela.",
    systemPrompt:
      "Voce e um agente de refatoracao do Nexus Codex. Foque em estrutura, responsabilidade e coesao. Gere planos e patches pequenos e revisaveis.",
    allowedTools: ["read_project_tree", "read_file", "search_files", "propose_patch", "run_build"],
    riskLevel: "medium"
  },
  {
    id: "site_builder_agent",
    name: "Site Builder Agent",
    description: "Prepara propostas para landing pages, dashboards e interfaces web com foco em produto e conversao.",
    systemPrompt:
      "Voce e um agente de construcao de sites do Nexus Codex. Analise a estrutura do frontend, proponha telas e componentes revisaveis e nunca aplique mudancas automaticamente.",
    allowedTools: ["read_project_tree", "read_file", "search_files", "propose_patch", "run_build"],
    riskLevel: "medium"
  }
];

export class AgentRegistry {
  private readonly agents = new Map<string, AgentDefinition>();

  constructor(definitions: AgentDefinition[] = DEFAULT_AGENTS) {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  register(definition: AgentDefinition) {
    this.agents.set(definition.id, definition);
  }

  get(agentId: string) {
    return this.agents.get(agentId) ?? null;
  }

  list() {
    return Array.from(this.agents.values()).sort((left, right) => left.name.localeCompare(right.name));
  }
}

export const agentRegistry = new AgentRegistry();
