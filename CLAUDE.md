# No Prumo · guia curto para o Claude

App Android de organização pessoal por voz, em português (Expo SDK 58, React Native 0.88, JavaScript puro, sem Expo Router, sem EAS). Nome no celular: **Prumo**. Pacote `com.meuorganizador.app` (nunca muda).

Este arquivo é o que todo agente lê. Leia o resto só se a tarefa pedir.

## Onde está cada coisa

| Precisa de… | Onde |
|---|---|
| Decisões, regras de negócio, estado do app | `docs/memoria/memoria.md` (fonte da verdade) |
| Calendário das próximas versões | `docs/memoria/plano.md` |
| Frases que o app entendeu errado (campo Testes) | `docs/memoria/testes.md` |
| Plano da voz e a análise da fala natural (1.13.1) | `docs/memoria/voz.md` |
| Cores, telas, ícone | `docs/memoria/marca.md` |
| O que mudou em cada versão | `README.md` (Novidades/Correções) |
| Plano do Prumo novo (saiu como 1.14) e o ensaio Peep | `docs/memoria/plano-1.13.md`, `docs/memoria/peep.md` |
| Guias antigos (build manual na nuvem) | `docs/antigo/` — só para consulta, não seguir |

A memória mora no repositório (`docs/memoria/`), para o Claude Code e o claude.ai lerem a mesma coisa. Nada de dado pessoal real lá.

## Como falar com o Kaiky

- Ele não programa. Respostas curtas, português simples, sem jargão.
- Nunca repetir CPF, número de conta ou valores do extrato dele.
- Dados pessoais reais (extratos, holerites, planilha) **nunca** entram no repositório, nos testes ou nos docs. Exemplos com dados inventados.
- "Ainda não precisa fazer a versão" = só analisar, não mexer no código.

## Como o código está organizado (desde a 1.14, "Prumo novo")

A 1.14 trocou a base do app pela do Peep (ensaio de 10/11), por cima da 1.13.1. A cópia completa da 1.13.1 está em `docs/antigo/v1.13.1/`, só para consulta (e para os testes antigos rodarem).

| Pasta | O que tem |
|---|---|
| `src/core/` | Regras sem tela: `understand.js` (entender a fala: motor da 1.13.1 + perguntas, horários, duração), `nlu.js` (perguntas e horários de aula), `model.js` (itens, dia, mês, notas, faltas), `money.js` (contas, saldo, extrato), `plan.js` (avisos), `answers.js` (perguntas), `learn.js` (dicionário pessoal), `migrate.js` (backup e conversão da 1.12) |
| `src/legacy/` | Módulos da 1.13.1 que continuam valendo como estão: `parser.js` + `normalize.js` + `voice.js` (voz), `academic.js` (notas e faltas), `documentParser.js` + `accounts.js` + `financeFixes.js` (extrato), `holidays.js`. Mudou aqui, mude com testes |
| `src/` | Telas e peças: `App.js`, `Capture.js`, `ItemSheet.js`, `BlockSheet.js`, `AccountSheet.js`, `ImportSheet.js`, `Settings.js`, `screens/` |
| `scripts/test.mjs`, `scripts/test-legacy.mjs` | `npm test` (os do Prumo novo e os 868 da 1.13.1, com o banco de 278 frases em `scripts/fixtures/banco-voz.mjs`) |

## Regras técnicas que não podem quebrar

- Texto na tela usa `T` e `Input` de `src/ui.js`; cores só em `src/theme.js` (`useTheme`). Um visual só; claro/escuro troca sem reiniciar.
- Folhas (`Sheet`) não são `Modal`: ficam dentro do app, e o aviso "Desfazer" aparece por cima delas.
- Dados: um estado só em `@prumo/state`. As chaves `@org2/*` da 1.12 são lidas na primeira abertura e **nunca apagadas**.
- Avisos: a lista inteira é refeita por `planReminders` a cada mudança; nenhum item guarda id de aviso.
- `shouldPlaySound` sempre `true` no `setNotificationHandler` (libera a vibração).
- Não trocar os ids dos canais `lembretes-som` e `lembretes-vibrar`.
- Arquivos de `src/core/` e `src/legacy/` importam com a extensão `.js` (os testes rodam direto no Node).
- `android/` não vai para o git: é gerada pelo `expo prebuild`. Mudança nativa vai em `app.json` ou em `plugins/`.
- Voz: nada de regra para uma palavra mal ouvida específica. Erro de ouvido = dicionário pessoal/vocabulário; erro de regra = regra geral de português, testada em várias frases.
- Expo muda a cada SDK: antes de mexer numa API do Expo, confira a doc da versão 58 (`https://docs.expo.dev/versions/v58.0.0/`). Instalar pacote com `npx expo install`.

## Versões

- **Antes de começar, confira os ramos do GitHub** (`list_branches`): a 1.13.0 e a 1.13.1 foram feitas num ramo que nunca foi para `main`, e a 1.13 "Prumo novo" quase foi publicada com o número errado por isso. A versão nova sai do ramo mais adiantado, não só da `main`.

- Correção = x.y.Z (só conserta). Versão nova = x.Y (um tema). 2.0 = quebra "tudo no celular e sem internet".
- Um tema por versão; a próxima só começa depois que a anterior passar no celular.
- Toda versão tem o **campo Testes**: as frases abertas de `docs/memoria/testes.md` viram casos no `npm test` (nomes trocados).

### Para fechar uma versão (ex.: 1.12.3)

1. `app.json`: `expo.version` e `expo.android.versionCode` (+1).
2. `src/Settings.js`: `APP_VERSION`.
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
| `codigo` | Mudanças em `src/`, `plugins/` |
| `voz` | `src/speech.js`, `src/core/nlu.js`, frases do campo Testes |
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
npm test          # todos têm que passar
```

Conferência no navegador (só quando a tarefa mexe em tela):
```
npm i --no-save react-native-web@~0.21.4 react-dom@19.3.0
EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 npx expo export --platform web --output-dir /tmp/dist
```
Armadilhas do web: as abas ficam montadas depois de abertas, então use `locator('[aria-label="..."]:visible')`; as abas da barra têm `role="tab"`; viewport 390 de largura e alto.
