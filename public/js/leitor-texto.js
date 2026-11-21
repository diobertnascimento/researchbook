// Modo leitura (v2.2.0): o artigo só com o texto e as figuras, numa coluna estreita em Literata.
// O texto sai do próprio PDF (PDF.js). Cada pedaço de texto guarda a sua posição na página, então um grifo
// feito aqui aparece no modo PDF e o contrário também. Tem a mesma interface de controle do leitor de PDF.
// Figuras e tabelas (v2.19.0): além das imagens guardadas no PDF, o modo leitura acha o que foi desenhado
// com linhas e formas (gráficos, diagramas, tabelas com réguas) e mostra o recorte da página no lugar.
// O texto que está dentro do recorte sai do texto corrido, porque já aparece na figura.
// Limites conhecidos: a ordem do texto é a que o PDF traz (duas colunas podem sair embaralhadas) e tabela
// sem nenhuma linha desenhada (só alinhada por espaços) continua saindo como texto.
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

/**
 * O que foi desenhado numa página, em frações da página (acompanha as transformações do PDF):
 * imagens (fotos, figuras guardadas como imagem) e traços (linhas, retângulos e formas pintados).
 */
export async function desenhosDaPagina(pg, L) {
  const vp = pg.getViewport({ scale: 1 });
  const ops = await pg.getOperatorList();
  const O = L.OPS;
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  let m = [1, 0, 0, 1, 0, 0];
  const pilha = [];
  const imagens = [];
  const tracos = [];
  const caixa = (pontos) => {
    const pts = pontos.map(([x, y]) => vp.convertToViewportPoint(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return { x: Math.max(0, Math.min(...xs)) / vp.width, y: Math.max(0, Math.min(...ys)) / vp.height, w: (Math.max(...xs) - Math.min(...xs)) / vp.width, h: (Math.max(...ys) - Math.min(...ys)) / vp.height };
  };
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
      const c = caixa([[0, 0], [1, 0], [0, 1], [1, 1]]);
      // Ícones e enfeites pequenos ficam de fora; uma imagem do tamanho da página é um PDF digitalizado.
      if (c.w >= 0.12 && c.h >= 0.05 && !(c.w > 0.95 && c.h > 0.95)) imagens.push(c);
    } else if (fn === O.constructPath) {
      // O PDF.js entrega cada caminho com a operação de pintura e a caixa que ele ocupa [minX, minY, maxX, maxY].
      // Caminho que só recorta (sem pintar) não é desenho.
      const mm = a?.[a.length - 1];
      if (a?.[0] === O.endPath || !mm || mm.length !== 4 || ![...mm].every(Number.isFinite)) return;
      tracos.push(caixa([[mm[0], mm[1]], [mm[2], mm[1]], [mm[0], mm[3]], [mm[2], mm[3]]]));
    }
  });
  return { imagens, tracos };
}

const juntar = (a, b) => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
const tocam = (a, b, folga = 0) => a.x <= b.x + b.w + folga && b.x <= a.x + a.w + folga && a.y <= b.y + b.h + folga && b.y <= a.y + a.h + folga;
const crescer = (c, f) => {
  const x = Math.max(0, c.x - f);
  const y = Math.max(0, c.y - f);
  return { x, y, w: Math.min(1, c.x + c.w + f) - x, h: Math.min(1, c.y + c.h + f) - y };
};

/**
 * Regiões de figura e de tabela de uma página, a partir do que foi desenhado nela (regra pura, sem PDF).
 *  1. Tabela com réguas: três ou mais linhas horizontais com o mesmo começo e o mesmo fim (a régua de cima,
 *     a do cabeçalho e a de baixo, como nas revistas; a tabela em grade também cai aqui). Duas réguas não
 *     bastam: resumo e citação em destaque costumam vir entre duas.
 *  2. Desenho denso: cinco ou mais traços próximos (gráfico, diagrama, fluxograma).
 *  3. As imagens.
 * Réguas de cabeçalho e rodapé (nas margens) e fundos do tamanho da página ficam de fora.
 */
export function regioesDeFigura({ imagens = [], tracos = [] }) {
  const uteis = tracos.filter((t) => !(t.w > 0.9 && t.h > 0.9));
  const ehRegua = (t) => t.h < 0.004 && t.w >= 0.25;
  const naMargem = (t) => t.y < 0.09 || t.y > 0.93;
  const regioes = [];

  // 1. Tabelas com réguas
  const reguas = uteis.filter((t) => ehRegua(t) && !naMargem(t)).sort((a, b) => a.y - b.y);
  const usados = new Set();
  for (const r of reguas) {
    if (usados.has(r)) continue;
    let grupo = reguas.filter((o) => !usados.has(o) && Math.abs(o.x - r.x) < 0.015 && Math.abs(o.x + o.w - (r.x + r.w)) < 0.015);
    grupo.forEach((o) => usados.add(o));
    // Grupo alto demais são duas tabelas na mesma página: separa no maior vão.
    const partes = [];
    const dividir = (g) => {
      if (g.length < 3) return;
      const alt = g[g.length - 1].y - g[0].y;
      if (alt <= 0.6) return partes.push(g);
      let k = 1;
      for (let i = 2; i < g.length; i++) if (g[i].y - g[i - 1].y > g[k].y - g[k - 1].y) k = i;
      dividir(g.slice(0, k));
      dividir(g.slice(k));
    };
    dividir(grupo);
    for (const g of partes) regioes.push(crescer({ x: g[0].x, y: g[0].y, w: g[0].w, h: g[g.length - 1].y - g[0].y }, 0.005));
  }

  // 2. Desenhos densos: junta os traços vizinhos. As réguas das tabelas entram na conta: num gráfico, as linhas
  //    de grade parecem réguas, e a região tem que cobrir também as barras que passam delas.
  const livres = uteis.filter((t) => !(ehRegua(t) && naMargem(t)));
  const grupos = [];
  for (const t of livres) {
    const perto = grupos.filter((g) => tocam(g.caixa, t, 0.02));
    const g = { caixa: perto.reduce((c, o) => juntar(c, o.caixa), t), n: 1 + perto.reduce((n, o) => n + o.n, 0) };
    for (const o of perto) grupos.splice(grupos.indexOf(o), 1);
    grupos.push(g);
  }
  for (const g of grupos) if (g.n >= 5 && g.caixa.w >= 0.18 && g.caixa.h >= 0.05 && g.caixa.w * g.caixa.h <= 0.8) regioes.push(crescer(g.caixa, 0.015));

  // 3. Imagens, e o que encosta vira uma região só
  const todas = [...regioes, ...imagens];
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (let i = 0; i < todas.length && !mudou; i++)
      for (let j = i + 1; j < todas.length && !mudou; j++)
        if (tocam(todas[i], todas[j])) {
          todas[i] = juntar(todas[i], todas[j]);
          todas.splice(j, 1);
          mudou = true;
        }
  }
  return todas.filter((c) => !(c.w > 0.95 && c.h > 0.95)).sort((p, q) => p.y - q.y);
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
      const caixas = regioesDeFigura(await desenhosDaPagina(pg, L));
      if (!caixas.length) return;
      const vp = pg.getViewport({ scale: Math.min(2, 1400 / pg.getViewport({ scale: 1 }).width) });
      const tela = document.createElement('canvas');
      tela.width = Math.ceil(vp.width);
      tela.height = Math.ceil(vp.height);
      await pg.render({ canvasContext: tela.getContext('2d'), viewport: vp }).promise;
      for (const c of caixas) {
        // O recorte não pode cortar uma linha de texto pela metade: a borda de cima e a de baixo recuam até
        // a linha vizinha que fica de fora (a legenda, o parágrafo seguinte).
        for (const el of sec.querySelectorAll('.lt-i')) {
          const [x, y, w, h] = el.dataset.r.split(',').map(Number);
          const cy = y + h / 2;
          if (x + w < c.x || x > c.x + c.w || (cy >= c.y && cy <= c.y + c.h)) continue;
          const fim = c.y + c.h;
          // A caixa de um pedaço de texto vai até a linha de base: as pernas das letras (g, p, ç) descem mais um pouco.
          if (cy < c.y && y + h * 1.35 > c.y) c.y = Math.min(fim, y + h * 1.35);
          else if (cy > fim && y < fim) c.h = Math.max(0, y - 0.002 - c.y);
          if (cy < c.y) c.h = Math.max(0, fim - c.y);
        }
        if (c.h < 0.02) continue;
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
        fig.innerHTML = `<img src="${url}" alt="Figura ou tabela da página ${sec.dataset.pagina}" width="${corte.width}" height="${corte.height}">`;
        // O texto que está dentro do recorte (células da tabela, rótulos do gráfico) já aparece na figura:
        // sai do texto corrido, para não repetir embaralhado.
        for (const el of sec.querySelectorAll('.lt-i')) {
          const [x, y, w, h] = el.dataset.r.split(',').map(Number);
          const cx = x + w / 2;
          const cy = y + h / 2;
          if (cx >= c.x && cx <= c.x + c.w && cy >= c.y && cy <= c.y + c.h) el.remove();
        }
        for (const b of sec.querySelectorAll('.lt-b')) if (!b.querySelector('.lt-i')) b.dataset.vazio = '1';
        // Entra depois do último bloco de texto que está acima dela na página.
        const antes = [...sec.querySelectorAll('.lt-b')].filter((b) => Number(b.dataset.y) <= c.y + c.h / 2).pop();
        if (antes) antes.after(fig);
        else sec.querySelector('.lt-num').after(fig);
        sec.querySelectorAll('.lt-b[data-vazio]').forEach((b) => b.remove());
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
