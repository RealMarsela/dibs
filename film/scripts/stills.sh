#!/bin/bash
# Refresh the shared bundle if src/ or public/ changed (single "bundle" slot), then render stills from it (still slot).
cd "$(dirname "$0")/.." || exit 1
RENDER_POOL=bundle ~/Documents/hackathons/_demo-films/render-slot.sh node scripts/bundle.mjs >/dev/null || exit 1
RENDER_POOL=still exec ~/Documents/hackathons/_demo-films/render-slot.sh node scripts/stills.mjs "$@"
