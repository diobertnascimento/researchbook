// v2.4.0, Projetos: lista com um protagonista, menu flutuante do projeto (Início, Artigos, Linha do tempo,
// Estúdio e Aprendizado), notas e links do Estúdio (gravados sozinhos, sincronizados, com lixeira) e o celular.
import { test, expect } from '@playwright/test';
import { googleFalso } from './google-falso.js';
import { geminiFalso } from './gemini-falso.js';

test.use({ serviceWorkers: 'block' });

async function entrar(page, context) {
  const g = await googleFalso(context);
  await geminiFalso(context);
  await page.goto('/#disciplinas', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb?.sincronia?.estado().fase === 'ok' && window.rb.disciplinasUI && window.rb.cartoes);
  return g;
}

/** Um projeto com aula hoje, prazo em 7 dias, entrega passada, aulas, obra com grifos e cartões, e um texto. */
async function projetoPronto(page) {
  const id = await page.evaluate(async () => {
    const r = window.rb;
    const D = r.disciplinas;
    const dia = (n) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      const z = (x) => String(x).padStart(2, '0');
      return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
    };
    const d = await D.salvar({ nome: 'Logística Reversa', docente: 'Docente de exemplo', semestre: '2026/2', criadoEm: new Date(Date.now() - 60 * 864e5).toISOString() });
    await D.salvar({ nome: 'Métodos Qualitativos', semestre: '2026/2' });
    await D.salvarEvento({ disciplinaId: d.id, tipo: 'aula', titulo: 'Aula de Logística Reversa', data: dia(0), inicio: '19:00' });
    await D.salvarEvento({ disciplinaId: d.id, tipo: 'entrega', titulo: 'Seção 4 do trabalho em grupo', data: dia(7), inicio: '23:59' });
    await D.salvarEvento({ disciplinaId: d.id, tipo: 'entrega', titulo: 'Resenha da primeira unidade', data: dia(-20) });
    const a = await D.novaAula({ disciplinaId: d.id, data: dia(-7), tema: 'Coleta seletiva e cooperativas' });
    await D.salvarAula({ ...a, grifos: [{ id: 'ga1', funcao: 'metodo', texto: 'trecho da aula' }] });
    const lid = await r.biblioteca.adicionar({ titulo: 'Rotas negociadas e rotas calculadas', autores: [{ sobrenome: 'Lins', prenomes: 'Rafael' }], ano: 2023, projeto: 'Logística Reversa' });
    await r.biblioteca.atualizar(lid, { etapa: 2 });
    for (const funcao of ['conceito', 'conceito', 'evidencia']) await r.biblioteca.grifar({ leituraId: lid, pagina: 1, texto: `trecho ${funcao}`, rects: [[0, 0, 1, 1]], funcao });
    await r.cartoes.guardar([
      { tipo: 'conceito', pergunta: 'O que é uma rota negociada?', resposta: 'A definida em assembleia.', origem: { tipo: 'grifo', leituraId: lid } },
      { tipo: 'conceito', pergunta: 'O que muda com janelas de tempo?', resposta: 'A ordem das visitas.', origem: { tipo: 'grifo', leituraId: lid } },
    ]);
    const cs = r.cartoes.todos();
    await r.dados.salvar('cartoes', { ...cs[0], estado: { repeticoes: 5, facilidade: 2.6, intervalo: 30, proxima: new Date(Date.now() + 20 * 864e5).toISOString(), lapsos: 0 } });
    await r.dados.salvar('cartoes', { ...cs[1], estado: { repeticoes: 0, facilidade: 1.5, intervalo: 0, proxima: null, lapsos: 3 } });
    await r.cartoes.carregar();
    const t = await r.escrita.novo();
    await r.escrita.salvar({ ...t, titulo: 'Rotas e cooperativas', projeto: 'Logística Reversa', passo: 4, secoes: [{ id: 's1', titulo: 'Introdução', objetivo: '', html: '<p data-pid="p1" data-autoria="autor">As rotas negociadas duraram mais.</p>' }] });
    return d.id;
  });
  return id;
}
const secao = (page, k) => page.locator(`.proj-menu [data-disc-aba="${k}"]`).click();

test.describe('no computador', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos rodam no computador; o celular tem teste próprio'));

  test('lista: o projeto com algo hoje vira o protagonista; os outros ficam numa lista', async ({ page, context }) => {
    await entrar(page, context);
    await projetoPronto(page);
    await page.evaluate(() => window.render());
    const foco = page.locator('.proj-atencao');
    await expect(foco).toContainText('Pede atenção hoje');
    await expect(foco).toContainText('Logística Reversa');
    await expect(foco).toContainText('Aula hoje, às 19:00. Seção 4 do trabalho em grupo vence em 7 dias.');
    await expect(foco).toContainText('1 aula, 1 obra');
    await expect(page.locator('.proj-l')).toHaveCount(1);
    await expect(page.locator('.proj-l')).toContainText('Métodos Qualitativos');
    await expect(page.locator('.proj-l')).toContainText('Nada agendado.');
    // Um botão azul só na tela.
    await expect(page.locator('#vista .btn.prim')).toHaveCount(1);
    await foco.getByRole('link', { name: 'Abrir projeto' }).click();
    await expect(page.locator('.topo h1')).toContainText('Logística Reversa');
  });

  test('menu flutuante, Início e Linha do tempo: o que vem a seguir e o que já aconteceu', async ({ page, context }) => {
    await entrar(page, context);
    const id = await projetoPronto(page);
    await page.goto(`/#disciplina/${id}`);
    const menu = page.locator('.proj-menu');
    await expect(menu.locator('a')).toHaveCount(6);
    await expect(menu.locator('a[aria-current="page"]')).toHaveAttribute('title', 'Início');
    await expect(menu.locator('a').first()).toHaveAttribute('href', '#disciplinas');
    // Os nomes só aparecem ao passar o mouse.
    const largura = () => menu.evaluate((m) => Math.round(m.getBoundingClientRect().width));
    expect(await largura()).toBeLessThan(70);
    await menu.hover();
    await expect.poll(largura).toBeGreaterThan(150);
    await page.mouse.move(700, 500);
    await expect.poll(largura).toBeLessThan(70);

    // Início: o compromisso de hoje no painel, o prazo com o dia grande e as aulas.
    await expect(page.locator('.proj-agora')).toContainText('Hoje, às 19:00');
    await expect(page.locator('.proj-agora')).toContainText('Aula de Logística Reversa');
    await expect(page.locator('.prazos')).toContainText('Seção 4 do trabalho em grupo');
    await expect(page.locator('.prazos')).toContainText('Em 7 dias, até 23:59');
    await expect(page.locator('.topo p')).toContainText('1 aula, 1 obra, 1 texto.');
    await expect(page.locator('.aula-l')).toContainText('Coleta seletiva e cooperativas');

    // Linha do tempo.
    await secao(page, 'agenda');
    await expect(page.locator('.topo h1')).toHaveText('Linha do tempo');
    await expect(menu.locator('a[aria-current="page"]')).toHaveAttribute('title', 'Linha do tempo');
    await expect(page.locator('.ev')).toHaveCount(2);
    const passado = page.locator('.linha-l li');
    await expect(passado.filter({ hasText: 'Aula 1' })).toContainText('Coleta seletiva e cooperativas');
    await expect(passado.filter({ hasText: 'Entrega' })).toContainText('Resenha da primeira unidade');
    await expect(passado.filter({ hasText: 'Texto começado' })).toContainText('Rotas e cooperativas');
    await expect(passado.filter({ hasText: 'Obra adicionada' })).toContainText('Rotas negociadas e rotas calculadas');
    // A entrega que ainda vai vencer não aparece no passado.
    await expect(passado.filter({ hasText: 'Seção 4 do trabalho em grupo' })).toHaveCount(0);

    // "Todos os projetos" volta para a lista.
    await menu.locator('a').first().click();
    await expect(page).toHaveURL(/#disciplinas$/);
  });

  test('Estúdio: a nota é gravada sozinha, sobe para o Drive e vai para a lixeira ao apagar; o link só aceita http e https', async ({ page, context }) => {
    const g = await entrar(page, context);
    const id = await projetoPronto(page);
    await page.goto(`/#disciplina/${id}`);
    await secao(page, 'estudio');
    await expect(page.locator('.topo h1')).toHaveText('Estúdio');
    const itens = page.locator('.estudio li');
    await expect(itens).toHaveCount(1);
    await expect(itens.first()).toContainText('Rotas e cooperativas');
    await expect(itens.first()).toContainText('Escrito por você. Texto. Escrevendo, 5 palavras');

    // Nota: sem botão Salvar; o que é digitado é gravado sozinho.
    await page.getByRole('button', { name: 'Escrever nota' }).click();
    await expect(page.locator('.modal').getByRole('button', { name: /Salvar/ })).toHaveCount(0);
    await page.getByLabel('Título').fill('Combinados do grupo');
    await page.getByLabel('Texto').fill('Seção 4 fica comigo.\nInstâncias até sexta.');
    await expect(page.locator('#mat-st')).toHaveText('Salvo');
    expect(await page.evaluate(() => window.rb.dados.listar('materiais').then((l) => l.map((m) => `${m.tipo}:${m.titulo}:${m.texto.split('\n').length}`)))).toEqual(['nota:Combinados do grupo:2']);
    // Continuar escrevendo não cria outra nota.
    await page.getByLabel('Texto').fill('Seção 4 fica comigo.\nInstâncias até sexta.\nRevisão cruzada no domingo.');
    await expect(page.locator('#mat-st')).toHaveText('Salvo');
    expect(await page.evaluate(() => window.rb.dados.listar('materiais').then((l) => l.length))).toBe(1);
    await page.getByRole('button', { name: 'Fechar' }).click();
    const nota = itens.filter({ hasText: 'Combinados do grupo' });
    await expect(nota).toContainText('Escrito por você. Nota, 3 linhas');
    await expect.poll(() => { try { return JSON.parse(g.ler('dados/materiais.json')).itens.length; } catch { return 0; } }, { timeout: 10_000 }).toBe(1);

    // Abrir a nota mostra o que foi escrito.
    await nota.getByRole('button', { name: 'Combinados do grupo', exact: true }).click();
    await expect(page.getByLabel('Texto')).toHaveValue(/Revisão cruzada no domingo\.$/);
    await page.getByRole('button', { name: 'Fechar' }).click();

    // Nota aberta e fechada sem nada escrito não cria registro.
    await page.getByRole('button', { name: 'Escrever nota' }).click();
    await page.getByRole('button', { name: 'Fechar' }).click();
    await expect(itens).toHaveCount(2);

    // Link: endereço que não é http nem https é recusado; sem "https://" é completado.
    await page.getByRole('button', { name: 'Guardar link' }).click();
    await page.getByLabel('Endereço').fill('javascript:alert(1)');
    await page.locator('.modal').getByRole('button', { name: 'Guardar link' }).click();
    await expect(page.locator('#toast')).toContainText('http:// ou https://');
    expect(await page.evaluate(() => window.rb.dados.listar('materiais').then((l) => l.length))).toBe(1);
    await page.getByLabel('Endereço').fill('example.org/planilha');
    await page.getByLabel('Nome').fill('Planilha de instâncias');
    await page.locator('.modal').getByRole('button', { name: 'Guardar link' }).click();
    await expect(page.locator('#toast')).toContainText('Link guardado');
    const link = itens.filter({ hasText: 'Planilha de instâncias' });
    await expect(link).toContainText('Enviado. Link.');
    await expect(link.getByRole('link')).toHaveAttribute('href', 'https://example.org/planilha');
    await expect(link.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');

    // Filtro: escritos por você e enviados.
    await expect(page.locator('.estudio-filtro')).toContainText('Tudo, 3');
    await page.getByRole('button', { name: 'Enviados, 1' }).click();
    await expect(itens).toHaveCount(1);
    await expect(itens).toContainText('Planilha de instâncias');
    await page.getByRole('button', { name: 'Escritos por você, 2' }).click();
    await expect(itens).toHaveCount(2);

    // Apagar manda para a lixeira (sem prazo para sair), com desfazer.
    await nota.getByRole('button', { name: 'Apagar Combinados do grupo' }).click();
    await expect(page.locator('#toast')).toContainText('Nota apagada. Fica na lixeira');
    await expect(itens).toHaveCount(1);
    expect(await page.evaluate(() => window.rb.dados.lixeira().then((l) => l.map((x) => `${x.colecao}:${x.item.titulo}`)))).toEqual(['materiais:Combinados do grupo']);
    await page.locator('#toast button', { hasText: 'Desfazer' }).click();
    await expect(itens).toHaveCount(2);
    await expect(itens.filter({ hasText: 'Combinados do grupo' })).toContainText('Nota, 3 linhas');
  });

  test('Estúdio: arquivo e foto ficam no aparelho e no Drive, fora do JSON; abrem de volta; grande demais é recusado', async ({ page, context }) => {
    const g = await entrar(page, context);
    const id = await projetoPronto(page);
    await page.goto(`/#disciplina/${id}`);
    await secao(page, 'estudio');
    const itens = page.locator('.estudio li');
    await expect(itens).toHaveCount(1);
    // PNG de 1 pixel e um PDF pequeno, escolhidos juntos.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await page.getByRole('button', { name: 'Enviar arquivo ou foto' }).click();
    await page.locator('[data-dsc-arquivo]').setInputFiles([
      { name: 'quadro-da-aula.png', mimeType: 'image/png', buffer: png },
      { name: 'instancias.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 arquivo de teste') },
    ]);
    await expect(page.locator('#toast')).toContainText('2 arquivos guardados no projeto');
    await expect(itens).toHaveCount(3);
    const foto = itens.filter({ hasText: 'quadro-da-aula.png' });
    await expect(foto).toContainText('Enviado. Foto, 1 KB');
    await expect(itens.filter({ hasText: 'instancias.pdf' })).toContainText('Enviado. PDF, 1 KB');
    // Sobe para o Drive, na pasta do projeto, e o registro deixa de estar pendente.
    await expect.poll(() => g.caminhos().filter((c) => c.startsWith(`projetos/${id}/`)).length, { timeout: 10_000 }).toBe(2);
    await expect.poll(() => page.evaluate(() => window.rb.disciplinas.materiaisDe(window.rb.disciplinas.todas()[0].id).filter((m) => m.arquivo).map((m) => m.arquivo.pendente))).toEqual([false, false]);
    await expect(foto).not.toContainText('vai para o Drive');
    // O conteúdo do arquivo não entra no JSON de sincronização.
    await expect.poll(() => { try { return JSON.parse(g.ler('dados/materiais.json')).itens.length; } catch { return 0; } }, { timeout: 10_000 }).toBe(2);
    expect(g.ler('dados/materiais.json')).not.toContain('iVBOR');
    expect(JSON.parse(g.ler('dados/materiais.json')).itens.every((m) => m.arquivo.driveId && !m.blob)).toBe(true);

    // A foto abre na tela; em outro aparelho (sem a cópia local), vem do Drive.
    await foto.getByRole('button', { name: 'quadro-da-aula.png', exact: true }).click();
    await expect(page.locator('.modal img.est-foto')).toHaveJSProperty('complete', true);
    await page.locator('.modal').getByRole('button', { name: 'Fechar' }).click();
    const tamanho = await page.evaluate(async () => {
      const r = window.rb;
      const m = r.disciplinas.materiaisDe(r.disciplinas.todas()[0].id).find((x) => x.titulo === 'instancias.pdf');
      const req = indexedDB.open('researchbook');
      const db = await new Promise((ok) => (req.onsuccess = () => ok(req.result)));
      await new Promise((ok) => { const tx = db.transaction('arquivos', 'readwrite'); tx.objectStore('arquivos').delete(`mat-${m.id}`); tx.oncomplete = ok; });
      db.close();
      const x = await r.disciplinas.obterArquivoDoMaterial(m.id);
      return x.blob ? x.blob.size : x.erro;
    });
    expect(tamanho).toBe(25);

    // Arquivo acima de 25 MB é recusado com o motivo, e nada é criado.
    const erro = await page.evaluate(async (id) => {
      try {
        await window.rb.disciplinas.guardarArquivoDoProjeto(id, new File([new Uint8Array(26 * 1024 * 1024)], 'grande.zip'));
        return 'guardou';
      } catch (e) {
        return e.message;
      }
    }, id);
    expect(erro).toContain('passa de 25 MB');
    expect(await page.evaluate(() => window.rb.dados.listar('materiais').then((l) => l.length))).toBe(2);

    // Tirar do projeto manda para a lixeira, com desfazer.
    await foto.getByRole('button', { name: 'Apagar quadro-da-aula.png' }).click();
    await expect(page.locator('#toast')).toContainText('Arquivo tirado do projeto. Fica na lixeira');
    await expect(itens).toHaveCount(2);
    await page.locator('#toast button', { hasText: 'Desfazer' }).click();
    await expect(itens).toHaveCount(3);
  });

  test('Aprendizado: retrato contado pelo app, sem chamar a IA', async ({ page, context }) => {
    await entrar(page, context);
    const id = await projetoPronto(page);
    const pedidos = [];
    page.on('request', (r) => /generativelanguage|aiplatform/.test(r.url()) && pedidos.push(r.url()));
    await page.goto(`/#disciplina/${id}`);
    await secao(page, 'aprendizado');
    await expect(page.locator('.topo h1')).toHaveText('Aprendizado');
    await expect(page.locator('.proj-ate')).toContainText('Você leu 1 de 1 obra, fichou 0 e tem 0 aulas gravadas.');
    await expect(page.locator('.apr-obras li')).toContainText('Rotas negociadas e rotas calculadas');
    await expect(page.locator('.apr-obras li')).toContainText('Leitura concluída');
    // Grifos das obras e da aula, por função.
    const grifos = page.locator('.apr-grifos li');
    await expect(grifos.filter({ hasText: 'Conceito' }).locator('b')).toHaveText('2');
    await expect(grifos.filter({ hasText: 'Evidência' }).locator('b')).toHaveText('1');
    await expect(grifos.filter({ hasText: 'Método' }).locator('b')).toHaveText('1');
    await expect(grifos.filter({ hasText: 'Crítica' }).locator('b')).toHaveText('0');
    // Cartões do projeto: um firme e um difícil, com a pergunta do difícil.
    const cartoes = page.locator('.apr-cartoes li');
    await expect(cartoes).toHaveCount(2);
    await expect(cartoes.first()).toContainText('1 firme');
    await expect(cartoes.last()).toContainText('1 difícil');
    await expect(cartoes.last()).toContainText('O que muda com janelas de tempo?');
    expect(pedidos).toEqual([]);
  });

  test('apagar o projeto leva junto as notas e os links; desfazer devolve', async ({ page, context }) => {
    await entrar(page, context);
    const id = await projetoPronto(page);
    await page.evaluate((id) => window.rb.disciplinas.salvarMaterial({ disciplinaId: id, tipo: 'nota', titulo: 'Combinados', texto: 'Uma linha.' }), id);
    const desfazer = await page.evaluateHandle((id) => window.rb.disciplinas.apagar(id), id);
    expect(await page.evaluate(() => window.rb.dados.listar('materiais').then((l) => l.length))).toBe(0);
    await page.evaluate((f) => f(), desfazer);
    expect(await page.evaluate((id) => window.rb.disciplinas.materiaisDe(id).map((m) => m.titulo), id)).toEqual(['Combinados']);
  });
});

test.describe('no celular', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'celular', 'Só no celular'));

  test('dentro de um projeto, a barra de baixo é o menu do projeto, e as cinco seções cabem na tela', async ({ page, context }) => {
    await entrar(page, context);
    const id = await projetoPronto(page);
    const sobra = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.evaluate(() => window.render());
    await expect(page.locator('#tabbar')).toBeVisible();
    expect(await sobra()).toBeLessThanOrEqual(0);

    await page.goto(`/#disciplina/${id}`);
    const menu = page.locator('.proj-menu');
    await expect(page.locator('#tabbar')).toBeHidden();
    await expect(menu.locator('.curto')).toHaveText(['Início', 'Artigos', 'Tempo', 'Estúdio', 'Aprender']);
    await expect(menu.locator('.curto').first()).toBeVisible();
    await expect(menu.locator('.longo').first()).toBeHidden();
    await expect(menu.locator('.todos')).toBeHidden();
    await expect(page.locator('.proj-voltar')).toBeVisible();
    for (const k of ['leituras', 'agenda', 'estudio', 'aprendizado', 'geral']) {
      await secao(page, k);
      await expect(menu.locator(`[data-disc-aba="${k}"]`)).toHaveAttribute('aria-current', 'page');
      expect(await sobra(), `sobra em ${k}`).toBeLessThanOrEqual(0);
    }
    // Cada item da barra tem altura de toque.
    const alturas = await menu.locator('a:visible').evaluateAll((as) => as.map((a) => Math.round(a.getBoundingClientRect().height)));
    expect(Math.min(...alturas)).toBeGreaterThanOrEqual(44);

    // Fora do projeto, a barra do app volta.
    await page.locator('.proj-voltar').click();
    await expect(page.locator('#tabbar')).toBeVisible();
    await expect(page.locator('.proj-menu')).toHaveCount(0);
  });
});
