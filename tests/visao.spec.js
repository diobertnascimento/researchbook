// v2.5.0, Dissertação: Visão (tese em uma frase, sessão de hoje, plano da semana, capítulos) e a sessão de
// escrita dentro do editor (relógio discreto, registro ao encerrar e a frase onde o autor parou).
import { test, expect } from '@playwright/test';
import { googleFalso } from './google-falso.js';
import { geminiFalso } from './gemini-falso.js';

test.use({ serviceWorkers: 'block' });

async function entrar(page, context) {
  const g = await googleFalso(context);
  const gem = await geminiFalso(context);
  await page.goto('/#dissertacao', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb?.sincronia?.estado().fase === 'ok' && window.rb.visaoUI);
  return { g, gem };
}
const noDrive = (g, arquivo) => {
  try {
    return JSON.parse(g.ler(`dados/${arquivo}.json`)).itens;
  } catch {
    return [];
  }
};

test.describe('no computador', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos rodam no computador; o celular tem teste próprio'));

  test('a Visão abre a Dissertação; a tese é gravada sozinha e o plano da semana muda sem botão Salvar', async ({ page, context }) => {
    const { g } = await entrar(page, context);
    await expect(page.locator('.sec-cab h1')).toHaveText('Dissertação');
    await expect(page.locator('.sec-cab .subnav a')).toHaveText(['Visão', 'Projeto', 'Mapa', 'Orientação', 'Jornada']);
    await expect(page.locator('.sec-cab .subnav a[aria-current="page"]')).toHaveText('Visão');
    await expect(page.locator('#menu a', { hasText: 'Dissertação' })).toHaveAttribute('href', '#dissertacao');

    // Sem capítulo, o painel convida a criar o primeiro, e é o único botão azul.
    await expect(page.locator('.diss-sessao')).toContainText('Comece pelo primeiro capítulo');
    await expect(page.locator('#vista .btn.prim')).toHaveCount(1);

    // Tese: gravada sozinha.
    await page.getByPlaceholder('Escreva aqui a sua tese, em uma frase.').fill('Rotas negociadas com as cooperativas duram mais do que rotas calculadas.');
    await expect(page.locator('#tese-st')).toHaveText('Salva.');
    await expect.poll(() => noDrive(g, 'dissertacao')[0]?.tese, { timeout: 10_000 }).toBe('Rotas negociadas com as cooperativas duram mais do que rotas calculadas.');

    // Plano: padrão de 3 sessões de 25 minutos; mudar grava na hora.
    await expect(page.locator('.diss-plano')).toContainText('Seu plano: 3 sessões de 25 minutos.');
    await page.getByRole('button', { name: 'Mudar o plano' }).click();
    await page.getByLabel('Sessões por semana').selectOption('2');
    await expect(page.locator('.diss-plano')).toContainText('2 sessões de 25 minutos');
    await page.getByLabel('Minutos por sessão').selectOption('40');
    await expect(page.locator('.diss-plano')).toContainText('2 sessões de 40 minutos');
    await expect(page.locator('#vista')).toContainText('Uma semana sem sessão não apaga nada.');

    await page.reload();
    await page.waitForFunction(() => window.rb && window.rb.visaoUI && window.rb.sincronia);
    await expect(page.getByPlaceholder('Escreva aqui a sua tese, em uma frase.')).toHaveValue('Rotas negociadas com as cooperativas duram mais do que rotas calculadas.');
    await expect(page.locator('.diss-plano')).toContainText('2 sessões de 40 minutos');
  });

  test('sessão de escrita: só o texto e o relógio; ao encerrar, registro com minutos, palavras e a frase onde parou', async ({ page, context }) => {
    const { g, gem } = await entrar(page, context);
    const pedidosAntes = gem.pedidos.length;
    // O primeiro capítulo abre direto no editor, sem o roteiro de preparação.
    await page.getByRole('button', { name: 'Criar o primeiro capítulo' }).click();
    await expect(page).toHaveURL(/#texto\//);
    await expect(page.locator('#esc-corpo')).toBeVisible();
    const id = await page.evaluate(() => decodeURIComponent(location.hash.split('/')[1]));
    expect(await page.evaluate((id) => { const t = window.rb.escrita.obter(id); return [t.projeto, t.tipo, t.capitulo, t.passo]; }, id)).toEqual(['Dissertação', 'Capítulo', 1, 4]);
    await page.evaluate(async (id) => { const e = window.rb.escrita; await e.salvar({ ...e.obter(id), titulo: 'Método' }); }, id);

    // Na Visão, o painel aponta o capítulo e começa a sessão.
    await page.goto('/#dissertacao');
    const painel = page.locator('.diss-sessao');
    await expect(painel).toContainText('Sessão de hoje, a 1ª de 3 desta semana');
    await expect(painel).toContainText('Capítulo 1, Método');
    await expect(painel).toContainText('Ainda vazio.');
    await painel.getByRole('button', { name: 'Escrever por 25 minutos' }).click();
    await expect(page).toHaveURL(new RegExp(`#texto/${id}$`));

    // Durante a sessão: só o texto, o relógio e o botão de encerrar.
    const barra = page.locator('.sessao-barra');
    await expect(barra).toContainText('Capítulo 1, Método');
    await expect(page.locator('#sessao-relogio')).toHaveText(/^\d+:\d\d$/);
    for (const sel of ['.esc-cab', '.lat-esc', '.esc-painel', '.folha-barra', 'aside.nav']) await expect(page.locator(sel).first()).toBeHidden();
    await page.locator('#esc-corpo').click();
    await page.keyboard.type('A avaliação foi conduzida em campo, e a diferença era registrada como');
    await expect(page.locator('#sessao-palavras')).toHaveText('12 palavras nesta sessão', { timeout: 6000 });

    // Recarregar no meio não perde a sessão nem o que foi escrito.
    await page.reload();
    await page.waitForFunction(() => window.rb && window.rb.visaoUI && window.rb.sincronia);
    await expect(page.locator('.sessao-barra')).toBeVisible();
    await expect(page.locator('#esc-corpo')).toContainText('era registrada como');

    // Encerrar: com menos de um minuto e texto escrito, a sessão é registrada (mínimo de 1 minuto).
    await page.locator('#esc-corpo').click();
    await page.keyboard.press('Control+End');
    await page.getByRole('button', { name: 'Encerrar sessão' }).click();
    const modal = page.locator('.modal');
    await expect(modal).toContainText('Sessão concluída');
    await expect(modal).toContainText('1 minuto, 12 palavras.');
    await expect(modal).toContainText('Onde você parou: “em campo, e a diferença era registrada como”');
    await expect(modal).toContainText('1 de 3 sessões do plano desta semana.');
    const sessoes = await page.evaluate(() => window.rb.dados.listar('sessoes'));
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0]).toMatchObject({ textoId: id, titulo: 'Método', capitulo: 1, minutos: 1, planejado: 25, palavras: 12, secao: 'Primeira seção' });
    await expect.poll(() => noDrive(g, 'sessoes').length, { timeout: 10_000 }).toBe(1);

    // De volta à Visão: a sessão aparece na semana, e o painel diz onde continuar.
    await modal.getByRole('link', { name: 'Voltar à dissertação' }).click();
    await expect(page).toHaveURL(/#dissertacao$/);
    await expect(page.locator('body')).not.toHaveClass(/sessao/);
    await expect(page.locator('.linha-l li')).toContainText('1 min, 12 palavras');
    await expect(page.locator('.linha-l li')).toContainText('Capítulo 1, Método');
    await expect(page.locator('.diss-sessao')).toContainText('Sessão de hoje, a 2ª de 3 desta semana');
    await expect(page.locator('.diss-sessao')).toContainText('Onde você parou: “em campo, e a diferença era registrada como”');
    await expect(page.locator('.diss-caps li')).toContainText('12 palavras');
    await expect(page.locator('#vista')).toContainText('12 palavras, 100% suas');

    // Com duas seções, a próxima sessão abre na seção em que a anterior terminou, e a barra deixa trocar.
    await page.evaluate(async (id) => { const e = window.rb.escrita; const t = e.obter(id); await e.salvar({ ...t, secoes: [{ id: 's0', titulo: 'Desenho do estudo', objetivo: '', html: '<p data-autoria="autor">Antes.</p>' }, ...t.secoes] }); }, id);
    await page.locator('.diss-sessao').getByRole('button', { name: 'Escrever por 25 minutos' }).click();
    await expect(page.locator('#esc-corpo')).toContainText('era registrada como');
    await page.getByLabel('Seção', { exact: true }).selectOption({ label: 'Desenho do estudo' });
    await expect(page.locator('#esc-corpo')).toHaveText('Antes.');
    await page.getByRole('button', { name: 'Encerrar sessão' }).click();
    await expect(page.locator('#toast')).toContainText('durou menos de um minuto');

    // Fora da sessão, o editor volta ao normal.
    await page.goto(`/#texto/${id}`);
    await expect(page.locator('.esc-cab')).toBeVisible();
    await expect(page.locator('.sessao-barra')).toHaveCount(0);
    // Nada disso chamou a IA.
    expect(gem.pedidos.length).toBe(pedidosAntes);
  });

  test('Jornada: mês de início e prazo gravados ao escolher; marcos com apagar e desfazer; régua e próximo marco', async ({ page, context }) => {
    const { g, gem } = await entrar(page, context);
    const pedidos = gem.pedidos.length;
    await page.locator('.sec-cab .subnav a', { hasText: 'Jornada' }).click();
    await expect(page).toHaveURL(/#jornada$/);
    await expect(page.locator('.jor-comeco')).toContainText('Quando o mestrado começou?');

    // Dez meses atrás, prazo de 24 meses: mês 11 de 24.
    const ini = new Date();
    ini.setDate(1);
    ini.setMonth(ini.getMonth() - 10);
    await page.getByLabel('Ano').selectOption(String(ini.getFullYear()));
    await page.getByLabel('Mês em que começou').selectOption(String(ini.getMonth() + 1));
    await expect(page.locator('.jor-frase')).toContainText('Você está no mês 11 de 24.');
    await expect(page.locator('.regua')).toHaveAttribute('aria-label', 'Mês 11 de 24');
    const esperado = `${ini.getFullYear()}-${String(ini.getMonth() + 1).padStart(2, '0')}`;
    await expect.poll(() => noDrive(g, 'dissertacao')[0]?.inicio, { timeout: 10_000 }).toBe(esperado);
    await page.getByLabel('Prazo, em meses').selectOption('30');
    await expect(page.locator('.jor-frase')).toContainText('mês 11 de 30');
    await page.getByLabel('Prazo, em meses').selectOption('24');

    // Sem marco escrito por ele, não há painel de próximo marco; início e fim do prazo aparecem na lista.
    await expect(page.locator('.jor-proximo')).toHaveCount(0);
    const marcos = page.locator('.jor-marcos .linha-l li');
    await expect(marcos).toHaveCount(2);
    await expect(marcos.first()).toContainText('Fim do prazo');
    await expect(marcos.last()).toContainText('Início do mestrado');

    // Marco novo, daqui a 24 dias.
    const d = new Date();
    d.setDate(d.getDate() + 24);
    const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await page.getByLabel('Novo marco').fill('Qualificação');
    await page.getByLabel('Data do marco').fill(dia);
    await page.getByRole('button', { name: 'Adicionar marco' }).click();
    await expect(page.locator('#toast')).toContainText('Marco salvo');
    await expect(marcos).toHaveCount(3);
    await expect(marcos.nth(1)).toContainText('Qualificação');
    await expect(marcos.nth(1)).toContainText('Em 24 dias');
    const painel = page.locator('.jor-proximo');
    await expect(painel).toContainText('Próximo marco, em 24 dias');
    await expect(painel.locator('h2')).toContainText('Qualificação, ');
    await expect(painel).toContainText('Projeto ainda não enviado para revisão');
    await expect(painel).toContainText('Nenhum capítulo começado');
    await expect(painel).toContainText('Nenhum combinado em aberto com a orientação');
    await expect(page.locator('.regua .marca')).toHaveCount(1);
    await expect.poll(() => noDrive(g, 'dissertacao')[0]?.marcos?.length, { timeout: 10_000 }).toBe(1);

    // Apagar tem desfazer.
    await marcos.nth(1).getByRole('button', { name: 'Apagar o marco Qualificação' }).click();
    await expect(marcos).toHaveCount(2);
    await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(marcos).toHaveCount(3);
    await expect(page.locator('.jor-proximo')).toBeVisible();
    expect(gem.pedidos.length).toBe(pedidos);
  });

  test('sessão marcada na agenda: vira compromisso no Hoje, com desmarcar e desfazer', async ({ page, context }) => {
    const { g } = await entrar(page, context);
    await page.getByRole('button', { name: 'Marcar uma sessão na agenda' }).click();
    const hoje = await page.evaluate(() => { const d = new Date(); const z = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; });
    await page.getByLabel('Dia').fill(hoje);
    await page.getByLabel('Hora').fill('23:50');
    await page.getByRole('button', { name: 'Marcar 25 minutos' }).click();
    await expect(page.locator('#toast')).toContainText('Sessão marcada');
    const marcada = page.locator('.diss-marcadas li');
    await expect(marcada).toHaveCount(1);
    await expect(marcada).toContainText('Hoje');
    await expect(marcada).toContainText('Marcada para 23:50');
    await expect(marcada).toContainText('Aparece no Hoje.');
    // É um evento da agenda do app: dura o tempo do plano (sem passar da meia-noite) e sincroniza.
    const ev = await page.evaluate(() => window.rb.dados.listar('eventos'));
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ disciplinaId: 'dissertacao', tipo: 'estudo', titulo: 'Sessão de escrita', data: hoje, inicio: '23:50', fim: '23:59', sessaoEscrita: true });
    await expect.poll(() => noDrive(g, 'eventos').length, { timeout: 10_000 }).toBe(1);
    await page.goto('/#painel');
    await expect(page.locator('.compromissos')).toContainText('Sessão de escrita');
    await expect(page.locator('.compromissos')).toContainText('23:50');

    await page.goto('/#dissertacao');
    await marcada.getByRole('button', { name: /Desmarcar a sessão/ }).click();
    await expect(marcada).toHaveCount(0);
    await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
    await expect(marcada).toHaveCount(1);
  });

  test('regras: semana começa na segunda; sessão sem tempo e sem texto não vira registro; sessão esquecida é largada', async ({ page, context }) => {
    await entrar(page, context);
    const r = await page.evaluate(async () => {
      const m = await import('/js/sessoes.js');
      const s = window.rb.sessoes;
      const t = await s.novoCapitulo('Introdução');
      s.iniciar(t.id, 25);
      const vazia = await s.encerrar();
      localStorage.setItem('rb.escrita.sessao', JSON.stringify({ textoId: t.id, inicio: Date.now() - 4 * 3600 * 1000, minutos: 25, palavras0: 0 }));
      const esquecida = s.ativa();
      return {
        anda: [m.andamento('2026-03', 24, new Date(2026, 10, 19)), m.andamento('2026-03', 24, new Date(2028, 5, 1)), m.andamento('', 24)],
        segunda: [m.inicioDaSemana(new Date(2026, 10, 19)), m.inicioDaSemana(new Date(2026, 10, 22)), m.inicioDaSemana(new Date(2026, 10, 23))],
        ultimas: m.ultimasPalavras('  uma   frase com mais de oito palavras para cortar no fim  ', 4),
        vazia,
        registros: (await window.rb.dados.listar('sessoes')).length,
        esquecida,
        guardada: localStorage.getItem('rb.escrita.sessao'),
      };
    });
    expect(r.anda[0]).toMatchObject({ de: '2026-03-01', ate: '2028-02-29', mes: 9, comecou: true, acabou: false });
    expect(r.anda[1]).toMatchObject({ mes: 24, acabou: true, fracao: 1 });
    expect(r.anda[2]).toBeNull();
    expect(r.segunda).toEqual(['2026-11-16', '2026-11-16', '2026-11-23']);
    expect(r.ultimas).toBe('para cortar no fim');
    expect(r.vazia.descartada).toBe(true);
    expect(r.registros).toBe(0);
    expect(r.esquecida).toBeNull();
    expect(r.guardada).toBeNull();
  });
});

test.describe('no celular', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'celular', 'Só no celular'));

  test('Visão e sessão de escrita cabem na tela; Mais leva à Visão', async ({ page, context }) => {
    await entrar(page, context);
    const sobra = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.evaluate(async () => {
      const t = await window.rb.sessoes.novoCapitulo('Referencial teórico');
      await window.rb.sessoes.salvarConfig({ tese: 'Rotas negociadas com as cooperativas duram mais do que rotas calculadas pela prefeitura.' });
      window.rb.sessoes.iniciar(t.id, 25);
      location.hash = `#texto/${t.id}`;
    });
    await expect(page.locator('.sessao-barra')).toBeVisible();
    await expect(page.locator('#tabbar')).toBeHidden();
    expect(await sobra()).toBeLessThanOrEqual(0);
    await page.goto('/#dissertacao');
    await expect(page.locator('.diss-sessao')).toContainText('Sessão em curso');
    expect(await sobra()).toBeLessThanOrEqual(0);
    // Jornada e Mapa no celular: sem rolagem lateral; no Mapa fica a lista no lugar da matriz.
    await page.evaluate(async () => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      await window.rb.sessoes.salvarConfig({ inicio: `${new Date().getFullYear()}-01`, marcos: [{ id: 'm1', titulo: 'Qualificação do projeto de dissertação', data: d.toISOString().slice(0, 10) }] });
      await window.rb.dados.salvar('argumentos', { id: 'a1', tese: 'Rotas negociadas duram mais do que rotas calculadas.', tipo: 'tese' });
      await window.rb.argUI.carregar();
    });
    await page.goto('/#jornada');
    await expect(page.locator('.jor-proximo')).toBeVisible();
    expect(await sobra()).toBeLessThanOrEqual(0);
    await page.goto('/#argumentos');
    await expect(page.locator('.mapa-rolagem')).toBeHidden();
    await expect(page.locator('.arg-lista .arg-item')).toBeVisible();
    expect(await sobra()).toBeLessThanOrEqual(0);
    await page.goto('/#mais');
    await expect(page.locator('.mais-lista a', { hasText: 'Dissertação' })).toHaveAttribute('href', '#dissertacao');
  });
});
