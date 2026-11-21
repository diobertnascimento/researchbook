// Dissertação: revisão do projeto (cada versão em PDF lida pela IA) e orientação (encontros, combinados, temas).
//
// - Revisões: coleção "revisoes"; o PDF de cada versão vai para o Drive (dissertacao/versoes/vN.pdf).
// - Encontros: coleção "encontros". Gravações usam o motor de áudio e transcrição das aulas (disciplinas.js);
//   quando a transcrição termina, este módulo pede o registro à IA.
// Toda saída da IA vai para o histórico e é conferida: trechos literais no registro, obras pela biblioteca.
import { normalizar } from './contexto.js';
import { obraPorReferencia } from './disciplinas.js';
import { diaLocal } from './progresso.js';

export const DISSERTACAO = 'dissertacao'; // disciplinaId dos eventos da dissertação (encontros de orientação)
export const FORMATOS = { anotacao: 'Sua anotação', audio: 'Áudio', transcricao: 'Transcrição', email: 'E-mail', pdf: 'PDF comentado' };
export const FUNCOES_OBRA = { decisao: 'Sustenta uma decisão', argumento: 'Sustenta um argumento', precedente: 'Trabalho relacionado', contexto: 'Contexto' };
const LIMITE_EM_LINHA = 14 * 1024 * 1024;

const str = { type: 'string' };
const ESQ_REVISAO = {
  type: 'object',
  properties: {
    paginas: { type: 'integer' },
    obras: { type: 'array', items: { type: 'object', properties: { como_aparece: str, id_biblioteca: str, secoes: { type: 'array', items: str }, vezes: { type: 'integer' }, funcao: { type: 'string', enum: ['decisao', 'argumento', 'precedente', 'contexto'] }, prioridade: { type: 'integer' }, porque: str, incompleta: { type: 'boolean' } }, required: ['como_aparece', 'funcao', 'prioridade', 'porque'] } },
    problemas: { type: 'array', items: { type: 'object', properties: { tipo: { type: 'string', enum: ['citacao_sem_pagina', 'ausente_na_lista', 'nao_citada', 'ano_divergente', 'fora_da_norma'] }, trecho: str, pagina: { type: 'integer' }, secao: str }, required: ['tipo', 'trecho'] } },
    comparacao: { type: 'object', properties: { novas: { type: 'array', items: str }, removidas: { type: 'array', items: str }, problemas_resolvidos: { type: 'integer' } } },
  },
  required: ['obras', 'problemas'],
};
const ESQ_ORIENTACAO = {
  type: 'object',
  properties: {
    resumo: str,
    combinados: { type: 'array', items: { type: 'object', properties: { acao: str, responsavel: { type: 'string', enum: ['autor', 'orientacao', 'ambos'] }, secao: str, prazo: str }, required: ['acao', 'responsavel'] } },
    trechos: { type: 'array', items: { type: 'object', properties: { tempo: str, fala: str }, required: ['fala'] } },
    sugestoes: { type: 'array', items: str },
    temas: { type: 'array', items: str },
    combinados_anteriores: { type: 'array', items: { type: 'object', properties: { id: str, situacao: { type: 'string', enum: ['resolvido', 'mantido', 'alterado'] }, detalhe: str }, required: ['id', 'situacao'] } },
    pontos_de_atencao: { type: 'array', items: str },
    aviso: str,
  },
  required: ['resumo', 'combinados', 'trechos', 'sugestoes', 'temas', 'combinados_anteriores', 'pontos_de_atencao', 'aviso'],
};
export const TIPOS_PROBLEMA = { citacao_sem_pagina: 'Citação direta sem página', ausente_na_lista: 'Citada no texto e fora da lista de referências', nao_citada: 'Na lista e nunca citada', ano_divergente: 'Ano diferente entre texto e lista', fora_da_norma: 'Fora da NBR 10520:2023' };

const novoId = (p) => `${p}-${crypto.randomUUID().slice(0, 8)}`;

// Parecer do projeto (v2.7.0). As partes e a referência de cada uma são do app, não da IA: a IA só escolhe a parte.
// Capítulos conforme a 6ª edição de Research Design (Creswell e Creswell, 2023).
const RD = 'Creswell e Creswell, Research Design, 6. ed.';
export const PARTES_PARECER = [
  ['introducao', 'Introdução e problema', `${RD}, cap. 5`],
  ['proposito', 'Propósito', `${RD}, cap. 6`],
  ['perguntas', 'Perguntas e hipóteses', `${RD}, cap. 7`],
  ['literatura', 'Literatura e teoria', `${RD}, caps. 2 e 3`],
  ['metodo', 'Método', `${RD}, caps. 8 a 10`],
  ['etica', 'Ética e escrita', `${RD}, cap. 4`],
  ['coerencia', 'Coerência entre as partes', 'usual em banca de qualificação'],
  ['viabilidade', 'Cronograma e viabilidade', 'usual em banca de qualificação'],
  ['forma', 'Forma e normas', 'usual em banca de qualificação; ABNT NBR 10520:2023 e 6023:2018'],
];
export const GRAVIDADES = [
  ['compromete', 'Compromete a aprovação'],
  ['importante', 'Importante'],
  ['ajuste', 'Ajuste'],
];
const ESQ_PARECER = {
  type: 'object',
  properties: {
    achados: {
      type: 'array',
      items: {
        type: 'object',
        properties: { parte: { type: 'string', enum: PARTES_PARECER.map(([k]) => k) }, gravidade: { type: 'string', enum: GRAVIDADES.map(([k]) => k) }, titulo: { type: 'string' }, trecho: { type: 'string' }, pagina: { type: 'integer' }, esperado: { type: 'string' }, como_resolver: { type: 'string' } },
        required: ['parte', 'gravidade', 'titulo', 'esperado', 'como_resolver'],
      },
    },
    resolvidos: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, como: { type: 'string' } }, required: ['id'] } },
  },
  required: ['achados'],
};
/** Texto para comparação: sem acento, sem pontuação, espaços simples. Hífen de quebra de linha some. */
export const achatar = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/-\s+/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
/** Onde o trecho citado pela IA está no PDF: 'pagina' (na página indicada ou vizinha), 'outra', 'nao', ou null sem texto para conferir. */
export function conferirTrecho(paginas, trecho, pagina) {
  const alvo = achatar(trecho);
  if (!paginas || !alvo) return null;
  // Compara pelos primeiros 80 caracteres: a IA pode cortar o fim do trecho com reticências.
  const chave = alvo.slice(0, 80);
  const tem = (n) => paginas[n - 1] != null && achatar(paginas[n - 1]).includes(chave);
  if ([pagina, pagina - 1, pagina + 1].some((n) => n >= 1 && tem(n))) return 'pagina';
  return paginas.some((_, i) => tem(i + 1)) ? 'outra' : 'nao';
}
const base64 = (blob) =>
  new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = () => erro(r.error);
    r.readAsDataURL(blob);
  });

export function criarDissertacao({ dados, ia, bib, fichUI, historico, disc, drive, registrar, aoMudar = () => {} }) {
  let revisoes = [];

  async function carregar() {
    revisoes = (await dados.listar('revisoes')).sort((a, b) => (b.versao || 0) - (a.versao || 0));
  }

  /* ---------- Revisão do projeto ---------- */
  const todasRevisoes = () => revisoes;
  const revisao = (id) => revisoes.find((r) => r.id === id) || null;

  function fichasDaBiblioteca() {
    const fichados = new Set(fichUI.todos().filter((f) => (f.feitos || 0) >= 5).map((f) => f.leituraId || f.id));
    return bib.leituras().slice(0, 400).map((l, i) => ({ id: `B${i + 1}`, l, fichada: fichados.has(l.id) }));
  }

  async function partePDF(arquivo) {
    if (arquivo.size <= LIMITE_EM_LINHA) return { inlineData: { mimeType: 'application/pdf', data: await base64(arquivo) } };
    const a = await ia.enviarArquivo(arquivo, { nome: arquivo.name, tipo: 'application/pdf' });
    return { fileData: { mimeType: 'application/pdf', fileUri: a.uri } };
  }

  async function revisar(arquivo) {
    const inicio = performance.now();
    const anterior = revisoes[0] || null;
    const obras = fichasDaBiblioteca();
    const abertos = combinadosAbertos();
    const r = await ia.gerarTarefa({
      tarefa: 'revisao_projeto',
      partes: [await partePDF(arquivo)],
      blocos: [
        `<biblioteca>\n${obras.map(({ id, l, fichada }) => `${id}: ${(l.autores || []).map((x) => x.sobrenome).join('; ')} (${l.ano || 's.d.'}). ${l.titulo}. Etapa: ${['não iniciada', 'em leitura', 'leitura concluída', 'em fichamento', 'fichada'][l.etapa || 0]}${fichada ? ', com fichamento' : ''}`).join('\n') || '(vazia)'}\n</biblioteca>`,
        anterior ? `<versao_anterior>\nVersão ${anterior.versao}. Obras: ${anterior.resultado.obras.map((o) => o.como_aparece).join('; ')}\nProblemas: ${anterior.resultado.problemas.map((p) => `${p.tipo}: ${p.trecho}`).join(' | ') || 'nenhum'}\n</versao_anterior>` : '<versao_anterior>\n(primeira versão enviada)\n</versao_anterior>',
        `<combinados>\n${abertos.map((c) => `- ${c.acao}${c.secao ? ` (${c.secao})` : ''}`).join('\n') || '(nenhum em aberto)'}\n</combinados>`,
      ],
      pedido: 'Leia esta versão do projeto de dissertação, organize as obras citadas por prioridade de leitura e aponte os problemas de citação.',
      lembrete: 'Siga os critérios de prioridade; não invente obras; trechos copiados do PDF. Responda só com o objeto JSON.',
      esquema: ESQ_REVISAO,
    });
    const porB = new Map(obras.map(({ id, l }) => [id, l]));
    const j = r.json || {};
    const obrasR = (j.obras || [])
      .map((o) => {
        const l = porB.get(o.id_biblioteca) || obraPorReferencia(bib.leituras(), { referencia: o.como_aparece });
        return { ...o, prioridade: Math.min(3, Math.max(1, Number(o.prioridade) || 1)), leituraId: l?.id || null };
      })
      .sort((a, b) => b.prioridade - a.prioridade || (b.vezes || 0) - (a.vezes || 0));
    const versao = (anterior?.versao || 0) + 1;
    const item = { id: novoId('rev'), versao, arquivo: { nome: arquivo.name, tamanho: arquivo.size }, enviadoEm: new Date().toISOString(), resultado: { paginas: j.paginas || null, obras: obrasR, problemas: j.problemas || [], comparacao: j.comparacao || null }, buscar: [], modelo: r.modelo };
    const d = drive();
    if (d) {
      try {
        const up = await d.enviarArquivo(`dissertacao/versoes/v${versao}.pdf`, arquivo, 'application/pdf');
        item.arquivo.driveId = up.id;
      } catch (e) {
        registrar('erro', 'revisao.pdf_drive', { det: e.message, st: 'aviso' });
      }
    }
    await dados.salvar('revisoes', item);
    try {
      const c = await historico.nova({ funcao: 'revisao_projeto', alvo: { tipo: 'revisao', id: item.id }, titulo: `Revisão do projeto, versão ${versao}` });
      await historico.acrescentar(c.id, { de: 'ia', tarefa: 'revisao_projeto', resposta: j, modelo: r.modelo, uso: r.uso, custo: r.custo, instrucao: r.instrucao });
    } catch (e) {
      registrar('erro', 'revisao.historico', { det: e.message, st: 'aviso' });
    }
    registrar('ia', 'revisao.feita', { det: `versão ${versao}, ${obrasR.length} obras, ${(j.problemas || []).length} problemas`, dur: Math.round(performance.now() - inicio) });
    await carregar();
    return item;
  }

  /**
   * Muda uma versão do projeto a partir do que está gravado, uma mudança por vez. O parecer chega minutos depois
   * do envio; se ele e um clique (marcar uma obra para buscar, decidir um ponto) gravassem a partir da cópia em
   * memória, o que gravasse por último apagaria a mudança do outro.
   */
  let filaRevisoes = Promise.resolve();
  function mudarRevisao(id, mudanca) {
    filaRevisoes = filaRevisoes
      .catch(() => {})
      .then(async () => {
        const atual = (await dados.listar('revisoes')).find((r) => r.id === id);
        const novo = atual && mudanca(atual);
        if (!novo) return null;
        const salvo = await dados.salvar('revisoes', novo);
        await carregar();
        return salvo;
      });
    return filaRevisoes;
  }

  /* ---------- Parecer da versão: o que ajustar para a qualificação ---------- */
  /** O texto de cada página do PDF, para conferir os trechos que a IA citar. Sem texto legível, devolve null. */
  async function textoDasPaginas(arquivo) {
    try {
      const { pdfjs } = await import('./leitor-pdf.js');
      const lib = await pdfjs();
      const doc = await lib.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
      const paginas = [];
      for (let n = 1; n <= doc.numPages; n++) paginas.push((await (await doc.getPage(n)).getTextContent()).items.map((i) => i.str || '').join(' '));
      return paginas.some((p) => p.trim()) ? paginas : null;
    } catch (e) {
      registrar('erro', 'parecer.texto_pdf', { det: e.message, st: 'aviso' });
      return null;
    }
  }
  async function pedirParecer(revId, arquivo) {
    const inicio = performance.now();
    const r = revisao(revId);
    if (!r) throw new Error('Versão não encontrada.');
    const anterior = revisoes.find((x) => x.versao < r.versao && x.parecer?.achados?.length);
    const antes = (anterior?.parecer.achados || []).map((a, i) => ({ id: `P${i + 1}`, a }));
    const nomeParte = Object.fromEntries(PARTES_PARECER.map(([k, n]) => [k, n]));
    const resp = await ia.gerarTarefa({
      tarefa: 'parecer_projeto',
      partes: [await partePDF(arquivo)],
      blocos: [antes.length ? `<parecer_anterior>\nVersão ${anterior.versao}.\n${antes.map(({ id, a }) => `${id}: [${nomeParte[a.parte]}] ${a.titulo}`).join('\n')}\n</parecer_anterior>` : '<parecer_anterior>\n(primeiro parecer)\n</parecer_anterior>'],
      pedido: 'Leia esta versão do projeto de dissertação e escreva o parecer para a qualificação, parte por parte.',
      lembrete: 'Só aponte o que está no PDF; trechos copiados do PDF, com a página; não reescreva o texto do autor. Responda só com o objeto JSON.',
      esquema: ESQ_PARECER,
    });
    const j = resp.json || {};
    const paginas = await textoDasPaginas(arquivo);
    const ordemG = Object.fromEntries(GRAVIDADES.map(([k], i) => [k, i]));
    const ordemP = Object.fromEntries(PARTES_PARECER.map(([k], i) => [k, i]));
    const achados = (j.achados || [])
      .filter((a) => a.parte in ordemP && a.gravidade in ordemG && a.titulo)
      .slice(0, 20)
      .map((a) => ({ id: novoId('ach'), parte: a.parte, gravidade: a.gravidade, titulo: a.titulo, trecho: (a.trecho || '').trim(), pagina: Number(a.pagina) || 0, esperado: a.esperado || '', como_resolver: a.como_resolver || '', conferido: conferirTrecho(paginas, a.trecho, Number(a.pagina) || 0), decisao: null, feito: false }))
      .sort((a, b) => ordemG[a.gravidade] - ordemG[b.gravidade] || ordemP[a.parte] - ordemP[b.parte]);
    const resolvidos = (j.resolvidos || []).map((x) => ({ x, p: antes.find((p) => p.id === x.id) })).filter(({ p }) => p).map(({ x, p }) => ({ titulo: p.a.titulo, parte: p.a.parte, como: x.como || '' }));
    const parecer = { feitoEm: new Date().toISOString(), modelo: resp.modelo, achados, resolvidos, sobreVersao: anterior?.versao || null, conferencia: paginas ? 'feita' : 'sem-texto' };
    await mudarRevisao(revId, (atual) => ({ ...atual, parecer }));
    try {
      const c = await historico.nova({ funcao: 'parecer_projeto', alvo: { tipo: 'revisao', id: revId }, titulo: `Parecer do projeto, versão ${r.versao}` });
      await historico.acrescentar(c.id, { de: 'ia', tarefa: 'parecer_projeto', resposta: j, modelo: resp.modelo, uso: resp.uso, custo: resp.custo, instrucao: resp.instrucao });
    } catch (e) {
      registrar('erro', 'parecer.historico', { det: e.message, st: 'aviso' });
    }
    registrar('ia', 'parecer.feito', { det: `versão ${r.versao}, ${achados.length} achados, ${resolvidos.length} resolvidos`, dur: Math.round(performance.now() - inicio) });
    await carregar();
    return revisao(revId);
  }
  /** Decisão do autor sobre um achado: 'pendencia', 'ignorado' ou null (ainda sem decisão). Devolve a decisão anterior, para o desfazer. */
  async function decidirAchado(revId, achadoId, decisao) {
    let antes;
    await mudarRevisao(revId, (r) => {
      const a = r.parecer?.achados.find((x) => x.id === achadoId);
      if (!a) return null;
      antes = a.decisao;
      return { ...r, parecer: { ...r.parecer, achados: r.parecer.achados.map((x) => (x.id === achadoId ? { ...x, decisao, feito: decisao === 'pendencia' ? x.feito : false } : x)) } };
    });
    registrar('ui', 'parecer.decisao', { det: decisao || 'desfeita' });
    return antes;
  }
  const marcarPendencia = (revId, achadoId, feito) => mudarRevisao(revId, (r) => (r.parecer ? { ...r, parecer: { ...r.parecer, achados: r.parecer.achados.map((x) => (x.id === achadoId ? { ...x, feito } : x)) } } : null));

  async function marcarParaBuscar(revId, indice) {
    await mudarRevisao(revId, (r) => ({ ...r, buscar: [...new Set([...(r.buscar || []), indice])] }));
    registrar('ui', 'revisao.para_buscar');
  }

  /** Trilha com as obras de prioridade alta e média que já estão na biblioteca, na ordem da revisão. */
  async function criarTrilha(revId) {
    const r = revisao(revId);
    const itens = [...new Set(r.resultado.obras.filter((o) => o.prioridade >= 2 && o.leituraId).map((o) => o.leituraId))];
    if (!itens.length) return null;
    const t = { id: `trilha-${crypto.randomUUID().slice(0, 8)}`, nome: `Revisão da versão ${r.versao}`, itens, prazo: null, criadoEm: new Date().toISOString() };
    await dados.salvar('trilhas', t);
    await window.rb?.trilhasUI?.carregar();
    registrar('ui', 'revisao.trilha', { det: `${itens.length} obras` });
    return t;
  }

  /* ---------- Orientação ---------- */
  const encontros = () => disc.encontros();
  const encontro = (id) => disc.encontro(id);

  function combinadosAbertos() {
    const lista = [];
    for (const e of encontros()) for (const c of e.combinados || []) if (!c.feito && !c.descartado) lista.push({ ...c, encontroId: e.id, data: e.data });
    return lista;
  }
  function temas() {
    const conta = new Map();
    for (const e of encontros()) for (const t of e.registro?.temas || []) {
      const k = normalizar(t);
      const atual = conta.get(k) || { tema: t, vezes: 0 };
      atual.vezes++;
      conta.set(k, atual);
    }
    return [...conta.values()].sort((a, b) => b.vezes - a.vezes).slice(0, 6);
  }

  async function novoEncontro({ data, titulo, formato, texto = '' }) {
    const e = await disc.salvarItem({ id: novoId('enc'), data: data || diaLocal(), titulo: titulo || 'Encontro de orientação', formato, texto, combinados: [], criadoEm: new Date().toISOString() });
    registrar('ui', 'orientacao.registrar', { det: FORMATOS[formato] });
    return e;
  }

  /** Pede o registro à IA: resumo, combinados, trechos (conferidos), temas e o que mudou nos combinados anteriores. */
  async function processar(id, { segmentos = null, arquivo = null } = {}) {
    let e = encontro(id);
    await disc.salvarItem({ ...e, processando: true, erroIA: null });
    aoMudar();
    try {
      const segs = segmentos || (e.formato === 'audio' ? await disc.transcricao(id) : null);
      const conteudo = segs ? segs.map((s) => `[${s.inicio}] ${s.falante}: ${s.texto}`).join('\n') : e.texto || '';
      const abertos = combinadosAbertos().filter((c) => c.encontroId !== id);
      const ids = new Map(abertos.map((c, i) => [`C${i + 1}`, c]));
      const anteriores = encontros().filter((x) => x.id !== id && x.registro).slice(0, 6);
      const r = await ia.gerarTarefa({
        tarefa: 'orientacao',
        partes: e.formato === 'pdf' && arquivo ? [{ inlineData: { mimeType: 'application/pdf', data: await base64(arquivo) } }] : [],
        blocos: [
          (c) => `<registro>\nFormato: ${segs ? 'gravação transcrita' : FORMATOS[e.formato]}. Data: ${e.data}.\n<material-${c}>\n${e.formato === 'pdf' ? `${e.texto ? `Observação do autor: ${e.texto}\n` : ''}(o PDF comentado vem antes deste texto)` : conteudo}\n</material-${c}>\n</registro>`,
          `<encontros_anteriores>\n${anteriores.map((x) => `${x.data}: ${x.registro.resumo} Temas: ${(x.registro.temas || []).join(', ')}`).join('\n') || '(primeiro registro)'}\n</encontros_anteriores>`,
          `<combinados_abertos>\n${[...ids].map(([k, c]) => `${k}: ${c.acao}${c.secao ? ` (${c.secao})` : ''}, combinado em ${c.data}`).join('\n') || '(nenhum)'}\n</combinados_abertos>`,
        ],
        pedido: 'Registre este encontro de orientação.',
        lembrete: 'Só o que foi dito ou escrito; trechos palavra por palavra. Responda só com o objeto JSON.',
        esquema: ESQ_ORIENTACAO,
      });
      const j = r.json || {};
      if (arquivo && drive()) drive().enviarArquivo(`orientacao/${id}/comentado.pdf`, arquivo, 'application/pdf').catch((err) => registrar('erro', 'orientacao.pdf_drive', { det: err.message, st: 'aviso' }));
      const tudo = normalizar(e.formato === 'pdf' ? '' : conteudo);
      const trechos = e.formato === 'pdf' ? j.trechos || [] : (j.trechos || []).filter((t) => tudo.includes(normalizar(t.fala)));
      const descartados = (j.trechos || []).length - trechos.length;
      const anterioresSit = (j.combinados_anteriores || []).filter((x) => ids.has(x.id)).map((x) => ({ ...x, combinadoId: ids.get(x.id).id, encontroId: ids.get(x.id).encontroId, acao: ids.get(x.id).acao }));
      e = encontro(id);
      const combinados = [...(e.combinados || []).filter((c) => c.manual), ...(j.combinados || []).map((c) => ({ id: novoId('comb'), acao: c.acao, responsavel: c.responsavel, secao: c.secao || '', prazo: c.prazo || '', feito: false }))];
      await disc.salvarItem({ ...e, processando: false, combinados, registro: { resumo: j.resumo || '', trechos, descartados, sugestoes: j.sugestoes || [], temas: j.temas || [], anteriores: anterioresSit, atencao: j.pontos_de_atencao || [], aviso: j.aviso || '', modelo: r.modelo, em: new Date().toISOString() } });
      try {
        const c = await historico.nova({ funcao: 'orientacao', alvo: { tipo: 'encontro', id }, titulo: `${e.titulo}, ${e.data}` });
        await historico.acrescentar(c.id, { de: 'ia', tarefa: 'orientacao', resposta: j, modelo: r.modelo, uso: r.uso, custo: r.custo, instrucao: r.instrucao });
      } catch (err) {
        registrar('erro', 'orientacao.historico', { det: err.message, st: 'aviso' });
      }
      registrar('ia', 'orientacao.registro', { det: `${combinados.length} combinados, ${trechos.length} trechos${descartados ? `, ${descartados} descartados` : ''}, ${anterioresSit.length} anteriores tratados` });
      const d = drive();
      if (d) {
        const md = [`# ${e.titulo} (${e.data})`, '', j.resumo || '', '', '## Combinados', ...combinados.map((c) => `- [ ] ${c.acao}${c.secao ? ` (${c.secao})` : ''}${c.prazo ? `, até ${c.prazo}` : ''}`), '', '## Trechos', ...trechos.map((t) => `> ${t.fala}${t.tempo ? ` (${t.tempo})` : ''}`)].join('\n');
        d.gravar(`orientacao/${id}/registro.md`, md, 'text/markdown; charset=UTF-8').catch((err) => registrar('erro', 'orientacao.drive', { det: err.message, st: 'aviso' }));
      }
    } catch (err) {
      registrar('erro', 'orientacao.falhou', { det: `${err.codigo || ''} ${err.message}`.trim(), st: 'erro' });
      await disc.salvarItem({ ...encontro(id), processando: false, erroIA: { mensagem: err.message, codigo: err.codigo || null } });
    }
    aoMudar();
  }

  async function marcarCombinado(encontroId, combinadoId, feito) {
    const e = encontro(encontroId);
    await disc.salvarItem({ ...e, combinados: e.combinados.map((c) => (c.id === combinadoId ? { ...c, feito, feitoEm: feito ? new Date().toISOString() : null } : c)) });
    registrar('ui', feito ? 'orientacao.combinado_feito' : 'orientacao.combinado_reaberto');
  }
  async function novoCombinado(encontroId, acao) {
    const e = encontro(encontroId);
    await disc.salvarItem({ ...e, combinados: [...(e.combinados || []), { id: novoId('comb'), acao, responsavel: 'autor', secao: '', prazo: '', feito: false, manual: true }] });
  }
  async function apagarEncontro(id) {
    const e = encontro(id);
    await dados.apagar('encontros', id);
    await disc.carregar();
    registrar('ui', 'orientacao.apagar');
    return async () => {
      await dados.salvar('encontros', { ...e, apagado: false });
      await disc.carregar();
    };
  }

  function pauta() {
    return combinadosAbertos().map((c) => `${c.acao}${c.secao ? ` (${c.secao})` : ''}`);
  }

  // Quando a gravação de um encontro termina de transcrever, o registro é pedido aqui.
  disc.aoTranscreverEncontro((id, segmentos) => processar(id, { segmentos }));

  return { carregar, todasRevisoes, revisao, revisar, pedirParecer, decidirAchado, marcarPendencia, marcarParaBuscar, criarTrilha, encontros, encontro, combinadosAbertos, temas, novoEncontro, processar, marcarCombinado, novoCombinado, apagarEncontro, pauta };
}
