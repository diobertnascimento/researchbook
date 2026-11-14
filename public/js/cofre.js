// Cofre da chave do Gemini: a alternativa ao acesso pelo login Google.
//
// A chave nunca fica legível fora da memória do app:
// - no Drive: researchbook/cofre/gemini.json guarda só a chave CIFRADA (AES-GCM de 256 bits), com uma
//   chave derivada da frase-senha do Diobert (PBKDF2-SHA256, 600 mil iterações, sal aleatório).
//   Quem abrir o arquivo, ou o Drive inteiro, vê só bytes aleatórios. A frase-senha não é guardada em lugar nenhum.
// - no aparelho, se ele pedir "Lembrar neste aparelho": a chave do Gemini é cifrada de novo com uma chave
//   do próprio aparelho, criada como "não exportável" (o navegador não deixa nem o próprio app ler os bytes dela).
//   Um backup do navegador ou uma cópia dos arquivos do aparelho não revela a chave.
// - nunca em localStorage, nunca nos registros, nunca no repositório.
//
// Limite honesto: um código malicioso rodando DENTRO do app conseguiria usar a chave enquanto ele está aberto.
// Por isso o app só carrega código próprio (política de segurança no index.html) e o acesso pelo login Google,
// sem chave nenhuma, é o recomendado.
import * as arm from './armazenamento.js';

const ITERACOES = 600_000; // recomendação da OWASP (2023) para PBKDF2-HMAC-SHA256
const CAMINHO = 'cofre/gemini.json';
const META_APARELHO = 'cofre:chave-do-aparelho';
const META_LOCAL = 'cofre:guardado-aqui';
export const FRASE_MINIMA = 12;

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const texto = new TextEncoder();

async function chaveDaFrase(frase, sal, iteracoes) {
  const base = await crypto.subtle.importKey('raw', texto.encode(frase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteracoes }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Cifra a chave do Gemini com a frase-senha. Devolve o conteúdo do arquivo do Drive. */
export async function cifrar(chaveGemini, frase) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await chaveDaFrase(frase, sal, ITERACOES);
  const dado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: texto.encode('researchbook:gemini:v1') }, k, texto.encode(chaveGemini));
  return { app: 'researchbook', versao: 1, cifra: 'AES-GCM-256', derivacao: 'PBKDF2-SHA256', iteracoes: ITERACOES, sal: b64(sal), iv: b64(iv), dado: b64(dado), criadoEm: new Date().toISOString() };
}

/** Decifra o conteúdo do arquivo. Frase errada ou arquivo alterado: lança erro com codigo 'frase'. */
export async function decifrar(cofre, frase) {
  try {
    const k = await chaveDaFrase(frase, deB64(cofre.sal), cofre.iteracoes);
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(cofre.iv), additionalData: texto.encode('researchbook:gemini:v1') }, k, deB64(cofre.dado));
    return new TextDecoder().decode(claro);
  } catch {
    const e = new Error('Frase-senha errada, ou o arquivo do cofre foi alterado.');
    e.codigo = 'frase';
    throw e;
  }
}

export function criarCofre({ db, drive, registrar }) {
  let naMemoria = null; // a chave aberta, só enquanto o app está aberto

  async function chaveDoAparelho(criar) {
    let k = await arm.lerMeta(db, META_APARELHO);
    if (!k && criar) {
      k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await arm.gravarMeta(db, META_APARELHO, k);
    }
    return k;
  }

  async function lembrarAqui(chaveGemini) {
    const k = await chaveDoAparelho(true);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const dado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, texto.encode(chaveGemini));
    await arm.gravarMeta(db, META_LOCAL, { iv, dado });
  }

  async function lerDoAparelho() {
    const guardado = await arm.lerMeta(db, META_LOCAL);
    const k = guardado && (await chaveDoAparelho(false));
    if (!k) return null;
    try {
      return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: guardado.iv }, k, guardado.dado));
    } catch {
      return null;
    }
  }

  async function noDrive() {
    const d = drive();
    if (!d) return null;
    const t = await d.ler(CAMINHO);
    if (!t) return null;
    try {
      const c = JSON.parse(t);
      return c && c.dado && !c.apagado ? c : null;
    } catch {
      return null;
    }
  }

  return {
    /** 'aberto' (chave disponível), 'trancado' (há cofre, falta a frase) ou 'vazio'. */
    async estado() {
      if (naMemoria || (await lerDoAparelho())) return 'aberto';
      return (await noDrive()) ? 'trancado' : 'vazio';
    },

    async guardar(chaveGemini, frase, { lembrar = false } = {}) {
      const chave = String(chaveGemini || '').trim();
      if (chave.length < 20) throw Object.assign(new Error('Essa chave parece incompleta. Copie a chave inteira no Google AI Studio.'), { codigo: 'chave' });
      if (String(frase || '').length < FRASE_MINIMA) throw Object.assign(new Error(`Use uma frase-senha com pelo menos ${FRASE_MINIMA} caracteres. Várias palavras são mais fáceis de lembrar.`), { codigo: 'frase-curta' });
      const d = drive();
      if (!d) throw Object.assign(new Error('Entre com o Google para guardar o cofre no seu Drive.'), { codigo: 'drive' });
      const inicio = performance.now();
      await d.gravar(CAMINHO, JSON.stringify(await cifrar(chave, frase), null, 1), 'application/json');
      naMemoria = chave;
      if (lembrar) await lembrarAqui(chave);
      registrar('ia', 'cofre.guardar', { det: lembrar ? 'lembrado neste aparelho' : 'só nesta sessão', dur: Math.round(performance.now() - inicio) });
    },

    async desbloquear(frase, { lembrar = false } = {}) {
      const c = await noDrive();
      if (!c) throw Object.assign(new Error('Não há cofre no seu Drive. Guarde a chave primeiro.'), { codigo: 'vazio' });
      const inicio = performance.now();
      try {
        naMemoria = await decifrar(c, frase);
      } catch (e) {
        registrar('ia', 'cofre.frase_errada', { st: 'aviso' });
        throw e;
      }
      if (lembrar) await lembrarAqui(naMemoria);
      registrar('ia', 'cofre.desbloquear', { det: lembrar ? 'lembrado neste aparelho' : 'só nesta sessão', dur: Math.round(performance.now() - inicio) });
    },

    /** A chave aberta, para o cliente do Gemini. Nunca é registrada nem mostrada. */
    async chave() {
      if (!naMemoria) naMemoria = await lerDoAparelho();
      return naMemoria;
    },

    /** Tranca: esquece a chave neste aparelho (o cofre no Drive continua). */
    async trancar() {
      naMemoria = null;
      await arm.gravarMeta(db, META_LOCAL, null);
      registrar('ia', 'cofre.trancar');
    },
  };
}
