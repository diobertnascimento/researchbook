// Trilhas reais: filas de leitura com prazo, montadas com as obras da biblioteca.
// Coleção "trilhas": { id, nome, objetivo, prazo: 'AAAA-MM-DD' | null, itens: [id da obra, em ordem] }.
// O andamento de cada obra vem da própria obra (etapa), nunca é copiado para a trilha.
import { autorCurto } from './abnt.js';
import { pipsHTML, proximaAcao, textoPrazo, diaLocal } from './progresso.js';

/* global I, toast, fecharModal */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icone = (n) => (typeof I !== 'undefined' && I[n]) || '';

export function criarTrilhasUI({ bib, dados, fichUI, registrar }) {
  let trilhas = [];
  let rascunho = null; // trilha em edição no modal

  async function carregar() {
    trilhas = (await dados.listar('trilhas')).sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999') || (a.criadoEm || '').localeCompare(b.criadoEm || ''));
  }

  function trilhaHTML(t) {
    const obras = (t.itens || []).map((id) => bib.obter(id)).filter(Boolean);
    const abertas = obras.filter((l) => (l.etapa || 0) < 4);
    const feitas = obras.filter((l) => (l.etapa || 0) >= 4);
    const agora = abertas[0];
    const p = textoPrazo(t.prazo);
    const linha = (l, feita) => {
      const a = proximaAcao(l, fichUI.doLivro(l.id));
      const cls = feita ? 'feito' : l === agora ? 'agora' : '';
      return `<li class="${cls}"><div><div class="t">${esc(l.titulo)}</div><div class="a">${esc(autorCurto(l))}${a.detalhe ? `. ${esc(a.detalhe)}` : ''}</div></div>${pipsHTML(l.etapa)}<a class="btn ${l === agora ? 'prim' : 'fant'} acao" href="${a.href}">${a.rotulo}</a></li>`;
    };
    return `<section class="trilha" data-trilha="${esc(t.id)}">
      <header>
        <div><h2>${esc(t.nome)}</h2><p>${t.objetivo ? `${esc(t.objetivo)}. ` : ''}${obras.length ? `${feitas.length} de ${obras.length} ${obras.length === 1 ? 'fichada' : 'fichadas'}.` : 'Nenhuma obra ainda.'}</p></div>
        <div class="prazo ${p.urgente && abertas.length ? 'urgente' : ''}"><b>${p.principal}</b>${p.detalhe ? `<small>${p.detalhe}</small>` : ''}</div>
        <button class="btn fant" data-trilha-editar="${esc(t.id)}">Editar trilha</button>
      </header>
      ${abertas.length ? `<ol class="seq">${abertas.map((l) => linha(l, false)).join('')}</ol>` : obras.length ? '<p class="trilha-ok">Todas as obras desta trilha estão fichadas.</p>' : `<p class="mute">Use “Editar trilha” para escolher as obras e a ordem.</p>`}
      ${feitas.length ? `<details class="concluidas"><summary>Ver ${feitas.length} ${feitas.length === 1 ? 'fichada' : 'fichadas'}</summary><ol class="seq feitas">${feitas.map((l) => linha(l, true)).join('')}</ol></details>` : ''}
    </section>`;
  }

  function tela() {
    const topo = `<div class="topo"><div><h1>Trilhas</h1><p>Filas de leitura com prazo. A ordem da trilha é a ordem sugerida para ler.</p></div>
      <div class="acoes"><button class="btn ${trilhas.length ? '' : 'prim'}" data-trilha-nova>${icone('mais')}Nova trilha</button></div></div>`;
    if (!trilhas.length) {
      const temObras = bib.leituras().length > 0;
      return `${topo}<div class="bib-vazia"><h2>Nenhuma trilha ainda</h2><p>Uma trilha junta as obras que você precisa ler para uma entrega, como a qualificação ou o trabalho de uma disciplina, na ordem em que fazem sentido.</p>${
        temObras ? `<button class="btn prim" data-trilha-nova>${icone('mais')}Criar a primeira trilha</button>` : '<a class="btn prim" href="#biblioteca">Adicionar obras à biblioteca</a>'
      }</div>`;
    }
    return topo + trilhas.map(trilhaHTML).join('');
  }

  /* ---------- Criar e editar ---------- */
  function itensHTML() {
    const obras = rascunho.itens.map((id) => bib.obter(id)).filter(Boolean);
    const fora = bib.leituras().filter((l) => !rascunho.itens.includes(l.id));
    return `${
      obras.length
        ? `<ol class="tr-itens">${obras
            .map(
              (l, i) => `<li><span class="n">${i + 1}</span><span class="tt">${esc(l.titulo)}<small>${esc(autorCurto(l))}</small></span>
            <span class="bts"><button class="btn fant" data-tr-mover="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>Subir</button><button class="btn fant" data-tr-mover="${i}" data-dir="1" ${i === obras.length - 1 ? 'disabled' : ''}>Descer</button><button class="btn fant" data-tr-tirar="${i}">Tirar</button></span></li>`,
            )
            .join('')}</ol>`
        : '<p class="mute">Nenhuma obra na trilha ainda.</p>'
    }
    ${
      fora.length
        ? `<div class="campo"><label for="tr-add">Adicionar obra</label><div class="linha-doi"><select id="tr-add"><option value="">Escolha uma obra da biblioteca</option>${fora.map((l) => `<option value="${esc(l.id)}">${esc(autorCurto(l))}. ${esc(l.titulo.length > 70 ? l.titulo.slice(0, 70) + '…' : l.titulo)}</option>`).join('')}</select><button class="btn" data-tr-adicionar>Adicionar</button></div></div>`
        : bib.leituras().length
          ? '<p class="mute">Todas as obras da biblioteca já estão nesta trilha.</p>'
          : '<p class="mute">A biblioteca está vazia. Adicione obras e volte aqui.</p>'
    }`;
  }

  function abrirModal(t = null) {
    rascunho = t ? structuredClone(t) : { id: null, nome: '', objetivo: '', prazo: null, itens: [] };
    rascunho.itens = (rascunho.itens || []).filter((id) => bib.obter(id));
    const veu = document.getElementById('veu');
    veu.innerHTML = `<div class="modal" role="dialog" aria-labelledby="modal-tit"><h2 id="modal-tit">${t ? 'Editar trilha' : 'Nova trilha'}</h2>
      <p>Dê um nome, um prazo se houver, e escolha as obras na ordem em que quer ler.</p>
      <div class="linha2">
        <div class="campo"><label for="tr-nome">Nome</label><input id="tr-nome" placeholder="Ex.: Leituras para a qualificação" value="${esc(rascunho.nome)}"></div>
        <div class="campo"><label for="tr-prazo">Prazo <small>opcional</small></label><input id="tr-prazo" type="date" value="${esc(rascunho.prazo || '')}" min="${t ? '' : diaLocal()}"></div>
      </div>
      <div class="campo"><label for="tr-objetivo">Para quê <small>opcional</small></label><input id="tr-objetivo" placeholder="Ex.: sustentar o capítulo de método" value="${esc(rascunho.objetivo || '')}"></div>
      <h3 class="tr-sub">Obras, em ordem</h3>
      <div id="tr-itens">${itensHTML()}</div>
      <div id="tr-msg"></div>
      <div class="pe">${t ? '<button class="btn fant perigo" data-trilha-apagar>Apagar trilha</button><span class="esp"></span>' : ''}<button class="btn fant" data-acao="fechar">Cancelar</button><button class="btn prim" data-trilha-salvar>${t ? 'Salvar mudanças' : 'Criar trilha'}</button></div>
    </div>`;
    veu.classList.add('on');
    setTimeout(() => document.getElementById('tr-nome')?.focus(), 30);
  }

  const lerCamposModal = () => {
    rascunho.nome = document.getElementById('tr-nome').value.trim();
    rascunho.prazo = document.getElementById('tr-prazo').value || null;
    rascunho.objetivo = document.getElementById('tr-objetivo').value.trim();
  };
  const redesenharItens = () => {
    const caixa = document.getElementById('tr-itens');
    if (caixa) caixa.innerHTML = itensHTML();
  };

  async function salvarModal() {
    lerCamposModal();
    const msg = document.getElementById('tr-msg');
    if (!rascunho.nome) {
      msg.innerHTML = '<p class="erro-campo" role="alert">Dê um nome à trilha antes de salvar.</p>';
      document.getElementById('tr-nome').focus();
      return;
    }
    const nova = !rascunho.id;
    const item = { ...rascunho, id: rascunho.id || `trilha-${crypto.randomUUID().slice(0, 8)}`, criadoEm: rascunho.criadoEm || new Date().toISOString() };
    await dados.salvar('trilhas', item);
    registrar('ui', nova ? 'trilha.criar' : 'trilha.editar', { det: `${item.itens.length} obras${item.prazo ? ', com prazo' : ''}` });
    await carregar();
    fecharModal();
    rascunho = null;
    toast(nova ? 'Trilha criada' : 'Trilha salva');
    window.render?.();
  }

  async function apagar() {
    const t = trilhas.find((x) => x.id === rascunho?.id);
    if (!t) return;
    await dados.apagar('trilhas', t.id);
    registrar('ui', 'trilha.apagar');
    await carregar();
    fecharModal();
    rascunho = null;
    window.render?.();
    toast('Trilha apagada. As obras continuam na biblioteca.', async () => {
      await dados.salvar('trilhas', { ...t, apagado: false });
      await carregar();
      registrar('ui', 'trilha.desfazer_apagar');
      window.render?.();
    });
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-trilha-nova],[data-trilha-editar],[data-trilha-salvar],[data-trilha-apagar],[data-tr-mover],[data-tr-tirar],[data-tr-adicionar]');
    if (!b) return;
    if (b.dataset.trilhaNova !== undefined) return abrirModal();
    if (b.dataset.trilhaEditar) return abrirModal(trilhas.find((x) => x.id === b.dataset.trilhaEditar));
    if (b.dataset.trilhaSalvar !== undefined) return salvarModal();
    if (b.dataset.trilhaApagar !== undefined) return apagar();
    if (!rascunho) return;
    if (b.dataset.trMover !== undefined) {
      const i = Number(b.dataset.trMover);
      const j = i + Number(b.dataset.dir);
      if (j < 0 || j >= rascunho.itens.length) return;
      [rascunho.itens[i], rascunho.itens[j]] = [rascunho.itens[j], rascunho.itens[i]];
      redesenharItens();
      // O foco segue a obra que andou, para dar para subir várias posições seguidas pelo teclado.
      (document.querySelector(`[data-tr-mover="${j}"][data-dir="${b.dataset.dir}"]:not([disabled])`) || document.querySelector(`[data-tr-mover="${j}"]:not([disabled])`))?.focus();
    }
    if (b.dataset.trTirar !== undefined) {
      rascunho.itens.splice(Number(b.dataset.trTirar), 1);
      redesenharItens();
    }
    if (b.dataset.trAdicionar !== undefined) {
      const id = document.getElementById('tr-add')?.value;
      if (!id) return;
      rascunho.itens.push(id);
      redesenharItens();
      document.getElementById('tr-add')?.focus();
    }
  });

  return { carregar, tela, todas: () => trilhas };
}
