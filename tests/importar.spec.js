// v1.2.0: importar vários arquivos e a exportação do Zotero, achar o DOI que falta (Crossref + IA, com
// aprovação), juntar obras repetidas e a sincronização entre aparelhos (celular e computador abertos juntos).
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { googleFalso } from './google-falso.js';
import { geminiFalso } from './gemini-falso.js';
import { selectRecusado, erroDeSelect, SELECT_ACEITOS } from './crossref-falso.js';

const FIX = join(import.meta.dirname, 'fixtures');
const ZOT = join(FIX, 'zotero');
const PDF_MORAES = join(ZOT, 'files', '101', 'Moraes e Lins - 2024 - Roteirizacao colaborativa.pdf');
const PDF_VENABLE = join(ZOT, 'files', '102', 'Venable - 2016 - Avaliacao de artefatos.pdf');
const cors = { 'access-control-allow-origin': '*' };

test.use({ serviceWorkers: 'block' });

// Crossref simulado: DOI direto e procura por dados (query.bibliographic).
const CANDIDATOS = {
  venable: [
    { type: 'book', title: ['Design science research: avaliação de artefatos'], author: [{ family: 'Venable', given: 'John' }], issued: { 'date-parts': [[2016]] }, publisher: 'Editora de Exemplo', DOI: '10.0000/venable.2016' },
    { type: 'journal-article', title: ['Avaliação em pesquisa qualitativa'], author: [{ family: 'Outro', given: 'Autor' }], issued: { 'date-parts': [[2010]] }, DOI: '10.0000/outro.2010' },
  ],
  greenwashing: [
    { type: 'journal-article', title: ['Greenwashing in corporate communication: a fictional review'], author: [{ family: 'Souza', given: 'Ana' }], issued: { 'date-parts': [[2022]] }, 'container-title': ['Revista Fictícia'], DOI: '10.0000/souza.2022' },
    { type: 'journal-article', title: ['Sustentabilidade e mercado'], author: [{ family: 'Pereira', given: 'Caio' }], issued: { 'date-parts': [[2019]] }, DOI: '10.0000/pereira.2019' },
  ],
};
async function crossrefFalso(context, estado = { pedidos: [] }) {
  await context.route('https://api.crossref.org/**', (r) => {
    const u = new URL(r.request().url());
    const q = (u.searchParams.get('query.bibliographic') || '').toLowerCase();
    estado.pedidos.push(q || u.pathname);
    // Como o Crossref de verdade: um campo desconhecido em "select" derruba o pedido inteiro.
    const ruim = selectRecusado(u.href);
    if (ruim && !estado.aceitarSelect) {
      estado.recusados = (estado.recusados || 0) + 1;
      return r.fulfill(erroDeSelect(ruim));
    }
    if (u.pathname === '/works' && q) {
      const itens = q.includes('venable') ? CANDIDATOS.venable : q.includes('greenwashing') ? CANDIDATOS.greenwashing : [];
      return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ message: { items: itens } }) });
    }
    // DOI direto (Atualizar os dados pelo DOI).
    if (decodeURIComponent(u.pathname) === '/works/10.0000/venable.2016') return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ message: CANDIDATOS.venable[0] }) });
    return r.fulfill({ status: 404, headers: cors, body: 'Resource not found.' });
  });
  return estado;
}

async function entrar(page, context, { comIA = false, rota = '#biblioteca' } = {}) {
  const g = await googleFalso(context);
  const gem = await geminiFalso(context);
  const cr = await crossrefFalso(context);
  await page.goto('/' + rota, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  if (comIA)
    await page.evaluate(() => {
      localStorage.setItem('rb.ia.acesso', 'google');
      localStorage.setItem('rb.ia.projeto', 'projeto-teste');
    });
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb?.sincronia?.estado().fase === 'ok' && window.rb.organizarUI);
  return { g, gem, cr };
}

test.describe('no computador', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos de dados; o celular tem teste próprio'));

  test('lê BibTeX, RIS, CSL JSON e Zotero RDF, com acentos do LaTeX, autores, tags, coleções e caminhos dos PDFs', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('rb.exemplo', '1'));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const textos = { bib: readFileSync(join(ZOT, 'biblioteca.bib'), 'utf8'), ris: readFileSync(join(FIX, 'exportado.ris'), 'utf8'), csl: readFileSync(join(FIX, 'exportado.json'), 'utf8'), rdf: readFileSync(join(FIX, 'exportado.rdf'), 'utf8') };
    const r = await page.evaluate(async (t) => {
      const m = await import('/js/importar.js');
      const resumo = (xs) => xs.map((x) => ({ tipo: x.ficha.tipo, titulo: x.ficha.titulo, autor: x.ficha.autores[0] && `${x.ficha.autores[0].sobrenome}, ${x.ficha.autores[0].prenomes}`, ano: x.ficha.ano, paginas: x.ficha.paginas, veiculo: x.ficha.veiculo, doi: x.ficha.doi, tags: x.ficha.tags, pdfs: x.pdfs }));
      return {
        bib: resumo(m.lerBibTeX(t.bib)),
        ris: resumo(m.lerRIS(t.ris)),
        csl: resumo(m.lerCSL(t.csl)),
        rdf: resumo(m.lerZoteroRDF(t.rdf)),
        ligacao: m.ligarPDFs([{ pdfs: ['files/9/Avaliação.pdf'] }, { pdfs: ['C:\\Zotero\\storage\\AB12\\Gonçalves 2020.pdf'] }, { pdfs: ['files/3/inexistente.pdf'] }], [{ nome: 'Gonc\u0327alves 2020.pdf', caminho: 'Gonc\u0327alves 2020.pdf' }, { nome: 'Avaliac\u0327a\u0303o.pdf', caminho: 'export/files/9/Avaliac\u0327a\u0303o.pdf' }, { nome: 'solto.pdf', caminho: 'solto.pdf' }, { nome: 'notas.txt', caminho: 'notas.txt' }]),
        formatos: [m.formatoDe('x.bib'), m.formatoDe('x.ris'), m.formatoDe('x.json', '[{'), m.formatoDe('x.rdf'), m.formatoDe('x.txt', 'TY  - JOUR'), m.formatoDe('foto.png')],
      };
    }, textos);
    expect(r.bib[0]).toEqual({ tipo: 'artigo', titulo: 'Roteirização colaborativa em cooperativas de reciclagem', autor: 'Moraes, Tânia', ano: '2024', paginas: '135-146', veiculo: 'Revista de Exemplo', doi: '10.0000/exemplo.1', tags: ['coleta seletiva', 'cooperativas'], pdfs: ['files/101/Moraes e Lins - 2024 - Roteirizacao colaborativa.pdf'] });
    expect(r.bib[1]).toMatchObject({ tipo: 'livro', autor: 'Venable, John', doi: null, pdfs: ['files/102/Venable - 2016 - Avaliacao de artefatos.pdf'] });
    expect(r.bib[2]).toMatchObject({ tipo: 'capitulo', veiculo: 'Ensaios fictícios sobre sustentabilidade', pdfs: [] });
    expect(r.ris.map((x) => [x.tipo, x.paginas])).toEqual([['artigo', '135-146'], ['capitulo', '10-30']]);
    expect(r.csl.map((x) => [x.tipo, x.ano, x.tags])).toEqual([['artigo', '2021', ['rotas', 'adesão']], ['dissertacao', '2019', []]]);
    expect(r.rdf[0]).toEqual({ tipo: 'artigo', titulo: 'Rotas negociadas e adesão de catadores', autor: 'Albuquerque, Marina', ano: '2023', paginas: '45-60', veiculo: 'Revista Fictícia de Logística', doi: '10.0000/exemplo.rdf', tags: ['logística reversa', 'Capítulo 2'], pdfs: ['files/201/Albuquerque - 2023 - Rotas negociadas.pdf'] });
    expect(r.formatos).toEqual(['bibtex', 'ris', 'csl', 'rdf', 'ris', null]);
    expect(r.ligacao).toEqual({ ligacoes: [1, 0, -1], soltos: [2] });
  });

  test('importa a pasta do Zotero: liga cada PDF à sua obra, manda os PDFs para o Drive e não repete na segunda vez', async ({ page, context }) => {
    const { g } = await entrar(page, context);
    await page.getByRole('button', { name: 'Importar' }).first().click();
    await expect(page.locator('#modal-tit')).toHaveText('Importar para a biblioteca');
    await page.locator('input[webkitdirectory]').setInputFiles(ZOT);
    await expect(page.locator('#modal-tit')).toHaveText('Conferir a importação', { timeout: 15000 });
    await expect(page.locator('.imp-lista')).toContainText('Nova');
    await expect(page.locator('.modal > p').first()).toContainText('3 itens encontrados em BibTeX, 2 PDFs ligados');
    await page.getByRole('button', { name: 'Importar 3 obras' }).click();
    await expect(page.locator('#toast')).toContainText('3 obras importadas');
    const obras = await page.evaluate(() => window.rb.biblioteca.leituras().map((l) => ({ titulo: l.titulo, pdf: !!l.pdf, sha: !!l.pdf?.sha256, tags: l.tags, de: l.importadaDe })));
    expect(obras).toHaveLength(3);
    expect(obras.filter((o) => o.pdf)).toHaveLength(2);
    expect(obras.every((o) => !o.pdf || o.sha)).toBe(true);
    expect(obras.find((o) => o.titulo.startsWith('Roteirização')).tags).toEqual(['coleta seletiva', 'cooperativas']);
    expect(obras[0].de).toBe('Zotero (BibTeX)');
    await expect.poll(() => g.caminhos().filter((n) => n.includes('biblioteca/pdfs/')).length, { timeout: 15000 }).toBe(2);

    // De novo, a mesma pasta: tudo já está na biblioteca, nada vem marcado.
    await page.goto('/#biblioteca');
    await page.getByRole('button', { name: 'Importar' }).first().click();
    await page.locator('input[webkitdirectory]').setInputFiles(ZOT);
    await expect(page.locator('#modal-tit')).toHaveText('Conferir a importação', { timeout: 15000 });
    await expect(page.locator('.imp-lista h3').first()).toContainText('Já está na biblioteca');
    await expect(page.locator('[data-imp-gravar]')).toHaveText('Nada marcado');
    await expect(page.locator('[data-imp-gravar]')).toBeDisabled();
  });

  test('vários PDFs soltos: lê o DOI no PDF, completa a obra que não tinha PDF e o mesmo arquivo duas vezes entra uma vez só', async ({ page, context }) => {
    await entrar(page, context);
    // Uma obra já existente, sem PDF, com o DOI que está escrito dentro do PDF de teste.
    await page.evaluate(() => window.rb.biblioteca.adicionar({ tipo: 'artigo', titulo: 'Obra que ainda não tem PDF', autores: [], ano: null, doi: '10.9999/teste.2026.001' }));
    await page.getByRole('button', { name: 'Importar' }).first().click();
    await page.locator('input[data-imp-arquivos]:not([webkitdirectory])').setInputFiles([{ name: 'moraes.pdf', mimeType: 'application/pdf', buffer: readFileSync(PDF_MORAES) }, { name: 'copia.pdf', mimeType: 'application/pdf', buffer: readFileSync(PDF_MORAES) }]);
    await expect(page.locator('#modal-tit')).toHaveText('Conferir a importação', { timeout: 15000 });
    await expect(page.locator('.imp-lista')).toContainText('Completa uma obra da biblioteca');
    await expect(page.locator('.imp-lista')).toContainText('Repetida neste envio');
    await expect(page.locator('[data-imp-gravar]')).toHaveText('Importar 1 obra');
    await page.locator('[data-imp-gravar]').click();
    await expect(page.locator('#toast')).toContainText('1 obra ganhou o PDF');
    const ls = await page.evaluate(() => window.rb.biblioteca.leituras().map((l) => ({ titulo: l.titulo, pdf: !!l.pdf })));
    expect(ls).toEqual([{ titulo: 'Obra que ainda não tem PDF', pdf: true }]);
  });

  test('a procura no Crossref só pede campos que ele aceita e, se o pedido for recusado, tenta de novo sem escolher campos', async ({ page, context }) => {
    await page.addInitScript(() => localStorage.setItem('rb.exemplo', '1'));
    const estado = { pedidos: [] };
    await crossrefFalso(context, estado);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const campos = await page.evaluate(async () => (await import('/js/crossref.js')).CAMPOS_PROCURA);
    expect(campos.filter((c) => !SELECT_ACEITOS.has(c))).toEqual([]);
    const procurar = (f) => page.evaluate(async (ficha) => (await import('/js/crossref.js')).procurarPorDados(ficha), f);
    const r = await procurar({ titulo: 'Design science research: avaliação de artefatos', autores: [{ sobrenome: 'Venable' }], ano: '2016' });
    expect(r.candidatos.map((c) => c.doi)).toEqual(['10.0000/venable.2016', '10.0000/outro.2010']);
    expect(estado.recusados || 0).toBe(0);
    // O Crossref passa a recusar qualquer "select" (mudou a lista dele): a procura não pode parar de funcionar.
    await context.unroute('https://api.crossref.org/**');
    let comSelect = 0;
    await context.route('https://api.crossref.org/**', (rota) => {
      const u = new URL(rota.request().url());
      if (u.searchParams.has('select')) {
        comSelect++;
        return rota.fulfill(erroDeSelect('title'));
      }
      return rota.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ message: { items: CANDIDATOS.greenwashing } }) });
    });
    const r2 = await procurar({ titulo: 'Greenwashing in corporate communication', ano: '2022' });
    expect(comSelect).toBe(1);
    expect(r2.candidatos[0].doi).toBe('10.0000/souza.2022');
  });

  test('DOI que falta: o que bate com o Crossref é gravado sozinho, com desfazer; a IA só entra quando o autor pede', async ({ page, context }) => {
    const { gem } = await entrar(page, context, { comIA: true });
    await page.evaluate(async () => {
      await window.rb.biblioteca.adicionar({ tipo: 'livro', titulo: 'Design science research: avaliação de artefatos', autores: [{ sobrenome: 'Venable', prenomes: 'John' }], ano: '2016', editora: 'Minha editora' });
      await window.rb.biblioteca.adicionar({ tipo: 'artigo', titulo: 'Greenwashing e comunicação corporativa', autores: [{ sobrenome: 'Souza', prenomes: 'Ana' }], ano: '2022' });
      await window.rb.biblioteca.adicionar({ tipo: 'livro', titulo: 'Manual interno sem DOI', autores: [{ sobrenome: 'Ninguém', prenomes: 'A.' }], ano: '2001' });
    });
    const obra = (inicio) => page.evaluate((inicio) => window.rb.biblioteca.leituras().find((l) => l.titulo.startsWith(inicio)), inicio);
    await page.goto('/#acervo');
    await expect(page.locator('#acervo-resumo')).toContainText('3 obras com algo faltando');
    await page.getByRole('button', { name: 'Completar os dados' }).click();

    // Título, autor e ano batem: gravado na hora, completando só o que faltava (a editora do autor fica).
    const gravados = page.locator('#org-gravados');
    await expect(gravados).toContainText('Design science research', { timeout: 15000 });
    await expect(gravados).toContainText('10.0000/venable.2016');
    let v = await obra('Design');
    expect([v.doi, v.editora, v.doiBusca.auto]).toEqual(['10.0000/venable.2016', 'Minha editora', true]);
    // A procura não chamou a IA.
    expect(gem.pedidos.some((p) => JSON.stringify(p.corpo).includes('candidatos'))).toBe(false);

    // Desfazer tira o DOI e devolve a obra para a lista de conferir, de onde o autor aceita.
    await gravados.getByRole('button', { name: 'Desfazer este' }).click();
    await expect(page.locator('#toast')).toContainText('1 gravação desfeita');
    expect((await obra('Design')).doi).toBeFalsy();
    const venable = page.locator('.org-item', { hasText: 'Design science research' });
    await expect(venable).toContainText('Muito provável');
    await venable.getByRole('button', { name: 'Aceitar este DOI' }).click();
    await expect(page.locator('#toast')).toContainText('DOI aceito');
    expect((await obra('Design')).doi).toBe('10.0000/venable.2016');

    // A obra em dúvida fica sem DOI até o autor pedir a IA, que indica o candidato sem gravar nada.
    await page.locator('details', { hasText: 'Sem DOI encontrado' }).evaluate((d) => (d.open = true));
    await page.locator('.org-sem', { hasText: 'Greenwashing' }).getByRole('button', { name: 'Pedir para a IA conferir' }).click();
    const souza = page.locator('.org-item', { hasText: 'Greenwashing' });
    await expect(souza).toContainText('Indicado pela IA', { timeout: 15000 });
    await expect(souza).toContainText('10.0000/souza.2022');
    expect(gem.pedidos.some((p) => JSON.stringify(p.corpo).includes('candidatos'))).toBe(true);
    expect((await obra('Greenwashing')).doi).toBeFalsy();
    // Recusar: sem outro candidato bom, a obra volta para "sem DOI encontrado".
    await souza.getByRole('button', { name: 'Não é esta' }).click();
    await expect(page.locator('details', { hasText: 'Sem DOI encontrado (2)' })).toBeVisible();
    // Não tem DOI: sai da lista e não é procurada de novo.
    await page.locator('details', { hasText: 'Sem DOI encontrado' }).evaluate((d) => (d.open = true));
    await page.locator('.org-sem', { hasText: 'Manual interno' }).getByRole('button', { name: 'Não tem DOI' }).click();
    await expect(page.locator('details', { hasText: 'Sem DOI encontrado (1)' })).toBeVisible();
    const contagem = await page.evaluate(() => window.rb.organizar.contagem());
    expect(contagem).toMatchObject({ propostas: 0, pendentes: 0 });
  });

  test('sem IA, a procura grava o que bate com o Crossref e a tela explica como pedir a IA', async ({ page, context }) => {
    await entrar(page, context);
    await page.evaluate(() => window.rb.biblioteca.adicionar({ tipo: 'livro', titulo: 'Design science research: avaliação de artefatos', autores: [{ sobrenome: 'Venable', prenomes: 'John' }], ano: '2016' }));
    await page.evaluate(() => window.rb.organizar.procurarDOIs());
    const l = await page.evaluate(() => window.rb.biblioteca.leituras()[0]);
    expect([l.doi, l.doiBusca.status, l.doiBusca.auto]).toEqual(['10.0000/venable.2016', 'aceita', true]);
    await page.goto('/#organizar');
    await expect(page.locator('main')).toContainText('A procura usa só o Crossref');
    await expect(page.locator('#org-gravados')).toContainText('10.0000/venable.2016');
  });

  test('Acervo: é o último item do menu, mostra o que falta em cada obra e completa pelo DOI só o que está vazio, com desfazer', async ({ page, context }) => {
    await entrar(page, context);
    await page.evaluate(async () => {
      const b = window.rb.biblioteca;
      await b.adicionar({ tipo: 'livro', titulo: 'Design science research: avaliação de artefatos', autores: [{ sobrenome: 'Venable', prenomes: 'John' }], ano: '2015', doi: '10.0000/venable.2016' });
      await b.adicionar({ tipo: 'livro', titulo: 'Manual interno sem DOI', autores: [{ sobrenome: 'Ninguém', prenomes: 'A.' }], ano: '2001' });
    });
    const obra = () => page.evaluate(() => window.rb.biblioteca.leituras().find((l) => l.titulo.startsWith('Design')));
    // O Acervo é o último item do menu; o endereço antigo e o atalho dos Ajustes continuam valendo.
    await expect(page.locator('#menu > li > a')).toHaveText(['Hoje', 'Ler', 'Escrever', 'Dissertação', 'Projetos', 'Acervo']);
    await page.locator('#menu').getByRole('link', { name: 'Acervo' }).click();
    await expect(page).toHaveURL(/#acervo$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Acervo' })).toBeVisible();
    await expect(page.locator('#menu a[aria-current="page"]')).toHaveText('Acervo');
    await expect(page.locator('.topo')).toContainText('2 obras. 0 completas, 2 com algo faltando.');
    // Livro sem DOI não conta como falta de DOI; os dois estão sem PDF e sem a cidade.
    const filtro = (nome) => page.locator('.ac-filtros').getByRole('button', { name: new RegExp('^' + nome) });
    await expect(filtro('Sem PDF')).toContainText('2');
    await expect(filtro('Sem DOI')).toContainText('0');
    await expect(filtro('Referência incompleta')).toContainText('2');
    const linhas = page.locator('#ac-corpo tr');
    await expect(linhas).toHaveCount(2);
    await expect(linhas.first().getByRole('link', { name: 'Anexar o PDF' })).toHaveAttribute('href', /#leitor\//);
    await expect(linhas.filter({ hasText: 'Manual interno' })).toContainText('Faltam a editora e a cidade');
    await page.goto('/#organizar');
    await expect(page.getByRole('heading', { level: 1, name: 'Acervo' })).toBeVisible();

    await page.getByRole('button', { name: 'Atualizar os dados pelo DOI' }).click();
    const feito = page.locator('#acervo-atualizadas');
    await expect(feito).toContainText('1 obra completada pelo DOI');
    await expect(feito).toContainText('Completou editora');
    // O ano que o autor escreveu fica; a diferença é só informada.
    await expect(feito).toContainText('aqui 2015, no Crossref 2016');
    let v = await obra();
    expect([v.editora, v.ano]).toEqual(['Editora de Exemplo', '2015']);
    await feito.getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.locator('#toast')).toContainText('1 obra voltou a como estava');
    v = await obra();
    expect(v.editora || null).toBeNull();
  });

  test('Acervo: filtros com contagem, busca por título ou autor, ordem e "Completar os dados" pelo DOI', async ({ page, context }) => {
    await entrar(page, context);
    await page.evaluate(async () => {
      const b = window.rb.biblioteca;
      const a = (sobrenome, prenomes) => ({ sobrenome, prenomes });
      await b.adicionar({ tipo: 'artigo', titulo: 'Roteirização da coleta seletiva', autores: [a('Moraes', 'Ana')], ano: '2019', veiculo: 'Revista Fictícia', volume: '7', paginas: '31-52', doi: '10.0000/moraes.2019' });
      await b.adicionar({ tipo: 'artigo', titulo: 'Design science em operações', autores: [a('Falcão', 'Renata')], ano: '2017', volume: '11', paginas: '45-62' });
      await b.adicionar({ tipo: 'artigo', titulo: 'artigo_final_v2' });
      await b.adicionar({ tipo: 'livro', titulo: 'Design science research: avaliação de artefatos', autores: [a('Venable', 'John')], ano: '2016', local: 'Cidade', doi: '10.0000/venable.2016' });
    });
    await page.goto('/#acervo');
    const filtro = (nome) => page.locator('.ac-filtros').getByRole('button', { name: new RegExp('^' + nome) });
    const titulos = () => page.locator('#ac-corpo .ac-obra b').allTextContents();
    await expect(page.locator('#acervo-resumo')).toContainText('4 obras com algo faltando');
    await expect(page.locator('#acervo-resumo')).toContainText('3 com a referência incompleta, 4 sem PDF e 2 sem DOI');
    await expect(page.locator('main .btn.prim')).toHaveCount(1);
    // Filtros: cada um com a sua contagem; a lista troca sem refazer a tela.
    await expect(filtro('Referência incompleta')).toContainText('3');
    await filtro('Sem DOI').click();
    await expect(filtro('Sem DOI')).toHaveAttribute('aria-pressed', 'true');
    expect(await titulos()).toEqual(['artigo_final_v2', 'Design science em operações']);
    await expect(page.locator('#ac-resumo')).toHaveText('Mostrando 2 de 4 obras: sem doi.');
    await expect(page.locator('#ac-corpo tr').filter({ hasText: 'artigo_final_v2' })).toContainText('Faltam 6 dados');
    await expect(page.locator('#ac-corpo tr').filter({ hasText: 'Design science em operações' })).toContainText('Falta a revista');
    // Busca sem acento, por autor; o campo não perde o foco.
    await filtro('Todas').click();
    await page.locator('#ac-busca').pressSequentially('falcao');
    expect(await titulos()).toEqual(['Design science em operações']);
    await expect(page.locator('#ac-busca')).toBeFocused();
    await page.locator('#ac-busca').fill('zzz');
    await expect(page.locator('#ac-resumo')).toHaveText('Nenhuma obra com esse texto neste grupo.');
    await page.locator('#ac-busca').fill('');
    await page.locator('#ac-ordem').selectOption('titulo');
    expect(await titulos()).toEqual(['artigo_final_v2', 'Design science em operações', 'Design science research: avaliação de artefatos', 'Roteirização da coleta seletiva']);
    await page.locator('#ac-ordem').selectOption('autor');
    expect((await titulos()).slice(0, 3)).toEqual(['Design science em operações', 'Roteirização da coleta seletiva', 'Design science research: avaliação de artefatos']);
    // Cada obra tem a sua página: o que falta, a referência em ABNT e de onde veio cada dado.
    await page.locator('#ac-corpo .ac-obra').first().click();
    await expect(page).toHaveURL(/#acervo\/falcao-2017/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Design science em operações');
    await expect(page.locator('#obra-falta')).toContainText('Faltam 3 dados: a revista, o DOI e o PDF');
    await expect(page.locator('#obra-ref .ac-ref')).toContainText('FALCÃO, R. Design science em operações. [a completar], v. 11, p. 45-62, 2017.');
    const dado = (nome) => page.locator('#obra-dados tbody tr').filter({ has: page.locator('th', { hasText: new RegExp('^' + nome + '$') }) });
    await expect(dado('Revista')).toContainText('Falta');
    await expect(dado('Revista')).toContainText('Ainda não achado');
    await expect(dado('Ano')).toContainText('Sem registro de origem');
    await expect(page.locator('main .btn.prim')).toHaveCount(1);
    // Corrigir à mão: o dado mudado passa a dizer "Você escreveu".
    await page.locator('#obra-dados').getByRole('button', { name: 'Corrigir os dados' }).click();
    await page.locator('#f-veiculo').fill('Revista Fictícia de Operações');
    await page.getByRole('button', { name: 'Salvar correções' }).click();
    await expect(dado('Revista')).toContainText('Revista Fictícia de Operações');
    await expect(dado('Revista')).toContainText('Você escreveu');
    await expect(dado('Ano')).toContainText('Sem registro de origem');
    await expect(page.locator('#obra-falta')).toContainText('Faltam 2 dados: o DOI e o PDF');
    // Buscar os dados desta obra: nada no Crossref simulado, a tela diz e continua pedindo a decisão.
    await page.getByRole('button', { name: 'Buscar os dados desta obra' }).click();
    await expect(page.locator('#toast')).toContainText('Nada novo encontrado para esta obra');
    await expect(page.locator('#obra-falta')).toContainText('A última busca não achou esta obra');
    await page.getByRole('button', { name: 'Esta obra não tem DOI' }).click();
    await expect(dado('DOI')).toContainText('Não tem DOI');
    await expect(page.locator('#obra-falta')).toContainText('Falta o PDF');
    // Apagar manda para a lixeira, com desfazer.
    await page.getByRole('button', { name: 'Apagar a obra' }).click();
    await expect(page).toHaveURL(/#acervo$/);
    await expect(page.locator('#ac-corpo tr')).toHaveCount(3);
    await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.locator('#ac-corpo tr')).toHaveCount(4);
    // Completar: o livro com DOI ganha a editora que faltava; o que não foi achado continua na lista, sem aviso vazio.
    await page.getByRole('button', { name: 'Completar os dados' }).click();
    await expect(page.locator('#acervo-atualizadas')).toContainText('1 obra completada pelo DOI', { timeout: 15000 });
    const livro = await page.evaluate(() => window.rb.biblioteca.leituras().find((l) => l.titulo.startsWith('Design science research')));
    expect([livro.editora, livro.local]).toEqual(['Editora de Exemplo', 'Cidade']);
    await expect(filtro('Referência incompleta')).toContainText('1');
  });

  test('OpenAlex pelo servidor: entra quando o Crossref não dá certeza, aceita obra sem DOI e diz de onde veio cada dado', async ({ page, context }) => {
    await page.addInitScript(() => localStorage.setItem('rb.teste.servidor', 'http://localhost:4173/servidor-falso'));
    const pedidos = [];
    let antigo = false;
    await context.route('http://localhost:4173/servidor-falso/**', (r) => {
      const u = new URL(r.request().url());
      pedidos.push({ caminho: u.pathname.replace('/servidor-falso', ''), busca: u.searchParams.get('busca'), auth: r.request().headers().authorization });
      if (antigo) return r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Este servidor não atende este endereço.', origem: 'servidor', codigo: 'rota' } }) });
      const candidatos = (u.searchParams.get('busca') || '').includes('triagem')
        ? [{ tipo: 'anais', titulo: 'Indicadores de desempenho em centrais de triagem', autores: [{ sobrenome: 'Nogueira', prenomes: 'Lia' }], ano: '2018', veiculo: 'Anais do Encontro Fictício de Produção', volume: null, numero: null, paginas: '112-126', doi: null, idioma: 'pt', idOpenAlex: 'W900' }]
        : [];
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidatos }) });
    });
    await entrar(page, context);
    await page.evaluate(async () => {
      const b = window.rb.biblioteca;
      await b.adicionar({ tipo: 'artigo', titulo: 'Indicadores de desempenho em centrais de triagem', autores: [{ sobrenome: 'Nogueira', prenomes: 'Lia' }], ano: '2018' });
      await b.adicionar({ tipo: 'livro', titulo: 'Design science research: avaliação de artefatos', autores: [{ sobrenome: 'Venable', prenomes: 'John' }], ano: '2016' });
    });
    await page.goto('/#acervo');
    await expect(page.locator('main')).toContainText('A procura usa o Crossref e, quando ele não dá certeza, o OpenAlex.');
    await page.getByRole('button', { name: 'Completar os dados' }).click();
    const gravados = page.locator('#org-gravados');
    await expect(gravados).toContainText('Obra sem DOI, do OpenAlex', { timeout: 15000 });
    await expect(gravados).toContainText('DOI 10.0000/venable.2016, do Crossref');
    // O Crossref deu certeza para o livro: o OpenAlex só foi consultado para a outra obra, com o login e sem chave.
    expect(pedidos.map((p) => p.caminho)).toEqual(['/obras/openalex']);
    expect(pedidos[0].busca).toContain('triagem');
    expect(pedidos[0].auth).toBe('Bearer tok-falso');
    const obra = await page.evaluate(() => window.rb.biblioteca.leituras().find((l) => l.titulo.startsWith('Indicadores')));
    expect([obra.doi || null, obra.doiBusca.status, obra.doiBusca.fonte, obra.veiculo, obra.paginas]).toEqual([null, 'nao-tem', 'openalex', 'Anais do Encontro Fictício de Produção', '112-126']);
    expect(obra.origens).toMatchObject({ veiculo: 'openalex', paginas: 'openalex' });
    const livro = await page.evaluate(() => window.rb.biblioteca.leituras().find((l) => l.titulo.startsWith('Design')));
    expect(livro.origens).toMatchObject({ doi: 'crossref', editora: 'crossref' });
    // Desfazer devolve a obra ao que era, sem os dados e sem a marca.
    await gravados.getByRole('button', { name: /Desfazer os 2/ }).click();
    await expect(page.locator('#toast')).toContainText('2 gravações desfeitas');
    const volta = await page.evaluate(() => window.rb.biblioteca.leituras().find((l) => l.titulo.startsWith('Indicadores')));
    expect([volta.veiculo || null, volta.origens || null]).toEqual([null, null]);
    // Servidor ainda na versão antiga: a procura segue pelo Crossref e a tela diz o que fazer.
    antigo = true;
    await page.evaluate(() => window.rb.organizar.procurarDeNovo(window.rb.biblioteca.leituras().find((l) => l.titulo.startsWith('Indicadores')).id));
    await page.goto('/#acervo');
    await expect(page.locator('#acervo-aviso-fonte')).toContainText('Publique de novo');
  });

  test('repetidas: junta na obra com mais trabalho, leva grifos e trilhas, e tem desfazer', async ({ page, context }) => {
    await entrar(page, context);
    const ids = await page.evaluate(async () => {
      const b = window.rb.biblioteca;
      const a = await b.adicionar({ tipo: 'artigo', titulo: 'Rotas negociadas', autores: [{ sobrenome: 'Moraes', prenomes: 'T.' }], ano: '2024', doi: '10.0000/rep.1' });
      const c = await b.adicionar({ tipo: 'artigo', titulo: 'Rotas negociadas (cópia do Zotero)', autores: [{ sobrenome: 'Moraes', prenomes: 'T.' }], ano: '2024', doi: '10.0000/REP.1', tags: ['zotero'] });
      const d = await b.adicionar({ tipo: 'artigo', titulo: 'Coleta seletiva e cooperativas no Brasil', autores: [{ sobrenome: 'Lima', prenomes: 'R.' }], ano: '2020' });
      const e = await b.adicionar({ tipo: 'artigo', titulo: 'Coleta seletiva e cooperativas no Brasil', autores: [{ sobrenome: 'Lima', prenomes: 'R.' }], ano: '2020' });
      await b.grifar({ leituraId: a, pagina: 1, texto: 'Grifo na primeira', rects: [[0, 0, 1, 0.1]], funcao: 'conceito' });
      await b.grifar({ leituraId: a, pagina: 2, texto: 'Outro grifo na primeira', rects: [[0, 0, 1, 0.1]], funcao: 'metodo' });
      await b.grifar({ leituraId: c, pagina: 3, texto: 'Grifo na cópia', rects: [[0, 0, 1, 0.1]], funcao: 'critica' });
      await window.rb.dados.salvar('trilhas', { id: 'tr-x', nome: 'Trilha', itens: [c], criadoEm: new Date().toISOString() });
      return { a, c, d, e };
    });
    await page.goto('/#organizar');
    await expect(page.locator('.org-item', { hasText: 'Idênticas' })).toHaveCount(2);
    const grupo = page.locator('.org-item', { hasText: 'Rotas negociadas' });
    await expect(grupo.locator('li', { hasText: '2 grifos' })).toContainText('Fica esta');
    await grupo.getByRole('button', { name: 'Juntar' }).click();
    await expect(page.locator('#toast')).toContainText('Obras juntadas numa só');
    const depois = await page.evaluate((i) => ({ ids: window.rb.biblioteca.leituras().map((l) => l.id), grifos: window.rb.biblioteca.grifosDe(i.a).length, tags: window.rb.biblioteca.obter(i.a).tags }), ids);
    expect(depois.ids).not.toContain(ids.c);
    expect(depois.grifos).toBe(3);
    expect(depois.tags).toEqual(['zotero']);
    expect((await page.evaluate(() => window.rb.dados.listar('trilhas')))[0].itens).toEqual([ids.a]);
    // Desfazer devolve tudo.
    await page.locator('#toast button').click();
    await expect.poll(() => page.evaluate((i) => !!window.rb.biblioteca.obter(i.c) && window.rb.biblioteca.grifosDe(i.c).length, ids)).toBe(1);
    expect((await page.evaluate(() => window.rb.dados.listar('trilhas')))[0].itens).toEqual([ids.c]);
    // "Não são repetidas" tira o grupo da lista.
    await page.locator('.org-item', { hasText: 'Coleta seletiva' }).getByRole('button', { name: 'Não são repetidas' }).click();
    await expect(page.locator('.org-item', { hasText: 'Coleta seletiva' })).toHaveCount(0);
  });

  test('adicionar à mão uma obra que já está na biblioteca avisa antes de salvar', async ({ page, context }) => {
    await entrar(page, context);
    await page.evaluate(() => window.rb.biblioteca.adicionar({ tipo: 'artigo', titulo: 'Rotas negociadas', autores: [{ sobrenome: 'Moraes', prenomes: 'T.' }], ano: '2024' }));
    await page.getByRole('button', { name: 'Adicionar obra' }).click();
    await page.getByRole('button', { name: 'Preencher à mão' }).click();
    await page.locator('#f-titulo').fill('Rotas negociadas');
    await page.locator('#f-autores').fill('Moraes, T.');
    await page.locator('#f-ano').fill('2024');
    await page.locator('#ad-salvar').click();
    await expect(page.locator('#ad-msg')).toContainText('Esta obra já está na biblioteca');
    expect(await page.evaluate(() => window.rb.biblioteca.leituras().length)).toBe(1);
  });
});

test.describe('sincronização entre aparelhos', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Regras de dados'));

  test('dois aparelhos gravando juntos: a versão mais nova daqui não se perde quando o Drive volta para uma mais velha', async ({ page, context }) => {
    const { g } = await entrar(page, context);
    await page.evaluate(async () => {
      await window.rb.dados.salvar('argumentos', { id: 'a1', tese: 'versão 1' });
      await window.rb.sincronia.sincronizar();
    });
    const velho = g.ler('dados/argumentos.json');
    await page.evaluate(async () => {
      await window.rb.dados.salvar('argumentos', { id: 'a1', tese: 'versão 2, feita aqui' });
      await window.rb.sincronia.sincronizar();
    });
    // Outro aparelho grava o arquivo inteiro a partir da cópia velha (com a versão 1 feita por ele).
    const v = JSON.parse(velho);
    v.itens[0].aparelho = 'outro-aparelho';
    g.escrever('dados/argumentos.json', JSON.stringify(v));
    const r = await page.evaluate(async () => {
      await window.rb.sincronia.sincronizar();
      return { lista: await window.rb.dados.listar('argumentos'), conflitos: await window.rb.dados.conflitos() };
    });
    expect(r.lista[0].tese).toBe('versão 2, feita aqui');
    expect(JSON.parse(g.ler('dados/argumentos.json')).itens[0].tese).toBe('versão 2, feita aqui');
    expect(r.conflitos.map((c) => c.versao.tese)).toEqual(['versão 1']);
  });

  test('sessão vencida ao abrir: renova sozinha pelo Google; se a conta não estiver aberta, segue sem erro e oferece reconectar', async ({ page, context }) => {
    const { g } = await entrar(page, context, { rota: '#painel' });
    // Simula o app aberto de novo horas depois.
    await page.evaluate(() => {
      const s = JSON.parse(sessionStorage.getItem('rb.sessao'));
      sessionStorage.setItem('rb.sessao', JSON.stringify({ ...s, expira: Date.now() - 1000 }));
      localStorage.removeItem('rb.renovacao.em');
    });
    await page.reload();
    await page.waitForFunction(() => window.rb?.sincronia?.estado().fase === 'ok');
    expect(g.estado.renovacoes).toBe(1);
    expect(page.url()).not.toContain('access_token');

    // Sem a conta aberta no navegador: volta sem token, sem mensagem de erro, e não tenta de novo em seguida.
    g.op.semSessaoGoogle = true;
    await page.evaluate(() => {
      const s = JSON.parse(sessionStorage.getItem('rb.sessao'));
      sessionStorage.setItem('rb.sessao', JSON.stringify({ ...s, expira: Date.now() - 1000 }));
      localStorage.removeItem('rb.renovacao.em');
    });
    await page.reload();
    await page.waitForFunction(() => window.rb && window.rb.pronto);
    await expect(page.locator('#status-drive')).toContainText('Reconectar ao Google');
    await expect(page.locator('.entrar-erro')).toHaveCount(0);
    await page.reload();
    await page.waitForFunction(() => window.rb && window.rb.pronto);
    expect(g.estado.renovacoes).toBe(2);
  });
});

test('no celular: o Acervo fica em Mais e a lista cabe na tela, sem rolagem lateral', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'celular', 'Só no celular');
  await entrar(page, context);
  await page.evaluate(() => window.rb.biblioteca.adicionar({ tipo: 'artigo', titulo: 'Indicadores de desempenho em centrais de triagem de materiais recicláveis', autores: [{ sobrenome: 'Nogueira', prenomes: 'Lia' }], ano: '2018', veiculo: 'Revista Fictícia de Logística Urbana', doi: '10.0000/rflu.2018.0307-um-doi-bem-comprido-para-testar' }));
  await page.goto('/#mais');
  await page.locator('.mais-lista').getByRole('link', { name: /^Acervo/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Acervo' })).toBeVisible();
  await expect(page.locator('#ac-corpo tr')).toContainText('Faltam o volume ou o número e as páginas');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('no celular: o Hoje mostra a sincronização e o aviso aparece quando ela precisa de você', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'celular', 'Só no celular');
  const { g } = await entrar(page, context, { rota: '#painel' });
  await expect(page.locator('.status-hoje')).toContainText('Sincronizado às');
  await page.getByRole('button', { name: 'Sincronizar agora' }).click();
  await expect(page.locator('#toast')).toContainText('Sincronizado com o Drive');
  await expect(page.locator('#status-movel')).toBeEmpty();
  g.estado.tokenValido = false;
  await page.evaluate(() => window.rb.sincronia.sincronizar());
  await expect(page.locator('#status-movel')).toContainText('A sessão do Google venceu');
  await expect(page.locator('#status-movel').getByRole('button', { name: 'Reconectar' })).toBeVisible();
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(sobra).toBeLessThanOrEqual(1);
});
