# Nexus IA v1.0 MVP Release Checklist

Este checklist valida a primeira versao usavel do Nexus IA como IDE web local com agentes, patches revisaveis e progresso em tempo real.

## Como instalar

1. Instale Node.js 20 ou superior.
2. Clone o repositorio.
3. Rode:

```bash
npm install
```

## Como rodar

Modo desenvolvimento:

```bash
npm run dev
```

Abra:

```text
http://localhost:4000
```

Build de producao:

```bash
npm run build
npm start
```

## Como configurar IA

1. Abra o Nexus em `http://localhost:4000`.
2. Entre em `Configuracoes`.
3. Escolha o modo de IA:
   - `Economico`: prioriza Ollama/local.
   - `Balanceado`: usa local quando possivel e premium quando necessario.
   - `Premium`: prioriza provider externo configurado.
4. Configure um provider:
   - Anthropic, OpenAI, Gemini, Groq, OpenRouter ou Ollama.
5. Salve e use `Testar` para validar o provider.

Variaveis uteis:

```bash
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:7b
```

## Como abrir arquivo

1. Use o Explorer na esquerda.
2. Clique em um arquivo permitido do projeto.
3. O arquivo abre no Monaco Editor no centro.
4. Arquivos bloqueados por seguranca, como `.env`, `.key`, `.pem`, `.git` e `node_modules`, nao devem abrir.

## Como editar e salvar

1. Edite manualmente no Monaco Editor.
2. Observe o status `modificado`.
3. Salve com:
   - Botao `Salvar`.
   - `Ctrl+S` ou `Cmd+S`.
4. O status deve voltar para `salvo`.

## Como pedir patch para IA

1. Use o painel `Nexus AI` na direita.
2. Digite uma tarefa de programacao, por exemplo:

```text
Crie um arquivo docs/exemplo.md explicando o projeto.
```

3. O Nexus deve iniciar uma execucao de agente.
4. O agente deve analisar o projeto e propor uma mudanca revisavel.

## Como revisar diff

1. Abra `Patch Review` no painel inferior.
2. Selecione um patch pendente.
3. Revise o Monaco Diff:
   - esquerda: conteudo antes.
   - direita: conteudo proposto.
4. Use `Copiar diff textual` se precisar compartilhar o diff.

## Como aplicar patch

1. Revise o diff visual.
2. Clique em `Aplicar patch`.
3. Se houver arquivo aberto com alteracoes manuais nao salvas, salve ou descarte antes.
4. O Nexus deve atualizar:
   - arquivo no disco.
   - editor aberto, quando aplicavel.
   - Explorer.
   - lista de patches.

## Como rodar typecheck/build

Pelo terminal controlado ou Patch Review:

```bash
npm run typecheck
npm run build
npm test
```

Na UI:

1. Abra o painel inferior.
2. Use `Terminal` ou os botoes de comando.
3. Em falha, use `Corrigir erro com IA` para abrir um fluxo com agente de debug.

## Como ver progresso dos agentes

1. Envie uma tarefa no `Nexus AI`.
2. Quando uma run iniciar, o painel `Output` abre automaticamente.
3. A timeline deve mostrar eventos como:
   - Agente iniciado.
   - Planejando solucao.
   - Analisando projeto.
   - Usando ferramenta.
   - Patch proposto.
   - Aguardando revisao.
   - Concluido ou falhou.

O progresso usa SSE em:

```text
GET /api/agents/runs/:runId/events/stream
```

## Validacao de release

Antes de publicar ou mergear:

```bash
npm test
npm run typecheck
npm run build
npm run ci
```

Todos devem passar.

## Limitacoes atuais

- O Nexus ainda roda como web app local em Node/Express.
- Electron IPC dedicado ainda nao faz parte da v1 MVP.
- SQLite ainda nao foi adotado; parte do estado usa JSON/JSONL.
- O Patch Review aplica mudancas somente apos aprovacao, mas o fluxo de merge/commit assistido ainda e inicial.
- O terminal e propositalmente controlado por whitelist de comandos.
- Providers premium podem gerar custo; use modo economico/Ollama quando possivel.
- Monaco e codicons ainda podem depender de CDN em desenvolvimento.
