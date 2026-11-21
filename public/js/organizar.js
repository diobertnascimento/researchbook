// Organizar a biblioteca: importar muitos arquivos (PDFs e exportações do Zotero), achar o DOI que falta
// e juntar obras repetidas. Nada muda na biblioteca sem o autor aprovar, menos o que ele mandou importar.
//
// DOI que falta: o app procura no Crossref com o título, os autores e o ano. Quando o melhor candidato
// bate muito bem (título, ano e autor), vira proposta "muito provável". Quando fica em dúvida, a IA lê o
// começo do PDF e escolhe entre os candidatos (nunca inventa DOI: só indica um candidato do Crossref).
// As propostas ficam na própria ficha (campo doiBusca), então dá para aprovar no celular ou no computador.
//
// Repetidas: mesmo DOI, mesmo PDF ou mesmo título, ano e autor (idênticas); título quase igual (prováveis).
// Juntar mantém a obra com mais trabalho (grifos, fichamento, etapa), leva o resto para ela e tem desfazer.
import * as arm from './armazenamento.js';
import { procurarPorDados, buscarDOI, limparDOI } from './crossref.js';
import { formatoDe, lerFormato, ligarPDFs, NOMES_FORMATO } from './importar.js';
import { assinatura } from './biblioteca.js';
import { faltas } from './acervo.js';
import { pontuar, compararObras, gruposRepetidos, chaveDoPar, peso, similaridadeTitulo, palavras, MUITO_PROVAVEL, PROVAVEL } from './duplicatas.js';

const CAMPOS_BIB = ['subtitulo', 'ano', 'veiculo', 'volume', 'numero', 'paginas', 'editora', 'local', 'url', 'idioma'];
const ESQ = {
  type: 'object',
  properties: {
    dados: { type: 'object', properties: { titulo: { type: 'string' }, autores: { type: 'array', items: { type: 'object', properties: { sobrenome: { type: 'string' }, prenomes: { type: 'string' } }, required: ['sobrenome'] } }, ano: { type: 'string' } } },
    escolha: { type: 'object', properties: { indice: { type: 'integer' }, confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] }, motivo: { type: 'string' } }, required: ['indice', 'confianca', 'motivo'] },
  },
  required: ['escolha'],
};

/** Título que parece nome de arquivo ("artigo_final_v2", "scan0001"): vale ler o PDF para achar o título de verdade. */
export const tituloFraco = (l) => !l?.titulo || /[_]|\.pdf$|^\s*(scan|doc|artigo|arquivo|file|download)\s*\d*\s*$/i.test(l.titulo) || (l.pdf?.nome && l.titulo === l.pdf.nome.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ')) || palavras(l.titulo).length < 2;

const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Identifica um candidato: o DOI, ou o número dele no OpenAlex quando a obra não tem DOI. */
export const chaveCand = (c) => String(c?.doi || `openalex:${c?.idOpenAlex || c?.titulo || ''}`).toLowerCase();
const NOME_FONTE = { crossref: 'Crossref', openalex: 'OpenAlex' };

export function criarOrganizar({ db, dados, bib, ia, historico, registrar, lerInicio, buscarDOI, fontes = null }) {
  const ouvintes = new Set();
  const avisar = () => ouvintes.forEach((f) => f());
  // etapa: em que passo está a obra de agora ('pdf', 'doi', 'titulo', 'conferir'); feitas: os passos já concluídos
  // e pulados dela, para a tela mostrar o caminho (acervo: busca passo a passo, v2.18.0).
  let busca = { rodando: false, feitos: 0, total: 0, atual: null, etapa: null, feitas: {}, avisoIA: null, avisoFonte: null };
  const passo = (etapa, feitas = {}) => {
    if (!busca.rodando) return;
    busca.etapa = etapa;
    busca.feitas = { ...busca.feitas, ...feitas };
    avisar();
  };

  /* ---------- Importar ---------- */

  /**
   * Lê os arquivos escolhidos (PDFs, exportações do Zotero, a pasta inteira) e monta a prévia.
   * arquivos: File[] (com webkitRelativePath quando veio de uma pasta).
   */
  async function analisar(arquivos, aoProgresso = () => {}) {
    const lista = [...arquivos];
    const info = lista.map((f) => ({ nome: f.name, caminho: f.webkitRelativePath || f.name }));
    const itens = [];
    const formatos = new Set();
    // 1. Arquivos de dados do Zotero.
    for (const f of lista) {
      if (/\.pdf$/i.test(f.name)) continue;
      const inicio = await f.slice(0, 2000).text();
      const formato = formatoDe(f.name, inicio);
      if (!formato) continue;
      formatos.add(NOMES_FORMATO[formato]);
      for (const it of lerFormato(formato, await f.text())) if (it.ficha?.titulo) itens.push({ ...it, origem: `Zotero (${NOMES_FORMATO[formato]})` });
    }
    // 2. Liga os PDFs às fichas; os que sobram entram como PDFs soltos.
    const { ligacoes, soltos } = ligarPDFs(itens, info);
    itens.forEach((it, k) => (it.arquivo = ligacoes[k] >= 0 ? lista[ligacoes[k]] : null));
    for (const i of soltos) itens.push({ ficha: null, arquivo: lista[i], origem: 'PDF', pdfs: [] });
    // 3. PDFs soltos: lê o começo para achar DOI, título e páginas.
    let n = 0;
    const comPDF = itens.filter((it) => it.arquivo);
    for (const it of itens) {
      if (it.arquivo) {
        aoProgresso(`Lendo PDF ${++n} de ${comPDF.length}…`);
        it.sha256 = await assinatura(it.arquivo);
      }
      if (!it.ficha) {
        let inicio = null;
        try {
          inicio = await lerInicio(it.arquivo);
        } catch {}
        const doi = inicio && (inicio.texto.match(/\b(10\.\d{4,9}\/[^\s"<>]+)/) || [])[1]?.replace(/[.,;)\]]+$/, '');
        const nomeLimpo = it.arquivo.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
        const meta = inicio?.titulo && inicio.titulo.length > 8 && !/microsoft|word|untitled|sem t[ií]tulo|\.docx?|\.pdf|^doc\d/i.test(inicio.titulo) ? inicio.titulo : null;
        it.ficha = { tipo: 'artigo', titulo: meta || nomeLimpo, autores: [], tags: [], doi: doi || null, totalPaginas: inicio?.total || null };
        it.lido = !!inicio;
      }
    }
    // 4. Compara com a biblioteca e dentro do próprio lote.
    const existentes = bib.leituras();
    const doLote = []; // itens já aceitos neste envio (novos ou que completam uma obra)
    const comoFicha = (x) => ({ ...x.ficha, pdf: x.sha256 ? { sha256: x.sha256 } : null });
    for (const it of itens) {
      const comparavel = comoFicha(it);
      const noLote = doLote.map((a) => ({ a, c: compararObras(comparavel, comoFicha(a)) })).find((x) => x.c?.tipo === 'identica');
      let igual = null;
      for (const l of existentes) {
        const c = compararObras(comparavel, l);
        if (c && (!igual || (c.tipo === 'identica' && igual.c.tipo !== 'identica'))) igual = { l, c };
      }
      const alvoJaUsado = igual && doLote.some((a) => a.alvoId === igual.l.id);
      if (noLote || alvoJaUsado) {
        Object.assign(it, { status: 'repetida', motivo: `repetida nesta importação (${noLote ? noLote.c.motivo : 'mesma obra'})`, incluir: false });
      } else if (igual?.c.tipo === 'identica') {
        const completa = it.arquivo && !igual.l.pdf;
        Object.assign(it, { status: completa ? 'completa' : 'identica', alvoId: igual.l.id, alvoTitulo: igual.l.titulo, motivo: igual.c.motivo, incluir: completa });
        if (completa) doLote.push(it);
      } else if (igual?.c.tipo === 'provavel') {
        Object.assign(it, { status: 'provavel', alvoId: igual.l.id, alvoTitulo: igual.l.titulo, motivo: igual.c.motivo, incluir: false });
      } else {
        Object.assign(it, { status: 'nova', incluir: true });
        doLote.push(it);
      }
    }
    itens.forEach((it, i) => (it.n = i));
    registrar('ui', 'importar.analisar', { det: `${itens.length} itens; ${[...formatos].join(', ') || 'só PDFs'}; ${itens.filter((i) => i.arquivo).length} PDFs` });
    return { itens, formatos: [...formatos] };
  }

  /** Grava o que foi marcado na prévia. Devolve { criadas, completadas }. As novas sem DOI vão para a procura. */
  async function importar(itens, aoProgresso = () => {}) {
    const marcados = itens.filter((i) => i.incluir);
    const criadas = [];
    let completadas = 0;
    let k = 0;
    for (const it of marcados) {
      aoProgresso(`Importando ${++k} de ${marcados.length}…`, k / marcados.length);
      try {
        if (it.status === 'completa' && it.alvoId) {
          await bib.guardarPDF(it.alvoId, it.arquivo);
          const alvo = bib.obter(it.alvoId);
          const faltando = Object.fromEntries(CAMPOS_BIB.filter((c) => !alvo?.[c] && it.ficha[c]).map((c) => [c, it.ficha[c]]));
          if (!alvo?.doi && it.ficha.doi) faltando.doi = it.ficha.doi;
          if (Object.keys(faltando).length) await bib.atualizar(it.alvoId, faltando);
          completadas++;
          continue;
        }
        let ficha = { ...it.ficha };
        // PDF solto com DOI: os dados vêm do Crossref.
        if (it.origem === 'PDF' && ficha.doi && buscarDOI) {
          const r = await buscarDOI(ficha.doi, { registrar });
          if (r.dados) ficha = { ...ficha, ...Object.fromEntries(Object.entries(r.dados).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length))) };
        }
        ficha.importadaDe = it.origem;
        const id = await bib.adicionar(ficha, it.arquivo || null);
        criadas.push(id);
      } catch (e) {
        registrar('erro', 'importar.item', { det: e.message, st: 'erro' });
      }
    }
    registrar('ui', 'importar.concluir', { det: `${criadas.length} novas, ${completadas} completadas, ${itens.length - marcados.length} puladas` });
    const semDoi = criadas.filter((id) => !bib.obter(id)?.doi);
    if (semDoi.length) procurarDOIs(semDoi);
    avisar();
    return { criadas, completadas, semDoi: semDoi.length };
  }

  /* ---------- DOI que falta ---------- */

  const precisaDeDOI = (l) => !l.doi && (!l.doiBusca || l.doiBusca.status === 'erro');
  const pendentes = () => bib.leituras().filter(precisaDeDOI);
  const ORDEM = { 'muito-provavel': 0, ia: 1, provavel: 2 };
  const propostas = () => bib.leituras().filter((l) => !l.doi && l.doiBusca?.status === 'proposta').sort((a, b) => (ORDEM[a.doiBusca.confianca] ?? 3) - (ORDEM[b.doiBusca.confianca] ?? 3));
  const semResultado = () => bib.leituras().filter((l) => !l.doi && ['sem', 'recusada'].includes(l.doiBusca?.status));

  async function textoDoPDF(l) {
    if (!l.pdf || !lerInicio) return null;
    try {
      const r = await bib.obterPDF(l.id);
      if (!r.blob) return null;
      const inicio = await lerInicio(r.blob, 2);
      return inicio.texto?.trim() ? inicio.texto.slice(0, 6000) : null;
    } catch {
      return null;
    }
  }

  const iaLigada = () => !!ia?.ajustes?.modo?.();

  async function perguntarIA(l, texto, candidatos) {
    const linhaCand = (c, i) => `[${i + 1}] ${c.titulo}${c.subtitulo ? `: ${c.subtitulo}` : ''} — ${(c.autores || []).slice(0, 4).map((a) => a.sobrenome).join('; ') || 'sem autores'} — ${c.ano || 's.d.'} — ${c.veiculo || c.editora || ''}`;
    const r = await ia.gerarTarefa({
      tarefa: 'organizar',
      semAutor: true,
      blocos: [
        `<ficha>\ntitulo: ${l.titulo || ''}\nautores: ${(l.autores || []).map((a) => `${a.sobrenome}, ${a.prenomes}`).join('; ')}\nano: ${l.ano || ''}\nveiculo: ${l.veiculo || ''}\n</ficha>`,
        texto ? (c) => `<pdf>\n<material-${c}>\n${texto}\n</material-${c}>\n</pdf>` : '<pdf>(sem PDF neste aparelho)</pdf>',
        `<candidatos>\n${candidatos.map(linhaCand).join('\n') || '(nenhum)'}\n</candidatos>`,
      ],
      pedido: 'Leia os dados da obra e diga qual candidato do Crossref é a mesma obra (0 se nenhum).',
      lembrete: 'Nunca invente DOI: indique só o número de um candidato, ou 0. Na dúvida, 0. Responda só com o objeto JSON.',
      esquema: ESQ,
    });
    try {
      const h = await historico.nova({ funcao: 'organizar', alvo: { tipo: 'obra', id: l.id }, titulo: 'Busca de DOI' });
      await historico.acrescentar(h.id, { de: 'ia', tarefa: 'organizar', resposta: r.json, modelo: r.modelo, uso: r.uso, custo: r.custo, instrucao: r.instrucao });
    } catch (e) {
      registrar('erro', 'organizar.historico', { det: e.message, st: 'aviso' });
    }
    return r.json || {};
  }

  // O título que a IA diz ter lido no PDF precisa estar no texto do PDF (confere sem IA).
  function lidoNoPDF(dadosIA, texto) {
    if (!dadosIA?.titulo || !texto) return null;
    const ws = palavras(dadosIA.titulo);
    const t = ' ' + palavras(texto).join(' ') + ' ';
    const achadas = ws.filter((w) => t.includes(` ${w} `)).length;
    return ws.length >= 2 && achadas / ws.length >= 0.7 ? dadosIA : null;
  }

  const resumoCand = (c, nota) => ({ ...c, pontos: nota?.total ?? null });

  /** O DOI escrito nas primeiras páginas do PDF (é o primeiro passo do Zotero também), ou null. */
  async function doiNoPDF(l) {
    // Só lê o arquivo que já está neste aparelho: uma procura em lote não pode baixar a biblioteca inteira do Drive.
    if (!lerInicio) return null;
    try {
      const local = await arm.um(db, 'arquivos', l.id);
      if (!local?.blob) return null;
      const inicio = await lerInicio(local.blob, 2);
      // No PDF o DOI às vezes vem quebrado por um espaço depois da barra; o mais comum é vir inteiro.
      return limparDOI(String(inicio.texto || '').slice(0, 8000).replace(/(10\.\d{4,9}\/)\s+/g, '$1'));
    } catch {
      return null;
    }
  }

  /**
   * Procura os dados de uma obra, em passos: ler o DOI no próprio PDF; procurar por esse DOI; sem ele,
   * procurar por título, autor e ano (Crossref e, na dúvida, OpenAlex); conferir. A IA só entra quando o
   * autor pede (comIA).
   */
  async function procurarUma(l, { comIA = false } = {}) {
    let ficha = l;
    const recusadosAntes = new Set(l.doiBusca?.recusados || []);
    passo('pdf');
    const noPDF = l.pdf ? await doiNoPDF(l) : null;
    if (noPDF && !recusadosAntes.has(noPDF.toLowerCase())) {
      passo('doi', { pdf: 'feito' });
      const d = await buscarDOI(noPDF, { registrar });
      if (d.dados?.titulo) {
        passo('conferir', { doi: 'feito', titulo: 'pulado' });
        const c = { ...d.dados, fonte: 'crossref' };
        const nota = pontuar(ficha, c);
        // O DOI está escrito no arquivo: basta o título lembrar o da obra (ou a obra ainda ter nome de arquivo).
        const bate = tituloFraco(l) || nota.titulo >= 0.6;
        return { status: 'proposta', candidato: resumoCand(c, nota), outros: [], confianca: bate ? 'muito-provavel' : 'provavel', noPDF: true, motivo: bate ? 'O DOI está escrito no próprio PDF.' : 'Há um DOI escrito no PDF, mas o título dele é diferente do da obra. Confira.', recusados: [...recusadosAntes], em: new Date().toISOString() };
      }
    }
    passo('titulo', { pdf: noPDF ? 'feito' : l.pdf ? 'feito' : 'pulado', doi: noPDF ? 'feito' : 'pulado' });
    let r = await procurarPorDados(ficha, { registrar });
    if (r.erro) return { status: 'erro', erro: r.erro, em: new Date().toISOString() };
    const recusados = new Set(l.doiBusca?.recusados || []);
    const ordenar = (cands, f) => cands.filter((c) => !recusados.has(chaveCand(c))).map((c) => ({ c, nota: pontuar(f, c) })).sort((a, b) => b.nota.total - a.nota.total);
    const certo = (x) => x && x.nota.total >= MUITO_PROVAVEL && x.nota.titulo >= 0.9;
    const doCrossref = r.candidatos.map((c) => ({ ...c, fonte: 'crossref' }));
    let lista = ordenar(doCrossref, ficha);
    let avisoFonte = null;
    // O Crossref não deu certeza: procura também no OpenAlex (pelo servidor do autor), que cobre anais e
    // trabalhos sem DOI. O que o Crossref já trouxe não entra duas vezes.
    if (!certo(lista[0]) && fontes?.ligado()) {
      const oa = await fontes.procurarNoOpenAlex(ficha);
      if (oa.erro) avisoFonte = oa.erro;
      else {
        const vistos = new Set(doCrossref.map(chaveCand));
        lista = ordenar([...doCrossref, ...oa.candidatos.filter((c) => !vistos.has(chaveCand(c)))], ficha);
      }
    }
    passo('conferir', { titulo: 'feito' });
    const melhor = lista[0];
    if (certo(melhor)) {
      return { status: 'proposta', candidato: resumoCand(melhor.c, melhor.nota), outros: lista.slice(1, 4).map((x) => resumoCand(x.c, x.nota)), confianca: 'muito-provavel', motivo: `Título, ano e autor batem no ${NOME_FONTE[melhor.c.fonte] || 'Crossref'}.`, recusados: [...recusados], avisoFonte, em: new Date().toISOString() };
    }
    let dadosLidos = null;
    let avisoIA = null;
    if (comIA && iaLigada()) {
      try {
        const texto = await textoDoPDF(l);
        let resp = await perguntarIA(l, texto, lista.map((x) => x.c));
        dadosLidos = lidoNoPDF(resp.dados, texto);
        // A IA leu outro título no PDF: procura de novo com ele e pergunta outra vez.
        if (dadosLidos && similaridadeTitulo(dadosLidos.titulo, l.titulo) < 0.6) {
          ficha = { ...l, titulo: dadosLidos.titulo, autores: dadosLidos.autores?.length ? dadosLidos.autores : l.autores, ano: dadosLidos.ano || l.ano };
          const r2 = await procurarPorDados(ficha, { registrar });
          if (!r2.erro) {
            lista = ordenar(r2.candidatos, ficha);
            const m2 = lista[0];
            if (m2 && m2.nota.total >= MUITO_PROVAVEL && m2.nota.titulo >= 0.9)
              return { status: 'proposta', candidato: resumoCand(m2.c, m2.nota), outros: lista.slice(1, 4).map((x) => resumoCand(x.c, x.nota)), confianca: 'ia', motivo: 'A IA leu o título no PDF e ele bate com o Crossref.', dadosLidos, recusados: [...recusados], em: new Date().toISOString() };
            resp = await perguntarIA(ficha, texto, lista.map((x) => x.c));
          }
        }
        const i = Number(resp.escolha?.indice) || 0;
        const escolhido = i >= 1 && i <= lista.length ? lista[i - 1] : null;
        // Confere sem IA: o candidato escolhido precisa lembrar a obra
        // (título parecido, ou o mesmo primeiro autor com ano compatível: cobre título traduzido).
        const lembra = escolhido && (Math.max(similaridadeTitulo(escolhido.c.titulo, l.titulo), similaridadeTitulo(escolhido.c.titulo, ficha.titulo)) >= 0.45 || (escolhido.nota.autor === 1 && escolhido.nota.ano >= 0.5));
        if (lembra) {
          return {
            status: 'proposta',
            candidato: resumoCand(escolhido.c, escolhido.nota),
            outros: lista.filter((x) => x !== escolhido).slice(0, 3).map((x) => resumoCand(x.c, x.nota)),
            confianca: 'ia',
            confiancaIA: resp.escolha.confianca,
            motivo: String(resp.escolha.motivo || '').slice(0, 240) || 'A IA indicou este resultado.',
            dadosLidos,
            recusados: [...recusados],
            em: new Date().toISOString(),
          };
        }
        if (escolhido) registrar('ia', 'organizar.escolha_recusada', { det: 'título do candidato não lembra o da obra', st: 'aviso' });
      } catch (e) {
        avisoIA = e.message;
        registrar('erro', 'organizar.ia', { det: e.message, st: 'aviso' });
      }
    }
    const provavel = lista[0];
    if (provavel && provavel.nota.total >= PROVAVEL && provavel.nota.titulo >= 0.75) {
      return { status: 'proposta', candidato: resumoCand(provavel.c, provavel.nota), outros: lista.slice(1, 4).map((x) => resumoCand(x.c, x.nota)), confianca: 'provavel', motivo: 'O título é parecido; confira autor e ano.', dadosLidos, recusados: [...recusados], avisoIA, avisoFonte, em: new Date().toISOString() };
    }
    return { status: 'sem', outros: lista.slice(0, 3).map((x) => resumoCand(x.c, x.nota)), dadosLidos, recusados: [...recusados], avisoIA, avisoFonte, em: new Date().toISOString() };
  }

  let filaExtra = [];
  /** Procura o DOI das obras indicadas (ou de todas as que faltam), uma por vez, sem travar a tela. */
  // DOIs gravados sozinhos na última procura (título, autor e ano batem com o Crossref), com o desfazer de cada um.
  let gravados = [];
  /**
   * Procura o DOI das obras indicadas (ou de todas as que faltam), uma por vez, sem travar a tela.
   * Resultado muito provável é gravado na hora, com desfazer; o que deixa dúvida espera a decisão do autor.
   */
  function procurarDOIs(ids = null, { comIA = false } = {}) {
    const alvo = (ids ? ids : pendentes().map((l) => l.id)).map((id) => ({ id, comIA }));
    if (busca.rodando) {
      filaExtra.push(...alvo);
      busca.total += alvo.length;
      avisar();
      return busca.promessa;
    }
    busca = { rodando: true, feitos: 0, total: alvo.length, atual: null, etapa: null, feitas: {}, avisoIA: null, avisoFonte: null };
    gravados = [];
    avisar();
    busca.promessa = (async () => {
      const fila = [...alvo];
      while (fila.length || filaExtra.length) {
        if (!fila.length) fila.push(...filaExtra.splice(0));
        const { id, comIA: pedirIAaqui } = fila.shift();
        const l = bib.obter(id);
        if (l && !l.doi) {
          busca.atual = l.titulo;
          busca.atualId = l.id;
          busca.etapa = null;
          busca.feitas = {};
          avisar();
          const t0 = performance.now();
          const res = await procurarUma(l, { comIA: pedirIAaqui });
          if (res.avisoIA && !busca.avisoIA) busca.avisoIA = res.avisoIA;
          if (res.avisoFonte && !busca.avisoFonte) busca.avisoFonte = res.avisoFonte;
          delete res.avisoFonte;
          await bib.atualizar(id, { doiBusca: res });
          if (res.status === 'proposta' && res.confianca === 'muito-provavel') {
            const desfazer = await aceitar(id, chaveCand(res.candidato), { auto: true });
            if (desfazer) gravados.push({ id, titulo: l.titulo, doi: res.candidato.doi || null, fonte: res.candidato.fonte || 'crossref', desfazer });
          }
          registrar('arq', 'organizar.doi', { det: `${res.status}${res.confianca ? `, ${res.confianca}` : ''}`, dur: Math.round(performance.now() - t0) });
          await pausa(250);
        }
        busca.feitos++;
        avisar();
      }
      busca.rodando = false;
      busca.atual = null;
      busca.atualId = null;
      busca.etapa = null;
      avisar();
    })();
    return busca.promessa;
  }

  /**
   * Aceita um candidato: grava o DOI (quando a obra tem) e completa só os campos vazios; o que o autor já
   * tinha fica. Cada campo completado guarda de onde veio (origens), para a ficha poder dizer.
   */
  async function aceitar(id, chave, { auto = false } = {}) {
    const l = bib.obter(id);
    if (!l) return null;
    const b = l.doiBusca || {};
    const c = [b.candidato, ...(b.outros || [])].find((x) => x && chaveCand(x) === String(chave).toLowerCase());
    if (!c) return null;
    const antes = { ...l };
    const fonte = c.fonte || 'crossref';
    const quando = new Date().toISOString();
    // Obra achada sem DOI (OpenAlex): os dados entram e ela fica marcada como obra que não tem DOI.
    const m = c.doi ? { doi: c.doi, doiBusca: { status: 'aceita', doi: c.doi, fonte, em: quando, ...(auto ? { auto: true } : {}) } } : { doiBusca: { status: 'nao-tem', fonte, em: quando, ...(auto ? { auto: true } : {}) } };
    for (const k of CAMPOS_BIB) if (!l[k] && c[k]) m[k] = c[k];
    if (!l.autores?.length && c.autores?.length) m.autores = c.autores;
    if (!l.organizadores?.length && c.organizadores?.length) m.organizadores = c.organizadores;
    if (tituloFraco(l)) Object.assign(m, { titulo: c.titulo, subtitulo: c.subtitulo || null, tipo: c.tipo || l.tipo });
    const completados = Object.keys(m).filter((k) => k !== 'doiBusca');
    m.origens = { ...(l.origens || {}), ...Object.fromEntries(completados.map((k) => [k, fonte])) };
    await bib.atualizar(id, m);
    registrar(auto ? 'arq' : 'ui', 'organizar.aceitar', { det: `${auto ? 'salvo sozinho' : b.confianca || 'manual'}, ${fonte}` });
    avisar();
    return async () => {
      await bib.atualizar(id, { doi: antes.doi || null, doiBusca: antes.doiBusca || null, origens: antes.origens || null, ...Object.fromEntries(completados.filter((k) => k !== 'doi').map((k) => [k, antes[k] ?? null])) });
      avisar();
    };
  }

  /** "Não é esta": passa para o próximo candidato bom, ou deixa a obra em "sem DOI encontrado". */
  async function recusar(id, chave) {
    const l = bib.obter(id);
    if (!l?.doiBusca) return;
    const b = l.doiBusca;
    const recusados = [...new Set([...(b.recusados || []), String(chave).toLowerCase()])];
    const resto = [b.candidato, ...(b.outros || [])].filter((x) => x && !recusados.includes(chaveCand(x)));
    const prox = resto.find((x) => (x.pontos ?? 0) >= PROVAVEL);
    const novo = prox
      ? { ...b, status: 'proposta', candidato: prox, outros: resto.filter((x) => x !== prox), confianca: 'provavel', motivo: 'Outro resultado com título parecido; confira.', recusados }
      : { ...b, status: 'recusada', candidato: null, outros: resto, recusados };
    await bib.atualizar(id, { doiBusca: novo });
    registrar('ui', 'organizar.recusar');
    avisar();
  }

  /** "Nenhuma das duas": recusa de uma vez os resultados mostrados; eles não voltam a ser sugeridos para esta obra. */
  async function recusarVarios(id, chaves) {
    const l = bib.obter(id);
    if (!l?.doiBusca) return null;
    const antes = l.doiBusca;
    for (const c of chaves) await recusar(id, c);
    return async () => {
      await bib.atualizar(id, { doiBusca: antes });
      avisar();
    };
  }

  async function marcarSemDOI(id) {
    await bib.atualizar(id, { doiBusca: { status: 'nao-tem', em: new Date().toISOString() } });
    registrar('ui', 'organizar.sem_doi');
    avisar();
  }

  async function procurarDeNovo(id, opcoes = {}) {
    const l = bib.obter(id);
    await bib.atualizar(id, { doiBusca: { status: 'erro', recusados: l?.doiBusca?.recusados || [] } });
    return procurarDOIs([id], opcoes);
  }
  /** Retrato do acervo: quantas obras têm DOI, quantas não, e quais estão sem PDF. */
  function resumo() {
    const ls = bib.leituras();
    return {
      total: ls.length,
      comDOI: ls.filter((l) => l.doi).length,
      naoTem: ls.filter((l) => !l.doi && l.doiBusca?.status === 'nao-tem').length,
      semDOI: ls.filter((l) => !l.doi && l.doiBusca?.status !== 'nao-tem').length,
      semPDF: ls.filter((l) => !l.pdf),
    };
  }

  // Atualizar pelo DOI: confere no Crossref as obras que já têm DOI e completa só o que está vazio.
  // O que o autor escreveu nunca é trocado; diferença de ano é só informada.
  let atualizacao = null;
  async function atualizarPeloDOI({ so = null } = {}) {
    if (atualizacao?.rodando) return atualizacao;
    const ls = bib.leituras().filter((l) => l.doi && (!so || so.includes(l.id)));
    atualizacao = { rodando: true, feitos: 0, total: ls.length, completadas: [], diferentes: [], falhas: 0 };
    avisar();
    for (const l of ls) {
      const r = await buscarDOI(l.doi, { registrar });
      if (r.erro) atualizacao.falhas++;
      else {
        const c = r.dados;
        const m = {};
        for (const k of CAMPOS_BIB) if (!l[k] && c[k]) m[k] = c[k];
        if (!l.autores?.length && c.autores?.length) m.autores = c.autores;
        if (Object.keys(m).length) {
          const antes = Object.fromEntries([...Object.keys(m), 'origens'].map((k) => [k, l[k] ?? null]));
          await bib.atualizar(l.id, { ...m, origens: { ...(l.origens || {}), ...Object.fromEntries(Object.keys(m).map((k) => [k, 'crossref'])) } });
          atualizacao.completadas.push({ id: l.id, titulo: l.titulo, campos: Object.keys(m), desfazer: () => bib.atualizar(l.id, antes) });
        }
        if (l.ano && c.ano && String(l.ano) !== String(c.ano)) atualizacao.diferentes.push({ id: l.id, titulo: l.titulo, aqui: l.ano, la: c.ano });
      }
      atualizacao.feitos++;
      avisar();
    }
    atualizacao.rodando = false;
    registrar('ui', 'organizar.atualizar_doi', { det: `${atualizacao.completadas.length} de ${ls.length} completadas` });
    avisar();
    return atualizacao;
  }
  async function desfazerAtualizacao() {
    const feitas = atualizacao?.completadas || [];
    for (const c of [...feitas].reverse()) await c.desfazer();
    atualizacao = null;
    avisar();
    return feitas.length;
  }

  /**
   * "Completar os dados" (central do Acervo): procura o DOI das obras que ainda não foram procuradas e,
   * nas que têm DOI e a referência incompleta, busca no Crossref o que falta. Só completa campo vazio.
   */
  const paraCompletar = () => bib.leituras().filter((l) => l.doi && faltas(l).ref.length);
  async function completar() {
    registrar('ui', 'acervo.completar', { det: `${pendentes().length} sem DOI, ${paraCompletar().length} com DOI` });
    if (pendentes().length) await procurarDOIs();
    const ids = paraCompletar().map((l) => l.id);
    if (ids.length) {
      await atualizarPeloDOI({ so: ids });
      // Nada completado e nenhuma diferença: não deixa um aviso vazio na tela.
      if (atualizacao && !atualizacao.completadas.length && !atualizacao.diferentes.length) atualizacao = null;
    }
    avisar();
  }

  /** A pedido do autor, para uma obra: a IA lê o começo do PDF e indica o candidato certo (nunca inventa DOI). */
  const pedirIA = (id) => procurarDeNovo(id, { comIA: true });
  /** Desfaz todos os DOIs gravados sozinhos na última procura. */
  async function desfazerGravados() {
    for (const g of [...gravados].reverse()) await g.desfazer();
    const n = gravados.length;
    gravados = [];
    avisar();
    return n;
  }

  /** Usa título, autores e ano que a IA leu no PDF (conferidos no texto do PDF). */
  async function usarDadosLidos(id) {
    const l = bib.obter(id);
    const d = l?.doiBusca?.dadosLidos;
    if (!d) return null;
    const antes = { titulo: l.titulo, autores: l.autores, ano: l.ano };
    await bib.atualizar(id, { titulo: d.titulo, ...(d.autores?.length ? { autores: d.autores } : {}), ...(d.ano ? { ano: d.ano } : {}), doiBusca: { ...l.doiBusca, dadosLidos: null } });
    registrar('ui', 'organizar.usar_dados_lidos');
    avisar();
    return async () => {
      await bib.atualizar(id, antes);
      avisar();
    };
  }

  /* ---------- Repetidas ---------- */

  async function contexto() {
    const fichs = await dados.listar('fichamentos');
    return { temFich: new Set(fichs.map((f) => f.id)) };
  }

  function repetidas() {
    const ls = bib.leituras();
    const ignorados = ls.flatMap((l) => (l.naoRepetida || []).map((o) => chaveDoPar(l.id, o)));
    return gruposRepetidos(ls, ignorados);
  }

  /** Qual obra do grupo fica: a que tem mais trabalho do autor. */
  async function qualFica(ids) {
    const { temFich } = await contexto();
    const ls = ids.map((id) => bib.obter(id)).filter(Boolean);
    return ls
      .map((l) => ({ l, p: peso(l, { grifos: bib.grifosDe(l.id).length, fichamento: temFich.has(l.id) }) }))
      .sort((a, b) => b.p - a.p || (a.l.adicionadaEm || '').localeCompare(b.l.adicionadaEm || ''))[0]?.l;
  }

  /**
   * Junta as obras do grupo na que fica: grifos, PDF, fichamento, trilhas, cartões, citações nos textos e
   * tudo o que aponta para as outras passa a apontar para ela. Campos vazios são completados. Tem desfazer.
   */
  async function juntar(ids) {
    const fica = await qualFica(ids);
    if (!fica) return { erro: 'Essas obras não estão mais na biblioteca.' };
    const sai = ids.filter((id) => id !== fica.id).map((id) => bib.obter(id)).filter(Boolean);
    const { temFich } = await contexto();
    const comFich = [fica, ...sai].filter((l) => temFich.has(l.id));
    if (comFich.length > 1) return { erro: 'Mais de uma dessas obras tem fichamento. Abra os fichamentos, fique com um e apague o outro; depois junte as obras.' };

    const desfazer = []; // funções que devolvem cada coisa ao estado de antes
    const guardar = async (colecao, item) => {
      const antes = await arm.um(db, colecao, item.id);
      desfazer.push(async () => (antes ? dados.salvar(colecao, { ...antes, apagado: false }) : dados.apagar(colecao, item.id)));
    };
    let novo = { ...fica };
    for (const l of sai) {
      for (const k of CAMPOS_BIB) if (!novo[k] && l[k]) novo[k] = l[k];
      if (!novo.doi && l.doi) novo.doi = l.doi;
      if (!novo.autores?.length && l.autores?.length) novo.autores = l.autores;
      novo.tags = [...new Set([...(novo.tags || []), ...(l.tags || [])])];
      novo.etapa = Math.max(novo.etapa || 0, l.etapa || 0);
      novo.paginaAtual = Math.max(novo.paginaAtual || 0, l.paginaAtual || 0);
      if (!novo.projeto && l.projeto) novo.projeto = l.projeto;
      if (!novo.pdf && l.pdf) {
        const local = await arm.um(db, 'arquivos', l.id);
        if (local) {
          const antesArq = await arm.um(db, 'arquivos', fica.id);
          await arm.gravar(db, 'arquivos', { ...local, id: fica.id });
          desfazer.push(async () => (antesArq ? arm.gravar(db, 'arquivos', antesArq) : arm.removerDe(db, 'arquivos', fica.id)));
        }
        novo.pdf = l.pdf;
      }
    }
    // Tudo o que aponta para as obras que saem passa a apontar para a que fica.
    for (const c of arm.COLECOES) {
      if (c === 'leituras' || c === 'lixeira') continue;
      for (const item of await dados.listar(c)) {
        let json = JSON.stringify(item);
        let mudou = false;
        for (const l of sai) if (json.includes(l.id)) { json = json.split(l.id).join(fica.id); mudou = true; }
        if (!mudou) continue;
        await guardar(c, item);
        const troca = JSON.parse(json);
        if (c === 'fichamentos' && troca.id !== item.id) {
          await dados.salvar(c, troca);
          await dados.apagar(c, item.id);
          desfazer.push(async () => dados.apagar(c, troca.id));
        } else await dados.salvar(c, troca);
      }
    }
    await guardar('leituras', fica);
    await dados.salvar('leituras', novo);
    for (const l of sai) {
      await guardar('leituras', l);
      await dados.apagar('leituras', l.id);
    }
    await bib.carregar();
    registrar('ui', 'organizar.juntar', { det: `${ids.length} obras` });
    avisar();
    return {
      fica: fica.id,
      desfazer: async () => {
        for (const f of desfazer.reverse()) await f();
        await bib.carregar();
        avisar();
      },
    };
  }

  async function naoSaoRepetidas(ids) {
    for (const id of ids) {
      const l = bib.obter(id);
      if (l) await bib.atualizar(id, { naoRepetida: [...new Set([...(l.naoRepetida || []), ...ids.filter((x) => x !== id)])] });
    }
    registrar('ui', 'organizar.nao_repetidas');
    avisar();
  }

  /** Quantas coisas pedem o olhar do autor (para o Hoje e a aba Organizar). */
  const contagem = () => ({ propostas: propostas().length, repetidas: repetidas().length, pendentes: pendentes().length, sem: semResultado().length });

  return {
    analisar,
    importar,
    pendentes,
    propostas,
    semResultado,
    procurarDOIs,
    resumo,
    atualizarPeloDOI,
    completar,
    paraCompletar,
    desfazerAtualizacao,
    estadoAtualizacao: () => atualizacao,
    dispensarAtualizacao: () => {
      atualizacao = null;
      avisar();
    },
    pedirIA,
    gravadosAgora: () => gravados,
    desfazerGravados,
    dispensarGravados: () => {
      gravados = [];
      avisar();
    },
    procurarUma,
    aceitar,
    recusar,
    recusarVarios,
    marcarSemDOI,
    procurarDeNovo,
    usarDadosLidos,
    repetidas,
    qualFica,
    juntar,
    naoSaoRepetidas,
    contagem,
    estadoBusca: () => busca,
    iaLigada,
    fontesLigadas: () => !!fontes?.ligado(),
    aoMudar: (f) => ouvintes.add(f),
  };
}
