#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

SIGNING_SECRET="${SLACK_SIGNING_SECRET:-}"
if [ -z "$SIGNING_SECRET" ]; then
  echo "Missing SLACK_SIGNING_SECRET in $ENV_FILE or environment" >&2
  exit 1
fi

TS=$(date +%s)
BODY='{"type":"event_callback","team_id":"T096DPPTGEM","event":{"type":"app_mention","channel":"C0AG074FSGJ","user":"U999","text":"<@U_BOT> make a simple bar chart showing number of flights by carrier","ts":"1772570711.550959"}}'
BASE="v0:$TS:$BODY"
SIG="v0=$(printf '%s' "$BASE" | openssl dgst -sha256 -hmac "$SIGNING_SECRET" -hex | sed 's/^.* //')"
curl -i "http://localhost:4016/_api/slack/events" \
  -H "content-type: application/json" \
  -H "X-Slack-Request-Timestamp: $TS" \
  -H "X-Slack-Signature: $SIG" \
  --data "$BODY"
