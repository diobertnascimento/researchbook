// Gemini simulado para os testes: guarda cada pedido (cabeçalhos e corpo) e responde como o Gemini.
// Por padrão, responde como um bom tutor: cita o item A1 com um trecho literal tirado do próprio pedido.
// Cenários: 'inventa-uma-vez' (primeira resposta cita fonte inexistente), 'sempre-inventa',
// 'api-desligada' (403), 'cota' (429 nas duas primeiras tentativas), 'fora-do-formato'.
export async function geminiFalso(context, { cenario = 'bom', ...opcoes } = {}) {
  const estado = { pedidos: [] };
  const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type, x-goog-api-key, x-goog-user-project',
    'access-control-allow-methods': 'POST, OPTIONS',
  };
  const responder = (r, status, corpo) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(corpo) });

  await context.route('https://generativelanguage.googleapis.com/**', (r) => {
    const req = r.request();
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    const corpo = JSON.parse(req.postData() || '{}');
    const modelo = decodeURIComponent(new URL(req.url()).pathname.split('/models/')[1].split(':')[0]);
    const n = estado.pedidos.push({ modelo, cabecalhos: req.headers(), corpo });
    if (cenario === 'api-desligada') return responder(r, 403, { error: { code: 403, message: 'Generative Language API has not been used in project 123 before or it is disabled.', status: 'PERMISSION_DENIED', details: [{ reason: 'SERVICE_DISABLED' }] } });
    if (cenario === 'cota' && n <= 2) return responder(r, 429, { error: { code: 429, message: 'Resource has been exhausted (e.g. check quota).', status: 'RESOURCE_EXHAUSTED' } });

    const ultimo = corpo.contents?.at(-1)?.parts?.[0]?.text || '';
    // Na correção, o acervo está numa mensagem anterior: procura em todas as mensagens do autor.
    const todos = (corpo.contents || []).filter((c) => c.role === 'user').map((c) => c.parts?.[0]?.text || '').join('\n');
    let texto;
    if (!corpo.generationConfig?.responseJsonSchema) {
      texto = 'ok';
    } else if (corpo.generationConfig.responseJsonSchema.properties?.propostas) {
      // Tarefa da memória: uma proposta com evidência tirada da última fala do autor (vale) e uma tirada da fala da IA (o app recusa).
      const falas = [...todos.matchAll(/^\[(\d+)\] autor: (.+)$/gm)].map((m) => ({ n: Number(m[1]), texto: m[2] }));
      const daIA = todos.match(/^\[\d+\] ia: (.+)$/m)?.[1] || '';
      const ultima = falas.at(-1);
      const atualizaId = todos.match(/^\[(mem-[^\]]+)\]/m)?.[1] || '';
      const propostas = ultima
        ? [
            { tipo: 'decisao', texto: ultima.texto, evidencia: ultima.texto.split(/\s+/).slice(0, 6).join(' '), mensagem: ultima.n, atualiza: opcoes.atualizar ? atualizaId : '' },
            { tipo: 'posicao', texto: 'Uma ideia que só a IA disse', evidencia: daIA.split(/\s+/).slice(0, 5).join(' '), mensagem: ultima.n, atualiza: '' },
          ]
        : [];
      texto = JSON.stringify({ propostas });
    } else if (copilot(corpo.generationConfig.responseJsonSchema.properties)) {
      texto = JSON.stringify(respostaCopilot(corpo.generationConfig.responseJsonSchema.properties, todos, opcoes));
    } else {
      // Tira as primeiras palavras do item A1 do próprio pedido, para citar um trecho que existe.
      const m = todos.match(/<item id="A1"[^>]*>\s*<material-[0-9a-f]+>\s*([\s\S]*?)\s*<\/material-/);
      const literal = (m?.[1] || '').split(/\s+/).slice(0, 6).join(' ');
      const inventar = cenario === 'sempre-inventa' || (cenario === 'inventa-uma-vez' && !/conferência automática/.test(ultimo));
      const resposta = inventar
        ? { resposta: 'O texto defende rotas negociadas (Silva, 2020, p. 9) [A9] e diz que "a adesão é tudo o que importa no fim".', pergunta: 'Isso muda o seu critério?', fontes: [{ id: 'A9', trecho_literal: 'trecho que não existe' }], fora_do_acervo: [] }
        : { resposta: `O trecho afirma o ponto central da obra (Moraes; Lins, 2024, p. 1) [A1].`, pergunta: 'Como isso entra no seu critério de avaliação?', fontes: [{ id: 'A1', trecho_literal: literal }], fora_do_acervo: ['Estudos sobre cooperativas de reciclagem no Brasil (autor a confirmar)'] };
      texto = cenario === 'fora-do-formato' ? 'isto não é JSON' : JSON.stringify(resposta);
    }
    return responder(r, 200, {
      candidates: [{ content: { role: 'model', parts: [{ text: texto }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 1800, cachedContentTokenCount: 1200, thoughtsTokenCount: 90, candidatesTokenCount: 140, totalTokenCount: 2030 },
      modelVersion: modelo,
    });
  });
  return estado;
}

// Copilot de escrita: reconhece a tarefa pelo esquema pedido e responde no formato, citando A1 com trecho literal.
const copilot = (p = {}) => ['versoes', 'pontos', 'secoes', 'verificacoes', 'veredito', 'comentario', 'por_que'].some((k) => k in p) || (Object.keys(p).length === 1 && 'texto' in p);
function respostaCopilot(p, todos, opcoes) {
  const m = todos.match(/<item id="A1"[^>]*>\s*<material-[0-9a-f]+>\s*([\s\S]*?)\s*<\/material-/);
  const literal = (m?.[1] || '').split(/\s+/).slice(0, 6).join(' ');
  const fontes = literal ? [{ id: 'A1', trecho_literal: literal }] : [];
  const cita = literal ? ' (Moraes; Lins, 2024, p. 1) [A1]' : '';
  const doAutor = todos.match(/<texto_do_autor>\s*<material-[0-9a-f]+>\s*([\s\S]*?)\s*<\/material-/)?.[1] || '';
  if ('versoes' in p) {
    if (opcoes.recusarVersoes) return { versoes: [], fontes: [], alertas: [], recusa: 'O parágrafo ainda não tem uma ideia sua para trabalhar. Escreva uma frase com o que quer dizer.' };
    return {
      versoes: [
        { tipo: 'proxima', texto: `${doAutor.replace(/\.$/, '')}, como mostra o caso das cooperativas${cita}.`, mudancas: ['liga à fonte', 'mesma ordem'] },
        { tipo: 'academica', texto: `A coordenação das rotas depende da adesão das equipes de coleta${cita}.`, mudancas: ['tira o coloquial'] },
      ],
      fontes,
      alertas: [{ trecho: doAutor.slice(0, 30), problema: 'sem_fonte', explicacao: 'A segunda parte do parágrafo não tem fonte no seu acervo.', como_resolver: 'Adicione uma obra que sustente o ponto ou retire a afirmação.' }],
    };
  }
  if ('pontos' in p) {
    return {
      pontos: [
        { afirmacao: 'A adesão das equipes define o sucesso das rotas.', classe: 'sustentado', fontes, comentario: `Seu acervo sustenta o ponto${cita}.` },
        { afirmacao: 'Cooperativas pequenas não usam roteirização.', classe: 'lacuna', fontes: [], comentario: 'Nenhum grifo trata do porte das cooperativas.' },
      ],
      sugestoes_de_busca: [{ descricao: 'Estudos sobre o porte das cooperativas de reciclagem', obra_sugerida: '' }],
    };
  }
  if ('secoes' in p) {
    return {
      secoes: [
        { titulo: 'Introdução', objetivo: 'Apresentar a tese e o caso.', fontes: literal ? ['A1'] : [], palavras: 400, depende_de_lacuna: false },
        { titulo: 'Rotas negociadas', objetivo: 'Mostrar como a adesão muda o resultado.', fontes: literal ? ['A1'] : [], palavras: 900, depende_de_lacuna: false },
        { titulo: 'Considerações finais', objetivo: 'Retomar a tese.', fontes: [], palavras: 300, depende_de_lacuna: false },
      ],
      observacao: 'A seção sobre o porte das cooperativas ficou de fora porque falta fonte.',
    };
  }
  if ('verificacoes' in p) {
    return {
      verificacoes: [
        { item: 'afirmacoes_sem_fonte', situacao: 'atencao', resumo: 'Uma afirmação da introdução não tem fonte.' },
        { item: 'coerencia', situacao: 'ok', resumo: 'As seções sustentam a tese.' },
      ],
      problemas: [{ item: 'afirmacoes_sem_fonte', gravidade: 'media', secao: 'Introdução', trecho: (doAutor || todos.match(/## 1\. [^\n]*\n([^\n]{10,60})/)?.[1] || '').slice(0, 40), problema: 'Afirmação sem fonte', como_resolver: 'Cite uma obra do acervo ou retire.' }],
    };
  }
  if ('veredito' in p) return { veredito: 'soa em parte', diferencas: [{ trecho: doAutor.slice(0, 40), diferenca: 'A frase é mais longa que as suas.', sugestao: 'Divida em duas.' }] };
  if ('comentario' in p) return { comentario: `A seção pode se apoiar no caso das cooperativas${cita}.`, pergunta: 'O que esta seção precisa provar para a sua tese funcionar?', fontes };
  if ('por_que' in p) return { pergunta: 'Que caso concreto mostra isso na prática?', por_que: 'Sem um caso, a tese fica abstrata para a banca.' };
  return { texto: 'A próxima seção examina como as equipes participam da definição das rotas.' };
}
