#!/usr/bin/env bash
# Publica o servidor da chave do Gemini no Cloud Run.
#
# Onde rodar: no Cloud Shell (https://shell.cloud.google.com), dentro da pasta servidor/ do repositório.
#   git clone https://github.com/diobertnascimento/researchbook.git
#   cd researchbook/servidor
#   bash publicar.sh ID-DO-PROJETO
#
# Pode rodar de novo quantas vezes quiser: cada passo confere o que já existe.
# Para trocar a chave:        TROCAR_CHAVE=sim bash publicar.sh ID-DO-PROJETO
# Para mudar o limite do dia: LIMITE_DIA=500 bash publicar.sh ID-DO-PROJETO
# Para aceitar outro endereço do app (domínio próprio), separe por vírgula:
#   ORIGENS=https://diobertnascimento.github.io,https://meu-dominio.com.br bash publicar.sh ID-DO-PROJETO
#
# A chave é digitada aqui com a tela escondida e vai direto para o Secret Manager do projeto.
# Ela não fica neste arquivo, no histórico do terminal nem no repositório.
set -euo pipefail

PROJETO="${1:-$(gcloud config get-value project 2>/dev/null || true)}"
REGIAO="us-central1"
SERVICO="researchbook-ia"
CONTA="researchbook-ia"
SEGREDO="gemini-chave"
ORIGENS="${ORIGENS:-https://diobertnascimento.github.io}"
LIMITE_DIA="${LIMITE_DIA:-300}"

if [ -z "$PROJETO" ] || [ "$PROJETO" = "(unset)" ]; then
  echo "Diga o ID do projeto: bash publicar.sh ID-DO-PROJETO"
  exit 1
fi
if [ ! -f index.js ] || [ ! -f ../public/js/config.js ]; then
  echo "Rode este comando de dentro da pasta servidor/ do repositório."
  exit 1
fi

gcloud config set project "$PROJETO" >/dev/null
CLIENTE=$(grep -o "GOOGLE_CLIENT_ID = '[^']*'" ../public/js/config.js | cut -d"'" -f2)
NUMERO=$(gcloud projects describe "$PROJETO" --format='value(projectNumber)')
SA="$CONTA@$PROJETO.iam.gserviceaccount.com"
CONSTRUTOR="$NUMERO-compute@developer.gserviceaccount.com"

echo "1/6 Ligando os serviços do Google Cloud (pode levar um minuto)..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com firestore.googleapis.com --quiet

echo "2/6 Conta de serviço do servidor (ela só lê a chave e conta os pedidos do dia)..."
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "$CONTA" --display-name="Servidor da chave do researchbook" --quiet
# A conta recém-criada leva alguns segundos para existir em todo o Google Cloud.
for tentativa in 1 2 3 4 5 6; do
  if gcloud projects add-iam-policy-binding "$PROJETO" --member="serviceAccount:$SA" \
    --role="roles/datastore.user" --condition=None --quiet >/dev/null 2>&1; then break; fi
  [ "$tentativa" = 6 ] && { echo "Não deu para dar a permissão do contador à conta de serviço. Rode de novo em um minuto."; exit 1; }
  sleep 5
done
# Quem constrói o servidor a partir do código é a conta padrão do projeto.
gcloud projects add-iam-policy-binding "$PROJETO" --member="serviceAccount:$CONSTRUTOR" \
  --role="roles/run.builder" --condition=None --quiet >/dev/null 2>&1 ||
  echo "   Aviso: não consegui dar a permissão de construção agora; se a publicação falhar, rode de novo."

echo "3/6 Chave do Gemini..."
if gcloud secrets describe "$SEGREDO" >/dev/null 2>&1 && [ "${TROCAR_CHAVE:-}" != "sim" ]; then
  echo "   Já existe uma chave guardada neste projeto. Para trocar: TROCAR_CHAVE=sim bash publicar.sh $PROJETO"
else
  read -r -s -p "   Cole a chave do Gemini e aperte Enter (ela não aparece na tela): " CHAVE
  echo
  if [ -z "$CHAVE" ]; then
    echo "Chave vazia. Nada foi guardado."
    exit 1
  fi
  gcloud secrets describe "$SEGREDO" >/dev/null 2>&1 ||
    gcloud secrets create "$SEGREDO" --replication-policy=automatic --quiet
  printf '%s' "$CHAVE" | gcloud secrets versions add "$SEGREDO" --data-file=- --quiet >/dev/null
  unset CHAVE
  echo "   Chave guardada no Secret Manager."
fi
gcloud secrets add-iam-policy-binding "$SEGREDO" --member="serviceAccount:$SA" \
  --role="roles/secretmanager.secretAccessor" --quiet >/dev/null

echo "4/6 Contador do limite do dia (Firestore)..."
gcloud firestore databases describe --database='(default)' >/dev/null 2>&1 ||
  gcloud firestore databases create --location=nam5 --quiet

echo "5/6 Conta atendida..."
EMAIL="${EMAIL_PERMITIDO:-}"
if [ -z "$EMAIL" ]; then
  read -r -p "   E-mail da conta Google que você usa para entrar no researchbook: " EMAIL
fi
case "$EMAIL" in
  *@*.*) ;;
  *) echo "Isto não parece um e-mail: $EMAIL"; exit 1 ;;
esac

echo "6/6 Publicando (uns 3 minutos na primeira vez)..."
gcloud run deploy "$SERVICO" --source . --region "$REGIAO" --allow-unauthenticated \
  --service-account "$SA" --set-secrets "GEMINI_CHAVE=$SEGREDO:latest" \
  --set-env-vars "^|^EMAIL_PERMITIDO=$EMAIL|CLIENTE_GOOGLE=$CLIENTE|ORIGENS=$ORIGENS|LIMITE_DIA=$LIMITE_DIA" \
  --max-instances 2 --memory 256Mi --quiet

URL=$(gcloud run services describe "$SERVICO" --region "$REGIAO" --format='value(status.url)')
echo
echo "Publicado. Endereço do servidor:"
echo "  $URL"
echo
# Sem login, o servidor certo responde 401. Um 500 quer dizer que ele subiu sem a chave ou sem o e-mail.
CODIGO=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL/v1beta/models/gemini-teste:generateContent" || true)
if [ "$CODIGO" = "401" ]; then
  echo "Conferido: o servidor está no ar e recusa pedido sem login (401)."
else
  echo "Atenção: o teste sem login devolveu $CODIGO (o esperado é 401). Copie esta tela e mande para conferir."
fi
echo "Mande este endereço para ser colocado no app. Ele não é segredo."
