// Etapa 10: disciplinas, aulas e agenda local. Cadastro com plano de ensino lido pela IA (conferido antes de salvar),
// gravação transcrita por trechos (inclusive pela área temporária do Gemini e retomando de onde parou),
// resumo conferido na transcrição, grifos na transcrição, agenda com repetição e o menu de Projetos real.
import { test, expect } from '@playwright/test';
import { googleFalso } from './google-falso.js';
import { geminiFalso } from './gemini-falso.js';

test.use({ serviceWorkers: 'block' });

/** WAV de silêncio (8 kHz, 8 bits, mono): o navegador lê a duração de verdade. */
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
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');

async function entrar(page, context, opcoesGemini = {}) {
  const g = await googleFalso(context);
  const gem = await geminiFalso(context, opcoesGemini);
  await page.goto('/#disciplinas', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.evaluate(() => {
    localStorage.setItem('rb.ia.acesso', 'google');
    localStorage.setItem('rb.ia.projeto', 'projeto-teste');
  });
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb?.sincronia?.estado().fase === 'ok' && window.rb.disciplinasUI);
  await page.evaluate(async () => {
    await window.rb.biblioteca.adicionar({ titulo: 'Roteirização colaborativa', autores: [{ sobrenome: 'Moraes', prenomes: 'Tânia' }, { sobrenome: 'Lins', prenomes: 'Rafael' }], ano: 2024, veiculo: 'Revista de Exemplo', projeto: 'Avaliação de Artefatos' });
  });
  return { g, gem };
}

async function disciplinaPronta(page) {
  return page.evaluate(async () => {
    const d = await window.rb.disciplinas.salvar({ nome: 'Avaliação de Artefatos', docente: 'Docente de exemplo', semestre: '2026/2' });
    return d.id;
  });
}

async function enviarGravacao(page, discId, segundos, { transcrever = true } = {}) {
  await page.goto(`/#disciplina/${discId}`);
  await page.getByRole('button', { name: 'Enviar gravação de aula' }).first().click();
  await page.getByLabel('Tema').fill('Avaliação de artefatos');
  await page.getByLabel('Gravação (MP3, M4A, WAV, OGG)').setInputFiles({ name: 'aula.wav', mimeType: 'audio/wav', buffer: wav(segundos) });
  if (!transcrever) await page.getByLabel('Transcrever e resumir com o Gemini').uncheck();
  await page.getByRole('button', { name: 'Enviar e transcrever' }).click();
  await expect(page).toHaveURL(/#aula\//);
  return page.evaluate(() => decodeURIComponent(location.hash.split('/')[2]));
}

test.describe('no computador', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos rodam no computador; o celular tem teste próprio'));

  test('cadastrar disciplina com plano de ensino: a IA lê, o autor confere, e agenda, leituras, trilha e menu ficam prontos', async ({ page, context }) => {
    const { gem, g } = await entrar(page, context);
    await page.goto('/#disciplinas');
    await expect(page.locator('.disc').first()).toContainText('Dissertação');
    await page.getByRole('button', { name: 'Cadastrar a primeira disciplina' }).click();
    await page.getByLabel('Nome').fill('Avaliação de Artefatos');
    await page.getByLabel('Docente').fill('Docente de exemplo');
    await page.getByLabel('Semestre').fill('2026/2');
    await page.getByLabel('Dia da aula').selectOption('qui');
    await page.getByLabel('Início').fill('19:00');
    await page.getByLabel('Fim').fill('21:00');
    await page.getByLabel('Plano de ensino').setInputFiles({ name: 'plano.pdf', mimeType: 'application/pdf', buffer: PDF });
    await page.locator('.modal').getByRole('button', { name: 'Criar disciplina' }).click();

    // Conferência do plano: aula sem data fica desmarcada e bloqueada; nada é salvo antes de confirmar.
    await expect(page.locator('#modal-tit')).toHaveText('Conferir o plano de ensino');
    await expect(page.locator('.pl-it')).toHaveCount(5);
    await expect(page.locator('.pl-it.off')).toContainText('Seminários finais');
    await expect(page.locator('.pl-it').filter({ hasText: 'MORAES' })).toContainText('Já está na sua biblioteca');
    await expect(page.locator('.pl-it').filter({ hasText: 'SONNENBERG' })).toContainText('Fora da biblioteca');
    const p = gem.pedidos.at(-1);
    expect(p.modelo).toBe('gemini-3.8-flash');
    expect(p.corpo.contents.at(-1).parts[0].inlineData.mimeType).toBe('application/pdf');
    expect(p.corpo.systemInstruction.parts[0].text).toContain('plano de ensino');
    expect(p.corpo.systemInstruction.parts[0].text).toContain('(o autor ainda não escreveu o perfil)');
    expect(await page.evaluate(() => window.rb.disciplinas.eventosDe().length)).toBe(1); // só as aulas semanais
    await page.getByRole('button', { name: 'Salvar o que está marcado' }).click();
    await expect(page.locator('#toast')).toContainText('4 itens salvos do plano de ensino');

    // Menu lateral com a disciplina real; cabeçalho com docente e horário.
    await expect(page.locator('#menu')).toContainText('Avaliação de Artefatos');
    await expect(page.locator('#menu')).not.toContainText('Pesquisa Operacional');
    await expect(page.locator('.topo h1')).toContainText('Avaliação de Artefatos');
    await expect(page.locator('.topo p')).toContainText('Docente de exemplo, 2026/2, quinta, 19:00 às 21:00.');
    await expect(page.locator('.topo p')).toContainText('Próxima entrega: Fichamento crítico');

    // Agenda: aulas semanais, a aula do plano e a entrega.
    await page.locator('[data-disc-aba="agenda"]').first().click();
    await expect(page.locator('.ev').filter({ hasText: 'Aula de Avaliação de Artefatos' }).first()).toContainText('toda semana');
    await expect(page.locator('.ev').filter({ hasText: 'Métodos mistos em design' })).toHaveCount(1);
    await expect(page.locator('.ev').filter({ hasText: 'Fichamento crítico' })).toContainText('até 23:59');

    // Leituras: a da biblioteca abre; a de fora fica marcada.
    await page.locator('[data-disc-aba="leituras"]').first().click();
    await expect(page.locator('.lst-leit .lc')).toContainText('Roteirização colaborativa');
    await expect(page.locator('.plano-l li').filter({ hasText: 'MORAES' }).getByRole('link', { name: 'Abrir' })).toBeVisible();
    await expect(page.locator('.plano-l li').filter({ hasText: 'SONNENBERG' })).toContainText('Fora da biblioteca');
    expect(await page.evaluate(() => window.rb.trilhasUI.todas().map((t) => t.nome))).toContain('Leituras de Avaliação de Artefatos');
    const id = await page.evaluate(() => window.rb.disciplinas.ativas()[0].id);
    expect(g.tamanho(`disciplinas/${id}/plano-de-ensino.pdf`)).toBe(PDF.length);

    // Lista de projetos com o cartão da disciplina.
    await page.goto('/#disciplinas');
    const card = page.locator('.disc').filter({ hasText: 'Avaliação de Artefatos' });
    await expect(card).toContainText('0 de 1 leitura concluída');
    await expect(card.locator('.entrega')).toContainText('Fichamento crítico');
  });

  test('agenda: agendar, repetir, editar e apagar com desfazer; o que é hoje aparece no Hoje', async ({ page, context }) => {
    await entrar(page, context);
    const id = await disciplinaPronta(page);
    await page.goto(`/#disciplina/${id}`);
    await page.getByRole('button', { name: 'Agendar' }).first().click();
    await page.getByLabel('Título').fill('Ler Moraes e Lins');
    await page.getByLabel('Tipo').selectOption('estudo');
    await page.locator('.modal').getByRole('button', { name: 'Agendar', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Evento agendado');
    await expect(page.locator('.ev')).toContainText('Ler Moraes e Lins');

    await page.goto('/#painel');
    await expect(page.locator('.tambem')).toContainText('Sessão de estudo: Ler Moraes e Lins');
    await expect(page.locator('.tambem')).toContainText('Hoje. Avaliação de Artefatos');

    await page.goto(`/#disciplina/${id}`);
    await page.locator('.ev').getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Repetir', { exact: true }).selectOption('semanal');
    await page.locator('.modal').getByRole('button', { name: 'Salvar' }).click();
    await page.locator('[data-disc-aba="agenda"]').first().click();
    expect(await page.locator('.ev').count()).toBeGreaterThan(10);
    await page.locator('.ev').first().getByRole('button', { name: 'Editar' }).click();
    await page.getByRole('button', { name: 'Apagar evento' }).click();
    await expect(page.locator('.ev')).toHaveCount(0);
    await page.locator('#toast button', { hasText: 'Desfazer' }).click();
    await expect.poll(() => page.locator('.ev').count()).toBeGreaterThan(10);
  });

  test('gravação curta: transcrição, resumo conferido, leituras citadas, combinado, grifo e áudio que pula para a fala', async ({ page, context }) => {
    const { g, gem } = await entrar(page, context);
    const id = await disciplinaPronta(page);
    const aulaId = await enviarGravacao(page, id, 120);
    await expect(page.locator('.subnav a', { hasText: 'Transcrição' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.transcr-real p')).toHaveCount(3);
    await expect(page.locator('.transcr-real p').nth(1)).toContainText('Participante 1');
    await expect(page.locator('.topo .st-a')).toHaveText('Transcrita');

    // O áudio foi junto do pedido (arquivo pequeno), com o trecho pedido.
    const t = gem.pedidos.find((x) => x.corpo.generationConfig.responseJsonSchema.properties.segmentos);
    expect(t.corpo.contents.at(-1).parts[0].inlineData.mimeType).toBe('audio/wav');
    expect(t.corpo.contents.at(-1).parts[1].text).toContain('inicio: 00:00\nfim: 02:00');
    expect(gem.arquivos).toHaveLength(0);

    // Drive: áudio, transcrição em JSON e legível.
    await expect.poll(() => g.tamanho(`disciplinas/${id}/aulas/${aulaId}/audio.wav`)).toBe(44 + 8000 * 120);
    expect(JSON.parse(g.ler(`disciplinas/${id}/aulas/${aulaId}/transcricao.json`)).segmentos).toHaveLength(3);
    expect(g.ler(`disciplinas/${id}/aulas/${aulaId}/transcricao.txt`)).toContain('[01:05] Participante 1: E quando a equipe');

    // Resumo: o ponto com trecho inventado foi descartado.
    await page.locator('.subnav a', { hasText: 'Resumo' }).click();
    await expect(page.locator('.resumo-aula').first().locator('li')).toHaveCount(2);
    await expect(page.locator('.editor')).toContainText('1 ponto foi descartado porque o trecho não estava na transcrição');
    await expect(page.locator('.conceitos-aula dt')).toContainText('Adesão');
    // Leituras citadas: a da biblioteca vira link; a de fora vai para a lista "para buscar".
    await expect(page.locator('.lado .lc').filter({ hasText: 'Moraes; Lins, 2024' })).toHaveAttribute('href', /#leitor\//);
    await page.getByRole('button', { name: 'Marcar para buscar' }).click();
    await expect(page.locator('#toast')).toContainText('Na lista para buscar');
    expect(await page.evaluate((id) => window.rb.disciplinas.obter(id).paraBuscar.map((p) => p.texto), id)).toEqual(['Sonnenberg e vom Brocke']);
    // Combinado com prazo vira entrega na agenda.
    await page.getByRole('button', { name: 'Agendar entrega' }).click();
    await expect(page.getByLabel('Título')).toHaveValue('Entregar o fichamento crítico');
    await page.locator('.modal').getByRole('button', { name: 'Agendar', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.rb.disciplinas.eventosDe().filter((e) => e.tipo === 'entrega').length)).toBe(1);
    // Tudo o que a IA produziu fica no histórico.
    expect(await page.evaluate(() => window.rb.historico.todas().filter((c) => c.funcao === 'aula').length)).toBe(1);

    // Grifar um trecho da transcrição.
    await page.locator('.subnav a', { hasText: 'Transcrição' }).click();
    await expect(page.locator('.transcr-real p')).toHaveCount(3);
    await page.evaluate(() => {
      const span = document.querySelectorAll('.transcr-real .seg-t')[2];
      const no = span.firstChild;
      const i = no.textContent.indexOf('a adesão');
      const r = document.createRange();
      r.setStart(no, i);
      r.setEnd(no, i + 'a adesão das equipes'.length);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
    });
    await page.locator('.transcr-real .seg-t').nth(2).dispatchEvent('mouseup');
    await page.locator('.pop-aula.on').getByRole('button', { name: 'Conceito' }).click();
    await expect(page.locator('.transcr-real mark.conceito')).toHaveText('a adesão das equipes');
    await expect(page.locator('.grifos-aula')).toContainText('a adesão das equipes');
    await page.locator('.transcr-real mark.conceito').click();
    await expect(page.locator('.transcr-real mark')).toHaveCount(0);
    await page.locator('#toast button', { hasText: 'Desfazer' }).click();
    await expect(page.locator('.transcr-real mark.conceito')).toHaveCount(1);

    // O tempo da fala leva o áudio ao ponto.
    await expect.poll(() => page.evaluate(() => !!document.querySelector('[data-aula-audio] audio').src)).toBe(true);
    await page.locator('.transcr-real .ts').nth(1).click();
    expect(await page.evaluate(() => Math.round(document.querySelector('[data-aula-audio] audio').currentTime))).toBe(65);

    // Anotações da aula salvam sozinhas.
    await page.locator('.subnav a', { hasText: 'Suas anotações' }).click();
    await page.getByLabel('Suas anotações da aula').fill('Trazer o critério de avaliação na próxima aula.');
    await expect(page.locator('#dsc-notas-st')).toHaveText('Salvo');
    expect(await page.evaluate((a) => window.rb.disciplinas.aula(a).notas, aulaId)).toBe('Trazer o critério de avaliação na próxima aula.');
  });

  test('gravação longa: vai para a área temporária do Gemini, é transcrita em partes e retoma de onde parou depois de um erro', async ({ page, context }) => {
    const { gem } = await entrar(page, context, { falharParte: 2 });
    const id = await disciplinaPronta(page);
    await enviarGravacao(page, id, 31 * 60);
    await expect(page.locator('.erro-ia')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.editor')).toContainText('1 de 3 partes já estão prontas');
    expect(gem.arquivos).toHaveLength(1);
    expect(gem.arquivos[0].recebido).toBe(44 + 8000 * 31 * 60);
    expect(gem.arquivos[0].cabecalhos.authorization).toMatch(/^Bearer /);

    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.locator('.subnav a', { hasText: 'Transcrição' })).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.transcr-real p')).toHaveCount(9);
    const partes = gem.pedidos.filter((x) => x.corpo.generationConfig.responseJsonSchema.properties.segmentos).map((x) => x.corpo.contents.at(-1).parts.find((p) => p.text).text.match(/Parte (\d) de 3/)[1]);
    expect(partes).toEqual(['1', '2', '2', '3']);
    expect(gem.arquivos).toHaveLength(1); // o mesmo arquivo serve para as partes seguintes
    const pedido = gem.pedidos.find((x) => x.corpo.generationConfig.responseJsonSchema.properties.segmentos);
    expect(pedido.corpo.contents.at(-1).parts[0].fileData.fileUri).toContain('/v1beta/files/arq1');
    await expect(page.locator('.transcr-real .ts').nth(3)).toHaveText('15:05');
  });

  test('editar, arquivar e apagar a disciplina (com desfazer, aulas incluídas); aula sem gravação', async ({ page, context }) => {
    await entrar(page, context);
    const id = await disciplinaPronta(page);
    await page.goto(`/#disciplina/${id}`);
    await page.locator('[data-disc-aba="aulas"]').first().click();
    await page.getByRole('button', { name: 'Registrar aula sem gravação' }).click();
    await page.getByLabel('Tema').fill('Estratégias qualitativas');
    await page.locator('.modal').getByRole('button', { name: 'Registrar aula' }).click();
    await expect(page.locator('.topo h1')).toHaveText('Aula 1: Estratégias qualitativas');
    await expect(page.getByText('Escolher a gravação')).toBeVisible();

    // Renomear leva junto a obra marcada com o nome antigo.
    await page.goto(`/#disciplina/${id}`);
    await page.getByRole('button', { name: 'Editar' }).first().click();
    await page.getByLabel('Nome').fill('Avaliação em Design');
    await page.locator('.modal').getByRole('button', { name: 'Salvar' }).click();
    await expect(page.locator('#menu')).toContainText('Avaliação em Design');
    expect(await page.evaluate(() => window.rb.biblioteca.leituras()[0].projeto)).toBe('Avaliação em Design');

    // Anotação rápida, com apagar e desfazer.
    await page.getByLabel('Nova anotação').fill('Perguntar sobre o seminário.');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.locator('.notas-d')).toContainText('Perguntar sobre o seminário.');

    // Arquivar tira do menu e leva para Arquivadas.
    await page.getByRole('button', { name: 'Editar' }).first().click();
    await page.getByRole('button', { name: 'Arquivar' }).click();
    await expect(page.locator('#menu')).not.toContainText('Avaliação em Design');
    await page.goto('/#disciplinas');
    await expect(page.locator('.arq-disc summary')).toHaveText('Arquivadas (1)');

    // Apagar leva as aulas; desfazer traz tudo de volta.
    await page.goto(`/#disciplina/${id}`);
    await page.getByRole('button', { name: 'Editar' }).first().click();
    await page.getByRole('button', { name: 'Apagar disciplina' }).click();
    await expect(page).toHaveURL(/#disciplinas$/);
    expect(await page.evaluate(() => window.rb.disciplinas.aulasDe(window.rb.disciplinas.todas()[0]?.id).length)).toBe(0);
    await page.locator('#toast button', { hasText: 'Desfazer' }).click();
    await expect(page).toHaveURL(new RegExp(`#disciplina/${id}$`));
    expect(await page.evaluate((id) => window.rb.disciplinas.aulasDe(id).length, id)).toBe(1);
  });

  test('erro de configuração do Gemini ao ler o plano leva aos Ajustes; a disciplina fica salva', async ({ page, context }) => {
    await entrar(page, context, { cenario: 'api-desligada' });
    await page.goto('/#disciplinas');
    await page.getByRole('button', { name: 'Nova disciplina' }).first().click();
    await page.getByLabel('Nome').fill('Teoria das Organizações');
    await page.getByLabel('Plano de ensino').setInputFiles({ name: 'plano.pdf', mimeType: 'application/pdf', buffer: PDF });
    await page.locator('.modal').getByRole('button', { name: 'Criar disciplina' }).click();
    await expect(page.locator('#modal-tit')).toHaveText('Não deu para ler o plano');
    await expect(page.locator('.modal a[href="#ajustes"]')).toBeVisible();
    expect(await page.evaluate(() => window.rb.disciplinas.ativas().map((d) => d.nome))).toEqual(['Teoria das Organizações']);
  });

  test('regras puras: repetição semanal, emenda dos trechos, relógio e obra pela referência', async ({ page, context }) => {
    await entrar(page, context);
    const r = await page.evaluate(async () => {
      const m = await import('/js/disciplinas.js');
      const occ = m.ocorrencias([{ id: 'a', data: '2026-11-05', repetir: 'semanal', ate: '2026-11-26', excecoes: ['2026-11-19'] }, { id: 'b', data: '2026-11-10' }, { id: 'c', data: '2026-10-01' }], '2026-11-06', '2026-12-31').map((e) => `${e.id}${e.dia}`);
      const em = m.emendar([{ inicio: '14:58', falante: 'Docente', texto: 'Fala da emenda.' }], [{ inicio: '14:58', falante: 'Docente', texto: 'Fala da emenda.' }, { inicio: '15:10', falante: 'Docente', texto: 'Nova fala.' }, { inicio: '1:05:03', falante: 'Docente', texto: 'Depois da hora.' }], 900);
      return {
        occ,
        em: em.map((s) => s.inicio),
        relogio: [m.relogio(65), m.relogio(3903), m.segundos('1:05:03'), m.segundos('15:05')],
        obra: m.obraPorReferencia([{ id: 'x', ano: 2024, autores: [{ sobrenome: 'Moraes' }] }], { referencia: 'MORAES, T.; LINS, R. Roteirização. 2024.' })?.id,
        semAno: m.obraPorReferencia([{ id: 'x', ano: 2024, autores: [{ sobrenome: 'Moraes' }] }], { sobrenome: 'Moraes' }),
      };
    });
    expect(r.occ).toEqual(['b2026-11-10', 'a2026-11-12', 'a2026-11-26']);
    expect(r.em).toEqual(['14:58', '15:10', '1:05:03']);
    expect(r.relogio).toEqual(['01:05', '1:05:03', 3903, 905]);
    expect(r.obra).toBe('x');
    expect(r.semAno).toBeNull();
  });
});

test.describe('no celular', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'celular', 'Só no celular'));

  test('projetos, disciplina, agenda e aula cabem na tela', async ({ page, context }) => {
    await entrar(page, context);
    const id = await disciplinaPronta(page);
    const sobra = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.goto('/#disciplinas');
    await expect(page.locator('.disc')).toHaveCount(2);
    expect(await sobra()).toBeLessThanOrEqual(0);
    await page.goto(`/#disciplina/${id}`);
    await expect(page.locator('.topo h1')).toContainText('Avaliação de Artefatos');
    expect(await sobra()).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Agendar' }).first().click();
    await expect(page.getByLabel('Título')).toBeVisible();
    expect(await sobra()).toBeLessThanOrEqual(0);
    await page.locator('.modal').getByRole('button', { name: 'Cancelar' }).click();
    await enviarGravacao(page, id, 60);
    await expect(page.locator('.transcr-real p')).toHaveCount(3, { timeout: 15000 });
    expect(await sobra()).toBeLessThanOrEqual(0);
    await expect(page.locator('#tabbar a.ativo')).toHaveText(/Projetos/);
  });
});
