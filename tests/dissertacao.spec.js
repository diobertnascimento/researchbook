// Etapa 11: dissertação (revisão do projeto e orientação) e diálogos, com o Gemini simulado.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { googleFalso } from './google-falso.js';
import { geminiFalso } from './gemini-falso.js';

test.use({ serviceWorkers: 'block' });

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
function wav(segundos) {
  const n = 8000 * segundos;
  const b = Buffer.alloc(44 + n, 128);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(8000, 28);
  b.writeUInt16LE(1, 32);
  b.writeUInt16LE(8, 34);
  b.write('data', 36);
  b.writeUInt32LE(n, 40);
  return b;
}

async function entrar(page, context, rota, opcoesGemini = {}) {
  const g = await googleFalso(context);
  const gem = await geminiFalso(context, opcoesGemini);
  await page.goto(rota, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.evaluate(() => {
    localStorage.setItem('rb.ia.acesso', 'google');
    localStorage.setItem('rb.ia.projeto', 'projeto-teste');
  });
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb?.sincronia?.estado().fase === 'ok' && window.rb.dissertacaoUI);
  await page.evaluate(async () => {
    const b = window.rb.biblioteca;
    const id = await b.adicionar({ titulo: 'Roteirização colaborativa', autores: [{ sobrenome: 'Moraes', prenomes: 'Tânia' }, { sobrenome: 'Lins', prenomes: 'Rafael' }], ano: 2024, veiculo: 'Revista de Exemplo' });
    await b.grifar({ leituraId: id, pagina: 4, texto: 'A adesão das equipes de coleta às rotas negociadas reduziu os conflitos na cooperativa.', rects: [[0, 0, 1, 1]], funcao: 'evidencia' });
  });
  await page.goto(rota);
  return { g, gem };
}

test.describe('no computador', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos rodam no computador; o celular tem teste próprio'));

  test('revisão do projeto: prioridades, obras ligadas à biblioteca, problemas, trilha e comparação entre versões', async ({ page, context }) => {
    const { g, gem } = await entrar(page, context, '/#projeto');
    await expect(page.locator('.bib-vazia')).toContainText('Nenhuma versão enviada');
    await page.locator('[data-rev-pdf]').setInputFiles({ name: 'projeto-v1.pdf', mimeType: 'application/pdf', buffer: PDF });
    await expect(page.locator('#toast')).toContainText('Versão 1 revisada: 3 obras, 1 problema nas referências');
    // O parecer é pedido logo depois, então a revisão é procurada pelo formato da resposta.
    const p = gem.pedidos.findLast((x) => x.corpo.generationConfig?.responseJsonSchema?.properties?.obras);
    expect(p.modelo).toBe('gemini-4-argon');
    expect(p.corpo.contents.at(-1).parts[0].inlineData.mimeType).toBe('application/pdf');
    expect(p.corpo.contents.at(-1).parts[1].text).toContain('B1: Moraes; Lins (2024). Roteirização colaborativa');

    const alta = page.locator('.prio-grupo').first();
    await expect(alta.locator('header h3')).toHaveText('Prioridade alta');
    await expect(alta.locator('.ref-linha')).toHaveCount(2);
    await expect(alta.locator('.ref-linha').first()).toContainText('Na biblioteca');
    await expect(alta.locator('.ref-linha').first().getByRole('link', { name: 'Abrir' })).toHaveAttribute('href', /#leitor\//);
    await alta.locator('.ref-linha').nth(1).getByRole('button', { name: 'Marcar para buscar' }).click();
    await expect(alta.locator('.ref-linha').nth(1)).toContainText('Na lista para buscar');
    await expect(page.locator('details.prio-grupo').nth(1)).toContainText('Prioridade baixa');
    await expect(page.locator('.inc li')).toContainText('Citação direta sem página');
    await expect(page.locator('.versao')).toContainText('Versão 1, 42 páginas, 3 obras citadas');
    expect(g.tamanho('dissertacao/versoes/v1.pdf')).toBe(PDF.length);

    await page.getByRole('button', { name: 'Criar trilha com 1 leitura' }).click();
    await expect(page.locator('#toast')).toContainText('Trilha "Revisão da versão 1" criada com 1 leitura');

    // O parecer da versão 1 corre em segundo plano; a versão seguinte é enviada depois dele, como no uso real.
    await expect(page.locator('.parecer h2')).toHaveText('Parecer da versão 1', { timeout: 20_000 });
    await page.locator('[data-rev-pdf]').setInputFiles({ name: 'projeto-v2.pdf', mimeType: 'application/pdf', buffer: PDF });
    await expect(page.locator('#toast')).toContainText('Versão 2 revisada', { timeout: 15_000 });
    await expect(page.locator('.versao')).toContainText('Desde a anterior: 1 obra nova, 0 removidas, 1 problema resolvido');
    await expect(page.locator('.versoes button')).toHaveText(['v2', 'v1']);
    await page.locator('.versoes button', { hasText: 'v1' }).click();
    await expect(page.locator('.inc li')).toHaveCount(1);
    expect(await page.evaluate(() => window.rb.historico.todas().filter((c) => c.funcao === 'revisao_projeto').length)).toBe(2);
  });

  test('parecer do projeto: achados por gravidade, trecho conferido no PDF sem IA, decisão por achado com desfazer, pendências e o que a versão seguinte resolveu', async ({ page, context }) => {
    const { gem } = await entrar(page, context, '/#projeto', { trechoDoParecer: 'A coleta seletiva depende de rotas que as equipes aceitem percorrer.' });
    const pdf = readFileSync(join(import.meta.dirname, 'fixtures', 'artigo-teste.pdf'));
    await page.locator('[data-rev-pdf]').setInputFiles({ name: 'projeto-v1.pdf', mimeType: 'application/pdf', buffer: pdf });
    const parecer = page.locator('.parecer');
    await expect(parecer.locator('h2')).toHaveText('Parecer da versão 1', { timeout: 20_000 });
    const pedido = () => gem.pedidos.findLast((x) => x.corpo.generationConfig?.responseJsonSchema?.properties?.achados);
    expect(pedido().modelo).toBe('gemini-4-argon');
    expect(pedido().corpo.contents.at(-1).parts[0].inlineData.mimeType).toBe('application/pdf');
    expect(JSON.stringify(pedido().corpo.contents)).toContain('(primeiro parecer)');
    expect(JSON.stringify(pedido().corpo.systemInstruction)).toContain('Você não reescreve o texto');

    // Três achados (o de parte desconhecida é descartado), do mais grave para o mais leve.
    await expect(parecer.locator('.par-resumo')).toHaveText('3 pontos: 1 compromete a aprovação, 1 importante, 1 ajuste. Faltam decidir 3.');
    const achados = parecer.locator('.achado');
    await expect(achados).toHaveCount(3);
    await expect(achados.nth(0)).toContainText('O propósito não está declarado');
    await expect(achados.nth(0).locator('.chip')).toHaveText('Propósito');
    await expect(achados.nth(0)).toContainText('Critério: Creswell e Creswell, Research Design, 6. ed., cap. 6.');
    // O trecho que está no PDF passa na conferência; o inventado é avisado; o achado de ausência não tem trecho.
    await expect(achados.nth(0).locator('cite')).toHaveText('p. 1');
    await expect(achados.nth(1)).toContainText('Não há cronograma até a defesa');
    await expect(achados.nth(1).locator('blockquote')).toHaveCount(0);
    await expect(achados.nth(2).locator('cite')).toContainText('Não encontrei este trecho no PDF');
    expect(await page.evaluate(() => window.rb.dissertacao.todasRevisoes()[0].parecer.achados.map((a) => a.conferido))).toEqual(['pagina', null, 'nao']);

    // v2.9.1: a página é dividida em seções, e cada ponto é uma linha que abre. Só o primeiro sem decisão vem aberto.
    await expect(page.locator('.proj-indice button')).toHaveText(['Parecer, 3 pontos', 'Suas pendências, 0', 'Leituras e citações, 3 obras']);
    await expect(parecer.locator('.ach-grupo')).toHaveCount(3);
    await expect(parecer.locator('.ach-grupo header h3')).toHaveText(['Compromete a aprovação (1)', 'Importante (1)', 'Ajuste (1)']);
    await expect(achados.nth(0).locator('.ach-linha')).toHaveAttribute('aria-expanded', 'true');
    await expect(achados.nth(0).locator('.ach-sit')).toHaveText('Sem decisão');
    await expect(achados.nth(1).locator('.ach-corpo')).toBeHidden();
    await expect(achados.nth(2).locator('.ach-corpo')).toBeHidden();
    await achados.nth(1).locator('.ach-linha').click();
    await expect(achados.nth(1).locator('.ach-corpo')).toBeVisible();
    await achados.nth(1).locator('.ach-linha').click();
    await expect(achados.nth(1).locator('.ach-corpo')).toBeHidden();
    await parecer.getByRole('button', { name: 'Abrir todos' }).click();
    await expect(parecer.locator('.ach-corpo:visible')).toHaveCount(3);
    await parecer.getByRole('button', { name: 'Recolher todos' }).click();
    await expect(parecer.locator('.ach-corpo:visible')).toHaveCount(0);
    await achados.nth(0).locator('.ach-linha').click();
    await achados.nth(2).locator('.ach-linha').click();
    await page.locator('.proj-indice button').last().click();
    await expect(page.locator('#sec-leituras h2')).toBeInViewport();
    await expect(page.locator('#sec-leituras .par-resumo')).toHaveText('3 obras citadas nesta versão, 2 de prioridade alta. 1 problema nas referências.');

    // Ele decide achado por achado, com desfazer.
    await achados.nth(0).getByRole('button', { name: 'Adicionar às pendências' }).click();
    await expect(achados.nth(0).locator('.ach-sit')).toHaveText('Nas suas pendências');
    await expect(page.locator('.proj-indice button').nth(1)).toHaveText('Suas pendências, 1');
    await expect(page.locator('#toast')).toContainText('Adicionado às suas pendências');
    await expect(parecer.locator('.pendencias li')).toHaveCount(1);
    await expect(parecer.locator('.pendencias li')).toContainText('O propósito não está declarado');
    await achados.nth(2).getByRole('button', { name: 'Ignorar' }).click();
    await expect(achados.nth(2)).toContainText('Ignorado.');
    await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(achados.nth(2).getByRole('button', { name: 'Ignorar' })).toBeVisible();
    await achados.nth(2).getByRole('button', { name: 'Ignorar' }).click();
    await expect(parecer.locator('.par-resumo')).toContainText('Falta decidir 1.');
    await parecer.locator('.pendencias input').check();
    await expect(parecer.locator('.pendencias h3')).toHaveText('Suas pendências (1 de 1 feitas)');
    await expect.poll(() => page.evaluate(() => window.rb.dissertacao.todasRevisoes()[0].parecer.achados.map((a) => `${a.decisao}:${a.feito}`))).toEqual(['pendencia:true', 'null:false', 'ignorado:false']);
    expect(await page.evaluate(() => window.rb.historico.todas().filter((c) => c.funcao === 'parecer_projeto').length)).toBe(1);

    // Versão seguinte: o parecer anterior vai no pedido e a IA diz o que foi resolvido.
    await page.locator('[data-rev-pdf]').setInputFiles({ name: 'projeto-v2.pdf', mimeType: 'application/pdf', buffer: pdf });
    await expect(parecer.locator('h2')).toHaveText('Parecer da versão 2', { timeout: 20_000 });
    expect(JSON.stringify(pedido().corpo.contents)).toContain('P1: [Propósito] O propósito não está declarado');
    await expect(parecer.locator('.par-resolvidos summary')).toHaveText('Resolvido desde a versão 1 (1)');
    await expect(parecer.locator('.par-resolvidos li')).toContainText('O propósito não está declarado');
    await expect(achados).toHaveCount(2);
    await expect(parecer.locator('.pendencias li')).toHaveCount(0);
    // O parecer da versão 1 continua como ele deixou.
    await page.locator('.versoes button', { hasText: 'v1' }).click();
    await expect(parecer.locator('h2')).toHaveText('Parecer da versão 1');
    await expect(parecer.locator('.pendencias input')).toBeChecked();

    // v2.12.0: mudanças quase juntas na mesma versão não apagam uma a outra (o parecer chega enquanto ele clica).
    const junto = await page.evaluate(async () => {
      const d = window.rb.dissertacao;
      const r = d.todasRevisoes()[0];
      const achado = r.parecer.achados[0].id;
      await Promise.all([d.marcarParaBuscar(r.id, 1), d.decidirAchado(r.id, achado, 'pendencia'), d.marcarPendencia(r.id, achado, true), d.marcarParaBuscar(r.id, 2)]);
      const x = d.todasRevisoes()[0];
      return { buscar: x.buscar, decisao: x.parecer.achados[0].decisao, feito: x.parecer.achados[0].feito, achados: x.parecer.achados.length };
    });
    expect(junto).toEqual({ buscar: [1, 2], decisao: 'pendencia', feito: true, achados: 2 });
  });

  test('parecer: se a IA falha, a versão continua gravada e dá para tentar de novo; versão antiga pede o PDF', async ({ page, context }) => {
    await entrar(page, context, '/#projeto', { falharParecer: true });
    await page.locator('[data-rev-pdf]').setInputFiles({ name: 'projeto-v1.pdf', mimeType: 'application/pdf', buffer: PDF });
    await expect(page.locator('#toast')).toContainText('Versão 1 revisada');
    const espera = page.locator('.parecer-espera');
    await expect(espera).toContainText('O parecer desta versão não saiu');
    await expect(page.locator('.versao')).toContainText('Versão 1');
    await expect(page.locator('.prio-grupo').first()).toBeVisible();
    await espera.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.locator('.parecer h2')).toHaveText('Parecer da versão 1', { timeout: 20_000 });
    // PDF que o aparelho não consegue ler: os trechos não são conferidos, e a tela diz.
    await expect(page.locator('.parecer')).toContainText('os trechos abaixo não foram conferidos');

    // Depois de recarregar, uma versão sem parecer pede o PDF de novo.
    await page.evaluate(async () => { const r = window.rb.dissertacao.todasRevisoes()[0]; const { parecer, ...resto } = r; await window.rb.dados.salvar('revisoes', resto); });
    await page.reload();
    await page.waitForFunction(() => window.rb && window.rb.dissertacaoUI && window.rb.sincronia);
    await expect(page.locator('.parecer-espera')).toContainText('Esta versão ainda não tem parecer');
    await page.locator('[data-par-pdf]').setInputFiles({ name: 'projeto-v1.pdf', mimeType: 'application/pdf', buffer: PDF });
    await expect(page.locator('.parecer h2')).toHaveText('Parecer da versão 1', { timeout: 20_000 });
  });

  test('orientação: anotação vira resumo, trecho conferido e combinados; o encontro seguinte trata o combinado anterior; agenda e apagar', async ({ page, context }) => {
    const { g } = await entrar(page, context, '/#orientacao');
    await page.getByRole('button', { name: 'Registrar a primeira conversa' }).click();
    await page.getByLabel('O que foi conversado').fill('Quem orienta pediu para declarar o critério de utilidade antes dos testes e revisar a seção de método.');
    await page.locator('.modal').getByRole('button', { name: 'Registrar conversa' }).click();
    await expect(page.locator('.resumo-ia')).toContainText('A conversa tratou do critério de avaliação');
    await expect(page.locator('blockquote.transcricao')).toHaveCount(1);
    await expect(page.locator('blockquote.transcricao')).toContainText('Quem orienta pediu para declarar o critério');
    await expect(page.locator('.encontro')).toContainText('1 trecho foi descartado porque não estava no registro');
    await expect(page.locator('.lado .combinados li')).toContainText('Declarar o critério de utilidade antes dos testes');
    const id1 = await page.evaluate(() => window.rb.dissertacao.encontros()[0].id);
    await expect.poll(() => g.ler(`orientacao/${id1}/registro.md`)).toContain('- [ ] Declarar o critério de utilidade');

    // Segundo registro (e-mail): a IA diz que o combinado anterior foi resolvido; o autor confirma.
    await page.getByRole('button', { name: 'Registrar conversa' }).click();
    await page.getByRole('button', { name: 'E-mail' }).click();
    await page.getByLabel('Cole o e-mail').fill('Recebi a nova versão com o critério declarado. Vamos conversar sobre a avaliação na próxima reunião.');
    await page.locator('.modal').getByRole('button', { name: 'Registrar conversa' }).click();
    await expect(page.locator('.anteriores li')).toContainText('Parece resolvido');
    await page.getByRole('button', { name: 'Marcar como feito' }).click();
    await expect(page.locator('#toast')).toContainText('Combinado cumprido');
    await expect(page.locator('.lado')).toContainText('1 de 2 combinados cumpridos');
    await expect(page.locator('.dist')).toContainText('Avaliação e critérios');
    await expect(page.locator('.dist .mute-2')).toHaveText('2');
    const p = await page.evaluate(() => window.rb.historico.todas().filter((c) => c.funcao === 'orientacao').length);
    expect(p).toBe(2);

    // Agendar encontro aparece como próximo encontro, com a pauta dos combinados abertos.
    await page.getByRole('button', { name: 'Agendar encontro' }).click();
    await expect(page.locator('#modal-tit')).toHaveText('Agendar');
    await page.getByLabel('Data').fill(await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10); }));
    await page.locator('.modal').getByRole('button', { name: 'Agendar', exact: true }).click();
    await expect(page.locator('.lado h3', { hasText: 'Próximo encontro:' })).toBeVisible();
    await expect(page.locator('.lado ol li')).toContainText('Declarar o critério de utilidade antes dos testes');

    // Apagar o registro tem desfazer.
    await page.locator('.encontro').first().getByRole('button', { name: 'Apagar registro' }).click();
    await expect(page.locator('.encontro')).toHaveCount(1);
    await page.locator('#toast button', { hasText: 'Desfazer' }).click();
    await expect(page.locator('.encontro')).toHaveCount(2);
  });

  test('orientação gravada: transcrição e registro automático depois', async ({ page, context }) => {
    const { g } = await entrar(page, context, '/#orientacao');
    await page.getByRole('button', { name: 'Registrar a primeira conversa' }).click();
    await page.getByRole('button', { name: 'Áudio' }).click();
    await page.getByLabel('Gravação (MP3, M4A, WAV)').setInputFiles({ name: 'reuniao.wav', mimeType: 'audio/wav', buffer: wav(90) });
    await page.locator('.modal').getByRole('button', { name: 'Registrar conversa' }).click();
    await expect(page.locator('.resumo-ia')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('blockquote.transcricao').first()).toContainText('[00:05] Docente:');
    const id = await page.evaluate(() => window.rb.dissertacao.encontros()[0].id);
    expect(JSON.parse(g.ler(`orientacao/${id}/transcricao.json`)).segmentos.length).toBe(3);
    await expect.poll(() => g.tamanho(`orientacao/${id}/audio.wav`)).toBe(44 + 8000 * 90);
  });

  test('diálogos: contraponto com citação conferida, modo socrático, encerrar com posições conferidas, memória e argumento com desfazer', async ({ page, context }) => {
    const { gem } = await entrar(page, context, '/#dialogos');
    await page.evaluate(async () => {
      await window.rb.dados.salvar('argumentos', { id: 'arg-adesao', tese: 'A adesão substitui a economia simulada.', tipo: 'tese', secao: '3.5', criadoEm: new Date().toISOString() });
      await window.rb.argUI.carregar();
    });
    await page.getByRole('button', { name: 'Começar um diálogo' }).click();
    await page.getByLabel('Tema ou posição').fill('A adesão das equipes é o critério certo de avaliação');
    await page.locator('.leit-lista input').first().check();
    await page.locator('.modal').getByRole('button', { name: 'Começar o diálogo' }).click();
    await expect(page.locator('.conversa-card h2')).toHaveText('A adesão das equipes é o critério certo de avaliação');

    await page.getByLabel('Mensagem').fill('A adesão é necessária, não suficiente, para validar o roteirizador.');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.locator('.conversa-card .msg.tutor')).toHaveCount(1);
    await expect(page.locator('.conversa-card .msg.tutor .chip')).toHaveText('(Moraes; Lins, 2024, p. 4)');
    await expect(page.locator('.conversa-card .msg.tutor')).not.toContainText('[A1]');
    const p = gem.pedidos.at(-1);
    expect(p.corpo.systemInstruction.parts[0].text).toContain('interlocutor intelectual');
    expect(p.corpo.contents.at(-1).parts[0].text).toContain('Modo: Contraponto.');
    expect(p.corpo.contents.at(-1).parts[0].text).toContain('[arg-adesao] A adesão substitui a economia simulada.');

    await page.locator('.seg button', { hasText: 'Socrático' }).click();
    await expect(page.locator('#toast')).toContainText('Modo Socrático');
    await page.getByLabel('Mensagem').fill('Quem valida é a utilidade decisional.');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.locator('.conversa-card .msg.tutor')).toHaveCount(2);
    await expect(page.locator('.conversa-card .msg.tutor').nth(1).locator('p:not(.pergunta-tutor):not(.mute)')).toHaveCount(0);

    await page.getByRole('button', { name: 'Encerrar e firmar posições' }).click();
    await expect(page.locator('#toast')).toContainText('1 posição para revisar');
    await expect(page.locator('.pos')).toHaveText(/Quem valida é a utilidade decisional\./);
    await expect(page.locator('.lado')).toContainText('Como medir a utilidade sem avaliadores humanos?');

    await page.getByRole('button', { name: 'Atualizar argumento' }).click();
    await expect.poll(() => page.evaluate(() => window.rb.argUI.todos()[0].tese)).toBe('Quem valida é a utilidade decisional.');
    await page.locator('#toast button', { hasText: 'Desfazer' }).click();
    await expect.poll(() => page.evaluate(() => window.rb.argUI.todos()[0].tese)).toBe('A adesão substitui a economia simulada.');

    await page.getByRole('button', { name: 'Guardar na memória' }).click();
    await expect(page.locator('#toast')).toContainText('Posição guardada na memória');
    const mem = await page.evaluate(async () => (await window.rb.dados.listar('memoria')).map((m) => [m.status, m.tipo, m.texto]));
    expect(mem).toEqual([['aprovada', 'posicao', 'Quem valida é a utilidade decisional.']]);

    await page.getByRole('button', { name: 'Apagar diálogo' }).click();
    await expect(page.locator('.bib-vazia')).toBeVisible();
    await page.locator('#toast button', { hasText: 'Desfazer' }).click();
    await expect(page.locator('.conversa-card')).toBeVisible();
  });

  test('erro de configuração do Gemini na revisão leva aos Ajustes', async ({ page, context }) => {
    await entrar(page, context, '/#projeto', { cenario: 'api-desligada' });
    await page.locator('[data-rev-pdf]').setInputFiles({ name: 'projeto.pdf', mimeType: 'application/pdf', buffer: PDF });
    await expect(page.locator('#modal-tit')).toHaveText('Não deu para revisar esta versão');
    await expect(page.locator('.modal a[href="#ajustes"]')).toBeVisible();
  });
});

test.describe('no celular', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'celular', 'Só no celular'));

  test('revisão, orientação e diálogos cabem na tela', async ({ page, context }) => {
    await entrar(page, context, '/#projeto');
    const sobra = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.locator('[data-rev-pdf]').setInputFiles({ name: 'projeto.pdf', mimeType: 'application/pdf', buffer: PDF });
    await expect(page.locator('.ref-linha').first()).toBeVisible();
    expect(await sobra()).toBeLessThanOrEqual(0);
    await page.goto('/#orientacao');
    await page.getByRole('button', { name: 'Registrar a primeira conversa' }).click();
    await page.getByLabel('O que foi conversado').fill('Quem orienta pediu para declarar o critério.');
    await page.locator('.modal').getByRole('button', { name: 'Registrar conversa' }).click();
    await expect(page.locator('.resumo-ia')).toBeVisible();
    expect(await sobra()).toBeLessThanOrEqual(0);
    await page.goto('/#dialogos');
    await page.getByRole('button', { name: 'Começar um diálogo' }).click();
    await page.getByLabel('Tema ou posição').fill('Adesão como critério');
    await page.locator('.modal').getByRole('button', { name: 'Começar o diálogo' }).click();
    await expect(page.locator('.conversa-card')).toBeVisible();
    expect(await sobra()).toBeLessThanOrEqual(0);
  });
});
