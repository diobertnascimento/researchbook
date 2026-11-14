// Gemini simulado para os testes: guarda cada pedido (cabeçalhos e corpo) e responde como o Gemini.
// Por padrão, responde como um bom tutor: cita o item A1 com um trecho literal tirado do próprio pedido.
// Cenários: 'inventa-uma-vez' (primeira resposta cita fonte inexistente), 'sempre-inventa',
// 'api-desligada' (403), 'cota' (429 nas duas primeiras tentativas), 'fora-do-formato'.
export async function geminiFalso(context, { cenario = 'bom' } = {}) {
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
