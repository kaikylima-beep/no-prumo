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

## Testar no celular · 1.14.0 (Prumo novo)
Antes de instalar: Ajustes → Backup → Salvar (na 1.13.1). Instale por cima: os dados continuam. Deixe o **modo de teste ligado** (5 toques em "No Prumo 1.14.0", no fim dos Ajustes).

**Seus dados vieram?**
- [ ] Tarefas, provas e matérias estão lá. Cada matéria com as notas, as faltas e a fórmula.
- [ ] Dinheiro: o Saldo atual e o saldo de cada conta batem com o que a 1.13.1 mostrava.
- [ ] Ajustes → Faculdade: média, nota máxima, aula de 50 min e faltas 25% (ou o que você tinha mudado).

**Voz (a da 1.13.1, mais o que é novo)**
- [ ] Tocar no Blocão: o Bixby não abre; a fala aparece e "Entendi assim" mostra os cartões.
- [ ] "Aulas de análise de circuitos às quintas das 21:20 às 23 e sexta das 18:20 às 20:20" → matéria com os 2 horários.
- [ ] "Eu tenho 10 minutos para lavar louça e depois disso arrumar o quarto em 30 minutos" → 2 tarefas, 10 e 30 min.
- [ ] "tirei 8 na P2 de [matéria]" e "faltei hoje".
- [ ] Perguntas: "o que eu tenho amanhã?", "qual é o meu saldo?", "quanto gastei com ifood este mês?", "quantas faltas eu tenho em [matéria]?".
- [ ] Hora que já passou ("lavar o carro às 9") pergunta Hoje ou Amanhã no cartão.

**Telas**
- [ ] Hoje: o botão do calendário abre o mês com os feriados; tocar num dia mostra o dia.
- [ ] Estudos: "Já saiu a nota?" numa prova que já passou → Lançar nota.
- [ ] Matéria: "Faltei hoje (2 aulas)", "Marcar falta em outro dia", avaliação com peso sem nota.
- [ ] Ajustes → Faculdade → "Foi na aula?": depois da próxima aula chega o aviso; Faltei com o app fechado conta a falta.
- [ ] Dinheiro → Importar extrato (e pelo Compartilhar do app do banco): o que já estava aparece desmarcado.
- [ ] Tema escuro (Ajustes → Aparência → Escuro): tudo legível.

**Uso normal**
- [ ] 3 dias com o modo de teste ligado e mandar as frases guardadas.

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

| 5 | 11/11 | "Aulas de circuitos análise de circuitos a as quintas-feiras das 21:20 até às 23 e sexta-feira das 18:20 até às 20:20 que isso te" | Virou 1 tarefa com a frase inteira (Regra) | 1.14 (teste no celular pendente): vários dias com horários diferentes viram vários horários da mesma matéria; plural do dia ("quintas-feiras"); nome recomeçado vale a versão completa; sobra depois do último horário é descartada. |
| 6 | 11/11 | "Eu tenho 10 minutos para lavar louça e depois disso eu tenho que arrumar o quarto em 30 minutos" | 1 tarefa, com hora errada (Regra) | 1.14 (teste no celular pendente): "tenho N minutos para" e "por N minutos" são duração; "depois disso" separa; depois de algo com duração, "em N minutos" também é duração. |

## Regras para a correção

- Nenhuma correção mira uma frase só. Cada regra nova é testada também em frases parecidas que já passavam, e as anteriores continuam passando (474 na 1.12.3; 856 na 1.13.1; 152 + 868 na 1.14.0).
- **Banco de fala natural (1.13.1):** `scripts/fixtures/banco-voz.mjs`, 278 frases inventadas. Toda frase do tipo Regra que chegar do celular entra lá (com nomes trocados). Frase que ainda sai errada entra marcada `'aberta'`: conta no placar e não reprova o teste. O `npm test` exige placar de 95% ou mais, no motor da 1.13.1 e na camada nova da 1.14.
- Nomes de pessoas são trocados antes de entrar no `npm test` e neste arquivo.
- Se uma frase depende de a palavra vir certa e ela vem errada (tipo Ouvido), o caminho é o dicionário pessoal ou a tela de correção, não o interpretador.
