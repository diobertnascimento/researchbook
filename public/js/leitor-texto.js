// Modo leitura (v2.2.0): o artigo só com o texto e as figuras, numa coluna estreita em Literata.
// O texto sai do próprio PDF (PDF.js). Cada pedaço de texto guarda a sua posição na página, então um grifo
// feito aqui aparece no modo PDF e o contrário também. Tem a mesma interface de controle do leitor de PDF.
// Limites conhecidos: a ordem do texto é a que o PDF traz (duas colunas e tabelas podem sair embaralhadas)
// e só entram figuras que o PDF guarda como imagem; gráfico desenhado com linhas não entra.
import { abrirDocumento, pdfjs, FUNCOES } from './leitor-pdf.js';

const r4 = (x) => Math.round(x * 10000) / 10000;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const mediana = (v) => (v.length ? [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] : 0);

/** Linhas de texto de uma página, cada uma com os seus pedaços e a posição de cada pedaço (frações da página). */
export async function linhasDaPagina(pg) {
  const vp = pg.getViewport({ scale: 1 });
  const c = await pg.getTextContent();
  const linhas = [];
  let atual = null;
  for (const i of c.items) {
    if (typeof i.str !== 'string') continue;
    const alt = i.height || Math.abs(i.transform[3]) || 10;
    const [vx, vy] = vp.convertToViewportPoint(i.transform[4], i.transform[5]);
    const p = { s: i.str, r: [r4(vx / vp.width), r4((vy - alt) / vp.height), r4(i.width / vp.width), r4(alt / vp.height)], x: vx, y: vy, alt };
    if (i.str.trim()) {
      if (!atual || Math.abs(p.y - atual.y) > atual.alt * 0.6) {
        atual = { itens: [], x: p.x, y: p.y, alt: p.alt };
        linhas.push(atual);
      }
      atual.itens.push(p);
      atual.alt = Math.max(atual.alt, p.alt);
    }
    if (i.hasEOL) atual = null;
  }
  for (const l of linhas) l.texto = l.itens.map((p) => p.s).join(' ').replace(/\s+/g, ' ').trim();
  return { linhas, largura: vp.width, altura: vp.height };
}

/** Texto que se repete nas margens de várias páginas (cabeçalho, rodapé, número da página). */
function repetidos(paginas) {
  const conta = new Map();
  for (const { linhas, altura } of paginas) {
    const vistos = new Set();
    for (const l of linhas) {
      if (l.y > altura * 0.09 && l.y < altura * 0.93) continue;
      const k = l.texto.replace(/\d+/g, '#');
      if (k.length < 90 && !vistos.has(k)) {
        vistos.add(k);
        conta.set(k, (conta.get(k) || 0) + 1);
      }
    }
  }
  const minimo = Math.max(2, Math.ceil(paginas.length * 0.4));
  return new Set([...conta].filter(([, n]) => n >= minimo).map(([k]) => k));
}

/** Junta as linhas em blocos: parágrafos e títulos. */
export function blocosDe({ linhas, altura }, fora = new Set()) {
  const uteis = linhas.filter((l) => {
    const margem = l.y <= altura * 0.09 || l.y >= altura * 0.93;
    return !(margem && (fora.has(l.texto.replace(/\d+/g, '#')) || /^[\divxlc.\s-]{1,8}$/i.test(l.texto)));
  });
  const corpo = mediana(uteis.map((l) => l.alt)) || 10;
  const blocos = [];
  let b = null;
  let ant = null;
  for (const l of uteis) {
    const titulo = l.alt >= corpo * 1.18 && l.texto.length < 140;
    const salto = ant ? l.y - ant.y : 0;
    const fimDeFrase = ant ? /[.!?:"”)\]]$/.test(ant.texto) : true;
    const novo = !b || titulo !== b.titulo || salto > corpo * 1.9 || (salto < -corpo * 3 && fimDeFrase) || (l.x - ant.x > corpo * 0.9 && fimDeFrase && salto > 0);
    if (novo) {
      b = { titulo, linhas: [], y: l.y };
      blocos.push(b);
    }
    b.linhas.push(l);
    ant = l;
  }
  return blocos;
}

function blocoHTML(b) {
  let html = '';
  b.linhas.forEach((l, li) => {
    l.itens.forEach((p, pi) => {
      let s = p.s;
      const ultimoDaLinha = pi === l.itens.length - 1;
      const proxima = b.linhas[li + 1];
      // Palavra partida no fim da linha: junta com o começo da próxima.
      const partida = ultimoDaLinha && proxima && /[a-zà-ú]-$/i.test(s.trimEnd()) && /^[a-zà-ú]/.test(proxima.texto);
      if (partida) s = s.trimEnd().slice(0, -1);
      html += `<span class="lt-i" data-r="${p.r.join(',')}">${esc(s)}</span>`;
      if (!partida && !/\s$/.test(s)) html += ' ';
    });
  });
  return b.titulo ? `<h3>${html}</h3>` : `<p>${html}</p>`;
}

/** Caixas das imagens de uma página, em frações da página (acompanha as transformações do PDF). */
async function caixasDeImagens(pg, L) {
  const vp = pg.getViewport({ scale: 1 });
  const ops = await pg.getOperatorList();
  const O = L.OPS;
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  let m = [1, 0, 0, 1, 0, 0];
  const pilha = [];
  const caixas = [];
  ops.fnArray.forEach((fn, i) => {
    const a = ops.argsArray[i];
    if (fn === O.save) pilha.push(m);
    else if (fn === O.restore) m = pilha.pop() || m;
    else if (fn === O.transform) m = mul(m, a);
    else if (fn === O.paintFormXObjectBegin) {
      pilha.push(m);
      if (Array.isArray(a?.[0]) && a[0].length === 6) m = mul(m, a[0]);
    } else if (fn === O.paintFormXObjectEnd) m = pilha.pop() || m;
    else if (fn === O.paintImageXObject || fn === O.paintInlineImageXObject) {
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => vp.convertToViewportPoint(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]));
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const c = { x: Math.max(0, Math.min(...xs)) / vp.width, y: Math.max(0, Math.min(...ys)) / vp.height, w: (Math.max(...xs) - Math.min(...xs)) / vp.width, h: (Math.max(...ys) - Math.min(...ys)) / vp.height };
      // Ícones e enfeites pequenos ficam de fora; uma imagem do tamanho da página é um PDF digitalizado.
      if (c.w >= 0.12 && c.h >= 0.05 && !(c.w > 0.95 && c.h > 0.95)) caixas.push(c);
    }
  });
  return caixas.sort((p, q) => p.y - q.y);
}

/**
 * Monta o modo leitura dentro de `palco`. Mesmos avisos do leitor de PDF:
 *  aoGrifar({pagina, texto, rects, funcao}), aoClicarGrifo(id, elemento), aoMudarPagina(n, total), aoPerguntar({pagina, texto}).
 * Devolve o controle, ou { semTexto: true } quando o PDF não tem texto (digitalizado).
 */
export async function montarLeitura({ palco, blob, grifos = [], paginaInicial = 1, aoGrifar, aoClicarGrifo, aoMudarPagina, aoErro, aoPerguntar }) {
  let doc;
  let L;
  try {
    L = await pdfjs();
    doc = await abrirDocumento(blob);
  } catch {
    aoErro?.();
    return null;
  }
  const fechar = () => (doc.loadingTask?.destroy ? doc.loadingTask.destroy() : doc.destroy?.());
  const total = doc.numPages;
  let atuais = grifos;
  let paginaAtual = Math.min(Math.max(1, paginaInicial), total);
  const urls = [];

  // Lê o texto de todas as páginas (em livros longos, só o que repete nas primeiras 40 serve de amostra).
  const paginas = [];
  for (let n = 1; n <= total; n++) paginas.push(await linhasDaPagina(await doc.getPage(n)));
  if (paginas.slice(0, 3).reduce((s, p) => s + p.linhas.reduce((t, l) => t + l.texto.length, 0), 0) < 60) {
    fechar();
    return { semTexto: true };
  }
  const fora = repetidos(paginas.slice(0, 40));

  palco.classList.add('modo-leitura');
  palco.innerHTML = `<article class="lt">${paginas
    .map((p, i) => {
      const blocos = blocosDe(p, fora);
      return `<section class="lt-pagina" data-pagina="${i + 1}"><span class="lt-num">p. ${i + 1}</span>${blocos.map((b) => `<div class="lt-b" data-y="${r4(b.y / p.altura)}">${blocoHTML(b)}</div>`).join('')}</section>`;
    })
    .join('')}</article>`;
  const secoes = [...palco.querySelectorAll('.lt-pagina')];

  /* ---------- Grifos: um pedaço de texto está grifado quando o centro dele cai dentro de um grifo da página ---------- */
  function pintar(sec) {
    const n = Number(sec.dataset.pagina);
    const daPagina = atuais.filter((g) => g.pagina === n);
    for (const el of sec.querySelectorAll('.lt-i')) {
      const [x, y, w, h] = el.dataset.r.split(',').map(Number);
      const cx = x + w / 2;
      const cy = y + h / 2;
      const g = daPagina.find((gr) => (gr.rects || []).some(([gx, gy, gw, gh]) => cx >= gx - 0.004 && cx <= gx + gw + 0.004 && cy >= gy - 0.004 && cy <= gy + gh + 0.004));
      el.className = g ? `lt-i f-${g.funcao}` : 'lt-i';
      if (g) el.dataset.grifoId = g.id;
      else delete el.dataset.grifoId;
    }
  }
  secoes.forEach(pintar);

  /* ---------- Figuras: recortadas da página desenhada, quando ela chega perto da tela ---------- */
  const comFigura = new WeakSet();
  async function figuras(sec) {
    if (comFigura.has(sec)) return;
    comFigura.add(sec);
    try {
      const pg = await doc.getPage(Number(sec.dataset.pagina));
      const caixas = await caixasDeImagens(pg, L);
      if (!caixas.length) return;
      const vp = pg.getViewport({ scale: Math.min(2, 1400 / pg.getViewport({ scale: 1 }).width) });
      const tela = document.createElement('canvas');
      tela.width = Math.ceil(vp.width);
      tela.height = Math.ceil(vp.height);
      await pg.render({ canvasContext: tela.getContext('2d'), viewport: vp }).promise;
      for (const c of caixas) {
        const corte = document.createElement('canvas');
        corte.width = Math.max(1, Math.round(c.w * tela.width));
        corte.height = Math.max(1, Math.round(c.h * tela.height));
        corte.getContext('2d').drawImage(tela, Math.round(c.x * tela.width), Math.round(c.y * tela.height), corte.width, corte.height, 0, 0, corte.width, corte.height);
        const blobImg = await new Promise((ok) => corte.toBlob(ok, 'image/png'));
        if (!blobImg || !palco.contains(sec)) continue;
        const url = URL.createObjectURL(blobImg);
        urls.push(url);
        const fig = document.createElement('figure');
        fig.className = 'lt-fig';
        fig.innerHTML = `<img src="${url}" alt="Figura da página ${sec.dataset.pagina}" width="${corte.width}" height="${corte.height}">`;
        // Entra depois do último bloco de texto que está acima dela na página.
        const antes = [...sec.querySelectorAll('.lt-b')].filter((b) => Number(b.dataset.y) <= c.y + c.h / 2).pop();
        if (antes) antes.after(fig);
        else sec.querySelector('.lt-num').after(fig);
      }
    } catch {
      // Sem as figuras, o texto continua legível.
    }
  }
  const perto = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && figuras(e.target)), { rootMargin: '800px 0px' });
  const visivel = new IntersectionObserver(
    (es) => {
      const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!v) return;
      const n = Number(v.target.dataset.pagina);
      if (n !== paginaAtual) {
        paginaAtual = n;
        aoMudarPagina?.(n, total);
      }
    },
    { rootMargin: '-15% 0px -70% 0px' },
  );
  secoes.forEach((s) => {
    perto.observe(s);
    visivel.observe(s);
  });

  /* ---------- Grifar: selecionar texto mostra as cores (o mesmo quadro do leitor de PDF) ---------- */
  const pop = document.createElement('div');
  pop.className = 'popover pop-pdf';
  const desc = window.rb?.iaUso?.descricoes() || {};
  pop.innerHTML = `<div class="linha-p">${FUNCOES.map((f) => `<button class="cor-n" data-grifo-pdf="${f.id}" title="${(desc[f.id] || '').replace(/"/g, '&quot;')}"><i class="c-${f.id}"></i>${f.nome}</button>`).join('')}</div>${
    aoPerguntar ? '<div class="linha-p pergunta-p"><button class="cor-n" data-perguntar-pdf>Perguntar ao tutor</button></div>' : ''
  }`;
  document.body.appendChild(pop);
  let selecao = null;

  function lerSelecao() {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const noInicio = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement)?.closest('.lt-pagina');
    const noFim = (range.endContainer.nodeType === 1 ? range.endContainer : range.endContainer.parentElement)?.closest('.lt-pagina');
    if (!noInicio || !palco.contains(noInicio)) return null;
    if (noInicio !== noFim) return { erro: 'Grife um trecho de cada vez, dentro da mesma página.' };
    // As posições na página vêm dos pedaços de texto tocados pela seleção, juntando os que estão na mesma linha.
    const rects = [];
    for (const el of noInicio.querySelectorAll('.lt-i')) {
      if (!range.intersectsNode(el) || !el.textContent.trim()) continue;
      const [x, y, w, h] = el.dataset.r.split(',').map(Number);
      const u = rects[rects.length - 1];
      if (u && Math.abs(u[1] - y) < h * 0.5 && x >= u[0]) {
        u[2] = r4(Math.max(u[0] + u[2], x + w) - u[0]);
        u[3] = Math.max(u[3], h);
      } else rects.push([x, y, w, h]);
    }
    const texto = sel.toString().replace(/\s+/g, ' ').trim();
    if (!texto || !rects.length) return null;
    return { pagina: Number(noInicio.dataset.pagina), texto, rects, caixa: range.getBoundingClientRect() };
  }

  function mostrarPop() {
    const s = lerSelecao();
    if (!s || s.erro) {
      pop.classList.remove('on');
      selecao = null;
      if (s?.erro) window.toast?.(s.erro);
      return;
    }
    selecao = s;
    pop.classList.add('on');
    const w = pop.offsetWidth;
    pop.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, s.caixa.left + s.caixa.width / 2 - w / 2 + scrollX))}px`;
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
    if (!matchMedia('(pointer: coarse)').matches) return;
    clearTimeout(espera);
    espera = setTimeout(mostrarPop, 400);
  };
  document.addEventListener('mouseup', aoSoltar);
  document.addEventListener('touchend', aoSoltar);
  document.addEventListener('selectionchange', aoMudarSelecao);
  pop.addEventListener('click', (e) => {
    if (!selecao) return;
    const { pagina, texto, rects } = selecao;
    const perguntar = e.target.closest('[data-perguntar-pdf]');
    const cor = e.target.closest('[data-grifo-pdf]');
    if (!perguntar && !cor) return;
    getSelection().removeAllRanges();
    pop.classList.remove('on');
    selecao = null;
    if (perguntar) aoPerguntar?.({ pagina, texto });
    else aoGrifar?.({ pagina, texto, rects, funcao: cor.dataset.grifoPdf });
  });
  palco.addEventListener('click', (e) => {
    const m = e.target.closest('.lt-i[data-grifo-id]');
    if (m && getSelection().isCollapsed) aoClicarGrifo?.(m.dataset.grifoId, m);
  });

  if (paginaAtual > 1) secoes[paginaAtual - 1]?.scrollIntoView({ block: 'start' });
  aoMudarPagina?.(paginaAtual, total);

  return {
    total,
    modo: 'leitura',
    pagina: () => paginaAtual,
    async texto(n) {
      const p = paginas[n - 1];
      return p ? p.linhas.map((l) => l.texto).join('\n') : '';
    },
    atualizarGrifos(lista) {
      atuais = lista;
      secoes.forEach(pintar);
    },
    async irPara(n) {
      secoes[n - 1]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    },
    destruir() {
      perto.disconnect();
      visivel.disconnect();
      document.removeEventListener('mouseup', aoSoltar);
      document.removeEventListener('touchend', aoSoltar);
      document.removeEventListener('selectionchange', aoMudarSelecao);
      pop.remove();
      urls.forEach((u) => URL.revokeObjectURL(u));
      palco.classList.remove('modo-leitura');
      fechar();
    },
  };
}
