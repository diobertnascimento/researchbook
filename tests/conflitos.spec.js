// Entrega 6: revisar conflitos de sincronização (o mesmo item mudou em dois aparelhos).
import { test, expect } from '@playwright/test';
import { googleFalso } from './google-falso.js';

test.use({ serviceWorkers: 'block' });

async function entrar(page, context) {
  const g = await googleFalso(context);
  await page.goto('/#painel', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb && window.rb.sincronia && window.rb.sincronia.estado().fase === 'ok');
  return g;
}

/**
 * Cria um conflito de verdade: o item é sincronizado, muda aqui, e "outro aparelho" muda o mesmo item no Drive
 * com hora mais nova. Depois da sincronização, a versão do Drive fica em uso e a daqui vai para os conflitos.
 */
async function criarConflito(page, g, { colecao, inicial, aqui, la }) {
  await page.evaluate(
    async ({ colecao, inicial, aqui }) => {
      await window.rb.dados.salvar(colecao, inicial);
      await window.rb.sincronia.sincronizar();
      await window.rb.dados.salvar(colecao, { ...inicial, ...aqui });
    },
    { colecao, inicial, aqui },
  );
  const doDrive = JSON.parse(g.ler(`dados/${colecao}.json`));
  const i = doDrive.itens.findIndex((x) => x.id === inicial.id);
  doDrive.itens[i] = { ...doDrive.itens[i], ...la, aparelho: 'outro-aparelho', atualizadoEm: new Date(Date.now() + 60_000).toISOString() };
  g.escrever(`dados/${colecao}.json`, JSON.stringify(doDrive));
  await page.evaluate(async () => {
    await window.rb.sincronia.sincronizar();
    await window.rb.conflitosUI.carregar();
    await window.rb.biblioteca.carregar();
    await Promise.all([window.rb.fichUI.carregar(), window.rb.argUI.carregar(), window.rb.trilhasUI.carregar()]);
  });
}

test.describe('no computador', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos rodam no computador; o celular tem teste próprio abaixo'));

  test('sem conflitos, a tela explica e volta aos ajustes', async ({ page, context }) => {
    await entrar(page, context);
    await page.goto('/#ajustes');
    await page.getByRole('link', { name: 'Revisar conflitos' }).click();
    await expect(page.locator('.bib-vazia h2')).toHaveText('Nenhum conflito');
  });

  test('usar a versão guardada: ela volta a valer, vai para o Drive e dá para desfazer', async ({ page, context }) => {
    const g = await entrar(page, context);
    await criarConflito(page, g, { colecao: 'argumentos', inicial: { id: 'a1', tese: 'Versão inicial', tipo: 'tese' }, aqui: { tese: 'Versão deste aparelho', secao: 'capítulo 2' }, la: { tese: 'Versão do outro aparelho' } });

    // O status leva à tela, e Hoje também avisa (no celular o status não aparece).
    await expect(page.locator('#status-drive')).toContainText('1 conflito para revisar');
    await page.goto('/#painel');
    await expect(page.locator('.tambem a').first()).toContainText('Revisar 1 conflito de sincronização');
    await page.locator('#status-drive').getByRole('link').click();
    await expect(page).toHaveURL(/#conflitos$/);

    const card = page.locator('.conf');
    await expect(card).toHaveCount(1);
    await expect(card.locator('.chip')).toHaveText('Argumento');
    await expect(card.locator('h2')).toHaveText('Versão do outro aparelho');
    await expect(card.locator('.conf-l.cab')).toContainText('outro aparelho');
    await expect(card.locator('.conf-l.cab')).toContainText('este aparelho');
    const linhas = card.locator('.conf-l:not(.cab)');
    await expect(linhas).toHaveCount(2); // só o que difere: tese e onde entra no texto
    await expect(linhas.filter({ hasText: 'Tese' })).toContainText('Versão do outro aparelho');
    await expect(linhas.filter({ hasText: 'Tese' })).toContainText('Versão deste aparelho');
    await expect(linhas.filter({ hasText: 'Onde entra no texto' })).toContainText('(vazio)');

    await page.getByRole('button', { name: 'Usar a versão guardada' }).click();
    await expect(page.locator('#toast')).toContainText('Versão guardada em uso');
    await expect(page.locator('.bib-vazia h2')).toHaveText('Nenhum conflito');
    await expect(page.locator('#status-drive')).not.toContainText('conflito');
    const agora = await page.evaluate(() => window.rb.dados.obter('argumentos', 'a1'));
    expect(agora.tese).toBe('Versão deste aparelho');
    expect(agora.secao).toBe('capítulo 2');
    await page.evaluate(() => window.rb.sincronia.sincronizar());
    await expect.poll(() => g.ler('dados/argumentos.json')).toContain('Versão deste aparelho');

    // Desfazer: a versão anterior volta a valer e o conflito reaparece.
    await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.locator('.conf')).toHaveCount(1);
    expect((await page.evaluate(() => window.rb.dados.obter('argumentos', 'a1'))).tese).toBe('Versão do outro aparelho');
  });

  test('manter a versão em uso descarta a guardada, com desfazer; vários de uma vez', async ({ page, context }) => {
    const g = await entrar(page, context);
    await criarConflito(page, g, { colecao: 'trilhas', inicial: { id: 't1', nome: 'Qualificação', itens: [] }, aqui: { nome: 'Qualificação (aqui)' }, la: { nome: 'Qualificação (lá)', prazo: '2026-12-01' } });
    await criarConflito(page, g, { colecao: 'argumentos', inicial: { id: 'a2', tese: 'Inicial' }, aqui: { tese: 'Daqui' }, la: { tese: 'De lá' } });
    await page.goto('/#conflitos');
    await expect(page.locator('.conf')).toHaveCount(2);
    await expect(page.locator('.conf').filter({ hasText: 'Trilha' }).locator('.conf-l').filter({ hasText: 'Prazo' })).toContainText('01/12');

    await page.locator('.conf').filter({ hasText: 'Trilha' }).getByRole('button', { name: 'Manter a versão em uso' }).click();
    await expect(page.locator('.conf')).toHaveCount(1);
    expect((await page.evaluate(() => window.rb.dados.obter('trilhas', 't1'))).nome).toBe('Qualificação (lá)');
    await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.locator('.conf')).toHaveCount(2);

    await page.getByRole('button', { name: 'Manter todas as versões em uso' }).click();
    await expect(page.locator('#toast')).toContainText('2 versões em uso mantidas');
    await expect(page.locator('.bib-vazia h2')).toHaveText('Nenhum conflito');
    expect(await page.evaluate(() => window.rb.dados.conflitos())).toHaveLength(0);
  });

  test('item apagado em outro aparelho: a versão guardada pode ser recuperada', async ({ page, context }) => {
    const g = await entrar(page, context);
    await criarConflito(page, g, {
      colecao: 'grifos',
      inicial: { id: 'g1', leituraId: 'x', pagina: 4, texto: 'as equipes aceitam a rota', rects: [[0, 0, 0.1, 0.01]], funcao: 'evidencia' },
      aqui: { funcao: 'dissert' },
      la: { apagado: true },
    });
    await page.goto('/#conflitos');
    const card = page.locator('.conf');
    await expect(card.locator('.chip')).toHaveText('Grifo');
    await expect(card.locator('h2')).toHaveText('“as equipes aceitam a rota”, p. 4');
    await expect(card.locator('.conf-nota')).toContainText('A versão em uso é a exclusão');
    await card.getByRole('button', { name: 'Recuperar a versão guardada' }).click();
    const g1 = await page.evaluate(() => window.rb.dados.obter('grifos', 'g1'));
    expect(g1.apagado).toBe(false);
    expect(g1.funcao).toBe('dissert');
  });

  test('diferenças de fichamento aparecem com nomes legíveis', async ({ page, context }) => {
    await entrar(page, context);
    const difs = await page.evaluate(() =>
      window.rb.conflitosUI.diferencas(
        { id: 'f', feitos: 4, resumo: 'Resumo A', analise: { problema: 'P1' }, trechos: [{ id: 't1', texto: 'Trecho A', argumento: 'Tese X', argumentoId: 'a' }], atualizadoEm: '2026-11-13T10:00:00Z', aparelho: 'x' },
        { id: 'f', feitos: 4, resumo: 'Resumo B', analise: { problema: 'P1', fraco: 'Amostra pequena' }, trechos: [{ id: 't1', texto: 'Trecho B', argumento: 'Tese X', argumentoId: 'b' }], atualizadoEm: '2026-11-13T11:00:00Z', aparelho: 'y' },
      ),
    );
    expect(difs.map((d) => d.rotulo)).toEqual(['Resumo', 'Trecho 1: texto', 'Análise: onde o texto é fraco ou discutível']);
    expect(difs[2]).toEqual({ rotulo: 'Análise: onde o texto é fraco ou discutível', emUso: '', guardada: 'Amostra pequena' });
  });
});

test('no celular, a tela de conflitos cabe e mostra de que lado é cada versão', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'celular', 'Só no celular');
  const g = await entrar(page, context);
  await criarConflito(page, g, {
    colecao: 'argumentos',
    inicial: { id: 'a1', tese: 'Inicial' },
    aqui: { tese: 'A adesão das equipes às rotas propostas é o critério principal para avaliar o roteirizador nas cooperativas' },
    la: { tese: 'A adesão das equipes é o critério' },
  });
  await page.goto('/#conflitos');
  await expect(page.locator('.conf')).toHaveCount(1);
  await expect(page.locator('.conf-l.cab')).toBeHidden();
  await expect(page.locator('[data-lado="Guardada"]').first()).toBeVisible();
  const larg = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(larg).toBeLessThanOrEqual(page.viewportSize().width);
});
