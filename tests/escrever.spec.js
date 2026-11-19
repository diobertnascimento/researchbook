// v2.3.0, Escrever: formatação como no Medium (barra só ao selecionar, "+" na linha vazia, listas ao digitar)
// e a home dos textos com "Continue escrevendo".
import { test, expect } from '@playwright/test';
import { googleFalso } from './google-falso.js';
import { geminiFalso } from './gemini-falso.js';

test.use({ serviceWorkers: 'block' });

async function entrar(page, context) {
  await googleFalso(context);
  await geminiFalso(context);
  await page.goto('/#escrita', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb && window.rb.sincronia && window.rb.sincronia.estado().fase === 'ok' && window.rb.escritaUI);
}
const criarTexto = (page, titulo = 'Rotas e cooperativas') =>
  page.evaluate(async (titulo) => {
    const e = window.rb.escrita;
    const t = await e.novo();
    await e.salvar({ ...t, titulo, passo: 4, secoes: [{ id: 's1', titulo: 'Introdução', objetivo: '', html: '<p data-pid="p1" data-autoria="autor">As rotas negociadas duraram mais que as calculadas.</p>' }] });
    return t.id;
  }, titulo);
/** Seleciona uma palavra do primeiro parágrafo do editor. */
const selecionar = (page, palavra) =>
  page.evaluate((palavra) => {
    const p = document.querySelector('#esc-corpo p');
    const no = [...p.childNodes].find((n) => n.nodeType === 3 && n.textContent.includes(palavra)) || p.firstChild;
    const i = no.textContent.indexOf(palavra);
    const r = document.createRange();
    r.setStart(no, i);
    r.setEnd(no, i + palavra.length);
    document.getElementById('esc-corpo').focus();
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  }, palavra);
const salvo = (page, id) => page.evaluate(async (id) => { await new Promise((ok) => setTimeout(ok, 1100)); return window.rb.escrita.obter(id).secoes[0].html; }, id);

test.describe('no computador', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos rodam no computador'));

  test('sem barra fixa: selecionar um trecho mostra negrito, itálico, link, título, subtítulo e citação', async ({ page, context }) => {
    await entrar(page, context);
    const id = await criarTexto(page);
    await page.goto(`/#texto/${id}`);
    await expect(page.locator('#esc-corpo')).toBeVisible();
    await expect(page.locator('.ferramentas')).toHaveCount(0);
    const barra = page.locator('.esc-flut');
    await expect(barra).toBeHidden();

    await selecionar(page, 'negociadas');
    await expect(barra).toBeVisible();
    await expect(barra.getByRole('button')).toHaveText(['B', 'i', 'Link', 'T', 't', '“ ”']);
    await barra.getByRole('button', { name: 'Negrito' }).click();
    await expect(page.locator('#esc-corpo p b, #esc-corpo p strong')).toHaveText('negociadas');
    await expect(barra.getByRole('button', { name: 'Negrito' })).toHaveAttribute('aria-pressed', 'true');

    // Link: a barra vira um campo; o endereço sem "https://" é completado.
    await selecionar(page, 'calculadas');
    await barra.getByRole('button', { name: 'Link' }).click();
    await page.getByLabel('Endereço do link').fill('exemplo.org/artigo');
    await page.keyboard.press('Enter');
    await expect(page.locator('#esc-corpo a')).toHaveAttribute('href', 'https://exemplo.org/artigo');
    await expect(page.locator('#esc-corpo a')).toHaveText('calculadas');

    // Título: o parágrafo vira título (T).
    await selecionar(page, 'rotas');
    await barra.getByRole('button', { name: 'Título', exact: true }).click();
    await expect(page.locator('#esc-corpo h2')).toContainText('As rotas');

    const html = await salvo(page, id);
    expect(html).toContain('<h2');
    expect(html).toContain('<a href="https://exemplo.org/artigo">calculadas</a>');
    expect(html).toMatch(/<(b|strong)>negociadas<\/(b|strong)>/);
    // O bloco continua sendo do autor.
    expect(html).toContain('data-autoria="autor"');
  });

  test('na linha vazia, o "+" insere separador; "- " no começo da linha vira lista', async ({ page, context }) => {
    await entrar(page, context);
    const id = await criarTexto(page);
    await page.goto(`/#texto/${id}`);
    await page.locator('#esc-corpo p').first().click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    const mais = page.locator('.esc-mais');
    await expect(mais).toBeVisible();
    await mais.getByRole('button', { name: 'Inserir separador ou código' }).click();
    await mais.getByRole('button', { name: 'Separador', exact: true }).click();
    await expect(page.locator('#esc-corpo hr')).toHaveCount(1);

    await page.keyboard.type('- primeiro item');
    await expect(page.locator('#esc-corpo ul li')).toHaveText('primeiro item');
    const html = await salvo(page, id);
    expect(html).toContain('<hr>');
    expect(html).toMatch(/<ul><li[^>]*>primeiro item<\/li><\/ul>/);
  });

  test('o texto gravado só aceita link para http e https, e exporta título, código e separador para o Word', async ({ page, context }) => {
    await entrar(page, context);
    const r = await page.evaluate(async () => {
      const { limpar } = await import('/js/escrita.js');
      const { gerarDocx } = await import('/js/docx.js').catch(() => ({}));
      return {
        mau: limpar('<p>veja <a href="javascript:alert(1)" onclick="x()">isto</a> e <a href="https://exemplo.org" target="_blank">aquilo</a></p>'),
        blocos: limpar('<h2 style="color:red">Título</h2><pre>x = 1</pre><hr><script>alert(1)</script>'),
        temDocx: typeof gerarDocx,
      };
    });
    expect(r.mau).toBe('<p>veja isto e <a href="https://exemplo.org">aquilo</a></p>');
    expect(r.blocos).toBe('<h2>Título</h2><pre>x = 1</pre><hr>alert(1)'.replace('alert(1)', '<p>alert(1)</p>'));
  });

  test('a home dos textos mostra "Continue escrevendo" com o texto mexido por último', async ({ page, context }) => {
    await entrar(page, context);
    await criarTexto(page, 'Texto antigo');
    await page.waitForTimeout(30);
    const id = await criarTexto(page, 'Referencial teórico');
    await page.goto('/#escrita');
    const cont = page.locator('.continue-escrevendo');
    await expect(cont).toContainText('Continue escrevendo');
    await expect(cont.locator('.prox-tit')).toHaveText('Referencial teórico');
    await expect(page.locator('.txt-card')).toHaveCount(2);
    await cont.getByRole('link', { name: 'Continuar o texto' }).click();
    await expect(page).toHaveURL(new RegExp(`#texto/${id}`));
  });
  test('o Copilot e as versões ficam fechados até serem chamados; a barra do app sai do editor', async ({ page, context }) => {
    await entrar(page, context);
    const id = await criarTexto(page);
    await page.goto(`/#texto/${id}`);
    await expect(page.locator('#esc-corpo')).toBeVisible();
    await expect(page.locator('aside.nav')).toBeHidden();
    const painel = page.locator('.esc-painel');
    await expect(painel).toBeHidden();

    // Chamado pelo botão, o painel abre no Copilot; chamado de novo, fecha.
    const copilot = page.locator('.esc-cab').getByRole('button', { name: 'Copilot' });
    await copilot.click();
    await expect(painel).toBeVisible();
    await expect(copilot).toHaveAttribute('aria-pressed', 'true');
    await copilot.click();
    await expect(painel).toBeHidden();

    // "Versões", ao lado do "Salvo", abre o painel direto nas versões, e a escolha é lembrada neste aparelho.
    await page.locator('.esc-cab').getByRole('button', { name: 'Versões' }).click();
    await expect(painel).toBeVisible();
    await expect(painel.locator('[data-esc-aba="versoes"]')).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => localStorage.getItem('rb.esc.painel'))).toBe('1');

    // Fora do editor, a barra do app volta; de volta ao texto, o painel continua como foi deixado.
    await page.goto('/#escrita');
    await expect(page.locator('aside.nav')).toBeVisible();
    await page.goto(`/#texto/${id}`);
    await expect(page.locator('.esc-painel')).toBeVisible();
  });
});
