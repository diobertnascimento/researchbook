// Configuração pública do app. Nada aqui é segredo.
//
// GOOGLE_CLIENT_ID: o "ID do cliente" OAuth criado no Google Cloud (termina em .apps.googleusercontent.com).
// Ele é público por natureza: o Google só aceita login vindo dos endereços autorizados no console
// (researchbook.com.br, o antigo diobertnascimento.github.io e localhost:4173), e só de contas cadastradas
// como usuárias de teste.
// NUNCA coloque aqui a "chave secreta do cliente" (client secret): o app não usa e ela não pode ficar pública.

export const GOOGLE_CLIENT_ID = '4685827365-rs7bk5tb5krh60gvp72nmvgdsekjulqa.apps.googleusercontent.com';

// Permissões pedidas ao Google. drive.file: o app só enxerga os arquivos que ele mesmo criou.
export const ESCOPOS = ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/drive.file'];
export const ESCOPO_DRIVE = 'https://www.googleapis.com/auth/drive.file';

// Permissão extra, pedida só quando o Diobert escolhe usar o Gemini pelo próprio login Google
// (sem chave guardada em lugar nenhum). É a permissão que a documentação do Gemini usa para OAuth.
export const ESCOPO_IA = 'https://www.googleapis.com/auth/generative-language.retriever';

// Permissão extra do Google Agenda, pedida só quando o Diobert liga a agenda em Ajustes. É a mais estreita da API:
// o app cria a própria agenda ("researchbook") e mexe só nos eventos dela; não vê as outras agendas.
export const ESCOPO_AGENDA = 'https://www.googleapis.com/auth/calendar.app.created';

// Servidor da chave do Gemini (pasta servidor/, publicado no Cloud Run do Diobert). O endereço é público:
// o servidor só atende o login da conta cadastrada nele, e a chave fica lá, nunca aqui.
// Vazio = servidor ainda não publicado; a opção não aparece em Ajustes. Ao preencher, acrescente o mesmo
// endereço em connect-src, na regra de segurança de public/index.html.
export const SERVIDOR_IA = 'https://researchbook-ia-77uxthwshq-uc.a.run.app';
/** O endereço em uso (os testes trocam este arquivo por um simulado). */
export const servidorIA = () => SERVIDOR_IA;

// Endereço do app (v2.15.0). Antes era diobertnascimento.github.io/researchbook, dividido com qualquer outro site
// publicado pela mesma conta do GitHub. Quem ainda abrir o endereço antigo recebe um aviso para vir para cá
// (mudanca.js). O mesmo endereço está em connect-src (index.html); no GitHub, ele é ligado em Settings > Pages.
export const ENDERECO = 'https://researchbook.com.br/';
