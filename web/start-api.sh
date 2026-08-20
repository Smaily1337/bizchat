#!/usr/bin/env bash
# Start FastAPI Clerk verifier on http://0.0.0.0:8000
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -f .env.local ]]; then
  echo "Missing web/.env.local — run: clerk init --keyless -y"
  exit 1
fi

# Ensure frontend knows where the API lives (without printing secrets)
if ! grep -q '^NEXT_PUBLIC_API_URL=' .env.local 2>/dev/null; then
  echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' >> .env.local
fi

python3 -m pip install -q fastapi 'uvicorn[standard]' 'PyJWT[crypto]' httpx python-dotenv

echo "Starting FastAPI on http://0.0.0.0:8000  (health: /api/health)"
exec python3 -m uvicorn backend-examples.fastapi_clerk_auth:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload
