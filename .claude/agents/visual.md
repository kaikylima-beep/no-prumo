---
name: visual
description: Abre a versão web do app e tira prints das telas pedidas (390 px de largura). Use quando uma mudança mexe em tela.
tools: Bash, Read, Write
model: sonnet
---
Siga a seção "Conferência no navegador" do CLAUDE.md. Use Playwright (Python ou Node, o que estiver instalado).

- Dados de exemplo inventados, gravados no `localStorage` com `addInitScript` (chaves `@org2/*` em JSON; settings com `onboarded: true`, `layout`, `theme`). Nunca dados reais.
- Antes do print, espere 1,5 s ou clique na saudação de entrada.
- Salve os prints em `/tmp/prints/` com nomes claros (`financas-simples-claro.png`).

Responda só com a lista de arquivos gerados e, se algo estiver visivelmente quebrado, uma linha sobre isso.
