# No Prumo · guia curto para o Claude

App Android de organização pessoal por voz, em português (Expo SDK 58, React Native 0.88, JavaScript puro, sem Expo Router, sem EAS). Nome no celular: **Prumo**. Pacote `com.meuorganizador.app` (nunca muda).

Este arquivo é o que todo agente lê. Leia o resto só se a tarefa pedir.

## Onde está cada coisa

| Precisa de… | Onde |
|---|---|
| Decisões, regras de negócio, estado do app | `docs/memoria/memoria.md` (fonte da verdade) |
| Calendário das próximas versões | `docs/memoria/plano.md` |
| Frases que o app entendeu errado (campo Testes) | `docs/memoria/testes.md` |
| Plano da voz | `docs/memoria/voz.md` |
| Cores, telas, ícone | `docs/memoria/marca.md` |
| O que mudou em cada versão | `README.md` (Novidades/Correções) |
| Guias antigos (build manual na nuvem) | `docs/antigo/` — só para consulta, não seguir |

A memória mora no repositório (`docs/memoria/`), para o Claude Code e o claude.ai lerem a mesma coisa. Nada de dado pessoal real lá.

## Como falar com o Kaiky

- Ele não programa. Respostas curtas, português simples, sem jargão.
- Nunca repetir CPF, número de conta ou valores do extrato dele.
- Dados pessoais reais (extratos, holerites, planilha) **nunca** entram no repositório, nos testes ou nos docs. Exemplos com dados inventados.
- "Ainda não precisa fazer a versão" = só analisar, não mexer no código.

## Regras técnicas que não podem quebrar

- Todo `Text`/`TextInput` vem de `src/AppText.js`, nunca de `react-native`.
- Cores fixas só em `src/theme.js`. Texto sobre cor da área usa `colors.onAccent`.
- `StyleSheet.absoluteFill`, nunca `absoluteFillObject` (o `npm test` reprova).
- `shouldPlaySound` sempre `true` no `setNotificationHandler` (libera a vibração).
- Não trocar os ids dos canais `lembretes-som` e `lembretes-vibrar`.
- Todas as abas ficam montadas (`display: 'none'`); `Modal` dentro de tela cobre o app inteiro; o Toast fica **atrás** de `Modal`.
- Módulo novo testado precisa ser copiado para a pasta temporária em `scripts/test-parser.mjs`.
- `android/` não vai para o git: é gerada pelo `expo prebuild`. Mudança nativa vai em `app.json` ou em `plugins/`.
- Voz: nada de regra para uma palavra mal ouvida específica. Erro de ouvido = dicionário pessoal/vocabulário; erro de regra = regra geral de português, testada em várias frases.
- Expo muda a cada SDK: antes de mexer numa API do Expo, confira a doc da versão 58 (`https://docs.expo.dev/versions/v58.0.0/`). Instalar pacote com `npx expo install`.

## Versões

- Correção = x.y.Z (só conserta). Versão nova = x.Y (um tema). 2.0 = quebra "tudo no celular e sem internet".
- Um tema por versão; a próxima só começa depois que a anterior passar no celular.
- Toda versão tem o **campo Testes**: as frases abertas de `docs/memoria/testes.md` viram casos no `npm test` (nomes trocados).

### Para fechar uma versão (ex.: 1.12.3)

1. `app.json`: `expo.version` e `expo.android.versionCode` (+1).
2. `src/Drawer.js`: `APP_VERSION`.
3. `README.md`: "Versão atual" e a seção Novidades/Correções.
4. `npm test` passando.
5. Commit em `main` e push. Como a versão do `app.json` ainda não tem Release, o GitHub gera o APK sozinho e cria a Release `v1.12.3` com ele. (Não crie tags daqui: o envio de tags é bloqueado nesta sessão.)
6. Conferir a execução (agente `conferencia`), baixar o APK da Release e mandar no chat (SendUserFile), com a lista de tarefas do Kaiky.
7. Atualizar `docs/memoria/` (plano e testes) e o Mapa do No Prumo.

**No Claude Code na nuvem:** trabalhe no ramo da sessão e gere um APK de teste com "Run workflow" nesse ramo (ferramenta `mcp__github__actions_run_trigger`, `run_workflow`). Leve para `main` (que cria a Release) só quando o Kaiky aprovar. O `gh` não tem login nessas sessões: acompanhe e baixe pelo `mcp__github__actions_list` / `actions_get`.

## Build do APK (GitHub Actions)

- Arquivo: `.github/workflows/build-apk.yml`.
- Todo push em `main` roda os testes. Se a versão do `app.json` ainda não tem Release, gera também o APK e cria a Release. "Run workflow" manual (`gh workflow run build-apk.yml --ref main`) gera um APK de teste sem mudar a versão.
- O workflow faz `expo prebuild`, copia `keystore/debug.keystore`, roda `assembleRelease` e confere tudo com `scripts/check-apk.sh` (pacote, versão, nome Prumo e assinatura).
- Assinatura obrigatória (chave de teste pública do Expo, até a troca por chave própria):
  SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Se mudar, o APK não instala por cima e o Kaiky perde os dados.
- Não gerar APK na máquina local: é lento e gasta muito. Use o workflow.
- Acompanhar: `gh run list --limit 3`, `gh run watch <id> --exit-status`, e em caso de erro `gh run view <id> --log-failed | tail -40`.

## Agentes (em `.claude/agents/`)

Use o agente certo e peça resposta curta. Não cole logs inteiros na conversa principal.

| Agente | Quando |
|---|---|
| `codigo` | Mudanças em `src/`, `App.js`, `plugins/` |
| `voz` | `speech.js`, `parser.js`, frases do campo Testes |
| `design` | UI/UX: depois do código, ajusta o visual e tira prints |
| `testes` | Rodar `npm test` e arrumar teste quebrado |
| `build` | Disparar e acompanhar o build no GitHub |
| `conferencia` | Conferir o APK gerado e os textos novos no bundle |
| `documentos` | README, memória do projeto, campo Testes, Mapa |
| `marketing` | Divulgação (só quando o Kaiky pedir; nada sai antes de fev/2027) |

Linha de produção (como uma empresa): `/versao <pedido>` → Desenvolvimento → UI/UX → Testes → APK enviado no chat → lista de tarefas do Kaiky (`.claude/commands/versao.md`).

## Comandos

```
npm ci            # instalar
npm test          # 445+ testes, todos têm que passar
```

Conferência no navegador (só quando a tarefa mexe em tela):
```
npm i --no-save react-native-web@~0.21.4 react-dom@19.3.0
EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 npx expo export --platform web --output-dir /tmp/dist
```
Armadilhas do web: `Alert` não funciona; a saudação de entrada cobre o topo por ~1,5 s; todas as abas montadas, então use `locator('[aria-label="..."]:visible')`; viewport 390 de largura e alto.
