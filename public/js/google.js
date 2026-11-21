// Login com Google, sem scripts de terceiros: o app manda para a página de login do Google
// e recebe de volta um token de acesso (fluxo de token para apps sem servidor).
//
// Segurança:
// - "state" aleatório confere que a volta do login foi pedida por este app;
// - o token é conferido no Google (tokeninfo): precisa ter sido emitido para o nosso ID de cliente
//   e precisa incluir a permissão do Drive;
// - o token dura cerca de 1 hora e vale só enquanto esta aba (ou o app instalado) está aberta: fica em
//   sessionStorage, que o navegador apaga ao fechar, e nunca em localStorage (v2.14.2). Ao abrir de novo,
//   o app pede um token novo ao Google em silêncio. "Sair" revoga o token no Google.
// - quem pode entrar é decidido pelo Google: o app está "em teste" e só aceita os usuários de teste.
import { GOOGLE_CLIENT_ID, ESCOPOS, ESCOPO_DRIVE, ESCOPO_IA, ESCOPO_AGENDA } from './config.js';

// Preferência deste aparelho: usar o Gemini pelo login Google (pede a permissão extra no próximo login).
const PREF_IA = 'rb.ia.acesso';

const SESSAO = 'rb.sessao';
const CONTA = 'rb.conta';
// Hora da última tentativa de renovar em silêncio que ainda não deu certo (não é segredo).
const RENOVACAO = 'rb.renovacao.em';
const AUTORIZAR = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKENINFO = 'https://oauth2.googleapis.com/tokeninfo';
const REVOGAR = 'https://oauth2.googleapis.com/revoke';

const ler = (armazem, chave) => {
  try {
    return armazem.getItem(chave);
  } catch {
    return null;
  }
};
const gravar = (armazem, chave, valor) => {
  try {
    valor == null ? armazem.removeItem(chave) : armazem.setItem(chave, valor);
  } catch {}
};

export const configurado = () => !!GOOGLE_CLIENT_ID;

// Se o navegador não deixar gravar em sessionStorage, a sessão fica só na memória desta página.
let naMemoria = null;
const guardarSessao = (s) => {
  naMemoria = s ? JSON.stringify(s) : null;
  gravar(sessionStorage, SESSAO, naMemoria);
};
// Versões até a 2.14.1 guardavam a sessão em localStorage: ela é levada para esta aba e apagada de lá.
{
  const antiga = ler(localStorage, SESSAO);
  if (antiga) {
    if (!ler(sessionStorage, SESSAO)) gravar(sessionStorage, SESSAO, antiga);
    gravar(localStorage, SESSAO, null);
  }
}

export function sessao() {
  try {
    const s = JSON.parse(ler(sessionStorage, SESSAO) || naMemoria || 'null');
    return s && s.expira > Date.now() + 30_000 ? s : null;
  } catch {
    return null;
  }
}

export const conta = () => ler(localStorage, CONTA);

/** Endereço de volta do login: a raiz do app, sem "index.html". Precisa estar autorizado no console. */
export const enderecoDeVolta = () => location.origin + location.pathname.replace(/index\.html$/, '');

/** Como o Gemini é acessado neste aparelho: 'google' (login, sem chave) ou 'cofre' (chave cifrada no Drive). */
export const acessoIA = () => ler(localStorage, PREF_IA);
export const definirAcessoIA = (modo) => gravar(localStorage, PREF_IA, modo);
/** A sessão atual já tem a permissão do Gemini? */
export const temPermissaoIA = () => !!sessao()?.escopos?.includes(ESCOPO_IA);

/** O Google Agenda está ligado neste aparelho? (a permissão só é pedida depois disso) */
export const agendaLigada = () => localStorage.getItem('rb.agenda.ligada') === '1';
export const definirAgenda = (ligar) => (ligar ? localStorage.setItem('rb.agenda.ligada', '1') : localStorage.removeItem('rb.agenda.ligada'));
export const temPermissaoAgenda = () => !!sessao()?.escopos?.includes(ESCOPO_AGENDA);

export function entrar({ registrar, comIA = acessoIA() === 'google', comAgenda = agendaLigada(), silencioso = false }) {
  if (!configurado()) return;
  const estado = crypto.randomUUID();
  gravar(sessionStorage, 'rb.oauth.estado', estado);
  const volta = location.hash && !/(^#|&)(access_token|error)=/.test(location.hash) ? location.hash : '#painel';
  gravar(sessionStorage, 'rb.oauth.volta', volta);
  const p = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: enderecoDeVolta(),
    response_type: 'token',
    scope: [...ESCOPOS, ...(comIA ? [ESCOPO_IA] : []), ...(comAgenda ? [ESCOPO_AGENDA] : [])].join(' '),
    include_granted_scopes: 'true',
    state: estado,
  });
  const dica = conta();
  if (dica) p.set('login_hint', dica);
  // Renovação silenciosa: o Google devolve um token novo sem mostrar nada, se a conta ainda estiver aberta
  // neste navegador; se não estiver, volta com erro e o app segue com a cópia local e o botão "Reconectar".
  if (silencioso) p.set('prompt', 'none');
  gravar(sessionStorage, 'rb.oauth.silencioso', silencioso ? '1' : null);
  registrar('app', silencioso ? 'conta.renovar' : 'conta.entrar', { det: [comIA ? 'com permissão do Gemini' : '', comAgenda ? 'com permissão da agenda' : ''].filter(Boolean).join(', ') });
  location.assign(`${AUTORIZAR}?${p}`);
}

/**
 * Conclui a volta do login. O HTML guarda o retorno do Google em sessionStorage ("rb.oauth")
 * antes de o roteador ler o endereço. Devolve {ok} ou {erro, mensagem}.
 */
export async function concluirRetorno({ registrar }) {
  const bruto = ler(sessionStorage, 'rb.oauth');
  if (!bruto) return null;
  gravar(sessionStorage, 'rb.oauth', null);
  const esperado = ler(sessionStorage, 'rb.oauth.estado');
  gravar(sessionStorage, 'rb.oauth.estado', null);
  const p = new URLSearchParams(bruto);
  const silencioso = ler(sessionStorage, 'rb.oauth.silencioso') === '1';
  gravar(sessionStorage, 'rb.oauth.silencioso', null);
  const falha = (erro, mensagem, det = erro) => {
    registrar('erro', 'conta.login_falhou', { det, st: 'erro' });
    return { erro, mensagem };
  };

  if (p.get('error') && silencioso) {
    // A renovação silenciosa não deu (conta fechada neste navegador): sem mensagem de erro; o app oferece reconectar.
    registrar('app', 'conta.renovar_falhou', { det: p.get('error'), st: 'aviso' });
    return { silencioso: true };
  }
  if (p.get('error')) {
    return p.get('error') === 'access_denied'
      ? falha('negado', 'O login foi cancelado. Para usar o researchbook, entre com a conta autorizada.')
      : falha('google', `O Google não concluiu o login (${p.get('error')}). Tente de novo.`);
  }
  if (!esperado || p.get('state') !== esperado) return falha('estado', 'Este retorno de login não foi pedido por este app. Entre de novo.');

  const token = p.get('access_token');
  const inicio = performance.now();
  let info;
  try {
    const r = await fetch(`${TOKENINFO}?access_token=${encodeURIComponent(token)}`);
    info = await r.json();
    if (!r.ok) return falha('token', 'O Google não confirmou o login. Entre de novo.', info.error_description || r.status);
  } catch (e) {
    return falha('rede', 'Sem internet para confirmar o login. Confira e tente de novo.', e.message);
  }
  if (info.aud !== GOOGLE_CLIENT_ID) return falha('aud', 'Este login não foi emitido para o researchbook. Entre de novo.', 'token de outro app');
  if (!(info.scope || '').split(' ').includes(ESCOPO_DRIVE)) {
    return falha('escopo', 'Para guardar seus dados, marque a permissão do Google Drive na tela do Google e entre de novo.', 'sem drive.file');
  }

  const escopos = (info.scope || '').split(' ').filter(Boolean);
  const s = { token, expira: Date.now() + Number(p.get('expires_in') || info.expires_in || 3600) * 1000, email: info.email || null, escopos };
  guardarSessao(s);
  if (s.email) gravar(localStorage, CONTA, s.email);
  // Deu certo: a próxima abertura do app pode renovar de novo sem esperar.
  gravar(localStorage, RENOVACAO, null);
  registrar('app', 'conta.login_ok', { dur: Math.round(performance.now() - inicio) });
  return { ok: true };
}

export async function sair({ registrar, esquecerConta = false }) {
  const s = sessao();
  guardarSessao(null);
  if (esquecerConta) gravar(localStorage, CONTA, null);
  registrar('app', 'conta.sair');
  if (s) {
    try {
      await fetch(`${REVOGAR}?token=${encodeURIComponent(s.token)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    } catch {}
  }
}

/**
 * Ao abrir o app sem sessão (toda vez que ele é aberto de novo, e também quando a sessão vence com ele aberto),
 * tenta renovar em silêncio. Depois de uma tentativa que não deu certo, espera 10 minutos antes de tentar de
 * novo, para não ficar indo e voltando do Google. Devolve true se mandou para o Google.
 */
export function renovarEmSilencio({ registrar }) {
  if (!configurado() || sessao() || !conta() || !navigator.onLine) return false;
  const ultima = Number(ler(localStorage, RENOVACAO) || 0);
  if (Date.now() - ultima < 10 * 60_000) return false;
  gravar(localStorage, RENOVACAO, String(Date.now()));
  entrar({ registrar, silencioso: true });
  return true;
}

/** Marca a sessão como vencida (ex.: o Drive respondeu 401). */
export function expirar() {
  guardarSessao(null);
}
