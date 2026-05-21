# Nexus IA

Nexus IA e um assistente de programacao com IA em formato de IDE web local. Ele combina editor Monaco, explorador de arquivos, agentes, revisao visual de patches, comandos controlados e progresso em tempo real para ajudar a criar, corrigir e validar software com seguranca.

## Nexus IA v1.0 MVP

Esta versao entrega o nucleo usavel do produto:

- IDE web local com layout inspirado em VS Code.
- Monaco Editor com abas, Ctrl+S e salvamento manual.
- Explorer de projeto com criacao, renomeacao e remocao segura de arquivos/pastas.
- Painel Nexus AI lateral conectado ao fluxo de agentes.
- Patch Review visual com Monaco Diff Editor.
- Progresso de agentes em tempo real via Server-Sent Events.
- Execucao controlada de comandos de build, typecheck, test e Git.
- Corrigir com Nexus a partir do erro real de build/typecheck/test.
- Commit assistido com mensagem gerada e confirmacao explicita.
- Context Builder seletivo para reduzir contexto enviado para IA.
- Rate limit em endpoints caros.
- Testes automatizados e CI.
- Persistencia minima de runs em JSONL.

## Como Instalar

```powershell
npm install
```

## Como Rodar

```powershell
npm run dev
```

Abra:

```text
http://localhost:4000
```

## Configuracao de IA

O Nexus pode usar provider local ou premium pelo backend. Nunca coloque API key no frontend.

Variaveis comuns:

```env
NEXUS_AI_MODE=economy
NEXUS_AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:7b

ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
```

Modos esperados:

- `economy`: prioriza Ollama/local e so usa fallback premium se permitido.
- `balanced`: usa local para tarefas simples e provider configurado para tarefas maiores.
- `premium`: prioriza providers externos configurados.
- `manual`: usa explicitamente o provider selecionado.

## Como Usar o Editor

1. Abra o app em `http://localhost:4000`.
2. Use o Explorer na esquerda para escolher um arquivo.
3. Edite no Monaco Editor ao centro.
4. Salve com `Ctrl+S` ou pelo botao de salvar.
5. Arquivos modificados aparecem com indicador de dirty state nas abas.

## Como Pedir Patch Para IA

No painel Nexus AI, descreva uma tarefa de programacao:

```text
Crie um arquivo docs/agent-test.md explicando o Nexus IA.
```

O Nexus deve:

1. escolher ou usar um agente;
2. analisar o projeto;
3. criar plano;
4. propor patch;
5. enviar o patch para revisao;
6. aguardar aprovacao antes de aplicar.

## Como Revisar Diff

Abra a aba inferior `Patch Review`.

Cada patch pode mostrar:

- agente;
- objetivo;
- arquivos afetados;
- risco;
- status;
- diff visual antes/depois;
- acoes para aplicar, rejeitar, copiar diff textual e rodar validacoes.

Nenhum agente deve aplicar codigo automaticamente sem aprovacao explicita.

## Como Aplicar Patch

Na tela `Patch Review`:

1. selecione o patch;
2. confira o diff visual;
3. clique em aplicar;
4. o Nexus cria backup quando aplicavel;
5. arquivos abertos no Monaco sao atualizados se nao tiverem alteracoes manuais nao salvas.

Se o arquivo mudou desde a criacao do patch, o backend deve bloquear a aplicacao e pedir recalculo.

## Como Rodar Typecheck, Build e Testes

Pelo terminal:

```powershell
npm test
npm run typecheck
npm run build
npm run ci
```

Pela interface, use o painel inferior ou a area de execucao para rodar comandos permitidos, como:

- `npm run typecheck`
- `npm run build`
- `npm test`
- `git status`
- `git diff`

Comandos perigosos devem ser bloqueados ou exigir confirmacao.

## Progresso dos Agentes

Runs de agentes emitem eventos em tempo real via SSE:

```text
GET /api/agents/runs/:runId/events/stream
```

Eventos principais:

- `started`
- `planning`
- `running`
- `tool_call`
- `tool_result`
- `artifact_created`
- `patch_created`
- `needs_approval`
- `completed`
- `failed`
- `cancelled`
- `interrupted`

O endpoint antigo continua disponivel:

```text
GET /api/agents/runs/:runId/events
```

## Endpoints Principais

Saude:

```text
GET /api/health
```

Projeto:

```text
GET /api/project
GET /api/project/scan
GET /api/project/tree?projectRoot=
GET /api/project/git/status
POST /api/project/run-command
```

Agentes:

```text
GET /api/agents
POST /api/agents/run
GET /api/agents/runs/:runId
POST /api/agents/runs/:runId/cancel
GET /api/agents/runs/:runId/events
GET /api/agents/runs/:runId/events/stream
GET /api/agents/runs/:runId/artifacts
```

Patches:

```text
GET /api/patches
GET /api/patches/:patchId
POST /api/patches/:patchId/apply
POST /api/patches/:patchId/reject
```

Testes e comandos:

```text
POST /api/tests/run
POST /api/commands/run
```

Git:

```text
GET /api/git/status
GET /api/git/diff
POST /api/git/commit-message
POST /api/git/commit
```

Fluxo dev:

```text
POST /api/dev/fix-command
```

## Estrutura

```text
src/
  server.ts
  app/
    agents/
    ai/
    runs/
    web/
public/
  index.html
  app.js
  editor.js
  explorer.js
  patch-review.js
  agent-progress.js
docs/
  RELEASE_V1_CHECKLIST.md
data/
  runs.jsonl
```

## Seguranca

O Nexus deve:

- bloquear path traversal;
- bloquear acesso fora do projeto;
- bloquear arquivos sensiveis como `.env`, `.pem`, `.key`, `id_rsa`, `secrets.json` e `token.json`;
- evitar escrita em `.git`, `node_modules`, `dist`, `data` e `coverage`;
- nao expor tokens nos logs;
- aplicar rate limit em endpoints caros;
- exigir Patch Review antes de aplicar mudancas.

## Validacao

Antes de abrir ou atualizar PR:

```powershell
npm test
npm run typecheck
npm run build
npm run ci
```

## Limitacoes Atuais

- SQLite ainda nao foi implementado; runs usam persistencia minima em JSONL.
- Electron IPC completo ainda nao faz parte do MVP.
- O roteamento de agentes ainda usa heuristicas simples.
- O modo local depende do Ollama estar rodando e do modelo estar instalado.
- Providers premium podem gerar custo; use modo economico quando necessario.
- Preview visual e deploy ainda sao etapas futuras.
- O commit assistido nao faz push automatico.

## Proximos Passos

- Migrar sessions, patches, pending actions e runs para SQLite.
- Melhorar selecao de contexto para reduzir custo de IA.
- Adicionar preview visual conectado ao Builder Agent.
- Criar commit assistido apos patch aplicado e validado.
- Melhorar recuperacao automatica de patches stale.
