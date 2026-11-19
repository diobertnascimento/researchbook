// v1.4.0, confirmação honesta: o app diz onde a mudança está (neste aparelho ou também no Drive),
// conta o que espera para subir, avisa quando uma ação falha e não tem mais botão que só mostra mensagem.
import { test, expect } from '@playwright/test';
import { googleFalso } from './google-falso.js';

test.use({ serviceWorkers: 'block' });

async function entrar(page, context) {
  const g = await googleFalso(context);
  await page.goto('/#biblioteca', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb && window.rb.sincronia && window.rb.sincronia.estado().fase === 'ok' && window.rb.hojeUI);
  return g;
}
const estado = (page) => page.evaluate(() => window.rb.sincronia.estado());

test.describe('no computador', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos rodam no computador'));

  test('dois níveis: a mudança fica "gravada neste aparelho" até subir, e só então a tela diz que sincronizou', async ({ page, context }) => {
    const g = await entrar(page, context);
    await expect(page.locator('#status-drive')).toContainText('Sincronizado às');
    await page.evaluate(() => window.rb.dados.salvar('argumentos', { id: 'a1', tese: 'A adesão vale mais que a quilometragem.' }));
    expect((await estado(page)).pendente).toBe(true);
    await expect(page.locator('#status-drive')).toContainText('Gravado neste aparelho. Enviando ao Drive…');
    // Sobe sozinha, sem ninguém pedir.
    await expect.poll(async () => (await estado(page)).pendente, { timeout: 10_000 }).toBe(false);
    await expect(page.locator('#status-drive')).toContainText('Sincronizado às');
    expect(JSON.parse(g.ler('dados/argumentos.json')).itens[0].tese).toContain('adesão');
  });

  test('sem internet, a tela conta o que espera para subir; quando a conexão volta, sobe sozinho', async ({ page, context }) => {
    const g = await entrar(page, context);
    await context.setOffline(true);
    await page.evaluate(() => dispatchEvent(new Event('offline')));
    await page.evaluate(async () => {
      await window.rb.dados.salvar('argumentos', { id: 'a1', tese: 'Primeira.' });
      await window.rb.dados.salvar('argumentos', { id: 'a2', tese: 'Segunda.' });
    });
    await expect(page.locator('#status-drive')).toContainText('Sem internet: salvo neste aparelho. 2 mudanças sobem quando a conexão voltar.');
    await context.setOffline(false);
    await page.evaluate(() => dispatchEvent(new Event('online')));
    await expect(page.locator('#status-drive')).toContainText('Sincronizado às', { timeout: 10_000 });
    expect((await estado(page)).pendentes).toBe(0);
    expect(JSON.parse(g.ler('dados/argumentos.json')).itens).toHaveLength(2);
  });

  test('o que vem de outro aparelho é anunciado', async ({ page, context }) => {
    const g = await entrar(page, context);
    await page.evaluate(async () => {
      await window.rb.dados.salvar('argumentos', { id: 'a1', tese: 'Feita aqui.' });
      await window.rb.sincronia.sincronizar();
    });
    const arq = JSON.parse(g.ler('dados/argumentos.json'));
    arq.itens.push({ id: 'a2', tese: 'Feita no celular.', atualizadoEm: new Date().toISOString(), aparelho: 'outro-aparelho' });
    g.escrever('dados/argumentos.json', JSON.stringify(arq));
    await page.evaluate(() => window.rb.sincronia.sincronizar());
    await expect(page.locator('#toast')).toContainText('1 mudança veio de outro aparelho');
    expect(await page.evaluate(() => window.rb.dados.listar('argumentos').then((l) => l.length))).toBe(2);
  });

  test('uma ação que falha depois do clique avisa, em vez de parecer que deu certo', async ({ page, context }) => {
    await entrar(page, context);
    await page.evaluate(() => {
      const b = document.createElement('button');
      b.id = 'acao-que-falha';
      b.textContent = 'Ação que falha';
      b.addEventListener('click', () => { Promise.reject(new Error('o banco recusou a gravação')); });
      document.body.appendChild(b);
    });
    await page.locator('#acao-que-falha').click();
    await expect(page.locator('#toast')).toContainText('pode não ter sido gravada');
  });

  test('exportar referências gera um BibTeX de verdade, que o próprio app lê de volta', async ({ page, context }) => {
    await entrar(page, context);
    await page.evaluate(async () => {
      const b = window.rb.biblioteca;
      await b.adicionar({ tipo: 'artigo', titulo: 'Roteirização colaborativa', subtitulo: 'um estudo em cooperativas', autores: [{ sobrenome: 'Moraes', prenomes: 'Tânia' }, { sobrenome: 'Lins', prenomes: 'Rafael' }], ano: 2024, veiculo: 'Revista de Exemplo', volume: '8', paginas: '10-24', doi: '10.5555/exemplo.2024.1' });
      await b.adicionar({ tipo: 'artigo', titulo: 'Outra obra do mesmo ano', autores: [{ sobrenome: 'Moraes', prenomes: 'Tânia' }], ano: 2024 });
    });
    await page.goto('/#ajustes/pasta');
    const baixa = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar referências (BibTeX)' }).click();
    const d = await baixa;
    expect(d.suggestedFilename()).toMatch(/^researchbook-referencias-\d{4}-\d{2}-\d{2}\.bib$/);
    await expect(page.locator('#toast')).toContainText('2 referências exportadas');
    const lido = await page.evaluate(async () => {
      const m = await import('/js/importar.js');
      const bib = m.paraBibTeX(window.rb.biblioteca.leituras());
      return { bib, itens: m.lerBibTeX(bib) };
    });
    expect(lido.bib).toContain('@article{moraes2024,');
    expect(lido.bib).toContain('@article{moraes2024b,');
    expect(lido.bib).toContain('pages = {10--24}');
    expect(lido.bib).toContain('doi = {10.5555/exemplo.2024.1}');
    expect(JSON.stringify(lido.itens)).toContain('Roteirização colaborativa');
  });

  test('com os dados reais abertos, um fichamento que não existe não mostra a tela de exemplo', async ({ page, context }) => {
    await entrar(page, context);
    await page.goto('/#fichamento');
    await expect(page.locator('#vista')).toContainText('Este fichamento não foi encontrado');
    await expect(page.locator('[data-acao="toast"]')).toHaveCount(0);
  });
});
