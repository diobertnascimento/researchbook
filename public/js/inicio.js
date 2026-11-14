// Inicialização da base do app: armazenamento local, registros, atualizações e dica de instalação.
// Expõe window.rb para o restante do app (e para os testes).
import * as arm from './armazenamento.js';
import { criarRegistros } from './registros.js';
import { iniciarAtualizacao } from './atualizacao.js';
import { iniciarDicaInstalar, ehIOS, instalado } from './instalar.js';
import * as google from './google.js';
import { criarDrive } from './drive.js';
import { criarSincronia } from './sincronia.js';
import { criarBiblioteca } from './biblioteca.js';
import { criarBibliotecaUI } from './biblioteca-ui.js';
import { criarFichamentoUI } from './fichamento-ui.js';
import { criarArgumentosUI } from './argumentos-ui.js';
import { criarTrilhasUI } from './trilhas-ui.js';
import { criarHojeUI } from './hoje-ui.js';
import { criarConflitosUI } from './conflitos-ui.js';
import { criarCofre } from './cofre.js';
import { criarHistorico } from './historico.js';
import { criarIA } from './ia.js';
import { criarTutorUI } from './tutor-ui.js';
import { criarIAAjustes } from './ia-ajustes.js';
import { criarMemoriaUI } from './memoria-ui.js';
import { criarEscrita } from './escrita.js';
import { criarCopiloto } from './copiloto.js';
import { criarEscritaUI } from './escrita-ui.js';
import { criarDisciplinas } from './disciplinas.js';
import { criarDisciplinasUI } from './disciplinas-ui.js';
import { criarDissertacao } from './dissertacao.js';
import { criarDialogos } from './dialogos.js';
import { criarDissertacaoUI } from './dissertacao-ui.js';
import { criarAgenda } from './agenda.js';
import { criarAgendaUI } from './agenda-ui.js';
import { criarCartoes } from './cartoes.js';
import { criarCartoesUI } from './cartoes-ui.js';
import { criarTutorFichamento } from './tutor-fichamento.js';
import { criarOverview } from './overview.js';
import { criarOverviewUI } from './overview-ui.js';

/* global APP_VERSAO */
const versao = typeof APP_VERSAO === 'string' ? APP_VERSAO : 'desconhecida';

// Erros que acontecem antes de o banco abrir ficam guardados aqui e entram depois.
const antes = [];
const descreverErro = (e) => `${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`;
const descreverRejeicao = (e) => `promessa rejeitada: ${e.reason?.message ?? e.reason}`;
const cedoErro = (e) => antes.push(descreverErro(e));
const cedoRejeicao = (e) => antes.push(descreverRejeicao(e));
addEventListener('error', cedoErro);
addEventListener('unhandledrejection', cedoRejeicao);

/* ---------- Avisos fixos (versão nova, instalação) ---------- */
function aviso({ id, texto, acoes }) {
  let caixa = document.getElementById('avisos');
  if (!caixa) {
    caixa = document.createElement('div');
    caixa.id = 'avisos';
    caixa.setAttribute('aria-live', 'polite');
    document.body.appendChild(caixa);
  }
  document.getElementById(id)?.remove();
  const el = document.createElement('div');
  el.className = 'aviso-fixo';
  el.id = id;
  el.setAttribute('role', 'status');
  const p = document.createElement('p');
  p.textContent = texto;
  const bts = document.createElement('div');
  bts.className = 'bts';
  for (const a of acoes) {
    const b = document.createElement('button');
    b.className = 'btn' + (a.principal ? ' prim' : ' fant');
    b.textContent = a.rotulo;
    b.addEventListener('click', () => {
      el.remove();
      a.ao?.();
    });
    bts.appendChild(b);
  }
  el.append(p, bts);
  caixa.appendChild(el);
}

/* ---------- Descrição do aparelho, sem identificar a pessoa ---------- */
function aparelho() {
  const ua = navigator.userAgent;
  const sistema = ehIOS() ? 'iOS' : /android/i.test(ua) ? 'Android' : /mac/i.test(ua) ? 'macOS' : /win/i.test(ua) ? 'Windows' : /linux/i.test(ua) ? 'Linux' : 'outro';
  const navegador = /edg\//i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : /firefox|fxios/i.test(ua) ? 'Firefox' : 'outro';
  return { sistema, navegador, instalado: instalado(), tela: `${innerWidth}x${innerHeight}` };
}

async function iniciar() {
  const inicio = performance.now();
  let db = null;
  let erroBanco = null;
  try {
    db = await arm.abrir();
  } catch (e) {
    erroBanco = e;
  }

  const reg = criarRegistros(db, { versao });
  const registrar = reg.registrar;
  const ap = aparelho();
  registrar('app', 'sessao.inicio', { det: `versão ${versao}, ${ap.sistema}, ${ap.navegador}${ap.instalado ? ', instalado' : ''}, ${ap.tela}` });
  if (erroBanco) registrar('erro', 'dados.abrir_erro', { det: erroBanco.message, st: 'erro' });
  // A partir daqui, erros vão direto para os registros.
  removeEventListener('error', cedoErro);
  removeEventListener('unhandledrejection', cedoRejeicao);
  antes.splice(0).forEach((det) => registrar('erro', 'js.erro', { det, st: 'erro' }));
  addEventListener('error', (e) => registrar('erro', 'js.erro', { det: descreverErro(e), st: 'erro' }));
  addEventListener('unhandledrejection', (e) => registrar('erro', 'js.erro', { det: descreverRejeicao(e), st: 'erro' }));

  // Navegação e cliques: só o nome da tela e os atributos de ação, nunca o texto do usuário.
  addEventListener('hashchange', () => registrar('ui', 'ui.navegacao', { det: (location.hash || '#painel').slice(1) }));
  document.addEventListener(
    'click',
    (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const attrs = Object.entries(b.dataset)
        .filter(([k]) => k !== 'msg')
        .map(([k, v]) => (v ? `${k}=${v}` : k))
        .join(' ');
      registrar('ui', 'ui.clique', { det: attrs || b.getAttribute('aria-label') || 'botão' });
    },
    true,
  );

  let persistente = false;
  let migracoes = [];
  if (db) {
    try {
      migracoes = await arm.migrar(db, registrar);
      const removidos = await reg.limparAntigos();
      if (removidos) registrar('app', 'registros.limpeza', { det: `${removidos} registros com mais de 180 dias` });
      await reg.carregarRecentes();
      persistente = await arm.pedirPersistencia();
    } catch (e) {
      registrar('erro', 'dados.inicio_erro', { det: e.message, st: 'erro' });
    }
  }

  const atualizacao = iniciarAtualizacao({ registrar, aviso });
  iniciarDicaInstalar({ registrar, aviso });

  // Identificador aleatório deste aparelho (não identifica a pessoa; só diz qual aparelho mudou cada item).
  let idAparelho = db ? await arm.lerMeta(db, 'aparelho') : null;
  if (db && !idAparelho) {
    idAparelho = crypto.randomUUID();
    await arm.gravarMeta(db, 'aparelho', idAparelho);
  }

  // Volta do login do Google, se for o caso.
  const retorno = await google.concluirRetorno({ registrar });

  let sinc = null;
  let procurouMemoria = false;
  let driveAtual = null;
  const atualizarStatus = () => {
    const el = document.getElementById('status-drive');
    if (el && typeof window.statusDriveHTML === 'function') el.innerHTML = window.statusDriveHTML();
    // Ajustes mostra o status da sincronização; não redesenha enquanto o Diobert digita num campo.
    const digitando = document.activeElement?.matches?.('input, textarea, select');
    if (/^#ajustes/.test(location.hash) && !digitando && typeof window.render === 'function') window.render();
  };
  function ligarDrive() {
    if (sinc || !db || !google.sessao()) return;
    const drive = criarDrive({ token: () => google.sessao()?.token, registrar });
    driveAtual = drive;
    sinc = criarSincronia({
      db,
      drive,
      registros: reg,
      aparelho: idAparelho,
      aoEstado: (e) => {
        if (e.fase === 'desconectado') google.expirar();
        if (e.fase === 'ok') {
          window.rb.biblioteca?.carregar().then(() => window.rb.biblioteca.enviarPendentes());
          // Dados de outro aparelho: recarrega e redesenha as telas que só leem (nunca no meio de um formulário).
          window.rb.historico?.enviarPendentes();
          Promise.all([window.rb.fichUI?.carregar(), window.rb.argUI?.carregar(), window.rb.trilhasUI?.carregar(), window.rb.conflitosUI?.carregar(), window.rb.historico?.carregar(), window.rb.memoriaUI?.carregar(), window.rb.escrita?.carregar(), window.rb.disciplinas?.carregar(), window.rb.dissertacao?.carregar(), window.rb.dialogos?.carregar(), window.rb.cartoes?.carregar()]).then(() => {
            // Uma vez por sessão, depois da primeira sincronização: a IA procura o que lembrar nas conversas paradas.
            if (!procurouMemoria) {
              procurouMemoria = true;
              window.rb.memoriaUI?.procurarEmSegundoPlano();
            }
            const modalAberto = document.getElementById('veu')?.classList.contains('on');
            const digitando = document.activeElement?.matches?.('input, textarea, select, [contenteditable]');
            if (!modalAberto && !digitando && telaDeLeitura()) window.render?.();
            if (!modalAberto) window.desenhaMenu?.(location.hash.slice(1) || 'painel');
            window.rb.disciplinas?.retomarPendentes();
            window.rb.agenda?.sincronizar();
          });
        }
        atualizarStatus();
      },
    });
    window.rb.sincronia = sinc;
    sinc.sincronizar();
  }

  const telaDeLeitura = () => /^(#painel|#trilhas|#argumentos|#fichamentos|#conflitos|#memoria|#disciplinas|#disciplina|#aula|#escrita|#projeto|#orientacao)?(\/|$)/.test(location.hash || '');

  async function salvar(colecao, item) {
    const novo = { ...item, atualizadoEm: new Date().toISOString(), aparelho: idAparelho };
    await arm.gravar(db, colecao, novo);
    sinc?.agendar();
    return novo;
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-google]');
    if (!b) return;
    const acao = b.dataset.google;
    if (acao === 'entrar') {
      if (!google.configurado()) {
        window.rb.google.erro = 'O login com Google ainda não foi configurado neste app.';
        window.render?.();
        return;
      }
      google.entrar({ registrar });
    }
    if (acao === 'sincronizar') sinc ? sinc.sincronizar() : google.entrar({ registrar });
    if (acao === 'sair') {
      await reg.gravar();
      await google.sair({ registrar, esquecerConta: true });
      location.hash = '#painel';
      location.reload();
    }
  });

  window.rb = {
    versao,
    pronto: true,
    registros: reg,
    atualizacao,
    aviso,
    dados: {
      disponivel: !!db,
      persistente,
      migracoes,
      esquema: arm.ESQUEMA,
      exportar: () => arm.exportar(db),
      backup: (motivo) => arm.backup(db, motivo),
      contarBackups: () => arm.contarBackups(db),
      espaco: arm.espaco,
      salvar,
      apagar: (colecao, id) => salvar(colecao, { id, apagado: true }),
      // Inclusive os apagados (a agenda do Google precisa saber o que saiu).
      listarTudo: (colecao) => arm.todos(db, colecao),
      listar: async (colecao) => (await arm.todos(db, colecao)).filter((i) => !i.apagado),
      conflitos: () => arm.todos(db, 'conflitos'),
      // Item como está guardado, inclusive com a marca apagado (a tela de conflitos precisa ver os dois lados).
      obter: (colecao, id) => arm.um(db, colecao, id),
      resolverConflito: async (id) => {
        await arm.removerDe(db, 'conflitos', id);
        await sinc?.recontar();
        atualizarStatus();
      },
      reabrirConflito: async (c) => {
        await arm.gravar(db, 'conflitos', c);
        await sinc?.recontar();
        atualizarStatus();
      },
      aparelho: idAparelho,
    },
    google: {
      configurado: google.configurado(),
      conta: google.conta(),
      conectado: () => !!google.sessao(),
      erro: retorno?.erro ? retorno.mensagem : null,
    },
    sincronia: null,
    aparelho: ap,
  };
  if (db) {
    const biblioteca = criarBiblioteca({ db, dados: window.rb.dados, registrar, drive: () => (sinc && google.sessao() ? driveAtual : null) });
    window.rb.biblioteca = biblioteca;
    window.rb.bibUI = criarBibliotecaUI({ bib: biblioteca, registrar });
    window.rb.fichUI = criarFichamentoUI({ bib: biblioteca, dados: window.rb.dados, registrar, drive: () => (sinc && google.sessao() ? driveAtual : null) });
    window.rb.argUI = criarArgumentosUI({ bib: biblioteca, dados: window.rb.dados, fichUI: window.rb.fichUI, registrar });
    window.rb.trilhasUI = criarTrilhasUI({ bib: biblioteca, dados: window.rb.dados, fichUI: window.rb.fichUI, registrar });
    window.rb.conflitosUI = criarConflitosUI({ bib: biblioteca, dados: window.rb.dados, registrar });
    const driveSeConectado = () => (sinc && google.sessao() ? driveAtual : null);
    const cofre = criarCofre({ db, drive: driveSeConectado, registrar });
    const historico = criarHistorico({ db, dados: window.rb.dados, drive: driveSeConectado, registrar });
    window.rb.historico = historico;
    window.rb.ia = criarIA({ db, dados: window.rb.dados, bib: biblioteca, fichUI: window.rb.fichUI, argUI: window.rb.argUI, historico, cofre, drive: driveSeConectado, registrar });
    window.rb.tutorUI = criarTutorUI({ ia: window.rb.ia, historico, bib: biblioteca, registrar });
    window.rb.iaAjustes = criarIAAjustes({ ia: window.rb.ia, cofre, registrar });
    window.rb.memoriaUI = criarMemoriaUI({ ia: window.rb.ia, historico, dados: window.rb.dados, bib: biblioteca, fichUI: window.rb.fichUI, argUI: window.rb.argUI, drive: driveSeConectado, registrar });
    window.rb.escrita = criarEscrita({ dados: window.rb.dados, bib: biblioteca, drive: driveSeConectado, registrar });
    window.rb.copiloto = criarCopiloto({ ia: window.rb.ia, bib: biblioteca, fichUI: window.rb.fichUI, historico, registrar });
    window.rb.escritaUI = criarEscritaUI({ escrita: window.rb.escrita, copiloto: window.rb.copiloto, ia: window.rb.ia, bib: biblioteca, drive: driveSeConectado, registrar });
    window.rb.disciplinas = criarDisciplinas({
      db,
      dados: window.rb.dados,
      ia: window.rb.ia,
      bib: biblioteca,
      historico,
      drive: driveSeConectado,
      registrar,
      // Progresso da transcrição: redesenha a aula ou a disciplina aberta, nunca no meio da digitação.
      aoMudar: () => {
        const digitando = document.activeElement?.matches?.('input, textarea, select, [contenteditable]');
        const modalAberto = document.getElementById('veu')?.classList.contains('on');
        if (/^#(aula\/|disciplina\/|disciplinas|orientacao)/.test(location.hash) && !digitando && !modalAberto) window.render?.();
      },
    });
    window.rb.disciplinasUI = criarDisciplinasUI({ disc: window.rb.disciplinas, bib: biblioteca, escrita: window.rb.escrita, registrar });
    document.addEventListener('rb:render', () => window.rb.disciplinasUI.montar());
    const redesenharSe = (re) => () => {
      const digitando = document.activeElement?.matches?.('input, textarea, select, [contenteditable]');
      if (re.test(location.hash) && !digitando && !document.getElementById('veu')?.classList.contains('on')) window.render?.();
    };
    window.rb.agenda = criarAgenda({ dados: window.rb.dados, disc: window.rb.disciplinas, drive: driveSeConectado, token: () => google.sessao()?.token, temPermissao: google.temPermissaoAgenda, ligada: google.agendaLigada, registrar, aoMudar: redesenharSe(/^#(ajustes|disciplina\/|orientacao)/) });
    window.rb.agendaUI = criarAgendaUI({ agenda: window.rb.agenda, google, registrar });
    window.rb.disciplinas.aoMudarEventos(() => window.rb.agenda.agendar());
    window.rb.cartoes = criarCartoes({ dados: window.rb.dados, ia: window.rb.ia, bib: biblioteca, disc: window.rb.disciplinas, historico, registrar });
    window.rb.cartoesUI = criarCartoesUI({ cart: window.rb.cartoes, bib: biblioteca, disc: window.rb.disciplinas, registrar });
    window.rb.tutorFich = criarTutorFichamento({ ia: window.rb.ia, bib: biblioteca, fichUI: window.rb.fichUI, argUI: window.rb.argUI, historico, registrar });
    window.rb.overview = criarOverview({ db, ia: window.rb.ia, escrita: window.rb.escrita, drive: driveSeConectado, registrar });
    window.rb.overviewUI = criarOverviewUI({ ov: window.rb.overview, registrar });
    window.rb.dissertacao = criarDissertacao({ dados: window.rb.dados, ia: window.rb.ia, bib: biblioteca, fichUI: window.rb.fichUI, historico, disc: window.rb.disciplinas, drive: driveSeConectado, registrar, aoMudar: redesenharSe(/^#orientacao/) });
    window.rb.dialogos = criarDialogos({ dados: window.rb.dados, ia: window.rb.ia, bib: biblioteca, fichUI: window.rb.fichUI, argUI: window.rb.argUI, historico, registrar });
    window.rb.dissertacaoUI = criarDissertacaoUI({ diss: window.rb.dissertacao, dlg: window.rb.dialogos, disc: window.rb.disciplinas, discUI: window.rb.disciplinasUI, bib: biblioteca, registrar });
    window.rb.hojeUI = criarHojeUI({ bib: biblioteca, fichUI: window.rb.fichUI, trilhasUI: window.rb.trilhasUI, argUI: window.rb.argUI, conflitosUI: window.rb.conflitosUI });
    await biblioteca.carregar();
    await Promise.all([window.rb.fichUI.carregar(), window.rb.argUI.carregar(), window.rb.trilhasUI.carregar(), window.rb.conflitosUI.carregar(), historico.carregar(), window.rb.memoriaUI.carregar(), window.rb.escrita.carregar(), window.rb.disciplinas.carregar(), window.rb.dissertacao.carregar(), window.rb.dialogos.carregar(), window.rb.cartoes.carregar()]);
    window.rb.disciplinas.retomarPendentes();
  }
  ligarDrive();
  registrar('app', 'app.pronto', { dur: Math.round(performance.now() - inicio) });

  // Redesenha: a tela de entrada depende do login; Ajustes mostra dados desta base.
  if ((retorno || /^#(ajustes|biblioteca|leitor|fichamento|texto)/.test(location.hash) || telaDeLeitura() || document.body.classList.contains('bloqueado')) && typeof window.render === 'function') window.render();
  atualizarStatus();
  document.dispatchEvent(new CustomEvent('rb:pronto'));
}

iniciar();
