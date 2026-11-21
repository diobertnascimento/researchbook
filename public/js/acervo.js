// Regras puras do Acervo: o que falta em cada obra para a referência sair completa em ABNT,
// e os grupos da central (com algo faltando, referência incompleta, sem PDF, sem DOI, repetidas).
// Sem IA e sem rede: só olha os dados da ficha. Usado por organizar-ui.js e pelos testes.

const A = { autores: 'os autores', titulo: 'o título', ano: 'o ano', paginas: 'as páginas' };
// Dados que a referência de cada tipo usa (abnt.js). "volnum" vale com volume ou número.
const PRECISA = {
  artigo: [['autores', A.autores], ['titulo', A.titulo], ['ano', A.ano], ['veiculo', 'a revista'], ['volnum', 'o volume ou o número'], ['paginas', A.paginas]],
  livro: [['autores', A.autores], ['titulo', A.titulo], ['ano', A.ano], ['editora', 'a editora'], ['local', 'a cidade']],
  capitulo: [['autores', A.autores], ['titulo', A.titulo], ['ano', A.ano], ['veiculo', 'o livro'], ['editora', 'a editora'], ['local', 'a cidade'], ['paginas', A.paginas]],
  anais: [['autores', A.autores], ['titulo', A.titulo], ['ano', A.ano], ['veiculo', 'o evento'], ['paginas', A.paginas]],
  dissertacao: [['autores', A.autores], ['titulo', A.titulo], ['ano', A.ano], ['editora', 'a instituição'], ['local', 'a cidade']],
};
PRECISA.tese = PRECISA.dissertacao;

/** Título que parece nome de arquivo ("artigo_final_v2", "scan0001"). */
export const tituloDeArquivo = (l) =>
  !l?.titulo || /[_]|\.pdf$|^\s*(scan|doc|artigo|arquivo|file|download)\s*\d*\s*$/i.test(l.titulo) || (!!l.pdf?.nome && l.titulo === l.pdf.nome.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '));

const tem = (l, k) => {
  if (k === 'autores') return !!(l.autores?.length || l.organizadores?.length);
  if (k === 'volnum') return !!(l.volume || l.numero);
  if (k === 'titulo') return !tituloDeArquivo(l);
  return !!l[k];
};

/** Só o artigo de revista costuma ter DOI; livro, capítulo, anais e tese sem DOI não contam como falta. */
export const esperaDOI = (l) => (l.tipo || 'artigo') === 'artigo';

/**
 * O que falta numa obra.
 * ref: nomes dos dados que faltam para a referência; pdf: falta o arquivo; doi: falta o DOI de um artigo
 * (não conta quando o autor marcou que a obra não tem DOI).
 */
export function faltas(l) {
  const ref = (PRECISA[l.tipo] || PRECISA.artigo).filter(([k]) => !tem(l, k)).map(([, nome]) => nome);
  const semDOI = !l.doi && l.doiBusca?.status !== 'nao-tem';
  return { ref, pdf: !l.pdf, doi: semDOI && esperaDOI(l), algo: ref.length > 0 || !l.pdf || (semDOI && esperaDOI(l)) };
}

/** "Falta a revista", "Faltam a revista e as páginas", "Faltam 4 dados". */
export function fraseDaReferencia(ref) {
  if (!ref.length) return 'Completa';
  if (ref.length === 1) return `${/^[oa]s /.test(ref[0]) ? 'Faltam' : 'Falta'} ${ref[0]}`;
  if (ref.length === 2) return `Faltam ${ref[0]} e ${ref[1]}`;
  return `Faltam ${ref.length} dados`;
}

export const FILTROS = [
  ['todas', 'Todas', () => true],
  ['falta', 'Com algo faltando', (l, f) => f.algo],
  ['ref', 'Referência incompleta', (l, f) => f.ref.length > 0],
  ['pdf', 'Sem PDF', (l, f) => f.pdf],
  ['doi', 'Sem DOI', (l, f) => f.doi],
  ['rep', 'Repetidas', (l, f, rep) => rep.has(l.id)],
];

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const primeiroAutor = (l) => semAcento((l.autores?.[0] || l.organizadores?.[0])?.sobrenome || '￿');
export const ORDENS = {
  recentes: ['Adicionadas por último', (a, b) => String(b.adicionadaEm || '').localeCompare(String(a.adicionadaEm || ''))],
  autor: ['Autor', (a, b) => primeiroAutor(a).localeCompare(primeiroAutor(b)) || String(a.ano || '').localeCompare(String(b.ano || ''))],
  ano: ['Ano', (a, b) => String(b.ano || '').localeCompare(String(a.ano || ''))],
  titulo: ['Título', (a, b) => semAcento(a.titulo).localeCompare(semAcento(b.titulo))],
};

/**
 * Retrato do acervo para a central.
 * leituras: fichas; grupos: grupos de repetidas (duplicatas.js), cada um com { ids }.
 * Devolve as linhas (obra + o que falta), a contagem de cada filtro e os números do painel.
 */
export function retrato(leituras, grupos = []) {
  const rep = new Set(grupos.flatMap((g) => g.ids));
  const linhas = leituras.map((l) => ({ l, f: faltas(l) }));
  const contagem = Object.fromEntries(FILTROS.map(([k, , testa]) => [k, linhas.filter(({ l, f }) => testa(l, f, rep)).length]));
  return { linhas, rep, contagem, total: leituras.length, completas: leituras.length - contagem.falta };
}

/** Linhas de um filtro, com a busca por título, autor ou ano e a ordem escolhida. */
export function filtrar(r, { filtro = 'todas', termo = '', ordem = 'recentes' } = {}) {
  const testa = (FILTROS.find(([k]) => k === filtro) || FILTROS[0])[2];
  const t = semAcento(termo).trim();
  const bate = (l) => !t || semAcento([l.titulo, l.subtitulo, ...(l.autores || []).map((a) => `${a.sobrenome} ${a.prenomes}`), l.ano, l.veiculo].filter(Boolean).join(' ')).includes(t);
  const cmp = (ORDENS[ordem] || ORDENS.recentes)[1];
  return r.linhas.filter(({ l, f }) => testa(l, f, r.rep) && bate(l)).sort((a, b) => cmp(a.l, b.l));
}
