# Shared helpers for testnet scripts (sourced). Testnet only: refuses anything else.
NEAR=${NEAR:-$HOME/.cargo/bin/near}
NETCFG=${NETCFG:-testnet-fastnear}
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DEPLOY_JSON="$ROOT/deploy/testnet.json"
mkdir -p "$ROOT/deploy"

view() { # contract method json
  "$NEAR" contract call-function as-read-only "$1" "$2" json-args "${3:-{\}}" network-config "$NETCFG" now 2>&1
}
call() { # signer contract method json gas deposit
  "$NEAR" contract call-function as-transaction "$2" "$3" json-args "${4:-{\}}" prepaid-gas "${5:-100 Tgas}" attached-deposit "${6:-0 NEAR}" sign-as "$1" network-config "$NETCFG" sign-with-legacy-keychain send 2>&1
}
account_exists() { # id
  curl -s -m 30 -X POST "${RPC:-https://test.rpc.fastnear.com}" -H 'content-type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"query\",\"params\":{\"request_type\":\"view_account\",\"finality\":\"final\",\"account_id\":\"$1\"}}" | grep -q '"amount"'
}
# Faucet-funded account. The helper returns 429 under load, so retry with a long back-off; success = the account exists.
create_account() { # id
  for i in $(seq 1 ${FAUCET_TRIES:-12}); do
    account_exists "$1" && return 0
    "$NEAR" account create-account sponsor-by-faucet-service "$1" autogenerate-new-keypair save-to-legacy-keychain network-config "$NETCFG" create >/dev/null 2>&1 || true
    account_exists "$1" && return 0
    echo "faucet not ready for $1 (try $i), waiting" >&2
    sleep ${FAUCET_WAIT:-60}
  done
  return 1
}
state_json() { # key from deploy json
  python3 -c "import json,sys;print(json.load(open('$DEPLOY_JSON'))['$1'])"
}
