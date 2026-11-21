// Regras do Crossref de verdade que os testes precisam respeitar.
// Campos aceitos em "select" na rota /works, conforme a documentação da API (lista conferida em 20/11/2026
// em duas bibliotecas que a reproduzem: habanero e REST::Client::CrossRef). Um nome fora desta lista faz o
// Crossref recusar o pedido inteiro com erro 400.
export const SELECT_ACEITOS = new Set([
  'abstract', 'URL', 'member', 'posted', 'score', 'created', 'degree', 'update-policy', 'short-title', 'license', 'ISSN',
  'container-title', 'issued', 'update-to', 'issue', 'prefix', 'approved', 'indexed', 'article-number', 'clinical-trial-number',
  'accepted', 'author', 'group-title', 'DOI', 'is-referenced-by-count', 'updated-by', 'event', 'chair', 'standards-body',
  'original-title', 'funder', 'translator', 'archive', 'published-print', 'alternative-id', 'subject', 'subtitle',
  'published-online', 'publisher-location', 'content-domain', 'reference', 'title', 'link', 'type', 'publisher', 'volume',
  'references-count', 'ISBN', 'issn-type', 'assertion', 'deposited', 'page', 'content-created', 'short-container-title',
  'relation', 'editor',
]);

/** Devolve o nome do primeiro campo de "select" que o Crossref recusaria, ou null. */
export function selectRecusado(url) {
  const sel = new URL(url).searchParams.get('select');
  if (!sel) return null;
  return sel.split(',').find((c) => !SELECT_ACEITOS.has(c)) || null;
}

/** Resposta do Crossref para um "select" inválido. */
export const erroDeSelect = (campo) => ({
  status: 400,
  headers: { 'access-control-allow-origin': '*' },
  contentType: 'application/json',
  body: JSON.stringify({ status: 'failed', 'message-type': 'validation-failure', message: [{ type: 'parameter-not-allowed', value: campo, message: `Select field ${campo} specified but there is no such field` }] }),
});
