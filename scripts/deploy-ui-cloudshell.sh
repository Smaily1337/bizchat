#!/usr/bin/env bash
# Redeploy panel + landing with salon features (Raporty, Zespół, …).
#
# Cloud Shell — skopiuj TYLKO tę jedną linię (nic więcej z czatu):
#   curl -fsSL https://raw.githubusercontent.com/Smaily1337/bizchat/cursor/salon-features-0cd1/scripts/deploy-ui-cloudshell.sh | bash
set -euo pipefail

PROJECT=bizchat-504420
REGION=europe-central2
API_URL=https://bizchat-api-702906501614.europe-central2.run.app
IMAGE=europe-central2-docker.pkg.dev/${PROJECT}/cloud-run-source-deploy/bizchat-panel
BRANCH=cursor/salon-features-0cd1
REPO_URL=https://github.com/Smaily1337/bizchat.git
REPO_DIR="${REPO_DIR:-$HOME/bizchat}"

need_auth() {
  echo ""
  echo "!!! BRAK LOGOWANIA gcloud — deploy się nie wykona."
  echo "W Cloud Shell uruchom KOLEJNO (każda linia osobno):"
  echo ""
  echo "  gcloud auth login"
  echo "  gcloud config set project $PROJECT"
  echo "  gcloud auth list"
  echo ""
  echo "Potem dopiero ponów:"
  echo "  curl -fsSL https://raw.githubusercontent.com/Smaily1337/bizchat/cursor/salon-features-0cd1/scripts/deploy-ui-cloudshell.sh | bash"
  echo ""
  exit 1
}

if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q .; then
  need_auth
fi

ACTIVE=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -1)
echo "==> gcloud account: $ACTIVE"
gcloud config set project "$PROJECT" >/dev/null

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
echo "Done. Hard-refresh the panel (Ctrl+Shift+R)."
echo "Panel:   https://bizchat-panel-702906501614.europe-central2.run.app/login"
echo "Look for: Raporty, Zespół, Więcej, full email, Wyloguj"
echo "Landing: https://bizchat-landing-702906501614.europe-central2.run.app"
