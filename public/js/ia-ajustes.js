// Ajustes > Gemini: como o app acessa o Gemini, teste de conexão e perfil do autor.
import { FRASE_MINIMA } from './cofre.js';
import { ErroIA } from './gemini.js';

/* global toast */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function criarIAAjustes({ ia, cofre, registrar }) {
  let estadoCofre = null; // 'vazio' | 'trancado' | 'aberto'
  let teste = null; // { ok, texto }
  let perfil = null; // texto carregado
  let rascunhoPerfil = null;
  let msgCofre = null;

  async function atualizar() {
    const [ec, p] = await Promise.all([cofre.estado().catch(() => 'vazio'), perfil === null ? ia.perfil() : Promise.resolve(perfil)]);
    const mudou = ec !== estadoCofre || perfil === null;
    estadoCofre = ec;
    perfil = p || '';
    if (mudou) redesenhar();
  }
  const redesenhar = () => {
    const s = document.getElementById('sec-ia');
    if (s) s.outerHTML = secaoHTML();
  };

  const msgHTML = (x) => (x ? `<p class="${x.ok ? 'ia-ok' : 'erro-campo'}" role="${x.ok ? 'status' : 'alert'}">${esc(x.texto)}</p>` : '');
  /** Mostra uma mensagem sem redesenhar a seção, para não apagar o que o Diobert digitou. */
  const mostrar = (slot, x) => {
    const el = document.getElementById(slot);
    if (el) el.innerHTML = msgHTML(x);
    else redesenhar();
  };

  function blocoGoogle() {
    const a = ia.ajustes;
    const perm = a.temPermissao();
    return `<div class="ia-bloco">
      <div class="campo" style="max-width:440px"><label for="ia-projeto">ID do projeto do Google Cloud <small>onde o uso do Gemini é cobrado</small></label>
        <div class="linha-doi"><input id="ia-projeto" value="${esc(a.projeto())}" placeholder="ex.: researchbook-123456" autocomplete="off" spellcheck="false"><button class="btn" data-ia-projeto>Salvar</button></div></div>
      <p class="ia-status ${perm ? 'ok' : ''}"><i></i>${perm ? 'Permissão do Gemini concedida neste login.' : 'O login atual ainda não tem a permissão do Gemini.'}</p>
      ${perm ? '' : '<button class="btn prim" data-ia-conectar>Conectar o Gemini</button>'}
      <details class="como"><summary>O que preparar no Google</summary><ol>
        <li>No Google Cloud, no projeto do researchbook (o mesmo do login), ative a <b>Generative Language API</b>.</li>
        <li>Na tela de permissão OAuth do mesmo projeto, acrescente a permissão <code>generative-language.retriever</code>.</li>
        <li>No Google AI Studio, importe esse projeto, ligue a cobrança e defina um <b>limite de gasto mensal</b> (Spend &gt; Monthly spend cap).</li>
        <li>Cole aqui o ID do projeto e toque em "Conectar o Gemini". O Google vai pedir a permissão nova.</li>
      </ol></details>
    </div>`;
  }

  function blocoCofre() {
    const m = `<div id="ia-msg-cofre">${msgHTML(msgCofre)}</div>`;
    if (estadoCofre === null) return '<p class="mute">Conferindo o cofre…</p>';
    if (estadoCofre === 'aberto') {
      return `<div class="ia-bloco"><p class="ia-status ok"><i></i>Cofre aberto neste aparelho. A chave nunca aparece na tela nem nos registros.</p>${m}
        <div class="ia-linha"><button class="btn fant" data-ia-trancar>Trancar neste aparelho</button><button class="btn fant" data-ia-trocar>Trocar a chave</button></div></div>`;
    }
    if (estadoCofre === 'trancado') {
      return `<div class="ia-bloco"><p class="ia-status"><i></i>Há um cofre no seu Drive. Digite a frase-senha para abrir neste aparelho.</p>
        <div class="campo" style="max-width:440px"><label for="ia-frase">Frase-senha</label><input id="ia-frase" type="password" autocomplete="current-password"></div>
        <label class="ia-check"><input type="checkbox" id="ia-lembrar"> Lembrar neste aparelho</label>${m}
        <div class="ia-linha"><button class="btn prim" data-ia-desbloquear>Abrir o cofre</button><button class="btn fant" data-ia-trocar>Guardar outra chave</button></div></div>`;
    }
    return `<div class="ia-bloco">
      <div class="campo" style="max-width:440px"><label for="ia-chave">Chave do Gemini <small>do Google AI Studio</small></label><input id="ia-chave" type="password" autocomplete="off" spellcheck="false"></div>
      <div class="campo" style="max-width:440px"><label for="ia-frase-nova">Frase-senha <small>pelo menos ${FRASE_MINIMA} caracteres; várias palavras são mais fáceis de lembrar</small></label><input id="ia-frase-nova" type="password" autocomplete="new-password"></div>
      <div class="campo" style="max-width:440px"><label for="ia-frase-conf">Repita a frase-senha</label><input id="ia-frase-conf" type="password" autocomplete="new-password"></div>
      <label class="ia-check"><input type="checkbox" id="ia-lembrar"> Lembrar neste aparelho</label>${m}
      <button class="btn prim" data-ia-guardar>Guardar no cofre</button>
      <p class="mute ia-nota">A chave vai para o seu Drive cifrada com a frase-senha (AES de 256 bits). Sem a frase, nem o app consegue abrir. Se esquecer a frase, guarde a chave de novo.</p>
    </div>`;
  }

  function secaoHTML() {
    if (estadoCofre === null || perfil === null) queueMicrotask(atualizar);
    const modo = ia.ajustes.modo();
    const t = `<div id="ia-teste">${msgHTML(teste)}</div>`;
    const perfilTexto = rascunhoPerfil ?? perfil ?? '';
    return `<section id="sec-ia">
      <h2>Conexão com o Gemini</h2>
      <p>Escolha como este aparelho acessa o Gemini. As duas formas funcionam nos computadores e no celular.</p>
      <div class="ia-modos" role="radiogroup" aria-label="Acesso ao Gemini">
        <label class="ia-modo ${modo === 'google' ? 'on' : ''}"><input type="radio" name="ia-modo" value="google" ${modo === 'google' ? 'checked' : ''} data-ia-modo>
          <span><b>Pelo seu login Google</b> <span class="chip">mais seguro</span><small>Nenhuma chave guardada em lugar nenhum. O acesso vence junto com o login, em cerca de uma hora.</small></span></label>
        <label class="ia-modo ${modo === 'cofre' ? 'on' : ''}"><input type="radio" name="ia-modo" value="cofre" ${modo === 'cofre' ? 'checked' : ''} data-ia-modo>
          <span><b>Chave num cofre no seu Drive</b><small>A chave fica cifrada com uma frase-senha sua. Use se o login Google não funcionar com o Gemini.</small></span></label>
      </div>
      ${modo === 'google' ? blocoGoogle() : modo === 'cofre' ? blocoCofre() : ''}
      ${modo ? `<div class="ia-linha"><button class="btn" data-ia-testar>Testar conexão</button></div>${t}` : ''}
      <h3 class="ia-sub">Perfil do autor</h3>
      <p>Quem você é, como escreve e o que prefere. Entra em todo pedido à IA e fica no seu Drive (memoria/autor.md), fora do código do app.</p>
      <div class="campo"><label for="ia-perfil">Perfil</label><textarea id="ia-perfil" rows="8">${esc(perfilTexto)}</textarea></div>
      <button class="btn" data-ia-perfil>Salvar perfil</button>
      <div class="aviso"><span>ⓘ</span><div>Defina um limite de gasto mensal no Google AI Studio (Spend &gt; Monthly spend cap). Mesmo que algo dê errado, o gasto para no limite.</div></div>
    </section>`;
  }

  document.addEventListener('input', (e) => {
    if (e.target.id === 'ia-perfil') rascunhoPerfil = e.target.value;
  });
  document.addEventListener('change', (e) => {
    if (e.target.matches?.('[data-ia-modo]')) {
      ia.ajustes.definirModo(e.target.value);
      teste = null;
      msgCofre = null;
      redesenhar();
      if (e.target.value === 'cofre') atualizar();
    }
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ia-projeto],[data-ia-conectar],[data-ia-testar],[data-ia-guardar],[data-ia-desbloquear],[data-ia-trancar],[data-ia-trocar],[data-ia-perfil]');
    if (!b) return;
    const v = (id) => document.getElementById(id)?.value || '';
    const lembrar = () => !!document.getElementById('ia-lembrar')?.checked;
    if (b.dataset.iaProjeto !== undefined) {
      ia.ajustes.definirProjeto(v('ia-projeto'));
      toast('Projeto salvo neste aparelho');
      return;
    }
    if (b.dataset.iaConectar !== undefined) {
      if (v('ia-projeto')) ia.ajustes.definirProjeto(v('ia-projeto'));
      ia.ajustes.conectarGoogle();
      return;
    }
    if (b.dataset.iaTestar !== undefined) {
      b.disabled = true;
      teste = { ok: true, texto: 'Testando…' };
      mostrar('ia-teste', teste);
      try {
        const r = await ia.testar();
        teste = { ok: true, texto: `Conectado. O Gemini respondeu (${r.modelo}, ${(r.dur / 1000).toFixed(1)} s).` };
      } catch (err) {
        teste = { ok: false, texto: err instanceof ErroIA ? err.message : `Não deu para testar: ${err.message}` };
      }
      b.disabled = false;
      mostrar('ia-teste', teste);
      return;
    }
    b.disabled = true;
    try {
      if (b.dataset.iaGuardar !== undefined) {
        if (v('ia-frase-nova') !== v('ia-frase-conf')) throw new Error('As duas frases-senha não são iguais.');
        await cofre.guardar(v('ia-chave'), v('ia-frase-nova'), { lembrar: lembrar() });
        msgCofre = { ok: true, texto: 'Chave guardada no cofre do seu Drive.' };
      }
      if (b.dataset.iaDesbloquear !== undefined) {
        await cofre.desbloquear(v('ia-frase'), { lembrar: lembrar() });
        msgCofre = { ok: true, texto: 'Cofre aberto.' };
      }
      if (b.dataset.iaTrancar !== undefined) {
        await cofre.trancar();
        msgCofre = { ok: true, texto: 'Cofre trancado neste aparelho. Ele continua no seu Drive.' };
      }
      if (b.dataset.iaTrocar !== undefined) {
        estadoCofre = 'vazio';
        msgCofre = null;
        redesenhar();
        return;
      }
      if (b.dataset.iaPerfil !== undefined) {
        const noDrive = await ia.salvarPerfil(v('ia-perfil'));
        perfil = v('ia-perfil');
        rascunhoPerfil = null;
        toast(noDrive ? 'Perfil salvo no seu Drive' : 'Perfil salvo neste aparelho; vai para o Drive quando você entrar com o Google');
        return;
      }
      estadoCofre = null;
      await atualizar();
      redesenhar();
    } catch (err) {
      msgCofre = { ok: false, texto: err.message };
      registrar('ia', 'cofre.erro', { det: err.codigo || 'erro', st: 'aviso' });
      mostrar('ia-msg-cofre', msgCofre);
    } finally {
      b.disabled = false;
    }
  });

  return { secaoHTML };
}
