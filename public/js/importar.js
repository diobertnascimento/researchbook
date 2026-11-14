// Importação para a biblioteca: lê o que o Zotero exporta e liga os PDFs às fichas.
//
// Formatos aceitos (os que o Zotero exporta e importa): BibTeX/BibLaTeX (.bib), RIS (.ris), CSL JSON (.json)
// e Zotero RDF (.rdf). O jeito mais completo é "Exportar coleção…" em BibTeX ou Zotero RDF com
// "Exportar arquivos" marcado: o Zotero cria uma pasta com o arquivo de dados e os PDFs em files/<chave>/.
// Escolhida a pasta inteira, cada PDF é ligado à sua ficha pelo caminho que o próprio arquivo de dados indica.
// PDFs soltos (sem ficha) também entram: o app lê o PDF e procura o DOI.
//
// Este módulo só lê e organiza; não grava nada. Quem grava é organizar.js.
import { limparDOI } from './crossref.js';

/* ---------- utilidades ---------- */

const ACENTOS = { "'": '́', '`': '̀', '^': '̂', '~': '̃', '"': '̈', '=': '̄', '.': '̇', c: '̧', u: '̆', v: '̌', H: '̋', k: '̨' };
const SIMBOLOS = { '\\ss': 'ß', '\\o': 'ø', '\\O': 'Ø', '\\ae': 'æ', '\\AE': 'Æ', '\\oe': 'œ', '\\aa': 'å', '\\AA': 'Å', '\\l': 'ł', '\\L': 'Ł', '\\i': 'ı', '\\textendash': '–', '\\textemdash': '—', '\\textquoteright': '’', '\\textquoteleft': '‘', '\\&': '&', '\\%': '%', '\\_': '_', '\\$': '$', '\\#': '#' };

/** Converte o LaTeX que o BibTeX usa (acentos, chaves, comandos de formatação) em texto comum. */
export function deLatex(s) {
  let t = String(s ?? '');
  t = t.replace(/\\(textit|emph|textbf|textsc|textup|textsl|mkbibquote|enquote|mbox|textnormal)\s*\{/g, '{');
  t = t.replace(/\\([`'^~"=.])\s*\{?\s*\\?([a-zA-Z])\s*\}?/g, (_, a, l) => l + ACENTOS[a]);
  t = t.replace(/\\([cuvHk])\s*\{\s*([a-zA-Z])\s*\}/g, (_, a, l) => l + ACENTOS[a]);
  t = t.replace(/\\([cuvHk])\s+([a-zA-Z])/g, (_, a, l) => l + ACENTOS[a]);
  for (const [k, v] of Object.entries(SIMBOLOS)) t = t.split(k + '{}').join(v).replace(new RegExp(k.replace(/[\\$]/g, '\\$&') + '(?![a-zA-Z])', 'g'), v);
  t = t.replace(/\\[a-zA-Z]+\s*/g, '').replace(/[{}]/g, '').replace(/~/g, ' ').replace(/---/g, '—').replace(/--/g, '–').replace(/``/g, '“').replace(/''/g, '”');
  return t.normalize('NFC').replace(/\s+/g, ' ').trim();
}

const limpo = (s) => (s == null ? '' : String(s).replace(/\s+/g, ' ').trim());
const anoDe = (s) => (String(s || '').match(/\b(1[5-9]\d\d|20\d\d)\b/) || [])[1] || null;
const paginasDe = (s) => (s ? String(s).replace(/\s*[-–—]+\s*/g, '-').trim() : null);
const etiquetas = (s) => [...new Set(String(s || '').split(/[;,]/).map((x) => limpo(x)).filter(Boolean))];

const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'du', 'van', 'von', 'der', 'den', 'la', 'le', 'di', 'del', 'della']);

/** "Sobrenome, Prenomes" ou "Prenomes Sobrenome" (o último nome vira o sobrenome, como na ABNT). */
export function pessoa(nome) {
  const n = limpo(nome);
  if (!n) return null;
  if (n.includes(',')) {
    const [sob, ...resto] = n.split(',').map((x) => x.trim());
    return { sobrenome: sob, prenomes: resto.filter(Boolean).reverse().join(' ') };
  }
  const partes = n.split(' ');
  if (partes.length === 1) return { sobrenome: n, prenomes: '' };
  const sobrenome = partes.pop();
  while (partes.length && PARTICULAS.has(partes[partes.length - 1].toLowerCase()) && partes.length > 1) partes.pop();
  return { sobrenome, prenomes: n.slice(0, n.lastIndexOf(sobrenome)).trim() };
}

/** Divide um texto por um separador, sem dividir dentro de chaves (o BibTeX usa {} para proteger trechos). */
function dividirForaDeChaves(s, separador) {
  const out = [];
  let prof = 0;
  let atual = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{') prof++;
    if (c === '}') prof--;
    if (prof === 0 && s.slice(i, i + separador.length).toLowerCase() === separador) {
      out.push(atual);
      atual = '';
      i += separador.length - 1;
      continue;
    }
    atual += c;
  }
  out.push(atual);
  return out;
}

/* ---------- BibTeX / BibLaTeX ---------- */

const TIPOS_BIB = {
  article: 'artigo', book: 'livro', mvbook: 'livro', booklet: 'livro', incollection: 'capitulo', inbook: 'capitulo', inreference: 'capitulo',
  inproceedings: 'anais', conference: 'anais', proceedings: 'anais', phdthesis: 'tese', mastersthesis: 'dissertacao',
};

function lerValor(t, p) {
  // Devolve [valor, posição depois do valor]. Valores: {…} (com chaves dentro), "…" ou palavra/número; juntados por #.
  let valor = '';
  for (;;) {
    while (/\s/.test(t[p] || '')) p++;
    const c = t[p];
    if (c === '{') {
      let prof = 0;
      const ini = p;
      for (; p < t.length; p++) {
        if (t[p] === '\\') { p++; continue; }
        if (t[p] === '{') prof++;
        else if (t[p] === '}' && --prof === 0) break;
      }
      valor += t.slice(ini + 1, p);
      p++;
    } else if (c === '"') {
      let prof = 0;
      const ini = ++p;
      for (; p < t.length; p++) {
        if (t[p] === '\\') { p++; continue; }
        if (t[p] === '{') prof++;
        else if (t[p] === '}') prof--;
        else if (t[p] === '"' && prof === 0) break;
      }
      valor += t.slice(ini, p);
      p++;
    } else {
      const m = /^[^,#}\s]+/.exec(t.slice(p));
      if (m) {
        valor += m[0];
        p += m[0].length;
      }
    }
    while (/\s/.test(t[p] || '')) p++;
    if (t[p] === '#') { p++; continue; }
    return [valor, p];
  }
}

function camposBib(corpo) {
  const out = {};
  let p = 0;
  const re = /\s*([A-Za-z][\w:-]*)\s*=\s*/y;
  while (p < corpo.length) {
    re.lastIndex = p;
    const m = re.exec(corpo);
    if (!m) {
      const prox = corpo.indexOf(',', p);
      if (prox < 0) break;
      p = prox + 1;
      continue;
    }
    const [v, depois] = lerValor(corpo, re.lastIndex);
    out[m[1].toLowerCase()] = v;
    p = depois;
    while (/[\s,]/.test(corpo[p] || '')) p++;
  }
  return out;
}

/** Caminhos de PDF no campo file do Zotero: "Full Text PDF:files/12/x.pdf:application/pdf;Snapshot:…". */
export function arquivosDoCampoFile(valor) {
  if (!valor) return [];
  const partes = [];
  let atual = '';
  for (let i = 0; i < valor.length; i++) {
    if (valor[i] === '\\' && i + 1 < valor.length) { atual += valor[++i]; continue; }
    if (valor[i] === ';') { partes.push(atual); atual = ''; continue; }
    atual += valor[i] === ':' ? '\u0000' : valor[i];
  }
  partes.push(atual);
  return partes
    .map((p) => p.split('\u0000'))
    .map((c) => (c.length >= 3 ? { caminho: c.slice(1, -1).join(':'), tipo: c[c.length - 1] } : { caminho: c.join(':'), tipo: '' }))
    .filter((a) => /pdf/i.test(a.tipo) || /\.pdf$/i.test(a.caminho))
    .map((a) => a.caminho);
}

export function lerBibTeX(texto) {
  const s = String(texto || '');
  const itens = [];
  let i = 0;
  while ((i = s.indexOf('@', i)) !== -1) {
    const m = /^@\s*([a-zA-Z]+)\s*\{/.exec(s.slice(i, i + 40));
    if (!m) { i++; continue; }
    const tipoBib = m[1].toLowerCase();
    let k = i + m[0].length;
    const ini = k;
    let prof = 1;
    for (; k < s.length && prof > 0; k++) {
      if (s[k] === '\\') { k++; continue; }
      if (s[k] === '{') prof++;
      else if (s[k] === '}') prof--;
    }
    const corpo = s.slice(ini, k - 1);
    i = k;
    if (['comment', 'preamble', 'string'].includes(tipoBib)) continue;
    const virgula = corpo.indexOf(',');
    const c = camposBib(corpo.slice(virgula + 1));
    let tipo = TIPOS_BIB[tipoBib] || 'outro';
    if (tipoBib === 'thesis') tipo = /phd|doutor|tese/i.test(c.type || '') ? 'tese' : 'dissertacao';
    const autores = c.author ? dividirForaDeChaves(c.author, ' and ').map((a) => pessoa(deLatex(a))).filter(Boolean) : [];
    const organizadores = c.editor ? dividirForaDeChaves(c.editor, ' and ').map((a) => pessoa(deLatex(a))).filter(Boolean) : [];
    const veiculo = c.journaltitle || c.journal || (['capitulo', 'anais'].includes(tipo) ? c.booktitle : null) || c.series || null;
    itens.push({
      chave: corpo.slice(0, virgula).trim(),
      ficha: fichaLimpa({
        tipo,
        titulo: deLatex(c.title),
        subtitulo: deLatex(c.subtitle) || null,
        autores,
        organizadores,
        ano: anoDe(c.year || c.date),
        veiculo: deLatex(veiculo) || null,
        volume: deLatex(c.volume) || null,
        numero: deLatex(c.number || c.issue) || null,
        paginas: paginasDe(deLatex(c.pages)),
        editora: deLatex(c.publisher || c.school || c.institution) || null,
        local: deLatex(c.address || c.location) || null,
        doi: limparDOI(c.doi) || null,
        url: limpo(c.url) || null,
        idioma: deLatex(c.langid || c.language) || null,
        tags: etiquetas(deLatex(c.keywords)),
      }),
      pdfs: arquivosDoCampoFile(c.file),
    });
  }
  return itens;
}

/* ---------- RIS ---------- */

const TIPOS_RIS = { JOUR: 'artigo', JFULL: 'artigo', EJOUR: 'artigo', MGZN: 'artigo', NEWS: 'artigo', BOOK: 'livro', EBOOK: 'livro', EDBOOK: 'livro', CHAP: 'capitulo', ECHAP: 'capitulo', CONF: 'anais', CPAPER: 'anais', PROC: 'anais', THES: 'dissertacao' };

export function lerRIS(texto) {
  const itens = [];
  let atual = null;
  for (const linhaBruta of String(texto || '').replace(/^﻿/, '').split(/\r?\n/)) {
    const m = /^([A-Z][A-Z0-9])  -\s?(.*)$/.exec(linhaBruta);
    if (!m) continue;
    const [, tag, valor] = m;
    if (tag === 'TY') { atual = { TY: valor.trim() }; continue; }
    if (!atual) continue;
    if (tag === 'ER') { itens.push(atual); atual = null; continue; }
    (atual[tag] = atual[tag] || []).push(valor.trim());
  }
  if (atual) itens.push(atual);
  const um = (r, ...tags) => tags.map((t) => r[t]?.[0]).find(Boolean) || null;
  return itens.map((r) => {
    const tipo = TIPOS_RIS[r.TY] || 'outro';
    const sp = um(r, 'SP');
    const ep = um(r, 'EP');
    return {
      chave: um(r, 'ID') || null,
      ficha: fichaLimpa({
        tipo,
        titulo: um(r, 'TI', 'T1', 'CT'),
        autores: [...(r.AU || []), ...(r.A1 || [])].map(pessoa).filter(Boolean),
        organizadores: [...(r.A2 || []), ...(r.ED || [])].filter(() => tipo === 'capitulo').map(pessoa).filter(Boolean),
        ano: anoDe(um(r, 'PY', 'Y1', 'DA')),
        veiculo: um(r, 'T2', 'JO', 'JF', 'JA', 'BT'),
        volume: um(r, 'VL'),
        numero: um(r, 'IS'),
        paginas: paginasDe(sp && ep && !String(sp).includes('-') ? `${sp}-${ep}` : sp),
        editora: um(r, 'PB'),
        local: um(r, 'CY'),
        doi: limparDOI(um(r, 'DO')) || null,
        url: um(r, 'UR'),
        idioma: um(r, 'LA'),
        tags: [...new Set((r.KW || []).map(limpo).filter(Boolean))],
      }),
      pdfs: [...(r.L1 || []), ...(r.L4 || [])].filter((p) => /\.pdf$/i.test(p) || !/\.\w{2,5}$/.test(p)).map((p) => p.replace(/^file:\/\//, '')),
    };
  });
}

/* ---------- CSL JSON ---------- */

const TIPOS_CSL = { 'article-journal': 'artigo', 'article-magazine': 'artigo', 'article-newspaper': 'artigo', article: 'artigo', book: 'livro', chapter: 'capitulo', 'paper-conference': 'anais' };

export function lerCSL(texto) {
  let lista;
  try {
    lista = JSON.parse(String(texto || '').replace(/^﻿/, ''));
  } catch {
    return [];
  }
  if (!Array.isArray(lista)) lista = lista?.items || [];
  const gente = (xs) => (xs || []).map((p) => (p.literal ? { sobrenome: p.literal, prenomes: '' } : { sobrenome: limpo([p['non-dropping-particle'], p.family].filter(Boolean).join(' ')), prenomes: limpo(p.given) })).filter((p) => p.sobrenome);
  return lista
    .filter((x) => x && typeof x === 'object' && x.title)
    .map((x) => {
      let tipo = TIPOS_CSL[x.type] || 'outro';
      if (x.type === 'thesis') tipo = /phd|doutor|tese/i.test(x.genre || '') ? 'tese' : 'dissertacao';
      const dp = x.issued?.['date-parts']?.[0]?.[0] ?? x.issued?.raw ?? x.issued?.literal;
      return {
        chave: x.id ? String(x.id) : null,
        ficha: fichaLimpa({
          tipo,
          titulo: limpo(x.title),
          autores: gente(x.author),
          organizadores: tipo === 'capitulo' ? gente(x.editor) : [],
          ano: anoDe(dp),
          veiculo: limpo(x['container-title']) || null,
          volume: x.volume ? String(x.volume) : null,
          numero: x.issue ? String(x.issue) : null,
          paginas: paginasDe(x.page),
          editora: limpo(x.publisher) || null,
          local: limpo(x['publisher-place']) || null,
          doi: limparDOI(x.DOI) || null,
          url: x.URL || null,
          idioma: x.language || null,
          tags: etiquetas(x.keyword),
        }),
        pdfs: [],
      };
    });
}

/* ---------- Zotero RDF ---------- */

const NS = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  z: 'http://www.zotero.org/namespaces/export#',
  dc: 'http://purl.org/dc/elements/1.1/',
  dcterms: 'http://purl.org/dc/terms/',
  bib: 'http://purl.org/net/biblio#',
  foaf: 'http://xmlns.com/foaf/0.1/',
  link: 'http://purl.org/rss/1.0/modules/link/',
  prism: 'http://prismstandard.org/namespaces/1.2/basic/',
};
const TIPOS_Z = { journalArticle: 'artigo', magazineArticle: 'artigo', newspaperArticle: 'artigo', book: 'livro', bookSection: 'capitulo', conferencePaper: 'anais' };

export function lerZoteroRDF(texto) {
  if (typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(String(texto || ''), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return [];
  const raiz = doc.documentElement;
  const sobre = new Map();
  for (const el of raiz.children) {
    const a = el.getAttributeNS(NS.rdf, 'about');
    if (a) sobre.set(a, el);
  }
  const filhos = (el, ns, nome) => [...(el?.children || [])].filter((c) => c.namespaceURI === ns && c.localName === nome);
  const filho = (el, ns, nome) => filhos(el, ns, nome)[0] || null;
  const txt = (el, ns, nome) => limpo(filho(el, ns, nome)?.textContent) || null;
  const resolver = (el) => {
    if (!el) return null;
    const ref = el.getAttributeNS(NS.rdf, 'resource');
    if (ref) return sobre.get(ref) || null;
    return el.children[0] || null;
  };
  const pessoas = (el, nome) => {
    const seq = filho(filho(el, NS.bib, nome), NS.rdf, 'Seq');
    return filhos(seq, NS.rdf, 'li')
      .map((li) => resolver(li) || li)
      .map((p) => ({ sobrenome: txt(p, NS.foaf, 'surname') || '', prenomes: txt(p, NS.foaf, 'givenName') || txt(p, NS.foaf, 'givenname') || '' }))
      .filter((p) => p.sobrenome);
  };
  // Coleções do Zotero viram tags (o nome da coleção).
  const colecoesDe = new Map();
  for (const col of [...raiz.children].filter((c) => c.namespaceURI === NS.z && c.localName === 'Collection')) {
    const nome = txt(col, NS.dc, 'title');
    for (const parte of filhos(col, NS.dcterms, 'hasPart')) {
      const ref = parte.getAttributeNS(NS.rdf, 'resource');
      if (ref && nome) (colecoesDe.get(ref) || colecoesDe.set(ref, []).get(ref)).push(nome);
    }
  }
  const itens = [];
  for (const el of raiz.children) {
    const tipoZ = txt(el, NS.z, 'itemType');
    if (!tipoZ || ['attachment', 'note'].includes(tipoZ)) continue;
    const titulo = txt(el, NS.dc, 'title');
    if (!titulo) continue;
    let tipo = TIPOS_Z[tipoZ] || 'outro';
    if (tipoZ === 'thesis') tipo = /phd|doutor|tese/i.test(txt(el, NS.z, 'type') || '') ? 'tese' : 'dissertacao';
    const parte = resolver(filho(el, NS.dcterms, 'isPartOf'));
    const ids = filhos(el, NS.dc, 'identifier').map((i) => limpo(i.textContent));
    const doi = ids.map((x) => limparDOI(x)).find(Boolean) || null;
    const url = filhos(el, NS.dc, 'identifier').map((i) => limpo(filho(filho(i, NS.dcterms, 'URI'), NS.rdf, 'value')?.textContent)).find(Boolean) || null;
    const editora = (() => {
      const pub = filho(el, NS.dc, 'publisher');
      const org = resolver(pub) || pub;
      return txt(org, NS.foaf, 'name') || null;
    })();
    const tags = filhos(el, NS.dc, 'subject').map((s) => limpo(filho(s, NS.rdf, 'value')?.textContent || s.textContent)).filter(Boolean);
    const sobreItem = el.getAttributeNS(NS.rdf, 'about');
    const pdfs = filhos(el, NS.link, 'link')
      .map((l) => sobre.get(l.getAttributeNS(NS.rdf, 'resource')))
      .filter(Boolean)
      .filter((a) => /pdf/i.test(txt(a, NS.link, 'type') || '') || /\.pdf$/i.test(filho(a, NS.rdf, 'resource')?.getAttributeNS(NS.rdf, 'resource') || ''))
      .map((a) => filho(a, NS.rdf, 'resource')?.getAttributeNS(NS.rdf, 'resource'))
      .filter(Boolean);
    itens.push({
      chave: sobreItem,
      ficha: fichaLimpa({
        tipo,
        titulo,
        autores: pessoas(el, 'authors'),
        organizadores: tipo === 'capitulo' ? pessoas(el, 'editors') : [],
        ano: anoDe(txt(el, NS.dc, 'date')),
        veiculo: txt(parte, NS.dc, 'title'),
        volume: txt(parte, NS.prism, 'volume') || txt(el, NS.prism, 'volume'),
        numero: txt(parte, NS.prism, 'number') || txt(el, NS.prism, 'number'),
        paginas: paginasDe(txt(el, NS.bib, 'pages')),
        editora,
        local: null,
        doi,
        url,
        idioma: txt(el, NS.z, 'language') || txt(el, NS.dc, 'language'),
        tags: [...new Set([...tags, ...(colecoesDe.get(sobreItem) || [])])],
      }),
      pdfs,
    });
  }
  return itens;
}

/* ---------- formato, fichas e ligação dos PDFs ---------- */

function fichaLimpa(f) {
  const out = {};
  for (const [k, v] of Object.entries(f)) {
    if (Array.isArray(v)) out[k] = v;
    else out[k] = v == null || v === '' ? null : typeof v === 'string' ? v.trim() : v;
  }
  out.tipo = out.tipo || 'outro';
  out.autores = out.autores || [];
  out.tags = out.tags || [];
  return out;
}

export const NOMES_FORMATO = { bibtex: 'BibTeX', ris: 'RIS', csl: 'CSL JSON', rdf: 'Zotero RDF' };

/** Formato de um arquivo de dados pelo nome e pelo começo do conteúdo. null se não for um formato conhecido. */
export function formatoDe(nome, inicio = '') {
  const ext = (String(nome).toLowerCase().match(/\.(\w+)$/) || [])[1];
  if (ext === 'bib' || ext === 'bibtex') return 'bibtex';
  if (ext === 'ris') return 'ris';
  if (ext === 'rdf') return 'rdf';
  const t = String(inicio).replace(/^﻿/, '').trimStart();
  if (ext === 'json' && (t.startsWith('[') || t.startsWith('{'))) return 'csl';
  if (['txt', 'xml', ''].includes(ext || '')) {
    if (/^TY  - /m.test(t.slice(0, 400))) return 'ris';
    if (t.startsWith('@')) return 'bibtex';
    if (t.startsWith('<?xml') && t.includes('zotero.org/namespaces/export')) return 'rdf';
  }
  return null;
}

export function lerFormato(formato, texto) {
  return { bibtex: lerBibTeX, ris: lerRIS, csl: lerCSL, rdf: lerZoteroRDF }[formato]?.(texto) || [];
}

const normCaminho = (p) => {
  let s = String(p || '').replace(/\\/g, '/');
  try {
    s = decodeURIComponent(s);
  } catch {}
  return s.normalize('NFC').replace(/^\.?\//, '').toLowerCase();
};
const base = (p) => normCaminho(p).split('/').pop();

/**
 * Liga os PDFs escolhidos às fichas. arquivos: [{nome, caminho}] (caminho = webkitRelativePath quando
 * a pasta foi escolhida). Devolve, para cada item, o índice do PDF (ou -1) e a lista de PDFs que sobraram.
 */
export function ligarPDFs(itens, arquivos) {
  const pdfs = arquivos.map((a, i) => ({ i, caminho: normCaminho(a.caminho || a.nome), base: base(a.nome) })).filter((a) => a.base.endsWith('.pdf'));
  const usados = new Set();
  const ligacoes = itens.map((it) => {
    for (const p of it.pdfs || []) {
      const alvo = normCaminho(p);
      const b = base(p);
      const achado =
        pdfs.find((a) => !usados.has(a.i) && (a.caminho.endsWith(alvo) || alvo.endsWith(a.caminho))) ||
        pdfs.find((a) => !usados.has(a.i) && a.base === b);
      if (achado) {
        usados.add(achado.i);
        return achado.i;
      }
    }
    return -1;
  });
  return { ligacoes, soltos: pdfs.filter((a) => !usados.has(a.i)).map((a) => a.i) };
}
