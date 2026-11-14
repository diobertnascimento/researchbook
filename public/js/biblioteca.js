// Biblioteca real: obras (coleção "leituras"), grifos e os PDFs.
// Fichas e grifos sincronizam como as outras coleções. O PDF vai para o Drive como arquivo,
// em researchbook/biblioteca/pdfs/<id>.pdf, e fica também guardado no aparelho para ler sem internet.
import * as arm from './armazenamento.js';

const slug = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function criarBiblioteca({ db, dados, registrar, drive }) {
  let leituras = [];
  let grifos = [];
  const ouvintes = new Set();
  const avisar = () => ouvintes.forEach((f) => f());

  async function carregar() {
    if (!db) return;
    leituras = (await dados.listar('leituras')).sort((a, b) => (b.adicionadaEm || '').localeCompare(a.adicionadaEm || ''));
    grifos = await dados.listar('grifos');
    avisar();
  }

  function novoId(f) {
    const quem = slug(f.autores?.[0]?.sobrenome) || slug((f.titulo || 'obra').split(' ').slice(0, 2).join(' '));
    return `${quem}-${f.ano || 'sd'}-${crypto.randomUUID().slice(0, 4)}`;
  }

  async function adicionar(ficha, pdf) {
    const agora = new Date().toISOString();
    const l = {
      tipo: 'artigo',
      autores: [],
      tags: [],
      projeto: null,
      etapa: 0,
      paginaAtual: 0,
      totalPaginas: null,
      ...ficha,
      id: novoId(ficha),
      adicionadaEm: agora,
    };
    await dados.salvar('leituras', l);
    registrar('ui', 'biblioteca.adicionar', { det: `${l.tipo}${l.doi ? ', com DOI' : ''}${pdf ? ', com PDF' : ''}` });
    if (pdf) await guardarPDF(l.id, pdf);
    await carregar();
    return l.id;
  }

  const obter = (id) => leituras.find((l) => l.id === id) || null;

  async function atualizar(id, mudancas) {
    const atual = (await arm.um(db, 'leituras', id)) || obter(id);
    if (!atual) return null;
    const novo = await dados.salvar('leituras', { ...atual, ...mudancas });
    await carregar();
    return novo;
  }

  async function remover(id) {
    const antes = await arm.um(db, 'leituras', id);
    await dados.apagar('leituras', id);
    registrar('ui', 'biblioteca.remover');
    await carregar();
    return async () => {
      // desfazer
      await dados.salvar('leituras', { ...antes, apagado: false });
      await carregar();
    };
  }

  /* ---------- PDF ---------- */

  async function guardarPDF(id, arquivo) {
    const blob = arquivo instanceof Blob ? arquivo : new Blob([arquivo], { type: 'application/pdf' });
    await arm.gravar(db, 'arquivos', { id, blob, tipo: 'application/pdf', tamanho: blob.size, guardadoEm: new Date().toISOString() });
    await atualizar(id, { pdf: { nome: arquivo.name || `${id}.pdf`, tamanho: blob.size, pendente: true } });
    registrar('arq', 'biblioteca.pdf_guardado', { det: `${Math.round(blob.size / 1024)} KB` });
    enviarPendentes();
  }

  let enviando = null;
  function enviarPendentes() {
    const d = drive();
    if (!d || !navigator.onLine) return Promise.resolve(0);
    if (enviando) return enviando;
    enviando = (async () => {
      let n = 0;
      for (const l of leituras.filter((x) => x.pdf?.pendente)) {
        const local = await arm.um(db, 'arquivos', l.id);
        if (!local) continue;
        try {
          const r = await d.enviarArquivo(`biblioteca/pdfs/${l.id}.pdf`, local.blob, 'application/pdf');
          await atualizar(l.id, { pdf: { ...l.pdf, pendente: false, driveId: r.id } });
          n++;
        } catch (e) {
          registrar('erro', 'biblioteca.pdf_envio', { det: e.message, st: 'erro' });
          break;
        }
      }
      return n;
    })().finally(() => (enviando = null));
    return enviando;
  }

  /** Blob do PDF: do aparelho, ou baixado do Drive (e guardado) se veio de outro aparelho. */
  // Um download por obra de cada vez: telas redesenhadas durante o download esperam o mesmo pedido.
  const baixando = new Map();
  function obterPDF(id) {
    if (!baixando.has(id)) baixando.set(id, obterPDFagora(id).finally(() => baixando.delete(id)));
    return baixando.get(id);
  }

  async function obterPDFagora(id) {
    const local = await arm.um(db, 'arquivos', id);
    if (local) return { blob: local.blob };
    const l = obter(id);
    if (!l?.pdf) return { erro: 'Esta obra ainda não tem PDF.' };
    if (!l.pdf.driveId) return { erro: 'O PDF foi adicionado em outro aparelho e ainda não chegou ao Drive. Abra o app naquele aparelho com internet.' };
    const d = drive();
    if (!d) return { erro: 'Para baixar o PDF deste aparelho, entre com o Google.' };
    if (!navigator.onLine) return { erro: 'Sem internet. O PDF ainda não está guardado neste aparelho.' };
    try {
      const blob = await d.baixarArquivo(l.pdf.driveId, `biblioteca/pdfs/${id}.pdf`);
      await arm.gravar(db, 'arquivos', { id, blob, tipo: 'application/pdf', tamanho: blob.size, guardadoEm: new Date().toISOString() });
      return { blob };
    } catch (e) {
      return { erro: e.codigo === 401 ? 'A sessão do Google venceu. Reconecte para baixar o PDF.' : 'Não deu para baixar o PDF do Drive agora. Tente de novo.' };
    }
  }

  /* ---------- Grifos ---------- */

  const grifosDe = (leituraId) => grifos.filter((g) => g.leituraId === leituraId).sort((a, b) => a.pagina - b.pagina || a.rects[0][1] - b.rects[0][1]);

  async function grifar({ leituraId, pagina, texto, rects, funcao }) {
    const g = { id: `g-${crypto.randomUUID().slice(0, 8)}`, leituraId, pagina, texto, rects, funcao, criadoEm: new Date().toISOString() };
    await dados.salvar('grifos', g);
    registrar('ui', 'leitor.grifar', { det: `${funcao}, p. ${pagina}` });
    await carregar();
    return g;
  }

  async function mudarGrifo(id, mudancas) {
    const g = grifos.find((x) => x.id === id);
    if (!g) return;
    await dados.salvar('grifos', { ...g, ...mudancas });
    await carregar();
  }

  async function apagarGrifo(id) {
    const g = grifos.find((x) => x.id === id);
    await dados.apagar('grifos', id);
    registrar('ui', 'leitor.apagar_grifo');
    await carregar();
    return async () => {
      await dados.salvar('grifos', { ...g, apagado: false });
      await carregar();
    };
  }

  return {
    carregar,
    leituras: () => leituras,
    obter,
    adicionar,
    atualizar,
    remover,
    guardarPDF,
    enviarPendentes,
    obterPDF,
    grifosDe,
    todosGrifos: () => grifos,
    grifar,
    mudarGrifo,
    apagarGrifo,
    aoMudar: (f) => ouvintes.add(f),
  };
}
