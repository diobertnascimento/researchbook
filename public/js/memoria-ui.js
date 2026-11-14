// Memória: a IA propõe, o Diobert decide. Só itens aprovados entram nos pedidos à IA.
//
// Coleção "memoria" (sincroniza): { id, tipo, texto, status: proposta | aprovada | descartada | substituida,
//   evidencia (as palavras dele, conferidas), origem: { conversaId, mensagem, funcao, titulo }, atualiza, ... }.
// Descartados ficam guardados para a IA não propor a mesma coisa de novo.
//
// Quando a IA procura: ao abrir o app, nas conversas paradas há mais de 10 minutos com mensagens novas;
// ao começar uma "Nova conversa"; e quando ele toca em "Procurar nas conversas".
import { TIPOS_MEMORIA } from './ia.js';
import { ErroIA } from './gemini.js';
import { referenciaTexto } from './abnt.js';

/* global toast, baixar */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const PARADA_MS = 10 * 60 * 1000;
const POR_RODADA = 3;
const nomeTipo = (t, plural = false) => (TIPOS_MEMORIA.find(([k]) => k === t) || [t, t, t])[plural ? 2 : 1];
const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '');

export function criarMemoriaUI({ ia, historico, dados, bib, fichUI, argUI, drive, registrar }) {
  let itens = [];
  let procurando = false;
  let aviso = null;
  let editando = null;
  let exportar = { formato: 'md', perfil: true, memoria: true, argumentos: true, fichamentos: false, conversas: false };

  async function carregar() {
    itens = await dados.listar('memoria');
  }
  const pendentes = () => itens.filter((m) => m.status === 'proposta');
  const aprovados = () => itens.filter((m) => m.status === 'aprovada');
  const redesenhar = () => /^#memoria/.test(location.hash) && window.render?.();

  /* ---------- Propostas ---------- */
  async function proporDe(conversa) {
    const mensagens = await historico.mensagens(conversa.id);
    const desde = conversa.memoriaAte || 0;
    const novasDoAutor = mensagens.slice(desde).filter((m) => m.de === 'autor' && m.pedido?.tipo === 'pergunta').length;
    if (!novasDoAutor) {
      await historico.marcar(conversa.id, { memoriaAte: mensagens.length });
      return 0;
    }
    const r = await ia.proporMemoria({ conversa, mensagens, desde, memoria: itens });
    const agora = new Date().toISOString();
    for (const p of r.aceitas) {
      await dados.salvar('memoria', {
        id: `mem-${crypto.randomUUID().slice(0, 10)}`,
        ...p,
        status: 'proposta',
        origem: { conversaId: conversa.id, mensagem: p.mensagem, funcao: conversa.funcao, titulo: conversa.titulo || '' },
        criadoEm: agora,
      });
    }
    // A saída da IA também fica no histórico (conversa da função "memoria").
    const reg = await historico.nova({ funcao: 'memoria', alvo: { tipo: 'conversa', id: conversa.id }, titulo: `Memória: ${conversa.titulo || ''}` });
    await historico.acrescentar(reg.id, { de: 'ia', resposta: r.bruto, aceitas: r.aceitas.length, recusadas: r.recusadas, modelo: r.modelo, uso: r.uso, custo: r.custo, instrucao: r.instrucao, desde });
    await historico.encerrar(reg.id);
    await historico.marcar(conversa.id, { memoriaAte: mensagens.length });
    return r.aceitas.length;
  }

  /** Procura propostas nas conversas com mensagens novas. "todas": inclui conversas ainda em andamento. */
  async function procurar({ todas = false } = {}) {
    if (procurando || !ia.ajustes.modo()) return { novas: 0, lidas: 0 };
    const agora = Date.now();
    const fila = historico
      .todas()
      .filter((c) => c.funcao === 'tutor' && (c.n || 0) > (c.memoriaAte || 0) && (todas || agora - new Date(c.ultimaEm || 0).getTime() > PARADA_MS))
      .sort((a, b) => (b.ultimaEm || '').localeCompare(a.ultimaEm || ''))
      .slice(0, POR_RODADA);
    if (!fila.length) return { novas: 0, lidas: 0 };
    procurando = true;
    let novas = 0;
    try {
      for (const c of fila) novas += await proporDe(c);
    } finally {
      procurando = false;
      await carregar();
    }
    registrar('ia', 'memoria.procurar', { det: `${fila.length} conversas, ${novas} propostas` });
    return { novas, lidas: fila.length };
  }

  /** Em segundo plano: erros de acesso não interrompem nada; ficam no registro. */
  async function procurarEmSegundoPlano(opcoes) {
    try {
      const r = await procurar(opcoes);
      if (r.novas) redesenhar();
    } catch (e) {
      registrar('ia', 'memoria.procurar_falhou', { det: e instanceof ErroIA ? e.codigo : e.message, st: 'aviso' });
    }
  }

  /* ---------- Decisões do Diobert ---------- */
  async function mudar(id, mudancas) {
    const m = itens.find((x) => x.id === id);
    if (!m) return null;
    const novo = await dados.salvar('memoria', { ...m, ...mudancas });
    await carregar();
    return { antes: m, depois: novo };
  }

  async function aprovar(id, texto) {
    const m = itens.find((x) => x.id === id);
    if (!m) return;
    const r = await mudar(id, { status: 'aprovada', texto: texto ?? m.texto, aprovadoEm: new Date().toISOString() });
    let substituido = null;
    if (m.atualiza) substituido = (await mudar(m.atualiza, { status: 'substituida', substituidoPor: id }))?.antes || null;
    registrar('ui', 'memoria.aprovar', { det: `${m.tipo}${texto != null && texto !== m.texto ? ', editada' : ''}${substituido ? ', substitui outra' : ''}` });
    redesenhar();
    toast('Guardado na memória', async () => {
      await dados.salvar('memoria', r.antes);
      if (substituido) await dados.salvar('memoria', substituido);
      await carregar();
      redesenhar();
    });
  }

  async function descartar(id) {
    const r = await mudar(id, { status: 'descartada' });
    registrar('ui', 'memoria.descartar', { det: r?.antes.tipo });
    redesenhar();
    toast('Proposta descartada. A IA não vai propor isso de novo.', async () => {
      await dados.salvar('memoria', r.antes);
      await carregar();
      redesenhar();
    });
  }

  async function esquecer(id) {
    const m = itens.find((x) => x.id === id);
    if (!m) return;
    await dados.apagar('memoria', id);
    await carregar();
    registrar('ui', 'memoria.esquecer', { det: m.tipo });
    redesenhar();
    toast('Esquecido. Não entra mais nos pedidos à IA.', async () => {
      await dados.salvar('memoria', { ...m, apagado: false });
      await carregar();
      redesenhar();
    });
  }

  async function adicionar(tipo, texto) {
    const t = String(texto || '').trim();
    if (!t) return false;
    await dados.salvar('memoria', { id: `mem-${crypto.randomUUID().slice(0, 10)}`, tipo, texto: t, status: 'aprovada', origem: { funcao: 'manual' }, criadoEm: new Date().toISOString(), aprovadoEm: new Date().toISOString() });
    await carregar();
    registrar('ui', 'memoria.adicionar', { det: tipo });
    return true;
  }

  /* ---------- Exportar para outras IAs ---------- */
  async function montarExportacao(op = exportar) {
    const hoje = new Date();
    const perfil = op.perfil ? await ia.perfil() : '';
    const mem = op.memoria ? aprovados() : [];
    const args = op.argumentos ? argUI.lista().map((a) => ({ tese: a.tese, tipo: a.tipo || null, obras: argUI.fontesDe(a).map((l) => referenciaTexto(l)) })) : [];
    const fichs = op.fichamentos
      ? fichUI
          .todos()
          .filter((f) => f.resumo || Object.values(f.analise || {}).some(Boolean))
          .map((f) => ({ obra: bib.obter(f.id) ? referenciaTexto(bib.obter(f.id)) : f.id, resumo: f.resumo || '', analise: f.analise || {} }))
      : [];
    let conversas = [];
    if (op.conversas) {
      const limite = Date.now() - 30 * 86400000;
      for (const c of historico.todas().filter((x) => x.funcao === 'tutor' && new Date(x.ultimaEm || 0).getTime() > limite)) {
        const ms = await historico.mensagens(c.id);
        conversas.push({
          titulo: c.titulo,
          data: c.ultimaEm,
          mensagens: ms.map((m) => (m.de === 'autor' ? { de: 'eu', texto: m.pedido?.tipo === 'pergunta' ? m.pedido.texto : m.pedido?.mostrado, trecho: m.pedido?.trecho?.texto || null } : { de: 'tutor', texto: [m.resposta?.resposta, m.resposta?.pergunta].filter(Boolean).join(' ') })),
        });
      }
    }
    const regras = [
      'Não escreva do zero: proponha versões do que eu escrevi ou disse.',
      'Cite só fontes que eu fornecer, com página, no formato da ABNT NBR 10520:2023; referências pela NBR 6023:2018.',
      'Seja direto, sem elogio vazio. Discorde com argumento; mude de posição só diante de argumento novo.',
    ];
    if (op.formato === 'json') {
      return { nome: `researchbook-contexto-${hoje.toISOString().slice(0, 10)}.json`, tipo: 'application/json', conteudo: JSON.stringify({ app: 'researchbook', exportadoEm: hoje.toISOString(), regras, perfil, memoria: mem.map((m) => ({ tipo: m.tipo, texto: m.texto, desde: m.aprovadoEm || m.criadoEm })), argumentos: args, fichamentos: fichs, conversas }, null, 2) };
    }
    const L = [`# Contexto exportado do researchbook`, '', `Exportado em ${hoje.toLocaleDateString('pt-BR')}. Use como contexto sobre mim e a minha pesquisa de mestrado.`, '', '## Como trabalhar comigo', ...regras.map((r) => `- ${r}`)];
    const prefs = mem.filter((m) => m.tipo === 'preferencia');
    prefs.forEach((m) => L.push(`- ${m.texto}`));
    if (perfil.trim()) L.push('', '## Sobre mim', '', perfil.trim());
    for (const [k, , plural] of TIPOS_MEMORIA.filter(([k]) => k !== 'preferencia')) {
      const doTipo = mem.filter((m) => m.tipo === k);
      if (doTipo.length) L.push('', `## ${plural}`, ...doTipo.map((m) => `- ${m.texto}`));
    }
    if (args.length) L.push('', '## Argumentos da dissertação', ...args.map((a) => `- ${a.tese}${a.obras.length ? ` (${a.obras.length} ${a.obras.length === 1 ? 'obra' : 'obras'})` : ' (sem fonte ainda)'}`));
    if (fichs.length) {
      L.push('', '## Fichamentos');
      for (const f of fichs) {
        L.push('', `### ${f.obra}`);
        if (f.resumo) L.push('', f.resumo);
        for (const v of Object.values(f.analise).filter(Boolean)) L.push('', v);
      }
    }
    if (conversas.length) {
      L.push('', '## Conversas com o tutor (últimos 30 dias)');
      for (const c of conversas) {
        L.push('', `### ${c.titulo} (${dataCurta(c.data)})`);
        for (const m of c.mensagens) L.push(`- ${m.de === 'eu' ? 'Eu' : 'Tutor'}: ${m.texto || ''}${m.trecho ? ` [sobre o trecho: "${m.trecho}"]` : ''}`);
      }
    }
    return { nome: `researchbook-contexto-${hoje.toISOString().slice(0, 10)}.md`, tipo: 'text/markdown', conteudo: L.join('\n') + '\n' };
  }

  async function atualizarPrevia() {
    const el = document.getElementById('mem-prev');
    if (!el) return;
    const { conteudo } = await montarExportacao();
    const linhas = conteudo.split('\n');
    el.textContent = linhas.slice(0, 40).join('\n') + (linhas.length > 40 ? `\n… (+${linhas.length - 40} linhas)` : '');
  }

  /* ---------- Tela ---------- */
  function propostaHTML(m) {
    const subst = m.atualiza ? itens.find((x) => x.id === m.atualiza) : null;
    const origem = m.origem?.titulo ? `conversa com o tutor sobre ${m.origem.titulo}` : 'conversa com o tutor';
    if (editando === m.id) {
      return `<div class="sug-it"><div><textarea id="mem-ed" rows="3" aria-label="Texto do item">${esc(m.texto)}</textarea></div><div class="bts"><button class="btn prim" data-mem-aprovar="${esc(m.id)}" data-editado>Guardar</button><button class="btn" data-mem-cancelar>Cancelar</button></div></div>`;
    }
    return `<div class="sug-it"><div>${esc(m.texto)}<small>${nomeTipo(m.tipo)}, de uma ${esc(origem)}, ${dataCurta(m.criadoEm)}</small><small class="ev">Você disse: “${esc(m.evidencia)}”</small>${subst ? `<small class="subst">Substitui: ${esc(subst.texto)}</small>` : ''}</div>
      <div class="bts"><button class="btn prim" data-mem-aprovar="${esc(m.id)}">Guardar</button><button class="btn" data-mem-editar="${esc(m.id)}">Editar</button><button class="btn fant" data-mem-descartar="${esc(m.id)}">Descartar</button></div></div>`;
  }

  function itemHTML(m) {
    if (editando === m.id) {
      return `<div class="mem-it"><div><textarea id="mem-ed" rows="3" aria-label="Texto do item">${esc(m.texto)}</textarea></div><div class="bts"><button class="btn prim" data-mem-salvar="${esc(m.id)}">Salvar</button><button class="btn fant" data-mem-cancelar>Cancelar</button></div></div>`;
    }
    const origem = m.origem?.funcao === 'manual' ? 'escrito por você' : m.origem?.titulo ? `conversa sobre ${m.origem.titulo}` : 'conversa';
    return `<div class="mem-it"><div>${esc(m.texto)}<small>Origem: ${esc(origem)}${m.aprovadoEm ? `, guardado em ${dataCurta(m.aprovadoEm)}` : ''}</small></div><div class="bts"><button class="btn fant" data-mem-editar="${esc(m.id)}">Editar</button><button class="btn fant" data-mem-esquecer="${esc(m.id)}">Esquecer</button></div></div>`;
  }

  function tela() {
    queueMicrotask(atualizarPrevia);
    const pend = pendentes();
    const apr = aprovados();
    const nConversas = historico.todas().filter((c) => c.funcao === 'tutor').length;
    const semIA = !ia.ajustes.modo();
    return `
    <div class="topo"><div><h1>Memória</h1><p>O que a IA sabe sobre você e a sua pesquisa. A IA propõe; só entra nos pedidos o que você guardar.</p></div></div>
    <details class="ajuda-det" style="margin-bottom:18px"><summary>Como a memória funciona?</summary><div class="camadas" style="margin-top:12px">
      <div class="camada"><span class="n">1</span><b>Conversas</b><p>Tudo o que você trocou com a IA, guardado no seu Drive (ia/conversas).</p><div class="q">${nConversas} ${nConversas === 1 ? 'conversa' : 'conversas'} com o tutor</div></div>
      <div class="camada"><span class="n">2</span><b>Memória guardada</b><p>Decisões, posições, preferências e fatos que você aprovou. Curta de propósito.</p><div class="q">${apr.length} ${apr.length === 1 ? 'item' : 'itens'}</div></div>
      <div class="camada"><span class="n">3</span><b>Contexto de cada pedido</b><p>Montado na hora: perfil, memória guardada, o material aberto e a conversa recente.</p><div class="q">Nada entra sem a sua aprovação</div></div>
    </div></details>
    <div class="mem-grid">
      <div>
        <section class="sug" aria-labelledby="mem-pend"><h3 id="mem-pend">A IA quer lembrar (${pend.length})</h3>
          ${pend.length ? pend.map(propostaHTML).join('') : `<p class="mem-vazio">Nada para revisar agora. A IA propõe itens a partir do que você diz nas conversas com o tutor; sugestões dela não entram.</p>`}
          <div class="mem-procurar">${
            semIA ? '<a class="btn" href="#ajustes">Conectar o Gemini para a IA propor itens</a>' : `<button class="btn" data-mem-procurar ${procurando ? 'disabled' : ''}>${procurando ? 'Procurando…' : 'Procurar nas conversas'}</button>`
          }${aviso ? `<span class="mem-aviso" role="status">${esc(aviso)}</span>` : ''}</div>
        </section>
        ${TIPOS_MEMORIA.map(([k, , plural], i) => {
          const doTipo = apr.filter((m) => m.tipo === k);
          return `<details class="mem-cat" ${doTipo.length || i < 2 ? 'open' : ''}><summary>${plural}<span>${doTipo.length} ${doTipo.length === 1 ? 'item' : 'itens'}</span></summary>${doTipo.length ? doTipo.map(itemHTML).join('') : '<p class="mem-vazio">Nenhum item ainda.</p>'}</details>`;
        }).join('')}
        <details class="mem-cat mem-novo"><summary>Escrever um item</summary>
          <div class="linha2"><div class="campo"><label for="mem-tipo">Tipo</label><select id="mem-tipo">${TIPOS_MEMORIA.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div></div>
          <div class="campo"><label for="mem-texto">Texto</label><textarea id="mem-texto" rows="2" placeholder="Ex.: vou avaliar o artefato pela adesão das equipes"></textarea></div>
          <button class="btn" data-mem-adicionar>Guardar na memória</button>
        </details>
      </div>
      <aside class="lado">
        <section class="bloco"><h3>Exportar para outras IAs</h3>
          <div class="opcoes" role="radiogroup" aria-label="Formato">
            <label><input type="radio" name="mem-fmt" value="md" ${exportar.formato === 'md' ? 'checked' : ''} data-mem-exp><span>Um arquivo Markdown<small>Para colar ou anexar em qualquer assistente</small></span></label>
            <label><input type="radio" name="mem-fmt" value="json" ${exportar.formato === 'json' ? 'checked' : ''} data-mem-exp><span>JSON estruturado<small>Para ferramentas e automações</small></span></label>
          </div>
          <div class="opcoes" aria-label="O que entra">
            ${[['perfil', 'Sobre você (perfil do autor)'], ['memoria', 'Memória guardada'], ['argumentos', 'Argumentos da dissertação'], ['fichamentos', 'Fichamentos (resumos e análises)'], ['conversas', 'Conversas com o tutor (30 dias)']]
              .map(([k, n]) => `<label><input type="checkbox" value="${k}" ${exportar[k] ? 'checked' : ''} data-mem-exp>${n}</label>`)
              .join('')}
          </div>
          <pre class="prev" id="mem-prev" aria-label="Prévia da exportação">Montando a prévia…</pre>
          <button class="btn prim" style="width:100%;justify-content:center" data-mem-exportar>Exportar</button>
          <p class="mem-nota">O arquivo é baixado e uma cópia fica no seu Drive, em memoria/exportar.</p>
        </section>
      </aside>
    </div>`;
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('change', (e) => {
    if (!e.target.matches?.('[data-mem-exp]')) return;
    if (e.target.name === 'mem-fmt') exportar.formato = e.target.value;
    else exportar[e.target.value] = e.target.checked;
    atualizarPrevia();
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-mem-aprovar],[data-mem-editar],[data-mem-descartar],[data-mem-esquecer],[data-mem-salvar],[data-mem-cancelar],[data-mem-procurar],[data-mem-adicionar],[data-mem-exportar]');
    if (!b) return;
    if (b.dataset.memAprovar) {
      const texto = b.dataset.editado !== undefined ? document.getElementById('mem-ed')?.value.trim() : undefined;
      editando = null;
      return aprovar(b.dataset.memAprovar, texto || undefined);
    }
    if (b.dataset.memEditar) {
      editando = b.dataset.memEditar;
      redesenhar();
      return document.getElementById('mem-ed')?.focus();
    }
    if (b.dataset.memCancelar !== undefined) {
      editando = null;
      return redesenhar();
    }
    if (b.dataset.memSalvar) {
      const texto = document.getElementById('mem-ed')?.value.trim();
      editando = null;
      if (texto) {
        await mudar(b.dataset.memSalvar, { texto });
        registrar('ui', 'memoria.editar');
        toast('Item salvo');
      }
      return redesenhar();
    }
    if (b.dataset.memDescartar) return descartar(b.dataset.memDescartar);
    if (b.dataset.memEsquecer) return esquecer(b.dataset.memEsquecer);
    if (b.dataset.memAdicionar !== undefined) {
      if (await adicionar(document.getElementById('mem-tipo').value, document.getElementById('mem-texto').value)) {
        toast('Guardado na memória');
        redesenhar();
      }
      return;
    }
    if (b.dataset.memProcurar !== undefined) {
      aviso = null;
      try {
        const p = procurar({ todas: true });
        redesenhar();
        const r = await p;
        aviso = !r.lidas ? 'Nenhuma conversa com mensagens novas.' : r.novas ? `${r.novas} ${r.novas === 1 ? 'proposta nova' : 'propostas novas'}.` : 'Nada novo para lembrar nessas conversas.';
      } catch (err) {
        aviso = err instanceof ErroIA ? err.message : 'Não deu para procurar agora. O problema ficou registrado.';
        if (!(err instanceof ErroIA)) registrar('erro', 'memoria.procurar_falhou', { det: err.message, st: 'erro' });
      }
      return redesenhar();
    }
    if (b.dataset.memExportar !== undefined) {
      const arq = await montarExportacao();
      baixar(arq.nome, arq.conteudo, `${arq.tipo};charset=utf-8`);
      const d = drive();
      let noDrive = false;
      if (d) {
        try {
          await d.gravar(`memoria/exportar/${arq.nome}`, arq.conteudo, arq.tipo);
          noDrive = true;
        } catch (err) {
          registrar('erro', 'memoria.exportar_drive_falhou', { det: err.message, st: 'aviso' });
        }
      }
      registrar('ui', 'memoria.exportar', { det: `${exportar.formato}, ${Object.keys(exportar).filter((k) => k !== 'formato' && exportar[k]).join(' ')}${noDrive ? ', cópia no Drive' : ''}` });
      toast(noDrive ? 'Exportado. Cópia no seu Drive, em memoria/exportar.' : 'Exportado neste aparelho.');
    }
  });

  return { carregar, tela, pendentes, aprovados, procurar, procurarEmSegundoPlano, montarExportacao };
}
