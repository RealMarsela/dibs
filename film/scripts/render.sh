#!/bin/bash
# Full render from the shared bundle (out/bundle; re-bundled only when src/ or public/ changed), one render at a time
# machine-wide, concurrency 4; then master and captions.  Usage: scripts/render.sh v1
set -euo pipefail
cd "$(dirname "$0")/.."
v="${1:?version, e.g. v1}"
~/.agents/bin/disk-check
mkdir -p out
python3 -I scripts/footage-ready.py >/dev/null
RENDER_POOL=bundle ~/Documents/hackathons/_demo-films/render-slot.sh node scripts/bundle.mjs
RENDER_POOL=heavy ~/Documents/hackathons/_demo-films/render-slot.sh \
  npx remotion render out/bundle Film "out/raw-$v.mp4" --concurrency=4 --color-space=bt709 --crf=18 --audio-codec=aac --log=warn
scripts/master.sh "out/raw-$v.mp4" "out/dibs-film-$v.mp4"
python3 -I scripts/srt.py "out/dibs-film-$v.srt"
