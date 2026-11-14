// Sincronização entre a cópia deste aparelho (IndexedDB) e a pasta do Drive.
//
// Cada coleção vira um arquivo legível: researchbook/dados/<colecao>.json.
// Cada item tem id, atualizadoEm e aparelho. Apagar não remove: marca apagado: true,
// para a exclusão chegar aos outros aparelhos.
//
// Regra de junção, item por item, comparando com a última sincronização (base):
// - mudou só aqui: vai para o Drive; mudou só no Drive: vem para cá;
// - mudou nos dois: fica a versão mais recente e a outra vai para "conflitos",
//   para o Diobert decidir. Nada é descartado em silêncio.
//
// Custo: quando nada mudou, uma sincronização é uma única chamada (lista a pasta dados/).
import * as arm from './armazenamento.js';

const INTERVALO_MS = 60_000;
const ESPERA_MUDANCA_MS = 4_000;

export function criarSincronia({ db, drive, registros, aparelho, aoEstado }) {
  const registrar = registros.registrar;
  let estado = { fase: 'parado', ultima: null, erro: null, conflitos: 0 };
  let rodando = null;
  let espera = null;
  let enviadosRegistros = 0;

  const mudar = (x) => {
    estado = { ...estado, ...x };
    aoEstado?.(estado);
  };

  async function sincronizarColecao(c, remotoInfo) {
    const meta = (await arm.lerMeta(db, `sinc:${c}`)) || { base: {}, remotoModificado: null };
    const locais = await arm.todos(db, c);
    const localMudou = locais.some((i) => meta.base[i.id] !== i.atualizadoEm);
    const remotoMudou = !!remotoInfo && remotoInfo.modifiedTime !== meta.remotoModificado;
    if (!localMudou && !remotoMudou) return { baixados: 0, enviados: 0, conflitos: 0 };

    let remotos = locais.filter((i) => meta.base[i.id] === i.atualizadoEm); // o que o Drive já tem
    if (remotoMudou) {
      const texto = await drive.ler(`dados/${c}.json`);
      try {
        remotos = texto ? JSON.parse(texto).itens || [] : [];
      } catch {
        throw new Error(`O arquivo dados/${c}.json no Drive não pôde ser lido`);
      }
    }

    const L = new Map(locais.map((i) => [i.id, i]));
    const R = new Map(remotos.map((i) => [i.id, i]));
    const final = [];
    const paraAqui = [];
    const conflitos = [];
    let enviar = !remotoInfo;

    for (const id of new Set([...L.keys(), ...R.keys()])) {
      const l = L.get(id);
      const r = R.get(id);
      const b = meta.base[id];
      if (l && !r) {
        final.push(l);
        enviar = true;
      } else if (!l && r) {
        final.push(r);
        paraAqui.push(r);
      } else if (l.atualizadoEm === r.atualizadoEm) {
        final.push(l);
      } else {
        const mudouAqui = l.atualizadoEm !== b;
        const mudouLa = r.atualizadoEm !== b;
        if (mudouAqui && mudouLa) {
          const vence = l.atualizadoEm > r.atualizadoEm ? l : r;
          const perde = vence === l ? r : l;
          conflitos.push({
            id: `${c}:${id}:${perde.atualizadoEm}`,
            colecao: c,
            itemId: id,
            versao: perde,
            vencedora: vence.atualizadoEm,
            origemDaPerdedora: perde === l ? 'este aparelho' : 'Drive',
            em: new Date().toISOString(),
          });
          final.push(vence);
          if (vence === r) paraAqui.push(r);
          else enviar = true;
        } else if (mudouLa) {
          final.push(r);
          paraAqui.push(r);
        } else {
          final.push(l);
          enviar = true;
        }
      }
    }

    if (paraAqui.length) await arm.gravarVarios(db, c, paraAqui);
    if (conflitos.length) await arm.gravarVarios(db, 'conflitos', conflitos);
    let remotoModificado = remotoInfo?.modifiedTime ?? null;
    if (enviar || conflitos.length) {
      const conteudo = JSON.stringify({ app: 'researchbook', colecao: c, atualizadoEm: new Date().toISOString(), itens: final }, null, 1);
      remotoModificado = (await drive.gravar(`dados/${c}.json`, conteudo)).modificado;
    }
    await arm.gravarMeta(db, `sinc:${c}`, { base: Object.fromEntries(final.map((i) => [i.id, i.atualizadoEm])), remotoModificado });
    return { baixados: paraAqui.length, enviados: enviar ? final.length : 0, conflitos: conflitos.length };
  }

  async function enviarRegistros() {
    const daSessao = (await registros.doBanco()).filter((e) => e.sessao === registros.sessao);
    if (daSessao.length === enviadosRegistros) return;
    const dia = daSessao[0]?.t.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    const linhas = daSessao.map((e) => JSON.stringify(e)).join('\n') + '\n';
    await drive.gravar(`registros/${dia}/sessao-${registros.sessao}-${aparelho.slice(0, 8)}.jsonl`, linhas, 'application/x-ndjson');
    enviadosRegistros = daSessao.length;
  }

  function sincronizar() {
    if (rodando) return rodando;
    rodando = (async () => {
      if (!navigator.onLine) {
        mudar({ fase: 'offline' });
        return estado;
      }
      mudar({ fase: 'sincronizando' });
      const inicio = performance.now();
      const total = { baixados: 0, enviados: 0, conflitos: 0 };
      try {
        await drive.raiz();
        const noDrive = Object.fromEntries((await drive.listar('dados')).map((f) => [f.name, f]));
        for (const c of arm.COLECOES) {
          const r = await sincronizarColecao(c, noDrive[`${c}.json`]);
          for (const k in total) total[k] += r[k];
        }
        await enviarRegistros();
        const conflitos = (await arm.todos(db, 'conflitos')).length;
        mudar({ fase: 'ok', ultima: new Date().toISOString(), erro: null, conflitos });
        registrar('arq', 'sinc.ok', {
          det: `${total.baixados} recebidos, ${total.enviados} enviados, ${total.conflitos} conflitos`,
          dur: Math.round(performance.now() - inicio),
        });
      } catch (e) {
        const fase = e.codigo === 401 ? 'desconectado' : e.codigo === 'rede' ? 'offline' : 'erro';
        mudar({ fase, erro: e.message });
        registrar(fase === 'erro' ? 'erro' : 'arq', 'sinc.falhou', { det: e.message, dur: Math.round(performance.now() - inicio), st: fase === 'erro' ? 'erro' : 'aviso' });
      } finally {
        rodando = null;
      }
      return estado;
    })();
    return rodando;
  }

  /** Pede uma sincronização logo depois de uma mudança local (junta várias mudanças seguidas). */
  function agendar(ms = ESPERA_MUDANCA_MS) {
    clearTimeout(espera);
    espera = setTimeout(sincronizar, ms);
  }

  setInterval(() => document.visibilityState === 'visible' && estado.fase !== 'desconectado' && sincronizar(), INTERVALO_MS);
  addEventListener('online', () => sincronizar());
  addEventListener('offline', () => mudar({ fase: 'offline' }));
  document.addEventListener('visibilitychange', () => estado.fase !== 'desconectado' && sincronizar());

  /** Atualiza o número de conflitos depois que o Diobert resolve algum (sem sincronizar de novo). */
  async function recontar() {
    mudar({ conflitos: (await arm.todos(db, 'conflitos')).length });
  }

  return { sincronizar, agendar, recontar, estado: () => estado, idPasta: drive.idRaiz };
}
