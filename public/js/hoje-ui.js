// Tela Hoje com dados reais: um próximo passo claro (o protagonista), as tarefas do dia, a agenda de hoje e poucas outras coisas.
// Sem sequência de dias, sem cobrança: quando não há registro de ontem, a tela simplesmente não fala de ontem.
import { autorCurto } from './abnt.js';
import { FUNCOES } from './leitor-pdf.js';
import { proximoPasso, tambemHoje, diaLocal, diasAte } from './progresso.js';
import { ouvir } from './ui.js';

/* global I */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icone = (n) => (typeof I !== 'undefined' && I[n]) || '';
const seta = '<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>';

export function titulData(d = new Date()) {
  const s = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d).replace(/-feira/, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function criarHojeUI({ bib, fichUI, trilhasUI, argUI, conflitosUI, dados }) {
  /* ---------- Tarefas do dia: lista livre, gravada sozinha e sincronizada ---------- */
  let tarefas = [];
  async function carregar() {
    tarefas = dados ? (await dados.listar('tarefas')).sort((a, b) => (a.criadaEm || '').localeCompare(b.criadaEm || '')) : [];
  }
  /** O que aparece hoje: o que falta fazer (de qualquer dia) e o que foi feito hoje. */
  function tarefasDoDia(hoje = new Date()) {
    const dia = diaLocal(hoje);
    return tarefas.filter((t) => !t.feita || (t.feitaEm && diaLocal(new Date(t.feitaEm)) === dia));
  }
  async function adicionarTarefa(texto) {
    const limpo = String(texto || '').trim().slice(0, 200);
    if (!limpo) return null;
    const t = await dados.salvar('tarefas', { id: `tarefa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, texto: limpo, feita: false, criadaEm: new Date().toISOString() });
    tarefas.push(t);
    return t;
  }
  async function marcarTarefa(id, feita) {
    const i = tarefas.findIndex((t) => t.id === id);
    if (i < 0) return;
    tarefas[i] = await dados.salvar('tarefas', { ...tarefas[i], feita, feitaEm: feita ? new Date().toISOString() : null });
  }
  async function apagarTarefa(id) {
    const t = tarefas.find((x) => x.id === id);
    if (!t) return null;
    await dados.apagar('tarefas', id);
    tarefas = tarefas.filter((x) => x.id !== id);
    return async () => {
      tarefas.push(await dados.salvar('tarefas', t));
      tarefas.sort((a, b) => (a.criadaEm || '').localeCompare(b.criadaEm || ''));
    };
  }
  function tarefasHTML(hoje) {
    const lista = tarefasDoDia(hoje);
    const falta = lista.filter((t) => !t.feita).length;
    return `<section class="tarefas" aria-labelledby="tar-t"><h2 id="tar-t">Tarefas${falta ? ` <small>${falta === 1 ? 'falta 1' : `faltam ${falta}`}</small>` : ''}</h2>
      ${lista.length ? `<ul>${lista.map((t) => `<li class="${t.feita ? 'feita' : ''}"><label><input type="checkbox" data-tarefa-feita="${esc(t.id)}" ${t.feita ? 'checked' : ''}><span>${esc(t.texto)}</span></label><button class="btn fant mini" data-tarefa-apagar="${esc(t.id)}" aria-label="Apagar a tarefa: ${esc(t.texto)}">Apagar</button></li>`).join('')}</ul>` : '<p class="mute">Nada anotado para hoje.</p>'}
      <form class="tarefa-nova" data-tarefa-form><label class="sr" for="tarefa-nova">Nova tarefa</label><input id="tarefa-nova" type="text" maxlength="200" placeholder="Anotar uma tarefa" autocomplete="off"><button class="btn" type="submit" data-ocupado="Gravando…">Adicionar</button></form>
    </section>`;
  }

  /* ---------- O dia na agenda: compromissos de hoje (hora em negrito) e prazos (dia grande) ---------- */
  function agendaHTML(hoje) {
    const disc = window.rb?.disciplinas;
    if (!disc) return '';
    const hojeStr = diaLocal(hoje);
    const nomes = { aula: 'Aula', entrega: 'Entrega', estudo: 'Sessão de estudo', orientacao: 'Orientação', outro: 'Agenda' };
    const todos = disc.proximos(null, 7, hoje);
    const nomeDisc = (e) => disc.obter(e.disciplinaId)?.nome || '';
    const deHoje = todos.filter((e) => e.dia === hojeStr && e.tipo !== 'entrega').sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));
    const prazos = todos.filter((e) => e.tipo === 'entrega').slice(0, 3);
    const comp = deHoje.length
      ? `<section class="compromissos" aria-labelledby="comp-t"><h2 id="comp-t">Hoje</h2><ul>${deHoje.map((e) => `<li><a href="#disciplina/${encodeURIComponent(e.disciplinaId)}"><b class="hora">${esc(e.inicio || 'Dia todo')}</b><span>${esc(`${nomes[e.tipo] || 'Agenda'}: ${e.titulo}`)}<small>Hoje. ${esc(nomeDisc(e))}</small></span></a></li>`).join('')}</ul></section>`
      : '';
    const praz = prazos.length
      ? `<section class="prazos" aria-labelledby="praz-t"><h2 id="praz-t">Prazos</h2><ul>${prazos.map((e) => {
          const n = diasAte(e.dia, hoje);
          const quando = n === 0 ? 'Hoje' : n === 1 ? 'Amanhã' : `Em ${n} dias`;
          const [, , d] = e.dia.split('-');
          const mes = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(`${e.dia}T12:00:00`)).replace('.', '');
          return `<li><a href="#disciplina/${encodeURIComponent(e.disciplinaId)}"><span class="dia-g" aria-hidden="true">${Number(d)}<small>${esc(mes)}</small></span><span>${esc(`Entrega: ${e.titulo}`)}<small class="${n === 0 ? 'urg' : ''}">${quando}${e.inicio ? `, até ${esc(e.inicio)}` : ''}. ${esc(nomeDisc(e))}</small></span></a></li>`;
        }).join('')}</ul></section>`
      : '';
    return comp + praz;
  }

  /** Resumo de ontem, só com o que existe nos dados (grifos criados e fichamentos concluídos). */
  function ontem(hoje) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - 1);
    const dia = diaLocal(d);
    const doDia = (iso) => iso && diaLocal(new Date(iso)) === dia;
    const grifos = bib.todosGrifos().filter((g) => doDia(g.criadoEm)).length;
    const fichas = fichUI.todos().filter((f) => doDia(f.concluidoEm)).length;
    const partes = [];
    if (grifos) partes.push(`${grifos} ${grifos === 1 ? 'grifo' : 'grifos'}`);
    if (fichas) partes.push(`${fichas} ${fichas === 1 ? 'fichamento concluído' : 'fichamentos concluídos'}`);
    return partes.length ? `Ontem: ${partes.join(' e ')}.` : '';
  }

  function principalHTML(p) {
    if (p.vazio === 'biblioteca') {
      return `<section class="proximo" aria-labelledby="prox-t"><div class="rot" id="prox-t">Próximo passo</div>
        <h2 class="prox-tit">Adicione a primeira obra</h2>
        <p class="prox-txt">Comece pelo DOI ou pelo PDF de um artigo que você vai ler. O app monta a referência em ABNT e guarda o PDF no seu Drive.</p>
        <div class="acao-l"><button class="btn prim" data-bib="adicionar">${icone('mais')}Adicionar obra</button></div></section>`;
    }
    if (p.vazio === 'tudo-fichado') {
      return `<section class="proximo" aria-labelledby="prox-t"><div class="rot" id="prox-t">Próximo passo</div>
        <h2 class="prox-tit">Todas as obras estão fichadas</h2>
        <p class="prox-txt">Escolha a próxima leitura ou veja quais argumentos ainda dependem de uma única fonte.</p>
        <div class="acao-l"><button class="btn prim" data-bib="adicionar">${icone('mais')}Adicionar obra</button><a class="btn" href="#argumentos">Ver argumentos</a></div></section>`;
    }
    const l = p.leitura;
    const ultimo = bib
      .grifosDe(l.id)
      .slice()
      .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''))[0];
    const funcao = ultimo && FUNCOES.find((f) => f.id === ultimo.funcao);
    return `<section class="proximo" aria-labelledby="prox-t">
      <div class="rot" id="prox-t">Próximo passo: ${esc(p.motivo.charAt(0).toLowerCase() + p.motivo.slice(1))}</div>
      <h2 class="prox-tit">${esc(l.titulo)}</h2>
      <p class="prox-aut">${esc(autorCurto(l))}</p>
      ${ultimo && (l.etapa || 0) < 4 ? `<blockquote><mark class="${esc(ultimo.funcao)}">${esc(ultimo.texto)}</mark><small>Seu último grifo, p. ${ultimo.pagina}${funcao ? `, ${funcao.nome.toLowerCase()}` : ''}</small></blockquote>` : ''}
      <div class="acao-l"><a class="btn prim" href="${p.acao.href}">${p.acao.rotulo}</a>${p.acao.detalhe ? `<span>${esc(p.acao.detalhe)}</span>` : ''}</div>
    </section>`;
  }

  function tela(hoje = new Date()) {
    const leituras = bib.leituras();
    const dadosBase = { leituras, fichamentos: fichUI.todos(), trilhas: trilhasUI.todas(), hoje };
    const p = proximoPasso(dadosBase);
    let outros = p.leitura || p.vazio === 'tudo-fichado' ? tambemHoje({ ...dadosBase, principalId: p.leitura?.id }) : [];
    // Conflitos de sincronização entram primeiro: no celular, o rodapé com o status não aparece.
    const nConf = conflitosUI?.total() || 0;
    const nCart = window.rb?.cartoes?.paraHoje().length || 0;
    if (nCart) outros = [{ titulo: nCart === 1 ? 'Revisar 1 cartão' : `Revisar ${nCart} cartões`, detalhe: 'Leva poucos minutos', href: '#cartoes' }, ...outros].slice(0, 3);
    const org = window.rb?.organizar?.contagem();
    if (org && (org.propostas || org.repetidas)) {
      const partes = [org.propostas ? (org.propostas === 1 ? '1 DOI para conferir' : `${org.propostas} DOIs para conferir`) : null, org.repetidas ? (org.repetidas === 1 ? '1 obra repetida' : `${org.repetidas} obras repetidas`) : null].filter(Boolean);
      outros = [{ titulo: 'Organizar a biblioteca', detalhe: partes.join(', '), href: '#acervo' }, ...outros].slice(0, 3);
    }
    const nMem = window.rb?.memoriaUI?.pendentes().length || 0;
    if (nMem) outros = [{ titulo: nMem === 1 ? 'Revisar 1 item para a memória' : `Revisar ${nMem} itens para a memória`, detalhe: 'A IA propôs a partir das suas conversas', href: '#memoria' }, ...outros].slice(0, 3);
    if (nConf) outros = [{ titulo: nConf === 1 ? 'Revisar 1 conflito de sincronização' : `Revisar ${nConf} conflitos de sincronização`, detalhe: 'O mesmo item mudou em dois aparelhos', href: '#conflitos' }, ...outros].slice(0, 3);
    const resumo = ontem(hoje);
    const lado =
      agendaHTML(hoje) +
      (outros.length
        ? `<aside class="tambem" aria-labelledby="tamb-t"><h2 id="tamb-t">Também para hoje</h2>${outros
            .map((o) => `<a href="${o.href}"><b>${esc(o.titulo)}</b>${o.detalhe ? `<span class="${o.urgente ? 'urg' : ''}">${esc(o.detalhe)}</span>` : ''}${seta}</a>`)
            .join('')}</aside>`
        : '');
    return `
    <div class="topo"><div><h1>${titulData(hoje)}</h1><div class="so-celular status-hoje"><span id="status-hoje">${typeof window.statusDriveHTML === 'function' ? window.statusDriveHTML() : ''}</span><button class="btn fant mini" data-google="sincronizar">Sincronizar agora</button></div>${resumo ? `<p>${resumo}</p>` : ''}</div></div>
    <div class="hoje-grid ${lado ? '' : 'so-um'}">
      <div class="hoje-col">
        ${principalHTML(p)}
        ${dados ? tarefasHTML(hoje) : ''}
      </div>
      ${lado ? `<div class="hoje-col">${lado}</div>` : ''}
    </div>`;
  }

  /* ---------- Eventos das tarefas: tudo é gravado antes de a tela mudar ---------- */
  const redesenhar = (focar = false) => {
    if (!/^#(painel)?$/.test(location.hash || '#')) return;
    window.render?.();
    if (focar) document.getElementById('tarefa-nova')?.focus();
  };
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-tarefa-form]');
    if (!f) return;
    e.preventDefault();
    const campo = f.querySelector('input');
    const botao = f.querySelector('button');
    if (!campo.value.trim()) return campo.focus();
    botao.disabled = true;
    try {
      await adicionarTarefa(campo.value);
      redesenhar(true);
    } finally {
      botao.disabled = false;
    }
  });
  document.addEventListener('change', async (e) => {
    const c = e.target.closest('[data-tarefa-feita]');
    if (!c) return;
    c.disabled = true;
    await marcarTarefa(c.dataset.tarefaFeita, c.checked);
    redesenhar();
  });
  ouvir('click', async (e) => {
    const b = e.target.closest('[data-tarefa-apagar]');
    if (!b) return;
    const desfazer = await apagarTarefa(b.dataset.tarefaApagar);
    redesenhar();
    if (desfazer) window.toast?.('Tarefa apagada. Ela fica na lixeira.', async () => { await desfazer(); redesenhar(); });
  });

  return { tela, carregar, tarefas: () => tarefas, adicionarTarefa, marcarTarefa };
}
