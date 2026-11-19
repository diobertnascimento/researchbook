// Cópia em arquivo numa pasta do computador (v1.8.0): fora do navegador, então sobrevive a "limpar dados do site".
// Usa a File System Access API, que só existe no Chrome e no Edge do computador. O navegador pede a permissão
// de novo a cada sessão; sem ela, nada é gravado e a tela oferece "Permitir de novo".

const diaLocal = (d) => new Date(d).toLocaleDateString('sv');

export const pastaSuportada = () => typeof window.showDirectoryPicker === 'function';

export function criarPastaLocal({ lerMeta, gravarMeta, exportar, registrar }) {
  let pasta = null;

  // Ler do banco a pasta guardada é a única operação daqui que depende do navegador devolver um objeto do sistema.
  // Disjuntor: se uma leitura não terminar (página derrubada), a próxima abertura não tenta de novo e pede nova escolha.
  const LENDO = 'rb.pasta.lendo';
  let lida = false;
  async function carregar() {
    if (lida) return;
    lida = true;
    try {
      if (localStorage.getItem(LENDO)) {
        await gravarMeta('pastaLocal', null);
        await gravarMeta('pastaLocal:nome', null);
        localStorage.removeItem(LENDO);
        registrar('erro', 'pasta_local.ler', { det: 'a leitura anterior não terminou; a pasta foi esquecida', st: 'aviso' });
        return;
      }
      localStorage.setItem(LENDO, '1');
      pasta = (await lerMeta('pastaLocal')) || null;
      localStorage.removeItem(LENDO);
    } catch {
      pasta = null;
      try { localStorage.removeItem(LENDO); } catch { /* sem armazenamento local */ }
    }
  }

  async function permissao(pedir = false) {
    if (!pasta) return 'sem';
    const modo = { mode: 'readwrite' };
    let p = (await pasta.queryPermission?.(modo)) ?? 'granted';
    if (p !== 'granted' && pedir) p = await pasta.requestPermission(modo);
    return p;
  }

  /** Grava a cópia de hoje na pasta (um arquivo por dia; o do dia é substituído). */
  async function gravarAgora({ pedir = false } = {}) {
    await carregar();
    if (!pasta) return { semPasta: true };
    if ((await permissao(pedir)) !== 'granted') return { precisaPermitir: true };
    const nome = `researchbook-${diaLocal(Date.now())}.json`;
    const arquivo = await pasta.getFileHandle(nome, { create: true });
    const escrita = await arquivo.createWritable();
    await escrita.write(JSON.stringify(await exportar()));
    await escrita.close();
    const em = new Date().toISOString();
    await gravarMeta('pastaLocal:ultima', em);
    registrar('app', 'pasta_local.gravar');
    return { em, nome };
  }

  /** O autor escolhe a pasta (precisa de um clique) e a primeira cópia é gravada na hora. */
  async function escolher() {
    const h = await window.showDirectoryPicker({ mode: 'readwrite', id: 'researchbook' });
    pasta = h;
    lida = true;
    await gravarMeta('pastaLocal', h);
    await gravarMeta('pastaLocal:nome', h.name);
    return gravarAgora({ pedir: true });
  }

  /** Uma vez por dia, se a pasta já foi escolhida e a permissão está valendo. */
  async function diaria() {
    // Sem pasta escolhida, ou com a cópia de hoje já feita, nem lê a pasta do banco.
    if (!(await lerMeta('pastaLocal:nome'))) return null;
    const ultima = await lerMeta('pastaLocal:ultima');
    if (ultima && diaLocal(ultima) === diaLocal(Date.now())) return null;
    try {
      return await gravarAgora();
    } catch (e) {
      registrar('erro', 'pasta_local.gravar', { det: e.message, st: 'aviso' });
      return null;
    }
  }

  async function esquecer() {
    pasta = null;
    await gravarMeta('pastaLocal', null);
    await gravarMeta('pastaLocal:nome', null);
  }

  async function estado() {
    if (await lerMeta('pastaLocal:nome')) await carregar();
    return { suportada: pastaSuportada(), nome: pasta?.name ?? null, ultima: (await lerMeta('pastaLocal:ultima')) || null, permissao: pasta ? await permissao() : 'sem' };
  }

  return { carregar, escolher, gravarAgora, diaria, esquecer, estado };
}
