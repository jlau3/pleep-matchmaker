#!/usr/bin/env python3
"""
Safety checks for regenerated game data, run by the daily data job before it
opens a PR. Compares src/data/candy-lines.json with the committed version
(git HEAD) and fails if a change would hurt players:

- a line id disappeared or was renamed (everyone's votes on it would orphan)
- a member has no sprite file
- islands.json mentions a line id that doesn't exist

On success it writes a Markdown summary of what changed to the path given as
the first argument (used for the PR body and the Discord ping), or prints it.

    python3 scripts/check_data.py [summary.md]
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LINES_JSON = ROOT / "src" / "data" / "candy-lines.json"
ISLANDS_JSON = ROOT / "src" / "data" / "islands.json"
SPRITES = ROOT / "public" / "sprites"
AVATARS_JSON = ROOT / "src" / "data" / "avatars.json"
AVATARS = ROOT / "public" / "avatars"


def avatar_file(name: str, variant: str) -> Path:
    """Where an icon variant lives (as avatarSrc in src/lib/avatars.ts)."""
    folder = "happy" if variant.startswith("happy") else "portrait"
    return AVATARS / folder / f"{name}{'_shiny' if variant.endswith('shiny') else ''}.webp"


def committed(path: Path) -> list:
    rel = path.relative_to(ROOT).as_posix()
    out = subprocess.run(["git", "show", f"HEAD:{rel}"], cwd=ROOT, capture_output=True, text=True)
    return json.loads(out.stdout) if out.returncode == 0 else []


def main() -> int:
    errors = []
    lines = json.loads(LINES_JSON.read_text())
    old_lines = committed(LINES_JSON)
    ids = {line["id"] for line in lines}
    old_by_id = {line["id"]: line for line in old_lines}

    gone = sorted(set(old_by_id) - ids)
    if gone:
        errors.append(f"line ids removed or renamed (votes would orphan): {gone}")

    for line in lines:
        for member in line["members"]:
            if not (SPRITES / f"{member['sprite']}.webp").exists():
                errors.append(f"{line['id']}: no sprite for {member['name']} ({member['sprite']}.webp)")

    islands = json.loads(ISLANDS_JSON.read_text())
    for island in islands:
        unknown = sorted(set(island["lines"]) - ids)
        if unknown:
            errors.append(f"{island['id']}: unknown line ids {unknown}")

    avatars = json.loads(AVATARS_JSON.read_text())
    for name, variants in avatars.items():
        if "normal" not in variants:
            errors.append(f"profile icon {name}: no normal variant")
        for variant in variants:
            if not avatar_file(name, variant).exists():
                errors.append(f"profile icon {name}: missing {avatar_file(name, variant).relative_to(ROOT)}")

    if errors:
        print("Data check failed:", *errors, sep="\n- ", file=sys.stderr)
        return 1

    new_lines = [line for line in lines if line["id"] not in old_by_id]
    new_members = []
    for line in lines:
        old = old_by_id.get(line["id"])
        if old:
            before = {(m["dex"], m["name"]) for m in old["members"]}
            new_members += [f"{m['name']} ({line['name']} line)" for m in line["members"] if (m["dex"], m["name"]) not in before]

    old_islands = {i["id"]: set(i["lines"]) for i in committed(ISLANDS_JSON)}
    island_changes = []
    names = {line["id"]: line["name"] for line in lines}
    for island in islands:
        added = sorted(set(island["lines"]) - old_islands.get(island["id"], set()))
        if added:
            island_changes.append(f"{island['name']}: " + ", ".join(names[i] for i in added))

    old_avatars = committed(AVATARS_JSON) or {}
    new_avatars = [name for name in avatars if name not in old_avatars]

    parts = []
    if new_lines:
        parts.append("**New candy lines:** " + ", ".join(f"{l['name']} (#{l['dex']}, {l['addedAt']})" for l in new_lines))
    if new_members:
        parts.append("**New members of existing lines:** " + ", ".join(new_members))
    if island_changes:
        parts.append("**New spawns:**\n" + "\n".join(f"- {c}" for c in island_changes))
    if new_avatars:
        parts.append("**New profile icons (Neroli's Lab):** " + ", ".join(new_avatars))
    summary = "\n\n".join(parts) or "Sprite or data refresh only (no new lines, members or spawns)."

    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(summary + "\n")
    print(summary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
