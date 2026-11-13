#!/usr/bin/env bash
# Usage: ./build.sh testnet|mainnet   (testnet adds the fixture domain dibs-test.example; mainnet never does)
set -euo pipefail
cd "$(dirname "$0")"
case "${1:-}" in
  testnet) FEATURES="--features test-domain" ;;
  mainnet) FEATURES="" ;;
  *) echo "usage: $0 testnet|mainnet" >&2; exit 2 ;;
esac
cargo test --release
cargo build --target wasm32-wasip2 --release $FEATURES
OUT=target/wasm32-wasip2/release/dibs-verifier.wasm
cp "$OUT" "target/dibs-verifier-$1.wasm"
echo "wasm: target/dibs-verifier-$1.wasm  bytes: $(wc -c < "$OUT")  sha256: $(shasum -a 256 "$OUT" | cut -d' ' -f1)"
