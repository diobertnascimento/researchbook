// Funções compartilhadas pelos testes.

// Falhas de rede de recursos externos não contam como erro do app.
const IGNORAR = [/Failed to load resource/i];

/** Começa a coletar erros de JavaScript e do console da página. */
export function coletarErros(page) {
  const erros = [];
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORAR.some((r) => r.test(m.text()))) erros.push(`console: ${m.text()}`);
  });
  return erros;
}

/**
 * Abre o app no modo de exemplo (sem login), sem esperar recursos externos.
 * O modo de exemplo só mostra os dados fictícios do código; os dados reais dependem do login Google.
 */
export async function abrirApp(page, rota = '') {
  await page.addInitScript(() => localStorage.setItem('rb.exemplo', '1'));
  await page.goto('/' + rota, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#vista >> *');
}

/** Troca de rota pelo hash e espera o app redesenhar a tela. */
export async function irPara(page, hash) {
  await page.evaluate(
    (h) =>
      new Promise((ok) => {
        if (location.hash === h) return ok();
        addEventListener('hashchange', () => setTimeout(ok, 0), { once: true });
        location.hash = h;
      }),
    hash,
  );
}
