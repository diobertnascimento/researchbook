#!/usr/bin/env bash
# Publica o servidor do researchbook no Cloud Run: a chave do Gemini e, desde a v2.17.0, a busca de dados
# de obras no OpenAlex, com a chave dele.
#
# Onde rodar: no Cloud Shell (https://shell.cloud.google.com), dentro da pasta servidor/ do repositório.
#   git clone https://github.com/diobertnascimento/researchbook.git
#   cd researchbook/servidor
#   bash publicar.sh ID-DO-PROJETO
#
# Pode rodar de novo quantas vezes quiser: cada passo confere o que já existe.
# Para trocar a chave:        TROCAR_CHAVE=sim bash publicar.sh ID-DO-PROJETO
# Para trocar a do OpenAlex:  TROCAR_OPENALEX=sim bash publicar.sh ID-DO-PROJETO
# Para publicar sem OpenAlex: SEM_OPENALEX=sim bash publicar.sh ID-DO-PROJETO
# Para mudar o limite do dia: LIMITE_DIA=500 bash publicar.sh ID-DO-PROJETO
# O servidor aceita o endereço do app (researchbook.com.br) e o antigo (diobertnascimento.github.io).
# Para mudar a lista, separe por vírgula:
#   ORIGENS=https://researchbook.com.br bash publicar.sh ID-DO-PROJETO
#
# As chaves são digitadas aqui com a tela escondida e vão direto para o Secret Manager do projeto.
# Elas não ficam neste arquivo, no histórico do terminal nem no repositório.
set -euo pipefail

PROJETO="${1:-$(gcloud config get-value project 2>/dev/null || true)}"
REGIAO="us-central1"
SERVICO="researchbook-ia"
CONTA="researchbook-ia"
SEGREDO="gemini-chave"
SEGREDO_OA="openalex-chave"
ORIGENS="${ORIGENS:-https://researchbook.com.br,https://diobertnascimento.github.io}"
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

echo "1/7 Ligando os serviços do Google Cloud (pode levar um minuto)..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com firestore.googleapis.com --quiet

echo "2/7 Conta de serviço do servidor (ela só lê a chave e conta os pedidos do dia)..."
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

echo "3/7 Chave do Gemini..."
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

echo "4/7 Chave do OpenAlex (busca de dados de obras; opcional)..."
SEGREDOS="GEMINI_CHAVE=$SEGREDO:latest"
if [ "${SEM_OPENALEX:-}" = "sim" ]; then
  echo "   Pulado a pedido. A busca no OpenAlex fica desligada."
else
  if gcloud secrets describe "$SEGREDO_OA" >/dev/null 2>&1 && [ "${TROCAR_OPENALEX:-}" != "sim" ]; then
    echo "   Já existe uma chave do OpenAlex guardada. Para trocar: TROCAR_OPENALEX=sim bash publicar.sh $PROJETO"
  else
    echo "   A chave fica em openalex.org/settings/api. Sem chave, aperte Enter e a busca no OpenAlex fica desligada."
    read -r -s -p "   Cole a chave do OpenAlex e aperte Enter (ela não aparece na tela): " CHAVE_OA
    echo
    if [ -n "$CHAVE_OA" ]; then
      gcloud secrets describe "$SEGREDO_OA" >/dev/null 2>&1 ||
        gcloud secrets create "$SEGREDO_OA" --replication-policy=automatic --quiet
      printf '%s' "$CHAVE_OA" | gcloud secrets versions add "$SEGREDO_OA" --data-file=- --quiet >/dev/null
      unset CHAVE_OA
      echo "   Chave do OpenAlex guardada no Secret Manager."
    fi
  fi
  if gcloud secrets describe "$SEGREDO_OA" >/dev/null 2>&1; then
    gcloud secrets add-iam-policy-binding "$SEGREDO_OA" --member="serviceAccount:$SA" \
      --role="roles/secretmanager.secretAccessor" --quiet >/dev/null
    SEGREDOS="$SEGREDOS,OPENALEX_CHAVE=$SEGREDO_OA:latest"
  else
    echo "   Sem chave do OpenAlex: o servidor sobe sem essa busca."
  fi
fi

echo "5/7 Contador do limite do dia (Firestore)..."
gcloud firestore databases describe --database='(default)' >/dev/null 2>&1 ||
  gcloud firestore databases create --location=nam5 --quiet

echo "6/7 Conta atendida..."
EMAIL="${EMAIL_PERMITIDO:-}"
# Publicando de novo: reaproveita o e-mail que o servidor já usa (ele fica só no Cloud Run, não neste arquivo).
if [ -z "$EMAIL" ]; then
  EMAIL=$(gcloud run services describe "$SERVICO" --region "$REGIAO" --format=json 2>/dev/null |
    grep -A1 '"name": "EMAIL_PERMITIDO"' | grep '"value"' | cut -d'"' -f4 || true)
  [ -n "$EMAIL" ] && echo "   Mantida a conta já cadastrada no servidor."
fi
if [ -z "$EMAIL" ]; then
  read -r -p "   E-mail da conta Google que você usa para entrar no researchbook: " EMAIL
fi
case "$EMAIL" in
  *@*.*) ;;
  *) echo "Isto não parece um e-mail: $EMAIL"; exit 1 ;;
esac

echo "7/7 Publicando (uns 3 minutos na primeira vez)..."
gcloud run deploy "$SERVICO" --source . --region "$REGIAO" --allow-unauthenticated \
  --service-account "$SA" --set-secrets "$SEGREDOS" \
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
CODIGO=$(curl -s -o /dev/null -w '%{http_code}' "$URL/obras/openalex?busca=teste" || true)
if [ "$CODIGO" = "401" ]; then
  echo "Conferido: a busca de dados de obras também pede login (401)."
else
  echo "Atenção: a rota de dados de obras devolveu $CODIGO sem login (o esperado é 401)."
fi
# O servidor diz a versão dele em toda resposta: confere que a que está no ar é a deste código.
ESPERADA=$(grep -o "VERSAO_SERVIDOR = '[^']*'" index.js | cut -d"'" -f2)
NO_AR=$(curl -s -o /dev/null -D - "$URL/estado" | tr -d '\r' | grep -i '^x-researchbook-servidor:' | cut -d' ' -f2 || true)
if [ -n "$ESPERADA" ] && [ "$NO_AR" = "$ESPERADA" ]; then
  echo "Conferido: a versão no ar é a deste código (servidor $NO_AR)."
else
  echo "Atenção: a versão no ar é '${NO_AR:-desconhecida}' e a deste código é '$ESPERADA'. Rode de novo em um minuto."
fi
echo "O endereço do servidor não é segredo. Se ele mudou, mande para ser colocado no app."
