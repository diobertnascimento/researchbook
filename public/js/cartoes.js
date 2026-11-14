// Cartões de revisão espaçada: criados pela IA a partir dos grifos de uma obra ou de uma aula, conferidos pelo
// autor antes de guardar, e revistos em intervalos que crescem a cada acerto (variação simples do SM-2).
import { citacao } from './abnt.js';
import { normalizar } from './contexto.js';
import { diaLocal } from './progresso.js';

export const TIPOS_CARTAO = { conceito: 'Conceito', metodo: 'Método', evidencia: 'Evidência', critica: 'Crítica', dissert: 'Para a dissertação', aula: 'Aula' };
const DIA = 86400000;
const MIN = 60000;
const str = { type: 'string' };
const ESQ = {
  type: 'object',
  properties: { cartoes: { type: 'array', items: { type: 'object', properties: { tipo: { type: 'string', enum: ['conceito', 'metodo', 'evidencia', 'critica', 'dissert', 'aula'] }, pergunta: str, resposta: str, origem: str }, required: ['tipo', 'pergunta', 'resposta', 'origem'] } }, descartados: { type: 'integer' } },
  required: ['cartoes'],
};

/**
 * Próximo estado do cartão para cada nota (0 de novo, 1 difícil, 2 bom, 3 fácil).
 * intervalo em dias (0 = 10 minutos), facilidade entre 1,3 e 3.
 */
export function proximo(estado = {}, nota, agora = Date.now()) {
  const rep = estado.repeticoes || 0;
  let fac = estado.facilidade || 2.5;
  const int = estado.intervalo || 0;
  let novo;
  if (nota === 0) {
    fac = Math.max(1.3, fac - 0.2);
    return { repeticoes: 0, facilidade: fac, intervalo: 0, proxima: new Date(agora + 10 * MIN).toISOString(), ultima: new Date(agora).toISOString(), lapsos: (estado.lapsos || 0) + 1 };
  }
  if (rep === 0) novo = [null, 1, 1, 4][nota];
  else if (nota === 1) {
    novo = Math.max(int + 1, Math.round(int * 1.2));
    fac = Math.max(1.3, fac - 0.15);
  } else if (nota === 2) novo = Math.max(int + 1, Math.round(int * fac));
  else {
    novo = Math.max(int + 2, Math.round(int * fac * 1.3));
    fac = Math.min(3, fac + 0.15);
  }
  const dia = new Date(agora + novo * DIA);
  return { repeticoes: rep + 1, facilidade: Math.round(fac * 100) / 100, intervalo: novo, proxima: `${diaLocal(dia)}T00:00:00`, ultima: new Date(agora).toISOString(), lapsos: estado.lapsos || 0 };
}
export function rotuloIntervalo(est) {
  if (!est.intervalo) return 'em 10 min';
  if (est.intervalo === 1) return 'amanhã';
  if (est.intervalo < 31) return `em ${est.intervalo} dias`;
  const m = Math.round(est.intervalo / 30);
  return m === 1 ? 'em 1 mês' : `em ${m} meses`;
}
export const vence = (c, agora = Date.now()) => !c.suspenso && (!c.estado?.proxima || new Date(c.estado.proxima).getTime() <= agora);

export function criarCartoes({ dados, ia, bib, disc, historico, registrar }) {
  let cartoes = [];
  async function carregar() {
    cartoes = (await dados.listar('cartoes')).sort((a, b) => (a.criadoEm || '').localeCompare(b.criadoEm || ''));
  }
  const todos = () => cartoes;
  const paraHoje = (agora = Date.now()) => cartoes.filter((c) => vence(c, agora)).sort((a, b) => (a.estado?.proxima || '').localeCompare(b.estado?.proxima || '') || (a.criadoEm || '').localeCompare(b.criadoEm || ''));
  const obter = (id) => cartoes.find((c) => c.id === id) || null;

  /** Itens de origem: grifos de uma obra, ou resumo, conceitos e grifos de uma aula. */
  async function origens(fonte) {
    if (fonte.tipo === 'obra') {
      const l = bib.obter(fonte.id);
      return bib
        .grifosDe(fonte.id)
        .map((g, i) => ({ id: `O${i + 1}`, tipo: g.funcao, texto: g.texto, origem: { tipo: 'grifo', id: g.id, leituraId: l.id, pagina: g.pagina || null, citacao: citacao(l, g.pagina) } }));
    }
    const a = disc.aula(fonte.id);
    const d = disc.obter(a.disciplinaId);
    const rot = `${d?.nome || 'Aula'}, aula ${a.numero}`;
    const r = a.resumo || {};
    const itens = [
      ...(r.resumo || []).map((p) => ({ tipo: 'aula', texto: p.texto, tempo: p.tempo })),
      ...(r.conceitos || []).map((c) => ({ tipo: 'conceito', texto: `${c.nome}: ${c.definicao_em_aula}`, tempo: c.tempo })),
      ...(a.grifos || []).map((g) => ({ tipo: g.funcao, texto: g.texto, tempo: g.tempo })),
    ];
    return itens.map((x, i) => ({ id: `O${i + 1}`, tipo: x.tipo, texto: x.texto, origem: { tipo: 'aula', id: a.id, disciplinaId: a.disciplinaId, tempo: x.tempo || null, citacao: `${rot}${x.tempo ? `, ${x.tempo}` : ''}` } }));
  }

  /** Propostas da IA, conferidas: a origem precisa existir e a pergunta não pode repetir uma existente. */
  async function propor(fonte, quantidade = 5) {
    const itens = await origens(fonte);
    if (!itens.length) return { propostas: [], recusadas: 0, vazio: true };
    const existentes = cartoes.map((c) => c.pergunta);
    const r = await ia.gerarTarefa({
      tarefa: 'cartoes',
      blocos: [
        (c) => `<origem>\n<material-${c}>\n${itens.map((x) => `[${x.id}] (${TIPOS_CARTAO[x.tipo] || x.tipo}) ${x.texto}`).join('\n')}\n</material-${c}>\n</origem>`,
        `<cartoes_existentes>\n${existentes.slice(-80).map((p) => `- ${p}`).join('\n') || '(nenhum)'}\n</cartoes_existentes>`,
        `quantidade: ${quantidade}`,
      ],
      pedido: `Crie até ${quantidade} cartões de revisão a partir da origem.`,
      lembrete: 'Cada cartão aponta para um item da origem pelo id; resposta só com o que está na origem. Responda só com o objeto JSON.',
      esquema: ESQ,
    });
    const porId = new Map(itens.map((x) => [x.id, x]));
    const vistos = new Set(existentes.map(normalizar));
    const propostas = [];
    let recusadas = 0;
    for (const c of r.json?.cartoes || []) {
      const o = porId.get(c.origem);
      if (!o || !c.pergunta?.trim() || !c.resposta?.trim() || vistos.has(normalizar(c.pergunta))) {
        recusadas++;
        continue;
      }
      vistos.add(normalizar(c.pergunta));
      propostas.push({ tipo: TIPOS_CARTAO[c.tipo] ? c.tipo : o.tipo, pergunta: c.pergunta.trim(), resposta: c.resposta.trim(), origem: o.origem });
    }
    try {
      const h = await historico.nova({ funcao: 'cartoes', alvo: { tipo: fonte.tipo, id: fonte.id }, titulo: 'Cartões de revisão' });
      await historico.acrescentar(h.id, { de: 'ia', tarefa: 'cartoes', resposta: r.json, aceitas: propostas.length, recusadas, modelo: r.modelo, uso: r.uso, custo: r.custo, instrucao: r.instrucao });
    } catch (e) {
      registrar('erro', 'cartoes.historico', { det: e.message, st: 'aviso' });
    }
    registrar('ia', 'cartoes.propostos', { det: `${propostas.length} propostos${recusadas ? `, ${recusadas} recusados` : ''}` });
    return { propostas, recusadas };
  }

  async function guardar(lista) {
    const t0 = Date.now();
    let i = 0;
    for (const c of lista) await dados.salvar('cartoes', { id: `cart-${crypto.randomUUID().slice(0, 8)}`, ...c, estado: { repeticoes: 0, facilidade: 2.5, intervalo: 0, proxima: null }, criadoEm: new Date(t0 + i++).toISOString() });
    registrar('ui', 'cartoes.guardar', { det: `${lista.length}` });
    await carregar();
  }
  async function salvar(c) {
    await dados.salvar('cartoes', c);
    await carregar();
  }
  async function avaliar(id, nota) {
    const c = obter(id);
    const est = proximo(c.estado, nota);
    await dados.salvar('cartoes', { ...c, estado: est, revisoes: (c.revisoes || 0) + 1 });
    registrar('ui', 'cartao.revisar', { det: ['de novo', 'difícil', 'bom', 'fácil'][nota] });
    await carregar();
    return est;
  }
  async function apagar(id) {
    const c = obter(id);
    await dados.apagar('cartoes', id);
    registrar('ui', 'cartao.apagar');
    await carregar();
    return async () => {
      await dados.salvar('cartoes', { ...c, apagado: false });
      await carregar();
    };
  }
  function contagem(agora = Date.now()) {
    const hoje = paraHoje(agora);
    return { novos: hoje.filter((c) => !c.estado?.repeticoes).length, revisao: hoje.filter((c) => c.estado?.repeticoes).length, aprendidos: cartoes.filter((c) => (c.estado?.intervalo || 0) >= 21).length, total: cartoes.length };
  }

  return { carregar, todos, paraHoje, obter, origens, propor, guardar, salvar, avaliar, apagar, contagem };
}
