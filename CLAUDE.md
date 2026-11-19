# researchbook: instruções para o Claude Code

Leia este arquivo inteiro antes de qualquer mudança. As decisões de produto estão em `docs/especificacao.md`; em caso de dúvida, ela manda.

## O que é

Ferramenta pessoal de estudo do Diobert para o mestrado acadêmico (dissertação em Design Science Research). Reúne biblioteca de artigos, leitura com grifos, fichamentos guiados, disciplinas (aulas gravadas, transcrições, agenda), escrita acadêmica e um tutor com IA (Gemini). Um único usuário. Interface em português do Brasil.

## Estado atual

- `public/index.html` tem só o HTML; os estilos ficam em `public/estilo.css` (design system v2, `docs/design-system.md`). Telas, roteador e estado ficam em `public/js/app.js` (script clássico, carregado antes dos módulos; as telas de exemplo continuam lá para o modo de demonstração dos testes). Nada de `<script>` com código nem atributos `on...=` no HTML: a CSP não tem `unsafe-inline` em `script-src` (um teste confere).
- Base real em módulos ES em `public/js/` (v0.7.0): `inicio.js` (liga tudo e expõe `window.rb`), `armazenamento.js` (IndexedDB, migrações, backup), `registros.js`, `atualizacao.js` (service worker e aviso de versão nova) e `instalar.js` (dica do iPhone). Service worker em `public/sw.js`.
- Login e Drive (v0.8.0): `config.js` (ID do cliente OAuth, público), `google.js` (login por redirecionamento, conferência do token, sair), `drive.js` (API do Drive com `drive.file`, novas tentativas e registros) e `sincronia.js` (junção item a item e conflitos). Dados novos sempre por `rb.dados.salvar/apagar/listar`, nunca direto no IndexedDB, para entrarem na sincronização.
- Biblioteca (v0.9.0): `abnt.js` (NBR 6023:2018 e 10520:2023), `crossref.js`, `biblioteca.js` (fichas, PDFs e grifos), `biblioteca-ui.js` (telas reais) e `leitor-pdf.js` (PDF.js em `public/vendor/pdfjs`, arquivos `.js`). Fichamento (v0.10.0): `fichamento-ui.js` (cinco etapas, salvamento automático, `.md` no Drive). Hoje, trilhas e argumentos (v0.11.0): `progresso.js` (regras puras do próximo passo, etapas e prazos; use estas funções em vez de repetir a lógica), `hoje-ui.js`, `trilhas-ui.js` e `argumentos-ui.js` (trechos vêm dos fichamentos, nunca copiados). Conflitos (v0.12.0): `conflitos-ui.js` (diferenças campo a campo com nomes da interface; resolver por `rb.dados.resolverConflito/reabrirConflito`). Coleção nova com campos novos: acrescente os rótulos em `ROTULOS` de `conflitos-ui.js`. IA (v0.13.0): `gemini.js` (cliente, preços, erros com próximo passo, registros), `cofre.js`, `contexto.js` (montagem do pedido com material marcado por código aleatório e conferência das citações sem IA), `historico.js` (toda saída da IA no Drive), `ia.js` (núcleo: acesso, perfil, memória, tutor), `tutor-ui.js` e `ia-ajustes.js`. Memória (v0.14.0): `memoria-ui.js` (propostas conferidas contra as falas do autor, aprovação, exportação); só itens com status aprovado entram no contexto. Escrita (v0.15.0): `escrita.js` (formato salvo, limpador, autoria por bloco, referências, versões no Drive), `copiloto.js` (tarefas do Copilot por `ia.gerarTarefa`), `docx.js` (Word em ABNT, sem biblioteca) e `escrita-ui.js`. Todo HTML do editor passa por `limpar()` antes de salvar; a autoria é medida, nunca declarada. Disciplinas (v0.16.0): `disciplinas.js` (disciplinas, aulas, agenda local com repetição, transcrição por trechos de 15 min com retomada, resumo conferido na transcrição, plano de ensino) e `disciplinas-ui.js`. Áudio e transcrição ficam no store `arquivos` e no Drive, nunca no JSON de sincronização. `ia.gerarTarefa` aceita `partes` (áudio, PDF) e `semAutor`; arquivos grandes vão por `ia.enviarArquivo` (Files API do Gemini). Dissertação (v0.17.0): `dissertacao.js` (revisões do projeto na coleção `revisoes`, esquema 5; orientação na coleção `encontros`, com o motor de áudio de `disciplinas.js`) e `dialogos.js` (três modos, encerrar com posições conferidas), telas em `dissertacao-ui.js`. Estudo (v0.19.0): `cartoes.js` (intervalos em `proximo()`, propostas conferidas pela origem) e `cartoes-ui.js`; `tutor-fichamento.js` (comentários por etapa, no histórico); `overview.js` (corpus só com trechos de autoria, métricas sem IA, exemplos conferidos; o resumo só vai ao Copilot com a escolha do autor) e `overview-ui.js`. Acabamento (v1.0.0): `busca.js` (Ctrl+K com os dados reais), `ia-uso.js` (modelos por tarefa com `gemini.tarefa()`, uso e custo lidos dos registros, marca-textos; preferências em `ajustes/preferencias.json`), limpeza das marcas de apagado com mais de 90 dias em `sincronia.js` e gravações por caminho em fila em `drive.js`. Organizar (v1.2.0): `importar.js` (lê BibTeX, RIS, CSL JSON e Zotero RDF e liga os PDFs pelo caminho), `duplicatas.js` (regras puras de repetidas e nota dos candidatos de DOI), `organizar.js` (importação, procura do DOI no Crossref com a IA só na dúvida, juntar repetidas com desfazer) e `organizar-ui.js`; a assinatura SHA-256 do PDF fica em `pdf.sha256`. Na sincronização, o Drive mais velho que a base é tratado como regressão (reenvia a versão daqui). Instruções em `public/prompts/` (servidas pelo app); ao mudar uma, suba a versão e rode `tests/tutor.spec.js`. Toda função nova de IA passa por `contexto.js` e `historico.js`, e é testada com `tests/gemini-falso.js`. As telas reais entram quando `modoReal()` é verdadeiro; no modo de exemplo (testes), as telas antigas seguem iguais. O HTML dispara `rb:render` depois de cada tela, para os módulos montarem o que precisam.
- Repositório **público**. Publicado no GitHub Pages pelo GitHub Actions (`.github/workflows/testar-e-publicar.yml`), só a partir da `main` e só depois que os testes passam.

## Arquitetura alvo (decidida em 13/11/2026)

App web instalável (PWA) servido por HTTPS no GitHub Pages, usado em dois computadores e no celular.

- **Dados:** pasta `researchbook/` no Google Drive do Diobert, acessada pela API do Drive com login Google (OAuth, escopo `drive.file`). Cópia local no IndexedDB para funcionar sem internet; sincroniza quando volta.
- **Agenda:** API oficial do Google Agenda, numa agenda separada chamada "researchbook".
- **IA:** API do Gemini chamada direto do navegador, com o token do login Google (ou a chave aberta do cofre), ou pelo servidor da chave (v2.14.0, pasta `servidor/`, publicado no Cloud Run do Diobert por `servidor/publicar.sh`; fora do GitHub Pages). O servidor é o único lugar com código fora do navegador: sem dependências, sem banco além do contador do dia, e nunca registra texto, e-mail ou token. Mudou o servidor: rode `tests/servidor.spec.js` e publique de novo. Modelo por tarefa conforme `docs/especificacao.md`.
- **Atualizações:** service worker detecta versão nova e mostra "Nova versão disponível"; o Diobert decide quando recarregar.
- **Esquema de dados versionado:** toda mudança de formato tem migração automática e faz backup antes de migrar.

## Como trabalhar neste repositório

1. Nunca altere a branch `main` diretamente. Crie uma branch por mudança com nome descritivo em português (`agenda-google`, `corrige-leitor-celular`).
2. Rode `npm test` antes de cada commit. Se uma tela nova não for alcançável por um link, adicione um.
3. Toda mudança visível atualiza, no mesmo PR:
   - `APP_VERSAO` em `public/js/app.js` e `version` em `package.json` (sempre iguais; um teste confere);
   - `CHANGELOG.md`, em linguagem de quem usa o app;
   - `docs/especificacao.md`, se o comportamento ou uma decisão mudou.
4. Abra um pull request usando o modelo do repositório. Em mudança visual, anexe ao PR capturas de tela no computador (1440 px) e no celular (390 px), porque não há prévia publicada por branch.
5. O plano gratuito do GitHub não bloqueia a junção de um PR com teste falhando. A regra é: só junte com tudo verde. A publicação da `main` já depende dos testes.
6. Commits e PRs em português, curtos, dizendo o que muda para o usuário.

Comandos: `npm run abrir` (app em http://localhost:4173), `npm test`, `npm run test:ver` (com navegador visível), `npm run relatorio`.

## Regras que não mudam

### Privacidade e segurança
- O repositório é público: tudo o que entra nele pode ser lido por qualquer pessoa, inclusive o histórico de commits.
- Nenhuma chave, token ou senha legível no código, no Drive, em localStorage ou nos registros. O acesso padrão ao Gemini é o próprio login Google (OAuth), sem chave. A chave do Gemini, quando usada, só existe cifrada no cofre (`cofre.js`: AES-GCM com frase-senha) e aberta só na memória do app. O ID de cliente OAuth do Google é público por natureza e pode ficar no código, restrito ao domínio do GitHub Pages.
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
- Visual: design system v2 em `docs/design-system.md` (leia antes de mexer em tela). Fontes Inter (interface) e Literata (títulos de página, conteúdo e leitura); fundo `#FBFAF8`, texto `#22201C`, petróleo `#1F4A5A` como única cor de ação. Cores de grifo por função: Conceito (amarelo), Evidência (verde), Método (azul), Crítica (salmão), Para a dissertação (lilás).
- Estilos só em `public/estilo.css`, com os tokens (`--fs-*`, `--e-*`, `--r-*`, cores). Nada de `font-size`, `margin` ou `padding` no atributo `style`: use as classes utilitárias (`mt-3`, `t-meta`, `linha-acoes`...). No `style` só ficam medidas e cores calculadas (largura de barra, cor de disciplina). Um teste confere.
- Ouvintes de clique e envio com trabalho assíncrono usam `ouvir()` de `public/js/ui.js`: o botão mostra o carregando sozinho e não aceita clique duplo. Para trocar o rótulo enquanto espera, ponha `data-ocupado="Salvando…"` no botão. Tela que ainda não tem dados mostra `esqueleto(titulo)` (em `app.js`).
- Tudo tem que funcionar a 390 px de largura sem rolagem lateral (um teste confere).
- Fontes: só famílias do catálogo do Google Fonts (fonts.google.com), com licença aberta. Os arquivos ficam em `public/fontes/`, baixados do pacote `@fontsource-variable/<família>` do npm (o mesmo arquivo do Google Fonts), junto com a licença. Não carregar dos servidores do Google: o app precisa funcionar sem internet, os testes precisam ver a mesma fonte em qualquer máquina, e a regra de segurança só aceita código e arquivos do próprio app. Para trocar uma fonte, escolha outra família no Google Fonts e substitua os arquivos e o `@font-face` em `public/estilo.css`.

### Textos da interface
- Português do Brasil, frases curtas, verbos simples, maiúscula só no início.
- O botão diz o que acontece ("Salvar e sair", não "Enviar"). O mesmo nome em todo o fluxo.
- Erro explica o que houve e o que fazer, sem pedir desculpas.

## Regras da base do app

- **Versão:** `APP_VERSAO`, `package.json` e `VERSAO` em `public/sw.js` andam juntos (testes conferem). Sem mudar o `sw.js`, o aparelho não percebe a versão nova.
- **Arquivos do app:** todo arquivo que o app usa ao abrir entra em `ARQUIVOS` no `sw.js`.
- **Esquema de dados:** passos de estrutura em `armazenamento.js` só acrescentam coleções e índices. Mudança de formato vira migração de dados (`MIGRACOES_DADOS`), sempre com backup antes. Nunca apagar dados sem backup.
- **Registros:** toda função nova registra seus eventos com `rb.registros.registrar(tipo, evento, {det, dur, st})`. Nunca registre conteúdo do usuário.
- **Login e Drive:** nunca pedir permissão mais ampla que `drive.file`. Google Agenda (v0.18.0, `agenda.js` e `agenda-ui.js`): só `calendar.app.created`, pedida ao ligar em Ajustes; nunca `calendar` ou `calendar.events`. Nunca usar a chave secreta do cliente. Os testes usam um Google simulado (`tests/google-falso.js`); toda função nova que fala com o Google ganha teste com ele.
- **Segurança (CSP):** a política fica no `<meta http-equiv="Content-Security-Policy">` de `index.html`. Para usar um serviço externo, acrescente só o endereço exato dele na diretiva certa e explique no PR. Nunca `unsafe-eval`, nunca `*`. Desde a v1.0.0, `script-src` não tem `unsafe-inline`: código só em arquivos de `public/js/`.

## Convenções do código atual

- Estado em `S`; telas em `V.<rota>(arg, arg2)` devolvendo HTML; roteador por `location.hash` em `render()`.
- Eventos por delegação, com atributos `data-*` tratados no ouvinte de clique no fim do arquivo.
- Sem framework e sem etapa de build. Funções novas entram como módulos ES em `public/js/`, sem bundler.
