// Comportamentos de interface comuns a todas as telas (design system v2, docs/design-system.md).
//
// ouvir(tipo, fn): registra um ouvinte de 'click' ou 'submit' no documento. Se a função devolver uma
// promessa que demore mais de 300 ms, o botão que disparou a ação mostra que está trabalhando
// (aria-busy, giro no lugar do ícone, largura mantida e, se tiver data-ocupado, o rótulo no gerúndio).
// Enquanto a ação não termina, cliques repetidos no mesmo botão são ignorados (sem envio duplo).
// Ações rápidas não piscam nada (NN/g: indicador só quando a espera passa de cerca de 1 s).

const ESPERA_MS = 300;
const pendentes = new WeakMap(); // controle -> { n, ev }

export function controleDe(ev) {
  if (ev.type === 'submit') return ev.submitter || ev.target.querySelector?.('[type=submit]') || null;
  const t = ev.target;
  return (t && t.closest && t.closest('button, a.btn, [role=button]')) || null;
}

function bloquearRepetido(ev) {
  const ctl = controleDe(ev);
  const p = ctl && pendentes.get(ctl);
  if (p && p.n > 0 && p.ev !== ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
}
if (typeof window !== 'undefined' && !window.__rbUiBloqueio) {
  window.__rbUiBloqueio = true;
  window.addEventListener('click', bloquearRepetido, true);
  window.addEventListener('submit', bloquearRepetido, true);
}

// Marca o controle como ocupado enquanto a promessa não termina.
export function ocupado(ctl, promessa, rotulo) {
  if (!ctl || !promessa || typeof promessa.then !== 'function') return promessa;
  const reg = pendentes.get(ctl) || { n: 0, ev: null };
  reg.n += 1;
  pendentes.set(ctl, reg);
  const texto = rotulo || ctl.dataset?.ocupado;
  let fim = false;
  let original;
  const timer = setTimeout(() => {
    if (fim || !ctl.isConnected) return;
    ctl.style.minWidth = `${ctl.offsetWidth}px`;
    ctl.setAttribute('aria-busy', 'true');
    if (texto) {
      original = ctl.innerHTML;
      ctl.textContent = texto;
    }
  }, ESPERA_MS);
  const limpar = () => {
    fim = true;
    clearTimeout(timer);
    reg.n = Math.max(0, reg.n - 1);
    if (reg.n > 0) return;
    if (ctl.getAttribute('aria-busy') === 'true') {
      ctl.removeAttribute('aria-busy');
      ctl.style.minWidth = '';
      if (original !== undefined) ctl.innerHTML = original;
    }
  };
  promessa.then(limpar, limpar);
  return promessa;
}

export function ouvir(tipo, fn, alvo = document) {
  alvo.addEventListener(tipo, (ev) => {
    const r = fn(ev);
    if (r && typeof r.then === 'function') {
      const ctl = controleDe(ev);
      if (ctl) {
        const reg = pendentes.get(ctl) || { n: 0, ev: null };
        reg.ev = ev;
        pendentes.set(ctl, reg);
        ocupado(ctl, r);
      }
    }
    return r;
  });
}
