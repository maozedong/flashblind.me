#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: send-telegram.sh \"message\"" >&2
  exit 1
fi

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  if [[ -f /opt/flashblind/.env ]]; then
    set -a
    # shellcheck disable=SC1091
    source /opt/flashblind/.env
    set +a
  fi
fi

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID" >&2
  exit 1
fi

text="$*"

curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\":\"${TELEGRAM_CHAT_ID}\",\"text\":\"${text//\"/\\\"}\"}" \
  | cat
