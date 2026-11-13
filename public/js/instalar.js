// Dica de instalação no iPhone e no iPad: o Safari não oferece instalação sozinho.
// Aparece só quando o app está aberto no navegador (não instalado) e até o usuário tocar em "Entendi".

const CHAVE = 'rb.dica-instalar-ios';

export const ehIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const instalado = () =>
  navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

export function iniciarDicaInstalar({ registrar, aviso }) {
  let dispensada = false;
  try {
    dispensada = localStorage.getItem(CHAVE) === 'dispensada';
  } catch {}
  if (!ehIOS() || instalado() || dispensada) return false;

  aviso({
    id: 'aviso-instalar',
    texto: 'Para instalar no iPhone: toque em Compartilhar e depois em “Adicionar à Tela de Início”. Instalado, o app abre em tela cheia e guarda seus dados com segurança.',
    acoes: [
      {
        rotulo: 'Entendi',
        principal: true,
        ao: () => {
          try {
            localStorage.setItem(CHAVE, 'dispensada');
          } catch {}
          registrar('app', 'app.dica_instalar_dispensada');
        },
      },
    ],
  });
  registrar('app', 'app.dica_instalar_mostrada');
  return true;
}
