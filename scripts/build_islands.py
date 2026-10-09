#!/usr/bin/env python3
"""
Build src/data/islands.json from Serebii's Pokémon Sleep location pages.

Each island page has a "List of all Pokémon Available" table. Every species
there is mapped to its candy line via src/data/candy-lines.json (regional and
event forms fold into the base line). Run build_lines.py first when the game
adds Pokémon, then:

    python3 scripts/build_islands.py
"""
import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

BASE = "https://www.serebii.net/pokemonsleep/locations/{}.shtml"
ROOT = Path(__file__).resolve().parent.parent
LINES_JSON = ROOT / "src" / "data" / "candy-lines.json"
OUT = ROOT / "src" / "data" / "islands.json"

# (our id, display name, Serebii page slug)
ISLANDS = [
    ("greengrass-isle", "Greengrass Isle", "greengrassisle"),
    ("greengrass-isle-expert", "Greengrass Isle (Expert)", "greengrassisle(expert)"),
    ("cyan-beach", "Cyan Beach", "cyanbeach"),
    ("cyan-beach-expert", "Cyan Beach (Expert)", "cyanbeach(expert)"),
    ("taupe-hollow", "Taupe Hollow", "taupehollow"),
    ("snowdrop-tundra", "Snowdrop Tundra", "snowdroptundra"),
    ("lapis-lakeside", "Lapis Lakeside", "lapislakeside"),
    ("old-gold-power-plant", "Old Gold Power Plant", "oldgoldpowerplant"),
    ("amber-canyon", "Amber Canyon", "ambercanyon"),
]

# Serebii names that don't reduce to one of our member names.
ALIASES = {
    "toxtricity amped form": "toxel",
    "toxtricity low key form": "toxel",
}

# Spawns Serebii's location pages don't list (confirmed in-game).
# "*" means every island.
EXTRA_SPAWNS = {
    "mew": "*",
    "darkrai": "*",
    "turtwig": ["greengrass-isle", "greengrass-isle-expert", "taupe-hollow", "lapis-lakeside"],
    "chimchar": ["greengrass-isle", "greengrass-isle-expert", "taupe-hollow", "amber-canyon"],
}

ROW = re.compile(r'<td class="cen"><a href="/pokemonsleep/pokemon/[^"]+\.shtml"><u>([^<]+)</u></a></td>')
REGIONAL = re.compile(r"^(alolan|paldean) (.+)$")


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "pleep-matchmaker data build"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("latin-1")


def main() -> int:
    lines = json.loads(LINES_JSON.read_text())
    by_name = {m["name"].lower(): line["id"] for line in lines for m in line["members"]}

    def line_for(name: str) -> str | None:
        key = name.lower()
        regional = REGIONAL.sub(lambda m: f"{m[2]} ({'alola' if m[1] == 'alolan' else 'paldea'})", key)
        for candidate in (key, regional, re.sub(r"\s*\(.*\)$", "", key)):
            if candidate in by_name:
                return by_name[candidate]
        return ALIASES.get(key)

    out, unmatched = [], set()
    for island_id, name, slug in ISLANDS:
        page = fetch(BASE.format(slug))
        table = page[page.find("List of all Pok"):]
        species = [html.unescape(n).strip() for n in ROW.findall(table)]
        if not species:
            print(f"{slug}: no Pokémon table found, page layout may have changed", file=sys.stderr)
            return 1
        ids = set()
        for s in species:
            line = line_for(s)
            if line:
                ids.add(line)
            else:
                unmatched.add(s)
        ids |= {line for line, where in EXTRA_SPAWNS.items() if where == "*" or island_id in where}
        order = {line["id"]: i for i, line in enumerate(lines)}
        out.append({"id": island_id, "name": name, "lines": sorted(ids, key=order.__getitem__)})
        print(f"{name}: {len(species)} species -> {len(ids)} candy lines")
        time.sleep(1)

    known = {island_id for island_id, _, _ in ISLANDS}
    for line, where in EXTRA_SPAWNS.items():
        if line not in by_name.values() or (where != "*" and not set(where) <= known):
            print(f"bad EXTRA_SPAWNS entry: {line}", file=sys.stderr)
            return 1

    if unmatched:
        print(f"unmatched (add to ALIASES or rebuild lines): {sorted(unmatched)}", file=sys.stderr)
        return 1

    covered = {line_id for island in out for line_id in island["lines"]}
    print("on no island:", [line["id"] for line in lines if line["id"] not in covered])
    OUT.write_text(json.dumps(out, indent=2) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
