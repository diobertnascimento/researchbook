// Etapa 9: Escrita e Copilot. Preparação (enquadrar, ideia, diagnóstico, estrutura), editor com autoria medida,
// versões do Copilot conferidas contra o acervo, teto de IA, versões no Drive, revisão e exportação para o Word.
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { googleFalso } from './google-falso.js';
import { geminiFalso } from './gemini-falso.js';

test.use({ serviceWorkers: 'block' });

const GRIFO = 'A adesão das equipes de coleta às rotas negociadas reduziu os conflitos na cooperativa.';

async function entrar(page, context, opcoesGemini = {}) {
  const g = await googleFalso(context);
  const gem = await geminiFalso(context, opcoesGemini);
  await page.goto('/#escrita', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.evaluate(() => { localStorage.setItem('rb.ia.acesso', 'google'); localStorage.setItem('rb.ia.projeto', 'projeto-teste'); });
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb && window.rb.sincronia && window.rb.sincronia.estado().fase === 'ok' && window.rb.escritaUI);
  await page.evaluate(async (texto) => {
    const b = window.rb.biblioteca;
    const id = await b.adicionar({ titulo: 'Roteirização colaborativa', autores: [{ sobrenome: 'Moraes', prenomes: 'Tânia' }, { sobrenome: 'Lins', prenomes: 'Rafael' }], ano: 2024, veiculo: 'Revista de Exemplo' });
    await b.grifar({ leituraId: id, pagina: 4, texto, rects: [[0, 0, 1, 1]], funcao: 'evidencia' });
  }, GRIFO);
  return { g, gem };
}

/** Texto pronto para o editor, sem passar pela preparação. */
async function textoPronto(page, { teto = 60, html } = {}) {
  const id = await page.evaluate(
    async ({ teto, html }) => {
      const e = window.rb.escrita;
      const t = await e.novo();
      await e.salvar({ ...t, titulo: 'Rotas e cooperativas', limite: 1500, teto, tese: 'A adesão das equipes vale mais que a quilometragem.', passo: 4, secoes: [{ id: 's1', titulo: 'Introdução', objetivo: 'Apresentar a tese.', html: html ?? '<p data-pid="p1" data-autoria="autor">As cooperativas negociam as rotas com as equipes de coleta.</p>' }, { id: 's2', titulo: 'Conclusão', objetivo: '', html: '' }] });
      return t.id;
    },
    { teto, html },
  );
  await page.goto(`/#texto/${id}`);
  await expect(page.locator('#esc-corpo')).toBeVisible();
  return id;
}

test.describe('no computador', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos rodam no computador; o celular tem teste próprio'));

  test('preparação: enquadrar, a tese nas palavras do autor, entrevista, diagnóstico e estrutura aprovada', async ({ page, context }) => {
    const { gem } = await entrar(page, context);
    await page.goto('/#escrita');
    await expect(page.locator('.bib-vazia')).toContainText('Nenhum texto ainda');
    await page.getByRole('button', { name: 'Começar um texto' }).click();
    await expect(page.locator('.esc-cab h1')).toHaveText('Texto sem título');

    // Enquadrar: os campos salvam sozinhos.
    await page.getByLabel('Título de trabalho').fill('Rotas negociadas em cooperativas');
    await page.getByLabel('Enunciado da atividade').fill('Artigo de até 2.000 palavras sobre um caso de coleta seletiva.');
    await page.getByLabel('Limite').fill('2000');
    await expect.poll(() => page.evaluate(() => window.rb.escrita.todos()[0].limite)).toBe(2000);
    await page.getByRole('button', { name: 'Próximo: Ideia' }).click();

    // Ideia: a primeira resposta vira a tese, sem edição; o Copilot faz a pergunta seguinte.
    await expect(page.locator('.qa.pendente .q')).toHaveText('O que você quer defender, em uma frase?');
    await page.getByLabel('Sua resposta').fill('A adesão das equipes vale mais que a quilometragem.');
    await page.getByRole('button', { name: 'Responder' }).click();
    await expect(page.locator('.tese-box p')).toHaveText('A adesão das equipes vale mais que a quilometragem.');
    await expect(page.locator('.qa.pendente .q')).toContainText('Que caso concreto mostra isso na prática?');
    const p1 = gem.pedidos.at(-1);
    expect(p1.modelo).toBe('gemini-3.8-flash');
    expect(p1.corpo.systemInstruction.parts[0].text).toContain('Você é o Copilot de escrita acadêmica');
    const msg = p1.corpo.contents.at(-1).parts[0].text;
    const cod = msg.match(/Código deste pedido: ([0-9a-f]{8})\./)[1];
    expect(msg).toContain(`<briefing>\n<material-${cod}>\nTítulo: Rotas negociadas em cooperativas`);
    expect(msg).toContain('Tese de trabalho (palavras do autor): A adesão das equipes vale mais que a quilometragem.');
    expect(msg).toContain('Tarefa: entrevista.');
    await page.getByLabel('Sua resposta').fill('A cooperativa do bairro passou a negociar as rotas com as equipes.');
    await page.getByRole('button', { name: 'Responder' }).click();
    await expect(page.locator('.qa:not(.pendente) .r')).toHaveCount(2);

    // Diagnóstico: modelo de planejamento, fontes conferidas no acervo.
    await page.getByRole('button', { name: 'Próximo: Diagnóstico' }).click();
    await page.getByRole('button', { name: 'Fazer o diagnóstico' }).click();
    await expect(page.locator('.diag').nth(0).locator('.diag-item')).toContainText('A adesão das equipes define o sucesso das rotas.');
    await expect(page.locator('.diag').nth(0).locator('.chip')).toHaveText('(Moraes; Lins, 2024, p. 4)');
    await expect(page.locator('.diag').nth(2).locator('.diag-item')).toContainText('Cooperativas pequenas');
    const p2 = gem.pedidos.at(-1);
    expect(p2.modelo).toBe('gemini-4-argon');
    expect(p2.corpo.contents.at(-1).parts[0].text).toContain(GRIFO);

    // Estrutura: proposta, edição e aprovação.
    await page.getByRole('button', { name: 'Próximo: Estrutura' }).click();
    await page.getByRole('button', { name: 'Propor estrutura' }).click();
    await expect(page.locator('.estr-ed li')).toHaveCount(3);
    await page.getByLabel('Título da seção 2').fill('Como as rotas são negociadas');
    await page.locator('[data-esc-tirar="2"]').click();
    await expect(page.locator('.estr-ed li')).toHaveCount(2);
    await page.getByRole('button', { name: 'Aprovar estrutura e começar a escrever' }).click();
    await expect(page.locator('.secoes button')).toHaveText(['Introdução', 'Como as rotas são negociadas']);
    await expect(page.locator('#esc-corpo')).toBeVisible();

    // A conversa com o Copilot fica guardada no histórico do texto.
    const h = await page.evaluate(() => window.rb.historico.todas().filter((c) => c.funcao === 'copilot').length);
    expect(h).toBe(1);
  });

  test('editor: autoria medida, versões do Copilot, citação do acervo, teto de IA e versões no Drive', async ({ page, context }) => {
    const { g, gem } = await entrar(page, context);
    const id = await textoPronto(page, { teto: 30 });
    await expect(page.locator('#esc-palavras')).toHaveText('10 de ~1500 palavras');
    await expect(page.locator('#esc-aut')).toContainText('IA 0%');

    // Digitar salva sozinho e conta como texto do autor.
    await page.locator('#esc-corpo p').first().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Isso muda o resultado.');
    await expect(page.locator('#esc-palavras')).toHaveText('14 de ~1500 palavras');
    await expect.poll(() => page.evaluate((id) => window.rb.escrita.obter(id).autoria.autor, id)).toBe(14);

    // Propor versões do parágrafo onde está o cursor; usar uma vira coautoria.
    await page.locator('#esc-corpo p').first().click();
    await page.getByRole('button', { name: 'Propor versões do parágrafo' }).click();
    await expect(page.locator('.versao-op')).toHaveCount(2);
    await expect(page.locator('.versoes-box .alerta')).toContainText('não tem fonte no seu acervo');
    const pv = gem.pedidos.at(-1);
    expect(pv.modelo).toBe('gemini-4-argon');
    expect(pv.corpo.contents.at(-1).parts[0].text).toContain('As cooperativas negociam as rotas com as equipes de coleta. Isso muda o resultado.');
    await page.locator('[data-esc-usar="1"]').first().click();
    await expect(page.locator('#toast')).toContainText('O parágrafo conta como coautoria');
    await expect(page.locator('#esc-corpo p').first()).toHaveAttribute('data-autoria', 'coautoria');
    await expect(page.locator('#esc-corpo p').first()).not.toContainText('[A1]');
    await expect(page.locator('#esc-aut')).toContainText('IA 100%');

    // Acima do teto: o Copilot não propõe versões.
    await expect(page.locator('.conf-ia')).toContainText('chegou ao teto de IA deste texto (30%)');
    await expect(page.getByRole('button', { name: 'Propor versões do parágrafo' })).toBeDisabled();

    // Reescrever com as próprias palavras devolve a autoria ao autor.
    await page.locator('#esc-corpo p').first().click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Eu vejo que as equipes de coleta definem as rotas junto com a cooperativa, e por isso aderem.');
    await expect(page.locator('#esc-aut')).toContainText('IA 0%');

    // Material da seção: inserir a citação do grifo.
    await page.getByRole('tab', { name: 'Material' }).click();
    await expect(page.locator('.grifo-item')).toContainText('A adesão das equipes de coleta');
    await page.locator('#esc-corpo p').first().click();
    await page.keyboard.press('End');
    await page.locator('.grifo-item').first().click();
    await expect(page.locator('#esc-corpo .cit')).toHaveText('(Moraes; Lins, 2024, p. 4)');

    // Versões no Drive: guardar e restaurar.
    await page.getByRole('tab', { name: 'Versões' }).click();
    await page.getByRole('button', { name: 'Guardar versão agora' }).click();
    await expect(page.locator('#toast')).toContainText('Versão guardada no seu Drive');
    expect(g.caminhos().some((c) => c.startsWith(`escrita/${id}/versoes/`))).toBe(true);
    await page.locator('#esc-corpo p').first().click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Texto trocado.');
    await page.getByRole('tab', { name: 'Versões' }).click();
    await page.getByRole('button', { name: 'Restaurar' }).first().click();
    await expect(page.locator('#toast')).toContainText('Versão restaurada');
    await expect(page.locator('#esc-corpo')).toContainText('Eu vejo que as equipes de coleta');

    // A cópia legível vai para o Drive (escrita/<id>/texto.html).
    await page.evaluate((id) => window.rb.escrita.gravarLegivel(id), id);
    expect(g.ler(`escrita/${id}/texto.html`)).toContain('<h2>Introdução</h2>');
    expect(JSON.parse(g.ler(`escrita/${id}/autoria.json`)).teto).toBe(30);
  });

  test('conversa, transição e "isso soa como eu?"; recusa do Copilot aparece como recusa', async ({ page, context }) => {
    const { gem } = await entrar(page, context);
    await textoPronto(page);
    await page.getByLabel('Mensagem ao Copilot').fill('O que falta nesta seção?');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.locator('.esc-painel .msg.eu')).toHaveText('O que falta nesta seção?');
    await expect(page.locator('.esc-painel .msg.tutor')).toContainText('A seção pode se apoiar no caso das cooperativas');
    await expect(page.locator('.esc-painel .msg.tutor .chip')).toHaveText('(Moraes; Lins, 2024, p. 4)');
    await expect(page.locator('.esc-painel .pergunta-tutor')).toHaveText('O que esta seção precisa provar para a sua tese funcionar?');
    expect(gem.pedidos.at(-1).corpo.contents.at(-1).parts[0].text).toContain('O autor disse: O que falta nesta seção?');

    await page.locator('#esc-corpo p').first().click();
    await page.getByRole('button', { name: 'Isso soa como eu?' }).click();
    await expect(page.locator('.versoes-box h4')).toHaveText('Soa como você em parte');
    await page.getByRole('button', { name: 'Fechar' }).click();

    await page.getByRole('button', { name: 'Transição para a próxima seção' }).click();
    await page.getByRole('button', { name: 'Usar no fim da seção' }).click();
    await expect(page.locator('#esc-corpo p[data-autoria="ia"]')).toHaveText('A próxima seção examina como as equipes participam da definição das rotas.');
  });

  test('revisar e exportar: checagens do app, revisão do Copilot, referências ABNT e o .docx', async ({ page, context }) => {
    const { g } = await entrar(page, context);
    const id = await textoPronto(page, {
      html: '<p data-pid="p1" data-autoria="autor">As equipes aderem às rotas negociadas <span class="cit" data-obra="X" data-pag="4">(Moraes; Lins, 2024, p. 4)</span>. Como dizem os autores, "a adesão das equipes de coleta às rotas negociadas reduziu os conflitos".</p><p data-pid="p2" data-autoria="autor">Uma citação inventada: "isto não está em grifo nenhum do acervo".</p>',
    });
    await page.getByRole('button', { name: 'Revisar e exportar' }).click();
    const its = page.locator('.revs').first().locator('.rev-it');
    await expect(its.filter({ hasText: 'Participação da IA' })).toContainText('0%, dentro do teto de 60%');
    await expect(its.filter({ hasText: 'Citações diretas' })).toContainText('1 entre aspas não estão nos seus grifos');
    await expect(its.filter({ hasText: 'Referências' })).toContainText('1 obra citada');
    await expect(its.filter({ hasText: 'Seções' })).toContainText('1 seção vazia: Conclusão');
    await expect(page.locator('.refs-abnt li')).toContainText('MORAES, T.; LINS, R.');

    await page.getByRole('button', { name: 'Pedir revisão do Copilot' }).click();
    await expect(page.locator('.revs').nth(1)).toContainText('Uma afirmação da introdução não tem fonte.');

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar para Word (.docx)' }).click()]);
    expect(download.suggestedFilename()).toBe('rotas-e-cooperativas.docx');
    const zip = await readFile(await download.path());
    expect(zip.subarray(0, 2).toString()).toBe('PK');
    const xml = zip.toString('utf8');
    expect(xml).toContain('word/document.xml');
    expect(xml).toContain('ROTAS E COOPERATIVAS');
    expect(xml).toContain('1 INTRODUÇÃO');
    expect(xml).toContain('As equipes aderem às rotas negociadas');
    expect(xml).toContain('REFERÊNCIAS');
    expect(xml).toContain('Times New Roman');
    expect(xml).not.toContain('data-autoria');
    await expect(page.locator('#toast')).toContainText('Cópia no seu Drive');
    expect(g.tamanho(`escrita/${id}/rotas-e-cooperativas.docx`)).toBeGreaterThan(1000);
    const regs = await page.evaluate(() => window.rb.registros.lista().filter((r) => r.ev === 'texto.exportar_docx').map((r) => r.det));
    expect(regs.at(-1)).toMatch(/palavras, 1 referências, cópia no Drive/);
  });

  test('acima do teto a exportação espera; erro do Gemini leva aos Ajustes; apagar tem desfazer', async ({ page, context }) => {
    await entrar(page, context, { cenario: 'api-desligada' });
    const id = await textoPronto(page, { teto: 20, html: '<p data-pid="p1" data-autoria="ia" data-ia="Frase toda da IA sobre as rotas.">Frase toda da IA sobre as rotas.</p>' });
    await page.getByRole('button', { name: 'Revisar e exportar' }).click();
    await expect(page.getByRole('button', { name: 'Exportar para Word (.docx)' })).toBeDisabled();
    await expect(page.locator('.rev-it').filter({ hasText: 'Participação da IA' })).toContainText('100%, acima do teto de 20%');
    await page.getByRole('button', { name: 'Pedir revisão do Copilot' }).click();
    await expect(page.locator('.erro-ia')).toBeVisible();
    await expect(page.locator('.erro-ia a')).toHaveAttribute('href', '#ajustes');

    await page.locator('[data-esc-passo="4"]').click();
    await page.getByRole('button', { name: 'Briefing' }).click();
    await page.getByRole('button', { name: 'Apagar texto' }).click();
    await expect(page).toHaveURL(/#escrita$/);
    await expect(page.locator('.txt-card')).toHaveCount(0);
    await page.locator('#toast button', { hasText: 'Desfazer' }).click();
    await expect(page).toHaveURL(new RegExp(`#texto/${id}$`));
  });

  test('o limpador do editor só deixa a formatação do texto; autoria volta ao autor quando ele reescreve', async ({ page, context }) => {
    await entrar(page, context);
    const r = await page.evaluate(async () => {
      const m = await import('/js/escrita.js');
      const sujo = '<div onclick="x()">Oi <script>alert(1)</script><b>negrito</b> <a href="http://x">link</a><img src=x onerror=y></div><p data-autoria="ia" data-ia="abc" style="color:red">texto</p>';
      const limpo = m.limpar(sujo);
      const ia = 'A coordenação das rotas depende da adesão das equipes de coleta seletiva.';
      const t = (html) => ({ secoes: [{ html }] });
      return {
        limpo,
        quaseIgual: m.medirAutoria(t(`<p data-autoria="coautoria" data-ia="${ia}">${ia.replace('seletiva', 'seletiva no bairro')}</p>`)).participacao,
        reescrito: m.medirAutoria(t(`<p data-autoria="coautoria" data-ia="${ia}">Eu acho que quem decide as rotas são as próprias equipes, e por isso elas aderem.</p>`)).participacao,
      };
    });
    expect(r.limpo).not.toMatch(/script|onclick|onerror|<img|<a |style=/);
    expect(r.limpo).toContain('<b>negrito</b>');
    expect(r.limpo).toContain('data-autoria="ia"');
    expect(r.quaseIgual).toBe(100);
    expect(r.reescrito).toBe(0);
  });
});

test.describe('no celular', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'celular', 'Só no celular'));

  test('lista, preparação e editor cabem na tela, com as seções à mão', async ({ page, context }) => {
    await entrar(page, context);
    await textoPronto(page);
    await expect(page.locator('.secoes button')).toHaveCount(2);
    await expect(page.locator('.secoes button').first()).toBeVisible();
    const sobra = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await sobra()).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Briefing' }).click();
    await expect(page.getByLabel('Título de trabalho')).toBeVisible();
    expect(await sobra()).toBeLessThanOrEqual(0);
    await page.goto('/#escrita');
    await expect(page.locator('.txt-card')).toHaveCount(1);
    expect(await sobra()).toBeLessThanOrEqual(0);
  });
});

test('sair do editor logo depois de digitar não perde o texto', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'computador', 'Só no computador');
  await entrar(page, context);
  const id = await textoPronto(page);
  await page.locator('#esc-corpo p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Última frase.');
  await page.goto('/#escrita');
  await expect.poll(() => page.evaluate((id) => window.rb.escrita.obter(id).secoes[0].html, id)).toContain('Última frase.');
});
