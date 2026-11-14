// Escrita: textos do Diobert, autoria medida por parágrafo, referências e versões.
//
// Coleção "textos" (sincroniza): briefing (tipo, projeto, enunciado, critérios, limite, entrega, teto da IA),
// tese e entrevista, diagnóstico, estrutura e as seções com o HTML do texto.
// Cada bloco (parágrafo, subtítulo, item de lista, citação longa) leva data-autoria: autor, coautoria ou ia.
// Bloco que veio do Copilot guarda em data-ia o texto proposto: se o Diobert reescrever o bastante
// (semelhança abaixo de 50%), o bloco volta a contar como dele. A participação da IA é
// (palavras de coautoria + palavras da IA) / total, e aparece fora do texto exportado.
import { autorCurto, referenciaTexto } from './abnt.js';

const BLOCOS = new Set(['P', 'H3', 'LI', 'BLOCKQUOTE']);
const PERMITIDAS = { P: [], H3: [], UL: [], OL: [], LI: [], BLOCKQUOTE: [], B: [], STRONG: [], I: [], EM: [], U: [], BR: [], SPAN: ['data-obra', 'data-pag'] };
const ATRIBUTOS_BLOCO = ['data-pid', 'data-autoria', 'data-ia'];
export const AUTORIAS = { autor: 'Seu', coautoria: 'Coautoria: versão do Copilot editada por você', ia: 'IA' };

/** Limpa o HTML do editor: só as marcações de texto permitidas, sem scripts, estilos ou links. */
export function limpar(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const raiz = doc.body.firstChild;
  const andar = (no) => {
    for (const filho of [...no.childNodes]) {
      if (filho.nodeType === 3) continue;
      if (filho.nodeType !== 1) {
        filho.remove();
        continue;
      }
      const tag = filho.tagName;
      if (tag === 'DIV') {
        // Enter no contenteditable às vezes cria <div>: vira parágrafo.
        const p = doc.createElement('p');
        while (filho.firstChild) p.appendChild(filho.firstChild);
        for (const a of ATRIBUTOS_BLOCO) if (filho.hasAttribute(a)) p.setAttribute(a, filho.getAttribute(a));
        filho.replaceWith(p);
        andar(p);
        continue;
      }
      if (!PERMITIDAS[tag]) {
        andar(filho);
        filho.replaceWith(...filho.childNodes);
        continue;
      }
      for (const at of [...filho.attributes]) {
        const ok = PERMITIDAS[tag].includes(at.name) || (BLOCOS.has(tag) && ATRIBUTOS_BLOCO.includes(at.name)) || (tag === 'SPAN' && at.name === 'class' && at.value === 'cit');
        if (!ok) filho.removeAttribute(at.name);
      }
      if (tag === 'SPAN' && !filho.classList.contains('cit')) {
        andar(filho);
        filho.replaceWith(...filho.childNodes);
        continue;
      }
      andar(filho);
    }
  };
  andar(raiz);
  // Texto solto no nível de cima vira parágrafo.
  for (const filho of [...raiz.childNodes]) {
    if (filho.nodeType === 3 && filho.textContent.trim()) {
      const p = doc.createElement('p');
      filho.replaceWith(p);
      p.appendChild(filho);
    } else if (filho.nodeType === 1 && ['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'BR'].includes(filho.tagName)) {
      const p = doc.createElement('p');
      filho.replaceWith(p);
      p.appendChild(filho);
    }
  }
  return raiz.innerHTML;
}

const palavrasDe = (t) => String(t || '').trim().match(/\S+/g) || [];
export const contarPalavras = (t) => palavrasDe(t).length;

/** Blocos de um HTML de seção: [{tag, texto, autoria, ia}]. */
export function blocos(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  return [...doc.body.firstChild.querySelectorAll('p, h3, li, blockquote')].filter((b) => !b.querySelector('p, li')).map((b) => ({ tag: b.tagName.toLowerCase(), texto: b.textContent, autoria: b.getAttribute('data-autoria') || 'autor', ia: b.getAttribute('data-ia') }));
}

/** Semelhança entre dois textos (coeficiente de Dice sobre pares de palavras), de 0 a 1. */
export function semelhanca(a, b) {
  const pares = (t) => {
    const w = palavrasDe(t.toLowerCase());
    const m = new Map();
    for (let i = 0; i < w.length - 1; i++) {
      const k = `${w[i]} ${w[i + 1]}`;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return { m, n: Math.max(0, w.length - 1) };
  };
  const A = pares(a);
  const B = pares(b);
  if (!A.n || !B.n) return a.trim() === b.trim() ? 1 : 0;
  let comum = 0;
  for (const [k, v] of A.m) comum += Math.min(v, B.m.get(k) || 0);
  return (2 * comum) / (A.n + B.n);
}

/** Autoria de um bloco, considerando quanto ele foi reescrito depois de vir do Copilot. */
export function autoriaDoBloco(b) {
  if (b.autoria === 'autor' || !b.ia) return b.autoria === 'ia' || b.autoria === 'coautoria' ? b.autoria : 'autor';
  return semelhanca(b.texto, b.ia) < 0.5 ? 'autor' : b.autoria;
}

export function medirAutoria(texto) {
  const conta = { autor: 0, coautoria: 0, ia: 0 };
  for (const s of texto.secoes || []) for (const b of blocos(s.html)) conta[autoriaDoBloco(b)] += contarPalavras(b.texto);
  const total = conta.autor + conta.coautoria + conta.ia;
  return { ...conta, total, participacao: total ? Math.round(((conta.coautoria + conta.ia) / total) * 100) : 0 };
}

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Obras citadas no texto: marcadas pelo app (span.cit) ou reconhecidas pelo sobrenome e o ano. */
export function obrasCitadas(texto, leituras) {
  const html = (texto.secoes || []).map((s) => s.html).join('\n');
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const marcadas = new Set([...doc.querySelectorAll('span.cit[data-obra]')].map((s) => s.getAttribute('data-obra')));
  const plano = semAcento(doc.body.textContent);
  return leituras.filter((l) => {
    if (marcadas.has(l.id)) return true;
    const sob = semAcento(l.autores?.[0]?.sobrenome || '');
    if (!sob || !l.ano) return false;
    const re = new RegExp(`${sob.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^()]{0,80}?${l.ano}`);
    return re.test(plano);
  });
}

export const referencias = (texto, leituras) =>
  obrasCitadas(texto, leituras)
    .map((l) => ({ id: l.id, texto: referenciaTexto(l), curto: autorCurto(l) }))
    .sort((a, b) => a.texto.localeCompare(b.texto, 'pt-BR'));

/** Citações diretas (entre aspas) do texto que não estão em nenhum grifo do acervo. */
export function citacoesDiretasSemFonte(texto, grifos, normalizar) {
  const todo = grifos.map((g) => normalizar(g.texto));
  const plano = (texto.secoes || []).map((s) => blocos(s.html).map((b) => b.texto).join(' ')).join(' ');
  const fora = [];
  for (const m of plano.matchAll(/["“]([^"”]{20,}?)["”]/g)) {
    const c = normalizar(m[1]);
    if (!todo.some((t) => t.includes(c))) fora.push(m[1]);
  }
  return fora;
}

export function criarEscrita({ dados, bib, drive, registrar }) {
  let textos = [];
  const legivelDepois = new Map();

  async function carregar() {
    textos = (await dados.listar('textos')).sort((a, b) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''));
  }
  const obter = (id) => textos.find((t) => t.id === id) || null;

  async function novo() {
    const t = await dados.salvar('textos', {
      id: `texto-${crypto.randomUUID().slice(0, 8)}`,
      titulo: 'Texto sem título',
      tipo: 'Artigo de disciplina',
      projeto: '',
      enunciado: '',
      criterios: '',
      limite: null,
      entrega: null,
      teto: 60,
      tese: '',
      entrevista: [],
      diagnostico: null,
      estrutura: [],
      secoes: [],
      passo: 0,
      versoes: [],
      criadoEm: new Date().toISOString(),
    });
    await carregar();
    registrar('ui', 'texto.novo');
    return t;
  }

  async function salvar(t) {
    const novoT = await dados.salvar('textos', { ...t, autoria: medirAutoria(t) });
    const i = textos.findIndex((x) => x.id === t.id);
    if (i >= 0) textos[i] = novoT;
    else textos.unshift(novoT);
    agendarLegivel(novoT.id);
    return novoT;
  }

  async function apagar(id) {
    const t = obter(id);
    await dados.apagar('textos', id);
    await carregar();
    registrar('ui', 'texto.apagar');
    return t;
  }

  /** Cópia legível fora do app: escrita/<id>/texto.html (abre no navegador e no Word) e autoria.json. */
  function agendarLegivel(id) {
    clearTimeout(legivelDepois.get(id));
    legivelDepois.set(id, setTimeout(() => gravarLegivel(id), 15000));
  }
  async function gravarLegivel(id) {
    const t = obter(id);
    const d = drive();
    if (!t || !d || !(t.secoes || []).length) return;
    const html = `<!doctype html><meta charset="utf-8"><title>${t.titulo.replace(/</g, '&lt;')}</title><h1>${t.titulo.replace(/</g, '&lt;')}</h1>\n${t.secoes.map((s) => `<h2>${s.titulo.replace(/</g, '&lt;')}</h2>\n${s.html}`).join('\n')}`;
    try {
      await d.gravar(`escrita/${t.id}/texto.html`, html, 'text/html');
      await d.gravar(`escrita/${t.id}/autoria.json`, JSON.stringify({ texto: t.titulo, medidaEm: new Date().toISOString(), teto: t.teto, ...medirAutoria(t) }, null, 1), 'application/json');
    } catch (e) {
      registrar('erro', 'texto.legivel_falhou', { det: e.message, st: 'aviso' });
    }
  }

  /** Guarda uma versão do texto no Drive (escrita/<id>/versoes/<data>.json). */
  async function salvarVersao(id, motivo = 'manual') {
    const t = obter(id);
    const d = drive();
    if (!t) return null;
    if (!d) throw new Error('Entre com o Google para guardar versões no seu Drive.');
    const em = new Date().toISOString();
    const arquivo = `escrita/${t.id}/versoes/${em.replace(/[:.]/g, '-')}.json`;
    await d.gravar(arquivo, JSON.stringify({ app: 'researchbook', texto: t, em, motivo }, null, 1), 'application/json');
    const v = { em, arquivo, palavras: medirAutoria(t).total, motivo };
    const novoT = await salvar({ ...t, versoes: [v, ...(t.versoes || [])].slice(0, 100) });
    registrar('ui', 'texto.versao', { det: motivo });
    return { v, texto: novoT };
  }

  async function restaurarVersao(id, arquivo) {
    const d = drive();
    if (!d) throw new Error('Entre com o Google para abrir versões do seu Drive.');
    const conteudo = await d.ler(arquivo);
    if (!conteudo) throw new Error('Esta versão não foi encontrada no seu Drive.');
    const antiga = JSON.parse(conteudo).texto;
    await salvarVersao(id, 'antes de restaurar');
    const atual = obter(id);
    const t = await salvar({ ...atual, secoes: antiga.secoes, titulo: antiga.titulo });
    registrar('ui', 'texto.restaurar');
    return t;
  }

  return { carregar, todos: () => textos, obter, novo, salvar, apagar, salvarVersao, restaurarVersao, gravarLegivel, medir: medirAutoria, referencias: (t) => referencias(t, bib.leituras()) };
}
