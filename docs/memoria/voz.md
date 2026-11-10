# No Prumo: análise da captação de voz (09/11/2026)

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
