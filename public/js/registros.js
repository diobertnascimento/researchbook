// Registros: cada ação, erro e evento do app vira uma linha, gravada neste aparelho.
// Quando o Drive estiver ligado, cada sessão também vira registros/<data>/sessao-<hora>.jsonl.
//
// Privacidade: nunca registre conteúdo do usuário (texto de grifo, nota, mensagem, prompt).
// Só nomes de ações, telas, ids, tamanhos, tempos e resultados.

const RETENCAO_DIAS = 180;
const INTERVALO_MS = 2000;
const NO_CACHE = 400;

export function criarRegistros(db, { versao }) {
  const sessao = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', 'h');
  const cache = [];
  let fila = [];
  let timer = null;
  const ouvintes = new Set();

  function registrar(tipo, ev, { onde, det = '', dur = null, st = 'ok' } = {}) {
    const e = {
      t: new Date().toISOString(),
      sessao,
      v: versao,
      tipo,
      ev,
      onde: onde ?? ((location.hash || '#painel').slice(1).split('/')[0] || 'painel'),
      det: String(det).slice(0, 200),
      dur,
      st,
    };
    cache.push(e);
    if (cache.length > NO_CACHE) cache.shift();
    fila.push(e);
    if (!timer) timer = setTimeout(gravar, INTERVALO_MS);
    ouvintes.forEach((f) => f(e));
    return e;
  }

  function gravar() {
    clearTimeout(timer);
    timer = null;
    if (!fila.length || !db) return Promise.resolve(0);
    const lote = fila;
    fila = [];
    return new Promise((ok) => {
      const tx = db.transaction('registros', 'readwrite');
      const st = tx.objectStore('registros');
      for (const e of lote) st.add(e);
      tx.oncomplete = () => ok(lote.length);
      tx.onerror = () => {
        fila = lote.concat(fila); // tenta de novo no próximo ciclo
        ok(0);
      };
    });
  }

  async function carregarRecentes() {
    if (!db) return;
    const antigos = await new Promise((ok) => {
      const lista = [];
      const req = db.transaction('registros').objectStore('registros').index('t').openCursor(null, 'prev');
      req.onsuccess = () => {
        const c = req.result;
        if (c && lista.length < NO_CACHE - cache.length) {
          lista.push(c.value);
          c.continue();
        } else ok(lista.reverse());
      };
      req.onerror = () => ok([]);
    });
    const vistos = new Set(cache.map((e) => e.t + e.ev));
    cache.unshift(...antigos.filter((e) => !vistos.has(e.t + e.ev)));
  }

  async function limparAntigos() {
    if (!db) return 0;
    const limite = new Date(Date.now() - RETENCAO_DIAS * 864e5).toISOString();
    return new Promise((ok) => {
      let n = 0;
      const req = db.transaction('registros', 'readwrite').objectStore('registros').index('t').openCursor(IDBKeyRange.upperBound(limite));
      req.onsuccess = () => {
        const c = req.result;
        if (c) {
          c.delete();
          n++;
          c.continue();
        } else ok(n);
      };
      req.onerror = () => ok(n);
    });
  }

  function doBanco() {
    return gravar().then(
      () =>
        new Promise((ok) => {
          const req = db.transaction('registros').objectStore('registros').getAll();
          req.onsuccess = () => ok(req.result);
          req.onerror = () => ok([]);
        }),
    );
  }

  function csv(lista = cache) {
    const campos = ['t', 'sessao', 'v', 'tipo', 'ev', 'onde', 'det', 'dur', 'st'];
    const esc = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
    return [campos.join(','), ...lista.map((e) => campos.map((c) => esc(e[c])).join(','))].join('\n');
  }

  // Grava ao sair ou esconder o app (no iPhone, "pagehide" é o último aviso confiável).
  addEventListener('pagehide', gravar);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && gravar());

  return {
    sessao,
    registrar,
    gravar,
    carregarRecentes,
    limparAntigos,
    doBanco,
    csv,
    lista: () => cache.slice(),
    aoRegistrar: (f) => ouvintes.add(f),
  };
}
