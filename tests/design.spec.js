// Design system v2 (docs/design-system.md): confere o que dá para medir.
// Escala de tipos, alturas de botão, área mínima de toque (WCAG 2.5.8), contraste dos tokens (WCAG 1.4.3 e 1.4.11),
// nenhum estilo solto no código, botão com estado de carregando e Ajustes em subpáginas.
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { googleFalso } from './google-falso.js';
import { geminiFalso } from './gemini-falso.js';

test.use({ serviceWorkers: 'block' });

// v2.0.0: o título de tela no computador subiu para 44 px (redesenho v3).
// v2.2.0: o modo leitura usa 20 px no computador.
const TAMANHOS = [12, 13, 14, 16, 18, 20, 22, 26, 30, 44];

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
  const alturas = info.project.name === 'celular' ? [34, 40, 44] : [30, 38, 44];
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

// Polimento visual (v2.20.0): os testes acima usam títulos curtos. Artigo de verdade tem título de 80 a 200
// caracteres, e era ele que quebrava as telas (o Acervo chegava a 1.904 px numa janela de 1.440).
const LONGO = 'Avaliação de artefatos em design science research aplicada à gestão de resíduos sólidos urbanos: um quadro de referência para estudos em cooperativas de catadores de materiais recicláveis no Brasil (obra fictícia)';

test('título longo não alarga nenhuma tela: a página tem a largura da janela', async ({ page, context }, info) => {
  test.setTimeout(150_000);
  const ids = await entrarComDados(page, context);
  const extra = await page.evaluate(async (LONGO) => {
    const rb = window.rb;
    const o = await rb.biblioteca.adicionar({ tipo: 'artigo', titulo: LONGO, autores: [{ sobrenome: 'Falcão', prenomes: 'Renata' }, { sobrenome: 'Nogueira', prenomes: 'Lia' }, { sobrenome: 'Teixeira', prenomes: 'Marina' }], ano: 2021, veiculo: 'Gestão Pública e Resíduos (fictícia)', projeto: 'Disciplina de exemplo' });
    const t = await rb.escrita.novo();
    await rb.escrita.salvar({ ...t, titulo: `Texto: ${LONGO}`, passo: 4, secoes: [{ id: 's1', titulo: 'Introdução', objetivo: '', html: '<p data-pid="p1" data-autoria="autor">Um parágrafo.</p>' }] });
    const d = await rb.disciplinas.salvar({ nome: 'Métodos Qualitativos de Pesquisa em Administração: Estudos de Caso, Etnografia e Pesquisa-Ação (fictícia)', semestre: '2026/2' });
    await rb.hojeUI.adicionarTarefa(`Reler ${LONGO}`);
    await rb.dados.salvar('argumentos', { id: 'arg-longo', tese: LONGO, tipo: 'tese', criadoEm: new Date().toISOString() });
    return { o, t: t.id, d: d.id };
  }, LONGO);
  const rotas = [...rotasDe(ids), '#acervo', `#acervo/${extra.o}`, `#texto/${extra.t}`, `#disciplina/${extra.d}`, '#dissertacao', '#jornada', '#ajustes/seguranca', '#ajustes/sincronizacao', '#mais'];
  const problemas = [];
  for (const r of rotas) {
    await page.evaluate((h) => { location.hash = h; }, r);
    await page.waitForTimeout(350);
    // No celular, o navegador alarga a área de desenho quando o conteúdo passa: a medida certa é a da janela configurada.
    const janela = page.viewportSize().width;
    const pagina = await page.evaluate(() => document.documentElement.scrollWidth);
    if (pagina > janela + 1) problemas.push(`${r}: página com ${pagina} px numa janela de ${janela}`);
    // v2.21.0: no painel, o título vai até 3 linhas; e todo título de seção tem a mesma letra.
    const t = await page.evaluate(() => {
      const vis = (e) => e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden';
      const painel = [...document.querySelectorAll('.proximo h2')].filter(vis).map((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight) * 10) / 10);
      const secoes = [...document.querySelectorAll('#vista h2')].filter((e) => vis(e) && !e.closest('.proximo, .esc-corpo, .entrar-caixa')).map((e) => { const st = getComputedStyle(e); return `${st.fontFamily.split(',')[0].replace(/['"]/g, '')} ${st.fontSize}/${st.lineHeight} ${st.fontWeight}`; });
      return { painel, secoes: [...new Set(secoes)] };
    });
    for (const linhas of t.painel) if (linhas > 3.1) problemas.push(`${r}: título do painel com ${linhas} linhas`);
    for (const s of t.secoes) if (s !== 'Literata 22px/30px 500') problemas.push(`${r}: título de seção em ${s}`);
    // v2.22.0: um botão azul por tela; botão com fundo ou contorno é pílula; campo com contorno tem um só formato.
    const c = await page.evaluate(() => {
      const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'); };
      const nome = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''} "${(e.innerText || e.getAttribute('aria-label') || e.placeholder || '').trim().slice(0, 24)}"`;
      const azuis = [...document.querySelectorAll('#vista .btn.prim')].filter(vis).map((e) => (e.innerText || '').trim());
      const transparente = (cor) => cor === 'rgba(0, 0, 0, 0)' || cor === 'transparent';
      const quadrados = [...document.querySelectorAll('#vista button, #vista a.btn, #vista label.btn')]
        .filter((e) => vis(e) && !e.matches('.dlg-item, .arg-item, .ach-linha, .lc, .est-t'))
        .filter((e) => { const st = getComputedStyle(e); const borda = parseFloat(st.borderTopWidth) > 0 && st.borderTopStyle !== 'none' && !transparente(st.borderTopColor); return !transparente(st.backgroundColor) || borda; })
        .filter((e) => { const st = getComputedStyle(e); const raio = st.borderTopLeftRadius; return !(raio.endsWith('%') ? parseFloat(raio) >= 50 : parseFloat(raio) >= e.getBoundingClientRect().height / 2 - 0.5); })
        .map(nome);
      const campos = [...document.querySelectorAll('#vista input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]), #vista select, #vista textarea')]
        .filter((e) => vis(e) && parseFloat(getComputedStyle(e).borderTopWidth) > 0 && !transparente(getComputedStyle(e).borderTopColor))
        .filter((e) => { const st = getComputedStyle(e); return st.borderTopLeftRadius !== '10px' || st.borderTopColor !== 'rgb(143, 143, 143)'; })
        .map((e) => `${nome(e)} raio ${getComputedStyle(e).borderTopLeftRadius} contorno ${getComputedStyle(e).borderTopColor}`);
      return { azuis, quadrados: [...new Set(quadrados)], campos: [...new Set(campos)] };
    });
    if (c.azuis.length > 1) problemas.push(`${r}: ${c.azuis.length} botões azuis (${c.azuis.join(', ')})`);
    for (const q of c.quadrados) problemas.push(`${r}: botão fora do formato de pílula: ${q}`);
    for (const q of c.campos) problemas.push(`${r}: campo fora do padrão: ${q}`);
  }
  expect(problemas, `(${info.project.name})\n${problemas.join('\n')}`).toEqual([]);
});

test('a página do editor não herda o estilo de nenhum cartão: sem moldura e sem respiro a mais', async ({ page, context }) => {
  const ids = await entrarComDados(page, context);
  await page.evaluate((h) => { location.hash = h; }, `#texto/${ids.t}`);
  await page.waitForTimeout(400);
  const corpo = await page.evaluate(() => { const st = getComputedStyle(document.body); return { borda: st.borderTopWidth, raio: st.borderTopLeftRadius, respiro: st.paddingTop }; });
  expect(corpo).toEqual({ borda: '0px', raio: '0px', respiro: '0px' });
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
