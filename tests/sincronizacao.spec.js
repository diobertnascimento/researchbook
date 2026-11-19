// v1.5.0, sincronização entre aparelhos: a sessão do Google renova ao voltar para o app, cada aparelho
// registra no Drive quando sincronizou, e o que vem de outro aparelho não é coberto sem virar versão.
import { test, expect } from '@playwright/test';
import { googleFalso } from './google-falso.js';

test.use({ serviceWorkers: 'block' });

async function entrar(page, context, rota = '#painel') {
  const g = await googleFalso(context);
  await page.goto('/' + rota, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb && window.rb.sincronia && window.rb.sincronia.estado().fase === 'ok' && window.rb.sincronizacaoUI);
  return g;
}

test.describe('no computador', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos rodam no computador'));

  test('com o app aberto e a sessão vencida, voltar para a aba renova sozinho e a sincronização continua', async ({ page, context }) => {
    const g = await entrar(page, context);
    await page.evaluate(() => {
      const s = JSON.parse(sessionStorage.getItem('rb.sessao'));
      sessionStorage.setItem('rb.sessao', JSON.stringify({ ...s, expira: Date.now() - 1000 }));
      localStorage.removeItem('rb.renovacao.em');
    });
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))).catch(() => {});
    await page.waitForFunction(() => window.rb?.pronto && window.rb.sincronia?.estado().fase === 'ok' && !!window.rb.google.conectado());
    expect(g.estado.renovacoes).toBe(1);
    expect(page.url()).not.toContain('access_token');
    expect(page.url()).toContain('#painel');
  });

  test('no meio de um campo, a renovação espera: nada é interrompido', async ({ page, context }) => {
    const g = await entrar(page, context, '#biblioteca');
    await page.evaluate(() => {
      const c = document.createElement('input');
      c.id = 'campo-em-uso';
      document.body.appendChild(c);
      c.focus();
      const s = JSON.parse(sessionStorage.getItem('rb.sessao'));
      sessionStorage.setItem('rb.sessao', JSON.stringify({ ...s, expira: Date.now() - 1000 }));
      localStorage.removeItem('rb.renovacao.em');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(500);
    expect(g.estado.renovacoes ?? 0).toBe(0);
    await expect(page.locator('#campo-em-uso')).toBeFocused();
  });

  test('cada aparelho registra no Drive a sua última sincronização, e Ajustes mostra quem está parado', async ({ page, context }) => {
    const g = await entrar(page, context);
    const id = await page.evaluate(() => window.rb.dados.aparelho);
    await expect.poll(() => g.caminhos().includes(`aparelhos/${id}.json`)).toBe(true);
    const meu = [...g.arquivos.values()].find((a) => a.name === `${id}.json`);
    const tresDias = new Date(Date.now() - 3 * 86400000).toISOString();
    g.arquivos.set('arq-outro', { ...meu, id: 'arq-outro', name: 'outro-aparelho.json', conteudo: JSON.stringify({ app: 'researchbook', id: 'outro-aparelho', nome: 'iPhone ou iPad', navegador: 'Safari', versao: '1.4.0', ultima: tresDias }) });

    await page.goto('/#ajustes/sincronizacao');
    const lista = page.locator('#sinc-aparelhos li');
    await expect(lista).toHaveCount(2);
    await expect(lista.first()).toContainText('(este aparelho)');
    await expect(lista.first()).toContainText('Última sincronização: hoje às');
    await expect(lista.nth(1)).toContainText('iPhone ou iPad');
    await expect(lista.nth(1)).toContainText('há 3 dias');
    await expect(lista.nth(1)).toContainText('Pode ter mudanças paradas nele');
    await expect(page.locator('#sec-sincronizacao')).toContainText('Em dia');
    await page.getByRole('button', { name: 'Sincronizar agora' }).click();
    await expect(page.locator('#toast')).toContainText('Sincronizado com o Drive');
  });

  test('o que veio de outro aparelho não é coberto pelo texto que estava aberto: vira versão antes', async ({ page, context }) => {
    await entrar(page, context, '#escrita');
    const r = await page.evaluate(async () => {
      const e = window.rb.escrita;
      const t = await e.novo();
      const sec = (html) => [{ id: 's1', titulo: 'Introdução', objetivo: '', html }];
      await e.salvar({ ...t, titulo: 'Rotas', passo: 4, secoes: sec('<p>Escrito aqui.</p>') });
      // Chega do outro aparelho (direto no banco, como faz a sincronização) e as telas recarregam.
      await window.rb.dados.salvar('textos', { ...e.obter(t.id), secoes: sec('<p>Escrito no celular, bem mais longo.</p>') });
      await e.carregar();
      const fora = e.mudouPorFora(t.id);
      // A tela daqui ainda tinha o texto antigo e grava por cima.
      await e.salvar({ ...e.obter(t.id), secoes: sec('<p>Escrito aqui, com mais uma frase.</p>') });
      return { fora, versoes: (await window.rb.dados.versoes.doTexto(t.id)).map((v) => [v.motivo, v.texto.secoes[0].html]) };
    });
    expect(r.fora).toBe(true);
    expect(r.versoes).toContainEqual(['antes de escrever por cima do que veio de outro aparelho', '<p>Escrito no celular, bem mais longo.</p>']);
  });

  test('primeira abertura num aparelho novo: mostra o andamento do que desce do Drive, e não telas vazias', async ({ page, context }) => {
    await entrar(page, context, '#biblioteca');
    await page.evaluate(async () => {
      await window.rb.biblioteca.adicionar({ titulo: 'Roteirização colaborativa', autores: [{ sobrenome: 'Moraes', prenomes: 'Tânia' }], ano: 2024 });
      await window.rb.sincronia.sincronizar();
    });
    // "Aparelho novo": o mesmo Drive, sem nada guardado no navegador.
    await page.goto('/manifest.webmanifest');
    await page.evaluate(async () => {
      for (const b of await indexedDB.databases()) await new Promise((ok) => { const r = indexedDB.deleteDatabase(b.name); r.onsuccess = r.onerror = r.onblocked = ok; });
      localStorage.clear();
      sessionStorage.clear();
    });
    // Drive lento, para dar tempo de ver a tela.
    await context.route('https://www.googleapis.com/drive/**', async (r) => { await new Promise((ok) => setTimeout(ok, 120)); await r.fallback(); });
    await page.goto('/#biblioteca', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.rb && window.rb.pronto);
    await page.getByRole('button', { name: 'Entrar com Google' }).click();
    const abrindo = page.locator('#abrindo');
    await expect(abrindo).toBeVisible({ timeout: 15_000 });
    await expect(abrindo).toContainText('Abrindo os seus dados');
    await expect(abrindo).toContainText(/Baixando os seus dados: \d+ de \d+ partes/);
    // Quando termina, a tela normal aparece já com a obra.
    await expect(abrindo).toBeHidden({ timeout: 30_000 });
    await expect(page.locator('#vista')).toContainText('Roteirização colaborativa');
  });
});
