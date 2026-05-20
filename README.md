# Nexus IA

Nexus IA e uma IDE web local com assistente de programacao por IA. A proposta e simples: abrir um projeto, editar codigo com Monaco, pedir ajuda ao Nexus, revisar patches visualmente, aplicar com aprovacao e validar com comandos controlados.

## Nexus IA v1.0 MVP

Esta versao fecha o primeiro ciclo usavel do produto:

- IDE web local em Node.js e Express.
- Monaco Editor com Explorer, abas, edicao manual e `Ctrl+S`.
- Nexus AI lateral para conversar sobre o projeto ativo.
- Patch Review visual com Monaco Diff.
- Progresso em tempo real dos agentes via SSE.
- Comandos controlados para build, typecheck, testes e Git basico.
- Seguranca basica para arquivos sensiveis, path traversal e comandos perigosos.
- Testes automatizados com Vitest, Supertest, typecheck, build e CI.

O foco da v1 MVP e o fluxo principal:

```text
usuario pede algo
-> Nexus analisa o projeto
-> agente cria plano
-> agente gera patch
-> usuario revisa diff
-> usuario aplica
-> Nexus roda validacao
```

## Requisitos

- Node.js 20 ou superior.
- npm.
- Git.
- Opcional: Ollama para modo local/economico.
- Opcional: chave de API premium para Anthropic, OpenAI, Gemini, Groq ou OpenRouter.

## Instalar

```bash
npm install
```

## Rodar em desenvolvimento

```bash
npm run dev
```

Abra:

```text
http://localhost:4000
```

## Build e start

```bash
npm run build
npm start
```

## Configurar IA

A configuracao principal fica em `Configuracoes > IA` dentro do app.

Providers suportados na v1 MVP:

- Ollama local.
- Anthropic.
- OpenAI.
- Gemini.
- Groq.
- OpenRouter.

Variaveis uteis:

```bash
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:7b
```

Recomendacao para reduzir custo:

- Use modo `Economico` com Ollama quando possivel.
- Use providers premium somente para tarefas maiores ou mais dificeis.

## Usar a IDE

1. Abra o app em `http://localhost:4000`.
2. Use o Explorer na esquerda para navegar no projeto.
3. Clique em um arquivo para abrir no Monaco Editor.
4. Edite manualmente.
5. Salve pelo botao `Salvar` ou com `Ctrl+S` / `Cmd+S`.

O Nexus bloqueia arquivos e pastas sensiveis como `.env`, `.key`, `.pem`, `id_rsa`, `secrets.json`, `.git`, `node_modules`, `dist`, `data` e `coverage`.

## Pedir patches para IA

Use o painel `Nexus AI` na direita.

Exemplos:

```text
Crie um arquivo docs/arquitetura.md explicando o projeto.
Corrija o erro do build.
Melhore a Home e gere um patch revisavel.
```

O Nexus nao deve aplicar mudancas automaticamente. Alteracoes de codigo devem passar pelo Patch Review.

## Revisar e aplicar patches

1. Abra `Patch Review` no painel inferior.
2. Selecione um patch pendente.
3. Revise o diff lado a lado.
4. Use:
   - `Aplicar patch`.
   - `Rejeitar patch`.
   - `Copiar diff textual`.
   - `Rodar typecheck`.
   - `Rodar build`.

Se o arquivo mudou desde a proposta, o Nexus mostra erro de patch stale e pede recalculo.

## Ver progresso dos agentes

Quando o Code Chat inicia uma run, o painel `Output` mostra uma timeline em tempo real via SSE.

Eventos esperados:

- Agente iniciado.
- Planejando solucao.
- Analisando projeto.
- Usando ferramenta.
- Artefato criado.
- Patch proposto.
- Aguardando revisao.
- Concluido, falhou, cancelado ou interrompido.

Endpoint SSE:

```text
GET /api/agents/runs/:runId/events/stream
```

Endpoint historico preservado:

```text
GET /api/agents/runs/:runId/events
```

## Comandos de validacao

```bash
npm test
npm run typecheck
npm run build
npm run ci
```

## Estrutura principal

```text
src/server.ts                 servidor Express principal
src/app/agents/*              agentes, runner, tools e artefatos
src/app/runs/*                persistencia JSONL e event bus de runs
src/app/web/server.ts         rotas de agentes, chat, staged files e SSE
src/project-file-store.ts     acesso seguro ao projeto
src/action-executor.ts        aplicacao controlada de acoes aprovadas
public/*                      frontend estatico da IDE
tests/*                       testes automatizados
docs/RELEASE_V1_CHECKLIST.md  checklist operacional da v1 MVP
```

## Limites atuais

- Nao ha SQLite nesta versao; parte do estado ainda usa JSON/JSONL.
- Electron IPC dedicado fica para um PR futuro.
- O terminal e controlado por whitelist, nao e um shell livre completo.
- Monaco/codicons podem depender de CDN em desenvolvimento.
- Git e commit assistido ainda sao basicos.
- Preview/site builder ainda e inicial.

## Release checklist

Veja [docs/RELEASE_V1_CHECKLIST.md](docs/RELEASE_V1_CHECKLIST.md).
