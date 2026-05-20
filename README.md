# root-3b3d8007

## Objetivo
Criar componente

Contexto atual da IDE:
Arquivo ativo: nenhum
Arquivo modificado: nao
Arquivos abertos: nenhum
Selecao atual: nenhuma

Conteudo atual do arquivo ativo:



Arvore resumida do projeto:
- .github
  - .github/workflows
    - .github/workflows/ci.yml
- .gitignore
- .tmp-tests
  - .tmp-tests/action-data
    - .tmp-tests/action-data/pending-actions.json
  - .tmp-tests/action-project
    - .tmp-tests/action-project/src
      - .tmp-tests/action-project/src/file.ts
  - .tmp-tests/patch-payload-project
    - .tmp-tests/patch-payload-project/src
  - .tmp-tests/patches-flow-data
    - .tmp-tests/patches-flow-data/pending-actions.json
  - .tmp-tests/patches-flow-project
    - .tmp-tests/patches-flow-project/src
  - .tmp-tests/project-file-store
    - .tmp-tests/project-file-store/docs
- docs
  - docs/agent-test.md
- electron
  - electron/main.ts
  - electron/preload.ts
- package-lock.json
- package.json
- public
  - public/ai-panel.js
  - public/app.js
  - public/devmind.js
  - public/editor.js
  - public/explorer.js
  - public/index.html
  - public/layout.js
  - public/patch-review.js
  - public/site-builder-draft.html
  - public/styles.css
  - public/terminal.js
- README.md
- scripts
  - scripts/desktop-build.mjs
  - scripts/desktop-dev.mjs
- src
  - src/action-executor.ts
  - src/action-planner.ts
  - src/action-types.ts
  - src/agents
    - src/agents/antygravit-agent.ts
    - src/agents/blackbox-agent.ts
    - src/agents/claude-agent.ts
    - src/agents/codex-agent.ts
    - src/agents/index.ts
    - src/agents/local-mock-agent.ts
    - src/agents/shared.ts
    - src/agents/types.ts
  - src/app
    - src/app/agents
      - src/app/agents/artifacts.ts
      - src/app/agents/history.ts
      - src/app/agents/models.ts
      - src/app/agents/registry.ts
      - src/app/agents/runner.ts
      - src/app/agents/tools.ts
      - src/app/agents/utils.ts
    - src/app/ai
      - src/app/ai/ai-settings.ts
      - src/app/ai/context-builder.ts
      - src/app/ai/provider-router.ts
      - src/app/ai/providers
        - src/app/ai/providers/anthropic-provider.ts
        - src/app/ai/providers/gemini-provider.ts
        - src/app/ai/providers/groq-openrouter-provider.ts
        - src/app/ai/providers/ollama-provider.ts
        - src/app/ai/providers/openai-provider.ts
        - src/app/ai/providers/types.ts
      - src/app/ai/usage-tracker.ts
    - src/app/runs
      - src/app/runs/run-store.ts
    - src/app/web
      - src/app/web/server.ts
      - src/app/web/staged-files.ts

## Visao rapida
- Projeto analisado em `C:\nexus ai`
- Agente: UI Agent
- Ferramenta de docs do Nexus gerou este rascunho revisavel

## Estrutura principal
- .github/workflows/ci.yml
- .gitignore
- .tmp-tests/action-data/pending-actions.json
- .tmp-tests/action-project/src/file.ts
- .tmp-tests/patches-flow-data/pending-actions.json
- docs/agent-test.md
- electron/main.ts
- electron/preload.ts
- package-lock.json
- package.json
- public/ai-panel.js
- public/app.js
- public/devmind.js
- public/editor.js
- public/explorer.js
- public/index.html
- public/layout.js
- public/patch-review.js

## Scripts ou metadados detectados
```json
{
  "name": "nexus-ai-mvp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:smoke": "node -e \"console.log('No smoke tests configured yet.')\"",
    "ci": "npm run typecheck && npm run build && npm test",
    "start": "node dist/server.js",
    "build": "tsc -p tsconfig.json",
    "desktop:dev": "node scripts/desktop-dev.mjs",
    "desktop:build": "node scripts/desktop-build.mjs"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.57.0",
    "cors": "^2.8.5",
    "express": "^5.1.0",
    "express-rate-limit": "^8.5.2"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.3",
    "@types/node": "^24.10.1",
    "@types/supertest": "^7.2.0",
    "supertest": "^7.2.2",
    "tsx": "^4.20.6",
    "typescript": "^5.9.3",
    "vitest": "^4.1.6"
  }
}

```

## Como contribuir
1. Revise o Patch Review antes de aplicar mudancas.
2. Rode build e testes pelos comandos controlados.
3. Atualize esta documentacao junto com o comportamento do sistema.

## Limites atuais
- O draft foi gerado por heuristica local.
- Ajustes de tom e detalhes tecnicos devem ser revisados antes de aplicar.
