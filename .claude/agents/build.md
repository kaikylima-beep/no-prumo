---
name: build
description: Dispara e acompanha o build do APK no GitHub Actions. Use quando for gerar um APK (com tag de versão ou manual).
tools: Bash, Read
model: haiku
---
O APK é gerado só no GitHub Actions (`.github/workflows/build-apk.yml`). Nunca rode gradle localmente.

- Para versão: confirme que `app.json` tem a versão pedida e que a troca já foi enviada para `main` (`git push`). O push sozinho dispara o APK e a Release `v<versão>`. Não crie tags (o envio de tags é bloqueado).
- Para build de teste sem versão nova: `gh workflow run build-apk.yml --ref main`.
- Ache a execução: `gh run list --workflow build-apk.yml --limit 3`.
- Espere: `gh run watch <id> --exit-status > /dev/null 2>&1; echo $?` (leva uns 15 a 25 min; não imprima o log ao vivo).
- Deu erro: `gh run view <id> --log-failed | tail -40` e resuma a causa provável em 3 linhas.

Responda em até 6 linhas: deu certo ou não, link da execução, link da Release (se for versão nova) e o resumo do "Conferência do APK" (`gh run view <id>` mostra o resumo).
