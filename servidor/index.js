// Servidor da chave do Gemini (Cloud Run). Sem dependências: só o Node.
//
// O que ele faz: recebe do app os mesmos pedidos que iriam direto ao Gemini, confere que o login Google
// é o da conta cadastrada, conta o pedido no limite do dia e só então repassa ao Gemini com a chave.
// A chave fica no Secret Manager e chega aqui por variável de ambiente; nunca vai para o navegador,
// para os registros nem para o repositório.
//
// O que ele NÃO guarda: texto de pedido, resposta, e-mail ou token. O registro de cada pedido tem só
// rota, resultado e tempo.
//
// Variáveis (definidas na publicação, servidor/publicar.sh):
//   GEMINI_CHAVE      a chave (segredo)
//   EMAIL_PERMITIDO   o único e-mail atendido
//   CLIENTE_GOOGLE    o ID do cliente OAuth do app (público, public/js/config.js)
//   ORIGENS           endereços do app aceitos, separados por vírgula
//   LIMITE_DIA        pedidos por dia (padrão 300)
//   CONTADOR          'firestore' (padrão) ou 'memoria' (testes)
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const MAX_CORPO = 30 * 1024 * 1024; // o Cloud Run aceita até 32 MB por pedido
const MODELO = /^gemini-[a-z0-9.-]{1,60}$/;
const ARQUIVO = /^[a-z0-9-]{1,80}$/;
const CABECALHOS_DE_ENVIO = ['x-goog-upload-protocol', 'x-goog-upload-command', 'x-goog-upload-header-content-length', 'x-goog-upload-header-content-type'];

/** Erro que vira resposta: o app lê "codigo" para dizer o que houve e o que fazer. */
class Recusa extends Error {
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

export function criarServidor(env = process.env, { buscar = fetch, agora = () => Date.now(), registro = (linha) => console.log(linha) } = {}) {
  const cfg = {
    chave: env.GEMINI_CHAVE || '',
    email: (env.EMAIL_PERMITIDO || '').trim().toLowerCase(),
    cliente: (env.CLIENTE_GOOGLE || '').trim(),
    origens: (env.ORIGENS || '').split(',').map((s) => s.trim()).filter(Boolean),
    limite: Math.max(1, Number(env.LIMITE_DIA) || 300),
    contador: env.CONTADOR || 'firestore',
    gemini: (env.URL_GEMINI || 'https://generativelanguage.googleapis.com').replace(/\/$/, ''),
    tokeninfo: env.URL_TOKENINFO || 'https://oauth2.googleapis.com/tokeninfo',
    firestore: (env.URL_FIRESTORE || 'https://firestore.googleapis.com').replace(/\/$/, ''),
    metadados: (env.URL_METADADOS || 'http://metadata.google.internal').replace(/\/$/, ''),
  };

  /* ---------- Quem está pedindo ---------- */
  // Token já conferido: guarda só o resumo (SHA-256) e a validade, nunca o token.
  const conferidos = new Map();
  async function conferirLogin(req) {
    const m = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || '');
    if (!m) throw new Recusa(401, 'login', 'Falta o login Google no pedido.');
    const resumo = createHash('sha256').update(m[1]).digest('hex');
    const vale = conferidos.get(resumo);
    if (vale && vale > agora()) return;
    let info;
    try {
      const r = await buscar(cfg.tokeninfo, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `access_token=${encodeURIComponent(m[1])}` });
      if (!r.ok) throw new Recusa(401, 'login', 'O Google não reconheceu este login. Reconecte ao Google no app.');
      info = await r.json();
    } catch (e) {
      if (e instanceof Recusa) throw e;
      throw new Recusa(503, 'google', 'Não deu para conferir o login com o Google agora.');
    }
    // O token precisa ter sido emitido para o app (e não para outro site) e ser da conta cadastrada.
    if (!cfg.cliente || (info.aud !== cfg.cliente && info.azp !== cfg.cliente)) throw new Recusa(401, 'login', 'Este login não foi feito pelo researchbook.');
    if (String(info.email_verified) !== 'true' || !info.email || info.email.toLowerCase() !== cfg.email) throw new Recusa(403, 'conta', 'Este servidor só atende a conta cadastrada nele.');
    const resta = Math.max(0, Number(info.expires_in) || 0) * 1000;
    if (!resta) throw new Recusa(401, 'login', 'O login venceu. Reconecte ao Google no app.');
    if (conferidos.size > 50) conferidos.clear();
    conferidos.set(resumo, agora() + resta);
  }

  /* ---------- Limite do dia ---------- */
  const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(agora()));
  const memoria = new Map();
  let acesso = null; // token da conta de serviço do próprio Cloud Run, para falar com o Firestore
  let projeto = null;
  async function credencialDoServico() {
    if (acesso && acesso.vale > agora() + 60_000) return acesso.token;
    const h = { 'Metadata-Flavor': 'Google' };
    const r = await buscar(`${cfg.metadados}/computeMetadata/v1/instance/service-accounts/default/token`, { headers: h });
    if (!r.ok) throw new Error('metadados');
    const j = await r.json();
    acesso = { token: j.access_token, vale: agora() + (Number(j.expires_in) || 300) * 1000 };
    if (!projeto) projeto = env.GOOGLE_CLOUD_PROJECT || (await (await buscar(`${cfg.metadados}/computeMetadata/v1/project/project-id`, { headers: h })).text()).trim();
    return acesso.token;
  }
  /** Soma n aos pedidos de hoje e devolve o total (n = 0 só lê). */
  async function contar(n) {
    const dia = hoje();
    if (cfg.contador === 'memoria') {
      memoria.set(dia, (memoria.get(dia) || 0) + n);
      return memoria.get(dia);
    }
    try {
      const token = await credencialDoServico();
      const base = `projects/${projeto}/databases/(default)/documents`;
      const r = await buscar(`${cfg.firestore}/v1/${base}:commit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes: [{ transform: { document: `${base}/uso/${dia}`, fieldTransforms: [{ fieldPath: 'pedidos', increment: { integerValue: String(n) } }] } }] }),
      });
      if (!r.ok) throw new Error(`firestore ${r.status}`);
      const j = await r.json();
      return Number(j.writeResults?.[0]?.transformResults?.[0]?.integerValue ?? NaN);
    } catch {
      // Sem conseguir contar, o servidor não repassa: um limite que falha aberto não é limite.
      throw new Recusa(503, 'contador', 'O servidor não conseguiu conferir o limite do dia. Tente de novo em instantes.');
    }
  }
  async function gastarUm() {
    const total = await contar(1);
    if (!(total <= cfg.limite)) throw new Recusa(429, 'limite-dia', `O limite de ${cfg.limite} pedidos por dia deste servidor foi atingido. Ele zera à meia-noite.`);
  }

  /* ---------- Pedido e resposta ---------- */
  function cors(req) {
    const origem = req.headers.origin;
    if (!origem || !cfg.origens.includes(origem)) return null;
    return {
      'Access-Control-Allow-Origin': origem,
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': ['authorization', 'content-type', ...CABECALHOS_DE_ENVIO].join(', '),
      'Access-Control-Expose-Headers': 'x-goog-upload-url, x-goog-upload-status',
      'Access-Control-Max-Age': '3600',
    };
  }
  function lerCorpo(req) {
    return new Promise((ok, erro) => {
      const partes = [];
      let tamanho = 0;
      req.on('data', (p) => {
        tamanho += p.length;
        if (tamanho > MAX_CORPO) {
          erro(new Recusa(413, 'grande', 'O pedido passa de 30 MB. Envie o arquivo pelo envio de arquivos do app.'));
          req.destroy();
        } else partes.push(p);
      });
      req.on('end', () => ok(Buffer.concat(partes)));
      req.on('error', () => erro(new Recusa(400, 'pedido', 'O pedido chegou incompleto.')));
    });
  }
  const paraOGemini = (extra = {}) => ({ 'x-goog-api-key': cfg.chave, ...extra });

  async function atender(req) {
    const caminho = new URL(req.url, 'http://x').pathname;
    if (!cfg.chave || !cfg.email || !cfg.cliente) throw new Recusa(500, 'config', 'O servidor foi publicado sem a chave, o e-mail ou o cliente do Google. Rode a publicação de novo.');
    await conferirLogin(req);

    if (req.method === 'GET' && caminho === '/estado') {
      return { status: 200, corpo: JSON.stringify({ ok: true, pedidosHoje: await contar(0), limite: cfg.limite }) };
    }

    let m = /^\/v1beta\/models\/([^/:]+):generateContent$/.exec(caminho);
    if (req.method === 'POST' && m) {
      if (!MODELO.test(m[1])) throw new Recusa(400, 'pedido', 'Modelo não aceito por este servidor.');
      const corpo = await lerCorpo(req);
      await gastarUm();
      const r = await buscar(`${cfg.gemini}/v1beta/models/${m[1]}:generateContent`, { method: 'POST', headers: paraOGemini({ 'Content-Type': 'application/json' }), body: corpo });
      return { status: r.status, corpo: await r.text() };
    }

    if (req.method === 'POST' && caminho === '/upload/v1beta/files') {
      const corpo = await lerCorpo(req);
      await gastarUm();
      const h = paraOGemini({ 'Content-Type': 'application/json' });
      for (const n of CABECALHOS_DE_ENVIO) if (req.headers[n]) h[n] = req.headers[n];
      const r = await buscar(`${cfg.gemini}/upload/v1beta/files`, { method: 'POST', headers: h, body: corpo });
      const destino = r.headers.get('x-goog-upload-url') || '';
      // O endereço de envio vale só para este arquivo. Se algum dia ele trouxer a chave, não é repassado.
      if (destino.includes(cfg.chave)) throw new Recusa(502, 'envio', 'O Gemini devolveu um endereço de envio que este servidor não pode repassar.');
      return { status: r.status, corpo: await r.text(), extra: destino ? { 'x-goog-upload-url': destino } : {} };
    }

    m = /^\/v1beta\/files\/([^/]+)$/.exec(caminho);
    if (req.method === 'GET' && m) {
      if (!ARQUIVO.test(m[1])) throw new Recusa(400, 'pedido', 'Nome de arquivo não aceito.');
      const r = await buscar(`${cfg.gemini}/v1beta/files/${m[1]}`, { headers: paraOGemini() });
      return { status: r.status, corpo: await r.text() };
    }

    throw new Recusa(404, 'rota', 'Este servidor não atende este endereço.');
  }

  return createServer(async (req, res) => {
    const inicio = agora();
    const base = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    const c = cors(req);
    let status = 500;
    try {
      // Pedido vindo de uma página que não é o app é recusado antes de qualquer coisa.
      if (req.headers.origin && !c) throw new Recusa(403, 'origem', 'Este servidor só atende o researchbook.');
      if (req.method === 'OPTIONS') {
        status = 204;
        res.writeHead(204, c || {});
        return res.end();
      }
      const r = await atender(req);
      status = r.status;
      res.writeHead(r.status, { ...base, ...(c || {}), ...(r.extra || {}) });
      res.end(r.corpo);
    } catch (e) {
      const recusa = e instanceof Recusa ? e : new Recusa(502, 'gemini', 'O servidor não conseguiu falar com o Gemini agora.');
      status = recusa.status;
      res.writeHead(status, { ...base, ...(c || {}) });
      res.end(JSON.stringify({ error: { message: recusa.message, status: recusa.codigo, origem: 'servidor', codigo: recusa.codigo } }));
    } finally {
      // Registro sem conteúdo: rota, resultado e tempo.
      registro(JSON.stringify({ rota: `${req.method} ${new URL(req.url, 'http://x').pathname.replace(/models\/[^:]+/, 'models/…').replace(/files\/.+/, 'files/…')}`, status, ms: agora() - inicio }));
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const porta = Number(process.env.PORT) || 8080;
  criarServidor().listen(porta, () => console.log(JSON.stringify({ evento: 'no ar', porta })));
}
