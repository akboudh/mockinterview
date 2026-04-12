#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3100}"
BASE_URL="${BASE_URL:-http://127.0.0.1:${PORT}}"
LOG_DIR="$(mktemp -d)"
SERVER_LOG="${LOG_DIR}/next-start.log"
FLOW_LOG="${LOG_DIR}/sample-curl.log"
SERVER_PID=""

cleanup() {
  local status=$?

  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true

    for _ in {1..10}; do
      if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
        break
      fi
      sleep 1
    done

    if kill -0 "${SERVER_PID}" 2>/dev/null; then
      kill -9 "${SERVER_PID}" 2>/dev/null || true
    fi

    wait "${SERVER_PID}" 2>/dev/null || true
  fi

  if [[ ${status} -ne 0 ]]; then
    if [[ -f "${SERVER_LOG}" ]]; then
      echo
      echo "next start log:" >&2
      cat "${SERVER_LOG}" >&2
    fi

    if [[ -f "${FLOW_LOG}" ]]; then
      echo
      echo "sample curl log:" >&2
      cat "${FLOW_LOG}" >&2
    fi
  fi

  rm -rf "${LOG_DIR}"
}

trap cleanup EXIT

cd "${ROOT_DIR}"

rm -rf .next
npm run build

"${ROOT_DIR}/node_modules/.bin/next" start --hostname 127.0.0.1 --port "${PORT}" >"${SERVER_LOG}" 2>&1 &
SERVER_PID=$!

READY=0
for _ in {1..60}; do
  if curl -fsS "${BASE_URL}/login" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [[ "${READY}" -ne 1 ]]; then
  echo "Production server did not become ready at ${BASE_URL}." >&2
  exit 1
fi

BASE_URL="${BASE_URL}" bash scripts/sample-curl.sh >"${FLOW_LOG}"
cat "${FLOW_LOG}"
