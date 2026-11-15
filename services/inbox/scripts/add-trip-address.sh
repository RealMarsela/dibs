#!/usr/bin/env bash
# Add the literal routing rule <trip>@dibs.larinova.com -> Worker dibs-inbox (Cloudflare documents catch-all as apex-only,
# so each trip address gets its own rule). Needs CLOUDFLARE_API_TOKEN (Email Routing edit); load it with
#   export CLOUDFLARE_API_TOKEN from your secret store first
# Usage: scripts/add-trip-address.sh lis0312 [more codes...]
set -euo pipefail
ZONE=${CF_ZONE_ID:-bbaaf33c5998f5ebb76ea82164662d98}   # larinova.com
DOMAIN=${MAIL_DOMAIN:-dibs.larinova.com}
: "${CLOUDFLARE_API_TOKEN:?load CLOUDFLARE_API_TOKEN first}"
api=https://api.cloudflare.com/client/v4/zones/$ZONE/email/routing/rules
for trip in "$@"; do
  [[ $trip =~ ^[a-z0-9]{3,12}$ ]] || { echo "bad trip code: $trip" >&2; exit 2; }
  addr="$trip@$DOMAIN"
  curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" -X POST "$api" \
    -d "{\"name\":\"dibs trip $trip\",\"enabled\":true,\"matchers\":[{\"type\":\"literal\",\"field\":\"to\",\"value\":\"$addr\"}],\"actions\":[{\"type\":\"worker\",\"value\":[\"dibs-inbox\"]}]}" \
    | python3 -c "import json,sys;d=json.load(sys.stdin);print('$addr', 'ok' if d['success'] else d['errors'])"
done
