// Base do app: funcionamento sem internet, atualização, registros, cópia dos dados e dica do iPhone.
import { test, expect, devices } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { abrirApp, irPara } from './ajuda.js';

const RAIZ = join(import.meta.dirname, '..');
const pronto = (page) => page.waitForFunction(() => window.rb && window.rb.pronto);
const soComputador = ({}, info) => test.skip(info.project.name !== 'computador', 'Basta rodar no computador');

test.describe('service worker', () => {
  test.beforeEach(soComputador);

  test('a versão do service worker é a mesma do app', () => {
    const sw = readFileSync(join(RAIZ, 'public/sw.js'), 'utf8');
    const pacote = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
    expect(sw.match(/const VERSAO = '([^']+)'/)[1]).toBe(pacote.version);
  });

  test('todo arquivo guardado pelo service worker existe', () => {
    const sw = readFileSync(join(RAIZ, 'public/sw.js'), 'utf8');
    const lista = sw.match(/const ARQUIVOS = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map((x) => x.slice(1, -1));
    for (const f of lista.filter((f) => f !== './')) expect(existsSync(join(RAIZ, 'public', f)), f).toBe(true);
  });

  test('depois da primeira visita, o app abre sem internet', async ({ page, context }) => {
    await abrirApp(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#vista h1')).toBeVisible();
    await pronto(page);
    await context.setOffline(false);
  });

  test('o aviso de versão nova aparece com a ação de atualizar', async ({ page }) => {
    await abrirApp(page);
    await pronto(page);
    await page.evaluate(() => window.rb.atualizacao.mostrar(null));
    const aviso = page.locator('#aviso-versao');
    await expect(aviso).toContainText('Nova versão');
    await aviso.getByRole('button', { name: 'Depois' }).click();
    await expect(aviso).toHaveCount(0);
  });
});

test.describe('configuração', () => {
  test.beforeEach(soComputador);

  test('o ID do cliente Google tem o formato certo e nenhuma chave secreta está no código', () => {
    const cfg = readFileSync(join(RAIZ, 'public/js/config.js'), 'utf8');
    expect(cfg).toMatch(/GOOGLE_CLIENT_ID = '\d+-[a-z0-9]{32}\.apps\.googleusercontent\.com'/);
    for (const f of ['public/index.html', ...['config', 'google', 'drive', 'sincronia', 'inicio'].map((n) => `public/js/${n}.js`)]) {
      expect(readFileSync(join(RAIZ, f), 'utf8'), f).not.toMatch(/GOCSPX-|client_secret\s*[:=]\s*['"]/);
    }
  });

  // O repositório é público. Este teste lê todos os arquivos versionados e recusa qualquer coisa com formato
  // de chave ou token. Os padrões são montados em pedaços para este arquivo não casar com ele mesmo.
  test('nenhum arquivo do repositório tem formato de chave, token ou segredo', () => {
    const PADROES = [
      ['chave de API do Google (Gemini)', new RegExp('AI' + 'za[0-9A-Za-z_-]{35}')],
      ['segredo do cliente OAuth', new RegExp('GOC' + 'SPX-[0-9A-Za-z_-]{20,}')],
      ['token de acesso do Google', new RegExp('ya' + '29\\.[0-9A-Za-z_-]{30,}')],
      ['token de renovação do Google', new RegExp('1/' + '/0[0-9A-Za-z_-]{30,}')],
      ['chave privada', new RegExp('-----BEGIN ' + '[A-Z ]*PRIVATE KEY-----')],
      ['token do GitHub', new RegExp('gh[pousr]_' + '[0-9A-Za-z]{36,}')],
    ];
    const arquivos = execFileSync('git', ['ls-files', '-z'], { cwd: RAIZ, encoding: 'utf8' }).split('\0').filter(Boolean);
    expect(arquivos.length).toBeGreaterThan(50);
    const achados = [];
    for (const f of arquivos) {
      if (/\.(png|jpg|jpeg|webp|ico|pdf|woff2?|ttf|mp3|m4a|wasm|map)$/i.test(f) || f.startsWith('public/vendor/')) continue;
      let texto;
      try {
        texto = readFileSync(join(RAIZ, f), 'utf8');
      } catch {
        continue; // apagado na pasta de trabalho, mas ainda listado
      }
      for (const [nome, padrao] of PADROES) if (padrao.test(texto)) achados.push(`${f}: ${nome}`);
    }
    expect(achados, 'Tire o segredo do arquivo, troque a chave no Google e só então grave de novo.').toEqual([]);
  });

  test('endereço do app: o mesmo no código, na regra de segurança e no servidor da chave', () => {
    const cfg = readFileSync(join(RAIZ, 'public/js/config.js'), 'utf8');
    const endereco = new URL(cfg.match(/ENDERECO = '([^']*)'/)[1]);
    expect(endereco.protocol).toBe('https:');
    expect(endereco.pathname).toBe('/');
    // Sem arquivo CNAME: a publicação é feita pelo GitHub Actions, e o domínio é ligado em Settings > Pages.
    expect(existsSync(join(RAIZ, 'public/CNAME'))).toBe(false);
    const conexoes = readFileSync(join(RAIZ, 'public/index.html'), 'utf8').match(/connect-src([^;]*)/)[1].trim().split(/\s+/);
    expect(conexoes).toContain(endereco.origin);
    // O servidor da chave precisa aceitar o endereço novo e, durante a mudança, o antigo.
    const publicar = readFileSync(join(RAIZ, 'servidor/publicar.sh'), 'utf8');
    expect(publicar).toContain(`ORIGENS="\${ORIGENS:-${endereco.origin},https://diobertnascimento.github.io}"`);
  });

  test('aviso de mudança de endereço: só no endereço antigo, só com o novo no ar, e só manda ir com tudo no Drive', async ({ page }) => {
    await abrirApp(page);
    const r = await page.evaluate(async () => {
      const { criarMudanca } = await import('/js/mudanca.js');
      const SW = "const CACHE = `researchbook-${VERSAO}`;";
      const montar = ({ origem = 'https://antigo.exemplo.org', resposta = { ok: true, texto: SW }, estado = { fase: 'ok', pendente: false, pendentes: 0 }, conta = true } = {}) => {
        const visto = { avisos: [], idas: [], buscas: [], hora: 1_000_000 };
        const m = criarMudanca({
          endereco: 'https://novo.exemplo.org/',
          origem,
          buscar: async (u, o) => {
            visto.buscas.push(u);
            if (resposta === 'fora') throw new TypeError('Failed to fetch');
            if (resposta === 'sem-leitura') {
              if (o?.mode !== 'no-cors') throw new TypeError('Failed to fetch');
              return { ok: false, type: 'opaque', text: async () => '' };
            }
            return { ok: resposta.ok, text: async () => resposta.texto };
          },
          aviso: (a) => visto.avisos.push(a),
          estado: () => estado,
          temConta: () => conta,
          ir: (u) => visto.idas.push(u),
          registrar: () => {},
          agora: () => visto.hora,
        });
        return { m, visto };
      };
      const saida = {};
      // No próprio endereço novo: nada a avisar, e nem pergunta à rede.
      let c = montar({ origem: 'https://novo.exemplo.org' });
      saida.noNovo = [await c.m.avaliar(), c.visto.buscas.length, c.m.antigo];
      // Endereço novo ainda fora do ar, com página de erro ou com outra coisa no lugar: sem aviso.
      saida.foraDoAr = [];
      for (const resposta of ['fora', { ok: false, texto: 'Not Found' }, { ok: true, texto: '<html>Site em construção</html>' }]) {
        c = montar({ resposta });
        saida.foraDoAr.push([await c.m.avaliar(), c.visto.avisos.length]);
      }
      // O navegador não deixa ler a resposta do outro endereço, mas ele respondeu: vale como no ar.
      c = montar({ resposta: 'sem-leitura' });
      saida.semLeitura = [await c.m.avaliar(), c.visto.buscas.length];
      // No ar e tudo no Drive: manda ir.
      c = montar();
      saida.pronto = await c.m.avaliar();
      saida.buscou = c.visto.buscas[0];
      saida.textoPronto = c.visto.avisos[0].texto;
      saida.botoesPronto = c.visto.avisos[0].acoes.map((a) => a.rotulo);
      c.visto.avisos[0].acoes[0].ao();
      saida.foiPara = c.visto.idas;
      // Com mudanças esperando: não oferece ir.
      c = montar({ estado: { fase: 'desconectado', pendente: true, pendentes: 2 } });
      saida.espere = await c.m.avaliar();
      saida.textoEspere = c.visto.avisos[0].texto;
      saida.botoesEspere = c.visto.avisos[0].acoes.map((a) => a.rotulo);
      // "Depois" segura o aviso por meia hora.
      c.visto.avisos[0].acoes[1].ao();
      saida.adiado = await c.m.avaliar();
      c.visto.hora += 31 * 60_000;
      saida.voltou = await c.m.avaliar();
      // Aparelho sem conta (só a demonstração): aviso curto.
      c = montar({ conta: false });
      saida.semConta = [await c.m.avaliar(), c.visto.avisos[0].texto];
      return saida;
    });
    expect(r.noNovo).toEqual([null, 0, false]);
    expect(r.foraDoAr).toEqual([[null, 0], [null, 0], [null, 0]]);
    expect(r.semLeitura).toEqual(['pronto', 2]);
    expect(r.pronto).toBe('pronto');
    expect(r.buscou).toBe('https://novo.exemplo.org/sw.js');
    expect(r.textoPronto).toBe('O researchbook mudou para novo.exemplo.org. Tudo deste aparelho já está no seu Drive. Abra o endereço novo e entre com o Google: os seus dados aparecem lá.');
    expect(r.botoesPronto).toEqual(['Abrir o endereço novo', 'Depois']);
    expect(r.foiPara).toEqual(['https://novo.exemplo.org/']);
    expect(r.espere).toBe('espere');
    expect(r.textoEspere).toContain('precisa terminar de enviar tudo para o Drive (2 mudanças esperando)');
    expect(r.botoesEspere).toEqual(['Conferir de novo', 'Depois']);
    expect(r.adiado).toBeNull();
    expect(r.voltou).toBe('espere');
    expect(r.semConta).toEqual(['sem-conta', 'O researchbook mudou de endereço: novo.exemplo.org.']);
    // Em localhost o aviso nunca liga sozinho.
    await expect(page.locator('#aviso-endereco')).toHaveCount(0);
  });

  test('o servidor da chave: endereço exato no app e na regra de segurança, sem curinga', () => {
    const cfg = readFileSync(join(RAIZ, 'public/js/config.js'), 'utf8');
    const servidor = cfg.match(/SERVIDOR_IA = '([^']*)'/)[1];
    const conexoes = readFileSync(join(RAIZ, 'public/index.html'), 'utf8').match(/connect-src([^;]*)/)[1].trim().split(/\s+/);
    expect(conexoes.join(' ')).not.toContain('*');
    if (!servidor) return;
    // Só o endereço do servidor publicado: https, sem caminho, e o mesmo nos dois lugares.
    expect(servidor).toMatch(/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/);
    expect(conexoes).toContain(servidor);
  });
});

test.describe('registros', () => {
  test.beforeEach(soComputador);

  test('sessão, navegação e cliques são gravados, sem o texto do usuário', async ({ page }) => {
    await abrirApp(page);
    await pronto(page);
    await irPara(page, '#biblioteca');
    await page.locator('#vista button:visible').first().click();
    const eventos = await page.evaluate(() => window.rb.registros.doBanco());
    const nomes = eventos.map((e) => e.ev);
    expect(nomes).toContain('sessao.inicio');
    expect(nomes).toContain('app.pronto');
    expect(nomes).toContain('ui.navegacao');
    expect(nomes).toContain('ui.clique');
    for (const e of eventos) {
      expect(e.v).toBe(await page.evaluate(() => APP_VERSAO));
      expect(e.det).not.toMatch(/msg=/);
    }
  });

  test('erros de JavaScript viram registro', async ({ page }) => {
    await abrirApp(page);
    await pronto(page);
    await page.evaluate(() => setTimeout(() => { throw new Error('erro-de-teste'); }));
    await expect.poll(() => page.evaluate(() => window.rb.registros.lista().some((e) => e.ev === 'js.erro' && e.det.includes('erro-de-teste')))).toBe(true);
  });

  test('Ajustes mostra os registros reais deste aparelho', async ({ page }) => {
    await abrirApp(page, '#ajustes/registros');
    await pronto(page);
    await expect(page.locator('#sec-registros table')).toContainText('sessao.inicio');
    await page.evaluate(() => { location.hash = '#ajustes/aparelho'; });
    await expect(page.locator('#sec-aparelho')).toContainText('Versão do app');
  });
});

test.describe('dados neste aparelho', () => {
  test.beforeEach(soComputador);

  test('banco aberto no esquema atual, com backup e cópia completa', async ({ page }) => {
    await abrirApp(page);
    await pronto(page);
    const r = await page.evaluate(async () => {
      const d = window.rb.dados;
      const antes = await d.contarBackups();
      await d.backup('teste');
      const depois = await d.contarBackups();
      const copia = await d.exportar();
      return { disponivel: d.disponivel, antes, depois, app: copia.app, colecoes: Object.keys(copia.colecoes) };
    });
    expect(r.disponivel).toBe(true);
    expect(r.depois).toBe(r.antes + 1);
    expect(r.app).toBe('researchbook');
    expect(r.colecoes).toEqual(expect.arrayContaining(['leituras', 'grifos', 'fichamentos', 'textos', 'memoria']));
  });

  test('guarda no máximo 5 backups', async ({ page }) => {
    await abrirApp(page);
    await pronto(page);
    const n = await page.evaluate(async () => {
      for (let i = 0; i < 7; i++) {
        await window.rb.dados.backup('teste ' + i);
        await new Promise((r) => setTimeout(r, 5));
      }
      return window.rb.dados.contarBackups();
    });
    expect(n).toBe(5);
  });
});

test.describe('iPhone', () => {
  test.use({ userAgent: devices['iPhone 15'].userAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test.beforeEach(soComputador);

  test('mostra a dica de instalação até tocar em Entendi', async ({ page }) => {
    await abrirApp(page);
    await pronto(page);
    const dica = page.locator('#aviso-instalar');
    await expect(dica).toContainText('Adicionar à Tela de Início');
    await dica.getByRole('button', { name: 'Entendi' }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await pronto(page);
    await expect(page.locator('#aviso-instalar')).toHaveCount(0);
  });
});
