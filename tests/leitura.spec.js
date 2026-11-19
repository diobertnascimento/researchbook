// v2.2.0, Ler e leitor: modo leitura (só o texto, tirado do PDF), grifos que valem nos dois modos,
// tutor fechado por padrão e "Continue lendo" no topo do Ler.
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { googleFalso } from './google-falso.js';

const PDF = join(import.meta.dirname, 'fixtures', 'artigo-teste.pdf');
const DOI = '10.9999/teste.2026.001';
const CROSSREF = { type: 'journal-article', title: ['Roteirização colaborativa para cooperativas de reciclagem'], author: [{ family: 'Moraes', given: 'Tânia' }, { family: 'Lins', given: 'Rafael Augusto' }], 'container-title': ['Revista de Exemplo'], issued: { 'date-parts': [[2024, 5]] }, DOI };

test.use({ serviceWorkers: 'block' });

async function entrarComPDF(page, context) {
  await googleFalso(context);
  await context.route('https://api.crossref.org/**', (r) => {
    const doi = decodeURIComponent(new URL(r.request().url()).pathname.replace('/works/', ''));
    const cors = { 'access-control-allow-origin': '*' };
    return doi === DOI ? r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ message: CROSSREF }) }) : r.fulfill({ status: 404, headers: cors, body: 'Resource not found.' });
  });
  await page.goto('/#biblioteca', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb && window.rb.sincronia && window.rb.sincronia.estado().fase === 'ok');
  await page.locator('[data-bib="adicionar"]').first().click();
  await page.locator('#ad-pdf').setInputFiles(PDF);
  await expect(page.locator('.ad-msg.ok')).toContainText('Encontrei o DOI no PDF');
  await page.getByRole('button', { name: 'Salvar na biblioteca' }).click();
}

test('no celular, a obra abre no modo leitura: só o texto, em coluna, com a página marcada', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'celular', 'O padrão do celular');
  await entrarComPDF(page, context);
  const texto = page.locator('#pdf-palco .lt');
  await expect(texto).toBeVisible({ timeout: 15000 });
  await expect(texto).toContainText('A coleta seletiva depende de rotas que as equipes aceitem percorrer.');
  await expect(page.locator('.lt-pagina')).toHaveCount(2);
  await expect(page.locator('.lt-pagina').nth(1).locator('.lt-num')).toHaveText('p. 2');
  await expect(page.locator('.pdf-pagina')).toHaveCount(0);
  await expect(page.locator('[data-modo-leitor="leitura"]')).toHaveAttribute('aria-pressed', 'true');
});

test.describe('no computador', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos rodam no computador'));

  test('modo leitura: troca sem perder a página, e o grifo feito num modo aparece no outro', async ({ page, context }) => {
    await entrarComPDF(page, context);
    // No computador o padrão é o PDF.
    await expect(page.locator('.pdf-pagina.pronta canvas').first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Leitura', exact: true }).click();
    const texto = page.locator('#pdf-palco .lt');
    await expect(texto).toContainText('Este texto existe apenas para testar a leitura e os grifos no PDF.', { timeout: 15000 });
    await expect(page.locator('#pdf-pag')).toHaveText('p. 1 de 2');
    expect(await page.evaluate(() => localStorage.getItem('rb.leitor.modo'))).toBe('leitura');

    // Grifar no modo leitura: seleciona o trecho e escolhe a cor.
    await page.evaluate(() => {
      const span = [...document.querySelectorAll('.lt-pagina[data-pagina="1"] .lt-i')].find((s) => s.textContent.includes('coleta seletiva'));
      const r = document.createRange();
      r.selectNodeContents(span);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
      span.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    await page.locator('.pop-pdf.on [data-grifo-pdf="evidencia"]').click();
    await expect(page.locator('.lt-i.f-evidencia').first()).toContainText('coleta seletiva');
    const grifos = await page.evaluate(() => window.rb.dados.listar('grifos'));
    expect(grifos).toHaveLength(1);
    expect(grifos[0]).toMatchObject({ pagina: 1, funcao: 'evidencia' });
    expect(grifos[0].texto).toContain('coleta seletiva');
    for (const [x, y, w, h] of grifos[0].rects) for (const v of [x, y, w, h]) expect(v).toBeGreaterThan(0) && expect(v).toBeLessThan(1);

    // No modo PDF, o mesmo grifo aparece desenhado sobre a página.
    await page.getByRole('button', { name: 'PDF', exact: true }).click();
    await expect(page.locator('.pdf-grifo.f-evidencia').first()).toBeVisible({ timeout: 15000 });
    // E o grifo feito no PDF aparece no modo leitura.
    await page.evaluate(() => {
      const span = [...document.querySelectorAll('.pdf-pagina[data-pagina="1"] .textLayer span')].find((s) => s.textContent.includes('Este texto existe'));
      const r = document.createRange();
      r.selectNodeContents(span);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
      span.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    await page.locator('.pop-pdf.on [data-grifo-pdf="metodo"]').click();
    await expect(page.locator('.pdf-grifo.f-metodo').first()).toBeVisible();
    await page.getByRole('button', { name: 'Leitura', exact: true }).click();
    await expect(page.locator('.lt-i.f-metodo').first()).toContainText('Este texto existe', { timeout: 15000 });
    await expect(page.locator('.lt-i.f-evidencia').first()).toContainText('coleta seletiva');
  });

  test('o tutor fica fechado até ser chamado, e o Ler mostra "Continue lendo" com a página', async ({ page, context }) => {
    await entrarComPDF(page, context);
    await expect(page.locator('.pdf-pagina.pronta canvas').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.leitor-grid')).toHaveClass(/sem-tutor/);
    await expect(page.locator('#tutor-painel')).toBeHidden();
    await page.getByRole('button', { name: 'Tutor' }).click();
    await expect(page.locator('#tutor-painel')).toBeVisible();
    await page.locator('#tutor-painel').getByRole('button', { name: 'Fechar' }).click();
    await expect(page.locator('#tutor-painel')).toBeHidden();

    // A leitura passa a "em andamento" e aparece em destaque no topo do Ler.
    await expect.poll(() => page.evaluate(() => window.rb.biblioteca.leituras()[0].etapa), { timeout: 10_000 }).toBe(1);
    await page.goto('/#biblioteca');
    const cl = page.locator('.continue-lendo');
    await expect(cl).toContainText('Continue lendo');
    await expect(cl).toContainText('Roteirização colaborativa para cooperativas de reciclagem');
    await expect(cl).toContainText('p. 1 de 2');
    await cl.getByRole('link', { name: 'Continuar a leitura' }).click();
    await expect(page).toHaveURL(/#leitor\//);
  });
});
