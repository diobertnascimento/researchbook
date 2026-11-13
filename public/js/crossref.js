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
