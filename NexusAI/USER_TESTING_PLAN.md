# NexusAI User Testing Plan

Objetivo: medir se o NexusAI resolve tarefas reais, nao se ele apenas gera respostas bonitas.

## Metrica Principal

- Tarefa resolvida sem intervencao humana: `resolved`
- Tarefa resolvida com pequena correcao: `assisted`
- Tarefa falhou: `failed`

Meta inicial:

- 50 tarefas reais
- sucesso sem intervencao >= 50%
- sucesso assistido >= 75%
- falhas reais <= 25%

## Como Rodar

1. Escolha 5 projetos pequenos reais.
2. Rode 10 tarefas em cada projeto.
3. Para cada tarefa, registre:
   - prompt;
   - arquivos lidos;
   - resposta;
   - patch;
   - teste;
   - resultado final.
4. Classifique como `resolved`, `assisted` ou `failed`.
5. Corrija as melhores falhas e exporte para gold examples.

## Comandos Uteis

```powershell
python task_metrics.py summary
python failure_ranking.py --limit 5
python nexus_commands.py "CAMINHO_DO_PROJETO" "/analyze-project"
python nexus_commands.py "CAMINHO_DO_PROJETO" "/run-tests"
python nexus_commands.py "CAMINHO_DO_PROJETO" "/generate-docs"
```

## Top Falhas Esperadas

- codigo incompleto;
- arquivo errado selecionado;
- dependencia adicionada sem necessidade;
- teste ignorado;
- resposta fora do formato pedido.
