#!/usr/bin/env bash
# Redeploy panel + landing with salon features (Raporty, Zespół, …).
#
# Cloud Shell — używaj TYLKO tej gałęzi (nie automovia-design):
#   curl -fsSL https://raw.githubusercontent.com/Smaily1337/bizchat/cursor/salon-features-0cd1/scripts/deploy-ui-cloudshell.sh | bash
#
# Or after clone:
#   cd ~/bizchat && bash scripts/deploy-ui-cloudshell.sh
set -euo pipefail

PROJECT=bizchat-504420
REGION=europe-central2
API_URL=https://bizchat-api-702906501614.europe-central2.run.app
IMAGE=europe-central2-docker.pkg.dev/${PROJECT}/cloud-run-source-deploy/bizchat-panel
BRANCH=cursor/salon-features-0cd1
REPO_URL=https://github.com/Smaily1337/bizchat.git
REPO_DIR="${REPO_DIR:-$HOME/bizchat}"

if [[ ! -f "$REPO_DIR/cloudbuild.panel.yaml" ]]; then
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
echo "==> Building panel from $BRANCH @ $COMMIT"
echo "    Expected nav: Raporty, Zespół, Kanały, Więcej, Wyloguj (top bar)"

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

echo ""
echo "Done. Hard-refresh the panel (Ctrl+Shift+R / Cmd+Shift+R)."
echo "Panel:   https://bizchat-panel-702906501614.europe-central2.run.app"
echo "Look for: Raporty, Zespół (primary row) + Więcej menu + Wyloguj top-right"
echo "Landing: https://bizchat-landing-702906501614.europe-central2.run.app"
echo ""
echo "API also needs salon-features for /reports and staff endpoints:"
echo "  cd $REPO_DIR && git checkout $BRANCH && git pull"
echo "  gcloud run deploy bizchat-api --project=$PROJECT --region=$REGION --source=./backend --allow-unauthenticated --max-instances=2 --min-instances=0"
