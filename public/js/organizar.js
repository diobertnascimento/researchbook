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
import { procurarPorDados } from './crossref.js';
import { formatoDe, lerFormato, ligarPDFs, NOMES_FORMATO } from './importar.js';
import { assinatura } from './biblioteca.js';
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

export function criarOrganizar({ db, dados, bib, ia, historico, registrar, lerInicio, buscarDOI }) {
  const ouvintes = new Set();
  const avisar = () => ouvintes.forEach((f) => f());
  let busca = { rodando: false, feitos: 0, total: 0, atual: null, avisoIA: null };

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
        Object.assign(it, { status: 'repetida', motivo: `repetida neste envio (${noLote ? noLote.c.motivo : 'mesma obra'})`, incluir: false });
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
      const h = await historico.nova({ funcao: 'organizar', alvo: { tipo: 'obra', id: l.id }, titulo: 'Procura de DOI' });
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

  async function procurarUma(l) {
    let ficha = l;
    let r = await procurarPorDados(ficha, { registrar });
    if (r.erro) return { status: 'erro', erro: r.erro, em: new Date().toISOString() };
    const recusados = new Set(l.doiBusca?.recusados || []);
    const ordenar = (cands, f) => cands.filter((c) => !recusados.has(c.doi.toLowerCase())).map((c) => ({ c, nota: pontuar(f, c) })).sort((a, b) => b.nota.total - a.nota.total);
    let lista = ordenar(r.candidatos, ficha);
    const melhor = lista[0];
    if (melhor && melhor.nota.total >= MUITO_PROVAVEL && melhor.nota.titulo >= 0.9) {
      return { status: 'proposta', candidato: resumoCand(melhor.c, melhor.nota), outros: lista.slice(1, 4).map((x) => resumoCand(x.c, x.nota)), confianca: 'muito-provavel', motivo: 'Título, ano e autor batem no Crossref.', recusados: [...recusados], em: new Date().toISOString() };
    }
    let dadosLidos = null;
    let avisoIA = null;
    if (iaLigada()) {
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
            motivo: String(resp.escolha.motivo || '').slice(0, 240) || 'A IA indicou este candidato.',
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
      return { status: 'proposta', candidato: resumoCand(provavel.c, provavel.nota), outros: lista.slice(1, 4).map((x) => resumoCand(x.c, x.nota)), confianca: 'provavel', motivo: 'O título é parecido; confira autor e ano.', dadosLidos, recusados: [...recusados], avisoIA, em: new Date().toISOString() };
    }
    return { status: 'sem', outros: lista.slice(0, 3).map((x) => resumoCand(x.c, x.nota)), dadosLidos, recusados: [...recusados], avisoIA, em: new Date().toISOString() };
  }

  let filaExtra = [];
  /** Procura o DOI das obras indicadas (ou de todas as que faltam), uma por vez, sem travar a tela. */
  function procurarDOIs(ids = null) {
    const alvo = ids ? ids : pendentes().map((l) => l.id);
    if (busca.rodando) {
      filaExtra.push(...alvo);
      busca.total += alvo.length;
      avisar();
      return busca.promessa;
    }
    busca = { rodando: true, feitos: 0, total: alvo.length, atual: null, avisoIA: null };
    avisar();
    busca.promessa = (async () => {
      const fila = [...alvo];
      while (fila.length || filaExtra.length) {
        if (!fila.length) fila.push(...filaExtra.splice(0));
        const id = fila.shift();
        const l = bib.obter(id);
        if (l && !l.doi) {
          busca.atual = l.titulo;
          avisar();
          const t0 = performance.now();
          const res = await procurarUma(l);
          if (res.avisoIA && !busca.avisoIA) busca.avisoIA = res.avisoIA;
          await bib.atualizar(id, { doiBusca: res });
          registrar('arq', 'organizar.doi', { det: `${res.status}${res.confianca ? `, ${res.confianca}` : ''}`, dur: Math.round(performance.now() - t0) });
          await pausa(250);
        }
        busca.feitos++;
        avisar();
      }
      busca.rodando = false;
      busca.atual = null;
      avisar();
    })();
    return busca.promessa;
  }

  /** Aceita um candidato: grava o DOI e completa só os campos vazios (o que o autor já tinha fica). */
  async function aceitar(id, doi) {
    const l = bib.obter(id);
    if (!l) return null;
    const b = l.doiBusca || {};
    const c = [b.candidato, ...(b.outros || [])].find((x) => x && x.doi.toLowerCase() === doi.toLowerCase());
    if (!c) return null;
    const antes = { ...l };
    const m = { doi: c.doi, doiBusca: { status: 'aceita', doi: c.doi, em: new Date().toISOString() } };
    for (const k of CAMPOS_BIB) if (!l[k] && c[k]) m[k] = c[k];
    if (!l.autores?.length && c.autores?.length) m.autores = c.autores;
    if (!l.organizadores?.length && c.organizadores?.length) m.organizadores = c.organizadores;
    if (tituloFraco(l)) Object.assign(m, { titulo: c.titulo, subtitulo: c.subtitulo || null, tipo: c.tipo || l.tipo });
    await bib.atualizar(id, m);
    registrar('ui', 'organizar.aceitar', { det: b.confianca || 'manual' });
    avisar();
    return async () => {
      await bib.atualizar(id, { doi: antes.doi || null, doiBusca: antes.doiBusca || null, ...Object.fromEntries(Object.keys(m).filter((k) => !['doi', 'doiBusca'].includes(k)).map((k) => [k, antes[k] ?? null])) });
      avisar();
    };
  }

  /** "Não é esta": passa para o próximo candidato bom, ou deixa a obra em "sem DOI encontrado". */
  async function recusar(id, doi) {
    const l = bib.obter(id);
    if (!l?.doiBusca) return;
    const b = l.doiBusca;
    const recusados = [...new Set([...(b.recusados || []), doi.toLowerCase()])];
    const resto = [b.candidato, ...(b.outros || [])].filter((x) => x && !recusados.includes(x.doi.toLowerCase()));
    const prox = resto.find((x) => (x.pontos ?? 0) >= PROVAVEL);
    const novo = prox
      ? { ...b, status: 'proposta', candidato: prox, outros: resto.filter((x) => x !== prox), confianca: 'provavel', motivo: 'Outro candidato com título parecido; confira.', recusados }
      : { ...b, status: 'recusada', candidato: null, outros: resto, recusados };
    await bib.atualizar(id, { doiBusca: novo });
    registrar('ui', 'organizar.recusar');
    avisar();
  }

  async function marcarSemDOI(id) {
    await bib.atualizar(id, { doiBusca: { status: 'nao-tem', em: new Date().toISOString() } });
    registrar('ui', 'organizar.sem_doi');
    avisar();
  }

  async function procurarDeNovo(id) {
    const l = bib.obter(id);
    await bib.atualizar(id, { doiBusca: { status: 'erro', recusados: l?.doiBusca?.recusados || [] } });
    return procurarDOIs([id]);
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
      if (c === 'leituras') continue;
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
    procurarUma,
    aceitar,
    recusar,
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
    aoMudar: (f) => ouvintes.add(f),
  };
}
