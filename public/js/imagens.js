// Imagens do texto (figuras dentro de uma seção).
//
// No HTML do texto a figura é só <figure data-img="img-xxxxxxxx.png" data-l data-a data-titulo data-fonte>:
// o conteúdo da imagem nunca entra no texto nem no JSON de sincronização. Ele fica neste aparelho
// (store "arquivos") e no Drive, em escrita/imagens/<id>, e é procurado pelo próprio id.
// Toda imagem é regravada ao entrar: no máximo 1600 px no lado maior e sem os dados da câmera
// (local, aparelho, data), que não devem viajar com o texto.
// Tirar a figura do texto não apaga a imagem: uma versão antiga do texto continua abrindo com ela.
import * as arm from './armazenamento.js';

export const ID_IMAGEM = /^img-[a-z0-9]{8}\.(png|jpg)$/;
const LADO_MAX = 1600;
const LIMITE = 25 * 1024 * 1024;
const ACEITOS = ['image/png', 'image/jpeg', 'image/webp'];
const PENDENTES = 'imagensPendentes';

/** Regrava a imagem: PNG continua PNG; JPG e WebP viram JPG. Devolve { blob, tipo, largura, altura }. */
export async function preparar(arquivo) {
  if (!arquivo?.size) throw new Error('Este arquivo está vazio.');
  if (!ACEITOS.includes(arquivo.type)) throw new Error('Use uma imagem PNG, JPG ou WebP.');
  if (arquivo.size > LIMITE) throw new Error('A imagem passa de 25 MB. Escolha uma menor.');
  let bmp;
  try {
    bmp = await createImageBitmap(arquivo);
  } catch {
    throw new Error('Não deu para ler esta imagem.');
  }
  const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
  const largura = Math.max(1, Math.round(bmp.width * escala));
  const altura = Math.max(1, Math.round(bmp.height * escala));
  const tipo = arquivo.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const tela = document.createElement('canvas');
  tela.width = largura;
  tela.height = altura;
  const ctx = tela.getContext('2d');
  if (tipo === 'image/jpeg') {
    // JPG não tem transparência: o fundo vira branco, como no papel.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, largura, altura);
  }
  ctx.drawImage(bmp, 0, 0, largura, altura);
  bmp.close?.();
  const blob = await new Promise((ok) => tela.toBlob(ok, tipo, 0.88));
  if (!blob) throw new Error('Não deu para preparar esta imagem.');
  return { blob, tipo, largura, altura };
}

export function criarImagens({ db, drive, registrar }) {
  const urls = new Map();
  const caminho = (id) => `escrita/imagens/${id}`;

  // A lista de envios pendentes é mudada uma vez de cada vez.
  let fila = Promise.resolve();
  const mudarPendentes = (fn) => (fila = fila.catch(() => {}).then(async () => arm.gravarMeta(db, PENDENTES, fn((await arm.lerMeta(db, PENDENTES)) || []))));

  /** Guarda a imagem neste aparelho e manda para o Drive. Devolve { id, largura, altura }. */
  async function guardar(arquivo) {
    const { blob, tipo, largura, altura } = await preparar(arquivo);
    const id = `img-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}.${tipo === 'image/png' ? 'png' : 'jpg'}`;
    await arm.gravar(db, 'arquivos', { id, blob, tipo, tamanho: blob.size, largura, altura, guardadoEm: new Date().toISOString() });
    await mudarPendentes((l) => [...new Set([...l, id])]);
    enviar(id);
    registrar('ui', 'texto.imagem', { det: `${largura}x${altura}, ${Math.round(blob.size / 1024)} KB` });
    return { id, largura, altura };
  }

  async function enviar(id) {
    const d = drive();
    if (!d) return false;
    const local = await arm.um(db, 'arquivos', id);
    if (!local) {
      await mudarPendentes((l) => l.filter((x) => x !== id));
      return false;
    }
    try {
      await d.enviarArquivo(caminho(id), local.blob, local.tipo);
      await mudarPendentes((l) => l.filter((x) => x !== id));
      return true;
    } catch (e) {
      registrar('erro', 'texto.imagem_envio', { det: e.message, st: 'aviso' });
      return false;
    }
  }

  /** Imagens guardadas sem internet sobem quando a sincronização volta. */
  async function retomarPendentes() {
    if (!drive()) return;
    for (const id of (await arm.lerMeta(db, PENDENTES)) || []) await enviar(id);
  }

  /** A imagem: deste aparelho ou baixada do Drive (e guardada aqui para a próxima vez). Devolve { blob } ou { erro }. */
  async function obter(id) {
    if (!ID_IMAGEM.test(id)) return { erro: 'Imagem não encontrada.' };
    const local = await arm.um(db, 'arquivos', id);
    if (local) return { blob: local.blob, tipo: local.tipo };
    const d = drive();
    if (!d) return { erro: 'Esta imagem foi guardada em outro aparelho. Entre com o Google para abrir do seu Drive.' };
    try {
      const blob = await d.baixarDoCaminho(caminho(id));
      if (!blob) return { erro: 'Esta imagem ainda não chegou ao seu Drive. Abra o app no aparelho em que ela foi colocada, com internet.' };
      const tipo = id.endsWith('.png') ? 'image/png' : 'image/jpeg';
      await arm.gravar(db, 'arquivos', { id, blob, tipo, tamanho: blob.size, guardadoEm: new Date().toISOString() });
      return { blob, tipo };
    } catch {
      return { erro: 'Não deu para baixar a imagem do Drive agora.' };
    }
  }

  /** Endereço da imagem para mostrar na tela (vale enquanto o app está aberto). */
  async function url(id) {
    if (urls.has(id)) return urls.get(id);
    const r = await obter(id);
    if (!r.blob) return null;
    const u = URL.createObjectURL(r.blob);
    urls.set(id, u);
    return u;
  }

  /** Bytes da imagem para o Word, ou null se ela não está disponível. */
  async function bytes(id) {
    const r = await obter(id);
    return r.blob ? new Uint8Array(await r.blob.arrayBuffer()) : null;
  }

  return { guardar, obter, url, bytes, retomarPendentes, pendentes: async () => (await arm.lerMeta(db, PENDENTES)) || [], erroDe: async (id) => (await obter(id)).erro || null };
}
