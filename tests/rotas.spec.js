// Percorre o app inteiro seguindo cada link interno e verifica que nenhuma tela quebra.
// Novas telas entram no teste sozinhas, desde que algum link aponte para elas.
import { test, expect } from '@playwright/test';
import { abrirApp, coletarErros, irPara } from './ajuda.js';

test('todas as telas abrem sem erro e sem rolagem lateral', async ({ page }, info) => {
  const erros = coletarErros(page);
  await abrirApp(page);

  const fila = ['#painel'];
  const visitadas = new Set();
  const problemas = [];

  while (fila.length) {
    const rota = fila.shift();
    if (visitadas.has(rota)) continue;
    visitadas.add(rota);
    await irPara(page, rota);

    const vista = page.locator('#vista');
    if ((await vista.innerText()).trim().length < 20) problemas.push(`${rota}: tela vazia`);
    if ((await page.locator('#vista h1').count()) === 0) problemas.push(`${rota}: sem título (h1)`);

    // No celular, nada pode passar da largura da tela.
    if (info.project.name === 'celular') {
      // Compara com a largura fixa do aparelho: no celular, innerWidth cresce junto com o conteúdo.
      const largura = page.viewportSize().width;
      const sobra = (await page.evaluate(() => document.documentElement.scrollWidth)) - largura;
      if (sobra > 1) problemas.push(`${rota}: ${sobra}px além da largura da tela`);

      // No iPhone, campo com letra menor que 16 px faz o Safari dar zoom ao tocar.
      const pequenos = await page.$$eval('input:not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea', (els) =>
        els.filter((e) => e.getBoundingClientRect().width && parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.placeholder || e.getAttribute('aria-label') || e.tagName),
      );
      if (pequenos.length) problemas.push(`${rota}: campos com letra menor que 16 px (${pequenos.slice(0, 3).join(', ')})`);

      // O texto do leitor precisa ocupar a tela, não uma coluna estreita ao lado de um painel.
      if (rota.startsWith('#leitor/')) {
        const largura = await page.locator('#doc').evaluate((e) => e.getBoundingClientRect().width);
        if (largura < 300) problemas.push(`${rota}: texto do leitor com só ${Math.round(largura)}px de largura`);
      }
    }

    const links = await page.$$eval('a[href^="#"]', (as) => as.map((a) => a.getAttribute('href')));
    for (const h of links) if (h.length > 1 && !visitadas.has(h)) fila.push(h);
  }

  expect(problemas, problemas.join('\n')).toEqual([]);
  expect(erros, erros.join('\n')).toEqual([]);
  // Garante que o percurso realmente andou pelo app.
  expect(visitadas.size).toBeGreaterThan(25);
});

test('rota desconhecida volta para Hoje', async ({ page }) => {
  await abrirApp(page, '#nao-existe');
  await expect(page.locator('#vista .proximo')).toBeVisible();
});

test('versão do app é a mesma do package.json', async ({ page }) => {
  const { default: pacote } = await import('../package.json', { with: { type: 'json' } });
  await abrirApp(page);
  expect(await page.evaluate(() => APP_VERSAO)).toBe(pacote.version);
});
