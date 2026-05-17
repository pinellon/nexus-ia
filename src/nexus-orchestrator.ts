import Anthropic from "@anthropic-ai/sdk";

export type AgentName = "claude" | "codex" | "antygravit" | "vis";

export interface AgentConfig {
  name: AgentName;
  enabled: boolean;
  timeout: number;
  role: string;
}

export interface AgentResult {
  agent: AgentName;
  content: string;
  tokens: number;
  latency: number;
  ok: boolean;
  mode: "live" | "mock";
  error?: string;
}

export interface OrchestratorResponse {
  merged: string;
  agents: AgentResult[];
  totalLatency: number;
  activeAgents: number;
  mode: "live" | "mock";
}

export interface OrchestratorRequest {
  prompt: string;
  agents?: AgentName[];
  context?: string;
  language?: string;
}

const AGENT_CONFIGS: Record<AgentName, AgentConfig> = {
  claude: {
    name: "claude",
    enabled: true,
    timeout: 15000,
    role: `Voce e o agente de raciocinio do Nexus.
Foque em arquitetura, clareza, revisao de logica e trade-offs.
Responda em portugues de forma objetiva.`
  },
  codex: {
    name: "codex",
    enabled: true,
    timeout: 15000,
    role: `Voce e o agente de implementacao do Nexus.
Foque em codigo funcional, APIs, testes e correcoes.
Quando fizer sentido, entregue blocos de codigo completos em ingles.`
  },
  antygravit: {
    name: "antygravit",
    enabled: true,
    timeout: 15000,
    role: `Voce e o agente de criticidade e otimizacao do Nexus.
Foque em riscos, performance, seguranca e edge cases.
Questione suposicoes e proponha melhorias praticas.`
  },
  vis: {
    name: "vis",
    enabled: false,
    timeout: 15000,
    role: `Voce e o agente visual do Nexus.
Foque em UI, UX, acessibilidade e componentes de interface.
Quando fizer sentido, entregue markup e estilos completos.`
  }
};

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout apos ${ms}ms`)), ms);
  });

  return Promise.race([promise, timeout]);
}

function buildSystemPrompt(agent: AgentName, context?: string, language?: string) {
  return [
    AGENT_CONFIGS[agent].role,
    context ? `Contexto atual do projeto:\n${context}` : "",
    language ? `Linguagem principal: ${language}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildMockResponse(agent: AgentName, req: OrchestratorRequest): string {
  const snippets: Record<AgentName, string> = {
    claude: [
      "Diagnostico rapido:",
      `- O pedido foi interpretado como: "${req.prompt}".`,
      `- Contexto recebido: ${req.context || "nenhum contexto adicional"}.`,
      "- Proximo passo ideal: validar o comportamento esperado e aplicar a mudanca no arquivo afetado."
    ].join("\n"),
    codex: [
      "Implementacao sugerida:",
      "```ts",
      "export async function runTask() {",
      "  return { ok: true, prompt: " + JSON.stringify(req.prompt) + " };",
      "}",
      "```"
    ].join("\n"),
    antygravit: [
      "Pontos de atencao:",
      "- Definir timeout e tratamento de erro para evitar travamentos.",
      "- Medir latencia por agente para comparar custo x qualidade.",
      "- Persistir contexto e historico se o fluxo virar sessao real."
    ].join("\n"),
    vis: [
      "Direcao visual:",
      "- Exibir status por agente com indicadores claros.",
      "- Separar resposta fundida de respostas individuais.",
      "- Mostrar modo mock/live para reduzir ambiguidade no teste."
    ].join("\n")
  };

  return snippets[agent];
}

async function callLiveAgent(
  agent: AgentName,
  req: OrchestratorRequest
): Promise<{ text: string; tokens: number }> {
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY nao configurada");
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(agent, req.context, req.language),
    messages: [{ role: "user", content: req.prompt }]
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return {
    text,
    tokens: response.usage.input_tokens + response.usage.output_tokens
  };
}

async function callAgent(agent: AgentName, req: OrchestratorRequest): Promise<AgentResult> {
  const startedAt = Date.now();

  if (!anthropic) {
    return {
      agent,
      content: buildMockResponse(agent, req),
      tokens: 0,
      latency: Date.now() - startedAt,
      ok: true,
      mode: "mock"
    };
  }

  try {
    const { text, tokens } = await withTimeout(
      callLiveAgent(agent, req),
      AGENT_CONFIGS[agent].timeout
    );

    return {
      agent,
      content: text,
      tokens,
      latency: Date.now() - startedAt,
      ok: true,
      mode: "live"
    };
  } catch (error) {
    return {
      agent,
      content: buildMockResponse(agent, req),
      tokens: 0,
      latency: Date.now() - startedAt,
      ok: true,
      mode: "mock",
      error: error instanceof Error ? error.message : "Falha desconhecida"
    };
  }
}

function mergeResponses(results: AgentResult[]): string {
  const successful = results.filter((result) => result.ok);

  if (successful.length === 0) {
    return "Nenhum agente conseguiu responder.";
  }

  if (successful.length === 1) {
    return successful[0].content;
  }

  const codeFirst = [...successful].sort((a, b) => {
    const aHasCode = Number(a.content.includes("```"));
    const bHasCode = Number(b.content.includes("```"));
    return bHasCode - aHasCode;
  });

  return codeFirst
    .map(
      (result) =>
        `**[${result.agent.toUpperCase()}]** _(${result.latency}ms | ${result.mode})_\n\n${result.content}`
    )
    .join("\n\n---\n\n");
}

export async function orchestrate(req: OrchestratorRequest): Promise<OrchestratorResponse> {
  const startedAt = Date.now();

  const requestedAgents = req.agents?.length
    ? req.agents
    : (Object.keys(AGENT_CONFIGS) as AgentName[]);

  const agentsToRun = requestedAgents.filter((agent) => AGENT_CONFIGS[agent]?.enabled);

  if (agentsToRun.length === 0) {
    return {
      merged: "Nenhum agente ativo no momento.",
      agents: [],
      totalLatency: 0,
      activeAgents: 0,
      mode: "mock"
    };
  }

  const agents = await Promise.all(agentsToRun.map((agent) => callAgent(agent, req)));
  const mode = agents.some((agent) => agent.mode === "live") ? "live" : "mock";

  return {
    merged: mergeResponses(agents),
    agents,
    totalLatency: Date.now() - startedAt,
    activeAgents: agents.filter((agent) => agent.ok).length,
    mode
  };
}

export function getAgentStatus(): Record<AgentName, boolean> {
  return Object.fromEntries(
    Object.entries(AGENT_CONFIGS).map(([name, config]) => [name, config.enabled])
  ) as Record<AgentName, boolean>;
}
