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
//   OPENALEX_CHAVE    a chave do OpenAlex (segredo, opcional: sem ela, a busca no OpenAlex fica desligada)
//   SITES_PAGINA      sites que o servidor pode abrir para ler os dados de um artigo (opcional; ver SITES)
//
// Dados de obras (v2.17.0), para o Acervo do app. As duas rotas pedem o mesmo login e contam no mesmo limite:
//   GET /obras/openalex?busca=...   procura por título, autor e ano no OpenAlex, com a chave dele
//   GET /obras/pagina?url=...       abre a página de um artigo e lê os dados que ela publica nas etiquetas
//                                   <meta name="citation_...">. Só abre https, só sites da lista, nunca um
//                                   endereço interno, e devolve só os campos lidos, nunca a página.
import { createServer } from 'node:http';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const MAX_CORPO = 30 * 1024 * 1024; // o Cloud Run aceita até 32 MB por pedido
const MODELO = /^gemini-[a-z0-9.-]{1,60}$/;
const ARQUIVO = /^[a-z0-9-]{1,80}$/;
const CABECALHOS_DE_ENVIO = ['x-goog-upload-protocol', 'x-goog-upload-command', 'x-goog-upload-header-content-length', 'x-goog-upload-header-content-type'];

// Sites que o servidor aceita abrir. Vale o domínio e os subdomínios dele (periodicos.ufmg.br entra por ufmg.br).
// A lista é fechada de propósito: um servidor que abre qualquer endereço pode ser usado para alcançar
// serviços internos do Google Cloud. Para acrescentar um site, publique de novo com SITES_PAGINA.
export const SITES = ['scielo.br', 'scielo.org', 'redalyc.org', 'spell.org.br', 'anpad.org.br', 'fgv.br', 'emnuvens.com.br', 'ibict.br', 'usp.br', 'ufmg.br', 'unicamp.br', 'unesp.br', 'ufrgs.br', 'ufsc.br', 'ufrj.br', 'ufpr.br', 'unb.br'];
const MAX_PAGINA = 1_500_000; // bytes lidos de uma página
const PRAZO_PAGINA = 8000; // ms

/** Endereço que não é da internet pública (rede interna, a própria máquina, metadados da nuvem). */
export function enderecoInterno(ip) {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || a >= 224;
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x.startsWith('::ffff:')) return enderecoInterno(x.slice(7));
    return x === '::' || x === '::1' || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith('ff');
  }
  return true;
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', ordf: 'ª', ordm: 'º' };
// Letras acentuadas escritas por nome (&aacute;, &Ccedil;...), comuns em páginas antigas em português.
for (const [marca, letras] of Object.entries({ acute: 'aeiouAEIOU:áéíóúÁÉÍÓÚ', grave: 'aeiouAEIOU:àèìòùÀÈÌÒÙ', circ: 'aeiouAEIOU:âêîôûÂÊÎÔÛ', tilde: 'aonAON:ãõñÃÕÑ', uml: 'aeiouAEIOU:äëïöüÄËÏÖÜ', cedil: 'cC:çÇ' })) {
  const [de, para] = letras.split(':');
  [...de].forEach((l, i) => (ENTIDADES[l + marca] = [...para][i]));
}
const texto = (s) =>
  String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16) || 32))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d) || 32))
    .replace(/&([a-zA-Z]+);/g, (m, n) => ENTIDADES[n] ?? ENTIDADES[n.toLowerCase()] ?? m)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);

/** "Sobrenome, Prenomes" ou "Prenomes Sobrenome" vira { sobrenome, prenomes }. */
export function pessoa(nome) {
  const n = texto(nome);
  if (!n) return null;
  if (n.includes(',')) {
    const [s, ...r] = n.split(',');
    return { sobrenome: s.trim(), prenomes: r.join(',').trim() };
  }
  const p = n.split(' ');
  return p.length === 1 ? { sobrenome: p[0], prenomes: '' } : { sobrenome: p[p.length - 1], prenomes: p.slice(0, -1).join(' ') };
}

/** Lê as etiquetas <meta> de dados bibliográficos (citation_*, usadas pelo Google Acadêmico, e DC.*). */
export function lerEtiquetas(html) {
  const m = new Map();
  for (const [tag] of String(html).slice(0, MAX_PAGINA).matchAll(/<meta\b[^>]*>/gi)) {
    const at = {};
    for (const [, k, , v1, v2, v3] of tag.matchAll(/([a-zA-Z:._-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) at[k.toLowerCase()] = v1 ?? v2 ?? v3 ?? '';
    const nome = (at.name || at.property || '').toLowerCase();
    if (!nome || at.content == null) continue;
    if (!m.has(nome)) m.set(nome, []);
    m.get(nome).push(texto(at.content));
  }
  const um = (...nomes) => nomes.map((n) => m.get(n)?.find(Boolean)).find(Boolean) || null;
  const titulo = um('citation_title', 'dc.title', 'dcterms.title');
  if (!titulo) return null;
  const autores = (m.get('citation_author') || m.get('dc.creator') || m.get('dcterms.creator') || []).map(pessoa).filter(Boolean).slice(0, 40);
  const data = um('citation_publication_date', 'citation_date', 'citation_online_date', 'citation_year', 'dc.date', 'dcterms.issued', 'dc.date.issued');
  const ini = um('citation_firstpage');
  const fim = um('citation_lastpage');
  const doi = (um('citation_doi', 'dc.identifier.doi') || [...(m.get('dc.identifier') || [])].find((x) => /10\.\d{4,9}\//.test(x)) || '').match(/10\.\d{4,9}\/\S+/)?.[0] || null;
  const evento = um('citation_conference_title', 'citation_conference');
  const instituicao = um('citation_dissertation_institution');
  const livro = um('citation_inbook_title', 'citation_book_title');
  const revista = um('citation_journal_title');
  const tipo = revista ? 'artigo' : evento ? 'anais' : instituicao ? 'dissertacao' : livro ? 'capitulo' : um('citation_isbn') ? 'livro' : 'artigo';
  return {
    tipo,
    titulo,
    autores,
    ano: data?.match(/(1[5-9]|20)\d{2}/)?.[0] || null,
    veiculo: revista || evento || livro || null,
    volume: um('citation_volume'),
    numero: um('citation_issue'),
    paginas: ini ? (fim && fim !== ini ? `${ini}-${fim}` : ini) : null,
    editora: instituicao || um('citation_publisher', 'dc.publisher'),
    doi,
    idioma: um('citation_language', 'dc.language'),
  };
}

/** Uma obra do OpenAlex nos campos do app. */
export function deOpenAlex(w) {
  const fonte = w.primary_location?.source || {};
  const b = w.biblio || {};
  const TIPOS = { article: 'artigo', review: 'artigo', preprint: 'artigo', book: 'livro', 'book-chapter': 'capitulo', dissertation: 'dissertacao' };
  const tipo = fonte.type === 'conference' ? 'anais' : TIPOS[w.type] || 'artigo';
  return {
    tipo,
    titulo: texto(w.display_name || w.title),
    autores: (w.authorships || []).map((a) => pessoa(a.author?.display_name || a.raw_author_name)).filter(Boolean).slice(0, 40),
    ano: w.publication_year ? String(w.publication_year) : null,
    veiculo: fonte.display_name ? texto(fonte.display_name) : null,
    volume: b.volume || null,
    numero: b.issue || null,
    paginas: b.first_page ? (b.last_page && b.last_page !== b.first_page ? `${b.first_page}-${b.last_page}` : b.first_page) : null,
    doi: w.doi ? String(w.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') : null,
    idioma: w.language || null,
    idOpenAlex: typeof w.id === 'string' ? w.id.split('/').pop() : null,
  };
}
const CAMPOS_OPENALEX = 'id,doi,display_name,publication_year,type,authorships,primary_location,biblio,language';

/** Erro que vira resposta: o app lê "codigo" para dizer o que houve e o que fazer. */
class Recusa extends Error {
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

export function criarServidor(env = process.env, { buscar = fetch, agora = () => Date.now(), registro = (linha) => console.log(linha), resolver = (nome) => lookup(nome, { all: true }) } = {}) {
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
    chaveOpenAlex: env.OPENALEX_CHAVE || '',
    openalex: (env.URL_OPENALEX || 'https://api.openalex.org').replace(/\/$/, ''),
    sites: (env.SITES_PAGINA ? env.SITES_PAGINA.split(',') : SITES).map((s) => s.trim().toLowerCase().replace(/^\./, '')).filter(Boolean),
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

  /* ---------- Dados de obras ---------- */
  const siteAceito = (host) => cfg.sites.some((s) => host === s || host.endsWith('.' + s));
  /** Confere o endereço antes de abrir: https, site da lista, porta padrão e nenhum IP interno. */
  async function conferirEndereco(bruto) {
    let u;
    try {
      u = new URL(bruto);
    } catch {
      throw new Recusa(400, 'pagina-endereco', 'Isso não parece o endereço de uma página.');
    }
    const host = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || u.port || u.username || u.password || isIP(host)) throw new Recusa(400, 'pagina-endereco', 'O servidor só abre páginas https de sites conhecidos.');
    if (!siteAceito(host)) throw new Recusa(403, 'pagina-site', `O site ${host} não está na lista de sites que este servidor abre.`);
    let ips;
    try {
      ips = await resolver(host);
    } catch {
      throw new Recusa(502, 'pagina-fora', 'O site não foi encontrado.');
    }
    if (!ips.length || ips.some((i) => enderecoInterno(i.address))) throw new Recusa(403, 'pagina-site', 'O endereço deste site aponta para uma rede interna e não será aberto.');
    return u;
  }
  async function lerPagina(bruto) {
    let u = await conferirEndereco(bruto);
    const prazo = AbortSignal.timeout(PRAZO_PAGINA);
    let r;
    try {
      // Redirecionamento não é seguido às cegas: cada salto passa pela mesma conferência.
      for (let salto = 0; ; salto++) {
        r = await buscar(u.href, { redirect: 'manual', signal: prazo, headers: { Accept: 'text/html', 'User-Agent': 'researchbook (leitura dos dados de um artigo, a pedido do autor)' } });
        if (r.status < 300 || r.status >= 400) break;
        const destino = r.headers.get('location');
        if (!destino || salto >= 3) throw new Recusa(502, 'pagina-fora', 'A página redireciona demais para ser lida.');
        u = await conferirEndereco(new URL(destino, u).href);
      }
    } catch (e) {
      if (e instanceof Recusa) throw e;
      throw new Recusa(504, 'pagina-fora', 'O site não respondeu a tempo.');
    }
    if (!r.ok) throw new Recusa(502, 'pagina-fora', `O site respondeu com erro (${r.status}).`);
    if (!/html/i.test(r.headers.get('content-type') || '')) throw new Recusa(422, 'pagina-sem-dados', 'Este endereço não é uma página (pode ser um PDF). Cole o endereço da página do artigo.');
    // Lê só o começo: as etiquetas ficam no cabeçalho da página.
    const leitor = r.body.getReader();
    const partes = [];
    let lidos = 0;
    while (lidos < MAX_PAGINA) {
      const { done, value } = await leitor.read();
      if (done) break;
      partes.push(value);
      lidos += value.length;
    }
    leitor.cancel().catch(() => {});
    const dados = lerEtiquetas(new TextDecoder('utf-8').decode(Buffer.concat(partes)));
    if (!dados) throw new Recusa(422, 'pagina-sem-dados', 'Esta página não publica os dados do artigo de um jeito que dê para ler. Tente pelo DOI ou cole a referência.');
    return { dados: { ...dados, url: u.href }, site: u.hostname };
  }
  async function procurarNoOpenAlex(busca) {
    if (!cfg.chaveOpenAlex) throw new Recusa(503, 'openalex-sem-chave', 'Este servidor foi publicado sem a chave do OpenAlex. Rode a publicação de novo para guardar a chave.');
    const base = `${cfg.openalex}/works?per_page=5&search=${encodeURIComponent(busca)}`;
    const h = { Authorization: `Bearer ${cfg.chaveOpenAlex}`, Accept: 'application/json' };
    let r = await buscar(`${base}&select=${CAMPOS_OPENALEX}`, { headers: h });
    // Pedido recusado por causa dos campos escolhidos: tenta uma vez sem escolher.
    if (r.status === 400) r = await buscar(base, { headers: h });
    if (r.status === 401 || r.status === 403) throw new Recusa(502, 'openalex-chave', 'O OpenAlex recusou a chave guardada no servidor. Confira a chave e publique de novo.');
    if (r.status === 429) throw new Recusa(429, 'openalex-limite', 'A franquia do dia no OpenAlex acabou. Ela volta amanhã.');
    if (!r.ok) throw new Recusa(502, 'openalex-fora', `O OpenAlex não respondeu agora (${r.status}).`);
    const j = await r.json();
    return { candidatos: (j.results || []).map(deOpenAlex).filter((c) => c.titulo) };
  }

  async function atender(req) {
    const endereco = new URL(req.url, 'http://x');
    const caminho = endereco.pathname;
    if (!cfg.chave || !cfg.email || !cfg.cliente) throw new Recusa(500, 'config', 'O servidor foi publicado sem a chave, o e-mail ou o cliente do Google. Rode a publicação de novo.');
    await conferirLogin(req);

    if (req.method === 'GET' && caminho === '/estado') {
      return { status: 200, corpo: JSON.stringify({ ok: true, pedidosHoje: await contar(0), limite: cfg.limite }) };
    }

    if (req.method === 'GET' && caminho === '/obras/openalex') {
      const busca = (endereco.searchParams.get('busca') || '').trim().slice(0, 300);
      if (busca.length < 3) throw new Recusa(400, 'pedido', 'Diga o que procurar: título, autor ou ano.');
      await gastarUm();
      return { status: 200, corpo: JSON.stringify(await procurarNoOpenAlex(busca)) };
    }
    if (req.method === 'GET' && caminho === '/obras/pagina') {
      const url = (endereco.searchParams.get('url') || '').trim().slice(0, 2000);
      await conferirEndereco(url);
      await gastarUm();
      return { status: 200, corpo: JSON.stringify(await lerPagina(url)) };
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
      const deObras = (req.url || '').startsWith('/obras/');
      const recusa = e instanceof Recusa ? e : deObras ? new Recusa(502, 'obras-fora', 'O servidor não conseguiu buscar os dados agora.') : new Recusa(502, 'gemini', 'O servidor não conseguiu falar com o Gemini agora.');
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
