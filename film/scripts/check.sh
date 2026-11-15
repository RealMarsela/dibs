#!/bin/bash
# Typecheck through the machine-wide single "bundle" slot (keeps RAM down when many agents check at once).
cd "$(dirname "$0")/.." || exit 1
RENDER_POOL=bundle exec ${RENDER_SLOT:-env} npx tsc --noEmit "$@"
