# No Prumo

App Android pessoal com três áreas (Tarefas, Finanças e Estudos), uma Agenda e um botão de microfone que organiza o que você fala. *Fala. Tá no prumo.* (Antes chamado Meu Organizador; o nome no celular agora é **Prumo**.)

Versão atual: **1.12.3**

## Correções da 1.12.3

- **Restaurar o backup refaz os avisos.** Antes, quem restaurava num celular novo ficava sem nenhum lembrete, e no mesmo celular continuavam tocando avisos de coisas que não existiam mais. "Voltar ao que eu tinha" também refaz.
- **"Ocultar valores" vale para os avisos.** Com o olho fechado em Finanças, o aviso diz "Vence hoje: Conta de luz", sem o valor, que aparecia na tela de bloqueio.
- **A saudação bate com a tela.** "Você tem 2 tarefas para hoje" é o mesmo número do destaque de Tarefas (antes contava também as de amanhã e as sem data). O app só cobra uma área quando há algo vencendo hoje ou atrasado: uma prova daqui a 6 dias não gera mais "você precisa concluir seus lembretes de Estudos".

## Novidades da 1.12.2 · Ajustes mais limpos
- Ocupação e estado saíram do meio dos Ajustes: ficam em "Ajustar perfil", embaixo da idade.
- Corrigir o que o app ouviu ficou mais fácil de achar: na confirmação, é só tocar no texto ouvido. Corrigir o nome de um item falado (tela Editar) também ensina o app.
- A parte de mandar frases para correção virou "modo de teste" (5 toques na versão, no fim dos Ajustes). No modo de teste, toda frase que você corrigir fica guardada sozinha.

## Novidades da 1.12.1 · Voz que entende
- O app pede ao Android pontuação, o vocabulário do app e da pessoa (Pix, prova, matérias, contas) e até 5 versões do que ouviu, e fica com a que entende melhor. Usa o reconhecimento no próprio celular quando o aparelho deixa (Ajustes → Voz); se o aparelho recusar, volta sozinho ao modo anterior.
- Espera 2 segundos de silêncio antes de encerrar e junta os pedaços da fala.
- Entende fala corrida, sem vírgula: "lavar o carro às 10 da noite fazer o pix do João de 60 estudar para a prova" vira 3 itens.
- "3 horas da tarde" é horário; só o horário, sem o dia, é hoje; se o horário de hoje já passou, a confirmação pergunta: Hoje ou Amanhã.
- "Ouvi isso" pode ser corrigido ("Corrigir" → "Entender de novo"); as outras versões ouvidas aparecem como opção.
- O app aprende com as correções: da 1ª vez sugere a troca, da 2ª em diante troca sozinho e avisa (com Desfazer). Fica só no celular; dá para esquecer em Ajustes → Voz.
- Ocultar valores: olho no topo de Finanças troca os valores por "R$ ••••" (também na Agenda e na saudação) e fica lembrado.
- Dicas de frase não somem mais depois de 3 usos.

## Correções da 1.12.1
- "Guardar para correção" agora avisa na própria tela (antes o aviso ficava escondido atrás dela), não guarda repetido e leva junto as versões ouvidas, o áudio (só no celular) e o que foi salvo.
- Título não pega mais "quando eu chegar em casa…" nem "fazer o" ("Pix do João").

## Novidades da 1.12 · Matérias

- **Estudos ganhou duas abas: Itens e Matérias.** Cada matéria tem nome, apelidos, cor (8 opções), sala opcional e um ou mais horários. No Avançado aparecem como cartões na cor da matéria; no Simples, como lista calma.
- **Semestre:** informe início e fim. Quando acaba, o app sugere arquivar as matérias. Arquivar não apaga nada, e dá para reativar.
- **A voz conhece as matérias:** "prova de calc 2 sexta" cai em Cálculo 2 e aparece com a cor dela. Vale apelido, "cálculo dois", "calc2" e "Cálculo II". Na confirmação, dá para trocar a matéria.
- **"Faculdade ou estágio?"** Uma frase com relatório, entrega, laboratório ou apresentação que não cita matéria faz o app perguntar. "Relatório do estágio" já vai direto para Tarefas.
- **Itens antigos:** ao cadastrar uma matéria, o app mostra as provas e entregas que já a citam e pergunta se quer ligar.
- **Perfil:** "Além dos estudos, você…" (Trabalho, Estágio, Outros ou Só estudo) e "Seu estado", em Ajustes e na primeira abertura.
- **Feriados na Agenda, sem internet:** nacionais, Carnaval e Corpus Christi (ponto facultativo) e os do seu estado. Municipais ficam para depois. A tabela em `src/holidays.js` precisa ser conferida todo ano.
- O backup agora leva também as matérias.

## Correções da 1.12

- **Vibração:** em "Só vibração", o aviso que chegava com o app aberto (inclusive o de teste) saía mudo. Agora vibra. Se a vibração estiver desligada nas notificações do Prumo, o aviso de teste diz isso e abre os ajustes.
- **Microfone:** tocar no microfone já começa a ouvir, sem segundo toque, inclusive para quem já tinha o app. Tocar na caixa de texto para de ouvir, para digitar. Dá para desligar em Ajustes → Voz.

## Novidades da 1.11

- **Backup:** em Ajustes → Backup, "Salvar backup" grava um arquivo com tudo do app (tarefas, estudos, finanças, contas, ajustes e a foto de perfil) na pasta que você escolher, como Downloads ou uma pasta do Drive. "Restaurar" lê esse arquivo, mostra o que tem nele e pede confirmação antes de trocar os dados. Antes de restaurar, o app guarda uma cópia do que existe, e "Voltar ao que eu tinha" desfaz a restauração. Ajustes mostra a data do último backup e destaca quando passa de 14 dias.

## Correções da 1.11

- **Aviso de teste:** em Ajustes → Avisos, escolher "Som e vibração" ou "Só vibração" agenda um aviso de teste para daqui a 5 segundos. No meio da tela aparece uma contagem (5, 4, 3, 2, 1) e, quando o aviso chega, a explicação do que fazer se ele só tocou e não apareceu ("Mostrar como pop-up"), com o botão Abrir ajustes. Antes o aviso saía na hora, com o app aberto, e em vários Android só tocava e vibrava.
- **Saudação:** "Boa noite" e as pendências ("você tem 2 tarefas pendentes") aparecem juntas, na hora, embaixo da tela, no lugar dos avisos de Desfazer. Antes as pendências chegavam 2 segundos depois e o cartão ficava em cima do título da tela. No máximo 2 mensagens.

## Novidades da 1.10 · De onde vem o dinheiro

- **"Esse é o seu salário de todo mês?"** Depois de importar um extrato ou holerite com salário, o app pergunta. Quem já tinha salário no app antes da 1.10 recebe a mesma pergunta ao abrir Finanças. "Sim, recebo todo mês" (CLT, estágio, contrato) guarda o valor e o dia; "Não, minha renda varia" (autônomo, bicos) faz o app usar médias. Com renda de todo mês, o salário mais novo importado vira o salário base, porque o valor pode mudar.
- **Tipo de renda em Ajustar orçamento:** "Todo mês" ou "Varia", com o dia em que o salário cai.
- **Previsão pelo tipo de renda (Indicadores):** renda de todo mês usa o salário confirmado menos o gasto médio. Renda que varia usa a média dos meses normais e mostra uma faixa, do pior ao melhor mês. Toque num mês para marcar "não conta" (um mês com salário em dobro, por exemplo). Sem meses suficientes, o app avisa em vez de inventar um número.
- **Dinheiro de outras contas suas:** quando entra dinheiro de outra conta sua, o app pergunta "Esse dinheiro é para gastar este mês?". "Sim, usar no mês" põe o valor no "Ainda pode gastar" sem virar renda (a Sobra do mês continua honesta). "Não, é reserva" deixa fora. Dá para trocar no cartão do limite e escolher a regra em Ajustar orçamento (Perguntar, Usar no mês, Reserva).
- **Passou do limite com dinheiro guardado:** o cartão diz quanto da sua outra conta cobre a diferença, em vez de só "passou do limite".
- **Pix com o seu nome na importação:** a revisão pergunta uma vez de qual conta eles vêm: uma conta sua, "Cadastrar conta" ou "Não acompanho". O app lembra a resposta.
- **Recebimentos:** a seção "De outras contas suas" diz se o valor está ou não no limite do mês.
- **Previsto no fim do mês:** com renda que varia, o app não soma um salário que ainda não caiu.

## Correções da 1.9.3

- **Seu mês:** o cartão "Resultado do mês" virou uma ponte que fecha com o banco: começou o mês + entrou + veio de outras contas suas − saiu = hoje nas contas.
- **Dois números com nomes próprios:** "Sobra do mês" é o que você ganhou menos o que gastou. "Mudança no saldo" é quanto o saldo mudou desde o começo do mês. A diferença entre os dois é o dinheiro que veio de outras contas suas.
- **Ainda pode gastar:** nunca passa do dinheiro que você tem nas contas, já tirando o que há a pagar e a fatura em aberto. Quando o limite daria mais, o app mostra os dois valores.
- **Holerite ou extrato:** o app diz qual dos dois leu. O holerite confirma o salário do mês: se o extrato já trouxe esse salário, ele não entra de novo, mesmo com outra data. Se o depósito veio como "Pix recebido", passa a contar como salário.
- **Salário repetido:** o mesmo salário no mesmo mês, em qualquer dia (até R$ 1 ou 0,5% de diferença), aparece como repetido em "Tudo do mês".
- **Compras com data do próximo dia útil:** o Itaú lista algumas compras com a data em que foram descontadas (ex.: compra de 07/11 com data 09/11). Elas voltam para o dia da compra, como pagas, e não descontam de novo no previsto.
- **Recebimentos:** a frase agora explica que Pix de outra conta sua entra no saldo, mas não é renda.

## Correções da 1.9.2

- **Dinheiro nas contas:** conta sem saldo informado fica fora do total, do previsto e das projeções. Ela aparece como "saldo não informado", com a opção de digitar o saldo de hoje. Sem nenhum saldo, o bloco pede o saldo em vez de mostrar um número.
- **Tudo do mês:** o topo mostra de onde veio o saldo de cada conta (início do mês + entrou + entre contas − saiu), igual ao extrato. O cartão Resultado do mês explica a diferença para o saldo do banco.
- **Transferências:** ao trocar para entrada ou saída, o título e a conta acompanham. O que ficou com título de transferência ganha o botão "É meu?", com Desfazer.
- **Tudo do mês em tela inteira:** a barra de baixo e o microfone não aparecem mais no meio. A causa era o estilo `absoluteFillObject`, que não existe no React Native 0.88. A faixa de deslizar das listas tinha o mesmo problema.

## Correções da 1.9.1

- **"99" não é mais o app de corrida quando é parte do valor.** "23,99 gasto na farmácia" e "passei 23 e 99 na farmácia" viram Farmácia, R$ 23,99, Saúde, necessário. "23 e 99" e "23 reais e 99" numa frase de gasto são reais e centavos. O 99 continua sendo o app quando a frase deixa claro ("peguei um 99", "corrida da 99", "99 pop") ou vem seguido do valor ("uber 25 e 99 15" = 2 gastos).
- **Holerite não cria mais conta.** A revisão sugere a conta que o próprio holerite cita (banco e número, ex.: Itaú) ou "Sem conta"; nunca cria uma conta "Conta" sozinha. Planilha sem banco também começa em "Sem conta".
- **Salário repetido**: uma entrada de Salário com até R$ 1 e 3 dias de diferença de outra que já está no app chega como "já está no app" (desmarcada). Ex.: holerite 1.662,97 × planilha 1.662,90; 04/09 × 05/09.
- **Arrumar contas**: se já existem contas sem nome criadas pelas importações, aparece um aviso em Finanças → Contas com o botão **Arrumar**. Ele junta essas contas numa conta de verdade (ou deixa os lançamentos sem conta), mostra os salários que parecem repetidos e só apaga se você marcar. Nenhum lançamento some sem você escolher, e dá para desfazer.
- **Nomes iguais**: contas com o mesmo nome aparecem diferentes ("Conta 1", "Conta 2", ou com o banco/final do número), na revisão, na edição e na confirmação de voz.
- **Tocar no saldo abre o mês inteiro** (nos dois visuais): entradas, saídas e transferências por data, com filtros (Tudo, Entradas, Saídas, Transferências, Sem conta), aviso "parece repetido", toque para corrigir (inclusive trocar a conta) e × para excluir com Desfazer.

## Novidades da 1.9.0: Finanças separadas e visual No Prumo

- **Recebimentos** (nova aba em Finanças, no Avançado): o que entrou fica em três grupos. **Salário**, **Extras** (Pix de outra pessoa, reembolso, freela, rendimento) e **Entre suas contas** (Pix seu de uma conta para outra). Só salário e extras são dinheiro novo; transferência sua não infla nada. Em cada linha dá para corrigir com um toque: "É salário", "É meu" ou "É extra". O que ainda vai cair aparece como "a receber", fora do total.
- **Extras fora do limite**: o "Ainda pode gastar" vem do salário. Em Orçamento → Extras você escolhe se os extras somam no limite.
- **Indicadores** (botão ao lado da foto, em Finanças, no Avançado): quanto você gastou até hoje comparado com os meses anteriores **até o mesmo dia**; quanto deveria ter guardado nos últimos 3 meses (e quanto foi mesmo para a poupança); o que mais subiu (cartão e categorias); **se continuar assim**, quanto vai ter nas contas nos próximos 3 meses (já descontando a fatura em aberto); e **de onde veio o saldo de hoje**: saldo do início do mês + entradas − saídas − faturas ± transferências de fora = saldo de hoje.
- **Previsto no fim do mês** agora parte do dinheiro nas contas: contas + a receber − a pagar (+ salário base ainda não lançado).
- **Extrato da conta**: toque numa conta para ver os últimos lançamentos dela.
- **Simples só com entradas e saídas**: dinheiro nas contas, "Entrou" e "Saiu", o que vence logo e a lista. Contas, salário e extratos continuam guardados e o botão de importar fica no topo.
- **Agenda só com o que vai cair**: de Finanças, aparecem só as contas a pagar e a receber. O que já foi pago ou veio do extrato fica em Finanças.
- **Visual No Prumo**: ícone novo (o Blocão), botão do microfone com o anel nas três cores, ícones na barra de baixo, fontes Space Grotesk e Inter. Avançado com cartões coloridos; Simples calmo, com um bloco de destaque por tela ("Agora", "Dinheiro nas contas") e listas com linhas finas. **Claro ou escuro** nos dois, escolhido na primeira abertura e em Ajustes → Visual (o app reinicia sozinho para trocar).

## Correções da 1.9.0

- Reimportar um extrato com "já está no app como entrada; vai virar transferência" **marcado** criava um lançamento a mais. Agora converte o que existe, marcado ou não.
- "JUROS LIMITE DA CONTA" e "IOF SALDO DEVEDOR" eram pulados porque têm "limite" e "saldo" no nome (palavras de linhas de resumo). Cobranças do banco (juros, IOF, tarifa, encargos, multa, anuidade) agora sempre entram.

## Novidades da 1.8.1

- **Compartilhar com o app**: no app do banco, toque em Compartilhar no extrato (PDF ou CSV), na fatura ou no holerite e escolha Meu Organizador. O app abre direto em Finanças, na revisão, sem precisar salvar o arquivo antes. Com o app aberto ou fechado.

## Novidades da 1.8.0: contas e transferências

- **Contas**: Itaú, Nubank, poupança, cartão, dinheiro vivo. Cada lançamento pertence a uma conta, e cada conta mostra o saldo de hoje. O cartão "Dinheiro nas contas" em Finanças soma tudo e deve bater com o banco.
- **Saldo do extrato**: ao importar, o app reconhece o banco, a agência e a conta pelo cabeçalho e oferece usar o saldo do extrato (no Itaú, o "saldo do dia" mais recente). Daí para frente ele soma o que entrar e tira o que sair.
- **Transferência** é um terceiro tipo, além de entrada e saída: tira de uma conta e põe em outra, sem contar como renda nem gasto. Pix e TED com o seu nome, "mesma titularidade", aplicação e resgate viram transferência sozinhos.
- **Vários extratos**: ao importar a segunda conta, o app acha a outra ponta de cada transferência (mesmo valor, sentido oposto, até 1 dia de diferença) e junta as duas numa só. Reimportar o mesmo extrato não duplica nada: o que já existe ganha a conta, e uma entrada que era Pix seu vira transferência.
- **Fatura do cartão**: se as compras do cartão já estão no app, o "Fatura paga" da conta corrente vira transferência para o cartão (senão o gasto contaria duas vezes). Sem as compras no app, continua contando como gasto. Na fatura importada, o "pagamento recebido" vira a entrada da transferência no cartão.
- **Resultado do mês** (antes "Saldo do mês"): o que entrou menos o que saiu, sem transferências. É ele que o orçamento usa. O dinheiro de verdade fica em "Dinheiro nas contas".
- **Guardado no mês**: transferências para poupança ou investimento aparecem no cartão do orçamento.
- **Lançamentos por voz** vão para a conta principal (a primeira conta corrente, ou a que você escolher); compras no cartão vão para o cartão.
- Boleto e débito automático importados entram em Contas (necessário).

## Correções da 1.7.2

- **Orçamento de mês sem salário**: um mês importado pela metade (outubro, com R$ 90 de entrada) mostrava "324% do limite". Agora, sem salário lançado e sem salário base, o cartão avisa que não dá para calcular o limite e mostra só o total gasto.
- **Projeção só a partir do dia 10**: no começo do mês o ritmo engana (aluguel, contas e o extrato importado caem todos nos primeiros dias), o que dava "sobram R$ 0,00". Antes do dia 10 o cartão diz que ainda é cedo. Quando o saldo projetado é negativo, aparece "faltam R$ X", em vez de R$ 0,00.
- **Um número só**: a mensagem de entrada, o aviso de gasto e o cartão usam o mesmo percentual (gasto total ÷ limite do mês). Antes um dizia 82% e o outro 94%.
- **Cores da legenda** iguais às da barra; a barra só fica laranja a partir do ponto de aviso da importância de Finanças.
- **Média do gráfico** só aparece com pelo menos 2 meses anteriores com gastos.

## Correções da 1.7.1

- **Extrato do Itaú**: os valores da segunda página voltaram (o PDF usa letras diferentes em cada página). O extrato de conta não é mais confundido com fatura do cartão, então salário e Pix recebidos entram como entrada.
- **Nomes mais claros na importação**: "Pix para Leandro", "Pix de …", "Fatura do cartão", "Salário", "Compra no débito"; a data grudada no nome ("Kaiky N06/11") sai. Contas como Copel, Claro e condomínio já vêm em Contas; Uber em Transporte; mercado em Alimentação.
- **Pix entre contas suas** (com o seu nome no extrato) chegam desmarcados, com o aviso de que não são renda nem gasto.
- **Voz**: "né" separa as tarefas ("dobrar as roupas, né, arrumar o quarto"); "aqui" e "ali" saem do título; "fazer comida" fica "Fazer comida".
- **Primeira abertura**: saíram duas frases desnecessárias.

## Novidades da 1.7.0

- **Primeira abertura nova**, em 4 passos curtos: nome, como o microfone funciona (com exemplos de cada área), a escolha entre **Simples** e **Avançado** com miniaturas e "para quem é cada um", e os avisos com um exemplo de como chegam.
- **Cores fixas por área**: Tarefas em azul, Finanças em verde, Estudos em roxo. Em Ajustes → Cores você escolhe a intensidade (Viva, Escura ou Suave).
- **Microfone com ondas de áudio** que seguem o volume da sua voz e mostram o texto enquanto você fala. Na confirmação, a frase aparece em "Você disse" e cada item vem com uma etiqueta colorida da área.
- **Tarefas em Hoje e Semana** (e "Mais para frente" e "Sem data"). Arraste para a direita para concluir e para a esquerda para excluir, com Desfazer.
- **Estudos com contagem regressiva**: cada prova vira um cartão com os dias que faltam e uma barra que enche conforme a data chega.
- **Agenda com filtros** no topo: Tudo, Tarefas, Finanças, Estudos.
- **Finanças em painel**: saldo em destaque, barra do limite do mês (com a marca de onde o gasto deveria estar hoje), gráfico dos últimos 6 meses com a média e o "Para onde vai".
- **Importar extrato**: escolha um PDF ou CSV do banco, a fatura do cartão ou o holerite. O app lê no próprio celular, sem internet, e abre uma **lista de revisão**: marque, desmarque, corrija ou tire da lista antes de salvar. O que parece repetido (mesmo dia e valor) já vem desmarcado. PDF escaneado (foto) não tem texto e o app avisa.
- **Interpretador**: "quando eu chegar em casa hoje lá pelas 10 eu tenho que dobrar as roupas e arrumar o quarto" vira duas tarefas, as duas hoje às 22:00. "Às 10" dito depois das 10h da manhã vira 22h; "lá para umas", "por volta das" e "pelas" contam como horário; "quando eu chegar…" sai do título; "…o quarto, e paguei luz 180" separa direito.

## Novidades da 1.6.0

- **Orçamento em Finanças**: defina o salário base e quanto quer guardar por mês (botão "Definir" no cartão Orçamento).
  - Cada gasto é **necessário** (aluguel, contas, mercado, saúde, estudos, transporte) ou **não necessário** (cartão, lazer, compras, restaurante). O app sugere pela categoria e você troca ao editar.
  - O cartão mostra necessários, não necessários, a renda, a meta, **quanto ainda pode gastar** e a **projeção** do fim do mês. Fatura do cartão, parcelas e contas fixas entram uma vez; compras e lazer seguem o ritmo do mês.
  - Se o salário do mês ainda não foi lançado, o salário base entra no "Previsto no fim do mês".
- **Avisos de gasto** ao lançar pelo microfone. A importância de Finanças define quando: alta a partir de 70% do limite, média a partir de 90%, baixa só quando passar. O aviso também aparece nas mensagens de entrada.
- **Som e vibração**: o botão de teste saiu. Ao escolher "Som e vibração" ou "Só vibração", o app mostra na hora um aviso de amostra.

## Novidades da 1.5.0

- **Mensagens de entrada**: ao abrir o app (ou voltar depois de 10 minutos fora), um cartão no topo diz "Bom dia", "Boa tarde" ou "Boa noite" com o seu nome. Em seguida mostra quantas tarefas estão pendentes e qual área tem menos coisas concluídas ("Kaikyn, você precisa concluir seus lembretes de Estudos"). Some sozinho em alguns segundos, ou com um toque.
  - Tarefas pendentes: tarefas não concluídas e horários de rotinas de hoje que já passaram sem "Feito".
  - Área com menos resoluções: a de menor proporção de concluídos entre Tarefas, Estudos e Finanças (contas do mês que já venceram).

## Novidades da 1.4.0

- **Lembretes que se repetem** (Tarefas e Estudos): "tomar remédio da diabetes todo dia às 8h e às 20h", "remédio de 8 em 8 horas", "academia segunda, quarta e sexta às 7h", "inglês de segunda a sexta às 19h", "trocar o filtro todo dia 10". Usam o aviso repetido do próprio Android, que continua tocando mesmo sem abrir o app. Na lista aparecem com ↻, o que já foi feito hoje (✓ 08:00) e a próxima vez.
- **Botões no aviso**: "Feito" e "Adiar 10 min" (tarefas e estudos), "Paguei"/"Recebi" e "Lembrar amanhã" (contas). Funcionam com o app fechado. Tocar no aviso abre a área certa.
- **Primeira abertura** para quem instala do zero: nome, visual (simples ou avançado) e permissão de avisos.
- **Interpretador**: "de manhã" (08:00), "à tarde" (14:00), "à noite" (20:00), "cedo" (07:00); "estudar 2 horas" é duração, não horário; "de 2 em 2 horas" não vira mais gasto; "comprei um tênis de 300 no cartão Nubank" vira "Tênis".
- **Limpar concluídas** em Tarefas e Estudos (com Desfazer).
- Na Agenda, os pontos marcam só eventos únicos (provas, contas, tarefas com data); as rotinas aparecem na lista do dia.

## Novidades da 1.3.0

- **Títulos curtos**: "tomar remédio da diabetes em 4 horas" vira "Remédio diabetes". A frase completa aparece em "Você disse" ao editar. Dá para desligar em Ajustes → Voz.
- **Visual simples ou avançado** (Ajustes → Visual). O simples é preto e branco, sem Agenda e sem gráfico de categorias, e troca a foto do topo pela aba "Ajustes" na barra de baixo.
- **Exemplos só no começo**: as dicas de cada área somem depois que você usa a área, e os exemplos do microfone somem depois de 3 usos.
- **Avisos com som e vibração** ou **só vibração** (Ajustes → Avisos). O botão "Som no Android" abre os ajustes de notificação do aparelho.

## O que tem

- **Tarefas**: coisas de casa e do dia a dia, com data e horário opcionais.
- **Finanças**: entradas e saídas do mês, contas **a pagar / a receber**, contas fixas que se **repetem todo mês**, saldo atual e saldo previsto no fim do mês.
- **Estudos**: provas e entregas com contagem regressiva e avisos automáticos.
- **Agenda**: calendário do mês com um ponto colorido por área em cada dia. Toque num dia para ver o que tem nele.
- **Aba lateral** (toque na sua foto, no canto de cima; no Simples, botão Menu): nome, idade, foto, visual (Simples/Avançado, claro/escuro), importância das áreas, teste de aviso e frases não entendidas.
- **Editar e desfazer**: toque num item para editar. Ao excluir, aparece "Desfazer" por 5 segundos.

## O botão de microfone

Fica no centro da barra de baixo. Você fala, o app separa cada coisa, mostra um resumo e você confere antes de salvar. Exemplos:

| Você diz | O app cria |
|---|---|
| "Conta de luz 180, água 95 e aluguel 1800 todo dia 5" | 3 lançamentos; o aluguel vira conta fixa mensal, a pagar |
| "Paguei luz 180 e água 95 ontem" | 2 saídas pagas, com a data de ontem |
| "Salário 4500 e bônus 1200" | 2 entradas |
| "Tenho que pagar a fatura do Nubank dia 15, 900 reais" | Conta a pagar "Cartão Nubank", vence dia 15 |
| "Uber 25" | Saída de R$ 25,00 em Transporte |
| "Prova de circuitos dia 27, me lembrar 4 dias antes" | Estudo dia 27 com aviso 4 dias antes |
| "Me lembra de ligar pra minha mãe às 19h" | Tarefa com aviso às 19h |

Se o app entender errado, toque em **"Não entendeu direito?"** na confirmação. A frase fica guardada na aba lateral, de onde você pode enviá-la para correção.

## Cores e visual

Cada área tem uma cor fixa, para o olho achar tudo rápido: **Tarefas azul** (#2457E6), **Finanças verde** (#0B7A52), **Estudos roxo** (#6B3FD4); no escuro, versões mais claras (#6C93FF, #3DD39A, #A98BFF). Dinheiro não depende de cor: "+" entrada, "−" saída, "⇄" transferência.

Dois visuais, cada um claro ou escuro: **Avançado** (cartões coloridos, cantos bem redondos, Space Grotesk nos números) e **Simples** (calmo, cantos de 4 px, só Inter). O visual é aplicado antes das telas carregarem (src/Root.js), por isso trocar reinicia o app. Textos com contraste de pelo menos 4,5:1 e áreas de toque de 44 px.

## Importância

Na aba lateral, cada área recebe importância alta, média ou baixa. Isso muda:

- a ordem das abas (a mais importante abre primeiro);
- a ordem dos itens na Agenda;
- quantos avisos cada área recebe:

| Área | Alta | Média | Baixa |
|---|---|---|---|
| Estudos | 14, 7, 3 e 1 dia antes, e no dia | 7, 3 e 1 dia antes, e no dia | 1 dia antes e no dia |
| Finanças (a pagar) | 3 e 1 dia antes, e no dia | 1 dia antes e no dia | no dia |
| Tarefas | 1 dia antes e no dia | no dia | no dia |

Os avisos tocam às 8h, ou no horário do item. Se você pedir "me lembrar 4 dias antes", vale o que você pediu.

## Instalar

Baixe o APK no celular, toque nele e permita instalar de "fontes desconhecidas". A versão nova instala por cima da anterior e os seus dados continuam lá.

Na primeira vez, permita microfone e notificações. Em Android 12 ou mais novo, abra a aba lateral e toque em **"Permitir horário exato"** para os avisos chegarem na hora certa.

## Para desenvolvedores

```
npm install
npm test          # testa o interpretador com frases reais
npx expo start    # roda no Expo Go (sem voz)
```

Para gerar o APK, use `eas build -p android --profile preview` ou um build local com `npx expo prebuild` e `./gradlew assembleRelease`.

### Antes de publicar na Play Store

- Gerar uma chave de assinatura própria (a atual é a chave de teste pública do Expo).
- Criar conta no Google Play Console (taxa única de US$ 25) e gerar o `.aab` com `eas build -p android --profile production`.
- Publicar uma política de privacidade explicando o uso do microfone, das notificações e da foto.
- O app avisa com alarme exato (`SCHEDULE_EXACT_ALARM`). Na hora de publicar, revisar se a Play Store aceita esse uso para lembretes.

## Estrutura

```
index.js → src/Root.js         lê o visual salvo, aplica cores e fontes, depois carrega o App
App.js                         abas, microfone, aba lateral, avisos rápidos
src/parser.js                  entende as frases em português
src/store.js                   dados, contas fixas, desfazer, configurações
src/reminders.js               avisos (notificações locais)
src/theme.js                   cores do No Prumo (Avançado/Simples, claro/escuro)
src/AppText.js                 Text com a fonte certa (Space Grotesk / Inter) pelo peso e tamanho
src/insights.js                recebimentos, indicadores, previsão e ponte do saldo
src/components/Insights.js     tela de Indicadores
src/CaptureModal.js            voz e confirmação
src/EditSheet.js               edição de um item e revisão em lote do que foi importado
src/documentParser.js          lê PDF (texto) e CSV de extrato, fatura e holerite
src/importDocument.js          escolhe o arquivo no celular e chama o leitor
src/accounts.js                saldo por conta, transferências e pares entre extratos
modules/share-receiver/        módulo Android que recebe arquivos do menu Compartilhar
plugins/withShareTarget.js     coloca o app no menu Compartilhar (PDF e CSV)
src/components/Accounts.js     cartão "Dinheiro nas contas" e edição de conta
src/Drawer.js                  aba lateral (perfil e configurações)
src/screens/                   Tarefas, Finanças, Estudos, Agenda
scripts/test-parser.mjs        testes do interpretador e do leitor de extratos
scripts/fixtures/              arquivos de exemplo usados nos testes
```
