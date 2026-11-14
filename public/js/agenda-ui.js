// Ajustes > Google Agenda: ligar (pede a permissão da agenda no login), estado do envio, tipos e lembrete.
import { LEMBRETES } from './agenda.js';
import { ouvir } from './ui.js';

/* global toast */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const TIPOS = [
  ['aula', 'Aulas'],
  ['entrega', 'Entregas'],
  ['orientacao', 'Encontros de orientação'],
  ['estudo', 'Sessões de estudo'],
  ['outro', 'Outros'],
];

export function criarAgendaUI({ agenda, google, registrar }) {
  const redesenhar = () => /^#ajustes/.test(location.hash) && window.render?.();

  function secaoHTML() {
    const e = agenda.estado();
    const p = agenda.prefs();
    let status;
    if (!e.ligada) status = '<span class="mute">Desligada. Os eventos ficam só no researchbook.</span>';
    else if (!google.sessao()) status = '<span class="mute">Ligada. Entre com o Google para enviar os eventos.</span>';
    else if (!e.permissao) status = '<span class="aviso-ag">Falta a permissão da agenda neste login. Selecione "Dar a permissão".</span>';
    else if (e.fase === 'enviando') status = '<span role="status">Enviando os eventos…</span>';
    else if (e.fase === 'erro') status = `<div class="erro-ia" role="alert"><p>${esc(e.erro?.message)}</p></div>`;
    else status = `<span class="p-0 t-meta t-texto salvo"><i></i>${e.ultimo ? `Em dia. Última vez às ${new Date(e.ultimo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Ligada à agenda researchbook'}</span>`;
    return `<section id="sec-agenda">
      <h2>Google Agenda</h2>
      <p>Aulas, entregas, encontros de orientação e sessões de estudo que você agenda no researchbook viram eventos na sua conta Google, numa agenda separada chamada researchbook. Se você mudar ou apagar no researchbook, muda ou some lá também. O app não vê as suas outras agendas.</p>
      <div class="ag-linha">${status}
        <span class="ag-bts">${!e.ligada ? '<button class="btn prim" data-ag-ligar>Ligar o Google Agenda</button>' : `${google.sessao() && !e.permissao ? '<button class="btn prim" data-ag-ligar>Dar a permissão</button>' : ''}${e.permissao ? '<button class="btn" data-ag-enviar data-ocupado="Enviando…">Enviar agora</button>' : ''}<button class="btn fant" data-ag-desligar>Desligar</button>`}</span></div>
      ${e.ligada ? `<fieldset class="opcoes ag-tipos"><legend>O que vai para o Google Agenda</legend>${TIPOS.map(([k, n]) => `<label><input type="checkbox" data-ag-tipo="${k}" ${p.tipos[k] !== false ? 'checked' : ''}>${n}</label>`).join('')}</fieldset>
        <div class="larg-estreita campo"><label for="ag-lembrete">Lembrete</label><select id="ag-lembrete" data-ag-lembrete>${Object.entries(LEMBRETES).map(([k, n]) => `<option value="${k}" ${p.lembrete === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>` : ''}
      <details class="ajuda-det"><summary>O que preparar no Google Cloud (uma vez)</summary><ol>
        <li>No projeto do Google Cloud do login, ative a <b>Google Calendar API</b> (APIs e serviços &gt; Biblioteca).</li>
        <li>Em Google Auth Platform &gt; Acesso a dados, adicione a permissão <code>…/auth/calendar.app.created</code>. É a mais estreita: só a agenda que o app cria.</li>
        <li>Volte aqui e selecione "Ligar o Google Agenda". O Google pede a permissão uma vez.</li>
      </ol></details>
    </section>`;
  }

  ouvir('click', async (ev) => {
    const b = ev.target.closest('[data-ag-ligar],[data-ag-desligar],[data-ag-enviar]');
    if (!b) return;
    if (b.dataset.agLigar !== undefined) {
      google.definirAgenda(true);
      registrar('ui', 'agenda.ligar');
      if (!google.temPermissaoAgenda()) return google.entrar({ registrar, comAgenda: true });
      redesenhar();
      await agenda.sincronizar();
      return;
    }
    if (b.dataset.agDesligar !== undefined) {
      google.definirAgenda(false);
      registrar('ui', 'agenda.desligar');
      redesenhar();
      return toast('Google Agenda desligado. Os eventos já enviados continuam lá.');
    }
    if (b.dataset.agEnviar !== undefined) {
      await agenda.sincronizar();
      const e = agenda.estado();
      toast(e.fase === 'erro' ? e.erro.message : 'Agenda em dia');
    }
  });
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.dataset?.agTipo) agenda.mudarPrefs({ tipos: { [t.dataset.agTipo]: t.checked } });
    if (t.dataset?.agLembrete !== undefined) agenda.mudarPrefs({ lembrete: t.value });
  });

  return { secaoHTML };
}
