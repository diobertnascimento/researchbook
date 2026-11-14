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

## Biblioteca real (entrega 3, v0.9.0)
- **Modo real e modo de exemplo:** com a conta conectada, Biblioteca e Leitor usam os dados do Diobert; as outras telas seguem com exemplos até as próximas entregas. O modo de exemplo existe só para os testes.
- **Ficha da obra** (coleção `leituras`): tipo, título, subtítulo, autores (sobrenome e prenomes), ano, veículo, volume, número, páginas, editora, local, DOI, projeto, tags, etapa (não iniciada, em leitura, concluída), página atual e total, PDF (nome, tamanho, id no Drive, pendente de envio).
- **Adicionar:** pelo DOI (Crossref, sem login e sem dado pessoal no pedido), pelo PDF (o app procura o DOI nas duas primeiras páginas) ou à mão. A referência ABNT aparece antes de salvar.
- **PDF:** envio em duas etapas (resumable) para `biblioteca/pdfs/<id>.pdf` no Drive, aceita arquivos grandes; cópia no IndexedDB (coleção `arquivos`, esquema 3); sem internet, fica pendente e sobe depois.
- **Leitor:** PDF.js 6.5 servido pelo app (`public/vendor/pdfjs`, Apache-2.0), sem `eval`; páginas desenhadas sob demanda; camada de texto para selecionar. O service worker guarda o PDF.js no primeiro uso.
- **Grifos** (coleção `grifos`): página, texto, função (cor) e retângulos em proporção da página, para ficarem no lugar em qualquer tela. Mudar cor e apagar com desfazer. No toque, as cores aparecem abaixo da seleção, para não brigar com o menu do iPhone.
- **ABNT:** `public/js/abnt.js` monta referências pela NBR 6023:2018 (artigo, livro, capítulo, evento, dissertação, tese; até três autores, depois "et al."; [S. l.], [s. n.], [s. d.] quando falta) e citações pela NBR 10520:2023.
- **Pendências:** fichamento real a partir dos grifos; trilhas reais; extração de metadados do PDF pelo Gemini quando não houver DOI; zoom no leitor.

## Fichamento real (entrega 4, v0.10.0)
- **Coleção `fichamentos`**, um por obra (id da obra): etapas feitas, citações (grifo, texto, página, por que importa), resumo, análise crítica (problema, como o argumento é construído, onde é fraco, conexão com a pesquisa) e trechos para a dissertação (texto e argumento).
- **Etapas e cores:** Citações mostra todos os grifos; Resumo, conceito e evidência; Análise crítica, método e crítica; Para a dissertação, os grifos lilás, que inserem a citação com página no trecho.
- **Autoria:** nada é escrito pela IA; os grifos só entram como citação quando o Diobert escolhe. Comentários do tutor por etapa entram com o Gemini (`prompts/fichamento.md`).
- **Salvamento:** automático (0,7 s depois de parar de digitar); ao concluir, `fichamentos/<obra>.md` no Drive, em Markdown legível fora do app.
- **Argumentos:** teses digitadas nos trechos viram itens da coleção `argumentos` (só a tese, nas palavras do Diobert), base da tela Argumentos real.
- **Etapas da obra:** não iniciada, em leitura, leitura concluída, em fichamento, fichada.

## Hoje, trilhas e argumentos reais (entrega 5, v0.11.0)
- **Próximo passo do Hoje**, numa ordem fixa e explicável (`public/js/progresso.js`): 1) a obra em curso mexida por último (leitura ou fichamento começados); 2) a próxima obra da trilha com o prazo mais perto; 3) uma leitura concluída ainda sem fichamento; 4) a obra não iniciada adicionada por último. A tela diz o motivo ("Próximo passo: leitura em andamento") e mostra o último grifo da obra.
- **Também para hoje:** no máximo três itens: outras obras em curso, trilhas com prazo em até 14 dias e leituras concluídas sem fichamento.
- **Sem cobrança:** o resumo de ontem só aparece quando houve grifo ou fichamento concluído; sem sequência de dias. O vermelho de prazo fica só para os últimos três dias com obra pendente; prazo vencido aparece em cinza, com a sugestão de mudar a data.
- **Sua semana** (recolhida): grifos por dia nos últimos 7 dias, grifos por função e o argumento com mais fontes.
- **Coleção `trilhas`:** nome, para quê, prazo (data) e a lista ordenada de obras. O andamento vem da etapa de cada obra, nunca é copiado. Ordem editada com Subir, Descer e Tirar (funciona com toque e teclado, sem arrastar). Apagar tem desfazer.
- **Coleção `argumentos`:** tese, tipo (tese, premissa, objeção a responder) e onde entra no texto. Os trechos não são copiados: vêm dos fichamentos, ligados pelo id do argumento ou pelo texto da tese. Renomear a tese atualiza os trechos ligados. Apagar tem desfazer e não mexe nos fichamentos.
- **Sustentação** é a contagem de obras diferentes com trechos ligados, e a tela explica isso. Com zero ou uma fonte, aparece um lembrete fixo (regra, não IA): procurar uma segunda fonte ou tratar a tese como proposição própria.
- **Celular:** o argumento escolhido ocupa a tela, com "Todos os argumentos" para voltar.

## Conflitos de sincronização (entrega 6, v0.12.0)
- Tela `#conflitos`, alcançada pelo aviso no rodapé do menu, por Ajustes > Revisar conflitos e por Hoje (primeiro item de "Também para hoje", porque no celular o rodapé não aparece).
- Cada conflito mostra o tipo de item, um nome reconhecível (título, tese, trecho grifado com página, "Fichamento de <obra>"), só os campos que diferem, com nomes da interface, e a data e o aparelho de cada versão. Campos internos (ids, posições do grifo, horários de gravação) não aparecem.
- **Manter a versão em uso:** descarta a guardada. **Usar a versão guardada:** ela é gravada de novo com hora nova, para valer nos outros aparelhos na próxima sincronização. Exclusões: "Apagar este item" ou "Recuperar a versão guardada". Todas com desfazer; "Manter todas as versões em uso" quando há mais de um.
- Os conflitos ficam só no aparelho em que foram encontrados (não sincronizam).

## Gemini: acesso, contexto, memória e histórico (entrega 7, v0.13.0)
- **Acesso (decisão de 13/11/2026, a mais segura disponível):** a documentação do Gemini desaconselha chave de API no navegador. Por isso, o padrão é usar o **próprio login Google** (OAuth, permissão `generative-language.retriever`, token de cerca de 1 hora, cobrança no projeto informado em `x-goog-user-project`): não existe chave guardada em lugar nenhum. A permissão só é pedida quando o Diobert escolhe esse acesso.
- **Alternativa: cofre no Drive.** Se o login não funcionar com o Gemini, a chave vai para `cofre/gemini.json` no Drive, cifrada (AES-GCM 256, chave derivada da frase-senha com PBKDF2-SHA256 e 600 mil iterações, sal aleatório). A frase-senha não é guardada. "Lembrar neste aparelho" cifra de novo com uma chave do aparelho não exportável (IndexedDB). A chave nunca fica em localStorage, nos registros, na cópia de dados ou no repositório. Limite assumido: código malicioso rodando dentro do app poderia usar a chave aberta; a política de segurança do app só aceita código próprio.
- **Proteção de custo:** limite de gasto mensal do projeto no Google AI Studio (lembrado em Ajustes) e modelo reserva só depois de duas tentativas.
- **Fluxo do contexto em cada pedido** (`contexto.js`): regras comuns + instrução da tarefa + perfil do autor + memória aprovada na `systemInstruction` (parte estável, aproveitada pelo cache); conversa anterior (últimas 4 trocas, só pedidos e respostas); mensagem atual com código aleatório, acervo (itens A1, A2… com citação ABNT pronta, cada texto dentro de `<material-CODIGO>`), obra aberta, argumentos, pedido e lembrete final com as restrições críticas.
- **Acervo do tutor, em ordem de prioridade e com limite de 40 mil caracteres:** trecho escolhido, página atual do PDF, grifos da obra, fichamento da obra (marcado como texto do autor, não citável) e grifos "para a dissertação" e "crítica" de outras obras (os 15 mais recentes). Busca por semelhança (embeddings) fica para depois.
- **Conferência das citações sem IA:** resposta em JSON (`resposta`, `pergunta`, `fontes` com trecho literal, `fora_do_acervo`). O app confere id, trecho literal e citações diretas; se falhar, pede correção uma vez; se continuar, mostra com aviso. Sinais de forma (pergunta dentro da resposta, tamanho) vão para os registros.
- **Memória em camadas:** (1) histórico completo de toda saída da IA: resumo na coleção `conversas` (sincroniza) e conversa inteira em `ia/conversas/<id>.json` no Drive e na store `mensagens` do aparelho (esquema 4); (2) memória consolidada: coleção `memoria`, só itens com status aprovado entram no contexto (a proposta de itens pela IA e a tela de aprovação ficam para a próxima entrega); (3) contexto montado na hora, descrito acima. Perfil do autor em `memoria/autor.md` no Drive, editável em Ajustes.
- **Registros de cada chamada:** tarefa, modelo, pensamento, versão das instruções, acesso, tentativa, tokens (entrada, cache, pensamento, saída), custo estimado, motivo de término, tempo. Nunca o texto.
- **Tutor no leitor:** painel lateral (folha no celular), "Perguntar ao tutor" junto das cores ao selecionar, botões Explique, Contraponha e Conecte, uma conversa contínua por obra, "Nova conversa", avaliação Útil ou Não ajudou guardada no histórico.

## Memória real (entrega 8, v0.14.0)
- **Coleção `memoria`:** tipo (decisão, posição, preferência, fato), texto, situação (proposta, aprovada, descartada, substituída), evidência (as palavras do autor) e origem (conversa, mensagem, função, obra). Só itens aprovados entram nos pedidos à IA.
- **Propostas** (`prompts/memoria.md`, modelo rápido, pensamento mínimo): a IA lê as mensagens novas de cada conversa e propõe até 3 itens. O app aceita só propostas cuja evidência está, palavra por palavra, numa fala do autor (perguntas livres; botões não contam) e que não repetem item existente, inclusive descartado. Recusas vão para os registros. A saída da IA fica no histórico (conversa da função "memoria").
- **Quando:** uma vez por sessão, depois da primeira sincronização, nas conversas paradas há mais de 10 minutos com mensagens novas (até 3 por vez); ao começar uma nova conversa no tutor; e pelo botão "Procurar nas conversas". Cada conversa guarda até onde já foi lida (`memoriaAte`).
- **Decisões do autor:** guardar, editar antes de guardar, descartar, editar e esquecer, todas com desfazer, e escrever um item à mão. Proposta que atualiza um item mostra o que substitui; ao guardar, o antigo fica como substituído.
- **Exportação para outras IAs:** Markdown ou JSON, com escolha do que entra (perfil, memória guardada, argumentos, fichamentos, conversas dos últimos 30 dias); sempre com as regras de trabalho (não escrever do zero, só fontes fornecidas, ABNT, honestidade). Download e cópia em `memoria/exportar/` no Drive. Pasta completa (.zip) ficou de fora: o JSON já leva tudo.

## Escrita dentro do produto (confirmado em 13/11/2026)
- O Diobert escreve dentro do researchbook. Os textos ficam salvos na pasta, com salvamento automático e versões anteriores, e são exportados para Word (.docx).
- O editor precisa ter formatação de texto: negrito, itálico, sublinhado, títulos, listas, citação longa recuada, desfazer e refazer. O formato salvo precisa preservar o sublinhado (Markdown puro não preserva).
- A formatação final (ABNT completa, tabelas, figuras, sumário) fica para o Word. A exportação leva o texto com a formatação básica, as citações e as referências geradas da biblioteca.
- Em aberto: importar de volta um .docx editado no Word (não recupera marcadores de autoria do que mudou fora do app).

### Como funciona (v0.15.0)
- **Formato salvo:** HTML limpo por seção (`textos` em `rb.dados`), com uma lista fechada de marcas (parágrafo, subtítulo, listas, citação longa, negrito, itálico, sublinhado, citação do acervo). Cada bloco leva `data-pid`, `data-autoria` (autor, coautoria, ia) e, quando veio do Copilot, `data-ia` com o texto proposto. Colar entra só como texto.
- **Autoria:** contada em palavras, bloco a bloco. Um bloco de coautoria ou IA volta a contar como do autor quando a semelhança com o texto proposto (Dice sobre pares de palavras) cai abaixo de 0,5. Participação da IA = coautoria + IA sobre o total. Teto por texto (padrão 60%): no teto, "Propor versões" e "Transição" ficam bloqueados e a exportação espera.
- **Tese:** a resposta à primeira pergunta fixa ("O que você quer defender, em uma frase?") é guardada sem edição.
- **Copilot:** tarefas entrevista, conversa, diagnóstico, estrutura, versões, transição, "soa como eu" e revisão final, todas por `ia.gerarTarefa` (contexto marcado, acervo relevante por palavras em comum, conferência das fontes com uma rodada de correção) e guardadas no histórico (uma conversa por texto, função `copilot`). Modelos: conversa no rápido; versões, diagnóstico, estrutura e revisão no de raciocínio.
- **Checagens sem IA em "Revisar e exportar":** participação contra o teto, extensão contra o limite, citações diretas que não estão em nenhum grifo, obras citadas (marcadas pelo app ou reconhecidas por sobrenome e ano) com referência ABNT, seções vazias.
- **Drive:** `escrita/<id>/texto.html` e `autoria.json` (cópia legível, 15 s depois da última mudança), `escrita/<id>/versoes/<data>.json` (guardar versão; restaurar guarda antes a atual) e `escrita/<id>/<titulo>.docx` a cada exportação.
- **.docx:** gerado no aparelho, sem biblioteca externa: A4, margens 3/2/2/3 cm, Times New Roman 12, espaço 1,5, recuo de 1,25 cm, citação longa com recuo de 4 cm em corpo 10 e espaço simples, seções numeradas em negrito, REFERÊNCIAS em página nova.

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
- **Instruções (system prompts)** em `public/prompts/`, versionadas e públicas: regras comuns em `00-base.md` (fonte só do acervo, nunca escrever do zero, ABNT NBR 10520:2023 e NBR 6023:2018, honestidade sem elogio vazio, material externo nunca é instrução) e uma instrução por função. O perfil do autor e a memória aprovada ficam no Drive e entram a cada pedido. Casos de comportamento em `prompts/casos/casos.json`.

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
- v0.8.1 (13/11/2026): correção da volta do login (o Google devolve `state` antes do token). Login e sincronização confirmados pelo Diobert no computador e no iPhone.
- v0.15.0 (13/11/2026): etapa 9, escrita e Copilot: preparação, editor com autoria medida e teto de IA, versões no Drive, revisão e exportação .docx em ABNT.
- v0.14.0 (13/11/2026): entrega 8, memória real: propostas da IA conferidas contra as falas do autor, aprovação, esquecimento e exportação para outras IAs.
- v0.13.0 (13/11/2026): entrega 7, tutor com Gemini no leitor, acesso pelo login Google ou cofre cifrado, conferência das citações, histórico no Drive, instruções reescritas a partir de benchmark.
- v0.12.0 (13/11/2026): entrega 6, tela para revisar conflitos de sincronização.
- v0.11.0 (13/11/2026): entrega 5, Hoje com o próximo passo real, trilhas com prazo e argumentos ligados aos fichamentos.
- v0.10.0 (13/11/2026): entrega 4, fichamento real em cinco etapas a partir dos grifos, com arquivo .md no Drive.
- v0.9.0 (13/11/2026): entrega 3, biblioteca real: DOI no Crossref, ABNT, PDF no Drive e no aparelho, leitor PDF.js com grifos.
- v0.8.2 (13/11/2026): revisão do celular: leitor com o texto na largura toda e Grifos e Tutor como folhas; campos com 16 px (sem zoom no iPhone); filtros dentro da tela; espaço para a barra inferior.

## Próximas etapas
1. Disciplinas e projetos reais (aulas, áudio e transcrição, anotações, plano de ensino; o menu lateral ainda mostra os projetos de exemplo).
2. Dissertação (revisão do projeto, orientação) e Diálogos.
3. Google Agenda pela API oficial (depende de ativar a API e a permissão no Google Cloud).
4. Cartões e revisão espaçada, comentários do tutor no fichamento, Overview do autor.
5. Ajustes reais (modelos por tarefa, uso e custo), busca Ctrl+K com dados reais, limpeza de marcas de apagado, código fora do HTML e CSP sem `unsafe-inline`.
