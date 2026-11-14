#!/usr/bin/env python3
"""Generate narration lines with ElevenLabs (with-timestamps) and save audio + word timings.
Usage: python3 -I scripts/voice.py [LINE_ID ...] [--force]
Skips lines that already have audio unless --force. Records every billed character in voice/usage.json.
Hard budget: refuses to send when total billed characters would exceed 4000."""
import base64, json, os, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUDGET = 4000

def env_key():
    for line in open(os.path.join(ROOT, ".env.local")):
        if line.startswith("ELEVENLABS_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("no key")

def words_from_alignment(al, text_offset):
    chars, st, en = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
    words, cur, s0, e0, inside_tag = [], "", None, None, False
    for i, c in enumerate(chars):
        if i < text_offset:
            continue
        if c == "[":
            inside_tag = True
        if inside_tag:
            if c == "]":
                inside_tag = False
            continue
        if c.isspace():
            if cur:
                words.append({"w": cur, "s": round(s0, 3), "e": round(e0, 3)})
            cur, s0 = "", None
            continue
        if s0 is None:
            s0 = st[i]
        cur += c
        e0 = en[i]
    if cur:
        words.append({"w": cur, "s": round(s0, 3), "e": round(e0, 3)})
    return words

def main():
    cfg = json.load(open(os.path.join(ROOT, "voice/lines.json")))
    usage_p = os.path.join(ROOT, "voice/usage.json")
    usage = json.load(open(usage_p)) if os.path.exists(usage_p) else {"billed_chars": 0, "calls": []}
    want = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    key = env_key()
    lines = cfg["lines"]
    for idx, ln in enumerate(lines):
        if want and ln["id"] not in want:
            continue
        mp3 = os.path.join(ROOT, f"public/audio/vo/{ln['id']}.mp3")
        if os.path.exists(mp3) and not force:
            print("skip", ln["id"]); continue
        text = f"{cfg['tag']} {ln['text']}" if cfg.get("tag") else ln["text"]
        if usage["billed_chars"] + len(text) > BUDGET:
            raise SystemExit(f"budget: {usage['billed_chars']} + {len(text)} > {BUDGET}")
        body = {"text": text, "model_id": cfg["model_id"], "voice_settings": cfg["voice_settings"], "seed": cfg["seed"]}
        ok = lambda o: o.get("variant") in (None, ln.get("variant"))  # neighbours from the same variant path
        prev = [o for o in lines[:idx] if ok(o)]
        nxt = [o for o in lines[idx + 1:] if ok(o)]
        if prev: body["previous_text"] = prev[-1]["text"]
        if nxt: body["next_text"] = nxt[0]["text"]
        if os.environ.get("NO_CONTEXT"): body.pop("previous_text", None); body.pop("next_text", None)
        req = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{cfg['voice_id']}/with-timestamps?output_format=mp3_44100_192",
            data=json.dumps(body).encode(), headers={"xi-api-key": key, "content-type": "application/json"})
        try:
            r = urllib.request.urlopen(req, timeout=180)
        except urllib.error.HTTPError as e:
            print("HTTP", e.code, e.read()[:500].decode(errors="ignore")); raise SystemExit(1)
        cost = r.headers.get("character-cost") or r.headers.get("x-character-count")
        data = json.loads(r.read())
        open(mp3, "wb").write(base64.b64decode(data["audio_base64"]))
        al = data.get("alignment") or data.get("normalized_alignment")
        json.dump(data.get("alignment"), open(os.path.join(ROOT, f"voice/raw/{ln['id']}.alignment.json"), "w"))
        words = words_from_alignment(al, 0)
        json.dump({"id": ln["id"], "text": ln["text"], "words": words, "duration": words[-1]["e"] if words else 0},
                  open(os.path.join(ROOT, f"voice/timings/{ln['id']}.json"), "w"), indent=1)
        billed = len(text)  # count characters sent (conservative); header kept in calls[]
        usage["billed_chars"] += billed
        usage["calls"].append({"id": ln["id"], "chars_sent": len(text), "billed": billed, "header": cost, "model": cfg["model_id"]})
        json.dump(usage, open(usage_p, "w"), indent=1)
        print(ln["id"], "ok", len(words), "words", words[-1]["e"] if words else 0, "s; billed", billed, "total", usage["billed_chars"])

main()
