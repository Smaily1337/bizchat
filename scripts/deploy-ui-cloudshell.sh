#!/usr/bin/env bash
# Redeploy panel + landing with Automovia Core (no yellow).
# Cloud Shell (from anywhere):
#   curl -fsSL https://raw.githubusercontent.com/Smaily1337/bizchat/cursor/automovia-design-0cd1/scripts/deploy-ui-cloudshell.sh | bash
# Or after clone:
#   cd ~/bizchat && bash scripts/deploy-ui-cloudshell.sh
set -euo pipefail

PROJECT=bizchat-504420
REGION=europe-central2
API_URL=https://bizchat-api-702906501614.europe-central2.run.app
IMAGE=europe-central2-docker.pkg.dev/${PROJECT}/cloud-run-source-deploy/bizchat-panel
BRANCH=cursor/automovia-design-0cd1
REPO_URL=https://github.com/Smaily1337/bizchat.git
REPO_DIR="${REPO_DIR:-$HOME/bizchat}"

if [[ ! -f "$REPO_DIR/cloudbuild.panel.yaml" ]]; then
  echo "==> Cloning $REPO_URL → $REPO_DIR"
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"
echo "==> Updating branch $BRANCH…"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> Building panel image (Automovia)…"
gcloud builds submit --project="$PROJECT" \
  --config=cloudbuild.panel.yaml \
  --substitutions=_VITE_API_URL="$API_URL",_IMAGE="$IMAGE"

echo "==> Deploying bizchat-panel…"
gcloud run deploy bizchat-panel \
  --project="$PROJECT" --region="$REGION" \
  --image="${IMAGE}:latest" \
  --allow-unauthenticated --max-instances=1 --min-instances=0

echo "==> Deploying bizchat-landing…"
gcloud run deploy bizchat-landing \
  --project="$PROJECT" --region="$REGION" --source=./docs \
  --allow-unauthenticated --max-instances=1 --min-instances=0

echo "Done. Hard-refresh the panel (Ctrl+Shift+R)."
echo "Panel:   https://bizchat-panel-702906501614.europe-central2.run.app"
echo "Landing: https://bizchat-landing-702906501614.europe-central2.run.app"
