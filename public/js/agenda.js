// Google Agenda: os eventos do researchbook (aulas, entregas, orientação, estudo) vão para uma agenda separada
// chamada "researchbook" na conta Google do Diobert.
//
// Permissão: calendar.app.created, a mais estreita da API (o app só cria a própria agenda e mexe nos eventos dela;
// não vê as outras agendas). É pedida só quando o Diobert liga a agenda em Ajustes.
//
// O researchbook manda; o Google Agenda espelha. Cada evento vai com um id fixo derivado do id do researchbook
// (dois aparelhos enviando ao mesmo tempo não duplicam), e guarda a "assinatura" do que foi enviado para saber
// quando precisa enviar de novo. Apagar no researchbook apaga lá.
// O id da agenda e as preferências ficam no Drive (agenda/calendario.json), iguais em todos os aparelhos.
const API = 'https://www.googleapis.com/calendar/v3';
const FUSO = 'America/Sao_Paulo';
const PREFS_PADRAO = { tipos: { aula: true, entrega: true, orientacao: true, estudo: true, outro: true }, lembrete: '1d1h' };
export const LEMBRETES = { '1d1h': '1 dia antes e 1 hora antes', '1h': '1 hora antes', '30m': '30 minutos antes', nenhum: 'Sem lembrete' };
const TIPOS = { aula: 'Aula', entrega: 'Entrega', estudo: 'Sessão de estudo', orientacao: 'Encontro de orientação', outro: 'Outro' };

export class ErroAgenda extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

/** O que importa do evento para o Google: se mudar, envia de novo. */
export function assinatura(e, prefs = PREFS_PADRAO) {
  return JSON.stringify([e.titulo, e.tipo, e.data, e.inicio || '', e.fim || '', e.repetir || 'nao', e.ate || '', (e.excecoes || []).slice().sort(), e.disciplinaId || '', prefs.lembrete]);
}
/** Id do evento no Google: base32hex (0-9, a-v), derivado do id do researchbook. */
export function idGoogle(id) {
  const hex = [...new TextEncoder().encode(id)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `rb${hex}`;
}
const somaDia = (d, n) => {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const somaHora = (h, min) => {
  const [a, b] = h.split(':').map(Number);
  const t = Math.min(a * 60 + b + min, 23 * 60 + 59);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/** Monta o evento no formato da API do Google Agenda. */
export function paraGoogle(e, { nomeProjeto = '', prefs = PREFS_PADRAO } = {}) {
  const diaTodo = !e.inicio;
  const fim = e.fim && e.fim > e.inicio ? e.fim : e.tipo === 'entrega' ? e.inicio : somaHora(e.inicio || '00:00', 60);
  const corpo = {
    id: idGoogle(e.id),
    status: 'confirmed',
    summary: e.tipo === 'entrega' ? `Entrega: ${e.titulo}` : e.titulo,
    description: `${TIPOS[e.tipo] || 'Evento'}${nomeProjeto ? `, ${nomeProjeto}` : ''}. Criado pelo researchbook; mude ou apague lá, para não perder a mudança.`,
    start: diaTodo ? { date: e.data } : { dateTime: `${e.data}T${e.inicio}:00`, timeZone: FUSO },
    end: diaTodo ? { date: somaDia(e.data, 1) } : { dateTime: `${e.data}T${fim}:00`, timeZone: FUSO },
    extendedProperties: { private: { researchbook: e.id } },
    reminders: prefs.lembrete === 'nenhum' ? { useDefault: false, overrides: [] } : { useDefault: false, overrides: { '1d1h': [{ method: 'popup', minutes: 1440 }, { method: 'popup', minutes: 60 }], '1h': [{ method: 'popup', minutes: 60 }], '30m': [{ method: 'popup', minutes: 30 }] }[prefs.lembrete] || [] },
  };
  if (e.repetir === 'semanal') {
    const regra = [`RRULE:FREQ=WEEKLY${e.ate ? `;UNTIL=${e.ate.replace(/-/g, '')}T235959Z` : ''}`];
    for (const x of e.excecoes || []) regra.push(diaTodo ? `EXDATE;VALUE=DATE:${x.replace(/-/g, '')}` : `EXDATE;TZID=${FUSO}:${x.replace(/-/g, '')}T${e.inicio.replace(':', '')}00`);
    corpo.recurrence = regra;
  }
  return corpo;
}

export function criarAgenda({ dados, disc, drive, token, temPermissao, ligada, registrar, aoMudar = () => {} }) {
  let calId = null;
  let prefs = (() => {
    try {
      return { ...PREFS_PADRAO, ...JSON.parse(localStorage.getItem('rb.agenda.prefs') || '{}') };
    } catch {
      return { ...PREFS_PADRAO };
    }
  })();
  const est = { fase: 'parada', erro: null, ultimo: null };
  let rodando = null;
  let depois = null;

  async function chamar(metodo, caminho, corpo) {
    const t = token();
    if (!t) throw new ErroAgenda('sessao', 'O login do Google venceu. Entre de novo para enviar à agenda.');
    let r;
    try {
      r = await fetch(`${API}${caminho}`, { method: metodo, headers: { Authorization: `Bearer ${t}`, ...(corpo ? { 'Content-Type': 'application/json' } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
    } catch {
      throw new ErroAgenda('rede', 'Sem conexão com o Google Agenda. Os eventos vão quando a internet voltar.');
    }
    if (r.ok) return r.status === 204 ? null : r.json();
    const j = await r.json().catch(() => ({}));
    const msg = `${j.error?.message || ''} ${(j.error?.errors || []).map((x) => x.reason).join(' ')} ${(j.error?.details || []).map((x) => x.reason).join(' ')}`;
    if (r.status === 401) throw new ErroAgenda('sessao', 'O login do Google venceu. Entre de novo para enviar à agenda.');
    if (r.status === 403 && /SERVICE_DISABLED|accessNotConfigured|has not been used|disabled/i.test(msg)) throw new ErroAgenda('api', 'A Google Calendar API não está ativada no projeto do Google Cloud. Ative a API e tente de novo.');
    if (r.status === 403 && /insufficient|scope|PERMISSION/i.test(msg)) throw new ErroAgenda('permissao', 'Falta a permissão da agenda no login. Em Ajustes, em Google Agenda, selecione "Ligar o Google Agenda".');
    const e = new ErroAgenda('servico', 'O Google Agenda não respondeu como esperado. Tente de novo em instantes.');
    e.status = r.status;
    throw e;
  }

  async function lerConfig() {
    const d = drive();
    if (!d) return null;
    const txt = await d.ler('agenda/calendario.json');
    if (!txt) return null;
    const j = JSON.parse(txt);
    if (j.prefs) {
      prefs = { ...PREFS_PADRAO, ...j.prefs };
      localStorage.setItem('rb.agenda.prefs', JSON.stringify(prefs));
    }
    return j;
  }
  async function gravarConfig() {
    const d = drive();
    if (d) await d.gravar('agenda/calendario.json', JSON.stringify({ id: calId, prefs, criadoPor: 'researchbook' }, null, 1));
  }

  /** Acha a agenda "researchbook" (pelo id guardado no Drive) ou cria. */
  async function calendario() {
    if (calId) return calId;
    const cfg = await lerConfig();
    if (cfg?.id) {
      try {
        await chamar('GET', `/calendars/${encodeURIComponent(cfg.id)}`);
        calId = cfg.id;
        return calId;
      } catch (e) {
        if (!(e.status === 404 || e.status === 410)) throw e;
      }
    }
    const c = await chamar('POST', '/calendars', { summary: 'researchbook', description: 'Aulas, entregas, orientação e sessões de estudo do researchbook. Mude ou apague os eventos no app.', timeZone: FUSO });
    calId = c.id;
    await gravarConfig();
    registrar('agenda', 'agenda.criada');
    return calId;
  }

  const nomeProjeto = (e) => (e.disciplinaId === 'dissertacao' ? 'Dissertação' : disc.obter(e.disciplinaId)?.nome || '');
  const deveIr = (e) => prefs.tipos[e.tipo] !== false;
  const enviado = (e) => !!e.google && e.google.assinatura === assinatura(e, prefs);

  async function enviarUm(cal, e) {
    const corpo = paraGoogle(e, { nomeProjeto: nomeProjeto(e), prefs });
    try {
      await chamar('PUT', `/calendars/${encodeURIComponent(cal)}/events/${corpo.id}`, corpo);
    } catch (err) {
      if (err.status !== 404) throw err;
      await chamar('POST', `/calendars/${encodeURIComponent(cal)}/events`, corpo);
    }
  }

  /** Envia o que mudou e apaga o que saiu. Uma rodada por vez. */
  function sincronizar() {
    if (!ligada() || !temPermissao() || !drive()) return Promise.resolve(null);
    if (rodando) return rodando;
    rodando = (async () => {
      const inicio = performance.now();
      est.fase = 'enviando';
      est.erro = null;
      aoMudar();
      let enviados = 0;
      let apagados = 0;
      try {
        const cal = await calendario();
        const todos = await dados.listarTudo('eventos');
        for (const e of todos) {
          const apagar = () =>
            chamar('DELETE', `/calendars/${encodeURIComponent(cal)}/events/${idGoogle(e.id)}`).catch((err) => {
              if (![404, 410].includes(err.status)) throw err;
            });
          // Apagado no researchbook (a marca de apagado só guarda o id): apaga lá uma vez.
          if (e.apagado) {
            if (!e.googleApagado) {
              await apagar();
              await dados.salvar('eventos', { ...e, googleApagado: true });
              apagados++;
            }
            continue;
          }
          // Tipo desligado em Ajustes: sai da agenda do Google.
          if (!deveIr(e)) {
            if (e.google) {
              await apagar();
              await dados.salvar('eventos', { ...e, google: null });
              apagados++;
            }
            continue;
          }
          if (enviado(e)) continue;
          await enviarUm(cal, e);
          await dados.salvar('eventos', { ...e, google: { assinatura: assinatura(e, prefs), em: new Date().toISOString() } });
          enviados++;
        }
        est.fase = 'ok';
        est.ultimo = new Date().toISOString();
        if (enviados || apagados) registrar('agenda', 'agenda.sincronizada', { det: `${enviados} enviados, ${apagados} apagados`, dur: Math.round(performance.now() - inicio) });
        if (enviados || apagados) await disc.carregar();
      } catch (err) {
        est.fase = 'erro';
        est.erro = err;
        registrar('erro', 'agenda.falhou', { det: `${err.codigo || ''} ${err.status || ''} ${err.message}`.replace(/\s+/g, ' ').trim(), st: err.codigo === 'rede' ? 'aviso' : 'erro' });
      }
      aoMudar();
      return est;
    })().finally(() => (rodando = null));
    return rodando;
  }
  function agendar() {
    clearTimeout(depois);
    depois = setTimeout(sincronizar, 1500);
  }

  async function mudarPrefs(novas) {
    prefs = { ...prefs, ...novas, tipos: { ...prefs.tipos, ...(novas.tipos || {}) } };
    localStorage.setItem('rb.agenda.prefs', JSON.stringify(prefs));
    registrar('ui', 'agenda.preferencias', { det: `lembrete ${prefs.lembrete}` });
    try {
      if (calId || (await lerConfig())?.id) {
        calId = calId || (await lerConfig()).id;
        await gravarConfig();
      }
    } catch (e) {
      registrar('erro', 'agenda.prefs_drive', { det: e.message, st: 'aviso' });
    }
    agendar();
  }

  return {
    sincronizar,
    agendar,
    estado: () => ({ ...est, ligada: ligada(), permissao: temPermissao() }),
    prefs: () => prefs,
    mudarPrefs,
    situacao: (e) => (!ligada() ? 'desligada' : !deveIr(e) ? 'fora' : enviado(e) ? 'enviado' : 'pendente'),
    pendentes: async () => (await dados.listar('eventos')).filter((e) => deveIr(e) && !enviado(e)).length,
  };
}
