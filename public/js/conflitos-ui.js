// Revisar conflitos de sincronização.
// Um conflito nasce quando o mesmo item muda em dois aparelhos antes de sincronizar: a versão mais recente
// fica em uso e a outra é guardada aqui (store "conflitos", só neste aparelho). Nada some sem o Diobert decidir.
//
// A tela mostra só os campos que diferem, com nomes que ele reconhece, e oferece duas saídas:
// manter a versão em uso (descarta a guardada) ou usar a guardada (vira a versão em uso e sincroniza).
// As duas têm desfazer.
import { FUNCOES } from './leitor-pdf.js';
import { PERGUNTAS } from './fichamento-ui.js';
import { TIPOS_ARG } from './argumentos-ui.js';
import { ETAPAS, dataCurta } from './progresso.js';

/* global toast */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const NOMES_COLECAO = {
  leituras: 'Obra',
  grifos: 'Grifo',
  fichamentos: 'Fichamento',
  argumentos: 'Argumento',
  trilhas: 'Trilha',
  textos: 'Texto',
  dialogos: 'Diálogo',
  cartoes: 'Cartão',
  disciplinas: 'Disciplina',
  aulas: 'Aula',
  eventos: 'Evento da agenda',
  encontros: 'Encontro de orientação',
  memoria: 'Item da memória',
  conversas: 'Conversa',
};

// Campos internos: não interessam ao Diobert e mudariam em quase todo conflito.
const IGNORAR = new Set(['id', 'aparelho', 'rects', 'leituraId', 'grifoId', 'argumentoId', 'pdf']);
const ROTULOS = {
  titulo: 'Título',
  subtitulo: 'Subtítulo',
  autores: 'Autores',
  ano: 'Ano',
  tipo: 'Tipo',
  veiculo: 'Publicado em',
  volume: 'Volume',
  numero: 'Número',
  paginas: 'Páginas',
  editora: 'Editora',
  local: 'Local',
  doi: 'DOI',
  projeto: 'Projeto',
  tags: 'Tags',
  etapa: 'Etapa',
  paginaAtual: 'Página atual',
  totalPaginas: 'Total de páginas',
  texto: 'Texto',
  pagina: 'Página',
  funcao: 'Cor do grifo',
  feitos: 'Etapas feitas',
  resumo: 'Resumo',
  citacoes: 'Citação',
  porque: 'Por que importa',
  trechos: 'Trecho',
  argumento: 'Argumento',
  tese: 'Tese',
  secao: 'Onde entra no texto',
  nome: 'Nome',
  objetivo: 'Para quê',
  prazo: 'Prazo',
  itens: 'Obras',
  apagado: 'Situação',
  evidencia: 'Suas palavras',
  status: 'Situação do item da memória',
};
for (const [k, p] of PERGUNTAS) ROTULOS[`analise.${k}`] = `Análise: ${p.replace(/\s*\(.*\)\s*/, '').replace(/\?$/, '').toLowerCase()}`;

const quando = (iso) => {
  if (!iso) return 'sem data';
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

export function criarConflitosUI({ bib, dados, registrar }) {
  let lista = []; // [{ c, atual }]

  async function carregar() {
    const cs = (await dados.conflitos()).sort((a, b) => (b.em || '').localeCompare(a.em || ''));
    lista = await Promise.all(cs.map(async (c) => ({ c, atual: (await dados.obter(c.colecao, c.itemId)) || null })));
  }

  /** Valor legível de um campo, conforme o que ele é. */
  function valor(chave, v) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return '';
    if (chave === 'apagado') return v ? 'Apagado' : 'Em uso';
    if (chave === 'etapa') return ETAPAS[v] || String(v);
    if (chave === 'funcao') return FUNCOES.find((f) => f.id === v)?.nome || v;
    if (chave === 'tipo' && TIPOS_ARG.some(([k]) => k === v)) return TIPOS_ARG.find(([k]) => k === v)[1];
    if (chave === 'prazo') return dataCurta(v);
    if (chave === 'autores') return v.map((a) => [a.sobrenome, a.prenomes].filter(Boolean).join(', ')).join('; ');
    if (chave === 'itens') return v.map((id, i) => `${i + 1}. ${bib.obter(id)?.titulo || 'obra removida'}`).join('\n');
    if (Array.isArray(v)) return v.join(', ');
    return String(v);
  }

  /** Achata o item em linhas { caminho, rotulo, texto }; listas de objetos viram "Trecho 2: texto". */
  function linhas(item) {
    const saida = new Map();
    const andar = (obj, prefixo, rotuloPai) => {
      for (const [k, v] of Object.entries(obj || {})) {
        if (IGNORAR.has(k) || /Em$/.test(k)) continue;
        const caminho = prefixo ? `${prefixo}.${k}` : k;
        if (Array.isArray(v) && v.some((x) => x && typeof x === 'object') && k !== 'autores') {
          v.forEach((x, i) => andar(x, `${caminho}.${i}`, `${ROTULOS[k] || k} ${i + 1}`));
        } else if (v && typeof v === 'object' && !Array.isArray(v)) {
          andar(v, caminho, null);
        } else {
          const rot = rotuloPai ? `${rotuloPai}: ${(ROTULOS[k] || k).toLowerCase()}` : ROTULOS[caminho] || ROTULOS[k] || k;
          saida.set(caminho, { rotulo: rot, texto: valor(k, v) });
        }
      }
    };
    andar(item, '', null);
    if (!saida.has('apagado')) saida.set('apagado', { rotulo: ROTULOS.apagado, texto: 'Em uso' });
    return saida;
  }

  function diferencas(a, b) {
    const la = linhas(a || {});
    const lb = linhas(b || {});
    const difs = [];
    for (const k of new Set([...la.keys(), ...lb.keys()])) {
      const x = la.get(k)?.texto ?? '';
      const y = lb.get(k)?.texto ?? '';
      if (x !== y) difs.push({ rotulo: (la.get(k) || lb.get(k)).rotulo, emUso: x, guardada: y });
    }
    return difs;
  }

  /** Nome do item, para o Diobert reconhecer o que é. */
  function nomeDoItem(c, a) {
    const v = a && !a.apagado ? a : c.versao;
    if (c.colecao === 'fichamentos') return `Fichamento de ${bib.obter(c.itemId)?.titulo || 'uma obra'}`;
    if (c.colecao === 'grifos') return `“${String(v.texto || '').slice(0, 90)}”${v.pagina ? `, p. ${v.pagina}` : ''}`;
    const t = v.titulo || v.tese || v.nome || v.texto || v.resumo || c.itemId;
    return String(t).length > 110 ? `${String(t).slice(0, 110)}…` : String(t);
  }

  const de = (v) => (v?.aparelho && v.aparelho === dados.aparelho ? 'este aparelho' : 'outro aparelho');
  const celula = (t) => (t ? `<p>${esc(t).replace(/\n/g, '<br>')}</p>` : '<p class="mute">(vazio)</p>');

  function cartao({ c, atual }) {
    const g = c.versao;
    const difs = diferencas(atual, g);
    const guardadaApaga = !!g.apagado && !atual?.apagado;
    const guardadaRecupera = !g.apagado && !!atual?.apagado;
    const usar = guardadaApaga ? 'Apagar este item' : guardadaRecupera ? 'Recuperar a versão guardada' : 'Usar a versão guardada';
    const nota = guardadaApaga
      ? `<p class="conf-nota">Em ${de(g)}, este item foi apagado. Aqui ele continua em uso.</p>`
      : guardadaRecupera
        ? `<p class="conf-nota">A versão em uso é a exclusão: o item foi apagado em ${de(atual)}. A versão guardada ainda tem o conteúdo.</p>`
        : '';
    return `<article class="conf" data-conflito="${esc(c.id)}">
      <header><span class="chip">${NOMES_COLECAO[c.colecao] || c.colecao}</span><h2>${esc(nomeDoItem(c, atual))}</h2></header>
      ${nota}
      ${
        difs.length && !guardadaApaga && !guardadaRecupera
          ? `<div class="conf-tab" role="table" aria-label="Diferenças">
        <div class="conf-l cab" role="row"><span role="columnheader">Campo</span><span role="columnheader">Em uso<small>${quando(atual?.atualizadoEm)}, ${de(atual)}</small></span><span role="columnheader">Guardada<small>${quando(g.atualizadoEm)}, ${de(g)}</small></span></div>
        ${difs.map((d) => `<div class="conf-l" role="row"><b role="rowheader">${esc(d.rotulo)}</b><div role="cell" data-lado="Em uso">${celula(d.emUso)}</div><div role="cell" data-lado="Guardada">${celula(d.guardada)}</div></div>`).join('')}
      </div>`
          : !difs.length
            ? '<p class="conf-nota">As duas versões têm o mesmo conteúdo; só a hora de gravação mudou. Pode manter a em uso.</p>'
            : ''
      }
      <div class="conf-acoes"><button class="btn prim" data-conf-manter="${esc(c.id)}">Manter a versão em uso</button><button class="btn" data-conf-usar="${esc(c.id)}">${usar}</button></div>
    </article>`;
  }

  function tela() {
    const topo = `<div class="topo"><div><h1>Conflitos de sincronização</h1><p>${
      lista.length ? `${lista.length} ${lista.length === 1 ? 'item mudou' : 'itens mudaram'} em dois aparelhos antes de sincronizar. A versão mais recente ficou em uso; a outra está guardada aqui até você decidir.` : 'Nada para revisar.'
    }</p></div>${lista.length > 1 ? '<div class="acoes"><button class="btn" data-conf-manter-todos>Manter todas as versões em uso</button></div>' : ''}</div>`;
    const como = `<details class="como"><summary>Como um conflito acontece?</summary><p>Cada aparelho guarda uma cópia dos dados e sincroniza com o Drive. Se você muda o mesmo item em dois aparelhos antes de um deles sincronizar, o app fica com a mudança mais recente e guarda a outra, em vez de jogá-la fora. Os conflitos ficam só no aparelho onde foram encontrados.</p></details>`;
    if (!lista.length) return `${topo}<div class="bib-vazia"><h2>Nenhum conflito</h2><p>Quando o mesmo item mudar em dois aparelhos antes de sincronizar, as duas versões aparecem aqui para você escolher.</p><a class="btn" href="#ajustes">Voltar aos ajustes</a></div>${como}`;
    return `${topo}${lista.map(cartao).join('')}${como}`;
  }

  /* ---------- Ações ---------- */
  const redesenhar = () => window.render?.();
  async function recarregarModulos() {
    await window.rb?.biblioteca?.carregar();
    await Promise.all([window.rb?.fichUI?.carregar(), window.rb?.argUI?.carregar(), window.rb?.trilhasUI?.carregar()]);
  }

  async function manter(ids) {
    const sairam = lista.filter((x) => ids.includes(x.c.id)).map((x) => x.c);
    for (const c of sairam) await dados.resolverConflito(c.id);
    registrar('ui', 'conflito.manter', { det: `${sairam.length} ${sairam.map((c) => c.colecao).join(', ')}` });
    await carregar();
    redesenhar();
    toast(sairam.length === 1 ? 'Versão em uso mantida' : `${sairam.length} versões em uso mantidas`, async () => {
      for (const c of sairam) await dados.reabrirConflito(c);
      await carregar();
      redesenhar();
    });
  }

  async function usarGuardada(id) {
    const x = lista.find((y) => y.c.id === id);
    if (!x) return;
    const { c, atual } = x;
    // A versão guardada volta a valer, com hora nova, para ganhar dos outros aparelhos na próxima sincronização.
    await dados.salvar(c.colecao, { ...c.versao, apagado: !!c.versao.apagado });
    await dados.resolverConflito(c.id);
    registrar('ui', 'conflito.usar_guardada', { det: c.colecao });
    await recarregarModulos();
    await carregar();
    redesenhar();
    toast('Versão guardada em uso', async () => {
      if (atual) await dados.salvar(c.colecao, { ...atual });
      await dados.reabrirConflito(c);
      await recarregarModulos();
      await carregar();
      redesenhar();
    });
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-conf-manter],[data-conf-usar],[data-conf-manter-todos]');
    if (!b) return;
    b.disabled = true;
    if (b.dataset.confManter) await manter([b.dataset.confManter]);
    if (b.dataset.confUsar) await usarGuardada(b.dataset.confUsar);
    if (b.dataset.confManterTodos !== undefined) await manter(lista.map((x) => x.c.id));
  });

  return { carregar, tela, total: () => lista.length, diferencas };
}
