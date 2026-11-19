// Ajustes > Gemini: como o app acessa o Gemini, os quatro passos da conexão conferidos pelo próprio app,
// teste com uma pergunta de verdade e perfil do autor.
import { FRASE_MINIMA } from './cofre.js';
import { ErroIA } from './gemini.js';
import { ouvir } from './ui.js';

/* global toast */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function criarIAAjustes({ ia, cofre, registrar }) {
  let estadoCofre = null; // 'vazio' | 'trancado' | 'aberto'
  let teste = null; // { ok, texto }
  let perfil = null; // texto carregado
  let rascunhoPerfil = null;
  let rascunhoProjeto = null; // o que foi digitado no ID do projeto e ainda não foi salvo: um redesenho da seção não pode apagar
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

  /* ---------- A última conferência: o que o teste de verdade mostrou, e quando ---------- */
  // Fica só neste aparelho. Guarda o código do erro e a hora; nunca o texto do pedido nem a resposta.
  const CONFERENCIA = 'rb.ia.conferencia';
  const lerConferencia = () => {
    try {
      const c = JSON.parse(localStorage.getItem(CONFERENCIA) || 'null');
      return c && c.modo === ia.ajustes.modo() && c.projeto === ia.ajustes.projeto() ? c : null;
    } catch {
      return null;
    }
  };
  const gravarConferencia = (c) => {
    try {
      localStorage.setItem(CONFERENCIA, JSON.stringify({ ...c, em: new Date().toISOString(), modo: ia.ajustes.modo(), projeto: ia.ajustes.projeto() }));
    } catch {
      // Sem armazenamento local, a conferência vale só para esta tela.
    }
  };
  const hora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  // Em qual passo cada erro do Google cai. O que não está aqui é erro do próprio teste (passo 4).
  const PASSO_DO_ERRO = { api: 1, permissao: 2, sessao: 2, projeto: 3, negado: 3, limite: 3 };
  const O_QUE_FAZER = {
    api: 'No Google Cloud, abra o projeto do researchbook, ative a Generative Language API e volte aqui para testar.',
    permissao: 'Selecione "Conectar o Gemini" e aceite a permissão que o Google mostrar.',
    sessao: 'Reconecte ao Google e teste de novo.',
    projeto: 'Cole o ID do projeto do Google Cloud em que o Gemini é cobrado e salve.',
    negado: 'Confira se o ID do projeto está certo e se, no Google AI Studio, a cobrança está ligada nesse projeto.',
    limite: 'No Google AI Studio, aumente o limite de gasto do mês ou espere o mês virar.',
  };

  function blocoGoogle() {
    const a = ia.ajustes;
    const perm = a.temPermissao();
    const conf = lerConferencia();
    const falhou = conf && !conf.ok ? PASSO_DO_ERRO[conf.codigo] || 4 : 0;
    // Um passo só fica "conferido" quando o teste passou por ele: funcionou, ou falhou num passo posterior.
    const passou = (n) => !!conf && (conf.ok || falhou > n);
    const quando = conf ? `<small>Conferido às ${hora(conf.em)}</small>` : '';
    const passo = (n, titulo, corpo, { ok = passou(n), erro = falhou === n } = {}) =>
      `<li class="ia-passo ${erro ? 'erro' : ok ? 'ok' : 'pendente'}"><span class="ia-marca" aria-hidden="true">${erro ? '!' : ok ? '✓' : n}</span><div><h3>${titulo}</h3>${corpo}${erro ? `<p class="erro-campo" role="alert">${esc(conf.texto)}</p><p>${O_QUE_FAZER[conf.codigo] || ''}</p>` : ''}${(ok || erro) && conf ? quando : ''}</div></li>`;
    return `<div class="ia-bloco">
      <ol class="ia-passos">
        ${passo(1, 'Ativar a API do Gemini no seu projeto do Google', `<p>${passou(1) ? 'O app conferiu: está ativa.' : falhou === 1 ? '' : 'O app só consegue conferir este passo com o teste do passo 4.'}</p>`)}
        ${passo(2, 'Autorizar o app a usar o Gemini', `<p class="ia-status ${perm ? 'ok' : ''}"><i></i>${perm ? 'Permissão do Gemini concedida neste login.' : 'O login atual ainda não tem a permissão do Gemini.'}</p>${perm ? '' : '<button class="btn prim" data-ia-conectar data-ocupado="Conectando…">Conectar o Gemini</button>'}`, { ok: perm && falhou !== 2 })}
        ${passo(3, 'Informar o projeto em que o Gemini é cobrado', `<div class="larg-form campo"><label for="ia-projeto">ID do projeto do Google Cloud <small>onde o uso do Gemini é cobrado</small></label>
          <div class="linha-doi"><input id="ia-projeto" value="${esc(rascunhoProjeto ?? a.projeto())}" placeholder="ex.: researchbook-123456" autocomplete="off" spellcheck="false"><button class="btn" data-ia-projeto>Salvar</button></div></div>${a.projeto() && !passou(3) && falhou !== 3 ? '<p>Informado. Falta conferir com o teste.</p>' : ''}`)}
        ${passo(4, 'Testar com uma pergunta de verdade', `<p>O app faz uma pergunta curta ao Gemini e mostra a resposta do Google, o modelo e o tempo.${conf?.ok ? ` Funcionou: o Gemini respondeu em ${(conf.dur / 1000).toFixed(1).replace('.', ',')} s (${esc(conf.modelo)}).` : ''}</p><div class="ia-linha"><button class="btn ${perm ? 'prim' : ''}" data-ia-testar data-ocupado="Perguntando ao Gemini…">${conf ? 'Testar de novo' : 'Testar conexão'}</button></div><div id="ia-teste">${msgHTML(teste)}</div>`)}
      </ol>
      <details class="como"><summary>O que preparar no Google</summary><ol>
        <li>No Google Cloud, no projeto do researchbook (o mesmo do login), ative a <b>Generative Language API</b>.</li>
        <li>Na tela de permissão OAuth do mesmo projeto, acrescente a permissão <code>generative-language.retriever</code>.</li>
        <li>No Google AI Studio, importe esse projeto, ligue a cobrança e defina um <b>limite de gasto mensal</b> (Spend &gt; Monthly spend cap).</li>
        <li>Cole aqui o ID do projeto e selecione "Conectar o Gemini". O Google vai pedir a permissão nova.</li>
        <li>Se o projeto do Gemini for de outra conta Google: nessa conta, dê à conta do researchbook o papel <b>Consumidor do Service Usage</b> no projeto (IAM).</li>
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
        <div class="larg-form campo"><label for="ia-frase">Frase-senha</label><input id="ia-frase" type="password" autocomplete="current-password"></div>
        <label class="ia-check"><input type="checkbox" id="ia-lembrar"> Lembrar neste aparelho</label>${m}
        <div class="ia-linha"><button class="btn prim" data-ia-desbloquear data-ocupado="Abrindo…">Abrir o cofre</button><button class="btn fant" data-ia-trocar>Guardar outra chave</button></div></div>`;
    }
    return `<div class="ia-bloco">
      <div class="larg-form campo"><label for="ia-chave">Chave do Gemini <small>do Google AI Studio</small></label><input id="ia-chave" type="password" autocomplete="off" spellcheck="false"></div>
      <div class="larg-form campo"><label for="ia-frase-nova">Frase-senha <small>pelo menos ${FRASE_MINIMA} caracteres; várias palavras são mais fáceis de lembrar</small></label><input id="ia-frase-nova" type="password" autocomplete="new-password"></div>
      <div class="larg-form campo"><label for="ia-frase-conf">Repita a frase-senha</label><input id="ia-frase-conf" type="password" autocomplete="new-password"></div>
      <label class="ia-check"><input type="checkbox" id="ia-lembrar"> Lembrar neste aparelho</label>${m}
      <button class="btn prim" data-ia-guardar data-ocupado="Guardando…">Guardar no cofre</button>
      <p class="mute ia-nota">A chave vai para o seu Drive cifrada com a frase-senha (AES de 256 bits). Sem a frase, nem o app consegue abrir. Se esquecer a frase, guarde a chave de novo.</p>
    </div>`;
  }

  // Acesso pelo servidor da chave: nada para configurar aqui; a tela mostra se ele respondeu e o uso do dia.
  let usoServidor = null;
  function blocoServidor() {
    const conf = lerConferencia();
    const estado = !conf ? '<p class="ia-status"><i></i>Ainda não testado neste aparelho.</p>' : conf.ok ? `<p class="ia-status ok"><i></i>Funcionou às ${hora(conf.em)}: o servidor aceitou o seu login e o Gemini respondeu.</p>` : '';
    const uso = usoServidor ? `<p class="t-meta mute" id="ia-uso-servidor">Pedidos hoje: ${usoServidor.pedidosHoje} de ${usoServidor.limite}. O limite zera à meia-noite e é definido na publicação do servidor.</p>` : '';
    return `<div class="ia-bloco">${estado}
      <p class="mute ia-nota">A chave fica guardada no Google Cloud, no seu projeto, e nunca chega a este aparelho. O servidor só atende o seu login e para de repassar pedidos quando o limite do dia é atingido.</p>${uso}</div>`;
  }

  function gastoHTML() {
    const r = window.rb?.iaUso?.resumoDoMes?.();
    return `<div class="ia-gasto"><h3 class="ia-sub">Gasto</h3><p>${r ? `Neste mês, neste aparelho: ${r.total}. ${r.limite ? `Limite que você definiu aqui: ${r.limite} por mês, com aviso em 80%.` : 'Nenhum limite definido aqui.'}` : 'Lendo os registros deste aparelho…'} <a href="#ajustes/custo">${r?.limite ? 'Mudar o limite' : 'Definir um limite'}</a></p>
      <p class="t-meta mute">${ia.ajustes.modo() === 'servidor' ? 'O limite que de fato para o uso é o do servidor: pedidos por dia. O daqui só avisa.' : 'O limite que de fato para o gasto fica no Google AI Studio (Spend, Monthly spend cap). O daqui só avisa.'}</p></div>`;
  }

  function secaoHTML() {
    if (estadoCofre === null || perfil === null) queueMicrotask(atualizar);
    const modo = ia.ajustes.modo();
    const t = `<div id="ia-teste">${msgHTML(teste)}</div>`;
    const perfilTexto = rascunhoPerfil ?? perfil ?? '';
    return `<section id="sec-ia">
      <h2>Conectar a IA</h2>
      <p>O tutor, o Copilot, as perguntas do fichamento e o parecer do projeto usam o Gemini. A configuração é feita uma vez. A IA só é chamada quando você pede; sem ela, o resto do app funciona normalmente.</p>
      <div class="ia-modos" role="radiogroup" aria-label="Acesso ao Gemini">
        <label class="ia-modo ${modo === 'google' ? 'on' : ''}"><input type="radio" name="ia-modo" value="google" ${modo === 'google' ? 'checked' : ''} data-ia-modo>
          <span><b>Pelo seu login Google</b> <span class="chip">mais seguro</span><small>Nenhuma chave guardada em lugar nenhum. O acesso vence junto com o login, em cerca de uma hora.</small></span></label>
        ${ia.ajustes.servidor() ? `<label class="ia-modo ${modo === 'servidor' ? 'on' : ''}"><input type="radio" name="ia-modo" value="servidor" ${modo === 'servidor' ? 'checked' : ''} data-ia-modo>
          <span><b>Por um servidor seu, que guarda a chave</b><small>Para chave de outra conta Google. A chave fica no servidor e não passa por este aparelho. O servidor só atende o seu login e tem limite de pedidos por dia.</small></span></label>` : ''}
        <label class="ia-modo ${modo === 'cofre' ? 'on' : ''}"><input type="radio" name="ia-modo" value="cofre" ${modo === 'cofre' ? 'checked' : ''} data-ia-modo>
          <span><b>Chave num cofre no seu Drive</b><small>A chave fica cifrada com uma frase-senha sua e é aberta neste aparelho a cada uso. Use se não houver servidor, ou se o login não funcionar com o Gemini.</small></span></label>
      </div>
      ${modo === 'google' ? blocoGoogle() : modo === 'servidor' ? blocoServidor() : modo === 'cofre' ? blocoCofre() : ''}
      ${modo === 'cofre' || modo === 'servidor' ? `<div class="ia-linha"><button class="btn" data-ia-testar data-ocupado="Perguntando ao Gemini…">Testar conexão</button></div>${t}` : ''}
      ${gastoHTML()}
      <h3 class="ia-sub">Perfil do autor</h3>
      <p>Quem você é, como escreve e o que prefere. Entra em todo pedido à IA e fica no seu Drive (memoria/autor.md), fora do código do app.</p>
      <div class="campo"><label for="ia-perfil">Perfil</label><textarea id="ia-perfil" rows="8">${esc(perfilTexto)}</textarea></div>
      <button class="btn" data-ia-perfil data-ocupado="Salvando…">Salvar perfil</button>
    </section>`;
  }

  document.addEventListener('input', (e) => {
    if (e.target.id === 'ia-perfil') rascunhoPerfil = e.target.value;
    if (e.target.id === 'ia-projeto') rascunhoProjeto = e.target.value;
  });
  document.addEventListener('change', (e) => {
    if (e.target.matches?.('[data-ia-modo]')) {
      ia.ajustes.definirModo(e.target.value);
      teste = null;
      msgCofre = null;
      usoServidor = null;
      redesenhar();
      if (e.target.value === 'cofre') atualizar();
    }
  });
  ouvir('click', async (e) => {
    const b = e.target.closest('[data-ia-projeto],[data-ia-conectar],[data-ia-testar],[data-ia-guardar],[data-ia-desbloquear],[data-ia-trancar],[data-ia-trocar],[data-ia-perfil]');
    if (!b) return;
    const v = (id) => document.getElementById(id)?.value || '';
    const lembrar = () => !!document.getElementById('ia-lembrar')?.checked;
    if (b.dataset.iaProjeto !== undefined) {
      ia.ajustes.definirProjeto(v('ia-projeto'));
      rascunhoProjeto = null;
      toast('Projeto salvo neste aparelho');
      return redesenhar();
    }
    if (b.dataset.iaConectar !== undefined) {
      if (v('ia-projeto')) ia.ajustes.definirProjeto(v('ia-projeto'));
      rascunhoProjeto = null;
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
        gravarConferencia({ ok: true, modelo: r.modelo, dur: r.dur });
        if (ia.ajustes.modo() === 'servidor') usoServidor = await ia.ajustes.estadoDoServidor().catch(() => null);
      } catch (err) {
        teste = { ok: false, texto: err instanceof ErroIA ? err.message : `Não deu para testar: ${err.message}` };
        gravarConferencia({ ok: false, codigo: err instanceof ErroIA ? err.codigo : 'erro', texto: teste.texto });
      }
      b.disabled = false;
      // No acesso pela conta Google, o resultado aparece nos quatro passos; a mensagem solta é do acesso com chave.
      if (ia.ajustes.modo() === 'google') {
        if (!teste.ok && (PASSO_DO_ERRO[lerConferencia()?.codigo] || 4) !== 4) teste = null;
        return redesenhar();
      }
      if (ia.ajustes.modo() === 'servidor') return redesenhar();
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
