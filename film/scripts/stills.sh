#!/bin/bash
# Machine-wide still slot (2 at a time across all sessions), then render.
cd "$(dirname "$0")/.." || exit 1
RENDER_POOL=still exec ~/Documents/hackathons/_demo-films/render-slot.sh node scripts/stills.mjs "$@"
