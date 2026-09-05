#!/usr/bin/env bash
# Ensure a Docker-compatible engine is running. Prefer OrbStack (lower RAM)
# over Docker Desktop — same `docker` / Compose CLI either way.
set -euo pipefail

if docker info >/dev/null 2>&1; then
  echo ">> Docker engine OK ($(docker context show 2>/dev/null || echo default))"
  exit 0
fi

if [[ -d /Applications/OrbStack.app ]]; then
  echo ">> Starting OrbStack…"
  open /Applications/OrbStack.app || true
elif [[ -d /Applications/Docker.app ]]; then
  echo ">> Starting Docker Desktop…"
  open -a Docker || open /Applications/Docker.app || true
else
  echo "No container engine found." >&2
  echo "Install OrbStack (arm64): yarn orbstack:install" >&2
  echo "  or https://orbstack.dev/download" >&2
  exit 1
fi

echo ">> Waiting for docker…"
for _ in $(seq 1 120); do
  if docker info >/dev/null 2>&1; then
    echo ">> Docker is ready ($(docker context show 2>/dev/null || echo default))"
    exit 0
  fi
  sleep 1
done

echo "Docker engine did not become ready." >&2
echo "If OrbStack says Rosetta: install the arm64 build (yarn orbstack:install)." >&2
exit 1
