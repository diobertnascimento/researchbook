// Servidor da chave (servidor/index.js), com o Google e o Gemini simulados aqui mesmo.
// Não abre navegador: os pedidos saem do próprio processo dos testes.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { criarServidor, VERSAO_SERVIDOR } from '../servidor/index.js';

const CHAVE = 'chave-de-teste-AIzaFALSA-0000';
const CLIENTE = 'cliente-do-app.apps.googleusercontent.com';
const EMAIL = 'autora@exemplo.org';
const APP = 'https://app.exemplo.org';

const ouvir = (servidor) => new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(`http://127.0.0.1:${servidor.address().port}`)));
const fechar = (servidor) => new Promise((ok) => servidor.close(ok));

/** Sobe o Google simulado (login, Gemini, Firestore e metadados) e o servidor da chave apontando para ele. */
async function montar(env = {}, { firestoreFalha = false, envioComChave = false, registro = () => {} } = {}) {
  const visto = { tokeninfo: 0, gemini: [], firestore: [], metadados: 0 };
  let total = 0;
  const google = createServer(async (req, res) => {
    const partes = [];
    for await (const p of req) partes.push(p);
    const corpo = Buffer.concat(partes).toString();
    const responder = (status, json, extra = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...extra });
      res.end(JSON.stringify(json));
    };
    if (req.url === '/tokeninfo') {
      visto.tokeninfo++;
      const token = new URLSearchParams(corpo).get('access_token');
      const contas = {
        'token-bom': { aud: CLIENTE, azp: CLIENTE, email: EMAIL, email_verified: 'true', expires_in: '3000' },
        'token-de-outro-site': { aud: 'outro.apps.googleusercontent.com', azp: 'outro.apps.googleusercontent.com', email: EMAIL, email_verified: 'true', expires_in: '3000' },
        'token-de-outra-conta': { aud: CLIENTE, email: 'intruso@exemplo.org', email_verified: 'true', expires_in: '3000' },
        'token-sem-conferir': { aud: CLIENTE, email: EMAIL, email_verified: 'false', expires_in: '3000' },
      };
      return contas[token] ? responder(200, contas[token]) : responder(400, { error: 'invalid_token' });
    }
    if (req.url.startsWith('/computeMetadata/')) {
      visto.metadados++;
      if (req.headers['metadata-flavor'] !== 'Google') return responder(403, {});
      if (req.url.endsWith('/token')) return responder(200, { access_token: 'token-do-servico', expires_in: 3000 });
      res.writeHead(200);
      return res.end('projeto-de-teste');
    }
    if (req.url.includes(':commit')) {
      visto.firestore.push({ url: req.url, auth: req.headers.authorization, corpo: JSON.parse(corpo) });
      if (firestoreFalha) return responder(500, {});
      total += Number(JSON.parse(corpo).writes[0].transform.fieldTransforms[0].increment.integerValue);
      return responder(200, { writeResults: [{ transformResults: [{ integerValue: String(total) }] }] });
    }
    visto.gemini.push({ metodo: req.method, url: req.url, cabecalhos: req.headers, corpo });
    if (req.url === '/upload/v1beta/files') return responder(200, {}, { 'x-goog-upload-url': `${req.headers.host ? 'https://envio.exemplo.org' : ''}/upload?upload_id=abc${envioComChave ? `&key=${CHAVE}` : ''}` });
    if (req.url.startsWith('/v1beta/files/')) return responder(200, { name: 'files/abc', state: 'ACTIVE' });
    if (req.url.includes('modelo-fora-do-ar')) return responder(503, { error: { message: 'overloaded', status: 'UNAVAILABLE' } });
    return responder(200, { candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 1 } });
  });
  const g = await ouvir(google);
  const servidor = criarServidor({ GEMINI_CHAVE: CHAVE, EMAIL_PERMITIDO: EMAIL, CLIENTE_GOOGLE: CLIENTE, ORIGENS: `${APP},http://localhost:4173`, CONTADOR: 'memoria', URL_GEMINI: g, URL_TOKENINFO: `${g}/tokeninfo`, URL_FIRESTORE: g, URL_METADADOS: g, ...env }, { registro });
  const base = await ouvir(servidor);
  const pedir = (caminho, { token = 'token-bom', origem = APP, ...opcoes } = {}) =>
    fetch(`${base}${caminho}`, { ...opcoes, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origem ? { Origin: origem } : {}), ...(opcoes.headers || {}) } });
  return { pedir, visto, fim: () => Promise.all([fechar(servidor), fechar(google)]) };
}
const gerar = (s, opcoes = {}) => s.pedir('/v1beta/models/gemini-3.8-flash:generateContent', { method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: 'um texto do autor' }] }] }), ...opcoes });

test.describe('servidor da chave', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Sem navegador: roda uma vez só'));

  test('só atende o login do app e da conta cadastrada', async () => {
    const s = await montar();
    try {
      const casos = [
        [null, 401, 'login'],
        ['token-inventado', 401, 'login'],
        ['token-de-outro-site', 401, 'login'],
        ['token-de-outra-conta', 403, 'conta'],
        ['token-sem-conferir', 403, 'conta'],
      ];
      for (const [token, status, codigo] of casos) {
        const r = await gerar(s, { token });
        expect(r.status, token || 'sem token').toBe(status);
        const j = await r.json();
        expect(j.error.origem).toBe('servidor');
        expect(j.error.codigo).toBe(codigo);
      }
      // Nenhum pedido recusado chegou ao Gemini.
      expect(s.visto.gemini).toHaveLength(0);
    } finally {
      await s.fim();
    }
  });

  test('repassa o pedido com a chave, sem o login, e a chave nunca volta para o app nem aparece no registro', async () => {
    const linhas = [];
    const s = await montar({}, { registro: (linha) => linhas.push(linha) });
    try {
      const r = await gerar(s);
      expect(r.status).toBe(200);
      const texto = await r.text();
      expect(JSON.parse(texto).candidates[0].content.parts[0].text).toBe('ok');
      expect(r.headers.get('access-control-allow-origin')).toBe(APP);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const [p] = s.visto.gemini;
      expect(p.url).toBe('/v1beta/models/gemini-3.8-flash:generateContent');
      expect(p.cabecalhos['x-goog-api-key']).toBe(CHAVE);
      expect(p.cabecalhos.authorization).toBeUndefined();
      expect(JSON.parse(p.corpo).contents[0].parts[0].text).toBe('um texto do autor');
      expect(texto + JSON.stringify([...r.headers])).not.toContain(CHAVE);

      // O mesmo login não é conferido de novo no Google a cada pedido.
      await gerar(s);
      expect(s.visto.tokeninfo).toBe(1);

      // Erro do Gemini passa como veio, para o app explicar.
      const fora = await s.pedir('/v1beta/models/gemini-modelo-fora-do-ar:generateContent', { method: 'POST', body: '{}' });
      expect(fora.status).toBe(503);
      expect((await fora.json()).error.status).toBe('UNAVAILABLE');

      const registro = linhas.join('\n');
      expect(registro).toContain('"status":200');
      expect(registro).not.toContain(CHAVE);
      expect(registro).not.toContain('token-bom');
      expect(registro).not.toContain(EMAIL);
      expect(registro).not.toContain('um texto do autor');
    } finally {
      await s.fim();
    }
  });

  test('limite do dia: passa do limite, recusa sem chamar o Gemini; /estado mostra a contagem', async () => {
    const s = await montar({ LIMITE_DIA: '2' });
    try {
      expect((await gerar(s)).status).toBe(200);
      expect((await gerar(s)).status).toBe(200);
      const r = await gerar(s);
      expect(r.status).toBe(429);
      const j = await r.json();
      expect(j.error.codigo).toBe('limite-dia');
      expect(j.error.message).toContain('2 pedidos por dia');
      expect(s.visto.gemini).toHaveLength(2);
      const e = await (await s.pedir('/estado')).json();
      expect(e).toEqual({ ok: true, pedidosHoje: 3, limite: 2 });
    } finally {
      await s.fim();
    }
  });

  test('contagem no Firestore: soma com a conta de serviço; se o Firestore falha, nada é repassado', async () => {
    const s = await montar({ CONTADOR: 'firestore' });
    try {
      expect((await gerar(s)).status).toBe(200);
      const [c] = s.visto.firestore;
      expect(c.auth).toBe('Bearer token-do-servico');
      expect(c.url).toBe('/v1/projects/projeto-de-teste/databases/(default)/documents:commit');
      expect(c.corpo.writes[0].transform.document).toMatch(/^projects\/projeto-de-teste\/databases\/\(default\)\/documents\/uso\/\d{4}-\d{2}-\d{2}$/);
      expect(c.corpo.writes[0].transform.fieldTransforms[0]).toEqual({ fieldPath: 'pedidos', increment: { integerValue: '1' } });
    } finally {
      await s.fim();
    }
    const f = await montar({ CONTADOR: 'firestore' }, { firestoreFalha: true });
    try {
      const r = await gerar(f);
      expect(r.status).toBe(503);
      expect((await r.json()).error.codigo).toBe('contador');
      expect(f.visto.gemini).toHaveLength(0);
    } finally {
      await f.fim();
    }
  });

  test('envio de arquivo: o início passa pelo servidor e o endereço de envio volta para o app, nunca com a chave', async () => {
    const cab = { 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': '1234', 'X-Goog-Upload-Header-Content-Type': 'audio/mp4' };
    const s = await montar();
    try {
      const r = await s.pedir('/upload/v1beta/files', { method: 'POST', headers: cab, body: JSON.stringify({ file: { display_name: 'aula' } }) });
      expect(r.status).toBe(200);
      expect(r.headers.get('x-goog-upload-url')).toBe('https://envio.exemplo.org/upload?upload_id=abc');
      expect(r.headers.get('access-control-expose-headers')).toContain('x-goog-upload-url');
      const [p] = s.visto.gemini;
      expect(p.cabecalhos['x-goog-upload-command']).toBe('start');
      expect(p.cabecalhos['x-goog-upload-header-content-length']).toBe('1234');
      expect(p.cabecalhos['x-goog-api-key']).toBe(CHAVE);
      const arq = await s.pedir('/v1beta/files/abc');
      expect((await arq.json()).state).toBe('ACTIVE');
      expect((await s.pedir('/v1beta/files/..%2F..%2Fmodels')).status).toBe(400);
    } finally {
      await s.fim();
    }
    const v = await montar({}, { envioComChave: true });
    try {
      const r = await v.pedir('/upload/v1beta/files', { method: 'POST', headers: cab, body: '{}' });
      expect(r.status).toBe(502);
      expect(r.headers.get('x-goog-upload-url')).toBeNull();
      expect(await r.text()).not.toContain(CHAVE);
    } finally {
      await v.fim();
    }
  });

  test('só o app chama: outra página é recusada, e o servidor mal configurado avisa', async () => {
    const s = await montar();
    try {
      const pre = await s.pedir('/v1beta/models/gemini-3.8-flash:generateContent', { method: 'OPTIONS', token: null, headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' } });
      expect(pre.status).toBe(204);
      expect(pre.headers.get('access-control-allow-origin')).toBe(APP);
      expect(pre.headers.get('access-control-allow-headers')).toContain('authorization');
      const fora = await gerar(s, { origem: 'https://pagina-de-terceiro.exemplo.org' });
      expect(fora.status).toBe(403);
      expect(fora.headers.get('access-control-allow-origin')).toBeNull();
      expect((await fora.json()).error.codigo).toBe('origem');
      expect((await s.pedir('/qualquer-coisa')).status).toBe(404);
      expect((await s.pedir('/v1beta/models/outro-modelo:generateContent', { method: 'POST', body: '{}' })).status).toBe(400);
      expect(s.visto.gemini).toHaveLength(0);
    } finally {
      await s.fim();
    }
    const semChave = await montar({ GEMINI_CHAVE: '' });
    try {
      const r = await gerar(semChave);
      expect(r.status).toBe(500);
      expect((await r.json()).error.codigo).toBe('config');
    } finally {
      await semChave.fim();
    }
  });
});

/* ---------- Dados de obras: OpenAlex (v2.17.0). A leitura de página de artigo saiu na v2.19.3. ---------- */

const CHAVE_OA = 'chave-openalex-de-teste-0000';
/** Sobe o servidor com o Google e o OpenAlex simulados. Qualquer outro endereço que ele tente abrir fica anotado. */
async function montarObras({ env = {}, openalex = null } = {}) {
  const visto = { abertos: [], openalex: [], linhas: [] };
  const buscar = async (url, opcoes = {}) => {
    const u = String(url);
    if (u.startsWith('https://tokeninfo.teste')) return new Response(JSON.stringify({ aud: CLIENTE, azp: CLIENTE, email: EMAIL, email_verified: 'true', expires_in: '3000' }), { status: 200 });
    if (u.startsWith('https://openalex.teste')) {
      visto.openalex.push({ url: u, auth: opcoes.headers?.Authorization });
      return openalex ? openalex(u, opcoes) : new Response(JSON.stringify({ results: [] }), { status: 200 });
    }
    visto.abertos.push(u);
    return new Response('nada aqui', { status: 404 });
  };
  const servidor = criarServidor(
    { GEMINI_CHAVE: CHAVE, EMAIL_PERMITIDO: EMAIL, CLIENTE_GOOGLE: CLIENTE, ORIGENS: APP, CONTADOR: 'memoria', URL_TOKENINFO: 'https://tokeninfo.teste', URL_OPENALEX: 'https://openalex.teste', OPENALEX_CHAVE: CHAVE_OA, ...env },
    { buscar, registro: (l) => visto.linhas.push(l) },
  );
  const base = await ouvir(servidor);
  const pedir = (caminho, { token = 'token-bom', origem = APP, corpo } = {}) =>
    fetch(`${base}${caminho}`, {
      method: corpo === undefined ? 'GET' : 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origem ? { Origin: origem } : {}), ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: corpo === undefined ? undefined : typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
    });
  // Como o app pede desde a v2.19.2: no corpo. O jeito antigo (no endereço) tem teste próprio.
  const procurar = (busca, o) => pedir('/obras/openalex', { ...o, corpo: { busca } });
  const registros = () => visto.linhas.map((l) => JSON.parse(l));
  return { pedir, openalex: procurar, registros, visto, fim: () => fechar(servidor) };
}

test.describe('servidor: dados de obras', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Sem navegador: roda uma vez só'));

  test('o servidor não abre página de site nenhum: a rota de leitura por link não existe mais', async () => {
    const s = await montarObras();
    try {
      for (const pedido of [{ corpo: { url: 'https://www.scielo.br/j/gpr/a/exemplo' } }, {}]) {
        const r = await s.pedir(pedido.corpo ? '/obras/pagina' : '/obras/pagina?url=' + encodeURIComponent('https://www.scielo.br/j/gpr/a/exemplo'), pedido);
        expect([r.status, (await r.json()).error.codigo]).toEqual([404, 'rota']);
      }
      expect(s.visto.abertos).toEqual([]);
      // O registro diz o código da recusa, sem o endereço pedido.
      expect(s.registros().at(-1)).toEqual({ rota: 'GET /obras/pagina', status: 404, ms: expect.any(Number), codigo: 'rota' });
      expect(s.visto.linhas.join('\n')).not.toMatch(/scielo|https?:/);
    } finally {
      await s.fim();
    }
  });

  test('OpenAlex: a chave vai só do servidor para o OpenAlex, e a resposta volta nos campos do app', async () => {
    const obra = { id: 'https://openalex.org/W123', doi: 'https://doi.org/10.0000/falcao.2017', display_name: 'Design science em pesquisas de operações', publication_year: 2017, type: 'article', authorships: [{ author: { display_name: 'Renata Falcão' } }], primary_location: { source: { display_name: 'Anais do Encontro Fictício de Produção', type: 'conference' } }, biblio: { first_page: '112', last_page: '126' }, language: 'pt' };
    let recusarSelect = false;
    const s = await montarObras({
      openalex: (u) => (recusarSelect && u.includes('select=') ? new Response('{"error":"Invalid query parameters"}', { status: 400 }) : new Response(JSON.stringify({ results: [obra, { display_name: '' }] }), { status: 200 })),
    });
    try {
      const r = await s.openalex('Design science em pesquisas de operações Falcão 2017');
      expect(r.status).toBe(200);
      expect(s.visto.openalex[0].url).toContain(encodeURIComponent('Falcão 2017'));
      const j = await r.json();
      expect(j.candidatos).toEqual([{ tipo: 'anais', titulo: 'Design science em pesquisas de operações', autores: [{ sobrenome: 'Falcão', prenomes: 'Renata' }], ano: '2017', veiculo: 'Anais do Encontro Fictício de Produção', volume: null, numero: null, paginas: '112-126', doi: '10.0000/falcao.2017', idioma: 'pt', idOpenAlex: 'W123' }]);
      expect(s.visto.openalex[0].auth).toBe(`Bearer ${CHAVE_OA}`);
      expect(s.visto.openalex[0].url).not.toContain(CHAVE_OA);
      expect(JSON.stringify(j) + [...r.headers].join()).not.toContain(CHAVE_OA);
      expect(s.visto.linhas.join('\n')).not.toMatch(/Falc|Design|chave-openalex/);
      expect(s.registros().at(-1)).toMatchObject({ rota: 'POST /obras/openalex', status: 200 });
      // Só o Google e o OpenAlex foram chamados.
      expect(s.visto.abertos).toEqual([]);
      // Toda resposta diz a versão do servidor, e o app consegue ler; vale também sem login.
      expect(r.headers.get('x-researchbook-servidor')).toBe(VERSAO_SERVIDOR);
      expect(r.headers.get('access-control-expose-headers')).toContain('x-researchbook-servidor');
      expect((await s.openalex('design science', { token: null })).headers.get('x-researchbook-servidor')).toBe(VERSAO_SERVIDOR);
      // Pedido que não é um objeto em JSON, ou grande demais, é recusado sem ir ao OpenAlex.
      const idas = s.visto.openalex.length;
      expect((await s.pedir('/obras/openalex', { corpo: 'isso não é json' })).status).toBe(400);
      expect((await s.pedir('/obras/openalex', { corpo: '[1]' })).status).toBe(400);
      expect((await s.pedir('/obras/openalex', { corpo: { busca: 'design science', sobra: 'x'.repeat(9000) } })).status).toBe(413);
      expect(s.visto.openalex.length).toBe(idas);
      // Se o OpenAlex recusar os campos escolhidos, o servidor repete sem escolher.
      recusarSelect = true;
      const r2 = await s.pedir('/obras/openalex?busca=design%20science');
      expect((await r2.json()).candidatos).toHaveLength(1);
      // Busca vazia não vai ao OpenAlex nem conta; sem login, 401.
      expect((await s.pedir('/obras/openalex?busca=a')).status).toBe(400);
      expect((await s.pedir('/obras/openalex?busca=design', { token: null })).status).toBe(401);
      expect((await (await s.pedir('/estado')).json()).pedidosHoje).toBe(2);
    } finally {
      await s.fim();
    }
  });

  test('OpenAlex sem chave, com chave recusada ou sem franquia: cada caso diz o que fazer', async () => {
    const sem = await montarObras({ env: { OPENALEX_CHAVE: '' } });
    try {
      const r = await sem.pedir('/obras/openalex?busca=design%20science');
      expect([r.status, (await r.json()).error.codigo]).toEqual([503, 'openalex-sem-chave']);
      expect(sem.visto.openalex).toEqual([]);
    } finally {
      await sem.fim();
    }
    for (const [status, codigo, esperado] of [[401, 'openalex-chave', 502], [429, 'openalex-limite', 429], [500, 'openalex-fora', 502]]) {
      const s = await montarObras({ openalex: () => new Response('{}', { status }) });
      try {
        const r = await s.pedir('/obras/openalex?busca=design%20science');
        expect([r.status, (await r.json()).error.codigo]).toEqual([esperado, codigo]);
      } finally {
        await s.fim();
      }
    }
  });
});
