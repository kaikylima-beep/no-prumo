# Peep

Versão alternativa e de teste do No Prumo, refeita do zero (novembro de 2026). Mesma proposta: **você fala, o app organiza**. Instala ao lado do Prumo (pacote `com.peep.app`), sem mexer nos dados dele.

## O que muda em relação ao Prumo

| No Prumo | No Peep |
|---|---|
| Três áreas separadas e uma Agenda | **Hoje**: aulas, compromissos, tarefas, provas e contas numa tela só, na ordem do dia |
| Simples × Avançado, claro × escuro (4 visuais, reinicia para trocar) | Um visual só; claro/escuro acompanha o celular e troca na hora |
| Interpretador com regras empilhadas a cada frase errada | Interpretador em 4 passos (palavras → marcações → pedaços → itens), com 111 testes |
| Confirmação em tela cheia | Você vê o que o app entendeu enquanto fala ou digita; toca para ajustar |
| Finanças com contas de banco, extrato, saldo, previsões | **Dinheiro**: o que saiu, o que entrou, o que vai vencer e um limite do mês |
| Notas, faltas e horários fixos planejados (1.13 e 1.14) | Já vêm: matérias com notas, faltas e horários; rotina fixa (estágio, academia) |
| Perguntas pela voz planejadas | Já vem: "o que eu tenho amanhã?", "quanto gastei com ifood este mês?" |
| Cada item guarda os ids dos seus avisos | Os avisos são refeitos inteiros a partir dos dados (não tem como ficar aviso órfão) |
| Importar PDF/CSV do banco | Não tem (de propósito, nesta versão de teste) |

Dá para trazer os dados do Prumo: Ajustes → Abrir backup (aceita o `.json` do Prumo).

## Pastas

- `src/core/`: as regras, sem tela (`nlu.js` interpretador, `model.js` itens/dia/mês/notas, `plan.js` avisos, `answers.js` perguntas, `learn.js` dicionário pessoal, `migrate.js` backup).
- `src/`: telas e peças (`App.js`, `Capture.js`, `ItemSheet.js`, `BlockSheet.js`, `Settings.js`, `screens/`).
- `scripts/test.mjs`: `npm test`.

## Comandos

```
cd peep
npm ci
npm test
```

APK: workflow `Peep APK` (`.github/workflows/peep-apk.yml`), roda a cada push que mexe em `peep/`.
