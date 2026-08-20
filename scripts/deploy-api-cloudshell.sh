#!/usr/bin/env bash
# Redeploy API from salon-features (reports, staff, WhatsApp, deposits, …).
#
# Cloud Shell — skopiuj TYLKO tę jedną linię:
#   curl -fsSL https://raw.githubusercontent.com/Smaily1337/bizchat/main/scripts/deploy-api-cloudshell.sh | bash
set -euo pipefail

PROJECT=bizchat-504420
REGION=europe-central2
BRANCH=main
REPO_URL=https://github.com/Smaily1337/bizchat.git
REPO_DIR="${REPO_DIR:-$HOME/bizchat}"

need_auth() {
  echo ""
  echo "!!! BRAK LOGOWANIA gcloud — deploy się nie wykona."
  echo "W Cloud Shell uruchom KOLEJNO (każda linia osobno):"
  echo ""
  echo "  gcloud auth login"
  echo "  gcloud config set project $PROJECT"
  echo ""
  echo "Potem:"
  echo "  curl -fsSL https://raw.githubusercontent.com/Smaily1337/bizchat/cursor/salon-features-0cd1/scripts/deploy-api-cloudshell.sh | bash"
  echo ""
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
git fetch origin
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"

COMMIT=$(git rev-parse --short HEAD)
echo "==> Deploying bizchat-api from $BRANCH @ $COMMIT"

gcloud run deploy bizchat-api \
  --project="$PROJECT" \
  --region="$REGION" \
  --source=./backend \
  --allow-unauthenticated \
  --max-instances=2 \
  --min-instances=0

echo "Done. API: https://bizchat-api-702906501614.europe-central2.run.app"
