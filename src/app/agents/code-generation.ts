import { projectFileExists, readProjectFile } from "../../project-file-store.js";
import { AIProviderRouter } from "../ai/provider-router.js";
import { addStagedFile, listStagedFiles } from "../web/staged-files.js";
import type { AgentDefinition, AgentRun } from "./models.js";
import { extractRequestedFilePath, shouldRequirePlan } from "./routing.js";

export type ProjectStack = {
  name: string;
  defaultPath: string;
};

export async function detectProjectStack(projectRoot: string): Promise<ProjectStack> {
  let stack: ProjectStack = { name: "html", defaultPath: "public/index.html" };

  try {
    const pkgRaw = await readProjectFile(projectRoot, "package.json");
    const pkg = JSON.parse(pkgRaw.content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps["next"]) {
      stack = { name: "Next.js", defaultPath: "app/page.tsx" };
    } else if (deps["vue"]) {
      stack = { name: "Vue", defaultPath: "src/App.vue" };
    } else if (deps["svelte"] || deps["@sveltejs/kit"]) {
      stack = { name: "Svelte", defaultPath: "src/routes/+page.svelte" };
    } else if (deps["react"] || deps["vite"]) {
      stack = { name: "React/Vite", defaultPath: "src/App.tsx" };
    } else if (deps["express"]) {
      stack = { name: "Express/Node", defaultPath: "src/server.ts" };
    }
  } catch {
    /* use html default */
  }

  return stack;
}

export function defaultPathForAgent(agentId: string, stack: ProjectStack): string {
  switch (agentId) {
    case "backend_agent":
      if (stack.name === "Next.js") return "app/api/route.ts";
      if (stack.defaultPath.includes("server")) return stack.defaultPath;
      return "src/app/web/server.ts";
    case "refactor_agent":
      return stack.defaultPath;
    case "ui_agent":
    case "site_builder_agent":
    default:
      return stack.defaultPath;
  }
}

export function languageForPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "txt";
  const map: Record<string, string> = {
    tsx: "typescript",
    ts: "typescript",
    js: "javascript",
    jsx: "javascript",
    vue: "vue",
    svelte: "svelte",
    html: "html",
    css: "css",
    md: "markdown",
    json: "json"
  };
  return map[ext] || "text";
}

export function agentCodegenPersona(agentId: string): string {
  switch (agentId) {
    case "backend_agent":
      return "Voce e um engenheiro backend senior. Foque em APIs, validacao, tipos, seguranca e codigo limpo.";
    case "refactor_agent":
      return "Voce e um especialista em refatoracao. Melhore estrutura e legibilidade sem mudar comportamento externo.";
    case "ui_agent":
      return "Voce e um engenheiro frontend/UI senior. Foque em layout moderno, responsivo, acessivel e componentes claros.";
    case "site_builder_agent":
    default:
      return "Voce e um builder full-stack focado em sites e apps web modernos, com design profissional e codigo completo.";
  }
}

export type GenerateCodeInput = {
  agent: AgentDefinition;
  run: AgentRun;
  goal: string;
  skipPlan?: boolean;
};

export type GenerateCodeResult = {
  path: string;
  content: string;
  language: string;
  stack: ProjectStack;
  provider: string;
  model: string | null;
};

export async function generateCodeWithLLM(input: GenerateCodeInput): Promise<GenerateCodeResult> {
  const { agent, run, goal } = input;
  const actualGoal = goal.replace("++CONFIRM_PLAN++", "").trim();
  const stack = await detectProjectStack(run.projectRoot);
  const draftPath = extractRequestedFilePath(actualGoal) || defaultPathForAgent(agent.id, stack);
  const language = languageForPath(draftPath);
  const fileExt = draftPath.split(".").pop() || "html";

  const stagedFiles = await listStagedFiles();
  const existingStaged = stagedFiles.find((f) => f.path === draftPath);

  let existingOnDisk = "";
  let baselineContent: string | null = null;
  try {
    if (await projectFileExists(run.projectRoot, draftPath)) {
      existingOnDisk = (await readProjectFile(run.projectRoot, draftPath)).content;
      baselineContent = existingOnDisk;
    }
  } catch {
    existingOnDisk = "";
    baselineContent = null;
  }

  const persona = agentCodegenPersona(agent.id);
  const router = new AIProviderRouter();

  let prompt = `${persona}\n\nPedido do usuario: "${actualGoal}"\nStack do projeto: ${stack.name}\nArquivo alvo: ${draftPath}\nAgente: ${agent.name}\n\n`;

  if (existingStaged?.content) {
    prompt += `Conteudo atual em staging:\n\`\`\`${language}\n${existingStaged.content}\n\`\`\`\n\n`;
  } else if (existingOnDisk) {
    prompt += `Conteudo atual no disco:\n\`\`\`${language}\n${existingOnDisk}\n\`\`\`\n\n`;
  }

  prompt += `Gere o codigo COMPLETO e funcional para este arquivo.
Requisitos:
- Design moderno e profissional quando for UI/HTML
- Responsivo quando aplicavel
- Sem placeholders vagos ("lorem" so se fizer sentido)
- Compativel com ${stack.name}
- Retorne APENAS o codigo dentro de um bloco \`\`\`${language} ... \`\`\``;

  const response = await router.routeChatRequest({
    messages: [{ role: "user", content: prompt }],
    context: `Geracao de codigo Nexus Codex para ${draftPath}`,
    goal: actualGoal,
    allowPremium: true
  });

  if (!response.ok && !response.response) {
    throw new Error(response.message || "Nenhum provider de IA respondeu");
  }

  let content = response.response || "";
  const codeMatch = content.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  if (codeMatch) {
    content = codeMatch[1].trim();
  }

  if (!content.trim()) {
    throw new Error("IA retornou conteudo vazio. Configure um provider em Configuracoes > IA.");
  }

  await addStagedFile({
    path: draftPath,
    language,
    content,
    baselineContent,
    source: agent.id,
    run_id: run.id
  });

  return {
    path: draftPath,
    content,
    language,
    stack,
    provider: response.provider,
    model: response.model
  };
}

export { shouldRequirePlan, extractRequestedFilePath };
