# Relat?rio Completo do Projeto Nexus

Gerado em: 2026-06-05 20:09:48

## Escopo

Este relat?rio cobre o workspace `C:\nexus ai` e exclui pastas geradas/pesadas como `node_modules`, `dist`, checkpoints de modelo, logs, caches e datasets grandes. Essas pastas existem, mas n?o entram no invent?rio funcional para manter o relat?rio audit?vel.

## Resumo Executivo

O projeto tem tr?s blocos principais:

- **Nexus IDE / SaaS local**: aplica??o Node/TypeScript com Express, frontend est?tico, agentes, patches, comandos, preview, seguran?a local e testes.
- **NexusAI local**: laborat?rio Python para treinar, avaliar e servir um modelo local pequeno, com repo mode, m?tricas, replay, strict mode e benchmarks.
- **LLM training experimental**: scripts separados para dataset, nanoGPT, SFT/DPO e avalia??o.

## Contagem

- Arquivos inventariados: `525`
- Arquivos de c?digo analisados para fun??es/classes: `205`
- Fun??es/classes/m?todos encontrados: `1308`

## Pastas Principais

- `(raiz)`: 9 arquivo(s) inventariado(s)
- `.github/`: 1 arquivo(s) inventariado(s)
- `NexusAI/`: 138 arquivo(s) inventariado(s)
- `claude ia/`: 4 arquivo(s) inventariado(s)
- `data/`: 259 arquivo(s) inventariado(s)
- `docs/`: 4 arquivo(s) inventariado(s)
- `electron/`: 2 arquivo(s) inventariado(s)
- `frontend/`: 14 arquivo(s) inventariado(s)
- `llm-training/`: 42 arquivo(s) inventariado(s)
- `public/`: 32 arquivo(s) inventariado(s)
- `scripts/`: 4 arquivo(s) inventariado(s)
- `src/`: 131 arquivo(s) inventariado(s)
- `tests/`: 38 arquivo(s) inventariado(s)
- `workspace/`: 9 arquivo(s) inventariado(s)

## Arquivos Existentes e Fun??o de Cada Arquivo

### `.eslintrc.cjs`
- Tamanho: `407` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.

### `.github/workflows/ci.yml`
- Tamanho: `764` bytes
- Papel: Arquivo de configura??o.

### `claude ia/biome.json`
- Tamanho: `1056` bytes
- Papel: Arquivo de configura??o.

### `claude ia/ci.yml`
- Tamanho: `1413` bytes
- Papel: Arquivo de configura??o.

### `claude ia/tsconfig.electron.json`
- Tamanho: `436` bytes
- Papel: Arquivo de configura??o.

### `claude ia/tsconfig.json`
- Tamanho: `437` bytes
- Papel: Arquivo de configura??o.

### `data/ai-edit-history.json`
- Tamanho: `2351` bytes
- Papel: Arquivo de configura??o.

### `data/ai-settings.json`
- Tamanho: `821` bytes
- Papel: Arquivo de configura??o.

### `data/pending-actions.json`
- Tamanho: `295449` bytes
- Papel: Arquivo de configura??o.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/01cbaada-a738-4acd-9d97-d3c7c172ac86-9366406b-3e32-4033-b5e3-85a7795e10eb-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/01cbaada-a738-4acd-9d97-d3c7c172ac86-a45c40e8-edce-43c1-b6da-ed0bf141caa3-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/01e36277-210b-43f9-9bf8-c4e68fee84bc-336eadc8-b63d-4f43-93b7-be291b98a77f-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/01e36277-210b-43f9-9bf8-c4e68fee84bc-dc9f53ce-0edf-4604-ab9c-ec7a99b54d6a-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/02019632-f925-4756-a6b0-d18595245616-2371e749-d136-48ca-86f2-54e901ab819c-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/02019632-f925-4756-a6b0-d18595245616-42caf644-d008-43ab-9e22-bcb9105c3c93-plan.md`
- Tamanho: `548` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/03bfcde7-bbcc-4f76-8848-ae9a512d5def-69566ba6-8352-4220-96d8-b1b080ff40f3-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/03bfcde7-bbcc-4f76-8848-ae9a512d5def-9e8cdef7-1ef0-4d5f-8173-e62894ac0cc6-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/0e626f6a-388c-440a-8ad7-af078161de25-6fa7a413-da10-4c8c-a62b-a00356ad1b5b-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/0e626f6a-388c-440a-8ad7-af078161de25-7a2d9b91-5207-4b38-a6c6-d83e021be0c9-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/0f93ff64-a3af-498b-ac7e-e51d83a5d68a-74bb6163-5409-4e4e-a227-9d66356737b0-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/0f93ff64-a3af-498b-ac7e-e51d83a5d68a-ce5cc7b8-4e7a-4eb1-9d0c-8c22188d600a-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/29b1df20-fcfa-444c-8e28-ca6488ece8ee-3af849f2-fd3f-4af0-98ba-51b39d9365e1-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/29b1df20-fcfa-444c-8e28-ca6488ece8ee-76a05a03-ba70-413c-97fc-3a1389ab6634-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/31ddad06-441e-4a55-af24-14309b30985d-183fd67a-b14c-44c9-986e-c0deec6ac0e2-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/31ddad06-441e-4a55-af24-14309b30985d-8d1075ba-77ab-47f0-825f-db008925cfc0-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/32517e3a-d7e7-48cb-b2af-bc682b7e6af9-1616eddf-d8b7-406b-af4f-a5591e510d3e-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/32517e3a-d7e7-48cb-b2af-bc682b7e6af9-3ab4a5f8-8a53-4ae5-bb39-739bb31d7093-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/3964bb2a-b50b-45a1-85ba-929d9f0c0b37-bba1b4d5-f90c-4360-9cd8-bfd8becc8ef3-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/3964bb2a-b50b-45a1-85ba-929d9f0c0b37-be9bd5b7-aca2-401e-b1f3-607066fd3eb3-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/3a820e4a-a9cd-40fb-b954-90034e428614-93af4b8e-d752-4b47-9071-298edec48524-plan.md`
- Tamanho: `548` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/3a820e4a-a9cd-40fb-b954-90034e428614-97bfb403-bba0-4ba0-a3e2-b1b4a6cf0b6b-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/3e8b08a3-c923-4734-950e-47d0dc2eca0b-17b7c806-1c30-4c3c-9c0c-a2dc0538443e-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/3e8b08a3-c923-4734-950e-47d0dc2eca0b-e098fd84-55d6-4d60-bb67-1fecfa627c63-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/4568a0d8-c137-4d4c-84d8-4cdbc49c009c-5bfc4e56-6a57-4d8e-b471-59383da817e8-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/4568a0d8-c137-4d4c-84d8-4cdbc49c009c-93914f8b-7493-49dd-b8e5-c710c1cdcc35-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/46feea53-dbb0-4515-bf88-db83047c3408-6d59da87-ba15-4165-bc65-d0adb409b31b-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/46feea53-dbb0-4515-bf88-db83047c3408-8af272a1-d9ab-4a38-9e19-edaf09dda143-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/4904f7ac-1157-45e8-b7ca-75ca9e67c837-15247ef7-6ed3-4346-bbcf-bab5b058ef0b-plan.md`
- Tamanho: `548` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/4904f7ac-1157-45e8-b7ca-75ca9e67c837-1c63fc02-f6fa-43a7-937b-08dce06cc73c-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/49dd60bf-4fee-4ec9-9046-a35668e1a2de-76ee004d-a46a-49d0-b3e5-12e91e0edb02-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/49dd60bf-4fee-4ec9-9046-a35668e1a2de-a2e00ed5-9c2e-4cf1-86f8-9557e0b0c102-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/53709a6d-165e-4189-a04f-e9d52a028938-4d3b3d9b-ea44-448d-a25b-6e2a04753f0c-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/53709a6d-165e-4189-a04f-e9d52a028938-ac259ab5-d65c-4b49-a0f5-b1566dfb851e-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/579422aa-02b5-4da5-967a-d08b6d19b09d-15134f56-11b1-4b63-a57e-26d70bec02d7-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/579422aa-02b5-4da5-967a-d08b6d19b09d-90c0d3f8-c81a-451c-b09f-ba893b6e5d30-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/59e88e19-0bcb-4793-b454-637d9fbe8423-07871cbb-5763-42b9-9d25-6486a78f921c-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/59e88e19-0bcb-4793-b454-637d9fbe8423-3bc1cebd-eb9b-4d15-823d-a782fd0217f4-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/5aedd6c2-40f0-4247-8258-7c6f4f364355-99f8ecca-fe06-4e83-a5a3-78a64e58d9dd-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/5aedd6c2-40f0-4247-8258-7c6f4f364355-d6f84baf-52d2-4390-8274-e17685aa7f1d-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/5e158aa7-e880-4e49-a400-035398598bc7-f8fc519a-6a0a-4f23-9b4c-09c223b5ea4a-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/5e158aa7-e880-4e49-a400-035398598bc7-f93a1be6-8102-4365-8648-8e9ba85e14bd-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/6081dd33-8c0a-4a4d-82f3-beb49f056a35-b0b5cee6-a689-4673-898e-8786edde66cf-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/6081dd33-8c0a-4a4d-82f3-beb49f056a35-bf79156b-75cc-4997-81e9-5d2ceb00f29e-plan.md`
- Tamanho: `548` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/64ac96c1-2754-4a34-b407-20f78ea57edf-804d7783-ca69-45ed-8b43-3f2b8ca0e7ef-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/64ac96c1-2754-4a34-b407-20f78ea57edf-b0d83f9a-2679-441a-acbb-2862680f6414-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/6594d06e-df82-4f8b-98d6-020a87d5f43b-2f29307f-5e58-4ec2-8a9c-cf42c3787843-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/6594d06e-df82-4f8b-98d6-020a87d5f43b-79bf1a9a-f7af-43e7-8138-031e829cd100-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/6d801b54-244c-48ef-89b8-1b9c643ae1d4-3fe73b70-f164-480f-8f94-4a07e2e53ef4-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/6d801b54-244c-48ef-89b8-1b9c643ae1d4-ae295329-2f31-4972-95f8-633054d38a73-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/7859ad56-6cd7-40f5-8703-bcb4a64c081a-71f33685-13f4-4dea-ac8c-b514175b793e-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/7859ad56-6cd7-40f5-8703-bcb4a64c081a-f1335f63-9609-4562-a37b-f0122439d08b-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/89577271-e1e2-402b-957d-302ce06c7019-3ab60306-448c-48c1-94dd-9926ee7e9d27-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/89577271-e1e2-402b-957d-302ce06c7019-a0c2f887-8f7e-42ff-9008-790fdcab6eef-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/8a91af60-0590-49c5-aa12-1d2d9ee67434-0afb8157-57eb-4739-a183-f2ab9195988f-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/8a91af60-0590-49c5-aa12-1d2d9ee67434-e2135aab-b21f-4556-906d-94ada3eb7cc4-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/8b0d9633-2ea0-4514-a023-c183f56af930-644c13f0-74fb-4377-b07a-b08b3a05f06e-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/8b0d9633-2ea0-4514-a023-c183f56af930-a2ee6746-6636-4630-a8ff-fbb9d065d2c8-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/8be85cc1-1f69-4a94-ab95-031323287f01-5486aceb-1c8e-4e22-a33a-8485058b6e3a-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/8be85cc1-1f69-4a94-ab95-031323287f01-ae75fbaa-8314-4f04-8a77-16da013fb95f-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/8cd05391-ada2-4df2-aca7-6aa0e9c56236-79e3a41c-9337-45d7-84de-3a833aafb581-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/8cd05391-ada2-4df2-aca7-6aa0e9c56236-be68b3a6-110c-41c0-9911-53dbc2e99d80-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/8d38ca57-2822-4d56-bdc8-7f877680ec74-6d717277-c035-4b75-846a-675ffa5cf487-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/8d38ca57-2822-4d56-bdc8-7f877680ec74-f5eb1aae-3d3e-4930-a1c2-79426ff4706b-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/94bacd43-811f-4ed3-b06f-6ad1816059fc-49704b10-7df9-4ffd-96ff-bc102b4cb301-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/94bacd43-811f-4ed3-b06f-6ad1816059fc-58906a1b-e7b5-41e6-9db6-4f9c58c7daa7-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/9561b37d-07a2-4cc8-bf43-552b4722767f-30288719-c7d0-4955-ac37-e4e71f2fffb0-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/9561b37d-07a2-4cc8-bf43-552b4722767f-fe3bc138-cbc1-4715-ac2c-c3bfb05509aa-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/9f9bcaf4-94b7-4fca-bebf-bc29db3d10b3-18f355cc-4960-436f-98a1-e3b614e03f02-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/9f9bcaf4-94b7-4fca-bebf-bc29db3d10b3-68be13ef-3f42-4859-9ec6-26f64d813b4e-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/a22a623b-fc43-4e78-bb08-fb94a49aae23-16194663-6683-4787-abff-6f45515cd47c-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/a22a623b-fc43-4e78-bb08-fb94a49aae23-4108f529-3376-4dda-bd74-57de0cd02396-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/a48d21f0-b3bc-4e32-a116-47c552902561-a94e7bb2-dddd-4bdb-9f19-1cc29bab2be0-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/a48d21f0-b3bc-4e32-a116-47c552902561-d2919626-de17-4f41-b224-db97a4ca46b5-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/b0af4286-4164-4c4e-a2aa-a50323b4d0b7-c0285380-6f3b-4863-8549-177827ed52de-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/b0af4286-4164-4c4e-a2aa-a50323b4d0b7-f213e20f-015a-451f-85c4-3c8ce563273f-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/bcc6034b-2613-4c9f-9ec4-6a4c852cf860-72a18631-f048-400e-9d2f-62f960513a83-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/bcc6034b-2613-4c9f-9ec4-6a4c852cf860-7aa16db9-f716-4eed-b068-d967c0735227-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/bd85cda9-68dd-4d56-9a1d-d29702d8ff7a-b77d3861-918e-4fd6-a54d-9e13b50fe21e-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/bd85cda9-68dd-4d56-9a1d-d29702d8ff7a-c8baba62-a02a-4246-83e3-3992a003187a-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/c428f498-c02f-4960-8a06-61844b9e1157-0319be82-0fcd-4eee-a294-6a4a8f5ffcde-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/c428f498-c02f-4960-8a06-61844b9e1157-70bdaa91-229c-4e1c-bbbc-ef33713c96a4-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/c47ea9a7-0ac2-4dc2-91b7-8e5be146d170-673b29d8-b9ed-4941-9f4c-92a983d27b6c-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/c47ea9a7-0ac2-4dc2-91b7-8e5be146d170-8287cd52-a86a-4342-b6c1-eadab09cff56-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/c878d8ba-25ab-4391-bbae-1c84e2b712e3-9ab7ef68-79c6-4448-98e1-d621d7344192-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/c878d8ba-25ab-4391-bbae-1c84e2b712e3-a54700db-87c9-4e16-99d2-4eb779295e18-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/cd047e1b-e57a-4f81-94e1-257843edd42b-2a4a8482-7166-4f4e-8826-5ce2195bb4b6-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/cd047e1b-e57a-4f81-94e1-257843edd42b-968116e6-26cc-4502-b92e-4cd2aa465d3d-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/cfcdc362-c679-45be-9561-2e3b3275587d-99c572a3-aea2-4f11-a805-5818d94248ea-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/cfcdc362-c679-45be-9561-2e3b3275587d-c95720b2-630d-4192-a381-ac1cb5bda2e0-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/e6575e39-25c0-496a-ba0a-0dd39e47a551-58df8c7e-94f8-4d26-b655-f8eac2035bb1-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/e6575e39-25c0-496a-ba0a-0dd39e47a551-91175061-d31c-4c1e-b268-fccd247b79b0-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/f1f5b62e-7e53-4c8c-97f3-a6cbd0ffc24f-7665276f-9e0c-438c-a227-3994d9cb759b-plan.md`
- Tamanho: `1571` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/f1f5b62e-7e53-4c8c-97f3-a6cbd0ffc24f-f27a1bb2-3a6c-46ab-a6a5-7f1c12b05448-summary.md`
- Tamanho: `15` bytes
- Papel: Documenta??o do projeto.

### `data/projects/-tmp-tests__agent-events-sse-project-5615ddbd/artifacts/index.json`
- Tamanho: `179375` bytes
- Papel: Arquivo de configura??o.

### `data/projects/root-3b3d8007/artifacts/054cb245-71a1-4e18-b372-8877c4a9de4f-6896044f-2f8b-4b79-a5e5-255367e65d29-plan.md`
- Tamanho: `4299` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/054cb245-71a1-4e18-b372-8877c4a9de4f-d100dbb2-b011-4d3b-b77a-080001879422-summary.md`
- Tamanho: `3634` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/07232a60-f7e8-4fcf-a650-ecb01aeb5247-13cbaf7e-4825-4977-87f5-d4323e7d46b3-plan.md`
- Tamanho: `657` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/07232a60-f7e8-4fcf-a650-ecb01aeb5247-a2adbf33-84b1-4d8f-ad79-54c71367c90c-summary.md`
- Tamanho: `1407` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/09b89cda-4f29-448e-9d15-afb6dcd73171-46b60152-b69a-4577-a65e-abef25b70433-readme_draft.md`
- Tamanho: `4952` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/09b89cda-4f29-448e-9d15-afb6dcd73171-ae6576c0-f466-41b1-8b56-61273df0057b-summary.md`
- Tamanho: `3489` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/09b89cda-4f29-448e-9d15-afb6dcd73171-ef4f0c16-2ef4-42e9-8def-9cb55f44a7bd-plan.md`
- Tamanho: `7108` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/0d97f1bd-9e17-466a-8fdf-ce86c2b9531f-2c05c3eb-40d0-401e-a331-eeacb7ca6e28-plan.md`
- Tamanho: `1472` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/0d97f1bd-9e17-466a-8fdf-ce86c2b9531f-703f6f80-1262-4b75-a7f3-ed0c430d6b24-summary.md`
- Tamanho: `2007` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/0dd4de00-a92c-464e-8b68-53699c95d381-1ce37f08-004b-4d0f-9583-163e96420a61-summary.md`
- Tamanho: `2799` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/0dd4de00-a92c-464e-8b68-53699c95d381-a508f2cd-a714-4344-be93-aa600974f79e-plan.md`
- Tamanho: `4630` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/0f58e57a-4ca6-420d-93bc-0b6a711a66d5-ac628ae6-76ba-4617-8fa8-ebd8b17ae393-plan.md`
- Tamanho: `4246` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/0f58e57a-4ca6-420d-93bc-0b6a711a66d5-b93de374-c9ec-4ffd-a401-426d3f7fc5b9-summary.md`
- Tamanho: `3418` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/0f58e57a-4ca6-420d-93bc-0b6a711a66d5-f5d883ec-acee-4865-8d45-71dd2ab4f5e4-readme_draft.md`
- Tamanho: `4618` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/1f475ebd-a493-4971-9649-b0a28ef28e04-7127c505-f2ad-4876-b6a5-3a7419162522-summary.md`
- Tamanho: `2007` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/1f475ebd-a493-4971-9649-b0a28ef28e04-9a863ab1-9bf6-4574-b241-cfc12146c32b-plan.md`
- Tamanho: `1294` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/21fab63b-d642-4594-8e59-43a9667ea59a-947ab551-addf-4fdb-8adc-352bc64b9f91-summary.md`
- Tamanho: `1464` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/21fab63b-d642-4594-8e59-43a9667ea59a-e6448ff7-eccf-44a5-ac67-67cf8ccb066a-plan.md`
- Tamanho: `1465` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/22adc7d1-2382-4444-8057-f21c7b30f020-1da5bcb8-44c3-4afe-b5c2-78ded1af663f-summary.md`
- Tamanho: `2799` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/22adc7d1-2382-4444-8057-f21c7b30f020-9b130c92-44bf-4d3b-a069-b8058c17251a-plan.md`
- Tamanho: `4262` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/22adc7d1-2382-4444-8057-f21c7b30f020-af16d15b-2ac8-4423-8ac9-13329529f10e-readme_draft.md`
- Tamanho: `4517` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/33b38682-98d8-47f6-8b4d-b621d923ad5b-a71f0c64-9570-4ec2-9816-8a87dbbf39c2-summary.md`
- Tamanho: `3670` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/33b38682-98d8-47f6-8b4d-b621d923ad5b-d20c775e-729d-442a-8bfa-170b0608d5a6-plan.md`
- Tamanho: `4769` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/35bb76e3-7bb4-44a6-83e8-19f3986de2f1-1567098b-2307-4b5d-af68-d5fbf9b60b0f-plan.md`
- Tamanho: `4537` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/35bb76e3-7bb4-44a6-83e8-19f3986de2f1-b8d092b3-8c4e-47f7-8b86-f843baa116af-summary.md`
- Tamanho: `3670` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/365d1048-be4d-4663-99ea-5d2a3b3caadf-8678214f-0f7a-4273-8038-df908a91a6c2-summary.md`
- Tamanho: `2007` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/365d1048-be4d-4663-99ea-5d2a3b3caadf-8f702332-3976-4ea9-95b2-3e3cc77d831f-plan.md`
- Tamanho: `4373` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/365d1048-be4d-4663-99ea-5d2a3b3caadf-d7356863-b49b-4070-a02f-653c5e89e3d5-readme_draft.md`
- Tamanho: `4324` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/36d0952d-592b-4e7c-a4e2-c281bc903615-4a2aa4f8-dc4d-4b50-b203-a54d8b2c2e10-plan.md`
- Tamanho: `1470` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/36d0952d-592b-4e7c-a4e2-c281bc903615-59e31f80-e9f9-40e2-968c-29021bb95e4f-summary.md`
- Tamanho: `1971` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/38494d38-1ceb-4321-a248-ab213bfa0e29-2203933b-4737-4d5f-89fd-46f2b27427e7-plan.md`
- Tamanho: `1595` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/38494d38-1ceb-4321-a248-ab213bfa0e29-a4d0f69d-2766-49be-a8fb-c853cd7d23d9-summary.md`
- Tamanho: `1464` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/399ec37c-3f2b-4976-9736-6d6e4777bd05-64802105-f2cd-4179-9f22-09b1ef366f14-plan.md`
- Tamanho: `4298` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/399ec37c-3f2b-4976-9736-6d6e4777bd05-d4535d21-6794-4257-a4ae-20ac8237291b-summary.md`
- Tamanho: `2799` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/3dcf2ea0-e86d-405e-9aab-a8c87b4f730c-48f60894-c625-4bd4-8c63-5236abf5ca89-summary.md`
- Tamanho: `1758` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/3dcf2ea0-e86d-405e-9aab-a8c87b4f730c-7b8303da-2c00-40f7-8e9d-7d7d76aaf387-plan.md`
- Tamanho: `1320` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/3dcf2ea0-e86d-405e-9aab-a8c87b4f730c-960bd304-a30e-42d3-ac71-5a6f93985951-summary.md`
- Tamanho: `474` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/4157295d-7d00-4efa-98ae-0a09a24f3248-ab670ebd-c6ff-4ca9-bc13-beb1cecbf37e-summary.md`
- Tamanho: `1376` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/4157295d-7d00-4efa-98ae-0a09a24f3248-ece56e4c-8965-4e60-a30b-816c0e743761-plan.md`
- Tamanho: `514` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/43486fcb-812d-440b-b03d-c451ff449014-49cf43cc-d56f-435b-ae09-0398f068f2fc-plan.md`
- Tamanho: `1390` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/43486fcb-812d-440b-b03d-c451ff449014-bebef49d-050a-4a9b-8fb3-ec761afa6c34-summary.md`
- Tamanho: `1758` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/4372e4d3-d195-485d-80ed-781388dc3e89-0ff1d8fd-8d45-4a1e-a6fe-a5abbc91a2ac-plan.md`
- Tamanho: `3720` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/4372e4d3-d195-485d-80ed-781388dc3e89-91067e77-8bcf-425a-862c-3a10f62e5f0a-summary.md`
- Tamanho: `2007` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/4372e4d3-d195-485d-80ed-781388dc3e89-e769e2f4-1bfc-4b71-8de7-2380bac0c419-readme_draft.md`
- Tamanho: `3921` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/46fa72ff-0b92-476c-aa69-224074fb1931-b406e78a-4b55-41b0-adb0-899799989e11-summary.md`
- Tamanho: `3670` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/46fa72ff-0b92-476c-aa69-224074fb1931-f57178a5-b839-4c43-8d66-e9e899e583cb-plan.md`
- Tamanho: `4449` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/4a43dff4-f7d5-467f-ae4d-ba45692680e5-6055964f-b364-4dac-b826-f13c9e9cbb16-summary.md`
- Tamanho: `3489` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/4a43dff4-f7d5-467f-ae4d-ba45692680e5-d97bc1be-1580-4767-bdf4-ea9e5404bf55-plan.md`
- Tamanho: `6789` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/4e3ca488-c700-42f5-a516-9d1b3502dc88-6a99f90a-72b5-4c94-b94e-fd63d6d6df52-plan.md`
- Tamanho: `4303` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/4e3ca488-c700-42f5-a516-9d1b3502dc88-d2b8389c-1ea0-4af4-bbf3-cbd5d3da19ac-summary.md`
- Tamanho: `94204` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/4eb9c483-86f0-4fa2-b97f-e871be3dd540-5ccabf62-7008-46df-88dd-32ac34527cd7-plan.md`
- Tamanho: `1390` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/4eb9c483-86f0-4fa2-b97f-e871be3dd540-9c31a0f0-f70a-495c-9e19-57bb29b56ba1-summary.md`
- Tamanho: `1464` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/54442b8a-4055-40ac-9006-565622569716-2902011f-a644-44b3-8987-820ee108ffbd-summary.md`
- Tamanho: `3634` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/54442b8a-4055-40ac-9006-565622569716-d797aa09-7459-4ef6-9a79-b5e459c73c99-plan.md`
- Tamanho: `4733` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/59a702cf-facb-471f-adf7-282aff38a4df-06c10976-fd7f-42ab-87c6-18ba1ab0e575-summary.md`
- Tamanho: `1102` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/59a702cf-facb-471f-adf7-282aff38a4df-b1f9125c-aee4-4dab-9870-94722ac70d88-summary.md`
- Tamanho: `1971` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/59a702cf-facb-471f-adf7-282aff38a4df-f652f5f8-a5eb-4a08-a78a-24a97927f140-plan.md`
- Tamanho: `1283` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/611c7d93-df33-4871-9cde-7468903f8cd7-6f914212-7ed0-4f89-9f26-baaebe6c38f3-summary.md`
- Tamanho: `1464` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/611c7d93-df33-4871-9cde-7468903f8cd7-877df128-4cdf-4540-8342-07f562dfa015-plan.md`
- Tamanho: `1463` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/6e9683f1-9da8-45df-a1f3-5ac6a5b6ad3e-02937fec-0561-4ab6-9cee-84ee02343d50-plan.md`
- Tamanho: `1391` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/6e9683f1-9da8-45df-a1f3-5ac6a5b6ad3e-99da6e09-dcca-42be-9b18-168f558ab19f-summary.md`
- Tamanho: `2007` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/70ed8313-ab94-43b1-bdb9-26300e0c82ef-572c2b0d-2122-4e5d-bf1e-f187a9e61c02-plan.md`
- Tamanho: `1443` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/70ed8313-ab94-43b1-bdb9-26300e0c82ef-60937f8a-58be-47c8-ab46-4f1df152a9b9-summary.md`
- Tamanho: `1758` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/70ed8313-ab94-43b1-bdb9-26300e0c82ef-8ea4f9dd-3a8e-4524-a30b-6cda26d511b4-summary.md`
- Tamanho: `474` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/73c41231-671b-46d8-bdd8-ae08b886ae4c-0cdf5f68-1901-4bf9-a801-9faaef0a3416-summary.md`
- Tamanho: `2007` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/73c41231-671b-46d8-bdd8-ae08b886ae4c-6e746826-8206-4fe5-aeb2-df365109d08e-plan.md`
- Tamanho: `1473` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/742a0a76-e6e3-4942-b347-1ca5b57c6e8f-c7c37443-666f-4bbe-a316-83cc978feca1-summary.md`
- Tamanho: `2007` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/742a0a76-e6e3-4942-b347-1ca5b57c6e8f-fc0a4db5-957c-40b6-8fc5-c7465d518649-plan.md`
- Tamanho: `1471` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/7938631a-6148-4f3a-b4bd-6819c4d10711-87e26193-3021-47a1-aca1-a098a0c975e6-summary.md`
- Tamanho: `94531` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/7938631a-6148-4f3a-b4bd-6819c4d10711-aa11ffd4-14ef-475f-8a95-43b2f1584f54-plan.md`
- Tamanho: `1886` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/7d0f8d6f-eaed-446a-9390-4a15c6ade408-aba84dac-23dc-495f-8252-cd9cfa39a423-summary.md`
- Tamanho: `1464` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/7d0f8d6f-eaed-446a-9390-4a15c6ade408-d0f68723-f78a-486d-9d68-e28cc5c5b3fa-plan.md`
- Tamanho: `1356` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/7f368a4a-a2aa-43ac-a48d-c7a3a992b2ea-5ac92788-1fac-4941-a18b-8f3e0de89ac3-plan.md`
- Tamanho: `1471` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/7f368a4a-a2aa-43ac-a48d-c7a3a992b2ea-9afa2e5d-b2e2-4d61-b429-08412c3c173a-summary.md`
- Tamanho: `2007` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/8618fd11-eb19-4b96-aacb-c0b933091cd1-2def1fd5-4694-4b9d-8e5a-5d142f3c1e3c-plan.md`
- Tamanho: `1950` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/8618fd11-eb19-4b96-aacb-c0b933091cd1-75118b0a-71f7-4cef-940c-0fadb55c9d48-summary.md`
- Tamanho: `94506` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/96b64a69-5a6a-44b7-9362-8b054bd0aabb-2ffc2860-3035-4a8c-80a3-6ce474f5b6a8-summary.md`
- Tamanho: `1971` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/96b64a69-5a6a-44b7-9362-8b054bd0aabb-9793b177-a800-4e78-a52e-aacbc6706854-plan.md`
- Tamanho: `1302` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/9d2d2292-bc80-40ba-ab2b-945a31e31a5b-7a753a42-43f0-48d4-b4c3-e1802d8e0bab-tests.json`
- Tamanho: `249` bytes
- Papel: Arquivo de configura??o.

### `data/projects/root-3b3d8007/artifacts/9d2d2292-bc80-40ba-ab2b-945a31e31a5b-9375ec2c-34a7-4b54-9353-50cbda25662b-summary.md`
- Tamanho: `1971` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/9d2d2292-bc80-40ba-ab2b-945a31e31a5b-e8d78698-a1dd-442b-8b66-f4f4a1fb8342-plan.md`
- Tamanho: `1466` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/a0b89fb7-b5ed-44fc-9a44-2e98288ed091-132936ea-f9e9-45f2-86ef-bde5bca0c1a8-summary.md`
- Tamanho: `1758` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/a0b89fb7-b5ed-44fc-9a44-2e98288ed091-70327baf-c203-4dea-b56d-7404048c8c5e-plan.md`
- Tamanho: `1305` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/a1603f59-1905-4571-aaa2-288edea1d50a-080ef883-cd04-4ff8-8aaf-e948c49a1975-plan.md`
- Tamanho: `4775` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/a1603f59-1905-4571-aaa2-288edea1d50a-55c5e01e-0758-45cb-a461-2e7558fcbaf2-summary.md`
- Tamanho: `3670` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/a6af436f-bd2b-4d98-8726-d78940cb79b7-679db86c-1050-465b-a1f9-a7fd5b18f8d2-plan.md`
- Tamanho: `1399` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/a6af436f-bd2b-4d98-8726-d78940cb79b7-bf2b4e7e-ac2b-4a25-ab97-574b8795ee3b-summary.md`
- Tamanho: `1971` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/a84c2d55-56bf-488c-ac5f-db0dfb96b8f0-17dfdd2a-908f-4fcc-99ba-e8945adce901-plan.md`
- Tamanho: `1492` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/a84c2d55-56bf-488c-ac5f-db0dfb96b8f0-772671ac-e309-4c58-80e0-112598ca5e64-summary.md`
- Tamanho: `681` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/a84c2d55-56bf-488c-ac5f-db0dfb96b8f0-e630a782-1be3-4ab7-8759-4953c82e238d-summary.md`
- Tamanho: `1971` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/a926fee8-f8a7-4921-98d3-5895f97c43bc-0442584c-8d91-4edc-b62d-eb270dddd1d3-summary.md`
- Tamanho: `1464` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/a926fee8-f8a7-4921-98d3-5895f97c43bc-be179524-0634-4fb2-b612-1459d89931e7-plan.md`
- Tamanho: `1378` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/afc911c5-a97e-4193-8bbe-382e38317239-7e513dc7-718e-4ac5-a646-51bb6322cf10-plan.md`
- Tamanho: `1463` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/afc911c5-a97e-4193-8bbe-382e38317239-96eeb104-c299-40ed-8230-38a540e7f45b-summary.md`
- Tamanho: `1464` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/b3c5fb9a-fbbb-45f5-bf46-85bf6a8bc07a-44f50ee2-2d0c-447f-900a-9751e4e9789b-summary.md`
- Tamanho: `1788` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/b3c5fb9a-fbbb-45f5-bf46-85bf6a8bc07a-69f90809-d51c-4679-877c-eae836f45308-summary.md`
- Tamanho: `2402` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/b3c5fb9a-fbbb-45f5-bf46-85bf6a8bc07a-8ae2fc67-b350-40d1-bd1c-f61e9e3c9270-plan.md`
- Tamanho: `1646` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/b6487d05-3c70-4a5d-ae26-ff7457dc2a8d-00d49dc0-82d8-41fa-957e-32d61a94ace3-plan.md`
- Tamanho: `1882` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/b6487d05-3c70-4a5d-ae26-ff7457dc2a8d-d94ff08f-73cf-40b7-9c19-a588e70e44d3-summary.md`
- Tamanho: `94531` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/c0b9acc0-5dfa-4c2f-8b0f-73e3c91e165d-70904700-0106-4e4e-98fa-2508339a60ae-summary.md`
- Tamanho: `474` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/c0b9acc0-5dfa-4c2f-8b0f-73e3c91e165d-aba5b959-be62-4b91-be33-a13b6c473fd9-plan.md`
- Tamanho: `1492` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/c0b9acc0-5dfa-4c2f-8b0f-73e3c91e165d-d299d77e-da3a-4ec7-aedd-3591f3abe919-summary.md`
- Tamanho: `1464` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/c2c04045-e6df-4948-9d11-f499d8a71e8b-7e4a724a-34ba-4286-8f3a-b534c24bd738-summary.md`
- Tamanho: `94204` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/c2c04045-e6df-4948-9d11-f499d8a71e8b-8009fce5-782f-46f0-bae2-30860685d164-plan.md`
- Tamanho: `4466` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/cbc2de58-a2e9-4920-bdc5-16a5055145da-50268d4a-2eda-4dcd-aeb8-1d6f05f48f6b-summary.md`
- Tamanho: `1758` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/cbc2de58-a2e9-4920-bdc5-16a5055145da-91f613ae-cee2-48a6-8f3f-649a49dca083-plan.md`
- Tamanho: `1430` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/cbc2de58-a2e9-4920-bdc5-16a5055145da-e41c3e44-0554-4b40-8913-ee7dd1a5bcdf-summary.md`
- Tamanho: `1104` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/d15bab0f-8855-420b-9c48-89e6bf17dfb6-e1916692-446a-4509-8782-697add7629f8-plan.md`
- Tamanho: `1874` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/d15bab0f-8855-420b-9c48-89e6bf17dfb6-effa4772-9270-47bb-97ee-3cf07012499c-summary.md`
- Tamanho: `94430` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/de80bfe8-a150-4581-b963-ace9b69a0791-04996fad-aa22-416c-8a61-4fffc25b27a9-summary.md`
- Tamanho: `1971` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/de80bfe8-a150-4581-b963-ace9b69a0791-73016861-57ea-4a50-8cda-96a39e9e8c85-plan.md`
- Tamanho: `1415` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/e4f260e5-9ecb-47b0-b01c-ef8b2d64256b-40251053-4551-4b2c-8dfc-4e2a06b65e9b-readme_draft.md`
- Tamanho: `4845` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/e4f260e5-9ecb-47b0-b01c-ef8b2d64256b-4783903f-758e-4123-9a39-a2ac7b43b099-summary.md`
- Tamanho: `2799` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/e4f260e5-9ecb-47b0-b01c-ef8b2d64256b-e8311d08-3700-43b8-9170-e0407facd985-plan.md`
- Tamanho: `4600` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/e96492f4-ddf1-442b-b6f9-2329b86c3423-0b97ee0c-7482-4550-83ff-09e764b47729-plan.md`
- Tamanho: `516` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/e96492f4-ddf1-442b-b6f9-2329b86c3423-8133e10f-ace5-4a9e-accd-8c1ff337b4bf-summary.md`
- Tamanho: `1442` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/e9d7e678-35e4-4d34-a310-4f82a499075c-8a47367b-8292-4bd5-a368-ddd38b7f2af2-summary.md`
- Tamanho: `1788` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/e9d7e678-35e4-4d34-a310-4f82a499075c-f984fa55-f661-443a-b7e9-bf69c85bf6b8-plan.md`
- Tamanho: `1376` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/e9fc6744-f467-4c76-bbc0-290dc6df17c9-4719435b-91e1-414b-9864-5bd6bab48524-summary.md`
- Tamanho: `1407` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/e9fc6744-f467-4c76-bbc0-290dc6df17c9-57eaf31e-e2a3-40f0-9e98-2fda88a25928-plan.md`
- Tamanho: `758` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/ee4fcc3c-6e4c-472a-819d-f54a09c2d245-7c7cf7ca-4307-4396-b930-57242d1daa43-summary.md`
- Tamanho: `1758` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/ee4fcc3c-6e4c-472a-819d-f54a09c2d245-c2974352-2869-41de-bfda-f6466d900440-plan.md`
- Tamanho: `1465` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/f54008b9-a8f7-425c-bcb4-21fa26b77a00-2ea35db3-d843-49f9-9fdf-8a902d3f97f4-summary.md`
- Tamanho: `474` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/f54008b9-a8f7-425c-bcb4-21fa26b77a00-613e7baa-c780-436d-a819-b70091898313-summary.md`
- Tamanho: `1464` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/f54008b9-a8f7-425c-bcb4-21fa26b77a00-cc32de97-f0d3-4b13-b653-3a3594a40237-plan.md`
- Tamanho: `1486` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/f6a98d1b-6bae-491d-9fab-c8788da733d9-0b0444f2-bb29-4cad-80b0-b69bbf7c994e-summary.md`
- Tamanho: `1758` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/f6a98d1b-6bae-491d-9fab-c8788da733d9-38adad63-6db3-4712-ae95-7f4105cc7289-plan.md`
- Tamanho: `1320` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/f6a98d1b-6bae-491d-9fab-c8788da733d9-dc12da18-f6d0-4f0b-84dc-939a2ab69144-summary.md`
- Tamanho: `474` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/fc750e9b-02cc-4386-b6e9-7b43e61e478e-67a72b32-0614-4cfc-9662-c8136a3b7838-plan.md`
- Tamanho: `1394` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/fc750e9b-02cc-4386-b6e9-7b43e61e478e-b40108b5-e788-4765-abaf-7a3f463fc936-summary.md`
- Tamanho: `1971` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/ff77b9eb-64b9-473d-a77e-c340f2801b38-858f36a8-c5dc-4fcd-856f-d6230200d843-plan.md`
- Tamanho: `1426` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/ff77b9eb-64b9-473d-a77e-c340f2801b38-b210f8cb-8f7b-4512-a44a-fcab3f53f826-summary.md`
- Tamanho: `84` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/ff77b9eb-64b9-473d-a77e-c340f2801b38-f766515b-0754-457b-bc5c-ac05269459ea-summary.md`
- Tamanho: `1758` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/artifacts/index.json`
- Tamanho: `201646` bytes
- Papel: Arquivo de configura??o.

### `data/projects/root-3b3d8007/context-summary.md`
- Tamanho: `307` bytes
- Papel: Documenta??o do projeto.

### `data/projects/root-3b3d8007/last-test-result.json`
- Tamanho: `377` bytes
- Papel: Arquivo de configura??o.

### `data/projects/workspace-5ca33cf5/artifacts/15fe013a-e652-4642-8322-7e279b9f4315-0a5b8bba-47b0-42b9-8064-ad3fb9a8db61-summary.md`
- Tamanho: `177` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/15fe013a-e652-4642-8322-7e279b9f4315-f006476c-c052-4ee1-86d1-d1afa7a447f0-plan.md`
- Tamanho: `3618` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/1ee72d73-43cc-4ef2-a1e6-9978ac918d94-3261599a-6c97-4dd6-b695-b11cc415a25e-summary.md`
- Tamanho: `90` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/1ee72d73-43cc-4ef2-a1e6-9978ac918d94-b51d9a90-d4dd-4225-b75a-1fc10a85fb94-plan.md`
- Tamanho: `919` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/4b0e8c25-2c80-4dd9-9cc3-f4ee74c47686-48b1523c-d618-4af5-ac8e-aff0905126a8-plan.md`
- Tamanho: `898` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/4b0e8c25-2c80-4dd9-9cc3-f4ee74c47686-d4130b54-903a-4c92-b881-5b37163d8c62-summary.md`
- Tamanho: `90` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/94bb9d7c-2386-4100-9c43-6453c987730a-2212d01c-64b3-4595-a1be-51fc625884a5-summary.md`
- Tamanho: `153` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/94bb9d7c-2386-4100-9c43-6453c987730a-31ae078f-1b1e-46ce-b2d2-89fcf8d8038c-plan.md`
- Tamanho: `3246` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/a4b0ac8f-336d-4271-969f-fa60e09175db-93555115-372c-4a98-9512-69eb6977dac2-summary.md`
- Tamanho: `90` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/a4b0ac8f-336d-4271-969f-fa60e09175db-965fb5b1-85bc-4576-9af6-a9188850e4c9-plan.md`
- Tamanho: `893` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/b1702dec-eb6c-41fb-a11c-11d657c0eb76-320e203e-9e1b-4598-8489-11271e199ea8-summary.md`
- Tamanho: `90` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/b1702dec-eb6c-41fb-a11c-11d657c0eb76-3d35b42f-e40c-4e58-96e3-2b8216f776b8-plan.md`
- Tamanho: `895` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/c932d3a0-ece9-45b2-898a-becd2300e763-059f6ecf-9bc3-4f7c-8fd5-4cc1fa6a8417-plan.md`
- Tamanho: `3045` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/c932d3a0-ece9-45b2-898a-becd2300e763-619dadc7-0524-4d53-924f-dddd1f772530-summary.md`
- Tamanho: `129` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/d46fce5a-d1fe-4c57-877b-3342d6308584-0b0d4f88-590b-4c76-a55f-113de096b344-plan.md`
- Tamanho: `2998` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/d46fce5a-d1fe-4c57-877b-3342d6308584-41784230-11db-497d-a1df-84afa8d6e652-summary.md`
- Tamanho: `90` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/fae0e8fb-2c70-437d-8dbc-e1fd27fc5274-aa1ee90e-902d-4d14-9612-69b8b6f20425-summary.md`
- Tamanho: `153` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/fae0e8fb-2c70-437d-8dbc-e1fd27fc5274-d8d93e40-bfc5-4255-89d3-495fd641a035-plan.md`
- Tamanho: `3719` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/artifacts/fae0e8fb-2c70-437d-8dbc-e1fd27fc5274-e28ae71b-28ac-40eb-80d6-47841e91ea29-tests.json`
- Tamanho: `417` bytes
- Papel: Arquivo de configura??o.

### `data/projects/workspace-5ca33cf5/artifacts/index.json`
- Tamanho: `37049` bytes
- Papel: Arquivo de configura??o.

### `data/projects/workspace-5ca33cf5/context-summary.md`
- Tamanho: `206` bytes
- Papel: Documenta??o do projeto.

### `data/projects/workspace-5ca33cf5/last-test-result.json`
- Tamanho: `223` bytes
- Papel: Arquivo de configura??o.

### `data/sessions.json`
- Tamanho: `14976` bytes
- Papel: Arquivo de configura??o.

### `data/staged-files.json`
- Tamanho: `51339` bytes
- Papel: Arquivo de configura??o.

### `data/usage/ai-usage.json`
- Tamanho: `19` bytes
- Papel: Arquivo de configura??o.

### `docs/agent-test.md`
- Tamanho: `355` bytes
- Papel: Documenta??o do projeto.

### `docs/CODE_AUDIT_REPORT.md`
- Tamanho: `54430` bytes
- Papel: Documenta??o do projeto.

### `docs/PROMPT_NEXT_PR.md`
- Tamanho: `3208` bytes
- Papel: Documenta??o do projeto.

### `docs/RELEASE_V1_CHECKLIST.md`
- Tamanho: `5001` bytes
- Papel: Documenta??o do projeto.

### `electron/main.ts`
- Tamanho: `632` bytes
- Papel: Camada Electron desktop.

### `electron/preload.ts`
- Tamanho: `454` bytes
- Papel: Camada Electron desktop.

### `FEATURE_EDITOR_SELECTION_ACTIONS.md`
- Tamanho: `3823` bytes
- Papel: Documenta??o do projeto.

### `frontend/eslint.config.js`
- Tamanho: `598` bytes
- Papel: Aplica??o frontend Vite/React auxiliar.

### `frontend/index.html`
- Tamanho: `719` bytes
- Papel: Aplica??o frontend Vite/React auxiliar.

### `frontend/package-lock.json`
- Tamanho: `95486` bytes
- Papel: Aplica??o frontend Vite/React auxiliar.

### `frontend/package.json`
- Tamanho: `710` bytes
- Papel: Aplica??o frontend Vite/React auxiliar.

### `frontend/README.md`
- Tamanho: `2429` bytes
- Papel: Aplica??o frontend Vite/React auxiliar.

### `frontend/src/App.css`
- Tamanho: `12686` bytes
- Papel: Aplica??o frontend Vite/React auxiliar.

### `frontend/src/App.tsx`
- Tamanho: `15058` bytes
- Papel: Aplica??o frontend Vite/React auxiliar.
- Itens de c?digo encontrados: `5`

### `frontend/src/index.css`
- Tamanho: `808` bytes
- Papel: Aplica??o frontend Vite/React auxiliar.

### `frontend/src/main.tsx`
- Tamanho: `235` bytes
- Papel: Aplica??o frontend Vite/React auxiliar.

### `frontend/tsconfig.app.json`
- Tamanho: `617` bytes
- Papel: Aplica??o frontend Vite/React auxiliar.

### `frontend/tsconfig.json`
- Tamanho: `107` bytes
- Papel: Aplica??o frontend Vite/React auxiliar.

### `frontend/tsconfig.node.json`
- Tamanho: `591` bytes
- Papel: Aplica??o frontend Vite/React auxiliar.

### `frontend/vite.config.ts`
- Tamanho: `368` bytes
- Papel: Aplica??o frontend Vite/React auxiliar.

### `llm-training/01_nanogpt/config.py`
- Tamanho: `6044` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `7`

### `llm-training/01_nanogpt/model.py`
- Tamanho: `40498` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `27`

### `llm-training/01_nanogpt/nexus_tokenizer/tokenizer.json`
- Tamanho: `25842` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.

### `llm-training/01_nanogpt/nexus_tokenizer/tokenizer_config.json`
- Tamanho: `492` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.

### `llm-training/01_nanogpt/smoke_test_train.py`
- Tamanho: `8210` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `3`

### `llm-training/01_nanogpt/tokenizer.py`
- Tamanho: `36509` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `24`

### `llm-training/01_nanogpt/train.py`
- Tamanho: `39672` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `15`

### `llm-training/02_data_pipeline/collect.py`
- Tamanho: `11247` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `6`

### `llm-training/02_data_pipeline/collect_data.py`
- Tamanho: `10134` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `6`

### `llm-training/02_data_pipeline/curate_code.py`
- Tamanho: `20835` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `10`

### `llm-training/02_data_pipeline/dedup.py`
- Tamanho: `12407` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `9`

### `llm-training/02_data_pipeline/filter.py`
- Tamanho: `13574` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `14`

### `llm-training/02_data_pipeline/token_pack.py`
- Tamanho: `13476` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `13`

### `llm-training/03_finetune/dataset.py`
- Tamanho: `30190` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `23`

### `llm-training/03_finetune/dpo.py`
- Tamanho: `25290` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `4`

### `llm-training/03_finetune/dpo_generator.py`
- Tamanho: `14795` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `26`

### `llm-training/03_finetune/sft.py`
- Tamanho: `17571` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `9`

### `llm-training/03_finetune/sft_generator.py`
- Tamanho: `13598` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `13`

### `llm-training/04_evaluate/benchmark.py`
- Tamanho: `20036` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `8`

### `llm-training/04_evaluate/generate.py`
- Tamanho: `14647` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.
- Itens de c?digo encontrados: `4`

### `llm-training/data/test_raw/gen_test_data.py`
- Tamanho: `2962` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `llm-training/README.md`
- Tamanho: `7157` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.

### `llm-training/run_pipeline.ps1`
- Tamanho: `10490` bytes
- Papel: Pipeline experimental de treino/avalia??o de LLM.

### `llm-training/test_curate_temp.py`
- Tamanho: `1560` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `NexusAI/app.py`
- Tamanho: `12773` bytes
- Papel: API Flask local do NexusAI.
- Itens de c?digo encontrados: `17`

### `NexusAI/benchmark_prompts.json`
- Tamanho: `8500` bytes
- Papel: Configura??o, benchmark ou metadado do NexusAI.

### `NexusAI/build_instruction_pairs_premium.py`
- Tamanho: `16653` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `2`

### `NexusAI/build_pro_quality_curriculum.py`
- Tamanho: `27777` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `2`

### `NexusAI/cloud_train.py`
- Tamanho: `2486` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `3`

### `NexusAI/CLOUD_TRAINING.md`
- Tamanho: `1829` bytes
- Papel: Artefato/documenta??o do NexusAI.

### `NexusAI/command_sandbox.py`
- Tamanho: `3191` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `4`

### `NexusAI/compare_evaluations.py`
- Tamanho: `3367` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `4`

### `NexusAI/config.json`
- Tamanho: `1008` bytes
- Papel: Configura??o, benchmark ou metadado do NexusAI.

### `NexusAI/config.micro-fullstack.json`
- Tamanho: `905` bytes
- Papel: Configura??o, benchmark ou metadado do NexusAI.

### `NexusAI/config.micro-instruct-behavior-only.json`
- Tamanho: `942` bytes
- Papel: Configura??o, benchmark ou metadado do NexusAI.

### `NexusAI/config.micro-instruct-fullstack.behavior.json`
- Tamanho: `939` bytes
- Papel: Configura??o, benchmark ou metadado do NexusAI.

### `NexusAI/config.micro-instruct-fullstack.infinite.json`
- Tamanho: `938` bytes
- Papel: Configura??o, benchmark ou metadado do NexusAI.

### `NexusAI/config.micro-instruct-fullstack.json`
- Tamanho: `935` bytes
- Papel: Configura??o, benchmark ou metadado do NexusAI.

### `NexusAI/config.micro-python.json`
- Tamanho: `896` bytes
- Papel: Configura??o, benchmark ou metadado do NexusAI.

### `NexusAI/context_budget.py`
- Tamanho: `1820` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `3`

### `NexusAI/controlled_generate.py`
- Tamanho: `9313` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `7`

### `NexusAI/convergence_check.py`
- Tamanho: `632` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.

### `NexusAI/corpus_builder.py`
- Tamanho: `7091` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `11`

### `NexusAI/dataset_cleaner.py`
- Tamanho: `3761` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `4`

### `NexusAI/dependency_guard.py`
- Tamanho: `1361` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `4`

### `NexusAI/evaluate_generation_quality.py`
- Tamanho: `10950` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `14`

### `NexusAI/export_failures_to_gold.py`
- Tamanho: `2661` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `3`

### `NexusAI/export_for_cloud.py`
- Tamanho: `2229` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `4`

### `NexusAI/failure_ranking.py`
- Tamanho: `1729` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `3`

### `NexusAI/failure_store.py`
- Tamanho: `1565` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `2`

### `NexusAI/freeze_release.py`
- Tamanho: `3958` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `4`

### `NexusAI/fullstack_corpus_builder.py`
- Tamanho: `7602` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `11`

### `NexusAI/git_tools.py`
- Tamanho: `2736` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `7`

### `NexusAI/infer.py`
- Tamanho: `9633` bytes
- Papel: Infer?ncia local e gera??o de texto/c?digo.
- Itens de c?digo encontrados: `13`

### `NexusAI/instruction_dataset_builder.py`
- Tamanho: `5470` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `7`

### `NexusAI/memory_store.py`
- Tamanho: `12121` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `19`

### `NexusAI/model.py`
- Tamanho: `3914` bytes
- Papel: Modelo transformer causal trein?vel localmente.
- Itens de c?digo encontrados: `8`

### `NexusAI/model_review_fix_report.py`
- Tamanho: `2990` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `2`

### `NexusAI/nexus_commands.py`
- Tamanho: `3757` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `3`

### `NexusAI/nexus_status.py`
- Tamanho: `5812` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `6`

### `NexusAI/NEXUSAI_PROGRESS_AND_ROADMAP.md`
- Tamanho: `11283` bytes
- Papel: Artefato/documenta??o do NexusAI.

### `NexusAI/openapi.json`
- Tamanho: `9205` bytes
- Papel: Configura??o, benchmark ou metadado do NexusAI.

### `NexusAI/package-lock.json`
- Tamanho: `30066` bytes
- Papel: Configura??o, benchmark ou metadado do NexusAI.

### `NexusAI/package.json`
- Tamanho: `485` bytes
- Papel: Configura??o, benchmark ou metadado do NexusAI.

### `NexusAI/parse_loss.py`
- Tamanho: `580` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.

### `NexusAI/patch_manager.py`
- Tamanho: `5705` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `8`

### `NexusAI/plot_loss.py`
- Tamanho: `517` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.

### `NexusAI/post_train_report.py`
- Tamanho: `6295` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `7`

### `NexusAI/preview_writer.py`
- Tamanho: `1103` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `2`

### `NexusAI/production_test_prompts.json`
- Tamanho: `2762` bytes
- Papel: Configura??o, benchmark ou metadado do NexusAI.

### `NexusAI/project_docs.py`
- Tamanho: `3451` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `4`

### `NexusAI/project_report.py`
- Tamanho: `10358` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `7`

### `NexusAI/README.md`
- Tamanho: `3879` bytes
- Papel: Artefato/documenta??o do NexusAI.

### `NexusAI/real_task_runner.py`
- Tamanho: `18686` bytes
- Papel: Avalia??o de tarefas reais/controladas.
- Itens de c?digo encontrados: `17`

### `NexusAI/repo_benchmark.py`
- Tamanho: `7494` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `6`

### `NexusAI/repo_indexer.py`
- Tamanho: `8352` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `11`

### `NexusAI/repo_mode.py`
- Tamanho: `7685` bytes
- Papel: Modo repo real: contexto, task e patch review.
- Itens de c?digo encontrados: `5`

### `NexusAI/run_controlled_battery.py`
- Tamanho: `6102` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `3`

### `NexusAI/setup_and_run.ps1`
- Tamanho: `3341` bytes
- Papel: Artefato/documenta??o do NexusAI.

### `NexusAI/src/__init__.py`
- Tamanho: `33` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.

### `NexusAI/src/api.py`
- Tamanho: `2852` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `4`

### `NexusAI/src/cache.ts`
- Tamanho: `2342` bytes
- Papel: Artefato/documenta??o do NexusAI.
- Itens de c?digo encontrados: `8`

### `NexusAI/src/cache_py.py`
- Tamanho: `888` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `5`

### `NexusAI/src/context.py`
- Tamanho: `1496` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `3`

### `NexusAI/src/i18n.py`
- Tamanho: `1214` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `2`

### `NexusAI/strict_mode.py`
- Tamanho: `2108` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `3`

### `NexusAI/study_fullstack_until.py`
- Tamanho: `1661` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `2`

### `NexusAI/study_instruct_until.py`
- Tamanho: `1699` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `2`

### `NexusAI/study_until.py`
- Tamanho: `1437` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `2`

### `NexusAI/task_metrics.py`
- Tamanho: `5807` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `8`

### `NexusAI/task_router.py`
- Tamanho: `5596` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `3`

### `NexusAI/test_api.py`
- Tamanho: `958` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `NexusAI/test_controlled_components.py`
- Tamanho: `7834` bytes
- Papel: Teste automatizado ou fixture de valida??o.
- Itens de c?digo encontrados: `10`

### `NexusAI/test_runner.py`
- Tamanho: `3443` bytes
- Papel: Teste automatizado ou fixture de valida??o.
- Itens de c?digo encontrados: `5`

### `NexusAI/tokenizer_train.py`
- Tamanho: `2543` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `3`

### `NexusAI/train.py`
- Tamanho: `13140` bytes
- Papel: Treinamento com checkpoint/resume.
- Itens de c?digo encontrados: `11`

### `NexusAI/USER_TESTING_PLAN.md`
- Tamanho: `1191` bytes
- Papel: Artefato/documenta??o do NexusAI.

### `NexusAI/validators.py`
- Tamanho: `6372` bytes
- Papel: M?dulo Python do laborat?rio/modelo local NexusAI.
- Itens de c?digo encontrados: `14`

### `NexusAI/web/index.html`
- Tamanho: `354` bytes
- Papel: Artefato/documenta??o do NexusAI.

### `NexusAI/web/package-lock.json`
- Tamanho: `30703` bytes
- Papel: Configura??o, benchmark ou metadado do NexusAI.

### `NexusAI/web/package.json`
- Tamanho: `405` bytes
- Papel: Configura??o, benchmark ou metadado do NexusAI.

### `NexusAI/web/src/App.css`
- Tamanho: `1550` bytes
- Papel: Artefato/documenta??o do NexusAI.

### `NexusAI/web/src/App.jsx`
- Tamanho: `1792` bytes
- Papel: Artefato/documenta??o do NexusAI.
- Itens de c?digo encontrados: `2`

### `NexusAI/web/src/counter.ts`
- Tamanho: `280` bytes
- Papel: Artefato/documenta??o do NexusAI.
- Itens de c?digo encontrados: `2`

### `NexusAI/web/src/main.ts`
- Tamanho: `272` bytes
- Papel: Artefato/documenta??o do NexusAI.

### `NexusAI/web/src/main.tsx`
- Tamanho: `273` bytes
- Papel: Artefato/documenta??o do NexusAI.

### `NexusAI/web/src/style.css`
- Tamanho: `5038` bytes
- Papel: Artefato/documenta??o do NexusAI.

### `NexusAI/web/tsconfig.json`
- Tamanho: `522` bytes
- Papel: Configura??o, benchmark ou metadado do NexusAI.

### `package-lock.json`
- Tamanho: `181595` bytes
- Papel: Arquivo de configura??o.

### `package.json`
- Tamanho: `1328` bytes
- Papel: Arquivo de configura??o.

### `public/agent-progress.js`
- Tamanho: `7514` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.
- Itens de c?digo encontrados: `10`

### `public/ai-panel.js`
- Tamanho: `3701` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.
- Itens de c?digo encontrados: `7`

### `public/app.js`
- Tamanho: `17146` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.
- Itens de c?digo encontrados: `29`

### `public/command-palette.js`
- Tamanho: `5392` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.
- Itens de c?digo encontrados: `9`

### `public/devmind.js`
- Tamanho: `25761` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.
- Itens de c?digo encontrados: `27`

### `public/editor-selection-actions.js`
- Tamanho: `42948` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.
- Itens de c?digo encontrados: `38`

### `public/editor.js`
- Tamanho: `13607` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.
- Itens de c?digo encontrados: `24`

### `public/explorer.js`
- Tamanho: `10613` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.
- Itens de c?digo encontrados: `17`

### `public/index.html`
- Tamanho: `18523` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.

### `public/layout.js`
- Tamanho: `5815` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.
- Itens de c?digo encontrados: `10`

### `public/nexus-codex-theme.css`
- Tamanho: `17542` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.

### `public/patch-review.js`
- Tamanho: `23529` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.
- Itens de c?digo encontrados: `33`

### `public/preview.js`
- Tamanho: `6045` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.
- Itens de c?digo encontrados: `16`

### `public/search.js`
- Tamanho: `1820` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.
- Itens de c?digo encontrados: `2`

### `public/sidebar-panels.js`
- Tamanho: `4095` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.
- Itens de c?digo encontrados: `4`

### `public/site-builder-draft.html`
- Tamanho: `302` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.

### `public/styles.css`
- Tamanho: `32157` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.

### `public/terminal.js`
- Tamanho: `10322` bytes
- Papel: Arquivo de frontend est?tico servido pela UI.
- Itens de c?digo encontrados: `13`

### `README.md`
- Tamanho: `6791` bytes
- Papel: Documenta??o do projeto.

### `scripts/desktop-build.mjs`
- Tamanho: `128` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.

### `scripts/desktop-dev.mjs`
- Tamanho: `108` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.

### `scripts/generate-index.cjs`
- Tamanho: `28119` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `16`

### `src/action-executor.ts`
- Tamanho: `6478` bytes
- Papel: Aplica a??es aprovadas, patches, comandos e backups.
- Itens de c?digo encontrados: `4`

### `src/action-planner.ts`
- Tamanho: `9624` bytes
- Papel: Extrai, valida e normaliza a??es propostas pela IA.
- Itens de c?digo encontrados: `17`

### `src/action-types.ts`
- Tamanho: `2092` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.

### `src/active-project.ts`
- Tamanho: `3721` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `10`

### `src/agents/antygravit-agent.ts`
- Tamanho: `454` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `1`

### `src/agents/blackbox-agent.ts`
- Tamanho: `2467` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `3`

### `src/agents/claude-agent.ts`
- Tamanho: `1706` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `2`

### `src/agents/codex-agent.ts`
- Tamanho: `2429` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `2`

### `src/agents/index.ts`
- Tamanho: `840` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `2`

### `src/agents/local-mock-agent.ts`
- Tamanho: `591` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `2`

### `src/agents/shared.ts`
- Tamanho: `3079` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `3`

### `src/agents/types.ts`
- Tamanho: `789` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `1`

### `src/ai/ai-edit-planner.ts`
- Tamanho: `5364` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `5`

### `src/ai/local-codex-agent.ts`
- Tamanho: `4053` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `5`

### `src/app/agents/artifacts.ts`
- Tamanho: `3669` bytes
- Papel: M?dulo do sistema de agentes do Nexus.
- Itens de c?digo encontrados: `8`

### `src/app/agents/code-generation.ts`
- Tamanho: `29997` bytes
- Papel: M?dulo do sistema de agentes do Nexus.
- Itens de c?digo encontrados: `14`

### `src/app/agents/history.ts`
- Tamanho: `2840` bytes
- Papel: M?dulo do sistema de agentes do Nexus.
- Itens de c?digo encontrados: `8`

### `src/app/agents/models.ts`
- Tamanho: `2570` bytes
- Papel: M?dulo do sistema de agentes do Nexus.

### `src/app/agents/registry.ts`
- Tamanho: `5058` bytes
- Papel: Registro e defini??o dos agentes dispon?veis.
- Itens de c?digo encontrados: `5`

### `src/app/agents/routing.ts`
- Tamanho: `3445` bytes
- Papel: M?dulo do sistema de agentes do Nexus.
- Itens de c?digo encontrados: `4`

### `src/app/agents/runner.ts`
- Tamanho: `24248` bytes
- Papel: Orquestrador de execu??es dos agentes.
- Itens de c?digo encontrados: `32`

### `src/app/agents/tools.ts`
- Tamanho: `18614` bytes
- Papel: Ferramentas usadas pelos agentes internos.
- Itens de c?digo encontrados: `24`

### `src/app/agents/utils.ts`
- Tamanho: `786` bytes
- Papel: M?dulo do sistema de agentes do Nexus.
- Itens de c?digo encontrados: `4`

### `src/app/ai/ai-settings.ts`
- Tamanho: `7388` bytes
- Papel: M?dulo de configura??o, provedor ou roteamento de IA.
- Itens de c?digo encontrados: `7`

### `src/app/ai/context-builder.ts`
- Tamanho: `6396` bytes
- Papel: M?dulo de configura??o, provedor ou roteamento de IA.
- Itens de c?digo encontrados: `8`

### `src/app/ai/provider-router.ts`
- Tamanho: `16048` bytes
- Papel: Roteamento entre provedores de IA.
- Itens de c?digo encontrados: `18`

### `src/app/ai/providers/anthropic-provider.ts`
- Tamanho: `1884` bytes
- Papel: M?dulo de configura??o, provedor ou roteamento de IA.
- Itens de c?digo encontrados: `5`

### `src/app/ai/providers/gemini-provider.ts`
- Tamanho: `1987` bytes
- Papel: M?dulo de configura??o, provedor ou roteamento de IA.
- Itens de c?digo encontrados: `4`

### `src/app/ai/providers/groq-openrouter-provider.ts`
- Tamanho: `2921` bytes
- Papel: M?dulo de configura??o, provedor ou roteamento de IA.
- Itens de c?digo encontrados: `9`

### `src/app/ai/providers/nexus-local-provider.ts`
- Tamanho: `2428` bytes
- Papel: M?dulo de configura??o, provedor ou roteamento de IA.
- Itens de c?digo encontrados: `7`

### `src/app/ai/providers/ollama-provider.ts`
- Tamanho: `2456` bytes
- Papel: M?dulo de configura??o, provedor ou roteamento de IA.
- Itens de c?digo encontrados: `7`

### `src/app/ai/providers/openai-provider.ts`
- Tamanho: `2221` bytes
- Papel: M?dulo de configura??o, provedor ou roteamento de IA.
- Itens de c?digo encontrados: `6`

### `src/app/ai/providers/types.ts`
- Tamanho: `512` bytes
- Papel: M?dulo de configura??o, provedor ou roteamento de IA.
- Itens de c?digo encontrados: `3`

### `src/app/ai/usage-tracker.ts`
- Tamanho: `3689` bytes
- Papel: M?dulo de configura??o, provedor ou roteamento de IA.
- Itens de c?digo encontrados: `7`

### `src/app/runs/run-event-bus.ts`
- Tamanho: `1422` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `6`

### `src/app/runs/run-store.ts`
- Tamanho: `5215` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `9`

### `src/app/web/server.ts`
- Tamanho: `17186` bytes
- Papel: Servidor web modular, eventos SSE e rotas da UI.
- Itens de c?digo encontrados: `14`

### `src/app/web/staged-files.ts`
- Tamanho: `4807` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `9`

### `src/backup-store.ts`
- Tamanho: `2977` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `7`

### `src/command-runner.ts`
- Tamanho: `6901` bytes
- Papel: Executa comandos permitidos com allowlist.
- Itens de c?digo encontrados: `9`

### `src/error-analyzer.ts`
- Tamanho: `7035` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `9`

### `src/file-content-hash.ts`
- Tamanho: `307` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `2`

### `src/intent-classifier.ts`
- Tamanho: `2082` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `2`

### `src/local-security.ts`
- Tamanho: `4964` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `13`

### `src/multi-agent-coordinator.ts`
- Tamanho: `7851` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `9`

### `src/nexus-data-dir.ts`
- Tamanho: `2113` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `9`

### `src/nexus-orchestrator.ts`
- Tamanho: `838` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `2`

### `src/orchestration-mode.ts`
- Tamanho: `2316` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `2`

### `src/patch-payload.ts`
- Tamanho: `2823` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `4`

### `src/patches/backup-store.ts`
- Tamanho: `98` bytes
- Papel: M?dulo de patches, hist?rico ou valida??o.

### `src/patches/patch-applier.ts`
- Tamanho: `248` bytes
- Papel: M?dulo de patches, hist?rico ou valida??o.
- Itens de c?digo encontrados: `1`

### `src/patches/patch-history-store.ts`
- Tamanho: `3502` bytes
- Papel: M?dulo de patches, hist?rico ou valida??o.
- Itens de c?digo encontrados: `8`

### `src/patches/patch-validator.ts`
- Tamanho: `1856` bytes
- Papel: M?dulo de patches, hist?rico ou valida??o.
- Itens de c?digo encontrados: `3`

### `src/pending-actions-store.ts`
- Tamanho: `5165` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `14`

### `src/preview-security.ts`
- Tamanho: `600` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `1`

### `src/project-file-store.ts`
- Tamanho: `10566` bytes
- Papel: Leitura/escrita segura de arquivos do projeto.
- Itens de c?digo encontrados: `27`

### `src/project-inspector.ts`
- Tamanho: `7615` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `15`

### `src/project-runtime-store.ts`
- Tamanho: `1485` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `4`

### `src/rate-limit.ts`
- Tamanho: `516` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `1`

### `src/research-tools.ts`
- Tamanho: `10776` bytes
- Papel: Ferramentas de pesquisa/fetch URL com restri??es.
- Itens de c?digo encontrados: `16`

### `src/routes/ai-edits.ts`
- Tamanho: `5530` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `2`

### `src/routes/generate-site.ts`
- Tamanho: `38564` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `10`

### `src/server.ts`
- Tamanho: `53320` bytes
- Papel: Servidor Express principal e endpoints HTTP do Nexus.
- Itens de c?digo encontrados: `18`

### `src/session-store.ts`
- Tamanho: `4169` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `11`

### `src/templates/blog/index.html`
- Tamanho: `4217` bytes
- Papel: UI/asset textual de frontend.

### `src/templates/ecommerce/index.html`
- Tamanho: `9611` bytes
- Papel: UI/asset textual de frontend.

### `src/templates/landing-page/index.html`
- Tamanho: `8708` bytes
- Papel: UI/asset textual de frontend.

### `src/templates/portfolio/index.html`
- Tamanho: `7038` bytes
- Papel: UI/asset textual de frontend.

### `src/workspace-store.ts`
- Tamanho: `5103` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `12`

### `test_api.cjs`
- Tamanho: `502` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.

### `tests/action-executor.test.ts`
- Tamanho: `5173` bytes
- Papel: Teste automatizado ou fixture de valida??o.
- Itens de c?digo encontrados: `1`

### `tests/action-planner-extended.test.ts`
- Tamanho: `7931` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/action-planner.test.ts`
- Tamanho: `1756` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/active-project-boundary.test.ts`
- Tamanho: `5217` bytes
- Papel: Teste automatizado ou fixture de valida??o.
- Itens de c?digo encontrados: `1`

### `tests/agent-events-sse.test.ts`
- Tamanho: `2462` bytes
- Papel: Teste automatizado ou fixture de valida??o.
- Itens de c?digo encontrados: `1`

### `tests/agent-routing.test.ts`
- Tamanho: `1531` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/ai-edits.test.ts`
- Tamanho: `3609` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/ai-settings-security.test.ts`
- Tamanho: `1825` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/backup-path-safety.test.ts`
- Tamanho: `5246` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/backup-store.test.ts`
- Tamanho: `2098` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/code-generation-quality.test.ts`
- Tamanho: `3966` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/command-runner.test.ts`
- Tamanho: `4258` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/context-builder.test.ts`
- Tamanho: `1500` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/editor-selection-actions.test.ts`
- Tamanho: `7757` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/error-analyzer.test.ts`
- Tamanho: `5971` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/generate-site.test.ts`
- Tamanho: `5757` bytes
- Papel: Teste automatizado ou fixture de valida??o.
- Itens de c?digo encontrados: `2`

### `tests/helpers.ts`
- Tamanho: `252` bytes
- Papel: Teste automatizado ou fixture de valida??o.
- Itens de c?digo encontrados: `2`

### `tests/local-security.test.ts`
- Tamanho: `4495` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/nexus-data-dir.test.ts`
- Tamanho: `997` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/patch-payload.test.ts`
- Tamanho: `3030` bytes
- Papel: Teste automatizado ou fixture de valida??o.
- Itens de c?digo encontrados: `1`

### `tests/patches-api.test.ts`
- Tamanho: `2414` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/patches-flow.test.ts`
- Tamanho: `3520` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/pending-actions-concurrency.test.ts`
- Tamanho: `1382` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/preview.test.ts`
- Tamanho: `3214` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/project-file-store.test.ts`
- Tamanho: `2546` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/provider-router.test.ts`
- Tamanho: `2687` bytes
- Papel: Teste automatizado ou fixture de valida??o.
- Itens de c?digo encontrados: `2`

### `tests/research-tools-security.test.ts`
- Tamanho: `730` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/run-event-bus.test.ts`
- Tamanho: `1305` bytes
- Papel: Teste automatizado ou fixture de valida??o.
- Itens de c?digo encontrados: `1`

### `tests/run-store.test.ts`
- Tamanho: `3524` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `tests/smoke.test.ts`
- Tamanho: `2998` bytes
- Papel: Teste automatizado ou fixture de valida??o.

### `TODO.md`
- Tamanho: `922` bytes
- Papel: Documenta??o do projeto.

### `tsconfig.electron.json`
- Tamanho: `70` bytes
- Papel: Arquivo de configura??o.

### `tsconfig.json`
- Tamanho: `360` bytes
- Papel: Arquivo de configura??o.

### `workspace/public/index.html`
- Tamanho: `736` bytes
- Papel: UI/asset textual de frontend.

### `workspace/src/app.ts`
- Tamanho: `36` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `1`

### `workspace/src/demo.ts`
- Tamanho: `88` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `1`

### `workspace/src/nexus-flow-7398c6f5.ts`
- Tamanho: `84` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `1`

### `workspace/src/nexus-flow.ts`
- Tamanho: `84` bytes
- Papel: Arquivo de c?digo ou suporte do projeto.
- Itens de c?digo encontrados: `1`

## Invent?rio de Fun??es, Classes e M?todos

### `NexusAI/app.py`
- Linha 106 ? `function` ? `validate_payload`: valida entrada ou sa?da relacionado a `validate_payload`.
- Linha 142 ? `function` ? `has_checkpoint`: executa a l?gica associada a `has_checkpoint`.
- Linha 151 ? `function` ? `generation_config_path`: executa a l?gica associada a `generation_config_path`.
- Linha 164 ? `function` ? `health`: executa a l?gica associada a `health`.
- Linha 168 ? `function` ? `generate_code`: gera artefato/sa?da relacionado a `generate_code`.
- Linha 200 ? `function` ? `generate_controlled_code`: gera artefato/sa?da relacionado a `generate_controlled_code`.
- Linha 219 ? `function` ? `repo_index`: executa a l?gica associada a `repo_index`.
- Linha 230 ? `function` ? `repo_context`: executa a l?gica associada a `repo_context`.
- Linha 241 ? `function` ? `repo_task`: executa a l?gica associada a `repo_task`.
- Linha 260 ? `function` ? `repo_test`: executa a l?gica associada a `repo_test`.
- Linha 271 ? `function` ? `repo_apply`: executa a l?gica associada a `repo_apply`.
- Linha 299 ? `function` ? `repo_rollback`: executa a l?gica associada a `repo_rollback`.
- Linha 310 ? `function` ? `internal_command`: executa a l?gica associada a `internal_command`.
- Linha 321 ? `function` ? `metrics_tasks`: executa a l?gica associada a `metrics_tasks`.
- Linha 325 ? `function` ? `replay_task_session`: executa a l?gica associada a `replay_task_session`.
- Linha 332 ? `function` ? `failures_ranking`: executa a l?gica associada a `failures_ranking`.
- Linha 337 ? `function` ? `openapi_spec`: executa a l?gica associada a `openapi_spec`.

### `NexusAI/build_instruction_pairs_premium.py`
- Linha 422 ? `function` ? `write_pair`: grava conte?do relacionado a `write_pair`.
- Linha 429 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/build_pro_quality_curriculum.py`
- Linha 734 ? `function` ? `write_file`: grava conte?do relacionado a `write_file`.
- Linha 740 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/cloud_train.py`
- Linha 11 ? `function` ? `run`: executa fluxo ou comando relacionado a `run`.
- Linha 16 ? `function` ? `print_device_info`: executa a l?gica associada a `print_device_info`.
- Linha 28 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/command_sandbox.py`
- Linha 49 ? `function` ? `tokenize`: executa a l?gica associada a `tokenize`.
- Linha 56 ? `function` ? `is_command_allowed`: executa a l?gica associada a `is_command_allowed`.
- Linha 74 ? `function` ? `run_sandboxed_command`: executa fluxo ou comando relacionado a `run_sandboxed_command`.
- Linha 92 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/compare_evaluations.py`
- Linha 10 ? `function` ? `load`: carrega dados de disco ou mem?ria relacionado a `load`.
- Linha 21 ? `function` ? `case_scores`: executa a l?gica associada a `case_scores`.
- Linha 25 ? `function` ? `metric_delta`: executa a l?gica associada a `metric_delta`.
- Linha 29 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/context_budget.py`
- Linha 18 ? `function` ? `trim_text`: executa a l?gica associada a `trim_text`.
- Linha 26 ? `function` ? `apply_context_budget`: aplica altera??o relacionado a `apply_context_budget`.
- Linha 57 ? `function` ? `default_budget_for_project`: executa a l?gica associada a `default_budget_for_project`.

### `NexusAI/controlled_generate.py`
- Linha 18 ? `function` ? `strip_code_fence`: executa a l?gica associada a `strip_code_fence`.
- Linha 30 ? `function` ? `repair_prompt`: executa a l?gica associada a `repair_prompt`.
- Linha 65 ? `function` ? `extract_user_request`: executa a l?gica associada a `extract_user_request`.
- Linha 72 ? `function` ? `extract_affected_files`: executa a l?gica associada a `extract_affected_files`.
- Linha 82 ? `function` ? `deterministic_patch_review`: executa a l?gica associada a `deterministic_patch_review`.
- Linha 128 ? `function` ? `controlled_generate`: executa a l?gica associada a `controlled_generate`.
- Linha 212 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/corpus_builder.py`
- Linha 55 ? `function` ? `repo_slug`: executa a l?gica associada a `repo_slug`.
- Linha 60 ? `function` ? `run_git`: executa fluxo ou comando relacionado a `run_git`.
- Linha 72 ? `function` ? `ensure_repo`: garante pr?-condi??o/estrutura relacionado a `ensure_repo`.
- Linha 81 ? `function` ? `should_skip_path`: executa a l?gica associada a `should_skip_path`.
- Linha 90 ? `function` ? `looks_like_secret_line`: executa a l?gica associada a `looks_like_secret_line`.
- Linha 95 ? `function` ? `file_quality_ok`: executa a l?gica associada a `file_quality_ok`.
- Linha 124 ? `function` ? `content_hash`: executa a l?gica associada a `content_hash`.
- Linha 128 ? `function` ? `copy_corpus_file`: executa a l?gica associada a `copy_corpus_file`.
- Linha 136 ? `function` ? `build_corpus`: constr?i uma estrutura/resultado relacionado a `build_corpus`.
- Linha 196 ? `function` ? `parse_args`: interpreta texto/dados relacionado a `parse_args`.
- Linha 215 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/dataset_cleaner.py`
- Linha 42 ? `function` ? `is_secret`: executa a l?gica associada a `is_secret`.
- Linha 45 ? `function` ? `file_fingerprint`: executa a l?gica associada a `file_fingerprint`.
- Linha 52 ? `function` ? `clean_file`: Return True if file was kept, False if discarded.
- Linha 84 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/dependency_guard.py`
- Linha 9 ? `function` ? `normalize_requirement`: executa a l?gica associada a `normalize_requirement`.
- Linha 16 ? `function` ? `requirements_deps`: executa a l?gica associada a `requirements_deps`.
- Linha 20 ? `function` ? `package_json_deps`: executa a l?gica associada a `package_json_deps`.
- Linha 33 ? `function` ? `added_dependencies`: executa a l?gica associada a `added_dependencies`.

### `NexusAI/evaluate_generation_quality.py`
- Linha 26 ? `class` ? `EvalCase`: define estrutura/servi?o `EvalCase` e agrupa comportamento relacionado.
- Linha 42 ? `class` ? `SimpleHTMLChecker`: define estrutura/servi?o `SimpleHTMLChecker` e agrupa comportamento relacionado.
- Linha 43 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 48 ? `function` ? `handle_starttag`: trata evento ou requisi??o relacionado a `handle_starttag`.
- Linha 52 ? `function` ? `handle_endtag`: trata evento ou requisi??o relacionado a `handle_endtag`.
- Linha 62 ? `function` ? `load_cases`: carrega dados de disco ou mem?ria relacionado a `load_cases`.
- Linha 77 ? `function` ? `generated_part`: executa a l?gica associada a `generated_part`.
- Linha 81 ? `function` ? `repetition_metrics`: executa a l?gica associada a `repetition_metrics`.
- Linha 95 ? `function` ? `syntax_metrics`: executa a l?gica associada a `syntax_metrics`.
- Linha 137 ? `function` ? `structure_score`: executa a l?gica associada a `structure_score`.
- Linha 170 ? `function` ? `score_output`: executa a l?gica associada a `score_output`.
- Linha 215 ? `function` ? `aggregate_results`: executa a l?gica associada a `aggregate_results`.
- Linha 235 ? `function` ? `aggregate_by_category`: executa a l?gica associada a `aggregate_by_category`.
- Linha 244 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/export_failures_to_gold.py`
- Linha 16 ? `function` ? `fetch_corrected_failures`: executa a l?gica associada a `fetch_corrected_failures`.
- Linha 34 ? `function` ? `render_examples`: gera sa?da visual/textual relacionado a `render_examples`.
- Linha 67 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/export_for_cloud.py`
- Linha 27 ? `function` ? `normalized_rel`: executa a l?gica associada a `normalized_rel`.
- Linha 31 ? `function` ? `should_exclude`: executa a l?gica associada a `should_exclude`.
- Linha 41 ? `function` ? `create_bundle`: cria recurso ou registro relacionado a `create_bundle`.
- Linha 62 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/failure_ranking.py`
- Linha 14 ? `function` ? `normalize_failure_type`: executa a l?gica associada a `normalize_failure_type`.
- Linha 23 ? `function` ? `top_failures`: executa a l?gica associada a `top_failures`.
- Linha 46 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/failure_store.py`
- Linha 14 ? `function` ? `ensure_failures_table`: garante pr?-condi??o/estrutura relacionado a `ensure_failures_table`.
- Linha 33 ? `function` ? `add_failure`: executa a l?gica associada a `add_failure`.

### `NexusAI/freeze_release.py`
- Linha 15 ? `function` ? `latest_file`: executa a l?gica associada a `latest_file`.
- Linha 20 ? `function` ? `copy_file`: executa a l?gica associada a `copy_file`.
- Linha 28 ? `function` ? `dataset_stats`: executa a l?gica associada a `dataset_stats`.
- Linha 60 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/fullstack_corpus_builder.py`
- Linha 74 ? `function` ? `content_hash`: executa a l?gica associada a `content_hash`.
- Linha 78 ? `function` ? `safe_name`: executa a l?gica associada a `safe_name`.
- Linha 82 ? `function` ? `should_skip_path`: executa a l?gica associada a `should_skip_path`.
- Linha 93 ? `function` ? `looks_minified`: executa a l?gica associada a `looks_minified`.
- Linha 102 ? `function` ? `has_secret_marker`: executa a l?gica associada a `has_secret_marker`.
- Linha 107 ? `function` ? `is_quality_candidate`: executa a l?gica associada a `is_quality_candidate`.
- Linha 113 ? `function` ? `read_quality_file`: l? conte?do relacionado a `read_quality_file`.
- Linha 146 ? `function` ? `copy_file`: executa a l?gica associada a `copy_file`.
- Linha 154 ? `function` ? `build_from_roots`: constr?i uma estrutura/resultado relacionado a `build_from_roots`.
- Linha 222 ? `function` ? `parse_args`: interpreta texto/dados relacionado a `parse_args`.
- Linha 251 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/git_tools.py`
- Linha 13 ? `function` ? `run_git`: executa fluxo ou comando relacionado a `run_git`.
- Linha 25 ? `function` ? `git_status`: executa a l?gica associada a `git_status`.
- Linha 29 ? `function` ? `git_diff`: executa a l?gica associada a `git_diff`.
- Linha 33 ? `function` ? `git_recent_log`: executa a l?gica associada a `git_recent_log`.
- Linha 37 ? `function` ? `commit_message_from_diff`: executa a l?gica associada a `commit_message_from_diff`.
- Linha 57 ? `function` ? `git_summary`: executa a l?gica associada a `git_summary`.
- Linha 67 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/infer.py`
- Linha 21 ? `function` ? `load_config`: carrega dados de disco ou mem?ria relacionado a `load_config`.
- Linha 26 ? `function` ? `resolve_path`: resolve caminho, configura??o ou refer?ncia relacionado a `resolve_path`.
- Linha 31 ? `function` ? `clean_text`: Remove control tokens and ByteLevel marker artifacts.
- Linha 41 ? `function` ? `apply_few_shot_template`: aplica altera??o relacionado a `apply_few_shot_template`.
- Linha 53 ? `function` ? `apply_instruction_template`: aplica altera??o relacionado a `apply_instruction_template`.
- Linha 57 ? `function` ? `strip_few_shot_prefix`: executa a l?gica associada a `strip_few_shot_prefix`.
- Linha 66 ? `function` ? `strip_training_markers`: Remove leaked dataset boundary markers from generated output.
- Linha 77 ? `function` ? `get_latest_checkpoint`: obt?m ou monta dados relacionado a `get_latest_checkpoint`.
- Linha 82 ? `function` ? `load_runtime`: carrega dados de disco ou mem?ria relacionado a `load_runtime`.
- Linha 119 ? `function` ? `sample_next_token`: executa a l?gica associada a `sample_next_token`.
- Linha 144 ? `function` ? `generate_text`: gera artefato/sa?da relacionado a `generate_text`.
- Linha 219 ? `function` ? `run_generation`: Generate code for the Flask API.
- Linha 244 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/instruction_dataset_builder.py`
- Linha 32 ? `function` ? `language_for`: executa a l?gica associada a `language_for`.
- Linha 36 ? `function` ? `normalize_content`: executa a l?gica associada a `normalize_content`.
- Linha 41 ? `function` ? `quality_for`: executa a l?gica associada a `quality_for`.
- Linha 51 ? `function` ? `build_record`: constr?i uma estrutura/resultado relacionado a `build_record`.
- Linha 67 ? `function` ? `build_instruction_record`: constr?i uma estrutura/resultado relacionado a `build_instruction_record`.
- Linha 85 ? `function` ? `build_instruction_dataset`: constr?i uma estrutura/resultado relacionado a `build_instruction_dataset`.
- Linha 135 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/memory_store.py`
- Linha 25 ? `class` ? `Memory`: define estrutura/servi?o `Memory` e agrupa comportamento relacionado.
- Linha 38 ? `function` ? `utc_now`: executa a l?gica associada a `utc_now`.
- Linha 42 ? `function` ? `normalize_tag`: executa a l?gica associada a `normalize_tag`.
- Linha 46 ? `function` ? `parse_tags`: interpreta texto/dados relacionado a `parse_tags`.
- Linha 56 ? `function` ? `connect`: executa a l?gica associada a `connect`.
- Linha 64 ? `function` ? `resolve_memory_path`: resolve caminho, configura??o ou refer?ncia relacionado a `resolve_memory_path`.
- Linha 72 ? `function` ? `ensure_db`: garante pr?-condi??o/estrutura relacionado a `ensure_db`.
- Linha 106 ? `function` ? `row_to_memory`: executa a l?gica associada a `row_to_memory`.
- Linha 121 ? `function` ? `add_memory`: Insert or update one memory fact.
- Linha 164 ? `function` ? `add_interaction`: executa a l?gica associada a `add_interaction`.
- Linha 179 ? `function` ? `recent_interactions`: executa a l?gica associada a `recent_interactions`.
- Linha 189 ? `function` ? `tokenize_query`: executa a l?gica associada a `tokenize_query`.
- Linha 197 ? `function` ? `memory_score`: executa a l?gica associada a `memory_score`.
- Linha 204 ? `function` ? `search_memories`: executa a l?gica associada a `search_memories`.
- Linha 232 ? `function` ? `build_memory_context`: constr?i uma estrutura/resultado relacionado a `build_memory_context`.
- Linha 260 ? `function` ? `augment_prompt`: executa a l?gica associada a `augment_prompt`.
- Linha 267 ? `function` ? `seed_default_memories`: executa a l?gica associada a `seed_default_memories`.
- Linha 316 ? `function` ? `print_memories`: executa a l?gica associada a `print_memories`.
- Linha 323 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/model.py`
- Linha 5 ? `class` ? `TinyTransformer`: Tiny decoder‑only transformer (~10‑50 M parameters). Designed for low‑VRAM environments: * Uses `torch.float16` (mixed precision) when a CUDA device is available. * Supports gradient checkpointing via `torch.utils.checkp
- Linha 13 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 45 ? `function` ? `_reset_parameters`: executa a l?gica associada a `_reset_parameters`.
- Linha 51 ? `function` ? `forward`: Forward pass. Args: input_ids: Tensor of shape (batch, seq_len) with token ids. Returns: logits of shape (batch, seq_len, vocab_size).
- Linha 73 ? `function` ? `layer_forward`: executa a l?gica associada a `layer_forward`.
- Linha 83 ? `function` ? `configure_fp16`: Enable mixed‑precision (fp16) for CUDA devices. The model will be cast to `torch.float16` when moved to GPU.
- Linha 93 ? `function` ? `enable_gradient_checkpointing`: executa a l?gica associada a `enable_gradient_checkpointing`.
- Linha 96 ? `function` ? `count_parameters`: executa a l?gica associada a `count_parameters`.

### `NexusAI/model_review_fix_report.py`
- Linha 17 ? `function` ? `latest_real_task_report`: executa a l?gica associada a `latest_real_task_report`.
- Linha 22 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/nexus_commands.py`
- Linha 20 ? `function` ? `split_command`: executa a l?gica associada a `split_command`.
- Linha 28 ? `function` ? `run_internal_command`: executa fluxo ou comando relacionado a `run_internal_command`.
- Linha 88 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/nexus_status.py`
- Linha 26 ? `function` ? `active_training_processes`: executa a l?gica associada a `active_training_processes`.
- Linha 45 ? `function` ? `latest_train_log`: executa a l?gica associada a `latest_train_log`.
- Linha 50 ? `function` ? `parse_log`: interpreta texto/dados relacionado a `parse_log`.
- Linha 78 ? `function` ? `checkpoint_status`: executa a l?gica associada a `checkpoint_status`.
- Linha 90 ? `function` ? `memory_status`: executa a l?gica associada a `memory_status`.
- Linha 102 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/patch_manager.py`
- Linha 16 ? `function` ? `safe_project_path`: executa a l?gica associada a `safe_project_path`.
- Linha 26 ? `function` ? `read_text_if_exists`: l? conte?do relacionado a `read_text_if_exists`.
- Linha 32 ? `function` ? `unified_diff`: executa a l?gica associada a `unified_diff`.
- Linha 43 ? `function` ? `load_history`: carrega dados de disco ou mem?ria relacionado a `load_history`.
- Linha 50 ? `function` ? `save_history`: persiste dados relacionado a `save_history`.
- Linha 56 ? `function` ? `apply_file_changes`: aplica altera??o relacionado a `apply_file_changes`.
- Linha 114 ? `function` ? `rollback_last`: executa a l?gica associada a `rollback_last`.
- Linha 141 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/post_train_report.py`
- Linha 22 ? `function` ? `wait_for_training`: executa a l?gica associada a `wait_for_training`.
- Linha 36 ? `function` ? `latest_eval_file`: executa a l?gica associada a `latest_eval_file`.
- Linha 47 ? `function` ? `run_evaluation`: executa fluxo ou comando relacionado a `run_evaluation`.
- Linha 68 ? `function` ? `previous_eval_file`: executa a l?gica associada a `previous_eval_file`.
- Linha 74 ? `function` ? `summarize_eval`: executa a l?gica associada a `summarize_eval`.
- Linha 94 ? `function` ? `write_report`: grava conte?do relacionado a `write_report`.
- Linha 150 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/preview_writer.py`
- Linha 16 ? `function` ? `safe_slug`: executa a l?gica associada a `safe_slug`.
- Linha 21 ? `function` ? `write_html_preview`: grava conte?do relacionado a `write_html_preview`.

### `NexusAI/project_docs.py`
- Linha 17 ? `function` ? `detect_routes`: detecta padr?o ou stack relacionado a `detect_routes`.
- Linha 28 ? `function` ? `detect_database`: detecta padr?o ou stack relacionado a `detect_database`.
- Linha 39 ? `function` ? `generate_project_docs`: gera artefato/sa?da relacionado a `generate_project_docs`.
- Linha 93 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/project_report.py`
- Linha 21 ? `function` ? `latest_file`: executa a l?gica associada a `latest_file`.
- Linha 26 ? `function` ? `load_eval`: carrega dados de disco ou mem?ria relacionado a `load_eval`.
- Linha 32 ? `function` ? `dataset_summary`: executa a l?gica associada a `dataset_summary`.
- Linha 64 ? `function` ? `eval_summary`: executa a l?gica associada a `eval_summary`.
- Linha 76 ? `function` ? `roadmap_excerpt`: executa a l?gica associada a `roadmap_excerpt`.
- Linha 86 ? `function` ? `write_report`: grava conte?do relacionado a `write_report`.
- Linha 228 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/real_task_runner.py`
- Linha 30 ? `function` ? `status_from`: executa a l?gica associada a `status_from`.
- Linha 36 ? `function` ? `task_analyze`: executa a l?gica associada a `task_analyze`.
- Linha 43 ? `function` ? `task_context`: executa a l?gica associada a `task_context`.
- Linha 51 ? `function` ? `task_run_tests`: executa a l?gica associada a `task_run_tests`.
- Linha 58 ? `function` ? `task_generate_docs`: executa a l?gica associada a `task_generate_docs`.
- Linha 66 ? `function` ? `task_sandbox`: executa a l?gica associada a `task_sandbox`.
- Linha 76 ? `function` ? `task_dependency_guard`: executa a l?gica associada a `task_dependency_guard`.
- Linha 84 ? `function` ? `task_patch_rollback`: executa a l?gica associada a `task_patch_rollback`.
- Linha 101 ? `function` ? `task_strict`: executa a l?gica associada a `task_strict`.
- Linha 107 ? `function` ? `task_model_review`: executa a l?gica associada a `task_model_review`.
- Linha 135 ? `function` ? `build_tasks`: constr?i uma estrutura/resultado relacionado a `build_tasks`.
- Linha 246 ? `function` ? `classify_failure`: classifica entrada relacionado a `classify_failure`.
- Linha 262 ? `function` ? `run_task`: executa fluxo ou comando relacionado a `run_task`.
- Linha 295 ? `function` ? `summarize`: executa a l?gica associada a `summarize`.
- Linha 313 ? `function` ? `write_report`: grava conte?do relacionado a `write_report`.
- Linha 376 ? `function` ? `run_real_task_suite`: executa fluxo ou comando relacionado a `run_real_task_suite`.
- Linha 430 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/repo_benchmark.py`
- Linha 71 ? `function` ? `write_fixture`: grava conte?do relacionado a `write_fixture`.
- Linha 81 ? `function` ? `ensure_fixtures`: garante pr?-condi??o/estrutura relacionado a `ensure_fixtures`.
- Linha 92 ? `function` ? `score_context`: executa a l?gica associada a `score_context`.
- Linha 104 ? `function` ? `run_repo_benchmark`: executa fluxo ou comando relacionado a `run_repo_benchmark`.
- Linha 147 ? `function` ? `write_report`: grava conte?do relacionado a `write_report`.
- Linha 183 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/repo_indexer.py`
- Linha 64 ? `class` ? `FileInfo`: define estrutura/servi?o `FileInfo` e agrupa comportamento relacionado.
- Linha 71 ? `function` ? `resolve_project_dir`: resolve caminho, configura??o ou refer?ncia relacionado a `resolve_project_dir`.
- Linha 78 ? `function` ? `is_ignored`: executa a l?gica associada a `is_ignored`.
- Linha 86 ? `function` ? `iter_project_files`: executa a l?gica associada a `iter_project_files`.
- Linha 104 ? `function` ? `read_small_text`: l? conte?do relacionado a `read_small_text`.
- Linha 112 ? `function` ? `detect_stack`: detecta padr?o ou stack relacionado a `detect_stack`.
- Linha 139 ? `function` ? `detect_entrypoints`: detecta padr?o ou stack relacionado a `detect_entrypoints`.
- Linha 161 ? `function` ? `important_files`: executa a l?gica associada a `important_files`.
- Linha 178 ? `function` ? `write_default_docs`: grava conte?do relacionado a `write_default_docs`.
- Linha 217 ? `function` ? `build_project_index`: constr?i uma estrutura/resultado relacionado a `build_project_index`.
- Linha 255 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/repo_mode.py`
- Linha 31 ? `function` ? `select_relevant_files`: executa a l?gica associada a `select_relevant_files`.
- Linha 65 ? `function` ? `build_repo_context`: constr?i uma estrutura/resultado relacionado a `build_repo_context`.
- Linha 83 ? `function` ? `repo_prompt`: executa a l?gica associada a `repo_prompt`.
- Linha 106 ? `function` ? `run_repo_task`: executa fluxo ou comando relacionado a `run_repo_task`.
- Linha 145 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/run_controlled_battery.py`
- Linha 19 ? `function` ? `classify_failure`: classifica entrada relacionado a `classify_failure`.
- Linha 43 ? `function` ? `write_markdown`: grava conte?do relacionado a `write_markdown`.
- Linha 83 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/src/api.py`
- Linha 26 ? `class` ? `ChatRequest`: define estrutura/servi?o `ChatRequest` e agrupa comportamento relacionado.
- Linha 35 ? `class` ? `ChatResponse`: define estrutura/servi?o `ChatResponse` e agrupa comportamento relacionado.
- Linha 40 ? `function` ? `chat`: executa a l?gica associada a `chat`.
- Linha 93 ? `function` ? `clear_cache_endpoint`: executa a l?gica associada a `clear_cache_endpoint`.

### `NexusAI/src/cache.ts`
- Linha 9 ? `class` ? `FileCache`: define estrutura/servi?o `FileCache` e agrupa comportamento relacionado.
- Linha 15 ? `method` ? `constructor`: m?todo `constructor` da classe, usado no comportamento interno do objeto.
- Linha 23 ? `method` ? `ensureCacheDir`: garante pr?-condi??o/estrutura relacionado a `ensureCacheDir`.
- Linha 29 ? `method` ? `loadIndex`: carrega dados de disco ou mem?ria relacionado a `loadIndex`.
- Linha 41 ? `method` ? `saveIndex`: persiste dados relacionado a `saveIndex`.
- Linha 45 ? `method` ? `pruneIfNeeded`: m?todo `pruneIfNeeded` da classe, usado no comportamento interno do objeto.
- Linha 60 ? `method` ? `get`: obt?m ou monta dados relacionado a `get`.
- Linha 72 ? `method` ? `set`: atualiza estado ou configura??o relacionado a `set`.

### `NexusAI/src/cache_py.py`
- Linha 9 ? `function` ? `_load_cache`: executa a l?gica associada a `_load_cache`.
- Linha 17 ? `function` ? `_save_cache`: executa a l?gica associada a `_save_cache`.
- Linha 20 ? `function` ? `get`: obt?m ou monta dados relacionado a `get`.
- Linha 23 ? `function` ? `set`: atualiza estado ou configura??o relacionado a `set`.
- Linha 28 ? `function` ? `clear`: executa a l?gica associada a `clear`.

### `NexusAI/src/context.py`
- Linha 7 ? `function` ? `_ensure_db`: executa a l?gica associada a `_ensure_db`.
- Linha 24 ? `function` ? `add_message`: Insert a new message into the conversation history. Args: role: "user" or "assistant" content: Text of the message
- Linha 41 ? `function` ? `get_recent`: Return the last *n* messages as a list of (role, content) tuples. Ordered from oldest to newest.

### `NexusAI/src/i18n.py`
- Linha 6 ? `function` ? `_load_config`: executa a l?gica associada a `_load_config`.
- Linha 16 ? `function` ? `translate_text`: Translate *text* to *target* language using LibreTranslate. Returns original text if target not supported or on error.

### `NexusAI/strict_mode.py`
- Linha 13 ? `class` ? `StrictResult`: define estrutura/servi?o `StrictResult` e agrupa comportamento relacionado.
- Linha 19 ? `function` ? `strict_check_text`: executa a l?gica associada a `strict_check_text`.
- Linha 45 ? `function` ? `strict_check_operation`: executa a l?gica associada a `strict_check_operation`.

### `NexusAI/study_fullstack_until.py`
- Linha 9 ? `function` ? `run`: executa fluxo ou comando relacionado a `run`.
- Linha 14 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/study_instruct_until.py`
- Linha 9 ? `function` ? `run`: executa fluxo ou comando relacionado a `run`.
- Linha 14 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/study_until.py`
- Linha 9 ? `function` ? `run`: executa fluxo ou comando relacionado a `run`.
- Linha 14 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/task_metrics.py`
- Linha 20 ? `function` ? `now_iso`: executa a l?gica associada a `now_iso`.
- Linha 24 ? `function` ? `ensure_task_tables`: garante pr?-condi??o/estrutura relacionado a `ensure_task_tables`.
- Linha 57 ? `function` ? `start_session`: inicia fluxo/processo relacionado a `start_session`.
- Linha 71 ? `function` ? `log_event`: executa a l?gica associada a `log_event`.
- Linha 84 ? `function` ? `finish_session`: executa a l?gica associada a `finish_session`.
- Linha 109 ? `function` ? `task_success_summary`: executa a l?gica associada a `task_success_summary`.
- Linha 141 ? `function` ? `replay_session`: executa a l?gica associada a `replay_session`.
- Linha 165 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/task_router.py`
- Linha 9 ? `class` ? `TaskRoute`: define estrutura/servi?o `TaskRoute` e agrupa comportamento relacionado.
- Linha 128 ? `function` ? `classify_task`: classifica entrada relacionado a `classify_task`.
- Linha 147 ? `function` ? `build_controlled_prompt`: constr?i uma estrutura/resultado relacionado a `build_controlled_prompt`.

### `NexusAI/test_controlled_components.py`
- Linha 28 ? `class` ? `ControlledComponentsTest`: define estrutura/servi?o `ControlledComponentsTest` e agrupa comportamento relacionado.
- Linha 29 ? `function` ? `test_task_router`: executa a l?gica associada a `test_task_router`.
- Linha 42 ? `function` ? `test_validators_accept_good_outputs`: executa a l?gica associada a `test_validators_accept_good_outputs`.
- Linha 67 ? `function` ? `test_preview_writer`: executa a l?gica associada a `test_preview_writer`.
- Linha 73 ? `function` ? `test_failure_store_init`: executa a l?gica associada a `test_failure_store_init`.
- Linha 76 ? `function` ? `test_flask_validation_routes`: executa a l?gica associada a `test_flask_validation_routes`.
- Linha 83 ? `function` ? `test_repo_mode_index_patch_test_and_rollback`: executa a l?gica associada a `test_repo_mode_index_patch_test_and_rollback`.
- Linha 118 ? `function` ? `test_dependency_guard_blocks_new_requirements`: executa a l?gica associada a `test_dependency_guard_blocks_new_requirements`.
- Linha 126 ? `function` ? `test_metrics_replay_strict_and_sandbox`: executa a l?gica associada a `test_metrics_replay_strict_and_sandbox`.
- Linha 137 ? `function` ? `test_project_docs_git_helpers_and_api_metrics`: executa a l?gica associada a `test_project_docs_git_helpers_and_api_metrics`.

### `NexusAI/test_runner.py`
- Linha 16 ? `function` ? `run_command`: executa fluxo ou comando relacionado a `run_command`.
- Linha 45 ? `function` ? `package_scripts`: executa a l?gica associada a `package_scripts`.
- Linha 56 ? `function` ? `choose_test_commands`: executa a l?gica associada a `choose_test_commands`.
- Linha 83 ? `function` ? `run_project_tests`: executa fluxo ou comando relacionado a `run_project_tests`.
- Linha 98 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/tokenizer_train.py`
- Linha 10 ? `function` ? `load_config`: carrega dados de disco ou mem?ria relacionado a `load_config`.
- Linha 15 ? `function` ? `resolve_path`: resolve caminho, configura??o ou refer?ncia relacionado a `resolve_path`.
- Linha 20 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/train.py`
- Linha 28 ? `function` ? `resolve_path`: resolve caminho, configura??o ou refer?ncia relacionado a `resolve_path`.
- Linha 33 ? `function` ? `load_config`: carrega dados de disco ou mem?ria relacionado a `load_config`.
- Linha 38 ? `function` ? `should_early_stop`: executa a l?gica associada a `should_early_stop`.
- Linha 49 ? `function` ? `parse_stop_at`: interpreta texto/dados relacionado a `parse_stop_at`.
- Linha 69 ? `class` ? `CodeDataset`: Tokenizes all files in a directory and returns next-token chunks.
- Linha 72 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 82 ? `function` ? `__len__`: executa a l?gica associada a `__len__`.
- Linha 85 ? `function` ? `__getitem__`: executa a l?gica associada a `__getitem__`.
- Linha 94 ? `function` ? `collate_fn`: executa a l?gica associada a `collate_fn`.
- Linha 101 ? `function` ? `save_checkpoint`: persiste dados relacionado a `save_checkpoint`.
- Linha 114 ? `function` ? `main`: executa a l?gica associada a `main`.

### `NexusAI/validators.py`
- Linha 13 ? `class` ? `ValidationResult`: define estrutura/servi?o `ValidationResult` e agrupa comportamento relacionado.
- Linha 18 ? `function` ? `add_error`: executa a l?gica associada a `add_error`.
- Linha 23 ? `class` ? `HTMLBalanceParser`: define estrutura/servi?o `HTMLBalanceParser` e agrupa comportamento relacionado.
- Linha 24 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 29 ? `function` ? `handle_starttag`: trata evento ou requisi??o relacionado a `handle_starttag`.
- Linha 33 ? `function` ? `handle_endtag`: trata evento ou requisi??o relacionado a `handle_endtag`.
- Linha 43 ? `function` ? `common_checks`: executa a l?gica associada a `common_checks`.
- Linha 53 ? `function` ? `validate_html`: valida entrada ou sa?da relacionado a `validate_html`.
- Linha 72 ? `function` ? `validate_python`: valida entrada ou sa?da relacionado a `validate_python`.
- Linha 94 ? `function` ? `validate_typescript`: valida entrada ou sa?da relacionado a `validate_typescript`.
- Linha 119 ? `function` ? `looks_like_html_task`: executa a l?gica associada a `looks_like_html_task`.
- Linha 124 ? `function` ? `validate_patch_review`: valida entrada ou sa?da relacionado a `validate_patch_review`.
- Linha 145 ? `function` ? `validate_json`: valida entrada ou sa?da relacionado a `validate_json`.
- Linha 155 ? `function` ? `validate_output`: valida entrada ou sa?da relacionado a `validate_output`.

### `NexusAI/web/src/App.jsx`
- Linha 5 ? `function` ? `App`: executa a l?gica associada a `App`.
- Linha 12 ? `const function` ? `sendMessage`: executa a l?gica associada a `sendMessage`.

### `NexusAI/web/src/counter.ts`
- Linha 1 ? `function` ? `setupCounter`: executa a l?gica associada a `setupCounter`.
- Linha 3 ? `const function` ? `setCounter`: atualiza estado ou configura??o relacionado a `setCounter`.

### `frontend/src/App.tsx`
- Linha 111 ? `const function` ? `startLoadingAnimation`: inicia fluxo/processo relacionado a `startLoadingAnimation`.
- Linha 121 ? `const function` ? `stopLoadingAnimation`: para fluxo/processo relacionado a `stopLoadingAnimation`.
- Linha 126 ? `const function` ? `handleGenerate`: trata evento ou requisi??o relacionado a `handleGenerate`.
- Linha 157 ? `const function` ? `makeRequest`: executa a l?gica associada a `makeRequest`.
- Linha 204 ? `const function` ? `copyDeployUrl`: executa a l?gica associada a `copyDeployUrl`.

### `llm-training/01_nanogpt/config.py`
- Linha 12 ? `class` ? `ModelConfig`: Hiperparâmetros da arquitetura do transformer. Nomenclatura: d_model = dimensão dos embeddings (também chamado de n_embd) n_heads = número de cabeças de atenção n_layers = número de blocos transformer empilhados n_kv_hea
- Linha 36 ? `function` ? `ffn_dim`: Dimensão interna do FFN (Feed-Forward Network).
- Linha 43 ? `function` ? `head_dim`: Dimensão de cada cabeça de atenção.
- Linha 47 ? `function` ? `param_count`: Estimativa do número de parâmetros do modelo.
- Linha 61 ? `class` ? `TrainConfig`: Configuração do loop de treino.
- Linha 105 ? `function` ? `__post_init__`: executa a l?gica associada a `__post_init__`.
- Linha 110 ? `function` ? `effective_batch_size`: executa a l?gica associada a `effective_batch_size`.

### `llm-training/01_nanogpt/model.py`
- Linha 37 ? `class` ? `RMSNorm`: RMSNorm normaliza pelo RMS (raiz da média dos quadrados) em vez da média e variância como o LayerNorm padrão. Vantagem: mais simples, sem parâmetro de bias, empiricamente tão bom quanto LayerNorm em LLMs. Fórmula: y = x
- Linha 52 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 58 ? `function` ? `_norm`: executa a l?gica associada a `_norm`.
- Linha 63 ? `function` ? `forward`: executa a l?gica associada a `forward`.
- Linha 73 ? `function` ? `precompute_rope_freqs`: Pré-computa as frequências de rotação para RoPE. Ideia central: - Dividimos cada vetor de dimensão head_dim em pares: (x_0, x_1), (x_2, x_3), ... - Cada par é tratado como um número complexo: x_0 + i*x_1 - Multiplicamos
- Linha 115 ? `function` ? `apply_rope`: Aplica RoPE ao tensor x. x shape: [batch, seq_len, n_heads, head_dim] A rotação age em pares de dimensões: x_rot[2i] = x[2i] * cos(t*θ_i) - x[2i+1] * sin(t*θ_i) x_rot[2i+1] = x[2i+1] * cos(t*θ_i) + x[2i] * sin(t*θ_i) Equ
- Linha 157 ? `class` ? `GroupedQueryAttention`: Grouped Query Attention (GQA) — variante eficiente do Multi-Head Attention. No MHA padrão: n_heads cabeças para Q, K e V (muito peso e memória em K,V). No GQA: n_heads cabeças para Q, mas apenas n_kv_heads para K e V. Ca
- Linha 175 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 209 ? `function` ? `_repeat_kv`: Repete K ou V n_rep vezes para alinhar com o número de cabeças Q. Entrada: [batch, seq, n_kv_heads, head_dim] Saída: [batch, seq, n_heads, head_dim] (n_kv_heads × n_rep = n_heads) Isso simula MHA sem duplicar os pesos —
- Linha 226 ? `function` ? `forward`: executa a l?gica associada a `forward`.
- Linha 319 ? `function` ? `clear_cache`: Limpa o KV-cache (chamar entre prompts diferentes).
- Linha 329 ? `class` ? `SwiGLUFFN`: SwiGLU Feed-Forward Network — ativação gated usada no Llama. SwiGLU(x, W, V, W2) = (x·W ⊙ swish(x·V)) · W2 Onde ⊙ é multiplicação elemento a elemento e swish(x) = x * σ(x). Por que SwiGLU? - Ativações gated permitem ao m
- Linha 351 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 364 ? `function` ? `forward`: executa a l?gica associada a `forward`.
- Linha 381 ? `class` ? `TransformerBlock`: Um bloco decoder do transformer. Estrutura (Llama-style com pre-normalization): x = x + Attention( RMSNorm(x) ) ← residual connection x = x + FFN( RMSNorm(x) ) ← residual connection Pre-normalization (norma ANTES de cada
- Linha 393 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 406 ? `function` ? `forward`: executa a l?gica associada a `forward`.
- Linha 438 ? `class` ? `NexusLM`: Modelo de linguagem decoder-only, estilo Llama 2/3. Arquitetura completa: tokens → Embedding → [N × TransformerBlock] → RMSNorm → LM Head → logits Características: - RoPE (posição relativa via rotação) - GQA (atenção agr
- Linha 455 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 516 ? `function` ? `_init_weights`: Inicialização padrão: Normal(0, 0.02) para Linear e Embedding.
- Linha 525 ? `function` ? `forward`: Forward pass completo. Retorna: logits: [B, T, vocab_size] — scores não normalizados por token loss: escalar (cross-entropy) se targets fornecidos, senão None
- Linha 602 ? `function` ? `clear_kv_cache`: Limpa o KV-cache de todos os blocos (entre prompts diferentes).
- Linha 608 ? `function` ? `generate`: Geração autorregressiva de texto. Processo (token a token): 1. Processa o prompt completo (prefill) 2. Para cada novo token: a. Pega o logit do último token b. Aplica temperatura, top-k, top-p, repetition penalty c. Amos
- Linha 737 ? `function` ? `get_num_params`: Conta parâmetros, opcionalmente excluindo embeddings.
- Linha 744 ? `function` ? `configure_optimizers`: Configura o otimizador AdamW com weight decay seletivo. Regra importante: - Weight decay APENAS em parâmetros 2D (matrizes de peso) - SEM weight decay em: biases, RMSNorm weights, embeddings Razão: weight decay em embedd
- Linha 803 ? `function` ? `build_model`: Constrói e move o modelo para o dispositivo especificado.
- Linha 810 ? `function` ? `load_model_checkpoint`: Carrega modelo de um checkpoint salvo durante o treino. Retorna o modelo e o dicionário completo do checkpoint (que contém estado do otimizador, passo atual, etc.)

### `llm-training/01_nanogpt/smoke_test_train.py`
- Linha 32 ? `function` ? `make_synthetic_bin`: Cria dados sinteticos COM PADRAO para que a loss caia de verdade. Usa sequencias periodicas simples: [0,1,2,...,P,0,1,2,...] repetidas. O modelo aprende a prever o proximo valor na sequencia. Dados puramente aleatorios N
- Linha 51 ? `function` ? `smoke_test`: executa a l?gica associada a `smoke_test`.
- Linha 97 ? `function` ? `get_batch`: obt?m ou monta dados relacionado a `get_batch`.

### `llm-training/01_nanogpt/tokenizer.py`
- Linha 81 ? `function` ? `train_tokenizer`: Treina um tokenizador BPE do zero a partir de arquivos de texto. O processo de treino BPE: 1. Começa com todos os bytes (256 tokens base) 2. Conta pares de bytes adjacentes mais frequentes 3. Mescla o par mais frequente
- Linha 202 ? `class` ? `NexusTokenizer`: Wrapper de alto nível para o tokenizador BPE do NexusLM. Fornece: - encode / decode simples - encode_batch para múltiplas sequências com padding - Template de chat para fine-tuning instruction-following - Gerador de toke
- Linha 226 ? `function` ? `__init__`: Carrega tokenizador de um diretório previamente salvo. Args: tokenizer_dir: Diretório com tokenizer.json e tokenizer_config.json
- Linha 277 ? `function` ? `vocab_size`: Tamanho total do vocabulário.
- Linha 281 ? `function` ? `get_vocab`: Retorna o vocabulário completo como dicionário {token: id}.
- Linha 285 ? `function` ? `__call__`: Permite chamar o tokenizador diretamente, simulando a API da HuggingFace.
- Linha 334 ? `function` ? `encode`: Converte uma string em lista de IDs de tokens. Args: text: String de entrada add_special_tokens: Adiciona BOS e EOS automaticamente truncate: Trunca para max_length se necessário max_length: Comprimento máximo em tokens
- Linha 370 ? `function` ? `encode_batch`: Codifica múltiplos textos de uma vez (eficiente com Rust backend). Aplica padding automático para que todas as sequências tenham o mesmo comprimento (necessário para batch em PyTorch). Args: texts: Lista de strings para
- Linha 426 ? `function` ? `decode`: Converte IDs de tokens de volta para string. Args: ids: Lista de IDs de tokens skip_special_tokens: Remove tokens especiais do output Returns: String decodificada Exemplo: texto = tokenizer.decode([1, 15000, 28725, 2]) #
- Linha 447 ? `function` ? `decode_batch`: Decodifica múltiplas sequências de uma vez.
- Linha 457 ? `function` ? `token_to_id`: Converte string token → ID numérico.
- Linha 461 ? `function` ? `id_to_token`: Converte ID numérico → string token.
- Linha 467 ? `function` ? `tokenize_file`: Tokeniza um arquivo de texto linha a linha (memória eficiente). Usa um gerador para não carregar o arquivo inteiro na memória. Útil para pré-processar corpus de centenas de GB. Args: file_path: Caminho para o arquivo .tx
- Linha 533 ? `function` ? `tokenize_and_save`: Tokeniza múltiplos arquivos e salva em formato binário para treino. O formato .bin é um array flat de uint16 (tokens ≤ 65535). O treino lê janelas de context_len tokens diretamente deste arquivo, sem precisar carregar tu
- Linha 607 ? `function` ? `format_chat`: Formata uma conversa no template de chat do NexusLM. Template (estilo ChatML adaptado): <|system|> {conteúdo do sistema} <|user|> {turno do usuário} <|assistant|> {resposta do assistente} ... Args: messages: Lista de men
- Linha 668 ? `function` ? `encode_chat`: Formata e tokeniza uma conversa em um único passo. Convenience wrapper: format_chat() + encode(). Args: messages: Lista de mensagens max_length: Trunca se necessário add_generation_prompt: Adiciona prompt de geração no f
- Linha 697 ? `function` ? `create_training_example`: Cria um par (input_ids, labels) para fine-tuning instruction-following. Estratégia de mascaramento: - Labels = -1 para tokens do prompt (usuário + sistema) - Labels = token_id para tokens da resposta do assistente - Isso
- Linha 761 ? `function` ? `save`: Salva o tokenizador em um diretório. Args: output_dir: Diretório de destino (criado se não existir)
- Linha 780 ? `function` ? `from_pretrained`: Carrega tokenizador de um diretório. Alias de __init__ para compatibilidade com convenção HuggingFace.
- Linha 789 ? `function` ? `count_tokens`: Conta quantos tokens uma string vai gerar (sem BOS/EOS).
- Linha 793 ? `function` ? `truncate_to_tokens`: Trunca um texto para caber em max_tokens tokens. Útil para garantir que prompts não ultrapassem o context_len do modelo.
- Linha 802 ? `function` ? `get_special_tokens_info`: Retorna mapa de tokens especiais e seus IDs.
- Linha 814 ? `function` ? `__repr__`: executa a l?gica associada a `__repr__`.
- Linha 823 ? `function` ? `__len__`: executa a l?gica associada a `__len__`.

### `llm-training/01_nanogpt/train.py`
- Linha 43 ? `class` ? `TokenDataset`: Dataset que lê tokens de um arquivo .bin (uint16) usando memmap. memmap (memory-mapped file) é uma técnica onde o arquivo é mapeado diretamente para a memória virtual do processo. O SO carrega apenas os blocos necessário
- Linha 61 ? `function` ? `__init__`: Args: bin_path: Caminho para o arquivo .bin de tokens context_len: Comprimento do contexto (T) split: "train" ou "val" train_split: Fração dos dados para treino (padrão: 95%)
- Linha 92 ? `function` ? `__len__`: executa a l?gica associada a `__len__`.
- Linha 96 ? `function` ? `__getitem__`: Retorna um par (input, target) de tokens. Next-token prediction: dado x[0:T], prever x[1:T+1] O modelo aprende a prever cada próximo token baseado em todos anteriores.
- Linha 109 ? `class` ? `TokenDataLoader`: DataLoader customizado que mantém estado entre iterações. Diferente do DataLoader padrão (que reinicia a cada época), este mantém uma posição aleatória e avança continuamente no corpus. Razão: para treino de LLMs, o corp
- Linha 120 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 138 ? `function` ? `next_batch`: Retorna o próximo batch, reiniciando o iterador quando necessário.
- Linha 154 ? `function` ? `get_lr`: Calcula o learning rate para um dado passo de treino. Schedule em 3 fases: 1. Warmup linear (0 → peak_lr): steps 0..warmup_steps - LR sobe linearmente de 0 até learning_rate - Necessário para estabilizar o treino no iníc
- Linha 214 ? `function` ? `save_checkpoint`: Salva o estado completo do treino em um checkpoint. O checkpoint contém tudo necessário para retomar o treino: - Pesos do modelo (state_dict) - Estado do otimizador (momentos Adam, etc.) - Passo atual - Configurações do
- Linha 285 ? `function` ? `load_checkpoint`: Carrega um checkpoint e restaura o estado do modelo e otimizador. Args: checkpoint_path: Caminho para o arquivo .pt model: Modelo (pesos serão sobrescritos) optimizer: Otimizador (estado será restaurado se fornecido) dev
- Linha 330 ? `function` ? `find_latest_checkpoint`: Encontra o checkpoint mais recente em um diretório. Returns: Caminho do checkpoint mais recente, ou None se não houver.
- Linha 354 ? `function` ? `evaluate`: Avalia o modelo no split de validação. Calcula a média da loss em n_batches batches do conjunto de validação. Não atualiza gradientes (torch.no_grad()). Args: model: Modelo a avaliar val_loader: DataLoader do split de va
- Linha 407 ? `function` ? `train`: Loop de treino completo do NexusLM. Etapas por passo de treino: 1. Busca batch de dados 2. Forward pass com AMP bfloat16 3. Backward (computa gradientes) 4. [Se grad_accum_steps atingido] a. Gradient clipping b. Atualiza
- Linha 785 ? `function` ? `parse_args`: Define e processa os argumentos de linha de comando. Exemplos de uso: # Treino básico com modelo pequeno: python train.py --model nano # Treino com configuração personalizada: python train.py --model small --lr 1e-4 --ba
- Linha 857 ? `function` ? `args_to_configs`: Converte argumentos CLI nos dataclasses de configuração. Args que são None são ignorados (mantém o valor padrão da config).

### `llm-training/02_data_pipeline/collect.py`
- Linha 37 ? `function` ? `_parse_nexus_run`: Converte um run do Nexus AI em exemplos de treino. Estrutura esperada de um run: { "id": "...", "sessionId": "...", "messages": [ {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}, ... ] }
- Linha 82 ? `function` ? `collect_nexus`: Varre recursivamente o diretório de dados do Nexus AI e extrai pares (prompt, resposta) de todos os runs encontrados.
- Linha 112 ? `function` ? `collect_alpaca`: Dataset Stanford Alpaca: 52K exemplos de instrução em inglês. Formato: {instruction, input, output}
- Linha 145 ? `function` ? `collect_sharegpt`: ShareGPT: conversas reais exportadas do ChatGPT. Formato: {conversations: [{from: "human"|"gpt", value: "..."}]} Extraímos apenas o primeiro par human→gpt para simplicidade. Para treino conversacional, extrair todos os t
- Linha 194 ? `function` ? `collect_openhermes`: OpenHermes 2.5: mix curado de ~1M exemplos de instrução/chat. Um dos melhores datasets públicos de fine-tuning disponíveis. Formato: {conversations: [{role, content}]}
- Linha 248 ? `function` ? `collect`: Coleta dados de todas as fontes especificadas e salva em JSONL. Args: nexus_data_dir: Caminho para os dados do Nexus AI (opcional) sources: Lista de fontes: ["alpaca", "sharegpt", "openhermes"] output: Arquivo de saída J

### `llm-training/02_data_pipeline/collect_data.py`
- Linha 28 ? `function` ? `progress`: executa a l?gica associada a `progress`.
- Linha 39 ? `function` ? `collect_the_stack`: Baixa o split Python do The Stack v2 via streaming. Ja vem deduplicado pelo BigCode, mas rodamos nosso pipeline por cima. O Stack v2 tem: - Licenca verificada (MIT, Apache, etc.) - Dedup por URL do repositorio - ~600GB d
- Linha 102 ? `function` ? `collect_github_code`: Baixa codigo Python do dataset codeparrot/github-code via streaming. Mais bruto que o Stack, mas tem mais volume e diversidade. Campos: code (fonte), repo_name, path, language
- Linha 159 ? `function` ? `collect_local_python`: Converte uma pasta de arquivos .py para JSONL. Util para seus proprios projetos, bibliotecas locais, etc. Varre recursivamente todos os .py encontrados.
- Linha 228 ? `function` ? `_report_file_size`: Mostra tamanho do arquivo gerado e estima numero de tokens.
- Linha 249 ? `function` ? `main`: executa a l?gica associada a `main`.

### `llm-training/02_data_pipeline/curate_code.py`
- Linha 70 ? `function` ? `exact_dedup_stream`: Remove duplicatas exatas de um arquivo JSONL lendo em modo streaming. Consome memória apenas para armazenar os hashes SHA-256 (32 bytes por documento). Returns: Número de documentos salvos (únicos).
- Linha 117 ? `function` ? `filter_code_file`: Heurísticas de filtragem de qualidade exclusivas para código Python. Returns: (manter: bool, motivo_descarte: str)
- Linha 165 ? `function` ? `_worker_filter_code`: Worker multiprocessado para executar o filtro heurístico de código.
- Linha 176 ? `function` ? `run_code_filtering`: Executa a filtragem paralela usando multiprocessing.
- Linha 213 ? `function` ? `build_minhash`: Cria uma assinatura MinHash a partir de shingles de 5 tokens consecutivos. Forks de repositórios ou tutoriais copiados terão assinaturas idênticas ou muito próximas.
- Linha 228 ? `function` ? `run_minhash_dedup`: Remove duplicatas parciais (near-duplicates) usando LSH (Locality Sensitive Hashing). Se datasketch não estiver instalado, faz fallback seguro pulando a etapa.
- Linha 283 ? `function` ? `compute_quality_score`: Calcula uma nota de qualidade de código de [0.0 a 5.0] baseada em AST. Pontua: presença de funções/classes, docstrings válidas nas declarações, e uso de bibliotecas padrão reconhecidas do ecossistema.
- Linha 336 ? `function` ? `run_quality_scoring`: Adiciona score de qualidade AST para cada arquivo de código. Ordena e extrai o Top X% (sft_threshold_pct) como o Golden Set para SFT de código.
- Linha 389 ? `function` ? `run_token_packing`: Tokeniza e empacota o dataset curado em blocos contínuos de tamanho context_len salvando no formato uint16 (.bin) de alto desempenho.
- Linha 417 ? `function` ? `run_pipeline`: Orquestra as 5 etapas da curadoria de código.

### `llm-training/02_data_pipeline/dedup.py`
- Linha 62 ? `function` ? `normalize_for_dedup`: Normaliza texto para deduplicação. Remove detalhes que não definem o conteúdo (espaços extras, case, etc.)
- Linha 73 ? `function` ? `get_ngrams`: Extrai o conjunto de n-gramas de caracteres do texto. N-gramas de caracteres capturam substrings compartilhadas entre documentos, independente de ordem de palavras ou pontuação ligeira. Exemplo com n=3, text="hello": {"h
- Linha 89 ? `function` ? `sha256_hash`: Hash SHA-256 do texto para deduplicação exata.
- Linha 96 ? `function` ? `make_minhash`: Gera a assinatura MinHash para um texto. Processo: 1. Extrai n-gramas do texto (conjunto S) 2. Para cada permutação i de 1 a num_perm: min_hash[i] = min(hash_i(ngram) for ngram in S) 3. Retorna o vetor [min_hash[1], ...,
- Linha 119 ? `function` ? `exact_dedup`: Remove duplicatas exatas via SHA-256. Muito mais rápido que MinHash — sempre rode antes do near-dedup. Args: examples: lista de exemplos text_key: campo de texto a usar (None = usa prompt+response) Returns: (exemplos úni
- Linha 157 ? `class` ? `NearDupDetector`: Detector de near-duplicatas usando MinHash LSH. LSH (Locality-Sensitive Hashing) divide as assinaturas MinHash em bandas e linhas. Dois documentos colidem em um bucket se têm assinaturas idênticas em pelo menos uma banda
- Linha 177 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 188 ? `function` ? `is_duplicate`: Verifica se um texto é near-duplicata de algo já visto. Se não for, adiciona ao índice. Args: text: texto do documento doc_id: identificador único do documento (ex: índice) Returns: True se for duplicata, False caso cont
- Linha 222 ? `function` ? `dedup_dataset`: Pipeline completo de deduplicação: exata → near-dup. Processa em streaming para economizar memória. O LSH index fica em memória, mas os dados passam linha a linha. Args: input_files: arquivos JSONL de entrada output_path

### `llm-training/02_data_pipeline/filter.py`
- Linha 44 ? `function` ? `normalize_text`: Normaliza unicode, remove controles invisíveis.
- Linha 53 ? `function` ? `word_count`: Conta palavras de forma robusta.
- Linha 58 ? `function` ? `char_count`: executa a l?gica associada a `char_count`.
- Linha 62 ? `function` ? `repetition_score`: Mede o grau de repetição do texto. Estratégia: conta n-gramas de caracteres e calcula a proporção de n-gramas que aparecem mais de uma vez. Texto repetitivo = muitos n-gramas duplicados = baixa qualidade. Exemplo: "abc a
- Linha 87 ? `function` ? `symbol_ratio`: Proporção de caracteres que são símbolos não-alfanuméricos. Textos com alta proporção de símbolos tendem a ser: - Código gerado (base64, hexadecimal, HTML escroto) - Spam com caracteres especiais - Dados corrompidos Retu
- Linha 105 ? `function` ? `letter_ratio`: Proporção de letras no texto. Texto de qualidade tem alta proporção de letras.
- Linha 116 ? `function` ? `avg_word_length`: Comprimento médio das palavras. - Muito curto (< 3): provavelmente spam ou acrônimos - Muito longo (> 15): provavelmente código ou IDs Faixa ideal: 4–12 caracteres por palavra.
- Linha 130 ? `function` ? `detect_language`: Detecta o idioma usando langdetect. Retorna None se não conseguir detectar (texto muito curto, etc.)
- Linha 143 ? `function` ? `quality_score`: Calcula um score de qualidade heurístico [0.0, 1.0]. Score = média ponderada de: - Coerência de comprimento de palavras (30%) - Proporção de letras (30%) - Ausência de repetição (25%) - Ausência de símbolos excessivos (1
- Linha 191 ? `function` ? `should_keep`: Decide se um exemplo deve ser mantido ou descartado. Args: example: dict com 'prompt' e 'response' (ou 'text') min_words, max_words: limites de palavras min_chars, max_chars: limites de caracteres min_quality: score míni
- Linha 264 ? `function` ? `_worker_init`: Inicializa cada worker com os argumentos de filtro.
- Linha 270 ? `function` ? `_worker_filter`: Função chamada por cada worker no pool.
- Linha 278 ? `function` ? `filter_dataset`: Filtra um ou mais arquivos JSONL e salva os exemplos aprovados. Args: input_files: lista de paths .jsonl de entrada output_path: path de saída .jsonl n_workers: número de processos (-1 = todos os CPUs) chunk_size: exempl
- Linha 334 ? `function` ? `_read_file`: executa a l?gica associada a `_read_file`.

### `llm-training/02_data_pipeline/token_pack.py`
- Linha 34 ? `function` ? `load_tokenizer`: Carrega o NexusTokenizer ou um tokenizer HuggingFace. Detecta automaticamente o tipo pelo conteúdo do diretório.
- Linha 58 ? `function` ? `text_to_tokens`: Converte um exemplo em lista de tokens. Para pré-treino: concatena prompt + response como texto corrido. Para fine-tuning (SFT), use o dataset.py em 03_finetune/. Formato: <bos> prompt response <eos>
- Linha 99 ? `class` ? `TokenPacker`: Empacota sequências de tokens em chunks de context_len. Como funciona: 1. Mantém um buffer acumulando tokens 2. Quando o buffer tem >= context_len + 1 tokens: → Emite um chunk de context_len + 1 tokens → Mantém o restant
- Linha 116 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 123 ? `function` ? `push`: Adiciona tokens ao buffer e retorna chunks prontos. Adiciona <eos> no final de cada sequência antes de empilhar.
- Linha 149 ? `function` ? `finalize`: Descarta o buffer incompleto. Não usa padding — simplesmente ignora tokens sobrando.
- Linha 163 ? `class` ? `BinWriter`: Escreve chunks de tokens em arquivo .bin (numpy uint16). Usa escrita incremental: adiciona ao arquivo existente ao invés de carregar tudo na memória.
- Linha 171 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 180 ? `function` ? `write_chunk`: Escreve um chunk de tokens no arquivo.
- Linha 186 ? `function` ? `close`: executa a l?gica associada a `close`.
- Linha 189 ? `function` ? `__enter__`: executa a l?gica associada a `__enter__`.
- Linha 192 ? `function` ? `__exit__`: executa a l?gica associada a `__exit__`.
- Linha 198 ? `function` ? `tokenize_dataset`: Tokeniza e empacota dados JSONL para pré-treino. Processo: 1. Carrega tokenizer 2. Para cada exemplo: texto → tokens 3. Empacota tokens sem padding 4. Salva train.bin e val.bin Args: input_files: lista de JSONL de entrad

### `llm-training/03_finetune/dataset.py`
- Linha 57 ? `class` ? `SFTDataset`: Dataset para Supervised Fine-Tuning (SFT). Lê um arquivo JSONL onde cada linha contém: {"prompt": "<texto do prompt>", "response": "<texto da resposta>"} O dataset: 1. Aplica o chat template do tokenizador (se disponível
- Linha 82 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 109 ? `function` ? `_load_jsonl`: Lê um arquivo JSONL e retorna uma lista de dicionários.
- Linha 139 ? `function` ? `_apply_template`: Aplica o chat template do tokenizador para formatar prompt e resposta. Retorna (texto_completo, texto_somente_prompt), ambos como strings. O texto_somente_prompt é usado para calcular quantos tokens pertencem ao prompt,
- Linha 172 ? `function` ? `_tokenize_and_mask`: Tokeniza a sequência completa e mascara os tokens do prompt nos labels. Retorna um dicionário com: input_ids : Tensor de IDs de tokens da sequência completa. attention_mask : Tensor de 1s e 0s (1 = token real, 0 = paddin
- Linha 232 ? `function` ? `__len__`: executa a l?gica associada a `__len__`.
- Linha 235 ? `function` ? `__getitem__`: executa a l?gica associada a `__getitem__`.
- Linha 246 ? `class` ? `DPODataset`: Dataset para Direct Preference Optimization (DPO). Lê um arquivo JSONL onde cada linha contém: { "prompt" : "<texto do prompt>", "chosen" : "<resposta preferida (melhor)>", "rejected": "<resposta preterida (pior)>" } O D
- Linha 271 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 294 ? `function` ? `_load_jsonl`: Lê arquivo JSONL e valida as chaves necessárias para DPO.
- Linha 318 ? `function` ? `_tokenize_pair`: Tokeniza um par (prompt, resposta) e mascara o prompt nos labels. Retorna dicionário com input_ids, attention_mask e labels.
- Linha 362 ? `function` ? `__len__`: executa a l?gica associada a `__len__`.
- Linha 365 ? `function` ? `__getitem__`: Retorna uma tripla: chosen_enc : tokenização de (prompt + chosen) rejected_enc: tokenização de (prompt + rejected) prompt : string do prompt original (para logging)
- Linha 394 ? `class` ? `SFTDataCollator`: DataCollator para SFTDataset. Recebe uma lista de exemplos (dicionários com input_ids, attention_mask, labels) e os agrupa em um batch com padding dinâmico — cada batch é preenchido apenas até o comprimento do exemplo ma
- Linha 415 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 430 ? `function` ? `__call__`: Agrupa e faz padding de uma lista de exemplos em um batch.
- Linha 479 ? `class` ? `DPODataCollator`: DataCollator para DPODataset. Agrupa triplas (chosen, rejected) com padding dinâmico separado para cada campo. Retorna um batch com 6 tensores: chosen_input_ids, chosen_attention_mask, chosen_labels rejected_input_ids, r
- Linha 489 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 500 ? `function` ? `_pad_sequence`: Faz padding de uma lista de tensores 1D para o mesmo comprimento.
- Linha 521 ? `function` ? `__call__`: Agrupa e faz padding de batch de exemplos DPO.
- Linha 547 ? `function` ? `load_sft_dataset`: Atalho para carregar datasets de treino e validação SFT. Retorna (train_dataset, val_dataset). Se val_path for None, val_dataset será None.
- Linha 575 ? `function` ? `load_dpo_dataset`: Atalho para carregar datasets de treino e validação DPO.
- Linha 600 ? `function` ? `compute_token_stats`: Calcula estatísticas de comprimento de sequência no dataset. Útil para definir max_length e detectar exemplos muito longos. Retorna dicionário com média, mediana, min, max e percentil 95.

### `llm-training/03_finetune/dpo.py`
- Linha 79 ? `function` ? `get_batch_logps`: Calcula as log-probabilidades das respostas dadas pelo modelo. Como os logits em t predizem o token em t+1, deslocamos (shift) os logits e labels em uma posição antes de computar o log_softmax e fazer o gather. Args: log
- Linha 133 ? `function` ? `compute_dpo_loss`: Calcula a perda DPO e as recompensas implícitas para logging. Args: policy_chosen_logps: Log-probs das respostas escolhidas sob a política π_θ. policy_rejected_logps: Log-probs das respostas rejeitadas sob a política π_θ
- Linha 189 ? `function` ? `evaluate_dpo`: Executa a avaliação do modelo de política no dataset de validação. Calcula perda DPO, recompensas e métricas de acurácia (quantas vezes a resposta escolhida tem maior probabilidade que a rejeitada).
- Linha 270 ? `function` ? `dpo_train`: Inicializa e gerencia o loop de treinamento Direct Preference Optimization.

### `llm-training/03_finetune/dpo_generator.py`
- Linha 35 ? `class` ? `DPOExample`: define estrutura/servi?o `DPOExample` e agrupa comportamento relacionado.
- Linha 46 ? `function` ? `extract_code`: Extrai o bloco de código da resposta markdown.
- Linha 54 ? `function` ? `wrap_code`: executa a l?gica associada a `wrap_code`.
- Linha 62 ? `function` ? `strategy_remove_types`: Remove type hints da assinatura — código válido mas menos informativo.
- Linha 69 ? `class` ? `TypeRemover`: define estrutura/servi?o `TypeRemover` e agrupa comportamento relacionado.
- Linha 70 ? `function` ? `visit_arg`: executa a l?gica associada a `visit_arg`.
- Linha 73 ? `function` ? `visit_FunctionDef`: executa a l?gica associada a `visit_FunctionDef`.
- Linha 77 ? `function` ? `visit_AsyncFunctionDef`: executa a l?gica associada a `visit_AsyncFunctionDef`.
- Linha 93 ? `function` ? `strategy_remove_docstring`: Remove docstrings — código funciona mas perde documentação.
- Linha 100 ? `class` ? `DocstringRemover`: define estrutura/servi?o `DocstringRemover` e agrupa comportamento relacionado.
- Linha 101 ? `function` ? `_strip_docstring`: executa a l?gica associada a `_strip_docstring`.
- Linha 109 ? `function` ? `visit_FunctionDef`: executa a l?gica associada a `visit_FunctionDef`.
- Linha 113 ? `function` ? `visit_AsyncFunctionDef`: executa a l?gica associada a `visit_AsyncFunctionDef`.
- Linha 117 ? `function` ? `visit_ClassDef`: executa a l?gica associada a `visit_ClassDef`.
- Linha 139 ? `function` ? `strategy_rename_vars`: Renomeia variáveis locais pra nomes sem semântica (a, b, c, tmp1...).
- Linha 149 ? `class` ? `VarRenamer`: define estrutura/servi?o `VarRenamer` e agrupa comportamento relacionado.
- Linha 150 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 160 ? `function` ? `_get_rename`: executa a l?gica associada a `_get_rename`.
- Linha 171 ? `function` ? `visit_FunctionDef`: executa a l?gica associada a `visit_FunctionDef`.
- Linha 180 ? `function` ? `visit_Name`: executa a l?gica associada a `visit_Name`.
- Linha 197 ? `function` ? `strategy_truncate_body`: Trunca o corpo da função na metade — resposta incompleta.
- Linha 209 ? `function` ? `strategy_add_bug`: Introduz bug sutil — operador errado, off-by-one, return errado.
- Linha 236 ? `function` ? `strategy_add_noise`: Adiciona prints de debug e comentários inúteis — má prática.
- Linha 269 ? `function` ? `strategy_bad_style`: Nome de função sem semântica + sem espaços + estilo horrível.
- Linha 302 ? `function` ? `pick_strategy`: executa a l?gica associada a `pick_strategy`.
- Linha 312 ? `function` ? `generate_dpo`: gera artefato/sa?da relacionado a `generate_dpo`.

### `llm-training/03_finetune/sft.py`
- Linha 52 ? `class` ? `LoRALinear`: Substituição LoRA para nn.Linear. Adiciona adaptadores de baixo rank ao linear existente: saída = x @ W.T + (x @ A.T) @ B.T × (alpha/rank) O fator (alpha/rank) escala a contribuição do LoRA. alpha=16, rank=64 → fator=0.2
- Linha 66 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 96 ? `function` ? `forward`: executa a l?gica associada a `forward`.
- Linha 107 ? `function` ? `apply_lora`: Substitui Linear nos módulos alvo por LoRALinear. target_modules: lista de nomes de sublayers a adaptar. Padrão: projeções de Q, K, V, O da atenção + gate e up do FFN. Args: model: modelo a adaptar rank: dimensão de baix
- Linha 162 ? `function` ? `save_lora_adapters`: Salva apenas os pesos LoRA (adaptadores A e B) — muito menores que o modelo completo.
- Linha 177 ? `function` ? `load_lora_adapters`: Carrega adaptadores LoRA previamente salvos.
- Linha 190 ? `function` ? `cosine_lr`: Cosine decay com warmup linear.
- Linha 203 ? `function` ? `evaluate_sft`: Calcula loss de validação no SFT.
- Linha 222 ? `function` ? `sft_train`: Loop de Supervised Fine-Tuning. Args: base_model_path: path do checkpoint pré-treinado (.pt) ou modelo HF train_data: JSONL com {prompt, response} output_dir: onde salvar checkpoints e adaptadores LoRA tokenizer_path: pa

### `llm-training/03_finetune/sft_generator.py`
- Linha 26 ? `class` ? `SFTExample`: define estrutura/servi?o `SFTExample` e agrupa comportamento relacionado.
- Linha 36 ? `class` ? `ASTExtractor`: Varre arquivos Python e extrai pares (instrução, implementação) de: - Funções com docstring - Classes com docstring + métodos - Funções sem docstring (inferência de prompt via assinatura)
- Linha 44 ? `function` ? `__init__`: executa a l?gica associada a `__init__`.
- Linha 48 ? `function` ? `extract_from_file`: executa a l?gica associada a `extract_from_file`.
- Linha 73 ? `function` ? `_get_body_source`: Extrai o corpo da função/classe do código-fonte original.
- Linha 86 ? `function` ? `_get_docstring`: executa a l?gica associada a `_get_docstring`.
- Linha 89 ? `function` ? `_signature`: Reconstrói a assinatura legível da função.
- Linha 132 ? `function` ? `_quality_score`: executa a l?gica associada a `_quality_score`.
- Linha 146 ? `function` ? `_build_prompt_variants`: Gera um prompt de instrução natural para a função.
- Linha 168 ? `function` ? `_extract_function`: executa a l?gica associada a `_extract_function`.
- Linha 196 ? `function` ? `_extract_class`: executa a l?gica associada a `_extract_class`.
- Linha 228 ? `function` ? `dedup_examples`: executa a l?gica associada a `dedup_examples`.
- Linha 242 ? `function` ? `generate_sft`: gera artefato/sa?da relacionado a `generate_sft`.

### `llm-training/04_evaluate/benchmark.py`
- Linha 64 ? `function` ? `calculate_bleu_score`: Calcula o BLEU-4 médio entre predições e referências.
- Linha 121 ? `function` ? `calculate_rouge_scores`: Calcula ROUGE-1, ROUGE-2 e ROUGE-L médios.
- Linha 197 ? `function` ? `compute_distinct_n`: Calcula a métrica Distinct-N (diversidade de vocabulário).
- Linha 218 ? `function` ? `compute_perplexity`: Computa a perplexidade (PPL) média do modelo no conjunto de teste. PPL = exp(loss_média) Mascara os tokens do prompt nos labels usando SFTDataset.
- Linha 259 ? `function` ? `run_generation_eval`: Gera respostas para uma lista de prompts e compara com referências para extrair BLEU, ROUGE e Distinct-N.
- Linha 341 ? `function` ? `run_few_shot_qa`: Roda teste básico de acurácia de poucos exemplos (Few-Shot QA). Útil para verificar se o modelo mantém raciocínio ou se degradou no fine-tune.
- Linha 390 ? `function` ? `compare_reports`: Compara dois relatórios JSON e imprime lado a lado de forma estruturada.
- Linha 430 ? `function` ? `main`: executa a l?gica associada a `main`.

### `llm-training/04_evaluate/generate.py`
- Linha 44 ? `function` ? `generate_stream`: Gera tokens um por um recursivamente (streaming), simulando a API Llama. Permite enviar o token decodificado ao terminal assim que ele é gerado.
- Linha 145 ? `function` ? `run_chat_loop`: Loop infinito no terminal permitindo conversar com o modelo em formato chat. Mantém histórico da conversa para dar contexto.
- Linha 233 ? `function` ? `run_batch_generation`: Lê prompts de um arquivo texto (um por linha), gera respostas e escreve um arquivo JSONL contendo pares de {prompt, response}.
- Linha 299 ? `function` ? `main`: executa a l?gica associada a `main`.

### `public/agent-progress.js`
- Linha 27 ? `function` ? `friendlyAgentEventLabel`: executa a l?gica associada a `friendlyAgentEventLabel`.
- Linha 31 ? `function` ? `agentEventClass`: executa a l?gica associada a `agentEventClass`.
- Linha 39 ? `function` ? `formatAgentEventTime`: executa a l?gica associada a `formatAgentEventTime`.
- Linha 48 ? `function` ? `collectPatchIdsFromEvent`: executa a l?gica associada a `collectPatchIdsFromEvent`.
- Linha 54 ? `function` ? `mergeAgentPatchIds`: executa a l?gica associada a `mergeAgentPatchIds`.
- Linha 62 ? `function` ? `renderAgentProgress`: gera sa?da visual/textual relacionado a `renderAgentProgress`.
- Linha 137 ? `function` ? `stopAgentProgress`: para fluxo/processo relacionado a `stopAgentProgress`.
- Linha 148 ? `function` ? `finishAgentProgress`: executa a l?gica associada a `finishAgentProgress`.
- Linha 163 ? `function` ? `connectAgentProgress`: executa a l?gica associada a `connectAgentProgress`.
- Linha 176 ? `const function` ? `open`: executa a l?gica associada a `open`.

### `public/ai-panel.js`
- Linha 2 ? `function` ? `initAiPanel`: executa a l?gica associada a `initAiPanel`.
- Linha 3 ? `function` ? `getChatInput`: obt?m ou monta dados relacionado a `getChatInput`.
- Linha 6 ? `function` ? `rememberPreviewUrl`: executa a l?gica associada a `rememberPreviewUrl`.
- Linha 16 ? `function` ? `findPreviewUrl`: executa a l?gica associada a `findPreviewUrl`.
- Linha 19 ? `const function` ? `stagedHtml`: executa a l?gica associada a `stagedHtml`.
- Linha 33 ? `function` ? `openPreview`: executa a l?gica associada a `openPreview`.
- Linha 50 ? `function` ? `attachContextToChat`: executa a l?gica associada a `attachContextToChat`.

### `public/app.js`
- Linha 47 ? `function` ? `$`: executa a l?gica associada a `$`.
- Linha 51 ? `function` ? `$all`: executa a l?gica associada a `$all`.
- Linha 55 ? `function` ? `setStatus`: atualiza estado ou configura??o relacionado a `setStatus`.
- Linha 60 ? `function` ? `api`: executa a l?gica associada a `api`.
- Linha 107 ? `function` ? `loadLocalAuthToken`: carrega dados de disco ou mem?ria relacionado a `loadLocalAuthToken`.
- Linha 124 ? `function` ? `escapeHtml`: executa a l?gica associada a `escapeHtml`.
- Linha 133 ? `function` ? `basename`: executa a l?gica associada a `basename`.
- Linha 141 ? `function` ? `dirname`: executa a l?gica associada a `dirname`.
- Linha 147 ? `function` ? `activeProjectRoot`: executa a l?gica associada a `activeProjectRoot`.
- Linha 153 ? `function` ? `activeProjectName`: executa a l?gica associada a `activeProjectName`.
- Linha 157 ? `function` ? `activeProjectAbsoluteRoot`: executa a l?gica associada a `activeProjectAbsoluteRoot`.
- Linha 161 ? `function` ? `flattenTree`: executa a l?gica associada a `flattenTree`.
- Linha 169 ? `function` ? `fileIcon`: executa a l?gica associada a `fileIcon`.
- Linha 189 ? `function` ? `summarizeProjectTree`: executa a l?gica associada a `summarizeProjectTree`.
- Linha 199 ? `function` ? `buildIDEContext`: constr?i uma estrutura/resultado relacionado a `buildIDEContext`.
- Linha 230 ? `function` ? `updateBreadcrumb`: atualiza recurso existente relacionado a `updateBreadcrumb`.
- Linha 246 ? `function` ? `updateCursorStatus`: atualiza recurso existente relacionado a `updateCursorStatus`.
- Linha 251 ? `function` ? `loadHealth`: carrega dados de disco ou mem?ria relacionado a `loadHealth`.
- Linha 279 ? `function` ? `loadFiles`: carrega dados de disco ou mem?ria relacionado a `loadFiles`.
- Linha 302 ? `function` ? `loadIA`: carrega dados de disco ou mem?ria relacionado a `loadIA`.
- Linha 374 ? `function` ? `bindProviderCards`: executa a l?gica associada a `bindProviderCards`.
- Linha 434 ? `method` ? `setActiveContent`: atualiza estado ou configura??o relacionado a `setActiveContent`.
- Linha 437 ? `method` ? `getActiveFile`: obt?m ou monta dados relacionado a `getActiveFile`.
- Linha 447 ? `method` ? `getOpenFiles`: obt?m ou monta dados relacionado a `getOpenFiles`.
- Linha 453 ? `method` ? `getActiveProject`: obt?m ou monta dados relacionado a `getActiveProject`.
- Linha 460 ? `method` ? `getLocalAuthToken`: obt?m ou monta dados relacionado a `getLocalAuthToken`.
- Linha 464 ? `function` ? `activateSideView`: executa a l?gica associada a `activateSideView`.
- Linha 497 ? `function` ? `initActivityBar`: executa a l?gica associada a `initActivityBar`.
- Linha 503 ? `function` ? `initApp`: executa a l?gica associada a `initApp`.

### `public/command-palette.js`
- Linha 59 ? `function` ? `commandPaletteElements`: executa a l?gica associada a `commandPaletteElements`.
- Linha 67 ? `function` ? `commandPaletteMatches`: executa a l?gica associada a `commandPaletteMatches`.
- Linha 76 ? `function` ? `renderCommandPalette`: gera sa?da visual/textual relacionado a `renderCommandPalette`.
- Linha 100 ? `function` ? `openCommandPalette`: executa a l?gica associada a `openCommandPalette`.
- Linha 110 ? `function` ? `closeCommandPalette`: executa a l?gica associada a `closeCommandPalette`.
- Linha 117 ? `function` ? `runCommandPaletteAction`: executa fluxo ou comando relacionado a `runCommandPaletteAction`.
- Linha 124 ? `function` ? `selectCommandPaletteRow`: executa a l?gica associada a `selectCommandPaletteRow`.
- Linha 129 ? `const function` ? `next`: executa a l?gica associada a `next`.
- Linha 133 ? `function` ? `initCommandPalette`: executa a l?gica associada a `initCommandPalette`.

### `public/devmind.js`
- Linha 44 ? `function` ? `esc`: executa a l?gica associada a `esc`.
- Linha 52 ? `function` ? `md`: executa a l?gica associada a `md`.
- Linha 64 ? `function` ? `dispatch`: executa a l?gica associada a `dispatch`.
- Linha 69 ? `function` ? `authHeaders`: executa a l?gica associada a `authHeaders`.
- Linha 79 ? `function` ? `scrollBottom`: executa a l?gica associada a `scrollBottom`.
- Linha 84 ? `function` ? `trimHistory`: executa a l?gica associada a `trimHistory`.
- Linha 91 ? `function` ? `renderProgress`: gera sa?da visual/textual relacionado a `renderProgress`.
- Linha 97 ? `function` ? `renderPatchRow`: gera sa?da visual/textual relacionado a `renderPatchRow`.
- Linha 116 ? `function` ? `renderPreviewRow`: gera sa?da visual/textual relacionado a `renderPreviewRow`.
- Linha 124 ? `function` ? `renderPendingPatchSticky`: gera sa?da visual/textual relacionado a `renderPendingPatchSticky`.
- Linha 132 ? `function` ? `renderTechDetails`: gera sa?da visual/textual relacionado a `renderTechDetails`.
- Linha 147 ? `function` ? `renderConfirmBox`: gera sa?da visual/textual relacionado a `renderConfirmBox`.
- Linha 159 ? `function` ? `renderPlanBox`: gera sa?da visual/textual relacionado a `renderPlanBox`.
- Linha 191 ? `function` ? `renderMessages`: gera sa?da visual/textual relacionado a `renderMessages`.
- Linha 259 ? `function` ? `setBusy`: atualiza estado ou configura??o relacionado a `setBusy`.
- Linha 271 ? `function` ? `sendText`: executa a l?gica associada a `sendText`.
- Linha 317 ? `function` ? `resolveConfirm`: resolve caminho, configura??o ou refer?ncia relacionado a `resolveConfirm`.
- Linha 353 ? `function` ? `executeWithDecision`: executa a l?gica associada a `executeWithDecision`.
- Linha 402 ? `function` ? `friendlyIntroFor`: executa a l?gica associada a `friendlyIntroFor`.
- Linha 412 ? `function` ? `buildFriendlySummary`: constr?i uma estrutura/resultado relacionado a `buildFriendlySummary`.
- Linha 423 ? `function` ? `buildSystemPrompt`: constr?i uma estrutura/resultado relacionado a `buildSystemPrompt`.
- Linha 437 ? `function` ? `injectStyles`: executa a l?gica associada a `injectStyles`.
- Linha 503 ? `function` ? `renderShell`: gera sa?da visual/textual relacionado a `renderShell`.
- Linha 567 ? `method` ? `init`: m?todo `init` da classe, usado no comportamento interno do objeto.
- Linha 579 ? `method` ? `showPlan`: m?todo `showPlan` da classe, usado no comportamento interno do objeto.
- Linha 596 ? `method` ? `clear`: m?todo `clear` da classe, usado no comportamento interno do objeto.
- Linha 600 ? `method` ? `getHistory`: obt?m ou monta dados relacionado a `getHistory`.

### `public/editor-selection-actions.js`
- Linha 91 ? `function` ? `esc`: executa a l?gica associada a `esc`.
- Linha 98 ? `function` ? `detectLanguageFromPath`: detecta padr?o ou stack relacionado a `detectLanguageFromPath`.
- Linha 130 ? `function` ? `isSensitiveFile`: executa a l?gica associada a `isSensitiveFile`.
- Linha 135 ? `function` ? `isSensitiveContent`: executa a l?gica associada a `isSensitiveContent`.
- Linha 139 ? `function` ? `canPerformAction`: executa a l?gica associada a `canPerformAction`.
- Linha 146 ? `function` ? `getBlockingReason`: obt?m ou monta dados relacionado a `getBlockingReason`.
- Linha 158 ? `function` ? `saveToStorage`: persiste dados relacionado a `saveToStorage`.
- Linha 165 ? `function` ? `loadFromStorage`: carrega dados de disco ou mem?ria relacionado a `loadFromStorage`.
- Linha 174 ? `function` ? `initPersistentState`: executa a l?gica associada a `initPersistentState`.
- Linha 199 ? `function` ? `getActionIdByIndex`: obt?m ou monta dados relacionado a `getActionIdByIndex`.
- Linha 203 ? `function` ? `initKeyboardShortcuts`: executa a l?gica associada a `initKeyboardShortcuts`.
- Linha 237 ? `function` ? `addToHistory`: executa a l?gica associada a `addToHistory`.
- Linha 256 ? `function` ? `recordAnalytics`: executa a l?gica associada a `recordAnalytics`.
- Linha 261 ? `function` ? `undoLast`: executa a l?gica associada a `undoLast`.
- Linha 283 ? `function` ? `createModal`: cria recurso ou registro relacionado a `createModal`.
- Linha 315 ? `function` ? `showHistoryModal`: executa a l?gica associada a `showHistoryModal`.
- Linha 331 ? `function` ? `showAnalyticsModal`: executa a l?gica associada a `showAnalyticsModal`.
- Linha 341 ? `function` ? `confirmPatchAction`: executa a l?gica associada a `confirmPatchAction`.
- Linha 352 ? `function` ? `toggleFavorite`: executa a l?gica associada a `toggleFavorite`.
- Linha 363 ? `function` ? `showReorderModal`: executa a l?gica associada a `showReorderModal`.
- Linha 388 ? `function` ? `renderBody`: gera sa?da visual/textual relacionado a `renderBody`.
- Linha 441 ? `function` ? `findCustomAction`: executa a l?gica associada a `findCustomAction`.
- Linha 445 ? `function` ? `getAllActionIds`: obt?m ou monta dados relacionado a `getAllActionIds`.
- Linha 451 ? `function` ? `getActionInfoById`: obt?m ou monta dados relacionado a `getActionInfoById`.
- Linha 467 ? `function` ? `interpolateTemplate`: executa a l?gica associada a `interpolateTemplate`.
- Linha 489 ? `function` ? `showCustomActionsModal`: executa a l?gica associada a `showCustomActionsModal`.
- Linha 491 ? `const function` ? `rows`: executa a l?gica associada a `rows`.
- Linha 530 ? `function` ? `showEditCustomModal`: executa a l?gica associada a `showEditCustomModal`.
- Linha 589 ? `function` ? `debouncedRenderSelectionBar`: executa a l?gica associada a `debouncedRenderSelectionBar`.
- Linha 601 ? `function` ? `getEditorSelectionContext`: obt?m ou monta dados relacionado a `getEditorSelectionContext`.
- Linha 636 ? `function` ? `buildActionPrompt`: constr?i uma estrutura/resultado relacionado a `buildActionPrompt`.
- Linha 751 ? `function` ? `createSelectionBar`: cria recurso ou registro relacionado a `createSelectionBar`.
- Linha 774 ? `function` ? `renderSelectionBar`: gera sa?da visual/textual relacionado a `renderSelectionBar`.
- Linha 957 ? `function` ? `hideSelectionBar`: executa a l?gica associada a `hideSelectionBar`.
- Linha 965 ? `function` ? `handleActionClick`: trata evento ou requisi??o relacionado a `handleActionClick`.
- Linha 1021 ? `function` ? `sendActionToAI`: executa a l?gica associada a `sendActionToAI`.
- Linha 1095 ? `function` ? `initSelectionMonitoring`: executa a l?gica associada a `initSelectionMonitoring`.
- Linha 1127 ? `function` ? `setupContextMenuIntegration`: executa a l?gica associada a `setupContextMenuIntegration`.

### `public/editor.js`
- Linha 2 ? `function` ? `detectLanguage`: detecta padr?o ou stack relacionado a `detectLanguage`.
- Linha 21 ? `function` ? `ensureMonaco`: garante pr?-condi??o/estrutura relacionado a `ensureMonaco`.
- Linha 25 ? `const function` ? `fail`: executa a l?gica associada a `fail`.
- Linha 72 ? `function` ? `updateEditorWelcome`: atualiza recurso existente relacionado a `updateEditorWelcome`.
- Linha 79 ? `function` ? `updateSaveStatus`: atualiza recurso existente relacionado a `updateSaveStatus`.
- Linha 90 ? `function` ? `openDocument`: executa a l?gica associada a `openDocument`.
- Linha 110 ? `function` ? `revealEditorPosition`: executa a l?gica associada a `revealEditorPosition`.
- Linha 121 ? `function` ? `setActiveDocument`: atualiza estado ou configura??o relacionado a `setActiveDocument`.
- Linha 138 ? `function` ? `renderOpenFileTabs`: gera sa?da visual/textual relacionado a `renderOpenFileTabs`.
- Linha 172 ? `function` ? `closeFileTab`: executa a l?gica associada a `closeFileTab`.
- Linha 187 ? `function` ? `clearEditorIfNoActiveFile`: executa a l?gica associada a `clearEditorIfNoActiveFile`.
- Linha 198 ? `function` ? `saveActiveFile`: persiste dados relacionado a `saveActiveFile`.
- Linha 231 ? `function` ? `openFile`: executa a l?gica associada a `openFile`.
- Linha 254 ? `function` ? `initEditor`: executa a l?gica associada a `initEditor`.
- Linha 266 ? `function` ? `getEditorSelectionPayload`: obt?m ou monta dados relacionado a `getEditorSelectionPayload`.
- Linha 285 ? `function` ? `ensureAiEditDialog`: garante pr?-condi??o/estrutura relacionado a `ensureAiEditDialog`.
- Linha 324 ? `function` ? `openAiEditDialog`: executa a l?gica associada a `openAiEditDialog`.
- Linha 346 ? `function` ? `closeAiEditDialog`: executa a l?gica associada a `closeAiEditDialog`.
- Linha 350 ? `function` ? `setAiEditStatus`: atualiza estado ou configura??o relacionado a `setAiEditStatus`.
- Linha 355 ? `function` ? `generateAiEditPlan`: gera artefato/sa?da relacionado a `generateAiEditPlan`.
- Linha 389 ? `function` ? `showAiEditHistory`: executa a l?gica associada a `showAiEditHistory`.
- Linha 393 ? `const function` ? `latest`: executa a l?gica associada a `latest`.
- Linha 403 ? `function` ? `undoLatestAiEdit`: executa a l?gica associada a `undoLatestAiEdit`.
- Linha 407 ? `const function` ? `latest`: executa a l?gica associada a `latest`.

### `public/explorer.js`
- Linha 2 ? `function` ? `fileCodicon`: executa a l?gica associada a `fileCodicon`.
- Linha 23 ? `function` ? `isPathInsideFolder`: executa a l?gica associada a `isPathInsideFolder`.
- Linha 27 ? `function` ? `ensureExplorerPrompt`: garante pr?-condi??o/estrutura relacionado a `ensureExplorerPrompt`.
- Linha 48 ? `function` ? `askExplorerPath`: executa a l?gica associada a `askExplorerPath`.
- Linha 65 ? `const function` ? `close`: executa a l?gica associada a `close`.
- Linha 74 ? `const function` ? `onSubmit`: executa a l?gica associada a `onSubmit`.
- Linha 78 ? `const function` ? `onCancel`: executa a l?gica associada a `onCancel`.
- Linha 79 ? `const function` ? `onOverlayClick`: executa a l?gica associada a `onOverlayClick`.
- Linha 82 ? `const function` ? `onKeydown`: executa a l?gica associada a `onKeydown`.
- Linha 91 ? `function` ? `refreshExplorerTree`: executa a l?gica associada a `refreshExplorerTree`.
- Linha 104 ? `function` ? `renderFileTree`: gera sa?da visual/textual relacionado a `renderFileTree`.
- Linha 126 ? `function` ? `renderNode`: gera sa?da visual/textual relacionado a `renderNode`.
- Linha 166 ? `function` ? `createProjectFile`: cria recurso ou registro relacionado a `createProjectFile`.
- Linha 188 ? `function` ? `createProjectFolderFromPrompt`: cria recurso ou registro relacionado a `createProjectFolderFromPrompt`.
- Linha 209 ? `function` ? `renameTreePath`: executa a l?gica associada a `renameTreePath`.
- Linha 250 ? `function` ? `deleteTreePath`: remove recurso relacionado a `deleteTreePath`.
- Linha 291 ? `function` ? `initExplorer`: executa a l?gica associada a `initExplorer`.

### `public/layout.js`
- Linha 3 ? `function` ? `loadLayoutFromStorage`: carrega dados de disco ou mem?ria relacionado a `loadLayoutFromStorage`.
- Linha 14 ? `function` ? `saveLayoutToStorage`: persiste dados relacionado a `saveLayoutToStorage`.
- Linha 22 ? `function` ? `applyLayoutCss`: aplica altera??o relacionado a `applyLayoutCss`.
- Linha 36 ? `function` ? `toggleSidebar`: executa a l?gica associada a `toggleSidebar`.
- Linha 45 ? `function` ? `initResize`: executa a l?gica associada a `initResize`.
- Linha 55 ? `const function` ? `onMove`: executa a l?gica associada a `onMove`.
- Linha 61 ? `const function` ? `onUp`: executa a l?gica associada a `onUp`.
- Linha 73 ? `function` ? `initLayout`: executa a l?gica associada a `initLayout`.
- Linha 130 ? `function` ? `initKeyboardShortcuts`: executa a l?gica associada a `initKeyboardShortcuts`.
- Linha 169 ? `function` ? `showBottomPanel`: executa a l?gica associada a `showBottomPanel`.

### `public/patch-review.js`
- Linha 2 ? `function` ? `riskClass`: executa a l?gica associada a `riskClass`.
- Linha 8 ? `function` ? `riskBadge`: executa a l?gica associada a `riskBadge`.
- Linha 14 ? `function` ? `patchPrimaryPath`: executa a l?gica associada a `patchPrimaryPath`.
- Linha 18 ? `function` ? `patchDate`: executa a l?gica associada a `patchDate`.
- Linha 27 ? `function` ? `getChatInput`: obt?m ou monta dados relacionado a `getChatInput`.
- Linha 31 ? `function` ? `getChatSendButton`: obt?m ou monta dados relacionado a `getChatSendButton`.
- Linha 35 ? `function` ? `updatePatchTabBadge`: atualiza recurso existente relacionado a `updatePatchTabBadge`.
- Linha 46 ? `function` ? `showPatchReviewEmpty`: executa a l?gica associada a `showPatchReviewEmpty`.
- Linha 52 ? `function` ? `showPatchReviewPanel`: executa a l?gica associada a `showPatchReviewPanel`.
- Linha 58 ? `function` ? `disposeDiffModels`: executa a l?gica associada a `disposeDiffModels`.
- Linha 66 ? `function` ? `createDiffEditorInstance`: cria recurso ou registro relacionado a `createDiffEditorInstance`.
- Linha 89 ? `function` ? `ensureMonacoDiff`: garante pr?-condi??o/estrutura relacionado a `ensureMonacoDiff`.
- Linha 93 ? `const function` ? `fail`: executa a l?gica associada a `fail`.
- Linha 100 ? `const function` ? `done`: executa a l?gica associada a `done`.
- Linha 126 ? `function` ? `ensurePatchPanelHeight`: garante pr?-condi??o/estrutura relacionado a `ensurePatchPanelHeight`.
- Linha 139 ? `function` ? `layoutDiffEditor`: executa a l?gica associada a `layoutDiffEditor`.
- Linha 145 ? `function` ? `openPatchesPanel`: executa a l?gica associada a `openPatchesPanel`.
- Linha 154 ? `function` ? `getPatchFileEntries`: obt?m ou monta dados relacionado a `getPatchFileEntries`.
- Linha 168 ? `function` ? `buildTextualDiffFallback`: constr?i uma estrutura/resultado relacionado a `buildTextualDiffFallback`.
- Linha 184 ? `function` ? `renderPatchMetadata`: gera sa?da visual/textual relacionado a `renderPatchMetadata`.
- Linha 208 ? `function` ? `renderPatchFileList`: gera sa?da visual/textual relacionado a `renderPatchFileList`.
- Linha 235 ? `function` ? `renderPatchActions`: gera sa?da visual/textual relacionado a `renderPatchActions`.
- Linha 251 ? `function` ? `renderPostApplyActions`: gera sa?da visual/textual relacionado a `renderPostApplyActions`.
- Linha 264 ? `function` ? `bindPatchActionButtons`: executa a l?gica associada a `bindPatchActionButtons`.
- Linha 299 ? `function` ? `showPatchAppliedState`: executa a l?gica associada a `showPatchAppliedState`.
- Linha 315 ? `function` ? `showPatchDiff`: executa a l?gica associada a `showPatchDiff`.
- Linha 331 ? `function` ? `hideStalePatchAlert`: executa a l?gica associada a `hideStalePatchAlert`.
- Linha 339 ? `function` ? `showStalePatchAlert`: executa a l?gica associada a `showStalePatchAlert`.
- Linha 348 ? `function` ? `getDirtyPathsForPatch`: obt?m ou monta dados relacionado a `getDirtyPathsForPatch`.
- Linha 354 ? `function` ? `syncOpenFileAfterPatch`: executa a l?gica associada a `syncOpenFileAfterPatch`.
- Linha 370 ? `function` ? `loadPatches`: carrega dados de disco ou mem?ria relacionado a `loadPatches`.
- Linha 374 ? `const function` ? `planPatch`: executa a l?gica associada a `planPatch`.
- Linha 403 ? `function` ? `renderPatchSidebar`: gera sa?da visual/textual relacionado a `renderPatchSidebar`.

### `public/preview.js`
- Linha 2 ? `function` ? `isHtmlPreviewPath`: executa a l?gica associada a `isHtmlPreviewPath`.
- Linha 6 ? `function` ? `encodePreviewPath`: executa a l?gica associada a `encodePreviewPath`.
- Linha 13 ? `function` ? `buildProjectPreviewUrl`: constr?i uma estrutura/resultado relacionado a `buildProjectPreviewUrl`.
- Linha 18 ? `function` ? `isLocalPreviewUrl`: executa a l?gica associada a `isLocalPreviewUrl`.
- Linha 22 ? `function` ? `updatePreviewPopoutState`: atualiza recurso existente relacionado a `updatePreviewPopoutState`.
- Linha 32 ? `function` ? `findProjectIndexHtml`: executa a l?gica associada a `findProjectIndexHtml`.
- Linha 43 ? `function` ? `injectPreviewBase`: executa a l?gica associada a `injectPreviewBase`.
- Linha 57 ? `function` ? `getActiveHtmlPreview`: obt?m ou monta dados relacionado a `getActiveHtmlPreview`.
- Linha 70 ? `function` ? `resolvePreviewTarget`: resolve caminho, configura??o ou refer?ncia relacionado a `resolvePreviewTarget`.
- Linha 83 ? `const function` ? `stagedHtml`: executa a l?gica associada a `stagedHtml`.
- Linha 97 ? `function` ? `renderPreviewTarget`: gera sa?da visual/textual relacionado a `renderPreviewTarget`.
- Linha 131 ? `function` ? `openPreviewPanel`: executa a l?gica associada a `openPreviewPanel`.
- Linha 146 ? `function` ? `closePreviewPanel`: executa a l?gica associada a `closePreviewPanel`.
- Linha 158 ? `function` ? `refreshPreviewPanel`: executa a l?gica associada a `refreshPreviewPanel`.
- Linha 170 ? `function` ? `popoutPreview`: executa a l?gica associada a `popoutPreview`.
- Linha 189 ? `function` ? `initPreview`: executa a l?gica associada a `initPreview`.

### `public/search.js`
- Linha 2 ? `function` ? `initSearch`: executa a l?gica associada a `initSearch`.
- Linha 29 ? `function` ? `renderSearchResults`: gera sa?da visual/textual relacionado a `renderSearchResults`.

### `public/sidebar-panels.js`
- Linha 2 ? `function` ? `loadGitStatus`: carrega dados de disco ou mem?ria relacionado a `loadGitStatus`.
- Linha 52 ? `function` ? `showGitDiffInOutput`: executa a l?gica associada a `showGitDiffInOutput`.
- Linha 63 ? `function` ? `generateGitCommitMessage`: gera artefato/sa?da relacionado a `generateGitCommitMessage`.
- Linha 76 ? `function` ? `createGitCommitFromUi`: cria recurso ou registro relacionado a `createGitCommitFromUi`.

### `public/terminal.js`
- Linha 2 ? `function` ? `logTerminal`: executa a l?gica associada a `logTerminal`.
- Linha 25 ? `function` ? `loadTerminalHistory`: carrega dados de disco ou mem?ria relacionado a `loadTerminalHistory`.
- Linha 35 ? `function` ? `saveTerminalHistory`: persiste dados relacionado a `saveTerminalHistory`.
- Linha 39 ? `function` ? `normalizeCommandResult`: executa a l?gica associada a `normalizeCommandResult`.
- Linha 50 ? `function` ? `setTerminalRunning`: atualiza estado ou configura??o relacionado a `setTerminalRunning`.
- Linha 60 ? `function` ? `clearTerminal`: executa a l?gica associada a `clearTerminal`.
- Linha 67 ? `function` ? `parseProblemsFromCommand`: interpreta texto/dados relacionado a `parseProblemsFromCommand`.
- Linha 86 ? `const function` ? `message`: executa a l?gica associada a `message`.
- Linha 108 ? `function` ? `renderProblemsFromCommand`: gera sa?da visual/textual relacionado a `renderProblemsFromCommand`.
- Linha 153 ? `function` ? `runDevCommand`: executa fluxo ou comando relacionado a `runDevCommand`.
- Linha 199 ? `function` ? `fixLastCommandWithNexus`: executa a l?gica associada a `fixLastCommandWithNexus`.
- Linha 232 ? `function` ? `toggleBottomPanel`: executa a l?gica associada a `toggleBottomPanel`.
- Linha 239 ? `function` ? `initTerminal`: executa a l?gica associada a `initTerminal`.

### `scripts/generate-index.cjs`
- Linha 270 ? `function` ? `$`: executa a l?gica associada a `$`.
- Linha 272 ? `function` ? `$all`: executa a l?gica associada a `$all`.
- Linha 273 ? `function` ? `setStatus`: atualiza estado ou configura??o relacionado a `setStatus`.
- Linha 276 ? `function` ? `api`: executa a l?gica associada a `api`.
- Linha 310 ? `function` ? `openTab`: executa a l?gica associada a `openTab`.
- Linha 317 ? `function` ? `toggleTerminal`: executa a l?gica associada a `toggleTerminal`.
- Linha 318 ? `function` ? `clearTerminal`: executa a l?gica associada a `clearTerminal`.
- Linha 319 ? `function` ? `logTerminal`: executa a l?gica associada a `logTerminal`.
- Linha 326 ? `function` ? `loadHealth`: carrega dados de disco ou mem?ria relacionado a `loadHealth`.
- Linha 335 ? `function` ? `loadFiles`: carrega dados de disco ou mem?ria relacionado a `loadFiles`.
- Linha 345 ? `function` ? `renderFileTree`: gera sa?da visual/textual relacionado a `renderFileTree`.
- Linha 366 ? `function` ? `openFile`: executa a l?gica associada a `openFile`.
- Linha 400 ? `function` ? `loadPatches`: carrega dados de disco ou mem?ria relacionado a `loadPatches`.
- Linha 410 ? `function` ? `renderPatchSidebar`: gera sa?da visual/textual relacionado a `renderPatchSidebar`.
- Linha 478 ? `function` ? `escapeHtml`: executa a l?gica associada a `escapeHtml`.
- Linha 501 ? `function` ? `loadIA`: carrega dados de disco ou mem?ria relacionado a `loadIA`.

### `src/action-executor.ts`
- Linha 20 ? `function` ? `normalizeForDiffCheck`: executa a l?gica associada a `normalizeForDiffCheck`.
- Linha 24 ? `function` ? `applyAction`: aplica altera??o relacionado a `applyAction`.
- Linha 45 ? `function` ? `createBackup`: cria recurso ou registro relacionado a `createBackup`.
- Linha 68 ? `function` ? `executeAction`: executa a l?gica associada a `executeAction`.

### `src/action-planner.ts`
- Linha 45 ? `function` ? `clampText`: executa a l?gica associada a `clampText`.
- Linha 49 ? `function` ? `normalizeRiskLevel`: executa a l?gica associada a `normalizeRiskLevel`.
- Linha 57 ? `function` ? `extractFencedJsonBlocks`: executa a l?gica associada a `extractFencedJsonBlocks`.
- Linha 62 ? `function` ? `extractLooseJsonBlocks`: executa a l?gica associada a `extractLooseJsonBlocks`.
- Linha 86 ? `function` ? `repairJsonBlock`: executa a l?gica associada a `repairJsonBlock`.
- Linha 90 ? `function` ? `parseJsonBlock`: interpreta texto/dados relacionado a `parseJsonBlock`.
- Linha 102 ? `function` ? `parseJsonCandidates`: interpreta texto/dados relacionado a `parseJsonCandidates`.
- Linha 130 ? `function` ? `buildBaseDraft`: constr?i uma estrutura/resultado relacionado a `buildBaseDraft`.
- Linha 160 ? `function` ? `validatePath`: valida entrada ou sa?da relacionado a `validatePath`.
- Linha 168 ? `function` ? `validatePackages`: valida entrada ou sa?da relacionado a `validatePackages`.
- Linha 185 ? `function` ? `validateCandidate`: valida entrada ou sa?da relacionado a `validateCandidate`.
- Linha 281 ? `function` ? `dedupeActions`: executa a l?gica associada a `dedupeActions`.
- Linha 299 ? `function` ? `hashValue`: executa a l?gica associada a `hashValue`.
- Linha 306 ? `function` ? `canonicalActionKey`: executa a l?gica associada a `canonicalActionKey`.
- Linha 332 ? `function` ? `collectCandidates`: executa a l?gica associada a `collectCandidates`.
- Linha 354 ? `function` ? `extractProposedActions`: executa a l?gica associada a `extractProposedActions`.
- Linha 377 ? `function` ? `describeAllowedCommands`: executa a l?gica associada a `describeAllowedCommands`.

### `src/active-project.ts`
- Linha 18 ? `function` ? `normalizeRootInput`: executa a l?gica associada a `normalizeRootInput`.
- Linha 40 ? `function` ? `validateWorkspaceRoot`: valida entrada ou sa?da relacionado a `validateWorkspaceRoot`.
- Linha 56 ? `function` ? `isInside`: executa a l?gica associada a `isInside`.
- Linha 61 ? `function` ? `resolveAllowedActiveProject`: resolve caminho, configura??o ou refer?ncia relacionado a `resolveAllowedActiveProject`.
- Linha 82 ? `function` ? `ensureActiveProject`: garante pr?-condi??o/estrutura relacionado a `ensureActiveProject`.
- Linha 88 ? `function` ? `getActiveProject`: obt?m ou monta dados relacionado a `getActiveProject`.
- Linha 92 ? `function` ? `setActiveProjectRoot`: atualiza estado ou configura??o relacionado a `setActiveProjectRoot`.
- Linha 98 ? `function` ? `resolveProjectRootForRequest`: resolve caminho, configura??o ou refer?ncia relacionado a `resolveProjectRootForRequest`.
- Linha 106 ? `function` ? `getAppRoot`: obt?m ou monta dados relacionado a `getAppRoot`.
- Linha 110 ? `function` ? `assertPatchActionInsideActiveProject`: executa a l?gica associada a `assertPatchActionInsideActiveProject`.

### `src/agents/antygravit-agent.ts`
- Linha 7 ? `function` ? `createAntygravitAgent`: cria recurso ou registro relacionado a `createAntygravitAgent`.

### `src/agents/blackbox-agent.ts`
- Linha 7 ? `function` ? `createBlackboxAgent`: cria recurso ou registro relacionado a `createBlackboxAgent`.
- Linha 18 ? `method` ? `run`: executa fluxo ou comando relacionado a `run`.
- Linha 39 ? `method` ? `run`: executa fluxo ou comando relacionado a `run`.

### `src/agents/claude-agent.ts`
- Linha 8 ? `function` ? `createClaudeAgent`: cria recurso ou registro relacionado a `createClaudeAgent`.
- Linha 24 ? `method` ? `run`: executa fluxo ou comando relacionado a `run`.

### `src/agents/codex-agent.ts`
- Linha 11 ? `function` ? `createCodexAgent`: cria recurso ou registro relacionado a `createCodexAgent`.
- Linha 25 ? `method` ? `run`: executa fluxo ou comando relacionado a `run`.

### `src/agents/index.ts`
- Linha 7 ? `function` ? `getAgentRegistry`: obt?m ou monta dados relacionado a `getAgentRegistry`.
- Linha 21 ? `function` ? `getEnabledAgents`: obt?m ou monta dados relacionado a `getEnabledAgents`.

### `src/agents/local-mock-agent.ts`
- Linha 3 ? `function` ? `createLocalMockAgent`: cria recurso ou registro relacionado a `createLocalMockAgent`.
- Linha 9 ? `method` ? `run`: executa fluxo ou comando relacionado a `run`.

### `src/agents/shared.ts`
- Linha 2 ? `function` ? `isEnabledEnv`: executa a l?gica associada a `isEnabledEnv`.
- Linha 10 ? `function` ? `buildBaseAgentPrompt`: constr?i uma estrutura/resultado relacionado a `buildBaseAgentPrompt`.
- Linha 36 ? `function` ? `buildMockAgentResponse`: constr?i uma estrutura/resultado relacionado a `buildMockAgentResponse`.

### `src/agents/types.ts`
- Linha 31 ? `method` ? `run`: executa fluxo ou comando relacionado a `run`.

### `src/ai/ai-edit-planner.ts`
- Linha 42 ? `function` ? `uniquePaths`: executa a l?gica associada a `uniquePaths`.
- Linha 46 ? `function` ? `applyFallbackInstruction`: aplica altera??o relacionado a `applyFallbackInstruction`.
- Linha 62 ? `function` ? `readContextFiles`: l? conte?do relacionado a `readContextFiles`.
- Linha 74 ? `function` ? `generateProposedFiles`: gera artefato/sa?da relacionado a `generateProposedFiles`.
- Linha 119 ? `function` ? `planAiEdit`: executa a l?gica associada a `planAiEdit`.

### `src/ai/local-codex-agent.ts`
- Linha 33 ? `function` ? `extractJsonObject`: executa a l?gica associada a `extractJsonObject`.
- Linha 45 ? `function` ? `parseLocalCodexResponse`: interpreta texto/dados relacionado a `parseLocalCodexResponse`.
- Linha 76 ? `function` ? `buildLocalCodexPrompt`: constr?i uma estrutura/resultado relacionado a `buildLocalCodexPrompt`.
- Linha 108 ? `class` ? `LocalCodexAgent`: define estrutura/servi?o `LocalCodexAgent` e agrupa comportamento relacionado.
- Linha 115 ? `method` ? `runTask`: executa fluxo ou comando relacionado a `runTask`.

### `src/app/agents/artifacts.ts`
- Linha 14 ? `function` ? `extensionForArtifact`: executa a l?gica associada a `extensionForArtifact`.
- Linha 36 ? `function` ? `contentAsString`: executa a l?gica associada a `contentAsString`.
- Linha 40 ? `class` ? `ArtifactStore`: define estrutura/servi?o `ArtifactStore` e agrupa comportamento relacionado.
- Linha 43 ? `method` ? `ensureProjectArtifactDir`: garante pr?-condi??o/estrutura relacionado a `ensureProjectArtifactDir`.
- Linha 49 ? `method` ? `loadIndex`: carrega dados de disco ou mem?ria relacionado a `loadIndex`.
- Linha 70 ? `method` ? `saveIndex`: persiste dados relacionado a `saveIndex`.
- Linha 75 ? `method` ? `saveArtifact`: persiste dados relacionado a `saveArtifact`.
- Linha 113 ? `method` ? `listArtifacts`: m?todo `listArtifacts` da classe, usado no comportamento interno do objeto.

### `src/app/agents/code-generation.ts`
- Linha 11 ? `function` ? `detectProjectStack`: detecta padr?o ou stack relacionado a `detectProjectStack`.
- Linha 40 ? `function` ? `defaultPathForAgent`: executa a l?gica associada a `defaultPathForAgent`.
- Linha 57 ? `function` ? `languageForPath`: executa a l?gica associada a `languageForPath`.
- Linha 74 ? `function` ? `agentCodegenPersona`: executa a l?gica associada a `agentCodegenPersona`.
- Linha 99 ? `function` ? `buildProfessionalStandardsBlock`: constr?i uma estrutura/resultado relacionado a `buildProfessionalStandardsBlock`.
- Linha 103 ? `function` ? `codeFenceLanguage`: executa a l?gica associada a `codeFenceLanguage`.
- Linha 110 ? `function` ? `titleFromGoal`: executa a l?gica associada a `titleFromGoal`.
- Linha 140 ? `function` ? `inferSiteBrief`: executa a l?gica associada a `inferSiteBrief`.
- Linha 344 ? `function` ? `buildProfessionalHtmlFallback`: constr?i uma estrutura/resultado relacionado a `buildProfessionalHtmlFallback`.
- Linha 791 ? `function` ? `buildProfessionalMarkdownFallback`: constr?i uma estrutura/resultado relacionado a `buildProfessionalMarkdownFallback`.
- Linha 829 ? `function` ? `buildProfessionalTypeScriptFallback`: constr?i uma estrutura/resultado relacionado a `buildProfessionalTypeScriptFallback`.
- Linha 837 ? `function` ? `createNexusGeneratedResult`: cria recurso ou registro relacionado a `createNexusGeneratedResult`.
- Linha 852 ? `function` ? `buildProfessionalFallbackContent`: constr?i uma estrutura/resultado relacionado a `buildProfessionalFallbackContent`.
- Linha 905 ? `function` ? `generateCodeWithLLM`: gera artefato/sa?da relacionado a `generateCodeWithLLM`.

### `src/app/agents/history.ts`
- Linha 23 ? `class` ? `ProjectHistoryManager`: define estrutura/servi?o `ProjectHistoryManager` e agrupa comportamento relacionado.
- Linha 25 ? `method` ? `ensureProjectDir`: garante pr?-condi??o/estrutura relacionado a `ensureProjectDir`.
- Linha 30 ? `method` ? `historyPath`: m?todo `historyPath` da classe, usado no comportamento interno do objeto.
- Linha 34 ? `method` ? `load_project_history`: carrega dados de disco ou mem?ria relacionado a `load_project_history`.
- Linha 47 ? `method` ? `save_project_history`: persiste dados relacionado a `save_project_history`.
- Linha 52 ? `method` ? `add_message`: m?todo `add_message` da classe, usado no comportamento interno do objeto.
- Linha 69 ? `method` ? `add_artifact`: m?todo `add_artifact` da classe, usado no comportamento interno do objeto.
- Linha 79 ? `method` ? `summarize_if_needed`: m?todo `summarize_if_needed` da classe, usado no comportamento interno do objeto.

### `src/app/agents/registry.ts`
- Linha 94 ? `class` ? `AgentRegistry`: define estrutura/servi?o `AgentRegistry` e agrupa comportamento relacionado.
- Linha 97 ? `method` ? `constructor`: m?todo `constructor` da classe, usado no comportamento interno do objeto.
- Linha 103 ? `method` ? `register`: m?todo `register` da classe, usado no comportamento interno do objeto.
- Linha 107 ? `method` ? `get`: obt?m ou monta dados relacionado a `get`.
- Linha 111 ? `method` ? `list`: m?todo `list` da classe, usado no comportamento interno do objeto.

### `src/app/agents/routing.ts`
- Linha 2 ? `function` ? `suggestAgentId`: executa a l?gica associada a `suggestAgentId`.
- Linha 52 ? `function` ? `isCodeCreationGoal`: executa a l?gica associada a `isCodeCreationGoal`.
- Linha 74 ? `function` ? `shouldRequirePlan`: executa a l?gica associada a `shouldRequirePlan`.
- Linha 83 ? `function` ? `extractRequestedFilePath`: executa a l?gica associada a `extractRequestedFilePath`.

### `src/app/agents/runner.ts`
- Linha 35 ? `function` ? `matchGoal`: executa a l?gica associada a `matchGoal`.
- Linha 40 ? `function` ? `buildRequestedFileContent`: constr?i uma estrutura/resultado relacionado a `buildRequestedFileContent`.
- Linha 51 ? `function` ? `getGeneratedDocsDraftPath`: obt?m ou monta dados relacionado a `getGeneratedDocsDraftPath`.
- Linha 63 ? `function` ? `createPlanMarkdown`: cria recurso ou registro relacionado a `createPlanMarkdown`.
- Linha 85 ? `class` ? `AgentRunner`: define estrutura/servi?o `AgentRunner` e agrupa comportamento relacionado.
- Linha 94 ? `method` ? `constructor`: m?todo `constructor` da classe, usado no comportamento interno do objeto.
- Linha 103 ? `method` ? `restorePersistedRuns`: m?todo `restorePersistedRuns` da classe, usado no comportamento interno do objeto.
- Linha 116 ? `method` ? `run_agent`: executa fluxo ou comando relacionado a `run_agent`.
- Linha 168 ? `method` ? `getRun`: obt?m ou monta dados relacionado a `getRun`.
- Linha 172 ? `method` ? `listRuns`: m?todo `listRuns` da classe, usado no comportamento interno do objeto.
- Linha 179 ? `method` ? `getEvents`: obt?m ou monta dados relacionado a `getEvents`.
- Linha 183 ? `method` ? `getArtifacts`: obt?m ou monta dados relacionado a `getArtifacts`.
- Linha 187 ? `method` ? `cancelRun`: m?todo `cancelRun` da classe, usado no comportamento interno do objeto.
- Linha 210 ? `method` ? `executeRun`: m?todo `executeRun` da classe, usado no comportamento interno do objeto.
- Linha 265 ? `method` ? `executeScenario`: m?todo `executeScenario` da classe, usado no comportamento interno do objeto.
- Linha 290 ? `method` ? `executeCodeAgentScenario`: m?todo `executeCodeAgentScenario` da classe, usado no comportamento interno do objeto.
- Linha 310 ? `method` ? `proposePlanPatch`: m?todo `proposePlanPatch` da classe, usado no comportamento interno do objeto.
- Linha 336 ? `method` ? `executeCodegenFlow`: m?todo `executeCodegenFlow` da classe, usado no comportamento interno do objeto.
- Linha 413 ? `method` ? `executeDocsScenario`: m?todo `executeDocsScenario` da classe, usado no comportamento interno do objeto.
- Linha 439 ? `method` ? `executeSecurityScenario`: m?todo `executeSecurityScenario` da classe, usado no comportamento interno do objeto.
- Linha 464 ? `method` ? `executeTestScenario`: m?todo `executeTestScenario` da classe, usado no comportamento interno do objeto.
- Linha 480 ? `method` ? `executeDebugScenario`: m?todo `executeDebugScenario` da classe, usado no comportamento interno do objeto.
- Linha 504 ? `method` ? `executeGeneralScenario`: m?todo `executeGeneralScenario` da classe, usado no comportamento interno do objeto.
- Linha 538 ? `method` ? `executeSiteBuilderScenario`: m?todo `executeSiteBuilderScenario` da classe, usado no comportamento interno do objeto.
- Linha 542 ? `method` ? `runTool`: executa fluxo ou comando relacionado a `runTool`.
- Linha 655 ? `method` ? `ensureNotCancelled`: garante pr?-condi??o/estrutura relacionado a `ensureNotCancelled`.
- Linha 661 ? `method` ? `recordArtifact`: m?todo `recordArtifact` da classe, usado no comportamento interno do objeto.
- Linha 684 ? `method` ? `emitEvent`: m?todo `emitEvent` da classe, usado no comportamento interno do objeto.
- Linha 711 ? `method` ? `pushStep`: m?todo `pushStep` da classe, usado no comportamento interno do objeto.
- Linha 719 ? `method` ? `completeStep`: m?todo `completeStep` da classe, usado no comportamento interno do objeto.
- Linha 736 ? `method` ? `updateRun`: atualiza recurso existente relacionado a `updateRun`.
- Linha 747 ? `method` ? `failRun`: m?todo `failRun` da classe, usado no comportamento interno do objeto.

### `src/app/agents/tools.ts`
- Linha 49 ? `function` ? `nowIso`: executa a l?gica associada a `nowIso`.
- Linha 53 ? `function` ? `stringifyTree`: executa a l?gica associada a `stringifyTree`.
- Linha 67 ? `function` ? `buildPatchText`: constr?i uma estrutura/resultado relacionado a `buildPatchText`.
- Linha 80 ? `function` ? `runToolCommand`: executa fluxo ou comando relacionado a `runToolCommand`.
- Linha 96 ? `function` ? `saveArtifact`: persiste dados relacionado a `saveArtifact`.
- Linha 116 ? `function` ? `createPatchAction`: cria recurso ou registro relacionado a `createPatchAction`.
- Linha 124 ? `function` ? `executeReadProjectTree`: executa a l?gica associada a `executeReadProjectTree`.
- Linha 151 ? `function` ? `executeReadFile`: executa a l?gica associada a `executeReadFile`.
- Linha 172 ? `function` ? `executeSearchFiles`: executa a l?gica associada a `executeSearchFiles`.
- Linha 242 ? `function` ? `executeProposePatch`: executa a l?gica associada a `executeProposePatch`.
- Linha 324 ? `function` ? `executeRunTerminalCommand`: executa a l?gica associada a `executeRunTerminalCommand`.
- Linha 369 ? `function` ? `executeRunTests`: executa a l?gica associada a `executeRunTests`.
- Linha 393 ? `function` ? `executeRunBuild`: executa a l?gica associada a `executeRunBuild`.
- Linha 404 ? `function` ? `executeGitStatus`: executa a l?gica associada a `executeGitStatus`.
- Linha 414 ? `function` ? `executeGitDiff`: executa a l?gica associada a `executeGitDiff`.
- Linha 424 ? `function` ? `executeGenerateReadme`: executa a l?gica associada a `executeGenerateReadme`.
- Linha 493 ? `function` ? `extractFirstErrorLocation`: executa a l?gica associada a `extractFirstErrorLocation`.
- Linha 515 ? `function` ? `executeAnalyzeError`: executa a l?gica associada a `executeAnalyzeError`.
- Linha 581 ? `class` ? `ToolRegistry`: define estrutura/servi?o `ToolRegistry` e agrupa comportamento relacionado.
- Linha 584 ? `method` ? `constructor`: m?todo `constructor` da classe, usado no comportamento interno do objeto.
- Linha 598 ? `method` ? `list`: m?todo `list` da classe, usado no comportamento interno do objeto.
- Linha 602 ? `method` ? `has`: m?todo `has` da classe, usado no comportamento interno do objeto.
- Linha 606 ? `method` ? `execute`: m?todo `execute` da classe, usado no comportamento interno do objeto.
- Linha 619 ? `method` ? `createToolCall`: cria recurso ou registro relacionado a `createToolCall`.

### `src/app/agents/utils.ts`
- Linha 8 ? `function` ? `redactSensitiveText`: executa a l?gica associada a `redactSensitiveText`.
- Linha 16 ? `function` ? `truncateText`: executa a l?gica associada a `truncateText`.
- Linha 20 ? `function` ? `nowIso`: executa a l?gica associada a `nowIso`.
- Linha 24 ? `function` ? `sanitizeArtifactPreview`: executa a l?gica associada a `sanitizeArtifactPreview`.

### `src/app/ai/ai-settings.ts`
- Linha 51 ? `function` ? `clearAISettingsCache`: executa a l?gica associada a `clearAISettingsCache`.
- Linha 55 ? `function` ? `loadAISettings`: carrega dados de disco ou mem?ria relacionado a `loadAISettings`.
- Linha 112 ? `function` ? `saveAISettings`: persiste dados relacionado a `saveAISettings`.
- Linha 160 ? `function` ? `maskApiKey`: executa a l?gica associada a `maskApiKey`.
- Linha 165 ? `function` ? `hasProviderKey`: executa a l?gica associada a `hasProviderKey`.
- Linha 170 ? `function` ? `getProviderStatus`: obt?m ou monta dados relacionado a `getProviderStatus`.
- Linha 196 ? `function` ? `resolveProviderConfig`: resolve caminho, configura??o ou refer?ncia relacionado a `resolveProviderConfig`.

### `src/app/ai/context-builder.ts`
- Linha 24 ? `function` ? `estimateTokens`: executa a l?gica associada a `estimateTokens`.
- Linha 28 ? `function` ? `latestUserMessage`: executa a l?gica associada a `latestUserMessage`.
- Linha 37 ? `function` ? `extractMentionedPaths`: executa a l?gica associada a `extractMentionedPaths`.
- Linha 43 ? `function` ? `addIfAvailable`: executa a l?gica associada a `addIfAvailable`.
- Linha 51 ? `function` ? `selectContextFiles`: executa a l?gica associada a `selectContextFiles`.
- Linha 128 ? `function` ? `readContextSummary`: l? conte?do relacionado a `readContextSummary`.
- Linha 155 ? `class` ? `ContextBuilder`: define estrutura/servi?o `ContextBuilder` e agrupa comportamento relacionado.
- Linha 157 ? `method` ? `buildContext`: constr?i uma estrutura/resultado relacionado a `buildContext`.

### `src/app/ai/provider-router.ts`
- Linha 28 ? `function` ? `isLocalProvider`: executa a l?gica associada a `isLocalProvider`.
- Linha 61 ? `function` ? `classifyTask`: classifica entrada relacionado a `classifyTask`.
- Linha 77 ? `function` ? `getLatestUserMessage`: obt?m ou monta dados relacionado a `getLatestUserMessage`.
- Linha 83 ? `function` ? `buildProvider`: constr?i uma estrutura/resultado relacionado a `buildProvider`.
- Linha 104 ? `class` ? `AIProviderRouter`: define estrutura/servi?o `AIProviderRouter` e agrupa comportamento relacionado.
- Linha 107 ? `method` ? `getSettings`: obt?m ou monta dados relacionado a `getSettings`.
- Linha 112 ? `method` ? `filterReachableOrder`: m?todo `filterReachableOrder` da classe, usado no comportamento interno do objeto.
- Linha 137 ? `method` ? `configuredFallbackProviders`: m?todo `configuredFallbackProviders` da classe, usado no comportamento interno do objeto.
- Linha 145 ? `method` ? `orderedCloudProviders`: m?todo `orderedCloudProviders` da classe, usado no comportamento interno do objeto.
- Linha 160 ? `method` ? `prioritizePremiumProvider`: m?todo `prioritizePremiumProvider` da classe, usado no comportamento interno do objeto.
- Linha 165 ? `method` ? `sortProvidersByReliability`: m?todo `sortProvidersByReliability` da classe, usado no comportamento interno do objeto.
- Linha 171 ? `method` ? `configuredLocalProviders`: m?todo `configuredLocalProviders` da classe, usado no comportamento interno do objeto.
- Linha 177 ? `method` ? `getStatus`: obt?m ou monta dados relacionado a `getStatus`.
- Linha 241 ? `method` ? `routeChatRequest`: m?todo `routeChatRequest` da classe, usado no comportamento interno do objeto.
- Linha 306 ? `method` ? `buildProviderOrder`: constr?i uma estrutura/resultado relacionado a `buildProviderOrder`.
- Linha 343 ? `method` ? `tryInOrder`: m?todo `tryInOrder` da classe, usado no comportamento interno do objeto.
- Linha 399 ? `method` ? `buildNoProviderMessage`: constr?i uma estrutura/resultado relacionado a `buildNoProviderMessage`.
- Linha 447 ? `method` ? `buildMessages`: constr?i uma estrutura/resultado relacionado a `buildMessages`.

### `src/app/ai/providers/anthropic-provider.ts`
- Linha 4 ? `function` ? `estimateTokens`: executa a l?gica associada a `estimateTokens`.
- Linha 8 ? `class` ? `AnthropicProvider`: define estrutura/servi?o `AnthropicProvider` e agrupa comportamento relacionado.
- Linha 13 ? `method` ? `constructor`: m?todo `constructor` da classe, usado no comportamento interno do objeto.
- Linha 18 ? `method` ? `isConfigured`: m?todo `isConfigured` da classe, usado no comportamento interno do objeto.
- Linha 22 ? `method` ? `chat`: m?todo `chat` da classe, usado no comportamento interno do objeto.

### `src/app/ai/providers/gemini-provider.ts`
- Linha 7 ? `class` ? `GeminiProvider`: define estrutura/servi?o `GeminiProvider` e agrupa comportamento relacionado.
- Linha 12 ? `method` ? `constructor`: m?todo `constructor` da classe, usado no comportamento interno do objeto.
- Linha 17 ? `method` ? `isConfigured`: m?todo `isConfigured` da classe, usado no comportamento interno do objeto.
- Linha 21 ? `method` ? `chat`: m?todo `chat` da classe, usado no comportamento interno do objeto.

### `src/app/ai/providers/groq-openrouter-provider.ts`
- Linha 12 ? `function` ? `callOpenAICompat`: executa a l?gica associada a `callOpenAICompat`.
- Linha 52 ? `class` ? `GroqProvider`: define estrutura/servi?o `GroqProvider` e agrupa comportamento relacionado.
- Linha 57 ? `method` ? `constructor`: m?todo `constructor` da classe, usado no comportamento interno do objeto.
- Linha 62 ? `method` ? `isConfigured`: m?todo `isConfigured` da classe, usado no comportamento interno do objeto.
- Linha 66 ? `method` ? `chat`: m?todo `chat` da classe, usado no comportamento interno do objeto.
- Linha 77 ? `class` ? `OpenRouterProvider`: define estrutura/servi?o `OpenRouterProvider` e agrupa comportamento relacionado.
- Linha 82 ? `method` ? `constructor`: m?todo `constructor` da classe, usado no comportamento interno do objeto.
- Linha 87 ? `method` ? `isConfigured`: m?todo `isConfigured` da classe, usado no comportamento interno do objeto.
- Linha 91 ? `method` ? `chat`: m?todo `chat` da classe, usado no comportamento interno do objeto.

### `src/app/ai/providers/nexus-local-provider.ts`
- Linha 3 ? `function` ? `getErrorMessage`: obt?m ou monta dados relacionado a `getErrorMessage`.
- Linha 7 ? `function` ? `messagesToPrompt`: executa a l?gica associada a `messagesToPrompt`.
- Linha 17 ? `class` ? `NexusLocalProvider`: define estrutura/servi?o `NexusLocalProvider` e agrupa comportamento relacionado.
- Linha 22 ? `method` ? `constructor`: m?todo `constructor` da classe, usado no comportamento interno do objeto.
- Linha 31 ? `method` ? `isConfigured`: m?todo `isConfigured` da classe, usado no comportamento interno do objeto.
- Linha 35 ? `method` ? `isReachable`: m?todo `isReachable` da classe, usado no comportamento interno do objeto.
- Linha 47 ? `method` ? `chat`: m?todo `chat` da classe, usado no comportamento interno do objeto.

### `src/app/ai/providers/ollama-provider.ts`
- Linha 13 ? `function` ? `estimateTokens`: executa a l?gica associada a `estimateTokens`.
- Linha 17 ? `function` ? `getErrorMessage`: obt?m ou monta dados relacionado a `getErrorMessage`.
- Linha 21 ? `class` ? `OllamaProvider`: define estrutura/servi?o `OllamaProvider` e agrupa comportamento relacionado.
- Linha 26 ? `method` ? `constructor`: m?todo `constructor` da classe, usado no comportamento interno do objeto.
- Linha 35 ? `method` ? `isConfigured`: m?todo `isConfigured` da classe, usado no comportamento interno do objeto.
- Linha 39 ? `method` ? `isReachable`: m?todo `isReachable` da classe, usado no comportamento interno do objeto.
- Linha 53 ? `method` ? `chat`: m?todo `chat` da classe, usado no comportamento interno do objeto.

### `src/app/ai/providers/openai-provider.ts`
- Linha 11 ? `function` ? `estimateTokens`: executa a l?gica associada a `estimateTokens`.
- Linha 15 ? `function` ? `readErrorSnippet`: l? conte?do relacionado a `readErrorSnippet`.
- Linha 20 ? `class` ? `OpenAIProvider`: define estrutura/servi?o `OpenAIProvider` e agrupa comportamento relacionado.
- Linha 25 ? `method` ? `constructor`: m?todo `constructor` da classe, usado no comportamento interno do objeto.
- Linha 30 ? `method` ? `isConfigured`: m?todo `isConfigured` da classe, usado no comportamento interno do objeto.
- Linha 34 ? `method` ? `chat`: m?todo `chat` da classe, usado no comportamento interno do objeto.

### `src/app/ai/providers/types.ts`
- Linha 17 ? `method` ? `isConfigured`: m?todo `isConfigured` da classe, usado no comportamento interno do objeto.
- Linha 18 ? `method` ? `chat`: m?todo `chat` da classe, usado no comportamento interno do objeto.
- Linha 20 ? `function` ? `estimateTokens`: executa a l?gica associada a `estimateTokens`.

### `src/app/ai/usage-tracker.ts`
- Linha 24 ? `function` ? `nowIso`: executa a l?gica associada a `nowIso`.
- Linha 28 ? `function` ? `getRate`: obt?m ou monta dados relacionado a `getRate`.
- Linha 44 ? `function` ? `ensureStore`: garante pr?-condi??o/estrutura relacionado a `ensureStore`.
- Linha 53 ? `function` ? `readDb`: l? conte?do relacionado a `readDb`.
- Linha 64 ? `function` ? `writeDb`: grava conte?do relacionado a `writeDb`.
- Linha 69 ? `class` ? `UsageTracker`: define estrutura/servi?o `UsageTracker` e agrupa comportamento relacionado.
- Linha 71 ? `method` ? `recordUsage`: m?todo `recordUsage` da classe, usado no comportamento interno do objeto.

### `src/app/runs/run-event-bus.ts`
- Linha 4 ? `class` ? `RunEventBus`: executa fluxo ou comando relacionado a `RunEventBus`.
- Linha 9 ? `method` ? `constructor`: m?todo `constructor` da classe, usado no comportamento interno do objeto.
- Linha 13 ? `method` ? `subscribe`: m?todo `subscribe` da classe, usado no comportamento interno do objeto.
- Linha 21 ? `method` ? `unsubscribe`: m?todo `unsubscribe` da classe, usado no comportamento interno do objeto.
- Linha 31 ? `method` ? `publish`: m?todo `publish` da classe, usado no comportamento interno do objeto.
- Linha 44 ? `method` ? `getRecentEvents`: obt?m ou monta dados relacionado a `getRecentEvents`.

### `src/app/runs/run-store.ts`
- Linha 37 ? `function` ? `ensureStore`: garante pr?-condi??o/estrutura relacionado a `ensureStore`.
- Linha 46 ? `function` ? `appendJsonLine`: executa a l?gica associada a `appendJsonLine`.
- Linha 51 ? `class` ? `AgentRunStore`: define estrutura/servi?o `AgentRunStore` e agrupa comportamento relacionado.
- Linha 53 ? `method` ? `recordRunStarted`: m?todo `recordRunStarted` da classe, usado no comportamento interno do objeto.
- Linha 65 ? `method` ? `recordRunStatus`: m?todo `recordRunStatus` da classe, usado no comportamento interno do objeto.
- Linha 74 ? `method` ? `recordRunEvent`: m?todo `recordRunEvent` da classe, usado no comportamento interno do objeto.
- Linha 83 ? `method` ? `loadProjectRuns`: carrega dados de disco ou mem?ria relacionado a `loadProjectRuns`.
- Linha 108 ? `method` ? `loadRunSnapshots`: carrega dados de disco ou mem?ria relacionado a `loadRunSnapshots`.
- Linha 166 ? `method` ? `markInterruptedRunsOnBoot`: m?todo `markInterruptedRunsOnBoot` da classe, usado no comportamento interno do objeto.

### `src/app/web/server.ts`
- Linha 30 ? `function` ? `readLatestUserMessage`: l? conte?do relacionado a `readLatestUserMessage`.
- Linha 45 ? `function` ? `normalizeMessages`: executa a l?gica associada a `normalizeMessages`.
- Linha 64 ? `function` ? `wait`: executa a l?gica associada a `wait`.
- Linha 68 ? `function` ? `waitForSettledRun`: executa a l?gica associada a `waitForSettledRun`.
- Linha 82 ? `function` ? `collectPatchPaths`: executa a l?gica associada a `collectPatchPaths`.
- Linha 97 ? `function` ? `collectPatchIds`: executa a l?gica associada a `collectPatchIds`.
- Linha 120 ? `function` ? `collectPreviewUrl`: executa a l?gica associada a `collectPreviewUrl`.
- Linha 129 ? `function` ? `buildNextActions`: constr?i uma estrutura/resultado relacionado a `buildNextActions`.
- Linha 140 ? `function` ? `writeSseEvent`: grava conte?do relacionado a `writeSseEvent`.
- Linha 145 ? `function` ? `serializeAgentEvent`: executa a l?gica associada a `serializeAgentEvent`.
- Linha 156 ? `function` ? `isFinalAgentEvent`: executa a l?gica associada a `isFinalAgentEvent`.
- Linha 160 ? `function` ? `registerAgentRoutes`: executa a l?gica associada a `registerAgentRoutes`.
- Linha 484 ? `const function` ? `close`: executa a l?gica associada a `close`.
- Linha 492 ? `const function` ? `listener`: executa a l?gica associada a `listener`.

### `src/app/web/staged-files.ts`
- Linha 40 ? `function` ? `loadDb`: carrega dados de disco ou mem?ria relacionado a `loadDb`.
- Linha 56 ? `function` ? `saveDb`: persiste dados relacionado a `saveDb`.
- Linha 62 ? `function` ? `normalizeForStaleCheck`: executa a l?gica associada a `normalizeForStaleCheck`.
- Linha 66 ? `function` ? `addStagedFile`: executa a l?gica associada a `addStagedFile`.
- Linha 106 ? `function` ? `listStagedFiles`: executa a l?gica associada a `listStagedFiles`.
- Linha 111 ? `function` ? `getStagedFile`: obt?m ou monta dados relacionado a `getStagedFile`.
- Linha 116 ? `function` ? `removeStagedFile`: executa a l?gica associada a `removeStagedFile`.
- Linha 122 ? `function` ? `clearStagedFiles`: executa a l?gica associada a `clearStagedFiles`.
- Linha 128 ? `function` ? `applyStagedFile`: aplica altera??o relacionado a `applyStagedFile`.

### `src/backup-store.ts`
- Linha 18 ? `function` ? `walk`: executa a l?gica associada a `walk`.
- Linha 37 ? `function` ? `entryFromPath`: executa a l?gica associada a `entryFromPath`.
- Linha 57 ? `function` ? `listBackups`: executa a l?gica associada a `listBackups`.
- Linha 60 ? `const function` ? `entries`: executa a l?gica associada a `entries`.
- Linha 76 ? `function` ? `getBackup`: obt?m ou monta dados relacionado a `getBackup`.
- Linha 80 ? `function` ? `previewBackupRestore`: executa a l?gica associada a `previewBackupRestore`.
- Linha 100 ? `function` ? `restoreBackup`: executa a l?gica associada a `restoreBackup`.

### `src/command-runner.ts`
- Linha 61 ? `function` ? `truncateLog`: executa a l?gica associada a `truncateLog`.
- Linha 69 ? `function` ? `createCommandString`: cria recurso ou registro relacionado a `createCommandString`.
- Linha 73 ? `function` ? `nowIso`: executa a l?gica associada a `nowIso`.
- Linha 77 ? `function` ? `timeoutForCommand`: executa a l?gica associada a `timeoutForCommand`.
- Linha 84 ? `function` ? `executeProcess`: executa a l?gica associada a `executeProcess`.
- Linha 159 ? `function` ? `listAllowedCommands`: executa a l?gica associada a `listAllowedCommands`.
- Linha 163 ? `function` ? `resolveAllowedCommand`: resolve caminho, configura??o ou refer?ncia relacionado a `resolveAllowedCommand`.
- Linha 183 ? `function` ? `runCommand`: executa fluxo ou comando relacionado a `runCommand`.
- Linha 196 ? `function` ? `installPackages`: executa a l?gica associada a `installPackages`.

### `src/error-analyzer.ts`
- Linha 42 ? `function` ? `suggestForFile`: executa a l?gica associada a `suggestForFile`.
- Linha 52 ? `function` ? `normalizePath`: executa a l?gica associada a `normalizePath`.
- Linha 60 ? `function` ? `parseTypeScriptErrors`: interpreta texto/dados relacionado a `parseTypeScriptErrors`.
- Linha 86 ? `function` ? `parseNodeErrors`: interpreta texto/dados relacionado a `parseNodeErrors`.
- Linha 130 ? `function` ? `parseNpmErrors`: interpreta texto/dados relacionado a `parseNpmErrors`.
- Linha 155 ? `function` ? `parseGenericErrors`: interpreta texto/dados relacionado a `parseGenericErrors`.
- Linha 181 ? `function` ? `dedupeErrors`: executa a l?gica associada a `dedupeErrors`.
- Linha 199 ? `function` ? `analyzeErrorOutput`: executa a l?gica associada a `analyzeErrorOutput`.
- Linha 228 ? `function` ? `formatErrorSummary`: executa a l?gica associada a `formatErrorSummary`.

### `src/file-content-hash.ts`
- Linha 2 ? `function` ? `hashFileContent`: executa a l?gica associada a `hashFileContent`.
- Linha 6 ? `function` ? `isExpectedFileHash`: executa a l?gica associada a `isExpectedFileHash`.

### `src/intent-classifier.ts`
- Linha 85 ? `function` ? `escapeRegExp`: executa a l?gica associada a `escapeRegExp`.
- Linha 89 ? `function` ? `classifyIntent`: classifica entrada relacionado a `classifyIntent`.

### `src/local-security.ts`
- Linha 28 ? `function` ? `parseOrigins`: interpreta texto/dados relacionado a `parseOrigins`.
- Linha 35 ? `function` ? `getAllowedOrigins`: obt?m ou monta dados relacionado a `getAllowedOrigins`.
- Linha 39 ? `function` ? `getLocalAuthToken`: obt?m ou monta dados relacionado a `getLocalAuthToken`.
- Linha 49 ? `function` ? `sameValue`: executa a l?gica associada a `sameValue`.
- Linha 55 ? `function` ? `normalizeOrigin`: executa a l?gica associada a `normalizeOrigin`.
- Linha 64 ? `function` ? `isAllowedOrigin`: executa a l?gica associada a `isAllowedOrigin`.
- Linha 69 ? `function` ? `configureLocalCors`: executa a l?gica associada a `configureLocalCors`.
- Linha 93 ? `function` ? `hasAllowedReferer`: executa a l?gica associada a `hasAllowedReferer`.
- Linha 102 ? `function` ? `isSensitiveRequest`: executa a l?gica associada a `isSensitiveRequest`.
- Linha 112 ? `function` ? `readToken`: l? conte?do relacionado a `readToken`.
- Linha 121 ? `function` ? `requireLocalTrust`: executa a l?gica associada a `requireLocalTrust`.
- Linha 142 ? `function` ? `buildLocalSecurityPayload`: constr?i uma estrutura/resultado relacionado a `buildLocalSecurityPayload`.
- Linha 151 ? `function` ? `requireConfirmation`: executa a l?gica associada a `requireConfirmation`.

### `src/multi-agent-coordinator.ts`
- Linha 47 ? `function` ? `shouldResearch`: executa a l?gica associada a `shouldResearch`.
- Linha 54 ? `function` ? `extractUrls`: executa a l?gica associada a `extractUrls`.
- Linha 58 ? `function` ? `extractRepoName`: executa a l?gica associada a `extractRepoName`.
- Linha 63 ? `function` ? `stringifyResearch`: executa a l?gica associada a `stringifyResearch`.
- Linha 76 ? `function` ? `runResearch`: executa fluxo ou comando relacionado a `runResearch`.
- Linha 100 ? `function` ? `buildMergedResponse`: constr?i uma estrutura/resultado relacionado a `buildMergedResponse`.
- Linha 128 ? `function` ? `summarizeActions`: executa a l?gica associada a `summarizeActions`.
- Linha 141 ? `function` ? `coordinateAgents`: executa a l?gica associada a `coordinateAgents`.
- Linha 146 ? `const function` ? `selectedAgents`: executa a l?gica associada a `selectedAgents`.

### `src/nexus-data-dir.ts`
- Linha 5 ? `function` ? `getNexusDataDir`: obt?m ou monta dados relacionado a `getNexusDataDir`.
- Linha 9 ? `function` ? `resolveNexusDataPath`: resolve caminho, configura??o ou refer?ncia relacionado a `resolveNexusDataPath`.
- Linha 13 ? `function` ? `ensureNexusDataDir`: garante pr?-condi??o/estrutura relacionado a `ensureNexusDataDir`.
- Linha 19 ? `function` ? `getStorePath`: obt?m ou monta dados relacionado a `getStorePath`.
- Linha 23 ? `function` ? `isRetryableReplaceError`: executa a l?gica associada a `isRetryableReplaceError`.
- Linha 28 ? `function` ? `wait`: executa a l?gica associada a `wait`.
- Linha 32 ? `function` ? `replaceFile`: executa a l?gica associada a `replaceFile`.
- Linha 57 ? `function` ? `atomicWriteFile`: executa a l?gica associada a `atomicWriteFile`.
- Linha 67 ? `function` ? `atomicWriteJson`: executa a l?gica associada a `atomicWriteJson`.

### `src/nexus-orchestrator.ts`
- Linha 13 ? `function` ? `orchestrate`: executa a l?gica associada a `orchestrate`.
- Linha 19 ? `function` ? `getAgentStatus`: obt?m ou monta dados relacionado a `getAgentStatus`.

### `src/orchestration-mode.ts`
- Linha 57 ? `function` ? `matchesAny`: executa a l?gica associada a `matchesAny`.
- Linha 61 ? `function` ? `selectOrchestrationMode`: executa a l?gica associada a `selectOrchestrationMode`.

### `src/patch-payload.ts`
- Linha 4 ? `function` ? `isPatchAction`: executa a l?gica associada a `isPatchAction`.
- Linha 13 ? `function` ? `buildUnifiedDiff`: constr?i uma estrutura/resultado relacionado a `buildUnifiedDiff`.
- Linha 25 ? `function` ? `resolvePatchSides`: resolve caminho, configura??o ou refer?ncia relacionado a `resolvePatchSides`.
- Linha 65 ? `function` ? `buildPatchPayload`: constr?i uma estrutura/resultado relacionado a `buildPatchPayload`.

### `src/patches/patch-applier.ts`
- Linha 3 ? `function` ? `applyPendingPatchAction`: aplica altera??o relacionado a `applyPendingPatchAction`.

### `src/patches/patch-history-store.ts`
- Linha 36 ? `function` ? `nowIso`: executa a l?gica associada a `nowIso`.
- Linha 40 ? `function` ? `ensureStorage`: garante pr?-condi??o/estrutura relacionado a `ensureStorage`.
- Linha 53 ? `function` ? `readDb`: l? conte?do relacionado a `readDb`.
- Linha 77 ? `function` ? `createAiEditHistory`: cria recurso ou registro relacionado a `createAiEditHistory`.
- Linha 94 ? `function` ? `updateAiEditHistory`: atualiza recurso existente relacionado a `updateAiEditHistory`.
- Linha 106 ? `function` ? `updateAiEditHistoryByAction`: atualiza recurso existente relacionado a `updateAiEditHistoryByAction`.
- Linha 118 ? `function` ? `getAiEditHistory`: obt?m ou monta dados relacionado a `getAiEditHistory`.
- Linha 123 ? `function` ? `listAiEditHistory`: executa a l?gica associada a `listAiEditHistory`.

### `src/patches/patch-validator.ts`
- Linha 29 ? `function` ? `classifyRisk`: classifica entrada relacionado a `classifyRisk`.
- Linha 45 ? `function` ? `validateEditFile`: valida entrada ou sa?da relacionado a `validateEditFile`.
- Linha 72 ? `function` ? `mergeRiskLevels`: executa a l?gica associada a `mergeRiskLevels`.

### `src/pending-actions-store.ts`
- Linha 23 ? `function` ? `nowIso`: executa a l?gica associada a `nowIso`.
- Linha 27 ? `function` ? `ensureStorage`: garante pr?-condi??o/estrutura relacionado a `ensureStorage`.
- Linha 45 ? `function` ? `readDatabase`: l? conte?do relacionado a `readDatabase`.
- Linha 64 ? `function` ? `writeDatabase`: grava conte?do relacionado a `writeDatabase`.
- Linha 106 ? `function` ? `updateActionStatus`: atualiza recurso existente relacionado a `updateActionStatus`.
- Linha 121 ? `function` ? `createPendingAction`: cria recurso ou registro relacionado a `createPendingAction`.
- Linha 134 ? `function` ? `createPendingActions`: cria recurso ou registro relacionado a `createPendingActions`.
- Linha 147 ? `function` ? `listPendingActions`: executa a l?gica associada a `listPendingActions`.
- Linha 155 ? `function` ? `getPendingAction`: obt?m ou monta dados relacionado a `getPendingAction`.
- Linha 160 ? `function` ? `approveAction`: executa a l?gica associada a `approveAction`.
- Linha 164 ? `function` ? `setActionExpectedHash`: atualiza estado ou configura??o relacionado a `setActionExpectedHash`.
- Linha 178 ? `function` ? `rejectAction`: executa a l?gica associada a `rejectAction`.
- Linha 182 ? `function` ? `markActionApplied`: executa a l?gica associada a `markActionApplied`.
- Linha 186 ? `function` ? `markActionFailed`: executa a l?gica associada a `markActionFailed`.

### `src/preview-security.ts`
- Linha 2 ? `function` ? `setPreviewSecurityHeaders`: atualiza estado ou configura??o relacionado a `setPreviewSecurityHeaders`.

### `src/project-file-store.ts`
- Linha 67 ? `function` ? `isBlockedName`: executa a l?gica associada a `isBlockedName`.
- Linha 72 ? `function` ? `isBlockedExtension`: executa a l?gica associada a `isBlockedExtension`.
- Linha 76 ? `function` ? `isTextFile`: executa a l?gica associada a `isTextFile`.
- Linha 81 ? `function` ? `normalizeRelativeTarget`: executa a l?gica associada a `normalizeRelativeTarget`.
- Linha 88 ? `function` ? `decodePathInput`: executa a l?gica associada a `decodePathInput`.
- Linha 104 ? `function` ? `assertSafeRelativePath`: executa a l?gica associada a `assertSafeRelativePath`.
- Linha 116 ? `function` ? `sanitizeRootInput`: executa a l?gica associada a `sanitizeRootInput`.
- Linha 125 ? `function` ? `assertAllowedAbsoluteRoot`: executa a l?gica associada a `assertAllowedAbsoluteRoot`.
- Linha 132 ? `function` ? `validateRelativeSegments`: valida entrada ou sa?da relacionado a `validateRelativeSegments`.
- Linha 145 ? `function` ? `buildProjectId`: constr?i uma estrutura/resultado relacionado a `buildProjectId`.
- Linha 152 ? `function` ? `getRepositoryRoot`: obt?m ou monta dados relacionado a `getRepositoryRoot`.
- Linha 156 ? `function` ? `resolveProjectRoot`: resolve caminho, configura??o ou refer?ncia relacionado a `resolveProjectRoot`.
- Linha 168 ? `function` ? `ensureProjectRoot`: garante pr?-condi??o/estrutura relacionado a `ensureProjectRoot`.
- Linha 174 ? `function` ? `resolveProjectPath`: resolve caminho, configura??o ou refer?ncia relacionado a `resolveProjectPath`.
- Linha 199 ? `function` ? `fileHashMatches`: executa a l?gica associada a `fileHashMatches`.
- Linha 203 ? `function` ? `walkTree`: executa a l?gica associada a `walkTree`.
- Linha 257 ? `function` ? `listProjectTree`: executa a l?gica associada a `listProjectTree`.
- Linha 262 ? `function` ? `flattenTree`: executa a l?gica associada a `flattenTree`.
- Linha 281 ? `function` ? `listProjectFiles`: executa a l?gica associada a `listProjectFiles`.
- Linha 287 ? `function` ? `readProjectFile`: l? conte?do relacionado a `readProjectFile`.
- Linha 305 ? `function` ? `ensureParentDirectory`: garante pr?-condi??o/estrutura relacionado a `ensureParentDirectory`.
- Linha 309 ? `function` ? `writeProjectFile`: grava conte?do relacionado a `writeProjectFile`.
- Linha 323 ? `function` ? `createProjectFolder`: cria recurso ou registro relacionado a `createProjectFolder`.
- Linha 329 ? `function` ? `renameProjectPath`: executa a l?gica associada a `renameProjectPath`.
- Linha 350 ? `function` ? `deleteProjectFile`: remove recurso relacionado a `deleteProjectFile`.
- Linha 362 ? `function` ? `deleteProjectFolder`: remove recurso relacionado a `deleteProjectFolder`.
- Linha 374 ? `function` ? `projectFileExists`: executa a l?gica associada a `projectFileExists`.

### `src/project-inspector.ts`
- Linha 22 ? `function` ? `runGitCommand`: executa fluxo ou comando relacionado a `runGitCommand`.
- Linha 48 ? `function` ? `assertGitOk`: executa a l?gica associada a `assertGitOk`.
- Linha 55 ? `function` ? `normalizeGitPath`: executa a l?gica associada a `normalizeGitPath`.
- Linha 65 ? `function` ? `detectFramework`: detecta padr?o ou stack relacionado a `detectFramework`.
- Linha 96 ? `function` ? `readPackageJson`: l? conte?do relacionado a `readPackageJson`.
- Linha 110 ? `function` ? `readProjectSnapshot`: l? conte?do relacionado a `readProjectSnapshot`.
- Linha 141 ? `function` ? `scanProject`: executa a l?gica associada a `scanProject`.
- Linha 150 ? `function` ? `getGitStatus`: obt?m ou monta dados relacionado a `getGitStatus`.
- Linha 160 ? `function` ? `getGitDiff`: obt?m ou monta dados relacionado a `getGitDiff`.
- Linha 170 ? `function` ? `getGitFileDiff`: obt?m ou monta dados relacionado a `getGitFileDiff`.
- Linha 182 ? `function` ? `stageGitFiles`: executa a l?gica associada a `stageGitFiles`.
- Linha 193 ? `function` ? `unstageGitFiles`: executa a l?gica associada a `unstageGitFiles`.
- Linha 204 ? `function` ? `createGitBranch`: cria recurso ou registro relacionado a `createGitBranch`.
- Linha 215 ? `function` ? `generateCommitMessage`: gera artefato/sa?da relacionado a `generateCommitMessage`.
- Linha 227 ? `function` ? `createGitCommit`: cria recurso ou registro relacionado a `createGitCommit`.

### `src/project-runtime-store.ts`
- Linha 18 ? `function` ? `nowIso`: executa a l?gica associada a `nowIso`.
- Linha 22 ? `function` ? `ensureProjectDataDir`: garante pr?-condi??o/estrutura relacionado a `ensureProjectDataDir`.
- Linha 32 ? `function` ? `saveLastCommandResult`: persiste dados relacionado a `saveLastCommandResult`.
- Linha 49 ? `function` ? `readLastCommandResult`: l? conte?do relacionado a `readLastCommandResult`.

### `src/rate-limit.ts`
- Linha 7 ? `function` ? `createLimiter`: cria recurso ou registro relacionado a `createLimiter`.

### `src/research-tools.ts`
- Linha 47 ? `function` ? `ensureSafeHttpUrl`: garante pr?-condi??o/estrutura relacionado a `ensureSafeHttpUrl`.
- Linha 81 ? `function` ? `isBlockedIpAddress`: executa a l?gica associada a `isBlockedIpAddress`.
- Linha 116 ? `function` ? `trimText`: executa a l?gica associada a `trimText`.
- Linha 121 ? `function` ? `stripHtml`: executa a l?gica associada a `stripHtml`.
- Linha 132 ? `function` ? `buildGitHubHeaders`: constr?i uma estrutura/resultado relacionado a `buildGitHubHeaders`.
- Linha 140 ? `function` ? `webSearch`: executa a l?gica associada a `webSearch`.
- Linha 168 ? `function` ? `githubSearch`: executa a l?gica associada a `githubSearch`.
- Linha 182 ? `const function` ? `data`: executa a l?gica associada a `data`.
- Linha 194 ? `function` ? `githubRepoSearch`: executa a l?gica associada a `githubRepoSearch`.
- Linha 208 ? `const function` ? `data`: executa a l?gica associada a `data`.
- Linha 220 ? `function` ? `fetchUrl`: executa a l?gica associada a `fetchUrl`.
- Linha 244 ? `function` ? `fetchGitHubFile`: executa a l?gica associada a `fetchGitHubFile`.
- Linha 264 ? `function` ? `scoreMatch`: executa a l?gica associada a `scoreMatch`.
- Linha 296 ? `function` ? `extractSnippet`: executa a l?gica associada a `extractSnippet`.
- Linha 311 ? `function` ? `collectSearchFiles`: executa a l?gica associada a `collectSearchFiles`.
- Linha 347 ? `function` ? `searchProjectFiles`: executa a l?gica associada a `searchProjectFiles`.

### `src/routes/ai-edits.ts`
- Linha 15 ? `function` ? `readStringArray`: l? conte?do relacionado a `readStringArray`.
- Linha 21 ? `function` ? `registerAiEditRoutes`: executa a l?gica associada a `registerAiEditRoutes`.

### `src/routes/generate-site.ts`
- Linha 40 ? `function` ? `extractPlaceholders`: executa a l?gica associada a `extractPlaceholders`.
- Linha 47 ? `function` ? `loadTemplate`: carrega dados de disco ou mem?ria relacionado a `loadTemplate`.
- Linha 58 ? `function` ? `injectValues`: executa a l?gica associada a `injectValues`.
- Linha 62 ? `function` ? `generateValuesWithLLM`: gera artefato/sa?da relacionado a `generateValuesWithLLM`.
- Linha 120 ? `function` ? `generateCompleteSiteWithLLM`: gera artefato/sa?da relacionado a `generateCompleteSiteWithLLM`.
- Linha 158 ? `function` ? `generateValuesOfflineFallback`: gera artefato/sa?da relacionado a `generateValuesOfflineFallback`.
- Linha 482 ? `function` ? `buildZip`: constr?i uma estrutura/resultado relacionado a `buildZip`.
- Linha 635 ? `function` ? `deployToVercel`: executa a l?gica associada a `deployToVercel`.
- Linha 673 ? `function` ? `deployToNetlify`: executa a l?gica associada a `deployToNetlify`.
- Linha 728 ? `function` ? `registerGenerateSiteRoutes`: executa a l?gica associada a `registerGenerateSiteRoutes`.

### `src/server.ts`
- Linha 131 ? `function` ? `buildHistoryContext`: constr?i uma estrutura/resultado relacionado a `buildHistoryContext`.
- Linha 144 ? `function` ? `formatActionForHistory`: executa a l?gica associada a `formatActionForHistory`.
- Linha 155 ? `function` ? `writeActionHistory`: grava conte?do relacionado a `writeActionHistory`.
- Linha 177 ? `function` ? `handleOrchestrate`: trata evento ou requisi??o relacionado a `handleOrchestrate`.
- Linha 245 ? `function` ? `parsePromptBody`: interpreta texto/dados relacionado a `parsePromptBody`.
- Linha 254 ? `function` ? `activeProjectInput`: executa a l?gica associada a `activeProjectInput`.
- Linha 258 ? `function` ? `activeProjectAbsoluteRoot`: executa a l?gica associada a `activeProjectAbsoluteRoot`.
- Linha 262 ? `function` ? `readRequestedProjectRoot`: l? conte?do relacionado a `readRequestedProjectRoot`.
- Linha 266 ? `function` ? `assertSafePatchApply`: executa a l?gica associada a `assertSafePatchApply`.
- Linha 272 ? `function` ? `isSafePatchForActiveProject`: executa a l?gica associada a `isSafePatchForActiveProject`.
- Linha 281 ? `function` ? `bindReviewedHash`: executa a l?gica associada a `bindReviewedHash`.
- Linha 289 ? `function` ? `executeProjectCommand`: executa a l?gica associada a `executeProjectCommand`.
- Linha 306 ? `function` ? `markAiEditActionStatus`: executa a l?gica associada a `markAiEditActionStatus`.
- Linha 317 ? `function` ? `hasTrustedBootstrapSource`: executa a l?gica associada a `hasTrustedBootstrapSource`.
- Linha 383 ? `function` ? `previewMimeType`: executa a l?gica associada a `previewMimeType`.
- Linha 942 ? `const function` ? `pending`: executa a l?gica associada a `pending`.
- Linha 960 ? `const function` ? `pending`: executa a l?gica associada a `pending`.
- Linha 1753 ? `function` ? `validateAnthropicModel`: valida entrada ou sa?da relacionado a `validateAnthropicModel`.

### `src/session-store.ts`
- Linha 37 ? `function` ? `nowIso`: executa a l?gica associada a `nowIso`.
- Linha 41 ? `function` ? `deriveTitle`: executa a l?gica associada a `deriveTitle`.
- Linha 50 ? `function` ? `ensureStorage`: garante pr?-condi??o/estrutura relacionado a `ensureStorage`.
- Linha 68 ? `function` ? `readDatabase`: l? conte?do relacionado a `readDatabase`.
- Linha 82 ? `function` ? `writeDatabase`: grava conte?do relacionado a `writeDatabase`.
- Linha 88 ? `function` ? `createSession`: cria recurso ou registro relacionado a `createSession`.
- Linha 104 ? `function` ? `listSessions`: executa a l?gica associada a `listSessions`.
- Linha 111 ? `function` ? `getSession`: obt?m ou monta dados relacionado a `getSession`.
- Linha 116 ? `function` ? `deleteSession`: remove recurso relacionado a `deleteSession`.
- Linha 129 ? `function` ? `appendMessage`: executa a l?gica associada a `appendMessage`.
- Linha 157 ? `function` ? `getRecentHistory`: obt?m ou monta dados relacionado a `getRecentHistory`.

### `src/workspace-store.ts`
- Linha 36 ? `function` ? `ensureWorkspace`: garante pr?-condi??o/estrutura relacionado a `ensureWorkspace`.
- Linha 40 ? `function` ? `normalizeRelativePath`: executa a l?gica associada a `normalizeRelativePath`.
- Linha 66 ? `function` ? `resolveWorkspacePath`: resolve caminho, configura??o ou refer?ncia relacionado a `resolveWorkspacePath`.
- Linha 88 ? `function` ? `getWorkspaceRoot`: obt?m ou monta dados relacionado a `getWorkspaceRoot`.
- Linha 92 ? `function` ? `listFilesRecursive`: executa a l?gica associada a `listFilesRecursive`.
- Linha 123 ? `function` ? `listFiles`: executa a l?gica associada a `listFiles`.
- Linha 128 ? `function` ? `readFile`: l? conte?do relacionado a `readFile`.
- Linha 144 ? `function` ? `ensureParentDir`: garante pr?-condi??o/estrutura relacionado a `ensureParentDir`.
- Linha 149 ? `function` ? `writeFile`: grava conte?do relacionado a `writeFile`.
- Linha 163 ? `function` ? `createFile`: cria recurso ou registro relacionado a `createFile`.
- Linha 167 ? `function` ? `deleteFile`: remove recurso relacionado a `deleteFile`.
- Linha 182 ? `function` ? `fileExists`: executa a l?gica associada a `fileExists`.

### `tests/action-executor.test.ts`
- Linha 23 ? `function` ? `createFileAction`: cria recurso ou registro relacionado a `createFileAction`.

### `tests/active-project-boundary.test.ts`
- Linha 10 ? `function` ? `flattenTree`: executa a l?gica associada a `flattenTree`.

### `tests/agent-events-sse.test.ts`
- Linha 12 ? `function` ? `collectSseBody`: executa a l?gica associada a `collectSseBody`.

### `tests/generate-site.test.ts`
- Linha 77 ? `function` ? `extractPlaceholders`: executa a l?gica associada a `extractPlaceholders`.
- Linha 84 ? `function` ? `injectValues`: executa a l?gica associada a `injectValues`.

### `tests/helpers.ts`
- Linha 2 ? `function` ? `configureTestSecurity`: executa a l?gica associada a `configureTestSecurity`.
- Linha 6 ? `function` ? `authHeaders`: executa a l?gica associada a `authHeaders`.

### `tests/patch-payload.test.ts`
- Linha 11 ? `function` ? `baseAction`: executa a l?gica associada a `baseAction`.

### `tests/provider-router.test.ts`
- Linha 7 ? `method` ? `buildProviderOrder`: constr?i uma estrutura/resultado relacionado a `buildProviderOrder`.
- Linha 13 ? `function` ? `baseSettings`: executa a l?gica associada a `baseSettings`.

### `tests/run-event-bus.test.ts`
- Linha 5 ? `function` ? `event`: executa a l?gica associada a `event`.

### `workspace/src/app.ts`
- Linha 1 ? `const function` ? `hello`: executa a l?gica associada a `hello`.

### `workspace/src/demo.ts`
- Linha 1 ? `const function` ? `demo`: executa a l?gica associada a `demo`.

### `workspace/src/nexus-flow-7398c6f5.ts`
- Linha 1 ? `const function` ? `nexusFlow`: executa a l?gica associada a `nexusFlow`.

### `workspace/src/nexus-flow.ts`
- Linha 1 ? `const function` ? `nexusFlow`: executa a l?gica associada a `nexusFlow`.

## Fluxos Importantes

### Fluxo de patch

1. `action-planner.ts` interpreta a??es propostas pela IA.
2. `pending-actions-store.ts` guarda a??es pendentes.
3. `action-executor.ts` aplica apenas a??es aprovadas e faz checagens de stale content/hash.
4. `patch-payload.ts`, `src/patches/*` e UI em `public/patch-review.js` mostram diff, risco, antes/depois e comandos de valida??o.

### Fluxo de agente

1. `src/app/agents/registry.ts` define agentes.
2. `src/app/agents/routing.ts` escolhe agente por inten??o.
3. `src/app/agents/runner.ts` executa cen?rio, ferramentas e eventos.
4. `src/app/agents/tools.ts` l? arquivos, prop?e patch, roda comandos seguros e registra artefatos.

### Fluxo NexusAI local

1. `NexusAI/train.py` treina/checkpointa o modelo.
2. `NexusAI/infer.py` gera texto/c?digo.
3. `NexusAI/controlled_generate.py` roteia, valida, repara e registra falhas.
4. `NexusAI/repo_mode.py` monta contexto de projeto e usa patch review controlado.
5. `NexusAI/real_task_runner.py` mede tarefas `resolved/assisted/failed`.

## Observa??es de Qualidade

- O relat?rio usa an?lise est?tica simples para TypeScript/JavaScript; fun??es exportadas e m?todos s?o capturados por padr?es regex. Pode haver m?todos din?micos ou callbacks inline n?o listados.
- Python ? analisado via `ast`, ent?o a cobertura de fun??es/classes Python ? mais confi?vel.
- Para auditoria de seguran?a profunda, o pr?ximo relat?rio deveria separar findings por severidade e arquivo/linha.
