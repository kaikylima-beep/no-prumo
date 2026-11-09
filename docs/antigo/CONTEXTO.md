# No Prumo (antes Meu Organizador): contexto do projeto

Atualizado em 08/11/2026, versão **1.12** (versionCode 19). Nome no celular: **Prumo**; slogan "Fala. Tá no prumo." O pacote Android continua `com.meuorganizador.app`, para instalar por cima sem perder dados.

App Android pessoal do Kaiky (estudante de engenharia, fala português, não programa). Todo o código foi feito pelo Claude, e o Kaiky recebe um APK pronto a cada versão. A ideia é ir melhorando aos poucos. Play Store está fora do plano por enquanto.

## O que o app é

Três áreas e um botão de microfone no meio da barra de baixo. A pessoa fala, o app separa cada coisa na área certa, mostra um resumo e só salva depois da confirmação.

- **Tarefas (azul):** casa e dia a dia, com data, horário e lembretes que se repetem ("todo dia às 8h e às 20h", "seg, qua e sex").
- **Finanças (verde):** entradas, saídas, contas a pagar, contas fixas mensais, orçamento, contas bancárias, transferências e importação de extrato.
- **Estudos (roxo):** abas Itens e Matérias. Itens: provas e entregas com contagem regressiva e avisos automáticos. Matérias: nome, apelidos, cor, sala, horários e semestre (1.12).
- **Agenda:** calendário do mês com filtros por área. Só no visual Avançado. De Finanças mostra só o que vai cair (a pagar e a receber), desde a 1.9. Desde a 1.12 marca feriados nacionais e do estado do perfil.
- **Visual Simples × Avançado, claro ou escuro:** escolhido na primeira abertura e trocado em Ajustes → Visual (o app reinicia sozinho).
  - **Avançado (visual 1):** cartões coloridos, cantos bem redondos, Space Grotesk nos números/títulos e Inter no texto. Finanças com Resumo, Recebimentos e botão Indicadores.
  - **Simples (visual 3):** calmo, um bloco de destaque por tela ("Agora", "Dinheiro nas contas"), listas com linhas finas, cantos de 4 px, só Inter. Finanças só com entradas e saídas; concluídas somem; barra termina em "Menu" (sem Agenda).
  - Marca e cores: doc `claude/prumo-marca-e-visual.md` e o canvas de design do projeto.

## Princípios combinados

- **Offline primeiro.** Os dados ficam só no celular (AsyncStorage) e o interpretador de voz funciona por regras, sem IA.
- **Nada é salvo sem confirmação.** Voz e importação sempre passam por uma tela de revisão.
- **Desfazer em toda ação destrutiva.**
- **Linguagem simples, em português, para leigo.** Os textos não usam jargão técnico.
- **Um tema por versão.** Correção vira .1/.2, e a próxima versão só começa quando a anterior passou no celular.
- **Finanças primeiro:** só se muda de área quando Finanças estiver redondo (pedido do Kaiky em 06/11).

## Numeração de versões

- **1.7 → 1.7.1 (correção):** só conserta. Nada novo para aprender.
- **1.7 → 1.8 (versão nova):** traz um tema novo. Instala por cima, os dados continuam e o que já existia funciona igual.
- **1.x → 2.0:** quebra a promessa "tudo fica no celular e funciona sem internet". Também vale para dados que mudam de formato sem volta ou atualização que exige desinstalar.
  - No plano, a 2.0 é o bot de WhatsApp, porque as mensagens ficam guardadas num servidor.
  - Depois da 1.9 vem a 1.10, não a 2.0.
- **Uma versão fecha quando:**
  - os testes automáticos passam;
  - o Kaiky usou 3 dias no celular;
  - toda reclamação foi resolvida ou virou cartão no quadro;
  - o README foi atualizado.

## Histórico

| Versão | Tema | Principais entregas |
|---|---|---|
| 1.1 | Primeiro APK | Microfone com confirmação, interpretador offline, 3 áreas, avisos às 8h |
| 1.2 | Entender certo | Listas com vírgula/"e", "ontem", horário, editar e Desfazer, a pagar/pago, contas mensais, saldo previsto, aba lateral (perfil), paletas, importância, Agenda |
| 1.2.1 | Correção | "comer bolo daqui a 30 minutos" deixou de virar gasto; contraste das cores |
| 1.3 | Simples ou avançado | Títulos curtos, visual simples/avançado, exemplos só no começo, som e vibração |
| 1.4 | Repetição | Lembretes que se repetem, botões no aviso (Feito, Adiar, Paguei), primeira abertura |
| 1.5 | Saudação | "Bom dia, Kaiky", pendências e área com menos coisas concluídas |
| 1.6 | Orçamento | Salário base, meta de guardar, gasto necessário × não necessário, projeção, avisos de gasto |
| 1.7 | Painéis e importação | Onboarding em 4 passos, cores fixas (azul/verde/roxo), ondas de áudio, Tarefas em Hoje/Semana com arrastar, contagem regressiva em Estudos, filtros na Agenda, painel de Finanças, importar extrato PDF/CSV com revisão em lote |
| 1.7.1 | Correção | Extrato do Itaú: lia só a 1ª página e o tratava como fatura; nomes de Pix; "né" separa tarefas; "Fazer comida" |
| 1.7.2 | Correção | Mês sem salário mostrava 324%; projeção só a partir do dia 10; um percentual só |
| 1.8 | Contas e transferências | Contas com saldo real, transferência como 3º tipo, saldo lido do extrato, pares entre extratos, reimportar sem duplicar, fatura paga sem dupla contagem |
| 1.8.1 | Compartilhar | O app aparece no menu Compartilhar do Android para PDF/CSV e abre direto a revisão |
| 1.12 | Matérias | Estudos com abas Itens e Matérias; semestre e arquivar; voz acha a matéria por nome ou apelido; "Faculdade ou estágio?"; ligar itens antigos; ocupação e estado no perfil; feriados na Agenda; correções: vibração no "Só vibração" com o app aberto, microfone já ouvindo |
| 1.11 | Backup | Ajustes → Backup: salvar tudo num arquivo .json (pasta à escolha), restaurar com confirmação, voltar ao que havia antes; correções: aviso de teste com contagem de 5 s no meio da tela e dica de "Mostrar como pop-up"; saudação e pendências juntas, embaixo da tela |
| 1.10 | De onde vem o dinheiro | "Esse é o seu salário de todo mês?" depois de importar ou ao abrir Finanças com salário já no app; renda de todo mês ou que varia; previsão pelo tipo de renda (faixa e meses que não contam); "Esse dinheiro é para gastar este mês?" para dinheiro de outras contas (entra no limite sem virar renda); cobertura quando passa do limite; revisão pergunta de qual conta vêm os Pix com o seu nome |
| 1.9.3 | Correção | "Seu mês" (começou + entrou + veio de outras contas − saiu = hoje); "Sobra do mês" e "Mudança no saldo" separados; "Ainda pode gastar" com teto no dinheiro real; holerite confirma o salário do extrato; salário repetido no mesmo mês; compras com data do próximo dia útil voltam para o dia certo |
| 1.9.2 | Correção | Conta sem saldo fora de "Dinheiro nas contas"; ponte do saldo em "Tudo do mês"; título e conta acompanham a troca de tipo e "É meu?"; "Tudo do mês" em tela inteira (`absoluteFillObject` não existe no RN 0.88) |
| 1.9.1 | Correção | "99" e "23 e 99" na voz; holerite não cria conta; salário repetido (±R$ 1, ±3 dias); Arrumar contas sem nome; tocar no saldo abre o mês inteiro |
| 1.9 | Finanças separadas e visual No Prumo | Recebimentos (salário, extras, entre suas contas), extras fora do limite, Indicadores, previsto pelas contas, extrato da conta, Simples só entradas/saídas, Agenda só com o que vai cair, ícone Blocão, claro/escuro, fontes; correções: Pix seu marcado não duplica, juros/IOF entram |

## Plano

Decisões de 08/11: **não divulgar nada** (nem APK, nem Play Store) até o app rodar bem; Finanças congelado; uma função nova por versão. Plano detalhado em `claude/prumo-plano-estudos-seu-dia.md`.

1. **Agora: testar a 1.12 no celular.** O backup já foi testado pelo Kaiky em 08/11 (fez backup, lançou uma despesa, restaurou: funcionou).
2. **1.13, Meus horários fixos:** um cadastro para aulas, estágio/trabalho e outros compromissos que se repetem, por voz ou à mão, com exceções (feriado, sem aula, semana de provas).
3. **1.14, Seu dia (tela Hoje):** linha do tempo do dia com fixos, tarefas com hora, provas e entregas, contas que vencem e horários livres; resumo de manhã e aviso antes da aula (opcionais). Fica no lugar da Agenda.
4. **1.15, Revisões automáticas:** cada prova gera 2 ou 3 sessões de revisão nos horários livres.
5. **1.16, Backup automático na nuvem:** pedido do Kaiky em 08/11. Salva sozinho, sem precisar lembrar. Precisa estar pronto antes de pensar em divulgar.
6. **Depois:** cadastrar matérias falando em sequência; faltas por voz; **notas** (seguradas pelo Kaiky; quando vierem: média simples, ponderada ou soma de porcentagens, com "quanto preciso tirar"); feriados municipais; OFX, leitura de PDF-foto e PDF da Caixa (Finanças, só depois do piloto); iOS (depois do "rodando bem" e com um iPhone para testar); IA e WhatsApp (2.0).
7. **Critério de "rodando bem"** (antes de pensar em divulgar): 3 semanas seguidas sem aviso perdido, backup restaurado com sucesso pelo menos uma vez (feito), frases de teste passando, nenhum dado perdido, uso diário sem contornar bug.

**Ideias sem data:**
- Aprender com as correções do usuário.
- Build automático no GitHub.
- Chave de assinatura própria (obrigatória antes da Play Store).

**Pendências de conversa:**
- A frase cortada do Kaiky: "a questão da prioridade vai…".

## Como Estudos funciona (1.12)

- **Matéria** (`@org2/subjects`): `{ id, name, aliases: [], color: 0 a 7, room, schedules: [{ days: [0-6], start, end }], archived, archivedAt, semester, createdAt }`. Item de estudo tem `subjectId`.
- **Semestre:** `settings.semester = { start, end }`. Passou do fim e há matérias ativas: aviso "O semestre terminou". Arquivar não apaga nada e tem Desfazer.
- **Achar a matéria** (`findSubject`, em `subjects.js`): nome ou apelido completos, ignorando acento e aceitando "calc2", "cálculo dois" e "Cálculo II". Uma palavra só do nome vale se só uma matéria ativa a tiver e não vier número depois.
- **Voz** (`enrichParsed`, chamado no `CaptureModal`): com matéria citada, o item vai para Estudos (menos "comprar livro de calc 2" e finanças). Sem matéria, com relatório, entrega, laboratório ou apresentação: pergunta "Faculdade ou [ocupação]?" na confirmação. Cita a ocupação ("relatório do estágio"): vai para Tarefas. Cita faculdade, prova, aula etc.: fica em Estudos sem perguntar. "Só estudo": sem pergunta.
- **Perfil:** `profile.occupation` ('trabalho', 'estagio', 'outros', 'so_estudo', null), `profile.occupationName` e `profile.state` (UF).
- **Feriados** (`holidays.js`, sem internet): nacionais fixos, Sexta-feira Santa, Carnaval e Corpus Christi (ponto facultativo), tabela dos 27 estados. **Conferir a tabela todo ano.** O Paraná não tem feriado estadual: 19/12 deixou de ser feriado com a Lei 18.384/2014 e aparece como data comemorativa.
- **Cores das matérias:** 8 em `theme.js` (`subjectColor`), sem o azul e o verde das áreas; contraste testado no `npm test`.

## Como Finanças funciona (1.10)

- **Lançamento:** `{ type: 'in' | 'out' | 'transfer', title, amount, category, date, status: 'paid' | 'pending', essential, account, from, to, recId, importId, note }`.
  - Entrada e saída pertencem a uma `account`.
  - Transferência tem `from` e `to`. O valor `null` quer dizer "outra conta sua fora do app".
- **Conta:** `{ id, name, kind: corrente | poupanca | investimento | cartao | carteira, number, bank, anchor: { date, balance, at, importId } }`.
  - **Saldo de hoje** = `anchor.balance` + o que entrou e saiu depois do anchor. Lançamentos do mesmo extrato não entram, nem os pendentes.
  - **Cartão:** saldo negativo é a fatura em aberto.
  - **Sem `anchor`** (corrente, poupança, investimento, carteira): saldo desconhecido. Fica fora de "Dinheiro nas contas", do Previsto, da projeção e da ponte (`isCountable`); aparece como "saldo não informado", com "Informar saldo". Sem nenhuma conta com saldo, o bloco pede o saldo em vez de mostrar um número.
- **Recebimentos** (`insights.js`): salário (categorias Salário e Bônus), extras (as outras entradas) e "entre suas contas" (transferências que entram numa conta que não é cartão). Totais só do que já caiu; "a receber" à parte. Correção com um toque: "É salário", "É meu" (vira transferência) e "É extra".
- **Orçamento:** usa só entradas e saídas, nunca transferências.
  - Limite do mês = salário − meta de guardar. Extras ficam fora, a não ser que `budget.countExtras` esteja ligado.
  - "% usado" = gasto total ÷ limite. É o mesmo número no cartão, na saudação e no aviso de gasto.
  - Mês sem salário e sem salário base: o limite não é calculado.
  - Projeção pelo ritmo de gastos só a partir do dia 10.
  - **Teto (1.9.3):** "Ainda pode gastar" nunca passa do dinheiro disponível (`cashAvailable`: Previsto no fim do mês − fatura em aberto). Quando corta, o cartão mostra o valor do limite e o do dinheiro.
- **Tipo de renda (1.10, `budget.incomeType`):** `fixed` (todo mês: CLT, estágio, contrato) ou `variable` (varia). Perguntado no pop-up "Esse é o seu salário de todo mês?" depois de uma importação com salário (`budget.salaryAsk`) ou ao abrir Finanças com salário dos últimos 2 meses já no app (`salaryToAsk`, uma vez: `salaryAskSeen`), ou em Ajustar orçamento, com o dia (`salaryDay`). Com `fixed`, o salário mais novo importado vira `budget.salary`.
- **Dinheiro de outras contas (1.10):** `fromOtherAccounts` = transferências pagas do mês que entram numa conta com saldo vindo de fora (sem origem ou de conta sem saldo). Só entra no limite se a resposta do mês (`ownMonths`) ou a regra (`useOwn`: ask/always/never) disser; nunca vira renda nem muda a Sobra. Pop-up "Esse dinheiro é para gastar este mês?" (≥ R$ 10, só no Avançado, só com a aba Finanças aberta). Passou do limite e o dinheiro está fora: o cartão diz quanto ele cobre (`covered`).
- **Pix com o seu nome na importação (1.10):** o parser marca `holderPix`; a revisão pergunta de qual conta (uma das suas, Cadastrar conta, Não acompanho) e guarda em `budget.ownSource`.
- **Seu mês (1.9.3, cartão no Avançado):** começou o mês + entrou + veio de outras contas suas − saiu (− faturas pagas) = hoje nas contas (`balanceBridge`). Embaixo, "Sobra do mês" (entradas − saídas, sem transferências) e "Mudança no saldo" (hoje − começo do mês); a diferença é o que veio de outras contas. Sem conta com saldo, o cartão e o destaque viram "Sobra do mês".
- **Ponte do saldo em "Tudo do mês"** (`accountBridge`, por conta): saldo no início + entrou + entre contas − saiu = saldo do extrato. Só para conta com saldo e a partir do mês desse saldo; antes dele o extrato pode não cobrir o mês inteiro. O que foi lançado depois do extrato aparece em "Depois disso".
- **Trocar o tipo de um lançamento:** `titleForType` tira o título automático de transferência e a conta vem da ponta certa. Entrada ou saída que ficou com título de transferência mostra "É meu?" em "Tudo do mês" (`ownTransferChanges`, com Desfazer).
- **Contas sem nome** (`isPlaceholder`: "Conta"/"Cartão" sem número, banco nem saldo): Finanças → Contas mostra "Arrumar", que usa `planMerge` + `mergeAccounts` (store) com Desfazer.
- **Voz:** "99" só é o app com contexto claro; "N e DD"/"N reais e DD" vira centavos (`joinCents`), exceto data/hora/unidade, outro número depois ou dois gastos com nome.
- **Previsto no fim do mês:** dinheiro nas contas + a receber − a pagar (+ salário base ainda não lançado). Sem contas, parte do resultado do mês.
- **Indicadores** (`financeInsights`): meses marcados "não conta" (`budget.skipMonths`) ficam fora de todas as médias; gasto até hoje × média dos 3 meses anteriores **até o mesmo dia**; quanto deveria ter sobrado nesses meses e a meta; categorias e cartão que mais subiram (≥ R$ 20 e ≥ 15%); projeção de 3 meses pelo tipo de renda (todo mês: salário confirmado − gasto médio, com 1 mês normal; varia: média dos meses normais com faixa do pior ao melhor, com 2 meses normais); ponte do saldo (início do mês + entradas − saídas − faturas ± transferências de fora = hoje).
- **Importação** (`documentParser.js`, tudo no celular):
  - **PDF:** lê o texto com pako, com fontes ToUnicode por página. O Itaú usa fontes diferentes com o mesmo nome em cada página.
  - **CSV:** detecta o separador e os formatos brasileiros.
  - **Tipo de documento:** extrato, fatura ou holerite.
  - **Do cabeçalho:** banco, agência, conta e saldo do dia mais recente. No holerite, banco e conta da linha "Banco:" (só para sugerir a conta).
  - Compras com data do próximo dia útil depois do último "SALDO DO DIA" (Itaú: "PAY JANEL 07/11" com data 09/11) voltam para o dia da compra, pagas: o saldo já as inclui (1.9.3).
  - Linhas de resumo ("saldo", "total", "limite") são puladas, mas cobranças do banco (juros, IOF, tarifa, encargos, multa, anuidade) sempre entram.
  - **Viram transferência:** Pix/TED com o nome do titular, "mesma titularidade", aplicação e resgate.
  - **Pagamento na fatura:** vira transferência que entra no cartão.
  - **Na revisão** (`EditSheet.js` em modo lote + `accounts.reconcile`):
    - escolher a conta;
    - duplicados chegam desmarcados e só ganham a conta;
    - uma entrada antiga que era Pix próprio vira transferência, marcada ou não (antes da 1.9, marcar criava um lançamento a mais);
    - salário igual (até R$ 1 ou 0,5%) a um que já está no app, no mesmo mês em qualquer dia ou até 3 dias na virada, chega como repetido (1.9.3; antes eram 3 dias);
    - holerite confirma: se o depósito do mês já está no app, mesmo como "Pix recebido", o holerite não entra e o depósito passa a ser salário (1.9.3);
    - conta padrão: a que bate pelo número (ignorando zeros à esquerda) ou pelo banco; sem banco no arquivo (holerite, planilha), "Sem conta". Conta nova só quando o arquivo diz o banco e você não tem conta dele;
    - pares entre extratos: mesmo valor, sentido oposto, até 1 dia (3 dias no cartão) viram uma transferência só;
    - "Fatura do cartão" na corrente vira transferência para o cartão quando as compras dele já estão no app.

## Stack e estrutura

- **Base:** Expo SDK 58 (React Native 0.88.1, React 19, Hermes), JavaScript puro, navegação por abas própria (não usa Expo Router).
- **Módulos:**
  - Expo: expo-speech-recognition (pt-BR, com eventos de volume), expo-notifications, expo-task-manager, expo-image-picker, expo-file-system (API `File`), expo-document-picker, expo-font (Inter e Space Grotesk em `assets/fonts`, carregadas no início).
  - pako, para descomprimir PDF.
  - Módulo local `modules/share-receiver` (Kotlin), que recebe arquivos do menu Compartilhar.
- **Armazenamento (AsyncStorage):** `@org2/tasks`, `@org2/study`, `@org2/finance`, `@org2/recurrences`, `@org2/accounts`, `@org2/misheard`, `@org2/settings`, `@org2/handled`, `@org2/subjects`.
- **Avisos:**
  - Canais `lembretes-som` e `lembretes-vibrar`.
  - Categorias com botões: lembrete (Feito / Adiar), conta (Paguei / Amanhã), receita (Recebi / Amanhã).
  - Tarefa em segundo plano `meu-organizador-botoes-dos-avisos`, registrada no `index.js`.

```
App.js                         abas, microfone, aba lateral, avisos, Compartilhar
index.js                       registra a tarefa dos botões dos avisos e abre o Root
src/Root.js                    lê o visual salvo, aplica cores e fontes, depois carrega o App; restartApp()
src/AppText.js                 Text/TextInput com a fonte certa pelo peso e tamanho
src/parser.js                  interpretador de frases em português (regras, offline)
src/recurrence.js              lembretes que se repetem
src/store.js                   dados, contas, configurações, desfazer
src/reminders.js               notificações locais
src/actions.js                 botões dos avisos com o app fechado
src/budget.js                  orçamento do mês
src/accounts.js                saldo por conta, transferências, reconciliação de extratos
src/documentParser.js          leitor de PDF/CSV de extrato, fatura e holerite
src/importDocument.js          seletor de arquivo e montagem da revisão
src/theme.js                   cores do No Prumo: Avançado/Simples × claro/escuro (objetos vivos preenchidos por applyTheme)
src/insights.js                recebimentos, indicadores, previsto e ponte do saldo
src/greeting.js                saudação e mensagens de entrada
src/CaptureModal.js            microfone, ondas de áudio, confirmação
src/EditSheet.js               edição de um item e revisão em lote
src/Drawer.js                  aba lateral (perfil e ajustes)
src/Onboarding.js              primeira abertura em 5 passos
src/screens/                   Tarefas, Finanças, Estudos, Agenda
src/components/                ItemFields, SwipeRow, Waveform, Accounts, RepeatRow, BudgetEditor, EntryGreeting, Insights
assets/ui/                     ícones da barra e o botão do microfone (PNG, pintados com tintColor)
modules/share-receiver/        módulo Android do menu Compartilhar
plugins/withShareTarget.js     coloca o app no menu Compartilhar (PDF e CSV)
src/components/FinancePrompts.js  pop-ups "é o seu salário?" e "usar no mês?" (1.10)
src/components/MonthView.js    o mês inteiro (abre ao tocar no saldo), em tela inteira: ponte do saldo, por data, filtros, excluir e "É meu?"
src/subjects.js                matérias: achar na frase, "Faculdade ou estágio?", horários, formulário, semestre (1.12)
src/holidays.js                feriados nacionais, móveis e dos 27 estados (1.12)
src/components/Subjects.js     aba Matérias, formulário e ligar itens antigos (1.12)
src/components/AboutFields.js  ocupação e estado, em Ajustes e na primeira abertura (1.12)
src/backup.js                  backup: montar, conferir, salvar, restaurar e desfazer (1.11)
src/components/AlertPreview.js contagem do aviso de teste (1.11)
scripts/test-parser.mjs        404 testes (npm test)
scripts/fixtures/              PDFs e CSVs de exemplo dos testes
```

## Como o APK é gerado

- Build local com Gradle num ambiente na nuvem:
  - JDK 17 e Android SDK na pasta temporária da sessão;
  - proxy de cache do Maven (`mavenproxy.py`, porta 8099), por causa do limite 429 do Maven Central;
  - `--max-workers=2`, para não estourar a memória.
- **Assinatura:** chave de teste pública do Expo (debug.keystore, SHA-256 `fac61745…`). Cada versão instala por cima da anterior sem perder dados. Antes de distribuir para outras pessoas, trocar por uma chave própria.
- **Antes de cada entrega:**
  - `npm test`;
  - versão no app web exportado, com capturas pelo Playwright;
  - conferir com aapt2/apksigner o versionCode e a assinatura;
  - conferir as strings novas dentro do bundle Hermes.
- **Para mudar a versão:**
  - `app.json` (`version` e `android.versionCode`);
  - `APP_VERSION` em `src/Drawer.js`;
  - `versionCode`/`versionName` no `android/app/build.gradle` da cópia de build;
  - "Novidades" no README.
- **Ícone e nome nativos** ficam na cópia de build (`android/app/src/main/res`): mipmaps gerados do Blocão, `app_name` = Prumo, fundo #12151C.

## Artefatos

- **Mapa do No Prumo:** página com o histograma das versões, a linha do tempo, Simples × Avançado, o quadro (Kanban) e as regras de versão. É atualizada a cada versão.
- **Plano técnico das Frentes 3 e 4 (Claude Doc):**
  - **IA:** Claude Haiku 5.5 × OpenAI, JSON compatível com o `store.js`, chave escondida numa Edge Function.
  - **WhatsApp:** Cloud API, caixa de entrada e sincronização com o app fechado.
  - **Custos e LGPD.**
