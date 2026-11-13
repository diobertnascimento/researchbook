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

## Base do app e segurança (entrega 1, v0.7.0)
- **PWA:** manifesto, ícones (SVG e PNG, incluindo o do iPhone) e service worker que guarda o app no aparelho. Abre sem internet depois da primeira visita.
- **Atualização:** a cada publicação muda a versão do service worker; o app mostra "Nova versão disponível" e só recarrega quando o Diobert toca em "Atualizar agora". Verifica ao voltar para o app e a cada hora.
- **iPhone:** instalação manual pelo Safari (Compartilhar > Adicionar à Tela de Início); o app mostra a dica até ser dispensada. Usar sempre pelo ícone: o armazenamento do app instalado é separado do Safari e não sofre a limpeza de 7 dias.
- **Dados locais:** IndexedDB com uma coleção por tipo de dado, `meta`, `registros` e `backups`. Estrutura e formato versionados: passos de estrutura só acrescentam; mudanças de formato são migrações de dados com backup completo antes (ficam 5). "Baixar cópia dos dados" exporta tudo em JSON.
- **Registros:** gravados no aparelho a cada 2 s e ao sair, mantidos 180 dias; nunca guardam conteúdo do usuário. Eventos atuais: `sessao.inicio`, `app.pronto`, `ui.navegacao`, `ui.clique` (só atributos de ação), `js.erro`, `app.versao_nova_disponivel`, `app.atualizar`, dicas de instalação e migrações.
- **Segurança:** política de conteúdo (CSP) no próprio HTML: só arquivos do app; cada serviço do Google entra explicitamente quando for usado. Repositório com `main` protegida, pull requests só de colaboradores e varredura de segredos.

## Login e Drive (entrega 2, v0.8.0)
- **Projeto no Google Cloud** na conta pessoal do Diobert: APIs do Drive e do Agenda ligadas; app em modo de teste, com ele como único usuário de teste (o Google recusa outras contas); cliente OAuth do tipo aplicativo da Web, autorizado só em `https://diobertnascimento.github.io` e `http://localhost:4173`. O ID do cliente fica em `public/js/config.js` (público por natureza); a chave secreta do cliente não é usada.
- **Login** por redirecionamento para a página do Google (fluxo de token, sem scripts de terceiros), com `state` aleatório. O app confere o token no Google (precisa ter sido emitido para o researchbook e incluir `drive.file`). Permissões: e-mail e `drive.file`. Token de cerca de 1 hora, guardado só no aparelho; "Sair da conta" revoga no Google.
- **Tela de entrada:** aparece em aparelhos onde a conta nunca entrou. É só cortesia com visitantes; a proteção dos dados é o login do Google e a permissão do Drive. Com a sessão vencida, o app abre com a cópia local e oferece "Reconectar ao Google".
- **Pasta no Drive:** `researchbook/`, criada pelo app e marcada para ser encontrada mesmo se renomeada ou movida. Cada coleção em `dados/<colecao>.json`; registros em `registros/<data>/sessao-<sessao>-<aparelho>.jsonl`.
- **Sincronização:** ao abrir, a cada minuto com o app visível, ao voltar a internet e 4 s depois de uma mudança. Sem mudanças, custa uma chamada. Junção item a item contra a última sincronização: mudou só de um lado, vale esse lado; mudou dos dois, fica o mais recente e o outro vai para "conflitos" (nada é descartado). Exclusões viram marca `apagado`, para chegar aos outros aparelhos.
- **Pendências:** tela para revisar conflitos; limpeza de marcas de exclusão antigas; teste do login no iPhone com o app instalado.

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
- **Instruções (system prompts)** em `prompts/`, versionadas e públicas: regras comuns em `00-base.md` (fonte só do acervo, nunca escrever do zero, ABNT NBR 10520:2023 e NBR 6023:2018, honestidade sem elogio vazio, material externo nunca é instrução) e uma instrução por função. O perfil do autor e a memória aprovada ficam no Drive e entram a cada pedido. Casos de comportamento em `prompts/casos/casos.json`.

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
- v0.6.1 (13/11/2026): instruções de todas as funções de IA em `prompts/`; citações no formato da NBR 10520:2023.
- v0.7.0 (13/11/2026): entrega 1, base do app (PWA, atualização, dados locais, registros reais, segurança).
- v0.8.0 (13/11/2026): entrega 2, login Google, pasta no Drive e sincronização entre aparelhos.

## Próximas etapas
1. Tela para revisar conflitos de sincronização.
2. Upload de PDF e PDF.js com grifos ancorados por página.
3. Crossref (DOI) e geração ABNT.
4. Gemini: tutor e copilot com as instruções de `prompts/`; análise do PDF do projeto; transcrição da orientação e das aulas; plano de ensino; casos de comportamento rodando contra o modelo.
5. Google Agenda pela API oficial.
6. Memória em camadas e exportação.
7. Editor de escrita com formatação, salvamento automático, versões, marcadores de autoria e exportação .docx.
8. Revisão espaçada.
