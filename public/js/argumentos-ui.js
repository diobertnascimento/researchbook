// Argumentos reais: as teses que o Diobert sustenta, com os trechos que ele escreveu nos fichamentos.
// Coleção "argumentos": { id, tese, tipo, secao }. Os trechos NÃO são copiados para cá: vêm dos fichamentos
// (passo "Para a dissertação"), ligados pelo argumentoId ou pelo texto da tese. Uma fonte de verdade só.
//
// A sustentação é uma contagem honesta (quantas obras diferentes têm trechos ligados), não um juízo de qualidade.
import { autorCurto } from './abnt.js';

/* global I, toast, fecharModal */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icone = (n) => (typeof I !== 'undefined' && I[n]) || '';
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const slug = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

export const TIPOS_ARG = [
  ['tese', 'Tese', 'O que a dissertação afirma'],
  ['premissa', 'Premissa', 'Algo em que a tese se apoia'],
  ['objecao', 'Objeção a responder', 'O que a banca pode contestar'],
];
const nomeTipo = (t) => (TIPOS_ARG.find(([k]) => k === t) || TIPOS_ARG[1])[1];

export function criarArgumentosUI({ bib, dados, fichUI, registrar }) {
  let argumentos = [];
  let editando = null;

  // Troca de tela sem o evento hashchange, que fecharia o aviso com "Desfazer" logo depois de aparecer.
  const irPara = (hash) => {
    if (location.hash !== hash) history.pushState(null, '', hash);
    window.render?.();
    scrollTo({ top: 0 });
  };

  async function carregar() {
    argumentos = await dados.listar('argumentos');
  }

  /** Trechos ligados a um argumento, vindos dos fichamentos. */
  function trechosDe(a) {
    const saida = [];
    for (const f of fichUI.todos()) {
      for (const t of f.trechos || []) {
        if (!t.texto?.trim()) continue;
        if (t.argumentoId === a.id || (!t.argumentoId && norm(t.argumento) === norm(a.tese))) saida.push({ ...t, leituraId: f.id });
      }
    }
    return saida;
  }
  const fontesDe = (a) => [...new Set(trechosDe(a).map((t) => t.leituraId))].map((id) => bib.obter(id)).filter(Boolean);

  function lista() {
    return argumentos
      .map((a) => ({ a, n: fontesDe(a).length }))
      .sort((x, y) => y.n - x.n || (y.a.atualizadoEm || '').localeCompare(x.a.atualizadoEm || ''))
      .map((x) => x.a);
  }

  const forcaHTML = (n) => {
    const nivel = Math.min(n, 3);
    const rot = n === 0 ? 'Sem fontes' : n === 1 ? '1 fonte' : n === 2 ? '2 fontes' : `${n} fontes`;
    return `<span class="forca" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= nivel ? 'on' : ''}"></i>`).join('')}</span> ${rot}`;
  };

  function lembrete(n) {
    if (n === 0) return 'Ainda sem fonte. Ligue trechos a este argumento no passo “Para a dissertação” de um fichamento.';
    if (n === 1) return 'Depende de uma única obra. Antes de apresentar como consenso, procure uma segunda fonte ou trate como proposição sua.';
    return '';
  }

  function tela(idSel) {
    const todos = lista();
    const topo = `<div class="topo"><div><h1>Argumentos</h1><p>As teses que você sustenta, com os trechos que escreveu nos fichamentos e as obras de cada uma.</p></div>
      <div class="acoes"><button class="btn prim" data-arg-novo>${icone('mais')}Novo argumento</button></div></div>`;
    if (!todos.length) {
      return `${topo}<div class="bib-vazia"><h2>Nenhum argumento ainda</h2><p>Argumentos nascem de dois jeitos: no passo “Para a dissertação” de um fichamento, quando você liga um trecho a uma tese, ou aqui, escrevendo a tese primeiro.</p><button class="btn prim" data-arg-novo>${icone('mais')}Escrever um argumento</button></div>`;
    }
    const escolhido = idSel ? todos.find((x) => x.id === idSel) : null;
    const a = escolhido || todos[0];
    const trechos = trechosDe(a);
    const fontes = fontesDe(a);
    const aviso = lembrete(fontes.length);
    return `${topo}
    <div class="arg-grid ${escolhido ? 'com-sel' : ''}">
      <div class="arg-lista" role="list">
        ${todos
          .map((x) => {
            const n = fontesDe(x).length;
            return `<a role="listitem" class="arg-item ${x.id === a.id ? 'on' : ''}" href="#argumentos/${encodeURIComponent(x.id)}"><span class="t">${esc(x.tese)}</span><span class="m"><span>${nomeTipo(x.tipo)}</span>${forcaHTML(n)}</span></a>`;
          })
          .join('')}
      </div>
      <article class="arg-det" aria-label="Argumento escolhido">
        <a class="voltar-arg" href="#argumentos">Todos os argumentos</a>
        <div class="arg-cab"><span class="chip">${nomeTipo(a.tipo)}</span><button class="btn fant" data-arg-editar="${esc(a.id)}">Editar</button></div>
        <div class="tese">${esc(a.tese)}</div>
        <div class="meta">${a.secao ? `<span class="chip proj">Entra em: ${esc(a.secao)}</span>` : ''}<span class="chip proj">${forcaHTML(fontes.length)}</span></div>
        ${aviso ? `<div class="lembrete" role="note"><b>Lembrete</b><p>${aviso}</p></div>` : ''}
        <h3>Trechos para o texto</h3>
        ${
          trechos.length
            ? trechos
                .map((t) => {
                  const l = bib.obter(t.leituraId);
                  return `<div class="trecho-d"><div><p>${esc(t.texto)}</p><small>Escrito por você no fichamento de ${l ? esc(autorCurto(l)) : 'uma obra'}. <a href="#fichamento/${encodeURIComponent(t.leituraId)}">Abrir o fichamento</a></small></div><button class="btn fant" data-arg-copiar="${esc(t.leituraId)}|${esc(t.id)}">${icone('copiar')}Copiar</button></div>`;
                })
                .join('')
            : '<p class="mute">Nenhum trecho ligado ainda.</p>'
        }
        <h3>Obras</h3>
        ${fontes.length ? `<div class="fontes">${fontes.map((l) => `<a href="#leitor/${encodeURIComponent(l.id)}"><span>${esc(autorCurto(l))}. ${esc(l.titulo)}</span></a>`).join('')}</div>` : '<p class="mute">Nenhuma obra ligada ainda.</p>'}
        <details class="como"><summary>Como a sustentação é contada?</summary><p>É o número de obras diferentes da sua biblioteca com trechos ligados a este argumento. Mede quantas fontes você já tem, não a qualidade delas.</p></details>
      </article>
    </div>`;
  }

  /* ---------- Novo e editar ---------- */
  function abrirModal(a = null) {
    editando = a;
    const veu = document.getElementById('veu');
    veu.innerHTML = `<div class="modal" role="dialog" aria-labelledby="modal-tit"><h2 id="modal-tit">${a ? 'Editar argumento' : 'Novo argumento'}</h2>
      <p>Escreva a tese numa frase, com as suas palavras. Os trechos e as obras entram pelos fichamentos.</p>
      <div class="campo"><label for="arg-tese">Tese</label><textarea id="arg-tese" rows="3">${esc(a?.tese || '')}</textarea></div>
      <div class="linha2">
        <div class="campo"><label for="arg-tipo">Tipo</label><select id="arg-tipo">${TIPOS_ARG.map(([k, n, d]) => `<option value="${k}" ${(a?.tipo || 'premissa') === k ? 'selected' : ''}>${n}: ${d.toLowerCase()}</option>`).join('')}</select></div>
        <div class="campo"><label for="arg-secao">Onde entra no texto <small>opcional</small></label><input id="arg-secao" placeholder="Ex.: capítulo 2, método" value="${esc(a?.secao || '')}"></div>
      </div>
      <div id="arg-msg"></div>
      <div class="pe">${a ? '<button class="btn fant perigo" data-arg-apagar>Apagar argumento</button><span class="esp"></span>' : ''}<button class="btn fant" data-acao="fechar">Cancelar</button><button class="btn prim" data-arg-salvar>${a ? 'Salvar mudanças' : 'Criar argumento'}</button></div>
    </div>`;
    veu.classList.add('on');
    setTimeout(() => document.getElementById('arg-tese')?.focus(), 30);
  }

  async function salvarModal() {
    const tese = document.getElementById('arg-tese').value.trim().replace(/\s+/g, ' ');
    const msg = document.getElementById('arg-msg');
    if (!tese) {
      msg.innerHTML = '<p class="erro-campo" role="alert">Escreva a tese antes de salvar.</p>';
      return;
    }
    const repetido = argumentos.find((x) => norm(x.tese) === norm(tese) && x.id !== editando?.id);
    if (repetido) {
      msg.innerHTML = `<p class="erro-campo" role="alert">Você já tem um argumento com esta tese. <a href="#argumentos/${encodeURIComponent(repetido.id)}">Abrir o existente</a></p>`;
      return;
    }
    const tipo = document.getElementById('arg-tipo').value;
    const secao = document.getElementById('arg-secao').value.trim() || null;
    let a;
    if (editando) {
      const antiga = editando.tese;
      a = await dados.salvar('argumentos', { ...editando, tese, tipo, secao });
      // A tese mudou: os trechos ligados guardam o texto novo, para o fichamento mostrar o mesmo nome.
      if (antiga !== tese) {
        for (const f of fichUI.todos()) {
          if (!(f.trechos || []).some((t) => t.argumentoId === a.id || (!t.argumentoId && norm(t.argumento) === norm(antiga)))) continue;
          const trechos = f.trechos.map((t) => (t.argumentoId === a.id || (!t.argumentoId && norm(t.argumento) === norm(antiga)) ? { ...t, argumento: tese, argumentoId: a.id } : t));
          await dados.salvar('fichamentos', { ...f, trechos });
        }
      }
      registrar('ui', 'argumento.editar', { det: tipo });
    } else {
      a = await dados.salvar('argumentos', { id: `arg-${slug(tese)}-${crypto.randomUUID().slice(0, 4)}`, tese, tipo, secao, criadoEm: new Date().toISOString() });
      registrar('ui', 'argumento.criar', { det: tipo });
    }
    await carregar();
    await fichUI.carregar();
    fecharModal();
    irPara(`#argumentos/${encodeURIComponent(a.id)}`);
    toast(editando ? 'Argumento salvo' : 'Argumento criado');
    editando = null;
  }

  async function apagar() {
    const a = editando;
    if (!a) return;
    await dados.apagar('argumentos', a.id);
    registrar('ui', 'argumento.apagar');
    await carregar();
    await fichUI.carregar();
    fecharModal();
    editando = null;
    irPara('#argumentos');
    toast('Argumento apagado. Os trechos continuam nos fichamentos.', async () => {
      await dados.salvar('argumentos', { ...a, apagado: false });
      await carregar();
      await fichUI.carregar();
      registrar('ui', 'argumento.desfazer_apagar');
      irPara(`#argumentos/${encodeURIComponent(a.id)}`);
    });
  }

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-arg-novo],[data-arg-editar],[data-arg-salvar],[data-arg-apagar],[data-arg-copiar]');
    if (!t) return;
    if (t.dataset.argNovo !== undefined) abrirModal();
    if (t.dataset.argEditar) abrirModal(argumentos.find((x) => x.id === t.dataset.argEditar));
    if (t.dataset.argSalvar !== undefined) await salvarModal();
    if (t.dataset.argApagar !== undefined) await apagar();
    if (t.dataset.argCopiar) {
      const [leituraId, trechoId] = t.dataset.argCopiar.split('|');
      const tr = fichUI.doLivro(leituraId)?.trechos?.find((x) => x.id === trechoId);
      if (!tr) return;
      try {
        await navigator.clipboard.writeText(tr.texto);
        toast('Trecho copiado');
      } catch {
        toast('Não deu para copiar. Selecione o texto e copie à mão.');
      }
      registrar('ui', 'argumento.copiar_trecho');
    }
  });

  return { carregar, tela, lista, fontesDe, trechosDe, todos: () => argumentos };
}
