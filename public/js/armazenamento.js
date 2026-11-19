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
export const ESQUEMA = 7;
export const ESQUEMA_DADOS = 1;

// Coleções criadas no esquema 1. As que vieram depois entram por um passo próprio em ESTRUTURA.
const COLECOES_V1 = [
  'leituras', 'grifos', 'fichamentos', 'argumentos', 'trilhas', 'textos', 'dialogos',
  'cartoes', 'disciplinas', 'aulas', 'eventos', 'encontros', 'memoria', 'conversas',
];
export const COLECOES = [...COLECOES_V1, 'revisoes', 'lixeira', 'tarefas'];

const ESTRUTURA = {
  1: (db) => {
    for (const c of COLECOES_V1) db.createObjectStore(c, { keyPath: 'id' });
    db.createObjectStore('meta');
    const r = db.createObjectStore('registros', { keyPath: 'n', autoIncrement: true });
    r.createIndex('t', 't');
    r.createIndex('sessao', 'sessao');
    db.createObjectStore('backups', { keyPath: 'criadoEm' });
  },
  // v0.8.0: versões que perderam um conflito de sincronização, guardadas para o Diobert decidir.
  2: (db) => {
    db.createObjectStore('conflitos', { keyPath: 'id' });
  },
  // v0.9.0: cópia local dos PDFs, para ler sem internet. Não sincroniza como coleção: o PDF vai para o Drive como arquivo.
  3: (db) => {
    db.createObjectStore('arquivos', { keyPath: 'id' });
  },
  // v0.13.0: conversas completas com a IA (uma por conversa). O resumo de cada conversa sincroniza na coleção
  // "conversas"; o texto completo vai para o Drive como arquivo (ia/conversas/<id>.json), para não inchar a sincronização.
  4: (db) => {
    db.createObjectStore('mensagens', { keyPath: 'id' });
  },
  // v0.17.0: revisões do projeto de dissertação (uma por versão enviada), sincronizadas como coleção.
  5: (db) => {
    db.createObjectStore('revisoes', { keyPath: 'id' });
  },
  // v1.3.0 (nada se perde): a lixeira guarda inteiro o que foi apagado e sincroniza como coleção.
  // As versões dos textos ficam só neste aparelho (o Drive recebe um arquivo por versão), fora da sincronização.
  6: (db) => {
    db.createObjectStore('lixeira', { keyPath: 'id' });
    db.createObjectStore('versoes', { keyPath: 'id' }).createIndex('textoId', 'textoId');
  },
  // v2.1.0: tarefas do dia (lista livre do Hoje), sincronizadas como as outras coleções.
  7: (db) => {
    db.createObjectStore('tarefas', { keyPath: 'id' });
  },
};

// Exemplo de migração de dados futura:
// 2: async (db) => { const ls = await todos(db, 'leituras'); for (const l of ls) { l.autores = l.aut; delete l.aut; } await gravarVarios(db, 'leituras', ls); }
const MIGRACOES_DADOS = {};

const MANTER_BACKUPS = 5;
/** Motivo da cópia feita uma vez por dia; ficam as 30 mais recentes, à parte das cópias de migração. */
export const DIARIA = 'diária';
const MANTER_DIARIAS = 30;

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

export function um(db, colecao, id) {
  return pedido(db.transaction(colecao).objectStore(colecao).get(id));
}

export function gravar(db, colecao, item) {
  return pedido(db.transaction(colecao, 'readwrite').objectStore(colecao).put(item));
}

/** Remove de vez um registro. Só para coleções internas (ex.: conflitos já resolvidos); dados do usuário usam a marca apagado. */
export function removerDe(db, colecao, id) {
  return pedido(db.transaction(colecao, 'readwrite').objectStore(colecao).delete(id));
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
  // Cada tipo tem o seu limite: as cópias diárias não empurram para fora as de antes de uma migração ou restauração.
  const todas = await pedido(db.transaction('backups').objectStore('backups').getAll());
  const chaves = (diaria) => todas.filter((x) => (x.motivo === DIARIA) === diaria).map((x) => x.criadoEm).sort();
  const sobra = [...chaves(true).slice(0, -MANTER_DIARIAS), ...chaves(false).slice(0, -MANTER_BACKUPS)];
  if (sobra.length) {
    const st = db.transaction('backups', 'readwrite').objectStore('backups');
    await Promise.all(sobra.map((k) => pedido(st.delete(k))));
  }
  return item.criadoEm;
}

const diaLocal = (iso) => new Date(iso).toLocaleDateString('sv');

/** Faz a cópia do dia, se ainda não foi feita hoje neste aparelho. Devolve a data da cópia nova, ou null. */
export async function backupDiario(db) {
  const chaves = await pedido(db.transaction('backups').objectStore('backups').getAll());
  const hoje = diaLocal(new Date().toISOString());
  if (chaves.some((x) => x.motivo === DIARIA && diaLocal(x.criadoEm) === hoje)) return null;
  return backup(db, DIARIA);
}

/** Lista das cópias guardadas, da mais nova para a mais velha, só com as contagens (sem o conteúdo). */
export async function backups(db) {
  const todas = await pedido(db.transaction('backups').objectStore('backups').getAll());
  return todas
    .map((x) => ({ criadoEm: x.criadoEm, motivo: x.motivo, contagem: Object.fromEntries(Object.entries(x.foto.colecoes).map(([c, itens]) => [c, itens.filter((i) => !i.apagado).length])) }))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export function lerBackup(db, criadoEm) {
  return pedido(db.transaction('backups').objectStore('backups').get(criadoEm));
}

/** Versões guardadas de um texto, da mais nova para a mais velha. */
export async function versoesDe(db, textoId) {
  const vs = await pedido(db.transaction('versoes').objectStore('versoes').index('textoId').getAll(textoId));
  return vs.sort((a, b) => b.em.localeCompare(a.em));
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
