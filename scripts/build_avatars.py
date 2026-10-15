#!/usr/bin/env python3
"""
Adds in-game profile icons for Pokémon that Neroli's Lab has art for and we
don't yet (public/avatars, src/data/avatars.json). Existing icons are left
alone, so a run only downloads and converts what's new.

Art: Neroli's Lab, frontend/public/images/avatar (Apache-2.0, NOTICE in
public/avatars). portrait/<name>.png is the normal icon, <name>_shiny.png its
shiny; happy/<name>_happy.png and <name>_happy_shiny.png the happy ones. Each
becomes a 96px WebP. A Pokémon without normal art is skipped until it has some.

New names go in Pokédex order (src/data/avatars.json is the picker's order),
using the dex numbers in src/data/candy-lines.json; a form like
"pikachu_halloween" sorts with "pikachu", and anything unknown goes last.

    python3 scripts/build_avatars.py [--source DIR]

--source: a local copy of Neroli's avatar folder. Without it, the folder is
fetched with a shallow sparse git clone.
"""

import argparse
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
    img = Image.open(src).convert("RGBA")
    img.thumbnail((SIZE, SIZE), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "WEBP", quality=88, method=6)


def add_new(source: Path) -> list[str]:
    avatars: dict[str, list[str]] = json.loads(AVATARS_JSON.read_text())
    available = sorted(p.stem for p in (source / "portrait").glob("*.png") if not p.stem.endswith("_shiny"))
    new = [name for name in available if name not in avatars]
    dex = dex_numbers()
    order = list(avatars)
    for name in new:
        variants = []
        for variant, ((src_dir, src_suffix), (out_dir, out_suffix)) in VARIANTS.items():
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
