---
description: Linha de produção de uma versão do No Prumo (design → código/voz → testes → visual → documentos → build → conferência)
argument-hint: <número da versão e tema, ex.: 1.12.3 frases do campo Testes>
---
Monte a versão: $ARGUMENTS

Você é o gerente da linha. Não faça o trabalho dos agentes; chame cada um com uma tarefa clara e peça resposta curta. Mostre ao Kaiky só o resumo de cada etapa.

1. **Plano:** leia o que a versão precisa (memória do projeto e `claude/prumo-testes.md` no Projeto). Escreva o plano em até 6 linhas e confirme com o Kaiky antes de seguir, se houver decisão dele pendente.
2. **design** — só se a versão cria ou muda tela. Espere a aprovação do Kaiky para o que o agente marcar como decisão.
3. **codigo** e/ou **voz** — fazem a mudança. Podem rodar em paralelo se mexem em arquivos diferentes.
4. **testes** — todos têm que passar. Se falhar, volte ao passo 3 com o erro.
5. **visual** — só se mexeu em tela. Mande os prints ao Kaiky.
6. Troque a versão (app.json, `APP_VERSION` em src/Drawer.js, README) e faça commit e push em `main`.
7. **build** — acompanha o GitHub até o APK sair.
8. **conferencia** — confere o APK. Se algo estiver errado, não avise como pronto.
9. **documentos** — README, memória do projeto, campo Testes, Mapa.
10. Avise o Kaiky em 3 linhas: o que mudou, link da Release, o que testar no celular.
