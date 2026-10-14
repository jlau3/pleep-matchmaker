#!/usr/bin/env python3
"""
Build src/data/islands.json from Serebii's Pokémon Sleep location pages.

Each island page has a "List of all Pokémon Available" table. Every species
there is mapped to its candy line via src/data/candy-lines.json (regional and
event forms fold into the base line). Each island also records which forms of
each line spawn there ("spawns"), so the sleep type filter only counts forms you
can meet on that island (Taupe Hollow has Flareon, not Vaporeon). Run build_lines.py first when the game
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
# "*" means every island. Every form of these lines counts as spawning there.
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
    # Member name (lowercase) -> (line id, member name as in candy-lines.json).
    by_name = {m["name"].lower(): (line["id"], m["name"]) for line in lines for m in line["members"]}
    by_name_line = {name: line_id for name, (line_id, _) in by_name.items()}

    def member_for(name: str) -> tuple[str, str] | None:
        key = name.lower()
        regional = REGIONAL.sub(lambda m: f"{m[2]} ({'alola' if m[1] == 'alolan' else 'paldea'})", key)
        for candidate in (key, regional, re.sub(r"\s*\(.*\)$", "", key), ALIASES.get(key)):
            if candidate in by_name:
                return by_name[candidate]
        return None

    out, unmatched = [], set()
    for island_id, name, slug in ISLANDS:
        page = fetch(BASE.format(slug))
        table = page[page.find("List of all Pok"):]
        species = [html.unescape(n).strip() for n in ROW.findall(table)]
        if not species:
            print(f"{slug}: no Pokémon table found, page layout may have changed", file=sys.stderr)
            return 1
        spawns: dict[str, set[str]] = {}
        for s in species:
            hit = member_for(s)
            if hit:
                spawns.setdefault(hit[0], set()).add(hit[1])
            else:
                unmatched.add(s)
        for line in lines:
            where = EXTRA_SPAWNS.get(line["id"])
            if where == "*" or (where and island_id in where):
                spawns.setdefault(line["id"], set()).update(m["name"] for m in line["members"])
        order = {line["id"]: i for i, line in enumerate(lines)}
        members = {line["id"]: [m["name"] for m in line["members"]] for line in lines}
        ids = sorted(spawns, key=order.__getitem__)
        out.append({
            "id": island_id,
            "name": name,
            "lines": ids,
            # Forms that spawn here, in candy-lines.json member order.
            "spawns": {line_id: [m for m in members[line_id] if m in spawns[line_id]] for line_id in ids},
        })
        print(f"{name}: {len(species)} species -> {len(ids)} candy lines")
        time.sleep(1)

    known = {island_id for island_id, _, _ in ISLANDS}
    for line, where in EXTRA_SPAWNS.items():
        if line not in by_name_line.values() or (where != "*" and not set(where) <= known):
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
