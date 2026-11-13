# O que mudou

Cada versão nova entra no topo, em linguagem de quem usa o app.

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
