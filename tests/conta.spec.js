// Login com Google e sincronização com o Drive, contra um Google simulado.
import { test, expect } from '@playwright/test';
import { googleFalso, DRIVE_FILE } from './google-falso.js';

// O service worker atenderia as chamadas antes da simulação; nestes testes ele fica desligado.
test.use({ serviceWorkers: 'block' });
test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Basta rodar no computador'));

const pronto = (page) => page.waitForFunction(() => window.rb && window.rb.pronto);
// A página pode estar no meio do redirecionamento do login: nesse instante não há o que ler, e a conferência tenta de novo.
const fase = (page) => page.evaluate(() => window.rb?.sincronia?.estado().fase ?? null).catch(() => null);

async function entrar(page, rota = '') {
  await page.goto('/' + rota, { waitUntil: 'domcontentloaded' });
  await pronto(page);
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForURL((u) => !u.hash.includes('access_token'));
  await pronto(page);
}

test('sem login, visitantes só veem a tela de entrada', async ({ page }) => {
  await page.goto('/#biblioteca', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toHaveText('Entrar');
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

test('aceita o retorno do Google com os campos em outra ordem', async ({ page, context }) => {
  await googleFalso(context, { ordem: 'token-primeiro' });
  await entrar(page, '#escrita');
  expect(page.url()).not.toContain('access_token');
  expect(page.url()).toContain('#escrita');
  await expect.poll(() => fase(page)).toBe('ok');
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
  await expect.poll(() => fase(page)).toBe('ok');
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
  // A sincronização é ligada um instante depois de o app ficar pronto.
  await expect.poll(() => fase(page)).toBe('ok');
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
  await expect(page.locator('#status-drive button')).toHaveText('Entrar de novo');
});

// v2.14.2: o token do login vale só enquanto a aba está aberta.
test('o token do login não fica guardado no aparelho: só nesta aba, e o app aberto de novo volta a entrar sozinho', async ({ page, context }) => {
  await googleFalso(context);
  await entrar(page);
  await expect.poll(() => fase(page)).toBe('ok');
  const guardado = await page.evaluate(() => ({ fixo: JSON.stringify(localStorage), aba: sessionStorage.getItem('rb.sessao') }));
  expect(guardado.fixo).not.toContain('tok-falso');
  expect(guardado.fixo).not.toContain('rb.sessao');
  expect(JSON.parse(guardado.aba).token).toBe('tok-falso');
  // Recarregar a mesma aba não pede login de novo nem passa pelo Google.
  let passagens = 0;
  context.on('request', (req) => {
    if (req.url().startsWith('https://accounts.google.com/o/oauth2/v2/auth')) passagens++;
  });
  const idas = () => passagens;
  const antes = idas();
  await page.reload();
  await expect.poll(() => fase(page)).toBe('ok');
  expect(idas()).toBe(antes);

  // Abrir o app de novo (outra aba): nenhum token herdado; ele renova em silêncio e entra sem clique.
  const outra = await context.newPage();
  await outra.goto('/#biblioteca', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => fase(outra)).toBe('ok');
  expect(idas()).toBe(antes + 1);
  expect(await outra.evaluate(() => JSON.stringify(localStorage))).not.toContain('tok-falso');
  // Renovação que deu certo não segura a próxima.
  expect(await outra.evaluate(() => localStorage.getItem('rb.renovacao.em'))).toBeNull();
});

test('quem vem de uma versão antiga: a sessão guardada no aparelho passa para a aba e some de lá', async ({ page, context }) => {
  await googleFalso(context);
  await entrar(page);
  await expect.poll(() => fase(page)).toBe('ok');
  // Como a 2.14.1 deixava: a sessão em localStorage.
  await page.evaluate(() => {
    localStorage.setItem('rb.sessao', sessionStorage.getItem('rb.sessao'));
    sessionStorage.removeItem('rb.sessao');
  });
  await page.reload();
  await expect.poll(() => fase(page)).toBe('ok');
  const r = await page.evaluate(() => ({ fixo: localStorage.getItem('rb.sessao'), aba: !!sessionStorage.getItem('rb.sessao') }));
  expect(r).toEqual({ fixo: null, aba: true });
});

test('token emitido para outro app é recusado', async ({ page, context }) => {
  await googleFalso(context, { aud: 'outro-app.apps.googleusercontent.com' });
  await entrar(page);
  await expect(page.locator('[role="alert"]')).toContainText('O login não se completou');
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
  await entrar(page, '#ajustes/pasta');
  await expect.poll(() => fase(page)).toBe('ok');
  await page.locator('#sec-pasta').getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page.locator('h1')).toHaveText('Entrar');
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
  expect(r.esquema).toBeGreaterThanOrEqual(2);
  expect(r.lista.map((l) => l.titulo)).toContain('Guardada no esquema 1');
  expect(r.conflitos).toEqual([]);
});

// v2.9.0: a tela de entrada diz por que a entrada é com Google e o que o app pede, agora e depois.
test('tela de entrada: uma frase, um botão, o que o app pede; depois de sair, avisa que os dados continuam no aparelho', async ({ page, context }) => {
  await googleFalso(context);
  await page.goto('/#painel', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  const caixa = page.locator('.entrar-caixa');
  await expect(caixa).toContainText('ficam numa pasta do seu Google Drive');
  await expect(caixa.locator('.btn')).toHaveCount(1);
  await expect(caixa.locator('.entrar-pede li')).toHaveCount(2);
  await expect(caixa.locator('.entrar-pede')).toContainText('O app não enxerga nenhum outro arquivo seu');
  await expect(caixa.locator('.entrar-pede')).toContainText('Só se você ligar depois, em Ajustes');
  await expect(caixa.locator('.entrar-nota')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  await caixa.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb?.sincronia?.estado().fase === 'ok' && window.rb.biblioteca);
  await page.evaluate(() => window.rb.biblioteca.adicionar({ titulo: 'Obra guardada', autores: [{ sobrenome: 'Lins', prenomes: 'R.' }], ano: 2022 }));
  await page.goto('/#ajustes/pasta');
  await page.locator('#sec-pasta').getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page.locator('h1')).toHaveText('Entrar');
  // Sair não apaga os dados, mas eles só abrem de novo com o login: não há atalho para entrar sem a conta.
  await expect(page.locator('.entrar-nota')).toContainText('Este aparelho já guarda dados do researchbook (1 obra e 0 textos)');
  await expect(page.locator('.entrar-caixa .btn')).toHaveCount(1);
  await expect(page.locator('#vista')).not.toContainText('Obra guardada');
});
