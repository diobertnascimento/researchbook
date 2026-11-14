// Tela Você > Overview do autor, com dados reais.
import { ErroIA } from './gemini.js';

/* global I, toast */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icone = (n) => (typeof I !== 'undefined' && I[n]) || '';
const ERROS_DE_CONFIG = ['sem-acesso', 'permissao', 'projeto', 'trancado', 'chave', 'api', 'negado', 'sessao'];

export function criarOverviewUI({ ov, registrar }) {
  const est = { textos: null, ocupado: false, erro: null, carregando: false };
  const redesenhar = () => /^#autor/.test(location.hash) && window.render?.();
  const recarregar = async () => {
    est.textos = await ov.textos();
    redesenhar();
  };

  function barra(a, teto) {
    const pct = (n) => (a.total ? (n / a.total) * 100 : 0);
    return `<div class="barra-wrap"><div class="barra-a"><span class="a-autor" style="width:${pct(a.autor)}%"></span><span class="a-co" style="width:${pct(a.coautoria)}%"></span><span class="a-ia" style="width:${pct(a.ia)}%"></span></div>${teto != null ? `<i class="meta-l" style="left:calc(${100 - teto}% - 1px)"></i>` : ''}</div>`;
  }

  function tela() {
    if (!est.textos && !est.carregando) {
      est.carregando = true;
      ov.carregarDoDrive().then(recarregar).finally(() => (est.carregando = false));
    }
    const o = ov.atual();
    const ts = est.textos || [];
    const escritos = ov.textosDaEscrita();
    const corpus = ov.corpus();
    const palavras = ts.reduce((n, t) => n + t.palavras, 0);
    const topo = `<div class="topo"><div><h1>Overview do autor</h1><p>Como você escreve, a partir dos seus textos. Só os trechos seus entram: coautoria e texto da IA ficam de fora. O Copilot pode usar o resumo para proteger a sua voz.</p></div>
      <div class="acoes"><label class="btn">${icone('upload')}Adicionar textos meus<input type="file" accept=".docx,.txt,.md,text/plain,text/markdown" multiple data-ov-arquivo hidden></label><button class="btn prim" data-ov-atualizar ${est.ocupado || !ts.length ? 'disabled' : ''}>${est.ocupado ? 'Analisando…' : o ? 'Atualizar o retrato' : 'Fazer o retrato'}</button></div></div>`;
    const erro = est.erro ? `<div class="erro-ia" role="alert" style="margin-bottom:16px"><p>${esc(est.erro.message)}</p>${est.erro instanceof ErroIA && ERROS_DE_CONFIG.includes(est.erro.codigo) ? '<a class="btn" href="#ajustes">Abrir Ajustes do Gemini</a>' : ''}</div>` : '';
    const corpusHTML = `<section class="bloco aut-corpus"><h3>Textos analisados</h3>
      ${escritos.length || corpus.arquivos.length ? `<ul class="corpus-lista">${[
        ...ov.textosDaEscrita().map((t) => ({ id: t.id, titulo: t.titulo, palavras: t.palavras, origem: 'escrita', fora: false })),
        ...corpus.excluir.map((id) => ({ id, origem: 'escrita', fora: true })).filter((x) => window.rb?.escrita?.obter(x.id)).map((x) => ({ ...x, titulo: window.rb.escrita.obter(x.id).titulo, palavras: 0 })),
        ...corpus.arquivos.map((a) => ({ id: a.id, titulo: a.titulo, palavras: a.palavras, origem: 'arquivo', fora: !!a.excluido })),
      ].map((t) => `<li class="${t.fora ? 'fora' : ''}"><label class="check" style="margin:0"><input type="checkbox" data-ov-alternar="${esc(t.id)}" data-origem="${t.origem}" ${t.fora ? '' : 'checked'}><span>${esc(t.titulo)}<small>${t.origem === 'escrita' ? 'Escrita' : 'Enviado'}</small></span></label><span>${t.fora ? 'fora' : `${t.palavras.toLocaleString('pt-BR')} palavras`}</span></li>`).join('')}</ul>` : '<p class="mute" style="font-size:var(--t-s)">Nenhum texto ainda. Escreva na Escrita ou envie textos seus (.docx, .txt, .md).</p>'}
      <p class="mute-2" style="font-size:var(--t-xs);margin:10px 0 0">${ts.length} ${ts.length === 1 ? 'texto' : 'textos'}, ${palavras.toLocaleString('pt-BR')} palavras.</p></section>`;
    const part = ov.participacao();
    const partHTML = part.length ? `<section class="bloco aut-evol"><h3>Participação da IA por texto</h3><div class="evol">${part.map(({ t, a }) => `<div><span>${esc(t.titulo.length > 38 ? t.titulo.slice(0, 38) + '…' : t.titulo)} <small class="mute">${a.participacao}%</small></span>${barra(a, t.teto)}</div>`).join('')}</div></section>` : '';
    if (!o) return `${topo}${erro}<div class="aut-grid">${corpusHTML}<section class="bloco aut-estilo"><h3>Seu estilo, em palavras</h3><p>${ts.length ? 'Toque em "Fazer o retrato". O app calcula as métricas e a IA descreve os traços da sua escrita, com exemplos tirados dos seus textos.' : 'Assim que houver textos seus, o retrato aparece aqui.'}</p></section>${partHTML}</div>`;
    const m = o.metricas;
    return `${topo}${erro}
      ${o.aviso ? `<div class="conf-ia" style="margin-bottom:16px">${esc(o.aviso)}</div>` : ''}
      <div class="aut-grid">
        <section class="bloco aut-estilo"><h3>Seu estilo, em palavras</h3>
          ${o.tracos.map((x) => `<div class="traco"><p>${esc(x.traco)}</p><blockquote>“${esc(x.exemplo)}”${x.texto_de_origem ? `<small>${esc(x.texto_de_origem)}</small>` : ''}</blockquote></div>`).join('')}
          <div class="mute-2" style="font-size:var(--t-xs)">Baseado em ${o.base.textos} ${o.base.textos === 1 ? 'texto' : 'textos'} e ${o.base.palavras.toLocaleString('pt-BR')} palavras. Atualizado em ${new Date(o.em).toLocaleDateString('pt-BR')}.${o.descartados ? ` ${o.descartados} ${o.descartados === 1 ? 'exemplo foi descartado' : 'exemplos foram descartados'} por não estar nos seus textos.` : ''}</div></section>
        ${corpusHTML}
        <section class="bloco aut-metr">
          <div><b>${String(m.palavrasPorFrase).replace('.', ',')} palavras</b><span>por frase, em média</span></div>
          <div><b>${m.passiva}%</b><span>das frases na voz passiva</span></div>
          <div><b>${String(m.citacoesPorParagrafo).replace('.', ',')}</b><span>citação por parágrafo</span></div>
          <div><b>${m.terminamEmPergunta}%</b><span>dos parágrafos terminam em pergunta</span></div>
        </section>
        ${o.temas.length ? `<section class="bloco aut-temas"><h3>Temas recorrentes</h3><div class="dist">${o.temas.slice(0, 6).map((t) => `<div style="grid-template-columns:1fr 60px 18px"><span>${esc(t.tema)}</span><span class="trilho"><i style="background:var(--petroleo);width:${(t.textos / Math.max(...o.temas.map((x) => x.textos), 1)) * 100}%"></i></span><span class="mute-2">${t.textos}</span></div>`).join('')}</div><p class="mute-2" style="font-size:var(--t-xs);margin:12px 0 0">Número de textos em que o tema aparece.</p></section>` : ''}
        ${m.conectivos.length ? `<section class="bloco aut-termos"><h3>Conectivos que são seus</h3><div class="termos">${m.conectivos.map((x) => `<span class="chip"><b>${esc(x.c)}</b> ${x.n}</span>`).join('')}</div><p class="mute-2" style="font-size:var(--t-xs);margin:12px 0 0">Quando o Copilot usar um conectivo que não está aqui, desconfie.</p></section>` : ''}
        ${partHTML}
        ${o.atencao.length ? `<section class="bloco aut-obs"><h3>Para observar</h3><ul class="obs-l">${o.atencao.map((x) => `<li>${esc(x.padrao)}<blockquote>“${esc(x.exemplo)}”</blockquote>${x.onde ? `<small>${esc(x.onde)}</small>` : ''}</li>`).join('')}</ul></section>` : ''}
        <section class="bloco aut-copilot"><h3>Resumo para o Copilot</h3><p>${esc(o.resumo || '(sem resumo)')}</p>
          <label class="check"><input type="checkbox" data-ov-copilot ${o.usarNoCopilot ? 'checked' : ''}>Usar este resumo nos pedidos ao Copilot</label>
          ${o.mudancas.length ? `<h4>O que mudou desde o retrato anterior</h4><ul>${o.mudancas.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</section>
      </div>`;
  }

  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.matches?.('[data-ov-arquivo]') && t.files?.length) {
      let ok = 0;
      for (const f of t.files) {
        try {
          await ov.adicionar(f);
          ok++;
        } catch (err) {
          toast(`${f.name}: ${err.message}`);
        }
      }
      if (ok) toast(`${ok} ${ok === 1 ? 'texto adicionado' : 'textos adicionados'}. Toque em "Atualizar o retrato".`);
      return recarregar();
    }
    if (t.dataset?.ovAlternar) {
      await ov.alternar(t.dataset.ovAlternar, t.dataset.origem);
      return recarregar();
    }
    if (t.matches?.('[data-ov-copilot]')) {
      await ov.usarNoCopilot(t.checked);
      toast(t.checked ? 'O Copilot passa a receber o resumo da sua voz' : 'O Copilot deixa de receber o resumo');
    }
  });
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-ov-atualizar]')) return;
    est.ocupado = true;
    est.erro = null;
    redesenhar();
    try {
      await ov.atualizar();
      toast('Retrato atualizado');
    } catch (err) {
      est.erro = err;
      if (!(err instanceof ErroIA)) registrar('erro', 'overview.falhou', { det: err.message, st: 'erro' });
    } finally {
      est.ocupado = false;
      redesenhar();
    }
  });

  return { tela };
}
