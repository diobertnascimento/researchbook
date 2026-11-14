// Entrega 8: memória real. A IA propõe a partir do que o autor disse; ele guarda, edita, descarta ou esquece;
// só o que foi guardado entra nos pedidos; exportação para outras IAs.
import { test, expect } from '@playwright/test';
import { googleFalso } from './google-falso.js';
import { geminiFalso } from './gemini-falso.js';

test.use({ serviceWorkers: 'block' });

async function entrar(page, context, opcoesGemini = {}) {
  const g = await googleFalso(context);
  const gem = await geminiFalso(context, opcoesGemini);
  await page.goto('/#memoria', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.evaluate(() => { localStorage.setItem('rb.ia.acesso', 'google'); localStorage.setItem('rb.ia.projeto', 'projeto-teste'); });
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb && window.rb.sincronia && window.rb.sincronia.estado().fase === 'ok' && window.rb.memoriaUI);
  return { g, gem };
}

/** Uma conversa com o tutor, como se tivesse acontecido no leitor. */
async function conversa(page, falas, { antiga = false } = {}) {
  return page.evaluate(
    async ({ falas, antiga }) => {
      const h = window.rb.historico;
      const c = await h.nova({ funcao: 'tutor', alvo: { tipo: 'leitura', id: 'obra-x' }, titulo: 'Roteirização colaborativa' });
      for (const f of falas) {
        await h.acrescentar(c.id, { de: 'autor', pedido: { tipo: 'pergunta', texto: f, mostrado: f } });
        await h.acrescentar(c.id, { de: 'ia', resposta: { resposta: 'O texto sustenta essa leitura em parte, com ressalvas sobre o método.', pergunta: 'O que mudaria a sua opinião?', fontes: [], fora_do_acervo: [] } });
      }
      if (antiga) await h.marcar(c.id, { ultimaEm: new Date(Date.now() - 20 * 60000).toISOString() });
      return c.id;
    },
    { falas, antiga },
  );
}

test.describe('no computador', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos rodam no computador; o celular tem teste próprio'));

  test('a IA propõe só o que o autor disse; ele guarda; o item passa a entrar nos pedidos', async ({ page, context }) => {
    const { g, gem } = await entrar(page, context);
    await conversa(page, ['Vou usar a adesão das equipes como critério de avaliação do artefato.']);
    await page.goto('/#memoria');
    await expect(page.locator('.sug h3')).toHaveText('A IA quer lembrar (0)');
    await page.getByRole('button', { name: 'Procurar nas conversas' }).click();
    await expect(page.locator('.mem-aviso')).toHaveText('1 proposta nova.');

    // O pedido: tarefa da memória, modelo rápido, conversa marcada como material.
    const p = gem.pedidos.at(-1);
    expect(p.modelo).toBe('gemini-3.1-flash-lite');
    expect(p.corpo.generationConfig.thinkingConfig.thinkingLevel).toBe('MINIMAL');
    expect(p.corpo.systemInstruction.parts[0].text).toContain('Você lê uma conversa do autor');
    const atual = p.corpo.contents.at(-1).parts[0].text;
    const codigo = atual.match(/Código deste pedido: ([0-9a-f]{8})\./)[1];
    expect(atual).toContain(`<sessao funcao="tutor"`);
    expect(atual).toContain(`<material-${codigo}>\n[0] autor: Vou usar a adesão das equipes`);
    expect(atual).not.toContain('<acervo>');

    // Só a proposta com evidência nas falas do autor aparece; a outra é recusada e registrada.
    const props = page.locator('.sug-it');
    await expect(props).toHaveCount(1);
    await expect(props.first()).toContainText('Vou usar a adesão das equipes como critério de avaliação do artefato.');
    await expect(props.first().locator('.ev')).toHaveText('Você disse: “Vou usar a adesão das equipes”');
    const regs = await page.evaluate(() => window.rb.registros.lista().filter((r) => r.ev === 'memoria.propostas').map((r) => r.det));
    expect(regs.at(-1)).toBe('1 aceitas, 1 recusadas (evidência fora das falas do autor)');

    // Hoje avisa; guardar tira o aviso e o item aparece em Decisões.
    await page.goto('/#painel');
    await expect(page.locator('.tambem')).toContainText('Revisar 1 item para a memória');
    await page.goto('/#memoria');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Guardado na memória');
    await expect(page.locator('.sug h3')).toHaveText('A IA quer lembrar (0)');
    await expect(page.locator('.mem-cat').filter({ hasText: 'Decisões' }).locator('.mem-it')).toContainText('Vou usar a adesão das equipes');

    // A conversa já lida não é lida de novo.
    const n = gem.pedidos.length;
    await page.getByRole('button', { name: 'Procurar nas conversas' }).click();
    await expect(page.locator('.mem-aviso')).toHaveText('Nenhuma conversa com mensagens novas.');
    expect(gem.pedidos.length).toBe(n);

    // A saída da IA ficou no histórico do Drive; a memória sincroniza.
    await page.evaluate(() => window.rb.historico.enviarPendentes());
    const doDrive = g.caminhos().filter((c) => c.startsWith('ia/conversas/')).map((c) => JSON.parse(g.ler(c)));
    expect(doDrive.some((c) => c.conversa.funcao === 'memoria' && c.mensagens[0].aceitas === 1)).toBe(true);
    await page.evaluate(() => window.rb.sincronia.sincronizar());
    await expect.poll(() => g.ler('dados/memoria.json') || '').toContain('"status": "aprovada"');

    // O item guardado entra no próximo pedido ao tutor (só ele: a proposta recusada nunca existiu).
    await page.evaluate(async () => {
      await window.rb.dados.salvar('leituras', { id: 'obra-x', titulo: 'Roteirização colaborativa', autores: [{ sobrenome: 'Moraes' }], ano: '2024', etapa: 1 });
      await window.rb.biblioteca.carregar();
      const c = await window.rb.historico.nova({ funcao: 'tutor', alvo: { tipo: 'leitura', id: 'obra-x' }, titulo: 'teste' });
      await window.rb.ia.perguntarTutor({ leituraId: 'obra-x', tipo: 'pergunta', texto: 'Do que trata?', conversaId: c.id });
    });
    const sistema = gem.pedidos.at(-1).corpo.systemInstruction.parts[0].text;
    expect(sistema).toContain('<memoria>\n- Vou usar a adesão das equipes como critério de avaliação do artefato.\n</memoria>');
    expect(sistema).not.toContain('Uma ideia que só a IA disse');
  });

  test('editar antes de guardar, descartar com desfazer, esquecer com desfazer e escrever um item', async ({ page, context }) => {
    await entrar(page, context);
    await conversa(page, ['Prefiro exemplos antes da definição quando o conceito é novo.']);
    await page.goto('/#memoria');
    await page.getByRole('button', { name: 'Procurar nas conversas' }).click();
    await expect(page.locator('.sug-it')).toHaveCount(1);

    await page.locator('.sug-it').getByRole('button', { name: 'Descartar' }).click();
    await expect(page.locator('.sug-it')).toHaveCount(0);
    await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.locator('.sug-it')).toHaveCount(1);

    await page.locator('.sug-it').getByRole('button', { name: 'Editar' }).click();
    await page.locator('#mem-ed').fill('Exemplos antes da definição, quando o conceito for novo.');
    await page.locator('.sug-it').getByRole('button', { name: 'Guardar' }).click();
    const item = page.locator('.mem-cat').filter({ hasText: 'Decisões' }).locator('.mem-it');
    await expect(item).toContainText('Exemplos antes da definição, quando o conceito for novo.');

    await item.getByRole('button', { name: 'Esquecer' }).click();
    await expect(page.locator('#toast')).toContainText('Não entra mais nos pedidos');
    await expect(page.locator('.mem-cat').filter({ hasText: 'Decisões' }).locator('.mem-it')).toHaveCount(0);
    await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.locator('.mem-cat').filter({ hasText: 'Decisões' }).locator('.mem-it')).toHaveCount(1);

    await page.locator('.mem-novo summary').click();
    await page.getByLabel('Tipo').selectOption('fato');
    await page.getByLabel('Texto', { exact: true }).fill('Qualificação prevista para março.');
    await page.getByRole('button', { name: 'Guardar na memória' }).click();
    await expect(page.locator('.mem-cat').filter({ hasText: 'Fatos do projeto' }).locator('.mem-it')).toContainText('Qualificação prevista para março.');
    await expect(page.locator('.mem-cat').filter({ hasText: 'Fatos do projeto' }).locator('.mem-it small')).toContainText('escrito por você');
  });

  test('proposta que atualiza um item guardado substitui o antigo ao guardar', async ({ page, context }) => {
    await entrar(page, context, { atualizar: true });
    await page.evaluate(() => window.rb.dados.salvar('memoria', { id: 'mem-antigo', tipo: 'decisao', texto: 'Critério de avaliação: economia de rota.', status: 'aprovada', origem: { funcao: 'manual' } }));
    await page.evaluate(() => window.rb.memoriaUI.carregar());
    await conversa(page, ['Mudei de ideia: o critério vai ser a adesão das equipes.']);
    await page.goto('/#memoria');
    await page.getByRole('button', { name: 'Procurar nas conversas' }).click();
    await expect(page.locator('.sug-it .subst')).toHaveText('Substitui: Critério de avaliação: economia de rota.');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    const itens = page.locator('.mem-cat').filter({ hasText: 'Decisões' }).locator('.mem-it');
    await expect(itens).toHaveCount(1);
    await expect(itens).toContainText('Mudei de ideia');
    const antigo = await page.evaluate(() => window.rb.dados.obter('memoria', 'mem-antigo'));
    expect(antigo.status).toBe('substituida');
  });

  test('ao abrir o app, a IA procura nas conversas paradas, sem precisar pedir', async ({ page, context }) => {
    const { gem } = await entrar(page, context);
    await conversa(page, ['Vou fechar o recorte em cooperativas de Belo Horizonte.'], { antiga: true });
    await conversa(page, ['Esta conversa ainda está em andamento e não deve ser lida.']);
    await page.reload();
    await page.waitForFunction(() => window.rb && window.rb.pronto && window.rb.memoriaUI);
    await expect.poll(() => page.evaluate(() => window.rb.memoriaUI.pendentes().length), { timeout: 10000 }).toBe(1);
    const textos = gem.pedidos.filter((p) => p.modelo === 'gemini-3.1-flash-lite').map((p) => p.corpo.contents.at(-1).parts[0].text);
    expect(textos).toHaveLength(1);
    expect(textos[0]).toContain('recorte em cooperativas');
    expect(textos[0]).not.toContain('ainda está em andamento');
  });

  test('exportar para outras IAs: Markdown e JSON, com cópia no Drive', async ({ page, context }) => {
    const { g } = await entrar(page, context);
    await page.evaluate(async () => {
      await window.rb.ia.salvarPerfil('Pesquisador de mestrado em Administração.');
      await window.rb.dados.salvar('memoria', { id: 'mem-1', tipo: 'decisao', texto: 'Avaliar pela adesão das equipes.', status: 'aprovada', origem: { funcao: 'manual' } });
      await window.rb.dados.salvar('memoria', { id: 'mem-2', tipo: 'preferencia', texto: 'Exemplos antes da definição.', status: 'aprovada', origem: { funcao: 'manual' } });
      await window.rb.dados.salvar('memoria', { id: 'mem-3', tipo: 'fato', texto: 'Proposta não aprovada.', status: 'proposta', evidencia: 'x', origem: {} });
      await window.rb.memoriaUI.carregar();
    });
    await page.goto('/#memoria');
    await expect(page.locator('#mem-prev')).toContainText('## Como trabalhar comigo');
    await expect(page.locator('#mem-prev')).toContainText('- Exemplos antes da definição.');
    await expect(page.locator('#mem-prev')).toContainText('## Decisões\n- Avaliar pela adesão das equipes.');
    await expect(page.locator('#mem-prev')).toContainText('Pesquisador de mestrado em Administração.');
    await expect(page.locator('#mem-prev')).not.toContainText('Proposta não aprovada.');

    const [baixado] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar', exact: true }).click()]);
    expect(baixado.suggestedFilename()).toMatch(/^researchbook-contexto-\d{4}-\d{2}-\d{2}\.md$/);
    await expect(page.locator('#toast')).toContainText('Cópia no seu Drive');
    const copia = g.caminhos().find((c) => c.startsWith('memoria/exportar/'));
    expect(g.ler(copia)).toContain('# Contexto exportado do researchbook');

    await page.getByLabel(/JSON estruturado/).check();
    await page.getByLabel('Sobre você (perfil do autor)').uncheck();
    const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar', exact: true }).click()]);
    const dados = JSON.parse(await (await import('node:fs/promises')).readFile(await json.path(), 'utf8'));
    expect(dados.perfil).toBe('');
    expect(dados.memoria.map((m) => m.texto)).toEqual(expect.arrayContaining(['Avaliar pela adesão das equipes.', 'Exemplos antes da definição.']));
    expect(dados.memoria).toHaveLength(2);
    expect(dados.regras[0]).toContain('Não escreva do zero');
  });
});

test('no celular, a tela de memória cabe e as ações aparecem', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'celular', 'Só no celular');
  await entrar(page, context);
  await conversa(page, ['Vou usar a adesão das equipes como critério de avaliação do artefato, comparando com a economia simulada das rotas.']);
  await page.goto('/#memoria');
  await page.getByRole('button', { name: 'Procurar nas conversas' }).click();
  await expect(page.locator('.sug-it')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeVisible();
  const larg = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(larg).toBeLessThanOrEqual(page.viewportSize().width);
});
