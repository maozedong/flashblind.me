#!/usr/bin/env bash
set -euo pipefail

if [[ -f /opt/flashblind/.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /opt/flashblind/.env
  set +a
fi

report=$(bun /opt/flashblind/scripts/weekly-report.mjs)

bun /opt/flashblind/scripts/telegram-send.mjs "$report"
