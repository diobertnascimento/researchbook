// v1.3.0, "nada se perde": lixeira, versões automáticas dos textos, cópia diária neste aparelho
// e a seção Cópias de segurança em Ajustes. Nenhuma dessas ações apaga: restaurar só acrescenta.
import { test, expect } from '@playwright/test';
import { googleFalso } from './google-falso.js';
import { geminiFalso } from './gemini-falso.js';

test.use({ serviceWorkers: 'block' });

const ORIGINAL = '<p data-pid="p1" data-autoria="autor">As rotas negociadas com as equipes duraram mais que as calculadas.</p>';

async function entrar(page, context) {
  const g = await googleFalso(context);
  await geminiFalso(context);
  await page.goto('/#escrita', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb && window.rb.sincronia && window.rb.sincronia.estado().fase === 'ok' && window.rb.segurancaUI);
  return g;
}

const criarTexto = (page, html = ORIGINAL) =>
  page.evaluate(async (html) => {
    const e = window.rb.escrita;
    const t = await e.novo();
    await e.salvar({ ...t, titulo: 'Rotas e cooperativas', passo: 4, secoes: [{ id: 's1', titulo: 'Introdução', objetivo: '', html }] });
    return t.id;
  }, html);

test.describe('no computador', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos rodam no computador'));

  test('lixeira: o texto apagado vai inteiro para a lixeira e volta por Ajustes; o que foi apagado junto volta junto', async ({ page, context }) => {
    await entrar(page, context);
    const id = await criarTexto(page);
    await page.evaluate((id) => window.rb.escrita.apagar(id), id);
    expect(await page.evaluate((id) => window.rb.escrita.obter(id), id)).toBeNull();

    // Uma obra e um grifo apagados em seguida formam um lote.
    const ids = await page.evaluate(async () => {
      const b = window.rb.biblioteca;
      const l = await b.adicionar({ titulo: 'Roteirização colaborativa', autores: [{ sobrenome: 'Moraes', prenomes: 'Tânia' }], ano: 2024 });
      const gr = await b.grifar({ leituraId: l, pagina: 2, texto: 'A adesão subiu de 52% para 88%.', rects: [[0, 0, 1, 1]], funcao: 'evidencia' });
      return { l, g: gr?.id || (await window.rb.dados.listar('grifos'))[0].id };
    });
    await page.waitForTimeout(2100); // outro lote
    await page.evaluate(async ({ l, g }) => { await window.rb.dados.apagar('leituras', l); await window.rb.dados.apagar('grifos', g); }, ids);

    await page.goto('/#ajustes/seguranca');
    const lixeira = page.locator('#seg-lixeira');
    await expect(lixeira.locator('li')).toHaveCount(2);
    await expect(lixeira).toContainText('Rotas e cooperativas');
    await expect(lixeira).toContainText('Roteirização colaborativa');
    await expect(lixeira).toContainText('com mais 1 item ligado');

    await lixeira.locator('li', { hasText: 'Rotas e cooperativas' }).getByRole('button', { name: 'Restaurar' }).click();
    await expect(page.locator('#toast')).toContainText('1 item voltou da lixeira');
    const texto = await page.evaluate((id) => window.rb.escrita.obter(id), id);
    expect(texto.secoes[0].html).toContain('rotas negociadas');

    await page.locator('#seg-lixeira li', { hasText: 'Roteirização colaborativa' }).getByRole('button', { name: 'Restaurar' }).click();
    await expect(page.locator('#toast')).toContainText('2 itens voltaram da lixeira');
    await expect(page.locator('#sec-seguranca')).toContainText('Nada na lixeira.');
    expect(await page.evaluate(async () => [window.rb.biblioteca.leituras().length, (await window.rb.dados.listar('grifos')).length])).toEqual([1, 1]);
    // A lixeira também vai para o Drive, como as outras coleções.
    await page.evaluate(() => window.rb.sincronia.sincronizar());
  });

  test('versões: o app guarda sozinho o estado anterior na primeira mudança, antes de restaurar e antes de receber de outro aparelho', async ({ page, context }) => {
    const g = await entrar(page, context);
    const id = await criarTexto(page);
    await page.goto(`/#texto/${id}`);
    await expect(page.locator('#esc-corpo')).toBeVisible();
    await page.locator('#esc-corpo p').first().click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Texto trocado por engano.');
    await expect.poll(() => page.evaluate((id) => window.rb.dados.versoes.doTexto(id).then((v) => v.length), id)).toBe(1);

    await page.getByRole('tab', { name: 'Versões' }).click();
    await expect(page.locator('.vers-lista li')).toHaveCount(1);
    await expect(page.locator('.vers-lista li')).toContainText('gravada sozinha');
    // A versão também foi para o Drive, sem ninguém pedir.
    await expect.poll(() => g.caminhos().some((c) => c.startsWith(`escrita/${id}/versoes/`))).toBe(true);

    await page.getByRole('button', { name: 'Restaurar' }).first().click();
    await expect(page.locator('#toast')).toContainText('Versão restaurada');
    await expect(page.locator('#esc-corpo')).toContainText('rotas negociadas com as equipes');
    // O texto trocado não se perdeu: virou mais uma versão.
    const versoes = await page.evaluate((id) => window.rb.dados.versoes.doTexto(id), id);
    expect(versoes.map((v) => v.motivo)).toEqual(['antes de restaurar', 'automática']);
    expect(versoes[0].texto.secoes[0].html).toContain('Texto trocado por engano.');

    // O que vem de outro aparelho com outro conteúdo não apaga o daqui: o daqui é guardado antes.
    const n = await page.evaluate(async (id) => {
      const e = window.rb.escrita;
      const local = e.obter(id);
      await e.guardarAntesDeReceber(local, { ...local, secoes: [{ ...local.secoes[0], html: '<p>Escrito no celular.</p>' }] });
      await e.guardarAntesDeReceber(local, { ...local });
      return (await window.rb.dados.versoes.doTexto(id)).filter((v) => v.motivo === 'antes de receber de outro aparelho').length;
    }, id);
    expect(n).toBe(1);
  });

  test('cópias: a cópia do dia é feita sozinha e "Recuperar o que falta" traz de volta sem mexer no que existe', async ({ page, context }) => {
    await entrar(page, context);
    await expect.poll(() => page.evaluate(() => window.rb.dados.copias().then((c) => c.filter((x) => x.motivo === 'diária').length))).toBe(1);
    const id = await criarTexto(page);
    const outro = await criarTexto(page, '<p data-pid="p2" data-autoria="autor">Segundo texto, que continua existindo.</p>');
    await page.evaluate(() => window.rb.dados.backup('antes de um teste'));
    await page.evaluate((id) => window.rb.escrita.apagar(id), id);
    await page.evaluate(async (outro) => { const e = window.rb.escrita; await e.salvar({ ...e.obter(outro), titulo: 'Título novo' }); }, outro);

    await page.goto('/#ajustes/seguranca');
    await expect(page.locator('#sec-seguranca')).toContainText('Feita em');
    const copia = page.locator('#seg-copias li', { hasText: 'antes de um teste' });
    await expect(copia).toContainText('2 textos');
    await copia.getByRole('button', { name: 'Recuperar o que falta' }).click();
    await expect(page.locator('#toast')).toContainText('1 item recuperado');
    const [a, b] = await page.evaluate(([id, outro]) => [window.rb.escrita.obter(id)?.titulo, window.rb.escrita.obter(outro)?.titulo], [id, outro]);
    expect(a).toBe('Rotas e cooperativas');
    expect(b).toBe('Título novo');

    const baixa = page.waitForEvent('download');
    await copia.getByRole('button', { name: 'Baixar' }).click();
    expect((await baixa).suggestedFilename()).toMatch(/^researchbook-copia-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
