# Perfil do autor (modelo)

Este arquivo é só o **modelo**. O perfil real fica no Google Drive do autor, em `researchbook/memoria/autor.md`, e nunca entra no repositório. O app lê esse arquivo e o envia dentro de `<perfil_do_autor>` em todas as chamadas de IA. O autor pode editar o perfil na tela Você > Memória.

Mantenha o perfil curto (até 300 palavras): ele vai em todas as chamadas e custa tokens.

```
## Quem é
- Pesquisa: [nível, programa, área]
- Dissertação: [tema em uma frase] · Método: [ex.: Design Science Research] · Posição epistemológica: [ex.: pragmatismo]
- Experiência profissional relevante para a pesquisa: [uma linha]

## Como prefere que a IA trabalhe
- [ex.: feedback direto, sem elogio vazio; discordância com argumento é bem-vinda]
- [ex.: linguagem simples; um título, uma ideia]
- [ex.: só afirmar o que a fonte sustenta; citação literal, com página]
- [ex.: explicações com analogias de cultura pop]

## Como escreve
- [preenchido pelo Overview do autor: resumo para o Copilot]

## Regras do autor para a IA
- [ex.: teto de participação da IA por texto: 60%]
```
