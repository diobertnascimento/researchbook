// Design system v2 (docs/design-system.md): confere o que dá para medir.
// Escala de tipos, alturas de botão, área mínima de toque (WCAG 2.5.8), contraste dos tokens (WCAG 1.4.3 e 1.4.11),
// nenhum estilo solto no código, botão com estado de carregando e Ajustes em subpáginas.
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { googleFalso } from './google-falso.js';
import { geminiFalso } from './gemini-falso.js';

test.use({ serviceWorkers: 'block' });

const TAMANHOS = [12, 13, 14, 16, 18, 22, 26, 30];

async function entrarComDados(page, context) {
  await googleFalso(context);
  await geminiFalso(context);
  await page.goto('/#painel', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.evaluate(() => {
    localStorage.setItem('rb.ia.acesso', 'google');
    localStorage.setItem('rb.ia.projeto', 'projeto-teste');
  });
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb?.sincronia?.estado().fase === 'ok' && window.rb.hojeUI && window.rb.cartoesUI && window.rb.disciplinasUI);
  return page.evaluate(async () => {
    const rb = window.rb;
    const o1 = await rb.biblioteca.adicionar({ titulo: 'Roteirização colaborativa em cooperativas (obra fictícia)', autores: [{ sobrenome: 'Moraes', prenomes: 'Tânia' }], ano: 2024, veiculo: 'Revista de Exemplo' });
    await rb.biblioteca.grifar({ leituraId: o1, pagina: 3, texto: 'A adesão das equipes reduziu conflitos.', rects: [[0, 0.1, 1, 0.1]], funcao: 'evidencia' });
    await rb.dados.salvar('argumentos', { id: 'arg-d', tese: 'A adesão das equipes é o melhor critério.', tipo: 'tese', criadoEm: new Date().toISOString() });
    const t = await rb.escrita.novo();
    await rb.escrita.salvar({ ...t, titulo: 'Texto de exemplo' });
    const d = await rb.disciplinas.salvar({ nome: 'Disciplina de exemplo', docente: 'Docente fictício', semestre: '2026/2' });
    const dia = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    await rb.disciplinas.salvarEvento({ disciplinaId: d.id, tipo: 'entrega', titulo: 'Entrega de exemplo', data: dia, inicio: '23:59', repetir: 'nao' });
    await rb.dados.salvar('cartoes', { id: 'c-d', pergunta: 'O que é rota negociada?', resposta: 'A rota combinada com a equipe.', origem: { tipo: 'grifo', leituraId: o1 }, proxima: new Date(Date.now() - 1000).toISOString(), intervalo: 0, facilidade: 2.5, repeticoes: 0, criadoEm: new Date().toISOString() });
    return { o1, t: t.id, d: d.id };
  });
}

function rotasDe(ids) {
  return ['#painel', '#biblioteca', '#trilhas', '#fichamentos', `#leitor/${ids.o1}`, `#fichamento/${ids.o1}`, '#argumentos', '#escrita', `#texto/${ids.t}`, '#dialogos', '#projeto', '#orientacao', '#disciplinas', `#disciplina/${ids.d}`, '#cartoes', '#autor', '#memoria', '#ajustes/ia', '#ajustes/modelos', '#ajustes/custo', '#ajustes/registros', '#ajustes/aparelho', '#ajustes/agenda', '#ajustes/cores', '#ajustes/pasta', '#conflitos'];
}

async function medir(page) {
  return page.evaluate(() => {
    const visivel = (e) => {
      const b = e.getBoundingClientRect();
      const st = getComputedStyle(e);
      return b.width > 0 && b.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && !e.closest('[hidden],.sr,.textLayer,.pdf-pagina,[aria-hidden="true"]');
    };
    const todos = [...document.querySelectorAll('body *')].filter(visivel);
    const fontes = new Set();
    for (const e of todos) if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) fontes.add(parseFloat(getComputedStyle(e).fontSize));
    const botoes = todos.filter((e) => e.matches('.btn')).map((e) => ({ h: Math.round(e.getBoundingClientRect().height), t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 40) }));
    const alvos = todos
      .filter((e) => e.matches('button, .btn, [role=button], select, input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]):not([type=range])') && !e.closest('.doc, .esc-corpo, p, .busca'))
      .map((e) => { const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), t: (e.textContent || e.getAttribute('aria-label') || e.name || e.className).trim().slice(0, 40) }; })
      .filter((a) => a.w < 24 || a.h < 24);
    return { fontes: [...fontes], botoes, alvos };
  });
}

test('todas as telas usam só a escala de tipos e alvos de pelo menos 24 × 24 px', async ({ page, context }, info) => {
  test.setTimeout(120_000);
  const ids = await entrarComDados(page, context);
  const alturas = info.project.name === 'celular' ? [34, 40, 44] : [28, 34, 40];
  const problemas = [];
  for (const r of rotasDe(ids)) {
    await page.evaluate((h) => { location.hash = h; }, r);
    await page.waitForTimeout(350);
    const m = await medir(page);
    for (const f of m.fontes.filter((x) => !TAMANHOS.includes(x))) problemas.push(`${r}: letra de ${f} px fora da escala`);
    for (const b of m.botoes.filter((x) => !alturas.includes(x.h))) problemas.push(`${r}: botão "${b.t}" com ${b.h} px de altura`);
    for (const a of m.alvos) problemas.push(`${r}: alvo "${a.t}" com ${a.w} × ${a.h} px`);
  }
  expect(problemas).toEqual([]);
});

test('nenhum estilo solto no código: só medidas e cores calculadas ficam no atributo style', async ({}, info) => {
  test.skip(info.project.name !== 'computador', 'Leitura de arquivos; basta uma vez');
  const PERMITIDAS = ['width', 'height', 'min-height', 'max-height', 'left', 'top', 'background', 'background-color', 'border-color', 'grid-template-columns', '--'];
  const ruins = [];
  for (const f of readdirSync('public/js').filter((n) => n.endsWith('.js'))) {
    const s = readFileSync(`public/js/${f}`, 'utf8');
    for (const m of s.matchAll(/ style="((?:[^"$]|\$\{[^}]*\})*)"/g)) {
      const decl = m[1].replace(/\$\{[^}]*\}/g, 'X').split(';').map((d) => d.trim()).filter(Boolean);
      for (const d of decl) if (!PERMITIDAS.some((p) => d.split(':')[0].trim().startsWith(p))) ruins.push(`${f}: ${d}`);
    }
  }
  expect(ruins).toEqual([]);
  const css = readFileSync('public/estilo.css', 'utf8');
  const tamanhosSoltos = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => m[0]);
  expect(tamanhosSoltos, 'tamanho de letra fora dos tokens no estilo.css').toEqual([]);
  expect(readFileSync('public/index.html', 'utf8')).not.toMatch(/<style>/);
});

test('contraste dos tokens: texto com 4,5:1 e contorno de campo com 3:1', async ({ page }, info) => {
  test.skip(info.project.name !== 'computador', 'Tokens são os mesmos nos dois tamanhos');
  await page.goto('/#painel');
  const r = await page.evaluate(() => {
    const v = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const lum = (h) => {
      const c = h.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const cr = (a, b) => { const [x, y] = [lum(v(a)), lum(v(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const pares = [];
    for (const t of ['--texto', '--texto-2', '--texto-3', '--acento', '--perigo', '--sucesso', '--aviso']) for (const f of ['--fundo', '--fundo-lateral', '--superficie', '--superficie-2']) pares.push([t, f, cr(t, f)]);
    pares.push(['--acento-forte', '--acento-suave', cr('--acento-forte', '--acento-suave')]);
    return { texto: pares.filter((p) => p[2] < 4.5), campo: cr('--borda-campo', '--superficie') };
  });
  expect(r.texto).toEqual([]);
  expect(r.campo).toBeGreaterThanOrEqual(3);
});

test('botão de ação longa mostra que está trabalhando e ignora o clique repetido', async ({ page }, info) => {
  test.skip(info.project.name !== 'computador', 'Comportamento igual nos dois tamanhos');
  await page.goto('/#painel');
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  const r = await page.evaluate(async () => {
    const { ouvir } = await import('/js/ui.js');
    const caixa = document.createElement('div');
    caixa.innerHTML = '<button class="btn prim" data-teste-lento data-ocupado="Salvando…">Salvar</button><button class="btn" data-teste-rapido>Rápido</button>';
    document.body.appendChild(caixa);
    let vezes = 0;
    ouvir('click', async (e) => {
      if (e.target.closest('[data-teste-lento]')) { vezes += 1; await new Promise((ok) => setTimeout(ok, 900)); }
      if (e.target.closest('[data-teste-rapido]')) await Promise.resolve();
    });
    const lento = caixa.querySelector('[data-teste-lento]');
    const rapido = caixa.querySelector('[data-teste-rapido]');
    const largura = lento.offsetWidth;
    lento.click();
    rapido.click();
    await new Promise((ok) => setTimeout(ok, 450));
    const durante = { busy: lento.getAttribute('aria-busy'), texto: lento.textContent, largura: lento.offsetWidth >= largura, rapido: rapido.getAttribute('aria-busy') };
    lento.click();
    await new Promise((ok) => setTimeout(ok, 700));
    const depois = { busy: lento.getAttribute('aria-busy'), texto: lento.textContent };
    caixa.remove();
    return { durante, depois, vezes };
  });
  expect(r.durante).toEqual({ busy: 'true', texto: 'Salvando…', largura: true, rapido: null });
  expect(r.depois).toEqual({ busy: null, texto: 'Salvar' });
  expect(r.vezes).toBe(1);
});

test('Ajustes mostra uma seção por vez, com o índice levando a cada uma', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'computador', 'Fluxo igual nos dois tamanhos');
  await entrarComDados(page, context);
  await page.goto('/#ajustes');
  await expect(page.locator('#sec-ia')).toBeVisible();
  await expect(page.locator('#sec-agenda')).toBeHidden();
  await page.locator('.aj-indice').getByRole('link', { name: 'Google Agenda' }).click();
  await expect(page).toHaveURL(/#ajustes\/agenda$/);
  await expect(page.locator('#sec-agenda')).toBeVisible();
  await expect(page.locator('#sec-ia')).toBeHidden();
  await expect(page.locator('.aj-indice a[aria-current="page"]')).toHaveText('Google Agenda');
});
