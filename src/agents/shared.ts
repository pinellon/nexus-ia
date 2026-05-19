import type { AgentInput, AgentName } from "./types.js";

export function isEnabledEnv(value: string | undefined, fallback: boolean) {
  if (value == null || value === "") {
    return fallback;
  }

  return value.toLowerCase() === "true";
}

export function buildBaseAgentPrompt(agent: AgentName, role: string, input: AgentInput) {
  return [
    "Voce esta dentro do Nexus IA, um aplicativo IDE assistido por multiplos agentes.",
    "O usuario coda manualmente e voce ajuda.",
    "Voce nao aplica alteracoes diretamente.",
    "Voce deve propor mudancas seguras, funcionais e testaveis.",
    "Quando sugerir alterar arquivos, entregue acoes estruturadas.",
    "Sempre explique riscos, dependencias e como testar.",
    `Agente atual: ${agent}.`,
    `Responsabilidade principal: ${role}.`,
    `Fase atual: ${input.phase}.`,
    `Intencao detectada: ${input.intent}.`,
    input.language ? `Linguagem principal: ${input.language}.` : "",
    input.context ? `Contexto do projeto:\n${input.context}` : "",
    input.researchSummary ? `Pesquisa disponivel:\n${input.researchSummary}` : "",
    input.otherAgentSummaries?.length
      ? `Outros agentes disseram:\n${input.otherAgentSummaries
          .map((entry) => `- ${entry.agent}: ${entry.content}`)
          .join("\n")}`
      : "",
    `Pedido do usuario:\n${input.prompt}`
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildMockAgentResponse(agent: AgentName, role: string, input: AgentInput) {
  const base = [
    `Diagnostico (${agent}):`,
    `- Fase: ${input.phase}.`,
    `- Intencao: ${input.intent}.`,
    `- Papel: ${role}.`,
    "- O Nexus deve propor alteracoes com confirmacao humana antes de aplicar.",
    "- Preferir mudancas pequenas, reversiveis e testaveis."
  ];

  if (input.phase === "planning") {
    return `${base.join("\n")}\n- Plano: revisar arquivos afetados, preparar diff e validar com build/typecheck.`;
  }

  if (input.phase === "review") {
    return `${base.join("\n")}\n- Revisao cruzada: conferir riscos, regressao, seguranca e compatibilidade com o workspace.`;
  }

  const actionHint =
    agent === "codex" && input.context?.includes("Arquivo aberto:")
      ? [
          "",
          "Acao estruturada sugerida:",
          "```json",
          JSON.stringify(
            {
              type: "patch_file",
              path: input.context.match(/Arquivo aberto:\s*([^\n\r]+)/i)?.[1] || "src/example.ts",
              before: input.context.split("Conteudo atual do editor:")[1]?.trim() || "",
              after: `${input.context.split("Conteudo atual do editor:")[1]?.trim() || ""}\n// Review this Nexus proposal before applying.\n`,
              reason: "Aplicar uma melhoria pequena e revisavel no arquivo atual",
              riskLevel: "low",
              requiresConfirmation: true
            },
            null,
            2
          ),
          "```"
        ].join("\n")
      : "";

  return `${base.join("\n")}\n- Proposta: gerar acoes estruturadas, listar arquivos afetados e sugerir comandos de validacao.${actionHint}`;
}
