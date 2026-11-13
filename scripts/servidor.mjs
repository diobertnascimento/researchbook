// Servidor local mínimo para abrir o app e rodar os testes, sem dependências.
// Uso: npm run abrir  (abre em http://localhost:4173)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const RAIZ = join(import.meta.dirname, '..', 'public');
const PORTA = Number(process.env.PORTA || 4173);
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

createServer(async (req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const arquivo = normalize(join(RAIZ, caminho === '/' ? 'index.html' : caminho));
  if (!arquivo.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
  try {
    const corpo = await readFile(arquivo);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
    res.end(corpo);
  } catch {
    res.writeHead(404).end('Não encontrado');
  }
}).listen(PORTA, () => console.log(`researchbook em http://localhost:${PORTA}`));
