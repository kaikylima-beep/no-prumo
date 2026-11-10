# Plano do No Prumo

Atualizado em 09/11/2026 (versão 1.12.3). Fonte inicial: Mapa do No Prumo + conversa de 09/11 no Claude Code.
Faltam os docs do Projeto do claude.ai (memória completa e plano antigo): quando chegarem, completar aqui.

## Regras de versão
- Correção = x.y.**Z** (só conserta). Versão nova = x.**Y** (um tema). **2.0** = quebra "tudo no celular e sem internet" (ex.: bot no WhatsApp).
- Um tema por versão. A próxima só começa quando a anterior passou no celular do Kaiky.
- Uma versão só fecha quando: testes passam; 3 dias de uso no celular; toda reclamação foi consertada ou virou cartão; README atualizado.
- Ritmo: mais ou menos uma versão por semana; correções .1/.2 quando precisar.

## Decisões em vigor
- **Finanças:** nada de função nova grande até o piloto. **Pode** (decisão de 09/11): tirar informação redundante, tirar o que não faz sentido para a realidade de todo mundo, corrigir erros de lógica e acrescentar algo com propósito claro. **Não pode:** tirar função pronta sem motivo. Finanças importa para o aluno que trabalha (CLT/estágio), paga contas e mora sozinho ou divide.
- **Notas e faltas viram a 1.13** (09/11, antes "seguradas"; os horários fixos passam para a 1.14). Nota: cada professor calcula de um jeito, então o aluno **anota cada nota que tirou** (P1, trabalho, lista…) e, se quiser, a fórmula do professor; o app não impõe uma fórmula. Serve também porque o professor demora a lançar no sistema. Faltas: por matéria, com aviso perto do limite.
- **Responder perguntas pela voz** (ideia aprovada, 09/11): "o que eu tenho amanhã?", "quanto gastei com iFood este mês?", "quando é a prova de cálculo?". Tudo no celular.
- **Chave de assinatura própria antes de divulgar.** Trocar enquanto só o Kaiky usa (backup → instalar → restaurar).
- Divulgação só na recepção de calouros da UTFPR (fev/2027).

## Feito (resumo)
1.1 primeiro APK · 1.2 listas e agenda · 1.3 Simples/Avançado · 1.4 repetições e botões no aviso · 1.5 saudação · 1.6 orçamento · 1.7 painéis e importar extrato · 1.8 contas e transferências · 1.9 Finanças separadas e visual No Prumo · 1.10 de onde vem o dinheiro · 1.11 backup · 1.12 matérias · 1.12.1 voz que entende · 1.12.2 ajustes mais limpos · **1.12.3** avisos depois do backup, valores escondidos nos avisos, saudação certa, frases do campo Testes.
Detalhe de cada uma: `README.md`.

## Programação (datas de referência)
Ritmo: uma versão por semana, com 3 dias de uso no celular antes da próxima. As datas andam se o teste achar problema: corrigir vem antes de começar a próxima.

| Semana | Versão | Tema |
|---|---|---|
| 09/11 – 15/11 | **1.12.3** | Correções + campo Testes · na `main` (Release v1.12.3) |
| 10/11 – 22/11 | **1.13.0** | Notas e faltas + Finanças mais limpo (a 1.12.4 entrou junto) · **em teste no celular** |
| 10/11 – 22/11 | **1.13.1** | Voz: fala natural (pedido do Kaiky em 10/11: reforçar o carro-chefe) · no ramo `claude/voice-recognition-analysis-pzquu2`, **APK de teste; vai para a `main` só com o sim do Kaiky** |
| 23/11 – 29/11 | **1.14** | Meus horários fixos (+ troca da chave de assinatura) |
| 30/11 – 13/12 | **1.15** | Seu dia (tela Hoje) · 2 semanas, é a maior |
| 14/12 – 20/12 | **1.16** | Revisões automáticas |
| 21/12 – 03/01 | — | Pausa de fim de ano (só correções, se precisar) |
| 04/01 – 10/01 | **1.17** | Backup na nuvem |
| 11/01 – 31/01 | **Antes de divulgar** | Teste com colegas, Xiaomi/Samsung, passo a passo do APK, 3 dias rodando bem |
| fev/2027 | **Divulgação** | Recepção de calouros da UTFPR |

## Próximas entregas: escopo fechado em 10/11

### 1.12.4 · Finanças mais limpo → entrou na 1.13.0 (10/11, para ganhar tempo). Todos os itens aprovados e feitos.
Erros claros (entram):
1. Devolução de Pix ("DEV PIX") anula o Pix que voltou: não infla "Entrou" nem "Saiu".
2. Títulos da importação: tirar data grudada ("…0711"), códigos do banco ("RSCSS", "PAY") e número solto ("Pix enviado 5725…").
3. Primeira tela de Finanças no Avançado com menos números repetidos (hoje: Sobra, Previsto e Ainda pode gastar quase iguais). Nenhuma função sai; o que sai do topo continua em "Seu mês" e em "Tudo do mês".
4. Campo Testes: frases que o Kaiky mandar até lá.
Mudam regra (só com o "sim" do Kaiky):
5. Rendimento da aplicação vira Investimentos (não é extra).
6. Compras no débito ganham categoria pelo nome da loja (mercado, farmácia, transporte…).
7. Juros do limite e IOF viram "Tarifas e juros", não necessários.
8. Fatura do cartão sem marca de necessário/não necessário.

### 1.13.0 · Notas e faltas: feita em 10/11 (em teste). Decisões do Kaiky: média para passar configurável (cada faculdade); duração da aula no perfil (UTFPR 50 min); aula de 100 min = 2 faltas.
Notas:
- Em cada matéria, a lista de avaliações: nome (P1, P2, trabalho, lista…), data, nota tirada e nota máxima (padrão 10).
- Campo livre "Como o professor calcula", para copiar a fórmula do caderno. O app não impõe fórmula.
- Peso por avaliação, opcional. Com os pesos, o app mostra a média e quanto falta para passar (média para passar editável).
- Depois da data de uma prova já cadastrada, o app pergunta "Já saiu a nota?" (opcional).
- Voz: "tirei 7,5 na P1 de cálculo", "tirei 8 no trabalho de física".
Faltas:
- Em cada matéria: faltas, total de aulas do semestre (pelos horários da matéria, do início ao fim do semestre, sem feriados) e o limite (25% das aulas, editável).
- Marcar falta com um toque na matéria, com Desfazer.
- Voz: "faltei na aula de física", "faltei hoje" (todas as aulas do dia).
- Aviso opcional depois de cada aula: "Foi na aula de Cálculo 2?" com Fui / Faltei, direto no aviso.
- Avisos: perto do limite ("pode faltar mais 2") e passou do limite.
Nos dois visuais: Simples com lista calma ("Faltas 3 de 16 · Média 7,2"); Avançado no cartão da matéria, com a cor dela.
Também: backup leva notas e faltas; campo Testes; testes automáticos de média, limite e voz.

## Fila (detalhe de cada versão)
1. **1.13.0** · em teste no celular.
2. **1.13 · Notas e faltas** (decidido em 09/11):
   - **Notas:** por matéria, o aluno anota cada avaliação (P1, trabalho, lista…) com a nota que tirou e, se quiser, o peso ou a fórmula do professor (cada professor calcula de um jeito; o app não impõe). Mostra a média só quando a pessoa deu os pesos. Pela voz: "tirei 7,5 na P1 de cálculo".
   - **Faltas:** por matéria, usando os horários que a matéria já tem (1.12). Depois da aula, aviso opcional "Foi na aula de Cálculo 2?" com Fui / Faltei. Limite de faltas (padrão 25% das aulas, editável) e aviso perto do limite. Pela voz: "faltei na aula de física".
   - Simples: lista calma por matéria. Avançado: no cartão da matéria.
3. **1.14 · Meus horários fixos:** aulas, estágio e compromissos numa grade semanal; "estágio de segunda a sexta das 13 às 18" pela voz; "aula de cálculo segunda e quarta 10h" cria a matéria; exceções (feriado, sem aula, semana de provas, reposição); feriado municipal à mão. Junto: **trocar a chave de assinatura** (backup → instalar → restaurar).
4. **1.15 · Seu dia:** tela Hoje abre o app no lugar da Agenda; linha do tempo do dia; horários livres; Simples "Agora / Depois / Ainda hoje"; resumo de manhã e aviso antes da aula (opcionais).
5. **1.16 · Revisões automáticas:** cada prova gera 2–3 sessões, só nos horários livres.
6. **1.17 · Backup na nuvem:** salva sozinho numa pasta do Drive, guarda 7 cópias, avisa se falhar.
7. **Antes de divulgar:** "Experimente falar" em Finanças e Estudos; teste com 2 colegas sem explicar; transição suave entre abas; passo a passo para instalar o APK; nome e marca (INPI); voz "no celular" nos aparelhos dos colegas; avisos em Xiaomi e Samsung; 3 dias rodando bem.

Sem data, quando couber entre versões (correção x.y.Z): simplificar a primeira tela de Finanças (menos números repetidos, sem tirar função).

**Depois da 1.17 (decidido pelo Kaiky em 10/11):** versão própria para o microfone responder perguntas, com 3 perguntas no começo: "o que eu tenho amanhã?", "quanto gastei com [loja] este mês?" e "quando é a prova de [matéria]?". Respostas só com os dados do celular, sem internet.

## Depois (sem data)
- Estudos: cadastrar várias matérias falando em sequência; feriados municipais automáticos; conferir a tabela de feriados todo ano.
- Finanças (depois do piloto): OFX (Nubank, Inter, Itaú, Caixa); PDF-foto; PDF da Caixa; lembrete de mandar extrato; selo "bate com o banco"; saldo previsto dia a dia; maiores gastos e assinaturas; limite por categoria; desfazer uma importação inteira.
- Voz: responder perguntas (ver Decisões).
- Mais para frente → 2.0: iPhone; IA no celular para entender frases; IA lê calendário e ementa; compartilhar do WhatsApp; bot no WhatsApp (2.0).

## Finanças: candidatos a correção (vistos no backup real de 08/11; sem valores nem nomes)
Entram como correção x.y.Z, sem tirar função. O Kaiky decide os que mudam regra.
1. **Devolução de Pix** ("DEV PIX") entra como saída e o Pix original como entrada: os dois inflam "Entrou" e "Saiu". O par deveria se anular (ou virar um só, marcado como devolvido).
2. **Rendimento da aplicação automática** ("REND PAGO APLIC AUT") entra como extra em "Outros"; deveria ser categoria Investimentos (e não contar como extra no limite).
3. **Títulos da importação:** data grudada sem barra fica no título ("…0610", "…0711"); prefixos do banco ("RSCSS", "PAY") ficam; nome do recebedor cortado pelo extrato ("… do Bra", "… La"). Limpar o que é regra geral (data grudada, prefixo do banco).
4. **Compras no débito** caem quase todas em "Outros"; dá para reaproveitar as categorias da voz (mercado, transporte, farmácia…) pelo nome do estabelecimento.
5. **Juros do limite e IOF** viram "Contas, necessário". Sugestão: categoria "Tarifas e juros", não necessária (é custo evitável e merece destaque).
6. **Fatura do cartão** vem "não necessária" por padrão, embora junte gastos necessários. Avaliar deixar sem marcação (fora do necessário × não necessário) quando as compras do cartão não estão no app.

## Achados da análise de 09/11 (para não perder)
- 26 dos testes só procuram texto no código (não testam o comportamento). Trocar aos poucos por testes de verdade.
- Os dados ficam em listas inteiras regravadas a cada mudança; para anos de extrato importado, pensar em banco de dados no celular (expo-sqlite). Não é urgente.
- Finanças no Avançado mostra muitos números parecidos na primeira tela (Sobra, Previsto, Ainda pode gastar). Simplificar sem tirar função.
