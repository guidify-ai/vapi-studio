#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo ">> Mocked tests only (no Postgres, no ChatGPT, no real secrets)"
docker compose --profile test run --rm test

echo ">> ALL TEST SUITES PASSED"
