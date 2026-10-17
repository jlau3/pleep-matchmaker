#!/usr/bin/env python3
"""
Adds in-game profile icons for Pokémon that Neroli's Lab has art for and we
don't yet (public/avatars, src/data/avatars.json). Existing icons are left
alone, so a run only downloads and converts what's new.

Art: Neroli's Lab, frontend/public/images/avatar (Apache-2.0, NOTICE in
public/avatars). portrait/<name>.png is the normal icon, <name>_shiny.png its
shiny; happy/<name>_happy.png and <name>_happy_shiny.png the happy ones. Each
becomes a 96px WebP. A Pokémon without normal art is skipped until it has some.

Pumpkaboo and Gourgeist come in four sizes whose normal art differs only by a
red S/M/L/XL badge. They're one icon each here ("pumpkaboo", "gourgeist"):
the badge is painted over with the same pixels from the happy art, which is
the same picture 1:1 without the badge (only the eyes differ, and those sit
outside the badge). See unbadged().

New names go in Pokédex order (src/data/avatars.json is the picker's order),
using the dex numbers in src/data/candy-lines.json; a form like
"pikachu_halloween" sorts with "pikachu", and anything unknown goes last.

    python3 scripts/build_avatars.py [--source DIR]

--source: a local copy of Neroli's avatar folder. Without it, the folder is
fetched with a shallow sparse git clone.
"""

import argparse
from collections import deque
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
AVATARS_JSON = ROOT / "src" / "data" / "avatars.json"
LINES_JSON = ROOT / "src" / "data" / "candy-lines.json"
OUT = ROOT / "public" / "avatars"
REPO = "https://github.com/nerolis-lab/nerolis-lab.git"
AVATAR_DIR = "frontend/public/images/avatar"
SIZE = 96
# Variant -> (Neroli's folder and file suffix, our folder and file suffix).
VARIANTS = {
    "normal": (("portrait", ""), ("portrait", "")),
    "shiny": (("portrait", "_shiny"), ("portrait", "_shiny")),
    "happy": (("happy", "_happy"), ("happy", "")),
    "happy_shiny": (("happy", "_happy_shiny"), ("happy", "_shiny")),
}
# Size forms kept as one icon each (their art is the same apart from the badge).
SIZED = ("pumpkaboo", "gourgeist")
SIZES = ("small", "medium", "large", "jumbo")
BADGE_RED = (230, 57, 70)


def fetch_source(into: Path) -> Path:
    subprocess.run(
        ["git", "clone", "-q", "--depth", "1", "--filter=blob:none", "--sparse", REPO, str(into)], check=True
    )
    subprocess.run(["git", "-C", str(into), "sparse-checkout", "set", AVATAR_DIR], check=True)
    return into / AVATAR_DIR


def dex_numbers() -> dict[str, int]:
    """Our snake_case Pokémon names ("mr_mime") -> dex number."""
    out = {}
    for line in json.loads(LINES_JSON.read_text()):
        for member in line["members"]:
            key = re.sub(r"[^a-z0-9]+", "_", member["name"].lower()).strip("_")
            out[key] = member["dex"]
    return out


def sort_key(name: str, dex: dict[str, int]) -> tuple:
    """
    Picker position: dex number, the plain Pokémon before its forms, then A-Z.
    A form's dex comes from dropping trailing _parts ("vulpix_alolan" -> "vulpix").
    """
    parts = name.split("_")
    for n in range(len(parts), 0, -1):
        key = "_".join(parts[:n])
        if key in dex:
            return (dex[key], key != name, name)
    return (float("inf"), True, name)


def convert(src: Path, dest: Path) -> None:
    save_icon(Image.open(src).convert("RGBA"), dest)


def unbadged(portrait: Path, happy: Path) -> Image.Image:
    """
    The portrait with its size badge replaced by the happy art's pixels. The
    badge is the connected area that differs from the happy art, grown from its
    red disc (bottom right) to cover its soft shadow; the eyes, the other
    difference, are kept from the portrait.
    """
    p = Image.open(portrait).convert("RGBA")
    h = Image.open(happy).convert("RGBA")
    w, ht = p.size
    pp, hp = p.load(), h.load()

    def differs(x: int, y: int) -> bool:
        a, b = pp[x, y], hp[x, y]
        return (a[3] or b[3]) and max(abs(a[i] - b[i]) for i in range(4)) > 12

    def grow(cells: set, n: int) -> set:
        for _ in range(n):
            cells = cells | {(x + dx, y + dy) for x, y in cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                             if 0 <= x + dx < w and 0 <= y + dy < ht}
        return cells

    seed = next((x, y) for y in range(ht - 1, ht // 2, -1) for x in range(w - 1, w // 2, -1)
                if pp[x, y][:3] == BADGE_RED and pp[x, y][3])
    badge, queue = {seed}, deque([seed])
    while queue:
        x, y = queue.popleft()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                c = (x + dx, y + dy)
                if 0 <= c[0] < w and 0 <= c[1] < ht and c not in badge and differs(*c):
                    badge.add(c)
                    queue.append(c)
    near = grow(badge, 2)
    eyes = grow({(x, y) for x in range(w) for y in range(ht) if (x, y) not in near and differs(x, y)}, 2)
    for x, y in grow(badge, 6) - eyes:
        pp[x, y] = hp[x, y]
    if any(pp[x, y][:3] == BADGE_RED and pp[x, y][3] for x in range(w) for y in range(ht)):
        raise SystemExit(f"Badge left on {portrait.name}")
    return p


def save_icon(img: Image.Image, dest: Path) -> None:
    img.thumbnail((SIZE, SIZE), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "WEBP", quality=88, method=6)


def add_sized(source: Path, name: str) -> list[str]:
    """One icon for a sized Pokémon, from its small form (all four are the same art)."""
    form = f"{name}_{SIZES[0]}"
    variants = []
    for shiny in ("", "_shiny"):
        portrait, happy = source / "portrait" / f"{form}{shiny}.png", source / "happy" / f"{form}_happy{shiny}.png"
        if portrait.exists() and happy.exists():
            save_icon(unbadged(portrait, happy), OUT / "portrait" / f"{name}{shiny}.webp")
            save_icon(Image.open(happy).convert("RGBA"), OUT / "happy" / f"{name}{shiny}.webp")
            variants += ["shiny", "happy_shiny"] if shiny else ["normal", "happy"]
    order = {"normal": 0, "shiny": 1, "happy": 2, "happy_shiny": 3}
    return sorted(variants, key=order.get)


def add_new(source: Path) -> list[str]:
    avatars: dict[str, list[str]] = json.loads(AVATARS_JSON.read_text())
    available = sorted(p.stem for p in (source / "portrait").glob("*.png") if not p.stem.endswith("_shiny"))
    sized = {f"{name}_{size}" for name in SIZED for size in SIZES}
    available = sorted({name for name in available if name not in sized}
                       | {name for name in SIZED if f"{name}_{SIZES[0]}" in available})
    new = [name for name in available if name not in avatars]
    dex = dex_numbers()
    order = list(avatars)
    for name in new:
        variants = add_sized(source, name) if name in SIZED else []
        for variant, ((src_dir, src_suffix), (out_dir, out_suffix)) in ([] if name in SIZED else VARIANTS.items()):
            src = source / src_dir / f"{name}{src_suffix}.png"
            if src.exists():
                convert(src, OUT / out_dir / f"{name}{out_suffix}.webp")
                variants.append(variant)
        avatars[name] = variants
        # After the last icon at or before its dex number, so existing entries keep their places.
        key = sort_key(name, dex)
        at = 0
        for i, existing in enumerate(order):
            if sort_key(existing, dex) <= key:
                at = i + 1
        order.insert(at, name)
    if new:
        AVATARS_JSON.write_text(json.dumps({name: avatars[name] for name in order}, separators=(",", ":")) + "\n")
    return new


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--source", type=Path, help="local copy of Neroli's avatar folder")
    args = parser.parse_args()
    if args.source:
        new = add_new(args.source)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            new = add_new(fetch_source(Path(tmp) / "nerolis-lab"))
    print(f"New profile icons: {', '.join(new)}" if new else "No new profile icons.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
