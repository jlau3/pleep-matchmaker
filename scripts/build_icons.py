#!/usr/bin/env python3
"""
Replace public/sprites/*.webp with the in-game Pokémon Sleep icons from
Serebii. Run after build_lines.py; any sprite without a Serebii icon keeps
the PokeAPI artwork build_lines.py downloaded.

    python3 scripts/build_icons.py
"""
import io
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

BASE = "https://www.serebii.net/pokemonsleep/pokemon/icon/{}.png"
ROOT = Path(__file__).resolve().parent.parent
LINES_JSON = ROOT / "src" / "data" / "candy-lines.json"
OUT = ROOT / "public" / "sprites"
SIZE = 128

# Sprite ids (PokeAPI form ids, or dex numbers) whose Serebii file name isn't
# just the zero-padded dex number.
FORM_ICONS = {
    10103: "037-alolanvulpix",
    10104: "038-alolanninetales",
    10253: "194-paldeanwooper",
    849: "849-toxtricityampedform",
}


def fetch(url: str) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": "pleep-matchmaker data build"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def main() -> int:
    lines = json.loads(LINES_JSON.read_text())
    sprites = sorted({m["sprite"] for line in lines for m in line["members"]})
    missing = []
    for sprite in sprites:
        name = FORM_ICONS.get(sprite, f"{sprite:03d}")
        data = fetch(BASE.format(name))
        if data is None:
            missing.append(sprite)
            continue
        img = Image.open(io.BytesIO(data)).convert("RGBA")
        img.thumbnail((SIZE, SIZE), Image.LANCZOS)
        img.save(OUT / f"{sprite}.webp", "WEBP", quality=88, method=6)
        time.sleep(0.2)
    print(f"{len(sprites) - len(missing)} icons from Serebii, {len(missing)} kept as PokeAPI art: {missing}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
