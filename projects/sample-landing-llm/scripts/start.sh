#!/usr/bin/env bash
# One command: baked Nest app + Postgres (Docker/OrbStack) + ngrok.
# Usage: yarn start
# Project UUID comes from config/project.identity.json (seeded into DB on app boot).
set -euo pipefail

ROOT="$(CDPATH="" cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-9998}"
NGROK_API="${NGROK_API:-http://127.0.0.1:4040}"
IDENTITY_FILE="${ROOT}/config/project.identity.json"

if [[ ! -f "$IDENTITY_FILE" ]]; then
  echo "Missing ${IDENTITY_FILE}" >&2
  echo "Create a project with: yarn new-project (from the vapi-studio repo root)" >&2
  exit 1
fi

# Canonical identity — written once into project.identity.json; never uuidV4 at runtime.
read_identity() {
  python3 -c '
import json, pathlib, sys
d = json.loads(pathlib.Path("config/project.identity.json").read_text())
for key in ("id", "slug", "name"):
    if not str(d.get(key, "")).strip():
        sys.exit(f"project.identity.json missing {key}")
print(str(d["id"]).strip().lower())
print(str(d["slug"]).strip())
print(str(d["name"]).strip())
'
}
IDENTITY_LINES="$(read_identity)"
PROJECT_UUID="$(printf '%s\n' "$IDENTITY_LINES" | sed -n '1p')"
PROJECT_SLUG="$(printf '%s\n' "$IDENTITY_LINES" | sed -n '2p')"
PROJECT_NAME="$(printf '%s\n' "$IDENTITY_LINES" | sed -n '3p')"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok is required on PATH for yarn start." >&2
  echo "Install: https://ngrok.com/download" >&2
  exit 1
fi

bash "$ROOT/scripts/ensure-docker.sh"

if [[ ! -f .env ]]; then
  echo ">> No .env — copying .env.example (set OPENAI_API_KEY for ChatGPT Brain)"
  cp .env.example .env
fi

# Mirror UUID into .env for compose/operators (identity file remains source of truth).
PROJECT_UUID="$PROJECT_UUID" python3 -c '
import os
from pathlib import Path
uuid = os.environ["PROJECT_UUID"]
path = Path(".env")
lines = path.read_text().splitlines() if path.exists() else []
out, seen = [], False
for line in lines:
    if line.startswith("PROJECT_UUID="):
        out.append(f"PROJECT_UUID={uuid}")
        seen = True
    else:
        out.append(line)
if not seen:
    out.append(f"PROJECT_UUID={uuid}")
path.write_text("\n".join(out) + "\n")
'

echo ">> Project ${PROJECT_NAME} (${PROJECT_SLUG}) id=${PROJECT_UUID}"
echo ">> Starting baked stack (app + Postgres) on :${PORT}"
echo ">> App boot upserts this UUID into the projects table (create or exist)"
docker compose up -d --build postgres
echo ">> Waiting for Postgres"
for _ in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U studio -d sample_landing_llm >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker compose exec -T postgres pg_isready -U studio -d sample_landing_llm >/dev/null || {
  echo "Postgres failed to become ready" >&2
  exit 1
}
bash "$ROOT/scripts/ensure-project-id-column.sh"
docker compose up -d --build

echo ">> Waiting for health on http://localhost:${PORT}/health"
for _ in $(seq 1 90); do
  if curl -sf "http://localhost:${PORT}/health" >/dev/null; then
    echo ">> App is healthy (project row seeded from project.identity.json)"
    break
  fi
  sleep 1
done
curl -sf "http://localhost:${PORT}/health" >/dev/null || {
  echo "App failed to become healthy" >&2
  docker compose logs app --tail 60 >&2 || true
  exit 1
}

cleanup() {
  if [[ -n "${NGROK_PID:-}" ]] && kill -0 "$NGROK_PID" 2>/dev/null; then
    kill "$NGROK_PID" 2>/dev/null || true
    wait "$NGROK_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo ">> Starting ngrok http ${PORT}"
ngrok http "$PORT" --log=stdout &
NGROK_PID=$!

public_url=""
for _ in $(seq 1 40); do
  if ! kill -0 "$NGROK_PID" 2>/dev/null; then
    echo "ngrok exited early" >&2
    exit 1
  fi
  payload="$(curl -sf "${NGROK_API}/api/tunnels" 2>/dev/null || true)"
  if [[ -n "$payload" ]]; then
    public_url="$(
      printf '%s' "$payload" | python3 -c '
import json, sys
data = json.load(sys.stdin)
https = [t.get("public_url") for t in data.get("tunnels", []) if str(t.get("public_url", "")).startswith("https://")]
print(https[0] if https else "")
'
    )"
    if [[ -n "$public_url" ]]; then
      break
    fi
  fi
  sleep 0.5
done

upsert_public_base_url() {
  local url="$1"
  PUBLIC_URL="$url" python3 -c '
import os
from pathlib import Path
url = os.environ["PUBLIC_URL"]
path = Path(".env")
lines = path.read_text().splitlines()
found = False
out = []
for line in lines:
    if line.startswith("PUBLIC_BASE_URL="):
        out.append(f"PUBLIC_BASE_URL={url}")
        found = True
    else:
        out.append(line)
if not found:
    out.append(f"PUBLIC_BASE_URL={url}")
path.write_text("\n".join(out) + "\n")
'
}

echo
if [[ -z "$public_url" ]]; then
  echo ">> Could not read ngrok public URL from ${NGROK_API}; tunnel may still be up."
  echo ">> Set PUBLIC_BASE_URL manually in .env when you see the https URL."
  echo
  echo "App:                  http://localhost:${PORT}"
  echo "Flow Studio:          http://localhost:${PORT}/flow"
  echo "Forms inbox (local):  http://localhost:${PORT}/forms/inbox"
  echo
else
  echo ">> ngrok public URL: ${public_url}"
  upsert_public_base_url "$public_url"
  echo ">> Updated .env PUBLIC_BASE_URL and recreating app container"
  PUBLIC_BASE_URL="$public_url" docker compose up -d app
  echo
  echo "Project:                ${PROJECT_NAME} (${PROJECT_SLUG})"
  echo "Project UUID:           ${PROJECT_UUID}"
  echo "Local app:              http://localhost:${PORT}"
  echo "Webhook (Vapi):         ${public_url}/${PROJECT_UUID}/vapi/webhook"
  echo "Custom LLM (Vapi):      ${public_url}/${PROJECT_UUID}/vapi/chat/completions"
  echo "Flow Studio:            http://localhost:${PORT}/flow"
  echo "Analytics:              http://localhost:${PORT}/analytics"
  echo "ngrok inspector:        http://127.0.0.1:4040"
  echo
  echo "Paste Custom LLM + Server URL into your Vapi assistant, then give this chat"
  echo "VAPI_API_KEY + POC_ASSISTANT_ID (+ VAPI_PHONE_NUMBER_ID) for outbound Call me."
  echo
fi

echo ">> ngrok is running (Ctrl+C stops ngrok; Docker stack keeps running — yarn stop)"
wait "$NGROK_PID"
