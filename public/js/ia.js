// Núcleo da IA no app: acesso (login Google ou cofre), perfil do autor, memória aprovada, montagem do
// contexto, chamada ao Gemini, conferência das citações e histórico. As telas só chamam daqui.
import * as google from './google.js';
import { criarGemini, ErroIA, TAREFAS } from './gemini.js';
import { instrucao, juntarAcervo, montarPedido, conferir, sinaisDeForma } from './contexto.js';
import { autorCurto, citacao } from './abnt.js';
import * as arm from './armazenamento.js';

const PROJETO = 'rb.ia.projeto';
const PERFIL_DRIVE = 'memoria/autor.md';
const lerLS = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const gravarLS = (k, v) => {
  try {
    v ? localStorage.setItem(k, v) : localStorage.removeItem(k);
  } catch {}
};

export const ESQUEMA_TUTOR = {
  type: 'object',
  properties: {
    resposta: { type: 'string', description: 'Texto ao autor, sem perguntas. Afirmações sobre obras com a citação do item e o id entre colchetes, ex.: (Silva, 2020, p. 3) [A2].' },
    pergunta: { type: 'string', description: 'No máximo uma pergunta ao autor, ou texto vazio.' },
    fontes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Id do item do acervo, ex.: A2.' },
          trecho_literal: { type: 'string', description: 'Até 25 palavras copiadas palavra por palavra do item.' },
        },
        required: ['id', 'trecho_literal'],
      },
    },
    fora_do_acervo: { type: 'array', items: { type: 'string' }, description: 'Sugestões para o autor buscar; nunca citadas.' },
  },
  required: ['resposta', 'pergunta', 'fontes', 'fora_do_acervo'],
};

const PEDIDOS = {
  explique: 'Explique o trecho escolhido.',
  contraponha: 'Contraponha: apresente a objeção mais forte ao trecho escolhido ou ao uso que eu quero fazer dele.',
  conecte: 'Conecte o trecho escolhido a outros itens do acervo ou aos meus argumentos.',
};
export const ROTULOS_PEDIDO = { explique: 'Explique', contraponha: 'Contraponha', conecte: 'Conecte' };

const LEMBRETE_TUTOR =
  'Responda só com o objeto JSON pedido. Afirmações sobre obras só com itens do acervo, usando a citação do item e o id entre colchetes. Em "resposta": até 120 palavras e nenhuma pergunta. No máximo uma pergunta, em "pergunta". Cada id usado entra em "fontes" com um trecho copiado palavra por palavra. Não escreva texto para o autor entregar.';

export function criarIA({ db, dados, bib, fichUI, argUI, historico, cofre, drive, registrar }) {
  let perfilCache = null;

  async function credenciais() {
    const modo = google.acessoIA();
    if (modo === 'google') {
      const s = google.sessao();
      if (s && !google.temPermissaoIA()) throw new ErroIA('permissao', 'Falta a permissão do Gemini no login. Em Ajustes > Gemini, toque em "Conectar o Gemini" e aceite a permissão.');
      return { modo, token: s?.token || null, projeto: lerLS(PROJETO) };
    }
    if (modo === 'cofre') return { modo, chave: await cofre.chave() };
    return null;
  }
  const gemini = criarGemini({ credenciais, registrar });

  /* ---------- Ajustes ---------- */
  const ajustes = {
    modo: () => google.acessoIA(),
    definirModo: (m) => {
      google.definirAcessoIA(m);
      registrar('ia', 'ia.acesso', { det: m });
    },
    projeto: () => lerLS(PROJETO) || '',
    definirProjeto: (p) => gravarLS(PROJETO, String(p || '').trim()),
    temPermissao: () => google.temPermissaoIA(),
    conectarGoogle: () => google.entrar({ registrar, comIA: true }),
  };

  /* ---------- Perfil do autor (Drive: memoria/autor.md) ---------- */
  async function perfil() {
    if (perfilCache !== null) return perfilCache;
    const local = await arm.lerMeta(db, 'perfil-autor');
    perfilCache = local?.texto || '';
    try {
      const d = drive();
      const t = d ? await d.ler(PERFIL_DRIVE) : null;
      if (t != null) {
        perfilCache = t;
        await arm.gravarMeta(db, 'perfil-autor', { texto: t, em: new Date().toISOString() });
      }
    } catch (e) {
      registrar('erro', 'perfil.ler_falhou', { det: e.message, st: 'aviso' });
    }
    return perfilCache;
  }
  async function salvarPerfil(texto) {
    perfilCache = texto;
    await arm.gravarMeta(db, 'perfil-autor', { texto, em: new Date().toISOString() });
    const d = drive();
    if (d) await d.gravar(PERFIL_DRIVE, texto, 'text/markdown');
    registrar('ia', 'perfil.salvar', { det: `${texto.length} caracteres${d ? ', no Drive' : ', só neste aparelho'}` });
    return !!d;
  }

  const memoriaAprovada = async () => (await dados.listar('memoria')).filter((m) => m.status === 'aprovada');

  /* ---------- Teste de conexão ---------- */
  async function testar() {
    const t = TAREFAS.teste;
    const r = await gemini.gerar({ tarefa: 'teste', modelo: t.modelo, reserva: t.reserva, pensamento: t.pensamento, maxSaida: t.maxSaida, conteudos: [{ role: 'user', parts: [{ text: 'Responda apenas: ok' }] }] });
    return { modelo: r.modelo, dur: r.dur };
  }

  /* ---------- Tutor ---------- */
  async function perguntarTutor({ leituraId, tipo = 'pergunta', texto = '', trecho = null, paginaAtual = null, textoPagina = '', conversaId, sinal }) {
    const leitura = bib.obter(leituraId);
    if (!leitura) throw new ErroIA('pedido', 'Esta obra não está mais na biblioteca.');
    if (tipo !== 'pergunta' && !trecho) throw new ErroIA('trecho', 'Selecione um trecho no texto primeiro.');
    const t = TAREFAS.tutor;
    const [base, tarefa, perfilTexto, memoria] = await Promise.all([instrucao('00-base.md'), instrucao(t.instrucao), perfil(), memoriaAprovada()]);

    const outros = bib
      .todosGrifos()
      .filter((g) => g.leituraId !== leituraId && ['dissert', 'critica'].includes(g.funcao))
      .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''))
      .slice(0, 15)
      .map((g) => ({ g, l: bib.obter(g.leituraId) }))
      .filter((x) => x.l);
    const acervo = juntarAcervo({ leitura, trecho, textoPagina, paginaAtual, grifosObra: bib.grifosDe(leituraId), fichamento: fichUI.doLivro(leituraId), outros });

    const argumentos = argUI.lista().map((a) => `- ${a.tese} (${argUI.fontesDe(a).length} ${argUI.fontesDe(a).length === 1 ? 'obra' : 'obras'})`);
    const blocos = [
      (cod) => `<leitura>\n<material-${cod}>\n${leitura.titulo}${leitura.subtitulo ? `: ${leitura.subtitulo}` : ''}. ${autorCurto(leitura)}. Etapa: ${['não iniciada', 'em leitura', 'leitura concluída', 'em fichamento', 'fichada'][leitura.etapa || 0]}. Página atual: ${paginaAtual || leitura.paginaAtual || 1}${leitura.totalPaginas ? ` de ${leitura.totalPaginas}` : ''}. Citação desta obra: ${citacao(leitura)}.\n</material-${cod}>\n</leitura>`,
      (cod) => `<argumentos>\n<material-${cod}>\n${argumentos.length ? argumentos.join('\n') : '(o autor ainda não registrou argumentos)'}\n</material-${cod}>\n</argumentos>`,
    ];
    const pedidoTexto = tipo === 'pergunta' ? texto : `${PEDIDOS[tipo]}${texto ? ` ${texto}` : ''}`;
    const pedido = `${pedidoTexto}${trecho ? '\n(O trecho escolhido é o item A1.)' : ''}`;

    const anteriores = (await historico.mensagens(conversaId))
      .reduce((acc, m) => {
        if (m.de === 'autor') acc.push({ autor: m.pedido?.mostrado || '', ia: '' });
        else if (m.de === 'ia' && acc.length) acc[acc.length - 1].ia = [m.resposta?.resposta, m.resposta?.pergunta].filter(Boolean).join('\n\n');
        return acc;
      }, [])
      .filter((x) => x.autor && x.ia);

    const montado = montarPedido({ base, tarefa, perfil: perfilTexto, memoria, acervo, blocos, pedido, lembrete: LEMBRETE_TUTOR, anteriores });
    const versao = `base ${base.versao}, tutor ${tarefa.versao}`;
    const chamar = (conteudos) => gemini.gerar({ tarefa: 'tutor', modelo: t.modelo, reserva: t.reserva, pensamento: t.pensamento, versaoInstrucao: versao, sistema: montado.sistema, conteudos, esquema: ESQUEMA_TUTOR, maxSaida: t.maxSaida, sinal });

    let r = await chamar(montado.conteudos);
    let conf = conferir(r.json, acervo);
    let corrigida = false;
    const usoTotal = { ...r.uso };
    let custoTotal = r.custo;
    if (!conf.ok) {
      // Conferência em duas etapas: devolve os problemas ao modelo uma vez, antes de mostrar.
      registrar('ia', 'tutor.conferencia_reprovada', { det: `${conf.problemas.length} problemas; pedindo correção`, st: 'aviso' });
      const correcao = `A conferência automática encontrou problemas na sua resposta:\n${conf.problemas.map((p) => `- ${p}`).join('\n')}\nRefaça a resposta usando só itens do acervo, com trechos copiados palavra por palavra. Se o acervo não sustenta a afirmação, diga isso. Responda só com o objeto JSON.`;
      const r2 = await chamar([...montado.conteudos, { role: 'model', parts: [{ text: r.texto }] }, { role: 'user', parts: [{ text: correcao }] }]);
      const conf2 = conferir(r2.json, acervo);
      for (const k of Object.keys(usoTotal)) usoTotal[k] += r2.uso[k] || 0;
      custoTotal = custoTotal == null || r2.custo == null ? null : custoTotal + r2.custo;
      r = r2;
      conf = conf2;
      corrigida = true;
    }
    const forma = sinaisDeForma(r.json);
    registrar('ia', 'tutor.conferencia', { det: `${conf.ok ? 'ok' : `${conf.problemas.length} problemas`}${corrigida ? ' após correção' : ''}, ${conf.fontes.length} fontes, ${forma.palavras} palavras${forma.avisos.length ? `, ${forma.avisos.join('; ')}` : ''}`, st: conf.ok ? 'ok' : 'aviso' });

    const mostrado = tipo === 'pergunta' ? texto : ROTULOS_PEDIDO[tipo];
    await historico.acrescentar(conversaId, { de: 'autor', pedido: { tipo, texto, mostrado, trecho: trecho ? { pagina: trecho.pagina, texto: trecho.texto } : null, pagina: paginaAtual } });
    const msg = {
      de: 'ia',
      resposta: r.json,
      conferencia: { ok: conf.ok, problemas: conf.problemas, conferidas: conf.fontes.filter((f) => f.conferida).map((f) => f.id), corrigida },
      itens: acervo.itens.map((it) => ({ id: it.id, ref: it.ref, leituraId: it.leituraId, pagina: it.pagina || null, citacao: it.citacao || null })),
      modelo: r.modelo,
      reserva: r.reserva,
      uso: usoTotal,
      custo: custoTotal,
      instrucao: versao,
    };
    const lista = await historico.acrescentar(conversaId, msg);
    return { ...msg, indice: lista.length - 1 };
  }

  return { ajustes, perfil, salvarPerfil, testar, perguntarTutor, credenciais };
}
