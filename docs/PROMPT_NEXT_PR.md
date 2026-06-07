# Prompt do Próximo PR — Preview e API Boundary

```text
Vamos implementar o próximo PR do Nexus IA focado em segurança de preview e fronteira de API local.

Contexto:
O Nexus IA é uma IDE web local em Node/TypeScript com Express em src/server.ts e frontend estático em public/.
Ele já tem Monaco, Explorer, Patch Review, SSE, activeProject em workspace/, token local e rate limit.

Problema crítico:
O preview de HTML do projeto é servido na mesma origem do Nexus em /preview/project/* e /preview/staged/*.
Se um HTML malicioso for aberto em popout ou diretamente, ele pode executar JavaScript em http://localhost:4000, chamar /api/health, obter token local e acessar APIs do Nexus.

Objetivo do PR:
Endurecer o boundary local:
- preview não pode ter acesso às APIs do Nexus;
- GETs de projeto/workspace devem exigir token;
- servidor deve bindar em localhost por padrão;
- app deve continuar funcionando.

Branch:
codex/fix-preview-api-boundary

Título:
fix: harden local preview and API boundary

Escopo obrigatório:

1. Bind local
- Atualizar src/server.ts para usar HOST=127.0.0.1 por padrão.
- Permitir override via process.env.HOST.
- Logar URL correta.

2. Proteger GETs sensíveis
- Atualizar src/local-security.ts.
- Incluir em SENSITIVE_GETS:
  - /^\/api\/project(?:\/.*)?$/
  - /^\/api\/workspace(?:\/.*)?$/
- Garantir que GET /api/project/file sem token seja bloqueado.
- Garantir que GET /api/project/tree sem token seja bloqueado.
- Garantir que GET /api/workspace/file sem token seja bloqueado.

3. Token local
- Não expor token em endpoint público acessível por preview same-origin.
- Se o frontend precisar do token, manter bootstrap seguro apenas para a UI principal.
- Não permitir que preview obtenha token.
- Não quebrar public/app.js.

4. Preview seguro
- Adicionar CSP sandbox nos responses:
  - GET /preview/project/*
  - GET /preview/staged/:runId/index.html
- Não usar allow-same-origin.
- Bloquear connect-src para impedir chamadas às APIs Nexus.
- Preferir iframe sandbox.
- Ajustar public/preview.js para evitar popout inseguro de HTML same-origin.
- Se popout continuar existindo, ele deve abrir versão sandboxada ou avisar que popout seguro ainda não está disponível.

5. Testes
Criar/ajustar testes:
- GET /api/project/file sem token retorna 401 ou 403.
- GET /api/project/tree sem token retorna 401 ou 403.
- GET /api/project/file com token funciona.
- /preview/project/index.html inclui Content-Security-Policy com sandbox.
- /preview/staged/:runId/index.html inclui Content-Security-Policy com sandbox.
- preview response não inclui token local.
- servidor usa 127.0.0.1 como host padrão se possível testar sem abrir porta real.

6. Não mudar escopo
Não implementar SQLite.
Não implementar Electron IPC.
Não reescrever Patch Review.
Não adicionar features novas.
Não mexer no motor de agentes, exceto se necessário para teste.

7. Validação
Rodar:
cmd /c npm test
cmd /c npm run typecheck
cmd /c npm run build
cmd /c npm run ci

8. Commit
Commit:
fix: harden local preview and API boundary

Resultado esperado:
O Nexus continua funcionando como IDE local, mas HTML de preview não consegue acessar APIs internas nem token local.
```
