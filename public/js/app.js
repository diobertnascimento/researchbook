// Telas, roteador e estado da interface (antes ficavam dentro do index.html).
// Script clássico, carregado antes dos módulos: as declarações de topo (S, V, I, render, toast...) são globais
// e os módulos de public/js/ as usam. Sem código dentro do HTML, a política de segurança não precisa de
// 'unsafe-inline' em script-src.
/* Volta do login do Google: o retorno chega no endereço (#state=...&access_token=..., em qualquer ordem).
   Guarda e limpa o endereço antes de o roteador ler, para o token não ficar no histórico nem virar rota. */
(function(){
  if(!/(^#|&)(access_token|error)=/.test(location.hash)) return;
  let volta='#painel';
  try{ sessionStorage.setItem('rb.oauth',location.hash.slice(1)); volta=sessionStorage.getItem('rb.oauth.volta')||'#painel'; }catch(e){}
  history.replaceState(null,'',location.pathname+location.search+volta);
})();
/* Versão do app: mantenha igual à de package.json e registre a mudança em CHANGELOG.md */
const APP_VERSAO = '2.3.0';
/* Quem vê o app: este aparelho já entrou com a conta autorizada, ou está no modo de exemplo (testes).
   A proteção real dos dados é o login do Google e a permissão do Drive; esta tela só evita mostrar o app a visitantes. */
/* Dados reais: este aparelho já entrou com a conta e não está no modo de exemplo. */
function modoReal(){ try{ return localStorage.getItem('rb.exemplo')!=='1' && !!localStorage.getItem('rb.conta'); }catch(e){ return false; } }
function acesso(){
  try{
    if(localStorage.getItem('rb.exemplo')==='1') return 'livre';
    if(sessionStorage.getItem('rb.oauth')) return 'conectando';
    if(localStorage.getItem('rb.conta')) return 'livre';
  }catch(e){}
  return 'entrar';
}

/* =========================================================
   Ícones
   ========================================================= */
const I = {
  painel:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="10" height="10" rx="2"/><rect x="15" y="3" width="6" height="10" rx="2"/><rect x="3" y="15" width="6" height="6" rx="2"/><rect x="11" y="15" width="10" height="6" rx="2"/></svg>',
  biblioteca:'<svg viewBox="0 0 24 24"><path d="M4 4h3v16H4zM9 4h3v16H9z"/><path d="m14.5 5 2.9-.8 3.6 15-2.9.8z"/></svg>',
  trilhas:'<svg viewBox="0 0 24 24"><circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h8a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8"/></svg>',
  leitor:'<svg viewBox="0 0 24 24"><path d="M3 5c3-1.5 6-1.5 9 1 3-2.5 6-2.5 9-1v14c-3-1.5-6-1.5-9 1-3-2.5-6-2.5-9-1z"/><path d="M12 6v14"/></svg>',
  fichamentos:'<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/></svg>',
  argumentos:'<svg viewBox="0 0 24 24"><path d="M4 5h16v10H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>',
  revisao:'<svg viewBox="0 0 24 24"><rect x="4" y="6" width="13" height="14" rx="2"/><path d="M8 3h10a2 2 0 0 1 2 2v12"/></svg>',
  ajustes:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
  busca:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  mais:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  tutor:'<svg viewBox="0 0 24 24"><path d="M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3z"/><path d="M9 22h6"/></svg>',
  enviar:'<svg viewBox="0 0 24 24"><path d="M4 12 20 4l-6 16-2.5-6.5z"/></svg>',
  voltar:'<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  projeto:'<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="m9 14 2 2 4-4"/></svg>',
  orientacao:'<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3 2.5-5 5-5s5 2 5 5M13.5 20c.3-2.4 1.8-4 3.5-4s3.4 1.6 3.7 4"/></svg>',
  disciplinas:'<svg viewBox="0 0 24 24"><path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/></svg>',
  cartoes:'<svg viewBox="0 0 24 24"><rect x="4" y="6" width="13" height="14" rx="2"/><path d="M8 3h10a2 2 0 0 1 2 2v12"/></svg>',
  painelEsq:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>',
  painelDir:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg>',
  foco:'<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  play:'<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="#fff" stroke="none"/></svg>',
  upload:'<svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/></svg>',
  pasta:'<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  escrita:'<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/></svg>',
  dialogos:'<svg viewBox="0 0 24 24"><path d="M3 5h12v8H8l-3 3v-3H3z"/><path d="M15 9h6v8h-2v3l-3-3h-4v-2"/></svg>',
  autor:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 8h5M16 12h5M18 16h3"/></svg>',
  memoria:'<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>',
  copiar:'<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
};

/* =========================================================
   Dados de exemplo
   ========================================================= */
const FUNCOES = [
  {id:'conceito', nome:'Conceito', desc:'Definições e ideias centrais'},
  {id:'evidencia', nome:'Evidência', desc:'Dados, resultados, exemplos'},
  {id:'metodo', nome:'Método', desc:'Como o autor fez'},
  {id:'critica', nome:'Crítica', desc:'Onde discordo ou desconfio'},
  {id:'dissert', nome:'Para a dissertação', desc:'Vai direto para meu texto'},
];
const ETAPAS = ['Pré-leitura','Leitura','Fichamento','Conexão'];

const PROJETOS = [
  {id:'diss', nome:'Dissertação', cor:'#1F4A5A'},
  {id:'art', nome:'Artigo sobre greenwashing', cor:'#B8645A'},
  {id:'pi', nome:'Trabalho em grupo', cor:'#7A8B3C'},
];
const DISCIPLINAS = ['Metodologia de Pesquisa','Pesquisa Operacional','Sustentabilidade e Organizações'];

const LEITURAS = [
  {id:'goldkuhl2012', aut:'Goldkuhl, G.', ano:2012, tit:'Pragmatism vs interpretivism in qualitative information systems research', veic:'European Journal of Information Systems, 21(2)', proj:'diss', disc:'Metodologia de Pesquisa', conc:['Pragmatismo','DSR'], tags:['qualificação','base epistemológica'], etapa:2, pag:'p. 7 de 12', hl:{conceito:6,evidencia:2,metodo:3,critica:2,dissert:3},
    abnt:'GOLDKUHL, G. Pragmatism vs interpretivism in qualitative information systems research. <i>European Journal of Information Systems</i>, v. 21, n. 2, p. 135-146, 2012.'},
  {id:'venable2016', aut:'Venable, J.; Pries-Heje, J.; Baskerville, R.', ano:2016, tit:'FEDS: a Framework for Evaluation in Design Science Research', veic:'European Journal of Information Systems, 25(1)', proj:'diss', disc:'Metodologia de Pesquisa', conc:['Avaliação de artefatos','DSR'], tags:['qualificação','avaliação'], etapa:3, pag:'lido', hl:{conceito:5,evidencia:1,metodo:7,critica:1,dissert:4},
    abnt:'VENABLE, J.; PRIES-HEJE, J.; BASKERVILLE, R. FEDS: a Framework for Evaluation in Design Science Research. <i>European Journal of Information Systems</i>, v. 25, n. 1, p. 77-89, 2016.'},
  {id:'hevner2004', aut:'Hevner, A.; March, S.; Park, J.; Ram, S.', ano:2004, tit:'Design science in information systems research', veic:'MIS Quarterly, 28(1)', proj:'diss', disc:'Metodologia de Pesquisa', conc:['DSR'], tags:['qualificação','clássico'], etapa:5, pag:'lido', hl:{conceito:9,evidencia:2,metodo:5,critica:3,dissert:5},
    abnt:'HEVNER, A. R.; MARCH, S. T.; PARK, J.; RAM, S. Design science in information systems research. <i>MIS Quarterly</i>, v. 28, n. 1, p. 75-105, 2004.'},
  {id:'peffers2007', aut:'Peffers, K. et al.', ano:2007, tit:'A design science research methodology for information systems research', veic:'Journal of Management Information Systems, 24(3)', proj:'diss', disc:'Metodologia de Pesquisa', conc:['DSR'], tags:['qualificação','clássico'], etapa:5, pag:'lido', hl:{conceito:4,evidencia:1,metodo:8,critica:1,dissert:3},
    abnt:'PEFFERS, K. et al. A design science research methodology for information systems research. <i>Journal of Management Information Systems</i>, v. 24, n. 3, p. 45-77, 2007.'},
  {id:'gregor2013', aut:'Gregor, S.; Hevner, A.', ano:2013, tit:'Positioning and presenting design science research for maximum impact', veic:'MIS Quarterly, 37(2)', proj:'diss', disc:'Metodologia de Pesquisa', conc:['DSR'], tags:['qualificação'], etapa:5, pag:'lido', hl:{conceito:5,evidencia:0,metodo:3,critica:2,dissert:2},
    abnt:'GREGOR, S.; HEVNER, A. R. Positioning and presenting design science research for maximum impact. <i>MIS Quarterly</i>, v. 37, n. 2, p. 337-355, 2013.'},
  {id:'iivari2007', aut:'Iivari, J.', ano:2007, tit:'A paradigmatic analysis of information systems as a design science', veic:'Scandinavian Journal of Information Systems, 19(2)', proj:'diss', disc:'Metodologia de Pesquisa', conc:['DSR','Pragmatismo'], tags:['qualificação','base epistemológica'], etapa:1, pag:'p. 1 de 26', hl:{conceito:1,evidencia:0,metodo:0,critica:0,dissert:0},
    abnt:'IIVARI, J. A paradigmatic analysis of information systems as a design science. <i>Scandinavian Journal of Information Systems</i>, v. 19, n. 2, p. 39-64, 2007.'},
  {id:'moraes2024', aut:'Moraes, T.; Lins, R.', ano:2024, tit:'RotaCoop: roteirização colaborativa para cooperativas de reciclagem (obra fictícia de exemplo)', veic:'Periódico fictício', proj:'diss', disc:'Metodologia de Pesquisa', conc:['Roteirização','Avaliação de artefatos'], tags:['qualificação','precedente direto'], etapa:3, pag:'lido', hl:{conceito:3,evidencia:6,metodo:4,critica:5,dissert:2},
    abnt:'MORAES, T.; LINS, R. RotaCoop: roteirização colaborativa para cooperativas de reciclagem. <i>Revista de exemplo</i>, 2024. [obra fictícia, criada para o protótipo]'},
  {id:'teixeira2021', aut:'Teixeira, L.', ano:2021, tit:'Sustentabilidade de vitrine: relatórios corporativos e greenwashing (obra fictícia de exemplo)', veic:'Capítulo de livro fictício', proj:'art', disc:'Sustentabilidade e Organizações', conc:['Greenwashing'], tags:['artigo da disciplina'], etapa:4, pag:'lido', hl:{conceito:4,evidencia:1,metodo:0,critica:3,dissert:2},
    abnt:'TEIXEIRA, L. Sustentabilidade de vitrine: relatórios corporativos e greenwashing. In: <i>Organizações e sustentabilidade</i>. [obra fictícia, criada para o protótipo], 2021.'},
  {id:'nogueira2023', aut:'Nogueira, A.; Prado, C.', ano:2023, tit:'Reputação como ativo: o relatório de sustentabilidade no mercado de capitais (obra fictícia de exemplo)', veic:'Livro fictício', proj:'art', disc:'Sustentabilidade e Organizações', conc:['Greenwashing'], tags:['artigo da disciplina'], etapa:2, pag:'cap. 4 de 9', hl:{conceito:7,evidencia:4,metodo:0,critica:2,dissert:1},
    abnt:'NOGUEIRA, A.; PRADO, C. <i>Reputação como ativo</i>: o relatório de sustentabilidade no mercado de capitais. [obra fictícia, criada para o protótipo], 2023.'},
  {id:'brans1985', aut:'Brans, J. P.; Vincke, Ph.', ano:1985, tit:'A preference ranking organisation method: the PROMETHEE method for multiple criteria decision-making', veic:'Management Science, 31(6)', proj:'pi', disc:'Pesquisa Operacional', conc:['PROMETHEE'], tags:['seção 4'], etapa:3, pag:'lido', hl:{conceito:3,evidencia:1,metodo:6,critica:0,dissert:1},
    abnt:'BRANS, J. P.; VINCKE, Ph. A preference ranking organisation method: the PROMETHEE method for multiple criteria decision-making. <i>Management Science</i>, v. 31, n. 6, p. 647-656, 1985.'},
  {id:'saaty1980', aut:'Saaty, T. L.', ano:1980, tit:'The Analytic Hierarchy Process', veic:'McGraw-Hill (livro)', proj:'pi', disc:'Pesquisa Operacional', conc:['AHP'], tags:['seção 4','clássico'], etapa:5, pag:'lido', hl:{conceito:5,evidencia:0,metodo:6,critica:1,dissert:1},
    abnt:'SAATY, T. L. <i>The Analytic Hierarchy Process</i>. New York: McGraw-Hill, 1980.'},
  {id:'gregor2006', aut:'Gregor, S.', ano:2006, tit:'The nature of theory in information systems', veic:'MIS Quarterly, 30(3)', proj:'diss', disc:'Metodologia de Pesquisa', conc:['DSR'], tags:['a ler'], etapa:0, pag:'não iniciado', hl:{conceito:0,evidencia:0,metodo:0,critica:0,dissert:0},
    abnt:'GREGOR, S. The nature of theory in information systems. <i>MIS Quarterly</i>, v. 30, n. 3, p. 611-642, 2006.'},
];

const TRILHAS = [
  {id:'qualif', nome:'Leituras para a qualificação', proj:'diss', prazo:'mar. 2027', falta:'≈ 4 meses', urgente:false,
    desc:'Base epistemológica e metodológica do capítulo de método',
    itens:['hevner2004','peffers2007','gregor2013','goldkuhl2012','venable2016','moraes2024','iivari2007','gregor2006']},
  {id:'artigo', nome:'Artigo para a disciplina', proj:'art', prazo:'28 nov.', falta:'em 15 dias', urgente:false,
    desc:'Greenwashing e o relatório como peça de reputação',
    itens:['teixeira2021','nogueira2023']},
  {id:'pi8', nome:'Seção 4 do trabalho em grupo', proj:'pi', prazo:'20 nov.', falta:'em 7 dias', urgente:true,
    desc:'Análise de sensibilidade da escolha do ecoponto',
    itens:['saaty1980','brans1985']},
];

const ARGUMENTOS = [
  {id:'simul', tese:'A economia de 18% relatada para o RotaCoop foi medida em simulação, não na operação das cooperativas.', tipo:'Crítica a precedente', forca:3, fontes:['moraes2024','venable2016'], usado:'Trabalhos relacionados',
    trechos:[
      {t:'Os autores relatam economia de 18% na quilometragem, mas todas as rotas foram geradas e comparadas em simulação, sem que as equipes de coleta as percorressem. O resultado, nessas condições, tende a superestimar o ganho na operação.', c:'(Moraes; Lins, 2024)'},
      {t:'Uma avaliação que pretenda sustentar a utilidade de um artefato precisa observá-lo em uso no contexto real antes de afirmar seus efeitos.', c:'(Venable; Pries-Heje; Baskerville, 2016)'},
    ]},
  {id:'adesao', tese:'Para roteirizadores em cooperativas, a adesão das equipes às rotas na operação é critério de avaliação mais adequado que a economia de quilometragem em simulação.', tipo:'Decisão metodológica', forca:4, fontes:['goldkuhl2012','venable2016','moraes2024'], usado:'Método',
    trechos:[
      {t:'Sob uma postura pragmatista, o que garante o conhecimento produzido pelo artefato não é o consenso entre observadores, mas a regularidade das consequências de aplicá-lo repetidamente em condições comparáveis.', c:'(Goldkuhl, 2012)'},
      {t:'Como a rota proposta só gera economia se for percorrida, é preciso medir a adesão das equipes antes de afirmar utilidade.', c:'(Moraes; Lins, 2024)'},
    ]},
  {id:'pragm', tese:'O pragmatismo sustenta de forma coerente as três camadas da DSR, do problema à avaliação.', tipo:'Posicionamento', forca:5, fontes:['goldkuhl2012','iivari2007','hevner2004'], usado:'Método',
    trechos:[
      {t:'Adotar o pragmatismo em todas as camadas evita a incoerência de justificar o artefato pela utilidade e avaliá-lo por critérios interpretativistas.', c:'(Goldkuhl, 2012; Iivari, 2007)'},
    ]},
  {id:'quem', tese:'“Utilidade para quem?” Declarar o critério de utilidade é também uma escolha sobre quem o artefato serve.', tipo:'Reflexividade', forca:2, fontes:['venable2016'], usado:'Limitações',
    trechos:[
      {t:'Declarar ex ante o critério de utilidade protege a avaliação contra racionalizações posteriores, mas não a torna neutra.', c:'(Venable; Pries-Heje; Baskerville, 2016)'},
    ]},
];

const CARTOES = [
  {tipo:'conceito', q:'Quais são as três vertentes de pragmatismo que Goldkuhl distingue, e o que cada uma enfatiza?', r:'Funcional: o conhecimento como instrumento para a ação. Referencial: a ação como objeto do que se estuda. Metodológico: conhecer intervindo no mundo e observando as consequências.', origem:'Grifo de conceito em Goldkuhl (2012)'},
  {tipo:'metodo', q:'No FEDS, quais são as duas dimensões que organizam as estratégias de avaliação?', r:'O propósito da avaliação (formativa ou somativa) e o paradigma (artificial ou naturalístico). As estratégias são trajetórias nesse espaço ao longo do projeto.', origem:'Grifo de método em Venable et al. (2016)'},
  {tipo:'critica', q:'Por que uma simulação é uma base frágil para afirmar a utilidade de um roteirizador?', r:'Porque a economia só existe se as equipes percorrem a rota: sem observar a operação real, não se sabe se o ganho se mantém ou se as rotas são abandonadas.', origem:'Grifo de crítica em Moraes; Lins (2024)'},
];

const DOC_HTML = `
<div class="cabeca">
<div class="aviso-demo">Texto de demonstração escrito para o protótipo. Não é o texto do artigo; na versão funcional, o PDF real aparece aqui.</div>
<h1>Pragmatism vs interpretivism in qualitative information systems research</h1>
<div class="autores">Göran Goldkuhl, European Journal of Information Systems, 2012</div>
</div>
<h2>1. A third position</h2>
<p>Qualitative research in information systems has long been framed as a choice between positivist and interpretive commitments. This framing leaves out a third tradition that has quietly shaped much of the field’s design-oriented work. Where interpretivism asks how actors make sense of their world, <mark class="conceito" data-id="g1">pragmatism asks what difference knowledge makes when it is put to use</mark>.</p>
<p>Three strands can be separated for analytical purposes. <mark class="conceito" data-id="g2">Functional pragmatism treats knowledge as an instrument for action.</mark> Referential pragmatism places action itself at the centre of what is studied. <mark class="metodo" data-id="g3" data-nota="1">Methodological pragmatism holds that we come to know the world by intervening in it and observing the consequences.</mark></p>
<div class="pag">p. 137</div>
<h2>2. Consequences for design-oriented research</h2>
<p>For design-oriented research, the consequence is significant. An artefact is not only an object to be described but a proposition about how a situation could be improved. Evaluating it therefore <mark class="dissert" data-id="g4">requires criteria declared before use, so that utility is not reconstructed after the fact</mark> to fit whatever results appeared.</p>
<p>This does not dissolve the interpretive concern with meaning. <mark class="critica" data-id="g5" data-nota="1">Users still interpret the artefact, and those interpretations shape whether it works.</mark> The difference lies in where the researcher anchors the claim: in the coherence of an account, or in the observable consequences of acting on it.</p>
<p>A pragmatist stance also changes how disagreement is handled. Instead of seeking agreement between independent observers as the main warrant, the researcher can ask <mark class="dissert" data-id="g6">whether repeated applications of the same procedure lead to stable, useful outcomes</mark> under comparable conditions.</p>
<div class="pag">p. 138</div>
<h2>3. Situating the debate</h2>
<p>None of this implies that pragmatism is free of tension. Its emphasis on usefulness invites the question of who defines what counts as useful, and for whom. A researcher who adopts it should be ready to make those choices explicit rather than leave them hidden inside the evaluation design.</p>
<p>The remainder of this paper examines how these positions differ in their view of knowledge, data and the role of the researcher, and what each offers to studies that build and evaluate artefacts in organisational settings.</p>
`;

/* =========================================================
   Estado
   ========================================================= */
const S = {
  filtros:{proj:null,disc:null,conc:null,tag:null,etapa:null}, busca:'',
  modoLeitura:'limpa', foco:false, logFiltro:'tudo', discAba:'geral', aulaAba:'transcricao', passoTexto:4, marcas:false, abaEsc:'copilot', dlg:'d1', verGrifos:false, verTutor:false, versao:'v3', tipoReg:'Áudio', tema:'claro', abaTutor:'tutor', passoFich:3, argSel:'adesao', cartao:0, virado:false,
  conversa:[
    {de:'eu', trecho:'Users still interpret the artefact, and those interpretations shape whether it works.', t:'Isso muda meu argumento pela adesão?'},
    {de:'tutor', t:['Muda o foco, e a seu favor, mas obriga você a separar duas coisas. A economia simulada mede se o roteirizador produz rotas mais curtas no papel. A interpretação das equipes decide se essas rotas são percorridas.','Pergunta para você: na sua avaliação, onde entra o julgamento de quem percorre as rotas? Se ele não aparece em nenhum critério declarado ex ante, a banca pode apontar essa lacuna.']},
  ],
};
const L = id => LEITURAS.find(l=>l.id===id);
const P = id => PROJETOS.find(p=>p.id===id);
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const citCurta = l => { const a=l.aut.split(';').map(x=>x.trim().split(',')[0]); const nome=a.length===1?a[0].replace(/ et al\.$/,'')+(l.aut.includes('et al.')?' et al.':''):a.length===2?a[0]+' e '+a[1]:a[0]+' et al.'; return `${nome} (${l.ano??'s.d.'})`; };

function pips(etapa){
  let h='<span class="pips" aria-label="Etapa: '+(etapa===0?'na fila':etapa>4?'concluída':ETAPAS[etapa-1])+'">';
  for(let i=1;i<=4;i++) h+=`<i class="${i<etapa?'on':i===etapa?'agora':''}"></i>`;
  return h+'</span>';
}
function rotEtapa(e){return e===0?'Na fila':e>4?'Concluída':ETAPAS[e-1]}
function hlbar(hl){
  const tot=Object.values(hl).reduce((a,b)=>a+b,0);
  if(!tot) return '<div class="hlbar"></div>';
  return '<div class="hlbar">'+FUNCOES.map(f=>hl[f.id]?`<span class="c-${f.id}" style="width:${hl[f.id]/tot*100}%"></span>`:'').join('')+'</div>';
}
// Tela abrindo: o título real e blocos na forma do conteúdo (esqueleto), nunca "Carregando…" sozinho.
function esqueleto(titulo,forma){
  const linhas=n=>Array.from({length:n},(_,i)=>`<span class="esq esq-linha ${i%3===2?'curta':i%3===1?'media':''}"></span>`).join('');
  const cartao=n=>`<div class="esq-cartao"><span class="esq esq-titulo"></span>${linhas(n)}</div>`;
  const corpo=forma==='grade'?`<div class="esq-grade">${cartao(2)}${cartao(2)}${cartao(2)}</div>`:forma==='texto'?cartao(8):cartao(2)+cartao(2)+cartao(2);
  return `<div class="topo"><div><h1>${titulo}</h1><p class="sr">Abrindo seus dados</p></div></div><div aria-busy="true" aria-label="Abrindo ${titulo}">${corpo}</div>`;
}
function toast(t,desfazer){const el=document.getElementById('toast');el.innerHTML='<span></span>';el.firstChild.textContent=t;if(desfazer){const b=document.createElement('button');b.textContent='Desfazer';b.onclick=()=>{desfazer();el.classList.remove('on')};el.appendChild(b)}el.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('on'),desfazer?5000:2400)}

/* =========================================================
   Menu
   ========================================================= */
const CORES_DISC = ['#8A6D3B','#7A8B3C','#B8645A'];
const SECOES = {
  bib:{nome:'Ler', tabs:[['biblioteca','Leituras'],['trilhas','Trilhas'],['fichamentos','Fichamentos']]},
  esc:{nome:'Escrever', tabs:[['escrita','Textos'],['dialogos','Diálogos']]},
  diss:{nome:'Dissertação', tabs:[['projeto','Revisão do projeto'],['orientacao','Orientação'],['argumentos','Argumentos']]},
  voce:{nome:'Você', tabs:[['autor','Overview do autor'],['memoria','Memória'],['ajustes','Ajustes']]},
};
const SECAO_DE = {}; Object.entries(SECOES).forEach(([k,v])=>v.tabs.forEach(([r])=>SECAO_DE[r]=k));
Object.assign(SECAO_DE,{leitor:'bib',fichamento:'bib',texto:'esc',cartoes:'hoje',organizar:'voce'});
function desenhaMenu(rota){
  const [base]=rota.split('/');
  const sec=SECAO_DE[base];
  const emProjeto=base==='disciplinas'||base==='disciplina'||base==='aula';
  const ativo=(k)=> (k==='painel'&&(base==='painel'||base==='cartoes'||!base)) || (k==='bib'&&sec==='bib') || (k==='esc'&&sec==='esc') || (k==='diss'&&sec==='diss') || (k==='proj'&&emProjeto);
  const it=(k,href,rot,sub='')=>`<li${sub?' class="tem-sub"':''}><a class="item ${ativo(k)?'ativo':''}" href="${href}" ${ativo(k)?'aria-current="page"':''}><span class="rot">${rot}</span></a>${sub}</li>`;
  const projetos=modoReal() ? (window.rb&&window.rb.disciplinasUI ? window.rb.disciplinasUI.menu().map(d=>['#disciplina/'+encodeURIComponent(d.id),esc(d.nome)]) : []) : DISCIPLINAS.map((d,i)=>['#disciplina/'+i,d]);
  const sub=`<ul class="sub" aria-label="Projetos">${projetos.map(([h,n])=>`<li><a href="${h}">${n}</a></li>`).join('')}<li><a href="#disciplinas">Ver todos</a></li></ul>`;
  // Barra do topo, com os cinco lugares do app. Você (overview, memória e ajustes) fica no avatar.
  document.getElementById('menu').innerHTML =
    it('painel','#painel','Hoje') + it('bib','#biblioteca','Ler') + it('esc','#escrita','Escrever') + it('diss','#projeto','Dissertação') + it('proj','#disciplinas','Projetos',sub);
  const voceAtivo=sec==='voce';
  document.getElementById('voce').innerHTML=`<div id="status-drive">${statusDriveHTML()}</div><button class="busca-k" data-acao="busca" aria-label="Buscar (Ctrl+K)"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><span class="rot">Buscar</span><kbd>Ctrl K</kbd></button><a class="item ${voceAtivo?'ativo':''}" href="#autor" title="Você: overview, memória e ajustes"><span class="av">V</span><span class="rot-voce">Você<small>Memória e ajustes</small></span></a><span class="selo-versao">${modoReal()?`Versão ${APP_VERSAO}`:`Protótipo v${APP_VERSAO}, dados de exemplo`}</span>`;
  // Celular: ler e o dia em primeiro lugar; o resto fica em Mais.
  const maisAtivo=!ativo('painel')&&!ativo('bib');
  const tb=[['#painel','Hoje',ativo('painel')],['#biblioteca','Ler',ativo('bib')],['#mais','Mais',maisAtivo]];
  document.getElementById('tabbar').innerHTML=tb.map(([h,r,on])=>`<a href="${h}" class="${on?'ativo':''}" ${on?'aria-current="page"':''}>${r}</a>`).join('');
}
function secaoCab(base){
  const k=SECAO_DE[base]; const sec=SECOES[k]; if(!sec) return '';
  return `<div class="sec-cab"><h1>${sec.nome}</h1><nav class="subnav" aria-label="${sec.nome}">${sec.tabs.map(([r,n])=>`<a href="#${r}" class="${r===base?'on':''}" ${r===base?'aria-current="page"':''}>${n}</a>`).join('')}</nav></div>`;
}

/* =========================================================
   Vistas
   ========================================================= */
const V = {};

V.painel = () => {
  if(modoReal()) return window.rb&&window.rb.hojeUI ? window.rb.hojeUI.tela() : esqueleto('Hoje');
  const g=L('goldkuhl2012');
  const tot={}; FUNCOES.forEach(f=>tot[f.id]=0);
  LEITURAS.forEach(l=>FUNCOES.forEach(f=>tot[f.id]+=l.hl[f.id]));
  const maxT=Math.max(...Object.values(tot));
  const semana=[['seg',35],['ter',20],['qua',0],['qui',55],['sex',42],['sáb',70],['dom',25]];
  const seta='<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>';
  return `
  <div class="topo">
    <div><h1>Sexta, 13 de novembro</h1><p>Ontem: 42 minutos de leitura, 6 grifos e 1 fichamento concluído.</p></div>
  </div>
  <div class="hoje-grid">
    <section class="proximo" aria-labelledby="prox-t">
      <div class="rot" id="prox-t">Próximo passo: continue <b>${esc(g.tit)}</b>, ${citCurta(g)}</div>
      <blockquote>A pragmatist stance also changes how disagreement is handled. Instead of seeking agreement between independent observers as the main warrant, the researcher can ask <mark class="dissert">whether repeated applications of the same procedure lead to stable, useful outcomes</mark> under comparable conditions.</blockquote>
      <div class="acao-l"><a class="btn prim" href="#leitor/goldkuhl2012">Continuar leitura</a><span>Faltam cerca de 12 minutos para o fim da seção</span></div>
      <div class="pergunta-t">
        <div class="quem">${I.tutor}</div>
        <p><small>Pergunta do tutor sobre o seu último grifo</small>Este trecho sustenta a troca da economia simulada pela adesão das equipes, ou apenas a torna aceitável?</p>
      </div>
    </section>
    <aside class="tambem" aria-labelledby="tamb-t">
      <h2 id="tamb-t">Também para hoje</h2>
      <a href="#cartoes" data-cartoes><b>Revisar 3 cartões</b><span>Cerca de 3 minutos</span>${seta}</a>
      <a href="#aula/0/m7"><b>Aula de ontem transcrita</b><span>Metodologia de Pesquisa: resumo e 4 cartões prontos</span>${seta}</a>
      <a href="#disciplina/1"><b>Seção 4 do trabalho em grupo</b><span class="urg">Entrega em 7 dias</span>${seta}</a>
    </aside>
  </div>
  <details class="semana-det">
    <summary>Sua semana</summary>
    <div class="bento">
      <section class="span-2 bloco"><h3>Minutos de leitura</h3>
        <div class="semana">${semana.map(([d,m],i)=>`<div class="${i===4?'hoje':''}"><i style="height:${Math.max(m,3)/70*72}px"></i>${d}</div>`).join('')}</div></section>
      <section class="span-2 bloco"><h3>Seus grifos, por função</h3>
        <div class="dist">${FUNCOES.map(f=>`<div><span>${f.nome}</span><span class="trilho"><i class="c-${f.id}" style="width:${tot[f.id]/maxT*100}%"></i></span><span class="mute-2">${tot[f.id]}</span></div>`).join('')}</div></section>
      <section class="span-2 bloco b-arg"><h3>Argumento mais sustentado</h3>
        <blockquote>${ARGUMENTOS[2].tese}</blockquote><a class="btn" href="#argumentos" data-arg="pragm">Abrir argumento</a></section>
    </div>
  </details>`;
};

const FACETAS = [['proj','Projeto'],['etapa','Etapa'],['disc','Disciplina'],['conc','Conceito'],['tag','Tag']];
V.biblioteca = () => {
  if(modoReal()) return window.rb&&window.rb.bibUI ? window.rb.bibUI.lista() : '<div class="topo"><div><h1>Biblioteca</h1><p>Abrindo a biblioteca…</p></div></div>';
  const f=S.filtros, b=S.busca.toLowerCase();
  const lista=LEITURAS.filter(l=>
    (!f.proj||l.proj===f.proj)&&(!f.disc||l.disc===f.disc)&&(!f.conc||l.conc.includes(f.conc))&&(!f.tag||l.tags.includes(f.tag))&&
    (f.etapa===null||l.etapa===f.etapa)&&(!b||(l.tit+l.aut+l.conc.join(' ')+l.tags.join(' ')).toLowerCase().includes(b)));
  const conta=(fn)=>LEITURAS.filter(fn).length;
  const opcoes={
    proj:PROJETOS.map(p=>[p.id,p.nome,conta(l=>l.proj===p.id)]),
    etapa:[0,1,2,3,4,5].map(e=>[e,rotEtapa(e),conta(l=>l.etapa===e)]),
    disc:DISCIPLINAS.map(d=>[d,d,conta(l=>l.disc===d)]),
    conc:[...new Set(LEITURAS.flatMap(l=>l.conc))].sort().map(c=>[c,c,conta(l=>l.conc.includes(c))]),
    tag:[...new Set(LEITURAS.flatMap(l=>l.tags))].sort().map(t=>[t,'#'+t,conta(l=>l.tags.includes(t))]),
  };
  const rotVal=(k,v)=>k==='proj'?P(v).nome:k==='etapa'?rotEtapa(v):k==='tag'?'#'+v:v;
  return `
  <div class="topo">
    <div><h1>Biblioteca</h1><p>${LEITURAS.length} obras. Abra uma obra para ler e grifar.</p></div>
    <div class="acoes">
      <label class="busca">${I.busca}<input id="busca" type="search" placeholder="Buscar título, autor, conceito" value="${esc(S.busca)}"></label>
      <button class="btn prim" data-acao="adicionar">${I.mais}Adicionar obra</button>
    </div>
  </div>
  <div class="filtros-barra" role="group" aria-label="Filtros">
    ${FACETAS.map(([k,n])=>`<details class="filtro ${f[k]!==null?'ativo':''}"><summary>${f[k]!==null?esc(rotVal(k,f[k])):n}</summary><div class="filtro-menu">${opcoes[k].map(([v,r,q])=>`<button class="${f[k]===v?'on':''}" data-faceta="${k}" data-valor="${esc(v)}">${r}<span class="q">${q}</span></button>`).join('')}</div></details>`).join('')}
    ${Object.values(f).some(v=>v!==null)?'<button class="btn fant" data-acao="limpar-filtros">Limpar filtros</button>':''}
  </div>
  <div class="tabela" role="table">
    <div class="linha-lv cab" role="row"><span>Leitura</span><span>Etapa</span><span>Progresso</span></div>
    ${lista.length?lista.map(l=>`
    <div class="linha-lv" role="row" tabindex="0" data-abrir="${l.id}">
      <div>
        <div class="tit">${esc(l.tit)}</div>
        <div class="aut">${esc(l.aut)}, ${l.ano??'s.d.'}. ${esc(l.veic)}</div>
        <div class="tags"><span class="chip proj"><span class="proj-dot" style="background:${P(l.proj).cor}"></span>${P(l.proj).nome}</span>${l.conc.map(c=>`<span class="chip">${c}</span>`).join('')}</div>
      </div>
      <div class="est"><span>${rotEtapa(l.etapa)}</span>${pips(l.etapa)}</div>
      <div class="prog">${l.pag}<small>${Object.values(l.hl).reduce((a,b)=>a+b,0)} grifos</small></div>
    </div>`).join(''):`<div class="vazio">Nenhuma leitura com esses filtros. <button class="btn" data-acao="limpar-filtros">Limpar filtros</button></div>`}
  </div>`;
};

function trilhaHTML(t){
  const feitos=t.itens.filter(i=>L(i).etapa>4);
  const abertos=t.itens.filter(i=>L(i).etapa<=4);
  const agora=abertos.find(i=>L(i).etapa>0)||abertos[0];
  const acaoDe=(i,l)=>l.etapa===0?['Começar pré-leitura',`#leitor/${i}`]:l.etapa===1?['Continuar pré-leitura',`#leitor/${i}`]:l.etapa===2?['Continuar leitura',`#leitor/${i}`]:l.etapa===3?['Abrir fichamento',`#fichamento/${i}`]:['Conectar a argumentos','#argumentos'];
  return `<section class="trilha">
    <header>
      <div><h2>${t.nome}</h2><p>${t.desc}. ${feitos.length} de ${t.itens.length} concluídas.</p></div>
      <div class="prazo ${t.urgente?'urgente':''}"><b>${t.prazo}</b><small>${t.falta}</small></div>
    </header>
    <ol class="seq">
      ${abertos.map(i=>{const l=L(i);const a=acaoDe(i,l);const cls=i===agora?'agora':'';
        return `<li class="${cls}"><div><div class="t">${esc(l.tit)}</div><div class="a">${citCurta(l)}, ${l.pag}</div></div>${pips(l.etapa)}<a class="btn ${cls?'prim':'fant'} acao" href="${a[1]}">${a[0]}</a></li>`}).join('')}
    </ol>
    ${feitos.length?`<details class="concluidas"><summary>Ver ${feitos.length} concluída${feitos.length>1?'s':''}</summary><ol class="seq feitas">${feitos.map(i=>{const l=L(i);return `<li><div><div class="t">${esc(l.tit)}</div><div class="a">${citCurta(l)}</div></div>${pips(l.etapa)}<a class="btn fant acao" href="#fichamento/${i}">Rever fichamento</a></li>`}).join('')}</ol></details>`:''}
  </section>`;
}
V.organizar = () => modoReal() ? (window.rb&&window.rb.organizarUI ? window.rb.organizarUI.tela() : esqueleto('Organizar')) : `<div class="topo"><div><h1>Organizar</h1><p>Com os seus dados, aqui aparecem os DOIs encontrados para conferir e as obras repetidas.</p></div></div><div class="vazio-estado"><h2>Nada para organizar no exemplo</h2><p>Entre com o Google para importar PDFs ou a biblioteca do Zotero e organizar as suas obras.</p></div>`;
V.trilhas = () => modoReal() ? (window.rb&&window.rb.trilhasUI ? window.rb.trilhasUI.tela() : esqueleto('Trilhas')) : `
  <div class="topo">
    <div><h1>Trilhas</h1><p>Filas de leitura com prazo. Cada leitura passa por pré-leitura, leitura, fichamento e conexão.</p></div>
    <div class="acoes"><button class="btn" data-acao="toast" data-msg="Na versão funcional, você cria trilhas e arrasta leituras para ordenar.">${I.mais}Nova trilha</button></div>
  </div>
  ${TRILHAS.map(trilhaHTML).join('')}`;

V.leitor = (id) => {
  if(modoReal()){
    const real=window.rb&&window.rb.bibUI&&window.rb.bibUI.leitor(decodeURIComponent(id||''));
    if(real) return real;
    if(!window.rb||!window.rb.bibUI) return esqueleto('Leitor', 'texto');
  }
  const l=L(id)||L('goldkuhl2012');
  const grifos=[...DOC_HTML.matchAll(/<mark class="(\w+)" data-id="(\w+)"[^>]*>(.*?)<\/mark>/g)].map(m=>({cor:m[1],id:m[2],t:m[3]}));
  return `
  <div class="leitor-barra">
    <a class="btn fant" href="#biblioteca">${I.voltar}Biblioteca</a>
    <div class="tit">${esc(l.tit)}<small>${citCurta(l)}, etapa: ${rotEtapa(l.etapa)}</small></div>
    <div class="alterna" role="group" aria-label="Painéis do leitor">
      <button class="txt" data-alt="verGrifos" aria-pressed="${S.verGrifos}">${I.painelEsq}Grifos</button>
      <button class="txt" data-alt="verTutor" aria-pressed="${S.verTutor}">${I.painelDir}Tutor</button>
      <button class="txt" data-alt="foco" aria-pressed="${S.foco}" title="Oculta menu e painéis (tecla F)">${I.foco}Foco</button>
    </div>
    <details class="aa"><summary aria-label="Aparência do texto">Aa</summary>
      <div class="aa-menu">
        <div><label>Formato</label><div class="seg"><button data-modo="limpa" class="${S.modoLeitura==='limpa'?'on':''}">Leitura limpa</button><button data-modo="pdf" class="${S.modoLeitura==='pdf'?'on':''}">PDF original</button></div></div>
        <div><label>Tema</label><div class="seg"><button data-tema="claro" class="${S.tema==='claro'?'on':''}">Claro</button><button data-tema="sepia" class="${S.tema==='sepia'?'on':''}">Sépia</button></div></div>
      </div>
    </details>
    <div class="dir"><span class="t-legenda mute-2">p. 7 de 12</span><a class="btn prim" href="#fichamento/${l.id}">Concluir e fichar</a></div>
  </div>
  <div class="leitor-grid ${S.verGrifos?'':'sem-grifos'} ${S.verTutor?'':'sem-tutor'}">
    <aside class="col-grifos" aria-label="Grifos neste texto">
      <button class="fechar-folha" data-alt="verGrifos">Fechar</button>
      <h4>Grifos neste texto</h4>
      <div id="lista-grifos">${listaGrifos(grifos)}</div>
    </aside>
    <div class="palco ${S.modoLeitura==='pdf'?'pdf':''} ${S.tema==='sepia'&&S.modoLeitura!=='pdf'?'sepia':''}" id="palco">
      <article class="doc" id="doc">${DOC_HTML}</article>
    </div>
    <aside class="col-tutor" aria-label="Tutor e notas">
      <button class="fechar-folha" data-alt="verTutor">Fechar</button>
      <div class="abas" role="tablist">
        <button role="tab" data-aba="tutor" class="${S.abaTutor==='tutor'?'on':''}">Tutor</button>
        <button role="tab" data-aba="notas" class="${S.abaTutor==='notas'?'on':''}">Notas</button>
      </div>
      ${S.abaTutor==='tutor'?tutorHTML():notasHTML()}
    </aside>
  </div>`;
};

function listaGrifos(grifos){
  return grifos.map(g=>`<button class="grifo-item" style="border-color:var(--hl-${g.cor})" data-ir="${g.id}">${g.t}<small>${FUNCOES.find(f=>f.id===g.cor).nome}</small></button>`).join('');
}
function tutorHTML(){
  return `
  <div class="tutor-corpo" id="conversa">
    <details class="guia">
      <summary>Perguntas para ler com propósito <span class="mute-2">2 de 3</span></summary>
      <ol>
        <li class="ok">Que problema o autor diz que a divisão positivismo x interpretativismo deixa de fora?</li>
        <li class="ok">Quais vertentes de pragmatismo ele distingue, e qual delas sustenta a DSR?</li>
        <li>O texto oferece algo que você possa usar para justificar a adesão das equipes como critério de avaliação?</li>
      </ol>
    </details>
    ${S.conversa.map(m=>m.de==='eu'
      ?`<div class="msg eu">${m.trecho?`<div class="trecho">${esc(m.trecho)}</div>`:''}${esc(m.t)}</div>`
      :`<div class="msg tutor"><span class="av">${I.tutor}</span><div>${m.t.map(p=>`<p>${esc(p)}</p>`).join('')}<div class="fb"><button data-fb="1">Útil</button><button data-fb="0">Não ajudou</button></div></div></div>`).join('')}
  </div>
  <div class="atalhos">
    <button data-atalho="Explique este trecho como se eu fosse da banca">Explique</button>
    <button data-atalho="Qual seria o contra-argumento mais forte?">Contraponha</button>
    <button data-atalho="Isso conversa com quais leituras minhas?">Conecte</button>
  </div>
  <form class="entrada" id="form-tutor">
    <textarea id="pergunta" placeholder="Pergunte ao tutor sobre este texto" aria-label="Pergunta ao tutor"></textarea>
    <button type="submit" aria-label="Enviar">${I.enviar}</button>
  </form>`;
}
function notasHTML(){
  return `<div class="tutor-corpo"><div class="notas-lista">
    <div class="nota"><div class="trecho" style="border-color:var(--hl-metodo)">Methodological pragmatism holds that we come to know the world by intervening in it…</div><p>É exatamente a lógica da DSR: construir o roteirizador é a intervenção. Usar na abertura do capítulo de método.</p><small>p. 137, ontem</small></div>
    <div class="nota"><div class="trecho" style="border-color:var(--hl-critica)">Users still interpret the artefact, and those interpretations shape whether it works.</div><p>Risco: banca pode dizer que ignoro o uso. Responder com a seção “utilidade para quem”.</p><small>p. 138, hoje</small></div>
  </div></div>
  <form class="entrada" data-demo-toast="Nota salva neste texto"><textarea placeholder="Escreva uma nota solta sobre o texto" aria-label="Nova nota"></textarea><button type="submit" aria-label="Salvar nota">${I.enviar}</button></form>`;
}

V.fichamentos = () => {
  if(modoReal()) return window.rb&&window.rb.fichUI ? window.rb.fichUI.lista() : esqueleto('Fichamentos', 'grade');
  const fich=['venable2016','moraes2024','brans1985','hevner2004','peffers2007','saaty1980'];
  const passosFeitos={venable2016:3,moraes2024:2,brans1985:4,hevner2004:5,peffers2007:5,saaty1980:5};
  return `
  <div class="topo"><div><h1>Fichamentos</h1><p>Cada fichamento passa por cinco etapas. Os grifos de cada cor alimentam a etapa correspondente.</p></div></div>
  <div class="fich-lista">
    ${fich.map(id=>{const l=L(id),n=passosFeitos[id];return `
    <a class="fich-card" href="#fichamento/${id}">
      <div class="t">${esc(l.tit)}</div>
      <div class="t-meta mute">${citCurta(l)}, ${P(l.proj).nome}</div>
      <div class="etp">${[1,2,3,4,5].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</div>
      <div class="t-legenda mute-2">${n>=5?'Completo':`Etapa ${n+1} de 5: ${PASSOS[n].nome}`}</div>
    </a>`}).join('')}
  </div>`;
};

const PASSOS = [
  {nome:'Referência', cores:[]},
  {nome:'Citações', cores:['conceito','evidencia','metodo','critica','dissert']},
  {nome:'Resumo', cores:['conceito','evidencia']},
  {nome:'Análise crítica', cores:['metodo','critica']},
  {nome:'Para a dissertação', cores:['dissert']},
];
const GRIFOS_VEN = [
  {cor:'conceito', t:'Evaluation is a central and essential activity in conducting rigorous design science research.', p:77},
  {cor:'metodo', t:'Two dimensions characterise evaluation: its functional purpose, formative or summative, and its paradigm, artificial or naturalistic.', p:80},
  {cor:'metodo', t:'Evaluation strategies are trajectories through this space over the course of a project.', p:81},
  {cor:'evidencia', t:'Four strategies are proposed: Quick & Simple, Human Risk & Effectiveness, Technical Risk & Efficacy, and Purely Technical.', p:82},
  {cor:'critica', t:'The framework assumes the evaluand is stable across episodes, which is not the case for stochastic artefacts.', p:84},
  {cor:'dissert', t:'Choosing a strategy should follow from the main risks the design faces.', p:83},
];
V.fichamento = (id) => {
  if(modoReal()){
    const real=window.rb&&window.rb.fichUI&&window.rb.fichUI.tela(decodeURIComponent(id||''));
    if(real) return real;
    if(!window.rb||!window.rb.fichUI) return esqueleto('Fichamento', 'texto');
    // Com os dados reais abertos, a tela de exemplo nunca aparece no lugar de um fichamento que não existe.
    return `<div class="topo"><div><h1>Fichamento</h1><p>Este fichamento não foi encontrado neste aparelho.</p></div></div><p><a class="btn" href="#fichamentos">Ver os fichamentos</a></p>`;
  }
  const l=L(id)||L('venable2016'); const p=S.passoFich;
  const cores=PASSOS[p].cores;
  const grifos=GRIFOS_VEN.filter(g=>!cores.length||cores.includes(g.cor));
  let corpo='';
  if(p===0) corpo=`
    <h2>Referência</h2><p class="instr">Confira os dados puxados pelo DOI. A referência ABNT é gerada a partir deles.</p>
    <div class="campo"><label>DOI</label><input value="10.1057/ejis.2014.36"></div>
    <div class="campo"><label>Referência ABNT gerada</label><div class="m-0 ref-abnt">${l.abnt}</div></div>`;
  if(p===1) corpo=`
    <h2>Citações</h2><p class="instr">Escolha os trechos que merecem citação direta. Para cada um, diga em uma frase por que ele importa para você.</p>
    ${GRIFOS_VEN.slice(0,3).map(g=>`<div class="citacao"><blockquote style="border-color:var(--hl-${g.cor})">${g.t}</blockquote><div class="cit">(Venable; Pries-Heje; Baskerville, 2016, p. ${g.p})</div><div class="m-0 campo"><textarea placeholder="Por que este trecho importa?"></textarea></div></div>`).join('')}`;
  if(p===2) corpo=`
    <h2>Resumo</h2><p class="instr">Explique o texto com suas palavras, sem olhar o PDF. Os grifos de conceito e evidência ficam ao lado como apoio.</p>
    <div class="campo"><label>Resumo <span>94 palavras</span></label><textarea style="min-height:220px">O artigo propõe o FEDS, um quadro para planejar a avaliação em pesquisas de design science. A avaliação é organizada em duas dimensões: o propósito (formativo ou somativo) e o paradigma (artificial ou naturalístico). Em vez de um único teste no fim, os autores defendem trajetórias de avaliação ao longo do projeto, escolhidas a partir dos riscos principais do design. Propõem quatro estratégias típicas e um processo em quatro passos para escolher entre elas.</textarea></div>`;
  if(p===3) corpo=`
    <h2>Análise crítica</h2><p class="instr">Responda a cada pergunta. O tutor revisa o conjunto quando você pedir.</p>
    <div class="campo"><label>Qual problema o texto enfrenta?</label><textarea>Pesquisadores de DSR avaliam de forma ad hoc, sem justificar por que escolheram aquela forma de avaliação.</textarea></div>
    <div class="campo"><label>Como os autores constroem o argumento?</label><textarea>Revisão da literatura de avaliação em DSR e síntese conceitual; o quadro é ilustrado com exemplos, não testado empiricamente.</textarea></div>
    <div class="campo"><label>Onde o texto é fraco ou discutível?</label><textarea placeholder="Use seus grifos de crítica"></textarea></div>
    <div class="campo"><label>Como isto conversa com a minha pesquisa?</label><textarea placeholder="Conecte com a dissertação ou outro projeto"></textarea></div>`;
  if(p===4) corpo=`
    <h2>Para a dissertação</h2><p class="instr">Escreva trechos que você usaria no texto final, já com a citação. Cada trecho é ligado a um argumento.</p>
    <div class="citacao"><div class="campo"><label>Trecho</label><textarea>A escolha da estratégia de avaliação não é neutra: ela decorre dos riscos que o design enfrenta (Venable; Pries-Heje; Baskerville, 2016). No caso de um roteirizador para cooperativas, o risco central é humano: rotas tecnicamente melhores podem não ser percorridas.</textarea></div>
    <div class="m-0 campo"><label>Sustenta o argumento</label><select><option>Adesão das equipes como critério de avaliação</option><option>A economia do RotaCoop foi medida em simulação</option><option>Criar novo argumento</option></select></div></div>
    <button class="btn" data-acao="toast" data-msg="Novo trecho em branco adicionado">${I.mais}Outro trecho</button>`;
  const revisao = p===3 ? `
      <div class="ponto forte"><i></i><div>A descrição do método é precisa: você notou que o quadro não foi testado empiricamente.</div></div>
      <div class="ponto lacuna"><i></i><div>Você grifou como crítica a suposição de que o artefato é usado como projetado, mas não levou isso para a análise. É o ponto mais útil para a sua dissertação.</div></div>
      <div class="ponto pergunta"><i></i><div>Se o FEDS supõe que o artefato é usado como projetado, sua proposta de medir a adesão das equipes estende o quadro ou o contradiz?</div></div>`
    : `<p class="t-meta m-0 mute">Quando terminar a etapa, peça comentários. O tutor aponta lacunas e faz perguntas; não reescreve por você.</p>`;
  return `
  <div class="topo"><div><h1>Fichamento</h1><p>${esc(l.tit)}</p></div><div class="acoes"><a class="btn" href="#leitor/${l.id}">Voltar ao texto</a></div></div>
  <ol class="passos">${PASSOS.map((s,i)=>`<li><button data-passo="${i}" class="${i===p?'on':i<p?'feito':''}"><span class="n">${i<p?'✓':i+1}</span><span class="rot">${s.nome}</span></button></li>`).join('')}</ol>
  <div class="fich-grid">
    <aside class="painel-lat">
      <h4>Seus grifos</h4>
      <p class="sub caixa-tracejada">Grifos de exemplo, escritos para o protótipo.</p><p class="sub">${cores.length?'Filtrados para esta etapa: '+cores.map(c=>FUNCOES.find(f=>f.id===c).nome.toLowerCase()).join(', '):'Todos os grifos do texto'}</p>
      ${(grifos.length?grifos:GRIFOS_VEN).map(g=>`<button class="grifo-item" style="border-color:var(--hl-${g.cor})" data-acao="toast" data-msg="Trecho inserido no fichamento com a página">${g.t}<small>p. ${g.p}</small></button>`).join('')}
    </aside>
    <section class="editor">
      ${corpo}
      <div class="pe">
        ${p>0?`<button class="btn fant" data-passo="${p-1}">Voltar para ${PASSOS[p-1].nome}</button>`:'<span></span>'}
        ${p<4?`<button class="btn prim" data-passo="${p+1}">Próxima etapa: ${PASSOS[p+1].nome}</button>`:`<button class="btn prim" data-acao="toast" data-msg="Fichamento concluído. 2 cartões de revisão criados.">Concluir fichamento</button>`}
      </div>
    </section>
    <aside class="painel-lat">
      <h4>Comentários do tutor</h4>
      <p class="sub">${p===3?'Recebidos agora há pouco':'Nenhum comentário nesta etapa'}</p>
      <div class="revisao-tutor">${revisao}</div>
      <button class="mt-4 w-100 j-centro btn" data-acao="toast" data-msg="Na versão funcional, o Gemini revisa esta etapa." data-ocupado="Comentando…">${I.tutor}Pedir comentários do tutor</button>
    </aside>
  </div>`;
};

V.argumentos = (id) => {
  if(modoReal()) return window.rb&&window.rb.argUI ? window.rb.argUI.tela(id?decodeURIComponent(id):null) : esqueleto('Argumentos');
  const a=ARGUMENTOS.find(x=>x.id===S.argSel)||ARGUMENTOS[0];
  const forca=n=>`<span class="forca" aria-hidden="true">${[1,2,3,4,5].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</span> Sustentação ${['','fraca','fraca','média','forte','forte'][n]}`;
  return `
  <div class="topo"><div><h1>Argumentos</h1><p>Teses que você sustenta, com os trechos prontos e as fontes de cada uma.</p></div>
    <div class="acoes"><button class="btn prim" data-acao="toast" data-msg="Na versão funcional, você escreve a tese e liga grifos a ela.">${I.mais}Novo argumento</button></div></div>
  <div class="arg-grid">
    <div class="arg-lista">
      ${ARGUMENTOS.map(x=>`<button class="arg-item ${x.id===a.id?'on':''}" data-arg="${x.id}"><span class="t">${x.tese}</span><span class="m"><span>${x.tipo}</span><span>${x.fontes.length} fontes</span>${forca(x.forca)}</span></button>`).join('')}
    </div>
    <article class="arg-det">
      <span class="chip">${a.tipo}</span>
      <div class="tese">${a.tese}</div>
      <div class="meta"><span class="chip proj">Seção: ${a.usado}</span><span class="chip proj">${forca(a.forca)}</span></div>
      <div class="alerta-tutor">${I.tutor}<div>${a.forca<=3?'Este argumento depende de uma única fonte para a parte principal. Antes da qualificação, procure uma segunda fonte ou trate a tese como proposição sua, não como consenso.':'Bem sustentado. O tutor sugere antecipar a objeção de que adesão não garante ganho: uma equipe pode seguir com fidelidade uma rota ruim.'}</div></div>
      <h3>Trechos prontos para o texto</h3>
      ${a.trechos.map(t=>`<div class="trecho-d"><div><p>${t.t} ${t.c}.</p><small>Escrito por você no fichamento</small></div><button class="btn fant" data-acao="toast" data-msg="Trecho copiado com a citação">${I.copiar}Copiar</button></div>`).join('')}
      <h3>Fontes</h3>
      <div class="fontes">${a.fontes.map(f=>{const l=L(f);return `<a href="#leitor/${f}">${hlbar(l.hl).replace('class="hlbar"','class="hlbar" class="fixo" style="width:60px"')}<span>${citCurta(l)}. ${esc(l.tit)}</span></a>`}).join('')}</div>
    </article>
  </div>`;
};

V.conflitos = () => {
  if(!modoReal()) return `<div class="topo"><div><h1>Conflitos de sincronização</h1><p>Sem conflitos: no modo de exemplo nada é sincronizado.</p></div></div>`;
  return window.rb&&window.rb.conflitosUI ? window.rb.conflitosUI.tela() : esqueleto('Conflitos de sincronização');
};

V.cartoes = () => {
  if(modoReal()) return window.rb&&window.rb.cartoesUI ? window.rb.cartoesUI.tela() : esqueleto('Cartões');
  if(S.cartao>=CARTOES.length) return `
  <a class="voltar" href="#painel">${I.voltar}Hoje</a>
  <div class="topo"><div><h1>Cartões</h1></div></div>
  <section class="fim-sessao">
    <h2>Sessão concluída</h2>
    <p>Você revisou os cartões de hoje. Os que errou voltam em 10 minutos; os outros, em intervalos maiores.</p>
    <div class="num"><div><b>3</b>cartões revisados</div><div><b>2</b>lembrados de primeira</div><div><b>5</b>para amanhã</div></div>
    <div class="flex gap-3 wrap"><a class="btn prim" href="#leitor/goldkuhl2012">Continuar a leitura de Goldkuhl</a><a class="btn" href="#painel">Voltar para Hoje</a></div>
  </section>`;
  const c=CARTOES[S.cartao%CARTOES.length];
  const f=FUNCOES.find(x=>x.id===c.tipo);
  return `
  <a class="voltar" href="#painel">${I.voltar}Hoje</a>
  <div class="topo"><div><h1>Cartões</h1><p>Cartão ${S.cartao+1} de ${CARTOES.length}. Os intervalos crescem a cada acerto.</p></div></div>
  <div class="rev-wrap">
    <div>
      <div class="cartao-rev ${S.virado?'virado':''}" id="cartao">
        <div class="face-wrap">
          <div class="face"><div class="tipo"><span class="sw c-${c.tipo}"></span>${f.nome}</div><div class="q">${c.q}</div><div class="origem">${c.origem}</div></div>
          <div class="face verso"><div class="tipo"><span class="sw c-${c.tipo}"></span>Resposta</div><div class="r">${c.r}</div><div class="origem">${c.origem}</div></div>
        </div>
      </div>
      ${S.virado?'':`<div class="mt-5 flex j-centro"><button class="btn prim" data-acao="virar">Mostrar resposta</button></div>`}
      <div class="notas-rev" ${S.virado?'':'hidden'}>
        <button data-nota="0">De novo<small>em 10 min</small></button>
        <button data-nota="1">Difícil<small>amanhã</small></button>
        <button data-nota="2">Bom<small>em 4 dias</small></button>
        <button data-nota="3">Fácil<small>em 9 dias</small></button>
      </div>
    </div>
    <aside class="painel-lat">
      <h4>Hoje</h4>
      <p class="sub">Cartões vêm dos seus grifos e fichamentos</p>
      <div class="dist">
        ${[['Novos',1],['Revisão',2],['Aprendidos',41]].map(([n,v])=>`<div style="grid-template-columns:90px 1fr 26px"><span>${n}</span><span class="trilho"><i style="background:var(--petroleo);width:${v/41*100}%"></i></span><span class="mute-2">${v}</span></div>`).join('')}
      </div>
      <p class="t-meta m-0 mt-4 mute">Antes de responder, tente dizer a resposta em voz alta. Lembrar é o que fixa.</p>
    </aside>
  </div>`;
};


/* =========================================================
   IA: modelos por tarefa, uso, custo e registros
   ========================================================= */
const PRECOS = {
  'gemini-4-argon':        {nome:'Gemini 4 Argon', inp:2.00, out:10.00, cache:0.10, fut:{inp:4.00,out:20.00,cache:0.20,desde:'1 dez. 2026'}},
  'gemini-3.8-flash':      {nome:'Gemini 3.8 Flash', inp:0.75, out:3.75, cache:0.075, fut:{inp:1.50,out:7.50,cache:0.15,desde:'1 jan. 2027'}},
  'gemini-3.1-flash-lite': {nome:'Gemini 3.1 Flash-Lite', inp:0.25, out:1.50, cache:0.025},
  'gemini-3.5-transcribe': {nome:'Gemini 3.5 Transcribe', min:0.005},
  'gemini-embedding-2':    {nome:'Gemini Embedding 2', inp:0.20},
};
const OPCOES_MODELO = ['gemini-4-argon','gemini-3.1-pro-preview','gemini-3.8-flash','gemini-3.6-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite'];
const RESERVA = {'gemini-4-argon':'gemini-3.1-pro-preview','gemini-3.8-flash':'gemini-3.6-flash','gemini-3.1-flash-lite':'gemini-3.5-flash-lite','gemini-3.5-transcribe':'gemini-3.1-flash-lite','gemini-embedding-2':'sem reserva'};
// grupo, tarefa, modelo, pensamento, lote, k_in, k_cache, k_out, usos/mês, por quê
const TAREFAS_IA = [
  ['Raciocínio','Copilot: versões do parágrafo','gemini-4-argon','médio',false,12,0,3.5,40,'Precisa manter sua voz, respeitar o acervo e não inventar fonte'],
  ['Raciocínio','Copilot: diagnóstico e estrutura','gemini-4-argon','alto',false,25,0,6,3,'Cruza tese, enunciado e acervo inteiro'],
  ['Raciocínio','Revisar e exportar','gemini-4-argon','alto',false,25,0,5,3,'Checa cada afirmação contra as fontes'],
  ['Raciocínio','Revisão do projeto','gemini-4-argon','alto',true,55,0,18,2,'Lê a dissertação inteira; roda em lote, sem pressa'],
  ['Conversa','Tutor: conversa durante a leitura','gemini-3.8-flash','baixo',false,3,12,1,220,'Rápido e frequente; o artigo fica em cache'],
  ['Conversa','Tutor: perguntas antes de ler','gemini-3.8-flash','baixo',false,13,0,0.6,15,'Tarefa curta sobre um texto'],
  ['Conversa','Tutor: comentários no fichamento','gemini-3.8-flash','médio',false,18,0,1.5,15,'Compara o fichamento com o texto'],
  ['Conversa','Diálogos','gemini-3.8-flash','médio',false,8,0,1,60,'Contraponto exige raciocínio, mas é conversa'],
  ['Conversa','Copilot: entrevista e briefing','gemini-3.8-flash','médio',false,8,0,0.8,60,'Perguntas, não redação'],
  ['Conversa','Resumo e citações da aula','gemini-3.8-flash','baixo',false,25,0,2,12,'Transcrição longa, saída curta'],
  ['Conversa','Orientação: resumo e combinados','gemini-3.8-flash','médio',false,12,0,1.5,2,'Extrair combinados com precisão'],
  ['Conversa','Plano de ensino','gemini-3.8-flash','baixo',false,10,0,2,1,'Extração de leituras e datas'],
  ['Conversa','Overview do autor','gemini-3.8-flash','médio',true,30,0,3,4,'Semanal, em lote'],
  ['Rápidas','Cartões de revisão','gemini-3.1-flash-lite','mínimo',true,3,0,0.8,30,'Formato fixo, volume alto'],
  ['Rápidas','Metadados do PDF','gemini-3.1-flash-lite','mínimo',false,2,0,0.3,15,'Ler a primeira página quando não há DOI'],
  ['Rápidas','Memória: o que lembrar','gemini-3.1-flash-lite','mínimo',false,8,0,0.5,30,'Classificar o que é durável'],
];
const AUDIO_IA = [['Áudio','Transcrição de aulas','gemini-3.5-transcribe',1200,'Separa quem fala e marca o tempo de cada palavra'],['Áudio','Transcrição da orientação','gemini-3.5-transcribe',90,'Idem']];
const custoUso = (m,kin,kc,kout,lote,fut) => { const p=PRECOS[m]; const q=fut&&p.fut?p.fut:p; return (kin*q.inp+kc*q.cache+kout*q.out)/1000*(lote?0.5:1); };
const usd = v => 'US$ '+v.toFixed(2).replace('.',',');
const usd4 = v => v<0.01?'US$ '+v.toFixed(4).replace('.',','):usd(v);
function custoMes(cen){ // cen: 'agora' | 'dez' | 'jan'
  let t=0; TAREFAS_IA.forEach(([g,n,m,th,lote,ki,kc,ko,u])=>{const fut=cen==='jan'||(cen==='dez'&&m==='gemini-4-argon');t+=custoUso(m,ki,kc,ko,lote,fut)*u});
  AUDIO_IA.forEach(a=>t+=a[3]*PRECOS['gemini-3.5-transcribe'].min); return t+0.05;
}
const FRAC = 13/30;
const DIAS = [0.21,0.18,0.71,0.64,0.69,0.25,0.12,0.09,0.31,0.74,0.66,0.72,0.30];
const LOG_TIPOS = [['tudo','Tudo'],['ia','IA'],['erro','Erros'],['ui','Interface'],['arq','Arquivos e agenda']];

function secModelos(){
  const linha=([g,n,m,th,lote,ki,kc,ko,u,pq])=>`<tr><td><b>${n}</b><small>${pq}</small></td><td><select aria-label="Modelo para ${n}">${OPCOES_MODELO.map(o=>`<option ${o===m?'selected':''}>${o}</option>`).join('')}</select></td><td>${th}${lote?'<small>em lote, metade do preço</small>':''}</td><td class="num">${usd4(custoUso(m,ki,kc,ko,lote,false))}</td></tr>`;
  const grupos=[['Raciocínio','Poucas chamadas, alto impacto no seu texto e na dissertação'],['Conversa','O dia a dia do tutor e do copilot'],['Rápidas','Tarefas de formato fixo e volume alto']];
  return `<section id="sec-modelos">
    <h2>Modelos por tarefa</h2>
    <p>Cada tarefa usa o modelo mais barato que dá conta dela. O nível de pensamento controla quanto o modelo raciocina antes de responder; mais pensamento custa mais.</p>
    <div class="tab-wrap"><table class="tab-ia"><thead><tr><th>Tarefa</th><th>Modelo</th><th>Pensamento</th><th class="num">Custo por uso</th></tr></thead>
    ${grupos.map(([g,d])=>`<tbody><tr class="grp"><td colspan="4">${g}<small>${d}</small></td></tr>${TAREFAS_IA.filter(t=>t[0]===g).map(linha).join('')}</tbody>`).join('')}
    <tbody><tr class="grp"><td colspan="4">Áudio e busca</td></tr>
      ${AUDIO_IA.map(([g,n,m,mins,pq])=>`<tr><td><b>${n}</b><small>${pq}</small></td><td><select><option selected>gemini-3.5-transcribe</option><option>gemini-3.1-flash-lite</option></select></td><td>não se aplica</td><td class="num">${usd(PRECOS[m].min*100)}<small>por aula de 100 min</small></td></tr>`).join('')}
      <tr><td><b>Busca e conexões entre leituras</b><small>Índice semântico da biblioteca, aulas e memória</small></td><td><select><option>gemini-embedding-2</option></select></td><td>não se aplica</td><td class="num">US$ 0,05<small>por mês</small></td></tr>
    </tbody></table></div>
    <details class="mt-3 ajuda-det"><summary>E se um modelo falhar ou sair do ar?</summary><p class="m-0 mt-3 t-meta mute">Depois de 2 tentativas, o pedido vai para o modelo reserva e isso fica nos registros: ${Object.entries(RESERVA).filter(([a,b])=>b!=='sem reserva').map(([a,b])=>`${a} → ${b}`).join('; ')}.</p></details>
  </section>`;
}
function secCusto(){
  const mtd=custoMes('agora')*FRAC; const somaD=DIAS.reduce((a,b)=>a+b,0); const dias=DIAS.map(v=>v/somaD*mtd); const maxD=Math.max(...dias);
  const linhas=[...TAREFAS_IA.map(([g,n,m,th,lote,ki,kc,ko,u])=>({n,m,ch:Math.round(u*FRAC),tk:(ki+kc+ko)*u*FRAC,c:custoUso(m,ki,kc,ko,lote,false)*u*FRAC})),
    ...AUDIO_IA.map(([g,n,m,mins])=>({n,m,ch:Math.round(mins/100*FRAC)||1,tk:null,mins:Math.round(mins*FRAC),c:mins*FRAC*PRECOS[m].min}))].sort((a,b)=>b.c-a.c);
  const tkTot=linhas.reduce((a,l)=>a+(l.tk||0),0);
  return `<section id="sec-custo">
    <h2>Uso e custo</h2>
    <p>Calculado a partir dos registros de cada chamada, com os preços da tabela abaixo. Valores em dólar, como o Google cobra.</p>
    <div class="kpis">
      <div><b>${usd(mtd)}</b><span>gasto em novembro até hoje</span></div>
      <div><b>${usd(custoMes('agora'))}</b><span>projeção para novembro</span></div>
      <div><b>${(tkTot/1000).toFixed(1).replace('.',',')} milhões</b><span>tokens de texto no mês</span><small>+ ${Math.round(1290*FRAC)} min de áudio</small></div>
      <div><b>US$ 25,00</b><span>limite mensal</span><small>aviso em 80%</small></div>
    </div>
    <div class="barras-dia" role="img" aria-label="Custo por dia em novembro">${dias.map((v,i)=>`<div title="${i+1} nov.: ${usd(v)}"><i style="height:${v/maxD*100}%"></i><span>${i+1}</span></div>`).join('')}${Array.from({length:17},(_,i)=>`<div class="fut"><i></i><span>${i+14}</span></div>`).join('')}</div>
    <p class="t-legenda m-0 mt-2 mb-4 mute-2">Custo por dia. Os picos são dias de aula, por causa da transcrição.</p>
    <div class="aviso info"><span>↗</span><div>Dois preços promocionais acabam em breve. Com o mesmo uso, a projeção sobe para <b>${usd(custoMes('dez'))}</b> por mês em dezembro (Gemini 4 Argon dobra em 1 dez.) e para <b>${usd(custoMes('jan'))}</b> a partir de janeiro (Gemini 3.8 Flash dobra em 1 jan.).</div></div>
    <div class="tab-wrap"><table class="tab-ia"><thead><tr><th>Tarefa</th><th>Modelo</th><th class="num">Usos</th><th class="num">Tokens</th><th class="num">Custo no mês</th></tr></thead><tbody>
      ${linhas.map(l=>`<tr><td>${l.n}</td><td class="mute">${l.m}</td><td class="num">${l.ch}</td><td class="num">${l.tk!==null?(l.tk>=1000?(l.tk/1000).toFixed(1).replace('.',',')+' mi':Math.round(l.tk)+' mil'):l.mins+' min'}</td><td class="num">${usd(l.c)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="mt-4 aj-linha">
      <div class="campo"><label>Limite mensal (US$)</label><input value="25,00"></div>
      <div class="campo"><label>Cotação do dólar para mostrar em reais <span>você define</span></label><input placeholder="Ex.: 5,40"></div>
    </div>
    <details class="ajuda-det"><summary>Preços usados no cálculo</summary>
      <div class="mt-3 tab-wrap"><table class="tab-ia"><thead><tr><th>Modelo</th><th class="num">Entrada</th><th class="num">Saída</th><th class="num">Cache</th><th>Muda em</th></tr></thead><tbody>
      ${Object.entries(PRECOS).filter(([k,p])=>p.out).map(([k,p])=>`<tr><td>${k}</td><td class="num">${usd(p.inp)}</td><td class="num">${usd(p.out)}</td><td class="num">${usd4(p.cache)}</td><td>${p.fut?`${p.fut.desde}: ${usd(p.fut.inp)} e ${usd(p.fut.out)}`:'sem mudança anunciada'}</td></tr>`).join('')}
      <tr><td>gemini-3.5-transcribe</td><td class="num" colspan="2">US$ 0,005 por minuto</td><td></td><td>sem mudança anunciada</td></tr>
      <tr><td>gemini-embedding-2</td><td class="num">${usd(0.20)}</td><td></td><td></td><td>sem mudança anunciada</td></tr>
      </tbody></table></div>
      <p class="t-legenda m-0 mt-2 mute-2">Por milhão de tokens, conferidos na página de preços do Gemini em 13 nov. 2026. Em lote, entrada e saída custam metade.</p>
    </details>
  </section>`;
}
function secRegistros(){
  const f=S.logFiltro; const rb=window.rb;
  const todos=rb?rb.registros.lista():[];
  const hoje=new Date().toISOString().slice(0,10);
  const deHoje=todos.filter(e=>e.t.slice(0,10)===hoje);
  const sessoes=new Set(deHoje.map(e=>e.sessao)).size;
  const erros=deHoje.filter(e=>e.st==='erro').length;
  const grupo=e=>e.tipo==='app'?'ui':e.tipo;
  const lista=todos.filter(e=>f==='tudo'||grupo(e)===f||(f==='arq'&&e.tipo==='ag')).slice(-80).reverse();
  const hora=t=>new Date(t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const esc=x=>String(x??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const linhas=!rb?`<tr><td colspan="5" class="mute">Carregando os registros deste aparelho…</td></tr>`
    : lista.length?lista.map(e=>`<tr class="st-${e.st}"><td class="mute">${hora(e.t)}</td><td><code>${esc(e.ev)}</code></td><td>${esc(e.onde)}</td><td>${esc(e.det)}</td><td class="num">${e.dur!=null?e.dur+' ms':''}</td></tr>`).join('')
    : `<tr><td colspan="5" class="mute">Nenhum registro deste tipo ainda.</td></tr>`;
  return `<section id="sec-registros">
    <h2>Registros</h2>
    <p>Cada sessão, tela aberta, ação e erro vira um registro, guardado neste aparelho por 180 dias. Os registros nunca guardam o que você escreve, só nomes de ações, telas e tempos. Quando o Drive estiver ligado, cada sessão também vira um arquivo na pasta.</p>
    <div class="kpis">
      <div><b>${deHoje.length.toLocaleString('pt-BR')}</b><span>eventos hoje</span><small>${sessoes} ${sessoes===1?'sessão':'sessões'}</small></div>
      <div><b>${erros}</b><span>${erros===1?'erro hoje':'erros hoje'}</span><small>${erros?'veja abaixo, em Erros':'nenhum problema registrado'}</small></div>
      <div><b>${deHoje.filter(e=>e.ev==='ia.resposta').length}</b><span>chamadas à IA hoje</span><small>${deHoje.filter(e=>e.ev==='ia.falhou').length} falhas, com nova tentativa</small></div>
      <div><b>v${esc(rb?rb.versao:APP_VERSAO)}</b><span>versão do app</span><small>vai em cada registro</small></div>
    </div>
    <div class="m-0 mt-1 mb-3 seg" role="group" aria-label="Filtrar registros">${LOG_TIPOS.map(([k,n])=>`<button data-log="${k}" class="${k===f?'on':''}">${n}</button>`).join('')}</div>
    <div class="tab-wrap"><table class="tab-ia logs"><thead><tr><th>Hora</th><th>Evento</th><th>Onde</th><th>Detalhe</th><th class="num">Duração</th></tr></thead><tbody>
      ${linhas}
    </tbody></table></div>
    <div class="mt-4 a-centro aj-linha">
      <label class="m-0 check"><input type="checkbox" disabled>Guardar o texto completo de prompts e respostas <span class="t-legenda mute-2">(desligado: só tamanhos, modelo e tempo; disponível quando o Gemini entrar)</span></label>
      <div class="flex gap-2 j-fim"><button class="btn" data-baixar="registros">Exportar CSV</button></div>
    </div>
    <details class="mt-3 ajuda-det"><summary>O que cada registro guarda?</summary>
      <ul class="m-0 mt-3 pl-lista t-meta mute flex coluna gap-1">
        <li>quando, sessão, versão do app, tela, evento e resultado</li>
        <li>no início da sessão: sistema, navegador, se o app está instalado e o tamanho da tela</li>
        <li>em erros: a mensagem e onde aconteceu</li>
        <li>na IA (quando entrar): tarefa, modelo, versão da instrução, nível de pensamento, tokens, tempo, custo, tentativa e modelo reserva</li>
      </ul>
    </details>
  </section>`;
}
function secAparelho(){
  const rb=window.rb;
  if(!rb) return `<section id="sec-aparelho"><h2>Este aparelho</h2><p class="mute">Carregando…</p></section>`;
  const d=rb.dados, a=rb.aparelho;
  const item=(n,v,obs)=>`<div class="ap-it"><span>${n}</span><b>${v}</b>${obs?`<small>${obs}</small>`:''}</div>`;
  return `<section id="sec-aparelho">
    <h2>Este aparelho</h2>
    <p>Uma cópia dos seus dados fica guardada aqui, para o app abrir rápido e funcionar sem internet. A cópia oficial vai ficar no seu Google Drive.</p>
    <div class="ap-grade">
      ${item('Versão do app','v'+rb.versao)}
      ${item('Instalado',a.instalado?'Sim':'Não',a.instalado?'abre em tela cheia':(a.sistema==='iOS'?'no Safari: Compartilhar, Adicionar à Tela de Início':'pelo menu do navegador: Instalar app'))}
      ${item('Armazenamento',d.disponivel?'Ativo':'Indisponível',d.disponivel?(d.persistente?'protegido contra limpeza automática':'o navegador pode limpar se faltar espaço; o Drive guarda a cópia oficial'):'este navegador não permite guardar dados; use o app instalado')}
      ${item('Formato dos dados','versão '+d.esquema,'muda com migração automática e backup antes')}
    </div>
    <div class="flex gap-2 wrap mt-4"><button class="btn" data-baixar="dados" ${d.disponivel?'':'disabled'}>Baixar cópia dos dados</button></div>
  </section>`;
}

// Ajustes em subpáginas (#ajustes/<seção>): uma seção por vez, com o índice sempre à vista.
const SECOES_AJ=[['ia','Conexão com o Gemini'],['modelos','Modelos por tarefa'],['custo','Uso e custo'],['registros','Registros'],['aparelho','Este aparelho'],['seguranca','Cópias de segurança'],['sincronizacao','Sincronização'],['acervo','Acervo'],['agenda','Google Agenda'],['cores','Marca-textos'],['pasta','Conta e pasta']];
// Mais (celular): os lugares que não são ler nem o dia, e o estado da sincronização.
V.mais = () => `<div class="topo"><div><h1>Mais</h1></div></div>
  <nav class="mais-lista" aria-label="Mais lugares do app">
    <a href="#escrita">Escrever<small>Seus textos e diálogos</small></a>
    <a href="#projeto">Dissertação<small>Projeto, orientação e argumentos</small></a>
    <a href="#disciplinas">Projetos<small>Disciplinas e aulas</small></a>
    <a href="#autor">Você<small>Overview do autor e memória</small></a>
    <a href="#ajustes">Ajustes<small>Gemini, cópias de segurança, sincronização e acervo</small></a>
  </nav>
  <div id="status-mais">${statusDriveHTML()}</div>
  <p class="meta mt-4">${modoReal()?`Versão ${APP_VERSAO}`:`Protótipo v${APP_VERSAO}, dados de exemplo`}</p>`;
V.ajustes = (sec) => { if(sec==='acervo'){location.hash='#organizar';return ''} const atual=SECOES_AJ.some(([k])=>k===sec)?sec:'ia'; return `
  <div class="topo"><div><h1>Ajustes</h1><p>IA, custos, registros, agenda, cores e a pasta onde tudo fica.</p></div></div>
  <div class="aj-wrap">
  <nav class="aj-indice" aria-label="Seções dos ajustes">${SECOES_AJ.map(([k,n])=>`<a href="${k==='acervo'?'#organizar':'#ajustes/'+k}"${k===atual?' class="on" aria-current="page"':''}>${n}</a>`).join('')}</nav>
  <div class="aj" data-sec="sec-${atual}">
    ${modoReal()&&window.rb&&window.rb.iaAjustes?window.rb.iaAjustes.secaoHTML():`<section id="sec-ia">
      <h2>Conexão com o Gemini</h2>
      <p>A chave fica só neste navegador e é enviada apenas ao Google quando você usa a IA. O tutor e o copilot têm instruções separadas.</p>
      <div class="larg-form campo"><label>Chave da API</label><input type="password" placeholder="Cole sua chave do Google AI Studio"></div>
      <div class="campo"><label>Como o tutor deve agir <span>leituras, fichamentos e cartões</span></label><textarea class="f-ui t-meta" style="min-height:90px">Você é o tutor de um mestrando em Administração. Seu trabalho é garantir a qualidade do estudo: pergunte, provoque, aponte lacunas e leituras apressadas. Não escreva fichamentos nem trechos por ele. Responda em português, de forma direta e sem elogios.</textarea></div>
      <div class="campo"><label>Como o copilot deve agir <span>textos e diálogos</span></label><textarea class="f-ui t-meta" style="min-height:110px">Você é o copilot de escrita acadêmica de um mestrando. Nunca escreva do zero: entreviste o autor e proponha versões do que ele escreveu ou disse, no estilo do overview do autor. Cite apenas obras do acervo, com página e em ABNT. Se faltar fonte, diga e sugira obras para ele buscar; não invente referências. Responda em português.</textarea></div>
      <button class="btn" data-acao="toast" data-msg="Na versão funcional, isto testa a conexão com o Gemini." data-ocupado="Testando…">Testar conexão</button>
    </section>`}
    ${modoReal()&&window.rb&&window.rb.iaUso?window.rb.iaUso.secModelos():secModelos()}
    ${modoReal()&&window.rb&&window.rb.iaUso?window.rb.iaUso.secCusto():secCusto()}
    ${secRegistros()}
    ${secAparelho()}
    ${modoReal()&&window.rb&&window.rb.sincronizacaoUI?window.rb.sincronizacaoUI.secaoHTML():`<section id="sec-sincronizacao"><h2>Sincronização</h2><p>Com os seus dados abertos, esta página mostra o estado deste aparelho e a última sincronização de cada um.</p></section>`}
    ${modoReal()&&window.rb&&window.rb.segurancaUI?window.rb.segurancaUI.secaoHTML():`<section id="sec-seguranca"><h2>Cópias de segurança</h2><p>Com os seus dados abertos, esta página mostra a cópia diária deste aparelho, a lixeira e o que dá para trazer de volta.</p></section>`}
    ${modoReal()&&window.rb&&window.rb.iaUso?window.rb.iaUso.secCores(FUNCOES):`<section id="sec-cores">
      <h2>Marca-textos</h2>
      <p>Cada cor tem uma função. A função decide para qual etapa do fichamento o grifo vai.</p>
      ${FUNCOES.map(f=>`<div class="cor-func"><span class="sw c-${f.id}"></span><strong class="forte">${f.nome}</strong><input value="${f.desc}" aria-label="Descrição de ${f.nome}"></div>`).join('')}
    </section>`}
    ${modoReal()&&window.rb&&window.rb.agendaUI?window.rb.agendaUI.secaoHTML():`<section id="sec-agenda">
      <h2>Google Agenda</h2>
      <p>Aulas, entregas, encontros de orientação e sessões de estudo que você agenda no researchbook viram eventos na sua conta Google, numa agenda separada chamada researchbook.</p>
      <div class="flex gap-3 a-centro wrap mb-4">
        <span class="p-0 t-meta t-texto salvo"><i></i>Conectado à sua conta Google</span>
        <span class="chip proj">Agenda: researchbook</span>
        <button class="ml-auto btn fant" data-acao="toast" data-msg="Na versão funcional, desconecta a conta. Os eventos já criados continuam no Google Agenda.">Desconectar</button>
      </div>
      <div class="opcoes"><label><input type="checkbox" checked>Aulas</label><label><input type="checkbox" checked>Entregas</label><label><input type="checkbox" checked>Encontros de orientação</label><label><input type="checkbox" checked>Sessões de estudo</label></div>
      <div class="larg-estreita campo"><label>Lembrete padrão</label><select><option>1 dia antes e 1 hora antes</option><option>1 hora antes</option><option>Sem lembrete</option></select></div>
    </section>`}
    <section id="sec-pasta">
      <h2>Pasta do researchbook</h2>
      <p>Tudo fica em arquivos comuns numa pasta <b>researchbook</b> do seu Google Drive, iguais nos dois computadores e no celular. O app só enxerga o que ele mesmo criou ali.</p>
      ${contaHTML()}
${modoReal()?`<pre class="arvore">researchbook/
├── dados/                   <span>uma lista por tipo: leituras.json, grifos.json, textos.json…</span>
├── biblioteca/pdfs/         <span>o PDF de cada obra</span>
├── fichamentos/             <span>um .md por obra</span>
├── escrita/&lt;texto&gt;/        <span>texto.html, autoria.json, versoes/, o .docx exportado</span>
├── disciplinas/&lt;disciplina&gt;/ <span>plano-de-ensino.pdf e aulas/ (áudio, transcricao.json e .txt)</span>
├── dissertacao/versoes/     <span>cada versão do projeto enviada para revisão</span>
├── orientacao/&lt;encontro&gt;/   <span>áudio, transcrição, PDF comentado e registro.md</span>
├── ia/conversas/            <span>tudo o que a IA produziu, com fontes, modelo e custo</span>
├── memoria/                 <span>autor.md (perfil) e exportar/</span>
├── autor/                   <span>overview.json, corpus.json e os textos enviados</span>
├── agenda/calendario.json   <span>id da agenda researchbook e preferências</span>
├── ajustes/preferencias.json <span>modelos por tarefa, limite e marca-textos</span>
├── cofre/gemini.json        <span>a chave do Gemini, só cifrada (se você usar o cofre)</span>
└── registros/&lt;dia&gt;/        <span>um arquivo por sessão e aparelho, sem o texto do que você escreve</span></pre>`:`<pre class="arvore">researchbook/
├── biblioteca/
│   ├── pdfs/                <span>goldkuhl-2012.pdf</span>
│   └── leituras/            <span>goldkuhl-2012.json: dados, etapa, grifos, notas</span>
├── fichamentos/             <span>goldkuhl-2012.md</span>
├── argumentos/              <span>um .md por argumento</span>
├── escrita/
│   └── 2026-11-artigo-sustentabilidade/
│       ├── texto.md
│       ├── autoria.json     <span>marcadores, fora do texto</span>
│       └── entrevista.md
├── dialogos/                <span>um .md por diálogo</span>
├── orientacao/              <span>uma pasta por encontro: áudio, transcrição, resumo</span>
├── projeto/                 <span>versões do PDF e análises</span>
├── disciplinas/
│   └── metodologia-de-pesquisa/
│       ├── aulas/2026-11-12/    <span>audio.m4a, transcricao.md, resumo.md, anotacoes.md</span>
│       ├── agenda.json          <span>eventos e o id de cada um no Google Agenda</span>
│       └── anotacoes.md
├── cartoes/
├── dados/                   <span>uma lista por tipo de dado: leituras.json, grifos.json…</span>
├── registros/
│   └── 2026-11-13/sessao-…jsonl   <span>um arquivo por sessão e aparelho, enviado a cada sincronização</span>
└── memoria/
    ├── autor.md  decisoes.md  regras.md
    ├── conversas/           <span>registro completo, por mês</span>
    └── exportar/</pre>`}
      <div class="aviso"><span>ⓘ</span><div>Pode usar os dois computadores e o celular ao mesmo tempo: cada mudança vai para o Drive e chega aos outros aparelhos na próxima sincronização. Se o mesmo item mudar em dois lugares antes disso, fica a versão mais recente e a outra é guardada para você decidir. A chave do Gemini fica só em cada aparelho, nunca na pasta.</div></div>
      <div class="flex gap-3 wrap">
        <button class="btn" data-baixar="bibtex">Exportar referências (BibTeX)</button>
        <a class="btn fant" href="#memoria">Exportar memória para outras IAs</a>
      </div>
    </section>
  </div>
  </div>`; };


/* =========================================================
   Revisão do projeto
   ========================================================= */
const VERSOES = [
  {v:'v3', data:'hoje', arq:'dissertacao_v3_qualificacao.pdf', pags:64, refs:47},
  {v:'v2', data:'18 out.', arq:'dissertacao_v2.pdf', pags:51, refs:39},
  {v:'v1', data:'02 set.', arq:'dissertacao_v1.pdf', pags:33, refs:28},
];
const REFS_PROJ = [
  {id:'moraes2024', prio:3, n:9, onde:['2.4 Trabalhos relacionados','3.5 Avaliação','5 Discussão'], porque:'Principal precedente e alvo das suas duas críticas. O fichamento parou antes da análise crítica, que é justamente onde as críticas nascem.'},
  {id:'venable2016', prio:3, n:7, onde:['3.1 Abordagem','3.5 Avaliação'], porque:'Sustenta o desenho da avaliação. O texto diz qual estratégia você escolheu, mas não por que descartou as outras.'},
  {id:'goldkuhl2012', prio:3, n:6, onde:['3.1 Abordagem','3.2 Posição epistemológica'], porque:'Ancora o pragmatismo nas três camadas da DSR. A leitura ainda está na página 7 de 12.'},
  {novo:true, aut:'Dantzig e Ramser (1959)', tit:'The truck dispatching problem', veic:'Management Science, 6(1)', prio:3, n:3, onde:['2.4 Trabalhos relacionados','3.5 Avaliação'], porque:'Você usa a formulação clássica do problema de roteirização para criticar o RotaCoop, mas a obra não está na biblioteca.'},
  {id:'iivari2007', prio:2, n:3, onde:['3.2 Posição epistemológica'], porque:'Aparece sempre junto de Goldkuhl. Basta terminar a leitura e ligar a um argumento.'},
  {novo:true, aut:'Gregor e Jones (2007)', tit:'The anatomy of a design theory', veic:'Journal of the Association for Information Systems, 8(5)', prio:2, n:2, onde:['3.3 Artefato'], porque:'Estrutura a descrição do artefato. Citada de forma indireta e sem página.'},
  {novo:true, aut:'Sein et al. (2011)', tit:'Action design research', veic:'MIS Quarterly, 35(1)', prio:2, n:2, onde:['3.1 Abordagem'], porque:'Aparece como alternativa descartada. A banca pode perguntar por que não ADR.'},
  {novo:true, aut:'Toth e Vigo (2014)', tit:'Vehicle routing: problems, methods, and applications', veic:'SIAM (livro)', prio:2, n:2, onde:['2.4 Trabalhos relacionados'], porque:'Referência de base dos métodos de roteirização. Uma pré-leitura basta para citar com segurança.'},
  {id:'hevner2004', prio:1, n:11, onde:['1 Introdução','3.1 Abordagem'], porque:'A mais citada do texto, mas já concluída e fichada.'},
  {id:'peffers2007', prio:1, n:5, onde:['3.4 Etapas'], porque:'Concluída. O uso no texto é descritivo.'},
  {novo:true, aut:'Gutberlet (2008)', tit:'Recovering resources, recycling citizenship', veic:'Ashgate (livro)', prio:1, n:1, onde:['2.2 Coleta seletiva e cooperativas'], porque:'Citação de contexto. Não sustenta nenhuma decisão do texto.'},
];
const prioBar = n => `<span class="prio" aria-label="Prioridade ${['','baixa','média','alta'][n]}">${[1,2,3].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</span>`;
V.projeto = () => {
  if(modoReal()) return window.rb&&window.rb.dissertacaoUI ? window.rb.dissertacaoUI.projeto() : esqueleto('Revisão do projeto');
  const ver=VERSOES.find(v=>v.v===S.versao);
  const grupos=[[3,'Alta','Sustentam decisões do texto e você ainda não domina.'],[2,'Média','Sustentam partes do texto, mas exigem pouco esforço.'],[1,'Baixa','Já lidas ou apenas de contexto. Ficam fora da trilha.']];
  const linha=r=>{
    const l=r.id?L(r.id):null;
    const tit=l?l.tit:r.tit, aut=l?`${citCurta(l)}. ${l.veic}`:`${r.aut}. ${r.veic}`;
    const st=l?`<span>Na biblioteca</span>${pips(l.etapa)}<span>${rotEtapa(l.etapa)}</span>`:`<span class="fora">Fora da biblioteca</span><button class="btn" data-acao="toast" data-msg="Referência adicionada à biblioteca com os dados do DOI">${I.mais}Adicionar</button>`;
    return `<div class="ref-linha">
      <div><div class="t">${esc(tit)}</div><div class="a">${esc(aut)}</div><div class="porque">${I.tutor}<span>${r.porque}</span></div></div>
      <div class="onde"><b>${r.n}×</b><span>citada em</span>${r.onde.map(o=>`<span>${o}</span>`).join('')}</div>
      <div class="st-bib">${st}</div>
    </div>`;
  };
  return `
  <div class="topo">
    <div><h1>Revisão do projeto</h1><p>Envie a versão atual da dissertação. A IA lê as referências que você usa no texto e monta uma trilha por prioridade.</p></div>
    <div class="acoes"><button class="btn prim" data-acao="toast" data-msg="Na versão funcional, você escolhe o PDF e a IA analisa em cerca de 1 minuto.">${I.upload}Enviar nova versão</button></div>
  </div>
  <div class="aviso-demo-pg">Análise de exemplo. Na versão funcional, o Gemini lê o PDF enviado e preenche esta tela.</div>
  <div class="versao">
    <div class="pdf-ic">PDF</div>
    <div class="info"><b>${ver.arq}</b><span>${ver.pags} páginas, ${ver.refs} referências, enviado ${ver.data}.${ver.v==='v3'?' Desde a v2: 8 referências novas e as seções 3.5 e 5.':''}</span></div>
    <div class="versoes"><span>Versões</span>${VERSOES.map(v=>`<button data-versao="${v.v}" class="${v.v===S.versao?'on':''}">${v.v}</button>`).join('')}</div>
  </div>
  <div class="proj-grid">
    <div>
      ${grupos.map(([n,nome,desc])=>{const rs=REFS_PROJ.filter(r=>r.prio===n);const cab=`<header>${prioBar(n)}<h3>Prioridade ${nome.toLowerCase()}</h3><p>${rs.length} referências. ${desc}</p></header>`;return n===3?`
      <section class="prio-grupo">${cab}${rs.map(linha).join('')}</section>`:`
      <details class="prio-grupo"><summary>${cab}</summary>${rs.map(linha).join('')}</details>`}).join('')}
    </div>
    <aside class="lado">
      <section class="bloco cta-trilha">
        <h3>Trilha sugerida</h3>
        <p>8 leituras de prioridade alta e média, na ordem acima. As 4 que estão fora da biblioteca entram primeiro na pré-leitura.</p>
        <button class="btn" data-acao="toast" data-msg="Trilha “Revisão da v3” criada com 8 leituras">Criar trilha com 8 leituras</button>
      </section>

      <section class="bloco">
        <h3>Problemas nas referências</h3>
        <ul class="inc">
          <li>Economia de 18% citada sem a página da fonte<span>Seção 2.4, p. 31</span></li>
          <li>“Iivari (2008)” no texto, “IIVARI, 2007” na lista<span>Seção 3.2, p. 38</span></li>
          <li>2 obras na lista de referências nunca citadas no texto<span>Lista de referências, p. 60</span></li>
        </ul>
      </section>
      <section class="bloco">
        <details class="ajuda-det"><summary>Como a prioridade é calculada?</summary>
        <ol>
          <li>Peso no texto: quantas vezes e em quais seções. Método e avaliação pesam mais que introdução.</li>
          <li>Função: sustenta uma decisão, critica um precedente ou só contextualiza.</li>
          <li>O que falta: fora da biblioteca, leitura incompleta, sem fichamento.</li>
        </ol></details>
      </section>

    </aside>
  </div>`;
};

/* =========================================================
   Orientação
   ========================================================= */
const ENCONTROS = [
  {data:'06 nov. 2026', tit:'Reunião de orientação', chips:['Áudio','Transcrição'], audio:'42 min',
    resumo:'A conversa girou em torno da avaliação. A troca da economia de quilometragem simulada pela adesão das equipes às rotas foi aceita, com a condição de declarar o critério de utilidade antes dos testes. Também pediu que a seção 2.4 deixe claro em que a proposta difere do RotaCoop.',
    trecho:{quando:'Orientador, aos 18 min', t:'Se a banca perguntar por que a simulação não basta, a resposta precisa estar no texto, não só na sua fala.'},
    comb:[['Declarar o critério de utilidade antes dos testes','Seção 3.5',false],['Reescrever a 2.4 contrastando com o RotaCoop','Seção 2.4',false],['Enviar a v3 até 13 nov.','Enviada hoje',true]]},
  {data:'24 out. 2026', tit:'Retorno por e-mail sobre a v2', chips:['E-mail'],
    texto:'Pediu para encurtar a introdução e levar o histórico da coleta seletiva no município para um apêndice. Achou a pergunta de pesquisa clara.',
    comb:[['Mover o histórico da coleta seletiva para um apêndice','Feito na v3',true]]},
  {data:'21 out. 2026', tit:'PDF da v2 com comentários', chips:['PDF comentado'],
    texto:'14 comentários na margem. 9 foram respondidos na v3; 5 continuam em aberto, a maioria na seção de método.',
    comb:[['Responder os 5 comentários abertos da v2','Seções 3.1 a 3.4',false]]},
  {data:'09 out. 2026', tit:'Reunião de orientação', chips:['Minha anotação'],
    texto:'Primeira conversa sobre o método. Ele perguntou se a abordagem interpretativista não seria mais segura. Mantive o pragmatismo e fiquei de trazer a justificativa por escrito.',
    comb:[['Justificar o pragmatismo por escrito','Seção 3.2',true]]},
];
V.orientacao = () => {
  if(modoReal()) return window.rb&&window.rb.dissertacaoUI ? window.rb.dissertacaoUI.orientacao() : esqueleto('Orientação');
  const abertos=ENCONTROS.flatMap(e=>e.comb.filter(c=>!c[2]).map(c=>[...c,e.data]));
  const tot=ENCONTROS.flatMap(e=>e.comb).length, feitos=tot-abertos.length;
  const onda=Array.from({length:64},(_,i)=>{const h=8+Math.abs(Math.sin(i*1.7)*14+Math.sin(i*.4)*8);return `<i class="${i<22?'tocado':''}" style="height:${Math.min(h,30)}px"></i>`}).join('');
  return `
  <div class="topo">
    <div><h1>Orientação</h1><p>Tudo o que passa entre você e o orientador, em ordem. A IA resume, extrai combinados e mostra os temas que voltam.</p></div>
    <div class="acoes"><button class="btn prim" data-acao="registrar" data-ocupado="Registrando…">${I.mais}Registrar conversa</button></div>
  </div>
  <div class="aviso-demo-pg">Registros de exemplo, escritos para o protótipo.</div>
  <div class="ori-grid">
    <div>
      <div class="timeline">
      ${ENCONTROS.map((e,k)=>{
        const corpo=`${e.audio?`<div class="audio"><button class="play" aria-label="Ouvir gravação" data-acao="toast" data-msg="Na versão funcional, o áudio toca aqui">${I.play}</button><div class="onda">${onda}</div><small>14:10 de ${e.audio}</small></div>`:''}
          ${e.resumo?`<div class="resumo-ia">${I.tutor}<div><b>Resumo da IA</b>${e.resumo}</div></div>`:''}
          ${e.trecho?`<blockquote class="transcricao"><small>${e.trecho.quando}</small>${e.trecho.t}</blockquote>`:''}
          ${e.texto?`<p>${e.texto}</p>`:''}
          <h4>Combinados</h4>
          <ul class="combinados">${e.comb.map(c=>`<li class="${c[2]?'ok':''}"><input type="checkbox" ${c[2]?'checked':''} data-comb aria-label="${esc(c[0])}"><span>${c[0]}<small>${c[1]}</small></span></li>`).join('')}</ul>`;
        const ab=e.comb.filter(c=>!c[2]).length;
        return `<article class="encontro">
          <header><h3>${e.tit}</h3><span class="data">${e.data}</span><span class="chips">${e.chips.map(c=>`<span class="chip">${c}</span>`).join('')}</span></header>
          ${k===0?corpo:`<p class="resumo-l">${e.comb.length} combinado${e.comb.length>1?'s':''}${ab?`, ${ab} em aberto`:', todos cumpridos'}</p><details><summary>Ver registro</summary>${corpo}</details>`}
        </article>`}).join('')}
      </div>
    </div>
    <aside class="lado">
      <section class="bloco">
        <h3>Combinados em aberto</h3>
        <ul class="combinados">${abertos.map(c=>`<li><input type="checkbox" data-comb aria-label="${esc(c[0])}"><span>${c[0]}<small>${c[1]}. Combinado em ${c[3]}</small></span></li>`).join('')}</ul>
        <div class="t-legenda mt-3 mute">${feitos} de ${tot} combinados cumpridos</div>
        <div class="barra"><i style="width:${feitos/tot*100}%"></i></div>
      </section>
      <section class="bloco">
        <h3>Temas que voltam</h3>
        <div class="dist">
          ${[['Avaliação e critérios',4],['Diferença para o RotaCoop',3],['Escopo da introdução',2],['Cronograma',2]].map(([n,v])=>`<div style="grid-template-columns:1fr 70px 18px"><span>${n}</span><span class="trilho"><i style="background:var(--petroleo);width:${v/4*100}%"></i></span><span class="mute-2">${v}</span></div>`).join('')}
        </div>
        <p class="t-meta m-0 mt-3 mute">Avaliação apareceu em todas as conversas. É onde a banca deve insistir.</p>
      </section>
      <section class="bloco">
        <h3>Próximo encontro: 20 nov.</h3>
        <p>Pauta sugerida a partir dos combinados abertos:</p>
        <ol>
          <li>Critério de utilidade declarado na 3.5</li>
          <li>Nova versão da 2.4, contrastando com o RotaCoop</li>
          <li>Os 5 comentários da v2 ainda em aberto</li>
        </ol>
        <button class="mt-3 btn" data-acao="toast" data-msg="Pauta copiada">${I.copiar}Copiar pauta</button>
      </section>
    </aside>
  </div>`;
};

/* =========================================================
   Disciplinas
   ========================================================= */
const DISC_INFO = {
  'Metodologia de Pesquisa':{doc:'Docente não informado', sem:'2026/2', ent:['Fichamento crítico','27 nov.',false]},
  'Pesquisa Operacional':{doc:'Docente não informado', sem:'2026/2', ent:['Trabalho em grupo, seção 4','20 nov.',true]},
  'Sustentabilidade e Organizações':{doc:'Docente não informado', sem:'2026/2', ent:['Artigo de até 7 páginas','28 nov.',false]},
};
V.disciplinas = () => modoReal() ? (window.rb&&window.rb.disciplinasUI ? window.rb.disciplinasUI.lista() : esqueleto('Projetos', 'grade')) : `
  <div class="topo">
    <div><h1>Projetos</h1><p>A dissertação e as disciplinas do semestre. Todas compartilham a mesma biblioteca.</p></div>
    <div class="acoes"><button class="btn prim" data-acao="nova-disciplina">${I.mais}Nova disciplina</button></div>
  </div>
  <div class="disc-grid">
    <article class="disc"><div><span class="chip">Mestrado</span><h2 class="mt-3">Dissertação</h2><div class="prof">Orientação: nome do orientador (exemplo)</div></div>
      <div><div class="t-meta mute">3 de 8 leituras da qualificação concluídas</div><div class="barra mb-0"><i style="width:37.5%"></i></div></div>
      <div class="entrega"><span>Qualificação</span><b>mar. 2027</b></div>
      <div class="acoes"><a class="btn" href="#projeto">Abrir</a></div></article>
    ${DISCIPLINAS.map((d,di)=>{const inf=DISC_INFO[d], ls=LEITURAS.filter(l=>l.disc===d && l.proj!=='diss'), todas=LEITURAS.filter(l=>l.disc===d), feitas=todas.filter(l=>l.etapa>=4).length;return `
    <article class="disc">
      <div><span class="chip">${inf.sem}</span><h2 class="mt-3">${d}</h2><div class="prof">${inf.doc}</div></div>
      <div><div class="t-meta mute">${feitas} de ${todas.length} leituras concluídas</div><div class="barra mb-0"><i style="width:${todas.length?feitas/todas.length*100:0}%"></i></div></div>
      <div class="mini-trilha">${todas.slice(0,3).map(l=>`<div><span class="t">${citCurta(l)}</span>${pips(l.etapa)}</div>`).join('')}</div>
      <div class="entrega"><span>${inf.ent[0]}</span><b class="${inf.ent[2]?'urg':''}">${inf.ent[1]}</b></div>
      <div class="acoes"><a class="btn" href="#disciplina/${di}" data-disc-aba="geral">Abrir</a><button class="btn fant" data-acao="toast" data-msg="Na versão funcional, você edita docente, semestre e entregas.">Editar</button></div>
    </article>`}).join('')}
    <button class="disc nova" data-acao="nova-disciplina"><span><b>Nova disciplina</b>Envie o plano de ensino e a IA sugere as leituras obrigatórias e as datas de entrega.</span></button>
  </div>`;


/* =========================================================
   Escrita: textos
   ========================================================= */
const TEXTOS = [
  {id:'artigo-dt', tit:'Sustentabilidade de vitrine: o greenwashing nos relatórios corporativos', tipo:'Artigo de disciplina', disc:'Sustentabilidade e Organizações', passo:4, palavras:1840, alvo:2800, limite:'7 páginas', prazo:'28 nov.', a:{autor:58,co:27,ia:15}, meta:60},
  {id:'resenha-feds', tit:'Resenha crítica do FEDS', tipo:'Resenha', disc:'Metodologia de Pesquisa', passo:5, palavras:1210, alvo:1500, limite:'1.500 palavras', prazo:'27 nov.', a:{autor:71,co:22,ia:7}, meta:60},
  {id:'pi-sec8', tit:'Seção 4: análise de sensibilidade da escolha do ecoponto', tipo:'Seção de trabalho em equipe', disc:'Pesquisa Operacional', passo:3, palavras:420, alvo:1800, limite:'6 páginas', prazo:'20 nov.', a:{autor:88,co:12,ia:0}, meta:60},
];
const PASSOS_TEXTO = ['Enquadrar','Ideia','Diagnóstico','Estrutura','Escrita','Revisão'];
const partIA = a => a.co + a.ia;
const barraAutoria = (a,meta) => `<div class="barra-wrap"><div class="barra-a"><span class="a-autor" style="width:${a.autor}%"></span><span class="a-co" style="width:${a.co}%"></span><span class="a-ia" style="width:${a.ia}%"></span></div>${meta?`<i class="meta-l" style="left:calc(${100-meta}% - 1px)" title="Teto da IA: ${meta}%"></i>`:''}</div>`;
const LEG_AUTORIA = '<div class="leg-a"><span><i class="a-autor"></i>Seu</span><span><i class="a-co"></i>Coautoria</span><span><i class="a-ia"></i>IA</span><span><i class="a-teto"></i>Teto da IA</span></div>';

V.escrita = () => modoReal() ? (window.rb&&window.rb.escritaUI ? window.rb.escritaUI.lista() : esqueleto('Textos')) : `
  <div class="topo">
    <div><h1>Textos</h1><p>Artigos, resenhas e trabalhos de disciplina. A dissertação continua no Word.</p></div>
    <div class="acoes"><a class="btn prim" href="#texto/artigo-dt" data-ptexto="0">${I.mais}Novo texto</a></div>
  </div>
  <div class="txt-lista">
    ${TEXTOS.map(t=>`
    <a class="txt-card" href="#texto/${t.id}" data-ptexto="${t.passo}">
      <div><div class="t">${t.tit}</div><div class="m">${t.tipo}, ${t.disc}. ${t.limite}, entrega ${t.prazo}</div></div>
      <div class="et"><span class="st"><i style="background:${t.passo<=3?'var(--linha-2)':t.passo===4?'var(--petroleo)':'var(--sucesso)'}"></i>${t.passo<=3?'Preparando: '+PASSOS_TEXTO[t.passo].toLowerCase():t.passo===4?'Escrevendo':'Em revisão'}</span><span class="t-legenda mute-2">${t.palavras.toLocaleString('pt-BR')} de ~${t.alvo.toLocaleString('pt-BR')} palavras</span></div>
      <div class="autoria"><span>Participação da IA: <b>${partIA(t.a)}%</b> (teto ${t.meta}%)</span>${barraAutoria(t.a,t.meta)}</div>
    </a>`).join('')}
  </div>
  <div class="mt-3 larg-1180">${LEG_AUTORIA}</div>`;

V.texto = (id) => {
  if(modoReal()) return window.rb&&window.rb.escritaUI ? window.rb.escritaUI.tela(decodeURIComponent(id||'')) : esqueleto('Texto', 'texto');
  const t=TEXTOS.find(x=>x.id===id)||TEXTOS[0]; const p=S.passoTexto;
  let corpo='';
  if(p===0) corpo=`
  <section class="larg-pagina editor">
    <h2>Enquadrar</h2><p class="instr">O que é o texto e quais são as regras. O copilot usa estas informações em todas as etapas.</p>
    <div class="larg-total gap-0 aj"><div class="linha2">
      <div class="campo"><label>Tipo de texto</label><select><option>Artigo de disciplina</option><option>Artigo para periódico</option><option>Resenha</option><option>Ensaio</option><option>Seção de trabalho em equipe</option></select></div>
      <div class="campo"><label>Disciplina ou projeto</label><select>${DISCIPLINAS.map(d=>`<option ${d===t.disc?'selected':''}>${d}</option>`).join('')}${PROJETOS.map(x=>`<option>${x.nome}</option>`).join('')}</select></div>
    </div></div>
    <div class="campo"><label>Enunciado da atividade <span>cole o texto ou envie o PDF</span></label><textarea class="f-ui t-ui">Artigo individual, de até 7 páginas, que discuta um tema do capítulo estudado à luz de um caso concreto. Normas ABNT.</textarea></div>
    <div class="campo"><label>Critérios de avaliação</label><textarea class="f-ui t-ui" style="min-height:70px">Clareza do argumento; uso das fontes da disciplina; relação entre teoria e caso.</textarea></div>
    <div class="larg-total gap-0 aj"><div class="linha2">
      <div class="campo"><label>Limite</label><input value="${t.limite}, ABNT"></div>
      <div class="campo"><label>Entrega</label><input type="date" value="2026-11-28"></div>
    </div></div>
    <div class="campo"><label>Teto de participação da IA <span id="teto-v">${t.meta}%</span></label><input type="range" min="0" max="100" step="5" value="${t.meta}" id="teto" class="p-0"><div class="t-legenda mt-2 mute-2">Soma de coautoria e trechos da IA. O copilot avisa quando o texto passar do teto. Os marcadores ficam no researchbook, nunca no texto exportado.</div></div>
  </section>`;
  if(p===1) corpo=`
  <section class="larg-pagina editor">
    <h2>A ideia, nas suas palavras</h2><p class="instr">Uma entrevista curta. Responda como falaria com um colega. O copilot não reescreve suas respostas nesta etapa.</p>
    <div class="qa"><div class="q">O que você quer defender, em uma frase?</div><div class="r"><small>Sua resposta</small>Que o greenwashing não é um desvio de comunicação: é consequência de aceitarmos o relatório de sustentabilidade como peça de reputação enquanto isso era conveniente.</div></div>
    <div class="qa"><div class="q">Para quem você está escrevendo?</div><div class="r"><small>Sua resposta</small>Para a turma e o professor, que conhecem o capítulo, mas não necessariamente os casos.</div></div>
    <div class="qa"><div class="q">O que fica de fora?</div><div class="r"><small>Sua resposta</small>Legislação ambiental. Não domino e não é o foco.</div></div>
    <div class="qa pendente"><div class="q">${I.escrita}<span>Você diz “aceitarmos”. Quem é esse nós: empresas, investidores ou reguladores? A resposta muda a estrutura do artigo.</span></div><div class="m-0 mt-3 campo"><textarea placeholder="Responda com suas palavras"></textarea></div></div>
    <div class="tese-box"><small>Tese de trabalho: sua frase, sem edição</small><p>O greenwashing não é um desvio de comunicação: é consequência de aceitarmos o relatório de sustentabilidade como peça de reputação enquanto isso era conveniente.</p></div>
  </section>`;
  if(p===2) corpo=`
  <div class="diag-grid">
    <section class="diag"><h3><i style="background:var(--sucesso)"></i>Sustentado pelo acervo</h3><p>Você tem grifos e fichamentos para isto</p>
      <div class="diag-item"><b>A conveniência da reputação suprime o compromisso ambiental</b><span>Teixeira, p. 48. 3 grifos, 1 argumento</span></div>
      <div class="diag-item"><b>O relatório como ativo de reputação</b><span>Nogueira e Prado (2023). 5 grifos; leitura em andamento</span></div>
    </section>
    <section class="diag"><h3><i style="background:#B8862B"></i>Frágil</h3><p>Uma fonte só, ou fonte ainda não lida</p>
      <div class="diag-item"><b>Os reguladores também se beneficiaram da vitrine</b><span>Só 1 grifo, em Teixeira. Está na sua tese, então precisa de mais base.</span></div>
    </section>
    <section class="diag"><h3><i style="background:var(--perigo)"></i>Lacuna</h3><p>Nada no acervo. Sugestões para você buscar</p>
      <div class="diag-item"><b>Os dados permitiam inferir traços de personalidade</b><span>Sugestão: Kosinski, Stillwell e Graepel (2013), PNAS</span><button class="btn" data-acao="toast" data-msg="Sugestão salva. Adicione o PDF à biblioteca para o copilot poder citar.">Marcar para buscar</button></div>
      <div class="diag-item"><b>Cronologia do caso</b><span>Sugestão: reportagem de Cadwalladr e Graham-Harrison (2018), The Guardian</span><button class="btn" data-acao="toast" data-msg="Sugestão salva. Adicione o texto à biblioteca para o copilot poder citar.">Marcar para buscar</button></div>
    </section>
  </div>
  <div class="nota-grounding">${I.tutor}<span>O copilot só cita o que está no seu acervo, com página. Sugestões de fora ficam pendentes até você adicionar o texto à biblioteca.</span></div>`;
  if(p===3){
    const sec=[
      ['Introdução: o relatório como sintoma','Apresentar os casos e a tese',[],'~400','Escrita'],
      ['A conveniência que suprime o compromisso','Trazer o conceito de Teixeira',['Teixeira'],'~600','Escrita'],
      ['Reputação como modelo de negócio','Mostrar por que não é desvio',['Nogueira e Prado (2023)'],'~700','Em andamento'],
      ['Empresas, investidores e reguladores','Os três níveis da conveniência',['Teixeira','Nogueira e Prado (2023)','lacuna'],'~700','Aguardando fonte'],
      ['Considerações finais','Retomar a tese e os limites',[],'~400','Não iniciada'],
    ];
    corpo=`
  <section class="larg-1000 editor">
    <h2>Estrutura</h2><p class="instr">Proposta do copilot a partir da sua tese e do diagnóstico. Renomeie, reordene ou apague seções; nada é escrito até você aprovar.</p>
    <ol class="estr">${sec.map(([n,o,f,x,st])=>`<li><div><div class="t">${n}</div><div class="o">${o}</div><div class="f">${f.map(y=>`<span class="chip ${y==='lacuna'?'lac':''}">${y==='lacuna'?'Falta fonte':y}</span>`).join('')}</div></div><span class="x">${x} palavras</span><span class="x">${st}</span></li>`).join('')}</ol>
    <div class="flex gap-3 mt-3"><button class="btn" data-acao="toast" data-msg="Na versão funcional, você arrasta para reordenar.">${I.mais}Adicionar seção</button><button class="btn fant" data-acao="toast" data-msg="O copilot vai propor outra estrutura a partir da mesma tese." data-ocupado="Propondo…">Pedir outra proposta</button></div>
  </section>`;
  }
  if(p===4) corpo=escritaHTML(t);
  if(p===5) corpo=`
  <div class="proj-grid">
    <section class="editor">
      <h2>Revisar e exportar</h2><p class="instr">Checagem acadêmica antes de exportar. Nada aqui altera o texto sem você.</p>
      <div class="revs">
        ${[
          ['ok','Toda citação vem do acervo','7 citações de 2 obras, todas ligadas a grifos.'],
          ['at','1 afirmação sem fonte','Seção 3: “as empresas sabiam que os números eram maquiados”.','Ver trecho'],
          ['ok','Citações diretas com página','2 de 2.'],
          ['at','Coerência com a tese','Sua tese inclui os reguladores; a seção 4 ainda não trata deles.','Ver seção'],
          ['ok','Extensão','Cerca de 4,8 de 7 páginas.'],
          ['ok','ABNT','Citações no texto e referências geradas a partir da biblioteca.'],
          ['obs','Voz do autor','No parágrafo 3 da seção 3, as frases estão 40% mais longas que a sua média.','Ver trecho'],
          ['ok','Participação da IA','42%, abaixo do teto de 60%.'],
        ].map(([c,b,sp,bt])=>`<div class="rev-it"><span class="ic ${c}">${c==='ok'?'✓':c==='at'?'!':'i'}</span><div><b>${b}</b><span>${sp}</span></div>${bt?`<button class="btn fant" data-passo-texto="4">${bt}</button>`:'<span></span>'}</div>`).join('')}
      </div>
    </section>
    <aside class="lado">
      <section class="bloco cta-trilha"><h3>Exportar</h3><p>Word com formatação ABNT. Os marcadores de autoria ficam aqui; o arquivo sai limpo.</p><button class="btn" data-acao="toast" data-msg="Arquivo gerado: artigo-sustentabilidade.docx" data-ocupado="Exportando…">Exportar para Word (.docx)</button></section>
      <section class="bloco"><h3>Referências</h3>
        <ul class="refs-abnt"><li>${L('teixeira2021').abnt}</li><li>${L('nogueira2023').abnt}</li></ul></section>
      <section class="bloco"><h3>Autoria deste texto</h3>${barraAutoria(t.a,t.meta)}<div class="mt-3">${LEG_AUTORIA}</div></section>
    </aside>
  </div>`;
  const meta=`${t.tipo}, ${t.disc}. ${t.limite}, entrega em ${t.prazo}`;
  if(p<=3) return `
  <a class="voltar" href="#escrita">${I.voltar}Textos</a>
  <div class="esc-cab"><div><h1>${t.tit}</h1><p>Preparação do texto. Leva cerca de 10 minutos e é feita uma vez.</p></div><div class="acoes"><button class="btn fant" data-acao="toast" data-msg="Preparação salva. Você continua de onde parou.">Salvar e sair</button></div></div>
  <ol class="passos quatro">${PASSOS_TEXTO.slice(0,4).map((n,i)=>`<li><button data-passo-texto="${i}" class="${i===p?'on':i<p?'feito':''}"><span class="n">${i<p?'✓':i+1}</span><span class="rot">${n}</span></button></li>`).join('')}</ol>
  ${p===0?'<p class="setup-intro">O copilot entrevista você e propõe versões do que você escreveu. Ele não escreve do zero e só cita o que está na sua biblioteca.</p>':''}
  ${corpo}
  <div class="flex entre mt-5 ${p===2?'larg-1180':p===3?'larg-1000':'larg-pagina'}">${p>0?`<button class="btn fant" data-passo-texto="${p-1}">Voltar para ${PASSOS_TEXTO[p-1]}</button>`:'<span></span>'}<button class="btn prim" data-passo-texto="${p+1}">${p===3?'Aprovar estrutura e começar a escrever':'Ir para '+PASSOS_TEXTO[p+1]}</button></div>`;
  if(p===4) return `
  <a class="voltar" href="#escrita">${I.voltar}Textos</a>
  <div class="esc-cab"><div><h1>${t.tit}</h1><p>${meta} <span class="d-inline-flex p-0 salvo"><i></i>Salvo há 10 s</span></p></div>
    <div class="acoes"><button class="btn" data-acao="briefing">Briefing</button><button class="btn prim" data-passo-texto="5">Revisar e exportar</button></div></div>
  ${corpo}`;
  return `
  <button class="fundo-0 b-0 p-0 cursor voltar" data-passo-texto="4">${I.voltar}Voltar ao texto</button>
  <div class="esc-cab"><div><h1>${t.tit}</h1><p>${meta}</p></div></div>
  ${corpo}`;
};

function escritaHTML(t){
  return `
  <div class="esc-grid">
    <aside class="lat-esc">
      <h4 class="t-meta forte m-0 mb-2">Seções</h4>
      <div class="secoes">
        <button><i class="feita"></i>Introdução</button>
        <button><i class="feita"></i>A conveniência que suprime o compromisso</button>
        <button class="on"><i class="and"></i>Reputação como modelo de negócio</button>
        <button><i></i>Empresas, investidores e reguladores</button>
        <button><i></i>Considerações finais</button>
      </div>
    </aside>
    <section class="folha ${S.marcas?'marcas':''}">
      <div class="folha-barra">
        <span>1.840 de ~2.800 palavras</span>
        <span class="aut-mini">IA ${partIA(t.a)}% ${barraAutoria(t.a,t.meta)}</span>
        <span>7 citações do acervo, <b class="t-aviso forte">1 trecho sem fonte</b></span>
        <label><input type="checkbox" data-marcas ${S.marcas?'checked':''}>Marcadores de autoria</label>
      </div>
      <div class="folha-corpo">
        <div class="mb-6 aviso-demo-pg">Texto de exemplo, escrito para o protótipo.</div>
        <h2>3. Reputação como modelo de negócio</h2>
        <div class="par autor"><span class="tag-a">Seu</span>O greenwashing costuma ser contado como um exagero de comunicação. Essa leitura é confortável porque trata o problema como falha de redação, que se corrige com mais revisão. Ela esconde a pergunta que importa: por que tantas empresas tinham interesse em parecer mais sustentáveis do que eram?</div>
        <div class="par co"><span class="tag-a">Coautoria: versão do copilot, editada por você</span>A resposta está no modelo de negócio. Para Nogueira e Prado, o relatório de sustentabilidade passou a funcionar como ativo de reputação junto a investidores e consumidores <span class="cit-in" title="Grifo de conceito, cap. 2">(Nogueira; Prado, 2023)</span>. Nesse modelo, a narrativa não é efeito colateral do relatório; é o produto.</div>
        <div class="par autor ativo"><span class="tag-a">Seu, em revisão</span><span class="sem-fonte">As empresas sabiam que os números eram maquiados</span> e lucravam com isso, então não dá pra dizer que foi exagero.</div>
        <div class="versoes-box">
          <h4>Versões propostas pelo copilot a partir do seu parágrafo</h4>
          <div class="alerta">⚠ <span>Você afirma que as empresas “sabiam”. Nenhuma fonte do seu acervo sustenta isso. As duas versões tiram essa parte; para mantê-la, adicione uma fonte à biblioteca.</span></div>
          <div class="versao-op"><div class="cab"><b>Mais próxima do seu texto</b><span class="chip">liga à fonte</span><span class="chip">mesma ordem</span></div>
            <p>As empresas lucravam com a reputação que o relatório construía; por isso, chamar o greenwashing de exagero não se sustenta <span class="cit-in">(Nogueira; Prado, 2023)</span>.</p>
            <div class="bts"><button class="btn prim" data-acao="toast" data-msg="Versão aplicada. O parágrafo passa a contar como coautoria.">Usar</button><button class="btn" data-acao="toast" data-msg="Edite à vontade; quanto mais você mudar, mais o trecho conta como seu.">Editar a partir desta</button></div></div>
          <div class="versao-op"><div class="cab"><b>Mais acadêmica</b><span class="chip">tira o coloquial</span><span class="chip">liga à fonte</span></div>
            <p>Tratar o greenwashing como exagero de comunicação ignora que o modelo de negócio dependia justamente da reputação construída pelos relatórios <span class="cit-in">(Nogueira; Prado, 2023)</span>.</p>
            <div class="bts"><button class="btn prim" data-acao="toast" data-msg="Versão aplicada. O parágrafo passa a contar como coautoria.">Usar</button><button class="btn" data-acao="toast" data-msg="Edite à vontade; quanto mais você mudar, mais o trecho conta como seu.">Editar a partir desta</button></div></div>
          <div class="pb-0 versao-op"><div class="bts"><button class="btn fant" data-acao="toast" data-msg="Mantido como você escreveu. O trecho continua marcado como sem fonte.">Manter o meu</button></div></div>
        </div>
        <div class="par ia"><span class="tag-a">IA: transição aceita com pouca edição</span>A próxima seção examina como essa conveniência operou em três níveis: empresas, investidores e reguladores.</div>
      </div>
    </section>
    <aside class="flex coluna gap-3 painel-lat">
      <div class="abas-lat" role="tablist"><button role="tab" data-aba-esc="copilot" class="${S.abaEsc==='copilot'?'on':''}">Copilot</button><button role="tab" data-aba-esc="material" class="${S.abaEsc==='material'?'on':''}">Material da seção</button></div>
      ${S.abaEsc==='material'?`<div>      
        
        <p class="sub caixa-tracejada">Grifos de exemplo, escritos para o protótipo.</p>
        <button class="grifo-item" style="border-color:var(--hl-conceito)" data-acao="toast" data-msg="Citação inserida no parágrafo, com página e em ABNT">O relatório de sustentabilidade como ativo de reputação junto a investidores<small>Nogueira e Prado (2023), cap. 2</small></button>
        <button class="grifo-item" style="border-color:var(--hl-dissert)" data-acao="toast" data-msg="Citação inserida no parágrafo, com página e em ABNT">O consumidor deixa de avaliar práticas e passa a avaliar narrativas<small>Nogueira e Prado (2023), cap. 1</small></button>
        <button class="grifo-item" style="border-color:var(--hl-critica)" data-acao="toast" data-msg="Abrindo o argumento ligado a este grifo">Conveniência da reputação e supressão do compromisso ambiental<small>Teixeira, p. 48</small></button>
      </div>`:`
      <p class="m-0 sub">Entrevista desta seção</p>
      <div class="msg tutor"><span class="av">${I.escrita}</span><div><p>O que esta seção precisa provar para a sua tese funcionar?</p></div></div>
      <div class="msg eu">Que a reputação era o produto, não um efeito colateral. Senão o greenwashing vira só exagero de comunicação.</div>
      <div class="msg tutor"><span class="av">${I.escrita}</span><div><p>Boa. Você tem isso em Nogueira e Prado. Agora: no parágrafo em revisão você vai além e afirma intenção (“sabiam”). Quer sustentar intenção ou basta mostrar que lucravam?</p></div></div>
      <div class="p-0 atalhos">
        <button data-acao="toast" data-msg="O copilot propõe versões do parágrafo selecionado">Propor versões</button>
        <button data-acao="toast" data-msg="3 frases desta seção dependem de fonte">Onde falta fonte?</button>
        <button data-acao="toast" data-msg="Comparado ao seu overview: frases mais longas que a sua média">Isso soa como eu?</button>
      </div>
      <form class="p-0 b-0 entrada" data-demo-toast="Na versão funcional, o copilot responde aqui"><textarea placeholder="Responda ou pergunte ao copilot" aria-label="Mensagem ao copilot"></textarea><button type="submit" aria-label="Enviar">${I.enviar}</button></form>`}
    </aside>
  </div>`;
}

/* =========================================================
   Diálogos
   ========================================================= */
const DIALOGOS = [
  {id:'d1', tema:'A adesão das equipes basta como critério de avaliação?', leit:['goldkuhl2012','venable2016'], modo:'Contraponto', data:'hoje', n:6},
  {id:'d2', tema:'A conveniência da vitrine é das empresas ou dos reguladores?', leit:['teixeira2021','nogueira2023'], modo:'Socrático', data:'11 nov.', n:14},
  {id:'d3', tema:'A crítica à simulação do RotaCoop é justa?', leit:['moraes2024'], modo:'Alinhamento', data:'05 nov.', n:9},
];
const MODOS = {Contraponto:'A IA defende a posição contrária à sua', 'Socrático':'A IA só pergunta, até você chegar à sua posição', Alinhamento:'A IA compara sua visão com a dos autores lidos'};
V.dialogos = () => {
  if(modoReal()) return window.rb&&window.rb.dissertacaoUI ? window.rb.dissertacaoUI.dialogos() : esqueleto('Diálogos');
  const d=DIALOGOS.find(x=>x.id===S.dlg)||DIALOGOS[0];
  return `
  <div class="topo"><div><h1>Diálogos</h1><p>Conversas sobre as ideias das leituras: alinhar visões, testar contrapontos e firmar posições.</p></div>
    <div class="acoes"><button class="btn prim" data-acao="toast" data-msg="Na versão funcional, você escolhe o tema, as leituras e o modo.">${I.mais}Novo diálogo</button></div></div>
  <div class="dlg-grid">
    <div>${DIALOGOS.map(x=>`<button class="dlg-item ${x.id===d.id?'on':''}" data-dlg="${x.id}"><b>${x.tema}</b><span>${x.modo}, ${x.data}</span><span>${x.leit.map(i=>citCurta(L(i))).join('; ')}</span></button>`).join('')}</div>
    <section class="conversa-card">
      <header>
        <h2>${d.tema}</h2>
        <div class="linha-h">
          <div class="seg" role="group" aria-label="Modo do diálogo">${Object.keys(MODOS).map(m=>`<button class="${m===d.modo?'on':''}" title="${MODOS[m]}" data-acao="toast" data-msg="${MODOS[m]}">${m}</button>`).join('')}</div>
          ${d.leit.map(i=>`<a class="sem-sublinhado chip proj" href="#leitor/${i}">${citCurta(L(i))}</a>`).join('')}
        </div>
      </header>
      <div class="corpo">
        <div class="m-0 aviso-demo-pg">Diálogo de exemplo, escrito para o protótipo.</div>
        <div class="msg eu">Quero defender que, para roteirizadores em cooperativas, a adesão das equipes às rotas substitui a economia de quilometragem em simulação.</div>
        <div class="msg tutor"><span class="av">${I.dialogos}</span><div><p>Vou defender o lado contrário. Uma equipe pode seguir cem vezes uma rota ruim. Adesão mostra uso, não ganho.</p><p>Se a banca disser que você trocou eficiência por aceitação, o que você responde?</p></div></div>
        <div class="msg eu">Que a utilidade é declarada antes dos testes e o critério é decisional: a coleta melhora ou não.</div>
        <div class="msg tutor"><span class="av">${I.dialogos}</span><div><p>Isso responde em parte, mas muda o seu argumento. Se é a utilidade decisional que valida, a adesão deixa de substituir a economia e vira condição necessária.</p><p>Você concorda com essa reformulação?</p></div></div>
        <div class="msg eu">Concordo. Adesão é necessária, não suficiente.</div>
      </div>
      <form class="entrada" data-demo-toast="Na versão funcional, a IA responde no modo escolhido"><textarea placeholder="Continue o diálogo" aria-label="Mensagem"></textarea><button type="submit" aria-label="Enviar">${I.enviar}</button></form>
    </section>
    <aside class="lado">
      <section class="bloco"><h3>Posições que você firmou</h3>
        <div class="pos">A adesão das equipes é condição necessária, não suficiente; quem valida é a utilidade decisional.
          <div class="bts"><button class="btn" data-acao="toast" data-msg="Tese do argumento atualizada. A versão anterior fica no histórico.">Atualizar argumento</button><button class="btn" data-acao="toast" data-msg="Posição salva na memória">Salvar na memória</button></div></div>
      </section>
      <section class="bloco"><h3>Contrapontos sem resposta</h3><ul><li>Como medir utilidade decisional sem avaliadores humanos?</li></ul></section>
    </aside>
  </div>`;
};

/* =========================================================
   Overview do autor
   ========================================================= */
V.autor = () => modoReal() ? (window.rb&&window.rb.overviewUI ? window.rb.overviewUI.tela() : esqueleto('Overview do autor', 'grade')) : `
  <div class="topo"><div><h1>Overview do autor</h1><p>Como você escreve, a partir dos seus textos e das conversas com o tutor e o copilot. O copilot usa isto para proteger a sua voz.</p></div>
    <div class="acoes"><button class="btn prim" data-acao="toast" data-msg="Na versão funcional, você envia .docx, .pdf ou .md com textos seus.">${I.upload}Adicionar textos meus</button></div></div>
  <div class="aviso-demo-pg">Análise de exemplo. Ela só será real depois que você enviar seus textos.</div>
  <div class="aut-grid">
    <section class="bloco aut-estilo">
      <h3>Seu estilo, em palavras</h3>
      <p>Você abre os parágrafos com uma afirmação curta e usa as frases seguintes para qualificar. Prefere a voz ativa e evita jargão quando há palavra comum que sirva.</p>
      <p>Nos textos de método, as frases ficam bem mais longas e você empilha orações subordinadas. É ali que o texto perde clareza.</p>
      <div class="t-legenda mute-2">Baseado em 9 textos e 214 conversas. Atualizado hoje.</div>
    </section>
    <section class="bloco aut-corpus">
      <h3>Textos analisados</h3>
      <ul class="corpus-lista">
        <li>Manuscrito sobre consumo consciente<span>4.100 palavras</span></li>
        <li>Dissertação, v3 (só as partes suas)<span>9.800</span></li>
        <li>Resenha crítica do FEDS<span>1.210</span></li>
        <li>6 outros textos<span>6.200</span></li>
      </ul>
      <button class="btn" data-acao="toast" data-msg="Na versão funcional, você escolhe quais textos entram na análise.">Gerenciar textos</button>
    </section>
    <section class="bloco aut-metr">
      <div><b>19 palavras</b><span>por frase, em média</span><small>34 nos trechos de método</small></div>
      <div><b>8%</b><span>das frases na voz passiva</span><small>Estável nos últimos 3 meses</small></div>
      <div><b>0,9</b><span>citação por parágrafo</span><small>Abaixo de 0,5 na introdução</small></div>
      <div><b>3 em 10</b><span>parágrafos terminam em pergunta</span><small>Recurso que você usa para transição</small></div>
    </section>
    <section class="bloco aut-temas"><h3>Temas recorrentes</h3>
      <div class="dist">${[['Avaliação de sistemas',9],['Logística urbana',7],['Sustentabilidade',5],['Cooperativismo',5],['Método',4]].map(([n,v])=>`<div style="grid-template-columns:1fr 60px 18px"><span>${n}</span><span class="trilho"><i style="background:var(--petroleo);width:${v/9*100}%"></i></span><span class="mute-2">${v}</span></div>`).join('')}</div>
      <p class="t-legenda m-0 mt-3 mute-2">Número de textos em que o tema aparece.</p>
    </section>
    <section class="bloco aut-termos"><h3>Palavras e conectivos que são seus</h3>
      <div class="termos">${[['ou seja',41],['por isso',33],['na prática',27],['utilidade',25],['decisão',22],['de fato',19],['portanto',8]].map(([w,n])=>`<span class="chip"><b>${w}</b> ${n}</span>`).join('')}</div>
      <p class="t-legenda m-0 mt-3 mute-2">“Portanto” aparece pouco nos seus textos. Quando o copilot usar, desconfie.</p>
    </section>
    <section class="bloco aut-evol"><h3>Participação da IA por texto</h3>
      <div class="evol">${TEXTOS.map(t=>`<div><span>${t.tit.length>38?t.tit.slice(0,38)+'…':t.tit}</span>${barraAutoria(t.a,t.meta)}</div>`).join('')}</div>
      <div class="mt-3">${LEG_AUTORIA}</div>
    </section>
    <section class="bloco aut-obs"><h3>Para observar</h3>
      <ul class="m-0 pl-lista t-meta flex coluna gap-2">
        <li>“De fato” aparece em 19 textos, muitas vezes sem função.</li>
        <li>Nas conclusões, você retoma a tese com as mesmas palavras da introdução.</li>
        <li>Quando escreve com pressa, as citações somem antes das afirmações mais fortes.</li>
      </ul>
    </section>
    <section class="bloco aut-uso"><h3>Como o copilot usa este overview</h3>
      <ul class="m-0 pl-lista t-meta flex coluna gap-2">
        <li>Propõe versões no seu comprimento de frase e com os seus conectivos.</li>
        <li>Avisa quando um trecho se afasta do seu estilo (“Isso soa como eu?”).</li>
        <li>Nunca imita o seu estilo para escrever do zero.</li>
      </ul>
    </section>
  </div>`;

/* =========================================================
   Memória
   ========================================================= */
const MEM_PEND = [
  ['Prefere a formulação “adesão é condição necessária, não suficiente” para o argumento de avaliação','Diálogo de hoje'],
  ['No artigo de Sustentabilidade e Organizações, não quer discutir legislação ambiental','Entrevista do texto, 13 nov.'],
  ['O orientador aceitou trocar a economia simulada pela adesão das equipes, com critério de utilidade declarado antes dos testes','Orientação, 06 nov.'],
];
const MEM_CAT = [
  ['Sobre você',[['Mestrado acadêmico, com orientador definido','Você, na configuração'],['Experiência profissional no tema da pesquisa','Você, na configuração']]],
  ['Dissertação',[['Tema: roteirizador de coleta seletiva para cooperativas de reciclagem','Revisão do projeto, v3'],['Método: Design Science Research, com pragmatismo nas três camadas','Orientação, 09 out.'],['Avaliação: critério de utilidade declarado antes; adesão das equipes às rotas; utilidade decisional','Argumentos']]],
  ['Como você escreve',[['Linguagem simples; uma ideia por título','Você, nas preferências'],['Só afirmar o que a fonte sustenta','Você, nas preferências'],['ABNT sempre','Você, nas preferências']]],
  ['Regras para a IA',[['Tutor provoca e não escreve por você','Você, nas preferências'],['Copilot propõe versões do que você escreveu; nunca escreve do zero','Você, nas preferências'],['Citar só o acervo; sugerir fora dele e pedir que você busque','Você, nas preferências']]],
];
V.memoria = () => modoReal() ? (window.rb&&window.rb.memoriaUI ? window.rb.memoriaUI.tela() : esqueleto('Memória')) : `
  <div class="topo"><div><h1>Memória</h1><p>O que a IA sabe sobre você e seus projetos. Você aprova o que fica, apaga o que não serve e exporta para outras IAs.</p></div></div>
  <details class="mb-4 ajuda-det"><summary>Como a memória funciona?</summary><div class="mt-3 camadas">
    <div class="camada"><span class="n">1</span><b>Conversas</b><p>Registro completo de tudo que você trocou com o tutor, o copilot e nos diálogos.</p><div class="q">214 conversas, em memoria/conversas</div></div>
    <div class="camada"><span class="n">2</span><b>Memória consolidada</b><p>Fatos, decisões e preferências que você aprovou. É curta de propósito.</p><div class="q">38 itens, em memoria/*.md</div></div>
    <div class="camada"><span class="n">3</span><b>Contexto de cada pedido</b><p>Montado na hora: memória consolidada + o texto ou leitura aberta + trechos relevantes das conversas.</p><div class="q">Cerca de 12 mil tokens por pedido</div></div>
  </div></details>
  <div class="mem-grid">
    <div>
      <section class="sug"><h3>A IA quer lembrar (${MEM_PEND.length})</h3>
        ${MEM_PEND.map(([t,f])=>`<div class="sug-it"><div>${t}<small>${f}</small></div><div class="bts"><button class="btn prim" data-mem-ok>Lembrar</button><button class="btn" data-acao="toast" data-msg="Na versão funcional, você edita antes de aprovar.">Editar</button><button class="btn fant" data-mem-ok data-descartar>Descartar</button></div></div>`).join('')}
      </section>
      ${MEM_CAT.map(([cat,its],i)=>`<details class="mem-cat" ${i<2?'open':''}><summary>${cat}<span>${its.length} itens</span></summary>
        ${its.map(([t,f])=>`<div class="mem-it"><div>${t}<small>Origem: ${f}</small></div><div class="bts"><button class="btn fant" data-acao="toast" data-msg="Na versão funcional, você edita o item.">Editar</button><button class="btn fant" data-acao="esquecer">Esquecer</button></div></div>`).join('')}
      </details>`).join('')}
    </div>
    <aside class="lado">
      <section class="bloco"><h3>Exportar para outras IAs</h3>
        <div class="opcoes">
          <label><input type="radio" name="fmt" checked><span>Um arquivo Markdown<small>Para colar ou anexar em qualquer assistente</small></span></label>
          <label><input type="radio" name="fmt"><span>JSON estruturado<small>Para ferramentas e automações</small></span></label>
          <label><input type="radio" name="fmt"><span>Pasta completa (.zip)<small>Memória consolidada e conversas</small></span></label>
        </div>
        <div class="opcoes">
          <label><input type="checkbox" checked>Sobre você e como você escreve</label>
          <label><input type="checkbox" checked>Dissertação</label>
          <label><input type="checkbox">Disciplinas e textos</label>
          <label><input type="checkbox">Conversas completas</label>
        </div>
        <pre class="prev"># Contexto exportado do researchbook
Exportado em 13/11/2026.

## Sobre você
- Mestrado acadêmico, com orientador definido
- Experiência profissional no tema da pesquisa

## Dissertação
- Tema: roteirizador de coleta seletiva
  para cooperativas de reciclagem
- Método: Design Science Research, com
  pragmatismo nas três camadas

## Regras para a IA
- Não escreva do zero; proponha versões
  do que eu escrevi
- Cite só fontes que eu fornecer</pre>
        <button class="w-100 j-centro btn prim" data-acao="toast" data-msg="Arquivo gerado em memoria/exportar/contexto-2026-11-13.md">Exportar contexto</button>
      </section>
      <section class="bloco"><h3>Onde fica</h3><p>Tudo em <b>researchbook/memoria</b>, na sua pasta do Drive, em arquivos de texto que você pode ler e editar fora do app.</p></section>
    </aside>
  </div>`;


/* =========================================================
   Projetos: uma página por disciplina
   ========================================================= */
/* =========================================================
   Busca rápida (Ctrl+K)
   ========================================================= */
function itensBusca(){
  if(modoReal()&&window.rb&&window.rb.busca) return window.rb.busca.itens();
  const pag=[['Hoje','#painel'],['Biblioteca','#biblioteca'],['Trilhas','#trilhas'],['Fichamentos','#fichamentos'],['Textos','#escrita'],['Diálogos','#dialogos'],['Revisão do projeto','#projeto'],['Orientação','#orientacao'],['Argumentos','#argumentos'],['Cartões','#cartoes'],['Overview do autor','#autor'],['Memória','#memoria'],['Ajustes','#ajustes'],['Projetos','#disciplinas']].map(([n,h])=>({n,h,t:'Página'}));
  return [...pag,
    ...LEITURAS.map(l=>({n:l.tit,h:'#leitor/'+l.id,t:citCurta(l)})),
    ...TEXTOS.map(t=>({n:t.tit,h:'#texto/'+t.id,t:'Texto'})),
    ...ARGUMENTOS.map(a=>({n:a.tese,h:'#argumentos',t:'Argumento',arg:a.id})),
    ...DISCIPLINAS.map((d,i)=>({n:d,h:'#disciplina/'+i,t:'Disciplina'})),
    ...Object.entries(AULAS).flatMap(([i,as])=>as.map(a=>({n:`Aula ${a.n}: ${a.tit}`,h:`#aula/${i}/${a.id}`,t:DISCIPLINAS[i]})))];
}
function resultadosBusca(q){
  const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  // Todas as palavras precisam aparecer; grifos só entram quando há busca, depois dos outros resultados.
  const ps=norm(q.trim()).split(/\s+/).filter(Boolean);
  const bate=x=>{const h=norm(x.n+' '+x.t+' '+(x.extra||''));return ps.every(p=>h.includes(p))};
  const todos=itensBusca().filter(x=>ps.length?bate(x):!x.grifo);
  const its=[...todos.filter(x=>!x.grifo),...todos.filter(x=>x.grifo)].slice(0,8);
  return its.length?its.map((x,i)=>`<a href="${x.h}" class="${i===0?'sel':''}" ${x.arg?`data-arg="${x.arg}"`:''} ${x.dlg?`data-dlg-busca="${x.dlg}"`:''}>${esc(x.n.length>80?x.n.slice(0,80)+'…':x.n)}<span>${esc(x.t)}</span></a>`).join(''):'<div class="vazio-b">Nada encontrado. Tente o sobrenome do autor ou uma palavra do título.</div>';
}
function abrirBusca(){
  const veu=document.getElementById('veu');
  veu.innerHTML=`<div class="modal busca-modal"><h2 id="modal-tit" class="sr sr">Buscar</h2><input id="qk" placeholder="Buscar leituras, textos, argumentos e páginas" aria-label="Buscar" autocomplete="off"><div class="res-busca" id="res-busca">${resultadosBusca('')}</div></div>`;
  veu.classList.add('on'); setTimeout(()=>document.getElementById('qk').focus(),20);
}
function abrirBriefing(){
  const veu=document.getElementById('veu');
  veu.innerHTML=`<div class="modal"><h2 id="modal-tit">Briefing do texto</h2><p>O que você definiu na preparação. O copilot usa isto em toda a escrita.</p>
    <div class="m-0 mb-4 tese-box"><small>Tese de trabalho: sua frase</small><p>O greenwashing não é um desvio de comunicação: é consequência de aceitarmos o relatório de sustentabilidade como peça de reputação enquanto isso era conveniente.</p></div>
    <ul class="m-0 mb-4 pl-lista t-meta flex coluna gap-2"><li>Artigo de disciplina, até 7 páginas, ABNT, entrega em 28 nov.</li><li>Fica de fora: legislação ambiental</li><li>Acervo: 2 pontos sustentados, 1 frágil, 2 lacunas</li><li>Teto de participação da IA: 60%</li></ul>
    <div class="pe"><button class="btn fant" data-acao="fechar">Fechar</button><button class="btn" data-passo-texto="0" data-acao="fechar">Editar a preparação</button></div></div>`;
  veu.classList.add('on');
}


/* =========================================================
   Disciplina como central: aulas, agenda, anotações
   ========================================================= */
const AULAS = {
  0:[
    {id:'m7', n:7, data:'12 nov.', tit:'Avaliação de artefatos em Design Science', dur:'1h 42min', st:'pronta', conc:['Avaliação de artefatos','FEDS','DSR'], leit:['venable2016'], fora:[['Sonnenberg e vom Brocke (2012)','Evaluations in the science of the artificial']], notas:2, cartoes:4},
    {id:'m6', n:6, data:'05 nov.', tit:'Pragmatismo e paradigmas em Sistemas de Informação', dur:'1h 38min', st:'pronta', conc:['Pragmatismo','DSR'], leit:['goldkuhl2012','iivari2007'], fora:[], notas:3, cartoes:5},
    {id:'m5', n:5, data:'29 out.', tit:'Estratégias de pesquisa qualitativa', dur:'', st:'sem-audio', conc:[], leit:[], fora:[], notas:1, cartoes:0},
  ],
  1:[
    {id:'a7', n:7, data:'10 nov.', tit:'Análise de sensibilidade no PROMETHEE II', dur:'1h 51min', st:'transcrevendo', prog:60, conc:['PROMETHEE'], leit:['brans1985'], fora:[], notas:0, cartoes:0},
    {id:'a6', n:6, data:'03 nov.', tit:'Pesos e consistência no AHP', dur:'1h 47min', st:'pronta', conc:['AHP'], leit:['saaty1980'], fora:[], notas:2, cartoes:3},
  ],
  2:[
    {id:'d6', n:6, data:'11 nov.', tit:'Relatórios de sustentabilidade e reputação', dur:'1h 29min', st:'pronta', conc:['Greenwashing'], leit:['nogueira2023','teixeira2021'], fora:[], notas:4, cartoes:3},
  ],
};
const EVENTOS = [
  {d:0, tipo:'Sessão de estudo', tit:'Ler Iivari (2007) antes da aula', dia:'18', sem:'qua.', mes:'nov.', hora:'20h às 21h', g:true, semana:'Próxima semana', origem:'Criada a partir da trilha'},
  {d:0, tipo:'Aula', tit:'Aula 8: Métodos mistos em DSR', dia:'19', sem:'qui.', mes:'nov.', hora:'19h às 21h, toda quinta', g:true, semana:'Próxima semana'},
  {d:0, tipo:'Entrega', tit:'Fichamento crítico', dia:'27', sem:'sex.', mes:'nov.', hora:'até 23h59', g:true, semana:'Daqui a duas semanas'},
  {d:1, tipo:'Aula', tit:'Aula 8: Robustez e cenários', dia:'17', sem:'ter.', mes:'nov.', hora:'19h às 21h, toda terça', g:true, semana:'Próxima semana'},
  {d:1, tipo:'Entrega', tit:'Trabalho em grupo, seção 4', dia:'20', sem:'sex.', mes:'nov.', hora:'até 23h59', g:true, semana:'Próxima semana'},
  {d:2, tipo:'Aula', tit:'Aula 7: Indicadores ambientais e auditoria', dia:'18', sem:'qua.', mes:'nov.', hora:'14h às 16h, toda quarta', g:true, semana:'Próxima semana'},
  {d:2, tipo:'Entrega', tit:'Artigo de até 7 páginas', dia:'28', sem:'sáb.', mes:'nov.', hora:'até 23h59', g:false, semana:'Daqui a duas semanas'},
];
const ANOTACOES = {
  0:[['A professora pediu para trazer o critério de avaliação da própria pesquisa na aula 8.','12 nov.'],['Perguntar se resenha pode ser em inglês.','05 nov.']],
  1:[['Grupo decide pesos do AHP até domingo.','10 nov.']],
  2:[['Usar relatórios de três empresas do mesmo setor como exemplo central do artigo.','11 nov.'],['Professor recomendou ler o capítulo 4 de Nogueira e Prado.','04 nov.']],
};
const stAula = a => a.st==='pronta'?'<span class="st-a ok">Transcrita</span>':a.st==='transcrevendo'?`<span class="st-a and">Transcrevendo, ${a.prog}%</span>`:'<span class="st-a">Sem gravação</span>';
const gcal = e => e.g?'<span class="g-st on" title="Também no Google Agenda">✓ No Google Agenda</span>':'<span class="g-st">Só no researchbook</span>';
function eventoLinha(e){
  return `<div class="ev"><div class="ev-data"><b>${e.dia}</b><span>${e.sem}</span></div><div><div class="ev-t">${e.tit}</div><div class="ev-m"><span class="chip">${e.tipo}</span>${e.hora}${e.origem?`. ${e.origem}`:''}</div></div>${gcal(e)}</div>`;
}
const DISC_ABAS = [['geral','Visão geral'],['aulas','Aulas'],['leituras','Leituras'],['textos','Textos'],['agenda','Agenda']];
V.disciplina = (i) => {
  if(modoReal()) return window.rb&&window.rb.disciplinasUI ? window.rb.disciplinasUI.tela(decodeURIComponent(i||'')) : esqueleto('Disciplina');
  i=Number(i)||0; const d=DISCIPLINAS[i]; const inf=DISC_INFO[d]; const aba=S.discAba;
  const ids=LEITURAS.filter(l=>l.disc===d).map(l=>l.id);
  const tr=TRILHAS.find(t=>t.itens.some(x=>L(x).disc===d && L(x).proj!=='diss'));
  const pseudo={nome:'Leituras da disciplina', desc:`${ids.length} leituras cadastradas`, prazo:inf.ent[1], falta:inf.ent[0], urgente:inf.ent[2], itens:tr?tr.itens:ids};
  const ts=TEXTOS.filter(t=>t.disc===d), aulas=AULAS[i]||[], evs=EVENTOS.filter(e=>e.d===i), notas=ANOTACOES[i]||[];
  const ult=aulas.find(a=>a.st==='pronta');
  const aulaLinha=a=>`<a class="aula-l" href="#aula/${i}/${a.id}"><span class="n-a">${a.n}</span><div><b>${a.tit}</b><span>${a.data}${a.dur?`, ${a.dur}`:''}${a.notas?`, ${a.notas} anotaç${a.notas>1?'ões':'ão'}`:''}</span></div>${stAula(a)}</a>`;
  let corpo='';
  if(aba==='geral') corpo=`
    <div class="proj-grid">
      <div>
        <section class="mb-4 bloco"><h3>Próximos compromissos</h3><div class="evs">${evs.slice(0,3).map(eventoLinha).join('')}</div><button class="mt-2 btn fant" data-disc-aba="agenda">Ver agenda</button></section>
        ${ult?`<section class="bloco"><h3>Última aula transcrita</h3><a class="b-0 aula-l pt-0 pb-3" href="#aula/${i}/${ult.id}"><span class="n-a">${ult.n}</span><div><b>${ult.tit}</b><span>${ult.data}, ${ult.dur}. ${ult.cartoes} cartões gerados</span></div></a><a class="btn" href="#aula/${i}/${ult.id}">Abrir transcrição</a></section>`:''}
      </div>
      <aside class="lado">
        <section class="bloco"><h3>Anotações da disciplina</h3>
          <form class="nota-rap" data-demo-toast="Anotação salva na disciplina"><input placeholder="Anote algo rápido" aria-label="Nova anotação"><button class="btn" type="submit">Salvar</button></form>
          <ul class="notas-d">${notas.map(([t,dt])=>`<li>${t}<small>${dt}</small></li>`).join('')}</ul></section>
        <section class="bloco"><h3>Leituras</h3><div class="t-meta mute">${ids.filter(x=>L(x).etapa>4).length} de ${ids.length} concluídas</div><div class="barra"><i style="width:${ids.length?ids.filter(x=>L(x).etapa>4).length/ids.length*100:0}%"></i></div><button class="btn fant" data-disc-aba="leituras">Ver leituras</button></section>
      </aside>
    </div>`;
  if(aba==='aulas') corpo=`
    <section class="larg-pagina bloco"><div class="aulas">${aulas.map(aulaLinha).join('')}</div>
      <details class="mt-3 pt-4 borda-topo ajuda-det"><summary>Como funcionam as gravações?</summary><p class="m-0 mt-3 t-meta mute">Envie o áudio da aula. O Gemini transcreve, resume e encontra os conceitos e as leituras citadas. A transcrição pode ser grifada como qualquer texto, com as mesmas cores, e gera cartões de revisão.</p></details></section>`;
  if(aba==='leituras') corpo=trilhaHTML(pseudo);
  if(aba==='textos') corpo=`<div class="txt-lista">${ts.length?ts.map(t=>`<a class="txt-card" href="#texto/${t.id}" data-ptexto="${t.passo}"><div><div class="t">${t.tit}</div><div class="m">${t.tipo}. ${t.limite}, entrega ${t.prazo}</div></div><div class="et"><span>${t.passo<=3?'Preparando':t.passo===4?'Escrevendo':'Em revisão'}</span></div><div class="autoria"><span>Participação da IA: <b>${partIA(t.a)}%</b></span>${barraAutoria(t.a,t.meta)}</div></a>`).join(''):'<div class="vazio">Nenhum texto nesta disciplina. Quando houver uma entrega escrita, use “Novo texto”.</div>'}</div>`;
  if(aba==='agenda') corpo=`
    <div class="proj-grid">
      <section class="bloco">
        ${[...new Set(evs.map(e=>e.semana))].map(s=>`<h3 class="mt-2">${s}</h3><div class="evs">${evs.filter(e=>e.semana===s).map(eventoLinha).join('')}</div>`).join('')}
      </section>
      <aside class="lado"><section class="bloco"><h3>Google Agenda</h3><p class="m-0 mb-3">Tudo o que você agenda aqui vai para a agenda <b>researchbook</b> da sua conta Google. Se você mudar ou apagar no researchbook, muda ou some lá também.</p><a class="btn fant" href="#ajustes/agenda">Configurar</a></section></aside>
    </div>`;
  return `
  <a class="voltar" href="#disciplinas">${I.voltar}Projetos</a>
  <div class="topo"><div><h1><span class="proj-dot grande" style="background:${CORES_DISC[i]}"></span>${d}</h1><p>${inf.doc}, ${inf.sem}. Próxima entrega: ${inf.ent[0]}, em ${inf.ent[1]}</p></div>
    <div class="acoes"><button class="btn" data-acao="novo-evento" data-disc="${i}">${I.mais}Agendar</button><button class="btn prim" data-acao="enviar-aula" data-disc="${i}">${I.upload}Enviar gravação de aula</button></div></div>
  <nav class="mb-6 subnav" aria-label="Seções da disciplina">${DISC_ABAS.map(([k,n])=>`<a href="#disciplina/${i}" data-disc-aba="${k}" class="${k===aba?'on':''}">${n}</a>`).join('')}</nav>
  ${corpo}`;
};

const TRANSCR = `
<p><button class="ts" data-acao="toast" data-msg="O áudio pula para 00:02:10">00:02</button><b>Professora</b> Hoje a pergunta é simples de enunciar e difícil de responder: como sabemos que um artefato funciona? Em pesquisa de design, construir não basta. A avaliação é o que transforma uma solução em conhecimento.</p>
<p><button class="ts" data-acao="toast" data-msg="O áudio pula para 00:09:45">09:45</button><b>Professora</b> <mark class="conceito" data-id="t1">Há duas grandes famílias de avaliação: a ex ante, que acontece antes de o artefato existir por inteiro, e a ex post, depois.</mark> Muita gente só faz a segunda e chega na banca sem ter justificado as escolhas do design.</p>
<p><button class="ts" data-acao="toast" data-msg="O áudio pula para 00:21:30">21:30</button><b>Professora</b> O quadro do Venable e colegas organiza isso por propósito e por paradigma. A pergunta prática é: qual é o principal risco do seu design? É técnico, é humano, é de uso? A estratégia sai daí.</p>
<p><button class="ts" data-acao="toast" data-msg="O áudio pula para 00:34:12">34:12</button><b>Colega</b> E quando o artefato depende de pessoas que podem não usá-lo, como uma rota que a equipe pode ignorar? A avaliação ex post não fica frágil?</p>
<p><button class="ts" data-acao="toast" data-msg="O áudio pula para 00:35:02">35:02</button><b>Professora</b> <mark class="dissert" data-id="t2">Então a adesão vira parte do que você avalia, não um detalhe. Você declara antes o que conta como funcionar e mede quanto o artefato é usado de fato.</mark> Vale ler também o trabalho de Sonnenberg e vom Brocke sobre avaliações ao longo do ciclo de construção.</p>
`;
V.aula = (i,k) => {
  if(modoReal()) return window.rb&&window.rb.disciplinasUI ? window.rb.disciplinasUI.telaAula(decodeURIComponent(i||''),decodeURIComponent(k||'')) : esqueleto('Aula', 'texto');
  i=Number(i)||0; const d=DISCIPLINAS[i]; const a=(AULAS[i]||[]).find(x=>x.id===k)||AULAS[0][0];
  const onda=Array.from({length:90},(_,j)=>{const h=8+Math.abs(Math.sin(j*1.3)*12+Math.sin(j*.37)*9);return `<i class="${j<30?'tocado':''}" style="height:${Math.min(h,30)}px"></i>`}).join('');
  const ab=S.aulaAba;
  let main='';
  if(a.st!=='pronta') main=`<div class="vazio bloco">${a.st==='transcrevendo'?`Transcrevendo a gravação: ${a.prog}% concluído. Você pode fechar o researchbook; a transcrição continua na sua pasta quando terminar.`:'Esta aula não tem gravação. Você pode enviar o áudio ou escrever suas anotações.'}</div>`;
  else if(ab==='transcricao') main=`<article class="doc transcr" id="doc"><div class="aviso-demo">Transcrição de exemplo, escrita para o protótipo.</div>${TRANSCR}</article>`;
  else if(ab==='resumo') main=`<section class="editor"><h2>Resumo da aula</h2><p class="instr">Gerado pelo Gemini a partir da transcrição. Confira antes de usar.</p><ul class="resumo-aula"><li>Construir o artefato não basta: a avaliação é o que gera conhecimento.</li><li>Avaliação ex ante (antes do artefato pronto) e ex post (depois); justificar as escolhas exige as duas.</li><li>A estratégia de avaliação sai do principal risco do design (FEDS).</li><li>Quando o artefato depende de quem o usa, a adesão entra no que se avalia, com critério declarado antes.</li></ul><h3 class="t-ui forte m-0 mt-6 mb-3">Perguntas para estudar</h3><ul class="resumo-aula"><li>Qual é o principal risco do seu roteirizador, e que estratégia do FEDS ele pede?</li><li>O que você vai declarar ex ante como “funcionar”?</li></ul><button class="mt-3 btn" data-acao="toast" data-msg="${a.cartoes} cartões criados a partir desta aula">Criar ${a.cartoes} cartões</button></section>`;
  else main=`<section class="editor"><h2>Suas anotações</h2><p class="instr">O que você anotou durante a aula. Fica separado da transcrição.</p><div class="campo"><textarea style="min-height:200px">A professora falou de ex ante vs ex post. Conferir se minha avaliação tem as duas.\n\nMinha pergunta sobre adesão das equipes gerou boa discussão (35:02). Usar na seção 3.5.</textarea></div></section>`;
  return `
  <button class="fundo-0 b-0 p-0 cursor voltar" data-voltar-disc="${i}">${I.voltar}${d}</button>
  <div class="topo"><div><h1 class="t-titulo-1">Aula ${a.n}: ${a.tit}</h1><p>${a.data}${a.dur?`, ${a.dur}`:''}. ${stAula(a)}</p></div>
    <div class="acoes"><button class="btn" data-acao="novo-evento" data-disc="${i}">${I.mais}Agendar revisão</button></div></div>
  ${a.st==='pronta'?`<div class="mb-4 audio"><button class="play" aria-label="Ouvir gravação" data-acao="toast" data-msg="Na versão funcional, o áudio toca aqui">${I.play}</button><div class="onda">${onda}</div><small>34:12 de ${a.dur}</small></div>`:''}
  <div class="aula-grid">
    <div>
      ${a.st==='pronta'?`<nav class="mb-4 subnav">${[['transcricao','Transcrição'],['resumo','Resumo'],['notas','Suas anotações']].map(([x,n])=>`<a href="#aula/${i}/${a.id}" data-aula-aba="${x}" class="${x===ab?'on':''}">${n}</a>`).join('')}</nav>`:''}
      ${main}
    </div>
    <aside class="lado">
      ${a.conc.length?`<section class="bloco"><h3>Conceitos citados</h3><div class="termos">${a.conc.map(c=>`<span class="chip">${c}</span>`).join('')}</div></section>`:''}
      ${a.leit.length||a.fora.length?`<section class="bloco"><h3>Leituras citadas</h3>
        ${a.leit.map(x=>`<a class="lc" href="#leitor/${x}">${citCurta(L(x))}<span>Na biblioteca, ${rotEtapa(L(x).etapa).toLowerCase()}</span></a>`).join('')}
        ${a.fora.map(([au,ti])=>`<div class="lc"><b class="forte">${au}</b><span>${ti}. Fora da biblioteca</span><button class="mt-2 btn mini" data-acao="toast" data-msg="Sugestão salva. Adicione o PDF à biblioteca para o tutor e o copilot poderem usar.">Marcar para buscar</button></div>`).join('')}
      </section>`:''}
      <section class="bloco"><h3>Próxima aula</h3><p class="m-0">${(EVENTOS.find(e=>e.d===i&&e.tipo==='Aula')||{}).tit||'Sem aula agendada'}, ${(EVENTOS.find(e=>e.d===i&&e.tipo==='Aula')||{}).sem||''} ${(EVENTOS.find(e=>e.d===i&&e.tipo==='Aula')||{}).dia||''} nov.</p></section>
    </aside>
  </div>`;
};

function abrirModalAula(i){
  const veu=document.getElementById('veu');
  veu.innerHTML=`<div class="modal"><h2 id="modal-tit">Enviar gravação de aula</h2><p>O Gemini transcreve, resume e encontra os conceitos e as leituras citadas. A gravação fica na pasta da disciplina.</p>
    <div class="larg-total gap-0 aj"><div class="linha2">
      <div class="campo"><label>Disciplina</label><select>${DISCIPLINAS.map((d,j)=>`<option ${j===i?'selected':''}>${d}</option>`).join('')}</select></div>
      <div class="campo"><label>Data da aula</label><input type="date" value="2026-11-12"></div>
    </div></div>
    <div class="campo"><label>Tema da aula <span>opcional; a IA sugere a partir da transcrição</span></label><input placeholder="Ex.: Avaliação de artefatos em Design Science"></div>
    <div class="solta">Arraste a gravação (MP3, M4A, WAV) ou <u>escolha um arquivo</u></div>
    <div class="opcoes"><label><input type="checkbox" checked>Transcrever e resumir</label><label><input type="checkbox" checked>Ligar conceitos e leituras citadas à biblioteca</label><label><input type="checkbox">Criar cartões de revisão a partir do resumo</label></div>
    <p class="t-legenda m-0 mt-n2 mb-4 mute-2">Grave só com o consentimento do professor e da turma.</p>
    <div class="pe"><button class="btn fant" data-acao="fechar">Cancelar</button><button class="btn prim" data-acao="confirmar" data-msg="Gravação enviada. A transcrição fica pronta em alguns minutos.">Enviar e transcrever</button></div></div>`;
  veu.classList.add('on');
}
function abrirModalEvento(i){
  const veu=document.getElementById('veu');
  veu.innerHTML=`<div class="modal"><h2 id="modal-tit">Agendar</h2><p>O evento aparece na disciplina e no seu Google Agenda.</p>
    <div class="campo"><label>Título</label><input value="Ler Iivari (2007) antes da aula"></div>
    <div class="larg-total gap-0 aj"><div class="linha2">
      <div class="campo"><label>Tipo</label><select><option>Sessão de estudo</option><option>Aula</option><option>Entrega</option><option>Encontro de orientação</option><option>Outro</option></select></div>
      <div class="campo"><label>Disciplina ou projeto</label><select>${DISCIPLINAS.map((d,j)=>`<option ${j===i?'selected':''}>${d}</option>`).join('')}<option>Dissertação</option></select></div>
      <div class="campo"><label>Data</label><input type="date" value="2026-11-18"></div>
      <div class="campo"><label>Horário</label><input value="20h às 21h"></div>
      <div class="campo"><label>Repetir</label><select><option>Não repete</option><option>Toda semana</option></select></div>
      <div class="campo"><label>Lembrete</label><select><option>1 dia antes e 1 hora antes</option><option>1 hora antes</option><option>Sem lembrete</option></select></div>
    </div></div>
    <label class="check"><input type="checkbox" checked>Criar também no Google Agenda (agenda researchbook)</label>
    <div class="pe"><button class="btn fant" data-acao="fechar">Cancelar</button><button class="btn prim" data-acao="confirmar" data-msg="Evento criado no researchbook e no Google Agenda">Agendar</button></div></div>`;
  veu.classList.add('on');
}

/* =========================================================
   Modal: adicionar leitura
   ========================================================= */
function abrirModal(){
  const veu=document.getElementById('veu');
  veu.innerHTML=`
  <div class="modal">
    <h2 id="modal-tit">Adicionar obra</h2>
    <p>Cole o DOI para preencher os dados. Sem DOI, preencha à mão.</p>
    <div class="doi-linha"><input id="doi" value="10.25300/MISQ/2013/37.2.01" aria-label="DOI"><button class="btn prim" data-acao="buscar-doi">Buscar dados</button></div>
    <div class="meta-enc" id="meta-enc">
      <div class="ok">✓ Encontrado no Crossref</div>
      <div class="campo"><label>Título</label><input value="Positioning and presenting design science research for maximum impact"></div>
      <div class="larg-total aj"><div class="linha2">
        <div class="campo"><label>Autores</label><input value="Gregor, S.; Hevner, A. R."></div>
        <div class="campo"><label>Ano e veículo</label><input value="2013, MIS Quarterly, 37(2)"></div>
      </div></div>
    </div>
    <div class="solta">Arraste o PDF aqui ou <u>escolha um arquivo</u></div>
    <div class="larg-total gap-0 aj"><div class="linha2">
      <div class="campo"><label>Projeto</label><select>${PROJETOS.map(p=>`<option>${p.nome}</option>`).join('')}</select></div>
      <div class="campo"><label>Disciplina</label><select><option>Nenhuma</option>${DISCIPLINAS.map(d=>`<option>${d}</option>`).join('')}</select></div>
    </div></div>
    <div class="campo"><label>Conceitos e tags</label><div class="chips-ed"><span class="chip">DSR</span><span class="chip">#qualificação</span><input placeholder="Digite e tecle Enter"></div></div>
    <div class="campo"><label>Colocar na trilha</label><select>${TRILHAS.map(t=>`<option>${t.nome}</option>`).join('')}<option>Nenhuma por enquanto</option></select></div>
    <div class="pe"><button class="btn fant" data-acao="fechar">Cancelar</button><button class="btn prim" data-acao="confirmar-add">Adicionar à biblioteca</button></div>
  </div>`;
  veu.classList.add('on');
  setTimeout(()=>document.getElementById('doi').focus(),30);
}
function abrirModalDisciplina(){
  const veu=document.getElementById('veu');
  veu.innerHTML=`<div class="modal">
    <h2 id="modal-tit">Nova disciplina</h2>
    <p>Com o plano de ensino, a IA sugere as leituras obrigatórias e as datas de entrega. Você confirma antes de salvar.</p>
    <div class="campo"><label>Nome</label><input placeholder="Ex.: Teoria das Organizações"></div>
    <div class="larg-total gap-0 aj"><div class="linha2">
      <div class="campo"><label>Docente</label><input placeholder="Nome do professor ou professora"></div>
      <div class="campo"><label>Semestre</label><input value="2026/2"></div>
    </div></div>
    <div class="solta">Arraste o plano de ensino (PDF) aqui ou <u>escolha um arquivo</u></div>
    <label class="check"><input type="checkbox" checked>Criar uma trilha com as leituras obrigatórias</label>
    <div class="pe"><button class="btn fant" data-acao="fechar">Cancelar</button><button class="btn prim" data-acao="confirmar" data-msg="Disciplina criada">Criar disciplina</button></div>
  </div>`;
  veu.classList.add('on');
}
function abrirModalRegistro(tipo){
  if(tipo) S.tipoReg=tipo;
  const t=S.tipoReg;
  const corpo = t==='Áudio' ? `<div class="solta">Arraste a gravação (MP3, M4A, WAV) ou <u>escolha um arquivo</u><br><span class="mute-2">A IA transcreve, resume e extrai os combinados.</span></div>`
    : t==='PDF comentado' ? `<div class="solta">Arraste o PDF com os comentários do orientador ou <u>escolha um arquivo</u><br><span class="mute-2">Os comentários de margem viram itens a responder.</span></div>`
    : `<div class="campo"><label>${t==='Transcrição'?'Cole a transcrição':t==='E-mail'?'Cole o e-mail':'O que foi conversado'}</label><textarea style="min-height:160px" placeholder="${t==='Anotação'?'Escreva com suas palavras o que ficou da conversa':'Cole o texto aqui'}"></textarea></div>`;
  const veu=document.getElementById('veu');
  veu.innerHTML=`<div class="modal">
    <h2 id="modal-tit">Registrar conversa</h2>
    <p>Guarde do jeito que for mais fácil. O resumo da IA fica separado do que você escreveu.</p>
    <div class="tipo-reg" role="group" aria-label="Tipo de registro">${['Anotação','Áudio','Transcrição','E-mail','PDF comentado'].map(x=>`<button data-tipo-reg="${x}" class="${x===t?'on':''}">${x}</button>`).join('')}</div>
    <div class="larg-total gap-0 aj"><div class="linha2">
      <div class="campo"><label>Título</label><input value="Reunião de orientação"></div>
      <div class="campo"><label>Data</label><input type="date" value="2026-11-13"></div>
    </div></div>
    ${corpo}
    <label class="check"><input type="checkbox" checked>Extrair combinados e atualizar os temas que voltam</label>
    <div class="pe"><button class="btn fant" data-acao="fechar">Cancelar</button><button class="btn prim" data-acao="confirmar" data-msg="Conversa registrada na orientação" data-ocupado="Registrando…">Registrar conversa</button></div>
  </div>`;
  veu.classList.add('on');
}
function fecharModal(){document.getElementById('veu').classList.remove('on')}

/* =========================================================
   Grifar ao selecionar (leitor)
   ========================================================= */
const pop=document.getElementById('pop');
pop.innerHTML = '<div class="linha-p">'+FUNCOES.map(f=>`<button class="cor-n" data-grifar="${f.id}"><i class="c-${f.id}"></i>${f.nome}</button>`).join('')+'</div>'
  + '<div class="linha-p"><button class="btn" data-acao="comentar">Comentar</button><button class="btn" data-acao="perguntar">Perguntar ao tutor</button></div>';
let rangeAtual=null;
document.addEventListener('mouseup',e=>{
  if(pop.contains(e.target)) return;
  const doc=document.getElementById('doc'); const sel=window.getSelection();
  if(!doc||!sel.rangeCount||sel.isCollapsed||!doc.contains(sel.anchorNode)){pop.classList.remove('on');return}
  rangeAtual=sel.getRangeAt(0).cloneRange();
  const r=rangeAtual.getBoundingClientRect();
  pop.classList.add('on');
  const w=pop.offsetWidth;
  pop.style.left=Math.max(8,Math.min(window.innerWidth-w-8,r.left+r.width/2-w/2+scrollX))+'px';
  pop.style.top=(r.top+scrollY-pop.offsetHeight-10)+'px';
});
function grifar(cor){
  if(!rangeAtual) return;
  const m=document.createElement('mark'); m.className=cor; m.dataset.id='n'+Date.now();
  try{rangeAtual.surroundContents(m)}catch(err){toast('Selecione um trecho dentro de um único parágrafo');return}
  window.getSelection().removeAllRanges(); pop.classList.remove('on');
  const grifos=[...document.querySelectorAll('#doc mark')].map(x=>({cor:x.className.split(' ')[0],id:x.dataset.id,t:x.textContent}));
  const lg=document.getElementById('lista-grifos'); if(lg) lg.innerHTML=listaGrifos(grifos);
  document.querySelectorAll('.funcoes b').forEach((b,i)=>b.textContent=grifos.filter(g=>g.cor===FUNCOES[i].id).length);
  toast('Grifado como '+FUNCOES.find(f=>f.id===cor).nome.toLowerCase());
}

/* =========================================================
   Eventos (delegação)
   ========================================================= */
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-sec],[data-log],[data-fb],[data-disc-aba],[data-aula-aba],[data-voltar-disc],[data-cartoes],[data-aba-esc],[data-ptexto],[data-passo-texto],[data-dlg],[data-mem-ok],[data-alt],[data-versao],[data-tipo-reg],[data-filtro-disc],[data-acao],[data-faceta],[data-limpa],[data-abrir],[data-modo],[data-tema],[data-aba],[data-passo],[data-arg],[data-nota],[data-grifar],[data-ir],[data-atalho],[data-filtro-proj]');
  if(!t){ if(e.target.id==='veu') fecharModal(); return }
  const d=t.dataset;
  if(d.cartoes!==undefined){S.cartao=0;S.virado=false;}
  if(d.sec){const el=document.getElementById(d.sec);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});return}
  if(d.log){S.logFiltro=d.log;const y=scrollY;render();scrollTo(0,y);return}
  if(d.fb){t.parentElement.innerHTML='<span class="t-legenda mute-2">Avaliação registrada</span>';return}
  if(d.abaEsc){S.abaEsc=d.abaEsc;render();return}
  if(d.discAba){S.discAba=d.discAba;S.manterAba=true;if(location.hash===t.getAttribute('href'))render();return}
  if(d.aulaAba){S.aulaAba=d.aulaAba;if(location.hash===t.getAttribute('href'))render();return}
  if(d.voltarDisc!==undefined){S.discAba='aulas';S.manterAba=true;location.hash='#disciplina/'+d.voltarDisc;return}
  if(d.ptexto!==undefined){S.passoTexto=Number(d.ptexto);if(location.hash===t.getAttribute('href'))render();return}
  if(d.cartoes!==undefined) return;
  if(d.passoTexto!==undefined){S.passoTexto=Number(d.passoTexto);fecharModal();render();window.scrollTo({top:0});return}
  if(d.dlg){S.dlg=d.dlg;render();return}
  if(d.memOk!==undefined){const it=t.closest('.sug-it');it.style.opacity='.4';it.querySelectorAll('button').forEach(b=>b.disabled=true);toast(d.descartar!==undefined?'Descartado':'Guardado na memória consolidada');return}
  if(d.alt){
    if(d.alt==='foco'){S.foco=!S.foco; S.verGrifos=false; S.verTutor=false; if(S.foco) toast('Modo foco. Tecle F ou Esc para sair.')}
    else {
      S[d.alt]=!S[d.alt];
      // No celular, grifos e tutor abrem como folhas por cima do texto: uma de cada vez.
      if(innerWidth<=1000 && S[d.alt] && (d.alt==='verGrifos'||d.alt==='verTutor')) S[d.alt==='verGrifos'?'verTutor':'verGrifos']=false;
    }
    render(); return}
  if(d.versao){S.versao=d.versao;render();return}
  if(d.tipoReg){abrirModalRegistro(d.tipoReg);return}
  if(d.filtroDisc){Object.keys(S.filtros).forEach(k=>S.filtros[k]=null);S.filtros.disc=d.filtroDisc;return}
  if(d.filtroProj){Object.keys(S.filtros).forEach(k=>S.filtros[k]=null);S.filtros.proj=d.filtroProj;if(location.hash==='#biblioteca')render();return}
  if(d.faceta){const v=d.faceta==='etapa'?Number(d.valor):d.valor;S.filtros[d.faceta]=S.filtros[d.faceta]===v?null:v;render();return}
  if(d.limpa){S.filtros[d.limpa]=null;render();return}
  if(d.abrir){location.hash='#leitor/'+d.abrir;return}
  if(d.modo){S.modoLeitura=d.modo;render();return}
  if(d.tema){S.tema=d.tema;if(S.modoLeitura==='pdf')S.modoLeitura='limpa';render();return}
  if(d.aba){S.abaTutor=d.aba;render();return}
  if(d.passo!==undefined){S.passoFich=Number(d.passo);render();window.scrollTo({top:0});return}
  if(d.arg){S.argSel=d.arg;if(location.hash.startsWith('#argumentos'))render();return}
  if(d.nota!==undefined){S.cartao++;S.virado=false;render();return}
  if(d.grifar){grifar(d.grifar);return}
  if(d.ir){const m=document.querySelector(`#doc mark[data-id="${d.ir}"]`);if(m){m.scrollIntoView({behavior:'smooth',block:'center'});m.classList.remove('pulso');void m.offsetWidth;m.classList.add('pulso')}return}
  if(d.atalho){const q=document.getElementById('pergunta');q.value=d.atalho;q.focus();return}
  switch(d.acao){
    case 'adicionar': abrirModal(); break;
    case 'busca': abrirBusca(); break;
    case 'enviar-aula': abrirModalAula(Number(d.disc)||0); break;
    case 'novo-evento': abrirModalEvento(Number(d.disc)||0); break;
    case 'briefing': abrirBriefing(); break;
    case 'limpar-filtros': Object.keys(S.filtros).forEach(k=>S.filtros[k]=null); S.busca=''; render(); break;
    case 'esquecer': { const it=t.closest('.mem-it'); it.style.display='none'; toast('Item esquecido. A IA não usa mais.',()=>{it.style.display=''}); break; }
    case 'fechar': fecharModal(); break;
    case 'buscar-doi': document.getElementById('meta-enc').classList.add('on'); break;
    case 'confirmar-add': fecharModal(); toast('Leitura adicionada à biblioteca'); break;
    case 'confirmar': fecharModal(); toast(d.msg); break;
    case 'nova-disciplina': abrirModalDisciplina(); break;
    case 'registrar': abrirModalRegistro(d.tipo); break;
    case 'virar': S.virado=true; render(); break;
    case 'toast': toast(d.msg); break;
    case 'comentar': pop.classList.remove('on'); grifar('conceito'); toast('Na versão funcional, abre um campo de nota ao lado do grifo'); break;
    case 'perguntar': {
      const txt=rangeAtual?rangeAtual.toString():''; pop.classList.remove('on');
      S.abaTutor='tutor'; S.verTutor=true; S.conversa.push({de:'eu',trecho:txt,t:'O que você me pergunta sobre este trecho?'});
      S.conversa.push({de:'tutor',t:['(Resposta fixa do protótipo.) Antes de eu explicar: com suas palavras, o que o autor afirma aqui, e você concorda? Na versão funcional, o Gemini responde considerando o texto inteiro e suas outras leituras.']});
      render(); const c=document.getElementById('conversa'); c.scrollTop=c.scrollHeight; break;
    }
  }
});
document.addEventListener('keydown',e=>{
  const digitando=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
  if((e.ctrlKey||e.metaKey)&&(e.key==='k'||e.key==='K')){e.preventDefault();abrirBusca();return}
  if(e.target.id==='qk'&&e.key==='Enter'){const a=document.querySelector('#res-busca a');if(a){if(a.dataset.arg)S.argSel=a.dataset.arg;if(a.dataset.dlgBusca)S.dlgReal=a.dataset.dlgBusca;location.hash=a.getAttribute('href');fecharModal()}return}
  if(e.key==='Escape'){fecharModal();pop.classList.remove('on');if(S.foco&&location.hash.startsWith('#leitor')){S.foco=false;S.verGrifos=false;S.verTutor=true;render()}}
  if((e.key==='f'||e.key==='F')&&!digitando&&!e.metaKey&&!e.ctrlKey&&location.hash.startsWith('#leitor')){S.foco=!S.foco;S.verGrifos=false;S.verTutor=!S.foco;render();if(S.foco)toast('Modo foco. Tecle F ou Esc para sair.')}
  if(e.key==='Enter'&&e.target.dataset&&e.target.dataset.abrir) location.hash='#leitor/'+e.target.dataset.abrir;
});
document.addEventListener('change',e=>{if(e.target.matches('[data-marcas]')){S.marcas=e.target.checked;document.querySelector('.folha').classList.toggle('marcas',S.marcas)}});
document.addEventListener('change',e=>{if(e.target.matches('[data-comb]')){const li=e.target.closest('li');li.classList.toggle('ok',e.target.checked);if(e.target.checked)toast('Combinado cumprido')}});
document.addEventListener('input',e=>{if(e.target.id==='qk'){document.getElementById('res-busca').innerHTML=resultadosBusca(e.target.value)}});
document.addEventListener('input',e=>{if(e.target.id==='teto'){document.getElementById('teto-v').textContent=e.target.value+'%'}});
document.addEventListener('input',e=>{
  if(e.target.id==='busca'){S.busca=e.target.value;const pos=e.target.selectionStart;render();const b=document.getElementById('busca');b.focus();b.setSelectionRange(pos,pos)}
});
document.addEventListener('submit',e=>{
  if(e.target.id!=='form-tutor') return;
  e.preventDefault(); const q=document.getElementById('pergunta').value.trim(); if(!q) return;
  S.conversa.push({de:'eu',t:q});
  S.conversa.push({de:'tutor',t:['(Resposta fixa do protótipo.) Boa pergunta para levar à banca. Que evidência deste texto você usaria para responder a ela sozinho? Tente primeiro; depois eu aponto o que ficou de fora.']});
  render(); const c=document.getElementById('conversa'); c.scrollTop=c.scrollHeight;
});

/* Situação do Drive (rodapé do menu): atualizada pela sincronização */
function statusDriveHTML(){
  const rb=window.rb; const conta=(()=>{try{return localStorage.getItem('rb.conta')}catch(e){return null}})();
  const linha=(cls,txt)=>`<div class="salvo ${cls}"><i></i>${txt}</div>`;
  if(!conta) return linha('pendente','Dados de exemplo, sem Drive');
  if(!rb) return linha('pendente','Abrindo…');
  const e=rb.sincronia?rb.sincronia.estado():{fase:rb.google.conectado()?'parado':'desconectado'};
  const conf=e.conflitos?`, <a href="#conflitos">${e.conflitos} ${e.conflitos===1?'conflito para revisar':'conflitos para revisar'}</a>`:'';
  const n=e.pendentes||0, esp=n?` ${n} ${n===1?'mudança espera':'mudanças esperam'} o Drive.`:'';
  if(e.fase==='ok'&&e.pendente) return linha('pendente','Gravado neste aparelho. Enviando ao Drive…');
  if(e.fase==='ok') return linha('ok',`<span>Sincronizado às ${new Date(e.ultima).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}${conf}</span>`);
  if(e.fase==='sincronizando'||e.fase==='parado') return linha('pendente',e.pendente?'Gravado neste aparelho. Enviando ao Drive…':'Sincronizando com o Drive…');
  if(e.fase==='offline') return linha('aviso',`Sem internet: salvo neste aparelho.${n?` ${n} ${n===1?'mudança sobe':'mudanças sobem'} quando a conexão voltar.`:''}`);
  if(e.fase==='desconectado') return linha('aviso',`Salvo neste aparelho.${esp} <button data-google="entrar">Reconectar ao Google</button>`);
  return linha('erro',`Não deu para sincronizar.${esp} <a href="#ajustes/pasta">Ver detalhes</a>`);
}
window.statusDriveHTML=statusDriveHTML;
// Celular: o menu lateral (com o status) some; um aviso acima da barra inferior aparece quando a sincronização precisa de você.
function statusMovelHTML(){
  const rb=window.rb; if(!rb||!rb.sincronia) return '';
  const e=rb.sincronia.estado();
  const aviso=(cls,txt)=>`<div class="status-movel-caixa ${cls}">${txt}</div>`;
  if(e.fase==='offline') return aviso('aviso','Sem internet. O que você fizer fica neste aparelho e vai para o Drive quando a internet voltar.');
  if(e.fase==='desconectado') return aviso('aviso','A sessão do Google venceu. Suas mudanças estão guardadas neste aparelho. <button class="btn mini" data-google="entrar">Reconectar</button>');
  if(e.fase==='erro') return aviso('erro','Não deu para sincronizar com o Drive. <button class="btn mini" data-google="sincronizar">Tentar de novo</button>');
  if(e.conflitos) return aviso('info',`<a href="#conflitos">${e.conflitos===1?'1 conflito para revisar':`${e.conflitos} conflitos para revisar`}</a>`);
  return '';
}
window.statusMovelHTML=statusMovelHTML;

V.entrar = () => {
  const rb=window.rb; const erro=rb&&rb.google.erro;
  if(acesso()==='conectando') return `<div class="entrar"><div class="entrar-caixa"><a class="wordmark"><span>researchbook</span></a><h1>Conectando ao Google…</h1><p>Conferindo o login e a permissão do Drive.</p></div></div>`;
  return `<div class="entrar"><div class="entrar-caixa">
    <a class="wordmark"><span>researchbook</span></a>
    <h1>Entre para continuar</h1>
    <p>Estudo e escrita do mestrado. Só a conta autorizada entra, e os dados ficam numa pasta <b>researchbook</b> no Google Drive dela.</p>
    ${erro?`<div class="entrar-erro" role="alert">${erro}</div>`:''}
    <button class="btn prim" data-google="entrar">Entrar com Google</button>
    <p class="entrar-nota">O app pede só duas permissões: saber o seu e-mail e usar os arquivos que ele mesmo criar no seu Drive. Ele não enxerga o resto do Drive.</p>
  </div></div>`;
};

/* Ajustes > Pasta: conta Google e sincronização */
function contaHTML(){
  const rb=window.rb; let conta=null; try{conta=localStorage.getItem('rb.conta')}catch(e){}
  if(!conta) return `<div class="mb-4 aj-linha"><span class="t-meta mute">Nenhuma conta conectada neste aparelho.</span><button class="btn prim" data-google="entrar">Entrar com Google</button></div>`;
  const e=rb&&rb.sincronia?rb.sincronia.estado():null;
  const id=rb&&rb.sincronia?rb.sincronia.idPasta():null;
  const esc=x=>String(x??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  return `<div class="mb-3 ap-grade">
      <div class="ap-it"><span>Conta</span><b>${esc(conta)}</b><small>${rb&&rb.google.conectado()?'conectada':'sessão vencida: entre de novo para sincronizar'}</small></div>
      <div class="ap-it"><span>Sincronização</span><div>${statusDriveHTML()}</div>${e&&e.erro?`<small>${esc(e.erro)}</small>`:''}</div>
    </div>
    <div class="flex gap-2 wrap mb-4">
      <button class="btn" data-google="sincronizar">Sincronizar agora</button>
      <a class="btn fant" href="#conflitos">Revisar conflitos${e&&e.conflitos?` (${e.conflitos})`:''}</a>
      ${id?`<a class="btn fant" href="https://drive.google.com/drive/folders/${encodeURIComponent(id)}" target="_blank" rel="noopener">Abrir a pasta no Drive</a>`:''}
      <button class="btn fant" data-google="sair">Sair da conta</button>
    </div>`;
}

/* Downloads: registros (CSV) e cópia dos dados (JSON) */
function baixar(nome,conteudo,tipo){const url=URL.createObjectURL(new Blob([conteudo],{type:tipo}));const a=document.createElement('a');a.href=url;a.download=nome;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-baixar]'); if(!b||!window.rb) return;
  const dia=new Date().toISOString().slice(0,10);
  if(b.dataset.baixar==='registros'){baixar(`researchbook-registros-${dia}.csv`,window.rb.registros.csv(),'text/csv;charset=utf-8');toast('Registros exportados')}
  if(b.dataset.baixar==='bibtex'){const ls=window.rb.biblioteca?window.rb.biblioteca.leituras():[];if(!ls.length){toast('A biblioteca está vazia: não há referências para exportar.');return}baixar(`researchbook-referencias-${dia}.bib`,window.rb.paraBibTeX(ls),'application/x-bibtex;charset=utf-8');toast(`${ls.length} ${ls.length===1?'referência exportada':'referências exportadas'}`)}
  if(b.dataset.baixar==='dados'){const d=await window.rb.dados.exportar();baixar(`researchbook-dados-${dia}.json`,JSON.stringify(d,null,2),'application/json');toast('Cópia dos dados baixada')}
});

/* =========================================================
   Roteador
   ========================================================= */
function telaAbrindo(ab){
  const pct=Math.round(ab.feitas/ab.total*100);
  return `<div class="abrindo" id="abrindo" role="status" aria-live="polite"><h2>Abrindo os seus dados</h2>
  <div class="barra" role="img" aria-label="${pct}% baixado"><i style="width:${pct}%"></i></div>
  <ol class="abrindo-passos"><li class="ok">Conta confirmada</li><li class="ok">Pasta researchbook encontrada no seu Drive</li><li class="agora">Baixando os seus dados: ${ab.feitas} de ${ab.total} partes</li><li>Os PDFs descem depois, quando você abrir cada obra</li></ol>
  <p class="meta">Se a internet cair agora, o app abre com o que já está neste aparelho e termina depois.</p></div>`;
}
function render(){
  const bloqueado=acesso()!=='livre';
  document.body.classList.toggle('bloqueado',bloqueado);
  if(bloqueado){document.getElementById('vista').innerHTML=V.entrar();return}
  const rota=(location.hash||'#painel').slice(1);
  const [v,arg,arg2]=rota.split('/');
  document.body.classList.toggle('leitor', v==='leitor');
  document.body.classList.toggle('editor', v==='texto');
  document.body.classList.toggle('foco', v==='leitor' && S.foco);
  desenhaMenu(rota);
  if(v==='revisao') V.revisao=V.cartoes;
  const fn=V[v]||V.painel;
  let html=fn(arg,arg2);
  // Primeira abertura neste aparelho: enquanto os dados descem do Drive, nenhuma tela aparece como vazia.
  const ab=modoReal()&&window.rb&&window.rb.sincronia&&window.rb.sincronia.estado().abrindo;
  if(ab&&v!=='ajustes') html=telaAbrindo(ab);
  if(SECOES[SECAO_DE[v]] && SECOES[SECAO_DE[v]].tabs.some(([r])=>r===v)) html=secaoCab(v)+html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/,'');
  document.getElementById('vista').innerHTML=html;
  pop.classList.remove('on');
  document.dispatchEvent(new CustomEvent('rb:render',{detail:{rota}}));
}
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#disciplina/')&&!S.manterAba)S.discAba='geral';S.manterAba=false;if(location.hash.startsWith('#aula/'))S.aulaAba=S.aulaAba||'transcricao';fecharModal();document.getElementById('toast').classList.remove('on');render();window.scrollTo({top:0});document.getElementById('vista').focus({preventScroll:true})});
render();

// Resultado da busca que abre um diálogo: escolhe o diálogo antes de abrir a tela.
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('[data-dlg-busca]');
  if (a) S.dlgReal = a.dataset.dlgBusca;
}, true);

// Formulários de exemplo (modo de demonstração): só mostram um aviso.
document.addEventListener('submit', (e) => {
  const m = e.target.dataset && e.target.dataset.demoToast;
  if (m) {
    e.preventDefault();
    toast(m);
  }
});
