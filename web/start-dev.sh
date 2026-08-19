#!/usr/bin/env bash
# Start Automovia Next.js + Clerk on http://localhost:3000
set -euo pipefail
cd "$(dirname "$0")"
export PATH="${HOME}/.local/bin:${PATH}"

if [[ ! -f .env.local ]]; then
  echo "Brak .env.local — generuję keyless keys (dev)…"
  clerk init --framework next --pm npm --keyless -y --no-skills --mode agent
fi

echo "Starting Next.js on http://localhost:3000"
echo "  Sign in:  http://localhost:3000/sign-in"
echo "  Sign up:  http://localhost:3000/sign-up"
exec npm run dev -- --hostname 0.0.0.0 --port 3000
