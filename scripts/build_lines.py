#!/usr/bin/env python3
"""
Build src/data/candy-lines.json and public/sprites/*.webp from community data.

Source roster: nitoyon/pokesleep-tool (MIT), src/data/pokemon.json
Sprites:       PokeAPI official artwork, downscaled to webp

Every form (event costumes, regional variants, Pumpkaboo sizes, Toxtricity
forms) shares candy with its base species, so a candy line is one evolution
family. Re-run this whenever the game adds Pokémon:

    pip install pillow
    python3 scripts/build_lines.py
"""
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

from PIL import Image

SOURCE_URL = "https://raw.githubusercontent.com/nitoyon/pokesleep-tool/main/src/data/pokemon.json"
SPRITE_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{}.png"
SPRITE_SIZE = 128

ROOT = Path(__file__).resolve().parent.parent
OUT_JSON = ROOT / "src" / "data" / "candy-lines.json"
OUT_SPRITES = ROOT / "public" / "sprites"

# Forms that look different enough to get their own member entry and sprite.
# Everything else (event costumes, sizes) collapses into the base species.
REGIONAL_FORMS = {"Alola", "Paldea"}

# (dex id, form) -> PokeAPI sprite id for forms that have their own artwork.
FORM_SPRITES = {
    (37, "Alola"): 10103,   # Alolan Vulpix
    (38, "Alola"): 10104,   # Alolan Ninetales
    (194, "Paldea"): 10253, # Paldean Wooper
}


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=30) as resp:
        return resp.read()


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower().replace("'", "")).strip("-")


def base_name(name: str) -> str:
    """'Pumpkaboo (Small)' -> 'Pumpkaboo'."""
    return re.sub(r"\s*\(.*\)$", "", name)


def main() -> int:
    roster = json.loads(fetch(SOURCE_URL))

    # Candy line of each base (form-less) species, keyed by dex id.
    line_of_id = {p["id"]: p["ancestor"] or p["id"] for p in roster if not p.get("form")}

    lines: dict[int, list[dict]] = {}
    for p in roster:
        key = line_of_id.get(p["id"]) or p["ancestor"] or p["id"]
        lines.setdefault(key, []).append(p)

    out = []
    sprite_ids = set()
    for members in lines.values():
        # Name the line after its lowest dex number: candy is "Pikachu", not "Pichu".
        rep = min((p for p in members if not p.get("form")), key=lambda p: p["id"], default=members[0])
        seen = set()
        line_members = []
        ordered = sorted(members, key=lambda p: (-p["evolutionLeft"], p["evolutionCount"], bool(p.get("form")), p["id"]))
        for p in ordered:
            form = p.get("form") if p.get("form") in REGIONAL_FORMS else None
            key = (p["id"], form)
            if key in seen:
                continue
            seen.add(key)
            sprite = FORM_SPRITES.get(key, p["id"])
            sprite_ids.add(sprite)
            line_members.append({
                "name": p["name"] if form else base_name(p["name"]),
                "dex": p["id"],
                "sprite": sprite,
            })
        out.append({
            "id": slugify(base_name(rep["name"])),
            "name": base_name(rep["name"]),
            "dex": rep["id"],
            "type": rep["type"],
            "addedAt": min(p["arrival"] for p in members),
            "members": line_members,
        })

    out.sort(key=lambda line: line["dex"])
    ids = [line["id"] for line in out]
    if len(ids) != len(set(ids)):
        print("duplicate line ids", file=sys.stderr)
        return 1

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(out)} lines, {sum(len(l['members']) for l in out)} members -> {OUT_JSON.relative_to(ROOT)}")

    OUT_SPRITES.mkdir(parents=True, exist_ok=True)
    fetched = 0
    for sprite in sorted(sprite_ids):
        dest = OUT_SPRITES / f"{sprite}.webp"
        if dest.exists():
            continue
        img = Image.open(io.BytesIO(fetch(SPRITE_URL.format(sprite)))).convert("RGBA")
        img.thumbnail((SPRITE_SIZE, SPRITE_SIZE), Image.LANCZOS)
        img.save(dest, "WEBP", quality=85, method=6)
        fetched += 1
    print(f"fetched {fetched} new sprites ({len(sprite_ids)} total) -> {OUT_SPRITES.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
