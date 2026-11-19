// Dissertação como hábito de escrita (v2.5.0): a tese em uma frase, o plano semanal de sessões, os capítulos
// e as sessões de escrita com hora marcada para acabar. Sem sequência de dias e sem punição: uma semana sem
// sessão não apaga nada. Nada aqui chama a IA.
import { medirAutoria } from './escrita.js';
import { diaLocal } from './progresso.js';

export const PROJETO_DISSERTACAO = 'Dissertação';
export const PLANO_PADRAO = { sessoes: 3, minutos: 25 };
const CHAVE_ATIVA = 'rb.escrita.sessao'; // não confundir com 'rb.sessao', que é a sessão do login Google
const ABANDONO_MS = 3 * 60 * 60 * 1000;

/** Segunda-feira da semana de uma data, como AAAA-MM-DD. */
export function inicioDaSemana(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return diaLocal(x);
}
/** As últimas palavras de um trecho: é por elas que o autor reconhece onde parou. */
export function ultimasPalavras(texto, n = 8) {
  const ps = String(texto || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return ps.slice(-n).join(' ');
}

export function criarSessoes({ dados, escrita, registrar }) {
  let sessoes = [];
  let cfg = { id: 'principal' };

  async function carregar() {
    const [ss, cs] = await Promise.all([dados.listar('sessoes'), dados.listar('dissertacao')]);
    sessoes = ss.sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''));
    cfg = cs.find((c) => c.id === 'principal') || { id: 'principal' };
  }

  const config = () => ({ tese: cfg.tese || '', plano: { ...PLANO_PADRAO, ...(cfg.plano || {}) } });
  async function salvarConfig(mudancas) {
    cfg = await dados.salvar('dissertacao', { ...cfg, ...mudancas, id: 'principal' });
    return config();
  }

  /* ---------- Capítulos: os textos do projeto Dissertação, na ordem que o autor deu ---------- */
  const capitulos = () =>
    escrita
      .todos()
      .filter((t) => t.projeto === PROJETO_DISSERTACAO)
      .sort((a, b) => (a.capitulo || 999) - (b.capitulo || 999) || (a.criadoEm || '').localeCompare(b.criadoEm || ''));
  /** Capítulo novo abre direto no editor, sem o roteiro de preparação com a IA. */
  async function novoCapitulo(titulo) {
    const t = await escrita.novo();
    const n = Math.max(0, ...capitulos().map((c) => c.capitulo || 0)) + 1;
    await escrita.salvar({ ...t, titulo: titulo || `Capítulo ${n}`, tipo: 'Capítulo', projeto: PROJETO_DISSERTACAO, capitulo: n, passo: 4, secoes: [{ id: `s-${crypto.randomUUID().slice(0, 6)}`, titulo: 'Primeira seção', objetivo: '', html: '' }] });
    registrar('ui', 'dissertacao.capitulo');
    return escrita.obter(t.id);
  }

  /* ---------- Sessões ---------- */
  const todas = () => sessoes;
  const daSemana = (hoje = new Date()) => {
    const de = inicioDaSemana(hoje);
    return sessoes.filter((s) => diaLocal(new Date(s.inicio)) >= de).sort((a, b) => a.inicio.localeCompare(b.inicio));
  };
  /** A sessão em curso neste aparelho. Fica no aparelho para sobreviver a uma recarga da página. */
  function ativa() {
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE_ATIVA) || 'null');
      if (!s || !s.textoId || !escrita.obter(s.textoId)) return null;
      // Sessão esquecida aberta (aba fechada no meio) não vira um registro de horas: é largada. O texto já está gravado.
      if (Date.now() - s.inicio > ABANDONO_MS) {
        localStorage.removeItem(CHAVE_ATIVA);
        return null;
      }
      return s;
    } catch {
      return null;
    }
  }
  function iniciar(textoId, minutos) {
    const t = escrita.obter(textoId);
    if (!t) return null;
    const s = { textoId, inicio: Date.now(), minutos: minutos || config().plano.minutos, palavras0: medirAutoria(t).total };
    try {
      localStorage.setItem(CHAVE_ATIVA, JSON.stringify(s));
    } catch {
      return null;
    }
    registrar('ui', 'sessao.iniciar', { det: `${s.minutos} min` });
    return s;
  }
  function largar() {
    try {
      localStorage.removeItem(CHAVE_ATIVA);
    } catch {
      // Sem armazenamento local não há sessão guardada para tirar.
    }
  }
  /** Encerra e grava. Sessão com menos de um minuto e nenhuma palavra não vira registro. */
  async function encerrar({ frase = '', secao = '' } = {}) {
    const s = ativa();
    if (!s) return null;
    largar();
    const t = escrita.obter(s.textoId);
    const minutos = Math.round((Date.now() - s.inicio) / 60000);
    const palavras = medirAutoria(t).total - s.palavras0;
    if (minutos < 1 && palavras <= 0) return { descartada: true, textoId: s.textoId };
    const reg = await dados.salvar('sessoes', { id: `sessao-${crypto.randomUUID().slice(0, 8)}`, textoId: t.id, titulo: t.titulo, capitulo: t.capitulo || null, secao, inicio: new Date(s.inicio).toISOString(), fim: new Date().toISOString(), minutos: Math.max(1, minutos), planejado: s.minutos, palavras, frase });
    registrar('ui', 'sessao.encerrar', { det: `${reg.minutos} min, ${palavras} palavras` });
    await carregar();
    return reg;
  }
  /** Onde continuar: o capítulo da última sessão; sem sessão, o capítulo mexido por último. */
  function ondeParou() {
    const caps = capitulos();
    const ultima = sessoes.find((s) => caps.some((c) => c.id === s.textoId));
    if (ultima) return { texto: caps.find((c) => c.id === ultima.textoId), sessao: ultima };
    const recente = [...caps].sort((a, b) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''))[0];
    return recente ? { texto: recente, sessao: null } : null;
  }

  return { carregar, config, salvarConfig, capitulos, novoCapitulo, todas, daSemana, ativa, iniciar, largar, encerrar, ondeParou };
}
