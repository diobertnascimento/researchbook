// Gemini simulado para os testes: guarda cada pedido (cabeçalhos e corpo) e responde como o Gemini.
// Por padrão, responde como um bom tutor: cita o item A1 com um trecho literal tirado do próprio pedido.
// Cenários: 'inventa-uma-vez' (primeira resposta cita fonte inexistente), 'sempre-inventa',
// 'api-desligada' (403), 'cota' (429 nas duas primeiras tentativas), 'fora-do-formato'.
export async function geminiFalso(context, { cenario = 'bom', ...opcoes } = {}) {
  const estado = { pedidos: [], arquivos: [] };
  const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type, x-goog-api-key, x-goog-user-project, x-goog-upload-protocol, x-goog-upload-command, x-goog-upload-header-content-length, x-goog-upload-header-content-type, x-goog-upload-offset',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-expose-headers': 'x-goog-upload-url',
  };
  const responder = (r, status, corpo) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(corpo) });

  await context.route('https://generativelanguage.googleapis.com/**', (r) => {
    const req = r.request();
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    // Área temporária de arquivos (Files API): início do envio, envio dos bytes e consulta.
    if (url.pathname === '/upload/v1beta/files' && !url.searchParams.get('upload_id')) {
      if (cenario === 'api-desligada') return responder(r, 403, { error: { code: 403, message: 'Generative Language API has not been used in project 123 before or it is disabled.', status: 'PERMISSION_DENIED', details: [{ reason: 'SERVICE_DISABLED' }] } });
      const h = req.headers();
      estado.arquivos.push({ tamanho: Number(h['x-goog-upload-header-content-length']), tipo: h['x-goog-upload-header-content-type'], cabecalhos: h });
      return r.fulfill({ status: 200, headers: { ...CORS, 'x-goog-upload-url': `https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=up${estado.arquivos.length}` }, contentType: 'application/json', body: '{}' });
    }
    if (url.pathname === '/upload/v1beta/files') {
      const n = url.searchParams.get('upload_id').slice(2);
      estado.arquivos[n - 1].recebido = (req.postDataBuffer() || Buffer.alloc(0)).length;
      return responder(r, 200, { file: { name: `files/arq${n}`, uri: `https://generativelanguage.googleapis.com/v1beta/files/arq${n}`, mimeType: estado.arquivos[n - 1].tipo, state: 'PROCESSING' } });
    }
    if (url.pathname.startsWith('/v1beta/files/')) {
      const nome = url.pathname.split('/v1beta/')[1];
      return responder(r, 200, { name: nome, uri: `https://generativelanguage.googleapis.com/v1beta/${nome}`, mimeType: 'audio/wav', state: 'ACTIVE', expirationTime: new Date(Date.now() + 48 * 3600 * 1000).toISOString() });
    }
    const corpo = JSON.parse(req.postData() || '{}');
    const modelo = decodeURIComponent(new URL(req.url()).pathname.split('/models/')[1].split(':')[0]);
    const n = estado.pedidos.push({ modelo, cabecalhos: req.headers(), corpo });
    if (cenario === 'api-desligada') return responder(r, 403, { error: { code: 403, message: 'Generative Language API has not been used in project 123 before or it is disabled.', status: 'PERMISSION_DENIED', details: [{ reason: 'SERVICE_DISABLED' }] } });
    if (cenario === 'cota' && n <= 2) return responder(r, 429, { error: { code: 429, message: 'Resource has been exhausted (e.g. check quota).', status: 'RESOURCE_EXHAUSTED' } });

    const textoDe = (c) => (c?.parts || []).filter((p) => typeof p.text === 'string').map((p) => p.text).join('\n');
    const ultimo = textoDe(corpo.contents?.at(-1));
    // Na correção, o acervo está numa mensagem anterior: procura em todas as mensagens do autor.
    const todos = (corpo.contents || []).filter((c) => c.role === 'user').map(textoDe).join('\n');
    const props = corpo.generationConfig?.responseJsonSchema?.properties || {};
    let texto;
    if (!corpo.generationConfig?.responseJsonSchema) {
      texto = 'ok';
    } else if (corpo.generationConfig.responseJsonSchema.properties?.propostas) {
      // Tarefa da memória: uma proposta com evidência tirada da última fala do autor (vale) e uma tirada da fala da IA (o app recusa).
      const falas = [...todos.matchAll(/^\[(\d+)\] autor: (.+)$/gm)].map((m) => ({ n: Number(m[1]), texto: m[2] }));
      const daIA = todos.match(/^\[\d+\] ia: (.+)$/m)?.[1] || '';
      const ultima = falas.at(-1);
      const atualizaId = todos.match(/^\[(mem-[^\]]+)\]/m)?.[1] || '';
      const propostas = ultima
        ? [
            { tipo: 'decisao', texto: ultima.texto, evidencia: ultima.texto.split(/\s+/).slice(0, 6).join(' '), mensagem: ultima.n, atualiza: opcoes.atualizar ? atualizaId : '' },
            { tipo: 'posicao', texto: 'Uma ideia que só a IA disse', evidencia: daIA.split(/\s+/).slice(0, 5).join(' '), mensagem: ultima.n, atualiza: '' },
          ]
        : [];
      texto = JSON.stringify({ propostas });
    } else if (props.segmentos && opcoes.falharParte && !estado.falhou && new RegExp(`Parte ${opcoes.falharParte} de`).test(todos)) {
      estado.falhou = true;
      return responder(r, 400, { error: { code: 400, message: 'Request payload size exceeds the limit.', status: 'INVALID_ARGUMENT' } });
    } else if (props.escolha) {
      texto = JSON.stringify(respostaOrganizar(todos, opcoes));
    } else if (props.cartoes || props.mais_importante || props.tracos) {
      texto = JSON.stringify(respostaEstudo(props, todos));
    } else if (props.obras || props.combinados_anteriores || props.posicoes) {
      texto = JSON.stringify(respostaDissertacao(props, todos, opcoes));
    } else if (props.segmentos || props.resumo || props.entregas) {
      texto = JSON.stringify(respostaAula(props, todos, corpo, opcoes));
    } else if (copilot(corpo.generationConfig.responseJsonSchema.properties)) {
      texto = JSON.stringify(respostaCopilot(corpo.generationConfig.responseJsonSchema.properties, todos, opcoes));
    } else {
      // Tira as primeiras palavras do item A1 do próprio pedido, para citar um trecho que existe.
      const m = todos.match(/<item id="A1"[^>]*>\s*<material-[0-9a-f]+>\s*([\s\S]*?)\s*<\/material-/);
      const literal = (m?.[1] || '').split(/\s+/).slice(0, 6).join(' ');
      const inventar = cenario === 'sempre-inventa' || (cenario === 'inventa-uma-vez' && !/conferência automática/.test(ultimo));
      const resposta = inventar
        ? { resposta: 'O texto defende rotas negociadas (Silva, 2020, p. 9) [A9] e diz que "a adesão é tudo o que importa no fim".', pergunta: 'Isso muda o seu critério?', fontes: [{ id: 'A9', trecho_literal: 'trecho que não existe' }], fora_do_acervo: [] }
        : { resposta: `O trecho afirma o ponto central da obra (Moraes; Lins, 2024, p. 1) [A1].`, pergunta: 'Como isso entra no seu critério de avaliação?', fontes: [{ id: 'A1', trecho_literal: literal }], fora_do_acervo: ['Estudos sobre cooperativas de reciclagem no Brasil (autor a confirmar)'] };
      texto = cenario === 'fora-do-formato' ? 'isto não é JSON' : JSON.stringify(resposta);
    }
    return responder(r, 200, {
      candidates: [{ content: { role: 'model', parts: [{ text: texto }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 1800, cachedContentTokenCount: 1200, thoughtsTokenCount: 90, candidatesTokenCount: 140, totalTokenCount: 2030 },
      modelVersion: modelo,
    });
  });
  return estado;
}

// Copilot de escrita: reconhece a tarefa pelo esquema pedido e responde no formato, citando A1 com trecho literal.
const copilot = (p = {}) => ['versoes', 'pontos', 'secoes', 'verificacoes', 'veredito', 'comentario', 'por_que'].some((k) => k in p) || (Object.keys(p).length === 1 && 'texto' in p);
function respostaCopilot(p, todos, opcoes) {
  const m = todos.match(/<item id="A1"[^>]*>\s*<material-[0-9a-f]+>\s*([\s\S]*?)\s*<\/material-/);
  const literal = (m?.[1] || '').split(/\s+/).slice(0, 6).join(' ');
  const fontes = literal ? [{ id: 'A1', trecho_literal: literal }] : [];
  const cita = literal ? ' (Moraes; Lins, 2024, p. 1) [A1]' : '';
  const doAutor = todos.match(/<texto_do_autor>\s*<material-[0-9a-f]+>\s*([\s\S]*?)\s*<\/material-/)?.[1] || '';
  if ('versoes' in p) {
    if (opcoes.recusarVersoes) return { versoes: [], fontes: [], alertas: [], recusa: 'O parágrafo ainda não tem uma ideia sua para trabalhar. Escreva uma frase com o que quer dizer.' };
    return {
      versoes: [
        { tipo: 'proxima', texto: `${doAutor.replace(/\.$/, '')}, como mostra o caso das cooperativas${cita}.`, mudancas: ['liga à fonte', 'mesma ordem'] },
        { tipo: 'academica', texto: `A coordenação das rotas depende da adesão das equipes de coleta${cita}.`, mudancas: ['tira o coloquial'] },
      ],
      fontes,
      alertas: [{ trecho: doAutor.slice(0, 30), problema: 'sem_fonte', explicacao: 'A segunda parte do parágrafo não tem fonte no seu acervo.', como_resolver: 'Adicione uma obra que sustente o ponto ou retire a afirmação.' }],
    };
  }
  if ('pontos' in p) {
    return {
      pontos: [
        { afirmacao: 'A adesão das equipes define o sucesso das rotas.', classe: 'sustentado', fontes, comentario: `Seu acervo sustenta o ponto${cita}.` },
        { afirmacao: 'Cooperativas pequenas não usam roteirização.', classe: 'lacuna', fontes: [], comentario: 'Nenhum grifo trata do porte das cooperativas.' },
      ],
      sugestoes_de_busca: [{ descricao: 'Estudos sobre o porte das cooperativas de reciclagem', obra_sugerida: '' }],
    };
  }
  if ('secoes' in p) {
    return {
      secoes: [
        { titulo: 'Introdução', objetivo: 'Apresentar a tese e o caso.', fontes: literal ? ['A1'] : [], palavras: 400, depende_de_lacuna: false },
        { titulo: 'Rotas negociadas', objetivo: 'Mostrar como a adesão muda o resultado.', fontes: literal ? ['A1'] : [], palavras: 900, depende_de_lacuna: false },
        { titulo: 'Considerações finais', objetivo: 'Retomar a tese.', fontes: [], palavras: 300, depende_de_lacuna: false },
      ],
      observacao: 'A seção sobre o porte das cooperativas ficou de fora porque falta fonte.',
    };
  }
  if ('verificacoes' in p) {
    return {
      verificacoes: [
        { item: 'afirmacoes_sem_fonte', situacao: 'atencao', resumo: 'Uma afirmação da introdução não tem fonte.' },
        { item: 'coerencia', situacao: 'ok', resumo: 'As seções sustentam a tese.' },
      ],
      problemas: [{ item: 'afirmacoes_sem_fonte', gravidade: 'media', secao: 'Introdução', trecho: (doAutor || todos.match(/## 1\. [^\n]*\n([^\n]{10,60})/)?.[1] || '').slice(0, 40), problema: 'Afirmação sem fonte', como_resolver: 'Cite uma obra do acervo ou retire.' }],
    };
  }
  if ('veredito' in p) return { veredito: 'soa em parte', diferencas: [{ trecho: doAutor.slice(0, 40), diferenca: 'A frase é mais longa que as suas.', sugestao: 'Divida em duas.' }] };
  if ('comentario' in p) return { comentario: `A seção pode se apoiar no caso das cooperativas${cita}.`, pergunta: 'O que esta seção precisa provar para a sua tese funcionar?', fontes };
  if ('por_que' in p) return { pergunta: 'Que caso concreto mostra isso na prática?', por_que: 'Sem um caso, a tese fica abstrata para a banca.' };
  return { texto: 'A próxima seção examina como as equipes participam da definição das rotas.' };
}

// Aulas: transcrição por trecho, resumo com trechos (um deles inventado, que o app descarta) e plano de ensino.
const emDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
function respostaAula(p, todos, corpo, opcoes) {
  if (p.segmentos) {
    const ini = todos.match(/<trecho>\s*inicio: ([\d:]+)/)?.[1] || '00:00';
    const s0 = ini.split(':').map(Number).reduce((a, n) => a * 60 + n, 0);
    const parte = Number(todos.match(/Parte (\d+) de/)?.[1] || 1);
    const temAudio = corpo.contents.at(-1).parts.some((x) => x.inlineData || x.fileData);
    if (!temAudio) return { segmentos: [] };
    return {
      segmentos: [
        { inicio: mmss(s0 + 5), falante: 'Docente', texto: `Na parte ${parte}, a pergunta é como sabemos que um artefato funciona.` },
        { inicio: mmss(s0 + 65), falante: 'Participante 1', texto: 'E quando a equipe pode ignorar a rota sugerida?' },
        { inicio: mmss(s0 + 125), falante: 'Docente', texto: `Então a adesão das equipes vira parte do que se avalia. Leiam Moraes e Lins, de 2024, e também Sonnenberg e vom Brocke.` },
      ],
    };
  }
  if (p.resumo) {
    const temB1 = /^B1: Moraes/m.test(todos);
    return {
      resumo: [
        { tempo: '00:05', texto: 'A aula pergunta como saber se um artefato funciona.', trecho: 'a pergunta é como sabemos que um artefato funciona' },
        { tempo: '02:05', texto: 'A adesão das equipes entra no que se avalia.', trecho: 'a adesão das equipes vira parte do que se avalia' },
        { tempo: '03:00', texto: 'Um ponto que ninguém disse.', trecho: 'frase que não está na transcrição de jeito nenhum' },
      ],
      conceitos: [{ tempo: '02:05', nome: 'Adesão', definicao_em_aula: 'Quanto a equipe segue de fato o que o artefato propõe.', trecho: 'a adesão das equipes vira parte do que se avalia' }],
      leituras: [
        { tempo: '02:05', como_foi_dito: 'Moraes e Lins, de 2024', id_biblioteca: temB1 ? 'B1' : '', autor: 'Moraes', ano: '2024', titulo: '', o_que_foi_dito: 'Leitura pedida para a próxima aula.' },
        { tempo: '02:05', como_foi_dito: 'Sonnenberg e vom Brocke', id_biblioteca: '', autor: 'Sonnenberg', ano: '', titulo: '', o_que_foi_dito: 'Citado sobre avaliação ao longo do ciclo.' },
      ],
      perguntas: ['O que você vai declarar antes como funcionar?'],
      combinados: [{ tempo: '02:05', tarefa: 'Entregar o fichamento crítico', prazo: emDias(9) }],
      aviso: '',
    };
  }
  return {
    docente: 'Docente de exemplo',
    dia_semana: 'qui',
    inicio: '19:00',
    fim: '21:00',
    aulas: [
      { data: emDias(5), tema: 'Métodos mistos em design', referencia_no_documento: '' },
      { data: '', tema: 'Seminários finais', referencia_no_documento: 'semana 15' },
    ],
    leituras: [
      { referencia: 'MORAES, T.; LINS, R. Roteirização colaborativa. Revista de Exemplo, 2024.', sobrenome: 'Moraes', ano: '2024', obrigatoria: true },
      { referencia: 'SONNENBERG, C.; VOM BROCKE, J. Evaluations in the science of the artificial. 2012.', sobrenome: 'Sonnenberg', ano: '2012', obrigatoria: false },
    ],
    entregas: [{ descricao: 'Fichamento crítico', data: emDias(9), peso: '30%' }],
    duvidas: opcoes.duvidas ? ['A data do seminário aparece duas vezes.'] : [],
  };
}

// Dissertação: revisão do projeto, registro de orientação e encerramento de diálogo.
function respostaDissertacao(p, todos, opcoes) {
  if (p.obras) {
    const temB1 = /^B1: Moraes/m.test(todos);
    const segunda = /<versao_anterior>\nVersão 1/.test(todos);
    return {
      paginas: 42,
      obras: [
        { como_aparece: 'Moraes e Lins (2024)', id_biblioteca: temB1 ? 'B1' : '', secoes: ['3.2 Método', '3.5 Avaliação'], vezes: 3, funcao: 'decisao', prioridade: 3, porque: 'Sustenta o critério de avaliação e a obra ainda não foi fichada.', incompleta: false },
        { como_aparece: 'Sonnenberg e vom Brocke (2012)', id_biblioteca: '', secoes: ['3.5 Avaliação'], vezes: 1, funcao: 'argumento', prioridade: 3, porque: 'A banca pode perguntar como a avaliação acompanha o ciclo; a obra está fora da biblioteca.', incompleta: false },
        { como_aparece: 'Hevner et al. (2004)', id_biblioteca: '', secoes: ['1 Introdução'], vezes: 1, funcao: 'contexto', prioridade: 1, porque: 'Só contextualiza o método.', incompleta: false },
      ],
      problemas: segunda ? [] : [{ tipo: 'citacao_sem_pagina', trecho: '"a adesão é o que importa"', pagina: 12, secao: '2.4' }],
      comparacao: segunda ? { novas: ['Hevner et al. (2004)'], removidas: [], problemas_resolvidos: 1 } : { novas: [], removidas: [], problemas_resolvidos: 0 },
    };
  }
  if (p.combinados_anteriores) {
    const conteudo = todos.match(/<registro>[\s\S]*?<material-[0-9a-f]+>\n([\s\S]*?)\n<\/material-/)?.[1] || '';
    const fala = conteudo.split(/\s+/).slice(0, 8).join(' ');
    const temC1 = /^C1: /m.test(todos);
    return {
      resumo: 'A conversa tratou do critério de avaliação e da seção de método.',
      combinados: [{ acao: 'Declarar o critério de utilidade antes dos testes', responsavel: 'autor', secao: '3.5', prazo: emDias(6) }],
      trechos: [{ tempo: '', fala }, { tempo: '', fala: 'frase que quem orienta nunca disse' }],
      sugestoes: ['Ler sobre avaliação ao longo do ciclo de construção.'],
      temas: ['Avaliação e critérios'],
      combinados_anteriores: temC1 ? [{ id: 'C1', situacao: 'resolvido', detalhe: 'Apresentado nesta conversa.' }] : [],
      pontos_de_atencao: [],
      aviso: '',
    };
  }
  const falas = [...todos.matchAll(/^\[(\d+)\] autor: (.+)$/gm)].map((m) => ({ n: Number(m[1]), texto: m[2] }));
  const arg = todos.match(/^\[(arg-[^\]]+)\]/m)?.[1] || '';
  return {
    posicoes: falas.length
      ? [
          { texto: falas.at(-1).texto, mensagem: falas.at(-1).n, argumento_relacionado: arg },
          { texto: 'Uma posição que o autor nunca escreveu', mensagem: 1, argumento_relacionado: '' },
        ]
      : [],
    questoes_em_aberto: ['Como medir a utilidade sem avaliadores humanos?'],
  };
}

// Organizar a biblioteca: lê a primeira linha do PDF (quando houver) e escolhe o candidato com mais palavras em comum.
function respostaOrganizar(todos, opcoes) {
  const pal = (t) => new Set(String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const ficha = (todos.match(/<ficha>([\s\S]*?)<\/ficha>/) || [])[1] || '';
  const tituloFicha = (ficha.match(/^titulo: (.*)$/m) || [])[1] || '';
  const pdf = (todos.match(/<pdf>\s*<material-\w+>\s*([\s\S]*?)<\/material-/) || [])[1] || '';
  const tituloPDF = pdf.split('\n').map((l) => l.trim()).find(Boolean) || '';
  const base = pal(tituloPDF || tituloFicha);
  const cands = [...todos.matchAll(/^\[(\d+)\] (.+?) — /gm)].map((m) => ({ n: Number(m[1]), t: m[2] }));
  let melhor = { n: 0, nota: 0 };
  for (const c of cands) {
    const p = pal(c.t);
    let comum = 0;
    p.forEach((w) => base.has(w) && comum++);
    const nota = (2 * comum) / ((p.size + base.size) || 1);
    if (nota > melhor.nota) melhor = { n: c.n, nota };
  }
  // Título traduzido: vale o mesmo primeiro autor e o mesmo ano.
  const autor = ((ficha.match(/^autores: ([^,;\n]+)/m) || [])[1] || '').trim();
  const ano = ((ficha.match(/^ano: (\d{4})/m) || [])[1] || '');
  if (melhor.nota < 0.5 && autor && ano) {
    const porAutor = [...todos.matchAll(/^\[(\d+)\] .+? — (.+?) — (\d{4}|s\.d\.)/gm)].find((m) => m[2].includes(autor) && m[3] === ano);
    if (porAutor) melhor = { n: Number(porAutor[1]), nota: 0.5 };
  }
  const indice = opcoes.organizarIndice ?? (melhor.nota >= 0.5 ? melhor.n : 0);
  return { dados: { titulo: tituloPDF || tituloFicha, autores: [], ano: '' }, escolha: { indice, confianca: indice ? 'media' : 'baixa', motivo: indice ? 'Título e autor batem com o PDF.' : 'Nenhum candidato tem o mesmo título.' } };
}

// Estudo: cartões (um com origem inexistente, que o app recusa), comentários do fichamento e overview do autor.
function respostaEstudo(p, todos) {
  if (p.cartoes) {
    const itens = [...todos.matchAll(/^\[(O\d+)\] \(([^)]+)\) (.+)$/gm)].map((m) => ({ id: m[1], texto: m[3] }));
    const a = itens[0];
    const b = itens[1] || itens[0];
    if (!a) return { cartoes: [], descartados: 0 };
    return {
      cartoes: [
        { tipo: 'evidencia', pergunta: 'Que evidência sustenta a adesão das equipes e qual é o limite dela?', resposta: a.texto.split(/\s+/).slice(0, 12).join(' '), origem: a.id },
        { tipo: 'conceito', pergunta: 'O que a obra entende por rota negociada?', resposta: b.texto.split(/\s+/).slice(0, 10).join(' '), origem: b.id },
        { tipo: 'metodo', pergunta: 'Pergunta sem origem válida', resposta: 'Qualquer coisa.', origem: 'O99' },
      ],
      descartados: 0,
    };
  }
  if (p.mais_importante) {
    return {
      pontos: [
        { tipo: 'forte', texto: 'O resumo identifica o problema da obra (Moraes; Lins, 2024, p. 4) [A1].', ref: 'A1' },
        { tipo: 'lacuna', texto: 'Falta dizer qual foi o método usado pelos autores.', ref: 'resumo' },
        { tipo: 'pergunta', texto: 'Como esse resultado entra no seu critério de avaliação?', ref: '' },
      ],
      mais_importante: 1,
    };
  }
  const mat = todos.match(/<textos>\s*<material-[0-9a-f]+>\n### ([^\n]+)\n([\s\S]*?)\n<\/material-/);
  const titulo = mat?.[1] || '';
  const palavras = (mat?.[2] || '').split(/\s+/);
  return {
    tracos: [
      { traco: 'Abre os parágrafos com uma afirmação curta e qualifica depois.', exemplo: palavras.slice(0, 8).join(' '), texto_de_origem: titulo },
      { traco: 'Um traço com exemplo inventado.', exemplo: 'frase que o autor nunca escreveu em lugar nenhum', texto_de_origem: titulo },
    ],
    atencao: [{ padrao: 'Frases longas quando explica o método.', exemplo: palavras.slice(2, 9).join(' '), onde: 'Nos trechos de método' }],
    temas: [{ tema: 'Cooperativas de reciclagem', textos: 1 }],
    mudancas: [],
    resumo_para_copilot: 'Frases de 15 a 20 palavras; voz ativa; usa "ou seja" para explicar.',
    aviso: 'O retrato ainda é preliminar: há poucos textos.',
  };
}
