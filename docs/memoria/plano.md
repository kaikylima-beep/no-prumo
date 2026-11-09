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
- **Notas e faltas entram no plano** (09/11, antes "seguradas"). Nota: cada professor calcula de um jeito, então o aluno **anota cada nota que tirou** (P1, trabalho, lista…) e, se quiser, a fórmula do professor; o app não impõe uma fórmula. Serve também porque o professor demora a lançar no sistema. Faltas: por matéria, com aviso perto do limite.
- **Responder perguntas pela voz** (ideia aprovada, 09/11): "o que eu tenho amanhã?", "quanto gastei com iFood este mês?", "quando é a prova de cálculo?". Tudo no celular.
- **Chave de assinatura própria antes de divulgar.** Trocar enquanto só o Kaiky usa (backup → instalar → restaurar).
- Divulgação só na recepção de calouros da UTFPR (fev/2027).

## Feito (resumo)
1.1 primeiro APK · 1.2 listas e agenda · 1.3 Simples/Avançado · 1.4 repetições e botões no aviso · 1.5 saudação · 1.6 orçamento · 1.7 painéis e importar extrato · 1.8 contas e transferências · 1.9 Finanças separadas e visual No Prumo · 1.10 de onde vem o dinheiro · 1.11 backup · 1.12 matérias · 1.12.1 voz que entende · 1.12.2 ajustes mais limpos · **1.12.3** avisos depois do backup, valores escondidos nos avisos, saudação certa, frases do campo Testes.
Detalhe de cada uma: `README.md`.

## Fila (na ordem)
1. **1.12.3** · em teste no celular.
2. **1.13 · Meus horários fixos:** aulas, estágio e compromissos numa grade semanal; "estágio de segunda a sexta das 13 às 18" pela voz; "aula de cálculo segunda e quarta 10h" cria a matéria; exceções (feriado, sem aula, semana de provas, reposição); feriado municipal à mão.
3. **Notas e faltas** · posição a decidir (sugestão: logo depois da 1.13, porque a falta usa a grade de aulas).
4. **1.14 · Seu dia:** tela Hoje abre o app no lugar da Agenda; linha do tempo do dia; horários livres; Simples "Agora / Depois / Ainda hoje"; resumo de manhã e aviso antes da aula (opcionais).
5. **1.15 · Revisões automáticas:** cada prova gera 2–3 sessões, só nos horários livres.
6. **1.16 · Backup na nuvem:** salva sozinho numa pasta do Drive, guarda 7 cópias, avisa se falhar.
7. **Antes de divulgar:** "Experimente falar" em Finanças e Estudos; teste com 2 colegas sem explicar; transição suave entre abas; chave própria; passo a passo para instalar o APK; nome e marca (INPI); voz "no celular" nos aparelhos dos colegas; avisos em Xiaomi e Samsung; 3 dias rodando bem.

## Depois (sem data)
- Estudos: cadastrar várias matérias falando em sequência; feriados municipais automáticos; conferir a tabela de feriados todo ano.
- Finanças (depois do piloto): OFX (Nubank, Inter, Itaú, Caixa); PDF-foto; PDF da Caixa; lembrete de mandar extrato; selo "bate com o banco"; saldo previsto dia a dia; maiores gastos e assinaturas; limite por categoria; desfazer uma importação inteira.
- Voz: responder perguntas (ver Decisões).
- Mais para frente → 2.0: iPhone; IA no celular para entender frases; IA lê calendário e ementa; compartilhar do WhatsApp; bot no WhatsApp (2.0).

## Achados da análise de 09/11 (para não perder)
- 26 dos testes só procuram texto no código (não testam o comportamento). Trocar aos poucos por testes de verdade.
- Os dados ficam em listas inteiras regravadas a cada mudança; para anos de extrato importado, pensar em banco de dados no celular (expo-sqlite). Não é urgente.
- Finanças no Avançado mostra muitos números parecidos na primeira tela (Sobra, Previsto, Ainda pode gastar). Simplificar sem tirar função.
