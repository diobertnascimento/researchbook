# researchbook: decisões de produto

Ferramenta pessoal de estudo e escrita do mestrado. App web instalável (PWA), usado em dois computadores e no celular, com os dados no Google Drive do Diobert. Foco principal na dissertação, mas também atende as disciplinas.

## Princípios
- **Duas IAs, duas instruções.** Tutor (cerca de 70% do produto): coach ativo nos estudos, leituras e fichamentos; pergunta, provoca, aponta lacunas, não escreve. Copilot: ajuda ativamente na escrita, entrevista, propõe versões do que o autor escreveu ou disse e constrói junto. Nenhum dos dois escreve do zero.
- **Grounding no acervo.** Só se cita o que está na biblioteca, a partir de grifo ou fichamento, com página. A IA pode sugerir obras fora do acervo, mas pede que o Diobert busque e adicione; até lá, não cita.
- **Voz do autor.** Aprendida com as interações e com um conjunto de textos do Diobert; exposta no Overview do autor.
- **ABNT sempre.**
- **Autoria rastreada fora do texto.** Cada trecho é marcado como Seu, Coautoria (versão do copilot editada) ou IA. Os marcadores ficam no produto, nunca no texto exportado. Cada texto tem um teto de participação da IA (exemplo citado: 60%; tratado como teto, a confirmar).

## Diretrizes de design (benchmark de 13/11/2026)
Base: 10 heurísticas e artigos da Nielsen Norman Group, princípios e barras laterais do Apple HIG, modelo de Fogg e modelo Hooked de Nir Eyal. Documento completo: "researchbook: benchmark de usabilidade e diretrizes de design" (Claude Docs).
- **Uma ação principal por tela.** Um botão primário; o resto sob demanda, a no máximo um nível de distância (revelação progressiva, máximo de dois níveis).
- **Navegação visível e curta.** Três áreas (Hoje, Biblioteca, Escrita) + Projetos (Dissertação e cada disciplina) + Você no rodapé (Overview do autor, Memória, Ajustes). Abas internas para o resto. Menu nunca escondido por padrão; modo foco é opcional.
- **Ícone sempre com rótulo em texto.** Contadores e selos só se fariam falta.
- **Wizard só para o que é raro.** A preparação do texto acontece uma vez; texto em andamento abre direto no editor.
- **Ajuda no contexto, sem tutorial.** Explicações fixas viram "Como ... funciona?" recolhido.
- **Status sempre visível.** Salvamento, fim de sessão, erros com o próximo passo; desfazer em ações destrutivas.
- **Atalhos para uso diário.** Ctrl+K busca tudo; F e Esc no leitor.
- **Laço de hábito ético.** Gatilho (Hoje mostra um próximo passo) → ação pequena (continuar do parágrafo exato, 3 cartões) → recompensa variável (pergunta do tutor, conexão nova) → investimento (grifos e fichamentos geram os cartões e o passo de amanhã) + celebração no fim da sessão. Sem sequência de dias que pune falhas, sem notificações, sem urgência falsa.

## Armazenamento e acesso (decisão de 13/11/2026: caminho B)
- O researchbook vira um app web instalável (PWA), servido por HTTPS no GitHub Pages, usado nos dois computadores e no celular. Substitui o HTML aberto direto do computador.
- Dados numa pasta `researchbook/` no Google Drive, acessada pela API do Drive com login Google (escopo `drive.file`: o app só enxerga o que ele mesmo criou). Cópia local no IndexedDB para funcionar sem internet; sincroniza quando a conexão volta. Conflitos de edição em dois aparelhos: guarda as duas versões e pergunta.
- A chave da API do Gemini fica no navegador de cada aparelho, fora do Drive.
- O plano do Google do Diobert cobre o espaço para os áudios das aulas.
- Pessoal e separado de qualquer trabalho: não usar em equipamentos ou contas de empregadores.
- Disciplinas: `disciplinas/<nome>/{aulas/<data>/{audio, transcricao.md, resumo.md, anotacoes.md}, agenda.json, anotacoes.md}`.
- Estrutura: `biblioteca/{pdfs,leituras}`, `fichamentos/`, `argumentos/`, `escrita/<texto>/{texto, autoria.json, entrevista.md, versoes/}`, `dialogos/`, `orientacao/<encontro>/`, `projeto/`, `disciplinas/`, `cartoes/`, `memoria/{autor.md, decisoes.md, regras.md, conversas/, exportar/}`, `registros/<data>/sessao-<hora>.jsonl`. Dados em JSON; textos em formato legível fora do app. Esquema versionado, com migração automática e backup antes de migrar.

## Código, testes e atualizações (13/11/2026)
- Código num repositório **público** no GitHub, na conta do Diobert, publicado no GitHub Pages (decisão de 13/11/2026: concentrar tudo no GitHub, sem Cloudflare). Só código e dados de exemplo genéricos; nenhum dado pessoal nem nome de pessoa real.
- `CLAUDE.md` com as regras do projeto para o Claude Code; `CHANGELOG.md` com o que muda em cada versão.
- Testes automáticos (Playwright) percorrem todas as telas no computador (1440 px) e no celular (390 px): sem erro de JavaScript, sem tela vazia, com título e sem rolagem lateral; mais busca, modo foco, abas da disciplina e grifo.
- GitHub Actions testa a cada envio; só a `main`, com testes passando, é publicada. Não há prévia por branch: mudanças visuais vão para o pull request com capturas de tela no computador e no celular.
- Fluxo: pedido ao Claude Code → branch → testes → pull request com capturas → o Diobert confere e junta → publicação.
- Custo: zero (GitHub Free, GitHub Pages, APIs do Google). O GitHub Free não bloqueia juntar PR com teste falhando; a regra é juntar só com tudo verde.
- Versão do app (`APP_VERSAO`) aparece no app e vai em cada registro.

## Escrita dentro do produto (confirmado em 13/11/2026)
- O Diobert escreve dentro do researchbook. Os textos ficam salvos na pasta, com salvamento automático e versões anteriores, e são exportados para Word (.docx).
- O editor precisa ter formatação de texto: negrito, itálico, sublinhado, títulos, listas, citação longa recuada, desfazer e refazer. O formato salvo precisa preservar o sublinhado (Markdown puro não preserva).
- A formatação final (ABNT completa, tabelas, figuras, sumário) fica para o Word. A exportação leva o texto com a formatação básica, as citações e as referências geradas da biblioteca.
- Em aberto: importar de volta um .docx editado no Word (não recupera marcadores de autoria do que mudou fora do app).

## Memória
- Três camadas: (1) conversas, registro completo; (2) memória consolidada, curta, só com itens aprovados pelo Diobert; (3) contexto de cada pedido, montado na hora a partir de 1 e 2 e do material aberto.
- A IA propõe o que quer lembrar; o Diobert aprova, edita ou descarta. Pode esquecer itens (com desfazer).
- Exportação para outras IAs: Markdown único, JSON ou pasta completa, com escolha de escopo.

## Funcionalidades (organização da v0.4)
- **Hoje:** um próximo passo, até 3 itens do dia, "Sua semana" recolhida. Cartões abrem daqui como sessão curta, com tela de sessão concluída.
- **Biblioteca** (abas Leituras, Trilhas, Fichamentos): filtros em menus por projeto, etapa, disciplina, conceito e tag; busca por DOI (Crossref). Trilhas mostram leituras em aberto; concluídas recolhidas. Fichamento guiado em 5 etapas (Referência, Citações, Resumo, Análise crítica, Para a dissertação).
- **Leitor:** leitura limpa ou PDF original e tema claro ou sépia no menu "Aa"; botões Grifos, Tutor e Foco com rótulo; painel de grifos fechado por padrão; ao grifar, cada cor mostra sua função: Conceito (amarelo), Evidência (verde), Método (azul), Crítica (salmão), Para a dissertação (lilás).
- **Escrita** (abas Textos, Diálogos): preparação em 4 etapas só ao criar (Enquadrar, Ideia, Diagnóstico, Estrutura); depois o texto abre no editor, com Briefing e "Revisar e exportar". Editor: seções à esquerda; à direita, abas Copilot e Material da seção; marcadores de autoria desligados por padrão, medidor de IA sempre visível. Diálogos nos modos Contraponto, Socrático e Alinhamento.
- **Dissertação** (abas Revisão do projeto, Orientação, Argumentos): prioridade alta aberta, média e baixa recolhidas; último encontro de orientação completo e os anteriores resumidos; argumentos com sustentação escrita (forte, média, fraca).
- **Disciplinas como central** (v0.5): cada disciplina tem abas Visão geral, Aulas, Leituras, Textos e Agenda; "Projetos" lista Dissertação e disciplinas.
  - **Aulas:** o Diobert envia a gravação; o Gemini transcreve, resume, identifica conceitos e leituras citadas (as de fora da biblioteca viram sugestão "Vou buscar") e pode criar cartões. A transcrição tem marcação de tempo que leva ao ponto do áudio e é grifável com as mesmas cores. Cada aula tem abas Transcrição, Resumo e Suas anotações (anotações dele ficam separadas da transcrição).
  - **Anotações da disciplina:** notas rápidas na visão geral.
  - **Agenda:** aulas (recorrentes), entregas, sessões de estudo e encontros de orientação. Tudo o que é agendado vai para o Google Agenda, numa agenda separada chamada researchbook; alterar ou apagar no app altera ou apaga lá.
- **Você** (abas Overview do autor, Memória, Ajustes).

## IA: modelos por tarefa (pesquisa de 13/11/2026)
Preços da página oficial do Gemini API em 13/11/2026, por milhão de tokens. Dois são promocionais: Gemini 4 Argon passa de US$ 2/10 para US$ 4/20 em 1/12/2026; Gemini 3.8 Flash passa de US$ 0,75/3,75 para US$ 1,50/7,50 em 1/1/2027.
- **Raciocínio, `gemini-4-argon`:** Copilot (versões do parágrafo, diagnóstico e estrutura), Revisar e exportar, Revisão do projeto (em lote). Reserva: `gemini-3.1-pro-preview`.
- **Conversa, `gemini-3.8-flash`:** Tutor (conversa, perguntas antes de ler, comentários no fichamento), Diálogos, entrevista do copilot, resumo de aula, orientação, plano de ensino, Overview do autor (em lote). Reserva: `gemini-3.6-flash`.
- **Rápidas, `gemini-3.1-flash-lite`:** cartões (em lote), metadados do PDF, proposta de memória. Reserva: `gemini-3.5-flash-lite`.
- **Áudio, `gemini-3.5-transcribe`:** aulas e orientação (separa vozes e marca tempo; cerca de US$ 0,50 por aula de 100 min). Alternativa econômica: `gemini-3.1-flash-lite` (cerca de US$ 0,12 por aula, sem garantia de vozes e tempos).
- **Busca, `gemini-embedding-2`:** busca semântica e conexões entre leituras, aulas e memória.
- Nível de pensamento por tarefa (mínimo, baixo, médio, alto); lote (metade do preço) para o que não é urgente; cache de contexto para o artigo aberto no tutor.
- Estimativa com uso típico (220 mensagens ao tutor, 40 versões do copilot, 12 aulas por mês): cerca de US$ 13/mês hoje, US$ 17 em dezembro e US$ 20 a partir de janeiro. A transcrição é cerca de um terço do custo.
- Os modelos podem ser trocados por tarefa em Ajustes.

## Uso, custo e registros
- **Uso e custo (Ajustes):** gasto no mês, projeção, tokens e minutos de áudio, custo por dia, custo por tarefa e modelo, limite mensal com aviso em 80%, cotação do dólar definida pelo Diobert, tabela de preços com datas de mudança.
- **Registros:** todo evento vira uma linha (interface, IA, arquivos, agenda, erros, avaliações de resposta, bloqueios de citação fora do acervo). Na IA: tarefa, modelo, pensamento, tokens (entrada, cache, pensamento, saída), tempo, custo, tentativa, modelo reserva. Gravados em `registros/<data>/sessao-<hora>.jsonl` a cada 10 s e ao fechar, um arquivo por sessão, mantidos por 180 dias. Por padrão não guardam o texto de prompts e respostas (só tamanhos e tempos); dá para ligar. Exportação CSV.
- Respostas do tutor podem ser marcadas como "Útil" ou "Não ajudou".

## Google Agenda (decidido em 13/11/2026)
- Tudo o que o Diobert agenda no researchbook é criado na conta Google dele, numa agenda separada chamada "researchbook"; alterar ou apagar no app altera ou apaga lá.
- Com o app servido por HTTPS, usa a API oficial do Google Agenda com o mesmo login Google do Drive. A ponte por Apps Script deixa de ser necessária.

## Status
- v0, v0.2 e v0.3 (13/11/2026): protótipo navegável com dados de exemplo; estrutura central aprovada pelo Diobert.
- v0.4 (13/11/2026): redesenho de usabilidade a partir do benchmark (navegação, revelação progressiva, laço de hábito).
- v0.5 (13/11/2026): disciplina como central (aulas gravadas com transcrição, agenda, anotações) e Google Agenda nos ajustes.
- v0.6 (13/11/2026): modelos por tarefa, uso e custo, registros. Ainda com dados de exemplo; nada é salvo.
- v0.6.0 (13/11/2026): projeto no GitHub com testes, CLAUDE.md e publicação automática no GitHub Pages. Os testes acharam e foi corrigida rolagem lateral no celular em Ajustes e no fichamento. Dados de exemplo sem nomes reais e com tema fictício (roteirizador de coleta seletiva, artigo sobre greenwashing, trabalho em grupo sobre ecoponto), porque o repositório é público.

## Próximas etapas
1. Subir o repositório no GitHub e ligar o GitHub Pages (passo a passo no README).
2. PWA: service worker, instalação e aviso "Nova versão disponível".
3. Login Google; pasta no Drive pela API; cópia local no IndexedDB; esquema versionado; registros por sessão desde o primeiro dia.
4. Upload de PDF e PDF.js com grifos ancorados por página.
5. Crossref (DOI) e geração ABNT.
6. Gemini: tutor e copilot com instruções separadas; análise do PDF do projeto; transcrição da orientação e das aulas; plano de ensino.
7. Google Agenda pela API oficial.
8. Memória em camadas e exportação.
9. Editor de escrita com formatação, salvamento automático, versões, marcadores de autoria e exportação .docx.
10. Revisão espaçada.
