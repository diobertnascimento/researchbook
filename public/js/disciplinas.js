// Disciplinas, aulas e agenda local: dados, transcrição das gravações com o Gemini e leitura do plano de ensino.
//
// Onde fica cada coisa:
// - fichas (rb.dados, sincronizadas): disciplinas, aulas, eventos;
// - áudio da aula: no aparelho (store "arquivos", id "aula-<id>") e no Drive (disciplinas/<disc>/aulas/<aula>/);
// - transcrição: no aparelho (store "arquivos", id "transcricao-<id>") e no Drive (…/transcricao.json),
//   porque é grande demais para ir no arquivo de sincronização.
// A transcrição é feita por trechos de 15 minutos, com o progresso salvo a cada trecho: se o app fechar,
// continua de onde parou (no mesmo aparelho, que tem o áudio).
import * as arm from './armazenamento.js';
import { normalizar } from './contexto.js';
import { diaLocal } from './progresso.js';

export const CORES_DISC = ['#7A8B3C', '#B8645A', '#8A6FB0', '#C0902F', '#3F7F9A', '#5C8F4E', '#9A3B26', '#6B6B8F'];
export const TIPOS_EVENTO = { aula: 'Aula', entrega: 'Entrega', estudo: 'Sessão de estudo', orientacao: 'Encontro de orientação', outro: 'Outro' };
export const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
export const TRECHO_S = 15 * 60;
const LIMITE_EM_LINHA = 14 * 1024 * 1024; // abaixo disso o áudio vai junto do pedido, sem a área temporária do Gemini

const ESQ_TRANSCRICAO = {
  type: 'object',
  properties: { segmentos: { type: 'array', items: { type: 'object', properties: { inicio: { type: 'string' }, falante: { type: 'string' }, texto: { type: 'string' } }, required: ['inicio', 'falante', 'texto'] } } },
  required: ['segmentos'],
};
const comTempo = (extra = {}) => ({ type: 'object', properties: { tempo: { type: 'string' }, ...extra }, required: ['tempo', ...Object.keys(extra)] });
const ESQ_RESUMO = {
  type: 'object',
  properties: {
    resumo: { type: 'array', items: comTempo({ texto: { type: 'string' }, trecho: { type: 'string' } }) },
    conceitos: { type: 'array', items: comTempo({ nome: { type: 'string' }, definicao_em_aula: { type: 'string' }, trecho: { type: 'string' } }) },
    leituras: { type: 'array', items: comTempo({ como_foi_dito: { type: 'string' }, id_biblioteca: { type: 'string' }, autor: { type: 'string' }, ano: { type: 'string' }, titulo: { type: 'string' }, o_que_foi_dito: { type: 'string' } }) },
    perguntas: { type: 'array', items: { type: 'string' } },
    combinados: { type: 'array', items: comTempo({ tarefa: { type: 'string' }, prazo: { type: 'string' } }) },
    aviso: { type: 'string' },
  },
  required: ['resumo', 'conceitos', 'leituras', 'perguntas', 'combinados', 'aviso'],
};
const ESQ_PLANO = {
  type: 'object',
  properties: {
    docente: { type: 'string' },
    dia_semana: { type: 'string' },
    inicio: { type: 'string' },
    fim: { type: 'string' },
    aulas: { type: 'array', items: { type: 'object', properties: { data: { type: 'string' }, tema: { type: 'string' }, referencia_no_documento: { type: 'string' } }, required: ['data', 'tema'] } },
    leituras: { type: 'array', items: { type: 'object', properties: { referencia: { type: 'string' }, sobrenome: { type: 'string' }, ano: { type: 'string' }, obrigatoria: { type: 'boolean' } }, required: ['referencia', 'obrigatoria'] } },
    entregas: { type: 'array', items: { type: 'object', properties: { descricao: { type: 'string' }, data: { type: 'string' }, peso: { type: 'string' } }, required: ['descricao', 'data'] } },
    duvidas: { type: 'array', items: { type: 'string' } },
  },
  required: ['aulas', 'leituras', 'entregas', 'duvidas'],
};

/** "1:02:03" ou "62:03" -> segundos. */
export function segundos(t) {
  const p = String(t || '').trim().split(':').map(Number);
  if (p.some((n) => Number.isNaN(n))) return 0;
  return p.reduce((acc, n) => acc * 60 + n, 0);
}
/** segundos -> "MM:SS" ou "H:MM:SS". */
export function relogio(s) {
  s = Math.max(0, Math.round(s || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}
export const duracaoTexto = (s) => {
  if (!s) return '';
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}min` : `${m} min`;
};
const novoId = (p) => `${p}-${crypto.randomUUID().slice(0, 8)}`;
const base64 = (blob) =>
  new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = () => erro(r.error);
    r.readAsDataURL(blob);
  });

/** Duração do áudio em segundos, lida pelo próprio navegador. */
export function duracaoDoAudio(blob) {
  return new Promise((ok) => {
    const a = document.createElement('audio');
    const url = URL.createObjectURL(blob);
    const fim = (v) => {
      URL.revokeObjectURL(url);
      ok(v);
    };
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) return fim(a.duration);
      // Alguns formatos só dizem a duração depois de procurar o fim.
      a.currentTime = 1e7;
      a.ontimeupdate = () => fim(Number.isFinite(a.duration) ? a.duration : null);
    };
    a.onerror = () => fim(null);
    setTimeout(() => fim(null), 15000);
    a.src = url;
  });
}

/** Junta os segmentos de um trecho aos anteriores, sem repetir a fala da emenda. */
export function emendar(anteriores, novos, inicioTrecho) {
  const ultimo = anteriores.at(-1);
  const limite = ultimo ? segundos(ultimo.inicio) : -1;
  const normUlt = ultimo ? normalizar(ultimo.texto) : '';
  const fora = novos.filter((s) => {
    const t = segundos(s.inicio);
    if (t < inicioTrecho - 20 || t <= limite) return false;
    // A mesma fala repetida logo depois da emenda é a que já estava no fim do trecho anterior.
    return !(t < inicioTrecho + 30 && normalizar(s.texto) === normUlt);
  });
  return [...anteriores, ...fora.map((s) => ({ inicio: relogio(segundos(s.inicio)), falante: String(s.falante || 'Voz não identificada').slice(0, 40), texto: String(s.texto || '').trim() }))];
}

/** Ocorrências dos eventos entre duas datas (AAAA-MM-DD), com repetição semanal. */
export function ocorrencias(eventos, de, ate) {
  const saida = [];
  for (const e of eventos) {
    if (!e.data) continue;
    if (e.repetir === 'semanal') {
      const fimRep = e.ate && e.ate < ate ? e.ate : ate;
      let d = new Date(`${e.data}T12:00:00`);
      for (let i = 0; i < 60; i++) {
        const dia = diaLocal(d);
        if (dia > fimRep) break;
        if (dia >= de && !(e.excecoes || []).includes(dia)) saida.push({ ...e, dia });
        d.setDate(d.getDate() + 7);
      }
    } else if (e.data >= de && e.data <= ate) saida.push({ ...e, dia: e.data });
  }
  return saida.sort((a, b) => a.dia.localeCompare(b.dia) || (a.inicio || '99').localeCompare(b.inicio || '99'));
}

/** A obra da biblioteca que corresponde a uma referência (sobrenome do primeiro autor e ano). */
export function obraPorReferencia(leituras, { sobrenome, ano, referencia }) {
  const sob = normalizar(sobrenome || String(referencia || '').split(/[,;.]/)[0]);
  const a = String(ano || String(referencia || '').match(/\b(1[89]|20)\d{2}\b/)?.[0] || '');
  if (!sob || !a) return null;
  return leituras.find((l) => String(l.ano) === a && (l.autores || []).some((x) => normalizar(x.sobrenome) === sob)) || null;
}

export function criarDisciplinas({ db, dados, ia, bib, historico, drive, registrar, aoMudar = () => {} }) {
  let disciplinas = [];
  let aulas = [];
  let eventos = [];
  let encontros = []; // orientação: usa o mesmo motor de gravação e transcrição das aulas
  let aoTranscreverEncontro = null;
  let aoMudarEventos = () => {};
  const transcricoes = new Map(); // aulaId -> segmentos (cache em memória)
  let fila = Promise.resolve();
  const emAndamento = new Set();

  async function carregar() {
    [disciplinas, aulas, eventos, encontros] = await Promise.all([dados.listar('disciplinas'), dados.listar('aulas'), dados.listar('eventos'), dados.listar('encontros')]);
    encontros.sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    disciplinas.sort((a, b) => (a.criadoEm || '').localeCompare(b.criadoEm || ''));
    aulas.sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.numero || 0) - (a.numero || 0));
  }

  /* ---------- Disciplinas ---------- */
  const todas = () => disciplinas;
  const ativas = () => disciplinas.filter((d) => !d.arquivada);
  const obter = (id) => disciplinas.find((d) => d.id === id) || null;

  async function salvar(d) {
    const antes = d.id ? obter(d.id) : null;
    const nova = { anotacoes: [], leiturasPlano: [], paraBuscar: [], arquivada: false, ...d, id: d.id || novoId('disc'), criadoEm: d.criadoEm || new Date().toISOString() };
    if (!nova.cor) nova.cor = CORES_DISC[disciplinas.filter((x) => !x.apagado).length % CORES_DISC.length];
    const salva = await dados.salvar('disciplinas', nova);
    // Renomear a disciplina leva junto as obras e os textos marcados com o nome antigo.
    if (antes && antes.nome !== nova.nome) {
      for (const l of bib.leituras().filter((x) => x.projeto === antes.nome)) await dados.salvar('leituras', { ...l, projeto: nova.nome });
      for (const t of (await dados.listar('textos')).filter((x) => x.projeto === antes.nome)) await dados.salvar('textos', { ...t, projeto: nova.nome });
      await bib.carregar();
      await window.rb?.escrita?.carregar();
    }
    registrar('ui', antes ? 'disciplina.editar' : 'disciplina.criar');
    await carregar();
    return salva;
  }

  /** Apaga a disciplina com as aulas e os eventos dela. Devolve a função de desfazer. */
  async function apagar(id) {
    const d = obter(id);
    const as = aulas.filter((a) => a.disciplinaId === id);
    const evs = eventos.filter((e) => e.disciplinaId === id);
    await dados.apagar('disciplinas', id);
    for (const a of as) await dados.apagar('aulas', a.id);
    for (const e of evs) await dados.apagar('eventos', e.id);
    registrar('ui', 'disciplina.apagar', { det: `${as.length} aulas, ${evs.length} eventos` });
    await carregar();
    aoMudarEventos();
    return async () => {
      await dados.salvar('disciplinas', { ...d, apagado: false });
      for (const a of as) await dados.salvar('aulas', { ...a, apagado: false });
      for (const e of evs) await dados.salvar('eventos', { ...e, apagado: false, google: null });
      registrar('ui', 'disciplina.desfazer_apagar');
      await carregar();
    };
  }

  const leiturasDe = (d) => bib.leituras().filter((l) => l.projeto === d.nome);

  async function anotar(id, texto) {
    const d = obter(id);
    const nota = { id: novoId('nota'), texto: String(texto).trim(), em: new Date().toISOString() };
    await dados.salvar('disciplinas', { ...d, anotacoes: [nota, ...(d.anotacoes || [])] });
    registrar('ui', 'disciplina.anotar');
    await carregar();
    return nota;
  }
  async function apagarAnotacao(id, notaId) {
    const d = obter(id);
    const nota = d.anotacoes.find((n) => n.id === notaId);
    await dados.salvar('disciplinas', { ...d, anotacoes: d.anotacoes.filter((n) => n.id !== notaId) });
    await carregar();
    return async () => {
      const dd = obter(id);
      await dados.salvar('disciplinas', { ...dd, anotacoes: [nota, ...(dd.anotacoes || [])].sort((a, b) => b.em.localeCompare(a.em)) });
      await carregar();
    };
  }
  async function guardarParaBuscar(id, texto, origem) {
    const d = obter(id);
    if ((d.paraBuscar || []).some((p) => normalizar(p.texto) === normalizar(texto))) return false;
    await dados.salvar('disciplinas', { ...d, paraBuscar: [...(d.paraBuscar || []), { id: novoId('busca'), texto, origem }] });
    registrar('ui', 'disciplina.para_buscar');
    await carregar();
    return true;
  }
  async function tirarParaBuscar(id, buscaId) {
    const d = obter(id);
    await dados.salvar('disciplinas', { ...d, paraBuscar: (d.paraBuscar || []).filter((p) => p.id !== buscaId) });
    await carregar();
  }

  /* ---------- Eventos ---------- */
  const eventosDe = (discId) => eventos.filter((e) => !discId || e.disciplinaId === discId);
  function proximos(discId, dias = 120, hoje = new Date()) {
    const de = diaLocal(hoje);
    const fim = new Date(hoje);
    fim.setDate(fim.getDate() + dias);
    return ocorrencias(eventosDe(discId), de, diaLocal(fim));
  }
  async function salvarEvento(e) {
    const novo = { repetir: 'nao', ...e, id: e.id || novoId('ev'), criadoEm: e.criadoEm || new Date().toISOString() };
    await dados.salvar('eventos', novo);
    registrar('ui', e.id ? 'evento.editar' : 'evento.criar', { det: `${novo.tipo}${novo.repetir === 'semanal' ? ', semanal' : ''}` });
    await carregar();
    aoMudarEventos();
    return novo;
  }
  async function apagarEvento(id) {
    const e = eventos.find((x) => x.id === id);
    await dados.apagar('eventos', id);
    registrar('ui', 'evento.apagar');
    await carregar();
    aoMudarEventos();
    return async () => {
      // Volta sem a marca de enviado: na agenda do Google ele já foi apagado e precisa ir de novo.
      await dados.salvar('eventos', { ...e, apagado: false, google: null });
      await carregar();
      aoMudarEventos();
    };
  }

  /* ---------- Aulas ---------- */
  const aulasDe = (discId) => aulas.filter((a) => a.disciplinaId === discId);
  const aula = (id) => aulas.find((a) => a.id === id) || null;

  async function novaAula({ disciplinaId, data, tema }) {
    const n = Math.max(0, ...aulasDe(disciplinaId).map((a) => a.numero || 0)) + 1;
    const a = await dados.salvar('aulas', { id: novoId('aula'), disciplinaId, numero: n, data: data || diaLocal(), tema: tema || '', notas: '', grifos: [], criadoEm: new Date().toISOString() });
    registrar('ui', 'aula.criar');
    await carregar();
    return a;
  }
  async function salvarAula(a) {
    const s = await dados.salvar('aulas', a);
    await carregar();
    return s;
  }
  async function apagarAula(id) {
    const a = aula(id);
    await dados.apagar('aulas', id);
    registrar('ui', 'aula.apagar');
    await carregar();
    return async () => {
      await dados.salvar('aulas', { ...a, apagado: false });
      await carregar();
    };
  }
  const pastaAula = (a) => `disciplinas/${a.disciplinaId}/aulas/${a.id}`;
  // Gravações de aula e de orientação passam pelo mesmo caminho; o prefixo do id diz de onde é.
  const ehEncontro = (id) => String(id).startsWith('enc-');
  const item = (id) => (ehEncontro(id) ? encontros.find((e) => e.id === id) || null : aula(id));
  const salvarItem = async (it) => {
    const s2 = await dados.salvar(ehEncontro(it.id) ? 'encontros' : 'aulas', it);
    await carregar();
    return s2;
  };
  const pasta = (it) => (ehEncontro(it.id) ? `orientacao/${it.id}` : pastaAula(it));

  /** Guarda a gravação no aparelho e no Drive e começa a transcrição. */
  async function guardarAudio(aulaId, arquivo, { transcrever = true } = {}) {
    const a = item(aulaId);
    const tipo = arquivo.type || 'audio/mpeg';
    const duracao = await duracaoDoAudio(arquivo);
    await arm.gravar(db, 'arquivos', { id: `aula-${aulaId}`, blob: arquivo, tipo, tamanho: arquivo.size, guardadoEm: new Date().toISOString() });
    const ext = (arquivo.name || '').split('.').pop() || 'audio';
    await salvarItem({ ...a, audio: { nome: arquivo.name || `aula.${ext}`, tipo, tamanho: arquivo.size, duracao, pendente: true }, transcricao: transcrever ? { status: 'na_fila', feitos: 0, total: Math.max(1, Math.ceil((duracao || TRECHO_S) / TRECHO_S)), aparelho: dados.aparelho } : null });
    registrar('arq', 'aula.audio_guardado', { det: `${Math.round(arquivo.size / 1024 / 1024)} MB, ${duracao ? Math.round(duracao / 60) + ' min' : 'duração desconhecida'}` });
    enviarAudioAoDrive(aulaId);
    if (transcrever) iniciarTranscricao(aulaId);
  }

  async function enviarAudioAoDrive(aulaId) {
    const d = drive();
    const a = item(aulaId);
    if (!d || !a?.audio?.pendente) return;
    const local = await arm.um(db, 'arquivos', `aula-${aulaId}`);
    if (!local) return;
    try {
      const ext = a.audio.nome.split('.').pop();
      const r = await d.enviarArquivo(`${pasta(a)}/audio.${ext}`, local.blob, a.audio.tipo);
      const atual = item(aulaId);
      await salvarItem({ ...atual, audio: { ...atual.audio, pendente: false, driveId: r.id } });
    } catch (e) {
      registrar('erro', 'aula.audio_envio', { det: e.message, st: 'erro' });
    }
  }

  /** Blob do áudio: do aparelho ou baixado do Drive. */
  async function obterAudio(aulaId) {
    const local = await arm.um(db, 'arquivos', `aula-${aulaId}`);
    if (local) return { blob: local.blob };
    const a = item(aulaId);
    if (!a?.audio) return { erro: 'Não há gravação.' };
    if (!a.audio.driveId) return { erro: 'A gravação foi enviada em outro aparelho e ainda não chegou ao Drive.' };
    const d = drive();
    if (!d) return { erro: 'Para ouvir a gravação neste aparelho, entre com o Google.' };
    try {
      const blob = await d.baixarArquivo(a.audio.driveId, 'audio da aula');
      await arm.gravar(db, 'arquivos', { id: `aula-${aulaId}`, blob, tipo: a.audio.tipo, tamanho: blob.size, guardadoEm: new Date().toISOString() });
      return { blob };
    } catch {
      return { erro: 'Não deu para baixar a gravação do Drive agora. Tente de novo.' };
    }
  }

  /** Segmentos da transcrição: memória, aparelho ou Drive. */
  async function transcricao(aulaId) {
    if (transcricoes.has(aulaId)) return transcricoes.get(aulaId);
    const local = await arm.um(db, 'arquivos', `transcricao-${aulaId}`);
    if (local) {
      const segs = JSON.parse(await local.blob.text());
      transcricoes.set(aulaId, segs);
      return segs;
    }
    const a = item(aulaId);
    const d = drive();
    if (!a?.transcricao?.feitos || !d) return [];
    try {
      const txt = await d.ler(`${pasta(a)}/transcricao.json`);
      const segs = txt ? JSON.parse(txt).segmentos || [] : [];
      await guardarTranscricaoLocal(aulaId, segs);
      return segs;
    } catch (e) {
      registrar('erro', 'aula.transcricao_baixar', { det: e.message, st: 'aviso' });
      return [];
    }
  }
  async function guardarTranscricaoLocal(aulaId, segs) {
    transcricoes.set(aulaId, segs);
    await arm.gravar(db, 'arquivos', { id: `transcricao-${aulaId}`, blob: new Blob([JSON.stringify(segs)], { type: 'application/json' }), tipo: 'application/json', tamanho: 0, guardadoEm: new Date().toISOString() });
  }
  async function gravarTranscricaoDrive(a, segs) {
    const d = drive();
    if (!d) return;
    try {
      await d.gravar(`${pasta(a)}/transcricao.json`, JSON.stringify({ id: a.id, disciplina: a.disciplinaId || null, segmentos: segs }, null, 1));
      const legivel = segs.map((s) => `[${s.inicio}] ${s.falante}: ${s.texto}`).join('\n');
      await d.gravar(`${pasta(a)}/transcricao.txt`, legivel, 'text/plain; charset=UTF-8');
    } catch (e) {
      registrar('erro', 'aula.transcricao_drive', { det: e.message, st: 'aviso' });
    }
  }

  function iniciarTranscricao(aulaId) {
    if (emAndamento.has(aulaId)) return fila;
    emAndamento.add(aulaId);
    fila = fila.then(() => transcrever(aulaId)).catch(() => {}).finally(() => emAndamento.delete(aulaId));
    return fila;
  }

  async function atualizarTranscricao(aulaId, mudancas) {
    const a = item(aulaId);
    const s = await salvarItem({ ...a, transcricao: { ...(a.transcricao || {}), ...mudancas } });
    aoMudar(aulaId);
    return s;
  }

  async function transcrever(aulaId) {
    let a = item(aulaId);
    if (!a?.audio) return;
    const enc = ehEncontro(aulaId);
    const disc = enc ? { nome: 'Dissertação (reunião de orientação)' } : obter(a.disciplinaId);
    const audio = await obterAudio(aulaId);
    if (audio.erro) return atualizarTranscricao(aulaId, { status: 'erro', erro: audio.erro });
    const inicio = performance.now();
    try {
      const dur = a.audio.duracao || TRECHO_S;
      const total = Math.max(1, Math.ceil(dur / TRECHO_S));
      let t = a.transcricao || {};
      await atualizarTranscricao(aulaId, { status: 'transcrevendo', total, feitos: t.feitos || 0, erro: null, aparelho: dados.aparelho });
      // O áudio: junto do pedido (pequeno) ou na área temporária do Gemini (válida por 48 horas).
      let parte;
      if (audio.blob.size <= LIMITE_EM_LINHA) {
        parte = { inlineData: { mimeType: a.audio.tipo, data: await base64(audio.blob) } };
      } else {
        let arq = t.arquivoIA;
        if (!arq || new Date(arq.expira) < new Date(Date.now() + 30 * 60 * 1000)) {
          await atualizarTranscricao(aulaId, { status: 'enviando' });
          arq = await ia.enviarArquivo(audio.blob, { nome: `aula-${aulaId}`, tipo: a.audio.tipo });
          await atualizarTranscricao(aulaId, { status: 'transcrevendo', arquivoIA: arq });
        }
        parte = { fileData: { mimeType: arq.tipo, fileUri: arq.uri } };
      }
      let segs = (t.feitos || 0) > 0 ? await transcricao(aulaId) : [];
      for (let i = t.feitos || 0; i < total; i++) {
        const de = i * TRECHO_S;
        const ate = Math.min((i + 1) * TRECHO_S, dur);
        const r = await ia.gerarTarefa({
          tarefa: 'transcricao',
          semAutor: true,
          partes: [parte],
          blocos: [(c) => `<aula>\n<material-${c}>\n${enc ? 'Reunião de orientação de mestrado: "Docente" é quem orienta; o autor da pesquisa é "Participante 1".' : `Disciplina: ${disc?.nome || ''}`}\nTema previsto: ${a.tema || a.titulo || '(não informado)'}\n</material-${c}>\n</aula>`, `<trecho>\ninicio: ${relogio(de)}\nfim: ${relogio(ate)}\n</trecho>`],
          pedido: `Transcreva o áudio de ${relogio(de)} a ${relogio(ate)}. Parte ${i + 1} de ${total}.`,
          lembrete: 'Só o intervalo pedido, palavra por palavra, com o tempo desde o começo da gravação. Responda só com o objeto JSON.',
          esquema: ESQ_TRANSCRICAO,
        });
        segs = emendar(segs, r.json?.segmentos || [], de);
        await guardarTranscricaoLocal(aulaId, segs);
        a = item(aulaId);
        await atualizarTranscricao(aulaId, { feitos: i + 1, segmentos: segs.length });
        registrar('ia', 'aula.trecho_transcrito', { det: `parte ${i + 1} de ${total}, ${(r.json?.segmentos || []).length} falas` });
      }
      await gravarTranscricaoDrive(item(aulaId), segs);
      await atualizarTranscricao(aulaId, { status: 'resumindo' });
      if (enc) await aoTranscreverEncontro?.(aulaId, segs);
      else await resumir(aulaId);
      await atualizarTranscricao(aulaId, { status: 'pronta', arquivoIA: null });
      registrar('ia', 'aula.transcrita', { det: `${segs.length} falas, ${Math.round(dur / 60)} min de áudio`, dur: Math.round(performance.now() - inicio) });
    } catch (err) {
      registrar('erro', 'aula.transcricao_falhou', { det: `${err.codigo || ''} ${err.message}`.trim(), st: 'erro' });
      await atualizarTranscricao(aulaId, { status: 'erro', erro: err.message, codigoErro: err.codigo || null });
    }
  }

  /** Resumo, conceitos, leituras citadas, perguntas e combinados, com cada trecho conferido na transcrição. */
  async function resumir(aulaId) {
    const a = aula(aulaId);
    const disc = obter(a.disciplinaId);
    const segs = await transcricao(aulaId);
    if (!segs.length) return null;
    const obras = bib.leituras().slice(0, 300).map((l, i) => ({ id: `B${i + 1}`, l }));
    const r = await ia.gerarTarefa({
      tarefa: 'aula_resumo',
      blocos: [
        (c) => `<aula>\n<material-${c}>\nDisciplina: ${disc?.nome || ''}\nAula ${a.numero}, ${a.data}\nTema previsto: ${a.tema || '(não informado)'}\n</material-${c}>\n</aula>`,
        (c) => `<transcricao>\n<material-${c}>\n${segs.map((s) => `[${s.inicio}] ${s.falante}: ${s.texto}`).join('\n')}\n</material-${c}>\n</transcricao>`,
        `<biblioteca>\n${obras.map(({ id, l }) => `${id}: ${(l.autores || []).map((x) => x.sobrenome).join('; ')} (${l.ano || 's.d.'}). ${l.titulo}`).join('\n') || '(vazia)'}\n</biblioteca>`,
      ],
      pedido: 'Organize esta aula para estudo: resumo, conceitos, leituras citadas, perguntas para estudar e combinados.',
      lembrete: 'Só o que foi dito. Todo trecho copiado palavra por palavra da transcrição. Responda só com o objeto JSON.',
      esquema: ESQ_RESUMO,
    });
    const tudo = normalizar(segs.map((s) => s.texto).join(' '));
    const confere = (x) => !x.trecho || tudo.includes(normalizar(x.trecho));
    const j = r.json || {};
    const resumo = (j.resumo || []).filter(confere);
    const conceitos = (j.conceitos || []).filter(confere);
    const porB = new Map(obras.map(({ id, l }) => [id, l]));
    const leituras = (j.leituras || []).map((x) => {
      const l = porB.get(x.id_biblioteca) || obraPorReferencia(bib.leituras(), { sobrenome: x.autor, ano: x.ano, referencia: x.como_foi_dito });
      return { ...x, leituraId: l?.id || null };
    });
    const descartados = (j.resumo || []).length - resumo.length + (j.conceitos || []).length - conceitos.length;
    const atual = aula(aulaId);
    await salvarAula({ ...atual, resumo: { resumo, conceitos, leituras, perguntas: j.perguntas || [], combinados: j.combinados || [], aviso: j.aviso || '', descartados, modelo: r.modelo, em: new Date().toISOString() } });
    registrar('ia', 'aula.resumo', { det: `${resumo.length} pontos, ${conceitos.length} conceitos, ${leituras.length} leituras${descartados ? `, ${descartados} descartados na conferência` : ''}` });
    if (historico) {
      try {
        const c = await historico.nova({ funcao: 'aula', alvo: { tipo: 'aula', id: aulaId, titulo: `Aula ${a.numero}${a.tema ? `: ${a.tema}` : ''}` } });
        await historico.acrescentar(c.id, { de: 'ia', tarefa: 'aula_resumo', resposta: j, modelo: r.modelo, uso: r.uso, custo: r.custo, instrucao: r.instrucao });
      } catch (e) {
        registrar('erro', 'aula.historico', { det: e.message, st: 'aviso' });
      }
    }
    return atual;
  }

  /** Continua, neste aparelho, as transcrições que pararam no meio. */
  async function retomarPendentes() {
    const eu = dados.aparelho;
    for (const a of [...aulas, ...encontros].filter((x) => ['na_fila', 'enviando', 'transcrevendo', 'resumindo'].includes(x.transcricao?.status) && x.transcricao.aparelho === eu)) {
      if (await arm.um(db, 'arquivos', `aula-${a.id}`)) iniciarTranscricao(a.id);
    }
    for (const a of [...aulas, ...encontros].filter((x) => x.audio?.pendente)) enviarAudioAoDrive(a.id);
  }

  async function grifar(aulaId, grifo) {
    const a = aula(aulaId);
    const g = { id: novoId('g'), ...grifo, criadoEm: new Date().toISOString() };
    await salvarAula({ ...a, grifos: [...(a.grifos || []), g] });
    registrar('ui', 'aula.grifar', { det: grifo.funcao });
    return g;
  }
  async function tirarGrifo(aulaId, grifoId) {
    const a = aula(aulaId);
    const g = (a.grifos || []).find((x) => x.id === grifoId);
    await salvarAula({ ...a, grifos: (a.grifos || []).filter((x) => x.id !== grifoId) });
    return async () => {
      const aa = aula(aulaId);
      await salvarAula({ ...aa, grifos: [...(aa.grifos || []), g] });
    };
  }

  /* ---------- Plano de ensino ---------- */
  async function lerPlano(arquivo, { nome, semestre }) {
    if (arquivo.size > LIMITE_EM_LINHA) throw new Error('O PDF passa de 14 MB. Envie só as páginas do cronograma e das leituras.');
    const r = await ia.gerarTarefa({
      tarefa: 'plano_ensino',
      semAutor: true,
      partes: [{ inlineData: { mimeType: 'application/pdf', data: await base64(arquivo) } }],
      blocos: [`<contexto>\nDisciplina: ${nome}\nSemestre: ${semestre || '(não informado)'}\nHoje: ${diaLocal()}\n</contexto>`],
      pedido: 'Extraia do plano de ensino em PDF as aulas, as leituras e as entregas.',
      lembrete: 'Copie como está no documento; o que não estiver escrito fica em branco. Responda só com o objeto JSON.',
      esquema: ESQ_PLANO,
    });
    registrar('ia', 'disciplina.plano_lido', { det: `${(r.json.aulas || []).length} aulas, ${(r.json.leituras || []).length} leituras, ${(r.json.entregas || []).length} entregas` });
    const leituras = (r.json.leituras || []).map((l) => ({ ...l, leituraId: obraPorReferencia(bib.leituras(), l)?.id || null }));
    return { ...r.json, leituras };
  }

  /** Salva o que o autor marcou do plano: eventos de aula e entrega, lista de leituras e, se pedir, uma trilha. */
  async function aplicarPlano(discId, plano, { aulas: aulasSel = [], entregas: entSel = [], leituras: leitSel = [], trilha = false, arquivo = null }) {
    const d = obter(discId);
    // A aula do plano (com tema) substitui, naquele dia, a aula semanal genérica.
    const datas = aulasSel.map((i) => plano.aulas[i]?.data).filter(Boolean);
    for (const e of eventos.filter((x) => x.disciplinaId === discId && x.tipo === 'aula' && x.repetir === 'semanal')) {
      const caem = ocorrencias([e], [...datas].sort()[0] || '0000', '9999-12-31').map((o) => o.dia).filter((dia) => datas.includes(dia));
      if (caem.length) await dados.salvar('eventos', { ...e, excecoes: [...new Set([...(e.excecoes || []), ...caem])] });
    }
    for (const i of aulasSel) {
      const x = plano.aulas[i];
      if (!x?.data) continue;
      await dados.salvar('eventos', { id: novoId('ev'), disciplinaId: discId, tipo: 'aula', titulo: x.tema || 'Aula', data: x.data, inicio: plano.inicio || d.inicio || '', fim: plano.fim || d.fim || '', repetir: 'nao', origem: 'plano de ensino', criadoEm: new Date().toISOString() });
    }
    for (const i of entSel) {
      const x = plano.entregas[i];
      if (!x?.data) continue;
      await dados.salvar('eventos', { id: novoId('ev'), disciplinaId: discId, tipo: 'entrega', titulo: x.descricao, data: x.data, inicio: '23:59', fim: '', repetir: 'nao', origem: 'plano de ensino', peso: x.peso || '', criadoEm: new Date().toISOString() });
    }
    const leits = leitSel.map((i) => plano.leituras[i]).filter(Boolean).map((l) => ({ id: novoId('lp'), referencia: l.referencia, sobrenome: l.sobrenome || '', ano: l.ano || '', obrigatoria: !!l.obrigatoria, leituraId: l.leituraId || null }));
    let plan = d.plano || null;
    if (arquivo && drive()) {
      try {
        const r = await drive().enviarArquivo(`disciplinas/${discId}/plano-de-ensino.pdf`, arquivo, 'application/pdf');
        plan = { nome: arquivo.name, driveId: r.id };
      } catch (e) {
        registrar('erro', 'disciplina.plano_drive', { det: e.message, st: 'aviso' });
      }
    }
    await dados.salvar('disciplinas', { ...d, docente: d.docente || plano.docente || '', dia_semana: d.dia_semana || plano.dia_semana || '', inicio: d.inicio || plano.inicio || '', fim: d.fim || plano.fim || '', leiturasPlano: [...(d.leiturasPlano || []), ...leits], plano: plan });
    if (trilha) {
      const itens = leits.filter((l) => l.obrigatoria && l.leituraId).map((l) => l.leituraId);
      if (itens.length) {
        const prazo = plano.entregas.map((e) => e.data).filter(Boolean).sort()[0] || null;
        await dados.salvar('trilhas', { id: `trilha-${crypto.randomUUID().slice(0, 8)}`, nome: `Leituras de ${d.nome}`, itens, prazo, criadoEm: new Date().toISOString() });
        await window.rb?.trilhasUI?.carregar();
      }
    }
    registrar('ui', 'disciplina.plano_aplicado', { det: `${aulasSel.length} aulas, ${entSel.length} entregas, ${leits.length} leituras${trilha ? ', trilha' : ''}` });
    await carregar();
  }

  /** Liga uma leitura do plano a uma obra da biblioteca (quando o autor adiciona a obra depois). */
  async function religarLeiturasPlano() {
    for (const d of disciplinas) {
      let mudou = false;
      const lp = (d.leiturasPlano || []).map((l) => {
        if (l.leituraId) return l;
        const o = obraPorReferencia(bib.leituras(), l);
        if (!o) return l;
        mudou = true;
        return { ...l, leituraId: o.id };
      });
      if (mudou) await dados.salvar('disciplinas', { ...d, leiturasPlano: lp });
    }
    await carregar();
  }

  return {
    carregar,
    todas,
    ativas,
    obter,
    salvar,
    apagar,
    leiturasDe,
    anotar,
    apagarAnotacao,
    guardarParaBuscar,
    tirarParaBuscar,
    eventosDe,
    proximos,
    salvarEvento,
    apagarEvento,
    aulasDe,
    aula,
    novaAula,
    salvarAula,
    apagarAula,
    guardarAudio,
    obterAudio,
    transcricao,
    iniciarTranscricao,
    resumir,
    retomarPendentes,
    grifar,
    tirarGrifo,
    lerPlano,
    aplicarPlano,
    religarLeiturasPlano,
    emAndamento: (id) => emAndamento.has(id),
    // Orientação (a tela e a IA ficam em dissertacao.js).
    encontros: () => encontros,
    encontro: (id) => encontros.find((e) => e.id === id) || null,
    salvarItem,
    aoTranscreverEncontro: (fn) => (aoTranscreverEncontro = fn),
    aoMudarEventos: (fn) => (aoMudarEventos = fn),
  };
}
