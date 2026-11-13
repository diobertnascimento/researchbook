# researchbook: instruções para o Claude Code

Leia este arquivo inteiro antes de qualquer mudança. As decisões de produto estão em `docs/especificacao.md`; em caso de dúvida, ela manda.

## O que é

Ferramenta pessoal de estudo do Diobert para o mestrado acadêmico (dissertação em Design Science Research). Reúne biblioteca de artigos, leitura com grifos, fichamentos guiados, disciplinas (aulas gravadas, transcrições, agenda), escrita acadêmica e um tutor com IA (Gemini). Um único usuário. Interface em português do Brasil.

## Estado atual

- Protótipo navegável em um único arquivo: `public/index.html` (HTML, CSS e JavaScript sem framework). Dados de exemplo; nada é salvo ainda.
- Repositório **público**. Publicado no GitHub Pages pelo GitHub Actions (`.github/workflows/testar-e-publicar.yml`), só a partir da `main` e só depois que os testes passam.

## Arquitetura alvo (decidida em 13/11/2026)

App web instalável (PWA) servido por HTTPS no GitHub Pages, usado em dois computadores e no celular.

- **Dados:** pasta `researchbook/` no Google Drive do Diobert, acessada pela API do Drive com login Google (OAuth, escopo `drive.file`). Cópia local no IndexedDB para funcionar sem internet; sincroniza quando volta.
- **Agenda:** API oficial do Google Agenda, numa agenda separada chamada "researchbook".
- **IA:** API do Gemini chamada direto do navegador. Modelo por tarefa conforme `docs/especificacao.md`.
- **Atualizações:** service worker detecta versão nova e mostra "Nova versão disponível"; o Diobert decide quando recarregar.
- **Esquema de dados versionado:** toda mudança de formato tem migração automática e faz backup antes de migrar.

## Como trabalhar neste repositório

1. Nunca altere a branch `main` diretamente. Crie uma branch por mudança com nome descritivo em português (`agenda-google`, `corrige-leitor-celular`).
2. Rode `npm test` antes de cada commit. Se uma tela nova não for alcançável por um link, adicione um.
3. Toda mudança visível atualiza, no mesmo PR:
   - `APP_VERSAO` em `public/index.html` e `version` em `package.json` (sempre iguais; um teste confere);
   - `CHANGELOG.md`, em linguagem de quem usa o app;
   - `docs/especificacao.md`, se o comportamento ou uma decisão mudou.
4. Abra um pull request usando o modelo do repositório. Em mudança visual, anexe ao PR capturas de tela no computador (1440 px) e no celular (390 px), porque não há prévia publicada por branch.
5. O plano gratuito do GitHub não bloqueia a junção de um PR com teste falhando. A regra é: só junte com tudo verde. A publicação da `main` já depende dos testes.
6. Commits e PRs em português, curtos, dizendo o que muda para o usuário.

Comandos: `npm run abrir` (app em http://localhost:4173), `npm test`, `npm run test:ver` (com navegador visível), `npm run relatorio`.

## Regras que não mudam

### Privacidade e segurança
- O repositório é público: tudo o que entra nele pode ser lido por qualquer pessoa, inclusive o histórico de commits.
- Nenhuma chave, token ou senha no código ou no Drive. A chave do Gemini fica só no armazenamento do navegador. O ID de cliente OAuth do Google é público por natureza e pode ficar no código, restrito ao domínio do GitHub Pages.
- Nenhum dado real no repositório: PDFs, áudios, textos, transcrições, registros, nomes de pessoas reais (orientador, colegas) e dados pessoais do Diobert ficam só no Drive dele. Dados de exemplo usam um tema fictício (roteirizador de coleta seletiva para cooperativas, artigo sobre greenwashing) e obras fictícias marcadas como tal; nunca o tema real da dissertação.
- Registros não guardam o texto de prompts e respostas por padrão, só tamanhos, tempos e custos.
- O researchbook é pessoal e separado de qualquer trabalho: não integrar com contas, sistemas ou dados de empregadores.

### IA
- Duas instruções separadas: Tutor (pergunta, provoca, aponta lacunas, não escreve) e Copilot (ajuda a escrever a partir do que o Diobert escreveu ou disse). Nenhum dos dois escreve do zero.
- Só se cita o que está na biblioteca, com página. Obra fora do acervo vira sugestão para o Diobert buscar; até lá, não é citada. Nunca inventar citação, autor, ano ou página.
- Referências em ABNT.
- Toda chamada de IA gera registro com tarefa, modelo, nível de pensamento, tokens, tempo, custo, tentativa e modelo reserva.
- Participação da IA em cada texto é medida e mostrada fora do texto exportado.

### Design (resumo; detalhes em `docs/especificacao.md`)
- Uma ação principal por tela. O resto aparece sob demanda, a no máximo dois níveis.
- Navegação sempre visível: Hoje, Biblioteca, Escrita, Projetos, Você. No celular, barra inferior com os mesmos itens.
- Ícone sempre com rótulo em texto.
- Wizard só para tarefa rara. Ajuda no contexto ("Como ... funciona?" recolhido), sem tutorial.
- Status sempre visível (salvamento, erros com o próximo passo). Ação destrutiva tem desfazer.
- Sem sequência de dias que pune falhas, sem notificação insistente, sem urgência falsa.
- Visual: fontes Lexend (interface) e Literata (leitura), servidas de `public/fontes/` (nunca do Google Fonts); papel `#F4F0E6`, tinta `#211F1B`, petróleo `#1F4A5A`. Cores de grifo por função: Conceito (amarelo), Evidência (verde), Método (azul), Crítica (salmão), Para a dissertação (lilás).
- Tudo tem que funcionar a 390 px de largura sem rolagem lateral (um teste confere).

### Textos da interface
- Português do Brasil, frases curtas, verbos simples, maiúscula só no início.
- O botão diz o que acontece ("Salvar e sair", não "Enviar"). O mesmo nome em todo o fluxo.
- Erro explica o que houve e o que fazer, sem pedir desculpas.

## Convenções do código atual

- Estado em `S`; telas em `V.<rota>(arg, arg2)` devolvendo HTML; roteador por `location.hash` em `render()`.
- Eventos por delegação, com atributos `data-*` tratados no ouvinte de clique no fim do arquivo.
- Sem framework e sem etapa de build enquanto o app for um arquivo. Quando a integração com o Drive começar, dividir em módulos ES (`public/js/`) sem bundler, e manter os testes passando a cada passo.
