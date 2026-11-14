#!/bin/bash
# Full render (one at a time machine-wide, concurrency 4), then master and QA.  Usage: scripts/render.sh v1
set -euo pipefail
cd "$(dirname "$0")/.."
v="${1:?version, e.g. v1}"
~/.agents/bin/disk-check
mkdir -p out
RENDER_POOL=heavy ~/Documents/hackathons/_demo-films/render-slot.sh \
  npx remotion render src/index.ts Film "out/raw-$v.mp4" --concurrency=4 --color-space=bt709 --crf=18 --audio-codec=aac --log=warn
scripts/master.sh "out/raw-$v.mp4" "out/dibs-film-$v.mp4"
python3 -I scripts/srt.py "out/dibs-film-$v.srt"
