// Interações principais: busca, modo foco do leitor, abas da disciplina e grifo.
import { test, expect } from '@playwright/test';
import { abrirApp, coletarErros, irPara } from './ajuda.js';

test('Ctrl K abre a busca e Enter leva ao resultado', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'Atalho de teclado só no computador');
  const erros = coletarErros(page);
  await abrirApp(page);
  await page.keyboard.press('Control+k');
  const campo = page.locator('#qk');
  await expect(campo).toBeFocused();
  await campo.fill('fichamentos');
  await expect(page.locator('#res-busca a').first()).toBeVisible();
  await campo.press('Enter');
  await expect(page.locator('#veu')).not.toHaveClass(/on/);
  expect(page.url()).toContain('#');
  expect(erros).toEqual([]);
});

test('leitor: F liga o modo foco e Esc desliga', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'Atalho de teclado só no computador');
  await abrirApp(page);
  const leitor = await page.$$eval('a[href^="#leitor/"]', (as) => as[0]?.getAttribute('href'));
  expect(leitor, 'nenhum link para o leitor na tela Hoje').toBeTruthy();
  await irPara(page, leitor);
  await page.locator('#vista').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('f');
  await expect(page.locator('body')).toHaveClass(/foco/);
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/foco/);
});

test('disciplina: abas trocam o conteúdo', async ({ page }) => {
  const erros = coletarErros(page);
  await abrirApp(page);
  await irPara(page, '#disciplina/0');
  for (const aba of ['aulas', 'leituras', 'textos', 'agenda', 'geral']) {
    await page.locator(`.subnav [data-disc-aba="${aba}"]`).click();
    await expect(page.locator(`.subnav [data-disc-aba="${aba}"]`)).toHaveClass(/on/);
  }
  expect(erros).toEqual([]);
});

test('leitor: selecionar texto e grifar cria a marcação', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'Seleção por mouse só no computador');
  await abrirApp(page);
  const leitor = await page.$$eval('a[href^="#leitor/"]', (as) => as[0]?.getAttribute('href'));
  await irPara(page, leitor);
  const antes = await page.locator('#doc mark').count();
  // Seleciona as primeiras palavras do primeiro parágrafo sem marcação.
  await page.evaluate(() => {
    const p = [...document.querySelectorAll('#doc p')].find((x) => !x.querySelector('mark') && x.textContent.length > 40);
    const r = document.createRange();
    r.setStart(p.firstChild, 0);
    r.setEnd(p.firstChild, 25);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  const botao = page.locator('[data-grifar]').first();
  await expect(botao).toBeVisible();
  await botao.click();
  await expect(page.locator('#doc mark')).toHaveCount(antes + 1);
});
