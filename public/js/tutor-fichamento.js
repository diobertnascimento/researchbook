// Comentários do tutor em cada etapa do fichamento: um ponto forte, uma lacuna e uma pergunta, sem reescrever.
// As respostas ficam no histórico (função "fichamento", uma conversa por obra) e reaparecem ao voltar à etapa.
import { acervoDe } from './contexto.js';
import { citacao, referenciaTexto } from './abnt.js';
import { FUNCOES } from './leitor-pdf.js';
import { PASSOS, PERGUNTAS, BLOCOS, PERGUNTAS_GERAIS } from './fichamento-ui.js';
import { ErroIA } from './gemini.js';
import { ouvir } from './ui.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ETAPA_IA = { referencia: 'referencia', citacoes: 'citacoes', resumo: 'resumo', analise: 'analise_critica', dissertacao: 'para_a_dissertacao' };
const ERROS_DE_CONFIG = ['sem-acesso', 'permissao', 'projeto', 'trancado', 'chave', 'api', 'negado', 'sessao'];
const ESQ = {
  type: 'object',
  properties: { pontos: { type: 'array', items: { type: 'object', properties: { tipo: { type: 'string', enum: ['forte', 'lacuna', 'pergunta'] }, texto: { type: 'string' }, ref: { type: 'string' } }, required: ['tipo', 'texto', 'ref'] } }, mais_importante: { type: 'integer' } },
  required: ['pontos', 'mais_importante'],
};
const tirarIds = (s) => String(s || '').replace(/\s*\[A\d+\]/g, '');

export function criarTutorFichamento({ ia, bib, fichUI, argUI, historico, registrar }) {
  const cache = new Map(); // `${id}:${etapa}` -> { pontos, mais_importante, itens, em }
  const carregados = new Set();
  const est = { ocupado: null, erro: null };

  function textoDoFichamento(f) {
    if (!f) return '(nada escrito ainda)';
    return [
      `Citações escolhidas:\n${(f.citacoes || []).map((c) => `- "${c.texto}" (p. ${c.pagina}). Por que importa: ${c.porque || '(sem justificativa)'}`).join('\n') || '(nenhuma)'}`,
      `Resumo:\n${f.resumo || '(vazio)'}`,
      `Análise crítica:\n${PERGUNTAS.map(([k, q]) => `${q} ${f.analise?.[k] || '(vazio)'}`).join('\n')}`,
      `Para a dissertação:\n${(f.trechos || []).map((t) => `- Trecho: ${t.texto || '(vazio)'} | Argumento: ${t.argumento || '(nenhum)'}`).join('\n') || '(nenhum trecho)'}`,
      `Notas com as palavras do autor:\n${(f.notas || []).filter((n) => n.texto?.trim()).map((n) => `- ${n.pergunta ? `Pergunta: ${n.pergunta} | ` : 'Sobre um grifo | '}Resposta: ${n.texto.trim()}`).join('\n') || '(nenhuma)'}`,
    ].join('\n\n');
  }

  async function comentar(id, passo) {
    const l = bib.obter(id);
    const etapa = PASSOS[passo].id;
    const f = fichUI.doLivro(id);
    const acervo = acervoDe(
      bib.grifosDe(id).map((g) => ({ tipo: `grifo (${(FUNCOES.find((x) => x.id === g.funcao)?.nome || 'grifo').toLowerCase()})`, ref: `grifo:${g.id}`, leituraId: l.id, pagina: g.pagina, citacao: citacao(l, g.pagina), texto: g.texto })),
    );
    const r = await ia.gerarTarefa({
      tarefa: 'fichamento',
      acervo,
      blocos: [
        `<etapa>\n${ETAPA_IA[etapa]}\n</etapa>`,
        (c) => `<leitura>\n<material-${c}>\n${referenciaTexto(l)}\n</material-${c}>\n</leitura>`,
        (c) => `<fichamento>\n<material-${c}>\n${textoDoFichamento(f)}\n</material-${c}>\n</fichamento>`,
        `<argumentos>\n${argUI.todos().map((a) => `[${a.id}] ${a.tese}`).join('\n') || '(nenhum ainda)'}\n</argumentos>`,
      ],
      pedido: `Comente a etapa "${PASSOS[passo].nome}" do fichamento.`,
      lembrete: 'No máximo 3 pontos (forte, lacuna, pergunta); não reescreva o autor. Responda só com o objeto JSON.',
      esquema: ESQ,
    });
    const item = { ...r.json, etapa, itens: r.itens, em: new Date().toISOString() };
    cache.set(`${id}:${etapa}`, item);
    try {
      const conv = historico.deAlvo('fichamento', { tipo: 'leitura', id }) || (await historico.nova({ funcao: 'fichamento', alvo: { tipo: 'leitura', id }, titulo: `Fichamento: ${l.titulo}`.slice(0, 80) }));
      await historico.acrescentar(conv.id, { de: 'ia', tarefa: 'fichamento', etapa, resposta: r.json, itens: r.itens, modelo: r.modelo, uso: r.uso, custo: r.custo, instrucao: r.instrucao });
    } catch (e) {
      registrar('erro', 'fichamento.historico', { det: e.message, st: 'aviso' });
    }
    registrar('ia', 'fichamento.comentario', { det: `${etapa}, ${(r.json?.pontos || []).length} pontos` });
    return item;
  }

  /* ---------- Perguntas do fichamento pelo texto completo: escritas uma vez, quando ele pede ---------- */
  const ESQ_PERGUNTAS = {
    type: 'object',
    properties: { perguntas: { type: 'array', items: { type: 'object', properties: { bloco: { type: 'string', enum: BLOCOS.map(([k]) => k) }, texto: { type: 'string' }, porque: { type: 'string' } }, required: ['bloco', 'texto'] } } },
    required: ['perguntas'],
  };
  /** O começo do texto da obra, tirado do PDF neste aparelho. Sem PDF, segue só com a referência e os grifos. */
  async function comecoDoTexto(id) {
    try {
      const { blob } = await bib.obterPDFagora(id);
      if (!blob) return '';
      const { lerInicio } = await import('./leitor-pdf.js');
      return (await lerInicio(blob, 30)).texto.replace(/\s+/g, ' ').slice(0, 60000);
    } catch (e) {
      registrar('erro', 'fichamento.texto_pdf', { det: e.message, st: 'aviso' });
      return '';
    }
  }
  /**
   * Devolve a lista de perguntas (8, com todos os blocos) ou, com `trocar`, uma pergunta só para aquele bloco.
   * Bloco que a IA deixar sem pergunta é completado com a pergunta geral, para o fichamento nunca ficar sem um bloco.
   */
  async function gerarPerguntas(id, { trocar = null } = {}) {
    const l = bib.obter(id);
    const acervo = acervoDe(
      bib.grifosDe(id).map((g) => ({ tipo: `grifo (${(FUNCOES.find((x) => x.id === g.funcao)?.nome || 'grifo').toLowerCase()})`, ref: `grifo:${g.id}`, leituraId: l.id, pagina: g.pagina, citacao: citacao(l, g.pagina), texto: g.texto })),
    );
    const texto = await comecoDoTexto(id);
    const tese = window.rb?.sessoes?.config().tese || '';
    const r = await ia.gerarTarefa({
      tarefa: 'fichamento_perguntas',
      acervo,
      blocos: [
        (c) => `<leitura>\n<material-${c}>\n${referenciaTexto(l)}\n</material-${c}>\n</leitura>`,
        (c) => `<texto>\n<material-${c}>\n${texto || '(sem texto legível neste aparelho)'}\n</material-${c}>\n</texto>`,
        (c) => `<tese>\n<material-${c}>\n${tese || '(ainda não escrita)'}\n</material-${c}>\n</tese>`,
        `<argumentos>\n${argUI.todos().map((a) => `[${a.id}] ${a.tese}`).join('\n') || '(nenhum ainda)'}\n</argumentos>`,
        ...(trocar ? [(c) => `<trocar>\nBloco: ${trocar.bloco}\n<material-${c}>\n${trocar.texto}\n</material-${c}>\n</trocar>`] : []),
      ],
      pedido: trocar ? 'Escreva uma única pergunta, do mesmo bloco, no lugar da que veio em <trocar>.' : 'Escreva as 8 perguntas do fichamento desta obra, nos cinco blocos.',
      lembrete: 'Só perguntas: não responda, não resuma e não adiante a resposta. Responda só com o objeto JSON.',
      esquema: ESQ_PERGUNTAS,
    });
    const validos = new Set(BLOCOS.map(([k]) => k));
    const novoId = () => `q-${crypto.randomUUID().slice(0, 8)}`;
    let itens = (r.json?.perguntas || []).filter((p) => validos.has(p.bloco) && p.texto?.trim()).map((p) => ({ id: novoId(), bloco: p.bloco, texto: p.texto.trim(), porque: (p.porque || '').trim() }));
    try {
      const conv = historico.deAlvo('fichamento', { tipo: 'leitura', id }) || (await historico.nova({ funcao: 'fichamento', alvo: { tipo: 'leitura', id }, titulo: `Fichamento: ${l.titulo}`.slice(0, 80) }));
      await historico.acrescentar(conv.id, { de: 'ia', tarefa: 'fichamento_perguntas', resposta: r.json, modelo: r.modelo, uso: r.uso, custo: r.custo, instrucao: r.instrucao });
    } catch (e) {
      registrar('erro', 'fichamento.historico', { det: e.message, st: 'aviso' });
    }
    registrar('ia', trocar ? 'fichamento.pergunta_trocada' : 'fichamento.perguntas', { det: `${itens.length} perguntas` });
    if (trocar) {
      const uma = itens.find((p) => p.bloco === trocar.bloco && p.texto !== trocar.texto);
      if (!uma) throw new Error('A IA não devolveu outra pergunta para este bloco. Tente de novo.');
      return uma;
    }
    // Ordem dos blocos, no máximo duas por bloco, e nenhum bloco vazio.
    itens = BLOCOS.flatMap(([k]) => {
      const doBloco = itens.filter((p) => p.bloco === k).slice(0, 2);
      return doBloco.length ? doBloco : PERGUNTAS_GERAIS.filter((p) => p.bloco === k).slice(0, 1).map((p) => ({ ...p, id: novoId() }));
    });
    return itens;
  }

  /** Busca no histórico os últimos comentários desta obra (uma vez por obra, por sessão). */
  async function carregar(id) {
    if (carregados.has(id)) return false;
    carregados.add(id);
    const conv = historico.deAlvo('fichamento', { tipo: 'leitura', id });
    if (!conv) return false;
    for (const m of await historico.mensagens(conv.id)) if (m.tarefa === 'fichamento' && m.etapa) cache.set(`${id}:${m.etapa}`, { ...m.resposta, etapa: m.etapa, itens: m.itens, em: m.em });
    return true;
  }

  function painel(id, passo) {
    const etapa = PASSOS[passo].id;
    const c = cache.get(`${id}:${etapa}`);
    if (!carregados.has(id)) carregar(id).then((mudou) => mudou && /^#fichamento/.test(location.hash) && !document.activeElement?.matches?.('input, textarea') && window.render?.());
    const sem = !ia.ajustes?.modo?.();
    const nomes = { forte: 'Ponto forte', lacuna: 'Lacuna', pergunta: 'Pergunta' };
    const itens = new Map((c?.itens || []).map((x) => [x.id, x]));
    const ref = (s) => (/^A\d+$/.test(s) && itens.get(s) ? `Grifo ${itens.get(s).citacao}` : s ? `“${s}”` : '');
    return `<h4 class="mt-6">Comentários do tutor</h4>
      ${sem ? '<p class="sub">Ligue o Gemini em Ajustes para o tutor comentar cada etapa. Ele aponta lacunas e faz perguntas, sem reescrever por você.</p><a class="btn fant" href="#ajustes">Ajustes do Gemini</a>' : ''}
      ${c ? `<div class="coment-tutor">${(c.pontos || []).map((p, i) => `<div class="ct ${p.tipo} ${i === c.mais_importante ? 'mais' : ''}"><b>${nomes[p.tipo] || p.tipo}${i === c.mais_importante ? ' <span class="chip">mais importante</span>' : ''}</b><p>${esc(tirarIds(p.texto))}</p>${p.ref ? `<small>${esc(ref(p.ref))}</small>` : ''}</div>`).join('')}<small class="mute">${new Date(c.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></div>` : !sem ? '<p class="sub">O tutor comenta o que você escreveu nesta etapa: um ponto forte, uma lacuna e uma pergunta.</p>' : ''}
      ${est.erro && est.erro.id === id ? `<div class="erro-ia" role="alert"><p>${esc(est.erro.err.message)}</p>${est.erro.err instanceof ErroIA && ERROS_DE_CONFIG.includes(est.erro.err.codigo) ? '<a class="btn" href="#ajustes">Abrir Ajustes do Gemini</a>' : ''}</div>` : ''}
      ${sem ? '' : `<button class="btn" data-tf-comentar="${esc(id)}" data-passo="${passo}" ${est.ocupado ? 'disabled' : ''}>${est.ocupado === `${id}:${etapa}` ? 'O tutor está lendo…' : c ? 'Pedir novos comentários' : 'Pedir comentários do tutor'}</button>`}`;
  }

  ouvir('click', async (e) => {
    const b = e.target.closest('[data-tf-comentar]');
    if (!b) return;
    const id = b.dataset.tfComentar;
    const passo = Number(b.dataset.passo);
    // Salva o que está na tela antes de pedir (o campo com foco salva ao perder o foco).
    document.activeElement?.blur?.();
    await new Promise((ok) => setTimeout(ok, 800));
    est.ocupado = `${id}:${PASSOS[passo].id}`;
    est.erro = null;
    window.render?.();
    try {
      await comentar(id, passo);
    } catch (err) {
      est.erro = { id, err };
      if (!(err instanceof ErroIA)) registrar('erro', 'fichamento.comentario_falhou', { det: err.message, st: 'erro' });
    } finally {
      est.ocupado = null;
      if (/^#fichamento/.test(location.hash)) window.render?.();
    }
  });

  return { painel, comentar, gerarPerguntas };
}
