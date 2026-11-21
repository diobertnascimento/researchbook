// Busca (Ctrl+K) com os dados reais: páginas, obras, grifos, fichamentos, textos, argumentos, trilhas,
// disciplinas, aulas, diálogos, cartões e itens da memória. Tudo no aparelho, sem internet.
import { citacao } from './abnt.js';

const PAGINAS = [
  ['Hoje', '#painel'],
  ['Leituras', '#biblioteca'],
  ['Biblioteca', '#acervo'],
  ['Trilhas', '#trilhas'],
  ['Fichamentos', '#fichamentos'],
  ['Textos', '#escrita'],
  ['Diálogos', '#dialogos'],
  ['Projeto de pesquisa', '#projeto'],
  ['Orientação', '#orientacao'],
  ['Argumentos', '#argumentos'],
  ['Cartões', '#cartoes'],
  ['Projetos', '#disciplinas'],
  ['Retrato da escrita', '#autor'],
  ['Memória', '#memoria'],
  ['Ajustes', '#ajustes'],
  ['Registros', '#registros'],
  ['Conflitos de sincronização', '#conflitos'],
];
const enc = encodeURIComponent;
const curto = (s, n = 90) => (String(s || '').length > n ? `${String(s).slice(0, n)}…` : String(s || ''));

export function criarBusca({ rb }) {
  function itens() {
    const bib = rb.biblioteca;
    const its = PAGINAS.map(([n, h]) => ({ n, h, t: 'Página' }));
    for (const l of bib.leituras()) its.push({ n: l.titulo, h: `#leitor/${enc(l.id)}`, t: `${citacao(l)}${l.projeto ? `. ${l.projeto}` : ''}`, extra: (l.autores || []).map((a) => a.sobrenome).join(' ') + ' ' + (l.tags || []).join(' ') });
    for (const f of rb.fichUI?.todos() || []) {
      const l = bib.obter(f.leituraId || f.id);
      if (l) its.push({ n: `Fichamento: ${l.titulo}`, h: `#fichamento/${enc(l.id)}`, t: 'Fichamento', extra: `${f.resumo || ''}` });
    }
    for (const t of rb.escrita?.todos() || []) its.push({ n: t.titulo, h: `#texto/${enc(t.id)}`, t: `Texto${t.projeto ? `. ${t.projeto}` : ''}`, extra: t.tese || '' });
    for (const a of rb.argUI?.todos() || []) its.push({ n: a.tese, h: `#argumentos/${enc(a.id)}`, t: 'Argumento' });
    for (const t of rb.trilhasUI?.todas() || []) its.push({ n: t.nome, h: '#trilhas', t: 'Trilha' });
    for (const d of rb.disciplinas?.todas() || []) {
      its.push({ n: d.nome, h: `#disciplina/${enc(d.id)}`, t: `Projeto${d.arquivada ? ', encerrado' : ''}`, extra: d.docente || '' });
      for (const a of rb.disciplinas.aulasDe(d.id)) its.push({ n: `Aula ${a.numero}${a.tema ? `: ${a.tema}` : ''}`, h: `#aula/${enc(d.id)}/${enc(a.id)}`, t: d.nome, extra: (a.resumo?.conceitos || []).map((c) => c.nome).join(' ') });
    }
    for (const x of rb.dialogos?.todos() || []) its.push({ n: x.tema, h: '#dialogos', t: `Diálogo, ${x.modo}`, dlg: x.id });
    for (const e of rb.dissertacao?.encontros() || []) its.push({ n: `${e.titulo}, ${e.data.split('-').reverse().join('/')}`, h: '#orientacao', t: 'Orientação', extra: e.registro?.resumo || '' });
    for (const c of rb.cartoes?.todos() || []) its.push({ n: curto(c.pergunta), h: '#cartoes', t: 'Cartão' });
    for (const m of rb.memoriaUI?.aprovados?.() || []) its.push({ n: curto(m.texto), h: '#memoria', t: 'Memória' });
    for (const g of bib.todosGrifos()) {
      const l = bib.obter(g.leituraId);
      if (l) its.push({ n: curto(g.texto), h: `#leitor/${enc(l.id)}`, t: `Grifo, ${citacao(l, g.pagina)}`, grifo: true });
    }
    return its;
  }
  return { itens };
}
