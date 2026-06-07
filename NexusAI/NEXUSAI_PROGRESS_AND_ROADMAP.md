# NexusAI Progress and Roadmap

Atualizado em: 2026-05-29

## Objetivo Final

Transformar o NexusAI em um assistente local de programação capaz de:

- entender o projeto atual;
- lembrar preferências e decisões;
- gerar sites profissionais com preview;
- gerar apps desktop e APIs pequenas;
- propor alterações como patches revisáveis;
- medir a própria qualidade com testes;
- melhorar com treino, dataset e memória.

O objetivo realista não é competir com modelos gigantes. O objetivo é ter uma IA local especializada no fluxo do Nexus, com comportamento previsível e cada vez mais útil.

## Estado Atual

Status geral: protótipo avançado, ainda não pronto como assistente principal.

O modelo já treina, salva checkpoints, possui dataset fullstack, memória persistente e avaliação automática inicial. A geração ainda precisa melhorar antes de ser usada sem revisão.

## O Que Já Foi Feito

### 1. Base de treinamento

Concluído:

- Criado pipeline de treino local.
- Criado treino com checkpoint.
- Criado resume de checkpoint.
- Criado treino por tempo (`--max_minutes` e `--stop_at`).
- Corrigida a máscara causal no modelo, tornando o treino autorregressivo.
- Configurado modelo micro fullstack/instruct.
- Criado modo de treino controlado.

Arquivos principais:

- `model.py`
- `train.py`
- `config.micro-instruct-fullstack.json`
- `config.micro-instruct-fullstack.infinite.json`

Status: pronto para ciclos curtos de treino.

### 2. Dataset

Concluído:

- Criado corpus Python/backend.
- Adicionado corpus fullstack.
- Adicionados exemplos de HTML, CSS, JS, TypeScript, React, Electron e Flask.
- Adicionado currículo profissional com exemplos bons.
- Adicionados exemplos inovadores:
  - Code DNA
  - Fatigue Sensor
  - Code Archaeologist
- Corrigido o cleaner para evitar `.pyc`, `__pycache__`, `node_modules`, `dist`, `build` e lixo binário.

Arquivos principais:

- `dataset_cleaner.py`
- `instruction_dataset_builder.py`
- `fullstack_corpus_builder.py`
- `build_pro_quality_curriculum.py`
- `data/raw/user_lessons/pro_quality_curriculum`

Status: bom para protótipo, ainda pequeno para geração robusta.

### 3. Memória

Concluído:

- Criada memória SQLite em `memory/memory.db`.
- Criado armazenamento de fatos, preferências, projeto, regras de qualidade e interações.
- Criada busca por relevância simples.
- Integrada memória ao `infer.py`.
- Integrada opção `use_memory` ao Flask `/generate`.

Arquivos principais:

- `memory_store.py`
- `memory/memory.db`
- `infer.py`
- `app.py`

Status: funcional, mas ainda falta UI e gestão melhor de memórias.

### 4. Inferência

Concluído:

- Criado script `infer.py`.
- Corrigido bug em que a resposta repetia o prompt inteiro.
- Adicionado corte de marcadores de treino como `<sample>` e `</sample>`.
- Adicionada opção de desativar memória com `--no_memory`.

Status: pipeline funciona, mas a qualidade do modelo ainda é baixa.

### 5. Avaliação

Concluído:

- Criado avaliador automático de geração.
- Criado status do treino.
- Criado relatório pós-treino.
- Criada automação para revisar depois do treino.
- Criado benchmark fixo com 30 prompts em `benchmark_prompts.json`.
- Avaliador agora mede:
  - score total;
  - instruction following;
  - syntax score;
  - repetition score;
  - compile-like rate;
  - penalidades por eco, vazamento de marcador e mistura de linguagens.

Arquivos principais:

- `evaluate_generation_quality.py`
- `nexus_status.py`
- `post_train_report.py`
- `benchmark_prompts.json`

Status: avaliação inicial ficou mais completa. Baseline parcial em 5 casos antes do próximo ciclo premium: total_score 1, avg_instruction_following 0.0, compile_like_rate 0.2.

### 6. Geração de site e preview no Nexus

Concluído:

- Melhorado fallback de geração de site.
- Criado exemplo de site profissional de confeitaria.
- Criado asset visual `bakery-hero.webp`.
- Gerado patch pendente para `public/index.html`.
- Criado preview estático.

Status: preview existe no fluxo do Nexus, mas ainda não está totalmente integrado ao modelo treinado.

## Status Do Treino Atual

Treino atual:

- Config: `config.micro-instruct-fullstack.infinite.json`
- Log: `logs/train_1780065335.log`
- Deadline: `2026-05-29T13:05:35`
- Última loss observada: epoch 31, step 2340, loss 1.0749
- Último checkpoint best: `model_instruct_fullstack/nexus_model_best.pt`

Interpretação:

- A loss está caindo.
- O checkpoint está sendo atualizado.
- Ainda falta provar melhora na geração real.

## Problemas Atuais

### Problema 1: Loss baixa não garante geração boa

O modelo pode estar decorando padrões do dataset sem conseguir montar respostas completas.

Solução:

- Medir com `evaluate_generation_quality.py`.
- Comparar antes/depois de cada ciclo.
- Criar exemplos de instruction tuning melhores.

### Problema 2: Dataset ainda é pequeno

O corpus tem exemplos úteis, mas ainda é pequeno para ensinar geração fullstack estável.

Solução:

- Aumentar exemplos de sites completos.
- Aumentar exemplos de React/Electron.
- Adicionar pares de pedido/resposta.
- Adicionar exemplos negativos e positivos.

### Problema 3: Tokenizer não foi refeito depois do currículo

Para preservar o checkpoint, o tokenizer não foi retreinado. Isso é bom para continuidade, mas limita adaptação a vocabulário novo.

Solução:

- Manter checkpoint atual para ciclos curtos.
- Depois criar um experimento separado com tokenizer novo e treino do zero.

### Problema 4: Inferência ainda simples

A amostragem ainda pode gerar texto quebrado.

Solução:

- Ajustar temperatura/top-k.
- Adicionar stopping rules melhores.
- Criar templates por tipo de tarefa.
- Usar memória para guiar formato.

### Problema 5: Ainda falta integração completa com o produto Nexus

O modelo treina e gera, mas o fluxo produto ainda precisa ficar confortável.

Solução:

- Painel de status.
- Botão para rodar avaliação.
- Botão para usar memória.
- Preview de site gerado.
- Aprovação de patch.

## Plano A Partir De Agora

### Fase 1: Fechar o ciclo atual

Meta: saber se o treino atual melhorou geração real.

Passos:

1. Esperar o treino terminar.
2. Rodar `post_train_report.py`.
3. Comparar score pós-treino contra baseline.
4. Salvar resultado em memória.
5. Decidir se continua treino ou muda estratégia.

Critério de sucesso:

- Score total maior que 0.
- Pelo menos uma geração contendo estrutura real reconhecível.

Status: em andamento.

### Fase 2: Melhorar dataset de instrução

Meta: ensinar o modelo a responder pedidos, não só copiar arquivos.

Status em 2026-05-29:

- Iniciado.
- `instruction_dataset_builder.py` agora gera amostras em dois formatos:
  - `<sample><file ...>`
  - `### Instruction:` / `### Response:`
- Criado `build_instruction_pairs_premium.py`.
- Criados 6 pares premium iniciais:
  - site profissional para personal trainer;
  - API Flask com JWT;
  - base Electron segura;
  - componente React com busca;
  - correção de bug Python;
- resposta em formato patch.
- Criados exemplos negativos em `data/raw/user_lessons/negative_examples`.
- `instruction_dataset_builder.py` agora possui pesos por qualidade:
  - gold: 5x;
  - silver: 2x;
  - bronze: 1x.
- Corpus reconstruído com 234 arquivos e cerca de 1.16M tokens.
- Distribuição atual:
  - bronze: 207 arquivos;
  - silver: 20 arquivos;
  - gold: 7 arquivos.

Próximos passos:

1. Criar 30 a 50 pares `USER_REQUEST` -> `ASSISTANT_ANSWER`.
2. Cobrir:
   - site profissional;
   - dashboard SaaS;
   - API Flask;
   - app Electron;
   - componente React;
   - correção de bug;
   - explicação de erro;
   - patch pequeno.
3. Rebuild do dataset.
4. Treino curto.
5. Avaliação.

Critério de sucesso:

- Score total acima de 15.
- Geração deixa de misturar HTML, Python e TypeScript na mesma resposta.

Status: próximo.

### Fase 3: Melhorar inferência

Meta: reduzir saída quebrada.

Status em 2026-05-29:

- Iniciado.
- `infer.py` agora usa template:

```text
### Instruction:
{prompt}

### Response:
```

- `infer.py` agora retorna apenas os tokens novos, sem repetir o prompt.
- `infer.py` corta marcadores vazados como `<sample>`, `</sample>`, `</file>`, `### Instruction:` e `### Response:`.

Próximos passos:

1. Criar templates por modo:
   - `site`
   - `api`
   - `react`
   - `electron`
   - `patch`
2. Ajustar stop tokens.
3. Remover eco de contexto.
4. Pós-processar tags incompletas.
5. Criar presets de geração.

Critério de sucesso:

- Inferência curta gera estrutura mais estável.
- Avaliação melhora sem novo treino.

Status: parcialmente iniciado.

### Fase 4: Memória do produto

Meta: fazer a IA lembrar do usuário e do projeto.

Passos:

1. Criar comandos:
   - lembrar fato;
   - esquecer fato;
   - listar memórias;
   - buscar memórias.
2. Criar UI/painel.
3. Salvar resultados de avaliação na memória.
4. Salvar exemplos aprovados/rejeitados.

Critério de sucesso:

- O NexusAI usa preferências do usuário nas respostas.
- O usuário consegue ver e editar memórias.

Status: backend inicial pronto.

### Fase 5: Integração com o Nexus

Meta: usar o modelo treinado dentro do fluxo de criação de projetos.

Passos:

1. Conectar `/generate` ao agente do Nexus.
2. Permitir `use_memory`.
3. Criar preview automático para HTML.
4. Criar patch pendente revisável.
5. Rodar validação antes de aplicar.

Critério de sucesso:

- Usuário pede um site.
- IA gera patch.
- Preview abre.
- Usuário aprova.
- Arquivo entra no projeto.

Status: parcialmente pronto via fallback e patch review.

### Fase 6: Experimento maior

Meta: descobrir se vale treinar do zero com tokenizer novo.

Passos:

1. Congelar checkpoint atual.
2. Criar novo tokenizer com currículo final.
3. Treinar modelo do zero em paralelo.
4. Comparar:
   - loss;
   - score;
   - geração manual;
   - tamanho do checkpoint.

Critério de sucesso:

- Modelo novo passa o antigo no avaliador.

Status: futuro.

## Quanto Falta Para o Final

Estimativa honesta:

- Pipeline de treino: 80% pronto.
- Dataset inicial: 45% pronto.
- Memória: 50% pronta.
- Inferência: 35% pronta.
- Avaliação: 40% pronta.
- Integração com Nexus: 45% pronta.
- Qualidade real de geração: 20% pronta.

Progresso geral estimado: 45%.

## Definição De "Pronto"

O NexusAI pode ser considerado pronto para uso inicial quando:

1. Gera um HTML profissional simples sem quebrar tags.
2. Gera uma API Flask pequena com validação correta.
3. Gera um componente React coerente.
4. Gera um esqueleto Electron seguro.
5. Usa memória do projeto.
6. Cria patch revisável.
7. Abre preview quando gerar site.
8. Passa no avaliador com score mínimo definido.
9. Não repete o prompt.
10. Não vaza `<sample>` ou lixo de dataset.

Meta inicial sugerida:

- Score total mínimo: 25
- Nenhum vazamento de marcador de treino
- Pelo menos 2 de 3 testes com estrutura válida

## Próxima Ação Recomendada

Esperar o treino atual terminar e rodar:

```powershell
cd "C:\nexus ai\NexusAI"
python post_train_report.py --config config.micro-instruct-fullstack.infinite.json
```

Se o score continuar 0, a próxima ação não é treinar mais horas. A próxima ação é criar mais pares de instrução/resposta e melhorar templates de inferência.
