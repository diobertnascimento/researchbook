// Login com Google, sem scripts de terceiros: o app manda para a página de login do Google
// e recebe de volta um token de acesso (fluxo de token para apps sem servidor).
//
// Segurança:
// - "state" aleatório confere que a volta do login foi pedida por este app;
// - o token é conferido no Google (tokeninfo): precisa ter sido emitido para o nosso ID de cliente
//   e precisa incluir a permissão do Drive;
// - o token dura cerca de 1 hora e fica só neste aparelho; "Sair" revoga o token no Google.
// - quem pode entrar é decidido pelo Google: o app está "em teste" e só aceita os usuários de teste.
import { GOOGLE_CLIENT_ID, ESCOPOS, ESCOPO_DRIVE } from './config.js';

const SESSAO = 'rb.sessao';
const CONTA = 'rb.conta';
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

export function sessao() {
  try {
    const s = JSON.parse(ler(localStorage, SESSAO) || 'null');
    return s && s.expira > Date.now() + 30_000 ? s : null;
  } catch {
    return null;
  }
}

export const conta = () => ler(localStorage, CONTA);

/** Endereço de volta do login: a raiz do app, sem "index.html". Precisa estar autorizado no console. */
export const enderecoDeVolta = () => location.origin + location.pathname.replace(/index\.html$/, '');

export function entrar({ registrar }) {
  if (!configurado()) return;
  const estado = crypto.randomUUID();
  gravar(sessionStorage, 'rb.oauth.estado', estado);
  const volta = location.hash && !/^#(access_token|error)=/.test(location.hash) ? location.hash : '#painel';
  gravar(sessionStorage, 'rb.oauth.volta', volta);
  const p = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: enderecoDeVolta(),
    response_type: 'token',
    scope: ESCOPOS.join(' '),
    include_granted_scopes: 'true',
    state: estado,
  });
  const dica = conta();
  if (dica) p.set('login_hint', dica);
  registrar('app', 'conta.entrar');
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
  const falha = (erro, mensagem, det = erro) => {
    registrar('erro', 'conta.login_falhou', { det, st: 'erro' });
    return { erro, mensagem };
  };

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
    return falha('rede', 'Sem conexão para confirmar o login. Confira a internet e tente de novo.', e.message);
  }
  if (info.aud !== GOOGLE_CLIENT_ID) return falha('aud', 'Este login não foi emitido para o researchbook. Entre de novo.', 'token de outro app');
  if (!(info.scope || '').split(' ').includes(ESCOPO_DRIVE)) {
    return falha('escopo', 'Para guardar seus dados, marque a permissão do Google Drive na tela do Google e entre de novo.', 'sem drive.file');
  }

  const s = { token, expira: Date.now() + Number(p.get('expires_in') || info.expires_in || 3600) * 1000, email: info.email || null };
  gravar(localStorage, SESSAO, JSON.stringify(s));
  if (s.email) gravar(localStorage, CONTA, s.email);
  registrar('app', 'conta.login_ok', { dur: Math.round(performance.now() - inicio) });
  return { ok: true };
}

export async function sair({ registrar, esquecerConta = false }) {
  const s = sessao();
  gravar(localStorage, SESSAO, null);
  if (esquecerConta) gravar(localStorage, CONTA, null);
  registrar('app', 'conta.sair');
  if (s) {
    try {
      await fetch(`${REVOGAR}?token=${encodeURIComponent(s.token)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    } catch {}
  }
}

/** Marca a sessão como vencida (ex.: o Drive respondeu 401). */
export function expirar() {
  gravar(localStorage, SESSAO, null);
}
