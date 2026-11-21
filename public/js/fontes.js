// Fonte de dados de obras além do Crossref, pelo servidor do autor (pasta servidor/, no Cloud Run): o OpenAlex
// (por título, autor e ano), que exige chave. O pedido leva o login Google; o servidor confere a conta, conta
// o pedido no limite do dia e devolve só os dados da obra. Nenhuma chave passa por aqui.
// A leitura da página de um artigo por link (v2.17.0) foi retirada na v2.19.3: link só vale quando traz o DOI.
import { servidorIA } from './config.js';
import { limparDOI } from './crossref.js';

/** O que o autor colou: um DOI (também dentro de um link, como doi.org/10...), um link sem DOI, ou nada. */
export function entender(texto) {
  const t = String(texto || '').trim();
  const doi = limparDOI(decodeURIComponent(t.replace(/%(?![0-9a-f]{2})/gi, '%25')));
  if (doi) return { doi };
  return /^https?:\/\/\S+$/i.test(t) ? { linkSemDOI: true } : {};
}

export function criarFontes({ google, registrar = () => {}, buscar = (...a) => fetch(...a) }) {
  const ligado = () => !!servidorIA() && !!google?.sessao?.()?.token;

  // O pedido vai no corpo: o que vai no endereço fica no registro de acessos do servidor, e título de obra
  // não deve ficar lá. Servidor publicado antes da v2.19.2 só entende o jeito antigo.
  async function pedir(caminho, evento, pedido) {
    const r = await enviar(caminho, evento, pedido, false);
    return r.codigo === 'rota' ? enviar(caminho, evento, pedido, true) : r;
  }

  async function enviar(caminho, evento, pedido, jeitoAntigo) {
    const raiz = servidorIA();
    const token = google?.sessao?.()?.token;
    if (!raiz) return { erro: 'Esta busca passa pelo seu servidor, que ainda não foi publicado.', codigo: 'sem-servidor' };
    if (!token) return { erro: 'Entre com o Google para usar esta busca: ela passa pelo seu servidor.', codigo: 'login' };
    const inicio = performance.now();
    let r;
    try {
      const h = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
      const destino = raiz.replace(/\/$/, '') + caminho;
      r = jeitoAntigo ? await buscar(`${destino}?${new URLSearchParams(pedido)}`, { headers: h }) : await buscar(destino, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify(pedido) });
    } catch {
      registrar('erro', evento, { det: 'sem conexão', st: 'aviso' });
      return { erro: 'Sem conexão com o seu servidor agora.', codigo: 'conexao' };
    }
    const dur = Math.round(performance.now() - inicio);
    const corpo = await r.json().catch(() => null);
    if (!r.ok) {
      const codigo = corpo?.error?.codigo || String(r.status);
      if (codigo === 'rota' && !jeitoAntigo) return { codigo };
      registrar('erro', evento, { det: codigo, dur, st: 'aviso' });
      // A mensagem do servidor é escrita por nós e já diz o que fazer; rota desconhecida é servidor antigo.
      const texto = codigo === 'rota' ? 'O seu servidor ainda está na versão antiga. Publique de novo (servidor/publicar.sh) para ligar esta busca.' : codigo === 'login' ? 'O servidor não aceitou o login. Entre de novo com o Google e repita o pedido.' : corpo?.error?.origem === 'servidor' ? String(corpo.error.message).slice(0, 240) : 'O seu servidor não respondeu como esperado. Tente de novo em instantes.';
      return { erro: texto, codigo };
    }
    registrar('arq', evento, { det: 'ok', dur });
    return corpo || {};
  }

  /** Procura no OpenAlex com título, autores e ano. Devolve { candidatos } (cada um com fonte: 'openalex') ou { erro }. */
  async function procurarNoOpenAlex(f) {
    const q = [f.titulo, f.subtitulo, (f.autores || []).slice(0, 2).map((a) => a.sobrenome).join(' '), f.ano].filter(Boolean).join(' ').slice(0, 300);
    if (q.trim().length < 3) return { candidatos: [] };
    const r = await pedir('/obras/openalex', 'openalex.procurar', { busca: q });
    if (r.erro) return r;
    return { candidatos: (r.candidatos || []).map((c) => ({ ...c, fonte: 'openalex' })) };
  }

  return { ligado, procurarNoOpenAlex };
}
