# No Prumo: campo Testes (frases para corrigir)

Criado em 09/11/2026, a pedido do Kaiky: enquanto o app está em fase de testes, toda versão nova tem, além do que já estava planejado, um **campo Testes**. Ele lista as frases que o app entendeu errado no celular e o que fazer com cada uma. Para quem vende o app, um título como "Chegando casa eu tenho" pesa muito, mesmo que a tarefa tenha sido salva.

## Como funciona

1. **No celular:** o modo de teste fica ligado (5 toques em "No Prumo 1.12.x", no fim dos Ajustes). Toda frase corrigida antes de salvar fica guardada sozinha. Print da tela Editar também serve.
2. **Enviar:** Ajustes → Modo de teste → "Mandar as frases", colando no chat. Pode ser junto com os prints.
3. **Triagem (Claude):** cada frase entra na tabela abaixo com um tipo:
   - **Ouvido:** o celular trocou a palavra ("pique" no lugar de "Pix"). Quem resolve é o dicionário pessoal e o vocabulário, nunca uma regra para aquela palavra.
   - **Regra:** a palavra veio certa e o app montou o item errado. Quem resolve é uma regra **geral** de português, testada em várias frases parecidas.
   - **Tela:** o app entendeu, mas mostrou de um jeito confuso.
4. **Na próxima versão:** cada frase do tipo Regra vira teste automático no `npm test` (com nomes trocados), e a regra geral é corrigida.
5. **Fechamento:** a frase sai da lista de abertas quando passa no celular.

## Testar no celular · 1.12.3
Instale por cima (os dados continuam). Marque o que funcionou; o que não funcionar, mande a frase ou o print.

**Avisos e backup**
- [ ] Ajustes → Backup → Salvar backup. Depois Restaurar esse mesmo arquivo. O app reinicia.
- [ ] Depois de restaurar: crie uma tarefa "lavar o carro daqui a 5 minutos" e veja se o aviso chega.
- [ ] Um lembrete que já existia antes (conta a pagar, prova, remédio) continua avisando no horário.

**Ocultar valores**
- [ ] Em Finanças, feche o olho. Fale "conta de luz 120 amanhã".
- [ ] Amanhã às 8h, com o celular bloqueado, o aviso deve dizer "Vence hoje: Conta de luz", **sem o valor**.
- [ ] Abra o olho de novo: os próximos avisos voltam a mostrar o valor.

**Saudação**
- [ ] Feche o app por mais de 10 minutos e abra. "Você tem N tarefas para hoje" = o número do cartão azul de Tarefas.
- [ ] Com uma prova só daqui a vários dias, o app **não** diz "você precisa concluir seus lembretes de Estudos".

**Voz sem Bixby**
- [ ] Tocar no microfone 3 vezes, em momentos diferentes: o Bixby **não** abre.
- [ ] Ajustes → Voz → "Última vez:" deve citar o Google.

**Voz (campo Testes)**
- [ ] "chegando em casa eu tenho que lavar o carro" → Tarefa "Lavar carro".
- [ ] "saindo do trabalho eu preciso passar no mercado" → Tarefa "Passar mercado".
- [ ] "fazer o pix do [nome] de 60 reais" → Finanças, **a pagar**.
- [ ] "fiz o pix do [nome] de 60 reais" → Finanças, **pago**.
- [ ] Se aparecer "pics": toque no texto ouvido e troque por "pix". Na 2ª vez o app troca sozinho.

**Uso normal**
- [ ] Usar 3 dias com o modo de teste ligado e mandar as frases guardadas.

## Frases abertas

| # | Data | O que o celular entregou | O que o app fez | Tipo | Correção geral planejada |
|---|---|---|---|---|---|
| — | — | Nenhuma. Mandar as frases do modo de teste depois de usar a 1.12.3. | | | |

## Frases resolvidas (nomes de pessoas trocados)

| # | Data | Frase | Problema | Resolvida em |
|---|---|---|---|---|
| 1 | 09/11 | "quando eu chegar em casa hoje eu preciso lavar o carro umas 10 horas da noite fazer o pique do Bruno de R$ 60 isso dá para prova de química" | Virou 1 item só. Texto sem pontuação (Regra) + "pique"/"isso dá" (Ouvido: Pix/estudar) | 1.12.1: separação por verbos e pontuação do reconhecedor. As palavras mal ouvidas ficam com o dicionário pessoal. |
| 2 | 09/11 | "comer salada 3 horas da tarde" | Sem horário, sem data, hora no título | 1.12.1: "N horas da tarde" é horário; só horário = hoje. |
| 3 | 09/11 | "fazer o pics do Rafa de R$ 60" | Finanças "Pics Rafa", R$ 60, **pago** (Ouvido + Regra) | 1.12.3 (teste no celular pendente): dinheiro com verbo no infinitivo no começo (fazer, mandar, enviar, transferir, depositar, pagar) é a pagar; "fiz/mandei/enviei" é pago. Ouvido: "pics" → "pix" pelo dicionário pessoal (corrigir 2 vezes). |
| 4 | 09/11 | "Chegando em casa eu tenho que lavar o carro lá para as 10 horas" | Tarefa "Chegando casa eu tenho" (Regra) | 1.12.3 (teste no celular pendente): contexto no gerúndio no começo sai do título e não decide a área; título curto começa no verbo de ação ("Lavar carro"). |

| 5 | 11/11 | "Aulas de circuitos análise de circuitos a as quintas-feiras das 21:20 até às 23 e sexta-feira das 18:20 até às 20:20 que isso te" | Virou 1 tarefa com a frase inteira (Regra) | 1.13 (teste no celular pendente): vários dias com horários diferentes viram vários horários da mesma matéria; plural do dia ("quintas-feiras"); nome recomeçado vale a versão completa; sobra depois do último horário é descartada. |
| 6 | 11/11 | "Eu tenho 10 minutos para lavar louça e depois disso eu tenho que arrumar o quarto em 30 minutos" | 1 tarefa, com hora errada (Regra) | 1.13 (teste no celular pendente): "tenho N minutos para" e "por N minutos" são duração; "depois disso" separa; depois de algo com duração, "em N minutos" também é duração. |

## Regras para a correção

- Nenhuma correção mira uma frase só. Cada regra nova é testada também em frases parecidas que já passavam, e as anteriores continuam passando (474 na 1.12.3).
- Nomes de pessoas são trocados antes de entrar no `npm test` e neste arquivo.
- Se uma frase depende de a palavra vir certa e ela vem errada (tipo Ouvido), o caminho é o dicionário pessoal ou a tela de correção, não o interpretador.
