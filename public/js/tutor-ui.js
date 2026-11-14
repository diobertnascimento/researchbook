// Painel do Tutor no leitor de PDF.
// Uma conversa contínua por obra (guardada no histórico e no Drive); "Nova conversa" começa outra.
// Cada resposta mostra as fontes com o resultado da conferência automática: o que não bate com o acervo
// aparece marcado, nunca escondido.
import { ErroIA } from './gemini.js';
import { ROTULOS_PEDIDO } from './ia.js';

/* global I, toast, S */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icone = (n) => (typeof I !== 'undefined' && I[n]) || '';

export function criarTutorUI({ ia, historico, bib, registrar }) {
  const estado = {}; // por obra: { conversaId, mensagens, trecho, pensando, erro, controle, rascunho }
  const de = (id) => (estado[id] ||= { conversaId: null, mensagens: null, trecho: null, pensando: false, erro: null, rascunho: '' });

  async function carregarConversa(leituraId) {
    const e = de(leituraId);
    const c = historico.deAlvo('tutor', { tipo: 'leitura', id: leituraId });
    e.conversaId = c?.id || null;
    e.mensagens = c ? await historico.mensagens(c.id) : [];
    redesenhar(leituraId);
  }

  /** Texto da resposta com os ids [A2] virando marcas de fonte (conferida ou não). */
  function textoComFontes(texto, m) {
    const itens = new Map((m.itens || []).map((i) => [i.id, i]));
    const conferidas = new Set(m.conferencia?.conferidas || []);
    return esc(texto)
      .split(/\n{2,}/)
      .map((par) => `<p>${par.replace(/\[(A\d+)\]/g, (_, id) => {
        const it = itens.get(id);
        if (!it) return `<span class="fonte-ia ruim" title="Este id não existe no acervo enviado">${id}?</span>`;
        const ok = conferidas.has(id);
        return `<button class="fonte-ia ${ok ? '' : 'ruim'}" data-tutor-fonte="${esc(it.leituraId)}|${it.pagina || ''}" title="${ok ? 'Trecho conferido no seu acervo' : 'Trecho não conferido: confira antes de usar'}${it.pagina ? `, p. ${it.pagina}` : ''}">${ok ? '' : '⚠ '}${id}</button>`;
      })}</p>`)
      .join('');
  }

  function msgHTML(m, i, leituraId) {
    if (m.de === 'autor') {
      const p = m.pedido || {};
      return `<div class="msg eu">${p.trecho ? `<div class="trecho">“${esc(p.trecho.texto.length > 220 ? p.trecho.texto.slice(0, 220) + '…' : p.trecho.texto)}”, p. ${p.trecho.pagina}</div>` : ''}${esc(p.mostrado || '')}</div>`;
    }
    const r = m.resposta || {};
    const conf = m.conferencia || {};
    return `<div class="msg tutor"><span class="av">${icone('tutor')}</span><div>
      ${textoComFontes(r.resposta || '', m)}
      ${r.pergunta ? `<p class="pergunta-tutor">${esc(r.pergunta)}</p>` : ''}
      ${r.fora_do_acervo?.length ? `<div class="fora-acervo"><small>Para buscar (fora do seu acervo, não citar ainda)</small><ul>${r.fora_do_acervo.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${conf.ok === false ? `<div class="conf-ia" role="note"><b>Conferência:</b> ${conf.problemas.length === 1 ? 'um ponto não bate' : `${conf.problemas.length} pontos não batem`} com o seu acervo. Não use sem conferir.<details><summary>Ver o que não bateu</summary><ul>${conf.problemas.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></details></div>` : ''}
      <div class="fb">${
        m.avaliacao ? `<span class="mute-2">${m.avaliacao === 'util' ? 'Marcada como útil' : 'Marcada como não ajudou'}</span>` : `<button data-tutor-avaliar="util" data-i="${i}" data-id="${esc(leituraId)}">Útil</button><button data-tutor-avaliar="nao" data-i="${i}" data-id="${esc(leituraId)}">Não ajudou</button>`
      }</div>
    </div></div>`;
  }

  function corpoHTML(leituraId) {
    const e = de(leituraId);
    if (!ia.ajustes.modo()) {
      return `<div class="tutor-vazio"><p>Para conversar com o tutor, conecte o Gemini.</p><a class="btn prim" href="#ajustes" data-ir-gemini>Configurar o Gemini</a></div>`;
    }
    if (e.mensagens === null) return '<p class="mute">Abrindo a conversa…</p>';
    const lista = e.mensagens.map((m, i) => msgHTML(m, i, leituraId)).join('');
    const vazio = !e.mensagens.length
      ? `<div class="tutor-vazio"><p>Selecione um trecho e toque em <b>Perguntar ao tutor</b>, ou escreva uma pergunta sobre o texto.</p><details class="como"><summary>Como o tutor funciona?</summary><p>Ele pergunta mais do que responde e só cita o que está no seu acervo: o texto desta obra, os seus grifos e fichamentos. Cada fonte é conferida pelo app; o que não bater aparece marcado. A conversa fica guardada no seu Drive.</p></details></div>`
      : '';
    const pensando = e.pensando ? `<div class="msg tutor pensando" role="status"><span class="av">${icone('tutor')}</span><div><p>Pensando…</p><button class="btn fant" data-tutor-cancelar="${esc(leituraId)}">Cancelar</button></div></div>` : '';
    const erro = e.erro ? `<div class="erro-ia" role="alert"><p>${esc(e.erro.mensagem)}</p>${e.erro.acao ? `<a class="btn" href="#ajustes" data-ir-gemini>Abrir Ajustes do Gemini</a>` : ''}</div>` : '';
    return vazio + lista + pensando + erro;
  }

  function peHTML(leituraId) {
    const e = de(leituraId);
    if (!ia.ajustes.modo()) return '';
    return `<div class="tutor-pe">
      ${e.trecho ? `<div class="tutor-trecho"><span>“${esc(e.trecho.texto.length > 160 ? e.trecho.texto.slice(0, 160) + '…' : e.trecho.texto)}”, p. ${e.trecho.pagina}</span><button class="btn fant" data-tutor-tirar="${esc(leituraId)}" aria-label="Tirar o trecho escolhido">Tirar</button></div>` : ''}
      <div class="tutor-acoes" role="group" aria-label="Pedidos sobre o trecho">${Object.entries(ROTULOS_PEDIDO).map(([k, n]) => `<button class="btn fant" data-tutor-acao="${k}" data-id="${esc(leituraId)}" ${e.trecho && !e.pensando ? '' : 'disabled'}>${n}</button>`).join('')}</div>
      <div class="tutor-escrever"><textarea id="tutor-texto" rows="2" placeholder="Pergunte sobre o texto" aria-label="Pergunta ao tutor" ${e.pensando ? 'disabled' : ''}>${esc(e.rascunho)}</textarea><button class="btn prim" data-tutor-enviar="${esc(leituraId)}" ${e.pensando ? 'disabled' : ''}>Perguntar</button></div>
    </div>`;
  }

  /** O painel inteiro (o leitor chama isto ao desenhar a tela). */
  function painel(leituraId) {
    const e = de(leituraId);
    if (e.mensagens === null && ia.ajustes.modo()) queueMicrotask(() => carregarConversa(leituraId));
    return `<aside class="col-tutor" aria-label="Tutor" id="tutor-painel" data-id="${esc(leituraId)}">
      <button class="fechar-folha" data-alt="verTutor">Fechar</button>
      <div class="tutor-cab"><h4>Tutor</h4>${e.mensagens?.length ? `<button class="btn fant" data-tutor-nova="${esc(leituraId)}">Nova conversa</button>` : ''}</div>
      <div class="tutor-corpo" id="tutor-corpo" aria-live="polite">${corpoHTML(leituraId)}</div>
      ${peHTML(leituraId)}
    </aside>`;
  }

  function redesenhar(leituraId, { rolar = false } = {}) {
    const p = document.getElementById('tutor-painel');
    if (!p || p.dataset.id !== leituraId) return;
    const foco = document.activeElement?.id === 'tutor-texto';
    p.outerHTML = painel(leituraId);
    const c = document.getElementById('tutor-corpo');
    if (c && rolar) c.scrollTop = c.scrollHeight;
    if (foco) document.getElementById('tutor-texto')?.focus();
  }

  function abrirPainel() {
    if (typeof S !== 'undefined' && !S.verTutor) {
      S.verTutor = true;
      window.render?.();
    }
  }

  /** Vem do leitor: o Diobert selecionou um trecho e tocou em "Perguntar ao tutor". */
  function comTrecho(leituraId, trecho) {
    const e = de(leituraId);
    e.trecho = trecho;
    e.erro = null;
    registrar('ui', 'tutor.trecho', { det: `p. ${trecho.pagina}` });
    abrirPainel();
    redesenhar(leituraId);
    document.getElementById('tutor-texto')?.focus({ preventScroll: true });
  }

  async function perguntar(leituraId, tipo) {
    const e = de(leituraId);
    if (e.pensando) return;
    const caixa = document.getElementById('tutor-texto');
    const texto = (caixa?.value || '').trim();
    if (tipo === 'pergunta' && !texto) {
      caixa?.focus();
      return;
    }
    e.rascunho = tipo === 'pergunta' ? '' : texto;
    e.pensando = true;
    e.erro = null;
    e.controle = new AbortController();
    redesenhar(leituraId, { rolar: true });
    try {
      if (!e.conversaId) {
        const l = bib.obter(leituraId);
        e.conversaId = (await historico.nova({ funcao: 'tutor', alvo: { tipo: 'leitura', id: leituraId }, titulo: l?.titulo || 'Leitura' })).id;
      }
      const leitor = window.rb?.bibUI?.atual?.();
      const pagina = leitor?.id === leituraId ? leitor.controle.pagina() : bib.obter(leituraId)?.paginaAtual || 1;
      const textoPagina = leitor?.id === leituraId ? await leitor.controle.texto(e.trecho?.pagina || pagina) : '';
      await ia.perguntarTutor({ leituraId, tipo, texto: tipo === 'pergunta' ? texto : '', trecho: e.trecho, paginaAtual: e.trecho?.pagina || pagina, textoPagina, conversaId: e.conversaId, sinal: e.controle.signal });
      e.mensagens = await historico.mensagens(e.conversaId);
      if (tipo === 'pergunta') e.rascunho = '';
    } catch (err) {
      if (tipo === 'pergunta') e.rascunho = texto;
      if (!(err instanceof ErroIA && err.codigo === 'cancelado')) {
        const acao = err instanceof ErroIA && ['sem-acesso', 'permissao', 'projeto', 'trancado', 'chave', 'api', 'negado', 'sessao'].includes(err.codigo);
        e.erro = { mensagem: err instanceof ErroIA ? err.message : 'Algo deu errado ao falar com o Gemini. O problema ficou registrado; tente de novo.', acao };
        if (!(err instanceof ErroIA)) registrar('erro', 'tutor.falhou', { det: err.message, st: 'erro' });
      }
    } finally {
      e.pensando = false;
      e.controle = null;
      redesenhar(leituraId, { rolar: true });
    }
  }

  document.addEventListener('input', (ev) => {
    if (ev.target.id !== 'tutor-texto') return;
    const id = document.getElementById('tutor-painel')?.dataset.id;
    if (id) de(id).rascunho = ev.target.value;
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.target.id === 'tutor-texto' && ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      const id = document.getElementById('tutor-painel')?.dataset.id;
      if (id) perguntar(id, 'pergunta');
    }
  });
  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-tutor-enviar],[data-tutor-acao],[data-tutor-tirar],[data-tutor-cancelar],[data-tutor-nova],[data-tutor-avaliar],[data-tutor-fonte],[data-ir-gemini]');
    if (!b) return;
    if (b.dataset.irGemini !== undefined) {
      if (typeof S !== 'undefined') S.secAjustes = 'gemini';
      return;
    }
    if (b.dataset.tutorEnviar) return perguntar(b.dataset.tutorEnviar, 'pergunta');
    if (b.dataset.tutorAcao) return perguntar(b.dataset.id, b.dataset.tutorAcao);
    if (b.dataset.tutorTirar) {
      de(b.dataset.tutorTirar).trecho = null;
      return redesenhar(b.dataset.tutorTirar);
    }
    if (b.dataset.tutorCancelar) return de(b.dataset.tutorCancelar).controle?.abort();
    if (b.dataset.tutorNova) {
      const e = de(b.dataset.tutorNova);
      const antiga = e.conversaId;
      if (antiga) await historico.encerrar(antiga);
      e.conversaId = null;
      e.mensagens = [];
      e.erro = null;
      registrar('ui', 'tutor.nova_conversa');
      redesenhar(b.dataset.tutorNova);
      toast('Nova conversa. A anterior continua guardada no seu Drive.');
      window.rb?.memoriaUI?.procurarEmSegundoPlano({ todas: true });
      return;
    }
    if (b.dataset.tutorAvaliar) {
      const e = de(b.dataset.id);
      await historico.avaliar(e.conversaId, Number(b.dataset.i), b.dataset.tutorAvaliar);
      e.mensagens = await historico.mensagens(e.conversaId);
      return redesenhar(b.dataset.id);
    }
    if (b.dataset.tutorFonte) {
      const [lid, pag] = b.dataset.tutorFonte.split('|');
      const leitor = window.rb?.bibUI?.atual?.();
      if (leitor?.id === lid && pag) leitor.controle.irPara(Number(pag));
      else location.hash = `#leitor/${encodeURIComponent(lid)}`;
    }
  });

  return { painel, comTrecho, perguntar };
}
