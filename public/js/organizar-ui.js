// Telas de organizar a biblioteca: "Importar" (vários PDFs, exportações do Zotero, a pasta do Zotero)
// e o Acervo (central das obras: o que falta em cada uma, DOIs para conferir, obras repetidas).
import { ouvir } from './ui.js';
import { autorCurto } from './abnt.js';
import { chaveCand } from './organizar.js';
import { retrato, filtrar, fraseDaReferencia, esperaDOI, FILTROS, ORDENS } from './acervo.js';

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
  const redesenhar = () => typeof window.render === 'function' && /^#organizar|^#acervo|^#biblioteca/.test(location.hash) && window.render();
  org.aoMudar(() => {
    // Durante a procura, redesenha a aba Organizar (nunca com um modal aberto ou alguém digitando).
    const modal = document.getElementById('veu')?.classList.contains('on');
    const digitando = document.activeElement?.matches?.('input, textarea, select');
    if (!modal && !digitando && /^#(organizar|acervo)/.test(location.hash)) window.render?.();
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
    toast(`${partes.join(', ') || 'Nada importado'}.${r.semDoi ? ` Procurando o DOI de ${plural(r.semDoi, 'obra', 'obras')} no Acervo.` : ''} Os PDFs vão para o seu Drive.`);
    location.hash = r.semDoi ? '#acervo' : '#biblioteca';
  }

  /* ---------- Aba Organizar ---------- */

  function cartaoProposta(l) {
    const b = l.doiBusca;
    const c = b.candidato;
    const [rot, classe] = CONFIANCA[b.confianca] || ['Para conferir', ''];
    return `<article class="org-item" data-org-obra="${esc(l.id)}">
      <div class="org-lados">
        <div><span class="legenda">Na sua biblioteca</span><b>${esc(l.titulo)}</b><small>${esc([autores(l), l.ano, l.veiculo].filter(Boolean).join(', ') || 'Sem autores e ano')}</small></div>
        <div><span class="legenda">${c.fonte === 'openalex' ? 'No OpenAlex' : 'No Crossref'}</span><b>${esc(c.titulo)}${c.subtitulo ? `: ${esc(c.subtitulo)}` : ''}</b><small>${esc([autores(c), c.ano, c.veiculo || c.editora].filter(Boolean).join(', '))}</small><small class="org-doi">${c.doi ? `DOI ${esc(c.doi)}` : 'Esta obra não tem DOI'}</small></div>
      </div>
      <p class="org-motivo"><span class="chip ${classe}">${rot}</span> ${esc(b.motivo || '')}</p>
      <div class="linha-acoes">
        <button class="btn prim mini" data-org-aceitar="${esc(l.id)}" data-doi="${esc(chaveCand(c))}">${c.doi ? 'Aceitar este DOI' : 'É esta obra'}</button>
        <button class="btn mini" data-org-recusar="${esc(l.id)}" data-doi="${esc(chaveCand(c))}">Não é esta</button>${org.iaLigada() && l.doiBusca.confianca !== 'ia' ? `<button class="btn fant mini" data-org-ia="${esc(l.id)}" data-ocupado="A IA está lendo…">Pedir para a IA conferir</button>` : ''}
        ${
          b.outros?.length
            ? `<details class="org-outros"><summary>Outros candidatos (${b.outros.length})</summary>${b.outros
                .map((o) => `<div class="org-cand"><span><b>${esc(o.titulo)}</b><small>${esc([autores(o), o.ano, o.veiculo].filter(Boolean).join(', '))}. ${o.doi ? `DOI ${esc(o.doi)}` : 'Sem DOI'}, ${o.fonte === 'openalex' ? 'no OpenAlex' : 'no Crossref'}</small></span><button class="btn mini" data-org-aceitar="${esc(l.id)}" data-doi="${esc(chaveCand(o))}">É esta</button></div>`)
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

  /* ---------- Central: todas as obras ---------- */
  const TIPO = { artigo: 'Artigo', livro: 'Livro', capitulo: 'Capítulo', anais: 'Trabalho em evento', dissertacao: 'Dissertação', tese: 'Tese' };
  let ver = { filtro: 'todas', termo: '', ordem: 'recentes' };
  const sinal = (ok) => `<span class="ac-sinal${ok ? '' : ' falta'}" aria-hidden="true"></span>`;

  function linhaObra({ l, f }) {
    const sobre = [autores(l), l.ano].filter(Boolean).join(', ') || 'Sem autor e sem ano';
    const pdf = l.pdf
      ? `<span class="ac-ok">${sinal(true)}${l.pdf.pendente ? 'Só neste aparelho' : 'No Drive'}</span>`
      : `<span class="ac-falta">${sinal(false)}Sem PDF</span> <a href="#leitor/${esc(l.id)}">Anexar o PDF</a>`;
    const doi = l.doi
      ? `<span class="ac-ok ac-doi">${sinal(true)}${esc(l.doi)}</span>`
      : l.doiBusca?.status === 'nao-tem'
        ? `<span class="ac-ok">${sinal(true)}Não tem DOI</span>`
        : esperaDOI(l)
          ? `<span class="ac-falta">${sinal(false)}Sem DOI</span>`
          : '<span class="ac-ok">Sem DOI</span>';
    return `<tr data-ac-obra="${esc(l.id)}">
      <td class="ac-c-obra"><button type="button" class="ac-obra" data-org-corrigir="${esc(l.id)}"><b>${esc(l.titulo || 'Sem título')}</b><small>${esc(sobre)}. ${esc(l.veiculo ? l.veiculo + '. ' : '')}${TIPO[l.tipo] || 'Artigo'}.</small></button></td>
      <td data-rot="Referência"><span class="${f.ref.length ? 'ac-falta' : 'ac-ok'}">${sinal(!f.ref.length)}${esc(fraseDaReferencia(f.ref))}</span></td>
      <td data-rot="PDF">${pdf}</td>
      <td data-rot="DOI">${doi}</td>
    </tr>`;
  }

  function corpoLista(r) {
    const linhas = filtrar(r, ver);
    const nome = (FILTROS.find(([k]) => k === ver.filtro) || FILTROS[0])[1].toLowerCase();
    const frase = !linhas.length
      ? ver.termo
        ? 'Nenhuma obra com esse texto neste grupo.'
        : 'Nenhuma obra neste grupo.'
      : ver.filtro === 'todas' && !ver.termo
        ? `Mostrando ${r.total === 1 ? 'a única obra' : `as ${r.total} obras`}.`
        : `Mostrando ${linhas.length} de ${plural(r.total, 'obra', 'obras')}${ver.filtro === 'todas' ? '' : `: ${nome}`}.`;
    return { html: linhas.map(linhaObra).join(''), frase };
  }

  function listaObras(r) {
    const c = corpoLista(r);
    return `<section class="org-sec" id="acervo-obras" aria-labelledby="ac-obras-t"><div class="org-cab"><h2 id="ac-obras-t">Obras</h2></div>
      <div class="ac-barra">
        <div class="ac-filtros" role="group" aria-label="Mostrar">${FILTROS.map(([k, n]) => `<button type="button" data-ac-filtro="${k}" aria-pressed="${k === ver.filtro}">${n} <span>${r.contagem[k]}</span></button>`).join('')}</div>
        <div class="ac-achar"><label class="sr" for="ac-busca">Procurar no acervo</label><input id="ac-busca" type="search" placeholder="Título, autor ou ano" value="${esc(ver.termo)}" autocomplete="off">
          <label class="ac-ordem">Ordem <select id="ac-ordem">${Object.entries(ORDENS).map(([k, [n]]) => `<option value="${k}" ${k === ver.ordem ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
      </div>
      <table class="ac-tab"><thead><tr><th scope="col">Obra</th><th scope="col">Referência</th><th scope="col">PDF</th><th scope="col">DOI</th></tr></thead><tbody id="ac-corpo">${c.html}</tbody></table>
      <p class="meta mt-3" role="status" id="ac-resumo">${c.frase}</p>
    </section>`;
  }

  // Filtro, busca e ordem trocam só as linhas: a tela não é refeita, então o campo de busca não perde o foco.
  function pintarLista() {
    const corpo = document.getElementById('ac-corpo');
    if (!corpo) return;
    const c = corpoLista(retrato(bib.leituras(), org.repetidas()));
    corpo.innerHTML = c.html;
    document.getElementById('ac-resumo').textContent = c.frase;
    document.querySelectorAll('[data-ac-filtro]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.acFiltro === ver.filtro)));
  }
  document.addEventListener('input', (e) => {
    if (!e.target.matches('#ac-busca')) return;
    ver.termo = e.target.value;
    pintarLista();
  });

  function painel(r, st, pend) {
    if (!r.total || st.rodando) return '';
    const n = r.contagem.falta;
    if (!n) return `<p class="meta mb-5" id="acervo-resumo">Todas as obras estão com a referência completa, o PDF e o DOI.</p>`;
    const partes = [r.contagem.ref ? `${r.contagem.ref} com a referência incompleta` : null, r.contagem.pdf ? `${r.contagem.pdf} sem PDF` : null, r.contagem.doi ? `${r.contagem.doi} sem DOI` : null].filter(Boolean);
    const lista = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}` : partes[0];
    const buscavel = pend.length + org.paraCompletar().length;
    return `<section class="proximo ac-painel" id="acervo-resumo" aria-labelledby="ac-painel-t">
      <h2 class="prox-tit" id="ac-painel-t">${plural(n, 'obra com algo faltando', 'obras com algo faltando')}</h2>
      <p>${lista}. ${buscavel ? 'O app procura os dados no Crossref, pelo DOI e pelo título, grava o que tem certeza e deixa para você só os casos em dúvida.' : 'O que dava para buscar já foi buscado. O que falta agora depende de você: anexar o PDF, corrigir os dados ou marcar que a obra não tem DOI.'}</p>
      ${buscavel ? `<div class="acao-l"><button class="btn prim" data-ac-completar data-ocupado="Procurando…">Completar os dados</button><span>${plural(buscavel, 'obra para procurar', 'obras para procurar')}</span></div>` : ''}
    </section>`;
  }

  function tela() {
    const st = org.estadoBusca();
    const props = org.propostas();
    const reps = org.repetidas();
    const sem = org.semResultado();
    const pend = org.pendentes();
    const muitoProvaveis = props.filter((l) => l.doiBusca.confianca === 'muito-provavel');
    if (reps.some((g) => !cacheFica.has(g.ids.join(',')))) calcularQuemFica(reps).then(() => /^#(organizar|acervo)/.test(location.hash) && window.render?.());
    const res = org.resumo();
    const at = org.estadoAtualizacao();
    const r = retrato(bib.leituras(), reps);
    const topo = `<div class="topo"><div><h1>Acervo</h1><p>${r.total ? `${plural(r.total, 'obra', 'obras')}. ${r.contagem.falta ? `${plural(r.completas, 'completa', 'completas')}, ${r.contagem.falta} com algo faltando.` : 'Todas completas.'}` : 'A central das suas obras: artigos, livros e capítulos, com o PDF, os dados da referência e o DOI de cada um.'}</p></div>
      <div class="acoes"><button class="btn" data-org-importar>${icone('upload')}Adicionar obras</button></div></div>`;
    const andamento = st.rodando
      ? `<div class="bloco org-andamento" role="status" aria-live="polite"><div class="linha-acoes"><span class="giro" aria-hidden="true"></span><b>Procurando os dados: ${st.feitos} de ${st.total}</b></div>${st.atual ? `<p class="meta mt-2">${esc(st.atual)}</p>` : ''}<div class="barra mb-0"><i style="width:${st.total ? Math.round((st.feitos / st.total) * 100) : 0}%"></i></div></div>`
      : '';
    const avisoIA = st.avisoIA ? `<div class="aviso"><span>ⓘ</span><div>A IA não respondeu (${esc(st.avisoIA)}). A procura continuou só pelo Crossref. <a href="#ajustes">Abrir Ajustes do Gemini</a></div></div>` : '';
    const ROT = { subtitulo: 'subtítulo', ano: 'ano', veiculo: 'revista', volume: 'volume', numero: 'número', paginas: 'páginas', editora: 'editora', local: 'local', url: 'link', idioma: 'idioma', autores: 'autores' };
    const resultadoAt = at && !at.rodando
      ? `<div class="bloco" id="acervo-atualizadas" role="status"><div class="org-cab"><b>${at.completadas.length ? `${plural(at.completadas.length, 'obra completada', 'obras completadas')} pelo DOI` : 'Nada para completar: os dados das obras com DOI já estavam preenchidos'}</b><span class="linha-acoes">${at.completadas.length ? '<button class="btn mini" data-org-desfazer-atualizacao data-ocupado="Desfazendo…">Desfazer</button>' : ''}<button class="btn fant mini" data-org-dispensar-atualizacao>Ok, conferi</button></span></div>${at.completadas.length ? `<ul class="org-lista-sem">${at.completadas.map((c) => `<li class="org-sem"><span><b>${esc(c.titulo)}</b><small>Completou ${esc(c.campos.map((k) => ROT[k] || k).join(', '))}</small></span></li>`).join('')}</ul>` : ''}${at.diferentes.length ? `<p class="meta">Ano diferente do Crossref, sem mexer no que você escreveu: ${at.diferentes.map((x) => `${esc(x.titulo)} (aqui ${esc(x.aqui)}, no Crossref ${esc(x.la)})`).join('; ')}.</p>` : ''}${at.falhas ? `<p class="meta">${plural(at.falhas, 'DOI não respondeu', 'DOIs não responderam')} no Crossref agora. Tente de novo mais tarde.</p>` : ''}</div>`
      : '';
    const emOrdemHTML = res.comDOI && !at?.rodando
      ? `<section class="org-sec" id="acervo-em-ordem"><div class="org-cab"><h2>Obras com DOI <span class="chip">${res.comDOI}</span></h2><button class="btn mini" data-org-atualizar-doi data-ocupado="Conferindo…">Atualizar os dados pelo DOI</button></div><p class="meta">Confere no Crossref todas as obras que têm DOI e busca revista, volume, páginas e o que mais faltar. Completa só o que está vazio; o que você escreveu fica.</p></section>`
      : '';
    const notaIA = org.iaLigada() ? '' : `<p class="meta mb-4">${org.fontesLigadas() ? 'A procura usa o Crossref e, quando ele não dá certeza, o OpenAlex.' : 'A procura usa só o Crossref.'} Com o Gemini ligado, você pode pedir, obra por obra, que a IA leia o começo do PDF e indique o candidato certo. <a href="#ajustes">Ligar em Ajustes</a></p>`;
    const grav = org.gravadosAgora();
    const gravadosHTML = grav.length && !st.rodando
      ? `<section class="org-sec" id="org-gravados"><div class="org-cab"><h2>Gravados agora <span class="chip">${grav.length}</span></h2><span class="linha-acoes"><button class="btn mini" data-org-desfazer-gravados data-ocupado="Desfazendo…">Desfazer ${grav.length === 1 ? 'este' : `os ${grav.length}`}</button><button class="btn fant mini" data-org-dispensar>Ok, conferi</button></span></div><p class="meta">Título, autor e ano batem com a base consultada, então os dados foram gravados e os campos vazios da obra foram completados.</p><ul class="org-lista-sem">${grav.map((g) => `<li class="org-sem"><span><b>${esc(g.titulo)}</b><small>${g.doi ? `DOI ${esc(g.doi)}` : 'Obra sem DOI'}, do ${g.fonte === 'openalex' ? 'OpenAlex' : 'Crossref'}</small></span></li>`).join('')}</ul></section>`
      : '';
    if (!r.total)
      return `${topo}<div class="vazio-estado"><h2>Nenhuma obra ainda</h2><p>Solte PDFs, importe do Zotero ou adicione uma obra pelo DOI. O app busca os dados e monta a referência em ABNT.</p><button class="btn prim" data-org-importar>${icone('upload')}Adicionar obras</button></div>`;
    const andamentoAt = at?.rodando
      ? `<div class="bloco org-andamento" role="status" aria-live="polite"><div class="linha-acoes"><span class="giro" aria-hidden="true"></span><b>Conferindo pelo DOI: ${at.feitos} de ${at.total}</b></div><div class="barra mb-0"><i style="width:${at.total ? Math.round((at.feitos / at.total) * 100) : 0}%"></i></div></div>`
      : '';
    const avisoFonte = st.avisoFonte ? `<div class="aviso" id="acervo-aviso-fonte"><span>ⓘ</span><div>O OpenAlex não foi consultado nesta procura: ${esc(st.avisoFonte)} A procura seguiu só pelo Crossref.</div></div>` : '';
    return `${topo}${painel(r, st, pend)}${andamento}${andamentoAt}${avisoIA}${avisoFonte}${resultadoAt}${gravadosHTML}
      ${props.length ? `<section class="org-sec"><div class="org-cab"><h2>Para você decidir <span class="chip">${props.length}</span></h2>${muitoProvaveis.length > 1 ? `<button class="btn mini" data-org-aceitar-todos data-ocupado="Aceitando…">Aceitar os ${muitoProvaveis.length} muito prováveis</button>` : ''}</div>${props.map(cartaoProposta).join('')}</section>` : ''}
      ${listaObras(r)}
      ${reps.length ? `<section class="org-sec" id="acervo-repetidas"><div class="org-cab"><h2>Parecem a mesma obra <span class="chip">${reps.length}</span></h2>${reps.filter((g) => g.tipo === 'identica').length > 1 ? `<button class="btn mini" data-org-juntar-identicas data-ocupado="Juntando…">Juntar as ${reps.filter((g) => g.tipo === 'identica').length} idênticas</button>` : ''}</div>${reps.map((g) => cartaoRepetidas(g, cacheFica.get(g.ids.join(',')))).join('')}</section>` : ''}
      ${sem.length ? `<section class="org-sec"><details class="como" ${props.length || reps.length ? '' : 'open'}><summary>Sem DOI encontrado (${sem.length})</summary><p class="meta">Livros, capítulos e trabalhos brasileiros antigos muitas vezes não têm DOI. Corrija os dados e procure de novo, ou marque que a obra não tem DOI.</p><ul class="org-lista-sem">${sem.map(cartaoSem).join('')}</ul></details></section>` : ''}
      ${notaIA}
      ${emOrdemHTML}`;
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('change', (e) => {
    if (e.target.matches('#ac-ordem')) {
      ver.ordem = e.target.value;
      return pintarLista();
    }
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
    const b = e.target.closest('[data-ac-filtro],[data-ac-completar],[data-org-atualizar-doi],[data-org-desfazer-atualizacao],[data-org-dispensar-atualizacao],[data-org-ia],[data-org-desfazer-gravados],[data-org-dispensar],[data-org-importar],[data-imp-voltar],[data-imp-gravar],[data-org-procurar],[data-org-aceitar],[data-org-recusar],[data-org-aceitar-todos],[data-org-juntar],[data-org-juntar-identicas],[data-org-nao-rep],[data-org-de-novo],[data-org-corrigir],[data-org-nao-tem],[data-org-usar-lidos]');
    if (!b) return;
    const d = b.dataset;
    if (d.acFiltro) {
      ver.filtro = d.acFiltro;
      return pintarLista();
    }
    if (d.acCompletar !== undefined) {
      const fim = org.completar();
      redesenhar();
      await fim;
      redesenhar();
      const g = org.gravadosAgora().length;
      const c = org.estadoAtualizacao()?.completadas.length || 0;
      const d2 = org.propostas().length;
      return toast([g ? plural(g, 'DOI gravado', 'DOIs gravados') : null, c ? plural(c, 'obra completada pelo DOI', 'obras completadas pelo DOI') : null, d2 ? `${d2} para você decidir` : null].filter(Boolean).join(', ') + (g || c || d2 ? '.' : 'Nada novo encontrado no Crossref.'));
    }
    if (d.orgImportar !== undefined) return abrirImportar();
    if (d.impVoltar !== undefined) return abrirImportar();
    if (d.impGravar !== undefined) return gravar();
    if (d.orgProcurar !== undefined) {
      org.procurarDOIs();
      return redesenhar();
    }
    if (d.orgAtualizarDoi !== undefined) {
      const r = await org.atualizarPeloDOI();
      redesenhar();
      return toast(r.completadas.length ? `${plural(r.completadas.length, 'obra completada', 'obras completadas')} pelo DOI` : 'Nada para completar.');
    }
    if (d.orgDesfazerAtualizacao !== undefined) {
      const n = await org.desfazerAtualizacao();
      redesenhar();
      return toast(`${plural(n, 'obra voltou', 'obras voltaram')} a como estava.`);
    }
    if (d.orgDispensarAtualizacao !== undefined) {
      org.dispensarAtualizacao();
      return redesenhar();
    }
    if (d.orgIa) {
      await org.pedirIA(d.orgIa);
      return redesenhar();
    }
    if (d.orgDesfazerGravados !== undefined) {
      const n = await org.desfazerGravados();
      redesenhar();
      return toast(`${plural(n, 'gravação desfeita', 'gravações desfeitas')}. As obras voltaram para a lista de conferir.`);
    }
    if (d.orgDispensar !== undefined) {
      org.dispensarGravados();
      return redesenhar();
    }
    if (d.orgAceitar) {
      const desfazer = await org.aceitar(d.orgAceitar, d.doi);
      redesenhar();
      if (desfazer) toast(`${String(d.doi).startsWith('openalex:') ? 'Obra aceita' : 'DOI aceito'}. Os campos vazios da obra foram completados.`, async () => { await desfazer(); redesenhar(); });
      return;
    }
    if (d.orgRecusar) {
      await org.recusar(d.orgRecusar, d.doi);
      return redesenhar();
    }
    if (d.orgAceitarTodos !== undefined) {
      const ls = org.propostas().filter((l) => l.doiBusca.confianca === 'muito-provavel');
      const desfazeres = [];
      for (const l of ls) desfazeres.push(await org.aceitar(l.id, chaveCand(l.doiBusca.candidato)));
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
