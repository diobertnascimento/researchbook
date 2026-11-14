// Copilot de escrita: monta o contexto de cada tarefa (briefing, estrutura, texto, acervo relevante) e
// chama o núcleo da IA. As respostas são conferidas contra o acervo e guardadas no histórico.
import { acervoDe, relevantes } from './contexto.js';
import { citacao, autorCurto } from './abnt.js';
import { FUNCOES } from './leitor-pdf.js';
import { blocos, medirAutoria } from './escrita.js';

const nomeFuncao = (id) => FUNCOES.find((f) => f.id === id)?.nome.toLowerCase() || id;
const fontesEsq = { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, trecho_literal: { type: 'string' } }, required: ['id', 'trecho_literal'] } };

export const ESQUEMAS = {
  entrevista: { type: 'object', properties: { pergunta: { type: 'string' }, por_que: { type: 'string' }, recusa: { type: 'string' } }, required: ['pergunta', 'por_que'] },
  conversa: { type: 'object', properties: { comentario: { type: 'string' }, pergunta: { type: 'string' }, fontes: fontesEsq, recusa: { type: 'string' } }, required: ['comentario', 'pergunta', 'fontes'] },
  diagnostico: {
    type: 'object',
    properties: {
      pontos: { type: 'array', items: { type: 'object', properties: { afirmacao: { type: 'string' }, classe: { type: 'string', enum: ['sustentado', 'fragil', 'lacuna'] }, fontes: fontesEsq, comentario: { type: 'string' } }, required: ['afirmacao', 'classe', 'fontes', 'comentario'] } },
      sugestoes_de_busca: { type: 'array', items: { type: 'object', properties: { descricao: { type: 'string' }, obra_sugerida: { type: 'string' } }, required: ['descricao', 'obra_sugerida'] } },
    },
    required: ['pontos', 'sugestoes_de_busca'],
  },
  estrutura: {
    type: 'object',
    properties: {
      secoes: { type: 'array', items: { type: 'object', properties: { titulo: { type: 'string' }, objetivo: { type: 'string' }, fontes: { type: 'array', items: { type: 'string' } }, palavras: { type: 'integer' }, depende_de_lacuna: { type: 'boolean' } }, required: ['titulo', 'objetivo', 'fontes', 'palavras', 'depende_de_lacuna'] } },
      observacao: { type: 'string' },
    },
    required: ['secoes', 'observacao'],
  },
  versoes: {
    type: 'object',
    properties: {
      versoes: { type: 'array', items: { type: 'object', properties: { tipo: { type: 'string', enum: ['proxima', 'academica'] }, texto: { type: 'string' }, mudancas: { type: 'array', items: { type: 'string' } } }, required: ['tipo', 'texto', 'mudancas'] } },
      fontes: fontesEsq,
      alertas: { type: 'array', items: { type: 'object', properties: { trecho: { type: 'string' }, problema: { type: 'string', enum: ['sem_fonte', 'citacao_sem_pagina', 'contradiz_acervo', 'fora_do_briefing', 'teto_da_ia'] }, explicacao: { type: 'string' }, como_resolver: { type: 'string' } }, required: ['trecho', 'problema', 'explicacao', 'como_resolver'] } },
      recusa: { type: 'string' },
    },
    required: ['versoes', 'fontes', 'alertas'],
  },
  transicao: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] },
  soa_como_eu: { type: 'object', properties: { veredito: { type: 'string', enum: ['soa como voce', 'soa em parte', 'nao soa'] }, diferencas: { type: 'array', items: { type: 'object', properties: { trecho: { type: 'string' }, diferenca: { type: 'string' }, sugestao: { type: 'string' } }, required: ['trecho', 'diferenca', 'sugestao'] } } }, required: ['veredito', 'diferencas'] },
  revisao: {
    type: 'object',
    properties: {
      verificacoes: { type: 'array', items: { type: 'object', properties: { item: { type: 'string', enum: ['afirmacoes_sem_fonte', 'fidelidade', 'coerencia', 'estrutura', 'clareza'] }, situacao: { type: 'string', enum: ['ok', 'atencao', 'bloqueia'] }, resumo: { type: 'string' } }, required: ['item', 'situacao', 'resumo'] } },
      problemas: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, gravidade: { type: 'string', enum: ['alta', 'media', 'baixa'] }, secao: { type: 'string' }, trecho: { type: 'string' }, problema: { type: 'string' }, como_resolver: { type: 'string' } }, required: ['item', 'gravidade', 'secao', 'trecho', 'problema', 'como_resolver'] } },
    },
    required: ['verificacoes', 'problemas'],
  },
};

const TAREFA_IA = { entrevista: 'copilot_conversa', conversa: 'copilot_conversa', transicao: 'copilot_conversa', soa_como_eu: 'copilot_conversa', versoes: 'copilot_versoes', diagnostico: 'copilot_plano', estrutura: 'copilot_plano', revisao: 'revisao_final' };
const LEMBRETE = 'Responda só com o objeto JSON do esquema da tarefa. Não escreva do zero: trabalhe só com o que o autor escreveu ou disse. Afirmações sobre obras só com itens do acervo, usando a citação do item e o id entre colchetes; cada id usado entra em "fontes" com trecho copiado palavra por palavra.';

export function criarCopiloto({ ia, bib, fichUI, historico, registrar }) {
  /** Acervo relevante para uma consulta: grifos de todas as obras, ranqueados por palavras em comum. */
  function acervoPara(consulta, n = 40) {
    const candidatos = bib
      .todosGrifos()
      .map((g) => ({ g, l: bib.obter(g.leituraId) }))
      .filter((x) => x.l)
      .map(({ g, l }) => ({ tipo: `grifo (${nomeFuncao(g.funcao)})`, ref: `grifo:${g.id}`, leituraId: l.id, pagina: g.pagina, citacao: citacao(l, g.pagina), obra: autorCurto(l), texto: g.texto, peso: g.funcao === 'dissert' ? 1 : 0 }));
    return acervoDe(relevantes(consulta, candidatos, n));
  }

  const briefing = (t) => (cod) => {
    const a = medirAutoria(t);
    return `<briefing>\n<material-${cod}>\nTítulo: ${t.titulo}\nTipo: ${t.tipo}${t.projeto ? `\nDisciplina ou projeto: ${t.projeto}` : ''}${t.limite ? `\nLimite: ${t.limite} palavras` : ''}${t.entrega ? `\nEntrega: ${t.entrega}` : ''}\nEnunciado: ${t.enunciado || '(não informado)'}\nCritérios: ${t.criterios || '(não informados)'}\nTese de trabalho (palavras do autor): ${t.tese || '(ainda não definida)'}\nTeto da IA: ${t.teto}%. Participação atual: ${a.participacao}%.\n</material-${cod}>\n</briefing>`;
  };
  const estrutura = (t) => (cod) => (t.estrutura?.length || t.secoes?.length ? `<estrutura>\n<material-${cod}>\n${(t.secoes?.length ? t.secoes : t.estrutura).map((s, i) => `${i + 1}. ${s.titulo}${s.objetivo ? ` — ${s.objetivo}` : ''}`).join('\n')}\n</material-${cod}>\n</estrutura>` : '');
  const entrevista = (t) => (cod) => (t.entrevista?.length ? `<entrevista>\n<material-${cod}>\n${t.entrevista.map((q) => `P: ${q.pergunta}\nR: ${q.resposta || '(sem resposta)'}`).join('\n')}\n</material-${cod}>\n</entrevista>` : '');
  const trechoAutor = (texto) => (cod) => `<texto_do_autor>\n<material-${cod}>\n${texto}\n</material-${cod}>\n</texto_do_autor>`;
  const textoCompleto = (t) => (cod) => `<texto>\n<material-${cod}>\n${(t.secoes || []).map((s, i) => `## ${i + 1}. ${s.titulo}\n${blocos(s.html).map((b) => b.texto).join('\n\n')}`).join('\n\n')}\n</material-${cod}>\n</texto>`;

  /** Executa uma tarefa e guarda no histórico (uma conversa por texto, função "copilot"). */
  async function executar(t, tipo, { pedido, blocosExtras = [], acervo = null, conferir = null, anteriores = [], sinal } = {}) {
    const r = await ia.gerarTarefa({
      tarefa: TAREFA_IA[tipo],
      acervo,
      blocos: [briefing(t), estrutura(t), ...blocosExtras],
      pedido: `Tarefa: ${tipo}.\n${pedido || ''}`.trim(),
      lembrete: LEMBRETE,
      esquema: ESQUEMAS[tipo],
      conferirCom: conferir,
      anteriores,
      sinal,
    });
    let c = historico.deAlvo('copilot', { tipo: 'texto', id: t.id });
    if (!c) c = await historico.nova({ funcao: 'copilot', alvo: { tipo: 'texto', id: t.id }, titulo: t.titulo });
    await historico.acrescentar(c.id, { de: 'autor', pedido: { tipo, texto: pedido || '', mostrado: pedido || tipo } });
    await historico.acrescentar(c.id, { de: 'ia', tarefa: tipo, resposta: r.json, conferencia: r.conferencia, itens: r.itens, modelo: r.modelo, uso: r.uso, custo: r.custo, instrucao: r.instrucao });
    registrar('ia', 'copilot.tarefa', { det: `${tipo}${r.conferencia.ok ? '' : ', conferência com problemas'}` });
    return r;
  }

  return {
    acervoPara,
    entrevista: (t) => executar(t, 'entrevista', { pedido: t.entrevista?.length ? 'Faça a próxima pergunta da entrevista.' : 'Faça a primeira pergunta da entrevista, depois da tese.', blocosExtras: [entrevista(t)] }),
    diagnostico: (t) => {
      const acervo = acervoPara(`${t.tese} ${t.entrevista.map((q) => q.resposta).join(' ')}`, 50);
      return executar(t, 'diagnostico', { blocosExtras: [entrevista(t)], acervo, conferir: (j) => ({ resposta: (j?.pontos || []).map((p) => p.comentario).join(' '), fontes: (j?.pontos || []).flatMap((p) => p.fontes || []) }) });
    },
    estrutura: (t, outra = false) => {
      const acervo = acervoPara(`${t.tese} ${t.entrevista.map((q) => q.resposta).join(' ')}`, 40);
      return executar(t, 'estrutura', { pedido: outra ? 'Proponha uma estrutura diferente da anterior, com a mesma tese.' : '', blocosExtras: [entrevista(t), (cod) => (t.diagnostico ? `<diagnostico>\n<material-${cod}>\n${(t.diagnostico.resultado?.pontos || t.diagnostico.pontos || []).map((p) => `${p.classe}: ${p.afirmacao}`).join('\n')}\n</material-${cod}>\n</diagnostico>` : '')], acervo });
    },
    conversa: (t, secao, mensagem, anteriores) => {
      const textoSecao = blocos(secao.html).map((b) => b.texto).join('\n\n');
      const acervo = acervoPara(`${secao.titulo} ${secao.objetivo || ''} ${mensagem} ${textoSecao}`, 30);
      return executar(t, 'conversa', { pedido: `Seção em foco: ${secao.titulo}${secao.objetivo ? ` (objetivo: ${secao.objetivo})` : ''}.\nO autor disse: ${mensagem}`, blocosExtras: [trechoAutor(textoSecao || '(seção ainda vazia)')], acervo, anteriores, conferir: (j) => ({ resposta: `${j?.comentario || ''}`, pergunta: j?.pergunta, fontes: j?.fontes || [] }) });
    },
    versoes: (t, paragrafo) => {
      const acervo = acervoPara(paragrafo, 30);
      return executar(t, 'versoes', { pedido: 'Proponha as duas versões do parágrafo do autor.', blocosExtras: [trechoAutor(paragrafo)], acervo, conferir: (j) => ({ resposta: (j?.versoes || []).map((v) => v.texto).join(' '), fontes: j?.fontes || [] }) });
    },
    transicao: (t, de, para) => executar(t, 'transicao', { pedido: `Frase de transição do fim da seção "${de.titulo}" para a seção "${para.titulo}".` }),
    soaComoEu: (t, trecho) => executar(t, 'soa_como_eu', { pedido: 'Compare o trecho com o jeito de escrever do autor.', blocosExtras: [trechoAutor(trecho), (cod) => `<paragrafos_do_autor>\n<material-${cod}>\n${(t.secoes || []).flatMap((s) => blocos(s.html).filter((b) => b.autoria === 'autor').map((b) => b.texto)).slice(0, 12).join('\n\n')}\n</material-${cod}>\n</paragrafos_do_autor>`] }),
    revisao: (t, refs) => {
      const acervo = acervoPara((t.secoes || []).map((s) => blocos(s.html).map((b) => b.texto).join(' ')).join(' '), 60);
      return executar(t, 'revisao', { blocosExtras: [textoCompleto(t), (cod) => `<referencias>\n<material-${cod}>\n${refs.map((r) => r.texto).join('\n') || '(nenhuma)'}\n</material-${cod}>\n</referencias>`], acervo });
    },
  };
}
