import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { listProjectFiles, readProjectFile, resolveProjectRoot } from "../../project-file-store.js";
import { readProjectSnapshot } from "../../project-inspector.js";

export interface CodeChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface BuiltContext {
  projectId: string;
  summaryPath: string;
  content: string;
  selectedFiles: string[];
  inputTokensEstimate: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataRoot = path.resolve(__dirname, "../../../data/projects");
const MAX_FILE_CHARS = 2_400;
const MAX_CONTEXT_CHARS = 12_000;

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function latestUserMessage(messages: CodeChatMessage[]) {
  return messages
    .slice()
    .reverse()
    .find((message) => message.role === "user")?.content ?? "";
}

function extractMentionedPaths(text: string) {
  const matches = text.match(/[a-zA-Z0-9_./-]+\.(?:ts|tsx|js|jsx|json|md|html|css|py|yml|yaml)/g) || [];
  return Array.from(new Set(matches.map((item) => item.replace(/^\.?\//, ""))));
}

function addIfAvailable(selected: Set<string>, availableFiles: Set<string>, candidates: string[]) {
  for (const candidate of candidates) {
    if (availableFiles.has(candidate)) {
      selected.add(candidate);
    }
  }
}

export function selectContextFiles(goal: string, availableFilesInput: string[], extraContext = "") {
  const availableFiles = new Set(availableFilesInput);
  const combined = [goal, extraContext].filter(Boolean).join("\n");
  const loweredGoal = combined.toLowerCase();
  const selected = new Set<string>();

  for (const pathName of extractMentionedPaths(combined)) {
    if (availableFiles.has(pathName)) {
      selected.add(pathName);
    }
  }

  const activeFile = combined.match(/Arquivo ativo:\s*([^\n\r]+)/i)?.[1]?.trim();
  if (activeFile && activeFile !== "nenhum" && availableFiles.has(activeFile)) {
    selected.add(activeFile);
  }

  const openFiles = combined.match(/Arquivos abertos:\s*([^\n\r]+)/i)?.[1]?.trim();
  if (openFiles && openFiles !== "nenhum") {
    for (const filePath of openFiles.split(",").map((item) => item.trim())) {
      if (availableFiles.has(filePath)) selected.add(filePath);
    }
  }

  addIfAvailable(selected, availableFiles, ["package.json", "tsconfig.json", "README.md"]);

  if (/(build|typecheck|tsc|erro|falha|debug)/.test(loweredGoal)) {
    addIfAvailable(selected, availableFiles, [
      "package.json",
      "tsconfig.json",
      "vite.config.ts",
      "vite.config.js",
      "src/server.ts",
      "src/app.ts",
      "src/App.tsx",
      "public/index.html"
    ]);
  }

  if (/(tela|site|landing|home|layout|componente|ui)/.test(loweredGoal)) {
    for (const file of availableFilesInput) {
      if (/^(public\/index\.html|src\/.*\.(tsx|jsx|css|html)|public\/.*\.(html|css))$/i.test(file)) {
        selected.add(file);
      }
      if (selected.size >= 8) {
        break;
      }
    }
  }

  if (/(api|backend|endpoint|rota|server|express|auth|login)/.test(loweredGoal)) {
    for (const file of availableFilesInput) {
      if (/^(src\/.*(server|route|api|controller|service|auth).*\.(ts|js)|src\/server\.ts)$/i.test(file)) {
        selected.add(file);
      }
      if (selected.size >= 10) break;
    }
  }

  if (/(readme|docs|documenta|changelog|arquitetura)/.test(loweredGoal)) {
    for (const file of availableFilesInput) {
      if (/^(README\.md|docs\/.*\.md)$/i.test(file)) {
        selected.add(file);
      }
      if (selected.size >= 10) break;
    }
  }

  return Array.from(selected).slice(0, 10);
}

async function readContextSummary(projectId: string, projectRoot: string) {
  const dir = path.join(dataRoot, projectId);
  const summaryPath = path.join(dir, "context-summary.md");
  await mkdir(dir, { recursive: true });

  try {
    return {
      summaryPath,
      summary: await readFile(summaryPath, "utf8")
    };
  } catch {
    const snapshot = readProjectSnapshot(projectRoot);
    const summary = [
      `# ${snapshot.projectName}`,
      "",
      `- Path: ${snapshot.projectPath}`,
      `- Stack: ${snapshot.framework}`,
      `- Branch: ${snapshot.branch}`,
      `- Commands: dev=${snapshot.detectedCommands.dev || "-"}, build=${snapshot.detectedCommands.build || "-"}, test=${snapshot.detectedCommands.test || "-"}, typecheck=${snapshot.detectedCommands.typecheck || "-"}`,
      "",
      "Resumo inicial gerado localmente para reduzir tokens em chamadas futuras."
    ].join("\n");
    await writeFile(summaryPath, summary, "utf8");
    return { summaryPath, summary };
  }
}

export class ContextBuilder {
  async buildContext(input: { messages: CodeChatMessage[]; projectRoot?: string; extraContext?: string }): Promise<BuiltContext> {
    const projectRoot = input.projectRoot || ".";
    const resolved = resolveProjectRoot(projectRoot);
    const goal = latestUserMessage(input.messages);
    const files = await listProjectFiles(projectRoot);
    const availableFiles = files.map((file) => file.path);
    const selectedFiles = selectContextFiles(goal, availableFiles, input.extraContext);
    const { summaryPath, summary } = await readContextSummary(resolved.projectId, projectRoot);
    const parts = [
      "Contexto minimo do projeto:",
      summary,
      "",
      "Pedido atual:",
      goal,
      input.extraContext ? "\nSinais atuais da IDE/terminal:\n" + input.extraContext.slice(0, 3_000) : ""
    ];

    for (const filePath of selectedFiles) {
      try {
        const file = await readProjectFile(projectRoot, filePath);
        parts.push(
          "",
          `Arquivo: ${file.path}`,
          "```",
          file.content.slice(0, MAX_FILE_CHARS),
          file.content.length > MAX_FILE_CHARS ? "\n...[trecho truncado pelo Nexus]" : "",
          "```"
        );
      } catch {
        // Ignore files that became unavailable between tree scan and context assembly.
      }
    }

    const content = parts.join("\n").slice(0, MAX_CONTEXT_CHARS);
    return {
      projectId: resolved.projectId,
      summaryPath,
      content,
      selectedFiles,
      inputTokensEstimate: estimateTokens(content)
    };
  }
}
