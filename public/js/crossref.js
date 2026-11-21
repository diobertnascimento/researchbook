// Busca dos dados de uma obra pelo DOI no Crossref (serviço público e gratuito, sem login).
// Nenhum dado pessoal vai no pedido: só o DOI.

const API = 'https://api.crossref.org/works/';

/** Aceita "10.xxxx/yyy", "doi:10.xxxx/yyy" ou "https://doi.org/10.xxxx/yyy". Devolve o DOI limpo ou null. */
export function limparDOI(texto) {
  const m = String(texto || '')
    .trim()
    .match(/(10\.\d{4,9}\/\S+)/i);
  return m ? m[1].replace(/[.,;)\]]+$/, '') : null;
}

const TIPOS = {
  'journal-article': 'artigo',
  'book': 'livro',
  'monograph': 'livro',
  'edited-book': 'livro',
  'book-chapter': 'capitulo',
  'book-section': 'capitulo',
  'proceedings-article': 'anais',
  'dissertation': 'dissertacao',
};

const pessoa = (p) => ({ sobrenome: p.family || p.name || '', prenomes: p.given || '' });
const primeiro = (x) => (Array.isArray(x) ? x[0] : x) || '';
const limpar = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export function deCrossref(m) {
  const tipo = TIPOS[m.type] || 'artigo';
  const dp = (m.issued || m['published-print'] || m['published-online'] || m.published || {})['date-parts'];
  return {
    tipo,
    titulo: limpar(primeiro(m.title)),
    subtitulo: limpar(primeiro(m.subtitle)) || null,
    autores: (m.author || []).map(pessoa),
    organizadores: (m.editor || []).map(pessoa),
    ano: dp && dp[0] && dp[0][0] ? String(dp[0][0]) : null,
    veiculo: limpar(primeiro(m['container-title'])) || null,
    volume: m.volume || null,
    numero: m.issue || null,
    paginas: m.page || null,
    editora: tipo === 'artigo' ? null : m.publisher || null,
    local: m['publisher-location'] || null,
    doi: m.DOI || null,
    url: m.URL || null,
    idioma: m.language || null,
  };
}

export async function buscarDOI(entrada, { registrar } = {}) {
  const doi = limparDOI(entrada);
  if (!doi) return { erro: 'Isso não parece um DOI. Ele começa com 10. e tem uma barra, como 10.1057/ejis.2011.54.' };
  const inicio = performance.now();
  let r;
  try {
    r = await fetch(API + encodeURIComponent(doi), { headers: { Accept: 'application/json' } });
  } catch {
    registrar?.('erro', 'crossref.buscar', { det: 'sem conexão', st: 'erro' });
    return { erro: 'Sem conexão para buscar o DOI. Você pode preencher os dados à mão.' };
  }
  const dur = Math.round(performance.now() - inicio);
  if (r.status === 404) {
    registrar?.('arq', 'crossref.buscar', { det: '404', dur, st: 'aviso' });
    return { erro: 'Esse DOI não foi encontrado no Crossref. Confira o número ou preencha os dados à mão.' };
  }
  if (!r.ok) {
    registrar?.('erro', 'crossref.buscar', { det: String(r.status), dur, st: 'erro' });
    return { erro: `O Crossref não respondeu agora (${r.status}). Tente de novo ou preencha à mão.` };
  }
  const corpo = await r.json();
  registrar?.('arq', 'crossref.buscar', { det: 'ok', dur });
  return { dados: deCrossref(corpo.message || {}) };
}

/**
 * Procura obras no Crossref a partir dos dados da ficha (título, autores, ano), para achar o DOI que falta.
 * Só os dados bibliográficos vão no pedido. Devolve { candidatos: [ficha do Crossref] } ou { erro }.
 */
// Campos pedidos na procura. O Crossref recusa o pedido inteiro (erro 400) se um nome daqui não estiver
// na lista de campos que ele aceita em "select"; "language" não está nela (era a causa da procura que
// nunca achava nada, corrigida na v2.15.1). Um teste confere esta lista contra a do Crossref.
export const CAMPOS_PROCURA = ['DOI', 'title', 'subtitle', 'author', 'editor', 'issued', 'container-title', 'type', 'volume', 'issue', 'page', 'publisher', 'publisher-location', 'URL'];

export async function procurarPorDados(f, { registrar, linhas = 5 } = {}) {
  const q = [f.titulo, f.subtitulo, (f.autores || []).slice(0, 2).map((a) => a.sobrenome).join(' '), f.ano].filter(Boolean).join(' ').slice(0, 300);
  if (!q.trim()) return { candidatos: [] };
  const base = `https://api.crossref.org/works?rows=${linhas}&query.bibliographic=${encodeURIComponent(q)}`;
  let url = `${base}&select=${CAMPOS_PROCURA.join(',')}`;
  const inicio = performance.now();
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    let r;
    try {
      r = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch {
      registrar?.('erro', 'crossref.procurar', { det: 'sem conexão', st: 'aviso' });
      return { erro: 'Sem conexão para procurar no Crossref.' };
    }
    if (r.status === 429 && tentativa === 1) {
      await new Promise((ok) => setTimeout(ok, 2000));
      continue;
    }
    // Pedido recusado por causa dos campos: tenta uma vez sem escolher campos (resposta maior, mesmo resultado).
    if (r.status === 400 && url !== base) {
      registrar?.('erro', 'crossref.procurar', { det: '400 com select; nova tentativa sem', st: 'aviso' });
      url = base;
      continue;
    }
    const dur = Math.round(performance.now() - inicio);
    if (!r.ok) {
      registrar?.('erro', 'crossref.procurar', { det: String(r.status), dur, st: 'erro' });
      return { erro: `O Crossref não respondeu agora (${r.status}).` };
    }
    const corpo = await r.json();
    const candidatos = (corpo.message?.items || []).map(deCrossref).filter((c) => c.doi && c.titulo);
    registrar?.('arq', 'crossref.procurar', { det: `${candidatos.length} candidatos`, dur });
    return { candidatos };
  }
  return { erro: 'O Crossref está recebendo muitos pedidos. Tente de novo em instantes.' };
}
