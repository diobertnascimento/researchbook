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
  // Versões: guardadas neste aparelho (funcionam sem internet) e copiadas para o Drive quando há conexão.
  const ENTRE_VERSOES_MS = 10 * 60_000;
  const ultimaVersao = new Map();
  const cacheVersoes = new Map();
  const envios = new Map();
  const conteudoDe = (t) => JSON.stringify([t.titulo, (t.secoes || []).map((x) => [x.titulo, x.html])]);
  const temTexto = (t) => (t.secoes || []).some((x) => (x.html || '').replace(/<[^>]+>/g, '').trim());

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

  /**
   * Salva o texto. Antes de trocar o conteúdo, guarda sozinho uma versão do estado anterior quando a última
   * tem mais de 10 minutos, ou sempre que quem chama avisa que a mudança é grande (opção versao, com o motivo).
   */
  async function salvar(t, { versao = null } = {}) {
    const antes = obter(t.id);
    let indice = t.versoes || [];
    if (antes && temTexto(antes) && conteudoDe(antes) !== conteudoDe(t)) {
      const ultima = ultimaVersao.get(t.id) ?? (Date.parse((antes.versoes || [])[0]?.em || '') || 0);
      if (versao || Date.now() - ultima >= ENTRE_VERSOES_MS) indice = [await guardarVersao(antes, versao || 'automática'), ...indice].slice(0, 100);
    }
    const novoT = await dados.salvar('textos', { ...t, versoes: indice, autoria: medirAutoria(t) });
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

  /** Guarda neste aparelho o estado t do texto e manda uma cópia para o Drive (escrita/<id>/versoes/<data>.json). */
  async function guardarVersao(t, motivo) {
    const em = new Date().toISOString();
    const v = { id: `${t.id}:${em}`, textoId: t.id, em, motivo, palavras: medirAutoria(t).total, arquivo: `escrita/${t.id}/versoes/${em.replace(/[:.]/g, '-')}.json`, noDrive: false, texto: { ...t, versoes: [] } };
    await dados.versoes.guardar(v);
    ultimaVersao.set(t.id, Date.now());
    if (cacheVersoes.has(t.id)) cacheVersoes.set(t.id, [v, ...cacheVersoes.get(t.id)]);
    envios.set(em, enviarVersao(v));
    enxugar(t.id).catch(() => {});
    registrar('ui', 'texto.versao', { det: motivo });
    return { em, arquivo: v.arquivo, palavras: v.palavras, motivo };
  }

  async function enviarVersao(v) {
    const d = drive();
    if (v.noDrive) return true;
    if (!d) return false;
    try {
      await d.gravar(v.arquivo, JSON.stringify({ app: 'researchbook', texto: v.texto, em: v.em, motivo: v.motivo }, null, 1), 'application/json');
      await dados.versoes.guardar({ ...v, noDrive: true });
      return true;
    } catch (e) {
      registrar('erro', 'texto.versao_drive', { det: e.message, st: 'aviso' });
      return false;
    }
  }

  /** Versões guardadas sem internet sobem quando a sincronização volta. */
  async function enviarVersoesPendentes() {
    if (!drive()) return;
    for (const v of (await dados.versoes.todas()).filter((x) => !x.noDrive)) await enviarVersao(v);
  }

  /** Das versões com mais de 2 dias fica uma por dia; as recentes ficam todas. */
  async function enxugar(textoId) {
    const limite = Date.now() - 2 * 86400000;
    const dias = new Set();
    for (const v of await dados.versoes.doTexto(textoId)) {
      if (Date.parse(v.em) > limite) continue;
      const dia = v.em.slice(0, 10);
      if (dias.has(dia) && v.motivo === 'automática') await dados.versoes.apagar(v.id);
      else dias.add(dia);
    }
  }

  /** Lê do aparelho as versões do texto (para o painel Versões). */
  async function carregarVersoes(id) {
    cacheVersoes.set(id, await dados.versoes.doTexto(id));
  }

  /** Todas as versões conhecidas do texto: as deste aparelho e as que o texto lista (guardadas em outro aparelho). */
  function versoesDe(t) {
    const porData = new Map();
    for (const v of t.versoes || []) porData.set(v.em, { ...v, aqui: false });
    for (const v of cacheVersoes.get(t.id) || []) porData.set(v.em, { em: v.em, arquivo: v.arquivo, palavras: v.palavras, motivo: v.motivo, aqui: true });
    return [...porData.values()].sort((a, b) => b.em.localeCompare(a.em));
  }

  /** Guarda agora uma versão do texto, a pedido do autor. */
  async function salvarVersao(id, motivo = 'manual') {
    const t = obter(id);
    if (!t) return null;
    const v = await guardarVersao(t, motivo);
    const novoT = await salvar({ ...t, versoes: [v, ...(t.versoes || [])].slice(0, 100) });
    // Dois níveis de confirmação: neste aparelho (sempre) e no Drive (quando há conexão).
    return { v, texto: novoT, noDrive: await envios.get(v.em) };
  }

  /** O texto daqui vai ser trocado pelo que veio de outro aparelho: se o conteúdo é outro, guarda o daqui. */
  async function guardarAntesDeReceber(local, remoto) {
    if (!temTexto(local) || (!remoto.apagado && conteudoDe(local) === conteudoDe(remoto))) return;
    await guardarVersao(local, 'antes de receber de outro aparelho');
  }

  /** Volta o texto a uma versão. O que está na tela é guardado antes, como mais uma versão. */
  async function restaurarVersao(id, arquivo) {
    let antiga = (await dados.versoes.doTexto(id)).find((v) => v.arquivo === arquivo)?.texto;
    if (!antiga) {
      const d = drive();
      if (!d) throw new Error('Esta versão foi guardada em outro aparelho. Entre com o Google para abrir do seu Drive.');
      const conteudo = await d.ler(arquivo);
      if (!conteudo) throw new Error('Esta versão não foi encontrada no seu Drive.');
      antiga = JSON.parse(conteudo).texto;
    }
    const atual = obter(id);
    const t = await salvar({ ...atual, secoes: antiga.secoes, titulo: antiga.titulo }, { versao: 'antes de restaurar' });
    registrar('ui', 'texto.restaurar');
    return t;
  }

  return { carregar, todos: () => textos, obter, novo, salvar, apagar, salvarVersao, restaurarVersao, carregarVersoes, versoesDe, guardarAntesDeReceber, enviarVersoesPendentes, gravarLegivel, medir: medirAutoria, referencias: (t) => referencias(t, bib.leituras()) };
}
