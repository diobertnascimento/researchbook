// Entrega 5: Hoje com o próximo passo real, trilhas e argumentos com dados reais.
// Os dados entram direto pela camada de dados do app (rb.dados.salvar), como se tivessem vindo do uso.
import { test, expect } from '@playwright/test';
import { googleFalso } from './google-falso.js';

test.use({ serviceWorkers: 'block' });

const dias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
const dia = (n) => {
  const d = dias(n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const OBRAS = [
  { id: 'moraes-2024', titulo: 'Roteirização colaborativa', autores: [{ sobrenome: 'Moraes', prenomes: 'Tânia' }, { sobrenome: 'Lins', prenomes: 'Rafael' }], ano: '2024', tipo: 'artigo', etapa: 1, paginaAtual: 4, totalPaginas: 12, adicionadaEm: '2026-11-01T10:00:00Z' },
  { id: 'souza-2021', titulo: 'Cooperativas e coleta seletiva', autores: [{ sobrenome: 'Souza', prenomes: 'Ana' }], ano: '2021', tipo: 'artigo', etapa: 0, adicionadaEm: '2026-11-02T10:00:00Z' },
  { id: 'prado-2019', titulo: 'Logística reversa no município', autores: [{ sobrenome: 'Prado', prenomes: 'Caio' }], ano: '2019', tipo: 'artigo', etapa: 2, adicionadaEm: '2026-11-03T10:00:00Z' },
  { id: 'reis-2022', titulo: 'Greenwashing em relatórios', autores: [{ sobrenome: 'Reis', prenomes: 'Lia' }], ano: '2022', tipo: 'artigo', etapa: 4, adicionadaEm: '2026-11-04T10:00:00Z' },
];

async function entrar(page, context) {
  const g = await googleFalso(context);
  await page.goto('/#painel', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb && window.rb.sincronia && window.rb.sincronia.estado().fase === 'ok');
  return g;
}

/** Grava dados de exemplo pela camada do app e recarrega os módulos, como depois de uma sincronização. */
async function semear(page, { obras = OBRAS, grifos = [], fichamentos = [], trilhas = [], argumentos = [] } = {}) {
  await page.evaluate(
    async ({ obras, grifos, fichamentos, trilhas, argumentos }) => {
      for (const [c, itens] of Object.entries({ leituras: obras, grifos, fichamentos, trilhas, argumentos })) for (const i of itens) await window.rb.dados.salvar(c, i);
      await window.rb.biblioteca.carregar();
      await Promise.all([window.rb.fichUI.carregar(), window.rb.argUI.carregar(), window.rb.trilhasUI.carregar()]);
      window.render();
    },
    { obras, grifos, fichamentos, trilhas, argumentos },
  );
}

test.describe('no computador', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos rodam no computador; o celular tem teste próprio abaixo'));

  test('Hoje sem obras convida a adicionar a primeira', async ({ page, context }) => {
    await entrar(page, context);
    await expect(page.locator('.proximo .prox-tit')).toHaveText('Adicione a primeira obra');
    await expect(page.locator('.tambem')).toHaveCount(0);
    await expect(page.locator('.topo p')).toHaveCount(0); // sem "ontem" vazio, sem cobrança
    await page.locator('.proximo [data-bib="adicionar"]').click();
    await expect(page.locator('#modal-tit')).toHaveText('Adicionar leitura');
  });

  test('Hoje mostra a leitura em curso, o último grifo e o que mais há para hoje', async ({ page, context }) => {
    await entrar(page, context);
    const ontem = dias(-1).toISOString();
    await semear(page, {
      grifos: [
        { id: 'g1', leituraId: 'moraes-2024', pagina: 3, texto: 'rotas que as equipes aceitam', rects: [[0, 0, 0.1, 0.01]], funcao: 'evidencia', criadoEm: ontem },
        { id: 'g2', leituraId: 'moraes-2024', pagina: 2, texto: 'trecho antigo', rects: [[0, 0, 0.1, 0.01]], funcao: 'conceito', criadoEm: '2026-01-01T10:00:00Z' },
      ],
      trilhas: [{ id: 'trilha-q', nome: 'Qualificação', prazo: dia(5), itens: ['souza-2021', 'moraes-2024'], criadoEm: '2026-11-01T10:00:00Z' }],
    });
    await expect(page.locator('h1')).toHaveText(new RegExp(new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(new Date())));
    await expect(page.locator('.topo p')).toHaveText('Ontem: 1 grifo.');
    await expect(page.locator('.proximo .rot')).toContainText('leitura em andamento');
    await expect(page.locator('.proximo .prox-tit')).toHaveText('Roteirização colaborativa');
    await expect(page.locator('.proximo .prox-aut')).toHaveText('Moraes e Lins (2024)');
    await expect(page.locator('.proximo blockquote mark.evidencia')).toHaveText('rotas que as equipes aceitam');
    await expect(page.locator('.proximo .acao-l span')).toHaveText('p. 4 de 12');
    const tambem = page.locator('.tambem a');
    await expect(tambem).toHaveCount(2);
    await expect(tambem.nth(0)).toContainText('Trilha Qualificação');
    await expect(tambem.nth(0)).toContainText('2 obras até');
    await expect(tambem.nth(0)).toContainText('faltam 5 dias');
    await expect(tambem.nth(1)).toContainText('Fazer o fichamento: Logística reversa');
    await page.locator('.semana-det summary').click();
    await expect(page.locator('.dist')).toContainText('Evidência');
    await page.getByRole('link', { name: 'Continuar a leitura' }).click();
    await expect(page).toHaveURL(/#leitor\/moraes-2024$/);
  });

  test('Hoje segue a ordem: fichamento em curso, depois a trilha com prazo mais perto', async ({ page, context }) => {
    await entrar(page, context);
    const obras = OBRAS.map((o) => (o.id === 'moraes-2024' ? { ...o, etapa: 0 } : o.id === 'prado-2019' ? { ...o, etapa: 3 } : o));
    await semear(page, {
      obras,
      fichamentos: [{ id: 'prado-2019', leituraId: 'prado-2019', feitos: 2, citacoes: [], resumo: '', analise: {}, trechos: [] }],
      trilhas: [
        { id: 't-longe', nome: 'Disciplina', prazo: dia(40), itens: ['moraes-2024'] },
        { id: 't-perto', nome: 'Qualificação', prazo: dia(3), itens: ['reis-2022', 'souza-2021'] },
      ],
    });
    await expect(page.locator('.proximo .prox-tit')).toHaveText('Logística reversa no município');
    await expect(page.getByRole('link', { name: 'Continuar o fichamento' })).toHaveAttribute('href', '#fichamento/prado-2019');
    await expect(page.locator('.proximo .acao-l span')).toHaveText('Etapa 3 de 5: resumo');
    await expect(page.locator('.tambem a').first()).toContainText('faltam 3 dias');
    await expect(page.locator('.tambem .urg')).toHaveCount(1);

    // Fichamento concluído: a trilha com prazo mais perto manda, e a obra fichada dela é pulada.
    await page.evaluate(async () => {
      const l = window.rb.biblioteca.obter('prado-2019');
      await window.rb.biblioteca.atualizar(l.id, { etapa: 4 });
      window.render();
    });
    await expect(page.locator('.proximo .prox-tit')).toHaveText('Cooperativas e coleta seletiva');
    await expect(page.locator('.proximo .rot')).toContainText('próxima da trilha Qualificação');
    await expect(page.getByRole('link', { name: 'Começar a leitura' })).toBeVisible();
  });

  test('trilha: criar, ordenar, ver o próximo passo, apagar e desfazer', async ({ page, context }) => {
    const g = await entrar(page, context);
    await semear(page);
    await page.goto('/#trilhas');
    await expect(page.locator('.bib-vazia h2')).toHaveText('Nenhuma trilha ainda');
    await page.getByRole('button', { name: 'Criar a primeira trilha' }).click();
    await page.getByRole('button', { name: 'Criar trilha' }).click();
    await expect(page.locator('.erro-campo')).toHaveText('Dê um nome à trilha antes de salvar.');
    await page.getByLabel('Nome').fill('Qualificação');
    await page.getByLabel('Prazo').fill(dia(10));
    await page.getByLabel('Para quê').fill('Sustentar o capítulo de método');
    for (const id of ['moraes-2024', 'souza-2021', 'reis-2022']) {
      await page.locator('#tr-add').selectOption(id);
      await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    }
    await expect(page.locator('.tr-itens li')).toHaveCount(3);
    await page.locator('.tr-itens li').nth(1).getByRole('button', { name: 'Subir' }).click();
    await expect(page.locator('.tr-itens li').first()).toContainText('Cooperativas e coleta seletiva');
    await page.getByRole('button', { name: 'Criar trilha' }).click();

    const trilha = page.locator('.trilha');
    await expect(trilha.locator('h2')).toHaveText('Qualificação');
    await expect(trilha.locator('header p')).toHaveText('Sustentar o capítulo de método. 1 de 3 fichadas.');
    await expect(trilha.locator('.prazo b')).toHaveText(/^Até \d\d\/\d\d$/);
    await expect(trilha.locator('.prazo small')).toHaveText('Faltam 10 dias');
    await expect(trilha.locator('.prazo')).not.toHaveClass(/urgente/);
    const abertas = trilha.locator('.seq:not(.feitas) > li');
    await expect(abertas).toHaveCount(2);
    await expect(abertas.first()).toHaveClass(/agora/);
    await expect(abertas.first().getByRole('link')).toHaveText('Começar a leitura');
    await expect(abertas.nth(1).getByRole('link')).toHaveText('Continuar a leitura');
    await expect(trilha.locator('.concluidas summary')).toHaveText('Ver 1 fichada');

    // Vai para o Drive na próxima sincronização.
    await page.evaluate(() => window.rb.sincronia.sincronizar());
    await expect.poll(() => g.ler('dados/trilhas.json') || '').toContain('Qualificação');

    await page.getByRole('button', { name: 'Editar trilha' }).click();
    await page.getByRole('button', { name: 'Apagar trilha' }).click();
    await expect(page.locator('#toast')).toContainText('Trilha apagada');
    await expect(page.locator('.trilha')).toHaveCount(0);
    await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.locator('.trilha h2')).toHaveText('Qualificação');
    await expect(page.locator('.trilha .seq:not(.feitas) > li')).toHaveCount(2);
  });

  test('argumentos: trechos vêm dos fichamentos, contagem de fontes, criar, renomear, copiar e apagar', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await entrar(page, context);
    await semear(page, {
      fichamentos: [
        { id: 'reis-2022', leituraId: 'reis-2022', feitos: 5, citacoes: [], resumo: '', analise: {}, trechos: [{ id: 't1', texto: 'A adesão pesa mais que a economia (Reis, 2022, p. 8)', argumento: 'A adesão das equipes é o critério', argumentoId: 'arg-adesao' }] },
        { id: 'prado-2019', leituraId: 'prado-2019', feitos: 4, citacoes: [], resumo: '', analise: {}, trechos: [{ id: 't1', texto: 'Rotas impostas são abandonadas (Prado, 2019, p. 3)', argumento: 'a adesão das equipes é o critério' }] },
      ],
      argumentos: [
        { id: 'arg-adesao', tese: 'A adesão das equipes é o critério', tipo: 'tese', criadoEm: '2026-11-05T10:00:00Z' },
        { id: 'arg-custo', tese: 'O custo de combustível cai com rotas fixas', tipo: 'premissa', criadoEm: '2026-11-06T10:00:00Z' },
      ],
    });
    await page.goto('/#argumentos');
    const itens = page.locator('.arg-item');
    await expect(itens).toHaveCount(2);
    await expect(itens.first()).toContainText('A adesão das equipes é o critério');
    await expect(itens.first()).toContainText('2 fontes');
    await expect(page.locator('.arg-det .tese')).toHaveText('A adesão das equipes é o critério');
    await expect(page.locator('.arg-det .trecho-d')).toHaveCount(2); // um pelo id, outro pelo texto da tese
    await expect(page.locator('.arg-det .fontes a')).toHaveCount(2);
    await expect(page.locator('.lembrete')).toHaveCount(0);

    await itens.nth(1).click();
    await expect(page).toHaveURL(/#argumentos\/arg-custo$/);
    await expect(page.locator('.arg-det .tese')).toHaveText('O custo de combustível cai com rotas fixas');
    await expect(page.locator('.lembrete')).toContainText('Ainda sem fonte');

    // Copiar um trecho leva o texto exato, com a citação que o Diobert escreveu.
    await itens.first().click();
    await page.locator('.trecho-d').first().getByRole('button', { name: 'Copiar' }).click();
    await expect(page.locator('#toast')).toContainText('Trecho copiado');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\(Reis, 2022, p\. 8\)|\(Prado, 2019, p\. 3\)/);

    // Novo argumento; tese repetida é recusada com atalho para a existente.
    await page.getByRole('button', { name: 'Novo argumento' }).click();
    await page.getByLabel('Tese').fill('a adesão das   equipes é o critério');
    await page.getByRole('button', { name: 'Criar argumento' }).click();
    await expect(page.locator('.erro-campo')).toContainText('Você já tem um argumento com esta tese');
    await page.getByLabel('Tese').fill('Rotas precisam ser negociadas com as equipes');
    await page.getByLabel('Tipo').selectOption('objecao');
    await page.getByLabel('Onde entra no texto').fill('capítulo 2');
    await page.getByRole('button', { name: 'Criar argumento' }).click();
    await expect(page).toHaveURL(/#argumentos\/arg-rotas-precisam/);
    await expect(page.locator('.arg-det .chip').first()).toHaveText('Objeção a responder');
    await expect(page.locator('.arg-det .meta')).toContainText('Entra em: capítulo 2');

    // Renomear a tese leva o novo texto para os trechos ligados, inclusive o que estava ligado só pelo texto.
    await page.goto('/#argumentos/arg-adesao');
    await page.getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Tese').fill('A adesão das equipes define o sucesso');
    await page.getByRole('button', { name: 'Salvar mudanças' }).click();
    await expect(page.locator('.arg-det .tese')).toHaveText('A adesão das equipes define o sucesso');
    await expect(page.locator('.arg-det .trecho-d')).toHaveCount(2);
    const ligados = await page.evaluate(() => ['reis-2022', 'prado-2019'].map((id) => window.rb.fichUI.doLivro(id).trechos[0]));
    for (const t of ligados) {
      expect(t.argumento).toBe('A adesão das equipes define o sucesso');
      expect(t.argumentoId).toBe('arg-adesao');
    }

    // Apagar com desfazer; os trechos continuam no fichamento.
    await page.getByRole('button', { name: 'Editar' }).click();
    await page.getByRole('button', { name: 'Apagar argumento' }).click();
    await expect(page.locator('#toast')).toContainText('Os trechos continuam nos fichamentos');
    await expect(page.locator('.arg-item')).toHaveCount(2);
    await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(page).toHaveURL(/#argumentos\/arg-adesao$/);
    await expect(page.locator('.arg-item')).toHaveCount(3);
  });

  test('concluir um fichamento cria o argumento e ele aparece em Argumentos com a obra', async ({ page, context }) => {
    await entrar(page, context);
    await semear(page, { fichamentos: [{ id: 'prado-2019', leituraId: 'prado-2019', feitos: 4, citacoes: [], resumo: '', analise: {}, trechos: [{ id: 't1', texto: 'Rotas impostas são abandonadas (Prado, 2019, p. 3)', argumento: 'Rotas impostas não duram' }] }] });
    await page.goto('/#fichamento/prado-2019');
    await page.getByRole('button', { name: 'Concluir fichamento' }).click();
    await expect(page.locator('#toast')).toContainText('Fichamento concluído');
    await page.goto('/#argumentos');
    await expect(page.locator('.arg-item')).toHaveCount(1);
    await expect(page.locator('.arg-det .tese')).toHaveText('Rotas impostas não duram');
    await expect(page.locator('.lembrete')).toContainText('Depende de uma única obra');
    await expect(page.locator('.arg-det .fontes a')).toContainText('Prado (2019)');
  });
});

test('no celular, Hoje, Trilhas e Argumentos cabem na tela', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'celular', 'Só no celular');
  await entrar(page, context);
  await semear(page, {
    grifos: [{ id: 'g1', leituraId: 'moraes-2024', pagina: 3, texto: 'rotas que as equipes aceitam e percorrem todos os dias, mesmo quando a rota simulada seria mais curta', rects: [[0, 0, 0.1, 0.01]], funcao: 'evidencia', criadoEm: new Date().toISOString() }],
    trilhas: [{ id: 'trilha-q', nome: 'Leituras para a qualificação de mestrado', prazo: dia(2), objetivo: 'Sustentar o capítulo de método', itens: ['souza-2021', 'moraes-2024', 'reis-2022'] }],
    fichamentos: [{ id: 'reis-2022', leituraId: 'reis-2022', feitos: 5, citacoes: [], resumo: '', analise: {}, trechos: [{ id: 't1', texto: 'A adesão pesa mais que a economia simulada nas rotas de coleta (Reis, 2022, p. 8)', argumento: 'A adesão das equipes é o critério', argumentoId: 'arg-adesao' }] }],
    argumentos: [{ id: 'arg-adesao', tese: 'A adesão das equipes é o critério', tipo: 'tese' }],
  });
  const largura = page.viewportSize().width;
  const cabe = async (rotulo) => {
    const larg = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(larg, `${rotulo} passou da largura`).toBeLessThanOrEqual(largura);
  };
  await expect(page.locator('.proximo .prox-tit')).toBeVisible();
  await cabe('Hoje');
  await page.goto('/#trilhas');
  await expect(page.locator('.trilha .prazo')).toHaveClass(/urgente/);
  await cabe('Trilhas');
  await page.getByRole('button', { name: 'Editar trilha' }).click();
  await expect(page.locator('.tr-itens li')).toHaveCount(3);
  await cabe('Editar trilha');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.goto('/#argumentos/arg-adesao');
  await expect(page.locator('.arg-lista')).toBeHidden(); // no celular, o argumento escolhido ocupa a tela
  await expect(page.getByRole('link', { name: 'Todos os argumentos' })).toBeVisible();
  await cabe('Argumento');
  await page.getByRole('link', { name: 'Todos os argumentos' }).click();
  await expect(page.locator('.arg-lista')).toBeVisible();
  await cabe('Argumentos');
});
