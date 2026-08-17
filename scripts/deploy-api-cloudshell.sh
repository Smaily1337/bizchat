#!/usr/bin/env bash
# Redeploy API from salon-features (reports, staff, WhatsApp, deposits, …).
#
# Cloud Shell:
#   curl -fsSL https://raw.githubusercontent.com/Smaily1337/bizchat/cursor/salon-features-0cd1/scripts/deploy-api-cloudshell.sh | bash
set -euo pipefail

PROJECT=bizchat-504420
REGION=europe-central2
BRANCH=cursor/salon-features-0cd1
REPO_URL=https://github.com/Smaily1337/bizchat.git
REPO_DIR="${REPO_DIR:-$HOME/bizchat}"

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
echo "Then redeploy panel if needed: bash scripts/deploy-ui-cloudshell.sh"
