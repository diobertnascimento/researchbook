// Telas da Dissertação (Revisão do projeto, Orientação) e dos Diálogos, com dados reais.
import { FORMATOS, FUNCOES_OBRA, TIPOS_PROBLEMA, DISSERTACAO } from './dissertacao.js';
import { MODOS } from './dialogos.js';
import { pipsHTML, ETAPAS, diaLocal, dataCurta } from './progresso.js';
import { citacao } from './abnt.js';
import { ErroIA } from './gemini.js';

/* global I, toast, S */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icone = (n) => (typeof I !== 'undefined' && I[n]) || '';
const ERROS_DE_CONFIG = ['sem-acesso', 'permissao', 'projeto', 'trancado', 'chave', 'api', 'negado', 'sessao'];
const MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const dataLonga = (d) => {
  if (!d) return '';
  const [a, m, dia] = d.split('-').map(Number);
  return `${dia} ${MESES[m - 1]} ${a}`;
};
const prio = (n) => `<span class="prio" aria-label="Prioridade ${['', 'baixa', 'média', 'alta'][n]}">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
const tirarIds = (s) => String(s || '').replace(/\s*\[A\d+\]/g, '');

export function criarDissertacaoUI({ diss, dlg, disc, discUI, bib, registrar }) {
  const est = { rev: null, msgs: {}, carregando: new Set(), ocupado: null, erro: null, tipoReg: 'anotacao', abertos: new Set() };
  const redesenhar = () => /^#(projeto|orientacao|dialogos)/.test(location.hash) && window.render?.();
  const veu = () => document.getElementById('veu');
  const abrirModal = (html) => {
    veu().innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-tit">${html}</div>`;
    veu().classList.add('on');
    (veu().querySelector('textarea') || veu().querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select'))?.focus();
  };
  const fechar = () => veu().classList.remove('on');
  const erroHTML = (err) => {
    const config = err instanceof ErroIA ? ERROS_DE_CONFIG.includes(err.codigo) : ERROS_DE_CONFIG.includes(err?.codigo);
    return `<div class="erro-ia" role="alert"><p>${esc(err?.message || err?.mensagem || 'O Gemini não respondeu.')}</p>${config ? '<a class="btn" href="#ajustes">Abrir Ajustes do Gemini</a>' : ''}</div>`;
  };

  /* =================== Revisão do projeto =================== */
  function projeto() {
    const revs = diss.todasRevisoes();
    const topo = `<div class="topo"><div><h1>Revisão do projeto</h1><p>Envie a versão atual da dissertação em PDF. A IA lê as obras que você cita e monta uma lista por prioridade de leitura, com os problemas de citação.</p></div>
      <div class="acoes"><label class="btn prim">${icone('upload')}${revs.length ? 'Enviar nova versão' : 'Enviar a versão atual'}<input type="file" accept="application/pdf" data-rev-pdf hidden></label></div></div>`;
    if (!revs.length) return `${topo}<div class="bib-vazia"><h2>Nenhuma versão enviada</h2><p>A cada versão, a revisão compara com a anterior: obras novas, removidas e problemas resolvidos. O PDF fica no seu Drive (dissertacao/versoes).</p></div>`;
    const r = (est.rev && diss.revisao(est.rev)) || revs[0];
    const res = r.resultado;
    const linha = (o, i) => {
      const l = o.leituraId && bib.obter(o.leituraId);
      const buscando = (r.buscar || []).includes(i);
      const st = l
        ? `<span>Na biblioteca</span>${pipsHTML(l.etapa || 0)}<span>${ETAPAS[l.etapa || 0]}</span><a class="btn fant" href="#leitor/${encodeURIComponent(l.id)}">Abrir</a>`
        : `<span class="fora">Fora da biblioteca</span>${buscando ? '<span>Na lista para buscar</span>' : `<button class="btn" data-rev-buscar="${i}">Vou buscar</button>`}`;
      return `<div class="ref-linha"><div><div class="t">${esc(l ? l.titulo : o.como_aparece)}</div><div class="a">${esc(l ? citacao(l) : o.como_aparece)}${o.incompleta ? '. Referência incompleta no texto' : ''}</div><div class="porque">${icone('tutor')}<span>${esc(o.porque)}</span></div></div>
        <div class="onde"><b>${o.vezes || 1}×</b><span>${esc(FUNCOES_OBRA[o.funcao] || '')}</span>${(o.secoes || []).slice(0, 4).map((s) => `<span>${esc(s)}</span>`).join('')}</div>
        <div class="st-bib">${st}</div></div>`;
    };
    const grupos = [
      [3, 'alta', 'Sustentam decisões, argumentos ou comparações e você ainda não domina.'],
      [2, 'média', 'Sustentam partes do texto, mas exigem pouco esforço.'],
      [1, 'baixa', 'Já lidas e fichadas, ou só de contexto.'],
    ];
    const naTrilha = res.obras.filter((o) => o.prioridade >= 2 && o.leituraId).length;
    const cmp = res.comparacao;
    return `${topo}
      <div class="versao"><div class="pdf-ic">PDF</div><div class="info"><b>${esc(r.arquivo.nome)}</b><span>Versão ${r.versao}${res.paginas ? `, ${res.paginas} páginas` : ''}, ${res.obras.length} obras citadas, enviada em ${new Date(r.enviadoEm).toLocaleDateString('pt-BR')}.${cmp && r.versao > 1 ? ` Desde a anterior: ${cmp.novas?.length || 0} ${cmp.novas?.length === 1 ? 'obra nova' : 'obras novas'}, ${cmp.removidas?.length || 0} ${cmp.removidas?.length === 1 ? 'removida' : 'removidas'}, ${cmp.problemas_resolvidos || 0} ${cmp.problemas_resolvidos === 1 ? 'problema resolvido' : 'problemas resolvidos'}.` : ''}</span></div>
        ${revs.length > 1 ? `<div class="versoes"><span>Versões</span>${revs.map((x) => `<button data-rev-versao="${esc(x.id)}" class="${x.id === r.id ? 'on' : ''}">v${x.versao}</button>`).join('')}</div>` : ''}</div>
      <div class="proj-grid"><div>
        ${grupos
          .map(([n, nome, desc]) => {
            const rs = res.obras.map((o, i) => [o, i]).filter(([o]) => o.prioridade === n);
            const cab = `<header>${prio(n)}<h3>Prioridade ${nome}</h3><p>${rs.length} ${rs.length === 1 ? 'obra' : 'obras'}. ${desc}</p></header>`;
            const corpo = rs.map(([o, i]) => linha(o, i)).join('');
            return n === 3 ? `<section class="prio-grupo">${cab}${corpo || '<p class="mute" style="padding:0 20px 16px">Nenhuma.</p>'}</section>` : `<details class="prio-grupo"><summary>${cab}</summary>${corpo}</details>`;
          })
          .join('')}
      </div>
      <aside class="lado">
        <section class="bloco cta-trilha"><h3>Trilha sugerida</h3><p>${naTrilha ? `${naTrilha} ${naTrilha === 1 ? 'obra' : 'obras'} de prioridade alta e média que já estão na biblioteca, na ordem acima.` : 'Nenhuma obra de prioridade alta ou média está na biblioteca ainda. Adicione as que estão fora e peça a revisão de novo.'}</p>${naTrilha ? `<button class="btn" data-rev-trilha="${esc(r.id)}">Criar trilha com ${naTrilha} ${naTrilha === 1 ? 'leitura' : 'leituras'}</button>` : ''}</section>
        <section class="bloco"><h3>Problemas nas referências</h3>${res.problemas.length ? `<ul class="inc">${res.problemas.map((p) => `<li>${esc(TIPOS_PROBLEMA[p.tipo] || p.tipo)}: “${esc(p.trecho)}”<span>${[p.secao, p.pagina ? `p. ${p.pagina}` : ''].filter(Boolean).map(esc).join(', ')}</span></li>`).join('')}</ul>` : '<p class="mute">Nenhum problema encontrado.</p>'}</section>
        <section class="bloco"><details class="ajuda-det"><summary>Como a prioridade é calculada?</summary><ol>
          <li>Função no texto: sustenta uma decisão, um argumento, uma comparação ou só contextualiza.</li>
          <li>O que falta: fora da biblioteca, leitura incompleta, sem fichamento.</li>
          <li>Combinados com a orientação sobem um nível.</li></ol></details></section>
      </aside></div>`;
  }

  async function enviarVersao(arquivo) {
    abrirModal(`<h2 id="modal-tit">Lendo a versão do projeto</h2><p role="status">O Gemini está lendo ${esc(arquivo.name)} e comparando com a biblioteca. Leva cerca de um minuto; você pode fechar esta janela.</p><div class="pe"><button class="btn fant" data-dlg-fechar>Fechar</button></div>`);
    try {
      const r = await diss.revisar(arquivo);
      est.rev = r.id;
      fechar();
      redesenhar();
      const np = r.resultado.problemas.length;
      toast(`Versão ${r.versao} revisada: ${r.resultado.obras.length} obras, ${np} ${np === 1 ? 'problema' : 'problemas'} nas referências`);
    } catch (err) {
      abrirModal(`<h2 id="modal-tit">Não deu para revisar esta versão</h2>${erroHTML(err)}<div class="pe"><button class="btn prim" data-dlg-fechar>Fechar</button></div>`);
    }
  }

  /* =================== Orientação =================== */
  function orientacao() {
    const es = diss.encontros();
    const abertos = diss.combinadosAbertos();
    const total = es.reduce((n, e) => n + (e.combinados || []).length, 0);
    const feitos = es.reduce((n, e) => n + (e.combinados || []).filter((c) => c.feito).length, 0);
    const temas = diss.temas();
    const prox = disc.proximos(DISSERTACAO, 120).find((e) => e.tipo === 'orientacao');
    const topo = `<div class="topo"><div><h1>Orientação</h1><p>Tudo o que passa entre você e a orientação, em ordem. A IA resume, extrai combinados e mostra os temas que voltam.</p></div>
      <div class="acoes"><button class="btn" data-ori-agendar>${icone('mais')}Agendar encontro</button><button class="btn prim" data-ori-registrar>${icone('mais')}Registrar conversa</button></div></div>`;
    if (!es.length) return `${topo}<div class="bib-vazia"><h2>Nenhuma conversa registrada</h2><p>Registre do jeito mais fácil: uma anotação, o e-mail recebido, a gravação da reunião ou o PDF com comentários. O que você escreveu fica separado do resumo da IA.</p><button class="btn prim" data-ori-registrar>Registrar a primeira conversa</button></div>`;
    return `${topo}<div class="ori-grid"><div><div class="timeline">${es.map((e, k) => encontroHTML(e, k === 0 || est.abertos.has(e.id))).join('')}</div></div>
      <aside class="lado">
        <section class="bloco"><h3>Combinados em aberto</h3>${abertos.length ? `<ul class="combinados">${abertos.map((c) => `<li><input type="checkbox" data-ori-comb="${esc(c.id)}" data-enc="${esc(c.encontroId)}" aria-label="${esc(c.acao)}"><span>${esc(c.acao)}<small>${[c.secao ? `Seção ${c.secao}` : '', c.prazo ? `até ${dataCurta(c.prazo)}` : '', `combinado em ${dataLonga(c.data)}`].filter(Boolean).map(esc).join(', ')}</small></span></li>`).join('')}</ul>` : '<p class="mute">Nenhum em aberto.</p>'}
          ${total ? `<div class="mute" style="font-size:var(--t-xs);margin-top:14px">${feitos} de ${total} combinados cumpridos</div><div class="barra"><i style="width:${(feitos / total) * 100}%"></i></div>` : ''}</section>
        ${temas.length ? `<section class="bloco"><h3>Temas que voltam</h3><div class="dist">${temas.map((t) => `<div style="grid-template-columns:1fr 70px 18px"><span>${esc(t.tema)}</span><span class="trilho"><i style="background:var(--petroleo);width:${(t.vezes / temas[0].vezes) * 100}%"></i></span><span class="mute-2">${t.vezes}</span></div>`).join('')}</div></section>` : ''}
        <section class="bloco"><h3>${prox ? `Próximo encontro: ${dataCurta(prox.dia)}${prox.inicio ? `, ${prox.inicio}` : ''}` : 'Próximo encontro'}</h3>${prox ? '' : '<p class="mute" style="margin:0 0 10px">Sem data. Use "Agendar encontro".</p>'}
          ${abertos.length ? `<p>Pauta a partir dos combinados abertos:</p><ol>${diss.pauta().map((p) => `<li>${esc(p)}</li>`).join('')}</ol><button class="btn" style="margin-top:14px" data-ori-pauta>${icone('copiar')}Copiar pauta</button>` : ''}</section>
      </aside></div>`;
  }

  function encontroHTML(e, aberto) {
    const reg = e.registro;
    const t = e.transcricao;
    const ab = (e.combinados || []).filter((c) => !c.feito).length;
    let estado = '';
    if (e.formato === 'audio' && t && t.status !== 'pronta') {
      if (t.status === 'erro') estado = `${erroHTML({ message: t.erro, codigo: t.codigoErro })}<button class="btn" data-ori-transcrever="${esc(e.id)}">Tentar de novo</button>`;
      else estado = `<p class="mute" role="status">${t.status === 'enviando' ? 'Enviando o áudio para o Gemini…' : t.status === 'resumindo' ? 'Transcrição pronta. Registrando a conversa…' : `Transcrevendo: parte ${Math.min((t.feitos || 0) + 1, t.total)} de ${t.total}.`}</p><div class="barra"><i style="width:${Math.round(((t.feitos || 0) / (t.total || 1)) * 100)}%"></i></div>`;
    } else if (e.processando) estado = '<p class="mute" role="status">A IA está registrando a conversa…</p>';
    else if (e.erroIA) estado = `${erroHTML(e.erroIA)}<button class="btn" data-ori-processar="${esc(e.id)}">Tentar de novo</button>`;
    const corpo = `${e.audio ? `<div class="audio-real" data-aula-audio="${esc(e.id)}"><audio controls preload="metadata" aria-label="Gravação da conversa"></audio><small class="mute" id="audio-msg"></small></div>` : ''}
      ${estado}
      ${reg?.resumo ? `<div class="resumo-ia">${icone('tutor')}<div><b>Resumo da IA</b>${esc(reg.resumo)}</div></div>` : ''}
      ${(reg?.trechos || []).map((x) => `<blockquote class="transcricao"><small>Orientação${x.tempo ? `, aos ${esc(x.tempo)}` : ''}</small>${esc(x.fala)}</blockquote>`).join('')}
      ${e.texto ? `<details class="meu-reg"><summary>${e.formato === 'anotacao' ? 'Sua anotação' : e.formato === 'email' ? 'O e-mail' : e.formato === 'pdf' ? 'Sua observação' : 'O texto registrado'}</summary><p>${esc(e.texto).replace(/\n/g, '<br>')}</p></details>` : ''}
      ${reg?.anteriores?.length ? `<h4>Combinados anteriores tratados</h4><ul class="anteriores">${reg.anteriores.map((x) => `<li><span>${esc(x.acao)}<small>${{ resolvido: 'Parece resolvido', mantido: 'Mantido', alterado: 'Alterado' }[x.situacao]}${x.detalhe ? `: ${esc(x.detalhe)}` : ''}</small></span>${x.situacao === 'resolvido' && diss.combinadosAbertos().some((c) => c.id === x.combinadoId) ? `<button class="btn fant" data-ori-feito="${esc(x.combinadoId)}" data-enc="${esc(x.encontroId)}">Marcar como feito</button>` : ''}</li>`).join('')}</ul>` : ''}
      <h4>Combinados</h4>
      ${(e.combinados || []).length ? `<ul class="combinados">${e.combinados.map((c) => `<li class="${c.feito ? 'ok' : ''}"><input type="checkbox" ${c.feito ? 'checked' : ''} data-ori-comb="${esc(c.id)}" data-enc="${esc(e.id)}" aria-label="${esc(c.acao)}"><span>${esc(c.acao)}<small>${[c.responsavel === 'orientacao' ? 'Com a orientação' : c.responsavel === 'ambos' ? 'Dos dois' : '', c.secao ? `Seção ${c.secao}` : '', c.prazo ? `até ${dataCurta(c.prazo)}` : ''].filter(Boolean).map(esc).join(', ')}</small></span></li>`).join('')}</ul>` : '<p class="mute" style="font-size:var(--t-s)">Nenhum.</p>'}
      <form class="nota-rap" data-ori-novo-comb="${esc(e.id)}" style="margin-top:10px"><input placeholder="Acrescentar um combinado" aria-label="Novo combinado"><button class="btn" type="submit">Acrescentar</button></form>
      ${reg?.sugestoes?.length ? `<h4>Sugestões</h4><ul>${reg.sugestoes.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      ${reg?.atencao?.length ? `<div class="conf-ia"><b>Pontos de atenção:</b> ${reg.atencao.map(esc).join(' ')}</div>` : ''}
      ${reg?.aviso ? `<p class="mute" style="font-size:var(--t-xs)">${esc(reg.aviso)}</p>` : ''}
      ${reg?.descartados ? `<p class="mute" style="font-size:var(--t-xs)">${reg.descartados} ${reg.descartados === 1 ? 'trecho foi descartado' : 'trechos foram descartados'} porque não estava no registro.</p>` : ''}
      <div class="ia-linha" style="margin-top:12px">${reg && !e.processando ? `<button class="btn fant" data-ori-processar="${esc(e.id)}">Refazer o registro da IA</button>` : ''}<button class="btn fant perigo" data-ori-apagar="${esc(e.id)}">Apagar registro</button></div>`;
    return `<article class="encontro"><header><h3>${esc(e.titulo)}</h3><span class="data">${dataLonga(e.data)}</span><span class="chips"><span class="chip">${FORMATOS[e.formato]}</span></span></header>
      ${aberto ? corpo : `<p class="resumo-l">${(e.combinados || []).length} ${(e.combinados || []).length === 1 ? 'combinado' : 'combinados'}${(e.combinados || []).length ? (ab ? `, ${ab} em aberto` : ', todos cumpridos') : ''}</p><details data-ori-det="${esc(e.id)}"><summary>Ver registro</summary>${corpo}</details>`}</article>`;
  }

  function modalRegistro() {
    const t = est.tipoReg;
    const campo =
      t === 'audio'
        ? '<div class="campo"><label for="ori-arq">Gravação (MP3, M4A, WAV)</label><input id="ori-arq" type="file" accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm" required></div><p class="mute-2" style="font-size:var(--t-xs);margin:-6px 0 14px">A IA transcreve e depois registra resumo e combinados. Grave só com o consentimento de quem orienta.</p>'
        : t === 'pdf'
          ? '<div class="campo"><label for="ori-arq">PDF com os comentários</label><input id="ori-arq" type="file" accept="application/pdf" required></div><div class="campo"><label for="ori-texto">Observação <span>opcional</span></label><textarea id="ori-texto" style="min-height:80px"></textarea></div>'
          : `<div class="campo"><label for="ori-texto">${t === 'transcricao' ? 'Cole a transcrição' : t === 'email' ? 'Cole o e-mail' : 'O que foi conversado'}</label><textarea id="ori-texto" style="min-height:170px" required placeholder="${t === 'anotacao' ? 'Com as suas palavras, o que ficou da conversa' : 'Cole o texto aqui'}"></textarea></div>`;
    abrirModal(`<h2 id="modal-tit">Registrar conversa</h2><p>Guarde do jeito mais fácil. O resumo da IA fica separado do que você registrou.</p>
      <div class="tipo-reg" role="group" aria-label="Tipo de registro">${Object.entries(FORMATOS).map(([k, n]) => `<button type="button" data-ori-tipo="${k}" class="${k === t ? 'on' : ''}" aria-pressed="${k === t}">${n}</button>`).join('')}</div>
      <form id="ori-form"><div class="linha2"><div class="campo"><label for="ori-titulo">Título</label><input id="ori-titulo" value="${t === 'email' ? 'Retorno por e-mail' : t === 'pdf' ? 'PDF com comentários' : 'Reunião de orientação'}"></div><div class="campo"><label for="ori-data">Data</label><input id="ori-data" type="date" value="${diaLocal()}" required></div></div>
      ${campo}
      <div class="pe"><button type="button" class="btn fant" data-dlg-fechar>Cancelar</button><button class="btn prim" type="submit">Registrar conversa</button></div></form>`);
  }

  /* =================== Diálogos =================== */
  function dialogos() {
    const ds = dlg.todos();
    const topo = `<div class="topo"><div><h1>Diálogos</h1><p>Conversas sobre as ideias das leituras: testar contrapontos, ser questionado e alinhar a sua visão com o que você já sustenta.</p></div>
      <div class="acoes"><button class="btn prim" data-dlg-novo>${icone('mais')}Novo diálogo</button></div></div>`;
    if (!ds.length) return `${topo}<div class="bib-vazia"><h2>Nenhum diálogo ainda</h2><p>Escolha um tema ou uma posição, as leituras e o modo. A IA só cita o seu acervo. No fim, as posições que você firmou podem ir para a memória ou atualizar um argumento.</p><button class="btn prim" data-dlg-novo>Começar um diálogo</button></div>`;
    const sel = typeof S !== 'undefined' && S.dlgReal && dlg.obter(S.dlgReal) ? dlg.obter(S.dlgReal) : ds[0];
    const msgs = est.msgs[sel.id];
    if (!msgs && !est.carregando.has(sel.id)) {
      est.carregando.add(sel.id);
      dlg.mensagens(sel).then((m) => {
        est.msgs[sel.id] = m;
        est.carregando.delete(sel.id);
        redesenhar();
      });
    }
    const propostas = (sel.posicoes || []).filter((p) => p.estado === 'proposta');
    const guardadas = (sel.posicoes || []).filter((p) => p.estado === 'guardada');
    return `${topo}<div class="dlg-grid">
      <div>${ds.map((x) => `<button class="dlg-item ${x.id === sel.id ? 'on' : ''}" data-dlg-sel="${esc(x.id)}"><b>${esc(x.tema)}</b><span>${x.modo}, ${new Date(x.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>${x.leituras.length ? `<span>${x.leituras.map((i) => bib.obter(i)).filter(Boolean).map((l) => esc(citacao(l))).join('; ')}</span>` : ''}</button>`).join('')}</div>
      <section class="conversa-card"><header><h2>${esc(sel.tema)}</h2>
        <div class="linha-h"><div class="seg" role="group" aria-label="Modo do diálogo">${Object.keys(MODOS).map((m) => `<button class="${m === sel.modo ? 'on' : ''}" title="${esc(MODOS[m])}" aria-pressed="${m === sel.modo}" data-dlg-modo="${m}">${m}</button>`).join('')}</div>
        ${sel.leituras.map((i) => bib.obter(i)).filter(Boolean).map((l) => `<a class="chip proj" href="#leitor/${encodeURIComponent(l.id)}" style="text-decoration:none">${esc(citacao(l))}</a>`).join('')}</div>
        <p class="mute" style="margin:0;font-size:var(--t-xs)">${esc(MODOS[sel.modo])}.</p></header>
        <div class="corpo" id="dlg-corpo">${msgs ? mensagensHTML(msgs) : '<p class="mute">Abrindo a conversa…</p>'}${est.ocupado === sel.id ? '<p class="mute" role="status">A IA está pensando…</p>' : ''}${est.erro && est.erro.id === sel.id ? erroHTML(est.erro.err) : ''}</div>
        <form class="entrada" data-dlg-enviar="${esc(sel.id)}"><textarea id="dlg-msg" placeholder="${msgs && msgs.length ? 'Continue o diálogo' : 'Diga a sua posição ou a sua dúvida'}" aria-label="Mensagem"></textarea><button type="submit" aria-label="Enviar" ${est.ocupado ? 'disabled' : ''}>${icone('enviar')}</button></form>
      </section>
      <aside class="lado">
        <section class="bloco"><h3>Posições que você firmou</h3>
          ${propostas.map((p) => `<div class="pos">${esc(p.texto)}<small class="mute" style="display:block;margin-top:4px">Das suas palavras, na mensagem ${p.mensagem}.</small><div class="bts"><button class="btn" data-dlg-memoria="${esc(p.id)}">Guardar na memória</button>${p.argumentoId ? `<button class="btn" data-dlg-argumento="${esc(p.id)}">Atualizar argumento</button>` : ''}<button class="btn fant" data-dlg-descartar="${esc(p.id)}">Descartar</button></div></div>`).join('')}
          ${guardadas.map((p) => `<div class="pos ok">${esc(p.texto)}<small class="mute" style="display:block;margin-top:4px">${[p.memoria ? 'Na memória' : '', p.argumento ? 'Argumento atualizado' : ''].filter(Boolean).join('. ')}</small></div>`).join('')}
          ${!propostas.length && !guardadas.length ? '<p class="mute" style="font-size:var(--t-s)">Quando a conversa render, toque em "Encerrar e firmar posições". A IA lista o que você firmou, com as suas palavras.</p>' : ''}
          ${msgs && msgs.some((m) => m.de === 'autor') ? `<button class="btn" style="margin-top:12px" data-dlg-encerrar="${esc(sel.id)}" ${est.ocupado ? 'disabled' : ''}>Encerrar e firmar posições</button>` : ''}</section>
        ${sel.questoes?.length ? `<section class="bloco"><h3>Ficou em aberto</h3><ul>${sel.questoes.map((q) => `<li>${esc(q)}</li>`).join('')}</ul></section>` : ''}
        <section class="bloco"><button class="btn fant perigo" data-dlg-apagar="${esc(sel.id)}">Apagar diálogo</button></section>
      </aside></div>`;
  }

  function mensagensHTML(msgs) {
    if (!msgs.length) return '<p class="mute">Comece dizendo o que você defende ou o que está em dúvida. Uma frase basta.</p>';
    return msgs
      .filter((m) => m.de === 'autor' || m.tarefa === 'dialogo')
      .map((m) => {
        if (m.de === 'autor') return `<div class="msg eu">${esc(m.texto)}</div>`;
        const r = m.resposta || {};
        const conf = new Set(m.conferencia?.conferidas || []);
        const itens = new Map((m.itens || []).map((i) => [i.id, i]));
        const fontes = (r.fontes || []).map((f) => `<span class="chip ${conf.has(f.id) ? '' : 'lac'}" title="${conf.has(f.id) ? 'Trecho conferido no seu acervo' : 'Não conferido'}">${conf.has(f.id) ? '' : '⚠ '}${esc(itens.get(f.id)?.citacao || f.id)}</span>`).join('');
        return `<div class="msg tutor"><span class="av">${icone('dialogos')}</span><div>${r.resposta ? `<p>${esc(tirarIds(r.resposta))}</p>` : ''}${r.pergunta ? `<p class="pergunta-tutor">${esc(tirarIds(r.pergunta))}</p>` : ''}${fontes ? `<div class="f">${fontes}</div>` : ''}${m.conferencia && !m.conferencia.ok ? '<p class="mute" style="font-size:var(--t-xs)">A conferência encontrou citação que não bate com o seu acervo; ela está marcada.</p>' : ''}</div></div>`;
      })
      .join('');
  }

  function modalNovoDialogo() {
    const ls = bib.leituras();
    abrirModal(`<h2 id="modal-tit">Novo diálogo</h2><p>A IA só cita o seu acervo: as leituras escolhidas vêm primeiro.</p>
      <form id="dlg-form">
        <div class="campo"><label for="dlg-tema">Tema ou posição</label><textarea id="dlg-tema" required style="min-height:80px" placeholder="Ex.: a adesão das equipes substitui a economia de quilometragem como critério de avaliação"></textarea></div>
        <fieldset class="modos-dlg"><legend>Modo</legend>${Object.entries(MODOS).map(([m, d], i) => `<label class="check"><input type="radio" name="dlg-modo" value="${m}" ${i === 0 ? 'checked' : ''}><span><b>${m}</b> ${esc(d)}</span></label>`).join('')}</fieldset>
        ${ls.length ? `<fieldset class="leit-dlg"><legend>Leituras <span class="mute">opcional</span></legend><div class="leit-lista">${ls.map((l) => `<label class="check"><input type="checkbox" name="dlg-leit" value="${esc(l.id)}"><span>${esc(citacao(l))} ${esc(l.titulo)}</span></label>`).join('')}</div></fieldset>` : ''}
        <div class="pe"><button type="button" class="btn fant" data-dlg-fechar>Cancelar</button><button class="btn prim" type="submit">Começar o diálogo</button></div>
      </form>`);
  }

  /* =================== Eventos =================== */
  document.addEventListener('change', (e) => {
    if (e.target.matches?.('[data-rev-pdf]') && e.target.files?.[0]) enviarVersao(e.target.files[0]);
    if (e.target.dataset?.oriComb) {
      diss.marcarCombinado(e.target.dataset.enc, e.target.dataset.oriComb, e.target.checked).then(() => {
        redesenhar();
        toast(e.target.checked ? 'Combinado cumprido' : 'Combinado reaberto');
      });
    }
  });
  document.addEventListener(
    'toggle',
    (e) => {
      const id = e.target.dataset?.oriDet;
      if (!id) return;
      if (e.target.open) est.abertos.add(id);
      else est.abertos.delete(id);
    },
    true,
  );

  document.addEventListener('submit', async (e) => {
    const f = e.target;
    if (f.id === 'ori-form') {
      e.preventDefault();
      const t = est.tipoReg;
      const arquivo = document.getElementById('ori-arq')?.files?.[0];
      const texto = document.getElementById('ori-texto')?.value.trim() || '';
      if ((t === 'audio' || t === 'pdf') && !arquivo) return toast('Escolha o arquivo.');
      if (t !== 'audio' && t !== 'pdf' && !texto) return toast('Escreva ou cole o conteúdo da conversa.');
      const enc = await diss.novoEncontro({ data: document.getElementById('ori-data').value, titulo: document.getElementById('ori-titulo').value.trim(), formato: t, texto });
      fechar();
      est.abertos.add(enc.id);
      if (t === 'audio') {
        await disc.guardarAudio(enc.id, arquivo);
        redesenhar();
        toast('Gravação guardada. A transcrição começou.');
        return;
      }
      redesenhar();
      toast('Conversa registrada. A IA está fazendo o resumo.');
      await diss.processar(enc.id, { arquivo: t === 'pdf' ? arquivo : null });
      redesenhar();
      return;
    }
    if (f.dataset.oriNovoComb) {
      e.preventDefault();
      const input = f.querySelector('input');
      if (!input.value.trim()) return;
      await diss.novoCombinado(f.dataset.oriNovoComb, input.value.trim());
      redesenhar();
      return toast('Combinado acrescentado');
    }
    if (f.id === 'dlg-form') {
      e.preventDefault();
      const tema = document.getElementById('dlg-tema').value.trim();
      if (!tema) return;
      const modo = f.querySelector('[name=dlg-modo]:checked')?.value || 'Contraponto';
      const leituras = [...f.querySelectorAll('[name=dlg-leit]:checked')].map((x) => x.value);
      const d = await dlg.novo({ tema, modo, leituras });
      fechar();
      if (typeof S !== 'undefined') S.dlgReal = d.id;
      est.msgs[d.id] = [];
      redesenhar();
      setTimeout(() => document.getElementById('dlg-msg')?.focus(), 50);
      return;
    }
    if (f.dataset.dlgEnviar) {
      e.preventDefault();
      const id = f.dataset.dlgEnviar;
      const texto = document.getElementById('dlg-msg').value.trim();
      if (!texto || est.ocupado) return;
      est.ocupado = id;
      est.erro = null;
      est.msgs[id] = [...(est.msgs[id] || []), { de: 'autor', texto }];
      redesenhar();
      try {
        await dlg.responder(id, texto);
        est.msgs[id] = await dlg.mensagens(dlg.obter(id));
      } catch (err) {
        est.erro = { id, err };
        est.msgs[id] = (est.msgs[id] || []).slice(0, -1);
        if (!(err instanceof ErroIA)) registrar('erro', 'dialogo.falhou', { det: err.message, st: 'erro' });
      } finally {
        est.ocupado = null;
        redesenhar();
        if (est.erro) {
          const t = document.getElementById('dlg-msg');
          if (t) t.value = texto;
        }
      }
    }
  });

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-rev-versao],[data-rev-buscar],[data-rev-trilha],[data-ori-registrar],[data-ori-tipo],[data-ori-agendar],[data-ori-pauta],[data-ori-processar],[data-ori-transcrever],[data-ori-apagar],[data-ori-feito],[data-dlg-novo],[data-dlg-fechar],[data-dlg-sel],[data-dlg-modo],[data-dlg-encerrar],[data-dlg-memoria],[data-dlg-argumento],[data-dlg-descartar],[data-dlg-apagar]');
    if (!b) return;
    const d = b.dataset;
    if (d.dlgFechar !== undefined) return fechar();
    if (d.revVersao) {
      est.rev = d.revVersao;
      return redesenhar();
    }
    if (d.revBuscar !== undefined) {
      const r = (est.rev && diss.revisao(est.rev)) || diss.todasRevisoes()[0];
      await diss.marcarParaBuscar(r.id, Number(d.revBuscar));
      redesenhar();
      return toast('Na lista para buscar. Adicione o PDF à biblioteca e peça a revisão de novo.');
    }
    if (d.revTrilha) {
      const t = await diss.criarTrilha(d.revTrilha);
      if (t) toast(`Trilha "${t.nome}" criada com ${t.itens.length} ${t.itens.length === 1 ? 'leitura' : 'leituras'}`);
      return;
    }
    if (d.oriRegistrar !== undefined) return modalRegistro();
    if (d.oriTipo) {
      est.tipoReg = d.oriTipo;
      return modalRegistro();
    }
    if (d.oriAgendar !== undefined) {
      // O formulário de agenda das disciplinas serve também para a dissertação.
      return discUI.formEvento(DISSERTACAO, { tipo: 'orientacao', titulo: 'Encontro de orientação' });
    }
    if (d.oriPauta !== undefined) {
      const texto = diss.pauta().map((p, i) => `${i + 1}. ${p}`).join('\n');
      try {
        await navigator.clipboard.writeText(texto);
        toast('Pauta copiada');
      } catch {
        toast('Não deu para copiar. Selecione a lista e copie.');
      }
      return;
    }
    if (d.oriProcessar) {
      diss.processar(d.oriProcessar).then(redesenhar);
      return setTimeout(redesenhar, 30);
    }
    if (d.oriTranscrever) {
      const en = diss.encontro(d.oriTranscrever);
      await disc.salvarItem({ ...en, transcricao: { ...en.transcricao, status: 'na_fila', erro: null, aparelho: window.rb.dados.aparelho } });
      disc.iniciarTranscricao(en.id);
      return redesenhar();
    }
    if (d.oriApagar) {
      const desfazer = await diss.apagarEncontro(d.oriApagar);
      redesenhar();
      return toast('Registro apagado', async () => {
        await desfazer();
        redesenhar();
      });
    }
    if (d.oriFeito) {
      await diss.marcarCombinado(d.enc, d.oriFeito, true);
      redesenhar();
      return toast('Combinado cumprido');
    }
    if (d.dlgNovo !== undefined) return modalNovoDialogo();
    if (d.dlgSel) {
      if (typeof S !== 'undefined') S.dlgReal = d.dlgSel;
      est.erro = null;
      return redesenhar();
    }
    const atual = () => dlg.obter((typeof S !== 'undefined' && S.dlgReal) || dlg.todos()[0]?.id) || dlg.todos()[0];
    if (d.dlgModo) {
      const x = atual();
      if (x.modo === d.dlgModo) return;
      await dlg.salvar({ ...x, modo: d.dlgModo });
      registrar('ui', 'dialogo.modo', { det: d.dlgModo });
      redesenhar();
      return toast(`Modo ${d.dlgModo}: ${MODOS[d.dlgModo].toLowerCase()}`);
    }
    if (d.dlgEncerrar) {
      est.ocupado = d.dlgEncerrar;
      redesenhar();
      try {
        const r = await dlg.encerrar(d.dlgEncerrar);
        est.msgs[d.dlgEncerrar] = await dlg.mensagens(dlg.obter(d.dlgEncerrar));
        toast(r.aceitas.length ? `${r.aceitas.length} ${r.aceitas.length === 1 ? 'posição para revisar' : 'posições para revisar'}` : 'Nenhuma posição firmada com as suas palavras ainda.');
      } catch (err) {
        est.erro = { id: d.dlgEncerrar, err };
      } finally {
        est.ocupado = null;
        redesenhar();
      }
      return;
    }
    if (d.dlgMemoria) {
      await dlg.guardarNaMemoria(atual().id, d.dlgMemoria);
      redesenhar();
      return toast('Posição guardada na memória');
    }
    if (d.dlgArgumento) {
      const x = atual();
      const desfazer = await dlg.atualizarArgumento(x.id, d.dlgArgumento);
      redesenhar();
      if (desfazer)
        toast('Tese do argumento atualizada. A anterior fica guardada no argumento.', async () => {
          await desfazer();
          redesenhar();
        });
      return;
    }
    if (d.dlgDescartar) {
      await dlg.mudarPosicao(atual().id, d.dlgDescartar, { estado: 'descartada' });
      return redesenhar();
    }
    if (d.dlgApagar) {
      const desfazer = await dlg.apagar(d.dlgApagar);
      if (typeof S !== 'undefined') S.dlgReal = null;
      redesenhar();
      return toast('Diálogo apagado. As mensagens continuam no histórico do Drive.', async () => {
        await desfazer();
        redesenhar();
      });
    }
  });

  return { projeto, orientacao, dialogos };
}
