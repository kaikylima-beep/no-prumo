# No Prumo: Memória do Projeto (fonte da verdade)

Estado em 10/11/2026, versão **1.13.0** (versionName 1.13.0, versionCode 23), em teste no celular. A 1.12.3 está na `main` (Release v1.12.3). Vale o que está aqui. Para o que existe, a referência é o código no GitHub; para o que foi decidido, a decisão mais recente do projeto. **Frases que o app entendeu errado: `docs/memoria/testes.md` (campo Testes), ler antes de começar qualquer versão.** Calendário das versões: `docs/memoria/plano.md`.

> Trazida do Projeto do claude.ai para o repositório em 10/11/2026. Daqui em diante, a fonte é este arquivo.

## 1. Objetivo Principal do Projeto

**No Prumo** (nome no celular: **Prumo**; frase: "Fala. Tá no prumo.") é um app Android de organização pessoal por voz, em português. A pessoa fala do jeito que fala, o app separa cada coisa na área certa, mostra um resumo e só salva depois da confirmação.

- **Carro-chefe (Kaiky, 09/11/2026):** a transcrição e o entendimento da fala. Erros de reconhecimento não se resolvem com regra manual por frase: o app tem que ouvir melhor, deixar corrigir fácil e aprender com a pessoa. Para quem vende o app, um título mal montado pesa muito, mesmo que o item tenha sido salvo.
- **Áreas:** Tarefas (azul), Finanças (verde) e Estudos (roxo), mais uma Agenda no visual Avançado.
- **Para quem:** hoje, só o Kaiky (estudante de engenharia e estagiário, não programa; ele é o único testador; celular Samsung Galaxy S25, Android 16). O público pensado depois é o estudante multitarefa, inclusive quem tem TDAH.
- **Para onde vai:** o app deve "abrir o seu dia", juntando aulas, estágio ou trabalho, provas, entregas, tarefas e contas numa tela só, com revisões nos horários livres.
- **Como é feito:** todo o código é escrito pelo Claude, no repositório GitHub `no-prumo`. O APK sai pelo GitHub Actions (Release `v<versão>` quando a versão chega na `main`; APK de teste pelo "Run workflow" num ramo).
- **Meta de lançamento (decidida em 09/11/2026):** apresentar o app na **recepção de calouros de fevereiro de 2027** (público: calouros da UTFPR) e lançá-lo **pago** na Play Store. Detalhes na seção 3, "Lançamento e preço".

## 2. Stack Tecnológica Atual

| Camada | Escolha |
|---|---|
| Base | Expo SDK 58 (58.0.23), React Native 0.88.1, React 19.3, Hermes |
| Linguagem | JavaScript puro |
| Navegação | Abas próprias em `App.js` (Expo Router não é usado) |
| Armazenamento | AsyncStorage, só no celular, com chaves `@org2/*` |
| Voz | `expo-speech-recognition` 58.0.1 (pt-BR); desde a 1.12.1 com pontuação, vocabulário, 5 versões, reconhecimento no aparelho quando houver e áudio guardado. O interpretador de frases é por regras, sem IA, mais o dicionário pessoal aprendido com as correções |
| Avisos | `expo-notifications` e `expo-task-manager` (botões dos avisos com o app fechado) |
| Arquivos | `expo-file-system` (API `File`), `expo-document-picker`, `expo-image-picker` (foto de perfil) |
| Leitura de PDF | Parser próprio com `pako` |
| Fontes | `expo-font` com Inter e Space Grotesk |
| Nativo próprio | Módulo Kotlin `modules/share-receiver` e plugin `plugins/withShareTarget.js` (menu Compartilhar para PDF e CSV) |
| Testes | `scripts/test-parser.mjs` (`npm test`), 536 casos (1.13.0), com placar do banco de frases reais |

**Android:** pacote `com.meuorganizador.app` (não muda, para instalar por cima sem perder dados), minSdk 24, targetSdk 36.

**Assinatura:** chave de teste pública do Expo (`keystore/debug.keystore`), SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Tem que ser sempre a mesma até a troca por chave própria.

**Build do APK (desde 09/11/2026):** GitHub Actions (`.github/workflows/build-apk.yml`): `expo prebuild`, a chave de sempre (`keystore/debug.keystore`), `assembleRelease` e conferência com `scripts/check-apk.sh` (pacote, versão, nome e assinatura). Leva de 15 a 25 minutos. Push na `main` com versão nova no `app.json` cria a Release com o APK; "Run workflow" num ramo gera um APK de teste sem Release. O build local antigo (Gradle na sessão, `mavenproxy.py`) ficou só como histórico em `docs/antigo/`.

**Para mudar a versão:** `app.json` (`version` e `android.versionCode`), `APP_VERSION` em `src/Drawer.js` e "Novidades" no README.

## 3. Regras de Negócio e Decisões Definitivas

### Princípios do produto
- **Offline primeiro.** Os dados ficam no celular e as frases são interpretadas sem internet.
- **Nada é salvo sem confirmação.** Voz e importação sempre passam por revisão.
- **Desfazer em toda ação destrutiva.**
- **Linguagem simples, em português,** sem jargão.
- **Sem tour com "ok".** Ensinar com dicas no uso e, mais tarde, com uma frase real.
- **Voz sem remendo por frase (09/11/2026):** melhorias de voz vêm de configurar melhor o reconhecedor, de regras gerais de português, da correção fácil na tela e do dicionário pessoal. Nada de regra para uma palavra mal ouvida específica. Análise em `docs/memoria/voz.md`.
- **Ferramentas do desenvolvedor não aparecem para o usuário (Kaiky, 09/11/2026):** o que só serve ao teste (mandar frases para o Claude) fica no modo de teste, escondido.

### Regras de versão e entrega
- **Correção (x.y.Z):** só conserta. **Versão nova (x.Y):** um tema novo; instala por cima e os dados continuam. **2.0:** quebra a promessa "tudo fica no celular e funciona sem internet", muda dados sem volta ou exige desinstalar.
- **Um tema e uma função nova por versão.** A próxima só começa depois que a anterior passar no celular.
- **Campo Testes (decidido em 09/11/2026, "imprescindível" para o Kaiky):** enquanto o app estiver em fase de testes, **toda versão nova leva, além do que estava planejado, as frases abertas do campo Testes** (`docs/memoria/testes.md`). Cada frase é triada (Ouvido, Regra ou Tela), vira teste automático com nomes trocados e é resolvida por regra geral. O campo também aparece como coluna "Testes" no quadro do Mapa.
- **Uma versão fecha quando:** os testes passam, o Kaiky usou 3 dias no celular, toda reclamação foi resolvida ou virou cartão no quadro (ou linha no campo Testes), e o README foi atualizado.
- **Antes de cada entrega:** `npm test`, conferência no navegador com capturas, versionCode e assinatura do APK, textos novos dentro do bundle.
- **Depois de cada versão:** atualizar o [Mapa do No Prumo](https://claude.ai/artifact/UXteo4z4qTuoRn9njRBaz1), esta Memória, `plano.md` e o campo Testes (`docs/memoria/`). O código fica no GitHub; não há mais zip.
- **Se o Kaiky disser "ainda não precisa fazer a versão":** só analisar.
- **Dados pessoais reais** (extratos, holerites, planilha, backup) nunca entram no repositório, em fixtures, artefatos ou docs. No banco de frases do `npm test`, os nomes de pessoas são trocados.

### Lançamento e preço (decidido em 09/11/2026)
- **Modelo:** o app será lançado **pago** na Play Store. A cobrança **mensal** só começa depois das versões com IA e WhatsApp (2.0), porque só aí existe custo recorrente (servidor e uso de IA). Valor do pagamento inicial: **ainda não definido**.
- **Data-alvo:** recepção de calouros em **fevereiro de 2027** (dia exato ainda não informado). Ideia do Kaiky: panfletos com QR code para baixar o app.
- **Recomendação do Claude (ainda não decidida):** o QR deve levar à página da Play Store, não a um APK solto (APK exige liberar "apps desconhecidos" e dispara avisos do Android). O panfleto deve vender uma situação concreta, por exemplo "Fale 'prova de Cálculo sexta às 8h' e o app agenda e avisa", e não depender do nome. Usar um QR por canal para medir o que funciona. Contato com o centro acadêmico e com veteranos pesa mais que o panfleto.
- **Prazo:** com "rodando bem" reduzido para 3 dias (ver abaixo), o conflito com fevereiro deixa de existir. Falta decidir **quais versões são obrigatórias antes da recepção**. O mínimo natural é a 1.15, "Seu dia", porque a promessa para calouros (aulas, provas e contas numa tela só) só existe a partir dela. Calendário de referência (10/11): `docs/memoria/plano.md`, com "Antes de divulgar" de 11/01 a 31/01.
- **Lista da loja, a confirmar nas regras atuais do Google:** conta de desenvolvedor (taxa única, cerca de US$ 25), política de privacidade, formulário de dados da loja, possível período de teste fechado com testadores para contas pessoais novas, pagamento dentro do app pelo sistema do Google (com taxa) e parte fiscal (MEI ou CNPJ) para receber.
- **Pontos levantados pelo conselho de 09/11 (não decididos):** reembolso logo após a compra na Play Store (erro no primeiro uso vira reembolso; pensar em teste grátis); avisar quando a voz cair para o Google e declarar isso na política de privacidade e no formulário de dados da loja; conferir já se a conta nova precisa de teste fechado.
- **PWA (site instalável):** descartado por ora. Só reconsiderar como teste rápido para quem tem iPhone, sem prometer avisos com botões nem importação de extrato.

### Escopo e divulgação
- **Divulgação:** nada é divulgado (nem APK, nem Play Store) antes da recepção de calouros de fevereiro de 2027, e só se o que for obrigatório até lá estiver pronto (ver "Lançamento e preço").
- **Finanças congelado** para funções novas grandes até depois do piloto. Exceção decidida em 09/11/2026: o ocultar valores (privacidade), entregue na 1.12.1. **Liberado em 09/11 (Kaiky):** tirar informação redundante, tirar o que não faz sentido para a realidade de todo mundo, corrigir erros de lógica e acrescentar algo com propósito claro. **Não pode:** tirar função pronta sem motivo. Finanças importa para o aluno que trabalha (CLT/estágio), paga contas e mora sozinho ou divide.
- **Apresentação (19 slides, feita na 1.11):** https://claude.ai/artifact/9WohRNATUngZDKzF1pU5fd. Uso controlado. As telas são ilustrações com dados inventados, nunca dados reais. Não dizer que a voz funciona sem internet: a promessa é "dados só no celular" e "interpretador por regras, sem IA" (com a 1.12.1, a voz pode ficar no celular quando o aparelho deixa; confirmar em Ajustes → Voz antes de afirmar). Quando a 1.12 fechar, atualizar os slides 1, 16, 17 e 18 e o rodapé "versão 1.11". Conferir as frases dos slides 6 e 8 no celular antes de apresentar.
- **Marketing:** parado até poder divulgar. Primeiro público: calouros da UTFPR na recepção de fevereiro de 2027. O Kaiky guarda o plano completo fora do projeto.
- **Notas e faltas viram a 1.13 (decidido em 09/11/2026).** Cada professor calcula a nota de um jeito: o aluno anota cada nota que tirou (P1, trabalho, lista…) e, se quiser, o peso ou a fórmula que anotou no caderno; o app não impõe fórmula (serve também porque o professor demora a lançar no sistema). Faltas por matéria, com limite. Detalhe em `plano.md`.
- **Microfone que responde perguntas (aprovado como ideia em 09/11/2026):** "o que eu tenho amanhã?", "quanto gastei com iFood este mês?", "quando é a prova de cálculo?". Decidido em 10/11: versão própria **depois da 1.17**, com 3 perguntas (agenda de amanhã, gasto por loja no mês, data de prova). Ver `plano.md`.
- **"Rodando bem" (mudou em 09/11/2026):** **3 dias seguidos**, contados depois da última versão que entrar antes da divulgação (antes eram 3 semanas depois da 1.16). Critérios mantidos: nenhum aviso perdido, nenhum dado perdido, frases de teste passando, uso diário sem contornar bug e backup restaurado com sucesso (repetir se a última versão mexer em dados). Ajuste pequeno só zera o relógio se mexer em avisos ou dados.

### Ordem do que falta (atualizada em 09/11/2026; datas em `plano.md`)

1. **Agora: testar a 1.13.0 no celular** (lista em `testes.md`). A 1.12.4 (Finanças mais limpo) entrou junto na 1.13, a pedido do Kaiky (10/11), para ganhar tempo., com o modo de teste ligado, mandando as frases que saírem erradas para o campo Testes. Continua valendo o que ficou da 1.12/1.12.2 (matérias, ocupação, feriados, dicionário pessoal).
   - **Medição da voz (proposta do conselho de 09/11, não decidida pelo Kaiky):** 30 frases reais, sem ensaiar, anotando o modo em Ajustes → Voz. Com 75% ou mais certas sem editar, parar de mexer na voz e seguir para o lançamento; abaixo disso, teste de um dia com Whisper no aparelho. Depois, 5 a 10 colegas com celulares diferentes, 10 frases cada.
2. **1.13.0, Notas e faltas + Finanças mais limpo:** feita em 10/11, em teste. Detalhes nas seções Estudos e Finanças.
3. **1.14, Meus horários fixos** (+ campo Testes): cadastro único de aulas, trabalho/estágio e outros, por voz ou à mão, com grade semanal e exceções (feriado, sem aula, semana de provas, reposição, feriado municipal à mão). Bloco: `{ tipo: aula | trabalho | outro, título, matéria?, dias, início, fim, local, de, até, cor }`. Uma frase por matéria ("aula de cálculo segunda e quarta 10h") já cria a matéria, se ela não existir. Telas a desenhar: grade semanal, formulário do bloco e marcar exceção num dia. Junto: **trocar a chave de assinatura** (backup → instalar → restaurar). Gerar a chave própria de modo que ela possa virar a chave de assinatura da Play Store depois (Play App Signing aceita importar a chave existente), para não exigir reinstalação de novo.
4. **1.15, Seu dia (tela Hoje)** (+ campo Testes): primeira tela ao abrir, no lugar da Agenda na barra; linha do tempo com fixos, tarefas com hora, provas, entregas, contas e horários livres. Simples: "Agora / Depois / Ainda hoje". Avançado: linha do tempo colorida. Calendário do mês e feriados ficam dentro dela, nos dois visuais. Resumo de manhã e aviso antes da aula são opcionais. Telas a desenhar: Hoje no Simples e no Avançado (claro e escuro), dia sem nada, dia cheio e "agora" no meio de uma aula.
5. **1.16, Revisões automáticas** (+ campo Testes): cada prova gera 2 ou 3 sessões, só em horário livre, nunca em hora de aula ou estágio, com Feito e Adiar. Exemplo: prova no dia 20 vira revisões segunda, quarta e na véspera, 40 min cada.
6. **1.17, Backup automático na nuvem** (+ campo Testes): a pessoa escolhe uma vez uma pasta (por exemplo, do Drive), sem servidor nosso; salva ao abrir o app se o último tiver mais de 1 dia, mantém as 7 cópias mais recentes e avisa se falhar. Continua 1.x. A tela deixa claro que os dados saem do celular. O backup automático do Android já está ligado (`allowBackup`): guarda até 25 MB numa pasta privada do Drive, sem login no app, mas só restaura ao reinstalar e não deixa escolher quando.
7. **Antes de divulgar (depois da 1.15):** cartão "Experimente falar" em Finanças e Estudos, com frase real que abre a confirmação; teste com dois colegas no celular do Kaiky, sem explicar nada; transição suave entre abas; passo a passo de instalar o APK (some se o app for pela Play Store); teste do nome e checagem no INPI; confirmar a privacidade da voz em outros celulares (avisar quando cair para o Google; pacote de português offline); ensinar que o botão de falar é o do centro (dica de primeira vez); testar avisos em Xiaomi e Samsung; 3 dias rodando bem; campo Testes sem frase aberta do tipo Regra; itens da loja em "Lançamento e preço".
8. **Depois, sem data:** microfone que responde perguntas; primeira tela de Finanças com menos números repetidos (sem tirar função); cadastrar matérias em sequência, com um toque na confirmação para juntar ou separar; feriados municipais automáticos. Em Finanças, só depois do piloto: OFX, PDF-foto e print, PDF da Caixa, lembrete de extratos, selo "Bate com o banco", saldo previsto dia a dia, maiores gastos e assinaturas, limite por categoria, desfazer importação inteira.
9. **Mais para frente:** iPhone (depois do "rodando bem", com um iPhone para testar e a conta da Apple de US$ 99 por ano; precisa refazer avisos, com limite de 64 agendados, menu Compartilhar e seletor de pasta do backup); IA que lê calendário e ementa (opcional, ainda 1.x); avaliar IA no próprio celular para entender as frases (Whisper ou modelo pequeno), usando as frases e correções guardadas; compartilhar do WhatsApp para o app; **2.0:** bot de WhatsApp com caixa de entrada, que passa a ser cobrado por mensalidade. O plano técnico de IA e WhatsApp (custos e LGPD incluídos) está num Claude Doc do Kaiky.

**Descartados por ora (09/11/2026):** o logo Blocão que desce e assenta ao abrir (só enfeite); a mudança de microfone e "Salvo" mais visíveis (só se o Kaiky achar o app duro no uso); o CSV com coluna Tipo, porque os meses antigos da planilha são só histórico para ele. **Ignorado:** "Seu mês" mostrando "Começou o mês" antes do primeiro saldo conhecido e "Entrou" diferente do texto de baixo (pontual, por causa dos meses antigos da planilha; registro em `claude/prumo-pedido-planilha-csv.md`, no Projeto do claude.ai).

**Ainda sem decisão:** como fica a barra do Simples depois da 1.14 (hoje ela termina em Menu); se a permissão da pasta do Drive continua valendo com o app fechado (1.16); se o backup automático do Android traz os dados de volta; valor do pagamento inicial; quais versões são obrigatórias antes de fevereiro; se adota o plano de medição e as mudanças de custo zero do conselho de 09/11 (aviso "pode falar várias coisas, com uma pausa entre elas"; esconder "outras versões" e a troca automática do dicionário).

### Visual e marca
- **Referência completa:** `docs/memoria/marca.md` (nome e alternativas, SVG do Blocão, botão de falar, cores de cada modo em claro e escuro, tipografia, o que cada tela mostra, mapa dos canvas e histórico das decisões). Canvas da marca e das telas: https://claude.ai/artifact/RE1cjx7cy8KuiHW7T1dDUV · canvas do ícone: https://claude.ai/artifact/CohqSXTr5W5YiarNCc4eST. A menção a "Animação de entrada (1.12.2)" naquele doc está desatualizada: a animação foi descartada, e a 1.12.2 virou "Ajustes mais limpos".
- **Ícone Blocão:** prumo largo, com faixas azul, verde e roxa, fundo #12151C. Aparece no ícone do app e no botão de falar, não no cabeçalho das telas.
- **Avançado:** cartões coloridos, cantos bem arredondados, Space Grotesk em títulos e valores, Inter no texto, botão de falar de 68 px. Finanças com Resumo, Recebimentos e Indicadores. Barra termina em Agenda.
- **Simples:** um bloco de destaque por tela, listas com linhas finas, cantos de 4 px, só Inter, botão de 56 px. Finanças só com entradas e saídas (importar continua disponível), concluídas somem. Barra termina em Menu, sem Agenda.
- **Nos dois:** claro ou escuro, escolha na primeira abertura e troca em Ajustes → Visual (o app reinicia). Olho de ocultar valores no topo de Finanças (ícones `ic_eye`/`ic_eye_off` em `assets/ui`).
- **Ajustes (1.12.2):** no topo, foto, nome e idade; embaixo da idade, "Ajustar perfil" (com o resumo, por exemplo "Estágio · PR") abre ocupação e estado. Fechado por padrão. Depois: Visual, Importância, Avisos, Voz, Backup, modo de teste (só se ligado) e a versão.
- **Cores das áreas:** claro #2457E6, #0B7A52, #6B3FD4; escuro #6C93FF, #3DD39A, #A98BFF. Cada área tem uma cor só. Na barra, a ordem das áreas segue a importância escolhida.
- **Acessibilidade:** contraste mínimo 4,5:1, alvo de toque mínimo 44, dinheiro não depende de vermelho × verde ("+", "−", "⇄").

### Voz (1.12.1 e 1.12.2)
- **Reconhecimento (`src/speech.js`):** tenta, na ordem, (0) no próprio celular com pontuação, vocabulário e 5 versões; (1) serviço padrão com pontuação, vocabulário e 5 versões; (2) modo da 1.12 com 5 versões. Se um nível falhar logo no começo, sem ouvir nada, passa ao próximo sozinho; se faltar o modelo de português no aparelho, pede o download. O nível que funcionou fica valendo enquanto o app está aberto. **1.12.3 (Bixby):** no Samsung, o serviço padrão (inclusive o de `createOnDeviceSpeechRecognizer`) é o da Samsung e abria o Bixby. Agora `pickService` (`voice.js`) escolhe o Google pelo nome: `com.google.android.as` (só no aparelho) > `com.google.android.tts` > `com.google.android.googlequicksearchbox`; no nível "no celular" com Google vai `EXTRA_PREFER_OFFLINE`. Sem Google, fica o serviço do sistema. Os três pacotes estão em `androidSpeechServicePackages` (app.json), senão o app não os enxerga. Com o áudio guardado, o Android espera 2 s de silêncio e entrega a fala em pedaços; o app junta os pedaços e só interpreta quando a escuta termina. Chave em Ajustes → Voz: "Reconhecer a voz no próprio celular (quando der)"; o modo usado na última vez aparece ali. **No S25 do Kaiky (09/11): "no celular, com pontuação" funcionou.**
- **Vocabulário (`buildVocab`):** palavras do app (Pix, prova, estudar, boleto…), matérias ativas e apelidos, nomes das contas, trocas aprendidas e palavras que aparecem 2 vezes ou mais nos títulos da pessoa; até 100. No S25, "Pix" ainda saiu como "pics" (09/11): o vocabulário não garante a palavra; quem resolve é o dicionário pessoal.
- **Escolha da versão (`pickBest`):** cada versão ouvida passa pelo dicionário pessoal e pelo interpretador; ganha a que rende itens com dia, hora e valor, títulos curtos e palavras do vocabulário. A 1ª do Android só perde se outra for claramente melhor.
- **Dicionário pessoal (`settings.voice.learned`):** `{ 'pique': { to: 'pix', n } }`. Aprende com a correção do texto ouvido, com a escolha de outra versão, com sugestão aceita, com título corrigido antes de salvar e (1.12.2) com o nome corrigido na tela Editar de um item que veio da voz (que tem "Você disse"). Trechos de 1 a 3 palavras. Com n = 1 vira sugestão ("Trocar 'pique' por 'pix'"); com n ≥ 2 troca sozinho e avisa, com Desfazer (que esquece a troca). Palavra inteira, sem acento e sem diferença de maiúsculas. Até 300 trocas. "Esquecer" em Ajustes → Voz.
- **Fala corrida (`parser.js`, `breakOnActions`):** um verbo de ação começa item novo quando o pedaço anterior já tem a sua ação ou um valor e a palavra antes do verbo não o prende ("para", "de", "vou", "preciso", "não"…). Dia e hora ditos no meio valem só para o próprio item; ditos no começo da frase ("hoje às 22h lavar a louça arrumar o quarto") valem para os seguintes.
- **Horário:** "N horas da tarde/noite/manhã" é horário mesmo sem "às". Só horário, sem dia (tarefa ou estudo, sem repetição) = hoje. Se o horário de hoje já passou, a confirmação pergunta "Hoje" ou "Amanhã" (`askDay`); sem resposta, fica hoje.
- **Títulos:** sem a condição ("quando eu chegar em casa…", via `CONDITION_RE`) também em Finanças; "fazer o pix do João" vira "Pix do João", a pagar. **1.12.3:** contexto no gerúndio no começo ("chegando em casa", "saindo do trabalho", "indo pra aula", via `GERUND_CONDITION_RE`) sai do título e não decide a área, quando depois dele vem o pedido; o título curto (`abbreviate`) começa no verbo de ação quando antes dele só há contexto; dinheiro com verbo no infinitivo no começo (fazer, mandar, enviar, transferir, depositar, pagar; `INTENT_START`) é a pagar, e "fiz", "mandei", "enviei" são passado.
- **Confirmação:** "Ouvi isso" (ou "Você escreveu"); tocar no texto ouvido ou em "Corrigir" abre a correção → "Entender de novo"; embaixo do texto ouvido, a dica "Alguma palavra errada? Toque no texto para corrigir. O app aprende com você." (1.12.2); "Ou foi:" com até 2 outras versões; dicas "Tente assim" sempre visíveis; "Não entendi" na própria tela, sem Alert.
- **Modo de teste (1.12.2, `settings.testMode`):** liga e desliga com 5 toques seguidos em "No Prumo 1.12.2", no fim dos Ajustes; a versão passa a dizer "· modo de teste". Só no modo de teste: aparece a seção "Modo de teste" (frases guardadas, "Mandar as frases", "Limpar", "Sair do modo de teste") e o link "Não entendeu direito? Guardar esta frase" na confirmação; e toda captura em que a pessoa corrigiu algo (texto ouvido, outra versão, sugestão, área trocada, item removido ou título editado) é guardada sozinha ao salvar. Fora do modo de teste, nenhuma frase é guardada. "Mandar as frases" abre o compartilhar do Android com o texto (frase, o que o Android ouviu, outras versões, o que o app entendeu, o que foi salvo); o áudio fica no celular. "Limpar" apaga também os áudios. O que chega vai para o campo Testes.

### Estudos
- A matéria é achada por nome ou apelido completos, ignorando acento e aceitando "calc2", "cálculo dois" e "Cálculo II". Uma palavra só do nome vale se só uma matéria ativa a tiver e não vier número depois.
- Matéria citada manda o item para Estudos, menos compras ("comprar livro de calc 2") e finanças.
- Relatório, entrega, laboratório ou apresentação sem matéria perguntam "Faculdade ou [ocupação]?". Citar a ocupação manda para Tarefas; citar faculdade, prova ou aula deixa em Estudos; ocupação "Só estudo" não pergunta.
- "99" só é o app de corrida com contexto claro. "N e DD" e "N reais e DD" viram centavos, exceto em data, hora, unidade, outro número depois ou dois gastos com nome.
- Avisos automáticos, em dias antes, por importância da área (alta / média / baixa): Estudos 14-7-3-1-0 / 7-3-1-0 / 1-0; Finanças 3-1-0 / 1-0 / 0; Tarefas 1-0 / 0 / 0. "Me lembrar N dias antes" usa N e o próprio dia.
- **Notas e faltas (1.13, `src/academic.js`):** regras da faculdade em `settings.academic` (Ajustar perfil → Faculdade): `passGrade` (6), `maxGrade` (10), `classMinutes` (50, UTFPR), `absencePct` (25), `askAttendance` (aviso "Foi na aula?", desligado por padrão). Cada faculdade tem as suas: nada fixo no código.
  - **Faltas por aula:** horário de 100 min com aula de 50 = 2 aulas = 2 faltas (`lessonsInBlock`, arredonda). Total do semestre = aulas pelos horários da matéria, do início ao fim do semestre, sem feriados nacionais e estaduais (ponto facultativo conta como aula). Limite = piso de `absencePct` % do total. "Perto" quando o que falta cabe numa semana de aulas (mínimo 2). Sem semestre ou sem horário: só a contagem.
  - **Notas:** avaliação `{ name, score (null = ainda não saiu), max (null = maxGrade), weight }`; nota normalizada para a escala de `maxGrade`. Média e "quanto falta" **só com o peso de todas as avaliações** (o Kaiky: cada professor calcula de um jeito). Campo livre `formula` ("Como o professor calcula").
  - **Voz:** "tirei 7,5 na P1 de cálculo" (nota; preenche a avaliação de mesmo nome sem nota), "faltei na aula de física", "faltei hoje" (todas as aulas do dia), "faltei ontem…", "não fui na aula de…". Frases com "reais", "pix", "caixa" não viram nota. Essas frases saem antes do interpretador geral (`isAcademicStart` + `parseAcademic` na confirmação).
  - **"Foi na aula?":** avisos `DATE` para as próximas 2 semanas, 5 min depois do fim de cada aula, refeitos a cada abertura e a cada mudança (`src/attendance.js`, ids em `@org2/attendIds`). Categoria `aula` com Fui / Faltei; Faltei é tratado em `actions.js` com o app fechado e avisa se chegou perto do limite. `rescheduleAll` e o restaurar backup refazem esses avisos.
  - **"Já saiu a nota?":** prova/trabalho de uma matéria nos últimos 30 dias, sem nota ligada (`grade.studyId`) e sem `gradeAsked`, aparece na aba Itens.
- Arquivar matéria não apaga nada e tem Desfazer. Terminado o semestre com matérias ativas, o app avisa.
- Feriados: nacionais, Sexta-feira Santa, Carnaval e Corpus Christi (ponto facultativo) e os 27 estados, sem internet. O Paraná não tem feriado estadual (19/12 é só data comemorativa). A tabela é conferida todo ano; Santa Catarina tem projeto de novo feriado em 25/11 (PL 23/2026).

### Finanças
- **Três tipos:** entrada, saída e transferência. Transferência não é renda nem gasto.
- **Saldo de hoje** = `anchor.balance` + o que entrou e saiu depois do anchor; pendentes e lançamentos do mesmo extrato não contam. Em cartão, saldo negativo é fatura em aberto.
- **Conta sem saldo conhecido** (não cartão, sem `anchor`) fica fora de "Dinheiro nas contas", Previsto, projeção e ponte, e aparece com "Informar saldo".
- **Renda:** categorias Salário e Bônus. As outras entradas são extras e só entram no limite com `countExtras`.
- **Limite do mês** = renda considerada − meta de guardar. Sem salário lançado, usa o salário base. Sem nenhum dos dois, o limite não é calculado.
- **"% usado"** = gasto total ÷ limite, o mesmo número no cartão, na saudação e no aviso. Aviso de gasto em 70%, 90% ou 100% do limite (importância alta, média ou baixa).
- **"Ainda pode gastar"** nunca passa do dinheiro disponível: Previsto no fim do mês − fatura em aberto.
- **Projeção pelo ritmo de gastos** só a partir do dia 10.
- **Tipo de renda:** `fixed` (o salário mais novo importado vira o salário base) ou `variable` (o Previsto não soma salário que não caiu).
- **Dinheiro de outras contas suas:** entra no saldo, nunca é renda e nunca muda a Sobra. Só entra no limite por resposta do mês ou regra (`useOwn`: `ask`, `always`, `never`). Pergunta só com valor de pelo menos R$ 10, no Avançado. Passou do limite e o dinheiro está fora: o cartão diz quanto ele cobre.
- **Seu mês (Avançado):** começou + entrou + veio de outras contas − saiu = hoje nas contas. Embaixo, "Sobra do mês" (entradas − saídas) e "Mudança no saldo" (hoje − começo do mês).
- **Previsto no fim do mês:** dinheiro nas contas + a receber − a pagar + salário base ainda não lançado (só renda fixa).
- **Indicadores:** meses marcados "não conta" saem das médias; comparação com 3 meses anteriores até o mesmo dia; projeção de 3 meses pelo tipo de renda.
- **Agenda:** de Finanças mostra só o que vai cair.
- **Finanças mais limpo (1.13, `src/financeFixes.js`):** Pix devolvido ("DEV PIX") e o Pix de mesmo valor recebido até 5 dias antes viram categoria **Devolvido** (`refundPair` liga os dois) e saem de renda, gasto, recebimentos, indicadores e gráficos (`isRefund` em `budget.js`); o saldo continua contando. Rendimento ("REND PAGO APLIC AUT") = Investimentos, fora dos extras (`isExtraIncome`). Juros/IOF/tarifa = **Tarifas e juros**, não necessário. Transporte coletivo = Transporte. Loja já classificada pela pessoa passa a categoria para a importação (`learnedCategory`). Fatura paga aparece à parte no orçamento (`cardBill`; a conta do limite não mudou). Correção única dos dados importados com `settings.fin113`; pares de devolução conferidos a cada mudança.
- **Topo do Avançado (1.13):** saiu "Mudança no saldo" (= Hoje − Começou, já na ponte); "Previsto no fim do mês" some do destaque quando o "Ainda pode gastar" foi cortado pelo dinheiro (`bud.capped`); sem saldo de conta, o cartão de baixo vira "Entradas e saídas" sem repetir a sobra do destaque.
- **Ocultar valores (1.12.1):** olho no topo de Finanças (Simples e Avançado) liga `settings.hideBalance`, que fica lembrado. `showMoney()` (em `utils.js`) troca os valores por "R$ ••••" em Finanças, Indicadores, "Tudo do mês", contas, Agenda, textos do orçamento (saudação e aviso de gasto) e rótulos dos gráficos. Continuam visíveis, de propósito: confirmação por voz, edição, revisão de importação e pop-ups de renda. **Desde a 1.12.3, o texto dos avisos do celular também esconde o valor** ("Vence hoje: Conta de luz"), e ligar ou desligar refaz os avisos de Finanças.

### Importação (PDF e CSV, tudo no celular)
- O tipo do documento (extrato, fatura ou holerite) é detectado, assim como banco, conta e saldo.
- Viram transferência: Pix/TED com o nome do titular, "mesma titularidade", aplicação, resgate e pagamento na fatura. A revisão pergunta de qual conta vêm os Pix com o nome da pessoa e lembra.
- Cobranças do banco (juros, IOF, tarifa, encargos, multa, anuidade) sempre entram; linhas de resumo são puladas.
- Compras com data do próximo dia útil depois do último "SALDO DO DIA" voltam para o dia da compra, pagas.
- Holerite não cria conta e confirma o salário do mês: o depósito já no app passa a ser salário e o holerite não entra de novo.
- Salário igual (até R$ 1 ou 0,5%), no mesmo mês ou até 3 dias na virada, chega como repetido. Duplicados chegam desmarcados.
- Pares entre extratos (mesmo valor, sentido oposto, até 1 dia, ou 3 no cartão) viram uma transferência só.

### Regras técnicas que não podem ser quebradas
- Todo `Text` e `TextInput` vem de `src/AppText.js`; nunca importar de `react-native`.
- Cores fixas só em `src/theme.js`. Texto sobre a cor da área usa `colors.onAccent`.
- Usar `StyleSheet.absoluteFill`, nunca `absoluteFillObject` (o `npm test` reprova).
- `shouldPlaySound` fica sempre `true` no `setNotificationHandler`, porque esse campo também libera a vibração; o silêncio do "Só vibração" vem do canal.
- Não trocar os ids dos canais (`lembretes-som`, `lembretes-vibrar`), porque o Android perderia os ajustes feitos à mão.
- Todas as abas ficam montadas (`display: 'none'`) e recebem `active`. Um `Modal` dentro de uma tela aparece por cima do app inteiro.
- O Toast fica atrás de `Modal`: tela por cima com Desfazer ou aviso usa uma `View` própria (foi isso que escondia o aviso de "Guardar para correção").
- Valor de dinheiro em tela de consulta usa `showMoney()`; em edição, confirmação e importação, `formatMoney()`.
- `splitGroups` marca com `HARD` (`\u0004`) o item separado só pelo verbo; `parseInput` e `splitSegments` tiram a marca. Quem usar `splitGroups` direto precisa tirá-la.
- Em `Drawer.js`, nada pode usar `profile` antes de `const { profile } = settings;` (na 1.12.2 isso derrubou os Ajustes no navegador antes da entrega).
- Módulo novo testado precisa ser copiado para a pasta temporária em `test-parser.mjs` (o bloco 1.12.1 copia `voice.js`; o 1.12.3 copia `reminders.js` e `backup.js`).
- Restaurar backup (`restoreBackup`/`undoRestore`) termina em `remakeReminders`, que cancela os avisos do celular e agenda de novo a partir dos dados gravados. Quem mexer no restaurar mantém isso.

## 4. Estrutura de Dados/Arquitetura

### Fluxo principal
`index.js` registra a tarefa dos botões dos avisos e abre `src/Root.js`, que lê o visual salvo, aplica cores e fontes e só então carrega `App.js`.

Fala → `src/speech.js` (versões ouvidas + áudio) → `src/voice.js` (dicionário pessoal e escolha da melhor versão) → `src/parser.js` → `enrichParsed` (`src/subjects.js`) → confirmação em `src/CaptureModal.js` → `src/store.js` → AsyncStorage e `src/reminders.js`. Texto digitado entra direto no `parser.js`.

Importação: arquivo escolhido ou Compartilhar → `src/importDocument.js` → `src/documentParser.js` → `reconcile` (`src/accounts.js`) → revisão em lote em `src/EditSheet.js`.

### Módulos

| Arquivo | Papel |
|---|---|
| `App.js` | Abas, microfone, aba lateral, avisos, Compartilhar |
| `src/store.js` | Contexto `useData`: dados, configurações, desfazer, dicionário da voz, ocultar valores, modo de teste |
| `src/storage.js` | `useStoredState`, estado salvo no AsyncStorage |
| `src/speech.js` | Reconhecimento de voz em níveis (`useSpeech`, `speechMode`) |
| `src/voice.js` | Vocabulário, escolha da versão, dicionário pessoal (`buildVocab`, `pickBest`, `diffWords`, `learn`, `applyLearned`) |
| `src/parser.js` | Interpretador de frases (`splitGroups` separa os itens, `breakOnActions` separa fala corrida, `CONDITION_RE` tira o contexto, `abbreviate` faz o título curto) e planejamento dos avisos |
| `src/recurrence.js` | Lembretes que se repetem |
| `src/subjects.js` | Matérias, ocupação, semestre |
| `src/holidays.js` | Feriados nacionais, móveis e estaduais |
| `src/reminders.js`, `src/actions.js`, `src/notificationTask.js` | Notificações e botões com o app fechado |
| `src/accounts.js` | Saldo por conta, reconciliação, junção de contas |
| `src/budget.js` | Orçamento do mês e perguntas de renda |
| `src/insights.js` | Recebimentos, Previsto, ponte do saldo, Indicadores |
| `src/backup.js` | Montar, conferir, salvar, restaurar e desfazer |
| `src/theme.js`, `src/AppText.js`, `src/ui.js` | Cores, fontes e componentes base |
| `src/CaptureModal.js`, `src/EditSheet.js`, `src/Drawer.js`, `src/Onboarding.js` | Confirmação (com correção do que foi ouvido), edição (aprende com o nome corrigido) e revisão, aba lateral (Ajustar perfil, modo de teste), primeira abertura (5 passos) |
| `src/screens/` | Tasks, Finance, Study, Calendar |
| `src/components/` | MonthView, Insights, Accounts, BudgetEditor, FinancePrompts, Subjects, AboutFields, EntryGreeting, AlertPreview, ItemFields, SwipeRow, RepeatRow, Waveform |

### Armazenamento

| Chave | Conteúdo |
|---|---|
| `@org2/tasks` | Lista de tarefas |
| `@org2/study` | Lista de itens de estudo |
| `@org2/finance` | Lista de lançamentos |
| `@org2/recurrences` | Contas fixas mensais |
| `@org2/accounts` | Contas |
| `@org2/subjects` | Matérias |
| `@org2/misheard` | Frases guardadas (só no modo de teste, desde a 1.12.2), até 200 |
| `@org2/settings` | Perfil, ajustes, orçamento, dicionário da voz |
| `@org2/handled` | Botões de aviso já tratados, até 150 |
| `@org2/attendIds` | Ids dos avisos "Foi na aula?" agendados (1.13; não entra no backup) |
| `@org2/_antes_da_restauracao` | Cópia feita antes de restaurar um backup (não entra no backup) |

Áudios das frases guardadas: arquivos `frase-<hora>.wav` na pasta do app (`Paths.document`); não entram no backup.

### Modelos

```js
// Tarefa e item de estudo
{ id, kind: 'task' | 'study', title, date, time, lead, done, note,
  repeat: { freq: 'daily' | 'weekly' | 'monthly', days?, day?, interval? } | null,
  times, doneSlots, notifIds, createdAt, subjectId /* só em study */ }

// Lançamento
{ id, type: 'in' | 'out' | 'transfer', title, amount, category, date,
  status: 'paid' | 'pending', essential, account, from, to, recId, importId,
  note, notifIds, createdAt }
// from/to null = outra conta sua fora do app
// Saídas: Cartão, Contas, Alimentação, Transporte, Saúde, Estudos, Lazer, Parcelas, Outros
// Entradas: Salário, Bônus, Extra, Investimentos, Outros

// Conta
{ id, name, kind: 'corrente' | 'poupanca' | 'investimento' | 'cartao' | 'carteira',
  number, bank, anchor: { date, balance, at, importId } | null, createdAt }

// Conta fixa mensal
{ id, title, amount, type, category, account, from, to, day, generated: ['AAAA-MM'], createdAt }

// Matéria
{ id, name, aliases: [], color: 0..7, room,
  schedules: [{ days: [0-6], start, end }],
  archived, archivedAt, semester, createdAt,
  grades: [{ id, name, score /* null = sem nota */, max, weight, date, studyId? }],   // 1.13
  formula,                                                                          // 1.13, texto livre
  absences: [{ id, date, count, fromAlert?, end? }] }                               // 1.13

// Frase guardada (1.12.1)
{ id, text, parsed, at, heard /* 1ª versão do Android */, alts: [], audio /* uri ou null */, fixed: [] /* o que foi salvo */ }

// Ajustes (@org2/settings)
{ profile: { name, age, photo, occupation: 'trabalho' | 'estagio' | 'outros' | 'so_estudo' | null,
             occupationName, state },
  levels: { task, finance, study },  // 'alta' | 'media' | 'baixa'
  layout: 'simple' | 'advanced', theme: 'light' | 'dark',
  alertStyle: 'som' | 'vibrar', autoListen, shortTitles, captures, onboarded,
  semester: { start, end }, defaultAccount,
  backup: { lastAt, lastName, restoredAt },
  budget: { salary, target, countExtras, incomeType: 'fixed' | 'variable' | null, salaryDay,
            salaryAsk, salaryAskSeen, useOwn: 'ask' | 'always' | 'never',
            ownMonths: { 'AAAA-MM': bool }, skipMonths: ['AAAA-MM'], ownSource },
  hideBalance,      // 1.12.1
  voiceOnDevice,    // 1.12.1, padrão true
  voice: { learned: { '<de>': { to, n } } },  // 1.12.1
  testMode,         // 1.12.2, padrão false
  academic: { passGrade, maxGrade, classMinutes, absencePct, askAttendance },  // 1.13
  fin113 }          // 1.13: correção única de Finanças já feita

// Item vindo do interpretador (antes de salvar) pode trazer askDay: true

// Backup (.json)
{ app: 'no-prumo', format: 1, appVersion, createdAt, counts,
  data: { /* as 9 chaves @org2 */ }, photo? }
```

### Avisos
- Canais `lembretes-som` e `lembretes-vibrar`.
- Categorias com botões: lembrete (Feito / Adiar 10 min), conta (Paguei / Lembrar amanhã), receita (Recebi / Lembrar amanhã), aula (Fui / Faltei, 1.13).
- Tarefa em segundo plano `meu-organizador-botoes-dos-avisos`.

## 5. Estado Atual (O que já está pronto e funcionando)

**1.13.0 (10/11/2026):** 536/536 testes; notas e faltas, Finanças mais limpo. Conferido no navegador (Simples, Avançado, claro e escuro): matérias com faltas e média, tela Notas e faltas, "Já saiu a nota?", voz "tirei… e faltei…", Ajustes → Faculdade e o aviso "Foi na aula?", Finanças sem os números repetidos e com Devolvido/Tarifas e juros. Não testado fora do celular: os avisos "Foi na aula?" e o Faltei com o app fechado.

**1.12.3 (10/11/2026):** 474/474 testes; restaurar e "voltar ao que tinha" refazem os avisos; "ocultar valores" vale nos avisos; saudação conta só o que é para hoje (igual ao cartão de Tarefas); frases nº 3 e 4 do campo Testes. APK de teste pelo GitHub Actions.

**Conferido em 09/11/2026 nos arquivos entregues:** o zip da 1.12.2 passa em **445/445** testes, com o banco de frases reais em 8/8. O APK é `com.meuorganizador.app`, versionCode 21, versionName 1.12.2, nome Prumo, com a assinatura registrada na seção 2. Os textos novos estão no bundle. Conferido no navegador: "Ajustar perfil" fechado e aberto, modo de teste com 5 toques, confirmação.

### Pronto no app
- **Base:** microfone que abre ouvindo (desligável em Ajustes → Voz), ondas de áudio, confirmação com edição, digitação como alternativa, primeira abertura em 5 passos, saudação com pendências, visual Simples ou Avançado em claro ou escuro, importância por área, aviso de teste com contagem de 5 segundos.
- **Voz (1.12.1/1.12.2):** reconhecimento em níveis com pontuação, vocabulário e 5 versões; fala corrida separada em itens; "N horas da tarde"; só horário = hoje, com pergunta se já passou; correção do que foi ouvido tocando no texto; dicionário pessoal (também pela tela Editar); modo de teste escondido para mandar frases.
- **Ajustes (1.12.2):** ocupação e estado em "Ajustar perfil", embaixo da idade.
- **Tarefas:** data, horário, lembretes que se repetem, grupos Hoje, Semana, Mais para frente e Sem data, arrastar para concluir ou excluir.
- **Estudos:** abas Itens e Matérias, contagem regressiva, avisos automáticos, matérias com apelidos, cor, sala e horários, semestre, arquivar e reativar, ligar itens antigos a uma matéria.
- **Finanças:** lançamentos e contas fixas, contas com saldo real, transferências, orçamento, recebimentos, Indicadores, "Seu mês", "Tudo do mês" em tela inteira, pop-ups de renda e de dinheiro de outras contas, importação de PDF e CSV com revisão em lote, menu Compartilhar do Android, ocultar valores.
- **Agenda (Avançado):** calendário do mês, filtros por área e feriados nacionais e do estado do perfil.
- **Backup manual:** Ajustes → Backup salva um `.json` na pasta escolhida, restaura com confirmação, volta ao que havia antes e destaca quando o último passa de 14 dias.

### Situação do teste no celular

| Item | Situação |
|---|---|
| Backup e restauração | Testado pelo Kaiky: funcionou |
| Números de Finanças no mês com extrato ("Seu mês", teto de "Ainda pode gastar") | Testado pelo Kaiky: números batem com o banco |
| Só vibração com a tela bloqueada | Confirmado pelo Kaiky |
| Reconhecimento "no celular, com pontuação" no S25 | Confirmado pelo Kaiky na 1.12.1 (09/11) |
| Frases que saíram erradas no celular | No campo Testes (`docs/memoria/testes.md`): nº 1 e 2 resolvidas na 1.12.1; nº 3 e 4 resolvidas na 1.12.3 (teste no celular pendente) |
| Frase longa com várias coisas; "comer salada 3 horas da tarde" | Falharam na 1.12 (09/11); corrigidas na 1.12.1, teste no celular pendente |
| Dicionário pessoal, correção tocando no texto, modo de teste, "Ajustar perfil", ocultar valores | Conferidos no navegador e por teste automático; teste no celular pendente |
| Matérias, ocupação, feriados, microfone já ouvindo, vibração com o app aberto | Entregues na 1.12; teste no celular pendente |
| Pop-ups de renda e dinheiro de outras contas | Conferidos com extrato real e no navegador; sem registro de aprovação no celular |
| Pergunta dos Pix na revisão de importação | Só por teste automático |

### Limitações atuais
- O interpretador continua por regras: o banco de frases tem 8 frases; ele precisa crescer com as frases do campo Testes para medir de verdade.
- O dicionário pessoal só aprende com o que a pessoa corrige; a 1ª correção vira sugestão, não troca sozinha.
- As 3 frases guardadas antes da 1.12.2 continuam no celular, mas só aparecem com o modo de teste ligado.
- O áudio das frases guardadas não sai do celular pelo "Mandar as frases" (só o texto).
- Se o reconhecimento cair para "pelo Google", o áudio vai para o Google, sem aviso na hora; em "no celular", não.
- Avisos em Xiaomi e Samsung nunca foram testados.
- Itaú é o único banco conferido com extrato real. OFX, PDF-foto e PDF da Caixa não são lidos.
- Backup depende de a pessoa lembrar de salvar (até a 1.17).
- Só Android. Ainda usa a chave de assinatura de teste.
