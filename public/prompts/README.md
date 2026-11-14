# Instruções da IA (system prompts)

Cada função de IA do researchbook tem uma instrução própria, nesta pasta. As instruções são públicas, porque o repositório é público. Por isso elas **não contêm nada pessoal**: quem é o autor, como ele escreve e o que ele já decidiu chegam a cada pedido, vindos da pasta do Drive dele.

## Como um pedido é montado

Montagem feita por `public/js/contexto.js`, na ordem recomendada pelo guia de prompts do Gemini 3 (material primeiro, tarefa depois, restrições críticas no fim):

| Parte | De onde vem | Onde vai na API |
|---|---|---|
| 1. Regras comuns | `00-base.md` | `systemInstruction` |
| 2. Instrução da tarefa | o arquivo da função (ex.: `tutor.md`) | `systemInstruction` |
| 3. Perfil do autor | `memoria/autor.md` no Drive (modelo em `perfil-do-autor.exemplo.md`) | `systemInstruction`, em `<perfil_do_autor>` |
| 4. Memória aprovada | coleção `memoria`, só itens com status aprovado | `systemInstruction`, em `<memoria>` |
| 5. Conversa anterior | histórico da conversa (só pedidos e respostas, últimas 4 trocas) | `contents`, papéis user/model |
| 6. Código do pedido | 8 caracteres aleatórios, novos a cada pedido | início da mensagem atual |
| 7. Material | acervo (`<acervo>` com itens A1, A2… e citação ABNT pronta), obra aberta, argumentos | mensagem atual, cada texto dentro de `<material-CODIGO>` |
| 8. O pedido | o que o autor escreveu ou o botão que apertou | `<pedido>` |
| 9. Lembrete | as restrições críticas da tarefa, repetidas | `<lembrete>`, última linha |

As partes 1 a 4 mudam pouco e ficam no começo: o Gemini reaproveita em cache entre as mensagens da conversa, o que baixa custo e tempo.

## Por que assim (benchmark de 13/11/2026)

- **Material com código imprevisível** (spotlighting, Hines et al., Microsoft, 2024): um PDF malicioso não tem como fechar a marcação e se passar por instrução, porque não sabe o código do pedido.
- **Ids curtos e citação pronta:** o modelo copia `A2` e `(Silva, 2020, p. 3)` em vez de montar a citação, o que tira a principal fonte de erro de formato.
- **Conferência em duas etapas, sem IA:** a resposta vem em JSON com a lista de fontes e um trecho literal de cada uma. O app confere se o id existe, se o trecho está mesmo no item e se toda citação direta entre aspas está no acervo. Se não bater, devolve os problemas ao modelo uma vez; se continuar, mostra a resposta marcada, nunca escondida.
- **Sem proibições genéricas** ("não deduza"): o guia do Gemini 3 mostra que elas fazem o modelo falhar em lógica básica. A regra é dizer o que vale como fonte e pedir que a conclusão própria seja marcada como tal.
- **Restrições no fim:** o guia do Gemini 3 recomenda pôr a tarefa e as restrições críticas por último, porque as do começo se perdem em pedidos longos.
- **Temperatura padrão (1,0):** o guia do Gemini 3 desaconselha baixar; valores menores causam repetição e pioram raciocínio.
- **Tutor com princípios do LearnLM** (aprendizagem ativa, carga cognitiva, adaptação, curiosidade, metacognição) e uma pergunta por vez, como nos tutores socráticos que funcionaram em sala (Kestin et al., 2025).
- **Autoria preservada** (Zhang; Bu; Dhillon, 2026): ajuda sob demanda, sugestões pequenas, voz do autor como âncora e registro de quem escreveu o quê.

## Versões

Cada arquivo começa com `versao:`. Toda chamada registra no log a tarefa, o modelo e a versão da instrução usada. Ao mudar uma instrução:
1. Suba a versão no cabeçalho.
2. Registre a mudança no `CHANGELOG.md`.
3. Rode os casos de comportamento da função (`casos/casos.json`) e os testes automáticos (`tests/tutor.spec.js` confere a montagem e a conferência das citações).

## Configuração por tarefa

Modelos conforme `docs/especificacao.md`. Temperatura: a padrão do modelo (a documentação dos modelos Gemini recentes desaconselha alterar). Respostas estruturadas usam `response_mime_type: application/json` com o esquema descrito na instrução.

| Arquivo | Função no app | Modelo | Pensamento | Saída |
|---|---|---|---|---|
| `tutor.md` | Tutor no leitor (em uso desde a v0.13.0), depois no fichamento e nas aulas | conversa | baixo | JSON (resposta, pergunta, fontes, fora do acervo) |
| `copilot.md` | Escrita: entrevista, diagnóstico, estrutura, versões, transições | raciocínio | médio a alto | JSON |
| `dialogos.md` | Diálogos: Contraponto, Socrático, Alinhamento | conversa | médio | texto |
| `fichamento.md` | Comentários do tutor em cada etapa do fichamento | conversa | médio | JSON |
| `revisao-projeto.md` | Lê o PDF da dissertação e monta a trilha por prioridade | raciocínio (lote) | alto | JSON |
| `transcricao.md` | Transcreve aulas e reuniões | áudio | — | texto |
| `aula.md` | Resumo, conceitos, leituras citadas e perguntas da aula | conversa | baixo | JSON |
| `orientacao.md` | Resumo e combinados de cada encontro de orientação | conversa | médio | JSON |
| `plano-de-ensino.md` | Lê a ementa e monta aulas, leituras e entregas | rápido | mínimo | JSON |
| `cartoes.md` | Cria cartões de revisão a partir de grifos e fichamentos | rápido (lote) | baixo | JSON |
| `memoria.md` | Propõe o que vale lembrar da sessão | rápido | mínimo | JSON |
| `revisao-final.md` | "Revisar e exportar" do texto | raciocínio | alto | JSON |
| `metadados-pdf.md` | Extrai a referência das primeiras páginas do PDF | rápido | mínimo | JSON |
| `overview-autor.md` | Descreve o estilo do autor a partir dos textos dele | conversa (lote) | médio | JSON |
