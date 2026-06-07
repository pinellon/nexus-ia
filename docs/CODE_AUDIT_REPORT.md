# 🛠️ Relatório de Análise e Auditoria de Código

## Executive Summary

O Nexus IA já é um MVP funcional de IDE web local com Monaco Editor, Explorer, IA lateral, agentes, Patch Review visual, SSE, comandos controlados e isolamento inicial por `workspace/`.

O sistema já pode ser considerado uma IDE assistida por IA em estágio MVP, mas ainda não deve ser chamado de versão estável.

Os três maiores riscos atuais são: preview HTML rodando na mesma origem da API, rotas GET de projeto/workspace sem proteção de token e inconsistência entre dev/build/start por uso de caminhos baseados em `__dirname`.

A prioridade imediata deve ser endurecer a fronteira local de segurança antes de adicionar novas features.

Também há sinais de flakiness em testes por estado global, singletons e persistência JSON concorrente no Windows.

A arquitetura está na direção certa, mas precisa reduzir duplicações, especialmente command runner duplicado e fluxos paralelos de staged files/patches.

Recomendação: o próximo PR deve focar exclusivamente em segurança de preview/API boundary.

## 0. Escopo e Metodologia

| Campo              | Valor                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| Data da auditoria  | 2026-05-25                                                                                          |
| Autor              | Codex, atuando como Engenheiro de Software Sênior e Auditor de Código                               |
| Workspace auditado | `C:\nexus ai`                                                                                       |
| Branch observada   | `codex/feat-editor-selection-ai-actions`                                                            |
| Tipo de análise    | Leitura de código, varredura estrutural, busca por padrões de risco e execução de validações locais |

### Estado do Repositório

O working tree estava sujo no momento da auditoria, com muitos arquivos modificados e vários arquivos novos não rastreados.

Isso significa que este relatório descreve o estado atual do diretório local, não necessariamente o estado da `main` limpa.

### Validação Executada

| Comando                    | Resultado                                          |
| -------------------------- | -------------------------------------------------- |
| `cmd /c npm run typecheck` | Passou                                             |
| `cmd /c npm run build`     | Passou                                             |
| `cmd /c npm run ci`        | Passou uma vez                                     |
| `cmd /c npm test`          | Falhou de forma intermitente em execuções isoladas |

Falhas observadas:

```text
tests/pending-actions-concurrency.test.ts
EPERM: operation not permitted, rename ... pending-actions.json.tmp -> pending-actions.json
```

```text
tests/active-project-boundary.test.ts
expected 200 "OK", got 400 "Bad Request"
```

Status: flakiness reproduzido localmente por execução de testes. A causa raiz provável é combinação de `process.env`, singletons, módulo cache e persistência JSON concorrente.

---

## 1. Mapeamento do Sistema

### 1.1 Arquitetura Principal

```text
Browser / Frontend estático
  ↓
public/index.html + JS modular
  ↓
Express API em src/server.ts
  ↓
Camadas internas:
  - Active Project
  - File Store
  - Agent Runner
  - Tool Registry
  - Patch Review
  - Command Runner
  - AI Provider Router
  - JSON/JSONL Stores
```

### 1.2 Fluxo Principal do Produto

```text
Usuário digita pedido
→ DevMind / Code Chat
→ /api/smart-orchestrate
→ /api/code-chat
→ ContextBuilder
→ AIProviderRouter
→ AgentRunner
→ ToolRegistry
→ Pending Actions / Artifacts
→ Patch Review
→ Aprovação explícita
→ ActionExecutor
→ Arquivos alterados
→ Typecheck / Build / Test
```

### 1.3 Dependências Críticas

| Dependência          | Uso                              |
| -------------------- | -------------------------------- |
| `express`            | Backend HTTP principal           |
| `express-rate-limit` | Rate limit para endpoints caros  |
| `@anthropic-ai/sdk`  | Provider Anthropic               |
| `typescript`         | Typecheck/build                  |
| `tsx`                | Dev server                       |
| `vitest`             | Testes                           |
| `supertest`          | Testes de API                    |
| Monaco via CDN       | Editor e Diff Editor no frontend |
| Codicons via CDN     | Ícones estilo VS Code            |
| `node:child_process` | Execução controlada de comandos  |
| `node:fs/promises`   | Persistência e filesystem        |

Observação: `cors` e `@types/cors` aparecem em `package.json`, mas o projeto usa `configureLocalCors` próprio em `src/local-security.ts`. Podem ser dependências órfãs.

---

## 2. Módulos e Responsabilidades

### 2.1 Backend Principal

| Arquivo                        | Responsabilidade                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `src/server.ts`                | Servidor Express principal, rotas de projeto, workspace, sessões, patches, comandos, Git, IA settings e fallback SPA |
| `src/app/web/server.ts`        | Rotas de agentes, `/api/code-chat`, SSE, staged files e previews staged                                              |
| `src/local-security.ts`        | CORS local, token local, proteção CSRF-like e confirmação destrutiva                                                 |
| `src/rate-limit.ts`            | Limiters para IA, comandos e writes                                                                                  |
| `src/nexus-data-dir.ts`        | Resolução de `data/` e escrita atômica JSON                                                                          |
| `src/session-store.ts`         | Sessões e histórico de chat em JSON                                                                                  |
| `src/project-runtime-store.ts` | Último resultado de comando/teste por projeto                                                                        |

### 2.2 Projeto, Workspace e Arquivos

| Arquivo                     | Responsabilidade                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `src/active-project.ts`     | Conceito de `activeProjectRoot`, padrão `workspace/`, bloqueio do root interno do Nexus |
| `src/project-file-store.ts` | CRUD seguro de arquivos/pastas do projeto ativo                                         |
| `src/workspace-store.ts`    | Store legado baseado em `workspace/`                                                    |
| `src/project-inspector.ts`  | Snapshot do projeto, Git status/diff/commit e detecção de comandos                      |

### 2.3 Patches e Ações

| Arquivo                          | Responsabilidade                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `src/action-types.ts`            | Tipos de ações: `create_file`, `write_file`, `patch_file`, `delete_file`, comandos etc. |
| `src/action-planner.ts`          | Extração de ações propostas a partir de respostas dos agentes                           |
| `src/pending-actions-store.ts`   | Persistência JSON de ações pendentes                                                    |
| `src/action-executor.ts`         | Aplica ações aprovadas, cria backups e protege patch stale parcialmente                 |
| `src/patch-payload.ts`           | Monta payload visual para Patch Review                                                  |
| `src/patches/patch-validator.ts` | Validação de propostas de edição com IA                                                 |
| `src/patches/patch-applier.ts`   | Aprova e aplica uma ação pendente                                                       |
| `src/backup-store.ts`            | Lista, pré-visualiza e restaura backups                                                 |

### 2.4 Agentes

| Arquivo                             | Responsabilidade                                            |
| ----------------------------------- | ----------------------------------------------------------- |
| `src/app/agents/models.ts`          | Modelos de agentes, runs, eventos, steps, artifacts e tools |
| `src/app/agents/registry.ts`        | Registro de agentes                                         |
| `src/app/agents/runner.ts`          | Criação e execução assíncrona de runs                       |
| `src/app/agents/tools.ts`           | Tool registry de agentes                                    |
| `src/app/agents/artifacts.ts`       | Persistência de artefatos por projeto/run                   |
| `src/app/agents/history.ts`         | Histórico do projeto                                        |
| `src/app/agents/routing.ts`         | Heurísticas para escolher agente                            |
| `src/app/agents/code-generation.ts` | Geração de código com LLM/fallback                          |

### 2.5 IA

| Arquivo                         | Responsabilidade                                               |
| ------------------------------- | -------------------------------------------------------------- |
| `src/app/ai/provider-router.ts` | Escolhe provider local/premium                                 |
| `src/app/ai/context-builder.ts` | Seleciona contexto mínimo do projeto                           |
| `src/app/ai/ai-settings.ts`     | Carrega/salva configurações e API keys                         |
| `src/app/ai/usage-tracker.ts`   | Estimativa de uso/custo                                        |
| `src/app/ai/providers/*.ts`     | Providers Ollama, Anthropic, OpenAI, Gemini, Groq e OpenRouter |
| `src/ai/ai-edit-planner.ts`     | Planeja edição assistida no arquivo atual                      |
| `src/ai/local-codex-agent.ts`   | Agente local para edição com IA                                |

### 2.6 Runs e SSE

| Arquivo                         | Responsabilidade                                |
| ------------------------------- | ----------------------------------------------- |
| `src/app/runs/run-store.ts`     | Persistência JSONL de runs                      |
| `src/app/runs/run-event-bus.ts` | Event bus em memória para SSE                   |
| `public/agent-progress.js`      | Timeline de progresso em tempo real no frontend |

### 2.7 Frontend

| Arquivo                        | Responsabilidade                                          |
| ------------------------------ | --------------------------------------------------------- |
| `public/index.html`            | Estrutura principal da IDE                                |
| `public/app.js`                | Estado global, API wrapper, boot do app e contexto da IDE |
| `public/editor.js`             | Monaco Editor, tabs, salvar, Ctrl+S e edição com IA       |
| `public/explorer.js`           | Explorer, criar/renomear/deletar arquivos/pastas          |
| `public/ai-panel.js`           | Painel lateral Nexus AI                                   |
| `public/devmind.js`            | Chat visual e integração com `/api/code-chat`             |
| `public/patch-review.js`       | Monaco Diff e ações de patch                              |
| `public/terminal.js`           | Terminal controlado, Problems e “Corrigir com Nexus”      |
| `public/preview.js`            | Preview de HTML/projeto                                   |
| `public/search.js`             | Busca simples de arquivos                                 |
| `public/sidebar-panels.js`     | Painéis auxiliares, Git e placeholders                    |
| `public/command-palette.js`    | Command Palette                                           |
| `public/styles.css`            | Layout e tema principal                                   |
| `public/nexus-codex-theme.css` | Tema visual adicional                                     |

---

## 3. Pontos Fortes a Preservar

Os itens abaixo são diferenciais reais do produto e devem ser preservados durante refatorações.

### 3.1 Fluxo de Patch Review é uma boa decisão arquitetural

Evidência:

- `src/action-executor.ts`
- `src/patch-payload.ts`
- `public/patch-review.js`

O sistema já separa “propor alteração” de “aplicar alteração”. Isso é essencial para uma IDE com IA, porque evita que agentes modifiquem código sem aprovação humana.

Impacto: aumenta confiança, reduz perda de dados e aproxima o produto de Cursor/Codex/Claude Code.

### 3.2 Isolamento de projeto ativo é uma evolução importante

Evidência:

- `src/active-project.ts`
- `tests/active-project-boundary.test.ts`

O Nexus já tenta separar `appRoot` de `activeProjectRoot`, usando `workspace/` como padrão. Isso corrige um problema grave anterior: o Explorer mostrar e editar o código interno do próprio Nexus.

Impacto: melhora segurança e clareza do produto.

### 3.3 File store tem boas proteções básicas

Evidência:

- `src/project-file-store.ts`

O store bloqueia:

- path traversal;
- paths absolutos;
- `.git`;
- `node_modules`;
- `dist`;
- `data`;
- `coverage`;
- `.env`;
- `.pem`;
- `.key`;
- `id_rsa`;
- `secrets.json`;
- `token.json`;
- arquivos grandes.

Impacto: boa base para evitar escrita/leitura acidental fora do projeto.

### 3.4 Command runner principal é whitelist-based

Evidência:

- `src/command-runner.ts`

O terminal não executa comando arbitrário diretamente. Ele resolve apenas comandos conhecidos.

Impacto: reduz risco de RCE via terminal.

### 3.5 SSE para progresso de agentes está bem encaminhado

Evidência:

- `src/app/web/server.ts`
- `src/app/runs/run-event-bus.ts`
- `public/agent-progress.js`

O sistema já publica eventos e o frontend renderiza timeline amigável.

Impacto: melhora UX e sensação de “assistente vivo”.

### 3.6 Testes existem e cobrem pontos importantes

Evidência:

- `tests/project-file-store.test.ts`
- `tests/action-executor.test.ts`
- `tests/patches-api.test.ts`
- `tests/local-security.test.ts`
- `tests/active-project-boundary.test.ts`

Há cobertura para:

- file store;
- patch stale;
- aprovação/rejeição;
- segurança local;
- fronteira de projeto ativo;
- SSE;
- command runner;
- AI settings.

Impacto: acima da média para um MVP.

---

## 4. Bugs e Vulnerabilidades

### 4.0 Tabela Consolidada de Riscos

| ID   | Título                                                           |  Severidade | Esforço | Prioridade |
| ---- | ---------------------------------------------------------------- | ----------: | ------: | ---------: |
| 4.1  | Preview HTML same-origin com acesso potencial à API              |     Crítica |   Médio |         P0 |
| 4.2  | Servidor local sem host explícito                                |     Crítica |   Baixo |         P0 |
| 4.3  | GETs de projeto/workspace sem token                              |        Alta |   Baixo |         P1 |
| 4.4  | `npm start` aponta para `dist/server.js` possivelmente incorreto |        Alta |   Baixo |         P1 |
| 4.5  | Paths de `data/public/workspace` divergem entre dev e build      |        Alta |   Médio |         P1 |
| 4.6  | Tool runner dos agentes duplica comandos sem timeout             |        Alta |   Médio |         P1 |
| 4.7  | Inline handlers no frontend com risco de XSS                     |        Alta |   Médio |         P1 |
| 4.8  | `write_file` pode sobrescrever sem stale check                   |        Alta |   Médio |         P1 |
| 4.9  | `staged-files` cria fluxo paralelo de escrita                    |  Média/Alta |   Médio |         P1 |
| 4.10 | Testes intermitentes por estado global/JSON concorrente          |  Média/Alta |    Alto |         P1 |
| 4.11 | Escrita atômica JSON falha no Windows sob concorrência           |       Média |   Médio |         P2 |
| 4.12 | Command output não redige segredos no runner principal           |       Média |   Baixo |         P2 |
| 4.13 | `npm install` na whitelist comum                                 |       Média |   Baixo |         P2 |
| 4.14 | `fetch-url` ainda tem SSRF por redirect/DNS rebinding            |       Média |   Médio |         P2 |
| 4.15 | Maps em memória sem retenção/eviction                            |       Média |   Médio |         P2 |
| 4.16 | Monaco/Codicons por CDN                                          | Baixa/Média |   Médio |         P3 |
| 4.17 | Mojibake/encoding quebrado                                       |       Baixa |   Baixo |         P3 |

### 4.1 Preview HTML same-origin com acesso potencial à API

| Campo      | Detalhe                                                          |
| ---------- | ---------------------------------------------------------------- |
| Severidade | Crítica                                                          |
| Esforço    | Médio                                                            |
| Prioridade | P0                                                               |
| Arquivos   | `src/server.ts`, `src/app/web/server.ts`, `public/preview.js`    |
| Status     | Confirmado por leitura de código. Reprodução manual recomendada. |

O endpoint `/preview/project/:path` serve arquivos HTML do projeto como `text/html` na mesma origem `http://localhost:4000`.

Além disso, `popoutPreview()` abre esse HTML em nova aba sem sandbox.

Como `/api/health` retorna `localSecurity.token`, uma página de preview maliciosa, se executada same-origin, pode obter o token e chamar endpoints protegidos.

#### Reprodução Proposta

1. Crie `workspace/evil.html`:

```html
<script>
  fetch('/api/health')
    .then((r) => r.json())
    .then(console.log);
</script>
```

2. Abra `evil.html` no Preview em popout.
3. Observe o console.
4. Se o console exibir `localSecurity.token`, o preview está rodando com acesso à API local.

#### Correção Recomendada

- Servir preview em origem separada, por exemplo `127.0.0.1:4001`.
- Ou aplicar CSP com `sandbox` no response de preview.
- Nunca abrir preview HTML same-origin sem sandbox.
- Não expor token via `/api/health`.
- Colocar APIs sensíveis atrás de token também para GETs de projeto.

Exemplo:

```ts
res.setHeader(
  'Content-Security-Policy',
  [
    'sandbox allow-scripts allow-forms',
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; '),
);
```

### 4.2 Servidor local sem host explícito

| Campo      | Detalhe                           |
| ---------- | --------------------------------- |
| Severidade | Crítica                           |
| Esforço    | Baixo                             |
| Prioridade | P0                                |
| Arquivo    | `src/server.ts`                   |
| Status     | Confirmado por leitura de código. |

O servidor usa `app.listen(port)` sem host explícito. O Node pode escutar em todas as interfaces, dependendo do ambiente.

#### Reprodução Proposta

1. Rode `npm run dev`.
2. Verifique interfaces com `netstat -ano | findstr :4000`.
3. Se estiver em `0.0.0.0:4000`, o app pode estar exposto na rede local.

#### Correção Recomendada

```ts
const host = process.env.HOST || '127.0.0.1';

app.listen(port, host, () => {
  console.log(`Nexus IDE rodando em http://${host}:${port}`);
});
```

### 4.3 GETs de projeto/workspace sem token

| Campo      | Detalhe                                  |
| ---------- | ---------------------------------------- |
| Severidade | Alta                                     |
| Esforço    | Baixo                                    |
| Prioridade | P1                                       |
| Arquivos   | `src/local-security.ts`, `src/server.ts` |
| Status     | Confirmado por leitura de código.        |

`SENSITIVE_GETS` protege agentes, ações, patches, Git etc., mas não inclui:

- `/api/project/tree`;
- `/api/project/file`;
- `/api/project/files`;
- `/api/workspace/file`;
- `/api/workspace/files`.

#### Reprodução Proposta

1. Rode o Nexus localmente.
2. Em uma página same-origin ou via request local, chame:

```js
fetch('/api/project/file?path=index.html');
```

3. O comportamento esperado é exigir token.

#### Correção Recomendada

```ts
const SENSITIVE_GETS = [
  /^\/api\/project(?:\/.*)?$/,
  /^\/api\/workspace(?:\/.*)?$/,
  /^\/api\/ai\/settings$/,
  /^\/api\/ai\/status$/,
  /^\/api\/ai-edits(?:\/.*)?$/,
  /^\/api\/agents(?:\/.*)?$/,
  /^\/api\/actions(?:\/.*)?$/,
  /^\/api\/patches(?:\/.*)?$/,
  /^\/api\/git(?:\/.*)?$/,
  /^\/api\/runs(?:\/.*)?$/,
  /^\/api\/backups(?:\/.*)?$/,
  /^\/api\/staged-files(?:\/.*)?$/,
  /^\/api\/sessions(?:\/.*)?$/,
];
```

### 4.4 `npm start` aponta para build possivelmente incorreto

| Campo      | Detalhe                           |
| ---------- | --------------------------------- |
| Severidade | Alta                              |
| Esforço    | Baixo                             |
| Prioridade | P1                                |
| Arquivos   | `package.json`, `tsconfig.json`   |
| Status     | Confirmado por leitura de código. |

`package.json` define:

```json
"start": "node dist/server.js"
```

Mas `tsconfig.json` compila `src/server.ts` para `dist/src/server.js`, pois usa:

```json
"rootDir": ".",
"outDir": "dist"
```

#### Reprodução Proposta

1. Remova `dist/`.
2. Rode `npm run build`.
3. Rode `npm start`.
4. Em ambiente limpo, o esperado é falhar ou rodar artefato errado se `dist/server.js` não existir.

#### Correção Recomendada

```json
"start": "node dist/src/server.js"
```

Também é necessário ajustar resolução de `public/`, `data/` e `workspace/`.

### 4.5 Paths de `data/public/workspace` divergem entre dev e build

| Campo      | Detalhe                                                            |
| ---------- | ------------------------------------------------------------------ |
| Severidade | Alta                                                               |
| Esforço    | Médio                                                              |
| Prioridade | P1                                                                 |
| Arquivos   | `src/server.ts`, `src/nexus-data-dir.ts`, `src/workspace-store.ts` |
| Status     | Confirmado por leitura de código.                                  |

Há paths baseados em `__dirname`:

```ts
const publicDir = path.resolve(__dirname, '../public');
const defaultDataDir = path.resolve(__dirname, '../data');
const workspaceDir = path.resolve(__dirname, '../workspace');
```

Em dev, `__dirname` aponta para `src/`. Em build, aponta para `dist/src/`.

#### Correção Recomendada

Criar módulo único de paths:

```ts
export function getAppRoot() {
  return process.env.NEXUS_APP_ROOT ? path.resolve(process.env.NEXUS_APP_ROOT) : process.cwd();
}

export function getPublicDir() {
  return path.join(getAppRoot(), 'public');
}

export function getDataDir() {
  return process.env.NEXUS_DATA_DIR
    ? path.resolve(process.env.NEXUS_DATA_DIR)
    : path.join(getAppRoot(), 'data');
}

export function getWorkspaceDir() {
  return path.join(getAppRoot(), 'workspace');
}
```

### 4.6 Tool runner dos agentes duplica comandos sem timeout

| Campo      | Detalhe                           |
| ---------- | --------------------------------- |
| Severidade | Alta                              |
| Esforço    | Médio                             |
| Prioridade | P1                                |
| Arquivo    | `src/app/agents/tools.ts`         |
| Status     | Confirmado por leitura de código. |

Existe um runner seguro em `src/command-runner.ts` com timeout. Porém `src/app/agents/tools.ts` implementa outro `runCommand()` com `spawn()` sem timeout.

#### Reprodução Proposta

1. Ajustar temporariamente um comando seguro para processo que não termina.
2. Executar via agent tool.
3. Observar se a run fica presa sem timeout.

#### Correção Recomendada

Remover o runner duplicado e usar `src/command-runner.ts`.

```ts
import { resolveAllowedCommand, runCommand as runAllowedCommand } from '../../command-runner.js';

const resolved = resolveAllowedCommand(requested);
if (!resolved) {
  throw new Error('Comando nao permitido');
}

const outcome = await runAllowedCommand(resolved.id, context.run.projectRoot);
```

### 4.7 Inline handlers no frontend com risco de XSS

| Campo      | Detalhe                                                          |
| ---------- | ---------------------------------------------------------------- |
| Severidade | Alta                                                             |
| Esforço    | Médio                                                            |
| Prioridade | P1                                                               |
| Arquivos   | `public/devmind.js`, `public/patch-review.js`                    |
| Status     | Confirmado por leitura de código. Reprodução manual recomendada. |

Há dados dinâmicos interpolados em `onclick`.

Exemplo:

```js
onclick = "confirmPlan('${esc(planData.goal)}')";
```

`esc()` não escapa aspas simples. Também há handlers com paths de arquivos.

#### Reprodução Proposta

1. Criar objetivo ou caminho contendo aspas simples e payload JS.
2. Fazer o valor aparecer em botão com `onclick`.
3. Clicar no botão.
4. Verificar se o JS foi interpretado.

#### Correção Recomendada

- Remover `onclick` inline.
- Usar `data-*`.
- Vincular eventos com `addEventListener`.

```js
button.dataset.action = 'open-file';
button.dataset.path = primaryPath;

root.addEventListener('click', (event) => {
  const button = event.target.closest("[data-action='open-file']");
  if (!button) return;
  openPatchFile(button.dataset.path);
});
```

### 4.8 `write_file` pode sobrescrever arquivo sem stale check

| Campo      | Detalhe                           |
| ---------- | --------------------------------- |
| Severidade | Alta                              |
| Esforço    | Médio                             |
| Prioridade | P1                                |
| Arquivo    | `src/action-executor.ts`          |
| Status     | Confirmado por leitura de código. |

`patch_file` faz stale check comparando `before` com conteúdo atual. Mas `write_file` só cria backup e grava `content`.

#### Reprodução Proposta

1. Criar ação `write_file`.
2. Alterar manualmente o arquivo depois da proposta.
3. Aprovar/aplicar a ação.
4. Observar sobrescrita sem bloqueio por stale state.

#### Correção Recomendada

- Depreciar `write_file`.
- Converter writes em `patch_file`.
- Ou adicionar `before`/`baseHash` para `write_file`.

### 4.9 `staged-files` cria fluxo paralelo de escrita

| Campo      | Detalhe                                                |
| ---------- | ------------------------------------------------------ |
| Severidade | Média/Alta                                             |
| Esforço    | Médio                                                  |
| Prioridade | P1                                                     |
| Arquivos   | `src/app/web/server.ts`, `src/app/web/staged-files.ts` |
| Status     | Confirmado por leitura de código.                      |

`POST /api/staged-files/:id/apply` aplica arquivo staged. A rota é protegida por token local, mas não usa `requireConfirmation` e não passa pelo mesmo fluxo de pending actions.

#### Correção Recomendada

- Converter staged file para pending action.
- Ou exigir `requireConfirmation`.
- Ou mostrar staged files dentro do mesmo Patch Review.

### 4.10 Testes intermitentes por estado global/JSON concorrente

| Campo      | Detalhe                                                                              |
| ---------- | ------------------------------------------------------------------------------------ |
| Severidade | Média/Alta                                                                           |
| Esforço    | Alto                                                                                 |
| Prioridade | P1                                                                                   |
| Arquivos   | `tests/active-project-boundary.test.ts`, `tests/pending-actions-concurrency.test.ts` |
| Status     | Reproduzido localmente.                                                              |

Falhas observadas:

```text
EPERM em rename de pending-actions.json
```

```text
/api/project/tree retornou 400 quando o teste esperava 200
```

Causas prováveis:

- `process.env` global alterado em testes paralelos;
- singletons carregados antes/depois de `vi.resetModules()`;
- `activeProjectRoot` em memória;
- stores JSON compartilhados;
- escrita atômica com `rename()` frágil no Windows.

#### Correção Recomendada

- Usar `test.sequential` nos testes que mutam env/global.
- Criar factory de app por teste com dependências injetadas.
- Evitar singletons globais nos stores.
- Mover `NEXUS_DATA_DIR` para setup isolado por arquivo.
- Usar `write-file-atomic` ou SQLite.

### 4.11 Escrita atômica JSON falha no Windows sob concorrência

| Campo      | Detalhe                                        |
| ---------- | ---------------------------------------------- |
| Severidade | Média                                          |
| Esforço    | Médio                                          |
| Prioridade | P2                                             |
| Arquivo    | `src/nexus-data-dir.ts`                        |
| Status     | Reproduzido localmente via teste intermitente. |

Código atual:

```ts
await writeFile(tempPath, content, 'utf8');
await rename(tempPath, filePath);
```

Falha observada:

```text
EPERM: operation not permitted, rename '.pending-actions.json.tmp' -> 'pending-actions.json'
```

#### Correção Recomendada

Adicionar retry específico para Windows ou migrar stores críticos para SQLite.

### 4.12 Command output não redige segredos no runner principal

| Campo      | Detalhe                           |
| ---------- | --------------------------------- |
| Severidade | Média                             |
| Esforço    | Baixo                             |
| Prioridade | P2                                |
| Arquivo    | `src/command-runner.ts`           |
| Status     | Confirmado por leitura de código. |

O agent tool redige com `redactSensitiveText`, mas `src/command-runner.ts` só trunca.

#### Correção Recomendada

```ts
stdout: truncateLog(redactSensitiveText(stdout)),
stderr: truncateLog(redactSensitiveText(suffix)),
```

### 4.13 `npm install` está na whitelist de comandos gerais

| Campo      | Detalhe                           |
| ---------- | --------------------------------- |
| Severidade | Média                             |
| Esforço    | Baixo                             |
| Prioridade | P2                                |
| Arquivo    | `src/command-runner.ts`           |
| Status     | Confirmado por leitura de código. |

`npm install` pode executar lifecycle scripts de dependências. Em IDE local pode ser aceitável, mas deveria exigir confirmação forte separada.

#### Correção Recomendada

- Remover `install` e `install-dev` de `listAllowedCommands()` padrão.
- Criar fluxo dedicado “Instalar dependência” com pacote validado.

### 4.14 `fetch-url` ainda tem SSRF por redirect/DNS rebinding

| Campo      | Detalhe                           |
| ---------- | --------------------------------- |
| Severidade | Média                             |
| Esforço    | Médio                             |
| Prioridade | P2                                |
| Arquivo    | `src/research-tools.ts`           |
| Status     | Confirmado por leitura de código. |

O código bloqueia `localhost`, `127.0.0.1` e ranges privados por hostname textual, mas `fetch()` segue redirects por padrão.

#### Correção Recomendada

- `redirect: "manual"`;
- timeout com `AbortController`;
- validar cada redirect;
- resolver DNS e bloquear IPs privados;
- limitar content-type e tamanho.

### 4.15 Maps em memória sem retenção/eviction

| Campo      | Detalhe                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------ |
| Severidade | Média                                                                                      |
| Esforço    | Médio                                                                                      |
| Prioridade | P2                                                                                         |
| Arquivos   | `src/app/agents/runner.ts`, `src/app/runs/run-event-bus.ts`, `src/app/agents/artifacts.ts` |
| Status     | Confirmado por leitura de código.                                                          |

Há mapas em memória sem política clara de retenção:

```ts
private readonly runs = new Map<string, AgentRun>();
private readonly events = new Map<string, AgentEvent[]>();
private readonly artifacts = new Map<string, AgentArtifact[]>();
private readonly recentEvents = new Map<string, AgentEvent[]>();
private indexCache = new Map<string, ArtifactIndex>();
```

#### Correção Recomendada

- TTL para runs antigos.
- Limite por projeto.
- Paginação para histórico.
- Persistência em SQLite.
- Eviction em `runEventBus` quando run finaliza.

### 4.16 Monaco/Codicons por CDN

| Campo      | Detalhe                           |
| ---------- | --------------------------------- |
| Severidade | Baixa/Média                       |
| Esforço    | Médio                             |
| Prioridade | P3                                |
| Arquivo    | `public/index.html`               |
| Status     | Confirmado por leitura de código. |

O editor depende de CDN. Sem internet, a IDE pode quebrar.

#### Correção Recomendada

- Empacotar Monaco localmente.
- Servir assets por `/vendor/monaco`.
- Manter CDN só como fallback.

### 4.17 Mojibake/encoding quebrado

| Campo      | Detalhe                                                  |
| ---------- | -------------------------------------------------------- |
| Severidade | Baixa                                                    |
| Esforço    | Baixo                                                    |
| Prioridade | P3                                                       |
| Arquivos   | `public/devmind.js`, `.env.example`, `public/index.html` |
| Status     | Confirmado por leitura de código.                        |

Há textos como:

```text
Nexus Codex â€” DevMind v2
ConfiguraÃ§Ãµes
```

#### Correção Recomendada

- Normalizar arquivos para UTF-8.
- Configurar `.editorconfig`.
- Adicionar validação de encoding no CI.

---

## 5. Segurança

| Área                 | Status                      | Observação                                                         |
| -------------------- | --------------------------- | ------------------------------------------------------------------ |
| Path traversal       | Seguro                      | `project-file-store` bloqueia paths absolutos e `..`               |
| Arquivos sensíveis   | Seguro/precisa melhorar     | Bloqueia arquivos sensíveis, mas logs/outputs podem vazar segredos |
| Active project       | Bom, mas instável em testes | `workspace/` padrão é correto; testes indicam estado global frágil |
| Execução de comandos | Precisa melhorar            | Whitelist existe, mas agent tool duplica runner sem timeout        |
| Rate limit           | Bom                         | Existe em endpoints caros                                          |
| API keys             | Precisa melhorar            | Não retorna full key, mas salva em plaintext em JSON               |
| Preview              | Crítico                     | HTML do projeto pode rodar same-origin                             |
| GET de arquivos      | Crítico/precisa melhorar    | `/api/project/file` não exige token                                |
| Patches              | Bom/precisa melhorar        | `patch_file` tem stale check; `write_file` não                     |
| Staged files         | Precisa melhorar            | Fluxo paralelo de aplicação                                        |
| Web fetch            | Precisa melhorar            | SSRF por redirect/DNS rebinding ainda possível                     |
| Binários/zip         | Bom                         | `.gitignore` bloqueia arquivos compactados                         |
| CI secret scan       | Parcial                     | Gitleaks existe com `continue-on-error: true`                      |

---

## 6. Qualidade de Código

### 6.1 Problemas de Organização

| Problema                                    | Impacto                                         | Severidade  |
| ------------------------------------------- | ----------------------------------------------- | ----------- |
| `src/server.ts` tem mais de 1600 linhas     | Difícil revisar, testar e manter                | Média       |
| Frontend usa estado global único `state`    | Facilita regressões entre módulos               | Média       |
| Muitos `innerHTML` com template strings     | Risco de XSS e bugs de escaping                 | Alta        |
| Dois command runners diferentes             | Segurança e timeout inconsistentes              | Alta        |
| Stores JSON/JSONL espalhados                | Concorrência difícil, migração futura mais cara | Média       |
| `workspace-store.ts` legado usa `__dirname` | Pode divergir do active project real            | Média       |
| `staged-files` cria segundo modelo de patch | Confunde regra “tudo passa pelo Patch Review”   | Média       |
| Textos com encoding quebrado                | UX ruim                                         | Baixa       |
| Pasta não rastreada `claude ia/`            | Parece resíduo/artefato solto                   | Baixa/Média |

### 6.2 Refatoração Recomendada: Split de Rotas

```text
src/routes/
  health-routes.ts
  project-routes.ts
  patch-routes.ts
  command-routes.ts
  git-routes.ts
  ai-settings-routes.ts
  workspace-legacy-routes.ts
```

### 6.3 Refatoração Recomendada: Runner de Comandos Único

Antes:

```ts
const child = spawn(executable, finalArgs, {
  cwd: projectRoot,
  env: process.env,
  shell: false,
  windowsHide: true,
});
```

Depois:

```ts
import { resolveAllowedCommand, runCommand } from '../../command-runner.js';

const resolved = resolveAllowedCommand(requested);
if (!resolved) {
  throw new Error('Comando nao permitido');
}

const result = await runCommand(resolved.id, context.run.projectRoot);
```

### 6.4 Refatoração Recomendada: UI sem `onclick` inline

Antes:

```js
button.innerHTML = `<button onclick="openPatchFile('${path}')">Abrir</button>`;
```

Depois:

```js
button.dataset.action = 'open-file';
button.dataset.path = path;

root.addEventListener('click', (event) => {
  const button = event.target.closest("[data-action='open-file']");
  if (!button) return;
  openPatchFile(button.dataset.path);
});
```

---

## 7. Qualidade de Testes

### 7.1 Cobertura Atual

A suíte tem 22 arquivos e 93 testes observados.

Áreas cobertas:

- command runner;
- project file store;
- action executor;
- patch payload;
- patches API;
- SSE/event bus;
- run store;
- active project boundary;
- local security;
- AI settings;
- context builder;
- provider router;
- preview;
- backup store.

### 7.2 Problemas Atuais

| Problema                                                     | Impacto                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `npm test` falhou de forma intermitente                      | CI pode ser não determinístico                                                  |
| Testes usam `process.env` global                             | Paralelismo do Vitest pode causar colisão                                       |
| Vários módulos são singletons                                | `vi.resetModules()` não garante isolamento completo se testes rodam em paralelo |
| Persistência JSON é compartilhada por processo               | Concorrência no Windows falha                                                   |
| Testes de preview não parecem cobrir same-origin/token abuse | Vulnerabilidade crítica não detectada                                           |

### 7.3 Testes Unitários Novos Recomendados

| Teste                                 | Objetivo                                                                |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `preview-security.test.ts`            | Garantir CSP sandbox em `/preview/project/*`                            |
| `local-security-get-project.test.ts`  | Garantir que GET `/api/project/file` exige token                        |
| `command-runner-redaction.test.ts`    | Garantir que stdout/stderr não salvam tokens                            |
| `agent-tools-command-timeout.test.ts` | Garantir que tools de agentes usam timeout                              |
| `inline-render-safety.test.ts`        | Garantir que paths/goals com `'"><script>` não criam `onclick` perigoso |

### 7.4 Testes de Integração Novos Recomendados

| Teste                                                   | Objetivo                                     |
| ------------------------------------------------------- | -------------------------------------------- |
| Preview malicioso não consegue chamar API               | Validar isolamento real                      |
| Criar patch, alterar arquivo manualmente, aplicar patch | Garantir stale protection                    |
| `write_file` com arquivo alterado                       | Deve bloquear ou converter para `patch_file` |
| `/api/staged-files/:id/apply` exige confirmação         | Garantir aprovação explícita                 |
| `npm start` após `npm run build`                        | Garantir release funcional                   |

### 7.5 Testes Manuais Obrigatórios

| Teste                     | Critério                                                         |
| ------------------------- | ---------------------------------------------------------------- |
| Preview de HTML malicioso | Não consegue ler `/api/health` nem chamar POSTs                  |
| Build/start release       | `npm run build` + `npm start` abre app corretamente              |
| Patch stale               | Alterar arquivo após patch e confirmar que aplicação é bloqueada |

---

## 8. UX e Produto

### 8.1 O Que Está Bom

Os itens abaixo são diferenciais de produto que devem ser preservados:

- Layout estilo VS Code é familiar.
- Monaco Editor no centro dá sensação real de IDE.
- IA lateral evita trocar contexto.
- Patch Review com Monaco Diff é um diferencial forte.
- Terminal controlado é mais seguro do que terminal livre.
- “Corrigir com Nexus” no Problems/Terminal é direção correta.
- SSE deixa o agente parecer vivo.
- Active workspace reduz confusão entre Nexus app e projeto do usuário.

### 8.2 O Que Ainda Está Confuso

| Problema                                                                             | Impacto                                      |
| ------------------------------------------------------------------------------------ | -------------------------------------------- |
| Explorer mostra staged files misturados com arquivos reais                           | Pode confundir usuário                       |
| `Sessions` aparece como placeholder                                                  | Dá sensação de produto inacabado             |
| Git está em painel lateral, mas ainda não é fluxo completo                           | Pode frustrar                                |
| `Editar com IA`, DevMind, staged files e Patch Review parecem três fluxos diferentes | Produto fica mentalmente pesado              |
| Preview funciona, mas é perigoso em popout                                           | UX boa com risco alto                        |
| Vários textos têm mojibake                                                           | Quebra percepção profissional                |
| Configurações de IA pedem API key em inputs simples                                  | Funciona, mas precisa UX de segurança melhor |

---

## 9. Arquitetura

### 9.1 O Que Está Organizado

- Separação de agentes em `src/app/agents`.
- Separação de AI router/providers em `src/app/ai`.
- File store e active project existem como camada própria.
- Patch payload/action executor separados.
- Event bus SSE separado.
- Testes cobrem módulos de risco.

### 9.2 O Que Deve Ser Refatorado

| Item                         | Ação                                                             |
| ---------------------------- | ---------------------------------------------------------------- |
| `src/server.ts`              | Dividir em routers                                               |
| `src/app/agents/tools.ts`    | Usar `src/command-runner.ts`                                     |
| `workspace-store.ts`         | Depreciar ou alinhar com active project                          |
| Stores JSON                  | Criar interface comum e depois migrar para SQLite                |
| `local-security`             | Separar token, origin, confirmation e preview security           |
| Frontend global              | Encapsular módulos e remover inline handlers                     |
| `staged-files`               | Integrar ao Patch Review ou remover                              |
| `scripts/generate-index.cjs` | Confirmar se ainda é usado; se não, mover para legacy ou remover |

### 9.3 O Que Deve Migrar para SQLite

| Dados                  | Motivo                              |
| ---------------------- | ----------------------------------- |
| `pending-actions.json` | Concorrência e transações           |
| `sessions.json`        | Histórico cresce e precisa consulta |
| `runs.jsonl`           | Rehidratação e timeline             |
| `ai-usage.json`        | Consulta por período/provider       |
| `staged-files.json`    | Estado de patches/preview           |
| patch history          | Auditoria e rollback                |

---

## 10. Dívida Técnica e Segurança Prioritária

| Item                                             | Impacto | Dificuldade | Prioridade |
| ------------------------------------------------ | ------: | ----------: | ---------: |
| Preview isolado/sandboxado                       |    Alto |       Média |         P0 |
| Token local não exposto em `/api/health` público |    Alto |       Média |         P0 |
| Proteger GETs de projeto/workspace               |    Alto |       Baixa |         P1 |
| Corrigir `npm start` e paths dev/build           |    Alto | Baixa/Média |         P1 |
| Unificar command runner                          |    Alto |       Média |         P1 |
| Corrigir flakiness dos testes                    |    Alto |        Alta |         P1 |
| Remover inline handlers                          |    Alto |       Média |         P1 |
| Migrar stores críticos para SQLite               |    Alto |        Alta |         P2 |
| Redigir segredos em outputs de comandos          |   Médio |       Baixa |         P2 |
| SSRF hardening em `fetch-url`                    |   Médio |       Média |         P2 |
| Empacotar Monaco local                           |   Médio |       Média |         P3 |
| Corrigir encoding/mojibake                       |   Médio |       Baixa |         P3 |

---

## 11. Novas Funcionalidades Sugeridas

| Ideia                                      |     Impacto | Dificuldade | Prioridade |
| ------------------------------------------ | ----------: | ----------: | ---------: |
| Command Palette estilo VS Code             |        Alto |       Média |         P1 |
| Busca global por conteúdo                  |        Alto |       Média |         P1 |
| Refatorar seleção com IA                   |        Alto |       Média |         P1 |
| Gerar testes para arquivo atual            |        Alto |       Média |         P1 |
| Explicar arquivo atual                     |       Médio |       Baixa |         P1 |
| Histórico de patches aplicados             |        Alto |       Média |         P1 |
| Rollback visual de patch                   |        Alto |       Média |         P1 |
| Checkpoint antes de aplicar patch          |        Alto |       Média |         P1 |
| Auto-run typecheck após patch              |        Alto | Baixa/Média |         P1 |
| Painel Problems com navegação melhor       |       Médio |       Média |         P1 |
| Git visual completo                        |        Alto |        Alta |         P2 |
| Electron/Tauri desktop real                |        Alto |        Alta |         P2 |
| Diagnóstico automático do projeto          |       Médio |       Média |         P2 |
| Templates de projetos                      |       Médio |       Média |         P2 |
| Modo seguro para iniciante                 |       Médio |       Baixa |         P2 |
| Voz/TTS opcional estilo Jarvis programador |       Médio |       Média |         P3 |
| Marketplace/plugins                        |       Médio |        Alta |         P3 |
| Comparação entre respostas de agentes      | Baixo/Médio |       Média |         P3 |

---

## 12. Roadmap

### Fase 1 — Estabilizar V1

- Corrigir Preview same-origin.
- Bindar servidor em `127.0.0.1`.
- Proteger GETs de projeto/workspace com token.
- Corrigir `npm start` e paths dev/build.
- Unificar command runner dos agentes.
- Corrigir flakiness dos testes.
- Remover inline handlers perigosos.
- Decidir destino de `staged-files`.
- Normalizar encoding UTF-8.
- Limpar working tree e arquivos soltos como `claude ia/`.

### Fase 2 — Melhorar Experiência de Programar

- Command Palette real.
- Busca global por conteúdo.
- Refatorar seleção.
- Gerar testes para arquivo atual.
- Explicar arquivo atual.
- Auto-run typecheck depois de patch.
- Histórico de patches aplicados.
- Rollback visual.

### Fase 3 — Desktop/App Real

- Electron/Tauri com IPC seguro.
- Separar processo backend/renderer.
- Permissões explícitas para terminal/filesystem.
- Empacotamento instalável.
- Atualização automática opcional.

### Fase 4 — IA Mais Poderosa

- Roteamento melhor de agentes.
- Context builder com ranking real.
- Memória por projeto com compactação.
- Planner antes de patch.
- Tool use mais estruturado.
- Modo local/premium com orçamento.

### Fase 5 — Produto Premium

- Voz/TTS opcional.
- Templates e starters.
- Marketplace de agentes/tools.
- Onboarding.
- Métricas locais de produtividade.
- Diagnóstico visual/preview avançado.

---

## 13. Próximo PR Recomendado

### Branch

```text
codex/fix-preview-api-boundary
```

### Título

```text
fix: harden local preview and API boundary
```

### Objetivo

Corrigir o maior risco atual: preview HTML rodando na mesma origem do Nexus com acesso indireto às APIs locais.

### Escopo

- Bindar servidor em `127.0.0.1` por padrão.
- Proteger GETs de projeto/workspace com token.
- Remover token aberto de `/api/health` ou criar bootstrap mais seguro.
- Adicionar CSP sandbox nos endpoints `/preview/project/*` e `/preview/staged/*`.
- Impedir popout unsafe de preview same-origin.
- Ajustar frontend para continuar funcionando com token em APIs.
- Criar testes de segurança para preview e GETs de projeto.

### Arquivos Prováveis

- `src/server.ts`
- `src/local-security.ts`
- `src/app/web/server.ts`
- `public/preview.js`
- `public/app.js`
- `tests/preview-security.test.ts`
- `tests/local-security.test.ts`

### Critérios de Aceite

- `/preview/project/*` não consegue acessar `/api/*`.
- `/preview/staged/*` não consegue acessar `/api/*`.
- `/api/project/file` sem token retorna 401/403.
- `/api/project/tree` sem token retorna 401/403.
- `/api/workspace/file` sem token retorna 401/403.
- App continua carregando normalmente em `localhost:4000`.
- `npm test` passa de forma consistente.
- `npm run typecheck` passa.
- `npm run build` passa.
- `npm run ci` passa.

### Comandos de Validação

```powershell
cmd /c npm test
cmd /c npm run typecheck
cmd /c npm run build
cmd /c npm run ci
```

---

## 14. Checklist

| Prioridade | Ação                                                          |
| ---------- | ------------------------------------------------------------- |
| P0         | Corrigir preview same-origin                                  |
| P0         | Bindar servidor em `127.0.0.1`                                |
| P0         | Remover token aberto de `/api/health` ou restringir bootstrap |
| P1         | Proteger GETs de projeto/workspace                            |
| P1         | Unificar command runner                                       |
| P1         | Corrigir flakiness dos testes                                 |
| P1         | Remover `onclick` inline com dados dinâmicos                  |
| P1         | Corrigir `npm start` e paths dev/build                        |
| P2         | Migrar stores críticos para SQLite                            |
| P2         | Redigir segredos de outputs de comandos                       |
| P2         | Limpar working tree e artefatos soltos                        |
| P3         | Melhorar UX e recursos avançados                              |

---

## Apêndice

O prompt operacional para implementação do próximo PR foi separado em:

```text
docs/PROMPT_NEXT_PR.md
```
