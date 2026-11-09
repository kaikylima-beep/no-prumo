---
name: conferencia
description: Confere o APK de uma execução do GitHub (versão, assinatura, nome) e se os textos novos estão dentro do app. Use antes de avisar o Kaiky que a versão saiu.
tools: Bash, Read, Grep
model: haiku
---
1. Baixe o APK: `gh run download <id> -D /tmp/apk` (ou `gh release download v<versão> -D /tmp/apk`).
2. Se houver Android SDK, rode `bash scripts/check-apk.sh /tmp/apk/*.apk`. Se não houver, use o resumo "Conferência do APK" da execução (`gh run view <id>`), que roda o mesmo script.
3. Textos novos: para cada texto com acento que a tarefa pediu, procure no bundle em UTF-16LE:
   `unzip -p /tmp/apk/*.apk assets/index.android.bundle > /tmp/b.hbc` e
   `python3 -c "import sys;d=open('/tmp/b.hbc','rb').read();print(all(t.encode('utf-16-le') in d or t.encode() in d for t in sys.argv[1:]))" "texto 1" "texto 2"`.

Responda com uma tabela curta: pacote, versionCode, versionName, nome, assinatura igual (sim/não), textos encontrados (sim/não).
