// Cópias de segurança (v1.3.0, "nada se perde"): a seção de Ajustes que mostra as proteções dos dados
// e deixa trazer de volta o que foi apagado (lixeira) ou o que falta (cópias diárias deste aparelho).
// Nenhuma ação daqui apaga: restaurar e recuperar só acrescentam.
import { ouvir } from './ui.js';
import { NOMES_COLECAO } from './conflitos-ui.js';
import { DIARIA } from './armazenamento.js';

/* global toast, baixar */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const quando = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const dia = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// O que aparece na contagem de cada cópia, na ordem em que o autor pensa.
const CONTAR = [['leituras', 'obra', 'obras'], ['textos', 'texto', 'textos'], ['grifos', 'grifo', 'grifos'], ['fichamentos', 'fichamento', 'fichamentos']];
// Num lote apagado junto (uma obra e os seus grifos), o item que dá nome ao lote.
const PRINCIPAL = ['textos', 'leituras', 'fichamentos', 'argumentos', 'trilhas', 'disciplinas'];

/** Nome legível de um item qualquer, para a lista da lixeira. */
export function nomeDoItem(x) {
  const i = x.item || {};
  const txt = i.titulo || i.nome || i.tese || i.texto || i.pergunta || i.frente || '';
  return String(txt).replace(/<[^>]+>/g, '').trim().slice(0, 90) || NOMES_COLECAO[x.colecao] || 'Item';
}

export function criarSegurancaUI({ dados, recarregar, registrar }) {
  let copias = null;
  let lixo = null;
  let pasta = null;
  let carregando = null;
  // Cópia aberta em "Ver o que mudou" e o que ela tem de diferente de hoje.
  let aberta = null;
  let difs = [];

  async function carregar() {
    [copias, lixo, pasta] = await Promise.all([dados.copias(), dados.lixeira(), dados.pastaLocal.estado()]);
    if (aberta) difs = await dados.diferencasDaCopia(aberta);
  }
  /** Lê do banco e troca a seção na tela (se ela estiver aberta). */
  function atualizar() {
    carregando ??= carregar()
      .then(() => {
        const el = document.getElementById('sec-seguranca');
        if (el) el.outerHTML = secaoHTML(true);
      })
      .finally(() => (carregando = null));
    return carregando;
  }

  /** Lotes da lixeira: cada um com o item principal e quantos foram apagados junto. */
  function lotes() {
    const grupos = new Map();
    for (const x of lixo || []) {
      const k = x.lote || x.id;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(x);
    }
    const ordem = (c) => (PRINCIPAL.indexOf(c) + 1 || 99);
    return [...grupos.values()].map((g) => {
      const principal = [...g].sort((a, b) => ordem(a.colecao) - ordem(b.colecao))[0];
      return { principal, outros: g.length - 1 };
    });
  }

  function pastaHTML() {
    if (pasta == null) return 'Conferindo…';
    if (!pasta.suportada) return 'Não disponível neste navegador';
    if (!pasta.nome) return '<button class="btn mini" data-seg-pasta="escolher">Escolher a pasta</button>';
    if (pasta.permissao !== 'granted') return `Pasta “${esc(pasta.nome)}” <button class="btn mini" data-seg-pasta="permitir">Permitir de novo</button>`;
    return `Pasta “${esc(pasta.nome)}”`;
  }

  const ESTADOS = { faltando: 'não existe mais', apagado: 'está apagado hoje', diferente: 'está diferente hoje' };
  /** O que a cópia tem de diferente de hoje, item por item, com o botão de trazer cada um. */
  function difsHTML(criadoEm) {
    if (!difs.length) return '<p class="mute seg-difs">Nada diferente: tudo o que está nessa cópia está igual hoje.</p>';
    const mostra = difs.slice(0, 60);
    return `<ul class="vers-lista seg-difs">${mostra.map((d) => `<li><span>${esc(nomeDoItem(d))}<small>${esc(NOMES_COLECAO[d.colecao] || 'Item')}, ${ESTADOS[d.estado]}</small></span><button class="btn fant" data-seg-trazer="${esc(criadoEm)}|${esc(d.colecao)}|${esc(d.id)}" data-ocupado="Trazendo…">Trazer esta versão</button></li>`).join('')}</ul>${difs.length > mostra.length ? `<p class="mute">E mais ${difs.length - mostra.length}. Baixe a cópia para ver tudo.</p>` : ''}`;
  }

  function secaoHTML(pronto = false) {
    if (!pronto) atualizar();
    const item = (n, v, obs) => `<div class="ap-it"><span>${n}</span><b>${v}</b>${obs ? `<small>${obs}</small>` : ''}</div>`;
    const diaria = (copias || []).find((c) => c.motivo === DIARIA);
    const ls = lotes();
    const contagem = (c) => CONTAR.filter(([k]) => c.contagem[k]).map(([k, um, varios]) => plural(c.contagem[k], um, varios)).join(', ') || 'sem dados';
    return `<section id="sec-seguranca">
    <h2>Cópias de segurança</h2>
    <p>O que você escreve é gravado sozinho neste aparelho e enviado ao seu Drive. Aqui estão as outras proteções e o que dá para trazer de volta. Nada daqui apaga: restaurar e recuperar só acrescentam.</p>
    <div class="ap-grade">
      ${item('Cópia diária neste aparelho', copias == null ? 'Conferindo…' : diaria ? `Feita em ${quando(diaria.criadoEm)}` : 'Ainda não feita hoje', 'uma por dia; ficam as 30 mais recentes')}
      ${item('Proteção do navegador', dados.persistente ? 'Confirmada' : 'Não confirmada', dados.persistente ? 'o navegador não apaga os dados deste app para liberar espaço' : 'o navegador pode limpar os dados se faltar espaço; o Drive e as cópias baixadas continuam valendo')}
      ${item('Pasta no computador', pastaHTML(), pasta?.suportada === false ? 'funciona no Chrome e no Edge do computador; aqui, use Baixar numa cópia' : pasta?.nome ? (pasta.ultima ? `última cópia em ${quando(pasta.ultima)}; uma por dia, fora do navegador` : 'uma cópia por dia, fora do navegador') : 'uma cópia em arquivo por dia, numa pasta sua, fora do navegador')}
      ${item('Lixeira', lixo == null ? 'Conferindo…' : ls.length ? plural(ls.length, 'item', 'itens') : 'Vazia', 'textos, fichamentos e argumentos ficam até você tirar; o resto sai em 90 dias')}
    </div>
    <h3 class="mt-4">Cópias guardadas</h3>
    ${(copias || []).length ? `<ul class="vers-lista" id="seg-copias">${copias.map((c) => `<li><span>${quando(c.criadoEm)}<small>${esc(contagem(c))}${c.motivo === DIARIA ? '' : `. Feita ${esc(c.motivo)}`}</small></span><span class="flex gap-2"><button class="btn fant" data-seg-ver="${esc(c.criadoEm)}" aria-expanded="${aberta === c.criadoEm}">${aberta === c.criadoEm ? 'Fechar' : 'Ver o que mudou'}</button><button class="btn fant" data-seg-baixar="${esc(c.criadoEm)}">Baixar</button><button class="btn fant" data-seg-recuperar="${esc(c.criadoEm)}" data-ocupado="Recuperando…">Recuperar o que falta</button></span></li>${aberta === c.criadoEm ? `<li class="seg-bloco">${difsHTML(c.criadoEm)}</li>` : ''}`).join('')}</ul>` : `<p class="mute">${copias == null ? 'Conferindo…' : 'Nenhuma cópia ainda. A primeira é feita hoje, sozinha.'}</p>`}
    <h3 class="mt-4">Lixeira</h3>
    ${ls.length ? `<ul class="vers-lista" id="seg-lixeira">${ls.map(({ principal: x, outros }) => `<li><span>${esc(nomeDoItem(x))}<small>${esc(NOMES_COLECAO[x.colecao] || 'Item')}, apagado em ${dia(x.apagadoEm)}${outros ? `, com mais ${plural(outros, 'item ligado', 'itens ligados')}` : ''}</small></span><button class="btn fant" data-seg-restaurar="${esc(x.id)}" data-ocupado="Restaurando…">Restaurar</button></li>`).join('')}</ul>` : `<p class="mute">${lixo == null ? 'Conferindo…' : 'Nada na lixeira.'}</p>`}
  </section>`;
  }

  ouvir('click', async (e) => {
    const b = e.target.closest('[data-seg-restaurar],[data-seg-recuperar],[data-seg-baixar],[data-seg-ver],[data-seg-trazer],[data-seg-pasta]');
    if (!b) return;
    const d = b.dataset;
    if (d.segVer) {
      aberta = aberta === d.segVer ? null : d.segVer;
      return atualizar();
    }
    if (d.segTrazer) {
      const [em, colecao, id] = d.segTrazer.split('|');
      const ok = await dados.trazerDaCopia(em, colecao, id);
      if (ok) await recarregar();
      await atualizar();
      return toast(ok ? 'Versão da cópia trazida de volta. O que estava aqui foi guardado antes.' : 'Este item não está mais nessa cópia.');
    }
    if (d.segPasta) {
      try {
        const r = d.segPasta === 'escolher' ? await dados.pastaLocal.escolher() : await dados.pastaLocal.gravarAgora({ pedir: true });
        await atualizar();
        return toast(r.em ? `Cópia gravada na pasta: ${r.nome}` : 'O navegador não deu a permissão para gravar na pasta.');
      } catch (err) {
        if (err.name === 'AbortError') return;
        registrar('erro', 'pasta_local.escolher', { det: err.message, st: 'aviso' });
        return toast('Não deu para usar essa pasta. Escolha outra.');
      }
    }
    if (d.segRestaurar) {
      const n = await dados.restaurarDaLixeira(d.segRestaurar);
      await recarregar();
      await atualizar();
      return toast(n ? `${plural(n, 'item voltou', 'itens voltaram')} da lixeira` : 'Este item já tinha voltado.');
    }
    if (d.segRecuperar) {
      const n = await dados.recuperarDaCopia(d.segRecuperar);
      if (n) await recarregar();
      await atualizar();
      return toast(n ? `${plural(n, 'item recuperado', 'itens recuperados')} da cópia de ${quando(d.segRecuperar)}` : 'Nada faltando: tudo o que está nessa cópia existe hoje.');
    }
    if (d.segBaixar) {
      const c = await dados.lerCopia(d.segBaixar);
      if (!c) return toast('Esta cópia não está mais neste aparelho.');
      baixar(`researchbook-copia-${d.segBaixar.slice(0, 10)}.json`, JSON.stringify(c.foto, null, 2), 'application/json');
      registrar('ui', 'copia.baixar');
      return toast('Cópia baixada');
    }
  });

  return { secaoHTML, atualizar, carregar, lixeira: () => lixo, copias: () => copias };
}
