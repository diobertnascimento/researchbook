// Histórico das conversas com a IA: tudo o que a IA produz fica guardado, no aparelho e no Drive.
//
// - Coleção "conversas" (sincroniza como as outras): o resumo de cada conversa — função, obra, título,
//   número de mensagens, datas. Pequena, para a sincronização continuar barata.
// - Store "mensagens" (só no aparelho) + arquivo no Drive ia/conversas/<id>.json: a conversa completa,
//   com cada pedido, cada resposta (inclusive as fontes e a conferência), modelo, tokens, custo,
//   versão da instrução e quais itens do acervo foram enviados. É daqui que a memória e o
//   Overview do autor vão aprender depois.
// - Os registros (logs) continuam sem texto: só tamanhos, tempos e custos.
import * as arm from './armazenamento.js';

const ESPERA_ENVIO_MS = 1500;
const caminho = (id) => `ia/conversas/${id}.json`;

export function criarHistorico({ db, dados, drive, registrar }) {
  let conversas = [];
  const pendentes = new Set();
  let espera = null;

  async function carregar() {
    conversas = await dados.listar('conversas');
  }

  const deAlvo = (funcao, alvo) =>
    conversas
      .filter((c) => c.funcao === funcao && c.alvo?.tipo === alvo.tipo && c.alvo?.id === alvo.id && !c.encerrada)
      .sort((a, b) => (b.ultimaEm || '').localeCompare(a.ultimaEm || ''))[0] || null;

  async function nova({ funcao, alvo, titulo }) {
    const agora = new Date().toISOString();
    const c = await dados.salvar('conversas', { id: `conv-${crypto.randomUUID().slice(0, 12)}`, funcao, alvo, titulo, n: 0, criadaEm: agora, ultimaEm: agora });
    await arm.gravar(db, 'mensagens', { id: c.id, mensagens: [] });
    conversas.push(c);
    registrar('ia', 'conversa.nova', { det: funcao });
    return c;
  }

  /** Encerra a conversa atual (ela continua guardada) para começar outra do zero. */
  async function encerrar(id) {
    const c = conversas.find((x) => x.id === id);
    if (!c) return;
    Object.assign(c, await dados.salvar('conversas', { ...c, encerrada: true }));
  }

  /** Mensagens completas. Se este aparelho ainda não tem a conversa inteira, baixa do Drive. */
  async function mensagens(id) {
    const local = (await arm.um(db, 'mensagens', id))?.mensagens || [];
    const c = conversas.find((x) => x.id === id);
    if (c && c.n > local.length && drive()) {
      try {
        const t = await drive().ler(caminho(id));
        const doDrive = t ? JSON.parse(t).mensagens || [] : [];
        if (doDrive.length > local.length) {
          await arm.gravar(db, 'mensagens', { id, mensagens: doDrive });
          registrar('ia', 'conversa.baixada', { det: `${doDrive.length} mensagens` });
          return doDrive;
        }
      } catch (e) {
        registrar('erro', 'conversa.baixar_falhou', { det: e.message, st: 'aviso' });
      }
    }
    return local;
  }

  async function acrescentar(id, msg) {
    const lista = [...(await mensagens(id)), { em: new Date().toISOString(), ...msg }];
    await arm.gravar(db, 'mensagens', { id, mensagens: lista });
    const c = conversas.find((x) => x.id === id);
    if (c) Object.assign(c, await dados.salvar('conversas', { ...c, n: lista.length, ultimaEm: new Date().toISOString() }));
    agendarEnvio(id);
    return lista;
  }

  /** Atualiza campos do resumo da conversa (ex.: até onde a memória já leu). */
  async function marcar(id, campos) {
    const c = conversas.find((x) => x.id === id);
    if (c) Object.assign(c, await dados.salvar('conversas', { ...c, ...campos }));
  }

  async function avaliar(id, indice, valor) {
    const lista = await mensagens(id);
    if (!lista[indice]) return;
    lista[indice] = { ...lista[indice], avaliacao: valor };
    await arm.gravar(db, 'mensagens', { id, mensagens: lista });
    registrar('ia', 'ia.avaliacao', { det: valor });
    agendarEnvio(id);
  }

  function agendarEnvio(id) {
    pendentes.add(id);
    clearTimeout(espera);
    espera = setTimeout(enviarPendentes, ESPERA_ENVIO_MS);
  }

  /** Grava no Drive as conversas que mudaram. Sem Drive (sem internet ou sem login), fica para depois. */
  async function enviarPendentes() {
    const d = drive();
    if (!d) return;
    for (const id of [...pendentes]) {
      try {
        const lista = (await arm.um(db, 'mensagens', id))?.mensagens || [];
        const c = conversas.find((x) => x.id === id);
        await d.gravar(caminho(id), JSON.stringify({ app: 'researchbook', conversa: c || { id }, mensagens: lista }, null, 1), 'application/json');
        pendentes.delete(id);
      } catch (e) {
        registrar('erro', 'conversa.enviar_falhou', { det: e.message, st: 'aviso' });
      }
    }
  }

  return { carregar, deAlvo, nova, encerrar, marcar, mensagens, acrescentar, avaliar, enviarPendentes, todas: () => conversas };
}
