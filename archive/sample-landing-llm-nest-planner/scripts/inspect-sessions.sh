#!/usr/bin/env bash
# Inspect stored planner sessions in local Postgres (landing debug).
# Usage:
#   ./scripts/inspect-sessions.sh           # list recent
#   ./scripts/inspect-sessions.sh <session> # full transcript + draft + sample
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="${LANDING_PG_CONTAINER:-vapi-studio-landing-postgres-1}"
DB_USER="${LANDING_PG_USER:-studio}"
DB_NAME="${LANDING_PG_DB:-landing}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Postgres container not running: $CONTAINER" >&2
  exit 1
fi

psql_d() {
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" "$@"
}

SESSION="${1:-}"

if [[ -z "$SESSION" ]]; then
  echo "== Recent planner sessions =="
  psql_d -c "
    SELECT
      left(\"sessionId\", 8) AS session,
      status,
      COALESCE(company, '') AS company,
      COALESCE(name, '') AS name,
      jsonb_array_length(COALESCE(messages, '[]'::jsonb)) AS turns,
      COALESCE((\"designDraft\"->>'correctionCount')::int, 0) AS fixes,
      \"updatedAt\"
    FROM leads
    ORDER BY \"updatedAt\" DESC
    LIMIT 20;
  "
  echo
  echo "Dump one: $0 <sessionId>"
  exit 0
fi

echo "== Session $SESSION =="
psql_d -c "
  SELECT id, status, name, email, company, \"createdAt\", \"updatedAt\",
         complexity, \"quoteHours\"
  FROM leads WHERE \"sessionId\" = '$SESSION';
"

echo
echo "== Messages =="
psql_d -At -c "
  SELECT jsonb_pretty(messages) FROM leads WHERE \"sessionId\" = '$SESSION';
"

echo
echo "== Draft (summary) =="
psql_d -At -c "
  SELECT jsonb_pretty(jsonb_build_object(
    'companyName', \"designDraft\"->'companyName',
    'companyDoes', \"designDraft\"->'companyDoes',
    'useCase', \"designDraft\"->'useCase',
    'desiredResult', \"designDraft\"->'desiredResult',
    'discoveryAnswers', \"designDraft\"->'discoveryAnswers',
    'discoveryComplete', \"designDraft\"->'discoveryComplete',
    'correctionCount', \"designDraft\"->'correctionCount',
    'funnels', \"designDraft\"->'funnels',
    'analyticsEvents', \"designDraft\"->'analyticsEvents',
    'offerHelp', \"designDraft\"->'offerHelp'
  ))
  FROM leads WHERE \"sessionId\" = '$SESSION';
"

echo
echo "== Sample conversation =="
psql_d -At -c "
  SELECT jsonb_pretty(\"designDraft\"->'sampleConversation')
  FROM leads WHERE \"sessionId\" = '$SESSION';
"
