// Dissertação, Visão (v2.5.0): a tese em uma frase, a sessão de hoje, o plano da semana, os capítulos e os
// combinados da orientação. Também desenha a sessão de escrita dentro do editor: só o texto, um relógio discreto
// e, ao encerrar, o que foi feito e a frase onde o autor parou. A tela não sugere o que escrever e não chama a IA.
import { medirAutoria, blocos, contarPalavras } from './escrita.js';
import { ultimasPalavras, andamento } from './sessoes.js';
import { diaLocal, diasAte } from './progresso.js';
import { ouvir } from './ui.js';

/* global toast */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const milhar = (n) => n.toLocaleString('pt-BR');
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const dataLonga = (dia) => new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
const nomeCap = (t) => (t.capitulo ? `Capítulo ${t.capitulo}, ${t.titulo}` : t.titulo);

export function criarVisaoUI({ sess, escrita, diss, disc, registrar }) {
  const est = { escolher: false, mudarPlano: false, mudarInicio: false, marcar: false };
  const naVisao = () => /^#(dissertacao|jornada)/.test(location.hash);
  const redesenhar = () => naVisao() && window.render?.();
  const veu = () => document.getElementById('veu');
  const abrirModal = (html) => {
    veu().innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-tit">${html}</div>`;
    veu().classList.add('on');
    veu().querySelector('button')?.focus();
  };
  const fechar = () => veu().classList.remove('on');

  function palavrasDe(t) {
    const a = medirAutoria(t);
    return { total: a.total, suas: a.total * (1 - a.participacao / 100) };
  }
  function situacao(t) {
    const secoes = t.secoes || [];
    const comTexto = secoes.filter((s) => contarPalavras(blocos(s.html).map((b) => b.texto).join(' '))).length;
    if (!comTexto) return 'Não começado';
    return secoes.length > 1 ? `Em escrita. ${comTexto} de ${plural(secoes.length, 'seção', 'seções')} com texto` : 'Em escrita';
  }

  /* ---------- Painel: a sessão de hoje ---------- */
  function painelSessao() {
    const { plano } = sess.config();
    const semana = sess.daSemana();
    const ativa = sess.ativa();
    const caps = sess.capitulos();
    if (ativa) {
      const t = escrita.obter(ativa.textoId);
      return `<section class="proximo diss-sessao" aria-labelledby="ds-t"><div class="rot" id="ds-t">Sessão em curso</div><h2>${esc(nomeCap(t))}</h2>
        <div class="acao-l"><a class="btn prim" href="#texto/${encodeURIComponent(t.id)}">Voltar ao texto</a></div></section>`;
    }
    if (!caps.length) {
      return `<section class="proximo diss-sessao" aria-labelledby="ds-t"><div class="rot" id="ds-t">Comece pelo primeiro capítulo</div>
        <p>Os capítulos são textos do Escrever, guardados no projeto Dissertação. Cada sessão de escrita acontece dentro de um deles.</p>
        <div class="acao-l"><button class="btn prim" data-diss-novo-cap>Criar o primeiro capítulo</button></div></section>`;
    }
    const onde = sess.ondeParou();
    const t = onde.texto;
    const rot = semana.length < plano.sessoes ? `Sessão de hoje, a ${semana.length + 1}ª de ${plano.sessoes} desta semana` : `Plano da semana cumprido, com ${plural(semana.length, 'sessão', 'sessões')}`;
    const total = palavrasDe(t).total;
    const parou = onde.sessao?.frase ? `Onde você parou: “${esc(onde.sessao.frase)}”` : total ? `${plural(total, 'palavra', 'palavras')} até aqui.` : 'Ainda vazio.';
    const outros = caps.filter((c) => c.id !== t.id);
    return `<section class="proximo diss-sessao" aria-labelledby="ds-t"><div class="rot" id="ds-t">${rot}</div><h2>${esc(nomeCap(t))}</h2><p>${parou}</p>
      <div class="acao-l"><button class="btn prim" data-diss-sessao="${esc(t.id)}">Escrever por ${plano.minutos} minutos</button>${outros.length ? `<button class="btn fant" data-diss-escolher aria-expanded="${est.escolher}">Escolher outro capítulo</button>` : ''}</div>
      ${est.escolher && outros.length ? `<ul class="diss-outros">${outros.map((c) => `<li><button class="btn" data-diss-sessao="${esc(c.id)}">${esc(nomeCap(c))}</button></li>`).join('')}</ul>` : ''}</section>`;
  }

  /* ---------- Sessões marcadas na agenda: um compromisso com ele mesmo, que aparece no Hoje ---------- */
  // São eventos da dissertação (os mesmos da agenda do app), marcados com sessaoEscrita. Se a agenda do Google
  // estiver ligada, vão para lá como os outros eventos.
  const marcadas = () => disc.proximos('dissertacao', 60).filter((e) => e.sessaoEscrita);
  function marcadasHTML(plano) {
    const ms = marcadas();
    const hoje = diaLocal();
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const noGoogle = window.rb?.agenda?.estado().ligada;
    return `${ms.length ? `<ul class="linha-l diss-marcadas">${ms.map((e) => `<li><span class="quando">${e.dia === hoje ? 'Hoje' : DIAS[new Date(`${e.dia}T12:00:00`).getDay()]}</span><span>Marcada para ${esc(e.inicio || '')}<small>${e.dia === hoje ? '' : `${dataLonga(e.dia)}. `}${noGoogle ? 'Está no Hoje e na agenda researchbook do Google.' : 'Aparece no Hoje.'}</small></span><button class="btn fant" data-diss-desmarcar="${esc(e.id)}" aria-label="Desmarcar a sessão de ${dataLonga(e.dia)}">Desmarcar</button></li>`).join('')}</ul>` : ''}
      ${est.marcar ? `<form class="diss-marcar" id="sessao-form"><div class="campo"><label for="ss-dia">Dia</label><input id="ss-dia" type="date" required min="${hoje}" value="${diaLocal(amanha)}"></div><div class="campo"><label for="ss-hora">Hora</label><input id="ss-hora" type="time" required value="07:30"></div><button class="btn" type="submit">Marcar ${plano.minutos} minutos</button></form>` : `<p class="diss-marcar-l"><button class="lnk" data-diss-marcar>Marcar uma sessão na agenda</button></p>`}`;
  }

  /* ---------- Tela ---------- */
  function tela() {
    const { tese, plano } = sess.config();
    const semana = sess.daSemana();
    const caps = sess.capitulos();
    const somas = caps.map(palavrasDe);
    const total = somas.reduce((n, p) => n + p.total, 0);
    const suas = somas.reduce((n, p) => n + p.suas, 0);
    const proximo = disc.proximos('dissertacao', 120).find((e) => e.tipo === 'orientacao');
    const combinados = diss.combinadosAbertos();
    return `<div class="topo"><div><h1>Dissertação</h1></div></div>
      <section class="tese" aria-label="A sua tese">
        <textarea id="diss-tese" class="tese-campo" rows="2" aria-describedby="tese-d" data-diss-tese placeholder="Escreva aqui a sua tese, em uma frase.">${esc(tese)}</textarea>
        <p class="t-meta mute" id="tese-d">A sua tese, em uma frase. <span id="tese-st" role="status"></span></p>
      </section>
      ${painelSessao()}
      <div class="proj-cols">
        <div class="proj-col">
          <section class="proj-sec" aria-labelledby="dv-sem"><h2 id="dv-sem">Esta semana</h2>
            <p class="diss-plano">Seu plano: ${plural(plano.sessoes, 'sessão', 'sessões')} de ${plano.minutos} minutos. <button class="lnk" data-diss-plano aria-expanded="${est.mudarPlano}">Mudar o plano</button></p>
            ${est.mudarPlano ? `<div class="linha2 diss-plano-campos">
              <div class="campo"><label for="pl-sessoes">Sessões por semana</label><select id="pl-sessoes" data-diss-plano-campo="sessoes">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option ${n === plano.sessoes ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
              <div class="campo"><label for="pl-minutos">Minutos por sessão</label><select id="pl-minutos" data-diss-plano-campo="minutos">${[15, 25, 40, 50].map((n) => `<option ${n === plano.minutos ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>` : ''}
            ${marcadasHTML(plano)}
            ${semana.length ? `<ul class="linha-l">${semana.map((s) => `<li><span class="quando">${DIAS[new Date(s.inicio).getDay()]}</span><span>${s.minutos} min${s.palavras > 0 ? `, ${plural(s.palavras, 'palavra', 'palavras')}` : ''}<small>${esc(s.capitulo ? `Capítulo ${s.capitulo}, ${s.titulo}` : s.titulo)}</small></span></li>`).join('')}</ul>` : marcadas().length ? '' : '<p class="mute">Nenhuma sessão nesta semana ainda.</p>'}
            <p class="t-meta mute linha-nota">Uma semana sem sessão não apaga nada. O plano recomeça na segunda.</p>
          </section>
          <section class="proj-sec" aria-labelledby="dv-ori"><h2 id="dv-ori">Com a orientação <a class="lnk-sec" href="#orientacao">Abrir a orientação</a></h2>
            ${proximo ? `<p>Próximo encontro em ${dataLonga(proximo.dia)}${proximo.inicio ? `, às ${esc(proximo.inicio)}` : ''}.</p>` : ''}
            ${combinados.length ? `<ul class="notas-d">${combinados.slice(0, 5).map((c) => `<li><span>${esc(c.acao || c.tarefa || '')}</span></li>`).join('')}</ul><p class="t-meta mute linha-nota">Combinados em aberto dos encontros registrados.</p>` : '<p class="mute">Nenhum combinado em aberto.</p>'}
          </section>
        </div>
        <div class="proj-col">
          <section class="proj-sec" aria-labelledby="dv-cap"><h2 id="dv-cap">Capítulos ${caps.length ? '<button class="lnk-sec" data-diss-novo-cap>Novo capítulo</button>' : ''}</h2>
            ${caps.length ? `<p class="t-meta mute">${plural(total, 'palavra', 'palavras').replace(String(total), milhar(total))}${total ? `, ${Math.round((suas / total) * 100)}% suas` : ''}</p>
            <ol class="diss-caps">${caps.map((c, i) => `<li><a href="#texto/${encodeURIComponent(c.id)}"><span class="n" aria-hidden="true">${c.capitulo || i + 1}</span><span class="nome"><b>${esc(c.titulo)}</b><small>${situacao(c)}</small></span><span class="meta">${somas[i].total ? plural(somas[i].total, 'palavra', 'palavras').replace(String(somas[i].total), milhar(somas[i].total)) : 'ainda vazio'}</span></a></li>`).join('')}</ol>` : '<p class="mute">Nenhum capítulo ainda.</p>'}
          </section>
        </div>
      </div>`;
  }

  /* ---------- Jornada do mestrado: o prazo, o próximo marco e os marcos ---------- */
  const MESES_N = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const mesAno = (dia) => `${MESES_N[Number(dia.split('-')[1]) - 1]} de ${dia.split('-')[0]}`;
  const dataCurta = (dia) => new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '').replace(/ de /g, ' ');
  function camposInicio(c) {
    const [a, m] = c.inicio ? c.inicio.split('-').map(Number) : [new Date().getFullYear(), 0];
    const anoAtual = new Date().getFullYear();
    return `<div class="linha2 jor-campos">
      <div class="campo"><label for="jor-mes">Mês em que começou</label><select id="jor-mes" data-diss-inicio><option value="">Escolha</option>${MESES_N.map((n, i) => `<option value="${i + 1}" ${m === i + 1 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="campo"><label for="jor-ano">Ano</label><select id="jor-ano" data-diss-inicio>${[0, 1, 2, 3, 4, 5].map((k) => `<option ${anoAtual - k === a ? 'selected' : ''}>${anoAtual - k}</option>`).join('')}</select></div>
      <div class="campo"><label for="jor-meses">Prazo, em meses</label><select id="jor-meses" data-diss-inicio>${[12, 18, 24, 30, 36, 48].map((n) => `<option ${n === c.meses ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>`;
  }
  /** Marcos escritos por ele mais os que o app conhece pelos dados: início, versões do projeto enviadas e fim do prazo. */
  function marcosDe(c, anda) {
    const lista = c.marcos.map((m) => ({ ...m, seu: true }));
    if (anda) {
      lista.push({ id: 'inicio', titulo: 'Início do mestrado', data: anda.de, soMes: true });
      lista.push({ id: 'fim', titulo: 'Fim do prazo', data: anda.ate, soMes: true });
    }
    for (const r of diss.todasRevisoes()) if (r.enviadoEm) lista.push({ id: r.id, titulo: `Projeto, versão ${r.versao}`, data: diaLocal(new Date(r.enviadoEm)), nota: 'Enviado para revisão no app', href: '#projeto' });
    return lista.sort((a, b) => b.data.localeCompare(a.data));
  }
  function jornada() {
    const c = sess.config();
    const anda = andamento(c.inicio, c.meses);
    const hoje = diaLocal();
    const cab = '<div class="topo"><div><h1>Jornada</h1></div></div>';
    if (!anda) {
      return `${cab}<section class="proximo jor-comeco" aria-labelledby="jc-t"><div class="rot" id="jc-t">Quando o mestrado começou?</div>
        <p>Com o mês de início e o prazo, esta página mostra em que ponto você está e quanto falta para cada marco. É salvo assim que você escolhe.</p>${camposInicio(c)}</section>`;
    }
    const marcos = marcosDe(c, anda);
    const proximo = [...marcos].reverse().find((m) => m.seu && m.data >= hoje);
    const caps = sess.capitulos();
    const somas = caps.map(palavrasDe);
    const palavras = somas.reduce((n, p) => n + p.total, 0);
    const comTexto = somas.filter((p) => p.total).length;
    const versao = diss.todasRevisoes()[0];
    const combinados = diss.combinadosAbertos().length;
    const fatos = [
      versao ? `Projeto, versão ${versao.versao}<small>Enviado em ${dataLonga(diaLocal(new Date(versao.enviadoEm)))}</small>` : 'Projeto ainda não enviado para revisão<small>O envio fica na página Projeto</small>',
      caps.length ? `${milhar(palavras)} ${palavras === 1 ? 'palavra' : 'palavras'} nos capítulos<small>${comTexto} de ${plural(caps.length, 'capítulo', 'capítulos')} com texto</small>` : 'Nenhum capítulo começado<small>Os capítulos ficam na Visão</small>',
      `${combinados ? plural(combinados, 'combinado', 'combinados') : 'Nenhum combinado'} em aberto com a orientação`,
    ];
    const posicao = (dia) => Math.round(Math.min(1, Math.max(0, (new Date(`${dia}T12:00:00`) - new Date(`${anda.de}T00:00:00`)) / (new Date(`${anda.ate}T23:59:59`) - new Date(`${anda.de}T00:00:00`)))) * 1000) / 10;
    const onde = !anda.comecou ? `Começa em ${mesAno(anda.de)}.` : anda.acabou ? 'O prazo já passou.' : `Você está no mês ${anda.mes} de ${c.meses}.`;
    return `${cab}
      <section class="jor-regua" aria-label="Prazo do mestrado">
        <p class="jor-frase">De ${mesAno(anda.de)} a ${mesAno(anda.ate)}. ${onde} <button class="lnk" data-diss-mudar-inicio aria-expanded="${est.mudarInicio}">Mudar o prazo</button></p>
        ${est.mudarInicio ? camposInicio(c) : ''}
        <div class="regua" role="img" aria-label="${anda.comecou ? `Mês ${anda.mes} de ${c.meses}` : 'Ainda não começou'}"><i style="width:${Math.round(anda.fracao * 1000) / 10}%"></i>${c.marcos.map((m) => `<span class="marca ${m.data < hoje ? 'passou' : ''}" style="left:${posicao(m.data)}%" title="${esc(m.titulo)}, ${dataCurta(m.data)}"></span>`).join('')}</div>
        <div class="regua-pontas"><span>${mesAno(anda.de)}</span><span>${mesAno(anda.ate)}</span></div>
      </section>
      ${proximo ? `<section class="proximo jor-proximo" aria-labelledby="jp-t"><div class="rot" id="jp-t">Próximo marco, ${diasAte(proximo.data) === 0 ? 'hoje' : diasAte(proximo.data) === 1 ? 'amanhã' : `em ${diasAte(proximo.data)} dias`}</div>
        <h2>${esc(proximo.titulo)}, ${dataLonga(proximo.data)}</h2>
        <ul class="jor-fatos">${fatos.map((f) => `<li>${f}</li>`).join('')}</ul>
        <div class="acao-l"><a class="btn prim" href="#projeto">Abrir o projeto</a></div></section>` : ''}
      <section class="proj-sec jor-marcos" aria-labelledby="jm-t"><h2 id="jm-t">Marcos</h2>
        <form class="jor-novo" id="marco-form"><input id="marco-titulo" aria-label="Novo marco" placeholder="Qualificação, defesa, entrega de capítulo…" required autocomplete="off"><input id="marco-data" type="date" aria-label="Data do marco" required><button class="btn" type="submit">Adicionar marco</button></form>
        <ul class="linha-l">${marcos.map((m) => {
          const n = diasAte(m.data);
          const nota = m.nota || (m.seu && n >= 0 ? (n === 0 ? 'Hoje' : n === 1 ? 'Amanhã' : `Em ${n} dias`) : '');
          return `<li class="${m.data < hoje ? 'passou' : ''}"><span class="quando">${m.soMes ? mesAno(m.data).replace(' de ', ' ') : dataCurta(m.data)}</span><span>${m.href ? `<a href="${m.href}">${esc(m.titulo)}</a>` : esc(m.titulo)}${nota ? `<small>${nota}</small>` : ''}</span>${m.seu ? `<button class="btn fant mini" data-diss-marco-apagar="${esc(m.id)}" aria-label="Apagar o marco ${esc(m.titulo)}">Apagar</button>` : ''}</li>`;
        }).join('')}</ul>
      </section>`;
  }

  /* ---------- Sessão de escrita, dentro do editor ---------- */
  const sessaoDe = (textoId) => {
    const s = sess.ativa();
    return s && s.textoId === textoId ? s : null;
  };
  function barraSessao(t) {
    if (!sessaoDe(t.id)) return '';
    const secoes = t.secoes || [];
    const aberta = window.rb.escritaUI?.secaoAberta?.(t) ?? 0;
    // Com mais de uma seção, a troca fica na própria barra: a lista lateral some durante a sessão.
    const troca = secoes.length > 1 ? `<select class="sessao-secao" aria-label="Seção" data-diss-secao="${esc(t.id)}">${secoes.map((s, i) => `<option value="${i}" ${i === aberta ? 'selected' : ''}>${esc(s.titulo)}</option>`).join('')}</select>` : '';
    return `<div class="sessao-barra" role="group" aria-label="Sessão de escrita"><span class="sessao-tit">${esc(nomeCap(t))}</span>${troca}
      <span class="sessao-relogio" id="sessao-relogio" aria-label="Tempo de sessão">0:00</span><span class="t-meta mute" id="sessao-palavras"></span><span class="t-meta mute" id="sessao-st" role="status"></span>
      <button class="btn" data-diss-encerrar>Encerrar sessão</button></div>`;
  }
  let relogio = null;
  function atualizarRelogio() {
    const id = decodeURIComponent(location.hash.split('/')[1] || '');
    const s = sessaoDe(id);
    const el = document.getElementById('sessao-relogio');
    if (!s || !el) return;
    const seg = Math.max(0, Math.floor((Date.now() - s.inicio) / 1000));
    el.textContent = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
    const n = medirAutoria(escrita.obter(id)).total - s.palavras0;
    document.getElementById('sessao-palavras').textContent = n >= 0 ? `${plural(n, 'palavra', 'palavras')} nesta sessão` : `texto ${plural(-n, 'palavra', 'palavras')} menor`;
    const st = document.getElementById('sessao-st');
    const cumprido = seg >= s.minutos * 60 ? `Os ${s.minutos} minutos do plano passaram. Encerre quando quiser.` : '';
    if (st.textContent !== cumprido) st.textContent = cumprido;
  }
  document.addEventListener('rb:render', () => {
    const [rota, arg] = location.hash.slice(1).split('/');
    const emSessao = rota === 'texto' && !!sessaoDe(decodeURIComponent(arg || '')) && !!document.getElementById('esc-corpo');
    document.body.classList.toggle('sessao', emSessao);
    clearInterval(relogio);
    if (emSessao) {
      atualizarRelogio();
      relogio = setInterval(atualizarRelogio, 1000);
    }
    const tese = document.getElementById('diss-tese');
    if (tese) tese.style.height = `${tese.scrollHeight}px`;
  });

  /** O trecho onde o autor parou: até o cursor, no bloco em que ele está; sem cursor no texto, o último bloco com texto. */
  function ondeEstaOCursor() {
    const corpo = document.getElementById('esc-corpo');
    if (!corpo) return '';
    const sel = getSelection();
    if (sel.rangeCount && corpo.contains(sel.anchorNode)) {
      const r = document.createRange();
      r.selectNodeContents(corpo);
      r.setEnd(sel.focusNode, sel.focusOffset);
      // O que a tela desenha dentro de uma figura (número, botões) não é texto do autor.
      const ate = r.cloneContents();
      for (const f of ate.querySelectorAll('figure')) f.remove();
      const antes = ultimasPalavras(ate.textContent);
      if (antes) return antes;
    }
    const comTexto = [...corpo.children].filter((b) => b.tagName !== 'FIGURE' && b.textContent.trim());
    return ultimasPalavras(comTexto.at(-1)?.textContent || '');
  }

  async function encerrar() {
    const frase = ondeEstaOCursor();
    const secao = document.querySelector('[data-esc-sec-titulo]')?.value || '';
    await window.rb.escritaUI?.salvarAgora?.();
    const reg = await sess.encerrar({ frase, secao });
    window.render?.();
    if (!reg || reg.descartada) return toast('Sessão encerrada sem registro: durou menos de um minuto.');
    const { plano } = sess.config();
    const feitas = sess.daSemana().length;
    const palavras = reg.palavras > 0 ? `, ${plural(reg.palavras, 'palavra', 'palavras')}` : reg.palavras < 0 ? `, texto ${plural(-reg.palavras, 'palavra', 'palavras')} menor` : '';
    abrirModal(`<h2 id="modal-tit">Sessão concluída</h2>
      <p class="sessao-resumo">${plural(reg.minutos, 'minuto', 'minutos')}${palavras}.</p>
      ${reg.frase ? `<p>Onde você parou: “${esc(reg.frase)}”. A próxima sessão começa dali.</p>` : ''}
      <p class="t-meta mute">${feitas >= plano.sessoes ? `Plano da semana cumprido: ${plural(feitas, 'sessão', 'sessões')}.` : `${feitas} de ${plural(plano.sessoes, 'sessão', 'sessões')} do plano desta semana.`}</p>
      <div class="pe"><span class="cresce"></span><button class="btn fant" data-diss-continuar>Continuar escrevendo</button><a class="btn prim" href="#dissertacao" data-diss-continuar>Voltar à dissertação</a></div>`);
  }

  /* ---------- Ações ---------- */
  let teseTimer = null;
  const gravarTese = async () => {
    clearTimeout(teseTimer);
    const campo = document.getElementById('diss-tese');
    if (!campo || campo.value.trim() === sess.config().tese) return;
    await sess.salvarConfig({ tese: campo.value.trim() });
    const st = document.getElementById('tese-st');
    if (st) st.textContent = 'Salva.';
  };
  document.addEventListener('input', (e) => {
    if (e.target.dataset?.dissTese === undefined) return;
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
    const st = document.getElementById('tese-st');
    if (st) st.textContent = 'Salvando…';
    clearTimeout(teseTimer);
    teseTimer = setTimeout(gravarTese, 600);
  });
  document.addEventListener('focusout', (e) => e.target.dataset?.dissTese !== undefined && gravarTese());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && gravarTese());
  document.addEventListener('change', async (e) => {
    if (e.target.dataset?.dissInicio !== undefined) {
      const mes = Number(document.getElementById('jor-mes').value);
      if (!mes) return;
      const foco = e.target.id;
      await sess.salvarConfig({ inicio: `${document.getElementById('jor-ano').value}-${String(mes).padStart(2, '0')}`, meses: Number(document.getElementById('jor-meses').value) });
      registrar('ui', 'dissertacao.inicio');
      est.mudarInicio = true;
      redesenhar();
      return document.getElementById(foco)?.focus();
    }
    if (e.target.dataset?.dissSecao) {
      await window.rb.escritaUI?.salvarAgora?.();
      window.rb.escritaUI?.abrirSecao?.(e.target.dataset.dissSecao, Number(e.target.value));
      return window.render?.();
    }
    const campo = e.target.dataset?.dissPlanoCampo;
    if (!campo) return;
    const { plano } = sess.config();
    await sess.salvarConfig({ plano: { ...plano, [campo]: Number(e.target.value) } });
    registrar('ui', 'dissertacao.plano');
    redesenhar();
    document.getElementById(`pl-${campo}`)?.focus();
  });

  ouvir('submit', async (e) => {
    if (e.target.id === 'sessao-form') {
      e.preventDefault();
      const dia = document.getElementById('ss-dia').value;
      const hora = document.getElementById('ss-hora').value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !/^\d{2}:\d{2}$/.test(hora)) return toast('Escolha o dia e a hora.');
      const { plano } = sess.config();
      const [h, m] = hora.split(':').map(Number);
      const fimMin = Math.min(23 * 60 + 59, h * 60 + m + plano.minutos);
      await disc.salvarEvento({ disciplinaId: 'dissertacao', tipo: 'estudo', titulo: 'Sessão de escrita', data: dia, inicio: hora, fim: `${String(Math.floor(fimMin / 60)).padStart(2, '0')}:${String(fimMin % 60).padStart(2, '0')}`, sessaoEscrita: true });
      est.marcar = false;
      redesenhar();
      return toast('Sessão marcada. Ela aparece no Hoje nesse dia.');
    }
    if (e.target.id !== 'marco-form') return;
    e.preventDefault();
    const titulo = document.getElementById('marco-titulo').value.trim();
    const data = document.getElementById('marco-data').value;
    if (!titulo || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return toast('Escreva o marco e escolha a data.');
    await sess.salvarConfig({ marcos: [...sess.config().marcos, { id: `marco-${crypto.randomUUID().slice(0, 8)}`, titulo, data }] });
    registrar('ui', 'dissertacao.marco');
    redesenhar();
    toast('Marco salvo');
  });

  ouvir('click', async (e) => {
    const b = e.target.closest('[data-diss-marcar],[data-diss-desmarcar],[data-diss-mudar-inicio],[data-diss-marco-apagar],[data-diss-sessao],[data-diss-escolher],[data-diss-plano],[data-diss-novo-cap],[data-diss-encerrar],[data-diss-continuar]');
    if (!b) return;
    const d = b.dataset;
    if (d.dissMarcar !== undefined) {
      est.marcar = true;
      redesenhar();
      return document.getElementById('ss-dia')?.focus();
    }
    if (d.dissDesmarcar) {
      const desfazer = await disc.apagarEvento(d.dissDesmarcar);
      redesenhar();
      return toast('Sessão desmarcada', async () => {
        await desfazer();
        redesenhar();
      });
    }
    if (d.dissMudarInicio !== undefined) {
      est.mudarInicio = !est.mudarInicio;
      return redesenhar();
    }
    if (d.dissMarcoApagar) {
      const antes = sess.config().marcos;
      await sess.salvarConfig({ marcos: antes.filter((m) => m.id !== d.dissMarcoApagar) });
      redesenhar();
      return toast('Marco apagado', async () => {
        await sess.salvarConfig({ marcos: antes });
        redesenhar();
      });
    }
    if (d.dissEscolher !== undefined) {
      est.escolher = !est.escolher;
      return redesenhar();
    }
    if (d.dissPlano !== undefined) {
      est.mudarPlano = !est.mudarPlano;
      return redesenhar();
    }
    if (d.dissNovoCap !== undefined) {
      const t = await sess.novoCapitulo();
      location.hash = `#texto/${encodeURIComponent(t.id)}`;
      return setTimeout(() => toast('Capítulo criado. Dê um nome a ele no Briefing.'), 60);
    }
    if (d.dissSessao) {
      await gravarTese();
      est.escolher = false;
      // A sessão acontece no editor. Texto ainda em preparação ou já em revisão abre na etapa em que está.
      if (escrita.obter(d.dissSessao)?.passo !== 4) {
        location.hash = `#texto/${encodeURIComponent(d.dissSessao)}`;
        return setTimeout(() => toast('Este texto não está na etapa de escrita. A sessão começa quando ele estiver no editor.'), 60);
      }
      if (!sess.iniciar(d.dissSessao)) return toast('Não deu para começar a sessão neste aparelho.');
      // Abre na seção em que a última sessão deste capítulo terminou.
      const ultima = sess.todas().find((s) => s.textoId === d.dissSessao && s.secao);
      const i = ultima ? escrita.obter(d.dissSessao).secoes.findIndex((s) => s.titulo === ultima.secao) : -1;
      if (i >= 0) window.rb.escritaUI?.abrirSecao?.(d.dissSessao, i);
      location.hash = `#texto/${encodeURIComponent(d.dissSessao)}`;
      return;
    }
    if (d.dissEncerrar !== undefined) return encerrar();
    if (d.dissContinuar !== undefined) return fechar();
  });

  return { tela, jornada, barraSessao };
}
