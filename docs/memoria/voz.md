# No Prumo: análise da captação de voz (09/11/2026)

> Este arquivo tem duas análises. A de 09/11 (seções 1 a 6) levou à 1.12.1. A de 10/11 (seções 7 a 12, no fim) é a da **fala natural**, 1.13.1 em teste: pesquisa de como os apps de voz funcionam, diagnóstico medido, o que mudou e o placar.

Feita sobre o código da 1.12, a partir de duas falhas vistas no celular do Kaiky em 09/11. Pedido dele: a transcrição é o carro-chefe do app, e não dá para sair criando regra manual cada vez que o celular ouve errado. O plano foi entregue na **1.12.1** no mesmo dia (seção 6). Como ficou o código: Memória do Projeto, seção "Voz (1.12.1)".

## 1. Como funcionava na 1.12

Microfone → `src/speech.js` → `src/parser.js` (regras) → confirmação em `src/CaptureModal.js`.

`speech.js` chamava o reconhecedor padrão do Android com o mínimo:
```js
Mod.start({ lang: 'pt-BR', interimResults: true, continuous: false, volumeChangeEventOptions: {...} })
```
- Pegava só a 1ª versão do que ouviu (`results[0]`); o Android pode devolver até 5.
- Não passava vocabulário do app ao reconhecedor.
- Não pedia pontuação: o texto chegava corrido, sem vírgula nem ponto.
- `continuous: false`: o Android encerrava na primeira pausa curta, e o app analisava na hora.
- Não escolhia o serviço de reconhecimento, então o áudio podia ir para o Google.

A biblioteca instalada (`expo-speech-recognition` 58.0.1) já tinha o que faltava: `addsPunctuation`, `contextualStrings`, `maxAlternatives`, `requiresOnDeviceRecognition`, `recordingOptions.persist`, `supportsOnDeviceRecognition()` e `androidTriggerOfflineModelDownload()`. Pontuação e vocabulário exigem Android 13 ou mais novo (o Galaxy S25 do Kaiky tem Android 16). No Android 13+, com o áudio guardado, a biblioteca usa sessão segmentada com 2 s de silêncio: a fala chega em pedaços, que precisam ser juntados.

## 2. O que o teste mostrou (rodando o interpretador da 1.12)

| Frase | Resultado |
|---|---|
| Frase do carro, como o celular ouviu ("pique", "isso dá") | 1 item: Finanças, R$ 60, título com a frase inteira |
| **Mesma frase com as palavras certas ("pix", "estudar"), sem pontuação** | **Continua 1 item só, errado** |
| Mesma frase com as palavras certas **e com pontuação** | **3 itens certos** |
| "comer salada 3 horas da tarde" | Sem horário, sem data, hora no título |
| "comer salada às 3 da tarde" | Horário 15:00 certo, mas sem data (deveria ser hoje) |

**Conclusão:** o maior problema não era a palavra mal ouvida, era o **texto sem pontuação**. O separador de itens só cortava em vírgula, ponto, "e", "depois" e "também". Corrigir "pique" → "Pix" com uma regra não teria resolvido a frase.

## 3. "Guardar para correção" não funcionava

Gravava a frase (Ajustes → Voz), mas o aviso era um Toast, e **o Toast fica atrás do Modal**; dava para gravar repetido; e não guardava o que a pessoa corrigiu nem as outras versões ouvidas.

## 4. Plano (sem regra manual por frase)

1. **Ouvir melhor:** pontuação, reconhecimento no aparelho quando houver (com volta automática ao modo anterior), vocabulário do app e da pessoa, 5 versões, silêncio maior.
2. **Entender fala corrida:** separar itens também em verbos de ação; tirar contexto do título; "N horas da tarde" é horário; só horário = hoje; horário já passado pergunta Hoje ou Amanhã.
3. **Corrigir fácil:** "Ouvi isso" editável, com as outras versões como opção.
4. **Aprender com as correções:** dicionário pessoal no celular; 1ª vez sugere, 2ª em diante troca sozinho.
5. **"Guardar para correção" de verdade:** aviso na tela, sem repetir, com versões ouvidas, o que foi salvo e o áudio (só no celular, autorizado pelo Kaiky).
6. **Medir:** banco de frases reais com placar no `npm test`; meta inicial de 90%.

## 5. Limite honesto

Regras têm teto. O salto seguinte é interpretar com IA: na nuvem, isso é a 2.0 pelas regras do projeto; no aparelho (Whisper ou modelo pequeno), ainda precisa ser avaliado em peso e velocidade. As frases e correções guardadas viram o material para essa avaliação.

## 6. O que a 1.12.1 entregou (09/11/2026)

- Todos os 6 passos do plano. Testes: 438/438; banco de frases: 8/8 (a frase do carro vira Lavar o carro hoje 22:00 · Pix do Bruno R$ 60 a pagar · Estudar para prova de química).
- Não testado fora do celular: pontuação, vocabulário, as 5 versões, o reconhecimento no aparelho e o áudio. Ajustes → Voz mostra o modo usado na última vez ("no celular, com pontuação", "pelo Google, com pontuação" ou "modo simples").
- **Próximo passo:** o Kaiky usa, guarda as frases que saírem erradas e manda pelo "Enviar para correção". Cada frase errada entra no banco do `npm test` (com nomes trocados) e é triada: palavra errada (reconhecimento: dicionário e vocabulário resolvem) × palavra certa e item errado (regra geral do interpretador).

---

# Segunda análise: fala natural (10/11/2026, 1.13.1 em teste)

Pedido do Kaiky: investir mais tempo na voz, o carro-chefe, **sem regra manual**: pesquisar como os apps de voz funcionam e trazer isso para o código. Base: a 1.13.0 (APK de teste de 10/11).

## 7. O que a pesquisa mostrou (como os apps de voz funcionam)

Todos seguem a mesma linha de montagem, em quatro etapas. O Prumo tinha a 1ª e um pedaço da 3ª.

| Etapa | O que os apps fazem | Como estava no Prumo |
|---|---|---|
| 1. Ouvir | O reconhecedor devolve várias versões, com confiança e o tempo de cada palavra | Pegava as 5 versões, mas jogava fora a confiança, o tempo das palavras e as pausas |
| 2. Arrumar a fala | Tiram hesitação e correção dita na hora, e escrevem números e horas como se escreve (a "normalização") | Só números por extenso. "Três e meia da tarde" virava gasto de R$ 3 |
| 3. Entender | Uma gramática de datas e horas separada (a do Duckling, usada por Wit.ai e Rasa, tem mais de 100 regras só para português) e a ideia de "espaços" a preencher: um item tem um assunto, um dia, uma hora, um valor | Expressões soltas; qualquer número que sobrava virava dinheiro |
| 4. Escolher a versão | Misturam as versões palavra por palavra (o "voto" entre hipóteses) e dão peso ao vocabulário da pessoa | Escolhia a frase inteira, e premiava quem rendia mais itens |

Fontes:
- Gramática de datas e horas: [Duckling (Meta), regras de português](https://github.com/facebook/duckling/tree/main/Duckling/Time/PT). A lista de exemplos dele serviu de roteiro para o que faltava ("quinze para as oito", "meio-dia e meia", "quarta da semana que vem", "em dois meses", "fim de semana", Natal).
- Linha de montagem no aparelho, com regras primeiro e estatística depois: [Snips NLU](https://medium.com/snips-ai/an-introduction-to-snips-nlu-the-open-source-library-behind-snips-embedded-voice-platform-b12b1a60a41a).
- Usar várias versões em vez de só a primeira: [ASR N-best fusion nets (Alexa, ICASSP 2021)](https://aminer.org/pub/60eac32e91e0118b4946fae6/asr-n-best-fusion-nets) (21% menos erro de classificação) e [redes de confusão](https://arxiv.org/html/2401.02921v1).
- Hesitação e correção dita na hora: modelo de Shriberg (o que foi dito errado, o marcador "quer dizer", o conserto); a Amazon relata que a autocorreção responde por boa parte dos erros de entender datas e nomes ([artigo](https://cdn.amazon.science/11/9c/1377940f42a58324c408b1017a2f/improved-robustness-to-disfluencies-in-rnn-transducer-based-speech-recognition.pdf)).
- Vocabulário da pessoa pesando na escolha: [Google, correção por exemplos (Interspeech 2022)](https://www.isca-archive.org/interspeech_2022/pundak22_interspeech.pdf) e [Apple, nomes de contatos](https://www.arxiv.org/pdf/2409.15353).
- Datas no Todoist: [ajuda oficial](https://todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV).
- O que a nossa biblioteca entrega: lido direto no código da `expo-speech-recognition` 58.0.1 instalada (`confidence` por versão; `segments` com o instante de cada palavra no Android 14+ com o serviço `com.google.android.as`; a fala chega em pedaços com 2 s de silêncio).

## 8. Diagnóstico medido (antes de mexer)

Foi montado um banco de 188 frases de fala natural, inventadas, em 7 grupos. A 1.13.0 acertava **78 (41%)**:

| Grupo | Acertos da 1.13.0 | Exemplo de erro |
|---|---|---|
| Horas faladas | 8 de 32 | "reunião às três e meia da tarde" → Finanças, R$ 3 |
| Datas | 14 de 36 | "dentista mês que vem", "dia primeiro", "fim do mês", "daqui a um mês" → sem data |
| Dinheiro | 17 de 34 | "recebi 2 mil" → R$ 1.000; "remédio 3 vezes ao dia" → gasto de R$ 3; "gastei 30 no almoço 15 no uber" → 1 item |
| Rotina | 9 de 14 | "segunda quarta e sexta" (sem vírgula) → só segunda |
| Vários pedidos | 16 de 32 | "amanhã tem reunião às 9 dentista às 14 e academia às 18" → 1 gasto de R$ 14 |
| Vícios de fala | 9 de 30 | "é então eu preciso tipo lavar o carro né" → "Tipo lavar o carro né"; "anota pra mim dentista" → "Mim dentista" |
| Contexto | 5 de 10 | "depois da aula ir na biblioteca" → Estudos, "Aula ir na biblioteca" |

Causa de fundo: não era falta de regra para frase; faltavam **etapas inteiras** (a 2 e metade da 3).

## 9. O que a 1.13.1 faz (tudo no celular, sem internet)

1. **Arrumar a fala** (`src/normalize.js`, novo), antes de interpretar:
   - tira palavras de apoio ("é", "ó", "então", "tipo", "deixa eu ver", "né", "tá") e palavra repetida;
   - tira o pedido ao app ("anota aí", "cria um lembrete pra", "eu queria que você me lembrasse de", "não posso esquecer de");
   - entende a correção dita na hora, quando os dois lados são do mesmo tipo: "amanhã não, sexta", "às 3, quer dizer, às 4", "50, ou melhor, 60";
   - escreve as horas faladas: "três e meia", "seis e quarenta e cinco", "quinze para as oito", "meio-dia e meia", "à uma da tarde", "amanhã 8 horas", "15 horas". Duração continua duração ("estudar 2 horas", "viagem de 15 horas").
2. **Datas e horas** (`parser.js`): "mês que vem", "dia 5 do mês que vem", "fim/começo do mês", "fim de semana", "quarta da semana que vem", "terça agora", "nessa quinta", "daqui a um mês", "em dois meses", "dia primeiro", "1º de dezembro", "de 20 a 27 de dezembro", Natal e Ano Novo, "daqui a pouco/mais tarde/agora" (hoje), "depois do almoço", "antes das 5", "das 7 às 19", "de madrugada". "Cedo" só é 07:00 junto de um dia que vem ("amanhã cedo"; "dormir cedo" fica no título). Hora de 1 a 6 sem "da manhã/tarde" em outro dia é à tarde ("reunião quinta às 3" = 15:00), menos quando a frase fala de acordar, viagem, plantão ou treino.
3. **Rotina:** dias sem vírgula ("segunda quarta e sexta"), "3 vezes ao dia" (de 8 em 8 horas), "de hora em hora", "uma vez por mês".
4. **Número não é dinheiro sem pista:** número com unidade ou seguido de plural é quantidade ("3 vezes", "2 litros", "30 páginas"), assim como "lista 3" e "sala 204". "2 mil" = 2.000. "240 por 4" = 240. "Boleto da faculdade 890 vence dia 10" é Finanças. "O Pedro me pagou/me deve 50" é entrada; "devo 80" é a pagar.
5. **Vários pedidos numa fala** (`breakOnActions`, refeito): um item tem um assunto, um dia, uma hora e um valor. Item novo começa com verbo de ação (reconhecido pela forma da palavra, -ar/-er/-ir, e não mais por lista fechada), com assunto novo depois do dia/hora do anterior ("reunião às 9 dentista às 14"), com um segundo dia ("segunda tenho médico terça tenho prova") ou com um segundo valor ("30 no almoço 15 no uber"). Verbo de movimento não corta ("ir ao mercado comprar pão"). O dia dito antes continua valendo quando só a hora muda. Gasto dito em sequência herda o verbo do primeiro.
6. **Versões ouvidas** (`voice.js`): mistura palavra por palavra (`mixAlts`): "pix" de uma versão e "estudar" de outra ficam na mesma frase. A 1ª versão do Android só perde com prova concreta (valor, dia ou hora com número, palavra do vocabulário da pessoa); ter mais itens não conta mais. A confiança do Android entra na conta.
7. **Pausas** (`speech.js`): a pausa entre os pedaços que o Android entrega vira vírgula, e a pausa longa entre duas palavras também (Android 14+, no aparelho). Vírgula é separador "suave": só separa quando os dois lados fazem sentido sozinhos. "Amanhã, lavar o carro" não perde mais o dia.
8. **Modo de teste:** "Mandar as frases" passa a levar a confiança e o tempo de cada palavra, para afinar as pausas com dado real do S25.

## 10. Placar

| | 1.13.0 | 1.13.1 |
|---|---|---|
| Banco de 188 frases (usado no ajuste) | 78 (41%) | 188 (100%) |
| 90 frases novas, escritas depois do ajuste, **na 1ª tentativa** | 51 (57%) | 76 (84%) |
| As mesmas 90, depois de corrigir as regras gerais que elas mostraram | 51 (57%) | 87 (97%) |
| Banco inteiro, 278 frases | 129 (46%) | 275 (99%) |
| `npm test` | 536/536 | 856/856 |

O número honesto para frase nunca vista é o **84%**. As 3 que continuam erradas estão marcadas como abertas no banco (`scripts/fixtures/banco-voz.mjs`): "bom então fica assim reunião…" (sobra "fica assim" no título), "pagar o cartão dia 10 e a internet dia 15" (o 2º item perde o "pagar") e "entregar a declaração do imposto de renda" (cai em Estudos por causa de "entregar").

Conferido também no navegador, digitando na tela de captura: "é então amanhã tem reunião às três e meia da tarde dentista às 5 e gastei 30 no almoço 15 no uber" vira 4 itens certos.

## 11. O que NÃO foi testado (só o celular mostra)

- Pausas: se o S25 manda mesmo o tempo de cada palavra e se 0,7 s é o corte certo. Se o Android não mandar nada, fica como antes (nenhum risco).
- Confiança: se o Android informa um número útil ou sempre zero.
- A mistura de versões com as versões reais do S25.
- Tudo o que depende do ouvido continua valendo da 1.12.1: palavra mal ouvida é com o dicionário pessoal.

## 12. Limite honesto e próximos passos

- Regras continuam tendo teto, mas agora ele é medido: o banco cresce com as frases do modo de teste, e toda frase nova entra como teste.
- Próximo passo de regra, se as frases do celular pedirem: perguntar "3 da manhã ou 3 da tarde?" na confirmação (como já pergunta Hoje/Amanhã), e completar o verbo do 2º item ("…e a internet dia 15").
- Interpretar com IA no aparelho: o Android tem o Gemini Nano (ML Kit, "Prompt API"), sem internet, mas a lista de aparelhos aceitos muda e **não ficou confirmado se o S25 está nela**; precisa de um teste no celular antes de qualquer decisão. Whisper e sherpa-onnx rodam no aparelho, mas pedem um arquivo de modelo de 75 MB ou mais dentro do APK; só valem se o reconhecimento do Google se mostrar o gargalo, e hoje o gargalo era entender, não ouvir.
