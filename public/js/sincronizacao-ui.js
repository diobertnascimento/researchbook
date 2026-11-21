// Sincronização (v1.5.0): a página de Ajustes que mostra o estado deste aparelho, o que espera para subir
// e quando cada aparelho falou com o Drive pela última vez. Cada aparelho grava o seu próprio arquivo
// (aparelhos/<id>.json), então dois aparelhos nunca disputam o mesmo arquivo.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const DIA = 86400000;
const hora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "hoje às 21:14", "ontem às 18:02", "há 3 dias". */
export function quandoFoi(iso, agora = Date.now()) {
  const t = Date.parse(iso);
  if (!t) return 'sem registro';
  const dias = Math.floor((new Date(agora).setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / DIA);
  if (dias <= 0) return `hoje às ${hora(iso)}`;
  if (dias === 1) return `ontem às ${hora(iso)}`;
  return `há ${dias} dias`;
}

/** Nome que o autor reconhece, a partir do sistema do aparelho. */
export function nomeDoAparelho({ sistema }) {
  return { iOS: 'iPhone ou iPad', Android: 'Celular Android', macOS: 'Mac', Windows: 'Computador Windows', Linux: 'Computador Linux' }[sistema] || 'Aparelho';
}

export function criarSincronizacaoUI({ estado, aparelhos, idAparelho }) {
  let lista = null;
  let lidaEm = 0;
  let carregando = null;

  /** Lê do Drive a lista de aparelhos (no máximo uma vez por minuto) e troca a seção na tela. */
  function atualizar(forcar = false) {
    if (!forcar && Date.now() - lidaEm < 60_000) return Promise.resolve();
    carregando ??= aparelhos()
      .then((l) => {
        lista = l;
        lidaEm = Date.now();
        const el = document.getElementById('sec-sincronizacao');
        if (el) el.outerHTML = secaoHTML(true);
      })
      .catch(() => {})
      .finally(() => (carregando = null));
    return carregando;
  }

  function secaoHTML(pronto = false) {
    if (!pronto) atualizar();
    const e = estado() || { fase: 'desconectado' };
    const item = (n, v, obs) => `<div class="ap-it"><span>${n}</span><b>${v}</b>${obs ? `<small>${obs}</small>` : ''}</div>`;
    const agora = { ok: e.pendente ? 'Enviando ao Drive…' : 'Sincronizado', sincronizando: 'Sincronizando…', parado: 'Sincronizando…', offline: 'Sem internet', desconectado: 'Login do Google vencido', erro: 'Não deu para sincronizar' }[e.fase] || 'Sem login';
    const obsAgora = e.fase === 'ok' ? `última sincronização ${quandoFoi(e.ultima)}` : e.fase === 'desconectado' ? 'selecione “Entrar de novo”, no estado da sincronização' : e.fase === 'offline' ? 'sobe sozinho quando a internet voltar' : e.fase === 'erro' ? esc(e.erro || '') : '';
    const n = e.pendentes || 0;
    return `<section id="sec-sincronizacao">
    <h2>Sincronização</h2>
    <p>O que está neste aparelho, o que ainda falta subir e quando cada aparelho falou com o Drive pela última vez.</p>
    <div class="ap-grade">
      ${item('Este aparelho', agora, obsAgora)}
      ${item('Esperando para subir', n ? `${n} ${n === 1 ? 'mudança' : 'mudanças'}` : e.pendente ? 'Enviando agora' : 'Nada', 'o que você mudou aqui e ainda não está no Drive')}
      ${item('Conflitos', e.conflitos ? `<a href="#conflitos">${e.conflitos} para revisar</a>` : 'Nenhum', 'quando o mesmo item muda em dois aparelhos, as duas versões ficam guardadas')}
    </div>
    <div class="flex gap-2 wrap mt-4"><button class="btn prim" data-google="sincronizar" data-ocupado="Sincronizando…">Sincronizar agora</button></div>
    <h3 class="mt-4">Seus aparelhos</h3>
    ${lista == null ? '<p class="mute">Conferindo no Drive…</p>' : lista.length ? `<ul class="vers-lista" id="sinc-aparelhos">${lista.map((a) => {
      const parado = Date.now() - Date.parse(a.ultima) > 2 * DIA;
      return `<li><span>${esc(a.nome)}${a.id === idAparelho ? ' (este aparelho)' : ''}<small>${esc(a.navegador || '')}${a.versao ? `, v${esc(a.versao)}` : ''}. Última sincronização: ${quandoFoi(a.ultima)}.${parado && a.id !== idAparelho ? ' Pode ter mudanças paradas nele: abra o app nesse aparelho.' : ''}</small></span></li>`;
    }).join('')}</ul>` : '<p class="mute">Nenhum aparelho registrado ainda. Este aparece depois da próxima sincronização.</p>'}
  </section>`;
  }

  return { secaoHTML, atualizar };
}
