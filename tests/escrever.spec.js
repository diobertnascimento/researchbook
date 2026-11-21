// v2.3.0, Escrever: formatação como no Medium (barra só ao selecionar, "+" na linha vazia, listas ao digitar)
// e a home dos textos com "Continue escrevendo".
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { googleFalso } from './google-falso.js';
import { geminiFalso } from './gemini-falso.js';

test.use({ serviceWorkers: 'block' });

async function entrar(page, context) {
  const g = await googleFalso(context);
  await geminiFalso(context);
  await page.goto('/#escrita', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb && window.rb.sincronia && window.rb.sincronia.estado().fase === 'ok' && window.rb.escritaUI);
  return { g };
}
const criarTexto = (page, titulo = 'Rotas e cooperativas') =>
  page.evaluate(async (titulo) => {
    const e = window.rb.escrita;
    const t = await e.novo();
    await e.salvar({ ...t, titulo, passo: 4, secoes: [{ id: 's1', titulo: 'Introdução', objetivo: '', html: '<p data-pid="p1" data-autoria="autor">As rotas negociadas duraram mais que as calculadas.</p>' }] });
    return t.id;
  }, titulo);
/** Seleciona uma palavra do primeiro parágrafo do editor. */
const selecionar = (page, palavra) =>
  page.evaluate((palavra) => {
    const p = document.querySelector('#esc-corpo p');
    const no = [...p.childNodes].find((n) => n.nodeType === 3 && n.textContent.includes(palavra)) || p.firstChild;
    const i = no.textContent.indexOf(palavra);
    const r = document.createRange();
    r.setStart(no, i);
    r.setEnd(no, i + palavra.length);
    document.getElementById('esc-corpo').focus();
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  }, palavra);
const salvo = (page, id) => page.evaluate(async (id) => { await new Promise((ok) => setTimeout(ok, 1100)); return window.rb.escrita.obter(id).secoes[0].html; }, id);

test.describe('no computador', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos rodam no computador'));

  test('sem barra fixa: selecionar um trecho mostra negrito, itálico, link, título, subtítulo e citação', async ({ page, context }) => {
    await entrar(page, context);
    const id = await criarTexto(page);
    await page.goto(`/#texto/${id}`);
    await expect(page.locator('#esc-corpo')).toBeVisible();
    await expect(page.locator('.ferramentas')).toHaveCount(0);
    const barra = page.locator('.esc-flut');
    await expect(barra).toBeHidden();

    await selecionar(page, 'negociadas');
    await expect(barra).toBeVisible();
    await expect(barra.getByRole('button')).toHaveText(['B', 'i', 'Link', 'T', 't', '“ ”']);
    await barra.getByRole('button', { name: 'Negrito' }).click();
    await expect(page.locator('#esc-corpo p b, #esc-corpo p strong')).toHaveText('negociadas');
    await expect(barra.getByRole('button', { name: 'Negrito' })).toHaveAttribute('aria-pressed', 'true');

    // Link: a barra vira um campo; o endereço sem "https://" é completado.
    await selecionar(page, 'calculadas');
    await barra.getByRole('button', { name: 'Link' }).click();
    await page.getByLabel('Endereço do link').fill('exemplo.org/artigo');
    await page.keyboard.press('Enter');
    await expect(page.locator('#esc-corpo a')).toHaveAttribute('href', 'https://exemplo.org/artigo');
    await expect(page.locator('#esc-corpo a')).toHaveText('calculadas');

    // Título: o parágrafo vira título (T).
    await selecionar(page, 'rotas');
    await barra.getByRole('button', { name: 'Título', exact: true }).click();
    await expect(page.locator('#esc-corpo h2')).toContainText('As rotas');

    const html = await salvo(page, id);
    expect(html).toContain('<h2');
    expect(html).toContain('<a href="https://exemplo.org/artigo">calculadas</a>');
    expect(html).toMatch(/<(b|strong)>negociadas<\/(b|strong)>/);
    // O bloco continua sendo do autor.
    expect(html).toContain('data-autoria="autor"');
  });

  test('na linha vazia, o "+" insere separador; "- " no começo da linha vira lista', async ({ page, context }) => {
    await entrar(page, context);
    const id = await criarTexto(page);
    await page.goto(`/#texto/${id}`);
    await page.locator('#esc-corpo p').first().click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    const mais = page.locator('.esc-mais');
    await expect(mais).toBeVisible();
    await mais.getByRole('button', { name: 'Inserir imagem, separador ou código' }).click();
    await mais.getByRole('button', { name: 'Separador', exact: true }).click();
    await expect(page.locator('#esc-corpo hr')).toHaveCount(1);

    await page.keyboard.type('- primeiro item');
    await expect(page.locator('#esc-corpo ul li')).toHaveText('primeiro item');
    const html = await salvo(page, id);
    expect(html).toContain('<hr>');
    expect(html).toMatch(/<ul><li[^>]*>primeiro item<\/li><\/ul>/);
  });

  test('o texto gravado só aceita link para http e https, e exporta título, código e separador para o Word', async ({ page, context }) => {
    await entrar(page, context);
    const r = await page.evaluate(async () => {
      const { limpar } = await import('/js/escrita.js');
      const { gerarDocx } = await import('/js/docx.js').catch(() => ({}));
      return {
        mau: limpar('<p>veja <a href="javascript:alert(1)" onclick="x()">isto</a> e <a href="https://exemplo.org" target="_blank">aquilo</a></p>'),
        blocos: limpar('<h2 style="color:red">Título</h2><pre>x = 1</pre><hr><script>alert(1)</script>'),
        temDocx: typeof gerarDocx,
      };
    });
    expect(r.mau).toBe('<p>veja isto e <a href="https://exemplo.org">aquilo</a></p>');
    expect(r.blocos).toBe('<h2>Título</h2><pre>x = 1</pre><hr>alert(1)'.replace('alert(1)', '<p>alert(1)</p>'));
  });

  test('a home dos textos mostra "Continue escrevendo" com o texto mexido por último', async ({ page, context }) => {
    await entrar(page, context);
    await criarTexto(page, 'Texto antigo');
    await page.waitForTimeout(30);
    const id = await criarTexto(page, 'Referencial teórico');
    await page.goto('/#escrita');
    const cont = page.locator('.continue-escrevendo');
    await expect(cont).toContainText('Continue escrevendo');
    await expect(cont.locator('.prox-tit')).toHaveText('Referencial teórico');
    await expect(page.locator('.txt-card')).toHaveCount(2);
    await cont.getByRole('link', { name: 'Continuar o texto' }).click();
    await expect(page).toHaveURL(new RegExp(`#texto/${id}`));
  });
  test('o Copilot e as versões ficam fechados até serem chamados; a barra do app sai do editor', async ({ page, context }) => {
    await entrar(page, context);
    const id = await criarTexto(page);
    await page.goto(`/#texto/${id}`);
    await expect(page.locator('#esc-corpo')).toBeVisible();
    await expect(page.locator('aside.nav')).toBeHidden();
    const painel = page.locator('.esc-painel');
    await expect(painel).toBeHidden();

    // Chamado pelo botão, o painel abre no Copilot; chamado de novo, fecha.
    const copilot = page.locator('.esc-cab').getByRole('button', { name: 'Copilot' });
    await copilot.click();
    await expect(painel).toBeVisible();
    await expect(copilot).toHaveAttribute('aria-pressed', 'true');
    await copilot.click();
    await expect(painel).toBeHidden();

    // "Versões", ao lado do "Salvo", abre o painel direto nas versões, e a escolha é lembrada neste aparelho.
    await page.locator('.esc-cab').getByRole('button', { name: 'Versões' }).click();
    await expect(painel).toBeVisible();
    await expect(painel.locator('[data-esc-aba="versoes"]')).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => localStorage.getItem('rb.esc.painel'))).toBe('1');

    // Fora do editor, a barra do app volta; de volta ao texto, o painel continua como foi deixado.
    await page.goto('/#escrita');
    await expect(page.locator('aside.nav')).toBeVisible();
    await page.goto(`/#texto/${id}`);
    await expect(page.locator('.esc-painel')).toBeVisible();
  });
});

// v2.10.0, "Pedir": ajuda sobre o parágrafo só quando ele pede; buscar e conferir não usam IA.
test.describe('Pedir, no computador', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos rodam no computador'));

  test('regras: busca por palavras em comum e conferência das citações', async ({ page, context }) => {
    await entrar(page, context);
    const r = await page.evaluate(async () => {
      const m = await import('/js/pedir.js');
      const itens = [
        { texto: 'A adesão das equipes de coleta às rotas negociadas reduziu os conflitos na cooperativa.' },
        { texto: 'O custo do combustível caiu com a rota fixa.' },
        { texto: 'Rotas negociadas com as equipes duram mais.' },
        { texto: 'Texto sobre outro assunto, sem relação.' },
      ];
      const leituras = [{ id: 'l1', titulo: 'Rotas', ano: 2022, autores: [{ sobrenome: 'Lins' }] }, { id: 'l2', titulo: 'Adesão', ano: 2024, autores: [{ sobrenome: 'Moraes' }, { sobrenome: 'Lins' }] }];
      const grifos = [{ texto: 'a adesão é o que mantém a rota em uso ao longo do tempo' }];
      return {
        radicais: m.radicais('As rotas negociadas, porém, não são para todos.'),
        busca: m.buscarNoAcervo('As rotas negociadas com as equipes das cooperativas duraram mais.', itens).map((x) => [x.texto.slice(0, 20), x.comuns]),
        vazio: m.buscarNoAcervo('E então?', itens),
        cit: m.conferirCitacoes('Como mostra Lins (2022), “a adesão é o que mantém a rota em uso ao longo do tempo” (Moraes; Lins, 2024); outros discordam (Silva, 2019; Prado, 2020, p. 3).', leituras, grifos, (l) => l.titulo).map((a) => [a.tipo, a.texto]),
        narrativa: m.conferirCitacoes('Para Lins (2022, p. 7), “a adesão é o que mantém a rota em uso ao longo do tempo”.', leituras, grifos).map((a) => a.tipo),
        comPagina: m.conferirCitacoes('“um trecho que não está em nenhum grifo do acervo” (Lins, 2022, p. 14).', leituras, grifos).map((a) => a.tipo),
      };
    });
    expect(r.radicais).toEqual(['rotas', 'negoci']);
    // Quatro palavras em comum (rotas, negociadas, equipes, cooperativas) vêm antes de três; os outros dois ficam de fora.
    expect(r.busca).toEqual([['A adesão das equipes', 4], ['Rotas negociadas com', 3]]);
    expect(r.vazio).toEqual([]);
    expect(r.cit).toEqual([
      ['ok', 'Moraes; Lins (2024)'],
      ['fora', 'Silva (2019)'],
      ['fora', 'Prado (2020)'],
      ['ok', 'Lins (2022)'],
      ['sem-pagina', '“a adesão é o que mantém a rota em uso ao longo do tempo”'],
    ]);
    expect(r.comPagina).toEqual(['ok', 'sem-grifo']);
    expect(r.narrativa).toEqual(['ok']);
  });

  test('o botão aparece no parágrafo com o cursor; buscar e conferir mostram o resultado fora do texto, sem chamar a IA', async ({ page, context }) => {
    await entrar(page, context);
    const pedidos = [];
    page.on('request', (q) => /generativelanguage|aiplatform/.test(q.url()) && pedidos.push(q.url()));
    const id = await page.evaluate(async () => {
      const r = window.rb;
      const lid = await r.biblioteca.adicionar({ titulo: 'Rotas negociadas e rotas calculadas', autores: [{ sobrenome: 'Lins', prenomes: 'Rafael' }], ano: 2022 });
      await r.biblioteca.grifar({ leituraId: lid, pagina: 7, texto: 'As rotas negociadas com as cooperativas duraram mais do que as calculadas pela prefeitura.', rects: [[0, 0, 1, 1]], funcao: 'evidencia' });
      await r.dados.salvar('fichamentos', { id: lid, leituraId: lid, feitos: 1, citacoes: [], resumo: '', analise: {}, trechos: [], notas: [{ id: 'n1', chave: 'p:q1', texto: 'A negociação faz a cooperativa manter a rota.', pagina: null }] });
      await r.fichUI.carregar();
      const e = r.escrita;
      const t = await e.novo();
      await e.salvar({ ...t, titulo: 'Rotas e cooperativas', passo: 4, secoes: [{ id: 's1', titulo: 'Introdução', objetivo: '', html: '<p data-pid="p1" data-autoria="autor">As rotas negociadas com as cooperativas duraram mais (Lins, 2022), ao contrário do que previa o cálculo (Silva, 2019).</p><p data-pid="p2" data-autoria="autor"><br></p>' }] });
      return t.id;
    });
    await page.goto(`/#texto/${id}`);
    await expect(page.locator('#esc-corpo')).toBeVisible();
    const pedir = page.locator('.esc-pedir');
    await expect(pedir).toBeHidden(); // sem cursor no texto, nada aparece
    await page.locator('#esc-corpo p').first().click();
    await expect(pedir.getByRole('button', { name: 'Pedir' })).toBeVisible();
    // Na linha vazia quem aparece é o "+", não o Pedir.
    await page.locator('#esc-corpo p').nth(1).click();
    await expect(pedir).toBeHidden();
    await page.locator('#esc-corpo p').first().click();

    await pedir.getByRole('button', { name: 'Pedir' }).click();
    await expect(pedir.getByRole('menuitem')).toHaveText(['Buscar nos meus grifos e notas', 'Conferir as citações', 'Propor outra versão', 'Conversar com o Copilot']);
    await pedir.getByRole('menuitem', { name: 'Buscar nos meus grifos e notas' }).click();
    const caixa = page.locator('.esc-pedido');
    await expect(caixa).toContainText('Por palavras em comum com este parágrafo, sem IA.');
    await expect(caixa.locator('li')).toHaveCount(2);
    await expect(caixa.locator('li').first()).toContainText('Grifo');
    await expect(caixa.locator('li').first()).toContainText('(Lins, 2022, p. 7)');
    await expect(caixa.locator('li').nth(1)).toContainText('Sua nota');
    // O resultado não entra no texto e some ao fechar.
    expect(await page.locator('#esc-corpo').innerText()).not.toContain('pela prefeitura');
    await caixa.getByRole('button', { name: 'Fechar' }).click();
    await expect(caixa).toBeHidden();

    await page.locator('#esc-corpo p').first().click();
    await pedir.getByRole('button', { name: 'Pedir' }).click();
    await pedir.getByRole('menuitem', { name: 'Conferir as citações' }).click();
    await expect(caixa.locator('li.ok')).toContainText('Lins (2022)');
    await expect(caixa.locator('li.ok')).toContainText('Na biblioteca');
    await expect(caixa.locator('li.fora')).toContainText('Silva (2019)');
    await expect(caixa.locator('li.fora')).toContainText('Só se cita o que está nela');
    await caixa.getByRole('button', { name: 'Fechar' }).click();
    expect(pedidos).toEqual([]);
    expect(await salvo(page, id)).not.toContain('esc-pedido');

    // Conversar com o Copilot abre o painel, que estava fechado, com o campo pronto.
    await expect(page.locator('.esc-painel')).toBeHidden();
    await page.locator('#esc-corpo p').first().click();
    await pedir.getByRole('button', { name: 'Pedir' }).click();
    await pedir.getByRole('menuitem', { name: 'Conversar com o Copilot' }).click();
    await expect(page.locator('.esc-painel')).toBeVisible();
    await expect(page.locator('#esc-chat')).toBeFocused();
    expect(pedidos).toEqual([]);
  });

  test('na sessão de escrita, o Pedir só oferece o que não usa IA', async ({ page, context }) => {
    await entrar(page, context);
    const id = await page.evaluate(async () => {
      const t = await window.rb.sessoes.novoCapitulo('Método');
      const e = window.rb.escrita;
      await e.salvar({ ...e.obter(t.id), secoes: [{ id: 's1', titulo: 'Desenho', objetivo: '', html: '<p data-pid="p1" data-autoria="autor">A avaliação foi conduzida em campo.</p>' }] });
      window.rb.sessoes.iniciar(t.id, 25);
      return t.id;
    });
    await page.goto(`/#texto/${id}`);
    await expect(page.locator('.sessao-barra')).toBeVisible();
    await page.locator('#esc-corpo p').first().click();
    await page.locator('.esc-pedir').getByRole('button', { name: 'Pedir' }).click();
    await expect(page.locator('.esc-pedir [role="menuitem"]:visible')).toHaveText(['Buscar nos meus grifos e notas', 'Conferir as citações']);
  });
});

// v2.13.0: imagem no texto, pelo "+" da linha vazia.
test.describe('figura no texto', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos rodam no computador'));

  /** PNG de verdade, feito no navegador (2000 x 1000), para o seletor de arquivo. */
  const pngGrande = async (page) =>
    Buffer.from(
      await page.evaluate(() => {
        const c = document.createElement('canvas');
        c.width = 2000;
        c.height = 1000;
        const x = c.getContext('2d');
        x.fillStyle = '#1d5a7a';
        x.fillRect(0, 0, 2000, 1000);
        x.fillStyle = '#fff';
        x.fillRect(200, 200, 600, 300);
        return c.toDataURL('image/png').split(',')[1];
      }),
      'base64',
    );

  test('o "+" põe a imagem como figura com título e fonte; o texto guarda só a marcação e a imagem vai para o Drive e para o Word', async ({ page, context }) => {
    const { g } = await entrar(page, context);
    const id = await criarTexto(page);
    await page.goto(`/#texto/${id}`);
    await page.locator('#esc-corpo p').first().click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    const mais = page.locator('.esc-mais');
    await mais.getByRole('button', { name: 'Inserir imagem, separador ou código' }).click();
    const [seletor] = await Promise.all([page.waitForEvent('filechooser'), mais.getByRole('button', { name: 'Imagem', exact: true }).click()]);
    await seletor.setFiles({ name: 'etapas.png', mimeType: 'image/png', buffer: await pngGrande(page) });

    // A figura entra e o app pergunta o título e a fonte.
    const modal = page.locator('#veu');
    await expect(modal).toContainText('Imagem no texto');
    const fig = page.locator('#esc-corpo figure');
    await expect(fig).toHaveCount(1);
    await expect(fig.locator('.fig-t')).toHaveText('Figura 1');
    await expect(fig.locator('.fig-f')).toContainText('Sem fonte');
    await modal.getByLabel('Título').fill('Etapas da coleta');
    await modal.getByLabel('Fonte').fill('Fonte: elaborado pelo autor');
    await modal.getByRole('button', { name: 'Salvar título e fonte' }).click();
    await expect(fig.locator('.fig-t')).toHaveText('Figura 1 – Etapas da coleta');
    await expect(fig.locator('.fig-f')).toHaveText('Fonte: elaborado pelo autor');
    // A imagem foi reduzida para 1600 px no lado maior.
    await expect.poll(() => fig.locator('img').evaluate((i) => `${i.naturalWidth}x${i.naturalHeight}`)).toBe('1600x800');

    // No texto gravado fica só a marcação: nem a imagem, nem o que a tela desenha dentro da figura.
    const html = await salvo(page, id);
    expect(html).toMatch(/<figure data-img="img-[a-z0-9]{8}\.png" data-l="1600" data-a="800" data-titulo="Etapas da coleta" data-fonte="elaborado pelo autor"><\/figure>/);
    expect(html).not.toMatch(/blob:|base64|<img|<button/);
    expect(html).toContain('As rotas negociadas duraram mais que as calculadas.');
    const img = html.match(/img-[a-z0-9]{8}\.png/)[0];
    await expect.poll(() => g.tamanho(`escrita/imagens/${img}`), { timeout: 10_000 }).toBeGreaterThan(500);
    await expect.poll(() => page.evaluate(() => window.rb.imagens.pendentes())).toEqual([]);
    await expect.poll(() => { try { return g.ler('dados/textos.json').includes(img); } catch { return false; } }, { timeout: 10_000 }).toBe(true);
    expect(g.ler('dados/textos.json')).not.toContain('iVBOR');
    const regs = await page.evaluate(() => window.rb.registros.lista().filter((r) => r.ev === 'texto.imagem').map((r) => r.det));
    expect(regs[0]).toMatch(/^1600x800, \d+ KB$/);

    // Tirar do texto tem desfazer.
    await fig.getByRole('button', { name: 'Tirar do texto' }).click();
    await expect(fig).toHaveCount(0);
    await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(fig.locator('.fig-t')).toHaveText('Figura 1 – Etapas da coleta');
    expect(await salvo(page, id)).toContain(img);

    // Em outro aparelho (sem a imagem guardada aqui), ela vem do Drive.
    await page.evaluate(
      (img) =>
        new Promise((ok, erro) => {
          const r = indexedDB.open('researchbook');
          r.onerror = () => erro(r.error);
          r.onsuccess = () => {
            const tx = r.result.transaction('arquivos', 'readwrite');
            tx.objectStore('arquivos').delete(img);
            tx.oncomplete = () => (r.result.close(), ok());
          };
        }),
      img,
    );
    await page.reload();
    await page.waitForFunction(() => window.rb && window.rb.sincronia && window.rb.sincronia.estado().fase === 'ok' && window.rb.escritaUI);
    await expect(fig.locator('.fig-t')).toHaveText('Figura 1 – Etapas da coleta');
    await expect.poll(() => fig.locator('img').evaluate((i) => i.naturalWidth), { timeout: 10_000 }).toBe(1600);

    // Word: identificação acima, imagem dentro do arquivo, fonte abaixo.
    await page.getByRole('button', { name: 'Revisar e exportar' }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar para Word (.docx)' }).click()]);
    const zip = (await readFile(await download.path())).toString('latin1');
    expect(zip).toContain('word/media/imagem1.png');
    expect(zip).toContain('r:embed="rIdImg1"');
    expect(zip).toContain('Target="media/imagem1.png"');
    const utf8 = Buffer.from(zip, 'latin1').toString('utf8');
    expect(utf8.indexOf('Figura 1 – Etapas da coleta')).toBeGreaterThan(0);
    expect(utf8.indexOf('Figura 1 – Etapas da coleta')).toBeLessThan(utf8.indexOf('<w:drawing>'));
    expect(utf8.indexOf('<w:drawing>')).toBeLessThan(utf8.indexOf('Fonte: elaborado pelo autor'));
    await expect(page.locator('#toast')).not.toContainText('sem a imagem');
  });

  test('regras: a imagem é regravada, o tipo é conferido e o limpador não deixa passar nada além da marcação', async ({ page, context }) => {
    await entrar(page, context);
    const r = await page.evaluate(async () => {
      const { preparar } = await import('/js/imagens.js');
      const { limpar } = await import('/js/escrita.js');
      const { gerarDocx, figurasDe } = await import('/js/docx.js');
      const c = document.createElement('canvas');
      c.width = 300;
      c.height = 900;
      c.getContext('2d').fillRect(0, 0, 300, 900);
      const jpg = await new Promise((ok) => c.toBlob(ok, 'image/jpeg'));
      const webp = await new Promise((ok) => c.toBlob(ok, 'image/webp'));
      const a = await preparar(new File([jpg], 'a.jpg', { type: 'image/jpeg' }));
      const b = await preparar(new File([webp], 'b.webp', { type: 'image/webp' }));
      const erro = async (f) => preparar(f).then(() => null, (e) => e.message);
      const html = '<p>antes</p><figure data-img="img-0a1b2c3d.jpg" data-l="300" data-a="900" data-titulo="T" data-fonte="F" contenteditable="false" class="esc-fig" onclick="x()"><span>Figura 1</span><img src="blob:x" onerror="x()"><button>Tirar</button></figure><figure data-img="../../segredo.png"><img src="https://exemplo.org/x.png"></figure><figure data-img="img-0a1b2c3d.png" data-l="abc"></figure>';
      const docx = await gerarDocx({ titulo: 'T', secoes: [{ titulo: 'S', html: limpar(html) }] }, [], new Map()).text();
      return {
        a: `${a.tipo} ${a.largura}x${a.altura}`,
        b: `${b.tipo} ${b.largura}x${b.altura}`,
        gif: await erro(new File(['GIF89a'], 'a.gif', { type: 'image/gif' })),
        svg: await erro(new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'a.svg', { type: 'image/svg+xml' })),
        quebrada: await erro(new File(['isto não é uma imagem'], 'a.png', { type: 'image/png' })),
        limpo: limpar(html),
        figs: figurasDe(limpar(html)).map((f) => `${f.id}:${f.largura}x${f.altura}`),
        semImagem: docx.includes('A imagem desta figura não estava no aparelho') && !docx.includes('<w:drawing>'),
        numeradas: docx.includes('Figura 1 – T') && docx.includes('Figura 2'),
      };
    });
    expect(r.a).toBe('image/jpeg 300x900');
    expect(r.b).toBe('image/jpeg 300x900');
    expect(r.gif).toBe('Use uma imagem PNG, JPG ou WebP.');
    expect(r.svg).toBe('Use uma imagem PNG, JPG ou WebP.');
    expect(r.quebrada).toBe('Não deu para ler esta imagem. Tente outro arquivo.');
    expect(r.limpo).toBe('<p>antes</p><figure data-img="img-0a1b2c3d.jpg" data-l="300" data-a="900" data-titulo="T" data-fonte="F"></figure><figure data-img="img-0a1b2c3d.png"></figure>');
    expect(r.figs).toEqual(['img-0a1b2c3d.jpg:300x900', 'img-0a1b2c3d.png:0x0']);
    expect(r.semImagem).toBe(true);
    expect(r.numeradas).toBe(true);
  });
});
