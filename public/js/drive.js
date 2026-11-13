// Acesso ao Google Drive pela API, só com a permissão drive.file
// (o app enxerga apenas os arquivos e pastas que ele mesmo criou).
//
// A pasta principal é marcada com appProperties rb=raiz. Assim o app a encontra mesmo que
// o Diobert a renomeie ou mova dentro do Drive.

const API = 'https://www.googleapis.com/drive/v3';
const UP = 'https://www.googleapis.com/upload/drive/v3';
const PASTA = 'application/vnd.google-apps.folder';
const TENTATIVAS = 4;

const aspas = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const tamanho = (s) => {
  const b = new Blob([s]).size;
  return b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`;
};
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

export class ErroDrive extends Error {
  constructor(mensagem, codigo) {
    super(mensagem);
    this.codigo = codigo;
  }
}

export function criarDrive({ token, registrar }) {
  const ids = new Map(); // caminho -> id (pastas e arquivos)

  async function chamar(metodo, url, { corpo, tipo, evento, det = '' } = {}) {
    for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
      const t = token();
      if (!t) throw new ErroDrive('Sessão do Google vencida', 401);
      const inicio = performance.now();
      let r;
      try {
        r = await fetch(url, { method: metodo, headers: { Authorization: `Bearer ${t}`, ...(tipo ? { 'Content-Type': tipo } : {}) }, body: corpo });
      } catch (e) {
        registrar('erro', evento, { det: `sem conexão: ${e.message}`, st: 'erro' });
        throw new ErroDrive('Sem conexão com o Google Drive', 'rede');
      }
      const dur = Math.round(performance.now() - inicio);
      if (r.ok) {
        registrar('arq', evento, { det, dur });
        return r;
      }
      if (r.status === 401) {
        registrar('erro', evento, { det: '401: sessão vencida', dur, st: 'erro' });
        throw new ErroDrive('Sessão do Google vencida', 401);
      }
      if ([429, 500, 502, 503, 504].includes(r.status) && tentativa < TENTATIVAS) {
        registrar('arq', evento, { det: `${r.status}: nova tentativa (${tentativa})`, dur, st: 'aviso' });
        await esperar(2 ** tentativa * 250 + Math.random() * 250);
        continue;
      }
      const texto = await r.text().catch(() => '');
      registrar('erro', evento, { det: `${r.status}: ${texto.slice(0, 120)}`, dur, st: 'erro' });
      throw new ErroDrive(`O Google Drive respondeu ${r.status}`, r.status);
    }
  }

  async function buscar(consulta) {
    const p = new URLSearchParams({ q: consulta, spaces: 'drive', pageSize: '100', fields: 'files(id,name,mimeType,modifiedTime)' });
    const r = await chamar('GET', `${API}/files?${p}`, { evento: 'drive.buscar' });
    return (await r.json()).files || [];
  }

  async function criarPasta(nome, pai, propriedades) {
    const meta = { name: nome, mimeType: PASTA, ...(pai ? { parents: [pai] } : {}), ...(propriedades ? { appProperties: propriedades } : {}) };
    const r = await chamar('POST', `${API}/files?fields=id`, { corpo: JSON.stringify(meta), tipo: 'application/json', evento: 'drive.criar_pasta', det: nome });
    return (await r.json()).id;
  }

  async function raiz() {
    if (ids.has('')) return ids.get('');
    const achadas = await buscar(`appProperties has { key='rb' and value='raiz' } and mimeType = '${PASTA}' and trashed = false`);
    const id = achadas[0]?.id ?? (await criarPasta('researchbook', null, { rb: 'raiz' }));
    ids.set('', id);
    return id;
  }

  async function pasta(caminho) {
    if (!caminho) return raiz();
    if (ids.has(caminho)) return ids.get(caminho);
    const partes = caminho.split('/');
    const nome = partes.pop();
    const pai = await pasta(partes.join('/'));
    const achadas = await buscar(`name = '${aspas(nome)}' and '${pai}' in parents and mimeType = '${PASTA}' and trashed = false`);
    const id = achadas[0]?.id ?? (await criarPasta(nome, pai));
    ids.set(caminho, id);
    return id;
  }

  async function arquivo(caminho) {
    const partes = caminho.split('/');
    const nome = partes.pop();
    const pai = await pasta(partes.join('/'));
    if (ids.has(caminho)) return { id: ids.get(caminho), nome, pai };
    const achados = await buscar(`name = '${aspas(nome)}' and '${pai}' in parents and trashed = false`);
    if (achados[0]) ids.set(caminho, achados[0].id);
    return { id: achados[0]?.id ?? null, nome, pai };
  }

  /** Conteúdo do arquivo como texto, ou null se ele não existe. */
  async function ler(caminho) {
    const a = await arquivo(caminho);
    if (!a.id) return null;
    try {
      const r = await chamar('GET', `${API}/files/${a.id}?alt=media`, { evento: 'drive.ler', det: caminho });
      return await r.text();
    } catch (e) {
      if (e.codigo === 404) {
        ids.delete(caminho);
        return null;
      }
      throw e;
    }
  }

  /** Arquivos de uma pasta, com data de modificação (uma chamada só). */
  async function listar(caminho) {
    const id = await pasta(caminho);
    return buscar(`'${id}' in parents and trashed = false`);
  }

  /** Cria ou substitui o arquivo. Devolve {id, modificado}. */
  async function gravar(caminho, conteudo, tipo = 'application/json') {
    const a = await arquivo(caminho);
    const det = `${caminho} (${tamanho(conteudo)})`;
    if (a.id) {
      try {
        const r = await chamar('PATCH', `${UP}/files/${a.id}?uploadType=media&fields=id,modifiedTime`, { corpo: conteudo, tipo, evento: 'drive.atualizar', det });
        const j = await r.json();
        return { id: j.id, modificado: j.modifiedTime };
      } catch (e) {
        if (e.codigo !== 404) throw e;
        ids.delete(caminho); // apagado no Drive: cria de novo
      }
    }
    const limite = 'rb' + crypto.randomUUID().replace(/-/g, '');
    const meta = JSON.stringify({ name: a.nome, parents: [a.pai], mimeType: tipo });
    const corpo = `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${limite}\r\nContent-Type: ${tipo}\r\n\r\n${conteudo}\r\n--${limite}--`;
    const r = await chamar('POST', `${UP}/files?uploadType=multipart&fields=id,modifiedTime`, { corpo, tipo: `multipart/related; boundary=${limite}`, evento: 'drive.criar', det });
    const j = await r.json();
    ids.set(caminho, j.id);
    return { id: j.id, modificado: j.modifiedTime };
  }

  /**
   * Envia um arquivo binário (PDF, áudio) por upload em duas etapas (resumable), que aceita arquivos grandes.
   * Devolve {id, modificado}. Se já existir um arquivo com o mesmo caminho, ele é substituído.
   */
  async function enviarArquivo(caminho, blob, tipo = blob.type || 'application/octet-stream') {
    const a = await arquivo(caminho);
    const det = `${caminho} (${tamanho(blob)})`;
    const meta = a.id ? {} : { name: a.nome, parents: [a.pai], mimeType: tipo };
    const url = a.id ? `${UP}/files/${a.id}?uploadType=resumable&fields=id,modifiedTime` : `${UP}/files?uploadType=resumable&fields=id,modifiedTime`;
    const inicio = await chamar(a.id ? 'PATCH' : 'POST', url, { corpo: JSON.stringify(meta), tipo: 'application/json; charset=UTF-8', evento: 'drive.envio_inicio', det });
    const destino = inicio.headers.get('Location');
    if (!destino) throw new ErroDrive('O Google Drive não devolveu o endereço de envio', 'envio');
    const r = await chamar('PUT', destino, { corpo: blob, tipo, evento: 'drive.envio_arquivo', det });
    const j = await r.json();
    ids.set(caminho, j.id);
    return { id: j.id, modificado: j.modifiedTime };
  }

  /** Baixa um arquivo binário pelo id (o id fica guardado na ficha da obra). */
  async function baixarArquivo(id, det = '') {
    const r = await chamar('GET', `${API}/files/${encodeURIComponent(id)}?alt=media`, { evento: 'drive.baixar_arquivo', det });
    return r.blob();
  }

  return { raiz, pasta, listar, ler, gravar, enviarArquivo, baixarArquivo, idRaiz: () => ids.get('') ?? null };
}
