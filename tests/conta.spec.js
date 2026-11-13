// Login com Google e sincronização com o Drive, contra um Google simulado.
import { test, expect } from '@playwright/test';
import { googleFalso, DRIVE_FILE } from './google-falso.js';

// O service worker atenderia as chamadas antes da simulação; nestes testes ele fica desligado.
test.use({ serviceWorkers: 'block' });
test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Basta rodar no computador'));

const pronto = (page) => page.waitForFunction(() => window.rb && window.rb.pronto);
const fase = (page) => page.evaluate(() => window.rb.sincronia?.estado().fase ?? null);

async function entrar(page, rota = '') {
  await page.goto('/' + rota, { waitUntil: 'domcontentloaded' });
  await pronto(page);
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForURL((u) => !u.hash.includes('access_token'));
  await pronto(page);
}

test('sem login, visitantes só veem a tela de entrada', async ({ page }) => {
  await page.goto('/#biblioteca', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toHaveText('Entre para continuar');
  await expect(page.locator('aside.nav')).toBeHidden();
  await expect(page.locator('#vista')).not.toContainText('Goldkuhl');
});

test('login completo: volta para a tela pedida, sem token no endereço, e cria a pasta no Drive', async ({ page, context }) => {
  const g = await googleFalso(context);
  await entrar(page, '#biblioteca');
  expect(page.url()).not.toContain('access_token');
  expect(page.url()).toContain('#biblioteca');
  await expect(page.locator('aside.nav')).toBeVisible();
  await expect.poll(() => fase(page)).toBe('ok');
  await expect(page.locator('#status-drive')).toContainText('Sincronizado às');

  // Pediu só as permissões necessárias, com "state" aleatório.
  expect(g.estado.pedidoDeLogin.scope.split(' ')).toContain(DRIVE_FILE);
  expect(g.estado.pedidoDeLogin.scope).not.toMatch(/auth\/drive(\s|$)/);
  expect(g.estado.pedidoDeLogin.state).toMatch(/^[0-9a-f-]{36}$/);
  expect(g.raiz().name).toBe('researchbook');
  expect(g.caminhos().some((c) => /^registros\/\d{4}-\d{2}-\d{2}\/sessao-.+\.jsonl$/.test(c))).toBe(true);
});

test('o que muda aqui vai para o Drive, e o que muda no Drive chega aqui', async ({ page, context }) => {
  const g = await googleFalso(context);
  await entrar(page);
  await expect.poll(() => fase(page)).toBe('ok');

  await page.evaluate(async () => {
    await window.rb.dados.salvar('leituras', { id: 'l1', titulo: 'Escrito neste aparelho' });
    await window.rb.sincronia.sincronizar();
  });
  expect(g.ler('dados/leituras.json')).toContain('Escrito neste aparelho');

  const doDrive = JSON.parse(g.ler('dados/leituras.json'));
  doDrive.itens[0] = { ...doDrive.itens[0], titulo: 'Mudou no outro aparelho', atualizadoEm: new Date(Date.now() + 1000).toISOString() };
  g.escrever('dados/leituras.json', JSON.stringify(doDrive));
  const lista = await page.evaluate(async () => {
    await window.rb.sincronia.sincronizar();
    return window.rb.dados.listar('leituras');
  });
  expect(lista[0].titulo).toBe('Mudou no outro aparelho');
});

test('apagar chega aos outros aparelhos', async ({ page, context }) => {
  const g = await googleFalso(context);
  await entrar(page);
  await page.evaluate(async () => {
    await window.rb.dados.salvar('cartoes', { id: 'c1', pergunta: 'x' });
    await window.rb.sincronia.sincronizar();
    await window.rb.dados.apagar('cartoes', 'c1');
    await window.rb.sincronia.sincronizar();
  });
  expect(JSON.parse(g.ler('dados/cartoes.json')).itens[0].apagado).toBe(true);
  expect(await page.evaluate(() => window.rb.dados.listar('cartoes'))).toEqual([]);
});

test('mudança nos dois lados: fica a mais recente e a outra é guardada como conflito', async ({ page, context }) => {
  const g = await googleFalso(context);
  await entrar(page);
  await page.evaluate(async () => {
    await window.rb.dados.salvar('argumentos', { id: 'a1', tese: 'versão inicial' });
    await window.rb.sincronia.sincronizar();
    await window.rb.dados.salvar('argumentos', { id: 'a1', tese: 'versão deste aparelho' });
  });
  const doDrive = JSON.parse(g.ler('dados/argumentos.json'));
  doDrive.itens[0] = { ...doDrive.itens[0], tese: 'versão do outro aparelho', atualizadoEm: new Date(Date.now() + 60_000).toISOString() };
  g.escrever('dados/argumentos.json', JSON.stringify(doDrive));

  const r = await page.evaluate(async () => {
    await window.rb.sincronia.sincronizar();
    return { lista: await window.rb.dados.listar('argumentos'), conflitos: await window.rb.dados.conflitos() };
  });
  expect(r.lista[0].tese).toBe('versão do outro aparelho');
  expect(r.conflitos).toHaveLength(1);
  expect(r.conflitos[0].versao.tese).toBe('versão deste aparelho');
  await expect(page.locator('#status-drive')).toContainText('1 conflito');
});

test('sessão vencida: o app continua aberto e oferece reconectar', async ({ page, context }) => {
  const g = await googleFalso(context);
  await entrar(page);
  await expect.poll(() => fase(page)).toBe('ok');
  g.estado.tokenValido = false;
  await page.evaluate(() => window.rb.sincronia.sincronizar());
  expect(await fase(page)).toBe('desconectado');
  await expect(page.locator('body')).not.toHaveClass(/bloqueado/);
  await expect(page.locator('#status-drive button')).toHaveText('Reconectar ao Google');
});

test('token emitido para outro app é recusado', async ({ page, context }) => {
  await googleFalso(context, { aud: 'outro-app.apps.googleusercontent.com' });
  await entrar(page);
  await expect(page.locator('[role="alert"]')).toContainText('não foi emitido para o researchbook');
  await expect(page.locator('body')).toHaveClass(/bloqueado/);
});

test('sem a permissão do Drive, explica como resolver', async ({ page, context }) => {
  await googleFalso(context, { escopos: ['openid', 'https://www.googleapis.com/auth/userinfo.email'] });
  await entrar(page);
  await expect(page.locator('[role="alert"]')).toContainText('marque a permissão do Google Drive');
  await expect(page.locator('body')).toHaveClass(/bloqueado/);
});

test('login cancelado mostra o motivo', async ({ page, context }) => {
  await googleFalso(context, { negar: true });
  await entrar(page);
  await expect(page.locator('[role="alert"]')).toContainText('O login foi cancelado');
});

test('sair revoga o acesso e volta para a tela de entrada', async ({ page, context }) => {
  const g = await googleFalso(context);
  await entrar(page, '#ajustes');
  await expect.poll(() => fase(page)).toBe('ok');
  await page.locator('#sec-pasta').getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page.locator('h1')).toHaveText('Entre para continuar');
  expect(g.estado.revogado).toBe(true);
});

test('o banco antigo (esquema 1) é atualizado sem perder dados', async ({ page }) => {
  await page.goto('/sw.js');
  await page.evaluate(
    () =>
      new Promise((ok, erro) => {
        const req = indexedDB.open('researchbook', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          for (const c of ['leituras', 'grifos', 'fichamentos', 'argumentos', 'trilhas', 'textos', 'dialogos', 'cartoes', 'disciplinas', 'aulas', 'eventos', 'encontros', 'memoria', 'conversas'])
            db.createObjectStore(c, { keyPath: 'id' });
          db.createObjectStore('meta');
          db.createObjectStore('registros', { keyPath: 'n', autoIncrement: true }).createIndex('t', 't');
          db.createObjectStore('backups', { keyPath: 'criadoEm' });
        };
        req.onsuccess = () => {
          const tx = req.result.transaction(['leituras', 'meta'], 'readwrite');
          tx.objectStore('leituras').put({ id: 'antiga', titulo: 'Guardada no esquema 1', atualizadoEm: '2026-11-01T00:00:00.000Z' });
          tx.objectStore('meta').put(1, 'esquemaDados');
          tx.oncomplete = () => {
            req.result.close();
            ok();
          };
        };
        req.onerror = () => erro(req.error);
      }),
  );
  await page.addInitScript(() => localStorage.setItem('rb.exemplo', '1'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await pronto(page);
  const r = await page.evaluate(async () => ({ lista: await window.rb.dados.listar('leituras'), conflitos: await window.rb.dados.conflitos(), esquema: window.rb.dados.esquema }));
  expect(r.esquema).toBe(2);
  expect(r.lista.map((l) => l.titulo)).toContain('Guardada no esquema 1');
  expect(r.conflitos).toEqual([]);
});
