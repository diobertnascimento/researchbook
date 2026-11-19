// "Pedir" no editor (v2.10.0): o que o autor pode pedir sobre o parágrafo em que está, sem a IA.
// Duas funções puras: procurar nos grifos e nas notas dele o que tem palavras em comum com o parágrafo, e
// conferir as citações do parágrafo contra a biblioteca e os grifos. Nada aqui chama o Gemini, e o resultado é
// sempre material que ele mesmo marcou ou escreveu, com a referência.
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Palavras que aparecem em qualquer parágrafo e não ajudam a achar nada.
const VAZIAS = new Set(
  'para pela pelo pelas pelos como mais menos mas que quando onde porque isso esse essa este esta isto aquele aquela entre sobre desde ate apos tambem ainda muito muita muitos muitas pouco cada todo toda todos todas outro outra outros outras seus suas seu sua dele dela deles delas nosso nossa quem qual quais foi foram ser sera sao era eram tem tinha tinham ter haver havia pode podem deve devem assim entao porem contudo portanto alem tanto quanto sendo sido estao estava estavam esta nao sim uma umas uns com sem por dos das nos nas aos num numa esses essas estes estas the and for with that this from'.split(' '),
);
/** Palavras que identificam um texto: sem acento, com 4 letras ou mais, fora as vazias. Devolve o radical (6 letras). */
export function radicais(texto) {
  const ps = semAcento(texto).match(/[a-z]{4,}/g) || [];
  return [...new Set(ps.filter((p) => !VAZIAS.has(p)).map((p) => p.slice(0, 6)))];
}

/**
 * Procura, entre os grifos e as notas, os que mais têm palavras em comum com o parágrafo.
 * `itens`: [{ texto, ... }]. Devolve até `maximo` itens, com `comuns` (quantas palavras do parágrafo aparecem).
 * É busca por palavras, não por significado: sinônimo não é encontrado.
 */
export function buscarNoAcervo(paragrafo, itens, { maximo = 5 } = {}) {
  const alvo = radicais(paragrafo);
  if (!alvo.length) return [];
  const minimo = alvo.length >= 4 ? 2 : 1;
  const mesmo = semAcento(paragrafo).replace(/\s+/g, ' ').trim();
  return itens
    .map((it) => {
      const dele = new Set(radicais(it.texto));
      return { ...it, comuns: alvo.filter((r) => dele.has(r)).length };
    })
    // O próprio parágrafo, se já estiver guardado como nota, não é resultado.
    .filter((it) => it.comuns >= minimo && semAcento(it.texto).replace(/\s+/g, ' ').trim() !== mesmo)
    .sort((a, b) => b.comuns - a.comuns || a.texto.length - b.texto.length)
    .slice(0, maximo);
}

/**
 * Confere as citações de um parágrafo. Devolve uma lista de { tipo, texto, detalhe }:
 *  - 'ok': citação de obra que está na biblioteca;
 *  - 'fora': autor e ano que não batem com nenhuma obra da biblioteca;
 *  - 'sem-pagina': citação direta (entre aspas) sem página no parágrafo;
 *  - 'sem-grifo': citação direta que não está entre os grifos (pode ter sido digitada errada).
 * `leituras`: fichas da biblioteca; `grifos`: [{ texto }]; `curto(l)`: como a obra aparece no texto.
 */
export function conferirCitacoes(paragrafo, leituras, grifos, curto = (l) => l.titulo) {
  const achados = [];
  const visto = new Set();
  const procurar = (autores, ano) => {
    const primeiro = semAcento(autores).split(/[;,&]| e | et al/)[0].trim().split(' ').pop();
    if (!primeiro || primeiro.length < 2) return;
    const chave = `${primeiro}:${ano}`;
    if (visto.has(chave)) return;
    visto.add(chave);
    const l = leituras.find((x) => semAcento(x.autores?.[0]?.sobrenome) === primeiro && String(x.ano) === ano.replace(/[a-z]$/, ''));
    achados.push(l ? { tipo: 'ok', texto: `${autores.trim()} (${ano})`, detalhe: `Na biblioteca: ${curto(l)}.`, leituraId: l.id } : { tipo: 'fora', texto: `${autores.trim()} (${ano})`, detalhe: 'Não encontrei esta obra na sua biblioteca. Só se cita o que está no acervo: adicione a obra ou confira o nome e o ano.' });
  };
  // (Sobrenome, 2020) e (Sobrenome; Outro, 2020, p. 3), inclusive várias no mesmo parêntese.
  // O ponto e vírgula separa tanto os autores de uma obra quanto uma obra da outra: os pedaços sem ano
  // são autores da obra que vem a seguir.
  for (const m of paragrafo.matchAll(/\(([^()]*?\d{4}[a-z]?[^()]*?)\)/g)) {
    let autores = [];
    for (const parte of m[1].split(';')) {
      const c = parte.match(/^\s*(?:cf\.\s*|apud\s*)?([^\d]+?),\s*(\d{4}[a-z]?)/i);
      if (!c) {
        if (/\d/.test(parte)) autores = [];
        else autores.push(parte.trim());
        continue;
      }
      procurar([...autores, c[1].trim()].join('; '), c[2]);
      autores = [];
    }
  }
  // Sobrenome (2020) e Sobrenome e Outro (2020).
  for (const m of paragrafo.matchAll(/([A-ZÀ-Ý][\wÀ-ÿ'-]+(?:\s+(?:e|et al\.?)\s*(?:[A-ZÀ-Ý][\wÀ-ÿ'-]+)?)?)\s*\((\d{4}[a-z]?)/g)) procurar(m[1], m[2]);

  // A página vale se estiver no parêntese logo depois da citação direta ou no que vem logo antes dela.
  const temPagina = (inicio, fim) => /\bp\.\s*\d/.test(paragrafo.slice(fim, fim + 120).match(/^[^()]{0,20}\(([^()]*)\)/)?.[1] || '') || /\([^()]*\bp\.\s*\d[^()]*\)[^()]{0,60}$/.test(paragrafo.slice(Math.max(0, inicio - 120), inicio));
  const dosGrifos = grifos.map((g) => semAcento(g.texto).replace(/\s+/g, ' '));
  for (const m of paragrafo.matchAll(/["“]([^"”]{20,}?)["”]/g)) {
    const trecho = m[1].trim();
    const curtoTrecho = trecho.length > 80 ? `${trecho.slice(0, 80)}…` : trecho;
    if (!temPagina(m.index, m.index + m[0].length)) achados.push({ tipo: 'sem-pagina', texto: `“${curtoTrecho}”`, detalhe: 'Citação direta sem página. A NBR 10520:2023 pede a página na citação direta.' });
    const plano = semAcento(trecho).replace(/\s+/g, ' ');
    if (!dosGrifos.some((g) => g.includes(plano))) achados.push({ tipo: 'sem-grifo', texto: `“${curtoTrecho}”`, detalhe: 'Este trecho entre aspas não está entre os seus grifos. Confira no texto se foi copiado igual.' });
  }
  return achados;
}
