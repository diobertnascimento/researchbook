// Google simulado para os testes: login (OAuth), conferência do token e uma versão mínima da API do Drive.
// Nada sai para a internet; tudo responde dentro do navegador do teste.

export const CLIENTE = 'teste-123.apps.googleusercontent.com';
export const DRIVE_FILE = 'https://www.googleapis.com/auth/drive.file';
const PASTA = 'application/vnd.google-apps.folder';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
};

export async function googleFalso(context, opcoes = {}) {
  // ordem: o Google real devolve "state" antes do token (#state=...&access_token=...).
  const op = { email: 'autor@exemplo.com', escopos: ['openid', 'https://www.googleapis.com/auth/userinfo.email', DRIVE_FILE], aud: CLIENTE, negar: false, ordem: 'state-primeiro', ...opcoes };
  const estado = { tokenValido: true, revogado: false, chamadas: [] };
  const arquivos = new Map();
  let seq = 0;
  const agora = () => new Date(Date.now() + ++seq).toISOString();
  const novoId = () => `arq${++seq}`;

  await context.route('**/js/config.js', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: `export const GOOGLE_CLIENT_ID = '${CLIENTE}';
export const ESCOPOS = ['openid', 'https://www.googleapis.com/auth/userinfo.email', '${DRIVE_FILE}'];
export const ESCOPO_DRIVE = '${DRIVE_FILE}';`,
    }),
  );

  // Página de login: devolve na hora para o app, como se o usuário tivesse aceitado (ou negado).
  await context.route('https://accounts.google.com/**', (r) => {
    const u = new URL(r.request().url());
    estado.pedidoDeLogin = Object.fromEntries(u.searchParams);
    const st = u.searchParams.get('state');
    const token = `access_token=tok-falso&token_type=Bearer&expires_in=3599&scope=${encodeURIComponent(op.escopos.join(' '))}`;
    const resposta = op.negar ? 'error=access_denied' : token;
    const frag = op.ordem === 'state-primeiro' ? `state=${st}&${resposta}` : `${resposta}&state=${st}`;
    return r.fulfill({ status: 302, headers: { location: `${u.searchParams.get('redirect_uri')}#${frag}` } });
  });

  await context.route('https://oauth2.googleapis.com/**', (r) => {
    const u = new URL(r.request().url());
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    if (u.pathname === '/revoke') {
      estado.revogado = true;
      return r.fulfill({ status: 200, headers: CORS, body: '' });
    }
    if (!estado.tokenValido) return r.fulfill({ status: 400, headers: CORS, contentType: 'application/json', body: '{"error_description":"Invalid Value"}' });
    return r.fulfill({
      status: 200,
      headers: CORS,
      contentType: 'application/json',
      body: JSON.stringify({ aud: op.aud, scope: op.escopos.join(' '), email: op.email, expires_in: '3599' }),
    });
  });

  const atende = (q, a) => {
    let m;
    if ((m = q.match(/appProperties has \{ key='([^']+)' and value='([^']+)' \}/)) && a.appProperties?.[m[1]] !== m[2]) return false;
    if ((m = q.match(/name = '((?:[^'\\]|\\.)*)'/)) && a.name !== m[1].replace(/\\(.)/g, '$1')) return false;
    if ((m = q.match(/'([^']+)' in parents/)) && !(a.parents || []).includes(m[1])) return false;
    if ((m = q.match(/mimeType = '([^']+)'/)) && a.mimeType !== m[1]) return false;
    return true;
  };
  const meta = (a) => ({ id: a.id, name: a.name, mimeType: a.mimeType, modifiedTime: a.modifiedTime });
  const json = (corpo, status = 200) => ({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(corpo) });

  await context.route('https://www.googleapis.com/**', async (r) => {
    const req = r.request();
    const u = new URL(req.url());
    const metodo = req.method();
    if (metodo === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    estado.chamadas.push(`${metodo} ${u.pathname}`);
    if (!estado.tokenValido || req.headers().authorization !== 'Bearer tok-falso') return r.fulfill(json({ error: { code: 401 } }, 401));

    if (metodo === 'GET' && u.pathname === '/drive/v3/files') {
      const q = u.searchParams.get('q') || '';
      return r.fulfill(json({ files: [...arquivos.values()].filter((a) => atende(q, a)).map(meta) }));
    }
    if (metodo === 'POST' && u.pathname === '/drive/v3/files') {
      const m = JSON.parse(req.postData());
      const a = { id: novoId(), name: m.name, mimeType: m.mimeType, parents: m.parents || [], appProperties: m.appProperties, modifiedTime: agora() };
      arquivos.set(a.id, a);
      return r.fulfill(json(meta(a)));
    }
    if (metodo === 'POST' && u.pathname === '/upload/drive/v3/files') {
      const limite = req.headers()['content-type'].match(/boundary=(.+)$/)[1];
      const partes = req.postData().split(`--${limite}`).slice(1, -1).map((p) => p.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, ''));
      const m = JSON.parse(partes[0]);
      const a = { id: novoId(), name: m.name, mimeType: m.mimeType, parents: m.parents || [], conteudo: partes[1], modifiedTime: agora() };
      arquivos.set(a.id, a);
      return r.fulfill(json({ id: a.id, modifiedTime: a.modifiedTime }));
    }
    let m;
    if (metodo === 'PATCH' && (m = u.pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/))) {
      const a = arquivos.get(m[1]);
      if (!a) return r.fulfill(json({ error: { code: 404 } }, 404));
      a.conteudo = req.postData();
      a.modifiedTime = agora();
      return r.fulfill(json({ id: a.id, modifiedTime: a.modifiedTime }));
    }
    if (metodo === 'GET' && (m = u.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/)) && u.searchParams.get('alt') === 'media') {
      const a = arquivos.get(m[1]);
      return a ? r.fulfill({ status: 200, headers: CORS, body: a.conteudo ?? '' }) : r.fulfill(json({ error: { code: 404 } }, 404));
    }
    return r.fulfill(json({ error: { code: 400, message: `não simulado: ${metodo} ${u.pathname}` } }, 400));
  });

  /** Caminho do arquivo dentro da pasta researchbook, como "dados/leituras.json". */
  const caminho = (a) => {
    const nomes = [];
    let atual = a;
    while (atual && !atual.appProperties?.rb) {
      nomes.unshift(atual.name);
      atual = arquivos.get(atual.parents[0]);
    }
    return nomes.join('/');
  };
  const achar = (c) => [...arquivos.values()].find((a) => a.mimeType !== PASTA && caminho(a) === c);

  return {
    estado,
    arquivos,
    raiz: () => [...arquivos.values()].find((a) => a.appProperties?.rb === 'raiz'),
    caminhos: () => [...arquivos.values()].filter((a) => a.mimeType !== PASTA).map(caminho),
    ler: (c) => achar(c)?.conteudo ?? null,
    /** Simula outro aparelho mudando um arquivo no Drive. */
    escrever: (c, conteudo) => {
      const a = achar(c);
      a.conteudo = conteudo;
      a.modifiedTime = agora();
    },
  };
}
