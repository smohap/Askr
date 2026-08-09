#!/usr/bin/env bash
# Install, migrate, seed, and start the dev server.
#
#   ./init.sh          local Supabase (needs Docker Desktop running)
#   ./init.sh hosted   push migrations to the linked hosted project instead
#
# Nothing here is destructive to a remote database except `supabase db push`,
# which only applies migrations that have not run yet.

set -euo pipefail
cd "$(dirname "$0")"

MODE="${1:-local}"

echo "==> installing dependencies"
npm install

if [ ! -f .env.local ]; then
  echo "==> .env.local not found, copying .env.example"
  cp .env.example .env.local
  echo "    fill in .env.local before the app will run"
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "!! supabase CLI not found."
  echo "   install: https://supabase.com/docs/guides/local-development/cli/getting-started"
  exit 1
fi

case "$MODE" in
  local)
    if ! docker info >/dev/null 2>&1; then
      echo "!! Docker is not running — local Supabase needs it."
      echo "   Start Docker Desktop, or run './init.sh hosted' against a hosted project."
      exit 1
    fi
    echo "==> starting local Supabase"
    supabase start
    echo "==> applying migrations and seed"
    supabase db reset      # runs supabase/migrations/* then supabase/seed.sql
    echo
    echo "    Local API URL and anon key are printed above — copy them into .env.local"
    ;;
  hosted)
    echo "==> pushing migrations to the linked project"
    supabase db push
    echo "==> seeding"
    psql "${SUPABASE_DB_URL:?set SUPABASE_DB_URL to the project connection string}" -f supabase/seed.sql
    ;;
  *)
    echo "usage: ./init.sh [local|hosted]"
    exit 1
    ;;
esac

echo "==> running unit tests"
npm test

echo "==> starting dev server on http://localhost:3000"
npm run dev
