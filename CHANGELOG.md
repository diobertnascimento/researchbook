# O que mudou

Cada versão nova entra no topo, em linguagem de quem usa o app.

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
