// Ajustes > Modelos por tarefa e Uso e custo, com dados reais.
// Uso e custo vêm dos registros das chamadas ao Gemini neste aparelho (cada registro tem tarefa, modelo, tokens
// e custo estimado; nunca o texto). Cada aparelho guarda os próprios registros; os de todos vão para o Drive.
// Também guarda as descrições dos marca-textos (Ajustes > Marca-textos).
import { TAREFAS, PRECOS, NOMES_TAREFA, escolhasModelos, tarefa } from './gemini.js';

/* global toast */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const PENSAMENTO = { MINIMAL: 'mínimo', LOW: 'baixo', MEDIUM: 'médio', HIGH: 'alto' };
const usd = (v) => `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: v < 0.1 ? 4 : 2 })}`;
const brl = (v, c) => (c ? ` (R$ ${(v * c).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : '');
export const DESCRICOES_PADRAO = { conceito: 'Definições e ideias centrais', evidencia: 'Dados, resultados, exemplos', metodo: 'Como o autor fez', critica: 'Onde discordo ou desconfio', dissert: 'Vai direto para meu texto' };

/** Lê um registro "ia.resposta" (det em texto) e devolve tarefa, modelo, tokens e custo. */
export function lerChamada(e) {
  const d = String(e.det || '');
  const m = d.match(/^([a-z_]+), ([^, ]+)( \(reserva\))?,.*tokens (\d+)\/(\d+)\/(\d+)\/(\d+), custo (?:US\$ ([\d.]+)|sem preço)/);
  if (!m) return null;
  return { t: e.t, tarefa: m[1], modelo: m[2], reserva: !!m[3], entrada: +m[4], cache: +m[5], pensamento: +m[6], saida: +m[7], custo: m[8] ? Number(m[8]) : null, dur: e.dur || 0 };
}

export function criarIAUso({ registros, drive, registrar }) {
  let chamadas = null;
  let carregando = null;
  let leuDrive = false;
  const cfg = (k, padrao) => {
    try {
      return JSON.parse(localStorage.getItem(k) || 'null') ?? padrao;
    } catch {
      return padrao;
    }
  };
  const salvarCfg = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const redesenhar = () => /^#ajustes/.test(location.hash) && !document.activeElement?.matches?.('input, textarea') && window.render?.();

  async function carregar() {
    if (carregando) return carregando;
    carregando = (async () => {
      const todos = await registros.doBanco();
      chamadas = todos.filter((e) => e.ev === 'ia.resposta').map(lerChamada).filter(Boolean);
      // As escolhas feitas em outro aparelho chegam pelo Drive (uma leitura por sessão).
      const d = drive();
      if (d && !leuDrive) {
        leuDrive = true;
        try {
          const txt = await d.ler('ajustes/preferencias.json');
          if (txt) {
            const p = JSON.parse(txt);
            if (p.modelos) localStorage.setItem('rb.ia.modelos', JSON.stringify(p.modelos));
            if (p.cores) salvarCfg('rb.cores', p.cores);
            if (p.limite != null) salvarCfg('rb.ia.limite', p.limite);
          }
        } catch (e) {
          registrar('erro', 'ajustes.drive', { det: e.message, st: 'aviso' });
        }
      }
    })().finally(() => (carregando = null));
    await carregando;
    redesenhar();
  }
  // Uma gravação por vez: duas mudanças seguidas não criam dois arquivos no Drive.
  let fila = Promise.resolve();
  function gravarPreferencias() {
    fila = fila.then(async () => {
      const d = drive();
      if (!d) return;
      try {
        await d.gravar('ajustes/preferencias.json', JSON.stringify({ modelos: escolhasModelos(), cores: cfg('rb.cores', {}), limite: cfg('rb.ia.limite', null) }, null, 1));
      } catch (e) {
        registrar('erro', 'ajustes.drive', { det: e.message, st: 'aviso' });
      }
    });
    return fila;
  }

  /* ---------- Modelos por tarefa ---------- */
  function secModelos() {
    const modelos = [...new Set([...Object.keys(PRECOS), ...Object.values(TAREFAS).flatMap((t) => [t.modelo, t.reserva])])].filter(Boolean);
    const esc_ = escolhasModelos();
    const linha = (k) => {
      const padrao = TAREFAS[k];
      const t = tarefa(k);
      const mudou = !!esc_[k];
      return `<tr><td><b>${esc(NOMES_TAREFA[k] || k)}</b><small>Reserva: ${esc(padrao.reserva || '-')}</small></td>
        <td><select data-ia-modelo="${k}" aria-label="Modelo para ${esc(NOMES_TAREFA[k] || k)}">${modelos.map((m) => `<option ${m === t.modelo ? 'selected' : ''}>${m}</option>`).join('')}</select></td>
        <td><select data-ia-pensamento="${k}" aria-label="Pensamento para ${esc(NOMES_TAREFA[k] || k)}">${Object.entries(PENSAMENTO).map(([v, n]) => `<option value="${v}" ${v === t.pensamento ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
        <td>${mudou ? `<button class="btn fant mini" data-ia-padrao="${k}">Voltar ao padrão</button>` : '<span class="t-legenda mute">padrão</span>'}</td></tr>`;
    };
    return `<section id="sec-modelos"><h2>Modelos por tarefa</h2>
      <p>Cada tarefa usa o modelo mais barato que dá conta dela. O nível de pensamento controla quanto o modelo raciocina antes de responder; mais pensamento custa mais. Se o modelo falhar duas vezes, o pedido vai para o reserva, e isso fica nos registros.</p>
      <div class="tab-wrap"><table class="tab-ia"><thead><tr><th>Tarefa</th><th>Modelo</th><th>Pensamento</th><th></th></tr></thead><tbody>${Object.keys(TAREFAS).filter((k) => k !== 'teste').map(linha).join('')}</tbody></table></div>
      <p class="t-legenda m-0 mt-2 mute-2">As escolhas valem em todos os seus aparelhos.</p></section>`;
  }

  /* ---------- Uso e custo ---------- */
  function secCusto() {
    if (!chamadas) {
      carregar();
      return '<section id="sec-custo"><h2>Uso e custo</h2><p class="mute">Lendo os registros deste aparelho…</p></section>';
    }
    const agora = new Date();
    const mes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    const doMes = chamadas.filter((c) => c.t.startsWith(mes));
    const total = doMes.reduce((n, c) => n + (c.custo || 0), 0);
    const semPreco = doMes.filter((c) => c.custo == null).length;
    const tokens = doMes.reduce((n, c) => n + c.entrada + c.pensamento + c.saida, 0);
    const dia = agora.getDate();
    const diasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    const projecao = dia ? (total / dia) * diasMes : 0;
    const limite = cfg('rb.ia.limite', null);
    const cot = cfg('rb.cotacao', null);
    const porDia = Array.from({ length: diasMes }, (_, i) => doMes.filter((c) => new Date(c.t).getDate() === i + 1).reduce((n, c) => n + (c.custo || 0), 0));
    const max = Math.max(...porDia, 0.000001);
    const porTarefa = new Map();
    for (const c of doMes) {
      const x = porTarefa.get(c.tarefa) || { usos: 0, tokens: 0, custo: 0, modelos: new Set(), reserva: 0 };
      x.usos++;
      x.tokens += c.entrada + c.pensamento + c.saida;
      x.custo += c.custo || 0;
      x.modelos.add(c.modelo);
      if (c.reserva) x.reserva++;
      porTarefa.set(c.tarefa, x);
    }
    const linhas = [...porTarefa].sort((a, b) => b[1].custo - a[1].custo);
    const nomeMes = agora.toLocaleDateString('pt-BR', { month: 'long' });
    const pctLimite = limite ? (total / limite) * 100 : null;
    return `<section id="sec-custo"><h2>Uso e custo</h2>
      <p>Calculado a partir dos registros de cada chamada neste aparelho, com os preços da tabela abaixo. Valores em dólar, como o Google cobra. O limite real de gasto fica no Google AI Studio; o daqui só avisa.</p>
      ${pctLimite != null && pctLimite >= 80 ? `<div class="aviso"><span>!</span><div>O gasto do mês chegou a ${Math.round(pctLimite)}% do limite que você definiu (${usd(limite)}).</div></div>` : ''}
      <div class="kpis">
        <div><b>${usd(total)}</b><span>gasto em ${nomeMes} até hoje${brl(total, cot)}</span>${semPreco ? `<small>${semPreco} chamadas sem preço na tabela</small>` : ''}</div>
        <div><b>${usd(projecao)}</b><span>projeção para ${nomeMes}</span></div>
        <div><b>${doMes.length.toLocaleString('pt-BR')}</b><span>chamadas no mês</span><small>${(tokens / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil tokens</small></div>
        <div><b>${limite ? usd(limite) : 'sem limite'}</b><span>limite mensal daqui</span>${limite ? `<small>aviso em 80%</small>` : ''}</div>
      </div>
      ${doMes.length ? `<div class="barras-dia" role="img" aria-label="Custo por dia em ${nomeMes}">${porDia.map((v, i) => `<div class="${i + 1 > dia ? 'fut' : ''}" title="${i + 1}: ${usd(v)}"><i style="height:${(v / max) * 100}%"></i><span>${i + 1}</span></div>`).join('')}</div>
      <div class="tab-wrap"><table class="tab-ia"><thead><tr><th>Tarefa</th><th>Modelo</th><th class="num">Usos</th><th class="num">Tokens</th><th class="num">Custo no mês</th></tr></thead><tbody>
        ${linhas.map(([k, x]) => `<tr><td>${esc(NOMES_TAREFA[k] || k)}${x.reserva ? `<small>${x.reserva} pelo modelo reserva</small>` : ''}</td><td class="mute">${[...x.modelos].map(esc).join(', ')}</td><td class="num">${x.usos}</td><td class="num">${(x.tokens / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil</td><td class="num">${usd(x.custo)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="mute">Nenhuma chamada ao Gemini neste mês, neste aparelho.</p>'}
      <div class="mt-4 aj-linha">
        <div class="campo"><label for="ia-limite">Limite mensal (US$)</label><input id="ia-limite" inputmode="decimal" data-ia-limite value="${limite != null ? String(limite).replace('.', ',') : ''}" placeholder="Ex.: 25,00"></div>
        <div class="campo"><label for="ia-cotacao">Cotação do dólar para mostrar em reais <span>você define</span></label><input id="ia-cotacao" inputmode="decimal" data-ia-cotacao value="${cot != null ? String(cot).replace('.', ',') : ''}" placeholder="Ex.: 5,40"></div>
      </div>
      <details class="ajuda-det"><summary>Preços usados no cálculo</summary><div class="mt-3 tab-wrap"><table class="tab-ia"><thead><tr><th>Modelo</th><th class="num">Entrada</th><th class="num">Saída</th><th class="num">Cache</th><th>Muda em</th></tr></thead><tbody>
        ${Object.entries(PRECOS).map(([k, p]) => `<tr><td>${k}</td><td class="num">${usd(p.entrada)}</td><td class="num">${usd(p.saida)}</td><td class="num">${usd(p.cache)}</td><td>${p.ate ? `${p.ate.split('-').reverse().join('/')}: ${usd(p.depois.entrada)} e ${usd(p.depois.saida)}` : 'sem mudança anunciada'}</td></tr>`).join('')}
      </tbody></table></div><p class="t-legenda m-0 mt-2 mute-2">Por milhão de tokens. Modelos fora da tabela ficam sem custo estimado.</p></details></section>`;
  }

  /* ---------- Marca-textos ---------- */
  const descricoes = () => ({ ...DESCRICOES_PADRAO, ...cfg('rb.cores', {}) });
  function secCores(funcoes) {
    const d = descricoes();
    return `<section id="sec-cores"><h2>Marca-textos</h2><p>Cada cor tem uma função. A função decide para qual etapa do fichamento o grifo vai. A descrição aparece quando você passa o mouse sobre a cor no leitor.</p>
      ${funcoes.map((f) => `<div class="cor-func"><span class="sw c-${f.id}"></span><strong class="forte">${esc(f.nome)}</strong><input value="${esc(d[f.id] || '')}" data-cor-desc="${f.id}" aria-label="Descrição de ${esc(f.nome)}"></div>`).join('')}</section>`;
  }

  let tempo = null;
  document.addEventListener('change', (e) => {
    const t = e.target;
    const k = t.dataset?.iaModelo || t.dataset?.iaPensamento;
    if (k) {
      const todas = escolhasModelos();
      const atual = { ...(todas[k] || {}) };
      if (t.dataset.iaModelo) atual.modelo = t.value === TAREFAS[k].modelo ? undefined : t.value;
      else atual.pensamento = t.value === TAREFAS[k].pensamento ? undefined : t.value;
      if (!atual.modelo && !atual.pensamento) delete todas[k];
      else todas[k] = atual;
      localStorage.setItem('rb.ia.modelos', JSON.stringify(todas));
      registrar('ui', 'ajustes.modelo', { det: `${k}: ${tarefa(k).modelo}, ${tarefa(k).pensamento}` });
      gravarPreferencias();
      redesenhar();
      toast(`${NOMES_TAREFA[k] || k}: ${tarefa(k).modelo}, pensamento ${PENSAMENTO[tarefa(k).pensamento]}`);
    }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset?.iaLimite !== undefined || t.dataset?.iaCotacao !== undefined) {
      const v = t.value.trim() ? Number(t.value.replace(/\./g, '').replace(',', '.')) : null;
      if (v != null && !(v > 0)) return;
      salvarCfg(t.dataset.iaLimite !== undefined ? 'rb.ia.limite' : 'rb.cotacao', v);
      clearTimeout(tempo);
      tempo = setTimeout(gravarPreferencias, 800);
    }
    if (t.dataset?.corDesc) {
      salvarCfg('rb.cores', { ...cfg('rb.cores', {}), [t.dataset.corDesc]: t.value.trim() });
      clearTimeout(tempo);
      tempo = setTimeout(gravarPreferencias, 800);
    }
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ia-padrao]');
    if (!b) return;
    const todas = escolhasModelos();
    delete todas[b.dataset.iaPadrao];
    localStorage.setItem('rb.ia.modelos', JSON.stringify(todas));
    gravarPreferencias();
    redesenhar();
  });

  return { secModelos, secCusto, secCores, descricoes, carregar, recarregar: () => ((chamadas = null), carregar()) };
}
