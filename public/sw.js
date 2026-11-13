// Service worker do researchbook.
// Guarda o app no aparelho para abrir rápido e sem internet, e entrega versões novas
// só quando o usuário toca em "Atualizar agora".
//
// A cada versão: VERSAO precisa ser igual a APP_VERSAO (um teste confere). Mudar VERSAO
// muda este arquivo, e é isso que faz o navegador perceber que há versão nova.
// Arquivo novo em public/ que o app usa ao abrir? Coloque em ARQUIVOS (um teste confere que existem).

const VERSAO = '0.8.0';
const CACHE = `researchbook-${VERSAO}`;
const ARQUIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icone.svg',
  'icone-180.png',
  'icone-192.png',
  'icone-512.png',
  'fontes/lexend.woff2',
  'fontes/literata.woff2',
  'fontes/literata-italico.woff2',
  'js/inicio.js',
  'js/armazenamento.js',
  'js/registros.js',
  'js/atualizacao.js',
  'js/instalar.js',
  'js/config.js',
  'js/google.js',
  'js/drive.js',
  'js/sincronia.js',
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
  e.respondWith(caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then((r) => r || fetch(req)));
});
