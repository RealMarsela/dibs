#!/usr/bin/env bash
# Deploy usdc (test NEP-141) and dibs to NEAR testnet. Testnet only, faucet-funded accounts.
# Usage: scripts/deploy-testnet.sh [rand-suffix]    Re-run safe: reuses contracts/deploy/testnet.json when present.
# Optional env: VERIFIER_KEY_HEX (32-byte ed25519 pubkey, hex), OUTLAYER (default outlayer.testnet),
#               PROJECT_ID (default dibs-owner.testnet/dibs-verifier)
set -euo pipefail
. "$(dirname "$0")/near-lib.sh"
R=${1:-$(( RANDOM % 90000 + 10000 ))}
DIBS=dibs-$R.testnet
USDC=usdc-$R.testnet
OUTLAYER=${OUTLAYER:-outlayer.testnet}
PROJECT_ID=${PROJECT_ID:-dibs-owner.testnet/dibs-verifier}
if [ -f "$DEPLOY_JSON" ]; then echo "already deployed: $(cat "$DEPLOY_JSON")"; exit 0; fi

"$ROOT/scripts/build.sh" testnet "$USDC"
B="$ROOT/build/testnet"
create_account "$USDC"
create_account "$DIBS"

"$NEAR" contract deploy "$USDC" use-file "$B/usdc_test.wasm" with-init-call new json-args '{}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' network-config "$NETCFG" sign-with-legacy-keychain send
DOMAINS='["booking.com","airbnb.com","hostelworld.com","dibs-test.example"]'
INIT=$(printf '{"owner":"%s","usdc":"%s","outlayer":"%s","project_id":"%s","domains":%s,"run_fee":"3000000000000000000000"}' "$DIBS" "$USDC" "$OUTLAYER" "$PROJECT_ID" "$DOMAINS")
"$NEAR" contract deploy "$DIBS" use-file "$B/dibs.wasm" with-init-call new json-args "$INIT" prepaid-gas '30 Tgas' attached-deposit '0 NEAR' network-config "$NETCFG" sign-with-legacy-keychain send
# dibs receives USDC (resale and waitlist funds), so it must be registered
call "$DIBS" "$USDC" storage_deposit "{\"account_id\":\"$DIBS\",\"registration_only\":true}" "30 Tgas" "0.01 NEAR"
if [ -n "${VERIFIER_KEY_HEX:-}" ]; then call "$DIBS" "$DIBS" set_verifier_key "{\"key_hex\":\"$VERIFIER_KEY_HEX\"}" "30 Tgas"; fi

python3 - "$DEPLOY_JSON" "$DIBS" "$USDC" "$OUTLAYER" "$PROJECT_ID" <<'PY'
import hashlib, json, sys
p, dibs, usdc, ol, proj = sys.argv[1:6]
root = p.rsplit("/deploy/", 1)[0]
sha = lambda f: hashlib.sha256(open(f"{root}/build/testnet/{f}", "rb").read()).hexdigest()
json.dump({"network": "testnet", "dibs": dibs, "usdc": usdc, "outlayer": ol, "project_id": proj,
           "dibs_wasm_sha256": sha("dibs.wasm"), "bed_wasm_sha256": sha("bed.wasm"), "usdc_wasm_sha256": sha("usdc_test.wasm")},
          open(p, "w"), indent=2)
open(p, "a").write("\n")
PY
cat "$DEPLOY_JSON"
