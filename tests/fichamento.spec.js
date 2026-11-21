// Fichamento real (v2.8.0): dois caminhos (pelos grifos e pelo texto completo) que viram notas com as palavras
// dele, salvamento automático, perguntas escritas pela IA só quando ele pede, e o arquivo .md no Drive.
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { googleFalso } from './google-falso.js';
import { geminiFalso } from './gemini-falso.js';

const PDF = join(import.meta.dirname, 'fixtures', 'artigo-teste.pdf');
test.use({ serviceWorkers: 'block' });
test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Basta rodar no computador'));

async function obraComGrifos(page, context, { ia = false } = {}) {
  const g = await googleFalso(context);
  const gem = await geminiFalso(context);
  await context.route('https://api.crossref.org/**', (r) =>
    r.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'application/json',
      body: JSON.stringify({ message: { type: 'journal-article', title: ['Roteirização colaborativa'], author: [{ family: 'Moraes', given: 'Tânia' }, { family: 'Lins', given: 'Rafael' }], 'container-title': ['Revista de Exemplo'], volume: '12', issue: '3', page: '45-67', issued: { 'date-parts': [[2024]] }, DOI: '10.1234/exemplo.2024.001' } }),
    }),
  );
  await page.goto('/#biblioteca', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  if (ia) await page.evaluate(() => { localStorage.setItem('rb.ia.acesso', 'google'); localStorage.setItem('rb.ia.projeto', 'projeto-teste'); });
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb && window.rb.sincronia && window.rb.sincronia.estado().fase === 'ok');
  await page.locator('[data-bib="adicionar"]').first().click();
  await page.locator('#ad-pdf').setInputFiles(PDF);
  await expect(page.locator('.ad-msg.ok')).toBeVisible();
  await page.getByRole('button', { name: 'Salvar na biblioteca' }).click();
  await expect(page.locator('.pdf-pagina.pronta .textLayer').first()).toContainText('coleta seletiva');
  for (const [trecho, cor] of [
    ['coleta seletiva', 'evidencia'],
    ['Este texto existe', 'dissert'],
  ]) {
    await page.evaluate((t) => {
      const span = [...document.querySelectorAll('.pdf-pagina[data-pagina="1"] .textLayer span')].find((s) => s.textContent.includes(t));
      const r = document.createRange();
      r.selectNodeContents(span);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
      span.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }, trecho);
    await page.locator(`.pop-pdf.on [data-grifo-pdf="${cor}"]`).click();
  }
  await expect(page.locator('.pdf-grifo')).toHaveCount(2);
  const id = await page.evaluate(() => window.rb.biblioteca.leituras()[0].id);
  return { g, gem, id };
}

test('pelos grifos e pelo texto completo (perguntas gerais, sem IA): notas com referência, argumento, arquivo no Drive', async ({ page, context }) => {
  const { g, gem, id } = await obraComGrifos(page, context);
  await page.getByRole('button', { name: 'Concluir leitura' }).click();
  await page.getByRole('link', { name: 'Fazer fichamento' }).click();
  await expect(page.locator('.fich-topo .ref-previa')).toContainText('MORAES, T.; LINS, R. Roteirização colaborativa. Revista de Exemplo');
  await expect(page.locator('aside.nav')).toBeHidden(); // fichamento sem a barra do app

  // Caminho pelos grifos: aberto por padrão quando a obra tem grifos; filtro por função.
  await expect(page.locator('.fich-caminho button[aria-pressed="true"]')).toHaveText('Pelos grifos, 2');
  const itens = page.locator('.fich-grifos > li');
  await expect(itens).toHaveCount(2);
  await page.locator('.fich-filtro').getByRole('button', { name: 'Evidência' }).click();
  await expect(itens).toHaveCount(1);
  await expect(itens.locator('cite')).toHaveText('Evidência. (Moraes; Lins, 2024, p. 1)');
  await itens.getByLabel('Com as suas palavras').fill('Rota que a equipe não aceita não é percorrida, por melhor que seja no cálculo.');
  await expect(page.locator('#fich-salvo')).toHaveText('Salvo');
  await itens.getByLabel('Sustenta o argumento').fill('A adesão das equipes é o critério de avaliação');
  await expect(page.locator('#fich-salvo')).toHaveText('Salvo');

  // Caminho pelo texto completo, sem IA: 8 perguntas gerais em 5 blocos, respondidas de memória.
  await page.getByRole('button', { name: 'Pelo texto completo' }).click();
  await expect(page.locator('.fich-comeco')).toContainText('O Gemini não está conectado neste aparelho');
  await expect(page.getByRole('button', { name: 'Preparar as perguntas com a IA' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Usar perguntas gerais, sem IA' }).click();
  await expect(page.locator('.fich-pontos button')).toHaveCount(8);
  await expect(page.locator('.fich-bloco')).toHaveText('O essencial. Pergunta 1 de 8');
  await expect(page.locator('.fich-pergunta')).toHaveText('Que problema o texto enfrenta e por que ele importa?');
  await page.locator('#fich-resp').fill('O texto discute rotas de coleta e por que as equipes precisam aceitá-las.');
  await expect(page.locator('#fich-pal')).toHaveText('13 palavras');
  await page.getByLabel('Levar para a dissertação').check();
  // Ajuda só quando ele pede.
  await expect(page.locator('.fich-porque')).toHaveCount(0);
  await page.getByRole('button', { name: 'Por que esta pergunta?' }).click();
  await expect(page.locator('.fich-porque')).toContainText('Sem o problema');
  await expect(page.locator('#fich-resp')).toHaveValue(/precisam aceitá-las\.$/);
  await page.getByRole('button', { name: 'Conferir com o texto' }).click();
  await expect(page.locator('.fich-conf blockquote')).toHaveCount(1); // só o grifo de evidência serve a este bloco
  await expect(page.locator('.fich-conf')).toContainText('(Moraes; Lins, 2024, p. 1)');
  // Trocar a pergunta: a respondida não troca; uma em branco troca por outra do mesmo bloco.
  await page.getByRole('button', { name: 'Trocar a pergunta' }).click();
  await expect(page.locator('#toast')).toContainText('já tem resposta');
  await page.getByRole('button', { name: 'Próxima pergunta' }).click();
  await expect(page.locator('.fich-bloco')).toHaveText('O essencial. Pergunta 2 de 8');
  await page.getByRole('button', { name: 'Trocar a pergunta' }).click();
  await expect(page.locator('.fich-pergunta')).toHaveText('Para quem o texto foi escrito e a que debate ele responde?');
  await expect(page.locator('.fich-pontos button.feita')).toHaveCount(1);
  expect(gem.pedidos.length).toBe(0);

  // Suas notas: cada uma com a referência; concluir cria o argumento e grava o arquivo.
  await page.getByRole('button', { name: /^Suas notas, 2$/ }).click();
  const notas = page.locator('.fich-notas > li');
  await expect(notas).toHaveCount(2);
  await expect(notas.first()).toContainText('(Moraes; Lins, 2024, p. 1)');
  await expect(notas.first()).toContainText('Argumento: A adesão das equipes é o critério de avaliação');
  await expect(notas.nth(1)).toContainText('Resposta a: Que problema o texto enfrenta e por que ele importa?');
  await expect(notas.nth(1)).toContainText('(Moraes; Lins, 2024)');
  await expect(notas.nth(1)).toContainText('Vai para a dissertação');
  await page.getByRole('button', { name: 'Concluir fichamento' }).click();
  await expect(page.locator('#toast')).toContainText('Fichamento concluído');

  const md = await expect.poll(() => g.ler(`fichamentos/${id}.md`)).not.toBeNull().then(() => g.ler(`fichamentos/${id}.md`));
  expect(md).toContain('# Fichamento: Roteirização colaborativa');
  expect(md).toContain('## Notas');
  expect(md).toContain('> "A coleta seletiva depende de rotas que as equipes aceitem percorrer." (Moraes; Lins, 2024, p. 1)');
  expect(md).toContain('Rota que a equipe não aceita não é percorrida, por melhor que seja no cálculo. (Moraes; Lins, 2024, p. 1)');
  expect(md).toContain('### Que problema o texto enfrenta e por que ele importa?');
  expect(md).toContain('(argumento: A adesão das equipes é o critério de avaliação)');

  const r = await page.evaluate(async (id) => ({ args: await window.rb.dados.listar('argumentos'), etapa: window.rb.biblioteca.obter(id).etapa, f: window.rb.fichUI.doLivro(id) }), id);
  expect(r.args.map((a) => a.tese)).toContain('A adesão das equipes é o critério de avaliação');
  expect(r.etapa).toBe(4);
  expect(r.f.feitos).toBe(5);
  expect(r.f.trechos.map((t) => t.daNota)).toEqual([true, true]);
  expect(r.f.trechos[0].argumentoId).toBe(r.args[0].id);

  // O argumento aparece no Mapa com a obra.
  await page.goto('/#argumentos');
  await expect(page.locator('.mapa tbody tr')).toHaveCount(1);
  await expect(page.locator('.mapa tbody td.sust')).toHaveText('Frágil1 obra');
  await page.goto('/#fichamentos');
  await expect(page.locator('.fich-card')).toContainText('Completo, 2 notas');
});

test('perguntas escritas pela IA só quando ele pede: uma vez por obra, com o texto, os grifos e a tese; a IA não responde', async ({ page, context }) => {
  const { gem, id } = await obraComGrifos(page, context, { ia: true });
  await page.evaluate(() => window.rb.sessoes.salvarConfig({ tese: 'Rotas negociadas com as cooperativas duram mais do que rotas calculadas.' }));
  await page.goto(`/#fichamento/${id}`);
  await page.getByRole('button', { name: 'Pelo texto completo' }).click();
  expect(gem.pedidos.length).toBe(0); // abrir a tela não chama a IA
  await page.getByRole('button', { name: 'Preparar as perguntas com a IA' }).click();
  // 6 válidas da IA (a terceira do mesmo bloco e a de bloco inválido saem) + a geral que completa "Conceitos".
  await expect(page.locator('.fich-pontos button')).toHaveCount(6);
  await expect(page.locator('.fich-pergunta')).toHaveText('Que problema das cooperativas o texto diz que as rotas calculadas não resolvem?');
  const p = gem.pedidos.at(-1);
  expect(gem.pedidos.length).toBe(1);
  const txt = JSON.stringify(p.corpo.contents);
  expect(txt).toContain('A coleta seletiva depende de rotas'); // grifo e texto do PDF
  expect(txt).toContain('Rotas negociadas com as cooperativas duram mais');
  expect(p.corpo.systemInstruction.parts[0].text).toContain('Você só pergunta');
  const blocos = await page.evaluate((id) => window.rb.fichUI.doLivro(id).perguntas.itens.map((q) => q.bloco), id);
  expect(blocos).toEqual(['essencial', 'essencial', 'metodo', 'conceitos', 'critica', 'dissertacao']);
  await page.locator('.fich-pontos button').last().click();
  await expect(page.locator('.fich-pergunta')).toHaveText('Como este texto sustenta a sua tese sobre rotas negociadas?');

  // Trocar chama a IA uma vez, para uma pergunta só.
  await page.getByRole('button', { name: 'Trocar a pergunta' }).click();
  await expect(page.locator('.fich-pergunta')).toHaveText('Pergunta nova sobre o mesmo bloco, feita para esta obra?');
  expect(gem.pedidos.length).toBe(2);
  expect(JSON.stringify(gem.pedidos.at(-1).corpo.contents)).toContain('Bloco: dissertacao');

  // As perguntas ficam guardadas: voltar à tela não pede de novo.
  await page.locator('#fich-resp').fill('Sustenta a ideia de que a rota precisa ser aceita por quem a percorre.');
  await expect(page.locator('#fich-salvo')).toHaveText('Salvo');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto && window.rb.fichUI);
  await page.getByRole('button', { name: 'Pelo texto completo' }).click();
  await expect(page.locator('.fich-pontos button')).toHaveCount(6);
  await expect(page.locator('.fich-pontos button.feita')).toHaveCount(1);
  expect(gem.pedidos.length).toBe(2);
  expect(await page.evaluate(() => window.rb.historico.todas().filter((c) => c.funcao === 'fichamento').length)).toBe(1);
});

test('o que foi escrito fica salvo ao sair e voltar; o fichamento das cinco etapas antigas continua à vista', async ({ page, context }) => {
  const { id } = await obraComGrifos(page, context);
  await page.evaluate((id) => window.rb.dados.salvar('fichamentos', { id, leituraId: id, feitos: 3, citacoes: [{ grifoId: 'x', texto: 'Trecho citado antes.', pagina: 2, porque: 'Importava.' }], resumo: 'Resumo escrito nas cinco etapas.', analise: { problema: 'Rotas no papel não garantem uso.' }, trechos: [{ id: 't1', texto: 'Trecho antigo (Moraes; Lins, 2024, p. 1)', argumento: 'Rotas impostas não duram' }] }).then(() => window.rb.fichUI.carregar()), id);
  await page.goto(`/#fichamento/${id}`);
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.locator('.fich-grifos > li').first().getByLabel('Com as suas palavras').fill('Escrito antes de sair.');
  await expect(page.locator('#fich-salvo')).toHaveText('Salvo');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto && window.rb.fichUI);
  await expect(page.locator('.fich-grifos > li').first().getByLabel('Com as suas palavras')).toHaveValue('Escrito antes de sair.');
  await page.getByRole('button', { name: /^Suas notas, 1$/ }).click();
  const antigo = page.locator('.fich-antigo');
  await antigo.locator('summary').click();
  await expect(antigo).toContainText('Resumo escrito nas cinco etapas.');
  await expect(antigo).toContainText('Trecho citado antes.');
  await expect(antigo).toContainText('Rotas no papel não garantem uso.');
  await expect(antigo).toContainText('Trecho antigo (Moraes; Lins, 2024, p. 1)');
  // O trecho antigo continua nos dados, junto das notas novas.
  const f = await page.evaluate((id) => window.rb.fichUI.doLivro(id), id);
  expect(f.trechos.map((t) => t.texto)).toContain('Trecho antigo (Moraes; Lins, 2024, p. 1)');
  expect(f.resumo).toBe('Resumo escrito nas cinco etapas.');
  expect(f.feitos).toBe(3);
});

test('corrigir dados da obra a partir do fichamento atualiza a referência', async ({ page, context }) => {
  const { id } = await obraComGrifos(page, context);
  await page.goto(`/#fichamento/${id}`);
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.getByRole('button', { name: 'Corrigir os dados da obra' }).click();
  await page.locator('#f-local').fill('Belo Horizonte');
  await page.locator('#f-ano').fill('2025');
  await expect(page.locator('#f-ref')).toContainText('Belo Horizonte, v. 12');
  await page.getByRole('button', { name: 'Salvar correções' }).click();
  await expect(page.locator('.fich-topo .ref-previa')).toContainText('2025');
  await expect(page.locator('.fich-topo .ref-previa')).toContainText('Belo Horizonte');
});
