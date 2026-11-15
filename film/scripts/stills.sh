#!/bin/bash
# Refresh the shared bundle if src/ or public/ changed (single "bundle" slot), then render stills from it (still slot).
cd "$(dirname "$0")/.." || exit 1
RENDER_POOL=bundle ${RENDER_SLOT:-env} node scripts/bundle.mjs >/dev/null || exit 1
RENDER_POOL=still exec ${RENDER_SLOT:-env} node scripts/stills.mjs "$@"
