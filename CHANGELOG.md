# O que mudou

Cada versão nova entra no topo, em linguagem de quem usa o app.

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
