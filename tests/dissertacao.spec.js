// Etapa 11: dissertação (revisão do projeto e orientação) e diálogos, com o Gemini simulado.
import { test, expect } from '@playwright/test';
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
    const p = gem.pedidos.at(-1);
    expect(p.modelo).toBe('gemini-4-argon');
    expect(p.corpo.contents.at(-1).parts[0].inlineData.mimeType).toBe('application/pdf');
    expect(p.corpo.contents.at(-1).parts[1].text).toContain('B1: Moraes; Lins (2024). Roteirização colaborativa');

    const alta = page.locator('.prio-grupo').first();
    await expect(alta.locator('header h3')).toHaveText('Prioridade alta');
    await expect(alta.locator('.ref-linha')).toHaveCount(2);
    await expect(alta.locator('.ref-linha').first()).toContainText('Na biblioteca');
    await expect(alta.locator('.ref-linha').first().getByRole('link', { name: 'Abrir' })).toHaveAttribute('href', /#leitor\//);
    await alta.locator('.ref-linha').nth(1).getByRole('button', { name: 'Vou buscar' }).click();
    await expect(alta.locator('.ref-linha').nth(1)).toContainText('Na lista para buscar');
    await expect(page.locator('details.prio-grupo').nth(1)).toContainText('Prioridade baixa');
    await expect(page.locator('.inc li')).toContainText('Citação direta sem página');
    await expect(page.locator('.versao')).toContainText('Versão 1, 42 páginas, 3 obras citadas');
    expect(g.tamanho('dissertacao/versoes/v1.pdf')).toBe(PDF.length);

    await page.getByRole('button', { name: 'Criar trilha com 1 leitura' }).click();
    await expect(page.locator('#toast')).toContainText('Trilha "Revisão da versão 1" criada com 1 leitura');

    await page.locator('[data-rev-pdf]').setInputFiles({ name: 'projeto-v2.pdf', mimeType: 'application/pdf', buffer: PDF });
    await expect(page.locator('#toast')).toContainText('Versão 2 revisada');
    await expect(page.locator('.versao')).toContainText('Desde a anterior: 1 obra nova, 0 removidas, 1 problema resolvido');
    await expect(page.locator('.versoes button')).toHaveText(['v2', 'v1']);
    await page.locator('.versoes button', { hasText: 'v1' }).click();
    await expect(page.locator('.inc li')).toHaveCount(1);
    expect(await page.evaluate(() => window.rb.historico.todas().filter((c) => c.funcao === 'revisao_projeto').length)).toBe(2);
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
    expect(mem).toEqual([['aprovado', 'posicao', 'Quem valida é a utilidade decisional.']]);

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
