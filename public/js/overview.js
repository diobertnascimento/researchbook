// Overview do autor: como ele escreve, a partir do que ele mesmo escreveu.
// Corpus: os trechos de autoria dele nos textos da Escrita e os textos que ele enviar (.txt, .md, .docx).
// O app calcula as métricas; a IA descreve traços, pontos de atenção e temas, com exemplos conferidos.
// O resumo para o Copilot só entra nos pedidos quando o autor escolhe usar.
// Tudo fica no Drive (autor/): corpus.json, textos/<id>.txt e overview.json.
import * as arm from './armazenamento.js';
import { blocos, autoriaDoBloco, medirAutoria, contarPalavras } from './escrita.js';
import { normalizar } from './contexto.js';

export const CONECTIVOS = ['ou seja', 'por isso', 'portanto', 'assim', 'além disso', 'no entanto', 'contudo', 'de fato', 'na prática', 'em suma', 'dessa forma', 'nesse sentido', 'por outro lado', 'todavia', 'logo', 'isto é', 'ademais'];
const LIMITE_CORPUS = 60000;
const str = { type: 'string' };
const ESQ = {
  type: 'object',
  properties: {
    tracos: { type: 'array', items: { type: 'object', properties: { traco: str, exemplo: str, texto_de_origem: str }, required: ['traco', 'exemplo'] } },
    atencao: { type: 'array', items: { type: 'object', properties: { padrao: str, exemplo: str, onde: str }, required: ['padrao', 'exemplo'] } },
    temas: { type: 'array', items: { type: 'object', properties: { tema: str, textos: { type: 'integer' } }, required: ['tema', 'textos'] } },
    mudancas: { type: 'array', items: str },
    resumo_para_copilot: str,
    aviso: str,
  },
  required: ['tracos', 'atencao', 'temas', 'mudancas', 'resumo_para_copilot', 'aviso'],
};

/** Métricas de estilo, sem IA. paragrafos: lista de strings. */
export function metricas(paragrafos) {
  const ps = paragrafos.map((p) => p.trim()).filter((p) => contarPalavras(p) >= 3);
  const frases = ps.flatMap((p) => p.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú"“(])/).filter((f) => contarPalavras(f) >= 2));
  const palavras = ps.reduce((n, p) => n + contarPalavras(p), 0);
  const passiva = frases.filter((f) => /\b(foi|foram|é|são|era|eram|será|serão|seja|sejam|sido|ser|sendo|fora|estão sendo|está sendo)\s+(\w+[ai]d[oa]s?|feit[oa]s?|vist[oa]s?|dit[oa]s?|post[oa]s?|escrit[oa]s?)\b/i.test(f)).length;
  const citacoes = ps.reduce((n, p) => n + (p.match(/\(([A-ZÀ-Ú][\wÀ-ú-]+(?: et al\.)?(?:;|,| e )[^()]*?\b(1[89]|20)\d{2}[^()]*)\)|\b[A-ZÀ-Ú][a-zà-ú]+ \((1[89]|20)\d{2}/g) || []).length, 0);
  const soPalavras = (x) => normalizar(x).replace(/[^\p{L}\p{N}]+/gu, ' ');
  const texto = ` ${soPalavras(ps.join(' '))} `;
  const conectivos = CONECTIVOS.map((c) => ({ c, n: texto.split(` ${soPalavras(c)} `).length - 1 })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  return {
    palavras,
    paragrafos: ps.length,
    frases: frases.length,
    palavrasPorFrase: frases.length ? Math.round((palavras / frases.length) * 10) / 10 : 0,
    passiva: frases.length ? Math.round((passiva / frases.length) * 100) : 0,
    citacoesPorParagrafo: ps.length ? Math.round((citacoes / ps.length) * 10) / 10 : 0,
    terminamEmPergunta: ps.length ? Math.round((ps.filter((p) => p.endsWith('?')).length / ps.length) * 100) : 0,
    conectivos: conectivos.slice(0, 8),
  };
}

/** Texto de um .docx (zip) lido no próprio navegador. */
export async function textoDoDocx(arquivo) {
  const buf = new Uint8Array(await arquivo.arrayBuffer());
  const dv = new DataView(buf.buffer);
  // Diretório central: acha word/document.xml.
  let fim = buf.length - 22;
  while (fim >= 0 && dv.getUint32(fim, true) !== 0x06054b50) fim--;
  if (fim < 0) throw new Error('O arquivo não parece um .docx.');
  let p = dv.getUint32(fim + 16, true);
  const n = dv.getUint16(fim + 10, true);
  for (let i = 0; i < n; i++) {
    const metodo = dv.getUint16(p + 10, true);
    const tamC = dv.getUint32(p + 20, true);
    const lnome = dv.getUint16(p + 28, true);
    const lextra = dv.getUint16(p + 30, true);
    const lcom = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + lnome));
    if (nome === 'word/document.xml') {
      const ini = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const dados = buf.subarray(ini, ini + tamC);
      let xml;
      if (metodo === 0) xml = new TextDecoder().decode(dados);
      else {
        const s = new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        xml = await new Response(s).text();
      }
      return xml
        .replace(/<w:tab\/>/g, ' ')
        .replace(/<\/w:p>/g, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
    p += 46 + lnome + lextra + lcom;
  }
  throw new Error('Não encontrei o texto dentro do .docx.');
}

export function criarOverview({ db, ia, escrita, drive, registrar }) {
  let corpus = (() => {
    try {
      return JSON.parse(localStorage.getItem('rb.autor.corpus') || 'null') || { arquivos: [], excluir: [] };
    } catch {
      return { arquivos: [], excluir: [] };
    }
  })();
  let atual = (() => {
    try {
      return JSON.parse(localStorage.getItem('rb.autor.overview') || 'null');
    } catch {
      return null;
    }
  })();
  let lidoDoDrive = false;

  const guardarLocal = () => {
    localStorage.setItem('rb.autor.corpus', JSON.stringify(corpus));
    if (atual) localStorage.setItem('rb.autor.overview', JSON.stringify(atual));
  };

  /** Lê corpus e overview do Drive (uma vez por sessão): iguais em todos os aparelhos. */
  async function carregarDoDrive() {
    const d = drive();
    if (!d || lidoDoDrive) return false;
    lidoDoDrive = true;
    try {
      const [c, o] = await Promise.all([d.ler('autor/corpus.json'), d.ler('autor/overview.json')]);
      if (c) corpus = JSON.parse(c);
      if (o) atual = JSON.parse(o);
      guardarLocal();
      return !!(c || o);
    } catch (e) {
      registrar('erro', 'overview.drive', { det: e.message, st: 'aviso' });
      return false;
    }
  }
  async function gravarDrive(caminho, conteudo, tipo) {
    const d = drive();
    if (!d) return;
    try {
      await d.gravar(caminho, conteudo, tipo);
    } catch (e) {
      registrar('erro', 'overview.drive', { det: e.message, st: 'aviso' });
    }
  }

  /** Trechos de autoria do autor nos textos da Escrita. */
  function textosDaEscrita() {
    return escrita
      .todos()
      .filter((t) => !corpus.excluir.includes(t.id))
      .map((t) => {
        const ps = (t.secoes || []).flatMap((s) => blocos(s.html).filter((b) => autoriaDoBloco(b) === 'autor' && b.tag !== 'h3').map((b) => b.texto));
        return { id: t.id, titulo: t.titulo, origem: 'escrita', paragrafos: ps, palavras: ps.reduce((n, p) => n + contarPalavras(p), 0) };
      })
      .filter((t) => t.palavras > 0);
  }
  async function textoArquivo(id) {
    const local = await arm.um(db, 'arquivos', `corpus-${id}`);
    if (local) return local.blob.text();
    const d = drive();
    const txt = d ? await d.ler(`autor/textos/${id}.txt`) : null;
    if (txt) await arm.gravar(db, 'arquivos', { id: `corpus-${id}`, blob: new Blob([txt], { type: 'text/plain' }), tipo: 'text/plain', tamanho: txt.length, guardadoEm: new Date().toISOString() });
    return txt || '';
  }
  async function textos() {
    const enviados = [];
    for (const a of corpus.arquivos.filter((x) => !x.excluido)) {
      const txt = await textoArquivo(a.id);
      const ps = txt.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
      enviados.push({ id: a.id, titulo: a.titulo, origem: 'arquivo', paragrafos: ps, palavras: ps.reduce((n, p) => n + contarPalavras(p), 0) });
    }
    return [...textosDaEscrita(), ...enviados];
  }

  async function adicionar(arquivo) {
    const nome = arquivo.name || 'texto';
    let txt;
    if (/\.docx$/i.test(nome)) txt = await textoDoDocx(arquivo);
    else if (/\.(txt|md)$/i.test(nome) || arquivo.type.startsWith('text/')) txt = await arquivo.text();
    else throw new Error('Envie .docx, .txt ou .md. Para PDF, copie o texto para um .txt.');
    if (contarPalavras(txt) < 20) throw new Error('O arquivo tem pouco texto para entrar no retrato.');
    const id = `txt-${crypto.randomUUID().slice(0, 8)}`;
    await arm.gravar(db, 'arquivos', { id: `corpus-${id}`, blob: new Blob([txt], { type: 'text/plain' }), tipo: 'text/plain', tamanho: txt.length, guardadoEm: new Date().toISOString() });
    corpus.arquivos.push({ id, titulo: nome.replace(/\.(docx|txt|md)$/i, ''), palavras: contarPalavras(txt), em: new Date().toISOString() });
    guardarLocal();
    await gravarDrive(`autor/textos/${id}.txt`, txt, 'text/plain; charset=UTF-8');
    await gravarDrive('autor/corpus.json', JSON.stringify(corpus, null, 1));
    registrar('ui', 'overview.texto_adicionado', { det: `${contarPalavras(txt)} palavras` });
  }
  async function alternar(id, origem) {
    if (origem === 'escrita') corpus.excluir = corpus.excluir.includes(id) ? corpus.excluir.filter((x) => x !== id) : [...corpus.excluir, id];
    else corpus.arquivos = corpus.arquivos.map((a) => (a.id === id ? { ...a, excluido: !a.excluido } : a));
    guardarLocal();
    await gravarDrive('autor/corpus.json', JSON.stringify(corpus, null, 1));
  }

  async function atualizar() {
    const ts = await textos();
    if (!ts.length) throw new Error('Ainda não há textos seus. Escreva na Escrita ou envie um texto.');
    const m = metricas(ts.flatMap((t) => t.paragrafos));
    let usado = 0;
    const partes = [];
    for (const t of ts) {
      const corpo = t.paragrafos.join('\n\n');
      const cabe = corpo.slice(0, Math.max(0, LIMITE_CORPUS - usado));
      if (!cabe) break;
      usado += cabe.length;
      partes.push(`### ${t.titulo}\n${cabe}`);
    }
    const r = await ia.gerarTarefa({
      tarefa: 'overview',
      blocos: [
        (c) => `<textos>\n<material-${c}>\n${partes.join('\n\n')}\n</material-${c}>\n</textos>`,
        `<metricas>\nTextos: ${ts.length}. Palavras: ${m.palavras}. Palavras por frase: ${m.palavrasPorFrase}. Frases na voz passiva: ${m.passiva}%. Citações por parágrafo: ${m.citacoesPorParagrafo}. Parágrafos que terminam em pergunta: ${m.terminamEmPergunta}%. Conectivos mais usados: ${m.conectivos.map((x) => `${x.c} (${x.n})`).join(', ') || 'nenhum'}.\n</metricas>`,
        `<overview_anterior>\n${atual ? `Traços: ${atual.tracos.map((x) => x.traco).join('; ')}. Atenção: ${atual.atencao.map((x) => x.padrao).join('; ')}.` : '(primeiro retrato)'}\n</overview_anterior>`,
      ],
      pedido: 'Descreva como o autor escreve, a partir destes textos.',
      lembrete: 'Exemplos copiados palavra por palavra; nada sobre personalidade. Responda só com o objeto JSON.',
      esquema: ESQ,
    });
    const tudo = normalizar(ts.flatMap((t) => t.paragrafos).join(' '));
    const confere = (x) => x.exemplo && tudo.includes(normalizar(x.exemplo));
    const j = r.json || {};
    const tracos = (j.tracos || []).filter(confere);
    const atencao = (j.atencao || []).filter(confere);
    const descartados = (j.tracos || []).length - tracos.length + (j.atencao || []).length - atencao.length;
    atual = { tracos, atencao, temas: j.temas || [], mudancas: j.mudancas || [], resumo: j.resumo_para_copilot || '', aviso: j.aviso || '', descartados, metricas: m, base: { textos: ts.length, palavras: m.palavras }, usarNoCopilot: atual?.usarNoCopilot || false, em: new Date().toISOString(), modelo: r.modelo };
    guardarLocal();
    await gravarDrive('autor/overview.json', JSON.stringify(atual, null, 1));
    registrar('ia', 'overview.atualizado', { det: `${ts.length} textos, ${m.palavras} palavras, ${tracos.length} traços${descartados ? `, ${descartados} descartados` : ''}` });
    return atual;
  }
  async function usarNoCopilot(sim) {
    if (!atual) return;
    atual = { ...atual, usarNoCopilot: !!sim };
    guardarLocal();
    registrar('ui', sim ? 'overview.usar_copilot' : 'overview.parar_copilot');
    await gravarDrive('autor/overview.json', JSON.stringify(atual, null, 1));
  }

  const participacao = () => escrita.todos().map((t) => ({ t, a: medirAutoria(t) })).filter((x) => x.a.total > 0);

  return {
    carregarDoDrive,
    atual: () => atual,
    corpus: () => corpus,
    textos,
    textosDaEscrita,
    adicionar,
    alternar,
    atualizar,
    usarNoCopilot,
    participacao,
    vozParaCopilot: () => (atual?.usarNoCopilot && atual.resumo ? atual.resumo : ''),
  };
}
