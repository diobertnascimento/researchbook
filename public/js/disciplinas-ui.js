// Telas de Projetos com dados reais: lista, projeto (Início, Artigos, Linha do tempo, Estúdio e Aprendizado, num menu
// flutuante), aula (gravação, transcrição grifável, resumo, anotações) e os formulários.
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
  const est = { plano: null, planoArquivo: null, planoDisc: null, audioUrl: null, audioDe: null, estudio: 'tudo' };
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

  /* ---------- Pedaços do projeto ---------- */
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const mesCurto = (dia) => MESES[Number(dia.split('-')[1]) - 1].replace('.', '');
  const diaMes = (dia) => `${Number(dia.split('-')[2])} ${mesCurto(dia)}`;
  const diaDe = (iso) => (iso ? diaLocal(new Date(iso)) : '');
  const emQuanto = (n) => (n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`);
  const maiuscula = (s) => s.replace(/^./, (c) => c.toUpperCase());
  const mesLongo = (dia, hoje = new Date()) => {
    const [a, m] = dia.split('-').map(Number);
    return maiuscula(`${new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(a, m - 1, 1))}${a !== hoje.getFullYear() ? ` de ${a}` : ''}`);
  };
  const textosDe = (d) => escrita.todos().filter((t) => t.projeto === d.nome);
  const rotaDisc = (d) => `#disciplina/${encodeURIComponent(d.id)}`;
  // As cinco seções de um projeto. O terceiro nome é o da barra do celular, onde o espaço é curto.
  const SECOES_PROJ = [['geral', 'Início', 'Início'], ['leituras', 'Leituras', 'Leituras'], ['agenda', 'Agenda', 'Agenda'], ['estudio', 'Materiais', 'Materiais'], ['aprendizado', 'Progresso', 'Progresso']];
  const IC = {
    todos: '<svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6"/></svg>',
    geral: '<svg viewBox="0 0 24 24"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/></svg>',
    leituras: '<svg viewBox="0 0 24 24"><path d="M3 5c3-1.5 6-1.5 9 1 3-2.5 6-2.5 9-1v14c-3-1.5-6-1.5-9 1-3-2.5-6-2.5-9-1z"/><path d="M12 6v14"/></svg>',
    agenda: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    estudio: '<svg viewBox="0 0 24 24"><path d="m4 20 1-5L16 4l4 4L9 19z"/><path d="m14 6 4 4"/></svg>',
    aprendizado: '<svg viewBox="0 0 24 24"><path d="M5 20V11M12 20V4M19 20v-6"/></svg>',
    pena: '<svg viewBox="0 0 24 24"><path d="m5 19 1-4L15 6l3 3-9 9z"/></svg>',
    seta: '<svg viewBox="0 0 24 24"><path d="M12 16V5M7 10l5-5 5 5M5 19h14"/></svg>',
  };
  /** Menu do projeto: flutua à esquerda no computador (os nomes aparecem ao passar o mouse) e vira a barra de baixo no celular. */
  function menuProjeto(d, aba) {
    return `<nav class="proj-menu" aria-label="Seções do projeto">
      <a class="todos" href="#disciplinas" title="Todos os projetos">${IC.todos}<span class="rot">Todos os projetos</span></a>
      ${SECOES_PROJ.map(([k, n, curto]) => `<a href="${rotaDisc(d)}" data-disc-aba="${k}" class="${k === aba ? 'on' : ''}" ${k === aba ? 'aria-current="page"' : ''} title="${n}">${IC[k]}<span class="rot"><span class="longo">${n}</span><span class="curto" aria-hidden="true">${curto}</span></span></a>`).join('')}
    </nav>`;
  }
  /** Cabeçalho das seções internas: o projeto em cima, pequeno, e o nome da seção como título da tela. */
  const cab = (d, titulo, texto, acoes = '') =>
    `<div class="topo proj-topo"><div><a class="proj-nome" href="${rotaDisc(d)}" data-disc-aba="geral">${ponto(d.cor, 10)} ${esc(d.nome)}</a><h1>${titulo}</h1><p>${texto}</p></div>${acoes ? `<div class="acoes">${acoes}</div>` : ''}</div>`;
  /** Prazo com o dia grande, como no Hoje. Tocar abre o evento. */
  function linhaPrazo(e) {
    const n = diasAte(e.dia);
    return `<li><a href="${rotaDisc({ id: e.disciplinaId })}" data-dsc-evento="${esc(e.id)}"><span class="dia-g" aria-hidden="true">${Number(e.dia.split('-')[2])}<small>${mesCurto(e.dia)}</small></span><span>${esc(e.titulo)}<small class="${n === 0 ? 'urg' : ''}">${maiuscula(emQuanto(n))}${e.inicio ? `, até ${esc(e.inicio)}` : ''}</small></span></a></li>`;
  }

  /* ---------- Lista de projetos ---------- */
  /** O que dizer de um projeto numa linha: o que acontece hoje, o prazo mais próximo e a próxima aula. */
  function resumoProjeto(d) {
    const hoje = diaLocal();
    const prox = disc.proximos(d.id, 180);
    const deHoje = prox.find((e) => e.dia === hoje && e.tipo !== 'entrega');
    const ent = prox.find((e) => e.tipo === 'entrega');
    const aula = prox.find((e) => e.tipo === 'aula' && e.dia > hoje);
    const falta = ent ? diasAte(ent.dia) : null;
    const partes = [];
    if (deHoje) partes.push(`${TIPOS_EVENTO[deHoje.tipo] || 'Compromisso'} hoje${deHoje.inicio ? `, às ${deHoje.inicio}` : ''}.`);
    if (ent) partes.push(falta <= 14 ? `${ent.titulo} vence ${emQuanto(falta)}.` : `${ent.titulo}, entrega em ${dataLonga(ent.dia)}.`);
    if (!deHoje && aula) partes.push(`Próxima aula em ${dataLonga(aula.dia)}.`);
    const hojeMesmo = !!deHoje || falta === 0;
    return { texto: partes.join(' ') || 'Nada agendado.', hojeMesmo, atencao: hojeMesmo || (falta !== null && falta <= 7), falta: falta ?? 999 };
  }
  function lista() {
    const ds = disc.ativas();
    const arquivadas = disc.todas().filter((d) => d.arquivada);
    const res = new Map(ds.map((d) => [d.id, resumoProjeto(d)]));
    // Um protagonista só: o que tem algo hoje; sem isso, o prazo mais próximo dentro de 7 dias.
    const foco = ds.filter((d) => res.get(d.id).atencao).sort((a, b) => Number(res.get(b.id).hojeMesmo) - Number(res.get(a.id).hojeMesmo) || res.get(a.id).falta - res.get(b.id).falta)[0];
    const outros = ds.filter((d) => d !== foco);
    const meta = (d) => `${plural(disc.aulasDe(d.id).length, 'aula', 'aulas')}, ${plural(disc.leiturasDe(d).length, 'obra', 'obras')}`;
    return `<div class="topo"><div><h1>Projetos</h1><p>${ds.length ? `${plural(ds.length, 'projeto', 'projetos')} em andamento.` : 'Um projeto para cada disciplina do mestrado, com as aulas, os artigos e os textos dela.'}</p></div>
        ${ds.length ? `<div class="acoes"><button class="btn" data-dsc-nova>${icone('mais')}Novo projeto</button></div>` : ''}</div>
      ${foco ? `<section class="proximo proj-atencao" aria-labelledby="pa-t"><div class="rot" id="pa-t">${res.get(foco.id).hojeMesmo ? 'Pede atenção hoje' : 'Pede atenção esta semana'}</div>
        <h2>${ponto(foco.cor, 11)} ${esc(foco.nome)}</h2><p>${esc(res.get(foco.id).texto)}</p>
        <div class="acao-l"><a class="btn prim" href="${rotaDisc(foco)}">Abrir projeto</a><span>${meta(foco)}</span></div></section>` : ''}
      ${outros.length ? `<section class="proj-lista" aria-label="${foco ? 'Os outros projetos' : 'Projetos'}">${foco ? '<h2>Os outros</h2>' : ''}<ul>${outros.map((d) => `<li><a class="proj-l" href="${rotaDisc(d)}"><span class="nome"><b>${ponto(d.cor, 10)} ${esc(d.nome)}</b><small>${esc(res.get(d.id).texto)}</small></span><span class="meta">${meta(d)}</span></a></li>`).join('')}</ul></section>` : ''}
      ${ds.length ? '' : `<section class="proximo proj-atencao"><div class="rot">Comece pelo primeiro projeto</div><p>Nome, docente e horário. Com o plano de ensino em PDF, a IA lê as aulas, as leituras e as entregas para você conferir antes de salvar.</p><div class="acao-l"><button class="btn prim" data-dsc-nova>Criar o primeiro projeto</button></div></section>`}
      ${arquivadas.length ? `<details class="arq-disc"><summary>Projetos encerrados (${arquivadas.length})</summary><ul>${arquivadas.map((d) => `<li>${ponto(d.cor)} <a href="${rotaDisc(d)}">${esc(d.nome)}</a> <small>${esc(d.semestre || '')}</small></li>`).join('')}</ul></details>` : ''}`;
  }

  /* ---------- Projeto ---------- */
  function tela(id) {
    const d = disc.obter(id);
    if (!d) return `<a class="voltar" href="#disciplinas">${icone('voltar')}Projetos</a><div class="topo"><div><h1>Projeto não encontrado</h1><p>Ele pode ter sido apagado em outro aparelho.</p></div></div>`;
    let aba = typeof S !== 'undefined' && S.discAba ? S.discAba : 'geral';
    if (aba === 'textos') aba = 'estudio';
    const corpo = { geral: abaInicio, aulas: abaAulas, leituras: abaLeituras, agenda: abaLinha, estudio: abaEstudio, aprendizado: abaAprendizado }[aba] || abaInicio;
    // A lista de todas as aulas é uma página dentro do Início.
    return `${menuProjeto(d, aba === 'aulas' ? 'geral' : aba)}<a class="voltar proj-voltar" href="#disciplinas">${icone('voltar')}Projetos</a>${corpo(d)}`;
  }

  function abaInicio(d) {
    const hoje = diaLocal();
    const prox = disc.proximos(d.id, 180);
    const compromissos = prox.filter((e) => e.tipo !== 'entrega');
    const prazos = prox.filter((e) => e.tipo === 'entrega').slice(0, 3);
    const foco = compromissos[0];
    const as = disc.aulasDe(d.id);
    const ls = disc.leiturasDe(d);
    const ts = textosDe(d);
    const quem = [d.docente, d.semestre, horario(d)].filter(Boolean).join(', ');
    const nota = (d.anotacoes || [])[0];
    let painel;
    if (foco) {
      const quando = foco.dia === hoje ? `Hoje${foco.inicio ? `, às ${foco.inicio}` : ''}` : `${maiuscula(NOMES_DIA[DIAS[new Date(`${foco.dia}T12:00:00`).getDay()]])}, ${dataLonga(foco.dia)}${foco.inicio ? `, às ${foco.inicio}` : ''}`;
      const acao = foco.tipo === 'aula' ? `<button class="btn prim" data-dsc-gravacao="${esc(d.id)}">${icone('upload')}Enviar gravação de aula</button>` : foco.tipo === 'estudo' ? `<a class="btn prim" href="${rotaDisc(d)}" data-disc-aba="leituras">Abrir as leituras</a>` : '';
      painel = `<section class="proximo proj-agora" aria-labelledby="pg-t"><div class="rot" id="pg-t">${esc(quando)}</div><h2>${esc(foco.titulo)}</h2>
        ${nota ? `<p>Você anotou: ${esc(nota.texto)}</p>` : ''}${acao ? `<div class="acao-l">${acao}</div>` : ''}</section>`;
    } else {
      painel = `<section class="proximo proj-agora"><div class="rot">Nada agendado</div><p>Agende as aulas, as entregas e as sessões de estudo deste projeto. Elas aparecem aqui e no Hoje.</p>
        <div class="acao-l"><button class="btn prim" data-dsc-agendar="${esc(d.id)}">Agendar</button></div></section>`;
    }
    return `<div class="topo"><div><h1 class="tit-conteudo">${ponto(d.cor, 14)} ${esc(d.nome)}${d.arquivada ? ' <span class="chip">Encerrado</span>' : ''}</h1>
        <p>${quem ? `${esc(quem)}. ` : 'Complete docente, semestre e horário em Editar. '}${plural(as.length, 'aula', 'aulas')}, ${plural(ls.length, 'obra', 'obras')}, ${plural(ts.length, 'texto', 'textos')}.</p></div>
        <div class="acoes"><button class="btn fant" data-dsc-editar="${esc(d.id)}">Editar</button>${foco ? `<button class="btn" data-dsc-agendar="${esc(d.id)}">${icone('mais')}Agendar</button>` : ''}</div></div>
      ${painel}
      <div class="proj-cols">
        <div class="proj-col">
          ${prazos.length ? `<section class="prazos" aria-labelledby="pz-t"><h2 id="pz-t">Prazos</h2><ul>${prazos.map(linhaPrazo).join('')}</ul></section>` : ''}
          ${compromissos.length ? `<section class="proj-sec" aria-labelledby="ps-t"><h2 id="ps-t">A seguir</h2><div class="evs">${compromissos.slice(0, 4).map((e) => linhaEvento(e)).join('')}</div><a class="lnk-sec" href="${rotaDisc(d)}" data-disc-aba="agenda">Ver a agenda</a></section>` : ''}
          <section class="proj-sec" aria-labelledby="pn-t"><h2 id="pn-t">Anotações</h2>
            <form class="nota-rap" data-dsc-anotar="${esc(d.id)}"><input id="dsc-nota" placeholder="Anote algo rápido" aria-label="Nova anotação" autocomplete="off"><button class="btn" type="submit">Anotar</button></form>
            ${(d.anotacoes || []).length ? `<ul class="notas-d">${d.anotacoes.map((n) => `<li><span>${esc(n.texto)}</span><small>${new Date(n.em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} <button class="btn fant mini" data-dsc-tirar-nota="${esc(n.id)}" aria-label="Apagar anotação">Apagar</button></small></li>`).join('')}</ul>` : ''}</section>
        </div>
        <div class="proj-col">
          <section class="proj-sec" aria-labelledby="pa-t"><h2 id="pa-t">Aulas <a class="lnk-sec" href="${rotaDisc(d)}" data-disc-aba="aulas">${as.length > 3 ? `Ver as ${as.length}` : 'Todas as aulas'}</a></h2>
            ${as.length ? `<div class="aulas">${as.slice(0, 3).map((a) => aulaLinha(d, a)).join('')}</div>` : '<p class="mute">Nenhuma aula ainda. Envie a gravação de uma aula: a IA transcreve, resume e encontra os conceitos e as leituras citadas.</p>'}
            ${foco?.tipo === 'aula' ? '' : `<button class="mt-3 btn" data-dsc-gravacao="${esc(d.id)}">${icone('upload')}Enviar gravação de aula</button>`}
          </section>
        </div>
      </div>`;
  }

  function abaAulas(d) {
    const as = disc.aulasDe(d.id);
    return `${cab(d, 'Aulas', as.length ? `${plural(as.length, 'aula registrada', 'aulas registradas')}, da mais recente para a mais antiga.` : 'As aulas gravadas ou registradas deste projeto.')}
    <section class="larg-pagina bloco">
      ${as.length ? `<div class="aulas">${as.map((a) => aulaLinha(d, a)).join('')}</div>` : '<p class="mute">Nenhuma aula ainda.</p>'}
      <div class="mt-3 ia-linha"><button class="btn prim" data-dsc-gravacao="${esc(d.id)}">${icone('upload')}Enviar gravação de aula</button><button class="btn fant" data-dsc-nova-aula="${esc(d.id)}">Registrar aula sem gravação</button></div>
      <details class="mt-3 pt-4 borda-topo ajuda-det"><summary>Como funcionam as gravações?</summary><p class="m-0 mt-3 t-meta mute">O áudio fica neste aparelho e no seu Drive. A IA transcreve em partes de 15 minutos; se você fechar o app, a transcrição continua de onde parou quando você abrir de novo neste aparelho. Depois ela resume, lista os conceitos e as leituras citadas e sugere perguntas para estudar. A transcrição pode ser grifada com as mesmas cores dos textos. Grave só com o consentimento de quem dá a aula e da turma.</p></details>
    </section>`;
  }

  function abaLeituras(d) {
    const ls = disc.leiturasDe(d);
    const plano = d.leiturasPlano || [];
    return `${cab(d, 'Leituras', 'As obras da sua biblioteca marcadas com este projeto e as leituras do plano de ensino.')}
    <div class="proj-grid"><section class="bloco">
      <h3>Na biblioteca</h3>
      ${ls.length ? `<div class="lst-leit">${ls.map((l) => `<a class="lc" href="#leitor/${encodeURIComponent(l.id)}"><b class="forte">${esc(citacao(l))}</b> ${esc(l.titulo)}<span>${pipsHTML(l.etapa || 0)} ${ETAPAS[l.etapa || 0]}</span></a>`).join('')}</div>` : '<p class="mute">Nenhuma obra marcada com este projeto. Na obra, selecione “Corrigir os dados” e escreva o nome do projeto no campo Projeto.</p>'}
      ${plano.length ? `<h3 class="mt-6">Do plano de ensino</h3><ul class="plano-l">${plano.map((p) => {
        const l = p.leituraId && bib.obter(p.leituraId);
        return `<li><span class="chip ${p.obrigatoria ? '' : 'leve'}">${p.obrigatoria ? 'Obrigatória' : 'Complementar'}</span><span>${esc(p.referencia)}</span>${l ? `<a class="btn fant" href="#leitor/${encodeURIComponent(l.id)}">Abrir</a>` : '<span class="t-legenda mute">Fora da biblioteca</span>'}</li>`;
      }).join('')}</ul>` : ''}
      </section>
      <aside class="lado"><section class="bloco"><h3>Plano de ensino</h3>${d.plano ? `<p class="m-0 mb-3">${esc(d.plano.nome)} está no seu Drive.</p>` : '<p class="m-0 mb-3">Envie o PDF: a IA lê as aulas, as leituras e as entregas, e você confere antes de salvar.</p>'}<label class="btn">${d.plano ? 'Ler outro plano' : 'Ler o plano de ensino'}<input type="file" accept="application/pdf" data-dsc-plano="${esc(d.id)}" hidden></label></section>
      ${(d.paraBuscar || []).length ? `<section class="bloco"><h3>Para adicionar</h3><ul class="notas-d">${d.paraBuscar.map((p) => `<li>${esc(p.texto)}<small>${esc(p.origem || '')} <button class="lnk" data-dsc-achei="${esc(p.id)}">Já adicionei</button></small></li>`).join('')}</ul></section>` : ''}
      </aside></div>`;
  }

  /** O que já aconteceu no projeto, do mais recente para o mais antigo. Só entra o que tem data guardada. */
  function passadoDe(d) {
    const hoje = diaLocal();
    const itens = [];
    for (const a of disc.aulasDe(d.id)) if (a.data && a.data <= hoje) itens.push({ dia: a.data, rot: `Aula ${a.numero}`, tit: a.tema || 'Sem tema', href: `#aula/${encodeURIComponent(d.id)}/${encodeURIComponent(a.id)}` });
    const fichas = window.rb?.fichUI?.todos() || [];
    for (const l of disc.leiturasDe(d)) {
      if (l.adicionadaEm) itens.push({ dia: diaDe(l.adicionadaEm), rot: 'Obra adicionada', tit: l.titulo, href: `#leitor/${encodeURIComponent(l.id)}` });
      const f = fichas.find((x) => x.leituraId === l.id);
      if (f?.concluidoEm) itens.push({ dia: diaDe(f.concluidoEm), rot: 'Fichamento concluído', tit: l.titulo, href: `#fichamento/${encodeURIComponent(l.id)}` });
    }
    for (const t of textosDe(d)) if (t.criadoEm) itens.push({ dia: diaDe(t.criadoEm), rot: 'Texto começado', tit: t.titulo, href: `#texto/${encodeURIComponent(t.id)}` });
    for (const m of disc.materiaisDe(d.id)) itens.push({ dia: diaDe(m.criadoEm), rot: m.tipo === 'nota' ? 'Nota escrita' : m.tipo === 'arquivo' ? 'Arquivo enviado' : 'Link guardado', tit: m.titulo || (m.tipo === 'nota' ? 'Nota sem título' : m.url), aba: 'estudio' });
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const de = diaDe(d.criadoEm) || '2000-01-01';
    for (const e of ocorrencias(disc.eventosDe(d.id).filter((x) => x.tipo === 'entrega'), de, diaLocal(ontem))) itens.push({ dia: e.dia, rot: 'Entrega', tit: e.titulo });
    return itens.filter((x) => x.dia && x.dia <= hoje).sort((a, b) => b.dia.localeCompare(a.dia));
  }
  function abaLinha(d) {
    const occ = disc.proximos(d.id, 180);
    const hoje = new Date();
    const grupo = (e) => {
      const n = diasAte(e.dia, hoje);
      const dow = hoje.getDay();
      if (n <= 6 - dow) return 'Esta semana';
      if (n <= 13 - dow) return 'Próxima semana';
      return mesLongo(e.dia, hoje);
    };
    const grupos = [];
    for (const e of occ) {
      const g = grupo(e);
      if (grupos.at(-1)?.[0] !== g) grupos.push([g, []]);
      grupos.at(-1)[1].push(e);
    }
    const passado = passadoDe(d);
    const meses = [];
    for (const x of passado) {
      const nome = mesLongo(x.dia, hoje);
      if (meses.at(-1)?.[0] !== nome) meses.push([nome, []]);
      meses.at(-1)[1].push(x);
    }
    const ligada = window.rb?.agenda?.estado().ligada;
    return `${cab(d, 'Agenda', 'O que vem a seguir e o que já aconteceu neste projeto.', `<button class="btn" data-dsc-agendar="${esc(d.id)}">${icone('mais')}Agendar</button>`)}
      <div class="proj-linha">
      <section class="proj-sec" aria-labelledby="lt-seg"><h2 id="lt-seg">A seguir</h2>
        ${grupos.length ? grupos.map(([g, es]) => `<h3>${g}</h3><div class="evs">${es.map((e) => linhaEvento(e)).join('')}</div>`).join('') : '<p class="mute">Nada agendado nos próximos meses.</p>'}
        <p class="t-meta mute linha-nota">${ligada ? 'Os eventos vão para a agenda researchbook da sua conta Google. Se você mudar ou apagar aqui, muda ou some lá também.' : 'Os eventos ficam no researchbook, em todos os seus aparelhos. Para vê-los também no Google Agenda, ligue em Ajustes.'} <a class="lnk" href="#ajustes/agenda">Ajustes da agenda</a></p></section>
      <section class="proj-sec" aria-labelledby="lt-ate"><h2 id="lt-ate">Até aqui</h2>
        ${meses.length ? meses.map(([nome, xs]) => `<h3>${nome}</h3><ul class="linha-l">${xs.map((x) => `<li><span class="quando">${diaMes(x.dia)}</span><span><small>${esc(x.rot)}</small>${x.href ? `<a href="${x.href}">${esc(x.tit)}</a>` : x.aba ? `<a href="${rotaDisc(d)}" data-disc-aba="${x.aba}">${esc(x.tit)}</a>` : `<span>${esc(x.tit)}</span>`}</span></li>`).join('')}</ul>`).join('') : '<p class="mute">Ainda sem história: as aulas, as obras, os textos e as entregas deste projeto aparecem aqui conforme acontecem.</p>'}</section>
      </div>`;
  }

  /* ---------- Estúdio: tudo o que faz parte do projeto, escrito ou enviado ---------- */
  function itensDoEstudio(d) {
    const itens = [];
    for (const t of textosDe(d)) {
      const palavras = medirAutoria(t).total;
      itens.push({ origem: 'escrito', tit: t.titulo, det: `Texto. ${t.passo <= 3 ? 'Em preparação' : t.passo === 4 ? `Escrevendo, ${plural(palavras, 'palavra', 'palavras')}` : `Em revisão, ${plural(palavras, 'palavra', 'palavras')}`}`, em: t.atualizadoEm || t.criadoEm, href: `#texto/${encodeURIComponent(t.id)}` });
    }
    for (const m of disc.materiaisDe(d.id)) {
      if (m.tipo === 'nota') {
        const linhas = (m.texto || '').split('\n').filter((l) => l.trim()).length;
        itens.push({ origem: 'escrito', tit: m.titulo || 'Nota sem título', det: `Nota, ${plural(linhas, 'linha', 'linhas')}`, em: m.atualizadoEm || m.criadoEm, nota: m.id, mat: m.id });
      } else if (m.tipo === 'arquivo') {
        const a = m.arquivo || {};
        const tipo = /^image\//.test(a.tipo) ? 'Foto' : a.tipo === 'application/pdf' ? 'PDF' : `Arquivo${/\.\w{2,5}$/.test(a.nome || '') ? ` ${a.nome.split('.').pop().toLowerCase()}` : ''}`;
        const mb = a.tamanho >= 1048576 ? `${(a.tamanho / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round((a.tamanho || 0) / 1024))} KB`;
        itens.push({ origem: 'enviado', tit: m.titulo, det: `${tipo}, ${mb}${a.pendente ? '. Guardado neste aparelho; vai para o Drive quando houver internet' : ''}`, em: m.criadoEm, arquivo: m.id, mat: m.id });
      } else itens.push({ origem: 'enviado', tit: m.titulo || m.url, det: 'Link. Só o endereço fica guardado', em: m.criadoEm, url: m.url, mat: m.id });
    }
    for (const a of disc.aulasDe(d.id).filter((x) => x.audio)) {
      const st = a.transcricao?.status;
      itens.push({ origem: 'enviado', tit: `Aula ${a.numero}${a.tema ? `: ${a.tema}` : ''}`, det: `Áudio${a.audio.duracao ? `, ${duracaoTexto(a.audio.duracao)}` : ''}. ${st === 'pronta' ? 'Transcrito' : st === 'erro' ? 'A transcrição parou' : st ? 'Transcrevendo' : 'Gravação guardada'}`, em: a.data ? `${a.data}T12:00:00` : a.criadoEm, href: `#aula/${encodeURIComponent(d.id)}/${encodeURIComponent(a.id)}` });
    }
    if (d.plano) itens.push({ origem: 'enviado', tit: 'Plano de ensino', det: `PDF. ${d.plano.nome || ''}`.trim(), em: d.plano.em || d.criadoEm, aba: 'leituras' });
    return itens.sort((a, b) => (b.em || '').localeCompare(a.em || ''));
  }
  function abaEstudio(d) {
    const itens = itensDoEstudio(d);
    const escritos = itens.filter((x) => x.origem === 'escrito').length;
    const filtro = ['escrito', 'enviado'].includes(est.estudio) ? est.estudio : 'tudo';
    const mostra = itens.filter((x) => filtro === 'tudo' || x.origem === filtro);
    const hoje = diaLocal();
    const quando = (iso) => (diaDe(iso) === hoje ? 'hoje' : diaDe(iso) ? diaMes(diaDe(iso)) : '');
    const titulo = (x) => (x.href ? `<a class="est-t" href="${x.href}">${esc(x.tit)}</a>` : x.arquivo ? `<button class="est-t" data-dsc-abrir-arquivo="${esc(x.arquivo)}" data-ocupado="Abrindo…">${esc(x.tit)}</button>` : x.nota ? `<button class="est-t" data-dsc-nota="${esc(x.nota)}">${esc(x.tit)}</button>` : x.url ? `<a class="est-t" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.tit)}</a>` : `<a class="est-t" href="${rotaDisc(d)}" data-disc-aba="${x.aba}">${esc(x.tit)}</a>`);
    return `${cab(d, 'Materiais', 'Tudo o que faz parte deste projeto: o que você escreve aqui e o que traz de fora.')}
      <section class="proximo estudio-add" aria-labelledby="ea-t"><div class="rot" id="ea-t">Adicionar ao projeto</div>
        <div class="acao-l"><button class="btn prim" data-dsc-novo-texto="${esc(d.id)}">Escrever texto</button><button class="btn" data-dsc-nota-nova="${esc(d.id)}">Escrever nota</button><button class="btn" data-dsc-gravacao="${esc(d.id)}">Enviar gravação de aula</button><button class="btn" data-dsc-arquivo-novo="${esc(d.id)}">Enviar arquivo ou foto</button><button class="btn" data-dsc-link-novo="${esc(d.id)}">Guardar link</button></div></section>
      <section class="proj-sec" aria-labelledby="en-t"><h2 id="en-t">Neste projeto</h2>
        <div class="alterna estudio-filtro" role="group" aria-label="Mostrar">${[['tudo', `Tudo, ${itens.length}`], ['escrito', `Escritos por você, ${escritos}`], ['enviado', `Enviados, ${itens.length - escritos}`]].map(([k, n]) => `<button class="txt" data-dsc-estudio="${k}" aria-pressed="${filtro === k}">${n}</button>`).join('')}</div>
        ${mostra.length ? `<ul class="estudio">${mostra.map((x) => `<li class="${x.origem}"><span class="est-ic" aria-hidden="true">${x.origem === 'escrito' ? IC.pena : IC.seta}</span><span class="est-c">${titulo(x)}<small>${x.origem === 'escrito' ? 'Escrito por você' : 'Enviado'}. ${esc(x.det)}</small></span><span class="quando">${quando(x.em)}</span>${x.mat ? `<button class="btn fant mini" data-dsc-mat-apagar="${esc(x.mat)}" aria-label="Apagar ${esc(x.tit)}">Apagar</button>` : '<span></span>'}</li>`).join('')}</ul>` : `<p class="mute">${itens.length ? 'Nada deste tipo no projeto.' : 'Nada neste projeto ainda. Comece por um texto, uma nota ou a gravação de uma aula.'}</p>`}
      </section>`;
  }

  /* ---------- Aprendizado: retrato do que foi construído no projeto, sem IA ---------- */
  function abaAprendizado(d) {
    const ls = disc.leiturasDe(d);
    const as = disc.aulasDe(d.id);
    const lidas = ls.filter((l) => (l.etapa || 0) >= 2).length;
    const fichadas = ls.filter((l) => (l.etapa || 0) >= 4).length;
    const gravadas = as.filter((a) => a.audio).length;
    const idsObras = new Set(ls.map((l) => l.id));
    const grifos = [...ls.flatMap((l) => bib.grifosDe(l.id)), ...as.flatMap((a) => a.grifos || [])];
    const porFuncao = FUNCOES.map((f) => ({ ...f, n: grifos.filter((g) => g.funcao === f.id).length }));
    const maior = Math.max(1, ...porFuncao.map((f) => f.n));
    const cartoes = (window.rb?.cartoes?.todos() || []).filter((c) => c.origem?.disciplinaId === d.id || idsObras.has(c.origem?.leituraId));
    const dificil = (c) => (c.estado?.lapsos || 0) >= 2;
    const firme = (c) => !dificil(c) && (c.estado?.intervalo || 0) >= 21;
    const grupos = [
      ['firmes', 'firme', cartoes.filter(firme), 'Intervalo de revisão de 3 semanas ou mais.'],
      ['em revisão', 'em revisão', cartoes.filter((c) => !dificil(c) && !firme(c) && c.estado?.repeticoes), 'Em revisão, com intervalo ainda curto.'],
      ['difíceis', 'difícil', cartoes.filter(dificil), 'Com dois erros ou mais.'],
      ['novos', 'novo', cartoes.filter((c) => !dificil(c) && !c.estado?.repeticoes), 'Ainda sem revisão.'],
    ].filter(([, , cs]) => cs.length);
    const vencem = cartoes.filter((c) => !c.suspenso && (!c.estado?.proxima || new Date(c.estado.proxima).getTime() <= Date.now())).length;
    const desde = diaDe(d.criadoEm);
    const ate = ls.length || as.length
      ? `Você leu ${ls.length ? `${lidas} de ${plural(ls.length, 'obra', 'obras')}` : 'nenhuma obra'}, fichou ${fichadas} e tem ${plural(gravadas, 'aula gravada', 'aulas gravadas')}.`
      : 'Ainda não há obras nem aulas neste projeto.';
    return `${cab(d, 'Progresso', `O que você construiu em ${esc(d.nome)}${desde ? ` desde ${dataLonga(desde)}` : ''}. Contado pelo app, sem IA.`)}
      <section class="proximo proj-ate" aria-labelledby="ap-ate"><div class="rot" id="ap-ate">Até aqui</div><p>${ate}</p></section>
      <div class="proj-cols">
        <div class="proj-col">
          <section class="proj-sec" aria-labelledby="ap-leu"><h2 id="ap-leu">O que você leu</h2>
            ${ls.length ? `<p class="t-meta mute">Cada traço é uma etapa: em leitura, lida, em fichamento, fichada.</p><ul class="apr-obras">${ls.map((l) => `<li><a href="#leitor/${encodeURIComponent(l.id)}">${esc(l.titulo)}</a><small>${esc(citacao(l))}. ${ETAPAS[l.etapa || 0]}</small>${pipsHTML(l.etapa || 0)}</li>`).join('')}</ul>` : '<p class="mute">Nenhuma obra marcada com este projeto. Na obra, selecione “Corrigir os dados” e escreva o nome do projeto no campo Projeto.</p>'}
          </section>
        </div>
        <div class="proj-col">
          <section class="proj-sec" aria-labelledby="ap-grifou"><h2 id="ap-grifou">O que você grifou</h2>
            ${grifos.length ? `<ul class="apr-grifos">${porFuncao.map((f) => `<li><span>${f.nome}</span><span class="apr-barra"><i class="c-${f.id}" style="width:${Math.round((f.n / maior) * 100)}%"></i></span><b>${f.n}</b></li>`).join('')}</ul>` : '<p class="mute">Nenhum grifo nas obras nem nas aulas deste projeto.</p>'}
          </section>
          <section class="proj-sec" aria-labelledby="ap-sabe"><h2 id="ap-sabe">O que você já sabe</h2>
            ${grupos.length ? `<ul class="apr-cartoes">${grupos.map(([varios, um, cs, obs]) => `<li><b>${cs.length} ${cs.length === 1 ? um : varios}</b><small>${obs}</small>${varios === 'difíceis' ? cs.slice(0, 3).map((c) => `<span class="apr-q">${esc(c.pergunta)}</span>`).join('') : ''}</li>`).join('')}</ul>${vencem ? `<p class="t-meta mute">${plural(vencem, 'cartão deste projeto vence', 'cartões deste projeto vencem')} hoje.</p><a class="btn" href="#cartoes">Revisar os cartões de hoje</a>` : ''}` : '<p class="mute">Nenhum cartão deste projeto. Os cartões nascem dos grifos de uma obra ou de uma aula, quando você pede.</p>'}
          </section>
        </div>
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
      <div class="topo"><div><h1 class="tit-conteudo">Aula ${a.numero}${a.tema ? `: ${esc(a.tema)}` : ''}</h1><p>${dataLonga(a.data)}${a.audio?.duracao ? `, ${duracaoTexto(a.audio.duracao)}` : ''}. ${stAula(a)}</p></div>
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
      return `<section class="editor"><h2>A transcrição parou</h2><div class="erro-ia" role="alert"><p>${esc(t.erro || 'O Gemini não respondeu. Tente de novo em instantes.')}</p>${config ? '<a class="btn" href="#ajustes">Conectar o Gemini</a>' : ''}</div><p class="instr">${t.feitos ? `${t.feitos} de ${t.total} partes já estão prontas e não serão refeitas.` : ''}</p><button class="btn prim" data-dsc-transcrever="${esc(a.id)}">Tentar de novo</button></section>`;
    }
    const outro = t.aparelho && t.aparelho !== window.rb?.dados?.aparelho && !disc.emAndamento(a.id);
    const pct = Math.round(((t.feitos || 0) / (t.total || 1)) * 100);
    const fase = t.status === 'enviando' ? 'Enviando o áudio para a IA' : t.status === 'resumindo' ? 'Transcrição pronta. Resumindo a aula' : t.status === 'na_fila' ? 'Na fila para transcrever' : `Transcrevendo: parte ${Math.min((t.feitos || 0) + 1, t.total)} de ${t.total}`;
    return `<section class="editor"><h2>${fase}</h2>
      <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progresso da transcrição"><i style="width:${t.status === 'resumindo' ? 100 : pct}%"></i></div>
      <p class="instr">${outro ? 'A transcrição começou em outro aparelho e continua lá quando ele abrir o app.' : 'Pode continuar usando o app. Se fechar, a transcrição continua de onde parou quando você abrir de novo neste aparelho.'}</p>
      ${outro ? `<button class="btn" data-dsc-transcrever="${esc(a.id)}">Continuar neste aparelho</button>` : ''}</section>${notasHTML(a)}`;
  }

  function notasHTML(a) {
    return `<section class="mt-4 editor"><h2>Suas anotações</h2><p class="instr">O que você anotou da aula. Fica separado da transcrição e é salvo sozinho.</p><div class="campo"><textarea id="dsc-notas-aula" data-dsc-notas="${esc(a.id)}" style="min-height:180px" aria-label="Suas anotações da aula">${esc(a.notas || '')}</textarea></div><small class="mute" id="dsc-notas-st"></small></section>`;
  }

  function leiturasCitadas(d, leituras) {
    return leituras
      .map((x) => {
        const l = x.leituraId && bib.obter(x.leituraId);
        if (l) return `<a class="lc" href="#leitor/${encodeURIComponent(l.id)}">${esc(citacao(l))}<span>Na biblioteca, ${ETAPAS[l.etapa || 0].toLowerCase()}. ${esc(x.o_que_foi_dito || '')}</span></a>`;
        const ja = (d.paraBuscar || []).some((p) => p.texto === x.como_foi_dito);
        return `<div class="lc"><b class="forte">${esc(x.como_foi_dito)}</b><span>${esc(x.o_que_foi_dito || '')} Fora da biblioteca.</span>${ja ? '<span>Na lista para adicionar.</span>' : `<button class="mt-2 btn mini" data-dsc-buscar="${esc(x.como_foi_dito)}" data-disc="${esc(d.id)}">Marcar para adicionar</button>`}</div>`;
      })
      .join('');
  }

  function resumoHTML(d, a) {
    const r = a.resumo;
    if (!r) return `<section class="editor"><h2>Resumo da aula</h2><p class="instr">O resumo ainda não foi feito.</p><button class="btn prim" data-dsc-resumir="${esc(a.id)}" data-ocupado="Resumindo…">Resumir a aula</button></section>`;
    const tempo = (t) => (t ? `<button class="ts" data-dsc-ir="${esc(t)}">${esc(t)}</button>` : '');
    return `<section class="editor"><h2>Resumo da aula</h2><p class="instr">Feito pela IA a partir da transcrição. Cada ponto foi conferido no que foi dito; selecione o tempo para ouvir.</p>
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
        texto = esc(bruto).replace(/\u0001([^\u0002]+)\u0002/g, (_, id) => `<mark class="${esc((a.grifos.find((g) => g.id === id) || {}).funcao)}" data-grifo-aula="${esc(id)}" title="Selecione para apagar o grifo">`).replace(/\u0003/g, '</mark>');
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
    abrirModal(`<h2 id="modal-tit">${editando ? 'Editar projeto' : 'Novo projeto'}</h2><p>${editando ? 'O nome também muda nas obras e nos textos marcados com ele.' : 'Só o nome é obrigatório. Com o plano de ensino, a IA lê aulas, leituras e entregas para você conferir antes de salvar.'}</p>
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
        <div class="pe">${editando ? `<button type="button" class="btn fant" data-dsc-arquivar="${esc(d.id)}">${d.arquivada ? 'Reabrir projeto' : 'Encerrar projeto'}</button><button type="button" class="btn fant perigo" data-dsc-apagar="${esc(d.id)}">Apagar projeto</button><span class="cresce"></span>` : ''}<button type="button" class="btn fant" data-dsc-fechar>Cancelar</button><button class="btn prim" type="submit">${editando ? 'Salvar' : 'Criar projeto'}</button></div>
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
    abrirModal(`<h2 id="modal-tit">${a ? 'Editar aula' : 'Enviar gravação de aula'}</h2><p>${a ? esc(d.nome) : 'A IA transcreve, resume e encontra os conceitos e as leituras citadas. A gravação fica neste aparelho e no seu Drive.'}</p>
      <form id="dsc-aula-form" data-disc="${esc(d.id)}" data-aula="${esc(a?.id || '')}" data-modo="${a ? 'editar' : 'gravacao'}">
        <div class="linha2">
          <div class="campo"><label for="aula-data">Data da aula</label><input id="aula-data" type="date" required value="${esc(a?.data || diaLocal())}"></div>
          <div class="campo"><label for="aula-tema">Tema <span>opcional</span></label><input id="aula-tema" value="${esc(a?.tema || '')}"></div>
        </div>
        ${a ? '' : `<div class="campo"><label for="aula-arquivo">Gravação (MP3, M4A, WAV, OGG)</label><input id="aula-arquivo" type="file" accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm" required></div>
        <label class="check"><input type="checkbox" id="aula-transcrever" checked>Transcrever e resumir com a IA</label>
        <p class="t-legenda m-0 mt-n1 mb-3 mute-2">Grave só com o consentimento de quem dá a aula e da turma.</p>`}
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
    abrirModal(`<h2 id="modal-tit">Lendo o plano de ensino</h2><p role="status">A IA está lendo ${esc(arquivo.name)}. Leva alguns segundos.</p>`);
    try {
      est.plano = await disc.lerPlano(arquivo, { nome: d.nome, semestre: d.semestre });
      est.planoArquivo = arquivo;
      est.planoDisc = discId;
      modalPlano();
    } catch (err) {
      const config = err instanceof ErroIA && ERROS_DE_CONFIG.includes(err.codigo);
      abrirModal(`<h2 id="modal-tit">Não deu para ler o plano</h2><div class="erro-ia" role="alert"><p>${esc(err.message)}</p></div><div class="pe">${config ? '<a class="btn" href="#ajustes">Conectar o Gemini</a>' : ''}<button class="btn prim" data-dsc-fechar>Fechar</button></div>`);
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
      if (disc.todas().some((x) => x.nome.toLowerCase() === nome.toLowerCase() && x.id !== antes.id)) return toast('Já existe um projeto com esse nome.');
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
        else depois(() => toast('Projeto criado'));
      } else {
        redesenhar();
        toast('Projeto salvo');
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
      return;
    }
    if (f.id === 'dsc-link-form') {
      e.preventDefault();
      let url = document.getElementById('mat-url').value.trim();
      if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
      try {
        await disc.salvarMaterial({ disciplinaId: f.dataset.disc, tipo: 'link', titulo: document.getElementById('mat-titulo').value.trim(), url });
      } catch (err) {
        return toast(err.message);
      }
      fechar();
      redesenhar();
      toast('Link guardado no projeto');
    }
  });

  /* ---------- Estúdio: arquivo ou foto ---------- */
  // O campo de arquivo fica fora da tela desenhada, para a escolha não se perder se a página se redesenhar.
  const entradaArquivo = Object.assign(document.createElement('input'), { type: 'file', multiple: true, hidden: true });
  entradaArquivo.dataset.dscArquivo = '';
  document.body.append(entradaArquivo);
  entradaArquivo.addEventListener('change', async () => {
    const arquivos = [...entradaArquivo.files];
    const discId = entradaArquivo.dataset.disc;
    entradaArquivo.value = '';
    let guardados = 0;
    for (const a of arquivos) {
      try {
        await disc.guardarArquivoDoProjeto(discId, a);
        guardados++;
      } catch (err) {
        toast(`${a.name}: ${err.message}`);
      }
    }
    redesenhar();
    if (guardados) toast(guardados === 1 ? 'Arquivo guardado no projeto' : `${guardados} arquivos guardados no projeto`);
  });
  let urlAberta = null;
  async function abrirArquivo(id) {
    const m = disc.material(id);
    const r = await disc.obterArquivoDoMaterial(id);
    if (r.erro) return toast(r.erro);
    if (urlAberta) URL.revokeObjectURL(urlAberta);
    urlAberta = URL.createObjectURL(r.blob);
    if (/^image\//.test(m.arquivo.tipo)) {
      return abrirModal(`<h2 id="modal-tit">${esc(m.titulo)}</h2><img class="est-foto" src="${urlAberta}" alt="${esc(m.titulo)}"><div class="pe"><span class="cresce"></span><a class="btn fant" href="${urlAberta}" download="${esc(m.arquivo.nome)}">Baixar</a><button class="btn" data-dsc-fechar>Fechar</button></div>`);
    }
    // Os outros tipos são baixados: o app não abre arquivo de fora dentro dele.
    const a = Object.assign(document.createElement('a'), { href: urlAberta, download: m.arquivo.nome });
    document.body.append(a);
    a.click();
    a.remove();
    toast('Arquivo baixado para este aparelho');
  }

  /* ---------- Estúdio: nota (gravada sozinha enquanto é escrita) e link ---------- */
  let notaTimer = null;
  let notaPendente = null;
  function modalNota(discId, m = null) {
    abrirModal(`<h2 id="modal-tit">Nota</h2><p>Fica nos Materiais deste projeto. É salva sozinha enquanto você escreve.</p>
      <div id="dsc-nota-form" data-disc="${esc(discId)}" data-id="${esc(m?.id || '')}">
        <div class="campo"><label for="mat-titulo">Título</label><input id="mat-titulo" data-dsc-mat-campo value="${esc(m?.titulo || '')}" autocomplete="off"></div>
        <div class="campo"><label for="mat-texto">Texto</label><textarea id="mat-texto" rows="10" data-dsc-mat-campo>${esc(m?.texto || '')}</textarea></div>
        <div class="pe">${m ? `<button type="button" class="btn fant perigo" data-dsc-mat-apagar="${esc(m.id)}">Apagar nota</button>` : ''}<span class="cresce"></span><span class="t-legenda mute" id="mat-st" role="status">${m ? 'Salvo' : ''}</span><button type="button" class="btn" data-dsc-mat-fechar>Fechar</button></div>
      </div>`);
  }
  function modalLink(discId) {
    abrirModal(`<h2 id="modal-tit">Guardar link</h2><p>Só o endereço fica guardado no projeto; o app não copia o conteúdo da página.</p>
      <form id="dsc-link-form" data-disc="${esc(discId)}">
        <div class="campo"><label for="mat-url">Endereço</label><input id="mat-url" type="text" inputmode="url" required placeholder="https://" autocomplete="off"></div>
        <div class="campo"><label for="mat-titulo">Nome <span>opcional</span></label><input id="mat-titulo" autocomplete="off"></div>
        <div class="pe"><span class="cresce"></span><button type="button" class="btn fant" data-dsc-fechar>Cancelar</button><button class="btn prim" type="submit">Guardar link</button></div>
      </form>`);
  }
  /** Grava a nota aberta. A primeira gravação cria o registro; nota vazia e nunca gravada não cria nada. */
  async function gravarNota() {
    clearTimeout(notaTimer);
    const p = notaPendente;
    notaPendente = null;
    if (!p) return;
    const atual = p.id ? disc.material(p.id) : null;
    if (!atual && !p.titulo && !p.texto.trim()) return;
    const salvo = await disc.salvarMaterial({ ...(atual || { disciplinaId: p.discId, tipo: 'nota' }), titulo: p.titulo, texto: p.texto });
    const caixa = document.getElementById('dsc-nota-form');
    if (caixa && !caixa.dataset.id) caixa.dataset.id = salvo.id;
    const st = document.getElementById('mat-st');
    if (st && !notaPendente) st.textContent = 'Salvo';
    redesenhar();
  }
  document.addEventListener('input', (e) => {
    if (e.target.dataset?.dscMatCampo === undefined) return;
    const caixa = document.getElementById('dsc-nota-form');
    notaPendente = { discId: caixa.dataset.disc, id: caixa.dataset.id, titulo: document.getElementById('mat-titulo').value.trim(), texto: document.getElementById('mat-texto').value };
    const st = document.getElementById('mat-st');
    if (st) st.textContent = 'Salvando…';
    clearTimeout(notaTimer);
    notaTimer = setTimeout(gravarNota, 600);
  });
  // Sair da tela com a nota aberta não pode custar o que foi digitado no último instante.
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && gravarNota());
  window.addEventListener('pagehide', () => gravarNota());

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
    const b = e.target.closest('[data-dsc-arquivo-novo],[data-dsc-abrir-arquivo],[data-dsc-estudio],[data-dsc-nota-nova],[data-dsc-nota],[data-dsc-link-novo],[data-dsc-mat-apagar],[data-dsc-mat-fechar],[data-dsc-nova],[data-dsc-editar],[data-dsc-agendar],[data-dsc-gravacao],[data-dsc-nova-aula],[data-dsc-evento],[data-dsc-fechar],[data-dsc-arquivar],[data-dsc-apagar],[data-dsc-apagar-ev],[data-dsc-apagar-aula],[data-dsc-editar-aula],[data-dsc-tirar-nota],[data-dsc-novo-texto],[data-dsc-transcrever],[data-dsc-resumir],[data-dsc-ir],[data-dsc-buscar],[data-dsc-achei],[data-dsc-combinado],[data-dsc-aplicar-plano],[data-grifo-aula-cor],[data-grifo-aula]');
    if (!b) return;
    const d = b.dataset;
    if (d.dscEstudio) {
      est.estudio = d.dscEstudio;
      return redesenhar();
    }
    if (d.dscArquivoNovo) {
      entradaArquivo.dataset.disc = d.dscArquivoNovo;
      return entradaArquivo.click();
    }
    if (d.dscAbrirArquivo) return abrirArquivo(d.dscAbrirArquivo);
    if (d.dscNotaNova) return modalNota(d.dscNotaNova);
    if (d.dscNota) {
      const m = disc.material(d.dscNota);
      return m && modalNota(m.disciplinaId, m);
    }
    if (d.dscLinkNovo) return modalLink(d.dscLinkNovo);
    if (d.dscMatFechar !== undefined) {
      await gravarNota();
      fechar();
      return redesenhar();
    }
    if (d.dscMatApagar) {
      notaPendente = null;
      clearTimeout(notaTimer);
      const m = disc.material(d.dscMatApagar);
      const desfazer = await disc.apagarMaterial(d.dscMatApagar);
      fechar();
      redesenhar();
      return desfazer && toast(`${m.tipo === 'nota' ? 'Nota apagada' : m.tipo === 'arquivo' ? 'Arquivo apagado' : 'Link apagado'}. Está na lixeira, em Ajustes.`, async () => {
        await desfazer();
        redesenhar();
      });
    }
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
      return toast(x.arquivada ? 'Projeto reaberto' : 'Projeto encerrado. Ele continua em Projetos, em Projetos encerrados.');
    }
    if (d.dscApagar) {
      const x = disc.obter(d.dscApagar);
      const desfazer = await disc.apagar(d.dscApagar);
      fechar();
      location.hash = '#disciplinas';
      depois(() =>
        toast(`Projeto apagado, com as aulas e a agenda dele. As obras e os textos continuam.`, async () => {
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
      return toast(ok ? 'Na lista para adicionar do projeto. Com o PDF na biblioteca, o Tutor e o Copilot podem usar a obra.' : 'Já está na lista para adicionar.');
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
      return toast('Grifo apagado', async () => {
        await desfazer();
        redesenhar();
      });
    }
  });

  return { lista, tela, telaAula, montar, formEvento, menu: () => disc.ativas() };
}

export { ocorrencias };
