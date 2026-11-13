// Biblioteca real: ABNT, DOI no Crossref, PDF no Drive, leitor com PDF.js e grifos.
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { googleFalso } from './google-falso.js';

const PDF = join(import.meta.dirname, 'fixtures', 'artigo-teste.pdf');
const DOI = '10.9999/teste.2026.001';
const CROSSREF = {
  type: 'journal-article',
  title: ['Roteirização colaborativa para cooperativas de reciclagem'],
  subtitle: ['um estudo fictício'],
  author: [{ family: 'Moraes', given: 'Tânia' }, { family: 'Lins', given: 'Rafael Augusto' }],
  'container-title': ['Revista de Exemplo'],
  volume: '12',
  issue: '3',
  page: '45-67',
  issued: { 'date-parts': [[2024, 5]] },
  DOI,
};

test.use({ serviceWorkers: 'block' });
test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Basta rodar no computador'));

async function crossrefFalso(context) {
  await context.route('https://api.crossref.org/**', (r) => {
    const doi = decodeURIComponent(new URL(r.request().url()).pathname.replace('/works/', ''));
    const cors = { 'access-control-allow-origin': '*' };
    return doi === DOI
      ? r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ message: CROSSREF }) })
      : r.fulfill({ status: 404, headers: cors, body: 'Resource not found.' });
  });
}

async function entrar(page, context) {
  const g = await googleFalso(context);
  await crossrefFalso(context);
  await page.goto('/#biblioteca', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb && window.rb.sincronia && window.rb.sincronia.estado().fase === 'ok');
  return g;
}

test('referências ABNT e citações no formato de 2023', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rb.exemplo', '1'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const r = await page.evaluate(async () => {
    const a = await import('/js/abnt.js');
    const artigo = { tipo: 'artigo', titulo: 'Pragmatism vs interpretivism', autores: [{ sobrenome: 'Goldkuhl', prenomes: 'Göran' }], veiculo: 'European Journal of Information Systems', volume: '21', numero: '2', paginas: '135–146', ano: '2012', doi: '10.1057/ejis.2011.54' };
    const livro = { tipo: 'livro', titulo: 'The analytic hierarchy process', autores: [{ sobrenome: 'Saaty', prenomes: 'Thomas L.' }], local: 'New York', editora: 'McGraw-Hill', ano: '1980' };
    const quatro = { tipo: 'artigo', titulo: 'X', ano: '2007', veiculo: 'Y', autores: ['Peffers', 'Tuunanen', 'Rothenberger', 'Chatterjee'].map((s) => ({ sobrenome: s, prenomes: 'K' })) };
    const semLocal = { tipo: 'livro', titulo: 'Sem dados', autores: [] };
    return {
      artigo: a.referenciaTexto(artigo),
      livro: a.referenciaTexto(livro),
      quatro: a.referenciaTexto(quatro),
      semLocal: a.referenciaTexto(semLocal),
      cit1: a.citacao(artigo, 137),
      cit2: a.citacao({ ...artigo, autores: [...artigo.autores, { sobrenome: 'PRIES-HEJE' }] }),
      cit4: a.citacao(quatro),
    };
  });
  expect(r.artigo).toBe('GOLDKUHL, G. Pragmatism vs interpretivism. European Journal of Information Systems, v. 21, n. 2, p. 135-146, 2012. DOI: 10.1057/ejis.2011.54.');
  expect(r.livro).toBe('SAATY, T. L. The analytic hierarchy process. New York: McGraw-Hill, 1980.');
  expect(r.quatro).toMatch(/^PEFFERS, K\. et al\./);
  expect(r.semLocal).toContain('[S. l.]: [s. n.], [s. d.]');
  expect(r.cit1).toBe('(Goldkuhl, 2012, p. 137)');
  expect(r.cit2).toBe('(Goldkuhl; Pries-Heje, 2012)');
  expect(r.cit4).toBe('(Peffers et al., 2007)');
});

test('biblioteca vazia mostra como começar', async ({ page, context }) => {
  await entrar(page, context);
  await expect(page.locator('.bib-vazia')).toContainText('Sua biblioteca está vazia');
  await expect(page.locator('#vista')).not.toContainText('Goldkuhl');
});

test('adicionar pelo DOI: busca no Crossref, mostra a referência e salva', async ({ page, context }) => {
  const g = await entrar(page, context);
  await page.locator('.bib-vazia [data-bib="adicionar"]').click();
  await page.locator('#ad-doi').fill(`https://doi.org/${DOI}`);
  await page.locator('[data-bib="buscar-doi"]').click();
  await expect(page.locator('#f-titulo')).toHaveValue('Roteirização colaborativa para cooperativas de reciclagem');
  await expect(page.locator('#f-ref')).toContainText('MORAES, T.; LINS, R. A. Roteirização colaborativa para cooperativas de reciclagem: um estudo fictício. Revista de Exemplo, v. 12, n. 3, p. 45-67, 2024.');
  await page.locator('#f-projeto').fill('Dissertação');
  await page.getByRole('button', { name: 'Salvar na biblioteca' }).click();
  await expect(page).toHaveURL(/#leitor\/moraes-2024-/);
  await expect(page.locator('.pdf-aviso')).toContainText('ainda não tem PDF');
  await page.evaluate(() => window.rb.sincronia.sincronizar());
  expect(g.ler('dados/leituras.json')).toContain('Roteirização colaborativa');
});

test('DOI inexistente: explica e deixa preencher à mão', async ({ page, context }) => {
  await entrar(page, context);
  await page.locator('[data-bib="adicionar"]').first().click();
  await page.locator('#ad-doi').fill('10.9999/nao-existe');
  await page.locator('#ad-doi').press('Enter');
  await expect(page.locator('.ad-msg.erro')).toContainText('não foi encontrado');
  await expect(page.locator('#f-titulo')).toBeVisible();
});

test('PDF com DOI: lê, guarda no Drive, abre no leitor e grifa', async ({ page, context }) => {
  const g = await entrar(page, context);
  await page.locator('[data-bib="adicionar"]').first().click();
  await page.locator('#ad-pdf').setInputFiles(PDF);
  await expect(page.locator('.ad-msg.ok')).toContainText('Encontrei o DOI no PDF');
  await expect(page.locator('#f-autores')).toHaveValue('Moraes, Tânia\nLins, Rafael Augusto');
  await page.getByRole('button', { name: 'Salvar na biblioteca' }).click();

  // O PDF aparece desenhado, com a camada de texto.
  await expect(page.locator('.pdf-pagina.pronta canvas').first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.pdf-pagina').first().locator('.textLayer')).toContainText('cooperativas de reciclagem');
  await expect(page.locator('#pdf-pag')).toHaveText('p. 1 de 2');

  // Vai para o Drive.
  await expect.poll(() => g.caminhos().find((c) => /^biblioteca\/pdfs\/moraes-2024-.+\.pdf$/.test(c)) || null).not.toBeNull();
  const caminho = g.caminhos().find((c) => c.startsWith('biblioteca/pdfs/'));
  expect(g.tamanho(caminho)).toBeGreaterThan(1000);

  // Grifar: seleciona uma frase da primeira página e escolhe a cor.
  await page.evaluate(() => {
    const span = [...document.querySelectorAll('.pdf-pagina[data-pagina="1"] .textLayer span')].find((s) => s.textContent.includes('coleta seletiva'));
    const r = document.createRange();
    r.selectNodeContents(span);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    span.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await page.locator('.pop-pdf.on [data-grifo-pdf="evidencia"]').click();
  await expect(page.locator('.pdf-grifo.f-evidencia').first()).toBeVisible();
  const grifos = await page.evaluate(() => window.rb.dados.listar('grifos'));
  expect(grifos).toHaveLength(1);
  expect(grifos[0]).toMatchObject({ pagina: 1, funcao: 'evidencia' });
  expect(grifos[0].texto).toContain('coleta seletiva');
  for (const [x, y, w, h] of grifos[0].rects) for (const v of [x, y, w, h]) expect(v).toBeGreaterThanOrEqual(0) && expect(v).toBeLessThanOrEqual(1);

  // Trocar a cor e apagar com desfazer.
  await page.locator('.pdf-grifo').first().click();
  await page.locator('.menu-grifo [data-mudar-grifo="critica"]').click();
  await expect(page.locator('.pdf-grifo.f-critica').first()).toBeVisible();
  await page.locator('.pdf-grifo').first().click();
  await page.locator('.menu-grifo [data-apagar-grifo]').click();
  await expect(page.locator('.pdf-grifo')).toHaveCount(0);
  await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.locator('.pdf-grifo.f-critica').first()).toBeVisible();
});

test('PDF com DOI que o Crossref não conhece: a ficha aparece para preencher', async ({ page, context }) => {
  await googleFalso(context);
  await context.route('https://api.crossref.org/**', (r) => r.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' }));
  await page.goto('/#biblioteca', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb && window.rb.sincronia && window.rb.sincronia.estado().fase === 'ok');
  await page.locator('[data-bib="adicionar"]').first().click();
  await page.locator('#ad-pdf').setInputFiles(PDF);
  await expect(page.locator('.ad-msg.erro')).toContainText('Encontrei o DOI no PDF, mas');
  await expect(page.locator('#f-titulo')).toHaveValue('Roteirizacao colaborativa (PDF de teste)');
  await expect(page.locator('#f-doi')).toHaveValue(DOI);
  await expect(page.getByRole('button', { name: 'Salvar na biblioteca' })).toBeVisible();
});

test('PDF de outro aparelho é baixado do Drive e fica guardado', async ({ page, context }) => {
  const g = await entrar(page, context);
  await page.locator('[data-bib="adicionar"]').first().click();
  await page.locator('#ad-pdf').setInputFiles(PDF);
  await expect(page.locator('#f-titulo')).not.toHaveValue('');
  await page.getByRole('button', { name: 'Salvar na biblioteca' }).click();
  await expect.poll(() => page.evaluate(() => window.rb.biblioteca.leituras()[0]?.pdf?.driveId || null)).not.toBeNull();

  // Simula outro aparelho: apaga a cópia local do PDF e abre de novo.
  const id = await page.evaluate(async () => {
    const id = window.rb.biblioteca.leituras()[0].id;
    await new Promise((ok) => {
      const req = indexedDB.open('researchbook');
      req.onsuccess = () => {
        const tx = req.result.transaction('arquivos', 'readwrite');
        tx.objectStore('arquivos').delete(id);
        tx.oncomplete = () => ok();
      };
    });
    return id;
  });
  await page.goto('/#biblioteca', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.goto(`/#leitor/${id}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.pdf-pagina.pronta canvas').first()).toBeVisible({ timeout: 15000 });
  expect(g.estado.downloads).toBeGreaterThanOrEqual(1);
});
