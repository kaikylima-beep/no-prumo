# Prumo 1.13 · "Prumo novo" (o que deu certo no Peep vira o Prumo)

## Contexto
O Kaiky testou o Peep no celular e aprovou: o layout, o jeito de ouvir/confirmar, a tela Hoje, Estudos, Ajustes e o nome "Dinheiro". Pediu para levar tudo isso ao Prumo, mantendo o que o Prumo tem e o Peep não (extrato, saldo, calendário, itens dos Ajustes), com liberdade para tirar o que é desnecessário — avisando depois o que saiu. Também mandou 2 frases que o Peep entendeu errado e quer as perguntas por voz.

Decisões dele (11/11): **layout do Peep com as cores do Prumo** (Blocão no botão de falar, anel azul/verde/roxo, sem amarelo) e **um visual só** (sai Simples/Avançado).

## Abordagem
O código do Peep passa a ser o código do Prumo (em vez de remendar as telas antigas). Os módulos de regra do Prumo que continuam valendo são trazidos para dentro dele sem reescrever.

- Pacote `com.meuorganizador.app`, nome **Prumo**, mesma assinatura → instala **por cima** e os dados continuam.
- Na 1ª abertura, os dados antigos (`@org2/*`) são convertidos sozinhos para o formato novo (`@prumo/state`). **As chaves antigas não são apagadas** (dá para voltar à 1.12.3 sem perder nada). Base: `peep/src/core/migrate.js` (`fromPrumo`, já testado), ampliado para contas e transferências.
- Estrutura: `peep/` sobe para a raiz (`App.js`, `src/`, `src/core/`); o código antigo vai para `docs/antigo/v1.12/` só para consulta; a pasta `peep/` e o workflow `peep-apk.yml` saem. `build-apk.yml` e `scripts/check-apk.sh` continuam iguais.

## O que entra em cada parte

**Visual** (`src/theme.js`, `src/ui.js`, `src/App.js`): layout do Peep; marca do Prumo — botão de falar escuro com o Blocão e anel azul→verde→roxo; destaques (cartão "Agora", botão principal) em tinta escura/cor da área no lugar do amarelo; ícone e splash do Prumo (`assets/` atuais).

**Ouvir e confirmar** (`src/Capture.js`): como no Peep. Volta do Prumo: escolha da melhor entre as 5 versões ouvidas (`pickBest` de `src/voice.js`), vocabulário (`buildVocab`), "Hoje ou Amanhã?" quando a hora já passou, e o modo de teste (frases corrigidas guardadas + "Mandar as frases").

**Hoje** (`src/screens/Today.js`): como no Peep + **calendário do mês** (botão ao lado dos 7 dias abre o mês; toca num dia e a tela mostra aquele dia), com **feriados** do estado (`src/holidays.js`, sem mudança).

**Estudos**: tudo do Peep (próxima prova, matérias com notas, faltas e horários). Volta do Prumo: semestre (início/fim) para contar aulas e sugerir o limite de 25% de faltas.

**Rotina fixa (defesa)**: mantém, mas **sai de Estudos**. Estágio, trabalho e academia não são matéria; sem eles o "Hoje" e os horários livres ficam errados. Vai para **Ajustes → Meus horários fixos**. Em Estudos ficam só as matérias.

**Dinheiro** (`src/screens/Money.js`): 
- Topo: **Saldo atual** em número grande (soma das contas, `accountsSummary` de `src/accounts.js`); embaixo Entrou · Saiu · A pagar do mês; limite do mês e "dá R$ X por dia".
- Contas (lista com saldo, "Informar saldo"), transferências entre contas.
- **Importar extrato** (PDF/CSV) e menu Compartilhar: `src/documentParser.js`, `src/importDocument.js`, `reconcile` em `src/accounts.js`, `modules/share-receiver`, `plugins/withShareTarget.js` — reaproveitados como estão; a revisão em lote ganha a cara nova (folha com lista marcável).
- Entram junto os 3 erros claros já planejados na 1.12.4: devolução de Pix se anula; títulos importados sem data/código grudado; menos números repetidos (resolvido pelo layout novo).
- Modelo: item de dinheiro ganha `account`, e tipo transferência (`from`/`to`); estado ganha `accounts`.

**Ajustes** (`src/Settings.js`): os do Peep (nome, aparência, resumo do dia, antes da aula, som/vibração, testar aviso, backup, palavras aprendidas) **+ os do Prumo**: foto e idade, ocupação e estado (feriados), títulos curtos, ouvir ao tocar no microfone, voz no próprio celular, horário exato, backup com "voltar ao que tinha" e alerta de 14 dias, modo de teste (5 toques na versão), meus horários fixos, semestre.

**Perguntas** (`src/core/answers.js`): já vêm do Peep (agenda do dia/semana, quanto gastei, quando é a prova, faltas, média, contas a pagar) + "qual meu saldo?". Avaliação: é o momento — roda no celular, sem internet, e não atrapalha quem não usa.

**Avisos** (`src/notify.js`, `src/core/plan.js`): modelo do Peep (refeitos a partir dos dados). Mantém os canais `lembretes-som`/`lembretes-vibrar` e `shouldPlaySound: true`.

## As 2 frases novas (campo Testes nº 5 e 6) — regras gerais em `src/core/nlu.js`
5. "Aulas de circuitos análise de circuitos às quintas-feiras das 21:20 até às 23 e sexta-feira das 18:20 até às 20:20 que isso te" → matéria **Análise de circuitos**, qui 21:20–23:00 e sex 18:20–20:20.
   - plural de dia ("quintas-feiras") e de "aulas"; "até às"; vários pares dia+horário na mesma frase viram vários horários da mesma matéria; nome = o que vem antes do 1º dia; quando a pessoa recomeça o nome ("circuitos análise de circuitos") vale a versão mais completa; sobra sem sentido depois do último horário é descartada (com aviso para conferir).
6. "Eu tenho 10 minutos para lavar louça e depois disso eu tenho que arrumar o quarto em 30 minutos" → **Lavar louça** (hoje, 10 min) e **Arrumar o quarto** (hoje, em seguida, 30 min).
   - "tenho N minutos para X" é duração, não horário; "depois disso/depois/em seguida" separa itens; item novo campo `duration` (aparece na linha e conta nos horários livres).
Cada regra entra no `npm test` com frases parecidas (nomes inventados).

## O que sai do Prumo (para avisar o Kaiky na entrega)
- Visual Simples/Avançado e o reinício para trocar tema.
- Importância por área (alta/média/baixa) → avisos com padrão fixo + "Me avisar" por item.
- Abas separadas Tarefas e Agenda → viram Hoje (com calendário) e Tudo.
- Em Dinheiro: Indicadores, "Seu mês"/ponte do saldo, Previsto e projeção, pop-ups de renda e de "dinheiro de outras contas", necessário × não necessário, salário base/meta de guardar/contar extras → fica saldo, mês, limite simples e categorias.
- Saudação de entrada em tela cheia e a prévia animada do aviso (fica "Testar um aviso").
- Primeira abertura em 5 passos → 1 tela.
Nada de dado é apagado: o que não tem tela nova continua guardado nas chaves antigas.

## Ordem de execução
1. Mover `peep/` para a raiz, arquivar o código antigo, ajustar `app.json` (pacote, nome, ícone, plugins, versão 1.13.0 / versionCode 23), `CLAUDE.md`.
2. Cores/marca do Prumo no tema e no botão de falar.
3. Migração automática `@org2/*` → estado novo (com contas e transferências) + testes.
4. Dinheiro: contas, saldo, transferências, importação e revisão.
5. Hoje com calendário e feriados; rotina fixa em Ajustes; semestre.
6. Ajustes completos; voz (`pickBest`, vocabulário, modo de teste).
7. Frases 5 e 6 + regras no interpretador + testes.
8. Docs: README (Novidades 1.13 e "o que saiu"), `docs/memoria/` (memoria, plano, testes, peep.md), agentes em `.claude/`.

## Verificação
- `npm test`: testes do Peep (111) + os de `documentParser`/`accounts`/`holidays` trazidos do `scripts/test-parser.mjs` + migração (backup inventado → estado novo, saldo por conta igual ao antigo) + frases 5 e 6.
- Navegador (export web, 390 px, claro e escuro): Hoje com calendário, Tudo, Estudos, Dinheiro com saldo e importação de `scripts/fixtures/extrato.pdf`, Ajustes, captura; prints.
- APK de teste pelo `build-apk.yml` ("Run workflow" no ramo); `check-apk.sh` confere pacote, nome Prumo e a assinatura de sempre.
- No celular (Kaiky): **salvar backup na 1.12.3 antes**, instalar por cima, conferir que tarefas, matérias, lançamentos e saldos vieram; voz, avisos, importar extrato, perguntas. Só vai para `main` (Release v1.13.0) com o "sim" dele.

## Riscos
- É a maior mudança do projeto: se a 1.13 der problema, voltar é reinstalar a 1.12.3 (dados antigos intactos) ou restaurar o backup.
- O calendário (`plano.md`) muda: 1.13 passa a ser o "Prumo novo" (já inclui notas/faltas, horários fixos e a tela Hoje das 1.13–1.15).
