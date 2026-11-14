// Comparação de obras: repetidas na biblioteca e candidatos de DOI.
// Regras puras, sem rede e sem IA, para o resultado ser previsível e testável.
//
// Idêntica: mesmo DOI, mesmo PDF (assinatura SHA-256) ou mesmo título, ano e primeiro autor.
// Provável: título quase igual (90% das palavras), com ano e primeiro autor compatíveis.
import { limparDOI } from './crossref.js';

const PARADAS = new Set('a o as os de da do das dos e em no na nos nas um uma para por com sobre entre ao aos the of and in on an to for with from by at'.split(' '));

export const normalizar = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const palavras = (s) => normalizar(s).split(' ').filter((w) => w && !PARADAS.has(w));
export const chaveDOI = (d) => (limparDOI(d) || '').toLowerCase();
const tituloCompleto = (f) => [f?.titulo, f?.subtitulo].filter(Boolean).join(' ');
const autor1 = (f) => normalizar(f?.autores?.[0]?.sobrenome || '');

/** 0 a 1: quanto dois títulos têm as mesmas palavras (Dice), aceitando que um tenha subtítulo e o outro não. */
export function similaridadeTitulo(a, b) {
  const A = new Set(palavras(a));
  const B = new Set(palavras(b));
  if (!A.size || !B.size) return 0;
  let comum = 0;
  A.forEach((w) => B.has(w) && comum++);
  const dice = (2 * comum) / (A.size + B.size);
  const menor = Math.min(A.size, B.size);
  const contido = menor >= 4 ? (comum / menor) * 0.95 : 0;
  return Math.max(dice, contido);
}

function autorCompativel(f, g) {
  const a = autor1(f);
  if (!a || !g?.autores?.length) return 0.5;
  return g.autores.some((p) => {
    const s = normalizar(p.sobrenome);
    return s && (s === a || s.endsWith(' ' + a) || a.endsWith(' ' + s));
  })
    ? 1
    : 0;
}

function anoCompativel(f, g) {
  if (!f?.ano || !g?.ano) return 0.5;
  const d = Math.abs(Number(f.ano) - Number(g.ano));
  return d === 0 ? 1 : d === 1 ? 0.5 : 0;
}

/** Nota de um candidato do Crossref para a ficha: 0 a 1, com as partes. */
export function pontuar(ficha, cand) {
  const titulo = Math.max(similaridadeTitulo(tituloCompleto(ficha), tituloCompleto(cand)), similaridadeTitulo(ficha?.titulo, cand?.titulo));
  const ano = anoCompativel(ficha, cand);
  const autor = autorCompativel(ficha, cand);
  return { total: Math.round((0.65 * titulo + 0.15 * ano + 0.2 * autor) * 100) / 100, titulo, ano, autor };
}

export const MUITO_PROVAVEL = 0.9;
export const PROVAVEL = 0.72;

/** Duas fichas são a mesma obra? Devolve null, { tipo: 'identica', motivo } ou { tipo: 'provavel', motivo }. */
export function compararObras(a, b) {
  const da = chaveDOI(a.doi);
  if (da && da === chaveDOI(b.doi)) return { tipo: 'identica', motivo: 'mesmo DOI' };
  if (a.pdf?.sha256 && a.pdf.sha256 === b.pdf?.sha256) return { tipo: 'identica', motivo: 'mesmo PDF' };
  if (da && chaveDOI(b.doi)) return null; // DOIs diferentes: obras diferentes
  const ta = normalizar(tituloCompleto(a));
  const tb = normalizar(tituloCompleto(b));
  if (!ta || !tb) return null;
  const mesmoAutor = autor1(a) && autor1(a) === autor1(b);
  if (ta === tb && a.ano && a.ano === b.ano && mesmoAutor) return { tipo: 'identica', motivo: 'mesmo título, ano e autor' };
  const sim = Math.max(similaridadeTitulo(tituloCompleto(a), tituloCompleto(b)), similaridadeTitulo(a.titulo, b.titulo));
  if (sim >= 0.9 && anoCompativel(a, b) >= 0.5 && autorCompativel(a, b) >= 0.5) return { tipo: 'provavel', motivo: 'título quase igual' };
  return null;
}

const chaveDoPar = (x, y) => [x, y].sort().join('|');

/** Grupos de obras repetidas na biblioteca (pares ignorados pelo autor ficam de fora). */
export function gruposRepetidos(leituras, ignorados = []) {
  const ign = new Set(ignorados);
  const pares = [];
  for (let i = 0; i < leituras.length; i++)
    for (let j = i + 1; j < leituras.length; j++) {
      const c = compararObras(leituras[i], leituras[j]);
      if (c && !ign.has(chaveDoPar(leituras[i].id, leituras[j].id))) pares.push({ a: leituras[i].id, b: leituras[j].id, ...c });
    }
  // Junta pares em grupos (A=B e B=C viram um grupo só).
  const grupoDe = new Map();
  const grupos = [];
  for (const p of pares) {
    const g = grupoDe.get(p.a) || grupoDe.get(p.b) || (grupos.push({ ids: [], tipo: 'provavel', motivos: [] }), grupos[grupos.length - 1]);
    for (const id of [p.a, p.b]) if (!g.ids.includes(id)) { g.ids.push(id); grupoDe.set(id, g); }
    if (p.tipo === 'identica') g.tipo = 'identica';
    if (!g.motivos.includes(p.motivo)) g.motivos.push(p.motivo);
  }
  return grupos;
}

export { chaveDoPar };

/** Quanto uma obra já tem de trabalho do autor (para decidir qual fica ao juntar). */
export function peso(l, { grifos = 0, fichamento = false } = {}) {
  const campos = ['doi', 'ano', 'veiculo', 'volume', 'numero', 'paginas', 'editora', 'local'].filter((k) => l[k]).length + (l.autores?.length ? 2 : 0);
  return grifos * 10 + (fichamento ? 50 : 0) + (l.etapa || 0) * 5 + (l.pdf ? 20 : 0) + campos;
}
