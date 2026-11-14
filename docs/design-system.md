# researchbook: design system

Versão 2 (v1.1.0, novembro de 2026). Substitui a direção visual da v0.4. Vale para toda tela nova e para toda mudança em tela existente. Os valores moram em `public/estilo.css` (seção Tokens); este documento explica o porquê e as regras de uso. Um teste (`tests/design.spec.js`) confere as regras que dá para medir.

## Direção

Produto acadêmico, bem acabado e consistente, com a calma de aplicativos de produtividade como o Notion e o Claude: fundo claro e quente, pouca cor, tipografia fazendo a hierarquia, superfícies planas separadas por linhas finas, cor de destaque só para a ação principal e para o que está selecionado. A serifa (Literata) marca o que é conteúdo e título; a sans (Inter) marca o que é interface.

Três princípios:
1. **O conteúdo do Diobert é o protagonista.** Títulos de obras, trechos, teses e textos aparecem em Literata; a interface ao redor fica neutra e baixa.
2. **Um sistema pequeno, usado sempre.** Sete tamanhos de letra, três alturas de controle, quatro raios. Nada de valor solto no código.
3. **Toda espera e todo resultado ficam visíveis.** Botão que dispara trabalho mostra que está trabalhando; tela que carrega mostra a forma do que vem; erro diz o que fazer.

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
| `--fundo` | `#FBFAF8` | Fundo das telas |
| `--fundo-lateral` | `#F5F3EF` | Menu lateral, barras de ferramenta |
| `--superficie` | `#FFFFFF` | Cartões, campos, modais, menus |
| `--superficie-2` | `#F1EFEA` | Hover, chips, trilhos, fundo de segmentado |
| `--superficie-3` | `#E7E4DE` | Item selecionado no menu, pressionado |
| `--borda` | `#E6E2DB` | Linhas e contornos de superfície |
| `--borda-forte` | `#D6D1C8` | Contorno de botão secundário, divisores fortes |
| `--borda-campo` | `#948E82` | Contorno de campo (3:1 sobre branco, WCAG 1.4.11) |
| `--texto` | `#22201C` | Texto principal (15,6:1) |
| `--texto-2` | `#5C574F` | Texto secundário (6,9:1) |
| `--texto-3` | `#68625A` | Legendas e metadados (5,3:1; nunca abaixo de 4,5:1) |
| `--acento` | `#1F4A5A` | Petróleo: botão principal, link, foco, seleção (9,2:1) |
| `--acento-forte` | `#163845` | Hover do acento |
| `--acento-suave` | `#E4ECEE` | Fundo de seleção e de aviso informativo |
| `--sucesso` / `--sucesso-suave` | `#2E6A38` / `#E7F0E6` | Concluído, sincronizado |
| `--aviso` / `--aviso-suave` | `#7E5410` / `#FBF1DC` | Atenção, prazo perto |
| `--perigo` / `--perigo-suave` | `#A23A26` / `#FBEAE5` | Erro, ação destrutiva |

Cores de grifo (por função, não mudam): Conceito `#F5D768`, Evidência `#B4DBA2`, Método `#A9CBEA`, Crítica `#F2AE9F`, Para a dissertação `#D0BDEB`. Cor nunca é o único sinal: status leva texto ou ícone junto.

### Tipografia

Inter (interface) e Literata (títulos de página, conteúdo e leitura), servidas pelo app.

| Token | Tamanho / entrelinha | Peso | Papel |
|---|---|---|---|
| `--fs-legenda` | 12 / 16 | 400–500 | Legendas, contadores, atalhos de teclado |
| `--fs-meta` | 13 / 18 | 400 | Metadados, ajuda de campo, textos secundários |
| `--fs-ui` | 14 / 20 | 400–500 | Padrão da interface: botões, campos, listas, rótulos |
| `--fs-corpo` | 16 / 24 | 400 | Parágrafos de conteúdo, citações em Literata, campos no celular |
| `--fs-titulo-3` | 18 / 26 | 600 (Inter) ou 500 (Literata) | Título de seção e de cartão; corpo do leitor e do editor |
| `--fs-titulo-2` | 22 / 30 | 500, Literata | Título de painel, tese, pergunta de cartão |
| `--fs-titulo-1` | 30 / 38 (26 no celular) | 500, Literata | Título da página (um por tela) |

Regras: só esses tamanhos (o teste confere); peso 600 só em títulos Inter; nunca itálico na interface; números de tabela com `font-variant-numeric: tabular-nums`; linha de leitura com até 70 caracteres.

### Espaço, forma e movimento

- Espaço em múltiplos de 4: `--e-1` 4, `--e-2` 8, `--e-3` 12, `--e-4` 16, `--e-5` 20, `--e-6` 24, `--e-8` 32, `--e-10` 40, `--e-12` 48.
- Raios: `--r-1` 4 (chips, atalhos), `--r-2` 6 (botões, campos, itens de menu), `--r-3` 10 (cartões, painéis, menus), `--r-4` 14 (modais, destaque do Hoje). Círculo só em avatar, ponto de status e número de etapa.
- Sombra só no que flutua: `--sombra-1` (menus, folhas) e `--sombra-2` (modais). Cartões são planos, com borda.
- Movimento: `--t-rapido` 120 ms, `--t-medio` 200 ms, curva `--curva`. Com "reduzir movimento" ligado, nada anima; o texto do botão continua dizendo o que está acontecendo.
- Foco: anel de 2 px em `--acento` com 2 px de afastamento, em todo elemento focável.

## Componentes

### Botão (`.btn`)

| Variante | Classe | Quando |
|---|---|---|
| Principal | `.btn.prim` | A ação principal da tela. No máximo uma por área visível |
| Secundário | `.btn` | Ações de apoio |
| Discreto | `.btn.fant` | Ações frequentes e de baixo peso em listas e barras ("Editar", "Mostrar") |
| Destrutivo | `.btn.perigo` (texto) ou `.btn.prim.perigo` (cheio) | Apagar, descartar |

- Alturas: 34 px (padrão), 28 px (`.btn.mini`, só em linhas densas), 40 px (`.btn.grande` e qualquer botão em tela de toque). Mínimo absoluto de 24 × 24 px (WCAG 2.5.8); no toque, 40 px ou mais.
- Raio 6 px, texto 14 px peso 500, ícone 16 px à esquerda, 6 px de espaço.
- **Carregando:** toda ação que espera rede ou IA marca o botão com `aria-busy="true"` depois de 300 ms (antes disso não pisca nada). O botão mantém a largura, troca o ícone por um giro, ignora cliques repetidos e, se tiver `data-ocupado="Salvando…"`, troca o rótulo. Isso é automático para os ouvintes registrados com `ouvir()` de `public/js/ui.js`.
- Desabilitado: `disabled` com opacidade 0,5 e um texto perto explicando por quê (nunca um botão cinza mudo).
- Link que leva a outra tela é link (`<a>`), não botão; pode ter a aparência de botão.

### Campo (`.campo`)

Rótulo acima (13 px, peso 500), campo com 34 px de altura (40 px no toque, letra de 16 px no celular para o iPhone não dar zoom), ajuda abaixo em `--fs-meta`, erro abaixo em `--perigo` com o que fazer. Placeholder só como exemplo, nunca como rótulo. Foco: borda em `--acento` e halo `--acento-suave`.

### Navegação

- Menu lateral (240 px, `--fundo-lateral`): item ativo com `--superficie-3` e texto em peso 500; contadores em `--fs-legenda`.
- Abas de página (`.subnav`) e de painel (`.abas`, `.abas-lat`): sublinhado de 2 px em `--texto` no ativo.
- Etapas de assistente (`.passos`): número em círculo e rótulo, linha entre etapas; a atual em `--acento`, as feitas com marca de conferido.
- Barra inferior no celular com os mesmos destinos do menu.

### Superfícies e listas

- Cartão (`.bloco` e similares): `--superficie`, borda `--borda`, raio 10 px, 20–24 px de respiro. Não aninhar cartão dentro de cartão: dentro, use divisórias.
- Linha de lista: 12–16 px de respiro vertical, divisória `--borda`, hover `--superficie-2` quando a linha inteira é clicável.
- Chip (`.chip`): 12 px, raio 4 px, `--superficie-2`; variantes de status com texto e cor de fundo suave.

### Carregamento e vazios

- Tela abrindo: `esqueleto()` de `ui.js` desenha o título real e blocos cinza na forma do conteúdo (NN/g: esqueleto para carga de página inteira). Nunca "Carregando…" sozinho.
- Ação longa (IA, transcrição): indicador no próprio botão; acima de 10 s, progresso com etapa ("Transcrevendo parte 2 de 6").
- Estado vazio (`.vazio-estado`): o que vai aparecer aqui, por que está vazio e um botão para começar. Uma ação só.

### Mensagens

- Toast (`#toast`): confirmação curta em `--texto` com o mesmo verbo do botão ("Salvar" → "Salvo"), com "Desfazer" quando a ação apaga ou substitui.
- Aviso em linha (`.aviso`, `.erro-ia`): ícone, o que houve, o que fazer, e o botão do próximo passo.
- Modal só para decisão que interrompe de propósito (confirmar, formulário curto). Título com verbo, botão principal à direita.

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
