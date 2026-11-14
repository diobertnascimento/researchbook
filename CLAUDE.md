# researchbook: instruções para o Claude Code

Leia este arquivo inteiro antes de qualquer mudança. As decisões de produto estão em `docs/especificacao.md`; em caso de dúvida, ela manda.

## O que é

Ferramenta pessoal de estudo do Diobert para o mestrado acadêmico (dissertação em Design Science Research). Reúne biblioteca de artigos, leitura com grifos, fichamentos guiados, disciplinas (aulas gravadas, transcrições, agenda), escrita acadêmica e um tutor com IA (Gemini). Um único usuário. Interface em português do Brasil.

## Estado atual

- Telas do protótipo em `public/index.html` (HTML, CSS e JavaScript sem framework), ainda com dados de exemplo.
- Base real em módulos ES em `public/js/` (v0.7.0): `inicio.js` (liga tudo e expõe `window.rb`), `armazenamento.js` (IndexedDB, migrações, backup), `registros.js`, `atualizacao.js` (service worker e aviso de versão nova) e `instalar.js` (dica do iPhone). Service worker em `public/sw.js`.
- Login e Drive (v0.8.0): `config.js` (ID do cliente OAuth, público), `google.js` (login por redirecionamento, conferência do token, sair), `drive.js` (API do Drive com `drive.file`, novas tentativas e registros) e `sincronia.js` (junção item a item e conflitos). Dados novos sempre por `rb.dados.salvar/apagar/listar`, nunca direto no IndexedDB, para entrarem na sincronização.
- Biblioteca (v0.9.0): `abnt.js` (NBR 6023:2018 e 10520:2023), `crossref.js`, `biblioteca.js` (fichas, PDFs e grifos), `biblioteca-ui.js` (telas reais) e `leitor-pdf.js` (PDF.js em `public/vendor/pdfjs`, arquivos `.js`). Fichamento (v0.10.0): `fichamento-ui.js` (cinco etapas, salvamento automático, `.md` no Drive). Hoje, trilhas e argumentos (v0.11.0): `progresso.js` (regras puras do próximo passo, etapas e prazos; use estas funções em vez de repetir a lógica), `hoje-ui.js`, `trilhas-ui.js` e `argumentos-ui.js` (trechos vêm dos fichamentos, nunca copiados). Conflitos (v0.12.0): `conflitos-ui.js` (diferenças campo a campo com nomes da interface; resolver por `rb.dados.resolverConflito/reabrirConflito`). Coleção nova com campos novos: acrescente os rótulos em `ROTULOS` de `conflitos-ui.js`. IA (v0.13.0): `gemini.js` (cliente, preços, erros com próximo passo, registros), `cofre.js`, `contexto.js` (montagem do pedido com material marcado por código aleatório e conferência das citações sem IA), `historico.js` (toda saída da IA no Drive), `ia.js` (núcleo: acesso, perfil, memória, tutor), `tutor-ui.js` e `ia-ajustes.js`. Memória (v0.14.0): `memoria-ui.js` (propostas conferidas contra as falas do autor, aprovação, exportação); só itens com status aprovado entram no contexto. Instruções em `public/prompts/` (servidas pelo app); ao mudar uma, suba a versão e rode `tests/tutor.spec.js`. Toda função nova de IA passa por `contexto.js` e `historico.js`, e é testada com `tests/gemini-falso.js`. As telas reais entram quando `modoReal()` é verdadeiro; no modo de exemplo (testes), as telas antigas seguem iguais. O HTML dispara `rb:render` depois de cada tela, para os módulos montarem o que precisam.
- Repositório **público**. Publicado no GitHub Pages pelo GitHub Actions (`.github/workflows/testar-e-publicar.yml`), só a partir da `main` e só depois que os testes passam.

## Arquitetura alvo (decidida em 13/11/2026)

App web instalável (PWA) servido por HTTPS no GitHub Pages, usado em dois computadores e no celular.

- **Dados:** pasta `researchbook/` no Google Drive do Diobert, acessada pela API do Drive com login Google (OAuth, escopo `drive.file`). Cópia local no IndexedDB para funcionar sem internet; sincroniza quando volta.
- **Agenda:** API oficial do Google Agenda, numa agenda separada chamada "researchbook".
- **IA:** API do Gemini chamada direto do navegador, com o token do login Google (ou a chave aberta do cofre). Modelo por tarefa conforme `docs/especificacao.md`.
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
- Visual: fontes Lexend (interface) e Literata (leitura); papel `#F4F0E6`, tinta `#211F1B`, petróleo `#1F4A5A`. Cores de grifo por função: Conceito (amarelo), Evidência (verde), Método (azul), Crítica (salmão), Para a dissertação (lilás).
- Tudo tem que funcionar a 390 px de largura sem rolagem lateral (um teste confere).
- Fontes: só famílias do catálogo do Google Fonts (fonts.google.com), com licença aberta. Os arquivos ficam em `public/fontes/`, baixados do pacote `@fontsource-variable/<família>` do npm (o mesmo arquivo do Google Fonts), junto com a licença. Não carregar dos servidores do Google: o app precisa funcionar sem internet, os testes precisam ver a mesma fonte em qualquer máquina, e a regra de segurança só aceita código e arquivos do próprio app. Para trocar uma fonte, escolha outra família no Google Fonts e substitua os arquivos e o `@font-face` em `public/index.html`.

### Textos da interface
- Português do Brasil, frases curtas, verbos simples, maiúscula só no início.
- O botão diz o que acontece ("Salvar e sair", não "Enviar"). O mesmo nome em todo o fluxo.
- Erro explica o que houve e o que fazer, sem pedir desculpas.

## Regras da base do app

- **Versão:** `APP_VERSAO`, `package.json` e `VERSAO` em `public/sw.js` andam juntos (testes conferem). Sem mudar o `sw.js`, o aparelho não percebe a versão nova.
- **Arquivos do app:** todo arquivo que o app usa ao abrir entra em `ARQUIVOS` no `sw.js`.
- **Esquema de dados:** passos de estrutura em `armazenamento.js` só acrescentam coleções e índices. Mudança de formato vira migração de dados (`MIGRACOES_DADOS`), sempre com backup antes. Nunca apagar dados sem backup.
- **Registros:** toda função nova registra seus eventos com `rb.registros.registrar(tipo, evento, {det, dur, st})`. Nunca registre conteúdo do usuário.
- **Login e Drive:** nunca pedir permissão mais ampla que `drive.file`. Nunca usar a chave secreta do cliente. Os testes usam um Google simulado (`tests/google-falso.js`); toda função nova que fala com o Google ganha teste com ele.
- **Segurança (CSP):** a política fica no `<meta http-equiv="Content-Security-Policy">` de `index.html`. Para usar um serviço externo, acrescente só o endereço exato dele na diretiva certa e explique no PR. Nunca `unsafe-eval`, nunca `*`. Quando o código sair do HTML para `public/js/`, tirar `unsafe-inline` de `script-src`.

## Convenções do código atual

- Estado em `S`; telas em `V.<rota>(arg, arg2)` devolvendo HTML; roteador por `location.hash` em `render()`.
- Eventos por delegação, com atributos `data-*` tratados no ouvinte de clique no fim do arquivo.
- Sem framework e sem etapa de build enquanto o app for um arquivo. Quando a integração com o Drive começar, dividir em módulos ES (`public/js/`) sem bundler, e manter os testes passando a cada passo.
