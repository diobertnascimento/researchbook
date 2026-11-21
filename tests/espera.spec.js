// v2.18.0: esperas com número. O app mostra o que sabe (bytes, itens, tempo decorrido) e nunca inventa
// uma porcentagem: tempo que anda sozinho, "costuma levar" lido dos registros, barra com a medida real.
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== 'computador', 'Regras sem tela: roda uma vez só');
  await page.addInitScript(() => localStorage.setItem('rb.exemplo', '1'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
});

test('tempo decorrido e tamanho são escritos como se fala', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const m = await import('/js/espera.js');
    return [m.duracao(0), m.duracao(8400), m.duracao(60000), m.duracao(72000), m.duracao(125000), m.tamanho(1258291), m.tamanho(348000), m.tamanho(10)];
  });
  expect(r).toEqual(['0 s', '8 s', '1 min', '1 min 12 s', '2 min 5 s', '1,2 MB', '340 KB', '1 KB']);
});

test('"costuma levar" vem dos registros da própria tarefa e só aparece com histórico', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const m = await import('/js/espera.js');
    const reg = (lista) => ({ lista: () => lista });
    const resp = (tarefa, dur) => ({ evento: 'ia.resposta', det: `${tarefa}, gemini-x, pensamento LOW`, dur });
    m.iniciarEsperas(reg([resp('tutor', 9000), resp('tutor', 7000)]));
    const pouco = m.costuma('tutor');
    m.iniciarEsperas(reg([resp('tutor', 9000), resp('tutor', 7000), resp('tutor', 30000), resp('tutorial', 1), { evento: 'ia.falhou', det: 'tutor, x', dur: 1 }, resp('parecer_projeto', 110000), resp('parecer_projeto', 130000), resp('parecer_projeto', 118000)]));
    const agora = Date.now();
    return { pouco, tutor: m.costuma('tutor'), parecer: m.costuma('parecer_projeto'), nada: m.costuma('dialogo'), html: m.pensandoHTML('Pensando', agora - 4000, { tarefa: 'tutor' }), longo: m.pensandoHTML('Lendo <b>', agora - 300000, { tarefa: 'parecer_projeto' }), sem: m.pensandoHTML('Pensando', agora - 2000, { tarefa: 'dialogo' }) };
  });
  expect([r.pouco, r.tutor, r.parecer, r.nada]).toEqual([null, 9000, 118000, null]);
  expect(r.html).toContain('Pensando há <span data-desde=');
  expect(r.html).toContain('>4 s</span>');
  expect(r.html).toContain('Costuma levar uns 10 s.');
  // Passou do dobro do costume: a tela diz, em vez de fingir que está no prazo. E o rótulo nunca vira HTML.
  expect(r.longo).toContain('Está demorando mais que o normal.');
  expect(r.longo).toContain('Lendo &lt;b&gt; há');
  expect(r.sem).not.toContain('Costuma');
});

test('o tempo na tela anda sozinho, sem a tela ser redesenhada', async ({ page }) => {
  await page.evaluate(async () => {
    const m = await import('/js/espera.js');
    m.iniciarEsperas(null);
    const el = document.createElement('p');
    el.id = 'teste-espera';
    el.innerHTML = m.pensandoHTML('Pensando', Date.now() - 58000);
    document.body.appendChild(el);
  });
  await expect(page.locator('#teste-espera [data-desde]')).toHaveText(/^5[89] s$/);
  await expect(page.locator('#teste-espera [data-desde]')).toHaveText(/^1 min/, { timeout: 5000 });
});

test('download em partes: avisa os bytes reais e a barra só mostra porcentagem quando sabe o total', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const m = await import('/js/espera.js');
    const partes = [new Uint8Array(400000), new Uint8Array(400000), new Uint8Array(200000)];
    const corpo = new ReadableStream({ async pull(c) { const p = partes.shift(); if (!p) return c.close(); await new Promise((ok) => setTimeout(ok, 180)); c.enqueue(p); } });
    const avisos = [];
    // O Drive nem sempre informa o tamanho: vale o que a ficha do PDF guarda.
    const blob = await m.lerComProgresso(new Response(corpo, { headers: { 'content-type': 'application/pdf' } }), (lidos, total) => avisos.push([lidos, total]), 1000000);
    return { avisos, tamanho: blob.size, tipo: blob.type, comTotal: m.barraHTML({ rotulo: 'Baixando o PDF do Drive', feito: 800000, total: 1000000, medida: m.tamanho }), semTotal: m.barraHTML({ rotulo: 'Baixando', feito: 800000, total: 0, medida: m.tamanho }) };
  });
  expect(r.tamanho).toBe(1000000);
  expect(r.tipo).toBe('application/pdf');
  expect(r.avisos.at(-1)).toEqual([1000000, 1000000]);
  expect(r.avisos.every(([l, t], i, a) => t === 1000000 && (i === 0 || l >= a[i - 1][0]))).toBe(true);
  expect(r.avisos.length).toBeGreaterThan(1);
  expect(r.comTotal).toContain('aria-valuenow="80"');
  expect(r.comTotal).toContain('80%');
  expect(r.comTotal).toContain('781 KB de 977 KB');
  expect(r.semTotal).not.toContain('%');
  expect(r.semTotal).not.toContain('progressbar');
});
