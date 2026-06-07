# Ações de IA por Seleção no Monaco Editor

## Resumo das Mudanças

Este PR adiciona ações rápidas de IA para trechos selecionados no Monaco Editor, permitindo explicar, refatorar, corrigir e gerar testes a partir da seleção atual, mantendo o fluxo seguro de Patch Review antes de qualquer aplicação.

## Arquivos Criados/Modificados

### Criados:

1. **public/editor-selection-actions.js** - Módulo principal com toda a lógica de ações de seleção
   - Função `getEditorSelectionContext()` para capturar contexto de seleção
   - Menu de ações rápidas (barra com 7 tipos de ações)
   - Geração automática de prompts estruturados para cada ação
   - Validações de segurança (arquivos sensíveis, conteúdo dirty)
   - Truncamento inteligente de conteúdo

2. **tests/editor-selection-actions.test.ts** - Suite de testes com 18 testes
   - Testes de captura de contexto
   - Testes de tipos de ação
   - Testes de geração de prompts
   - Testes de segurança
   - Testes de truncamento

### Modificados:

1. **public/index.html**
   - Adicionado `<script src="/editor-selection-actions.js"></script>` após editor.js

2. **public/styles.css**
   - Adicionado CSS para `.editor-selection-bar` e `.editor-selection-action-btn`

3. **public/app.js**
   - Adicionada inicialização de `EditorSelectionActions.init()` na função `initApp()`

4. **src/server.ts**
   - Corrigidos erros de sintaxe pré-existentes (catch faltando, código solto)
   - Refatorado `/api/project/run-command`
   - Criado `/api/smart-orchestrate`
   - Criada função `validateAnthropicModel()`

## Recursos Implementados

### 1. Detecção de Seleção

- `getEditorSelectionContext()` retorna:
  - Caminho do arquivo
  - Linguagem detectada
  - Texto selecionado (truncado em 4KB)
  - Linhas inicial e final
  - Conteúdo completo (truncado em 8KB)
  - Status de modificação do arquivo

### 2. Menu de Ações

Sete ações disponíveis:

- **Explicar seleção** - Explicação textual (não requer salvar)
- **Refatorar seleção** - Gera patch (requer salvar)
- **Corrigir seleção** - Gera patch (requer salvar)
- **Gerar testes** - Gera arquivo de teste (requer salvar)
- **Transformar em função** - Extrai função (requer salvar)
- **Otimizar performance** - Gera patch (requer salvar)
- **Revisar segurança** - Gera patch (requer salvar)

### 3. Segurança

- Bloqueio de arquivos sensíveis (.env, secrets, api-keys)
- Bloqueio de ações com patch em arquivos dirty (não salvos)
- Ação "Explicar" permitida mesmo em arquivos dirty
- Detecção de padrões sensíveis no conteúdo

### 4. Integração com IA

- Prompts estruturados incluem:
  - Caminho do arquivo
  - Linhas da seleção
  - Linguagem
  - Contexto completo do arquivo
  - Instruções específicas por ação
- Envio via `/api/code-chat` com contexto de seleção
- Abertura automática do painel Nexus AI
- Suporte a SSE para progresso em tempo real

### 5. UX

- Barra flutuante no editor quando há seleção
- Botões com ícones visuais
- Tooltip descritivo para cada ação
- Status de "Enviando para IA..." após clicar
- Bloqueio visual de ações indisponíveis

## Testes

- 18 testes implementados, todos passando
- Cobertura: contexto, ações, prompts, segurança, truncamento, validação

## Critérios de Aceite ✅

- ✅ Usuário seleciona código no Monaco
- ✅ Botões de ação aparecem
- ✅ "Explicar seleção" envia contexto para IA
- ✅ "Refatorar seleção" envia pedido para gerar patch
- ✅ "Corrigir seleção" envia pedido para gerar patch
- ✅ "Gerar testes" envia pedido com contexto correto
- ✅ Painel Nexus AI abre automaticamente
- ✅ Progresso aparece se houver run_id
- ✅ Patch aparece no Patch Review se gerado
- ✅ Nada é aplicado automaticamente
- ✅ Testes implementados
