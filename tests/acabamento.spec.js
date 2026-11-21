// Etapa 14: código fora do HTML (CSP sem 'unsafe-inline'), busca real, modelos por tarefa, uso e custo,
// marca-textos e limpeza das marcas de apagado antigas.
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { googleFalso } from './google-falso.js';
import { geminiFalso } from './gemini-falso.js';

test.use({ serviceWorkers: 'block' });
test.beforeEach(({}, info) => test.skip(info.project.name !== 'computador', 'Fluxos de dados; o celular é conferido nas outras etapas'));

async function entrar(page, context) {
  const g = await googleFalso(context);
  const gem = await geminiFalso(context);
  const violacoes = [];
  page.on('console', (m) => /Content Security Policy|Refused to/.test(m.text()) && violacoes.push(m.text()));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`Refused to: CSP ${e.violatedDirective} ${e.blockedURI}`)));
  await page.goto('/#painel', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rb && window.rb.pronto);
  await page.evaluate(() => {
    localStorage.setItem('rb.ia.acesso', 'google');
    localStorage.setItem('rb.ia.projeto', 'projeto-teste');
  });
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await page.waitForFunction(() => window.rb?.sincronia?.estado().fase === 'ok' && window.rb.busca);
  return { g, gem, violacoes };
}

test('o HTML não tem código: a política de segurança não aceita script inline e nenhuma tela é bloqueada', async ({ page, context }) => {
  const html = readFileSync('public/index.html', 'utf8');
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  expect(csp).toMatch(/script-src 'self' 'wasm-unsafe-eval';/);
  expect(csp).not.toMatch(/unsafe-inline'[^;]*;\s*style-src/);
  expect(html).not.toMatch(/<script>(?!\s*<\/script>)/);
  expect(html).not.toMatch(/\son(click|submit|input|change|load)=/);
  const { violacoes } = await entrar(page, context);
  for (const r of ['#biblioteca', '#escrita', '#dialogos', '#disciplinas', '#projeto', '#orientacao', '#cartoes', '#autor', '#memoria', '#ajustes', '#painel']) {
    await page.goto(`/${r}`);
    await page.waitForTimeout(150);
  }
  await page.keyboard.press('Control+k');
  await expect(page.locator('#qk')).toBeVisible();
  expect(violacoes).toEqual([]);
});

test('busca (Ctrl+K) encontra obras, textos, grifos, disciplinas e páginas, com todas as palavras', async ({ page, context }) => {
  await entrar(page, context);
  await page.evaluate(async () => {
    const b = window.rb.biblioteca;
    const id = await b.adicionar({ titulo: 'Roteirização colaborativa', autores: [{ sobrenome: 'Moraes', prenomes: 'Tânia' }], ano: 2024, veiculo: 'Revista de Exemplo' });
    await b.grifar({ leituraId: id, pagina: 4, texto: 'A adesão das equipes de coleta reduziu os conflitos na cooperativa.', rects: [[0, 0, 1, 1]], funcao: 'evidencia' });
    const t = await window.rb.escrita.novo();
    await window.rb.escrita.salvar({ ...t, titulo: 'Rotas negociadas em cooperativas' });
    await window.rb.disciplinas.salvar({ nome: 'Avaliação de Artefatos' });
  });
  await page.keyboard.press('Control+k');
  await page.locator('#qk').fill('moraes');
  await expect(page.locator('#res-busca a').first()).toContainText('Roteirização colaborativa');
  await page.locator('#qk').fill('rotas cooperativas');
  await expect(page.locator('#res-busca a')).toHaveCount(1);
  await expect(page.locator('#res-busca a')).toContainText('Rotas negociadas em cooperativas');
  await page.locator('#qk').fill('conflitos cooperativa');
  await expect(page.locator('#res-busca a').first()).toContainText('Grifo, (Moraes, 2024, p. 4)');
  await page.locator('#qk').fill('avaliação artefatos');
  await page.locator('#qk').press('Enter');
  await expect(page).toHaveURL(/#disciplina\//);
  await expect(page.locator('.topo h1')).toContainText('Avaliação de Artefatos');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#veu.on #qk')).toBeVisible();
  await page.locator('#qk').fill('ajustes');
  await page.locator('#qk').press('Enter');
  await expect(page).toHaveURL(/#ajustes$/);
});

test('modelos por tarefa: a escolha vale no pedido, vai para o Drive e volta ao padrão', async ({ page, context }) => {
  const { g, gem } = await entrar(page, context);
  await page.goto('/#ajustes/modelos');
  await page.getByLabel('Modelo para Testar conexão').waitFor({ state: 'detached' }).catch(() => {});
  await page.getByLabel('Pensamento para Memória').selectOption('LOW');
  await page.getByLabel('Modelo para Memória').selectOption('gemini-3.8-flash');
  await expect(page.locator('#toast')).toContainText('Memória: gemini-3.8-flash, pensamento baixo');
  await expect.poll(() => g.ler('ajustes/preferencias.json')).toContain('"gemini-3.8-flash"');
  const cfg = await page.evaluate(async () => (await import('/js/gemini.js')).tarefa('memoria'));
  expect([cfg.modelo, cfg.pensamento]).toEqual(['gemini-3.8-flash', 'LOW']);
  await page.locator('[data-ia-padrao="memoria"]').click();
  const de = await page.evaluate(async () => (await import('/js/gemini.js')).tarefa('memoria'));
  expect(de.modelo).toBe('gemini-3.1-flash-lite');
  void gem;
});

test('uso e custo vêm dos registros das chamadas; limite avisa em 80%; marca-textos guardam a descrição', async ({ page, context }) => {
  const { g } = await entrar(page, context);
  await page.evaluate(() => window.rb.ia.testar());
  await page.goto('/#ajustes/custo');
  await expect(page.locator('#sec-custo .kpis')).toContainText('pedidos no mês');
  await expect(page.locator('#sec-custo table').first()).toContainText('Testar conexão');
  await page.getByLabel('Limite mensal (US$)').fill('0,0001');
  await page.evaluate(() => window.rb.iaUso.recarregar());
  await page.goto('/#painel');
  await page.goto('/#ajustes/custo');
  await expect(page.locator('#sec-custo .aviso')).toContainText('do limite que você definiu');
  await page.goto('/#ajustes/registros');
  await expect(page.locator('#sec-registros .kpis')).toContainText('1pedidos à IA hoje');
  await page.goto('/#ajustes/cores');
  await page.getByLabel('Descrição de Crítica').fill('Onde discordo, com motivo');
  await expect.poll(() => g.ler('ajustes/preferencias.json'), { timeout: 5000 }).toContain('Onde discordo, com motivo');
  expect(await page.evaluate(() => window.rb.iaUso.descricoes().critica)).toBe('Onde discordo, com motivo');
});

test('marcas de apagado com mais de 90 dias saem do aparelho e do Drive; as recentes ficam', async ({ page, context }) => {
  const { g } = await entrar(page, context);
  await page.evaluate(async () => {
    await window.rb.dados.salvar('trilhas', { id: 'recente', apagado: true });
    await new Promise((ok, erro) => {
      const req = indexedDB.open('researchbook');
      req.onsuccess = () => {
        const tx = req.result.transaction('trilhas', 'readwrite');
        tx.objectStore('trilhas').put({ id: 'antiga', apagado: true, atualizadoEm: '2025-01-01T00:00:00.000Z' });
        tx.oncomplete = () => {
          req.result.close();
          ok();
        };
        tx.onerror = () => erro(tx.error);
      };
    });
    await window.rb.sincronia.sincronizar();
  });
  const ids = await page.evaluate(async () => (await window.rb.dados.listarTudo('trilhas')).map((t) => t.id));
  expect(ids).toEqual(['recente']);
  const noDrive = JSON.parse(g.ler('dados/trilhas.json')).itens.map((t) => t.id);
  expect(noDrive).toEqual(['recente']);
  const reg = await page.evaluate(() => window.rb.registros.lista().filter((e) => e.ev === 'sinc.limpeza').map((e) => e.det));
  expect(reg[0]).toContain('trilhas: 1 marcas de apagado com mais de 90 dias');
});

// Revisão de textos (v2.25.0): um nome para cada coisa. Os termos abaixo foram aposentados (docs/design-system.md,
// glossário); se um deles voltar a um texto de tela, este teste diz onde e qual é o nome certo.
const APOSENTADOS = [
  [/Reconect(e|ar) ao Google|sessão do Google venceu/i, 'O login do Google venceu. Entre de novo.'],
  [/quando a conexão voltar|quando houver conexão|Sem conexão para/, 'internet'],
  [/Ajustes (>|&gt;) (Gemini|Google Agenda)/, 'Em Ajustes, em Conexão com o Gemini'],
  [/lista para buscar|Marcar para buscar/, 'para adicionar'],
  [/(Configurar o|Ajustes do|Abrir Ajustes do|Ligue o) Gemini/, 'Conectar o Gemini'],
  [/Disciplina (salva|apagada|não encontrada)|Projeto arquivado|>Arquivar<|>Desarquivar</, 'projeto, encerrar, reabrir'],
  [/Grifo tirado|tirado do projeto/, 'apagado'],
  [/Procur(ar|ando) (pelo|os dados|de novo|nas conversas|no acervo)/, 'buscar'],
  [/(Marco|Anotação|Cópia) gravad[oa]|Gravando…|gravado sozinho|gravada sozinha/, 'salvar'],
  [/[nd]o seu acervo|com o seu acervo|pelo acervo/, 'biblioteca'],
  [/chamadas (à IA|no mês|sem preço)/, 'pedidos'],
  [/respondeu \$\{r\.status\}|respondeu agora \(\$\{|com erro \(\$\{/, 'erro sem código: o código vai para os registros'],
  [/O problema ficou registrado/, 'o erro está em Ajustes, em Registros'],
  [/quando o Gemini entrar|vai ficar no seu Google Drive|Quando o Drive estiver ligado|Escreva na Escrita|vão para Organizar/, 'texto de versão antiga'],
  [/fora do formato esperado|não devolveu o endereço de envio|retorno de login/, 'palavra comum, não a do sistema'],
  [/Encontrei o DOI|Não encontrei (esta obra|citação|este trecho|o texto)|Abri no modo|Achei um resultado|busquei os dados/, 'o app não diz "eu"'],
  [/textos meus|Manter o meu|nos meus grifos|Minha anotação|soa como eu/, 'seu, sua'],
  [/>Ok, conferi<|>Usar<\/button>|>Mudar<\/button>|>Desligar<\/button>/, 'botão diz o que faz'],
];
test('escrita: nenhum termo aposentado volta a um texto de tela', () => {
  const achados = [];
  for (const f of readdirSync('public/js').filter((n) => n.endsWith('.js'))) {
    readFileSync(`public/js/${f}`, 'utf8').split('\n').forEach((l, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
      for (const [re, use] of APOSENTADOS) if (re.test(l)) achados.push(`${f}:${i + 1} ${re} (use: ${use})`);
    });
  }
  expect(achados).toEqual([]);
});
