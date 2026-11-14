// Telas de Projetos com dados reais: lista (dissertação e disciplinas), disciplina (visão geral, aulas, leituras,
// textos, agenda), aula (gravação, transcrição grifável, resumo, anotações) e os formulários.
import { CORES_DISC, TIPOS_EVENTO, DIAS, relogio, segundos, duracaoTexto, ocorrencias } from './disciplinas.js';
import { pipsHTML, ETAPAS, diaLocal, diasAte, dataCurta } from './progresso.js';
import { citacao } from './abnt.js';
import { medirAutoria } from './escrita.js';
import { FUNCOES } from './leitor-pdf.js';
import { ErroIA } from './gemini.js';
import { ouvir } from './ui.js';

/* global I, toast, S */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icone = (n) => (typeof I !== 'undefined' && I[n]) || '';
const NOMES_DIA = { dom: 'domingo', seg: 'segunda', ter: 'terça', qua: 'quarta', qui: 'quinta', sex: 'sexta', sab: 'sábado' };
const SEM = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
const MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const dataLonga = (d) => {
  if (!d) return '';
  const [a, m, dia] = d.split('-').map(Number);
  return `${dia} de ${MESES[m - 1].replace('.', '')}${a !== new Date().getFullYear() ? ` de ${a}` : ''}`;
};
const ERROS_DE_CONFIG = ['sem-acesso', 'permissao', 'projeto', 'trancado', 'chave', 'api', 'negado', 'sessao'];

export function criarDisciplinasUI({ disc, bib, escrita, registrar }) {
  const est = { plano: null, planoArquivo: null, planoDisc: null, audioUrl: null, audioDe: null };
  const redesenhar = () => /^#(disciplinas|disciplina\/|aula\/|orientacao)/.test(location.hash) && window.render?.();
  const veu = () => document.getElementById('veu');
  const abrirModal = (html) => {
    veu().innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-tit">${html}</div>`;
    veu().classList.add('on');
    veu().querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]),select,textarea')?.focus();
  };
  const fechar = () => veu().classList.remove('on');
  const depois = (fn) => setTimeout(fn, 60); // a troca de tela esconde o aviso: mostra depois dela

  /* ---------- Pedaços ---------- */
  const ponto = (cor, tam = 10) => `<span class="proj-dot" style="width:${tam}px;height:${tam}px;background:${cor}"></span>`;
  const horario = (d) => [d.dia_semana ? `${NOMES_DIA[d.dia_semana] || d.dia_semana}` : '', d.inicio ? `${d.inicio}${d.fim ? ` às ${d.fim}` : ''}` : ''].filter(Boolean).join(', ');
  function linhaEvento(e, { acoes = true } = {}) {
    const [, m, dia] = e.dia.split('-').map(Number);
    const sem = SEM[new Date(`${e.dia}T12:00:00`).getDay()];
    const d = disc.obter(e.disciplinaId);
    return `<div class="ev"><div class="ev-data"><b>${dia}</b><span>${sem} ${MESES[m - 1]}</span></div>
      <div><div class="ev-t">${esc(e.titulo)}</div><div class="ev-m"><span class="chip">${TIPOS_EVENTO[e.tipo] || 'Evento'}</span>${e.inicio ? `${e.tipo === 'entrega' ? 'até ' : ''}${e.inicio}${e.fim ? ` às ${e.fim}` : ''}` : ''}${e.repetir === 'semanal' ? ', toda semana' : ''}${!acoes && d ? `. ${esc(d.nome)}` : ''}</div></div>
      <span class="ev-acoes">${gStatus(e)}${acoes ? `<button class="btn fant" data-dsc-evento="${esc(e.id)}">Editar</button>` : ''}</span></div>`;
  }
  function gStatus(e) {
    const s = window.rb?.agenda?.situacao(e);
    if (s === 'enviado') return '<span class="g-st on" title="Também no Google Agenda">✓ No Google Agenda</span>';
    if (s === 'pendente') return '<span class="g-st pend">Indo para o Google Agenda</span>';
    return '';
  }
  function stAula(a) {
    const t = a.transcricao;
    if (!a.audio) return '<span class="st-a">Sem gravação</span>';
    if (!t) return '<span class="st-a">Gravação guardada</span>';
    if (t.status === 'pronta') return '<span class="st-a ok">Transcrita</span>';
    if (t.status === 'erro') return '<span class="st-a erro">Transcrição parou</span>';
    if (t.status === 'resumindo') return '<span class="st-a and">Resumindo</span>';
    if (t.status === 'enviando') return '<span class="st-a and">Enviando o áudio</span>';
    return `<span class="st-a and">Transcrevendo, ${Math.round(((t.feitos || 0) / (t.total || 1)) * 100)}%</span>`;
  }
  const aulaLinha = (d, a) =>
    `<a class="aula-l" href="#aula/${encodeURIComponent(d.id)}/${encodeURIComponent(a.id)}"><span class="n-a">${a.numero}</span><div><b>${esc(a.tema || `Aula ${a.numero}`)}</b><span>${dataLonga(a.data)}${a.audio?.duracao ? `, ${duracaoTexto(a.audio.duracao)}` : ''}${a.grifos?.length ? `, ${a.grifos.length} ${a.grifos.length === 1 ? 'grifo' : 'grifos'}` : ''}</span></div>${stAula(a)}</a>`;
  const concluida = (l) => (l.etapa || 0) >= 2;

  /* ---------- Lista de projetos ---------- */
  function lista() {
    const ds = disc.ativas();
    const arquivadas = disc.todas().filter((d) => d.arquivada);
    const cards = ds
      .map((d) => {
        const ls = disc.leiturasDe(d);
        const feitas = ls.filter(concluida).length;
        const prox = disc.proximos(d.id, 180);
        const ent = prox.find((e) => e.tipo === 'entrega');
        const aula = prox.find((e) => e.tipo === 'aula');
        const n = ent ? diasAte(ent.dia) : null;
        return `<article class="disc">
          <div><span class="chip">${esc(d.semestre || 'Disciplina')}</span><h2 class="mt-3">${ponto(d.cor, 11)} ${esc(d.nome)}</h2><div class="prof">${esc([d.docente, horario(d)].filter(Boolean).join('. ')) || 'Sem docente cadastrado'}</div></div>
          <div><div class="t-meta mute">${ls.length ? `${feitas} de ${ls.length} ${ls.length === 1 ? 'leitura concluída' : 'leituras concluídas'}` : 'Nenhuma obra da biblioteca marcada com esta disciplina'}</div>${ls.length ? `<div class="barra mb-0"><i style="width:${(feitas / ls.length) * 100}%"></i></div>` : ''}</div>
          ${aula ? `<div class="t-meta mute">Próxima aula: ${dataCurta(aula.dia)}${aula.inicio ? `, ${aula.inicio}` : ''}</div>` : ''}
          <div class="entrega"><span>${ent ? esc(ent.titulo) : 'Próxima entrega'}</span><b class="${n !== null && n <= 3 ? 'urg' : ''}">${ent ? dataCurta(ent.dia) : 'nenhuma'}</b></div>
          <div class="acoes"><a class="btn" href="#disciplina/${encodeURIComponent(d.id)}">Abrir</a></div>
        </article>`;
      })
      .join('');
    return `<div class="topo"><div><h1>Projetos</h1><p>A dissertação e as disciplinas. Todas usam a mesma biblioteca.</p></div>
        <div class="acoes"><button class="btn prim" data-dsc-nova>${icone('mais')}Nova disciplina</button></div></div>
      <div class="disc-grid">
        <article class="disc"><div><span class="chip">Mestrado</span><h2 class="mt-3">${ponto('#1F4A5A', 11)} Dissertação</h2><div class="prof">Revisão do projeto, orientação e argumentos</div></div>
          <div class="acoes"><a class="btn" href="#projeto">Abrir</a><a class="btn fant" href="#argumentos">Argumentos</a></div></article>
        ${cards}
        ${ds.length ? '' : '<button class="disc nova" data-dsc-nova><span><b>Cadastrar a primeira disciplina</b>Nome, docente e horário. Com o plano de ensino em PDF, a IA lê as aulas, as leituras e as entregas para você conferir.</span></button>'}
      </div>
      ${arquivadas.length ? `<details class="arq-disc"><summary>Arquivadas (${arquivadas.length})</summary><ul>${arquivadas.map((d) => `<li>${ponto(d.cor)} <a href="#disciplina/${encodeURIComponent(d.id)}">${esc(d.nome)}</a> <small>${esc(d.semestre || '')}</small></li>`).join('')}</ul></details>` : ''}`;
  }

  /* ---------- Disciplina ---------- */
  function tela(id) {
    const d = disc.obter(id);
    if (!d) return `<a class="voltar" href="#disciplinas">${icone('voltar')}Projetos</a><div class="topo"><div><h1>Disciplina não encontrada</h1><p>Ela pode ter sido apagada em outro aparelho.</p></div></div>`;
    const aba = typeof S !== 'undefined' && S.discAba ? S.discAba : 'geral';
    const abas = [['geral', 'Visão geral'], ['aulas', 'Aulas'], ['leituras', 'Leituras'], ['textos', 'Textos'], ['agenda', 'Agenda']];
    const corpo = { geral: abaGeral, aulas: abaAulas, leituras: abaLeituras, textos: abaTextos, agenda: abaAgenda }[aba] || abaGeral;
    const prox = disc.proximos(d.id, 180).find((e) => e.tipo === 'entrega');
    return `<a class="voltar" href="#disciplinas">${icone('voltar')}Projetos</a>
      <div class="topo"><div><h1>${ponto(d.cor, 14)} ${esc(d.nome)}${d.arquivada ? ' <span class="chip">Arquivada</span>' : ''}</h1><p>${esc([d.docente, d.semestre, horario(d)].filter(Boolean).join(', ')) ? `${esc([d.docente, d.semestre, horario(d)].filter(Boolean).join(', '))}.` : 'Complete docente, semestre e horário em Editar.'}${prox ? ` Próxima entrega: ${esc(prox.titulo)}, em ${dataCurta(prox.dia)}.` : ''}</p></div>
        <div class="acoes"><button class="btn fant" data-dsc-editar="${esc(d.id)}">Editar</button><button class="btn" data-dsc-agendar="${esc(d.id)}">${icone('mais')}Agendar</button><button class="btn prim" data-dsc-gravacao="${esc(d.id)}">${icone('upload')}Enviar gravação de aula</button></div></div>
      <nav class="mb-6 subnav" aria-label="Seções da disciplina">${abas.map(([k, n]) => `<a href="#disciplina/${encodeURIComponent(d.id)}" data-disc-aba="${k}" class="${k === aba ? 'on' : ''}" ${k === aba ? 'aria-current="page"' : ''}>${n}</a>`).join('')}</nav>
      ${corpo(d)}`;
  }

  function abaGeral(d) {
    const evs = disc.proximos(d.id, 60).slice(0, 4);
    const ult = disc.aulasDe(d.id).find((a) => a.transcricao?.status === 'pronta');
    const andamento = disc.aulasDe(d.id).filter((a) => a.transcricao && !['pronta', 'erro'].includes(a.transcricao.status));
    const ls = disc.leiturasDe(d);
    const feitas = ls.filter(concluida).length;
    return `<div class="proj-grid">
      <div>
        <section class="mb-4 bloco"><h3>Próximos compromissos</h3>${evs.length ? `<div class="evs">${evs.map((e) => linhaEvento(e)).join('')}</div>` : '<p class="mute">Nada agendado. Use "Agendar" para aulas, entregas e sessões de estudo.</p>'}${evs.length ? '<button class="mt-2 btn fant" data-disc-aba="agenda">Ver agenda</button>' : ''}</section>
        ${andamento.map((a) => `<section class="mb-4 bloco"><h3>Em andamento</h3>${aulaLinha(d, a)}</section>`).join('')}
        ${ult ? `<section class="bloco"><h3>Última aula transcrita</h3>${aulaLinha(d, ult)}<a class="mt-2 btn" href="#aula/${encodeURIComponent(d.id)}/${encodeURIComponent(ult.id)}">Abrir transcrição</a></section>` : `<section class="bloco"><h3>Aulas</h3><p class="mute">Envie a gravação de uma aula: o Gemini transcreve, resume e encontra os conceitos e as leituras citadas.</p><button class="btn" data-dsc-gravacao="${esc(d.id)}">Enviar gravação de aula</button></section>`}
      </div>
      <aside class="lado">
        <section class="bloco"><h3>Anotações da disciplina</h3>
          <form class="nota-rap" data-dsc-anotar="${esc(d.id)}"><input id="dsc-nota" placeholder="Anote algo rápido" aria-label="Nova anotação" autocomplete="off"><button class="btn" type="submit">Salvar</button></form>
          ${(d.anotacoes || []).length ? `<ul class="notas-d">${d.anotacoes.map((n) => `<li><span>${esc(n.texto)}</span><small>${new Date(n.em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} <button class="lnk" data-dsc-tirar-nota="${esc(n.id)}" aria-label="Apagar anotação">Apagar</button></small></li>`).join('')}</ul>` : ''}</section>
        <section class="bloco"><h3>Leituras</h3>${ls.length ? `<div class="t-meta mute">${feitas} de ${ls.length} concluídas</div><div class="barra"><i style="width:${(feitas / ls.length) * 100}%"></i></div>` : '<p class="t-meta mute">Marque obras da biblioteca com esta disciplina no campo Projeto.</p>'}<button class="btn fant" data-disc-aba="leituras">Ver leituras</button></section>
        ${(d.paraBuscar || []).length ? `<section class="bloco"><h3>Para buscar</h3><ul class="notas-d">${d.paraBuscar.map((p) => `<li>${esc(p.texto)}<small>${esc(p.origem || '')}</small></li>`).join('')}</ul></section>` : ''}
      </aside></div>`;
  }

  function abaAulas(d) {
    const as = disc.aulasDe(d.id);
    return `<section class="larg-pagina bloco">
      ${as.length ? `<div class="aulas">${as.map((a) => aulaLinha(d, a)).join('')}</div>` : '<p class="mute">Nenhuma aula ainda.</p>'}
      <div class="mt-3 ia-linha"><button class="btn prim" data-dsc-gravacao="${esc(d.id)}">${icone('upload')}Enviar gravação de aula</button><button class="btn fant" data-dsc-nova-aula="${esc(d.id)}">Registrar aula sem gravação</button></div>
      <details class="mt-3 pt-4 borda-topo ajuda-det"><summary>Como funcionam as gravações?</summary><p class="m-0 mt-3 t-meta mute">O áudio fica neste aparelho e no seu Drive. O Gemini transcreve em partes de 15 minutos; se você fechar o app, a transcrição continua de onde parou quando você abrir de novo neste aparelho. Depois ele resume, lista os conceitos e as leituras citadas e sugere perguntas para estudar. A transcrição pode ser grifada com as mesmas cores dos textos. Grave só com o consentimento da docência e da turma.</p></details></section>`;
  }

  function abaLeituras(d) {
    const ls = disc.leiturasDe(d);
    const plano = d.leiturasPlano || [];
    return `<div class="proj-grid"><section class="bloco">
      <h3>Na biblioteca</h3>
      ${ls.length ? `<div class="lst-leit">${ls.map((l) => `<a class="lc" href="#leitor/${encodeURIComponent(l.id)}"><b class="forte">${esc(citacao(l))}</b> ${esc(l.titulo)}<span>${pipsHTML(l.etapa || 0)} ${ETAPAS[l.etapa || 0]}</span></a>`).join('')}</div>` : '<p class="mute">Nenhuma obra marcada com esta disciplina. Na ficha da obra, escreva o nome da disciplina no campo Projeto.</p>'}
      ${plano.length ? `<h3 class="mt-6">Do plano de ensino</h3><ul class="plano-l">${plano.map((p) => {
        const l = p.leituraId && bib.obter(p.leituraId);
        return `<li><span class="chip ${p.obrigatoria ? '' : 'leve'}">${p.obrigatoria ? 'Obrigatória' : 'Complementar'}</span><span>${esc(p.referencia)}</span>${l ? `<a class="btn fant" href="#leitor/${encodeURIComponent(l.id)}">Abrir</a>` : '<span class="t-legenda mute">Fora da biblioteca</span>'}</li>`;
      }).join('')}</ul>` : ''}
      </section>
      <aside class="lado"><section class="bloco"><h3>Plano de ensino</h3>${d.plano ? `<p class="m-0 mb-3">${esc(d.plano.nome)} está no seu Drive.</p>` : '<p class="m-0 mb-3">Envie o PDF: a IA lê as aulas, as leituras e as entregas, e você confere antes de salvar.</p>'}<label class="btn">${d.plano ? 'Ler outro plano' : 'Ler o plano de ensino'}<input type="file" accept="application/pdf" data-dsc-plano="${esc(d.id)}" hidden></label></section>
      ${(d.paraBuscar || []).length ? `<section class="bloco"><h3>Para buscar</h3><ul class="notas-d">${d.paraBuscar.map((p) => `<li>${esc(p.texto)}<small>${esc(p.origem || '')} <button class="lnk" data-dsc-achei="${esc(p.id)}">Já adicionei</button></small></li>`).join('')}</ul></section>` : ''}
      </aside></div>`;
  }

  function abaTextos(d) {
    const ts = escrita.todos().filter((t) => t.projeto === d.nome);
    return `<div class="txt-lista">${ts.length ? ts.map((t) => {
      const a = medirAutoria(t);
      return `<a class="txt-card" href="#texto/${encodeURIComponent(t.id)}"><div><div class="t">${esc(t.titulo)}</div><div class="m">${esc(t.tipo)}. ${a.total}${t.limite ? ` de ${t.limite}` : ''} palavras${t.entrega ? `, entrega ${dataCurta(t.entrega)}` : ''}</div></div><div class="et"><span>${t.passo <= 3 ? 'Preparando' : t.passo === 4 ? 'Escrevendo' : 'Em revisão'}</span></div><div class="autoria"><span>Participação da IA: <b>${a.participacao}%</b></span></div></a>`;
    }).join('') : '<div class="vazio">Nenhum texto desta disciplina.</div>'}</div>
    <div class="mt-3 ia-linha"><button class="btn" data-dsc-novo-texto="${esc(d.id)}">${icone('mais')}Novo texto desta disciplina</button></div>`;
  }

  function abaAgenda(d) {
    const occ = disc.proximos(d.id, 180);
    const hoje = new Date();
    const grupo = (e) => {
      const n = diasAte(e.dia, hoje);
      const dow = hoje.getDay();
      if (n <= 6 - dow) return 'Esta semana';
      if (n <= 13 - dow) return 'Próxima semana';
      const [a, m] = e.dia.split('-').map(Number);
      return `${MESES[m - 1].replace('.', '')}${a !== hoje.getFullYear() ? ` de ${a}` : ''}`.replace(/^./, (c) => c.toUpperCase());
    };
    const grupos = [];
    for (const e of occ) {
      const g = grupo(e);
      if (grupos.at(-1)?.[0] !== g) grupos.push([g, []]);
      grupos.at(-1)[1].push(e);
    }
    return `<div class="proj-grid">
      <section class="bloco">${grupos.length ? grupos.map(([g, es]) => `<h3 class="mt-2">${g}</h3><div class="evs">${es.map((e) => linhaEvento(e)).join('')}</div>`).join('') : '<p class="mute">Nada agendado nos próximos meses.</p>'}
        <button class="mt-3 btn" data-dsc-agendar="${esc(d.id)}">${icone('mais')}Agendar</button></section>
      <aside class="lado"><section class="bloco"><h3>Google Agenda</h3><p class="m-0 mb-3">${window.rb?.agenda?.estado().ligada ? 'Os eventos vão para a agenda researchbook da sua conta Google. Se você mudar ou apagar aqui, muda ou some lá também.' : 'Os eventos ficam no researchbook, em todos os seus aparelhos. Para vê-los também no Google Agenda, ligue em Ajustes.'}</p><a class="btn fant" href="#ajustes/agenda">Ajustes da agenda</a></section></aside>
    </div>`;
  }

  /* ---------- Aula ---------- */
  function telaAula(discId, aulaId) {
    const d = disc.obter(discId);
    const a = disc.aula(aulaId);
    if (!d || !a) return `<a class="voltar" href="#disciplinas">${icone('voltar')}Projetos</a><div class="topo"><div><h1>Aula não encontrada</h1></div></div>`;
    const t = a.transcricao;
    const aba = typeof S !== 'undefined' && S.aulaAba ? S.aulaAba : 'transcricao';
    const pronta = t?.status === 'pronta';
    let main = '';
    if (!a.audio) {
      main = `<section class="editor"><h2>Sem gravação</h2><p class="instr">Envie o áudio desta aula para transcrever, ou escreva as suas anotações abaixo.</p><label class="btn prim">${icone('upload')}Escolher a gravação<input type="file" accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm" data-dsc-audio-aula="${esc(a.id)}" hidden></label></section>${notasHTML(a)}`;
    } else if (!pronta && aba !== 'notas') {
      main = `${estadoTranscricao(a)}`;
    } else if (aba === 'resumo') main = resumoHTML(d, a);
    else if (aba === 'notas') main = notasHTML(a);
    else main = `<article class="doc transcr transcr-real" data-aula="${esc(a.id)}" lang="pt-BR"><p class="mute">Abrindo a transcrição…</p></article>`;
    const r = a.resumo;
    const proxAula = disc.proximos(d.id, 60).find((e) => e.tipo === 'aula');
    return `<button class="fundo-0 b-0 p-0 cursor voltar" data-voltar-disc="${esc(d.id)}">${icone('voltar')}${esc(d.nome)}</button>
      <div class="topo"><div><h1 class="t-titulo-1">Aula ${a.numero}${a.tema ? `: ${esc(a.tema)}` : ''}</h1><p>${dataLonga(a.data)}${a.audio?.duracao ? `, ${duracaoTexto(a.audio.duracao)}` : ''}. ${stAula(a)}</p></div>
        <div class="acoes"><button class="btn fant" data-dsc-editar-aula="${esc(a.id)}">Editar aula</button><button class="btn" data-dsc-agendar="${esc(d.id)}" data-tipo="estudo" data-titulo="Revisar a aula ${a.numero}">${icone('mais')}Agendar revisão</button></div></div>
      ${a.audio ? `<div class="audio-real" data-aula-audio="${esc(a.id)}"><audio controls preload="metadata" aria-label="Gravação da aula"></audio><small class="mute" id="audio-msg"></small></div>` : ''}
      <div class="aula-grid">
        <div>
          ${a.audio && (pronta || aba === 'notas') ? `<nav class="mb-4 subnav">${[['transcricao', 'Transcrição'], ['resumo', 'Resumo'], ['notas', 'Suas anotações']].map(([x, n]) => `<a href="#aula/${encodeURIComponent(d.id)}/${encodeURIComponent(a.id)}" data-aula-aba="${x}" class="${x === aba ? 'on' : ''}">${n}</a>`).join('')}</nav>` : ''}
          ${main}
        </div>
        <aside class="lado">
          ${r?.conceitos?.length ? `<section class="bloco"><h3>Conceitos da aula</h3><div class="termos">${r.conceitos.map((c) => `<button class="chip" data-dsc-ir="${esc(c.tempo)}" title="${esc(c.definicao_em_aula)}">${esc(c.nome)}</button>`).join('')}</div></section>` : ''}
          ${r?.leituras?.length ? `<section class="bloco"><h3>Leituras citadas</h3>${leiturasCitadas(d, r.leituras)}</section>` : ''}
          ${a.grifos?.length ? `<section class="bloco"><h3>Seus grifos</h3><div class="grifos-aula">${a.grifos.map((g) => `<button class="lc" data-dsc-ir="${esc(g.tempo)}"><i class="ponto-cor c-${g.funcao}"></i>${esc(g.texto.length > 120 ? g.texto.slice(0, 120) + '…' : g.texto)}<span>${esc(g.tempo)}</span></button>`).join('')}</div></section>` : ''}
          <section class="bloco"><h3>Próxima aula</h3><p class="m-0">${proxAula ? `${esc(proxAula.titulo)}, ${dataCurta(proxAula.dia)}${proxAula.inicio ? `, ${proxAula.inicio}` : ''}` : 'Sem aula agendada.'}</p></section>
        </aside>
      </div>`;
  }

  function estadoTranscricao(a) {
    const t = a.transcricao;
    if (!t) return `<section class="editor"><h2>Gravação guardada</h2><p class="instr">A transcrição não foi pedida.</p><button class="btn prim" data-dsc-transcrever="${esc(a.id)}">Transcrever esta aula</button></section>${notasHTML(a)}`;
    if (t.status === 'erro') {
      const config = ERROS_DE_CONFIG.includes(t.codigoErro);
      return `<section class="editor"><h2>A transcrição parou</h2><div class="erro-ia" role="alert"><p>${esc(t.erro || 'O Gemini não respondeu.')}</p>${config ? '<a class="btn" href="#ajustes">Abrir Ajustes do Gemini</a>' : ''}</div><p class="instr">${t.feitos ? `${t.feitos} de ${t.total} partes já estão prontas e não serão refeitas.` : ''}</p><button class="btn prim" data-dsc-transcrever="${esc(a.id)}">Tentar de novo</button></section>`;
    }
    const outro = t.aparelho && t.aparelho !== window.rb?.dados?.aparelho && !disc.emAndamento(a.id);
    const pct = Math.round(((t.feitos || 0) / (t.total || 1)) * 100);
    const fase = t.status === 'enviando' ? 'Enviando o áudio para o Gemini' : t.status === 'resumindo' ? 'Transcrição pronta. Resumindo a aula' : t.status === 'na_fila' ? 'Na fila para transcrever' : `Transcrevendo: parte ${Math.min((t.feitos || 0) + 1, t.total)} de ${t.total}`;
    return `<section class="editor"><h2>${fase}</h2>
      <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progresso da transcrição"><i style="width:${t.status === 'resumindo' ? 100 : pct}%"></i></div>
      <p class="instr">${outro ? 'A transcrição começou em outro aparelho e continua lá quando ele abrir o app.' : 'Pode continuar usando o app. Se fechar, a transcrição continua de onde parou quando você abrir de novo neste aparelho.'}</p>
      ${outro ? `<button class="btn" data-dsc-transcrever="${esc(a.id)}">Continuar neste aparelho</button>` : ''}</section>${notasHTML(a)}`;
  }

  function notasHTML(a) {
    return `<section class="mt-4 editor"><h2>Suas anotações</h2><p class="instr">O que você anotou da aula. Fica separado da transcrição e salva sozinho.</p><div class="campo"><textarea id="dsc-notas-aula" data-dsc-notas="${esc(a.id)}" style="min-height:180px" aria-label="Suas anotações da aula">${esc(a.notas || '')}</textarea></div><small class="mute" id="dsc-notas-st"></small></section>`;
  }

  function leiturasCitadas(d, leituras) {
    return leituras
      .map((x) => {
        const l = x.leituraId && bib.obter(x.leituraId);
        if (l) return `<a class="lc" href="#leitor/${encodeURIComponent(l.id)}">${esc(citacao(l))}<span>Na biblioteca, ${ETAPAS[l.etapa || 0].toLowerCase()}. ${esc(x.o_que_foi_dito || '')}</span></a>`;
        const ja = (d.paraBuscar || []).some((p) => p.texto === x.como_foi_dito);
        return `<div class="lc"><b class="forte">${esc(x.como_foi_dito)}</b><span>${esc(x.o_que_foi_dito || '')} Fora da biblioteca.</span>${ja ? '<span>Na lista para buscar.</span>' : `<button class="mt-2 btn mini" data-dsc-buscar="${esc(x.como_foi_dito)}" data-disc="${esc(d.id)}">Marcar para buscar</button>`}</div>`;
      })
      .join('');
  }

  function resumoHTML(d, a) {
    const r = a.resumo;
    if (!r) return `<section class="editor"><h2>Resumo da aula</h2><p class="instr">O resumo ainda não foi feito.</p><button class="btn prim" data-dsc-resumir="${esc(a.id)}" data-ocupado="Resumindo…">Resumir a aula</button></section>`;
    const tempo = (t) => (t ? `<button class="ts" data-dsc-ir="${esc(t)}">${esc(t)}</button>` : '');
    return `<section class="editor"><h2>Resumo da aula</h2><p class="instr">Feito pelo Gemini a partir da transcrição. Cada ponto foi conferido no que foi dito; selecione o tempo para ouvir.</p>
      ${r.aviso ? `<div class="conf-ia">${esc(r.aviso)}</div>` : ''}
      <ul class="resumo-aula">${r.resumo.map((p) => `<li>${tempo(p.tempo)}${esc(p.texto)}</li>`).join('')}</ul>
      ${r.perguntas?.length ? `<h3 class="sub-res">Perguntas para estudar</h3><ul class="resumo-aula">${r.perguntas.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      ${r.combinados?.length ? `<h3 class="sub-res">Combinados da aula</h3><ul class="combinados">${r.combinados.map((c, i) => `<li>${tempo(c.tempo)}<span>${esc(c.tarefa)}${c.prazo ? `, até ${dataCurta(c.prazo)}` : ''}</span>${c.prazo ? `<button class="btn fant" data-dsc-combinado="${i}" data-aula="${esc(a.id)}">Agendar entrega</button>` : ''}</li>`).join('')}</ul>` : ''}
      ${r.conceitos?.length ? `<h3 class="sub-res">Conceitos, como foram definidos em aula</h3><dl class="conceitos-aula">${r.conceitos.map((c) => `<dt>${esc(c.nome)} ${tempo(c.tempo)}</dt><dd>${esc(c.definicao_em_aula)}</dd>`).join('')}</dl>` : ''}
      ${r.descartados ? `<p class="t-legenda mute">${r.descartados} ${r.descartados === 1 ? 'ponto foi descartado' : 'pontos foram descartados'} porque o trecho não estava na transcrição.</p>` : ''}
      <div class="pe"><span class="t-legenda mute">${esc(r.modelo || '')}</span><span class="flex gap-2 wrap"><button class="btn fant" data-dsc-resumir="${esc(a.id)}" data-ocupado="Resumindo…">Refazer o resumo</button><button class="btn" data-cart-de="aula:${esc(a.id)}" data-ocupado="Propondo cartões…">Criar cartões desta aula</button></span></div></section>`;
  }

  /** Monta a transcrição com os grifos, o áudio e o seletor de cores (depois que a tela entra). */
  async function montar() {
    const box = document.querySelector('.transcr-real');
    const audioBox = document.querySelector('[data-aula-audio]');
    if (audioBox) {
      const id = audioBox.dataset.aulaAudio;
      const el = audioBox.querySelector('audio');
      if (est.audioDe !== id) {
        if (est.audioUrl) URL.revokeObjectURL(est.audioUrl);
        est.audioUrl = null;
        est.audioDe = id;
        const r = await disc.obterAudio(id);
        if (r.blob && est.audioDe === id) est.audioUrl = URL.createObjectURL(r.blob);
        else if (r.erro) document.getElementById('audio-msg').textContent = r.erro;
      }
      if (est.audioUrl && el && el.src !== est.audioUrl) el.src = est.audioUrl;
    }
    if (!box) return;
    const aulaId = box.dataset.aula;
    const segs = await disc.transcricao(aulaId);
    const a = disc.aula(aulaId);
    if (!document.body.contains(box)) return;
    if (!segs.length) {
      box.innerHTML = '<p class="mute">A transcrição ainda não chegou a este aparelho. Confira a internet e abra de novo.</p>';
      return;
    }
    const porSeg = new Map();
    for (const g of a.grifos || []) {
      if (!porSeg.has(g.seg)) porSeg.set(g.seg, []);
      porSeg.get(g.seg).push(g);
    }
    box.innerHTML = segs
      .map((s, i) => {
        let texto = esc(s.texto);
        const gs = (porSeg.get(i) || []).sort((x, y) => y.ini - x.ini);
        let bruto = s.texto;
        for (const g of gs) {
          if (bruto.slice(g.ini, g.fim) !== g.texto) continue;
          bruto = `${bruto.slice(0, g.ini)}\u0001${g.id}\u0002${bruto.slice(g.ini, g.fim)}\u0003${bruto.slice(g.fim)}`;
        }
        texto = esc(bruto).replace(/\u0001([^\u0002]+)\u0002/g, (_, id) => `<mark class="${esc((a.grifos.find((g) => g.id === id) || {}).funcao)}" data-grifo-aula="${esc(id)}" title="Selecione para tirar o grifo">`).replace(/\u0003/g, '</mark>');
        return `<p data-seg="${i}"><button class="ts" data-dsc-ir="${esc(s.inicio)}" aria-label="Ouvir a partir de ${esc(s.inicio)}">${esc(s.inicio)}</button><b>${esc(s.falante)}</b><span class="seg-t">${texto}</span></p>`;
      })
      .join('');
  }

  /* ---------- Grifar na transcrição ---------- */
  const pop = document.createElement('div');
  pop.className = 'popover pop-pdf pop-aula';
  pop.innerHTML = `<div class="linha-p">${FUNCOES.map((f) => `<button class="cor-n" data-grifo-aula-cor="${f.id}"><i class="c-${f.id}"></i>${f.nome}</button>`).join('')}</div>`;
  document.body.appendChild(pop);
  let selecao = null;
  function lerSelecao() {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return null;
    const r = sel.getRangeAt(0);
    const span = r.startContainer.parentElement?.closest('.seg-t');
    if (!span || !span.closest('.transcr-real')) return null;
    if (span !== r.endContainer.parentElement?.closest('.seg-t')) return { erro: 'Grife um trecho de cada vez, dentro da mesma fala.' };
    const antes = document.createRange();
    antes.setStart(span, 0);
    antes.setEnd(r.startContainer, r.startOffset);
    const ini = antes.toString().length;
    const texto = r.toString();
    if (!texto.trim()) return null;
    const p = span.closest('[data-seg]');
    return { seg: Number(p.dataset.seg), ini, fim: ini + texto.length, texto, tempo: p.querySelector('.ts').textContent, caixa: r.getBoundingClientRect(), aulaId: span.closest('.transcr-real').dataset.aula };
  }
  function mostrarPop() {
    const s = lerSelecao();
    if (!s || s.erro) {
      pop.classList.remove('on');
      selecao = null;
      if (s?.erro) toast(s.erro);
      return;
    }
    selecao = s;
    pop.classList.add('on');
    const w = pop.offsetWidth;
    pop.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, s.caixa.left + s.caixa.width / 2 - w / 2 + scrollX))}px`;
    const toque = matchMedia('(pointer: coarse)').matches;
    const acima = s.caixa.top + scrollY - pop.offsetHeight - 10;
    pop.style.top = `${!toque && acima > scrollY + 8 ? acima : s.caixa.bottom + scrollY + 14}px`;
  }
  document.addEventListener('mouseup', (e) => {
    if (pop.contains(e.target)) return;
    setTimeout(mostrarPop, 10);
  });
  document.addEventListener('touchend', () => setTimeout(mostrarPop, 350));
  window.addEventListener('hashchange', () => pop.classList.remove('on'));

  /* ---------- Formulários ---------- */
  function formDisciplina(d = {}) {
    const editando = !!d.id;
    const cor = d.cor || CORES_DISC[disc.todas().length % CORES_DISC.length];
    abrirModal(`<h2 id="modal-tit">${editando ? 'Editar disciplina' : 'Nova disciplina'}</h2><p>${editando ? 'O nome também muda nas obras e nos textos marcados com ele.' : 'Só o nome é obrigatório. Com o plano de ensino, a IA lê aulas, leituras e entregas para você conferir antes de salvar.'}</p>
      <form id="dsc-form" data-id="${esc(d.id || '')}">
        <div class="campo"><label for="dsc-nome">Nome</label><input id="dsc-nome" required value="${esc(d.nome || '')}" placeholder="Ex.: Teoria das Organizações"></div>
        <div class="linha2">
          <div class="campo"><label for="dsc-docente">Docente</label><input id="dsc-docente" value="${esc(d.docente || '')}"></div>
          <div class="campo"><label for="dsc-semestre">Semestre</label><input id="dsc-semestre" value="${esc(d.semestre || '')}" placeholder="Ex.: 2026/2"></div>
        </div>
        <div class="linha3">
          <div class="campo"><label for="dsc-dia">Dia da aula</label><select id="dsc-dia"><option value="">Não fixo</option>${DIAS.map((x) => `<option value="${x}" ${d.dia_semana === x ? 'selected' : ''}>${NOMES_DIA[x]}</option>`).join('')}</select></div>
          <div class="campo"><label for="dsc-inicio">Início</label><input id="dsc-inicio" type="time" value="${esc(d.inicio || '')}"></div>
          <div class="campo"><label for="dsc-fim">Fim</label><input id="dsc-fim" type="time" value="${esc(d.fim || '')}"></div>
        </div>
        <fieldset class="cores-disc"><legend>Cor</legend>${CORES_DISC.map((c, i) => `<label><input type="radio" name="dsc-cor" value="${c}" ${c === cor ? 'checked' : ''}><span style="background:${c}" aria-label="Cor ${i + 1}"></span></label>`).join('')}</fieldset>
        ${editando ? '' : `<div class="campo"><label for="dsc-plano-novo">Plano de ensino <span>PDF, opcional</span></label><input id="dsc-plano-novo" type="file" accept="application/pdf"></div><label class="check"><input type="checkbox" id="dsc-aulas-sem" checked>Agendar as aulas toda semana neste horário</label>`}
        <div class="pe">${editando ? `<button type="button" class="btn fant" data-dsc-arquivar="${esc(d.id)}">${d.arquivada ? 'Desarquivar' : 'Arquivar'}</button><button type="button" class="btn fant perigo" data-dsc-apagar="${esc(d.id)}">Apagar disciplina</button><span class="cresce"></span>` : ''}<button type="button" class="btn fant" data-dsc-fechar>Cancelar</button><button class="btn prim" type="submit">${editando ? 'Salvar' : 'Criar disciplina'}</button></div>
      </form>`);
  }

  function formEvento(discId, e = {}) {
    const editando = !!e.id;
    const d = disc.obter(discId || e.disciplinaId);
    abrirModal(`<h2 id="modal-tit">${editando ? 'Editar evento' : 'Agendar'}</h2><p>${esc(d?.nome || 'Dissertação')}</p>
      <form id="dsc-ev-form" data-id="${esc(e.id || '')}" data-disc="${esc(discId || e.disciplinaId || '')}">
        <div class="campo"><label for="ev-titulo">Título</label><input id="ev-titulo" required value="${esc(e.titulo || '')}"></div>
        <div class="linha2">
          <div class="campo"><label for="ev-tipo">Tipo</label><select id="ev-tipo">${Object.entries(TIPOS_EVENTO).map(([k, n]) => `<option value="${k}" ${k === (e.tipo || 'estudo') ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
          <div class="campo"><label for="ev-data">Data</label><input id="ev-data" type="date" required value="${esc(e.data || diaLocal())}"></div>
          <div class="campo"><label for="ev-inicio">Início</label><input id="ev-inicio" type="time" value="${esc(e.inicio || '')}"></div>
          <div class="campo"><label for="ev-fim">Fim</label><input id="ev-fim" type="time" value="${esc(e.fim || '')}"></div>
          <div class="campo"><label for="ev-repetir">Repetir</label><select id="ev-repetir"><option value="nao">Não repete</option><option value="semanal" ${e.repetir === 'semanal' ? 'selected' : ''}>Toda semana</option></select></div>
          <div class="campo"><label for="ev-ate">Repetir até</label><input id="ev-ate" type="date" value="${esc(e.ate || '')}"></div>
        </div>
        <div class="pe">${editando ? `<button type="button" class="btn fant perigo" data-dsc-apagar-ev="${esc(e.id)}">Apagar evento</button><span class="cresce"></span>` : ''}<button type="button" class="btn fant" data-dsc-fechar>Cancelar</button><button class="btn prim" type="submit">${editando ? 'Salvar' : 'Agendar'}</button></div>
      </form>`);
  }

  function formGravacao(discId, aulaId = null) {
    const d = disc.obter(discId);
    const a = aulaId && disc.aula(aulaId);
    abrirModal(`<h2 id="modal-tit">${a ? 'Editar aula' : 'Enviar gravação de aula'}</h2><p>${a ? esc(d.nome) : 'O Gemini transcreve, resume e encontra os conceitos e as leituras citadas. A gravação fica neste aparelho e no seu Drive.'}</p>
      <form id="dsc-aula-form" data-disc="${esc(d.id)}" data-aula="${esc(a?.id || '')}" data-modo="${a ? 'editar' : 'gravacao'}">
        <div class="linha2">
          <div class="campo"><label for="aula-data">Data da aula</label><input id="aula-data" type="date" required value="${esc(a?.data || diaLocal())}"></div>
          <div class="campo"><label for="aula-tema">Tema <span>opcional</span></label><input id="aula-tema" value="${esc(a?.tema || '')}"></div>
        </div>
        ${a ? '' : `<div class="campo"><label for="aula-arquivo">Gravação (MP3, M4A, WAV, OGG)</label><input id="aula-arquivo" type="file" accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm" required></div>
        <label class="check"><input type="checkbox" id="aula-transcrever" checked>Transcrever e resumir com o Gemini</label>
        <p class="t-legenda m-0 mt-n1 mb-3 mute-2">Grave só com o consentimento da docência e da turma.</p>`}
        <div class="pe">${a ? `<button type="button" class="btn fant perigo" data-dsc-apagar-aula="${esc(a.id)}">Apagar aula</button><span class="cresce"></span>` : ''}<button type="button" class="btn fant" data-dsc-fechar>Cancelar</button><button class="btn prim" type="submit">${a ? 'Salvar' : 'Enviar e transcrever'}</button></div>
      </form>`);
  }
  function formAulaSemGravacao(discId) {
    abrirModal(`<h2 id="modal-tit">Registrar aula sem gravação</h2><p>Para guardar anotações e grifos da aula. Dá para enviar o áudio depois.</p>
      <form id="dsc-aula-form" data-disc="${esc(discId)}" data-modo="sem">
        <div class="linha2"><div class="campo"><label for="aula-data">Data da aula</label><input id="aula-data" type="date" required value="${diaLocal()}"></div><div class="campo"><label for="aula-tema">Tema</label><input id="aula-tema"></div></div>
        <div class="pe"><button type="button" class="btn fant" data-dsc-fechar>Cancelar</button><button class="btn prim" type="submit">Registrar aula</button></div></form>`);
  }

  function modalPlano() {
    const p = est.plano;
    const d = disc.obter(est.planoDisc);
    const linha = (grupo, i, rot, sub, marcado = true, bloqueado = false) => `<label class="pl-it ${bloqueado ? 'off' : ''}"><input type="checkbox" data-pl="${grupo}" value="${i}" ${marcado && !bloqueado ? 'checked' : ''} ${bloqueado ? 'disabled' : ''}><span><b>${rot}</b>${sub ? `<small>${sub}</small>` : ''}</span></label>`;
    abrirModal(`<h2 id="modal-tit">Conferir o plano de ensino</h2><p>${esc(d.nome)}. Desmarque o que não quer salvar. Nada foi salvo ainda.</p>
      <div class="plano-rev">
        ${p.aulas.length ? `<h3>Aulas (${p.aulas.length})</h3>${p.aulas.map((a, i) => linha('aulas', i, esc(a.tema || 'Aula'), a.data ? dataLonga(a.data) : `Sem data no documento${a.referencia_no_documento ? ` (${esc(a.referencia_no_documento)})` : ''}`, !!a.data, !a.data)).join('')}` : ''}
        ${p.entregas.length ? `<h3>Entregas (${p.entregas.length})</h3>${p.entregas.map((e, i) => linha('entregas', i, esc(e.descricao), `${e.data ? dataLonga(e.data) : 'Sem data no documento'}${e.peso ? `, peso ${esc(e.peso)}` : ''}`, !!e.data, !e.data)).join('')}` : ''}
        ${p.leituras.length ? `<h3>Leituras (${p.leituras.length})</h3>${p.leituras.map((l, i) => linha('leituras', i, esc(l.referencia), `${l.obrigatoria ? 'Obrigatória' : 'Complementar'}. ${l.leituraId ? 'Já está na sua biblioteca' : 'Fora da biblioteca'}`)).join('')}<label class="check"><input type="checkbox" id="pl-trilha" checked>Criar uma trilha com as obrigatórias que já estão na biblioteca</label>` : ''}
        ${p.duvidas?.length ? `<div class="conf-ia"><b>Dúvidas da leitura:</b> ${p.duvidas.map(esc).join(' ')}</div>` : ''}
        ${!p.aulas.length && !p.entregas.length && !p.leituras.length ? '<p class="mute">A IA não encontrou aulas, entregas nem leituras neste PDF.</p>' : ''}
      </div>
      <div class="pe"><button type="button" class="btn fant" data-dsc-fechar>Descartar</button><button class="btn prim" data-dsc-aplicar-plano>Salvar o que está marcado</button></div>`);
  }

  async function lerPlano(discId, arquivo) {
    const d = disc.obter(discId);
    abrirModal(`<h2 id="modal-tit">Lendo o plano de ensino</h2><p role="status">O Gemini está lendo ${esc(arquivo.name)}. Leva alguns segundos.</p>`);
    try {
      est.plano = await disc.lerPlano(arquivo, { nome: d.nome, semestre: d.semestre });
      est.planoArquivo = arquivo;
      est.planoDisc = discId;
      modalPlano();
    } catch (err) {
      const config = err instanceof ErroIA && ERROS_DE_CONFIG.includes(err.codigo);
      abrirModal(`<h2 id="modal-tit">Não deu para ler o plano</h2><div class="erro-ia" role="alert"><p>${esc(err.message)}</p></div><div class="pe">${config ? '<a class="btn" href="#ajustes">Abrir Ajustes do Gemini</a>' : ''}<button class="btn prim" data-dsc-fechar>Fechar</button></div>`);
    }
  }

  /* ---------- Eventos de tela ---------- */
  ouvir('submit', async (e) => {
    const f = e.target;
    if (f.id === 'dsc-form') {
      e.preventDefault();
      const v = (id) => document.getElementById(id)?.value.trim() || '';
      const antes = f.dataset.id ? disc.obter(f.dataset.id) : {};
      const nome = v('dsc-nome');
      if (!nome) return;
      if (disc.todas().some((x) => x.nome.toLowerCase() === nome.toLowerCase() && x.id !== antes.id)) return toast('Já existe uma disciplina com esse nome.');
      const d = await disc.salvar({ ...antes, nome, docente: v('dsc-docente'), semestre: v('dsc-semestre'), dia_semana: v('dsc-dia'), inicio: v('dsc-inicio'), fim: v('dsc-fim'), cor: f.querySelector('[name=dsc-cor]:checked')?.value });
      const plano = document.getElementById('dsc-plano-novo')?.files?.[0];
      if (!antes.id && document.getElementById('dsc-aulas-sem')?.checked && d.dia_semana && d.inicio) {
        const hoje = new Date();
        const alvo = DIAS.indexOf(d.dia_semana);
        hoje.setDate(hoje.getDate() + ((alvo - hoje.getDay() + 7) % 7));
        const ate = new Date(hoje);
        ate.setDate(ate.getDate() + 7 * 17);
        await disc.salvarEvento({ disciplinaId: d.id, tipo: 'aula', titulo: `Aula de ${d.nome}`, data: diaLocal(hoje), inicio: d.inicio, fim: d.fim, repetir: 'semanal', ate: diaLocal(ate) });
      }
      fechar();
      if (!antes.id) {
        location.hash = `#disciplina/${encodeURIComponent(d.id)}`;
        if (plano) depois(() => lerPlano(d.id, plano));
        else depois(() => toast('Disciplina criada'));
      } else {
        redesenhar();
        toast('Disciplina salva');
      }
      return;
    }
    if (f.id === 'dsc-ev-form') {
      e.preventDefault();
      const v = (id) => document.getElementById(id)?.value.trim() || '';
      const antes = f.dataset.id ? disc.eventosDe().find((x) => x.id === f.dataset.id) : {};
      await disc.salvarEvento({ ...antes, disciplinaId: f.dataset.disc, titulo: v('ev-titulo'), tipo: v('ev-tipo'), data: v('ev-data'), inicio: v('ev-inicio'), fim: v('ev-fim'), repetir: v('ev-repetir'), ate: v('ev-ate') || null });
      fechar();
      redesenhar();
      toast(antes.id ? 'Evento salvo' : 'Evento agendado');
      return;
    }
    if (f.id === 'dsc-aula-form') {
      e.preventDefault();
      const data = document.getElementById('aula-data').value;
      const tema = document.getElementById('aula-tema').value.trim();
      const discId = f.dataset.disc;
      if (f.dataset.modo === 'editar') {
        await disc.salvarAula({ ...disc.aula(f.dataset.aula), data, tema });
        fechar();
        redesenhar();
        return toast('Aula salva');
      }
      const arquivo = document.getElementById('aula-arquivo')?.files?.[0];
      if (f.dataset.modo === 'gravacao' && !arquivo) return toast('Escolha o arquivo da gravação.');
      const a = await disc.novaAula({ disciplinaId: discId, data, tema });
      fechar();
      if (arquivo) {
        await disc.guardarAudio(a.id, arquivo, { transcrever: document.getElementById('aula-transcrever')?.checked !== false });
      }
      if (typeof S !== 'undefined') S.aulaAba = 'transcricao';
      location.hash = `#aula/${encodeURIComponent(discId)}/${encodeURIComponent(a.id)}`;
      depois(() => toast(arquivo ? 'Gravação guardada. A transcrição começou.' : 'Aula registrada'));
      return;
    }
    if (f.dataset.dscAnotar) {
      e.preventDefault();
      const input = document.getElementById('dsc-nota');
      const texto = input.value.trim();
      if (!texto) return;
      await disc.anotar(f.dataset.dscAnotar, texto);
      redesenhar();
      document.getElementById('dsc-nota')?.focus();
      toast('Anotação salva');
    }
  });

  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset?.dscPlano && t.files?.[0]) return lerPlano(t.dataset.dscPlano, t.files[0]);
    if (t.dataset?.dscAudioAula && t.files?.[0]) {
      await disc.guardarAudio(t.dataset.dscAudioAula, t.files[0]);
      redesenhar();
      toast('Gravação guardada. A transcrição começou.');
    }
  });

  let notasTimer = null;
  document.addEventListener('input', (e) => {
    if (!e.target.dataset?.dscNotas) return;
    const id = e.target.dataset.dscNotas;
    const valor = e.target.value;
    const st = document.getElementById('dsc-notas-st');
    if (st) st.textContent = 'Salvando…';
    clearTimeout(notasTimer);
    notasTimer = setTimeout(async () => {
      await disc.salvarAula({ ...disc.aula(id), notas: valor });
      const s2 = document.getElementById('dsc-notas-st');
      if (s2) s2.textContent = 'Salvo';
    }, 600);
  });

  ouvir('click', async (e) => {
    const b = e.target.closest('[data-dsc-nova],[data-dsc-editar],[data-dsc-agendar],[data-dsc-gravacao],[data-dsc-nova-aula],[data-dsc-evento],[data-dsc-fechar],[data-dsc-arquivar],[data-dsc-apagar],[data-dsc-apagar-ev],[data-dsc-apagar-aula],[data-dsc-editar-aula],[data-dsc-tirar-nota],[data-dsc-novo-texto],[data-dsc-transcrever],[data-dsc-resumir],[data-dsc-ir],[data-dsc-buscar],[data-dsc-achei],[data-dsc-combinado],[data-dsc-aplicar-plano],[data-grifo-aula-cor],[data-grifo-aula]');
    if (!b) return;
    const d = b.dataset;
    if (d.dscNova !== undefined) return formDisciplina();
    if (d.dscEditar) return formDisciplina(disc.obter(d.dscEditar));
    if (d.dscAgendar) return formEvento(d.dscAgendar, { tipo: d.tipo || 'estudo', titulo: d.titulo || '' });
    if (d.dscGravacao) return formGravacao(d.dscGravacao);
    if (d.dscNovaAula) return formAulaSemGravacao(d.dscNovaAula);
    if (d.dscEditarAula) {
      const a = disc.aula(d.dscEditarAula);
      return formGravacao(a.disciplinaId, a.id);
    }
    if (d.dscEvento) {
      const ev = disc.eventosDe().find((x) => x.id === d.dscEvento);
      return formEvento(ev.disciplinaId, ev);
    }
    if (d.dscFechar !== undefined) return fechar();
    if (d.dscArquivar) {
      const x = disc.obter(d.dscArquivar);
      await disc.salvar({ ...x, arquivada: !x.arquivada });
      fechar();
      redesenhar();
      window.desenhaMenu?.(location.hash.slice(1));
      return toast(x.arquivada ? 'Disciplina de volta ao menu' : 'Disciplina arquivada. Ela continua em Projetos > Arquivadas.');
    }
    if (d.dscApagar) {
      const x = disc.obter(d.dscApagar);
      const desfazer = await disc.apagar(d.dscApagar);
      fechar();
      location.hash = '#disciplinas';
      depois(() =>
        toast(`Disciplina apagada, com as aulas e a agenda dela. As obras e os textos continuam.`, async () => {
          await desfazer();
          location.hash = `#disciplina/${encodeURIComponent(x.id)}`;
        }),
      );
      return;
    }
    if (d.dscApagarEv) {
      const desfazer = await disc.apagarEvento(d.dscApagarEv);
      fechar();
      redesenhar();
      return toast('Evento apagado', async () => {
        await desfazer();
        redesenhar();
      });
    }
    if (d.dscApagarAula) {
      const a = disc.aula(d.dscApagarAula);
      const desfazer = await disc.apagarAula(a.id);
      fechar();
      if (typeof S !== 'undefined') {
        S.discAba = 'aulas';
        S.manterAba = true;
      }
      location.hash = `#disciplina/${encodeURIComponent(a.disciplinaId)}`;
      depois(() =>
        toast('Aula apagada', async () => {
          await desfazer();
          location.hash = `#aula/${encodeURIComponent(a.disciplinaId)}/${encodeURIComponent(a.id)}`;
        }),
      );
      return;
    }
    if (d.dscTirarNota) {
      const discId = location.hash.split('/')[1];
      const desfazer = await disc.apagarAnotacao(decodeURIComponent(discId), d.dscTirarNota);
      redesenhar();
      return toast('Anotação apagada', async () => {
        await desfazer();
        redesenhar();
      });
    }
    if (d.dscNovoTexto) {
      const x = disc.obter(d.dscNovoTexto);
      const t = await escrita.novo();
      await escrita.salvar({ ...t, projeto: x.nome, tipo: 'Artigo de disciplina' });
      location.hash = `#texto/${encodeURIComponent(t.id)}`;
      return;
    }
    if (d.dscTranscrever) {
      const a = disc.aula(d.dscTranscrever);
      await disc.salvarAula({ ...a, transcricao: { ...(a.transcricao || { feitos: 0, total: Math.max(1, Math.ceil((a.audio?.duracao || 900) / 900)) }), status: 'na_fila', erro: null, aparelho: window.rb.dados.aparelho } });
      disc.iniciarTranscricao(a.id);
      return redesenhar();
    }
    if (d.dscResumir) {
      b.disabled = true;
      b.textContent = 'Resumindo…';
      try {
        await disc.resumir(d.dscResumir);
        toast('Resumo pronto');
      } catch (err) {
        toast(err.message);
      }
      return redesenhar();
    }
    if (d.dscIr) {
      const audio = document.querySelector('[data-aula-audio] audio');
      if (!audio || !audio.src) return toast('A gravação ainda não está neste aparelho.');
      audio.currentTime = segundos(d.dscIr);
      audio.play().catch(() => {});
      return;
    }
    if (d.dscBuscar) {
      const ok = await disc.guardarParaBuscar(d.disc, d.dscBuscar, 'Citada em aula');
      redesenhar();
      return toast(ok ? 'Na lista para buscar da disciplina. Adicione o PDF à biblioteca para o tutor e o Copilot poderem usar.' : 'Já está na lista para buscar.');
    }
    if (d.dscAchei) {
      await disc.religarLeiturasPlano();
      await disc.tirarParaBuscar(decodeURIComponent(location.hash.split('/')[1]), d.dscAchei);
      return redesenhar();
    }
    if (d.dscCombinado !== undefined) {
      const a = disc.aula(d.aula);
      const c = a.resumo.combinados[Number(d.dscCombinado)];
      return formEvento(a.disciplinaId, { tipo: 'entrega', titulo: c.tarefa, data: c.prazo, inicio: '23:59' });
    }
    if (d.dscAplicarPlano !== undefined) {
      const marcados = (g) => [...document.querySelectorAll(`[data-pl="${g}"]:checked`)].map((x) => Number(x.value));
      await disc.aplicarPlano(est.planoDisc, est.plano, { aulas: marcados('aulas'), entregas: marcados('entregas'), leituras: marcados('leituras'), trilha: document.getElementById('pl-trilha')?.checked, arquivo: est.planoArquivo });
      const n = marcados('aulas').length + marcados('entregas').length + marcados('leituras').length;
      est.plano = null;
      fechar();
      redesenhar();
      return toast(`${n} ${n === 1 ? 'item salvo' : 'itens salvos'} do plano de ensino`);
    }
    if (d.grifoAulaCor) {
      if (!selecao) return;
      const s = selecao;
      selecao = null;
      pop.classList.remove('on');
      getSelection().removeAllRanges();
      await disc.grifar(s.aulaId, { seg: s.seg, ini: s.ini, fim: s.fim, texto: s.texto, tempo: s.tempo, funcao: d.grifoAulaCor });
      redesenhar();
      return toast(`Grifado como ${FUNCOES.find((f) => f.id === d.grifoAulaCor).nome.toLowerCase()}`);
    }
    if (d.grifoAula) {
      if (!getSelection().isCollapsed) return;
      const aulaId = b.closest('.transcr-real').dataset.aula;
      const desfazer = await disc.tirarGrifo(aulaId, d.grifoAula);
      redesenhar();
      return toast('Grifo tirado', async () => {
        await desfazer();
        redesenhar();
      });
    }
  });

  return { lista, tela, telaAula, montar, formEvento, menu: () => disc.ativas() };
}

export { ocorrencias };
