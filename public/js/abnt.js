// Referências (ABNT NBR 6023:2018) e citações no texto (ABNT NBR 10520:2023).
// Só usa os dados da ficha da obra. O que falta aparece como a ABNT manda ([S. l.], [s. n.], [s. d.])
// ou como [a completar], para o Diobert ver e corrigir. Nunca inventa dado.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const falta = '[a completar]';

/** "Ana Maria" -> "A. M."; "J.-P." fica como está. */
export function iniciais(prenomes) {
  return String(prenomes || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => (/^[A-ZÀ-Ý]\.$/i.test(p) || /\.$/.test(p) ? p : p.split('-').map((x) => x[0].toUpperCase() + '.').join('-')))
    .join(' ');
}

/** Autores na lista de referências: SOBRENOME, P.; até três; quatro ou mais: o primeiro + et al. */
export function autoresReferencia(autores = []) {
  const um = (a) => `${String(a.sobrenome || '').toUpperCase()}${a.prenomes ? ', ' + iniciais(a.prenomes) : ''}`;
  if (!autores.length) return '';
  if (autores.length > 3) return `${um(autores[0])} et al.`;
  return autores.map(um).join('; ');
}

const terminaComPonto = (s) => /[.?!]$/.test(s);
const comPonto = (s) => (s ? (terminaComPonto(s) ? s : s + '.') : '');
const titulo = (l) => (l.subtitulo ? `${l.titulo}: ${l.subtitulo}` : l.titulo || falta);
const ano = (l) => l.ano || '[s. d.]';
const local = (l) => l.local || '[S. l.]';
const editora = (l) => l.editora || '[s. n.]';
const paginas = (l) => (l.paginas ? `p. ${String(l.paginas).replace(/\s*[-–]\s*/, '-')}` : '');

/** Referência completa em HTML (o destaque é negrito). */
export function referencia(l) {
  const autores = autoresReferencia(l.autores);
  const ab = autores ? comPonto(autores) + ' ' : '';
  const doi = l.doi ? ` DOI: ${esc(l.doi)}.` : '';
  const url = !l.doi && l.url ? ` Disponível em: ${esc(l.url)}.` : '';
  switch (l.tipo) {
    case 'livro':
      return `${esc(ab)}<b>${esc(comPonto(titulo(l)).replace(/\.$/, ''))}</b>. ${l.edicao ? esc(l.edicao) + ' ed. ' : ''}${esc(local(l))}: ${esc(editora(l))}, ${esc(ano(l))}.${doi}${url}`;
    case 'capitulo': {
      const org = l.organizadores?.length ? `${autoresReferencia(l.organizadores)} (org.). ` : '';
      const p = paginas(l);
      return `${esc(ab)}${esc(comPonto(titulo(l)))} In: ${esc(org)}<b>${esc(l.veiculo || falta)}</b>. ${esc(local(l))}: ${esc(editora(l))}, ${esc(ano(l))}.${p ? ' ' + esc(p) + '.' : ''}${doi}${url}`;
    }
    case 'dissertacao':
    case 'tese': {
      const grau = l.tipo === 'tese' ? 'Tese (Doutorado' : 'Dissertação (Mestrado';
      return `${esc(ab)}<b>${esc(titulo(l))}</b>. ${esc(ano(l))}. ${grau}${l.programa ? ' em ' + esc(l.programa) : ''}) – ${esc(l.editora || falta)}, ${esc(local(l))}, ${esc(ano(l))}.${doi}${url}`;
    }
    case 'anais': {
      const p = paginas(l);
      return `${esc(ab)}${esc(comPonto(titulo(l)))} In: ${esc(l.veiculo || falta)}. <b>Anais</b> [...]. ${esc(local(l))}: ${esc(editora(l))}, ${esc(ano(l))}.${p ? ' ' + esc(p) + '.' : ''}${doi}${url}`;
    }
    case 'artigo':
    default: {
      const partes = [esc(local(l) === '[S. l.]' ? '' : l.local), l.volume ? `v. ${esc(l.volume)}` : '', l.numero ? `n. ${esc(l.numero)}` : '', esc(paginas(l)), esc(ano(l))].filter(Boolean);
      return `${esc(ab)}${esc(comPonto(titulo(l)))} <b>${esc(l.veiculo || falta)}</b>, ${partes.join(', ')}.${doi}${url}`;
    }
  }
}

/** Referência em texto puro (para copiar ou exportar). */
export const referenciaTexto = (l) => referencia(l).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

/** Citação no texto, NBR 10520:2023: só a inicial maiúscula. (Silva; Souza, 2019, p. 12) ou (Silva et al., 2019). */
export function citacao(l, pagina) {
  const a = l.autores || [];
  const nome = (x) => String(x.sobrenome || '').toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, s, c) => s + c.toUpperCase());
  const quem = !a.length ? (l.titulo || falta).split(' ')[0].toUpperCase() + ' ...' : a.length > 3 ? `${nome(a[0])} et al.` : a.map(nome).join('; ');
  return `(${quem}, ${ano(l)}${pagina ? ', p. ' + pagina : ''})`;
}

/** Autores curtos para listas: "Goldkuhl (2012)", "Venable et al. (2016)". */
export function autorCurto(l) {
  const a = l.autores || [];
  const nome = (x) => String(x.sobrenome || '').replace(/(^|[\s-])(\p{L})/gu, (m, s, c) => s + c.toUpperCase());
  const quem = !a.length ? 'Sem autor' : a.length === 1 ? nome(a[0]) : a.length === 2 ? `${nome(a[0])} e ${nome(a[1])}` : `${nome(a[0])} et al.`;
  return `${quem} (${l.ano || 's. d.'})`;
}
