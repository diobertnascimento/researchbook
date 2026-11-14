// Telas da Escrita: lista de textos, preparação (enquadrar, ideia, diagnóstico, estrutura), editor com
// Copilot e material da seção, e "Revisar e exportar" com o .docx.
import { limpar, blocos, medirAutoria, citacoesDiretasSemFonte, contarPalavras, AUTORIAS } from './escrita.js';
import { gerarDocx } from './docx.js';
import { referencia, citacao, autorCurto } from './abnt.js';
import { normalizar } from './contexto.js';
import { ErroIA } from './gemini.js';

/* global I, toast, baixar, S */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icone = (n) => (typeof I !== 'undefined' && I[n]) || '';
const PASSOS = ['Enquadrar', 'Ideia', 'Diagnóstico', 'Estrutura', 'Escrever', 'Revisar e exportar'];
const TIPOS = ['Artigo de disciplina', 'Artigo para periódico', 'Resenha', 'Ensaio', 'Seção de trabalho em equipe', 'Capítulo', 'Outro'];
const PRIMEIRA = 'O que você quer defender, em uma frase?';
const tirarIds = (s) => String(s || '').replace(/\s*\[A\d+\]/g, '');
const slug = (s) => String(s || 'texto').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'texto';
const novoId = () => crypto.randomUUID().slice(0, 8);

export function criarEscritaUI({ escrita, copiloto, ia, bib, drive, registrar }) {
  const est = { secao: {}, aba: 'copilot', ocupado: null, erro: null, versoes: null, alvo: null, revisao: {}, salvando: null, msg: null };
  const redesenhar = () => /^#(escrita|texto)/.test(location.hash) && window.render?.();
  const atual = () => {
    const m = (location.hash || '').match(/^#texto\/(.+)$/);
    return m ? escrita.obter(decodeURIComponent(m[1])) : null;
  };

  /* ---------- Barra de autoria ---------- */
  function barra(a, teto) {
    const pct = (n) => (a.total ? (n / a.total) * 100 : 0);
    return `<div class="barra-wrap" role="img" aria-label="Seu ${Math.round(pct(a.autor))}%, coautoria ${Math.round(pct(a.coautoria))}%, IA ${Math.round(pct(a.ia))}%${teto != null ? `, teto da IA ${teto}%` : ''}"><div class="barra-a"><span class="a-autor" style="width:${pct(a.autor)}%"></span><span class="a-co" style="width:${pct(a.coautoria)}%"></span><span class="a-ia" style="width:${pct(a.ia)}%"></span></div>${teto != null ? `<i class="meta-l" style="left:calc(${100 - teto}% - 1px)" title="Teto da IA: ${teto}%"></i>` : ''}</div>`;
  }
  const legenda = '<div class="leg-a"><span><i class="a-autor"></i>Seu</span><span><i class="a-co"></i>Coautoria: versão do Copilot editada por você</span><span><i class="a-ia"></i>IA</span><span><i style="background:#9A3B26;width:2px;height:12px"></i>Teto da IA</span></div>';

  /* ---------- Lista ---------- */
  function lista() {
    const ts = escrita.todos();
    const topo = `<div class="topo"><div><h1>Textos</h1><p>Artigos, resenhas e trabalhos de disciplina, com o Copilot e exportação para o Word.</p></div><div class="acoes"><button class="btn prim" data-esc-novo>${icone('mais')}Novo texto</button></div></div>`;
    if (!ts.length) return `${topo}<div class="bib-vazia"><h2>Nenhum texto ainda</h2><p>Comece pelo enunciado da atividade. O Copilot entrevista você, confere o que o seu acervo sustenta e propõe uma estrutura. Ele não escreve do zero: propõe versões do que você escreveu.</p><button class="btn prim" data-esc-novo>${icone('mais')}Começar um texto</button></div>`;
    return `${topo}<div class="txt-lista">${ts
      .map((t) => {
        const a = medirAutoria(t);
        const st = t.passo <= 3 ? `Preparando: ${PASSOS[t.passo].toLowerCase()}` : t.passo === 4 ? 'Escrevendo' : 'Em revisão';
        return `<a class="txt-card" href="#texto/${encodeURIComponent(t.id)}"><div><div class="t">${esc(t.titulo)}</div><div class="m">${esc(t.tipo)}${t.projeto ? `, ${esc(t.projeto)}` : ''}${t.limite ? `. ${a.total} de ${t.limite} palavras` : `. ${a.total} palavras`}${t.entrega ? `, entrega ${t.entrega.split('-').reverse().slice(0, 2).join('/')}` : ''}</div></div>
          <div class="et"><span class="st"><i style="background:${t.passo <= 3 ? 'var(--linha-2)' : t.passo === 4 ? 'var(--petroleo)' : '#5C8F4E'}"></i>${st}</span></div>
          <div class="autoria"><span>Participação da IA: <b>${a.participacao}%</b> (teto ${t.teto}%)</span>${barra(a, t.teto)}</div></a>`;
      })
      .join('')}</div><div style="margin-top:14px">${legenda}</div>`;
  }

  /* ---------- Cabeçalho e passos da preparação ---------- */
  function cabecalho(t, sub) {
    return `<a class="voltar" href="#escrita">${icone('voltar')}Textos</a>
      <div class="esc-cab"><div><h1>${esc(t.titulo)}</h1><p>${sub}</p></div><div class="acoes"><button class="btn fant" data-esc-apagar="${esc(t.id)}">Apagar texto</button></div></div>`;
  }
  function trilhaPassos(t) {
    return `<ol class="passos quatro">${PASSOS.slice(0, 4)
      .map((n, i) => `<li><button data-esc-passo="${i}" class="${i === t.passo ? 'on' : i < t.passo ? 'feito' : ''}"><span class="n">${i < t.passo ? '✓' : i + 1}</span><span class="rot">${n}</span></button></li>`)
      .join('')}</ol>`;
  }
  const erroHTML = () => (est.erro ? `<div class="erro-ia" role="alert"><p>${esc(est.erro.mensagem)}</p>${est.erro.acao ? '<a class="btn" href="#ajustes">Abrir Ajustes do Gemini</a>' : ''}</div>` : '');
  const ocupadoHTML = (o) => (est.ocupado === o ? '<p class="mute" role="status">O Copilot está trabalhando…</p>' : '');

  function passo0(t) {
    return `<section class="editor esc-prep">
      <h2>Enquadrar</h2><p class="instr">O que é o texto e quais são as regras. O Copilot usa isto em todas as etapas.</p>
      <div class="campo"><label for="esc-titulo">Título de trabalho</label><input id="esc-titulo" data-esc-campo="titulo" value="${esc(t.titulo)}"></div>
      <div class="linha2">
        <div class="campo"><label for="esc-tipo">Tipo de texto</label><select id="esc-tipo" data-esc-campo="tipo">${TIPOS.map((x) => `<option ${x === t.tipo ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="campo"><label for="esc-projeto">Disciplina ou projeto</label><input id="esc-projeto" data-esc-campo="projeto" value="${esc(t.projeto)}"></div>
      </div>
      <div class="campo"><label for="esc-enunciado">Enunciado da atividade <small>cole o texto</small></label><textarea id="esc-enunciado" data-esc-campo="enunciado" rows="4">${esc(t.enunciado)}</textarea></div>
      <div class="campo"><label for="esc-criterios">Critérios de avaliação</label><textarea id="esc-criterios" data-esc-campo="criterios" rows="2">${esc(t.criterios)}</textarea></div>
      <div class="linha2">
        <div class="campo"><label for="esc-limite">Limite <small>em palavras</small></label><input id="esc-limite" type="number" min="0" inputmode="numeric" data-esc-campo="limite" value="${esc(t.limite ?? '')}"></div>
        <div class="campo"><label for="esc-entrega">Entrega</label><input id="esc-entrega" type="date" data-esc-campo="entrega" value="${esc(t.entrega ?? '')}"></div>
      </div>
      <div class="campo"><label for="esc-teto">Teto de participação da IA <small id="esc-teto-v">${t.teto}%</small></label><input id="esc-teto" type="range" min="0" max="100" step="5" data-esc-campo="teto" value="${t.teto}"><p class="mute" style="font-size:var(--t-xs);margin:6px 0 0">Soma de coautoria e trechos da IA. Ao chegar no teto, o Copilot para de propor versões e a exportação espera você reescrever com as suas palavras.</p></div>
    </section>`;
  }

  function passo1(t) {
    const qs = t.entrevista || [];
    const pendente = qs.find((q) => !q.resposta);
    return `<section class="editor esc-prep">
      <h2>A ideia, nas suas palavras</h2><p class="instr">Uma entrevista curta. Responda como falaria com um colega. O Copilot não reescreve as suas respostas.</p>
      ${qs
        .map(
          (q, i) =>
            `<div class="qa ${q.resposta ? '' : 'pendente'}"><div class="q">${q.copilot ? `${icone('escrita')}<span>${esc(q.pergunta)}${q.por_que ? `<small>${esc(q.por_que)}</small>` : ''}</span>` : esc(q.pergunta)}</div>${
              q.resposta ? `<div class="r"><small>Sua resposta</small>${esc(q.resposta)}</div>` : `<div class="campo" style="margin:10px 0 0"><textarea id="esc-resp" rows="3" aria-label="Sua resposta" placeholder="Responda com as suas palavras"></textarea></div><button class="btn prim" data-esc-responder="${i}">Responder</button>`
            }</div>`,
        )
        .join('')}
      ${!qs.length ? `<div class="qa pendente"><div class="q">${PRIMEIRA}</div><div class="campo" style="margin:10px 0 0"><textarea id="esc-resp" rows="3" aria-label="Sua resposta"></textarea></div><button class="btn prim" data-esc-responder="-1">Responder</button></div>` : ''}
      ${qs.length && !pendente ? `<div class="ia-linha"><button class="btn" data-esc-perguntar ${est.ocupado ? 'disabled' : ''}>Pedir a próxima pergunta</button></div>` : ''}
      ${ocupadoHTML('entrevista')}${erroHTML()}
      ${t.tese ? `<div class="tese-box"><small>Tese de trabalho: sua frase, sem edição</small><p>${esc(t.tese)}</p></div>` : ''}
    </section>`;
  }

  function chipsFontes(fontes, r) {
    const conf = new Set(r?.conferencia?.conferidas || []);
    const itens = new Map((r?.itens || []).map((i) => [i.id, i]));
    return (fontes || [])
      .map((f) => {
        const it = itens.get(f.id);
        return `<span class="chip ${conf.has(f.id) ? '' : 'lac'}" title="${conf.has(f.id) ? 'Trecho conferido no seu acervo' : 'Não conferido: confira antes de usar'}">${conf.has(f.id) ? '' : '⚠ '}${esc(it?.citacao || f.id)}</span>`;
      })
      .join('');
  }

  function passo2(t) {
    const d = t.diagnostico;
    if (!d) return `<section class="editor esc-prep"><h2>Diagnóstico</h2><p class="instr">O Copilot compara a sua tese e as suas respostas com o seu acervo: o que está sustentado, o que está frágil e onde falta fonte.</p><button class="btn prim" data-esc-diagnostico ${est.ocupado || !t.tese ? 'disabled' : ''}>Fazer o diagnóstico</button>${!t.tese ? '<p class="mute">Escreva a tese na etapa Ideia primeiro.</p>' : ''}${ocupadoHTML('diagnostico')}${erroHTML()}</section>`;
    const col = (classe, titulo, cor, sub) => `<section class="diag"><h3><i style="background:${cor}"></i>${titulo}</h3><p>${sub}</p>${
      d.resultado.pontos.filter((p) => p.classe === classe).map((p) => `<div class="diag-item"><b>${esc(p.afirmacao)}</b><span>${esc(tirarIds(p.comentario))}</span><div class="f">${chipsFontes(p.fontes, d)}</div></div>`).join('') || '<p class="mute">Nada aqui.</p>'
    }</section>`;
    return `<div class="diag-grid">${col('sustentado', 'Sustentado pelo acervo', '#5C8F4E', 'Você tem grifos para isto')}${col('fragil', 'Frágil', '#C0702F', 'Uma fonte só, ou sustenta em parte')}${col('lacuna', 'Lacuna', '#9A3B26', 'Nada no acervo. Sugestões para você buscar')}</div>
      ${d.resultado.sugestoes_de_busca?.length ? `<section class="editor" style="margin-top:16px"><h3 style="margin-top:0">Para buscar (fora do seu acervo, não citar ainda)</h3><ul>${d.resultado.sugestoes_de_busca.map((s) => `<li>${esc(s.descricao)}${s.obra_sugerida ? `: <i>${esc(s.obra_sugerida)}</i>` : ''}</li>`).join('')}</ul></section>` : ''}
      ${d.conferencia?.ok === false ? `<div class="conf-ia" role="note"><b>Conferência:</b> algumas fontes não batem com o seu acervo e estão marcadas com ⚠.</div>` : ''}
      <div class="nota-grounding">${icone('tutor')}<span>O Copilot só cita o que está no seu acervo, com página. Sugestões de fora ficam pendentes até você adicionar o texto à biblioteca.</span></div>
      <div class="ia-linha"><button class="btn fant" data-esc-diagnostico ${est.ocupado ? 'disabled' : ''}>Refazer o diagnóstico</button></div>${ocupadoHTML('diagnostico')}${erroHTML()}`;
  }

  function passo3(t) {
    const secs = t.estrutura || [];
    return `<section class="editor esc-prep" style="max-width:1000px">
      <h2>Estrutura</h2><p class="instr">Proposta do Copilot a partir da sua tese e do diagnóstico. Renomeie, reordene ou apague seções; nada é escrito até você aprovar.</p>
      ${secs.length ? `<ol class="estr-ed">${secs
        .map(
          (s, i) => `<li><div class="campos"><input aria-label="Título da seção ${i + 1}" data-esc-estr="${i}" data-k="titulo" value="${esc(s.titulo)}"><input aria-label="Objetivo da seção ${i + 1}" data-esc-estr="${i}" data-k="objetivo" value="${esc(s.objetivo || '')}" placeholder="O que esta seção precisa provar">${s.depende_de_lacuna ? '<span class="chip lac">Falta fonte</span>' : ''}</div>
          <span class="x">~${s.palavras || 0} palavras</span><span class="bts"><button class="btn fant" data-esc-mover="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>Subir</button><button class="btn fant" data-esc-mover="${i}" data-dir="1" ${i === secs.length - 1 ? 'disabled' : ''}>Descer</button><button class="btn fant" data-esc-tirar="${i}">Tirar</button></span></li>`,
        )
        .join('')}</ol>` : `<button class="btn prim" data-esc-estrutura ${est.ocupado ? 'disabled' : ''}>Propor estrutura</button>`}
      ${t.observacaoEstrutura ? `<p class="mute">${esc(t.observacaoEstrutura)}</p>` : ''}
      <div class="ia-linha"><button class="btn" data-esc-add-secao>${icone('mais')}Adicionar seção</button>${secs.length ? `<button class="btn fant" data-esc-estrutura="outra" ${est.ocupado ? 'disabled' : ''}>Pedir outra proposta</button>` : ''}</div>
      ${ocupadoHTML('estrutura')}${erroHTML()}
    </section>`;
  }

  function prep(t) {
    const corpo = [passo0, passo1, passo2, passo3][t.passo](t);
    const prox = t.passo < 3 ? `<button class="btn prim" data-esc-passo="${t.passo + 1}">Próximo: ${PASSOS[t.passo + 1]}</button>` : `<button class="btn prim" data-esc-aprovar ${t.estrutura?.length ? '' : 'disabled'}>Aprovar estrutura e começar a escrever</button>`;
    return `${cabecalho(t, 'Preparação do texto. É feita uma vez; você volta aqui pelo Briefing.')}
      ${trilhaPassos(t)}
      ${t.passo === 0 ? '<p class="setup-intro">O Copilot entrevista você e propõe versões do que você escreveu. Ele não escreve do zero e só cita o que está na sua biblioteca.</p>' : ''}
      ${corpo}
      <div class="esc-nav">${t.passo > 0 ? `<button class="btn fant" data-esc-passo="${t.passo - 1}">Voltar para ${PASSOS[t.passo - 1]}</button>` : `<button class="btn fant" data-esc-pular>Pular a preparação e começar a escrever</button>`}${prox}</div>`;
  }

  /* ---------- Editor ---------- */
  function secaoAtual(t) {
    const i = Math.min(est.secao[t.id] || 0, (t.secoes?.length || 1) - 1);
    return { i, s: t.secoes[i] };
  }

  function painelCopilot(t, s) {
    const a = medirAutoria(t);
    const noTeto = a.participacao >= t.teto;
    const perto = !noTeto && a.participacao >= t.teto * 0.8;
    const chat = (t.chats?.[s.id] || []).slice(-12);
    const v = est.versoes;
    return `<div class="cop-corpo">
      ${noTeto ? `<div class="conf-ia" role="note">Você chegou ao teto de IA deste texto (${t.teto}%). Escreva com as suas palavras para o Copilot voltar a propor versões.</div>` : perto ? `<div class="conf-ia" role="note">A participação da IA está em ${a.participacao}%, perto do teto de ${t.teto}%.</div>` : ''}
      ${chat.length ? '' : `<p class="sub">Converse sobre esta seção: o que ela precisa provar, onde falta fonte. O Copilot pergunta e aponta; não escreve por você.</p>`}
      ${chat
        .map((m) =>
          m.de === 'eu'
            ? `<div class="msg eu">${esc(m.texto)}</div>`
            : `<div class="msg tutor"><span class="av">${icone('escrita')}</span><div><p>${esc(tirarIds(m.texto))}</p>${m.pergunta ? `<p class="pergunta-tutor">${esc(m.pergunta)}</p>` : ''}${m.fontes?.length ? `<div class="f">${m.fontes.map((f) => `<span class="chip ${f.ok ? '' : 'lac'}">${f.ok ? '' : '⚠ '}${esc(f.citacao || f.id)}</span>`).join('')}</div>` : ''}</div></div>`,
        )
        .join('')}
      ${v ? versoesHTML(v) : ''}
      ${ocupadoHTML('copilot')}${erroHTML()}
    </div>
    <div class="atalhos">
      <button class="btn fant" data-esc-versoes ${noTeto || est.ocupado ? 'disabled' : ''}>Propor versões do parágrafo</button>
      <button class="btn fant" data-esc-soa ${est.ocupado ? 'disabled' : ''}>Isso soa como eu?</button>
      ${secaoAtual(t).i < t.secoes.length - 1 ? `<button class="btn fant" data-esc-transicao ${noTeto || est.ocupado ? 'disabled' : ''}>Transição para a próxima seção</button>` : ''}
    </div>
    <div class="tutor-escrever"><textarea id="esc-chat" rows="2" placeholder="Fale com o Copilot sobre esta seção" aria-label="Mensagem ao Copilot"></textarea><button class="btn prim" data-esc-chat ${est.ocupado ? 'disabled' : ''}>Enviar</button></div>`;
  }

  function versoesHTML(v) {
    if (v.tipo === 'soa') {
      return `<div class="versoes-box"><h4>${v.r.json.veredito === 'soa como voce' ? 'Soa como você' : v.r.json.veredito === 'soa em parte' ? 'Soa como você em parte' : 'Não soa como você'}</h4>${(v.r.json.diferencas || []).map((d) => `<div class="versao-op"><p><i>“${esc(d.trecho)}”</i></p><p>${esc(tirarIds(d.diferenca))} ${esc(tirarIds(d.sugestao))}</p></div>`).join('')}<div class="bts"><button class="btn fant" data-esc-fechar-v>Fechar</button></div></div>`;
    }
    if (v.tipo === 'transicao') {
      return `<div class="versoes-box"><h4>Frase de transição</h4><div class="versao-op"><p>${esc(v.r.json.texto)}</p><div class="bts"><button class="btn prim" data-esc-usar-transicao>Usar no fim da seção</button><button class="btn fant" data-esc-fechar-v>Descartar</button></div><small class="mute">Conta como texto da IA.</small></div></div>`;
    }
    const j = v.r.json || {};
    if (j.recusa) return `<div class="versoes-box"><div class="alerta">${esc(j.recusa)}</div><div class="bts"><button class="btn fant" data-esc-fechar-v>Fechar</button></div></div>`;
    const conf = v.r.conferencia;
    return `<div class="versoes-box"><h4>Versões a partir do seu parágrafo</h4>
      ${(j.alertas || []).map((a) => `<div class="alerta">⚠ <span>${esc(tirarIds(a.explicacao))} ${esc(tirarIds(a.como_resolver))}</span></div>`).join('')}
      ${conf?.ok === false ? `<div class="conf-ia">Conferência: ${conf.problemas.length === 1 ? 'uma citação não bate' : `${conf.problemas.length} citações não batem`} com o seu acervo. Confira antes de usar.</div>` : ''}
      ${(j.versoes || [])
        .map(
          (x, i) => `<div class="versao-op"><div class="cab"><b>${x.tipo === 'proxima' ? 'Mais próxima do seu texto' : 'Mais acadêmica'}</b>${(x.mudancas || []).slice(0, 3).map((m) => `<span class="chip">${esc(m)}</span>`).join('')}</div>
          <p>${esc(tirarIds(x.texto))}</p><div class="bts"><button class="btn prim" data-esc-usar="${i}">Usar</button><button class="btn" data-esc-usar="${i}" data-editar>Editar a partir desta</button></div></div>`,
        )
        .join('')}
      <div class="bts"><button class="btn fant" data-esc-fechar-v>Manter o meu</button></div></div>`;
  }

  function painelMaterial(t, s) {
    const texto = `${s.titulo} ${s.objetivo || ''} ${blocos(s.html).map((b) => b.texto).join(' ')} ${t.tese}`;
    const itens = copiloto.acervoPara(texto, 15).itens;
    if (!itens.length) return '<p class="sub">Nenhum grifo na sua biblioteca ainda. Grife os textos no leitor e eles aparecem aqui.</p>';
    return `<p class="sub">Grifos mais ligados a esta seção. Toque para inserir a citação onde está o cursor.</p>${itens
      .map((it) => `<button class="grifo-item" data-esc-citar="${esc(it.leituraId)}|${it.pagina || ''}">${esc(it.texto.length > 180 ? it.texto.slice(0, 180) + '…' : it.texto)}<small>${esc(it.citacao)}</small></button>`)
      .join('')}`;
  }

  function painelVersoes(t) {
    const vs = t.versoes || [];
    return `<p class="sub">Versões guardadas no seu Drive (escrita/…/versoes).</p><button class="btn" data-esc-salvar-versao>Guardar versão agora</button>${
      vs.length ? `<ul class="vers-lista">${vs.map((v) => `<li><span>${new Date(v.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}<small>${v.palavras} palavras${v.motivo === 'antes de restaurar' ? ', antes de restaurar' : ''}</small></span><button class="btn fant" data-esc-restaurar="${esc(v.arquivo)}">Restaurar</button></li>`).join('')}</ul>` : '<p class="mute">Nenhuma versão ainda.</p>'
    }`;
  }

  function editor(t) {
    const { i, s } = secaoAtual(t);
    const a = medirAutoria(t);
    const marcas = typeof S !== 'undefined' && S.marcas;
    return `<a class="voltar" href="#escrita">${icone('voltar')}Textos</a>
      <div class="esc-cab"><div><h1>${esc(t.titulo)}</h1><p>${esc(t.tipo)}${t.projeto ? `, ${esc(t.projeto)}` : ''}${t.entrega ? `. Entrega em ${t.entrega.split('-').reverse().join('/')}` : ''} <span class="salvo" id="esc-salvo" style="display:inline-flex;padding:0"><i></i>${est.salvando || 'Salvo'}</span></p></div>
        <div class="acoes"><button class="btn" data-esc-passo="0">Briefing</button><button class="btn prim" data-esc-passo="5">Revisar e exportar</button></div></div>
      <div class="esc-grid real" data-texto="${esc(t.id)}">
        <aside class="lat-esc"><h4 style="font-size:var(--t-s);font-weight:500;margin:0 0 8px">Seções</h4>
          <div class="secoes">${t.secoes.map((x, k) => `<button data-esc-secao="${k}" class="${k === i ? 'on' : ''}"><i class="${contarPalavras(blocos(x.html).map((b) => b.texto).join(' ')) ? 'feita' : ''}"></i>${esc(x.titulo)}</button>`).join('')}</div>
          <button class="btn fant" data-esc-nova-secao style="margin-top:10px">${icone('mais')}Seção</button>
        </aside>
        <section class="folha ${marcas ? 'marcas' : ''}">
          <div class="folha-barra">
            <span id="esc-palavras">${a.total}${t.limite ? ` de ~${t.limite}` : ''} palavras</span>
            <span class="aut-mini" id="esc-aut">IA ${a.participacao}% ${barra(a, t.teto)}</span>
            <label><input type="checkbox" data-marcas ${marcas ? 'checked' : ''}>Marcadores de autoria</label>
          </div>
          <div class="ferramentas" role="toolbar" aria-label="Formatação">
            ${[['bold', 'Negrito'], ['italic', 'Itálico'], ['underline', 'Sublinhado'], ['h3', 'Subtítulo'], ['lista', 'Lista'], ['blockquote', 'Citação longa'], ['undo', 'Desfazer'], ['redo', 'Refazer']].map(([c, n]) => `<button class="btn fant" data-esc-fmt="${c}" aria-label="${n}">${n}</button>`).join('')}
          </div>
          <div class="folha-corpo">
            <input class="esc-sec-tit" aria-label="Título da seção" data-esc-sec-titulo value="${esc(s.titulo)}">
            ${s.objetivo ? `<p class="mute esc-obj">${esc(s.objetivo)}</p>` : ''}
            <div id="esc-corpo" class="esc-corpo" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Texto da seção ${esc(s.titulo)}" spellcheck="true" lang="pt-BR">${s.html || '<p data-autoria="autor"><br></p>'}</div>
          </div>
        </section>
        <aside class="painel-lat esc-painel">
          <div class="abas-lat" role="tablist">${[['copilot', 'Copilot'], ['material', 'Material'], ['versoes', 'Versões']].map(([k, n]) => `<button role="tab" data-esc-aba="${k}" class="${est.aba === k ? 'on' : ''}" aria-selected="${est.aba === k}">${n}</button>`).join('')}</div>
          ${est.aba === 'material' ? painelMaterial(t, s) : est.aba === 'versoes' ? painelVersoes(t) : painelCopilot(t, s)}
        </aside>
      </div>
      <div style="margin-top:12px">${legenda}</div>`;
  }

  /* ---------- Revisar e exportar ---------- */
  function revisar(t) {
    const a = medirAutoria(t);
    const refs = escrita.referencias(t);
    const diretas = citacoesDiretasSemFonte(t, bib.todosGrifos(), normalizar);
    const vazias = (t.secoes || []).filter((s) => !contarPalavras(blocos(s.html).map((b) => b.texto).join(' ')));
    const acima = a.participacao > t.teto;
    const checks = [
      [acima ? 'bl' : 'ok', 'Participação da IA', `${a.participacao}%, ${acima ? 'acima' : 'dentro'} do teto de ${t.teto}%.${acima ? ' Reescreva trechos com as suas palavras para exportar.' : ''}`],
      [!t.limite ? 'obs' : a.total > t.limite ? 'at' : 'ok', 'Extensão', t.limite ? `${a.total} de ${t.limite} palavras.` : `${a.total} palavras. Sem limite no briefing.`],
      [diretas.length ? 'at' : 'ok', 'Citações diretas', diretas.length ? `${diretas.length} entre aspas não estão nos seus grifos: “${esc(diretas[0].slice(0, 80))}”${diretas.length > 1 ? '…' : ''}` : 'Todas as citações entre aspas estão nos seus grifos.'],
      [refs.length ? 'ok' : 'at', 'Referências', refs.length ? `${refs.length} ${refs.length === 1 ? 'obra citada' : 'obras citadas'}, com referência ABNT gerada da biblioteca.` : 'Nenhuma obra da biblioteca reconhecida no texto.'],
      [vazias.length ? 'at' : 'ok', 'Seções', vazias.length ? `${vazias.length} ${vazias.length === 1 ? 'seção vazia' : 'seções vazias'}: ${vazias.map((s) => esc(s.titulo)).join(', ')}.` : 'Todas as seções têm texto.'],
    ];
    const rv = est.revisao[t.id];
    const ic = { ok: '✓', at: '!', bl: '!', obs: 'i' };
    return `<button class="voltar" style="background:none;border:0;padding:0;cursor:pointer" data-esc-passo="4">${icone('voltar')}Voltar ao texto</button>
      <div class="esc-cab"><div><h1>${esc(t.titulo)}</h1><p>Checagem antes de exportar. Nada aqui altera o texto sem você.</p></div></div>
      <div class="proj-grid">
        <section class="editor"><h2>Revisar e exportar</h2>
          <div class="revs">${checks.map(([c, b, sp]) => `<div class="rev-it"><span class="ic ${c === 'bl' ? 'at' : c}">${ic[c]}</span><div><b>${b}</b><span>${sp}</span></div><span></span></div>`).join('')}</div>
          <h3>Revisão do Copilot</h3>
          ${rv ? `<div class="revs">${(rv.json.verificacoes || []).map((v) => `<div class="rev-it"><span class="ic ${v.situacao === 'ok' ? 'ok' : 'at'}">${v.situacao === 'ok' ? '✓' : '!'}</span><div><b>${esc({ afirmacoes_sem_fonte: 'Afirmações sem fonte', fidelidade: 'Fidelidade às fontes', coerencia: 'Coerência com a tese', estrutura: 'Estrutura', clareza: 'Clareza' }[v.item] || v.item)}</b><span>${esc(tirarIds(v.resumo))}</span></div><span></span></div>`).join('')}
            ${(rv.json.problemas || []).map((p) => `<div class="rev-it"><span class="ic ${p.gravidade === 'baixa' ? 'obs' : 'at'}">${p.gravidade === 'baixa' ? 'i' : '!'}</span><div><b>${esc(p.problema)}</b><span>${esc(p.secao)}: “${esc(p.trecho)}”. ${esc(tirarIds(p.como_resolver))}</span></div><button class="btn fant" data-esc-ver-trecho="${esc(p.trecho)}">Ver trecho</button></div>`).join('')}</div>`
            : `<p class="instr">O Copilot lê o texto inteiro e aponta afirmações sem fonte, paráfrases infiéis, problemas de coerência, estrutura e clareza. Não reescreve nada.</p><button class="btn" data-esc-revisao ${est.ocupado ? 'disabled' : ''}>Pedir revisão do Copilot</button>`}
          ${ocupadoHTML('revisao')}${erroHTML()}
        </section>
        <aside class="lado">
          <section class="bloco cta-trilha"><h3>Exportar</h3><p>Word com formatação ABNT. Os marcadores de autoria ficam aqui; o arquivo sai limpo. Uma cópia vai para o seu Drive.</p><button class="btn ${acima ? '' : 'prim'}" data-esc-docx ${acima ? 'disabled' : ''}>Exportar para Word (.docx)</button>${acima ? '<p class="mute">Disponível quando a participação da IA ficar dentro do teto.</p>' : ''}</section>
          <section class="bloco"><h3>Referências</h3>${refs.length ? `<ul class="refs-abnt">${refs.map((r) => `<li>${referencia(bib.obter(r.id))}</li>`).join('')}</ul>` : '<p class="mute">Nenhuma ainda.</p>'}</section>
          <section class="bloco"><h3>Autoria deste texto</h3>${barra(a, t.teto)}<div style="margin-top:12px">${legenda}</div></section>
        </aside>
      </div>`;
  }

  function tela(id) {
    const t = escrita.obter(id);
    if (!t) return '<div class="topo"><div><h1>Texto não encontrado</h1><p><a href="#escrita">Voltar aos textos</a></p></div></div>';
    if (t.passo <= 3) return prep(t);
    if (t.passo === 4) return editor(t);
    return revisar(t);
  }

  /* ---------- Ações ---------- */
  async function guardar(t, mudancas, { redesenha = false } = {}) {
    const novo = await escrita.salvar({ ...t, ...mudancas });
    if (redesenha) redesenhar();
    return novo;
  }

  function lerCorpo() {
    const corpo = document.getElementById('esc-corpo');
    if (!corpo) return null;
    // O navegador copia os atributos do parágrafo anterior ao criar um novo (Enter): o repetido vira um bloco seu.
    const vistos = new Set();
    for (const b of corpo.querySelectorAll('p, h3, li, blockquote')) {
      if (!b.dataset.pid || vistos.has(b.dataset.pid)) {
        b.dataset.pid = novoId();
        b.dataset.autoria = 'autor';
        delete b.dataset.ia;
      }
      vistos.add(b.dataset.pid);
      if (!b.dataset.autoria) b.dataset.autoria = 'autor';
    }
    return limpar(corpo.innerHTML);
  }

  // O texto da seção é lido da tela a cada mudança, para não se perder se o autor sair antes do salvamento.
  let salvarDepois = null;
  let pendenteCorpo = null;
  function lerParaSalvar() {
    const corpo = document.getElementById('esc-corpo');
    const id = corpo?.closest('[data-texto]')?.dataset.texto;
    const t = id && escrita.obter(id);
    if (!t) return;
    pendenteCorpo = { id, i: secaoAtual(t).i, html: lerCorpo() };
  }
  function agendarSalvar() {
    est.salvando = 'Salvando…';
    const st = document.getElementById('esc-salvo');
    if (st) st.lastChild.textContent = 'Salvando…';
    lerParaSalvar();
    clearTimeout(salvarDepois);
    salvarDepois = setTimeout(salvarCorpo, 800);
  }
  async function salvarCorpo() {
    clearTimeout(salvarDepois);
    const corpo = document.getElementById('esc-corpo');
    const naTela = corpo?.closest('[data-texto]')?.dataset.texto;
    // Se a tela já mudou para outro texto, salva o que foi lido antes da troca.
    if (corpo && (!pendenteCorpo || pendenteCorpo.id === naTela)) lerParaSalvar();
    const p = pendenteCorpo;
    pendenteCorpo = null;
    const t = p && escrita.obter(p.id);
    if (!t || p.html == null || !t.secoes?.[p.i]) return;
    if (t.secoes[p.i].html === p.html) {
      est.salvando = null;
    } else {
      await guardar(t, { secoes: t.secoes.map((s, k) => (k === p.i ? { ...s, html: p.html } : s)) });
      est.salvando = null;
    }
    const novo = escrita.obter(p.id);
    const a = medirAutoria(novo);
    const st = document.getElementById('esc-salvo');
    if (st) st.lastChild.textContent = 'Salvo';
    const el = document.getElementById('esc-palavras');
    if (el) el.textContent = `${a.total}${novo.limite ? ` de ~${novo.limite}` : ''} palavras`;
    const au = document.getElementById('esc-aut');
    if (au) au.innerHTML = `IA ${a.participacao}% ${barra(a, novo.teto)}`;
  }

  /** O bloco onde está o cursor (ou o último que teve foco). */
  function blocoAlvo() {
    const sel = getSelection();
    const no = sel?.anchorNode ? (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement) : null;
    const b = no?.closest?.('#esc-corpo p, #esc-corpo li, #esc-corpo blockquote, #esc-corpo h3');
    if (b) est.alvo = b.dataset.pid || (b.dataset.pid = novoId());
    return est.alvo ? document.querySelector(`#esc-corpo [data-pid="${est.alvo}"]`) : null;
  }

  function mostrarErro(err) {
    const acao = err instanceof ErroIA && ['sem-acesso', 'permissao', 'projeto', 'trancado', 'chave', 'api', 'negado', 'sessao'].includes(err.codigo);
    est.erro = { mensagem: err instanceof ErroIA ? err.message : 'Algo deu errado ao falar com o Gemini. O problema ficou registrado; tente de novo.', acao };
    if (!(err instanceof ErroIA)) registrar('erro', 'copilot.falhou', { det: err.message, st: 'erro' });
  }
  /** No editor, só o painel lateral é redesenhado: o texto e o cursor do autor ficam onde estão. */
  function redesenharPainel() {
    const painel = document.querySelector('.esc-painel');
    const t = atual();
    if (!painel || !t || t.passo !== 4) return redesenhar();
    const { s } = secaoAtual(t);
    const abas = painel.querySelector('.abas-lat').outerHTML;
    painel.innerHTML = abas + (est.aba === 'material' ? painelMaterial(t, s) : est.aba === 'versoes' ? painelVersoes(t) : painelCopilot(t, s));
  }
  async function comCopilot(nome, fn) {
    if (est.ocupado) return;
    est.ocupado = nome;
    est.erro = null;
    redesenharPainel();
    try {
      await fn();
    } catch (err) {
      mostrarErro(err);
    } finally {
      est.ocupado = null;
      redesenharPainel();
    }
  }

  function inserirNoCursor(html) {
    const corpo = document.getElementById('esc-corpo');
    if (!corpo) return;
    corpo.focus();
    const sel = getSelection();
    if (!sel.rangeCount || !corpo.contains(sel.anchorNode)) {
      const r = document.createRange();
      r.selectNodeContents(corpo.lastElementChild || corpo);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    document.execCommand('insertHTML', false, html);
    agendarSalvar();
  }

  // Campos salvam sozinhos depois de uma pausa. Antes de qualquer ação, o que estava pendente é salvo
  // (descarregar), para a ação partir do texto como está na tela.
  const pendentes = new Map();
  function adiar(chave, fn, ms) {
    clearTimeout(pendentes.get(chave)?.timer);
    const id = atual()?.id;
    const p = { fn: () => (escrita.obter(id) ? fn(escrita.obter(id)) : null), timer: setTimeout(() => descarregar(chave), ms) };
    pendentes.set(chave, p);
  }
  async function descarregar(so) {
    for (const [chave, p] of [...pendentes]) {
      if (so && chave !== so) continue;
      clearTimeout(p.timer);
      pendentes.delete(chave);
      await p.fn();
    }
  }

  document.addEventListener('input', (e) => {
    if (e.target.id === 'esc-corpo') return agendarSalvar();
    const campo = e.target.dataset?.escCampo;
    if (campo) {
      if (!atual()) return;
      let v = e.target.value;
      if (campo === 'limite') v = v ? Number(v) : null;
      if (campo === 'teto') {
        v = Number(v);
        const tv = document.getElementById('esc-teto-v');
        if (tv) tv.textContent = `${v}%`;
      }
      if (campo === 'entrega') v = v || null;
      if (campo === 'titulo') document.querySelector('.esc-cab h1').textContent = v || 'Texto sem título';
      adiar(`campo:${campo}`, (t) => guardar(t, { [campo]: v }), 500);
      return;
    }
    if (e.target.dataset?.escEstr !== undefined) {
      const k = e.target.dataset.k;
      const i = Number(e.target.dataset.escEstr);
      const valor = e.target.value;
      adiar(`estr:${i}:${k}`, (t) => {
        return guardar(t, { estrutura: t.estrutura.map((s, j) => (j === i ? { ...s, [k]: valor } : s)) });
      }, 400);
      return;
    }
    if (e.target.dataset?.escSecTitulo !== undefined) {
      const { i } = secaoAtual(atual());
      const valor = e.target.value;
      adiar(`sec:${i}`, (tt) => {
        return guardar(tt, { secoes: tt.secoes.map((s, k) => (k === i ? { ...s, titulo: valor || 'Sem título' } : s)) });
      }, 500);
    }
  });
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && salvarCorpo());
  window.addEventListener('hashchange', () => {
    descarregar();
    salvarCorpo();
  });
  document.addEventListener('mousedown', (e) => {
    // A barra de formatação não tira o cursor do texto.
    if (e.target.closest('[data-esc-fmt]')) e.preventDefault();
  });
  document.addEventListener('paste', (e) => {
    if (!e.target.closest?.('#esc-corpo')) return;
    // Cola só o texto: formatação de fora (Word, sites) não entra no texto.
    e.preventDefault();
    const txt = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, txt);
  });
  document.addEventListener('focusout', (e) => {
    if (e.target.id === 'esc-corpo') {
      blocoAlvo();
      salvarCorpo();
    }
  });
  document.addEventListener('selectionchange', () => {
    if (document.activeElement?.id === 'esc-corpo') blocoAlvo();
  });

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-esc-novo],[data-esc-apagar],[data-esc-passo],[data-esc-pular],[data-esc-responder],[data-esc-perguntar],[data-esc-diagnostico],[data-esc-estrutura],[data-esc-mover],[data-esc-tirar],[data-esc-add-secao],[data-esc-aprovar],[data-esc-secao],[data-esc-nova-secao],[data-esc-fmt],[data-esc-aba],[data-esc-chat],[data-esc-versoes],[data-esc-usar],[data-esc-fechar-v],[data-esc-soa],[data-esc-transicao],[data-esc-usar-transicao],[data-esc-citar],[data-esc-salvar-versao],[data-esc-restaurar],[data-esc-revisao],[data-esc-docx],[data-esc-ver-trecho]');
    if (!b) return;
    if (b.dataset.escFmt) e.preventDefault();
    await descarregar();
    if (b.dataset.escNovo !== undefined) {
      const t = await escrita.novo();
      location.hash = `#texto/${encodeURIComponent(t.id)}`;
      return;
    }
    const t = atual();
    if (!t) return;
    const d = b.dataset;
    if (d.escApagar) {
      const antes = await escrita.apagar(d.escApagar);
      location.hash = '#escrita';
      setTimeout(() => toast('Texto apagado', async () => {
        await escrita.salvar({ ...antes, apagado: false });
        await escrita.carregar();
        location.hash = `#texto/${encodeURIComponent(antes.id)}`;
      }), 50);
      return;
    }
    if (d.escPasso !== undefined) {
      if (document.getElementById('esc-corpo')) await salvarCorpo();
      let p = Number(d.escPasso);
      if (p === 4 && !t.secoes?.length) p = Math.min(t.passo, 3);
      est.erro = null;
      est.versoes = null;
      await guardar(atual(), { passo: p }, { redesenha: true });
      scrollTo({ top: 0 });
      return;
    }
    if (d.escPular !== undefined) {
      await guardar(t, { passo: 4, secoes: t.secoes?.length ? t.secoes : [{ id: novoId(), titulo: 'Texto', objetivo: '', html: '' }] }, { redesenha: true });
      registrar('ui', 'texto.pular_preparacao');
      return;
    }
    if (d.escResponder !== undefined) {
      const resp = document.getElementById('esc-resp')?.value.trim();
      if (!resp) return document.getElementById('esc-resp')?.focus();
      const i = Number(d.escResponder);
      let entrevista = [...(t.entrevista || [])];
      let tese = t.tese;
      if (i < 0) {
        entrevista = [{ pergunta: PRIMEIRA, resposta: resp }];
        tese = resp;
      } else entrevista[i] = { ...entrevista[i], resposta: resp };
      const novo = await guardar(t, { entrevista, tese }, { redesenha: true });
      if (entrevista.length < 6) await comCopilot('entrevista', async () => pedirPergunta(novo));
      return;
    }
    if (d.escPerguntar !== undefined) return comCopilot('entrevista', async () => pedirPergunta(t));
    if (d.escDiagnostico !== undefined) {
      return comCopilot('diagnostico', async () => {
        const r = await copiloto.diagnostico(t);
        await guardar(atual(), { diagnostico: { resultado: r.json, conferencia: r.conferencia, itens: r.itens, em: new Date().toISOString() } });
      });
    }
    if (d.escEstrutura !== undefined) {
      return comCopilot('estrutura', async () => {
        const r = await copiloto.estrutura(t, d.escEstrutura === 'outra');
        const itens = new Map(r.itens.map((x) => [x.id, x]));
        await guardar(atual(), { estrutura: (r.json.secoes || []).map((s) => ({ ...s, id: novoId(), fontes: (s.fontes || []).map((f) => itens.get(f)?.citacao || f) })), observacaoEstrutura: r.json.observacao || '' });
      });
    }
    if (d.escMover !== undefined) {
      const i = Number(d.escMover);
      const j = i + Number(d.dir);
      const estrutura = [...t.estrutura];
      [estrutura[i], estrutura[j]] = [estrutura[j], estrutura[i]];
      return guardar(t, { estrutura }, { redesenha: true });
    }
    if (d.escTirar !== undefined) return guardar(t, { estrutura: t.estrutura.filter((_, k) => k !== Number(d.escTirar)) }, { redesenha: true });
    if (d.escAddSecao !== undefined) return guardar(t, { estrutura: [...(t.estrutura || []), { id: novoId(), titulo: 'Nova seção', objetivo: '', palavras: 0, fontes: [] }] }, { redesenha: true });
    if (d.escAprovar !== undefined) {
      const existentes = new Map((t.secoes || []).map((s) => [s.id, s]));
      const secoes = t.estrutura.map((s) => ({ id: s.id, titulo: s.titulo, objetivo: s.objetivo, html: existentes.get(s.id)?.html || '' }));
      for (const s of t.secoes || []) if (!secoes.some((x) => x.id === s.id) && blocos(s.html).length) secoes.push(s);
      est.secao[t.id] = 0;
      await guardar(t, { secoes, passo: 4 }, { redesenha: true });
      registrar('ui', 'texto.aprovar_estrutura', { det: `${secoes.length} seções` });
      return;
    }
    if (d.escSecao !== undefined) {
      await salvarCorpo();
      est.secao[t.id] = Number(d.escSecao);
      est.versoes = null;
      return redesenhar();
    }
    if (d.escNovaSecao !== undefined) {
      await salvarCorpo();
      const tt = atual();
      est.secao[t.id] = tt.secoes.length;
      return guardar(tt, { secoes: [...tt.secoes, { id: novoId(), titulo: 'Nova seção', objetivo: '', html: '' }] }, { redesenha: true });
    }
    if (d.escFmt) {
      const corpo = document.getElementById('esc-corpo');
      corpo?.focus();
      const atualBloco = blocoAlvo();
      const c = d.escFmt;
      if (c === 'h3' || c === 'blockquote') document.execCommand('formatBlock', false, atualBloco?.tagName === c.toUpperCase() ? 'p' : c);
      else if (c === 'lista') document.execCommand('insertUnorderedList');
      else document.execCommand(c);
      return agendarSalvar();
    }
    if (d.escAba) {
      await salvarCorpo();
      est.aba = d.escAba;
      return redesenhar();
    }
    if (d.escChat !== undefined) {
      const msg = document.getElementById('esc-chat')?.value.trim();
      if (!msg) return;
      await salvarCorpo();
      return comCopilot('copilot', async () => {
        const tt = atual();
        const { s } = secaoAtual(tt);
        const anteriores = [];
        const hist = tt.chats?.[s.id] || [];
        for (let k = 0; k < hist.length - 1; k++) if (hist[k].de === 'eu' && hist[k + 1]?.de === 'ia') anteriores.push({ autor: hist[k].texto, ia: [hist[k + 1].texto, hist[k + 1].pergunta].filter(Boolean).join('\n') });
        const r = await copiloto.conversa(tt, s, msg, anteriores.slice(-4));
        const conf = new Set(r.conferencia.conferidas);
        const itens = new Map(r.itens.map((x) => [x.id, x]));
        const resposta = { de: 'ia', texto: r.json.recusa || r.json.comentario, pergunta: r.json.pergunta, fontes: (r.json.fontes || []).map((f) => ({ id: f.id, ok: conf.has(f.id), citacao: itens.get(f.id)?.citacao })) };
        const chats = { ...(atual().chats || {}), [s.id]: [...hist, { de: 'eu', texto: msg }, resposta].slice(-20) };
        await guardar(atual(), { chats });
      });
    }
    if (d.escVersoes !== undefined) {
      await salvarCorpo();
      const alvo = blocoAlvo();
      const texto = alvo?.textContent.trim();
      if (!texto) return toast('Ponha o cursor no parágrafo que você quer trabalhar.');
      return comCopilot('copilot', async () => {
        const r = await copiloto.versoes(atual(), texto);
        est.versoes = { tipo: 'versoes', r, pid: alvo.dataset.pid };
      });
    }
    if (d.escSoa !== undefined) {
      await salvarCorpo();
      const texto = blocoAlvo()?.textContent.trim();
      if (!texto) return toast('Ponha o cursor no parágrafo que você quer conferir.');
      return comCopilot('copilot', async () => {
        est.versoes = { tipo: 'soa', r: await copiloto.soaComoEu(atual(), texto) };
      });
    }
    if (d.escTransicao !== undefined) {
      await salvarCorpo();
      return comCopilot('copilot', async () => {
        const tt = atual();
        const { i } = secaoAtual(tt);
        est.versoes = { tipo: 'transicao', r: await copiloto.transicao(tt, tt.secoes[i], tt.secoes[i + 1]) };
      });
    }
    if (d.escFecharV !== undefined) {
      est.versoes = null;
      registrar('ui', 'copilot.manter_o_meu');
      return redesenharPainel();
    }
    if (d.escUsar !== undefined) {
      const v = est.versoes;
      const x = v?.r.json.versoes?.[Number(d.escUsar)];
      const alvo = v && document.querySelector(`#esc-corpo [data-pid="${v.pid}"]`);
      if (!x || !alvo) return toast('O parágrafo mudou de lugar. Peça as versões de novo.');
      const limpo = tirarIds(x.texto);
      alvo.textContent = limpo;
      alvo.dataset.autoria = 'coautoria';
      alvo.dataset.ia = limpo;
      est.versoes = null;
      await salvarCorpo();
      registrar('ui', 'copilot.usar_versao', { det: x.tipo });
      redesenharPainel();
      toast(d.editar !== undefined ? 'Versão aplicada. Quanto mais você mudar, mais o trecho conta como seu.' : 'Versão aplicada. O parágrafo conta como coautoria.');
      if (d.editar !== undefined) setTimeout(() => document.querySelector(`#esc-corpo [data-pid="${v.pid}"]`)?.focus(), 50);
      return;
    }
    if (d.escUsarTransicao !== undefined) {
      const txt = est.versoes?.r.json.texto;
      const corpo = document.getElementById('esc-corpo');
      if (!txt || !corpo) return;
      const p = document.createElement('p');
      p.dataset.pid = novoId();
      p.dataset.autoria = 'ia';
      p.dataset.ia = txt;
      p.textContent = txt;
      corpo.appendChild(p);
      est.versoes = null;
      await salvarCorpo();
      registrar('ui', 'copilot.usar_transicao');
      return redesenharPainel();
    }
    if (d.escCitar) {
      const [lid, pag] = d.escCitar.split('|');
      const l = bib.obter(lid);
      if (!l) return;
      inserirNoCursor(`<span class="cit" data-obra="${esc(l.id)}" data-pag="${esc(pag)}">${esc(citacao(l, pag ? Number(pag) : undefined))}</span>&nbsp;`);
      registrar('ui', 'texto.inserir_citacao');
      return toast(`Citação inserida: ${citacao(l, pag ? Number(pag) : undefined)}`);
    }
    if (d.escSalvarVersao !== undefined) {
      await salvarCorpo();
      try {
        await escrita.salvarVersao(t.id);
        toast('Versão guardada no seu Drive');
      } catch (err) {
        toast(err.message);
      }
      return redesenharPainel();
    }
    if (d.escRestaurar) {
      try {
        await escrita.restaurarVersao(t.id, d.escRestaurar);
        toast('Versão restaurada. A anterior foi guardada antes.');
      } catch (err) {
        toast(err.message);
      }
      return redesenhar();
    }
    if (d.escRevisao !== undefined) {
      return comCopilot('revisao', async () => {
        est.revisao[t.id] = await copiloto.revisao(t, escrita.referencias(t));
      });
    }
    if (d.escVerTrecho) {
      const alvo = normalizar(d.escVerTrecho).slice(0, 60);
      const k = t.secoes.findIndex((s) => normalizar(blocos(s.html).map((x) => x.texto).join(' ')).includes(alvo));
      est.secao[t.id] = Math.max(0, k);
      await guardar(t, { passo: 4 }, { redesenha: true });
      return;
    }
    if (d.escDocx !== undefined) {
      const refs = escrita.referencias(t).map((r) => referencia(bib.obter(r.id)));
      const blob = gerarDocx(t, refs);
      const nome = `${slug(t.titulo)}.docx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      let noDrive = false;
      const dr = drive();
      if (dr) {
        try {
          await dr.enviarArquivo(`escrita/${t.id}/${nome}`, blob, blob.type);
          noDrive = true;
        } catch (err) {
          registrar('erro', 'texto.docx_drive_falhou', { det: err.message, st: 'aviso' });
        }
      }
      registrar('ui', 'texto.exportar_docx', { det: `${medirAutoria(t).total} palavras, ${refs.length} referências${noDrive ? ', cópia no Drive' : ''}` });
      toast(noDrive ? 'Word exportado. Cópia no seu Drive.' : 'Word exportado.');
    }
  });

  async function pedirPergunta(t) {
    const r = await copiloto.entrevista(t);
    const tt = atual();
    if (r.json.recusa) return;
    await guardar(tt, { entrevista: [...(tt.entrevista || []), { pergunta: r.json.pergunta, por_que: r.json.por_que, copilot: true, resposta: '' }] });
  }

  return { lista, tela };
}
