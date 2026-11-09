# No Prumo · guia curto para o Claude

App Android de organização pessoal por voz, em português (Expo SDK 58, React Native 0.88, JavaScript puro, sem Expo Router, sem EAS). Nome no celular: **Prumo**. Pacote `com.meuorganizador.app` (nunca muda).

Este arquivo é o que todo agente lê. Leia o resto só se a tarefa pedir.

## Onde está cada coisa

| Precisa de… | Onde |
|---|---|
| Decisões, regras de negócio, ordem das versões | Doc `prumo-memoria-do-projeto.md` no Projeto "Prumo" do claude.ai (ferramenta Projects) |
| Frases que o app entendeu errado | Doc `claude/prumo-testes.md` no Projeto |
| Plano da voz | Doc `claude/prumo-analise-voz.md` no Projeto |
| Cores, telas, ícone | Doc `claude/prumo-marca-e-visual.md` no Projeto |
| O que mudou em cada versão | `README.md` (Novidades/Correções) |
| Guias antigos (build manual na nuvem) | `docs/antigo/` — só para consulta, não seguir |

Use `project_search` antes de ler um doc inteiro.

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
- Toda versão tem o **campo Testes**: as frases abertas de `claude/prumo-testes.md` viram casos no `npm test` (nomes trocados).

### Para fechar uma versão (ex.: 1.12.3)

1. `app.json`: `expo.version` e `expo.android.versionCode` (+1).
2. `src/Drawer.js`: `APP_VERSION`.
3. `README.md`: "Versão atual" e a seção Novidades/Correções.
4. `npm test` passando.
5. Commit em `main`, tag `v1.12.3`, push da tag. O GitHub gera o APK sozinho e cria uma Release com ele.
6. Conferir a execução (agente `conferencia`) e avisar o Kaiky que o APK está em **Releases**.
7. Atualizar a memória do projeto e o Mapa do No Prumo.

## Build do APK (GitHub Actions)

- Arquivo: `.github/workflows/build-apk.yml`.
- Todo push em `main` roda só os testes. Tag `v*` ou "Run workflow" manual gera o APK.
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
| `testes` | Rodar `npm test` e arrumar teste quebrado |
| `build` | Disparar e acompanhar o build no GitHub |
| `conferencia` | Conferir o APK gerado e os textos novos no bundle |
| `visual` | Prints no navegador (versão web) |
| `documentos` | README, memória do projeto, campo Testes, Mapa |

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
