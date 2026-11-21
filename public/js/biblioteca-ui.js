// Telas da biblioteca real: lista, "Adicionar obra" e o leitor de PDF.
// O HTML principal chama rb.bibUI.lista() e rb.bibUI.leitor(id) quando o app está com dados reais;
// este módulo monta o PDF depois que a tela é desenhada (evento rb:render).
import { referencia, referenciaTexto, autorCurto, citacao } from './abnt.js';
import { buscarDOI, limparDOI } from './crossref.js';
import { entender } from './fontes.js';
import { origensAoSalvar } from './acervo.js';
import { barraHTML, tamanho } from './espera.js';
import { montarLeitor, lerInicio, FUNCOES } from './leitor-pdf.js';
import { montarLeitura } from './leitor-texto.js';
import { ETAPAS } from './progresso.js';
import { compararObras } from './duplicatas.js';
import { assinatura } from './biblioteca.js';
import { ouvir } from './ui.js';

/* global I, S, toast, fecharModal */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icone = (n) => (typeof I !== 'undefined' && I[n]) || '';
const TIPOS = [
  ['artigo', 'Artigo de periódico'],
  ['livro', 'Livro'],
  ['capitulo', 'Capítulo de livro'],
  ['anais', 'Trabalho em evento'],
  ['dissertacao', 'Dissertação'],
  ['tese', 'Tese'],
  ['outro', 'Outro'],
];
const ROTULO_VEICULO = { artigo: 'Revista', livro: 'Coleção (opcional)', capitulo: 'Título do livro', anais: 'Nome do evento', dissertacao: 'Programa', tese: 'Programa', outro: 'Publicado em' };

export function criarBibliotecaUI({ bib, registrar }) {
  // O que veio de uma busca neste formulário, para a ficha guardar de onde veio cada dado.
  let buscado = {};
  const anotar = (dados, fonte) => Object.entries(dados).forEach(([k, valor]) => (buscado[k] = { valor, fonte }));
  let busca = '';
  let leitorAtual = null; // { id, controle, palco }
  let montando = null;
  let rascunho = null; // ficha em edição no "Adicionar obra"
  let editando = null; // id da obra quando o modal corrige dados de uma obra existente
  let pdfEscolhido = null;
  let confirmarRepetida = false;

  const redesenhar = () => typeof window.render === 'function' && window.render();

  /* ---------- Lista ---------- */
  function linha(l) {
    const total = l.totalPaginas;
    const pct = total ? Math.round(((l.paginaAtual || 0) / total) * 100) : 0;
    const grifos = bib.grifosDe(l.id).length;
    const pdf = !l.pdf ? '<span class="chip">sem PDF</span>' : l.pdf.pendente ? '<span class="chip" title="Guardado neste aparelho; vai para o Drive quando houver internet">PDF a enviar</span>' : '';
    return `<a class="linha-lv obra" role="row" href="#leitor/${encodeURIComponent(l.id)}">
      <div>
        <div class="tit">${esc(l.titulo)}</div>
        <div class="aut">${esc(autorCurto(l))}${l.veiculo ? '. ' + esc(l.veiculo) : ''}</div>
        <div class="tags">${l.projeto ? `<span class="chip proj">${esc(l.projeto)}</span>` : ''}${(l.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}${pdf}</div>
      </div>
      <div class="est"><span>${ETAPAS[l.etapa] || ETAPAS[0]}</span></div>
      <div class="prog">${total ? `p. ${l.paginaAtual || 1} de ${total}` : '—'}<small>${grifos} ${grifos === 1 ? 'grifo' : 'grifos'}${total ? `, ${pct}%` : ''}</small></div>
    </a>`;
  }

  /** A leitura em andamento mexida por último, em destaque no topo do Ler. */
  function continueLendoHTML(todas) {
    const l = todas
      .filter((x) => x.pdf && (x.etapa || 0) === 1)
      .sort((a, b) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''))[0];
    if (!l) return '';
    return `<section class="proximo continue-lendo" aria-labelledby="cl-t"><div class="rot" id="cl-t">Continue lendo</div>
      <h2 class="prox-tit">${esc(l.titulo)}</h2>
      <p class="prox-aut">${esc(autorCurto(l))}</p>
      <div class="acao-l"><a class="btn prim" href="#leitor/${encodeURIComponent(l.id)}">Continuar a leitura</a>${l.totalPaginas ? `<span>p. ${l.paginaAtual || 1} de ${l.totalPaginas}</span>` : ''}</div>
    </section>`;
  }

  function lista() {
    const todas = bib.leituras();
    const b = busca.toLowerCase();
    const filtradas = todas.filter((l) => !b || [l.titulo, l.subtitulo, l.veiculo, l.projeto, ...(l.tags || []), ...(l.autores || []).map((a) => a.sobrenome)].join(' ').toLowerCase().includes(b));
    const topo = `<div class="topo">
      <div><h1>Biblioteca</h1><p>${todas.length ? `${todas.length} ${todas.length === 1 ? 'obra' : 'obras'}. Abra uma obra para ler e grifar.` : 'Suas obras, com o PDF guardado no seu Drive.'}</p></div>
      <div class="acoes">
        ${todas.length ? `<label class="busca">${icone('busca')}<input id="bib-busca" type="search" placeholder="Buscar título, autor, tag" value="${esc(busca)}"></label>` : ''}
        <button class="btn" data-org-importar>${icone('upload')}Importar</button>
        <button class="btn prim" data-bib="adicionar">${icone('mais')}Adicionar obra</button>
      </div>
    </div>`;
    if (!todas.length) {
      return `${topo}<div class="bib-vazia"><h2>Sua biblioteca está vazia</h2><p>Adicione um artigo pelo DOI ou envie o PDF. O app busca os dados da obra, monta a referência em ABNT e guarda o PDF no seu Drive e neste aparelho.</p><div class="linha-acoes j-centro"><button class="btn prim" data-bib="adicionar">${icone('mais')}Adicionar a primeira obra</button><button class="btn" data-org-importar>${icone('upload')}Importar PDFs ou o Zotero</button></div></div>`;
    }
    return `${topo}${busca ? '' : continueLendoHTML(todas)}<div class="tabela" role="table">
      <div class="linha-lv cab" role="row"><span>Obra</span><span>Etapa</span><span>Progresso</span></div>
      ${filtradas.length ? filtradas.map(linha).join('') : `<div class="vazio">Nada encontrado para “${esc(busca)}”.</div>`}
    </div>`;
  }

  /* ---------- Adicionar obra ---------- */
  function campos(f) {
    const v = (k) => esc(f[k] ?? '');
    const autores = (f.autores || []).map((a) => `${a.sobrenome}${a.prenomes ? ', ' + a.prenomes : ''}`).join('\n');
    return `<div class="ficha">
      <div class="linha2">
        <div class="campo"><label for="f-tipo">Tipo</label><select id="f-tipo">${TIPOS.map(([k, n]) => `<option value="${k}" ${f.tipo === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="campo"><label for="f-ano">Ano</label><input id="f-ano" inputmode="numeric" value="${v('ano')}"></div>
      </div>
      <div class="campo"><label for="f-titulo">Título</label><input id="f-titulo" value="${v('titulo')}" required></div>
      <div class="campo"><label for="f-subtitulo">Subtítulo</label><input id="f-subtitulo" value="${v('subtitulo')}"></div>
      <div class="campo"><label for="f-autores">Autores <small>um por linha: Sobrenome, Prenomes</small></label><textarea id="f-autores" rows="3">${esc(autores)}</textarea></div>
      <div class="campo"><label for="f-veiculo" id="f-veiculo-rot">${ROTULO_VEICULO[f.tipo] || 'Publicado em'}</label><input id="f-veiculo" value="${v('veiculo')}"></div>
      <div class="linha3">
        <div class="campo"><label for="f-volume">Volume</label><input id="f-volume" value="${v('volume')}"></div>
        <div class="campo"><label for="f-numero">Número</label><input id="f-numero" value="${v('numero')}"></div>
        <div class="campo"><label for="f-paginas">Páginas</label><input id="f-paginas" placeholder="135-146" value="${v('paginas')}"></div>
      </div>
      <div class="linha2">
        <div class="campo"><label for="f-editora">Editora ou instituição</label><input id="f-editora" value="${v('editora')}"></div>
        <div class="campo"><label for="f-local">Local</label><input id="f-local" value="${v('local')}"></div>
      </div>
      <div class="campo"><label for="f-doi">DOI</label><input id="f-doi" value="${v('doi')}"></div>
      <div class="linha2">
        <div class="campo"><label for="f-projeto">Projeto</label><input id="f-projeto" list="f-projetos" placeholder="Dissertação, nome da disciplina…" value="${v('projeto')}"><datalist id="f-projetos">${[...new Set(['Dissertação', ...bib.leituras().map((l) => l.projeto).filter(Boolean)])].map((p) => `<option value="${esc(p)}">`).join('')}</datalist></div>
        <div class="campo"><label for="f-tags">Tags <small>separadas por vírgula</small></label><input id="f-tags" value="${esc((f.tags || []).join(', '))}"></div>
      </div>
      <div class="ref-previa"><small>Referência (ABNT)</small><p id="f-ref">${referencia(f)}</p></div>
    </div>`;
  }

  function lerCampos() {
    const g = (id) => document.getElementById(id)?.value.trim() || null;
    const autores = (g('f-autores') || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [sobrenome, ...resto] = s.split(',');
        return { sobrenome: sobrenome.trim(), prenomes: resto.join(',').trim() };
      });
    return {
      ...rascunho,
      tipo: g('f-tipo') || 'artigo',
      ano: g('f-ano'),
      titulo: g('f-titulo'),
      subtitulo: g('f-subtitulo'),
      autores,
      veiculo: g('f-veiculo'),
      volume: g('f-volume'),
      numero: g('f-numero'),
      paginas: g('f-paginas'),
      editora: g('f-editora'),
      local: g('f-local'),
      doi: limparDOI(g('f-doi')) || g('f-doi'),
      projeto: g('f-projeto'),
      tags: (g('f-tags') || '').split(',').map((t) => t.trim()).filter(Boolean),
    };
  }

  function mensagem(texto, tipo = 'info') {
    const el = document.getElementById('ad-msg');
    if (el) el.innerHTML = texto ? `<div class="ad-msg ${tipo}" role="${tipo === 'erro' ? 'alert' : 'status'}">${esc(texto)}</div>` : '';
  }

  function mostrarFicha(f) {
    rascunho = f;
    const el = document.getElementById('ad-ficha');
    if (el) el.innerHTML = campos(f);
    document.getElementById('ad-salvar')?.removeAttribute('hidden');
  }

  function editar(id) {
    const l = bib.obter(id);
    if (!l) return;
    editando = id;
    buscado = {};
    rascunho = { ...l };
    pdfEscolhido = null;
    const veu = document.getElementById('veu');
    veu.innerHTML = `<div class="modal" role="dialog" aria-labelledby="modal-tit"><h2 id="modal-tit">Corrigir dados da obra</h2>
      <p>A referência ABNT se atualiza enquanto você corrige.</p>
      <div class="ad-origem"><div class="campo"><label for="ad-doi">Buscar de novo pelo DOI</label><div class="linha-doi"><input id="ad-doi" value="${esc(l.doi || '')}" autocomplete="off"><button class="btn" data-bib="buscar-doi" data-ocupado="Buscando…">Buscar</button></div></div></div>
      <div id="ad-msg"></div>
      <div id="ad-ficha">${campos(l)}</div>
      <div class="pe"><button class="btn fant" data-acao="fechar">Cancelar</button><button class="btn prim" id="ad-salvar" data-bib="salvar" data-ocupado="Salvando…">Salvar correções</button></div>
    </div>`;
    veu.classList.add('on');
    document.getElementById('f-titulo').focus();
  }

  function abrirAdicionar() {
    editando = null;
    buscado = {};
    confirmarRepetida = false;
    rascunho = null;
    pdfEscolhido = null;
    const veu = document.getElementById('veu');
    veu.innerHTML = `<div class="modal" role="dialog" aria-labelledby="modal-tit"><h2 id="modal-tit">Adicionar obra</h2>
      <p>Comece pelo DOI ou pelo PDF. Os dados da obra aparecem para você conferir antes de salvar.</p>
      <div class="ad-origem">
        <div class="campo"><label for="ad-doi">DOI ou link do DOI</label><div class="linha-doi"><input id="ad-doi" placeholder="10.1057/ejis.2011.54 ou https://doi.org/10.1057/ejis.2011.54" autocomplete="off"><button class="btn" data-bib="buscar-doi" data-ocupado="Buscando…">Buscar</button></div></div>
        <div class="campo"><label for="ad-pdf">PDF</label><input type="file" id="ad-pdf" accept="application/pdf,.pdf" multiple></div>
      </div>
      <p class="meta">Vários PDFs ou a biblioteca do Zotero? <button class="lnk m-0" data-org-importar>Importar de uma vez</button></p>
      <button class="btn fant" data-bib="manual">Preencher à mão</button>
      <div id="ad-msg"></div>
      <div id="ad-ficha"></div>
      <div class="pe"><button class="btn fant" data-acao="fechar">Cancelar</button><button class="btn prim" id="ad-salvar" data-bib="salvar" hidden data-ocupado="Salvando…">Salvar na biblioteca</button></div>
    </div>`;
    veu.classList.add('on');
    document.getElementById('ad-doi').focus();
  }

  // O que já está na ficha (inclusive o que o Diobert digitou) não se perde ao buscar.
  const fichaAtual = () => (document.getElementById('f-titulo') ? lerCampos() : rascunho || { tipo: 'artigo' });

  /**
   * O campo aceita um DOI ou um link que traga o DOI (doi.org/10...). Os dados vêm do Crossref.
   * Link de página sem DOI não é aberto: o app não lê páginas de outros sites (decisão de 21/11/2026).
   */
  async function aoBuscar(texto) {
    if (entender(texto).linkSemDOI) {
      mensagem('Este link não traz o DOI. Na página do artigo, copie o DOI (começa com 10.) ou o link dele (doi.org/10…) e cole aqui.', 'erro');
      return false;
    }
    return aoBuscarDOI(texto);
  }
  async function aoBuscarDOI(doiTexto, { base, aviso, origem } = {}) {
    mensagem('Buscando no Crossref…');
    const r = await buscarDOI(doiTexto, { registrar });
    const atual = base || fichaAtual();
    if (r.erro) {
      mostrarFicha({ ...atual, doi: limparDOI(doiTexto) || atual.doi || null });
      mensagem(aviso ? `${aviso}, mas: ${r.erro}` : r.erro, 'erro');
      return false;
    }
    // Do Crossref vêm só os dados da obra; projeto, tags e páginas do PDF continuam os da ficha.
    const doCrossref = Object.fromEntries(Object.entries(r.dados).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)));
    anotar(doCrossref, 'crossref');
    mostrarFicha({ ...atual, ...doCrossref });
    mensagem(aviso ? `${aviso} e busquei os dados no Crossref. Confira antes de salvar.` : 'Dados encontrados no Crossref. Confira antes de salvar.', 'ok');
    return true;
  }

  async function aoEscolherPDF(arquivo) {
    if (!arquivo) return;
    if (!/pdf$/i.test(arquivo.type) && !/\.pdf$/i.test(arquivo.name)) {
      mensagem('Escolha um arquivo PDF.', 'erro');
      return;
    }
    pdfEscolhido = arquivo;
    mensagem('Lendo o PDF…');
    let inicio;
    try {
      inicio = await lerInicio(arquivo);
    } catch {
      mensagem('Não deu para ler este PDF. Ele pode estar protegido ou corrompido. Você ainda pode salvar a obra e preencher os dados à mão.', 'erro');
      mostrarFicha({ tipo: 'artigo', titulo: arquivo.name.replace(/\.pdf$/i, '') });
      return;
    }
    const base = { ...fichaAtual(), totalPaginas: inicio.total, titulo: fichaAtual().titulo || inicio.titulo || arquivo.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ') };
    const doi = limparDOI(inicio.texto);
    if (doi) {
      document.getElementById('ad-doi').value = doi;
      await aoBuscarDOI(doi, { base, aviso: 'Encontrei o DOI no PDF' });
    } else {
      mostrarFicha(base);
      mensagem('O PDF não traz DOI. Confira o título e preencha os autores e o ano.', 'info');
    }
  }

  async function salvar() {
    const f = lerCampos();
    if (!f.titulo) {
      mensagem('Falta o título da obra.', 'erro');
      document.getElementById('f-titulo')?.focus();
      return;
    }
    if (editando) {
      const { id: _i, adicionadaEm: _a, ...mudancas } = f;
      mudancas.origens = origensAoSalvar(bib.obter(editando), f, buscado);
      await bib.atualizar(editando, mudancas);
      registrar('ui', 'biblioteca.corrigir');
      editando = null;
      fecharModal();
      toast('Dados da obra corrigidos');
      redesenhar();
      return;
    }
    if (!confirmarRepetida) {
      const sha256 = pdfEscolhido ? await assinatura(pdfEscolhido) : null;
      const igual = bib.leituras().map((l) => ({ l, c: compararObras({ ...f, pdf: sha256 ? { sha256 } : null }, l) })).find((x) => x.c);
      if (igual) {
        confirmarRepetida = true;
        mensagem(`${igual.c.tipo === 'identica' ? 'Esta obra já está' : 'Parece que esta obra já está'} na biblioteca (${igual.c.motivo}): “${igual.l.titulo}”. Para salvar mesmo assim, selecione Salvar de novo.`, 'erro');
        return;
      }
    }
    confirmarRepetida = false;
    f.origens = origensAoSalvar(null, f, buscado);
    const id = await bib.adicionar(f, pdfEscolhido);
    fecharModal();
    toast(pdfEscolhido ? 'Obra salva. O PDF vai para o seu Drive.' : 'Obra salva na biblioteca');
    pdfEscolhido = null;
    location.hash = `#leitor/${id}`;
  }

  /* ---------- Leitor ---------- */
  function listaGrifosHTML(id) {
    const gs = bib.grifosDe(id);
    if (!gs.length) return '<p class="t-meta mute">Selecione um trecho do texto para grifar. Cada cor tem uma função.</p>';
    return gs
      .map((g) => `<button class="grifo-item" style="border-color:var(--hl-${g.funcao})" data-bib="ir-grifo" data-pagina="${g.pagina}">${esc(g.texto)}<small>${FUNCOES.find((f) => f.id === g.funcao)?.nome}, p. ${g.pagina}</small></button>`)
      .join('');
  }

  // Modo do leitor neste aparelho: leitura (só texto e figuras) ou PDF. No celular, o padrão é leitura.
  const MODO = 'rb.leitor.modo';
  function modoLeitor() {
    try {
      const m = localStorage.getItem(MODO);
      if (m === 'leitura' || m === 'pdf') return m;
    } catch {
      // Sem armazenamento local: vale o padrão.
    }
    return matchMedia('(max-width: 1000px)').matches ? 'leitura' : 'pdf';
  }

  function leitor(id) {
    const l = bib.obter(id);
    if (!l) return null;
    const modo = modoLeitor();
    const verGrifos = typeof S !== 'undefined' ? S.verGrifos : false;
    const tutor = window.rb?.tutorUI;
    const verTutor = !!tutor && (typeof S !== 'undefined' ? S.verTutor : false);
    return `<div class="leitor-barra">
      <a class="btn fant" href="#biblioteca">${icone('voltar')}Ler</a>
      <div class="tit">${esc(l.titulo)}<small>${esc(autorCurto(l))}, ${ETAPAS[l.etapa] || ETAPAS[0]}</small></div>
      ${l.pdf ? `<div class="alterna modo-leitor" role="group" aria-label="Modo do leitor"><button class="txt" data-modo-leitor="leitura" aria-pressed="${modo === 'leitura'}">Leitura</button><button class="txt" data-modo-leitor="pdf" aria-pressed="${modo === 'pdf'}">PDF</button></div>` : ''}
      <div class="alterna" role="group" aria-label="Painéis do leitor">
        <button class="txt" data-alt="verGrifos" aria-pressed="${verGrifos}">${icone('painelEsq')}Grifos</button>
        ${tutor ? `<button class="txt" data-alt="verTutor" aria-pressed="${verTutor}">${icone('tutor')}Tutor</button>` : ''}
        <button class="txt" data-bib="referencia" data-id="${esc(l.id)}">Referência</button>
      </div>
      <div class="dir"><span class="t-legenda mute-2" id="pdf-pag">${l.totalPaginas ? `p. ${l.paginaAtual || 1} de ${l.totalPaginas}` : ''}</span>${
        l.etapa >= 2
          ? `<a class="btn prim" href="#fichamento/${encodeURIComponent(l.id)}">${l.etapa >= 4 ? 'Ver fichamento' : l.etapa === 3 ? 'Continuar fichamento' : 'Fazer fichamento'}</a>`
          : `<button class="btn prim" data-bib="concluir" data-id="${esc(l.id)}">Concluir leitura</button>`
      }</div>
    </div>
    <div class="leitor-grid ${verTutor ? '' : 'sem-tutor'} ${verGrifos ? '' : 'sem-grifos'}">
      <aside class="col-grifos" aria-label="Grifos neste texto">
        <button class="fechar-folha" data-alt="verGrifos">Fechar</button>
        <h4>Grifos neste texto</h4>
        <div id="lista-grifos-real">${listaGrifosHTML(l.id)}</div>
      </aside>
      <div class="palco"><div id="pdf-palco" data-id="${esc(l.id)}">${
        l.pdf ? '<div class="pdf-aviso">Abrindo o PDF…</div>' : `<div class="pdf-aviso"><p>Esta obra ainda não tem PDF.</p><label class="btn prim">Adicionar PDF<input type="file" accept="application/pdf,.pdf" data-bib-pdf="${esc(l.id)}" hidden></label><div class="ref-previa"><small>Referência (ABNT)</small><p>${referencia(l)}</p></div></div>`
      }</div></div>
      ${tutor ? tutor.painel(l.id) : ''}
    </div>`;
  }

  async function montar(id) {
    const palco = document.getElementById('pdf-palco');
    if (!palco || (montando && montando.id === id && montando.palco === palco)) return;
    const l = bib.obter(id);
    if (!l?.pdf) return;
    // Se a tela for redesenhada no meio (ex.: a sincronização terminou), uma montagem nova assume
    // o palco novo e esta desiste, para o PDF nunca ficar preso num palco fora da tela.
    const eu = { id, palco };
    montando = eu;
    const vale = () => montando === eu && document.body.contains(palco);
    const inicio = performance.now();
    // PDF que ainda não está neste aparelho: barra com os MB e a porcentagem enquanto ele vem do Drive.
    const r = await bib.obterPDF(id, (lidos, total) => {
      const aviso = vale() && palco.querySelector('.pdf-aviso');
      if (aviso) aviso.innerHTML = barraHTML({ rotulo: 'Baixando o PDF do Drive', feito: lidos, total, medida: tamanho });
    });
    if (!vale()) {
      if (montando === eu) montando = null;
      return;
    }
    if (r.erro) {
      montando = null;
      palco.innerHTML = `<div class="pdf-aviso" role="alert"><p>${esc(r.erro)}</p></div>`;
      return;
    }
    let salvarPagina = null;
    const opcoes = {
      palco,
      blob: r.blob,
      grifos: bib.grifosDe(id),
      paginaInicial: l.paginaAtual || 1,
      aoErro: () => {
        palco.innerHTML = '<div class="pdf-aviso" role="alert"><p>Não deu para abrir este PDF. Ele pode estar protegido ou corrompido.</p></div>';
        registrar('erro', 'leitor.pdf_erro', { st: 'erro' });
      },
      aoGrifar: async (g) => {
        await bib.grifar({ leituraId: id, ...g });
        const nome = FUNCOES.find((f) => f.id === g.funcao)?.nome.toLowerCase();
        toast(`Grifado como ${nome}`);
      },
      aoClicarGrifo: (gid, el) => menuGrifo(gid, el),
      aoPerguntar: window.rb?.tutorUI ? (sel) => window.rb.tutorUI.comTrecho(id, sel) : undefined,
      aoMudarPagina: (n, total) => {
        const p = document.getElementById('pdf-pag');
        if (p) p.textContent = `p. ${n} de ${total}`;
        clearTimeout(salvarPagina);
        salvarPagina = setTimeout(() => {
          const atual = bib.obter(id);
          if (atual && (atual.paginaAtual !== n || atual.totalPaginas !== total)) bib.atualizar(id, { paginaAtual: n, totalPaginas: total, etapa: Math.max(atual.etapa || 0, 1) });
        }, 1500);
      },
    };
    let controle = modoLeitor() === 'leitura' ? await montarLeitura(opcoes) : await montarLeitor(opcoes);
    if (controle?.semTexto) {
      // PDF digitalizado (só imagem): não há texto para o modo leitura.
      toast('Este PDF não tem texto para o modo leitura. Abri no modo PDF.');
      controle = vale() ? await montarLeitor(opcoes) : null;
    }
    if (!vale()) {
      controle?.destruir();
      if (montando === eu) montando = null;
      return;
    }
    montando = null;
    if (controle) {
      leitorAtual = { id, controle, palco };
      registrar('ui', 'leitor.abrir_pdf', { det: `${controle.total} páginas`, dur: Math.round(performance.now() - inicio) });
    }
  }

  function menuGrifo(gid, el) {
    document.querySelector('.menu-grifo')?.remove();
    const caixa = el.getBoundingClientRect();
    const m = document.createElement('div');
    m.className = 'popover on menu-grifo';
    m.innerHTML = `<div class="linha-p">${FUNCOES.map((f) => `<button class="cor-n" data-mudar-grifo="${f.id}"><i class="c-${f.id}"></i>${f.nome}</button>`).join('')}</div><div class="linha-p"><button class="btn" data-apagar-grifo>Apagar grifo</button></div>`;
    document.body.appendChild(m);
    const w = m.offsetWidth;
    m.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, caixa.left + caixa.width / 2 - w / 2 + scrollX))}px`;
    m.style.top = `${caixa.bottom + scrollY + 8}px`;
    m.addEventListener('click', async (e) => {
      const cor = e.target.closest('[data-mudar-grifo]')?.dataset.mudarGrifo;
      if (cor) await bib.mudarGrifo(gid, { funcao: cor });
      if (e.target.closest('[data-apagar-grifo]')) {
        const desfazer = await bib.apagarGrifo(gid);
        toast('Grifo apagado', desfazer);
      }
      m.remove();
    });
    setTimeout(() => document.addEventListener('click', function fora(e) {
      if (!m.contains(e.target)) {
        m.remove();
        document.removeEventListener('click', fora);
      }
    }), 0);
  }

  /* ---------- Eventos ---------- */
  ouvir('click', async (e) => {
    const b = e.target.closest('[data-bib]');
    if (!b) return;
    const acao = b.dataset.bib;
    if (acao === 'adicionar') abrirAdicionar();
    if (acao === 'buscar-doi') return aoBuscar(document.getElementById('ad-doi').value);
    if (acao === 'manual') {
      mensagem('');
      mostrarFicha(rascunho || { tipo: 'artigo' });
      document.getElementById('f-titulo')?.focus();
    }
    if (acao === 'salvar') salvar();
    if (acao === 'concluir') {
      await bib.atualizar(b.dataset.id, { etapa: 2 });
      toast('Leitura concluída. Agora, o fichamento.');
      redesenhar();
    }
    if (acao === 'referencia') {
      const l = bib.obter(b.dataset.id);
      const texto = referenciaTexto(l);
      try {
        await navigator.clipboard.writeText(texto);
        toast(`Referência copiada. Citação: ${citacao(l)}`);
      } catch {
        toast(texto);
      }
    }
    if (acao === 'ir-grifo') {
      leitorAtual?.controle.irPara(Number(b.dataset.pagina));
      if (innerWidth <= 1000 && typeof S !== 'undefined') {
        S.verGrifos = false;
        document.querySelector('.leitor-grid')?.classList.add('sem-grifos');
      }
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'ad-doi') {
      e.preventDefault();
      aoBuscarDOI(e.target.value);
    }
  });
  document.addEventListener('change', async (e) => {
    if (e.target.id === 'ad-pdf') {
      // Mais de um PDF: vai para Importar, que confere repetidas e liga tudo de uma vez.
      if (e.target.files.length > 1) return window.rb?.organizarUI?.abrirImportar([...e.target.files]);
      aoEscolherPDF(e.target.files[0]);
    }
    if (e.target.dataset?.bibPdf) {
      const arquivo = e.target.files[0];
      if (!arquivo) return;
      await bib.guardarPDF(e.target.dataset.bibPdf, arquivo);
      redesenhar();
    }
    if (e.target.id === 'f-tipo') {
      const r = document.getElementById('f-veiculo-rot');
      if (r) r.textContent = ROTULO_VEICULO[e.target.value] || 'Publicado em';
    }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'bib-busca') {
      busca = e.target.value;
      const pos = e.target.selectionStart;
      redesenhar();
      const campo = document.getElementById('bib-busca');
      campo?.focus();
      campo?.setSelectionRange(pos, pos);
    }
    if (e.target.closest?.('#ad-ficha')) {
      const ref = document.getElementById('f-ref');
      if (ref) ref.innerHTML = referencia(lerCampos());
    }
  });

  // Trocar entre leitura e PDF: fecha o que está aberto e monta de novo, na mesma página.
  ouvir('click', (e) => {
    const b = e.target.closest('[data-modo-leitor]');
    if (!b || b.getAttribute('aria-pressed') === 'true') return;
    try {
      localStorage.setItem(MODO, b.dataset.modoLeitor);
    } catch {
      // Sem armazenamento local, a troca vale só para esta tela.
    }
    registrar('ui', 'leitor.modo', { det: b.dataset.modoLeitor });
    if (leitorAtual) {
      leitorAtual.controle.destruir();
      leitorAtual = null;
    }
    window.render?.();
  });

  // Depois de cada tela desenhada: monta o PDF no leitor; desmonta ao sair.
  document.addEventListener('rb:render', () => {
    const m = (location.hash || '').match(/^#leitor\/(.+)$/);
    const id = m ? decodeURIComponent(m[1]) : null;
    if (leitorAtual && leitorAtual.id !== id) {
      leitorAtual.controle.destruir();
      leitorAtual = null;
    }
    if (leitorAtual) {
      // A tela foi redesenhada (ex.: abriu os grifos): recoloca o PDF já aberto, sem abrir de novo.
      const novo = document.getElementById('pdf-palco');
      if (novo && novo !== leitorAtual.palco) novo.replaceWith(leitorAtual.palco);
      return;
    }
    if (id && bib.obter(id)) montar(id);
  });

  // Mudanças nos dados: atualiza a lista de grifos e as marcas sem redesenhar o PDF.
  bib.aoMudar(() => {
    if (leitorAtual) {
      leitorAtual.controle.atualizarGrifos(bib.grifosDe(leitorAtual.id));
      const lg = document.getElementById('lista-grifos-real');
      if (lg) lg.innerHTML = listaGrifosHTML(leitorAtual.id);
      return;
    }
    if (/^#biblioteca/.test(location.hash) && !document.getElementById('veu')?.classList.contains('on')) redesenhar();
  });

  return { lista, leitor, abrirAdicionar, editar, atual: () => leitorAtual };
}
