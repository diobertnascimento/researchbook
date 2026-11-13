// Armazenamento local (IndexedDB): cópia dos dados neste aparelho, registros e backups.
// A cópia oficial ficará no Google Drive (entrega 2); esta é a que permite usar sem internet.
//
// Regras de evolução do esquema:
// 1. Mudança de estrutura (coleção ou índice novo): suba ESQUEMA e acrescente um passo em ESTRUTURA.
//    Passos de estrutura só ACRESCENTAM. Nunca apague coleção num passo de estrutura.
// 2. Mudança no formato dos dados (renomear campo, dividir coleção): suba ESQUEMA_DADOS e
//    acrescente uma função em MIGRACOES_DADOS. Antes de qualquer migração de dados, o app faz
//    um backup completo na coleção "backups" (ficam os 5 mais recentes).

const NOME = 'researchbook';
export const ESQUEMA = 1;
export const ESQUEMA_DADOS = 1;

export const COLECOES = [
  'leituras', 'grifos', 'fichamentos', 'argumentos', 'trilhas', 'textos', 'dialogos',
  'cartoes', 'disciplinas', 'aulas', 'eventos', 'encontros', 'memoria', 'conversas',
];

const ESTRUTURA = {
  1: (db) => {
    for (const c of COLECOES) db.createObjectStore(c, { keyPath: 'id' });
    db.createObjectStore('meta');
    const r = db.createObjectStore('registros', { keyPath: 'n', autoIncrement: true });
    r.createIndex('t', 't');
    r.createIndex('sessao', 'sessao');
    db.createObjectStore('backups', { keyPath: 'criadoEm' });
  },
};

// Exemplo de migração de dados futura:
// 2: async (db) => { const ls = await todos(db, 'leituras'); for (const l of ls) { l.autores = l.aut; delete l.aut; } await gravarVarios(db, 'leituras', ls); }
const MIGRACOES_DADOS = {};

const MANTER_BACKUPS = 5;

const pedido = (req) =>
  new Promise((ok, erro) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });

export function abrir() {
  return new Promise((ok, erro) => {
    const req = indexedDB.open(NOME, ESQUEMA);
    req.onupgradeneeded = (e) => {
      for (let v = e.oldVersion + 1; v <= ESQUEMA; v++) ESTRUTURA[v]?.(req.result, req.transaction);
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
    req.onblocked = () => erro(new Error('O researchbook está aberto em outra aba com uma versão antiga. Feche as outras abas e abra de novo.'));
  });
}

export function todos(db, colecao) {
  return pedido(db.transaction(colecao).objectStore(colecao).getAll());
}

export function gravarVarios(db, colecao, itens) {
  return new Promise((ok, erro) => {
    const tx = db.transaction(colecao, 'readwrite');
    const st = tx.objectStore(colecao);
    for (const i of itens) st.put(i);
    tx.oncomplete = () => ok(itens.length);
    tx.onerror = () => erro(tx.error);
  });
}

export async function lerMeta(db, chave) {
  return pedido(db.transaction('meta').objectStore('meta').get(chave));
}

export async function gravarMeta(db, chave, valor) {
  return pedido(db.transaction('meta', 'readwrite').objectStore('meta').put(valor, chave));
}

/** Fotografia de todas as coleções de dados (sem registros e sem backups). */
export async function exportar(db) {
  const colecoes = {};
  for (const c of COLECOES) colecoes[c] = await todos(db, c);
  return {
    app: 'researchbook',
    esquema: ESQUEMA,
    esquemaDados: (await lerMeta(db, 'esquemaDados')) ?? ESQUEMA_DADOS,
    exportadoEm: new Date().toISOString(),
    colecoes,
  };
}

export async function backup(db, motivo) {
  const foto = await exportar(db);
  const item = { criadoEm: foto.exportadoEm, motivo, foto };
  await pedido(db.transaction('backups', 'readwrite').objectStore('backups').put(item));
  const chaves = await pedido(db.transaction('backups').objectStore('backups').getAllKeys());
  const sobra = chaves.sort().slice(0, Math.max(0, chaves.length - MANTER_BACKUPS));
  if (sobra.length) {
    const st = db.transaction('backups', 'readwrite').objectStore('backups');
    await Promise.all(sobra.map((k) => pedido(st.delete(k))));
  }
  return item.criadoEm;
}

export async function contarBackups(db) {
  return pedido(db.transaction('backups').objectStore('backups').count());
}

/** Roda as migrações de dados pendentes, sempre com backup antes. Devolve as versões aplicadas. */
export async function migrar(db, registrar = () => {}) {
  const atual = (await lerMeta(db, 'esquemaDados')) ?? 0;
  if (atual === 0) {
    await gravarMeta(db, 'esquemaDados', ESQUEMA_DADOS);
    return [];
  }
  const aplicadas = [];
  for (let v = atual + 1; v <= ESQUEMA_DADOS; v++) {
    if (aplicadas.length === 0) await backup(db, `antes da migração para o esquema ${v}`);
    const inicio = performance.now();
    await MIGRACOES_DADOS[v](db);
    await gravarMeta(db, 'esquemaDados', v);
    registrar('app', 'dados.migracao', { det: `esquema ${v - 1} → ${v}`, dur: Math.round(performance.now() - inicio) });
    aplicadas.push(v);
  }
  return aplicadas;
}

/** Pede ao navegador para não apagar os dados quando faltar espaço. */
export async function pedirPersistencia() {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function espaco() {
  try {
    const { usage, quota } = (await navigator.storage?.estimate?.()) ?? {};
    return { usado: usage ?? null, total: quota ?? null };
  } catch {
    return { usado: null, total: null };
  }
}
