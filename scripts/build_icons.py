#!/usr/bin/env python3
"""
Replace public/sprites/*.webp with the in-game Pokémon Sleep icons from
Serebii. Run after build_lines.py; any sprite without a Serebii icon keeps
the PokeAPI artwork build_lines.py downloaded.

scripts/icons-state.json records which sprites have been checked and which
are still on PokeAPI art, so the daily job can skip everything else:

    python3 scripts/build_icons.py                 # every sprite
    python3 scripts/build_icons.py --missing-only  # new sprites + ones still without a Serebii icon
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
STATE_JSON = Path(__file__).resolve().parent / "icons-state.json"
SIZE = 128

# Sprite ids (PokeAPI form ids, or dex numbers) whose Serebii file name isn't
# just the zero-padded dex number.
FORM_ICONS = {
    10103: "037-alolanvulpix",
    10104: "038-alolanninetales",
    10253: "194-paldeanwooper",
    849: "849-toxtricityampedform",
}


def icon_name(sprite: int | str) -> str:
    """Serebii file name: 25 -> '025', event costume '25-holiday' -> '025-holiday'."""
    if isinstance(sprite, str):
        dex, _, form = sprite.partition("-")
        return f"{int(dex):03d}-{form}"
    return f"{sprite:03d}"


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
    all_sprites = sorted({m["sprite"] for line in lines for m in line["members"]}, key=str)
    state = json.loads(STATE_JSON.read_text()) if STATE_JSON.exists() else {"checked": [], "missing": []}
    sprites = all_sprites
    if "--missing-only" in sys.argv:
        checked, still = set(state["checked"]), set(state["missing"])
        sprites = [s for s in all_sprites if s not in checked or s in still]
    missing = []
    for sprite in sprites:
        name = FORM_ICONS.get(sprite) or icon_name(sprite)
        data = fetch(BASE.format(name))
        if data is None:
            missing.append(sprite)
            continue
        img = Image.open(io.BytesIO(data)).convert("RGBA")
        img.thumbnail((SIZE, SIZE), Image.LANCZOS)
        img.save(OUT / f"{sprite}.webp", "WEBP", quality=88, method=6)
        time.sleep(0.2)
    print(f"{len(sprites) - len(missing)} icons from Serebii, {len(missing)} kept as PokeAPI art: {missing}")
    fetched_now = set(sprites)
    state = {
        "checked": sorted(set(state["checked"]) | fetched_now, key=str),
        "missing": sorted((set(state["missing"]) - fetched_now) | set(missing), key=str),
    }
    STATE_JSON.write_text(json.dumps(state) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
