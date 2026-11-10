---
description: Linha de produção do No Prumo, como uma empresa: Desenvolvimento → UI/UX → Testes → APK no chat → lista de tarefas do Kaiky
argument-hint: <o que mudar, ex.: 1.12.3 frases do campo Testes>
---
Pedido do Kaiky: $ARGUMENTS

Você é o gerente. Não faça o trabalho dos setores: chame cada agente com uma tarefa clara e peça resposta curta. Ao Kaiky, mostre só uma linha por etapa ("Desenvolvimento: pronto, 3 arquivos").

**0. Entender o pedido.** Leia o necessário (`docs/memoria/memoria.md`, `plano.md` e `testes.md`). Se faltar uma decisão que só o Kaiky pode tomar, pergunte antes. Defina o número da versão (correção = x.y.Z).

**1. Desenvolvimento** — agente `codigo` (telas e funções) e/ou `voz` (fala e frases). Podem trabalhar juntos se mexem em arquivos diferentes.

**2. UI/UX** — agente `design`, se alguma tela mudou. Ele ajusta o visual e tira os prints. Se ele achar problema de comportamento, volte ao passo 1.

**3. Testes** — agente `testes`. Todos têm que passar. Se falhar, volte ao passo 1 com o erro.

**4. Versão** — troque a versão (`app.json` versão e versionCode +1, `APP_VERSION` em `src/Drawer.js`, README "Versão atual" e Novidades/Correções). Commit e push em `main`.

**5. APK** — agente `build` acompanha o GitHub até sair; depois agente `conferencia`. Se a conferência falhar, não entregue: corrija e repita.
Baixe o APK da Release e mande no chat com SendUserFile:
`gh api repos/kaikylima-beep/no-prumo/releases/tags/v<versão> --jq '.assets[0].id'` e
`gh api -H "Accept: application/octet-stream" repos/kaikylima-beep/no-prumo/releases/assets/<id> > /tmp/Prumo-<versão>.apk`.
Mande também 2 ou 3 prints do passo 2, se houver.

**6. Documentos** — agente `documentos` (README, memória do projeto, campo Testes, Mapa).

**7. Entrega ao Kaiky** — curta, nesta ordem:
- o que mudou (até 3 linhas);
- o APK (já enviado no chat);
- **Suas tarefas**, uma lista para marcar:
  - [ ] instalar o APK por cima;
  - [ ] o que testar no celular, com a frase ou o toque exato para cada mudança;
  - [ ] decisões pendentes dele (se houver);
  - [ ] usar 3 dias e mandar as frases do modo de teste.
