// Leitor de PDF com PDF.js (Mozilla), servido pelo próprio app em public/vendor/pdfjs.
// Desenha as páginas sob demanda, com camada de texto para selecionar, e mostra os grifos
// como marcas coloridas por cima da página. Cada grifo guarda a página e retângulos em
// proporção da página (0 a 1), para continuar no lugar em qualquer tamanho de tela.

const BASE = new URL('../vendor/pdfjs/', import.meta.url).href;
let lib = null;

export const FUNCOES = [
  { id: 'conceito', nome: 'Conceito' },
  { id: 'evidencia', nome: 'Evidência' },
  { id: 'metodo', nome: 'Método' },
  { id: 'critica', nome: 'Crítica' },
  { id: 'dissert', nome: 'Para a dissertação' },
];

async function pdfjs() {
  if (!lib) {
    lib = await import(BASE + 'pdf.min.js');
    lib.GlobalWorkerOptions.workerSrc = BASE + 'pdf.worker.min.js';
  }
  return lib;
}

/** Abre o PDF (Blob) e devolve o documento do PDF.js. */
export async function abrirDocumento(blob) {
  const L = await pdfjs();
  return L.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    isEvalSupported: false,
    wasmUrl: BASE + 'wasm/',
    standardFontDataUrl: BASE + 'standard_fonts/',
  }).promise;
}

/** Título, autor e texto das primeiras páginas: ajudam a preencher a ficha de um PDF novo. */
export async function lerInicio(blob, paginas = 2) {
  const doc = await abrirDocumento(blob);
  const meta = await doc.getMetadata().catch(() => ({}));
  let texto = '';
  for (let n = 1; n <= Math.min(paginas, doc.numPages); n++) {
    const c = await (await doc.getPage(n)).getTextContent();
    texto += c.items.map((i) => i.str).join(' ') + '\n';
  }
  const info = meta.info || {};
  const total = doc.numPages;
  await fechar(doc);
  return { titulo: info.Title || null, autor: info.Author || null, texto, total };
}

const r4 = (x) => Math.round(x * 10000) / 10000;
const fechar = (doc) => (doc.loadingTask?.destroy ? doc.loadingTask.destroy() : doc.destroy?.());

/**
 * Monta o leitor dentro de `palco`. Chama:
 *  aoGrifar({pagina, texto, rects, funcao}), aoClicarGrifo(id, elemento), aoMudarPagina(n, total).
 */
export async function montarLeitor({ palco, blob, grifos = [], paginaInicial = 1, aoGrifar, aoClicarGrifo, aoMudarPagina, aoErro }) {
  const L = await pdfjs();
  let doc;
  try {
    doc = await abrirDocumento(blob);
  } catch (e) {
    aoErro?.(e);
    return null;
  }
  palco.innerHTML = '';
  palco.classList.add('pdf-palco');
  const primeira = await doc.getPage(1);
  const base = primeira.getViewport({ scale: 1 });
  const largura = Math.min(palco.clientWidth - 16, 920);
  const escala = largura / base.width;
  const paginas = [];
  let atuais = grifos;

  for (let n = 1; n <= doc.numPages; n++) {
    const div = document.createElement('div');
    div.className = 'pdf-pagina';
    div.dataset.pagina = n;
    div.style.width = `${largura}px`;
    div.style.height = `${base.height * escala}px`;
    div.style.setProperty('--scale-factor', escala);
    div.style.setProperty('--total-scale-factor', escala);
    div.innerHTML = `<div class="pdf-num">p. ${n}</div>`;
    palco.appendChild(div);
    paginas.push({ div, desenhada: false });
  }

  function desenharGrifos(div) {
    const n = Number(div.dataset.pagina);
    div.querySelector('.pdf-grifos')?.remove();
    const camada = document.createElement('div');
    camada.className = 'pdf-grifos';
    for (const g of atuais.filter((x) => x.pagina === n)) {
      for (const [x, y, w, h] of g.rects || []) {
        const m = document.createElement('div');
        m.className = `pdf-grifo f-${g.funcao}`;
        m.dataset.grifoId = g.id;
        m.title = 'Grifo: toque para mudar a cor ou apagar';
        Object.assign(m.style, { left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` });
        camada.appendChild(m);
      }
    }
    div.appendChild(camada);
  }

  async function desenhar(item) {
    if (item.desenhada) return;
    item.desenhada = true;
    const n = Number(item.div.dataset.pagina);
    const pagina = await doc.getPage(n);
    const vp = pagina.getViewport({ scale: escala });
    item.div.style.height = `${vp.height}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width * dpr);
    canvas.height = Math.floor(vp.height * dpr);
    canvas.style.width = `${vp.width}px`;
    canvas.style.height = `${vp.height}px`;
    item.div.appendChild(canvas);
    await pagina.render({ canvas, canvasContext: canvas.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }).promise;
    const camadaTexto = document.createElement('div');
    camadaTexto.className = 'textLayer';
    item.div.appendChild(camadaTexto);
    await new L.TextLayer({ textContentSource: pagina.streamTextContent(), container: camadaTexto, viewport: vp }).render();
    desenharGrifos(item.div);
    item.div.classList.add('pronta');
  }

  const perto = new IntersectionObserver(
    (es) => es.forEach((e) => e.isIntersecting && desenhar(paginas[Number(e.target.dataset.pagina) - 1])),
    { rootMargin: '800px 0px' },
  );
  let paginaAtual = paginaInicial;
  const visivel = new IntersectionObserver(
    (es) => {
      const mais = es.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (mais) {
        const n = Number(mais.target.dataset.pagina);
        if (n !== paginaAtual) {
          paginaAtual = n;
          aoMudarPagina?.(n, doc.numPages);
        }
      }
    },
    { threshold: [0.25, 0.5, 0.75] },
  );
  paginas.forEach(({ div }) => {
    perto.observe(div);
    visivel.observe(div);
  });

  /* ---------- Grifar: selecionar texto mostra as cores ---------- */
  const pop = document.createElement('div');
  pop.className = 'popover pop-pdf';
  pop.innerHTML = `<div class="linha-p">${FUNCOES.map((f) => `<button class="cor-n" data-grifo-pdf="${f.id}"><i class="c-${f.id}"></i>${f.nome}</button>`).join('')}</div>`;
  document.body.appendChild(pop);
  let selecao = null;

  function lerSelecao() {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const noInicio = range.startContainer.parentElement?.closest('.pdf-pagina');
    const noFim = range.endContainer.parentElement?.closest('.pdf-pagina');
    if (!noInicio || !palco.contains(noInicio)) return null;
    if (noInicio !== noFim) return { erro: 'Grife um trecho de cada vez, dentro da mesma página.' };
    const caixa = noInicio.getBoundingClientRect();
    const rects = [...range.getClientRects()]
      .filter((r) => r.width > 1 && r.height > 1)
      .map((r) => [r4((r.left - caixa.left) / caixa.width), r4((r.top - caixa.top) / caixa.height), r4(r.width / caixa.width), r4(r.height / caixa.height)]);
    const texto = sel.toString().replace(/\s+/g, ' ').trim();
    if (!texto || !rects.length) return null;
    return { pagina: Number(noInicio.dataset.pagina), texto, rects, caixa: range.getBoundingClientRect() };
  }

  function mostrarPop() {
    const s = lerSelecao();
    if (!s) {
      pop.classList.remove('on');
      selecao = null;
      return;
    }
    if (s.erro) {
      pop.classList.remove('on');
      selecao = null;
      window.toast?.(s.erro);
      return;
    }
    selecao = s;
    pop.classList.add('on');
    const w = pop.offsetWidth;
    pop.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, s.caixa.left + s.caixa.width / 2 - w / 2 + scrollX))}px`;
    // No toque, o iPhone mostra o menu dele (Copiar...) acima da seleção: as cores vão para baixo.
    const toque = matchMedia('(pointer: coarse)').matches;
    const acima = s.caixa.top + scrollY - pop.offsetHeight - 10;
    pop.style.top = `${!toque && acima > scrollY + 8 ? acima : s.caixa.bottom + scrollY + 14}px`;
  }

  let espera = null;
  const aoSoltar = (e) => {
    if (pop.contains(e.target)) return;
    clearTimeout(espera);
    espera = setTimeout(mostrarPop, 30);
  };
  const aoMudarSelecao = () => {
    // No celular a seleção muda pelas alças; espera parar de mexer.
    if (!matchMedia('(pointer: coarse)').matches) return;
    clearTimeout(espera);
    espera = setTimeout(mostrarPop, 400);
  };
  document.addEventListener('mouseup', aoSoltar);
  document.addEventListener('touchend', aoSoltar);
  document.addEventListener('selectionchange', aoMudarSelecao);

  pop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-grifo-pdf]');
    if (!b || !selecao) return;
    const { pagina, texto, rects } = selecao;
    getSelection().removeAllRanges();
    pop.classList.remove('on');
    selecao = null;
    aoGrifar?.({ pagina, texto, rects, funcao: b.dataset.grifoPdf });
  });

  palco.addEventListener('click', (e) => {
    const m = e.target.closest('.pdf-grifo');
    if (m && getSelection().isCollapsed) aoClicarGrifo?.(m.dataset.grifoId, m);
  });

  const destino = paginas[Math.max(0, Math.min(paginaInicial, doc.numPages) - 1)];
  if (paginaInicial > 1 && destino) {
    await desenhar(destino);
    destino.div.scrollIntoView({ block: 'start' });
  }
  aoMudarPagina?.(paginaInicial > doc.numPages ? doc.numPages : paginaInicial, doc.numPages);

  return {
    total: doc.numPages,
    atualizarGrifos(lista) {
      atuais = lista;
      paginas.filter((p) => p.desenhada).forEach((p) => desenharGrifos(p.div));
    },
    async irPara(n) {
      const p = paginas[n - 1];
      if (!p) return;
      await desenhar(p);
      p.div.scrollIntoView({ block: 'start', behavior: 'smooth' });
    },
    destruir() {
      perto.disconnect();
      visivel.disconnect();
      document.removeEventListener('mouseup', aoSoltar);
      document.removeEventListener('touchend', aoSoltar);
      document.removeEventListener('selectionchange', aoMudarSelecao);
      pop.remove();
      fechar(doc);
    },
  };
}
