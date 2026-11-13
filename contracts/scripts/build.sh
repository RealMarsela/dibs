#!/usr/bin/env bash
# Build all wasm for one network. Usage: scripts/build.sh sandbox|testnet|mainnet [usdc_account_id]
# Output: contracts/build/<net>/{bed,dibs,usdc_test,mock_outlayer}.wasm (wasm-opt -Oz).
set -euo pipefail
NET=${1:?network}
case "$NET" in
  sandbox) USDC=${2:-usdc.test.near} ;;
  testnet) USDC=${2:?testnet usdc account id} ;;
  mainnet) USDC=17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1 ;;
  *) echo "network?" >&2; exit 1 ;;
esac
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT="$ROOT/build/$NET"; mkdir -p "$OUT"
T=wasm32-unknown-unknown
OPT=(-Oz --converge --enable-bulk-memory --enable-sign-ext --enable-mutable-globals --enable-nontrapping-float-to-int --strip-debug --strip-producers)
cd "$ROOT"
DIBS_USDC=$USDC cargo build --release --target $T -p dibs-bed
wasm-opt "${OPT[@]}" target/$T/release/dibs_bed.wasm -o "$OUT/bed.wasm"
DIBS_BED_WASM="$OUT/bed.wasm" cargo build --release --target $T -p dibs
wasm-opt "${OPT[@]}" target/$T/release/dibs.wasm -o "$OUT/dibs.wasm"
if [ "$NET" != mainnet ]; then
  cargo build --release --target $T -p usdc-test -p mock-outlayer
  wasm-opt "${OPT[@]}" target/$T/release/usdc_test.wasm -o "$OUT/usdc_test.wasm"
  wasm-opt "${OPT[@]}" target/$T/release/mock_outlayer.wasm -o "$OUT/mock_outlayer.wasm"
fi
echo "usdc baked: $USDC"
ls -l "$OUT"
