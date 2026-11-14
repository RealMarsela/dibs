#!/bin/bash
# Master a rendered film: two-pass loudnorm to -14 LUFS integrated, true peak <= -1 dBTP, AAC 48 kHz; video stream copied.
# Usage: scripts/master.sh <rendered.mp4> <out.mp4>
set -euo pipefail
in="$1"; out="$2"
j=$(ffmpeg -hide_banner -nostats -i "$in" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g(){ echo "$j" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -hide_banner -loglevel error -y -i "$in" \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" \
  -c:v copy -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$out"
echo "mastered: $out"
ffmpeg -hide_banner -nostats -i "$out" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|LRA|Peak):" | tr -s ' '
