import { extractProposedActions } from "./action-planner.js";
import { getAgentRegistry } from "./agents/index.js";
import type { AgentName, AgentOutput } from "./agents/types.js";
import { classifyIntent, type NexusIntent } from "./intent-classifier.js";
import {
  fetchGitHubFile,
  fetchUrl,
  githubRepoSearch,
  githubSearch,
  webSearch,
  type ResearchResult
} from "./research-tools.js";

export interface CoordinatorRequest {
  prompt: string;
  context?: string;
  language?: string;
  agents?: AgentName[];
  sessionId: string;
}

export interface CoordinatorSynthesis {
  summary: string;
  intent: NexusIntent;
  researchUsed: boolean;
  filesAffected: string[];
  actions: unknown[];
  commandsToRun: string[];
  risks: string[];
  testPlan: string[];
}

export interface CoordinatorResponse {
  intent: NexusIntent;
  researchUsed: boolean;
  research: ResearchResult[];
  planning: AgentOutput[];
  proposals: AgentOutput[];
  reviews: AgentOutput[];
  synthesis: CoordinatorSynthesis;
  merged: string;
  agents: AgentOutput[];
  totalLatency: number;
  activeAgents: number;
  mode: "live" | "mock";
}

function shouldResearch(prompt: string, context?: string) {
  const combined = `${prompt}\n${context || ""}`.toLowerCase();
  return /(pesquis|search|github|documenta|docs|vers[aã]o|biblioteca|library|erro desconhecido|api externa|npm)/i.test(
    combined
  );
}

function extractUrls(text: string) {
  return [...text.matchAll(/https?:\/\/[^\s)]+/g)].map((match) => match[0]);
}

function extractRepoName(text: string) {
  const match = text.match(/\b([a-z0-9_.-]+\/[a-z0-9_.-]+)\b/i);
  return match?.[1] || null;
}

function stringifyResearch(results: ResearchResult[]) {
  if (!results.length) {
    return "";
  }

  return results
    .map((result, index) => `${index + 1}. [${result.source}] ${result.title}\nURL: ${result.url}\nResumo: ${result.snippet}`)
    .join("\n\n");
}

async function runResearch(prompt: string, context?: string) {
  const results: ResearchResult[] = [];
  const repo = extractRepoName(`${prompt}\n${context || ""}`);
  const urls = extractUrls(`${prompt}\n${context || ""}`);

  if (/github/i.test(prompt) && repo) {
    results.push(...(await githubRepoSearch(repo, prompt)));
  } else if (/github/i.test(prompt)) {
    results.push(...(await githubSearch(prompt)));
  } else {
    results.push(...(await webSearch(prompt)));
  }

  for (const url of urls.slice(0, 2)) {
    if (/github\.com/i.test(url) && /\/blob\//i.test(url)) {
      results.push(await fetchGitHubFile(url));
    } else {
      results.push(await fetchUrl(url));
    }
  }

  return results.slice(0, 6);
}

function buildMergedResponse(input: {
  planning: AgentOutput[];
  proposals: AgentOutput[];
  reviews: AgentOutput[];
  synthesis: CoordinatorSynthesis;
  research: ResearchResult[];
}) {
  return [
    "# Nexus Synthesis",
    "```json",
    JSON.stringify(input.synthesis, null, 2),
    "```",
    input.research.length
      ? `## Pesquisa\n${input.research
          .map((item) => `- ${item.title} (${item.source}): ${item.url}\n  ${item.snippet}`)
          .join("\n")}`
      : "",
    "## Planejamento",
    ...input.planning.map((item) => `### ${item.agent}\n${item.content}`),
    "## Propostas individuais",
    ...input.proposals.map((item) => `### ${item.agent}\n${item.content}`),
    "## Revisao cruzada",
    ...input.reviews.map((item) => `### ${item.agent}\n${item.content}`)
  ]
    .filter(Boolean)
    .join("\n\n");
}

function summarizeActions(actions: Awaited<ReturnType<typeof extractProposedActions>>) {
  return actions.map((action) => {
    switch (action.type) {
      case "run_command":
        return action.command;
      case "install_package":
        return `${action.packageManager} install ${action.dev ? "--save-dev " : ""}${action.packages.join(" ")}`.trim();
      default:
        return action.path;
    }
  });
}

export async function coordinateAgents(req: CoordinatorRequest): Promise<CoordinatorResponse> {
  const startedAt = Date.now();
  const intent = classifyIntent(req.prompt);
  const registry = getAgentRegistry();
  const selectedAgents = (req.agents?.length ? req.agents : (["claude", "codex", "antygravit"] as AgentName[]))
    .map((name) => registry[name])
    .filter((agent) => agent?.enabled);

  const research = shouldResearch(req.prompt, req.context) ? await runResearch(req.prompt, req.context) : [];
  const researchSummary = stringifyResearch(research);

  const planning = await Promise.all(
    selectedAgents.map((agent) =>
      agent.run({
        prompt: req.prompt,
        context: req.context,
        language: req.language,
        intent,
        phase: "planning",
        researchSummary
      })
    )
  );

  const proposals = await Promise.all(
    selectedAgents.map((agent) =>
      agent.run({
        prompt: req.prompt,
        context: req.context,
        language: req.language,
        intent,
        phase: "proposal",
        researchSummary
      })
    )
  );

  const proposalSummaries = proposals.map((proposal) => ({
    agent: proposal.agent,
    content: proposal.content.slice(0, 1200)
  }));

  const reviews = await Promise.all(
    selectedAgents.map((agent) =>
      agent.run({
        prompt: req.prompt,
        context: req.context,
        language: req.language,
        intent,
        phase: "review",
        researchSummary,
        otherAgentSummaries: proposalSummaries.filter((entry) => entry.agent !== agent.name)
      })
    )
  );

  const previewActions = await extractProposedActions({
    sessionId: req.sessionId,
    agentContents: proposals.map((proposal) => ({
      agent: proposal.agent,
      content: proposal.content
    })),
    persist: false
  });

  const filesAffected = [...new Set(previewActions.flatMap((action) => ("path" in action ? [action.path] : [])))];
  const commandsToRun = summarizeActions(
    previewActions.filter((action) => action.type === "run_command" || action.type === "install_package")
  );
  const risks = reviews
    .map((review) => review.content.split("\n").find((line) => line.trim().startsWith("-")))
    .filter((line): line is string => Boolean(line))
    .slice(0, 5);

  const synthesis: CoordinatorSynthesis = {
    summary:
      filesAffected.length > 0
        ? `O Nexus montou uma proposta revisavel para ${filesAffected.length} arquivo(s) e ${commandsToRun.length} comando(s).`
        : "O Nexus montou um plano de implementacao e revisao sem alterar arquivos automaticamente.",
    intent,
    researchUsed: research.length > 0,
    filesAffected,
    actions: previewActions.map((action) => {
      const { id, createdAt, updatedAt, status, sessionId, error, ...rest } = action;
      return rest;
    }),
    commandsToRun,
    risks: risks.length ? risks : ["Revisar diff e rodar validacao antes de aplicar a proposta."],
    testPlan: [
      "Revisar o diff de cada arquivo proposto.",
      "Aplicar somente as acoes aprovadas.",
      "Rodar npm run typecheck.",
      "Rodar npm run build."
    ]
  };

  const merged = buildMergedResponse({
    planning,
    proposals,
    reviews,
    synthesis,
    research
  });

  const agents = proposals.map((proposal) => ({
    ...proposal,
    content: [proposal.content, "", "Revisao cruzada:", reviews.find((review) => review.agent === proposal.agent)?.content || ""]
      .filter(Boolean)
      .join("\n")
  }));

  return {
    intent,
    researchUsed: research.length > 0,
    research,
    planning,
    proposals,
    reviews,
    synthesis,
    merged,
    agents,
    totalLatency: Date.now() - startedAt,
    activeAgents: agents.filter((agent) => agent.ok).length,
    mode: agents.some((agent) => agent.mode === "live") ? "live" : "mock"
  };
}
