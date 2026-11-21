// Esperas com número (v2.18.0). A regra é uma só: o app mostra o número que ele sabe e nunca inventa um.
//  - sabe o total (bytes, páginas, itens): barra, a medida real e a porcentagem  -> barraHTML, lerComProgresso
//  - sabe só que está esperando (resposta da IA): movimento e o tempo que já passou, que anda sozinho
//    -> pensandoHTML; quando há histórico, também quanto costuma levar (lido dos registros de uso)
// Os textos com tempo se atualizam sozinhos: basta o elemento ter data-desde="<milissegundos>".

/** "8 s", "1 min 12 s", "2 min". */
export function duracao(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
}

/** Tamanho com vírgula: "1,2 MB", "340 KB". */
export function tamanho(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Quando cada espera começou, por chave. Sobrevive ao redesenho da tela (que acontece a cada mudança de estado).
const inicios = new Map();
/** O instante em que a espera "chave" começou; com ativo = false, esquece. */
export function desdeDe(chave, ativo = true) {
  if (!ativo) {
    inicios.delete(chave);
    return null;
  }
  if (!inicios.has(chave)) inicios.set(chave, Date.now());
  return inicios.get(chave);
}

let registros = null;
/**
 * Quanto uma tarefa da IA costuma levar, em ms: a mediana das últimas respostas dela nos registros deste
 * aparelho. Com menos de 3 respostas, devolve null (sem histórico, a tela mostra só o tempo decorrido).
 */
export function costuma(tarefa) {
  const ds = (registros?.lista?.() || [])
    .filter((r) => r.evento === 'ia.resposta' && typeof r.dur === 'number' && String(r.det || '').startsWith(`${tarefa},`))
    .slice(-12)
    .map((r) => r.dur)
    .sort((a, b) => a - b);
  return ds.length >= 3 ? ds[Math.floor(ds.length / 2)] : null;
}
const arredondar = (ms) => (ms < 55000 ? `uns ${Math.max(5, Math.round(ms / 5000) * 5)} s` : `uns ${Math.max(1, Math.round(ms / 60000))} min`);

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * "Pensando há 8 s", com três pontos em movimento. tarefa: nome da tarefa da IA, para dizer quanto costuma
 * levar; passou do dobro do costume, a frase diz que está demorando mais que o normal.
 */
export function pensandoHTML(rotulo, desde, { tarefa = null } = {}) {
  const c = tarefa ? costuma(tarefa) : null;
  const passou = Date.now() - desde;
  return `<span class="esperando"><span class="pontos" aria-hidden="true"><i></i><i></i><i></i></span><span>${esc(rotulo)} há <span data-desde="${desde}">${duracao(passou)}</span>.${c ? ` <span class="esperando-costuma"${c ? ` data-costuma="${c}" data-desde-ref="${desde}"` : ''}>${passou > c * 2 ? 'Está demorando mais que o normal.' : `Costuma levar ${arredondar(c)}.`}</span>` : ''}</span></span>`;
}

/** Barra com a medida real e a porcentagem. total desconhecido (0): só a medida, sem porcentagem. */
export function barraHTML({ rotulo, feito, total, medida = (n) => String(n) }) {
  const pct = total ? Math.min(100, Math.round((feito / total) * 100)) : null;
  return `<div class="andamento" role="status"><div class="andamento-cab"><b>${esc(rotulo)}</b>${pct == null ? '' : `<span class="andamento-pct">${pct}%</span>`}</div>
    ${pct == null ? '' : `<div class="barra" role="progressbar" aria-label="${esc(rotulo)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>`}
    <p class="meta mb-0">${medida(feito)}${total ? ` de ${medida(total)}` : ''}</p></div>`;
}

/**
 * Lê uma resposta de rede aos poucos, avisando quanto já chegou. total: tamanho esperado quando a resposta
 * não informa (o Drive nem sempre manda Content-Length). Devolve o Blob inteiro.
 */
export async function lerComProgresso(resposta, aoProgresso, total = 0) {
  const esperado = Number(resposta.headers.get('content-length')) || total || 0;
  if (!resposta.body?.getReader || !aoProgresso) return resposta.blob();
  const leitor = resposta.body.getReader();
  const partes = [];
  let lidos = 0;
  let ultimo = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    partes.push(value);
    lidos += value.length;
    // No máximo um aviso a cada 150 ms: a tela não precisa de mais que isso.
    if (performance.now() - ultimo > 150) {
      ultimo = performance.now();
      aoProgresso(lidos, Math.max(esperado, lidos));
    }
  }
  aoProgresso(lidos, Math.max(esperado, lidos));
  return new Blob(partes, { type: resposta.headers.get('content-type') || 'application/octet-stream' });
}

/** Liga o relógio das esperas: uma vez por segundo, atualiza todo elemento com data-desde. */
export function iniciarEsperas(reg) {
  registros = reg || null;
  setInterval(() => {
    for (const el of document.querySelectorAll('[data-desde]')) el.textContent = duracao(Date.now() - Number(el.dataset.desde));
    for (const el of document.querySelectorAll('[data-costuma]')) if (Date.now() - Number(el.dataset.desdeRef) > Number(el.dataset.costuma) * 2) el.textContent = 'Está demorando mais que o normal.';
  }, 1000);
}
