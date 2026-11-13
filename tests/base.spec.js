// Base do app: funcionamento sem internet, atualização, registros, cópia dos dados e dica do iPhone.
import { test, expect, devices } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { abrirApp, irPara } from './ajuda.js';

const RAIZ = join(import.meta.dirname, '..');
const pronto = (page) => page.waitForFunction(() => window.rb && window.rb.pronto);
const soComputador = ({}, info) => test.skip(info.project.name !== 'computador', 'Basta rodar no computador');

test.describe('service worker', () => {
  test.beforeEach(soComputador);

  test('a versão do service worker é a mesma do app', () => {
    const sw = readFileSync(join(RAIZ, 'public/sw.js'), 'utf8');
    const pacote = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
    expect(sw.match(/const VERSAO = '([^']+)'/)[1]).toBe(pacote.version);
  });

  test('todo arquivo guardado pelo service worker existe', () => {
    const sw = readFileSync(join(RAIZ, 'public/sw.js'), 'utf8');
    const lista = sw.match(/const ARQUIVOS = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map((x) => x.slice(1, -1));
    for (const f of lista.filter((f) => f !== './')) expect(existsSync(join(RAIZ, 'public', f)), f).toBe(true);
  });

  test('depois da primeira visita, o app abre sem internet', async ({ page, context }) => {
    await abrirApp(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#vista h1')).toBeVisible();
    await pronto(page);
    await context.setOffline(false);
  });

  test('o aviso de versão nova aparece com a ação de atualizar', async ({ page }) => {
    await abrirApp(page);
    await pronto(page);
    await page.evaluate(() => window.rb.atualizacao.mostrar(null));
    const aviso = page.locator('#aviso-versao');
    await expect(aviso).toContainText('Nova versão');
    await aviso.getByRole('button', { name: 'Depois' }).click();
    await expect(aviso).toHaveCount(0);
  });
});

test.describe('configuração', () => {
  test.beforeEach(soComputador);

  test('o ID do cliente Google tem o formato certo e nenhuma chave secreta está no código', () => {
    const cfg = readFileSync(join(RAIZ, 'public/js/config.js'), 'utf8');
    expect(cfg).toMatch(/GOOGLE_CLIENT_ID = '\d+-[a-z0-9]{32}\.apps\.googleusercontent\.com'/);
    for (const f of ['public/index.html', ...['config', 'google', 'drive', 'sincronia', 'inicio'].map((n) => `public/js/${n}.js`)]) {
      expect(readFileSync(join(RAIZ, f), 'utf8'), f).not.toMatch(/GOCSPX-|client_secret\s*[:=]\s*['"]/);
    }
  });
});

test.describe('registros', () => {
  test.beforeEach(soComputador);

  test('sessão, navegação e cliques são gravados, sem o texto do usuário', async ({ page }) => {
    await abrirApp(page);
    await pronto(page);
    await irPara(page, '#biblioteca');
    await page.locator('#vista button:visible').first().click();
    const eventos = await page.evaluate(() => window.rb.registros.doBanco());
    const nomes = eventos.map((e) => e.ev);
    expect(nomes).toContain('sessao.inicio');
    expect(nomes).toContain('app.pronto');
    expect(nomes).toContain('ui.navegacao');
    expect(nomes).toContain('ui.clique');
    for (const e of eventos) {
      expect(e.v).toBe(await page.evaluate(() => APP_VERSAO));
      expect(e.det).not.toMatch(/msg=/);
    }
  });

  test('erros de JavaScript viram registro', async ({ page }) => {
    await abrirApp(page);
    await pronto(page);
    await page.evaluate(() => setTimeout(() => { throw new Error('erro-de-teste'); }));
    await expect.poll(() => page.evaluate(() => window.rb.registros.lista().some((e) => e.ev === 'js.erro' && e.det.includes('erro-de-teste')))).toBe(true);
  });

  test('Ajustes mostra os registros reais deste aparelho', async ({ page }) => {
    await abrirApp(page, '#ajustes');
    await pronto(page);
    await expect(page.locator('#sec-registros table')).toContainText('sessao.inicio');
    await expect(page.locator('#sec-aparelho')).toContainText('Versão do app');
  });
});

test.describe('dados neste aparelho', () => {
  test.beforeEach(soComputador);

  test('banco aberto no esquema atual, com backup e cópia completa', async ({ page }) => {
    await abrirApp(page);
    await pronto(page);
    const r = await page.evaluate(async () => {
      const d = window.rb.dados;
      const antes = await d.contarBackups();
      await d.backup('teste');
      const depois = await d.contarBackups();
      const copia = await d.exportar();
      return { disponivel: d.disponivel, antes, depois, app: copia.app, colecoes: Object.keys(copia.colecoes) };
    });
    expect(r.disponivel).toBe(true);
    expect(r.depois).toBe(r.antes + 1);
    expect(r.app).toBe('researchbook');
    expect(r.colecoes).toEqual(expect.arrayContaining(['leituras', 'grifos', 'fichamentos', 'textos', 'memoria']));
  });

  test('guarda no máximo 5 backups', async ({ page }) => {
    await abrirApp(page);
    await pronto(page);
    const n = await page.evaluate(async () => {
      for (let i = 0; i < 7; i++) {
        await window.rb.dados.backup('teste ' + i);
        await new Promise((r) => setTimeout(r, 5));
      }
      return window.rb.dados.contarBackups();
    });
    expect(n).toBe(5);
  });
});

test.describe('iPhone', () => {
  test.use({ userAgent: devices['iPhone 15'].userAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test.beforeEach(soComputador);

  test('mostra a dica de instalação até tocar em Entendi', async ({ page }) => {
    await abrirApp(page);
    await pronto(page);
    const dica = page.locator('#aviso-instalar');
    await expect(dica).toContainText('Adicionar à Tela de Início');
    await dica.getByRole('button', { name: 'Entendi' }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await pronto(page);
    await expect(page.locator('#aviso-instalar')).toHaveCount(0);
  });
});
