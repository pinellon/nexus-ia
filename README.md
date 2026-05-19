# Nexus Codex

Nexus Codex e um assistente de programacao com IA. O usuario conversa com o sistema, o Nexus entende o projeto aberto, prepara planos e patches revisaveis, roda validacoes seguras e so aplica mudancas depois de confirmacao.

## Visao

O Nexus nao trata agentes como produto final. Claude, Codex/OpenAI, Blackbox e Antygravit funcionam como uma equipe interna:

- Usuario faz o pedido
- Nexus classifica a intencao
- Nexus analisa o projeto ativo
- Agentes planejam, leem arquivos reais e preparam patches
- Usuario revisa o diff em Patch Review
- Nexus aplica somente com aprovacao
- Nexus roda validacoes controladas

Nada e aplicado automaticamente.

## Stack

- TypeScript
- Express
- Frontend web estatico compacto
- Persistencia local em JSON
- Workspace local protegido
- Runtime interno de coding agents com eventos, artifacts e Patch Review
- Estrutura inicial para Electron

## Como rodar na web

```bash
npm install
npm run dev
```

Abra [http://localhost:4000](http://localhost:4000).

## Como rodar a estrutura desktop

Hoje os scripts deixam a base preparada para um shell desktop futuro:

```bash
npm run desktop:dev
npm run desktop:build
```

Arquivos principais:

- [C:\nexus ai\electron\main.ts](C:\nexus ai\electron\main.ts)
- [C:\nexus ai\electron\preload.ts](C:\nexus ai\electron\preload.ts)

## Variaveis de ambiente

Copie `.env.example` para `.env` e ajuste o que precisar.

- `NEXUS_AI_MODE`: `economy`, `balanced` ou `premium`
- `NEXUS_AI_PROVIDER`: `auto`, `ollama`, `anthropic` ou `openai`
- `NEXUS_PREMIUM_PROVIDER`: `anthropic` ou `openai`
- `NEXUS_REQUIRE_CONFIRM_PREMIUM`: pede confirmacao antes de usar API paga
- `NEXUS_MONTHLY_API_BUDGET_BRL`: limite mensal estimado
- `OLLAMA_BASE_URL`: URL local do Ollama
- `OLLAMA_MODEL`: modelo local, ex: `qwen2.5-coder:7b`
- `ANTHROPIC_API_KEY`: ativa Claude real
- `ANTHROPIC_MODEL`: modelo Claude
- `OPENAI_API_KEY`: ativa Codex/OpenAI real
- `OPENAI_MODEL`: modelo OpenAI para o adapter Codex
- `BLACKBOX_API_KEY`: chave do adapter Blackbox
- `BLACKBOX_API_URL`: URL do provedor Blackbox real
- `ENABLE_CLAUDE`: `true` ou `false`
- `ENABLE_CODEX`: `true` ou `false`
- `ENABLE_BLACKBOX`: `true` ou `false`
- `ENABLE_ANTYGRAVIT`: `true` ou `false`
- `ENABLE_MOCK`: reservado para manter comportamento local em modo mock
- `GITHUB_TOKEN`: opcional para pesquisa GitHub com limite maior

## Fluxo principal

1. Abra o Nexus em `http://localhost:4000`.
2. Use `Code Chat` ou `Agents` para pedir uma tarefa de programacao.
3. O Nexus analisa o projeto ativo e escolhe ou sugere um agente.
4. O agente gera plano, timeline, artefatos e um patch revisavel.
5. Revise o diff em `Patch Review`.
6. Clique em `Aplicar` ou `Rejeitar`.
7. Se aplicar, rode `typecheck`, `build` ou `test` na tela `Executar`.
8. Se houver falha, use `Corrigir com Nexus` para abrir um `Debug Agent`.

## Areas compactas

A interface principal tem somente seis areas:

- `Chat`: ponto central para pedir criacao, correcao ou melhoria, agora montado pelo componente visual `DevMind`
- `Projeto`: contexto do projeto atual e Git
- `Patches`: revisao e aprovacao de mudancas
- `Executar`: build, typecheck, testes e comandos controlados
- `Agentes`: quatro agentes principais
- `Configuracoes`: basico, IA, seguranca e avancado

## IA hibrida e economica

O Nexus usa um roteador de providers para reduzir custo:

- `economy`: tenta Ollama/local primeiro e so usa premium com confirmacao
- `balanced`: usa local para tarefas simples e premium para tarefas complexas
- `premium`: usa Claude/OpenAI como provider principal

Se o provider premium nao estiver configurado, o Nexus volta para Ollama local e mostra um aviso amigavel. Se o limite mensal estimado for atingido, chamadas premium sao bloqueadas ate o usuario ajustar o limite ou usar modo local.

Providers suportados:

- Ollama local
- Anthropic/Claude
- OpenAI

Para usar Ollama local:

```bash
ollama pull qwen2.5-coder:7b
```

Depois configure:

```env
NEXUS_AI_MODE=economy
NEXUS_AI_PROVIDER=auto
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:7b
```

O status aparece em `Configuracoes > IA`, incluindo provider, modelo, chamadas locais, chamadas premium e custo estimado do mes.

## Coding agents

O runtime interno ainda suporta agentes especializados em `src/app/agents/`, mas a UI principal mostra apenas quatro modos:

- `Builder`: usa `site_builder_agent`
- `Debug`: usa `debug_agent`
- `Refactor`: usa `refactor_agent`
- `Docs`: usa `docs_agent`

Cada run cria:

- plano inicial
- timeline de eventos
- artefatos persistidos em `data/projects/{project_id}/artifacts/`
- historico em `data/projects/{project_id}/history.jsonl`
- patch revisavel em Patch Review quando houver proposta de mudanca

Ferramentas iniciais do runtime:

- `read_project_tree`
- `read_file`
- `search_files`
- `propose_patch`
- `run_terminal_command`
- `git_status`
- `git_diff`
- `run_tests`
- `run_build`
- `generate_readme`
- `analyze_error`

Regra central:

- agentes nao escrevem em arquivo diretamente
- toda alteracao vira patch ou acao pendente revisavel
- nenhum patch e aplicado automaticamente

## Seguranca

- Sem path traversal
- Sem acesso fora de `workspace/` ou `project_root`
- Arquivos sensiveis bloqueados, como `.env`, `.pem`, `.key`, `id_rsa`, `secrets.json`, `token.json`
- `node_modules`, `.git`, `dist`, `data` e `coverage` ficam fora da leitura do project tree
- Sem execucao de comando livre
- Somente comandos whitelistados
- Timeout em comandos
- Logs truncados
- Logs de terminal e historico passam por redacao simples de tokens
- Chaves nunca expostas no frontend

## Agentes conversacionais

Funcionam hoje:

- `claude`: real com `ANTHROPIC_API_KEY`, mock sem chave
- `codex`: real com `OPENAI_API_KEY`, mock sem chave
- `antygravit`: agente local de revisao de risco e seguranca
- `blackbox`: adapter-ready; desabilitado por padrao, sem endpoint falso

## Endpoints principais

Sessoes:

- `GET /api/sessions`
- `POST /api/sessions`
- `GET /api/sessions/:id`
- `DELETE /api/sessions/:id`

Projeto:

- `GET /api/project`
- `GET /api/project/scan`
- `GET /api/project/git/status`
- `GET /api/project/file?path=`
- `PUT /api/project/file`
- `POST /api/project/run-command`

Workspace:

- `GET /api/workspace/files`
- `GET /api/workspace/file?path=`
- `POST /api/workspace/file`
- `PUT /api/workspace/file`
- `DELETE /api/workspace/file`

Coding agents:

- `GET /api/agents`
- `POST /api/agents/run`
- `GET /api/agents/runs/:runId`
- `POST /api/agents/runs/:runId/cancel`
- `GET /api/agents/runs/:runId/events`
- `GET /api/agents/runs/:runId/artifacts`

Patch Review:

- `GET /api/patches`
- `GET /api/patches/:patchId`
- `POST /api/patches/:patchId/apply`
- `POST /api/patches/:patchId/reject`

Code Chat:

- `GET /api/ai/status`
- `POST /api/code-chat`

Entrada:

```json
{
  "messages": [{ "role": "user", "content": "crie uma tela de login" }],
  "streaming": true
}
```

Saida:

```json
{
  "ok": true,
  "message": "...",
  "executed": false,
  "run_id": "...",
  "patch_ids": [],
  "artifacts": [],
  "next_actions": []
}
```

O `DevMind` nunca chama Anthropic/OpenAI direto do navegador. Tudo passa pelo backend local do Nexus.

Pesquisa:

- `POST /api/tools/web-search`
- `POST /api/tools/github-search`
- `POST /api/tools/fetch-url`

Comandos e validacao:

- `POST /api/commands/run`
- `POST /api/tests/run`

Git:

- `GET /api/git/status`
- `GET /api/git/diff`
- `POST /api/git/commit-message`
- `POST /api/git/commit`

## Como testar

1. Rode `npm run typecheck`
2. Rode `npm run build`
3. Rode `npm run dev`
4. Abra `Chat`, `Projeto`, `Patches`, `Executar`, `Agentes` e `Configuracoes`
5. No `Code Chat`, peca: `crie um arquivo docs/agent-test.md com um resumo curto do Nexus Codex`
6. Confirme que um `Agent Run` foi criado e o patch apareceu em `Patch Review`
7. Revise o diff e clique em `Aplicar`
8. Confirme que `docs/agent-test.md` existe no projeto
9. Abra `Executar` e rode `npm run typecheck`
10. Se houver falha, clique em `Corrigir com Nexus`
11. Abra `Projeto` para revisar Git status e Git diff

## Limitacoes atuais

- O editor manual saiu da navegacao principal nesta versao compacta
- Os heuristics dos agents ainda sao simples; o foco atual e fechar o loop principal, nao sofisticar o planner
- O diff usa uma visualizacao textual clara, mas ainda nao e um diff Monaco lado a lado
- Os runs ativos ficam em memoria do servidor
- Nao ha push automatico nem deploy nesta fase

## Proximo passo natural

- Melhorar o diff visual do Patch Review
- Tornar os agents de UI e refactor mais inteligentes em patches reais
- Refinar o fluxo de aplicar patch e rodar suite de validacao em cadeia
