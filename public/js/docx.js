// Exportação para Word (.docx), feita no navegador, sem biblioteca externa.
// Um .docx é um arquivo zip com XML dentro; aqui o zip é montado sem compressão (o Word abre normalmente).
//
// Formatação ABNT (NBR 14724): papel A4, margens de 3 cm (superior e esquerda) e 2 cm (inferior e direita),
// fonte Times New Roman 12, espaçamento 1,5, recuo de primeira linha de 1,25 cm e texto justificado.
// Citação longa: recuo de 4 cm, fonte 10, espaçamento simples. Seção primária numerada, em negrito e caixa alta.
// Referências (NBR 6023): alinhadas à esquerda, espaçamento simples, uma linha em branco entre elas.
// Os marcadores de autoria nunca vão para o arquivo.

/* ---------- Zip (método "store") ---------- */
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** arquivos: [{ nome, conteudo (string) }] → Blob zip. */
export function zip(arquivos) {
  const enc = new TextEncoder();
  const partes = [];
  const central = [];
  let pos = 0;
  const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
  for (const a of arquivos) {
    const nome = enc.encode(a.nome);
    const dados = enc.encode(a.conteudo);
    const crc = crc32(dados);
    // bit 11: nomes em UTF-8; método 0: sem compressão; data fixa (1/1/2026) para o arquivo sair igual sempre.
    const cab = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x5c21), ...u32(crc), ...u32(dados.length), ...u32(dados.length), ...u16(nome.length), ...u16(0)]);
    partes.push(cab, nome, dados);
    central.push(new Uint8Array([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x5c21), ...u32(crc), ...u32(dados.length), ...u32(dados.length), ...u16(nome.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(pos)]), nome);
    pos += cab.length + nome.length + dados.length;
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fim = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(arquivos.length), ...u16(arquivos.length), ...u32(tamCentral), ...u32(pos), ...u16(0)]);
  return new Blob([...partes, ...central, fim], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

/* ---------- Texto → WordprocessingML ---------- */
const xml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const CM = (cm) => Math.round(cm * 567); // twips

/** Trechos com formatação de um elemento HTML: [{ texto, b, i, u }]. */
function trechos(no, estilo = {}) {
  const saida = [];
  for (const f of no.childNodes) {
    if (f.nodeType === 3) {
      if (f.textContent) saida.push({ texto: f.textContent.replace(/\s+/g, ' '), ...estilo });
    } else if (f.nodeType === 1) {
      const t = f.tagName;
      if (t === 'BR') saida.push({ quebra: true });
      else saida.push(...trechos(f, { ...estilo, b: estilo.b || t === 'B' || t === 'STRONG', i: estilo.i || t === 'I' || t === 'EM', u: estilo.u || t === 'U' }));
    }
  }
  return saida;
}
function runs(lista, { tamanho } = {}) {
  return lista
    .map((r) => {
      if (r.quebra) return '<w:r><w:br/></w:r>';
      const pr = `${r.b ? '<w:b/>' : ''}${r.i ? '<w:i/>' : ''}${r.u ? '<w:u w:val="single"/>' : ''}${tamanho ? `<w:sz w:val="${tamanho}"/><w:szCs w:val="${tamanho}"/>` : ''}`;
      return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${xml(r.texto)}</w:t></w:r>`;
    })
    .join('');
}
const par = (conteudo, pPr = '') => `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${conteudo}</w:p>`;
const P_CORPO = `<w:spacing w:line="360" w:lineRule="auto" w:after="0"/><w:ind w:firstLine="${CM(1.25)}"/><w:jc w:val="both"/>`;
const P_CITACAO = `<w:spacing w:line="240" w:lineRule="auto" w:before="240" w:after="240"/><w:ind w:left="${CM(4)}"/><w:jc w:val="both"/>`;
const P_LISTA = `<w:spacing w:line="360" w:lineRule="auto" w:after="0"/><w:ind w:left="${CM(1.25)}" w:hanging="${CM(0.5)}"/><w:jc w:val="both"/>`;

/** Converte o HTML de uma seção em parágrafos do Word. */
function secaoParaXml(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const saida = [];
  for (const el of doc.body.firstChild.children) {
    const t = el.tagName;
    if (t === 'P') {
      if (el.textContent.trim()) saida.push(par(runs(trechos(el)), P_CORPO));
    } else if (t === 'H3') {
      saida.push(par(runs(trechos(el, { b: true })), `<w:keepNext/><w:spacing w:before="240" w:after="120" w:line="360" w:lineRule="auto"/>`));
    } else if (t === 'BLOCKQUOTE') {
      const filhos = el.querySelectorAll('p');
      const conteudo = filhos.length ? [...filhos] : [el];
      for (const c of conteudo) saida.push(par(runs(trechos(c), { tamanho: 20 }), P_CITACAO));
    } else if (t === 'UL' || t === 'OL') {
      [...el.querySelectorAll(':scope > li')].forEach((li, i) => saida.push(par(runs([{ texto: t === 'OL' ? `${i + 1}. ` : '– ' }, ...trechos(li)]), P_LISTA)));
    }
  }
  return saida.join('');
}

/** Referência ABNT em HTML (com <b> no destaque) → parágrafo do Word. */
function referenciaParaXml(refHtml) {
  const doc = new DOMParser().parseFromString(`<div>${refHtml}</div>`, 'text/html');
  return par(runs(trechos(doc.body.firstChild)), `<w:spacing w:line="240" w:lineRule="auto" w:after="240"/><w:jc w:val="left"/>`);
}

/**
 * texto: { titulo, secoes: [{ titulo, html }] }. referencias: lista de HTML de referência ABNT (NBR 6023).
 * Devolve um Blob .docx.
 */
export function gerarDocx(texto, referencias = []) {
  const corpo = [
    par(runs([{ texto: texto.titulo.toUpperCase(), b: true }]), `<w:spacing w:after="480" w:line="360" w:lineRule="auto"/><w:jc w:val="center"/>`),
    ...(texto.secoes || []).map((s, i) => par(runs([{ texto: `${i + 1} ${s.titulo.toUpperCase()}`, b: true }]), `<w:keepNext/><w:spacing w:before="360" w:after="240" w:line="360" w:lineRule="auto"/>`) + secaoParaXml(s.html)),
    ...(referencias.length ? [par(runs([{ texto: 'REFERÊNCIAS', b: true }]), `<w:pageBreakBefore/><w:spacing w:after="480"/><w:jc w:val="center"/>`), ...referencias.map(referenciaParaXml)] : []),
  ].join('');
  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${corpo}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${CM(3)}" w:right="${CM(2)}" w:bottom="${CM(2)}" w:left="${CM(3)}" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
  return zip([
    { nome: '[Content_Types].xml', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { nome: '_rels/.rels', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { nome: 'word/_rels/document.xml.rels', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nome: 'word/document.xml', conteudo: documento },
    { nome: 'word/styles.xml', conteudo: estilos },
    { nome: 'docProps/core.xml', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(texto.titulo)}</dc:title><dc:language>pt-BR</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>` },
  ]);
}
