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

## Testar no celular · 1.13.1 (voz: fala natural)
Instale por cima da 1.13.0 (os dados continuam). Deixe o **modo de teste ligado**. Fale do seu jeito, sem caprichar.

- [ ] Ajustes, no fim: aparece "No Prumo 1.13.1".
- [ ] Hora falada: "reunião às três e meia da tarde" e "ligar pra mãe quinze para as oito da noite".
- [ ] Data: "dentista mês que vem", "entregar o relatório no fim do mês", "faxina no fim de semana".
- [ ] Outro dia sem dizer manhã ou tarde: "reunião quinta às 3" tem que dar 15:00.
- [ ] Vícios de fala: "é então eu preciso tipo lavar o carro amanhã né" → "Lavar o carro", amanhã.
- [ ] Correção na hora: "lavar o carro amanhã não sexta" → sexta.
- [ ] Vários de uma vez, **sem pausa**: "amanhã tem reunião às 9 dentista às 14 e academia às 18" → 3 itens amanhã.
- [ ] Vários de uma vez, **com pausa** entre eles: "lavar o carro (pausa) comprar pão amanhã" → 2 itens. Olhe se aparece vírgula no "Ouvi isso".
- [ ] Gastos em sequência: "gastei 30 no almoço 15 no uber e 8 no café" → 3 gastos.
- [ ] "remédio 3 vezes ao dia" → lembrete que repete, não gasto.
- [ ] "o [nome] me deve 50 reais" → entrada, a receber.
- [ ] **Extrato:** importar o extrato novo do Itaú por cima do que já está no app. As compras que já estavam aparecem como "Já está no app" (algumas com "o banco mostra a mesma compra com outra data") e não entram de novo. Deixar "Usar o saldo do extrato" marcado: o saldo de hoje fica igual ao do banco. Se o banco não fechar, a revisão avisa a diferença.
- [ ] Depois de 3 dias: Ajustes → Modo de teste → "Mandar as frases" (agora vai junto a confiança e o tempo das palavras; é isso que mostra se as pausas funcionam no S25).

## Testar no celular · 1.13.0
Antes de instalar: Ajustes → Backup → Salvar. Instale por cima (os dados continuam).

**Faculdade e faltas**
- [ ] Ajustes → Ajustar perfil → Faculdade: conferir média 6, nota 10, aula de 50 min, faltas 25%.
- [ ] Estudos → Matérias: cada matéria mostra "Faltas X de Y · …". Sem semestre, informe o semestre.
- [ ] Tocar numa matéria com aula de 100 min: "Faltei hoje (2 aulas)" conta 2; Desfazer na faixa de baixo.
- [ ] Falar "faltei na aula de [matéria]" e "faltei hoje".
- [ ] Ajustes → Avisos → "Perguntar depois da aula se você foi": depois da próxima aula chega "Foi na aula?". Tocar em Faltei com o app fechado e conferir a falta na matéria.

**Notas**
- [ ] Na matéria, "+ Avaliação": P1 (peso 40), P2 (peso 40, sem nota), Trabalho (peso 20). Conferir a média e "Precisa de X nas próximas".
- [ ] Falar "tirei 8 na P2 de [matéria]": a P2 cadastrada recebe a nota.
- [ ] Copiar a fórmula do professor em "Como o professor calcula".
- [ ] Uma prova de uma matéria que já passou aparece em Itens como "Já saiu a nota?".

**Finanças**
- [ ] Abrir Finanças: o Pix devolvido (e o Pix que voltou) aparece como "Devolvido" e não entra em Saiu.
- [ ] Juros e IOF em "Tarifas e juros"; rendimento em Investimentos; nomes sem "RSCSS" e sem data grudada.
- [ ] No Avançado: não tem mais "Mudança no saldo"; a fatura aparece à parte no orçamento.
- [ ] Importar um extrato novo: compras de lojas que você já classificou chegam com a categoria certa.

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

## Regras para a correção

- Nenhuma correção mira uma frase só. Cada regra nova é testada também em frases parecidas que já passavam, e as anteriores continuam passando (474 na 1.12.3; 856 na 1.13.1).
- **Banco de fala natural (1.13.1):** `scripts/fixtures/banco-voz.mjs`, 278 frases inventadas. Toda frase do tipo Regra que chegar do celular entra lá (com nomes trocados). Frase que ainda sai errada entra marcada `'aberta'`: conta no placar e não reprova o teste. O `npm test` exige placar de 95% ou mais.
- Nomes de pessoas são trocados antes de entrar no `npm test` e neste arquivo.
- Se uma frase depende de a palavra vir certa e ela vem errada (tipo Ouvido), o caminho é o dicionário pessoal ou a tela de correção, não o interpretador.
