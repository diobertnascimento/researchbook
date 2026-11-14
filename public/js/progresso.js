// Progresso de cada obra e o "próximo passo" do dia.
// Funções puras: recebem os dados e devolvem a decisão. Hoje, Trilhas e a biblioteca usam as mesmas regras,
// para o app nunca dizer duas coisas diferentes sobre a mesma obra.
import { PASSOS } from './fichamento-ui.js';

export const ETAPAS = ['Não iniciada', 'Em leitura', 'Leitura concluída', 'Em fichamento', 'Fichada'];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const rota = (r, id) => `#${r}/${encodeURIComponent(id)}`;

/** Quatro marcas: leitura, leitura concluída, fichamento, fichada. A marca listrada é a etapa em curso. */
export function pipsHTML(etapa = 0) {
  const e = Math.max(0, Math.min(4, etapa || 0));
  let h = `<span class="pips" role="img" aria-label="Etapa: ${ETAPAS[e].toLowerCase()}">`;
  for (let i = 1; i <= 4; i++) {
    const cls = i <= e ? (e === 1 && i === 1) || (e === 3 && i === 3) ? 'agora' : 'on' : '';
    h += `<i class="${cls}"></i>`;
  }
  return `${h}</span>`;
}

/** O que fazer agora com uma obra, conforme a etapa. Devolve rótulo do botão, endereço e um detalhe curto. */
export function proximaAcao(l, fich) {
  const e = l.etapa || 0;
  if (e === 0) return { rotulo: 'Começar a leitura', href: rota('leitor', l.id), detalhe: l.totalPaginas ? `${l.totalPaginas} páginas` : '' };
  if (e === 1) return { rotulo: 'Continuar a leitura', href: rota('leitor', l.id), detalhe: l.totalPaginas ? `p. ${l.paginaAtual || 1} de ${l.totalPaginas}` : '' };
  if (e === 2) return { rotulo: 'Fazer o fichamento', href: rota('fichamento', l.id), detalhe: 'Leitura concluída' };
  if (e === 3) {
    const feitos = Math.min(fich?.feitos || 0, 4);
    return { rotulo: 'Continuar o fichamento', href: rota('fichamento', l.id), detalhe: `Etapa ${feitos + 1} de 5: ${PASSOS[feitos].nome.toLowerCase()}` };
  }
  return { rotulo: 'Ver o fichamento', href: rota('fichamento', l.id), detalhe: 'Fichada', feita: true };
}

/** Quando a obra foi mexida pela última vez (leitura ou fichamento). */
const mexida = (l, fich) => [l.atualizadoEm, fich?.atualizadoEm, l.adicionadaEm].filter(Boolean).sort().pop() || '';

/** Data local (AAAA-MM-DD) para dias inteiros, sem fuso. */
export function diaLocal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** Dias inteiros de hoje até o prazo (negativo se já passou). */
export function diasAte(prazo, hoje = new Date()) {
  if (!prazo) return null;
  const [a, m, d] = prazo.split('-').map(Number);
  const alvo = new Date(a, m - 1, d);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - base) / 86400000);
}
export function dataCurta(prazo) {
  if (!prazo) return '';
  const [, m, d] = prazo.split('-');
  return `${d}/${m}`;
}
/** Texto do prazo, sem alarme: o vermelho fica só para os últimos três dias com leitura pendente. */
export function textoPrazo(prazo, hoje = new Date()) {
  const n = diasAte(prazo, hoje);
  if (n === null) return { principal: 'Sem prazo', detalhe: '', urgente: false };
  if (n < 0) return { principal: `Prazo era ${dataCurta(prazo)}`, detalhe: 'Mude a data se ainda for útil', urgente: false };
  if (n === 0) return { principal: `Até hoje, ${dataCurta(prazo)}`, detalhe: '', urgente: true };
  return { principal: `Até ${dataCurta(prazo)}`, detalhe: n === 1 ? 'Falta 1 dia' : `Faltam ${n} dias`, urgente: n <= 3 };
}

/**
 * Próximo passo do dia, numa ordem fixa e explicável:
 * 1. a obra em curso mexida por último (leitura ou fichamento começados);
 * 2. a próxima obra da trilha com o prazo mais perto;
 * 3. uma leitura concluída que ainda não foi fichada;
 * 4. uma obra não iniciada (a adicionada por último).
 * Devolve { leitura, acao, motivo, trilha? } ou { vazio: 'biblioteca' | 'tudo-fichado' }.
 */
export function proximoPasso({ leituras, fichamentos = [], trilhas = [], hoje = new Date() }) {
  if (!leituras.length) return { vazio: 'biblioteca' };
  const fichDe = (id) => fichamentos.find((f) => f.id === id);
  const porId = new Map(leituras.map((l) => [l.id, l]));
  const comAcao = (l, motivo, extra = {}) => ({ leitura: l, acao: proximaAcao(l, fichDe(l.id)), motivo, ...extra });

  const emCurso = leituras.filter((l) => l.etapa === 1 || l.etapa === 3).sort((a, b) => mexida(b, fichDe(b.id)).localeCompare(mexida(a, fichDe(a.id))));
  if (emCurso.length) return comAcao(emCurso[0], emCurso[0].etapa === 3 ? 'Fichamento em andamento' : 'Leitura em andamento');

  const comPrazo = trilhas
    .map((t) => ({ t, n: diasAte(t.prazo, hoje), prox: (t.itens || []).map((i) => porId.get(i)).find((l) => l && (l.etapa || 0) < 4) }))
    .filter((x) => x.prox)
    .sort((a, b) => (a.n === null || a.n < 0 ? 9e9 : a.n) - (b.n === null || b.n < 0 ? 9e9 : b.n));
  if (comPrazo.length) return comAcao(comPrazo[0].prox, `Próxima da trilha ${comPrazo[0].t.nome}`, { trilha: comPrazo[0].t });

  const semFicha = leituras.filter((l) => l.etapa === 2).sort((a, b) => mexida(b).localeCompare(mexida(a)));
  if (semFicha.length) return comAcao(semFicha[0], 'Leitura concluída, ainda sem fichamento');

  const naFila = leituras.filter((l) => !l.etapa).sort((a, b) => (b.adicionadaEm || '').localeCompare(a.adicionadaEm || ''));
  if (naFila.length) return comAcao(naFila[0], 'Ainda não iniciada');

  return { vazio: 'tudo-fichado' };
}

/** Outras coisas para hoje, além do próximo passo (no máximo três, sem repetir a obra principal). */
export function tambemHoje({ leituras, fichamentos = [], trilhas = [], principalId = null, hoje = new Date() }) {
  const fichDe = (id) => fichamentos.find((f) => f.id === id);
  const itens = [];
  const usados = new Set([principalId]);
  for (const l of leituras.filter((x) => (x.etapa === 1 || x.etapa === 3) && !usados.has(x.id)).sort((a, b) => mexida(b, fichDe(b.id)).localeCompare(mexida(a, fichDe(a.id))))) {
    const a = proximaAcao(l, fichDe(l.id));
    itens.push({ titulo: `${a.rotulo}: ${l.titulo}`, detalhe: a.detalhe, href: a.href });
    usados.add(l.id);
  }
  const porId = new Map(leituras.map((l) => [l.id, l]));
  for (const t of trilhas) {
    const n = diasAte(t.prazo, hoje);
    const faltam = (t.itens || []).map((i) => porId.get(i)).filter((l) => l && (l.etapa || 0) < 4).length;
    if (n === null || n < 0 || n > 14 || !faltam) continue;
    const p = textoPrazo(t.prazo, hoje);
    itens.push({ titulo: `Trilha ${t.nome}`, detalhe: `${faltam} ${faltam === 1 ? 'obra' : 'obras'} até ${dataCurta(t.prazo)}${p.detalhe ? ` (${p.detalhe.toLowerCase()})` : ''}`, href: '#trilhas', urgente: p.urgente, n });
  }
  for (const l of leituras.filter((x) => x.etapa === 2 && !usados.has(x.id))) {
    itens.push({ titulo: `Fazer o fichamento: ${l.titulo}`, detalhe: 'Leitura concluída', href: rota('fichamento', l.id) });
    usados.add(l.id);
  }
  return itens.slice(0, 3);
}

export { esc };
