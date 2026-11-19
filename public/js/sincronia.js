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
// - o Drive voltou a uma versão mais velha do que a que este aparelho enviou (dois aparelhos gravaram ao
//   mesmo tempo): vale a daqui, que é reenviada. Sem isso, o celular e o computador abertos juntos
//   podiam apagar a mudança um do outro.
//
// Custo: quando nada mudou, uma sincronização é uma única chamada (lista a pasta dados/).
//
// Limpeza: a marca de apagado (só o id) fica 90 dias, tempo para todos os aparelhos receberem a exclusão.
// Depois sai do Drive e do aparelho. Um aparelho que ficar mais de 90 dias sem sincronizar pode trazer de volta
// um item apagado nesse meio tempo (aparece de novo, nada se perde).
import * as arm from './armazenamento.js';

export const LIMPAR_APAGADOS_DIAS = 90;
export const marcaVencida = (i, agora = Date.now()) => !!i?.apagado && !!i.atualizadoEm && Date.parse(i.atualizadoEm) < agora - LIMPAR_APAGADOS_DIAS * 86400000;

const INTERVALO_MS = 60_000;
// Curto de propósito: no celular é comum mudar algo e bloquear a tela em seguida.
const ESPERA_MUDANCA_MS = 2_000;

export function criarSincronia({ db, drive, registros, aparelho, aoEstado, aoSubstituir }) {
  const registrar = registros.registrar;
  // pendente: há mudança daqui que ainda não subiu. pendentes: quantas (contadas quando o envio não pode acontecer).
  // recebidos: quantos itens vieram de outro aparelho na última sincronização.
  let estado = { fase: 'parado', ultima: null, erro: null, conflitos: 0, pendente: false, pendentes: 0, recebidos: 0 };
  let mudancas = 0;
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
    const temVencidas = locais.some((i) => marcaVencida(i));
    if (!localMudou && !remotoMudou && !temVencidas) return { baixados: 0, enviados: 0, conflitos: 0 };

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
    let final = [];
    let paraAqui = [];
    const conflitos = [];
    let enviar = !remotoInfo;
    let regressoes = 0;

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
        } else if (mudouLa && b && r.atualizadoEm < b) {
          // O Drive voltou a uma versão mais antiga do que a que este aparelho já tinha enviado: outro aparelho
          // gravou o arquivo ao mesmo tempo, a partir de uma cópia velha. Vale a versão daqui, que vai de novo.
          // Se a versão velha veio de outro aparelho, ela fica guardada em "conflitos" (nada some em silêncio).
          if (r.aparelho && r.aparelho !== aparelho)
            conflitos.push({ id: `${c}:${id}:${r.atualizadoEm}`, colecao: c, itemId: id, versao: r, vencedora: l.atualizadoEm, origemDaPerdedora: 'Drive', em: new Date().toISOString() });
          final.push(l);
          enviar = true;
          regressoes++;
        } else if (mudouLa) {
          final.push(r);
          paraAqui.push(r);
        } else {
          final.push(l);
          enviar = true;
        }
      }
    }

    if (regressoes) registrar('arq', 'sinc.regressao', { det: `${c}: ${regressoes} itens reenviados (o Drive tinha uma versão mais antiga)`, st: 'aviso' });
    const vencidas = final.filter((i) => marcaVencida(i));
    if (vencidas.length) {
      final = final.filter((i) => !marcaVencida(i));
      paraAqui = paraAqui.filter((i) => !marcaVencida(i));
      for (const i of vencidas) await arm.removerDe(db, c, i.id);
      enviar = true;
      registrar('arq', 'sinc.limpeza', { det: `${c}: ${vencidas.length} marcas de apagado com mais de ${LIMPAR_APAGADOS_DIAS} dias` });
    }
    // Nada some em silêncio: quem chamou pode guardar a versão daqui antes de ela ser trocada pela que veio do Drive.
    if (aoSubstituir)
      for (const r of paraAqui) {
        const l = L.get(r.id);
        if (l && !l.apagado) await aoSubstituir(c, l, r);
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
      const vistas = mudancas;
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
        // Só deixa de estar pendente se nada mudou aqui enquanto a sincronização rodava.
        mudar({ fase: 'ok', ultima: new Date().toISOString(), erro: null, conflitos, pendente: mudancas !== vistas, pendentes: 0, recebidos: total.baixados });
        registrar('arq', 'sinc.ok', {
          det: `${total.baixados} recebidos, ${total.enviados} enviados, ${total.conflitos} conflitos`,
          dur: Math.round(performance.now() - inicio),
        });
      } catch (e) {
        const fase = e.codigo === 401 ? 'desconectado' : e.codigo === 'rede' ? 'offline' : 'erro';
        mudar({ fase, erro: e.message });
        contarPendentes();
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
    mudancas++;
    if (!estado.pendente) mudar({ pendente: true });
    if (['offline', 'desconectado', 'erro'].includes(estado.fase)) contarPendentes();
    clearTimeout(espera);
    espera = setTimeout(sincronizar, ms);
  }

  /** Conta o que mudou neste aparelho e ainda não está no Drive (para dizer isso na tela quando não dá para enviar). */
  async function contarPendentes() {
    try {
      let n = 0;
      for (const c of arm.COLECOES) {
        const base = ((await arm.lerMeta(db, `sinc:${c}`)) || { base: {} }).base;
        for (const i of await arm.todos(db, c)) if (base[i.id] !== i.atualizadoEm) n++;
      }
      if (n !== estado.pendentes || (n > 0 && !estado.pendente)) mudar({ pendentes: n, pendente: n > 0 || estado.pendente });
      return n;
    } catch {
      return estado.pendentes;
    }
  }

  setInterval(() => document.visibilityState === 'visible' && estado.fase !== 'desconectado' && sincronizar(), INTERVALO_MS);
  addEventListener('online', () => sincronizar());
  addEventListener('offline', () => mudar({ fase: 'offline' }));
  document.addEventListener('visibilitychange', () => estado.fase !== 'desconectado' && sincronizar());

  /** Atualiza o número de conflitos depois que o Diobert resolve algum (sem sincronizar de novo). */
  async function recontar() {
    mudar({ conflitos: (await arm.todos(db, 'conflitos')).length });
  }

  return { sincronizar, agendar, recontar, contarPendentes, estado: () => estado, idPasta: drive.idRaiz };
}
