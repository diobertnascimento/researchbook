// v2.2.0, Ler e leitor: modo leitura (só o texto, tirado do PDF), grifos que valem nos dois modos,
// tutor fechado por padrão e "Continue lendo" no topo do Ler.
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
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

// v2.19.0: figuras e tabelas no modo leitura. O PDF de teste (tests/fixtures/artigo-figuras.pdf) é fictício e
// não tem nenhuma imagem: a tabela de três réguas, o quadro em grade e o gráfico de barras são desenhados
// com linhas e retângulos, que é o caso em que o modo leitura antes mostrava só o texto embaralhado.
test.describe('figuras e tabelas no modo leitura', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'computador', 'Regras do leitor: roda uma vez só');
    await page.addInitScript(() => localStorage.setItem('rb.exemplo', '1'));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('regras: três réguas iguais viram tabela, desenho denso vira figura, e o que não é figura fica de fora', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { regioesDeFigura } = await import('/js/leitor-texto.js');
      const regua = (y, x = 0.12, w = 0.76) => ({ x, y, w, h: 0.001 });
      const n = (tracos, imagens = []) => regioesDeFigura({ tracos, imagens }).map((c) => [c.y, c.y + c.h].map((v) => Math.round(v * 100) / 100));
      return {
        tabela: n([regua(0.3), regua(0.32), regua(0.45)]),
        // Duas réguas (resumo em destaque) não são tabela; réguas de cabeçalho e rodapé também não.
        duasReguas: n([regua(0.3), regua(0.45)]),
        margens: n([regua(0.05), regua(0.5), regua(0.95)]),
        // Duas tabelas na mesma página não viram uma região só engolindo o texto entre elas.
        duasTabelas: n([regua(0.1), regua(0.12), regua(0.2), regua(0.7), regua(0.72), regua(0.85)]),
        fundoDaPagina: n([{ x: 0, y: 0, w: 1, h: 1 }]),
        sublinhados: n([{ x: 0.2, y: 0.3, w: 0.1, h: 0.001 }, { x: 0.5, y: 0.6, w: 0.08, h: 0.001 }]),
        grafico: n([0, 1, 2, 3, 4, 5].map((i) => ({ x: 0.3 + i * 0.05, y: 0.5, w: 0.03, h: 0.1 + i * 0.01 }))),
        // Uma imagem e o desenho que encosta nela são uma figura só.
        imagemComSetas: n([0, 1, 2, 3, 4].map((i) => ({ x: 0.3 + i * 0.04, y: 0.42, w: 0.02, h: 0.03 })), [{ x: 0.3, y: 0.2, w: 0.4, h: 0.2 }]).length,
      };
    });
    expect(r.tabela).toEqual([[0.3, 0.46]]);
    expect(r.duasReguas).toEqual([]);
    expect(r.margens).toEqual([]);
    expect(r.duasTabelas).toEqual([[0.1, 0.21], [0.7, 0.86]]);
    expect(r.fundoDaPagina).toEqual([]);
    expect(r.sublinhados).toEqual([]);
    expect(r.grafico).toHaveLength(1);
    expect(r.imagemComSetas).toBe(1);
  });

  test('PDF com tabela, quadro e gráfico desenhados: cada um aparece como figura e o texto de dentro não se repete', async ({ page }) => {
    const pdf = readFileSync(join(import.meta.dirname, 'fixtures', 'artigo-figuras.pdf')).toString('base64');
    const r = await page.evaluate(async (b64) => {
      const lt = await import('/js/leitor-texto.js');
      const blob = new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'application/pdf' });
      document.body.innerHTML = '<div id="palco-teste" class="palco"></div>';
      const palco = document.getElementById('palco-teste');
      await lt.montarLeitura({ palco, blob, grifos: [] });
      for (let i = 0; i < 60 && palco.querySelectorAll('.lt-fig').length < 3; i++) await new Promise((ok) => setTimeout(ok, 100));
      const figs = [...palco.querySelectorAll('.lt-fig img')];
      await Promise.all(figs.map((i) => i.decode().catch(() => {})));
      const ordem = [...palco.querySelectorAll('.lt-pagina')[0].children].map((el) => (el.matches('.lt-fig') ? 'FIGURA' : el.textContent.trim().slice(0, 22)));
      return { figuras: figs.map((i) => ({ alt: i.alt, w: i.naturalWidth, h: i.naturalHeight })), texto: palco.innerText, ordem };
    }, pdf);
    expect(r.figuras).toHaveLength(3);
    expect(r.figuras.every((f) => f.alt.startsWith('Figura ou tabela da página') && f.w > 300 && f.h > 60)).toBe(true);
    // O texto corrido e as legendas continuam; as células da tabela e os rótulos do gráfico estão na figura.
    for (const fica of ['Este parágrafo vem antes da tabela', 'Tabela 1 - Produtividade por central', 'Depois da tabela, o texto segue', 'Figura 1 - Toneladas por mês', 'O parágrafo final vem depois do gráfico', 'Quadro 1 - Critérios de avaliação', 'O texto depois do quadro']) expect(r.texto).toContain(fica);
    for (const sai of ['Central Norte', 'Catadores', '141', 'Leste', 'Utilidade', 'Cabe no orçamento']) expect(r.texto).not.toContain(sai);
    // Cada figura entra no lugar dela: depois da legenda, antes do parágrafo seguinte.
    expect(r.ordem).toEqual(['p. 1', 'Indicadores de triagem', 'Este parágrafo vem ante', 'Tabela 1 - Produtivida', 'FIGURA', 'Depois da tabela, o te', 'Figura 1 - Toneladas p', 'FIGURA', 'O parágrafo final vem '].map((t) => t.slice(0, 22)));
  });
});
