# researchbook

Ferramenta pessoal de estudo para o mestrado: biblioteca, leitura com grifos, fichamentos, disciplinas, escrita e tutor com IA.

Este repositório guarda **só o código**. Seus PDFs, textos, aulas e registros ficam no seu Google Drive, nunca aqui.

## O que tem aqui

| Caminho | Para que serve |
|---|---|
| `public/` | O app em si. É isto que vai para o ar. |
| `tests/` | Testes automáticos: abrem todas as telas no computador e no celular e procuram erros. |
| `docs/especificacao.md` | Decisões de produto. É a referência para qualquer mudança. |
| `CLAUDE.md` | Regras que o Claude Code lê antes de mexer no projeto. |
| `CHANGELOG.md` | O que mudou em cada versão. |
| `.github/workflows/` | Automação: testa e publica a cada envio. |
| `scripts/` | Servidor local e a calculadora de custo do Gemini. |

## Como uma mudança chega ao app

1. Você pede a mudança ao Claude Code (na web, em claude.ai/code, ou no terminal), com este repositório aberto.
2. Ele cria uma **branch**, faz a mudança, roda os testes e abre um **pull request** com capturas de tela.
3. O GitHub roda os testes de novo. O resultado aparece no próprio pull request: verde passou, vermelho falhou.
4. Se estiver bom, você clica em **Merge**.
5. A `main` é testada mais uma vez e publicada no GitHub Pages. Na próxima vez que abrir o app, a versão nova já está lá.

Se um teste falhar, nada é publicado. O motivo fica na aba Actions, com captura da tela que quebrou.

## Primeira configuração (uma vez só)

1. **Crie o repositório.** No GitHub, crie um repositório **público** chamado `researchbook`, vazio (sem README).
2. **Envie o código.** Se quiser, o Claude faz o envio depois que o repositório existir.
3. **Ligue o GitHub Pages.** No repositório: **Settings > Pages > Build and deployment > Source: GitHub Actions**.
4. **Publique a primeira vez.** Na aba **Actions**, abra "Testar e publicar" e clique em **Run workflow**. Quando terminar, o app estará em `https://<seu-usuario>.github.io/researchbook/`.
5. **No celular:** abra esse endereço e use "Adicionar à tela inicial".

### O que fica público e o que não fica
- **Público:** o código do app e os dados de exemplo, que são genéricos.
- **Nunca entra aqui:** seus PDFs, textos, aulas, registros, a chave do Gemini e nomes de pessoas reais. Tudo isso fica no seu Google Drive e no navegador, protegido pelo seu login do Google.
- Quem abrir o endereço do app vê o app vazio, sem os seus dados.

## Rodar no seu computador (opcional)

Precisa do Node.js 22 ou mais novo.

```bash
npm install
npx playwright install chromium
npm run abrir      # app em http://localhost:4173
npm test           # testes
```

## Glossário rápido

- **Repositório:** a pasta do projeto no GitHub, com todo o histórico.
- **Commit:** um registro de mudança, com mensagem dizendo o que mudou.
- **Branch:** uma linha paralela de trabalho. A `main` é a versão oficial; cada mudança nasce numa branch própria.
- **Pull request (PR):** o pedido para juntar uma branch na `main`. É onde você revisa e aprova.
- **Merge:** juntar o PR na `main`.
- **Actions:** a automação do GitHub. Aqui ela testa e publica.
- **GitHub Pages:** o serviço do GitHub que coloca o app num endereço na internet.
- **Secret:** senha guardada no GitHub, usada pela automação e nunca mostrada no código.
