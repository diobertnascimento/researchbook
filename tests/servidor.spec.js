// Servidor da chave (servidor/index.js), com o Google e o Gemini simulados aqui mesmo.
// Não abre navegador: os pedidos saem do próprio processo dos testes.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { criarServidor } from '../servidor/index.js';

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
