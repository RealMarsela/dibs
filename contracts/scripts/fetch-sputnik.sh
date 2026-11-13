#!/usr/bin/env bash
# Fetch the Sputnik DAO v2 wasm from a live testnet DAO (read-only RPC call) into contracts/vendor/.
# The wasm is large (470 KB) and not committed.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$ROOT/vendor"
[ -s "$ROOT/vendor/sputnik_dao.wasm" ] && { echo "already present"; exit 0; }
for i in 1 2 3 4 5 6; do
  curl -s -m 60 -X POST https://rpc.testnet.fastnear.com -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"view_code","finality":"final","account_id":"testdao.sputnik-v2.testnet"}}' > "$ROOT/vendor/.code.json"
  grep -q code_base64 "$ROOT/vendor/.code.json" && break
  sleep 5
done
python3 - "$ROOT/vendor" <<'PY'
import base64, json, sys
d = sys.argv[1]
r = json.load(open(d + "/.code.json"))["result"]
open(d + "/sputnik_dao.wasm", "wb").write(base64.b64decode(r["code_base64"]))
print("sputnik code hash", r["hash"])
PY
rm -f "$ROOT/vendor/.code.json"
