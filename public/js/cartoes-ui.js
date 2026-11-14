// Tela dos cartões: sessão de revisão (um cartão por vez, intervalos que crescem), fim de sessão,
// lista para editar e apagar, e criação com conferência antes de guardar.
import { TIPOS_CARTAO, proximo, rotuloIntervalo } from './cartoes.js';
import { ErroIA } from './gemini.js';
import { citacao } from './abnt.js';
import { ouvir } from './ui.js';

/* global I, toast */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icone = (n) => (typeof I !== 'undefined' && I[n]) || '';
const ERROS_DE_CONFIG = ['sem-acesso', 'permissao', 'projeto', 'trancado', 'chave', 'api', 'negado', 'sessao'];
const NOTAS = ['De novo', 'Difícil', 'Bom', 'Fácil'];
const cor = (t) => (t === 'aula' ? 'c-metodo' : `c-${t}`);

export function criarCartoesUI({ cart, bib, disc, registrar }) {
  const est = { sessao: null, virado: false, ver: 'revisar', propostas: null, fonte: null, editando: null };
  const redesenhar = () => /^#cartoes/.test(location.hash) && window.render?.();
  const veu = () => document.getElementById('veu');
  const abrirModal = (html) => {
    veu().innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-tit">${html}</div>`;
    veu().classList.add('on');
    veu().querySelector('select, textarea, input:not([type=checkbox])')?.focus();
  };
  const fechar = () => veu().classList.remove('on');

  function iniciarSessao() {
    est.sessao = { fila: cart.paraHoje().map((c) => c.id), feitos: 0, deCara: 0, total: 0, errados: new Set() };
    est.sessao.total = est.sessao.fila.length;
    est.virado = false;
  }

  function tela() {
    const todos = cart.todos();
    const topo = (sub) => `<a class="voltar" href="#painel">${icone('voltar')}Hoje</a><div class="topo"><div><h1>Cartões</h1><p>${sub}</p></div>
      <div class="acoes"><button class="btn ${todos.length ? '' : 'prim'}" data-cart-criar>${icone('mais')}Criar cartões</button>${todos.length ? `<button class="btn fant" data-cart-ver="${est.ver === 'lista' ? 'revisar' : 'lista'}">${est.ver === 'lista' ? 'Revisar' : `Todos os cartões (${todos.length})`}</button>` : ''}</div></div>`;
    if (!todos.length) return `${topo('Perguntas a partir dos seus grifos e das suas aulas, revistas em intervalos que crescem a cada acerto.')}<div class="bib-vazia"><h2>Nenhum cartão ainda</h2><p>Escolha uma obra que você grifou ou uma aula transcrita. A IA propõe perguntas que pedem explicação, não decoreba, e você confere cada uma antes de guardar.</p><button class="btn prim" data-cart-criar>Criar os primeiros cartões</button></div>`;
    if (est.ver === 'lista') return `${topo('Edite a pergunta ou a resposta, ou apague o que não serve.')}${listaHTML(todos)}`;
    if (!est.sessao || (!est.sessao.fila.length && !est.sessao.feitos)) iniciarSessao();
    const s = est.sessao;
    const k = cart.contagem();
    if (!s.fila.length) {
      const prox = todos.filter((c) => c.estado?.proxima).sort((a, b) => a.estado.proxima.localeCompare(b.estado.proxima))[0];
      return `${topo('Os intervalos crescem a cada acerto.')}<section class="fim-sessao"><h2>${s.feitos ? 'Sessão concluída' : 'Nada para revisar agora'}</h2>
        <p>${s.feitos ? 'Os que você marcou "De novo" voltam em 10 minutos; os outros, em intervalos maiores.' : 'Todos os cartões estão em dia.'}${prox ? ` O próximo volta ${new Date(prox.estado.proxima) - Date.now() < 86400000 ? 'ainda hoje' : `em ${new Date(prox.estado.proxima).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}.` : ''}</p>
        ${s.feitos ? `<div class="num"><div><b>${s.feitos}</b>${s.feitos === 1 ? 'cartão revisado' : 'cartões revisados'}</div><div><b>${s.deCara}</b>lembrados de primeira</div><div><b>${k.aprendidos}</b>aprendidos</div></div>` : ''}
        <div class="flex gap-3 wrap"><a class="btn prim" href="#painel">Voltar para Hoje</a><button class="btn" data-cart-criar>Criar mais cartões</button></div></section>`;
    }
    const c = cart.obter(s.fila[0]);
    if (!c) {
      s.fila.shift();
      return tela();
    }
    const opcoes = [0, 1, 2, 3].map((n) => proximo(c.estado, n));
    return `${topo(s.errados.has(c.id) ? 'Este cartão voltou. Tente lembrar de novo antes de virar.' : `Cartão ${Math.min(s.feitos + 1, s.total)} de ${Math.max(s.total, s.feitos + s.fila.length)}. Diga a resposta em voz alta antes de virar.`)}
      <div class="rev-wrap"><div>
        <div class="cartao-rev ${est.virado ? 'virado' : ''}" id="cartao"><div class="face-wrap">
          <div class="face" aria-hidden="${est.virado}"><div class="tipo"><span class="sw ${cor(c.tipo)}"></span>${TIPOS_CARTAO[c.tipo] || 'Cartão'}</div><div class="q">${esc(c.pergunta)}</div><div class="origem">${esc(c.origem?.citacao || '')}</div></div>
          <div class="face verso" aria-hidden="${!est.virado}"><div class="tipo"><span class="sw ${cor(c.tipo)}"></span>Resposta</div><div class="r">${esc(c.resposta)}</div><div class="origem">${esc(c.origem?.citacao || '')}</div></div>
        </div></div>
        ${est.virado ? '' : '<div class="mt-5 flex j-centro"><button class="btn prim" data-cart-virar>Mostrar resposta</button></div>'}
        <div class="notas-rev" ${est.virado ? '' : 'hidden'}>${NOTAS.map((n, i) => `<button data-cart-nota="${i}">${n}<small>${rotuloIntervalo(opcoes[i])}</small></button>`).join('')}</div>
      </div>
      <aside class="painel-lat"><h4>Hoje</h4><div class="dist">${[['Novos', k.novos], ['Revisão', k.revisao], ['Aprendidos', k.aprendidos]].map(([n, v]) => `<div style="grid-template-columns:90px 1fr 26px"><span>${n}</span><span class="trilho"><i style="background:var(--petroleo);width:${(v / Math.max(1, k.total)) * 100}%"></i></span><span class="mute-2">${v}</span></div>`).join('')}</div>
        <p class="t-meta m-0 mt-4 mute">Lembrar antes de ver a resposta é o que fixa. Errar faz parte: o cartão volta logo.</p>
        ${c.origem?.tipo === 'grifo' ? `<a class="mt-3 btn fant" href="#leitor/${encodeURIComponent(c.origem.leituraId)}">Abrir a obra</a>` : c.origem?.tipo === 'aula' ? `<a class="mt-3 btn fant" href="#aula/${encodeURIComponent(c.origem.disciplinaId)}/${encodeURIComponent(c.origem.id)}">Abrir a aula</a>` : ''}
        <button class="mt-2 btn fant" data-cart-editar="${esc(c.id)}">Editar este cartão</button></aside></div>`;
  }

  function listaHTML(todos) {
    return `<div class="cart-lista">${todos
      .map((c) => `<article class="cart-it"><div><span class="tipo"><span class="sw ${cor(c.tipo)}"></span>${TIPOS_CARTAO[c.tipo] || 'Cartão'}</span><b>${esc(c.pergunta)}</b><p>${esc(c.resposta)}</p><small>${esc(c.origem?.citacao || '')}. ${c.estado?.proxima ? `Volta ${new Date(c.estado.proxima).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : 'Novo'}</small></div>
        <div class="bts"><button class="btn fant" data-cart-editar="${esc(c.id)}">Editar</button><button class="btn fant perigo" data-cart-apagar="${esc(c.id)}">Apagar</button></div></article>`)
      .join('')}</div>`;
  }

  function modalCriar(fonte = null) {
    const obras = bib.leituras().filter((l) => bib.todosGrifos().some((g) => g.leituraId === l.id));
    const aulas = disc.todas().flatMap((d) => disc.aulasDe(d.id).filter((a) => a.resumo || a.grifos?.length).map((a) => ({ a, d })));
    if (!obras.length && !aulas.length) {
      return abrirModal(`<h2 id="modal-tit">Criar cartões</h2><p>Os cartões nascem dos seus grifos ou de uma aula transcrita. Grife uma obra no leitor ou envie a gravação de uma aula e volte aqui.</p><div class="pe"><button class="btn prim" data-cart-fechar>Fechar</button></div>`);
    }
    const sel = fonte ? `${fonte.tipo}:${fonte.id}` : '';
    abrirModal(`<h2 id="modal-tit">Criar cartões</h2><p>A IA propõe perguntas a partir da fonte; você confere antes de guardar.</p>
      <form id="cart-form"><div class="campo"><label for="cart-fonte">De onde</label><select id="cart-fonte">
        ${obras.length ? `<optgroup label="Obras grifadas">${obras.map((l) => `<option value="obra:${esc(l.id)}" ${sel === `obra:${l.id}` ? 'selected' : ''}>${esc(citacao(l))} ${esc(l.titulo)}</option>`).join('')}</optgroup>` : ''}
        ${aulas.length ? `<optgroup label="Aulas">${aulas.map(({ a, d }) => `<option value="aula:${esc(a.id)}" ${sel === `aula:${a.id}` ? 'selected' : ''}>${esc(d.nome)}, aula ${a.numero}${a.tema ? `: ${esc(a.tema)}` : ''}</option>`).join('')}</optgroup>` : ''}
      </select></div>
      <div class="larg-200 campo"><label for="cart-qtd">Quantos, no máximo</label><select id="cart-qtd">${[3, 5, 8, 10].map((n) => `<option ${n === 5 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="pe"><button type="button" class="btn fant" data-cart-fechar>Cancelar</button><button class="btn prim" type="submit" data-ocupado="Propondo cartões…">Propor cartões</button></div></form>`);
  }

  function modalPropostas() {
    const ps = est.propostas;
    abrirModal(`<h2 id="modal-tit">Conferir os cartões</h2><p>${ps.propostas.length ? 'Desmarque o que não serve. Dá para editar depois.' : 'A IA não conseguiu cartões bons com esta fonte.'}${ps.recusadas ? ` ${ps.recusadas} ${ps.recusadas === 1 ? 'proposta foi recusada' : 'propostas foram recusadas'} na conferência (origem inexistente ou pergunta repetida).` : ''}</p>
      <div class="plano-rev">${ps.propostas.map((c, i) => `<label class="pl-it"><input type="checkbox" data-cart-prop="${i}" checked><span><b>${esc(c.pergunta)}</b><small>${esc(c.resposta)}</small><small>${esc(c.origem.citacao)}</small></span></label>`).join('')}</div>
      <div class="pe"><button type="button" class="btn fant" data-cart-fechar>Descartar</button>${ps.propostas.length ? '<button class="btn prim" data-cart-guardar>Guardar os marcados</button>' : ''}</div>`);
  }

  function modalEditar(c) {
    abrirModal(`<h2 id="modal-tit">Editar cartão</h2><form id="cart-edit" data-id="${esc(c.id)}"><div class="campo"><label for="ce-p">Pergunta</label><textarea id="ce-p" required style="min-height:80px">${esc(c.pergunta)}</textarea></div><div class="campo"><label for="ce-r">Resposta</label><textarea id="ce-r" required style="min-height:110px">${esc(c.resposta)}</textarea></div>
      <div class="pe"><button type="button" class="btn fant" data-cart-fechar>Cancelar</button><button class="btn prim" type="submit">Salvar</button></div></form>`);
  }

  ouvir('submit', async (e) => {
    const f = e.target;
    if (f.id === 'cart-form') {
      e.preventDefault();
      const [tipo, id] = document.getElementById('cart-fonte').value.split(':');
      const qtd = Number(document.getElementById('cart-qtd').value);
      est.fonte = { tipo, id };
      abrirModal('<h2 id="modal-tit">Criando cartões</h2><p role="status">A IA está lendo a fonte e propondo perguntas.</p>');
      try {
        est.propostas = await cart.propor(est.fonte, qtd);
        modalPropostas();
      } catch (err) {
        const config = err instanceof ErroIA && ERROS_DE_CONFIG.includes(err.codigo);
        abrirModal(`<h2 id="modal-tit">Não deu para criar cartões</h2><div class="erro-ia" role="alert"><p>${esc(err.message)}</p></div><div class="pe">${config ? '<a class="btn" href="#ajustes">Abrir Ajustes do Gemini</a>' : ''}<button class="btn prim" data-cart-fechar>Fechar</button></div>`);
      }
      return;
    }
    if (f.id === 'cart-edit') {
      e.preventDefault();
      const c = cart.obter(f.dataset.id);
      await cart.salvar({ ...c, pergunta: document.getElementById('ce-p').value.trim(), resposta: document.getElementById('ce-r').value.trim() });
      fechar();
      redesenhar();
      toast('Cartão salvo');
    }
  });

  ouvir('click', async (e) => {
    const b = e.target.closest('[data-cart-criar],[data-cart-fechar],[data-cart-guardar],[data-cart-virar],[data-cart-nota],[data-cart-ver],[data-cart-editar],[data-cart-apagar],[data-cart-de]');
    if (!b) return;
    const d = b.dataset;
    if (d.cartCriar !== undefined) return modalCriar();
    if (d.cartDe) {
      const [tipo, id] = d.cartDe.split(':');
      return modalCriar({ tipo, id });
    }
    if (d.cartFechar !== undefined) return fechar();
    if (d.cartGuardar !== undefined) {
      const marcados = [...document.querySelectorAll('[data-cart-prop]:checked')].map((x) => est.propostas.propostas[Number(x.dataset.cartProp)]);
      await cart.guardar(marcados);
      est.propostas = null;
      est.sessao = null;
      fechar();
      if (/^#cartoes/.test(location.hash)) redesenhar();
      return toast(`${marcados.length} ${marcados.length === 1 ? 'cartão guardado' : 'cartões guardados'}. Eles entram na revisão de hoje.`);
    }
    if (d.cartVirar !== undefined) {
      est.virado = true;
      redesenhar();
      document.querySelector('[data-cart-nota="2"]')?.focus();
      return;
    }
    if (d.cartNota !== undefined) {
      const s = est.sessao;
      const id = s.fila.shift();
      const nota = Number(d.cartNota);
      await cart.avaliar(id, nota);
      if (!s.errados.has(id)) s.feitos++;
      if (nota >= 2 && !s.errados.has(id)) s.deCara++;
      // "De novo" volta para o fim da fila desta sessão.
      if (nota === 0) {
        s.errados.add(id);
        s.fila.push(id);
      }
      est.virado = false;
      return redesenhar();
    }
    if (d.cartVer) {
      est.ver = d.cartVer;
      return redesenhar();
    }
    if (d.cartEditar) return modalEditar(cart.obter(d.cartEditar));
    if (d.cartApagar) {
      const desfazer = await cart.apagar(d.cartApagar);
      redesenhar();
      return toast('Cartão apagado', async () => {
        await desfazer();
        redesenhar();
      });
    }
  });
  document.addEventListener('keydown', (e) => {
    if (!/^#cartoes/.test(location.hash) || document.getElementById('veu')?.classList.contains('on') || e.target.matches?.('input, textarea, select')) return;
    if (e.key === ' ' && !est.virado && document.querySelector('[data-cart-virar]')) {
      e.preventDefault();
      document.querySelector('[data-cart-virar]').click();
    } else if (est.virado && ['1', '2', '3', '4'].includes(e.key)) document.querySelector(`[data-cart-nota="${Number(e.key) - 1}"]`)?.click();
  });

  return { tela, pendentes: () => cart.paraHoje().length };
}
