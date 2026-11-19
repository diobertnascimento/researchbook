// v2.1.0, Hoje: tarefas do dia (lista livre, gravada sozinha e sincronizada) e os prazos com o dia em destaque.
import { test, expect } from '@playwright/test';
import { googleFalso } from './google-falso.js';

test.use({ serviceWorkers: 'block' });

async function entrar(page, context) {
  const g = await googleFalso(context);
  await page.goto('/#painel', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb && window.rb.sincronia && window.rb.sincronia.estado().fase === 'ok' && window.rb.hojeUI);
  return g;
}

test('tarefas do dia: anotar, marcar e apagar são gravados na hora, sobem para o Drive e continuam depois de recarregar', async ({ page, context }) => {
  const g = await entrar(page, context);
  await page.goto('/#painel');
  const tarefas = page.locator('.tarefas');
  await expect(tarefas).toContainText('Nada anotado para hoje.');

  // Anotar pelo teclado: o campo continua pronto para a próxima.
  await page.getByLabel('Nova tarefa').fill('Enviar a seção 3 ao grupo');
  await page.keyboard.press('Enter');
  await expect(tarefas.locator('li')).toHaveCount(1);
  await expect(page.getByLabel('Nova tarefa')).toBeFocused();
  await expect(page.getByLabel('Nova tarefa')).toHaveValue('');
  await page.getByLabel('Nova tarefa').fill('Levar o livro à orientação');
  await tarefas.getByRole('button', { name: 'Adicionar' }).click();
  await expect(tarefas.locator('li')).toHaveCount(2);
  await expect(tarefas.locator('h2')).toContainText('faltam 2');

  // Marcar: só muda na tela depois de gravado.
  await tarefas.getByRole('checkbox', { name: 'Enviar a seção 3 ao grupo' }).check();
  await expect(tarefas.locator('li.feita')).toHaveCount(1);
  await expect(tarefas.locator('h2')).toContainText('falta 1');
  expect(await page.evaluate(() => window.rb.dados.listar('tarefas').then((l) => l.filter((t) => t.feita).length))).toBe(1);

  // Sobem sozinhas para o Drive.
  await expect.poll(() => { try { return JSON.parse(g.ler('dados/tarefas.json')).itens.length; } catch { return 0; } }, { timeout: 10_000 }).toBe(2);

  // Depois de recarregar, a lista é a mesma.
  await page.reload();
  await page.waitForFunction(() => window.rb && window.rb.hojeUI && window.rb.sincronia);
  await expect(page.locator('.tarefas li')).toHaveCount(2);
  await expect(page.locator('.tarefas li.feita')).toContainText('Enviar a seção 3 ao grupo');

  // Apagar manda para a lixeira, com desfazer.
  await page.locator('.tarefas li', { hasText: 'Levar o livro' }).hover();
  await page.getByRole('button', { name: 'Apagar a tarefa: Levar o livro à orientação' }).click();
  await expect(page.locator('.tarefas li')).toHaveCount(1);
  await expect(page.locator('#toast')).toContainText('Tarefa apagada. Ela fica na lixeira.');
  expect(await page.evaluate(() => window.rb.dados.lixeira().then((l) => l.map((x) => x.item.texto)))).toEqual(['Levar o livro à orientação']);
});

test('o que ficou sem fazer continua na lista no dia seguinte; o que foi feito ontem sai', async ({ page, context }) => {
  await entrar(page, context);
  const visiveis = await page.evaluate(async () => {
    const ontem = new Date(Date.now() - 86400000).toISOString();
    await window.rb.dados.salvar('tarefas', { id: 't1', texto: 'Ficou de ontem', feita: false, criadaEm: ontem });
    await window.rb.dados.salvar('tarefas', { id: 't2', texto: 'Feita ontem', feita: true, feitaEm: ontem, criadaEm: ontem });
    await window.rb.hojeUI.carregar();
    window.render();
    return [...document.querySelectorAll('.tarefas li span')].map((e) => e.textContent);
  });
  expect(visiveis).toEqual(['Ficou de ontem']);
});

test('agenda no Hoje: o compromisso de hoje mostra a hora e o prazo mostra o dia em destaque; o último dia fica em vermelho', async ({ page, context }) => {
  await entrar(page, context);
  await page.evaluate(async () => {
    const d = window.rb.disciplinas;
    const disc = await d.salvar({ nome: 'Avaliação de Artefatos' });
    const dia = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('sv');
    await d.salvarEvento({ disciplinaId: disc.id, tipo: 'aula', titulo: 'Seminário 4', data: dia(0), inicio: '14:00', fim: '16:00' });
    await d.salvarEvento({ disciplinaId: disc.id, tipo: 'entrega', titulo: 'Resenha crítica', data: dia(2), inicio: '23:59' });
    await d.salvarEvento({ disciplinaId: disc.id, tipo: 'entrega', titulo: 'Lista de exercícios', data: dia(0), inicio: '18:00' });
    window.render();
  });
  const comp = page.locator('.compromissos li');
  await expect(comp).toHaveCount(1);
  await expect(comp.locator('.hora')).toHaveText('14:00');
  await expect(comp).toContainText('Aula: Seminário 4');
  const prazos = page.locator('.prazos li');
  await expect(prazos).toHaveCount(2);
  await expect(prazos.nth(0)).toContainText('Entrega: Lista de exercícios');
  await expect(prazos.nth(0).locator('small.urg')).toContainText('Hoje, até 18:00');
  await expect(prazos.nth(1)).toContainText('Em 2 dias, até 23:59');
  await expect(prazos.nth(1).locator('.dia-g')).toContainText(String(new Date(Date.now() + 2 * 86400000).getDate()));
  // Os compromissos não aparecem mais misturados em "Também para hoje".
  await expect(page.locator('.tambem')).toHaveCount(0);
});
