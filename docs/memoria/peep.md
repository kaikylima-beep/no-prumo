# Peep: versão alternativa de teste (10/11/2026)

Pedido do Kaiky em 10/11: uma versão nova, feita com liberdade total, sem os remendos acumulados no Prumo. Fica na pasta `peep/` do mesmo repositório e instala **ao lado** do Prumo (pacote `com.peep.app`, nome "Peep"). O Prumo não foi alterado.

## O que é
Mesma proposta (falar e o app organiza), para o mesmo público (estudante que faz muita coisa ao mesmo tempo), com outras escolhas:

- **Hoje** é a primeira tela: aulas, horários fixos, tarefas, provas e contas na ordem do dia, com "Agora / A seguir", os 7 próximos dias e horários livres.
- **Um visual só**; claro/escuro segue o celular e troca na hora (sem Simples/Avançado, sem reiniciar).
- **Falar ou escrever na mesma tela**: o app mostra o que entendeu enquanto a pessoa fala ou digita; toca no cartão para ajustar; "Guardar" salva.
- **Interpretador novo** (`peep/src/core/nlu.js`), em 4 passos: palavras → marcações (data, hora, valor, repetição, lembrete) → pedaços → itens. As 4 frases do campo Testes passam.
- **Já vem**: notas e faltas por matéria, horários fixos (aula, estágio), perguntas ("o que eu tenho amanhã?", "quanto gastei com ifood este mês?", "quando é a prova de cálculo?").
- **Dinheiro simples**: o que saiu, o que entrou, o que vai vencer, limite do mês e quanto dá por dia. **Sem** contas de banco, saldo, extrato (PDF/CSV) e previsões.
- **Avisos refeitos a partir dos dados** a cada mudança (nenhum item guarda id de aviso). Padrões: tarefa na hora; prova/entrega 7, 3 e 1 dia antes; conta na véspera e no dia; resumo da manhã; aviso antes da aula.
- **Dicionário pessoal** igual em ideia ao do Prumo: 1ª correção vira sugestão, 2ª troca sozinha.
- **Traz os dados do Prumo**: Ajustes → Abrir backup aceita o `.json` do Prumo (tarefas, estudos, matérias, lançamentos, contas fixas, nome, limite, dicionário). Contas de banco e transferências ficam de fora.

## Como gerar o APK
Workflow `Peep APK` (`.github/workflows/peep-apk.yml`): roda a cada push em `peep/` nos ramos de trabalho. Usa a mesma chave de teste do Prumo. `cd peep && npm test` roda os testes (111 em 10/11).

## Estado
- 0.1.0: conferido no navegador (claro e escuro) e por teste automático. **Nada foi testado no celular ainda**: voz, avisos, teclado e botão voltar precisam do teste do Kaiky.
- Decisão pendente do Kaiky: seguir com o Peep, trazer partes dele para o Prumo, ou descartar.
