# No Prumo: marca, cores e telas (referência de design)

Atualizado em 09/11/2026 (trazido para o repositório em 10/11). Resume tudo o que foi decidido no chat de design (06 e 07/11/2026). Esse chat foi apagado, então este doc e os dois canvas abaixo são a fonte do visual. Em conflito com `docs/memoria/memoria.md`, vale a memória (decisão mais recente) e o código da versão em uso.

**Canvas principal (marca + telas):** https://claude.ai/artifact/RE1cjx7cy8KuiHW7T1dDUV
**Canvas do ícone (rodadas de logo):** https://claude.ai/artifact/CohqSXTr5W5YiarNCc4eST

---

## 1. Nome

- **No Prumo.** No ícone do celular, o rótulo é só **Prumo** (o nome longo seria cortado).
- **Frase:** "Fala. Tá no prumo."
- **Usos:** "abre o No Prumo"; saudação "Bom dia, Kaiky. Tá no prumo?"; tudo feito: "Tudo no prumo."
- **Por quê:** "estar no prumo" = estar em ordem; o prumo é ferramenta de obra (liga com engenharia).
- **Risco conhecido:** jovem pode não conhecer a expressão. Teste combinado: mandar o nome a 4 ou 5 amigos sem explicar e perguntar o que o app faz. Ainda pendente (está na lista "antes de divulgar", junto com a checagem no INPI).
- **Considerados e descartados:** Prumo (sozinho), Pauta, Dita, Tri, Fala, Bora, Anota, Tá Feito, Manda, Done, Flow, Hey, Nudge, Sorted e os acrônimos TUDO (Tarefas, Universidade, Dinheiro, Organização), FEITO, VIDA, TEF e AVE. Plano B, se o teste falhar: **Tudo** ou **Done** (o ícone serve para qualquer nome).

## 2. Ícone: "Blocão" (aprovado 07/11)

Prumo de obra brasileiro, largo e baixo: argola e fio em cima, cúpula arredondada, corpo cilíndrico e base reta com cantos suaves. **Não tem ponta fina**, porque o Kaiky não vê mais esse tipo de prumo hoje. O corpo tem três faixas (Tarefas azul, Finanças verde, Estudos roxo). Cada faixa tem dois tons, luz à esquerda e sombra à direita. Há sulcos escuros entre as faixas e um brilho vertical à esquerda.

**SVG de referência (viewBox 0 0 96 96):**
```svg
<svg viewBox="0 0 96 96">
  <defs><clipPath id="b"><path d="M30 44A18 18 0 0 1 66 44V75Q66 81 60 81H36Q30 81 30 75Z"/></clipPath></defs>
  <rect width="96" height="96" rx="22" fill="#12151C"/>
  <circle cx="48" cy="13" r="3" fill="none" stroke="#F7F6F2" stroke-width="2.4"/>
  <path d="M48 16V26" stroke="#F7F6F2" stroke-width="2.4" stroke-linecap="round"/>
  <g clip-path="url(#b)">
    <rect x="28" y="22" width="20" height="28" fill="#8FADFF"/><rect x="48" y="22" width="20" height="28" fill="#5A80F0"/>
    <rect x="28" y="50" width="20" height="15" fill="#6BE0B4"/><rect x="48" y="50" width="20" height="15" fill="#2AB884"/>
    <rect x="28" y="65" width="20" height="20" fill="#C2AEFF"/><rect x="48" y="65" width="20" height="20" fill="#9575F5"/>
    <path d="M28 50H68M28 65H68" stroke="#12151C" stroke-width="2.5"/>
    <path d="M36 36V76" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity="0.6"/>
  </g>
</svg>
```

**Variantes:**
- **Escura:** é a padrão, a que vai no ícone do app.
- **Clara:** fundo `#F7F6F2`, argola e fio `#12151C`, sulcos na cor do fundo.
- **Preto e branco:** fundo preto, corpo branco, sulcos pretos, sem brilho.

**Onde aparece:** no ícone do app e **dentro do botão de falar**. **Não** aparece no cabeçalho das telas, porque lá parecia foto de perfil.

**Animação de entrada:** descartada em 09/11 (era só enfeite). A 1.12.2 virou "Ajustes mais limpos".

### Como se chegou nele
- Rodada 1, com 10 logos: prumo limpo, monograma NP, balão de fala, anel do microfone, ondas de áudio, cápsula-prumo, nível de bolha, pilha de cartões, mascote e gota na água. O Kaiky pediu para misturar a 1 com a 6.
- Rodada 2, com 10 misturas: o Kaiky escolheu a 10, "Com volume", pelo jogo de luz e pelo topo arredondado. A ponta fina incomodou.
- Rodada 3, com 5 versões da 10 sem ponta: cilindro clássico, cápsula, base chanfrada, **Blocão** e fundo macio com frisos. **Aprovado: Blocão.**
- As três rodadas ficam no canvas do ícone.

## 3. Botão de falar

- Fica no centro da barra de baixo e é redondo (a única coisa redonda no Simples, junto com o avatar).
- **Anel:** gradiente cônico `#2457E6 → #0B7A52 → #6B3FD4`, com 2 px de espessura.
- **Miolo:** `#12151C` nos dois temas, com borda da cor da barra.
- **Dentro do miolo:** o Blocão sem fundo de ícone, recortado no `viewBox="26 8 44 76"`, ocupando cerca de 36% da altura do botão.
- **Tamanho:**
  - Avançado: 68 px, elevado 30 px acima da barra.
  - Simples: 56 px, na linha da barra.
- **Simples preto e branco (versão antiga):** anel e miolo pretos, Blocão branco.
- **Estados:**
  - Parado: anel e prumo.
  - Ouvindo: anéis em volta pulsando (azul e depois verde, com transparência).
- **Acessibilidade:** `aria-label`/rótulo "Falar com o No Prumo".
- **Atenção:** o botão não tem mais o desenho de microfone. A primeira abertura ou as dicas precisam ensinar que é ali que se fala (liga com a 1.12.2).

## 4. Dois modos (decidido 07/11)

**Avançado = visual 1. Simples = visual 3.** Essa decisão substitui a ideia antiga de que o Simples seria preto e branco. Os dois modos têm claro e escuro, as mesmas cores de área e o mesmo botão de falar. A escolha é feita na primeira abertura e trocada em Ajustes → Visual.

### 4.1 Avançado (visual 1): completo, cheio de informação
- Cartões coloridos cheios e cantos bem arredondados:
  - cartão de destaque: 20 a 22 px;
  - itens: 18 px;
  - abas segmentadas: 14 px;
  - etiquetas: pílula.
- **Letras:**
  - Space Grotesk 600/700 em títulos e valores (título da tela 32, valor de destaque 48, contagem 56);
  - Inter no texto (corpo 15 a 17, apoio 14, etiquetas 13, barra 14).
- **Tem:** Agenda, gráficos, Análises/Indicadores e, no futuro, Faculdade.
- **Barra:** 92 px, cinco espaços (Tarefas, Finanças, falar, Estudos, Agenda). A área ativa fica na cor dela.

### 4.2 Simples (visual 3): calmo, uma coisa por vez
Foi pensado para quem é multitarefa e para quem tem TDAH. O Kaiky pediu menos "cara de IA" (cantos muito arredondados, cards cheios), menos carga visual e letras menos "gordinhas". Depois achou a versão calma (v2) com pouca cor, e a v3 juntou a estrutura calma com as cores vivas da v1.

- **Uma coisa em foco por tela:** "Agora" (Tarefas), "Dinheiro nas contas" (Finanças), "Próxima" (Estudos). É o **único bloco com fundo colorido**, no tom suave da área, com o rótulo na cor da área em peso 600.
- **O resto em lista** com linhas finas de 1 px, sem cartões. Poucos itens antes de "ver mais".
- **Cantos de 4 px** em blocos, botões e caixinhas. As caixinhas de marcar são quadradas (20 a 22 px, borda 1,5 px na cor da área).
- **Letras:** só Inter, pesos 400 e 500 (600 só no item ativo da barra e nos rótulos de foco). Título 22, item em foco 20, valor em destaque 36, corpo 15 a 16, apoio 13 a 14, barra 12.
- **Concluídas somem** atrás de "Mostrar N feitas", com Desfazer.
- Números com algarismos de largura fixa (`tabular-nums`).
- **Barra:** 80 px, ícones com traço de 1,6 px, rótulos de 12. **Termina em Menu, sem Agenda** (decisão registrada na memória). Os desenhos do canvas ainda mostram "Agenda" e estão desatualizados nesse ponto.

## 5. Cores

**Regras:**
- Cada área tem uma cor só.
- Dinheiro não depende de vermelho × verde: entrada "+", saída "−", transferência "⇄".
- Contraste mínimo de 4,5:1.
- Alvo de toque mínimo de 44 px.

### Cores das áreas (iguais nos dois modos)

| Área | Claro | Fundo suave (claro) | Escuro | Fundo suave (escuro) |
|---|---|---|---|---|
| Tarefas | `#2457E6` | `#E4ECFD` | `#6C93FF` | `#1A2548` (borda `#2B3F85`) |
| Finanças | `#0B7A52` | `#DFF3E9` | `#3DD39A` | `#0F2E24` (borda `#1D5A44`) |
| Estudos | `#6B3FD4` | `#EDE7FA` | `#A98BFF` | `#271F45` (borda `#4A3B8A`) |
| Alerta | `#A85F00` (no fundo `#FBEBCF`, texto `#7A4300`) | `#FBEBCF` | `#F2B04C` | `#2E2410` (borda `#5A4620`) |

### Neutros do Avançado

| | Claro | Escuro |
|---|---|---|
| Fundo | `#F7F6F2` | `#0E1117` |
| Cartão | `#FFFFFF`, borda `#E3E0D6` | `#171B24`, borda `#2A3040` |
| Texto | `#12151C` | `#F2F1EC` |
| Apoio | `#3A3F4E` | `#AEB3C0` |
| Aba segmentada (trilho) | `#ECEAE3` | `#171B24` |

No Avançado claro, o cartão de destaque é **sólido** na cor da área, com texto branco. No escuro, ele vira fundo suave com borda e texto na cor clara da área.

### Neutros do Simples

| | Claro | Escuro |
|---|---|---|
| Fundo | `#FAFAF8` | `#121417` |
| Texto | `#1C1F26` | `#E8E8E4` |
| Apoio | `#5E6370` | `#9A9FA8` |
| Linha | `#E6E6E1` | `#262A31` |
| Bloco de citação (confirmar voz) | `#F0EFEA` | — |

### Ícone e marca
- Fundo do ícone: `#12151C`.
- Papel da marca: `#F7F6F2`.
- Tons das faixas do ícone:
  - azul `#8FADFF`/`#5A80F0`;
  - verde `#6BE0B4`/`#2AB884`;
  - roxo `#C2AEFF`/`#9575F5`.

## 6. Telas desenhadas (o que cada uma mostra)

Os exemplos são inventados (dentista, mercado, prova de Circuitos). Um valor do canvas veio de um extrato real em 06/11: não reutilizar valores do canvas em material novo.

### Tarefas
- **Avançado:**
  - saudação "Bom dia, Kaiky" e título "Tarefas", com o avatar "K";
  - cartão azul sólido com "4 para fazer hoje · 1 já feita" e a pílula "Próxima: 14h";
  - abas Hoje/Semana;
  - cartões de tarefa com bolinha de marcar, horário, ícone de repetição e etiqueta âmbar "Importante";
  - item feito em fundo azul suave, riscado, com "Desfazer".
- **Simples:**
  - título "Tarefas" e a data;
  - abas Hoje/Semana como texto sublinhado;
  - bloco azul suave **"Agora"**: "Ligar para o dentista · 14:00 · daqui a 3 horas · importante";
  - lista "Depois · 3";
  - "Mostrar 1 feita".

### Finanças
- **Avançado:**
  - botão em pílula "Importar extrato";
  - abas Resumo/Análises (no app: Resumo, Recebimentos e Indicadores; vale o código);
  - cartão verde sólido "Dinheiro nas contas", com a receber e a pagar em caixinhas;
  - "Ainda pode gastar" com barra e "% usado";
  - faixa âmbar "Internet vence amanhã", com o botão escuro "Paguei";
  - "Últimos lançamentos".
- **Simples:**
  - "Importar extrato" virou ícone no cabeçalho;
  - bloco verde suave "Dinheiro nas contas", com o valor de 36 e a linha "+ a receber · − a pagar";
  - "Ainda pode gastar" com barra fina de 4 px;
  - "Vence logo" em faixa âmbar, com o botão "Paguei" cheio;
  - "Últimos" com três linhas e "Ver todos".
  - Pela memória, o Finanças do Simples tem só entradas e saídas.

### Estudos
- **Avançado:**
  - cartão roxo sólido "Próxima prova: Circuitos Elétricos", com a contagem "6 dias", "sexta · 8h" e a sala;
  - lista com selos de dias e etiqueta "Perto" para 2 dias ou menos;
  - nota "avisa na véspera e no dia".
- **Simples:**
  - bloco roxo suave **"Próxima"**, com o número de dias grande à direita;
  - lista "Depois · 3", com uma coluna de dias (2 dias ou menos fica em âmbar).

### Confirmar voz
- **Avançado:**
  - topo escuro com barras de áudio nas três cores;
  - folha clara com cantos de 28 px e a citação da frase;
  - "Entendi 3 coisas. Está certo?";
  - itens com barra lateral colorida e "Editar";
  - botões "Salvar tudo" e "Cancelar e falar de novo".
- **Simples:**
  - tela clara com "Fechar" e "Nova captura";
  - botão de falar com ondas tricolores;
  - "Ouvi isso:" em bloco cinza;
  - lista com quadradinho de 8 px na cor e rótulo do tipo (Tarefa, Saída, Prova);
  - botão "Salvar tudo" de 52 px, cantos de 4 px.

**Ainda não desenhadas:**
- Agenda do Avançado;
- tela "Seu dia" da 1.15 (era 1.14 até 09/11) ("Agora / Depois / Ainda hoje" no Simples, linha do tempo no Avançado);
- Confirmar voz no escuro;
- Menu do Simples;
- dica de primeira vez do botão de falar.

## 7. Mapa dos canvas

**Canvas principal**, de cima para baixo à direita da prancha da marca (`Main.dc.html`, 1440 × 3400):
- **Modo Avançado (visual 1):**
  - `Tarefas`, `Financas`, `Estudos`, `Captura` (claro);
  - `TarefasEscuro`, `FinancasEscuro`, `EstudosEscuro`.
- **Modo Simples (visual 3):**
  - `TarefasV3`, `FinancasV3`, `EstudosV3`, `CapturaV3` (claro);
  - `TarefasV3Escuro`, `FinancasV3Escuro`, `EstudosV3Escuro`.
- **Histórico:**
  - `Simples` (P&B v1) e `SimplesV3` (P&B v3);
  - v2 "calmo" (`TarefasV2`, `FinancasV2`, `EstudosV2` e as versões escuras).
  - A v2 "calmo" tinha cores dessaturadas: claro `#3D5FA8` / `#2F7A5B` / `#6A55A8`, escuro `#8AA4E0` / `#7CC3A2` / `#AE9DE0`.

A prancha da marca tem estas seções: topo com o Blocão, Nome, Ícone (escuro, claro, tela do celular, P&B), Botão de falar (parado claro, parado escuro, ouvindo), Cores (claro e escuro), "Modo Simples: regras das telas" e "Dois modos, a mesma marca".

**Canvas do ícone:**
- `Main.dc.html`: rodada 3, com o Blocão como nº 4;
- `Logos2.dc.html`: rodada 2;
- `Logos.dc.html`: rodada 1.

## 8. Linha do tempo das decisões

- **06/11:**
  - nome Prumo, paleta saturada, cartões cheios, Space Grotesk;
  - o Kaiky achou que jovens não entenderiam "Prumo";
  - nomes em inglês e acrônimos testados;
  - o Kaiky sugeriu **"No Prumo"**, aceito;
  - logo prumo com ondas de voz e modo escuro.
- **07/11:**
  - três rodadas de logo → **Blocão**;
  - telas v2 "calmo" (menos cara de IA, letra mais leve);
  - v3 = calmo + cores da v1;
  - **visual 1 = Avançado, visual 3 = Simples**;
  - ícone tirado do cabeçalho e colocado no botão de falar;
  - logos antigos movidos para o canvas do ícone.
