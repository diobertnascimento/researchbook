// Cliente do Gemini (API generateContent), chamado direto do navegador.
//
// Acesso, em ordem de segurança:
// 1. 'google': o token do próprio login Google (dura cerca de 1 hora), com a permissão do Gemini.
//    Nenhuma chave existe no app. A cobrança vai para o projeto do Google Cloud informado em Ajustes.
// 2. 'cofre': a chave do Gemini aberta do cofre cifrado (cofre.js).
//
// Toda chamada gera um registro com tarefa, modelo, nível de pensamento, versão da instrução, tokens
// (entrada, cache, pensamento, saída), tempo, custo estimado, tentativa e modelo reserva. Nunca o texto.
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Preços por milhão de tokens, em US$ (página oficial do Gemini API, conferida em 13/11/2026).
// "ate": data a partir da qual vale o preço "depois". Modelo sem preço aqui: o custo fica em branco no registro.
export const PRECOS = {
  'gemini-4-argon': { entrada: 2.0, saida: 10.0, cache: 0.1, ate: '2026-12-01', depois: { entrada: 4.0, saida: 20.0, cache: 0.2 } },
  'gemini-3.8-flash': { entrada: 0.75, saida: 3.75, cache: 0.075, ate: '2027-01-01', depois: { entrada: 1.5, saida: 7.5, cache: 0.15 } },
  'gemini-3.1-flash-lite': { entrada: 0.25, saida: 1.5, cache: 0.025 },
};

// Modelo e pensamento por tarefa (docs/especificacao.md). O Diobert pode trocar o modelo em Ajustes.
export const TAREFAS = {
  tutor: { modelo: 'gemini-3.8-flash', reserva: 'gemini-3.6-flash', pensamento: 'LOW', instrucao: 'tutor.md', maxSaida: 4096 },
  copilot_conversa: { modelo: 'gemini-3.8-flash', reserva: 'gemini-3.6-flash', pensamento: 'MEDIUM', instrucao: 'copilot.md', maxSaida: 3000 },
  copilot_versoes: { modelo: 'gemini-4-argon', reserva: 'gemini-3.1-pro-preview', pensamento: 'MEDIUM', instrucao: 'copilot.md', maxSaida: 6000 },
  copilot_plano: { modelo: 'gemini-4-argon', reserva: 'gemini-3.1-pro-preview', pensamento: 'HIGH', instrucao: 'copilot.md', maxSaida: 8000 },
  revisao_final: { modelo: 'gemini-4-argon', reserva: 'gemini-3.1-pro-preview', pensamento: 'HIGH', instrucao: 'revisao-final.md', maxSaida: 8000 },
  memoria: { modelo: 'gemini-3.1-flash-lite', reserva: 'gemini-3.5-flash-lite', pensamento: 'MINIMAL', instrucao: 'memoria.md', maxSaida: 2048 },
  teste: { modelo: 'gemini-3.1-flash-lite', reserva: 'gemini-3.5-flash-lite', pensamento: 'MINIMAL', instrucao: null, maxSaida: 256 },
};

export function custoEstimado(modelo, uso, quando = new Date()) {
  const p0 = PRECOS[modelo];
  if (!p0 || !uso) return null;
  const p = p0.ate && quando.toISOString().slice(0, 10) >= p0.ate ? p0.depois : p0;
  const cache = uso.cache || 0;
  const entrada = Math.max(0, (uso.entrada || 0) - cache);
  // Tokens de pensamento são cobrados como saída.
  const usd = (entrada * p.entrada + cache * p.cache + ((uso.saida || 0) + (uso.pensamento || 0)) * p.saida) / 1e6;
  return Math.round(usd * 1e6) / 1e6;
}

/** Erro com um código que a tela transforma em "o que houve e o que fazer". */
export class ErroIA extends Error {
  constructor(codigo, mensagem, detalhe) {
    super(mensagem);
    this.codigo = codigo;
    this.detalhe = detalhe;
  }
}

function explicar(status, corpo) {
  const msg = corpo?.error?.message || '';
  const motivo = corpo?.error?.details?.find?.((d) => d.reason)?.reason || corpo?.error?.status || '';
  if (status === 401) return new ErroIA('sessao', 'O acesso ao Gemini venceu. Reconecte ao Google e tente de novo.', motivo);
  if (status === 403 && /SCOPE|scope/.test(msg + motivo)) return new ErroIA('permissao', 'Falta a permissão do Gemini no login. Em Ajustes, toque em "Conectar o Gemini" e aceite a permissão.', motivo);
  if (status === 403 && /SERVICE_DISABLED|has not been used|disabled/i.test(msg + motivo)) return new ErroIA('api', 'A API do Gemini não está ativada no projeto do Google Cloud. Ative a "Generative Language API" no projeto e tente de novo.', motivo);
  if (status === 403 && /API_KEY|api key/i.test(msg + motivo)) return new ErroIA('chave', 'O Google recusou a chave. Confira se ela está ativa no Google AI Studio ou guarde uma chave nova no cofre.', motivo);
  if (status === 403) return new ErroIA('negado', 'O Google recusou o pedido ao Gemini. Confira em Ajustes o projeto e a permissão.', motivo || msg.slice(0, 120));
  if (status === 429 && /spend|spending|cap|billing/i.test(msg)) return new ErroIA('limite', 'O limite de gasto do mês no Google AI Studio foi atingido. Aumente o limite lá ou espere o próximo mês.', motivo);
  if (status === 429) return new ErroIA('cota', 'Muitos pedidos ao Gemini agora. Espere um minuto e tente de novo.', motivo);
  if (status === 400) return new ErroIA('pedido', 'O Gemini não aceitou o pedido. O problema ficou registrado; tente de novo com um trecho menor.', msg.slice(0, 160));
  return new ErroIA('servico', 'O Gemini não respondeu agora. Tente de novo em instantes.', `${status} ${motivo}`);
}

/**
 * credenciais(): devolve { modo: 'google', token, projeto } ou { modo: 'cofre', chave } ou null.
 * registrar: o mesmo do app (rb.registros.registrar).
 */
export function criarGemini({ credenciais, registrar, espera = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  async function cabecalhos() {
    const c = await credenciais();
    if (!c) throw new ErroIA('sem-acesso', 'O Gemini ainda não está configurado. Em Ajustes > Gemini, escolha como o app acessa o Gemini.');
    const h = { 'Content-Type': 'application/json' };
    if (c.modo === 'google') {
      if (!c.token) throw new ErroIA('sessao', 'O acesso ao Gemini venceu. Reconecte ao Google e tente de novo.');
      if (!c.projeto) throw new ErroIA('projeto', 'Falta o ID do projeto do Google Cloud em Ajustes > Gemini (é onde a cobrança do Gemini é feita).');
      h.Authorization = `Bearer ${c.token}`;
      h['x-goog-user-project'] = c.projeto;
    } else {
      if (!c.chave) throw new ErroIA('trancado', 'O cofre da chave está trancado. Em Ajustes > Gemini, desbloqueie com a sua frase-senha.');
      h['x-goog-api-key'] = c.chave;
    }
    return { h, modo: c.modo };
  }

  /**
   * Gera uma resposta. Com "esquema", pede JSON e devolve o objeto em "json".
   * Tenta o modelo da tarefa até 2 vezes (erros 429/5xx) e depois o modelo reserva uma vez.
   */
  async function gerar({ tarefa, modelo, reserva, pensamento, versaoInstrucao, sistema, conteudos, esquema, maxSaida, sinal }) {
    const corpo = {
      ...(sistema ? { systemInstruction: { parts: [{ text: sistema }] } } : {}),
      contents: conteudos,
      generationConfig: {
        // Temperatura: a padrão do modelo (a documentação do Gemini 3 desaconselha baixar).
        // maxOutputTokens inclui os tokens de pensamento: o limite é folgado de propósito.
        ...(maxSaida ? { maxOutputTokens: maxSaida } : {}),
        ...(pensamento ? { thinkingConfig: { thinkingLevel: pensamento } } : {}),
        ...(esquema ? { responseMimeType: 'application/json', responseJsonSchema: esquema } : {}),
      },
    };
    const planos = [modelo, modelo, ...(reserva ? [reserva] : [])];
    let ultimoErro = null;
    for (let i = 0; i < planos.length; i++) {
      const m = planos[i];
      const inicio = performance.now();
      const { h, modo } = await cabecalhos();
      let r;
      let dados;
      try {
        r = await fetch(`${BASE}/${encodeURIComponent(m)}:generateContent`, { method: 'POST', headers: h, body: JSON.stringify(corpo), signal: sinal });
        dados = await r.json().catch(() => ({}));
      } catch (e) {
        if (e.name === 'AbortError') {
          registrar('ia', 'ia.cancelada', { det: `${tarefa}, ${m}`, dur: Math.round(performance.now() - inicio) });
          throw new ErroIA('cancelado', 'Pedido cancelado.');
        }
        ultimoErro = new ErroIA('rede', 'Sem conexão com o Gemini. Confira a internet e tente de novo.', e.message);
        registrar('ia', 'ia.falhou', { det: `${tarefa}, ${m}, tentativa ${i + 1}, rede`, dur: Math.round(performance.now() - inicio), st: 'aviso' });
        if (i < planos.length - 1) await espera(800 * (i + 1));
        continue;
      }
      const dur = Math.round(performance.now() - inicio);
      if (!r.ok) {
        ultimoErro = explicar(r.status, dados);
        registrar('ia', 'ia.falhou', { det: `${tarefa}, ${m}, tentativa ${i + 1}, ${r.status} ${ultimoErro.codigo}${ultimoErro.detalhe ? ` (${ultimoErro.detalhe})` : ''}`, dur, st: r.status >= 500 || r.status === 429 ? 'aviso' : 'erro' });
        const tentarDeNovo = (r.status === 429 && ultimoErro.codigo === 'cota') || r.status >= 500;
        if (!tentarDeNovo) throw ultimoErro;
        if (i < planos.length - 1) await espera(1000 * (i + 1));
        continue;
      }
      const cand = dados.candidates?.[0];
      const texto = (cand?.content?.parts || []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
      const u = dados.usageMetadata || {};
      const uso = { entrada: u.promptTokenCount || 0, cache: u.cachedContentTokenCount || 0, pensamento: u.thoughtsTokenCount || 0, saida: u.candidatesTokenCount || 0 };
      const custo = custoEstimado(m, uso);
      const fim = cand?.finishReason || 'desconhecido';
      registrar('ia', 'ia.resposta', {
        det: `${tarefa}, ${m}${i >= 2 ? ' (reserva)' : ''}, pensamento ${pensamento || 'padrão'}, instrução ${versaoInstrucao || '-'}, acesso ${modo}, tentativa ${i + 1}, tokens ${uso.entrada}/${uso.cache}/${uso.pensamento}/${uso.saida}, custo ${custo == null ? 'sem preço' : `US$ ${custo.toFixed(6)}`}, fim ${fim}`,
        dur,
        st: fim === 'STOP' ? 'ok' : 'aviso',
      });
      if (fim === 'SAFETY' || fim === 'RECITATION' || (!texto && fim !== 'STOP')) throw new ErroIA('bloqueado', 'O Gemini não devolveu resposta para este pedido. Tente reformular.', fim);
      let json = null;
      if (esquema) {
        try {
          json = JSON.parse(texto);
        } catch {
          throw new ErroIA('formato', 'A resposta do Gemini veio fora do formato esperado. Tente de novo.', 'json inválido');
        }
      }
      return { texto, json, uso, custo, modelo: m, reserva: i >= 2, tentativas: i + 1, dur, fim };
    }
    throw ultimoErro || new ErroIA('servico', 'O Gemini não respondeu agora. Tente de novo em instantes.');
  }

  return { gerar };
}
