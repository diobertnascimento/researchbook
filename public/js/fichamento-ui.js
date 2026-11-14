// Fichamento real, em cinco etapas, alimentado pelos grifos da obra.
// Coleção "fichamentos" (um por obra, id = id da obra). Salva sozinho enquanto o Diobert escreve.
// Ao concluir, gera também um arquivo legível no Drive: researchbook/fichamentos/<id>.md.
//
// Regra de autoria: nada aqui é escrito pela IA. O resumo e a análise são do Diobert; os grifos
// entram como citação só quando ele escolhe, com página, e a referência sai da ficha da obra.
import { referencia, referenciaTexto, citacao, autorCurto } from './abnt.js';
import { FUNCOES } from './leitor-pdf.js';

/* global toast, fecharModal */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const palavras = (t) => (String(t || '').trim().match(/\S+/g) || []).length;
const slug = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

export const PASSOS = [
  { id: 'referencia', nome: 'Referência', cores: [] },
  { id: 'citacoes', nome: 'Citações', cores: ['conceito', 'evidencia', 'metodo', 'critica', 'dissert'] },
  { id: 'resumo', nome: 'Resumo', cores: ['conceito', 'evidencia'] },
  { id: 'analise', nome: 'Análise crítica', cores: ['metodo', 'critica'] },
  { id: 'dissertacao', nome: 'Para a dissertação', cores: ['dissert'] },
];
const PERGUNTAS = [
  ['problema', 'Qual problema o texto enfrenta?'],
  ['argumento', 'Como os autores constroem o argumento? (método, dados, tipo de evidência)'],
  ['fraco', 'Onde o texto é fraco ou discutível?'],
  ['conexao', 'Como isto conversa com a sua pesquisa?'],
];

export function criarFichamentoUI({ bib, dados, registrar, drive }) {
  let fichamentos = [];
  let argumentos = [];
  let passo = {}; // passo aberto por obra, só nesta sessão
  let salvarDepois = null;
  let exportarDepois = null;

  async function carregar() {
    fichamentos = await dados.listar('fichamentos');
    argumentos = await dados.listar('argumentos');
  }
  const doLivro = (id) => fichamentos.find((f) => f.id === id) || null;
  const novo = (id) => ({ id, leituraId: id, feitos: 0, citacoes: [], resumo: '', analise: {}, trechos: [], iniciadoEm: new Date().toISOString() });

  /* ---------- Markdown legível no Drive ---------- */
  function markdown(f, l) {
    const linhas = [`# Fichamento: ${l.titulo}`, '', referenciaTexto(l), ''];
    if (f.citacoes.length) {
      linhas.push('## Citações', '');
      for (const c of f.citacoes) linhas.push(`> "${c.texto}" ${citacao(l, c.pagina)}`, '', c.porque ? `Por que importa: ${c.porque}` : '', '');
    }
    if (f.resumo) linhas.push('## Resumo', '', f.resumo, '');
    if (PERGUNTAS.some(([k]) => f.analise[k])) {
      linhas.push('## Análise crítica', '');
      for (const [k, p] of PERGUNTAS) if (f.analise[k]) linhas.push(`### ${p}`, '', f.analise[k], '');
    }
    if (f.trechos.some((t) => t.texto)) {
      linhas.push('## Para a dissertação', '');
      for (const t of f.trechos.filter((x) => x.texto)) linhas.push(`- ${t.texto}${t.argumento ? ` (argumento: ${t.argumento})` : ''}`);
      linhas.push('');
    }
    return linhas.filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');
  }

  async function exportar(id) {
    const d = drive();
    const f = doLivro(id);
    const l = bib.obter(id);
    if (!d || !f || !l || !navigator.onLine) return false;
    try {
      await d.gravar(`fichamentos/${id}.md`, markdown(f, l), 'text/markdown');
      return true;
    } catch (e) {
      registrar('erro', 'fichamento.exportar', { det: e.message, st: 'erro' });
      return false;
    }
  }

  async function salvar(f, { exportarJa = false } = {}) {
    const salvo = await dados.salvar('fichamentos', f);
    const i = fichamentos.findIndex((x) => x.id === f.id);
    if (i >= 0) fichamentos[i] = salvo;
    else fichamentos.push(salvo);
    const st = document.getElementById('fich-salvo');
    if (st) st.textContent = 'Salvo';
    clearTimeout(exportarDepois);
    if (exportarJa) await exportar(f.id);
    else exportarDepois = setTimeout(() => exportar(f.id), 15000);
    return salvo;
  }

  /* ---------- Telas ---------- */
  function lista() {
    const leituras = bib.leituras();
    const comFich = leituras.filter((l) => doLivro(l.id));
    const prontas = leituras.filter((l) => !doLivro(l.id) && (l.etapa || 0) >= 2);
    const topo = `<div class="topo"><div><h1>Fichamentos</h1><p>Cada fichamento passa por cinco etapas. Os grifos de cada cor alimentam a etapa certa.</p></div></div>`;
    if (!comFich.length && !prontas.length) {
      return `${topo}<div class="bib-vazia"><h2>Nenhum fichamento ainda</h2><p>Conclua a leitura de uma obra no leitor e toque em “Fazer fichamento”. Os grifos que você fez viram o ponto de partida.</p><a class="btn prim" href="#biblioteca">Ir para a biblioteca</a></div>`;
    }
    const card = (l) => {
      const f = doLivro(l.id);
      const n = f ? Math.min(f.feitos, 5) : 0;
      return `<a class="fich-card" href="#fichamento/${encodeURIComponent(l.id)}">
        <div class="t">${esc(l.titulo)}</div>
        <div class="mute" style="font-size:var(--t-s)">${esc(autorCurto(l))}${l.projeto ? ', ' + esc(l.projeto) : ''}</div>
        <div class="etp">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>
        <div class="mute-2" style="font-size:var(--t-xs)">${!f ? 'Leitura concluída: começar o fichamento' : n >= 5 ? 'Completo' : `Etapa ${n + 1} de 5: ${PASSOS[n].nome}`}</div>
      </a>`;
    };
    return `${topo}<div class="fich-lista">${[...prontas, ...comFich].map(card).join('')}</div>`;
  }

  const grifoBtn = (g, l, modo) =>
    `<button class="grifo-item" style="border-color:var(--hl-${g.funcao})" data-fich-grifo="${esc(g.id)}" data-modo="${modo}">${esc(g.texto)}<small>${FUNCOES.find((x) => x.id === g.funcao)?.nome}, p. ${g.pagina}</small></button>`;

  function corpoPasso(p, f, l, grifos) {
    if (p === 0) {
      const faltam = referencia(l).includes('[a completar]') || referencia(l).includes('[s. d.]');
      return `<h2>Referência</h2><p class="instr">Confira a referência. Ela sai dos dados da obra, pela ABNT NBR 6023:2018.</p>
        <div class="ref-previa" style="margin-bottom:14px"><small>Referência (ABNT)</small><p>${referencia(l)}</p></div>
        <p class="mute" style="font-size:var(--t-s)">Citação no texto: <b>${esc(citacao(l))}</b></p>
        ${faltam ? '<div class="ad-msg erro" role="status">Faltam dados na referência. Corrija antes de usar a obra no texto.</div>' : ''}
        <button class="btn" data-bib-editar="${esc(l.id)}">Corrigir dados da obra</button>`;
    }
    if (p === 1) {
      if (!grifos.length) return `<h2>Citações</h2><p class="instr">Você ainda não grifou esta obra. Volte ao texto, grife os trechos que importam e eles aparecem aqui.</p><a class="btn" href="#leitor/${encodeURIComponent(l.id)}">Voltar ao texto</a>`;
      const escolhidas = new Map(f.citacoes.map((c) => [c.grifoId, c]));
      return `<h2>Citações</h2><p class="instr">Marque os grifos que merecem citação direta. Para cada um, diga em uma frase por que ele importa para você.</p>
        ${grifos
          .map((g) => {
            const c = escolhidas.get(g.id);
            return `<div class="citacao ${c ? 'on' : ''}">
              <label class="check" style="margin:0 0 8px"><input type="checkbox" data-fich-cit="${esc(g.id)}" ${c ? 'checked' : ''}>Usar como citação</label>
              <blockquote style="border-color:var(--hl-${g.funcao})">${esc(g.texto)}</blockquote>
              <div class="cit">${esc(citacao(l, g.pagina))}</div>
              ${c ? `<div class="campo" style="margin:8px 0 0"><textarea data-fich-porque="${esc(g.id)}" placeholder="Por que este trecho importa?">${esc(c.porque)}</textarea></div>` : ''}
            </div>`;
          })
          .join('')}`;
    }
    if (p === 2) {
      return `<h2>Resumo</h2><p class="instr">Explique o texto com as suas palavras, sem olhar o PDF: problema, método, resultado e contribuição. Os grifos de conceito e evidência ficam ao lado como apoio.</p>
        <div class="campo"><label for="fich-resumo">Resumo <span id="fich-pal">${palavras(f.resumo)} palavras</span></label><textarea id="fich-resumo" data-fich-campo="resumo" style="min-height:240px">${esc(f.resumo)}</textarea></div>`;
    }
    if (p === 3) {
      return `<h2>Análise crítica</h2><p class="instr">Responda a cada pergunta. Separe o que os autores dizem do que você pensa.</p>
        ${PERGUNTAS.map(([k, q]) => `<div class="campo"><label for="fich-${k}">${q}</label><textarea id="fich-${k}" data-fich-analise="${k}">${esc(f.analise[k] || '')}</textarea></div>`).join('')}`;
    }
    const trechos = f.trechos.length ? f.trechos : [{ id: 't1', texto: '', argumento: '' }];
    return `<h2>Para a dissertação</h2><p class="instr">Escreva trechos que você usaria no texto final, já com a citação. Ligue cada trecho a um argumento: é assim que ele aparece depois em Argumentos.</p>
      <datalist id="fich-args">${argumentos.map((a) => `<option value="${esc(a.tese)}">`).join('')}</datalist>
      ${trechos
        .map(
          (t) => `<div class="citacao">
        <div class="campo"><label>Trecho <button class="btn fant mini" data-fich-citar="${esc(t.id)}">Inserir citação</button></label><textarea data-fich-trecho="${esc(t.id)}" style="min-height:110px">${esc(t.texto)}</textarea></div>
        <div class="campo" style="margin:0"><label>Sustenta o argumento</label><input list="fich-args" data-fich-arg="${esc(t.id)}" placeholder="Escreva a tese ou escolha uma existente" value="${esc(t.argumento)}"></div>
      </div>`,
        )
        .join('')}
      <button class="btn" data-fich-novo-trecho>Outro trecho</button>`;
  }

  function tela(id) {
    const l = bib.obter(id);
    if (!l) return null;
    const f = doLivro(id) || novo(id);
    const p = passo[id] ?? Math.min(f.feitos, 4);
    const cores = PASSOS[p].cores;
    const todos = bib.grifosDe(id);
    const grifos = p === 1 ? todos : todos.filter((g) => !cores.length || cores.includes(g.funcao));
    const modo = p === 4 ? 'citar' : 'ver';
    return `<div class="topo"><div><h1>Fichamento</h1><p>${esc(l.titulo)}</p></div><div class="acoes"><span class="mute-2" id="fich-salvo" style="font-size:var(--t-xs)">${doLivro(id) ? 'Salvo' : ''}</span><a class="btn" href="#leitor/${encodeURIComponent(l.id)}">Voltar ao texto</a></div></div>
      <ol class="passos">${PASSOS.map((s, i) => `<li><button data-fpasso="${i}" data-id="${esc(id)}" class="${i === p ? 'on' : i < f.feitos ? 'feito' : ''}"><span class="n">${i < f.feitos ? '✓' : i + 1}</span><span class="rot">${s.nome}</span></button></li>`).join('')}</ol>
      <div class="fich-real">
        <section class="editor" data-fich-id="${esc(id)}">
          ${corpoPasso(p, f, l, todos)}
          <div class="pe">
            ${p > 0 ? `<button class="btn fant" data-fpasso="${p - 1}" data-id="${esc(id)}">Voltar para ${PASSOS[p - 1].nome}</button>` : '<span></span>'}
            ${p < 4 ? `<button class="btn prim" data-fpasso="${p + 1}" data-id="${esc(id)}" data-concluir-passo="${p}">Próxima etapa: ${PASSOS[p + 1].nome}</button>` : `<button class="btn prim" data-fich-concluir="${esc(id)}">${f.feitos >= 5 ? 'Atualizar fichamento' : 'Concluir fichamento'}</button>`}
          </div>
        </section>
        <aside class="painel-lat">
          ${p === 0 ? '' : `<h4>Seus grifos</h4><p class="sub">${p === 1 ? 'Todos os grifos da obra' : cores.length ? 'Para esta etapa: ' + cores.map((c) => FUNCOES.find((x) => x.id === c).nome.toLowerCase()).join(', ') : ''}${modo === 'citar' ? '. Toque para inserir a citação no trecho.' : ''}</p>
          ${grifos.length ? grifos.map((g) => grifoBtn(g, l, modo)).join('') : '<p class="mute" style="font-size:var(--t-s)">Nenhum grifo desta cor ainda.</p>'}`}
          <h4 style="margin-top:22px">Comentários do tutor</h4>
          <p class="sub">O tutor vai comentar cada etapa quando o Gemini for ligado: aponta lacunas e faz perguntas, sem reescrever por você.</p>
        </aside>
      </div>`;
  }

  /* ---------- Eventos ---------- */
  const atual = () => {
    const ed = document.querySelector('[data-fich-id]');
    if (!ed) return null;
    const id = ed.dataset.fichId;
    return { id, f: structuredClone(doLivro(id) || novo(id)) };
  };
  const agendarSalvar = (f) => {
    const st = document.getElementById('fich-salvo');
    if (st) st.textContent = 'Salvando…';
    clearTimeout(salvarDepois);
    salvarDepois = setTimeout(() => salvar(f), 700);
  };
  const ultimoTrecho = { id: null, pos: null };

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.closest?.('[data-fich-id]')) return;
    const a = atual();
    if (!a) return;
    const { f } = a;
    if (t.dataset.fichCampo === 'resumo') {
      f.resumo = t.value;
      const pal = document.getElementById('fich-pal');
      if (pal) pal.textContent = `${palavras(t.value)} palavras`;
    }
    if (t.dataset.fichAnalise) f.analise[t.dataset.fichAnalise] = t.value;
    if (t.dataset.fichPorque) {
      const c = f.citacoes.find((x) => x.grifoId === t.dataset.fichPorque);
      if (c) c.porque = t.value;
    }
    if (t.dataset.fichTrecho || t.dataset.fichArg) {
      const id = t.dataset.fichTrecho || t.dataset.fichArg;
      if (!f.trechos.length) f.trechos.push({ id: 't1', texto: '', argumento: '' });
      const tr = f.trechos.find((x) => x.id === id);
      if (tr) tr[t.dataset.fichTrecho ? 'texto' : 'argumento'] = t.value;
    }
    // atualiza a cópia em memória já, para a próxima tecla partir dela
    const i = fichamentos.findIndex((x) => x.id === f.id);
    if (i >= 0) fichamentos[i] = f;
    else fichamentos.push(f);
    agendarSalvar(f);
  });

  document.addEventListener('focusout', (e) => {
    if (e.target.dataset?.fichTrecho) {
      ultimoTrecho.id = e.target.dataset.fichTrecho;
      ultimoTrecho.pos = e.target.selectionStart;
    }
  });

  document.addEventListener('change', async (e) => {
    const id = e.target.dataset?.fichCit;
    if (!id) return;
    const a = atual();
    const g = bib.grifosDe(a.id).find((x) => x.id === id);
    if (e.target.checked) a.f.citacoes.push({ grifoId: g.id, texto: g.texto, pagina: g.pagina, porque: '' });
    else a.f.citacoes = a.f.citacoes.filter((c) => c.grifoId !== id);
    await salvar(a.f);
    window.render?.();
  });

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-fpasso],[data-fich-concluir],[data-fich-novo-trecho],[data-fich-citar],[data-fich-grifo],[data-bib-editar]');
    if (!t) return;
    if (t.dataset.bibEditar) {
      window.rb?.bibUI?.editar(t.dataset.bibEditar);
      return;
    }
    const a = atual();
    if (!a) return;
    if (t.dataset.fpasso !== undefined) {
      clearTimeout(salvarDepois);
      if (t.dataset.concluirPasso !== undefined) a.f.feitos = Math.max(a.f.feitos, Number(t.dataset.concluirPasso) + 1);
      await salvar(a.f);
      if (a.f.feitos >= 1) {
        const l = bib.obter(a.id);
        if (l && (l.etapa || 0) < 3) await bib.atualizar(a.id, { etapa: 3 });
      }
      passo[a.id] = Number(t.dataset.fpasso);
      registrar('ui', 'fichamento.etapa', { det: PASSOS[passo[a.id]].id });
      window.render?.();
      scrollTo({ top: 0 });
    }
    if (t.dataset.fichNovoTrecho !== undefined) {
      if (!a.f.trechos.length) a.f.trechos.push({ id: 't1', texto: '', argumento: '' });
      a.f.trechos.push({ id: `t${Date.now()}`, texto: '', argumento: '' });
      await salvar(a.f);
      window.render?.();
    }
    if (t.dataset.fichCitar || (t.dataset.fichGrifo && t.dataset.modo === 'citar')) {
      // insere "(Autor, ano, p. X)" no trecho, onde o cursor estava
      const l = bib.obter(a.id);
      const g = t.dataset.fichGrifo ? bib.grifosDe(a.id).find((x) => x.id === t.dataset.fichGrifo) : null;
      const alvoId = t.dataset.fichCitar || ultimoTrecho.id || a.f.trechos[0]?.id || 't1';
      const campo = document.querySelector(`[data-fich-trecho="${CSS.escape(alvoId)}"]`);
      if (!campo) return;
      const cit = citacao(l, g?.pagina);
      const pos = alvoId === ultimoTrecho.id && ultimoTrecho.pos != null ? ultimoTrecho.pos : campo.value.length;
      const antes = campo.value.slice(0, pos);
      campo.value = `${antes}${antes && !/\s$/.test(antes) ? ' ' : ''}${cit}${campo.value.slice(pos)}`;
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      campo.focus();
      toast(`Citação inserida: ${cit}`);
    }
    if (t.dataset.fichConcluir) {
      clearTimeout(salvarDepois);
      a.f.feitos = 5;
      a.f.concluidoEm = a.f.concluidoEm || new Date().toISOString();
      // Teses novas viram argumentos (com o texto do Diobert), para aparecerem depois em Argumentos.
      for (const tr of a.f.trechos.filter((x) => x.argumento?.trim())) {
        const tese = tr.argumento.trim();
        let arg = argumentos.find((x) => x.tese.toLowerCase() === tese.toLowerCase());
        if (!arg) {
          arg = await dados.salvar('argumentos', { id: `arg-${slug(tese)}-${crypto.randomUUID().slice(0, 4)}`, tese, criadoEm: new Date().toISOString() });
          argumentos.push(arg);
        }
        tr.argumentoId = arg.id;
      }
      await salvar(a.f, { exportarJa: true });
      await bib.atualizar(a.id, { etapa: 4 });
      await window.rb?.argUI?.carregar();
      registrar('ui', 'fichamento.concluir', { det: `${a.f.citacoes.length} citações, ${a.f.trechos.filter((x) => x.texto).length} trechos` });
      toast('Fichamento concluído e salvo no Drive');
      window.render?.();
    }
  });

  return { carregar, lista, tela, markdown, doLivro, todos: () => fichamentos };
}
