// Configuração pública do app. Nada aqui é segredo.
//
// GOOGLE_CLIENT_ID: o "ID do cliente" OAuth criado no Google Cloud (termina em .apps.googleusercontent.com).
// Ele é público por natureza: o Google só aceita login vindo dos endereços autorizados no console
// (diobertnascimento.github.io e localhost:4173), e só de contas cadastradas como usuárias de teste.
// NUNCA coloque aqui a "chave secreta do cliente" (client secret): o app não usa e ela não pode ficar pública.

export const GOOGLE_CLIENT_ID = '4685827365-rs7bk5tb5krh60gvp72nmvgdsekjulqa.apps.googleusercontent.com';

// Permissões pedidas ao Google. drive.file: o app só enxerga os arquivos que ele mesmo criou.
export const ESCOPOS = ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/drive.file'];
export const ESCOPO_DRIVE = 'https://www.googleapis.com/auth/drive.file';
