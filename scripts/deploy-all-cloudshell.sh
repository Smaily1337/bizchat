#!/usr/bin/env bash
# Deploy BOTH backend API and frontend panel in one go.
#
# Cloud Shell:
#   curl -fsSL https://raw.githubusercontent.com/Smaily1337/bizchat/main/scripts/deploy-all-cloudshell.sh | bash
set -euo pipefail

PROJECT=bizchat-504420
REGION=europe-central2
BRANCH=main
API_URL=https://bizchat-api-702906501614.europe-central2.run.app
IMAGE=europe-central2-docker.pkg.dev/${PROJECT}/cloud-run-source-deploy/bizchat-panel
REPO_URL=https://github.com/Smaily1337/bizchat.git
REPO_DIR="${REPO_DIR:-$HOME/bizchat}"

need_auth() {
  echo ""
  echo "!!! BRAK LOGOWANIA gcloud — deploy się nie wykona."
  echo "W Cloud Shell uruchom:"
  echo "  gcloud auth login"
  echo "  gcloud config set project $PROJECT"
  exit 1
}

if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q .; then
  need_auth
fi

ACTIVE=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -1)
echo "==> gcloud account: $ACTIVE"
gcloud config set project "$PROJECT" >/dev/null

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "==> Cloning $REPO_URL → $REPO_DIR"
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"
echo "==> Updating branch $BRANCH…"
git fetch origin
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd

COMMIT=$(git rev-parse --short HEAD)

echo "=========================================="
echo "==> [1/2] Deploying bizchat-api @ $COMMIT"
echo "=========================================="
gcloud run deploy bizchat-api \
  --project="$PROJECT" \
  --region="$REGION" \
  --source=./backend \
  --allow-unauthenticated \
  --update-env-vars="PUBLIC_API_URL=https://bizchat-api-702906501614.europe-central2.run.app,PUBLIC_FRONTEND_URL=https://bizchat-panel-702906501614.europe-central2.run.app,META_APP_ID=1521874379621724,META_APP_SECRET=15ff1f84a7a34674a104f3046e7e2887,META_VERIFY_TOKEN=bizchat-verify" \
  --max-instances=2 \
  --min-instances=0

echo "=========================================="
echo "==> [2/2] Building & Deploying bizchat-panel"
echo "=========================================="
gcloud builds submit --project="$PROJECT" \
  --config=cloudbuild.panel.yaml \
  --substitutions=_VITE_API_URL="$API_URL",_IMAGE="$IMAGE",_VITE_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY:-}"

gcloud run deploy bizchat-panel \
  --project="$PROJECT" \
  --region="$REGION" \
  --image="$IMAGE" \
  --allow-unauthenticated \
  --port=80

echo "=========================================="
echo "✅ SUKCES! Cała platforma zaktualizowana:"
echo "   API:   https://bizchat-api-702906501614.europe-central2.run.app"
echo "   PANEL: https://bizchat-panel-702906501614.europe-central2.run.app"
echo "=========================================="
