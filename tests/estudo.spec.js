// Etapa 13: cartões de revisão espaçada, comentários do tutor no fichamento e Overview do autor.
import { test, expect } from '@playwright/test';
import { deflateRawSync } from 'node:zlib';
import { googleFalso } from './google-falso.js';
import { geminiFalso } from './gemini-falso.js';

test.use({ serviceWorkers: 'block' });

/** .docx mínimo, com o document.xml comprimido (como o Word faz). */
function docx(paragrafos) {
  const xml = Buffer.from(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragrafos.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`);
  const dados = deflateRawSync(xml);
  const nome = Buffer.from('word/document.xml');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(dados.length, 18);
  local.writeUInt32LE(xml.length, 22);
  local.writeUInt16LE(nome.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(dados.length, 20);
  central.writeUInt32LE(xml.length, 24);
  central.writeUInt16LE(nome.length, 28);
  central.writeUInt32LE(0, 42);
  const inicioCentral = local.length + nome.length + dados.length;
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(1, 8);
  fim.writeUInt16LE(1, 10);
  fim.writeUInt32LE(central.length + nome.length, 12);
  fim.writeUInt32LE(inicioCentral, 16);
  return Buffer.concat([local, nome, dados, central, nome, fim]);
}

async function entrar(page, context, rota) {
  const g = await googleFalso(context);
  const gem = await geminiFalso(context);
  await page.goto(rota, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.evaluate(() => {
    localStorage.setItem('rb.ia.acesso', 'google');
    localStorage.setItem('rb.ia.projeto', 'projeto-teste');
  });
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb?.sincronia?.estado().fase === 'ok' && window.rb.cartoesUI);
  const id = await page.evaluate(async () => {
    const b = window.rb.biblioteca;
    const id = await b.adicionar({ titulo: 'Roteirização colaborativa', autores: [{ sobrenome: 'Moraes', prenomes: 'Tânia' }, { sobrenome: 'Lins', prenomes: 'Rafael' }], ano: 2024, veiculo: 'Revista de Exemplo' });
    await b.grifar({ leituraId: id, pagina: 4, texto: 'A adesão das equipes de coleta às rotas negociadas reduziu os conflitos na cooperativa.', rects: [[0, 0.1, 1, 0.1]], funcao: 'evidencia' });
    await b.grifar({ leituraId: id, pagina: 5, texto: 'Rota negociada é a rota definida junto com quem faz a coleta, não imposta pelo sistema.', rects: [[0, 0.2, 1, 0.1]], funcao: 'conceito' });
    return id;
  });
  return { g, gem, id };
}

test.describe('no computador', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos rodam no computador; o celular tem teste próprio'));

  test('cartões: criar com conferência, revisar com intervalos, "de novo" volta na sessão, Hoje avisa, editar e apagar', async ({ page, context }) => {
    const { gem } = await entrar(page, context, '/#cartoes');
    await page.goto('/#cartoes');
    await page.getByRole('button', { name: 'Criar os primeiros cartões' }).click();
    await page.locator('.modal').getByRole('button', { name: 'Propor cartões' }).click();
    await expect(page.locator('#modal-tit')).toHaveText('Conferir os cartões');
    await expect(page.locator('.pl-it')).toHaveCount(2);
    await expect(page.locator('.modal')).toContainText('1 proposta ficou de fora');
    expect(gem.pedidos.find((x) => x.corpo.generationConfig?.responseJsonSchema?.properties?.cartoes).corpo.contents.at(-1).parts[0].text).toContain('[O1] (Evidência) A adesão das equipes');
    await page.getByRole('button', { name: 'Guardar os marcados' }).click();
    await expect(page.locator('#toast')).toContainText('2 cartões guardados');

    await expect(page.locator('.topo p')).toContainText('Cartão 1 de 2');
    await expect(page.locator('.face .q').first()).toHaveText('Que evidência sustenta a adesão das equipes e qual é o limite dela?');
    await expect(page.locator('.face .origem').first()).toHaveText('(Moraes; Lins, 2024, p. 4)');
    await page.getByRole('button', { name: 'Mostrar resposta' }).click();
    await expect(page.locator('.notas-rev button small')).toHaveText(['em 10 min', 'amanhã', 'amanhã', 'em 4 dias']);
    await page.locator('[data-cart-nota="2"]').click();
    await expect(page.locator('.topo p')).toContainText('Cartão 2 de 2');
    await expect(page.locator('.face .q').first()).toHaveText('O que a obra entende por rota negociada?');
    await page.getByRole('button', { name: 'Mostrar resposta' }).click();
    await page.locator('[data-cart-nota="0"]').click();
    await expect(page.locator('.topo p')).toHaveText('Este cartão voltou. Tente lembrar de novo antes de virar.');
    await expect(page.locator('.face .q').first()).toHaveText('O que a obra entende por rota negociada?');
    await page.keyboard.press(' ');
    await page.keyboard.press('4');
    await expect(page.locator('.fim-sessao h2')).toHaveText('Sessão concluída');
    await expect(page.locator('.fim-sessao .num')).toContainText('2cartões revisados');
    await expect(page.locator('.fim-sessao .num')).toContainText('1lembrados de primeira');
    const estados = await page.evaluate(() => window.rb.cartoes.todos().map((c) => [c.estado.repeticoes, c.estado.intervalo]));
    expect(estados).toEqual([[1, 1], [1, 4]]);

    // Um cartão vencido aparece no Hoje.
    await page.evaluate(async () => {
      const c = window.rb.cartoes.todos()[0];
      await window.rb.cartoes.salvar({ ...c, estado: { ...c.estado, proxima: '2026-01-01T00:00:00' } });
    });
    await page.goto('/#painel');
    await expect(page.locator('.tambem')).toContainText('Revisar 1 cartão');

    // Lista: editar e apagar com desfazer.
    await page.goto('/#cartoes');
    await page.getByRole('button', { name: 'Todos os cartões (2)' }).click();
    await page.locator('.cart-it').first().getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Pergunta').fill('Que evidência sustenta a adesão das equipes?');
    await page.locator('.modal').getByRole('button', { name: 'Salvar' }).click();
    await expect(page.locator('.cart-it').first()).toContainText('Que evidência sustenta a adesão das equipes?');
    await page.locator('.cart-it').first().getByRole('button', { name: 'Apagar' }).click();
    await expect(page.locator('.cart-it')).toHaveCount(1);
    await page.locator('#toast button', { hasText: 'Desfazer' }).click();
    await expect(page.locator('.cart-it')).toHaveCount(2);
  });

  test('intervalos: regra pura', async ({ page, context }) => {
    await entrar(page, context, '/#cartoes');
    const r = await page.evaluate(async () => {
      const m = await import('/js/cartoes.js');
      const t0 = new Date('2026-11-14T10:00:00').getTime();
      const a = m.proximo({}, 2, t0);
      const b = m.proximo(a, 2, t0);
      const c = m.proximo(b, 3, t0);
      const d = m.proximo(c, 0, t0);
      const e = m.proximo(d, 1, t0);
      return { a: a.intervalo, b: b.intervalo, c: [c.intervalo, c.facilidade], d: [d.intervalo, d.repeticoes, d.lapsos, Math.round((new Date(d.proxima) - t0) / 60000)], e: e.intervalo, rot: [m.rotuloIntervalo({ intervalo: 0 }), m.rotuloIntervalo({ intervalo: 1 }), m.rotuloIntervalo({ intervalo: 45 })] };
    });
    expect(r.a).toBe(1);
    expect(r.b).toBe(3);
    expect(r.c).toEqual([10, 2.65]);
    expect(r.d).toEqual([0, 0, 1, 10]);
    expect(r.e).toBe(1);
    expect(r.rot).toEqual(['em 10 min', 'amanhã', 'em 2 meses']);
  });

  test('tutor no fichamento: comenta a etapa com o que está escrito, sem reescrever, e os comentários voltam depois', async ({ page, context }) => {
    const { gem, id } = await entrar(page, context, '/#painel');
    const doEsquema = (k) => gem.pedidos.filter((x) => x.corpo.generationConfig?.responseJsonSchema?.properties?.[k]).at(-1);
    await page.goto(`/#fichamento/${id}`);
    // v2.8.0: o tutor comenta as notas do fichamento, a pedido, na tela "Suas notas".
    await page.locator('.fich-grifos > li').first().getByLabel('Com as suas palavras').fill('O texto mostra que negociar as rotas com as equipes reduz conflitos na cooperativa.');
    await expect(page.locator('#fich-salvo')).toHaveText('Salvo');
    await page.locator('.fich-caminho [data-fich-vista="notas"]').click();
    await page.getByRole('button', { name: 'Pedir comentários do tutor' }).click();
    await expect(page.locator('.coment-tutor .ct')).toHaveCount(3);
    await expect(page.locator('.coment-tutor .ct.mais')).toContainText('Falta dizer qual foi o método');
    await expect(page.locator('.coment-tutor .ct.forte small')).toHaveText('Grifo (Moraes; Lins, 2024, p. 4)');
    await expect(page.locator('.coment-tutor')).not.toContainText('[A1]');
    const p = doEsquema('mais_importante');
    const txt = p.corpo.contents.at(-1).parts[0].text;
    expect(txt).toContain('<etapa>\nanalise_critica\n</etapa>');
    expect(txt).toContain('O texto mostra que negociar as rotas com as equipes reduz conflitos na cooperativa.');
    expect(p.corpo.systemInstruction.parts[0].text).toContain('revisando o fichamento');

    await page.reload();
    await page.waitForFunction(() => window.rb?.tutorFich && window.rb.historico.todas().length);
    await page.goto('/#painel');
    await page.goto(`/#fichamento/${id}`);
    await page.locator('.fich-caminho [data-fich-vista="notas"]').click();
    await expect(page.locator('.coment-tutor .ct')).toHaveCount(3);
  });

  test('overview do autor: só os trechos dele, .docx e .txt, exemplos conferidos, métricas, e o resumo vai ao Copilot quando ele escolhe', async ({ page, context }) => {
    const { gem, g } = await entrar(page, context, '/#autor');
    const doEsquema = (k) => gem.pedidos.filter((x) => x.corpo.generationConfig?.responseJsonSchema?.properties?.[k]).at(-1);
    await page.evaluate(async () => {
      const e = window.rb.escrita;
      const t = await e.novo();
      await e.salvar({ ...t, titulo: 'Rotas e cooperativas', passo: 4, tese: 'Adesão vale mais.', secoes: [{ id: 's1', titulo: 'Introdução', html: '<p data-pid="p1" data-autoria="autor">As cooperativas negociam as rotas com as equipes, ou seja, a coleta muda. Por isso a adesão importa?</p><p data-pid="p2" data-autoria="coautoria" data-ia="Parágrafo escrito pela inteligência artificial sobre logística reversa.">Parágrafo escrito pela inteligência artificial sobre logística reversa.</p>' }] });
    });
    await page.goto('/#painel');
    await page.goto('/#autor');
    await page.locator('[data-ov-arquivo]').setInputFiles([
      { name: 'manuscrito.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docx(['Primeiro parágrafo do manuscrito sobre consumo consciente, escrito por mim.', 'Segundo parágrafo, ou seja, a explicação continua aqui com mais detalhes.']) },
      { name: 'resenha.txt', mimeType: 'text/plain', buffer: Buffer.from('Uma resenha curta que escrevi sobre avaliação de artefatos em design, com frases simples e diretas para o leitor entender o ponto principal.\n\nNo segundo parágrafo eu explico por que a avaliação precisa declarar antes o que conta como funcionar.') },
    ]);
    await expect(page.locator('#toast')).toContainText('2 textos adicionados');
    await expect(page.locator('.corpus-lista li')).toHaveCount(3);
    await expect(page.locator('.corpus-lista')).toContainText('manuscrito');
    expect(g.ler(`autor/textos/${await page.evaluate(() => window.rb.overview.corpus().arquivos[0].id)}.txt`)).toContain('Primeiro parágrafo do manuscrito');

    await page.getByRole('button', { name: 'Fazer o retrato' }).click();
    await expect(page.locator('.traco')).toHaveCount(1);
    await expect(page.locator('.aut-estilo')).toContainText('1 exemplo foi descartado');
    await expect(page.locator('.conf-ia')).toContainText('O retrato ainda é preliminar');
    await expect(page.locator('.aut-termos')).toContainText('ou seja');
    await expect(page.locator('.aut-metr')).toContainText('dos parágrafos terminam em pergunta');
    const pedido = doEsquema('tracos').corpo.contents.at(-1).parts[0].text;
    expect(pedido).toContain('As cooperativas negociam as rotas com as equipes');
    expect(pedido).toContain('Primeiro parágrafo do manuscrito');
    expect(pedido).not.toContain('logística reversa');
    expect(JSON.parse(g.ler('autor/overview.json')).tracos).toHaveLength(1);

    await page.getByLabel('Usar este resumo nos pedidos ao Copilot').check();
    await expect(page.locator('#toast')).toContainText('O Copilot passa a receber o resumo');
    const r = await page.evaluate(async () => {
      const t = window.rb.escrita.todos()[0];
      await window.rb.copiloto.conversa(t, t.secoes[0], 'Como melhoro a introdução?', []);
      return true;
    });
    expect(r).toBe(true);
    expect(doEsquema('comentario').corpo.contents.at(-1).parts[0].text).toContain('<voz_do_autor>\nFrases de 15 a 20 palavras');

    // Tirar um texto do corpus.
    await page.locator('.corpus-lista input').nth(2).uncheck();
    await expect(page.locator('.corpus-lista li.fora')).toHaveCount(1);
  });
});

test.describe('no celular', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'celular', 'Só no celular'));
  test('cartões e overview cabem na tela', async ({ page, context }) => {
    await entrar(page, context, '/#cartoes');
    const sobra = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.goto('/#cartoes');
    await page.getByRole('button', { name: 'Criar os primeiros cartões' }).click();
    await page.locator('.modal').getByRole('button', { name: 'Propor cartões' }).click();
    await page.getByRole('button', { name: 'Guardar os marcados' }).click();
    await page.getByRole('button', { name: 'Mostrar resposta' }).click();
    await expect(page.locator('.notas-rev')).toBeVisible();
    expect(await sobra()).toBeLessThanOrEqual(0);
    await page.goto('/#autor');
    await expect(page.getByRole('button', { name: 'Fazer o retrato' })).toBeVisible();
    expect(await sobra()).toBeLessThanOrEqual(0);
  });
});
