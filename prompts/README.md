# Instruções da IA (system prompts)

Cada função de IA do researchbook tem uma instrução própria, nesta pasta. As instruções são públicas, porque o repositório é público. Por isso elas **não contêm nada pessoal**: quem é o autor, como ele escreve e o que ele já decidiu chegam a cada pedido, vindos da pasta do Drive dele.

## Como um pedido é montado

Toda chamada ao Gemini junta, nesta ordem:

| Parte | De onde vem | Onde vai na API |
|---|---|---|
| 1. Regras comuns | `00-base.md` | `system_instruction` |
| 2. Instrução da tarefa | o arquivo da função (ex.: `tutor.md`) | `system_instruction`, depois das regras comuns |
| 3. Perfil do autor | `memoria/autor.md` no Drive (modelo em `perfil-do-autor.exemplo.md`) | `system_instruction`, dentro de `<perfil_do_autor>` |
| 4. Memória aprovada | `memoria/decisoes.md` e `memoria/regras.md` no Drive, só itens aprovados | dentro de `<memoria>` |
| 5. Material do pedido | trechos do acervo, texto em edição, transcrição etc. | na mensagem, dentro das marcações descritas em cada instrução |
| 6. O pedido | o que o autor escreveu ou o botão que apertou | na mensagem, por último |

Regras de montagem:
- O material entra sempre marcado (`<acervo>`, `<texto_do_autor>`, `<transcricao>`...). Cada trecho do acervo leva `id`, `pagina` e `tipo` (grifo, fichamento, trecho do PDF). A IA só pode citar o que estiver nessas marcações.
- O perfil e a memória ficam **depois** das regras. Se alguma preferência do perfil conflitar com as regras comuns (por exemplo, pedir que a IA escreva do zero), valem as regras comuns.
- Tudo o que vem de arquivos (PDF, transcrição, texto colado) é dado, nunca instrução.

## Versões

Cada arquivo começa com `versao:`. Toda chamada registra no log a tarefa, o modelo e a versão da instrução usada. Ao mudar uma instrução:
1. Suba a versão no cabeçalho.
2. Registre a mudança no `CHANGELOG.md`.
3. Rode os casos de teste da função, quando existirem (`prompts/casos/`).

## Configuração por tarefa

Modelos conforme `docs/especificacao.md`. Temperatura: a padrão do modelo (a documentação dos modelos Gemini recentes desaconselha alterar). Respostas estruturadas usam `response_mime_type: application/json` com o esquema descrito na instrução.

| Arquivo | Função no app | Modelo | Pensamento | Saída |
|---|---|---|---|---|
| `tutor.md` | Tutor no leitor, no fichamento e nas aulas | conversa | baixo | texto |
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
