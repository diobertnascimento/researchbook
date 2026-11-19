// Telas de organizar a biblioteca: "Importar" (vários PDFs, exportações do Zotero, a pasta do Zotero)
// e a aba "Organizar" (DOIs para conferir, obras repetidas, obras sem DOI encontrado).
import { ouvir } from './ui.js';
import { autorCurto } from './abnt.js';

/* global I, toast, fecharModal */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icone = (n) => (typeof I !== 'undefined' && I[n]) || '';
const autores = (l) => (l?.autores || []).slice(0, 3).map((a) => a.sobrenome).join('; ') + ((l?.autores || []).length > 3 ? ' et al.' : '');
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

const STATUS = {
  nova: { rot: 'Nova', classe: 'ok' },
  completa: { rot: 'Completa uma obra da biblioteca', classe: 'info' },
  identica: { rot: 'Já está na biblioteca', classe: '' },
  provavel: { rot: 'Parece repetida', classe: 'lac' },
  repetida: { rot: 'Repetida neste envio', classe: '' },
};
const CONFIANCA = { 'muito-provavel': ['Muito provável', 'ok'], provavel: ['Provável', 'lac'], ia: ['Indicado pela IA', 'info'] };

export function criarOrganizarUI({ org, bib, bibUI, registrar }) {
  let prev = null; // { itens, formatos }
  let fase = 'escolher'; // escolher | analisando | previa | importando
  let progresso = '';
  const redesenhar = () => typeof window.render === 'function' && /^#organizar|^#biblioteca/.test(location.hash) && window.render();
  org.aoMudar(() => {
    // Durante a procura, redesenha a aba Organizar (nunca com um modal aberto ou alguém digitando).
    const modal = document.getElementById('veu')?.classList.contains('on');
    const digitando = document.activeElement?.matches?.('input, textarea, select');
    if (!modal && !digitando && /^#organizar/.test(location.hash)) window.render?.();
    window.desenhaMenu?.(location.hash.slice(1) || 'painel');
  });

  /* ---------- Importar ---------- */

  const temPasta = () => 'webkitdirectory' in document.createElement('input');

  function corpoModal() {
    if (fase === 'escolher')
      return `<h2 id="modal-tit">Importar para a biblioteca</h2>
      <p>Escolha vários PDFs, um arquivo exportado do Zotero (.bib, .ris, .json ou .rdf) ou a pasta inteira que o Zotero exportou com os PDFs. Antes de gravar, você confere o que é novo e o que já está na biblioteca.</p>
      <div class="linha-acoes mb-4">
        <label class="btn prim">${icone('upload')}Escolher arquivos<input type="file" multiple accept=".pdf,.bib,.bibtex,.ris,.json,.rdf,.txt,application/pdf" data-imp-arquivos hidden></label>
        ${temPasta() ? `<label class="btn">${icone('pasta') || ''}Escolher a pasta do Zotero<input type="file" webkitdirectory multiple data-imp-arquivos hidden></label>` : ''}
      </div>
      <details class="ajuda-det"><summary>Como exportar do Zotero</summary>
        <ol class="lista-simples mt-2">
          <li>No Zotero, clique com o botão direito na coleção (ou use Arquivo &gt; Exportar biblioteca).</li>
          <li>Em Formato, escolha <b>BibTeX</b> ou <b>Zotero RDF</b>. Esses dois levam os PDFs; RIS e CSL JSON levam só os dados.</li>
          <li>Marque <b>Exportar arquivos</b> e salve. O Zotero cria uma pasta com o arquivo de dados e a pasta files.</li>
          <li>Aqui, escolha essa pasta inteira${temPasta() ? '' : ' (no celular, escolha o arquivo de dados e os PDFs juntos)'}. Cada PDF é ligado à sua obra pelo caminho que o Zotero gravou.</li>
          <li>As coleções do Zotero viram tags (no formato Zotero RDF). Obras sem DOI vão para Organizar, onde o app procura o DOI no Crossref.</li>
        </ol>
      </details>
      <div class="pe"><button class="btn fant" data-acao="fechar">Cancelar</button></div>`;
    if (fase === 'analisando' || fase === 'importando')
      return `<h2 id="modal-tit">${fase === 'analisando' ? 'Lendo os arquivos' : 'Importando'}</h2>
      <p class="linha-acoes" role="status" aria-live="polite"><span class="giro" aria-hidden="true"></span><span id="imp-prog">${esc(progresso)}</span></p>
      <p class="meta">Pode demorar alguns segundos por PDF. Não feche esta janela.</p>`;
    // prévia
    const its = prev.itens;
    const marcados = its.filter((i) => i.incluir).length;
    const grupos = ['nova', 'completa', 'provavel', 'identica', 'repetida'].map((s) => [s, its.filter((i) => i.status === s)]).filter(([, l]) => l.length);
    const linha = (it) => {
      const f = it.ficha;
      const extra = [it.origem, it.arquivo ? 'com PDF' : 'sem PDF', f.doi ? 'com DOI' : 'sem DOI'].join(', ');
      return `<label class="imp-it"><input type="checkbox" data-imp-marcar="${it.n}" ${it.incluir ? 'checked' : ''}>
        <span><b>${esc(f.titulo)}</b><small>${esc([autores(f), f.ano].filter(Boolean).join(', ') || 'Sem autores e ano')}. ${esc(extra)}${it.alvoTitulo ? `. Na biblioteca: “${esc(it.alvoTitulo)}” (${esc(it.motivo)})` : it.motivo ? ` (${esc(it.motivo)})` : ''}</small></span></label>`;
    };
    return `<h2 id="modal-tit">Conferir a importação</h2>
      <p>${plural(its.length, 'item encontrado', 'itens encontrados')}${prev.formatos.length ? ` em ${esc(prev.formatos.join(', '))}` : ''}, ${plural(its.filter((i) => i.arquivo).length, 'PDF ligado', 'PDFs ligados')}. Desmarque o que não quer importar.</p>
      <div class="imp-lista">${grupos.map(([s, l]) => `<h3>${STATUS[s].rot} <span class="chip ${STATUS[s].classe}">${l.length}</span></h3>${l.map(linha).join('')}`).join('')}</div>
      <div class="pe"><button class="btn fant" data-imp-voltar>Escolher outros arquivos</button><span class="esp"></span><button class="btn fant" data-acao="fechar">Cancelar</button><button class="btn prim" data-imp-gravar ${marcados ? '' : 'disabled'}>${marcados ? `Importar ${plural(marcados, 'obra', 'obras')}` : 'Nada marcado'}</button></div>`;
  }

  function desenharModal() {
    const veu = document.getElementById('veu');
    veu.innerHTML = `<div class="modal imp-modal" role="dialog" aria-labelledby="modal-tit">${corpoModal()}</div>`;
    veu.classList.add('on');
  }

  function abrirImportar(arquivos = null) {
    fase = 'escolher';
    prev = null;
    desenharModal();
    if (arquivos?.length) analisar(arquivos);
  }

  const mostrarProgresso = (t) => {
    progresso = t;
    const el = document.getElementById('imp-prog');
    if (el) el.textContent = t;
  };

  async function analisar(arquivos) {
    fase = 'analisando';
    progresso = 'Lendo os arquivos…';
    desenharModal();
    try {
      prev = await org.analisar(arquivos, mostrarProgresso);
    } catch (e) {
      registrar('erro', 'importar.analisar', { det: e.message, st: 'erro' });
      fase = 'escolher';
      desenharModal();
      toast('Não deu para ler esses arquivos. Confira se são PDFs ou uma exportação do Zotero e tente de novo.');
      return;
    }
    if (!prev.itens.length) {
      fase = 'escolher';
      desenharModal();
      toast('Nenhuma obra encontrada. Escolha PDFs ou um arquivo .bib, .ris, .json ou .rdf do Zotero.');
      return;
    }
    fase = 'previa';
    desenharModal();
  }

  async function gravar() {
    fase = 'importando';
    progresso = 'Começando…';
    desenharModal();
    const r = await org.importar(prev.itens, mostrarProgresso);
    fase = 'escolher';
    prev = null;
    fecharModal();
    const partes = [r.criadas.length ? plural(r.criadas.length, 'obra importada', 'obras importadas') : null, r.completadas ? plural(r.completadas, 'obra ganhou o PDF', 'obras ganharam o PDF') : null].filter(Boolean);
    toast(`${partes.join(', ') || 'Nada importado'}.${r.semDoi ? ` Procurando o DOI de ${plural(r.semDoi, 'obra', 'obras')} em Organizar.` : ''} Os PDFs vão para o seu Drive.`);
    location.hash = r.semDoi ? '#organizar' : '#biblioteca';
  }

  /* ---------- Aba Organizar ---------- */

  function cartaoProposta(l) {
    const b = l.doiBusca;
    const c = b.candidato;
    const [rot, classe] = CONFIANCA[b.confianca] || ['Para conferir', ''];
    return `<article class="org-item" data-org-obra="${esc(l.id)}">
      <div class="org-lados">
        <div><span class="legenda">Na sua biblioteca</span><b>${esc(l.titulo)}</b><small>${esc([autores(l), l.ano, l.veiculo].filter(Boolean).join(', ') || 'Sem autores e ano')}</small></div>
        <div><span class="legenda">No Crossref</span><b>${esc(c.titulo)}${c.subtitulo ? `: ${esc(c.subtitulo)}` : ''}</b><small>${esc([autores(c), c.ano, c.veiculo || c.editora].filter(Boolean).join(', '))}</small><small class="org-doi">DOI ${esc(c.doi)}</small></div>
      </div>
      <p class="org-motivo"><span class="chip ${classe}">${rot}</span> ${esc(b.motivo || '')}</p>
      <div class="linha-acoes">
        <button class="btn prim mini" data-org-aceitar="${esc(l.id)}" data-doi="${esc(c.doi)}">Aceitar este DOI</button>
        <button class="btn mini" data-org-recusar="${esc(l.id)}" data-doi="${esc(c.doi)}">Não é esta</button>${org.iaLigada() && l.doiBusca.confianca !== 'ia' ? `<button class="btn fant mini" data-org-ia="${esc(l.id)}" data-ocupado="A IA está lendo…">Pedir para a IA conferir</button>` : ''}
        ${
          b.outros?.length
            ? `<details class="org-outros"><summary>Outros candidatos (${b.outros.length})</summary>${b.outros
                .map((o) => `<div class="org-cand"><span><b>${esc(o.titulo)}</b><small>${esc([autores(o), o.ano, o.veiculo].filter(Boolean).join(', '))}. DOI ${esc(o.doi)}</small></span><button class="btn mini" data-org-aceitar="${esc(l.id)}" data-doi="${esc(o.doi)}">É esta</button></div>`)
                .join('')}</details>`
            : ''
        }
      </div>
    </article>`;
  }

  function cartaoRepetidas(g, fica) {
    const ls = g.ids.map((id) => bib.obter(id)).filter(Boolean);
    const sobre = (l) => {
      const n = bib.grifosDe(l.id).length;
      return [l.ano, l.doi ? 'com DOI' : 'sem DOI', l.pdf ? 'com PDF' : 'sem PDF', n ? plural(n, 'grifo', 'grifos') : null, l.importadaDe ? `de ${l.importadaDe}` : null].filter(Boolean).join(', ');
    };
    return `<article class="org-item">
      <p class="org-motivo"><span class="chip ${g.tipo === 'identica' ? 'erro' : 'lac'}">${g.tipo === 'identica' ? 'Idênticas' : 'Parecem repetidas'}</span> ${esc(g.motivos.join(', '))}</p>
      <ul class="org-rep">${ls.map((l) => `<li><span><b>${esc(l.titulo)}</b><small>${esc(autorCurto(l))}. ${esc(sobre(l))}</small></span>${l.id === fica?.id ? '<span class="chip ok">Fica esta</span>' : ''}</li>`).join('')}</ul>
      <p class="meta">Ao juntar, fica a obra com mais trabalho seu (grifos, fichamento, etapa). Grifos, PDF, tags, trilhas, cartões e citações das outras passam para ela.</p>
      <div class="linha-acoes"><button class="btn prim mini" data-org-juntar="${esc(g.ids.join(','))}" data-ocupado="Juntando…">Juntar</button><button class="btn mini" data-org-nao-rep="${esc(g.ids.join(','))}">Não são repetidas</button></div>
    </article>`;
  }

  function cartaoSem(l) {
    const b = l.doiBusca || {};
    const d = b.dadosLidos;
    return `<li class="org-sem"><span><b>${esc(l.titulo)}</b><small>${esc([autores(l), l.ano].filter(Boolean).join(', ') || 'Sem autores e ano')}${b.status === 'recusada' ? '. Você recusou os candidatos.' : ''}</small>
      ${d ? `<small class="org-lido">A IA leu no PDF: “${esc(d.titulo)}”${d.autores?.length ? `, ${esc(autores(d))}` : ''}${d.ano ? `, ${esc(d.ano)}` : ''}</small>` : ''}</span>
      <span class="linha-acoes">${d ? `<button class="btn mini" data-org-usar-lidos="${esc(l.id)}">Usar esses dados</button>` : ''}<button class="btn mini" data-org-de-novo="${esc(l.id)}" data-ocupado="Procurando…">Procurar de novo</button>${org.iaLigada() ? `<button class="btn mini" data-org-ia="${esc(l.id)}" data-ocupado="A IA está lendo…">Pedir para a IA conferir</button>` : ''}<button class="btn fant mini" data-org-corrigir="${esc(l.id)}">Corrigir dados</button><button class="btn fant mini" data-org-nao-tem="${esc(l.id)}">Não tem DOI</button></span></li>`;
  }

  const cacheFica = new Map();
  async function calcularQuemFica(grupos) {
    for (const g of grupos) {
      const k = g.ids.join(',');
      if (!cacheFica.has(k)) cacheFica.set(k, await org.qualFica(g.ids));
    }
  }

  function tela() {
    const st = org.estadoBusca();
    const props = org.propostas();
    const reps = org.repetidas();
    const sem = org.semResultado();
    const pend = org.pendentes();
    const muitoProvaveis = props.filter((l) => l.doiBusca.confianca === 'muito-provavel');
    if (reps.some((g) => !cacheFica.has(g.ids.join(',')))) calcularQuemFica(reps).then(() => /^#organizar/.test(location.hash) && window.render?.());
    const topo = `<div class="topo"><div><h1>Organizar</h1><p>O app procura no Crossref os DOIs que faltam e as obras repetidas. Quando título, autor e ano batem, o DOI é gravado na hora, com desfazer. O que deixa dúvida espera a sua decisão.</p></div>
      <div class="acoes"><button class="btn" data-org-importar>${icone('upload')}Importar</button>${pend.length && !st.rodando ? `<button class="btn prim" data-org-procurar>Procurar DOIs que faltam (${pend.length})</button>` : ''}</div></div>`;
    const andamento = st.rodando
      ? `<div class="bloco org-andamento" role="status" aria-live="polite"><div class="linha-acoes"><span class="giro" aria-hidden="true"></span><b>Procurando DOIs: ${st.feitos} de ${st.total}</b></div>${st.atual ? `<p class="meta mt-2">${esc(st.atual)}</p>` : ''}<div class="barra mb-0"><i style="width:${st.total ? Math.round((st.feitos / st.total) * 100) : 0}%"></i></div></div>`
      : '';
    const avisoIA = st.avisoIA ? `<div class="aviso"><span>ⓘ</span><div>A IA não respondeu (${esc(st.avisoIA)}). A procura continuou só pelo Crossref. <a href="#ajustes">Abrir Ajustes do Gemini</a></div></div>` : '';
    const notaIA = org.iaLigada() ? '' : '<p class="meta mb-4">A procura usa só o Crossref. Com o Gemini ligado, você pode pedir, obra por obra, que a IA leia o começo do PDF e indique o candidato certo. <a href="#ajustes">Ligar em Ajustes</a></p>';
    const grav = org.gravadosAgora();
    const gravadosHTML = grav.length && !st.rodando
      ? `<section class="org-sec" id="org-gravados"><div class="org-cab"><h2>Gravados agora <span class="chip">${grav.length}</span></h2><span class="linha-acoes"><button class="btn mini" data-org-desfazer-gravados data-ocupado="Desfazendo…">Desfazer ${grav.length === 1 ? 'este' : `os ${grav.length}`}</button><button class="btn fant mini" data-org-dispensar>Ok, conferi</button></span></div><p class="meta">Título, autor e ano batem com o Crossref, então o DOI foi gravado e os campos vazios da obra foram completados.</p><ul class="org-lista-sem">${grav.map((g) => `<li class="org-sem"><span><b>${esc(g.titulo)}</b><small>DOI ${esc(g.doi)}</small></span></li>`).join('')}</ul></section>`
      : '';
    if (!props.length && !reps.length && !sem.length && !pend.length && !st.rodando && !grav.length)
      return `${topo}<div class="vazio-estado"><h2>Biblioteca organizada</h2><p>Todas as obras têm DOI (ou você marcou que não têm) e não há obras repetidas. Para trazer muitas obras de uma vez, use Importar.</p><button class="btn prim" data-org-importar>${icone('upload')}Importar PDFs ou o Zotero</button></div>`;
    return `${topo}${andamento}${avisoIA}${notaIA}${gravadosHTML}
      ${props.length ? `<section class="org-sec"><div class="org-cab"><h2>DOIs para conferir <span class="chip">${props.length}</span></h2>${muitoProvaveis.length > 1 ? `<button class="btn mini" data-org-aceitar-todos data-ocupado="Aceitando…">Aceitar os ${muitoProvaveis.length} muito prováveis</button>` : ''}</div>${props.map(cartaoProposta).join('')}</section>` : ''}
      ${reps.length ? `<section class="org-sec"><div class="org-cab"><h2>Obras repetidas <span class="chip">${reps.length}</span></h2>${reps.filter((g) => g.tipo === 'identica').length > 1 ? `<button class="btn mini" data-org-juntar-identicas data-ocupado="Juntando…">Juntar as ${reps.filter((g) => g.tipo === 'identica').length} idênticas</button>` : ''}</div>${reps.map((g) => cartaoRepetidas(g, cacheFica.get(g.ids.join(',')))).join('')}</section>` : ''}
      ${sem.length ? `<section class="org-sec"><details class="como" ${props.length || reps.length ? '' : 'open'}><summary>Sem DOI encontrado (${sem.length})</summary><p class="meta">Livros, capítulos e trabalhos brasileiros antigos muitas vezes não têm DOI. Corrija os dados e procure de novo, ou marque que a obra não tem DOI.</p><ul class="org-lista-sem">${sem.map(cartaoSem).join('')}</ul></details></section>` : ''}
      ${pend.length && !st.rodando ? `<p class="meta">${plural(pend.length, 'obra ainda não foi procurada', 'obras ainda não foram procuradas')}.</p>` : ''}`;
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-imp-arquivos]') && e.target.files?.length) analisar([...e.target.files]);
    if (e.target.matches('[data-imp-marcar]') && prev) {
      const it = prev.itens[Number(e.target.dataset.impMarcar)];
      if (it) it.incluir = e.target.checked;
      const b = document.querySelector('[data-imp-gravar]');
      const n = prev.itens.filter((i) => i.incluir).length;
      if (b) {
        b.disabled = !n;
        b.textContent = n ? `Importar ${plural(n, 'obra', 'obras')}` : 'Nada marcado';
      }
    }
  });

  ouvir('click', async (e) => {
    const b = e.target.closest('[data-org-ia],[data-org-desfazer-gravados],[data-org-dispensar],[data-org-importar],[data-imp-voltar],[data-imp-gravar],[data-org-procurar],[data-org-aceitar],[data-org-recusar],[data-org-aceitar-todos],[data-org-juntar],[data-org-juntar-identicas],[data-org-nao-rep],[data-org-de-novo],[data-org-corrigir],[data-org-nao-tem],[data-org-usar-lidos]');
    if (!b) return;
    const d = b.dataset;
    if (d.orgImportar !== undefined) return abrirImportar();
    if (d.impVoltar !== undefined) return abrirImportar();
    if (d.impGravar !== undefined) return gravar();
    if (d.orgProcurar !== undefined) {
      org.procurarDOIs();
      return redesenhar();
    }
    if (d.orgIa) {
      await org.pedirIA(d.orgIa);
      return redesenhar();
    }
    if (d.orgDesfazerGravados !== undefined) {
      const n = await org.desfazerGravados();
      redesenhar();
      return toast(`${plural(n, 'DOI retirado', 'DOIs retirados')}. As obras voltaram para a lista de conferir.`);
    }
    if (d.orgDispensar !== undefined) {
      org.dispensarGravados();
      return redesenhar();
    }
    if (d.orgAceitar) {
      const desfazer = await org.aceitar(d.orgAceitar, d.doi);
      redesenhar();
      if (desfazer) toast('DOI aceito. Os campos vazios da obra foram completados.', async () => { await desfazer(); redesenhar(); });
      return;
    }
    if (d.orgRecusar) {
      await org.recusar(d.orgRecusar, d.doi);
      return redesenhar();
    }
    if (d.orgAceitarTodos !== undefined) {
      const ls = org.propostas().filter((l) => l.doiBusca.confianca === 'muito-provavel');
      const desfazeres = [];
      for (const l of ls) desfazeres.push(await org.aceitar(l.id, l.doiBusca.candidato.doi));
      redesenhar();
      toast(`${plural(ls.length, 'DOI aceito', 'DOIs aceitos')}.`, async () => { for (const f of desfazeres.reverse()) if (f) await f(); redesenhar(); });
      return;
    }
    if (d.orgJuntar) {
      const r = await org.juntar(d.orgJuntar.split(','));
      cacheFica.clear();
      redesenhar();
      if (r.erro) return toast(r.erro);
      toast('Obras juntadas numa só.', async () => { await r.desfazer(); redesenhar(); });
      return;
    }
    if (d.orgJuntarIdenticas !== undefined) {
      const grupos = org.repetidas().filter((g) => g.tipo === 'identica');
      const desfazeres = [];
      let erros = 0;
      for (const g of grupos) {
        const r = await org.juntar(g.ids);
        if (r.erro) erros++;
        else desfazeres.push(r.desfazer);
      }
      cacheFica.clear();
      redesenhar();
      toast(`${plural(desfazeres.length, 'grupo juntado', 'grupos juntados')}.${erros ? ` ${plural(erros, 'grupo precisa', 'grupos precisam')} de você: as obras têm fichamento.` : ''}`, async () => { for (const f of desfazeres.reverse()) await f(); redesenhar(); });
      return;
    }
    if (d.orgNaoRep) {
      await org.naoSaoRepetidas(d.orgNaoRep.split(','));
      cacheFica.clear();
      return redesenhar();
    }
    if (d.orgDeNovo) {
      await org.procurarDeNovo(d.orgDeNovo);
      return redesenhar();
    }
    if (d.orgCorrigir) return bibUI.editar(d.orgCorrigir);
    if (d.orgNaoTem) {
      await org.marcarSemDOI(d.orgNaoTem);
      toast('Marcada como obra sem DOI.');
      return redesenhar();
    }
    if (d.orgUsarLidos) {
      const desfazer = await org.usarDadosLidos(d.orgUsarLidos);
      redesenhar();
      if (desfazer) toast('Dados lidos no PDF aplicados. Procure o DOI de novo, se quiser.', async () => { await desfazer(); redesenhar(); });
    }
  });

  return { tela, abrirImportar };
}
