// Atualizações: registra o service worker e avisa quando há versão nova.
// A versão nova só entra quando o usuário toca em "Atualizar agora", para não recarregar
// o app no meio de uma leitura ou de um texto.

export function iniciarAtualizacao({ registrar, aviso }) {
  if (!('serviceWorker' in navigator)) {
    registrar('app', 'app.offline_indisponivel', { det: 'navegador sem service worker', st: 'aviso' });
    return { mostrar: () => {} };
  }

  let pediuAtualizacao = false;

  function mostrar(trabalhador) {
    registrar('app', 'app.versao_nova_disponivel');
    aviso({
      id: 'aviso-versao',
      texto: 'Nova versão do researchbook disponível.',
      acoes: [
        {
          rotulo: 'Atualizar agora',
          principal: true,
          ao: () => {
            pediuAtualizacao = true;
            registrar('app', 'app.atualizar');
            trabalhador?.postMessage({ tipo: 'pular-espera' });
          },
        },
        { rotulo: 'Depois', ao: () => registrar('app', 'app.atualizar_depois') },
      ],
    });
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (pediuAtualizacao) location.reload();
  });

  navigator.serviceWorker
    .register('sw.js')
    .then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) mostrar(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const novo = reg.installing;
        novo?.addEventListener('statechange', () => {
          // "installed" com um controlador ativo = existe versão anterior em uso: é atualização.
          if (novo.state === 'installed' && navigator.serviceWorker.controller) mostrar(novo);
        });
      });
      const verificar = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && verificar());
      setInterval(verificar, 60 * 60 * 1000);
    })
    .catch((e) => registrar('erro', 'app.sw_erro', { det: e.message, st: 'erro' }));

  return { mostrar };
}
