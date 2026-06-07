/**
 * error-analyzer.ts
 *
 * Analisa saídas de erro de TypeScript, Node.js, npm e similares,
 * extraindo arquivo, linha, coluna e mensagem, além de sugerir a
 * próxima ferramenta/ação para o agente.
 */

export interface ErrorLocation {
  /** Caminho do arquivo onde o erro foi detectado (relativo ao projeto). */
  file: string;
  /** Número da linha (1-indexed), ou null se não disponível. */
  line: number | null;
  /** Número da coluna (1-indexed), ou null se não disponível. */
  column: number | null;
  /** Mensagem principal do erro. */
  message: string;
  /** Tipo de erro detectado. */
  kind: 'typescript' | 'node' | 'npm' | 'generic';
  /**
   * Sugestão de próxima ação para o agente.
   * Exemplos: "open_file: src/foo.ts", "run_command: typecheck"
   */
  suggestedTool: string | null;
}

// TypeScript: "src/foo.ts(10,5): error TS2345: ..."
const RE_TS = /^([^\s(]+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/;

// Node.js ESM/CJS stack trace: "    at foo (file:///path/to/file.js:12:5)"
const RE_NODE_STACK = /at\s+(?:\S+\s+)?\(?(?:file:\/\/\/|(?:[A-Za-z]:)?\/?)([^:)]+):(\d+):(\d+)\)?/;

// Node.js require error: "Cannot find module './foo' ... at ..."
const RE_NODE_MODULE =
  /Cannot find module '([^']+)'|MODULE_NOT_FOUND.*require\('([^']+)'\)/;

// npm ERR! lines: "npm ERR! code ENOENT" / "npm ERR! path /some/path"
const RE_NPM_ERR = /^npm ERR!\s+(.+)$/m;

// ESLint / generic: "/some/path/file.ts:10:5: Error message"
const RE_GENERIC_PATH = /^([^\s:]+\.[a-z]{1,6}):(\d+):(\d+):\s+(.+)$/im;

function suggestForFile(file: string): string {
  if (file.endsWith('.ts') || file.endsWith('.tsx')) {
    return `open_file: ${file} | run_command: typecheck`;
  }
  if (file.endsWith('.js') || file.endsWith('.jsx')) {
    return `open_file: ${file}`;
  }
  return `open_file: ${file}`;
}

function normalizePath(raw: string): string {
  // Remove file:/// prefix and Windows drive with forward slashes
  return raw
    .replace(/^file:\/\/\//, '')
    .replace(/\\/g, '/')
    .trim();
}

function parseTypeScriptErrors(text: string): ErrorLocation[] {
  const results: ErrorLocation[] = [];

  for (const line of text.split('\n')) {
    const match = RE_TS.exec(line.trim());
    if (match) {
      const file = normalizePath(match[1]);
      const lineNum = parseInt(match[2], 10);
      const colNum = parseInt(match[3], 10);
      const code = match[4];
      const message = match[5].trim();

      results.push({
        file,
        line: lineNum,
        column: colNum,
        message: `${code}: ${message}`,
        kind: 'typescript',
        suggestedTool: suggestForFile(file),
      });
    }
  }

  return results;
}

function parseNodeErrors(text: string): ErrorLocation[] {
  const results: ErrorLocation[] = [];

  // Cannot find module errors
  const moduleMatch = RE_NODE_MODULE.exec(text);
  if (moduleMatch) {
    const mod = moduleMatch[1] || moduleMatch[2];
    results.push({
      file: mod,
      line: null,
      column: null,
      message: `Cannot find module '${mod}'`,
      kind: 'node',
      suggestedTool: `install_package: ${mod.replace(/^\.\//, '')} | run_command: install`,
    });
    return results;
  }

  // Stack trace lines
  for (const line of text.split('\n')) {
    const match = RE_NODE_STACK.exec(line);
    if (match) {
      const file = normalizePath(match[1]);
      // Skip node_modules and internal node: paths
      if (file.includes('node_modules') || file.startsWith('node:')) {
        continue;
      }
      const lineNum = parseInt(match[2], 10);
      const colNum = parseInt(match[3], 10);

      results.push({
        file,
        line: lineNum,
        column: colNum,
        message: line.trim(),
        kind: 'node',
        suggestedTool: suggestForFile(file),
      });
    }
  }

  return results;
}

function parseNpmErrors(text: string): ErrorLocation[] {
  const results: ErrorLocation[] = [];
  const matches = [...text.matchAll(/^npm ERR!\s+(.+)$/gm)];
  if (!matches.length) return results;

  const codeMatch = /npm ERR!\s+code\s+(\S+)/.exec(text);
  const pathMatch = /npm ERR!\s+path\s+(.+)/.exec(text);
  const reasonMatch = /npm ERR!\s+(?:syscall|reason|errno)\s+(.+)/.exec(text);

  const code = codeMatch ? codeMatch[1] : 'NPM_ERROR';
  const filePath = pathMatch ? normalizePath(pathMatch[1].trim()) : '';
  const reason = reasonMatch ? reasonMatch[1].trim() : matches[0]?.[1] || 'npm error';

  results.push({
    file: filePath,
    line: null,
    column: null,
    message: `${code}: ${reason}`,
    kind: 'npm',
    suggestedTool: 'run_command: install',
  });

  return results;
}

function parseGenericErrors(text: string): ErrorLocation[] {
  const results: ErrorLocation[] = [];

  for (const line of text.split('\n')) {
    const match = RE_GENERIC_PATH.exec(line.trim());
    if (match) {
      const file = normalizePath(match[1]);
      if (file.includes('node_modules')) continue;
      const lineNum = parseInt(match[2], 10);
      const colNum = parseInt(match[3], 10);
      const message = match[4].trim();

      results.push({
        file,
        line: lineNum,
        column: colNum,
        message,
        kind: 'generic',
        suggestedTool: suggestForFile(file),
      });
    }
  }

  return results;
}

function dedupeErrors(errors: ErrorLocation[]): ErrorLocation[] {
  const seen = new Set<string>();
  return errors.filter((e) => {
    const key = `${e.file}:${e.line}:${e.column}:${e.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Analisa a saída de erro de compiladores, runtimes e gestores de pacotes.
 *
 * @param stderr - Saída do canal stderr do processo.
 * @param stdout - Saída do canal stdout do processo (opcional, alguns erros aparecem em stdout).
 * @returns Lista de erros extraídos, com arquivo, linha, coluna e sugestão de próxima ação.
 */
export function analyzeErrorOutput(stderr: string, stdout = ''): ErrorLocation[] {
  const combined = `${stderr}\n${stdout}`;

  if (!combined.trim()) {
    return [];
  }

  const tsErrors = parseTypeScriptErrors(combined);
  if (tsErrors.length) {
    return dedupeErrors(tsErrors);
  }

  const npmErrors = parseNpmErrors(combined);
  if (npmErrors.length) {
    return dedupeErrors(npmErrors);
  }

  const nodeErrors = parseNodeErrors(combined);
  if (nodeErrors.length) {
    return dedupeErrors(nodeErrors);
  }

  const genericErrors = parseGenericErrors(combined);
  return dedupeErrors(genericErrors);
}

/**
 * Formata a lista de erros em texto legível para exibição ou logs.
 */
export function formatErrorSummary(errors: ErrorLocation[]): string {
  if (!errors.length) {
    return 'Nenhum erro detectado.';
  }

  return errors
    .map((e) => {
      const loc = e.line != null ? `:${e.line}${e.column != null ? `:${e.column}` : ''}` : '';
      const suggestion = e.suggestedTool ? ` → ${e.suggestedTool}` : '';
      return `[${e.kind.toUpperCase()}] ${e.file}${loc}: ${e.message}${suggestion}`;
    })
    .join('\n');
}
