// Service worker do researchbook.
// Guarda o app no aparelho para abrir rápido e sem internet, e entrega versões novas
// só quando o usuário toca em "Atualizar agora".
//
// A cada versão: VERSAO precisa ser igual a APP_VERSAO (um teste confere). Mudar VERSAO
// muda este arquivo, e é isso que faz o navegador perceber que há versão nova.
// Arquivo novo em public/ que o app usa ao abrir? Coloque em ARQUIVOS (um teste confere que existem).

const VERSAO = '2.6.0';
const CACHE = `researchbook-${VERSAO}`;
const ARQUIVOS = [
  './',
  'index.html',
  'js/app.js',
  'manifest.webmanifest',
  'icone.svg',
  'icone-180.png',
  'icone-192.png',
  'icone-512.png',
  'estilo.css',
  'fontes/inter.woff2',
  'fontes/literata.woff2',
  'fontes/literata-italico.woff2',
  'js/inicio.js',
  'js/ui.js',
  'js/importar.js',
  'js/duplicatas.js',
  'js/organizar.js',
  'js/organizar-ui.js',
  'js/seguranca-ui.js',
  'js/pasta-local.js',
  'js/sincronizacao-ui.js',
  'js/armazenamento.js',
  'js/registros.js',
  'js/atualizacao.js',
  'js/instalar.js',
  'js/config.js',
  'js/google.js',
  'js/drive.js',
  'js/sincronia.js',
  'js/abnt.js',
  'js/crossref.js',
  'js/biblioteca.js',
  'js/biblioteca-ui.js',
  'js/leitor-pdf.js',
  'js/leitor-texto.js',
  'js/fichamento-ui.js',
  'js/progresso.js',
  'js/argumentos-ui.js',
  'js/trilhas-ui.js',
  'js/hoje-ui.js',
  'js/sessoes.js',
  'js/dissertacao-visao.js',
  'js/conflitos-ui.js',
  'js/cofre.js',
  'js/gemini.js',
  'js/contexto.js',
  'js/historico.js',
  'js/ia.js',
  'js/tutor-ui.js',
  'js/ia-ajustes.js',
  'js/memoria-ui.js',
  'js/escrita.js',
  'js/docx.js',
  'js/copiloto.js',
  'js/escrita-ui.js',
  'js/disciplinas.js',
  'js/disciplinas-ui.js',
  'js/dissertacao.js',
  'js/dissertacao-ui.js',
  'js/dialogos.js',
  'js/agenda.js',
  'js/agenda-ui.js',
  'js/cartoes.js',
  'js/cartoes-ui.js',
  'js/tutor-fichamento.js',
  'js/overview.js',
  'js/overview-ui.js',
  'js/busca.js',
  'js/ia-uso.js',
  'prompts/copilot.md',
  'prompts/overview-autor.md',
  'prompts/fichamento.md',
  'prompts/cartoes.md',
  'prompts/dialogos.md',
  'prompts/orientacao.md',
  'prompts/revisao-projeto.md',
  'prompts/plano-de-ensino.md',
  'prompts/aula.md',
  'prompts/transcricao.md',
  'prompts/revisao-final.md',
  'prompts/memoria.md',
  'prompts/00-base.md',
  'prompts/tutor.md',
];

self.addEventListener('install', (e) => {
  // Baixa tudo direto do servidor (sem cache HTTP) para não misturar versões.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' })))));
  // Sem skipWaiting aqui: a versão nova espera o usuário pedir para atualizar.
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith('researchbook-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.tipo === 'pular-espera') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Só cuida de leituras do próprio app. Chamadas ao Google (Drive, Agenda, Gemini) passam direto.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html', { cacheName: CACHE }).then((r) => r || fetch(req)));
    return;
  }
  // PDF.js (vendor/) é grande: guarda no primeiro uso, e daí em diante abre sem internet.
  if (url.pathname.includes('/vendor/')) {
    e.respondWith(
      caches.match(req, { cacheName: CACHE }).then(
        (r) =>
          r ||
          fetch(req).then((resp) => {
            if (resp.ok) caches.open(CACHE).then((c) => c.put(req, resp.clone()));
            return resp;
          }),
      ),
    );
    return;
  }
  e.respondWith(caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then((r) => r || fetch(req)));
});
