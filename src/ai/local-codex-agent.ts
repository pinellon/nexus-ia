import { AIProviderRouter } from '../app/ai/provider-router.js';

export interface LocalCodexContextFile {
  path: string;
  content: string;
}

export interface LocalCodexSelection {
  file: string;
  startLine?: number;
  endLine?: number;
  content?: string;
}

export interface LocalCodexRunInput {
  instruction: string;
  contextFiles: LocalCodexContextFile[];
  selection?: LocalCodexSelection;
  forceLocal?: boolean;
}

export interface LocalCodexFileEdit {
  path: string;
  content: string;
}

export interface LocalCodexResult {
  summary: string;
  files: LocalCodexFileEdit[];
  provider: string;
  model: string | null;
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('A IA local nao retornou JSON aplicavel.');
  }
  return text.slice(start, end + 1);
}

export function parseLocalCodexResponse(text: string) {
  const parsed = JSON.parse(extractJsonObject(text)) as {
    summary?: unknown;
    files?: unknown;
  };

  const files = Array.isArray(parsed.files)
    ? parsed.files
        .filter(
          (file): file is { path: string; content: string } =>
            typeof file === 'object' &&
            file !== null &&
            typeof (file as { path?: unknown }).path === 'string' &&
            typeof (file as { content?: unknown }).content === 'string',
        )
        .map((file) => ({ path: file.path, content: file.content }))
    : [];

  if (!files.length) {
    throw new Error('A IA local nao retornou arquivos alterados no formato esperado.');
  }

  return {
    summary:
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : 'Edicao proposta pelo agente local',
    files,
  };
}

function buildLocalCodexPrompt(input: LocalCodexRunInput) {
  return [
    'Voce e o agente local de edicao de codigo do Nexus IA.',
    'Sua unica saida deve ser JSON valido, sem markdown fora do JSON.',
    'Voce nao aplica arquivos diretamente. O Nexus vai validar e mostrar Patch Review.',
    'Retorne o conteudo completo atualizado de cada arquivo alterado.',
    'Nao inclua chaves, tokens, segredos ou logs sensiveis.',
    'Nao altere arquivos fora dos caminhos enviados no contexto, salvo se o usuario pedir explicitamente e o arquivo estiver no workspace.',
    '',
    'Formato obrigatorio:',
    '{"summary":"string","files":[{"path":"caminho/relativo.ts","content":"conteudo completo atualizado"}]}',
    '',
    `Instrucao do usuario: ${input.instruction}`,
    input.selection
      ? `Selecao: ${JSON.stringify({
          file: input.selection.file,
          startLine: input.selection.startLine,
          endLine: input.selection.endLine,
          content: input.selection.content?.slice(0, 12_000),
        })}`
      : 'Selecao: nenhuma',
    '',
    'Arquivos de contexto:',
    JSON.stringify(
      input.contextFiles.map((file) => ({
        path: file.path,
        content: file.content.slice(0, 50_000),
      })),
    ),
  ].join('\n');
}

export class LocalCodexAgent {
  private readonly router: AIProviderRouter;

  constructor(router = new AIProviderRouter()) {
    this.router = router;
  }

  async runTask(input: LocalCodexRunInput): Promise<LocalCodexResult> {
    const prompt = buildLocalCodexPrompt(input);
    const response = await this.router.routeChatRequest({
      messages: [{ role: 'user', content: prompt }],
      context: 'AI Code Apply local do Nexus IA',
      goal: input.instruction,
      allowPremium: false,
      forceLocal: input.forceLocal !== false,
    });

    if (!response.ok || !response.response) {
      throw new Error(response.message || 'Nenhum provider local respondeu.');
    }

    const parsed = parseLocalCodexResponse(response.response);
    return {
      ...parsed,
      provider: response.provider,
      model: response.model,
    };
  }
}
