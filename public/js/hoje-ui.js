// Tela Hoje com dados reais: um próximo passo claro, poucas outras coisas e a semana recolhida.
// Sem sequência de dias, sem cobrança: quando não há registro de ontem, a tela simplesmente não fala de ontem.
import { autorCurto } from './abnt.js';
import { FUNCOES } from './leitor-pdf.js';
import { proximoPasso, tambemHoje, diaLocal } from './progresso.js';

/* global I */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icone = (n) => (typeof I !== 'undefined' && I[n]) || '';
const seta = '<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>';

export function titulData(d = new Date()) {
  const s = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d).replace(/-feira/, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function criarHojeUI({ bib, fichUI, trilhasUI, argUI, conflitosUI }) {
  /** Resumo de ontem, só com o que existe nos dados (grifos criados e fichamentos concluídos). */
  function ontem(hoje) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - 1);
    const dia = diaLocal(d);
    const doDia = (iso) => iso && diaLocal(new Date(iso)) === dia;
    const grifos = bib.todosGrifos().filter((g) => doDia(g.criadoEm)).length;
    const fichas = fichUI.todos().filter((f) => doDia(f.concluidoEm)).length;
    const partes = [];
    if (grifos) partes.push(`${grifos} ${grifos === 1 ? 'grifo' : 'grifos'}`);
    if (fichas) partes.push(`${fichas} ${fichas === 1 ? 'fichamento concluído' : 'fichamentos concluídos'}`);
    return partes.length ? `Ontem: ${partes.join(' e ')}.` : '';
  }

  function principalHTML(p) {
    if (p.vazio === 'biblioteca') {
      return `<section class="proximo" aria-labelledby="prox-t"><div class="rot" id="prox-t">Próximo passo</div>
        <h2 class="prox-tit">Adicione a primeira obra</h2>
        <p class="prox-txt">Comece pelo DOI ou pelo PDF de um artigo que você vai ler. O app monta a referência em ABNT e guarda o PDF no seu Drive.</p>
        <div class="acao-l"><button class="btn prim" data-bib="adicionar">${icone('mais')}Adicionar leitura</button></div></section>`;
    }
    if (p.vazio === 'tudo-fichado') {
      return `<section class="proximo" aria-labelledby="prox-t"><div class="rot" id="prox-t">Próximo passo</div>
        <h2 class="prox-tit">Todas as obras estão fichadas</h2>
        <p class="prox-txt">Escolha a próxima leitura ou veja quais argumentos ainda dependem de uma única fonte.</p>
        <div class="acao-l"><button class="btn prim" data-bib="adicionar">${icone('mais')}Adicionar leitura</button><a class="btn" href="#argumentos">Ver argumentos</a></div></section>`;
    }
    const l = p.leitura;
    const ultimo = bib
      .grifosDe(l.id)
      .slice()
      .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''))[0];
    const funcao = ultimo && FUNCOES.find((f) => f.id === ultimo.funcao);
    return `<section class="proximo" aria-labelledby="prox-t">
      <div class="rot" id="prox-t">Próximo passo: ${esc(p.motivo.charAt(0).toLowerCase() + p.motivo.slice(1))}</div>
      <h2 class="prox-tit">${esc(l.titulo)}</h2>
      <p class="prox-aut">${esc(autorCurto(l))}</p>
      ${ultimo && (l.etapa || 0) < 4 ? `<blockquote><mark class="${esc(ultimo.funcao)}">${esc(ultimo.texto)}</mark><small>Seu último grifo, p. ${ultimo.pagina}${funcao ? `, ${funcao.nome.toLowerCase()}` : ''}</small></blockquote>` : ''}
      <div class="acao-l"><a class="btn prim" href="${p.acao.href}">${p.acao.rotulo}</a>${p.acao.detalhe ? `<span>${esc(p.acao.detalhe)}</span>` : ''}</div>
    </section>`;
  }

  function semanaHTML(hoje) {
    const grifos = bib.todosGrifos();
    if (!grifos.length && !argUI.todos().length) return '';
    const dias = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(d.getDate() - i);
      const dia = diaLocal(d);
      const nome = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(d).replace('.', '');
      dias.push({ nome, n: grifos.filter((g) => g.criadoEm && diaLocal(new Date(g.criadoEm)) === dia).length, hoje: i === 0 });
    }
    const max = Math.max(1, ...dias.map((d) => d.n));
    const tot = FUNCOES.map((f) => ({ f, n: grifos.filter((g) => g.funcao === f.id).length }));
    const maxT = Math.max(1, ...tot.map((x) => x.n));
    const melhor = argUI
      .lista()
      .map((a) => ({ a, n: argUI.fontesDe(a).length }))
      .filter((x) => x.n > 0)[0];
    return `<details class="semana-det">
      <summary>Sua semana</summary>
      <div class="bento">
        <section class="bloco" style="grid-column:span 2"><h3>Grifos por dia</h3>
          <div class="semana" role="img" aria-label="Grifos nos últimos 7 dias: ${dias.map((d) => `${d.nome} ${d.n}`).join(', ')}">${dias.map((d) => `<div class="${d.hoje ? 'hoje' : ''}"><i style="height:${Math.max((d.n / max) * 72, 3)}px"></i>${d.nome}<small>${d.n}</small></div>`).join('')}</div></section>
        <section class="bloco" style="grid-column:span 2"><h3>Seus grifos, por função</h3>
          <div class="dist">${tot.map(({ f, n }) => `<div><span>${f.nome}</span><span class="trilho"><i class="c-${f.id}" style="width:${(n / maxT) * 100}%"></i></span><span class="mute-2">${n}</span></div>`).join('')}</div></section>
        ${
          melhor
            ? `<section class="bloco b-arg" style="grid-column:span 2"><h3>Argumento com mais fontes</h3><blockquote>${esc(melhor.a.tese)}</blockquote><a class="btn" href="#argumentos/${encodeURIComponent(melhor.a.id)}">Abrir argumento</a></section>`
            : ''
        }
      </div>
    </details>`;
  }

  function tela(hoje = new Date()) {
    const leituras = bib.leituras();
    const dadosBase = { leituras, fichamentos: fichUI.todos(), trilhas: trilhasUI.todas(), hoje };
    const p = proximoPasso(dadosBase);
    let outros = p.leitura || p.vazio === 'tudo-fichado' ? tambemHoje({ ...dadosBase, principalId: p.leitura?.id }) : [];
    // Conflitos de sincronização entram primeiro: no celular, o rodapé com o status não aparece.
    const nConf = conflitosUI?.total() || 0;
    const nMem = window.rb?.memoriaUI?.pendentes().length || 0;
    if (nMem) outros = [{ titulo: nMem === 1 ? 'Revisar 1 item para a memória' : `Revisar ${nMem} itens para a memória`, detalhe: 'A IA propôs a partir das suas conversas', href: '#memoria' }, ...outros].slice(0, 3);
    if (nConf) outros = [{ titulo: nConf === 1 ? 'Revisar 1 conflito de sincronização' : `Revisar ${nConf} conflitos de sincronização`, detalhe: 'O mesmo item mudou em dois aparelhos', href: '#conflitos' }, ...outros].slice(0, 3);
    const resumo = ontem(hoje);
    return `
    <div class="topo"><div><h1>${titulData(hoje)}</h1>${resumo ? `<p>${resumo}</p>` : ''}</div></div>
    <div class="hoje-grid ${outros.length ? '' : 'so-um'}">
      ${principalHTML(p)}
      ${
        outros.length
          ? `<aside class="tambem" aria-labelledby="tamb-t"><h2 id="tamb-t">Também para hoje</h2>${outros
              .map((o) => `<a href="${o.href}"><b>${esc(o.titulo)}</b>${o.detalhe ? `<span class="${o.urgente ? 'urg' : ''}">${esc(o.detalhe)}</span>` : ''}${seta}</a>`)
              .join('')}</aside>`
          : ''
      }
    </div>
    ${semanaHTML(hoje)}`;
  }

  return { tela };
}
