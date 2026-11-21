// Mudança de endereço do app (v2.15.0): de diobertnascimento.github.io/researchbook para researchbook.com.br.
//
// Por que avisar: para o navegador, endereço diferente é app diferente. O que está guardado no endereço antigo
// (cópia local dos dados, o app instalado) não aparece no novo, e o app guardado no aparelho continuaria abrindo
// no antigo, sem nunca receber versão nova. Os dados não se perdem, porque estão no Drive: no endereço novo,
// basta entrar com o Google. O que ainda não subiu para o Drive é que precisa subir antes.
//
// Este aviso só aparece no endereço antigo, e só depois que o novo estiver respondendo com o app.
import { ENDERECO } from './config.js';

const ENTRE_AVISOS = 30 * 60_000;

export function criarMudanca({ endereco, origem, buscar, aviso, estado, temConta, ir, registrar, agora = () => Date.now() }) {
  let novo = null;
  try {
    novo = endereco ? new URL(endereco) : null;
  } catch {
    novo = null;
  }
  const aqui = !novo || novo.origin === origem;
  let adiadoAte = 0;

  /** O endereço novo já serve o app? (lê o service worker de lá; uma página de erro não passa) */
  async function noAr() {
    const alvo = new URL('sw.js', novo).href;
    try {
      const r = await buscar(alvo, { cache: 'no-store' });
      return r.ok && (await r.text()).includes('researchbook-');
    } catch {
      // Sem permissão para ler a resposta de outro endereço, sobra saber se ele respondeu alguma coisa.
      try {
        await buscar(alvo, { cache: 'no-store', mode: 'no-cors' });
        return true;
      } catch {
        return false;
      }
    }
  }

  async function avaliar() {
    if (aqui || agora() < adiadoAte || !(await noAr())) return null;
    const nome = novo.host;
    const e = estado() || {};
    const depois = { rotulo: 'Depois', ao: () => (adiadoAte = agora() + ENTRE_AVISOS) };
    const abrir = { rotulo: 'Abrir o endereço novo', principal: true, ao: () => (registrar('app', 'app.endereco_novo'), ir(novo.href)) };
    let caso;
    if (!temConta()) caso = { tipo: 'sem-conta', texto: `O researchbook mudou de endereço: ${nome}.`, acoes: [abrir, depois] };
    else if (e.fase === 'ok' && !e.pendente) {
      caso = { tipo: 'pronto', texto: `O researchbook mudou para ${nome}. Tudo deste aparelho já está no seu Drive. Abra o endereço novo e entre com o Google: os seus dados aparecem lá.`, acoes: [abrir, depois] };
    } else {
      const quantas = e.pendentes ? ` (${e.pendentes} ${e.pendentes === 1 ? 'mudança esperando' : 'mudanças esperando'})` : '';
      caso = {
        tipo: 'espere',
        texto: `O researchbook mudou para ${nome}. Antes de ir, este aparelho precisa terminar de enviar tudo para o Drive${quantas}. Entre com o Google, espere aparecer "Sincronizado" e confira de novo.`,
        acoes: [{ rotulo: 'Conferir de novo', principal: true, ao: () => avaliar() }, depois],
      };
    }
    aviso({ id: 'aviso-endereco', texto: caso.texto, acoes: caso.acoes });
    return caso.tipo;
  }

  return { avaliar, antigo: !aqui };
}

export function iniciarMudanca({ registrar, aviso, estado, temConta }) {
  // Em localhost (desenvolvimento e testes) não há endereço antigo.
  if (!ENDERECO || location.hostname === 'localhost') return null;
  const m = criarMudanca({ endereco: ENDERECO, origem: location.origin, buscar: (u, o) => fetch(u, o), aviso, estado, temConta, ir: (u) => location.assign(u), registrar });
  if (!m.antigo) return m;
  // Depois que a sincronização teve tempo de terminar, ao voltar para o app e de tempos em tempos.
  setTimeout(() => m.avaliar(), 6000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && m.avaliar());
  setInterval(() => m.avaliar(), 5 * 60_000);
  return m;
}
