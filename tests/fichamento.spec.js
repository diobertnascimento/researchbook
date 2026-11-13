// Fichamento real: cinco etapas alimentadas pelos grifos, salvamento automático e arquivo .md no Drive.
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { googleFalso } from './google-falso.js';

const PDF = join(import.meta.dirname, 'fixtures', 'artigo-teste.pdf');
test.use({ serviceWorkers: 'block' });
test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Basta rodar no computador'));

async function obraComGrifos(page, context) {
  const g = await googleFalso(context);
  await context.route('https://api.crossref.org/**', (r) =>
    r.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'application/json',
      body: JSON.stringify({ message: { type: 'journal-article', title: ['Roteirização colaborativa'], author: [{ family: 'Moraes', given: 'Tânia' }, { family: 'Lins', given: 'Rafael' }], 'container-title': ['Revista de Exemplo'], volume: '12', issue: '3', page: '45-67', issued: { 'date-parts': [[2024]] }, DOI: '10.9999/teste.2026.001' } }),
    }),
  );
  await page.goto('/#biblioteca', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb && window.rb.sincronia && window.rb.sincronia.estado().fase === 'ok');
  await page.locator('[data-bib="adicionar"]').first().click();
  await page.locator('#ad-pdf').setInputFiles(PDF);
  await expect(page.locator('.ad-msg.ok')).toBeVisible();
  await page.getByRole('button', { name: 'Salvar na biblioteca' }).click();
  await expect(page.locator('.pdf-pagina.pronta .textLayer').first()).toContainText('coleta seletiva');
  for (const [trecho, cor] of [
    ['coleta seletiva', 'evidencia'],
    ['Este texto existe', 'dissert'],
  ]) {
    await page.evaluate((t) => {
      const span = [...document.querySelectorAll('.pdf-pagina[data-pagina="1"] .textLayer span')].find((s) => s.textContent.includes(t));
      const r = document.createRange();
      r.selectNodeContents(span);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
      span.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }, trecho);
    await page.locator(`.pop-pdf.on [data-grifo-pdf="${cor}"]`).click();
  }
  await expect(page.locator('.pdf-grifo')).toHaveCount(2);
  const id = await page.evaluate(() => window.rb.biblioteca.leituras()[0].id);
  return { g, id };
}

test('fichamento completo: do grifo ao arquivo no Drive', async ({ page, context }) => {
  const { g, id } = await obraComGrifos(page, context);

  await page.getByRole('button', { name: 'Concluir leitura' }).click();
  await page.getByRole('link', { name: 'Fazer fichamento' }).click();
  await expect(page.locator('.editor h2')).toHaveText('Referência');
  await expect(page.locator('.editor .ref-previa')).toContainText('MORAES, T.; LINS, R. Roteirização colaborativa. Revista de Exemplo');

  await page.getByRole('button', { name: 'Próxima etapa: Citações' }).click();
  await expect(page.locator('.citacao')).toHaveCount(2);
  await page.locator('.citacao').filter({ hasText: 'coleta seletiva' }).getByLabel('Usar como citação').check();
  const porque = page.locator('[data-fich-porque]');
  await porque.fill('Mostra por que a adesão importa.');
  await expect(page.locator('.citacao.on .cit')).toHaveText('(Moraes; Lins, 2024, p. 1)');

  await page.getByRole('button', { name: 'Próxima etapa: Resumo' }).click();
  await page.locator('#fich-resumo').fill('O texto discute rotas de coleta e por que as equipes precisam aceitá-las.');
  await expect(page.locator('#fich-pal')).toHaveText('13 palavras');
  await expect(page.locator('#fich-salvo')).toHaveText('Salvo');

  await page.getByRole('button', { name: 'Próxima etapa: Análise crítica' }).click();
  await expect(page.locator('.painel-lat .grifo-item')).toHaveCount(0); // só método e crítica aparecem aqui
  await page.locator('#fich-problema').fill('Rotas no papel não garantem uso.');

  await page.getByRole('button', { name: 'Próxima etapa: Para a dissertação' }).click();
  const trecho = page.locator('[data-fich-trecho]').first();
  await trecho.fill('A economia simulada não basta');
  await page.locator('.painel-lat .grifo-item').first().click();
  await expect(trecho).toHaveValue('A economia simulada não basta (Moraes; Lins, 2024, p. 1)');
  await page.locator('[data-fich-arg]').first().fill('A adesão das equipes é o critério de avaliação');

  await page.getByRole('button', { name: 'Concluir fichamento' }).click();
  await expect(page.locator('#toast')).toContainText('Fichamento concluído');

  const md = await expect.poll(() => g.ler(`fichamentos/${id}.md`)).not.toBeNull().then(() => g.ler(`fichamentos/${id}.md`));
  expect(md).toContain('# Fichamento: Roteirização colaborativa');
  expect(md).toContain('> "A coleta seletiva depende de rotas que as equipes aceitem percorrer." (Moraes; Lins, 2024, p. 1)');
  expect(md).toContain('Por que importa: Mostra por que a adesão importa.');
  expect(md).toContain('## Resumo');
  expect(md).toContain('### Qual problema o texto enfrenta?');
  expect(md).toContain('(argumento: A adesão das equipes é o critério de avaliação)');

  const r = await page.evaluate(async (id) => ({ args: await window.rb.dados.listar('argumentos'), etapa: window.rb.biblioteca.obter(id).etapa }), id);
  expect(r.args.map((a) => a.tese)).toContain('A adesão das equipes é o critério de avaliação');
  expect(r.etapa).toBe(4);

  await page.goto('/#fichamentos');
  await expect(page.locator('.fich-card')).toContainText('Completo');
});

test('o fichamento fica salvo ao sair e voltar', async ({ page, context }) => {
  const { id } = await obraComGrifos(page, context);
  await page.goto(`/#fichamento/${id}`);
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.getByRole('button', { name: 'Próxima etapa: Citações' }).click();
  await page.getByRole('button', { name: 'Próxima etapa: Resumo' }).click();
  await page.locator('#fich-resumo').fill('Escrito antes de sair.');
  await expect(page.locator('#fich-salvo')).toHaveText('Salvo');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await expect(page.locator('#fich-resumo')).toHaveValue('Escrito antes de sair.');
});

test('corrigir dados da obra a partir do fichamento atualiza a referência', async ({ page, context }) => {
  const { id } = await obraComGrifos(page, context);
  await page.goto(`/#fichamento/${id}`);
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.getByRole('button', { name: 'Corrigir dados da obra' }).click();
  await page.locator('#f-local').fill('Belo Horizonte');
  await page.locator('#f-ano').fill('2025');
  await expect(page.locator('#f-ref')).toContainText('Belo Horizonte, v. 12');
  await page.getByRole('button', { name: 'Salvar correções' }).click();
  await expect(page.locator('.editor .ref-previa')).toContainText('2025');
  await expect(page.locator('.editor .ref-previa')).toContainText('Belo Horizonte');
});
