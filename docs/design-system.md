# researchbook: design system

Versão 3 (v2.24.0, novembro de 2026). Descreve o sistema que está no ar depois do redesenho (v2.0.0) e do polimento visual (v2.20.0 a v2.24.0). Vale para toda tela nova e para toda mudança em tela existente. Os valores moram em `public/estilo.css` (seção Tokens); este documento explica o porquê e as regras de uso. Um teste (`tests/design.spec.js`) confere as regras que dá para medir, em todas as rotas, no computador e no celular.

## Direção

Produto acadêmico, calmo e consistente: papel branco, cinzas neutros, um azul só. A tipografia faz a hierarquia; o conteúdo fica no papel, separado por linhas finas; a cor do conteúdo são os grifos. A serifa (Literata) marca o que é conteúdo e título; a sans (Inter) marca o que é interface.

Quatro princípios:
1. **O conteúdo do Diobert é o protagonista.** Títulos de obras, trechos, teses e textos aparecem em Literata; a interface ao redor fica neutra e baixa.
2. **Um sistema pequeno, usado sempre.** Oito tamanhos de letra, três alturas de controle, quatro raios. Nada de valor solto no código.
3. **Papel com linhas, um painel por tela.** Nada de cartão com contorno. Quando a tela tem um protagonista (o próximo passo, a tela vazia, o cartão de revisão), ele ganha o painel cinza; só um.
4. **Toda espera e todo resultado ficam visíveis.** Botão que dispara trabalho mostra que está trabalhando; tela que carrega mostra a forma do que vem; erro diz o que fazer.

## Fontes consultadas

- Nielsen Norman Group: 10 heurísticas (visibilidade do status), diretrizes de mensagens de erro, indicadores de progresso, esqueletos de tela, estados vazios em aplicações complexas.
- Apple Human Interface Guidelines: tipografia (estilos por papel, tamanho mínimo), escrita, botões (alvo de 44 pt no toque).
- W3C, WCAG 2.2: contraste de texto 4,5:1 (1.4.3), contraste de componentes 3:1 (1.4.11), área mínima de alvo 24 × 24 px (2.5.8), foco visível (2.4.7), movimento reduzido.
- GOV.UK Design System: botão com prevenção de clique duplo; uma ação principal por página.
- Microsoft Writing Style Guide: maiúscula só na primeira palavra em títulos, rótulos e botões.
- Material Design 3: escala tipográfica por papel (display, título, corpo, rótulo) com tamanho, peso e entrelinha fixos.

## Tokens

### Cor

| Token | Valor | Uso |
|---|---|---|
| `--fundo`, `--superficie` | `#FFFFFF` | Papel: fundo das telas, campos, modais, menus |
| `--superficie-2` | `#F4F4F4` | Painel da tela, botão secundário, trilho, pílula selecionada, hover |
| `--superficie-3` | `#EAEAEA` | Hover de botão secundário, pressionado |
| `--borda` | `#EDEDED` | Linha entre itens e entre seções |
| `--borda-forte` | `#D9D9D9` | Divisor forte, contorno de número de etapa |
| `--borda-campo` | `#8F8F8F` | Contorno de campo (3,2:1 sobre branco, WCAG 1.4.11) |
| `--texto` | `#1F1F1F` | Texto principal (16,5:1) |
| `--texto-2` | `#5C5C5C` | Texto secundário (6,7:1) |
| `--texto-3` | `#6B6B6B` | Legendas e metadados (5,3:1; 4,8:1 sobre o painel cinza) |
| `--acento` | `#1D5A7A` | Azul petróleo: botão principal, ação discreta, foco, lugar atual no menu (7,5:1) |
| `--acento-forte` | `#164863` | Hover do acento |
| `--acento-suave` | `#E8F0F4` | Hover de ação discreta, anel de foco de campo. Nunca fundo de bloco |
| `--sucesso` / `--sucesso-suave` | `#2E6A38` / `#E7F0E6` | Concluído, sincronizado |
| `--aviso` / `--aviso-suave` | `#7E5410` / `#FBF1DC` | Aviso de verdade: limite de gasto, IA que não respondeu, sincronização pendente |
| `--perigo` / `--perigo-suave` | `#A23A26` / `#FBEAE5` | Erro, prazo no último dia, apagar o registro inteiro |

Cores de grifo (por função, não mudam): Conceito `#F5D768`, Evidência `#B4DBA2`, Método `#A9CBEA`, Crítica `#F2AE9F`, Para a dissertação `#D0BDEB`.

Regras de cor:
- **Azul só em ação e lugar.** Botão principal, ação discreta, foco, item atual do menu. Nunca como fundo de um bloco de conteúdo.
- **Vermelho só em erro, prazo no último dia e apagar o registro inteiro.** Estado neutro ("Fora da biblioteca", "Sem PDF") é cinza com o texto dizendo o estado.
- **Âmbar só em aviso de verdade.** Nota informativa é texto comum (`.nota-info`).
- Cor nunca é o único sinal: status leva texto ou ícone junto.
- Os nomes antigos (`--papel`, `--cartao`, `--linha`, `--tinta`, `--grafite`, `--petroleo` e as variações) ainda existem e apontam para os tokens acima. Em regra nova, use o nome novo.

### Tipografia

Inter (interface) e Literata (títulos, conteúdo e leitura), servidas pelo app.

| Token | Tamanho | Papel |
|---|---|---|
| `--fs-legenda` | 12 | Legendas, contadores, cabeçalho de coluna |
| `--fs-meta` | 13 | Metadados, ajuda de campo, rótulo de grupo |
| `--fs-ui` | 14 | Padrão da interface: botões, campos, filtros, linhas de lista |
| `--fs-corpo` | 16 | Parágrafo de apoio, subtítulo de bloco, campos no celular |
| `--fs-titulo-3` | 18 | Título de item numa lista (Literata) |
| `--fs-leitor` | 20 | Texto do leitor e do editor (Literata) |
| `--fs-titulo-2` | 22 | Título de seção (Literata); título de conteúdo no celular |
| `--fs-titulo-1` | 30 (26 até 700 px) | Título de conteúdo e título do painel (Literata) |
| `--fs-tela` | 44 (26 até 1000 px) | Nome da seção: Ler, Escrever, Dissertação, Acervo |

Os títulos têm papéis fixos. Um teste confere os três primeiros em toda rota.

| Papel | Como marcar | Letra | Corte |
|---|---|---|---|
| Nome de seção | `h1` em `.topo` | Literata 44, peso 500 | Não corta |
| Título de conteúdo (obra, texto, aula, nome do projeto) | `h1.tit-conteudo`, `.esc-cab h1`, `.ac-obra-tit` | Literata 30 (22 no celular), peso 500 | Nunca corta: aparece inteiro |
| Título do painel | `h2` dentro de `.proximo` | Literata 30, peso 500 | 3 linhas, com reticências |
| Título de seção | todo `h2` de `#vista` e de `.modal` | Literata 22/30, peso 500 | Não corta |
| Subtítulo de bloco | todo `h3` de `#vista` | Inter 16/24, peso 600 | Não corta |
| Rótulo de grupo | `.proj-sec h3` | Inter 13/18, peso 600, cinza | Não corta |
| Título de item numa lista | `.linha-lv .tit`, `.fich-card .t`, `.txt-card .t`, `.seq .t` | Literata 18/26, peso 500 | 3 linhas, com reticências |

Regras: só os tamanhos da tabela (o teste confere); nunca itálico na interface; nada em caixa-alta; números de tabela com `font-variant-numeric: tabular-nums`; linha de leitura com até 70 caracteres. A linha de apoio fica a 12 px do título. Texto do autor nunca recebe `white-space: nowrap` sem reticências, e toda tela mantém a largura da janela com um título de 200 caracteres (o teste confere).

### Espaço, forma e movimento

- Espaço em múltiplos de 4: `--e-1` 4, `--e-2` 8, `--e-3` 12, `--e-4` 16, `--e-5` 20, `--e-6` 24, `--e-8` 32, `--e-10` 40, `--e-12` 48, `--e-16` 64.
- Raios: `--r-1` 4 (chips, foco), `--r-2` 10 (campos, blocos de código), `--r-3` 14 (menus que flutuam, cartão de escolha), `--r-4` 20 (painel da tela, trilho que quebra em duas linhas). Botão é pílula (999 px). Círculo só em avatar, ponto de status e número de etapa.
- Alturas de controle: `--h-p` 30, `--h-m` 38, `--h-g` 44. No toque: 34, 40 e 44.
- Sombra só no que flutua: `--sombra-1` (menus, folhas, tutor) e `--sombra-2` (modais). Nada que está no papel tem sombra.
- Movimento: `--t-rapido` 120 ms, `--t-medio` 200 ms, curva `--curva`. Com "reduzir movimento" ligado, nada anima; o texto do botão continua dizendo o que está acontecendo.
- Foco: anel de 2 px em `--acento` com 2 px de afastamento, em todo elemento focável. O campo em foco troca o contorno para `--acento` e mantém os cantos.

## Componentes

### Botão (`.btn`)

| Variante | Classe | Aparência | Quando |
|---|---|---|---|
| Principal | `.btn.prim` | Pílula azul, texto branco, peso 600 | A ação principal da tela. **Uma por tela** |
| Secundário | `.btn` | Pílula cinza (`--superficie-2`); branca quando está sobre o painel cinza | Ações de apoio |
| Discreto | `.btn.fant` | Sem fundo, texto azul | Ações de baixo peso em listas e barras ("Editar", "Cancelar") |
| Pequeno | `.btn.mini` | 30 px de altura, letra 13 | Ação numa linha de lista |
| Apagar com desfazer | `.btn.fant.mini` | Discreto azul | Apaga um item da linha e o aviso traz "Desfazer" (tarefa, marco, anotação) |
| Apagar o registro | `.btn.fant.perigo` | Discreto vermelho | Apaga o registro inteiro (texto, obra, diálogo, projeto) |
| Ação no meio de um texto | `.lnk` | Letra do botão discreto, sem sublinhado e sem recuo | "Mudar", "Corrigir dados da obra", "Definir um limite" |
| Ver mais de uma seção | `.lnk-sec` | Azul, 13 px, peso 600 | No cabeçalho de uma seção: "Todas as aulas" |

- **Um botão azul por tela.** Com painel (`.proximo`) ou aviso de tela vazia na tela, o botão do topo é `.btn`. Um modal aberto conta como outra tela. O teste confere.
- Todo botão com fundo ou contorno é pílula. O teste confere.
- Texto 14 px, ícone de 16 px à esquerda com 6 px de espaço. Ícone sempre com texto.
- **Carregando:** toda ação que espera rede ou IA marca o botão com `aria-busy="true"` depois de 300 ms. O botão mantém a largura, troca o ícone por um giro, ignora cliques repetidos e, se tiver `data-ocupado="Salvando…"`, mostra esse texto.
- Desabilitado: `disabled` com opacidade 0,5 e um texto perto explicando por quê.
- Link que leva a outra tela é link (`<a>`), não botão; pode ter a aparência de botão.

### Escolher e filtrar

O item selecionado tem três aparências. Não crie outra.

| Para | Componente | Selecionado |
|---|---|---|
| Trocar de tela dentro da seção | Abas (`.subnav`, `.abas-lat`) | Sublinhado de 2 px |
| Escolher um modo entre poucos | Trilho (`.seg`, `.tipo-reg`, `.alterna.modo-leitor`, `.alterna.fich-caminho`) | Pílula branca sobre o trilho cinza |
| Filtrar uma lista, abrir um painel, item de menu | Pílulas soltas (`.alterna`, `.ac-filtros`), `.secoes`, `.proj-menu`, `.aj-indice` | Pílula cinza, peso 600 |

- Cartão de escolha (`.ia-modo`, `.dlg-item`): é a única caixa com contorno no papel. Selecionado: contorno azul.
- Etapas de assistente (`.passos`): número em círculo e nome numa linha, sem caixa; a atual com o número em azul, as feitas com a marca de conferido. No celular aparece só o nome da etapa atual.
- No celular, um trilho com muitas opções quebra em duas linhas.

### Campo

Rótulo acima (13 px, peso 500), campo com 38 px de altura (40 no toque), cantos de 10 px, contorno `--borda-campo`, letra de 14 px (16 no celular, para o iPhone não dar zoom). Ajuda abaixo em `--fs-meta`, erro abaixo em `--perigo` com o que fazer. Placeholder só como exemplo, nunca como rótulo.

- Um formato só: não dê altura, canto, contorno ou letra própria a um campo. O teste confere.
- O campo de texto longo cresce com o conteúdo (`field-sizing: content`) até 60% da altura da tela e não tem a alça de redimensionar. Onde o navegador não sabe fazer isso, ele mantém a altura mínima e rola por dentro.
- Busca (`.busca`): o mesmo campo, com a lupa dentro.

### Navegação

- Barra de cima no computador: marca, as seções (a atual com um traço azul embaixo), a busca e o avatar. No celular, barra de baixo com Hoje, Ler e Mais.
- Dentro de um projeto: menu flutuante à esquerda no computador; no celular, ele ocupa a barra de baixo.
- Abas da seção (`.subnav`): sublinhado. No celular, a fileira rola e a borda direita esmaece para mostrar que há mais.
- Leitor e editor no celular: o cabeçalho cabe numa linha e o resto fica num menu ("Painéis" no leitor, "Seções e ações" no editor). A ação principal do leitor vai para o fim do texto.

### Superfícies e listas

- **Papel:** seção é título e conteúdo, sem moldura. Seções em sequência se separam por espaço e, quando ajuda, por uma linha (`border-top: 1px solid var(--borda)`).
- **Lista:** linhas no papel, 16 px de respiro vertical, linha entre os itens. A linha inteira é o link e o título sublinha ao passar o cursor. Tabela só quando há colunas para comparar (Acervo, Mapa, Ajustes).
- **Coluna lateral** (`.lado`): blocos sem caixa, separados por linha.
- **Painel da tela:** fundo `--superficie-2`, cantos de 20 px, 40 px de respiro, alinhado à esquerda. Usos: próximo passo (`.proximo`), tela vazia (`.bib-vazia`, `.vazio-estado`), sugestões da memória (`.sug`), cartão de revisão (`.face`). Um por tela.
- **Contorno nos quatro lados** só em cartão de escolha e no que flutua (modal, tutor, menus, a página do PDF). O teste recusa qualquer outra caixa.
- **Data:** dia grande em Literata com o mês embaixo, para prazo e para compromisso; a hora vai na linha de apoio. No Hoje, compromisso do dia leva a hora em negrito.
- Chip (`.chip`): 12 px, cantos de 4 px, `--superficie-2`. Bloco de código (`pre.arvore`, `pre.prev`): fundo `--superficie-2`, sem contorno.

### Carregamento e vazios

- Tela abrindo: `esqueleto()` de `ui.js` desenha o título real e blocos cinza na forma do conteúdo. Nunca "Carregando…" sozinho.
- Ação longa (IA, transcrição): indicador no próprio botão; acima de 10 s, progresso com etapa ("Transcrevendo parte 2 de 6"). Nunca "leva cerca de N minutos" fixo nem porcentagem sem saber o total.
- Tela vazia: o painel cinza, com o que vai aparecer ali, por que está vazio e o botão azul para começar. O botão do topo fica cinza.

### Mensagens

- Toast (`#toast`): confirmação curta com o mesmo verbo do botão ("Salvar" → "Salvo"), com "Desfazer" quando a ação apaga ou substitui.
- Aviso em linha (`.aviso`, `.erro-ia`): o que houve, o que fazer e o botão do próximo passo. Só para aviso de verdade; informação é `.nota-info`.
- Modal só para decisão que interrompe de propósito (confirmar, formulário curto). Título com verbo, botão principal à direita.

## O que o teste confere

`tests/design.spec.js` percorre todas as rotas com dados de exemplo, no computador (1440 × 900) e no celular (390 × 844), e recusa:
- tamanho de letra fora da escala e alvo de toque menor que 24 × 24 px;
- página mais larga que a janela com um título de 200 caracteres;
- título do painel com mais de 3 linhas e título de seção fora de Literata 22/30;
- mais de um botão azul na tela; botão com fundo ou contorno que não seja pílula; campo fora do padrão;
- caixa com contorno nos quatro lados fora das exceções;
- no celular, cabeçalho do leitor com mais de uma linha e texto do editor começando abaixo de um terço da tela;
- medida ou cor escrita no atributo `style`; contraste de texto abaixo de 4,5:1 e de contorno de campo abaixo de 3:1.

## Dívida conhecida

`public/estilo.css` ainda tem, no começo, regras do sistema anterior para classes citadas no código antigo de `app.js`. Elas não aparecem nas telas atuais. Ao redefinir uma regra no fim do arquivo, confira se não cobriu um `@media` de cima: foi a causa de cinco defeitos no celular durante o polimento.

## Escrita da interface

Baseada em NN/g, Apple HIG e Microsoft Writing Style Guide, adaptada ao português do Brasil.

1. **Maiúscula só na primeira palavra** e em nomes próprios, inclusive em botões, abas e títulos ("Adicionar obra", não "Adicionar Obra"). Nada em caixa-alta.
2. **Botão é verbo + objeto**, de preferência até três palavras: "Adicionar obra", "Enviar gravação", "Revisar cartões". Nunca "OK", "Enviar" solto ou "Clique aqui".
3. **O mesmo nome do começo ao fim.** O botão "Salvar" gera "Salvo"; "Apagar texto" pede "Apagar este texto?" e confirma "Texto apagado".
4. **Carregando no gerúndio com reticências:** "Salvando…", "Transcrevendo…", "Pensando…".
5. **Erro diz o que houve e o que fazer,** sem culpa, sem "inválido", sem código técnico, sem pedir desculpas: "Não deu para baixar o PDF do Drive. Confira a internet e tente de novo."
6. **Vazio convida:** "Nenhum cartão para hoje. Crie cartões a partir dos grifos de uma obra."
7. **Sem jargão técnico fora de Ajustes:** "área temporária do Gemini" em vez de "Files API"; "login Google" em vez de "OAuth".
8. **Frases curtas e diretas, na segunda pessoa (você).** Ajuda de campo com uma frase.
9. **Números e datas no padrão brasileiro:** "14 nov.", "19h", "1.234 palavras", "US$ 0,52".

### Glossário

| Use | Não use | Observação |
|---|---|---|
| obra | leitura, artigo, item | Cada entrada da biblioteca. "Leituras" fica só como nome da aba e da etapa de ler |
| grifo | destaque, marcação | |
| fichamento | resumo da obra | |
| texto | documento, rascunho | Na Escrita |
| cartão | flashcard, card | |
| encontro de orientação | reunião | |
| aula | encontro (na disciplina) | |
| Copilot / Tutor | IA, assistente | Quando a função importa; "IA" para o conjunto |
| Ajustes | Configurações | |
| Sincronizado | Salvo na nuvem | Status do Drive |

## Como mudar este sistema

Mudou um token ou componente: atualize este arquivo, `public/estilo.css` e, se for uma regra medível, `tests/design.spec.js`, no mesmo PR, com capturas antes e depois.
