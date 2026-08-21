#!/usr/bin/env bash
# Deploy platform to Google Cloud Run from local machine
set -euo pipefail

PROJECT="bizchat-504420"
REGION="europe-central2"
API_URL="https://bizchat-api-702906501614.europe-central2.run.app"
IMAGE="europe-central2-docker.pkg.dev/${PROJECT}/cloud-run-source-deploy/bizchat-panel"

GCLOUD_BIN="$HOME/google-cloud-sdk/bin/gcloud"
if ! command -v "$GCLOUD_BIN" &>/dev/null; then
  if command -v gcloud &>/dev/null; then
    GCLOUD_BIN="gcloud"
  else
    echo "❌ Błąd: Nie znaleziono gcloud w $HOME/google-cloud-sdk/bin/gcloud ani w PATH."
    exit 1
  fi
fi

echo "==> Weryfikacja konta GCP..."
ACTIVE_ACCOUNT=$("$GCLOUD_BIN" auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1 || true)

if [[ -z "$ACTIVE_ACCOUNT" ]]; then
  echo ""
  echo "❌ BRAK LOGOWANIA GCP!"
  echo "Uruchom w swoim terminalu:"
  echo "  gcloud auth login"
  echo "  gcloud config set project $PROJECT"
  exit 1
fi

echo "==> Zalogowano jako: $ACTIVE_ACCOUNT"
"$GCLOUD_BIN" config set project "$PROJECT" >/dev/null

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "=========================================="
echo "==> [1/2] Deploy backendu (bizchat-api)..."
echo "=========================================="
"$GCLOUD_BIN" run deploy bizchat-api \
  --project="$PROJECT" \
  --region="$REGION" \
  --source=./backend \
  --allow-unauthenticated \
  --update-env-vars="PUBLIC_API_URL=https://bizchat-api-702906501614.europe-central2.run.app,PUBLIC_FRONTEND_URL=https://bizchat-panel-702906501614.europe-central2.run.app,META_APP_ID=1521874379621724,META_APP_SECRET=15ff1f84a7a34674a104f3046e7e2887,META_VERIFY_TOKEN=bizchat-verify" \
  --max-instances=2 \
  --min-instances=0

echo "=========================================="
echo "==> [2/2] Budowanie i deploy frontendu (bizchat-panel)..."
echo "=========================================="
"$GCLOUD_BIN" builds submit --project="$PROJECT" \
  --config=cloudbuild.panel.yaml \
  --substitutions=_VITE_API_URL="$API_URL",_IMAGE="$IMAGE",_VITE_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY:-}"

"$GCLOUD_BIN" run deploy bizchat-panel \
  --project="$PROJECT" \
  --region="$REGION" \
  --image="$IMAGE" \
  --allow-unauthenticated \
  --port=80

echo "=========================================="
echo "✅ SUKCES! Serwer został pomyślnie zaktualizowany:"
echo "   API:   https://bizchat-api-702906501614.europe-central2.run.app"
echo "   PANEL: https://bizchat-panel-702906501614.europe-central2.run.app"
echo "=========================================="
