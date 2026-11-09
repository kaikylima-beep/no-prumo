# Campo Testes

Frases que o app entendeu errado no celular. Toda versão transforma as abertas em casos do `npm test` (com nomes trocados).
Regra: erro de ouvido = dicionário pessoal/vocabulário; erro de regra = regra geral de português, testada em várias frases.

## Testar no celular · 1.12.3
Instale por cima (os dados continuam). Marque o que funcionou; o que não funcionar, mande a frase ou o print.

**Avisos e backup**
- [ ] Ajustes → Backup → Salvar backup. Depois Restaurar esse mesmo arquivo. O app reinicia.
- [ ] Depois de restaurar: crie uma tarefa "lavar o carro daqui a 5 minutos" e veja se o aviso chega.
- [ ] Um lembrete que já existia antes (conta a pagar, prova, remédio) continua avisando no horário.

**Ocultar valores**
- [ ] Em Finanças, feche o olho. Fale "conta de luz 120 amanhã".
- [ ] Bloqueie o celular: o aviso de amanhã deve dizer "Vence amanhã: Conta de luz", **sem o valor**. (Para ver na hora, fale "conta de luz 120 hoje" antes das 8h, ou espere o aviso.)
- [ ] Abra o olho de novo: os próximos avisos voltam a mostrar o valor.

**Saudação**
- [ ] Feche o app por mais de 10 minutos e abra. "Você tem N tarefas para hoje" = o número do cartão azul de Tarefas.
- [ ] Com uma prova só daqui a vários dias, o app **não** diz "você precisa concluir seus lembretes de Estudos".

**Voz (campo Testes)**
- [ ] "chegando em casa eu tenho que lavar o carro" → Tarefa "Lavar carro".
- [ ] "saindo do trabalho eu preciso passar no mercado" → Tarefa "Passar mercado".
- [ ] "fazer o pix do [nome] de 60 reais" → Finanças, **a pagar**.
- [ ] "fiz o pix do [nome] de 60 reais" → Finanças, **pago**.
- [ ] Se aparecer "pics": toque no texto ouvido e troque por "pix". Na 2ª vez o app troca sozinho.

**Uso normal**
- [ ] Usar 3 dias com o modo de teste ligado e mandar as frases guardadas.

## Abertas
- (nenhuma: mandar as frases do modo de teste depois de usar a 1.12.3)

## Resolvidas
- **1.12.3** · "Chegando em casa eu tenho que lavar o carro" virava "Chegando casa eu tenho": contexto no gerúndio no começo (chegando, saindo, voltando, indo…) sai do título e não decide a área.
- **1.12.3** · Título curto começa no verbo de ação ("Lavar carro"), quando antes dele só há contexto.
- **1.12.3** · "Fazer o pics do [nome] de 60" saía pago: dinheiro com verbo no infinitivo no começo (fazer, mandar, enviar, transferir, depositar, pagar) é a pagar; "fiz", "mandei", "enviei" são passado (pago).
- **Ação do Kaiky (não é código)** · "Pics" no lugar de "Pix": corrigir 2 vezes na confirmação para o dicionário pessoal aprender.
