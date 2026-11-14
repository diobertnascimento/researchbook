// Etapa 12: Google Agenda. Permissão estreita (calendar.app.created) pedida só ao ligar; agenda "researchbook"
// criada uma vez (id no Drive); eventos com id fixo, enviados de novo quando mudam, apagados quando saem.
import { test, expect } from '@playwright/test';
import { googleFalso, ESCOPO_AGENDA } from './google-falso.js';

test.use({ serviceWorkers: 'block' });
test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxo de dados; a tela de Ajustes já é conferida no celular em outros testes'));

async function entrar(page, context, { ligada = false, ...op } = {}) {
  const g = await googleFalso(context, op);
  await page.goto('/#ajustes', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  if (ligada) await page.evaluate(() => localStorage.setItem('rb.agenda.ligada', '1'));
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb?.sincronia?.estado().fase === 'ok' && window.rb.agendaUI);
  return g;
}
async function eventos(page) {
  return page.evaluate(async () => {
    const d = await window.rb.disciplinas.salvar({ nome: 'Avaliação de Artefatos' });
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const dia = amanha.toISOString().slice(0, 10);
    const aula = await window.rb.disciplinas.salvarEvento({ disciplinaId: d.id, tipo: 'aula', titulo: 'Aula de Avaliação de Artefatos', data: dia, inicio: '19:00', fim: '21:00', repetir: 'semanal', ate: '2027-03-01' });
    const ent = await window.rb.disciplinas.salvarEvento({ disciplinaId: d.id, tipo: 'entrega', titulo: 'Fichamento crítico', data: dia, inicio: '23:59', repetir: 'nao' });
    const est = await window.rb.disciplinas.salvarEvento({ disciplinaId: d.id, tipo: 'estudo', titulo: 'Ler Moraes e Lins', data: dia, inicio: '', repetir: 'nao' });
    return { disc: d.id, aula: aula.id, ent: ent.id, est: est.id };
  });
}
const idGoogle = (id) => `rb${Buffer.from(id).toString('hex')}`;

test('ligar a agenda pede só a permissão estreita, cria a agenda researchbook uma vez e envia os eventos', async ({ page, context }) => {
  const g = await entrar(page, context);
  const ids = await eventos(page);
  await page.goto('/#ajustes/agenda');
  await expect(page.locator('#sec-agenda')).toContainText('Desligada. Os eventos ficam só no researchbook.');
  expect(g.estado.chamadasAgenda).toHaveLength(0);
  await page.getByRole('button', { name: 'Ligar o Google Agenda' }).click();
  await page.waitForFunction(() => window.rb?.agenda?.estado().fase === 'ok');
  expect(g.estado.pedidoDeLogin.scope.split(' ')).toContain(ESCOPO_AGENDA);
  expect(g.estado.pedidoDeLogin.scope).not.toMatch(/auth\/calendar(\s|$)/);
  await expect(page.locator('#sec-agenda')).toContainText('Em dia');

  expect([...g.estado.agendas.values()].map((a) => [a.summary, a.timeZone])).toEqual([['researchbook', 'America/Sao_Paulo']]);
  const aula = g.estado.eventos.get(`${[...g.estado.agendas.keys()][0]}/${idGoogle(ids.aula)}`);
  expect(aula.summary).toBe('Aula de Avaliação de Artefatos');
  expect(aula.start.dateTime).toMatch(/T19:00:00$/);
  expect(aula.end.dateTime).toMatch(/T21:00:00$/);
  expect(aula.start.timeZone).toBe('America/Sao_Paulo');
  expect(aula.recurrence).toEqual(['RRULE:FREQ=WEEKLY;UNTIL=20270301T235959Z']);
  expect(aula.description).toContain('Aula, Avaliação de Artefatos');
  const ent = g.estado.eventos.get(`${[...g.estado.agendas.keys()][0]}/${idGoogle(ids.ent)}`);
  expect(ent.summary).toBe('Entrega: Fichamento crítico');
  const est = g.estado.eventos.get(`${[...g.estado.agendas.keys()][0]}/${idGoogle(ids.est)}`);
  expect(est.start.date).toBeTruthy(); // sem horário: dia todo
  expect(JSON.parse(g.ler('agenda/calendario.json')).id).toBe([...g.estado.agendas.keys()][0]);

  await page.goto(`/#disciplina/${ids.disc}`);
  await expect(page.locator('.ev .g-st.on').first()).toHaveText('✓ No Google Agenda');

  // Uma segunda rodada não envia nada de novo nem cria outra agenda.
  const antes = g.estado.chamadasAgenda.length;
  await page.evaluate(() => window.rb.agenda.sincronizar());
  expect(g.estado.chamadasAgenda.length).toBe(antes);
});

test('editar envia de novo; apagar tira do Google; desfazer devolve; tipo desligado sai; lembrete vale para todos', async ({ page, context }) => {
  const g = await entrar(page, context, { ligada: true });
  const ids = await eventos(page);
  await page.evaluate(() => window.rb.agenda.sincronizar());
  const cal = [...g.estado.agendas.keys()][0];
  const ev = (id) => g.estado.eventos.get(`${cal}/${idGoogle(id)}`);
  expect(ev(ids.ent).status).toBe('confirmed');

  await page.goto(`/#disciplina/${ids.disc}`);
  await page.locator('[data-disc-aba="agenda"]').first().click();
  await page.locator('.ev', { hasText: 'Fichamento crítico' }).getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Título').fill('Fichamento crítico do FEDS');
  await page.locator('.modal').getByRole('button', { name: 'Salvar' }).click();
  await expect.poll(() => ev(ids.ent).summary, { timeout: 8000 }).toBe('Entrega: Fichamento crítico do FEDS');

  await page.locator('.ev', { hasText: 'Fichamento crítico do FEDS' }).getByRole('button', { name: 'Editar' }).click();
  await page.getByRole('button', { name: 'Apagar evento' }).click();
  await expect.poll(() => ev(ids.ent).status, { timeout: 8000 }).toBe('cancelled');
  await page.locator('#toast button', { hasText: 'Desfazer' }).click();
  await expect.poll(() => ev(ids.ent).status, { timeout: 8000 }).toBe('confirmed');

  await page.goto('/#ajustes/agenda');
  await page.getByLabel('Sessões de estudo').uncheck();
  await expect.poll(() => ev(ids.est).status, { timeout: 8000 }).toBe('cancelled');
  await page.getByLabel('Lembrete').selectOption('1h');
  await expect.poll(() => JSON.stringify(ev(ids.aula).reminders), { timeout: 8000 }).toBe(JSON.stringify({ useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] }));
  expect(JSON.parse(g.ler('agenda/calendario.json')).prefs.lembrete).toBe('1h');
});

test('sem a API ativada no Google Cloud, Ajustes diz o que fazer', async ({ page, context }) => {
  await entrar(page, context, { ligada: true, agendaDesligada: true });
  await eventos(page);
  await page.evaluate(() => window.rb.agenda.sincronizar());
  await page.goto('/#ajustes/agenda');
  await expect(page.locator('#sec-agenda .erro-ia')).toContainText('A Google Calendar API não está ativada no projeto do Google Cloud');
});

test('ligada sem a permissão neste login: pede a permissão em vez de falhar', async ({ page, context }) => {
  const g = await entrar(page, context, { escopos: ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/drive.file'] });
  await page.evaluate(() => localStorage.setItem('rb.agenda.ligada', '1'));
  await page.goto('/#painel');
  await page.goto('/#ajustes/agenda');
  await expect(page.locator('#sec-agenda')).toContainText('Falta a permissão da agenda neste login');
  await expect(page.getByRole('button', { name: 'Dar a permissão' })).toBeVisible();
  expect(g.estado.chamadasAgenda).toHaveLength(0);
});
