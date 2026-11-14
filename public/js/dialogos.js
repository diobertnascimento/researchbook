// Diálogos: discussão de ideias com a IA em três modos (Contraponto, Socrático, Alinhamento), a partir do acervo.
// Cada diálogo é um item da coleção "dialogos"; as mensagens ficam no histórico (função "dialogo"), como as do tutor.
// Ao encerrar, a IA lista as posições que o autor firmou, com as palavras dele; o app confere que o texto está na
// mensagem indicada, e o autor decide se cada posição vai para a memória ou atualiza um argumento.
import { relevantes, acervoDe, normalizar } from './contexto.js';
import { citacao, autorCurto } from './abnt.js';
import { FUNCOES } from './leitor-pdf.js';

export const MODOS = {
  Contraponto: 'A IA defende a posição contrária à sua',
  Socrático: 'A IA só pergunta, até você chegar à sua posição',
  Alinhamento: 'A IA compara a sua visão com o que você já sustenta e com os autores lidos',
};
const str = { type: 'string' };
const ESQ_TURNO = {
  type: 'object',
  properties: { resposta: str, pergunta: str, fontes: { type: 'array', items: { type: 'object', properties: { id: str, trecho_literal: str }, required: ['id', 'trecho_literal'] } } },
  required: ['resposta', 'pergunta', 'fontes'],
};
const ESQ_ENCERRAR = {
  type: 'object',
  properties: { posicoes: { type: 'array', items: { type: 'object', properties: { texto: str, mensagem: { type: 'integer' }, argumento_relacionado: str }, required: ['texto', 'mensagem'] } }, questoes_em_aberto: { type: 'array', items: str } },
  required: ['posicoes', 'questoes_em_aberto'],
};
const novoId = (p) => `${p}-${crypto.randomUUID().slice(0, 8)}`;

export function criarDialogos({ dados, ia, bib, fichUI, argUI, historico, registrar }) {
  let dialogos = [];

  async function carregar() {
    dialogos = (await dados.listar('dialogos')).sort((a, b) => (b.ultimaEm || b.criadoEm || '').localeCompare(a.ultimaEm || a.criadoEm || ''));
  }
  const todos = () => dialogos;
  const obter = (id) => dialogos.find((d) => d.id === id) || null;

  async function novo({ tema, modo, leituras = [] }) {
    const id = novoId('dlg');
    const c = await historico.nova({ funcao: 'dialogo', alvo: { tipo: 'dialogo', id }, titulo: tema.slice(0, 80) });
    const d = await dados.salvar('dialogos', { id, tema, modo, leituras, conversaId: c.id, posicoes: [], questoes: [], criadoEm: new Date().toISOString(), ultimaEm: new Date().toISOString() });
    registrar('ui', 'dialogo.novo', { det: `${modo}, ${leituras.length} leituras` });
    await carregar();
    return d;
  }
  async function salvar(d) {
    const s = await dados.salvar('dialogos', d);
    await carregar();
    return s;
  }
  async function apagar(id) {
    const d = obter(id);
    await dados.apagar('dialogos', id);
    registrar('ui', 'dialogo.apagar');
    await carregar();
    return async () => {
      await dados.salvar('dialogos', { ...d, apagado: false });
      await carregar();
    };
  }
  const mensagens = (d) => historico.mensagens(d.conversaId);

  /** Grifos das obras do diálogo primeiro; depois os mais ligados ao tema e à última mensagem, de qualquer obra. */
  function acervo(d, mensagem) {
    const grifos = bib
      .todosGrifos()
      .map((g) => ({ g, l: bib.obter(g.leituraId) }))
      .filter((x) => x.l)
      .map(({ g, l }) => ({ tipo: `grifo (${(FUNCOES.find((f) => f.id === g.funcao)?.nome || 'grifo').toLowerCase()})`, ref: `grifo:${g.id}`, leituraId: l.id, pagina: g.pagina, citacao: citacao(l, g.pagina), obra: autorCurto(l), texto: g.texto, peso: g.funcao === 'dissert' || g.funcao === 'critica' ? 1 : 0 }));
    const das = grifos.filter((g) => d.leituras.includes(g.leituraId));
    const outros = relevantes(`${d.tema} ${mensagem}`, grifos.filter((g) => !d.leituras.includes(g.leituraId)), 12);
    return acervoDe([...relevantes(`${d.tema} ${mensagem}`, das, 18), ...outros]);
  }
  function blocoArgumentos() {
    const args = argUI.todos();
    return `<argumentos>\n${args.map((a) => `[${a.id}] ${a.tese}`).join('\n') || '(nenhum ainda)'}\n</argumentos>`;
  }
  function blocoPosicoes(atual) {
    const ps = dialogos.filter((x) => x.id !== atual).flatMap((x) => (x.posicoes || []).filter((p) => p.estado === 'guardada').map((p) => p.texto));
    return `<posicoes>\n${ps.map((p) => `- ${p}`).join('\n') || '(nenhuma ainda)'}\n</posicoes>`;
  }

  async function responder(id, texto) {
    let d = obter(id);
    const hist = await mensagens(d);
    const anteriores = [];
    for (let i = 0; i < hist.length - 1; i++) if (hist[i].de === 'autor' && hist[i + 1]?.de === 'ia') anteriores.push({ autor: hist[i].texto, ia: [hist[i + 1].resposta?.resposta, hist[i + 1].resposta?.pergunta].filter(Boolean).join('\n') });
    const ac = acervo(d, texto);
    const r = await ia.gerarTarefa({
      tarefa: 'dialogo',
      acervo: ac,
      blocos: [`<dialogo>\nModo: ${d.modo}. ${MODOS[d.modo]}.\nTema: ${d.tema}\n</dialogo>`, blocoArgumentos(), blocoPosicoes(id)],
      pedido: texto,
      lembrete: `Modo ${d.modo}. ${d.modo === 'Socrático' ? 'Só uma pergunta, resposta em branco.' : 'Até 100 palavras e termine com uma pergunta ou objeção.'} Só cite o acervo, com trecho literal. Responda só com o objeto JSON.`,
      esquema: ESQ_TURNO,
      anteriores: anteriores.slice(-6),
      conferirCom: (j) => ({ resposta: j?.resposta, pergunta: j?.pergunta, fontes: j?.fontes }),
    });
    const json = d.modo === 'Socrático' ? { ...r.json, resposta: '' } : r.json;
    await historico.acrescentar(d.conversaId, { de: 'autor', texto, modo: d.modo });
    await historico.acrescentar(d.conversaId, { de: 'ia', tarefa: 'dialogo', modo: d.modo, resposta: json, conferencia: r.conferencia, itens: r.itens, modelo: r.modelo, uso: r.uso, custo: r.custo, instrucao: r.instrucao });
    d = obter(id);
    await salvar({ ...d, ultimaEm: new Date().toISOString(), n: (d.n || 0) + 1 });
    registrar('ia', 'dialogo.turno', { det: `${d.modo}${r.conferencia.ok ? '' : ', conferência com problemas'}` });
    return r;
  }

  /** Lista as posições firmadas, conferidas contra as mensagens do autor. */
  async function encerrar(id) {
    const d = obter(id);
    const hist = await mensagens(d);
    const falas = hist.filter((m) => m.de === 'autor');
    if (!falas.length) return { aceitas: [], recusadas: 0 };
    const numeradas = falas.map((m, i) => `[${i + 1}] autor: ${m.texto}`);
    const r = await ia.gerarTarefa({
      tarefa: 'dialogo_encerrar',
      blocos: [`<dialogo>\nModo: ${d.modo}.\nTema: ${d.tema}\n</dialogo>`, blocoArgumentos(), (c) => `<conversa>\n<material-${c}>\n${numeradas.join('\n')}\n</material-${c}>\n</conversa>`],
      pedido: 'Tarefa: encerrar. Liste as posições que o autor firmou, com as palavras dele, e o que ficou em aberto.',
      lembrete: 'Texto copiado da mensagem do autor indicada, sem melhorar. Responda só com o objeto JSON.',
      esquema: ESQ_ENCERRAR,
    });
    const args = new Set(argUI.todos().map((a) => a.id));
    const aceitas = [];
    let recusadas = 0;
    for (const p of r.json?.posicoes || []) {
      const fala = falas[(p.mensagem || 0) - 1];
      if (!fala || !normalizar(fala.texto).includes(normalizar(p.texto))) {
        recusadas++;
        continue;
      }
      aceitas.push({ id: novoId('pos'), texto: p.texto, mensagem: p.mensagem, argumentoId: args.has(p.argumento_relacionado) ? p.argumento_relacionado : null, estado: 'proposta' });
    }
    const atual = obter(id);
    await salvar({ ...atual, posicoes: [...(atual.posicoes || []).filter((p) => p.estado !== 'proposta'), ...aceitas], questoes: r.json?.questoes_em_aberto || [], encerradoEm: new Date().toISOString() });
    await historico.acrescentar(d.conversaId, { de: 'ia', tarefa: 'dialogo_encerrar', resposta: r.json, aceitas: aceitas.length, recusadas, modelo: r.modelo, uso: r.uso, custo: r.custo, instrucao: r.instrucao });
    registrar('ia', 'dialogo.encerrar', { det: `${aceitas.length} posições${recusadas ? `, ${recusadas} recusadas na conferência` : ''}` });
    return { aceitas, recusadas };
  }

  async function mudarPosicao(id, posId, mudancas) {
    const d = obter(id);
    await salvar({ ...d, posicoes: d.posicoes.map((p) => (p.id === posId ? { ...p, ...mudancas } : p)) });
  }

  /** Guarda a posição na memória como item aprovado (o autor já aprovou ao tocar no botão). */
  async function guardarNaMemoria(id, posId) {
    const d = obter(id);
    const p = d.posicoes.find((x) => x.id === posId);
    const agora = new Date().toISOString();
    await dados.salvar('memoria', { id: `mem-${crypto.randomUUID().slice(0, 10)}`, tipo: 'posicao', texto: p.texto, evidencia: p.texto, status: 'aprovada', origem: { conversaId: d.conversaId, mensagem: p.mensagem, funcao: 'dialogo', titulo: d.tema.slice(0, 80) }, criadoEm: agora, aprovadoEm: agora });
    await mudarPosicao(id, posId, { estado: 'guardada', memoria: true });
    await window.rb?.memoriaUI?.carregar();
    registrar('ui', 'dialogo.posicao_memoria');
  }

  /** Troca a tese do argumento pela posição; a tese antiga fica guardada no argumento. Devolve o desfazer. */
  async function atualizarArgumento(id, posId) {
    const d = obter(id);
    const p = d.posicoes.find((x) => x.id === posId);
    const a = argUI.todos().find((x) => x.id === p.argumentoId);
    if (!a) return null;
    const antiga = a.tese;
    await dados.salvar('argumentos', { ...a, tese: p.texto, tesesAnteriores: [...(a.tesesAnteriores || []), { tese: antiga, ate: new Date().toISOString(), origem: 'diálogo' }] });
    // Os trechos dos fichamentos ligados ao argumento passam a mostrar a tese nova.
    for (const f of fichUI.todos()) {
      if (!(f.trechos || []).some((t) => t.argumentoId === a.id)) continue;
      await dados.salvar('fichamentos', { ...f, trechos: f.trechos.map((t) => (t.argumentoId === a.id ? { ...t, argumento: p.texto } : t)) });
    }
    await Promise.all([argUI.carregar(), fichUI.carregar()]);
    await mudarPosicao(id, posId, { estado: 'guardada', argumento: true });
    registrar('ui', 'dialogo.posicao_argumento');
    return async () => {
      await dados.salvar('argumentos', { ...a });
      for (const f of fichUI.todos()) {
        if (!(f.trechos || []).some((t) => t.argumentoId === a.id)) continue;
        await dados.salvar('fichamentos', { ...f, trechos: f.trechos.map((t) => (t.argumentoId === a.id ? { ...t, argumento: antiga } : t)) });
      }
      await Promise.all([argUI.carregar(), fichUI.carregar()]);
      await mudarPosicao(id, posId, { estado: 'proposta', argumento: false });
    };
  }

  return { carregar, todos, obter, novo, salvar, apagar, mensagens, responder, encerrar, mudarPosicao, guardarNaMemoria, atualizarArgumento };
}
