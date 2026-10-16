"""Pack audio/w and audio/s into base64 JSON bundles under data/audio/ for the claude.ai artifact
(the artifact cannot hold thousands of separate files). The web build serves audio/ directly.
Run: python3 build_audio.py"""
import json, base64, os
from pathlib import Path
root = Path(__file__).parent
idx = json.load(open(root / "data/audio-index.json"))
have = set(idx["w"])
os.makedirs(root / "data/audio", exist_ok=True)
for L in range(1, 7):
    words = json.load(open(root / f"data/words-{L}.json"))
    codes = ["-".join("%x" % ord(c) for c in w[0]) for w in words]
    b = {c: base64.b64encode((root / f"audio/w/{c}.mp3").read_bytes()).decode() for c in codes if c in have}
    json.dump(b, open(root / f"data/audio/w{L}.json", "w"), separators=(",", ":"))
b = {s: base64.b64encode((root / f"audio/s/{s}.mp3").read_bytes()).decode() for s in idx["s"]}
json.dump(b, open(root / "data/audio/s.json", "w"), separators=(",", ":"))
print("bundles written")
