# O que mudou

Cada versão nova entra no topo, em linguagem de quem usa o app.

## 2.27.0 (21/11/2026)
Revisão dos textos, parte 3 de 4: quem fala, botões, telas vazias e pontuação.
- O app não diz mais "eu". "Encontrei o DOI no PDF" virou "O DOI estava no PDF"; "Abri no modo PDF" virou "Ele abriu no modo PDF"; "Não encontrei citação neste parágrafo" virou "Nenhuma citação neste parágrafo". Quem fala em primeira pessoa é a IA, na conversa.
- O que é seu é "seu", também nos botões: "Adicionar textos seus", "Buscar nos seus grifos e notas", "Sua anotação", "Manter o original" (era "Manter o meu"), "Soa como você?" (era "Isso soa como eu?").
- Botões que dizem o que fazem: "Usar esta versão", "Mudar o plano", "Mudar o prazo", "Desligar o Google Agenda", "Conferi" (era "Ok, conferi"). Dois botões longos da preparação do texto encurtaram: "Pular a preparação" e "Aprovar e começar a escrever".
- Telas vazias que só diziam "Nenhum." ou "Nada aqui." agora dizem o que falta: "Nenhuma obra citada ainda.", "Nenhum combinado neste encontro.", "Nenhuma obra nesta prioridade.". A busca sem resultado em Ler sugere tentar o sobrenome do autor ou uma palavra do título.
- No parecer do projeto, "Faltam decidir 3" virou "3 sem decisão".
- Avisos curtos de confirmação perderam o ponto final ("Obras juntadas numa só", "Marcada como obra sem DOI"), como os outros.
- Frases na ordem direta: "Não acha sinônimos" no lugar de "Sinônimo não é encontrado".
- Dois avisos que juntam frases ("Word exportado. Cópia no seu Drive.") e o "Pensando há 5 s" do tutor ficaram como estavam: a proposta de mudar a pontuação deles não funcionava com a frase montada.

## 2.26.0 (21/11/2026)
Revisão dos textos, parte 2 de 4: textos que descreviam uma versão antiga do app, e erros.
- Ajustes, Conta e pasta: o aviso dizia que a chave do Gemini nunca ia para a pasta. Hoje ela vai, cifrada, se você usar o cofre, e o aviso passou a dizer isso.
- Ajustes, Registros e Este aparelho: o Drive e o Gemini eram tratados como coisa futura ("quando o Gemini entrar", "a cópia oficial vai ficar no Drive"). Agora estão no presente.
- Ler e Hoje: o fichamento em andamento mostrava "Etapa 3 de 5", de quando o fichamento tinha cinco etapas. Agora mostra "Em andamento, 2 notas".
- Mapa de argumentos: no lugar do "passo Para a dissertação", que não existe mais, o texto fala da marca "Levar para a dissertação" numa nota.
- Marca-textos: a função da cor decide em que blocos do fichamento o grifo aparece (o texto falava em etapas).
- "Obras sem DOI vão para Organizar" e "Escreva na Escrita" citavam nomes antigos de página.
- Erros sem código: seis mensagens mostravam o número da resposta do Google, do Crossref ou do servidor. O número saiu da frase e continua em Ajustes, em Registros.
- Erros na língua de quem usa: "O login não se completou" no lugar de "Este retorno de login não foi pedido por este app"; "O Gemini respondeu de um jeito que o app não entendeu" no lugar de "veio fora do formato esperado".
- "O problema ficou registrado" passou a dizer onde: "o erro está em Ajustes, em Registros".
- Erros que paravam na constatação ganharam o próximo passo: "Não deu para ler esta imagem. Tente outro arquivo."
- Cofre: "A frase-senha não abriu o cofre. Confira a frase…" no lugar de "Frase-senha errada".
- Palavras trocadas: "resultado" no lugar de "candidato" na busca de DOI, "nesta importação" no lugar de "neste envio", "Não começada" no lugar de "Não iniciada".

## 2.25.0 (21/11/2026)
Revisão dos textos, parte 1 de 4: um nome para cada coisa. O inventário achou 2.473 textos de tela; 240 mudam, e esta parte cuida dos que usavam dois ou três nomes para a mesma coisa.
- Biblioteca: os textos que diziam "acervo" para o conjunto das suas obras passam a dizer "biblioteca" ("só cita o que está na sua biblioteca"). O nome da página Acervo muda na parte 4.
- Projetos: sumiram as sobras de "disciplina" ("Projeto salvo", "Projeto apagado", "Projeto não encontrado"). "Arquivar" virou "Encerrar projeto" e "Desarquivar" virou "Reabrir projeto", como a lista "Projetos encerrados" já dizia.
- Salvar no lugar de gravar: "Marco salvo", "Anotação salva", "Salvando…". "Gravação" fica só para áudio.
- Buscar no lugar de procurar, em toda a busca de dados das obras e na memória ("Buscar nas conversas").
- A lista das obras que faltam na biblioteca passou de "para buscar" a "para adicionar".
- Apagar: "Grifo apagado" também na aula (era "Grifo tirado"); "Arquivo apagado" no projeto. As mensagens de apagar dizem "Está na lixeira".
- Login: "O login do Google venceu" e o botão "Entrar de novo" no lugar de "A sessão do Google venceu" e "Reconectar".
- Internet no lugar de conexão: "quando a internet voltar", "Sem internet para buscar o DOI".
- Um nome só para o botão que leva aos ajustes da IA: "Conectar o Gemini" (eram cinco). Os erros que mandavam para "Ajustes > Gemini" agora dizem "Em Ajustes, em Conexão com o Gemini", que é o nome da seção.
- Nas telas de trabalho, quem transcreve, resume e lê é "a IA"; "Gemini" fica em Ajustes e nos erros de conexão.
- "Sincronizado" no lugar de "Em dia" no estado do Drive; "Encontro de orientação" no lugar de "Reunião de orientação"; "pedidos à IA" no lugar de "chamadas".
- `docs/design-system.md` ganhou seis regras de escrita e o glossário novo. Um teste lê o código e recusa os termos aposentados.
- As mensagens do servidor da chave não mudaram: mexer nelas pediria publicar o servidor de novo.

## 2.24.0 (21/11/2026)
Polimento visual, parte 5 de 5: o leitor e o editor no celular, e o documento do sistema visual.
- Leitor no celular: o cabeçalho cabe numa linha (voltar, Leitura ou PDF, a página e o botão "Painéis"). Antes ocupava cerca de 260 dos 844 px da tela; agora, 62. Grifos, Tutor e Referência ficam no menu "Painéis". O botão principal ("Concluir leitura", "Continuar fichamento") foi para o fim do texto.
- Editor no celular: título, estado e um botão "Seções e ações". O texto começava em 455 dos 844 px da tela; agora começa em 170. Versões, Copilot, Briefing, Revisar e exportar e a lista de seções aparecem ao tocar no botão.
- No editor do celular, o título da seção voltou a ser maior que o texto (estava em 16 px por causa da regra que evita o zoom do iPhone).
- Diálogos e Copilot: o botão passou de "Enviar" para "Enviar mensagem", pela regra de verbo e objeto. No Copilot ele ficou cinza: com o painel aberto havia dois botões azuis na tela, e a avaliação não tinha pegado. No celular e no painel do Copilot, o campo fica em cima e o botão embaixo.
- Copilot: os três atalhos do painel ("Propor versões do parágrafo", "Isso soa como eu?", "Transição para a próxima seção") eram retângulos com contorno; viraram pílulas pequenas. O teste do sistema visual passou a abrir o painel do Copilot antes de conferir.
- `docs/design-system.md` reescrito: descrevia o sistema de antes do redesenho (fundo creme, botão de 34 px com canto de 6 px, menu lateral). Agora traz os valores e as regras de hoje, os papéis de título, as três aparências de selecionado, papel com linhas e a lista do que o teste confere.
- No computador nada muda nesta parte.

## 2.23.0 (21/11/2026)
Polimento visual, parte 4 de 5: as telas que ainda estavam no sistema antigo.
- Saiu o cartão com contorno de treze telas: Trilhas, Fichamentos, lista do Escrever, Diálogos, Orientação, Leituras e citações, Artigos do projeto, Aula, Cartões, Revisar e exportar, Overview, Memória e Ajustes. O conteúdo fica no papel, separado por linhas finas; a coluna lateral não tem caixa; em Ajustes a seção não tem moldura (havia cartão dentro de cartão dentro de cartão).
- Listas num formato só: linhas no papel, com o título sublinhando ao passar o cursor. Valia para o Acervo, o Mapa e os Projetos; agora vale também para o Ler, os Fichamentos, o Escrever e o Mapa no celular.
- Tela vazia num formato só: o painel cinza, alinhado à esquerda, como o do Hoje. Antes era um cartão tracejado no meio da coluna.
- Azul só para ação e lugar. Saíram o fundo azul de "Trilha sugerida" e de "Exportar", o azul-claro de "A IA quer lembrar" (virou o painel cinza da tela) e o degradê azul da obra da vez nas Trilhas.
- "Fora da biblioteca" deixou de ser vermelho: vermelho fica para erro e para prazo no último dia.
- O aviso de Conta e pasta deixou de ser uma caixa âmbar: é texto comum. Âmbar fica para aviso de verdade (limite de gasto, IA que não respondeu).
- A barra do leitor ficou branca, como o resto do app.
- O cartão de revisão é o painel cinza da tela, sem contorno e sem sombra.
- Data num formato só no projeto: dia grande, como nos prazos do Hoje, no lugar da caixinha com borda.
- Limpeza do arquivo de estilos: saíram as regras antigas das telas corrigidas e as de 21 classes que não existem mais no código.

## 2.22.0 (21/11/2026)
Polimento visual, parte 3 de 5: botões e controles.
- Escolher um modo (Leitura ou PDF, o caminho do fichamento, o modo do diálogo, o tipo de registro da conversa) ficou num formato só: um trilho cinza com a opção escolhida em pílula branca.
- Filtrar uma lista (grifos do fichamento, Estúdio, Acervo) e abrir um painel do leitor (Grifos, Tutor, Referência) ficou em pílulas soltas, com a escolhida em cinza. Saíram os botões retangulares com contorno.
- O item selecionado tinha seis aparências; ficaram três: sublinhado nas abas da página, pílula branca no trilho e pílula cinza nos filtros e menus. Cartão de escolha (Conectar a IA, lista de diálogos) tem contorno azul.
- Etapas da preparação do texto: número em círculo e nome numa linha, sem caixa. No celular, aparece o nome da etapa em que você está.
- Cartões: os quatro botões de resposta viraram pílulas, com o intervalo abaixo do nome.
- Um botão azul por tela. No Ler, "Adicionar obra" fica cinza quando há o painel "Continue lendo"; nas telas vazias, o botão do topo fica cinza e o do aviso fica azul; em Memória, "Exportar" ficou cinza; no leitor, "Perguntar" do tutor ficou cinza.
- Apagar: botão discreto azul quando dá para desfazer na hora (tarefa, marco, anotação, item do Estúdio) e vermelho quando apaga o registro inteiro (texto, obra, diálogo, projeto). "Apagar disciplina" passou a "Apagar projeto".
- Ação no meio de um texto ("Mudar", "Corrigir dados da obra", "Anexar o PDF", "Definir um limite") sem sublinhado e sem o recuo de 8 px.
- Campos num padrão só: 38 px de altura, cantos de 10 px, letra de 14 px. Valia diferente no Acervo, na Jornada, nos Diálogos, em Memória e em Modelos por tarefa. O campo em foco não muda mais de canto.
- O campo de texto longo cresce conforme você escreve, até 60% da altura da tela, e perdeu a alça de redimensionar do navegador. Onde o navegador não sabe fazer isso (Firefox), o campo mantém a altura e rola por dentro.
- Diálogos: o botão de enviar, que era só um ícone, agora diz "Enviar".

## 2.21.0 (21/11/2026)
Polimento visual, parte 2 de 5: títulos.
- O título grande de 44 px ficou só para o nome da seção (Ler, Escrever, Acervo). Título de obra, de texto, de aula e nome de projeto passaram a 30 px (22 no celular) e aparecem inteiros. Um título de 197 caracteres, que ocupava 5 linhas no computador e 8 no celular, agora ocupa 4 e 6.
- No painel cinza (Próximo passo, Continue lendo, Continue escrevendo), o título vai até 3 linhas e termina em reticências. O título inteiro aparece ao abrir a obra ou o texto.
- Na página da obra, o painel diz "Faltam 8 dados" e a lista do que falta vem no texto abaixo, em vez de uma frase inteira como título.
- A linha de apoio não fica mais colada no título: 12 px no lugar de 4.
- Título de seção igual em todas as telas (Literata, 22 px). Trilhas, Aula, a preparação do texto e Revisar e exportar usavam outra letra.
- Subtítulo de bloco igual em todas as telas (16 px, negrito). Eram oito variações.
- Título de obra e de texto em Literata também na lista do Ler, em Fichamentos, na lista do Escrever, nas Trilhas e nos encontros da Orientação.
- Numa lista, o título de obra ou de texto também vai até 3 linhas. No celular, um título longo ocupava 8 linhas numa trilha.
- Ficou como está, de propósito: a linha do tempo do projeto continua em letra de interface, porque mistura aula, entrega, link e obra na mesma lista; e "Entrar" continua em 30 px, por ficar numa caixa estreita.

## 2.20.0 (21/11/2026)
Polimento visual, parte 1 de 5: o que quebrava a tela.
- Acervo: um título longo não empurra mais as colunas para fora. Antes, a página passava da largura da janela e, no celular, a tela inteira encolhia.
- Você, Overview do autor: nome de texto longo quebra de linha dentro do cartão.
- Editor: saiu a moldura fina com cantos redondos em volta da página inteira e o espaço a mais que vinha com ela.
- Janelas de adicionar obra, criar projeto e enviar gravação: o campo de arquivo ganhou o botão do app. O campo do DOI ocupa a largura toda e não corta mais o exemplo.
- As caixas de seleção de Modelos por tarefa e de Ordem do Acervo voltaram a ter a seta.
- Os links sublinhados ("Mudar", "Marcar uma sessão na agenda", "Esta obra não tem DOI") ficaram alinhados com o texto.
- Celular: a lista do Ler mostra título, autor e etapa empilhados, sem cortar na borda, e a busca ocupa a linha inteira. Em Modelos por tarefa dá para ler o nome do modelo. As ações de Cópias de segurança quebram de linha. "Fechar", no Tutor e nos Grifos, tem o estilo do app. As abas que não cabem esmaecem na borda para mostrar que a fileira rola. Tabela larga em Ajustes ganhou sombra na borda para onde ainda há conteúdo. Na busca, a origem do resultado vai para baixo do título.
- Celular: "Desfazer" do aviso, "Fechar", o modo do diálogo e as cores do grifo passaram a ter 40 px de área de toque.
- Um nome só do começo ao fim: o botão "Novo projeto" agora abre "Novo projeto", com "Criar projeto" e "Projeto criado". "1 palavras" virou "1 palavra".
- Teste novo: todas as telas são abertas com um título de 200 caracteres e a página tem que ter a largura da janela, no computador e no celular. Com o estilo anterior ele acusa o Acervo, o Overview e as Cópias de segurança.

## 2.19.3 (21/11/2026)
A busca pelo link da página do artigo saiu. Fica o DOI.
- O campo de adicionar obra voltou a ser "DOI ou link do DOI". Aceita o DOI (10.1590/…) ou o link que traz o DOI (doi.org/10.1590/…), e os dados vêm do Crossref, como antes.
- Link da página do artigo (SciELO, portal de revista) não é mais aberto. Se você colar um, a tela pede o DOI, que aparece na própria página.
- Por quê: no teste de verdade a SciELO recusou a leitura pelo servidor (resposta 403), o navegador não consegue ler a página de outro site, e você decidiu que a função era problemática e que o que já existe atende.
- O servidor deixou de abrir páginas de qualquer site. Ele só fala com o Google e com o OpenAlex. **Publique o servidor de novo** para a rota antiga sair do ar (`servidor/publicar.sh`; não pede chave). Enquanto não publicar, nada quebra: o app já não usa essa rota.
- O OpenAlex continua igual: entra na busca do Acervo quando o Crossref não dá certeza.
- No Acervo, o atalho da janela "Adicionar obras" agora se chama "Adicionar uma obra pelo DOI".

## 2.19.2 (21/11/2026)
Leitura por link: o que o primeiro teste de verdade mostrou.
- O OpenAlex funcionou no primeiro teste. A leitura por link falhou nas três tentativas, e estas são as correções do que deu para identificar.
- Link antigo da SciELO, que começa com `http://`, era recusado ("O servidor só abre páginas https"). Agora o app e o servidor trocam para `https://` sozinhos.
- Quando o site não deixa o servidor ler a página, a mensagem diz o que fazer: copiar o DOI que aparece na página do artigo e colar no mesmo campo.
- O título procurado e o link colado iam no endereço do pedido ao servidor, e o Google Cloud guarda esse endereço no registro de acessos do seu projeto (só você vê, mas não era para ficar lá). Agora vão no corpo do pedido, que não é registrado.
- O servidor passa a registrar o motivo de cada recusa em código (por exemplo, "o site respondeu 403"), sem o endereço nem o título. É o que faltava para descobrir por que uma leitura falhou sem depender da mensagem na tela.
- **Precisa publicar o servidor de novo** (`servidor/publicar.sh`; não pede chave nenhuma desta vez). A publicação agora confere a versão que está no ar. Enquanto o servidor for o anterior, o app continua funcionando do jeito antigo.
- Ainda sem resposta: por que a página `https://` da SciELO falhou no primeiro teste real (erro 502, duas vezes). O servidor não registrava o motivo; com esta versão, o próximo teste mostra.

## 2.19.1 (21/11/2026)
Acervo: adicionar pelo link a partir do Acervo, e a tela sempre diz onde procura.
- "Adicionar obras", no Acervo, ganhou o atalho "Adicionar uma obra pelo DOI ou pelo link". Antes, a entrada por link só existia no botão "Adicionar obra" da tela Ler, e quem estava no Acervo não achava.
- A frase que dizia se a procura usa só o Crossref ou também o OpenAlex só aparecia para quem estava com o Gemini desligado. Com a IA ligada, não dava para saber. Agora "Onde o app procura" aparece sempre, no fim do Acervo.

## 2.19.0 (21/11/2026)
Modo leitura com tabelas e gráficos, e escrever em página em branco.
- O modo leitura passou a trazer tabelas e figuras desenhadas no PDF, não só as fotos. Tabela com réguas (a de cima, a do cabeçalho e a de baixo, como nas revistas, ou em grade) e gráfico ou diagrama feito de linhas e formas aparecem como um recorte da página, no lugar em que estão no texto.
- O texto que fica dentro do recorte (as células da tabela, os rótulos do gráfico) sai do texto corrido, porque já aparece na figura. Antes ele vinha embaralhado no meio do parágrafo.
- Limites: tabela sem nenhuma linha desenhada, só alinhada por espaços, continua saindo como texto. Texto em duas colunas ainda pode sair fora de ordem. Dentro de uma figura não dá para grifar no modo leitura; no modo PDF dá.
- Escrever ficou como uma página em branco: sem a caixa em volta do texto, na mesma coluna e no mesmo tamanho de letra do modo leitura.
- No pé da tela, discreta, a estimativa de quanto você já escreveu: "cerca de 2 páginas e meia", ao lado das palavras e da participação da IA. A conta usa o formato do Word que o app exporta (A4, Times New Roman 12, espaçamento 1,5); o número certo é o do Word.
- Testado com um PDF fictício feito para isso (tabela, quadro e gráfico desenhados). Falta ver com os seus artigos.

## 2.18.0 (21/11/2026)
Busca passo a passo no Acervo e esperas com número.
- A busca de dados mostra o caminho de cada obra: ler o PDF, procurar pelo DOI, procurar pelo título, conferir. Acima, a barra geral com quantas obras já foram e a porcentagem.
- Novo primeiro passo: o app lê o DOI escrito nas primeiras páginas do PDF que já está no aparelho. Quando acha, busca por ele e grava, sem depender do título. É o que resolve o arquivo que entrou com nome de arquivo no lugar do título.
- Resultados em dúvida aparecem lado a lado com a sua obra, dado por dado, com o que é diferente em negrito e a base de onde veio cada um. "Nenhuma das duas" recusa de uma vez, com desfazer.
- Esperas da IA deixaram de ser só um texto: o tutor, o Copilot, os diálogos e o parecer do projeto mostram "há 8 s", contando sozinho. Quando o app já tem histórico daquela tarefa neste aparelho, diz também quanto costuma levar; se passar do dobro, avisa que está demorando mais que o normal. O botão do tutor passou a se chamar "Parar".
- PDF que ainda não está no aparelho mostra a barra do download, com os MB e a porcentagem.
- O app só mostra porcentagem quando sabe o total. Onde não sabe (resposta da IA), mostra o tempo.
- Ainda sem barra, por dependerem de mudança maior no envio: envio de PDF e de áudio para o Drive, importação e exportação para o Word.

## 2.17.0 (20/11/2026)
Acervo: página de cada obra, OpenAlex e adicionar pelo link.
- Cada obra tem a sua página (clique nela no Acervo). Ela mostra o que falta, a referência em ABNT como vai sair no Word, e cada dado com a origem: Crossref, OpenAlex, página do artigo ou "Você escreveu". Dados gravados antes desta versão aparecem como "Sem registro de origem".
- "Buscar os dados desta obra" procura só aquela obra. Um resultado parecido aparece na própria página para você aceitar ou recusar.
- A procura passou a usar duas bases. O Crossref continua sendo a primeira; quando ele não dá certeza, o app consulta o OpenAlex, que cobre anais de evento e trabalhos sem DOI. Obra achada sem DOI é aceita do mesmo jeito e fica marcada como "não tem DOI".
- "Adicionar obra" aceita o link da página do artigo (SciELO, portais de revistas e repositórios de uma lista fechada). O app lê os dados que a página publica e, se ela traz o DOI, confere no Crossref.
- OpenAlex e link passam pelo seu servidor, que guarda a chave do OpenAlex e é quem abre a página. Para ligar: publique o servidor de novo (`servidor/publicar.sh`), que vai pedir a chave do OpenAlex com a tela escondida. Sem isso, a procura segue só pelo Crossref e a tela avisa.
- Apagar uma obra pela página dela manda para a lixeira, com desfazer.

## 2.16.0 (20/11/2026)
Acervo no menu: a central de todas as obras.
- O Acervo saiu dos Ajustes e virou o último item do menu (no celular, fica em Mais). O endereço antigo continua abrindo a mesma tela.
- A tela começa pelo que falta: quantas obras estão com a referência incompleta, sem PDF ou sem DOI, e um botão só, "Completar os dados". Ele procura no Crossref o DOI das obras que ainda não foram procuradas e, nas que já têm DOI, busca a revista, o volume, as páginas e o que mais faltar. Só preenche o que está vazio.
- Abaixo, todas as obras numa lista com três colunas: Referência (completa, ou o que falta para a ABNT, por tipo de obra), PDF e DOI. Filtros com contagem (com algo faltando, referência incompleta, sem PDF, sem DOI, repetidas), busca por título, autor ou ano e quatro ordens.
- Livro, capítulo, tese e trabalho de evento sem DOI não contam como falta: só artigo de revista.
- Clicar numa obra abre os dados dela para corrigir.
- Ainda não entrou, e vem nas próximas versões: a página própria de cada obra (com a origem de cada dado), a busca passo a passo com resultados lado a lado, o OpenAlex e a busca pelo link da página do artigo.

## 2.15.1 (20/11/2026)
Correção: a procura do DOI pelo título volta a funcionar.
- "Procurar DOIs que faltam" rodava e não gravava nada. O pedido que o app fazia ao Crossref incluía um campo que o Crossref não aceita, e por isso ele recusava o pedido inteiro; a obra voltava para a fila sem resultado. Buscar por um DOI digitado e "Atualizar os dados pelo DOI" não tinham o problema.
- O pedido agora só usa campos aceitos. Se um dia o Crossref recusar de novo, o app tenta mais uma vez sem escolher campos, em vez de parar.
- Os testes passaram a usar um Crossref simulado que recusa pedidos como o de verdade recusa. Com ele, os testes antigos teriam acusado o erro.
- Não conferido daqui com o Crossref de verdade: o ambiente onde o código é escrito não alcança o Crossref. Vale testar no Acervo com uma obra sem DOI.

## 2.15.0 (19/11/2026)
Endereço próprio: researchbook.com.br.
- O app passa a ter um endereço só dele. O antigo era dividido com qualquer outro site publicado pela mesma conta do GitHub, que por isso enxergaria o que o researchbook guarda no navegador.
- Para o navegador, endereço novo é app novo: no researchbook.com.br cada aparelho começa vazio, você entra com o Google e os dados vêm do Drive. Nada se perde, desde que tudo deste aparelho já tenha subido antes.
- Quem abrir o endereço antigo recebe um aviso quando o novo estiver no ar. O aviso só oferece ir quando tudo deste aparelho já está no Drive; se houver mudança esperando, ele pede para esperar o "Sincronizado".
- O que não vai junto, por ficar só no aparelho: as cópias diárias de segurança, a escolha de como acessar a IA e o app instalado na tela de início (instale de novo pelo endereço novo e apague o ícone antigo).
- Esta versão precisa ser aceita em cada aparelho ("Atualizar agora") antes de o endereço novo ser ligado. Depois da troca, o endereço antigo não recebe mais versões.

## 2.14.2 (19/11/2026)
Segurança: o login deixa de ficar guardado no aparelho.
- O acesso que o Google dá ao app (vale 1 hora) ficava guardado no aparelho. Agora ele existe só enquanto a aba ou o app instalado está aberto, e some ao fechar.
- O que muda no uso: ao abrir o app de novo, ele passa pelo Google e volta sozinho, em um instante, sem pedir senha. Se o Google não devolver o acesso em silêncio (conta fechada no navegador, por exemplo), aparece "Reconectar ao Google", como já acontecia quando o acesso vencia.
- Recarregar a página não passa pelo Google.
- Quem já estava com o app aberto continua conectado: o acesso antigo é levado para a aba e apagado do aparelho.
- Os testes do projeto passam a recusar qualquer arquivo do repositório com formato de chave, token ou segredo.

## 2.14.1 (19/11/2026)
O servidor da chave foi publicado e o app passou a conhecê-lo.
- Em Ajustes > Conectar a IA aparece a opção "Por um servidor seu, que guarda a chave". Escolha essa opção e use "Testar conexão".
- Depois que o teste passar, o cofre deixa de ser necessário: dá para trancar e apagar a chave guardada nele.
- Correção: um texto que chegava de outro aparelho no mesmo milésimo da última gravação daqui não era percebido como mudança de fora, e a gravação seguinte não guardava a versão dele antes. Raro no uso real; era a causa de um teste que falhava de vez em quando.

## 2.14.0 (19/11/2026)
Gemini por um servidor seu, que guarda a chave.
- Nova forma de acesso em Ajustes > Conectar a IA: "Por um servidor seu, que guarda a chave". Serve para chave que é de outra conta Google.
- A chave fica guardada no Google Cloud, no seu projeto, e nunca chega ao navegador. O app manda só o seu login; o servidor confere que é a sua conta e repassa o pedido ao Gemini.
- O servidor tem um limite de pedidos por dia (300, ajustável). Passou do limite, ele para de repassar até a meia-noite. A tela mostra quantos pedidos já foram feitos no dia.
- O áudio das aulas continua indo direto do seu aparelho para o Gemini; pelo servidor passa só o pedido de início do envio.
- A opção só aparece depois que o servidor for publicado e o endereço dele entrar no app. A publicação é um comando só, no terminal do Google no navegador (servidor/publicar.sh).
- O cofre e o acesso pelo login continuam funcionando como antes.

## 2.13.0 (19/11/2026)
Escrever: imagem no texto.
- Na linha vazia, o "+" agora oferece "Imagem" (PNG, JPG ou WebP, até 25 MB). Colar uma imagem copiada, como uma captura de tela, também funciona.
- A imagem entra como figura numerada. O app pede o título e a fonte; dá para deixar para depois, e a figura sem fonte avisa que a ABNT pede a fonte mesmo quando a figura é sua.
- No Word, a figura sai no formato da ABNT: "Figura 1 – título" acima, a imagem centralizada (no máximo 16 cm de largura) e "Fonte: ..." abaixo, em fonte 10. A numeração segue a ordem das figuras no texto inteiro.
- A imagem é regravada ao entrar: no máximo 1600 pontos no lado maior e sem os dados da câmera (local, aparelho, data).
- Ela fica neste aparelho e no seu Drive, na pasta escrita/imagens. Em outro aparelho, vem do Drive na primeira vez. Sem internet, sobe quando a conexão voltar.
- "Tirar do texto" tem desfazer. Tirar a figura não apaga a imagem: uma versão antiga do texto continua abrindo com ela.
- Não entrou: incorporar vídeo ou página de fora. Não vai para o Word e exigiria abrir o app para endereços de terceiros; o link continua sendo o caminho.
- Só existe o tipo "Figura". Quadro, gráfico e tabela com numeração própria ficam para depois.

## 2.12.0 (19/11/2026)
Dissertação: sessões de escrita marcadas na agenda.
- Na Visão, em "Esta semana", "Marcar uma sessão na agenda" pede o dia e a hora e cria um compromisso com a duração do seu plano.
- A sessão marcada aparece no Hoje daquele dia e, se a agenda do Google estiver ligada, na agenda researchbook.
- "Desmarcar" tem desfazer. Marcar não cria obrigação: uma sessão marcada e não feita não vira falta em lugar nenhum.
- Corrigido no Projeto da dissertação: se o parecer terminava de chegar no mesmo instante em que você marcava uma obra para buscar ou decidia um ponto, uma das duas mudanças podia se perder. Agora as mudanças numa versão são gravadas uma por vez, a partir do que está guardado.

## 2.11.0 (19/11/2026)
Projetos: arquivos e fotos no Estúdio.
- "Enviar arquivo ou foto" no Estúdio: guarda qualquer arquivo de até 25 MB no projeto (no celular, o botão também oferece tirar uma foto). Dá para escolher vários de uma vez.
- O arquivo fica neste aparelho e vai para a pasta do projeto no seu Drive. Enquanto não subiu, a linha avisa.
- Foto abre na tela; os outros tipos são baixados. Em outro aparelho, o arquivo vem do Drive na primeira vez.
- Tirar do projeto manda para a lixeira, com desfazer.
- Não entrou: ler o texto de uma foto.

## 2.10.0 (19/11/2026)
Escrever: o botão "Pedir".
- No editor, um botão discreto "Pedir" aparece na margem do parágrafo em que o cursor está. A ajuda só vem quando você pede, e o resultado aparece numa caixa fora do texto, que some ao fechar.
- "Buscar nos meus grifos e notas": mostra os seus grifos e as notas dos fichamentos que têm palavras em comum com o parágrafo, cada um com a referência e "Copiar com a referência". É busca por palavras, sem IA: sinônimo não é encontrado.
- "Conferir as citações": confere, sem IA, se cada autor e ano do parágrafo está na sua biblioteca, se a citação direta tem página e se o trecho entre aspas está entre os seus grifos.
- "Propor outra versão" e "Conversar com o Copilot" abrem o painel do Copilot, que continua fechado até aí.
- Na sessão de escrita o Pedir também aparece, só com as duas opções que não usam IA.

## 2.9.1 (19/11/2026)
Dissertação, Projeto: a página em seções.
- A página do projeto deixou de ser um texto corrido. Ela tem duas seções com cabeçalho e resumo próprios, Parecer e Leituras e citações, e um índice no topo ("Nesta página") que leva a cada uma e às suas pendências.
- No parecer, cada gravidade é um grupo com cabeçalho, e cada ponto é uma linha: a parte do projeto, o problema e a situação (sem decisão, nas suas pendências, ignorado). O detalhe abre ao tocar, separado em "No seu projeto", "O que se espera" e "Como resolver".
- Só o primeiro ponto sem decisão vem aberto. "Abrir todos" e "Recolher todos" ficam no cabeçalho.
- As suas pendências acompanham a rolagem no computador e mostram quantas já foram feitas.

## 2.9.0 (19/11/2026)
Entrar e Conectar a IA.
- Entrar: a tela diz em uma frase por que a entrada é com a conta Google, tem um botão só e lista o que o app pede ao Google agora (e-mail e a pasta researchbook no Drive) e o que só pede se você ligar depois (agenda e Gemini).
- Se o aparelho já guarda dados do researchbook, a tela avisa quantos e diz que eles voltam a abrir quando você entrar.
- Enquanto conecta, a tela mostra o que está sendo conferido.
- Conectar a IA (Ajustes): no acesso pela conta Google, a configuração virou quatro passos que o próprio app confere: API ativa, permissão, projeto com cobrança e um teste com uma pergunta de verdade. Cada passo mostra se passou e a que horas foi conferido.
- Quando o Google recusa, o erro aparece traduzido no passo certo, com o que fazer.
- O gasto do mês e o limite aparecem na mesma tela.
- Corrigido: o ID do projeto digitado podia ser apagado se a tela se redesenhasse antes de você salvar.
- Não entrou: "Abrir sem conectar" na tela de entrada. Sem internet o app já abre sozinho com os dados do aparelho, sem passar por essa tela. Ela só aparece depois de "Sair da conta", e ali o botão seria um jeito de abrir os dados sem login.

## 2.8.0 (19/11/2026)
Fichamento refeito.
- As cinco etapas saíram. O fichamento agora tem dois caminhos que alimentam as mesmas notas, e você pode usar os dois na mesma obra.
- Pelos grifos: você passa pelos trechos que marcou, com filtro por função, e escreve com as suas palavras o que cada um afirma.
- Pelo texto completo: cerca de 8 perguntas em 5 blocos (o essencial, como chegaram lá, conceitos, sua crítica, para a sua dissertação), respondidas de memória, uma por vez.
- As perguntas podem ser escritas pela IA para aquele texto, uma única vez e só quando você pede, a partir do artigo, dos seus grifos, da sua tese e dos seus argumentos. A IA só pergunta: ela não responde. Sem IA, há um conjunto de perguntas gerais.
- Ajuda só a pedido, em cada pergunta: "Por que esta pergunta?", "Conferir com o texto" (mostra os seus grifos daquele assunto) e "Trocar a pergunta".
- Cada resposta vira uma nota com a referência, que pode ser marcada para a dissertação e ligada a um argumento. As ligadas a um argumento aparecem no Mapa.
- "Suas notas" reúne tudo, com copiar. Os comentários do tutor continuam ali, a pedido.
- O que você escreveu nas cinco etapas antigas não se perde: continua guardado, aparece em "Suas notas" e segue no arquivo do Drive.
- O fichamento abre sem a barra do app, como o leitor e o editor.
- Ainda não entrou: levar uma nota direto para dentro de um capítulo. Por enquanto a nota é marcada e copiada.

## 2.7.0 (19/11/2026)
Dissertação: parecer do projeto.
- Ao enviar uma versão do projeto, a IA passa a fazer também um parecer do que ajustar para a qualificação, parte por parte: introdução e problema, propósito, perguntas, literatura e teoria, método, ética, coerência entre as partes, cronograma e forma.
- Cada ponto traz a gravidade (compromete a aprovação, importante ou ajuste), o trecho do seu projeto com a página, o que se espera ali e como resolver. A IA aponta o que falta; ela não reescreve o seu texto.
- O app confere, sem IA, se cada trecho citado está mesmo no PDF. Trecho não encontrado aparece com aviso.
- Você decide ponto por ponto: adicionar às suas pendências ou ignorar, com desfazer. As pendências ficam ao lado, com caixa de marcar.
- O parecer só muda quando você envia outra versão. Na versão seguinte, ele diz o que foi resolvido desde a anterior.
- Se o parecer falhar, a versão e a lista de obras continuam gravadas e dá para tentar de novo.
- A lista de obras por prioridade e os problemas de citação continuam na mesma página, em "Leituras e citações".
- Cada envio agora faz duas chamadas ao modelo de raciocínio em vez de uma; o custo por versão sobe na mesma proporção.

## 2.6.0 (19/11/2026)
Dissertação: Mapa e Jornada.
- Mapa: os argumentos viraram uma matriz. Cada linha é uma afirmação sua, cada coluna é uma obra com trechos ligados, e o número é quantos trechos aquela obra dá àquele argumento. A última coluna diz a sustentação: firme (3 obras ou mais), razoável (2), frágil (1) ou sem fonte. Tocar na linha abre o argumento, como antes. No celular fica a lista, porque a matriz não cabe.
- O mapa não destaca nem sugere leitura: você abre quando quer ver.
- Jornada: você informa o mês em que o mestrado começou e o prazo; a página mostra em que mês está, uma régua do prazo e os marcos. Os marcos são seus (qualificação, defesa, o que quiser), com apagar e desfazer. Início, fim do prazo e as versões do projeto enviadas entram sozinhos.
- O próximo marco aparece num painel com o que existe hoje: a versão do projeto, as palavras nos capítulos e os combinados em aberto. Sem IA.
- "Argumentos" passou a se chamar "Mapa" no menu da Dissertação.

## 2.5.0 (19/11/2026)
Dissertação: sessões de escrita.
- A Dissertação abre na Visão: a sua tese em uma frase (gravada sozinha), a sessão de hoje, o plano da semana, os capítulos e os combinados em aberto com a orientação.
- Sessão de escrita: "Escrever por 25 minutos" abre o capítulo só com o texto, um relógio discreto e o botão de encerrar. Ao encerrar, o app mostra os minutos, as palavras e a frase onde você parou; a próxima sessão começa naquela seção.
- Plano da semana: 3 sessões de 25 minutos por padrão, e você muda quando quiser. Não há sequência de dias: uma semana sem sessão não apaga nada.
- Capítulos: são textos do Escrever guardados no projeto Dissertação. Capítulo novo abre direto no editor. A lista mostra o que já tem texto, sem meta de palavras.
- Nada disso usa IA: a tela não sugere o que escrever.
- Sessão com menos de um minuto e sem texto novo não é registrada. Sessão esquecida aberta por mais de 3 horas é largada sem registro; o texto continua gravado.
- "Revisão do projeto" passou a se chamar "Projeto" no menu da Dissertação. O conteúdo dessa página ainda é o anterior.
- Ainda não entrou: Mapa em matriz, Jornada do mestrado, o parecer do projeto por partes e o botão "Pedir" durante a sessão.

## 2.4.0 (19/11/2026)
Projetos.
- A lista de projetos destaca um só: o que tem aula ou compromisso hoje ou, sem isso, o prazo mais próximo dentro de 7 dias. Os outros ficam numa lista, cada um com o que vem a seguir. A Dissertação saiu desta lista, porque tem lugar próprio no menu.
- Dentro do projeto, um menu flutuante à esquerda com cinco seções: Início, Artigos, Linha do tempo, Estúdio e Aprendizado. Os nomes aparecem ao passar o mouse. No celular, a barra de baixo vira esse menu enquanto você está no projeto.
- Início: o próximo compromisso num painel, os prazos com o dia em destaque, as últimas aulas e as anotações rápidas.
- Linha do tempo: o que vem a seguir e, embaixo, o que já aconteceu (aulas, entregas, obras adicionadas, fichamentos concluídos, textos começados), mês a mês.
- Estúdio: tudo o que faz parte do projeto. O que você escreveu (textos e notas) aparece com ícone preto e título com serifa; o que veio de fora (gravações, plano de ensino, links), com ícone de contorno. Dá para filtrar entre os dois.
- Novo no Estúdio: notas e links. A nota é gravada sozinha enquanto você escreve, sincroniza entre os aparelhos e, apagada, fica na lixeira até você esvaziar. Do link fica só o endereço (http ou https).
- Aprendizado: obras por etapa, grifos por função e cartões firmes, em revisão e difíceis do projeto. É contado pelo app, sem IA.
- "Arquivadas" passou a se chamar "Projetos encerrados".
- Ainda não entrou no Estúdio: foto com leitura do texto e envio de outros arquivos.

## 2.3.0 (19/11/2026)
Escrever.
- A barra fixa de formatação saiu. Ao selecionar um trecho aparece uma barra pequena sobre ele: negrito, itálico, link, título, subtítulo e citação. O link abre um campo na própria barra (Ctrl+K também abre); endereço sem "https://" é completado.
- Numa linha vazia aparece um "+" à esquerda, para separador e bloco de código.
- Lista ao digitar: "- " ou "* " no começo da linha vira lista com marcadores, e "1. " vira lista numerada.
- O texto agora aceita título de seção dentro da seção, bloco de código, separador e link (só http e https). Os quatro saem no Word.
- Copilot fechado até ser chamado: o painel da direita só abre pelo botão Copilot, e "Versões" fica ao lado do "Salvo". O app lembra, em cada aparelho, se você deixou o painel aberto.
- No editor, a barra do app sai: ficam o voltar e os comandos do texto.
- O Escrever mostra "Continue escrevendo" no topo, com o texto mexido por último.
- Ainda não entrou: inserir imagem pelo "+".

## 2.2.0 (19/11/2026)
Ler e leitor.
- Modo leitura: o artigo só com o texto e as figuras, numa coluna estreita em Literata, com a marca de cada página. No celular é o padrão; no computador o padrão continua sendo o PDF. A troca fica no topo do leitor e é lembrada em cada aparelho.
- O grifo feito no modo leitura aparece no PDF, e o feito no PDF aparece no modo leitura. A página em que você parou vale para os dois.
- Tutor fechado até ser chamado. No computador ele abre numa caixa de conversa no canto, e o texto fica com a largura toda.
- O Ler mostra "Continue lendo" no topo, com a obra em andamento e a página.
- No leitor, a barra do app sai: ficam o voltar e os controles da leitura.
- Limites do modo leitura: o texto vem do PDF na ordem em que o PDF o guarda, então artigos em duas colunas e tabelas podem sair embaralhados; só entram figuras guardadas como imagem (gráfico desenhado com linhas não entra); PDF digitalizado, sem texto, abre no modo PDF.

## 2.1.0 (19/11/2026)
Hoje redesenhado.
- Tarefas do dia: uma lista livre no Hoje. Você anota pelo teclado, marca e apaga; tudo é gravado na hora e sincroniza entre os aparelhos. O que ficou sem fazer continua na lista no dia seguinte; o que foi feito sai no outro dia. Tarefa apagada vai para a lixeira.
- Os compromissos de hoje ganharam lugar próprio, com a hora em destaque, e os prazos aparecem com o dia grande. No último dia, o prazo fica em vermelho. Antes vinham misturados em "Também para hoje".
- O próximo passo fica num painel cinza, com o único botão azul da tela.
- Os gráficos de "Sua semana" saíram do Hoje.

## 2.0.0 (19/11/2026)
Visual novo, primeira parte: sistema visual e navegação.
- Papel branco e cinzas neutros no lugar do fundo amarelado. Um azul só, o petróleo (#1D5A7A), para o que se pode tocar e para onde você está. A cor do conteúdo continua sendo a dos grifos.
- Navegação no topo, com os itens no centro: Hoje, Ler, Escrever, Dissertação e Projetos. Os seus projetos aparecem ao passar o mouse em Projetos. Busca e Você (overview, memória e ajustes) ficam à direita, junto do estado da sincronização. O menu lateral saiu.
- No celular, a barra de baixo tem só Hoje, Ler e Mais. Em Mais ficam Escrever, Dissertação, Projetos, Você e Ajustes.
- Botões em pílula: o principal de cada tela é o azul; os outros são cinza ou texto. Títulos de tela maiores, em Literata.
- Biblioteca passou a se chamar Ler e Escrita passou a se chamar Escrever. As telas por dentro ainda têm a organização antiga; elas mudam nas próximas entregas.

## 1.9.0 (19/11/2026)
Primeira abertura num aparelho.
- Ao entrar pela primeira vez num aparelho, a tela mostra "Abrindo os seus dados", com o andamento do que desce do Drive. Antes, enquanto a primeira sincronização rodava, as telas apareciam como se a biblioteca estivesse vazia.

## 1.8.0 (19/11/2026)
Cópias de segurança: item por item e pasta no computador.
- Em cada cópia guardada, "Ver o que mudou" lista o que nela está diferente de hoje, o que não existe mais e o que está apagado. "Trazer esta versão" traz de volta um item só. O que estava aqui é guardado antes: numa cópia inteira e, se for texto, como versão.
- Pasta no computador: você escolhe uma pasta e o app grava nela uma cópia em arquivo por dia, fora do navegador. Funciona no Chrome e no Edge do computador; o navegador pode pedir a permissão de novo a cada sessão ("Permitir de novo"). Nos outros navegadores, continua valendo "Baixar".

## 1.7.0 (19/11/2026)
Acervo, em Ajustes.
- O Organizar saiu das abas da Biblioteca e virou a página Acervo, em Ajustes. Ela abre com o retrato da biblioteca: quantas obras, quantas com DOI, quantas sem DOI e quantas sem PDF.
- "Sem PDF anexado" lista as obras que só têm a referência, com o caminho para anexar o arquivo.
- "Atualizar os dados pelo DOI" confere no Crossref as obras que já têm DOI e completa só o que está vazio (revista, volume, páginas, editora). O que você escreveu não é trocado; se o ano for diferente, a tela só informa. Tem desfazer.

## 1.6.0 (18/11/2026)
DOIs gravados sozinhos e IA só sob pedido, no Organizar.
- Quando título, autor e ano batem com o Crossref, o DOI é gravado na hora e os campos vazios da obra são completados. Antes a procura só deixava uma proposta, e nada entrava na obra sem você aceitar uma por uma.
- "Gravados agora" lista o que a procura gravou, com "Desfazer". Desfazer devolve a obra para a lista de conferir.
- A procura usa só o Crossref. A IA não entra mais sozinha: em cada obra em dúvida há o botão "Pedir para a IA conferir", e o que ela indica continua esperando a sua decisão.

## 1.5.0 (18/11/2026)
Sincronização entre aparelhos.
- Com o app aberto há horas, a sessão do Google vence. Agora, ao voltar para o app (ou com ele parado, sem ninguém mexendo), ele renova a sessão sozinho e a sincronização continua. Nunca no meio de um campo ou de uma janela aberta. Se o Google não renovar, o estado continua oferecendo "Reconectar" e contando o que espera para subir.
- Ajustes ganhou a página Sincronização: o estado deste aparelho, quantas mudanças esperam para subir, conflitos e a lista dos seus aparelhos com a última sincronização de cada um. Um aparelho parado há mais de 2 dias aparece com aviso.
- Se um texto aberto no editor muda em outro aparelho, a tela mostra o que chegou. Se você já estava escrevendo, o que chegou é guardado como versão antes de ser coberto.

## 1.4.0 (18/11/2026)
Confirmação honesta: o app diz onde cada mudança está.
- O estado da sincronização agora tem dois níveis. Logo depois de uma mudança ele mostra "Gravado neste aparelho. Enviando ao Drive…" e só volta a "Sincronizado às…" quando a mudança subiu de verdade. Antes ele continuava dizendo "Sincronizado" durante a espera.
- O envio ao Drive começa 2 segundos depois da mudança (eram 4), para dar tempo de subir antes de você bloquear o celular.
- Sem internet, com a sessão do Google vencida ou com erro, a tela conta quantas mudanças esperam para subir.
- Quando chegam mudanças de outro aparelho, um aviso diz quantas vieram.
- Se uma ação falha logo depois do clique, o app avisa que ela pode não ter sido gravada (antes a falha ia só para os registros).
- "Exportar referências (BibTeX)", em Ajustes, agora exporta de verdade: era um botão que só mostrava uma mensagem.
- Um fichamento que não existe neste aparelho mostra um aviso, em vez da tela de exemplo.

## 1.3.0 (18/11/2026)
Nada se perde: primeira entrega da base funcional, antes do visual novo.
- Lixeira: o que você apaga vai inteiro para a lixeira (antes ficava só uma marca, sem o conteúdo). Textos, fichamentos e argumentos ficam lá até você tirar; o resto sai depois de 90 dias. O que foi apagado junto volta junto. A lixeira sincroniza entre os aparelhos.
- Versões dos textos, agora sozinhas e sem depender de internet: o app guarda o estado anterior na primeira mudança, a cada 10 minutos de escrita, antes de usar uma versão do Copilot, antes de restaurar e antes de receber o mesmo texto de outro aparelho. Ficam neste aparelho e vão para o Drive quando há conexão. Restaurar não apaga: o texto da tela vira mais uma versão.
- Cópia diária neste aparelho: uma por dia, ficam as 30 mais recentes. "Recuperar o que falta" traz de volta o que foi apagado, sem mexer no que existe, e "Baixar" salva a cópia em arquivo.
- Ajustes ganhou a página Cópias de segurança, com a cópia do dia, a proteção do navegador, as cópias guardadas e a lixeira.
- "Guardar versão agora" diz onde a versão ficou: neste aparelho e no Drive, ou só neste aparelho até a conexão voltar.

## 1.2.0 (14/11/2026)
- Importar para a biblioteca: vários PDFs de uma vez, um arquivo exportado do Zotero (BibTeX, RIS, CSL JSON ou Zotero RDF) ou a pasta inteira que o Zotero exporta com "Exportar arquivos". Cada PDF é ligado à sua obra; palavras-chave e coleções do Zotero viram tags. Antes de gravar, você confere o que é novo, o que já está na biblioteca e o que parece repetido.
- Organizar (nova aba da Biblioteca): o app procura no Crossref o DOI das obras que não têm. Quando o resultado bate muito bem, aparece como "Muito provável"; quando fica em dúvida, a IA lê o começo do PDF e indica o candidato certo (nunca inventa DOI). Você aceita, recusa ou marca que a obra não tem DOI. Aceitar completa só os campos vazios.
- Obras repetidas: mesmo DOI, mesmo PDF ou mesmo título, ano e autor. "Juntar" fica com a obra que tem mais trabalho seu e leva para ela grifos, PDF, tags, trilhas, cartões e citações, com desfazer. Adicionar à mão uma obra que já existe avisa antes de salvar.
- O Hoje avisa quando há DOIs para conferir ou obras repetidas.
- Sincronização mais segura com o celular: quando o celular e o computador gravam ao mesmo tempo, a mudança mais nova não se perde mais (a outra fica em conflitos). Ao abrir o app com a sessão do Google vencida, ele renova sozinho; se não der, segue com os seus dados e oferece reconectar.
- No celular, o Hoje mostra quando foi a última sincronização, com "Sincronizar agora", e um aviso aparece acima da barra inferior quando a sincronização precisa de você.

## 1.1.0 (14/11/2026)
- Visual novo, mais calmo e consistente, no estilo de apps de produtividade: fundo claro, menos cor, títulos em Literata e a interface em Inter. Tudo segue um sistema único de tamanhos de letra, alturas de botão, espaços e cantos.
- Botões que dependem da internet ou da IA mostram que estão trabalhando ("Diagnosticando…", "Salvando…") e não aceitam clique duplo.
- Telas abrindo mostram a forma do conteúdo em vez de "Abrindo seus dados…".
- Ajustes ficou dividido em seções (Gemini, Modelos, Uso e custo, Registros, Este aparelho, Google Agenda, Marca-textos, Conta e pasta), uma por vez, com o índice sempre à vista.
- Ações discretas ("Editar", "Ver agenda") agora parecem clicáveis; as ações de memória não ficam mais apagadas até passar o mouse.
- Textos revisados: "Adicionar obra" no lugar de "Adicionar leitura", "Nova disciplina", "Marcar para buscar", instruções que valem para mouse e toque e erros que dizem o que fazer.
- Campos com contorno mais visível e foco claro em tudo o que dá para usar pelo teclado; a área de escrever não ganha mais moldura ao clicar.

## 1.0.0 (14/11/2026)
- Todas as telas usam os seus dados. Esta é a primeira versão completa do researchbook.
- Busca (Ctrl+K ou o campo Buscar) com os seus dados: obras, grifos, fichamentos, textos, argumentos, trilhas, disciplinas, aulas, diálogos, orientação, cartões e memória, além das páginas. Todas as palavras digitadas precisam aparecer; grifos vêm depois dos outros resultados.
- Ajustes > Modelos por tarefa: escolha o modelo e o nível de pensamento de cada tarefa da IA, com "Voltar ao padrão". As escolhas valem em todos os aparelhos.
- Ajustes > Uso e custo: gasto do mês, projeção, chamadas, tokens e custo por dia e por tarefa, calculados a partir dos registros de cada chamada. Limite mensal com aviso em 80% e cotação do dólar para ver em reais.
- Ajustes > Marca-textos: a descrição de cada cor fica guardada e aparece ao passar o mouse sobre a cor no leitor.
- Ajustes > Pasta mostra onde cada coisa fica no seu Drive.
- Segurança: todo o código saiu de dentro da página, e a política de segurança deixou de aceitar código embutido.
- Limpeza: as marcas de itens apagados somem do Drive e dos aparelhos depois de 90 dias.
- Correção: posições firmadas nos Diálogos e guardadas na memória agora entram nos pedidos à IA.
- Correção: duas gravações seguidas no mesmo arquivo do Drive não criam mais arquivos duplicados.

## 0.19.0 (14/11/2026)
- Cartões de revisão de verdade. "Criar cartões" a partir de uma obra grifada ou de uma aula (também pelo botão no resumo da aula): a IA propõe perguntas que pedem explicação, com a origem de cada uma, e você confere antes de guardar.
- Revisão em sessões curtas: um cartão por vez, "Mostrar resposta" e quatro notas (De novo, Difícil, Bom, Fácil), cada uma mostrando quando o cartão volta. "De novo" traz o cartão de volta ainda na mesma sessão. Teclado: espaço vira, 1 a 4 dão a nota.
- O Hoje avisa quando há cartões para revisar. A lista de cartões permite editar e apagar, com desfazer.
- Comentários do tutor no fichamento: em cada etapa, "Pedir comentários do tutor" traz um ponto forte, uma lacuna e uma pergunta, sem reescrever o que você escreveu. O mais importante vem marcado; os comentários continuam lá quando você volta.
- Overview do autor de verdade: entram os trechos seus dos textos da Escrita e os textos que você enviar (.docx, .txt, .md). O app mede palavras por frase, voz passiva, citações por parágrafo, perguntas no fim dos parágrafos e os seus conectivos; a IA descreve os traços da sua escrita com exemplos tirados dos seus textos (o app confere cada exemplo).
- O resumo da sua voz só vai para o Copilot quando você marcar "Usar este resumo nos pedidos ao Copilot". Participação da IA por texto no mesmo lugar.

## 0.18.0 (14/11/2026)
- Google Agenda de verdade. Em Ajustes > Google Agenda, "Ligar o Google Agenda" pede ao Google uma permissão só: criar a agenda researchbook e mexer nos eventos dela. O app não vê as suas outras agendas.
- Aulas (com a repetição semanal e as datas canceladas), entregas, encontros de orientação e sessões de estudo vão para a agenda researchbook. Mudou ou apagou no researchbook, muda ou some lá; desfazer devolve.
- Você escolhe quais tipos vão e o lembrete (1 dia e 1 hora antes, 1 hora, 30 minutos ou nenhum). As escolhas valem em todos os aparelhos.
- Cada evento mostra "✓ No Google Agenda" quando já foi enviado. Sem internet, vai quando ela voltar.
- Antes de ligar, é preciso ativar a Google Calendar API e a permissão no Google Cloud; Ajustes explica os passos.

## 0.17.0 (14/11/2026)
- Revisão do projeto de verdade. Envie a versão da dissertação em PDF: a IA lista as obras citadas por prioridade de leitura (alta, média, baixa), com a função de cada uma no texto, onde aparece e o risco em uma frase. As que já estão na biblioteca mostram a etapa de leitura; as de fora vão para "Vou buscar".
- Problemas nas referências: citação direta sem página, obra fora da lista, obra na lista e nunca citada, ano divergente, citação fora da norma.
- Cada versão fica no seu Drive (dissertacao/versoes) e é comparada com a anterior: obras novas, removidas e problemas resolvidos. "Criar trilha" junta as obras de prioridade alta e média que já estão na biblioteca.
- Orientação de verdade. "Registrar conversa" aceita anotação, e-mail, transcrição colada, gravação (transcrita como as aulas) ou PDF com comentários. A IA resume, separa os combinados e guarda até três falas literais da orientação, conferidas no registro.
- Combinados com caixa de marcar, também em "Combinados em aberto". Quando um encontro trata um combinado anterior, a IA avisa e você confirma se foi feito.
- Temas que voltam entre os encontros, próximo encontro agendado e pauta pronta para copiar.
- Diálogos de verdade, em três modos: Contraponto (a IA defende o lado contrário), Socrático (só perguntas) e Alinhamento (compara com os seus argumentos e posições). O modo muda a qualquer momento. As citações vêm do seu acervo e são conferidas.
- "Encerrar e firmar posições": a IA lista o que você firmou, com as suas palavras (o app confere na sua mensagem). Cada posição pode ir para a memória ou atualizar a tese de um argumento, com desfazer.

## 0.16.0 (14/11/2026)
- Projetos de verdade. O menu lateral mostra a dissertação e as suas disciplinas; "Cadastrar disciplina" pede nome, docente, semestre, dia e horário, e uma cor.
- Plano de ensino: envie o PDF e a IA lê as aulas, as entregas e as leituras. Você confere item por item antes de salvar; aula sem data no documento fica de fora. As leituras que já estão na biblioteca viram uma trilha, se você quiser.
- Cada disciplina tem visão geral, aulas, leituras (as da biblioteca marcadas com a disciplina e as do plano), textos e agenda.
- Agenda: aulas, entregas, sessões de estudo e encontros, com repetição semanal, editar e apagar com desfazer. O que é hoje e as entregas dos próximos dias aparecem no Hoje.
- Gravação de aula: o áudio fica no aparelho e no seu Drive. O Gemini transcreve em partes de 15 minutos; se o app fechar ou der erro, continua de onde parou. Gravações grandes vão para a área temporária do Gemini (48 horas) uma vez só.
- A transcrição separa quem fala (docência e participantes, sem nomes), tem o tempo de cada fala, toca o áudio a partir dela e pode ser grifada com as cores de sempre. Uma cópia em texto fica no Drive.
- Resumo da aula com pontos, conceitos como foram definidos em aula, perguntas para estudar e combinados. Cada ponto é conferido na transcrição; o que não bate é descartado e o app avisa.
- Leituras citadas em aula: as da biblioteca viram link; as de fora vão para a lista "Para buscar" da disciplina. Combinado com prazo vira entrega na agenda.
- Anotações rápidas da disciplina e anotações de cada aula, com salvamento automático.
- Renomear a disciplina leva junto as obras e os textos marcados com ela. Disciplinas podem ser arquivadas; apagar tem desfazer e traz as aulas de volta.
- Correção: abrir o app direto em um texto da Escrita mostrava "Abrindo seus dados…" até trocar de tela.

## 0.15.0 (13/11/2026)
- Escrita de verdade. "Novo texto" abre a preparação em quatro passos: enquadrar (enunciado, critérios, limite, entrega e o teto de IA), a ideia nas suas palavras, o diagnóstico do que o seu acervo sustenta e a estrutura.
- A primeira resposta da entrevista, "o que você quer defender, em uma frase?", vira a tese de trabalho como você escreveu, sem edição. O Copilot faz as perguntas seguintes, uma por vez.
- Diagnóstico em três colunas (sustentado, frágil, lacuna), com as citações do seu acervo conferidas pelo app. Obras de fora aparecem só como sugestão para buscar.
- Estrutura proposta pelo Copilot, que você renomeia, reordena, apaga ou completa antes de aprovar. Também dá para pular a preparação e escrever direto.
- Editor com seções, negrito, itálico, sublinhado, subtítulo, lista e citação longa. Salva sozinho. Colar traz só o texto, sem a formatação de fora.
- Copilot ao lado do texto: conversa sobre a seção, "Propor versões do parágrafo" (uma mais próxima do seu texto e uma mais acadêmica, com alertas de afirmação sem fonte), frase de transição e "Isso soa como eu?". Ele não escreve do zero.
- Autoria medida parágrafo por parágrafo: seu, coautoria (versão do Copilot que você usou) ou IA. Quanto mais você reescreve uma versão, mais ela volta a contar como sua. Os marcadores aparecem só quando você liga.
- Teto de IA por texto. Ao chegar nele, o Copilot para de propor versões e a exportação espera você reescrever com as suas palavras.
- Material da seção: os grifos mais ligados ao que você está escrevendo. Um toque insere a citação ABNT com a página onde está o cursor.
- Versões guardadas no seu Drive (escrita/…/versoes), com restaurar. Uma cópia legível do texto e da autoria também fica lá.
- Revisar e exportar: o app confere extensão, participação da IA, citações diretas que não estão nos seus grifos, seções vazias e monta as referências ABNT das obras citadas. O Copilot revisa afirmações sem fonte, fidelidade, coerência, estrutura e clareza, sem reescrever.
- Exportar para Word (.docx) em formato ABNT (A4, margens 3 e 2 cm, Times 12, espaço 1,5, citação longa recuada, referências em página nova). O arquivo sai sem marcadores de autoria; uma cópia vai para o seu Drive.

## 0.14.0 (13/11/2026)
- Memória de verdade (Você > Memória). A IA lê as suas conversas com o tutor e propõe o que vale lembrar: decisões, posições, preferências de trabalho e fatos do projeto.
- Só entra o que você disse. Cada proposta mostra as suas palavras ("Você disse: …"), e o app confere que elas estão mesmo nas suas mensagens. Sugestões da IA não viram memória.
- Você guarda, edita antes de guardar ou descarta. Descartados não voltam a ser propostos. Itens guardados podem ser editados ou esquecidos, com desfazer. Também dá para escrever um item à mão.
- Quando uma proposta muda algo já guardado, ela mostra o que substitui; ao guardar, o antigo sai.
- Só o que você guardou entra nos pedidos à IA.
- A IA procura sozinha ao abrir o app, nas conversas paradas há mais de 10 minutos, e quando você começa uma nova conversa com o tutor. O botão "Procurar nas conversas" faz isso na hora. Hoje avisa quando há itens para revisar.
- Exportar para outras IAs: um arquivo Markdown ou JSON, com perfil, memória, argumentos, fichamentos e conversas recentes, como você escolher. O arquivo é baixado e uma cópia fica no seu Drive (memoria/exportar).
- Ajustes do Gemini: a opção do cofre agora diz que serve também para chave de outra conta Google.

## 0.13.0 (13/11/2026)
- Tutor de verdade no leitor, com o Gemini. Selecione um trecho e toque em "Perguntar ao tutor", ou escreva uma pergunta sobre o texto. Botões Explique, Contraponha e Conecte.
- O tutor só cita o seu acervo: o texto da obra aberta, os seus grifos, o fichamento dela e os grifos "para a dissertação" e "crítica" das outras obras. Cada citação vem com a página.
- Cada resposta é conferida pelo app antes de aparecer: a fonte existe, o trecho está mesmo no seu acervo, nenhuma citação direta foi inventada. Se algo não bater, o app pede ao Gemini que corrija uma vez; se continuar, a resposta aparece com um aviso e a fonte marcada.
- Sugestões de leitura de fora do seu acervo aparecem separadas, como "para buscar", nunca como citação.
- Uma conversa por obra, que continua de onde parou. "Nova conversa" começa outra; a anterior continua guardada.
- Tudo o que a IA produz fica guardado no seu Drive (pasta ia/conversas), com o pedido, a resposta, as fontes, a conferência, o modelo e o custo. Os registros continuam sem o texto.
- Ajustes > Conexão com o Gemini: duas formas de acesso. Pelo seu login Google, sem chave guardada em lugar nenhum (a mais segura); ou com a chave num cofre no seu Drive, cifrada com uma frase-senha sua.
- "Testar conexão" e mensagens de erro que dizem o que fazer (API desligada, permissão faltando, limite de gasto, sem internet).
- Perfil do autor em Ajustes: vai para o seu Drive (memoria/autor.md) e entra em todo pedido à IA.
- Instruções da IA reescritas a partir de um benchmark: guia do Gemini 3, LearnLM, defesa contra instruções escondidas em PDFs e estudos sobre autoria.

## 0.12.0 (13/11/2026)
- Nova tela "Conflitos de sincronização". Quando o mesmo item muda em dois aparelhos antes de sincronizar, a versão mais recente fica em uso e a outra fica guardada até você decidir.
- Cada conflito mostra o que é (obra, grifo, fichamento, argumento, trilha…), só os campos que diferem, lado a lado, e de quando e de qual aparelho é cada versão.
- Duas saídas: "Manter a versão em uso" ou "Usar a versão guardada". As duas têm desfazer. Com vários conflitos, dá para manter todas as versões em uso de uma vez.
- Se o item foi apagado num aparelho e mudado no outro, a tela diz isso e oferece recuperar ou apagar.
- Como chegar: pelo aviso "conflitos para revisar" no rodapé do menu, por Ajustes > Revisar conflitos, ou por Hoje, que mostra o aviso primeiro (no celular, o rodapé não aparece).

## 0.11.0 (13/11/2026)
- Hoje de verdade: mostra um próximo passo, com o motivo. Primeiro a obra que você estava lendo ou fichando; depois a próxima da trilha com o prazo mais perto; depois uma leitura concluída sem fichamento; por último, uma obra ainda não iniciada.
- O próximo passo traz o seu último grifo da obra e onde você parou (página, ou a etapa do fichamento).
- "Também para hoje" lista até três coisas: outras obras em curso, trilhas com prazo nas próximas duas semanas e leituras prontas para fichar.
- "Sua semana" mostra os grifos por dia e por função e o argumento com mais fontes. O resumo de ontem só aparece quando houve algo; não há sequência de dias para manter.
- Trilhas de verdade: crie uma trilha com nome, prazo e as obras na ordem em que quer ler. Cada obra mostra a etapa e o botão do que fazer agora. Ordem com Subir e Descer; apagar tem desfazer.
- Argumentos de verdade: as teses que você ligou nos fichamentos aparecem com os trechos que você escreveu e as obras de cada uma. Dá para criar um argumento antes do fichamento, escolher o tipo (tese, premissa, objeção a responder) e dizer onde ele entra no texto.
- "Copiar" leva o trecho com a citação que você escreveu. Renomear a tese atualiza os trechos ligados. Apagar um argumento tem desfazer e não mexe nos fichamentos.
- Cada argumento mostra quantas obras o sustentam e avisa quando depende de uma só.
- Celular: o argumento escolhido ocupa a tela; trechos e prazos de trilha não ficam mais espremidos.
- O rodapé do menu não diz mais "dados de exemplo" quando você está com os seus dados.

## 0.10.0 (13/11/2026)
- Fichamento de verdade, em cinco etapas: Referência, Citações, Resumo, Análise crítica e Para a dissertação.
- Os seus grifos alimentam cada etapa pela cor: em Citações aparecem todos; em Resumo, conceito e evidência; em Análise crítica, método e crítica; em Para a dissertação, os lilás.
- Citações escolhidas a partir dos grifos, com página e no formato da ABNT de 2023, e um campo para dizer por que cada uma importa.
- Em Para a dissertação, "Inserir citação" ou tocar num grifo coloca a citação com a página onde estava o cursor. Cada trecho se liga a um argumento; teses novas viram argumentos.
- Salva sozinho enquanto você escreve, e sincroniza entre os aparelhos.
- Ao concluir, o fichamento vira um arquivo legível no Drive: researchbook/fichamentos/<obra>.md.
- No leitor, "Concluir leitura" leva ao fichamento. A obra passa por Em leitura, Leitura concluída, Em fichamento e Fichada.
- "Corrigir dados da obra" no fichamento: a referência ABNT se atualiza enquanto você corrige.
- Biblioteca > Fichamentos mostra os fichamentos reais e as leituras concluídas prontas para fichar.

## 0.9.0 (13/11/2026)
- Biblioteca de verdade: depois do login, a Biblioteca mostra as suas obras (começa vazia), com busca por título, autor e tag.
- Adicionar leitura pelo DOI: o app busca os dados no Crossref e mostra a referência em ABNT antes de salvar. Também dá para preencher à mão.
- Adicionar pelo PDF: o app lê o PDF; se encontrar o DOI no texto, busca os dados sozinho.
- O PDF vai para o seu Drive (researchbook/biblioteca/pdfs) e fica guardado no aparelho para ler sem internet. Em outro aparelho, é baixado do Drive na primeira vez que você abre.
- Leitor de PDF de verdade: páginas desenhadas conforme você rola, texto selecionável, página atual lembrada.
- Grifos no PDF com as cinco cores por função. Toque num grifo para mudar a cor ou apagar, com desfazer. Os grifos sincronizam entre os aparelhos.
- "Referência" copia a referência ABNT da obra; "Concluir leitura" marca a obra como lida.
- Referências seguem a ABNT NBR 6023:2018; citações no texto, a NBR 10520:2023.
- As outras telas (Hoje, Trilhas, Fichamentos, Escrita, Dissertação, Disciplinas) continuam com dados de exemplo até as próximas entregas.

## 0.8.2 (13/11/2026)
- Celular, leitor: o texto estava espremido numa coluna estreita ao lado do tutor. Agora ocupa a tela toda; Grifos e Tutor abrem como folhas por cima do texto, uma de cada vez, com botão Fechar. O tutor começa fechado no celular.
- iPhone: os campos de texto tinham letra menor que 16 px, o que faz o Safari dar zoom ao tocar e deixar a tela desalinhada. Agora todos têm 16 px no celular.
- Celular, Biblioteca: os menus de filtro passavam da borda da tela. Agora sobem do rodapé, dentro da tela.
- Celular: o fim de cada tela não fica mais escondido atrás da barra inferior, inclusive no iPhone com a barra de gestos.
- Testes passam a conferir no celular o tamanho da letra dos campos e a largura do texto no leitor.

## 0.8.1 (13/11/2026)
- Corrigido: depois de aceitar as permissões no Google, o app voltava para a tela de entrada sem entrar. O Google devolve os dados do login numa ordem que o app não reconhecia.

## 0.8.0 (13/11/2026)
- Tela de entrada: sem login, quem abre o endereço vê só "Entre para continuar". Só a conta autorizada no Google entra.
- Login com Google sem scripts de terceiros. O app confere no Google se o login foi emitido para ele e se a permissão do Drive foi dada; se faltar algo, diz o que fazer.
- Pasta researchbook no seu Google Drive, criada pelo app. Ele só enxerga o que ele mesmo criou.
- Sincronização entre os aparelhos: cada mudança vai para o Drive e chega aos outros aparelhos. Se o mesmo item mudar em dois lugares, fica o mais recente e o outro é guardado para você decidir.
- Os registros de cada sessão também vão para a pasta registros/ no Drive.
- O rodapé do menu mostra a situação real: sincronizado, sem internet ou "Reconectar ao Google". Com a sessão vencida, o app continua aberto com o que está no aparelho.
- Ajustes > Pasta: conta, "Sincronizar agora", "Abrir a pasta no Drive" e "Sair da conta" (que também revoga o acesso no Google).

## 0.7.0 (13/11/2026)
- Instala como app no computador, no Android e no iPhone. No iPhone, uma dica mostra o caminho (Compartilhar > Adicionar à Tela de Início) até você tocar em Entendi.
- Abre sem internet depois da primeira visita, e mais rápido, porque fica guardado no aparelho.
- Quando sai uma versão nova, aparece "Nova versão do researchbook disponível". Ela só entra quando você toca em "Atualizar agora".
- Registros reais desde já: cada sessão, tela, ação e erro fica guardado no aparelho por 180 dias, sem nada do que você escreve. Ajustes > Registros mostra e exporta em CSV.
- Ajustes > Este aparelho: versão, se está instalado, situação do armazenamento e "Baixar cópia dos dados".
- Base de dados local com formato versionado, migração automática e backup antes de cada migração (ficam os 5 mais recentes).
- Regra de segurança no app: ele só carrega código, estilos, fontes e imagens dele mesmo.
- O rodapé deixa de dizer "Salvo no Drive": o Drive ainda não está conectado.

## 0.6.1 (13/11/2026)
- Instruções de todas as funções de IA escritas e versionadas em `prompts/`: regras comuns (fonte só do acervo, autoria do autor, ABNT, honestidade, proteção contra ordens escondidas em PDFs e transcrições) e uma instrução por função. O perfil pessoal fica no Drive, fora do repositório.
- Casos de comportamento para testar as instruções quando o Gemini for ligado.
- Citações de exemplo no formato da ABNT NBR 10520:2023: sobrenome só com a inicial maiúscula, como em (Goldkuhl, 2012).

## 0.6.0 (13/11/2026)
- Repositório no GitHub com testes automáticos no computador e no celular, e publicação no GitHub Pages só quando os testes passam.
- Dados de exemplo sem nomes de pessoas reais e com tema de pesquisa fictício.
- Fontes Lexend e Literata servidas pelo próprio app: funcionam sem internet e deixam os testes iguais em qualquer máquina. A Literata usa a versão mais leve (52 KB em vez de 110 KB).
- Corrigido: no celular, os botões da Memória passavam da largura da tela.
- Corrigido: no celular, as telas de Ajustes e de fichamento passavam da largura da tela.
- Ajustes ganhou modelos do Gemini por tarefa, uso e custo, e registros de tudo o que acontece no app.

## 0.5 (13/11/2026)
- Cada disciplina virou uma central: aulas gravadas com transcrição e resumo, leituras, textos, agenda e anotações.

## 0.4 (13/11/2026)
- Navegação mais simples a partir do benchmark de usabilidade: Hoje, Biblioteca, Escrita, Projetos e Você.

## 0.1 a 0.3 (13/11/2026)
- Protótipo navegável: biblioteca, leitor com grifos, fichamento guiado, trilhas, revisão do projeto, orientação, escrita com tutor e copilot, memória.
