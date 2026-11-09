# No Prumo: memória do chat de desenvolvimento (até a 1.12)

Atualizado em 08/11/2026. Escrito para o próximo chat de desenvolvimento continuar sem perder o rumo. Complementa `claude/contexto-meu-organizador.md` (o que o app é, histórico e regras de Finanças), `claude/prumo-marca-e-visual.md` (marca), os pedidos `claude/prumo-correcoes-1.9.1.md` e `claude/prumo-correcoes-1.9.2.md` (feitos) e o plano `claude/prumo-plano-1.9.3-1.11.md` (1.9.3 e 1.10 feitas; 1.11 a 1.13 a fazer).

## 1. Para começar o chat novo

1. **Peça ao Kaiky para anexar o código: `no-prumo-1.12-codigo.zip`.** Ele foi entregue junto com `Prumo-1.12.apk`. O ambiente da nuvem de cada chat é separado: nada daqui (código, SDK, cache do Maven) existe no chat novo.
2. Descompacte em `/home/claude/meu-app`, rode `npm install` e depois `npm test`: devem passar **404/404**.
3. Leia, nesta ordem: este arquivo e `claude/contexto-meu-organizador.md`.
4. Monte o build Android só quando for gerar APK (seção 6). Na primeira vez leva uns 30 a 40 minutos.

## 2. Quem é e como trabalhar

- **Kaiky:** estudante de engenharia na UTFPR, estagiário (assistente de engenharia júnior), fala português, não programa. O app é 100% feito pelo Claude.
- **Entrega de cada versão:** um APK instalável e um zip do código, mandados com SendUserFile. Respostas curtas, em português simples, sem jargão.
- **Regras combinadas:**
  - Um tema por versão. Correção = x.y.Z; tema novo = x.Y; 2.0 = quebrar a promessa "tudo no celular, sem internet".
  - Uma versão fecha quando: os testes passam, o Kaiky usou 3 dias no celular, as reclamações foram resolvidas e o README foi atualizado.
  - **Finanças primeiro.** Frase dele: "Só vamos para outra categoria quando corrigirmos tudo, neste momento fazer o finanças rodar".
  - Nada é salvo sem revisão. Ação destrutiva sempre com Desfazer.
  - Quando ele disser "ainda não precisa fazer a versão", só analisar.
- **Dados pessoais:** o extrato real do Itaú, os holerites (08 a 10/2026) e a planilha `alfa1.xlsx` têm nome, CPF e conta dele. Nunca colocar em fixtures, zips, artefatos ou docs, e nunca repetir CPF ou número de conta completo nas respostas.
- **Depois de cada versão:**
  - atualizar o artefato **Mapa do No Prumo** (https://claude.ai/artifact/UXteo4z4qTuoRn9njRBaz1): ler com Artifact `read`, editar e publicar com `url`. Já tem a 1.10 e o quadro até a 1.13;
  - atualizar `claude/contexto-meu-organizador.md`;
  - atualizar este arquivo se algo do processo mudar.

## 3. Estado atual

- **Versão:** 1.12 (versionName 1.12.0, versionCode 19).
  - Pacote Android `com.meuorganizador.app`. Não muda: assim a versão instala por cima sem perder os dados.
  - O nome que aparece no celular é **Prumo**.
- **Assinatura:** chave de teste pública do Expo (`keystore/debug.keystore`, senha `android`, alias `androiddebugkey`, SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`). Tem que ser sempre a mesma, senão o APK não instala por cima.
- **O que entrou na 1.9.0:**
  - Recebimentos: salário, extras e "entre suas contas";
  - extras fora do limite do mês;
  - Indicadores (botão ao lado da foto, só no Avançado);
  - "Previsto no fim do mês" a partir das contas;
  - extrato de cada conta;
  - Simples só com entradas e saídas;
  - Agenda só com o que está pendente;
  - visual No Prumo: ícone Blocão, Avançado = visual 1, Simples = visual 3, claro e escuro, fontes Space Grotesk e Inter;
  - correções: Pix próprio marcado não duplica mais; juros e IOF não são mais pulados.
- **O que entrou na 1.9.1:**
  - "99" e "23 e 99" na voz (`joinCents`; o 99 só vira o app com contexto claro);
  - holerite não cria conta: sugere a do próprio holerite ou "Sem conta";
  - salário repetido (até R$ 1 e 3 dias de diferença) chega como "já está no app";
  - botão "Arrumar" junta as contas "Conta" sem nome, com Desfazer;
  - nomes de conta repetidos ficam diferentes ("Conta 1", "Conta 2");
  - tocar no saldo abre "Tudo do mês" (`MonthView`).

- **O que entrou na 1.9.2:**
  - conta sem saldo (`anchor`) fora de "Dinheiro nas contas", Previsto, projeção e ponte (`isCountable`), com "Informar saldo";
  - ponte por conta em "Tudo do mês" (`accountBridge`) e a frase no cartão Resultado do mês;
  - trocar o tipo ajusta título e conta (`titleForType`); "É meu?" em "Tudo do mês" (`looksLikeOwnTransfer`, `ownTransferChanges`, com Desfazer); `readEditable` limpa as pontas antigas;
  - "Tudo do mês" em tela inteira (View absoluta, não Modal, para o aviso de Desfazer continuar visível).

- **O que entrou na 1.9.3** (números que não enganam):
  - cartão "Seu mês" no Avançado (`balanceBridge`): começou + entrou + veio de outras contas − saiu = hoje; sem conta com saldo, vira "Sobra do mês";
  - nomes separados: "Sobra do mês" (entradas − saídas, sem transferências) e "Mudança no saldo" (hoje − começo do mês);
  - teto no "Ainda pode gastar": `cashAvailable` (insights.js) = Previsto no fim do mês − fatura em aberto; `monthBudget(..., cash)` devolve `remaining` cortado, `byLimit` e `capped`. Usado em FinanceScreen, EntryGreeting e CaptureModal;
  - holerite: `parsePayslip` marca `payslip: true`; `reconcile` acha o depósito do mesmo mês mesmo sem categoria Salário (`payslipTwin`) e `dupChanges` com `salaryFix` só troca a categoria;
  - `sameSalary`: mesmo mês em qualquer dia, ou até 3 dias na virada; valor até R$ 1 ou 0,5% (`nearSalary`);
  - `postedEarlier` (documentParser): linha do extrato com data depois do último "SALDO DO DIA" e data da compra no fim da descrição ("PAY JANEL 07/11", "COLET0711") volta para o dia da compra, paga.

- **O que entrou na 1.10** (de onde vem o dinheiro):
  - `budget` ganhou `incomeType`, `salaryDay`, `salaryAsk`, `useOwn`, `ownMonths`, `skipMonths`, `ownSource` (defaults em `store.js`);
  - `components/FinancePrompts.js`: um pop-up de cada vez (`pendingPrompt` em budget.js): salário primeiro, depois "usar no mês". Só aparece com a aba Finanças aberta: `App.js` passa `active` para as telas (todas ficam montadas);
  - `EditSheet.js` (revisão): pergunta de qual conta vêm os Pix com `holderPix` e, ao salvar, grava `salaryAsk` (sem tipo de renda) ou atualiza o salário base (renda fixa);
  - `insights.js`: `fromOtherAccounts`, `budgetFor` (orçamento + teto + outras contas; usado em Finanças e na saudação), `historyMonths`, projeção por `profile` com `low`/`high`; `previousMonths` pula `skipMonths`;
  - `budget.js`: `ownDecision`, `monthBudget(..., cash, own)` devolve `ownAmount`, `ownIncome`, `ownChoice`, `covered`;
  - `BudgetEditor`: tipo de renda, dia do salário, regra do dinheiro de outras contas (agora rola, com ScrollView);
  - `salaryToAsk` (budget.js): quem já tinha salário no app (até 2 meses atrás) recebe o "é o seu salário?" ao abrir Finanças; qualquer resposta grava `salaryAskSeen` e não pergunta de novo (uma importação nova com salário ainda pergunta);
  - `monthForecast`: com `incomeType: 'variable'` não soma salário base que ainda não caiu.
  - A 1.10 foi feita em duas sessões: a primeira parou depois dos docs (11h35, sem APK); a segunda revisou tudo, completou os dois itens acima e gerou o APK. Testes: 303.

- **O que entrou na 1.11** (backup + 2 correções):
  - `src/backup.js`: `BACKUP_KEYS` (todas as chaves `@org2/*`), `buildBackup`/`parseBackup`/`restorePlan` (puras, testadas), `exportBackup` (Android: `Directory.pickDirectoryAsync()`), `pickBackup`, `restoreBackup` (guarda o estado atual em `@org2/_antes_da_restauracao`), `undoRestore`, `backupAge`. Depois de restaurar: `restartApp()`.
  - Ajustes → Backup (`BackupSection` em Drawer.js). Testado pelo Kaiky em 08/11: backup, despesa nova, restauração, tudo certo.
  - Aviso de teste com contagem de 5 s (`components/AlertPreview.js`); saudação e pendências juntas, embaixo (`EntryGreeting`).

- **O que entrou na 1.12** (Matérias):
  - `src/subjects.js` (puro): `findSubject`, `enrichParsed`, `occupationName`, `itemsToLink`, `nextClass`, `readSubjectForm`, `readSemester`. `src/holidays.js` (puro): `easter`, `holidaysOfYear`, `holidaysOfMonth`, `STATES`.
  - `components/Subjects.js` (aba, formulário em Modal, passo de ligar itens, `SubjectTag`), `components/AboutFields.js`. Store: `subjects`, `addSubject`, `updateSubject`, `removeSubject`, `archiveSubjects`, `setSemester`, `linkItems` (os destrutivos devolvem o Desfazer).
  - Primeira abertura em 5 passos (novo: "Sobre você"). `Chip` ganhou `a11y`.
  - **Vibração:** na expo-notifications, `shouldPlaySound` do `setNotificationHandler` também controla a vibração (`ExpoNotificationBuilder.shouldVibrate`). Com `false` e o app aberto, o aviso sai com `setSilent(true)` e o canal é ignorado. Agora é sempre `true`; o silêncio do "Só vibração" vem do canal (`sound: null`). O teste mantém isso. Tela bloqueada já funcionava (o Kaiky confirmou).
  - **Microfone:** `autoListen` true para todos (`autoListenSet` faz a migração uma vez). Focar a caixa de texto chama `speech.abort()`.

## 4. Próximo passo: testar a 1.12 e seguir o plano

Plano em `claude/prumo-plano-estudos-seu-dia.md`: 1.13 Meus horários fixos, 1.14 Seu dia (tela Hoje), 1.15 Revisões automáticas, 1.16 Backup automático na nuvem. Decisões do Kaiky (08/11): não divulgar nada até "rodar bem"; Finanças congelado; uma função nova por versão; notas seguradas.

Três conselhos (skill ask-the-council) rodaram em 08/11: o app pende demais para Finanças e é feito sob medida para o Kaiky; prova deve virar plano ("hoje, 40 min de circuitos"); notas e cadastro de matérias por voz ficam para depois.

Pontos abertos da Base: privacidade da voz (`requiresOnDeviceRecognition` não é usado, o áudio pode ir para o Google); avisos em Xiaomi e Samsung nunca testados.

### (histórico) Próximo passo depois da 1.10

A 1.9.3 passou no celular em 08/11 (números batem). A 1.10 foi conferida com o extrato real (outras contas 540,96; "usar no mês" → pode gastar 526,83 pelo teto; meta 300 sem usar → passou 287,04, coberto) e no navegador (pop-ups, cartão do limite, Indicadores, Ajustar orçamento). A revisão de importação com a pergunta dos Pix não foi vista no navegador (o seletor de arquivo não abre lá): só por teste. Falta o teste no celular. Depois, a 1.11: lembrete de extratos, selo "Bate com o banco" e backup.

Fatos do extrato que o plano usa: salário de outubro 2.019,64 (05/10) e de novembro 3.157,49 (05/11): o valor varia mesmo sendo CLT, então a recorrência é pelo dia. Os Pix com o nome dele (532,75 em 05/10; 540,96 em novembro) vêm de outra conta dele que não está no app.

Em aberto, sem travar:
- **As 4 transferências de novembro:** o Kaiky tocou em "É extra" nelas. Para a 1.10 funcionar com elas, ele precisa tocar "É meu" em Recebimentos (o app não muda dados que ele editou).
- **Pix de R$ 250 todo dia 6** (out e nov): perguntado se é dinheiro guardado em outra conta dele ou pagamento a terceiro; sem resposta ainda.
- **Meta de guardar:** só o `BudgetEditor` grava `budget.target`. Se o limite está igual ao salário, a meta foi zerada lá, ou nunca foi salva nesta instalação.
- **Planilha:** a soma da planilha dá +R$ 1.095,99, então os −923,65 da "Conta" não são só ela. A comparação linha a linha continua pendente.

**Ideias sem data:** Tela "Hoje", backup, build no GitHub, chave própria antes da Play Store, IA (Haiku via Supabase), bot de WhatsApp (2.0).

**Quadro do Mapa:** 1.10 feita; 1.11 lembrete de extratos, selo "Bate com o banco" e backup; 1.12 saldo previsto dia a dia, assinaturas, limite por categoria e Simples calmo; 1.13 Faculdade.

**Perguntas em aberto com o Kaiky:**
- média para passar na faculdade e pesos das notas;
- a frase cortada "a questão da prioridade vai…";
- o que são os 21 valores "Entrada extra" da planilha: dinheiro novo ou outra conta dele.

## 5. Código: o que importa saber

- **Stack:** Expo SDK 58.0.23, RN 0.88.1, React 19.3, Hermes, JS puro, abas próprias (não usa Expo Router, apesar do AGENTS.md sugerir).
- **Armazenamento** (AsyncStorage `@org2/*`): tasks, study, finance, recurrences, accounts, misheard, settings, handled.
- **Visual:**
  - `index.js` → `src/Root.js` lê `@org2/settings` (layout e theme), chama `applyTheme`, carrega as fontes com expo-font e só então faz `require('../App')`.
  - `theme.js` exporta objetos vivos (`colors`, `look`, `AREA_PAL`), preenchidos antes dos `StyleSheet.create`.
  - Trocar o visual chama `switchVisual` e `restartApp()` (`reloadAppAsync`).
  - **Todo `Text` e `TextInput` vem de `src/AppText.js`**, que escolhe a fonte pelo peso e tamanho. Nunca importar `Text` de `react-native`.
  - Cores fixas só no `theme.js`. Texto sobre a cor da área usa `colors.onAccent`.
- **Finanças:**
  - `accounts.js`: saldo = anchor + efeitos depois dele; `reconcile`; `sameSalary`; `planMerge`; `accountDisplayName`; `likelyRepeated`.
  - `insights.js`: `receipts`, `monthForecast`, `balanceBridge`, `financeInsights`.
  - `budget.js`: limite = salário − meta; extras só entram com `countExtras`.
  - `store.js`: `mergeAccounts` e `patchFinance`.
- **Importação:**
  - `documentParser.js`: PDF com fontes por página e CSV (`Data;Descrição;Valor`). `SKIP` pula linhas de resumo, menos as cobranças (juros, IOF etc.). O holerite agora traz `meta.payslip`, banco e número.
  - Revisão em lote em `EditSheet.js` (`BatchContent`): conta escolhida, `'none'` = sem conta, ou `'new'`.
- **Interface:**
  - `ui.js`: `Screen` (título, subtitle, actions, foto), `Hero`/`heroText`, `Card`, `ListBox`, `Section`, `Segmented`, `Notice`, `IconButton`, `MicButton`, `Icon`.
  - Os ícones são PNG brancos em `assets/ui`, pintados com `tintColor`.
- **Telas:** `screens/FinanceScreen.js` (exporta `MoneyRow`), `components/MonthView.js`, `components/Insights.js`, `components/Accounts.js` (`AccountsCard`, `AccountEditor`, `FixAccounts`).
- **Testes:** `scripts/test-parser.mjs` (`npm test`, 404 casos).
  - Ele copia os arquivos de `src` para uma pasta temporária e troca os imports por `.mjs`.
  - Para testar um módulo novo, acrescente a cópia lá (veja como `insights.mjs` foi feito).

## 6. Como gerar o APK (recriar o ambiente)

Este chat usava uma cópia de build com a pasta `android/` pronta. No chat novo é preciso criar de novo:

1. **JDK 17:** `/usr/lib/jvm/java-17-openjdk-amd64` (se não existir: `apt-get update`, depois `apt-get install -y openjdk-17-jdk-headless`). O `sdkmanager` precisa de `--proxy=http --proxy_host=127.0.0.1 --proxy_port=<porta do HTTPS_PROXY>`.
2. **Android SDK** numa pasta da sessão (ex.: `$SP/android-sdk`), com cmdline-tools e:
   ```
   sdkmanager "platforms;android-37.0" "build-tools;37.0.0" "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.22.1" "platform-tools"
   ```
   Confira a versão de cmake e a do NDK no `android/build.gradle` gerado.
3. **Maven Central devolve 429,** e o portal de plugins redireciona para ele. Use um intermediário local que repete e guarda em cache: o `mavenproxy.py` abaixo, mais um init script do Gradle. Na 1.9.2 foi preciso também a rota `/portal/` (seção seguinte).
4. **Cópia de build:** copie o projeto para `$SP/apkbuild` (com `node_modules`) e rode `npx expo prebuild --platform android --no-install`.
   - O `app.json` já tem nome, ícones (`assets/`), splash, versão e o plugin `plugins/withShareTarget.js` (Compartilhar PDF/CSV), então o prebuild deve gerar tudo.
   - Confira se `android/app/src/main/res/values/strings.xml` diz Prumo e se os ícones são o Blocão.
   - Copie `keystore/debug.keystore` para `android/app/debug.keystore`. O `build.gradle` gerado já assina o release com ela.
5. **Build:**
   ```
   (cd $SP && nohup python3 mavenproxy.py 8099 $SP/mcache > $SP/mavenproxy.log 2>&1 &)
   cd $SP/apkbuild/android && JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=$SP/android-sdk NODE_ENV=production \
     ./gradlew assembleRelease --no-daemon --max-workers=2 -Pkotlin.compiler.execution.strategy=in-process > $SP/gradle.log 2>&1; echo EXIT $? >> $SP/gradle.log
   pkill -f mavenproxy; pkill java
   ```
   - Rode em segundo plano e espere o `EXIT` no log; não confie só no código de saída.
   - `gradle.properties`: `org.gradle.jvmargs=-Xmx3584m -XX:MaxMetaspaceSize=768m`.
   - Com mais workers, o processo morre por falta de memória.
6. **Conferir antes de entregar:**
   - `aapt2 dump badging app-release.apk`: package, versionCode, versionName e label Prumo;
   - `apksigner verify --print-certs`: o SHA-256 acima;
   - textos novos dentro do bundle Hermes: `unzip -p apk assets/index.android.bundle`, procurando em UTF-16LE os que têm acento.
7. **Para mudar a versão:**
   - `app.json` (`version` e `android.versionCode`);
   - `APP_VERSION` em `src/Drawer.js`;
   - `versionCode`/`versionName` em `android/app/build.gradle` da cópia, ou rodar o prebuild de novo;
   - "Novidades"/"Correções" no README.

**Conferência no navegador** (antes do APK):
```
npm i --no-save react-native-web@~0.21.4 react-dom@19.3.0
EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 npx expo export --platform web --output-dir $SP/dist
```
- Sirva o `dist` com um servidor http em Node. Com Playwright (já instalado; não reinstalar), grave dados no `localStorage` com `addInitScript` (chaves `@org2/*` em JSON, settings com `onboarded:true`, `layout`, `theme`) e tire prints com viewport 390 de largura.
- A saudação de entrada cobre o topo: clique nela antes do print.
- `Alert` não funciona no web.

**`mavenproxy.py`** (Python 3, usa curl; repete 429/5xx em repo.maven.apache.org e repo1.maven.org e guarda os arquivos na pasta de cache):
```python
import os, random, subprocess, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
PORT = int(sys.argv[1]); CACHE = sys.argv[2]
UPSTREAMS = ["https://repo.maven.apache.org", "https://repo1.maven.org"]
SEM = threading.Semaphore(2); os.makedirs(CACHE, exist_ok=True)
def fetch(path, dest):
    tmp = dest + ".part%d" % threading.get_ident(); os.makedirs(os.path.dirname(dest), exist_ok=True)
    for attempt in range(25):
        base = UPSTREAMS[attempt % 2]
        with SEM:
            r = subprocess.run(["curl", "-sL", "-m", "900", "-o", tmp, "-w", "%{http_code}", base + path], capture_output=True, text=True)
        code = r.stdout.strip()
        if code == "200": os.replace(tmp, dest); return 200
        if os.path.exists(tmp): os.remove(tmp)
        if code == "404": return 404
        time.sleep(min(8, 0.5 * (attempt + 1)) + random.random())
    return 502
class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def log_message(self, *a): pass
    def handle_any(self, head):
        path = self.path.split("?")[0]; dest = os.path.join(CACHE, path.lstrip("/")); miss = dest + ".404"
        if os.path.exists(dest): code = 200
        elif os.path.exists(miss): code = 404
        else:
            code = fetch(path, dest)
            if code == 404: open(miss, "w").close()
        if code != 200:
            self.send_response(code); self.send_header("Content-Length", "0"); self.end_headers(); return
        self.send_response(200); self.send_header("Content-Length", str(os.path.getsize(dest)))
        self.send_header("Content-Type", "application/octet-stream"); self.end_headers()
        if not head:
            with open(dest, "rb") as f:
                while (chunk := f.read(65536)): self.wfile.write(chunk)
    def do_GET(self): self.handle_any(False)
    def do_HEAD(self): self.handle_any(True)
ThreadingHTTPServer.daemon_threads = True
ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
```

Rota `/portal/` (acrescente ao `mavenproxy.py`): para caminhos que começam com `/portal/`, chame `fetch("/maven2" + resto, dest)` e, só se der 404, baixe de `https://plugins.gradle.org/m2` + resto com `curl -sL`, repetindo em 429/5xx.

**`~/.gradle/init.d/mirror.gradle`:**
```groovy
def swap = { repo ->
  if (repo instanceof MavenArtifactRepository &&
      (repo.url.toString().contains('repo.maven.apache.org') || repo.url.toString().contains('repo1.maven.org'))) {
    repo.url = uri('http://127.0.0.1:8099/maven2/'); repo.allowInsecureProtocol = true
  } else if (repo instanceof MavenArtifactRepository && repo.url.toString().contains('plugins.gradle.org')) {
    repo.url = uri('http://127.0.0.1:8099/portal/'); repo.allowInsecureProtocol = true
  }
}
beforeSettings { s ->
  // sem repositório declarado o Gradle usa o portal direto: declare o intermediário antes
  s.pluginManagement.repositories { maven { url = uri('http://127.0.0.1:8099/portal/'); allowInsecureProtocol = true } }
  s.pluginManagement.repositories.all(swap)
}
settingsEvaluated { s -> s.pluginManagement.repositories.all(swap); s.dependencyResolutionManagement.repositories.all(swap) }
allprojects { buildscript.repositories.all(swap); repositories.all(swap) }
```

## 7. Armadilhas já encontradas

- O PDF do Itaú usa o mesmo nome de fonte com subconjuntos diferentes em cada página: os recursos de fonte são lidos por página. Ele também tem "FATURA PAGA" e "Limite": por isso o tipo extrato é testado antes de fatura.
- `\bita[uú]\b` falha com "Itaú" acentuado: o `detectBank` agora testa o texto sem acentos.
- O Toast do app fica atrás de qualquer `Modal`. Telas por cima com Desfazer precisam do próprio aviso, ou ser um `View` por cima (com o toast em `zIndex: 30`).
- `Alert` não faz nada no web, então nos prints o "Cancelar" não fecha nada.
- Prints de página inteira no web pegam só a área visível: use um viewport alto.
- Em `AppText`, um Text dentro de outro herda a fonte, a menos que mude peso ou tamanho.
- Planilha convertida (`prumo-gastos-jan-out-2026.csv`): as datas foram inventadas (salário dia 5, faturas dia 10…), e o salário de agosto foi arredondado na planilha (1.662,90 × 1.662,97 do holerite).
- Contas sem saldo inicial somavam todo o histórico no total (R$ 8.609,61 e −224,58). Corrigido na 1.9.2.
- **`StyleSheet.absoluteFillObject` não existe no RN 0.88** (só `absoluteFill`). Espalhar `undefined` não dá erro: o elemento só perde o `position: absolute`. No web ele existe, então o bug não aparece. Para reproduzir no web, apague a linha `StyleSheet.absoluteFillObject = ...` em `node_modules/react-native-web/dist/exports/StyleSheet/index.js`. O `npm test` agora reprova quem usar.
- `page.clock.setFixedTime` do Playwright congela as animações que usam `Date.now`: o Toast fica com opacidade 0 no print.
- Não use `tar --exclude=dist` ao copiar o projeto: apaga as pastas `dist` de dentro do `node_modules`.
- O Itaú lista compras com a data do desconto (próximo dia útil), mas o "SALDO DO DIA" anterior já as inclui. Antes da 1.9.3 elas viravam "a pagar" e descontavam duas vezes no previsto.
- No web, `scrollIntoViewIfNeeded` não rola o ScrollView do RN: use `page.mouse.wheel` sobre o conteúdo até o elemento subir.
- `rsync` não existe na máquina: para atualizar a cópia de build, `rm -rf src && cp -a`.
- Todas as abas ficam montadas (`display: 'none'`): um `Modal` dentro de uma tela aparece por cima do app inteiro. Por isso as telas recebem `active`.
- No web, a saudação de entrada deixa uma camada invisível por cima do topo por um tempo: clique nos botões do topo com `el.click()` (via `evaluate`) ou espere uns 1,5 s.
- `Alert.alert` não funciona no web: nas telas novas (Matérias), o erro do formulário é um texto na própria tela.
- Todas as abas ficam montadas: no Playwright, `get_by_label` acha o mesmo botão em várias telas. Use `locator('[aria-label="..."]:visible')`.
- A tabela de feriados na internet tem muito erro entre sites (ES, AC, PR). Critério usado: duas fontes ou lei citada. O doc do plano dizia "PR → 19/12" e estava errado.
- A saudação de entrada deixa uma camada invisível por cima por um tempo: clique nos botões do topo com `el.click()` (via `evaluate`) ou espere 1,5 s.
- O bloco do backup em `test-parser.mjs` cria a própria pasta temporária com stubs de AsyncStorage e react-native.
