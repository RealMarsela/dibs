#!/usr/bin/env bash
# Seed the Lisbon trip on testnet: a Sputnik DAO (role `trip` = dibs only) and an 8-bed trip.
# Usage: PRICE=250000 scripts/seed-lisbon.sh      (price in USDC base units, 6 decimals: 250000 = 0.25, 40000000 = 40 for UI preview)
# Env: TRIP (lis0312) BEDS (8) WAIT (2) CHECK_IN (2027-03-12) CHECK_OUT (2027-03-15) STAY BOOKER (default: dibs owner)
#      BOOK_DAYS (7) DAO_DEPOSIT ("6 NEAR", Sputnik factory minimum) SEED_HOLDERS (comma list of accounts to hold beds 1..n)
set -euo pipefail
. "$(dirname "$0")/near-lib.sh"
DIBS=$(state_json dibs); USDC=$(state_json usdc)
TRIP=${TRIP:-lis0312}; BEDS=${BEDS:-8}; WAIT=${WAIT:-2}; PRICE=${PRICE:-250000}
CHECK_IN=${CHECK_IN:-2027-03-12}; CHECK_OUT=${CHECK_OUT:-2027-03-15}; STAY=${STAY:-Casa do Largo, Lisbon}
BOOKER=${BOOKER:-$DIBS}; BOOK_DAYS=${BOOK_DAYS:-7}; DAO_DEPOSIT=${DAO_DEPOSIT:-6 NEAR}
DAO_NAME=${DAO_NAME:-$TRIP-$(echo "$DIBS" | tr -dc '0-9')}
DAO=$DAO_NAME.sputnik-v2.testnet

if ! account_exists "$DAO"; then
  ARGS=$(python3 - "$ROOT/scripts/dao-policy.json" "$DIBS" "$BOOKER" "$DAO_NAME" <<'PY'
import base64, json, sys
tpl, dibs, booker, name = sys.argv[1:5]
policy = json.loads(open(tpl).read().replace("__DIBS__", dibs).replace("__CREW__", json.dumps(booker)))
inner = {"config": {"name": name, "purpose": "Dibs trip pot: moves only on a verified booking or a deadline refund", "metadata": ""}, "policy": policy}
print(json.dumps({"name": name, "args": base64.b64encode(json.dumps(inner).encode()).decode()}))
PY
)
  call "$DIBS" sputnik-v2.testnet create "$ARGS" "150 Tgas" "$DAO_DEPOSIT"
  account_exists "$DAO" || { echo "DAO $DAO was not created" >&2; exit 1; }
fi

COST=$(view "$DIBS" create_cost "{\"n_beds\":$BEDS,\"n_wait\":$WAIT}" | grep -oE "'?[0-9]{15,}'?" | head -1 | tr -d "'")
BOOK_BY=$(python3 -c "import time;print(int((time.time()+$BOOK_DAYS*86400)*1e9))")
DEPOSIT=$(python3 -c "print(f'{($COST+2*10**21)/1e24:.6f} NEAR')")
ARGS=$(python3 - "$TRIP" "$PRICE" "$BEDS" "$WAIT" "$BOOK_BY" "$BOOKER" "$DAO" "$CHECK_IN" "$CHECK_OUT" "$STAY" <<'PY'
import json, sys
c, price, n, w, by, booker, dao, ci, co, stay = sys.argv[1:11]
print(json.dumps({"code": c, "price": price, "n_beds": int(n), "n_wait": int(w), "book_by": by, "booker": booker, "dao": dao, "check_in": ci, "check_out": co, "stay": stay}))
PY
)
call "$DIBS" "$DIBS" create_trip "$ARGS" "300 Tgas" "$DEPOSIT"

if [ -n "${SEED_HOLDERS:-}" ]; then
  i=1
  for h in ${SEED_HOLDERS//,/ }; do
    call "$DIBS" "$DIBS" hold "{\"trip\":\"$TRIP\",\"n\":$i,\"holder\":\"$h\"}" "60 Tgas"
    i=$((i+1))
  done
fi
python3 - "$DEPLOY_JSON" "$TRIP" "$DAO" "$PRICE" "$BEDS" "$WAIT" "$BOOKER" <<'PY'
import json, sys
p, trip, dao, price, n, w, booker = sys.argv[1:8]
d = json.load(open(p))
d.setdefault("trips", {})[trip] = {"dao": dao, "price": price, "n_beds": int(n), "n_wait": int(w), "booker": booker,
    "bed_accounts": [f"b{i:02d}-{trip}.{d['dibs']}" for i in range(1, int(n) + 1)],
    "wait_accounts": [f"w{i:02d}-{trip}.{d['dibs']}" for i in range(1, int(w) + 1)]}
json.dump(d, open(p, "w"), indent=2); open(p, "a").write("\n")
PY
view "$DIBS" get_trip "{\"trip\":\"$TRIP\"}" | head -40
