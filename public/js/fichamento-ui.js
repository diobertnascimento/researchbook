// Fichamento real (refeito na v2.8.0): dois caminhos que alimentam as mesmas notas. Pelos grifos, ele diz com as
// suas palavras o que cada trecho marcado afirma. Pelo texto completo, responde de memória a cerca de 8 perguntas
// em 5 blocos fixos. Coleção "fichamentos" (um por obra, id = id da obra). Salva sozinho enquanto ele escreve.
// Ao concluir, gera também um arquivo legível no Drive: researchbook/fichamentos/<id>.md.
//
// Regra de autoria: nenhuma nota é escrita pela IA. A IA só escreve as perguntas, quando ele pede, e a referência
// sai da ficha da obra. O que foi escrito nas cinco etapas antigas (citações, resumo, análise, trechos) continua
// no registro, aparece em "Suas notas" e segue no arquivo do Drive.
import { referencia, referenciaTexto, citacao, autorCurto } from './abnt.js';
import { FUNCOES } from './leitor-pdf.js';
import { ouvir } from './ui.js';

/* global toast, fecharModal, I */
const icone = (n) => (typeof I !== 'undefined' && I[n]) || '';
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
export const PERGUNTAS = [
  ['problema', 'Qual problema o texto enfrenta?'],
  ['argumento', 'Como os autores constroem o argumento? (método, dados, tipo de evidência)'],
  ['fraco', 'Onde o texto é fraco ou discutível?'],
  ['conexao', 'Como isto conversa com a sua pesquisa?'],
];

// Os cinco blocos do fichamento pelo texto completo e as cores de grifo que servem de apoio a cada um.
export const BLOCOS = [
  ['essencial', 'O essencial', ['conceito', 'evidencia']],
  ['metodo', 'Como chegaram lá', ['metodo', 'evidencia']],
  ['conceitos', 'Conceitos', ['conceito']],
  ['critica', 'Sua crítica', ['critica', 'metodo']],
  ['dissertacao', 'Para a sua dissertação', ['dissert']],
];
// Perguntas que valem para qualquer texto: o caminho sem IA, e o que completa um bloco que a IA deixou vazio.
export const PERGUNTAS_GERAIS = [
  { id: 'g1', bloco: 'essencial', texto: 'Que problema o texto enfrenta e por que ele importa?', porque: 'Sem o problema, o resto do texto não tem para que servir.' },
  { id: 'g2', bloco: 'essencial', texto: 'O que os autores afirmam ao final? Diga em duas ou três frases.', porque: 'É a tese do texto: o que você vai citar ou contestar.' },
  { id: 'g3', bloco: 'metodo', texto: 'Como eles chegaram a essa conclusão? Que dados, casos ou argumentos usaram?', porque: 'A força da conclusão depende do caminho que levou a ela.' },
  { id: 'g4', bloco: 'metodo', texto: 'O que no desenho do estudo limita o que se pode concluir?', porque: 'É o que uma banca pergunta primeiro sobre uma fonte.' },
  { id: 'g5', bloco: 'conceitos', texto: 'Que conceito central o texto usa e como o define?', porque: 'Você só pode usar o conceito como o autor definiu, ou dizer que mudou.' },
  { id: 'g6', bloco: 'critica', texto: 'Onde o texto é fraco, discutível ou deixa algo sem resposta?', porque: 'O fichamento crítico separa o que o autor diz do que você pensa.' },
  { id: 'g7', bloco: 'critica', texto: 'Com o que você concorda e com o que não concorda? Por quê?', porque: 'A sua posição é o que entra na dissertação.' },
  { id: 'g8', bloco: 'dissertacao', texto: 'Onde este texto entra na sua dissertação, e para sustentar o quê?', porque: 'Leitura sem destino tende a não ser usada.' },
];
const PERGUNTAS_RESERVA = [
  { id: 'r1', bloco: 'essencial', texto: 'Para quem o texto foi escrito e a que debate ele responde?', porque: 'Situa o texto antes de usá-lo.' },
  { id: 'r2', bloco: 'metodo', texto: 'Que evidência do texto mais convenceu você, e qual convenceu menos?', porque: 'Obriga a pesar a evidência, e não só a repetir a conclusão.' },
  { id: 'r3', bloco: 'conceitos', texto: 'Que termo do texto você não saberia explicar a um colega sem voltar a ele?', porque: 'Mostra o que ainda não foi entendido.' },
  { id: 'r4', bloco: 'critica', texto: 'Que objeção um leitor atento faria a este texto?', porque: 'Antecipar a objeção prepara a sua resposta.' },
  { id: 'r5', bloco: 'dissertacao', texto: 'O que muda na sua pesquisa se este texto estiver certo?', porque: 'Liga a leitura a uma decisão sua.' },
];

export function criarFichamentoUI({ bib, dados, registrar, drive }) {
  let fichamentos = [];
  let argumentos = [];
  const est = { vista: {}, filtro: {}, pergunta: {}, aberto: new Set(), erro: null }; // o que está aberto por obra, só nesta sessão
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
    const notas = (f.notas || []).filter((n) => n.texto?.trim());
    if (notas.length) {
      linhas.push('## Notas', '');
      const grifos = bib.grifosDe(l.id);
      for (const n of notas) {
        const g = n.chave.startsWith('g:') ? grifos.find((x) => `g:${x.id}` === n.chave) : null;
        if (g) linhas.push(`> "${g.texto}" ${citacao(l, g.pagina)}`, '');
        else if (n.pergunta) linhas.push(`### ${n.pergunta}`, '');
        linhas.push(`${n.texto.trim()} ${citacao(l, n.pagina || undefined)}`, '');
      }
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
    // Esta gravação leva a versão mais nova: uma gravação agendada antes não pode passar por cima dela.
    clearTimeout(salvarDepois);
    pendente = null;
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
    const topo = `<div class="topo"><div><h1>Fichamentos</h1><p>Dois caminhos para a mesma ficha: pelos trechos que você grifou e pelo texto completo, respondendo de memória.</p></div></div>`;
    if (!comFich.length && !prontas.length) {
      return `${topo}<div class="bib-vazia"><h2>Nenhum fichamento ainda</h2><p>Conclua a leitura de uma obra no leitor e selecione “Fazer fichamento”. Os grifos que você fez viram o ponto de partida.</p><a class="btn prim" href="#biblioteca">Ir para Leituras</a></div>`;
    }
    const nNotas = (f) => {
      const k = (f.notas || []).filter((x) => x.texto?.trim()).length;
      return `${k} ${k === 1 ? 'nota' : 'notas'}`;
    };
    const card = (l) => {
      const f = doLivro(l.id);
      const n = f ? Math.min(f.feitos, 5) : 0;
      return `<a class="fich-card" href="#fichamento/${encodeURIComponent(l.id)}">
        <div class="t">${esc(l.titulo)}</div>
        <div class="t-meta mute">${esc(autorCurto(l))}${l.projeto ? ', ' + esc(l.projeto) : ''}</div>
        <div class="t-legenda mute-2">${!f ? 'Leitura concluída: começar o fichamento' : n >= 5 ? `Completo, ${nNotas(f)}` : `Em andamento, ${nNotas(f)}`}</div>
      </a>`;
    };
    return `${topo}<div class="fich-lista">${[...prontas, ...comFich].map(card).join('')}</div>`;
  }

  /* ---------- Notas: cada resposta ou comentário de grifo, com as palavras dele ---------- */
  // chave "g:<id do grifo>" ou "p:<id da pergunta>". A nota guarda o que precisa para ser lida sozinha.
  const notaDe = (f, chave) => (f.notas || []).find((n) => n.chave === chave) || null;
  const comTexto = (f) => (f.notas || []).filter((n) => n.texto?.trim());
  const perguntasDe = (f) => f.perguntas?.itens || [];
  const referenciaDaNota = (n, l) => citacao(l, n.pagina || undefined);
  /** As notas que ele marcou para a dissertação ou ligou a um argumento viram trechos: é deles que os Argumentos leem. */
  function espelhar(f, l) {
    const antigos = (f.trechos || []).filter((t) => !t.daNota);
    const novos = comTexto(f)
      .filter((n) => n.levar || n.argumento?.trim())
      .map((n) => {
        const cit = referenciaDaNota(n, l);
        return { id: `n-${n.id}`, texto: n.texto.includes(cit) ? n.texto.trim() : `${n.texto.trim()} ${cit}`, argumento: n.argumento?.trim() || '', argumentoId: n.argumentoId || undefined, daNota: true };
      });
    f.trechos = [...antigos, ...novos];
    if ((f.feitos || 0) < 5) f.feitos = Math.min(4, Math.max(f.feitos || 0, comTexto(f).length ? 1 : 0));
    return f;
  }
  const temAntigo = (f) => !!(f.resumo || f.citacoes?.length || PERGUNTAS.some(([k]) => f.analise?.[k]) || (f.trechos || []).some((t) => !t.daNota && t.texto));

  /** A pergunta aberta: a que ele escolheu ou, sem escolha, a primeira ainda sem resposta. */
  function indiceAtual(f, id) {
    const ps = perguntasDe(f);
    const primeiraVazia = ps.findIndex((p) => !notaDe(f, `p:${p.id}`)?.texto?.trim());
    return Math.min(est.pergunta[id] ?? Math.max(0, primeiraVazia), ps.length - 1);
  }

  /* ---------- Telas ---------- */
  const corDe = (funcao) => FUNCOES.find((x) => x.id === funcao)?.nome || 'Grifo';
  function destinoHTML(n, chave) {
    return `<div class="fich-destino"><label class="m-0 check"><input type="checkbox" data-fich-levar="${esc(chave)}" ${n?.levar ? 'checked' : ''}>Levar para a dissertação</label>
      <div class="m-0 campo"><label for="arg-${esc(chave)}">Sustenta o argumento <span>opcional</span></label><input id="arg-${esc(chave)}" list="fich-args" data-fich-arg="${esc(chave)}" placeholder="Escreva a tese ou escolha uma existente" value="${esc(n?.argumento || '')}" autocomplete="off"></div></div>`;
  }
  function vistaGrifos(f, l, grifos) {
    if (!grifos.length) return `<div class="proximo fich-vazio"><div class="rot">Nenhum grifo nesta obra</div><p>Este caminho passa pelos trechos que você marcou no texto. Grife o que importa e volte, ou siga pelo texto completo.</p><div class="acao-l"><a class="btn" href="#leitor/${encodeURIComponent(l.id)}">Abrir o texto</a></div></div>`;
    const usadas = FUNCOES.filter((x) => grifos.some((g) => g.funcao === x.id));
    const filtro = usadas.some((x) => x.id === est.filtro[l.id]) ? est.filtro[l.id] : '';
    const mostra = grifos.filter((g) => !filtro || g.funcao === filtro);
    return `<p class="instr">Passe pelos trechos que você grifou. Em cada um, diga com as suas palavras o que ele afirma e por que importa. Trecho sem nota fica de fora do fichamento.</p>
      ${usadas.length > 1 ? `<div class="alterna fich-filtro" role="group" aria-label="Mostrar grifos de">${[['', 'Todos'], ...usadas.map((x) => [x.id, x.nome])].map(([k, n]) => `<button class="txt" data-fich-filtro="${k}" aria-pressed="${filtro === k}">${n}</button>`).join('')}</div>` : ''}
      <ol class="fich-grifos">${mostra
        .map((g) => {
          const chave = `g:${g.id}`;
          const n = notaDe(f, chave);
          return `<li><blockquote style="border-color:var(--hl-${g.funcao})">${esc(g.texto)}<cite>${corDe(g.funcao)}. ${esc(citacao(l, g.pagina))}</cite></blockquote>
            <div class="campo"><label for="nota-${esc(g.id)}">Com as suas palavras</label><textarea id="nota-${esc(g.id)}" data-fich-nota="${esc(chave)}">${esc(n?.texto || '')}</textarea></div>${destinoHTML(n, chave)}</li>`;
        })
        .join('')}</ol>
      <div class="pe"><span class="cresce"></span><button class="btn prim" data-fich-vista="notas">Ver as suas notas</button></div>`;
  }
  function vistaTexto(f, l, grifos) {
    const ps = perguntasDe(f);
    if (!ps.length) {
      const semIA = !window.rb?.ia?.ajustes?.modo?.();
      return `<section class="proximo fich-comeco" aria-labelledby="fc-t"><div class="rot" id="fc-t">Fichar o texto completo</div>
        <p>São cerca de 8 perguntas em 5 blocos: o essencial, como chegaram lá, conceitos, sua crítica e para a sua dissertação. Você responde de memória, com o texto fechado.</p>
        <p>A IA pode escrever as perguntas para este texto, uma única vez, a partir do artigo, dos seus grifos, da sua tese e dos seus argumentos. Ela não responde por você.</p>
        ${est.erro && est.erro.id === l.id ? `<div class="erro-ia" role="alert"><p>${esc(est.erro.err.message)}</p></div>` : ''}
        <div class="acao-l">${semIA ? '' : `<button class="btn prim" data-fich-perguntas="ia" data-ocupado="Preparando as perguntas…">Preparar as perguntas com a IA</button>`}<button class="btn ${semIA ? 'prim' : ''}" data-fich-perguntas="geral">Usar perguntas gerais, sem IA</button></div>
        ${semIA ? '<p class="t-meta mute">O Gemini não está conectado neste aparelho. As perguntas gerais valem para qualquer texto.</p>' : ''}</section>`;
    }
    const i = indiceAtual(f, l.id);
    const p = ps[i];
    const chave = `p:${p.id}`;
    const n = notaDe(f, chave);
    const bloco = BLOCOS.find(([k]) => k === p.bloco) || BLOCOS[0];
    const aberto = (o) => est.aberto.has(`${l.id}:${p.id}:${o}`);
    const apoio = grifos.filter((g) => bloco[2].includes(g.funcao));
    return `<div class="fich-wiz">
      <ol class="fich-pontos" aria-label="Perguntas">${ps.map((q, k) => `<li><button data-fich-ir="${k}" class="${k === i ? 'on' : ''} ${notaDe(f, `p:${q.id}`)?.texto?.trim() ? 'feita' : ''}" aria-label="Pergunta ${k + 1}${notaDe(f, `p:${q.id}`)?.texto?.trim() ? ', respondida' : ''}" ${k === i ? 'aria-current="step"' : ''}>${k + 1}</button></li>`).join('')}</ol>
      <p class="fich-bloco">${bloco[1]}. Pergunta ${i + 1} de ${ps.length}</p>
      <h2 class="fich-pergunta">${esc(p.texto)}</h2>
      <div class="campo"><label for="fich-resp">Sua resposta, de memória <span id="fich-pal">${palavras(n?.texto)} palavras</span></label><textarea id="fich-resp" class="fich-resp" data-fich-nota="${esc(chave)}">${esc(n?.texto || '')}</textarea></div>
      ${destinoHTML(n, chave)}
      <div class="fich-pedir"><button class="lnk" data-fich-abrir="porque" aria-expanded="${aberto('porque')}">Por que esta pergunta?</button><button class="lnk" data-fich-abrir="conferir" aria-expanded="${aberto('conferir')}">Conferir com o texto</button><button class="lnk" data-fich-trocar="${esc(p.id)}" data-ocupado="Trocando…">Trocar a pergunta</button></div>
      ${aberto('porque') ? `<p class="fich-porque">${esc(p.porque || 'Pergunta do conjunto geral, que vale para qualquer texto.')}</p>` : ''}
      ${aberto('conferir') ? `<div class="fich-conf"><h3>Seus grifos de ${bloco[2].map((c) => corDe(c).toLowerCase()).join(' e ')}</h3>${apoio.length ? apoio.map((g) => `<blockquote style="border-color:var(--hl-${g.funcao})">${esc(g.texto)}<cite>${esc(citacao(l, g.pagina))}</cite></blockquote>`).join('') : '<p class="t-meta mute">Nenhum grifo dessas cores nesta obra.</p>'}<a class="lnk" href="#leitor/${encodeURIComponent(l.id)}">Abrir o texto</a></div>` : ''}
      <div class="pe">${i > 0 ? `<button class="btn fant" data-fich-ir="${i - 1}">Pergunta anterior</button>` : '<span></span>'}<span class="cresce"></span>${i < ps.length - 1 ? `<button class="btn prim" data-fich-ir="${i + 1}">Próxima pergunta</button>` : '<button class="btn prim" data-fich-vista="notas">Ver as suas notas</button>'}</div>
    </div>`;
  }
  function vistaNotas(f, l, grifos) {
    const notas = comTexto(f);
    const origem = (n) => {
      if (n.chave.startsWith('p:')) return `Resposta a: ${esc(n.pergunta || perguntasDe(f).find((p) => `p:${p.id}` === n.chave)?.texto || 'uma pergunta')}`;
      const g = grifos.find((x) => `g:${x.id}` === n.chave);
      return g ? `Sobre o grifo: “${esc(g.texto.slice(0, 120))}${g.texto.length > 120 ? '…' : ''}”` : 'Sobre um grifo que foi apagado';
    };
    return `${notas.length ? `<p class="instr">Cada nota já traz a referência e pode ser lida sozinha. As marcadas para a dissertação e as ligadas a um argumento aparecem em Argumentos.</p>
      <ul class="fich-notas">${notas.map((n) => `<li><p class="nota-t">${esc(n.texto)} <span class="cit">${esc(referenciaDaNota(n, l))}</span></p><small>${origem(n)}${n.levar ? '. Vai para a dissertação' : ''}${n.argumento?.trim() ? `. Argumento: ${esc(n.argumento)}` : ''}</small><button class="btn fant" data-fich-copiar="${esc(n.chave)}">Copiar</button></li>`).join('')}</ul>` : '<p class="mute">Nenhuma nota ainda. Elas nascem dos dois caminhos: pelos grifos e pelo texto completo.</p>'}
      ${temAntigo(f) ? `<details class="fich-antigo"><summary>Do fichamento em cinco etapas</summary>
        ${f.citacoes?.length ? `<h3>Citações</h3>${f.citacoes.map((c) => `<blockquote>${esc(c.texto)}<cite>${esc(citacao(l, c.pagina))}${c.porque ? `. Por que importa: ${esc(c.porque)}` : ''}</cite></blockquote>`).join('')}` : ''}
        ${f.resumo ? `<h3>Resumo</h3><p>${esc(f.resumo)}</p>` : ''}
        ${PERGUNTAS.filter(([k]) => f.analise?.[k]).map(([k, q]) => `<h3>${q}</h3><p>${esc(f.analise[k])}</p>`).join('')}
        ${(f.trechos || []).some((t) => !t.daNota && t.texto) ? `<h3>Para a dissertação</h3>${f.trechos.filter((t) => !t.daNota && t.texto).map((t) => `<p>${esc(t.texto)}${t.argumento ? ` <small>Argumento: ${esc(t.argumento)}</small>` : ''}</p>`).join('')}` : ''}
        <p class="t-meta mute">Escrito antes da mudança do fichamento. Continua guardado, no arquivo do Drive e nos Argumentos.</p></details>` : ''}
      ${window.rb?.tutorFich ? `<section class="fich-tutor">${window.rb.tutorFich.painel(l.id, 3)}</section>` : ''}
      <div class="pe"><span class="cresce"></span><button class="btn prim" data-fich-concluir="${esc(l.id)}">${f.feitos >= 5 ? 'Salvar de novo no Drive' : 'Concluir fichamento'}</button></div>`;
  }

  function tela(id) {
    const l = bib.obter(id);
    if (!l) return null;
    const f = doLivro(id) || novo(id);
    const grifos = bib.grifosDe(id);
    const v = est.vista[id] || (grifos.length ? 'grifos' : 'texto');
    const faltam = referencia(l).includes('[a completar]') || referencia(l).includes('[s. d.]');
    const corpo = { grifos: vistaGrifos, texto: vistaTexto, notas: vistaNotas }[v](f, l, grifos);
    const abas = [['grifos', `Pelos grifos, ${grifos.length}`], ['texto', 'Pelo texto completo'], ['notas', `Suas notas, ${comTexto(f).length}`]];
    return `<a class="voltar" href="#leitor/${encodeURIComponent(id)}">${icone('voltar')}Voltar ao texto</a>
      <div class="topo fich-topo"><div><h1>Fichamento</h1><p class="fich-obra">${esc(l.titulo)}</p>
        <p class="ref-previa">${referencia(l)} <button class="lnk" data-bib-editar="${esc(l.id)}">Corrigir os dados da obra</button></p>
        ${faltam ? '<div class="ad-msg erro" role="status">Faltam dados na referência. Corrija antes de usar a obra no texto.</div>' : ''}</div>
        <div class="acoes"><span class="t-legenda mute-2" id="fich-salvo" role="status">${doLivro(id) ? 'Salvo' : ''}</span></div></div>
      <div class="alterna fich-caminho" role="group" aria-label="Caminho do fichamento">${abas.map(([k, n]) => `<button class="txt" data-fich-vista="${k}" aria-pressed="${v === k}">${n}</button>`).join('')}</div>
      <datalist id="fich-args">${argumentos.map((a) => `<option value="${esc(a.tese)}">`).join('')}</datalist>
      <section class="fich-novo" data-fich-id="${esc(id)}">${corpo}</section>`;
  }

  /* ---------- Eventos ---------- */
  const atual = () => {
    const ed = document.querySelector('[data-fich-id]');
    if (!ed) return null;
    const id = ed.dataset.fichId;
    return { id, f: structuredClone(doLivro(id) || novo(id)), l: bib.obter(id) };
  };
  const agendarSalvar = (f) => {
    const st = document.getElementById('fich-salvo');
    if (st) st.textContent = 'Salvando…';
    clearTimeout(salvarDepois);
    pendente = f;
    salvarDepois = setTimeout(gravarPendente, 700);
  };
  let pendente = null;
  const gravarPendente = async () => {
    clearTimeout(salvarDepois);
    const f = pendente;
    pendente = null;
    if (f) await salvar(f);
  };
  // Sair da tela não pode custar o que foi digitado no último instante.
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && gravarPendente());
  window.addEventListener('pagehide', () => gravarPendente());
  window.addEventListener('hashchange', () => gravarPendente());

  /** Acha ou cria a nota de uma chave, com o que ela precisa para ser lida sozinha. */
  function notaPara(f, chave, l) {
    f.notas = f.notas || [];
    let n = f.notas.find((x) => x.chave === chave);
    if (n) return n;
    n = { id: crypto.randomUUID().slice(0, 8), chave, texto: '', levar: false, argumento: '', criadoEm: new Date().toISOString() };
    if (chave.startsWith('g:')) {
      const g = bib.grifosDe(l.id).find((x) => `g:${x.id}` === chave);
      n.pagina = g?.pagina || null;
    } else {
      const p = perguntasDe(f).find((x) => `p:${x.id}` === chave);
      n.pergunta = p?.texto || '';
      n.bloco = p?.bloco || '';
    }
    f.notas.push(n);
    return n;
  }
  const guardarNaMemoria = (f) => {
    const i = fichamentos.findIndex((x) => x.id === f.id);
    if (i >= 0) fichamentos[i] = f;
    else fichamentos.push(f);
  };

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.closest?.('[data-fich-id]') || !(t.dataset.fichNota || t.dataset.fichArg)) return;
    const a = atual();
    if (!a) return;
    const n = notaPara(a.f, t.dataset.fichNota || t.dataset.fichArg, a.l);
    if (t.dataset.fichNota) {
      n.texto = t.value;
      const pal = document.getElementById('fich-pal');
      if (pal && t.id === 'fich-resp') pal.textContent = `${palavras(t.value)} palavras`;
    } else {
      n.argumento = t.value;
      n.argumentoId = undefined;
    }
    espelhar(a.f, a.l);
    const aba = document.querySelector('.fich-caminho [data-fich-vista="notas"]');
    if (aba) aba.textContent = `Suas notas, ${comTexto(a.f).length}`;
    // atualiza a cópia em memória já, para a próxima tecla partir dela
    guardarNaMemoria(a.f);
    agendarSalvar(a.f);
  });

  document.addEventListener('change', async (e) => {
    const chave = e.target.dataset?.fichLevar;
    if (!chave) return;
    const a = atual();
    notaPara(a.f, chave, a.l).levar = e.target.checked;
    espelhar(a.f, a.l);
    guardarNaMemoria(a.f);
    await salvar(a.f);
  });

  async function comecarObra(a) {
    if ((a.l.etapa || 0) < 3) await bib.atualizar(a.id, { etapa: 3 });
  }

  ouvir('click', async (e) => {
    const t = e.target.closest('[data-fich-vista],[data-fich-filtro],[data-fich-ir],[data-fich-abrir],[data-fich-perguntas],[data-fich-trocar],[data-fich-copiar],[data-fich-concluir],[data-bib-editar]');
    if (!t) return;
    const d = t.dataset;
    if (d.bibEditar) {
      window.rb?.bibUI?.editar(d.bibEditar);
      return;
    }
    const a = atual();
    if (!a) return;
    if (d.fichVista || d.fichIr !== undefined || d.fichFiltro !== undefined) {
      await gravarPendente();
      if (d.fichVista) est.vista[a.id] = d.fichVista;
      if (d.fichIr !== undefined) est.pergunta[a.id] = Number(d.fichIr);
      if (d.fichFiltro !== undefined) est.filtro[a.id] = d.fichFiltro;
      if (comTexto(doLivro(a.id) || a.f).length) await comecarObra(a);
      registrar('ui', 'fichamento.vista', { det: d.fichVista || (d.fichIr !== undefined ? 'pergunta' : 'filtro') });
      window.render?.();
      if (d.fichVista || d.fichIr !== undefined) scrollTo({ top: 0 });
      return;
    }
    if (d.fichAbrir) {
      await gravarPendente();
      est.pergunta[a.id] = indiceAtual(a.f, a.id);
      const p = perguntasDe(a.f)[est.pergunta[a.id]];
      const k = `${a.id}:${p.id}:${d.fichAbrir}`;
      if (est.aberto.has(k)) est.aberto.delete(k);
      else est.aberto.add(k);
      return window.render?.();
    }
    if (d.fichPerguntas) {
      est.erro = null;
      let itens = PERGUNTAS_GERAIS;
      let origem = 'geral';
      if (d.fichPerguntas === 'ia') {
        try {
          itens = await window.rb.tutorFich.gerarPerguntas(a.id);
          origem = 'ia';
        } catch (err) {
          est.erro = { id: a.id, err };
          return window.render?.();
        }
      }
      const f = structuredClone(doLivro(a.id) || novo(a.id));
      f.perguntas = { origem, geradasEm: new Date().toISOString(), itens };
      await salvar(f);
      est.pergunta[a.id] = 0;
      registrar('ui', 'fichamento.perguntas', { det: `${origem}, ${itens.length}` });
      return window.render?.();
    }
    if (d.fichTrocar) {
      await gravarPendente();
      const f = structuredClone(doLivro(a.id) || a.f);
      const i = perguntasDe(f).findIndex((p) => p.id === d.fichTrocar);
      const velha = perguntasDe(f)[i];
      if (notaDe(f, `p:${velha.id}`)?.texto?.trim()) return toast('Esta pergunta já tem resposta. A resposta fica nas suas notas; troque uma pergunta ainda em branco.');
      let nova = null;
      if (f.perguntas.origem === 'ia') {
        try {
          nova = await window.rb.tutorFich.gerarPerguntas(a.id, { trocar: velha });
        } catch (err) {
          return toast(err.message);
        }
      } else {
        const usadas = new Set(perguntasDe(f).map((p) => p.texto));
        nova = [...PERGUNTAS_GERAIS, ...PERGUNTAS_RESERVA].find((p) => p.bloco === velha.bloco && !usadas.has(p.texto));
        if (!nova) return toast('Não há outra pergunta geral para este bloco.');
        nova = { ...nova, id: `${nova.id}-${Date.now().toString(36)}` };
      }
      f.perguntas.itens[i] = nova;
      await salvar(f);
      est.pergunta[a.id] = i;
      return window.render?.();
    }
    if (d.fichCopiar) {
      const n = notaDe(a.f, d.fichCopiar);
      const texto = `${n.texto.trim()} ${referenciaDaNota(n, a.l)}`;
      try {
        await navigator.clipboard.writeText(texto);
        toast('Nota copiada com a referência');
      } catch {
        toast('Não deu para copiar. Selecione o texto da nota e copie.');
      }
      return;
    }
    if (d.fichConcluir) {
      await gravarPendente();
      const f = structuredClone(doLivro(a.id) || a.f);
      f.feitos = 5;
      f.concluidoEm = f.concluidoEm || new Date().toISOString();
      // Teses novas viram argumentos (com o texto do Diobert), para aparecerem depois no Mapa.
      const alvos = [...(f.notas || []).filter((n) => n.texto?.trim() && n.argumento?.trim()), ...(f.trechos || []).filter((x) => !x.daNota && x.argumento?.trim())];
      for (const tr of alvos) {
        const tese = tr.argumento.trim();
        let arg = argumentos.find((x) => x.tese.toLowerCase() === tese.toLowerCase());
        if (!arg) {
          arg = await dados.salvar('argumentos', { id: `arg-${slug(tese)}-${crypto.randomUUID().slice(0, 4)}`, tese, criadoEm: new Date().toISOString() });
          argumentos.push(arg);
        }
        tr.argumentoId = arg.id;
      }
      espelhar(f, a.l);
      f.feitos = 5;
      await salvar(f, { exportarJa: true });
      await bib.atualizar(a.id, { etapa: 4 });
      await window.rb?.argUI?.carregar();
      registrar('ui', 'fichamento.concluir', { det: `${comTexto(f).length} notas, ${f.trechos.filter((x) => x.texto).length} trechos` });
      toast('Fichamento concluído e salvo no Drive');
      window.render?.();
    }
  });

  return { carregar, lista, tela, markdown, doLivro, todos: () => fichamentos };
}
